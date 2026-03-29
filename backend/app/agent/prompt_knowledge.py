"""Prompt knowledge lookup module.

Pure, side-effect-free lookup for prompt-knowledge.json.
Provides prefix-based model matching, mode filtering, and fallback.
Module-level cache: JSON is read once from disk, then served from memory.

Exports:
    get_prompt_knowledge(model_id, mode) -> dict
    format_knowledge_for_prompt(result) -> str
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level cache
# ---------------------------------------------------------------------------

_cached_data: Optional[dict] = None


_EMBEDDED_FALLBACK: dict = {
    "models": {},
    "fallback": {
        "displayName": "Generic",
        "tips": [
            "Be specific and descriptive in your prompts",
            "Include details about style, lighting, composition, and mood",
            "Use clear, concise language",
        ],
        "avoid": [
            "Vague or overly short prompts",
            "Contradictory instructions",
        ],
    },
}


def _load_knowledge_file() -> dict:
    """Load and cache prompt-knowledge.json from the repo data/ directory.

    The file path is resolved relative to the repository root
    (three levels up from this module: backend/app/agent/ -> repo root).

    If the file is not found, a warning is logged and an embedded fallback
    with generic knowledge is returned and cached.

    If the file contains malformed JSON, an error is logged and the exception
    is re-raised so the app fails fast on startup (architecture: fail-fast).

    Returns:
        Parsed JSON data with 'models' and 'fallback' keys.
    """
    global _cached_data

    if _cached_data is not None:
        return _cached_data

    # Resolve path: this file is at backend/app/agent/prompt_knowledge.py
    # Repo root is three directories up.
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    file_path = repo_root / "data" / "prompt-knowledge.json"

    logger.debug("Loading prompt knowledge from %s", file_path)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            _cached_data = json.load(f)
    except FileNotFoundError:
        logger.warning(
            "Knowledge file not found at %s, using embedded fallback", file_path
        )
        _cached_data = _EMBEDDED_FALLBACK
    except json.JSONDecodeError as exc:
        logger.error(
            "Malformed JSON in knowledge file %s: %s",
            file_path,
            exc,
        )
        raise

    return _cached_data


# ---------------------------------------------------------------------------
# Prefix matching helpers
# ---------------------------------------------------------------------------


def _strip_owner_prefix(model_id: str) -> str:
    """Strip the owner/organization prefix from a model ID.

    "black-forest-labs/flux-2-pro" -> "flux-2-pro"
    "flux-2-pro" -> "flux-2-pro" (unchanged if no slash)
    """
    last_slash = model_id.rfind("/")
    if last_slash == -1:
        return model_id
    return model_id[last_slash + 1 :]


def _find_exact_match(
    name: str, models: dict
) -> Optional[tuple[str, dict]]:
    """Find an exact match for the model slug in the models dict.

    Returns:
        Tuple of (slug, model_knowledge) or None if no match.
    """
    knowledge = models.get(name)
    if knowledge is not None:
        return (name, knowledge)

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_prompt_knowledge(
    model_id: str, mode: Optional[str] = None
) -> dict:
    """Look up prompt knowledge for a given model ID and optional generation mode.

    1. Strips owner prefix (e.g. "black-forest-labs/flux-2-pro" -> "flux-2-pro")
    2. Finds an exact match for the slug in prompt-knowledge.json
    3. Optionally filters mode-specific tips (txt2img / img2img)
    4. Falls back to the generic fallback entry if no exact match found

    Args:
        model_id: The full model identifier (may include owner prefix).
        mode: Optional generation mode for mode-specific tips ("txt2img" or "img2img").

    Returns:
        Dict with keys:
        - kind: "model" or "fallback"
        - displayName: Human-readable model name
        - model: ModelKnowledge dict (when kind == "model")
        - mode: ModeKnowledge dict (when kind == "model" and mode matches)
        - fallback: FallbackKnowledge dict (when kind == "fallback")
    """
    data = _load_knowledge_file()
    name = _strip_owner_prefix(model_id)
    match = _find_exact_match(name, data["models"])

    if match is None:
        logger.debug("No exact match for '%s', using fallback", model_id)
        return {
            "kind": "fallback",
            "displayName": data["fallback"]["displayName"],
            "fallback": data["fallback"],
        }

    prefix, model_knowledge = match

    result: dict = {
        "kind": "model",
        "displayName": model_knowledge["displayName"],
        "model": model_knowledge,
    }

    # Attach mode-specific knowledge if requested and available
    if mode and "modes" in model_knowledge:
        mode_knowledge = model_knowledge["modes"].get(mode)
        if mode_knowledge:
            result["mode"] = mode_knowledge

    return result


def format_knowledge_for_prompt(result: dict) -> str:
    """Format a knowledge lookup result into a human-readable string
    suitable for injection into an LLM system prompt.

    The output format is identical to the TS version (formatKnowledgeForPrompt)
    so that both runtimes produce the same system prompt sections.

    Args:
        result: The lookup result from get_prompt_knowledge.

    Returns:
        Formatted string with prompting tips.
    """
    lines: list[str] = []

    if result["kind"] == "model":
        model = result["model"]
        mode = result.get("mode")

        lines.append(f"## Aktuell ausgewaehltes Modell: {result['displayName']}")
        lines.append("")
        lines.append(f"Der User arbeitet gerade mit **{result['displayName']}**. Beruecksichtige die folgenden modellspezifischen Hinweise bei der Prompt-Erstellung.")
        lines.append("")

        prompt_style = (
            "Natural language descriptions"
            if model.get("promptStyle") == "natural"
            else "Keyword-based prompts"
        )
        lines.append(f"Prompt style: {prompt_style}")

        negative_prompts = model.get("negativePrompts")
        if negative_prompts:
            supported_text = (
                "Supported" if negative_prompts["supported"] else "Not supported"
            )
            lines.append(
                f"Negative prompts: {supported_text}. {negative_prompts['note']}"
            )

        strengths = model.get("strengths", [])
        if len(strengths) > 0:
            lines.append("")
            lines.append("**Strengths:**")
            for s in strengths:
                lines.append(f"- {s}")

        tips = model.get("tips", [])
        if len(tips) > 0:
            lines.append("")
            lines.append("**Tips:**")
            for t in tips:
                lines.append(f"- {t}")

        avoid = model.get("avoid", [])
        if len(avoid) > 0:
            lines.append("")
            lines.append("**Avoid:**")
            for a in avoid:
                lines.append(f"- {a}")

        if mode and len(mode.get("tips", [])) > 0:
            lines.append("")
            lines.append("**Mode-specific tips:**")
            for t in mode["tips"]:
                lines.append(f"- {t}")

    else:
        # Fallback
        fallback = result["fallback"]

        lines.append("## General Prompting Tips")
        lines.append("")

        tips = fallback.get("tips", [])
        if len(tips) > 0:
            lines.append("**Tips:**")
            for t in tips:
                lines.append(f"- {t}")

        avoid = fallback.get("avoid", [])
        if len(avoid) > 0:
            lines.append("")
            lines.append("**Avoid:**")
            for a in avoid:
                lines.append(f"- {a}")

    return "\n".join(lines)
