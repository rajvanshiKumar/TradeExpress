"""Operational commands.

  python -m app.cli seed
  python -m app.cli create-admin EMAIL            (password read from TX_ADMIN_PASSWORD)
"""
import asyncio
import os
import sys

from sqlalchemy import select

from app.core import security
from app.core.config import get_settings
from app.core.db import create_engine, create_sessionmaker
from app.models import User
from app.seed.loader import seed_categories


async def _seed() -> None:
    engine = create_engine(get_settings())
    await seed_categories(engine)
    await engine.dispose()
    print("categories seeded")


async def _create_admin(email: str) -> None:
    password = os.environ.get("TX_ADMIN_PASSWORD", "")
    security.validate_password_strength(password)
    engine = create_engine(get_settings())
    async with create_sessionmaker(engine)() as s:
        user = await s.scalar(select(User).where(User.email == email.lower()))
        if user:
            user.is_platform_admin = True
        else:
            s.add(User(email=email.lower(), full_name="Administrator",
                       password_hash=security.hash_password(password), is_platform_admin=True))
        await s.commit()
    await engine.dispose()
    print(f"admin ready: {email}")


def main(argv: list[str]) -> int:
    if len(argv) >= 1 and argv[0] == "seed":
        asyncio.run(_seed())
    elif len(argv) == 2 and argv[0] == "create-admin":
        asyncio.run(_create_admin(argv[1]))
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
