"""Unit tests for Slice 14: FSM-State Extension in PromptAssistantState.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-14-fsm-state-extension.md.

Mocking Strategy: no_mocks (per Slice-Spec). The TypedDict-Schema is pure
Python -- no LLM, no HTTP, no DB.

Source ACs:
- AC-1: PromptAssistantState.__annotations__ contains the three FSM fields.
- AC-2: DEFAULT_STATE_VALUES contains the new defaults; existing defaults
  remain unchanged.
- AC-7: flow_state is typed as plain ``str`` (NOT ``Literal[...]``).
"""

from typing import Optional, get_args, get_origin, get_type_hints

import pytest


# ---------------------------------------------------------------------------
# AC-1: PromptAssistantState annotations contain the new FSM fields
# ---------------------------------------------------------------------------


class TestPromptAssistantStateFsmAnnotations:
    """AC-1: GIVEN das erweiterte ``PromptAssistantState`` aus
    ``backend/app/agent/state.py``
    WHEN die TypedDict-Annotations inspiziert werden
    (``PromptAssistantState.__annotations__``)
    THEN ``flow_state: str``, ``intent_axes: dict``,
    ``final_intent: Optional[dict]`` sind enthalten; bestehende Felder
    (``draft_prompt``, ``reference_images``, ``recommended_model``,
    ``collected_info``, ``phase``) bleiben unveraendert vorhanden.
    """

    def test_prompt_assistant_state_has_flow_state_annotation(self):
        """AC-1: ``flow_state`` is part of the TypedDict annotations."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "flow_state" in hints, (
            "PromptAssistantState must declare a 'flow_state' field; "
            f"current annotations: {list(hints)}"
        )

    def test_prompt_assistant_state_has_intent_axes_annotation(self):
        """AC-1: ``intent_axes`` is part of the TypedDict annotations."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "intent_axes" in hints, (
            "PromptAssistantState must declare an 'intent_axes' field; "
            f"current annotations: {list(hints)}"
        )

    def test_prompt_assistant_state_has_final_intent_annotation(self):
        """AC-1: ``final_intent`` is part of the TypedDict annotations."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "final_intent" in hints, (
            "PromptAssistantState must declare a 'final_intent' field; "
            f"current annotations: {list(hints)}"
        )

    def test_flow_state_typed_as_str(self):
        """AC-1: ``flow_state`` annotation MUST be ``str``."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        flow_state_type = hints["flow_state"]
        assert flow_state_type is str, (
            f"flow_state must be typed as plain str, got {flow_state_type!r}"
        )

    def test_intent_axes_typed_as_dict(self):
        """AC-1: ``intent_axes`` annotation MUST be ``dict``."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        intent_axes_type = hints["intent_axes"]
        # Either ``dict`` directly or a parametrised dict (``dict[str, ...]``).
        origin = get_origin(intent_axes_type)
        assert intent_axes_type is dict or origin is dict, (
            f"intent_axes must be typed as dict (or dict[...]), "
            f"got {intent_axes_type!r}"
        )

    def test_final_intent_typed_as_optional_dict(self):
        """AC-1: ``final_intent`` annotation MUST be ``Optional[dict]``
        (i.e. ``dict | None``)."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        final_intent_type = hints["final_intent"]
        args = set(get_args(final_intent_type))
        # Must be a Union of dict and NoneType (Optional[dict] resolves to that).
        assert type(None) in args, (
            f"final_intent must accept None (Optional/None Union), "
            f"got {final_intent_type!r}"
        )
        # At least one of the args has dict as origin or is dict itself.
        has_dict = any(
            (a is dict) or (get_origin(a) is dict) for a in args
        )
        assert has_dict, (
            f"final_intent must accept a dict variant in its Union, "
            f"got {final_intent_type!r}"
        )


class TestPromptAssistantStateExistingFieldsUnchanged:
    """AC-1 (counter-part): existing fields remain unchanged."""

    EXISTING_FIELDS = (
        "draft_prompt",
        "reference_images",
        "recommended_model",
        "collected_info",
        "phase",
    )

    @pytest.mark.parametrize("field_name", EXISTING_FIELDS)
    def test_existing_field_present(self, field_name):
        """AC-1: Each pre-Slice-14 field must still be in annotations."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert field_name in hints, (
            f"Pre-Slice-14 field '{field_name}' must remain on "
            f"PromptAssistantState; annotations now: {list(hints)}"
        )

    def test_messages_field_still_inherited_from_agent_state(self):
        """AC-1: The 'messages' channel from AgentState must remain."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState, include_extras=True)
        assert "messages" in hints, (
            "PromptAssistantState must still expose 'messages' "
            "(inherited from AgentState)."
        )


# ---------------------------------------------------------------------------
# AC-2: DEFAULT_STATE_VALUES has new entries with correct defaults
# ---------------------------------------------------------------------------


