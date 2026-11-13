# TradeExpress Product Listing AI

Standalone service that turns product photos into reviewable marketplace listings (category, attributes with
confidence/evidence, title, descriptions, SEO, translations). Sellers must approve everything; nothing is auto-published.

- `backend/` — FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL with Row Level Security, Gemini provider
- `frontend/` — Next.js (App Router), Tailwind, React Query, Zustand, React Hook Form + Zod
- `docs/` — `QA_REPORT.md`, `INTEGRATION_GUIDE.md`, `DEPLOYMENT.md`; `PROGRESS.md` — status checklist

## Quick start (no Docker)
See `docs/DEPLOYMENT.md`. Credentials go in `backend/.env` (`TX_GEMINI_API_KEY`, `TX_JWT_SECRET`, `TX_DATABASE_URL`); never commit them.

## Tests
```bash
cd backend  && python -m pytest tests                    # unit + integration + load (real PostgreSQL)
cd backend  && TX_RUN_LIVE=1 python -m pytest tests/live # real Gemini (uses quota)
cd frontend && npx vitest run                            # component/unit
python backend/scripts/e2e_prepare.py <admin-pg-url>     # then:
cd frontend && npx playwright test                       # E2E (fake AI provider, test mode only)
```
Status and honest limitations: `docs/QA_REPORT.md`.
