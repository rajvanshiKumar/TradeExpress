import uuid

import pytest

pytestmark = pytest.mark.integration
API = "/api/v1"

REQUIRED_TOP_LEVEL = {
    "clothing-fashion", "electronics", "mobile-accessories", "computers", "home-kitchen",
    "furniture", "beauty-personal-care", "health-wellness", "sports-fitness", "automotive",
    "industrial-machinery", "tools-hardware", "grocery-food", "toys-games", "books-stationery",
    "jewelry-accessories", "baby-products", "pet-supplies", "agriculture", "office-supplies",
    "construction-materials", "art-crafts", "musical-instruments", "outdoor-products",
    "travel-accessories",
}


async def test_default_categories_seeded(client, make_account):
    a = await make_account()
    tree = (await client.get(f"{API}/categories/tree", headers=a.h())).json()
    assert REQUIRED_TOP_LEVEL <= {n["slug"] for n in tree}
    clothing = next(n for n in tree if n["slug"] == "clothing-fashion")
    assert clothing["children"], "seed should include subcategories"


async def test_seed_is_idempotent(app):
    from app.seed.loader import seed_categories

    await seed_categories(app.state.engine)
    await seed_categories(app.state.engine)


async def test_default_schema_has_attributes_and_inherits(client, make_account):
    a = await make_account()
    flat = (await client.get(f"{API}/categories", headers=a.h(), params={"limit": 200})).json()["items"]
    leaf = next(c for c in flat if c["level"] >= 2)
    attrs = (await client.get(f"{API}/categories/{leaf['id']}/attributes", headers=a.h())).json()
    keys = {x["key"] for x in attrs}
    assert "brand" in keys, "root-level attributes are inherited by descendants"
    assert len(keys) > 3


async def test_non_admin_cannot_create_category(client, make_account):
    a = await make_account()
    r = await client.post(f"{API}/admin/categories", json={"name": "X", "slug": "x-1"}, headers=a.h())
    assert r.status_code == 403


async def test_admin_builds_hierarchy_and_attributes(client, admin_account):
    h = admin_account.h()
    slug = f"cat-{uuid.uuid4().hex[:6]}"
    root = (await client.post(f"{API}/admin/categories", json={"name": "Root", "slug": slug}, headers=h)).json()
    child = await client.post(
        f"{API}/admin/categories",
        json={"name": "Child", "slug": slug + "-c", "parent_id": root["id"]},
        headers=h,
    )
    assert child.status_code == 201 and child.json()["level"] == 1
    r = await client.post(
        f"{API}/admin/categories/{root['id']}/attributes",
        json={"key": "voltage", "label": "Voltage", "data_type": "measurement", "required": True,
              "unit": "V", "validation_rules": {"units": ["V"]}, "ocr_extractable": True},
        headers=h,
    )
    assert r.status_code == 201, r.text
    attrs = (await client.get(f"{API}/categories/{child.json()['id']}/attributes", headers=h)).json()
    assert [a["key"] for a in attrs] == ["voltage"]


async def test_depth_limited_to_four_levels(client, admin_account):
    h = admin_account.h()
    parent = None
    for i in range(4):
        r = await client.post(
            f"{API}/admin/categories",
            json={"name": f"L{i}", "slug": f"deep-{uuid.uuid4().hex[:6]}", "parent_id": parent},
            headers=h,
        )
        assert r.status_code == 201
        parent = r.json()["id"]
    r = await client.post(
        f"{API}/admin/categories",
        json={"name": "L4", "slug": f"deep-{uuid.uuid4().hex[:6]}", "parent_id": parent},
        headers=h,
    )
    assert r.status_code == 422


async def test_duplicate_slug_conflict(client, admin_account):
    h = admin_account.h()
    slug = f"dup-{uuid.uuid4().hex[:6]}"
    assert (await client.post(f"{API}/admin/categories", json={"name": "A", "slug": slug}, headers=h)).status_code == 201
    assert (await client.post(f"{API}/admin/categories", json={"name": "B", "slug": slug}, headers=h)).status_code == 409


async def test_schema_versioning_on_attribute_change(client, admin_account):
    h = admin_account.h()
    cat = (await client.post(
        f"{API}/admin/categories", json={"name": "V", "slug": f"v-{uuid.uuid4().hex[:6]}"}, headers=h
    )).json()
    v1 = cat["schema_version"]
    await client.post(
        f"{API}/admin/categories/{cat['id']}/attributes",
        json={"key": "color", "label": "Color", "data_type": "string"},
        headers=h,
    )
    got = (await client.get(f"{API}/categories/{cat['id']}", headers=h)).json()
    assert got["schema_version"] == v1 + 1
    versions = (await client.get(f"{API}/admin/categories/{cat['id']}/versions", headers=h)).json()
    assert [v["version"] for v in versions][-1] == v1 + 1
    assert versions[-1]["snapshot"][0]["key"] == "color"


async def test_invalid_data_type_rejected(client, admin_account):
    h = admin_account.h()
    cat = (await client.post(
        f"{API}/admin/categories", json={"name": "T", "slug": f"t-{uuid.uuid4().hex[:6]}"}, headers=h
    )).json()
    r = await client.post(
        f"{API}/admin/categories/{cat['id']}/attributes",
        json={"key": "x", "label": "X", "data_type": "blob"},
        headers=h,
    )
    assert r.status_code == 422


async def test_validate_values_against_dynamic_schema(client, admin_account):
    h = admin_account.h()
    cat = (await client.post(
        f"{API}/admin/categories", json={"name": "Val", "slug": f"val-{uuid.uuid4().hex[:6]}"}, headers=h
    )).json()
    await client.post(
        f"{API}/admin/categories/{cat['id']}/attributes",
        json={"key": "size", "label": "Size", "data_type": "enum", "required": True,
              "options": [{"value": "S", "label": "Small"}, {"value": "M", "label": "Medium"}]},
        headers=h,
    )
    ok = await client.post(f"{API}/categories/{cat['id']}/validate", json={"values": {"size": "M"}}, headers=h)
    assert ok.json() == {"valid": True, "errors": {}}
    bad = await client.post(f"{API}/categories/{cat['id']}/validate", json={"values": {"size": "XXL"}}, headers=h)
    assert bad.json()["valid"] is False and "size" in bad.json()["errors"]
    missing = await client.post(f"{API}/categories/{cat['id']}/validate", json={"values": {}}, headers=h)
    assert "size" in missing.json()["errors"]
    unknown = await client.post(f"{API}/categories/{cat['id']}/validate", json={"values": {"size": "S", "zzz": 1}}, headers=h)
    assert "zzz" in unknown.json()["errors"]


async def test_patch_category_and_deactivate(client, admin_account):
    h = admin_account.h()
    cat = (await client.post(
        f"{API}/admin/categories", json={"name": "P", "slug": f"p-{uuid.uuid4().hex[:6]}"}, headers=h
    )).json()
    r = await client.patch(f"{API}/admin/categories/{cat['id']}", json={"name": "P2", "is_active": False}, headers=h)
    assert r.status_code == 200 and r.json()["name"] == "P2"
    tree = (await client.get(f"{API}/categories/tree", headers=h)).json()
    assert cat["id"] not in {n["id"] for n in tree}


async def test_unknown_category_404(client, make_account):
    a = await make_account()
    assert (await client.get(f"{API}/categories/{uuid.uuid4()}", headers=a.h())).status_code == 404
