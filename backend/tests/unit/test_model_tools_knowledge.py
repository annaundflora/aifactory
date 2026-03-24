"""Unit tests for _match_model Knowledge-Enrichment (Slice 10).

Tests that _match_model enriches the reason string with model-specific
strengths from prompt-knowledge.json instead of returning only the
static reason_de from _MATCHING_RULES.

Mocking Strategy: mock_external (as specified in Slice-Spec).
Knowledge-JSON data is provided via monkeypatch fixture;
no real filesystem access for the knowledge file.
"""

import pytest


# ---------------------------------------------------------------------------
# Sample knowledge data for fixtures
# ---------------------------------------------------------------------------

SAMPLE_KNOWLEDGE_WITH_STRENGTHS = {
    "models": {
        "flux-2": {
            "displayName": "Flux 2 Pro/Max",
            "promptStyle": "natural",
            "negativePrompts": {
                "supported": False,
                "note": "Flux 2 does not support negative prompts.",
            },
            "strengths": [
                "Prompt-Treue",
                "technische Fotografie",
            ],
            "tips": ["Use detailed descriptions"],
            "avoid": ["Keyword-style tag lists"],
        },
        "ideogram": {
            "displayName": "Ideogram 3",
            "promptStyle": "natural",
            "negativePrompts": {
                "supported": True,
                "note": "Negative prompts available.",
            },
            "strengths": [
                "Best-in-class text rendering for logos, signs, and posters",
                "Accurate multi-line typography in various styles",
                "Magic Prompt feature for automatic prompt refinement",
            ],
            "tips": ["Place text in quotes"],
            "avoid": ["Mixing too many text elements"],
        },
    },
    "fallback": {
        "displayName": "Generic",
        "tips": ["Be specific"],
        "avoid": ["Vague prompts"],
    },
}

# Knowledge data that has NO matching entry for any model prefix
SAMPLE_KNOWLEDGE_NO_MATCH = {
    "models": {
        "some-unrelated-model": {
            "displayName": "Unrelated",
            "promptStyle": "natural",
            "strengths": ["Something irrelevant"],
            "tips": [],
            "avoid": [],
        },
    },
    "fallback": {
        "displayName": "Generic",
        "tips": ["Be specific"],
        "avoid": ["Vague prompts"],
    },
}

# Empty knowledge data (simulates empty/broken file)
SAMPLE_KNOWLEDGE_EMPTY = {
    "models": {},
    "fallback": {
        "displayName": "Generic",
        "tips": [],
        "avoid": [],
    },
}


# ---------------------------------------------------------------------------
# Sample available_models for _match_model calls
# ---------------------------------------------------------------------------

FLUX_MODELS = [
    {
        "owner": "black-forest-labs",
        "name": "flux-2-pro",
        "run_count": 5000000,
        "description": "Flux 2 Pro",
        "url": "https://replicate.com/black-forest-labs/flux-2-pro",
    },
]

IDEOGRAM_MODELS = [
    {
        "owner": "ideogram-ai",
        "name": "ideogram-3",
        "run_count": 1000000,
        "description": "Ideogram 3",
        "url": "https://replicate.com/ideogram-ai/ideogram-3",
    },
]

MIXED_MODELS = FLUX_MODELS + IDEOGRAM_MODELS + [
    {
        "owner": "stability-ai",
        "name": "sdxl",
        "run_count": 3000000,
        "description": "Stable Diffusion XL",
        "url": "https://replicate.com/stability-ai/sdxl",
    },
]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def patch_knowledge_with_strengths(monkeypatch):
    """Inject knowledge data that has strengths for flux-2 and ideogram."""
    import app.agent.prompt_knowledge as pk
    monkeypatch.setattr(pk, "_cached_data", SAMPLE_KNOWLEDGE_WITH_STRENGTHS)
    yield
    pk._cached_data = None


