# 💎 Wealth OS

**The family wealth command center — every stock, fund, property, car, and cash account across every market and currency, in one calm, real‑time dashboard. With a 6‑agent AI investing desk that watches your favorites 24/7 and grades its own calls.**

Wealth OS turns a scattered financial life — brokerage apps, spreadsheets, property values in three currencies, a car depreciating in the garage — into a single, beautiful, profile‑aware net‑worth picture, backed by **live market data** and **transparent, explainable AI**.

> ⚠️ **Educational software, not financial advice.** All AI output, sentiment scores, tax estimates, and ratings are informational. Always verify with a professional and the linked primary sources (Morningstar, Simply Wall St, GuruFocus, etc.).

---

## 📑 Table of Contents

- [Why Wealth OS](#-why-wealth-os)
- [Highlights](#-highlights)
- [Screenshots](#-screenshots)
- [Screens & Features](#-screens--features)
- [The AI Investment Desk (USP)](#-the-ai-investment-desk-usp)
- [Architecture](#-architecture)
- [Tech Stack, Languages & Tooling](#-tech-stack-languages--tooling)
- [Frontend](#-frontend)
- [Backend](#-backend)
- [Database & Storage](#-database--storage)
- [System Requirements & Footprint](#-system-requirements--footprint)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Project Structure](#-project-structure)
- [API Overview](#-api-overview)
- [Data Sources](#-data-sources)
- [Challenges Faced & Engineering Notes](#-challenges-faced--engineering-notes)
- [Known Limitations & API Reality Check](#-known-limitations--api-reality-check)
- [User Guide](#-user-guide)
- [Design System](#-design-system)
- [Roadmap](#-roadmap)
- [Disclaimer & License](#-disclaimer--license)

---

## 🌟 Why Wealth OS

Most people's wealth lives in **5–10 disconnected places**: a domestic broker, an international broker, a crypto exchange, mutual‑fund platforms, real estate, gold, and cash in several banks. No single app shows the *whole* picture — across **currencies**, **countries**, and **family members** — and almost none explain *why* something moved or *what to do next*.

**Wealth OS answers four questions in one place:**

1. **What do I own?** — Holdings, funds, bonds, property, cars, gold, and cash, normalized to one display currency.
2. **What is it worth right now?** — Live quotes, FX, and per‑asset P/L, refreshed continuously.
3. **Why did it move, and is it healthy?** — Real technical indicators, sentiment gauges, warning signs, and links to professional ratings.
4. **What should I consider doing?** — An interactive AI CFO and a multi‑agent AI Desk that issue plans (entry / target / stop) and grade their own accuracy over time.

---

## ✨ Highlights

| | |
|---|---|
| 🌍 **Multi‑market, multi‑currency** | NYSE, NASDAQ, NSE, BSE, XETRA, LSE, TSE, HKEX, ASX, crypto & more — values normalized to your display currency with live FX. |
| 👨‍👩‍👧 **Profiles & family view** | Each member has an isolated portfolio; the family view aggregates everyone. **Any profile — including the admin/owner — can be password‑protected:** set a password in the Profiles tab and the app then requires it **every time** anyone switches into that profile (only the profile currently in view stays unlocked), and re‑locks it on every page refresh (the app stays blurred behind the unlock prompt until the right password is entered). A **🔒 Lock button** in the top bar lets you lock the open profile on demand — e.g. when stepping away — and the app re‑locks automatically even when the page is restored from the browser's back/forward cache. Plus an "About Me" founder page with photo upload. |
| 📈 **Real technical analysis** | RSI(14), MACD(12,26,9), SMA‑50/200, 52‑week range — computed from live daily price history, not faked. |
| 🧠 **AI Investment Desk** | Six cooperating agents watch favorites 24/7, issue buy calls with a plan, track them vs. your real entry, and **self‑improve**. |
| 💬 **Interactive AI CFO** | Ask about cashflow, concentration risk, buy zones, goals, property, and tax — answered from *your* live portfolio. |
| 🟢 **Live market status** | Per‑exchange open/closed with a pulsing dot and a precise "opens in 9h 49m · 09:15 IST" countdown. |
| 📊 **Premium charts** | Crosshair, gradient fills, hover read‑outs, volume bars, donut toggles, and a Stocktwits‑style sentiment gauge — across the whole app. |
| 🏠 **Property & car modeling** | Inflation/locality price projection for homes, downward depreciation curves for cars, rental tracking, and per‑country tax info. |
| 🔔 **Smart notifications** | 52‑week‑low alerts, big movers, RSI extremes, triggered price targets, and AI green‑light buys. |
| 💱 **Forex & market pulse** | Live ECB major FX pairs, advancers/decliners breadth, most‑volatile movers, and an IPO calendar. |
| 🌐 **11 world languages** | One‑tap interface translation across English, Deutsch, 中文, हिन्दी, Español, Français, العربية (full RTL), বাংলা, Português, Русский and 日本語 — from the top bar or Settings. |
| ⚙️ **Rich settings** | Theme (dark/light/auto), accent color, density, privacy blur, 12/24h clock, default currency, auto‑refresh, startup profile, language — plus a one‑click **privacy‑safe JSON backup export** (no passwords or API keys). |

---



## 🖥 Screens & Features

- **Welcome setup (first run)** — A mandatory, validated 5‑step wizard that blurs the app until completed. It asks who the app is for (personal/family/business), your name, email, country, currency & language, and your risk/goal style. On finish it **creates a brand‑new profile for that user and lands them on it** — the existing owner/admin profile is never renamed or overwritten. The last remaining admin profile can never be deleted, so the app always keeps an owner.
- **Mission Control** — Net‑worth KPIs with count‑up animation, a live local clock + world clocks, market‑status panel, wealth‑projection chart with a live hover read‑out, and allocation/geography/sector/performance charts.
- **About Me** — A founder/profile page: photo upload (auto‑resized), role, company, headline, bio, **focus areas & interests** (as tags), a **milestones timeline**, a motto, contact + social links, and a live **wealth‑at‑a‑glance** snapshot (net worth, holdings, real assets, family profiles).
- **Live Markets** — Market comparison chart, **Market Pulse** (breadth/mood), **Forex** majors, **Most‑Active/Volatile**, top gainers/losers, global top assets, top coins, a per‑exchange calendar with live open/closed status, and an **Exchange browser**: pick an exchange (NASDAQ, NYSE, NSE India, Crypto…) to list **every** share & fund traded on it — searchable, paginated, with live prices and one‑click drill‑down.
- **IPOs** — Upcoming and recent IPOs grouped by exchange, with links to official IPO calendars.
- **Portfolio** — Add/edit/sell holdings (with a proper Sell modal that routes proceeds to cashflow **and** a chosen bank cash account), portfolio‑mix donut, a combined **Add Cash & Cashflow** panel, and bank‑tagged cash accounts (Axis, ICICI, SBI, HDFC, N26, …).
- **Properties** — Houses, cars, gold and more in any country/currency; inflation+locality price projection, car depreciation curves, rental status, and dispose (sell/gift) flow.
- **Alerts & Plans** — Price alerts and savings goals.
- **Favorites** — A watchlist with quick stats and one‑click open. **Add a favorite** with the search box at the top (any stock/ETF/fund/coin), the ⭐ on any Asset Detail page, or “Add favorite” on movers/screeners.
- **AI Desk** — The multi‑agent investing engine (see below).
- **Screeners** — Bullish/Bearish technical screens with the **sentiment gauge**, MACD meter, RSI bar, smart‑money score, and insider‑trading data.
- **Compare** — Side‑by‑side asset comparison.
- **News** — Real, deduplicated articles with images and source links (no empty/dead links).
- **Funds & Bonds** — Mutual‑fund and bond tracking with NAV history.
- **Asset Detail** — A full instrument page: interactive price chart (crosshair, volume, range tabs), performance/dividends/price/profile/edit tabs, technical read‑out with sentiment gauge, ratings & warning signs, and real news.
- **AI CFO** — A conversational analyst grounded in your portfolio.
- **Brokers** — Connector status & sync scaffolding for Trading 212, IBKR, Zerodha/Coin, Coinbase, Groww, Scalable Capital, MF Central.

---

## 🧠 The AI Investment Desk (USP)

A transparent, six‑agent quant pipeline that runs over everything in your **Favorites**, grouped by exchange. It is grounded in public investing principles — *margin of safety, business quality, trend, momentum, mean‑reversion, and hard risk management* — and it **grades and retunes itself**.

| Agent | Role |
|---|---|
| 👁️ **Watcher** | Tracks every favorite live, per exchange, 24/7 (background async loop). |
| 🔬 **Analyst** | Scores 6 factors — trend, momentum, value, quality, risk, income — into a 0–100 composite. |
| 🔮 **Strategist** | Predicts direction, confidence, target zone, and horizon. |
| 🎯 **Advisor** | Issues BUY / HOLD / TRIM calls with a full plan: entry, target, stop, risk‑reward. |
| 📋 **Tracker** | When you log a buy at your real price, monitors it live and auto‑closes win/loss at target/stop. |
| ⭐ **Rater** | Grades hit‑rate, win/loss split, average P/L (closed **and** open), and best/worst calls into an AI rating dial with a plain‑language verdict, and **auto‑tunes the factor weights** toward what actually worked. |

When score, trend, and risk‑reward all line up, the asset gets a **green light** with a one‑click *"I bought this — track it"* flow so the desk can measure its own accuracy and improve. Green‑light buys also surface in the notification center.

---

## 🏗 Architecture

```
┌──────────────────────────────┐         ┌─────────────────────────────────────┐
│   Frontend (static SPA)      │  HTTP   │   Backend (FastAPI, Python 3.12)    │
│  index.html · app.js · css   │ ◄─────► │  main.py  ── 65 REST endpoints      │
│  Chart.js · vanilla JS       │  JSON   │  integrations/ live_market, brokers │
│  No build step.              │         │  services/ data_store (state.json)  │
└──────────────────────────────┘         └──────────────────┬──────────────────┘
                                                             │ httpx (async)
                                          ┌──────────────────┴──────────────────┐
                                          │ Yahoo Finance · CoinGecko · ECB/     │
                                          │ Frankfurter FX · MFAPI · Google News │
                                          │ Finviz · Finnhub (optional keys)     │
                                          └─────────────────────────────────────┘
```

- **Backend** is a single FastAPI app. Live data is fetched on demand via `httpx` and **cached** to stay within free‑tier limits. All user data persists to a simple JSON store (`backend/data/state.json`) — no database required to run.
- **Frontend** is a dependency‑free single‑page app: one `pages` array drives navigation, `show(page)` toggles `.page.active` sections, and a single `state` object holds client data. Charts use Chart.js via CDN. Cache‑busting `?v=` query strings on CSS/JS.
- **Resilience**: every live call has a graceful fallback (cached, sample, or demo data) so the dashboard never goes blank.

---

## 🧰 Tech Stack, Languages & Tooling

| Layer | Technology | Why |
|---|---|---|
| **Languages** | **Python 3.12**, **JavaScript (ES2020)**, **HTML5**, **CSS3** | Backend logic in Python; frontend is dependency‑free vanilla JS. |
| **Backend framework** | **FastAPI** + **Uvicorn** (ASGI) | Fast async APIs, automatic OpenAPI/Swagger docs at `/docs`. |
| **Validation** | **Pydantic v2** | Typed request/response models, input validation. |
| **HTTP client** | **httpx** (async) | Concurrent calls to market/FX/news providers. |
| **PDF/report** | **ReportLab** | Report generation support. |
| **Frontend** | **Vanilla JS** (no framework, no build step) | Zero toolchain — just static files served by any web server. |
| **Charts** | **Chart.js** (via CDN) | Line/bar/donut charts + custom crosshair, gradient, volume & sentiment‑gauge plugins. |
| **Styling** | **CSS3** with custom‑property design tokens + `color-mix()` | Light/dark theming, one shared stylesheet. |
| **Fonts** | **Inter** (body) + **Sora** (headings) via Google Fonts | — |
| **Containerization** | **Docker** + **docker‑compose** | One command to run backend + frontend. |
| **Web server (prod)** | **Nginx** (serves the static frontend) | Lightweight static hosting; backend stays separate. |
| **Persistence** | **JSON file** (`backend/data/state.json`) | No database to install — see [Database & Storage](#-database--storage). |
| **Indicators (in‑house)** | RSI(14), MACD(12,26,9) via EMA + Wilder smoothing, SMA‑50/200, 52‑week range | Computed from live daily price history, not third‑party. |

> **No build step, no bundler, no Node.js required** for the frontend — `index.html`, `app.js`, and `styles.css` are plain static files.

---

## 🎨 Frontend

- **What it is:** a single‑page app made of exactly three static files — `frontend/index.html` (the shell + all page sections + modals), `frontend/js/app.js` (~300 KB of app logic), and `frontend/css/styles.css` (~110 KB design system).
- **No framework / no build:** plain ES2020 JavaScript. Nothing to `npm install`, transpile, or bundle. Edit a file, refresh the browser.
- **How it works:** a `pages[]` array drives the sidebar nav; `show(page)` toggles the matching `<section class="page">`; a single `state` object holds all client data; `get/post/patch/del` helpers talk to the backend; `loadAll()` fans out to per‑section loaders and renders.
- **Charts:** one shared `chart()` helper plus custom Chart.js plugins (crosshair, gradient fills, rounded bars, donut cutouts, the interactive asset chart, and the SVG sentiment gauge).
- **Served by:** any static file server — Nginx (in Docker), `python -m http.server`, or similar. It calls the backend at `http://localhost:8000` (configurable via `window.WEALTH_OS_API`).

---

## ⚙️ Backend

- **What it is:** a single **FastAPI** application (`backend/app/main.py`, ~2,800 lines) exposing **65 REST endpoints**, plus two integration modules (`live_market.py`, `brokers.py`) and a persistence module (`data_store.py`).
- **Async live data:** market/FX/news are fetched on demand with `httpx` and cached in‑memory to respect free‑tier limits. Every call has a graceful fallback so the dashboard never goes blank.
- **AI engines:** the AI CFO and the 6‑agent AI Investment Desk (scoring, strategy, advice, self‑grading Tracker/Rater) plus a 24/7 background `asyncio` watch loop.
- **Auto docs:** interactive Swagger UI at **`http://localhost:8000/docs`**, OpenAPI JSON at `/openapi.json`.
- **Stateless‑ish:** the only state is the JSON file below; restart‑safe and easy to back up (just copy one file).

---

## 🗄 Database & Storage

**Wealth OS needs NO database server.** There is nothing to install, provision, or connect — no PostgreSQL, MySQL, MongoDB, Redis, etc.

- **Persistence model:** all user data (profiles, holdings, properties, cashflow, cash accounts, watchlist, alerts, savings plans, broker details, and AI Desk state) is stored in a **single JSON file**: `backend/data/state.json`.
- **How it works:** on startup the backend loads that file into in‑memory Python structures; after every change it writes the file back (`load_data()` / `save_data()` in `services/data_store.py`).
- **Size:** tiny. A fully‑populated multi‑profile install is around **~80–100 KB**. It grows slowly and linearly with the number of holdings/AI calls; even heavy use stays in the low single‑digit megabytes.
- **Backups:** copy `state.json` (the app also writes occasional `state.backup.*.json` snapshots). The file is **gitignored** because it contains personal financial data — a fresh clone boots from built‑in **seed/demo data** so the dashboard is never empty.
- **Want a real DB later?** The store is isolated in one module, so swapping the JSON file for SQLite/Postgres is a contained change (see [Roadmap](#-roadmap)).

---

## 💾 System Requirements & Footprint

Wealth OS is deliberately lightweight — it runs comfortably on a laptop or the smallest cloud VM.

| Resource | Requirement / Footprint |
|---|---|
| **OS** | macOS, Linux, or Windows (Docker or native Python). |
| **Python** | 3.11+ (Docker image uses **3.12‑slim**; tested up to 3.13). |
| **Backend dependencies** | 6 packages, ~**60 MB** installed (`fastapi`, `uvicorn`, `pydantic`, `httpx`, `python-multipart`, `reportlab`). |
| **Frontend** | ~**460 KB** total of static files. No Node.js, no build artifacts. |
| **Backend source** | ~**0.5 MB** of code. |
| **User data** | ~**80–100 KB** (`state.json`); low single‑digit MB at heavy use. |
| **Docker images** | Backend ≈ **300–400 MB** (`python:3.12-slim` + deps); frontend uses `nginx:alpine` (~**25 MB**). |
| **RAM** | Comfortable in **~128–256 MB**; runs fine on a 512 MB instance. |
| **Disk** | A few hundred MB total with Docker images; **< 5 MB** for the app code + data alone. |
| **Network** | Outbound HTTPS to public market/FX/news APIs (works with **zero API keys**). |
| **Ports** | Backend **8000**, frontend **3000** (configurable). |

---

## 🚀 Quick Start

### Option A — Docker (recommended)

```bash
docker compose down        # stop anything old
docker compose up --build  # build & run backend + frontend
```

Open **http://localhost:3000**. The backend API runs on **http://localhost:8000**.

### Option B — Local dev (no Docker)

**Backend:**
```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Frontend** (any static server):
```bash
cd frontend
python -m http.server 3000
```

Then open **http://localhost:3000**.

> The app works out of the box with **no API keys** — it uses free public endpoints (Yahoo, CoinGecko, ECB/Frankfurter) and falls back to sample data where a key is required.

---

## ⚙️ Configuration

All configuration is via environment variables (see `docker-compose.yml`). Everything is **optional** — the app runs without any of these.

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma‑separated allowed origins for the frontend. |
| `USE_LIVE_DATA` | `true` to fetch live data, `false` for demo mode. |
| `FINNHUB_API_KEY` | Richer IPO calendar + company news. |
| `NEWSAPI_KEY`, `ALPHA_VANTAGE_API_KEY` | Optional news/market enrichment. |
| `TRADING212_API_KEY`, `COINBASE_*`, `ZERODHA_*`, `GROWW_API_KEY`, `SCALABLE_API_KEY`, `MFCENTRAL_API_KEY`, `IBKR_*` | Read‑only broker connectors (bring your own keys; never store passwords). |

---

## 📂 Project Structure

```
wealth-os/
├── README.md                  ← you are here
├── docker-compose.yml         ← backend + frontend services
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/state.json        ← persisted user data (gitignored)
│   └── app/
│       ├── main.py            ← FastAPI app · 65 endpoints · AI engines · indicators
│       ├── integrations/
│       │   ├── live_market.py ← Yahoo/CoinGecko/FX/news clients + caching
│       │   └── brokers.py     ← broker connector status & sync scaffolding
│       └── services/
│           └── data_store.py  ← in‑memory state + JSON load/save + seed data
└── frontend/
    ├── index.html             ← SPA shell (all page sections + modals)
    ├── css/styles.css         ← design system + all component styles
    └── js/app.js              ← SPA logic: nav, state, charts, AI UI, modals
```

---

## 🔌 API Overview

65 REST endpoints. A representative selection:

**Portfolio & profiles**
`GET /dashboard` · `GET /wealth-score` · `GET /allocations` · `GET /holdings` · `POST /holdings` · `PATCH /holdings/{symbol}` · `GET/POST/PATCH/DELETE /profiles` · `GET/POST/PATCH/DELETE /cash-accounts` · `GET/POST/DELETE /cashflow` · `GET/POST/DELETE /properties` · `POST /properties/{id}/dispose` · `GET /export` (privacy-safe JSON backup)

**Markets & data**
`GET /markets/movers` · `GET /markets/global-top` · `GET /exchange/listings` (all shares of an exchange) · `GET /asset-detail` · `GET /asset-history` · `GET /live/price` (near‑real‑time tick) · `GET /market-status` · `GET /market-calendar` · `GET /forex` · `GET /fx-rates` · `GET /ipos` · `GET /funds-bonds` · `GET /insider-trading` · `POST /search` · `GET /tax-info`

**AI**
`POST /ai-cfo` · `GET /ai-desk` · `POST /ai-desk/track` · `POST /ai-desk/close/{id}` · `GET /ai-desk/events`

**Other**
`GET /watchlist` · `GET/POST /alerts` · `GET/POST /savings-plans` · `GET /news-center` · `GET /brokers/status` · `POST /brokers/sync/{broker}`

Interactive API docs are available at **http://localhost:8000/docs** (FastAPI Swagger UI).

---

## 🛰 Data Sources

Market data is fetched **directly from each exchange's public data** — a price is the same regardless of which broker holds the asset — so **no broker login is needed for live quotes**. Every market has a keyless source plus fallbacks, and the **Brokers → Market Data Providers** panel shows each exchange live in real time (`GET /live/providers`).

| Source | Used for | Key? |
|---|---|---|
| **Yahoo Finance** | US (NYSE/Nasdaq), EU (XETRA/LSE/Euronext), India (NSE/BSE) stocks & ETFs, metals, OHLCV history, search | keyless |
| **CoinGecko** | Crypto — any coin, with full price history & technicals | keyless |
| **Coinbase** | Crypto spot price (keyless backup) | keyless |
| **Binance** | Crypto price + 24h change (keyless backup) | keyless |
| **MFAPI.in (AMFI)** | Indian mutual‑fund NAV history + full fund master | keyless |
| **Nasdaq Trader directory** | Full NASDAQ / NYSE / AMEX listed‑security lists (exchange browser) | keyless |
| **NSE archives** | Full NSE India equity **and ETF** lists (exchange browser) | keyless |
| **Finnhub *(optional key)*** | US backup quotes/news (free); full international symbol directories need a **paid** Finnhub plan | key |

> **Exchange-browser coverage:** *Full directory* (every listing) is available **keyless** for **NASDAQ, NYSE, AMEX, NSE India, Crypto, India MFs**. Other world exchanges (Frankfurt/XETRA, LSE, Euronext, Tokyo, HK, …) have **no free full feed**, so they show a hand‑curated list of *major companies & ETFs* (DAX, FTSE, CAC…). Their complete directories require a **paid** market‑data plan (Finnhub international, EODHD, etc.); the connector is wired and activates automatically when such a key is added.
| **ECB / Frankfurter** | Live foreign‑exchange rates & forex pairs | keyless |
| **Google News RSS** | Real, sourced article headlines | keyless |
| **Finviz** | Insider‑trading & screener data | keyless |
| **Twelve Data / Finnhub / Alpha Vantage** *(optional)* | Higher‑limit **backup** stock quotes & company news | free key |

**Crypto fallback chain:** CoinGecko (full history) → Yahoo (`SYM‑USD`) → Coinbase spot → Binance 24h — so any coin stays live even if one source is down.

All third‑party **ratings** (star ratings, fair value, DCF, financial‑health) are **deep‑linked** to Morningstar, Simply Wall St, and GuruFocus rather than reproduced — verify before any decision.

---

## 🧗 Challenges Faced & Engineering Notes

Building a *live*, multi‑market wealth dashboard with **zero paid data subscriptions** turned out to be the hardest part of the project. The honest engineering story:

| Challenge | What happened | How it was solved |
|---|---|---|
| **"Real‑time" data is mostly paid** | Almost every true tick‑by‑tick / streaming market API (and many "free" REST quote endpoints) is paywalled, requires OAuth, or is **IP‑blocked for servers/data‑centers**. | Built a **multi‑provider fallback chain** that fetches directly from each exchange's *public* endpoints and degrades gracefully (cached → alternate provider → sample) so the dashboard never goes blank. |
| **Endpoints blocked from the server** | Several otherwise‑useful sources return `401/403/429/451` when called from a cloud IP rather than a browser — e.g. **Stooq**, the **NSE real‑time quote API**, and **Yahoo's v7 batch‑quote** endpoint. | Re‑routed to sources that *do* allow programmatic access: Yahoo's **chart** endpoint (for quotes + OHLCV history), CoinGecko, Coinbase, Binance, MFAPI.in, and Frankfurter/ECB. |
| **Free‑tier rate limits** | Hammering providers on every page load/refresh quickly hit limits and made the app slow. | Added an **in‑memory TTL cache** (`get_cache/set_cache`) with per‑key expiry, plus a near‑real‑time tick cache (~12 s) and a 30 s profiles cache. |
| **Search was slow (10–17 s)** | The first version live‑priced the *entire* searchable universe on every keystroke. | Switched to a cheap **metadata catalog + cache‑only quotes**, and fixed result ranking (exact ticker/price matches first, crypto demoted unless crypto‑specific). |
| **Profiles screen was slow (8–24 s)** | It computed every profile's full live dashboard **sequentially**. | Parallelized with `asyncio.gather` + a 30 s cache with explicit invalidation on profile changes. |
| **Currency chaos** | Assets priced in USD/EUR/GBP/INR/JPY across many countries. | Everything is normalized to **EUR internally** and converted to your chosen display currency with live FX; FD/property currencies follow sensible per‑country rules. |
| **Genuine technical indicators** | Many apps fake RSI/MACD. | Computed **in‑house** (RSI‑14, MACD‑12/26/9 via EMA + Wilder smoothing, SMA‑50/200, 52‑week range) from real daily price history. |
| **No database, but must be safe** | Wanted zero‑install persistence without corrupting real financial data. | A single JSON store (`state.json`) with atomic load/save, seed data for fresh clones, and periodic backup snapshots. |
| **Per‑profile privacy** | Family members shouldn't see each other's numbers. | Per‑profile isolation + password locking, a manual **Lock button**, and re‑lock on refresh / back‑forward‑cache restore. |
| **Exchange "list every share"** | No single free feed lists *all* world equities. | Used the **Nasdaq Trader** directory (US) and **NSE archives** (India) for full keyless lists; curated major‑company lists for exchanges with no free feed. |

---

## ⚠️ Known Limitations & API Reality Check

Wealth OS is built to run on **100% free, keyless data** — which is great for cost and privacy, but it means some things are intentionally *good‑enough* rather than *institutional‑grade*. Being upfront about exactly what does and doesn't work:

- **Near‑real‑time, not tick‑by‑tick.** Free sources are delayed and polled (the app refreshes on an interval and caches ~12 s), so prices "fluctuate" with a small lag rather than streaming live. **True live streaming needs a paid websocket feed** (e.g. a broker API or a market‑data vendor).
- **Full "all shares of an exchange" is only keyless for some markets.** Complete directories work for **NASDAQ, NYSE, AMEX, NSE India, Crypto, and Indian mutual funds**. For **Frankfurt/XETRA, LSE, Euronext, Tokyo, Hong Kong, ASX**, there is **no free full feed**, so the Exchange browser shows a **curated list of major companies & ETFs** (DAX, FTSE, CAC…). The full lists need a **paid** plan (Finnhub international, EODHD, etc.) — the connector is wired and turns on automatically when a key is added.
- **Finnhub free tier = US only.** International symbol directories and much company data require a **paid** Finnhub plan.
- **Some intraday quotes are server‑blocked.** A handful of exchanges (notably **NSE intraday**) block server‑side calls; those fall back to Yahoo or cached values.
- **Brokers are read‑only scaffolding.** Most retail brokers (**Trading 212, Groww, MF Central, Scalable Capital, Zerodha**) have **no free, official OAuth for third‑party apps**, so live auto‑sync isn't possible without paid/partner access. Use **CSV / statement import** instead (drop a SIP/holdings CSV in the Brokers tab and it auto‑routes).
- **Professional ratings are linked, not reproduced.** Morningstar star ratings, Simply Wall St fair value, GuruFocus DCF, etc. are **deep‑linked** (licensing) rather than shown inside the app — open the link to verify.
- **News is headlines + sources, not full articles.** Google News RSS gives real, sourced headlines and links; full article text/paywalls are out of scope.
- **The AI is an explainable rules‑based quant, not a paid LLM.** The AI Desk's scoring/strategy/advice and the AI CFO answers are **deterministic and transparent** (grounded in your live portfolio) so they need no external LLM subscription — that's a deliberate trade‑off vs. open‑ended generative chat.
- **Single‑file storage = single device.** Without a database there's no multi‑device sync; copy `state.json` to move data. (A Postgres option is on the [Roadmap](#-roadmap).)
- **Profile lock is app‑level, not server auth.** The lock blurs the UI and gates switching; for a true multi‑tenant hosted deployment you'd add real server‑side authentication.

> **Bottom line:** with **no keys at all**, you get reliable live‑ish prices for **US + EU + India stocks/ETFs, all crypto, Indian mutual funds, FX, and gold/silver**. Everything that "doesn't fully work" traces back to a **paid or access‑restricted API**, and each has a clearly‑wired upgrade path the moment a key is supplied.

---

## 📘 User Guide

A friendly, non‑technical **step‑by‑step user guide** ships with the repo — ideal for anyone asking *"the AI Desk is empty, why can't I see anything?"* (answer: add a few **Favorites** first, then the desk analyzes them).

- **[`Wealth-OS-User-Guide.pdf`](./Wealth-OS-User-Guide.pdf)** — printable PDF.
- **[`Wealth-OS-User-Guide.docx`](./Wealth-OS-User-Guide.docx)** — editable Word version.

It covers first‑run setup, a tour of every screen, the **"why is this empty?" troubleshooting FAQ**, how to add holdings/favorites/SIPs, profiles & passwords, currencies, backups, and which markets are live for free.

---

## 🎨 Design System

- **Type:** Inter (body) + Sora (headings) via Google Fonts.
- **Tokens:** CSS custom properties (`--blue`, `--green`, `--red`, `--radius`, `--shadow`, `--line`, …) with `color-mix()` for tints; full **light/dark theme** via `body.light`.
- **Charts:** shared premium helper — gradient line fills, dashed crosshair, styled dark tooltips, rounded color‑coded bars, donut cutouts, and a live hover read‑out header.
- **Motion:** count‑up KPIs, page fades, skeleton loaders, an animated stock‑graph loading sign, and a pulsing "market open" dot.

---

## 🛠 Maintaining This Project

A few conventions to keep the repo healthy:

- **Keep docs in sync with code.** Whenever a feature, endpoint, env var, or dependency changes, update this **README in the same commit** (the section list above is the source of truth for what the app does).
- **Bump the cache version.** After editing `frontend/js/app.js` or `frontend/css/styles.css`, bump the `?v=` query string on both `<link>`/`<script>` tags in `index.html` so browsers fetch the new files.
- **Never commit personal data.** `backend/data/state.json` is gitignored on purpose; the app seeds demo data for fresh clones.
- **One source of state.** All persistence goes through `services/data_store.py` — don't write files elsewhere.
- **Fail soft.** New live‑data calls should always have a cached/fallback path so the dashboard never breaks.

---

## 🗺 Roadmap

- [ ] Persist AI sentiment history → real "15 min / 1 day / 1 week ago" sentiment timeline.
- [ ] Live ticking countdowns for market open/close without re‑selecting.
- [ ] FX‑pair alerts and mini‑sparklines in market rows.
- [ ] Real broker OAuth pulls (currently read‑only scaffolding + CSV/CAS import).
- [ ] Optional database backend (Postgres) for multi‑device sync.
- [ ] Mobile‑native wrapper.

---

## ⚖️ Disclaimer & License

**Disclaimer.** Wealth OS is an **educational and personal‑finance organization tool**. Nothing in it — including AI Desk calls, AI CFO answers, sentiment scores, technical read‑outs, warning signs, and tax estimates — constitutes financial, investment, legal, or tax advice. Markets are risky; verify every figure with primary sources and a qualified professional before acting.

**License.** Released under the **MIT License** — see [`LICENSE`](./LICENSE). Contributions are welcome; see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

<p align="center"><b>Wealth OS</b> — see your whole financial world, clearly. 💎</p>
