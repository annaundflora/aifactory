"""Chat LLM multimodal capability limits.

Pure, side-effect-free constants module exposing per-model multimodal caps
(max_images, max_total_bytes, vision flag) for the OpenRouter chat-LLM
allowlist, plus a fail-safe lookup helper.

Separation rationale (architecture.md Q9): the existing
`data/prompt-knowledge.json` covers IMAGE models only (flux, nano-banana,
gpt-image-...), not chat LLMs. Chat-LLM caps are deliberately kept in this
dedicated module.

Allowlist parity: model IDs in `CHAT_LLM_LIMITS` MUST match the OpenRouter
allowlist defined in `backend/app/config.py`. Constants are duplicated by
design (no import) — see architecture.md Q9.

Exports:
    CHAT_LLM_LIMITS: dict[str, dict[str, int | bool]]
    DEFAULT_LIMITS:  dict[str, int | bool]
    get_chat_llm_limits(model_id: str | None) -> dict
"""

from __future__ import annotations

from typing import Optional

# ---------------------------------------------------------------------------
# Constants — values per architecture.md → "Multimodal Pipeline Architecture"
# → "Cap source"
# ---------------------------------------------------------------------------

CHAT_LLM_LIMITS: dict[str, dict[str, int | bool]] = {
    "anthropic/claude-sonnet-4.6": {
        "max_images": 5,
        "max_total_bytes": 20_000_000,
        "vision": True,
    },
    "openai/gpt-5.4": {
        "max_images": 4,
        "max_total_bytes": 16_000_000,
        "vision": True,
    },
    "google/gemini-3.1-pro-preview": {
        "max_images": 8,
        "max_total_bytes": 32_000_000,
        "vision": True,
    },
}

DEFAULT_LIMITS: dict[str, int | bool] = {
    "max_images": 4,
    "max_total_bytes": 16_000_000,
    "vision": False,
}


# ---------------------------------------------------------------------------
# Lookup helper — fail-safe, returns a fresh copy to prevent state mutation
# ---------------------------------------------------------------------------


def get_chat_llm_limits(model_id: Optional[str]) -> dict[str, int | bool]:
    """Return multimodal caps for a chat LLM model ID.

    Fail-safe semantics:
    - Unknown model ID, ``None``, or empty string returns a copy of
      ``DEFAULT_LIMITS`` (vision=False → text-only fallback).
    - Returned dict is always a fresh shallow copy; caller mutation cannot
      corrupt module-level state.

    Args:
        model_id: OpenRouter chat-LLM model ID, or ``None``.

    Returns:
        Dict with keys ``max_images`` (int), ``max_total_bytes`` (int),
        ``vision`` (bool).
    """
    if not model_id:
        return dict(DEFAULT_LIMITS)

    entry = CHAT_LLM_LIMITS.get(model_id)
    if entry is None:
        return dict(DEFAULT_LIMITS)

    return dict(entry)
