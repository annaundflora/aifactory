"""Unit tests for Slice 15: SSE-Events ``flow-state`` + ``intent-summary``.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-15-sse-flow-state-events.md.

Mocking Strategy: ``mock_external`` (per Slice-Spec Test-Strategy):
- The compiled LangGraph agent (``self._agent``) is replaced by a
  ``_FakeAgent`` whose ``astream_events`` yields a deterministic sequence
  of LangGraph events (``on_tool_end``, ``on_chain_end``) that the service
  must convert into SSE events.
- ``ProjectRepository`` and ``SessionRepository`` are mocked so the
  service ``__init__`` does not require a real DB.
- No real LLM, no real DB, no real network involved.

Source ACs covered in this file:
- AC-1: ``flow-state`` event on FSM transition (idle -> interviewing) +
  dedup against repeated values.
- AC-2: ``tool-call-result`` -> ``intent-summary`` ordering on
  ``emit_intent_summary``.
- AC-3: ``settings_diff`` omitted vs. populated.
- AC-4: axis > 200 chars yields ``error`` SSE event, no ``intent-summary``.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Fake LangGraph agent harness
# ---------------------------------------------------------------------------


class _FakeStateSnapshot:
    """Minimal ``aget_state`` return value with ``.values`` dict."""

    def __init__(self, values: dict | None = None):
        self.values = values or {}


class _FakeAgent:
    """A stand-in for the LangGraph compiled agent.

    ``astream_events`` yields a configurable sequence of events; ``aget_state``
    returns a ``_FakeStateSnapshot`` so the service can read ``intent_axes``.
    """

    def __init__(self, events: list[dict], state_values: dict | None = None):
        self._events = events
        self._state_values = state_values or {}
        self.captured_configs: list[dict] = []

    def astream_events(self, input_state, config=None, version=None, **kwargs):
        self.captured_configs.append(config)
        events = list(self._events)

        async def _gen():
            for ev in events:
                yield ev

        return _gen()

    async def aget_state(self, config):
        return _FakeStateSnapshot(self._state_values)


def _make_service(events: list[dict], state_values: dict | None = None):
    """Build an ``AssistantService`` whose internal agent is a ``_FakeAgent``.

    Returns the service and the fake agent (so tests can inspect captured
    configs after the run).
    """
    with patch("app.services.assistant_service.create_agent") as mock_create:
        fake_agent = _FakeAgent(events, state_values=state_values)
        mock_create.return_value = fake_agent

        with patch("app.services.assistant_service.SessionRepository") as mock_sess:
            mock_sess.return_value = MagicMock()
            project_repo = MagicMock()
            project_repo.get_context = AsyncMock(return_value=(None, None))

            from app.services.assistant_service import AssistantService

            service = AssistantService(project_repo=project_repo)

    # Override the agent in case __init__ created a different one before
    # ``mock_create`` was effective (it should be, but be defensive).
    service._agent = fake_agent
    return service, fake_agent


async def _drain(async_iter):
    """Consume an async iterator and return the collected events."""
    out = []
    async for ev in async_iter:
        out.append(ev)
    return out


def _make_tool_message(content_dict: dict, name: str = "emit_intent_summary"):
    """Build a tool output message (mimics LangGraph ToolMessage)."""
    return SimpleNamespace(content=json.dumps(content_dict), name=name)


# ---------------------------------------------------------------------------
# AC-1: flow-state event on FSM transition
# ---------------------------------------------------------------------------


class TestAC1FlowStateEvent:
    """AC-1: GIVEN ``AssistantService.stream_response`` runs with a session
    whose LangGraph state ``flow_state`` transitions from ``"idle"`` to
    ``"interviewing"`` WHEN the SSE stream is consumed THEN exactly one SSE
    event with ``event: flow-state`` and ``data: {"flow_state": "interviewing"}``
    is emitted; repeats for the same value are suppressed.
    """

    @pytest.mark.asyncio
    async def test_flow_state_event_emitted_on_idle_to_interviewing_transition(
        self,
    ):
        """AC-1: A single ``flow-state`` event MUST be emitted when the
        ``post_process``/``assistant`` node returns a new ``flow_state`` value.
        """
        events = [
            {
                "event": "on_chain_end",
                "name": "assistant",
                "data": {"output": {"flow_state": "interviewing"}},
            },
        ]
        service, _agent = _make_service(events)

        out = await _drain(service.stream_response(
            session_id="sess-ac1-1",
            content="Hello",
        ))

        flow_events = [e for e in out if e.get("event") == "flow-state"]
        assert len(flow_events) == 1, (
            f"Exactly one flow-state event expected, got {len(flow_events)}: {out}"
        )
        payload = json.loads(flow_events[0]["data"])
        assert payload == {"flow_state": "interviewing"}

    @pytest.mark.asyncio
    async def test_flow_state_event_not_re_emitted_for_same_value(self):
        """AC-1: When the same ``flow_state`` value is observed twice in a
        row, only the FIRST emit is yielded (dedup against last sent value).
        """
        events = [
            {
                "event": "on_chain_end",
                "name": "assistant",
                "data": {"output": {"flow_state": "interviewing"}},
            },
            {
                "event": "on_chain_end",
                "name": "assistant",
                "data": {"output": {"flow_state": "interviewing"}},
            },
            {
                "event": "on_chain_end",
                "name": "post_process",
                "data": {"output": {"flow_state": "interviewing"}},
            },
        ]
        service, _agent = _make_service(events)

        out = await _drain(service.stream_response(
            session_id="sess-ac1-2",
            content="Hello",
        ))

        flow_events = [e for e in out if e.get("event") == "flow-state"]
        assert len(flow_events) == 1, (
            f"Repeated identical flow_state values must dedup; got "
            f"{len(flow_events)} flow-state events: {flow_events}"
        )

    @pytest.mark.asyncio
    async def test_flow_state_event_emitted_for_each_distinct_transition(self):
        """AC-1: Distinct subsequent values MUST each emit one event."""
        events = [
            {
                "event": "on_chain_end",
                "name": "assistant",
                "data": {"output": {"flow_state": "interviewing"}},
            },
            {
                "event": "on_chain_end",
                "name": "post_process",
                "data": {"output": {"flow_state": "summarizing"}},
            },
        ]
        service, _agent = _make_service(events)

        out = await _drain(service.stream_response(
            session_id="sess-ac1-3",
            content="Hello",
        ))

        flow_events = [e for e in out if e.get("event") == "flow-state"]
        assert len(flow_events) == 2
        payloads = [json.loads(e["data"]) for e in flow_events]
        assert payloads[0]["flow_state"] == "interviewing"
        assert payloads[1]["flow_state"] == "summarizing"

    @pytest.mark.asyncio
    async def test_flow_state_event_not_emitted_for_non_whitelisted_value(self):
        """AC-1 / AC-9 (backend echo): a graph node that returns a value
        outside the architectural whitelist (e.g. ``"unknown_phase"``) must
        NOT produce a wire event."""
        events = [
            {
                "event": "on_chain_end",
                "name": "assistant",
                "data": {"output": {"flow_state": "unknown_phase"}},
            },
        ]
        service, _agent = _make_service(events)

        out = await _drain(service.stream_response(
            session_id="sess-ac1-4",
            content="Hello",
        ))

        flow_events = [e for e in out if e.get("event") == "flow-state"]
        assert flow_events == [], (
            f"Non-whitelisted flow_state values MUST be filtered, got "
            f"{flow_events}"
        )


# ---------------------------------------------------------------------------
# AC-2: tool-call-result -> intent-summary ordering on emit_intent_summary
# ---------------------------------------------------------------------------


class TestAC2EmitIntentSummaryOrdering:
    """AC-2: GIVEN the LangGraph run calls ``emit_intent_summary`` with a valid
    payload WHEN the tool-result branch is processed THEN exactly three SSE
    events are emitted in this order: ``tool-call-result`` (existing),
    ``intent-summary`` (NEW), ``flow-state`` (NEW with
    ``flow_state="summarizing"``).
    """

    @pytest.mark.asyncio
    async def test_emit_intent_summary_produces_three_events_in_order(self):
        """AC-2: the wire ordering MUST be tool-call-result, intent-summary,
        flow-state."""
        prompt_value = "A vibrant coral reef at golden hour, photorealistic"
        events = [
            {
                "event": "on_tool_end",
                "name": "emit_intent_summary",
                "data": {
                    "input": {
                        "input": {
                            "prompt": prompt_value,
                            "settings_diff": None,
                            "model_id": None,
                        }
                    },
                    "output": _make_tool_message(
                        {
                            "prompt": prompt_value,
                            "settings_diff": None,
                            "model_id": None,
                        }
                    ),
                },
            },
            {
                "event": "on_chain_end",
                "name": "post_process",
                "data": {"output": {"flow_state": "summarizing"}},
            },
        ]
        service, _agent = _make_service(
            events,
            state_values={
                "intent_axes": {
                    "subject": "coral reef",
                    "lighting": "golden hour",
                }
            },
        )

        out = await _drain(service.stream_response(
            session_id="sess-ac2-1",
            content="Wrap up the intent",
        ))

        # Filter to the three event types we care about, preserving order.
        relevant = [
            e for e in out
            if e.get("event") in {"tool-call-result", "intent-summary", "flow-state"}
        ]
        # We expect at least these three events; index them by position.
        kinds = [e["event"] for e in relevant]
        assert kinds[:3] == [
            "tool-call-result",
            "intent-summary",
            "flow-state",
        ], (
            f"AC-2 ordering violated; got: {kinds!r}; full out: {out!r}"
        )

        # Validate tool-call-result has the right tool name
        tool_data = json.loads(relevant[0]["data"])
        assert tool_data["tool"] == "emit_intent_summary"

        # Validate intent-summary payload structure
        summary_data = json.loads(relevant[1]["data"])
        assert "axes" in summary_data
        assert summary_data["prompt_preview"] == prompt_value
        assert summary_data["axes"].get("subject") == "coral reef"
        assert summary_data["axes"].get("lighting") == "golden hour"

        # Validate flow-state payload
        flow_data = json.loads(relevant[2]["data"])
        assert flow_data == {"flow_state": "summarizing"}


# ---------------------------------------------------------------------------
# AC-3: settings_diff omitted when empty / present when populated
# ---------------------------------------------------------------------------


class TestAC3SettingsDiffOmissionAndPassthrough:
    """AC-3: GIVEN the ``intent-summary`` payload is built WHEN ``settings_diff``
    is missing or empty THEN the field is omitted from the JSON (NOT sent as
    ``null``); WHEN ``settings_diff`` contains entries THEN it is passed
    through 1:1 as the ``SettingsDiff`` schema.
    """

    @pytest.mark.asyncio
    async def test_intent_summary_omits_settings_diff_when_none(self):
        """AC-3: ``settings_diff`` MUST be absent from the wire JSON when the
        tool argument is ``None``."""
        events = [
            {
                "event": "on_tool_end",
                "name": "emit_intent_summary",
                "data": {
                    "input": {
                        "input": {
                            "prompt": "a serene mountain lake at dawn",
                            "settings_diff": None,
                            "model_id": None,
                        }
                    },
                    "output": _make_tool_message(
                        {
                            "prompt": "a serene mountain lake at dawn",
                            "settings_diff": None,
                            "model_id": None,
                        }
                    ),
                },
            },
        ]
        service, _agent = _make_service(events, state_values={"intent_axes": {}})

        out = await _drain(service.stream_response(
            session_id="sess-ac3-1",
            content="finish",
        ))

        summary = next(e for e in out if e["event"] == "intent-summary")
        data = json.loads(summary["data"])
        assert "settings_diff" not in data, (
            f"settings_diff MUST be omitted (not null) when empty, got "
            f"data={data!r}"
        )
        # Sanity: must NOT be present as null literal in the raw JSON either.
        assert '"settings_diff":null' not in summary["data"]
        assert '"settings_diff": null' not in summary["data"]

    @pytest.mark.asyncio
    async def test_intent_summary_includes_settings_diff_when_populated(self):
        """AC-3: A populated ``settings_diff`` MUST appear 1:1 in the JSON."""
        diff_input = {
            "slotStrengths": [
                {"slotIndex": 0, "from": None, "to": 0.6},
            ],
            "modelId": {"from": "flux-2-pro", "to": "flux-2-ultra"},
        }
        events = [
            {
                "event": "on_tool_end",
                "name": "emit_intent_summary",
                "data": {
                    "input": {
                        "input": {
                            "prompt": "a sunset over the alps",
                            "settings_diff": diff_input,
                            "model_id": None,
                        }
                    },
                    "output": _make_tool_message(
                        {
                            "prompt": "a sunset over the alps",
                            "settings_diff": diff_input,
                            "model_id": None,
                        }
                    ),
                },
            },
        ]
        service, _agent = _make_service(events, state_values={"intent_axes": {}})

        out = await _drain(service.stream_response(
            session_id="sess-ac3-2",
            content="finish",
        ))

        summary = next(e for e in out if e["event"] == "intent-summary")
        data = json.loads(summary["data"])
        assert "settings_diff" in data
        # The slotStrengths list must round-trip; ``from`` may be omitted
        # when ``None`` (Pydantic ``exclude_none=True`` on the wire dump).
        assert isinstance(data["settings_diff"]["slotStrengths"], list)
        assert len(data["settings_diff"]["slotStrengths"]) == 1
        slot_entry = data["settings_diff"]["slotStrengths"][0]
        assert slot_entry["slotIndex"] == 0
        assert slot_entry["to"] == 0.6
        # Either ``from`` is absent (exclude_none) or explicitly None — both
        # are wire-compatible with the ``SettingsDiff`` schema.
        assert slot_entry.get("from", None) is None
        assert data["settings_diff"]["modelId"] == {
            "from": "flux-2-pro",
            "to": "flux-2-ultra",
        }


# ---------------------------------------------------------------------------
# AC-4: axis > 200 chars yields error SSE event, no intent-summary
# ---------------------------------------------------------------------------


class TestAC4AxisTooLongProducesErrorEvent:
    """AC-4: GIVEN ``axes`` contains a string > 200 characters WHEN the
    payload is built THEN a Pydantic ``ValidationError`` is raised, the
    service emits an ``error`` SSE event, and NO ``intent-summary`` event
    is sent on the wire.
    """

    @pytest.mark.asyncio
    async def test_axis_too_long_produces_error_event_not_intent_summary(self):
        """AC-4: Backend MUST replace intent-summary with an error event when
        an axis exceeds the 200-char cap."""
        too_long = "x" * 201  # exactly one over the limit
        events = [
            {
                "event": "on_tool_end",
                "name": "emit_intent_summary",
                "data": {
                    "input": {
                        "input": {
                            "prompt": "a forest at sunrise",
                            "settings_diff": None,
                            "model_id": None,
                        }
                    },
                    "output": _make_tool_message(
                        {
                            "prompt": "a forest at sunrise",
                            "settings_diff": None,
                            "model_id": None,
                        }
                    ),
                },
            },
        ]
        service, _agent = _make_service(
            events,
            state_values={"intent_axes": {"subject": too_long}},
        )

        out = await _drain(service.stream_response(
            session_id="sess-ac4-1",
            content="finalize",
        ))

        # No intent-summary event MUST be present.
        intent_events = [e for e in out if e.get("event") == "intent-summary"]
        assert intent_events == [], (
            f"intent-summary MUST be suppressed when axis exceeds 200 chars; "
            f"got {intent_events!r}"
        )

        # An error event MUST have been emitted instead.
        error_events = [e for e in out if e.get("event") == "error"]
        assert len(error_events) >= 1, (
            f"Expected at least one error event; got events: {out!r}"
        )

    @pytest.mark.asyncio
    async def test_axis_at_or_below_200_chars_succeeds(self):
        """AC-4 boundary: axis with exactly 200 chars MUST validate."""
        boundary = "x" * 200
        events = [
            {
                "event": "on_tool_end",
                "name": "emit_intent_summary",
                "data": {
                    "input": {
                        "input": {
                            "prompt": "a forest at sunrise",
                            "settings_diff": None,
                            "model_id": None,
                        }
                    },
                    "output": _make_tool_message(
                        {
                            "prompt": "a forest at sunrise",
                            "settings_diff": None,
                            "model_id": None,
                        }
                    ),
                },
            },
        ]
        service, _agent = _make_service(
            events,
            state_values={"intent_axes": {"subject": boundary}},
        )

        out = await _drain(service.stream_response(
            session_id="sess-ac4-2",
            content="finalize",
        ))

        intent_events = [e for e in out if e.get("event") == "intent-summary"]
        assert len(intent_events) == 1, (
            f"axis at exactly 200 chars MUST be accepted; got {intent_events!r}"
        )
        data = json.loads(intent_events[0]["data"])
        assert data["axes"]["subject"] == boundary


# ---------------------------------------------------------------------------
# Adversarial: malformed/missing tool input
# ---------------------------------------------------------------------------


class TestAdversarialMalformedToolInput:
    """Adversarial tests for the ``intent-summary`` builder: tool calls with
    missing/non-dict input MUST NOT crash the stream and MUST NOT produce a
    malformed ``intent-summary`` event."""

    @pytest.mark.asyncio
    async def test_missing_prompt_argument_does_not_emit_intent_summary(self):
        """When the ``emit_intent_summary`` invocation lacks a ``prompt``
        key, the service MUST NOT emit a malformed ``intent-summary`` (it
        either suppresses the event or emits an error event). Either way,
        no intent-summary with an empty/missing ``prompt_preview`` reaches
        the wire."""
        events = [
            {
                "event": "on_tool_end",
                "name": "emit_intent_summary",
                "data": {
                    "input": {
                        "input": {
                            # prompt missing on purpose
                            "settings_diff": None,
                            "model_id": None,
                        }
                    },
                    "output": _make_tool_message(
                        {"settings_diff": None, "model_id": None}
                    ),
                },
            },
        ]
        service, _agent = _make_service(events, state_values={"intent_axes": {}})

        out = await _drain(service.stream_response(
            session_id="sess-adv-1",
            content="finalize",
        ))

        intent_events = [e for e in out if e.get("event") == "intent-summary"]
        # Either no intent-summary at all, or every emitted event has a
        # non-empty prompt_preview.
        for ev in intent_events:
            data = json.loads(ev["data"])
            assert data.get("prompt_preview"), (
                f"intent-summary MUST NOT be emitted with empty/missing "
                f"prompt_preview; got {data!r}"
            )
