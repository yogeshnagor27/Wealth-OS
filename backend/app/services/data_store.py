"""
Wealth OS — Data store (JSON persistence)
=========================================

The app's "database" is a set of module-level Python lists/dicts that mirror the
user's world: profiles, assets (holdings), properties, cashflow, cash_accounts,
savings_plans, watchlist, alerts, broker_details, and the AI Desk state
(ai_weights / ai_calls / ai_events / ai_meta).

- load_data()  : reads backend/data/state.json into the module globals on startup.
- save_data()  : writes the current state back to disk (called after every mutation).
- _state()     : assembles the full snapshot that save_data persists.
- Seed data    : sensible demo profiles/holdings/properties so a fresh clone (with
                 no state.json) still shows a populated, working dashboard.
- relink_orphan_profiles() : migration that re-homes orphaned profile_ids.

state.json is gitignored — it holds personal financial data and is per-install.
"""

from datetime import datetime
import json
import os
from pathlib import Path

fx_static = {"EUR": 1, "USD": 0.92, "INR": 0.011, "GBP": 1.17, "CAD": 0.67, "MXN": 0.05, "CHF": 1.07, "SEK": 0.09, "DKK": 0.13, "NOK": 0.09, "PLN": 0.23, "TRY": 0.03, "JPY": 0.006, "HKD": 0.12, "CNY": 0.13, "TWD": 0.03, "KRW": 0.00067, "SGD": 0.68, "IDR": 0.000056, "THB": 0.025, "MYR": 0.20, "PHP": 0.016, "VND": 0.000036, "AUD": 0.61, "NZD": 0.56, "ILS": 0.25, "SAR": 0.25, "AED": 0.25, "QAR": 0.25, "ZAR": 0.05, "EGP": 0.019, "NGN": 0.0006, "KES": 0.007, "BRL": 0.16, "ARS": 0.0008, "CLP": 0.001, "COP": 0.00022, "PEN": 0.25}

