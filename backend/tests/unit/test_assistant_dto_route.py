"""Unit tests for Slice 07: Assistant DTO + Route + Service (image_model_id, generation_mode).

Tests the SendMessageRequest DTO extensions, the messages route field forwarding,
and the AssistantService config construction for the new image_model_id and
generation_mode fields.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent calls are mocked via monkeypatch; Pydantic validation and
service config construction use real instances.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from app.models.dtos import SendMessageRequest


# ---------------------------------------------------------------------------
# TestSendMessageRequestDTO -- AC-1 through AC-4 (DTO validation)
# ---------------------------------------------------------------------------


class TestSendMessageRequestDTO:
    """Tests for SendMessageRequest Pydantic model with new image fields."""

    def test_accepts_image_model_id_and_generation_mode(self):
        """AC-1: GIVEN a POST request body with image_model_id='flux-2-pro'
        and generation_mode='txt2img',
        WHEN the request is validated,
        THEN Pydantic accepts the body without error and
        request.image_model_id == 'flux-2-pro' and
        request.generation_mode == 'txt2img'.
        """
        req = SendMessageRequest(
            content="test",
            image_model_id="flux-2-pro",
            generation_mode="txt2img",
        )
        assert req.image_model_id == "flux-2-pro"
        assert req.generation_mode == "txt2img"
        # Existing fields must remain intact
        assert req.content == "test"

    def test_accepts_img2img_generation_mode(self):
        """AC-1 (supplement): generation_mode='img2img' is also a valid literal value."""
        req = SendMessageRequest(
            content="test",
            image_model_id="some-model",
            generation_mode="img2img",
        )
        assert req.generation_mode == "img2img"

    def test_backward_compat_without_new_fields(self):
        """AC-2: GIVEN a POST request body with only { "content": "test" }
        (without the new fields),
        WHEN the request is validated,
        THEN Pydantic accepts the body without error with
        request.image_model_id is None and request.generation_mode is None
        (backward compatibility).
        """
        req = SendMessageRequest(content="test")
        assert req.image_model_id is None
        assert req.generation_mode is None
        # Existing optional fields also default to None
        assert req.model is None
        assert req.image_urls is None

    def test_rejects_invalid_generation_mode(self):
        """AC-3: GIVEN a POST request body with generation_mode='inpaint'
        (invalid mode),
        WHEN the request is validated,
        THEN Pydantic raises a ValidationError because 'inpaint' is not
        an allowed Literal value (only 'txt2img' and 'img2img').
        """
        with pytest.raises(ValidationError) as exc_info:
            SendMessageRequest(content="test", generation_mode="inpaint")
        errors = exc_info.value.errors()
        assert len(errors) >= 1
        # The error must be on the generation_mode field
        assert any(
            "generation_mode" in str(e.get("loc", "")) for e in errors
        ), f"Expected validation error on generation_mode, got: {errors}"

    def test_rejects_other_invalid_generation_modes(self):
        """AC-3 (supplement): Other invalid generation_mode values are also rejected."""
        invalid_modes = ["edit", "upscale", "outpaint", "", "TXT2IMG", "Txt2Img"]
        for mode in invalid_modes:
            with pytest.raises(ValidationError):
                SendMessageRequest(content="test", generation_mode=mode)

    def test_rejects_image_model_id_over_max_length(self):
        """AC-4: GIVEN a POST request body with image_model_id of 201 characters,
        WHEN the request is validated,
        THEN Pydantic raises a ValidationError because max_length=200 is violated.
        """
        long_id = "x" * 201
        with pytest.raises(ValidationError) as exc_info:
            SendMessageRequest(content="test", image_model_id=long_id)
        errors = exc_info.value.errors()
        assert len(errors) >= 1
        # The error must be on the image_model_id field
        assert any(
            "image_model_id" in str(e.get("loc", "")) for e in errors
        ), f"Expected validation error on image_model_id, got: {errors}"

    def test_accepts_image_model_id_at_max_length(self):
        """AC-4 (boundary): image_model_id at exactly 200 characters must be accepted."""
        req = SendMessageRequest(content="test", image_model_id="x" * 200)
        assert len(req.image_model_id) == 200

    def test_accepts_image_model_id_alone_without_generation_mode(self):
        """Supplement: image_model_id can be provided without generation_mode."""
        req = SendMessageRequest(content="test", image_model_id="flux-2-pro")
        assert req.image_model_id == "flux-2-pro"
        assert req.generation_mode is None

    def test_accepts_generation_mode_alone_without_image_model_id(self):
        """Supplement: generation_mode can be provided without image_model_id."""
        req = SendMessageRequest(content="test", generation_mode="txt2img")
        assert req.generation_mode == "txt2img"
        assert req.image_model_id is None


# ---------------------------------------------------------------------------
# TestStreamResponseConfig -- AC-5 through AC-7 (Route + Service config)
# ---------------------------------------------------------------------------


class TestStreamResponseConfig:
    """Tests for route field forwarding and service config construction."""

    def _make_service(self):
        """Create an AssistantService with mocked LangGraph agent (mock_external)."""
        with patch("app.services.assistant_service.create_agent") as mock_create:
            mock_create.return_value = MagicMock()
            with patch("app.services.assistant_service.SessionRepository"):
                from app.services.assistant_service import AssistantService
                return AssistantService()

    def test_route_passes_new_fields_to_service(self):
        """AC-5: GIVEN a valid request with image_model_id='flux-2-pro'
        and generation_mode='txt2img',
        WHEN messages.py route calls _service.stream_response(),
        THEN image_model_id and generation_mode are passed as named parameters.

        Verified by inspecting the route source: the event_generator calls
        _service.stream_response with request.image_model_id and
        request.generation_mode.
        """
        from app.routes import messages as messages_module

        # Capture the arguments passed to stream_response
        captured_kwargs = {}
        original_service = messages_module._service

        mock_service = MagicMock()

        async def fake_stream_response(**kwargs):
            captured_kwargs.update(kwargs)
            return
            yield  # noqa: unreachable -- makes this an async generator

        mock_service.stream_response = fake_stream_response

        try:
            messages_module._service = mock_service

            import asyncio
            from fastapi.testclient import TestClient
            from app.main import app

            # We need to test the actual route invocation.
            # Since we patched the module-level _service, the route will use our mock.
            # But the app mounts the router at import time, so we need a different approach.
            # Instead, let's verify by constructing the request and calling the route handler.
            req = SendMessageRequest(
                content="test",
                image_model_id="flux-2-pro",
                generation_mode="txt2img",
            )

            # Call the route handler directly
            coro = messages_module.send_message(
                session_id="test-session-id",
                request=req,
            )
            # The route returns EventSourceResponse wrapping event_generator.
            # We need to get the response and iterate the generator to trigger the call.
            response = asyncio.get_event_loop().run_until_complete(coro)

            # The response body_iterator is the event_generator; iterate it to trigger
            # the stream_response call.
            async def drain():
                async for _ in response.body_iterator:
                    pass

            asyncio.get_event_loop().run_until_complete(drain())

            assert "image_model_id" in captured_kwargs, (
                f"image_model_id not passed to stream_response. Got: {captured_kwargs}"
            )
            assert captured_kwargs["image_model_id"] == "flux-2-pro"
            assert "generation_mode" in captured_kwargs
            assert captured_kwargs["generation_mode"] == "txt2img"

        finally:
            messages_module._service = original_service
            # Reset the rate limiter to avoid side effects
            from app.services.assistant_service import rate_limiter
            rate_limiter._timestamps.pop("test-session-id", None)
            rate_limiter._totals.pop("test-session-id", None)

    def test_config_contains_image_model_id_and_generation_mode(self):
        """AC-6: GIVEN stream_response is called with image_model_id='flux-2-pro'
        and generation_mode='txt2img',
        WHEN the LangGraph config is built,
        THEN config['configurable'] contains the keys
        'image_model_id': 'flux-2-pro' and 'generation_mode': 'txt2img'
        alongside the existing keys (thread_id, pending_image_urls, model).
        """
        service = self._make_service()

        # Capture the config passed to astream_events
        captured_config = {}

        async def fake_astream_events(input_state, *, config, version):
            captured_config.update(config)
            return
            yield  # noqa: unreachable -- makes this an async generator

        service._agent.astream_events = fake_astream_events

        import asyncio

        async def run():
            async for _ in service.stream_response(
                session_id="session-123",
                content="test",
                image_model_id="flux-2-pro",
                generation_mode="txt2img",
            ):
                pass

        asyncio.get_event_loop().run_until_complete(run())

        assert "configurable" in captured_config
        configurable = captured_config["configurable"]

        # New keys must be present with correct values
        assert configurable["image_model_id"] == "flux-2-pro"
        assert configurable["generation_mode"] == "txt2img"

        # Existing keys must also be present
        assert configurable["thread_id"] == "session-123"
        assert "pending_image_urls" in configurable
        assert "model" in configurable

    def test_config_contains_none_defaults_when_fields_missing(self):
        """AC-7: GIVEN stream_response is called without image_model_id
        and generation_mode (defaults to None),
        WHEN the LangGraph config is built,
        THEN config['configurable'] contains the keys
        'image_model_id': None and 'generation_mode': None
        (graph.py handles None correctly since Slice 06).
        """
        service = self._make_service()

        # Capture the config passed to astream_events
        captured_config = {}

        async def fake_astream_events(input_state, *, config, version):
            captured_config.update(config)
            return
            yield  # noqa: unreachable -- makes this an async generator

        service._agent.astream_events = fake_astream_events

        import asyncio

        async def run():
            async for _ in service.stream_response(
                session_id="session-456",
                content="test",
                # image_model_id and generation_mode not provided -> default None
            ):
                pass

        asyncio.get_event_loop().run_until_complete(run())

        assert "configurable" in captured_config
        configurable = captured_config["configurable"]

        # New keys must be present with None values
        assert "image_model_id" in configurable
        assert configurable["image_model_id"] is None
        assert "generation_mode" in configurable
        assert configurable["generation_mode"] is None

        # Existing keys must still be present
        assert configurable["thread_id"] == "session-456"
        assert "pending_image_urls" in configurable
        assert "model" in configurable
