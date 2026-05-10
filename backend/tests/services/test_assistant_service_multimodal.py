"""Acceptance tests for Slice 21: Multimodal-Pipeline + Budget-Enforcement.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-21-multimodal-pipeline-budget.md.

Mocking Strategy: ``mock_external`` (per Slice-Spec Test-Strategy):
- The compiled LangGraph agent (``self._agent``) is replaced by a
  ``_FakeAgent`` whose ``astream_events`` yields a deterministic (empty)
  sequence so the multimodal HumanMessage build can be inspected via the
  captured ``input_state`` without invoking a real LLM.
- ``ProjectRepository`` and ``SessionRepository`` are mocked so the
  service ``__init__`` does not require a real DB.
- ``get_chat_llm_limits`` is the real Slice-20 helper — pure constants
  module, no external resources.

Source ACs covered in this file (8 backend ACs from the slice spec):
- AC-1: Content-Reihenfolge im HumanMessage
- AC-2: ReferenceSlots werden bei generation_mode != "img2img" ignoriert
- AC-3: Priority-Drop reduziert auf max_images-Cap
- AC-4: Priority-Drop respektiert Architecture-Reihenfolge bei Cap=2
- AC-5: Vision-Fallback strippt alle Bild-Parts
- AC-6: Slot-Load-Failure emittiert SSE-Event und überspringt Slot
- AC-8: max_total_bytes-Cap droppt unabhängig von max_images
- AC-9: Unbekanntes Modell trifft DEFAULT_LIMITS (vision=False)

(AC-7 lives on the frontend reducer and is covered in
``lib/assistant/__tests__/assistant-context.test.tsx``.)
"""

from __future__ import annotations

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.dtos import ReferenceSlotDTO


# ---------------------------------------------------------------------------
# Fake LangGraph agent harness
# ---------------------------------------------------------------------------


class _FakeStateSnapshot:
    """Minimal ``aget_state`` return value with ``.values`` dict."""

    def __init__(self, values: dict | None = None):
        self.values = values or {}


class _FakeAgent:
    """A stand-in for the LangGraph compiled agent.

    Captures ``input_state`` so tests can inspect the constructed
    ``HumanMessage`` (which is the artefact under test for Slice 21).
    ``astream_events`` yields no events by default — the multimodal pipeline
    runs entirely BEFORE the agent stream and is independent of LLM output.
    """

    def __init__(
        self,
        events: list[dict] | None = None,
        state_values: dict | None = None,
    ):
        self._events = events or []
        self._state_values = state_values or {}
        self.captured_configs: list[dict] = []
        self.captured_inputs: list[dict] = []

    def astream_events(self, input_state, config=None, version=None, **kwargs):
        self.captured_configs.append(config)
        self.captured_inputs.append(input_state)
        events = list(self._events)

        async def _gen():
            for ev in events:
                yield ev

        return _gen()

    async def aget_state(self, config):
        return _FakeStateSnapshot(self._state_values)


def _make_service(
    events: list[dict] | None = None,
    state_values: dict | None = None,
):
    """Build an ``AssistantService`` whose internal agent is a ``_FakeAgent``.

    Returns ``(service, fake_agent)`` so tests can read back the captured
    ``input_state[messages][0]`` (the HumanMessage built by Slice 21).
    """
    with patch("app.services.assistant_service.create_agent") as mock_create:
        fake_agent = _FakeAgent(events=events, state_values=state_values)
        mock_create.return_value = fake_agent

        with patch("app.services.assistant_service.SessionRepository") as mock_sess:
            mock_sess.return_value = MagicMock()
            project_repo = MagicMock()
            project_repo.get_context = AsyncMock(return_value=(None, None))

            from app.services.assistant_service import AssistantService

            service = AssistantService(project_repo=project_repo)

    # Defensive: replace the agent in case __init__ created one before the
    # patch context took effect.
    service._agent = fake_agent
    return service, fake_agent


async def _drain(async_iter):
    """Consume an async iterator and return the collected events."""
    out = []
    async for ev in async_iter:
        out.append(ev)
    return out


