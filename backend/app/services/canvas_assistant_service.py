"""CanvasAssistantService for canvas image editing chat.

Handles message streaming for the canvas editing agent. Extends the same
SSE-streaming pattern as AssistantService, with additional handling for:
- image_context injection into the agent system prompt
- canvas-generate SSE event conversion (from generate_image tool calls)
- Rate limiting (30 msg/min, 100 msg/session lifetime)

SSE Event Protocol:
- text-delta: Each token of agent text response
- canvas-generate: Agent triggered generate_image tool (carries generation params)
- tool-call-result: After agent tool execution (raw result, for debugging)
- text-done: Agent response complete
- error: On error
"""

import json
import logging
import time
from collections import defaultdict
from typing import AsyncGenerator, Optional

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

from app.agent.canvas_graph import create_canvas_agent
from app.models.dtos import SessionResponse
from app.services.session_repository import SessionRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Rate Limiter (same limits as AssistantService)
# ---------------------------------------------------------------------------


class CanvasRateLimiter:
    """In-memory rate limiter for canvas sessions using sliding window.

    Tracks per-session message counts for:
    - Per-minute rate limiting (30 messages/minute) -> HTTP 429
    - Lifetime session limiting (100 messages total) -> HTTP 400
    """

    def __init__(
        self,
        max_per_minute: int = 30,
        max_per_session: int = 100,
    ):
        self.max_per_minute = max_per_minute
        self.max_per_session = max_per_session
        # session_id -> list of timestamps (floats)
        self._timestamps: dict[str, list[float]] = defaultdict(list)
        # session_id -> total message count
        self._totals: dict[str, int] = defaultdict(int)

    def check(self, session_id: str) -> Optional[dict]:
        """Check if a message is allowed for the given session.

        Returns None if allowed, or a dict with status_code and detail if rejected.
        """
        now = time.time()
        one_minute_ago = now - 60.0

        # Check lifetime limit first
        if self._totals[session_id] >= self.max_per_session:
            return {
                "status_code": 400,
                "detail": "Session-Limit erreicht. Bitte starte eine neue Session.",
            }

        # Sliding window: remove timestamps older than 1 minute
        self._timestamps[session_id] = [
            ts for ts in self._timestamps[session_id] if ts > one_minute_ago
        ]

        # Check per-minute limit
        if len(self._timestamps[session_id]) >= self.max_per_minute:
            return {
                "status_code": 429,
                "detail": "Zu viele Nachrichten. Bitte warte einen Moment.",
            }

        return None

    def record(self, session_id: str) -> None:
        """Record a message for the given session."""
        self._timestamps[session_id].append(time.time())
        self._totals[session_id] += 1


# Module-level singleton rate limiter for canvas sessions
canvas_rate_limiter = CanvasRateLimiter()


# ---------------------------------------------------------------------------
# Canvas Assistant Service
# ---------------------------------------------------------------------------


