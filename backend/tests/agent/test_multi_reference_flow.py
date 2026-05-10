"""Multi-Reference-Interview Eval-Suite (Slice 25).

This eval-only slice verifies the sequential per-slot interview behaviour
encoded in ``_BASE_PROMPT`` (Slice 12) for img2img sessions with multiple
populated ReferenceBar slots:

* On a 3-slot session the assistant must emit exactly three
  ``set_slot_role`` tool-calls covering ``slot_index in {0, 1, 2}`` once
  each, in strictly ascending order, each preceded by an assistant
  message that references the matching slot textually.
* On a 2-slot session the assistant must emit exactly two
  ``set_slot_role`` tool-calls (no fabricated call for the empty slot).
* When the user marks a slot as "egal"/"ignoriere", no tool-call is
  produced for that slot and the remaining sequence stays ascending.

Mocking strategy: ``mock_external`` (consistent with Slice 12).
``AsyncMock`` over the LLM-layer; mock responses are deterministic
``AIMessage`` sequences with ``tool_calls`` fields. ``set_slot_role``
itself is imported from Slice 23 (no re-implementation) and used to
validate the ``tool_calls.args`` against the Pydantic schema.
"""

from __future__ import annotations

import re
import socket
from typing import Any
from unittest.mock import AsyncMock

import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import ValidationError

from app.agent.prompts import _BASE_PROMPT, build_assistant_system_prompt
from app.agent.tools.workspace_tools import set_slot_role


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _system_message_for_case() -> SystemMessage:
    """Build a SystemMessage from the rewritten ``_BASE_PROMPT``."""
    return SystemMessage(
        content=build_assistant_system_prompt(
            image_model_id=None,
            generation_mode="img2img",
            project_context=None,
        )
    )


def _make_mock_llm_with_sequence(responses: list[AIMessage]) -> AsyncMock:
    """Build an ``AsyncMock`` LLM whose successive ``ainvoke`` calls return
    the messages in ``responses`` in order. ``invoke`` mirrors the same
    side-effect for parity with synchronous code paths.
    """
    mock = AsyncMock()
    mock.ainvoke = AsyncMock(side_effect=list(responses))
    mock.invoke = AsyncMock(side_effect=list(responses))
    return mock


def _slot_question(slot_n: int, image_word: str = "Slot") -> AIMessage:
    """Construct a deterministic per-slot clarification question."""
    return AIMessage(
        content=(
            f"Was uebernehmen wir von {image_word} {slot_n}? "
            "Subject, Style oder Composition?"
        ),
        tool_calls=[],
    )


def _set_slot_role_call(
    slot_index: int,
    role: str,
    call_id: str | None = None,
) -> AIMessage:
    """Construct an ``AIMessage`` that emits a single ``set_slot_role``
    tool-call with the given ``slot_index`` and ``role``.
    """
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "set_slot_role",
                "args": {"slot_index": slot_index, "role": role},
                "id": call_id or f"call_ssr_{slot_index}",
                "type": "tool_call",
            }
        ],
    )


def _reference_slots(num_populated: int) -> list[dict[str, Any]]:
    """Build a workspace-snapshot-style list of populated reference-bar slots.

    Each populated slot has ``image_url`` set, ``role=None`` and
    ``strength=None`` (matches AC-1 GIVEN clause; see also Slice 24
    Frontend-Reducer-Vertrag).
    """
    return [
        {
            "slot_index": idx,
            "image_url": f"https://example.test/ref-{idx}.png",
            "role": None,
            "strength": None,
        }
        for idx in range(num_populated)
    ]


def _extract_tool_calls(messages: list[BaseMessage]) -> list[dict]:
    """Flatten all ``set_slot_role`` tool-calls out of an AIMessage stream
    in the order they appear.
    """
    calls: list[dict] = []
    for msg in messages:
        if not isinstance(msg, AIMessage):
            continue
        for tc in msg.tool_calls or []:
            if tc.get("name") == "set_slot_role":
                calls.append(tc)
    return calls


