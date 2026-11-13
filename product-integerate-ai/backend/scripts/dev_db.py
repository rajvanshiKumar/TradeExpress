"""Start an embedded PostgreSQL (with pgvector) for local development when Docker is
unavailable. Production/staging use managed PostgreSQL; docker-compose uses the pgvector image.

Usage: python scripts/dev_db.py   (keeps running; prints the async URL)
"""
import pathlib
import time

import pgserver

DATA = pathlib.Path(__file__).resolve().parent.parent / ".devdb"

if __name__ == "__main__":
    server = pgserver.get_server(DATA, cleanup_mode=None)
    uri = server.get_uri().replace("postgresql://", "postgresql+asyncpg://", 1)
    print(f"TX_DATABASE_URL={uri}", flush=True)
    while True:
        time.sleep(3600)
