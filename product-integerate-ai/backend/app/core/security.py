import hashlib
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.errors import AuthError

_ph = PasswordHasher()
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> None:
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters")
    if not (
        re.search(r"[a-z]", password) and re.search(r"[A-Z]", password) and re.search(r"\d", password)
    ):
        raise ValueError("Password must contain upper, lower case letters and a digit")


def _encode(payload: dict[str, Any], secret: str) -> str:
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def create_access_token(user_id: UUID, secret: str, ttl: timedelta) -> str:
    now = datetime.now(UTC)
    return _encode(
        {"sub": str(user_id), "type": "access", "iat": now, "exp": now + ttl, "jti": uuid4().hex},
        secret,
    )


def create_refresh_token(
    user_id: UUID, session_id: UUID, secret: str, ttl: timedelta
) -> tuple[str, str]:
    now = datetime.now(UTC)
    jti = uuid4().hex
    token = _encode(
        {
            "sub": str(user_id),
            "sid": str(session_id),
            "type": "refresh",
            "iat": now,
            "exp": now + ttl,
            "jti": jti,
        },
        secret,
    )
    return token, jti


def decode_token(token: str, secret: str, expected_type: str) -> dict[str, Any]:
    try:
        claims: dict[str, Any] = jwt.decode(
            token, secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub", "type"]}
        )
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired token") from exc
    if claims.get("type") != expected_type:
        raise AuthError("Wrong token type")
    return claims


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