@pytest.fixture()
def patch_knowledge_no_match(monkeypatch):
    """Inject knowledge data that has NO matching prefix for flux or ideogram."""
    import app.agent.prompt_knowledge as pk
    monkeypatch.setattr(pk, "_cached_data", SAMPLE_KNOWLEDGE_NO_MATCH)
    yield
    pk._cached_data = None


@pytest.fixture()
def patch_knowledge_empty(monkeypatch):
    """Inject empty knowledge data (no models at all)."""
    import app.agent.prompt_knowledge as pk
    monkeypatch.setattr(pk, "_cached_data", SAMPLE_KNOWLEDGE_EMPTY)
    yield
    pk._cached_data = None


@pytest.fixture()
def patch_knowledge_unavailable(monkeypatch):
    """Make knowledge lookup raise an exception (simulates unreadable file)."""
    import app.agent.prompt_knowledge as pk
    monkeypatch.setattr(pk, "_cached_data", None)

    # Force _load_knowledge_file to raise by patching open
    def _raise(*args, **kwargs):
        raise FileNotFoundError("Knowledge file not found")

    monkeypatch.setattr("builtins.open", _raise)
    yield
    pk._cached_data = None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestMatchModelKnowledgeEnrichment:
    """Tests for _match_model knowledge enrichment (Slice 10 ACs)."""

    # AC-1: Reason enthaelt Knowledge-Staerken statt statischem Text
    def test_reason_contains_knowledge_strengths_for_flux(
        self, patch_knowledge_with_strengths
    ):
        """AC-1: GIVEN _match_model findet einen Match fuer Kategorie
        'photorealistic' mit Modell flux-2-pro
        WHEN die Knowledge-Datei strengths fuer Prefix flux-2 enthaelt
        (z.B. ['Prompt-Treue', 'technische Fotografie'])
        THEN enthaelt der reason-String im Ergebnis diese Staerken
        (z.B. 'Prompt-Treue und technische Fotografie') statt des
        statischen reason_de.
        """
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "photorealistic portrait of a woman",
            ["photorealistic", "portrait"],
            FLUX_MODELS,
        )

        assert result is not None
        assert "flux" in result["id"].lower()
        # The reason must contain the knowledge strengths
        assert "Prompt-Treue" in result["reason"]
        assert "technische Fotografie" in result["reason"]
        # The reason must NOT be the static reason_de
        assert result["reason"] != (
            "Dieses Modell eignet sich besonders gut fuer "
            "fotorealistische Bilder mit hoher Detailtreue."
        )

    # AC-2: Fallback auf statischen reason_de wenn kein Knowledge-Eintrag
    def test_fallback_to_static_reason_when_no_knowledge(
        self, patch_knowledge_no_match
    ):
        """AC-2: GIVEN _match_model findet einen Match fuer ein Modell,
        dessen ID KEINEN Knowledge-Eintrag hat
        WHEN die Knowledge-Datei keinen passenden Prefix enthaelt
        THEN wird der bisherige statische reason_de aus _MATCHING_RULES
        unveraendert zurueckgegeben (Fallback auf bestehende Logik).
        """
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "photorealistic portrait",
            ["photorealistic"],
            FLUX_MODELS,
        )

        assert result is not None
        # Must return the static reason_de from _MATCHING_RULES
        assert result["reason"] == (
            "Dieses Modell eignet sich besonders gut fuer "
            "fotorealistische Bilder mit hoher Detailtreue."
        )

    # AC-3: Ideogram-spezifische Staerken im Reason
    def test_reason_contains_ideogram_strengths(
        self, patch_knowledge_with_strengths
    ):
        """AC-3: GIVEN _match_model findet einen Match fuer Kategorie
        'text-in-image' mit Modell ideogram-3
        WHEN die Knowledge-Datei strengths fuer Prefix 'ideogram' enthaelt
        THEN enthaelt der reason-String die Ideogram-spezifischen Staerken
        (nicht die generische 'text-in-image' Begruendung).
        """
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "poster with typography and text",
            ["typography", "text"],
            IDEOGRAM_MODELS,
        )

        assert result is not None
        assert "ideogram" in result["id"].lower()
        # Must contain ideogram-specific strengths
        assert "Best-in-class text rendering" in result["reason"]
        # Must NOT be the static text-in-image reason
        assert result["reason"] != (
            "Dieses Modell kann Text in Bildern besonders gut "
            "und praezise darstellen."
        )

    # AC-4: Kein Match -> None, kein Knowledge-Lookup
    def test_no_match_returns_none_unchanged(
        self, patch_knowledge_with_strengths
    ):
        """AC-4: GIVEN _match_model findet KEINEN Match (return None)
        WHEN kein Regel-Keyword zutrifft
        THEN ist das Verhalten unveraendert: None wird zurueckgegeben,
        kein Knowledge-Lookup.
        """
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "something completely unrelated to any rule",
            ["unrelated", "nope"],
            MIXED_MODELS,
        )

        assert result is None

    # AC-5: Graceful degradation bei nicht ladbarer Knowledge-Datei
    def test_graceful_fallback_when_knowledge_unavailable(
        self, patch_knowledge_unavailable
    ):
        """AC-5: GIVEN die Knowledge-Datei ist nicht ladbar oder leer
        WHEN _match_model einen Regel-Match findet
        THEN wird der statische reason_de zurueckgegeben
        (graceful degradation, kein Crash).
        """
        from app.agent.tools.model_tools import _match_model

        # This must NOT crash even though knowledge is unavailable
        result = _match_model(
            "photorealistic portrait",
            ["photorealistic"],
            FLUX_MODELS,
        )

        assert result is not None
        assert "flux" in result["id"].lower()
        # Must fall back to static reason_de since knowledge is unavailable
        assert result["reason"] == (
            "Dieses Modell eignet sich besonders gut fuer "
            "fotorealistische Bilder mit hoher Detailtreue."
        )

    # AC-6: Product-Photography-Szenario mit konkreten Staerken
    def test_product_photography_returns_specific_strengths(
        self, patch_knowledge_with_strengths
    ):
        """AC-6: GIVEN _match_model('product photography',
        ['photorealistic'], available_models) mit einem Flux-Modell
        in available_models
        WHEN das Ergebnis geprueft wird
        THEN enthaelt result['reason'] modellspezifische Staerken
        (z.B. 'Prompt-Treue') und NICHT nur 'fotorealistische Bilder
        mit hoher Detailtreue'.
        """
        from app.agent.tools.model_tools import _match_model

        result = _match_model(
            "product photography",
            ["photorealistic"],
            FLUX_MODELS,
        )

        assert result is not None
        # Must contain model-specific strengths
        assert "Prompt-Treue" in result["reason"]
        # Must NOT be just the old static text
        assert "fotorealistische Bilder mit hoher Detailtreue" not in result["reason"]

    # AC-7: Slash-Stripping bei owner/name Model-ID
    def test_slash_stripping_for_knowledge_lookup(
        self, patch_knowledge_with_strengths
    ):
        """AC-7: GIVEN ein gematchtes Modell hat eine Model-ID im Format
        owner/name (z.B. 'black-forest-labs/flux-2-pro')
        WHEN der Knowledge-Lookup fuer den Reason-Enrichment durchgefuehrt
        wird
        THEN wird korrekt Slash-Stripping angewendet und der Prefix
        'flux-2' matcht.
        """
        from app.agent.tools.model_tools import _match_model

        # The model has owner="black-forest-labs", name="flux-2-pro"
        # so model_id = "black-forest-labs/flux-2-pro"
        # After slash-stripping: "flux-2-pro" should match prefix "flux-2"
        result = _match_model(
            "realistic portrait photo",
            ["photorealistic"],
            FLUX_MODELS,
        )

        assert result is not None
        # The model_id should be in owner/name format
        assert "/" in result["id"]
        assert result["id"] == "black-forest-labs/flux-2-pro"
        # The reason must contain knowledge strengths (proving slash-stripping worked)
        assert "Prompt-Treue" in result["reason"]
        assert "technische Fotografie" in result["reason"]


