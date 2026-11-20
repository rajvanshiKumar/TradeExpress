from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORM


class ImageOut(ORM):
    id: UUID
    sha256: str
    original_filename: str
    mime_type: str
    width: int
    height: int
    size_bytes: int
    created_at: datetime
    duplicate: bool = False
    url: str = ""
    thumbnail_url: str = ""


class GenerateIn(BaseModel):
    image_ids: list[UUID] = Field(min_length=1, max_length=10)
    category_id: UUID | None = None
    seller_hints: str = Field(default="", max_length=2000)


class JobAccepted(BaseModel):
    job_id: UUID
    status: str


class JobStatus(BaseModel):
    job_id: UUID
    status: str
    stage: str
    progress: int
    error: str | None
    mode: str
    created_at: datetime


class JobListItem(JobStatus):
    title: str | None = None
    category_slug: str | None = None
    category_name: str | None = None
    thumbnail_url: str | None = None


class ApproveIn(BaseModel):
    content: dict[str, Any] = {}
    attributes: dict[str, Any] = {}


class RejectIn(BaseModel):
    reason: str = Field(default="", max_length=1000)


class RegenerateIn(BaseModel):
    field: str


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    field: str | None = Field(default=None, max_length=80)
    comment: str = Field(default="", max_length=2000)


class DecisionOut(BaseModel):
    job_id: UUID
    status: str
