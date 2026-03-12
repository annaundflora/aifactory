"""Integration tests for Slice 04: SSE Streaming Endpoint.

Tests the full FastAPI request/response cycle for the messages endpoint,
including DTO validation, rate limiting, and SSE streaming via httpx.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent-Calls are mocked; HTTP layer and FastAPI routing are real.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport

from app.models.dtos import ALLOWED_MODELS


def _create_test_app():
    """Create a fresh FastAPI app for testing, with mocked agent."""
    import app.routes.messages as msg_module
    import app.services.assistant_service as svc_module

    # Reset the rate limiter both at the service module AND the route module
    # (messages.py imports rate_limiter directly, creating a local reference)
    fresh_limiter = svc_module.RateLimiter()
    svc_module.rate_limiter = fresh_limiter
    msg_module.rate_limiter = fresh_limiter

    # Mock create_agent so we don't need real LLM credentials
    with patch("app.services.assistant_service.create_agent") as mock_create:
        mock_agent = MagicMock()
        mock_create.return_value = mock_agent

        # Re-instantiate the service with mocked agent
        msg_module._service = svc_module.AssistantService()

    from app.main import create_app

    return create_app()


def _setup_mock_agent_stream(events):
    """Setup the agent mock to yield given events via astream_events."""
    import app.routes.messages as msg_module

    async def fake_astream_events(input_state, config, version="v2"):
        for event in events:
            yield event

    msg_module._service._agent.astream_events = fake_astream_events


def _setup_mock_agent_error(error_msg):
    """Setup the agent mock to raise an exception during streaming."""
    import app.routes.messages as msg_module

    async def failing_astream_events(input_state, config, version="v2"):
        raise RuntimeError(error_msg)
        # Make it an async generator by adding unreachable yield
        yield  # pragma: no cover

    msg_module._service._agent.astream_events = failing_astream_events


@pytest.fixture(autouse=True)
def fresh_app():
    """Ensure a fresh app/service/rate-limiter for each test."""
    _create_test_app()
    yield
    # Cleanup: reset rate limiter in both modules
    import app.routes.messages as msg_module
    import app.services.assistant_service as svc_module

    fresh_limiter = svc_module.RateLimiter()
    svc_module.rate_limiter = fresh_limiter
    msg_module.rate_limiter = fresh_limiter


@pytest.fixture
def app():
    """Return the FastAPI app instance."""
    from app.main import app

    return app


# ---------------------------------------------------------------------------
# AC-1: POST returns SSE stream
# ---------------------------------------------------------------------------


class TestPostMessageSSEStream:
    """Integration tests for SSE streaming endpoint."""

    @pytest.mark.asyncio
    async def test_post_message_returns_sse_content_type(self, app):
        """AC-1 integration: POST with valid content returns text/event-stream."""
        # Setup agent mock to yield a simple text event
        chunk_mock = MagicMock()
        chunk_mock.content = "Hallo!"
        events = [
            {
                "event": "on_chat_model_stream",
                "data": {"chunk": chunk_mock},
            }
        ]
        _setup_mock_agent_stream(events)

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-session-1/messages",
                json={"content": "Hallo"},
            )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_stream_contains_text_delta_event(self, app):
        """AC-2 integration: Stream contains text-delta events with token content."""
        chunk_mock = MagicMock()
        chunk_mock.content = "token1"
        events = [
            {
                "event": "on_chat_model_stream",
                "data": {"chunk": chunk_mock},
            }
        ]
        _setup_mock_agent_stream(events)

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-delta/messages",
                json={"content": "Test"},
            )

        body = response.text
        assert "event: text-delta" in body
        # Check that the data contains content
        assert '"content"' in body
        assert "token1" in body

    @pytest.mark.asyncio
    async def test_stream_ends_with_text_done(self, app):
        """AC-3 integration: Stream ends with text-done event."""
        # No LLM events, agent completes immediately
        _setup_mock_agent_stream([])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-done/messages",
                json={"content": "Test"},
            )

        body = response.text
        assert "event: text-done" in body

    @pytest.mark.asyncio
    async def test_stream_contains_tool_call_result(self, app):
        """AC-4 integration: Stream contains tool-call-result event."""
        events = [
            {
                "event": "on_tool_end",
                "name": "draft_prompt",
                "data": {"output": {"prompt": "a sunset over mountains"}},
            }
        ]
        _setup_mock_agent_stream(events)

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-tool/messages",
                json={"content": "Draft me a prompt"},
            )

        body = response.text
        assert "event: tool-call-result" in body
        assert "draft_prompt" in body

    @pytest.mark.asyncio
    async def test_stream_sends_error_event_on_agent_failure(self, app):
        """AC-5 integration: Stream sends error event when agent fails."""
        _setup_mock_agent_error("LLM connection failed")

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/test-error/messages",
                json={"content": "Test"},
            )

        body = response.text
        assert "event: error" in body
        assert "Ein unerwarteter Fehler ist aufgetreten" in body


# ---------------------------------------------------------------------------
# AC-6, AC-7, AC-11: DTO Validation via HTTP
# ---------------------------------------------------------------------------


class TestDTOValidationViaHTTP:
    """Integration tests for DTO validation returning HTTP 422."""

    @pytest.mark.asyncio
    async def test_empty_content_returns_422(self, app):
        """AC-6 integration: Empty content returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/val-test/messages",
                json={"content": ""},
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_content_too_long_returns_422(self, app):
        """AC-6 integration: Content > 5000 chars returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/val-test/messages",
                json={"content": "x" * 5001},
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_image_url_returns_422(self, app):
        """AC-7 integration: Invalid image_url returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/val-test/messages",
                json={"content": "Test", "image_url": "not-a-url"},
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_model_returns_422(self, app):
        """AC-11 integration: Invalid model returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/val-test/messages",
                json={"content": "Test", "model": "invalid/model"},
            )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# AC-8, AC-9: Rate Limiting via HTTP
# ---------------------------------------------------------------------------


class TestRateLimitingViaHTTP:
    """Integration tests for rate limiting through the HTTP layer."""

    @pytest.mark.asyncio
    async def test_rate_limit_30_per_minute_returns_429(self, app):
        """AC-8 integration: After 30 messages/minute, server returns 429."""
        _setup_mock_agent_stream([])  # Minimal response for each request

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            session_id = "rate-limit-http-test"
            # Send 30 messages (should all succeed)
            for i in range(30):
                resp = await client.post(
                    f"/api/assistant/sessions/{session_id}/messages",
                    json={"content": f"msg {i}"},
                )
                assert resp.status_code == 200, (
                    f"Message {i} should succeed, got {resp.status_code}"
                )

            # 31st message should be rate limited
            resp = await client.post(
                f"/api/assistant/sessions/{session_id}/messages",
                json={"content": "one too many"},
            )
            assert resp.status_code == 429
            body = resp.json()
            assert "Zu viele Nachrichten" in body["detail"]

    @pytest.mark.asyncio
    async def test_session_limit_100_lifetime_returns_400(self, app):
        """AC-9 integration: After 100 lifetime messages, server returns 400."""
        import app.routes.messages as msg_module
        import app.services.assistant_service as svc_module

        # Use a rate limiter with high per-minute limit so we only hit lifetime
        high_limit = svc_module.RateLimiter(
            max_per_minute=200, max_per_session=100
        )
        svc_module.rate_limiter = high_limit
        msg_module.rate_limiter = high_limit
        _setup_mock_agent_stream([])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            session_id = "lifetime-limit-test"
            for i in range(100):
                resp = await client.post(
                    f"/api/assistant/sessions/{session_id}/messages",
                    json={"content": f"msg {i}"},
                )
                assert resp.status_code == 200, (
                    f"Message {i} should succeed, got {resp.status_code}"
                )

            # 101st message should be session-limited
            resp = await client.post(
                f"/api/assistant/sessions/{session_id}/messages",
                json={"content": "over the limit"},
            )
            assert resp.status_code == 400
            body = resp.json()
            assert "Session-Limit erreicht" in body["detail"]
