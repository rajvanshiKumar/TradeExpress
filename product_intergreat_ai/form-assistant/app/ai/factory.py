from app.ai.base import AIProvider
from app.core.config import Settings


def build_provider(settings: Settings) -> AIProvider | None:
    """None when the configured provider has no credentials: the API then answers 503
    instead of silently switching providers or faking output."""
    if settings.ai_provider == "fake":
        from app.ai.fake import FakeProvider

        return FakeProvider()
    if settings.ai_provider == "openai":
        if settings.openai_api_key is None:
            return None
        from app.ai.openai import OpenAIProvider

        return OpenAIProvider(settings.openai_api_key.get_secret_value(), settings.openai_model,
                              settings.provider_timeout_seconds)
    if settings.gemini_api_key is None:
        return None
    from app.ai.gemini import GeminiProvider

    return GeminiProvider(settings.gemini_api_key.get_secret_value(), settings.gemini_model,
                          settings.provider_timeout_seconds)
