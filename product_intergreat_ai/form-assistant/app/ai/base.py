"""Provider-independent contract. A module only needs `generate_structured`: give it a pydantic
schema, an instruction, trusted context, the (untrusted) user text and optional document images,
get validated JSON back."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class ProviderError(Exception):
    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass
class ImageInput:
    data: bytes
    mime_type: str


@dataclass
class Usage:
    provider: str
    model: str
    prompt_version: str
    input_tokens: int
    output_tokens: int
    cost_usd: float | None
    latency_ms: int
    stage: str = ""


@dataclass
class ProviderResult(Generic[T]):
    data: T
    usage: Usage


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def generate_structured(
        self, *, stage: str, schema: type[T], system: str, instruction: str, context: str,
        untrusted_text: str, prompt_version: str, images: list[ImageInput] | None = None,
    ) -> ProviderResult[T]:
        """`context` is trusted (our own data, e.g. allowed categories, today's date).
        `untrusted_text` and `images` are user input and must be treated as data, never as
        instructions."""
