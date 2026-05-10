"""Unit tests for Slice 14: SessionStateDTO FSM-field extension.

Tests are derived 1:1 from AC-6 of
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-14-fsm-state-extension.md.

Mocking Strategy: no_mocks (per Slice-Spec). The Pydantic-Schema is pure
Python -- no LLM, no HTTP, no DB.

Source AC:
- AC-6: SessionStateDTO has flow_state (default 'idle') + intent_axes
  (default {}) Pydantic fields. Existing fields (messages, draft_prompt,
  recommended_model) remain unchanged. Backward-compat: legacy clients
  receive the new fields with defaults when checkpoint is missing them.
"""

from typing import get_type_hints

import pytest

from app.models.dtos import (
    DraftPromptDTO,
    MessageDTO,
    ModelRecDTO,
    SessionStateDTO,
)


# ---------------------------------------------------------------------------
# AC-6: SessionStateDTO contains flow_state + intent_axes with defaults
# ---------------------------------------------------------------------------


class TestSessionStateDtoFlowState:
    """AC-6: GIVEN das erweiterte ``SessionStateDTO``
    WHEN die Pydantic-Felder inspiziert werden (``model_fields``)
    THEN ``flow_state: str`` (default ``"idle"``) und ``intent_axes: dict``
    (default ``{}``) sind enthalten.
    """

    def test_session_state_dto_includes_flow_state_field(self):
        """AC-6: ``flow_state`` is a Pydantic field on SessionStateDTO."""
        fields = SessionStateDTO.model_fields
        assert "flow_state" in fields, (
            f"SessionStateDTO must declare a 'flow_state' field; "
            f"current fields: {list(fields)}"
        )

    def test_session_state_dto_flow_state_default_is_idle(self):
        """AC-6: default value for ``flow_state`` is ``"idle"``."""
        # Default surfaces both via model_fields and via instance creation.
        fields = SessionStateDTO.model_fields
        assert fields["flow_state"].default == "idle", (
            f"SessionStateDTO.flow_state default must be 'idle', "
            f"got {fields['flow_state'].default!r}"
        )

        # And: instantiating without args yields the default.
        dto = SessionStateDTO()
        assert dto.flow_state == "idle", (
            f"Newly constructed SessionStateDTO must have flow_state='idle', "
            f"got {dto.flow_state!r}"
        )

    def test_session_state_dto_flow_state_type_is_str(self):
        """AC-6: ``flow_state`` is annotated as ``str``."""
        hints = get_type_hints(SessionStateDTO)
        assert hints["flow_state"] is str, (
            f"SessionStateDTO.flow_state must be typed str, "
            f"got {hints['flow_state']!r}"
        )

    def test_session_state_dto_flow_state_accepts_arbitrary_string(self):
        """AC-6 (smoke): SessionStateDTO accepts arbitrary FSM-string values
        without Literal-narrowing."""
        for value in (
            "idle",
            "interviewing",
            "summarizing",
            "reviewing",
            "refining",
            "generating",
        ):
            dto = SessionStateDTO(flow_state=value)
            assert dto.flow_state == value


class TestSessionStateDtoIntentAxes:
    """AC-6: ``intent_axes`` field present with empty-dict default."""

    def test_session_state_dto_includes_intent_axes_field(self):
        """AC-6: ``intent_axes`` is a Pydantic field on SessionStateDTO."""
        fields = SessionStateDTO.model_fields
        assert "intent_axes" in fields, (
            f"SessionStateDTO must declare an 'intent_axes' field; "
            f"current fields: {list(fields)}"
        )

    def test_session_state_dto_intent_axes_default_is_empty_dict(self):
        """AC-6: ``intent_axes`` default is ``{}``; no aliasing across
        instances (default_factory)."""
        # Instance-level default check (avoids relying on the default factory
        # representation in model_fields).
        dto1 = SessionStateDTO()
        dto2 = SessionStateDTO()
        assert dto1.intent_axes == {}, (
            f"intent_axes default must be {{}}, got {dto1.intent_axes!r}"
        )
        assert dto2.intent_axes == {}

        # Mutating one instance must not bleed into the other (default_factory
        # contract -- prevents shared-mutable-default bugs).
        dto1.intent_axes["subject"] = "cat"
        assert dto2.intent_axes == {}, (
            "intent_axes default must be created via default_factory; "
            f"mutation leaked across instances: dto2.intent_axes={dto2.intent_axes!r}"
        )

    def test_session_state_dto_intent_axes_type_is_dict(self):
        """AC-6: ``intent_axes`` is annotated as ``dict``."""
        hints = get_type_hints(SessionStateDTO)
        intent_axes_type = hints["intent_axes"]
        # Permit either ``dict`` or a parametrised dict (``dict[str, ...]``).
        assert intent_axes_type is dict or getattr(
            intent_axes_type, "__origin__", None
        ) is dict, (
            f"intent_axes must be typed as dict, got {intent_axes_type!r}"
        )

    def test_session_state_dto_intent_axes_accepts_typical_payload(self):
        """AC-6: a typical intent-axes payload validates without error."""
        payload = {
            "subject": "cat",
            "medium": "photography",
            "style": "cinematic",
            "lighting": "soft",
            "composition": "wide-angle",
            "palette": "warm",
        }
        dto = SessionStateDTO(intent_axes=payload)
        assert dto.intent_axes == payload


