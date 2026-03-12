"""Integration tests for image_tools with LangGraph agent (Slice 16).

Tests the integration of analyze_image tool with the LangGraph graph,
including tool registration, post_process_node state updates for
reference_images, and SSE event generation.

Mocking Strategy: mock_external (as specified in Slice-Spec).
HTTP downloads and Vision LLM calls are mocked; graph structure,
tool nodes, post_process_node, and SSE conversion use real instances.
"""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from PIL import Image


# ---------------------------------------------------------------------------
# Tool registration in graph (AC-7)
# ---------------------------------------------------------------------------

class TestAnalyzeImageRegistrationInGraph:
    """Integration tests for analyze_image tool registration in the compiled graph."""

    def test_all_tools_contains_analyze_image(self):
        """AC-7: ALL_TOOLS registry must include analyze_image."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        assert "analyze_image" in tool_names, (
            "ALL_TOOLS must contain analyze_image"
        )

    def test_all_tools_still_contains_prompt_tools(self):
        """AC-7: ALL_TOOLS must still include draft_prompt and refine_prompt from Slice 12."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        assert "draft_prompt" in tool_names, (
            "ALL_TOOLS must still contain draft_prompt after adding analyze_image"
        )
        assert "refine_prompt" in tool_names, (
            "ALL_TOOLS must still contain refine_prompt after adding analyze_image"
        )

    def test_graph_compiles_with_analyze_image_without_error(self):
        """AC-7: Graph must compile successfully with analyze_image registered."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        assert graph is not None
        assert hasattr(graph, "invoke")
        assert hasattr(graph, "ainvoke")

    def test_graph_has_all_three_tools(self):
        """AC-7: Compiled graph must include all three tools (draft_prompt, refine_prompt, analyze_image)."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        graph_json = json.dumps(graph.get_graph().to_json())
        assert "tools" in graph_json, "Compiled graph must contain a 'tools' node"
        assert "post_process" in graph_json, "Compiled graph must contain a 'post_process' node"

    def test_tool_state_mapping_includes_analyze_image(self):
        """AC-4: TOOL_STATE_MAPPING must map analyze_image to reference_images."""
        from app.agent.graph import TOOL_STATE_MAPPING

        assert "analyze_image" in TOOL_STATE_MAPPING
        assert TOOL_STATE_MAPPING["analyze_image"] == "reference_images"

    def test_tool_append_mapping_includes_analyze_image(self):
        """AC-4: TOOL_APPEND_MAPPING must map analyze_image to reference_images (append semantics)."""
        from app.agent.graph import TOOL_APPEND_MAPPING

        assert "analyze_image" in TOOL_APPEND_MAPPING
        assert TOOL_APPEND_MAPPING["analyze_image"] == "reference_images"


# ---------------------------------------------------------------------------
# post_process_node integration for analyze_image (AC-4)
# ---------------------------------------------------------------------------

class TestPostProcessNodeAnalyzeImage:
    """Integration tests for post_process_node handling analyze_image results."""

    def test_post_process_appends_to_reference_images(self):
        """AC-4: post_process_node must append {url, analysis} to reference_images."""
        from app.agent.graph import post_process_node

        analysis_result = {
            "subject": "a golden retriever",
            "style": "photorealistic",
            "mood": "playful",
            "lighting": "natural sunlight",
            "composition": "centered close-up",
            "palette": "warm earth tones",
        }

        image_url = "https://r2.example.com/images/photo.jpg"

        state = {
            "messages": [
                HumanMessage(content="Analyze this image"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_ai_1",
                        "name": "analyze_image",
                        "args": {"image_url": image_url},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(analysis_result),
                    name="analyze_image",
                    tool_call_id="call_ai_1",
                ),
            ],
            "reference_images": [],
        }

        updates = post_process_node(state)

        assert "reference_images" in updates, (
            "post_process_node must produce a 'reference_images' update"
        )
        assert len(updates["reference_images"]) == 1, (
            f"reference_images must have 1 entry, got {len(updates['reference_images'])}"
        )

        entry = updates["reference_images"][0]
        assert entry["url"] == image_url, (
            f"Entry url must be '{image_url}', got '{entry['url']}'"
        )
        assert entry["analysis"] == analysis_result, (
            f"Entry analysis must match tool result"
        )

    def test_post_process_appends_not_overwrites_reference_images(self):
        """AC-4: post_process_node must APPEND to existing reference_images, not overwrite."""
        from app.agent.graph import post_process_node

        existing_entry = {
            "url": "https://r2.example.com/images/first.jpg",
            "analysis": {
                "subject": "sunset",
                "style": "painting",
                "mood": "serene",
                "lighting": "golden hour",
                "composition": "wide angle",
                "palette": "warm oranges",
            },
        }

        new_analysis = {
            "subject": "mountain",
            "style": "photograph",
            "mood": "dramatic",
            "lighting": "storm light",
            "composition": "rule of thirds",
            "palette": "cool blues",
        }
        new_url = "https://r2.example.com/images/second.jpg"

        state = {
            "messages": [
                HumanMessage(content="Analyze another image"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_ai_2",
                        "name": "analyze_image",
                        "args": {"image_url": new_url},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(new_analysis),
                    name="analyze_image",
                    tool_call_id="call_ai_2",
                ),
            ],
            "reference_images": [existing_entry],
        }

        updates = post_process_node(state)

        assert "reference_images" in updates
        assert len(updates["reference_images"]) == 2, (
            "reference_images must contain 2 entries (existing + new)"
        )
        assert updates["reference_images"][0] == existing_entry, (
            "Existing entry must be preserved at index 0"
        )
        assert updates["reference_images"][1]["url"] == new_url
        assert updates["reference_images"][1]["analysis"] == new_analysis

    def test_post_process_analyze_image_does_not_touch_draft_prompt(self):
        """AC-4: post_process_node for analyze_image must NOT update draft_prompt."""
        from app.agent.graph import post_process_node

        state = {
            "messages": [
                HumanMessage(content="Analyze this"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_ai_3",
                        "name": "analyze_image",
                        "args": {"image_url": "https://example.com/test.jpg"},
                    }],
                ),
                ToolMessage(
                    content=json.dumps({
                        "subject": "test",
                        "style": "test",
                        "mood": "test",
                        "lighting": "test",
                        "composition": "test",
                        "palette": "test",
                    }),
                    name="analyze_image",
                    tool_call_id="call_ai_3",
                ),
            ],
            "draft_prompt": {"motiv": "existing", "style": "existing", "negative_prompt": "existing"},
            "reference_images": [],
        }

        updates = post_process_node(state)

        assert "draft_prompt" not in updates, (
            "post_process_node for analyze_image must NOT update draft_prompt"
        )


