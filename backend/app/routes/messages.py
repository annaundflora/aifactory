"""Messages route for the Prompt Assistant API.

POST endpoint that accepts user messages, forwards them to the LangGraph agent,
and streams the response back as Server-Sent Events (SSE).
"""

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.models.dtos import SendMessageRequest
from app.services.assistant_service import AssistantService, rate_limiter

router = APIRouter()

# Module-level service instance
_service = AssistantService()


@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, request: SendMessageRequest):
    """Send a message to the assistant and stream the response as SSE.

    Accepts a user message, validates it, checks rate limits, then streams
    the LangGraph agent response as Server-Sent Events.

    SSE Event Types:
    - text-delta: Each token of agent text response
    - tool-call-result: After agent tool execution completes
    - text-done: Agent response complete
    - error: On error

    Args:
        session_id: The session UUID (used as LangGraph thread_id).
        request: The validated SendMessageRequest body.

    Returns:
        EventSourceResponse with SSE stream.

    Raises:
        HTTPException 400: Session lifetime limit reached (100 messages).
        HTTPException 422: Validation error (content, image_urls, model).
        HTTPException 429: Rate limit exceeded (30 messages/minute).
    """
    # Check rate limits
    limit_result = rate_limiter.check(session_id)
    if limit_result is not None:
        raise HTTPException(
            status_code=limit_result["status_code"],
            detail=limit_result["detail"],
        )

    # Record the message for rate limiting
    rate_limiter.record(session_id)

    # Convert image_urls to strings if present
    image_url_strs = (
        [str(u) for u in request.image_urls] if request.image_urls else None
    )

    async def event_generator():
        async for sse_event in _service.stream_response(
            session_id=session_id,
            content=request.content,
            image_urls=image_url_strs,
            model=request.model,
            image_model_id=request.image_model_id,
            generation_mode=request.generation_mode,
        ):
            yield {
                "event": sse_event["event"],
                "data": sse_event["data"],
            }

    return EventSourceResponse(event_generator())
