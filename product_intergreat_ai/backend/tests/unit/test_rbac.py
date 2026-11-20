from app.core.rbac import DEFAULT_ROLES, role_has_permission


def test_owner_can_manage_org():
    assert role_has_permission("owner", "organization:manage")


def test_viewer_cannot_write_products():
    assert not role_has_permission("viewer", "product:write")
    assert role_has_permission("viewer", "product:read")


def test_unknown_role_has_nothing():
    assert not role_has_permission("ghost", "product:read")


def test_every_role_permission_is_namespaced():
    for perms in DEFAULT_ROLES.values():
        assert all(":" in p for p in perms)
