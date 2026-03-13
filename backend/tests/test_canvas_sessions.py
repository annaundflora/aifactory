"""Acceptance and integration tests for Canvas Sessions Routes (slice-16).

Tests the canvas session API routes:
- POST /api/assistant/canvas/sessions (create session)
- POST /api/assistant/canvas/sessions/{id}/messages (send message, SSE)

These tests validate the full HTTP layer including DTO validation,
rate limiting, and SSE event streaming.

Mocking Strategy: mock_external (as specified in Slice-Spec).
- SessionRepository.create is mocked (requires real DB)
- LangGraph Agent astream_events is mocked (requires LLM API)
- All other components use real instances (routes, DTOs, rate limiter)
"""

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


VALID_IMAGE_CONTEXT = {
    "image_url": "https://example.com/img.png",
    "prompt": "A sunset over the ocean",
    "model_id": "flux-2-max",
    "model_params": {},
    "generation_id": str(uuid.uuid4()),
}


@pytest.fixture(autouse=True)
def reset_canvas_rate_limiter():
    """Reset the module-level canvas rate limiter for test isolation."""
    import app.routes.canvas_sessions as route_module
    import app.services.canvas_assistant_service as svc_module

    fresh_limiter = svc_module.CanvasRateLimiter()
    svc_module.canvas_rate_limiter = fresh_limiter
    route_module.canvas_rate_limiter = fresh_limiter

    yield

    fresh_limiter = svc_module.CanvasRateLimiter()
    svc_module.canvas_rate_limiter = fresh_limiter
    route_module.canvas_rate_limiter = fresh_limiter


@pytest.fixture
def mock_session_repo():
    """Mock the SessionRepository.create to avoid real DB calls."""
    session_id = uuid.uuid4()
    project_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    mock_session = {
        "id": session_id,
        "project_id": project_id,
        "title": None,
        "status": "active",
        "message_count": 0,
        "has_draft": False,
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }

    with patch(
        "app.services.canvas_assistant_service.SessionRepository"
    ) as MockRepo:
        mock_repo_instance = MagicMock()
        mock_repo_instance.create = AsyncMock(return_value=mock_session)
        MockRepo.return_value = mock_repo_instance
        yield mock_session


@pytest.fixture
def mock_canvas_service():
    """Reset the module-level service with mocked agent and repo."""
    import app.routes.canvas_sessions as route_module

    session_id = uuid.uuid4()
    project_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    mock_session = {
        "id": session_id,
        "project_id": project_id,
        "title": None,
        "status": "active",
        "message_count": 0,
        "has_draft": False,
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }

    with patch(
        "app.services.canvas_assistant_service.create_canvas_agent"
    ) as mock_create_agent, patch(
        "app.services.canvas_assistant_service.SessionRepository"
    ) as MockRepo:
        mock_agent = MagicMock()
        mock_create_agent.return_value = mock_agent

        mock_repo_instance = MagicMock()
        mock_repo_instance.create = AsyncMock(return_value=mock_session)
        MockRepo.return_value = mock_repo_instance

        from app.services.canvas_assistant_service import CanvasAssistantService

        service = CanvasAssistantService()
        route_module._service = service

        yield {
            "service": service,
            "agent": mock_agent,
            "session": mock_session,
        }


@pytest.fixture
def app():
    """Return the FastAPI app instance."""
    from app.main import app

    return app


def _setup_mock_stream(mock_canvas_service, events):
    """Configure the mocked agent to yield given LangGraph events."""
    async def fake_astream_events(input_state, config, version="v2"):
        for event in events:
            yield event

    mock_canvas_service["agent"].astream_events = fake_astream_events


def _setup_mock_error(mock_canvas_service, error):
    """Configure the mocked agent to raise during streaming."""
    async def failing_astream_events(input_state, config, version="v2"):
        raise error
        yield  # pragma: no cover

    mock_canvas_service["agent"].astream_events = failing_astream_events


# ---------------------------------------------------------------------------
# AC-1: Session erstellen
# ---------------------------------------------------------------------------