class TestDefaultStateValuesNewKeys:
    """AC-2: GIVEN das aktualisierte ``DEFAULT_STATE_VALUES``
    WHEN das Dict importiert wird
    THEN es enthaelt ``"flow_state": "idle"``, ``"intent_axes": {}``,
    ``"final_intent": None`` zusaetzlich zu den bestehenden Defaults.
    """

    def test_default_state_values_includes_flow_state_idle(self):
        """AC-2: DEFAULT_STATE_VALUES['flow_state'] == 'idle'."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert "flow_state" in DEFAULT_STATE_VALUES, (
            f"DEFAULT_STATE_VALUES must contain 'flow_state'; "
            f"keys: {list(DEFAULT_STATE_VALUES)}"
        )
        assert DEFAULT_STATE_VALUES["flow_state"] == "idle", (
            f"DEFAULT_STATE_VALUES['flow_state'] must be 'idle', "
            f"got {DEFAULT_STATE_VALUES['flow_state']!r}"
        )

    def test_default_state_values_includes_empty_intent_axes(self):
        """AC-2: DEFAULT_STATE_VALUES['intent_axes'] == {} (empty dict)."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert "intent_axes" in DEFAULT_STATE_VALUES, (
            f"DEFAULT_STATE_VALUES must contain 'intent_axes'; "
            f"keys: {list(DEFAULT_STATE_VALUES)}"
        )
        value = DEFAULT_STATE_VALUES["intent_axes"]
        assert value == {}, (
            f"DEFAULT_STATE_VALUES['intent_axes'] must be {{}}, got {value!r}"
        )
        assert isinstance(value, dict), (
            f"DEFAULT_STATE_VALUES['intent_axes'] must be a dict instance, "
            f"got {type(value).__name__}"
        )

    def test_default_state_values_final_intent_is_none(self):
        """AC-2: DEFAULT_STATE_VALUES['final_intent'] is None."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert "final_intent" in DEFAULT_STATE_VALUES, (
            f"DEFAULT_STATE_VALUES must contain 'final_intent'; "
            f"keys: {list(DEFAULT_STATE_VALUES)}"
        )
        assert DEFAULT_STATE_VALUES["final_intent"] is None, (
            f"DEFAULT_STATE_VALUES['final_intent'] must be None, "
            f"got {DEFAULT_STATE_VALUES['final_intent']!r}"
        )


class TestDefaultStateValuesExistingDefaultsUnchanged:
    """AC-2 (counter-part): pre-Slice-14 defaults remain unchanged."""

    def test_default_draft_prompt_is_none(self):
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["draft_prompt"] is None, (
            f"DEFAULT_STATE_VALUES['draft_prompt'] must remain None, "
            f"got {DEFAULT_STATE_VALUES['draft_prompt']!r}"
        )

    def test_default_reference_images_is_empty_list(self):
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["reference_images"] == [], (
            f"DEFAULT_STATE_VALUES['reference_images'] must remain [], "
            f"got {DEFAULT_STATE_VALUES['reference_images']!r}"
        )

    def test_default_recommended_model_is_none(self):
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["recommended_model"] is None, (
            f"DEFAULT_STATE_VALUES['recommended_model'] must remain None, "
            f"got {DEFAULT_STATE_VALUES['recommended_model']!r}"
        )

    def test_default_collected_info_is_empty_dict(self):
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["collected_info"] == {}, (
            f"DEFAULT_STATE_VALUES['collected_info'] must remain {{}}, "
            f"got {DEFAULT_STATE_VALUES['collected_info']!r}"
        )

    def test_default_phase_is_understand(self):
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["phase"] == "understand", (
            f"DEFAULT_STATE_VALUES['phase'] must remain 'understand', "
            f"got {DEFAULT_STATE_VALUES['phase']!r}"
        )


# ---------------------------------------------------------------------------
# AC-7: flow_state is typed as plain str (NOT Literal[...])
# ---------------------------------------------------------------------------


class TestFlowStateNotLiteralNarrowed:
    """AC-7: GIVEN ``backend/app/agent/state.py`` enthaelt den
    ``flow_state``-Type
    WHEN der Type des Feldes statisch geprueft wird
    THEN ``flow_state`` ist als ``str`` (nicht ``Literal[...]``) deklariert --
    die Enum-Werte werden NICHT auf Type-Ebene erzwungen (Validierung
    erfolgt in Slice 15 SSE-Layer und Slice 17 Frontend-Reducer).
    """

    def test_flow_state_type_is_plain_str_not_literal(self):
        """AC-7: ``flow_state`` annotation is ``str``, not ``Literal[...]``."""
        from typing import Literal

        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        flow_state_type = hints["flow_state"]

        # Must be exactly ``str``.
        assert flow_state_type is str, (
            f"flow_state must be plain str (no Literal narrowing), "
            f"got {flow_state_type!r}"
        )

        # Defensive: ensure no Literal-like origin.
        origin = get_origin(flow_state_type)
        assert origin is not Literal, (
            f"flow_state must NOT be a Literal[...] type; "
            f"origin: {origin!r}"
        )

    def test_flow_state_accepts_arbitrary_string_in_default(self):
        """AC-7 (smoke): The default value 'idle' is a plain str without
        runtime narrowing -- a TypedDict ``str`` field accepts any string.
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        # The default must itself be a plain str (no Enum / Literal
        # narrowing leaked into runtime).
        assert isinstance(DEFAULT_STATE_VALUES["flow_state"], str)
        assert type(DEFAULT_STATE_VALUES["flow_state"]) is str
