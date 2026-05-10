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
from uuid import UUID

from langchain_core.messages import AIMessage, HumanMessage
from pydantic import ValidationError

from langgraph.checkpoint.memory import MemorySaver

from app.agent.graph import create_agent
from app.agent.tools.prompt_tools import SettingsDiff
from app.config import settings
from app.models.dtos import (
    DraftPromptDTO,
    IntentAxes,
    IntentSummaryPayload,
    MessageDTO,
    ModelRecDTO,
    SessionDetailResponse,
    SessionResponse,
    SessionStateDTO,
)
from app.services.project_repository import ProjectRepository
from app.services.session_repository import SessionRepository

# Slice 15: whitelist of FSM ``flow_state`` values the backend may emit via
# the SSE ``flow-state`` event. Mirrors architecture.md → "Data Transfer
# Objects" → ``FlowStateEvent`` (the ``"generating"`` transition is
# frontend-only — set on the user click in the IntentSummaryCard, not via
# backend round-trip). The ``"idle"`` initial value is included for
# completeness even though it is the default — no transition into ``"idle"``
# happens during a normal stream.
_FLOW_STATE_WHITELIST: frozenset[str] = frozenset(
    {"idle", "interviewing", "summarizing", "reviewing", "refining"}
)

# Slice 15: name of the tool whose ``tool-call-result`` triggers the
# additional ``intent-summary`` SSE event. Kept as a module-level constant so
# tests can target it without coupling to the LangGraph tool-registry
# import path.
_EMIT_INTENT_SUMMARY_TOOL_NAME: str = "emit_intent_summary"

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

    def __init__(
        self,
        project_repo: Optional[ProjectRepository] = None,
    ):
        self._agent = create_agent(checkpointer=MemorySaver())
        self._repo = SessionRepository()
        # Slice 11: read-only repository for per-project assistant context.
        # Injected for testability (AsyncMock in unit tests).
        self._project_repo = project_repo or ProjectRepository()

    async def stream_response(
        self,
        session_id: str,
        content: str,
        image_urls: Optional[list[str]] = None,
        model: Optional[str] = None,
        image_model_id: Optional[str] = None,
        generation_mode: Optional[str] = None,
        project_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream a response from the LangGraph agent as SSE events.

        Orchestrates:
        1. Rate limiting check (done by caller in route)
        2. Build HumanMessage with optional images
        3. Slice 11: Hydrate per-project assistant context (if `project_id` +
           `user_id` are provided) and stamp it into `configurable`.
        4. Invoke LangGraph astream_events() with thread config
        5. Convert events to SSE format (text-delta, tool-call-result, text-done, error)

        Args:
            session_id: The session/thread ID for LangGraph config.
            content: The user message text.
            image_urls: Optional list of reference image URLs.
            model: Optional LLM model override slug.
            image_model_id: Optional image generation model ID for knowledge injection.
            generation_mode: Optional generation mode ('txt2img' or 'img2img').
            project_id: Optional UUID of the project this turn belongs to.
                When provided together with `user_id`, the per-project context
                (`projects.context_instructions`) is loaded once per turn and
                forwarded to the LangGraph nodes via `configurable`. When
                missing, no repository call is made and `configurable
                ["project_context"]` is set to `None` (no block injected) —
                this preserves backward-compatibility for callers that have
                not yet been wired up to pass `project_id` (e.g. older tests
                or pre-Slice-19 routes that lack `project_id` in the DTO).
            user_id: Optional UUID of the authenticated user. Used together
                with `project_id` for the ownership-checked context lookup.

        Yields:
            Dicts with 'event' and 'data' keys for SSE formatting.
        """
        try:
            # Build the human message
            message_content: list | str
            if image_urls:
                message_content = [{"type": "text", "text": content}]
                for url in image_urls:
                    message_content.append(
                        {"type": "image_url", "image_url": {"url": url}}
                    )
            else:
                message_content = content

            human_message = HumanMessage(content=message_content)

            # Slice 11: Load the per-project assistant context (raw, not
            # escaped — escape happens centrally in `prompts.py` so the
            # transformation lives next to the consumer).
            #
            # Contract:
            # - Both `project_id` AND `user_id` present  -> exactly 1 call
            #   to `ProjectRepository.get_context` per `stream_response`
            #   invocation; first tuple element propagates as-is (None
            #   passes through unchanged when context_instructions IS NULL).
            # - Either parameter missing                 -> no repository
            #   call; `configurable["project_context"]` is set to None.
            project_context: Optional[str] = None
            if project_id is not None and user_id is not None:
                context_value, _owner_id = await self._project_repo.get_context(
                    project_id, user_id
                )
                project_context = context_value
                # Logging contract (Slice 5 AC-6 + Slice 11 Constraints):
                # Boolean / length markers only -- NEVER plaintext context.
                logger.debug(
                    "AssistantService.stream_response: project_context loaded",
                    extra={
                        "session_id": session_id,
                        "has_project_context": project_context is not None,
                        "context_length": (
                            len(project_context)
                            if project_context is not None
                            else 0
                        ),
                    },
                )

            # LangGraph config with thread_id for session persistence.
            # Pass the actual image URLs so analyze_image uses the correct R2 URLs
            # instead of whatever URLs the LLM hallucinates.
            config = {
                "configurable": {
                    "thread_id": session_id,
                    "pending_image_urls": image_urls or [],
                    "model": model,
                    "image_model_id": image_model_id,
                    "generation_mode": generation_mode,
                    # Slice 11: forwarded into _call_model_sync/_call_model_async
                    # in `graph.py`, which passes it as the third argument to
                    # `build_assistant_system_prompt`.
                    "project_context": project_context,
                }
            }

            input_state = {"messages": [human_message]}

            # Slice 15: track the last ``flow_state`` value emitted on this
            # stream so we can dedup repeats. ``None`` means "nothing emitted
            # yet"; the first observed transition (typically idle ->
            # interviewing or idle -> summarizing) emits a single
            # ``flow-state`` event.
            last_emitted_flow_state: Optional[str] = None

            # Stream events from LangGraph using v2 API
            async for event in self._agent.astream_events(
                input_state,
                config=config,
                version="v2",
            ):
                sse_event = self._convert_event(event)
                if sse_event is not None:
                    yield sse_event

                    # Slice 15 AC-2: when the just-yielded event is a
                    # ``tool-call-result`` for ``emit_intent_summary``, build
                    # the ``IntentSummaryPayload`` and emit the
                    # ``intent-summary`` event right after the tool result.
                    # The trailing ``flow-state`` event is emitted further
                    # down via the ``on_chain_end`` / state-snapshot path.
                    if (
                        sse_event.get("event") == "tool-call-result"
                        and event.get("event") == "on_tool_end"
                        and event.get("name") == _EMIT_INTENT_SUMMARY_TOOL_NAME
                    ):
                        try:
                            intent_event = await self._build_intent_summary_event(
                                event, config
                            )
                        except ValidationError as exc:
                            # AC-4: malformed payload (e.g. axis > 200 chars)
                            # propagates as an SSE ``error`` event; the
                            # ``intent-summary`` event is suppressed and the
                            # stream terminates cleanly.
                            logger.warning(
                                "intent-summary payload validation failed for "
                                "session %s: %s",
                                session_id,
                                exc,
                            )
                            yield {
                                "event": "error",
                                "data": json.dumps(
                                    {
                                        "message": (
                                            "Intent-Summary konnte nicht "
                                            "erstellt werden."
                                        )
                                    }
                                ),
                            }
                            return
                        if intent_event is not None:
                            yield intent_event

                # Slice 15 AC-1 / AC-2 trailer: detect ``flow_state``
                # transitions emitted by the ``post_process`` node. The node
                # returns its state-update dict in ``event.data.output`` for
                # the ``on_chain_end`` event. Dedup against the last value
                # emitted on this stream so unchanged values produce no event.
                flow_state_value = self._extract_flow_state_transition(event)
                if (
                    flow_state_value is not None
                    and flow_state_value != last_emitted_flow_state
                    and flow_state_value in _FLOW_STATE_WHITELIST
                ):
                    last_emitted_flow_state = flow_state_value
                    yield {
                        "event": "flow-state",
                        "data": json.dumps({"flow_state": flow_state_value}),
                    }

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

    # Set of LangGraph node names whose ``on_chain_end`` events may carry a
    # ``flow_state`` state update. Currently only ``post_process`` mutates
    # ``flow_state`` (via ``TOOL_FLOW_STATE_MAPPING``); ``assistant`` is
    # included so future slices that advance the FSM during the LLM turn
    # (e.g. idle -> interviewing on first user-content message) propagate
    # without further changes here. Other chain ends (LLM streams, tool
    # input/output runnables) are filtered out so a stray ``flow_state``
    # key in their output dict cannot leak into the SSE wire.
    _FLOW_STATE_EMITTING_NODES: frozenset[str] = frozenset(
        {"post_process", "assistant", "tools"}
    )

    @staticmethod
    def _extract_flow_state_transition(event: dict) -> Optional[str]:
        """Return ``flow_state`` value from a LangGraph ``on_chain_end`` event.

        Slice 15: any graph node may surface a ``flow_state`` state update
        in its returned dict — the post_process node is the only one wired
        today (via ``TOOL_FLOW_STATE_MAPPING`` in ``app.agent.graph``), but
        the detector is intentionally wider than that single name so future
        slices (e.g. an assistant-node hook for ``idle → interviewing``)
        propagate without further changes. ``astream_events`` v2 surfaces
        node returns as ``event["event"] == "on_chain_end"`` with the
        update dict in ``event["data"]["output"]``.

        Returns the new ``flow_state`` value if the event is a node
        chain-end carrying one; otherwise ``None``.
        """
        if event.get("event") != "on_chain_end":
            return None

        # Filter by node name so spurious ``flow_state`` keys in unrelated
        # chains (LLM streams, tool input/output runnables, etc.) cannot
        # leak into the SSE wire.
        node_name = event.get("name")
        if node_name not in AssistantService._FLOW_STATE_EMITTING_NODES:
            return None

        output = event.get("data", {}).get("output")
        if not isinstance(output, dict):
            return None

        flow_state = output.get("flow_state")
        if isinstance(flow_state, str) and flow_state:
            return flow_state
        return None

    async def _build_intent_summary_event(
        self,
        tool_event: dict,
        config: dict,
    ) -> Optional[dict]:
        """Build an SSE ``intent-summary`` event from an ``emit_intent_summary``
        ``on_tool_end`` event.

        Slice 15 AC-2 / AC-3 / AC-4:
        * ``axes`` is read from the LangGraph state's ``intent_axes`` field
          via ``aget_state``; it is funnelled through :class:`IntentAxes` so
          per-axis length validation (≤ 200 chars) propagates as a Pydantic
          ``ValidationError`` to the caller (which converts it to an SSE
          ``error`` event).
        * ``prompt_preview`` is the ``prompt`` field of the validated tool
          input (from the ``on_tool_end`` event's ``input``/``output``).
        * ``settings_diff`` is read from the tool input/output. When the
          tool emits no settings changes, or the resulting dict is empty
          after ``model_dump(exclude_none=True)``, the field is omitted from
          the JSON entirely (not serialised as ``null``) — matches the
          Wireframe ``no_settings_diff`` state.

        Returns:
            SSE event dict ``{"event": "intent-summary", "data": <json>}``,
            or ``None`` if the tool input could not be located (defensive —
            prevents emitting a half-built payload).

        Raises:
            ValidationError: when any axis exceeds the 200-char cap or when
                ``prompt_preview`` violates the 1..2000 constraint. The
                caller is responsible for converting this into an SSE
                ``error`` event.
        """
        # Source the validated tool input. ``astream_events`` v2 carries the
        # arguments under ``data.input``; LangGraph's ToolNode also echoes
        # them into ``data.output`` via the tool body. We prefer ``input``
        # because that is the canonical schema-validated payload — the
        # output is a free-form dict echo from the tool body.
        data = tool_event.get("data", {}) or {}
        tool_input = data.get("input")
        if isinstance(tool_input, dict) and "input" in tool_input:
            # langgraph wraps tool args in {"input": <args_dict>}
            tool_input = tool_input.get("input")
        if not isinstance(tool_input, dict):
            tool_input = data.get("output")
            if hasattr(tool_input, "content"):
                tool_input = tool_input.content
            if isinstance(tool_input, str):
                try:
                    tool_input = json.loads(tool_input)
                except (json.JSONDecodeError, TypeError):
                    tool_input = None
        if not isinstance(tool_input, dict):
            return None

        prompt_preview: Optional[str] = tool_input.get("prompt")
        if not isinstance(prompt_preview, str):
            return None

        settings_diff_raw = tool_input.get("settings_diff")

        # Read the typed ``intent_axes`` from the current graph state. We
        # call ``aget_state`` rather than peeking at the on_tool_end event
        # because the post_process node has not yet committed its updates
        # at this point — but ``intent_axes`` is established earlier in the
        # graph (e.g. by the LLM via state writes during the interview).
        # When no checkpointer is wired, ``aget_state`` raises; we fall
        # back to an empty axes container in that case.
        intent_axes_raw: dict = {}
        try:
            state_snapshot = await self._agent.aget_state(config)
            if state_snapshot and getattr(state_snapshot, "values", None):
                intent_axes_raw = state_snapshot.values.get("intent_axes") or {}
                if not isinstance(intent_axes_raw, dict):
                    intent_axes_raw = {}
        except Exception:
            # Defensive: if state can't be read, ship empty axes. We log at
            # debug so production traces are clean (the empty-axes payload
            # is still valid per IntentAxes schema).
            logger.debug(
                "intent-summary: aget_state failed; falling back to empty axes",
                exc_info=True,
            )

        # Build the typed payload. Pydantic raises ValidationError on
        # schema violations (e.g. axis > 200 chars or prompt > 2000 chars);
        # the caller turns that into an SSE error event.
        payload_kwargs: dict = {
            "axes": IntentAxes.model_validate(intent_axes_raw),
            "prompt_preview": prompt_preview,
        }

        # Settings-diff handling (AC-3): pass through when populated, omit
        # when empty/None. The serialisation below uses
        # ``exclude_none=True`` so ``settings_diff`` itself is dropped from
        # the JSON when ``None``.
        if settings_diff_raw is not None:
            if isinstance(settings_diff_raw, SettingsDiff):
                settings_diff_dump = settings_diff_raw.model_dump(
                    by_alias=True, exclude_none=True
                )
            elif isinstance(settings_diff_raw, dict):
                # Re-validate via SettingsDiff to enforce the typed schema
                # and produce a camelCase wire dump.
                settings_diff_dump = SettingsDiff.model_validate(
                    settings_diff_raw
                ).model_dump(by_alias=True, exclude_none=True)
            else:
                settings_diff_dump = None

            if settings_diff_dump:
                # Re-validate so the final payload still type-checks against
                # IntentSummaryPayload.settings_diff (rather than smuggling a
                # raw dict through ``model_dump`` mode).
                payload_kwargs["settings_diff"] = SettingsDiff.model_validate(
                    settings_diff_dump
                )

        payload = IntentSummaryPayload(**payload_kwargs)

        # ``exclude_none=True`` handles AC-3 omission of the optional
        # ``settings_diff`` field. ``by_alias=True`` ensures any aliased
        # sub-fields (e.g. ``SettingsDiff.modelId.from``) keep the wire
        # spelling that the frontend expects.
        payload_json = payload.model_dump(
            mode="json", exclude_none=True, by_alias=True
        )

        return {
            "event": "intent-summary",
            "data": json.dumps(payload_json),
        }

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
                    if "prompt" in raw_draft:
                        # New single-field format
                        prompt_value = raw_draft["prompt"]
                    else:
                        # Old 3-field checkpoint format: combine motiv + style
                        motiv = raw_draft.get("motiv", "").strip()
                        style = raw_draft.get("style", "").strip()
                        if motiv and style:
                            prompt_value = f"{motiv}. {style}"
                        else:
                            prompt_value = motiv or style
                    draft_prompt = DraftPromptDTO(prompt=prompt_value)

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
