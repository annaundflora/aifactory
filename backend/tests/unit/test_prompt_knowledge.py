"""Unit tests for app.agent.prompt_knowledge module.

Tests the Python lookup function for prompt-knowledge.json:
prefix matching, mode filtering, fallback, slash-stripping,
module-level cache, and format_knowledge_for_prompt output.

Mocking Strategy: mock_external -- JSON data is provided via
monkeypatch fixture so tests do not depend on the real file.
"""

import pytest


# ---------------------------------------------------------------------------
# Fixture: Provide controlled JSON data via monkeypatch
# ---------------------------------------------------------------------------

# Sample knowledge data with two prefixes that share a common start
# ("flux-2" and "flux-2-pro") to test longest-prefix-match logic.
SAMPLE_KNOWLEDGE = {
    "models": {
        "flux-2": {
            "displayName": "Flux 2",
            "promptStyle": "natural",
            "negativePrompts": {
                "supported": False,
                "note": "Flux 2 does not support negative prompts.",
            },
            "strengths": ["Photorealistic rendering"],
            "tips": [
                "Use detailed natural-language descriptions",
                "Specify lighting explicitly",
            ],
            "avoid": ["Keyword-style tag lists"],
            "modes": {
                "txt2img": {
                    "tips": [
                        "Start with the main subject",
                        "Specify aspect ratio",
                    ]
                },
                "img2img": {
                    "tips": [
                        "Describe changes relative to source",
                    ]
                },
            },
        },
        "flux-2-pro": {
            "displayName": "Flux 2 Pro",
            "promptStyle": "natural",
            "negativePrompts": {
                "supported": False,
                "note": "Flux 2 Pro does not support negative prompts.",
            },
            "strengths": ["Best quality in Flux family"],
            "tips": [
                "Write detailed scene descriptions",
                "Reference art styles for non-photo output",
            ],
            "avoid": ["Overly short prompts"],
            "modes": {
                "txt2img": {
                    "tips": [
                        "Layer in environment after subject",
                    ]
                },
            },
        },
        "some-model": {
            "displayName": "Some Model",
            "promptStyle": "natural",
            "tips": ["General tip for some-model"],
            "avoid": ["Something to avoid"],
            # NOTE: no "modes" key at all -- used for AC-5
        },
    },
    "fallback": {
        "displayName": "Generic",
        "tips": [
            "Be specific and descriptive",
            "Include details about style and lighting",
        ],
        "avoid": [
            "Vague or overly short prompts",
        ],
    },
}


@pytest.fixture(autouse=True)
def _patch_knowledge_cache(monkeypatch):
    """Inject SAMPLE_KNOWLEDGE into the module-level cache so tests
    never hit the real filesystem.

    After each test the cache is reset to None so tests are isolated.
    """
    import app.agent.prompt_knowledge as pk

    # Set the module-level cache directly
    monkeypatch.setattr(pk, "_cached_data", SAMPLE_KNOWLEDGE)

    yield

    # Reset after test (monkeypatch already undoes setattr, but be explicit)
    pk._cached_data = None


# ===========================================================================
# TestGetPromptKnowledge
# ===========================================================================


