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
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin

DATA_TYPES = (
    "string", "integer", "decimal", "boolean", "enum", "multi_select", "date", "measurement",
    "dimension", "weight", "currency", "url", "object", "array",
)


class Category(IdMixin, TimestampMixin, Base):
    """Hierarchy: level 0 Category -> 1 Subcategory -> 2 Child Category -> 3 Product Type."""

    __tablename__ = "categories"
    __table_args__ = (CheckConstraint("level between 0 and 3", name="level_range"),)

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    path: Mapped[str] = mapped_column(String(800), nullable=False, index=True)
    name_i18n: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    attributes: Mapped[list["CategoryAttribute"]] = relationship(
        back_populates="category", lazy="selectin", order_by="CategoryAttribute.sort_order"
    )


class CategoryAttribute(IdMixin, TimestampMixin, Base):
    __tablename__ = "category_attributes"
    __table_args__ = (
        UniqueConstraint("category_id", "key"),
        CheckConstraint(
            "data_type in ('" + "','".join(DATA_TYPES) + "')", name="data_type_valid"
        ),
        CheckConstraint(
            "confidence_threshold between 0 and 1", name="confidence_threshold_range"
        ),
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    data_type: Mapped[str] = mapped_column(String(20), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unit: Mapped[str | None] = mapped_column(String(20))
    validation_rules: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
    seller_editable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ai_extractable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ocr_extractable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence_threshold: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, default=Decimal("0.80")
    )
    market_requirements: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category: Mapped[Category] = relationship(back_populates="attributes")
    options: Mapped[list["CategoryAttributeOption"]] = relationship(
        lazy="selectin", order_by="CategoryAttributeOption.sort_order", cascade="all, delete-orphan"
    )


class CategoryAttributeOption(IdMixin, Base):
    __tablename__ = "category_attribute_options"
    __table_args__ = (UniqueConstraint("attribute_id", "value"),)

    attribute_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("category_attributes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    value: Mapped[str] = mapped_column(String(200), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CategorySchemaVersion(IdMixin, Base):
    __tablename__ = "category_schema_versions"
    __table_args__ = (UniqueConstraint("category_id", "version"),)

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
