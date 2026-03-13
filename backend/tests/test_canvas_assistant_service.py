"""Unit and integration tests for CanvasAssistantService (slice-16).

Tests the CanvasAssistantService and CanvasRateLimiter classes:
- SSE event streaming (text-delta, canvas-generate, text-done, error)
- Rate limiting (per-minute and lifetime)
- Error handling for LLM failures
- System prompt image context injection

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent astream_events is mocked; all other logic uses real instances.
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_canvas_service():
    """Create a CanvasAssistantService with mocked agent."""
    with patch(
        "app.services.canvas_assistant_service.create_canvas_agent"
    ) as mock_create:
        mock_agent = MagicMock()
        mock_create.return_value = mock_agent

        from app.services.canvas_assistant_service import CanvasAssistantService

        service = CanvasAssistantService()
    return service


# ---------------------------------------------------------------------------
# AC-2: SSE-Stream liefert text-delta und text-done Events
# ---------------------------------------------------------------------------


class TestStreamResponseTextEvents:
    """AC-2: GIVEN eine aktive Canvas-Session existiert
    WHEN POST /api/assistant/canvas/sessions/{id}/messages mit
    { "content": "Make the sky more blue", "image_context": {...} }
    THEN SSE-Stream liefert mindestens ein text-delta Event und ein text-done Event
    """

    @pytest.mark.asyncio
    async def test_ac2_stream_yields_text_delta_and_text_done(self):
        """AC-2: stream_response must yield text-delta and text-done events."""
        service = _make_canvas_service()

        chunk = MagicMock()
        chunk.content = "Ich werde den Himmel blauer machen"

        async def fake_astream_events(input_state, config, version="v2"):
            yield {
                "event": "on_chat_model_stream",
                "data": {"chunk": chunk},
            }

        service._agent.astream_events = fake_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-session-1",
            content="Make the sky more blue",
            image_context={
                "image_url": "https://example.com/img.png",
                "prompt": "A sunset",
                "model_id": "flux-2-max",
                "model_params": {},
            },
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "text-delta" in event_types, (
            f"Stream must contain 'text-delta' event, got: {event_types}"
        )
        assert "text-done" in event_types, (
            f"Stream must contain 'text-done' event, got: {event_types}"
        )

    @pytest.mark.asyncio
    async def test_ac2_text_delta_contains_content_key(self):
        """AC-2: text-delta event data must contain 'content' key with token text."""
        service = _make_canvas_service()

        chunk = MagicMock()
        chunk.content = "Blauer"

        async def fake_astream_events(input_state, config, version="v2"):
            yield {
                "event": "on_chat_model_stream",
                "data": {"chunk": chunk},
            }

        service._agent.astream_events = fake_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-session-2",
            content="Test",
        ):
            events.append(event)

        text_deltas = [e for e in events if e["event"] == "text-delta"]
        assert len(text_deltas) >= 1
        data = json.loads(text_deltas[0]["data"])
        assert "content" in data, "text-delta data must have 'content' key"
        assert data["content"] == "Blauer"

    @pytest.mark.asyncio
    async def test_ac2_text_done_has_empty_data(self):
        """AC-2: text-done event data must be empty dict {}."""
        service = _make_canvas_service()

        async def fake_astream_events(input_state, config, version="v2"):
            return
            yield  # pragma: no cover

        service._agent.astream_events = fake_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-session-3",
            content="Test",
        ):
            events.append(event)

        text_done = [e for e in events if e["event"] == "text-done"]
        assert len(text_done) == 1
        data = json.loads(text_done[0]["data"])
        assert data == {}, f"text-done data must be {{}}, got {data}"


# ---------------------------------------------------------------------------
# AC-3: canvas-generate Event bei Editing-Intent
# ---------------------------------------------------------------------------


class TestStreamResponseCanvasGenerateEvent:
    """AC-3: GIVEN der Agent erkennt einen Editing-Intent (z.B. "Mach den Himmel blauer")
    WHEN der Agent das generate_image Tool aufruft
    THEN SSE-Stream liefert ein canvas-generate Event mit
    { "action": "variation"|"img2img", "prompt": "<optimierter-prompt>",
      "model_id": "<string>", "params": {} }
    """

    @pytest.mark.asyncio
    async def test_ac3_canvas_generate_event_on_tool_call(self):
        """AC-3: stream_response yields canvas-generate event when generate_image tool ends."""
        service = _make_canvas_service()

        tool_output = MagicMock()
        tool_output.content = json.dumps({
            "action": "variation",
            "prompt": "A sunset with enhanced blue sky",
            "model_id": "flux-2-max",
            "params": {},
        })

        async def fake_astream_events(input_state, config, version="v2"):
            yield {
                "event": "on_tool_end",
                "name": "generate_image",
                "data": {"output": tool_output},
            }

        service._agent.astream_events = fake_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-ac3",
            content="Mach den Himmel blauer",
            image_context={
                "image_url": "https://example.com/img.png",
                "prompt": "A sunset",
                "model_id": "flux-2-max",
                "model_params": {},
            },
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "canvas-generate" in event_types, (
            f"Stream must contain 'canvas-generate' event, got: {event_types}"
        )

    @pytest.mark.asyncio
    async def test_ac3_canvas_generate_event_has_required_fields(self):
        """AC-3: canvas-generate event data must contain action, prompt, model_id, params."""
        service = _make_canvas_service()

        tool_output = MagicMock()
        tool_output.content = json.dumps({
            "action": "img2img",
            "prompt": "Dramatic sunset with vibrant colors",
            "model_id": "flux-1.1-pro",
            "params": {"strength": 0.8},
        })

        async def fake_astream_events(input_state, config, version="v2"):
            yield {
                "event": "on_tool_end",
                "name": "generate_image",
                "data": {"output": tool_output},
            }

        service._agent.astream_events = fake_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-ac3-fields",
            content="More dramatic",
        ):
            events.append(event)

        canvas_events = [e for e in events if e["event"] == "canvas-generate"]
        assert len(canvas_events) >= 1
        data = json.loads(canvas_events[0]["data"])
        assert "action" in data, "canvas-generate must have 'action' field"
        assert "prompt" in data, "canvas-generate must have 'prompt' field"
        assert "model_id" in data, "canvas-generate must have 'model_id' field"
        assert "params" in data, "canvas-generate must have 'params' field"
        assert data["action"] in ("variation", "img2img"), (
            f"action must be 'variation' or 'img2img', got: {data['action']}"
        )

    @pytest.mark.asyncio
    async def test_ac3_non_generate_tool_yields_tool_call_result(self):
        """AC-3: Non-generate_image tool ends yield 'tool-call-result', not 'canvas-generate'."""
        service = _make_canvas_service()

        async def fake_astream_events(input_state, config, version="v2"):
            yield {
                "event": "on_tool_end",
                "name": "some_other_tool",
                "data": {"output": {"result": "ok"}},
            }

        service._agent.astream_events = fake_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-ac3-other",
            content="Test",
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "canvas-generate" not in event_types, (
            "Non-generate_image tool must NOT yield canvas-generate"
        )
        assert "tool-call-result" in event_types, (
            "Non-generate_image tool must yield tool-call-result"
        )


# ---------------------------------------------------------------------------
# AC-4: Lifetime Limit (100 messages)
# ---------------------------------------------------------------------------


class TestCanvasRateLimiterLifetime:
    """AC-4: GIVEN eine Session hat 100 Nachrichten (Lifetime-Limit)
    WHEN POST .../messages mit neuem Content
    THEN response HTTP 400 mit Fehlermeldung (Session-Lifetime-Limit erreicht)
    """

    def test_ac4_lifetime_limit_reached_returns_400(self):
        """AC-4: After 100 messages, check() returns status_code 400."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=200, max_per_session=100)
        session_id = "lifetime-test"

        for _ in range(100):
            assert limiter.check(session_id) is None
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result is not None, (
            "check() must return rejection after 100 messages"
        )
        assert result["status_code"] == 400, (
            f"Lifetime limit must return 400, got: {result['status_code']}"
        )

    def test_ac4_lifetime_limit_detail_message(self):
        """AC-4: Lifetime limit rejection must contain German error message."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=200, max_per_session=100)
        session_id = "lifetime-detail"

        for _ in range(100):
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert "Session-Limit erreicht" in result["detail"], (
            f"Detail must mention 'Session-Limit erreicht', got: {result['detail']}"
        )

    def test_ac4_under_lifetime_limit_allowed(self):
        """AC-4: Messages under the lifetime limit must be allowed."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=200, max_per_session=100)
        session_id = "under-limit"

        for _ in range(99):
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result is None, "99 messages should still be allowed"