class TestGetPromptKnowledge:
    """Tests for get_prompt_knowledge() covering prefix matching, mode
    filtering, fallback, slash-stripping, and caching."""

    # AC-1: Laengster Prefix gewinnt
    def test_longest_prefix_wins(self):
        """AC-1: GIVEN prompt-knowledge.json enthaelt Prefixe 'flux-2-pro'
        und 'flux-2'
        WHEN get_prompt_knowledge('flux-2-pro-ultra') aufgerufen wird
        THEN wird der Eintrag fuer Prefix 'flux-2-pro' zurueckgegeben
        (laengster Match gewinnt, nicht 'flux-2').
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("flux-2-pro-ultra")

        assert result["kind"] == "model"
        assert result["displayName"] == "Flux 2 Pro"
        # Must NOT match the shorter "flux-2" prefix
        assert result["displayName"] != "Flux 2"

    # AC-2: Einfacher Prefix-Match
    def test_simple_prefix_match(self):
        """AC-2: GIVEN prompt-knowledge.json enthaelt Prefix 'flux-2'
        WHEN get_prompt_knowledge('flux-2-max') aufgerufen wird
        THEN wird der Eintrag fuer Prefix 'flux-2' zurueckgegeben.
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("flux-2-max")

        assert result["kind"] == "model"
        assert result["displayName"] == "Flux 2"

    # AC-3: Fallback bei unbekanntem Modell
    def test_fallback_for_unknown_model(self):
        """AC-3: GIVEN prompt-knowledge.json enthaelt keinen passenden
        Prefix fuer 'unknown-model-xyz'
        WHEN get_prompt_knowledge('unknown-model-xyz') aufgerufen wird
        THEN wird das fallback-Objekt zurueckgegeben
        (mit displayName == 'Generic').
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("unknown-model-xyz")

        assert result["kind"] == "fallback"
        assert result["displayName"] == "Generic"
        assert "fallback" in result
        assert result["fallback"]["displayName"] == "Generic"

    # AC-4: Modus-spezifische Tipps bei txt2img
    def test_includes_txt2img_mode_tips(self):
        """AC-4: GIVEN ein Modell-Eintrag hat modes.txt2img mit Tipps
        WHEN get_prompt_knowledge('flux-2-pro', 'txt2img') aufgerufen wird
        THEN enthaelt das Ergebnis sowohl die allgemeinen Modell-Tipps
        als auch die modus-spezifischen txt2img-Tipps.
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("flux-2-pro", "txt2img")

        assert result["kind"] == "model"
        # General model tips must be present
        assert "model" in result
        assert len(result["model"]["tips"]) > 0
        # Mode-specific tips must be present
        assert "mode" in result
        assert len(result["mode"]["tips"]) > 0
        assert "Layer in environment after subject" in result["mode"]["tips"]

    # AC-5: Graceful bei fehlendem Modus-Eintrag
    def test_graceful_when_mode_section_missing(self):
        """AC-5: GIVEN ein Modell-Eintrag hat KEINE modes.img2img-Sektion
        WHEN get_prompt_knowledge('some-model', 'img2img') aufgerufen wird
        THEN enthaelt das Ergebnis nur die allgemeinen Modell-Tipps
        (kein Fehler, kein Crash).
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        # "some-model" has no "modes" key at all
        result = get_prompt_knowledge("some-model", "img2img")

        assert result["kind"] == "model"
        assert result["displayName"] == "Some Model"
        # General model tips present
        assert "model" in result
        assert len(result["model"]["tips"]) > 0
        # No mode section since img2img does not exist on this model
        assert "mode" not in result

    # AC-6: Kein Modus -> nur allgemeine Tipps
    def test_no_mode_returns_model_tips_only(self):
        """AC-6: GIVEN get_prompt_knowledge wird ohne Modus aufgerufen
        (mode ist None)
        WHEN das Ergebnis geprueft wird
        THEN enthaelt es nur die allgemeinen Modell-Tipps
        (keine Modus-Sektion).
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("flux-2-pro")

        assert result["kind"] == "model"
        assert "model" in result
        assert len(result["model"]["tips"]) > 0
        # No mode section when mode=None
        assert "mode" not in result

    # AC-7: Slash-Stripping bei owner/model-name
    def test_strips_owner_prefix_before_slash(self):
        """AC-7: GIVEN eine Model-ID im Format 'owner/model-name'
        (z.B. 'black-forest-labs/flux-2-pro')
        WHEN get_prompt_knowledge('black-forest-labs/flux-2-pro')
        aufgerufen wird
        THEN wird der Teil vor dem '/' gestrippt und das
        Prefix-Matching erfolgt gegen 'flux-2-pro'.
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("black-forest-labs/flux-2-pro")

        assert result["kind"] == "model"
        assert result["displayName"] == "Flux 2 Pro"

    # AC-8: Model-ID ohne Slash funktioniert
    def test_handles_model_id_without_slash(self):
        """AC-8: GIVEN eine Model-ID ohne Slash (z.B. 'flux-2-pro')
        WHEN get_prompt_knowledge('flux-2-pro') aufgerufen wird
        THEN funktioniert das Matching identisch wie mit Slash
        (kein Crash bei fehlendem Slash).
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result_with_slash = get_prompt_knowledge("black-forest-labs/flux-2-pro")
        result_without_slash = get_prompt_knowledge("flux-2-pro")

        assert result_with_slash["kind"] == result_without_slash["kind"]
        assert result_with_slash["displayName"] == result_without_slash["displayName"]
        assert result_with_slash["model"]["tips"] == result_without_slash["model"]["tips"]
        assert result_with_slash["model"]["avoid"] == result_without_slash["model"]["avoid"]

    # AC-11: Module-level Cache
    def test_does_not_reload_json_on_subsequent_calls(self):
        """AC-11: GIVEN die JSON-Datei wurde bereits einmal geladen
        WHEN get_prompt_knowledge ein zweites Mal aufgerufen wird
        THEN wird die Datei NICHT erneut vom Dateisystem gelesen
        (module-level Cache).
        """
        import app.agent.prompt_knowledge as pk
        from app.agent.prompt_knowledge import get_prompt_knowledge

        # First call -- cache is already populated by fixture
        result1 = get_prompt_knowledge("flux-2-pro")

        # Verify cache is populated (not None)
        assert pk._cached_data is not None

        # Store reference to cached data
        cached_ref = pk._cached_data

        # Second call
        result2 = get_prompt_knowledge("flux-2-pro")

        # Cache object identity must be the same (no reload)
        assert pk._cached_data is cached_ref

        # Results must be identical
        assert result1["displayName"] == result2["displayName"]

    # AC-12: Identische Ergebnisse wie TS-Version
    def test_matches_ts_version_output_for_same_inputs(self):
        """AC-12: GIVEN identische Inputs (model_id='flux-2-pro',
        mode='txt2img')
        WHEN get_prompt_knowledge in Python aufgerufen wird
        THEN liefert die Python-Version die gleichen displayName-,
        tips- und avoid-Werte wie die TS-Version es tun wuerde
        (verified via shared JSON source).

        Since we cannot call the TS version from Python, we verify
        the structural contract: same JSON input produces the expected
        displayName, tips, and avoid values that the TS version would
        also produce from the same JSON.
        """
        from app.agent.prompt_knowledge import get_prompt_knowledge

        result = get_prompt_knowledge("flux-2-pro", "txt2img")

        # Verify the result contains the exact data from the JSON
        # (which is the shared source for both Python and TS)
        assert result["displayName"] == SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["displayName"]
        assert result["model"]["tips"] == SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["tips"]
        assert result["model"]["avoid"] == SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["avoid"]
        # Mode tips must also match
        assert result["mode"]["tips"] == SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["modes"]["txt2img"]["tips"]


