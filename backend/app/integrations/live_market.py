"""
Wealth OS — Live market data client
===================================

Thin async client (`LiveMarketData`) over free public market APIs, with a small
in-memory TTL cache (get_cache/set_cache) so we stay within free-tier limits and
the UI stays fast.

Providers used
--------------
- Yahoo Finance  : quotes, OHLCV chart history (yahoo_chart/history), search
- CoinGecko      : crypto prices
- ECB/Frankfurter: FX rates (fx_rates) and major forex pairs (forex_table)
- MFAPI.in       : Indian mutual-fund NAV history
- Google News RSS / Yahoo RSS : real, sourced article headlines
- Finnhub        : IPO calendar & company news (optional FINNHUB_API_KEY)

Every method degrades gracefully: on any error it returns cached or sensible
fallback data rather than raising, so the dashboard never breaks.
"""

import os, time, httpx, re, html
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any

CACHE = {}
TTL = 120

def get_cache(k):
    x = CACHE.get(k)
    if x and time.time() - x["ts"] < x.get("ttl", TTL):
        return x["data"]
    return None

def _ema(values, period):
    if not values:
        return []
    k = 2 / (period + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out

def _rsi(closes, period=14):
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    seed = deltas[:period]
    avg_gain = sum(d for d in seed if d > 0) / period
    avg_loss = sum(-d for d in seed if d < 0) / period
    for d in deltas[period:]:
        gain = d if d > 0 else 0
        loss = -d if d < 0 else 0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 1)

def compute_technicals(closes):
    closes = [c for c in closes if c is not None]
    if len(closes) < 35:
        return {}
    rsi = _rsi(closes, 14)
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    signal = _ema(macd_line, 9)
    hist = [m - s for m, s in zip(macd_line, signal)]
    last_macd, last_signal, last_hist = macd_line[-1], signal[-1], hist[-1]
    recent = hist[-40:]
    max_abs = max((abs(h) for h in recent), default=0) or 1e-9
    macd_pos = round(50 + 50 * max(-1, min(1, last_hist / max_abs)), 1)
    sma50 = sum(closes[-50:]) / min(50, len(closes))
    sma200 = sum(closes[-200:]) / min(200, len(closes))
    return {
        "rsi": rsi,
        "macd": round(last_macd, 4),
        "macd_signal": round(last_signal, 4),
        "macd_hist": round(last_hist, 4),
        "macd_pos": macd_pos,
        "sma50": round(sma50, 4),
        "sma200": round(sma200, 4),
        "spark": [round(c, 4) for c in closes[-40:]],
    }

def set_cache(k, data, ttl=None):
    CACHE[k] = {"ts": time.time(), "data": data, "ttl": ttl if ttl is not None else TTL}
    return data

def _dkey(name, env_key=""):
    """Market-data API key: user-entered (data_store.market_data_keys) first, then env."""
    try:
        from app.services import data_store as store
        v = (store.market_data_keys or {}).get(name)
        if v:
            return str(v).strip()
    except Exception:
        pass
    return os.getenv(env_key, "").strip() if env_key else ""

COMMON_COINS = {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "XRP": "ripple", "ADA": "cardano",
                "DOGE": "dogecoin", "DOT": "polkadot", "MATIC": "matic-network", "POL": "matic-network",
                "LTC": "litecoin", "BCH": "bitcoin-cash", "LINK": "chainlink", "AVAX": "avalanche-2",
                "TRX": "tron", "SHIB": "shiba-inu", "UNI": "uniswap", "ATOM": "cosmos", "XLM": "stellar",
                "ALGO": "algorand", "BNB": "binancecoin", "USDT": "tether", "USDC": "usd-coin",
                "NEAR": "near", "APT": "aptos", "ARB": "arbitrum", "OP": "optimism", "FIL": "filecoin",
                "ICP": "internet-computer", "ETC": "ethereum-classic", "HBAR": "hedera-hashgraph"}


def _is_derivative(name: str) -> bool:
    """True for non-share instruments (SPAC rights/units/warrants) we hide from the
    'all shares & funds' exchange browser."""
    low = (name or "").lower()
    return any(x in low for x in ("- right", "- warrant", " warrant", "- unit", " units", "- units"))


