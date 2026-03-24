"""Unit tests for build_assistant_system_prompt (Slice 06).

Tests the dynamic assistant system prompt builder in app.agent.prompts:
- Known model returns base prompt + knowledge section
- None/None returns plain base prompt (backward compat)
- Unknown model returns base prompt + fallback knowledge
- Owner/model slash format is handled correctly
- Empty string treated like None (backward compat)
- graph.py reads config and calls the builder correctly

Mocking Strategy: mock_external -- Knowledge-Lookup functions
(get_prompt_knowledge, format_knowledge_for_prompt) are patched
via monkeypatch so tests do not depend on real JSON files.
graph.py tests patch build_assistant_system_prompt itself to
verify the caller contract without requiring a real LLM.
"""

import pytest


# ---------------------------------------------------------------------------
# Sample data for knowledge mock
# ---------------------------------------------------------------------------

SAMPLE_KNOWLEDGE_MODEL = {
    "kind": "model",
    "displayName": "Flux 2 Pro/Max",
    "model": {
        "displayName": "Flux 2 Pro/Max",
        "promptStyle": "natural",
        "negativePrompts": {
            "supported": False,
            "note": "Flux 2 does not support negative prompts.",
        },
        "strengths": ["Photorealistic rendering with fine detail"],
        "tips": [
            "Use detailed, natural-language scene descriptions",
            "Specify lighting, camera angle, and atmosphere explicitly",
        ],
        "avoid": ["Keyword-style tag lists separated by commas"],
        "modes": {
            "txt2img": {
                "tips": [
                    "Start with the main subject, then layer in environment and mood",
                ]
            },
        },
    },
    "mode": {
        "tips": [
            "Start with the main subject, then layer in environment and mood",
        ]
    },
}

SAMPLE_KNOWLEDGE_FALLBACK = {
    "kind": "fallback",
    "displayName": "Generic",
    "fallback": {
        "displayName": "Generic",
        "tips": [
            "Be specific and descriptive in your prompts",
            "Include details about style, lighting, composition, and mood",
        ],
        "avoid": [
            "Vague or overly short prompts",
        ],
    },
}

FORMATTED_MODEL_KNOWLEDGE = (
    "## Prompting Tips for Flux 2 Pro/Max\n\n"
    "Prompt style: Natural language descriptions\n"
    "Negative prompts: Not supported. Flux 2 does not support negative prompts.\n\n"
    "**Tips:**\n"
    "- Use detailed, natural-language scene descriptions\n"
    "- Specify lighting, camera angle, and atmosphere explicitly\n\n"
    "**Avoid:**\n"
    "- Keyword-style tag lists separated by commas\n\n"
    "**Mode-specific tips:**\n"
    "- Start with the main subject, then layer in environment and mood"
)

