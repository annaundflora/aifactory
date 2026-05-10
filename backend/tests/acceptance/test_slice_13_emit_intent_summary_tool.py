"""Acceptance tests for Slice 13: emit_intent_summary Agent-Tool.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-13-emit-intent-summary-tool.md.

Mocking Strategy: no_mocks (per Slice-Spec). Tool schema, LangGraph state
mapping and post_process_node are pure Python -- no LLM, no HTTP, no DB.
"""

import inspect
import json

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import BaseTool
from pydantic import BaseModel, ValidationError


class TestSlice13Acceptance:
    """Acceptance tests for Slice 13 -- emit_intent_summary tool."""

    @pytest.mark.acceptance
    def test_ac1_tool_name_and_pydantic_schema_shape(self):
        """AC-1: GIVEN das neue Tool ist in prompt_tools.py definiert
        WHEN sein name-Attribut und sein args_schema inspiziert werden
        THEN tool.name == 'emit_intent_summary'; das Pydantic-Schema enthaelt
        die Felder prompt: str (1..2000), settings_diff: SettingsDiff | None,
        model_id: str | None. Das Tool ist eine Instanz von
        langchain_core.tools.BaseTool.
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Arrange/Act: inspect the live tool object
        # Assert: name
        assert emit_intent_summary.name == "emit_intent_summary"

        # Assert: BaseTool instance
        assert isinstance(emit_intent_summary, BaseTool), (
            "emit_intent_summary must be a langchain_core.tools.BaseTool"
        )

        # Assert: args_schema is a Pydantic BaseModel subclass
        schema = emit_intent_summary.args_schema
        assert schema is not None
        assert inspect.isclass(schema) and issubclass(schema, BaseModel)

        # Assert: schema has prompt + settings_diff + model_id
        fields = schema.model_fields
        assert "prompt" in fields
        assert "settings_diff" in fields
        assert "model_id" in fields

        # Assert: prompt enforces 1..2000 chars (boundaries)
        with pytest.raises(ValidationError):
            schema(prompt="")
        with pytest.raises(ValidationError):
            schema(prompt="x" * 2001)
        schema(prompt="x")  # 1 char accepted
        schema(prompt="x" * 2000)  # 2000 chars accepted

    @pytest.mark.acceptance
    def test_ac2_valid_payload_returns_echo_dict(self):
        """AC-2: GIVEN ein gueltiger Payload {prompt, settings_diff, model_id}
        WHEN das Tool via tool.invoke(payload) aufgerufen wird
        THEN der Rueckgabewert ist ein Dict mit den Schluesseln prompt,
        settings_diff, model_id; keine Exception wird geworfen.
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Arrange (GIVEN): valid payload <= 2000 chars + valid SettingsDiff
        payload = {
            "prompt": "An astronaut riding a horse on Mars, cinematic",
            "settings_diff": {
                "slotStrengths": [
                    {"slotIndex": 0, "from": None, "to": 0.85},
                ],
            },
            "model_id": "openai/gpt-5.4",
        }

        # Act (WHEN): invoke the tool
        result = emit_intent_summary.invoke(payload)

        # Assert (THEN): dict echoing all three keys
        assert isinstance(result, dict)
        assert set(result.keys()) >= {"prompt", "settings_diff", "model_id"}
        assert result["prompt"] == payload["prompt"]
        assert result["model_id"] == "openai/gpt-5.4"
        assert result["settings_diff"] is not None

    @pytest.mark.acceptance
    def test_ac3_prompt_over_2000_chars_raises_validation_error(self):
        """AC-3: GIVEN ein Payload mit prompt = 'x' * 2001 (2001 Zeichen)
        WHEN das Tool via tool.invoke(payload) aufgerufen wird
        THEN ein pydantic.ValidationError (oder LangChain-Wrapper-Equivalent)
        wird geworfen; das Tool wird NICHT erfolgreich ausgefuehrt.
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Arrange (GIVEN): payload with 2001-char prompt
        payload = {"prompt": "x" * 2001}

        # Act + Assert (WHEN/THEN): validation error raised
        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke(payload)

    @pytest.mark.acceptance
    def test_ac4_empty_prompt_or_malformed_settings_diff_raises(self):
        """AC-4: GIVEN ein Payload mit prompt='' ODER settings_diff
        {slotStrengths:[{slotIndex:0, from:null, to:1.7}]} (to > 1.0)
        WHEN das Tool via tool.invoke(payload) aufgerufen wird
        THEN Pydantic-Validation schlaegt fehl; kein erfolgreicher
        Tool-Output.
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Branch 1 (GIVEN): empty prompt
        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke({"prompt": ""})

        # Branch 2 (GIVEN): malformed settings_diff (to > 1.0)
        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke(
                {
                    "prompt": "valid prompt",
                    "settings_diff": {
                        "slotStrengths": [
                            {"slotIndex": 0, "from": None, "to": 1.7},
                        ],
                    },
                }
            )

    @pytest.mark.acceptance
    def test_ac5_tool_registered_with_summarizing_state_mapping(self):
        """AC-5: GIVEN das Tool ist in graph.py registriert
        WHEN ALL_TOOLS und TOOL_STATE_MAPPING importiert werden
        THEN 'emit_intent_summary' ist in [t.name for t in ALL_TOOLS];
        TOOL_STATE_MAPPING['emit_intent_summary'] == 'summarizing'.
        Bestehende Tool-Registrierungen aus Slice 11/12 bleiben unveraendert.
        """
        from app.agent.graph import ALL_TOOLS, TOOL_STATE_MAPPING

        # Assert: emit_intent_summary registered
        tool_names = [t.name for t in ALL_TOOLS]
        assert "emit_intent_summary" in tool_names

        # Assert: state mapping
        assert TOOL_STATE_MAPPING.get("emit_intent_summary") == "summarizing"

        # Assert: Slice 11/12 tools unchanged
        for required in (
            "draft_prompt",
            "refine_prompt",
            "analyze_image",
            "recommend_model",
            "get_model_info",
            "web_search",
        ):
            assert required in tool_names, (
                f"Tool '{required}' from earlier slices must remain registered."
            )

    @pytest.mark.acceptance
    def test_ac6_post_process_node_sets_flow_state_and_final_intent(self):
        """AC-6: GIVEN ein simulierter LangGraph-State-Update ueber
        post_process_node (AIMessage mit tool_calls 'emit_intent_summary'
        gefolgt von ToolMessage mit Echo-Payload)
        WHEN post_process_node(state) ausgewertet wird
        THEN der Rueckgabe-Dict enthaelt flow_state='summarizing' und
        final_intent mit dem Tool-Argument-Dict ({prompt, settings_diff?,
        model_id?}).
        """
        from app.agent.graph import post_process_node

        # Arrange (GIVEN): state with AIMessage(tool_call) + ToolMessage(echo)
        args = {
            "prompt": "Final intent: a serene forest at dawn",
            "settings_diff": {
                "slotRoles": [
                    {"slotIndex": 0, "from": None, "to": "subject"},
                ],
            },
            "model_id": "flux-2-pro",
        }
        echo = {
            "prompt": args["prompt"],
            "settings_diff": args["settings_diff"],
            "model_id": args["model_id"],
        }
        state = {
            "messages": [
                HumanMessage(content="Finalize my intent"),
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "id": "call_ac6",
                            "name": "emit_intent_summary",
                            "args": args,
                        }
                    ],
                ),
                ToolMessage(
                    content=json.dumps(echo),
                    name="emit_intent_summary",
                    tool_call_id="call_ac6",
                ),
            ],
            "draft_prompt": None,
            "reference_images": [],
            "recommended_model": None,
            "collected_info": {},
            "phase": "draft",
        }

        # Act (WHEN): post_process_node runs
        updates = post_process_node(state)

        # Assert (THEN): flow_state == 'summarizing'
        assert updates.get("flow_state") == "summarizing"

        # Assert (THEN): final_intent contains the tool-call args
        assert "final_intent" in updates
        intent = updates["final_intent"]
        assert isinstance(intent, dict)
        assert intent["prompt"] == args["prompt"]
        assert intent["model_id"] == "flux-2-pro"
        assert intent.get("settings_diff") == args["settings_diff"]

    @pytest.mark.acceptance
    def test_ac7_no_generation_side_effects(self):
        """AC-7: GIVEN das Tool wurde NICHT mit Generierungs-Side-Effects
        implementiert
        WHEN der Tool-Body durchgelesen wird (statische Inspektion oder
        Code-Smoke-Test)
        THEN kein Aufruf an generateImages, kein HTTP-Request zu
        /api/generations, kein Workspace-Apply. Tool-Output ist ein reiner
        Daten-Roundtrip (Echo des Payloads + State-Side-Effect).
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Static inspection of the tool body
        func = getattr(emit_intent_summary, "func", None) or getattr(
            emit_intent_summary, "_run", None
        )
        assert func is not None
        source = inspect.getsource(func).lower()

        forbidden = [
            "generateimages",
            "/api/generations",
            "generate_images",
            "workspace_apply",
            "applyworkspace",
            "httpx.post",
            "httpx.get",
            "requests.post",
            "requests.get",
        ]
        for needle in forbidden:
            assert needle not in source, (
                f"Tool body must not contain '{needle}' (Slice-13 AC-7)"
            )

        # Smoke-test: invoking in isolation works (no external dependency)
        result = emit_intent_summary.invoke(
            {"prompt": "smoke test", "settings_diff": None, "model_id": None}
        )
        assert result["prompt"] == "smoke test"
        # Output is exactly the echo schema (no generation_id or job tokens)
        assert set(result.keys()) == {"prompt", "settings_diff", "model_id"}
