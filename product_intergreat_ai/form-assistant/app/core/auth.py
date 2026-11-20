import secrets

from fastapi import Header, Request

from app.core.errors import AuthError


def require_api_key(request: Request, x_api_key: str | None = Header(default=None)) -> str:
    """Server-to-server auth. The key must live on your Express backend, never in a production
    browser bundle (the bundled test-ui is the only exception, for local testing)."""
    expected = request.app.state.settings.api_key.get_secret_value()
    if not x_api_key or not secrets.compare_digest(x_api_key.encode(), expected.encode()):
        raise AuthError("Missing or invalid X-API-Key")
    limit = request.app.state.settings.rate_limit_per_minute
    request.app.state.rate_limiter.check(f"key:{x_api_key[:8]}", limit, 60)
    return x_api_key