stock_markets = [
    {"code":"GLOBAL","name":"Global / manual / private asset","country":"Global","currency":"EUR","suffix":"","region":"Global"},
    {"code":"CRYPTO","name":"Crypto markets","country":"Crypto","currency":"EUR","suffix":"","region":"Crypto"},
    {"code":"NYSE","name":"New York Stock Exchange","country":"US","currency":"USD","suffix":"","region":"North America"},
    {"code":"NASDAQ","name":"Nasdaq","country":"US","currency":"USD","suffix":"","region":"North America"},
    {"code":"AMEX","name":"NYSE American","country":"US","currency":"USD","suffix":"","region":"North America"},
    {"code":"TSX","name":"Toronto Stock Exchange","country":"Canada","currency":"CAD","suffix":".TO","region":"North America"},
    {"code":"TSXV","name":"TSX Venture Exchange","country":"Canada","currency":"CAD","suffix":".V","region":"North America"},
    {"code":"BMV","name":"Mexican Stock Exchange","country":"Mexico","currency":"MXN","suffix":".MX","region":"North America"},
    {"code":"LSE","name":"London Stock Exchange","country":"UK","currency":"GBP","suffix":".L","region":"Europe"},
    {"code":"AIM","name":"London AIM","country":"UK","currency":"GBP","suffix":".L","region":"Europe"},
    {"code":"XETRA","name":"Deutsche Borse Xetra","country":"Germany","currency":"EUR","suffix":".DE","region":"Europe"},
    {"code":"FWB","name":"Frankfurt Stock Exchange","country":"Germany","currency":"EUR","suffix":".F","region":"Europe"},
    {"code":"PAR","name":"Euronext Paris","country":"France","currency":"EUR","suffix":".PA","region":"Europe"},
    {"code":"AMS","name":"Euronext Amsterdam","country":"Netherlands","currency":"EUR","suffix":".AS","region":"Europe"},
    {"code":"BRU","name":"Euronext Brussels","country":"Belgium","currency":"EUR","suffix":".BR","region":"Europe"},
    {"code":"LIS","name":"Euronext Lisbon","country":"Portugal","currency":"EUR","suffix":".LS","region":"Europe"},
    {"code":"MIL","name":"Borsa Italiana","country":"Italy","currency":"EUR","suffix":".MI","region":"Europe"},
    {"code":"MAD","name":"Bolsa de Madrid","country":"Spain","currency":"EUR","suffix":".MC","region":"Europe"},
    {"code":"SIX","name":"SIX Swiss Exchange","country":"Switzerland","currency":"CHF","suffix":".SW","region":"Europe"},
    {"code":"STO","name":"Nasdaq Stockholm","country":"Sweden","currency":"SEK","suffix":".ST","region":"Europe"},
    {"code":"CPH","name":"Nasdaq Copenhagen","country":"Denmark","currency":"DKK","suffix":".CO","region":"Europe"},
    {"code":"HEL","name":"Nasdaq Helsinki","country":"Finland","currency":"EUR","suffix":".HE","region":"Europe"},
    {"code":"OSL","name":"Oslo Stock Exchange","country":"Norway","currency":"NOK","suffix":".OL","region":"Europe"},
    {"code":"WSE","name":"Warsaw Stock Exchange","country":"Poland","currency":"PLN","suffix":".WA","region":"Europe"},
    {"code":"VIE","name":"Vienna Stock Exchange","country":"Austria","currency":"EUR","suffix":".VI","region":"Europe"},
    {"code":"ATH","name":"Athens Stock Exchange","country":"Greece","currency":"EUR","suffix":".AT","region":"Europe"},
    {"code":"IST","name":"Borsa Istanbul","country":"Turkey","currency":"TRY","suffix":".IS","region":"Europe / Middle East"},
    {"code":"NSE","name":"National Stock Exchange of India","country":"India","currency":"INR","suffix":".NS","region":"Asia"},
    {"code":"BSE","name":"Bombay Stock Exchange","country":"India","currency":"INR","suffix":".BO","region":"Asia"},
    {"code":"TSE","name":"Tokyo Stock Exchange","country":"Japan","currency":"JPY","suffix":".T","region":"Asia"},
    {"code":"HKEX","name":"Hong Kong Exchange","country":"Hong Kong","currency":"HKD","suffix":".HK","region":"Asia"},
    {"code":"SSE","name":"Shanghai Stock Exchange","country":"China","currency":"CNY","suffix":".SS","region":"Asia"},
    {"code":"SZSE","name":"Shenzhen Stock Exchange","country":"China","currency":"CNY","suffix":".SZ","region":"Asia"},
    {"code":"TWSE","name":"Taiwan Stock Exchange","country":"Taiwan","currency":"TWD","suffix":".TW","region":"Asia"},
    {"code":"KRX","name":"Korea Exchange","country":"South Korea","currency":"KRW","suffix":".KS","region":"Asia"},
    {"code":"SGX","name":"Singapore Exchange","country":"Singapore","currency":"SGD","suffix":".SI","region":"Asia"},
    {"code":"IDX","name":"Indonesia Stock Exchange","country":"Indonesia","currency":"IDR","suffix":".JK","region":"Asia"},
    {"code":"SET","name":"Stock Exchange of Thailand","country":"Thailand","currency":"THB","suffix":".BK","region":"Asia"},
    {"code":"MYX","name":"Bursa Malaysia","country":"Malaysia","currency":"MYR","suffix":".KL","region":"Asia"},
    {"code":"PSE","name":"Philippine Stock Exchange","country":"Philippines","currency":"PHP","suffix":".PS","region":"Asia"},
    {"code":"HOSE","name":"Ho Chi Minh Stock Exchange","country":"Vietnam","currency":"VND","suffix":".VN","region":"Asia"},
    {"code":"ASX","name":"Australian Securities Exchange","country":"Australia","currency":"AUD","suffix":".AX","region":"Oceania"},
    {"code":"NZX","name":"New Zealand Exchange","country":"New Zealand","currency":"NZD","suffix":".NZ","region":"Oceania"},
    {"code":"TASE","name":"Tel Aviv Stock Exchange","country":"Israel","currency":"ILS","suffix":".TA","region":"Middle East"},
    {"code":"TADAWUL","name":"Saudi Exchange","country":"Saudi Arabia","currency":"SAR","suffix":".SR","region":"Middle East"},
    {"code":"DFM","name":"Dubai Financial Market","country":"UAE","currency":"AED","suffix":".AE","region":"Middle East"},
    {"code":"ADX","name":"Abu Dhabi Securities Exchange","country":"UAE","currency":"AED","suffix":".AD","region":"Middle East"},
    {"code":"QSE","name":"Qatar Stock Exchange","country":"Qatar","currency":"QAR","suffix":".QA","region":"Middle East"},
    {"code":"JSE","name":"Johannesburg Stock Exchange","country":"South Africa","currency":"ZAR","suffix":".JO","region":"Africa"},
    {"code":"EGX","name":"Egyptian Exchange","country":"Egypt","currency":"EGP","suffix":".CA","region":"Africa"},
    {"code":"NGX","name":"Nigerian Exchange","country":"Nigeria","currency":"NGN","suffix":".LG","region":"Africa"},
    {"code":"NSEKENYA","name":"Nairobi Securities Exchange","country":"Kenya","currency":"KES","suffix":".NR","region":"Africa"},
    {"code":"B3","name":"B3 Brazil","country":"Brazil","currency":"BRL","suffix":".SA","region":"South America"},
    {"code":"BCBA","name":"Buenos Aires Stock Exchange","country":"Argentina","currency":"ARS","suffix":".BA","region":"South America"},
    {"code":"BCS","name":"Santiago Stock Exchange","country":"Chile","currency":"CLP","suffix":".SN","region":"South America"},
    {"code":"BVC","name":"Colombia Stock Exchange","country":"Colombia","currency":"COP","suffix":".CO","region":"South America"},
    {"code":"BVL","name":"Lima Stock Exchange","country":"Peru","currency":"PEN","suffix":".LM","region":"South America"},
]

