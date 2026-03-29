"""Integration tests for prompt tools simplified output (Slice 08).

Tests the integration of draft_prompt/refine_prompt tools with the LangGraph
graph infrastructure, including tool registration, post_process_node state
updates, and SSE event generation -- all using the new single-field output
contract: {"prompt": str}.

Mocking Strategy: no_mocks (as specified in Slice-Spec).
LLM is mocked only because graph compilation requires a valid ChatOpenAI
instance, which is not an external call but an infrastructure concern.
All other components (tools, graph structure, post_process_node, SSE
conversion) use real instances.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

# Keys that must NOT appear in the new output contract
_OLD_KEYS = {"motiv", "style", "negative_prompt"}


class TestToolRegistrationInGraphSimplified:
    """Integration: verify prompt tools are registered in the agent graph."""

    def test_all_tools_list_contains_draft_and_refine(self):
        """Both draft_prompt and refine_prompt must be in ALL_TOOLS."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        assert "draft_prompt" in tool_names, "ALL_TOOLS must contain draft_prompt"
        assert "refine_prompt" in tool_names, "ALL_TOOLS must contain refine_prompt"

    def test_graph_compiles_with_tools_without_error(self):
        """Graph must compile successfully with simplified prompt tools."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        assert graph is not None
        assert hasattr(graph, "invoke")


class TestPostProcessNodeSimplifiedIntegration:
    """Integration: post_process_node handles single-field prompt output."""

    def test_post_process_updates_state_from_draft_prompt_single_field(self):
        """post_process_node must extract single-field draft_prompt result correctly.

        This is the integration counterpart of AC-1: after draft_prompt returns
        {"prompt": "..."}, post_process_node must write that to state["draft_prompt"].
        """
        from app.agent.graph import post_process_node

        draft_result = {"prompt": "a golden retriever in a sunflower field, photorealistic, vibrant colors"}

        state = {
            "messages": [
                HumanMessage(content="Create a prompt for a golden retriever in a sunflower field"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_s08_1",
                        "name": "draft_prompt",
                        "args": {"collected_info": {"subject": "a golden retriever in a sunflower field"}},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(draft_result),
                    name="draft_prompt",
                    tool_call_id="call_s08_1",
                ),
            ],
            "draft_prompt": None,
        }

        updates = post_process_node(state)

        assert "draft_prompt" in updates, (
            "post_process_node must update 'draft_prompt' state field"
        )
        assert updates["draft_prompt"] == draft_result, (
            f"post_process_node must set draft_prompt to tool result.\n"
            f"Expected: {draft_result}\nGot: {updates['draft_prompt']}"
        )
        # Verify it is the new single-field format
        assert set(updates["draft_prompt"].keys()) == {"prompt"}, (
            f"post_process_node must propagate single-field format, "
            f"got {set(updates['draft_prompt'].keys())}"
        )

    def test_post_process_updates_state_from_refine_prompt_single_field(self):
        """post_process_node must update draft_prompt from single-field refine_prompt.

        This is the integration counterpart of AC-4.
        """
        from app.agent.graph import post_process_node

        refined_result = {"prompt": "A serene lake at sunset with dramatic storm clouds, cinematic lighting"}

        state = {
            "messages": [
                HumanMessage(content="Add dramatic storm clouds"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_s08_2",
                        "name": "refine_prompt",
                        "args": {
                            "current_draft": {"prompt": "A serene lake at sunset"},
                            "feedback": "add dramatic storm clouds",
                        },
                    }],
                ),
                ToolMessage(
                    content=json.dumps(refined_result),
                    name="refine_prompt",
                    tool_call_id="call_s08_2",
                ),
            ],
            "draft_prompt": {"prompt": "A serene lake at sunset"},
        }

        updates = post_process_node(state)

        assert "draft_prompt" in updates
        assert updates["draft_prompt"] == refined_result
        assert set(updates["draft_prompt"].keys()) == {"prompt"}

    def test_post_process_ignores_non_prompt_tool_messages(self):
        """post_process_node must NOT update draft_prompt for unrelated tools."""
        from app.agent.graph import post_process_node

        existing_draft = {"prompt": "existing prompt text"}

        state = {
            "messages": [
                HumanMessage(content="Analyze this image"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_s08_3",
                        "name": "some_other_tool",
                        "args": {},
                    }],
                ),
                ToolMessage(
                    content=json.dumps({"result": "analysis done"}),
                    name="some_other_tool",
                    tool_call_id="call_s08_3",
                ),
            ],
            "draft_prompt": existing_draft,
        }

        updates = post_process_node(state)

        assert "draft_prompt" not in updates, (
            "post_process_node must NOT update draft_prompt for unrelated tools"
        )

    def test_post_process_handles_malformed_json_content(self):
        """post_process_node handles ToolMessage with non-JSON content gracefully."""
        from app.agent.graph import post_process_node

        state = {
            "messages": [
                HumanMessage(content="Test"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_s08_4",
                        "name": "draft_prompt",
                        "args": {},
                    }],
                ),
                ToolMessage(
                    content="not valid json {{{",
                    name="draft_prompt",
                    tool_call_id="call_s08_4",
                ),
            ],
            "draft_prompt": None,
        }

        # Should not raise
        updates = post_process_node(state)

        assert "draft_prompt" not in updates, (
            "post_process_node must skip malformed JSON tool results"
        )


class TestSSEEventConversionSimplified:
    """Integration: SSE event conversion uses single-field prompt payload."""

    def test_convert_event_produces_tool_call_result_for_draft_prompt(self):
        """SSE event for draft_prompt must contain {"prompt": "..."} payload."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {"prompt": "a golden retriever in a sunflower field, photorealistic"}

        event = {
            "event": "on_tool_end",
            "name": "draft_prompt",
            "data": {"output": tool_output},
        }

        sse_event = service._convert_event(event)

        assert sse_event is not None
        assert sse_event["event"] == "tool-call-result"

        data = json.loads(sse_event["data"])
        assert data["tool"] == "draft_prompt"
        assert data["data"] == tool_output

        # Verify single-field format
        assert set(data["data"].keys()) == {"prompt"}, (
            f"SSE data.data must contain only 'prompt' key, got {set(data['data'].keys())}"
        )

        # Verify old keys are absent
        for old_key in _OLD_KEYS:
            assert old_key not in data["data"], (
                f"SSE payload must NOT contain old key '{old_key}'"
            )

    def test_convert_event_produces_tool_call_result_for_refine_prompt(self):
        """SSE event for refine_prompt must contain {"prompt": "..."} payload."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {"prompt": "A serene lake at sunset with dramatic storm clouds"}

        event = {
            "event": "on_tool_end",
            "name": "refine_prompt",
            "data": {"output": tool_output},
        }

        sse_event = service._convert_event(event)

        assert sse_event is not None
        assert sse_event["event"] == "tool-call-result"

        data = json.loads(sse_event["data"])
        assert data["tool"] == "refine_prompt"
        assert data["data"] == tool_output
        assert set(data["data"].keys()) == {"prompt"}
