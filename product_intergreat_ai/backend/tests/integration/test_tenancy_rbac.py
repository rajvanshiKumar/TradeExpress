import uuid

import asyncpg
import pytest

pytestmark = pytest.mark.integration
API = "/api/v1"


async def test_create_and_list_own_orgs_only(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a, org_b = await make_org(a), await make_org(b)
    ids_a = {o["id"] for o in (await client.get(f"{API}/organizations", headers=a.h())).json()["items"]}
    assert org_a in ids_a and org_b not in ids_a


async def test_cross_tenant_read_is_404(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a = await make_org(a)
    r = await client.get(f"{API}/organizations/{org_a}", headers=b.h())
    assert r.status_code == 404


async def test_cross_tenant_patch_is_404(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a = await make_org(a)
    r = await client.patch(f"{API}/organizations/{org_a}", json={"name": "Hacked"}, headers=b.h())
    assert r.status_code == 404
    r = await client.get(f"{API}/organizations/{org_a}", headers=a.h())
    assert r.json()["name"] != "Hacked"


async def test_org_header_for_non_member_forbidden(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a = await make_org(a)
    r = await client.get(f"{API}/sellers/profile", headers=b.h(org_a))
    assert r.status_code == 403


async def test_cannot_self_create_platform_owner_org(client, make_account):
    a = await make_account()
    r = await client.post(
        f"{API}/organizations", json={"name": "Evil", "org_type": "platform_owner"}, headers=a.h()
    )
    assert r.status_code == 403


async def test_owner_manages_members_and_viewer_is_read_only(client, make_account, make_org):
    owner, viewer = await make_account("o"), await make_account("v")
    org = await make_org(owner)
    r = await client.post(
        f"{API}/organizations/{org}/members",
        json={"email": viewer.email, "role": "viewer"},
        headers=owner.h(),
    )
    assert r.status_code == 201, r.text
    # viewer can read the org but not modify it
    assert (await client.get(f"{API}/organizations/{org}", headers=viewer.h())).status_code == 200
    r = await client.patch(f"{API}/organizations/{org}", json={"name": "xx"}, headers=viewer.h())
    assert r.status_code == 403
    r = await client.post(
        f"{API}/organizations/{org}/members",
        json={"email": owner.email, "role": "owner"},
        headers=viewer.h(),
    )
    assert r.status_code == 403
    r = await client.patch(f"{API}/organizations/{org}", json={"name": "Renamed"}, headers=owner.h())
    assert r.status_code == 200 and r.json()["name"] == "Renamed"


async def test_seller_profile_is_scoped_to_org(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a, org_b = await make_org(a), await make_org(b)
    r = await client.post(
        f"{API}/sellers/register",
        json={"display_name": "Shop A", "business_model": "b2b", "country": "IN"},
        headers=a.h(org_a),
    )
    assert r.status_code == 201, r.text
    await client.post(
        f"{API}/sellers/register", json={"display_name": "Shop B"}, headers=b.h(org_b)
    )
    r = await client.get(f"{API}/sellers/profile", headers=b.h(org_b))
    assert r.json()["display_name"] == "Shop B"
    r = await client.get(f"{API}/sellers/verification", headers=a.h(org_a))
    assert r.json()["verification_status"] == "unverified"


async def test_client_supplied_org_id_in_body_is_ignored(client, make_account, make_org):
    a, b = await make_account("a"), await make_account("b")
    org_a, org_b = await make_org(a), await make_org(b)
    r = await client.post(
        f"{API}/sellers/register",
        json={"display_name": "Sneaky", "organization_id": org_b},
        headers=a.h(org_a),
    )
    assert r.status_code == 201
    assert r.json()["organization_id"] == org_a


async def test_database_rls_blocks_without_tenant_context(db_url, superuser, make_account, make_org):
    """Defence in depth: even raw SQL as the app role sees nothing without a tenant GUC."""
    a = await make_account()
    await make_org(a)
    conn = await asyncpg.connect(db_url.replace("+asyncpg", ""))
    try:
        await conn.execute("SET ROLE tx_app")
        assert await conn.fetchval("SELECT count(*) FROM organization_members") == 0
        assert await conn.fetchval("SELECT count(*) FROM organizations") == 0
        await conn.execute("SELECT set_config('app.current_user_id', $1, false)", a.user_id)
        assert await conn.fetchval("SELECT count(*) FROM organization_members") >= 1
        # another org id as context must not expose foreign rows
        await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(uuid.uuid4()))
        rows = await conn.fetch("SELECT user_id FROM organization_members")
        assert {str(r["user_id"]) for r in rows} == {a.user_id}
    finally:
        await conn.close()


async def test_audit_logs_are_immutable_for_app_role(db_url, make_account, make_org):
    a = await make_account()
    await make_org(a)
    conn = await asyncpg.connect(db_url.replace("+asyncpg", ""))
    try:
        await conn.execute("SET ROLE tx_app")
        await conn.execute("SELECT set_config('app.is_platform_admin', 'true', false)")
        assert await conn.fetchval("SELECT count(*) FROM audit_logs") >= 1
        assert await conn.execute("DELETE FROM audit_logs") == "DELETE 0"
        assert await conn.execute("UPDATE audit_logs SET action = 'x'") == "UPDATE 0"
    finally:
        await conn.close()
