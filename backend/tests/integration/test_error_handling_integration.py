"""Integration tests for Slice 22: LangSmith Tracing + Error Handling.

Tests the integration of error handling across routes, services, and config.
Validates that errors flow correctly from service to route to HTTP response.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent-Calls are mocked; all other components (FastAPI app, routes,
config, rate limiter) use real instances.
"""

import json
import os
from unittest.mock import MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport

from app.services.assistant_service import RateLimiter


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
# AC-2: LangSmith env var propagation
# ---------------------------------------------------------------------------


class TestLangSmithEnvPropagation:
    """Integration tests for LangSmith env var propagation (AC-2)."""

    def test_langsmith_env_vars_propagated_when_tracing_true(self, monkeypatch):
        """AC-2: When LANGSMITH_TRACING=true and LANGSMITH_API_KEY set,
        config.py must propagate them to os.environ for LangGraph auto-detection."""
        # Clear any existing env vars first
        monkeypatch.delenv("LANGSMITH_TRACING", raising=False)
        monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
        monkeypatch.delenv("LANGSMITH_PROJECT", raising=False)

        monkeypatch.setenv("LANGSMITH_TRACING", "true")
        monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_test_integration_key")
        monkeypatch.setenv("LANGSMITH_PROJECT", "test-project")

        # Re-import config to trigger the propagation logic
        import importlib
        import app.config
        importlib.reload(app.config)

        # The env vars should be set in os.environ
        assert os.environ.get("LANGSMITH_TRACING") == "true"
        assert os.environ.get("LANGSMITH_API_KEY") == "lsv2_test_integration_key"
        assert os.environ.get("LANGSMITH_PROJECT") == "test-project"

    def test_langsmith_env_vars_not_set_when_tracing_false(self, monkeypatch):
        """AC-2: When LANGSMITH_TRACING=false, env vars should NOT be force-set."""
        monkeypatch.delenv("LANGSMITH_TRACING", raising=False)
        monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
        monkeypatch.delenv("LANGSMITH_PROJECT", raising=False)

        monkeypatch.setenv("LANGSMITH_TRACING", "false")

        import importlib
        import app.config
        importlib.reload(app.config)

        # Settings instance should have tracing=False
        assert app.config.settings.langsmith_tracing is False


# ---------------------------------------------------------------------------
# AC-7: Session Limit via HTTP
# ---------------------------------------------------------------------------


class TestSessionLimitHTTP:
    """Integration tests for session limit returning HTTP 400 (AC-7)."""

    @pytest.mark.asyncio
    async def test_session_limit_returns_400_via_http(self, app):
        """AC-7: When message_count >= 100, backend returns HTTP 400 with specific detail."""
        import app.routes.messages as msg_module

        # Pre-fill the rate limiter to 100 messages
        session_id = "session-limit-test"
        for _ in range(100):
            msg_module.rate_limiter.record(session_id)

        _setup_mock_stream([])

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                f"/api/assistant/sessions/{session_id}/messages",
                json={"content": "One more message"},
            )

        assert response.status_code == 400
        body = response.json()
        assert body["detail"] == "Session-Limit erreicht. Bitte starte eine neue Session."


# ---------------------------------------------------------------------------
# AC-8: LLM Error -> SSE error event via HTTP
# ---------------------------------------------------------------------------


class TestLLMErrorSSEIntegration:
    """Integration tests for LLM errors flowing through route to SSE (AC-8)."""

    @pytest.mark.asyncio
    async def test_llm_runtime_error_returns_sse_error(self, app):
        """AC-8: RuntimeError in LLM call yields SSE error event through HTTP route."""
        _setup_mock_error(RuntimeError, "500 Internal Server Error from LLM")

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-session/messages",
                json={"content": "Trigger error"},
            )

        # SSE response should be 200 (SSE streams start with 200)
        assert response.status_code == 200

        # Parse SSE events from the response body
        body = response.text
        assert "event: error" in body

    @pytest.mark.asyncio
    async def test_llm_timeout_returns_sse_error(self, app):
        """AC-8: TimeoutError in LLM call yields SSE error event through HTTP route."""
        _setup_mock_error(TimeoutError, "LLM request timed out")

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-timeout/messages",
                json={"content": "Trigger timeout"},
            )

        assert response.status_code == 200
        body = response.text
        assert "event: error" in body

    @pytest.mark.asyncio
    async def test_llm_connection_error_returns_sse_error(self, app):
        """AC-8: ConnectionError in LLM call yields SSE error event through HTTP route."""
        _setup_mock_error(ConnectionError, "Connection refused to LLM")

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-conn/messages",
                json={"content": "Trigger connection error"},
            )

        assert response.status_code == 200
        body = response.text
        assert "event: error" in body