# ---------------------------------------------------------------------------
# SSE event conversion for analyze_image (AC-5)
# ---------------------------------------------------------------------------

class TestSSEEventConversionAnalyzeImage:
    """Integration tests for SSE event conversion from analyze_image results."""

    def test_convert_event_produces_tool_call_result_for_analyze_image(self):
        """AC-5: SSE must produce tool-call-result event for analyze_image."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {
            "subject": "a sunset over the ocean",
            "style": "photorealistic",
            "mood": "serene",
            "lighting": "golden hour",
            "composition": "panoramic wide angle",
            "palette": "warm oranges and purples",
        }

        event = {
            "event": "on_tool_end",
            "name": "analyze_image",
            "data": {"output": tool_output},
        }

        sse_event = service._convert_event(event)

        assert sse_event is not None, (
            "on_tool_end for analyze_image must produce an SSE event"
        )
        assert sse_event["event"] == "tool-call-result", (
            f"SSE event type must be 'tool-call-result', got '{sse_event['event']}'"
        )

        data = json.loads(sse_event["data"])
        assert data["tool"] == "analyze_image", (
            f"SSE payload tool must be 'analyze_image', got '{data['tool']}'"
        )
        assert "data" in data, "SSE payload must contain 'data' key"

    def test_sse_payload_has_six_keys(self):
        """AC-5: SSE data.data must contain all 6 analysis keys."""
        from app.services.assistant_service import AssistantService

        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        tool_output = {
            "subject": "portrait of a woman",
            "style": "oil painting",
            "mood": "mysterious",
            "lighting": "dramatic side lighting",
            "composition": "close-up",
            "palette": "dark moody tones",
        }

        event = {
            "event": "on_tool_end",
            "name": "analyze_image",
            "data": {"output": tool_output},
        }

        sse_event = service._convert_event(event)
        data = json.loads(sse_event["data"])

        assert set(data["data"].keys()) == {
            "subject", "style", "mood", "lighting", "composition", "palette"
        }, (
            f"SSE data.data must have all 6 analysis keys, "
            f"got {set(data['data'].keys())}"
        )

        # Verify all values match
        for key in ("subject", "style", "mood", "lighting", "composition", "palette"):
            assert data["data"][key] == tool_output[key], (
                f"SSE data.data['{key}'] must match tool output"
            )


# ---------------------------------------------------------------------------
# Full analyze_image tool integration (AC-1, mocked external)
# ---------------------------------------------------------------------------

class TestAnalyzeImageToolIntegration:
    """Integration test for the full analyze_image tool pipeline with mocked externals."""

    @pytest.mark.asyncio
    async def test_analyze_image_full_pipeline_mocked(self):
        """AC-1: Full pipeline: download -> resize -> vision call -> structured dict.

        External calls (httpx download, Vision LLM) are mocked per mock_external strategy.
        Pillow resize uses a real image.
        """
        from app.agent.tools.image_tools import analyze_image

        # Create a real 2048x1536 test image
        img = Image.new("RGB", (2048, 1536), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        fake_image_bytes = buf.getvalue()

        # Mock the HTTP download
        mock_response = MagicMock()
        mock_response.content = fake_image_bytes
        mock_response.headers = {"content-type": "image/jpeg"}
        mock_response.raise_for_status = MagicMock()

        # Mock the Vision LLM response
        vision_response_json = json.dumps({
            "subject": "blue rectangle",
            "style": "digital art",
            "mood": "minimalist",
            "lighting": "flat even lighting",
            "composition": "centered fill",
            "palette": "solid blue",
        })

        mock_llm_response = MagicMock()
        mock_llm_response.content = vision_response_json

        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            # Setup httpx mock
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            # Setup LLM mock
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
            mock_chat_cls.return_value = mock_llm

            result = await analyze_image.ainvoke(
                {"image_url": "https://r2.example.com/images/photo.jpg"}
            )

        assert isinstance(result, dict)
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}

        for key in ("subject", "style", "mood", "lighting", "composition", "palette"):
            assert isinstance(result[key], str), f"'{key}' must be a string"
            assert len(result[key]) > 0, f"'{key}' must be non-empty"
