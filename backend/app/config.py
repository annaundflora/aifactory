import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Uses pydantic-settings BaseSettings for automatic env var loading.
    Variable names are case-insensitive and map directly to field names.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/aifactory"

    # LLM API (OpenRouter)
    openrouter_api_key: str = ""

    # Replicate API (for model recommendations)
    replicate_api_token: str = ""

    # LangSmith Observability
    langsmith_api_key: str = ""
    langsmith_tracing: bool = False
    langsmith_project: str = "prompt-assistant"

    # Assistant defaults
    assistant_model_default: str = "anthropic/claude-sonnet-4.6"

    # Application metadata
    app_version: str = "1.0.0"


settings = Settings()

# Propagate LangSmith settings to environment variables so that
# LangChain/LangGraph can auto-detect them (no explicit instrumentation needed).
# See AC-2: LangGraph reads LANGSMITH_TRACING and LANGSMITH_API_KEY automatically.
if settings.langsmith_tracing:
    os.environ.setdefault("LANGSMITH_TRACING", "true")
    if settings.langsmith_api_key:
        os.environ.setdefault("LANGSMITH_API_KEY", settings.langsmith_api_key)
    if settings.langsmith_project:
        os.environ.setdefault("LANGSMITH_PROJECT", settings.langsmith_project)
