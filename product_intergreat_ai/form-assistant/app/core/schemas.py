"""Response/AI shapes shared by every form module."""
from typing import Literal

from pydantic import BaseModel


class Guess(BaseModel):
    """One field as the AI model returns it (internal, never sent to the client as-is)."""
    value: str | None = None
    confidence: float = 0.0


class FieldSuggestion(BaseModel):
    value: str | int | float
    confidence: float
    routing: Literal["prefill", "confirm"]
    reason: str = ""


class UsageOut(BaseModel):
    provider: str
    model: str
    prompt_version: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


class AssistOut(BaseModel):
    """Standard response of every `/assist` endpoint."""
    suggestions: dict[str, FieldSuggestion]
    skipped: dict[str, str]
    warnings: list[str]
    usage: UsageOut
