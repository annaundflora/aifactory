"""Unit tests for Canvas Agent Graph (slice-16).

Tests the canvas_graph module: generate_image tool, graph structure,
system prompt builder, post-process node, and routing.

Mocking Strategy: mock_external (as specified in Slice-Spec).
LangGraph Agent compilation and LLM calls are mocked; pure logic tested directly.
"""

import json
from typing import get_type_hints
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, ToolMessage
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# AC-8: generate_image Tool Registration
# ---------------------------------------------------------------------------


class TestCanvasGraphToolRegistration:
    """AC-8: GIVEN der Canvas-Agent-Graph wird erstellt
    WHEN die Tool-Liste inspiziert wird
    THEN enthaelt sie generate_image als einziges Canvas-spezifisches Tool
    """

    def test_ac8_canvas_tools_contains_generate_image(self):
        """AC-8: CANVAS_TOOLS list must contain the generate_image tool."""
        from app.agent.canvas_graph import CANVAS_TOOLS

        tool_names = [t.name for t in CANVAS_TOOLS]
        assert "generate_image" in tool_names, (
            f"CANVAS_TOOLS must contain 'generate_image', got: {tool_names}"
        )

    def test_ac8_generate_image_is_only_canvas_tool(self):
        """AC-8: generate_image must be the ONLY canvas-specific tool."""
        from app.agent.canvas_graph import CANVAS_TOOLS

        tool_names = [t.name for t in CANVAS_TOOLS]
        assert tool_names == ["generate_image"], (
            f"CANVAS_TOOLS must contain exactly ['generate_image'], got: {tool_names}"
        )

    def test_ac8_generate_image_is_langchain_tool(self):
        """AC-8: generate_image must be a LangChain BaseTool (decorated with @tool)."""
        from langchain_core.tools import BaseTool

        from app.agent.canvas_graph import generate_image

        assert isinstance(generate_image, BaseTool), (
            f"generate_image must be a BaseTool instance, got {type(generate_image).__name__}"
        )

    @patch("app.agent.canvas_graph.ChatOpenAI")
    def test_ac8_compiled_graph_has_tools_node(self, mock_llm_cls):
        """AC-8: The compiled canvas agent graph must contain a 'tools' node."""
        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm_cls.return_value = mock_llm

        from app.agent.canvas_graph import create_canvas_agent

        graph = create_canvas_agent(checkpointer=None)
        # LangGraph compiled graphs expose node names
        node_names = list(graph.nodes.keys())
        assert "tools" in node_names, (
            f"Compiled graph must have a 'tools' node, found: {node_names}"
        )

    @patch("app.agent.canvas_graph.ChatOpenAI")
    def test_ac8_compiled_graph_has_assistant_node(self, mock_llm_cls):
        """AC-8: The compiled canvas agent graph must contain an 'assistant' node."""
        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm_cls.return_value = mock_llm

        from app.agent.canvas_graph import create_canvas_agent

        graph = create_canvas_agent(checkpointer=None)
        node_names = list(graph.nodes.keys())
        assert "assistant" in node_names, (
            f"Compiled graph must have an 'assistant' node, found: {node_names}"
        )


# ---------------------------------------------------------------------------
# AC-3: generate_image Tool Returns Structured Parameters
# ---------------------------------------------------------------------------


