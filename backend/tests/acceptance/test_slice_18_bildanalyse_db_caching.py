"""Acceptance tests for Slice 18: Bildanalyse DB-Caching.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/phase-3/2026-03-11-prompt-assistant/slices/slice-18-bildanalyse-db-caching.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
DB calls via psycopg3 are mocked. Vision LLM calls are mocked.
"""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ANALYSIS_RESULT_FULL = {
    "subject": "cat",
    "style": "photo",
    "mood": "calm",
    "lighting": "natural",
    "composition": "centered",
    "palette": "warm",
}

EXPECTED_KEYS = {"subject", "style", "mood", "lighting", "composition", "palette"}

SAMPLE_URL = "https://r2.example.com/images/photo.jpg"
UNKNOWN_URL = "https://r2.example.com/images/new.jpg"
SESSION_ID = "test-session-001"


def _make_fake_image_bytes() -> bytes:
    img = Image.new("RGB", (200, 150), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


def _mock_db_cursor(fetchone_return=None):
    """Create a mock async cursor and connection pair."""
    mock_cursor = AsyncMock()
    mock_cursor.execute = AsyncMock()
    mock_cursor.fetchone = AsyncMock(return_value=fetchone_return)
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=False)

    mock_conn = AsyncMock()
    mock_conn.cursor = MagicMock(return_value=mock_cursor)
    mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_conn.__aexit__ = AsyncMock(return_value=False)

    return mock_conn, mock_cursor


# ---------------------------------------------------------------------------
# Acceptance Tests
# ---------------------------------------------------------------------------

