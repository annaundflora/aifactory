"""Service for fetching and caching available image generation models from Replicate.

Uses the Replicate Collections API to get text-to-image models and caches
the results in-memory with a 1-hour TTL. Also provides single-model lookup
via the Replicate Models API.
"""

import logging
import time
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Cache configuration
CACHE_TTL_SECONDS = 3600  # 1 hour
FETCH_TIMEOUT_SECONDS = 10.0

# API endpoints
COLLECTIONS_API_URL = "https://api.replicate.com/v1/collections/text-to-image"
MODELS_API_URL = "https://api.replicate.com/v1/models"


class _CacheEntry:
    """In-memory cache entry with timestamp."""

    __slots__ = ("models", "timestamp")

    def __init__(self, models: list[dict], timestamp: float):
        self.models = models
        self.timestamp = timestamp


class ModelService:
    """Fetches available models from Replicate with 1h in-memory cache.

    Mirrors the caching pattern from the frontend CollectionModelService
    (lib/services/collection-model-service.ts).
    """

    def __init__(self) -> None:
        self._cache: Optional[_CacheEntry] = None

    def _is_cache_valid(self) -> bool:
        """Check whether the cache exists and is younger than CACHE_TTL_SECONDS."""
        if self._cache is None:
            return False
        return (time.time() - self._cache.timestamp) < CACHE_TTL_SECONDS

    async def get_available_models(self) -> list[dict]:
        """Return a list of available text-to-image models.

        Uses the Replicate Collections API with 1h in-memory caching.
        On cache hit (< 1h old), returns cached data without API call.
        On cache miss or stale cache, fetches fresh data from Replicate.

        Returns:
            List of dicts with keys: owner, name, description, run_count, url, cover_image_url.

        Raises:
            ValueError: If the API call fails or returns unexpected data.
        """
        if self._is_cache_valid():
            logger.debug("ModelService: Returning cached models (%d entries)", len(self._cache.models))
            return self._cache.models

        token = settings.replicate_api_token
        if not token:
            raise ValueError("REPLICATE_API_TOKEN ist nicht gesetzt")

        try:
            async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    COLLECTIONS_API_URL,
                    headers={"Authorization": f"Bearer {token}"},
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise ValueError(
                f"Replicate API Fehler: HTTP {e.response.status_code}"
            ) from e
        except httpx.RequestError as e:
            raise ValueError(
                f"Replicate API nicht erreichbar: {e}"
            ) from e

        data = response.json()
        raw_models = data.get("models", [])

        models: list[dict] = []
        for m in raw_models:
            models.append({
                "owner": str(m.get("owner", "")),
                "name": str(m.get("name", "")),
                "description": str(m.get("description", "")) if m.get("description") is not None else None,
                "run_count": int(m.get("run_count", 0)) if isinstance(m.get("run_count"), (int, float)) else 0,
                "url": str(m.get("url", "")),
                "cover_image_url": str(m.get("cover_image_url", "")) if m.get("cover_image_url") is not None else None,
            })

        # Update cache
        self._cache = _CacheEntry(models=models, timestamp=time.time())
        logger.info("ModelService: Fetched and cached %d models from Replicate", len(models))

        return models

    async def get_model_by_id(self, model_id: str) -> dict:
        """Fetch details for a single model from Replicate Models API.

        Args:
            model_id: Model identifier in format "owner/name".

        Returns:
            Dict with keys: owner, name, description, run_count, url.

        Raises:
            ValueError: If the model_id format is invalid or the API call fails.
        """
        if "/" not in model_id:
            raise ValueError(
                f"Ungültiges Model-ID Format: '{model_id}'. Erwartet: 'owner/name'"
            )

        token = settings.replicate_api_token
        if not token:
            raise ValueError("REPLICATE_API_TOKEN ist nicht gesetzt")

        owner, name = model_id.split("/", 1)

        try:
            async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    f"{MODELS_API_URL}/{owner}/{name}",
                    headers={"Authorization": f"Bearer {token}"},
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise ValueError(
                f"Modell '{model_id}' nicht gefunden: HTTP {e.response.status_code}"
            ) from e
        except httpx.RequestError as e:
            raise ValueError(
                f"Replicate API nicht erreichbar: {e}"
            ) from e

        data = response.json()

        return {
            "owner": str(data.get("owner", owner)),
            "name": str(data.get("name", name)),
            "description": str(data.get("description", "")) if data.get("description") is not None else None,
            "run_count": int(data.get("run_count", 0)) if isinstance(data.get("run_count"), (int, float)) else 0,
            "url": str(data.get("url", f"https://replicate.com/{owner}/{name}")),
        }

    def clear_cache(self) -> None:
        """Clear the in-memory model cache. Useful for testing."""
        self._cache = None


# Module-level singleton instance
model_service = ModelService()
