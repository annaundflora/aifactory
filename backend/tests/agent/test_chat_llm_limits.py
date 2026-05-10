"""Acceptance tests for slice-20: chat_llm_limits-Modul.

Test file path defined by the slice spec:
specs/.../slices/slice-20-chat-llm-limits-module.md

Mocking Strategy: no_mocks (pure constants + lookup, no I/O).
Each test maps 1:1 to a GIVEN/WHEN/THEN AC from the spec.
"""

from __future__ import annotations

import pytest

from app.agent.chat_llm_limits import (
    CHAT_LLM_LIMITS,
    DEFAULT_LIMITS,
    get_chat_llm_limits,
)


# ---------------------------------------------------------------------------
# AC-1: CHAT_LLM_LIMITS-Dict enthaelt alle Allowlist-Modelle
# ---------------------------------------------------------------------------
def test_chat_llm_limits_contains_all_allowlist_models():
    """AC-1.

    GIVEN das neue Modul `backend/app/agent/chat_llm_limits.py`
    WHEN `CHAT_LLM_LIMITS` importiert wird
    THEN enthaelt das Dict exakt die drei Keys aus der Allowlist
    (`anthropic/claude-sonnet-4.6`, `openai/gpt-5.4`,
    `google/gemini-3.1-pro-preview`); jeder Wert hat die Pflicht-Felder
    `max_images: int`, `max_total_bytes: int`, `vision: bool`.
    """
    # Arrange (GIVEN): module-level constant imported above.
    expected_keys = {
        "anthropic/claude-sonnet-4.6",
        "openai/gpt-5.4",
        "google/gemini-3.1-pro-preview",
    }

    # Act / Assert (WHEN/THEN)
    assert set(CHAT_LLM_LIMITS.keys()) == expected_keys, (
        "CHAT_LLM_LIMITS must contain exactly the three allowlist model IDs"
    )

    required_fields = {"max_images", "max_total_bytes", "vision"}
    for model_id, entry in CHAT_LLM_LIMITS.items():
        assert isinstance(entry, dict), f"{model_id} entry must be dict"
        assert set(entry.keys()) >= required_fields, (
            f"{model_id} missing required fields; got {entry.keys()}"
        )
        assert isinstance(entry["max_images"], int), (
            f"{model_id}.max_images must be int"
        )
        # bool is subclass of int in Python — exclude explicitly
        assert not isinstance(entry["max_images"], bool), (
            f"{model_id}.max_images must be int, not bool"
        )
        assert isinstance(entry["max_total_bytes"], int), (
            f"{model_id}.max_total_bytes must be int"
        )
        assert not isinstance(entry["max_total_bytes"], bool), (
            f"{model_id}.max_total_bytes must be int, not bool"
        )
        assert isinstance(entry["vision"], bool), (
            f"{model_id}.vision must be bool"
        )


# ---------------------------------------------------------------------------
# AC-2: Bekannte Modelle liefern korrekte Werte
# ---------------------------------------------------------------------------
def test_get_chat_llm_limits_returns_correct_entry_for_claude():
    """AC-2.

    GIVEN ein Allowlist-Modell-ID
    WHEN `get_chat_llm_limits("anthropic/claude-sonnet-4.6")` aufgerufen wird
    THEN ist das Ergebnis
    `{"max_images": 5, "max_total_bytes": 20_000_000, "vision": True}`.
    """
    # Act
    result = get_chat_llm_limits("anthropic/claude-sonnet-4.6")

    # Assert
    assert result == {
        "max_images": 5,
        "max_total_bytes": 20_000_000,
        "vision": True,
    }


def test_get_chat_llm_limits_returns_correct_entry_for_gpt():
    """AC-2.

    GIVEN ein Allowlist-Modell-ID
    WHEN `get_chat_llm_limits("openai/gpt-5.4")` aufgerufen wird
    THEN sind die Werte die in architecture.md `Cap source` definierten
    multimodal caps fuer GPT (max_images, max_total_bytes, vision=True).
    """
    # Act
    result = get_chat_llm_limits("openai/gpt-5.4")

    # Assert — vision-capable, ints positive
    assert result["vision"] is True, "GPT chat-llm cap must be vision=True"
    assert isinstance(result["max_images"], int) and not isinstance(
        result["max_images"], bool
    )
    assert result["max_images"] > 0
    assert isinstance(result["max_total_bytes"], int) and not isinstance(
        result["max_total_bytes"], bool
    )
    assert result["max_total_bytes"] > 0
    # Architecture.md "Cap source" values (slice spec line 39 + impl):
    # openai/gpt-5.4 = max_images 4, max_total_bytes 16_000_000, vision True.
    assert result == {
        "max_images": 4,
        "max_total_bytes": 16_000_000,
        "vision": True,
    }


def test_get_chat_llm_limits_returns_correct_entry_for_gemini():
    """AC-2.

    GIVEN ein Allowlist-Modell-ID
    WHEN `get_chat_llm_limits("google/gemini-3.1-pro-preview")` aufgerufen wird
    THEN sind die Werte die in architecture.md `Cap source` definierten
    multimodal caps fuer Gemini (max_images, max_total_bytes, vision=True).
    """
    # Act
    result = get_chat_llm_limits("google/gemini-3.1-pro-preview")

    # Assert
    assert result["vision"] is True, "Gemini chat-llm cap must be vision=True"
    assert isinstance(result["max_images"], int) and not isinstance(
        result["max_images"], bool
    )
    assert result["max_images"] > 0
    assert isinstance(result["max_total_bytes"], int) and not isinstance(
        result["max_total_bytes"], bool
    )
    assert result["max_total_bytes"] > 0
    # Architecture.md "Cap source": gemini = max_images 8, 32 MB, vision True.
    assert result == {
        "max_images": 8,
        "max_total_bytes": 32_000_000,
        "vision": True,
    }