class TestAC1CreateCanvasSession:
    """AC-1: GIVEN kein Canvas-Session existiert
    WHEN POST /api/assistant/canvas/sessions mit
    { "project_id": "<valid-uuid>", "image_context": {...} }
    THEN response HTTP 201 mit
    { "id": "<uuid>", "project_id": "<uuid>", "status": "active" }
    (Schema wie SessionResponse)
    """

    @pytest.mark.asyncio
    async def test_ac1_create_session_returns_201(self, app, mock_canvas_service):
        """AC-1: POST /canvas/sessions returns HTTP 201 with SessionResponse."""
        project_id = str(mock_canvas_service["session"]["project_id"])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/canvas/sessions",
                json={
                    "project_id": project_id,
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 201, (
            f"Expected HTTP 201, got {response.status_code}: {response.text}"
        )

    @pytest.mark.asyncio
    async def test_ac1_response_has_session_fields(self, app, mock_canvas_service):
        """AC-1: Response body must contain id, project_id, status fields."""
        project_id = str(mock_canvas_service["session"]["project_id"])

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/canvas/sessions",
                json={
                    "project_id": project_id,
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        body = response.json()
        assert "id" in body, "Response must contain 'id' field"
        assert "project_id" in body, "Response must contain 'project_id' field"
        assert "status" in body, "Response must contain 'status' field"
        assert body["status"] == "active", (
            f"Status must be 'active', got: {body['status']}"
        )

    @pytest.mark.asyncio
    async def test_ac1_invalid_project_id_returns_422(self, app, mock_canvas_service):
        """AC-1: Invalid (non-UUID) project_id returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/canvas/sessions",
                json={
                    "project_id": "not-a-uuid",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 422, (
            f"Invalid project_id must return 422, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac1_missing_image_context_returns_422(self, app, mock_canvas_service):
        """AC-1: Missing image_context field returns HTTP 422."""
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/assistant/canvas/sessions",
                json={
                    "project_id": str(uuid.uuid4()),
                },
            )

        assert response.status_code == 422, (
            f"Missing image_context must return 422, got {response.status_code}"
        )


# ---------------------------------------------------------------------------
# AC-2: SSE Stream with text-delta and text-done
# ---------------------------------------------------------------------------


class TestAC2SSEStreamEvents:
    """AC-2: GIVEN eine aktive Canvas-Session existiert
    WHEN POST /api/assistant/canvas/sessions/{id}/messages mit
    { "content": "Make the sky more blue", "image_context": {...} }
    THEN SSE-Stream liefert mindestens ein text-delta Event und ein text-done Event
    """

    @pytest.mark.asyncio
    async def test_ac2_sse_stream_contains_text_delta(
        self, app, mock_canvas_service
    ):
        """AC-2: SSE stream must contain text-delta event."""
        chunk = MagicMock()
        chunk.content = "Ich mache den Himmel blauer"
        _setup_mock_stream(mock_canvas_service, [
            {"event": "on_chat_model_stream", "data": {"chunk": chunk}},
        ])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "Make the sky more blue",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}"
        )
        assert "event: text-delta" in response.text, (
            "SSE stream must contain 'event: text-delta'"
        )

    @pytest.mark.asyncio
    async def test_ac2_sse_stream_contains_text_done(
        self, app, mock_canvas_service
    ):
        """AC-2: SSE stream must contain text-done event."""
        _setup_mock_stream(mock_canvas_service, [])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "Hello",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert "event: text-done" in response.text, (
            "SSE stream must contain 'event: text-done'"
        )

    @pytest.mark.asyncio
    async def test_ac2_response_content_type_is_event_stream(
        self, app, mock_canvas_service
    ):
        """AC-2: Response Content-Type must be text/event-stream."""
        _setup_mock_stream(mock_canvas_service, [])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "Test",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        content_type = response.headers.get("content-type", "")
        assert "text/event-stream" in content_type, (
            f"Expected text/event-stream, got {content_type}"
        )


# ---------------------------------------------------------------------------
# AC-3: canvas-generate Event
# ---------------------------------------------------------------------------


class TestAC3CanvasGenerateEvent:
    """AC-3: GIVEN der Agent erkennt einen Editing-Intent
    WHEN der Agent das generate_image Tool aufruft
    THEN SSE-Stream liefert ein canvas-generate Event mit
    { "action": "variation"|"img2img", "prompt": ..., "model_id": ..., "params": {} }
    """

    @pytest.mark.asyncio
    async def test_ac3_canvas_generate_in_sse_stream(
        self, app, mock_canvas_service
    ):
        """AC-3: SSE stream contains canvas-generate event on generate_image tool call."""
        tool_output = MagicMock()
        tool_output.content = json.dumps({
            "action": "variation",
            "prompt": "A sunset with enhanced blue sky",
            "model_id": "flux-2-max",
            "params": {},
        })

        _setup_mock_stream(mock_canvas_service, [
            {
                "event": "on_tool_end",
                "name": "generate_image",
                "data": {"output": tool_output},
            },
        ])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "Mach den Himmel blauer",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert "event: canvas-generate" in response.text, (
            "SSE stream must contain 'event: canvas-generate'"
        )

        # Parse the canvas-generate data
        lines = response.text.split("\n")
        for i, line in enumerate(lines):
            if line.strip() == "event: canvas-generate":
                for j in range(i + 1, min(i + 3, len(lines))):
                    if lines[j].startswith("data:"):
                        data_str = lines[j][len("data:"):].strip()
                        data = json.loads(data_str)
                        assert "action" in data
                        assert "prompt" in data
                        assert "model_id" in data
                        assert "params" in data
                        assert data["action"] in ("variation", "img2img")
                        break
                break


# ---------------------------------------------------------------------------
# AC-4: Lifetime Limit via HTTP
# ---------------------------------------------------------------------------


class TestAC4LifetimeLimitHTTP:
    """AC-4: GIVEN eine Session hat 100 Nachrichten (Lifetime-Limit)
    WHEN POST .../messages mit neuem Content
    THEN response HTTP 400 mit Fehlermeldung
    """

    @pytest.mark.asyncio
    async def test_ac4_lifetime_limit_returns_400(
        self, app, mock_canvas_service
    ):
        """AC-4: 101st message returns HTTP 400."""
        import app.routes.canvas_sessions as route_module
        import app.services.canvas_assistant_service as svc_module

        # Use a limiter with high per-minute but low lifetime
        limiter = svc_module.CanvasRateLimiter(
            max_per_minute=200, max_per_session=100
        )
        svc_module.canvas_rate_limiter = limiter
        route_module.canvas_rate_limiter = limiter

        _setup_mock_stream(mock_canvas_service, [])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            # Send 100 messages (all should succeed)
            for i in range(100):
                resp = await client.post(
                    f"/api/assistant/canvas/sessions/{session_id}/messages",
                    json={
                        "content": f"msg {i}",
                        "image_context": VALID_IMAGE_CONTEXT,
                    },
                )
                assert resp.status_code == 200, (
                    f"Message {i} should succeed, got {resp.status_code}"
                )

            # 101st message must be rejected
            resp = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "over the limit",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert resp.status_code == 400, (
            f"101st message must return 400, got {resp.status_code}"
        )
        body = resp.json()
        assert "Session-Limit erreicht" in body["detail"], (
            f"Detail must mention 'Session-Limit erreicht', got: {body['detail']}"
        )


# ---------------------------------------------------------------------------
# AC-5: Rate Limit via HTTP
# ---------------------------------------------------------------------------


class TestAC5RateLimitHTTP:
    """AC-5: GIVEN eine Session empfaengt >30 Nachrichten in einer Minute
    WHEN POST .../messages mit neuem Content
    THEN response HTTP 429 (Rate-Limit ueberschritten)
    """

    @pytest.mark.asyncio
    async def test_ac5_rate_limit_returns_429(
        self, app, mock_canvas_service
    ):
        """AC-5: 31st message within one minute returns HTTP 429."""
        _setup_mock_stream(mock_canvas_service, [])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            # Send 30 messages
            for i in range(30):
                resp = await client.post(
                    f"/api/assistant/canvas/sessions/{session_id}/messages",
                    json={
                        "content": f"msg {i}",
                        "image_context": VALID_IMAGE_CONTEXT,
                    },
                )
                assert resp.status_code == 200, (
                    f"Message {i} should succeed, got {resp.status_code}"
                )

            # 31st message
            resp = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "one too many",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert resp.status_code == 429, (
            f"31st message must return 429, got {resp.status_code}"
        )
        body = resp.json()
        assert "Zu viele Nachrichten" in body["detail"], (
            f"Detail must mention 'Zu viele Nachrichten', got: {body['detail']}"
        )


# ---------------------------------------------------------------------------
# AC-6: Validierungsfehler
# ---------------------------------------------------------------------------


class TestAC6ValidationErrors:
    """AC-6: GIVEN POST .../messages mit leerem content (oder >5000 Zeichen)
    WHEN die Validierung laeuft
    THEN response HTTP 422 (Pydantic-Validierungsfehler)
    """

    @pytest.mark.asyncio
    async def test_ac6_empty_content_returns_422(
        self, app, mock_canvas_service
    ):
        """AC-6: Empty content returns HTTP 422."""
        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 422, (
            f"Empty content must return 422, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac6_content_over_5000_chars_returns_422(
        self, app, mock_canvas_service
    ):
        """AC-6: Content longer than 5000 characters returns HTTP 422."""
        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "x" * 5001,
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 422, (
            f"Content > 5000 chars must return 422, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac6_exactly_5000_chars_accepted(
        self, app, mock_canvas_service
    ):
        """AC-6: Content at exactly 5000 characters is accepted (boundary)."""
        _setup_mock_stream(mock_canvas_service, [])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "x" * 5000,
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 200, (
            f"Exactly 5000 chars must be accepted, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_ac6_exactly_1_char_accepted(
        self, app, mock_canvas_service
    ):
        """AC-6: Content with exactly 1 character is accepted (boundary)."""
        _setup_mock_stream(mock_canvas_service, [])

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "a",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        assert response.status_code == 200, (
            f"1-char content must be accepted, got {response.status_code}"
        )

    def test_ac6_dto_validation_empty_content(self):
        """AC-6: CanvasSendMessageRequest rejects empty content."""
        from app.routes.canvas_sessions import CanvasSendMessageRequest

        with pytest.raises(ValidationError):
            CanvasSendMessageRequest(
                content="",
                image_context=VALID_IMAGE_CONTEXT,
            )

    def test_ac6_dto_validation_content_too_long(self):
        """AC-6: CanvasSendMessageRequest rejects content > 5000 chars."""
        from app.routes.canvas_sessions import CanvasSendMessageRequest

        with pytest.raises(ValidationError):
            CanvasSendMessageRequest(
                content="x" * 5001,
                image_context=VALID_IMAGE_CONTEXT,
            )


# ---------------------------------------------------------------------------
# AC-7: Error Event via HTTP
# ---------------------------------------------------------------------------


class TestAC7ErrorEventHTTP:
    """AC-7: GIVEN der LLM-API-Call schlaegt fehl (Timeout, 500)
    WHEN der Agent verarbeitet
    THEN SSE-Stream liefert ein error Event mit Fehlerbeschreibung, kein Crash
    """

    @pytest.mark.asyncio
    async def test_ac7_llm_failure_yields_error_event(
        self, app, mock_canvas_service
    ):
        """AC-7: LLM failure yields error event in SSE stream."""
        _setup_mock_error(
            mock_canvas_service,
            RuntimeError("OpenRouter 500 internal server error"),
        )

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "Test",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        # Must not crash (status 200 for SSE stream start)
        assert response.status_code == 200, (
            f"SSE response must start with 200, got {response.status_code}"
        )
        assert "event: error" in response.text, (
            "SSE stream must contain 'event: error' on LLM failure"
        )

        # Parse error data
        lines = response.text.split("\n")
        for i, line in enumerate(lines):
            if line.strip() == "event: error":
                for j in range(i + 1, min(i + 3, len(lines))):
                    if lines[j].startswith("data:"):
                        data_str = lines[j][len("data:"):].strip()
                        data = json.loads(data_str)
                        assert "message" in data, (
                            "Error data must contain 'message' key"
                        )
                        break
                break


# ---------------------------------------------------------------------------
# AC-8: Route Module Structure
# ---------------------------------------------------------------------------


class TestAC8RouteModuleStructure:
    """AC-8: Additional structural tests for canvas_sessions route module."""

    def test_canvas_sessions_module_exports_router(self):
        """canvas_sessions module must export a router."""
        from app.routes.canvas_sessions import router

        assert router is not None

    def test_canvas_sessions_router_is_api_router(self):
        """The canvas_sessions router must be an APIRouter."""
        from fastapi import APIRouter

        from app.routes.canvas_sessions import router

        assert isinstance(router, APIRouter)

    def test_canvas_sessions_router_has_post_sessions(self):
        """Router must have POST /canvas/sessions route."""
        from app.routes.canvas_sessions import router

        found = False
        for route in router.routes:
            if (
                hasattr(route, "path")
                and hasattr(route, "methods")
                and "/canvas/sessions" in route.path
                and "POST" in route.methods
                and "{session_id}" not in route.path
            ):
                found = True
                break
        assert found, (
            "Expected POST /canvas/sessions route in canvas_sessions router"
        )

    def test_canvas_sessions_router_has_post_messages(self):
        """Router must have POST /canvas/sessions/{session_id}/messages route."""
        from app.routes.canvas_sessions import router

        found = False
        for route in router.routes:
            if (
                hasattr(route, "path")
                and hasattr(route, "methods")
                and "{session_id}" in route.path
                and "messages" in route.path
                and "POST" in route.methods
            ):
                found = True
                break
        assert found, (
            "Expected POST /canvas/sessions/{session_id}/messages route"
        )

    def test_canvas_router_included_in_main_app(self):
        """Canvas sessions router must be included in main.py."""
        from app.main import app

        route_paths = [route.path for route in app.routes]
        found = any(
            "/api/assistant/canvas/sessions" in path for path in route_paths
        )
        assert found, (
            f"Canvas sessions route must be included in main app. "
            f"Found routes: {route_paths}"
        )


# ---------------------------------------------------------------------------
# AC-9: Image Context in System Prompt (route-level)
# ---------------------------------------------------------------------------


class TestAC9ImageContextRouteLevel:
    """AC-9: GIVEN POST .../messages mit image_context
    WHEN der Agent-System-Prompt erstellt wird
    THEN enthaelt der System-Prompt den Bild-Kontext als Editing-Kontext
    """

    @pytest.mark.asyncio
    async def test_ac9_image_context_forwarded_to_service(
        self, app, mock_canvas_service
    ):
        """AC-9: image_context from request is forwarded to service stream_response."""
        captured_config = {}

        async def capture_astream_events(input_state, config, version="v2"):
            captured_config.update(config)
            return
            yield  # pragma: no cover

        mock_canvas_service["agent"].astream_events = capture_astream_events

        session_id = str(uuid.uuid4())
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                f"/api/assistant/canvas/sessions/{session_id}/messages",
                json={
                    "content": "Make it more blue",
                    "image_context": VALID_IMAGE_CONTEXT,
                },
            )

        # The image_context must reach the agent via config
        assert "configurable" in captured_config, (
            "Agent config must contain 'configurable'"
        )
        agent_image_ctx = captured_config["configurable"]["image_context"]
        assert agent_image_ctx is not None, (
            "image_context must be passed to the agent"
        )
        assert agent_image_ctx["model_id"] == "flux-2-max", (
            f"image_context model_id must be 'flux-2-max', got: {agent_image_ctx.get('model_id')}"
        )
        assert "example.com" in str(agent_image_ctx["image_url"]), (
            "image_context image_url must contain 'example.com'"
        )


# ---------------------------------------------------------------------------
# DTO Tests
# ---------------------------------------------------------------------------


class TestCanvasImageContextDTO:
    """Tests for CanvasImageContext Pydantic model."""

    def test_valid_image_context(self):
        """Valid CanvasImageContext is accepted."""
        from app.routes.canvas_sessions import CanvasImageContext

        ctx = CanvasImageContext(
            image_url="https://example.com/img.png",
            prompt="A sunset",
            model_id="flux-2-max",
            model_params={},
            generation_id=str(uuid.uuid4()),
        )
        assert ctx.model_id == "flux-2-max"

    def test_invalid_image_url_rejected(self):
        """CanvasImageContext rejects invalid image_url."""
        from app.routes.canvas_sessions import CanvasImageContext

        with pytest.raises(ValidationError):
            CanvasImageContext(
                image_url="not-a-url",
                prompt="A sunset",
                model_id="flux-2-max",
                model_params={},
                generation_id=str(uuid.uuid4()),
            )


class TestCreateCanvasSessionRequestDTO:
    """Tests for CreateCanvasSessionRequest Pydantic model."""

    def test_valid_request(self):
        """Valid CreateCanvasSessionRequest is accepted."""
        from app.routes.canvas_sessions import CreateCanvasSessionRequest

        req = CreateCanvasSessionRequest(
            project_id=uuid.uuid4(),
            image_context=VALID_IMAGE_CONTEXT,
        )
        assert req.project_id is not None

    def test_missing_project_id_rejected(self):
        """CreateCanvasSessionRequest rejects missing project_id."""
        from app.routes.canvas_sessions import CreateCanvasSessionRequest

        with pytest.raises(ValidationError):
            CreateCanvasSessionRequest(
                image_context=VALID_IMAGE_CONTEXT,
            )
