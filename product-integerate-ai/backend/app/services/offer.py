import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import set_tenant_context
from app.core.errors import NotFoundError, ValidationFailed
from app.models.commerce import PricingTier, Product, SellerOffer
from app.schemas.offer import PricingTierIn, SellerOfferCreate, SellerOfferUpdate
from app.services import audit


async def get_offer(s: AsyncSession, offer_id: uuid.UUID) -> SellerOffer:
    offer = await s.scalar(
        select(SellerOffer)
        .where(SellerOffer.id == offer_id)
        .options(selectinload(SellerOffer.pricing_tiers))
    )
    if not offer:
        raise NotFoundError("Offer not found")
    return offer


async def list_offers(
    s: AsyncSession,
    org_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
) -> list[SellerOffer]:
    query = select(SellerOffer).where(SellerOffer.organization_id == org_id)
    if product_id:
        query = query.where(SellerOffer.product_id == product_id)
    return list(
        (
            await s.scalars(
                query.options(selectinload(SellerOffer.pricing_tiers)).order_by(
                    SellerOffer.created_at.desc()
                )
            )
        ).all()
    )


async def create_offer(
    s: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None,
    data: SellerOfferCreate,
) -> SellerOffer:
    prod = await s.scalar(
        select(Product).where(Product.id == data.product_id, Product.organization_id == org_id)
    )
    if not prod:
        raise NotFoundError("Product not found")

    offer = SellerOffer(
        product_id=data.product_id,
        variant_id=data.variant_id,
        organization_id=org_id,
        offer_type=data.offer_type,
        retail_price=data.retail_price,
        wholesale_price=data.wholesale_price,
        currency=data.currency,
        min_order_quantity=data.min_order_quantity,
        lead_time_days=data.lead_time_days,
        stock_quantity=data.stock_quantity,
        is_available=data.is_available,
        notes=data.notes,
    )
    s.add(offer)
    await s.flush()

    for tier in data.pricing_tiers:
        pt = PricingTier(
            offer_id=offer.id,
            organization_id=org_id,
            min_quantity=tier.min_quantity,
            max_quantity=tier.max_quantity,
            unit_price=tier.unit_price,
            currency=tier.currency,
        )
        s.add(pt)

    await audit.record(
        s,
        action="offer.create",
        entity_type="offer",
        entity_id=offer.id,
        actor_user_id=user_id,
        organization_id=org_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=org_id)
    return await get_offer(s, offer.id)


async def update_offer(
    s: AsyncSession,
    offer: SellerOffer,
    user_id: uuid.UUID | None,
    data: SellerOfferUpdate,
) -> SellerOffer:
    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(offer, field, val)
    await audit.record(
        s,
        action="offer.update",
        entity_type="offer",
        entity_id=offer.id,
        actor_user_id=user_id,
        organization_id=offer.organization_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=offer.organization_id)
    return await get_offer(s, offer.id)


async def add_pricing_tiers(
    s: AsyncSession,
    offer_id: uuid.UUID,
    org_id: uuid.UUID,
    tiers: list[PricingTierIn],
) -> list[PricingTier]:
    offer = await get_offer(s, offer_id)
    if offer.organization_id != org_id:
        raise NotFoundError("Offer not found")

    created = []
    for t in tiers:
        pt = PricingTier(
            offer_id=offer.id,
            organization_id=org_id,
            min_quantity=t.min_quantity,
            max_quantity=t.max_quantity,
            unit_price=t.unit_price,
            currency=t.currency,
        )
        s.add(pt)
        created.append(pt)

    await s.commit()
    return created
