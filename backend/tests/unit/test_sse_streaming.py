"""Unit tests for Slice 04: SSE Streaming Endpoint.

Tests the internal structure and logic of DTOs, RateLimiter, AssistantService,
and the messages route module.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent-Calls are mocked; all other components use real instances.
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import APIRouter
from pydantic import ValidationError

from app.models.dtos import ALLOWED_MODELS, SendMessageRequest
from app.services.assistant_service import RateLimiter


# ---------------------------------------------------------------------------
# SendMessageRequest DTO Validation
# ---------------------------------------------------------------------------


class TestSendMessageRequestDTO:
    """Unit tests for SendMessageRequest Pydantic model validation."""

    def test_valid_content_accepted(self):
        """Valid content between 1 and 5000 characters is accepted."""
        req = SendMessageRequest(content="Hallo")
        assert req.content == "Hallo"

    def test_empty_content_rejected(self):
        """Empty string content must raise ValidationError."""
        with pytest.raises(ValidationError):
            SendMessageRequest(content="")

    def test_content_too_long_rejected(self):
        """Content longer than 5000 characters must raise ValidationError."""
        with pytest.raises(ValidationError):
            SendMessageRequest(content="x" * 5001)

    def test_content_exactly_5000_accepted(self):
        """Content at exactly 5000 characters must be accepted."""
        req = SendMessageRequest(content="x" * 5000)
        assert len(req.content) == 5000

    def test_content_exactly_1_char_accepted(self):
        """Content with exactly 1 character must be accepted."""
        req = SendMessageRequest(content="a")
        assert req.content == "a"

    def test_valid_image_url_accepted(self):
        """A valid HTTP URL for image_url must be accepted."""
        req = SendMessageRequest(
            content="Test", image_url="https://example.com/image.png"
        )
        assert str(req.image_url) == "https://example.com/image.png"

    def test_invalid_image_url_rejected(self):
        """An invalid URL for image_url must raise ValidationError."""
        with pytest.raises(ValidationError):
            SendMessageRequest(content="Test", image_url="not-a-valid-url")

    def test_image_url_optional_defaults_none(self):
        """image_url is optional and defaults to None."""
        req = SendMessageRequest(content="Test")
        assert req.image_url is None

    def test_valid_model_accepted(self):
        """A valid model from the allowed list must be accepted."""
        for model in ALLOWED_MODELS:
            req = SendMessageRequest(content="Test", model=model)
            assert req.model == model

    def test_invalid_model_rejected(self):
        """A model not in the allowed list must raise ValidationError."""
        with pytest.raises(ValidationError):
            SendMessageRequest(content="Test", model="invalid/model-name")

    def test_model_optional_defaults_none(self):
        """model is optional and defaults to None."""
        req = SendMessageRequest(content="Test")
        assert req.model is None


# ---------------------------------------------------------------------------
# RateLimiter Logic
# ---------------------------------------------------------------------------


class TestRateLimiter:
    """Unit tests for the RateLimiter in-memory sliding window."""

    def test_first_message_allowed(self):
        """The first message for a new session must be allowed."""
        limiter = RateLimiter(max_per_minute=30, max_per_session=100)
        result = limiter.check("session-new")
        assert result is None

    def test_rate_limit_per_minute_exceeded(self):
        """After max_per_minute messages in one minute, next must be rejected with 429."""
        limiter = RateLimiter(max_per_minute=3, max_per_session=100)
        session_id = "rate-test"
        for _ in range(3):
            assert limiter.check(session_id) is None
            limiter.record(session_id)
        result = limiter.check(session_id)
        assert result is not None
        assert result["status_code"] == 429
        assert "Zu viele Nachrichten" in result["detail"]

    def test_session_lifetime_limit_exceeded(self):
        """After max_per_session total messages, next must be rejected with 400."""
        limiter = RateLimiter(max_per_minute=1000, max_per_session=5)
        session_id = "lifetime-test"
        for _ in range(5):
            assert limiter.check(session_id) is None
            limiter.record(session_id)
        result = limiter.check(session_id)
        assert result is not None
        assert result["status_code"] == 400
        assert "Session-Limit erreicht" in result["detail"]

    def test_lifetime_limit_takes_precedence_over_per_minute(self):
        """Lifetime limit (400) must be checked before per-minute limit (429)."""
        limiter = RateLimiter(max_per_minute=5, max_per_session=5)
        session_id = "precedence-test"
        for _ in range(5):
            limiter.record(session_id)
        result = limiter.check(session_id)
        assert result is not None
        assert result["status_code"] == 400

    def test_record_increments_total(self):
        """record() must increment the total count."""
        limiter = RateLimiter(max_per_minute=30, max_per_session=100)
        session_id = "count-test"
        assert limiter._totals[session_id] == 0
        limiter.record(session_id)
        assert limiter._totals[session_id] == 1

    def test_separate_sessions_independent(self):
        """Rate limits for different sessions must be independent."""
        limiter = RateLimiter(max_per_minute=2, max_per_session=100)
        for _ in range(2):
            limiter.record("session-a")
        # session-a is at the limit
        assert limiter.check("session-a") is not None
        # session-b is fresh
        assert limiter.check("session-b") is None


# ---------------------------------------------------------------------------
# AssistantService._convert_event
# ---------------------------------------------------------------------------


class TestConvertEvent:
    """Unit tests for AssistantService._convert_event method."""

    def _make_service(self):
        """Create an AssistantService with mocked agent."""
        with patch("app.services.assistant_service.create_agent") as mock_create:
            mock_create.return_value = MagicMock()
            from app.services.assistant_service import AssistantService
            return AssistantService()

    def test_text_delta_from_chat_model_stream(self):
        """on_chat_model_stream with string content must yield text-delta."""
        service = self._make_service()
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

    def test_tool_call_result_from_on_tool_end(self):
        """on_tool_end must yield tool-call-result event."""
        service = self._make_service()
        event = {
            "event": "on_tool_end",
            "name": "draft_prompt",
            "data": {"output": {"prompt": "a sunset"}},
        }
        result = service._convert_event(event)
        assert result is not None
        assert result["event"] == "tool-call-result"
        data = json.loads(result["data"])
        assert data["tool"] == "draft_prompt"
        assert data["data"] == {"prompt": "a sunset"}

    def test_irrelevant_event_returns_none(self):
        """Events not matching known types must return None."""
        service = self._make_service()
        event = {"event": "on_chain_start", "data": {}}
        result = service._convert_event(event)
        assert result is None

    def test_empty_content_chunk_returns_none(self):
        """on_chat_model_stream with empty content must return None."""
        service = self._make_service()
        chunk = MagicMock()
        chunk.content = ""
        event = {
            "event": "on_chat_model_stream",
            "data": {"chunk": chunk},
        }
        result = service._convert_event(event)
        assert result is None


# ---------------------------------------------------------------------------
# Messages Route Module Structure
# ---------------------------------------------------------------------------


class TestMessagesRouteModule:
    """Unit tests for the messages route module structure."""

    def test_messages_module_exports_router(self):
        """app.routes.messages must export a 'router' object."""
        from app.routes.messages import router
        assert router is not None

    def test_messages_router_is_api_router(self):
        """The messages router must be an instance of APIRouter."""
        from app.routes.messages import router
        assert isinstance(router, APIRouter), (
            f"router should be APIRouter, got {type(router).__name__}"
        )

    def test_messages_route_has_post_sessions_messages(self):
        """The messages router must have a POST /sessions/{session_id}/messages route."""
        from app.routes.messages import router

        found = False
        for route in router.routes:
            if hasattr(route, "path") and hasattr(route, "methods"):
                if "/sessions/{session_id}/messages" in route.path and "POST" in route.methods:
                    found = True
                    break
        assert found, (
            "Expected POST /sessions/{session_id}/messages route in messages router"
        )

    def test_messages_router_included_in_main_app(self):
        """The messages router must be included in main.py via include_router."""
        from app.main import app

        route_paths = [route.path for route in app.routes]
        found = any(
            "/api/assistant/sessions/{session_id}/messages" in path
            for path in route_paths
        )
        assert found, (
            f"Expected /api/assistant/sessions/{{session_id}}/messages in app routes, "
            f"found: {route_paths}"
        )
