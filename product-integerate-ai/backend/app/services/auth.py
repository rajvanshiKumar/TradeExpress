import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import Settings
from app.core.db import set_tenant_context
from app.core.errors import AuthError, ConflictError
from app.models import User, UserSession
from app.schemas.common import TokenOut
from app.services import audit

# Verified against when the account does not exist so timing does not reveal valid emails.
_DUMMY_HASH = security.hash_password("dummy-Password-123")


async def register(session: AsyncSession, email: str, password: str, full_name: str) -> User:
    exists = await session.scalar(select(User.id).where(User.email == email))
    if exists:
        raise ConflictError("An account with this email already exists")
    user = User(email=email, password_hash=security.hash_password(password), full_name=full_name)
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise ConflictError("An account with this email already exists") from exc
    await set_tenant_context(session, user_id=user.id)
    await audit.record(session, action="user.register", entity_type="user", entity_id=user.id,
                       actor_user_id=user.id)
    return user


async def _issue(session: AsyncSession, user_id: uuid.UUID, sess: UserSession,
                 settings: Settings) -> TokenOut:
    ttl = timedelta(days=settings.refresh_token_ttl_days)
    refresh, _ = security.create_refresh_token(user_id, sess.id, settings.jwt_secret, ttl)
    sess.refresh_digest = security.token_digest(refresh)
    sess.expires_at = datetime.now(UTC) + ttl
    access_ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    access = security.create_access_token(user_id, settings.jwt_secret, access_ttl)
    await session.flush()
    return TokenOut(access_token=access, refresh_token=refresh,
                    expires_in=int(access_ttl.total_seconds()))


async def login(session: AsyncSession, email: str, password: str, settings: Settings,
                user_agent: str | None) -> TokenOut:
    user = await session.scalar(select(User).where(User.email == email.lower()))
    ok = security.verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok or not user.is_active:
        raise AuthError("Invalid email or password")
    sess = UserSession(
        id=uuid.uuid4(), user_id=user.id, refresh_digest="", user_agent=(user_agent or "")[:300],
        expires_at=datetime.now(UTC),
    )
    session.add(sess)
    tokens = await _issue(session, user.id, sess, settings)
    await set_tenant_context(session, user_id=user.id)
    await audit.record(session, action="user.login", entity_type="user", entity_id=user.id,
                       actor_user_id=user.id)
    return tokens


async def refresh(session: AsyncSession, token: str, settings: Settings) -> TokenOut:
    claims = security.decode_token(token, settings.jwt_secret, expected_type="refresh")
    sess = await session.get(UserSession, uuid.UUID(claims["sid"]), with_for_update=True)
    if not sess or sess.revoked_at is not None or sess.expires_at < datetime.now(UTC):
        raise AuthError("Session is no longer valid")
    if sess.refresh_digest != security.token_digest(token):
        # An already-rotated token was replayed: assume theft and kill the session.
        sess.revoked_at = datetime.now(UTC)
        await set_tenant_context(session, user_id=sess.user_id)
        await audit.record(session, action="auth.refresh_reuse_detected",
                           entity_type="user_session", entity_id=sess.id,
                           actor_user_id=sess.user_id)
        await session.commit()
        raise AuthError("Refresh token reuse detected; session revoked")
    user = await session.get(User, sess.user_id)
    if not user or not user.is_active:
        raise AuthError("Account disabled")
    return await _issue(session, user.id, sess, settings)


async def logout(session: AsyncSession, token: str, settings: Settings) -> None:
    claims = security.decode_token(token, settings.jwt_secret, expected_type="refresh")
    sess = await session.get(UserSession, uuid.UUID(claims["sid"]))
    if sess and sess.revoked_at is None:
        sess.revoked_at = datetime.now(UTC)
        await session.flush()
