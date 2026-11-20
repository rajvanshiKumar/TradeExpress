FROM python:3.12-slim
WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir "fastapi>=0.115" "uvicorn[standard]" "pydantic>=2.7" pydantic-settings \
    "sqlalchemy[asyncio]>=2.0" asyncpg alembic pyjwt argon2-cffi email-validator python-multipart pillow httpx
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
RUN useradd -r -u 10001 appuser
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000"]
