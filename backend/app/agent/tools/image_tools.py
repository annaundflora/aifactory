"""LangGraph tool for image analysis via Vision LLM.

Downloads an image from a URL, resizes it to max 1024px longest edge using Pillow,
converts to base64, and sends it to the chat model's vision capability to extract
a structured analysis (subject, style, mood, lighting, composition, palette).

The tool result is processed by post_process_node in graph.py to append
to state["reference_images"].
"""

import base64
import io
import json
import logging
import httpx
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

# Maximum longest edge in pixels for images sent to the Vision API.
MAX_IMAGE_DIMENSION = 1024

# System prompt instructing the Vision LLM to return structured JSON analysis.
_VISION_ANALYSIS_PROMPT = """Analyze this image and return a JSON object with exactly these 6 keys:
- "subject": What is the main subject of the image? (non-empty string)
- "style": What visual style does the image have? (e.g., photorealistic, illustration, watercolor, 3D render, etc.) (non-empty string)
- "mood": What mood or atmosphere does the image convey? (e.g., serene, dramatic, playful, mysterious, etc.) (non-empty string)
- "lighting": Describe the lighting in the image. (e.g., soft natural light, dramatic side lighting, golden hour, studio lighting, etc.) (non-empty string)
- "composition": Describe the composition/framing. (e.g., centered subject, rule of thirds, close-up, wide angle, bird's eye view, etc.) (non-empty string)
- "palette": Describe the dominant color palette. (e.g., warm earth tones, cool blues, high contrast black and white, pastel colors, etc.) (non-empty string)

Respond with ONLY the JSON object, no markdown formatting, no code blocks, no additional text.
All values must be in English."""

# Expected keys in the analysis result.
_ANALYSIS_KEYS = ("subject", "style", "mood", "lighting", "composition", "palette")


def _resize_image_if_needed(image_bytes: bytes) -> tuple[bytes, str]:
    """Resize an image so its longest edge is at most MAX_IMAGE_DIMENSION pixels.

    If the image is already within the limit, it is returned as-is (re-encoded as PNG).
    Preserves aspect ratio using Image.thumbnail().

    Args:
        image_bytes: Raw image bytes.

    Returns:
        Tuple of (processed image bytes as PNG, mime type string).
    """
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if necessary (handles RGBA, palette, etc.)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    width, height = img.size
    longest_edge = max(width, height)

    if longest_edge > MAX_IMAGE_DIMENSION:
        # thumbnail modifies in place, preserves aspect ratio
        img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)
        logger.debug(
            "Resized image from %dx%d to %dx%d",
            width,
            height,
            img.size[0],
            img.size[1],
        )

    # Encode to PNG for consistent format
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue(), "image/png"


async def _download_image(image_url: str) -> bytes:
    """Download an image from the given URL using httpx (async).

    Args:
        image_url: URL to download the image from.

    Returns:
        Raw image bytes.

    Raises:
        ValueError: If the download fails or the response is not an image.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise ValueError(
            f"Bild konnte nicht heruntergeladen werden: HTTP {e.response.status_code}"
        ) from e
    except httpx.RequestError as e:
        raise ValueError(
            f"Bild konnte nicht heruntergeladen werden: {e}"
        ) from e

    content_type = response.headers.get("content-type", "")
    if response.content and len(response.content) < 100:
        raise ValueError("Bild konnte nicht heruntergeladen werden: Datei zu klein oder leer")

    return response.content


def _parse_vision_response(response_text: str) -> dict[str, str]:
    """Parse the Vision LLM response into a structured dict with 6 keys.

    Attempts JSON parsing first. If that fails, returns a fallback dict with
    empty strings for missing fields.

    Args:
        response_text: Raw text response from the Vision LLM.

    Returns:
        Dict with exactly the 6 expected keys.
    """
    # Strip any markdown code fences the LLM might add
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        # Remove ```json or ``` prefix and trailing ```
        lines = cleaned.split("\n")
        # Skip first and last lines if they're fences
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            # Ensure all 6 keys exist with non-empty string values
            result = {}
            for key in _ANALYSIS_KEYS:
                value = data.get(key, "")
                result[key] = str(value) if value else ""
            return result
    except (json.JSONDecodeError, TypeError):
        logger.warning(
            "Could not parse Vision LLM response as JSON: %s",
            cleaned[:200],
        )

    # Fallback: return empty strings for all keys
    return {key: "" for key in _ANALYSIS_KEYS}


@tool
async def analyze_image(image_url: str) -> dict:
    """Analyze a reference image to extract visual characteristics.

    Downloads the image from the given URL, resizes it to max 1024px longest edge,
    and sends it to the Vision LLM to extract a structured analysis including
    subject, style, mood, lighting, composition, and color palette.

    Use this tool when a user uploads a reference image and wants to extract
    visual characteristics for prompt creation.

    Args:
        image_url: Public URL of the image to analyze (e.g., R2 storage URL).

    Returns:
        Dict with keys: subject, style, mood, lighting, composition, palette.
        All values are non-empty English strings describing the image.
    """
    # Step 1: Download the image
    image_bytes = await _download_image(image_url)

    # Step 2: Resize if needed (max 1024px longest edge)
    processed_bytes, mime_type = _resize_image_if_needed(image_bytes)

    # Step 3: Encode to base64 for the Vision API
    b64_image = base64.b64encode(processed_bytes).decode("utf-8")

    # Step 4: Call the Vision LLM with the image
    llm = ChatOpenAI(
        model=settings.assistant_model_default,
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,  # Lower temperature for more consistent structured output
    )

    message = HumanMessage(
        content=[
            {"type": "text", "text": _VISION_ANALYSIS_PROMPT},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{b64_image}",
                },
            },
        ]
    )

    try:
        response = await llm.ainvoke([message])
        response_text = response.content if isinstance(response.content, str) else str(response.content)
    except Exception as e:
        logger.error("Vision LLM call failed: %s", e)
        raise ValueError(f"Bildanalyse fehlgeschlagen: {e}") from e

    # Step 5: Parse the structured response
    result = _parse_vision_response(response_text)

    logger.info(
        "analyze_image completed for %s: subject=%s",
        image_url[:80],
        result.get("subject", "")[:50],
    )

    return result
