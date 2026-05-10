"""Integration tests for emit_intent_summary in the LangGraph agent (Slice 13).

Tests tool registration in ALL_TOOLS, TOOL_STATE_MAPPING entry, the
post_process_node behaviour for emit_intent_summary (sets flow_state to
'summarizing' and persists final_intent payload), and that pre-existing
tools from Slices 11/12 stay registered.

Mocking Strategy: no_mocks (per Slice-Spec). The tool, the registry and
post_process_node are pure Python -- no LLM, no HTTP, no DB.

Source ACs: specs/.../slice-13-emit-intent-summary-tool.md (AC-5, AC-6).
"""

import json

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage


# ---------------------------------------------------------------------------
# AC-5: registry + state mapping
# ---------------------------------------------------------------------------


class TestEmitIntentSummaryRegistry:
    """AC-5: GIVEN das Tool ist in graph.py registriert
    WHEN ALL_TOOLS und TOOL_STATE_MAPPING importiert werden
    THEN 'emit_intent_summary' ist in [t.name for t in ALL_TOOLS] enthalten;
    TOOL_STATE_MAPPING['emit_intent_summary'] == 'summarizing'.
    Bestehende Tool-Registrierungen aus Slice 11/12 (draft_prompt,
    refine_prompt, analyze_image, recommend_model, get_model_info,
    web_search) bleiben unveraendert vorhanden.
    """

    def test_emit_intent_summary_registered_in_all_tools(self):
        """AC-5: ALL_TOOLS MUST contain emit_intent_summary."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        assert "emit_intent_summary" in tool_names, (
            f"ALL_TOOLS must register emit_intent_summary; "
            f"current tool names: {tool_names}"
        )

    def test_tool_state_mapping_contains_summarizing_entry(self):
        """AC-5: TOOL_STATE_MAPPING['emit_intent_summary'] == 'summarizing'."""
        from app.agent.graph import TOOL_STATE_MAPPING

        assert "emit_intent_summary" in TOOL_STATE_MAPPING, (
            f"TOOL_STATE_MAPPING must contain emit_intent_summary; "
            f"current keys: {list(TOOL_STATE_MAPPING)}"
        )
        assert TOOL_STATE_MAPPING["emit_intent_summary"] == "summarizing", (
            f"TOOL_STATE_MAPPING['emit_intent_summary'] must equal 'summarizing', "
            f"got {TOOL_STATE_MAPPING['emit_intent_summary']!r}"
        )

    def test_existing_tools_still_registered(self):
        """AC-5: Existing Slice 11/12 tool registrations stay intact."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        for required in (
            "draft_prompt",
            "refine_prompt",
            "analyze_image",
            "recommend_model",
            "get_model_info",
            "web_search",
        ):
            assert required in tool_names, (
                f"Tool '{required}' from Slices 11/12 must still be registered "
                f"after Slice 13 changes. Current registry: {tool_names}"
            )

    def test_existing_tool_state_mappings_unchanged(self):
        """AC-5: TOOL_STATE_MAPPING entries from earlier slices remain."""
        from app.agent.graph import TOOL_STATE_MAPPING

        # These mappings are introduced by Slices 12/16/20.
        expected = {
            "draft_prompt": "draft_prompt",
            "refine_prompt": "draft_prompt",
            "analyze_image": "reference_images",
            "recommend_model": "recommended_model",
        }
        for key, value in expected.items():
            assert TOOL_STATE_MAPPING.get(key) == value, (
                f"TOOL_STATE_MAPPING['{key}'] must remain '{value}' after "
                f"Slice 13 changes; got {TOOL_STATE_MAPPING.get(key)!r}"
            )


# ---------------------------------------------------------------------------
# AC-6: post_process_node propagates flow_state + final_intent
# ---------------------------------------------------------------------------


def _build_state_with_emit_intent_summary_call(args: dict, tool_call_id: str = "call_emit_1"):
    """Create a fake LangGraph state with an AIMessage(tool_call) +
    ToolMessage(echo) pair for emit_intent_summary."""
    echo_payload = {
        "prompt": args.get("prompt"),
        "settings_diff": args.get("settings_diff"),
        "model_id": args.get("model_id"),
    }
    return {
        "messages": [
            HumanMessage(content="Finalize my intent"),
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": tool_call_id,
                        "name": "emit_intent_summary",
                        "args": args,
                    }
                ],
            ),
            ToolMessage(
                content=json.dumps(echo_payload),
                name="emit_intent_summary",
                tool_call_id=tool_call_id,
            ),
        ],
        "draft_prompt": None,
        "reference_images": [],
        "recommended_model": None,
        "collected_info": {},
        "phase": "draft",
    }