def _make_slot(slot_index: int, url: str) -> ReferenceSlotDTO:
    """Construct a ``ReferenceSlotDTO`` with a valid HttpUrl."""
    return ReferenceSlotDTO(slot_index=slot_index, image_url=url)


def _captured_human_message_content(fake_agent: _FakeAgent):
    """Pull the multimodal content list (or string) out of the captured input."""
    assert fake_agent.captured_inputs, "expected agent.astream_events to be invoked"
    input_state = fake_agent.captured_inputs[-1]
    messages = input_state.get("messages", [])
    assert messages, "expected a HumanMessage in the input state"
    return messages[0].content


def _image_urls_in_order(content) -> list[str]:
    """Extract image_url strings from a multimodal content list, in order."""
    if not isinstance(content, list):
        return []
    out: list[str] = []
    for part in content:
        if isinstance(part, dict) and part.get("type") == "image_url":
            url_obj = part.get("image_url", {})
            if isinstance(url_obj, dict):
                out.append(url_obj.get("url", ""))
            else:
                out.append(str(url_obj))
    return out


# ---------------------------------------------------------------------------
# AC-1: Content-Reihenfolge im HumanMessage entspricht Architecture-Pipeline
# ---------------------------------------------------------------------------


class TestAC1ContentOrder:
    """AC-1: GIVEN a SendMessageRequest with content, 1 chat upload, 2
    reference slots (img2img), 1 last_result_image_url and a vision-capable
    model with sufficient budget WHEN AssistantService builds the
    HumanMessage THEN human_message.content is a list in the order
    [text, *chat_uploads, *reference_slots, last_result_image_url].
    """

    @pytest.mark.asyncio
    async def test_human_message_content_order_matches_pipeline_spec(self):
        service, fake_agent = _make_service()

        chat_url = "https://chat.example/upload-1.png"
        slot_url_a = "https://slots.example/slot-0.png"
        slot_url_b = "https://slots.example/slot-1.png"
        last_result = "https://results.example/last.png"

        await _drain(
            service.stream_response(
                session_id="sess-ac1",
                content="Test",
                image_urls=[chat_url],
                model="anthropic/claude-sonnet-4.6",
                generation_mode="img2img",
                reference_slots=[
                    _make_slot(0, slot_url_a),
                    _make_slot(1, slot_url_b),
                ],
                last_result_image_url=last_result,
            )
        )

        content = _captured_human_message_content(fake_agent)
        assert isinstance(content, list), (
            "Multimodal HumanMessage MUST be a list of parts when images "
            f"are attached; got {type(content).__name__}"
        )
        # Text part first.
        assert content[0] == {"type": "text", "text": "Test"}, (
            f"first part must be the text-part, got {content[0]!r}"
        )

        urls = _image_urls_in_order(content)
        # Architecture-mandated wire order:
        #   chat_uploads -> reference_slots -> last_result_image_url
        assert urls == [chat_url, slot_url_a, slot_url_b, last_result], (
            "image_url parts MUST appear in [chat_uploads, slots, last_result] "
            f"order per architecture.md; got {urls}"
        )


# ---------------------------------------------------------------------------
# AC-2: ReferenceSlots werden bei generation_mode != "img2img" ignoriert
# ---------------------------------------------------------------------------


