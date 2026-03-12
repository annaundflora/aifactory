"""Unit tests for image_tools (Slice 16).

Tests the pure logic of analyze_image tool helper functions in isolation:
_resize_image_if_needed, _download_image, _parse_vision_response.

Mocking Strategy: mock_external (as specified in Slice-Spec).
HTTP downloads and Vision LLM calls are mocked; Pillow resize uses real images.
"""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image


# ---------------------------------------------------------------------------
# _resize_image_if_needed tests (AC-2, AC-3)
# ---------------------------------------------------------------------------

class TestResizeImageIfNeeded:
    """Unit tests for _resize_image_if_needed logic."""

    def _make_image_bytes(self, width: int, height: int, mode: str = "RGB") -> bytes:
        """Helper: create a minimal in-memory image of given dimensions."""
        img = Image.new(mode, (width, height), color="red")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()

    def test_resize_large_landscape_image(self):
        """AC-2: A 2048x1536 image must be resized to 1024x768 (longest edge = 1024)."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(2048, 1536)
        processed, mime = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        assert img.size[0] == 1024, f"Width must be 1024, got {img.size[0]}"
        assert img.size[1] == 768, f"Height must be 768, got {img.size[1]}"
        assert mime == "image/png"

    def test_resize_large_portrait_image(self):
        """AC-2: A 1536x2048 portrait image must be resized to 768x1024."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(1536, 2048)
        processed, mime = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        assert img.size[0] == 768, f"Width must be 768, got {img.size[0]}"
        assert img.size[1] == 1024, f"Height must be 1024, got {img.size[1]}"

    def test_resize_square_large_image(self):
        """AC-2: A 2000x2000 square image must be resized to 1024x1024."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(2000, 2000)
        processed, _ = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        assert max(img.size) == 1024, f"Longest edge must be 1024, got {max(img.size)}"
        assert img.size[0] == img.size[1], "Aspect ratio must be preserved (square)"

    def test_no_resize_small_image(self):
        """AC-3: An 800x600 image (under 1024) must NOT be resized."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(800, 600)
        processed, mime = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        assert img.size == (800, 600), f"Image must stay at 800x600, got {img.size}"
        assert mime == "image/png"

    def test_no_resize_exact_1024_image(self):
        """AC-3: An image with longest edge exactly 1024px must NOT be resized."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(1024, 768)
        processed, _ = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        assert img.size == (1024, 768), f"Image must stay at 1024x768, got {img.size}"

    def test_resize_preserves_aspect_ratio(self):
        """AC-2: Aspect ratio must be preserved during resize."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(4000, 2000)
        processed, _ = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        # Original ratio is 2:1, resized should be 1024:512
        assert img.size[0] == 1024
        assert img.size[1] == 512

    def test_resize_handles_rgba_image(self):
        """Resize must handle RGBA images by converting to RGB."""
        from app.agent.tools.image_tools import _resize_image_if_needed

        raw = self._make_image_bytes(2048, 1536, mode="RGBA")
        processed, mime = _resize_image_if_needed(raw)

        img = Image.open(io.BytesIO(processed))
        assert max(img.size) <= 1024
        assert mime == "image/png"


# ---------------------------------------------------------------------------
# _parse_vision_response tests (AC-1, AC-8)
# ---------------------------------------------------------------------------

