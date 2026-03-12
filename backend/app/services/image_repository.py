"""Image repository for CRUD operations on the assistant_images table.

Uses psycopg3 (async) for direct SQL queries against PostgreSQL.
No ORM -- all queries are parameterized SQL.

Provides cache-lookup and save methods for image analysis results,
enabling DB-based caching of Vision LLM analysis to avoid redundant API calls.
"""

import json
import logging
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.config import settings

logger = logging.getLogger(__name__)


class ImageRepository:
    """Repository for assistant_images table operations.

    Provides save_analysis() and get_analysis_by_url() for caching
    image analysis results. Cache lookup is session-agnostic: the same
    image_url returns a cache hit regardless of which session uploaded it.
    """

    def __init__(self, database_url: Optional[str] = None):
        self._database_url = database_url or settings.database_url

    async def _get_connection(self) -> psycopg.AsyncConnection:
        """Create a new async connection with dict_row factory."""
        return await psycopg.AsyncConnection.connect(
            self._database_url,
            autocommit=True,
            row_factory=dict_row,
        )

    async def save_analysis(
        self,
        session_id: str,
        image_url: str,
        analysis_result: dict,
    ) -> None:
        """Save an image analysis result to the database.

        Creates a new entry in assistant_images with an auto-generated UUID.

        Args:
            session_id: UUID string of the session that triggered the analysis.
            image_url: Public URL of the analyzed image.
            analysis_result: Dict with 6 keys (subject, style, mood, lighting,
                             composition, palette) from the Vision LLM analysis.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO assistant_images (session_id, image_url, analysis_result)
                    VALUES (%s, %s, %s)
                    """,
                    (session_id, image_url, Jsonb(analysis_result)),
                )
        logger.info(
            "Saved image analysis for %s (session %s)",
            image_url[:80],
            session_id[:8],
        )

    async def get_analysis_by_url(self, image_url: str) -> Optional[dict]:
        """Look up a cached analysis result by image URL.

        Cache lookup is session-agnostic: if the same image_url was analyzed
        in any session, the cached result is returned.

        Args:
            image_url: Public URL of the image to look up (exact string match).

        Returns:
            The analysis_result dict if found, or None if no cache entry exists.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT analysis_result
                    FROM assistant_images
                    WHERE image_url = %s
                      AND analysis_result IS NOT NULL
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (image_url,),
                )
                row = await cur.fetchone()
                if row is None:
                    return None
                result = row["analysis_result"]
                # psycopg3 auto-deserializes JSONB to dict, but ensure it
                if isinstance(result, str):
                    result = json.loads(result)
                return result