class TestPostProcessNodeFlowStateTransition:
    """AC-6: GIVEN ein simulierter LangGraph-State-Update ueber
    post_process_node (AIMessage mit tool_calls 'emit_intent_summary'
    gefolgt von ToolMessage mit Echo-Payload)
    WHEN post_process_node(state) ausgewertet wird
    THEN der Rueckgabe-Dict enthaelt flow_state='summarizing' und
    final_intent mit dem Tool-Argument-Dict.
    """

    def test_post_process_node_sets_flow_state_summarizing_on_tool_call(self):
        """AC-6: post_process_node MUST set flow_state='summarizing' on
        emit_intent_summary tool call."""
        from app.agent.graph import post_process_node

        args = {
            "prompt": "A cat playing piano, photorealistic",
            "settings_diff": None,
            "model_id": "flux-2-pro",
        }
        state = _build_state_with_emit_intent_summary_call(args)

        updates = post_process_node(state)

        assert "flow_state" in updates, (
            f"post_process_node must produce a 'flow_state' update; "
            f"got keys: {list(updates)}"
        )
        assert updates["flow_state"] == "summarizing", (
            f"flow_state must be 'summarizing', got {updates['flow_state']!r}"
        )

    def test_post_process_node_persists_final_intent_payload(self):
        """AC-6: post_process_node MUST persist tool-call args under
        state['final_intent']."""
        from app.agent.graph import post_process_node

        args = {
            "prompt": "Wide-angle landscape, sunset over the alps",
            "settings_diff": {
                "slotStrengths": [
                    {"slotIndex": 0, "from": None, "to": 0.6},
                ],
            },
            "model_id": "openai/gpt-5.4",
        }
        state = _build_state_with_emit_intent_summary_call(args, tool_call_id="call_x42")

        updates = post_process_node(state)

        assert "final_intent" in updates, (
            f"post_process_node must produce a 'final_intent' update; "
            f"got keys: {list(updates)}"
        )
        intent = updates["final_intent"]
        assert isinstance(intent, dict), (
            f"final_intent must be a dict, got {type(intent).__name__}"
        )
        # The tool args (LLM-emitted) MUST be preserved verbatim.
        assert intent["prompt"] == args["prompt"]
        assert intent["model_id"] == "openai/gpt-5.4"
        # settings_diff payload is the raw LLM dict (not necessarily re-serialised)
        assert intent.get("settings_diff") == args["settings_diff"]

    def test_post_process_node_does_not_mutate_other_state_fields(self):
        """AC-6: emit_intent_summary post-processing MUST NOT mutate fields
        belonging to other tools (draft_prompt, reference_images, etc.).
        """
        from app.agent.graph import post_process_node

        state = _build_state_with_emit_intent_summary_call(
            {"prompt": "a sunset", "settings_diff": None, "model_id": None}
        )
        updates = post_process_node(state)

        # post_process_node returns ONLY the fields it updates.
        # It must NOT include reference_images / recommended_model overwrites.
        unrelated_keys = {"reference_images", "recommended_model", "collected_info"}
        for key in unrelated_keys:
            assert key not in updates, (
                f"post_process_node leaked update for unrelated field '{key}' "
                f"during emit_intent_summary handling: {updates}"
            )

    def test_post_process_node_no_tool_call_no_summarizing(self):
        """AC-6 (counter-test): Without an emit_intent_summary tool call the
        post_process_node MUST NOT set flow_state='summarizing'."""
        from app.agent.graph import post_process_node

        # State with a draft_prompt tool call -- not emit_intent_summary
        state = {
            "messages": [
                HumanMessage(content="Make a prompt"),
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "id": "call_dp_1",
                            "name": "draft_prompt",
                            "args": {"collected_info": {"subject": "a tree"}},
                        }
                    ],
                ),
                ToolMessage(
                    content=json.dumps({"prompt": "a tree, photorealistic"}),
                    name="draft_prompt",
                    tool_call_id="call_dp_1",
                ),
            ],
            "draft_prompt": None,
        }

        updates = post_process_node(state)

        # flow_state is NOT touched when the tool wasn't emit_intent_summary.
        assert updates.get("flow_state") != "summarizing", (
            "flow_state must only become 'summarizing' for emit_intent_summary "
            f"tool calls, got: {updates}"
        )
        # final_intent is NOT touched either
        assert "final_intent" not in updates, (
            f"final_intent must only be set for emit_intent_summary; got: {updates}"
        )
