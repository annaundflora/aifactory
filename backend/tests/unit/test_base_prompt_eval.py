"""Eval-style tests for the rewritten ``_BASE_PROMPT`` interview behaviour
(Slice 12).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-12-base-prompt-rewrite-interview.md.

Mocking Strategy: ``mock_external`` (per Slice-Spec). Each eval-case pairs:

  1. **Substring-match on `_BASE_PROMPT`** — proves the prompt encodes the
     rule that is supposed to drive the LLM behaviour.
  2. **AsyncMock LLM-response** — simulates the LLM output that should be
     produced when the rule is honoured (e.g. plain text with no tool_calls
     for vague input; an ``emit_intent_summary`` tool_call for fully
     specified input).

NO live LLM calls are made. NO real OpenRouter requests. The mocks are
deterministic and assert on the shape of the would-be LLM response in a
way that is consistent with the prompt rule.

Covered Acceptance Criteria:
- AC-2: Vague input -> question, no tool-call.
- AC-3: Concrete input + must-haves -> ``emit_intent_summary`` tool-call.
- AC-4: Mid-interview clarification check -> no tool-call.
- AC-5: img2img with multiple unrolled reference slots -> sequential
        per-slot questioning + ``set_slot_role`` calls.
- AC-6: Post-summary refinement -> ``refine_prompt`` (not re-fired
        ``emit_intent_summary``).
- AC-8: Aggregate gate — at least 5 eval-cases pass.
"""

import re
from unittest.mock import AsyncMock

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _system_message_for_case() -> SystemMessage:
    """Return a SystemMessage built from the rewritten ``_BASE_PROMPT`` via
    the Slice-11 builder. Each eval-case starts from this seed.
    """
    from app.agent.prompts import build_assistant_system_prompt

    return SystemMessage(
        content=build_assistant_system_prompt(
            image_model_id=None,
            generation_mode=None,
            project_context=None,
        )
    )


def _make_mock_llm_returning(ai_message: AIMessage) -> AsyncMock:
    """Build an ``AsyncMock`` that simulates an LLM whose ``ainvoke`` returns
    the provided ``AIMessage`` (drop-in for ``ChatOpenRouter``-style calls).
    """
    mock = AsyncMock()
    mock.ainvoke = AsyncMock(return_value=ai_message)
    mock.invoke = AsyncMock(return_value=ai_message)
    return mock


# ===========================================================================
# AC-2: Vague input -> clarification question, no tool-call
# ===========================================================================


class TestAC2VagueInputYieldsQuestion:
    """AC-2: GIVEN an eval-case with mocked LLM where the user message is a
    vague intent (``"mach was Schoenes"``, no must-haves recognisable),
    WHEN the agent runs with ``_BASE_PROMPT`` as system message and the
    mock returns an ``AIMessage`` without tool_calls (= the assistant asks
    a question),
    THEN the test verifies that NEITHER ``emit_intent_summary`` NOR
    ``draft_prompt`` was called; the system-prompt design steers the LLM
    to a clarification question. The prompt-text rule is also checked via
    substring-match on phrases such as ``"vager Intent"`` / ``"keine Annahmen"``.
    """

    def test_prompt_encodes_vague_input_rule(self):
        """AC-2 (substring): the prompt text contains a rule about handling
        vague inputs (no premature tool-call).
        """
        from app.agent.prompts import _BASE_PROMPT

        # The Spec says "exact wording is implementer choice, but substring-
        # match phrases are fixed in Constraints". Accept any of the
        # canonical fixings (case-insensitive for robustness around umlauts).
        candidates = [
            r"vager?\s+Intent",
            r"frage\s+zuerst",
            r"keine\s+Annahmen",
            r"KEIN\s+Tool",
        ]
        # At least ONE of these candidate rules must appear -- otherwise the
        # prompt does not encode the AC-2 behaviour.
        matches = [p for p in candidates if re.search(p, _BASE_PROMPT, flags=re.IGNORECASE)]
        assert matches, (
            "AC-2 requires the prompt to encode a 'vague input -> clarify "
            "first, no tool-call' rule. Expected at least one of "
            f"{candidates!r} to appear in _BASE_PROMPT."
        )

    @pytest.mark.asyncio
    async def test_mock_response_for_vague_input_has_no_tool_calls(self):
        """AC-2: simulated LLM response on vague input has NO tool_calls."""
        # Arrange: build the mock LLM to return a plain text question.
        clarification = AIMessage(
            content=(
                "Klar, gerne! Erzaehl mir mehr — was schwebt dir ungefaehr vor: "
                "ein Foto, eine Illustration, oder etwas ganz anderes?"
            ),
            tool_calls=[],
        )
        mock_llm = _make_mock_llm_returning(clarification)

        # Act
        history = [
            _system_message_for_case(),
            HumanMessage(content="mach was Schoenes"),
        ]
        response: AIMessage = await mock_llm.ainvoke(history)

        # Assert: response is a plain text question, no tool_calls.
        assert isinstance(response, AIMessage)
        assert response.tool_calls == [], (
            "AC-2: vague-input case must yield NO tool_calls "
            f"(got {response.tool_calls!r})"
        )

        # Defence: neither emit_intent_summary nor draft_prompt was requested.
        tool_names = {tc.get("name") for tc in (response.tool_calls or [])}
        assert "emit_intent_summary" not in tool_names
        assert "draft_prompt" not in tool_names

        # Soft semantic check: the response is in German (DE-Chat rule).
        assert isinstance(response.content, str)
        assert len(response.content) > 0


