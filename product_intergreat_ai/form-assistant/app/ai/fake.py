"""DEVELOPMENT/TEST ONLY. Deterministic offline provider. Each module registers a handler for
its schema via `register_fake`, so the service is fully testable without an API key.
Every response is labelled provider="fake"."""
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from app.ai.base import AIProvider, ImageInput, ProviderError, ProviderResult, T, Usage

_HANDLERS: dict[str, Callable[..., BaseModel]] = {}


def register_fake(schema: type[BaseModel], handler: Callable[..., BaseModel]) -> None:
    _HANDLERS[schema.__name__] = handler


class FakeProvider(AIProvider):
    name = "fake"
    model = "fake-1"

    def __init__(self) -> None:
        self.calls = 0
        self.last_untrusted = ""
        self.fail = False

    async def generate_structured(
        self, *, stage: str, schema: type[T], system: str, instruction: str, context: str,
        untrusted_text: str, prompt_version: str, images: list[ImageInput] | None = None,
    ) -> ProviderResult[T]:
        self.calls += 1
        self.last_untrusted = untrusted_text
        if self.fail:
            raise ProviderError("fake provider forced failure")
        handler = _HANDLERS.get(schema.__name__)
        if handler is None:
            raise ProviderError(f"fake provider has no handler for {schema.__name__}")
        data: Any = handler(untrusted_text=untrusted_text, context=context, images=images or [])
        return ProviderResult(data, Usage(self.name, self.model, prompt_version, 0, 0, 0.0, 0, stage))
