import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin


def _org_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


def _jsonb(default: Any = dict) -> Mapped[Any]:
    server = "'{}'::jsonb" if default is dict else "'[]'::jsonb"
    return mapped_column(JSONB, nullable=False, server_default=text(server), default=default)


class Product(IdMixin, TimestampMixin, Base):
    __tablename__ = "products"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    listing_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_listing_jobs.id", ondelete="SET NULL"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    short_title: Mapped[str | None] = mapped_column(String(150))
    brand: Mapped[str | None] = mapped_column(String(100), index=True)
    model: Mapped[str | None] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    short_description: Mapped[str | None] = mapped_column(Text)
    highlights: Mapped[list[str]] = _jsonb(list)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", index=True
    )  # draft, published, archived
    seo_title: Mapped[str | None] = mapped_column(String(150))
    seo_description: Mapped[str | None] = mapped_column(String(300))
    seo_keywords: Mapped[list[str]] = _jsonb(list)
    tags: Mapped[list[str]] = _jsonb(list)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )
    attributes: Mapped[list["ProductAttributeValue"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )
    offers: Mapped[list["SellerOffer"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )


class ProductVariant(IdMixin, TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("organization_id", "sku", name="uq_product_variants_org_sku"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(200), nullable=False)
    attributes: Mapped[dict[str, Any]] = _jsonb(dict)
    barcode: Mapped[str | None] = mapped_column(String(100), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    product: Mapped[Product] = relationship(back_populates="variants")


class ProductAttributeValue(IdMixin, TimestampMixin, Base):
    __tablename__ = "product_attribute_values"
    __table_args__ = (
        UniqueConstraint("product_id", "attribute_key", name="uq_product_attr_key"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    attribute_key: Mapped[str] = mapped_column(String(80), nullable=False)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="seller")
    evidence: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    product: Mapped[Product] = relationship(back_populates="attributes")


class ProductImageMapping(IdMixin, TimestampMixin, Base):
    __tablename__ = "product_image_mappings"
    __table_args__ = (
        UniqueConstraint("product_id", "image_id", name="uq_product_image_mapping"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_images.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SellerOffer(IdMixin, TimestampMixin, Base):
    __tablename__ = "seller_offers"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    offer_type: Mapped[str] = mapped_column(
        String(10), nullable=False, default="b2c"
    )  # b2c, b2b, both
    retail_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    wholesale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    min_order_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text)

    product: Mapped[Product] = relationship(back_populates="offers")
    pricing_tiers: Mapped[list["PricingTier"]] = relationship(
        back_populates="offer", cascade="all, delete-orphan", lazy="selectin"
    )


class PricingTier(IdMixin, TimestampMixin, Base):
    __tablename__ = "pricing_tiers"

    offer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seller_offers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    min_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    max_quantity: Mapped[int | None] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    offer: Mapped[SellerOffer] = relationship(back_populates="pricing_tiers")


class Market(IdMixin, TimestampMixin, Base):
    __tablename__ = "markets"

    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    languages: Mapped[list[str]] = _jsonb(list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Currency(IdMixin, TimestampMixin, Base):
    __tablename__ = "currencies"

    code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    symbol: Mapped[str] = mapped_column(String(5), nullable=False)
    exchange_rate_to_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("1.0000")
    )


class ComplianceRule(IdMixin, TimestampMixin, Base):
    __tablename__ = "compliance_rules"

    market_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    category_slug: Mapped[str | None] = mapped_column(String(160), index=True)
    rule_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_hard_restriction: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    required_attributes: Mapped[list[str]] = _jsonb(list)
    required_documents: Mapped[list[str]] = _jsonb(list)
    restricted_keywords: Mapped[list[str]] = _jsonb(list)
    effective_date: Mapped[str | None] = mapped_column(String(20))


class ComplianceResult(IdMixin, TimestampMixin, Base):
    __tablename__ = "compliance_results"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_listing_jobs.id", ondelete="CASCADE"),
        index=True,
    )
    market_code: Mapped[str] = mapped_column(String(10), nullable=False)
    is_compliant: Mapped[bool] = mapped_column(Boolean, nullable=False)
    advisories: Mapped[list[dict[str, Any]]] = _jsonb(list)
    violations: Mapped[list[dict[str, Any]]] = _jsonb(list)

