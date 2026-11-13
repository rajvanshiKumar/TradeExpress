import uuid
from decimal import Decimal

import pytest

from app.ai.testing import FakeProvider
from tests.integration.test_images_api import upload

pytestmark = pytest.mark.integration
API = "/api/v1"


@pytest.fixture
def fake(app):
    provider = FakeProvider()
    app.state.ai_provider = provider
    return provider


async def test_product_crud_and_offers(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    h = a.h(org)

    # 1. Fetch category id
    cats = (await client.get(f"{API}/categories", headers=a.h())).json()
    items = cats.get("items", cats)
    assert len(items) > 0
    cat_id = items[0]["id"]

    # 2. Create product
    create_payload = {
        "category_id": cat_id,
        "title": "Industrial Wireless Barcode Scanner",
        "short_title": "Wireless Scanner",
        "brand": "ScanMaster",
        "model": "SM-9000",
        "description": "High performance 2D industrial barcode scanner with rugged IP65 enclosure.",
        "short_description": "Rugged 2D barcode scanner.",
        "highlights": ["IP65 waterproof", "Bluetooth 5.0", "14-hour battery life"],
        "seo_title": "Industrial Barcode Scanner - ScanMaster SM-9000",
        "seo_description": "Buy rugged 2D barcode scanner with fast 100m wireless range.",
        "seo_keywords": ["barcode scanner", "industrial scanner", "2D scanner"],
        "tags": ["b2b", "warehouse", "logistics"],
        "variants": [
            {
                "sku": "SM-9000-BLK",
                "variant_name": "Standard Black",
                "attributes": {"color": "black"},
                "barcode": "012345678905",
            }
        ],
        "attributes": [
            {
                "attribute_key": "connectivity",
                "value": "Bluetooth 5.0",
                "source": "seller",
                "verified": True,
            }
        ],
    }
    r = await client.post(f"{API}/products", json=create_payload, headers=h)
    assert r.status_code == 201, r.text
    prod = r.json()
    prod_id = prod["id"]
    assert prod["status"] == "draft"
    assert prod["brand"] == "ScanMaster"
    assert len(prod["variants"]) == 1
    assert prod["variants"][0]["sku"] == "SM-9000-BLK"

    # 3. Publish product
    pub_res = await client.post(f"{API}/products/{prod_id}/publish", headers=h)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "published"

    # 4. Create B2B commercial offer with tiered pricing
    offer_payload = {
        "product_id": prod_id,
        "variant_id": prod["variants"][0]["id"],
        "offer_type": "both",
        "retail_price": 199.99,
        "wholesale_price": 140.00,
        "currency": "USD",
        "min_order_quantity": 5,
        "lead_time_days": 7,
        "stock_quantity": 500,
        "pricing_tiers": [
            {"min_quantity": 5, "max_quantity": 19, "unit_price": 140.00, "currency": "USD"},
            {"min_quantity": 20, "max_quantity": 99, "unit_price": 120.00, "currency": "USD"},
            {"min_quantity": 100, "max_quantity": None, "unit_price": 95.00, "currency": "USD"},
        ],
    }
    offer_res = await client.post(f"{API}/offers", json=offer_payload, headers=h)
    assert offer_res.status_code == 201, offer_res.text
    offer_data = offer_res.json()
    assert offer_data["min_order_quantity"] == 5
    assert len(offer_data["pricing_tiers"]) == 3

    # 5. List products with search filter
    list_res = await client.get(f"{API}/products?search=ScanMaster", headers=h)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1


async def test_publish_from_approved_job(client, app, fake, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    h = a.h(org)

    # 1. Upload image
    up = await upload(client, a, org)
    img_id = up.json()["id"]

    # 2. Run AI listing job
    job_res = await client.post(
        f"{API}/ai/listings/generate",
        json={"image_ids": [img_id], "category_slug": "headphones"},
        headers=h,
    )
    assert job_res.status_code == 202
    job_id = job_res.json()["job_id"]
    await app.state.job_runner.wait_all()

    # 3. Trying to publish before approval must fail
    fail_pub = await client.post(
        f"{API}/products/from-job/{job_id}",
        json={"retail_price": 49.99, "wholesale_price": 35.00, "currency": "USD"},
        headers=h,
    )
    assert fail_pub.status_code == 409

    # 4. Approve the listing
    app_res = await client.post(
        f"{API}/ai/listings/{job_id}/approve",
        json={"attributes": {}},
        headers=h,
    )
    assert app_res.status_code == 200

    # 5. Now publish to master catalog
    pub = await client.post(
        f"{API}/products/from-job/{job_id}",
        json={
            "sku": "AI-PROD-001",
            "retail_price": 49.99,
            "wholesale_price": 35.00,
            "min_order_quantity": 2,
            "stock_quantity": 50,
        },
        headers=h,
    )
    assert pub.status_code == 201, pub.text
    prod = pub.json()
    assert prod["status"] == "published"
    assert prod["listing_job_id"] == job_id
    assert len(prod["variants"]) >= 1


async def test_international_markets_and_currencies(client):
    r_mkts = await client.get(f"{API}/markets")
    assert r_mkts.status_code == 200
    mkts = r_mkts.json()
    codes = {m["code"] for m in mkts}
    assert {"US", "EU", "GCC", "IN", "UK"}.issubset(codes)

    r_curr = await client.get(f"{API}/currencies")
    assert r_curr.status_code == 200
    currs = r_curr.json()
    curr_codes = {c["code"] for c in currs}
    assert {"USD", "EUR", "GBP", "AED", "INR"}.issubset(curr_codes)
