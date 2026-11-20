import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import set_tenant_context
from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.models.ai import AIListingJob
from app.models.commerce import (
    Product,
    ProductAttributeValue,
    ProductImageMapping,
    ProductVariant,
    SellerOffer,
)
from app.schemas.product import ProductCreate, ProductUpdate, PublishFromJobRequest
from app.services import audit
from app.services.listing import build_result, get_job


async def list_products(
    s: AsyncSession,
    org_id: uuid.UUID,
    category_id: uuid.UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Product], int]:
    query = select(Product).where(Product.organization_id == org_id)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if status:
        query = query.where(Product.status == status)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            (Product.title.ilike(term))
            | (Product.brand.ilike(term))
            | (Product.model.ilike(term))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await s.scalar(count_query)) or 0

    items = (
        await s.scalars(
            query.order_by(Product.created_at.desc())
            .options(
                selectinload(Product.variants),
                selectinload(Product.attributes),
                selectinload(Product.offers),
            )
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(items), total


async def get_product(s: AsyncSession, product_id: uuid.UUID) -> Product:
    prod = await s.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.attributes),
            selectinload(Product.offers).selectinload(SellerOffer.pricing_tiers),
        )
    )
    if not prod:
        raise NotFoundError("Product not found")
    return prod


async def create_product(
    s: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None,
    data: ProductCreate,
) -> Product:
    prod = Product(
        organization_id=org_id,
        category_id=data.category_id,
        title=data.title,
        short_title=data.short_title,
        brand=data.brand,
        model=data.model,
        description=data.description,
        short_description=data.short_description,
        highlights=data.highlights,
        status="draft",
        seo_title=data.seo_title,
        seo_description=data.seo_description,
        seo_keywords=data.seo_keywords,
        tags=data.tags,
        created_by=user_id,
    )
    s.add(prod)
    await s.flush()

    # Add variants
    if data.variants:
        for v in data.variants:
            var = ProductVariant(
                product_id=prod.id,
                organization_id=org_id,
                sku=v.sku,
                variant_name=v.variant_name,
                attributes=v.attributes,
                barcode=v.barcode,
                is_active=v.is_active,
            )
            s.add(var)
    else:
        # Default variant
        sku = f"SKU-{uuid.uuid4().hex[:8].upper()}"
        var = ProductVariant(
            product_id=prod.id,
            organization_id=org_id,
            sku=sku,
            variant_name="Default",
            attributes={},
            is_active=True,
        )
        s.add(var)

    # Add attributes
    for a in data.attributes:
        attr = ProductAttributeValue(
            product_id=prod.id,
            organization_id=org_id,
            attribute_key=a.attribute_key,
            value=a.value,
            confidence=a.confidence,
            source=a.source,
            evidence=a.evidence,
            verified=a.verified,
        )
        s.add(attr)

    # Add image mappings
    for idx, img_id in enumerate(data.image_ids):
        pim = ProductImageMapping(
            product_id=prod.id,
            image_id=img_id,
            organization_id=org_id,
            is_primary=(idx == 0),
            display_order=idx,
        )
        s.add(pim)

    await audit.record(
        s,
        action="product.create",
        entity_type="product",
        entity_id=prod.id,
        actor_user_id=user_id,
        organization_id=org_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=org_id)
    return await get_product(s, prod.id)


async def update_product(
    s: AsyncSession,
    product: Product,
    user_id: uuid.UUID | None,
    data: ProductUpdate,
) -> Product:
    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(product, field, val)
    await audit.record(
        s,
        action="product.update",
        entity_type="product",
        entity_id=product.id,
        actor_user_id=user_id,
        organization_id=product.organization_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=product.organization_id)
    return await get_product(s, product.id)


async def publish_product(s: AsyncSession, product: Product, user_id: uuid.UUID | None) -> Product:
    product.status = "published"
    await audit.record(
        s,
        action="product.publish",
        entity_type="product",
        entity_id=product.id,
        actor_user_id=user_id,
        organization_id=product.organization_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=product.organization_id)
    return await get_product(s, product.id)


async def archive_product(s: AsyncSession, product: Product, user_id: uuid.UUID | None) -> Product:
    product.status = "archived"
    await audit.record(
        s,
        action="product.archive",
        entity_type="product",
        entity_id=product.id,
        actor_user_id=user_id,
        organization_id=product.organization_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=product.organization_id)
    return await get_product(s, product.id)


async def delete_product(s: AsyncSession, product: Product, user_id: uuid.UUID | None) -> None:
    await audit.record(
        s,
        action="product.delete",
        entity_type="product",
        entity_id=product.id,
        actor_user_id=user_id,
        organization_id=product.organization_id,
    )
    await s.delete(product)
    await s.commit()


