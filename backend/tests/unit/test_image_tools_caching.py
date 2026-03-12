"""Unit tests for analyze_image caching logic (Slice 18: Bildanalyse DB-Caching).

Tests the caching behavior added to analyze_image tool:
- Cache miss -> Vision API call + DB save
- Cache hit -> return cached, no Vision API call
- DB error -> graceful fallback to Vision API

Mocking Strategy: mock_external (as specified in Slice-Spec).
DB calls via psycopg3 and Vision LLM calls are mocked.
"""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image


def _make_fake_image_bytes() -> bytes:
    """Create a minimal in-memory JPEG image for mocking downloads."""
    img = Image.new("RGB", (200, 150), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


SAMPLE_ANALYSIS = {
    "subject": "cat on windowsill",
    "style": "photo",
    "mood": "calm",
    "lighting": "natural",
    "composition": "centered",
    "palette": "warm",
}

SAMPLE_URL = "https://r2.example.com/images/photo.jpg"
SAMPLE_SESSION_ID = "session-abc-123"


def _mock_http_and_vision(vision_response_content=None):
    """Return context managers that mock httpx download and ChatOpenAI Vision call.

    Args:
        vision_response_content: String content for the LLM response.
            Defaults to JSON of SAMPLE_ANALYSIS.
    """
    if vision_response_content is None:
        vision_response_content = json.dumps(SAMPLE_ANALYSIS)

    fake_image_bytes = _make_fake_image_bytes()

    mock_http_response = MagicMock()
    mock_http_response.content = fake_image_bytes
    mock_http_response.headers = {"content-type": "image/jpeg"}
    mock_http_response.raise_for_status = MagicMock()

    mock_llm_response = MagicMock()
    mock_llm_response.content = vision_response_content

    return mock_http_response, mock_llm_response


class TestAnalyzeImageCaching:
    """Unit tests for the caching layer in analyze_image."""

    # AC-4: Erstes Bild -> Vision-Call + DB-Speicherung
    @pytest.mark.asyncio
    async def test_first_analysis_calls_vision_and_saves_to_db(self):
        """AC-4: GIVEN ein Bild mit URL wird zum ersten Mal analysiert
        WHEN analyze_image mit dieser URL aufgerufen wird
        THEN wird der Vision-API-Call ausgefuehrt UND das Ergebnis via
        ImageRepository.save_analysis() in der DB gespeichert.
        """
        from app.agent.tools.image_tools import analyze_image

        mock_http_resp, mock_llm_resp = _mock_http_and_vision()

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=None)  # Cache miss
        mock_repo.save_analysis = AsyncMock()

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_http_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_resp)
            mock_chat_cls.return_value = mock_llm

            # Call with a config that has thread_id (session_id)
            config = {"configurable": {"thread_id": SAMPLE_SESSION_ID}}
            result = await analyze_image.ainvoke(
                {"image_url": SAMPLE_URL},
                config=config,
            )

        # Vision API was called
        mock_llm.ainvoke.assert_called_once()

        # Result was saved to DB
        mock_repo.save_analysis.assert_called_once()
        save_args = mock_repo.save_analysis.call_args
        assert save_args[0][0] == SAMPLE_SESSION_ID
        assert save_args[0][1] == SAMPLE_URL
        assert isinstance(save_args[0][2], dict)

        # Return value is the analysis result
        assert isinstance(result, dict)
        assert "subject" in result

    # AC-5: Zweites Bild gleiche URL -> Cache-Hit, kein Vision-Call
    @pytest.mark.asyncio
    async def test_cached_analysis_skips_vision_call(self):
        """AC-5: GIVEN ein Bild mit URL wurde bereits analysiert (Eintrag in assistant_images vorhanden)
        WHEN analyze_image erneut mit derselben URL aufgerufen wird
        THEN wird KEIN Vision-API-Call gemacht, sondern das gecachte Ergebnis
        aus der DB zurueckgegeben.
        """
        from app.agent.tools.image_tools import analyze_image

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=SAMPLE_ANALYSIS)  # Cache hit

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock()
            mock_chat_cls.return_value = mock_llm

            result = await analyze_image.ainvoke({"image_url": SAMPLE_URL})

        # Cache was checked
        mock_repo.get_analysis_by_url.assert_called_once_with(SAMPLE_URL)

        # Vision API was NOT called
        mock_llm.ainvoke.assert_not_called()

        # save_analysis was NOT called (no need to re-save)
        mock_repo.save_analysis.assert_not_called()

        # Returned the cached result
        assert result == SAMPLE_ANALYSIS

    # AC-6: Cache-Ergebnis hat korrektes Format (6 Keys)
    @pytest.mark.asyncio
    async def test_cached_result_has_same_format_as_fresh(self):
        """AC-6: GIVEN ein Cache-Hit fuer eine image_url
        WHEN das gecachte Ergebnis zurueckgegeben wird
        THEN hat das Ergebnis dasselbe Format wie ein frisches Analyse-Ergebnis
        (Dict mit 6 Keys: subject, style, mood, lighting, composition, palette).
        """
        from app.agent.tools.image_tools import analyze_image

        cached = {
            "subject": "sunset over ocean",
            "style": "photorealistic",
            "mood": "serene",
            "lighting": "golden hour",
            "composition": "rule of thirds",
            "palette": "warm oranges and blues",
        }

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=cached)

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.ChatOpenAI"):

            result = await analyze_image.ainvoke({"image_url": SAMPLE_URL})

        expected_keys = {"subject", "style", "mood", "lighting", "composition", "palette"}
        assert isinstance(result, dict)
        assert set(result.keys()) == expected_keys, (
            f"Cached result must have exactly 6 keys, got {set(result.keys())}"
        )
        for key in expected_keys:
            assert isinstance(result[key], str), (
                f"'{key}' must be a string, got {type(result[key]).__name__}"
            )
            assert len(result[key]) > 0, (
                f"'{key}' must be non-empty in a valid cached result"
            )

    # AC-7: DB-Fehler -> Fallback auf Vision-Call
    @pytest.mark.asyncio
    async def test_db_error_falls_back_to_vision_call(self):
        """AC-7: GIVEN ein DB-Fehler beim Cache-Lookup (z.B. Connection-Fehler)
        WHEN analyze_image den Cache nicht lesen kann
        THEN faellt das Tool graceful auf den Vision-API-Call zurueck
        (kein Abbruch, kein Error-Event) und loggt den Fehler.
        """
        from app.agent.tools.image_tools import analyze_image

        mock_http_resp, mock_llm_resp = _mock_http_and_vision()

        mock_repo = MagicMock()
        # Cache lookup raises an exception (simulating DB connection error)
        mock_repo.get_analysis_by_url = AsyncMock(
            side_effect=Exception("Connection refused: could not connect to server")
        )
        mock_repo.save_analysis = AsyncMock()

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_http_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_resp)
            mock_chat_cls.return_value = mock_llm

            config = {"configurable": {"thread_id": SAMPLE_SESSION_ID}}

            # Must NOT raise -- graceful fallback
            result = await analyze_image.ainvoke(
                {"image_url": SAMPLE_URL},
                config=config,
            )

        # Vision API was called as fallback
        mock_llm.ainvoke.assert_called_once()

        # Result is still valid
        assert isinstance(result, dict)
        assert "subject" in result

    # AC-7 (additional): DB error on save does not block result
    @pytest.mark.asyncio
    async def test_db_error_on_save_does_not_block_result(self):
        """AC-7: If save_analysis fails after a successful Vision call,
        the result must still be returned (no error raised to caller)."""
        from app.agent.tools.image_tools import analyze_image

        mock_http_resp, mock_llm_resp = _mock_http_and_vision()

        mock_repo = MagicMock()
        mock_repo.get_analysis_by_url = AsyncMock(return_value=None)  # Cache miss
        mock_repo.save_analysis = AsyncMock(
            side_effect=Exception("DB write failed: disk full")
        )

        with patch("app.agent.tools.image_tools._image_repo", mock_repo), \
             patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_http_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_resp)
            mock_chat_cls.return_value = mock_llm

            config = {"configurable": {"thread_id": SAMPLE_SESSION_ID}}

            # Must NOT raise
            result = await analyze_image.ainvoke(
                {"image_url": SAMPLE_URL},
                config=config,
            )

        # Result is still returned despite save failure
        assert isinstance(result, dict)
        assert "subject" in result

        # save_analysis was attempted
        mock_repo.save_analysis.assert_called_once()