class TestAC2DefensiveModeRecheck:
    """AC-2: GIVEN a request with ``generation_mode="txt2img"`` and 3
    reference slots WHEN the HumanMessage is built THEN none of the slot
    image_url parts appear in the content list (defensive backend re-check).
    """

    @pytest.mark.asyncio
    async def test_reference_slots_ignored_when_mode_is_not_img2img(self):
        service, fake_agent = _make_service()

        slot_urls = [
            "https://slots.example/slot-0.png",
            "https://slots.example/slot-1.png",
            "https://slots.example/slot-2.png",
        ]
        await _drain(
            service.stream_response(
                session_id="sess-ac2",
                content="Generate",
                image_urls=None,
                model="anthropic/claude-sonnet-4.6",
                generation_mode="txt2img",
                reference_slots=[
                    _make_slot(i, url) for i, url in enumerate(slot_urls)
                ],
                last_result_image_url=None,
            )
        )

        content = _captured_human_message_content(fake_agent)
        urls = _image_urls_in_order(content)
        for slot_url in slot_urls:
            assert slot_url not in urls, (
                f"slot URL {slot_url!r} MUST NOT appear in txt2img mode; "
                f"got urls={urls}"
            )

    @pytest.mark.asyncio
    async def test_reference_slots_ignored_when_mode_is_none(self):
        """Defensive: missing/None mode is treated as 'not img2img'."""
        service, fake_agent = _make_service()

        slot_url = "https://slots.example/slot-0.png"
        await _drain(
            service.stream_response(
                session_id="sess-ac2-none",
                content="Generate",
                image_urls=None,
                model="anthropic/claude-sonnet-4.6",
                generation_mode=None,
                reference_slots=[_make_slot(0, slot_url)],
                last_result_image_url=None,
            )
        )

        content = _captured_human_message_content(fake_agent)
        urls = _image_urls_in_order(content)
        assert slot_url not in urls, (
            "missing generation_mode MUST NOT include slot URLs"
        )


# ---------------------------------------------------------------------------
# AC-3: Priority-Drop reduziert auf max_images-Cap
# ---------------------------------------------------------------------------


class TestAC3PriorityDropAtMaxImages:
    """AC-3: GIVEN a vision model with ``max_images=4`` (e.g. openai/gpt-5.4),
    2 ReferenceSlots (P1), 1 last_result (P2), 3 Chat-Uploads (P3) — 6 total
    images WHEN the HumanMessage is built THEN exactly 4 image_url parts
    survive: 2 ReferenceSlots + 1 last_result + 1 Chat-Upload (newest);
    the two oldest Chat-Uploads are dropped (drop order P3 -> P2 -> P1).
    """

    @pytest.mark.asyncio
    async def test_priority_drop_caps_at_max_images_drops_lowest_first(self):
        service, fake_agent = _make_service()

        chat_old = "https://chat.example/old.png"
        chat_mid = "https://chat.example/mid.png"
        chat_new = "https://chat.example/new.png"
        slot_a = "https://slots.example/slot-0.png"
        slot_b = "https://slots.example/slot-1.png"
        last_result = "https://results.example/last.png"

        await _drain(
            service.stream_response(
                session_id="sess-ac3",
                content="Test",
                image_urls=[chat_old, chat_mid, chat_new],  # oldest-first
                model="openai/gpt-5.4",  # max_images=4
                generation_mode="img2img",
                reference_slots=[
                    _make_slot(0, slot_a),
                    _make_slot(1, slot_b),
                ],
                last_result_image_url=last_result,
            )
        )

        content = _captured_human_message_content(fake_agent)
        urls = _image_urls_in_order(content)
        assert len(urls) == 4, (
            f"max_images=4 cap MUST yield exactly 4 image parts, got "
            f"{len(urls)}: {urls}"
        )
        # Both reference slots survive (priority 1).
        assert slot_a in urls, "slot_a (priority 1) MUST be retained"
        assert slot_b in urls, "slot_b (priority 1) MUST be retained"
        # last_result survives (priority 2).
        assert last_result in urls, (
            "last_result (priority 2) MUST be retained when only 1 chat "
            "upload is dropped from a P3 surplus"
        )
        # Newest chat upload survives, oldest two dropped.
        assert chat_new in urls, "newest chat upload MUST be retained"
        assert chat_old not in urls, "oldest chat upload MUST be dropped first"
        assert chat_mid not in urls, "second-oldest chat upload MUST be dropped"


# ---------------------------------------------------------------------------
# AC-4: Priority-Drop respektiert Architecture-Reihenfolge bei Cap=2
# ---------------------------------------------------------------------------


