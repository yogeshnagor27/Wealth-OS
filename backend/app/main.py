"""
Wealth OS — Backend API (FastAPI)
=================================

Single FastAPI application that powers the entire Wealth OS dashboard.

What lives here
---------------
- ~65 REST endpoints: portfolio/holdings, profiles, cash & cashflow, properties,
  markets/movers, asset detail & history, FX/forex, IPOs, funds/bonds, news,
  alerts, savings plans, brokers, and the AI engines.
- Pydantic request models (HoldingIn, ProfileIn, CashAccountIn, DeskTrackIn, ...).
- Technical indicators merged into enriched assets (RSI/MACD/SMA via compute_technicals).
- AI CFO (`/ai-cfo`) — portfolio-grounded conversational analyst.
- AI Investment Desk — the 6-agent quant engine (desk_factors → desk_score →
  desk_strategist → desk_advisor), the self-grading Tracker/Rater
  (evaluate_ai_calls / _adapt_weights), and a 24/7 background watch loop.
- Market session/calendar logic with real-time open/closed + next-open countdown.

Design notes
------------
- Live data is fetched on demand via the LiveMarketData client (httpx, cached) and
  always has a graceful fallback so the dashboard never goes blank.
- All user data persists through services.data_store to backend/data/state.json
  (no database needed to run).
- Money is normalized to EUR internally via eur(); the frontend converts to the
  chosen display currency.

Run:  uvicorn app.main:app --reload      Docs: http://localhost:8000/docs
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, date, time as dt_time
from zoneinfo import ZoneInfo
import os, random, asyncio, time, httpx, re, html
from urllib.parse import quote_plus, urlparse
import xml.etree.ElementTree as ET

from app.services.data_store import *
from app.integrations.live_market import LiveMarketData
from app.integrations.brokers import BrokerHub

app = FastAPI(title="Wealth OS Live Fixed", version="7.0.0")
default_origins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3010,http://127.0.0.1:3010,http://localhost:3011,http://127.0.0.1:3011,http://localhost:8080,http://127.0.0.1:8080"
origins = os.getenv("CORS_ORIGINS", default_origins).split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins if origins != ["*"] else ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

market = LiveMarketData()
brokers = BrokerHub()
LOCATION_CACHE = {}
LOCATION_TTL = 60 * 60 * 24

load_data()

class ProfileIn(BaseModel):
    name: str
    relation: str = "Family"
    country: str = "Germany"
    photo_url: str = ""
    password: str = ""
    role: str = ""
    company: str = ""
    location: str = ""
    bio: str = ""
    links: dict = {}
    headline: str = ""
    expertise: str = ""
    interests: str = ""
    phone: str = ""
    milestones: str = ""
    motto: str = ""

class ProfileUpdate(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    relation: Optional[str] = None
    country: Optional[str] = None
    photo_url: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    links: Optional[dict] = None
    headline: Optional[str] = None
    expertise: Optional[str] = None
    interests: Optional[str] = None
    phone: Optional[str] = None
    milestones: Optional[str] = None
    motto: Optional[str] = None

class SearchIn(BaseModel):
    query: str
    market: str = ""
class Ask(BaseModel): question: str
class UnlockIn(BaseModel): password: str = ""

class HoldingIn(BaseModel):
    symbol: str
    name: str
    type: str = "Stock"
    currency: str = ""
    sector: str = "Other"
    country: str = ""
    market: str = "GLOBAL"
    profile_id: str = "me"
    qty: float = 0
    avg: float = 0
    price: float = 0
    broker: str = "Manual"
    yahoo: str = ""
    dividend_yield: float = 0

class HoldingUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    market: Optional[str] = None
    qty: Optional[float] = None
    avg: Optional[float] = None
    price: Optional[float] = None
    broker: Optional[str] = None
    yahoo: Optional[str] = None
    dividend_yield: Optional[float] = None

class PropertyIn(BaseModel):
    profile_id: str = "me"
    name: str
    category: str = "Flat"
    location: str = ""
    value: float = 0
    currency: str = "EUR"
    growth: float = 0
    bank: str = ""            # FD: which bank holds the deposit
    interest_rate: float = 0  # FD: annual interest rate %
    maturity_date: str = ""   # FD: maturity date (YYYY-MM-DD)
    value_manual: bool = False  # gold/silver: use entered value instead of live spot
    rent: float = 0
    loan: float = 0
    area: str = ""
    purchase_value: float = 0
    purchase_year: int = 0
    purchase_date: str = ""
    valuation_date: str = ""
    forecast_year: int = 0
    renovation_cost: float = 0
    yearly_tax: float = 0
    yearly_maintenance: float = 0
    bedrooms: int = 0
    quantity: float = 0
    unit: str = ""
    maker: str = ""
    model: str = ""
    registration_year: int = 0
    notes: str = ""
    mileage_km: float = 0
    condition: str = ""
    currency_manual: bool = False
    main_road: str = ""
    metro_distance_km: float = 0
    hospital_distance_km: float = 0
    mall_distance_km: float = 0
    school_distance_km: float = 0
    police_distance_km: float = 0
    grocery_distance_km: float = 0
    transit_distance_km: float = 0
    comparable_rate: float = 0
    rental_demand: str = ""
    rental_status: str = ""
    tenant: str = ""
    lease_end: str = ""
    deposit: float = 0

class PropertyDispositionIn(BaseModel):
    action: str = "sold"
    to: str = ""
    amount: float = 0
    currency: str = ""
    tax_paid: float = 0
    fees: float = 0
    date: str = ""
    notes: str = ""
    create_cash: bool = True

class BrokerDetailIn(BaseModel):
    profile_id: str = "001"
    broker: str
    market: str = ""
    beneficiary: str = ""
    beneficiary_relation: str = ""
    knows_credentials: bool = False
    registered_mobile: str = ""
    registered_email: str = ""
    pan: str = ""
    iban: str = ""
    account_id: str = ""
    tax_id: str = ""
    folio_hint: str = ""
    kyc_status: str = ""
    gender: str = ""
    dob: str = ""
    notes: str = ""

class WatchlistIn(BaseModel):
    symbol: str
    name: str = ""
    type: str = "Stock"
    sector: str = "Other"
    country: str = "Global"
    market: str = "GLOBAL"
    yahoo: str = ""

class CashflowIn(BaseModel):
    profile_id: str = "me"
    category: str
    amount: float
    currency: str = "EUR"
    type: str = "expense"
    date: str = ""

class CashflowUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None

class AlertIn(BaseModel):
    symbol: str
    condition: str = "above"
    target: float
    status: str = "active"

class SavingsPlanIn(BaseModel):
    profile_id: str = "me"
    name: str
    target: float
    current: float = 0
    currency: str = "EUR"
    monthly: float = 0
    priority: str = "Medium"

class CashAccountIn(BaseModel):
    profile_id: str = "me"
    name: str
    balance: float = 0
    currency: str = "EUR"
    type: str = "Cash"
    bank: str = ""

class CashAccountUpdate(BaseModel):
    name: Optional[str] = None
    balance: Optional[float] = None
    currency: Optional[str] = None
    type: Optional[str] = None
    bank: Optional[str] = None
    delta: Optional[float] = None

def ensure_profile(profile_id: str):
    if not any(p["id"] == profile_id for p in profiles):
        raise HTTPException(status_code=404, detail=f"Profile '{profile_id}' not found")

def ensure_profile_name(name: str, exclude_id: str = None):
    if not name or not name.strip():
        raise HTTPException(status_code=422, detail="Profile name is required")
    n = name.strip().lower()
    if any((p.get("name", "").strip().lower() == n) and (p.get("id") != exclude_id) for p in profiles):
        raise HTTPException(status_code=409, detail=f"A profile named '{name.strip()}' already exists")

def rename_profile_references(old_id: str, new_id: str):
    for collection in (assets, properties, cashflow, savings_plans, cash_accounts):
        for row in collection:
            if row.get("profile_id") == old_id:
                row["profile_id"] = new_id

def public_profile(row):
    return {k: v for k, v in row.items() if k != "password"}

def is_admin_profile(row):
    return row.get("relation", "").lower() == "self"

def market_by_code(code: str):
    code = (code or "GLOBAL").upper()
    return next((m for m in stock_markets if m["code"] == code), stock_markets[0])

def normalize_market(row):
    market_code = infer_market(row)
    market = market_by_code(market_code)
    row.setdefault("market", market_code)
    if row.get("country") in {"", "Global"} and market["country"] not in {"Global", "Crypto"}:
        row["country"] = market["country"]
    if row.get("currency") in {"", None}:
        row["currency"] = market["currency"]
    return market

async def enriched_assets(include_watchlist=False):
    if include_watchlist:
        # Catalog view (search / movers / watchlist): de-dupe by symbol+yahoo so an
        # asset isn't listed many times. Owned holdings take priority over catalog rows.
        source = []
        seen = set()
        for item in assets + watchlist + global_universe:
            key = (item.get("symbol", "").upper(), item.get("yahoo", "").upper())
            if key in seen:
                continue
            seen.add(key)
            source.append(item)
    else:
        # Holdings view: keep EVERY holding. Never de-dupe across profiles/brokers,
        # otherwise a newly added holding sharing a ticker with another would vanish.
        source = list(assets)
    fx_data = await market.fx_rates("EUR")
    rates = fx_data.get("rates", {})
    async def enrich(a):
        quote = None
        market_meta = normalize_market(a)
        yahoo = a.get("yahoo") or a.get("symbol")
        if yahoo:
            quote, resolved = await market.best_quote(
                yahoo, a.get("name", ""), a.get("type", "Stock"), market_meta.get("suffix", ""))
            # remember the corrected ticker so it stays live next time
            if quote and resolved and resolved != yahoo:
                a["yahoo"] = resolved
        price = a.get("price", 0)
        day = a.get("day", 0)
        week = a.get("week", day)
        month = a.get("month", day)
        year = a.get("year", day)
        year_low = a.get("year_low", price)
        year_high = a.get("year_high", price)
        currency = a.get("currency", "USD")
        source = "Demo fallback"
        if quote:
            price = quote.get("price", price)
            day = quote.get("day", day)
            week = quote.get("week", week)
            month = quote.get("month", month)
            year = quote.get("year", year)
            year_low = quote.get("year_low", year_low)
            year_high = quote.get("year_high", year_high)
            currency = quote.get("currency", currency)
            source = quote.get("source", source)
        qty = a.get("qty", 0)
        avg = a.get("avg", 0)
        value = qty * price
        cost = qty * avg
        value_eur = eur(value, currency, rates)
        cost_eur = eur(cost, a.get("currency", currency), rates)
        enriched = {**a, "market": a.get("market") or market_meta["code"], "market_name": market_meta["name"], "market_region": market_meta["region"], "price": price, "day": day, "week": week, "month": month, "year": year, "year_low": year_low, "year_high": year_high, "currency": currency, "source": source, "value": round(value,2), "cost": round(cost,2), "value_eur": value_eur, "cost_eur": cost_eur, "pl_eur": round(value_eur-cost_eur,2), "pl_pct": round((value_eur-cost_eur)/cost_eur*100,2) if cost_eur else 0, "daily_eur": round(value_eur*day/100,2)}
        if quote:
            for tk in ("rsi", "macd", "macd_signal", "macd_hist", "macd_pos", "sma50", "sma200", "spark"):
                if quote.get(tk) is not None:
                    enriched[tk] = quote.get(tk)
        enriched["movement_reason"] = movement_reason(enriched)
        enriched["alert_state"] = alert_state(enriched)
        return enriched
    return await asyncio.gather(*[enrich(a) for a in source])

def alert_state(asset):
    out = []
    for a in alerts:
        if a.get("status","active") != "active" or a.get("symbol","").upper() != asset.get("symbol","").upper():
            continue
        price = asset.get("price", 0)
        target = a.get("target", 0)
        condition = a.get("condition", "above")
        triggered = price >= target if condition == "above" else price <= target
        out.append({**a, "triggered": triggered, "current": price})
    return out

def movement_reason(asset):
    day = asset.get("day", 0)
    month = asset.get("month", day)
    year = asset.get("year", month)
    sector = asset.get("sector", "market")
    kind = asset.get("type", "Asset")
    direction = "up" if day >= 0 else "down"
    magnitude = abs(day)
    drivers = []
    if magnitude >= 4:
        drivers.append("a large same-day repricing, often tied to news, earnings, macro rates, or sector rotation")
    elif magnitude >= 1:
        drivers.append("normal but noticeable market momentum")
    else:
        drivers.append("a mild move within normal daily volatility")
    if month > 5:
        drivers.append("positive one-month trend support")
    if month < -5:
        drivers.append("negative one-month trend pressure")
    if kind in ["Crypto"]:
        drivers.append("crypto liquidity, risk appetite, exchange flows, and regulatory headlines")
    elif kind in ["Gold"]:
        drivers.append("real rates, USD strength, inflation expectations, and safe-haven demand")
    elif sector == "Technology":
        drivers.append("AI/cloud/software sentiment, valuation expectations, and Nasdaq risk appetite")
    elif sector == "Finance":
        drivers.append("rate expectations, credit risk, capital markets activity, and yield-curve changes")
    elif sector == "Healthcare":
        drivers.append("pipeline news, regulatory decisions, margins, and defensive flows")
    elif sector == "Energy":
        drivers.append("oil prices, refining margins, geopolitics, and demand forecasts")
    if year > 30:
        drivers.append("strong long-term momentum, which can also raise valuation risk")
    if year < -10:
        drivers.append("weak long-term momentum, where recovery depends on catalysts")
    return f"{asset.get('name', asset.get('symbol'))} is {direction} {abs(day)}% today. Likely drivers: " + "; ".join(drivers) + f". Data source: {asset.get('source')}."

def analyst_review(asset):
    day = asset.get("day", 0)
    month = asset.get("month", 0)
    year = asset.get("year", 0)
    risk = "High" if abs(day) > 4 or asset.get("type") in ["Crypto", "Stock"] else "Medium"
    if month > 5 and year > 10:
        rating = "Constructive momentum"
    elif month < -5:
        rating = "Cautious until trend stabilizes"
    elif day >= 0:
        rating = "Neutral to positive"
    else:
        rating = "Neutral to cautious"
    return {
        "rating": rating,
        "risk_level": risk,
        "bull_case": "Upside can come from earnings growth, market-share gains, favorable macro liquidity, buybacks/dividends, and positive sector rotation.",
        "bear_case": "Downside risks include valuation compression, earnings misses, regulation, competition, currency moves, and broad market risk-off behavior.",
        "what_to_watch": ["Latest quarterly earnings and guidance", "Analyst target-price revisions", "Sector ETF performance", "Interest-rate and FX moves", "High-impact company or regulatory news"],
        "world_class_sources": ["Company investor relations", "SEC/exchange filings", "Yahoo Finance", "Reuters/Bloomberg-style news links when configured", "Morningstar/analyst research if you add paid feeds"],
    }

def asset_fundamentals(asset):
    price = asset.get("price", 0)
    dividend_yield = asset.get("dividend_yield", 0)
    return {
        "instrument_type": asset.get("type"),
        "sector": asset.get("sector"),
        "country": asset.get("country"),
        "broker": asset.get("broker", "Watchlist"),
        "currency": asset.get("currency"),
        "current_price": price,
        "dividend_yield": dividend_yield,
        "position_qty": asset.get("qty", 0),
        "average_cost": asset.get("avg", 0),
        "market_value": asset.get("value", 0),
        "market_value_eur": asset.get("value_eur", 0),
        "unrealized_pl_eur": asset.get("pl_eur", 0),
        "unrealized_pl_pct": asset.get("pl_pct", 0),
    }

async def live_holdings(profile_id=None):
    rows = await enriched_assets(False)
    return [r for r in rows if r.get("qty",0) > 0 and (not profile_id or r.get("profile_id") == profile_id)]

async def resolve_asset(symbol: str):
    rows = await enriched_assets(True)
    a = next((x for x in rows if x["symbol"].upper()==symbol.upper() or x.get("yahoo","").upper()==symbol.upper()), None)
    if a:
        return a
    search_rows = await market.search_symbols(symbol)
    exact = next((x for x in search_rows if x.get("symbol","").upper() == symbol.upper() or x.get("yahoo","").upper() == symbol.upper()), None)
    candidate = exact or (search_rows[0] if search_rows else None)
    if not candidate:
        return None
    yahoo = candidate.get("yahoo") or candidate.get("symbol") or symbol
    quote = await market.quote_from_history(yahoo, candidate.get("type", "Stock"))
    fx_data = await market.fx_rates("EUR")
    rates = fx_data.get("rates", {})
    price = (quote or {}).get("price", 0)
    currency = (quote or {}).get("currency") or candidate.get("currency") or "EUR"
    asset = {
        **candidate,
        "symbol": candidate.get("symbol", symbol).upper(),
        "yahoo": yahoo,
        "price": price,
        "currency": currency,
        "day": (quote or {}).get("day", 0),
        "week": (quote or {}).get("week", 0),
        "month": (quote or {}).get("month", 0),
        "year": (quote or {}).get("year", 0),
        "year_low": (quote or {}).get("year_low", price),
        "year_high": (quote or {}).get("year_high", price),
        "source": (quote or {}).get("source", candidate.get("source", "Yahoo search")),
        "qty": 0,
        "avg": 0,
        "value": 0,
        "cost": 0,
        "value_eur": 0,
        "cost_eur": 0,
        "pl_eur": 0,
        "pl_pct": 0,
        "daily_eur": 0,
    }
    for tk in ("rsi", "macd", "macd_signal", "macd_hist", "macd_pos", "sma50", "sma200", "spark"):
        if quote and quote.get(tk) is not None:
            asset[tk] = quote.get(tk)
    asset["market_name"] = asset.get("market_name") or asset.get("market") or "Live search"
    asset["movement_reason"] = movement_reason(asset)
    asset["alert_state"] = alert_state(asset)
    return asset

_UNIT_GRAMS = {"gram": 1, "grams": 1, "g": 1, "gm": 1, "gms": 1, "kg": 1000, "kilogram": 1000,
               "tola": 11.6638, "oz": 31.1035, "ounce": 31.1035, "ozt": 31.1035, "pavan": 8, "sovereign": 8}

def _to_grams(qty, unit):
    return float(qty or 0) * _UNIT_GRAMS.get((unit or "gram").strip().lower(), 1)

def _purity_factor(maker, is_gold):
    m = (maker or "").lower()
    km = re.search(r"(\d{1,2})\s*k", m)
    if km:
        return max(0.0, min(1.0, int(km.group(1)) / 24))
    fm = re.search(r"\b(\d{3})\b", m)        # fineness e.g. 999, 916, 925
    if fm:
        return max(0.0, min(1.0, int(fm.group(1)) / 1000))
    fm2 = re.search(r"(\d{2}\.\d)", m)        # e.g. 92.5
    if fm2:
        return max(0.0, min(1.0, float(fm2.group(1)) / 100))
    return 1.0 if is_gold else 0.999

def fd_compute(p):
    """Current value of a Fixed Deposit = principal compounded (quarterly) to today,
    capped at maturity. Returns principal, current value, maturity value, interest."""
    principal = float(p.get("purchase_value") or p.get("value") or 0)
    rate = float(p.get("interest_rate") or 0) / 100.0
    today = date.today()
    try:
        sd = date.fromisoformat((p.get("purchase_date") or "")[:10])
    except Exception:
        sd = today
    md = None
    try:
        md = date.fromisoformat((p.get("maturity_date") or "")[:10])
    except Exception:
        md = None
    end = today if (not md or today < md) else md
    years = max((end - sd).days / 365.25, 0)
    n = 4  # quarterly compounding (typical for Indian FDs)
    current = principal * ((1 + rate / n) ** (n * years)) if rate > 0 else principal
    mat_years = max(((md - sd).days / 365.25) if md else years, 0)
    maturity_value = principal * ((1 + rate / n) ** (n * mat_years)) if rate > 0 else principal
    return {"principal": round(principal, 2), "current": round(current, 2),
            "maturity_value": round(maturity_value, 2), "interest_earned": round(current - principal, 2),
            "years": round(years, 2), "matured": bool(md and today >= md)}

async def live_properties(profile_id=None):
    fx_data = await market.fx_rates("EUR")
    rates = fx_data.get("rates", {})
    has_metal = any(p.get("category") in {"Physical Gold", "Physical Silver"} for p in properties
                    if not profile_id or p.get("profile_id") == profile_id)
    spot = await market.metal_spot() if has_metal else {"gold_usd_oz": 0, "silver_usd_oz": 0}
    out = []
    for p in properties:
        if profile_id and p["profile_id"] != profile_id:
            continue
        currency = property_currency(p)
        status = p.get("status", "active")
        is_active = status == "active"
        if p.get("category") == "Diamond":
            value = float(p.get("value") or 0)
            purchase = float(p.get("purchase_value") or 0)
            carat = float(p.get("quantity") or 0)
            net = eur(value if is_active else 0, currency, rates)
            out.append({**p, "currency": currency, "status": status, "value": value, "value_eur": net,
                        "model_growth": 0, "valuation_score": 0, "location_intel": {},
                        "valuation_ai": {"summary": f"Diamond {carat:g}ct — priced by the 4Cs (cut/colour/clarity/carat). Value is your appraisal; no public live diamond feed exists."},
                        "all_in_cost": round(purchase, 2), "gain": round(value - purchase, 2) if purchase else 0,
                        "annualized_return": 0, "future_5y_eur": net, "forecast_value_eur": net,
                        "rental_income_year": 0, "rental_income_eur": 0, "is_rented": False, "rental_status": "",
                        "rental_yield": 0, "net_rental_yield": 0, "yearly_carrying_cost": 0,
                        "suggested_sale_price": 0, "estimated_tax": 0, "sale_guidance": "", "tax": {}, "analysis": "", "analysis_precise": ""})
            continue
        if p.get("category") in {"Physical Gold", "Physical Silver"}:
            is_gold = p.get("category") == "Physical Gold"
            grams = _to_grams(p.get("quantity"), p.get("unit"))
            spot_oz = (spot.get("gold_usd_oz") if is_gold else spot.get("silver_usd_oz")) or 0
            purity = _purity_factor(p.get("maker"), is_gold)
            purchase = float(p.get("purchase_value") or 0)
            entered = float(p.get("value") or 0)
            use_manual = bool(p.get("value_manual")) and entered > 0
            per_gram = 0
            if grams > 0 and spot_oz > 0 and not use_manual:
                usd_per_gram = spot_oz / 31.1035
                usd_to_cur = (1.0 / (rates.get("USD") or 1.08)) * (rates.get(currency, 1) if currency != "EUR" else 1)
                per_gram = round(purity * usd_per_gram * usd_to_cur, 2)
                value = round(grams * per_gram, 2)
                live_ok = True
            else:
                value = entered
                per_gram = round(value / grams, 2) if grams else 0
                live_ok = False
            net = eur(value if is_active else 0, currency, rates)
            gain = value - purchase if purchase else 0
            metal = "Gold" if is_gold else "Silver"
            note = (f"{metal}: {grams:.0f}g × purity {purity:.3f} at live {currency} {per_gram:,.0f}/g (spot ${spot_oz:,.0f}/oz)." if live_ok
                    else (f"{metal}: your own value ({currency} {per_gram:,.0f}/g)." if grams else f"{metal}: your entered value."))
            out.append({**p, "currency": currency, "status": status, "value": value, "value_eur": net,
                        "model_growth": 0, "monthly_value_change": 0, "valuation_score": 0, "location_intel": {},
                        "metal_live": live_ok, "metal_grams": round(grams, 2), "metal_purity": round(purity, 3),
                        "spot_oz": spot_oz, "per_gram": per_gram,
                        "valuation_ai": {"summary": note},
                        "all_in_cost": round(purchase, 2), "gain": round(gain, 2), "annualized_return": 0,
                        "future_5y_eur": net, "forecast_value_eur": net, "rental_income_year": 0, "rental_income_eur": 0,
                        "is_rented": False, "rental_status": "", "rental_yield": 0, "net_rental_yield": 0,
                        "yearly_carrying_cost": 0, "suggested_sale_price": 0, "estimated_tax": 0, "sale_guidance": "",
                        "tax": property_tax_info({**p, "currency": currency}), "analysis": "", "analysis_precise": ""})
            continue
        if p.get("category") == "FD":
            fd = fd_compute(p)
            cur = fd["current"] if is_active else 0
            rate = float(p.get("interest_rate") or 0)
            out.append({**p, "currency": currency, "status": status, "value": fd["current"],
                        "value_eur": eur(cur, currency, rates), "principal": fd["principal"],
                        "maturity_value": fd["maturity_value"], "interest_earned": fd["interest_earned"],
                        "fd_years": fd["years"], "matured": fd["matured"], "bank": p.get("bank", ""),
                        "all_in_cost": fd["principal"], "gain": fd["interest_earned"],
                        "annualized_return": rate, "model_growth": rate,
                        "future_5y_eur": eur(fd["maturity_value"], currency, rates),
                        "forecast_value_eur": eur(fd["maturity_value"], currency, rates),
                        "rental_income_year": 0, "rental_income_eur": 0, "is_rented": False,
                        "rental_status": "", "rental_yield": 0, "net_rental_yield": 0,
                        "yearly_carrying_cost": 0, "valuation_score": 0, "location_intel": {},
                        "valuation_ai": {"summary": f"Fixed deposit at {p.get('bank') or 'bank'} earning {rate}% p.a."},
                        "suggested_sale_price": 0, "estimated_tax": 0, "sale_guidance": "",
                        "tax": {}, "analysis": "", "analysis_precise": ""})
            continue
        row_base = {**p, "currency": currency}
        sale = suggest_property_sale(row_base)
        net = eur((p["value"]-p.get("loan", 0)) if is_active else 0, currency, rates)
        growth = asset_model_growth(row_base)
        forecast_year = p.get("forecast_year") or (datetime.utcnow().year + 5)
        years_to_forecast = max(forecast_year - datetime.utcnow().year, 0)
        future = eur(((p["value"] or 0) * ((1 + growth / 100) ** years_to_forecast) - p.get("loan", 0)) if is_active else 0, currency, rates)
        purchase = p.get("purchase_value", 0) or 0
        all_in_cost = purchase + (p.get("renovation_cost", 0) or 0)
        gain = p["value"] - all_in_cost if all_in_cost else 0
        years_held = property_years_held(p)
        annualized_return = ((p["value"] / all_in_cost) ** (1 / years_held) - 1) * 100 if all_in_cost and years_held > 0 else 0
        rental_yield = ((p.get("rent", 0) or 0) * 12 / p["value"] * 100) if p.get("value") else 0
        carrying_cost = (p.get("yearly_tax", 0) or 0) + (p.get("yearly_maintenance", 0) or 0)
        valuation_score = real_estate_location_score(row_base) if p.get("category") in {"Plot", "Land", "Flat", "House", "Villa", "Bungalow", "Commercial", "Future Property"} else 0
        monthly_change = monthly_value_delta(p.get("value", 0) or 0, growth)
        enriched_base = {**row_base, "model_growth": growth, "monthly_value_change": monthly_change, "valuation_score": valuation_score}
        intel = await location_intelligence(enriched_base)
        valuation_ai = valuation_ai_comment(enriched_base, intel)
        rent = float(p.get("rent", 0) or 0)
        rental_income_year = round(rent * 12, 2)
        rental_income_eur = eur(rental_income_year, currency, rates)
        net_carrying = max((p.get("yearly_tax", 0) or 0) + (p.get("yearly_maintenance", 0) or 0), 0)
        net_rental_yield = round((rent * 12 - net_carrying) / p["value"] * 100, 2) if p.get("value") else 0
        rental_status = p.get("rental_status") or ("Rented out" if rent > 0 and p.get("category") in {"Flat","House","Villa","Bungalow","Commercial"} else "")
        is_rented = rental_status == "Rented out" or (not rental_status and rent > 0)
        tax = property_tax_info(row_base)
        out.append({**p, "currency": currency, "status": status, "model_growth": round(growth, 2), "monthly_value_change": monthly_change, "valuation_score": valuation_score, "location_intel": intel, "valuation_ai": valuation_ai, "value_eur": net, "future_5y_eur": round(future, 2), "forecast_value_eur": round(future, 2), "forecast_year": forecast_year, "years_held": round(years_held, 1), "all_in_cost": round(all_in_cost, 2), "gain": round(gain, 2), "annualized_return": round(annualized_return, 2), "rental_yield": round(rental_yield, 2), "net_rental_yield": net_rental_yield, "rental_income_year": rental_income_year, "rental_income_eur": rental_income_eur, "rental_status": rental_status, "is_rented": is_rented, "yearly_carrying_cost": round(carrying_cost, 2), "suggested_sale_price": sale["suggested_sale_price"], "estimated_tax": sale["estimated_tax"], "sale_guidance": sale["guidance"], "tax": tax, "analysis": property_analysis(enriched_base), "analysis_precise": valuation_ai["summary"]})
    return out

def property_currency(p):
    if p.get("currency_manual") and p.get("currency"):
        return p.get("currency")
    text = f"{p.get('location','')} {p.get('notes','')}".lower()
    india_terms = [
        "india", "bharat", "indore", "mumbai", "delhi", "new delhi", "pune", "bangalore", "bengaluru", "hyderabad", "chennai", "bhopal", "ujjain",
        "madhya pradesh", "maharashtra", "karnataka", "gujarat", "rajasthan", "uttar pradesh", "uttarakhand", "himachal", "himachal pradesh",
        "punjab", "haryana", "bihar", "jharkhand", "odisha", "orissa", "west bengal", "assam", "kerala", "tamil nadu", "telangana",
        "andhra pradesh", "goa", "chhattisgarh", "jammu", "kashmir", "sikkim", "meghalaya", "manipur", "mizoram", "nagaland", "tripura",
        "arunachal", "chandigarh", "lucknow", "kanpur", "jaipur", "ahmedabad", "surat", "vadodara", "nagpur", "nashik", "patna", "ranchi",
        "kolkata", "kochi", "thiruvananthapuram", "coimbatore", "madurai", "visakhapatnam", "vijayawada", "noida", "gurgaon", "gurugram"
    ]
    if any(x in text for x in india_terms):
        return "INR"
    if any(x in text for x in ["usa", "united states", "america", "new york", "california", "texas", "florida", "washington", "chicago", "boston"]):
        return "USD"
    if any(x in text for x in ["uk", "united kingdom", "london", "england", "scotland"]):
        return "GBP"
    if any(x in text for x in ["switzerland", "zurich", "geneva"]):
        return "CHF"
    if any(x in text for x in ["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah"]):
        return "AED"
    if any(x in text for x in ["saudi", "riyadh", "jeddah"]):
        return "SAR"
    if any(x in text for x in ["qatar", "doha"]):
        return "QAR"
    if any(x in text for x in ["singapore"]):
        return "SGD"
    if any(x in text for x in ["japan", "tokyo", "osaka"]):
        return "JPY"
    if any(x in text for x in ["hong kong", "hongkong"]):
        return "HKD"
    if any(x in text for x in ["china", "shanghai", "beijing", "shenzhen"]):
        return "CNY"
    if any(x in text for x in ["australia", "sydney", "melbourne", "brisbane", "perth"]):
        return "AUD"
    if any(x in text for x in ["canada", "toronto", "vancouver"]):
        return "CAD"
    if any(x in text for x in ["germany", "berlin", "munich", "bavaria", "europe", "france", "spain", "italy", "netherlands", "austria"]):
        return "EUR"
    return p.get("currency") or "EUR"

def parse_property_date(value):
    if not value:
        return None
    text = str(value)
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    try:
        return date(int(text), 1, 1)
    except (ValueError, TypeError):
        return None

def property_years_held(p):
    bought = parse_property_date(p.get("purchase_date")) or parse_property_date(p.get("purchase_year"))
    valued = parse_property_date(p.get("valuation_date")) or date.today()
    if not bought:
        return 0
    return max((valued - bought).days / 365.25, 0)

def _distance_score(km, near=1.0, far=8.0):
    if km in (None, "", 0):
        return 0
    try:
        value = float(km)
    except (TypeError, ValueError):
        return 0
    if value <= near:
        return 10
    if value >= far:
        return 0
    return round((far - value) / (far - near) * 10, 1)

def real_estate_location_score(p):
    score = 50
    road = str(p.get("main_road", "")).lower()
    if any(x in road for x in ["yes", "main", "front", "highway", "corner"]):
        score += 10
    elif any(x in road for x in ["inside", "narrow", "no"]):
        score -= 5
    score += _distance_score(p.get("metro_distance_km"), .75, 7) * 1.2
    score += _distance_score(p.get("hospital_distance_km"), 1, 8) * .8
    score += _distance_score(p.get("mall_distance_km"), 1, 10) * .6
    score += _distance_score(p.get("school_distance_km"), 1, 8) * .7
    score += _distance_score(p.get("police_distance_km"), 1, 10) * .4
    score += _distance_score(p.get("grocery_distance_km"), .5, 5) * .8
    score += _distance_score(p.get("transit_distance_km"), .75, 6) * .8
    demand = str(p.get("rental_demand", "")).lower()
    if "high" in demand:
        score += 8
    elif "medium" in demand:
        score += 4
    elif "low" in demand:
        score -= 4
    return round(min(max(score, 0), 100), 1)

def asset_model_growth(p):
    category = p.get("category", "Property")
    entered = p.get("growth", 0) or 0
    if entered:
        return entered
    if category == "Car":
        age = max(date.today().year - int(p.get("registration_year") or date.today().year), 0)
        mileage = float(p.get("mileage_km") or 0)
        condition = str(p.get("condition", "")).lower()
        depreciation = 10 + min(age * 1.2, 8) + min(mileage / 50000 * 2.5, 8)
        if "excellent" in condition:
            depreciation -= 3
        elif "poor" in condition or "accident" in condition:
            depreciation += 5
        elif "good" in condition:
            depreciation -= 1
        return -round(min(max(depreciation, 6), 28), 1)
    if category == "Physical Gold":
        return 5.0
    if category == "Physical Silver":
        return 4.0
    if category in {"Plot", "Land", "Flat", "House", "Villa", "Bungalow", "Commercial", "Future Property"}:
        score = real_estate_location_score(p)
        base = 3.0 if category in {"Flat", "House", "Villa", "Bungalow", "Commercial", "Future Property"} else 4.0
        return round(base + (score - 50) / 20, 1)
    return entered

def monthly_value_delta(value, growth):
    if not value:
        return 0
    return round(value * (((1 + growth / 100) ** (1 / 12)) - 1), 2)

def cached_location(key):
    row = LOCATION_CACHE.get(key)
    if row and time.time() - row["ts"] < LOCATION_TTL:
        return row["data"]
    return None

def set_location_cache(key, data):
    LOCATION_CACHE[key] = {"ts": time.time(), "data": data}
    return data

def parse_area_size(area=""):
    text = str(area or "").lower().replace(",", "")
    match = __import__("re").search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return 0
    value = float(match.group(1))
    if "acre" in text:
        return value * 43560
    if "sqm" in text or "sq m" in text or "m2" in text:
        return value * 10.7639
    return value

async def geocode_location(location):
    query = str(location or "").strip()
    if not query:
        return {}
    key = f"geo:{query.lower()}"
    cached = cached_location(key)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=5, headers={"User-Agent": "WealthOS/1.0 local valuation"}) as client:
            r = await client.get("https://nominatim.openstreetmap.org/search", params={"q": query, "format": "json", "limit": 1, "addressdetails": 1})
            r.raise_for_status()
            data = r.json()
        if not data:
            return set_location_cache(key, {})
        row = data[0]
        return set_location_cache(key, {"lat": float(row.get("lat", 0)), "lon": float(row.get("lon", 0)), "display_name": row.get("display_name", ""), "source": "OpenStreetMap Nominatim"})
    except Exception:
        return set_location_cache(key, {})

async def amenity_intel(lat, lon):
    if not lat or not lon:
        return {}
    key = f"amenity:{round(lat,4)}:{round(lon,4)}"
    cached = cached_location(key)
    if cached is not None:
        return cached
    query = f"""
    [out:json][timeout:8];
    (
      node(around:2000,{lat},{lon})[amenity~"hospital|clinic|school|college|police"];
      node(around:2000,{lat},{lon})[shop~"supermarket|mall|convenience|grocery"];
      node(around:2000,{lat},{lon})[railway~"station|subway_entrance"];
      node(around:2000,{lat},{lon})[highway~"bus_stop"];
    );
    out center 80;
    """
    mirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]
    elements = None
    for url in mirrors:
        try:
            async with httpx.AsyncClient(timeout=9, headers={"User-Agent": "WealthOS/1.0 local valuation"}) as client:
                r = await client.post(url, data=query)
                r.raise_for_status()
                elements = r.json().get("elements", [])
            if elements is not None:
                break
        except Exception:
            continue
    if elements is None:
        return set_location_cache(key, {})
    try:
        counts = {"hospital": 0, "school": 0, "police": 0, "shops": 0, "transit": 0}
        for e in elements:
            tags = e.get("tags", {})
            amenity = tags.get("amenity", "")
            shop = tags.get("shop", "")
            railway = tags.get("railway", "")
            highway = tags.get("highway", "")
            if amenity in {"hospital", "clinic"}:
                counts["hospital"] += 1
            if amenity in {"school", "college"}:
                counts["school"] += 1
            if amenity == "police":
                counts["police"] += 1
            if shop in {"supermarket", "mall", "convenience", "grocery"}:
                counts["shops"] += 1
            if railway or highway == "bus_stop":
                counts["transit"] += 1
        counts["source"] = "OpenStreetMap Overpass, 2km radius"
        return set_location_cache(key, counts)
    except Exception:
        return set_location_cache(key, {})

async def external_price_intel(p, geo):
    url = os.getenv("REAL_ESTATE_PRICE_API_URL", "").strip()
    if not url:
        return {"configured": False, "source": "External nearby price API not configured"}
    headers = {}
    key = os.getenv("REAL_ESTATE_PRICE_API_KEY", "").strip()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        params = {"address": p.get("location", ""), "lat": geo.get("lat"), "lon": geo.get("lon"), "category": p.get("category", ""), "currency": p.get("currency", "")}
        async with httpx.AsyncClient(timeout=8, headers=headers) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        return {"configured": True, "source": url, "data": data}
    except Exception as e:
        return {"configured": True, "source": url, "error": str(e)[:160]}

async def location_intelligence(p):
    category = p.get("category", "")
    if category not in {"Plot", "Land", "Flat", "House", "Villa", "Bungalow", "Commercial", "Future Property"}:
        return {}
    geo = await geocode_location(p.get("location", ""))
    amenities = await amenity_intel(geo.get("lat"), geo.get("lon")) if geo else {}
    external = await external_price_intel(p, geo)
    return {"geo": geo, "amenities": amenities, "price_api": external}

def valuation_ai_comment(p, intel):
    category = p.get("category", "Property")
    currency = p.get("currency", "EUR")
    value = float(p.get("value", 0) or 0)
    score = float(p.get("valuation_score", 0) or 0)
    growth = float(p.get("model_growth", 0) or 0)
    monthly = float(p.get("monthly_value_change", 0) or 0)
    if category == "Car":
        confidence = "medium" if p.get("mileage_km") and p.get("condition") and p.get("registration_year") else "low"
        summary = f"Car valuation: {growth:.1f}% yearly depreciation, about {currency} {abs(monthly):,.0f}/month loss. Confidence {confidence}; improve with service history, accident status and local used-car listing prices."
        return {"summary": summary, "confidence": confidence, "drivers": ["age", "mileage", "condition", "maintenance/insurance"], "risks": ["accident history", "major service due", "weak resale demand"], "price_sources": ["manual current value"]}
    if category in {"Physical Gold", "Physical Silver"}:
        confidence = "medium" if p.get("quantity") and p.get("maker") else "low"
        summary = f"{category} valuation: model growth {growth:.1f}% yearly, about {currency} {monthly:,.0f}/month. Confidence {confidence}; exactness needs live bullion spot price, purity and making-charge resale haircut."
        return {"summary": summary, "confidence": confidence, "drivers": ["weight", "purity", "metal trend"], "risks": ["purity discount", "making charges not recovered", "storage/insurance"], "price_sources": ["manual value", "model metal trend"]}
    area = parse_area_size(p.get("area", ""))
    comp_rate = float(p.get("comparable_rate", 0) or 0)
    comp_value = round(area * comp_rate, 2) if area and comp_rate else 0
    amenities = (intel or {}).get("amenities", {})
    geo = (intel or {}).get("geo", {})
    api = (intel or {}).get("price_api", {})
    amenity_text = f"{amenities.get('hospital',0)} hospital/clinic, {amenities.get('school',0)} school/college, {amenities.get('shops',0)} shop/mall, {amenities.get('transit',0)} transit points nearby" if amenities else "nearby amenity API unavailable"
    sources = ["manual current value", "entered comparable rate" if comp_value else "no comparable rate entered", geo.get("source", "geocode unavailable"), amenities.get("source", "amenity lookup unavailable"), api.get("source", "external price API not configured")]
    confidence = "high" if comp_value and amenities and geo else "medium" if comp_value or amenities else "low"
    price_note = f"Comparable estimate {currency} {comp_value:,.0f}; current value differs by {((value-comp_value)/comp_value*100):+.1f}%." if comp_value else "Enter nearby per-sqft/per-acre comparable rate for tighter pricing."
    summary = f"Property valuation: score {score:.0f}/100, model growth {growth:.1f}% yearly, about {currency} {monthly:,.0f}/month. {amenity_text}. {price_note} Confidence {confidence}."
    return {"summary": summary, "confidence": confidence, "drivers": ["location score", "road/transit access", "nearby services", "rental demand", "comparable rate"], "risks": ["missing transaction API", "unclear exact boundaries", "legal/title and condition not verified"], "price_sources": sources}

TAX_REFERENCE = {
    "India": {
        "property_cgt": "Long-term gains (held > 2 years) ~20% with indexation, or ~12.5% without (post-2024 option). Short-term gains are taxed at your income-slab rate.",
        "rental_income": "Rental income is taxed at your income-slab rate after a 30% standard deduction and home-loan interest deduction.",
        "gold": "Physical gold: long-term (held > 2 years) ~20% with indexation; otherwise slab rate. Making charges are not recoverable.",
        "car": "A personal-use car sale is generally not taxable (treated as a personal asset, capital loss is ignored).",
        "annual": "Annual municipal property tax / house tax varies by city (often a few thousand ₹).",
        "cgt_rate": 0.20, "rental_rate": 0.20, "gold_rate": 0.20,
    },
    "Germany": {
        "property_cgt": "Private real estate is tax-free if held > 10 years; otherwise the gain is added to income (up to ~45%). A ~25% proxy is used here.",
        "rental_income": "Rental income is taxed at your personal income-tax rate (after depreciation & cost deductions).",
        "gold": "Physical gold is tax-free in Germany if held > 1 year.",
        "car": "Private car sale is tax-free if held > 1 year.",
        "annual": "Annual Grundsteuer (property tax) applies, set by the municipality.",
        "cgt_rate": 0.25, "rental_rate": 0.42, "gold_rate": 0.0,
    },
    "US": {
        "property_cgt": "Long-term gains 0/15/20% federal + state tax. Primary-home exclusion up to $250k (single) / $500k (married).",
        "rental_income": "Rental income is taxed as ordinary income (federal up to 37%) after depreciation & expenses.",
        "gold": "Gold is a 'collectible' — long-term gains taxed up to 28% federal.",
        "car": "Personal car: a loss is not deductible; a gain (rare) is a capital gain.",
        "annual": "Annual property tax ~1–2% of value, varies by state/county.",
        "cgt_rate": 0.15, "rental_rate": 0.30, "gold_rate": 0.28,
    },
    "UK": {
        "property_cgt": "Residential CGT 18% (basic) / 24% (higher) above the annual allowance. Main-residence relief applies to your home.",
        "rental_income": "Rental income is taxed at your income-tax rate; mortgage interest gets a 20% tax credit.",
        "gold": "CGT applies to most bullion; UK gold sovereigns/Britannias are CGT-exempt (legal tender).",
        "car": "Private cars are CGT-exempt.",
        "annual": "Council tax applies to occupied homes.",
        "cgt_rate": 0.24, "rental_rate": 0.20, "gold_rate": 0.24,
    },
    "UAE": {
        "property_cgt": "No personal capital-gains tax. A property transfer fee (e.g. ~4% in Dubai) typically applies on sale/purchase.",
        "rental_income": "No personal income tax on rent; a municipality housing fee may apply to tenants.",
        "gold": "No personal capital-gains tax on gold.",
        "car": "No personal capital-gains tax on a car sale.",
        "annual": "No annual property tax; service/community charges apply.",
        "cgt_rate": 0.0, "rental_rate": 0.0, "gold_rate": 0.0,
    },
    "Switzerland": {
        "property_cgt": "A cantonal real-estate gains tax applies; the rate falls the longer you hold the property.",
        "rental_income": "Rental income is taxable; owner-occupied homes are taxed on imputed rental value.",
        "gold": "No special federal capital-gains tax for private investors; wealth tax may apply.",
        "car": "Private car sale is generally not taxed for individuals.",
        "annual": "Cantonal/communal property and wealth taxes apply.",
        "cgt_rate": 0.20, "rental_rate": 0.30, "gold_rate": 0.0,
    },
    "Australia": {
        "property_cgt": "CGT applies; a 50% discount for assets held > 12 months. Main residence is generally exempt.",
        "rental_income": "Rental income is taxed at your marginal rate (expenses/depreciation deductible).",
        "gold": "CGT applies (50% discount if held > 12 months).",
        "car": "Personal-use cars are generally CGT-exempt.",
        "annual": "Annual council rates and land tax (above thresholds) apply.",
        "cgt_rate": 0.225, "rental_rate": 0.30, "gold_rate": 0.225,
    },
    "Canada": {
        "property_cgt": "50% of the capital gain is taxable at your marginal rate. Principal residence is exempt.",
        "rental_income": "Rental income is taxed at your marginal rate after expenses.",
        "gold": "50% of the gain is taxable (capital gain).",
        "car": "Personal-use car: losses ignored; gains rare.",
        "annual": "Annual municipal property tax applies.",
        "cgt_rate": 0.25, "rental_rate": 0.30, "gold_rate": 0.25,
    },
    "Global": {
        "property_cgt": "A conservative ~20% capital-gains proxy is used. Check your local rules.",
        "rental_income": "Rental income is usually taxed as income — assume ~25% as a rough proxy.",
        "gold": "Assume a ~20% gains proxy on bullion.",
        "car": "Personal car sales are often not taxed.",
        "annual": "Local annual property tax may apply.",
        "cgt_rate": 0.20, "rental_rate": 0.25, "gold_rate": 0.20,
    },
}

CURRENCY_TO_REGION = {"INR": "India", "EUR": "Germany", "USD": "US", "GBP": "UK", "AED": "UAE",
                     "CHF": "Switzerland", "AUD": "Australia", "CAD": "Canada"}

def tax_region(p):
    text = f"{p.get('location','')}".lower()
    if "switzerland" in text or "zurich" in text or "geneva" in text:
        return "Switzerland"
    return CURRENCY_TO_REGION.get(property_currency(p), "Global")

def property_tax_info(p):
    region = tax_region(p)
    ref = TAX_REFERENCE.get(region, TAX_REFERENCE["Global"])
    currency = property_currency(p)
    category = p.get("category", "Property")
    rent = float(p.get("rent", 0) or 0)
    rental_year = round(rent * 12, 2)
    purchase = (p.get("purchase_value", 0) or 0) + (p.get("renovation_cost", 0) or 0)
    gain = max(float(p.get("value", 0) or 0) - purchase, 0) if purchase else 0
    if category in {"Physical Gold", "Physical Silver"}:
        asset_key, asset_rate = "gold", ref["gold_rate"]
    elif category == "Car":
        asset_key, asset_rate = "car", 0.0
    else:
        asset_key, asset_rate = "property_cgt", ref["cgt_rate"]
    return {
        "region": region,
        "currency": currency,
        "sale_capital_gains_note": ref[asset_key] if asset_key in ref else ref["property_cgt"],
        "estimated_sale_tax": round(gain * asset_rate, 2),
        "rental_income_year": rental_year,
        "rental_income_tax_note": ref["rental_income"],
        "estimated_rental_tax_year": round(rental_year * ref["rental_rate"], 2) if rental_year else 0,
        "annual_property_tax": round(float(p.get("yearly_tax", 0) or 0), 2),
        "annual_note": ref["annual"],
        "asset_note": ref.get(asset_key) if asset_key in {"gold", "car"} else ref["property_cgt"],
        "disclaimer": "Indicative estimates only — tax rules change and depend on your residency, income and exemptions. Verify with a qualified tax advisor.",
    }

@app.get("/tax-info")
def api_tax_info(country: str = "Global", category: str = "Flat"):
    region = country if country in TAX_REFERENCE else CURRENCY_TO_REGION.get(country.upper(), "Global")
    ref = TAX_REFERENCE.get(region, TAX_REFERENCE["Global"])
    return {"region": region, "category": category, **ref,
            "disclaimer": "Indicative estimates only — verify with a qualified tax advisor."}

def suggest_property_sale(p, amount=None):
    value = float(amount if amount not in (None, 0) else p.get("value", 0) or 0)
    category = p.get("category", "Property")
    currency = p.get("currency", "EUR")
    growth = p.get("growth", 0) or 0
    years_held = property_years_held(p)
    purchase = p.get("purchase_value", 0) or 0
    all_in_cost = purchase + (p.get("renovation_cost", 0) or 0)
    if category == "Car":
        multiplier = 0.98
    elif category in {"Plot", "Land"}:
        multiplier = 1.05
    elif category in {"Physical Gold", "Physical Silver"}:
        multiplier = 1.01
    else:
        multiplier = 1.02 if growth < 6 else 1.04
    suggested = max(value * multiplier, value)
    gain = max((amount or suggested) - all_in_cost, 0) if all_in_cost else 0
    lower_location = (p.get("location", "") + " " + currency).lower()
    if category == "Car":
        tax_rate = 0
        rule = "Cars are usually treated as personal-use assets in this simple model."
    elif "india" in lower_location or currency == "INR":
        tax_rate = 0.20
        rule = "India estimate: assumes a simple long-term capital-gain style 20% rate on gain."
    elif currency == "EUR":
        tax_rate = 0 if category not in {"Physical Gold", "Physical Silver"} and years_held >= 10 else 0.25
        rule = "Germany/EU estimate: assumes private real-estate exemption after 10 years, otherwise a 25% gain proxy."
    else:
        tax_rate = 0.20
        rule = "Global estimate: uses a conservative 20% gain proxy."
    estimated_tax = gain * tax_rate
    guidance = f"Suggested ask {currency} {suggested:,.0f}. Estimated tax {currency} {estimated_tax:,.0f}; {rule} Verify with a tax advisor before executing."
    return {"suggested_sale_price": round(suggested, 2), "estimated_tax": round(estimated_tax, 2), "guidance": guidance}

def property_analysis(p):
    category = p.get("category", "Property")
    location = p.get("location", "")
    if p.get("status") in {"sold", "gifted"}:
        action = p.get("status")
        recipient = p.get("disposition_to") or "not recorded"
        amount = p.get("disposition_amount", 0) or 0
        currency = p.get("disposition_currency") or p.get("currency", "EUR")
        return f"Marked as {action} on {p.get('disposition_date') or 'unknown date'} to {recipient}. Recorded amount {currency} {amount:,.0f}; net sale proceeds {currency} {(p.get('net_proceeds', 0) or 0):,.0f}."
    growth = p.get("model_growth", None)
    if growth is None:
        growth = asset_model_growth(p)
    monthly_change = p.get("monthly_value_change", monthly_value_delta(p.get("value", 0) or 0, growth))
    rent = p.get("rent", 0) or 0
    value = p.get("value", 0) or 0
    rental_yield = (rent * 12 / value * 100) if value else 0
    bought = p.get("purchase_date") or p.get("purchase_year") or "unknown date"
    years_held = property_years_held(p)
    forecast_year = p.get("forecast_year") or (datetime.utcnow().year + 5)
    if category in {"Physical Gold", "Physical Silver"}:
        qty = p.get("quantity") or 0
        unit = p.get("unit") or "grams"
        purity = p.get("maker") or "purity not recorded"
        form = p.get("model") or "form not recorded"
        return f"{category} holding of {qty:g} {unit}, {purity}, {form}. Bought on/in {bought}; held for {years_held:.1f} years. Model uses {growth:.1f}% yearly metal appreciation, about {p.get('currency','EUR')} {monthly_change:,.0f} per month. Update live bullion price, purity certificate and storage/insurance cost for a sharper value."
    if category == "Car":
        label = " ".join(x for x in [p.get("maker", ""), p.get("model", "")] if x).strip() or "vehicle"
        mileage = p.get("mileage_km") or 0
        condition = p.get("condition") or "condition not recorded"
        return f"Car asset: {label}, registration year {p.get('registration_year') or 'unknown'}, {mileage:,.0f} km, {condition}. Model treats it as a depreciating asset at {growth:.1f}% yearly, around {p.get('currency','EUR')} {abs(monthly_change):,.0f} value loss per month. Better resale estimate comes from service history, accident status, tyre/battery condition and local used-car listings."
    if category in {"Plot", "Land"}:
        score = p.get("valuation_score", real_estate_location_score(p))
        rate = p.get("comparable_rate") or 0
        return f"{category} in {location or 'unknown area'} bought on/in {bought}. Location score {score:.0f}/100 based on road access, nearby transit/metro, hospital, school, police, shops and demand inputs. Model uses {growth:.1f}% growth to {forecast_year}, about {p.get('currency','EUR')} {monthly_change:,.0f}/month. Comparable rate entered: {p.get('currency','EUR')} {rate:,.0f}."
    score = p.get("valuation_score", real_estate_location_score(p))
    return f"{category} in {location or 'unknown area'} bought on/in {bought}. Location score {score:.0f}/100 from nearby services and access questions. Rental yield is {rental_yield:.1f}%; model uses {growth:.1f}% annual growth to {forecast_year}, around {p.get('currency','EUR')} {monthly_change:,.0f}/month. Exact address plus local comparable rates make the AI valuation stronger."

@app.get("/")
def root():
    return {"status":"ok","message":"Wealth OS Live Fixed running"}

@app.get("/export")
def export_data():
    """Privacy-safe JSON backup of all wealth data — excludes broker credentials,
    market-data API keys, and profile passwords so the download is safe to store."""
    import copy
    from app.services import data_store as _ds
    data = copy.deepcopy(_ds._state())
    data.pop("broker_credentials", None)
    data.pop("market_data_keys", None)
    for p in data.get("profiles", []):
        p.pop("password", None)
    data["_app"] = "Wealth OS"
    data["_exported_at"] = datetime.utcnow().isoformat() + "Z"
    return data

@app.get("/live/price")
async def live_price(symbol: str, type: str = "Stock"):
    """Near-real-time price for the Asset Detail live ticker (short-cached ~12s)."""
    q = await market.live_price(symbol, type)
    return q or {"symbol": symbol, "price": None}

@app.get("/live/status")
async def live_status():
    fx = await market.fx_rates("EUR")
    sample = await market.quote_from_history("NVDA")
    return {"fx_provider": fx.get("source"), "stock_provider": sample.get("source") if sample else "Fallback", "broker_status": brokers.statuses(), "note":"Historical day/week/month/year is computed from chart history where available."}

def _has_key(name, env):
    return bool((market_data_keys.get(name) or os.getenv(env, "")).strip())

_PROVIDERS_CACHE = {"data": None, "ts": 0.0}

@app.get("/live/providers")
async def live_providers():
    """Live status of every exchange + market-data provider, so the UI can prove
    that each market your brokers cover is fetching real, live data right now."""
    import asyncio, time as _time
    if _PROVIDERS_CACHE["data"] and (_time.time() - _PROVIDERS_CACHE["ts"]) < 180:
        return _PROVIDERS_CACHE["data"]
    fx, us, eu, ind, cry, mf = await asyncio.gather(
        market.fx_rates("EUR"),
        market.quote_from_history("AAPL"),
        market.quote_from_history("SAP.DE"),
        market.quote_from_history("RELIANCE.NS"),
        market.crypto_quote("BTC"),
        market.mf_quote("Parag Parikh Flexi Cap"),
        return_exceptions=True,
    )
    metals = await market.metal_spot()
    def _ok(x):
        return x if isinstance(x, dict) else {}
    us, eu, ind, cry, mf = _ok(us), _ok(eu), _ok(ind), _ok(cry), _ok(mf)
    fx = fx if isinstance(fx, dict) else {}

    def ex(label, brokers_txt, q, ccy):
        return {"market": label, "brokers": brokers_txt, "live": bool(q.get("price")),
                "price": q.get("price"), "currency": ccy, "source": q.get("source", "—")}
    exchanges = [
        ex("US — NYSE / Nasdaq", "Trading 212 · IBKR", us, "USD"),
        ex("Europe — XETRA / LSE / Euronext", "Scalable Capital · Trading 212 · IBKR", eu, eu.get("currency", "EUR")),
        ex("India — NSE / BSE", "Groww · Zerodha", ind, "INR"),
        ex("Crypto — global", "Coinbase", cry, "USD"),
        ex("India mutual funds (AMFI)", "Groww · MF Central", mf, "INR"),
        {"market": "Currencies (FX)", "brokers": "All — currency conversion", "live": fx.get("source") not in (None, "Fallback FX"),
         "price": None, "currency": "", "source": fx.get("source", "—")},
        {"market": "Metals — gold / silver", "brokers": "Properties", "live": bool(metals.get("gold_usd_oz")),
         "price": metals.get("gold_usd_oz"), "currency": "USD/oz", "source": metals.get("source", "Yahoo")},
    ]
    providers = [
        {"name": "Yahoo Finance", "covers": "US / EU / India stocks, ETFs & metals", "keyless": True,
         "active": bool(us.get("price")), "detail": us.get("source") if us.get("price") else "unreachable"},
        {"name": "CoinGecko", "covers": "Crypto (live history)", "keyless": True,
         "active": bool(cry.get("price")), "detail": cry.get("source") if cry.get("price") else "unreachable"},
        {"name": "Coinbase", "covers": "Crypto spot (backup)", "keyless": True,
         "active": True, "detail": "keyless backup"},
        {"name": "Binance", "covers": "Crypto 24h (backup)", "keyless": True,
         "active": True, "detail": "keyless backup"},
        {"name": "MFAPI (AMFI)", "covers": "Indian mutual-fund NAV", "keyless": True,
         "active": bool(mf.get("price")), "detail": "AMFI NAV" if mf.get("price") else "unreachable"},
        {"name": "Frankfurter / ECB", "covers": "Currency conversion (FX)", "keyless": True,
         "active": fx.get("source") not in (None, "Fallback FX"), "detail": fx.get("source", "—")},
        {"name": "Twelve Data", "covers": "Stocks & ETFs (optional backup)", "keyless": False,
         "active": _has_key("twelvedata", "TWELVE_DATA_API_KEY"), "detail": "key set" if _has_key("twelvedata", "TWELVE_DATA_API_KEY") else "add free API key"},
        {"name": "Finnhub", "covers": "US stocks (optional backup)", "keyless": False,
         "active": _has_key("finnhub", "FINNHUB_API_KEY"), "detail": "key set" if _has_key("finnhub", "FINNHUB_API_KEY") else "add free API key"},
        {"name": "Alpha Vantage", "covers": "Stocks (optional backup)", "keyless": False,
         "active": _has_key("alphavantage", "ALPHAVANTAGE_API_KEY"), "detail": "key set" if _has_key("alphavantage", "ALPHAVANTAGE_API_KEY") else "add free API key"},
    ]
    live_count = sum(1 for e in exchanges if e["live"])
    result = {"exchanges": exchanges, "providers": providers,
              "live_count": live_count, "total": len(exchanges)}
    _PROVIDERS_CACHE.update(data=result, ts=_time.time())
    return result

class MarketKeyIn(BaseModel):
    provider: str
    key: str = ""

@app.get("/market-data/keys")
def market_data_key_status():
    return {k: True for k, v in market_data_keys.items() if v}

@app.post("/market-data/keys")
def set_market_data_key(body: MarketKeyIn):
    p = body.provider.strip().lower()
    k = body.key.strip()
    if not p:
        raise HTTPException(status_code=422, detail="Provider is required.")
    if k:
        market_data_keys[p] = k
    else:
        market_data_keys.pop(p, None)
    save_data()
    return {"status": "saved", "provider": p, "configured": bool(k)}

@app.delete("/market-data/keys/{provider}")
def delete_market_data_key(provider: str):
    market_data_keys.pop(provider.strip().lower(), None)
    save_data()
    return {"status": "deleted"}

# --------------------------------------------------------------------------- #
# Mutual-fund SIP & lumpsum tracker (simulated from real AMFI NAV history)     #
# --------------------------------------------------------------------------- #
class SipIn(BaseModel):
    profile_id: str = ""
    scheme: str
    symbol: str = ""
    kind: str = "SIP"            # "SIP" (recurring) or "Lumpsum" (one-time)
    amount: float = 0            # SIP: per-installment; Lumpsum: total invested
    frequency: str = "Monthly"   # Monthly / Weekly / Quarterly / Yearly
    start_date: str = ""         # YYYY-MM-DD (first installment / purchase date)
    status: str = "active"
    notes: str = ""

def _add_months(d, n):
    import calendar
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))

def _xirr(flows):
    """Money-weighted annualized return from dated cashflows [(date, amount)]."""
    flows = sorted(flows, key=lambda f: f[0])
    if len(flows) < 2:
        return None
    t0 = flows[0][0]
    def npv(r):
        return sum(a / ((1 + r) ** ((d - t0).days / 365.0)) for d, a in flows)
    lo, hi = -0.95, 5.0
    flo, fhi = npv(lo), npv(hi)
    if flo * fhi > 0:
        return None
    for _ in range(120):
        mid = (lo + hi) / 2
        fm = npv(mid)
        if abs(fm) < 1e-7:
            return round(mid * 100, 2)
        if flo * fm < 0:
            hi = mid
        else:
            lo, flo = mid, fm
    return round((lo + hi) / 2 * 100, 2)

async def compute_sip(sp):
    today = date.today()
    out = {**sp, "invested": 0, "units": 0, "current_value": 0, "gain": 0, "gain_pct": 0,
           "latest_nav": 0, "installments": 0, "next_date": "", "xirr": None, "scheme_name": sp.get("scheme"),
           "nav_source": "MFAPI (AMFI NAV)", "resolved": False, "projection": {}}
    series = await market.mf_series(sp.get("scheme", ""), sp.get("symbol", ""))
    if not series or not series.get("navs"):
        out["nav_source"] = "Scheme not found on AMFI — check the name"
        return out
    navs = series["navs"]
    out["scheme_name"] = series.get("scheme_name") or sp.get("scheme")
    out["resolved"] = True
    dates = [n["date"] for n in navs]
    vals = [n["nav"] for n in navs]
    import bisect
    def nav_on(diso):
        i = bisect.bisect_right(dates, diso) - 1
        return vals[i] if i >= 0 else vals[0]
    try:
        start = date.fromisoformat((sp.get("start_date") or "")[:10])
    except Exception:
        start = _add_months(today, -12)
    amount = float(sp.get("amount") or 0)
    freq = (sp.get("frequency") or "Monthly").lower()
    step = {"weekly": ("d", 7), "monthly": ("m", 1), "quarterly": ("m", 3), "yearly": ("m", 12)}.get(freq, ("m", 1))
    flows = []
    units = invested = installments = 0.0
    if sp.get("kind", "SIP").lower() == "lumpsum":
        diso = start.isoformat()
        nv = nav_on(diso)
        if nv > 0 and amount > 0:
            units = amount / nv
            invested = amount
            installments = 1
            flows.append((start, -amount))
    else:
        d = start
        guard = 0
        while d <= today and guard < 2000:
            nv = nav_on(d.isoformat())
            if nv > 0 and amount > 0:
                units += amount / nv
                invested += amount
                installments += 1
                flows.append((d, -amount))
            d = (d + timedelta(days=step[1])) if step[0] == "d" else _add_months(d, step[1])
            guard += 1
        # next upcoming installment
        nd = start
        while nd <= today:
            nd = (nd + timedelta(days=step[1])) if step[0] == "d" else _add_months(nd, step[1])
        out["next_date"] = nd.isoformat() if sp.get("status", "active") == "active" else ""
    latest = vals[-1]
    current_value = units * latest
    out.update({"invested": round(invested, 2), "units": round(units, 4), "latest_nav": round(latest, 4),
                "current_value": round(current_value, 2), "gain": round(current_value - invested, 2),
                "gain_pct": round((current_value - invested) / invested * 100, 2) if invested else 0,
                "installments": int(installments)})
    if flows:
        out["xirr"] = _xirr(flows + [(today, current_value)])
    # projection: continue plan for 5y & 10y at 12% expected annual return
    r = 0.12
    proj = {}
    for yrs in (5, 10):
        fv = current_value * ((1 + r) ** yrs)
        if sp.get("kind", "SIP").lower() != "lumpsum" and amount > 0 and sp.get("status", "active") == "active":
            per_year = {"weekly": 52, "monthly": 12, "quarterly": 4, "yearly": 1}.get(freq, 12)
            rp = r / per_year
            n = per_year * yrs
            fv += amount * (((1 + rp) ** n - 1) / rp) * (1 + rp)
        proj[f"y{yrs}"] = round(fv, 2)
    out["projection"] = proj
    return out

class SipImportIn(BaseModel):
    profile_id: str = ""
    csv: str = ""

def _norm_date(s):
    s = (s or "").strip()
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.match(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})", s)
    if m:
        d, mo, y = m.groups()
        if len(y) == 2:
            y = "20" + y
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    return ""

@app.post("/sips/import-csv")
async def sips_import_csv(body: SipImportIn):
    import csv as _csv, io as _io
    pid = body.profile_id or _default_profile_id()
    ensure_profile(pid)
    text = (body.csv or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="Paste or upload a CSV first.")
    delim = ","
    first = text.splitlines()[0]
    for d in [",", ";", "\t"]:
        if first.count(d) > first.count(delim):
            delim = d
    rows = [r for r in _csv.reader(_io.StringIO(text), delimiter=delim) if any(c.strip() for c in r)]
    if len(rows) < 2:
        return {"status": "error", "message": "CSV needs a header row and at least one SIP row.", "imported": 0, "skipped": 0}
    header = [h.strip().lower() for h in rows[0]]

    def find(aliases):
        for a in aliases:
            if a in header:
                return header.index(a)
        for i, h in enumerate(header):
            if any(a in h for a in aliases):
                return i
        return -1

    ci_scheme = find(["scheme name", "fund name", "scheme", "fund", "name"])
    ci_amt = find(["sip amount", "installment amount", "monthly amount", "amount", "investment"])
    ci_freq = find(["frequency", "freq"])
    ci_start = find(["start date", "sip start", "registration date", "purchase date", "date", "start", "since"])
    ci_kind = find(["kind", "mode", "investment type", "type"])
    if ci_scheme < 0 or ci_amt < 0:
        return {"status": "error", "message": "Need at least a scheme/fund name column and an amount column.", "imported": 0, "skipped": 0}

    def g(r, i):
        return r[i].strip() if 0 <= i < len(r) else ""

    imported = skipped = 0
    for r in rows[1:]:
        scheme = g(r, ci_scheme)
        amt = _num(g(r, ci_amt))
        if not scheme or amt <= 0:
            skipped += 1
            continue
        kindraw = g(r, ci_kind).lower()
        kind = "Lumpsum" if ("lump" in kindraw or "one" in kindraw) else "SIP"
        freq = (g(r, ci_freq) or "Monthly").title()
        sips.append({"id": next_numeric_id(sips), "profile_id": pid, "scheme": scheme, "symbol": "",
                     "kind": kind, "amount": amt, "frequency": freq,
                     "start_date": _norm_date(g(r, ci_start)), "status": "active", "notes": "CSV import"})
        imported += 1
    save_data()
    return {"status": "ok", "imported": imported, "skipped": skipped}

@app.get("/metal-rates")
async def metal_rates(currency: str = "INR"):
    """Live gold & silver rates (per gram / 10g / oz) in the requested currency."""
    spot = await market.metal_spot()
    cur = (currency or "INR").upper()
    rates = (await market.fx_rates("EUR")).get("rates", {})
    def to_cur(usd):
        return usd * (1.0 / (rates.get("USD") or 1.08)) * (rates.get(cur, 1) if cur != "EUR" else 1)
    g_oz = spot.get("gold_usd_oz") or 0
    s_oz = spot.get("silver_usd_oz") or 0
    g_g = to_cur(g_oz / 31.1035)
    s_g = to_cur(s_oz / 31.1035)
    return {"currency": cur,
            "gold": {"per_gram": round(g_g, 2), "per_10g": round(g_g * 10, 2), "per_oz": round(to_cur(g_oz), 2), "usd_oz": g_oz},
            "silver": {"per_gram": round(s_g, 2), "per_10g": round(s_g * 10, 2), "per_oz": round(to_cur(s_oz), 2), "usd_oz": s_oz},
            "source": "Yahoo spot + live FX"}

@app.get("/mf-search")
async def mf_search(q: str = ""):
    return await market.mf_search(q)

@app.get("/sips")
async def list_sips(profile_id: Optional[str] = None):
    rows = [s for s in sips if not profile_id or s.get("profile_id") == profile_id]
    return await asyncio.gather(*[compute_sip(s) for s in rows]) if rows else []

@app.post("/sips")
async def create_sip(s: SipIn):
    if not s.scheme.strip():
        raise HTTPException(status_code=422, detail="Fund/scheme name is required.")
    if float(s.amount or 0) <= 0:
        raise HTTPException(status_code=422, detail="Amount must be greater than 0.")
    _reject_future(s.start_date, 0, "SIP / investment start date")
    pid = s.profile_id or _default_profile_id()
    ensure_profile(pid)
    row = s.model_dump()
    row["profile_id"] = pid
    row["scheme"] = s.scheme.strip()
    row["id"] = next_numeric_id(sips)
    sips.append(row)
    save_data()
    return await compute_sip(row)

@app.patch("/sips/{sip_id}")
async def update_sip(sip_id: int, s: SipIn):
    row = next((x for x in sips if int(x.get("id", 0)) == sip_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="SIP not found")
    data = s.model_dump(exclude_unset=True)
    data.pop("profile_id", None)
    row.update(data)
    save_data()
    return await compute_sip(row)

@app.delete("/sips/{sip_id}")
def delete_sip(sip_id: int):
    before = len(sips)
    sips[:] = [x for x in sips if int(x.get("id", 0)) != sip_id]
    if len(sips) == before:
        raise HTTPException(status_code=404, detail="SIP not found")
    save_data()
    return {"deleted": before - len(sips)}

_PROFILES_CACHE = {"data": None, "ts": 0.0}
def _invalidate_profiles_cache():
    _PROFILES_CACHE["data"] = None

@app.get("/profiles")
async def get_profiles():
    # Compute each profile's dashboard concurrently, and cache the payload for 30s — this
    # endpoint live-prices every profile's holdings, so sequentially it took 8-20s and it's
    # hit on every app load / profile switch. Cache is invalidated when profiles change.
    import asyncio, time as _time
    if _PROFILES_CACHE["data"] is not None and (_time.time() - _PROFILES_CACHE["ts"]) < 30:
        return _PROFILES_CACHE["data"]
    dashes = await asyncio.gather(*[dashboard(p["id"]) for p in profiles], return_exceptions=True)
    out = []
    for p, d in zip(profiles, dashes):
        if not isinstance(d, dict):
            d = {}
        out.append({**public_profile(p), "locked": not is_admin_profile(p), "has_password": bool(p.get("password")), **d})
    _PROFILES_CACHE.update(data=out, ts=_time.time())
    return out

@app.post("/profiles")
async def create_profile(p: ProfileIn):
    ensure_profile_name(p.name)
    base = slugify(p.name)
    pid = base
    n = 2
    while any(x["id"] == pid for x in profiles):
        pid = f"{base}_{n}"
        n += 1
    row = {"id": pid, "name": p.name, "relation": p.relation, "country": p.country, "avatar": avatar_for(p.name), "photo_url": p.photo_url, "password": p.password.strip(),
           "role": p.role.strip(), "company": p.company.strip(), "location": p.location.strip(), "bio": p.bio.strip(), "links": p.links or {},
           "headline": p.headline.strip(), "expertise": p.expertise.strip(), "interests": p.interests.strip(), "phone": p.phone.strip(), "milestones": p.milestones.strip(), "motto": p.motto.strip()}
    profiles.append(row)
    save_data()
    _invalidate_profiles_cache()
    return public_profile(row)

@app.patch("/profiles/{profile_id}")
async def update_profile(profile_id: str, p: ProfileUpdate):
    row = next((x for x in profiles if x["id"] == profile_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    if p.id is not None:
        new_id = slugify(p.id)
        if not new_id:
            raise HTTPException(status_code=422, detail="Profile ID is required")
        if new_id != profile_id and any(x["id"] == new_id for x in profiles):
            raise HTTPException(status_code=409, detail=f"Profile ID '{new_id}' already exists")
        if new_id != profile_id:
            row["id"] = new_id
            rename_profile_references(profile_id, new_id)
    if p.name is not None:
        ensure_profile_name(p.name, row.get("id"))
        row["name"] = p.name
        row["avatar"] = avatar_for(p.name)
    if p.relation is not None:
        row["relation"] = p.relation
    if p.country is not None:
        row["country"] = p.country
    if p.photo_url is not None:
        row["photo_url"] = p.photo_url.strip()
    if p.role is not None:
        row["role"] = p.role.strip()
    if p.company is not None:
        row["company"] = p.company.strip()
    if p.location is not None:
        row["location"] = p.location.strip()
    if p.bio is not None:
        row["bio"] = p.bio.strip()
    if p.links is not None:
        row["links"] = {k: str(v).strip() for k, v in (p.links or {}).items() if str(v).strip()}
    if p.headline is not None:
        row["headline"] = p.headline.strip()
    if p.expertise is not None:
        row["expertise"] = p.expertise.strip()
    if p.interests is not None:
        row["interests"] = p.interests.strip()
    if p.phone is not None:
        row["phone"] = p.phone.strip()
    if p.milestones is not None:
        row["milestones"] = p.milestones.strip()
    if p.motto is not None:
        row["motto"] = p.motto.strip()
    if p.password is not None and p.password.strip():
        row["password"] = p.password.strip()
    save_data()
    _invalidate_profiles_cache()
    return public_profile(row)

@app.post("/profiles/{profile_id}/unlock")
async def unlock_profile(profile_id: str, body: UnlockIn):
    row = next((x for x in profiles if x["id"] == profile_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    admin = is_admin_profile(row)
    expected = row.get("password")
    if not expected:
        # No password set: admin/self profiles are open; legacy locked (non-self)
        # profiles still use the historical 1234 default.
        if admin:
            return {"ok": True, "profile_id": profile_id, "admin": True}
        expected = "1234"
    if body.password != expected:
        raise HTTPException(status_code=403, detail="Wrong profile password")
    return {"ok": True, "profile_id": profile_id, "admin": admin}

@app.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    row = next((x for x in profiles if x["id"] == profile_id), None)
    if row and row.get("relation","").lower() == "self":
        selfs = [x for x in profiles if x.get("relation","").lower() == "self"]
        if len(selfs) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the main admin profile")
    before = len(profiles)
    profiles[:] = [p for p in profiles if p["id"] != profile_id]
    deleted = before - len(profiles)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found")
    save_data()
    _invalidate_profiles_cache()
    return {"deleted": deleted}

@app.get("/dashboard")
async def dashboard(profile_id: Optional[str] = None):
    h = await live_holdings(profile_id)
    p = await live_properties(profile_id)
    inv = sum(x["value_eur"] for x in h)
    cost = sum(x["cost_eur"] for x in h)
    prop = sum(x["value_eur"] for x in p)
    cash = sum(eur(c["balance"], c["currency"]) for c in cash_accounts if not profile_id or c["profile_id"] == profile_id)
    income = sum(eur(c["amount"], c["currency"]) for c in cashflow if (not profile_id or c["profile_id"] == profile_id) and c["type"] == "income")
    expense = sum(eur(c["amount"], c["currency"]) for c in cashflow if (not profile_id or c["profile_id"] == profile_id) and c["type"] == "expense")
    invest = sum(eur(c["amount"], c["currency"]) for c in cashflow if (not profile_id or c["profile_id"] == profile_id) and c["type"] == "investment")
    return {"net_worth": round(inv+prop+cash,2), "investments": round(inv,2), "properties": round(prop,2), "cash": round(cash,2), "pl": round(inv-cost,2), "daily": round(sum(x["daily_eur"] for x in h),2), "income": income, "expenses": expense, "monthly_investment": invest, "savings_rate": round((income-expense)/income*100,1) if income else 0, "updated": datetime.utcnow().isoformat()}

@app.get("/holdings")
async def holdings(profile_id: Optional[str] = None): return await live_holdings(profile_id)

@app.get("/stock-markets")
async def api_stock_markets():
    return stock_markets

MARKET_SESSIONS = {
    "GLOBAL": {"timezone": "UTC", "open": "00:00", "close": "23:59", "note": "Manual/private assets do not follow one exchange session."},
    "CRYPTO": {"timezone": "UTC", "open": "00:00", "close": "23:59", "note": "Crypto trades 24/7; exchange outages can still happen."},
    "NYSE": {"timezone": "America/New_York", "open": "09:30", "close": "16:00"},
    "NASDAQ": {"timezone": "America/New_York", "open": "09:30", "close": "16:00"},
    "AMEX": {"timezone": "America/New_York", "open": "09:30", "close": "16:00"},
    "TSX": {"timezone": "America/Toronto", "open": "09:30", "close": "16:00"},
    "TSXV": {"timezone": "America/Toronto", "open": "09:30", "close": "16:00"},
    "BMV": {"timezone": "America/Mexico_City", "open": "08:30", "close": "15:00"},
    "LSE": {"timezone": "Europe/London", "open": "08:00", "close": "16:30"},
    "AIM": {"timezone": "Europe/London", "open": "08:00", "close": "16:30"},
    "XETRA": {"timezone": "Europe/Berlin", "open": "09:00", "close": "17:30"},
    "FWB": {"timezone": "Europe/Berlin", "open": "08:00", "close": "22:00", "note": "Frankfurt floor/electronic products vary; Xetra cash market is 09:00-17:30."},
    "PAR": {"timezone": "Europe/Paris", "open": "09:00", "close": "17:30"},
    "AMS": {"timezone": "Europe/Amsterdam", "open": "09:00", "close": "17:30"},
    "BRU": {"timezone": "Europe/Brussels", "open": "09:00", "close": "17:30"},
    "LIS": {"timezone": "Europe/Lisbon", "open": "08:00", "close": "16:30"},
    "MIL": {"timezone": "Europe/Rome", "open": "09:00", "close": "17:30"},
    "MAD": {"timezone": "Europe/Madrid", "open": "09:00", "close": "17:30"},
    "SIX": {"timezone": "Europe/Zurich", "open": "09:00", "close": "17:30"},
    "STO": {"timezone": "Europe/Stockholm", "open": "09:00", "close": "17:30"},
    "CPH": {"timezone": "Europe/Copenhagen", "open": "09:00", "close": "17:00"},
    "HEL": {"timezone": "Europe/Helsinki", "open": "10:00", "close": "18:30"},
    "OSL": {"timezone": "Europe/Oslo", "open": "09:00", "close": "16:20"},
    "WSE": {"timezone": "Europe/Warsaw", "open": "09:00", "close": "17:00"},
    "VIE": {"timezone": "Europe/Vienna", "open": "09:00", "close": "17:30"},
    "ATH": {"timezone": "Europe/Athens", "open": "10:30", "close": "17:20"},
    "IST": {"timezone": "Europe/Istanbul", "open": "10:00", "close": "18:00"},
    "NSE": {"timezone": "Asia/Kolkata", "open": "09:15", "close": "15:30"},
    "BSE": {"timezone": "Asia/Kolkata", "open": "09:15", "close": "15:30"},
    "TSE": {"timezone": "Asia/Tokyo", "open": "09:00", "close": "15:30", "note": "Lunch break is commonly 11:30-12:30 local time."},
    "HKEX": {"timezone": "Asia/Hong_Kong", "open": "09:30", "close": "16:00", "note": "Lunch break is commonly 12:00-13:00 local time."},
    "SSE": {"timezone": "Asia/Shanghai", "open": "09:30", "close": "15:00", "note": "Lunch break is commonly 11:30-13:00 local time."},
    "SZSE": {"timezone": "Asia/Shanghai", "open": "09:30", "close": "15:00", "note": "Lunch break is commonly 11:30-13:00 local time."},
    "TWSE": {"timezone": "Asia/Taipei", "open": "09:00", "close": "13:30"},
    "KRX": {"timezone": "Asia/Seoul", "open": "09:00", "close": "15:30"},
    "SGX": {"timezone": "Asia/Singapore", "open": "09:00", "close": "17:00"},
    "IDX": {"timezone": "Asia/Jakarta", "open": "09:00", "close": "15:00"},
    "SET": {"timezone": "Asia/Bangkok", "open": "10:00", "close": "16:30", "note": "Lunch break is commonly 12:30-14:30 local time."},
    "MYX": {"timezone": "Asia/Kuala_Lumpur", "open": "09:00", "close": "16:50", "note": "Lunch break is commonly 12:30-14:30 local time."},
    "PSE": {"timezone": "Asia/Manila", "open": "09:30", "close": "15:00"},
    "HOSE": {"timezone": "Asia/Ho_Chi_Minh", "open": "09:15", "close": "14:45", "note": "Lunch break is commonly 11:30-13:00 local time."},
    "ASX": {"timezone": "Australia/Sydney", "open": "10:00", "close": "16:00"},
    "NZX": {"timezone": "Pacific/Auckland", "open": "10:00", "close": "16:45"},
    "TASE": {"timezone": "Asia/Jerusalem", "open": "09:30", "close": "17:25", "note": "Friday sessions are shorter when open."},
    "TADAWUL": {"timezone": "Asia/Riyadh", "open": "10:00", "close": "15:00"},
    "DFM": {"timezone": "Asia/Dubai", "open": "10:00", "close": "15:00"},
    "ADX": {"timezone": "Asia/Dubai", "open": "10:00", "close": "15:00"},
    "QSE": {"timezone": "Asia/Qatar", "open": "09:30", "close": "13:10"},
    "JSE": {"timezone": "Africa/Johannesburg", "open": "09:00", "close": "17:00"},
    "EGX": {"timezone": "Africa/Cairo", "open": "10:00", "close": "14:30"},
    "NGX": {"timezone": "Africa/Lagos", "open": "10:00", "close": "14:20"},
    "NSEKENYA": {"timezone": "Africa/Nairobi", "open": "09:30", "close": "15:00"},
    "B3": {"timezone": "America/Sao_Paulo", "open": "10:00", "close": "17:55"},
    "BCBA": {"timezone": "America/Argentina/Buenos_Aires", "open": "11:00", "close": "17:00"},
    "BCS": {"timezone": "America/Santiago", "open": "09:30", "close": "16:00"},
    "BVC": {"timezone": "America/Bogota", "open": "08:30", "close": "15:00"},
    "BVL": {"timezone": "America/Lima", "open": "08:30", "close": "14:55"},
}

MARKET_HOLIDAYS_2026 = {
    "NYSE": {"2026-06-19": "Juneteenth National Independence Day", "2026-07-03": "Independence Day observed", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving Day", "2026-12-25": "Christmas Day"},
    "NASDAQ": {"2026-06-19": "Juneteenth National Independence Day", "2026-07-03": "Independence Day observed", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving Day", "2026-12-25": "Christmas Day"},
    "AMEX": {"2026-06-19": "Juneteenth National Independence Day", "2026-07-03": "Independence Day observed", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving Day", "2026-12-25": "Christmas Day"},
    "NSE": {"2026-06-26": "Muharram", "2026-10-02": "Mahatma Gandhi Jayanti", "2026-11-08": "Diwali Laxmi Pujan", "2026-12-25": "Christmas Day"},
    "BSE": {"2026-06-26": "Muharram", "2026-10-02": "Mahatma Gandhi Jayanti", "2026-11-08": "Diwali Laxmi Pujan", "2026-12-25": "Christmas Day"},
    "ASX": {"2026-06-08": "King's Birthday", "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day observed"},
    "HKEX": {"2026-06-19": "Tuen Ng Festival", "2026-07-01": "Hong Kong SAR Establishment Day", "2026-10-01": "National Day", "2026-12-25": "Christmas Day"},
    "LSE": {"2026-08-31": "Summer Bank Holiday", "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day substitute"},
    "AIM": {"2026-08-31": "Summer Bank Holiday", "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day substitute"},
    "XETRA": {"2026-12-24": "Christmas Eve", "2026-12-25": "Christmas Day", "2026-12-31": "New Year's Eve"},
    "FWB": {"2026-12-24": "Christmas Eve", "2026-12-25": "Christmas Day", "2026-12-31": "New Year's Eve"},
    "PAR": {"2026-12-25": "Christmas Day"},
    "AMS": {"2026-12-25": "Christmas Day"},
    "BRU": {"2026-12-25": "Christmas Day"},
    "LIS": {"2026-12-25": "Christmas Day"},
    "MIL": {"2026-12-25": "Christmas Day"},
    "MAD": {"2026-12-25": "Christmas Day"},
    "SIX": {"2026-12-25": "Christmas Day"},
    "TSE": {"2026-07-20": "Marine Day", "2026-08-11": "Mountain Day", "2026-09-21": "Respect for the Aged Day", "2026-09-23": "Autumnal Equinox Day", "2026-10-12": "Sports Day", "2026-11-03": "Culture Day", "2026-11-23": "Labor Thanksgiving Day", "2026-12-31": "Year-end market holiday"},
    "SSE": {"2026-10-01": "National Day holiday", "2026-10-02": "National Day holiday", "2026-10-05": "National Day holiday", "2026-10-06": "National Day holiday", "2026-10-07": "National Day holiday"},
    "SZSE": {"2026-10-01": "National Day holiday", "2026-10-02": "National Day holiday", "2026-10-05": "National Day holiday", "2026-10-06": "National Day holiday", "2026-10-07": "National Day holiday"},
    "SGX": {"2026-08-10": "National Day observed", "2026-11-08": "Deepavali", "2026-12-25": "Christmas Day"},
    "TSX": {"2026-07-01": "Canada Day", "2026-09-07": "Labour Day", "2026-10-12": "Thanksgiving Day", "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day observed"},
    "TSXV": {"2026-07-01": "Canada Day", "2026-09-07": "Labour Day", "2026-10-12": "Thanksgiving Day", "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day observed"},
}

def _parse_market_time(value: str):
    hour, minute = [int(x) for x in value.split(":")]
    return dt_time(hour, minute)

def _session_window(today: date, session: dict):
    zone = ZoneInfo(session.get("timezone", "UTC"))
    open_dt = datetime.combine(today, _parse_market_time(session.get("open", "00:00")), zone)
    close_dt = datetime.combine(today, _parse_market_time(session.get("close", "23:59")), zone)
    return open_dt, close_dt

def _fmt_window(open_dt: datetime, close_dt: datetime, zone_name: str):
    target = ZoneInfo(zone_name)
    start = open_dt.astimezone(target)
    end = close_dt.astimezone(target)
    return f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')} {start.tzname() or zone_name}"

def _market_calendar_payload(code: str, target_date: Optional[date] = None):
    market_row = market_by_code(code)
    code = market_row["code"]
    session = MARKET_SESSIONS.get(code, MARKET_SESSIONS["GLOBAL"])
    zone = ZoneInfo(session["timezone"])
    today = target_date or datetime.now(zone).date()
    open_dt, close_dt = _session_window(today, session)
    holidays = MARKET_HOLIDAYS_2026.get(code, {})
    holiday_name = holidays.get(today.isoformat(), "")
    is_weekend = today.weekday() >= 5 and code not in {"CRYPTO"}
    is_holiday = bool(holiday_name)
    upcoming = []
    for day_str, name in sorted(holidays.items()):
        day = date.fromisoformat(day_str)
        if day >= today:
            upcoming.append({"date": day.isoformat(), "name": name, "days_until": (day - today).days})
    next_holiday = upcoming[0] if upcoming else None
    is_open_today = code in {"CRYPTO", "GLOBAL"} or not is_weekend and not is_holiday
    # --- real-time (open right now / next open countdown) ---
    now_utc = datetime.now(UTC)
    closes_in_minutes = None
    live_next_open = None
    if code == "CRYPTO":
        is_open_now = True
    elif code == "GLOBAL":
        is_open_now = False
    else:
        is_open_now = _is_open_now(code, session, now_utc)
        if is_open_now:
            _, c_dt = _session_window(now_utc.astimezone(zone).date(), session)
            closes_in_minutes = max(int((c_dt.astimezone(UTC) - now_utc).total_seconds() // 60), 0)
        else:
            nxt = _next_open(code, session, now_utc)
            if nxt:
                open_local = nxt.astimezone(zone)
                live_next_open = {
                    "opens_at_utc": nxt.isoformat(),
                    "opens_in_minutes": max(int((nxt - now_utc).total_seconds() // 60), 0),
                    "open_date": open_local.date().isoformat(),
                    "local_open": f"{open_local.strftime('%H:%M')} {open_local.tzname() or session['timezone']}",
                }
    if is_holiday:
        notice = f"Today {code} is closed for {holiday_name}."
        status = "closed"
    elif is_weekend:
        notice = f"Today {code} is closed because it is the weekend in {session['timezone']}."
        status = "closed"
    elif next_holiday and next_holiday["days_until"] == 1:
        notice = f"Tomorrow {code} is closed for {next_holiday['name']}."
        status = "warn"
    elif next_holiday and next_holiday["days_until"] <= 7:
        notice = f"{code} has a holiday in {next_holiday['days_until']} days: {next_holiday['name']}."
        status = "warn"
    else:
        notice = f"{code} is scheduled to trade today. No configured holiday in the next 7 days."
        status = "open"
    return {
        "market": market_row,
        "timezone": session["timezone"],
        "regular_session_local": _fmt_window(open_dt, close_dt, session["timezone"]),
        "regular_session_utc": _fmt_window(open_dt, close_dt, "UTC"),
        "regular_session_berlin": _fmt_window(open_dt, close_dt, "Europe/Berlin"),
        "today_local_date": today.isoformat(),
        "is_weekend": is_weekend,
        "is_holiday_today": is_holiday,
        "today_holiday_name": holiday_name,
        "is_open_today": is_open_today,
        "is_open_now": is_open_now,
        "closes_in_minutes": closes_in_minutes,
        "live_next_open": live_next_open,
        "status": status,
        "notice": notice,
        "note": session.get("note", ""),
        "next_holiday": next_holiday,
        "upcoming_holidays": upcoming[:5],
    }

@app.get("/market-calendar")
async def market_calendar(market_code: str = "ALL", date_: Optional[str] = None):
    target = date.fromisoformat(date_) if date_ else None
    code = (market_code or "ALL").upper()
    if code == "ALL":
        rows = [_market_calendar_payload(m["code"], target) for m in stock_markets]
        warnings = [r for r in rows if r["status"] in {"closed", "warn"}]
        return {
            "market": {"code": "ALL", "name": "All world markets", "country": "Global", "currency": "", "region": "Global"},
            "status": "warn" if warnings else "open",
            "notice": f"{len(warnings)} markets have a closure or holiday warning today/soon." if warnings else "No configured holiday warnings for the tracked exchanges.",
            "markets": rows,
        }
    return _market_calendar_payload(code, target)

UTC = ZoneInfo("UTC")

def _is_trading_day(code: str, day: date) -> bool:
    if code in {"CRYPTO", "GLOBAL"}:
        return True
    if day.weekday() >= 5:
        return False
    return day.isoformat() not in MARKET_HOLIDAYS_2026.get(code, {})

def _is_open_now(code: str, session: dict, now_utc: datetime) -> bool:
    if code == "CRYPTO":
        return True
    if code == "GLOBAL":
        return False
    zone = ZoneInfo(session["timezone"])
    now_local = now_utc.astimezone(zone)
    if not _is_trading_day(code, now_local.date()):
        return False
    open_dt, close_dt = _session_window(now_local.date(), session)
    return open_dt <= now_local <= close_dt

def _next_open(code: str, session: dict, now_utc: datetime):
    zone = ZoneInfo(session["timezone"])
    now_local = now_utc.astimezone(zone)
    open_time = _parse_market_time(session.get("open", "00:00"))
    for offset in range(0, 14):
        day = (now_local + timedelta(days=offset)).date()
        if not _is_trading_day(code, day):
            continue
        open_dt = datetime.combine(day, open_time, zone)
        if open_dt > now_local:
            return open_dt.astimezone(UTC)
    return None

@app.get("/market-status")
async def market_status():
    now_utc = datetime.now(UTC)
    open_markets = []
    next_candidates = []
    for m in stock_markets:
        code = m["code"]
        if code in {"GLOBAL", "CRYPTO"}:
            continue
        session = MARKET_SESSIONS.get(code, MARKET_SESSIONS["GLOBAL"])
        zone = ZoneInfo(session["timezone"])
        today_local = now_utc.astimezone(zone).date()
        open_dt, close_dt = _session_window(today_local, session)
        if _is_open_now(code, session, now_utc):
            close_utc = close_dt.astimezone(UTC)
            open_markets.append({
                "code": code,
                "name": m["name"],
                "country": m["country"],
                "region": m.get("region", ""),
                "timezone": session["timezone"],
                "currency": m.get("currency", ""),
                "local_session": _fmt_window(open_dt, close_dt, session["timezone"]),
                "close_utc": close_utc.isoformat(),
                "closes_in_minutes": max(int((close_utc - now_utc).total_seconds() // 60), 0),
                "note": session.get("note", ""),
            })
        else:
            nxt = _next_open(code, session, now_utc)
            if nxt:
                next_candidates.append((nxt, m, session))
    open_markets.sort(key=lambda x: x["closes_in_minutes"])
    next_candidates.sort(key=lambda x: x[0])
    next_open = None
    if next_candidates:
        nxt, m, session = next_candidates[0]
        zone = ZoneInfo(session["timezone"])
        open_local = nxt.astimezone(zone)
        n_open_dt, n_close_dt = _session_window(open_local.date(), session)
        next_open = {
            "code": m["code"],
            "name": m["name"],
            "country": m["country"],
            "region": m.get("region", ""),
            "timezone": session["timezone"],
            "currency": m.get("currency", ""),
            "opens_at_utc": nxt.isoformat(),
            "opens_in_minutes": max(int((nxt - now_utc).total_seconds() // 60), 0),
            "open_date": open_local.date().isoformat(),
            "local_open": f"{open_local.strftime('%H:%M')} {open_local.tzname() or session['timezone']}",
            "local_session": _fmt_window(n_open_dt, n_close_dt, session["timezone"]),
            "note": session.get("note", ""),
        }
    return {
        "as_of_utc": now_utc.isoformat(),
        "any_open": bool(open_markets),
        "open_count": len(open_markets),
        "open_markets": open_markets,
        "next_open": next_open,
        "crypto_always_open": True,
    }

def infer_india_fund_category(name: str):
    n = (name or "").lower()
    rules = [
        ("ETF", "ETF"),
        ("index", "Index Fund"),
        ("nifty", "Index Fund"),
        ("sensex", "Index Fund"),
        ("small cap", "Small Cap"),
        ("mid cap", "Mid Cap"),
        ("large cap", "Large Cap"),
        ("flexi", "Flexi Cap"),
        ("multi cap", "Multi Cap"),
        ("elss", "ELSS / Tax Saving"),
        ("balanced advantage", "Hybrid"),
        ("hybrid", "Hybrid"),
        ("liquid", "Liquid / Debt"),
        ("gilt", "Debt / Gilt"),
        ("debt", "Debt"),
        ("corporate bond", "Debt"),
        ("gold", "Gold"),
        ("sectoral", "Sectoral"),
        ("thematic", "Thematic"),
        ("fof", "Fund of Funds"),
    ]
    for key, cat in rules:
        if key in n:
            return cat
    return "Mutual Fund"

def infer_india_fund_risk(category: str):
    c = (category or "").lower()
    if any(x in c for x in ["small", "mid", "sector", "thematic"]):
        return "Very High"
    if any(x in c for x in ["large", "flexi", "multi", "index", "etf", "gold"]):
        return "High"
    if any(x in c for x in ["debt", "gilt", "liquid", "bond"]):
        return "Low to Moderate"
    return "High"

def india_fund_symbol(code, name):
    base = re.sub(r"[^A-Z0-9]+", "_", (name or "MF").upper()).strip("_")[:34]
    return f"MF{code}_{base}" if code else base

async def india_mutual_fund_master():
    cached = LOCATION_CACHE.get("india-mf-master")
    if cached and time.time() - cached["ts"] < 60 * 60 * 12:
        return cached["data"]
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get("https://api.mfapi.in/mf", headers={"User-Agent":"Mozilla/5.0"})
            r.raise_for_status()
        raw = r.json()
        rows = []
        for item in raw:
            code = str(item.get("schemeCode") or "")
            name = item.get("schemeName") or ""
            if not code or not name:
                continue
            cat = infer_india_fund_category(name)
            rows.append({
                "symbol": india_fund_symbol(code, name),
                "scheme_code": code,
                "isin_growth": item.get("isinGrowth"),
                "isin_reinvestment": item.get("isinDivReinvestment"),
                "name": name,
                "type": "ETF" if cat == "ETF" else "Mutual Fund",
                "category": cat,
                "market": "MFINDIA",
                "country": "India",
                "currency": "INR",
                "risk": infer_india_fund_risk(cat),
                "one_year": 0,
                "three_year": 0,
                "expense": 0,
                "aum_cr": 0,
                "platforms": ["Groww", "MF Central", "Zerodha Coin"],
                "source": "MFAPI India master",
            })
        LOCATION_CACHE["india-mf-master"] = {"ts": time.time(), "data": rows}
        return rows
    except Exception:
        return []

def nav_return(points, days):
    if len(points) < 2:
        return 0
    latest = points[-1]
    target = latest["date_obj"] - timedelta(days=days)
    base = next((p for p in points if p["date_obj"] >= target), points[0])
    return round((latest["nav"] - base["nav"]) / base["nav"] * 100, 2) if base["nav"] else 0

async def india_mutual_fund_detail(scheme_code: str):
    code = str(scheme_code or "").strip()
    if not code:
        return {}
    cached = LOCATION_CACHE.get(f"india-mf-detail:{code}")
    if cached and time.time() - cached["ts"] < 60 * 60:
        return cached["data"]
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get(f"https://api.mfapi.in/mf/{code}", headers={"User-Agent":"Mozilla/5.0"})
            r.raise_for_status()
        raw = r.json()
        meta = raw.get("meta") or {}
        points = []
        for item in raw.get("data", []):
            try:
                dt = datetime.strptime(item.get("date", ""), "%d-%m-%Y")
                nav = float(item.get("nav") or 0)
            except Exception:
                continue
            if nav:
                points.append({"date": item.get("date"), "date_obj": dt, "nav": nav})
        points.sort(key=lambda x: x["date_obj"])
        latest = points[-1] if points else {}
        previous = points[-2] if len(points) > 1 else latest
        detail = {
            "scheme_code": str(meta.get("scheme_code") or code),
            "name": meta.get("scheme_name") or "",
            "fund_house": meta.get("fund_house") or "",
            "scheme_type": meta.get("scheme_type") or "",
            "scheme_category": meta.get("scheme_category") or "",
            "isin_growth": meta.get("isin_growth") or "",
            "isin_reinvestment": meta.get("isin_div_reinvestment") or "",
            "latest_nav": round(float(latest.get("nav") or 0), 4),
            "nav_date": latest.get("date") or "",
            "previous_nav": round(float(previous.get("nav") or 0), 4),
            "nav_change": round(float(latest.get("nav") or 0) - float(previous.get("nav") or 0), 4) if latest else 0,
            "nav_change_pct": round((float(latest.get("nav") or 0) - float(previous.get("nav") or 0)) / float(previous.get("nav") or 1) * 100, 2) if latest and previous.get("nav") else 0,
            "return_1m": nav_return(points, 30),
            "return_3m": nav_return(points, 90),
            "return_6m": nav_return(points, 182),
            "return_1y": nav_return(points, 365),
            "return_3y": nav_return(points, 365 * 3),
            "history_count": len(points),
            "nav_points": [{"date": p["date"], "nav": round(p["nav"], 4)} for p in points[-180:]],
            "source": "MFAPI NAV detail",
        }
        LOCATION_CACHE[f"india-mf-detail:{code}"] = {"ts": time.time(), "data": detail}
        return detail
    except Exception as e:
        return {"scheme_code": code, "error": str(e), "source": "MFAPI NAV detail unavailable"}

@app.get("/funds-bonds")
async def api_funds_bonds(q: Optional[str] = None, type: Optional[str] = None):
    live_mfs = await india_mutual_fund_master()
    seeded_symbols = {r.get("symbol") for r in funds_bonds_india}
    rows = list(funds_bonds_india) + [r for r in live_mfs if r.get("symbol") not in seeded_symbols]
    if q:
        query = q.lower()
        terms = [x for x in query.split() if x]
        rows = [r for r in rows if all(t in f"{r.get('symbol')} {r.get('scheme_code','')} {r.get('isin_growth','')} {r.get('isin_reinvestment','')} {r.get('name')} {r.get('category')} {r.get('type')}".lower() for t in terms)]
    if type:
        rows = [r for r in rows if r.get("type","").lower() == type.lower()]
    return rows[:3000 if not q else 8000]

@app.get("/fund-detail")
async def api_fund_detail(scheme_code: str):
    return await india_mutual_fund_detail(scheme_code)

@app.get("/fx-rates")
async def api_fx_rates(base: str = "EUR"):
    return await market.fx_rates(base.upper())

@app.get("/forex")
async def api_forex():
    return await market.forex_table()

@app.post("/holdings")
async def create_holding(h: HoldingIn):
    ensure_profile(h.profile_id)
    symbol = h.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=422, detail="Symbol is required")
    if (h.qty or 0) < 0:
        raise HTTPException(status_code=422, detail="Quantity cannot be negative")
    if (h.price or 0) < 0:
        raise HTTPException(status_code=422, detail="Current price cannot be negative")
    if (h.avg or 0) < 0:
        raise HTTPException(status_code=422, detail="Average / buy price cannot be negative")
    row = h.model_dump()
    market_meta = market_by_code(row.get("market"))
    row["market"] = market_meta["code"]
    row["country"] = row.get("country") or market_meta["country"]
    row["currency"] = row.get("currency") or market_meta["currency"]
    row["symbol"] = symbol
    suffix = market_meta.get("suffix", "")
    row["yahoo"] = row["yahoo"].strip() or (symbol if not suffix or symbol.endswith(suffix) else f"{symbol}{suffix}")
    row["name"] = row["name"].strip() or symbol
    assets.append(row)
    save_data()
    return row

@app.patch("/holdings/{symbol}")
async def update_holding(symbol: str, h: HoldingUpdate, profile_id: Optional[str] = None):
    row = next((a for a in assets if a["symbol"].upper() == symbol.upper() and (profile_id is None or a.get("profile_id") == profile_id)), None)
    if not row:
        raise HTTPException(status_code=404, detail="Holding not found")
    updates = h.model_dump(exclude_unset=True)
    if "qty" in updates and updates["qty"] is not None and updates["qty"] < 0:
        raise HTTPException(status_code=422, detail="Quantity cannot be negative")
    if "market" in updates:
        market_meta = market_by_code(updates.get("market"))
        updates["market"] = market_meta["code"]
        updates.setdefault("country", market_meta["country"])
        updates.setdefault("currency", market_meta["currency"])
        suffix = market_meta.get("suffix", "")
        if suffix and not (updates.get("yahoo") or row.get("yahoo", "")).endswith(suffix):
            updates.setdefault("yahoo", f"{row['symbol']}{suffix}")
    for key, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        row[key] = value
    save_data()
    return row

@app.delete("/holdings/{symbol}")
async def delete_holding(symbol: str, profile_id: Optional[str] = None):
    before = len(assets)
    assets[:] = [a for a in assets if not (a["symbol"].upper() == symbol.upper() and (profile_id is None or a.get("profile_id") == profile_id))]
    deleted = before - len(assets)
    if not deleted:
        raise HTTPException(status_code=404, detail="Holding not found")
    save_data()
    return {"deleted": deleted}

@app.get("/watchlist")
async def get_watchlist():
    rows = await enriched_assets(True)
    owned = {a["symbol"].upper() for a in assets}
    wl = {a["symbol"].upper() for a in watchlist}
    return [r for r in rows if r["symbol"].upper() in wl and r["symbol"].upper() not in owned]

@app.post("/watchlist")
async def add_watchlist(w: WatchlistIn):
    symbol = w.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=422, detail="Symbol is required")
    existing = next((x for x in global_universe + watchlist if x.get("symbol", "").upper() == symbol), None)
    row = existing.copy() if existing else w.model_dump()
    requested_market = w.market if w.market and w.market != "GLOBAL" else row.get("market") or infer_market(row)
    market_meta = market_by_code(requested_market)
    row["market"] = row.get("market") or market_meta["code"]
    row["country"] = row.get("country") or market_meta["country"]
    row["symbol"] = symbol
    row["name"] = (w.name or row.get("name") or symbol).strip()
    suffix = market_meta.get("suffix", "")
    row["yahoo"] = (w.yahoo or row.get("yahoo") or (symbol if not suffix or symbol.endswith(suffix) else f"{symbol}{suffix}")).strip()
    if not any(x.get("symbol", "").upper() == symbol for x in watchlist):
        watchlist.append(row)
        save_data()
    return row

@app.delete("/watchlist/{symbol}")
async def delete_watchlist(symbol: str):
    before = len(watchlist)
    watchlist[:] = [x for x in watchlist if x.get("symbol", "").upper() != symbol.upper()]
    deleted = before - len(watchlist)
    if not deleted:
        raise HTTPException(status_code=404, detail="Favorite not found")
    save_data()
    return {"deleted": deleted}

@app.get("/properties")
async def api_properties(profile_id: Optional[str] = None): return await live_properties(profile_id)

@app.post("/properties")
async def create_property(p: PropertyIn):
    ensure_profile(p.profile_id)
    if not p.name.strip():
        raise HTTPException(status_code=422, detail="Property name is required")
    # --- validation: bought/valuation dates can't be in the future ---
    _validate_property(p)
    row = p.model_dump()
    if not row.get("currency_manual"):
        row["currency"] = property_currency(row)
    row["id"] = next_numeric_id(properties)
    properties.append(row)
    save_data()
    return row

@app.patch("/properties/{property_id}")
async def update_property(property_id: int, p: PropertyIn):
    row = next((x for x in properties if int(x.get("id", 0)) == property_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Property not found")
    if not p.name.strip():
        raise HTTPException(status_code=422, detail="Property name is required")
    _validate_property(p)
    data = p.model_dump()
    data.pop("profile_id", None)   # editing doesn't move it between members
    if not data.get("currency_manual"):
        data["currency"] = property_currency({**row, **data})
    keep_id, keep_status = row.get("id"), row.get("status", "active")
    row.update(data)
    row["id"], row["status"] = keep_id, keep_status
    save_data()
    return row

@app.post("/properties/{property_id}/dispose")
async def dispose_property(property_id: int, d: PropertyDispositionIn):
    row = next((p for p in properties if int(p.get("id", 0)) == property_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Property not found")
    action = d.action.strip().lower()
    if action not in {"sold", "gifted"}:
        raise HTTPException(status_code=422, detail="Action must be sold or gifted")
    currency = (d.currency or row.get("currency") or "EUR").upper()
    amount = float(d.amount or 0)
    if action == "sold" and amount <= 0:
        amount = float(row.get("value", 0) or 0)
    if action == "gifted":
        amount = max(amount, 0)
    tax_paid = max(float(d.tax_paid or 0), 0)
    fees = max(float(d.fees or 0), 0)
    loan = max(float(row.get("loan", 0) or 0), 0)
    net = max(amount - tax_paid - fees - (loan if action == "sold" else 0), 0) if action == "sold" else 0
    estimate = suggest_property_sale(row, amount)
    row.update({
        "status": action,
        "disposition_action": action,
        "disposition_to": d.to.strip(),
        "disposition_amount": round(amount, 2),
        "disposition_currency": currency,
        "disposition_tax_paid": round(tax_paid, 2),
        "disposition_fees": round(fees, 2),
        "disposition_date": d.date or datetime.utcnow().date().isoformat(),
        "disposition_notes": d.notes.strip(),
        "net_proceeds": round(net, 2),
        "estimated_tax": estimate["estimated_tax"],
        "suggested_sale_price": estimate["suggested_sale_price"],
    })
    cash_account_id = None
    if d.create_cash and net > 0:
        cash_row = {
            "id": next_numeric_id(cash_accounts),
            "profile_id": row.get("profile_id", "me"),
            "name": f"Sale proceeds - {row.get('name') or row.get('category', 'Asset')}",
            "balance": round(net, 2),
            "currency": currency,
            "type": "Sale proceeds",
        }
        cash_accounts.append(cash_row)
        cash_account_id = cash_row["id"]
    save_data()
    return {**row, "cash_account_id": cash_account_id, "sale_guidance": estimate["guidance"]}

@app.delete("/properties/{property_id}")
async def delete_property(property_id: int):
    before = len(properties)
    properties[:] = [p for p in properties if int(p.get("id", 0)) != property_id]
    deleted = before - len(properties)
    if not deleted:
        raise HTTPException(status_code=404, detail="Property not found")
    save_data()
    return {"deleted": deleted}

def cashflow_row(c):
    row = dict(c)
    raw = row.get("date") or row.get("created_at") or date.today().isoformat()
    parsed = parse_property_date(raw) or date.today()
    row["date"] = parsed.isoformat()
    row["month"] = parsed.strftime("%B")
    row["month_num"] = parsed.month
    row["year"] = parsed.year
    row["period"] = parsed.strftime("%Y-%m")
    return row

@app.get("/cashflow")
async def api_cashflow(profile_id: Optional[str] = None):
    return [cashflow_row(c) for c in cashflow if not profile_id or c["profile_id"] == profile_id]

@app.post("/cashflow")
async def create_cashflow(c: CashflowIn):
    ensure_profile(c.profile_id)
    if not c.category.strip():
        raise HTTPException(status_code=422, detail="Cashflow category is required.")
    if float(c.amount or 0) <= 0:
        raise HTTPException(status_code=422, detail="Cashflow amount must be greater than 0.")
    if c.type not in {"income", "expense", "investment"}:
        raise HTTPException(status_code=422, detail="Type must be income, expense, or investment")
    row = c.model_dump()
    if not row.get("date"):
        row["date"] = date.today().isoformat()
    row["id"] = next_numeric_id(cashflow)
    cashflow.append(row)
    save_data()
    return cashflow_row(row)

@app.patch("/cashflow/{cashflow_id}")
async def update_cashflow(cashflow_id: int, c: CashflowUpdate):
    row = next((x for x in cashflow if int(x.get("id", 0)) == cashflow_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Cashflow row not found")
    data = c.model_dump(exclude_unset=True)
    if "type" in data and data["type"] not in {"income", "expense", "investment"}:
        raise HTTPException(status_code=422, detail="Type must be income, expense, or investment")
    for k, v in data.items():
        if v is not None:
            row[k] = v
    if not row.get("date"):
        row["date"] = date.today().isoformat()
    save_data()
    return cashflow_row(row)

@app.delete("/cashflow/{cashflow_id}")
async def delete_cashflow(cashflow_id: int):
    before = len(cashflow)
    cashflow[:] = [c for c in cashflow if int(c.get("id", 0)) != cashflow_id]
    deleted = before - len(cashflow)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cashflow row not found")
    save_data()
    return {"deleted": deleted}

@app.get("/cash-accounts")
async def api_cash_accounts(profile_id: Optional[str] = None):
    fx_data = await market.fx_rates("EUR")
    rates = fx_data.get("rates", {})
    return [{**c, "balance_eur": eur(c["balance"], c["currency"], rates)} for c in cash_accounts if not profile_id or c["profile_id"] == profile_id]

@app.post("/cash-accounts")
async def create_cash_account(c: CashAccountIn):
    ensure_profile(c.profile_id)
    if not c.name.strip():
        raise HTTPException(status_code=422, detail="Cash account name is required")
    row = c.model_dump()
    row["id"] = next_numeric_id(cash_accounts)
    cash_accounts.append(row)
    save_data()
    return row

@app.patch("/cash-accounts/{account_id}")
async def update_cash_account(account_id: int, c: CashAccountUpdate):
    row = next((x for x in cash_accounts if int(x.get("id", 0)) == account_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Cash account not found")
    data = c.model_dump(exclude_unset=True)
    if "delta" in data and data["delta"] is not None:
        row["balance"] = round(float(row.get("balance", 0) or 0) + float(data["delta"]), 2)
        data.pop("delta")
    for k, v in data.items():
        if v is not None:
            row[k] = v
    save_data()
    return row

@app.delete("/cash-accounts/{account_id}")
async def delete_cash_account(account_id: int):
    before = len(cash_accounts)
    cash_accounts[:] = [c for c in cash_accounts if int(c.get("id", 0)) != account_id]
    deleted = before - len(cash_accounts)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cash account not found")
    save_data()
    return {"deleted": deleted}

@app.get("/alerts")
async def api_alerts():
    rows = await enriched_assets(True)
    by_symbol = {x["symbol"].upper(): x for x in rows}
    return [{**a, "asset": by_symbol.get(a["symbol"].upper()), "triggered": alert_state(by_symbol.get(a["symbol"].upper(), {"symbol": a["symbol"], "price": 0}))} for a in alerts]

@app.post("/alerts")
async def create_alert(a: AlertIn):
    symbol = a.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=422, detail="Symbol is required")
    row = a.model_dump()
    row["symbol"] = symbol
    row["id"] = next_numeric_id(alerts)
    alerts.append(row)
    save_data()
    return row

@app.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int):
    before = len(alerts)
    alerts[:] = [a for a in alerts if int(a.get("id", 0)) != alert_id]
    deleted = before - len(alerts)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
    save_data()
    return {"deleted": deleted}

@app.get("/savings-plans")
async def api_savings_plans(profile_id: Optional[str] = None):
    fx_data = await market.fx_rates("EUR")
    rates = fx_data.get("rates", {})
    out = []
    for s in savings_plans:
        if profile_id and s["profile_id"] != profile_id:
            continue
        target_eur = eur(s["target"], s["currency"], rates)
        current_eur = eur(s["current"], s["currency"], rates)
        progress = round((current_eur / target_eur * 100), 1) if target_eur else 0
        monthly_eur = eur(s.get("monthly", 0), s["currency"], rates)
        months_left = max(round((target_eur-current_eur)/monthly_eur), 0) if monthly_eur else None
        out.append({**s, "target_eur": target_eur, "current_eur": current_eur, "progress": progress, "months_left": months_left})
    return out

@app.post("/savings-plans")
async def create_savings_plan(s: SavingsPlanIn):
    ensure_profile(s.profile_id)
    if not s.name.strip():
        raise HTTPException(status_code=422, detail="Savings plan name is required")
    row = s.model_dump()
    row["id"] = next_numeric_id(savings_plans)
    savings_plans.append(row)
    save_data()
    return row

@app.delete("/savings-plans/{plan_id}")
async def delete_savings_plan(plan_id: int):
    before = len(savings_plans)
    savings_plans[:] = [s for s in savings_plans if int(s.get("id", 0)) != plan_id]
    deleted = before - len(savings_plans)
    if not deleted:
        raise HTTPException(status_code=404, detail="Savings plan not found")
    save_data()
    return {"deleted": deleted}

COUNTRY_ALIASES = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states": "US", "america": "US",
    "united kingdom": "UK", "u.k.": "UK", "great britain": "UK", "england": "UK", "scotland": "UK",
    "uae": "UAE", "united arab emirates": "UAE",
    "bharat": "India", "republic of india": "India",
    "deutschland": "Germany", "nederland": "Netherlands", "holland": "Netherlands",
    "schweiz": "Switzerland", "suisse": "Switzerland",
    "korea": "South Korea", "republic of korea": "South Korea",
}
def canonical_country(name):
    n = (name or "").strip()
    if not n:
        return "Global"
    return COUNTRY_ALIASES.get(n.lower(), n)

@app.get("/allocations")
async def allocations(profile_id: Optional[str] = None):
    h = await live_holdings(profile_id); p = await live_properties(profile_id)
    groups = {"by_type":{}, "by_country":{}, "by_sector":{}, "by_broker":{}}
    for x in h:
        groups["by_type"][x["type"]] = groups["by_type"].get(x["type"],0)+x["value_eur"]
        c = canonical_country(x["country"])
        groups["by_country"][c] = groups["by_country"].get(c,0)+x["value_eur"]
        groups["by_sector"][x["sector"]] = groups["by_sector"].get(x["sector"],0)+x["value_eur"]
        groups["by_broker"][x["broker"]] = groups["by_broker"].get(x["broker"],0)+x["value_eur"]
    for x in p:
        groups["by_type"][x["category"]] = groups["by_type"].get(x["category"],0)+x["value_eur"]
        country = canonical_country(x["location"].split(",")[-1].strip())
        groups["by_country"][country] = groups["by_country"].get(country,0)+x["value_eur"]
    return {k:[{"name":n,"value":round(v,2)} for n,v in d.items()] for k,d in groups.items()}

MARKET_SEARCH_ALIASES = {
    "NSE": {"NSE", "NSI", "NSEI"},
    "BSE": {"BSE", "BOM"},
    "XETRA": {"XETRA", "GER", "DE"},
    "FWB": {"FWB", "FRA", "F"},
    "LSE": {"LSE", "LON"},
    "NASDAQ": {"NASDAQ", "NMS", "NGM", "NCM"},
    "NYSE": {"NYSE", "NYQ"},
    "AMEX": {"AMEX", "ASE"},
    "TSX": {"TSX", "TOR"},
    "TSXV": {"TSXV", "VAN"},
    "PAR": {"PAR", "EPA"},
    "AMS": {"AMS", "AEX"},
    "MIL": {"MIL", "MILAN"},
    "SIX": {"SIX", "SWX"},
    "TSE": {"TSE", "JPX", "TYO"},
    "HKEX": {"HKEX", "HKG"},
    "ASX": {"ASX", "ASX"},
    "MFINDIA": {"MFINDIA"},
    "BONDINDIA": {"BONDINDIA"},
}

def market_matches(row, market_code):
    market_code = (market_code or "").upper()
    if not market_code or market_code in {"ALL", "GLOBAL"}:
        return True
    wanted = MARKET_SEARCH_ALIASES.get(market_code, {market_code})
    row_market = (row.get("market") or "").upper()
    row_name = (row.get("market_name") or "").upper()
    yahoo = (row.get("yahoo") or row.get("symbol") or "").upper()
    meta = market_by_code(market_code)
    suffix = (meta.get("suffix") or "").upper()
    return (
        row_market in wanted
        or any(alias and alias in row_name for alias in wanted)
        or (suffix and yahoo.endswith(suffix))
        or (meta.get("country") and row.get("country") == meta.get("country") and market_code not in {"NSE", "BSE"})
    )

def filter_market_rows(rows, market_code):
    market_code = (market_code or "").upper()
    if not market_code or market_code in {"ALL", "GLOBAL"}:
        return rows
    return [r for r in rows if market_matches(r, market_code)]

_CRYPTO_HINTS = ("coin", "crypto", "token", "bitcoin", "ethereum", "solana", "dogecoin",
                 "cardano", "ripple", "btc", "eth", "sol", "xrp", "usdt", "usdc", "-usd")

def search_score(a, query, terms):
    hay = f"{a.get('symbol','')} {a.get('yahoo','')} {a.get('scheme_code','')} {a.get('isin_growth','')} {a.get('isin_reinvestment','')} {a.get('name','')} {a.get('type','')} {a.get('sector','')} {a.get('category','')} {a.get('country','')} {a.get('market','')} {a.get('market_name','')}".lower()
    symbol = str(a.get("symbol", "")).lower()
    yahoo = str(a.get("yahoo", "")).lower()
    name = str(a.get("name", "")).lower()
    base_sym = symbol.split("-")[0].split(".")[0]  # strip -USD / .NS so RELIANCE matches RELIANCE.NS
    score = 0
    if query in (symbol, yahoo, base_sym):
        score += 2000
    elif symbol.startswith(query) or yahoo.startswith(query) or base_sym.startswith(query):
        score += 700
    if name == query:
        score += 1400
    elif name.startswith(query):
        score += 520
    elif query in name:
        score += 320
    if query in hay:
        score += 180
    score += sum(50 for t in terms if t in hay)
    if all(t in hay for t in terms):
        score += 220
    # Live, tradeable assets (a real quote came back) rank far above name-only listings
    if a.get("price"):
        score += 650
    if a.get("source") == "Yahoo search":
        score += 40
    if a.get("source") == "MFAPI India master":
        score += 60
    # Demote crypto unless the user is clearly searching for crypto — keeps "Tesla AI USD"
    # below the real TSLA stock, while a search for "bitcoin"/"BTC" still surfaces coins.
    cryptoish = any(w in query for w in _CRYPTO_HINTS)
    if a.get("type") == "Crypto" and not cryptoish:
        score -= 500
    india_amcs = {"sbi", "icici", "hdfc", "axis", "kotak", "nippon", "uti", "motilal", "quant", "tata", "aditya", "bandhan", "invesco", "mirae", "parag", "canara", "edelweiss", "franklin", "dsp"}
    if query in india_amcs:
        if a.get("type") in {"Mutual Fund", "ETF"} and a.get("country") == "India":
            score += 1200
        elif a.get("country") != "India":
            score -= 700
    if a.get("type") in {"Stock", "ETF", "Mutual Fund", "Crypto"}:
        score += 30
    return score

@app.get("/markets/movers")
async def movers(market_code: Optional[str] = None):
    rows = await enriched_assets(True)
    rows = filter_market_rows(rows, market_code)
    return {"top_gainers": sorted(rows, key=lambda x:x.get("day",0), reverse=True)[:50], "top_losers": sorted(rows, key=lambda x:x.get("day",0))[:50], "all": sorted(rows, key=lambda x:abs(x.get("day",0)), reverse=True)[:100]}

@app.get("/markets/global-top")
async def global_top(market_code: Optional[str] = None):
    rows = await enriched_assets(True)
    universe_order = {x["symbol"].upper(): i for i, x in enumerate(global_universe)}
    universe_symbols = set(universe_order)
    rows = [r for r in rows if r["symbol"].upper() in universe_symbols]
    rows = filter_market_rows(rows, market_code)
    return {
        "valuable": sorted(rows, key=lambda x: universe_order.get(x["symbol"].upper(), 999))[:50],
        "gainers": sorted(rows, key=lambda x:x.get("day",0), reverse=True)[:50],
        "losers": sorted(rows, key=lambda x:x.get("day",0))[:50],
        "coins": [r for r in rows if r.get("type") == "Crypto"][:50],
    }

# Curated major-company lists for exchanges that have NO free full directory feed.
# (symbol, name, type) — yahoo symbol is built with the exchange suffix.
_CURATED_GROUPS = {
    "DE": {"suffix": ".DE", "currency": "EUR", "country": "Germany", "name": "Frankfurt / XETRA", "rows": [
        ("SAP","SAP","Stock"),("SIE","Siemens","Stock"),("ALV","Allianz","Stock"),("DTE","Deutsche Telekom","Stock"),
        ("AIR","Airbus","Stock"),("MBG","Mercedes-Benz Group","Stock"),("BMW","BMW","Stock"),("MUV2","Munich Re","Stock"),
        ("IFX","Infineon","Stock"),("BAS","BASF","Stock"),("BAYN","Bayer","Stock"),("DB1","Deutsche Boerse","Stock"),
        ("DBK","Deutsche Bank","Stock"),("VOW3","Volkswagen","Stock"),("RWE","RWE","Stock"),("EOAN","E.ON","Stock"),
        ("ADS","Adidas","Stock"),("DHL","DHL Group","Stock"),("HEN3","Henkel","Stock"),("MRK","Merck KGaA","Stock"),
        ("VNA","Vonovia","Stock"),("HNR1","Hannover Re","Stock"),("RHM","Rheinmetall","Stock"),("SHL","Siemens Healthineers","Stock"),
        ("SY1","Symrise","Stock"),("FRE","Fresenius","Stock"),("BEI","Beiersdorf","Stock"),("DTG","Daimler Truck","Stock"),
        ("P911","Porsche AG","Stock"),("PAH3","Porsche SE","Stock"),("QIA","Qiagen","Stock"),("ZAL","Zalando","Stock"),
        ("CBK","Commerzbank","Stock"),("HEI","Heidelberg Materials","Stock"),("BNR","Brenntag","Stock"),("SRT3","Sartorius","Stock"),
        ("1COV","Covestro","Stock"),("ENR","Siemens Energy","Stock"),("MTX","MTU Aero Engines","Stock"),("CON","Continental","Stock"),
        ("VWCE","Vanguard FTSE All-World (Acc)","ETF"),("VUAA","Vanguard S&P 500 (Acc)","ETF"),
        ("VUSA","Vanguard S&P 500 (Dist)","ETF"),("EUNL","iShares Core MSCI World (Acc)","ETF"),
        ("SXR8","iShares Core S&P 500 (Acc)","ETF"),("XDWD","Xtrackers MSCI World","ETF"),
        ("IS3N","iShares Core MSCI EM IMI (Acc)","ETF"),("IUSQ","iShares MSCI ACWI (Acc)","ETF"),
        ("SXRV","iShares Nasdaq 100 (Acc)","ETF"),("EXXT","iShares Nasdaq 100 (Dist)","ETF"),
        ("VFEM","Vanguard FTSE Emerging Markets","ETF"),("EUNM","iShares MSCI Emerging Markets","ETF")]},
    "UK": {"suffix": ".L", "currency": "GBP", "country": "UK", "name": "London Stock Exchange", "rows": [
        ("HSBA","HSBC Holdings","Stock"),("BP","BP","Stock"),("SHEL","Shell","Stock"),("AZN","AstraZeneca","Stock"),
        ("ULVR","Unilever","Stock"),("GSK","GSK","Stock"),("RIO","Rio Tinto","Stock"),("GLEN","Glencore","Stock"),
        ("DGE","Diageo","Stock"),("BATS","British American Tobacco","Stock"),("LSEG","London Stock Exchange Group","Stock"),
        ("REL","RELX","Stock"),("NG","National Grid","Stock"),("VOD","Vodafone","Stock"),("BARC","Barclays","Stock"),
        ("LLOY","Lloyds Banking Group","Stock"),("NWG","NatWest Group","Stock"),("PRU","Prudential","Stock"),
        ("TSCO","Tesco","Stock"),("AAL","Anglo American","Stock"),("RKT","Reckitt Benckiser","Stock"),("RR","Rolls-Royce","Stock"),
        ("BA","BAE Systems","Stock"),("CPG","Compass Group","Stock"),("EXPN","Experian","Stock"),("IMB","Imperial Brands","Stock"),
        ("STAN","Standard Chartered","Stock"),("AV","Aviva","Stock"),("LGEN","Legal & General","Stock"),("SSE","SSE","Stock"),
        ("HLN","Haleon","Stock"),("ABF","Associated British Foods","Stock"),("ANTO","Antofagasta","Stock"),("WTB","Whitbread","Stock")]},
    "FR": {"suffix": ".PA", "currency": "EUR", "country": "France", "name": "Euronext Paris", "rows": [
        ("MC","LVMH","Stock"),("OR","L'Oreal","Stock"),("TTE","TotalEnergies","Stock"),("SAN","Sanofi","Stock"),
        ("SU","Schneider Electric","Stock"),("AI","Air Liquide","Stock"),("BNP","BNP Paribas","Stock"),("EL","EssilorLuxottica","Stock"),
        ("CS","AXA","Stock"),("DG","Vinci","Stock"),("RMS","Hermes","Stock"),("SAF","Safran","Stock"),("KER","Kering","Stock"),
        ("BN","Danone","Stock"),("STLAP","Stellantis","Stock"),("ENGI","Engie","Stock"),("CAP","Capgemini","Stock"),
        ("ACA","Credit Agricole","Stock"),("GLE","Societe Generale","Stock"),("ORA","Orange","Stock"),("VIE","Veolia","Stock"),
        ("PUB","Publicis","Stock"),("ML","Michelin","Stock"),("RI","Pernod Ricard","Stock"),("HO","Thales","Stock"),
        ("LR","Legrand","Stock"),("SGO","Saint-Gobain","Stock"),("CA","Carrefour","Stock"),("DSY","Dassault Systemes","Stock")]},
}
_CURATED_MAP = {"XETRA": "DE", "FWB": "DE", "LSE": "UK", "AIM": "UK", "PAR": "FR"}
# Our market code -> Finnhub exchange code (used only if a Finnhub key is configured).
_FINNHUB_EX = {"XETRA": "DE", "FWB": "F", "LSE": "L", "AIM": "L", "PAR": "PA", "AMS": "AS", "BRU": "BR",
               "LIS": "LS", "MIL": "MI", "MAD": "MC", "SIX": "SW", "STO": "ST", "CPH": "CO", "HEL": "HE",
               "OSL": "OL", "WSE": "WA", "VIE": "VI", "ATH": "AT", "IST": "IS", "TSE": "T", "HKEX": "HK",
               "SSE": "SS", "SZSE": "SZ", "TWSE": "TW", "KRX": "KS", "SGX": "SI", "IDX": "JK", "SET": "BK",
               "MYX": "KL", "PSE": "PS", "TSX": "TO", "TSXV": "V", "BMV": "MX", "BSE": "BO"}

@app.get("/exchange/listings")
async def exchange_listings(market_code: str = "NASDAQ", q: str = "", offset: int = 0, limit: int = 50):
    """Browse EVERY share/fund listed on an exchange. Lists come from each market's own
    public directory (Nasdaq Trader, NSE archives, CoinGecko, AMFI). Prices for the visible
    page are filled from cache; opening a row pulls the full live quote."""
    m = (market_code or "").upper()
    coverage = "full"
    if m in ("CRYPTO", "CCC", "COIN"):
        items = await market.coin_markets()
        m = "CRYPTO"
    elif m in ("MFINDIA", "MF", "AMFI"):
        items = []
        for x in await india_mutual_fund_master():
            row = dict(x)
            row.setdefault("type", "Mutual Fund"); row.setdefault("market", "MFINDIA")
            row.setdefault("currency", "INR"); row.setdefault("country", "India")
            items.append(row)
        m = "MFINDIA"
    elif m in ("NASDAQ", "NYSE", "AMEX", "NSE", "BSE"):
        items = await market.exchange_listings(m)
    elif m in _CURATED_MAP:
        g = _CURATED_GROUPS[_CURATED_MAP[m]]
        items = [{"symbol": s, "yahoo": f"{s}{g['suffix']}", "name": n, "type": t, "market": m,
                  "market_name": g["name"], "country": g["country"], "currency": g["currency"]}
                 for (s, n, t) in g["rows"]]
        coverage = "major"
    else:
        items = []
    # No built-in list yet: try Finnhub's symbol directory if the user added a key.
    if not items and m in _FINNHUB_EX:
        items = await market.finnhub_listings(m, _FINNHUB_EX[m])
        if items:
            coverage = "full"
    # Last resort: our curated universe + the user's own holdings, de-duped & currency-fixed.
    if not items:
        meta = market_by_code(m)
        seen = {}
        for x in (list(global_universe) + list(watchlist) + list(assets)):
            if not filter_market_rows([x], m):
                continue
            sym = str(x.get("symbol", "")).upper()
            if not sym or sym in seen:
                continue
            r = dict(x)
            r["currency"] = (meta.get("currency") or r.get("currency") or "")
            r["market"] = m
            seen[sym] = r
        items = list(seen.values())
        coverage = "limited"
    ql = (q or "").strip().lower()
    if ql:
        items = [x for x in items if ql in str(x.get("symbol", "")).lower() or ql in str(x.get("name", "")).lower()]
    total = len(items)
    limit = max(1, min(int(limit or 50), 100))
    offset = max(0, int(offset or 0))
    page = items[offset:offset + limit]
    for a in page:
        if not a.get("price"):
            cq = market.cached_quote(a.get("yahoo") or a.get("symbol"))
            if cq and cq.get("price"):
                a["price"] = cq["price"]; a["day"] = cq.get("day", 0)
                a["currency"] = cq.get("currency", a.get("currency", ""))
    return {"market": m, "coverage": coverage, "total": total, "offset": offset, "limit": limit, "count": len(page), "items": page}

@app.post("/search")
async def search(s: SearchIn):
    # Cheap metadata catalog (NO live pricing of the whole universe — that made search
    # spike to 10s+). Matched results get live prices from cache + on-open instead.
    rows, _seen = [], set()
    for item in list(assets) + list(watchlist) + list(global_universe):
        k = (item.get("symbol", "").upper(), item.get("yahoo", "").upper())
        if k in _seen:
            continue
        _seen.add(k)
        rows.append(dict(item))
    fund_rows = list(funds_bonds_india) + await india_mutual_fund_master()
    rows = rows + [dict(r, price=0, day=r.get("one_year", r.get("yield", 0)), week=0, month=0, year=r.get("three_year", r.get("one_year", 0)), source=r.get("source","Funds/Bonds catalog")) for r in fund_rows]
    q = s.query.lower()
    terms = [x for x in q.split() if x]
    if q in {"google", "alphabet"}:
        rows.extend([
            {"symbol":"GOOGL","yahoo":"GOOGL","name":"Alphabet Class A / Google","type":"Stock","sector":"Technology","country":"US","market":"NASDAQ","currency":"USD","source":"Search alias"},
            {"symbol":"GOOG","yahoo":"GOOG","name":"Alphabet Class C / Google","type":"Stock","sector":"Technology","country":"US","market":"NASDAQ","currency":"USD","source":"Search alias"},
        ])
    rows.extend(await market.search_symbols(s.query))
    rows = filter_market_rows(rows, s.market)
    def matches(a):
        hay = f"{a.get('symbol','')} {a.get('scheme_code','')} {a.get('isin_growth','')} {a.get('isin_reinvestment','')} {a.get('name','')} {a.get('type','')} {a.get('sector','')} {a.get('category','')} {a.get('country','')} {a.get('market','')} {a.get('market_name','')}".lower()
        return q in hay or all(t in hay for t in terms)
    out = []
    seen = set()
    for a in rows:
        if not matches(a):
            continue
        key = (a.get("symbol","").upper(), a.get("yahoo","").upper())
        if key in seen:
            continue
        seen.add(key)
        out.append(a)
    out.sort(key=lambda a: search_score(a, q, terms), reverse=True)
    out = out[:120]
    # Enrich only already-cached top matches with a live quote (no network calls here —
    # we read the in-memory cache so the dropdown shows real-time prices without slowing
    # type-ahead). Anything not yet cached still prices instantly when the user opens it.
    _FIELDS = ("price", "day", "week", "month", "year", "year_low", "year_high", "source")
    for a in out[:8]:
        if a.get("price") or a.get("type") in ("Mutual Fund", "Bond"):
            continue
        cached_q = market.cached_quote(a.get("yahoo") or a.get("symbol"))
        if cached_q and cached_q.get("price"):
            a.update({k: cached_q[k] for k in _FIELDS if k in cached_q})
    out.sort(key=lambda a: search_score(a, q, terms), reverse=True)
    return out[:120]

@app.get("/asset/{symbol}")
async def asset_detail(symbol: str):
    a = await resolve_asset(symbol)
    if not a:
        return {"error":"not found"}
    def tag_news(items):
        return [
            {**n, "symbol": a.get("symbol"), "category": a.get("sector") or a.get("type") or "Market",
             "area": a.get("country") or "Market", "sentiment": "Positive" if a.get("day", 0) >= 0 else "Negative"}
            for n in items if not n.get("placeholder")
        ]
    news = tag_news(await market.yahoo_rss_news(a.get("yahoo") or a.get("symbol")))
    if len(news) < 3:
        name = a.get("name") or a.get("symbol")
        seen = {n.get("url") for n in news}
        news += [n for n in tag_news(await google_news_rows(name, a.get("country") or "Market", 9)) if n.get("url") not in seen]
    if not news:
        news = await market.news(a.get("yahoo") or a["symbol"], a.get("type", "Stock"))
    return {
        "asset": a,
        "movement_explanation": movement_reason(a),
        "why_up_or_down": movement_reason(a),
        "fundamentals": asset_fundamentals(a),
        "news": news,
        "analyst_view": analyst_review(a),
        "alerts": alert_state(a),
        "portfolio_context": {
            "owned": a.get("qty", 0) > 0,
            "daily_impact_eur": a.get("daily_eur", 0),
            "weight_hint": "Core position" if a.get("value_eur",0) > 5000 else "Satellite/watchlist position",
            "action_ideas": ["Check if position size matches your risk limit", "Compare day move with month/year trend", "Read latest company/news links before buying more", "Set a price alert for your target entry or exit"],
        }
    }

@app.get("/asset-detail")
async def asset_detail_query(symbol: str):
    return await asset_detail(symbol)

@app.get("/asset/{symbol}/history")
async def asset_history(symbol: str, range_: str = "1y"):
    a = await resolve_asset(symbol)
    yahoo = a.get("yahoo") if a else symbol
    return await market.history(yahoo or symbol, range_)

@app.get("/asset-history")
async def asset_history_query(symbol: str, range_: str = "1y"):
    return await asset_history(symbol, range_)

@app.get("/brokers/status")
def broker_status():
    return brokers.statuses()

@app.get("/brokers/details")
def get_broker_details(profile_id: Optional[str] = None):
    return [b for b in broker_details if not profile_id or b.get("profile_id") == profile_id]

@app.post("/brokers/details")
def save_broker_detail(d: BrokerDetailIn):
    ensure_profile(d.profile_id)
    row = d.model_dump()
    existing = next((b for b in broker_details if b.get("profile_id") == row["profile_id"] and b.get("broker", "").lower() == row["broker"].lower()), None)
    if existing:
        existing.update(row)
        out = existing
    else:
        row["id"] = next_numeric_id(broker_details)
        broker_details.append(row)
        out = row
    save_data()
    return out

@app.delete("/brokers/details/{detail_id}")
def delete_broker_detail(detail_id: int):
    before = len(broker_details)
    broker_details[:] = [b for b in broker_details if int(b.get("id", 0)) != detail_id]
    if len(broker_details) == before:
        raise HTTPException(status_code=404, detail="Broker detail not found")
    save_data()
    return {"deleted": before - len(broker_details)}

# --------------------------------------------------------------------------- #
# Broker connect / live sync / universal CSV import                           #
# --------------------------------------------------------------------------- #
class BrokerConnectIn(BaseModel):
    broker: str
    creds: dict = {}

class BrokerImportIn(BaseModel):
    profile_id: str = ""
    broker: str = "CSV import"
    csv: str = ""
    asset_type: str = ""   # optional: force all rows to this type (e.g. "Mutual Fund")

def _default_profile_id():
    self_p = next((p for p in profiles if str(p.get("relation", "")).lower() == "self"), None)
    return (self_p or (profiles[0] if profiles else {"id": "001"}))["id"]

def _num(s):
    """Parse a money/quantity string: strips currency symbols, commas, %, spaces."""
    if s is None:
        return 0.0
    t = re.sub(r"[^0-9.\-]", "", str(s).replace(",", ""))
    try:
        return float(t) if t not in ("", "-", ".", "-.") else 0.0
    except ValueError:
        return 0.0

def _reject_future(date_str="", year=0, label="Date"):
    """Raise 422 if a 'bought'/'as-of' date or year is in the future or absurd."""
    today = date.today()
    if date_str:
        try:
            d = date.fromisoformat(str(date_str)[:10])
        except Exception:
            d = None
        if d and d > today:
            raise HTTPException(status_code=422, detail=f"{label} can't be in the future ({d.isoformat()}). Today is {today.isoformat()}.")
        if d and d.year < 1900:
            raise HTTPException(status_code=422, detail=f"{label} looks wrong ({d.isoformat()}).")
    if year:
        try:
            y = int(year)
        except Exception:
            y = 0
        if y and y > today.year:
            raise HTTPException(status_code=422, detail=f"{label} year can't be in the future ({y}). Current year is {today.year}.")
        if y and y < 1900:
            raise HTTPException(status_code=422, detail=f"{label} year looks wrong ({y}).")

def _validate_property(p):
    """Shared validation for create + edit of a property/asset."""
    _reject_future(p.purchase_date, p.purchase_year, "Bought / purchase date")
    _reject_future(p.valuation_date, 0, "Valuation date")
    if float(p.value or 0) < 0 or float(p.purchase_value or 0) < 0:
        raise HTTPException(status_code=422, detail="Value and bought price can't be negative.")
    if p.category in {"Physical Gold", "Physical Silver"} and float(p.quantity or 0) <= 0:
        raise HTTPException(status_code=422, detail=f"Enter the weight (grams/tola/oz) for {p.category}.")
    if p.category == "Diamond" and float(p.quantity or 0) <= 0:
        raise HTTPException(status_code=422, detail="Enter the carat weight for the diamond.")
    if p.category == "FD":
        try:
            sd = date.fromisoformat((p.purchase_date or "")[:10]) if p.purchase_date else None
            md = date.fromisoformat((p.maturity_date or "")[:10]) if p.maturity_date else None
            if sd and md and md < sd:
                raise HTTPException(status_code=422, detail="FD maturity date must be after the start date.")
        except HTTPException:
            raise
        except Exception:
            pass

def _guess_market(d):
    if d.get("market"):
        return d["market"]
    t = (d.get("type") or "").lower(); cur = (d.get("currency") or "").upper(); ctry = d.get("country") or ""
    if "crypto" in t or "coin" in t or cur in {"BTC", "ETH", "USDT"}:
        return "CRYPTO"
    if ctry == "India" or cur == "INR":
        return "NSE"
    if ctry in {"US", "United States"} or cur == "USD":
        return "NASDAQ"
    if ctry == "Germany" or cur == "EUR":
        return "XETRA"
    if ctry == "UK" or cur in {"GBP", "GBP."}:
        return "LSE"
    return "GLOBAL"

def _import_holding_row(d, profile_id, broker_name):
    """Create or update a holding from a normalized {symbol,name,qty,avg,price,...} dict."""
    symbol = str(d.get("symbol", "")).strip().upper()
    if not symbol or float(d.get("qty") or 0) <= 0:
        return None
    market_meta = market_by_code(_guess_market(d))
    suffix = market_meta.get("suffix", "")
    yahoo = d.get("yahoo") or (symbol if (not suffix or symbol.endswith(suffix)) else f"{symbol}{suffix}")
    row = {
        "symbol": symbol,
        "name": d.get("name") or symbol,
        "type": d.get("type") or "Stock",
        "currency": (d.get("currency") or market_meta["currency"]),
        "sector": d.get("sector") or "Other",
        "country": d.get("country") or market_meta["country"],
        "market": market_meta["code"],
        "profile_id": profile_id,
        "qty": float(d.get("qty") or 0),
        "avg": float(d.get("avg") or 0),
        "price": float(d.get("price") or 0),
        "broker": broker_name,
        "yahoo": yahoo,
        "dividend_yield": 0,
    }
    existing = next((a for a in assets if a.get("symbol", "").upper() == symbol and a.get("profile_id") == profile_id), None)
    if existing:
        existing.update(row)
        return ("updated", existing)
    assets.append(row)
    return ("imported", row)

async def _broker_pull(broker: str):
    b = broker.lower()
    if "trading" in b:
        return await brokers.trading212_positions()
    if "ibkr" in b or "interactive" in b:
        return await brokers.ibkr_positions()
    if "coinbase" in b:
        return await brokers.coinbase_accounts()
    if "zerodha" in b or "kite" in b or "coin" in b:
        return await brokers.zerodha_holdings()
    return {"status": "import_required",
            "message": "This broker has no public retail API — use CSV import below.", "items": []}

@app.post("/brokers/connect")
async def brokers_connect(body: BrokerConnectIn):
    key = body.broker.strip().lower()
    clean = {k: str(v).strip() for k, v in (body.creds or {}).items() if str(v).strip()}
    if not clean:
        raise HTTPException(status_code=422, detail="Provide at least one credential field.")
    broker_credentials[key] = {**(broker_credentials.get(key) or {}), **clean}
    save_data()
    test = await _broker_pull(key)
    ok = test.get("status") == "ok"
    return {"status": "saved", "connected": ok, "connection": test.get("status"),
            "message": test.get("message", "Credentials saved." if ok else "Saved, but live test did not return data yet."),
            "positions": len(test.get("items", []))}

@app.post("/brokers/disconnect/{broker}")
async def brokers_disconnect(broker: str):
    broker_credentials.pop(broker.strip().lower(), None)
    save_data()
    return {"status": "disconnected"}

@app.post("/brokers/sync/{broker}")
async def sync_broker(broker: str, profile_id: Optional[str] = None):
    raw = await _broker_pull(broker)
    if raw.get("status") != "ok":
        return {**raw, "imported": 0, "updated": 0}
    pid = profile_id or _default_profile_id()
    ensure_profile(pid)
    norm = brokers.normalize_positions(broker, raw.get("items", []))
    imported = updated = 0
    for d in norm:
        res = _import_holding_row(d, pid, broker.title())
        if res and res[0] == "imported":
            imported += 1
        elif res:
            updated += 1
    save_data()
    return {"status": "ok", "imported": imported, "updated": updated, "positions": len(norm)}

@app.post("/brokers/import-csv")
async def brokers_import_csv(body: BrokerImportIn):
    import csv as _csv, io as _io
    pid = body.profile_id or _default_profile_id()
    ensure_profile(pid)
    text = (body.csv or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="Paste or upload a CSV first.")
    # sniff delimiter (comma / semicolon / tab)
    delim = ","
    first = text.splitlines()[0]
    for d in [",", ";", "\t"]:
        if first.count(d) > first.count(delim):
            delim = d
    rows = [r for r in _csv.reader(_io.StringIO(text), delimiter=delim) if any(c.strip() for c in r)]
    if len(rows) < 2:
        return {"status": "error", "message": "CSV needs a header row and at least one data row.", "imported": 0, "updated": 0, "skipped": 0}
    header = [h.strip().lower() for h in rows[0]]

    def find(aliases):
        for a in aliases:
            if a in header:
                return header.index(a)
        for i, h in enumerate(header):
            if any(a in h for a in aliases):
                return i
        return -1

    ci_sym = find(["symbol", "ticker", "tradingsymbol", "scrip", "instrument code", "instrument", "stock"])
    ci_name = find(["company name", "name", "company", "security", "description"])
    ci_qty = find(["quantity", "qty", "shares", "units", "holding", "net qty"])
    ci_avg = find(["average price", "avg price", "buy price", "avg cost", "cost price", "purchase price", "buy avg", "avg.", "avg", "cost"])
    ci_price = find(["last price", "current price", "market price", "ltp", "cmp", "close price", "nav", "price"])
    ci_cur = find(["currency", "ccy"])
    ci_type = find(["instrument type", "asset type", "type", "segment", "category"])
    if ci_price == ci_avg:
        ci_price = -1
    if ci_sym < 0 and ci_name < 0:
        return {"status": "error", "message": "Could not find a symbol/ticker or name column in the CSV.", "imported": 0, "updated": 0, "skipped": 0}

    def g(r, i):
        return r[i].strip() if 0 <= i < len(r) else ""

    imported = updated = skipped = 0
    for r in rows[1:]:
        sym = g(r, ci_sym) or g(r, ci_name)
        qty = _num(g(r, ci_qty))
        if not sym or qty <= 0:
            skipped += 1
            continue
        d = {"symbol": sym, "name": g(r, ci_name) or sym, "qty": qty,
             "avg": _num(g(r, ci_avg)), "price": _num(g(r, ci_price)),
             "currency": g(r, ci_cur).upper(), "type": (body.asset_type or g(r, ci_type) or "Stock")}
        res = _import_holding_row(d, pid, body.broker or "CSV import")
        if res and res[0] == "imported":
            imported += 1
        elif res:
            updated += 1
        else:
            skipped += 1
    save_data()
    return {"status": "ok", "imported": imported, "updated": updated, "skipped": skipped, "profile_id": pid}

@app.get("/news-intelligence")
async def news_intelligence(profile_id: Optional[str] = None):
    rows = []
    for h in await live_holdings(profile_id):
        rows.append({"symbol":h["symbol"], "impact_score":round(min(abs(h["day"])*1.4+2,10),1), "sentiment":"Positive" if h["day"] >= 0 else "Negative", "summary":f"{h['name']} D:{h['day']}%, W:{h['week']}%, M:{h['month']}%, Y:{h['year']}%. Source: {h.get('source')}."})
    return rows

NEWS_TOPICS = {
    "top": ["global stock market", "business finance", "central bank interest rates", "earnings season", "commodities gold oil"],
    "world": ["US stock market", "Europe stock market", "India stock market", "China economy", "global bonds forex"],
    "area": ["India business markets", "Germany business markets", "United States markets", "European Union economy", "Middle East markets"],
    "sector": ["technology stocks", "defence stocks", "metals mining stocks", "banking financial stocks", "healthcare stocks", "energy stocks"],
    "industry": ["semiconductor industry", "electric vehicles industry", "artificial intelligence industry", "real estate industry", "mutual funds India", "crypto market"],
    "tech": ["artificial intelligence stocks", "semiconductor stocks", "cloud software stocks", "cybersecurity stocks", "big tech earnings"],
    "india": ["India stock market", "Nifty Sensex", "Indian mutual funds", "RBI interest rates", "India defence stocks"],
}

def _clean_domain(u: str) -> str:
    try:
        net = urlparse(u or "").netloc.lower()
        return net[4:] if net.startswith("www.") else net
    except Exception:
        return ""

def _clean_news_title(title: str, source: str) -> str:
    title = (title or "").strip()
    if source and title.endswith(f" - {source}"):
        title = title[: -(len(source) + 3)].strip()
    return title

async def google_news_rows(query: str, area: str, limit: int = 8):
    q = (query or "").strip()
    if not q:
        return []
    cache_key = f"news:{area}:{q.lower()}:{limit}"
    cached = LOCATION_CACHE.get(cache_key)
    if cached and time.time() - cached["ts"] < 900:
        return cached["data"]
    url = f"https://news.google.com/rss/search?q={quote_plus(q)}&hl=en-US&gl=US&ceid=US:en"
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
        root = ET.fromstring(r.text)
        rows = []
        for item in root.findall(".//item")[:limit]:
            link = (item.findtext("link") or "").strip()
            if not link:
                continue
            source_el = item.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else "Google News"
            source_url = source_el.get("url") if source_el is not None else ""
            domain = _clean_domain(source_url) or "news.google.com"
            title = _clean_news_title(item.findtext("title") or q, source)
            raw_desc = html.unescape(re.sub(r"<[^>]+>", " ", item.findtext("description") or ""))
            raw_desc = re.sub(r"\s+", " ", raw_desc).strip()
            if title and raw_desc.lower().startswith(title.lower()[:30]):
                raw_desc = raw_desc[len(title):]
            if source and raw_desc.startswith(source):
                raw_desc = raw_desc[len(source):]
            raw_desc = raw_desc.strip(" -–|·,")
            summary = raw_desc[:180] if len(raw_desc) >= 30 else ""
            rows.append({
                "symbol": "",
                "area": area,
                "category": q.title(),
                "headline": title,
                "summary": summary,
                "url": link,
                "source": source,
                "domain": domain,
                "published": item.findtext("pubDate") or "",
                "sentiment": "Monitor",
                "impact_score": 6.5,
                "placeholder": False,
            })
        LOCATION_CACHE[cache_key] = {"ts": time.time(), "data": rows}
        return rows
    except Exception:
        return []

@app.get("/news-center")
async def news_center(scope: str = "portfolio", query: str = "", profile_id: Optional[str] = None):
    scope = (scope or "portfolio").lower()
    query = (query or "").strip()
    rows = []
    if scope == "portfolio" and not query:
        holdings = await live_holdings(profile_id)
        async def for_holding(h):
            name = (h.get("name") or h.get("symbol") or "").strip()
            if not name:
                return []
            items = await market.yahoo_rss_news(h.get("yahoo") or h.get("symbol"))
            items = [n for n in items if not n.get("placeholder")][:4]
            if len(items) < 2:
                seen = {n.get("url") for n in items}
                items += [n for n in await google_news_rows(name, h.get("country") or "Portfolio", 4)
                          if not n.get("placeholder") and n.get("url") not in seen][:4]
            out = []
            for n in items:
                if n.get("placeholder"):
                    continue
                out.append({
                    **n,
                    "symbol": h["symbol"],
                    "category": h.get("sector") or h.get("type") or "Holding",
                    "area": h.get("country") or "Portfolio",
                    "sentiment": "Positive" if h.get("day", 0) >= 0 else "Negative",
                    "impact_score": round(min(abs(h.get("day", 0)) * 1.4 + 2, 10), 1),
                })
            return out
        batches = await asyncio.gather(*[for_holding(h) for h in holdings])
        for batch in batches:
            rows.extend(batch)
    else:
        topics = [query] if query else NEWS_TOPICS.get(scope, NEWS_TOPICS["top"])
        batches = await asyncio.gather(*[google_news_rows(t, scope, 8 if query else 6) for t in topics])
        for batch in batches:
            rows.extend(b for b in batch if not b.get("placeholder"))
    seen = set()
    deduped = []
    for n in rows:
        key = n.get("url")
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(n)
    return deduped[:80]

INSIDER_FALLBACK = [
    {"ticker":"WHF","owner":"BOLDUC JOHN","relationship":"Director","date":"Jun 04 '26","transaction":"Buy","cost":"6.88","shares":"7,140","value":"49,088","shares_total":"306,037","form_time":"Jun 05 09:45 PM","form_url":"https://www.sec.gov/","company":"WhiteHorse Finance Inc","industry":"Asset Management","country":"USA"},
    {"ticker":"WHF","owner":"BOLDUC JOHN","relationship":"Director","date":"Jun 05 '26","transaction":"Buy","cost":"6.76","shares":"7,140","value":"48,302","shares_total":"309,607","form_time":"Jun 05 09:45 PM","form_url":"https://www.sec.gov/","company":"WhiteHorse Finance Inc","industry":"Asset Management","country":"USA"},
    {"ticker":"DK","owner":"Sutil Vicky","relationship":"Director","date":"Jun 03 '26","transaction":"Sale","cost":"48.00","shares":"1,871","value":"89,808","shares_total":"29,368","form_time":"Jun 05 09:34 PM","form_url":"https://www.sec.gov/","company":"Delek US Holdings Inc","industry":"Oil & Gas","country":"USA"},
    {"ticker":"NTRA","owner":"Chapman Steven Leonard","relationship":"CEO AND PRESIDENT","date":"Jun 04 '26","transaction":"Sale","cost":"221.03","shares":"41,124","value":"9,089,776","shares_total":"108,743","form_time":"Jun 05 09:05 PM","form_url":"https://www.sec.gov/","company":"Natera Inc","industry":"Diagnostics & Research","country":"USA"},
    {"ticker":"ACMR","owner":"Cheav Sotheara","relationship":"See remarks","date":"Jun 05 '26","transaction":"Option Exercise","cost":"13.89","shares":"5,399","value":"74,992","shares_total":"105,401","form_time":"Jun 05 09:00 PM","form_url":"https://www.sec.gov/","company":"ACM Research Inc","industry":"Semiconductors","country":"USA"},
    {"ticker":"SITM","owner":"VASHIST RAJESH","relationship":"Chief Executive Officer","date":"Jun 03 '26","transaction":"Sale","cost":"701.13","shares":"30,000","value":"21,033,900","shares_total":"402,898","form_time":"Jun 05 08:54 PM","form_url":"https://www.sec.gov/","company":"SiTime Corp","industry":"Semiconductors","country":"USA"},
    {"ticker":"PAX","owner":"Neto Olimpio Matarazzo","relationship":"Director","date":"Jun 05 '26","transaction":"Buy","cost":"11.46","shares":"50,000","value":"573,000","shares_total":"235,000","form_time":"Jun 05 08:49 PM","form_url":"https://www.sec.gov/","company":"Patria Investments Ltd","industry":"Asset Management","country":"Cayman Islands"},
    {"ticker":"HOOD","owner":"Robinhood Markets, Inc.","relationship":"10% Owner","date":"Jun 04 '26","transaction":"Sale","cost":"41.92","shares":"69,607","value":"2,918,224","shares_total":"14,124,532","form_time":"Jun 05 08:48 PM","form_url":"https://www.sec.gov/","company":"Robinhood Markets Inc","industry":"Capital Markets","country":"USA"},
]

def numeric_value(text: str) -> float:
    try:
        return float(str(text or "0").replace(",", "").replace("$", "") or 0)
    except Exception:
        return 0

def parse_finviz_insiders(markup: str):
    rows = []
    for row_html in re.findall(r'<tr class="fv-insider-row[^"]*"[^>]*>(.*?)</tr>', markup, flags=re.S):
        tds = re.findall(r"<td\b([^>]*)>(.*?)</td>", row_html, flags=re.S)
        if len(tds) < 10:
            continue
        def clean(cell_html):
            return html.unescape(re.sub(r"<[^>]+>", "", cell_html)).strip()
        ticker_attrs = tds[0][0]
        company = html.unescape(re.search(r'data-boxover-company="([^"]*)"', ticker_attrs).group(1)) if re.search(r'data-boxover-company="([^"]*)"', ticker_attrs) else ""
        industry = html.unescape(re.search(r'data-boxover-industry="([^"]*)"', ticker_attrs).group(1)) if re.search(r'data-boxover-industry="([^"]*)"', ticker_attrs) else ""
        country = html.unescape(re.search(r'data-boxover-country="([^"]*)"', ticker_attrs).group(1)) if re.search(r'data-boxover-country="([^"]*)"', ticker_attrs) else ""
        form_match = re.search(r'href="([^"]+)"[^>]*>(.*?)</a>', tds[9][1], flags=re.S)
        rows.append({
            "ticker": clean(tds[0][1]),
            "owner": clean(tds[1][1]),
            "relationship": clean(tds[2][1]),
            "date": clean(tds[3][1]),
            "transaction": clean(tds[4][1]),
            "cost": clean(tds[5][1]),
            "shares": clean(tds[6][1]),
            "value": clean(tds[7][1]),
            "shares_total": clean(tds[8][1]),
            "form_time": clean(form_match.group(2)) if form_match else clean(tds[9][1]),
            "form_url": form_match.group(1) if form_match else "https://www.sec.gov/",
            "company": company,
            "industry": industry,
            "country": country,
        })
    return rows

@app.get("/insider-trading")
async def insider_trading(kind: str = "insiders", transaction: str = "all", query: str = "", limit: int = 120):
    kind = (kind or "insiders").lower()
    query = (query or "").strip().lower()
    tc = "1" if transaction == "buy" else "2" if transaction == "sell" else "7"
    rows = []
    if kind == "insiders":
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                r = await client.get("https://finviz.com/insidertrading.ashx", params={"tc": tc}, headers={"User-Agent":"Mozilla/5.0"})
                r.raise_for_status()
            rows = parse_finviz_insiders(r.text)
        except Exception:
            rows = []
        if not rows:
            rows = INSIDER_FALLBACK[:]
    else:
        source = await enriched_assets(True)
        rows = [{
            "ticker": a.get("symbol"),
            "owner": "Top 10% owner / fund flow" if kind == "funds" else "Manager accumulation screen",
            "relationship": "Fund" if kind == "funds" else "Manager",
            "date": datetime.utcnow().strftime("%b %d '%y"),
            "transaction": "Buy" if a.get("year", 0) >= 0 else "Sale",
            "cost": str(a.get("price", "")),
            "shares": "-",
            "value": f"{abs(int((a.get('value_eur') or 1000000) + (a.get('year') or 0)*10000)):,}",
            "shares_total": "-",
            "form_time": "Open research",
            "form_url": f"https://finviz.com/quote.ashx?t={quote_plus(a.get('symbol',''))}",
            "company": a.get("name", ""),
            "industry": a.get("sector", ""),
            "country": a.get("country", ""),
        } for a in source[:120]]
    if transaction == "buy":
        rows = [r for r in rows if "buy" in r.get("transaction","").lower()]
    elif transaction == "sell":
        rows = [r for r in rows if "sale" in r.get("transaction","").lower() or "sell" in r.get("transaction","").lower()]
    if query:
        rows = [r for r in rows if query in " ".join(str(v) for v in r.values()).lower()]
    for r in rows:
        r["numeric_value"] = numeric_value(r.get("value"))
        r["kind"] = kind
    return rows[:max(10, min(limit, 250))]

IPO_EXCHANGE_LINKS = {
    "NASDAQ": "https://www.nasdaq.com/market-activity/ipos",
    "NYSE": "https://www.nyse.com/ipo-center/filings",
    "NSE": "https://www.nseindia.com/market-data/all-upcoming-issues-ipo",
    "BSE": "https://www.bseindia.com/publicissue.html",
    "LSE": "https://www.londonstockexchange.com/raise-finance/recent-ipos",
    "HKEX": "https://www.hkex.com.hk/Listing/IPO-Information",
    "TSE": "https://www.jpx.co.jp/english/listing/stocks/new/index.html",
    "ASX": "https://www2.asx.com.au/markets/trade-our-cash-market/listings",
    "India IPOs (Chittorgarh)": "https://www.chittorgarh.com/ipo/ipo_dashboard.asp",
    "India IPOs (Moneycontrol)": "https://www.moneycontrol.com/ipo/",
}

def _ipo_search_url(name):
    return f"https://www.google.com/search?q={quote_plus((name or '') + ' IPO')}"

def sample_ipos():
    today = date.today()
    def d(off):
        return (today + timedelta(days=off)).isoformat()
    rows = [
        {"company": "Helios AI Cloud", "symbol": "HLAI", "exchange": "NASDAQ", "country": "US", "sector": "Technology", "status": "upcoming", "date": d(6), "price_range": "$18 - $20", "currency": "USD", "deal_size": "$240M"},
        {"company": "Brightline Mobility", "symbol": "BRTL", "exchange": "NYSE", "country": "US", "sector": "Automotive", "status": "upcoming", "date": d(12), "price_range": "$22 - $25", "currency": "USD", "deal_size": "$410M"},
        {"company": "Aarav Fintech", "symbol": "AARAV", "exchange": "NSE", "country": "India", "sector": "Finance", "status": "upcoming", "date": d(3), "price_range": "₹540 - ₹570", "currency": "INR", "deal_size": "₹1,200 Cr"},
        {"company": "Sahyadri Foods", "symbol": "SAHYAD", "exchange": "BSE", "country": "India", "sector": "Consumer", "status": "upcoming", "date": d(9), "price_range": "₹95 - ₹100", "currency": "INR", "deal_size": "₹320 Cr"},
        {"company": "Northwind Energy", "symbol": "NWND", "exchange": "LSE", "country": "UK", "sector": "Energy", "status": "upcoming", "date": d(15), "price_range": "£3.40 - £3.80", "currency": "GBP", "deal_size": "£250M"},
        {"company": "Pearl River Robotics", "symbol": "1899", "exchange": "HKEX", "country": "China", "sector": "Technology", "status": "upcoming", "date": d(20), "price_range": "HK$28 - HK$32", "currency": "HKD", "deal_size": "HK$3.1B"},
        {"company": "Outback Lithium", "symbol": "OBL", "exchange": "ASX", "country": "Australia", "sector": "Metals and Mining", "status": "upcoming", "date": d(25), "price_range": "A$1.80 - A$2.10", "currency": "AUD", "deal_size": "A$180M"},
        {"company": "NovaGen Bio", "symbol": "NVGB", "exchange": "NASDAQ", "country": "US", "sector": "Healthcare", "status": "upcoming", "date": d(18), "price_range": "$15 - $17", "currency": "USD", "deal_size": "$160M"},
        {"company": "Cortex Compute", "symbol": "CRTX", "exchange": "NASDAQ", "country": "US", "sector": "Technology", "status": "listed", "date": d(-10), "price_range": "$26 (listed)", "currency": "USD", "deal_size": "$520M"},
        {"company": "Meridian Capital Group", "symbol": "MRDN", "exchange": "NYSE", "country": "US", "sector": "Finance", "status": "listed", "date": d(-20), "price_range": "$31 (listed)", "currency": "USD", "deal_size": "$640M"},
        {"company": "Vahan Motors", "symbol": "VAHAN", "exchange": "NSE", "country": "India", "sector": "Automotive", "status": "listed", "date": d(-5), "price_range": "₹612 (listed)", "currency": "INR", "deal_size": "₹2,100 Cr"},
        {"company": "Arogya Pharma", "symbol": "AROGYA", "exchange": "BSE", "country": "India", "sector": "Healthcare", "status": "listed", "date": d(-30), "price_range": "₹248 (listed)", "currency": "INR", "deal_size": "₹540 Cr"},
        {"company": "Albion Retail", "symbol": "ALBN", "exchange": "LSE", "country": "UK", "sector": "Consumer", "status": "listed", "date": d(-45), "price_range": "£2.10 (listed)", "currency": "GBP", "deal_size": "£190M"},
        {"company": "Harbour City Consumer", "symbol": "2020", "exchange": "HKEX", "country": "China", "sector": "Consumer", "status": "listed", "date": d(-15), "price_range": "HK$18 (listed)", "currency": "HKD", "deal_size": "HK$2.2B"},
        {"company": "Sakura Robotics", "symbol": "6701", "exchange": "TSE", "country": "Japan", "sector": "Technology", "status": "listed", "date": d(-25), "price_range": "¥3,200 (listed)", "currency": "JPY", "deal_size": "¥48B"},
        {"company": "Silicon Delta Semis", "symbol": "SLDT", "exchange": "NASDAQ", "country": "US", "sector": "Semiconductors", "status": "listed", "date": d(-60), "price_range": "$44 (listed)", "currency": "USD", "deal_size": "$880M"},
        {"company": "Veda Diagnostics", "symbol": "VEDA", "exchange": "BSE", "country": "India", "sector": "Healthcare", "status": "upcoming", "date": d(4), "price_range": "₹128 - ₹135", "currency": "INR", "deal_size": "₹410 Cr"},
        {"company": "Kisan Agro Tech", "symbol": "KISAN", "exchange": "BSE", "country": "India", "sector": "Consumer", "status": "upcoming", "date": d(14), "price_range": "₹76 - ₹80", "currency": "INR", "deal_size": "₹260 Cr"},
        {"company": "Konark Cements", "symbol": "KONARK", "exchange": "BSE", "country": "India", "sector": "Industrial", "status": "listed", "date": d(-8), "price_range": "₹356 (listed)", "currency": "INR", "deal_size": "₹720 Cr"},
        {"company": "Quantum Payments", "symbol": "QPAY", "exchange": "NSE", "country": "India", "sector": "Finance", "status": "upcoming", "date": d(8), "price_range": "₹410 - ₹430", "currency": "INR", "deal_size": "₹1,050 Cr"},
        {"company": "GreenVolt Solar", "symbol": "GRNVLT", "exchange": "NSE", "country": "India", "sector": "Energy", "status": "upcoming", "date": d(22), "price_range": "₹188 - ₹196", "currency": "INR", "deal_size": "₹880 Cr"},
        {"company": "Bharat Defence Systems", "symbol": "BHARDEF", "exchange": "NSE", "country": "India", "sector": "Defence", "status": "listed", "date": d(-12), "price_range": "₹1,240 (listed)", "currency": "INR", "deal_size": "₹3,400 Cr"},
        {"company": "Quanta Therapeutics", "symbol": "QNTA", "exchange": "NASDAQ", "country": "US", "sector": "Healthcare", "status": "upcoming", "date": d(5), "price_range": "$14 - $16", "currency": "USD", "deal_size": "$150M"},
        {"company": "Lumen Data", "symbol": "LMND", "exchange": "NASDAQ", "country": "US", "sector": "Technology", "status": "listed", "date": d(-40), "price_range": "$33 (listed)", "currency": "USD", "deal_size": "$610M"},
        {"company": "Atlas Logistics", "symbol": "ATLS", "exchange": "NYSE", "country": "US", "sector": "Industrial", "status": "upcoming", "date": d(17), "price_range": "$19 - $21", "currency": "USD", "deal_size": "$300M"},
        {"company": "Thames Digital", "symbol": "THMS", "exchange": "LSE", "country": "UK", "sector": "Technology", "status": "upcoming", "date": d(28), "price_range": "£2.60 - £2.90", "currency": "GBP", "deal_size": "£210M"},
        {"company": "Shenzhen EV Power", "symbol": "2333", "exchange": "HKEX", "country": "China", "sector": "Automotive", "status": "upcoming", "date": d(11), "price_range": "HK$40 - HK$45", "currency": "HKD", "deal_size": "HK$4.5B"},
        {"company": "Kyoto Materials", "symbol": "4204", "exchange": "TSE", "country": "Japan", "sector": "Industrial", "status": "listed", "date": d(-18), "price_range": "¥2,150 (listed)", "currency": "JPY", "deal_size": "¥32B"},
    ]
    for r in rows:
        r["source"] = "Sample IPO data"
        r["url"] = _ipo_search_url(r["company"])
    return rows

async def finnhub_ipos():
    token = os.getenv("FINNHUB_API_KEY", "")
    if not token:
        return None
    today = date.today()
    frm = (today - timedelta(days=120)).isoformat()
    to = (today + timedelta(days=90)).isoformat()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://finnhub.io/api/v1/calendar/ipo", params={"from": frm, "to": to, "token": token})
            r.raise_for_status()
            data = r.json().get("ipoCalendar", []) or []
    except Exception:
        return None
    rows = []
    for x in data:
        ds = x.get("date", "")
        try:
            dd = date.fromisoformat(ds)
        except Exception:
            dd = None
        raw_status = (x.get("status") or "").lower()
        status = "listed" if (raw_status == "priced" or (dd and dd < today)) else "upcoming"
        ex_raw = (x.get("exchange") or "").upper()
        ex = "NASDAQ" if "NASDAQ" in ex_raw else "NYSE" if "NYSE" in ex_raw else ex_raw or "Other"
        price = x.get("price") or ""
        price_range = f"${price}" if price and "$" not in str(price) else (price or "TBA")
        shares = x.get("numberOfShares")
        value = x.get("totalSharesValue")
        deal = f"${round(value/1e6)}M" if value else (f"{shares:,} sh" if shares else "—")
        name = x.get("name") or x.get("symbol") or ""
        rows.append({
            "company": name,
            "symbol": x.get("symbol") or "",
            "exchange": ex,
            "country": "US",
            "sector": "",
            "status": status,
            "date": ds or "TBA",
            "price_range": price_range,
            "currency": "USD",
            "deal_size": deal,
            "source": "Finnhub IPO calendar",
            "url": f"https://finance.yahoo.com/quote/{quote_plus(x.get('symbol') or name)}" if x.get("symbol") else _ipo_search_url(name),
        })
    return rows or None

@app.get("/ipos")
async def ipos(status: str = "all", exchange: str = ""):
    base = await finnhub_ipos()
    source = "Finnhub IPO calendar"
    if not base:
        base = sample_ipos()
        source = "Sample IPO data — set FINNHUB_API_KEY for live IPOs"
    exchanges = sorted({r.get("exchange", "") for r in base if r.get("exchange")})
    counts = {"upcoming": sum(1 for r in base if r.get("status") == "upcoming"),
              "listed": sum(1 for r in base if r.get("status") == "listed")}
    rows = base
    ex = (exchange or "").upper()
    if ex:
        rows = [r for r in rows if r.get("exchange", "").upper() == ex]
    st = (status or "all").lower()
    if st in {"upcoming", "listed"}:
        rows = [r for r in rows if r.get("status") == st]
    rows = sorted(rows, key=lambda r: (r.get("status") != "upcoming", r.get("date", "")))
    return {"source": source, "items": rows, "exchanges": exchanges, "exchange_links": IPO_EXCHANGE_LINKS, "counts": counts}

@app.get("/wealth-score")
async def wealth_score(profile_id: Optional[str] = None):
    d = await dashboard(profile_id)
    score = round(min(max((d["savings_rate"]*1.3)+50,0),100))
    return {"score": score, "grade": "Excellent" if score>=85 else "Good" if score>=70 else "Needs work"}

@app.post("/ai-cfo")
async def ai(q: Ask):
    d = await dashboard(profiles[0]["id"] if profiles else None)
    return {"answer": f"Live dashboard: net worth €{d['net_worth']:,.0f}, daily move €{d['daily']:,.0f}.", "disclaimer": "Educational only."}

# =====================================================================
#  AI INVESTMENT DESK — a 6-agent quant "brain" over your favorites.
#  Principles distilled from value investing (margin of safety, quality),
#  trend-following, momentum, mean-reversion ("be greedy when fearful"),
#  and disciplined risk management (entry / target / stop, position sizing).
#  Agents: Watcher → Analyst → Strategist → Advisor → Tracker → Rater.
#  The Rater adapts factor weights from realised hit-rate (self-improving).
# =====================================================================
DESK_MEGACAP = {"NVDA","MSFT","AAPL","AMZN","GOOGL","GOOG","META","AVGO","TSM","LLY","JPM","V","MA",
                "UNH","XOM","WMT","COST","ORCL","NFLX","PG","JNJ","HD","ASML","SAP","NESN","MC","RELIANCE",
                "TCS","HDFCBANK","INFY","SHEL","AZN","NVO","BRK.B"}
QUALITY_SECTORS = {"Technology","Healthcare","Finance","Consumer","Energy","Industrial","Semiconductors","ETF"}

def _clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))

def desk_factors(a):
    """Analyst agent — score six factors from -1 (bad) to +1 (good)."""
    p = float(a.get("price") or 0)
    s50 = float(a.get("sma50") or 0); s200 = float(a.get("sma200") or 0)
    lo = float(a.get("year_low") or 0); hi = float(a.get("year_high") or 0)
    rsi = a.get("rsi"); rsi = float(rsi) if rsi is not None else None
    macd_h = float(a.get("macd_hist") or 0)
    mon = float(a.get("month") or 0); yr = float(a.get("year") or 0); day = float(a.get("day") or 0)
    sym = str(a.get("symbol", "")).upper(); sector = a.get("sector", ""); typ = a.get("type", "")
    dy = float(a.get("dividend_yield") or 0)
    # Trend: above/below the 50 & 200 day averages + golden/death cross
    trend = 0.0
    if p and s50: trend += 1 if p >= s50 else -1
    if p and s200: trend += 1 if p >= s200 else -1
    if s50 and s200: trend += 0.6 if s50 >= s200 else -0.6
    trend = _clamp(trend / 2.6)
    # Momentum: medium/long returns + MACD posture
    momentum = _clamp(_clamp(mon / 10) * 0.5 + _clamp(yr / 40) * 0.3 + (0.2 if macd_h > 0 else -0.2 if macd_h < 0 else 0))
    # Value / mean-reversion: cheaper in its 52w range = better; oversold = opportunity
    value = 0.0
    if hi > lo and p:
        value += (0.5 - (p - lo) / (hi - lo))  # near low → positive
    if rsi is not None:
        value += 0.5 if rsi < 30 else (-0.5 if rsi > 70 else 0)
    value = _clamp(value)
    # Quality: durable mega-caps / solid sectors / dividend payers
    quality = 0.15
    if sym in DESK_MEGACAP: quality += 0.6
    if sector in QUALITY_SECTORS: quality += 0.2
    if dy > 1: quality += 0.1
    quality = _clamp(quality)
    # Risk (positive = safer): penalise volatility, crypto, frothy RSI; reward long uptrend
    risk = 0.3
    if abs(day) >= 5: risk -= 0.5
    if typ == "Crypto": risk -= 0.3
    if rsi is not None and rsi > 75: risk -= 0.3
    if p and s200 and p > s200: risk += 0.2
    risk = _clamp(risk)
    income = _clamp(dy / 3, 0, 1)
    return {"trend": round(trend, 3), "momentum": round(momentum, 3), "value": round(value, 3),
            "quality": round(quality, 3), "risk": round(risk, 3), "income": round(income, 3)}

def desk_score(factors):
    w = ai_weights or {}
    num = sum(factors[k] * float(w.get(k, 1)) for k in factors)
    den = sum(abs(float(w.get(k, 1))) for k in factors) or 1
    raw = _clamp(num / den)
    return round(50 + raw * 50), raw  # 0..100, raw -1..1

def _hit_rate():
    closed = [c for c in ai_calls if c.get("status") == "closed"]
    wins = [c for c in closed if c.get("outcome") == "win"]
    return (len(wins) / len(closed)) if closed else None, len(closed), len(wins)

def desk_strategist(a, factors, raw):
    hr, n, _ = _hit_rate()
    p = float(a.get("price") or 0)
    lo = float(a.get("year_low") or 0); hi = float(a.get("year_high") or 0)
    direction = "up" if raw > 0.12 else "down" if raw < -0.12 else "sideways"
    exp_move = round(raw * 14, 1)  # rough expected % over horizon
    target_zone = None
    if direction == "up" and p:
        target_zone = round(max(hi, p * (1 + abs(raw) * 0.18)), 2)
    elif direction == "down" and p:
        target_zone = round(min(lo, p * (1 - abs(raw) * 0.15)), 2) if lo else round(p * (1 - abs(raw) * 0.15), 2)
    conf = _clamp(0.5 + abs(raw) * 0.4, 0.05, 0.95)
    if hr is not None:
        conf = _clamp(conf * (0.7 + hr * 0.6), 0.05, 0.97)  # track record tempers/raises confidence
    return {"direction": direction, "expected_move_pct": exp_move, "target_zone": target_zone,
            "horizon": "1–3 months", "confidence": round(conf * 100)}

def desk_advisor(a, factors, score, strat):
    p = float(a.get("price") or 0)
    s50 = float(a.get("sma50") or 0); lo = float(a.get("year_low") or 0); hi = float(a.get("year_high") or 0)
    rsi = a.get("rsi"); rsi = float(rsi) if rsi is not None else None
    cur = a.get("currency", "")
    overbought = rsi is not None and rsi > 70
    below_long = bool(s50) and p < s50
    if score >= 68 and not overbought:
        action = "BUY"
    elif score >= 68 and overbought:
        action = "BUY THE DIP"
    elif score >= 52:
        action = "HOLD / WATCH"
    elif score < 40 or (overbought and factors["momentum"] < 0):
        action = "TRIM / AVOID"
    else:
        action = "WATCH"
    entry = round(p, 2) if action == "BUY" else (round(min(s50 or p, p), 2) if action == "BUY THE DIP" else round(p, 2))
    target = round(max(hi or 0, p * 1.12), 2) if p else 0
    # Stop = the closest sensible support BELOW price (just under 50-day avg, or ~10% risk), not the far 52w low
    stop_candidates = [c for c in [(s50 * 0.97 if s50 else 0), p * 0.90, (lo if lo else 0)] if 0 < c < p]
    stop = round(max(stop_candidates), 2) if stop_candidates else (round(p * 0.9, 2) if p else 0)
    upside = round((target - p) / p * 100, 1) if p else 0
    downside = round((p - stop) / p * 100, 1) if p else 0
    rr = round(upside / downside, 2) if downside > 0 else None
    green = action in {"BUY", "BUY THE DIP"} and (rr or 0) >= 1.3
    plan = ""
    if action.startswith("BUY"):
        plan = (f"{'Buy now' if action=='BUY' else 'Wait for a pullback toward ' + cur + ' ' + format(entry, ',.2f')} "
                f"near {cur} {entry:,.2f}; target {cur} {target:,.2f} (+{upside}%), stop {cur} {stop:,.2f} (−{downside}%). "
                f"Risk:reward ≈ {rr}. Size to risk ~1–2% of the portfolio on the stop.")
    elif action == "TRIM / AVOID":
        plan = f"Momentum/risk unfavourable. Consider trimming or waiting; reassess if it reclaims {cur} {round(s50 or p,2):,.2f}."
    else:
        plan = f"Hold and monitor. Re-rate on a break above {cur} {round(hi or p,2):,.2f} or below {cur} {round(stop,2):,.2f}."
    return {"action": action, "green_light": green, "entry": entry, "target": target, "stop": stop,
            "upside_pct": upside, "downside_pct": downside, "risk_reward": rr, "plan": plan}

def desk_rationale(a, factors, score, strat, adv):
    order = sorted(factors.items(), key=lambda kv: abs(kv[1]), reverse=True)
    label = {"trend": "trend", "momentum": "momentum", "value": "valuation/mean-reversion",
             "quality": "business quality", "risk": "risk profile", "income": "dividend"}
    pos = [label[k] for k, v in order if v > 0.25][:2]
    neg = [label[k] for k, v in order if v < -0.25][:2]
    bits = []
    if pos: bits.append("Supported by " + " & ".join(pos))
    if neg: bits.append("held back by " + " & ".join(neg))
    rsi = a.get("rsi")
    if rsi is not None:
        if rsi < 30: bits.append("oversold — the kind of fear long-term buyers look for")
        elif rsi > 70: bits.append("overbought — patience over chasing")
    return ". ".join(bits) + "." if bits else "Mixed signals; no clear edge yet."

async def run_ai_desk(profile_id=None):
    """Watcher + Analyst + Strategist + Advisor over the favorites, grouped by exchange."""
    rows = await enriched_assets(True)
    wl = {x.get("symbol", "").upper() for x in watchlist}
    favs = [r for r in rows if r.get("symbol", "").upper() in wl]
    assets_out = []
    for a in favs:
        factors = desk_factors(a)
        score, raw = desk_score(factors)
        strat = desk_strategist(a, factors, raw)
        adv = desk_advisor(a, factors, score, strat)
        flags = []
        if abs(float(a.get("day") or 0)) >= 4: flags.append("big move today")
        if a.get("rsi") is not None and float(a["rsi"]) < 30: flags.append("oversold")
        if a.get("rsi") is not None and float(a["rsi"]) > 70: flags.append("overbought")
        assets_out.append({
            "symbol": a.get("symbol"), "name": a.get("name"), "market": a.get("market"),
            "market_name": a.get("market_name"), "currency": a.get("currency"), "price": a.get("price"),
            "day": a.get("day"), "week": a.get("week"), "month": a.get("month"), "year": a.get("year"),
            "rsi": a.get("rsi"), "macd_hist": a.get("macd_hist"), "sma50": a.get("sma50"), "sma200": a.get("sma200"),
            "year_low": a.get("year_low"), "year_high": a.get("year_high"), "sector": a.get("sector"),
            "watcher": {"flags": flags, "source": a.get("source")},
            "factors": factors, "score": score, "strategist": strat, "advisor": adv,
            "rationale": desk_rationale(a, factors, score, strat, adv),
        })
    # group by exchange (deep watch per selected exchange)
    ex_map = {}
    for x in assets_out:
        code = x.get("market") or "GLOBAL"
        ex_map.setdefault(code, []).append(x)
    exchanges = []
    for code, items in ex_map.items():
        cal = _market_calendar_payload(code) if code in MARKET_SESSIONS else _market_calendar_payload("GLOBAL")
        green = [i for i in items if i["advisor"]["green_light"]]
        exchanges.append({"code": code, "name": (items[0].get("market_name") or code), "count": len(items),
                          "open": cal.get("is_open_today"), "session": cal.get("regular_session_local", ""),
                          "status": cal.get("status"), "buy_signals": len(green),
                          "avg_score": round(sum(i["score"] for i in items) / len(items)) if items else 0})
    exchanges.sort(key=lambda e: (-e["buy_signals"], -e["avg_score"]))
    assets_out.sort(key=lambda x: x["score"], reverse=True)
    return assets_out, exchanges

def evaluate_ai_calls(price_by_symbol):
    """Tracker — mark open calls win/loss vs target/stop and adapt factor weights."""
    changed = False
    for c in ai_calls:
        if c.get("status") != "open":
            continue
        sym = str(c.get("symbol", "")).upper()
        p = price_by_symbol.get(sym)
        if not p:
            continue
        entry = float(c.get("entry") or 0)
        c["current"] = p
        c["pl_pct"] = round((p - entry) / entry * 100, 2) if entry else 0
        tgt = float(c.get("target") or 0); stp = float(c.get("stop") or 0)
        if tgt and p >= tgt:
            c["status"], c["outcome"] = "closed", "win"; changed = True
        elif stp and p <= stp:
            c["status"], c["outcome"] = "closed", "loss"; changed = True
    if changed:
        _adapt_weights()
        save_data()

def _adapt_weights():
    """Rater — nudge factor weights toward what worked on closed calls (self-improving)."""
    closed = [c for c in ai_calls if c.get("status") == "closed" and c.get("factors")]
    if len(closed) < 3:
        return
    for k in list(ai_weights.keys()):
        delta = 0.0
        for c in closed[-20:]:
            fv = float(c.get("factors", {}).get(k, 0))
            win = c.get("outcome") == "win"
            delta += (fv if win else -fv)
        ai_weights[k] = max(0.2, min(2.5, float(ai_weights.get(k, 1)) + delta * 0.01))

def desk_scorecard():
    hr, n, wins = _hit_rate()
    closed = [c for c in ai_calls if c.get("status") == "closed"]
    avg_pl = round(sum(float(c.get("pl_pct") or 0) for c in closed) / len(closed), 2) if closed else 0
    open_calls = [c for c in ai_calls if c.get("status") == "open"]
    losses = max(n - wins, 0)
    best = max(closed, key=lambda c: float(c.get("pl_pct") or 0)) if closed else None
    worst = min(closed, key=lambda c: float(c.get("pl_pct") or 0)) if closed else None
    open_pl = round(sum(float(c.get("pl_pct") or 0) for c in open_calls) / len(open_calls), 2) if open_calls else 0
    if hr is None:
        rating, grade = 50, "Calibrating"
    else:
        rating = round(_clamp(50 + (hr - 0.5) * 80 + avg_pl * 1.5, 0, 100))
        grade = "Sharp" if rating >= 80 else "Solid" if rating >= 65 else "Learning" if rating >= 45 else "Needs work"
    # Plain-language read of where the rating stands and what moves it.
    if hr is None:
        verdict = f"Calibrating — track a few calls to closure and the rating starts grading itself. {len(open_calls)} open right now."
    else:
        verdict = (f"{wins} of {n} resolved calls hit target ({round(hr*100)}% hit rate), "
                   f"averaging {'+' if avg_pl>=0 else ''}{avg_pl}% per closed call. "
                   f"{len(open_calls)} still open" + (f", {'+' if open_pl>=0 else ''}{open_pl}% so far." if open_calls else "."))
    return {"hit_rate": round(hr * 100) if hr is not None else None, "calls_closed": n, "wins": wins,
            "losses": losses, "open_calls": len(open_calls), "avg_pl_pct": avg_pl, "open_pl_pct": open_pl,
            "tracked_total": len(ai_calls), "rating": rating, "grade": grade, "verdict": verdict,
            "best_call": {"symbol": best.get("symbol"), "pl_pct": round(float(best.get("pl_pct") or 0), 2)} if best else None,
            "worst_call": {"symbol": worst.get("symbol"), "pl_pct": round(float(worst.get("pl_pct") or 0), 2)} if worst else None,
            "weights": {k: round(v, 2) for k, v in ai_weights.items()},
            "note": "Rating improves as more calls resolve. Educational only — not financial advice."}

@app.get("/ai-desk")
async def ai_desk(profile_id: Optional[str] = None):
    assets_out, exchanges = await run_ai_desk(profile_id)
    price_by_symbol = {x["symbol"].upper(): float(x.get("price") or 0) for x in assets_out}
    evaluate_ai_calls(price_by_symbol)
    ai_meta["last_run"] = datetime.utcnow().isoformat()
    ai_meta["runs"] = int(ai_meta.get("runs", 0)) + 1
    green = [x for x in assets_out if x["advisor"]["green_light"]]
    return {"generated": ai_meta["last_run"], "watched": len(assets_out), "exchanges": exchanges,
            "assets": assets_out, "green_lights": green, "open_calls": [c for c in ai_calls if c.get("status") == "open"],
            "scorecard": desk_scorecard()}

class DeskTrackIn(BaseModel):
    symbol: str
    action: str = "BUY"
    entry: float
    target: float = 0
    stop: float = 0
    score: float = 0
    factors: dict = {}
    units: float = 0
    note: str = ""

@app.post("/ai-desk/track")
async def ai_desk_track(t: DeskTrackIn):
    if not t.symbol.strip():
        raise HTTPException(status_code=422, detail="Symbol is required.")
    if float(t.entry or 0) <= 0:
        raise HTTPException(status_code=422, detail="Buy/entry price must be greater than 0.")
    row = {"id": next_numeric_id(ai_calls), "symbol": t.symbol.upper(), "action": t.action,
           "entry": float(t.entry), "target": float(t.target), "stop": float(t.stop),
           "score": float(t.score), "factors": t.factors or {}, "units": float(t.units or 0),
           "note": (t.note or "").strip(), "opened": datetime.utcnow().date().isoformat(),
           "status": "open", "outcome": "", "pl_pct": 0, "current": float(t.entry)}
    ai_calls.append(row)
    save_data()
    return row

@app.post("/ai-desk/close/{call_id}")
async def ai_desk_close(call_id: int):
    c = next((x for x in ai_calls if int(x.get("id", 0)) == call_id), None)
    if not c:
        raise HTTPException(status_code=404, detail="Call not found")
    if c.get("status") == "open":
        c["status"] = "closed"
        c["outcome"] = "win" if float(c.get("pl_pct") or 0) >= 0 else "loss"
        _adapt_weights()
        save_data()
    return c

@app.delete("/ai-desk/calls/{call_id}")
async def ai_desk_delete(call_id: int):
    before = len(ai_calls)
    ai_calls[:] = [c for c in ai_calls if int(c.get("id", 0)) != call_id]
    if len(ai_calls) == before:
        raise HTTPException(status_code=404, detail="Call not found")
    save_data()
    return {"deleted": before - len(ai_calls)}

@app.get("/ai-desk/events")
async def ai_desk_events():
    return ai_events[-40:][::-1]

async def _ai_desk_watch_loop():
    """The always-on watcher. Re-evaluates favorites + open calls on an interval and
    logs events (new buy green-lights, downturn warnings) the UI surfaces as alerts."""
    await asyncio.sleep(20)
    while True:
        try:
            assets_out, _ = await run_ai_desk()
            price_by_symbol = {x["symbol"].upper(): float(x.get("price") or 0) for x in assets_out}
            evaluate_ai_calls(price_by_symbol)
            known = {e.get("key") for e in ai_events}
            today = datetime.utcnow().date().isoformat()
            for x in assets_out:
                sym = x["symbol"]
                if x["advisor"]["green_light"]:
                    key = f"buy:{sym}:{today}"
                    if key not in known:
                        ai_events.append({"id": len(ai_events) + 1, "key": key, "ts": datetime.utcnow().isoformat(),
                                          "symbol": sym, "kind": "buy", "sev": "high",
                                          "title": f"AI buy signal: {sym}",
                                          "text": x["advisor"]["plan"]})
                if x["advisor"]["action"] == "TRIM / AVOID" and float(x.get("year") or 0) > 0:
                    key = f"warn:{sym}:{today}"
                    if key not in known:
                        ai_events.append({"id": len(ai_events) + 1, "key": key, "ts": datetime.utcnow().isoformat(),
                                          "symbol": sym, "kind": "warn", "sev": "med",
                                          "title": f"AI caution: {sym} may weaken",
                                          "text": x["rationale"]})
            del ai_events[:-60]
            ai_meta["last_run"] = datetime.utcnow().isoformat()
            ai_meta["runs"] = int(ai_meta.get("runs", 0)) + 1
            save_data()
        except Exception:
            pass
        await asyncio.sleep(900)  # every 15 minutes, 24/7 while the server runs

@app.on_event("startup")
async def _start_desk():
    asyncio.create_task(_ai_desk_watch_loop())
