"""Multi-Reference-Interview Eval-Suite (Slice 25).

This eval-only slice verifies the sequential per-slot interview behaviour
encoded in ``_BASE_PROMPT`` (Slice 12) for img2img sessions with multiple
populated ReferenceBar slots:

* On a 3-slot session the assistant must emit exactly three
  ``set_slot_role`` tool-calls covering ``slot_index ∈ {0, 1, 2}`` once
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

Test bodies are intentionally left as ``pytest.mark.skip`` skeletons
per the Slice-25 spec — the Test-Writer-Agent fills them in after the
Implementer-Agent has prepared this scaffold.
"""

import pytest


# ---------------------------------------------------------------------------
# AC-1: Happy-path 3-slot sequence — exactly 3 set_slot_role calls covering
# slot_index ∈ {0, 1, 2} once each.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-1: 3-slot session yields exactly 3 set_slot_role calls covering "
        "slot_index {0,1,2} once each"
    )
)
@pytest.mark.asyncio
async def test_eval_three_slot_session_emits_three_unique_set_slot_role_calls():
    ...


# ---------------------------------------------------------------------------
# AC-2: Strictly ascending slot_index order (0 -> 1 -> 2) across the
# set_slot_role tool-calls.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason="AC-2: set_slot_role calls occur in strictly ascending slot_index order"
)
@pytest.mark.asyncio
async def test_eval_three_slot_session_calls_are_in_ascending_order():
    ...


# ---------------------------------------------------------------------------
# AC-3: Each set_slot_role call is preceded by an assistant message that
# textually references the matching slot.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-3: each set_slot_role call is preceded by an assistant message "
        "referencing the matching slot"
    )
)
@pytest.mark.asyncio
async def test_eval_each_tool_call_has_preceding_slot_reference_message():
    ...


# ---------------------------------------------------------------------------
# AC-4: 2-slot variant — exactly 2 tool-calls, no fabricated third call for
# an empty slot.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-4: 2-slot session yields exactly 2 set_slot_role calls; "
        "no fabricated call for empty slot"
    )
)
@pytest.mark.asyncio
async def test_eval_two_slot_session_emits_only_two_calls():
    ...


# ---------------------------------------------------------------------------
# AC-5: User marks a slot as "egal"/"ignoriere" -> no set_slot_role call for
# that slot; remaining sequence stays ascending.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-5: user-skipped slot results in no set_slot_role call for that "
        "slot; remaining sequence stays ascending"
    )
)
@pytest.mark.asyncio
async def test_eval_user_skipped_slot_omits_tool_call():
    ...


# ---------------------------------------------------------------------------
# AC-6: ``_BASE_PROMPT`` contains the multi-reference mandatory phrases
# (``set_slot_role`` AND one of ``sequenziell`` / ``ein Bild nach dem
# anderen``).
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-6: _BASE_PROMPT contains 'set_slot_role' and one of "
        "{'sequenziell','ein Bild nach dem anderen'}"
    )
)
def test_base_prompt_contains_multi_reference_phrases():
    ...


# ---------------------------------------------------------------------------
# AC-7: Aggregate gate — at least the three core eval-cases (AC-1, AC-4,
# AC-5) all pass.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-7: at least 3 multi-reference eval cases pass — done-signal gate"
    )
)
def test_eval_set_minimum_three_cases_pass():
    ...


# ---------------------------------------------------------------------------
# AC-8: ``set_slot_role`` is imported from Slice 23; mock ``tool_calls.args``
# conform to the imported Pydantic schema.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-8: mock tool_calls.args conform to the imported set_slot_role "
        "Pydantic schema (no re-implementation)"
    )
)
def test_mock_tool_call_args_conform_to_set_slot_role_schema():
    ...


# ---------------------------------------------------------------------------
# AC-9: Suite runs offline — no live LLM, no live FastAPI server, no DB
# connection; AsyncMock-driven only.
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "AC-9: eval suite runs without live LLM, server, or DB — "
        "only AsyncMock-driven"
    )
)
def test_eval_suite_runs_fully_mocked_offline():
    ...