class TestSessionStateDtoExistingFieldsUnchanged:
    """AC-6 (counter-part): pre-Slice-14 fields remain present and
    backward-compatible."""

    def test_messages_field_present_with_empty_default(self):
        fields = SessionStateDTO.model_fields
        assert "messages" in fields
        dto = SessionStateDTO()
        assert dto.messages == []

    def test_draft_prompt_field_present_optional_default_none(self):
        fields = SessionStateDTO.model_fields
        assert "draft_prompt" in fields
        dto = SessionStateDTO()
        assert dto.draft_prompt is None

    def test_recommended_model_field_present_optional_default_none(self):
        fields = SessionStateDTO.model_fields
        assert "recommended_model" in fields
        dto = SessionStateDTO()
        assert dto.recommended_model is None

    def test_existing_fields_still_accept_typed_payload(self):
        """AC-6: Existing fields still validate typed payloads."""
        dto = SessionStateDTO(
            messages=[
                MessageDTO(role="human", content="hi"),
                MessageDTO(role="assistant", content="hello"),
            ],
            draft_prompt=DraftPromptDTO(prompt="a sunset over the alps"),
            recommended_model=ModelRecDTO(
                id="flux-2-pro",
                name="FLUX 2 Pro",
                reason="suits photographic outputs",
            ),
        )
        assert len(dto.messages) == 2
        assert dto.draft_prompt is not None
        assert dto.draft_prompt.prompt == "a sunset over the alps"
        assert dto.recommended_model is not None
        assert dto.recommended_model.id == "flux-2-pro"
        # New fields surface their defaults even when not passed.
        assert dto.flow_state == "idle"
        assert dto.intent_axes == {}


class TestSessionStateDtoBackwardCompatibility:
    """AC-6: ``model_validate`` of a legacy payload (without flow_state /
    intent_axes) MUST succeed and surface the new defaults."""

    def test_legacy_payload_without_new_fields_validates(self):
        """A pre-Slice-14 payload (no flow_state, no intent_axes) MUST
        validate cleanly via ``model_validate``."""
        legacy_payload = {
            "messages": [{"role": "human", "content": "hi"}],
            "draft_prompt": {"prompt": "a cat"},
            "recommended_model": None,
        }
        dto = SessionStateDTO.model_validate(legacy_payload)
        # Legacy fields preserved.
        assert len(dto.messages) == 1
        assert dto.draft_prompt is not None
        assert dto.draft_prompt.prompt == "a cat"
        # New fields surface their defaults.
        assert dto.flow_state == "idle"
        assert dto.intent_axes == {}

    def test_full_payload_with_new_fields_validates(self):
        """A new-style payload (with flow_state + intent_axes) round-trips
        through ``model_validate`` and ``model_dump`` losslessly."""
        full_payload = {
            "messages": [],
            "draft_prompt": None,
            "recommended_model": None,
            "flow_state": "summarizing",
            "intent_axes": {"subject": "cat", "style": "cinematic"},
        }
        dto = SessionStateDTO.model_validate(full_payload)
        assert dto.flow_state == "summarizing"
        assert dto.intent_axes == {"subject": "cat", "style": "cinematic"}

        dumped = dto.model_dump()
        assert dumped["flow_state"] == "summarizing"
        assert dumped["intent_axes"] == {"subject": "cat", "style": "cinematic"}
