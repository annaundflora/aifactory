"""Integration tests for prompt tools with LangGraph agent (Slice 12).

Tests the integration of draft_prompt/refine_prompt tools with the LangGraph
graph, including tool registration, post_process_node state updates, and
SSE event generation via the assistant service.

Mocking Strategy: mock_external (as specified in Slice-Spec).
OpenRouter LLM calls are mocked; graph structure, tool nodes, and
post_process_node use real instances.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage


class TestToolRegistrationInGraph:
    """Integration tests for tool registration in the compiled graph."""

    def test_all_tools_list_contains_draft_and_refine(self):
        """ALL_TOOLS registry must include both prompt tools."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        assert "draft_prompt" in tool_names, (
            "ALL_TOOLS must contain draft_prompt"
        )
        assert "refine_prompt" in tool_names, (
            "ALL_TOOLS must contain refine_prompt"
        )

    def test_graph_compiles_with_tools_without_error(self):
        """Graph must compile successfully with prompt tools registered."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        assert graph is not None
        assert hasattr(graph, "invoke")
        assert hasattr(graph, "ainvoke")

    def test_graph_has_post_process_node(self):
        """Compiled graph must contain a post_process node."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        # LangGraph compiled graphs expose nodes
        graph_dict = graph.get_graph().to_json()
        graph_str = json.dumps(graph_dict)
        assert "post_process" in graph_str, (
            "Compiled graph must contain a 'post_process' node"
        )

    def test_graph_has_tools_node(self):
        """Compiled graph must contain a tools node."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        graph_dict = graph.get_graph().to_json()
        graph_str = json.dumps(graph_dict)
        assert "tools" in graph_str, (
            "Compiled graph must contain a 'tools' node"
        )


class TestPostProcessNodeIntegration:
    """Integration tests for the post_process_node with real state."""

    def test_post_process_updates_state_from_draft_prompt_tool_message(self):
        """post_process_node must extract draft_prompt result and update state."""
        from app.agent.graph import post_process_node

        draft_result = {
            "motiv": "a golden retriever in a sunlit meadow",
            "style": "photorealistic, vibrant colors",
            "negative_prompt": "blurry, low quality",
        }

        state = {
            "messages": [
                HumanMessage(content="Create a prompt for a dog photo"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_1",
                        "name": "draft_prompt",
                        "args": {"collected_info": {"subject": "golden retriever"}},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(draft_result),
                    name="draft_prompt",
                    tool_call_id="call_1",
                ),
            ],
            "draft_prompt": None,
        }

        updates = post_process_node(state)

        assert "draft_prompt" in updates, (
            "post_process_node must update 'draft_prompt' state field"
        )
        assert updates["draft_prompt"] == draft_result

    def test_post_process_updates_state_from_refine_prompt_tool_message(self):
        """post_process_node must update draft_prompt from refine_prompt results."""
        from app.agent.graph import post_process_node

        refined_result = {
            "motiv": "a golden retriever in a sunlit meadow, dramatic lighting",
            "style": "cinematic photography, warm tones",
            "negative_prompt": "blurry, cartoon",
        }

        state = {
            "messages": [
                HumanMessage(content="Add dramatic lighting"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_2",
                        "name": "refine_prompt",
                        "args": {
                            "current_draft": {
                                "motiv": "a golden retriever in a sunlit meadow",
                                "style": "photorealistic",
                                "negative_prompt": "blurry",
                            },
                            "feedback": "add dramatic lighting",
                        },
                    }],
                ),
                ToolMessage(
                    content=json.dumps(refined_result),
                    name="refine_prompt",
                    tool_call_id="call_2",
                ),
            ],
            "draft_prompt": {
                "motiv": "a golden retriever in a sunlit meadow",
                "style": "photorealistic",
                "negative_prompt": "blurry",
            },
        }

        updates = post_process_node(state)

        assert "draft_prompt" in updates
        assert updates["draft_prompt"] == refined_result

    def test_post_process_ignores_non_prompt_tool_messages(self):
        """post_process_node must NOT update draft_prompt for unrelated tools."""
        from app.agent.graph import post_process_node

        existing_draft = {
            "motiv": "existing motiv",
            "style": "existing style",
            "negative_prompt": "existing negative",
        }

        state = {
            "messages": [
                HumanMessage(content="Analyze this image"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_3",
                        "name": "some_other_tool",
                        "args": {},
                    }],
                ),
                ToolMessage(
                    content=json.dumps({"result": "analysis done"}),
                    name="some_other_tool",
                    tool_call_id="call_3",
                ),
            ],
            "draft_prompt": existing_draft,
        }

        updates = post_process_node(state)

        assert "draft_prompt" not in updates, (
            "post_process_node must NOT update draft_prompt for unrelated tools"
        )

    def test_post_process_handles_no_tool_messages(self):
        """post_process_node returns empty dict when no ToolMessages present."""
        from app.agent.graph import post_process_node

        state = {
            "messages": [
                HumanMessage(content="Hello"),
                AIMessage(content="Hi there!"),
            ],
            "draft_prompt": None,
        }

        updates = post_process_node(state)

        assert updates == {}, (
            "post_process_node must return empty dict when no ToolMessages"
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
                        "id": "call_4",
                        "name": "draft_prompt",
                        "args": {},
                    }],
                ),
                ToolMessage(
                    content="not valid json {{{",
                    name="draft_prompt",
                    tool_call_id="call_4",
                ),
            ],
            "draft_prompt": None,
        }

        # Should not raise; should skip the malformed message
        updates = post_process_node(state)

        assert "draft_prompt" not in updates, (
            "post_process_node must skip malformed JSON tool results"
        )


class TestSSEEventConversion:
    """Integration tests for SSE event conversion from tool results."""

    def test_convert_event_produces_tool_call_result_for_draft_prompt(self):
        """AssistantService._convert_event must produce tool-call-result SSE event."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {
            "motiv": "mountain landscape at sunset",
            "style": "photorealistic, vibrant",
            "negative_prompt": "blurry, low quality",
        }

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

    def test_convert_event_produces_tool_call_result_for_refine_prompt(self):
        """AssistantService._convert_event must produce tool-call-result for refine_prompt."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {
            "motiv": "refined mountain landscape",
            "style": "oil painting, warm tones",
            "negative_prompt": "cartoon, anime",
        }

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

    def test_sse_tool_call_result_payload_has_correct_format(self):
        """SSE event data must match: {"tool": "<name>", "data": {...}}."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {
            "motiv": "a cat in space",
            "style": "sci-fi illustration",
            "negative_prompt": "realistic, photograph",
        }

        event = {
            "event": "on_tool_end",
            "name": "draft_prompt",
            "data": {"output": tool_output},
        }

        sse_event = service._convert_event(event)
        data = json.loads(sse_event["data"])

        # Validate exact payload structure per architecture.md
        assert "tool" in data, "SSE payload must have 'tool' key"
        assert "data" in data, "SSE payload must have 'data' key"
        assert isinstance(data["data"], dict), "SSE data.data must be a dict"
        assert set(data["data"].keys()) == {"motiv", "style", "negative_prompt"}, (
            "SSE data.data must contain exactly motiv, style, negative_prompt"
        )
