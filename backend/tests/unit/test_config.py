"""Unit tests for app.config module.

Tests the Settings class behavior: field types, defaults, env var loading,
and validation logic. No mocks -- real pydantic-settings instances.
"""

import os

import pytest
from pydantic_settings import BaseSettings


class TestSettingsClass:
    """Unit tests for the Settings class definition and behavior."""

    def test_settings_is_base_settings_subclass(self):
        """Settings must be a subclass of pydantic-settings BaseSettings."""
        from app.config import Settings

        assert issubclass(Settings, BaseSettings)

    def test_settings_instance_creation_with_defaults(self):
        """Settings can be instantiated with default values for optional fields."""
        from app.config import Settings

        # Create a fresh instance with only required-ish fields
        # (database_url and openrouter_api_key have defaults or empty strings)
        instance = Settings()
        assert instance is not None
        assert isinstance(instance, BaseSettings)

    def test_settings_field_database_url_is_str(self):
        """database_url field must be of type str."""
        from app.config import Settings

        field = Settings.model_fields["database_url"]
        assert field.annotation is str

    def test_settings_field_openrouter_api_key_is_str(self):
        """openrouter_api_key field must be of type str."""
        from app.config import Settings

        field = Settings.model_fields["openrouter_api_key"]
        assert field.annotation is str

    def test_settings_field_replicate_api_token_default_empty(self):
        """replicate_api_token must default to empty string."""
        from app.config import Settings

        field = Settings.model_fields["replicate_api_token"]
        assert field.default == ""

    def test_settings_field_langsmith_api_key_default_empty(self):
        """langsmith_api_key must default to empty string."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_api_key"]
        assert field.default == ""

    def test_settings_field_langsmith_tracing_default_false(self):
        """langsmith_tracing must be bool and default to False."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_tracing"]
        assert field.annotation is bool
        assert field.default is False

    def test_settings_field_assistant_model_default(self):
        """assistant_model_default must default to 'anthropic/claude-sonnet-4.6'."""
        from app.config import Settings

        field = Settings.model_fields["assistant_model_default"]
        assert field.default == "anthropic/claude-sonnet-4.6"

    def test_settings_field_app_version_default(self):
        """app_version must default to '1.0.0'."""
        from app.config import Settings

        field = Settings.model_fields["app_version"]
        assert field.default == "1.0.0"

    def test_settings_model_dump_contains_all_fields(self):
        """model_dump() must return a dict with all expected field keys."""
        from app.config import Settings

        instance = Settings()
        dumped = instance.model_dump()

        expected_keys = {
            "database_url",
            "openrouter_api_key",
            "replicate_api_token",
            "langsmith_api_key",
            "langsmith_tracing",
            "assistant_model_default",
            "app_version",
        }
        assert expected_keys.issubset(set(dumped.keys())), (
            f"Missing keys: {expected_keys - set(dumped.keys())}"
        )

    def test_settings_env_var_override(self, monkeypatch):
        """Settings fields can be overridden via environment variables."""
        from app.config import Settings

        monkeypatch.setenv("APP_VERSION", "2.0.0-test")
        monkeypatch.setenv("LANGSMITH_TRACING", "true")

        instance = Settings()
        assert instance.app_version == "2.0.0-test"
        assert instance.langsmith_tracing is True

    def test_settings_case_insensitive_env(self, monkeypatch):
        """Environment variables should be case-insensitive as per config."""
        from app.config import Settings

        monkeypatch.setenv("app_version", "3.0.0-lower")

        instance = Settings()
        assert instance.app_version == "3.0.0-lower"
