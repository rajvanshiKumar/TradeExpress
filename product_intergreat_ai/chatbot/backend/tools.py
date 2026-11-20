"""Tool functions and Gemini tool declarations for E-Commerce Chatbot."""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from chatbot.backend.config import chatbot_settings
from chatbot.backend.models import (
    OrderItemSummary,
    OrderTrackingResult,
    ProductCardItem,
)

# Gemini function declarations schema
GEMINI_CHAT_TOOLS = [
    {
        "name": "search_products",
        "description": "Search the product catalog for items matching a buyer query, keyword, category, color, or price range.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {"type": "STRING", "description": "Search keyword like shirt, t-shirt, headphones, shoes"},
                "max_price": {"type": "NUMBER", "description": "Maximum budget or price in INR (e.g. 1000)"},
                "min_price": {"type": "NUMBER", "description": "Minimum price in INR"},
                "color": {"type": "STRING", "description": "Specific color like black, navy, white, red"},
                "category": {"type": "STRING", "description": "Category slug like mens-clothing, electronics"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_order_status",
        "description": "Fetch live tracking status, shipment carrier, ETA, and ordered items for an order using its order number (e.g. ORD-10294 or similar).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "order_number": {"type": "STRING", "description": "The exact order number provided by the user, e.g. ORD-12345"}
            },
            "required": ["order_number"]
        }
    },
    {
        "name": "get_store_policy",
        "description": "Retrieve official store policy for return, replacement, refund, delivery timeline, shipping charges, or payment methods.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "topic": {
                    "type": "STRING",
                    "description": "Policy topic: 'return', 'refund', 'shipping', 'payment', 'b2b_wholesale', or 'contact'"
                }
            },
            "required": ["topic"]
        }
    }
]


# Demo fallback products matching TradeExpress catalog
SAMPLE_PRODUCTS: List[ProductCardItem] = [
    ProductCardItem(
        id="prod-001",
        name="Solid Black Cotton Blend Regular Fit Men's Casual Shirt",
        slug="mens-black-cotton-blend-regular-fit-casual-shirt",
        sku="SHIRT-COT-BLK-001",
        price=899.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt.jpg",
        stock=100,
        category_slug="mens-clothing",
        rating=4.9,
        variants=[{"type": "Size", "options": ["S", "M", "L", "XL"]}, {"type": "Color", "options": ["Black", "Navy"]}]
    ),
    ProductCardItem(
        id="prod-002",
        name="Men's Navy Blue 100% Combed Cotton Casual Shirt",
        slug="mens-navy-blue-cotton-shirt",
        sku="SHIRT-COT-NVY-002",
        price=999.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt-navy.jpg",
        stock=85,
        category_slug="mens-clothing",
        rating=4.8,
        variants=[{"type": "Size", "options": ["M", "L", "XL"]}, {"type": "Color", "options": ["Navy"]}]
    ),
    ProductCardItem(
        id="prod-003",
        name="Classic White Premium Oxford Formal Shirt",
        slug="mens-classic-white-oxford-shirt",
        sku="SHIRT-OXF-WHT-003",
        price=1199.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt-white.jpg",
        stock=50,
        category_slug="mens-clothing",
        rating=4.7,
        variants=[{"type": "Size", "options": ["S", "M", "L", "XL", "XXL"]}]
    ),
    ProductCardItem(
        id="prod-004",
        name="Men's Solid Black Bio-Washed Cotton Casual Shirt",
        slug="mens-black-bio-washed-cotton-casual-shirt",
        sku="SHIRT-BLK-BIO-004",
        price=449.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt.jpg",
        stock=120,
        category_slug="mens-clothing",
        rating=4.8,
        variants=[{"type": "Size", "options": ["S", "M", "L", "XL"]}]
    ),
    ProductCardItem(
        id="prod-005",
        name="Men's Black Regular Fit Cotton Henley Casual Shirt",
        slug="mens-black-cotton-henley-shirt",
        sku="SHIRT-HEN-BLK-005",
        price=499.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt.jpg",
        stock=80,
        category_slug="mens-clothing",
        rating=4.7,
        variants=[{"type": "Size", "options": ["M", "L", "XL"]}]
    ),
    ProductCardItem(
        id="prod-006",
        name="Men's Premium Black Satin Party Wear Shirt",
        slug="mens-black-satin-party-wear-shirt",
        sku="SHIRT-SAT-BLK-006",
        price=1299.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt.jpg",
        stock=45,
        category_slug="mens-clothing",
        rating=4.9,
        variants=[{"type": "Size", "options": ["M", "L", "XL"]}]
    ),
    ProductCardItem(
        id="prod-007",
        name="Men's Emerald Silk Blend Festive Party Kurta",
        slug="mens-silk-blend-festive-party-kurta",
        sku="KURTA-SLK-EMR-007",
        price=1449.0,
        currency="INR",
        photo="/api/v1/images/sample-shirt.jpg",
        stock=35,
        category_slug="mens-clothing",
        rating=4.8,
        variants=[{"type": "Size", "options": ["S", "M", "L", "XL"]}]
    ),
]