# ---------------------------------------------------------------------------
# AC-5: Rate Limit (30 msg/min)
# ---------------------------------------------------------------------------


class TestCanvasRateLimiterPerMinute:
    """AC-5: GIVEN eine Session empfaengt >30 Nachrichten in einer Minute
    WHEN POST .../messages mit neuem Content
    THEN response HTTP 429 (Rate-Limit ueberschritten)
    """

    def test_ac5_per_minute_limit_reached_returns_429(self):
        """AC-5: After 30 messages in one minute, check() returns status_code 429."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=30, max_per_session=1000)
        session_id = "rate-test"

        for _ in range(30):
            assert limiter.check(session_id) is None
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result is not None, (
            "check() must return rejection after 30 messages/minute"
        )
        assert result["status_code"] == 429, (
            f"Rate limit must return 429, got: {result['status_code']}"
        )

    def test_ac5_per_minute_limit_detail_message(self):
        """AC-5: Rate limit rejection must contain German error message."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=30, max_per_session=1000)
        session_id = "rate-detail"

        for _ in range(30):
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert "Zu viele Nachrichten" in result["detail"], (
            f"Detail must mention 'Zu viele Nachrichten', got: {result['detail']}"
        )

    def test_ac5_lifetime_limit_takes_precedence(self):
        """AC-5: Lifetime limit (400) takes precedence over per-minute limit (429)."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=5, max_per_session=5)
        session_id = "precedence-test"

        for _ in range(5):
            limiter.record(session_id)

        result = limiter.check(session_id)
        assert result["status_code"] == 400, (
            f"Lifetime limit must take precedence (400), got: {result['status_code']}"
        )

    def test_ac5_separate_sessions_independent(self):
        """AC-5: Rate limits for different sessions must be independent."""
        from app.services.canvas_assistant_service import CanvasRateLimiter

        limiter = CanvasRateLimiter(max_per_minute=2, max_per_session=1000)

        for _ in range(2):
            limiter.record("session-a")

        # session-a is at the limit
        assert limiter.check("session-a") is not None
        # session-b is fresh
        assert limiter.check("session-b") is None


# ---------------------------------------------------------------------------
# AC-7: Error Handling bei LLM-Fehler
# ---------------------------------------------------------------------------


class TestStreamResponseErrorHandling:
    """AC-7: GIVEN der LLM-API-Call schlaegt fehl (Timeout, 500)
    WHEN der Agent verarbeitet
    THEN SSE-Stream liefert ein error Event mit Fehlerbeschreibung, kein Crash
    """

    @pytest.mark.asyncio
    async def test_ac7_timeout_error_yields_error_event(self):
        """AC-7: TimeoutError yields error event with German timeout message."""
        service = _make_canvas_service()

        async def failing_astream_events(input_state, config, version="v2"):
            raise TimeoutError("Connection timed out")
            yield  # pragma: no cover

        service._agent.astream_events = failing_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-timeout",
            content="Test",
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "error" in event_types, (
            f"Timeout must yield 'error' event, got: {event_types}"
        )
        error_event = next(e for e in events if e["event"] == "error")
        data = json.loads(error_event["data"])
        assert "message" in data, "Error event data must contain 'message'"
        assert "zu lange gedauert" in data["message"], (
            f"Timeout message must mention 'zu lange gedauert', got: {data['message']}"
        )

    @pytest.mark.asyncio
    async def test_ac7_connection_error_yields_error_event(self):
        """AC-7: ConnectionError yields error event with German connection message."""
        service = _make_canvas_service()

        async def failing_astream_events(input_state, config, version="v2"):
            raise ConnectionError("Connection refused")
            yield  # pragma: no cover

        service._agent.astream_events = failing_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-connection-err",
            content="Test",
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "error" in event_types, (
            f"ConnectionError must yield 'error' event, got: {event_types}"
        )
        error_event = next(e for e in events if e["event"] == "error")
        data = json.loads(error_event["data"])
        assert "nicht erreichbar" in data["message"], (
            f"Connection error message must mention 'nicht erreichbar', "
            f"got: {data['message']}"
        )

    @pytest.mark.asyncio
    async def test_ac7_generic_error_yields_error_event(self):
        """AC-7: Generic exception yields error event, no crash."""
        service = _make_canvas_service()

        async def failing_astream_events(input_state, config, version="v2"):
            raise RuntimeError("Internal server error 500")
            yield  # pragma: no cover

        service._agent.astream_events = failing_astream_events

        events = []
        async for event in service.stream_response(
            session_id="test-generic-err",
            content="Test",
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "error" in event_types, (
            f"Generic error must yield 'error' event, got: {event_types}"
        )
        # Must not crash -- we got here, so no exception propagated

    @pytest.mark.asyncio
    async def test_ac7_error_event_no_crash(self):
        """AC-7: Error during streaming does not crash -- no unhandled exception."""
        service = _make_canvas_service()

        async def failing_astream_events(input_state, config, version="v2"):
            raise Exception("Unexpected failure")
            yield  # pragma: no cover

        service._agent.astream_events = failing_astream_events

        # This must complete without raising
        events = []
        async for event in service.stream_response(
            session_id="test-no-crash",
            content="Test",
        ):
            events.append(event)

        # Must have at least one error event
        assert any(e["event"] == "error" for e in events), (
            "Stream must yield error event on failure, not crash"
        )


# ---------------------------------------------------------------------------
# AC-9: System Prompt includes image context (service-level)
# ---------------------------------------------------------------------------


class TestServiceImageContextInjection:
    """AC-9: GIVEN POST .../messages mit image_context
    WHEN der Agent-System-Prompt erstellt wird
    THEN enthaelt der System-Prompt den Bild-Kontext (image_url, prompt, model_id)
    als Editing-Kontext
    """

    @pytest.mark.asyncio
    async def test_ac9_image_context_passed_to_agent_config(self):
        """AC-9: stream_response passes image_context in LangGraph config."""
        service = _make_canvas_service()

        captured_config = {}

        async def capture_astream_events(input_state, config, version="v2"):
            captured_config.update(config)
            return
            yield  # pragma: no cover

        service._agent.astream_events = capture_astream_events

        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": "A sunset",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        events = []
        async for event in service.stream_response(
            session_id="test-ac9-config",
            content="Make it bluer",
            image_context=image_context,
        ):
            events.append(event)

        assert "configurable" in captured_config, (
            "astream_events must receive config with 'configurable' key"
        )
        assert captured_config["configurable"]["image_context"] == image_context, (
            "Config must contain the image_context passed to stream_response"
        )

    @pytest.mark.asyncio
    async def test_ac9_thread_id_passed_as_session_id(self):
        """AC-9: stream_response passes session_id as thread_id in config."""
        service = _make_canvas_service()

        captured_config = {}

        async def capture_astream_events(input_state, config, version="v2"):
            captured_config.update(config)
            return
            yield  # pragma: no cover

        service._agent.astream_events = capture_astream_events

        events = []
        async for event in service.stream_response(
            session_id="my-session-42",
            content="Test",
        ):
            events.append(event)

        assert captured_config["configurable"]["thread_id"] == "my-session-42", (
            "thread_id must match the session_id passed to stream_response"
        )


# ---------------------------------------------------------------------------
# _convert_event Logic
# ---------------------------------------------------------------------------


class TestConvertEvent:
    """Tests for CanvasAssistantService._convert_event method."""

    def test_text_delta_from_chat_model_stream(self):
        """on_chat_model_stream with string content yields text-delta."""
        service = _make_canvas_service()
        chunk = MagicMock()
        chunk.content = "Hello"
        event = {
            "event": "on_chat_model_stream",
            "data": {"chunk": chunk},
        }
        result = service._convert_event(event)
        assert result is not None
        assert result["event"] == "text-delta"
        data = json.loads(result["data"])
        assert data["content"] == "Hello"

    def test_canvas_generate_from_generate_image_tool_end(self):
        """on_tool_end with name=generate_image yields canvas-generate."""
        service = _make_canvas_service()
        event = {
            "event": "on_tool_end",
            "name": "generate_image",
            "data": {
                "output": {
                    "action": "variation",
                    "prompt": "test",
                    "model_id": "flux-2-max",
                    "params": {},
                },
            },
        }
        result = service._convert_event(event)
        assert result is not None
        assert result["event"] == "canvas-generate"
        data = json.loads(result["data"])
        assert data["action"] == "variation"
        assert data["model_id"] == "flux-2-max"

    def test_tool_call_result_from_other_tool_end(self):
        """on_tool_end with other tool name yields tool-call-result."""
        service = _make_canvas_service()
        event = {
            "event": "on_tool_end",
            "name": "some_tool",
            "data": {"output": {"result": "ok"}},
        }
        result = service._convert_event(event)
        assert result is not None
        assert result["event"] == "tool-call-result"

    def test_irrelevant_event_returns_none(self):
        """Events not matching known types return None."""
        service = _make_canvas_service()
        event = {"event": "on_chain_start", "data": {}}
        result = service._convert_event(event)
        assert result is None

    def test_empty_content_chunk_returns_none(self):
        """on_chat_model_stream with empty content returns None."""
        service = _make_canvas_service()
        chunk = MagicMock()
        chunk.content = ""
        event = {
            "event": "on_chat_model_stream",
            "data": {"chunk": chunk},
        }
        result = service._convert_event(event)
        assert result is None


# ---------------------------------------------------------------------------
# _build_error_message Logic
# ---------------------------------------------------------------------------


class TestBuildErrorMessage:
    """Tests for CanvasAssistantService._build_error_message."""

    def test_timeout_error_message(self):
        """Timeout-related errors produce German timeout message."""
        from app.services.canvas_assistant_service import CanvasAssistantService

        msg = CanvasAssistantService._build_error_message(Exception("timeout occurred"))
        assert "zu lange gedauert" in msg

    def test_rate_limit_error_message(self):
        """Rate-limit errors produce German rate-limit message."""
        from app.services.canvas_assistant_service import CanvasAssistantService

        msg = CanvasAssistantService._build_error_message(Exception("429 rate limit exceeded"))
        assert "ueberlastet" in msg

    def test_unauthorized_error_message(self):
        """401 errors produce German auth message."""
        from app.services.canvas_assistant_service import CanvasAssistantService

        msg = CanvasAssistantService._build_error_message(Exception("401 unauthorized"))
        assert "Authentifizierungsfehler" in msg

    def test_500_error_message(self):
        """500 errors produce German internal error message."""
        from app.services.canvas_assistant_service import CanvasAssistantService

        msg = CanvasAssistantService._build_error_message(
            Exception("500 internal server error")
        )
        assert "internen Fehler" in msg

    def test_generic_error_message(self):
        """Unknown errors produce generic German message."""
        from app.services.canvas_assistant_service import CanvasAssistantService

        msg = CanvasAssistantService._build_error_message(Exception("something unknown"))
        assert "unerwarteter Fehler" in msg
