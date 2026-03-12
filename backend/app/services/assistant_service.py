"""AssistantService for orchestrating LangGraph agent interactions.

Handles message validation, rate limiting, LangGraph agent invocation via
astream_events(), and conversion of agent events into SSE-formatted events.

Error handling strategy (Slice 22):
- LLM API errors (OpenRouter timeout, 500) -> SSE error event + ERROR log
- Stream interruptions -> SSE error event + ERROR log
- All exceptions in stream_response are caught, logged, and converted to SSE error events
"""

import json
import logging
import time
from collections import defaultdict
from typing import AsyncGenerator, Optional

from langchain_core.messages import AIMessage, HumanMessage

from langgraph.checkpoint.memory import MemorySaver

from app.agent.graph import create_agent
from app.config import settings
from app.models.dtos import (
    DraftPromptDTO,
    MessageDTO,
    ModelRecDTO,
    SessionDetailResponse,
    SessionResponse,
    SessionStateDTO,
)
from app.services.session_repository import SessionRepository

logger = logging.getLogger(__name__)


class RateLimiter:
    """In-memory rate limiter using sliding window.

    Tracks per-session message counts for:
    - Per-minute rate limiting (30 messages/minute)
    - Lifetime session limiting (100 messages total)

    This is a transitional solution; DB-backed tracking comes with slice-13a.
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


# Module-level singleton rate limiter
rate_limiter = RateLimiter()


class AssistantService:
    """Service for orchestrating assistant chat interactions.

    Manages:
    - Message validation and rate limiting
    - LangGraph agent creation and invocation
    - Conversion of LangGraph astream_events into SSE event format

    The SSE event protocol emits:
    - text-delta: Each token of agent text response
    - tool-call-result: After agent tool execution completes
    - text-done: Agent response complete
    - error: On error
    """

    def __init__(self):
        self._agent = create_agent(checkpointer=MemorySaver())
        self._repo = SessionRepository()

    async def stream_response(
        self,
        session_id: str,
        content: str,
        image_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream a response from the LangGraph agent as SSE events.

        Orchestrates:
        1. Rate limiting check (done by caller in route)
        2. Build HumanMessage with optional image
        3. Invoke LangGraph astream_events() with thread config
        4. Convert events to SSE format (text-delta, tool-call-result, text-done, error)

        Args:
            session_id: The session/thread ID for LangGraph config.
            content: The user message text.
            image_url: Optional reference image URL.
            model: Optional LLM model override slug.

        Yields:
            Dicts with 'event' and 'data' keys for SSE formatting.
        """
        try:
            # Build the human message
            message_content: list | str
            if image_url:
                message_content = [
                    {"type": "text", "text": content},
                    {"type": "image_url", "image_url": {"url": str(image_url)}},
                ]
            else:
                message_content = content

            human_message = HumanMessage(content=message_content)

            # LangGraph config with thread_id for session persistence
            config = {"configurable": {"thread_id": session_id}}

            # If a model override is specified, we could pass it via config
            # For now, the agent uses the default model from settings.
            # Model override support will be enhanced in later slices.

            input_state = {"messages": [human_message]}

            # Stream events from LangGraph using v2 API
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
            # AC-8: LLM timeout (e.g. OpenRouter timeout)
            error_msg = (
                "Die Anfrage an den KI-Dienst hat zu lange gedauert. "
                "Bitte versuche es erneut."
            )
            logger.error(
                "LLM timeout in stream_response for session %s",
                session_id,
                exc_info=True,
            )
            yield {
                "event": "error",
                "data": json.dumps({"message": error_msg}),
            }

        except ConnectionError:
            # AC-8: LLM API connection error (backend unreachable, network issue)
            error_msg = (
                "Der KI-Dienst ist momentan nicht erreichbar. "
                "Bitte versuche es spaeter erneut."
            )
            logger.error(
                "LLM connection error in stream_response for session %s",
                session_id,
                exc_info=True,
            )
            yield {
                "event": "error",
                "data": json.dumps({"message": error_msg}),
            }

        except Exception as e:
            # AC-8: Catch-all for LLM API errors (OpenRouter 500, etc.)
            error_msg = self._build_error_message(e)
            logger.error(
                "Error in stream_response for session %s: %s",
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
        """Build a user-friendly error message from an exception.

        Maps common LLM API errors to German-language descriptions.
        Falls back to a generic message for unknown errors.
        """
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

        # Generic fallback
        return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut."

    def _convert_event(self, event: dict) -> Optional[dict]:
        """Convert a LangGraph astream_events event to an SSE event dict.

        Handles:
        - on_chat_model_stream -> text-delta (token streaming)
        - on_tool_end -> tool-call-result (tool execution results)

        Returns None for events that should not be forwarded to the client.
        """
        kind = event.get("event")

        # Text token streaming from the chat model
        if kind == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                # Only forward string content (not tool call chunks)
                if isinstance(chunk.content, str) and chunk.content:
                    return {
                        "event": "text-delta",
                        "data": json.dumps({"content": chunk.content}),
                    }

        # Tool execution completed
        elif kind == "on_tool_end":
            tool_name = event.get("name", "unknown")
            tool_output = event.get("data", {}).get("output", {})

            # Extract content from LangChain message objects (e.g. ToolMessage)
            if hasattr(tool_output, "content"):
                tool_output = tool_output.content

            # Try to parse the tool output if it's a string
            if isinstance(tool_output, str):
                try:
                    tool_output = json.loads(tool_output)
                except (json.JSONDecodeError, TypeError):
                    pass

            return {
                "event": "tool-call-result",
                "data": json.dumps({"tool": tool_name, "data": tool_output}),
            }

        return None

    async def get_session_state(self, session_id: str) -> Optional[SessionDetailResponse]:
        """Get the full session state from the LangGraph checkpointer.

        Reads the session metadata from the database and the conversation state
        from the LangGraph checkpoint via the compiled graph's get_state method.

        AC-1: Returns session metadata and state with messages.
        AC-2: Returns draft_prompt from state if present.
        AC-3: Returns None if session not found (caller raises 404).
        AC-12: Reads LangGraph checkpoint via thread_id config.

        Args:
            session_id: The session UUID (used as LangGraph thread_id).

        Returns:
            SessionDetailResponse with session metadata and full state,
            or None if the session is not found.
        """
        from uuid import UUID

        # Get session metadata from DB
        session_data = await self._repo.get_by_id(session_id=UUID(session_id))
        if session_data is None:
            return None

        session = SessionResponse(**session_data)

        # Read the LangGraph checkpoint state via the compiled graph
        config = {"configurable": {"thread_id": session_id}}

        messages: list[MessageDTO] = []
        draft_prompt: Optional[DraftPromptDTO] = None
        recommended_model: Optional[ModelRecDTO] = None

        try:
            state_snapshot = await self._agent.aget_state(config)

            if state_snapshot and state_snapshot.values:
                state_values = state_snapshot.values

                # Convert LangChain BaseMessage objects to MessageDTO
                raw_messages = state_values.get("messages", [])
                for msg in raw_messages:
                    if isinstance(msg, HumanMessage):
                        # Extract text content from multimodal messages
                        content = msg.content
                        if isinstance(content, list):
                            # Multimodal message: extract text parts
                            text_parts = [
                                p.get("text", "") if isinstance(p, dict) else str(p)
                                for p in content
                                if isinstance(p, dict) and p.get("type") == "text"
                                or isinstance(p, str)
                            ]
                            content = " ".join(text_parts)
                        messages.append(
                            MessageDTO(role="human", content=str(content))
                        )
                    elif isinstance(msg, AIMessage):
                        # Skip tool-call-only messages (no visible text)
                        content = msg.content
                        if isinstance(content, str) and content.strip():
                            messages.append(
                                MessageDTO(role="assistant", content=content)
                            )

                # Extract draft_prompt from state
                raw_draft = state_values.get("draft_prompt")
                if raw_draft and isinstance(raw_draft, dict):
                    draft_prompt = DraftPromptDTO(
                        motiv=raw_draft.get("motiv", ""),
                        style=raw_draft.get("style", ""),
                        negative_prompt=raw_draft.get("negative_prompt", ""),
                    )

                # Extract recommended_model from state
                raw_model = state_values.get("recommended_model")
                if raw_model and isinstance(raw_model, dict):
                    recommended_model = ModelRecDTO(
                        id=raw_model.get("id", ""),
                        name=raw_model.get("name", ""),
                        reason=raw_model.get("reason", ""),
                    )

        except Exception:
            # If the checkpoint cannot be read (e.g., no checkpoint exists),
            # return session metadata with empty state.
            logger.warning(
                "Could not read checkpoint for session %s, returning empty state",
                session_id,
                exc_info=True,
            )

        state = SessionStateDTO(
            messages=messages,
            draft_prompt=draft_prompt,
            recommended_model=recommended_model,
        )

        return SessionDetailResponse(session=session, state=state)