# ===========================================================================
# TestFormatKnowledgeForPrompt
# ===========================================================================


class TestFormatKnowledgeForPrompt:
    """Tests for format_knowledge_for_prompt() covering string output
    for both model and fallback results."""

    # AC-9: Nicht-leerer String fuer System-Prompt
    def test_returns_non_empty_string(self):
        """AC-9: GIVEN ein gueltiges Lookup-Ergebnis (Modell oder Fallback)
        WHEN format_knowledge_for_prompt(result) aufgerufen wird
        THEN wird ein nicht-leerer String zurueckgegeben, der fuer
        System-Prompt-Injection geeignet ist.
        """
        from app.agent.prompt_knowledge import (
            format_knowledge_for_prompt,
            get_prompt_knowledge,
        )

        # Test with model result
        model_result = get_prompt_knowledge("flux-2-pro")
        formatted_model = format_knowledge_for_prompt(model_result)

        assert isinstance(formatted_model, str)
        assert len(formatted_model) > 0

        # Test with fallback result
        fallback_result = get_prompt_knowledge("unknown-model-xyz")
        formatted_fallback = format_knowledge_for_prompt(fallback_result)

        assert isinstance(formatted_fallback, str)
        assert len(formatted_fallback) > 0

    # AC-10: Modell-Tipps und Modus-Tipps im formatierten String
    def test_includes_model_and_mode_tips(self):
        """AC-10: GIVEN ein Lookup-Ergebnis mit Modell-Tipps UND Modus-Tipps
        WHEN format_knowledge_for_prompt(result) aufgerufen wird
        THEN enthaelt der String sowohl die allgemeinen Tipps als auch
        die Modus-Tipps in lesbarem Format.
        """
        from app.agent.prompt_knowledge import (
            format_knowledge_for_prompt,
            get_prompt_knowledge,
        )

        result = get_prompt_knowledge("flux-2-pro", "txt2img")
        formatted = format_knowledge_for_prompt(result)

        # Must contain model-level tips
        for tip in SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["tips"]:
            assert tip in formatted, f"Model tip missing: {tip}"

        # Must contain model-level avoid items
        for avoid in SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["avoid"]:
            assert avoid in formatted, f"Model avoid missing: {avoid}"

        # Must contain mode-specific tips
        for mode_tip in SAMPLE_KNOWLEDGE["models"]["flux-2-pro"]["modes"]["txt2img"]["tips"]:
            assert mode_tip in formatted, f"Mode tip missing: {mode_tip}"

        # Must contain a heading with the model display name
        assert "Flux 2 Pro" in formatted

    # Extra: Verify fallback formatting includes all content
    def test_fallback_format_includes_tips_and_avoid(self):
        """Verify that fallback results are formatted with tips and avoid
        sections in readable format."""
        from app.agent.prompt_knowledge import (
            format_knowledge_for_prompt,
            get_prompt_knowledge,
        )

        result = get_prompt_knowledge("unknown-model-xyz")
        formatted = format_knowledge_for_prompt(result)

        # Must contain fallback tips
        for tip in SAMPLE_KNOWLEDGE["fallback"]["tips"]:
            assert tip in formatted, f"Fallback tip missing: {tip}"

        # Must contain fallback avoid items
        for avoid in SAMPLE_KNOWLEDGE["fallback"]["avoid"]:
            assert avoid in formatted, f"Fallback avoid missing: {avoid}"
