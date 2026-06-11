"""
Wealth OS — Broker connectors
=============================

Live, read-only connectors for brokers that expose a usable retail API
(Trading 212, Zerodha/Kite, IBKR Client Portal Gateway, Coinbase). Credentials
come from what the user saves in the UI (services.data_store.broker_credentials)
and fall back to environment variables. Brokers without a public retail API
(Groww, Scalable Capital, MF Central) are handled via the universal CSV import
in main.py instead.

`normalize_positions()` maps each broker's raw response into the app's common
holding shape so they can be imported straight into the portfolio.
"""

import os, httpx
from app.services import data_store as store


def _cred(broker_key: str, field: str, env_key: str = "") -> str:
    """Stored UI credential first, then environment variable."""
    saved = (store.broker_credentials.get(broker_key) or {}).get(field)
    if saved:
        return str(saved).strip()
    return os.getenv(env_key, "").strip() if env_key else ""


class BrokerHub:
    # --------------------------------------------------------------------- #
    # Status                                                                #
    # --------------------------------------------------------------------- #
    def statuses(self):
        t212 = bool(_cred("trading 212", "api_key", "TRADING212_API_KEY"))
        zeroda = bool(_cred("zerodha", "api_key", "ZERODHA_API_KEY") and _cred("zerodha", "access_token", "ZERODHA_ACCESS_TOKEN"))
        ibkr = (_cred("ibkr", "enabled") or os.getenv("IBKR_ENABLED", "false")).lower() == "true"
        coinbase = bool(_cred("coinbase", "api_key", "COINBASE_API_KEY") and _cred("coinbase", "api_secret", "COINBASE_API_SECRET"))
        return [
            {"broker": "Trading 212", "key": "trading 212", "configured": t212,
             "method": "Invest API key (paste in app)", "live": True,
             "status": "Connected" if t212 else "Add your Trading 212 API key",
             "fields": ["api_key"], "sync_endpoint": "/brokers/sync/trading212"},
            {"broker": "Zerodha / Coin", "key": "zerodha", "configured": zeroda,
             "method": "Kite Connect (api key + access token)", "live": True,
             "status": "Connected" if zeroda else "Add Kite api key + access token",
             "fields": ["api_key", "access_token"], "sync_endpoint": "/brokers/sync/zerodha"},
            {"broker": "Interactive Brokers", "key": "ibkr", "configured": ibkr,
             "method": "Local Client Portal Gateway", "live": True,
             "status": "Gateway enabled" if ibkr else "Run the IBKR gateway, then enable",
             "fields": ["enabled", "base_url"], "sync_endpoint": "/brokers/sync/ibkr"},
            {"broker": "Coinbase", "key": "coinbase", "configured": coinbase,
             "method": "Advanced Trade API (key + secret)", "live": True,
             "status": "Connected" if coinbase else "Add Coinbase API key + secret",
             "fields": ["api_key", "api_secret"], "sync_endpoint": "/brokers/sync/coinbase"},
            {"broker": "Groww", "key": "groww", "configured": False,
             "method": "CSV import (no public retail API)", "live": False,
             "status": "Import your holdings CSV", "fields": [], "sync_endpoint": ""},
            {"broker": "Scalable Capital", "key": "scalable", "configured": False,
             "method": "CSV import (no public retail API)", "live": False,
             "status": "Import your portfolio CSV", "fields": [], "sync_endpoint": ""},
            {"broker": "MF Central", "key": "mfcentral", "configured": False,
             "method": "CAS / CSV import", "live": False,
             "status": "Import your CAS/CSV", "fields": [], "sync_endpoint": ""},
        ]

    # --------------------------------------------------------------------- #
    # Live pulls                                                            #
    # --------------------------------------------------------------------- #
    async def trading212_positions(self):
        key = _cred("trading 212", "api_key", "TRADING212_API_KEY")
        if not key:
            return {"status": "missing_key", "message": "Add your Trading 212 API key first.", "items": []}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get("https://live.trading212.com/api/v0/equity/portfolio",
                                     headers={"Authorization": key})
                r.raise_for_status()
                return {"status": "ok", "items": r.json()}
        except Exception as e:
            return {"status": "error", "error": str(e), "items": []}

    async def zerodha_holdings(self):
        key = _cred("zerodha", "api_key", "ZERODHA_API_KEY")
        token = _cred("zerodha", "access_token", "ZERODHA_ACCESS_TOKEN")
        if not key or not token:
            return {"status": "missing_key", "message": "Add your Kite api key + access token.", "items": []}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get("https://api.kite.trade/portfolio/holdings",
                                     headers={"X-Kite-Version": "3", "Authorization": f"token {key}:{token}"})
                r.raise_for_status()
                return {"status": "ok", "items": r.json().get("data", [])}
        except Exception as e:
            return {"status": "error", "error": str(e), "items": []}

    async def ibkr_positions(self):
        if (_cred("ibkr", "enabled") or os.getenv("IBKR_ENABLED", "false")).lower() != "true":
            return {"status": "missing_gateway", "message": "Run IBKR Client Portal Gateway and enable it.", "items": []}
        base = (_cred("ibkr", "base_url") or os.getenv("IBKR_BASE_URL", "https://localhost:5000/v1/api")).rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=15, verify=False) as client:
                accounts = await client.get(f"{base}/portfolio/accounts")
                accounts.raise_for_status()
                items = []
                for account in accounts.json():
                    aid = account.get("accountId") or account.get("id")
                    if not aid:
                        continue
                    r = await client.get(f"{base}/portfolio/{aid}/positions/0")
                    r.raise_for_status()
                    items.extend(r.json())
                return {"status": "ok", "items": items}
        except Exception as e:
            return {"status": "error", "error": str(e), "items": []}

    async def coinbase_accounts(self):
        key = _cred("coinbase", "api_key", "COINBASE_API_KEY")
        secret = _cred("coinbase", "api_secret", "COINBASE_API_SECRET")
        if not key or not secret:
            return {"status": "missing_key", "message": "Add Coinbase API key + secret.", "items": []}
        # Coinbase Advanced Trade requires JWT request signing; surface a clear message
        # rather than a silent failure. CSV import is the reliable path meanwhile.
        return {"status": "needs_jwt_signing",
                "message": "Coinbase credentials saved. Advanced Trade needs JWT signing for live pulls — use CSV import for now.",
                "items": []}

    # --------------------------------------------------------------------- #
    # Normalization: raw broker rows -> common holding dicts                #
    # --------------------------------------------------------------------- #
    def normalize_positions(self, broker: str, items):
        b = broker.lower()
        out = []
        if not items:
            return out
        if "trading" in b:
            for p in items:
                t = (p.get("ticker") or "").split("_")[0]
                if not t:
                    continue
                out.append({"symbol": t, "name": t, "type": "Stock",
                            "qty": float(p.get("quantity") or 0),
                            "avg": float(p.get("averagePrice") or 0),
                            "price": float(p.get("currentPrice") or 0),
                            "currency": "", "broker": "Trading 212"})
        elif "zerodha" in b or "kite" in b:
            for p in items:
                t = p.get("tradingsymbol") or ""
                if not t:
                    continue
                out.append({"symbol": t, "name": t, "type": "Stock", "market": "NSE", "country": "India",
                            "qty": float(p.get("quantity") or 0),
                            "avg": float(p.get("average_price") or 0),
                            "price": float(p.get("last_price") or 0),
                            "currency": "INR", "broker": "Zerodha"})
        elif "ibkr" in b or "interactive" in b:
            for p in items:
                t = p.get("contractDesc") or p.get("ticker") or ""
                if not t:
                    continue
                out.append({"symbol": str(t).split(" ")[0], "name": str(t), "type": "Stock",
                            "qty": float(p.get("position") or 0),
                            "avg": float(p.get("avgCost") or 0),
                            "price": float(p.get("mktPrice") or 0),
                            "currency": p.get("currency") or "", "broker": "IBKR"})
        return [r for r in out if r["qty"] > 0]
