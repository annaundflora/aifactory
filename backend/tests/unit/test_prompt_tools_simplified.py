"""Unit tests for prompt_tools simplified output (Slice 08).

Tests the draft_prompt and refine_prompt tool functions for the new
single-field output contract: {"prompt": str} instead of the old
3-field contract (motiv, style, negative_prompt).

Mocking Strategy: no_mocks (as specified in Slice-Spec).
These are pure functions -- no external calls needed.
"""

import pytest

# ---------------------------------------------------------------------------
# Keys that must NOT appear in the new output contract
# ---------------------------------------------------------------------------
_OLD_KEYS = {"motiv", "style", "negative_prompt"}


# ===========================================================================
# AC-1: draft_prompt returns single {prompt} field
# ===========================================================================
class TestDraftPromptSingleFieldOutput:
    """draft_prompt must return exactly {"prompt": <non-empty str>}."""

    def test_draft_prompt_returns_single_prompt_field(self):
        """AC-1: GIVEN ein collected_info-Dict mit subject: 'a golden retriever in a sunflower field'
        WHEN draft_prompt.invoke({"collected_info": collected_info}) aufgerufen wird
        THEN ist das Ergebnis ein Dict mit GENAU einem Key 'prompt' (kein motiv, kein style, kein negative_prompt)
        AND der Wert von 'prompt' ist ein nicht-leerer String
        """
        from app.agent.tools.prompt_tools import draft_prompt

        # Arrange (GIVEN)
        collected_info = {"subject": "a golden retriever in a sunflower field"}

        # Act (WHEN)
        result = draft_prompt.invoke({"collected_info": collected_info})

        # Assert (THEN)
        assert isinstance(result, dict), (
            f"draft_prompt must return a dict, got {type(result).__name__}"
        )
        assert set(result.keys()) == {"prompt"}, (
            f"draft_prompt must return exactly {{'prompt'}}, got {set(result.keys())}"
        )
        assert isinstance(result["prompt"], str), (
            f"'prompt' value must be a string, got {type(result['prompt']).__name__}"
        )
        assert len(result["prompt"]) > 0, "'prompt' value must be non-empty"

        # Verify old keys are absent
        for old_key in _OLD_KEYS:
            assert old_key not in result, (
                f"Old key '{old_key}' must NOT appear in draft_prompt output"
            )

    def test_draft_prompt_with_style_and_purpose(self):
        """AC-1 extension: draft_prompt with optional fields still returns single prompt key."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {
                "subject": "a mountain landscape at dawn",
                "style": "oil painting",
                "purpose": "art",
                "mood": "serene",
                "lighting": "golden hour",
                "composition": "panoramic",
                "color_palette": "warm earth tones",
            },
        })

        assert set(result.keys()) == {"prompt"}, (
            f"draft_prompt with all optional fields must still return only 'prompt', "
            f"got {set(result.keys())}"
        )
        assert isinstance(result["prompt"], str) and len(result["prompt"]) > 0

    def test_draft_prompt_subject_appears_in_prompt(self):
        """AC-1 extension: the subject text should appear in the generated prompt."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "a golden retriever in a sunflower field"},
        })

        assert "golden retriever" in result["prompt"].lower(), (
            "The subject should appear in the generated prompt"
        )


# ===========================================================================
# AC-2: draft_prompt passthrough when prompt key is provided
# ===========================================================================
class TestDraftPromptPassthrough:
    """draft_prompt must pass through a complete prompt key directly."""

    def test_draft_prompt_uses_provided_prompt_key(self):
        """AC-2: GIVEN ein collected_info-Dict mit komplettem prompt-Key
        WHEN draft_prompt.invoke({"collected_info": {"subject": "cat", "prompt": "A majestic cat ..."}}) aufgerufen wird
        THEN ist das Ergebnis {"prompt": "A majestic cat ..."}
        AND die Keys motiv, style, negative_prompt existieren NICHT im Ergebnis
        """
        from app.agent.tools.prompt_tools import draft_prompt

        # Arrange (GIVEN)
        provided_prompt = "A majestic cat sitting regally on a velvet cushion, studio lighting, photorealistic"

        # Act (WHEN)
        result = draft_prompt.invoke({
            "collected_info": {
                "subject": "cat",
                "prompt": provided_prompt,
            },
        })

        # Assert (THEN)
        assert result == {"prompt": provided_prompt}, (
            f"draft_prompt must return the provided prompt verbatim.\n"
            f"Expected: {{'prompt': '{provided_prompt}'}}\n"
            f"Got: {result}"
        )

        # Verify old keys are absent
        for old_key in _OLD_KEYS:
            assert old_key not in result, (
                f"Old key '{old_key}' must NOT appear when prompt is provided"
            )

    def test_draft_prompt_passthrough_preserves_exact_string(self):
        """AC-2 extension: passthrough must preserve exact string including special chars."""
        from app.agent.tools.prompt_tools import draft_prompt

        exact_prompt = "A cat with whiskers, bokeh background -- high detail (8k resolution)"

        result = draft_prompt.invoke({
            "collected_info": {
                "subject": "cat",
                "prompt": exact_prompt,
            },
        })

        assert result["prompt"] == exact_prompt, (
            "draft_prompt passthrough must preserve the exact prompt string"
        )


