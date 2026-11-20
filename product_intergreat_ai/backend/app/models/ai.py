import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin

JOB_STATUSES = ("queued", "running", "analyzed", "awaiting_review", "approved", "rejected", "failed")


def _org_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False,
        index=True,
    )


def _job_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_listing_jobs.id", ondelete="CASCADE"), nullable=False,
        index=True,
    )


def _jsonb(default: Any = dict) -> Mapped[Any]:
    server = "'{}'::jsonb" if default is dict else "'[]'::jsonb"
    return mapped_column(JSONB, nullable=False, server_default=text(server), default=default)


class ProductImage(IdMixin, TimestampMixin, Base):
    __tablename__ = "product_images"
    __table_args__ = (UniqueConstraint("organization_id", "sha256"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    thumb_key: Mapped[str] = mapped_column(String(300), nullable=False)
    optimized_key: Mapped[str] = mapped_column(String(300), nullable=False)


class AIListingJob(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_listing_jobs"
    __table_args__ = (
        CheckConstraint("status in ('" + "','".join(JOB_STATUSES) + "')", name="status_valid"),
        CheckConstraint("progress between 0 and 100", name="progress_range"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued", index=True)
    stage: Mapped[str] = mapped_column(String(30), nullable=False, default="queued")
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="generate")
    image_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False)
    seller_hints: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    category_source: Mapped[str | None] = mapped_column(String(10))
    classification: Mapped[dict[str, Any]] = _jsonb()
    quality: Mapped[dict[str, Any]] = _jsonb()
    provider: Mapped[str | None] = mapped_column(String(30))
    model: Mapped[str | None] = mapped_column(String(80))
    prompt_version: Mapped[str | None] = mapped_column(String(30))
    error: Mapped[str | None] = mapped_column(Text)
    decision_reason: Mapped[str | None] = mapped_column(Text)


class AIJobEvent(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_job_events"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID] = _job_fk()
    stage: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")


class AIImageAnalysis(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_image_analysis"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID] = _job_fk()
    analysis: Mapped[dict[str, Any]] = _jsonb()
    ocr: Mapped[dict[str, Any]] = _jsonb()
    ocr_engine: Mapped[str | None] = mapped_column(String(60))


class AIAttributePrediction(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_attribute_predictions"
    __table_args__ = (UniqueConstraint("job_id", "attribute_key"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID] = _job_fk()
    attribute_key: Mapped[str] = mapped_column(String(80), nullable=False)
    data_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ai_value: Mapped[Any] = mapped_column(JSONB(none_as_null=True), nullable=True)
    seller_value: Mapped[Any] = mapped_column(JSONB(none_as_null=True), nullable=True)
    final_value: Mapped[Any] = mapped_column(JSONB(none_as_null=True), nullable=True)
    seller_provided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    routing: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    requires_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class AIGeneratedContent(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_generated_content"
    __table_args__ = (UniqueConstraint("job_id", "field", "version"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID] = _job_fk()
    field: Mapped[str] = mapped_column(String(40), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    origin: Mapped[str] = mapped_column(String(10), nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    prompt_version: Mapped[str | None] = mapped_column(String(30))
    model: Mapped[str | None] = mapped_column(String(80))


class AIUsageLog(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_usage_logs"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_listing_jobs.id", ondelete="SET NULL"), index=True)
    stage: Mapped[str] = mapped_column(String(30), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(30), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error: Mapped[str | None] = mapped_column(Text)


class AIFeedback(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_feedback"
    __table_args__ = (CheckConstraint("rating between 1 and 5", name="rating_range"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID] = _job_fk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    field: Mapped[str | None] = mapped_column(String(80))
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")


class AITranslation(IdMixin, TimestampMixin, Base):
    """Translation of a listing; the master content is never overwritten."""

    __tablename__ = "ai_translations"
    __table_args__ = (UniqueConstraint("job_id", "locale"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    job_id: Mapped[uuid.UUID] = _job_fk()
    locale: Mapped[str] = mapped_column(String(10), nullable=False)
    source_locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    fields: Mapped[dict[str, Any]] = _jsonb()
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class AIBulkJob(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_bulk_jobs"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="images")
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class AIBulkItem(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_bulk_items"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    bulk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_bulk_jobs.id", ondelete="CASCADE"), nullable=False,
        index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_images.id", ondelete="SET NULL"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_listing_jobs.id", ondelete="SET NULL"))
    upload_error: Mapped[str | None] = mapped_column(Text)
