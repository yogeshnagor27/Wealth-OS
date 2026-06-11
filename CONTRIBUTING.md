# Contributing to Wealth OS

Thanks for your interest in improving Wealth OS! This is a personal-finance
dashboard with a FastAPI backend and a dependency-free vanilla-JS frontend.
Contributions of all sizes are welcome — bug fixes, new data sources, UI polish,
translations, and docs.

---

## Project layout

```
backend/   FastAPI app (single main.py), live-data integrations, JSON store
frontend/  Static SPA — index.html + js/app.js + css/styles.css (no build step)
docs/      User-guide generator (docs/generate_guide.py)
samples/   Example import files (e.g. SIP CSV)
```

See [README.md](./README.md) for the full architecture, tech stack, and API overview.

## Getting set up

**Backend**
```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend** (any static server)
```bash
cd frontend
python -m http.server 3000
```

Open http://localhost:3000. No API keys are required — the app uses free public
data and falls back to sample/cached data when a key would be needed.

## House rules (please follow these)

These keep the repo healthy and match the conventions already in the codebase:

1. **Keep docs in sync with code.** If you change a feature, endpoint, env var,
   or dependency, update `README.md` in the same PR. If the change is user-facing,
   update the guide source in `docs/generate_guide.py` and regenerate the docs
   (see below).
2. **Bump the cache version.** After editing `frontend/js/app.js` or
   `frontend/css/styles.css`, bump the `?v=` query string on **both** the
   `<link>` and `<script>` tags in `frontend/index.html` so browsers fetch the
   new files.
3. **Never commit personal data.** `backend/data/state.json` is gitignored on
   purpose — it holds real financial data and profile passwords. The app seeds
   demo data for fresh clones. Back up before any destructive change.
4. **One source of state.** All persistence goes through
   `backend/app/services/data_store.py`. Don't write files elsewhere.
5. **Fail soft.** Every new live-data call must have a cached/fallback path so
   the dashboard never breaks if a provider is down or rate-limited.
6. **Test edge cases, not just the happy path.** Validate invalid/negative
   inputs; the backend returns `4xx` for bad data on purpose.

## Regenerating the documentation

The User Guide (PDF + Word) and the README PDF are generated from
`docs/generate_guide.py`:

```bash
pip install -r docs/requirements-docs.txt   # python-docx, fpdf2
python docs/generate_guide.py               # writes the .pdf / .docx in the repo root
```

## Adding a translation

UI strings live in the language dictionaries in `frontend/js/app.js`. Add your
language code, translate the keys, and add it to the language selector. Arabic
demonstrates full right-to-left support — follow that pattern for other RTL
languages.

## Adding a data source

New providers go in `backend/app/integrations/live_market.py`. Wrap calls with
the existing TTL cache (`get_cache` / `set_cache`) and always return cached or
fallback data on error rather than raising.

## Pull requests

- Keep PRs focused and described clearly (what changed and why).
- Note any new environment variables or optional API keys.
- Confirm the app still boots with **no** API keys configured.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, your OS /
Python version, and whether you were running with Docker or locally. Screenshots
help. Please **never** paste real account numbers, API keys, or passwords.

---

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