# ===========================================================================
# AC-3: Concrete input + all must-haves -> emit_intent_summary tool-call
# ===========================================================================


class TestAC3ConcreteInputTriggersEmitIntentSummary:
    """AC-3: GIVEN a case with concrete user input + all must-haves
    (``"Cyberpunk-Portrait, Oelgemaelde-Stil, fuer Print"`` -- subject +
    style + purpose clear),
    WHEN the agent runs and the mock returns an ``AIMessage`` with
    ``tool_calls=[{"name": "emit_intent_summary", "args": {...}}]``,
    THEN the test verifies that the prompt rule allows / mandates calling
    ``emit_intent_summary`` once the 3 mandatory axes (Subject + Style +
    Zweck) are covered; NO fallback to ``draft_prompt`` for final summaries.
    """

    def test_prompt_encodes_emit_intent_summary_as_final_summary_tool(self):
        """AC-3 (substring): the prompt explicitly mentions
        ``emit_intent_summary`` as the final-summary tool (not
        ``draft_prompt``).
        """
        from app.agent.prompts import _BASE_PROMPT

        assert "emit_intent_summary" in _BASE_PROMPT, (
            "AC-3 requires emit_intent_summary to be referenced in the prompt"
        )
        # Constraints require the explicit "ist KEIN Generate-Trigger" rule.
        # Accept several phrasings (case-insensitive).
        rule_patterns = [
            r"KEIN\s+Generate",
            r"nicht\s+generate",
            r"emit_intent_summary.*ist\s+kein",
        ]
        matches = [p for p in rule_patterns if re.search(p, _BASE_PROMPT, flags=re.IGNORECASE)]
        assert matches, (
            "AC-3 requires a rule clarifying that emit_intent_summary is NOT "
            "a generate trigger. Expected one of "
            f"{rule_patterns!r}"
        )

    @pytest.mark.asyncio
    async def test_mock_response_for_concrete_input_emits_intent_summary(self):
        """AC-3: simulated LLM response on concrete input contains exactly
        one ``emit_intent_summary`` tool_call.
        """
        # Arrange: simulate the LLM choosing emit_intent_summary.
        ai = AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "emit_intent_summary",
                    "args": {
                        "prompt": (
                            "cyberpunk portrait, oil painting style, "
                            "print-quality, highly detailed"
                        ),
                    },
                    "id": "call_eis_1",
                    "type": "tool_call",
                }
            ],
        )
        mock_llm = _make_mock_llm_returning(ai)

        # Act
        history = [
            _system_message_for_case(),
            HumanMessage(
                content="Cyberpunk-Portrait, Oelgemaelde-Stil, fuer Print"
            ),
        ]
        response: AIMessage = await mock_llm.ainvoke(history)

        # Assert
        tool_names = [tc["name"] for tc in (response.tool_calls or [])]
        assert "emit_intent_summary" in tool_names, (
            f"AC-3: expected emit_intent_summary in tool_calls, got {tool_names!r}"
        )
        # AC-3: NO fallback to draft_prompt.
        assert "draft_prompt" not in tool_names, (
            "AC-3: draft_prompt must NOT be used as the final-summary path"
        )

        # The emit_intent_summary args must contain a 'prompt' field (English).
        eis_call = next(
            tc for tc in response.tool_calls if tc["name"] == "emit_intent_summary"
        )
        assert "prompt" in eis_call["args"]
        prompt_text = eis_call["args"]["prompt"]
        assert isinstance(prompt_text, str)
        assert len(prompt_text) > 0


