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
from pydantic import HttpUrl, TypeAdapter, ValidationError

from langgraph.checkpoint.memory import MemorySaver

from app.agent.chat_llm_limits import get_chat_llm_limits
from app.agent.graph import create_agent
from app.agent.tools.prompt_tools import SettingsDiff
from app.config import settings
from app.models.dtos import (
    DraftPromptDTO,
    FinalIntentDTO,
    IntentAxes,
    IntentSummaryPayload,
    MessageDTO,
    ModelRecDTO,
    ReferenceSlotDTO,
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

# Slice 21: priority labels for multimodal content parts. Lower priority
# numbers MUST be retained over higher priority numbers when the budget
# (max_images / max_total_bytes) is exceeded.
#
# Mirrors architecture.md → "Multimodal Pipeline — Priority Order & Budget":
#   Priority 1: ReferenceBar slot images (img2img only)
#   Priority 2: Last successful generated result (last_result_image_url)
#   Priority 3: Chat-input uploads (image_urls)
_PRIO_REFERENCE_SLOT: int = 1
_PRIO_LAST_RESULT: int = 2
_PRIO_CHAT_UPLOAD: int = 3

# Slice 21: byte estimate used when neither a per-URL size hint nor a
# content-length lookup is wired. Conservative ~2.5MB default keeps drop
# heuristics correct in the absence of true sizes. Tests override this via
# the optional ``image_byte_sizes`` injection on ``stream_response``.
_DEFAULT_IMAGE_BYTE_ESTIMATE: int = 2_500_000

# Slice 21: TypeAdapter for defensive HttpUrl re-validation of slot URLs in
# the service layer. The DTO already validates on inbound parse; the
# re-validation here protects against direct service callers that bypass
# DTO construction (e.g. older tests).
_HTTP_URL_ADAPTER: TypeAdapter[HttpUrl] = TypeAdapter(HttpUrl)

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
        reference_slots: Optional[list[ReferenceSlotDTO]] = None,
        last_result_image_url: Optional[str] = None,
        image_byte_sizes: Optional[dict[str, int]] = None,
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
            reference_slots: Optional Slice 19 ``ReferenceSlotDTO`` snapshot
                of active ReferenceBar slots. Forwarded to
                ``_build_multimodal_content`` which:
                  * applies the defensive ``generation_mode == "img2img"``
                    re-check (Slice 21 AC-2);
                  * validates each slot URL and emits a ``slot-load-failed``
                    SSE event for malformed/unreachable entries (AC-6);
                  * inserts surviving slots in the wire-order specified by
                    architecture.md → "Multimodal Pipeline" (AC-1).
            last_result_image_url: Optional URL of the most recent
                successful generation; included as a priority-2 image part
                per architecture.md Multimodal Pipeline.
            image_byte_sizes: Optional ``url -> bytes`` map used by the
                ``max_total_bytes`` budget enforcement (Slice 21 AC-8).
                Tests inject deterministic sizes; production callers leave
                this ``None`` so a conservative per-image estimate is used.

        Yields:
            Dicts with 'event' and 'data' keys for SSE formatting.
        """
        try:
            # Slice 21: build the multimodal HumanMessage content + collect
            # any per-slot load failures so they can be emitted as SSE
            # ``slot-load-failed`` events at the start of the stream (before
            # the first text-delta).
            message_content, slot_failures = self._build_multimodal_content(
                content=content,
                image_urls=image_urls,
                reference_slots=reference_slots,
                last_result_image_url=last_result_image_url,
                generation_mode=generation_mode,
                model=model,
                image_byte_sizes=image_byte_sizes,
            )

            # Slice 21 AC-6: emit one SSE ``slot-load-failed`` event per
            # failed slot, in slot_index order. Affected slots are already
            # excluded from ``message_content`` by ``_build_multimodal_content``.
            for failure in slot_failures:
                yield {
                    "event": "slot-load-failed",
                    "data": json.dumps(failure),
                }

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

    # ----------------------------------------------------------------------
    # Slice 21: Multimodal pipeline — build HumanMessage content + budget
    # ----------------------------------------------------------------------

    def _build_multimodal_content(
        self,
        content: str,
        image_urls: Optional[list[str]],
        reference_slots: Optional[list[ReferenceSlotDTO]],
        last_result_image_url: Optional[str],
        generation_mode: Optional[str],
        model: Optional[str],
        image_byte_sizes: Optional[dict[str, int]],
    ) -> tuple[list | str, list[dict]]:
        """Compose the multimodal HumanMessage content list.

        Slice 21 — implements:

        * AC-1: Content order matches architecture.md "Multimodal Pipeline"
          sequence ``[text, *image_urls, *reference_slots, last_result]``.
        * AC-2: ``reference_slots`` are filtered when ``generation_mode`` is
          not ``"img2img"`` (defensive backend re-check).
        * AC-3 / AC-4: priority-based dropping when the total image count
          exceeds ``max_images`` for the resolved chat-LLM. Drop order is
          chat uploads (P3) → last_result (P2) → reference slots (P1);
          within the same priority, oldest-first eviction (newest-first
          retention).
        * AC-5 / AC-9: vision fallback. When the resolved limits report
          ``vision=False`` (explicit non-vision OR unknown model →
          DEFAULT_LIMITS), all image parts are stripped and a single
          WARNING is logged.
        * AC-6: malformed slot URLs are excluded from the content and a
          ``slot-load-failed`` event payload is appended to the returned
          ``slot_failures`` list (caller emits the SSE event).
        * AC-8: ``max_total_bytes`` cap drops by the same priority order
          until the cumulative byte estimate is at or below the cap.

        Args:
            content: User text message.
            image_urls: Chat-input upload URLs (chronological order; oldest
                first, newest last).
            reference_slots: Active ReferenceBar slots snapshot (img2img
                only; defensively re-checked here).
            last_result_image_url: Last successfully generated image URL
                from a prior turn.
            generation_mode: ``"txt2img"`` or ``"img2img"``.
            model: Chat-LLM model ID used to look up multimodal caps.
            image_byte_sizes: Optional per-URL byte size hint. When ``None``
                or missing for a URL, ``_DEFAULT_IMAGE_BYTE_ESTIMATE`` is
                applied. Tests inject deterministic sizes via this hook.

        Returns:
            ``(content, slot_failures)``:
              * ``content`` is either a plain string (no images, no parts
                beyond text) or a list of multipart entries shaped like
                ``[{"type": "text", "text": ...}, {"type": "image_url",
                "image_url": {"url": ...}}, ...]``.
              * ``slot_failures`` is a list of ``{"slot_index", "reason"}``
                dicts (in slot_index order) for slots that could not be
                included due to malformed URLs.
        """
        text_part = {"type": "text", "text": content}

        slot_failures: list[dict] = []

        # Resolve chat-LLM multimodal caps.
        limits = get_chat_llm_limits(model)
        vision_capable = bool(limits.get("vision"))
        max_images = int(limits.get("max_images", 0) or 0)
        max_total_bytes = int(limits.get("max_total_bytes", 0) or 0)

        # AC-5 / AC-9: vision fallback — strip every image part, log once.
        if not vision_capable:
            logger.warning(
                "AssistantService: vision fallback for non-vision model %r "
                "— stripping all image parts (architecture.md → 'Vision "
                "fallback determinism')",
                model,
            )
            return content, slot_failures

        # ------------------------------------------------------------------
        # 1. Collect candidate parts with priority + chronological tag.
        #    ``order`` is a strictly increasing per-list counter so that,
        #    within the same priority, the smallest ``order`` is the
        #    oldest entry (dropped first). For chat uploads the input list
        #    is treated as oldest-first; the last entry is the newest.
        # ------------------------------------------------------------------
        candidates: list[dict] = []

        # Chat uploads (priority 3, oldest-first ordering).
        if image_urls:
            for idx, url in enumerate(image_urls):
                if not url:
                    continue
                candidates.append(
                    {
                        "priority": _PRIO_CHAT_UPLOAD,
                        "order": idx,
                        "url": str(url),
                        "slot_index": None,
                    }
                )

        # Reference slots (priority 1) — img2img only (AC-2).
        if reference_slots and generation_mode == "img2img":
            for idx, slot in enumerate(reference_slots):
                slot_index = getattr(slot, "slot_index", None)
                raw_url = getattr(slot, "image_url", None)
                # AC-6: defensive URL validation. ``ReferenceSlotDTO``
                # already validates HttpUrl on parse, but the service may
                # be invoked with a hand-crafted DTO (e.g. via tests) or
                # with a slot whose URL became invalid after construction.
                failure_reason = self._validate_slot_url(raw_url)
                if failure_reason is not None:
                    slot_failures.append(
                        {
                            "slot_index": (
                                slot_index if isinstance(slot_index, int) else idx
                            ),
                            "reason": failure_reason,
                        }
                    )
                    continue
                candidates.append(
                    {
                        "priority": _PRIO_REFERENCE_SLOT,
                        "order": idx,
                        "url": str(raw_url),
                        "slot_index": slot_index,
                    }
                )

        # Last successful generated result (priority 2).
        if last_result_image_url:
            url_str = str(last_result_image_url)
            candidates.append(
                {
                    "priority": _PRIO_LAST_RESULT,
                    "order": 0,
                    "url": url_str,
                    "slot_index": None,
                }
            )

        # ------------------------------------------------------------------
        # 2. Apply budget — drop lowest priority first; within the same
        #    priority drop oldest first. We sort ascending by (priority,
        #    order) for the *kept* list and pop from the right to evict
        #    the lowest-priority + oldest entries.
        # ------------------------------------------------------------------
        kept = sorted(candidates, key=lambda c: (c["priority"], c["order"]))

        # AC-3 / AC-4: max_images cap.
        while max_images >= 0 and len(kept) > max_images:
            # Evict the worst entry: highest priority number, then highest
            # order (oldest within same priority).
            worst_idx = self._find_worst_index(kept)
            kept.pop(worst_idx)
            logger.debug(
                "AssistantService.multimodal: dropped image to honour "
                "max_images=%d cap; remaining=%d",
                max_images,
                len(kept),
            )

        # AC-8: max_total_bytes cap.
        if max_total_bytes > 0 and kept:
            while kept and self._sum_bytes(kept, image_byte_sizes) > max_total_bytes:
                worst_idx = self._find_worst_index(kept)
                kept.pop(worst_idx)
                logger.debug(
                    "AssistantService.multimodal: dropped image to honour "
                    "max_total_bytes=%d cap; remaining=%d",
                    max_total_bytes,
                    len(kept),
                )

        # ------------------------------------------------------------------
        # 3. Render in architecture-mandated wire order (AC-1):
        #    text → chat_uploads → reference_slots → last_result_image_url.
        # ------------------------------------------------------------------
        if not kept:
            # No images survived (or none were provided). Stay
            # backward-compatible with the legacy plain-string content path
            # so existing behaviour is preserved when nothing is attached.
            return content, slot_failures

        kept_chat = sorted(
            (c for c in kept if c["priority"] == _PRIO_CHAT_UPLOAD),
            key=lambda c: c["order"],
        )
        kept_refs = sorted(
            (c for c in kept if c["priority"] == _PRIO_REFERENCE_SLOT),
            key=lambda c: c["order"],
        )
        kept_last = [c for c in kept if c["priority"] == _PRIO_LAST_RESULT]

        message_content: list[dict] = [text_part]
        for entry in kept_chat:
            message_content.append(self._image_url_part(entry["url"]))
        for entry in kept_refs:
            message_content.append(self._image_url_part(entry["url"]))
        for entry in kept_last:
            message_content.append(self._image_url_part(entry["url"]))

        return message_content, slot_failures

    @staticmethod
    def _find_worst_index(kept: list[dict]) -> int:
        """Return the index of the eviction candidate in ``kept``.

        The "worst" entry is the one with the highest priority number
        (lowest priority class) and, within the same priority, the highest
        ``order`` value -- which corresponds to the OLDEST item in our
        encoding. Wait: re-reading "newest first retention" -- per
        architecture.md, oldest items are dropped first. Within the
        chat-upload list, ``order`` increases chronologically (oldest first
        at index 0, newest last). So the entry to drop FIRST is the one
        with the LOWEST ``order`` (oldest). The retained "newest" entry
        has the HIGHEST ``order``.
        """
        worst_idx = 0
        worst_priority = kept[0]["priority"]
        worst_order = kept[0]["order"]
        for i, entry in enumerate(kept[1:], start=1):
            p = entry["priority"]
            o = entry["order"]
            # Prefer entries with HIGHER priority number (lower class).
            if p > worst_priority or (
                p == worst_priority and o < worst_order
            ):
                worst_idx = i
                worst_priority = p
                worst_order = o
        return worst_idx

    @staticmethod
    def _sum_bytes(
        kept: list[dict],
        image_byte_sizes: Optional[dict[str, int]],
    ) -> int:
        """Return the cumulative byte estimate for ``kept`` candidates.

        When a per-URL hint is missing, ``_DEFAULT_IMAGE_BYTE_ESTIMATE`` is
        applied so the budget is still honoured pessimistically.
        """
        if not image_byte_sizes:
            return _DEFAULT_IMAGE_BYTE_ESTIMATE * len(kept)
        total = 0
        for entry in kept:
            total += int(
                image_byte_sizes.get(entry["url"], _DEFAULT_IMAGE_BYTE_ESTIMATE)
            )
        return total

    @staticmethod
    def _image_url_part(url: str) -> dict:
        """Build a LangChain-compatible ``image_url`` content part."""
        return {"type": "image_url", "image_url": {"url": url}}

    @staticmethod
    def _validate_slot_url(raw_url) -> Optional[str]:
        """Defensive HttpUrl validation for a single reference slot.

        Returns:
            ``None`` when the URL is valid (or already a Pydantic
            ``HttpUrl``); otherwise the ``SlotLoadFailedPayload.reason``
            literal: ``"invalid_url"`` for parse errors and
            ``"fetch_failed"`` reserved for downstream fetch failures
            (currently unused on this code path; kept for API parity with
            the architecture.md → ``SlotLoadFailedPayload`` schema).
        """
        if raw_url is None:
            return "invalid_url"
        # Pydantic HttpUrl objects are already validated.
        try:
            url_str = str(raw_url)
        except Exception:
            return "invalid_url"
        if not url_str:
            return "invalid_url"
        try:
            _HTTP_URL_ADAPTER.validate_python(url_str)
        except ValidationError:
            return "invalid_url"
        return None

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
        # Slice 28: defaults match ``DEFAULT_STATE_VALUES`` (state.py:50-58)
        # so legacy checkpoints (pre-Slice-14) yield the same shape as a
        # freshly-initialised state. AC-2 verifies the no-error path.
        flow_state_value: str = "idle"
        intent_axes_value: dict = {}
        final_intent_value: Optional[FinalIntentDTO] = None

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

                # Slice 28: extract FSM mirror fields. The DTO defaults to
                # ``"idle"`` / ``{}`` / ``None`` for legacy checkpoints —
                # we only override when the persisted values are actually
                # present and of the expected type. Defensive isinstance
                # checks prevent ``ValidationError`` on malformed legacy
                # state and ensure AC-2 (no 500 for old sessions).
                raw_flow_state = state_values.get("flow_state")
                if isinstance(raw_flow_state, str) and raw_flow_state:
                    flow_state_value = raw_flow_state

                raw_intent_axes = state_values.get("intent_axes")
                if isinstance(raw_intent_axes, dict):
                    intent_axes_value = raw_intent_axes

                # ``final_intent`` is the payload written by the
                # ``emit_intent_summary`` tool (state.py:33-35). The shape
                # mirrors the tool input schema: ``prompt`` / ``settings_diff`` /
                # ``model_id``. Only ``prompt`` is required; legacy checkpoints
                # that pre-date Slice 13 simply have ``None`` here.
                raw_final_intent = state_values.get("final_intent")
                if isinstance(raw_final_intent, dict) and raw_final_intent.get(
                    "prompt"
                ):
                    try:
                        final_intent_value = FinalIntentDTO.model_validate(
                            raw_final_intent
                        )
                    except Exception:
                        # Defensive: malformed persisted payload should not
                        # break the resume endpoint. Log and fall back to
                        # ``None`` so the frontend treats the session as
                        # "summarizing without payload" (AC-6).
                        logger.warning(
                            "Could not validate final_intent for session %s; "
                            "returning None",
                            session_id,
                            exc_info=True,
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
            flow_state=flow_state_value,
            intent_axes=intent_axes_value,
            final_intent=final_intent_value,
        )

        return SessionDetailResponse(session=session, state=state)
