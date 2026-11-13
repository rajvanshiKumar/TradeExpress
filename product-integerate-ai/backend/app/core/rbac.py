"""Default role -> permission matrix. Seeded into the DB by the identity migration;
this module is the single source used for seeding and in-process checks."""

DEFAULT_ROLES: dict[str, list[str]] = {
    "owner": [
        "organization:manage", "member:manage", "product:read", "product:write",
        "product:publish", "ai:run", "offer:write", "category:read",
    ],
    "admin": [
        "member:manage", "product:read", "product:write", "product:publish",
        "ai:run", "offer:write", "category:read",
    ],
    "editor": ["product:read", "product:write", "ai:run", "offer:write", "category:read"],
    "viewer": ["product:read", "category:read"],
}


def role_has_permission(role: str, permission: str) -> bool:
    return permission in DEFAULT_ROLES.get(role, [])