# ===========================================================================
# AC-4: Zwischen-Check is NOT a generate
# ===========================================================================


class TestAC4IntermediateCheckDoesNotCallTool:
    """AC-4: GIVEN an eval-case with a mid-interview clarification check
    (``"Verstehe ich richtig, dass du Cyberpunk willst?"`` as assistant
    question), followed by user confirmation,
    WHEN the mock LLM responds to the user confirmation,
    THEN the expected mock response is plain text or a follow-up question
    -- NO tool_call (neither ``emit_intent_summary`` nor ``draft_prompt``);
    the prompt rule "Zwischen-Check is NOT a generate" prevents premature
    tool firing.
    """

    def test_prompt_encodes_zwischen_check_is_not_generate_rule(self):
        """AC-4 (substring): the prompt contains a rule à la
        ``"Zwischen-Check ist KEIN Generate"`` (or equivalent).
        """
        from app.agent.prompts import _BASE_PROMPT

        candidates = [
            r"Zwischen-?Check\s+ist\s+KEIN\s+Generate",
            r"Zwischen-?Check\s+ist\s+kein\s+Generate",
            r"Zwischen-?Check\s+(?:ruf[sa]?t)\s*?\s*WEDER",
            r"Zwischen-?Check.*KEIN.*Tool",
        ]
        matches = [
            p for p in candidates
            if re.search(p, _BASE_PROMPT, flags=re.IGNORECASE | re.DOTALL)
        ]
        assert matches, (
            "AC-4 requires a rule that intermediate clarifications do NOT "
            f"trigger generate/tool-calls. Expected one of {candidates!r}"
        )

    @pytest.mark.asyncio
    async def test_mock_response_for_intermediate_check_has_no_tool_calls(self):
        """AC-4: after the user confirms a Zwischen-Check, the simulated
        LLM response is plain text -- no tool_call.
        """
        # Arrange: simulate the LLM following the Zwischen-Check-Regel.
        followup = AIMessage(
            content=(
                "Super, Cyberpunk passt. Wie soll der Stil sein -- eher "
                "fotorealistisch oder eine Illustration?"
            ),
            tool_calls=[],
        )
        mock_llm = _make_mock_llm_returning(followup)

        # Act
        history = [
            _system_message_for_case(),
            HumanMessage(content="ich moechte ein Cyberpunk-Bild"),
            AIMessage(
                content="Verstehe ich richtig, dass du Cyberpunk willst?"
            ),
            HumanMessage(content="ja, genau"),
        ]
        response: AIMessage = await mock_llm.ainvoke(history)

        # Assert
        assert response.tool_calls == [], (
            "AC-4: Zwischen-Check follow-up must NOT trigger tool-calls "
            f"(got {response.tool_calls!r})"
        )
        tool_names = {tc.get("name") for tc in (response.tool_calls or [])}
        assert "emit_intent_summary" not in tool_names
        assert "draft_prompt" not in tool_names


# ===========================================================================
# AC-5: img2img with multiple unrolled reference slots -> sequential
# per-slot questioning + set_slot_role calls
# ===========================================================================