class CanvasAssistantService:
    """Service for orchestrating canvas image editing chat interactions.

    Manages:
    - Message validation and rate limiting
    - Canvas LangGraph agent creation with image_context injection
    - Conversion of LangGraph astream_events into SSE event format
    - canvas-generate event emission when generate_image tool is called

    The SSE event protocol emits:
    - text-delta: Each token of agent text response
    - canvas-generate: When generate_image tool is called (carries generation params)
    - tool-call-result: Raw tool result (for completeness/debugging)
    - text-done: Agent response complete
    - error: On error
    """

    def __init__(self):
        self._checkpointer = MemorySaver()
        self._repo = SessionRepository()
        # Compile the graph once at service initialization.
        # image_context is injected per-request via config["configurable"]["image_context"]
        # so the same compiled graph handles all concurrent requests safely.
        self._agent = create_canvas_agent(checkpointer=self._checkpointer)

    async def stream_response(
        self,
        session_id: str,
        content: str,
        image_context: Optional[dict] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream a response from the canvas LangGraph agent as SSE events.

        Orchestrates:
        1. Build HumanMessage with text content
        2. Create canvas agent with image_context injected into system prompt
        3. Invoke LangGraph astream_events() with thread config
        4. Convert events to SSE format, including canvas-generate for tool calls

        Args:
            session_id: The session/thread ID for LangGraph config.
            content: The user message text.
            image_context: Optional image context dict (image_url, prompt, model_id, etc.).
            model: Optional LLM model override (not used currently, reserved for future).

        Yields:
            Dicts with 'event' and 'data' keys for SSE formatting.
        """
        try:
            human_message = HumanMessage(content=content)

            # LangGraph config: thread_id for session persistence, image_context
            # injected at runtime so the compiled graph can be reused across requests.
            config = {
                "configurable": {
                    "thread_id": session_id,
                    "image_context": image_context,
                }
            }

            input_state = {
                "messages": [human_message],
                "image_context": image_context,
                "generate_params": None,
            }

            # Stream events from the cached LangGraph agent using v2 API
            async for event in self._agent.astream_events(
                input_state,
                config=config,
                version="v2",
            ):
                sse_event = self._convert_event(event)
                if sse_event is not None:
                    yield sse_event

            # Signal completion
            yield {"event": "text-done", "data": json.dumps({})}

        except TimeoutError:
            error_msg = (
                "Die Anfrage an den KI-Dienst hat zu lange gedauert. "
                "Bitte versuche es erneut."
            )
            logger.error(
                "LLM timeout in canvas stream_response for session %s",
                session_id,
                exc_info=True,
            )
            yield {
                "event": "error",
                "data": json.dumps({"message": error_msg}),
            }

        except ConnectionError:
            error_msg = (
                "Der KI-Dienst ist momentan nicht erreichbar. "
                "Bitte versuche es spaeter erneut."
            )
            logger.error(
                "LLM connection error in canvas stream_response for session %s",
                session_id,
                exc_info=True,
            )
            yield {
                "event": "error",
                "data": json.dumps({"message": error_msg}),
            }

        except Exception as e:
            error_msg = self._build_error_message(e)
            logger.error(
                "Error in canvas stream_response for session %s: %s",
                session_id,
                str(e),
                exc_info=True,
            )
            yield {
                "event": "error",
                "data": json.dumps({"message": error_msg}),
            }

    @staticmethod
    def _build_error_message(error: Exception) -> str:
        """Build a user-friendly error message from an exception."""
        error_str = str(error).lower()

        if "timeout" in error_str:
            return (
                "Die Anfrage an den KI-Dienst hat zu lange gedauert. "
                "Bitte versuche es erneut."
            )
        if "rate limit" in error_str or "429" in error_str:
            return (
                "Der KI-Dienst ist momentan ueberlastet. "
                "Bitte warte einen Moment und versuche es erneut."
            )
        if "401" in error_str or "unauthorized" in error_str:
            return "Authentifizierungsfehler beim KI-Dienst."
        if "500" in error_str or "internal server error" in error_str:
            return (
                "Der KI-Dienst hat einen internen Fehler gemeldet. "
                "Bitte versuche es erneut."
            )
        if "502" in error_str or "bad gateway" in error_str:
            return "Der KI-Dienst ist momentan nicht erreichbar."
        if "503" in error_str or "service unavailable" in error_str:
            return "Der KI-Dienst ist voruebergehend nicht verfuegbar."

        return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut."

    def _convert_event(self, event: dict) -> Optional[dict]:
        """Convert a LangGraph astream_events event to an SSE event dict.

        Handles:
        - on_chat_model_stream -> text-delta (token streaming)
        - on_tool_end with generate_image -> canvas-generate (generation trigger)
        - on_tool_end with other tools -> tool-call-result

        Returns None for events that should not be forwarded to the client.
        """
        kind = event.get("event")

        # Text token streaming from the chat model
        if kind == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                if isinstance(chunk.content, str) and chunk.content:
                    return {
                        "event": "text-delta",
                        "data": json.dumps({"content": chunk.content}),
                    }

        # Tool execution completed
        elif kind == "on_tool_end":
            tool_name = event.get("name", "unknown")
            tool_output = event.get("data", {}).get("output", {})

            # Extract content from LangChain message objects
            if hasattr(tool_output, "content"):
                tool_output = tool_output.content

            # Parse tool output if it's a string
            if isinstance(tool_output, str):
                try:
                    tool_output = json.loads(tool_output)
                except (json.JSONDecodeError, TypeError):
                    pass

            # Special handling for generate_image: emit canvas-generate event
            if tool_name == "generate_image" and isinstance(tool_output, dict):
                canvas_data = {
                    "action": tool_output.get("action", "variation"),
                    "prompt": tool_output.get("prompt", ""),
                    "model_id": tool_output.get("model_id", ""),
                    "params": tool_output.get("params", {}),
                }
                return {
                    "event": "canvas-generate",
                    "data": json.dumps(canvas_data),
                }

            # Generic tool result for all other tools
            return {
                "event": "tool-call-result",
                "data": json.dumps({"tool": tool_name, "data": tool_output}),
            }

        return None

    async def create_session(self, project_id) -> SessionResponse:
        """Create a new canvas session in the database.

        Args:
            project_id: UUID of the project.

        Returns:
            SessionResponse with the created session data.
        """
        session = await self._repo.create(project_id=project_id)
        return SessionResponse(**session)
