import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CurrentUser,
    OrgContext,
    get_current_user,
    get_session,
    require_permission,
)
from app.schemas.offer import (
    PricingTierIn,
    PricingTierOut,
    SellerOfferCreate,
    SellerOfferOut,
    SellerOfferUpdate,
)
from app.services import offer as svc

router = APIRouter(prefix="/offers", tags=["offers"])


@router.get("", response_model=list[SellerOfferOut])
async def list_offers(
    product_id: uuid.UUID | None = None,
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> list[SellerOfferOut]:
    offers = await svc.list_offers(session, ctx.org_id, product_id=product_id)
    return [SellerOfferOut.model_validate(o) for o in offers]


@router.post("", response_model=SellerOfferOut, status_code=201)
async def create_offer(
    body: SellerOfferCreate,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("offer:write")),
    session: AsyncSession = Depends(get_session),
) -> SellerOfferOut:
    offer = await svc.create_offer(session, ctx.org_id, current.id, body)
    return SellerOfferOut.model_validate(offer)


@router.get("/{id}", response_model=SellerOfferOut)
async def get_offer(
    id: uuid.UUID,
    ctx: OrgContext = Depends(require_permission("product:read")),
    session: AsyncSession = Depends(get_session),
) -> SellerOfferOut:
    offer = await svc.get_offer(session, id)
    return SellerOfferOut.model_validate(offer)


@router.patch("/{id}", response_model=SellerOfferOut)
async def update_offer(
    id: uuid.UUID,
    body: SellerOfferUpdate,
    current: CurrentUser = Depends(get_current_user),
    ctx: OrgContext = Depends(require_permission("offer:write")),
    session: AsyncSession = Depends(get_session),
) -> SellerOfferOut:
    offer = await svc.get_offer(session, id)
    updated = await svc.update_offer(session, offer, current.id, body)
    return SellerOfferOut.model_validate(updated)


@router.post("/{id}/pricing-tiers", response_model=list[PricingTierOut], status_code=201)
async def add_pricing_tiers(
    id: uuid.UUID,
    tiers: list[PricingTierIn],
    ctx: OrgContext = Depends(require_permission("offer:write")),
    session: AsyncSession = Depends(get_session),
) -> list[PricingTierOut]:
    created = await svc.add_pricing_tiers(session, id, ctx.org_id, tiers)
    return [PricingTierOut.model_validate(t) for t in created]