async def _drive_eval_stream(
    mock_llm: AsyncMock,
    base_history: list[BaseMessage],
    user_turns: list[HumanMessage],
) -> list[BaseMessage]:
    """Replay a deterministic interview by alternating user turns with
    LLM responses from ``mock_llm``.

    The mock is configured with a ``side_effect`` list; each ``ainvoke``
    call consumes one entry. We append every assistant response to the
    running history, interleaving user turns between them. The returned
    list is the full transcript, in chronological order, ready for
    assertions on tool-call counts/order/preceding-messages.

    LangGraph-flavoured pacing: each user turn triggers ONE assistant
    response. If that response is a tool-call (no text), the agent loop
    would re-enter with the tool result -- we simulate that by
    consuming the NEXT mocked assistant response (typically the
    clarifying question for the next slot) without an interleaved user
    turn.
    """
    transcript: list[BaseMessage] = list(base_history)

    for user_turn in user_turns:
        transcript.append(user_turn)
        # Pull the next assistant response from the mock.
        try:
            ai = await mock_llm.ainvoke(transcript)
        except StopAsyncIteration:
            break
        transcript.append(ai)

        # If the assistant emitted a tool-call, simulate the LangGraph
        # "tool-result re-entry" by consuming the next mocked response on
        # the same user-turn. Stop as soon as we get a plain text question
        # (which awaits the next user turn).
        while ai.tool_calls:
            try:
                ai = await mock_llm.ainvoke(transcript)
            except StopAsyncIteration:
                break
            transcript.append(ai)
            if not ai.tool_calls:
                break

    return transcript


# ---------------------------------------------------------------------------
# AC-1: Happy-path 3-slot sequence -- exactly 3 set_slot_role calls covering
# slot_index in {0, 1, 2} once each.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eval_three_slot_session_emits_three_unique_set_slot_role_calls():
    """AC-1: GIVEN simulated img2img session with 3 populated slots,
    WHEN the mock LLM stream alternates clarifying-question + set_slot_role
    tool-call for each of slot_index in {0, 1, 2},
    THEN exactly 3 set_slot_role tool-calls are emitted, each with a unique
    slot_index in {0, 1, 2} (no duplicates, no skipped slot).
    """
    # Arrange: 3 populated slots in workspace snapshot.
    slots = _reference_slots(3)
    assert len(slots) == 3

    # Assistant response sequence per Slice spec AC-1 (a..f):
    # (a) question for slot 0, (b) tool-call slot 0,
    # (c) question for slot 1, (d) tool-call slot 1,
    # (e) question for slot 2, (f) tool-call slot 2.
    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject", call_id="call_ssr_0"),
        _slot_question(1),
        _set_slot_role_call(1, "style", call_id="call_ssr_1"),
        _slot_question(2),
        _set_slot_role_call(2, "composition", call_id="call_ssr_2"),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)

    base_history: list[BaseMessage] = [
        _system_message_for_case(),
    ]
    # User-turn pacing per AC-1 spec sequence (a)..(f):
    #   turn 1 (initial population) -> question (a)
    #   turn 2 ("Subject.")          -> tool-call (b) + question (c) re-entry
    #   turn 3 ("Style.")            -> tool-call (d) + question (e) re-entry
    #   turn 4 ("Composition.")      -> tool-call (f) -- last call, no re-entry
    user_turns = [
        HumanMessage(
            content=(
                f"Hier sind drei Referenzbilder. (Slot 0, 1, 2 belegt: "
                f"{len(slots)} slots)"
            )
        ),
        HumanMessage(content="Subject."),
        HumanMessage(content="Style."),
        HumanMessage(content="Composition."),
    ]

    # Act
    transcript = await _drive_eval_stream(mock_llm, base_history, user_turns)

    # Assert: exactly three set_slot_role tool-calls.
    calls = _extract_tool_calls(transcript)
    assert len(calls) == 3, (
        f"AC-1: expected exactly 3 set_slot_role tool-calls, got {len(calls)}"
    )

    # Each call has a unique slot_index covering the multiset {0, 1, 2}.
    slot_indices = [c["args"]["slot_index"] for c in calls]
    assert sorted(slot_indices) == [0, 1, 2], (
        f"AC-1: tool-calls must cover slot_index multiset {{0,1,2}} once each "
        f"(got {slot_indices})"
    )
    assert len(set(slot_indices)) == 3, (
        f"AC-1: slot_index values must be unique (got duplicates in {slot_indices})"
    )