# ===========================================================================
# AC-3: draft_prompt without subject raises ValueError
# ===========================================================================
class TestDraftPromptValidation:
    """draft_prompt must raise ValueError when subject is missing."""

    def test_draft_prompt_raises_without_subject(self):
        """AC-3: GIVEN ein collected_info-Dict OHNE subject-Key
        WHEN draft_prompt.invoke({"collected_info": {}}) aufgerufen wird
        THEN wird ein ValueError (oder ToolException) geworfen
        AND die Fehlermeldung enthaelt 'subject'
        """
        from app.agent.tools.prompt_tools import draft_prompt

        # Act + Assert (WHEN/THEN)
        with pytest.raises((ValueError, Exception)) as exc_info:
            draft_prompt.invoke({"collected_info": {}})

        # AND: error message contains "subject"
        error_msg = str(exc_info.value).lower()
        assert "subject" in error_msg, (
            f"Error message must contain 'subject', got: '{exc_info.value}'"
        )

    def test_draft_prompt_raises_with_empty_subject(self):
        """AC-3 extension: empty string subject must also raise."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, Exception)) as exc_info:
            draft_prompt.invoke({"collected_info": {"subject": ""}})

        assert "subject" in str(exc_info.value).lower()

    def test_draft_prompt_raises_with_none_subject(self):
        """AC-3 extension: None subject must also raise."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, Exception)) as exc_info:
            draft_prompt.invoke({"collected_info": {"subject": None}})

        assert "subject" in str(exc_info.value).lower()

    def test_draft_prompt_raises_with_none_input(self):
        """AC-3 extension: None collected_info must also raise."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, TypeError, Exception)):
            draft_prompt.invoke({"collected_info": None})


# ===========================================================================
# AC-4: refine_prompt returns single {prompt} field
# ===========================================================================
class TestRefinePromptSingleFieldOutput:
    """refine_prompt must return exactly {"prompt": <non-empty str>}."""

    def test_refine_prompt_returns_single_prompt_field(self):
        """AC-4: GIVEN ein current_draft-Dict {"prompt": "A serene lake at sunset"} und feedback: "add dramatic storm clouds"
        WHEN refine_prompt.invoke({"current_draft": current_draft, "feedback": feedback}) aufgerufen wird
        THEN ist das Ergebnis ein Dict mit GENAU einem Key 'prompt'
        AND der Wert von 'prompt' ist ein nicht-leerer String
        AND die Keys motiv, style, negative_prompt existieren NICHT im Ergebnis
        """
        from app.agent.tools.prompt_tools import refine_prompt

        # Arrange (GIVEN)
        current_draft = {"prompt": "A serene lake at sunset"}
        feedback = "add dramatic storm clouds"

        # Act (WHEN)
        result = refine_prompt.invoke({
            "current_draft": current_draft,
            "feedback": feedback,
        })

        # Assert (THEN)
        assert isinstance(result, dict), (
            f"refine_prompt must return a dict, got {type(result).__name__}"
        )
        assert set(result.keys()) == {"prompt"}, (
            f"refine_prompt must return exactly {{'prompt'}}, got {set(result.keys())}"
        )
        assert isinstance(result["prompt"], str), (
            f"'prompt' value must be a string, got {type(result['prompt']).__name__}"
        )
        assert len(result["prompt"]) > 0, "'prompt' value must be non-empty"

        # Verify old keys are absent
        for old_key in _OLD_KEYS:
            assert old_key not in result, (
                f"Old key '{old_key}' must NOT appear in refine_prompt output"
            )

    def test_refine_prompt_with_empty_draft(self):
        """AC-4 extension: refine_prompt handles empty prompt in draft gracefully."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {"prompt": ""},
            "feedback": "create a portrait of a woman in Renaissance style",
        })

        assert set(result.keys()) == {"prompt"}, (
            f"refine_prompt must return only 'prompt' key, got {set(result.keys())}"
        )
        assert isinstance(result["prompt"], str) and len(result["prompt"]) > 0

    def test_refine_prompt_with_missing_prompt_key(self):
        """AC-4 extension: refine_prompt handles draft without prompt key."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {},
            "feedback": "add a sunset",
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"prompt"}, (
            f"refine_prompt must return only 'prompt' key even with empty draft, "
            f"got {set(result.keys())}"
        )


# ===========================================================================
# AC-5: System-Prompt has no 3-field references
# ===========================================================================
class TestSystemPromptSimplified:
    """_BASE_PROMPT must not reference the old 3-field output."""

    def test_system_prompt_has_no_three_field_references(self):
        """AC-5: GIVEN die Datei backend/app/agent/prompts.py
        WHEN der _BASE_PROMPT-String geprueft wird
        THEN enthaelt er KEINE Referenz auf 'drei Felder', 'three fields',
             'motiv, style, negative_prompt' oder 'negative_prompt'
        AND enthaelt eine Anweisung, dass der Output ein einzelnes prompt-Feld sein soll
        """
        from app.agent.prompts import _BASE_PROMPT

        prompt_lower = _BASE_PROMPT.lower()

        # Must NOT contain old references
        forbidden_phrases = [
            "drei felder",
            "three fields",
            "negative_prompt",
            "motiv, style, negative_prompt",
            "motiv, style",
        ]
        for phrase in forbidden_phrases:
            assert phrase not in prompt_lower, (
                f"_BASE_PROMPT must NOT contain '{phrase}', but it does"
            )

        # MUST contain instruction for single prompt field
        assert "prompt" in prompt_lower, (
            "_BASE_PROMPT must contain the word 'prompt'"
        )

        # Check for instruction that output should be a single prompt field
        # The spec says: "enthaelt eine Anweisung, dass der Output ein einzelnes prompt-Feld sein soll"
        # Check for phrases like "einzelnes", "single", "ein Feld", "prompt field", etc.
        has_single_field_instruction = (
            "einzeln" in prompt_lower
            or "single" in prompt_lower
            or "ein feld" in prompt_lower
            or "`prompt`" in _BASE_PROMPT
            or "feld `prompt`" in prompt_lower
            or "prompt-feld" in prompt_lower
            or "prompt-string" in prompt_lower
        )
        assert has_single_field_instruction, (
            "_BASE_PROMPT must contain an instruction about a single prompt field output. "
            "Expected one of: 'einzeln', 'single', 'ein Feld', '`prompt`', 'prompt-Feld', 'Prompt-String'"
        )


# ===========================================================================
# AC-6: State docstring references only prompt
# ===========================================================================
class TestStateDocstringSimplified:
    """PromptAssistantState docstring must reference only prompt."""

    def test_state_docstring_references_single_prompt_field(self):
        """AC-6: GIVEN die Datei backend/app/agent/state.py
        WHEN der Docstring von PromptAssistantState geprueft wird
        THEN referenziert draft_prompt nur noch 'prompt' (nicht mehr 'motiv, style, negative_prompt')
        """
        from app.agent.state import PromptAssistantState

        docstring = PromptAssistantState.__doc__
        assert docstring is not None, (
            "PromptAssistantState must have a docstring"
        )

        doc_lower = docstring.lower()

        # Must NOT reference old 3-field output
        old_references = [
            "motiv, style, negative_prompt",
            "motiv,style,negative_prompt",
            "negative_prompt",
        ]
        for ref in old_references:
            assert ref not in doc_lower, (
                f"PromptAssistantState docstring must NOT contain '{ref}'. "
                f"Found in docstring: {docstring}"
            )

        # Must reference 'prompt' in the context of draft_prompt
        assert "prompt" in doc_lower, (
            "PromptAssistantState docstring must reference 'prompt'"
        )


# ===========================================================================
# Tool Decorator Tests (structural)
# ===========================================================================
class TestToolDecoratorsSimplified:
    """Verify that tools are properly decorated LangGraph tools."""

    def test_draft_prompt_is_langchain_tool(self):
        """draft_prompt must be a LangChain tool (has .invoke method)."""
        from app.agent.tools.prompt_tools import draft_prompt

        assert hasattr(draft_prompt, "invoke"), "draft_prompt must have .invoke (BaseTool)"
        assert hasattr(draft_prompt, "name"), "draft_prompt must have .name attribute"
        assert draft_prompt.name == "draft_prompt"

    def test_refine_prompt_is_langchain_tool(self):
        """refine_prompt must be a LangChain tool (has .invoke method)."""
        from app.agent.tools.prompt_tools import refine_prompt

        assert hasattr(refine_prompt, "invoke"), "refine_prompt must have .invoke (BaseTool)"
        assert hasattr(refine_prompt, "name"), "refine_prompt must have .name attribute"
        assert refine_prompt.name == "refine_prompt"
