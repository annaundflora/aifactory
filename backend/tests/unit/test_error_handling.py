"""Unit tests for Slice 22: LangSmith Tracing + Error Handling.

Tests the internal logic of error handling in AssistantService and
LangSmith config field definitions.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent-Calls are mocked; all other components use real instances.
"""

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.assistant_service import RateLimiter


# ---------------------------------------------------------------------------
# AC-1: LangSmith Config Fields
# ---------------------------------------------------------------------------


class TestLangSmithConfigFields:
    """Unit tests for LangSmith settings fields in config.py (AC-1)."""

    def test_config_has_langsmith_tracing_field(self):
        """AC-1: Settings must have a 'langsmith_tracing' field of type bool."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_tracing"]
        assert field.annotation is bool, (
            f"Expected langsmith_tracing to be bool, got {field.annotation}"
        )

    def test_config_langsmith_tracing_defaults_false(self):
        """AC-1: langsmith_tracing must default to False."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_tracing"]
        assert field.default is False

    def test_config_has_langsmith_api_key_field(self):
        """AC-1: Settings must have a 'langsmith_api_key' field of type str."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_api_key"]
        assert field.annotation is str

    def test_config_langsmith_api_key_defaults_empty(self):
        """AC-1: langsmith_api_key must default to empty string."""
        from app.config import Settings

        field = Settings.model_fields["langsmith_api_key"]
        assert field.default == ""

    def test_config_has_langsmith_project_field(self):
        """AC-1: Settings must have a 'langsmith_project' field."""
        from app.config import Settings

        assert "langsmith_project" in Settings.model_fields

    def test_config_langsmith_tracing_reads_from_env(self, monkeypatch):
        """AC-1: langsmith_tracing is read from LANGSMITH_TRACING env var."""
        from app.config import Settings

        monkeypatch.setenv("LANGSMITH_TRACING", "true")
        instance = Settings()
        assert instance.langsmith_tracing is True

    def test_config_langsmith_api_key_reads_from_env(self, monkeypatch):
        """AC-1: langsmith_api_key is read from LANGSMITH_API_KEY env var."""
        from app.config import Settings

        monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_test_key_12345")
        instance = Settings()
        assert instance.langsmith_api_key == "lsv2_test_key_12345"


# ---------------------------------------------------------------------------
# AC-8: AssistantService._build_error_message
# ---------------------------------------------------------------------------


class TestBuildErrorMessage:
    """Unit tests for AssistantService._build_error_message static method (AC-8)."""

    def _get_build_error_message(self):
        """Import the static method."""
        from app.services.assistant_service import AssistantService
        return AssistantService._build_error_message

    def test_timeout_error_message(self):
        """AC-8: Timeout errors should yield a descriptive German message."""
        build = self._get_build_error_message()
        msg = build(Exception("Request timeout after 30s"))
        assert "zu lange gedauert" in msg

    def test_rate_limit_error_message(self):
        """AC-8: Rate limit (429) errors should yield appropriate message."""
        build = self._get_build_error_message()
        msg = build(Exception("rate limit exceeded 429"))
        assert "ueberlastet" in msg

    def test_unauthorized_error_message(self):
        """AC-8: 401 / unauthorized errors should yield auth error message."""
        build = self._get_build_error_message()
        msg = build(Exception("401 Unauthorized"))
        assert "Authentifizierungsfehler" in msg

    def test_internal_server_error_message(self):
        """AC-8: 500 errors should yield internal error message."""
        build = self._get_build_error_message()
        msg = build(Exception("500 Internal Server Error"))
        assert "internen Fehler" in msg

    def test_bad_gateway_error_message(self):
        """AC-8: 502 errors should yield unreachable message."""
        build = self._get_build_error_message()
        msg = build(Exception("502 Bad Gateway"))
        assert "nicht erreichbar" in msg

    def test_service_unavailable_error_message(self):
        """AC-8: 503 errors should yield temporarily unavailable message."""
        build = self._get_build_error_message()
        msg = build(Exception("503 Service Unavailable"))
        assert "nicht verfuegbar" in msg

    def test_unknown_error_fallback_message(self):
        """AC-8: Unknown errors should yield a generic fallback message."""
        build = self._get_build_error_message()
        msg = build(Exception("Something completely unknown"))
        assert "unerwarteter Fehler" in msg


# ---------------------------------------------------------------------------
# AC-8: AssistantService.stream_response error handling
# ---------------------------------------------------------------------------


class TestStreamResponseErrorHandling:
    """Unit tests for error handling in stream_response (AC-8).

    Mocking Strategy: mock_external. LangGraph agent is mocked.
    """

    def _make_service(self):
        """Create an AssistantService with mocked agent."""
        with patch("app.services.assistant_service.create_agent") as mock_create:
            mock_create.return_value = MagicMock()
            from app.services.assistant_service import AssistantService
            return AssistantService()

    @pytest.mark.asyncio
    async def test_timeout_error_yields_sse_error_event(self):
        """AC-8: TimeoutError in stream_response must yield an SSE error event."""
        service = self._make_service()

        async def failing_stream(*args, **kwargs):
            raise TimeoutError("Request timed out")
            yield  # pragma: no cover

        service._agent.astream_events = failing_stream

        events = []
        async for event in service.stream_response("sess-1", "Hello"):
            events.append(event)

        assert len(events) == 1
        assert events[0]["event"] == "error"
        data = json.loads(events[0]["data"])
        assert "message" in data
        assert "zu lange gedauert" in data["message"]

    @pytest.mark.asyncio
    async def test_connection_error_yields_sse_error_event(self):
        """AC-8: ConnectionError in stream_response must yield an SSE error event."""
        service = self._make_service()

        async def failing_stream(*args, **kwargs):
            raise ConnectionError("Connection refused")
            yield  # pragma: no cover

        service._agent.astream_events = failing_stream

        events = []
        async for event in service.stream_response("sess-2", "Hello"):
            events.append(event)

        assert len(events) == 1
        assert events[0]["event"] == "error"
        data = json.loads(events[0]["data"])
        assert "nicht erreichbar" in data["message"]

    @pytest.mark.asyncio
    async def test_generic_exception_yields_sse_error_event(self):
        """AC-8: Generic Exception in stream_response must yield an SSE error event."""
        service = self._make_service()

        async def failing_stream(*args, **kwargs):
            raise RuntimeError("500 Internal Server Error from OpenRouter")
            yield  # pragma: no cover

        service._agent.astream_events = failing_stream

        events = []
        async for event in service.stream_response("sess-3", "Hello"):
            events.append(event)

        assert len(events) == 1
        assert events[0]["event"] == "error"
        data = json.loads(events[0]["data"])
        assert "message" in data

    @pytest.mark.asyncio
    async def test_error_is_logged_as_error_level(self, caplog):
        """AC-8: Errors in stream_response must be logged at ERROR level."""
        service = self._make_service()

        async def failing_stream(*args, **kwargs):
            raise RuntimeError("LLM API failure")
            yield  # pragma: no cover

        service._agent.astream_events = failing_stream

        with caplog.at_level(logging.ERROR, logger="app.services.assistant_service"):
            events = []
            async for event in service.stream_response("sess-log", "Hello"):
                events.append(event)

        # Verify an ERROR log was produced
        error_logs = [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert len(error_logs) >= 1, "Expected at least one ERROR log entry"
        assert "sess-log" in error_logs[0].message

    @pytest.mark.asyncio
    async def test_timeout_error_is_logged(self, caplog):
        """AC-8: TimeoutError must be logged at ERROR level."""
        service = self._make_service()

        async def failing_stream(*args, **kwargs):
            raise TimeoutError("Timeout!")
            yield  # pragma: no cover

        service._agent.astream_events = failing_stream

        with caplog.at_level(logging.ERROR, logger="app.services.assistant_service"):
            events = []
            async for event in service.stream_response("sess-timeout", "Hello"):
                events.append(event)

        error_logs = [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert len(error_logs) >= 1
        assert "timeout" in error_logs[0].message.lower() or "sess-timeout" in error_logs[0].message

    @pytest.mark.asyncio
    async def test_stream_closed_after_error(self):
        """AC-8: After an error, no more events should be yielded (stream closed)."""
        service = self._make_service()

        async def failing_stream(*args, **kwargs):
            raise RuntimeError("Stream failure")
            yield  # pragma: no cover

        service._agent.astream_events = failing_stream

        events = []
        async for event in service.stream_response("sess-close", "Hello"):
            events.append(event)

        # Exactly one error event, no text-done after it
        assert len(events) == 1
        assert events[0]["event"] == "error"


# ---------------------------------------------------------------------------
# AC-7: Session Limit (RateLimiter unit logic)
# ---------------------------------------------------------------------------


class TestSessionLimitRateLimiter:
    """Unit tests for session lifetime limit at 100 messages (AC-7)."""

    def test_session_limit_returns_400_at_100_messages(self):
        """AC-7: After 100 messages, RateLimiter.check must return status_code=400."""
        limiter = RateLimiter(max_per_minute=1000, max_per_session=100)
        session_id = "limit-100"

        for _ in range(100):
            assert limiter.check(session_id) is None
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result is not None
        assert result["status_code"] == 400

    def test_session_limit_detail_message(self):
        """AC-7: The 400 response detail must contain the expected German message."""
        limiter = RateLimiter(max_per_minute=1000, max_per_session=100)
        session_id = "limit-msg"

        for _ in range(100):
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result is not None
        assert result["detail"] == "Session-Limit erreicht. Bitte starte eine neue Session."

    def test_session_at_99_messages_still_allowed(self):
        """AC-7: At 99 messages, the session is still allowed."""
        limiter = RateLimiter(max_per_minute=1000, max_per_session=100)
        session_id = "limit-99"

        for _ in range(99):
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result is None
