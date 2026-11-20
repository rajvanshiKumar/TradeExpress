import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CurrentUser,
    OrgContext,
    get_current_user,
    get_session,
    require_permission,
)
from app.models.commerce import ProductVariant
from app.schemas.common import Page
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    PublishFromJobRequest,
    VariantCreate,
    VariantOut,
)
from app.services import product as svc

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=Page[ProductOut])
async def list_products(
    category_id: uuid.UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> Page[ProductOut]:
    offset = (page - 1) * page_size
    items, total = await svc.list_products(
        session,
        ctx.org_id,
        category_id=category_id,
        status=status,
        search=search,
        limit=page_size,
        offset=offset,
    )
    return Page(
        items=[ProductOut.model_validate(p) for p in items],
        total=total,
        limit=page_size,
        offset=offset,
    )


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    body: ProductCreate,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> ProductOut:
    prod = await svc.create_product(session, ctx.org_id, current.id, body)
    return ProductOut.model_validate(prod)


@router.post("/from-job/{job_id}", response_model=ProductOut, status_code=201)
async def publish_from_job(
    job_id: uuid.UUID,
    body: PublishFromJobRequest,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:publish")),
    session: AsyncSession = Depends(get_session),
) -> ProductOut:
    prod = await svc.publish_from_listing_job(session, ctx.org_id, current.id, job_id, body)
    return ProductOut.model_validate(prod)


@router.get("/{id}", response_model=ProductOut)
async def get_product(
    id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> ProductOut:
    prod = await svc.get_product(session, id)
    return ProductOut.model_validate(prod)


@router.patch("/{id}", response_model=ProductOut)
async def update_product(
    id: uuid.UUID,
    body: ProductUpdate,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> ProductOut:
    prod = await svc.get_product(session, id)
    updated = await svc.update_product(session, prod, current.id, body)
    return ProductOut.model_validate(updated)


@router.delete("/{id}", status_code=204)
async def delete_product(
    id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> None:
    prod = await svc.get_product(session, id)
    await svc.delete_product(session, prod, current.id)


@router.post("/{id}/publish", response_model=ProductOut)
async def publish_product(
    id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:publish")),
    session: AsyncSession = Depends(get_session),
) -> ProductOut:
    prod = await svc.get_product(session, id)
    updated = await svc.publish_product(session, prod, current.id)
    return ProductOut.model_validate(updated)


@router.post("/{id}/archive", response_model=ProductOut)
async def archive_product(
    id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:publish")),
    session: AsyncSession = Depends(get_session),
) -> ProductOut:
    prod = await svc.get_product(session, id)
    updated = await svc.archive_product(session, prod, current.id)
    return ProductOut.model_validate(updated)


@router.post("/{id}/variants", response_model=VariantOut, status_code=201)
async def add_variant(
    id: uuid.UUID,
    body: VariantCreate,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("product:write")),
    session: AsyncSession = Depends(get_session),
) -> VariantOut:
    prod = await svc.get_product(session, id)
    var = ProductVariant(
        product_id=prod.id,
        organization_id=ctx.org_id,
        sku=body.sku,
        variant_name=body.variant_name,
        attributes=body.attributes,
        barcode=body.barcode,
        is_active=body.is_active,
    )
    session.add(var)
    await session.commit()
    return VariantOut.model_validate(var)
