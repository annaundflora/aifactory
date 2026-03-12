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

    # Assistant defaults
    assistant_model_default: str = "anthropic/claude-sonnet-4.6"

    # Application metadata
    app_version: str = "1.0.0"


settings = Settings()