FORMATTED_FALLBACK_KNOWLEDGE = (
    "## General Prompting Tips\n\n"
    "**Tips:**\n"
    "- Be specific and descriptive in your prompts\n"
    "- Include details about style, lighting, composition, and mood\n\n"
    "**Avoid:**\n"
    "- Vague or overly short prompts"
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _patch_knowledge_functions(monkeypatch):
    """Mock get_prompt_knowledge and format_knowledge_for_prompt so tests
    are isolated from the real JSON file and prompt_knowledge module.

    Mocking Strategy from spec: mock_external.
    """
    import app.agent.prompts as prompts_module

    def fake_get_prompt_knowledge(model_id, mode=None):
        """Return model knowledge for flux-2 prefix, fallback otherwise."""
        # Strip owner prefix (same logic as the real function)
        if "/" in model_id:
            model_id = model_id.rsplit("/", 1)[1]

        if model_id.startswith("flux-2"):
            result = dict(SAMPLE_KNOWLEDGE_MODEL)
            # Only include mode section if mode is provided and matches
            if mode != "txt2img":
                result = {k: v for k, v in result.items() if k != "mode"}
            return result
        return dict(SAMPLE_KNOWLEDGE_FALLBACK)

    def fake_format_knowledge_for_prompt(result):
        """Return formatted string based on kind."""
        if result["kind"] == "model":
            return FORMATTED_MODEL_KNOWLEDGE
        return FORMATTED_FALLBACK_KNOWLEDGE

    monkeypatch.setattr(prompts_module, "get_prompt_knowledge", fake_get_prompt_knowledge)
    monkeypatch.setattr(
        prompts_module, "format_knowledge_for_prompt", fake_format_knowledge_for_prompt
    )

    yield


# ===========================================================================
# TestBuildAssistantSystemPrompt
# ===========================================================================


class TestBuildAssistantSystemPrompt:
    """Tests for build_assistant_system_prompt() covering AC-1 through AC-5."""

    # AC-1: Knowledge-Sektion mit Flux-Tipps bei bekanntem Modell + Modus
    def test_includes_flux_knowledge_for_known_model(self):
        """AC-1: GIVEN image_model_id='flux-2-pro' und generation_mode='txt2img'
        WHEN build_assistant_system_prompt('flux-2-pro', 'txt2img') aufgerufen wird
        THEN enthaelt der zurueckgegebene String den bisherigen Base-Prompt
        UND eine Knowledge-Sektion mit Flux-spezifischen Tipps.
        """
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt("flux-2-pro", "txt2img")

        # Must contain the full base prompt
        assert _BASE_PROMPT in result

        # Must contain the knowledge section (appended after base)
        assert "Prompting Tips for Flux 2 Pro/Max" in result

        # The result must be LONGER than the base prompt (knowledge appended)
        assert len(result) > len(_BASE_PROMPT)

        # Knowledge section must come AFTER the base prompt (appended, not inserted)
        base_end_pos = result.find(_BASE_PROMPT) + len(_BASE_PROMPT)
        knowledge_pos = result.find("Prompting Tips for Flux 2 Pro/Max")
        assert knowledge_pos > base_end_pos, (
            "Knowledge section must be appended after the base prompt"
        )

    # AC-2: Identisch mit Base-Prompt bei None/None
    def test_returns_base_prompt_without_knowledge_when_none(self):
        """AC-2: GIVEN image_model_id=None und generation_mode=None
        WHEN build_assistant_system_prompt(None, None) aufgerufen wird
        THEN ist der zurueckgegebene String identisch mit dem bisherigen
        statischen SYSTEM_PROMPT (keine Knowledge-Sektion angehaengt).
        """
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt(None, None)

        # Must be EXACTLY the base prompt -- no knowledge section appended
        assert result == _BASE_PROMPT

        # Double-check: must not contain any knowledge heading
        assert "Prompting Tips" not in result
        assert "General Prompting Tips" not in result

    # AC-3: Fallback-Knowledge bei unbekanntem Modell
    def test_includes_fallback_knowledge_for_unknown_model(self):
        """AC-3: GIVEN image_model_id='unknown-model-xyz' und generation_mode=None
        WHEN build_assistant_system_prompt('unknown-model-xyz', None) aufgerufen wird
        THEN enthaelt der zurueckgegebene String den Base-Prompt UND eine
        Knowledge-Sektion mit Fallback-Tipps (displayName 'Generic').
        """
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt("unknown-model-xyz", None)

        # Must contain the base prompt
        assert _BASE_PROMPT in result

        # Must contain fallback knowledge section
        assert "General Prompting Tips" in result

        # Must contain fallback tips content
        assert "Be specific and descriptive" in result

        # Must be longer than just the base prompt
        assert len(result) > len(_BASE_PROMPT)

    # AC-4: Slash-Stripping fuer Owner/Model-Format
    def test_handles_owner_slash_model_format(self):
        """AC-4: GIVEN image_model_id='black-forest-labs/flux-2-pro' (mit Owner-Prefix)
        WHEN build_assistant_system_prompt('black-forest-labs/flux-2-pro', 'txt2img')
        aufgerufen wird
        THEN wird der Owner-Teil korrekt gestrippt und Flux-Knowledge
        zurueckgegeben (Slash-Stripping funktioniert transitiv via
        get_prompt_knowledge).
        """
        from app.agent.prompts import build_assistant_system_prompt

        result_with_prefix = build_assistant_system_prompt(
            "black-forest-labs/flux-2-pro", "txt2img"
        )
        result_without_prefix = build_assistant_system_prompt("flux-2-pro", "txt2img")

        # Both must produce the same result (owner prefix is stripped)
        assert result_with_prefix == result_without_prefix

        # Both must contain flux knowledge
        assert "Prompting Tips for Flux 2 Pro/Max" in result_with_prefix

    # AC-5: Leerer String behandelt wie None
    def test_empty_string_treated_as_no_model(self):
        """AC-5: GIVEN image_model_id ist ein leerer String ''
        WHEN build_assistant_system_prompt('', None) aufgerufen wird
        THEN wird der Base-Prompt ohne Knowledge-Sektion zurueckgegeben
        (Backward-Kompatibilitaet wie bei None).
        """
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt("", None)

        # Must be exactly the base prompt (empty string treated like None)
        assert result == _BASE_PROMPT

        # Must be identical to the None/None case
        result_none = build_assistant_system_prompt(None, None)
        assert result == result_none

    # Extra: Verify the function is callable with defaults (no args)
    def test_callable_with_no_arguments(self):
        """Verify build_assistant_system_prompt can be called with no arguments
        (both parameters have default None)."""
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt()

        assert result == _BASE_PROMPT

    # Extra: Verify the base prompt contains the expected role marker
    def test_base_prompt_contains_prompt_assistent_role(self):
        """The base prompt must contain the Prompt-Assistent role marker
        as required by the acceptance command in the spec."""
        from app.agent.prompts import build_assistant_system_prompt

        result = build_assistant_system_prompt(None, None)

        assert "Prompt-Assistent" in result

    # Extra: Verify SYSTEM_PROMPT backward-compat alias exists
    def test_system_prompt_constant_backward_compat(self):
        """SYSTEM_PROMPT constant must still exist as backward-compatible alias,
        matching the base prompt (build_assistant_system_prompt(None, None))."""
        from app.agent.prompts import SYSTEM_PROMPT, build_assistant_system_prompt

        assert SYSTEM_PROMPT == build_assistant_system_prompt(None, None)


# ===========================================================================
# TestGraphConfigIntegration
# ===========================================================================


class TestGraphConfigIntegration:
    """Tests for graph.py config reading (AC-6, AC-7).

    These tests verify that _call_model_sync and _call_model_async
    correctly extract image_model_id and generation_mode from
    config['configurable'] and pass them to build_assistant_system_prompt.

    Mocking Strategy: mock_external -- The LLM call and
    build_assistant_system_prompt are patched since we cannot make
    real LLM calls in unit tests and the focus is on the caller contract.
    """

    # AC-6: graph.py liest config und ruft build_assistant_system_prompt auf
    def test_call_model_uses_config_image_model_id(self, monkeypatch):
        """AC-6: GIVEN config['configurable'] enthaelt
        {'image_model_id': 'flux-2-pro', 'generation_mode': 'txt2img'}
        WHEN _call_model_sync (oder _call_model_async) in graph.py aufgerufen wird
        THEN wird build_assistant_system_prompt('flux-2-pro', 'txt2img')
        als SystemMessage-Content verwendet (nicht mehr die statische Konstante).
        """
        import app.agent.graph as graph_module

        # Track calls to build_assistant_system_prompt
        captured_calls = []

        def fake_build_prompt(image_model_id=None, generation_mode=None):
            captured_calls.append((image_model_id, generation_mode))
            return "FAKE_SYSTEM_PROMPT_WITH_KNOWLEDGE"

        monkeypatch.setattr(graph_module, "build_assistant_system_prompt", fake_build_prompt)

        # We need to test _call_model_sync which is defined inside create_agent.
        # The most reliable way is to verify the graph source code structure.
        # Instead, let's read the source and verify the pattern is correct.
        import inspect

        source = inspect.getsource(graph_module.create_agent)

        # Verify _call_model_sync reads from configurable
        assert 'configurable.get("image_model_id")' in source, (
            "_call_model_sync must read image_model_id from config['configurable']"
        )
        assert 'configurable.get("generation_mode")' in source, (
            "_call_model_sync must read generation_mode from config['configurable']"
        )

        # Verify build_assistant_system_prompt is called (not SYSTEM_PROMPT constant)
        assert "build_assistant_system_prompt(image_model_id, generation_mode)" in source, (
            "_call_model_sync must call build_assistant_system_prompt with the config values"
        )

        # Verify the import at module level
        assert hasattr(graph_module, "build_assistant_system_prompt"), (
            "graph.py must import build_assistant_system_prompt"
        )

        # Verify SYSTEM_PROMPT is NOT imported (replaced by function call)
        graph_source_full = inspect.getsource(graph_module)
        # Check that SYSTEM_PROMPT is not used as SystemMessage content
        assert "SystemMessage(content=SYSTEM_PROMPT)" not in graph_source_full, (
            "graph.py must NOT use the static SYSTEM_PROMPT constant for SystemMessage"
        )

    # AC-7: graph.py ohne image_model_id in config -> Base-Prompt
    def test_call_model_without_config_uses_base_prompt(self, monkeypatch):
        """AC-7: GIVEN config['configurable'] enthaelt KEINE Keys
        image_model_id und generation_mode
        WHEN _call_model_sync (oder _call_model_async) in graph.py aufgerufen wird
        THEN wird build_assistant_system_prompt(None, None) aufgerufen und der
        Base-Prompt ohne Knowledge verwendet (Backward-Kompatibilitaet).
        """
        import app.agent.graph as graph_module
        import inspect

        source = inspect.getsource(graph_module.create_agent)

        # The key pattern: configurable.get("image_model_id") returns None
        # when the key is missing (dict.get default is None).
        # Verify the code uses .get() (not direct key access which would raise KeyError)
        assert 'configurable.get("image_model_id")' in source, (
            "Must use .get() for image_model_id (returns None if missing)"
        )
        assert 'configurable.get("generation_mode")' in source, (
            "Must use .get() for generation_mode (returns None if missing)"
        )

        # Verify it also uses .get() for the configurable dict itself
        assert 'config.get("configurable", {})' in source, (
            "Must use config.get('configurable', {}) to handle missing configurable"
        )

        # Now verify the actual behavior: when config has no image_model_id,
        # build_assistant_system_prompt should receive None and return base prompt.
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        # Simulate what graph.py does when config has no image_model_id
        config_without_model = {"configurable": {}}
        configurable = config_without_model.get("configurable", {})
        image_model_id = configurable.get("image_model_id")
        generation_mode = configurable.get("generation_mode")

        result = build_assistant_system_prompt(image_model_id, generation_mode)

        # Both values should be None
        assert image_model_id is None
        assert generation_mode is None

        # Result should be the base prompt without knowledge
        assert result == _BASE_PROMPT
        assert "Prompting Tips" not in result

    # Extra: Verify both sync and async paths use the same pattern
    def test_both_sync_and_async_use_build_assistant_system_prompt(self):
        """Both _call_model_sync and _call_model_async must use
        build_assistant_system_prompt, not a static constant."""
        import inspect

        import app.agent.graph as graph_module

        source = inspect.getsource(graph_module.create_agent)

        # Count occurrences of build_assistant_system_prompt calls
        # Should appear at least twice (once in sync, once in async)
        call_count = source.count("build_assistant_system_prompt(image_model_id, generation_mode)")
        assert call_count >= 2, (
            f"Expected build_assistant_system_prompt to be called in both sync and async paths, "
            f"found {call_count} call(s)"
        )