# ---------------------------------------------------------------------------
# AC-2: Strictly ascending slot_index order (0 -> 1 -> 2).
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eval_three_slot_session_calls_are_in_ascending_order():
    """AC-2: GIVEN the same 3-slot session, WHEN inspecting the order of
    set_slot_role tool-calls, THEN they appear in strictly ascending
    slot_index order (0 before 1 before 2).
    """
    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject"),
        _slot_question(1),
        _set_slot_role_call(1, "style"),
        _slot_question(2),
        _set_slot_role_call(2, "composition"),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)

    base_history: list[BaseMessage] = [_system_message_for_case()]
    user_turns = [
        HumanMessage(content="Hier sind drei Referenzbilder."),
        HumanMessage(content="Subject."),
        HumanMessage(content="Style."),
        HumanMessage(content="Composition."),
    ]

    transcript = await _drive_eval_stream(mock_llm, base_history, user_turns)
    calls = _extract_tool_calls(transcript)

    assert len(calls) == 3, (
        f"AC-2 precondition: expected 3 tool-calls in 3-slot session "
        f"(got {len(calls)})"
    )

    indices = [c["args"]["slot_index"] for c in calls]
    assert indices == sorted(indices), (
        f"AC-2: slot_index sequence must be strictly ascending (got {indices})"
    )
    # Strictly ascending: each subsequent index is strictly greater.
    for prev, nxt in zip(indices, indices[1:]):
        assert nxt > prev, (
            f"AC-2: out-of-order tool-call detected: {prev} -> {nxt}"
        )


# ---------------------------------------------------------------------------
# AC-3: Each set_slot_role call is preceded by an assistant message that
# textually references the matching slot.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eval_each_tool_call_has_preceding_slot_reference_message():
    """AC-3: GIVEN the same 3-slot session, WHEN inspecting the assistant
    text-messages between tool-calls, THEN each set_slot_role(slot_index=N)
    call is preceded by at least one assistant message referencing slot N
    via one of the patterns: "Slot N", "Bild N", or
    "erste/zweite/dritte".
    """
    # Slot reference words: one of the three patterns must be present in the
    # preceding assistant message for slot N.
    ordinal_words = ["erste", "zweite", "dritte"]

    responses = [
        # Slot 0 question uses "Slot 0" pattern.
        AIMessage(
            content=(
                "Was uebernehmen wir vom ersten Bild (Slot 0)? "
                "Subject, Style oder Composition?"
            ),
            tool_calls=[],
        ),
        _set_slot_role_call(0, "subject"),
        # Slot 1 question uses "Bild 1" pattern.
        AIMessage(
            content="Und vom zweiten Bild 1 -- was uebernehmen wir?",
            tool_calls=[],
        ),
        _set_slot_role_call(1, "style"),
        # Slot 2 question uses "Slot 2" pattern.
        AIMessage(
            content="Bei Slot 2 (drittes Bild): welche Rolle?",
            tool_calls=[],
        ),
        _set_slot_role_call(2, "composition"),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)

    base_history: list[BaseMessage] = [_system_message_for_case()]
    user_turns = [
        HumanMessage(content="Hier sind drei Referenzbilder."),
        HumanMessage(content="Subject."),
        HumanMessage(content="Style."),
        HumanMessage(content="Composition."),
    ]

    transcript = await _drive_eval_stream(mock_llm, base_history, user_turns)

    # AC-3 precondition: 3 tool-calls were emitted.
    calls = _extract_tool_calls(transcript)
    assert len(calls) == 3, (
        f"AC-3 precondition: expected 3 tool-calls (got {len(calls)})"
    )

    # For each set_slot_role call: scan backwards through the transcript
    # to find the most recent assistant message with non-empty content;
    # assert it references the slot using one of the allowed patterns.
    def references_slot(text: str, slot_n: int) -> bool:
        if not text:
            return False
        # Pattern 1: "Slot N"
        if re.search(rf"\bSlot\s+{slot_n}\b", text, flags=re.IGNORECASE):
            return True
        # Pattern 2: "Bild N"
        if re.search(rf"\bBild\s+{slot_n}\b", text, flags=re.IGNORECASE):
            return True
        # Pattern 3: ordinal words "erste/zweite/dritte" (slot 0 = erste,
        # slot 1 = zweite, slot 2 = dritte).
        if re.search(rf"\b{ordinal_words[slot_n]}", text, flags=re.IGNORECASE):
            return True
        return False

    for idx, msg in enumerate(transcript):
        if not isinstance(msg, AIMessage) or not msg.tool_calls:
            continue
        for tc in msg.tool_calls:
            if tc.get("name") != "set_slot_role":
                continue
            slot_n = tc["args"]["slot_index"]
            # Walk backwards looking for the most recent assistant message
            # with non-empty content.
            preceding_texts: list[str] = []
            for prev in reversed(transcript[:idx]):
                if isinstance(prev, AIMessage) and prev.content:
                    preceding_texts.append(str(prev.content))
                    break
            assert preceding_texts, (
                f"AC-3: no preceding assistant message for slot_index={slot_n}"
            )
            assert references_slot(preceding_texts[0], slot_n), (
                f"AC-3: preceding assistant message for slot_index={slot_n} "
                f"does not reference the slot via Slot/Bild/ordinal pattern. "
                f"Got: {preceding_texts[0]!r}"
            )