class LiveMarketData:
    async def search_symbols(self, query: str) -> List[Dict[str, Any]]:
        query = (query or "").strip()
        if not query:
            return []
        key = f"yahoo-search:{query.lower()}"
        cached = get_cache(key)
        if cached: return cached
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    "https://query2.finance.yahoo.com/v1/finance/search",
                    params={"q": query, "quotesCount": 80, "newsCount": 0, "enableFuzzyQuery": "true"},
                    headers={"User-Agent":"Mozilla/5.0"}
                )
                r.raise_for_status()
                data = r.json()
            rows = []
            for q in data.get("quotes", []):
                symbol = q.get("symbol") or ""
                name = q.get("shortname") or q.get("longname") or symbol
                quote_type = q.get("quoteType") or q.get("typeDisp") or "Asset"
                exchange = q.get("exchange") or q.get("exchDisp") or ""
                if not symbol or not name:
                    continue
                rows.append({
                    "symbol": symbol.upper(),
                    "yahoo": symbol,
                    "name": name,
                    "type": "ETF" if "ETF" in quote_type.upper() else "Mutual Fund" if "MUTUAL" in quote_type.upper() else "Crypto" if "CRYPTO" in quote_type.upper() else "Stock",
                    "sector": q.get("sector") or quote_type.title(),
                    "country": q.get("region") or "Global",
                    "market": exchange.upper() if exchange else "GLOBAL",
                    "market_name": q.get("exchDisp") or exchange,
                    "currency": q.get("currency") or "",
                    "source": "Yahoo search"
                })
            return set_cache(key, rows)
        except Exception:
            return []

    async def yahoo_chart(self, symbol: str, range_: str = "1y", interval: str = "1d") -> Optional[dict]:
        key = f"yahoo-chart:{symbol}:{range_}:{interval}"
        cached = get_cache(key)
        if cached: return cached
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                    params={"range": range_, "interval": interval},
                    headers={"User-Agent":"Mozilla/5.0"}
                )
                r.raise_for_status()
                data = r.json()["chart"]["result"][0]
            meta = data["meta"]
            quote = data["indicators"]["quote"][0]
            ts = data.get("timestamp", [])
            closes = quote.get("close", [])
            opens = quote.get("open", [])
            highs = quote.get("high", [])
            lows = quote.get("low", [])
            vols = quote.get("volume", [])
            points = []
            for i, (t, c) in enumerate(zip(ts, closes)):
                if c is None:
                    continue
                pt = {"time": t, "close": round(float(c), 4)}
                try:
                    if i < len(opens) and opens[i] is not None: pt["open"] = round(float(opens[i]), 4)
                    if i < len(highs) and highs[i] is not None: pt["high"] = round(float(highs[i]), 4)
                    if i < len(lows) and lows[i] is not None: pt["low"] = round(float(lows[i]), 4)
                    if i < len(vols) and vols[i] is not None: pt["volume"] = int(vols[i])
                except Exception:
                    pass
                points.append(pt)
            price = meta.get("regularMarketPrice") or (points[-1]["close"] if points else meta.get("previousClose", 0))
            prev = meta.get("chartPreviousClose") or meta.get("previousClose") or price
            out = {"symbol": symbol, "price": round(float(price),4), "previous": round(float(prev),4), "currency": meta.get("currency","USD"), "exchange": meta.get("exchangeName",""), "points": points, "source": "Yahoo chart"}
            return set_cache(key, out)
        except Exception:
            return None

    async def quote_from_history(self, symbol: str, asset_type="Stock") -> Optional[dict]:
        if asset_type.lower() == "crypto":
            cq = await self.crypto_quote(symbol)
            if cq:
                return cq
        ch = await self.yahoo_chart(symbol, "1y", "1d")
        if not ch or not ch.get("points"):
            return None
        points = ch["points"]
        price = ch["price"]
        closes = [p["close"] for p in points if p.get("close") is not None]
        def perf(days):
            if len(points) <= days:
                base = points[0]["close"]
            else:
                base = points[-days]["close"]
            return round((price - base) / base * 100, 2) if base else 0
        prev = points[-2]["close"] if len(points) > 1 else ch.get("previous", price)
        return {
            "symbol": symbol,
            "price": price,
            "currency": ch.get("currency","USD"),
            "day": round((price-prev)/prev*100,2) if prev else 0,
            "week": perf(5),
            "month": perf(22),
            "year": perf(252),
            "year_low": round(min(closes), 4) if closes else price,
            "year_high": round(max(closes), 4) if closes else price,
            "source": ch.get("source", "Yahoo chart"),
            **compute_technicals(closes),
        }

    def cached_quote(self, symbol: str):
        """Return a quote dict ONLY if the symbol's chart is already in cache — no network
        call. Used to decorate search results with live prices without slowing type-ahead."""
        if not symbol:
            return None
        # Crypto prices live in the CoinGecko cache (keyed by coin id), not the chart cache.
        base = symbol.upper().replace("-USD", "").replace("-EUR", "").replace("USDT", "").replace("USD", "").strip()
        cid = COMMON_COINS.get(base)
        if cid:
            cq = get_cache(f"cgq:{cid}")
            if cq and cq.get("price"):
                return {**cq, "symbol": symbol}
        ch = get_cache(f"yahoo-chart:{symbol}:1y:1d")
        if not ch or not ch.get("points"):
            return None
        pts = ch["points"]
        price = ch.get("price")
        closes = [p["close"] for p in pts if p.get("close") is not None]
        if not closes or price is None:
            return None
        prev = pts[-2]["close"] if len(pts) > 1 else ch.get("previous", price)
        def perf(days):
            b = pts[0]["close"] if len(pts) <= days else pts[-days]["close"]
            return round((price - b) / b * 100, 2) if b else 0
        return {"symbol": symbol, "price": price, "currency": ch.get("currency", "USD"),
                "day": round((price - prev) / prev * 100, 2) if prev else 0,
                "week": perf(5), "month": perf(22), "year": perf(252),
                "year_low": round(min(closes), 4), "year_high": round(max(closes), 4),
                "source": ch.get("source", "Yahoo chart")}

    async def resolve_and_quote(self, symbol: str, name: str = "", asset_type: str = "Stock", prefer_suffix: str = ""):
        """Quote a symbol; if it doesn't resolve on Yahoo, search by name/symbol to
        find the real ticker (e.g. 'ICICI_PRUD_GOLD_ETF' -> 'GOLDIETF.NS') and retry.
        Returns (quote_or_None, resolved_symbol). Resolution is cached."""
        q = await self.quote_from_history(symbol, asset_type)
        if q:
            return q, symbol
        key = f"resolvesym:{(symbol or '').upper()}|{(name or '').lower()}"
        cached = get_cache(key)
        if cached is not None:
            alt = cached.get("alt") or ""
            if alt:
                q2 = await self.quote_from_history(alt, asset_type)
                if q2:
                    return q2, alt
            return None, symbol
        candidates = []
        for term in [name, symbol]:
            if not term:
                continue
            for row in await self.search_symbols(term):
                s = row.get("symbol")
                if s and s not in candidates:
                    candidates.append(s)
            if candidates:
                break
        if prefer_suffix:
            candidates.sort(key=lambda s: 0 if s.upper().endswith(prefer_suffix.upper()) else 1)
        for s in candidates[:4]:
            if s.upper() == (symbol or "").upper():
                continue
            q2 = await self.quote_from_history(s, asset_type)
            if q2:
                set_cache(key, {"alt": s})
                return q2, s
        set_cache(key, {"alt": ""})
        return None, symbol

    async def twelvedata_quote(self, symbol: str):
        """US/EU/India stocks & ETFs via Twelve Data (needs TWELVE_DATA_API_KEY)."""
        key = _dkey("twelvedata", "TWELVE_DATA_API_KEY")
        if not key or not symbol:
            return None
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get("https://api.twelvedata.com/quote", params={"symbol": symbol, "apikey": key})
                r.raise_for_status()
                d = r.json()
            if not isinstance(d, dict) or d.get("status") == "error" or "close" not in d:
                return None
            price = float(d.get("close") or 0)
            if price <= 0:
                return None
            prev = float(d.get("previous_close") or price)
            wk = d.get("fifty_two_week", {}) or {}
            return {"symbol": symbol, "price": round(price, 4), "currency": d.get("currency", "USD"),
                    "day": round((price - prev) / prev * 100, 2) if prev else 0, "week": 0, "month": 0, "year": 0,
                    "year_low": float(wk.get("low") or price), "year_high": float(wk.get("high") or price),
                    "source": "Twelve Data"}
        except Exception:
            return None

    async def finnhub_quote(self, symbol: str):
        """US stocks via Finnhub (needs FINNHUB_API_KEY)."""
        key = _dkey("finnhub", "FINNHUB_API_KEY")
        if not key or not symbol:
            return None
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get("https://finnhub.io/api/v1/quote", params={"symbol": symbol.split(".")[0], "token": key})
                r.raise_for_status()
                d = r.json()
            price = float(d.get("c") or 0)
            if price <= 0:
                return None
            prev = float(d.get("pc") or price)
            return {"symbol": symbol, "price": round(price, 4), "currency": "USD",
                    "day": round((price - prev) / prev * 100, 2) if prev else 0, "week": 0, "month": 0, "year": 0,
                    "year_low": price, "year_high": price, "source": "Finnhub"}
        except Exception:
            return None

    async def mf_quote(self, name: str = "", symbol: str = ""):
        """Indian mutual-fund NAV via MFAPI.in (keyless, AMFI data). Resolves the scheme
        by name/symbol, then computes NAV + day/week/month/year performance + technicals."""
        term0 = (name or symbol or "").strip()
        if not term0:
            return None
        ckey = f"mfq:{term0.lower()}"
        cached = get_cache(ckey)
        if cached:
            return cached
        try:
            code = None
            async with httpx.AsyncClient(timeout=12) as c:
                for term in [name, symbol]:
                    if not term:
                        continue
                    s = await c.get("https://api.mfapi.in/mf/search", params={"q": term})
                    if s.status_code == 200 and s.json():
                        code = s.json()[0].get("schemeCode")
                        if code:
                            break
                if not code:
                    return None
                r = await c.get(f"https://api.mfapi.in/mf/{code}")
                r.raise_for_status()
                d = r.json()
            navs = []
            for x in d.get("data", []):
                try:
                    navs.append(float(x["nav"]))
                except (KeyError, ValueError, TypeError):
                    continue
            if not navs:
                return None
            price = navs[0]  # MFAPI returns latest-first
            def perf(n):
                b = navs[n] if len(navs) > n else navs[-1]
                return round((price - b) / b * 100, 2) if b else 0
            closes = navs[:400][::-1]  # chronological for indicators
            out = {"symbol": symbol or str(code), "price": round(price, 4), "currency": "INR",
                   "day": perf(1), "week": perf(5), "month": perf(22), "year": perf(252),
                   "year_low": round(min(closes), 4), "year_high": round(max(closes), 4),
                   "source": "MFAPI (AMFI NAV)", **compute_technicals(closes)}
            return set_cache(ckey, out)
        except Exception:
            return None

    async def metal_spot(self):
        """Live gold & silver spot price (USD per troy ounce) from Yahoo futures. Keyless."""
        ckey = "metalspot"
        cached = get_cache(ckey)
        if cached:
            return cached
        out = {"gold_usd_oz": 0, "silver_usd_oz": 0, "source": "Yahoo"}
        for sym, k in (("GC=F", "gold_usd_oz"), ("SI=F", "silver_usd_oz")):
            try:
                ch = await self.yahoo_chart(sym, "5d", "1d")
                if ch and ch.get("price"):
                    out[k] = float(ch["price"])
            except Exception:
                pass
        return set_cache(ckey, out) if (out["gold_usd_oz"] or out["silver_usd_oz"]) else out

    async def mf_search(self, q: str):
        q = (q or "").strip()
        if len(q) < 3:
            return []
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get("https://api.mfapi.in/mf/search", params={"q": q})
                r.raise_for_status()
                return [{"schemeCode": x.get("schemeCode"), "schemeName": x.get("schemeName")} for x in r.json()[:10]]
        except Exception:
            return []

    async def mf_series(self, name: str = "", symbol: str = ""):
        """Full NAV history for a mutual fund (for SIP simulation).
        Returns {code, scheme_name, navs:[{date:'YYYY-MM-DD', nav:float}...] chronological}."""
        term0 = (name or symbol or "").strip()
        if not term0:
            return None
        ckey = f"mfseries:{term0.lower()}"
        cached = get_cache(ckey)
        if cached:
            return cached
        try:
            code = None
            scheme_name = name
            async with httpx.AsyncClient(timeout=12) as c:
                for term in [name, symbol]:
                    if not term:
                        continue
                    s = await c.get("https://api.mfapi.in/mf/search", params={"q": term})
                    if s.status_code == 200 and s.json():
                        code = s.json()[0].get("schemeCode")
                        scheme_name = s.json()[0].get("schemeName") or name
                        if code:
                            break
                if not code:
                    return None
                r = await c.get(f"https://api.mfapi.in/mf/{code}")
                r.raise_for_status()
                d = r.json()
            navs = []
            for x in d.get("data", []):
                try:
                    dd, mm, yy = x["date"].split("-")
                    navs.append({"date": f"{yy}-{mm}-{dd}", "nav": float(x["nav"])})
                except Exception:
                    continue
            navs.sort(key=lambda r: r["date"])
            if not navs:
                return None
            out = {"code": code, "scheme_name": scheme_name, "navs": navs}
            return set_cache(ckey, out)
        except Exception:
            return None

    async def best_quote(self, symbol: str, name: str = "", asset_type: str = "Stock", prefer_suffix: str = ""):
        """Multi-provider live quote with fallbacks. Returns (quote_or_None, resolved_symbol).
        crypto -> CoinGecko; mutual fund -> MFAPI; else Yahoo (+search) -> Twelve Data -> Finnhub -> MFAPI."""
        t = (asset_type or "").lower()
        if t == "crypto":
            q = await self.crypto_quote(symbol, name)
            return (q, symbol) if q else (None, symbol)
        if t in ("mutual fund", "fund", "mf"):
            q = await self.mf_quote(name, symbol)
            if q:
                return q, symbol
        q, resolved = await self.resolve_and_quote(symbol, name, asset_type, prefer_suffix)
        if q:
            return q, resolved
        td = await self.twelvedata_quote(symbol)
        if td:
            return td, symbol
        fh = await self.finnhub_quote(symbol)
        if fh:
            return fh, symbol
        mf = await self.mf_quote(name, symbol)
        if mf:
            return mf, symbol
        return None, symbol

    async def _coin_id(self, symbol: str, name: str = ""):
        """Resolve a crypto ticker/name to a CoinGecko coin id (cached, keyless)."""
        base = (symbol or "").upper().replace("-USD", "").replace("-EUR", "").replace("USDT", "").replace("USD", "").strip()
        common = COMMON_COINS
        if base in common:
            return common[base]
        ck = f"coinid:{base}|{(name or '').lower()}"
        cached = get_cache(ck)
        if cached is not None:
            return cached or None
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get("https://api.coingecko.com/api/v3/search", params={"query": name or base})
                r.raise_for_status()
                coins = r.json().get("coins", [])
            cid = next((co.get("id") for co in coins if (co.get("symbol") or "").upper() == base), "")
            if not cid and coins:
                cid = coins[0].get("id") or ""
            set_cache(ck, cid)
            return cid or None
        except Exception:
            return None

    async def coingecko_quote(self, symbol: str, name: str = ""):
        """Full crypto quote (price + day/week/month/year + technicals) from CoinGecko history. Keyless."""
        cid = await self._coin_id(symbol, name)
        if not cid:
            return None
        ckey = f"cgq:{cid}"
        cached = get_cache(ckey)
        if cached:
            return {**cached, "symbol": symbol}
        try:
            async with httpx.AsyncClient(timeout=12) as c:
                r = await c.get(f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart",
                                params={"vs_currency": "usd", "days": 365})
                r.raise_for_status()
                prices = [p[1] for p in r.json().get("prices", []) if p and p[1] is not None]
        except Exception:
            return None
        if not prices:
            return None
        price = round(float(prices[-1]), 4)
        def perf(days):
            b = prices[-1 - days] if len(prices) > days else prices[0]
            return round((price - b) / b * 100, 2) if b else 0
        out = {"symbol": symbol, "price": price, "currency": "USD",
               "day": perf(1), "week": perf(7), "month": perf(30), "year": perf(364),
               "year_low": round(min(prices), 4), "year_high": round(max(prices), 4),
               "source": "CoinGecko", **compute_technicals(prices)}
        set_cache(ckey, out)
        return out

    async def coinbase_quote(self, symbol: str):
        """Crypto spot price from Coinbase Exchange (keyless, price only)."""
        base = (symbol or "").upper().replace("-USD", "").replace("USDT", "").replace("USD", "").strip()
        if not base:
            return None
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"https://api.coinbase.com/v2/prices/{base}-USD/spot")
                r.raise_for_status()
                price = float(r.json().get("data", {}).get("amount") or 0)
            if price <= 0:
                return None
            return {"symbol": symbol, "price": round(price, 4), "currency": "USD",
                    "day": 0, "week": 0, "month": 0, "year": 0,
                    "year_low": price, "year_high": price, "source": "Coinbase"}
        except Exception:
            return None

    async def binance_quote(self, symbol: str):
        """Crypto price + 24h change/high/low from Binance (keyless)."""
        base = (symbol or "").upper().replace("-USD", "").replace("USDT", "").replace("USD", "").strip()
        if not base:
            return None
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get("https://api.binance.com/api/v3/ticker/24hr", params={"symbol": f"{base}USDT"})
                r.raise_for_status()
                d = r.json()
            price = float(d.get("lastPrice") or 0)
            if price <= 0:
                return None
            return {"symbol": symbol, "price": round(price, 4), "currency": "USD",
                    "day": round(float(d.get("priceChangePercent") or 0), 2), "week": 0, "month": 0, "year": 0,
                    "year_low": round(float(d.get("lowPrice") or price), 4), "year_high": round(float(d.get("highPrice") or price), 4),
                    "source": "Binance"}
        except Exception:
            return None

    async def crypto_quote(self, symbol: str, name: str = ""):
        """Robust keyless crypto quote with a 4-source fallback chain:
        CoinGecko (full history) -> Yahoo (SYM-USD) -> Coinbase spot -> Binance 24h."""
        q = await self.coingecko_quote(symbol, name)
        if q:
            return q
        base = (symbol or "").upper().replace("-USD", "").replace("USDT", "").replace("USD", "").strip()
        ch = await self.yahoo_chart(f"{base}-USD", "1y", "1d")
        if ch and ch.get("points"):
            pts = ch["points"]; price = ch["price"]; closes = [p["close"] for p in pts if p.get("close") is not None]
            def perf(days):
                b = pts[0]["close"] if len(pts) <= days else pts[-days]["close"]
                return round((price - b) / b * 100, 2) if b else 0
            prev = pts[-2]["close"] if len(pts) > 1 else price
            return {"symbol": symbol, "price": price, "currency": ch.get("currency", "USD"),
                    "day": round((price - prev) / prev * 100, 2) if prev else 0, "week": perf(5), "month": perf(22), "year": perf(252),
                    "year_low": round(min(closes), 4) if closes else price, "year_high": round(max(closes), 4) if closes else price,
                    "source": "Yahoo chart", **compute_technicals(closes)}
        return await self.coinbase_quote(symbol) or await self.binance_quote(symbol)

    async def live_price(self, symbol: str, asset_type: str = "Stock"):
        """Near-real-time current price + day change, short-cached (~12s) for the
        Asset Detail live ticker. Crypto → Binance (updates every second);
        stocks/ETF → Yahoo intraday 1-minute bars (refreshes through the session)."""
        if not symbol:
            return None
        ckey = f"liveprice:{symbol}:{asset_type}"
        cached = get_cache(ckey)
        if cached:
            return cached
        out = None
        t = (asset_type or "").lower()
        if t == "crypto":
            q = await self.binance_quote(symbol) or await self.coinbase_quote(symbol) or await self.coingecko_quote(symbol)
            if q:
                out = {"symbol": symbol, "price": q["price"], "day": q.get("day", 0),
                       "currency": q.get("currency", "USD"), "source": q.get("source", "Crypto")}
        else:
            try:
                async with httpx.AsyncClient(timeout=8) as c:
                    r = await c.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                                    params={"range": "1d", "interval": "1m"}, headers={"User-Agent": "Mozilla/5.0"})
                    r.raise_for_status()
                    meta = r.json()["chart"]["result"][0]["meta"]
                price = meta.get("regularMarketPrice")
                prev = meta.get("chartPreviousClose") or meta.get("previousClose") or price
                if price:
                    out = {"symbol": symbol, "price": round(float(price), 4),
                           "day": round((float(price) - prev) / prev * 100, 2) if prev else 0,
                           "currency": meta.get("currency", "USD"), "source": "Yahoo (1m)",
                           "market_state": meta.get("marketState", "")}
            except Exception:
                out = None
        if not out:
            q = self.cached_quote(symbol)
            if q:
                out = {"symbol": symbol, "price": q["price"], "day": q.get("day", 0),
                       "currency": q.get("currency", "USD"), "source": q.get("source", "cache")}
        if out:
            set_cache(ckey, out, ttl=12)
        return out

    async def _fetch_text(self, url):
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(url, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            return r.text

    async def exchange_listings(self, market: str):
        """Full directory of every security listed on an exchange (cached 12h, keyless).
        NASDAQ/NYSE/AMEX → Nasdaq Trader symbol files; NSE → NSE archives EQUITY_L.csv."""
        m = (market or "").upper()
        ckey = f"listings:{m}"
        cached = get_cache(ckey)
        if cached is not None:
            return cached
        items = []
        try:
            if m == "NASDAQ":
                txt = await self._fetch_text("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt")
                for line in txt.splitlines()[1:]:
                    if line.startswith("File Creation"):
                        continue
                    p = line.split("|")
                    if len(p) < 8 or not p[0] or p[3] == "Y":  # p[3]=Test Issue
                        continue
                    if _is_derivative(p[1]):  # drop rights / warrants / units
                        continue
                    items.append({"symbol": p[0], "yahoo": p[0], "name": p[1],
                                  "type": "ETF" if p[6] == "Y" else "Stock", "market": "NASDAQ",
                                  "market_name": "Nasdaq", "country": "US", "currency": "USD"})
            elif m in ("NYSE", "AMEX", "ARCA", "BATS"):
                code = {"NYSE": "N", "AMEX": "A", "ARCA": "P", "BATS": "Z"}[m]
                txt = await self._fetch_text("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt")
                for line in txt.splitlines()[1:]:
                    if line.startswith("File Creation"):
                        continue
                    p = line.split("|")
                    if len(p) < 8 or not p[0] or p[2] != code or p[6] == "Y":  # p[2]=Exchange, p[6]=Test Issue
                        continue
                    if _is_derivative(p[1]):
                        continue
                    items.append({"symbol": p[0], "yahoo": p[0].replace(".", "-"), "name": p[1],
                                  "type": "ETF" if p[4] == "Y" else "Stock", "market": m,
                                  "market_name": m, "country": "US", "currency": "USD"})
            elif m in ("NSE", "BSE"):
                import csv, io
                txt = await self._fetch_text("https://archives.nseindia.com/content/equities/EQUITY_L.csv")
                for row in list(csv.reader(io.StringIO(txt)))[1:]:
                    if len(row) < 2 or not row[0].strip():
                        continue
                    series = row[2].strip() if len(row) > 2 else ""
                    if series and series != "EQ":
                        continue
                    sym = row[0].strip()
                    items.append({"symbol": sym, "yahoo": f"{sym}.NS", "name": row[1].strip(),
                                  "type": "Stock", "market": "NSE", "market_name": "NSE",
                                  "country": "India", "currency": "INR"})
                # NSE ETFs (separate file) — so Groww ETF holders see them too
                try:
                    etxt = await self._fetch_text("https://archives.nseindia.com/content/equities/eq_etfseclist.csv")
                    for row in list(csv.reader(io.StringIO(etxt)))[1:]:
                        if len(row) < 3 or not row[0].strip():
                            continue
                        sym = row[0].strip()
                        nm = (row[1].strip() or row[2].strip())  # Underlying, else SecurityName
                        items.append({"symbol": sym, "yahoo": f"{sym}.NS", "name": nm,
                                      "type": "ETF", "market": "NSE", "market_name": "NSE",
                                      "country": "India", "currency": "INR"})
                except Exception:
                    pass
        except Exception:
            items = []
        return set_cache(ckey, items, ttl=43200)

    async def finnhub_listings(self, market_code: str, finnhub_exchange: str):
        """Full symbol directory for any exchange via Finnhub (needs a free FINNHUB key).
        Used for exchanges with no open directory (XETRA, LSE, Tokyo…). Cached 12h."""
        key = _dkey("finnhub", "FINNHUB_API_KEY")
        if not key:
            return []
        ckey = f"fhlist:{finnhub_exchange}"
        cached = get_cache(ckey)
        if cached is not None:
            return cached
        out = []
        try:
            async with httpx.AsyncClient(timeout=25) as cl:
                r = await cl.get("https://finnhub.io/api/v1/stock/symbol",
                                 params={"exchange": finnhub_exchange, "token": key})
                r.raise_for_status()
                data = r.json()
            for d in data:
                sym = d.get("symbol") or d.get("displaySymbol")
                if not sym:
                    continue
                ty = (d.get("type") or "").upper()
                out.append({"symbol": d.get("displaySymbol") or sym, "yahoo": sym,
                            "name": d.get("description") or sym,
                            "type": "ETF" if ("ETF" in ty or "ETP" in ty or "FUND" in ty) else "Stock",
                            "market": market_code, "market_name": market_code,
                            "currency": d.get("currency") or ""})
        except Exception:
            return []
        return set_cache(ckey, out, ttl=43200)

    async def coin_markets(self, pages: int = 4):
        """Top crypto coins by market cap from CoinGecko, already priced. Keyless."""
        ckey = "coinmkts"
        cached = get_cache(ckey)
        if cached:
            return cached
        out = []
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                for pg in range(1, pages + 1):
                    r = await c.get("https://api.coingecko.com/api/v3/coins/markets",
                                    params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": pg})
                    if r.status_code != 200:
                        break
                    data = r.json()
                    if not data:
                        break
                    for d in data:
                        sym = (d.get("symbol") or "").upper()
                        if not sym:
                            continue
                        out.append({"symbol": sym, "yahoo": f"{sym}-USD", "name": d.get("name") or sym,
                                    "type": "Crypto", "market": "CRYPTO", "market_name": "Crypto",
                                    "country": "Global", "currency": "USD",
                                    "price": d.get("current_price"),
                                    "day": round(d.get("price_change_percentage_24h") or 0, 2)})
        except Exception:
            pass
        return set_cache(ckey, out, ttl=300) if out else out

    async def crypto_prices(self, ids: List[str], vs_currency="eur") -> Dict[str, dict]:
        key = f"cg:{','.join(ids)}:{vs_currency}"
        cached = get_cache(key)
        if cached: return cached
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": ",".join(ids), "vs_currencies": vs_currency, "include_24hr_change": "true"}
                )
                r.raise_for_status()
                data = r.json()
            out = {}
            for k, v in data.items():
                out[k] = {"price": round(float(v.get(vs_currency, 0)),4), "currency": vs_currency.upper(), "day": round(float(v.get(f"{vs_currency}_24h_change",0)),2), "source": "CoinGecko"}
            return set_cache(key, out)
        except Exception:
            return {}

    async def fx_rates(self, base="EUR"):
        """Live FX with a 3-provider fallback so currency conversion never goes stale:
        ECB/Frankfurter -> open.er-api.com -> exchangerate.host -> static."""
        key = f"fx:{base}"
        cached = get_cache(key)
        if cached:
            return cached
        # 1) ECB / Frankfurter
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.frankfurter.dev/v1/latest", params={"base": base})
                r.raise_for_status()
                rates = r.json().get("rates", {})
            if rates:
                return set_cache(key, {"base": base, "rates": rates, "source": "Frankfurter (ECB)"})
        except Exception:
            pass
        # 2) open.er-api.com (keyless, broad currency coverage incl. AED)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"https://open.er-api.com/v6/latest/{base}")
                r.raise_for_status()
                d = r.json()
            if d.get("result") == "success" and d.get("rates"):
                return set_cache(key, {"base": base, "rates": d["rates"], "source": "exchangerate-api"})
        except Exception:
            pass
        # 3) exchangerate.host
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.exchangerate.host/latest", params={"base": base})
                r.raise_for_status()
                rates = r.json().get("rates", {})
            if rates:
                return set_cache(key, {"base": base, "rates": rates, "source": "exchangerate.host"})
        except Exception:
            pass
        return {"base": base, "rates": {"USD": 1.08, "INR": 90, "AED": 3.97, "GBP": 0.84, "CAD": 1.49, "MXN": 20, "CHF": 0.93, "SEK": 11.2, "DKK": 7.46, "NOK": 11.5, "PLN": 4.3, "JPY": 165, "HKD": 8.4, "CNY": 7.8, "AUD": 1.63, "NZD": 1.78, "SGD": 1.47, "BRL": 6.2, "ZAR": 20}, "source": "Fallback FX"}

    async def forex_table(self):
        """Major FX pairs with live price + daily/weekly change, from Frankfurter (ECB)."""
        key = "forex:majors"
        cached = get_cache(key)
        if cached: return cached
        pairs = [("EUR","USD"),("GBP","USD"),("USD","JPY"),("USD","INR"),("USD","CHF"),
                 ("AUD","USD"),("USD","CAD"),("USD","CNY"),("NZD","USD"),("EUR","GBP"),
                 ("EUR","JPY"),("EUR","INR")]
        names = {"EUR":"Euro","USD":"US Dollar","GBP":"British Pound","JPY":"Japanese Yen",
                 "INR":"Indian Rupee","CHF":"Swiss Franc","AUD":"Australian Dollar",
                 "CAD":"Canadian Dollar","CNY":"Chinese Yuan","NZD":"New Zealand Dollar"}
        symbols = "EUR,GBP,JPY,INR,CHF,AUD,CAD,CNY,NZD"
        def _round(p, qte):
            return round(p, 2 if qte in ("JPY","INR") else 4)
        def _build(latest, prev, weekago, as_of, source):
            rows = []
            for b, qte in pairs:
                try:
                    price = latest[qte] / latest[b]
                    pday = prev[qte] / prev[b]
                    pweek = weekago[qte] / weekago[b]
                    rows.append({
                        "pair": f"{b}/{qte}", "base": b, "quote": qte,
                        "name": f"{names.get(b,b)} / {names.get(qte,qte)}",
                        "price": _round(price, qte),
                        "day": round((price - pday) / pday * 100, 2) if pday else 0,
                        "week": round((price - pweek) / pweek * 100, 2) if pweek else 0,
                    })
                except Exception:
                    continue
            return {"pairs": rows, "as_of": as_of, "source": source}
        try:
            end = time.strftime("%Y-%m-%d")
            start = time.strftime("%Y-%m-%d", time.localtime(time.time() - 10 * 86400))
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"https://api.frankfurter.dev/v1/{start}..{end}",
                                     params={"base": "USD", "symbols": symbols})
                r.raise_for_status()
                data = r.json()
            series = data.get("rates", {})
            dates = sorted(series.keys())
            if not dates:
                raise ValueError("empty fx series")
            latest = {**series[dates[-1]], "USD": 1.0}
            prev = {**(series[dates[-2]] if len(dates) >= 2 else series[dates[-1]]), "USD": 1.0}
            weekago = {**series[dates[0]], "USD": 1.0}
            return set_cache(key, _build(latest, prev, weekago, dates[-1], "Frankfurter (ECB)"))
        except Exception:
            fb = {"USD": 1.0, "EUR": 0.92, "GBP": 0.79, "JPY": 156.0, "INR": 83.3, "CHF": 0.90,
                  "AUD": 1.50, "CAD": 1.37, "CNY": 7.25, "NZD": 1.63}
            return _build(fb, fb, fb, "", "Fallback FX")

    async def news(self, symbol: str, asset_type="Stock"):
        if asset_type.lower() == "crypto":
            slug = "bitcoin" if "BTC" in symbol.upper() else "ethereum" if "ETH" in symbol.upper() else symbol.lower()
            return [
                {"headline": f"{symbol} market page on Binance", "summary": "Open Binance market page for live crypto news, depth and trading context.", "url": f"https://www.binance.com/en/price/{slug}", "source":"Binance"},
                {"headline": f"{symbol} market page on CoinGecko", "summary": "Open CoinGecko for crypto price, market cap, volume and community data.", "url": f"https://www.coingecko.com/en/coins/{slug}", "source":"CoinGecko"},
                {"headline": f"{symbol} Reddit discussions", "summary": "Open Reddit search to review community sentiment, risks, narratives and counter-arguments.", "url": f"https://www.reddit.com/search/?q={symbol}%20crypto", "source":"Reddit"},
            ]
        token = os.getenv("FINNHUB_API_KEY", "")
        if token:
            try:
                today = time.strftime("%Y-%m-%d")
                frm = time.strftime("%Y-%m-%d", time.localtime(time.time()-7*86400))
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.get("https://finnhub.io/api/v1/company-news", params={"symbol": symbol.split(".")[0], "from": frm, "to": today, "token": token})
                    r.raise_for_status()
                    data = r.json()[:6]
                return [{"headline": n.get("headline"), "summary": n.get("summary") or n.get("headline"), "url": n.get("url"), "source": n.get("source","Finnhub")} for n in data if n.get("headline")]
            except Exception:
                pass
        yahoo_symbol = symbol
        return [
            {"headline": f"{symbol} on Yahoo Finance", "summary": "Open Yahoo Finance for live chart, company profile, financials, statistics and latest headlines.", "url": f"https://finance.yahoo.com/quote/{yahoo_symbol}", "source":"Yahoo Finance"},
            {"headline": f"{symbol} news search", "summary": "Open Yahoo Finance search/news page for broader market coverage.", "url": f"https://finance.yahoo.com/lookup?s={yahoo_symbol}", "source":"Yahoo Finance"},
            {"headline": f"{symbol} analyst overview on MarketWatch", "summary": "Open MarketWatch for analyst ratings, estimates, company profile and market commentary where available.", "url": f"https://www.marketwatch.com/investing/stock/{symbol.split('.')[0].lower()}", "source":"MarketWatch"},
            {"headline": f"{symbol} Reddit investor discussions", "summary": "Open Reddit search to compare investor narratives, risks, bull cases and bear cases.", "url": f"https://www.reddit.com/search/?q={symbol}%20stock%20analysis", "source":"Reddit"},
            {"headline": f"{symbol} Seeking Alpha search", "summary": "Open Seeking Alpha search for contributor analysis and earnings commentary where available.", "url": f"https://seekingalpha.com/search?q={symbol}", "source":"Seeking Alpha"},
        ]

    async def yahoo_rss_news(self, symbol: str):
        sym = (symbol or "").strip()
        if not sym:
            return []
        key = f"yrss:{sym.lower()}"
        cached = get_cache(key)
        if cached is not None:
            return cached
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={sym}&region=US&lang=en-US"
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                r.raise_for_status()
            root = ET.fromstring(r.text)
            rows = []
            for it in root.findall(".//item")[:10]:
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or "").strip()
                if not title or not link:
                    continue
                desc = html.unescape(re.sub(r"<[^>]+>", " ", it.findtext("description") or ""))
                desc = re.sub(r"\s+", " ", desc).strip()
                if title and desc.lower().startswith(title.lower()[:30]):
                    desc = ""
                m = re.search(r"https?://([^/]+)/", link)
                dom = m.group(1).lower() if m else ""
                if dom.startswith("www."):
                    dom = dom[4:]
                source = "Yahoo Finance" if "yahoo" in dom else (dom.split(".")[0].title() if dom else "Yahoo Finance")
                rows.append({
                    "headline": title,
                    "summary": desc[:200],
                    "url": link,
                    "source": source,
                    "domain": dom or "finance.yahoo.com",
                    "published": it.findtext("pubDate") or "",
                    "placeholder": False,
                })
            return set_cache(key, rows)
        except Exception:
            return []

    async def history(self, symbol: str, range_: str):
        request_range = "1d" if range_ in {"1h", "24h"} else range_
        interval = "5m" if request_range == "1d" else "1d"
        ch = await self.yahoo_chart(symbol, request_range, interval)
        if not ch:
            return {"symbol": symbol, "range": range_, "points": [], "source": "Unavailable"}
        points = ch["points"]
        if range_ == "1h":
            points = points[-12:]
        return {"symbol": symbol, "range": range_, "points": points, "source": ch["source"],
                "currency": ch["currency"], "price": ch.get("price"), "previous": ch.get("previous")}