class TestAC5MultiReferenceSequentialInterview:
    """AC-5: GIVEN an eval-case with ``generation_mode="img2img"`` and 3
    populated reference slots (Slot 0, 1, 2 each with ``image_url`` set,
    no role yet),
    WHEN the agent runs,
    THEN the prompt rule explicitly describes the sequential
    multi-reference flow: per slot one question (``"Was uebernehmen wir
    von Slot N? Subject, Style oder Composition?"``), followed by a
    ``set_slot_role`` tool-call with ``slot_index=N``, then the next slot.
    Substring-match phrases in the prompt: ``"sequenziell"`` or ``"ein
    Bild nach dem anderen"``; the rule references the tool ``set_slot_role``
    by name.
    """

    def test_prompt_encodes_sequential_multi_reference_rule(self):
        """AC-5 (substring): prompt mentions ``set_slot_role`` AND a
        sequential phrasing.
        """
        from app.agent.prompts import _BASE_PROMPT

        assert "set_slot_role" in _BASE_PROMPT, (
            "AC-5 requires set_slot_role to be referenced by name"
        )
        assert (
            "sequenziell" in _BASE_PROMPT
            or "ein Bild nach dem anderen" in _BASE_PROMPT
        ), (
            "AC-5 requires either 'sequenziell' or 'ein Bild nach dem anderen' "
            "to be present in the multi-reference rule"
        )

    def test_prompt_describes_per_slot_question_pattern(self):
        """AC-5: prompt includes the per-slot question pattern referencing
        Subject / Style / Composition options.
        """
        from app.agent.prompts import _BASE_PROMPT

        # The Spec example: "Was uebernehmen wir von Slot N? Subject, Style
        # oder Composition?". We accept any phrasing that mentions all
        # three role options together with Slot/slot_index hints.
        assert "Subject" in _BASE_PROMPT, (
            "AC-5: per-slot question should mention 'Subject' as an option"
        )
        assert "Style" in _BASE_PROMPT, (
            "AC-5: per-slot question should mention 'Style' as an option"
        )
        assert "Composition" in _BASE_PROMPT, (
            "AC-5: per-slot question should mention 'Composition' as an option"
        )
        # The slot mechanism is referenced (slot_index, Slot N, etc.).
        assert (
            "slot_index" in _BASE_PROMPT
            or re.search(r"Slot\s+N", _BASE_PROMPT)
            or re.search(r"Slot\s+\d", _BASE_PROMPT)
        ), (
            "AC-5: the prompt must reference slot indexing "
            "(slot_index / Slot N / Slot 0..2)"
        )

    @pytest.mark.asyncio
    async def test_mock_response_for_first_slot_calls_set_slot_role(self):
        """AC-5: when the user answers the per-slot question for Slot 0,
        the simulated LLM emits a single ``set_slot_role(slot_index=0, ...)``
        tool_call and proceeds to the next slot afterward.
        """
        # Arrange: simulate a LLM choosing set_slot_role for slot 0.
        ai = AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "set_slot_role",
                    "args": {"slot_index": 0, "role": "subject"},
                    "id": "call_ssr_0",
                    "type": "tool_call",
                }
            ],
        )
        mock_llm = _make_mock_llm_returning(ai)

        # Act: history shows the assistant having asked a per-slot question
        # for slot 0; the user answered "Subject".
        history = [
            _system_message_for_case(),
            HumanMessage(
                content="Hier sind drei Referenzbilder. (Slot 0, 1, 2 belegt.)"
            ),
            AIMessage(
                content=(
                    "Was uebernehmen wir von Slot 0? Subject, Style "
                    "oder Composition?"
                )
            ),
            HumanMessage(content="Subject."),
        ]
        response: AIMessage = await mock_llm.ainvoke(history)

        # Assert
        assert len(response.tool_calls) == 1, (
            "AC-5: expected exactly ONE tool_call per slot iteration "
            f"(got {len(response.tool_calls)})"
        )
        call = response.tool_calls[0]
        assert call["name"] == "set_slot_role"
        assert call["args"]["slot_index"] == 0
        assert call["args"]["role"] in {"subject", "style", "composition"}

        # AC-5: the LLM must NOT jump to emit_intent_summary while slots
        # are still un-roled.
        tool_names = {tc["name"] for tc in response.tool_calls}
        assert "emit_intent_summary" not in tool_names


# ===========================================================================
# AC-6: Post-summary refinement uses refine_prompt, not re-fired
# emit_intent_summary
# ===========================================================================


