"""Unit tests for Slice 28: SessionStateDTO + FinalIntentDTO surface.

These pure-Python tests verify the DTO-level contract that the GET
``/api/assistant/sessions/{id}`` resume endpoint depends on.

Source ACs (slice-28-session-resume-flow-state.md):
- AC-1: ``SessionStateDTO`` surfaces ``flow_state``, ``intent_axes`` and
  ``final_intent`` so the frontend can rebuild ``IntentSummaryPayload``
  on session reload.
- AC-2: Defaults match ``DEFAULT_STATE_VALUES`` (``"idle"`` / ``{}`` /
  ``None``); a ``SessionStateDTO`` constructed without arguments must NOT
  raise — it is the same shape returned for legacy (pre-Slice-14)
  checkpoints.

Mocking Strategy: ``no_mocks`` — Pydantic schema, no IO.
"""

from typing import get_type_hints

import pytest

from app.models.dtos import (
    FinalIntentDTO,
    SessionDetailResponse,
    SessionResponse,
    SessionStateDTO,
)


# ---------------------------------------------------------------------------
# AC-1: SessionStateDTO has final_intent (Optional[FinalIntentDTO])
# ---------------------------------------------------------------------------


class TestSessionStateDtoFinalIntentField:
    """AC-1: SessionStateDTO must surface ``final_intent`` so the frontend
    can rebuild ``IntentSummaryPayload`` on session reload.
    """

    def test_session_state_dto_includes_final_intent_field(self):
        """AC-1: ``final_intent`` is a Pydantic field on SessionStateDTO."""
        fields = SessionStateDTO.model_fields
        assert "final_intent" in fields, (
            f"SessionStateDTO must declare a 'final_intent' field; "
            f"current fields: {list(fields)}"
        )

    def test_session_state_dto_final_intent_default_is_none(self):
        """AC-2: default value for ``final_intent`` is ``None`` so legacy
        checkpoints that pre-date the ``emit_intent_summary`` tool round-trip
        cleanly without raising."""
        dto = SessionStateDTO()
        assert dto.final_intent is None, (
            f"SessionStateDTO.final_intent default must be None, "
            f"got {dto.final_intent!r}"
        )

    def test_session_state_dto_final_intent_optional_finalintentdto(self):
        """AC-1: ``final_intent`` accepts a FinalIntentDTO instance."""
        dto = SessionStateDTO(
            final_intent=FinalIntentDTO(
                prompt="A test prompt",
                settings_diff=None,
                model_id=None,
            ),
        )
        assert dto.final_intent is not None
        assert dto.final_intent.prompt == "A test prompt"

    def test_session_state_dto_final_intent_accepts_dict(self):
        """AC-1: ``final_intent`` accepts a dict (Pydantic auto-validates)
        so ``model_validate`` from ``aget_state`` output works directly."""
        dto = SessionStateDTO.model_validate(
            {
                "final_intent": {
                    "prompt": "A photorealistic cat",
                    "settings_diff": None,
                    "model_id": "flux-2-pro",
                },
            }
        )
        assert dto.final_intent is not None
        assert dto.final_intent.prompt == "A photorealistic cat"
        # model_id is intentionally carried through — frontend drops it.
        assert dto.final_intent.model_id == "flux-2-pro"


# ---------------------------------------------------------------------------
# AC-1: FinalIntentDTO schema mirror of emit_intent_summary tool input
# ---------------------------------------------------------------------------


class TestFinalIntentDto:
    """AC-1: FinalIntentDTO mirrors the ``emit_intent_summary`` tool input
    schema so the frontend Hydrate-Effekt can rebuild ``IntentSummaryPayload``.
    """

    def test_final_intent_dto_requires_prompt(self):
        """``prompt`` is required."""
        with pytest.raises(Exception):
            FinalIntentDTO()  # type: ignore[call-arg]

    def test_final_intent_dto_prompt_min_length_one(self):
        """``prompt`` must be at least 1 char."""
        with pytest.raises(Exception):
            FinalIntentDTO(prompt="")

    def test_final_intent_dto_prompt_max_length_2000(self):
        """``prompt`` must be at most 2000 chars."""
        FinalIntentDTO(prompt="a" * 2000)  # boundary OK
        with pytest.raises(Exception):
            FinalIntentDTO(prompt="a" * 2001)

    def test_final_intent_dto_optional_settings_diff_default_none(self):
        """``settings_diff`` defaults to None."""
        dto = FinalIntentDTO(prompt="x")
        assert dto.settings_diff is None

    def test_final_intent_dto_optional_model_id_default_none(self):
        """``model_id`` defaults to None."""
        dto = FinalIntentDTO(prompt="x")
        assert dto.model_id is None

    def test_final_intent_dto_serialises_for_wire(self):
        """``model_dump`` produces a JSON-friendly dict."""
        dto = FinalIntentDTO(
            prompt="A coral reef, vibrant",
            settings_diff=None,
            model_id="flux-2-pro",
        )
        dump = dto.model_dump(mode="json")
        assert dump["prompt"] == "A coral reef, vibrant"
        assert dump["model_id"] == "flux-2-pro"
        # settings_diff key is always present (Optional, default None)
        assert "settings_diff" in dump


# ---------------------------------------------------------------------------
# AC-2: Defaults — SessionStateDTO() must be constructible
# ---------------------------------------------------------------------------


class TestSessionStateDtoDefaults:
    """AC-2: Calling ``SessionStateDTO()`` (no kwargs) must succeed and yield
    the legacy-compatible defaults (``flow_state="idle"``, ``intent_axes={}``,
    ``final_intent=None``).
    """

    def test_defaults_no_raise(self):
        """AC-2: instantiation without args does not raise."""
        SessionStateDTO()  # must not raise

    def test_defaults_match_default_state_values(self):
        """AC-2: defaults match ``DEFAULT_STATE_VALUES`` shape."""
        from app.agent.state import DEFAULT_STATE_VALUES

        dto = SessionStateDTO()
        assert dto.flow_state == DEFAULT_STATE_VALUES["flow_state"]
        assert dto.intent_axes == DEFAULT_STATE_VALUES["intent_axes"]
        # Both DTO default and DEFAULT_STATE_VALUES default are None.
        assert dto.final_intent is None
        assert DEFAULT_STATE_VALUES["final_intent"] is None


# ---------------------------------------------------------------------------
# AC-1: SessionDetailResponse exposes the full state including FSM mirror
# ---------------------------------------------------------------------------


class TestSessionDetailResponseSchema:
    """AC-1: Wire schema verifies the response carries the FSM mirror."""

    def test_session_detail_response_state_carries_fsm_fields(self):
        """End-to-end: a constructed SessionDetailResponse exposes
        ``flow_state`` / ``intent_axes`` / ``final_intent`` on the wire."""
        from datetime import datetime
        from uuid import uuid4

        session = SessionResponse(
            id=uuid4(),
            project_id=uuid4(),
            title="Test",
            status="active",
            message_count=0,
            has_draft=False,
            last_message_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        state = SessionStateDTO(
            flow_state="summarizing",
            intent_axes={"subject": "moody library"},
            final_intent=FinalIntentDTO(prompt="moody library scene"),
        )
        response = SessionDetailResponse(session=session, state=state)
        wire = response.model_dump(mode="json")
        assert wire["state"]["flow_state"] == "summarizing"
        assert wire["state"]["intent_axes"] == {"subject": "moody library"}
        assert wire["state"]["final_intent"]["prompt"] == "moody library scene"