class TestGenerateImageTool:
    """AC-3: GIVEN der Agent erkennt einen Editing-Intent
    WHEN der Agent das generate_image Tool aufruft
    THEN SSE-Stream liefert ein canvas-generate Event mit
    { "action": "variation"|"img2img", "prompt": "<optimierter-prompt>",
      "model_id": "<string>", "params": {} }
    """

    def test_ac3_generate_image_returns_structured_params(self):
        """AC-3: generate_image tool returns dict with action, prompt, model_id, params."""
        from app.agent.canvas_graph import generate_image

        result = generate_image.invoke({
            "action": "variation",
            "prompt": "A beautiful sunset with enhanced blue sky",
            "model_id": "flux-2-max",
            "params": {},
        })

        assert isinstance(result, dict), (
            f"generate_image must return a dict, got {type(result).__name__}"
        )
        assert result["action"] == "variation"
        assert result["prompt"] == "A beautiful sunset with enhanced blue sky"
        assert result["model_id"] == "flux-2-max"
        assert result["params"] == {}

    def test_ac3_generate_image_img2img_action(self):
        """AC-3: generate_image with action=img2img returns correct structure."""
        from app.agent.canvas_graph import generate_image

        result = generate_image.invoke({
            "action": "img2img",
            "prompt": "More dramatic lighting",
            "model_id": "flux-1.1-pro",
            "params": {"strength": 0.7},
        })

        assert result["action"] == "img2img"
        assert result["model_id"] == "flux-1.1-pro"
        assert result["params"] == {"strength": 0.7}

    def test_ac3_generate_image_normalizes_invalid_action(self):
        """AC-3: Invalid action values are normalized to 'variation'."""
        from app.agent.canvas_graph import generate_image

        result = generate_image.invoke({
            "action": "invalid_action",
            "prompt": "test",
            "model_id": "flux-2-max",
            "params": {},
        })

        assert result["action"] == "variation", (
            f"Invalid action should be normalized to 'variation', got: {result['action']}"
        )

    def test_ac3_generate_image_rejects_non_dict_params(self):
        """AC-3: Non-dict params are rejected by Pydantic validation at schema level."""
        from pydantic import ValidationError as PydanticValidationError

        from app.agent.canvas_graph import generate_image

        with pytest.raises((PydanticValidationError, ValidationError)):
            generate_image.invoke({
                "action": "variation",
                "prompt": "test",
                "model_id": "flux-2-max",
                "params": "not-a-dict",
            })


# ---------------------------------------------------------------------------
# AC-9: System Prompt Contains Image Context
# ---------------------------------------------------------------------------


