"""Data schemas for E-Commerce Chatbot matching TradeExpress Prisma models."""
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ProductCardItem(BaseModel):
    id: str
    name: str
    slug: str
    sku: str
    price: float
    currency: str = "INR"
    photo: Optional[str] = None
    stock: int = 100
    category_slug: Optional[str] = None
    rating: Optional[float] = 4.8
    variants: Optional[Any] = None


class OrderItemSummary(BaseModel):
    product_name: str
    product_sku: str
    product_photo: Optional[str] = None
    quantity: int
    unit_price: float
    line_total: float
    variant: Optional[Any] = None


class OrderTrackingResult(BaseModel):
    order_number: str
    buyer_name: str
    order_status: str  # ORDER_PLACED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
    payment_status: str  # PENDING, PAID, FAILED, REFUNDED
    shipping_method: str = "standard"
    shipping_eta: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    total: float
    currency: str = "INR"
    created_at: str
    items: List[OrderItemSummary] = Field(default_factory=list)
    progress_percentage: int = 25  # 25% placed, 50% packed, 75% shipped/out, 100% delivered


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    guest_id: Optional[str] = None
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    products: List[ProductCardItem] = Field(default_factory=list)
    order_status: Optional[OrderTrackingResult] = None
    quick_suggestions: List[str] = Field(default_factory=list)
