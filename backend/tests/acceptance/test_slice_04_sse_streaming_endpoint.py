"""Acceptance tests for Slice 04: SSE Streaming Endpoint.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-04-sse-streaming-endpoint.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent-Calls are mocked; all other components use real instances.
"""

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport

from app.models.dtos import ALLOWED_MODELS


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_service_and_rate_limiter():
    """Reset the module-level service and rate limiter for test isolation."""
    import app.routes.messages as msg_module
    import app.services.assistant_service as svc_module

    # Reset rate limiter in both modules (messages.py imports it directly)
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


def _setup_mock_stream(events):
    """Configure the mocked agent to yield given LangGraph events."""
    import app.routes.messages as msg_module

    async def fake_astream_events(input_state, config, version="v2"):
        for event in events:
            yield event

    msg_module._service._agent.astream_events = fake_astream_events


def _setup_mock_error(error_msg):
    """Configure the mocked agent to raise during streaming."""
    import app.routes.messages as msg_module

    async def failing_astream_events(input_state, config, version="v2"):
        raise RuntimeError(error_msg)
        yield  # pragma: no cover

    msg_module._service._agent.astream_events = failing_astream_events


# ---------------------------------------------------------------------------
# AC-1
# ---------------------------------------------------------------------------


class TestAC1SSEStreamResponse:
    """AC-1: GIVEN ein laufender FastAPI Server mit registriertem Messages-Router
    WHEN POST /api/assistant/sessions/{id}/messages mit Body {"content": "Hallo"}
    aufgerufen wird
    THEN antwortet der Server mit HTTP 200, Content-Type text/event-stream,
    und einem SSE-Stream
    """

    @pytest.mark.asyncio
    async def test_ac1_post_message_returns_sse_stream(self, app):
        """AC-1: POST with valid content returns HTTP 200 with text/event-stream."""
        chunk = MagicMock()
        chunk.content = "Hallo!"
        _setup_mock_stream([
            {"event": "on_chat_model_stream", "data": {"chunk": chunk}},
        ])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac1-test/messages",
                json={"content": "Hallo"},
            )

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}"
        )
        content_type = response.headers.get("content-type", "")
        assert "text/event-stream" in content_type, (
            f"Expected text/event-stream, got {content_type}"
        )
        # Body must contain SSE-formatted data
        assert "event:" in response.text or "data:" in response.text, (
            "Response body must contain SSE event data"
        )


# ---------------------------------------------------------------------------
# AC-2
# ---------------------------------------------------------------------------


class TestAC2TextDeltaEvents:
    """AC-2: GIVEN ein laufender SSE-Stream als Antwort auf eine gueltige Nachricht
    WHEN der LangGraph Agent Text-Tokens generiert
    THEN enthaelt der Stream mindestens ein Event mit event: text-delta
    und data: {"content": "<token>"} (JSON-String)
    """

    @pytest.mark.asyncio
    async def test_ac2_stream_contains_text_delta_events(self, app):
        """AC-2: Stream contains text-delta events with token content."""
        chunk = MagicMock()
        chunk.content = "Welt"
        _setup_mock_stream([
            {"event": "on_chat_model_stream", "data": {"chunk": chunk}},
        ])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac2-test/messages",
                json={"content": "Hallo"},
            )

        body = response.text
        assert "event: text-delta" in body, (
            "Stream must contain 'event: text-delta'"
        )
        # Parse the data line after text-delta
        lines = body.split("\n")
        found_content = False
        for i, line in enumerate(lines):
            if line.strip() == "event: text-delta":
                # Next non-empty line should be data
                for j in range(i + 1, min(i + 3, len(lines))):
                    if lines[j].startswith("data:"):
                        data_str = lines[j][len("data:"):].strip()
                        data = json.loads(data_str)
                        assert "content" in data, (
                            "text-delta data must contain 'content' key"
                        )
                        assert data["content"] == "Welt"
                        found_content = True
                        break
                break
        assert found_content, "Could not find text-delta data with content"