class TestCanvasSystemPrompt:
    """AC-9: GIVEN POST .../messages mit image_context
    WHEN der Agent-System-Prompt erstellt wird
    THEN enthaelt der System-Prompt den Bild-Kontext (image_url, prompt, model_id)
    als Editing-Kontext
    """

    def test_ac9_system_prompt_includes_image_url(self):
        """AC-9: System prompt must contain image_url from image_context."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": "A sunset over the ocean",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt = build_canvas_system_prompt(image_context)
        assert "https://example.com/img.png" in prompt, (
            "System prompt must contain the image_url"
        )

    def test_ac9_system_prompt_includes_original_prompt(self):
        """AC-9: System prompt must contain the original prompt from image_context."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": "A sunset over the ocean",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt = build_canvas_system_prompt(image_context)
        assert "A sunset over the ocean" in prompt, (
            "System prompt must contain the original prompt"
        )

    def test_ac9_system_prompt_includes_model_id(self):
        """AC-9: System prompt must contain the model_id from image_context."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": "A sunset over the ocean",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt = build_canvas_system_prompt(image_context)
        assert "flux-2-max" in prompt, (
            "System prompt must contain the model_id"
        )

    def test_system_prompt_mentions_visual_capability(self):
        """System prompt must tell the agent it can see the image."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        prompt = build_canvas_system_prompt(None)
        assert "SEHEN" in prompt or "sehen" in prompt, (
            "Base system prompt must mention visual capability"
        )

    def test_system_prompt_with_context_has_visual_feedback_section(self):
        """System prompt with image_context must contain VISUELLES FEEDBACK section."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": "A sunset",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt = build_canvas_system_prompt(image_context)
        assert "VISUELLES FEEDBACK" in prompt, (
            "System prompt with image_context must contain 'VISUELLES FEEDBACK' section"
        )

    def test_ac9_system_prompt_without_context_has_base_prompt(self):
        """AC-9: System prompt without image_context still has base instructions."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        prompt = build_canvas_system_prompt(None)
        assert "Bild-Bearbeitungs-Assistent" in prompt, (
            "Base system prompt must mention Bild-Bearbeitungs-Assistent role"
        )
        # Must not contain context section
        assert "AKTUELLES BILD" not in prompt, (
            "System prompt without image_context must not contain 'AKTUELLES BILD' section"
        )

    def test_ac9_system_prompt_with_context_has_editing_section(self):
        """AC-9: System prompt with image_context includes AKTUELLES BILD section."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": "A sunset",
            "model_id": "flux-2-max",
            "model_params": {"steps": 30},
        }

        prompt = build_canvas_system_prompt(image_context)
        assert "AKTUELLES BILD" in prompt, (
            "System prompt with image_context must contain 'AKTUELLES BILD' section"
        )

    def test_ac9_system_prompt_truncates_long_prompt(self):
        """AC-9: System prompt truncates overly long prompt to max 2000 chars."""
        from app.agent.canvas_graph import build_canvas_system_prompt

        long_prompt = "x" * 3000
        image_context = {
            "image_url": "https://example.com/img.png",
            "prompt": long_prompt,
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt = build_canvas_system_prompt(image_context)
        # The full 3000-char prompt should NOT appear
        assert long_prompt not in prompt, (
            "System prompt must truncate prompts longer than 2000 characters"
        )


# ---------------------------------------------------------------------------
# Canvas Agent State
# ---------------------------------------------------------------------------


class TestCanvasAgentState:
    """Tests for CanvasAgentState TypedDict structure."""

    def test_state_has_messages_field(self):
        """CanvasAgentState must have a 'messages' field from AgentState."""
        from app.agent.canvas_graph import CanvasAgentState

        hints = get_type_hints(CanvasAgentState, include_extras=True)
        assert "messages" in hints, (
            "CanvasAgentState must have 'messages' field"
        )

    def test_state_has_image_context_field(self):
        """CanvasAgentState must have an 'image_context' field."""
        from app.agent.canvas_graph import CanvasAgentState

        hints = get_type_hints(CanvasAgentState)
        assert "image_context" in hints, (
            "CanvasAgentState must have 'image_context' field"
        )

    def test_state_has_generate_params_field(self):
        """CanvasAgentState must have a 'generate_params' field."""
        from app.agent.canvas_graph import CanvasAgentState

        hints = get_type_hints(CanvasAgentState)
        assert "generate_params" in hints, (
            "CanvasAgentState must have 'generate_params' field"
        )


# ---------------------------------------------------------------------------
# Post-Process Node
# ---------------------------------------------------------------------------


class TestCanvasPostProcessNode:
    """Tests for canvas_post_process_node state updates."""

    def test_post_process_updates_generate_params_from_tool_message(self):
        """Post-process node must extract generate_params from ToolMessage."""
        from app.agent.canvas_graph import canvas_post_process_node

        tool_result = {
            "action": "variation",
            "prompt": "Enhanced sunset",
            "model_id": "flux-2-max",
            "params": {},
        }
        tool_msg = ToolMessage(
            content=json.dumps(tool_result),
            name="generate_image",
            tool_call_id="test-call-1",
        )
        state = {"messages": [tool_msg]}

        updates = canvas_post_process_node(state)
        assert "generate_params" in updates, (
            "Post-process must update 'generate_params' from generate_image result"
        )
        assert updates["generate_params"]["action"] == "variation"

    def test_post_process_ignores_non_tool_messages(self):
        """Post-process node returns empty dict when no ToolMessages at end."""
        from app.agent.canvas_graph import canvas_post_process_node

        ai_msg = AIMessage(content="Hello")
        state = {"messages": [ai_msg]}

        updates = canvas_post_process_node(state)
        assert updates == {}, (
            "Post-process must return empty dict when last message is not a ToolMessage"
        )

    def test_post_process_skips_error_only_results(self):
        """Post-process node skips tool results that contain only an error key."""
        from app.agent.canvas_graph import canvas_post_process_node

        tool_msg = ToolMessage(
            content=json.dumps({"error": "something failed"}),
            name="generate_image",
            tool_call_id="test-call-err",
        )
        state = {"messages": [tool_msg]}

        updates = canvas_post_process_node(state)
        assert "generate_params" not in updates, (
            "Post-process must skip error-only tool results"
        )


# ---------------------------------------------------------------------------
# Routing Logic
# ---------------------------------------------------------------------------


class TestCanvasRoutingLogic:
    """Tests for _canvas_should_continue routing function."""

    def test_routes_to_tools_when_ai_has_tool_calls(self):
        """Must route to 'tools' when last message is AIMessage with tool_calls."""
        from app.agent.canvas_graph import _canvas_should_continue

        ai_msg = AIMessage(
            content="Let me edit that for you",
            tool_calls=[{"id": "call-1", "name": "generate_image", "args": {}}],
        )
        state = {"messages": [ai_msg]}
        result = _canvas_should_continue(state)
        assert result == "tools"

    def test_routes_to_end_when_no_tool_calls(self):
        """Must route to END when last message has no tool_calls."""
        from langgraph.graph import END

        from app.agent.canvas_graph import _canvas_should_continue

        ai_msg = AIMessage(content="Here is my text response")
        state = {"messages": [ai_msg]}
        result = _canvas_should_continue(state)
        assert result == END

    def test_routes_to_end_when_no_messages(self):
        """Must route to END when messages list is empty."""
        from langgraph.graph import END

        from app.agent.canvas_graph import _canvas_should_continue

        state = {"messages": []}
        result = _canvas_should_continue(state)
        assert result == END
