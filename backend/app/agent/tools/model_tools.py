"""LangGraph tools for model recommendation and model info lookup.

Provides recommend_model (keyword-based matching of prompt intent to best model)
and get_model_info (fetches details for a specific model via Replicate API).

The recommend_model tool uses a rule-based approach:
- Photorealistic -> Flux models
- Anime/Manga -> SDXL-based models
- Text in image -> Ideogram / Flux
- Artistic/Illustration -> Midjourney-style models
- Default -> highest run_count model

Discovery reference: "Fotorealismus -> Flux, Anime -> SDXL, Text im Bild -> Ideogram"
"""

import logging

from langchain_core.tools import tool

from app.services.model_service import model_service

logger = logging.getLogger(__name__)

# Keyword-based matching rules mapping style keywords to model owner/name patterns.
# Priority order: first match wins. Each rule has:
#   keywords: list of lowercase keywords to match against prompt_summary + style_keywords
#   model_patterns: list of (owner_pattern, name_pattern) substrings to match (case-insensitive)
#   fallback_name: human-readable name if no model found
_MATCHING_RULES: list[dict] = [
    {
        "keywords": ["photorealistic", "photorealism", "photo", "realistic", "fotorealistisch", "fotorealismus", "portrait", "landscape photography"],
        "model_patterns": [("black-forest-labs", "flux-2-max"), ("black-forest-labs", "flux-2"), ("black-forest-labs", "flux"), ("flux",)],
        "category": "photorealistic",
        "reason_de": "Dieses Modell eignet sich besonders gut fuer fotorealistische Bilder mit hoher Detailtreue.",
    },
    {
        "keywords": ["typography", "lettering", "schrift", "text im bild", "logo text", "signage", "text overlay", "text on image"],
        "model_patterns": [("ideogram",), ("black-forest-labs", "flux-2-max"), ("black-forest-labs", "flux")],
        "category": "text-in-image",
        "reason_de": "Dieses Modell kann Text in Bildern besonders gut und praezise darstellen.",
    },
    {
        "keywords": ["anime", "manga", "cel-shaded", "cel shaded", "japanese", "chibi"],
        "model_patterns": [("sdxl",), ("stability",), ("anime",)],
        "category": "anime",
        "reason_de": "Dieses Modell ist auf Anime- und Manga-Stile spezialisiert und liefert hier die besten Ergebnisse.",
    },
    {
        "keywords": ["illustration", "artistic", "painting", "watercolor", "oil painting", "digital art", "concept art", "kuenstlerisch"],
        "model_patterns": [("midjourney",), ("playground",), ("stability",), ("black-forest-labs", "flux-2-max")],
        "category": "artistic",
        "reason_de": "Dieses Modell erzeugt besonders kuenstlerische und kreative Bildkompositionen.",
    },
    {
        "keywords": ["3d", "3d render", "3d rendering", "cgi", "blender"],
        "model_patterns": [("black-forest-labs", "flux-2-max"), ("flux",), ("stability",)],
        "category": "3d",
        "reason_de": "Dieses Modell liefert gute Ergebnisse bei 3D-Renderings und CGI-artigen Bildern.",
    },
]


def _match_model(
    prompt_summary: str,
    style_keywords: list[str],
    available_models: list[dict],
) -> dict | None:
    """Match prompt intent against available models using keyword rules.

    Args:
        prompt_summary: Natural language description of the prompt intent.
        style_keywords: List of style keywords extracted from the prompt.
        available_models: List of model dicts from ModelService.

    Returns:
        Dict with id, name, reason if a match is found, or None.
    """
    # Build a searchable text from prompt and keywords (all lowercase)
    search_text = " ".join(
        [prompt_summary.lower()] + [kw.lower() for kw in style_keywords]
    )

    for rule in _MATCHING_RULES:
        # Check if any rule keyword matches
        matched = any(kw in search_text for kw in rule["keywords"])
        if not matched:
            continue

        # Try to find a model matching the rule's model patterns
        for pattern_tuple in rule["model_patterns"]:
            for model in available_models:
                model_owner = model.get("owner", "").lower()
                model_name = model.get("name", "").lower()
                full_id = f"{model_owner}/{model_name}".lower()

                # Check all parts of the pattern tuple match somewhere in owner/name
                if all(p.lower() in full_id for p in pattern_tuple):
                    return {
                        "id": f"{model.get('owner', '')}/{model.get('name', '')}",
                        "name": model.get("name", ""),
                        "reason": rule["reason_de"],
                    }

    return None


