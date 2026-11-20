# Deployment

> Docker was **not available** on the development machine, so none of the container files below have been built
> or run. They are written to be straightforward but must be verified before relying on them.

## Local development (no Docker)

```bash
# 1. embedded PostgreSQL (pgserver) — prints TX_DATABASE_URL
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # or the packages in pyproject
python scripts/dev_db.py
# 2. configure (backend/.env, never committed)
TX_DATABASE_URL=postgresql+asyncpg://...   TX_JWT_SECRET=<32+ random chars>   TX_GEMINI_API_KEY=<key>
# 3. migrate, seed, run
python -m alembic upgrade head && python -m app.cli seed
python -m uvicorn app.main:create_app --factory --port 8000
# 4. frontend
cd ../frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
Create a platform admin: `TX_ADMIN_PASSWORD=... python -m app.cli create-admin you@example.com`.

## Docker Compose (development)
`cp .env.example .env`, fill credentials, then `docker compose up --build`. Stack: `pgvector/pgvector:pg16`,
Redis (reserved for the future Celery workers / distributed rate limiter), API, frontend, Nginx.

## Environments
| | Database | Storage | Provider |
|---|---|---|---|
| development | Compose / embedded | `./storage` | Gemini dev key |
| staging | separate managed PostgreSQL | separate bucket/volume | Gemini (separate key) |
| production | managed PostgreSQL + backups | object storage (S3/R2 adapter **not implemented yet**; local disk only) | Gemini prod key |

Rules: `TX_ENVIRONMENT=production` rejects placeholder secrets and wildcard CORS and hides `/docs`; `TX_AI_PROVIDER=fake`
is refused outside `test`. Run migrations with an owner role; the API must connect as a role allowed to `SET ROLE tx_app`
(RLS applies to `tx_app`). Set `TX_DB_APP_ROLE=` empty **only** if you connect directly as a non-superuser that RLS applies to.

## Backups
`pg_dump -Fc` nightly + WAL archiving/PITR on the managed service; back up `TX_STORAGE_DIR` with the database
(images are referenced by key). Test restores quarterly. Rotate `TX_JWT_SECRET` by deploying a new value (all sessions end).

## Scaling notes
- API is stateless except: in-process rate limiter and in-process `JobRunner`. Run **one** API replica until those move
  to Redis/Celery (jobs would otherwise be lost on restart; failed/queued jobs are visible in the DB and via retry).
- Put Nginx in front (TLS, `client_max_body_size 20m`, `proxy_read_timeout 120s`); see `deploy/nginx.conf`.
