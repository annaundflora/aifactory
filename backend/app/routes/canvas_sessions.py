"""Canvas Sessions routes for the Canvas Editing Agent API.

Endpoints for canvas chat sessions:
- POST /canvas/sessions           -- Create a new canvas editing session
- POST /canvas/sessions/{id}/messages -- Send message to canvas agent (SSE stream)

These routes are registered under /api/assistant prefix in main.py,
making the full paths:
- POST /api/assistant/canvas/sessions
- POST /api/assistant/canvas/sessions/{id}/messages

The existing Next.js rewrite (/api/assistant/:path* -> FastAPI) covers these
routes without any configuration changes.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pydantic import HttpUrl
from sse_starlette.sse import EventSourceResponse
from typing import Optional

from app.models.dtos import SessionResponse
from app.services.canvas_assistant_service import (
    CanvasAssistantService,
    canvas_rate_limiter,
)

router = APIRouter()

# Module-level service instance
_service = CanvasAssistantService()


# ---------------------------------------------------------------------------
# DTOs (Canvas-specific, as specified in architecture.md)
# ---------------------------------------------------------------------------


class CanvasImageContext(BaseModel):
    """Image context for canvas editing sessions.

    Carries metadata about the currently displayed image so the agent
    can provide context-aware editing suggestions.

    Fields:
        image_url: URL of the current image.
        prompt: Original prompt used to generate the image.
        model_id: Model ID used for the current image (e.g., "flux-2-max").
        model_params: Additional model parameters as a dict.
        generation_id: UUID of the generation record.
    """

    image_url: HttpUrl = Field(..., description="URL of the current image")
    prompt: str = Field(..., description="Original prompt of the current image")
    model_id: str = Field(..., description="Model ID of the current image")
    model_params: dict = Field(default_factory=dict, description="Model parameters")
    generation_id: str = Field(..., description="UUID of the generation record")


class CreateCanvasSessionRequest(BaseModel):
    """DTO for POST /api/assistant/canvas/sessions.

    Creates a new canvas editing session linked to a project.
    The image_context carries the initial image metadata.

    Fields:
        project_id: UUID of the project this session belongs to.
        image_context: Initial image context for the canvas session.
    """

    project_id: UUID = Field(..., description="UUID of the project")
    image_context: CanvasImageContext = Field(
        ..., description="Initial image context for the canvas session"
    )


class CanvasSendMessageRequest(BaseModel):
    """DTO for POST /api/assistant/canvas/sessions/{id}/messages.

    Extends the standard message request with canvas-specific fields.

    Fields:
        content: The user message text (1-5000 characters).
        image_context: Current image context (updated on each message for context freshness).
        model: Optional LLM model override.
    """

    content: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User message content (1-5000 characters)",
    )
    image_context: CanvasImageContext = Field(
        ..., description="Current image context for the canvas agent"
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional LLM model override",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/canvas/sessions", response_model=SessionResponse, status_code=201)
async def create_canvas_session(request: CreateCanvasSessionRequest):
    """Create a new canvas editing session.

    Creates an assistant_sessions record linked to the given project_id.
    The image_context is used to initialize the session (stored in request,
    passed to agent on first message).

    AC-1: Returns HTTP 201 with SessionResponse (id, project_id, status=active).

    Args:
        request: CreateCanvasSessionRequest with project_id and image_context.

    Returns:
        SessionResponse with HTTP 201.
    """
    session = await _service.create_session(project_id=request.project_id)
    return session


@router.post("/canvas/sessions/{session_id}/messages")
async def send_canvas_message(session_id: UUID, request: CanvasSendMessageRequest):
    """Send a message to the canvas editing agent and stream the response as SSE.

    Validates the message, checks rate limits, then streams the canvas agent
    response as Server-Sent Events.

    SSE Event Types:
    - text-delta: Each token of agent text response
    - canvas-generate: Agent triggered image generation (carries action, prompt, model_id, params)
    - tool-call-result: After agent tool execution completes (raw)
    - text-done: Agent response complete
    - error: On error

    AC-2: SSE stream yields text-delta and text-done events.
    AC-3: SSE stream yields canvas-generate event when generate_image tool is called.
    AC-4: HTTP 400 when session lifetime limit (100 messages) is reached.
    AC-5: HTTP 429 when rate limit (30 msg/min) is exceeded.
    AC-6: HTTP 422 on validation errors (empty content, >5000 chars).
    AC-7: SSE error event on LLM failures, no crash.
    AC-9: Agent system prompt includes image_context (via CanvasAssistantService).

    Args:
        session_id: The session UUID (used as LangGraph thread_id). FastAPI
            validates UUID format automatically; 422 is returned on invalid input.
        request: The validated CanvasSendMessageRequest body.

    Returns:
        EventSourceResponse with SSE stream.

    Raises:
        HTTPException 400: Session lifetime limit reached (100 messages).
        HTTPException 422: Validation error (content length or invalid UUID).
        HTTPException 429: Rate limit exceeded (30 messages/minute).
    """
    # Convert UUID to str for internal use (rate limiter + LangGraph thread_id)
    session_id_str = str(session_id)

    # Check rate limits (AC-4, AC-5)
    limit_result = canvas_rate_limiter.check(session_id_str)
    if limit_result is not None:
        raise HTTPException(
            status_code=limit_result["status_code"],
            detail=limit_result["detail"],
        )

    # Record the message for rate limiting
    canvas_rate_limiter.record(session_id_str)

    # Convert image_context to dict for agent injection.
    # mode="json" ensures HttpUrl objects are serialized as plain strings.
    image_context_dict = request.image_context.model_dump(mode="json")

    async def event_generator():
        async for sse_event in _service.stream_response(
            session_id=session_id_str,
            content=request.content,
            image_context=image_context_dict,
            model=request.model,
        ):
            yield {
                "event": sse_event["event"],
                "data": sse_event["data"],
            }

    return EventSourceResponse(event_generator())
