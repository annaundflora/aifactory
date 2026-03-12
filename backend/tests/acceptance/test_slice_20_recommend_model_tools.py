"""Acceptance tests for Slice 20: recommend_model + get_model_info Tools (Backend).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/phase-3/2026-03-11-prompt-assistant/slices/slice-20-recommend-model-tools.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
Replicate API calls are mocked; all other components (tools, services,
graph, post_process_node) use real instances.
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, ToolMessage

from app.agent.graph import ALL_TOOLS, post_process_node
from app.services.model_service import CACHE_TTL_SECONDS


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

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


class TestSlice20Acceptance:
    """Acceptance tests for Slice 20 - recommend_model + get_model_info Tools."""

    # -----------------------------------------------------------------
    # AC-1
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac1_recommend_model_returns_id_name_reason(self):
        """AC-1: GIVEN ein registriertes recommend_model Tool im LangGraph Agent
        WHEN der Agent das Tool mit prompt_intent aufruft
        (z.B. {"prompt_summary": "photorealistic portrait of a woman",
               "style_keywords": ["photorealistic", "portrait"]})
        THEN gibt das Tool ein Dict mit genau drei Keys zurueck:
        id (non-empty string, Format owner/name),
        name (non-empty string, menschenlesbarer Name),
        reason (non-empty string, 1-2 Saetze Begruendung auf Deutsch)
        """
        from app.agent.tools.model_tools import recommend_model
        from app.services.model_service import model_service

        model_service.clear_cache()
        mock_client = _make_mock_http_client(MOCK_COLLECTION_RESPONSE)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            # Act (WHEN)
            result = await recommend_model.ainvoke({
                "prompt_summary": "photorealistic portrait of a woman",
                "style_keywords": ["photorealistic", "portrait"],
            })

        # Assert (THEN)
        assert isinstance(result, dict)
        assert set(result.keys()) == {"id", "name", "reason"}, (
            f"Expected exactly keys id, name, reason but got {set(result.keys())}"
        )
        assert isinstance(result["id"], str) and len(result["id"]) > 0
        assert "/" in result["id"], "id must be in owner/name format"
        assert isinstance(result["name"], str) and len(result["name"]) > 0
        assert isinstance(result["reason"], str) and len(result["reason"]) > 0

        model_service.clear_cache()

    # -----------------------------------------------------------------
    # AC-2
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac2_model_service_fetches_from_replicate_api(self):
        """AC-2: GIVEN der ModelService wird zum ersten Mal aufgerufen
        WHEN get_available_models() ausgefuehrt wird
        THEN holt der Service die Modell-Liste via Replicate Collections API
        (https://api.replicate.com/v1/collections/text-to-image) und cached das Ergebnis
        """
        from app.services.model_service import ModelService, COLLECTIONS_API_URL

        service = ModelService()
        mock_client = _make_mock_http_client(MOCK_COLLECTION_RESPONSE)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await service.get_available_models()

        # Verify API was called with correct URL
        call_args = mock_client.get.call_args
        assert call_args[0][0] == COLLECTIONS_API_URL

        # Verify result is populated
        assert len(result) == 3
        assert result[0]["owner"] == "black-forest-labs"

        # Verify cache is set
        assert service._cache is not None
        assert len(service._cache.models) == 3

    # -----------------------------------------------------------------
    # AC-3
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac3_model_service_returns_cached_data_within_ttl(self):
        """AC-3: GIVEN der ModelService hat gecachte Daten die juenger als 1 Stunde sind
        WHEN get_available_models() erneut aufgerufen wird
        THEN wird KEIN erneuter API-Call gemacht, sondern die gecachten Daten zurueckgegeben
        """
        from app.services.model_service import ModelService, _CacheEntry

        service = ModelService()
        cached_models = [
            {"owner": "cached", "name": "model-a", "description": None, "run_count": 42,
             "url": "https://example.com", "cover_image_url": None},
        ]
        service._cache = _CacheEntry(models=cached_models, timestamp=time.time())

        # Act: call again without any mock -- if it tries to call API, it will fail
        result = await service.get_available_models()

        # Assert: returns cached data
        assert result == cached_models
        assert result[0]["owner"] == "cached"

    # -----------------------------------------------------------------
    # AC-4
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac4_model_service_refreshes_cache_after_ttl(self):
        """AC-4: GIVEN der ModelService hat gecachte Daten die aelter als 1 Stunde sind
        WHEN get_available_models() aufgerufen wird
        THEN wird ein neuer API-Call gemacht und der Cache aktualisiert
        """
        from app.services.model_service import ModelService, _CacheEntry

        service = ModelService()
        old_models = [{"owner": "old", "name": "stale", "run_count": 0}]
        service._cache = _CacheEntry(
            models=old_models,
            timestamp=time.time() - CACHE_TTL_SECONDS - 1,
        )

        fresh_response = {
            "models": [
                {"owner": "fresh", "name": "new-model", "description": "Fresh",
                 "run_count": 999, "url": "https://example.com", "cover_image_url": None},
            ]
        }
        mock_client = _make_mock_http_client(fresh_response)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await service.get_available_models()

        # Assert: new data returned, cache updated
        assert result[0]["owner"] == "fresh"
        mock_client.get.assert_called_once()
        assert service._cache.models[0]["owner"] == "fresh"

    # -----------------------------------------------------------------
    # AC-5
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac5_post_process_node_updates_recommended_model_state(self):
        """AC-5: GIVEN der Agent hat recommend_model ausgefuehrt
        WHEN der post_process_node nach dem Tools-Node laeuft
        THEN wird state['recommended_model'] auf das Tool-Ergebnis gesetzt
        (Dict mit id, name, reason)
        """
        tool_result = {
            "id": "black-forest-labs/flux-schnell",
            "name": "flux-schnell",
            "reason": "Dieses Modell eignet sich besonders gut fuer fotorealistische Bilder.",
        }

        state = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_ac5",
                        "name": "recommend_model",
                        "args": {"prompt_summary": "photo", "style_keywords": ["photo"]},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(tool_result),
                    tool_call_id="call_ac5",
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
        rm = updates["recommended_model"]
        assert rm["id"] == "black-forest-labs/flux-schnell"
        assert rm["name"] == "flux-schnell"
        assert isinstance(rm["reason"], str) and len(rm["reason"]) > 0

    # -----------------------------------------------------------------
    # AC-6
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac6_recommend_model_result_serializable_for_sse(self):
        """AC-6: GIVEN ein aktiver SSE-Stream und der Agent ruft recommend_model auf
        WHEN das Tool-Ergebnis vorliegt
        THEN wird ein SSE-Event tool-call-result mit
        data: {"tool": "recommend_model", "data": {"id": "...", "name": "...", "reason": "..."}}
        gesendet (Payload-Format gemaess architecture.md Section 'SSE Event Types')

        Note: We verify the tool result is JSON-serializable in the expected SSE payload
        format. The actual SSE streaming is handled generically by slice-04 and is not
        re-tested here.
        """
        from app.agent.tools.model_tools import recommend_model
        from app.services.model_service import model_service

        model_service.clear_cache()
        mock_client = _make_mock_http_client(MOCK_COLLECTION_RESPONSE)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await recommend_model.ainvoke({
                "prompt_summary": "portrait photo",
                "style_keywords": ["photorealistic"],
            })

        # Build the SSE payload as it would be sent
        sse_payload = {"tool": "recommend_model", "data": result}
        serialized = json.dumps(sse_payload)

        # Assert: payload is valid JSON with expected structure
        parsed = json.loads(serialized)
        assert parsed["tool"] == "recommend_model"
        assert "id" in parsed["data"]
        assert "name" in parsed["data"]
        assert "reason" in parsed["data"]

        model_service.clear_cache()

    # -----------------------------------------------------------------
    # AC-7
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac7_get_model_info_returns_model_metadata(self):
        """AC-7: GIVEN ein registriertes get_model_info Tool im LangGraph Agent
        WHEN der Agent das Tool mit model_id aufruft
        (z.B. {"model_id": "black-forest-labs/flux-schnell"})
        THEN gibt das Tool ein Dict mit Modell-Metadaten zurueck:
        owner (string), name (string), description (string oder null),
        run_count (int), url (string)
        """
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
        assert set(result.keys()) == {"owner", "name", "description", "run_count", "url"}, (
            f"Expected keys owner, name, description, run_count, url but got {set(result.keys())}"
        )
        assert isinstance(result["owner"], str) and result["owner"] == "black-forest-labs"
        assert isinstance(result["name"], str) and result["name"] == "flux-schnell"
        assert result["description"] is None or isinstance(result["description"], str)
        assert isinstance(result["run_count"], int)
        assert isinstance(result["url"], str)

    # -----------------------------------------------------------------
    # AC-8
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac8_recommend_model_handles_api_error_gracefully(self):
        """AC-8: GIVEN die Replicate API ist nicht erreichbar oder antwortet mit einem Fehler
        WHEN recommend_model aufgerufen wird
        THEN gibt das Tool eine verstaendliche Fehlermeldung zurueck (kein Crash),
        z.B. {"error": "Modell-Daten konnten nicht geladen werden"}
        """
        import httpx
        from app.agent.tools.model_tools import recommend_model
        from app.services.model_service import model_service

        model_service.clear_cache()

        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Service Unavailable", request=MagicMock(), response=mock_response
        )

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            # Act: should NOT raise, should return error dict
            result = await recommend_model.ainvoke({
                "prompt_summary": "any prompt",
                "style_keywords": ["any"],
            })

        assert isinstance(result, dict)
        assert "error" in result
        assert isinstance(result["error"], str)
        assert len(result["error"]) > 0

        model_service.clear_cache()

    # -----------------------------------------------------------------
    # AC-9
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac9_both_model_tools_registered_in_agent(self):
        """AC-9: GIVEN recommend_model und get_model_info als registrierte Tools
        WHEN der kompilierte Agent-Graph inspiziert wird
        THEN sind beide Tools im tools-Array des Agents enthalten
        und der Graph kompiliert ohne Fehler
        """
        tool_names = [t.name for t in ALL_TOOLS]

        assert "recommend_model" in tool_names, (
            f"recommend_model not found in ALL_TOOLS: {tool_names}"
        )
        assert "get_model_info" in tool_names, (
            f"get_model_info not found in ALL_TOOLS: {tool_names}"
        )

        # Verify graph compiles without error
        from app.agent.graph import create_agent
        graph = create_agent(checkpointer=None)
        assert graph is not None

    # -----------------------------------------------------------------
    # AC-10
    # -----------------------------------------------------------------
    @pytest.mark.acceptance
    def test_ac10_post_process_node_ignores_non_model_tools(self):
        """AC-10: GIVEN der post_process_node im Graph
        WHEN ein Tool ausgefuehrt wird das NICHT recommend_model ist (z.B. draft_prompt)
        THEN bleibt state['recommended_model'] unveraendert
        """
        draft_result = {"motiv": "a cat", "style": "realistic", "negative_prompt": "blurry"}

        state = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_ac10",
                        "name": "draft_prompt",
                        "args": {"subject": "a cat"},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(draft_result),
                    tool_call_id="call_ac10",
                    name="draft_prompt",
                ),
            ],
            "draft_prompt": None,
            "reference_images": [],
            "recommended_model": {"id": "existing/model", "name": "model", "reason": "already set"},
            "collected_info": {},
            "phase": "understand",
        }

        updates = post_process_node(state)

        # recommended_model should NOT be in updates (not touched)
        assert "recommended_model" not in updates
        # draft_prompt should be updated
        assert "draft_prompt" in updates