funds_bonds_india = [
    {"symbol":"PARAGFLEXI","name":"Parag Parikh Flexi Cap Fund","type":"Mutual Fund","category":"Flexi Cap","market":"MFINDIA","country":"India","currency":"INR","risk":"High","one_year":28.4,"three_year":21.2,"expense":0.63,"aum_cr":72000,"platforms":["Groww","MF Central","Zerodha Coin"]},
    {"symbol":"MOTILALMID","name":"Motilal Oswal Midcap Fund","type":"Mutual Fund","category":"Mid Cap","market":"MFINDIA","country":"India","currency":"INR","risk":"Very High","one_year":41.5,"three_year":27.8,"expense":0.58,"aum_cr":18000,"platforms":["Groww","MF Central"]},
    {"symbol":"NIPPONSMALL","name":"Nippon India Small Cap Fund","type":"Mutual Fund","category":"Small Cap","market":"MFINDIA","country":"India","currency":"INR","risk":"Very High","one_year":35.2,"three_year":29.1,"expense":0.79,"aum_cr":61000,"platforms":["Groww","MF Central"]},
    {"symbol":"UTINIFTY50","name":"UTI Nifty 50 Index Fund","type":"Mutual Fund","category":"Index Fund","market":"MFINDIA","country":"India","currency":"INR","risk":"High","one_year":14.2,"three_year":15.7,"expense":0.21,"aum_cr":16500,"platforms":["Groww","MF Central","Zerodha Coin"]},
    {"symbol":"HDFCBALADV","name":"HDFC Balanced Advantage Fund","type":"Mutual Fund","category":"Hybrid","market":"MFINDIA","country":"India","currency":"INR","risk":"Moderately High","one_year":18.1,"three_year":16.4,"expense":0.76,"aum_cr":89000,"platforms":["Groww","MF Central"]},
    {"symbol":"SBIGILT","name":"SBI Magnum Gilt Fund","type":"Mutual Fund","category":"Debt / Gilt","market":"MFINDIA","country":"India","currency":"INR","risk":"Moderate","one_year":7.4,"three_year":6.2,"expense":0.47,"aum_cr":8500,"platforms":["Groww","MF Central"]},
    {"symbol":"GOI2034","name":"Government of India Bond 2034","type":"Bond","category":"Sovereign Bond","market":"BONDINDIA","country":"India","currency":"INR","risk":"Low","coupon":7.18,"maturity":"2034","yield":7.05,"platforms":["RBI Retail Direct","Broker"]},
    {"symbol":"SGB2028","name":"Sovereign Gold Bond 2028","type":"Bond","category":"Gold Bond","market":"BONDINDIA","country":"India","currency":"INR","risk":"Moderate","coupon":2.5,"maturity":"2028","yield":0,"platforms":["RBI Retail Direct","Broker"]},
    {"symbol":"HUDCO2029","name":"HUDCO Tax Free Bond 2029","type":"Bond","category":"Tax Free Bond","market":"BONDINDIA","country":"India","currency":"INR","risk":"Moderate","coupon":7.64,"maturity":"2029","yield":6.1,"platforms":["Broker"]},
]

profiles = [
    {"id": "me", "name": "Yogesh", "relation": "Self", "country": "Germany", "avatar": "YN"},
    {"id": "father", "name": "Father", "relation": "Father", "country": "India", "avatar": "FT"},
    {"id": "mother", "name": "Mother", "relation": "Mother", "country": "India", "avatar": "MT"},
    {"id": "sister", "name": "Sister", "relation": "Sister", "country": "India", "avatar": "SR"},
]