def _get_default_model(available_models: list[dict]) -> dict:
    """Return the model with the highest run_count as a safe default.

    Args:
        available_models: List of model dicts from ModelService.

    Returns:
        Dict with id, name, reason.
    """
    if not available_models:
        return {
            "id": "black-forest-labs/flux-2-max",
            "name": "flux-2-max",
            "reason": "Flux 2 Max ist ein vielseitiges Modell mit hoher Qualitaet, das fuer die meisten Anwendungsfaelle hervorragende Ergebnisse liefert.",
        }

    # Sort by run_count descending, pick the most popular
    sorted_models = sorted(
        available_models,
        key=lambda m: m.get("run_count", 0),
        reverse=True,
    )
    top = sorted_models[0]
    return {
        "id": f"{top.get('owner', '')}/{top.get('name', '')}",
        "name": top.get("name", ""),
        "reason": "Dieses Modell ist das meistgenutzte und liefert zuverlaessig gute Ergebnisse fuer verschiedene Stile.",
    }


@tool
async def recommend_model(prompt_summary: str, style_keywords: list[str]) -> dict:
    """Recommend the best image generation model based on prompt intent.

    Analyzes the prompt summary and style keywords to match against available
    models from the Replicate text-to-image collection. Uses rule-based matching:
    photorealistic -> Flux, anime -> SDXL, text in image -> Ideogram, etc.

    Call this tool when you have enough context about what the user wants to generate
    and can recommend a suitable model.

    Args:
        prompt_summary: A brief description of what the user wants to generate
            (e.g., "photorealistic portrait of a woman in golden hour lighting").
        style_keywords: List of style-related keywords extracted from the conversation
            (e.g., ["photorealistic", "portrait", "golden hour"]).

    Returns:
        Dict with keys:
            - id (str): Model identifier in "owner/name" format.
            - name (str): Human-readable model name.
            - reason (str): 1-2 sentence explanation in German why this model is recommended.
        On error, returns dict with "error" key containing an error message.
    """
    try:
        available_models = await model_service.get_available_models()
    except ValueError as e:
        logger.error("recommend_model: Failed to fetch models: %s", e)
        return {"error": "Modell-Daten konnten nicht geladen werden"}
    except Exception as e:
        logger.error("recommend_model: Unexpected error fetching models: %s", e)
        return {"error": "Modell-Daten konnten nicht geladen werden"}

    if not available_models:
        return {"error": "Keine Modelle verfuegbar"}

    # Try keyword-based matching first
    result = _match_model(prompt_summary, style_keywords, available_models)

    if result is None:
        # Fallback to default (most popular model)
        result = _get_default_model(available_models)

    logger.info(
        "recommend_model: Recommended '%s' for intent: %s",
        result.get("id", ""),
        prompt_summary[:80],
    )

    return result


@tool
async def get_model_info(model_id: str) -> dict:
    """Fetch detailed information about a specific image generation model.

    Queries the Replicate Models API for metadata about the given model.
    Use this when the user asks about a specific model or wants more details
    about a recommended model.

    Args:
        model_id: Model identifier in "owner/name" format
            (e.g., "black-forest-labs/flux-schnell").

    Returns:
        Dict with keys:
            - owner (str): Model owner/organization.
            - name (str): Model name.
            - description (str or null): Model description.
            - run_count (int): Number of times the model has been run.
            - url (str): URL to the model page on Replicate.
        On error, returns dict with "error" key containing an error message.
    """
    try:
        result = await model_service.get_model_by_id(model_id)
    except ValueError as e:
        logger.error("get_model_info: Failed to fetch model '%s': %s", model_id, e)
        return {"error": str(e)}
    except Exception as e:
        logger.error("get_model_info: Unexpected error for '%s': %s", model_id, e)
        return {"error": f"Modell-Informationen konnten nicht geladen werden: {e}"}

    logger.info("get_model_info: Fetched info for '%s'", model_id)
    return result