class TestAC4PriorityDropTightCap:
    """AC-4: GIVEN a vision model with ``max_images=2`` (configured via
    monkeypatch to keep the test stable across model-id changes), 2 Refs +
    1 last_result + 2 Chat-Uploads (5 images) WHEN the HumanMessage is
    built THEN exactly 2 image_url parts survive: BOTH ReferenceSlots; the
    last_result and all chat uploads are dropped (highest priority retained).
    """

    @pytest.mark.asyncio
    async def test_priority_drop_keeps_only_highest_priority_when_cap_tight(
        self, monkeypatch
    ):
        # Override the limits lookup so we can drive ``max_images=2``
        # without coupling to a specific allowlist entry.
        from app.services import assistant_service as svc_module

        def _fake_get_limits(model_id):
            return {"max_images": 2, "max_total_bytes": 0, "vision": True}

        monkeypatch.setattr(svc_module, "get_chat_llm_limits", _fake_get_limits)

        service, fake_agent = _make_service()

        chat_a = "https://chat.example/a.png"
        chat_b = "https://chat.example/b.png"
        slot_0 = "https://slots.example/slot-0.png"
        slot_1 = "https://slots.example/slot-1.png"
        last_result = "https://results.example/last.png"

        await _drain(
            service.stream_response(
                session_id="sess-ac4",
                content="Test",
                image_urls=[chat_a, chat_b],
                model="openai/gpt-5.4",
                generation_mode="img2img",
                reference_slots=[
                    _make_slot(0, slot_0),
                    _make_slot(1, slot_1),
                ],
                last_result_image_url=last_result,
            )
        )

        content = _captured_human_message_content(fake_agent)
        urls = _image_urls_in_order(content)
        assert len(urls) == 2, (
            f"max_images=2 cap MUST yield exactly 2 image parts, got "
            f"{len(urls)}: {urls}"
        )
        assert slot_0 in urls and slot_1 in urls, (
            "both reference slots MUST survive (highest priority class)"
        )
        assert last_result not in urls, "last_result MUST be dropped at cap=2"
        assert chat_a not in urls and chat_b not in urls, (
            "all chat uploads MUST be dropped at cap=2"
        )


# ---------------------------------------------------------------------------
# AC-5: Vision-Fallback strippt alle Bild-Parts (Non-Vision-Modell)
# ---------------------------------------------------------------------------


class TestAC5VisionFallback:
    """AC-5: GIVEN a model whose ``get_chat_llm_limits(model_id)["vision"]
    is False`` and a request with refs + last_result + chat uploads WHEN the
    HumanMessage is built THEN content is text-only (no image_url part) and
    a WARNING-level log is emitted with the model id.
    """

    @pytest.mark.asyncio
    async def test_vision_fallback_strips_all_images_for_non_vision_model(
        self, monkeypatch, caplog
    ):
        from app.services import assistant_service as svc_module

        def _fake_get_limits(model_id):
            return {
                "max_images": 4,
                "max_total_bytes": 16_000_000,
                "vision": False,
            }

        monkeypatch.setattr(svc_module, "get_chat_llm_limits", _fake_get_limits)

        service, fake_agent = _make_service()

        with caplog.at_level(logging.WARNING, logger="app.services.assistant_service"):
            await _drain(
                service.stream_response(
                    session_id="sess-ac5",
                    content="Hello",
                    image_urls=["https://chat.example/u.png"],
                    model="some/non-vision-model",
                    generation_mode="img2img",
                    reference_slots=[_make_slot(0, "https://slots.example/0.png")],
                    last_result_image_url="https://results.example/last.png",
                )
            )

        content = _captured_human_message_content(fake_agent)
        # Either a plain text string or a single-part list with no images.
        if isinstance(content, list):
            urls = _image_urls_in_order(content)
            assert urls == [], (
                f"non-vision model MUST strip every image part, got {urls}"
            )
        else:
            assert content == "Hello", (
                f"non-vision fallback should leave plain text, got {content!r}"
            )

        # Warning log with the model id.
        assert any(
            record.levelno == logging.WARNING
            and "some/non-vision-model" in record.getMessage()
            for record in caplog.records
        ), (
            "WARNING log with model id MUST be emitted for the vision "
            f"fallback; got records: {[r.getMessage() for r in caplog.records]}"
        )