assets = [
    {"symbol":"NVDA","yahoo":"NVDA","name":"Nvidia","type":"Stock","price":142.8,"day":3.4,"week":7.2,"month":18.1,"year":165.0,"currency":"USD","sector":"Technology","country":"US","profile_id":"me","qty":12,"avg":98,"broker":"IBKR","dividend_yield":0.03},
    {"symbol":"AAPL","yahoo":"AAPL","name":"Apple","type":"Stock","price":212.4,"day":-0.8,"week":1.5,"month":4.2,"year":20.4,"currency":"USD","sector":"Technology","country":"US","profile_id":"me","qty":8,"avg":170,"broker":"Trading 212","dividend_yield":0.45},
    {"symbol":"MSFT","yahoo":"MSFT","name":"Microsoft","type":"Stock","price":478.1,"day":1.1,"week":3.2,"month":8.5,"year":28.7,"currency":"USD","sector":"Technology","country":"US","profile_id":"me","qty":5,"avg":330,"broker":"IBKR","dividend_yield":0.65},
    {"symbol":"TSLA","yahoo":"TSLA","name":"Tesla","type":"Stock","price":178.6,"day":-4.6,"week":-9.1,"month":-14.5,"year":-22.0,"currency":"USD","sector":"Automotive","country":"US","profile_id":"me","qty":4,"avg":220,"broker":"Trading 212","dividend_yield":0},
    {"symbol":"VUAA","yahoo":"VUAA.DE","name":"S&P 500 UCITS ETF","type":"ETF","price":105.2,"day":0.7,"week":1.8,"month":5,"year":18.0,"currency":"EUR","sector":"ETF","country":"Global","profile_id":"me","qty":42,"avg":82,"broker":"Scalable Capital","dividend_yield":1.25},
    {"symbol":"EUNL","yahoo":"EUNL.DE","name":"MSCI World ETF","type":"ETF","price":103.1,"day":0.5,"week":1.3,"month":4.1,"year":15.2,"currency":"EUR","sector":"ETF","country":"Global","profile_id":"me","qty":38,"avg":88,"broker":"Trading 212","dividend_yield":1.4},
    {"symbol":"BTC","yahoo":"BTC-EUR","name":"Bitcoin","type":"Crypto","price":89000,"day":2.8,"week":5.2,"month":12.5,"year":86.0,"currency":"EUR","sector":"Crypto","country":"Crypto","profile_id":"me","qty":0.05,"avg":60000,"broker":"Coinbase","dividend_yield":0},
    {"symbol":"ETH","yahoo":"ETH-EUR","name":"Ethereum","type":"Crypto","price":3600,"day":-1.2,"week":3,"month":9.6,"year":72.0,"currency":"EUR","sector":"Crypto","country":"Crypto","profile_id":"me","qty":1.2,"avg":2400,"broker":"Coinbase","dividend_yield":0},
    {"symbol":"INFLEXI","yahoo":"","name":"India Flexi Cap Fund","type":"Mutual Fund","price":137,"day":0.4,"week":1.1,"month":3.6,"year":22.0,"currency":"INR","sector":"Mutual Fund","country":"India","profile_id":"father","qty":1500,"avg":100,"broker":"Groww","dividend_yield":0},
    {"symbol":"NIFTY50","yahoo":"^NSEI","name":"Nifty 50 Index Fund","type":"Mutual Fund","price":205,"day":-0.2,"week":0.8,"month":2.8,"year":14.0,"currency":"INR","sector":"Index Fund","country":"India","profile_id":"father","qty":800,"avg":145,"broker":"Zerodha Coin","dividend_yield":0},
    {"symbol":"GOLD","yahoo":"GC=F","name":"Gold","type":"Gold","price":7200,"day":1.4,"week":2,"month":6.2,"year":31.0,"currency":"INR","sector":"Gold","country":"India","profile_id":"sister","qty":100,"avg":5600,"broker":"Manual","dividend_yield":0},
]

watchlist = [
    {"symbol":"META","yahoo":"META","name":"Meta","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"AVGO","yahoo":"AVGO","name":"Broadcom","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"TSM","yahoo":"TSM","name":"TSMC","type":"Stock","sector":"Technology","country":"Taiwan"},
    {"symbol":"JPM","yahoo":"JPM","name":"JPMorgan","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"V","yahoo":"V","name":"Visa","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"SAP","yahoo":"SAP.DE","name":"SAP","type":"Stock","sector":"Technology","country":"Germany"},
    {"symbol":"SIE","yahoo":"SIE.DE","name":"Siemens","type":"Stock","sector":"Industrial","country":"Germany"},
    {"symbol":"RELIANCE","yahoo":"RELIANCE.NS","name":"Reliance","type":"Stock","sector":"Energy","country":"India"},
    {"symbol":"HDFCBANK","yahoo":"HDFCBANK.NS","name":"HDFC Bank","type":"Stock","sector":"Finance","country":"India"},
    {"symbol":"INFY","yahoo":"INFY.NS","name":"Infosys","type":"Stock","sector":"Technology","country":"India"},
    {"symbol":"TCS","yahoo":"TCS.NS","name":"TCS","type":"Stock","sector":"Technology","country":"India"},
    {"symbol":"BMW","yahoo":"BMW.DE","name":"BMW","type":"Stock","sector":"Automotive","country":"Germany"},
    {"symbol":"MBG","yahoo":"MBG.DE","name":"Mercedes-Benz","type":"Stock","sector":"Automotive","country":"Germany"},
    {"symbol":"BTC","yahoo":"BTC-EUR","name":"Bitcoin","type":"Crypto","sector":"Crypto","country":"Crypto"},
    {"symbol":"ETH","yahoo":"ETH-EUR","name":"Ethereum","type":"Crypto","sector":"Crypto","country":"Crypto"},
]

