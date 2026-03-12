"""Unit tests for ImageRepository (Slice 18: Bildanalyse DB-Caching).

Tests the ImageRepository class methods in isolation.

Mocking Strategy: mock_external (as specified in Slice-Spec).
DB calls via psycopg3 are mocked since no test DB is available.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestImageRepository:
    """Unit tests for ImageRepository save and lookup methods."""

    # AC-1: save_analysis speichert Eintrag in DB
    @pytest.mark.asyncio
    async def test_save_analysis_executes_insert_query(self):
        """AC-1: save_analysis must execute an INSERT query with session_id, image_url, and analysis_result."""
        from app.services.image_repository import ImageRepository

        mock_cursor = AsyncMock()
        mock_cursor.execute = AsyncMock()

        mock_conn = AsyncMock()
        mock_conn.cursor = MagicMock(return_value=mock_cursor)
        mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn.__aexit__ = AsyncMock(return_value=False)
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            await repo.save_analysis(
                session_id="abc-123",
                image_url="https://r2.example.com/images/photo.jpg",
                analysis_result={
                    "subject": "cat",
                    "style": "photo",
                    "mood": "calm",
                    "lighting": "natural",
                    "composition": "centered",
                    "palette": "warm",
                },
            )

        # Verify INSERT was called
        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        sql = call_args[0][0]
        params = call_args[0][1]

        assert "INSERT INTO assistant_images" in sql
        assert params[0] == "abc-123"
        assert params[1] == "https://r2.example.com/images/photo.jpg"

    # AC-2: get_analysis_by_url gibt gecachtes Ergebnis zurueck
    @pytest.mark.asyncio
    async def test_get_analysis_by_url_returns_cached_dict(self):
        """AC-2: get_analysis_by_url must return the stored analysis_result dict when a row exists."""
        from app.services.image_repository import ImageRepository

        cached_result = {
            "subject": "cat",
            "style": "photo",
            "mood": "calm",
            "lighting": "natural",
            "composition": "centered",
            "palette": "warm",
        }

        mock_cursor = AsyncMock()
        mock_cursor.execute = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value={"analysis_result": cached_result})

        mock_conn = AsyncMock()
        mock_conn.cursor = MagicMock(return_value=mock_cursor)
        mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn.__aexit__ = AsyncMock(return_value=False)
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_analysis_by_url(
                "https://r2.example.com/images/photo.jpg"
            )

        assert result is not None
        assert isinstance(result, dict)
        assert result == cached_result
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}

    # AC-2 (additional): Verify the SELECT query filters by image_url
    @pytest.mark.asyncio
    async def test_get_analysis_by_url_queries_with_exact_url(self):
        """AC-2: get_analysis_by_url must query with exact string match on image_url."""
        from app.services.image_repository import ImageRepository

        mock_cursor = AsyncMock()
        mock_cursor.execute = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=None)

        mock_conn = AsyncMock()
        mock_conn.cursor = MagicMock(return_value=mock_cursor)
        mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn.__aexit__ = AsyncMock(return_value=False)
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            await repo.get_analysis_by_url("https://r2.example.com/images/photo.jpg")

        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        sql = call_args[0][0]
        params = call_args[0][1]

        assert "WHERE image_url = %s" in sql.replace("\n", " ").replace("  ", " ")
        assert params == ("https://r2.example.com/images/photo.jpg",)

    # AC-3: get_analysis_by_url gibt None fuer unbekannte URL
    @pytest.mark.asyncio
    async def test_get_analysis_by_url_returns_none_for_unknown(self):
        """AC-3: get_analysis_by_url must return None when no row matches the URL."""
        from app.services.image_repository import ImageRepository

        mock_cursor = AsyncMock()
        mock_cursor.execute = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=None)

        mock_conn = AsyncMock()
        mock_conn.cursor = MagicMock(return_value=mock_cursor)
        mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn.__aexit__ = AsyncMock(return_value=False)
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_analysis_by_url(
                "https://r2.example.com/images/new.jpg"
            )

        assert result is None

    # AC-2 (edge case): Handle string JSON result from DB
    @pytest.mark.asyncio
    async def test_get_analysis_by_url_handles_string_json_result(self):
        """AC-2: If DB returns analysis_result as a JSON string instead of dict,
        it must be deserialized to a dict."""
        from app.services.image_repository import ImageRepository

        cached_result_str = json.dumps({
            "subject": "cat",
            "style": "photo",
            "mood": "calm",
            "lighting": "natural",
            "composition": "centered",
            "palette": "warm",
        })

        mock_cursor = AsyncMock()
        mock_cursor.execute = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value={"analysis_result": cached_result_str})

        mock_conn = AsyncMock()
        mock_conn.cursor = MagicMock(return_value=mock_cursor)
        mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn.__aexit__ = AsyncMock(return_value=False)
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_analysis_by_url(
                "https://r2.example.com/images/photo.jpg"
            )

        assert isinstance(result, dict)
        assert result["subject"] == "cat"
