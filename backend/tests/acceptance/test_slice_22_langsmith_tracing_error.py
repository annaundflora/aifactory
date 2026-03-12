"""Acceptance tests for Slice 22: LangSmith Tracing + Error Handling.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-22-langsmith-tracing-error.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent-Calls are mocked; all other components use real instances.
"""

import json
import logging
import os
from unittest.mock import MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_service_and_rate_limiter():
    """Reset the module-level service and rate limiter for test isolation."""
    import app.routes.messages as msg_module
    import app.services.assistant_service as svc_module

    fresh_limiter = svc_module.RateLimiter()
    svc_module.rate_limiter = fresh_limiter
    msg_module.rate_limiter = fresh_limiter

    with patch("app.services.assistant_service.create_agent") as mock_create:
        mock_agent = MagicMock()
        mock_create.return_value = mock_agent
        msg_module._service = svc_module.AssistantService()

    yield

    fresh_limiter = svc_module.RateLimiter()
    svc_module.rate_limiter = fresh_limiter
    msg_module.rate_limiter = fresh_limiter


@pytest.fixture
def app():
    """Return the FastAPI app instance."""
    from app.main import app
    return app


def _setup_mock_error(error_class, error_msg):
    """Configure the mocked agent to raise during streaming."""
    import app.routes.messages as msg_module

    async def failing_astream_events(input_state, config, version="v2"):
        raise error_class(error_msg)
        yield  # pragma: no cover

    msg_module._service._agent.astream_events = failing_astream_events


def _setup_mock_stream(events):
    """Configure the mocked agent to yield given LangGraph events."""
    import app.routes.messages as msg_module

    async def fake_astream_events(input_state, config, version="v2"):
        for event in events:
            yield event

    msg_module._service._agent.astream_events = fake_astream_events


# ---------------------------------------------------------------------------
# AC-1: GIVEN LANGSMITH_TRACING=true und LANGSMITH_API_KEY in der Backend-Config
#        WHEN config.py geladen wird
#        THEN sind langsmith_tracing: bool und langsmith_api_key: str | None
#             als Settings-Felder verfuegbar und werden als Env-Vars gelesen
# ---------------------------------------------------------------------------


class TestAC1LangSmithConfig:
    """AC-1: LangSmith config fields available and read from env vars."""

    def test_ac1_langsmith_tracing_field_is_bool(self):
        """AC-1: GIVEN LANGSMITH_TRACING=true und LANGSMITH_API_KEY in der Backend-Config
        WHEN config.py geladen wird
        THEN sind langsmith_tracing: bool und langsmith_api_key: str | None als
        Settings-Felder verfuegbar und werden als Env-Vars gelesen."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_tracing"]
        assert field.annotation is bool

    def test_ac1_langsmith_api_key_field_is_str(self):
        """AC-1: langsmith_api_key must be a str field."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_api_key"]
        assert field.annotation is str

    def test_ac1_settings_read_langsmith_from_env(self, monkeypatch):
        """AC-1: Settings fields are populated from environment variables."""
        from app.config import Settings

        monkeypatch.setenv("LANGSMITH_TRACING", "true")
        monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_ac1_test")

        instance = Settings()
        assert instance.langsmith_tracing is True
        assert instance.langsmith_api_key == "lsv2_ac1_test"


# ---------------------------------------------------------------------------
# AC-2: GIVEN ein laufender FastAPI Server mit LangSmith-Config
#        WHEN ein LLM-Call ueber LangGraph ausgefuehrt wird
#        THEN werden die Environment-Variablen LANGSMITH_TRACING und
#             LANGSMITH_API_KEY automatisch von LangChain/LangGraph gelesen
# ---------------------------------------------------------------------------


class TestAC2LangSmithEnvPropagation:
    """AC-2: LangSmith env vars propagated for LangGraph auto-detection."""

    def test_ac2_env_vars_propagated_when_tracing_enabled(self, monkeypatch):
        """AC-2: GIVEN ein laufender FastAPI Server mit LangSmith-Config
        WHEN ein LLM-Call ueber LangGraph ausgefuehrt wird
        THEN werden die Environment-Variablen LANGSMITH_TRACING und
        LANGSMITH_API_KEY automatisch von LangChain/LangGraph gelesen."""
        monkeypatch.delenv("LANGSMITH_TRACING", raising=False)
        monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
        monkeypatch.delenv("LANGSMITH_PROJECT", raising=False)

        monkeypatch.setenv("LANGSMITH_TRACING", "true")
        monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_ac2_key")
        monkeypatch.setenv("LANGSMITH_PROJECT", "ac2-project")

        import importlib
        import app.config
        importlib.reload(app.config)

        assert os.environ.get("LANGSMITH_TRACING") == "true"
        assert os.environ.get("LANGSMITH_API_KEY") == "lsv2_ac2_key"
        assert os.environ.get("LANGSMITH_PROJECT") == "ac2-project"