async def execute_search_products(
    query: str,
    max_price: Optional[float] = None,
    min_price: Optional[float] = None,
    color: Optional[str] = None,
    category: Optional[str] = None,
    db_session: Any = None
) -> List[ProductCardItem]:
    """Search products using database session if available, else curated catalog."""
    q_lower = query.lower()
    results: List[ProductCardItem] = []

    # If DB session is provided, attempt live query:
    if db_session:
        try:
            from sqlalchemy import select
            from app.models.catalog import Product as DbProduct
            stmt = select(DbProduct).where(DbProduct.status == "Active").limit(6)
            res = await db_session.execute(stmt)
            db_products = res.scalars().all()
            for p in db_products:
                results.append(ProductCardItem(
                    id=str(p.id),
                    name=p.name,
                    slug=p.slug or f"product-{p.id}",
                    sku=p.sku,
                    price=float(p.price),
                    currency="INR",
                    photo=p.photo,
                    stock=p.stock or 100,
                    category_slug=p.category_slug,
                    rating=4.8
                ))
        except Exception:
            pass

    # Filter fallback/catalog products
    if not results:
        results = list(SAMPLE_PRODUCTS)

    # Detect party/festive intent
    is_party_query = any(k in q_lower for k in ["party", "festive", "kurta", "wedding", "function", "celebration", "satin"])

    # Detect color from query if not explicitly passed
    color_in_query = None
    for c in ["black", "blue", "navy", "white", "red", "green", "grey", "gray"]:
        if c in q_lower:
            color_in_query = c
            break

    target_color = color.lower() if color else color_in_query

    filtered = []
    for item in results:
        name_lower = item.name.lower()
        if is_party_query:
            if not any(pk in name_lower for pk in ["party", "festive", "kurta", "satin"]):
                continue

        if target_color and target_color not in name_lower:
            # Check if color is in variants
            has_color_variant = False
            if item.variants and isinstance(item.variants, list):
                for v in item.variants:
                    if isinstance(v, dict) and v.get("type", "").lower() == "color":
                        options = [str(o).lower() for o in v.get("options", [])]
                        if any(target_color in opt for opt in options):
                            has_color_variant = True
            if not has_color_variant:
                continue

        if max_price and item.price > max_price:
            continue
        if min_price and item.price < min_price:
            continue
        filtered.append(item)

    if filtered:
        return filtered[:4]

    # If no item strictly matched the budget, return closest items sorted by price
    closest = [item for item in results if not target_color or target_color in item.name.lower()]
    return closest[:3] if closest else results[:3]


