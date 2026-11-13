import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PricingTierIn(BaseModel):
    min_quantity: int = Field(ge=1)
    max_quantity: int | None = Field(default=None, ge=1)
    unit_price: Decimal = Field(gt=Decimal("0"))
    currency: str = Field(default="USD", min_length=3, max_length=3)


class PricingTierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    offer_id: uuid.UUID
    min_quantity: int
    max_quantity: int | None
    unit_price: Decimal
    currency: str


class SellerOfferCreate(BaseModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    offer_type: str = Field(default="b2c", pattern="^(b2c|b2b|both)$")
    retail_price: Decimal | None = None
    wholesale_price: Decimal | None = None
    currency: str = Field(default="USD", min_length=3, max_length=3)
    min_order_quantity: int = Field(default=1, ge=1)
    lead_time_days: int = Field(default=3, ge=1)
    stock_quantity: int = Field(default=0, ge=0)
    is_available: bool = True
    notes: str | None = None
    pricing_tiers: list[PricingTierIn] = Field(default_factory=list)


class SellerOfferUpdate(BaseModel):
    offer_type: str | None = Field(default=None, pattern="^(b2c|b2b|both)$")
    retail_price: Decimal | None = None
    wholesale_price: Decimal | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    min_order_quantity: int | None = Field(default=None, ge=1)
    lead_time_days: int | None = Field(default=None, ge=1)
    stock_quantity: int | None = Field(default=None, ge=0)
    is_available: bool | None = None
    notes: str | None = None


class SellerOfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    organization_id: uuid.UUID
    offer_type: str
    retail_price: Decimal | None
    wholesale_price: Decimal | None
    currency: str
    min_order_quantity: int
    lead_time_days: int
    stock_quantity: int
    is_available: bool
    notes: str | None
    pricing_tiers: list[PricingTierOut] = Field(default_factory=list)

