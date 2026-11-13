"""Create a fresh `tx_e2e` database on the dev PostgreSQL, migrate and seed it, then print its URL.

Usage: python scripts/e2e_prepare.py <admin-url>   e.g. postgresql://postgres:@127.0.0.1:PORT/postgres
"""
import asyncio
import os
import subprocess
import sys

import asyncpg


async def main(admin_url: str) -> str:
    conn = await asyncpg.connect(admin_url)
    await conn.execute("DROP DATABASE IF EXISTS tx_e2e WITH (FORCE)")
    await conn.execute("CREATE DATABASE tx_e2e")
    await conn.close()
    url = admin_url.rsplit("/", 1)[0] + "/tx_e2e"
    async_url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    env = {**os.environ, "TX_DATABASE_URL": async_url, "TX_JWT_SECRET": "e2e-secret-" + "k" * 40,
           "TX_ENVIRONMENT": "test", "TX_AI_PROVIDER": "fake"}
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], env=env, check=True)  # noqa: S603
    subprocess.run([sys.executable, "-m", "app.cli", "seed"], env=env, check=True)  # noqa: S603
    return async_url


if __name__ == "__main__":
    print(asyncio.run(main(sys.argv[1])))