# ---------------------------------------------------------------------------
# AC-6: Slot-Load-Failure emittiert SSE-Event und ueberspringt Slot
# ---------------------------------------------------------------------------


class TestAC6SlotLoadFailure:
    """AC-6: GIVEN a vision model and a reference_slots list with
    ``slot_index=2`` whose image_url is invalid (i.e. fails defensive
    HttpUrl validation) WHEN the HumanMessage is built THEN an SSE event
    ``{"event": "slot-load-failed", "data": {"slot_index": 2,
    "reason": "fetch_failed" | "invalid_url"}}`` is emitted (per
    SlotLoadFailedPayload), the failed slot is NOT in the final content,
    and the other slots are processed normally.
    """

    @pytest.mark.asyncio
    async def test_slot_load_failed_emits_sse_event_and_skips_slot(self):
        service, fake_agent = _make_service()

        good_slot_0 = "https://slots.example/good-0.png"
        good_slot_1 = "https://slots.example/good-1.png"

        # Build a slot DTO and then mutate its image_url to an obviously
        # invalid value to exercise the defensive backend re-check. Using
        # ``model_construct`` bypasses Pydantic validation so we can plant
        # a malformed URL in the DTO instance.
        bad_slot = ReferenceSlotDTO.model_construct(
            slot_index=2,
            image_url="not-a-valid-url",
            role=None,
            strength=None,
        )

        events = await _drain(
            service.stream_response(
                session_id="sess-ac6",
                content="Test",
                image_urls=None,
                model="anthropic/claude-sonnet-4.6",
                generation_mode="img2img",
                reference_slots=[
                    _make_slot(0, good_slot_0),
                    _make_slot(1, good_slot_1),
                    bad_slot,
                ],
                last_result_image_url=None,
            )
        )

        # SSE event emitted exactly once for the failed slot.
        slot_failed = [
            e for e in events if e.get("event") == "slot-load-failed"
        ]
        assert len(slot_failed) == 1, (
            f"exactly one slot-load-failed SSE event MUST be emitted, got "
            f"{len(slot_failed)}: {slot_failed}"
        )
        payload = json.loads(slot_failed[0]["data"])
        assert payload.get("slot_index") == 2, (
            f"slot_index in payload MUST be 2, got {payload}"
        )
        assert payload.get("reason") in {"fetch_failed", "invalid_url"}, (
            "reason MUST be one of the SlotLoadFailedPayload literals "
            f'"fetch_failed" | "invalid_url"; got {payload!r}'
        )

        # Failed slot is NOT in the multimodal content; good slots survive.
        content = _captured_human_message_content(fake_agent)
        urls = _image_urls_in_order(content)
        assert "not-a-valid-url" not in urls, (
            "failed slot URL MUST NOT appear in the HumanMessage content"
        )
        assert good_slot_0 in urls, "good slot 0 MUST survive"
        assert good_slot_1 in urls, "good slot 1 MUST survive"


# ---------------------------------------------------------------------------
# AC-8: max_total_bytes-Cap droppt unabhaengig von max_images
# ---------------------------------------------------------------------------