class TestSlice18Acceptance:
    """Acceptance tests for Slice 18 -- Bildanalyse DB-Caching."""

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac1_save_analysis_creates_db_entry(self):
        """AC-1: GIVEN die assistant_images Tabelle existiert in PostgreSQL (via Slice 05)
        WHEN ImageRepository.save_analysis(session_id, image_url, analysis_result) aufgerufen wird
        THEN wird ein neuer Eintrag in assistant_images gespeichert mit den uebergebenen
        Werten und einer auto-generierten UUID als id.
        """
        from app.services.image_repository import ImageRepository

        mock_conn, mock_cursor = _mock_db_cursor()
        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            await repo.save_analysis(
                session_id=SESSION_ID,
                image_url=SAMPLE_URL,
                analysis_result=ANALYSIS_RESULT_FULL,
            )

        # Verify INSERT was executed
        mock_cursor.execute.assert_called_once()
        sql = mock_cursor.execute.call_args[0][0]
        params = mock_cursor.execute.call_args[0][1]

        assert "INSERT INTO assistant_images" in sql
        assert "session_id" in sql
        assert "image_url" in sql
        assert "analysis_result" in sql
        assert params[0] == SESSION_ID
        assert params[1] == SAMPLE_URL
        # Third param is Jsonb-wrapped analysis_result

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac2_get_analysis_by_url_returns_cached_result(self):
        """AC-2: GIVEN ein Eintrag in assistant_images mit
        image_url = "https://r2.example.com/images/photo.jpg" und
        analysis_result = {"subject": "cat", "style": "photo", "mood": "calm",
        "lighting": "natural", "composition": "centered", "palette": "warm"}
        WHEN ImageRepository.get_analysis_by_url(image_url) aufgerufen wird mit genau dieser URL
        THEN gibt die Methode das gespeicherte analysis_result Dict zurueck (nicht None).
        """
        from app.services.image_repository import ImageRepository

        mock_conn, mock_cursor = _mock_db_cursor(
            fetchone_return={"analysis_result": ANALYSIS_RESULT_FULL}
        )
        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_analysis_by_url(SAMPLE_URL)

        assert result is not None, "Must return cached result, not None"
        assert isinstance(result, dict)
        assert result == ANALYSIS_RESULT_FULL
        assert set(result.keys()) == EXPECTED_KEYS

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac3_get_analysis_by_url_returns_none_for_unknown(self):
        """AC-3: GIVEN kein Eintrag in assistant_images fuer
        image_url = "https://r2.example.com/images/new.jpg"
        WHEN ImageRepository.get_analysis_by_url(image_url) aufgerufen wird
        THEN gibt die Methode None zurueck.
        """
        from app.services.image_repository import ImageRepository

        mock_conn, mock_cursor = _mock_db_cursor(fetchone_return=None)
        repo = ImageRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_analysis_by_url(UNKNOWN_URL)

        assert result is None, "Must return None for unknown URL"

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac4_first_analysis_calls_vision_and_saves(self):
        """AC-4: GIVEN ein Bild mit URL "https://r2.example.com/images/photo.jpg"
        wird zum ersten Mal analysiert
        WHEN analyze_image mit dieser URL aufgerufen wird
        THEN wird der Vision-API-Call ausgefuehrt UND das Ergebnis via
        ImageRepository.save_analysis() in der DB gespeichert.
        """
        from app.agent.tools.image_tools import analyze_image

        fake_image = _make_fake_image_bytes()
        mock_http_response = MagicMock()
        mock_http_response.content = fake_image
        mock_http_response.headers = {"content-type": "image/jpeg"}
        mock_http_response.raise_for_status = MagicMock()

        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps(ANALYSIS_RESULT_FULL)

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=None)  # Cache miss
        mock_repo.save_analysis = AsyncMock()

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_http_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
            mock_chat_cls.return_value = mock_llm

            config = {"configurable": {"thread_id": SESSION_ID}}
            result = await analyze_image.ainvoke(
                {"image_url": SAMPLE_URL}, config=config
            )

        # Vision API was called
        mock_llm.ainvoke.assert_called_once()

        # save_analysis was called with correct args
        mock_repo.save_analysis.assert_called_once()
        save_call = mock_repo.save_analysis.call_args
        assert save_call[0][0] == SESSION_ID
        assert save_call[0][1] == SAMPLE_URL
        assert isinstance(save_call[0][2], dict)

        # Result is valid
        assert isinstance(result, dict)
        assert set(result.keys()) == EXPECTED_KEYS

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac5_cached_analysis_skips_vision_call(self):
        """AC-5: GIVEN ein Bild mit URL "https://r2.example.com/images/photo.jpg"
        wurde bereits analysiert (Eintrag in assistant_images vorhanden)
        WHEN analyze_image erneut mit derselben URL aufgerufen wird
        THEN wird KEIN Vision-API-Call gemacht, sondern das gecachte Ergebnis
        aus der DB zurueckgegeben.
        """
        from app.agent.tools.image_tools import analyze_image

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=ANALYSIS_RESULT_FULL)

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock()
            mock_chat_cls.return_value = mock_llm

            mock_client = AsyncMock()
            mock_client_cls.return_value = mock_client

            result = await analyze_image.ainvoke({"image_url": SAMPLE_URL})

        # Vision API was NOT called
        mock_llm.ainvoke.assert_not_called()

        # HTTP download was NOT initiated
        mock_client.get.assert_not_called()

        # Cached result returned
        assert result == ANALYSIS_RESULT_FULL

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac6_cached_result_has_correct_format(self):
        """AC-6: GIVEN ein Cache-Hit fuer eine image_url
        WHEN das gecachte Ergebnis zurueckgegeben wird
        THEN hat das Ergebnis dasselbe Format wie ein frisches Analyse-Ergebnis
        (Dict mit 6 Keys: subject, style, mood, lighting, composition, palette).
        """
        from app.agent.tools.image_tools import analyze_image

        cached = {
            "subject": "mountain landscape",
            "style": "watercolor",
            "mood": "serene",
            "lighting": "golden hour",
            "composition": "wide angle panorama",
            "palette": "warm earth tones",
        }

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=cached)

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.ChatOpenAI"):

            result = await analyze_image.ainvoke({"image_url": SAMPLE_URL})

        # Verify exact format: dict with 6 string keys
        assert isinstance(result, dict), f"Must be dict, got {type(result).__name__}"
        assert set(result.keys()) == EXPECTED_KEYS, (
            f"Must have exactly 6 keys {EXPECTED_KEYS}, got {set(result.keys())}"
        )
        for key in EXPECTED_KEYS:
            assert isinstance(result[key], str), (
                f"'{key}' must be a string, got {type(result[key]).__name__}"
            )
            assert len(result[key]) > 0, f"'{key}' must be non-empty"

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac7_db_error_graceful_fallback_to_vision(self):
        """AC-7: GIVEN ein DB-Fehler beim Cache-Lookup (z.B. Connection-Fehler)
        WHEN analyze_image den Cache nicht lesen kann
        THEN faellt das Tool graceful auf den Vision-API-Call zurueck
        (kein Abbruch, kein Error-Event) und loggt den Fehler.
        """
        from app.agent.tools.image_tools import analyze_image

        fake_image = _make_fake_image_bytes()
        mock_http_response = MagicMock()
        mock_http_response.content = fake_image
        mock_http_response.headers = {"content-type": "image/jpeg"}
        mock_http_response.raise_for_status = MagicMock()

        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps(ANALYSIS_RESULT_FULL)

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(
            side_effect=Exception("psycopg.OperationalError: connection refused")
        )
        mock_repo.save_analysis = AsyncMock()

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_http_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
            mock_chat_cls.return_value = mock_llm

            config = {"configurable": {"thread_id": SESSION_ID}}

            # Must NOT raise -- graceful fallback
            result = await analyze_image.ainvoke(
                {"image_url": SAMPLE_URL}, config=config
            )

        # DB cache was attempted
        mock_repo.get_analysis_by_url.assert_called_once_with(SAMPLE_URL)

        # Vision API was called as fallback
        mock_llm.ainvoke.assert_called_once()

        # Valid result returned despite DB error
        assert isinstance(result, dict)
        assert set(result.keys()) == EXPECTED_KEYS
        for key in EXPECTED_KEYS:
            assert isinstance(result[key], str)