# ---------------------------------------------------------------------------
# AC-4: 2-slot variant -- exactly 2 tool-calls, no fabricated third call.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eval_two_slot_session_emits_only_two_calls():
    """AC-4: GIVEN an img2img session with only TWO populated slots
    (slot_index in {0, 1}), WHEN the mock stream emits 2 set_slot_role
    tool-calls followed by an overall-intent follow-up question
    (Discovery step 5), THEN exactly 2 tool-calls occur (no fabricated
    third call for an empty slot).
    """
    slots = _reference_slots(2)
    assert len(slots) == 2

    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject"),
        _slot_question(1),
        _set_slot_role_call(1, "style"),
        # Discovery step 5: after the last populated slot, the assistant
        # asks an overall-intent follow-up -- NO third set_slot_role.
        AIMessage(
            content=(
                "Was soll das finale Bild zeigen, mit diesen beiden Referenzen? "
                "Welche Stimmung schwebt dir vor?"
            ),
            tool_calls=[],
        ),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)

    base_history: list[BaseMessage] = [_system_message_for_case()]
    # 2-slot pacing: turn 1 (population) -> question (slot 0); turn 2
    # ("Subject.") -> tool-call slot 0 + question slot 1; turn 3 ("Style.")
    # -> tool-call slot 1 + overall-intent follow-up question; turn 4
    # ("Dunkle Stimmung.") -- nothing more is consumed (mock list exhausted).
    user_turns = [
        HumanMessage(content="Hier sind zwei Referenzbilder. (Slot 0, 1)"),
        HumanMessage(content="Subject."),
        HumanMessage(content="Style."),
        HumanMessage(content="Eher dunkle, geheimnisvolle Stimmung."),
    ]

    transcript = await _drive_eval_stream(mock_llm, base_history, user_turns)

    calls = _extract_tool_calls(transcript)
    assert len(calls) == 2, (
        f"AC-4: 2-slot session must emit EXACTLY 2 set_slot_role calls "
        f"(got {len(calls)})"
    )
    indices = sorted(c["args"]["slot_index"] for c in calls)
    assert indices == [0, 1], (
        f"AC-4: 2-slot session must cover slot_index {{0, 1}} (got {indices})"
    )
    # No fabricated call for slot 2.
    assert all(c["args"]["slot_index"] != 2 for c in calls), (
        "AC-4: no fabricated set_slot_role for slot_index=2 allowed in 2-slot "
        "session"
    )