class TestAC8TotalBytesCap:
    """AC-8: GIVEN a vision model with ``max_total_bytes=16_000_000`` and 3
    images whose cumulative bytes exceed 20_000_000 but ``max_images=4`` is
    not exceeded WHEN the HumanMessage is built THEN at least the
    lowest-priority image is dropped until the cumulative size <=
    max_total_bytes; drop order follows the priority hierarchy from AC-3.
    """

    @pytest.mark.asyncio
    async def test_total_bytes_cap_drops_lowest_priority(self, monkeypatch):
        from app.services import assistant_service as svc_module

        def _fake_get_limits(model_id):
            return {
                "max_images": 4,
                "max_total_bytes": 16_000_000,
                "vision": True,
            }

        monkeypatch.setattr(svc_module, "get_chat_llm_limits", _fake_get_limits)

        service, fake_agent = _make_service()

        chat_url = "https://chat.example/big.png"  # priority 3 — drop first
        slot_url = "https://slots.example/slot-0.png"  # priority 1
        last_result = "https://results.example/last.png"  # priority 2

        # Per-URL byte sizes that violate the 16MB cap if all three are
        # included (cumulative ~21MB), but are within max_images=4.
        image_byte_sizes = {
            chat_url: 7_000_000,
            slot_url: 7_000_000,
            last_result: 7_000_000,
        }

        await _drain(
            service.stream_response(
                session_id="sess-ac8",
                content="Test",
                image_urls=[chat_url],
                model="openai/gpt-5.4",
                generation_mode="img2img",
                reference_slots=[_make_slot(0, slot_url)],
                last_result_image_url=last_result,
                image_byte_sizes=image_byte_sizes,
            )
        )

        content = _captured_human_message_content(fake_agent)
        urls = _image_urls_in_order(content)

        # Cumulative byte sum after drops MUST be <= max_total_bytes.
        retained_bytes = sum(image_byte_sizes.get(u, 0) for u in urls)
        assert retained_bytes <= 16_000_000, (
            f"max_total_bytes cap violated: retained {retained_bytes} bytes "
            f"(urls={urls})"
        )
        # Drop order: P3 (chat) before P2 (last_result) before P1 (slot).
        # The chat upload (lowest priority) MUST be dropped first.
        assert chat_url not in urls, (
            "chat upload (priority 3) MUST be dropped first to honour "
            f"max_total_bytes; got urls={urls}"
        )
        # The reference slot (highest priority) MUST be retained.
        assert slot_url in urls, (
            "reference slot (priority 1) MUST be retained when bytes-cap "
            f"can be honoured by dropping lower priorities; got urls={urls}"
        )


# ---------------------------------------------------------------------------
# AC-9: Unbekanntes Modell trifft DEFAULT_LIMITS (vision=False)
# ---------------------------------------------------------------------------


class TestAC9UnknownModelDefaultLimits:
    """AC-9: GIVEN a model_id that is NOT in CHAT_LLM_LIMITS WHEN the
    HumanMessage is built THEN ``DEFAULT_LIMITS`` (Slice 20) is applied and
    all images are stripped (behaviour identical to AC-5).
    """

    @pytest.mark.asyncio
    async def test_unknown_model_falls_back_to_default_and_strips_images(self):
        # Use the real Slice-20 helper — DEFAULT_LIMITS has vision=False, so
        # any model id not in the allowlist must strip images.
        service, fake_agent = _make_service()

        await _drain(
            service.stream_response(
                session_id="sess-ac9",
                content="Hello",
                image_urls=["https://chat.example/u.png"],
                model="unknown/not-in-allowlist",
                generation_mode="img2img",
                reference_slots=[_make_slot(0, "https://slots.example/0.png")],
                last_result_image_url="https://results.example/last.png",
            )
        )

        content = _captured_human_message_content(fake_agent)
        if isinstance(content, list):
            urls = _image_urls_in_order(content)
            assert urls == [], (
                f"unknown model MUST hit DEFAULT_LIMITS (vision=False) and "
                f"strip every image part; got {urls}"
            )
        else:
            assert content == "Hello", (
                f"unknown model fallback should preserve plain text, got "
                f"{content!r}"
            )

    @pytest.mark.asyncio
    async def test_unknown_model_with_no_model_id_strips_images(self):
        """Defensive: model=None hits the same DEFAULT_LIMITS branch."""
        service, fake_agent = _make_service()

        await _drain(
            service.stream_response(
                session_id="sess-ac9-none",
                content="Hello",
                image_urls=["https://chat.example/u.png"],
                model=None,
                generation_mode="img2img",
                reference_slots=None,
                last_result_image_url=None,
            )
        )

        content = _captured_human_message_content(fake_agent)
        if isinstance(content, list):
            urls = _image_urls_in_order(content)
            assert urls == [], (
                f"model=None MUST hit DEFAULT_LIMITS and strip images; got "
                f"{urls}"
            )
        else:
            assert content == "Hello"