# Realistic Active Demo Orders Registry
DEMO_ORDERS: Dict[str, OrderTrackingResult] = {
    "ORD-2026-9021": OrderTrackingResult(
        order_number="ORD-2026-9021",
        buyer_name="Satya Narayan",
        order_status="SHIPPED",
        payment_status="PAID",
        shipping_method="Delhivery Surface Express",
        shipping_eta="Estimated delivery by tomorrow, 6:00 PM",
        tracking_number="EXP-2026-9021-99",
        carrier_name="Delhivery Express",
        total=899.0,
        currency="INR",
        created_at="Nov 15, 2026",
        progress_percentage=65,
        items=[
            OrderItemSummary(
                product_name="Solid Black Cotton Blend Regular Fit Men's Casual Shirt",
                product_sku="SHIRT-COT-BLK-001",
                product_photo="/api/v1/images/sample-shirt.jpg",
                quantity=1,
                unit_price=899.0,
                line_total=899.0,
                variant={"Color": "Black", "Size": "L"}
            )
        ]
    ),
    "ORD-2026-1002": OrderTrackingResult(
        order_number="ORD-2026-1002",
        buyer_name="Satya Narayan",
        order_status="DELIVERED",
        payment_status="PAID",
        shipping_method="BlueDart Air Express",
        shipping_eta="Delivered on Nov 14, 2026",
        tracking_number="BD-992144-IN",
        carrier_name="BlueDart Express",
        total=999.0,
        currency="INR",
        created_at="Nov 10, 2026",
        progress_percentage=100,
        items=[
            OrderItemSummary(
                product_name="Men's Navy Blue 100% Combed Cotton Casual Shirt",
                product_sku="SHIRT-COT-NVY-002",
                product_photo="/api/v1/images/sample-shirt.jpg",
                quantity=1,
                unit_price=999.0,
                line_total=999.0,
                variant={"Color": "Navy Blue", "Size": "M"}
            )
        ]
    ),
}


async def execute_get_order_status(
    order_number: str,
    db_session: Any = None
) -> Optional[OrderTrackingResult]:
    """Fetch live order tracking status. Returns None if order does not exist or has not been placed."""
    cleaned_num = order_number.strip().upper().lstrip("#")
    
    # 1. Check live database if session is provided
    if db_session:
        try:
            from sqlalchemy import select
            from app.models.order import Order as DbOrder
            stmt = select(DbOrder).where(DbOrder.order_number == cleaned_num)
            res = await db_session.execute(stmt)
            db_order = res.scalars().first()
            if db_order:
                return OrderTrackingResult(
                    order_number=db_order.order_number,
                    buyer_name=getattr(db_order, "buyer_name", "Customer"),
                    order_status=getattr(db_order, "order_status", "PROCESSING"),
                    payment_status=getattr(db_order, "payment_status", "PAID"),
                    shipping_method=getattr(db_order, "shipping_method", "Standard"),
                    shipping_eta="Delivery in 2-4 business days",
                    tracking_number=getattr(db_order, "tracking_number", "TRK-001"),
                    carrier_name=getattr(db_order, "carrier_name", "Delhivery Express"),
                    total=float(getattr(db_order, "total", 0.0)),
                    currency="INR",
                    created_at=str(getattr(db_order, "created_at", "Recently")),
                    progress_percentage=50,
                    items=[]
                )
        except Exception:
            pass

    # 2. Check active demo orders registry
    if cleaned_num in DEMO_ORDERS:
        return DEMO_ORDERS[cleaned_num]

    # Partial/convenient matches for demo IDs (e.g. 9021 or 1002)
    if "9021" in cleaned_num:
        return DEMO_ORDERS["ORD-2026-9021"]
    if "1002" in cleaned_num:
        return DEMO_ORDERS["ORD-2026-1002"]

    # 3. Order not found / not placed yet -> Return None
    return None


def execute_get_store_policy(topic: str) -> str:
    """Return official policy string."""
    t = topic.lower().strip()
    p = chatbot_settings.policies
    if any(k in t for k in ["fit", "fitting", "exchange", "size exchange", "size fit na ho", "badal"]):
        return (
            f"Size Exchange & Return: Agar shirt ka size fit na ho ya badalna ho, toh {p.store_name} par "
            f"{p.return_window_days}-day free doorstep replacement suvidha uplabdh hai. "
            f"Courier boy ghar se item pick karta hai aur sahi size deliver karta hai without any extra charge. "
            f"Bas tags aur packing original honi chahiye."
        )
    elif "return" in t or "replace" in t:
        return f"Return Policy: {p.return_policy} Window: {p.return_window_days} days."
    elif "ship" in t or "deliver" in t:
        return f"Shipping Policy: {p.shipping_timeline} Rules: {p.shipping_fee_rule}"
    elif "pay" in t or "cod" in t or "upi" in t:
        return f"Payment Options: {p.payment_methods}"
    elif "b2b" in t or "bulk" in t or "wholesale" in t:
        return f"Wholesale / B2B: {p.b2b_wholesale}"
    elif "contact" in t or "help" in t or "support" in t:
        return f"Support: Email {p.support_email}, Phone {p.support_phone}"
    return f"{p.return_policy} | {p.shipping_timeline}"
