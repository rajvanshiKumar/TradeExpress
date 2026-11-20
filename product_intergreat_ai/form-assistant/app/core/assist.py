"""The shared 'ask the model, then validate everything' pipeline used by every module."""
import logging
from collections.abc import Callable, Iterable
from typing import Any

from pydantic import BaseModel

from app.ai.base import AIProvider, ImageInput, ProviderError, ProviderResult
from app.core.errors import ProviderFailed
from app.core.schemas import FieldSuggestion, Guess, UsageOut

log = logging.getLogger("app.assist")

# validator(field, raw_value) -> (clean value | None, note).
# value None  = reject; note is the reason shown in `skipped`.
# value set   = accept; a non-empty note forces routing "confirm" and is shown to the user.
Validator = Callable[[str, str], tuple[str | int | float | None, str | None]]


def _filled(v: Any) -> bool:
    return v is not None and str(v).strip() != ""


async def call_provider(
    provider: AIProvider, *, stage: str, schema: type[Any], system: str, instruction: str, context: str,
    text: str, prompt_version: str, images: list[ImageInput] | None = None,
) -> ProviderResult[Any]:
    try:
        return await provider.generate_structured(
            stage=stage, schema=schema, system=system, instruction=instruction, context=context,
            untrusted_text=text, prompt_version=prompt_version, images=images)
    except ProviderError as exc:
        log.warning("%s provider failure: %s", stage, exc)
        raise ProviderFailed("The AI provider could not process this request. Please try again.") from exc


def evaluate(
    guesses: dict[str, Guess], validate: Validator, *, current_values: dict[str, Any], skip_filled: bool,
    prefill: float, confirm: float, force_confirm: Iterable[str] = (),
) -> tuple[dict[str, FieldSuggestion], dict[str, str]]:
    forced = set(force_confirm)
    suggestions: dict[str, FieldSuggestion] = {}
    skipped: dict[str, str] = {}
    for field, guess in guesses.items():
        if skip_filled and _filled(current_values.get(field)):
            skipped[field] = "already filled by the user"
            continue
        if guess.value is None or str(guess.value).strip() == "":
            skipped[field] = "not found in the text"
            continue
        conf = max(0.0, min(1.0, float(guess.confidence)))
        value, note = validate(field, str(guess.value))
        if value is None:
            skipped[field] = note or "invalid value"
            continue
        if conf < confirm:
            skipped[field] = "AI was not confident enough"
            continue
        routing = "prefill" if conf >= prefill and not note and field not in forced else "confirm"
        suggestions[field] = FieldSuggestion(value=value, confidence=round(conf, 2), routing=routing,
                                             reason=note or "")
    return suggestions, skipped


def usage_out(result: ProviderResult[Any]) -> UsageOut:
    u = result.usage
    return UsageOut(provider=u.provider, model=u.model, prompt_version=u.prompt_version,
                    input_tokens=u.input_tokens, output_tokens=u.output_tokens, latency_ms=u.latency_ms)


def log_done(stage: str, result: ProviderResult[Any], n: int) -> None:
    u = result.usage  # never log request text: it can contain personal data
    log.info("%s provider=%s model=%s in=%d out=%d latency_ms=%d suggested=%d", stage, u.provider, u.model,
             u.input_tokens, u.output_tokens, u.latency_ms, n)


def extraction_guesses(ext: BaseModel, field_map: dict[str, str]) -> dict[str, Guess]:
    """AI schema attribute names -> form field names."""
    return {field: getattr(ext, attr) for attr, field in field_map.items()}