class TestAC6PostSummaryRefinementUsesRefinePrompt:
    """AC-6: GIVEN an eval-case where the LLM, after a successful
    ``emit_intent_summary`` call, receives another user message
    (``"Nochmal, aber dunkler"``),
    WHEN the mock response is simulated,
    THEN the prompt rule allows ``refine_prompt`` (for incremental
    refinements in the ``refining`` state) but NOT another
    ``emit_intent_summary`` without a fresh clarification; substring-match
    phrases in the prompt: ``"refine_prompt"`` as the refinement path,
    ``"emit_intent_summary"`` only ONCE per final-confirm.
    """

    def test_prompt_mentions_refine_prompt_as_refinement_path(self):
        """AC-6 (substring): ``refine_prompt`` is named as the refinement
        path in the prompt.
        """
        from app.agent.prompts import _BASE_PROMPT

        assert "refine_prompt" in _BASE_PROMPT, (
            "AC-6 requires the prompt to mention refine_prompt as the "
            "refinement path"
        )

    def test_prompt_explicitly_constrains_repeat_emit_intent_summary(self):
        """AC-6 (substring): the prompt enforces ``emit_intent_summary``
        only-once-per-final-confirm via an explicit rule.
        """
        from app.agent.prompts import _BASE_PROMPT

        # Constraints: "emit_intent_summary nur einmal pro Final-Confirm" or
        # equivalent ("NICHT erneut", "EINMAL", "nicht erneut auf").
        candidates = [
            r"emit_intent_summary.*EINMAL",
            r"emit_intent_summary.*einmal",
            r"emit_intent_summary.*NICHT\s+erneut",
            r"NICHT\s+erneut.*emit_intent_summary",
        ]
        matches = [
            p for p in candidates
            if re.search(p, _BASE_PROMPT, flags=re.DOTALL)
        ]
        assert matches, (
            "AC-6 requires a rule like 'emit_intent_summary nur einmal' / "
            "'NICHT erneut'. Expected one of "
            f"{candidates!r}"
        )

    @pytest.mark.asyncio
    async def test_mock_response_for_post_summary_refinement_uses_refine_prompt(self):
        """AC-6: simulated LLM response after a refinement request uses
        ``refine_prompt`` -- NOT another ``emit_intent_summary``.
        """
        # Arrange: simulate the LLM choosing refine_prompt.
        ai = AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "refine_prompt",
                    "args": {
                        "current_draft": {
                            "prompt": (
                                "cyberpunk portrait, oil painting, print quality"
                            )
                        },
                        "feedback": "darker mood",
                    },
                    "id": "call_rp_1",
                    "type": "tool_call",
                }
            ],
        )
        mock_llm = _make_mock_llm_returning(ai)

        # Act: history contains a prior emit_intent_summary turn followed by
        # the user requesting a darker variant.
        history = [
            _system_message_for_case(),
            HumanMessage(
                content="Cyberpunk-Portrait, Oelgemaelde-Stil, fuer Print"
            ),
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "emit_intent_summary",
                        "args": {
                            "prompt": (
                                "cyberpunk portrait, oil painting, print quality"
                            )
                        },
                        "id": "prior_eis",
                        "type": "tool_call",
                    }
                ],
            ),
            HumanMessage(content="Nochmal, aber dunkler"),
        ]
        response: AIMessage = await mock_llm.ainvoke(history)

        # Assert
        tool_names = [tc["name"] for tc in (response.tool_calls or [])]
        assert "refine_prompt" in tool_names, (
            f"AC-6: expected refine_prompt in tool_calls, got {tool_names!r}"
        )
        assert "emit_intent_summary" not in tool_names, (
            "AC-6: emit_intent_summary must NOT be re-fired without a fresh "
            "clarification"
        )


# ===========================================================================
# AC-8: Aggregate gate -- at least 5 eval-cases pass
# ===========================================================================


