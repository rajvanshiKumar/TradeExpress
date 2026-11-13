import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.models import Category, CategoryAttribute, CategoryAttributeOption, CategorySchemaVersion
from app.schemas.category import AttributeCreate, AttributeUpdate, CategoryCreate, CategoryUpdate
from app.services.attribute_validation import AttributeSpec, validate_value

MAX_LEVEL = 3
OPTION_TYPES = {"enum", "multi_select"}


def attribute_snapshot(attr: CategoryAttribute) -> dict[str, Any]:
    return {
        "key": attr.key, "label": attr.label, "data_type": attr.data_type,
        "required": attr.required, "unit": attr.unit, "validation_rules": attr.validation_rules,
        "seller_editable": attr.seller_editable, "ai_extractable": attr.ai_extractable,
        "ocr_extractable": attr.ocr_extractable,
        "confidence_threshold": float(attr.confidence_threshold),
        "market_requirements": attr.market_requirements, "is_active": attr.is_active,
        "options": [{"value": o.value, "label": o.label} for o in attr.options],
    }


async def get_category(session: AsyncSession, category_id: uuid.UUID) -> Category:
    cat = await session.get(Category, category_id)
    if not cat:
        raise NotFoundError("Category not found")
    return cat


async def _bump_version(session: AsyncSession, cat: Category, user_id: uuid.UUID | None) -> None:
    await session.refresh(cat, ["attributes"])
    cat.schema_version += 1
    session.add(CategorySchemaVersion(
        category_id=cat.id, version=cat.schema_version, created_by=user_id,
        snapshot=[attribute_snapshot(a) for a in cat.attributes],
    ))
    await session.flush()


async def create_category(
    session: AsyncSession, data: CategoryCreate, user_id: uuid.UUID | None
) -> Category:
    level, path = 0, data.slug
    if data.parent_id:
        parent = await get_category(session, data.parent_id)
        level, path = parent.level + 1, f"{parent.path}/{data.slug}"
        if level > MAX_LEVEL:
            raise ValidationFailed("Maximum category depth is 4 levels")
    if await session.scalar(select(Category.id).where(Category.slug == data.slug)):
        raise ConflictError(f"Category slug '{data.slug}' already exists")
    cat = Category(parent_id=data.parent_id, slug=data.slug, name=data.name, level=level,
                   path=path, name_i18n=data.name_i18n, schema_version=1)
    session.add(cat)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise ConflictError(f"Category slug '{data.slug}' already exists") from exc
    session.add(CategorySchemaVersion(category_id=cat.id, version=1, snapshot=[],
                                      created_by=user_id))
    await session.flush()
    await session.refresh(cat)
    return cat


async def update_category(session: AsyncSession, cat: Category, data: CategoryUpdate) -> Category:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(cat, field, value)
    await session.flush()
    await session.refresh(cat)
    return cat


async def add_attribute(
    session: AsyncSession, cat: Category, data: AttributeCreate, user_id: uuid.UUID | None
) -> CategoryAttribute:
    if data.options and data.data_type not in OPTION_TYPES:
        raise ValidationFailed("Options are only allowed for enum and multi_select attributes")
    if data.data_type in OPTION_TYPES and not data.options and not data.validation_rules.get(
        "allowed_values"
    ):
        raise ValidationFailed("enum/multi_select attributes need options")
    dup = await session.scalar(select(CategoryAttribute.id).where(
        CategoryAttribute.category_id == cat.id, CategoryAttribute.key == data.key))
    if dup:
        raise ConflictError(f"Attribute '{data.key}' already exists on this category")
    attr = CategoryAttribute(
        category_id=cat.id,
        **data.model_dump(exclude={"options"}),
        options=[CategoryAttributeOption(value=o.value, label=o.label, sort_order=i)
                 for i, o in enumerate(data.options)],
    )
    session.add(attr)
    await session.flush()
    await _bump_version(session, cat, user_id)
    return attr


async def update_attribute(
    session: AsyncSession, cat: Category, key: str, data: AttributeUpdate,
    user_id: uuid.UUID | None,
) -> CategoryAttribute:
    attr = await session.scalar(select(CategoryAttribute).where(
        CategoryAttribute.category_id == cat.id, CategoryAttribute.key == key))
    if not attr:
        raise NotFoundError("Attribute not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(attr, field, value)
    await session.flush()
    await _bump_version(session, cat, user_id)
    await session.refresh(attr)
    return attr


async def effective_attributes(session: AsyncSession, cat: Category) -> list[CategoryAttribute]:
    """Attributes of the category plus those inherited from ancestors (child overrides parent)."""
    chain: list[Category] = [cat]
    node = cat
    while node.parent_id:
        node = await get_category(session, node.parent_id)
        chain.append(node)
    merged: dict[str, CategoryAttribute] = {}
    for c in reversed(chain):  # root first, so descendants override
        await session.refresh(c, ["attributes"])
        for a in c.attributes:
            if a.is_active:
                merged[a.key] = a
    return list(merged.values())


def to_spec(attr: CategoryAttribute) -> AttributeSpec:
    allowed = [o.value for o in attr.options] or attr.validation_rules.get("allowed_values")
    return AttributeSpec(key=attr.key, data_type=attr.data_type, required=attr.required,
                         allowed_values=allowed, unit=attr.unit, rules=attr.validation_rules)


async def validate_values(
    session: AsyncSession, cat: Category, values: dict[str, Any]
) -> dict[str, list[str]]:
    attrs = {a.key: a for a in await effective_attributes(session, cat)}
    errors: dict[str, list[str]] = {}
    for key, attr in attrs.items():
        errs = validate_value(to_spec(attr), values.get(key))
        if errs:
            errors[key] = errs
    for key in values:
        if key not in attrs:
            errors[key] = ["unknown attribute for this category"]
    return errors


async def list_categories(
    session: AsyncSession, *, limit: int, offset: int, parent_id: uuid.UUID | None,
    level: int | None, q: str | None, include_inactive: bool,
) -> tuple[list[Category], int]:
    stmt = select(Category)
    if not include_inactive:
        stmt = stmt.where(Category.is_active.is_(True))
    if parent_id:
        stmt = stmt.where(Category.parent_id == parent_id)
    if level is not None:
        stmt = stmt.where(Category.level == level)
    if q:
        stmt = stmt.where(Category.name.ilike(f"%{q}%"))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(
        stmt.order_by(Category.level, Category.name).limit(limit).offset(offset))).all()
    return list(rows), total


async def category_tree(session: AsyncSession) -> list[dict[str, Any]]:
    rows = (await session.scalars(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.name))).all()
    nodes: dict[uuid.UUID, dict[str, Any]] = {c.id: {"id": c.id, "slug": c.slug, "name": c.name, "level": c.level, "children": []}
             for c in rows}
    roots: list[dict[str, Any]] = []
    for c in rows:
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id]["children"].append(nodes[c.id])
        elif not c.parent_id:
            roots.append(nodes[c.id])
    return roots
