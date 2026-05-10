"""Snapshot tests for the rewritten ``_BASE_PROMPT`` (Slice 12).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-12-base-prompt-rewrite-interview.md.

Mocking Strategy: ``mock_external`` (per Slice-Spec). These are pure
substring/length tests on the ``_BASE_PROMPT`` module-level constant — no
LLM call is needed. The companion file ``test_base_prompt_eval.py``
exercises the eval-style tests with mocked ``ChatOpenRouter`` responses.

Covered Acceptance Criteria:
- AC-1: ``_BASE_PROMPT`` contains all required substrings (DE-chat,
        EN-prompt, ``emit_intent_summary``, ``Zwischen-Check``,
        ``semantic``/``semantisch``, ``flow_state``/``FSM``,
        ``set_slot_role``).
- AC-1: ``_BASE_PROMPT`` does NOT contain anti-phrase ``"kein Fragebogen"``.
- AC-7: ``len(_BASE_PROMPT)`` is between 1500 and 8000 characters.
- AC-9: ``build_assistant_system_prompt(None, None, None)`` returns
        base-only output containing the new prompt phrases.
- AC-10: ``SYSTEM_PROMPT`` alias still exports ``_BASE_PROMPT`` after
         the rewrite.
"""

import re

import pytest


# ===========================================================================
# AC-1: Required Pflicht-Phrasen present
# ===========================================================================


class TestAC1RequiredPhrasesPresent:
    """AC-1: GIVEN ``_BASE_PROMPT`` after rewrite,
    WHEN the string is inspected,
    THEN it contains exactly the required substrings (substring-match,
    case-sensitive) defined in the Spec / Constraints section.
    """

    def test_de_chat_rule_present(self):
        """AC-1: ``"Du sprichst Deutsch"`` (DE-Chat-Regel)."""
        from app.agent.prompts import _BASE_PROMPT

        assert "Du sprichst Deutsch" in _BASE_PROMPT, (
            "AC-1 requires the DE-chat rule phrase 'Du sprichst Deutsch' "
            "to be present in _BASE_PROMPT"
        )

    def test_en_prompt_rule_present(self):
        """AC-1: ``"Englisch"`` (EN-Prompt-Regel) and the matching marker
        ``"Prompts immer auf Englisch"`` (per AC-1 acceptance text).
        Spec constraint says regex ``r"Prompts.*Englisch"`` may also be used —
        we assert BOTH the literal phrase and the looser regex hold so the
        Implementer has flexibility within the AC bounds.
        """
        from app.agent.prompts import _BASE_PROMPT

        assert "Englisch" in _BASE_PROMPT, (
            "AC-1 requires the token 'Englisch' to be present"
        )
        # Regex form per Constraints: 'Prompts.*Englisch' with DOTALL so it
        # tolerates intervening whitespace / words.
        assert re.search(r"Prompts.*Englisch", _BASE_PROMPT, flags=re.DOTALL), (
            "AC-1 requires a phrase matching r'Prompts.*Englisch' (EN-Prompt rule)"
        )

    def test_emit_intent_summary_tool_name_present(self):
        """AC-1: ``"emit_intent_summary"`` (tool name, exact)."""
        from app.agent.prompts import _BASE_PROMPT

        assert "emit_intent_summary" in _BASE_PROMPT, (
            "AC-1 requires the tool name 'emit_intent_summary' to be present"
        )

    def test_zwischen_check_concept_present(self):
        """AC-1: ``"Zwischen-Check"`` (FSM-Konzept, exact)."""
        from app.agent.prompts import _BASE_PROMPT

        assert "Zwischen-Check" in _BASE_PROMPT, (
            "AC-1 requires the FSM concept 'Zwischen-Check' to be present"
        )

    def test_semantic_or_semantisch_present(self):
        """AC-1: ``"semantic"`` OR ``"semantisch"`` (Stop-Signal)."""
        from app.agent.prompts import _BASE_PROMPT

        # case-sensitive substring match for either DE or EN form
        present = ("semantic" in _BASE_PROMPT) or ("semantisch" in _BASE_PROMPT)
        assert present, (
            "AC-1 requires either 'semantic' or 'semantisch' to appear "
            "(stop-signal phrasing)"
        )

    def test_flow_state_or_fsm_present(self):
        """AC-1: ``"flow_state"`` OR ``"FSM"`` (mind. einer)."""
        from app.agent.prompts import _BASE_PROMPT

        present = ("flow_state" in _BASE_PROMPT) or ("FSM" in _BASE_PROMPT)
        assert present, (
            "AC-1 requires either 'flow_state' or 'FSM' to appear (FSM "
            "transition concept)"
        )

    def test_set_slot_role_tool_name_present(self):
        """AC-1: ``"set_slot_role"`` (Multi-Reference-Tool-Name)."""
        from app.agent.prompts import _BASE_PROMPT

        assert "set_slot_role" in _BASE_PROMPT, (
            "AC-1 requires the multi-reference tool name 'set_slot_role' "
            "to be present"
        )

    def test_sequential_multi_reference_phrase_present(self):
        """AC-1 (Constraints): ``"sequenziell"`` OR ``"ein Bild nach dem
        anderen"`` — at least one of the two must appear.
        """
        from app.agent.prompts import _BASE_PROMPT

        present = (
            "sequenziell" in _BASE_PROMPT
            or "ein Bild nach dem anderen" in _BASE_PROMPT
        )
        assert present, (
            "AC-1 requires either 'sequenziell' or 'ein Bild nach dem anderen' "
            "to appear (multi-reference rule)"
        )