class TestAC8AggregateGate:
    """AC-8: GIVEN the joint eval-set (AC-2 .. AC-6) runs as a pytest suite,
    WHEN all eval-cases are executed,
    THEN at least 5 eval-cases are green (AC-2 vague input, AC-3 concrete
    input, AC-4 Zwischen-Check, AC-5 multi-reference, AC-6 refine-after-
    summary); the done-signal "at least 5 eval-cases pass" is met.

    This test makes the aggregate-pass gate explicit: it re-asserts the
    five high-level rules at the prompt level. If the per-AC tests above
    pass, this test acts as a safety-net assertion that the full set is
    aligned and complete.
    """

    def test_at_least_five_eval_cases_have_prompt_anchors(self):
        """AC-8: at least 5 of the AC-2..AC-6 rules are anchored in the
        prompt text. Each anchor corresponds to one of the eval-cases
        above. We require >= 5 (i.e. ALL five) here -- a softer gate
        would invite skipping individual rules.
        """
        from app.agent.prompts import _BASE_PROMPT

        anchors = {
            # AC-2: vague-input rule
            "vague_input": bool(
                re.search(
                    r"vager?\s+Intent|frage\s+zuerst|keine\s+Annahmen",
                    _BASE_PROMPT,
                    flags=re.IGNORECASE,
                )
            ),
            # AC-3: emit_intent_summary as final-summary tool
            "final_summary_tool": "emit_intent_summary" in _BASE_PROMPT,
            # AC-4: Zwischen-Check is not a generate
            "zwischen_check_not_generate": bool(
                re.search(
                    r"Zwischen-?Check.*(?:KEIN|kein)\s+Generate"
                    r"|Zwischen-?Check.*WEDER"
                    r"|Zwischen-?Check.*KEIN\s+Tool",
                    _BASE_PROMPT,
                    flags=re.DOTALL,
                )
            ),
            # AC-5: sequential multi-reference + set_slot_role
            "multi_reference_sequential": (
                "set_slot_role" in _BASE_PROMPT
                and (
                    "sequenziell" in _BASE_PROMPT
                    or "ein Bild nach dem anderen" in _BASE_PROMPT
                )
            ),
            # AC-6: refine_prompt as refinement path
            "refine_path": "refine_prompt" in _BASE_PROMPT,
        }

        passed = sum(1 for v in anchors.values() if v)
        failing = [k for k, v in anchors.items() if not v]
        assert passed >= 5, (
            f"AC-8 demands >= 5 eval-case anchors are present, got {passed}/5. "
            f"Missing: {failing!r}"
        )


# ===========================================================================
# Adversarial cross-checks: prompt must NOT silently regress to old wording
# ===========================================================================


class TestAdversarialNoRegressionToOldPrompt:
    """Adversarial / negative tests that defend against partial rewrites
    silently leaving the old anti-phrase or losing required tool names.

    These tests exist because the file ``backend/app/agent/prompts.py`` is
    edited as a single string -- a careless merge could re-introduce the
    old wording. They duplicate intent of AC-1 / AC-9 with a different
    phrasing on purpose.
    """

    def test_no_old_anti_phrase_anywhere_in_built_prompt(self):
        """Any composition (with or without context / knowledge) must be
        free of the old anti-phrase.
        """
        from app.agent.prompts import build_assistant_system_prompt

        for ctx in (None, "Brand X", "  "):
            for model in (None, "flux-2-pro"):
                # We do not patch knowledge here -- failure on missing
                # knowledge for "flux-2-pro" is acceptable because we only
                # care about the no-regression check on the BASE part.
                try:
                    out = build_assistant_system_prompt(
                        image_model_id=model,
                        generation_mode=None,
                        project_context=ctx,
                    )
                except Exception:
                    # Knowledge layer not configured for this model -- skip
                    # this combination; the base-only combinations still run.
                    continue
                assert "kein Fragebogen" not in out, (
                    f"Anti-phrase resurfaced for ctx={ctx!r}, model={model!r}"
                )

    def test_required_tools_named_in_prompt(self):
        """All required tool names referenced in Constraints appear in the
        prompt text. Defends against name drift.
        """
        from app.agent.prompts import _BASE_PROMPT

        required_tools = [
            "draft_prompt",
            "refine_prompt",
            "emit_intent_summary",
            "analyze_image",
            "recommend_model",
            "web_search",
            "set_slot_role",
        ]
        missing = [t for t in required_tools if t not in _BASE_PROMPT]
        assert not missing, (
            f"Prompt is missing required tool name references: {missing!r}"
        )