class TestEnrichReasonWithKnowledge:
    """Direct tests for _enrich_reason_with_knowledge helper function."""

    def test_formats_two_strengths_with_und(
        self, patch_knowledge_with_strengths
    ):
        """Two strengths should be joined with 'und'."""
        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        result = _enrich_reason_with_knowledge(
            "black-forest-labs/flux-2-pro",
            "Static reason text",
        )

        assert "Prompt-Treue und technische Fotografie" in result

    def test_formats_three_strengths_with_commas_and_und(
        self, patch_knowledge_with_strengths
    ):
        """Three or more strengths should use commas and 'und' for the last."""
        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        result = _enrich_reason_with_knowledge(
            "ideogram-ai/ideogram-3",
            "Static reason text",
        )

        # 3 strengths: "A, B und C" pattern
        assert "Best-in-class text rendering" in result
        assert "Accurate multi-line typography" in result
        assert "Magic Prompt feature" in result
        assert " und " in result

    def test_includes_display_name_in_reason(
        self, patch_knowledge_with_strengths
    ):
        """Enriched reason should include the model's displayName."""
        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        result = _enrich_reason_with_knowledge(
            "black-forest-labs/flux-2-pro",
            "Static reason text",
        )

        assert "Flux 2 Pro/Max" in result

    def test_returns_static_reason_for_unknown_model(
        self, patch_knowledge_no_match
    ):
        """Unknown model should get the static reason back."""
        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        static = "This is the static reason."
        result = _enrich_reason_with_knowledge(
            "unknown-owner/unknown-model",
            static,
        )

        assert result == static

    def test_returns_static_reason_on_exception(
        self, patch_knowledge_unavailable
    ):
        """Exception during knowledge lookup should return static reason."""
        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        static = "Static fallback reason."
        result = _enrich_reason_with_knowledge(
            "black-forest-labs/flux-2-pro",
            static,
        )

        assert result == static

    def test_returns_static_reason_when_no_strengths_key(
        self, monkeypatch
    ):
        """Model entry without strengths key should fall back to static reason."""
        import app.agent.prompt_knowledge as pk

        knowledge_no_strengths = {
            "models": {
                "flux-2": {
                    "displayName": "Flux 2",
                    "promptStyle": "natural",
                    "tips": ["A tip"],
                    "avoid": ["Something"],
                    # NOTE: no "strengths" key
                },
            },
            "fallback": {
                "displayName": "Generic",
                "tips": [],
                "avoid": [],
            },
        }
        monkeypatch.setattr(pk, "_cached_data", knowledge_no_strengths)

        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        static = "Static reason text."
        result = _enrich_reason_with_knowledge(
            "black-forest-labs/flux-2-pro",
            static,
        )

        assert result == static
        pk._cached_data = None

    def test_returns_static_reason_when_strengths_empty(
        self, monkeypatch
    ):
        """Model entry with empty strengths list should fall back to static reason."""
        import app.agent.prompt_knowledge as pk

        knowledge_empty_strengths = {
            "models": {
                "flux-2": {
                    "displayName": "Flux 2",
                    "promptStyle": "natural",
                    "strengths": [],  # empty list
                    "tips": [],
                    "avoid": [],
                },
            },
            "fallback": {
                "displayName": "Generic",
                "tips": [],
                "avoid": [],
            },
        }
        monkeypatch.setattr(pk, "_cached_data", knowledge_empty_strengths)

        from app.agent.tools.model_tools import _enrich_reason_with_knowledge

        static = "Static reason text."
        result = _enrich_reason_with_knowledge(
            "black-forest-labs/flux-2-pro",
            static,
        )

        assert result == static
        pk._cached_data = None