class TestParseVisionResponse:
    """Unit tests for _parse_vision_response parsing logic."""

    def test_parse_valid_json_response(self):
        """AC-1: Valid JSON with all 6 keys must be parsed correctly."""
        from app.agent.tools.image_tools import _parse_vision_response

        raw = json.dumps({
            "subject": "a cat on a windowsill",
            "style": "photorealistic",
            "mood": "calm",
            "lighting": "soft natural light",
            "composition": "centered subject",
            "palette": "warm earth tones",
        })

        result = _parse_vision_response(raw)

        assert isinstance(result, dict)
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}
        assert result["subject"] == "a cat on a windowsill"
        assert result["style"] == "photorealistic"
        assert result["mood"] == "calm"
        assert result["lighting"] == "soft natural light"
        assert result["composition"] == "centered subject"
        assert result["palette"] == "warm earth tones"

    def test_parse_json_with_markdown_fences(self):
        """AC-8: JSON wrapped in markdown code fences must be parsed."""
        from app.agent.tools.image_tools import _parse_vision_response

        raw = '```json\n{"subject": "mountain", "style": "watercolor", "mood": "serene", "lighting": "golden hour", "composition": "wide angle", "palette": "cool blues"}\n```'

        result = _parse_vision_response(raw)
        assert result["subject"] == "mountain"
        assert result["mood"] == "serene"

    def test_parse_json_missing_keys_returns_empty_strings(self):
        """AC-8: JSON missing some keys must return empty strings for missing fields."""
        from app.agent.tools.image_tools import _parse_vision_response

        raw = json.dumps({"subject": "a dog", "style": "cartoon"})

        result = _parse_vision_response(raw)
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}
        assert result["subject"] == "a dog"
        assert result["style"] == "cartoon"
        assert result["mood"] == ""
        assert result["lighting"] == ""
        assert result["composition"] == ""
        assert result["palette"] == ""

    def test_parse_invalid_json_returns_fallback(self):
        """AC-8: Unparseable text must return fallback dict with empty strings."""
        from app.agent.tools.image_tools import _parse_vision_response

        raw = "This is not JSON at all, just a description of the image."

        result = _parse_vision_response(raw)
        assert isinstance(result, dict)
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}
        for key in result:
            assert result[key] == "", f"Fallback must have empty string for '{key}'"

    def test_parse_empty_string_returns_fallback(self):
        """AC-8: Empty response must return fallback dict."""
        from app.agent.tools.image_tools import _parse_vision_response

        result = _parse_vision_response("")
        assert isinstance(result, dict)
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}

    def test_parse_json_with_null_values_returns_empty_strings(self):
        """AC-8: JSON with null values must map nulls to empty strings."""
        from app.agent.tools.image_tools import _parse_vision_response

        raw = json.dumps({
            "subject": None,
            "style": "oil painting",
            "mood": None,
            "lighting": "dramatic",
            "composition": None,
            "palette": "dark",
        })

        result = _parse_vision_response(raw)
        assert result["subject"] == ""
        assert result["style"] == "oil painting"
        assert result["mood"] == ""
        assert result["lighting"] == "dramatic"

    def test_parse_json_array_returns_fallback(self):
        """AC-8: If LLM returns a JSON array instead of object, fallback is returned."""
        from app.agent.tools.image_tools import _parse_vision_response

        raw = json.dumps(["subject", "style", "mood"])

        result = _parse_vision_response(raw)
        assert isinstance(result, dict)
        assert set(result.keys()) == {"subject", "style", "mood", "lighting", "composition", "palette"}
        for key in result:
            assert result[key] == ""


# ---------------------------------------------------------------------------
# _download_image tests (AC-6)
# ---------------------------------------------------------------------------

class TestDownloadImage:
    """Unit tests for _download_image error handling."""

    @pytest.mark.asyncio
    async def test_download_raises_on_http_error(self):
        """AC-6: HTTP error (e.g., 404) must raise ValueError with descriptive message."""
        from app.agent.tools.image_tools import _download_image

        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="Not Found",
            request=MagicMock(),
            response=mock_response,
        )

        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ValueError, match="[Bb]ild konnte nicht heruntergeladen werden"):
                await _download_image("https://example.com/nonexistent.jpg")

    @pytest.mark.asyncio
    async def test_download_raises_on_connection_error(self):
        """AC-6: Connection error must raise ValueError with descriptive message."""
        from app.agent.tools.image_tools import _download_image

        import httpx

        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(
                side_effect=httpx.RequestError("Connection refused", request=MagicMock())
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ValueError, match="[Bb]ild konnte nicht heruntergeladen werden"):
                await _download_image("https://unreachable-host.example.com/img.png")


# ---------------------------------------------------------------------------
# Tool decorator tests (AC-7)
# ---------------------------------------------------------------------------

class TestToolDecorator:
    """Unit tests verifying analyze_image is a proper LangChain tool."""

    def test_analyze_image_is_langchain_tool(self):
        """AC-7: analyze_image must be a LangChain tool with .invoke and .name."""
        from app.agent.tools.image_tools import analyze_image

        assert hasattr(analyze_image, "invoke"), "analyze_image must have .invoke (BaseTool)"
        assert hasattr(analyze_image, "name"), "analyze_image must have .name attribute"
        assert analyze_image.name == "analyze_image"

    def test_analyze_image_has_description(self):
        """AC-7: analyze_image must have a description for the LLM."""
        from app.agent.tools.image_tools import analyze_image

        assert hasattr(analyze_image, "description")
        assert len(analyze_image.description) > 0

    def test_analysis_keys_constant(self):
        """The _ANALYSIS_KEYS constant must contain exactly the 6 expected keys."""
        from app.agent.tools.image_tools import _ANALYSIS_KEYS

        assert set(_ANALYSIS_KEYS) == {"subject", "style", "mood", "lighting", "composition", "palette"}
