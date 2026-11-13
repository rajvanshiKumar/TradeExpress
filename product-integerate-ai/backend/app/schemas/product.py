import uuid
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VariantCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    variant_name: str = Field(min_length=1, max_length=200)
    attributes: dict[str, Any] = Field(default_factory=dict)
    barcode: str | None = None
    is_active: bool = True


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    sku: str
    variant_name: str
    attributes: dict[str, Any]
    barcode: str | None
    is_active: bool


class AttributeValueIn(BaseModel):
    attribute_key: str = Field(min_length=1, max_length=80)
    value: Any
    confidence: Decimal | None = None
    source: str = "seller"
    evidence: str | None = None
    verified: bool = True


class AttributeValueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attribute_key: str
    value: Any
    confidence: Decimal | None
    source: str
    evidence: str | None
    verified: bool


class ProductImageMapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image_id: uuid.UUID
    is_primary: bool
    display_order: int


class ProductCreate(BaseModel):
    category_id: uuid.UUID
    title: str = Field(min_length=2, max_length=300)
    short_title: str | None = Field(default=None, max_length=150)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    description: str = Field(min_length=5)
    short_description: str | None = None
    highlights: list[str] = Field(default_factory=list)
    seo_title: str | None = Field(default=None, max_length=150)
    seo_description: str | None = Field(default=None, max_length=300)
    seo_keywords: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    variants: list[VariantCreate] = Field(default_factory=list)
    attributes: list[AttributeValueIn] = Field(default_factory=list)
    image_ids: list[uuid.UUID] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=300)
    short_title: str | None = None
    brand: str | None = None
    model: str | None = None
    description: str | None = None
    short_description: str | None = None
    highlights: list[str] | None = None
    status: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: list[str] | None = None
    tags: list[str] | None = None


class PublishFromJobRequest(BaseModel):
    sku: str | None = None
    offer_type: str = Field(default="both", pattern="^(b2c|b2b|both)$")
    retail_price: Decimal | None = None
    wholesale_price: Decimal | None = None
    currency: str = Field(default="USD", min_length=3, max_length=3)
    min_order_quantity: int = Field(default=1, ge=1)
    lead_time_days: int = Field(default=3, ge=1)
    stock_quantity: int = Field(default=10, ge=0)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    category_id: uuid.UUID
    listing_job_id: uuid.UUID | None
    title: str
    short_title: str | None
    brand: str | None
    model: str | None
    description: str
    short_description: str | None
    highlights: list[str]
    status: str
    seo_title: str | None
    seo_description: str | None
    seo_keywords: list[str]
    tags: list[str]
    variants: list[VariantOut] = Field(default_factory=list)
    attributes: list[AttributeValueOut] = Field(default_factory=list)

