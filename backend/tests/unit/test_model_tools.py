"""Unit tests for model_tools and ModelService (Slice 20).

Tests pure logic of _match_model, _get_default_model, ModelService cache,
and tool error handling in isolation.

Mocking Strategy: mock_external (as specified in Slice-Spec).
Replicate API calls are mocked; all internal logic uses real instances.
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# _match_model tests (keyword matching logic)
# ---------------------------------------------------------------------------

class TestMatchModel:
    """Unit tests for the keyword-based matching logic."""

    SAMPLE_MODELS = [
        {"owner": "black-forest-labs", "name": "flux-schnell", "run_count": 5000000,
         "description": "Fast image generation", "url": "https://replicate.com/black-forest-labs/flux-schnell"},
        {"owner": "ideogram-ai", "name": "ideogram-v2", "run_count": 1000000,
         "description": "Text in images", "url": "https://replicate.com/ideogram-ai/ideogram-v2"},
        {"owner": "stability-ai", "name": "sdxl", "run_count": 3000000,
         "description": "Stable Diffusion XL", "url": "https://replicate.com/stability-ai/sdxl"},
    ]

    def test_photorealistic_matches_flux(self):
        """Photorealistic keywords should match Flux models."""
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "photorealistic portrait of a woman",
            ["photorealistic", "portrait"],
            self.SAMPLE_MODELS,
        )
        assert result is not None
        assert "flux" in result["id"].lower()
        assert result["name"] != ""
        assert result["reason"] != ""

    def test_anime_matches_sdxl(self):
        """Anime keywords should match SDXL/stability models."""
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "anime girl in cherry blossom garden",
            ["anime", "manga"],
            self.SAMPLE_MODELS,
        )
        assert result is not None
        # Should match stability/sdxl
        assert "sdxl" in result["id"].lower() or "stability" in result["id"].lower()

    def test_text_matches_ideogram(self):
        """Text-in-image keywords should match Ideogram models."""
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "poster with text typography",
            ["text", "typography"],
            self.SAMPLE_MODELS,
        )
        assert result is not None
        assert "ideogram" in result["id"].lower()

    def test_no_match_returns_none(self):
        """When no keywords match, _match_model returns None."""
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "something completely unrelated",
            ["unrelated"],
            self.SAMPLE_MODELS,
        )
        assert result is None

    def test_result_has_required_keys(self):
        """Matched result must have id, name, reason keys."""
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "photorealistic landscape",
            ["photorealistic"],
            self.SAMPLE_MODELS,
        )
        assert result is not None
        assert "id" in result
        assert "name" in result
        assert "reason" in result
        assert "/" in result["id"], "id must be in owner/name format"

    def test_empty_models_returns_none(self):
        """With empty model list, _match_model returns None."""
        from app.agent.tools.model_tools import _match_model

        result = _match_model("photorealistic", ["photorealistic"], [])
        assert result is None


# ---------------------------------------------------------------------------
# _get_default_model tests
# ---------------------------------------------------------------------------

class TestGetDefaultModel:
    """Unit tests for the default model fallback logic."""

    def test_returns_highest_run_count(self):
        """Default model should be the one with highest run_count."""
        from app.agent.tools.model_tools import _get_default_model

        models = [
            {"owner": "a", "name": "low", "run_count": 100},
            {"owner": "b", "name": "high", "run_count": 9999},
            {"owner": "c", "name": "mid", "run_count": 500},
        ]
        result = _get_default_model(models)
        assert result["id"] == "b/high"
        assert result["name"] == "high"
        assert result["reason"] != ""

    def test_empty_models_returns_flux_fallback(self):
        """With empty list, should return flux-schnell as hardcoded fallback."""
        from app.agent.tools.model_tools import _get_default_model

        result = _get_default_model([])
        assert "flux-schnell" in result["id"]

    def test_result_has_required_keys(self):
        """Default model result must have id, name, reason."""
        from app.agent.tools.model_tools import _get_default_model

        result = _get_default_model([{"owner": "x", "name": "y", "run_count": 1}])
        assert set(result.keys()) == {"id", "name", "reason"}


# ---------------------------------------------------------------------------
# ModelService cache tests (AC-2, AC-3, AC-4)
# ---------------------------------------------------------------------------

class TestModelServiceCache:
    """Unit tests for ModelService caching behavior."""

    MOCK_API_RESPONSE = {
        "models": [
            {"owner": "black-forest-labs", "name": "flux-schnell", "description": "Fast",
             "run_count": 5000000, "url": "https://example.com", "cover_image_url": None},
        ]
    }

    @pytest.mark.asyncio
    async def test_first_call_fetches_from_api(self):
        """AC-2: First call should hit the Replicate API."""
        from app.services.model_service import ModelService

        service = ModelService()

        mock_response = MagicMock()
        mock_response.json.return_value = self.MOCK_API_RESPONSE
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await service.get_available_models()

        assert len(result) == 1
        assert result[0]["owner"] == "black-forest-labs"
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_cached_data_within_ttl_no_api_call(self):
        """AC-3: Cached data younger than 1h should be returned without API call."""
        from app.services.model_service import ModelService, _CacheEntry

        service = ModelService()
        cached_models = [{"owner": "cached", "name": "model", "run_count": 1}]
        service._cache = _CacheEntry(models=cached_models, timestamp=time.time())

        # No mock needed - should not call API at all
        result = await service.get_available_models()

        assert result == cached_models

    @pytest.mark.asyncio
    async def test_stale_cache_triggers_new_api_call(self):
        """AC-4: Cached data older than 1h should trigger a new API call."""
        from app.services.model_service import ModelService, _CacheEntry, CACHE_TTL_SECONDS

        service = ModelService()
        old_models = [{"owner": "old", "name": "data", "run_count": 0}]
        service._cache = _CacheEntry(
            models=old_models,
            timestamp=time.time() - CACHE_TTL_SECONDS - 10,
        )

        new_api_response = {
            "models": [
                {"owner": "new", "name": "data", "description": None,
                 "run_count": 999, "url": "https://example.com", "cover_image_url": None},
            ]
        }

        mock_response = MagicMock()
        mock_response.json.return_value = new_api_response
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            result = await service.get_available_models()

        assert result[0]["owner"] == "new"
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_api_error_raises_value_error(self):
        """AC-8: API errors should raise ValueError (used by recommend_model for error handling)."""
        import httpx
        from app.services.model_service import ModelService

        service = ModelService()

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_response
        )

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.model_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.model_service.settings") as mock_settings:
            mock_settings.replicate_api_token = "test-token"

            with pytest.raises(ValueError, match="Replicate API Fehler"):
                await service.get_available_models()