# ===========================================================================
# AC-1 (anti-phrase): old "kein Fragebogen" wording must be gone
# ===========================================================================


class TestAC1AntiPhraseRemoved:
    """AC-1 (negative): GIVEN the rewrite, the old anti-phrase
    ``"kein Fragebogen"`` MUST be absent (rewrite is a deliberate departure
    from the old behaviour).
    """

    def test_anti_phrase_kein_fragebogen_absent(self):
        """AC-1: ``"kein Fragebogen"`` must be removed entirely."""
        from app.agent.prompts import _BASE_PROMPT

        assert "kein Fragebogen" not in _BASE_PROMPT, (
            "AC-1 demands the old anti-phrase 'kein Fragebogen' is removed"
        )

    def test_anti_phrase_case_insensitive_absent(self):
        """AC-1 (defence): no case-variant of the anti-phrase survives."""
        from app.agent.prompts import _BASE_PROMPT

        assert not re.search(
            r"kein\s+Fragebogen", _BASE_PROMPT, flags=re.IGNORECASE
        ), (
            "AC-1 demands no case-variant of 'kein Fragebogen' survives "
            "(rewrite must depart from the old behaviour)"
        )


# ===========================================================================
# AC-7: Length bounds: 1500 < len(_BASE_PROMPT) < 8000
# ===========================================================================


class TestAC7LengthBounds:
    """AC-7: GIVEN the snapshot of ``_BASE_PROMPT``,
    WHEN the file is loaded,
    THEN ``len(_BASE_PROMPT)`` is > 1500 AND < 8000 (more than the old prompt
    due to FSM / tool / multi-reference rules, but not so large that it
    crowds out the context + knowledge blocks).
    """

    def test_length_is_above_1500(self):
        """AC-7: ``len(_BASE_PROMPT) > 1500``."""
        from app.agent.prompts import _BASE_PROMPT

        assert len(_BASE_PROMPT) > 1500, (
            f"AC-7 requires len(_BASE_PROMPT) > 1500, got {len(_BASE_PROMPT)}"
        )

    def test_length_is_below_8000(self):
        """AC-7: ``len(_BASE_PROMPT) < 8000``."""
        from app.agent.prompts import _BASE_PROMPT

        assert len(_BASE_PROMPT) < 8000, (
            f"AC-7 requires len(_BASE_PROMPT) < 8000, got {len(_BASE_PROMPT)}"
        )


# ===========================================================================
# AC-9: build_assistant_system_prompt(None, None, None) returns base prompt
# with all the new phrases
# ===========================================================================