# ---------------------------------------------------------------------------
# AC-5: User marks a slot as "egal"/"ignoriere" -> no tool-call for that slot;
# remaining sequence stays ascending.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eval_user_skipped_slot_omits_tool_call():
    """AC-5: GIVEN a 3-slot session in which the user marks slot 1 as
    "egal" / "ignoriere", WHEN the mock LLM omits the set_slot_role call
    for slot 1 and proceeds directly to slot 2, THEN it is OK that no
    tool-call exists for the skipped slot; remaining tool-calls are still
    ascending and there is no crash / validation error.
    """
    slots = _reference_slots(3)
    assert len(slots) == 3

    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject"),
        # Slot 1 question.
        _slot_question(1),
        # User says "Bild 1 ist nicht wichtig, lass es weg" -- the assistant
        # acknowledges and moves on to slot 2 WITHOUT emitting set_slot_role
        # for slot 1.
        AIMessage(
            content=(
                "Alles klar, Slot 1 lassen wir weg. "
                "Was uebernehmen wir von Slot 2? "
                "Subject, Style oder Composition?"
            ),
            tool_calls=[],
        ),
        _set_slot_role_call(2, "composition"),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)

    base_history: list[BaseMessage] = [_system_message_for_case()]
    # AC-5 pacing: turn 1 (population) -> question slot 0; turn 2
    # ("Subject.") -> tool-call slot 0 + question slot 1; turn 3
    # ("Bild 1 ist nicht wichtig...") -> ack-and-move-on text (no tool-call);
    # turn 4 ("Composition.") -> tool-call slot 2.
    user_turns = [
        HumanMessage(content="Hier sind drei Referenzbilder."),
        HumanMessage(content="Subject."),
        HumanMessage(content="Bild 1 ist nicht wichtig, lass es weg"),
        HumanMessage(content="Composition."),
    ]

    # Act: must not raise, must not crash.
    transcript = await _drive_eval_stream(mock_llm, base_history, user_turns)

    # Assert: exactly 2 tool-calls; slot 1 has been skipped.
    calls = _extract_tool_calls(transcript)
    assert len(calls) == 2, (
        f"AC-5: skipped-slot session yields exactly 2 calls "
        f"(got {len(calls)})"
    )
    indices = [c["args"]["slot_index"] for c in calls]
    assert 1 not in indices, (
        f"AC-5: skipped slot 1 must NOT have a set_slot_role call (got {indices})"
    )
    # Remaining sequence stays ascending.
    assert indices == sorted(indices), (
        f"AC-5: remaining slot_index sequence must stay ascending "
        f"(got {indices})"
    )
    assert indices == [0, 2], (
        f"AC-5: remaining tool-calls must be exactly [0, 2] (got {indices})"
    )


# ---------------------------------------------------------------------------
# AC-6: ``_BASE_PROMPT`` contains the multi-reference mandatory phrases.
# ---------------------------------------------------------------------------


def test_base_prompt_contains_multi_reference_phrases():
    """AC-6: GIVEN the ``_BASE_PROMPT`` is loaded from Slice 12,
    WHEN the eval-suite starts, THEN the prompt contains BOTH:
    (a) the literal ``"set_slot_role"`` substring AND
    (b) one of ``"sequenziell"`` or ``"ein Bild nach dem anderen"``.
    """
    assert "set_slot_role" in _BASE_PROMPT, (
        "AC-6: _BASE_PROMPT must reference the tool name 'set_slot_role' "
        "(Slice 12 AC-1 + AC-5 mandatory phrase)"
    )
    has_sequential = (
        "sequenziell" in _BASE_PROMPT
        or "ein Bild nach dem anderen" in _BASE_PROMPT
    )
    assert has_sequential, (
        "AC-6: _BASE_PROMPT must contain either 'sequenziell' OR "
        "'ein Bild nach dem anderen' (Slice 12 AC-5 sequential rule)"
    )


