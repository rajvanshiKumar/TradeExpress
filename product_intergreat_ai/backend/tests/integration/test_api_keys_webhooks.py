import uuid

import pytest

pytestmark = pytest.mark.integration
API = "/api/v1"


async def test_api_keys_lifecycle_and_authentication(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    h = a.h(org)

    # 1. Create API key
    key_res = await client.post(
        f"{API}/developer/keys",
        json={"name": "TradeExpress Marketplace Live", "scopes": ["product:read", "product:write"]},
        headers=h,
    )
    assert key_res.status_code == 201, key_res.text
    data = key_res.json()
    raw_key = data["raw_key"]
    key_id = data["key"]["id"]
    assert raw_key.startswith("tx_live_")

    # 2. Authenticate using X-API-Key only (no Bearer token, no X-Organization-Id)
    api_h = {"x-api-key": raw_key}
    prod_res = await client.get(f"{API}/products", headers=api_h)
    assert prod_res.status_code == 200, prod_res.text
    assert "items" in prod_res.json()

    # 3. List keys
    list_keys_res = await client.get(f"{API}/developer/keys", headers=h)
    assert list_keys_res.status_code == 200
    assert len(list_keys_res.json()) >= 1

    # 4. Revoke key
    del_res = await client.delete(f"{API}/developer/keys/{key_id}", headers=h)
    assert del_res.status_code == 204

    # 5. Revoked key must be rejected
    fail_res = await client.get(f"{API}/products", headers=api_h)
    assert fail_res.status_code == 401


async def test_webhooks_registration_and_testing(client, make_account, make_org):
    a = await make_account()
    org = await make_org(a)
    h = a.h(org)

    # 1. Register webhook
    hook_res = await client.post(
        f"{API}/developer/webhooks",
        json={"url": "https://tradeexpress-1.onrender.com/api/webhooks/ai-listings", "events": ["listing.approved"]},
        headers=h,
    )
    assert hook_res.status_code == 201, hook_res.text
    hook = hook_res.json()
    hook_id = hook["id"]
    assert hook["secret"].startswith("whsec_")

    # 2. List webhooks
    list_res = await client.get(f"{API}/developer/webhooks", headers=h)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Dispatch test webhook
    test_res = await client.post(f"{API}/developer/webhooks/{hook_id}/test", headers=h)
    assert test_res.status_code == 200
    delivery = test_res.json()
    assert delivery["success"] is True
    assert delivery["event_type"] == "ping"

    # 4. View deliveries
    deliv_res = await client.get(f"{API}/developer/webhooks/{hook_id}/deliveries", headers=h)
    assert deliv_res.status_code == 200
    assert len(deliv_res.json()) >= 1

    # 5. Delete webhook
    del_res = await client.delete(f"{API}/developer/webhooks/{hook_id}", headers=h)
    assert del_res.status_code == 204