properties = [
    {"id":1,"profile_id":"father","name":"Family Flat Indore","category":"Flat","location":"Indore, India","value":6800000,"currency":"INR","growth":7,"rent":18000,"loan":0,"area":"1250 sqft"},
    {"id":2,"profile_id":"father","name":"Agricultural Land","category":"Land","location":"Madhya Pradesh, India","value":5600000,"currency":"INR","growth":8.5,"rent":0,"loan":0,"area":"2.5 acre"},
    {"id":3,"profile_id":"me","name":"Future Germany House Goal","category":"Future Property","location":"Bavaria, Germany","value":520000,"currency":"EUR","growth":3.5,"rent":0,"loan":0,"area":"90 sqm"},
]
cashflow = [
    {"profile_id":"me","category":"Salary","amount":5800,"currency":"EUR","type":"income"},
    {"profile_id":"me","category":"Rent","amount":1250,"currency":"EUR","type":"expense"},
    {"profile_id":"me","category":"Groceries","amount":420,"currency":"EUR","type":"expense"},
    {"profile_id":"me","category":"Investments","amount":1900,"currency":"EUR","type":"investment"},
]
alerts = [
    {"symbol":"NVDA","condition":"above","target":150,"status":"active"},
    {"symbol":"BTC","condition":"above","target":95000,"status":"active"},
]
savings_plans = [
    {"id": 1, "profile_id": "me", "name": "Emergency Fund", "target": 25000, "current": 18500, "currency": "EUR", "monthly": 700, "priority": "High"},
    {"id": 2, "profile_id": "me", "name": "Germany House Down Payment", "target": 120000, "current": 22000, "currency": "EUR", "monthly": 1200, "priority": "High"},
    {"id": 3, "profile_id": "me", "name": "Family Support India", "target": 1500000, "current": 350000, "currency": "INR", "monthly": 30000, "priority": "Medium"},
]
# Mutual-fund SIP plans (recurring) + lumpsum entries. current value/units are
# simulated from real AMFI NAV history in main.py (compute_sip).
sips = []
cash_accounts = [
    {"id": 1, "profile_id": "me", "name": "Main Bank Cash", "balance": 8500, "currency": "EUR", "type": "Checking"},
    {"id": 2, "profile_id": "me", "name": "Emergency Cash", "balance": 10000, "currency": "EUR", "type": "Savings"},
    {"id": 3, "profile_id": "father", "name": "India Cash Reserve", "balance": 250000, "currency": "INR", "type": "Savings"},
]
life = {"blue_card_start":"2023-12-01","months_worked_germany":28,"pr_required_months":33,"citizenship_target_year":2029,"emergency_target":25000,"emergency_current":18500}

# ===== AI Investment Desk (multi-agent brain) persistent memory =====
# Adaptive factor weights the rater agent tunes over time from past hit-rate.
ai_weights = {"trend": 1.0, "momentum": 1.0, "value": 1.0, "quality": 1.0, "risk": 1.0, "income": 0.5}
# Logged recommendations the user acted on, with entry price + outcome tracking.
ai_calls = []          # [{id, symbol, action, entry, target, stop, score, factors, opened, status, outcome, pl_pct, closed}]
# Rolling event log from the 24/7 watcher (new buy signals, downturn warnings).
ai_events = []         # [{id, ts, symbol, kind, title, text, sev}]
ai_meta = {"last_run": "", "runs": 0}

# Broker API credentials the user enters in the UI (per broker), e.g.
# {"trading 212": {"api_key": "..."}, "zerodha": {"api_key": "...", "access_token": "..."}}.
# Used by the broker connectors for live sync; falls back to env vars if empty.
broker_credentials = {}

# Market-data API keys the user pastes in the UI to unlock extra/redundant providers
# (Twelve Data, Finnhub, Alpha Vantage). Falls back to env vars. Keyless providers
# (Yahoo, CoinGecko, ECB/er-api FX, MFAPI) always work without these.
market_data_keys = {}

broker_details = [
    {"id": 1, "profile_id": "001", "broker": "Groww", "market": "India market", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "pan": "", "gender": "", "dob": "", "notes": "Do not store passwords here. Record where recovery documents are kept."},
    {"id": 2, "profile_id": "001", "broker": "MF Central", "market": "India mutual funds", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "pan": "", "gender": "", "dob": "", "folio_hint": "", "notes": ""},
    {"id": 3, "profile_id": "001", "broker": "IBKR", "market": "Global broker", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "account_id": "", "tax_id": "", "gender": "", "dob": "", "notes": ""},
    {"id": 4, "profile_id": "001", "broker": "Scalable Capital", "market": "Germany broker", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "iban": "", "tax_id": "", "gender": "", "dob": "", "notes": ""},
    {"id": 5, "profile_id": "001", "broker": "Trading 212", "market": "EU/UK broker", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "account_id": "", "tax_id": "", "gender": "", "dob": "", "notes": ""},
    {"id": 6, "profile_id": "001", "broker": "WazirX", "market": "India crypto", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "pan": "", "kyc_status": "", "gender": "", "dob": "", "notes": ""},
    {"id": 7, "profile_id": "001", "broker": "Coinbase", "market": "Global crypto", "beneficiary": "Pooja", "beneficiary_relation": "Sister", "knows_credentials": True, "registered_mobile": "", "registered_email": "", "account_id": "", "kyc_status": "", "gender": "", "dob": "", "notes": ""}
]