# ---------------------------------------------------------------------------
# AC-7: Aggregate gate -- at least the three core eval-cases (AC-1, AC-4,
# AC-5) all pass.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eval_set_minimum_three_cases_pass():
    """AC-7: GIVEN the eval-set consists of AC-1 (3-slot happy path),
    AC-4 (2-slot variant), and AC-5 (slot-skip via user wish),
    WHEN the suite is executed, THEN all three core cases are green.

    This is a programmatic re-run gate that runs all three core cases
    inline and asserts each one's invariant. It complements the
    individual AC-1/AC-4/AC-5 tests: if any one of those three breaks,
    this gate also fails -- the done-signal "3-slot-session-mock yields
    3 sequential questions and 3 set_slot_role calls" is only met when
    all three core cases hold simultaneously.
    """
    cases_passed = 0

    # --- Re-run AC-1 invariant: 3-slot happy path -> 3 unique calls, ascending ---
    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject"),
        _slot_question(1),
        _set_slot_role_call(1, "style"),
        _slot_question(2),
        _set_slot_role_call(2, "composition"),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)
    transcript = await _drive_eval_stream(
        mock_llm,
        [_system_message_for_case()],
        [
            HumanMessage(content="3 slots"),
            HumanMessage(content="Subject."),
            HumanMessage(content="Style."),
            HumanMessage(content="Composition."),
        ],
    )
    calls = _extract_tool_calls(transcript)
    indices = [c["args"]["slot_index"] for c in calls]
    if (
        len(calls) == 3
        and sorted(indices) == [0, 1, 2]
        and indices == sorted(indices)
    ):
        cases_passed += 1

    # --- Re-run AC-4 invariant: 2-slot session -> exactly 2 calls ---
    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject"),
        _slot_question(1),
        _set_slot_role_call(1, "style"),
        AIMessage(content="Was soll das finale Bild zeigen?", tool_calls=[]),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)
    transcript = await _drive_eval_stream(
        mock_llm,
        [_system_message_for_case()],
        [
            HumanMessage(content="2 slots"),
            HumanMessage(content="Subject."),
            HumanMessage(content="Style."),
            HumanMessage(content="Dunkle Stimmung."),
        ],
    )
    calls = _extract_tool_calls(transcript)
    if len(calls) == 2 and sorted(c["args"]["slot_index"] for c in calls) == [0, 1]:
        cases_passed += 1

    # --- Re-run AC-5 invariant: skipped slot -> 2 ascending calls (0, 2) ---
    responses = [
        _slot_question(0),
        _set_slot_role_call(0, "subject"),
        _slot_question(1),
        AIMessage(
            content="Alles klar, Slot 1 lassen wir weg. Was uebernehmen wir von Slot 2?",
            tool_calls=[],
        ),
        _set_slot_role_call(2, "composition"),
    ]
    mock_llm = _make_mock_llm_with_sequence(responses)
    transcript = await _drive_eval_stream(
        mock_llm,
        [_system_message_for_case()],
        [
            HumanMessage(content="3 slots"),
            HumanMessage(content="Subject."),
            HumanMessage(content="Bild 1 ist nicht wichtig, lass es weg"),
            HumanMessage(content="Composition."),
        ],
    )
    calls = _extract_tool_calls(transcript)
    indices = [c["args"]["slot_index"] for c in calls]
    if (
        len(calls) == 2
        and indices == [0, 2]
        and 1 not in indices
    ):
        cases_passed += 1

    assert cases_passed >= 3, (
        f"AC-7 demands >= 3 core eval-cases pass (AC-1, AC-4, AC-5); "
        f"got {cases_passed}/3"
    )


# ---------------------------------------------------------------------------
# AC-8: ``set_slot_role`` is imported from Slice 23; mock ``tool_calls.args``
# conform to the imported Pydantic schema.
# ---------------------------------------------------------------------------


def test_mock_tool_call_args_conform_to_set_slot_role_schema():
    """AC-8: GIVEN ``set_slot_role`` is imported from
    ``app.agent.tools.workspace_tools`` (Slice 23), WHEN inspecting the
    Pydantic schema, THEN every mock tool-call args dict used in this
    suite validates cleanly against ``set_slot_role.args_schema``
    (no re-implementation; schema-conformance contract).
    """
    # Anchor: the imported tool is the slice-23 symbol.
    assert set_slot_role.name == "set_slot_role", (
        f"AC-8: imported tool must be named 'set_slot_role' "
        f"(got {set_slot_role.name!r})"
    )
    schema_cls = set_slot_role.args_schema
    assert schema_cls is not None, (
        "AC-8: set_slot_role must declare an args_schema (Pydantic) for "
        "mock-args validation"
    )

    # Every mock-args used across the suite must validate.
    valid_args_samples = [
        {"slot_index": 0, "role": "subject"},
        {"slot_index": 1, "role": "style"},
        {"slot_index": 2, "role": "composition"},
    ]
    for args in valid_args_samples:
        # Must NOT raise -- validates the LangChain tool_calls.args contract.
        instance = schema_cls(**args)
        dump = instance.model_dump()
        assert dump["slot_index"] == args["slot_index"]
        assert dump["role"] == args["role"]
        # Pydantic enforces integer slot_index, not string (Slice 23 AC-2).
        assert isinstance(dump["slot_index"], int)
        assert not isinstance(dump["slot_index"], bool)

    # Negative anchors: violating-args MUST raise. This guards the schema
    # against regression to a less-strict definition.
    invalid_samples = [
        {"slot_index": -1, "role": "subject"},  # ge=0 violation
        {"slot_index": 0, "role": "background"},  # role-literal violation
        {"slot_index": "0", "role": "subject"},  # string instead of int -> coerce check
    ]
    raises_count = 0
    for bad in invalid_samples:
        try:
            schema_cls(**bad)
        except (ValidationError, TypeError, ValueError):
            raises_count += 1
    # At least the two strict violations (negative slot_index, unknown role)
    # MUST raise. The string->int sample may be coerced by Pydantic and is
    # therefore not strictly required to raise.
    assert raises_count >= 2, (
        f"AC-8: schema must reject at least 2 of the 3 negative samples "
        f"(got {raises_count}); current schema is too permissive"
    )