class TestAC9BuildAssistantSystemPromptUsesNewBase:
    """AC-9: GIVEN the rewrite is done,
    WHEN ``build_assistant_system_prompt(image_model_id=None,
    generation_mode=None, project_context=None)`` is called (Slice 11
    contract),
    THEN the output contains the new ``_BASE_PROMPT`` (all required AC-1
    phrases visible) AND no remnants of the old prompt (anti-phrase
    ``"kein Fragebogen"`` still absent); Slice-11 composition (block order
    Base -> Context -> Knowledge) remains structurally unchanged.
    """

    def test_build_prompt_includes_new_required_phrases(self):
        """AC-9: ``build_assistant_system_prompt(None, None, None)`` returns
        all AC-1 required substrings in the output.
        """
        from app.agent.prompts import build_assistant_system_prompt

        result = build_assistant_system_prompt(
            image_model_id=None,
            generation_mode=None,
            project_context=None,
        )

        # Each required AC-1 phrase must be present in the rendered prompt.
        assert "Du sprichst Deutsch" in result
        assert "Englisch" in result
        assert "emit_intent_summary" in result
        assert "Zwischen-Check" in result
        assert ("semantic" in result) or ("semantisch" in result)
        assert ("flow_state" in result) or ("FSM" in result)
        assert "set_slot_role" in result

    def test_build_prompt_excludes_old_anti_phrase(self):
        """AC-9: anti-phrase ``"kein Fragebogen"`` is also absent in the
        rendered prompt.
        """
        from app.agent.prompts import build_assistant_system_prompt

        result = build_assistant_system_prompt(
            image_model_id=None,
            generation_mode=None,
            project_context=None,
        )

        assert "kein Fragebogen" not in result

    def test_build_prompt_byte_identical_to_base_when_all_none(self):
        """AC-9: with no extra blocks (all kwargs None), the result is
        byte-identical to ``_BASE_PROMPT`` (Slice-11 composition rule).
        """
        from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt

        result = build_assistant_system_prompt(
            image_model_id=None,
            generation_mode=None,
            project_context=None,
        )

        # Slice-11 contract: when no context/knowledge requested, the function
        # returns the base prompt verbatim.
        assert result == _BASE_PROMPT


# ===========================================================================
# AC-10: SYSTEM_PROMPT backward-compat alias still works
# ===========================================================================


class TestAC10SystemPromptAlias:
    """AC-10: GIVEN the ``SYSTEM_PROMPT`` backward-compat alias in
    ``prompts.py``,
    WHEN code/tests do ``from app.agent.prompts import SYSTEM_PROMPT``,
    THEN the alias still points at ``_BASE_PROMPT`` (now with the new
    content); no crash, no missing constant.
    """

    def test_system_prompt_alias_importable(self):
        """AC-10: ``SYSTEM_PROMPT`` still importable as a module-level
        constant (no AttributeError).
        """
        from app.agent.prompts import SYSTEM_PROMPT  # noqa: F401

        assert SYSTEM_PROMPT is not None
        assert isinstance(SYSTEM_PROMPT, str)
        assert len(SYSTEM_PROMPT) > 0

    def test_system_prompt_alias_equals_base_prompt(self):
        """AC-10: the alias is the same object/value as ``_BASE_PROMPT``
        after the rewrite.
        """
        from app.agent.prompts import _BASE_PROMPT, SYSTEM_PROMPT

        assert SYSTEM_PROMPT == _BASE_PROMPT
        # Reference identity (alias, not a copy).
        assert SYSTEM_PROMPT is _BASE_PROMPT

    def test_system_prompt_alias_has_new_phrases(self):
        """AC-10 (cross-check): the alias content reflects the rewrite —
        AC-1 required substrings appear via the alias too.
        """
        from app.agent.prompts import SYSTEM_PROMPT

        assert "Du sprichst Deutsch" in SYSTEM_PROMPT
        assert "emit_intent_summary" in SYSTEM_PROMPT
        assert "Zwischen-Check" in SYSTEM_PROMPT
        assert "set_slot_role" in SYSTEM_PROMPT
        assert "kein Fragebogen" not in SYSTEM_PROMPT