# ---------------------------------------------------------------------------
# AC-3
# ---------------------------------------------------------------------------


class TestAC3TextDoneEvent:
    """AC-3: GIVEN ein laufender SSE-Stream
    WHEN der Agent seine Antwort abgeschlossen hat
    THEN wird als letztes Event event: text-done mit data: {} gesendet
    """

    @pytest.mark.asyncio
    async def test_ac3_stream_ends_with_text_done(self, app):
        """AC-3: Stream ends with text-done event with empty data."""
        _setup_mock_stream([])  # Agent completes immediately

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac3-test/messages",
                json={"content": "Test"},
            )

        body = response.text
        assert "event: text-done" in body, (
            "Stream must contain 'event: text-done' as final event"
        )
        # Verify the data payload is {}
        lines = body.split("\n")
        for i, line in enumerate(lines):
            if line.strip() == "event: text-done":
                for j in range(i + 1, min(i + 3, len(lines))):
                    if lines[j].startswith("data:"):
                        data_str = lines[j][len("data:"):].strip()
                        data = json.loads(data_str)
                        assert data == {}, (
                            f"text-done data must be {{}}, got {data}"
                        )
                        break
                break


# ---------------------------------------------------------------------------
# AC-4
# ---------------------------------------------------------------------------


class TestAC4ToolCallResultEvent:
    """AC-4: GIVEN ein SSE-Stream waehrend dem der Agent ein Tool aufruft
    WHEN das Tool-Ergebnis vorliegt
    THEN wird ein Event event: tool-call-result mit
    data: {"tool": "<tool_name>", "data": <tool_output>} gesendet
    """

    @pytest.mark.asyncio
    async def test_ac4_stream_contains_tool_call_result(self, app):
        """AC-4: Stream contains tool-call-result event with tool name and output."""
        tool_output = {"prompt": "A majestic sunset over the Alps"}
        _setup_mock_stream([
            {
                "event": "on_tool_end",
                "name": "draft_prompt",
                "data": {"output": tool_output},
            },
        ])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac4-test/messages",
                json={"content": "Draft me a prompt about sunset"},
            )

        body = response.text
        assert "event: tool-call-result" in body, (
            "Stream must contain 'event: tool-call-result'"
        )
        lines = body.split("\n")
        for i, line in enumerate(lines):
            if line.strip() == "event: tool-call-result":
                for j in range(i + 1, min(i + 3, len(lines))):
                    if lines[j].startswith("data:"):
                        data_str = lines[j][len("data:"):].strip()
                        data = json.loads(data_str)
                        assert data["tool"] == "draft_prompt", (
                            f"tool must be 'draft_prompt', got {data.get('tool')}"
                        )
                        assert data["data"] == tool_output, (
                            f"data must be {tool_output}, got {data.get('data')}"
                        )
                        break
                break


# ---------------------------------------------------------------------------
# AC-5
# ---------------------------------------------------------------------------


class TestAC5ErrorEvent:
    """AC-5: GIVEN ein SSE-Stream bei dem ein Fehler im LangGraph Agent auftritt
    WHEN der Fehler abgefangen wird
    THEN wird ein Event event: error mit data: {"message": "<error_description>"}
    gesendet und der Stream geschlossen
    """

    @pytest.mark.asyncio
    async def test_ac5_stream_sends_error_event_on_agent_failure(self, app):
        """AC-5: Error event is sent when agent raises an exception."""
        _setup_mock_error("OpenRouter API timeout")

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac5-test/messages",
                json={"content": "Test"},
            )

        body = response.text
        assert "event: error" in body, (
            "Stream must contain 'event: error' on agent failure"
        )
        lines = body.split("\n")
        for i, line in enumerate(lines):
            if line.strip() == "event: error":
                for j in range(i + 1, min(i + 3, len(lines))):
                    if lines[j].startswith("data:"):
                        data_str = lines[j][len("data:"):].strip()
                        data = json.loads(data_str)
                        assert "message" in data, (
                            "error data must contain 'message' key"
                        )
                        assert "Die Anfrage an den KI-Dienst hat zu lange gedauert" in data["message"], (
                            f"error message must contain the German timeout message, "
                            f"got: {data['message']}"
                        )
                        break
                break


