"""Integration tests for model tools (Slice 20).

Tests the integration of recommend_model/get_model_info tools with
ModelService, post_process_node, and the agent graph.

Mocking Strategy: mock_external (as specified in Slice-Spec).
Replicate API calls are mocked; tools, services, graph nodes, and state
use real instances.
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, ToolMessage

from app.agent.graph import (
    ALL_TOOLS,
    TOOL_STATE_MAPPING,
    post_process_node,
)


# Sample models returned by the mocked Replicate API
MOCK_COLLECTION_RESPONSE = {
    "models": [
        {
            "owner": "black-forest-labs",
            "name": "flux-schnell",
            "description": "Fast image generation model",
            "run_count": 5000000,
            "url": "https://replicate.com/black-forest-labs/flux-schnell",
            "cover_image_url": "https://example.com/cover.jpg",
        },
        {
            "owner": "stability-ai",
            "name": "sdxl",
            "description": "Stable Diffusion XL",
            "run_count": 3000000,
            "url": "https://replicate.com/stability-ai/sdxl",
            "cover_image_url": None,
        },
        {
            "owner": "ideogram-ai",
            "name": "ideogram-v2",
            "description": "Text in images",
            "run_count": 1000000,
            "url": "https://replicate.com/ideogram-ai/ideogram-v2",
            "cover_image_url": None,
        },
    ]
}


def _make_mock_http_client(response_json: dict) -> AsyncMock:
    """Create a mock httpx.AsyncClient that returns the given JSON."""
    mock_response = MagicMock()
    mock_response.json.return_value = response_json
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


class TestRecommendModelIntegration:
    """Integration: recommend_model tool -> ModelService -> result."""

    @pytest.mark.asyncio
    async def test_recommend_model_end_to_end_with_mocked_api(self):
        """recommend_model tool calls ModelService which fetches from API and returns result."""
        from app.agent.tools.model_tools import recommend_model
        from app.services.model_service import model_service

        # Clear any cached data
        model_service.clear_cache()

        mock_client = _make_mock_http_client(MOCK_COLLECTION_RESPONSE)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await recommend_model.ainvoke({
                "prompt_summary": "photorealistic portrait of a woman",
                "style_keywords": ["photorealistic", "portrait"],
            })

        assert isinstance(result, dict)
        assert "id" in result
        assert "name" in result
        assert "reason" in result
        assert "flux" in result["id"].lower()

        # Clean up singleton cache
        model_service.clear_cache()

    @pytest.mark.asyncio
    async def test_get_model_info_end_to_end_with_mocked_api(self):
        """get_model_info tool calls ModelService.get_model_by_id and returns metadata."""
        from app.agent.tools.model_tools import get_model_info

        model_detail_response = {
            "owner": "black-forest-labs",
            "name": "flux-schnell",
            "description": "A fast image generation model",
            "run_count": 5000000,
            "url": "https://replicate.com/black-forest-labs/flux-schnell",
        }
        mock_client = _make_mock_http_client(model_detail_response)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await get_model_info.ainvoke({
                "model_id": "black-forest-labs/flux-schnell",
            })

        assert isinstance(result, dict)
        assert result["owner"] == "black-forest-labs"
        assert result["name"] == "flux-schnell"
        assert "run_count" in result
        assert isinstance(result["run_count"], int)
        assert "url" in result


class TestPostProcessNodeIntegration:
    """Integration: post_process_node with recommend_model tool results."""

    def test_post_process_sets_recommended_model_from_tool_message(self):
        """AC-5: post_process_node sets state['recommended_model'] from recommend_model result."""
        tool_result = {"id": "black-forest-labs/flux-schnell", "name": "flux-schnell",
                       "reason": "Gutes Modell fuer Fotorealismus."}

        state = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_123",
                        "name": "recommend_model",
                        "args": {"prompt_summary": "photo", "style_keywords": ["photo"]},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(tool_result),
                    tool_call_id="call_123",
                    name="recommend_model",
                ),
            ],
            "draft_prompt": None,
            "reference_images": [],
            "recommended_model": None,
            "collected_info": {},
            "phase": "understand",
        }

        updates = post_process_node(state)

        assert "recommended_model" in updates
        assert updates["recommended_model"]["id"] == "black-forest-labs/flux-schnell"
        assert updates["recommended_model"]["name"] == "flux-schnell"
        assert updates["recommended_model"]["reason"] != ""

    def test_post_process_ignores_non_recommend_model_tools(self):
        """AC-10: post_process_node does not change recommended_model for other tools."""
        tool_result = {"motiv": "a cat", "style": "realistic", "negative_prompt": "blurry"}

        state = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_456",
                        "name": "draft_prompt",
                        "args": {"subject": "a cat"},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(tool_result),
                    tool_call_id="call_456",
                    name="draft_prompt",
                ),
            ],
            "draft_prompt": None,
            "reference_images": [],
            "recommended_model": None,
            "collected_info": {},
            "phase": "understand",
        }

        updates = post_process_node(state)

        # recommended_model should NOT be in updates
        assert "recommended_model" not in updates
        # draft_prompt SHOULD be updated (it maps to draft_prompt tool)
        assert "draft_prompt" in updates

    def test_post_process_skips_error_results(self):
        """Error results from recommend_model should not update state."""
        error_result = {"error": "Modell-Daten konnten nicht geladen werden"}

        state = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_789",
                        "name": "recommend_model",
                        "args": {"prompt_summary": "photo", "style_keywords": []},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(error_result),
                    tool_call_id="call_789",
                    name="recommend_model",
                ),
            ],
            "draft_prompt": None,
            "reference_images": [],
            "recommended_model": None,
            "collected_info": {},
            "phase": "understand",
        }

        updates = post_process_node(state)

        assert "recommended_model" not in updates


class TestToolRegistration:
    """Integration: verify tools are registered in the agent graph."""

    def test_recommend_model_in_all_tools(self):
        """AC-9: recommend_model must be in ALL_TOOLS."""
        tool_names = [t.name for t in ALL_TOOLS]
        assert "recommend_model" in tool_names

    def test_get_model_info_in_all_tools(self):
        """AC-9: get_model_info must be in ALL_TOOLS."""
        tool_names = [t.name for t in ALL_TOOLS]
        assert "get_model_info" in tool_names

    def test_recommend_model_in_tool_state_mapping(self):
        """recommend_model must map to recommended_model state field."""
        assert "recommend_model" in TOOL_STATE_MAPPING
        assert TOOL_STATE_MAPPING["recommend_model"] == "recommended_model"
