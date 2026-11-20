import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_session, require_admin
from app.models import Category, CategorySchemaVersion
from app.schemas.category import (
    AttributeCreate,
    AttributeOut,
    AttributeUpdate,
    CategoryCreate,
    CategoryNode,
    CategoryOut,
    CategoryUpdate,
    ValidateIn,
    ValidateOut,
    VersionOut,
)
from app.schemas.common import Page
from app.services import audit
from app.services import category as svc

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=Page[CategoryOut])
async def list_categories(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    parent_id: uuid.UUID | None = None,
    level: int | None = Query(None, ge=0, le=3),
    q: str | None = Query(None, max_length=100),
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Page[CategoryOut]:
    rows, total = await svc.list_categories(
        session, limit=limit, offset=offset, parent_id=parent_id, level=level, q=q,
        include_inactive=False)
    return Page(items=[CategoryOut.model_validate(r) for r in rows], total=total, limit=limit,
                offset=offset)


@router.get("/categories/tree", response_model=list[CategoryNode])
async def tree(
    _: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> list[CategoryNode]:
    return [CategoryNode.model_validate(n) for n in await svc.category_tree(session)]


@router.get("/categories/{category_id}", response_model=CategoryOut)
async def get_category(
    category_id: uuid.UUID,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CategoryOut:
    return CategoryOut.model_validate(await svc.get_category(session, category_id))


@router.get("/categories/{category_id}/attributes", response_model=list[AttributeOut])
async def category_attributes(
    category_id: uuid.UUID,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AttributeOut]:
    cat = await svc.get_category(session, category_id)
    return [AttributeOut.model_validate(a) for a in await svc.effective_attributes(session, cat)]


@router.post("/categories/{category_id}/validate", response_model=ValidateOut)
async def validate(
    category_id: uuid.UUID,
    body: ValidateIn,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ValidateOut:
    cat = await svc.get_category(session, category_id)
    errors = await svc.validate_values(session, cat, body.values)
    return ValidateOut(valid=not errors, errors=errors)


admin = APIRouter(prefix="/admin", tags=["admin"])


@admin.post("/categories", status_code=201, response_model=CategoryOut)
async def create_category(
    body: CategoryCreate,
    current: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> CategoryOut:
    cat = await svc.create_category(session, body, current.id)
    await audit.record(session, action="category.create", entity_type="category",
                       entity_id=cat.id, actor_user_id=current.id)
    out = CategoryOut.model_validate(cat)
    await session.commit()
    return out


@admin.patch("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    current: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> CategoryOut:
    cat = await svc.update_category(session, await svc.get_category(session, category_id), body)
    await audit.record(session, action="category.update", entity_type="category",
                       entity_id=cat.id, actor_user_id=current.id)
    out = CategoryOut.model_validate(cat)
    await session.commit()
    return out


@admin.post("/categories/{category_id}/attributes", status_code=201, response_model=AttributeOut)
async def add_attribute(
    category_id: uuid.UUID,
    body: AttributeCreate,
    current: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> AttributeOut:
    cat = await svc.get_category(session, category_id)
    attr = await svc.add_attribute(session, cat, body, current.id)
    await audit.record(session, action="category.attribute_add", entity_type="category",
                       entity_id=cat.id, actor_user_id=current.id, data={"key": body.key})
    out = AttributeOut.model_validate(attr)
    await session.commit()
    return out


@admin.patch("/categories/{category_id}/attributes/{key}", response_model=AttributeOut)
async def update_attribute(
    category_id: uuid.UUID,
    key: str,
    body: AttributeUpdate,
    current: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> AttributeOut:
    cat = await svc.get_category(session, category_id)
    attr = await svc.update_attribute(session, cat, key, body, current.id)
    out = AttributeOut.model_validate(attr)
    await session.commit()
    return out


@admin.get("/categories/{category_id}/versions", response_model=list[VersionOut])
async def versions(
    category_id: uuid.UUID,
    _: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> list[VersionOut]:
    from sqlalchemy import select

    await svc.get_category(session, category_id)
    rows = (await session.scalars(
        select(CategorySchemaVersion).where(CategorySchemaVersion.category_id == category_id)
        .order_by(CategorySchemaVersion.version))).all()
    return [VersionOut.model_validate(r) for r in rows]


__all__ = ["Category", "admin", "router"]