# ---------------------------------------------------------------------------
# AC-6
# ---------------------------------------------------------------------------


class TestAC6ContentValidation:
    """AC-6: GIVEN die SendMessageRequest DTO-Validierung
    WHEN POST /api/assistant/sessions/{id}/messages mit leerem content ("")
    oder content laenger als 5000 Zeichen aufgerufen wird
    THEN antwortet der Server mit HTTP 422 und einer Validierungs-Fehlermeldung
    """

    @pytest.mark.asyncio
    async def test_ac6_empty_content_returns_422(self, app):
        """AC-6: Empty content returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac6-test/messages",
                json={"content": ""},
            )

        assert response.status_code == 422, (
            f"Empty content must return 422, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac6_content_too_long_returns_422(self, app):
        """AC-6: Content > 5000 characters returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac6-test/messages",
                json={"content": "a" * 5001},
            )

        assert response.status_code == 422, (
            f"Content > 5000 chars must return 422, got {response.status_code}"
        )


# ---------------------------------------------------------------------------
# AC-7
# ---------------------------------------------------------------------------


class TestAC7ImageUrlValidation:
    """AC-7: GIVEN die SendMessageRequest DTO-Validierung
    WHEN POST /api/assistant/sessions/{id}/messages mit optionalem image_url
    aufgerufen wird das keine gueltige URL ist
    THEN antwortet der Server mit HTTP 422
    """

    @pytest.mark.asyncio
    async def test_ac7_invalid_image_url_returns_422(self, app):
        """AC-7: Invalid image_url returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac7-test/messages",
                json={"content": "Test", "image_url": "not-a-valid-url"},
            )

        assert response.status_code == 422, (
            f"Invalid image_url must return 422, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac7_valid_image_url_accepted(self, app):
        """AC-7 (positive): Valid image_url is accepted (no 422)."""
        _setup_mock_stream([])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac7-valid/messages",
                json={
                    "content": "Test",
                    "image_url": "https://example.com/photo.jpg",
                },
            )

        assert response.status_code == 200, (
            f"Valid image_url must return 200, got {response.status_code}"
        )


# ---------------------------------------------------------------------------
# AC-8
# ---------------------------------------------------------------------------


class TestAC8RateLimitPerMinute:
    """AC-8: GIVEN eine Session die bereits 30 Nachrichten innerhalb der
    letzten Minute empfangen hat
    WHEN eine weitere Nachricht gesendet wird
    THEN antwortet der Server mit HTTP 429 und
    {"detail": "Zu viele Nachrichten. Bitte warte einen Moment."}
    """

    @pytest.mark.asyncio
    async def test_ac8_rate_limit_30_per_minute(self, app):
        """AC-8: 31st message within one minute returns HTTP 429."""
        _setup_mock_stream([])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            session_id = "ac8-rate-test"
            # Send 30 messages (all should succeed)
            for i in range(30):
                resp = await client.post(
                    f"/api/assistant/sessions/{session_id}/messages",
                    json={"content": f"msg {i}"},
                )
                assert resp.status_code == 200, (
                    f"Message {i} should succeed, got {resp.status_code}"
                )

            # 31st message must be rate limited
            resp = await client.post(
                f"/api/assistant/sessions/{session_id}/messages",
                json={"content": "one too many"},
            )
            assert resp.status_code == 429, (
                f"31st message must return 429, got {resp.status_code}"
            )
            body = resp.json()
            assert body["detail"] == "Zu viele Nachrichten. Bitte warte einen Moment.", (
                f"Detail must match exactly, got: {body['detail']}"
            )


# ---------------------------------------------------------------------------
# AC-9
# ---------------------------------------------------------------------------


class TestAC9SessionLifetimeLimit:
    """AC-9: GIVEN eine Session mit genau 100 gesendeten Nachrichten (Lifetime)
    WHEN eine weitere Nachricht gesendet wird
    THEN antwortet der Server mit HTTP 400 und
    {"detail": "Session-Limit erreicht. Bitte starte eine neue Session."}
    """

    @pytest.mark.asyncio
    async def test_ac9_session_limit_100_lifetime(self, app):
        """AC-9: 101st lifetime message returns HTTP 400."""
        import app.routes.messages as msg_module
        import app.services.assistant_service as svc_module

        # Raise per-minute limit so we only hit lifetime limit
        high_limit = svc_module.RateLimiter(
            max_per_minute=200, max_per_session=100
        )
        svc_module.rate_limiter = high_limit
        msg_module.rate_limiter = high_limit
        _setup_mock_stream([])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            session_id = "ac9-lifetime-test"
            for i in range(100):
                resp = await client.post(
                    f"/api/assistant/sessions/{session_id}/messages",
                    json={"content": f"msg {i}"},
                )
                assert resp.status_code == 200, (
                    f"Message {i} should succeed, got {resp.status_code}"
                )

            # 101st message must be session-limited
            resp = await client.post(
                f"/api/assistant/sessions/{session_id}/messages",
                json={"content": "over the limit"},
            )
            assert resp.status_code == 400, (
                f"101st message must return 400, got {resp.status_code}"
            )
            body = resp.json()
            assert body["detail"] == "Session-Limit erreicht. Bitte starte eine neue Session.", (
                f"Detail must match exactly, got: {body['detail']}"
            )


# ---------------------------------------------------------------------------
# AC-10
# ---------------------------------------------------------------------------


class TestAC10AssistantServiceOrchestration:
    """AC-10: GIVEN die AssistantService
    WHEN stream_response(session_id, content, image_url, model) aufgerufen wird
    THEN orchestriert der Service: Message-Validierung, LangGraph astream_events()
    Aufruf mit config={"configurable": {"thread_id": session_id}},
    und Event-Konvertierung in SSE-Format
    """

    @pytest.mark.asyncio
    async def test_ac10_service_calls_astream_events_with_thread_id(self):
        """AC-10: AssistantService calls astream_events with correct thread_id config."""
        with patch("app.services.assistant_service.create_agent") as mock_create:
            mock_agent = MagicMock()
            mock_create.return_value = mock_agent

            from app.services.assistant_service import AssistantService

            service = AssistantService()

            # Track calls to astream_events
            captured_config = {}

            async def capture_astream_events(input_state, config, version="v2"):
                captured_config.update(config)
                return
                yield  # pragma: no cover

            mock_agent.astream_events = capture_astream_events

            # Consume the async generator
            events = []
            async for event in service.stream_response(
                session_id="test-session-42",
                content="Hello",
                image_url=None,
                model=None,
            ):
                events.append(event)

            # Verify astream_events was called with correct thread_id
            assert "configurable" in captured_config, (
                "astream_events must receive config with 'configurable' key"
            )
            assert captured_config["configurable"]["thread_id"] == "test-session-42", (
                f"thread_id must be 'test-session-42', got "
                f"{captured_config['configurable'].get('thread_id')}"
            )

            # Verify text-done event is yielded at the end
            assert any(e.get("event") == "text-done" for e in events), (
                "Service must yield text-done event at the end"
            )

    @pytest.mark.asyncio
    async def test_ac10_service_builds_human_message_with_image(self):
        """AC-10: AssistantService builds HumanMessage with image_url when provided."""
        with patch("app.services.assistant_service.create_agent") as mock_create:
            mock_agent = MagicMock()
            mock_create.return_value = mock_agent

            from app.services.assistant_service import AssistantService

            service = AssistantService()

            captured_input = {}

            async def capture_astream_events(input_state, config, version="v2"):
                captured_input.update(input_state)
                return
                yield  # pragma: no cover

            mock_agent.astream_events = capture_astream_events

            events = []
            async for event in service.stream_response(
                session_id="img-test",
                content="Analyze this",
                image_url="https://example.com/photo.jpg",
                model=None,
            ):
                events.append(event)

            # Verify message was constructed with image content
            messages = captured_input.get("messages", [])
            assert len(messages) == 1
            msg_content = messages[0].content
            assert isinstance(msg_content, list), (
                "Message with image_url must have list content (multimodal)"
            )
            assert any(
                item.get("type") == "text" and item.get("text") == "Analyze this"
                for item in msg_content
            )
            assert any(
                item.get("type") == "image_url"
                for item in msg_content
            )

    @pytest.mark.asyncio
    async def test_ac10_service_converts_events_to_sse_format(self):
        """AC-10: AssistantService converts LangGraph events to SSE format."""
        with patch("app.services.assistant_service.create_agent") as mock_create:
            mock_agent = MagicMock()
            mock_create.return_value = mock_agent

            from app.services.assistant_service import AssistantService

            service = AssistantService()

            chunk = MagicMock()
            chunk.content = "Hello"

            async def fake_astream_events(input_state, config, version="v2"):
                yield {"event": "on_chat_model_stream", "data": {"chunk": chunk}}

            mock_agent.astream_events = fake_astream_events

            events = []
            async for event in service.stream_response(
                session_id="convert-test",
                content="Hi",
            ):
                events.append(event)

            # Must have text-delta and text-done events
            event_types = [e["event"] for e in events]
            assert "text-delta" in event_types, (
                "Service must yield text-delta events"
            )
            assert "text-done" in event_types, (
                "Service must yield text-done as final event"
            )

            # text-delta must have JSON data with content
            text_delta = next(e for e in events if e["event"] == "text-delta")
            data = json.loads(text_delta["data"])
            assert data["content"] == "Hello"


# ---------------------------------------------------------------------------
# AC-11
# ---------------------------------------------------------------------------


class TestAC11ModelValidation:
    """AC-11: GIVEN die SendMessageRequest DTO
    WHEN das optionale model-Feld gesetzt wird mit einem Wert der nicht in
    ["anthropic/claude-sonnet-4.6", "openai/gpt-5.4",
    "google/gemini-3.1-pro-preview"] ist
    THEN antwortet der Server mit HTTP 422
    """

    @pytest.mark.asyncio
    async def test_ac11_invalid_model_returns_422(self, app):
        """AC-11: Invalid model value returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/sessions/ac11-test/messages",
                json={"content": "Test", "model": "meta/llama-4"},
            )

        assert response.status_code == 422, (
            f"Invalid model must return 422, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac11_valid_models_accepted(self, app):
        """AC-11 (positive): All allowed models are accepted."""
        _setup_mock_stream([])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            for model in ALLOWED_MODELS:
                response = await client.post(
                    f"/api/assistant/sessions/ac11-valid-{model.replace('/', '-')}/messages",
                    json={"content": "Test", "model": model},
                )
                assert response.status_code == 200, (
                    f"Model '{model}' must be accepted, got {response.status_code}"
                )


# ---------------------------------------------------------------------------
# AC-12
# ---------------------------------------------------------------------------


class TestAC12RouteAsAPIRouter:
    """AC-12: GIVEN die Messages-Route in backend/app/routes/messages.py
    WHEN das Modul inspiziert wird
    THEN ist die Route als APIRouter definiert und in main.py via include_router
    eingebunden
    """

    def test_ac12_messages_route_uses_api_router(self):
        """AC-12: Messages route must be an APIRouter included in main.py."""
        from fastapi import APIRouter

        from app.routes.messages import router

        assert isinstance(router, APIRouter), (
            f"messages.router must be an APIRouter, got {type(router).__name__}"
        )

    def test_ac12_router_included_in_main_app(self):
        """AC-12: Messages router must be registered in the main app."""
        from app.main import app

        route_paths = [route.path for route in app.routes]
        found = any(
            "/api/assistant/sessions/{session_id}/messages" in path
            for path in route_paths
        )
        assert found, (
            f"Messages route must be included via include_router in main.py. "
            f"Found routes: {route_paths}"
        )
