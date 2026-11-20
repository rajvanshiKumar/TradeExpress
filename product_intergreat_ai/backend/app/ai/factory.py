from app.ai.base import AIProvider
from app.core.config import Settings


def build_provider(settings: Settings) -> AIProvider | None:
    """Returns None when the configured provider has no credentials; the API then answers 503
    for AI endpoints instead of silently switching providers or faking output."""
    if settings.ai_provider == "fake":
        from app.ai.testing import FakeProvider

        return FakeProvider()

    if settings.ai_provider == "openai":
        if settings.openai_api_key is None:
            return None
        from app.ai.openai import OpenAIProvider

        return OpenAIProvider(
            api_key=settings.openai_api_key.get_secret_value(),
            model=settings.openai_model,
            timeout=settings.openai_timeout_seconds,
            price_in_per_m=settings.openai_price_in_per_m,
            price_out_per_m=settings.openai_price_out_per_m,
        )

    if settings.gemini_api_key is None:
        return None
    from app.ai.gemini import GeminiProvider

    return GeminiProvider(
        api_key=settings.gemini_api_key.get_secret_value(),
        model=settings.gemini_model,
        timeout=settings.gemini_timeout_seconds,
        price_in_per_m=settings.gemini_price_in_per_m,
        price_out_per_m=settings.gemini_price_out_per_m,
    )