global_universe = [
    {"symbol":"AAPL","yahoo":"AAPL","name":"Apple","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"MSFT","yahoo":"MSFT","name":"Microsoft","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"NVDA","yahoo":"NVDA","name":"Nvidia","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"GOOGL","yahoo":"GOOGL","name":"Alphabet","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"GOOG","yahoo":"GOOG","name":"Alphabet Class C","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"AMZN","yahoo":"AMZN","name":"Amazon","type":"Stock","sector":"Consumer","country":"US"},
    {"symbol":"META","yahoo":"META","name":"Meta Platforms","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"AVGO","yahoo":"AVGO","name":"Broadcom","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"TSLA","yahoo":"TSLA","name":"Tesla","type":"Stock","sector":"Automotive","country":"US"},
    {"symbol":"BRK.B","yahoo":"BRK-B","name":"Berkshire Hathaway","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"TSM","yahoo":"TSM","name":"TSMC","type":"Stock","sector":"Technology","country":"Taiwan"},
    {"symbol":"LLY","yahoo":"LLY","name":"Eli Lilly","type":"Stock","sector":"Healthcare","country":"US"},
    {"symbol":"JPM","yahoo":"JPM","name":"JPMorgan Chase","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"V","yahoo":"V","name":"Visa","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"WMT","yahoo":"WMT","name":"Walmart","type":"Stock","sector":"Consumer","country":"US"},
    {"symbol":"XOM","yahoo":"XOM","name":"Exxon Mobil","type":"Stock","sector":"Energy","country":"US"},
    {"symbol":"MA","yahoo":"MA","name":"Mastercard","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"UNH","yahoo":"UNH","name":"UnitedHealth","type":"Stock","sector":"Healthcare","country":"US"},
    {"symbol":"ORCL","yahoo":"ORCL","name":"Oracle","type":"Stock","sector":"Technology","country":"US"},
    {"symbol":"COST","yahoo":"COST","name":"Costco","type":"Stock","sector":"Consumer","country":"US"},
    {"symbol":"NFLX","yahoo":"NFLX","name":"Netflix","type":"Stock","sector":"Communication","country":"US"},
    {"symbol":"PG","yahoo":"PG","name":"Procter & Gamble","type":"Stock","sector":"Consumer","country":"US"},
    {"symbol":"JNJ","yahoo":"JNJ","name":"Johnson & Johnson","type":"Stock","sector":"Healthcare","country":"US"},
    {"symbol":"HD","yahoo":"HD","name":"Home Depot","type":"Stock","sector":"Consumer","country":"US"},
    {"symbol":"ABBV","yahoo":"ABBV","name":"AbbVie","type":"Stock","sector":"Healthcare","country":"US"},
    {"symbol":"BAC","yahoo":"BAC","name":"Bank of America","type":"Stock","sector":"Finance","country":"US"},
    {"symbol":"SAP","yahoo":"SAP.DE","name":"SAP","type":"Stock","sector":"Technology","country":"Germany"},
    {"symbol":"ASML","yahoo":"ASML.AS","name":"ASML","type":"Stock","sector":"Technology","country":"Netherlands"},
    {"symbol":"NVO","yahoo":"NVO","name":"Novo Nordisk","type":"Stock","sector":"Healthcare","country":"Denmark"},
    {"symbol":"NESN","yahoo":"NESN.SW","name":"Nestle","type":"Stock","sector":"Consumer","country":"Switzerland"},
    {"symbol":"MC","yahoo":"MC.PA","name":"LVMH","type":"Stock","sector":"Luxury","country":"France"},
    {"symbol":"SIE","yahoo":"SIE.DE","name":"Siemens","type":"Stock","sector":"Industrial","country":"Germany"},
    {"symbol":"SHEL","yahoo":"SHEL.L","name":"Shell","type":"Stock","sector":"Energy","country":"UK"},
    {"symbol":"AZN","yahoo":"AZN.L","name":"AstraZeneca","type":"Stock","sector":"Healthcare","country":"UK"},
    {"symbol":"TM","yahoo":"TM","name":"Toyota","type":"Stock","sector":"Automotive","country":"Japan"},
    {"symbol":"SONY","yahoo":"SONY","name":"Sony","type":"Stock","sector":"Technology","country":"Japan"},
    {"symbol":"TCEHY","yahoo":"TCEHY","name":"Tencent","type":"Stock","sector":"Technology","country":"China"},
    {"symbol":"BABA","yahoo":"BABA","name":"Alibaba","type":"Stock","sector":"Consumer","country":"China"},
    {"symbol":"RELIANCE","yahoo":"RELIANCE.NS","name":"Reliance Industries","type":"Stock","sector":"Energy","country":"India"},
    {"symbol":"TCS","yahoo":"TCS.NS","name":"Tata Consultancy Services","type":"Stock","sector":"Technology","country":"India"},
    {"symbol":"HDFCBANK","yahoo":"HDFCBANK.NS","name":"HDFC Bank","type":"Stock","sector":"Finance","country":"India"},
    {"symbol":"ICICIBANK","yahoo":"ICICIBANK.NS","name":"ICICI Bank","type":"Stock","sector":"Finance","country":"India"},
    {"symbol":"INFY","yahoo":"INFY.NS","name":"Infosys","type":"Stock","sector":"Technology","country":"India"},
    {"symbol":"BTC","yahoo":"BTC-EUR","name":"Bitcoin","type":"Crypto","sector":"Crypto","country":"Crypto"},
    {"symbol":"ETH","yahoo":"ETH-EUR","name":"Ethereum","type":"Crypto","sector":"Crypto","country":"Crypto"},
    {"symbol":"SOL","yahoo":"SOL-EUR","name":"Solana","type":"Crypto","sector":"Crypto","country":"Crypto"},
    {"symbol":"BNB","yahoo":"BNB-EUR","name":"BNB","type":"Crypto","sector":"Crypto","country":"Crypto"},
    {"symbol":"XRP","yahoo":"XRP-EUR","name":"XRP","type":"Crypto","sector":"Crypto","country":"Crypto"},
    {"symbol":"GOLD","yahoo":"GC=F","name":"Gold Futures","type":"Gold","sector":"Commodity","country":"Global"},
]

DATA_FILE = Path(os.getenv("WEALTH_OS_DATA_FILE", Path(__file__).resolve().parents[2] / "data" / "state.json"))

# Yahoo quotes some markets in minor units (e.g. GBp = pence = 1/100 GBP)
MINOR_UNITS = {"GBP": "GBP", "GBX": "GBP", "ZAC": "ZAR", "ILA": "ILS", "KWF": "KWD"}

def normalize_currency(value, currency):
    """Return (value_in_major_unit, major_currency_code) handling pence/cents."""
    if not currency:
        return value, currency
    code = currency.strip()
    # GBp / GBX etc. are lowercase-minor variants; detect by exact GBp or known minor codes
    if code == "GBp" or code.upper() in MINOR_UNITS and code != code.upper():
        return value / 100.0, MINOR_UNITS.get(code.upper(), code.upper())
    if code in {"GBX", "ZAc", "ILA"}:
        return value / 100.0, MINOR_UNITS.get(code.upper(), code.upper())
    return value, code

def eur(value, currency, live_fx=None):
    value, currency = normalize_currency(value, currency)
    if currency == "EUR":
        return round(value, 2)
    if live_fx and currency in live_fx:
        return round(value / live_fx[currency], 2)
    return round(value * fx_static.get(currency, 1), 2)

def avatar_for(name):
    return "".join([p[0] for p in name.split() if p])[:2].upper() or "PF"

def slugify(value):
    slug = "".join(ch.lower() if ch.isalnum() else "_" for ch in value.strip())
    slug = "_".join(part for part in slug.split("_") if part)
    return slug or "profile"

def next_numeric_id(rows):
    ids = [int(x.get("id", 0)) for x in rows if str(x.get("id", "")).isdigit()]
    return (max(ids) if ids else 0) + 1

def infer_market(row):
    if row.get("market"):
        return row["market"]
    yahoo = row.get("yahoo", "")
    country = row.get("country", "")
    if row.get("type") == "Crypto" or country == "Crypto":
        return "CRYPTO"
    for market in stock_markets:
        suffix = market.get("suffix", "")
        if suffix and yahoo.endswith(suffix):
            return market["code"]
    if country in {"US", "United States"}:
        return "NASDAQ"
    if country == "India":
        return "NSE"
    if country == "Germany":
        return "XETRA"
    if country == "UK":
        return "LSE"
    return "GLOBAL"

def _state():
    return {
        "profiles": profiles,
        "assets": assets,
        "watchlist": watchlist,
        "properties": properties,
        "cashflow": cashflow,
        "alerts": alerts,
        "savings_plans": savings_plans,
        "cash_accounts": cash_accounts,
        "life": life,
        "broker_details": broker_details,
        "ai_weights": ai_weights,
        "ai_calls": ai_calls,
        "ai_events": ai_events,
        "ai_meta": ai_meta,
        "broker_credentials": broker_credentials,
        "market_data_keys": market_data_keys,
        "sips": sips,
    }

def save_data():
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(_state(), indent=2), encoding="utf-8")
    tmp.replace(DATA_FILE)

def load_data():
    if not DATA_FILE.exists():
        save_data()
        return
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup = DATA_FILE.with_suffix(f".broken-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json")
        DATA_FILE.replace(backup)
        save_data()
        return
    profiles[:] = data.get("profiles", profiles)
    for p in profiles:
        p.setdefault("photo_url", "")
        p.setdefault("password", "")
    assets[:] = data.get("assets", assets)
    for a in assets:
        a.setdefault("market", infer_market(a))
    watchlist[:] = data.get("watchlist", watchlist)
    for a in watchlist:
        a.setdefault("market", infer_market(a))
    for a in global_universe:
        a.setdefault("market", infer_market(a))
    properties[:] = data.get("properties", properties)
    for p in properties:
        p.setdefault("status", "active")
        p.setdefault("purchase_value", 0)
        p.setdefault("purchase_year", 0)
        p.setdefault("purchase_date", "")
        p.setdefault("valuation_date", "")
        p.setdefault("forecast_year", 0)
        p.setdefault("renovation_cost", 0)
        p.setdefault("yearly_tax", 0)
        p.setdefault("yearly_maintenance", 0)
        p.setdefault("bedrooms", 0)
        p.setdefault("quantity", 0)
        p.setdefault("unit", "")
        p.setdefault("maker", "")
        p.setdefault("model", "")
        p.setdefault("registration_year", 0)
        p.setdefault("notes", "")
        p.setdefault("mileage_km", 0)
        p.setdefault("condition", "")
        p.setdefault("currency_manual", False)
        p.setdefault("main_road", "")
        p.setdefault("metro_distance_km", 0)
        p.setdefault("hospital_distance_km", 0)
        p.setdefault("mall_distance_km", 0)
        p.setdefault("school_distance_km", 0)
        p.setdefault("police_distance_km", 0)
        p.setdefault("grocery_distance_km", 0)
        p.setdefault("transit_distance_km", 0)
        p.setdefault("comparable_rate", 0)
        p.setdefault("rental_demand", "")
        p.setdefault("bank", "")
        p.setdefault("interest_rate", 0)
        p.setdefault("maturity_date", "")
        p.setdefault("value_manual", False)
        p.setdefault("rental_status", "")
        p.setdefault("tenant", "")
        p.setdefault("lease_end", "")
        p.setdefault("deposit", 0)
        p.setdefault("disposition_action", "")
        p.setdefault("disposition_to", "")
        p.setdefault("disposition_amount", 0)
        p.setdefault("disposition_currency", p.get("currency", "EUR"))
        p.setdefault("disposition_tax_paid", 0)
        p.setdefault("disposition_fees", 0)
        p.setdefault("disposition_date", "")
        p.setdefault("disposition_notes", "")
        p.setdefault("net_proceeds", 0)
    cashflow[:] = data.get("cashflow", cashflow)
    broker_details[:] = data.get("broker_details", broker_details)
    for i, b in enumerate(broker_details, 1):
        b.setdefault("id", i)
        b.setdefault("profile_id", "001")
        b.setdefault("beneficiary", "")
        b.setdefault("beneficiary_relation", "")
        b.setdefault("knows_credentials", False)
        b.setdefault("registered_mobile", "")
        b.setdefault("registered_email", "")
        b.setdefault("notes", "")
    alerts[:] = data.get("alerts", alerts)
    savings_plans[:] = data.get("savings_plans", savings_plans)
    cash_accounts[:] = data.get("cash_accounts", cash_accounts)
    life.update(data.get("life", life))
    ai_weights.update(data.get("ai_weights", {}))
    ai_calls[:] = data.get("ai_calls", ai_calls)
    ai_events[:] = data.get("ai_events", ai_events)
    ai_meta.update(data.get("ai_meta", {}))
    broker_credentials.update(data.get("broker_credentials", {}))
    market_data_keys.update(data.get("market_data_keys", {}))
    sips[:] = data.get("sips", sips)
    for i, sp in enumerate(sips, 1):
        sp.setdefault("id", i)
        sp.setdefault("profile_id", "001")
        sp.setdefault("kind", "SIP")
        sp.setdefault("frequency", "Monthly")
        sp.setdefault("status", "active")
        sp.setdefault("symbol", "")
        sp.setdefault("notes", "")
    ensure_seed_profiles()
    relink_orphan_profiles()

def relink_orphan_profiles():
    """Holdings/property/cash tagged to a non-existent profile id (e.g. legacy 'me')
    are re-homed onto the self/admin profile so they belong to a real member."""
    ids = {p.get("id") for p in profiles}
    if not ids:
        return
    self_profile = next((p for p in profiles if str(p.get("relation", "")).lower() == "self"), profiles[0])
    target = self_profile.get("id")
    changed = False
    for collection in (assets, properties, cashflow, savings_plans, cash_accounts):
        for row in collection:
            pid = row.get("profile_id")
            if pid and pid not in ids:
                row["profile_id"] = target
                changed = True
    if changed:
        save_data()

def ensure_seed_profiles():
    # Truly fresh install (no profiles at all) → seed a starter family.
    if not profiles:
        profiles.extend([
            {"id": "me", "name": "Yogesh", "relation": "Self", "country": "Germany", "avatar": "YN"},
            {"id": "father", "name": "Father", "relation": "Father", "country": "India", "avatar": "FT"},
            {"id": "mother", "name": "Mother", "relation": "Mother", "country": "India", "avatar": "MT"},
            {"id": "sister", "name": "Sister", "relation": "Sister", "country": "India", "avatar": "SR"},
        ])
        save_data()
        return
    # Existing data: only guarantee an admin/self profile exists. Never resurrect
    # family members the user has deleted on purpose.
    if not any(p.get("relation", "").lower() == "self" for p in profiles):
        profiles.insert(0, {"id": "me", "name": "Yogesh", "relation": "Self", "country": "Germany", "avatar": "YN"})
        save_data()
