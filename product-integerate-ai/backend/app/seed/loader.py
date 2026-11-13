"""Idempotent loader for the default category hierarchy and attribute schemas.

The data lives in categories.json (editable by non-developers); admins can add or version
categories at runtime through the admin API without touching code.
"""
import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.models import Category, CategoryAttribute
from app.schemas.category import AttributeCreate, CategoryCreate
from app.services import category as svc

DATA_FILE = Path(__file__).with_name("categories.json")


async def _ensure_category(
    session: AsyncSession, name: str, slug: str, parent: Category | None
) -> Category:
    existing = await session.scalar(select(Category).where(Category.slug == slug))
    if existing:
        return existing
    return await svc.create_category(
        session, CategoryCreate(name=name, slug=slug, parent_id=parent.id if parent else None),
        None)


async def _ensure_attributes(
    session: AsyncSession, cat: Category, attrs: list[dict[str, Any]]
) -> None:
    have = {
        a for a in (await session.scalars(
            select(CategoryAttribute.key).where(CategoryAttribute.category_id == cat.id))).all()
    }
    for i, raw in enumerate(attrs):
        if raw["key"] in have:
            continue
        payload = AttributeCreate(
            **{**raw, "sort_order": i,
               "options": [{"value": o, "label": o} for o in raw.get("options", [])]}
        )
        await svc.add_attribute(session, cat, payload, None)


async def _walk(
    session: AsyncSession, nodes: list[dict[str, Any]], parent: Category | None,
    common: list[dict[str, Any]],
) -> None:
    for node in nodes:
        cat = await _ensure_category(session, node["name"], node["slug"], parent)
        attrs = (common if parent is None else []) + node.get("attributes", [])
        await _ensure_attributes(session, cat, attrs)
        await _walk(session, node.get("children", []), cat, common)


async def seed_categories(engine: AsyncEngine, data_file: Path = DATA_FILE) -> None:
    data = json.loads(data_file.read_text(encoding="utf-8"))
    async with AsyncSession(engine, expire_on_commit=False) as session:
        await _walk(session, data["categories"], None, data["common_attributes"])
        await session.commit()