# ---------------------------------------------------------------------------
# AC-3: Unbekanntes Modell -> DEFAULT_LIMITS mit vision=False
# ---------------------------------------------------------------------------
def test_get_chat_llm_limits_unknown_model_returns_defaults_with_vision_false():
    """AC-3.

    GIVEN ein nicht-allowlistetes Modell-ID (z.B. `"unknown/model-xyz"`)
    WHEN `get_chat_llm_limits("unknown/model-xyz")` aufgerufen wird
    THEN ist das Ergebnis identisch zu `DEFAULT_LIMITS` und
    `result["vision"] is False` (fail-safe text-only).
    """
    # Act
    result = get_chat_llm_limits("unknown/model-xyz")

    # Assert
    assert result == DEFAULT_LIMITS, (
        "Unknown model must fall back to DEFAULT_LIMITS"
    )
    assert result["vision"] is False, "Fail-safe fallback must be vision=False"


# ---------------------------------------------------------------------------
# AC-4: DEFAULT_LIMITS hat vision=False
# ---------------------------------------------------------------------------
def test_default_limits_has_vision_false_and_required_fields():
    """AC-4.

    GIVEN das Modul-Konstantenset
    WHEN `DEFAULT_LIMITS` inspiziert wird
    THEN ist `DEFAULT_LIMITS["vision"] is False` und enthaelt die Felder
    `max_images`, `max_total_bytes`, `vision` (architecture.md:
    `{"max_images": 4, "max_total_bytes": 16_000_000, "vision": False}`).
    """
    # Required fields
    assert set(DEFAULT_LIMITS.keys()) >= {
        "max_images",
        "max_total_bytes",
        "vision",
    }

    # Field types (exclude bool from int matches)
    assert isinstance(DEFAULT_LIMITS["max_images"], int)
    assert not isinstance(DEFAULT_LIMITS["max_images"], bool)
    assert isinstance(DEFAULT_LIMITS["max_total_bytes"], int)
    assert not isinstance(DEFAULT_LIMITS["max_total_bytes"], bool)
    assert isinstance(DEFAULT_LIMITS["vision"], bool)

    # Concrete values per architecture.md "Cap source"
    assert DEFAULT_LIMITS["vision"] is False
    assert DEFAULT_LIMITS["max_images"] == 4
    assert DEFAULT_LIMITS["max_total_bytes"] == 16_000_000


# ---------------------------------------------------------------------------
# AC-5: Lookup ist Pure (keine Mutation)
# ---------------------------------------------------------------------------
def test_get_chat_llm_limits_repeated_call_is_idempotent():
    """AC-5.

    GIVEN wiederholte Calls mit gleichem Modell-ID
    WHEN `get_chat_llm_limits(model_id)` zweimal hintereinander aufgerufen wird
    THEN ist das Ergebnis strukturell identisch und Mutation am
    zurueckgegebenen Dict beeinflusst NICHT das Ergebnis eines nachfolgenden
    Calls (Helper liefert Kopie oder unveraenderbare Sicht).
    """
    model_id = "anthropic/claude-sonnet-4.6"

    # Act 1
    first = get_chat_llm_limits(model_id)
    snapshot = dict(first)

    # Mutate the returned dict aggressively
    first["max_images"] = 9999
    first["max_total_bytes"] = -1
    first["vision"] = False
    first["injected_field"] = "evil"

    # Act 2
    second = get_chat_llm_limits(model_id)

    # Assert — second call is unaffected by first-call mutation
    assert second == snapshot, (
        "Caller-mutation of the returned dict must not corrupt module state"
    )
    assert "injected_field" not in second
    assert second["max_images"] == 5
    assert second["max_total_bytes"] == 20_000_000
    assert second["vision"] is True

    # Module-level constant must still be pristine
    assert CHAT_LLM_LIMITS[model_id] == {
        "max_images": 5,
        "max_total_bytes": 20_000_000,
        "vision": True,
    }

    # Two independent calls must NOT share the same object identity
    third = get_chat_llm_limits(model_id)
    fourth = get_chat_llm_limits(model_id)
    assert third == fourth
    assert third is not fourth, (
        "Each call should return a fresh copy to prevent shared-state bugs"
    )


def test_get_chat_llm_limits_default_fallback_is_also_isolated():
    """AC-5 (extension).

    Mutation of the DEFAULT_LIMITS fallback result must not corrupt the
    module-level DEFAULT_LIMITS constant.
    """
    snapshot = dict(DEFAULT_LIMITS)

    # Mutate the fallback result
    result = get_chat_llm_limits("totally/unknown")
    result["max_images"] = -42
    result["vision"] = True
    result["new_key"] = "x"

    # Module constant must be pristine
    assert DEFAULT_LIMITS == snapshot
    # Fresh fallback call must yield the original defaults
    fresh = get_chat_llm_limits("totally/unknown")
    assert fresh == snapshot
    assert fresh["vision"] is False


# ---------------------------------------------------------------------------
# AC-6: None / Empty-String faellt auf DEFAULT_LIMITS zurueck
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "model_id",
    [None, ""],
    ids=["none", "empty_string"],
)
def test_get_chat_llm_limits_none_or_empty_returns_defaults(model_id):
    """AC-6.

    GIVEN `model_id` ist `None` oder `""`
    WHEN `get_chat_llm_limits(model_id)` aufgerufen wird
    THEN ist das Ergebnis identisch zu `DEFAULT_LIMITS` (kein Exception-Throw).
    """
    # Act — must NOT raise
    result = get_chat_llm_limits(model_id)

    # Assert
    assert result == DEFAULT_LIMITS
    assert result["vision"] is False
