"""Integration tests for Python-side Knowledge consumers (Slice 13).

Tests build_assistant_system_prompt, build_canvas_system_prompt, and _match_model
end-to-end with the REAL prompt-knowledge.json -- no mocks for knowledge data.

These tests verify that model-specific knowledge (tips, strengths, mode-specific
tips) actually appears in the outputs of all three Python consumers, using the
real data file as the source of truth.

Test strategy: no_mocks (real knowledge JSON, real lookup functions, real prompt
builders; no LLM calls).
"""

import json
import logging
from pathlib import Path

import pytest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers: load the real knowledge data for dynamic assertions
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_KNOWLEDGE_PATH = _REPO_ROOT / "data" / "prompt-knowledge.json"


def _load_real_knowledge() -> dict:
    """Load the real prompt-knowledge.json for assertion data.

    This is a separate load (not using the module cache) so we can
    extract expected values for assertions without depending on the
    module-level cache state.
    """
    with open(_KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# Pre-load once for the entire test module
_KNOWLEDGE = _load_real_knowledge()


# ---------------------------------------------------------------------------
# Fixture: reset the module-level knowledge cache before each test
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_knowledge_cache():
    """Reset the prompt_knowledge module cache before and after each test.

    This ensures every test uses a fresh load from the real JSON file,
    preventing stale cached data from unit test fixtures that may have
    run earlier in the same process.
    """
    import app.agent.prompt_knowledge as pk

    pk._cached_data = None
    yield
    pk._cached_data = None


# ===========================================================================
# TestAssistantKnowledgeIntegration
# ===========================================================================


class TestAssistantKnowledgeIntegration:
    """Integration tests for build_assistant_system_prompt with real knowledge."""

    # AC-1: Flux-Tipps im Assistant System-Prompt
    def test_flux_model_produces_flux_tips_in_assistant_prompt(self):
        """AC-1: GIVEN die echte prompt-knowledge.json mit Flux-2-Eintrag
        WHEN build_assistant_system_prompt('flux-2-pro', 'txt2img') aufgerufen wird
        THEN enthaelt der zurueckgegebene String mindestens einen Tipp
        aus models['flux-2'].tips.
        """
        from app.agent.prompts import build_assistant_system_prompt

        result = build_assistant_system_prompt("flux-2-pro", "txt2img")

        flux_knowledge = _KNOWLEDGE["models"]["flux-2"]
        flux_tips = flux_knowledge["tips"]

        # At least one tip from the real knowledge must appear in the prompt
        matched_tips = [tip for tip in flux_tips if tip in result]
        assert len(matched_tips) >= 1, (
            f"Expected at least one Flux tip in the assistant prompt.\n"
            f"Flux tips: {flux_tips}\n"
            f"Prompt excerpt (last 800 chars): ...{result[-800:]}"
        )

    # AC-2: Seedream-Tipps im Assistant System-Prompt
    def test_seedream_model_produces_seedream_tips_in_assistant_prompt(self):
        """AC-2: GIVEN die echte Knowledge-Datei mit Seedream-Eintrag
        WHEN build_assistant_system_prompt('seedream-5', 'img2img') aufgerufen wird
        THEN enthaelt der zurueckgegebene String mindestens einen Tipp
        aus models['seedream'].tips.
        """
        from app.agent.prompts import build_assistant_system_prompt

        result = build_assistant_system_prompt("seedream-5", "img2img")

        seedream_knowledge = _KNOWLEDGE["models"]["seedream"]
        seedream_tips = seedream_knowledge["tips"]

        matched_tips = [tip for tip in seedream_tips if tip in result]
        assert len(matched_tips) >= 1, (
            f"Expected at least one Seedream tip in the assistant prompt.\n"
            f"Seedream tips: {seedream_tips}\n"
            f"Prompt excerpt (last 800 chars): ...{result[-800:]}"
        )

    # AC-5: Backward-Kompatibilitaet ohne Modell-Kontext
    def test_no_model_context_returns_base_prompt_only(self):
        """AC-5: GIVEN die echte Knowledge-Datei
        WHEN build_assistant_system_prompt(None, None) aufgerufen wird
        THEN enthaelt der String den Base-Prompt OHNE angehaengte
        Knowledge-Sektion.
        """
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt(None, None)

        # Must be exactly the base prompt
        assert result == _BASE_PROMPT

        # Must NOT contain any knowledge section markers
        assert "Prompting Tips for" not in result
        assert "General Prompting Tips" not in result
        assert "**Tips:**" not in result
        assert "**Strengths:**" not in result

    # AC-7: Modus-spezifische Tipps im Assistant System-Prompt
    def test_txt2img_mode_tips_included_for_flux(self):
        """AC-7: GIVEN die echte Knowledge-Datei mit models['flux-2'].modes.txt2img.tips
        WHEN build_assistant_system_prompt('flux-2-pro', 'txt2img') aufgerufen wird
        THEN enthaelt der String modus-spezifische txt2img-Tipps aus der
        Knowledge-Datei.
        """
        from app.agent.prompts import build_assistant_system_prompt

        result = build_assistant_system_prompt("flux-2-pro", "txt2img")

        flux_knowledge = _KNOWLEDGE["models"]["flux-2"]
        txt2img_tips = flux_knowledge["modes"]["txt2img"]["tips"]

        # At least one mode-specific tip must appear
        matched_mode_tips = [tip for tip in txt2img_tips if tip in result]
        assert len(matched_mode_tips) >= 1, (
            f"Expected at least one txt2img mode-specific tip in the prompt.\n"
            f"txt2img tips: {txt2img_tips}\n"
            f"Prompt excerpt (last 800 chars): ...{result[-800:]}"
        )

        # The mode-specific tips section header must be present
        assert "Mode-specific tips" in result


# ===========================================================================
# TestCanvasChatKnowledgeIntegration
# ===========================================================================


class TestCanvasChatKnowledgeIntegration:
    """Integration tests for build_canvas_system_prompt with real knowledge."""

    # AC-3: Seedream-Tipps im Canvas Chat System-Prompt
    def test_seedream_model_produces_tips_in_canvas_prompt(self):
        """AC-3: GIVEN die echte Knowledge-Datei und image_context mit
        model_id='seedream-5'
        WHEN build_canvas_system_prompt({'model_id': 'seedream-5',
        'image_url': 'https://example.com/img.png', 'prompt': 'test',
        'model_params': {}}) aufgerufen wird
        THEN enthaelt der zurueckgegebene String mindestens einen
        Seedream-spezifischen Tipp.
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "model_id": "seedream-5",
            "image_url": "https://example.com/img.png",
            "prompt": "test",
            "model_params": {},
        }

        result = build_canvas_system_prompt(image_context)

        seedream_knowledge = _KNOWLEDGE["models"]["seedream"]
        seedream_tips = seedream_knowledge["tips"]

        matched_tips = [tip for tip in seedream_tips if tip in result]
        assert len(matched_tips) >= 1, (
            f"Expected at least one Seedream tip in the canvas prompt.\n"
            f"Seedream tips: {seedream_tips}\n"
            f"Prompt excerpt (last 800 chars): ...{result[-800:]}"
        )

        # Verify the knowledge section header is present
        assert "Prompting Tips for Seedream" in result

    # AC-6: Kein Crash bei None image_context
    def test_none_image_context_returns_base_prompt(self):
        """AC-6: GIVEN die echte Knowledge-Datei
        WHEN build_canvas_system_prompt(None) aufgerufen wird
        THEN wird NUR der base_prompt zurueckgegeben (kein Crash,
        kein Knowledge-Block).
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        result = build_canvas_system_prompt(None)

        # Must contain the canvas base prompt marker
        assert "Bild-Bearbeitungs-Assistent" in result

        # Must NOT contain any knowledge section
        assert "Prompting Tips for" not in result
        assert "General Prompting Tips" not in result

        # Must NOT contain context section
        assert "AKTUELLES BILD" not in result

        # Must NOT crash (implicit: we got here without exception)
        assert isinstance(result, str)
        assert len(result) > 0


# ===========================================================================
# TestRecommendModelKnowledgeIntegration
# ===========================================================================


class TestRecommendModelKnowledgeIntegration:
    """Integration tests for _match_model with real knowledge."""

    # AC-4: Knowledge-Staerken im recommend_model Reason
    def test_match_model_reason_contains_knowledge_strengths(self):
        """AC-4: GIVEN die echte Knowledge-Datei und available_models
        mit einem Flux-Modell
        WHEN _match_model('product photography', ['photorealistic'],
        available_models) aufgerufen wird
        THEN enthaelt result['reason'] mindestens eine Staerke aus
        models['flux-2'].strengths.
        """
        from app.agent.tools.model_tools import _match_model

        available_models = [
            {
                "owner": "black-forest-labs",
                "name": "flux-2-pro",
                "run_count": 5000000,
                "description": "Flux 2 Pro - professional quality image generation",
                "url": "https://replicate.com/black-forest-labs/flux-2-pro",
            },
        ]

        result = _match_model(
            "product photography",
            ["photorealistic"],
            available_models,
        )

        assert result is not None, "Expected _match_model to return a result for 'product photography'"
        assert "flux" in result["id"].lower(), (
            f"Expected a Flux model match, got: {result['id']}"
        )

        flux_knowledge = _KNOWLEDGE["models"]["flux-2"]
        flux_strengths = flux_knowledge["strengths"]

        # At least one strength from the real knowledge must appear in the reason
        matched_strengths = [s for s in flux_strengths if s in result["reason"]]
        assert len(matched_strengths) >= 1, (
            f"Expected at least one Flux strength in the reason.\n"
            f"Flux strengths: {flux_strengths}\n"
            f"Actual reason: {result['reason']}"
        )