async def publish_from_listing_job(
    s: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    req: PublishFromJobRequest,
) -> Product:
    job = await get_job(s, job_id)
    if job.organization_id != org_id:
        raise NotFoundError("Listing job not found")
    if job.status != "approved":
        raise ConflictError(f"Cannot publish listing job in '{job.status}' status: must be 'approved'")
    if not job.category_id:
        raise ValidationFailed("Listing job does not have an assigned category")

    # Check if product was already created for this job
    existing = await s.scalar(select(Product).where(Product.listing_job_id == job.id))
    if existing:
        return await get_product(s, existing.id)

    res = await build_result(s, job)
    content = res.get("content", {})

    def get_c(key: str, default: Any = "") -> Any:
        entry = content.get(key)
        if isinstance(entry, dict):
            return entry.get("value", default)
        return default

    title = str(get_c("title") or "Untitled Product")
    short_title = str(get_c("short_title") or "") or None
    description = str(get_c("long_description") or get_c("description") or "Product description")
    short_description = str(get_c("short_description") or "") or None
    highlights_val = get_c("highlights", [])
    highlights = highlights_val if isinstance(highlights_val, list) else []

    seo_title = str(get_c("seo_title") or "") or None
    seo_desc = str(get_c("meta_description") or "") or None
    keywords_val = get_c("keywords", [])
    keywords = keywords_val if isinstance(keywords_val, list) else []
    tags_val = get_c("tags", [])
    tags = tags_val if isinstance(tags_val, list) else []

    # Detect brand and model from attributes first (seller-verified), fallback to visual analysis
    attr_map = {
        a.get("attribute_key"): a.get("final_value")
        for a in res.get("attributes", [])
        if a.get("final_value") is not None
    }
    analysis = res.get("analysis") or {}
    brand = str(attr_map.get("brand") or analysis.get("brand") or "") or None
    model = str(attr_map.get("model_number") or attr_map.get("model") or analysis.get("model") or "") or None

    prod = Product(
        organization_id=org_id,
        category_id=job.category_id,
        listing_job_id=job.id,
        title=title,
        short_title=short_title,
        brand=brand,
        model=model,
        description=description,
        short_description=short_description,
        highlights=highlights,
        status="published",
        seo_title=seo_title,
        seo_description=seo_desc,
        seo_keywords=keywords,
        tags=tags,
        created_by=user_id,
    )
    s.add(prod)
    await s.flush()

    # Create primary variant with detected attributes (e.g. color, size)
    variant_attrs: dict[str, Any] = {}
    if "color" in attr_map:
        variant_attrs["color"] = attr_map["color"]
    if "size" in attr_map:
        variant_attrs["size"] = attr_map["size"]

    sku = req.sku or f"SKU-{uuid.uuid4().hex[:8].upper()}"
    variant = ProductVariant(
        product_id=prod.id,
        organization_id=org_id,
        sku=sku,
        variant_name="Default",
        attributes=variant_attrs,
        is_active=True,
    )
    s.add(variant)
    await s.flush()

    # Add attributes from approved job
    for a in res.get("attributes", []):
        val = a.get("final_value")
        if val is not None:
            attr_row = ProductAttributeValue(
                product_id=prod.id,
                organization_id=org_id,
                attribute_key=a["attribute_key"],
                value=val,
                confidence=Decimal(str(a["confidence"])) if a.get("confidence") is not None else None,
                source=a.get("source", "seller"),
                evidence=a.get("evidence"),
                verified=True,
            )
            s.add(attr_row)

    # Map images
    for idx, img_id_str in enumerate(res.get("images", [])):
        img_id = uuid.UUID(img_id_str)
        pim = ProductImageMapping(
            product_id=prod.id,
            image_id=img_id,
            organization_id=org_id,
            is_primary=(idx == 0),
            display_order=idx,
        )
        s.add(pim)

    # Create seller commercial offer (B2B/B2C)
    offer = SellerOffer(
        product_id=prod.id,
        variant_id=variant.id,
        organization_id=org_id,
        offer_type=req.offer_type,
        retail_price=req.retail_price,
        wholesale_price=req.wholesale_price,
        currency=req.currency,
        min_order_quantity=req.min_order_quantity,
        lead_time_days=req.lead_time_days,
        stock_quantity=req.stock_quantity,
        is_available=True,
        notes="Created from AI listing approval",
    )
    s.add(offer)

    await audit.record(
        s,
        action="product.publish_from_job",
        entity_type="product",
        entity_id=prod.id,
        actor_user_id=user_id,
        organization_id=org_id,
    )
    await s.commit()
    await set_tenant_context(s, user_id=user_id, org_id=org_id)
    return await get_product(s, prod.id)