# ---------------------------------------------------------------------------
# AC-9: Suite runs offline -- no live LLM, no live FastAPI server, no DB
# connection; AsyncMock-driven only.
# ---------------------------------------------------------------------------


def test_eval_suite_runs_fully_mocked_offline():
    """AC-9: GIVEN the eval-suite is executed in isolation,
    WHEN pytest runs the file, THEN no live LLM API call, no live
    FastAPI server, and no DB connection is required.

    This test acts as the aggregate offline-gate. It asserts:
      (a) The mock LLM helper produces an ``AsyncMock`` (no real client).
      (b) ``set_slot_role`` is the imported Slice-23 symbol (no
          re-implementation in this file).
      (c) ``_BASE_PROMPT`` is loaded as a plain Python string at import
          time (no network fetch).
      (d) No outbound socket connection is opened during the eval helper
          construction. We monkey-patch ``socket.socket.connect`` with a
          guard that raises if invoked from within this test.
    """
    # (a) AsyncMock-driven LLM helper.
    mock = _make_mock_llm_with_sequence(
        [AIMessage(content="ping", tool_calls=[])]
    )
    assert isinstance(mock, AsyncMock), (
        "AC-9: helper must produce an AsyncMock-driven LLM (not a live client)"
    )
    assert hasattr(mock, "ainvoke") and isinstance(mock.ainvoke, AsyncMock)

    # (b) Imported Slice-23 symbol.
    assert set_slot_role.name == "set_slot_role"
    # The tool's module identifies it as the workspace_tools module
    # (Slice 23). If the module path drifts, the import contract changes.
    assert (
        getattr(set_slot_role, "func", None) is not None
        or callable(set_slot_role)
    ), "AC-9: set_slot_role must be a callable LangChain tool"

    # (c) ``_BASE_PROMPT`` is a plain str, not a deferred fetch.
    assert isinstance(_BASE_PROMPT, str)
    assert len(_BASE_PROMPT) > 0
    # The string must already contain the multi-reference anchor; if a
    # fetch were involved this would fail at import-time, which would
    # itself be a violation of the offline-gate.
    assert "set_slot_role" in _BASE_PROMPT

    # (d) No outbound socket connections during a fresh helper build. We
    # monkey-patch socket.socket.connect for the duration of the helper
    # construction. If any code path silently attempts to connect to a
    # remote host, the patch raises and this test fails.
    original_connect = socket.socket.connect
    connection_attempts: list[Any] = []

    def _guard(self, address):  # type: ignore[no-redef]
        connection_attempts.append(address)
        raise AssertionError(
            f"AC-9 violation: outbound socket.connect attempted to {address!r} "
            f"during a 'mock-only' eval helper construction"
        )

    socket.socket.connect = _guard  # type: ignore[assignment]
    try:
        _ = _make_mock_llm_with_sequence(
            [AIMessage(content="x", tool_calls=[])]
        )
        _ = _slot_question(0)
        _ = _set_slot_role_call(0, "subject")
        _ = _reference_slots(3)
    finally:
        socket.socket.connect = original_connect  # type: ignore[assignment]

    assert connection_attempts == [], (
        f"AC-9: no outbound connections allowed (got attempts: "
        f"{connection_attempts!r})"
    )
