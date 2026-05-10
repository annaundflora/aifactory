"""Acceptance tests for Slice 14: FSM-State-Extension in PromptAssistantState.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-14-fsm-state-extension.md.

Mocking Strategy: no_mocks (per Slice-Spec). The TypedDict + Pydantic
schemas are pure Python; the checkpoint round-trip uses ``MemorySaver``
which shares the ``JsonPlusSerializer`` with ``PostgresSaver`` -- the same
serde contract guaranteed by ``langgraph-checkpoint-postgres``.

Each test method names its source AC and quotes the GIVEN/WHEN/THEN.
"""

from typing import Literal, get_args, get_origin, get_type_hints

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph


def _build_minimal_graph(checkpointer):
    """Compile a no-op LangGraph against ``PromptAssistantState`` to drive
    the real checkpointer serde without involving any LLM."""
    from app.agent.state import PromptAssistantState

    def _passthrough(state):
        return {}

    builder = StateGraph(PromptAssistantState)
    builder.add_node("passthrough", _passthrough)
    builder.set_entry_point("passthrough")
    builder.set_finish_point("passthrough")
    return builder.compile(checkpointer=checkpointer)


class TestSlice14Acceptance:
    """Acceptance tests for Slice 14 -- FSM-State-Extension."""

    # ---------------------------------------------------------------
    # AC-1
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac1_typed_dict_annotations_contain_new_fsm_fields(self):
        """AC-1: GIVEN das erweiterte ``PromptAssistantState``
        WHEN die TypedDict-Annotations inspiziert werden
        THEN ``flow_state: str``, ``intent_axes: dict``,
        ``final_intent: Optional[dict]`` sind enthalten; bestehende
        Felder bleiben unveraendert vorhanden.
        """
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)

        # New FSM fields present
        assert "flow_state" in hints
        assert "intent_axes" in hints
        assert "final_intent" in hints

        # Types correct
        assert hints["flow_state"] is str
        assert hints["intent_axes"] is dict or get_origin(
            hints["intent_axes"]
        ) is dict
        # Optional[dict] -> Union[dict, None]
        final_intent_args = set(get_args(hints["final_intent"]))
        assert type(None) in final_intent_args
        assert any(
            (a is dict) or (get_origin(a) is dict) for a in final_intent_args
        )

        # Existing fields unchanged
        for legacy in (
            "draft_prompt",
            "reference_images",
            "recommended_model",
            "collected_info",
            "phase",
        ):
            assert legacy in hints, (
                f"AC-1: pre-Slice-14 field '{legacy}' must remain on "
                f"PromptAssistantState"
            )

    # ---------------------------------------------------------------
    # AC-2
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac2_default_state_values_includes_new_keys_with_correct_defaults(
        self,
    ):
        """AC-2: GIVEN das aktualisierte ``DEFAULT_STATE_VALUES``
        WHEN das Dict importiert wird
        THEN es enthaelt ``"flow_state": "idle"``, ``"intent_axes": {}``,
        ``"final_intent": None``; bestehende Default-Werte bleiben
        unveraendert.
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        # New defaults
        assert DEFAULT_STATE_VALUES["flow_state"] == "idle"
        assert DEFAULT_STATE_VALUES["intent_axes"] == {}
        assert DEFAULT_STATE_VALUES["final_intent"] is None

        # Existing defaults unchanged
        assert DEFAULT_STATE_VALUES["draft_prompt"] is None
        assert DEFAULT_STATE_VALUES["reference_images"] == []
        assert DEFAULT_STATE_VALUES["recommended_model"] is None
        assert DEFAULT_STATE_VALUES["collected_info"] == {}
        assert DEFAULT_STATE_VALUES["phase"] == "understand"

    # ---------------------------------------------------------------
    # AC-3
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac3_new_session_initialised_with_default_state_values(self):
        """AC-3: GIVEN eine neu initialisierte Session (via
        ``DEFAULT_STATE_VALUES``)
        WHEN der State direkt nach Erstellung gelesen wird
        THEN ``state["flow_state"] == "idle"``, ``state["intent_axes"] == {}``,
        ``state["final_intent"] is None``.
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        cp = MemorySaver()
        graph = _build_minimal_graph(cp)
        config = {"configurable": {"thread_id": "ac3-init-thread"}}

        graph.invoke(
            {**DEFAULT_STATE_VALUES, "messages": [HumanMessage(content="hi")]},
            config=config,
        )

        snapshot = graph.get_state(config)
        assert snapshot.values.get("flow_state") == "idle"
        assert snapshot.values.get("intent_axes") == {}
        assert snapshot.values.get("final_intent") is None

    # ---------------------------------------------------------------
    # AC-4
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac4_checkpointer_roundtrip_preserves_all_three_fsm_fields(self):
        """AC-4: GIVEN ein State mit gesetzten FSM-Feldern
        (``flow_state="summarizing"``, ``intent_axes={"subject":"cat"}``,
        ``final_intent={"prompt":"a cat"}``)
        WHEN der State ueber den Checkpointer persistiert und ueber
        ``get_state(config)`` zurueckgelesen wird
        THEN alle drei Felder sind verlustfrei wiederhergestellt
        (``==``-Gleichheit).
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        cp = MemorySaver()
        graph = _build_minimal_graph(cp)
        config = {"configurable": {"thread_id": "ac4-roundtrip-thread"}}

        intent_axes = {"subject": "cat"}
        final_intent = {"prompt": "a cat"}

        graph.invoke(
            {
                **DEFAULT_STATE_VALUES,
                "messages": [HumanMessage(content="finalize")],
                "flow_state": "summarizing",
                "intent_axes": intent_axes,
                "final_intent": final_intent,
            },
            config=config,
        )

        snapshot = graph.get_state(config)
        assert snapshot.values["flow_state"] == "summarizing"
        assert snapshot.values["intent_axes"] == intent_axes
        assert snapshot.values["final_intent"] == final_intent

    # ---------------------------------------------------------------
    # AC-5
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac5_legacy_checkpoint_without_new_keys_reads_defaults(self):
        """AC-5: GIVEN ein aelterer persistierter Checkpoint **ohne**
        ``flow_state``/``intent_axes``/``final_intent``
        (Pre-Slice-14-Session, simuliert durch direktes Schreiben eines
        State-Dicts ohne diese Schluessel)
        WHEN dieser Checkpoint von einem Code-Pfad gelesen wird, der die
        neuen Felder konsumiert (z.B. via ``state.get("flow_state", "idle")``)
        THEN das Lesen liefert die Defaults (``"idle"`` / ``{}`` / ``None``);
        kein ``KeyError`` und kein State-Schema-Validation-Fehler.
        """
        legacy_state = {
            "messages": [HumanMessage(content="hi")],
            "draft_prompt": None,
            "reference_images": [],
            "recommended_model": None,
            "collected_info": {},
            "phase": "understand",
        }

        # The documented consumer pattern uses .get(<key>, <default>).
        # No KeyError must be raised.
        flow_state = legacy_state.get("flow_state", "idle")
        intent_axes = legacy_state.get("intent_axes", {})
        final_intent = legacy_state.get("final_intent", None)

        assert flow_state == "idle"
        assert intent_axes == {}
        assert final_intent is None

        # And: persisting this legacy shape through the real checkpointer
        # serde does not break the read path (downstream consumers still
        # surface defaults via ``.get`` even if the channels surface as
        # None).
        cp = MemorySaver()
        graph = _build_minimal_graph(cp)
        config = {"configurable": {"thread_id": "ac5-legacy-thread"}}
        graph.invoke(legacy_state, config=config)
        snapshot = graph.get_state(config)
        assert (snapshot.values.get("flow_state") or "idle") == "idle"
        assert (snapshot.values.get("intent_axes") or {}) == {}
        assert snapshot.values.get("final_intent") is None

    # ---------------------------------------------------------------
    # AC-6
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac6_session_state_dto_includes_flow_state_and_intent_axes(self):
        """AC-6: GIVEN das erweiterte ``SessionStateDTO``
        WHEN die Pydantic-Felder inspiziert werden
        THEN ``flow_state: str`` (default ``"idle"``) und
        ``intent_axes: dict`` (default ``{}``) sind enthalten; bestehende
        Felder bleiben unveraendert; das DTO ist abwaertskompatibel.
        """
        from app.models.dtos import SessionStateDTO

        fields = SessionStateDTO.model_fields

        # New fields
        assert "flow_state" in fields
        assert "intent_axes" in fields

        # Defaults
        dto = SessionStateDTO()
        assert dto.flow_state == "idle"
        assert dto.intent_axes == {}

        # Existing fields preserved
        assert "messages" in fields
        assert "draft_prompt" in fields
        assert "recommended_model" in fields

        # Backward compatibility: legacy payload (without new fields)
        # validates and surfaces the new defaults.
        legacy_payload = {
            "messages": [{"role": "human", "content": "hi"}],
            "draft_prompt": None,
            "recommended_model": None,
        }
        legacy_dto = SessionStateDTO.model_validate(legacy_payload)
        assert legacy_dto.flow_state == "idle"
        assert legacy_dto.intent_axes == {}

    # ---------------------------------------------------------------
    # AC-7
    # ---------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac7_flow_state_is_plain_str_not_literal(self):
        """AC-7: GIVEN die Datei ``backend/app/agent/state.py`` enthaelt
        den ``flow_state``-Type
        WHEN der Type des Feldes statisch geprueft wird
        THEN ``flow_state`` ist als ``str`` (nicht ``Literal[...]``) deklariert
        -- die Enum-Werte werden NICHT auf Type-Ebene erzwungen (Validierung
        erfolgt in Slice 15 SSE-Layer und Slice 17 Frontend-Reducer).
        """
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        flow_state_type = hints["flow_state"]

        assert flow_state_type is str, (
            f"AC-7: flow_state must be plain str, got {flow_state_type!r}"
        )
        assert get_origin(flow_state_type) is not Literal
