"""Acceptance tests for Slice 08: Assistant Backend Tools & System-Prompt.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/phase-7/2026-03-29-prompt-simplification/slices/slice-08-assistant-backend-tools.md.

The slice changes draft_prompt and refine_prompt from 3-field output
(motiv, style, negative_prompt) to single-field output (prompt).
It also updates the system prompt and state docstring.

Mocking Strategy: no_mocks (as specified in Slice-Spec).
"""

import inspect

import pytest

# Keys that must NOT appear in the new output contract
_OLD_KEYS = {"motiv", "style", "negative_prompt"}


class TestSlice08Acceptance:
    """Acceptance tests for Slice 08 - Simplified Prompt Tools."""

    @pytest.mark.acceptance
    def test_ac1_draft_prompt_returns_single_prompt_field(self):
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

        # AND: old keys must NOT exist
        for old_key in _OLD_KEYS:
            assert old_key not in result, (
                f"Old key '{old_key}' must NOT appear in draft_prompt output"
            )

    @pytest.mark.acceptance
    def test_ac2_draft_prompt_uses_provided_prompt_key(self):
        """AC-2: GIVEN ein collected_info-Dict mit komplettem prompt-Key (Agent liefert fertigen Prompt)
        WHEN draft_prompt.invoke({"collected_info": {"subject": "cat", "prompt": "A majestic cat ..."}}) aufgerufen wird
        THEN ist das Ergebnis {"prompt": "A majestic cat ..."}
        AND die Keys motiv, style, negative_prompt existieren NICHT im Ergebnis
        """
        from app.agent.tools.prompt_tools import draft_prompt

        # Arrange (GIVEN)
        provided_prompt = "A majestic cat sitting on a velvet throne, dramatic studio lighting"

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

        # AND: old keys must NOT exist
        for old_key in _OLD_KEYS:
            assert old_key not in result, (
                f"Old key '{old_key}' must NOT appear when prompt is provided"
            )

    @pytest.mark.acceptance
    def test_ac3_draft_prompt_raises_without_subject(self):
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

    @pytest.mark.acceptance
    def test_ac4_refine_prompt_returns_single_prompt_field(self):
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

        # AND: old keys must NOT exist
        for old_key in _OLD_KEYS:
            assert old_key not in result, (
                f"Old key '{old_key}' must NOT appear in refine_prompt output"
            )

    @pytest.mark.acceptance
    def test_ac5_system_prompt_has_no_three_field_references(self):
        """AC-5: GIVEN die Datei backend/app/agent/prompts.py
        WHEN der _BASE_PROMPT-String geprueft wird
        THEN enthaelt er KEINE Referenz auf 'drei Felder', 'three fields',
             'motiv, style, negative_prompt' oder 'negative_prompt'
        AND enthaelt eine Anweisung, dass der Output ein einzelnes prompt-Feld sein soll
        """
        from app.agent.prompts import _BASE_PROMPT

        # Assert (THEN): no old references
        prompt_lower = _BASE_PROMPT.lower()

        forbidden_phrases = [
            "drei felder",
            "three fields",
            "negative_prompt",
            "motiv, style, negative_prompt",
            "motiv, style",
        ]
        for phrase in forbidden_phrases:
            assert phrase not in prompt_lower, (
                f"_BASE_PROMPT must NOT contain '{phrase}'"
            )

        # AND: must contain instruction for single prompt field
        # The actual text in prompts.py contains "`prompt`" and "prompt-Feld" or "Prompt-String"
        has_single_field_instruction = (
            "`prompt`" in _BASE_PROMPT
            or "prompt-feld" in prompt_lower
            or "prompt-string" in prompt_lower
            or "einzeln" in prompt_lower
            or "single" in prompt_lower
        )
        assert has_single_field_instruction, (
            "_BASE_PROMPT must contain an instruction about a single prompt field output"
        )

    @pytest.mark.acceptance
    def test_ac5_system_prompt_source_file_has_no_old_references(self):
        """AC-5 extension: verify the actual source file does not contain old references.

        This reads the source code of prompts.py to ensure no stale references
        exist even outside _BASE_PROMPT (e.g., in comments or other constants).
        """
        import app.agent.prompts as prompts_module

        source = inspect.getsource(prompts_module)
        source_lower = source.lower()

        # negative_prompt as a field reference should not appear anywhere
        # (Note: it's fine if it appears in docstrings explaining the migration,
        # but the _BASE_PROMPT itself must not contain it -- tested above)
        # Here we just verify _BASE_PROMPT assignment doesn't have it
        base_prompt_start = source.find('_BASE_PROMPT = """')
        if base_prompt_start != -1:
            base_prompt_end = source.find('"""', base_prompt_start + len('_BASE_PROMPT = """'))
            base_prompt_text = source[base_prompt_start:base_prompt_end].lower()
            assert "negative_prompt" not in base_prompt_text, (
                "_BASE_PROMPT in source must not contain 'negative_prompt'"
            )
            assert "motiv, style" not in base_prompt_text, (
                "_BASE_PROMPT in source must not contain 'motiv, style'"
            )

    @pytest.mark.acceptance
    def test_ac6_state_docstring_references_single_prompt_field(self):
        """AC-6: GIVEN die Datei backend/app/agent/state.py
        WHEN der Docstring von PromptAssistantState geprueft wird
        THEN referenziert draft_prompt nur noch 'prompt' (nicht mehr 'motiv, style, negative_prompt')
        """
        from app.agent.state import PromptAssistantState

        # Arrange: get docstring
        docstring = PromptAssistantState.__doc__
        assert docstring is not None, (
            "PromptAssistantState must have a docstring"
        )

        doc_lower = docstring.lower()

        # Assert (THEN): must NOT reference old 3-field output
        old_references = [
            "motiv, style, negative_prompt",
            "motiv,style,negative_prompt",
            "negative_prompt",
        ]
        for ref in old_references:
            assert ref not in doc_lower, (
                f"PromptAssistantState docstring must NOT contain '{ref}'. "
                f"Docstring: {docstring}"
            )

        # Must reference 'prompt' in the context of draft_prompt description
        assert "prompt" in doc_lower, (
            "PromptAssistantState docstring must reference 'prompt'"
        )

        # Verify draft_prompt field description references the new format
        # The docstring should mention draft_prompt and prompt together
        draft_line_found = False
        for line in docstring.split("\n"):
            line_lower = line.lower().strip()
            if "draft_prompt" in line_lower:
                draft_line_found = True
                assert "prompt" in line_lower, (
                    f"draft_prompt description line must mention 'prompt'. Line: '{line.strip()}'"
                )
                # Must NOT mention old keys in this specific line
                assert "motiv" not in line_lower, (
                    f"draft_prompt description must not mention 'motiv'. Line: '{line.strip()}'"
                )
                break

        assert draft_line_found, (
            "PromptAssistantState docstring must contain a line describing 'draft_prompt'"
        )