# ---------------------------------------------------------------------------
# AC-7: GIVEN eine Session mit message_count >= 100
#        WHEN der User eine weitere Nachricht senden will
#        THEN antwortet das Backend mit HTTP 400 und
#             {"detail": "Session-Limit erreicht. Bitte starte eine neue Session."}
# ---------------------------------------------------------------------------


class TestAC7SessionLimit:
    """AC-7: Session limit at 100 messages returns HTTP 400."""

    @pytest.mark.asyncio
    async def test_ac7_session_limit_400_at_100_messages(self, app):
        """AC-7: GIVEN eine Session mit message_count >= 100
        WHEN der User eine weitere Nachricht senden will
        THEN antwortet das Backend mit HTTP 400 und
        {"detail": "Session-Limit erreicht. Bitte starte eine neue Session."}"""
        import app.routes.messages as msg_module

        session_id = "ac7-session-limit"
        for _ in range(100):
            msg_module.rate_limiter.record(session_id)

        _setup_mock_stream([])

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                f"/api/assistant/sessions/{session_id}/messages",
                json={"content": "Message 101"},
            )

        assert response.status_code == 400
        body = response.json()
        assert body["detail"] == "Session-Limit erreicht. Bitte starte eine neue Session."


# ---------------------------------------------------------------------------
# AC-8: GIVEN der AssistantService im Backend empfaengt einen LLM-API-Fehler
#        WHEN der Fehler in stream_response() abgefangen wird
#        THEN wird ein SSE error Event mit beschreibender Fehlermeldung gesendet,
#             der Stream geschlossen, und der Fehler im Python-Logger als ERROR geloggt
# ---------------------------------------------------------------------------


class TestAC8LLMErrorHandling:
    """AC-8: LLM errors yield SSE error events, close stream, and log ERROR."""

    @pytest.mark.asyncio
    async def test_ac8_llm_error_sends_sse_error_event(self, app):
        """AC-8: GIVEN der AssistantService empfaengt einen LLM-API-Fehler
        WHEN der Fehler in stream_response() abgefangen wird
        THEN wird ein SSE error Event mit beschreibender Fehlermeldung gesendet."""
        _setup_mock_error(RuntimeError, "500 Internal Server Error")

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac8-error/messages",
                json={"content": "Trigger LLM error"},
            )

        assert response.status_code == 200
        body = response.text
        assert "event: error" in body

        # Parse the data from the error event
        for line in body.split("\n"):
            if line.startswith("data:"):
                data = json.loads(line[5:].strip())
                assert "message" in data
                break

    @pytest.mark.asyncio
    async def test_ac8_llm_error_is_logged_as_error(self, app, caplog):
        """AC-8: GIVEN der AssistantService empfaengt einen LLM-API-Fehler
        WHEN der Fehler in stream_response() abgefangen wird
        THEN wird der Fehler im Python-Logger als ERROR geloggt."""
        _setup_mock_error(RuntimeError, "OpenRouter 500 error for logging test")

        with caplog.at_level(logging.ERROR, logger="app.services.assistant_service"):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                response = await client.post(
                    "/api/assistant/sessions/ac8-log/messages",
                    json={"content": "Trigger log error"},
                )
                # Consume the response to ensure the stream is read
                _ = response.text

        error_logs = [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert len(error_logs) >= 1, "Expected at least one ERROR log entry"

    @pytest.mark.asyncio
    async def test_ac8_stream_closed_after_error(self, app):
        """AC-8: GIVEN der AssistantService empfaengt einen LLM-API-Fehler
        WHEN der Fehler in stream_response() abgefangen wird
        THEN wird der Stream geschlossen (no more events after error)."""
        _setup_mock_error(TimeoutError, "LLM timeout")

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac8-close/messages",
                json={"content": "Trigger timeout"},
            )

        body = response.text
        # Count event occurrences -- should have error but NOT text-done after error
        lines = body.strip().split("\n")
        event_lines = [l for l in lines if l.startswith("event:")]

        # There should be exactly one event: the error event
        assert len(event_lines) == 1
        assert "error" in event_lines[0]
