import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin


def _org_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


def _jsonb(default: Any = dict) -> Mapped[Any]:
    server = "'{}'::jsonb" if default is dict else "'[]'::jsonb"
    return mapped_column(JSONB, nullable=False, server_default=text(server), default=default)


class ApiKey(IdMixin, TimestampMixin, Base):
    __tablename__ = "api_keys"
    __table_args__ = (
        UniqueConstraint("organization_id", "prefix", name="uq_api_keys_org_prefix"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    scopes: Mapped[list[str]] = _jsonb(list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ApiIdempotencyKey(IdMixin, TimestampMixin, Base):
    __tablename__ = "api_idempotency_keys"
    __table_args__ = (
        UniqueConstraint("organization_id", "key", name="uq_idempotency_org_key"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    response_code: Mapped[int | None] = mapped_column(Integer)
    response_body: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WebhookEndpoint(IdMixin, TimestampMixin, Base):
    __tablename__ = "webhook_endpoints"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    secret: Mapped[str] = mapped_column(String(100), nullable=False)
    events: Mapped[list[str]] = _jsonb(list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    deliveries: Mapped[list["WebhookDelivery"]] = relationship(
        back_populates="endpoint", cascade="all, delete-orphan", lazy="selectin"
    )


class WebhookDelivery(IdMixin, TimestampMixin, Base):
    __tablename__ = "webhook_deliveries"

    endpoint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = _jsonb(dict)
    status_code: Mapped[int | None] = mapped_column(Integer)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    response_text: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    endpoint: Mapped[WebhookEndpoint] = relationship(back_populates="deliveries")

