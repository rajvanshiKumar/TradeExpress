# TradeExpress Product Listing AI

Standalone service that turns product photos into reviewable marketplace listings (category, attributes with
confidence/evidence, title, descriptions, SEO, translations). Sellers must approve everything; nothing is auto-published.

- `backend/` — FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL with Row Level Security, Gemini provider
- `frontend/` — Next.js (App Router), Tailwind, React Query, Zustand, React Hook Form + Zod
- `docs/` — `QA_REPORT.md`, `INTEGRATION_GUIDE.md`, `DEPLOYMENT.md`; `PROGRESS.md` — status checklist

## Run everything with one command (local development)
```bash
node scripts/dev-all.mjs        # or: npm run dev   (from the repo root)
# port 3000 busy? FRONTEND_PORT=3100 node scripts/dev-all.mjs
```
Starts the listing backend (:8000, embedded PostgreSQL), the Form Assistant (:8100) and the frontend (:3000), waits until
all three are healthy, and stops them together on Ctrl+C. Open http://localhost:3000, then **AI Form Assistant** in the
sidebar (RFQ, order address, transport vehicle, transport driver). The browser talks to the assistant only through the
Next.js proxy `/api/assist/*`; the assistant's API key stays on the frontend server.
One-time setup: `backend/.venv`, `form-assistant/.venv` (+ `form-assistant/.env`, see `form-assistant/README.md`), `cd frontend && npm install`.

- `form-assistant/` — separate FastAPI service: AI suggestions for RFQ / order address / vehicle / driver forms (stateless, no DB)

## Quick start (no Docker)
See `docs/DEPLOYMENT.md`. Credentials go in `backend/.env` (`TX_GEMINI_API_KEY`, `TX_JWT_SECRET`, `TX_DATABASE_URL`); never commit them.

## Tests
```bash
cd backend  && python -m pytest tests                    # unit + integration + load (real PostgreSQL)
cd backend  && TX_RUN_LIVE=1 python -m pytest tests/live # real Gemini (uses quota)
cd frontend && npm test                                  # component/unit (Vitest; see frontend/run-vitest.mjs)
python backend/scripts/e2e_prepare.py <admin-pg-url>     # then:
cd frontend && npx playwright test                       # E2E (fake AI provider, test mode only)
```
Status and honest limitations: `docs/QA_REPORT.md`.
