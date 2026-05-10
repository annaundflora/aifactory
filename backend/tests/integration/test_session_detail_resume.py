"""Integration tests for Slice 28: Session-Resume mit FSM-Hydrate.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-28-session-resume-flow-state.md.

Source ACs:
- AC-1: GET /api/assistant/sessions/{id} liefert flow_state + intent_axes
  + final_intent aus dem persistierten Checkpointer-State.
- AC-2: Pre-Slice-14-Checkpoint ohne FSM-Felder -> Defaults statt Error.

Mocking Strategy: ``mock_external`` (per Slice-Spec).

We exercise the full HTTP request/response cycle through the real FastAPI
application + real router + Pydantic validation. The LangGraph checkpointer
is REAL (MemorySaver) — only the LLM-bound agent is replaced by a minimal
StateGraph that exposes the same checkpointer API. This is the same
approach used by ``test_state_checkpoint_roundtrip.py`` (Slice 14):
MemorySaver shares the JsonPlusSerializer with PostgresSaver, so the
contract under test is identical.

The SessionRepository is mocked via the existing ``app.routes.sessions._repo``
patch path.
"""

import os
from datetime import datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

# Set test-only API keys BEFORE importing modules that may instantiate
# OpenAI clients at import time (e.g. ``app.routes.sessions`` imports
# ``AssistantService`` which calls ``create_agent`` -> ``ChatOpenAI``).
# The integration test never makes a real LLM call -- the agent is replaced
# with a minimal StateGraph in the ``patched_service`` fixture.
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENROUTER_API_KEY", "test-key-not-used")

from fastapi.testclient import TestClient  # noqa: E402
from langchain_core.messages import HumanMessage  # noqa: E402
from langgraph.checkpoint.memory import MemorySaver  # noqa: E402
from langgraph.graph import StateGraph  # noqa: E402

from app.agent.state import DEFAULT_STATE_VALUES, PromptAssistantState  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_session_dict(
    session_id=None,
    project_id=None,
    title=None,
    status="active",
    message_count=2,
    has_draft=True,
):
    """Build a session dict in the shape returned by the repository."""
    now = datetime.utcnow()
    return {
        "id": session_id or uuid4(),
        "project_id": project_id or uuid4(),
        "title": title,
        "status": status,
        "message_count": message_count,
        "has_draft": has_draft,
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }


def _build_minimal_graph(checkpointer):
    """Compile a no-op LangGraph against PromptAssistantState.

    Mirrors ``test_state_checkpoint_roundtrip.py``: a single passthrough node
    so the checkpointer round-trip works without an LLM. The compiled graph
    exposes ``aget_state`` + ``update_state`` exactly like ``create_agent``,
    so ``AssistantService.get_session_state`` works against it unchanged.
    """

    def _passthrough(state):
        return {}

    builder = StateGraph(PromptAssistantState)
    builder.add_node("passthrough", _passthrough)
    builder.set_entry_point("passthrough")
    builder.set_finish_point("passthrough")
    return builder.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def real_checkpointer_graph():
    """Provide a real MemorySaver + minimal LangGraph for FSM round-trip."""
    cp = MemorySaver()
    graph = _build_minimal_graph(cp)
    return graph, cp


@pytest.fixture()
def mock_repo():
    """Patch the module-level SessionRepository in routes.sessions."""
    with patch("app.routes.sessions._repo") as repo:
        repo.create = AsyncMock()
        repo.get_by_id = AsyncMock()
        repo.list_by_project = AsyncMock()
        repo.update = AsyncMock()
        repo.set_title = AsyncMock()
        yield repo


@pytest.fixture()
def patched_service(real_checkpointer_graph):
    """Replace the route's service with one whose ``_agent`` is our minimal
    graph + whose ``_repo`` is an AsyncMock.

    Returns ``(graph, real_service)`` so tests can seed the checkpointer
    via ``graph.update_state(...)`` and stub the repo via
    ``real_service._repo.get_by_id.return_value = ...``.
    """
    graph, _cp = real_checkpointer_graph

    from app.services.assistant_service import AssistantService

    real_service = AssistantService.__new__(AssistantService)
    real_service._agent = graph
    real_service._repo = AsyncMock()
    real_service._project_repo = AsyncMock()

    with patch("app.routes.sessions._service", real_service):
        yield graph, real_service


@pytest.fixture()
def client(mock_repo, patched_service):
    """Create a TestClient against the real FastAPI app."""
    from app.main import app

    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# AC-1: GET /sessions/{id} returns flow_state + intent_axes from checkpointer
# ---------------------------------------------------------------------------


class TestGetSessionReturnsFsmFields:
    """AC-1: GIVEN eine persistierte Session, deren LangGraph-Checkpointer-State
    ``flow_state="summarizing"``, ``intent_axes={...}`` und ``final_intent={...}``
    enthaelt
    WHEN der Client ``GET /api/assistant/sessions/{id}`` aufruft
    THEN ist die Response ``state.flow_state === "summarizing"``,
    ``state.intent_axes`` 1:1 das persistierte Dict, und ``final_intent`` ist
    ueber die Response erreichbar.
    """

    def test_get_session_returns_flow_state_summarizing_with_intent_axes(
        self, client, patched_service
    ):
        """AC-1: ``flow_state="summarizing"`` and ``intent_axes`` round-trip."""
        graph, real_service = patched_service

        session_id = uuid4()
        thread_id = str(session_id)

        intent_axes = {"subject": "moody library", "style": "dark academia"}
        final_intent = {
            "prompt": "moody library in dark academia style, photorealistic",
            "settings_diff": None,
            "model_id": None,
        }
        config = {"configurable": {"thread_id": thread_id}}
        graph.update_state(
            config,
            {
                **DEFAULT_STATE_VALUES,
                "messages": [HumanMessage(content="finalize")],
                "flow_state": "summarizing",
                "intent_axes": intent_axes,
                "final_intent": final_intent,
            },
        )

        session_dict = _make_session_dict(session_id=session_id)
        real_service._repo.get_by_id.return_value = session_dict

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200, response.text
        data = response.json()
        state = data["state"]
        assert state["flow_state"] == "summarizing", (
            f"Expected flow_state='summarizing', got {state['flow_state']!r}"
        )
        assert state["intent_axes"] == intent_axes, (
            f"Expected intent_axes={intent_axes}, got {state['intent_axes']}"
        )

    def test_get_session_exposes_final_intent_for_resume(
        self, client, patched_service
    ):
        """AC-1: ``final_intent`` is reachable via the response so the
        frontend can rebuild ``IntentSummaryPayload`` for ``RENDER_INTENT_SUMMARY``.
        """
        graph, real_service = patched_service

        session_id = uuid4()
        thread_id = str(session_id)

        final_intent = {
            "prompt": "A vibrant coral reef, photorealistic",
            "settings_diff": None,
            "model_id": "flux-2-pro",
        }
        config = {"configurable": {"thread_id": thread_id}}
        graph.update_state(
            config,
            {
                **DEFAULT_STATE_VALUES,
                "messages": [HumanMessage(content="finalize")],
                "flow_state": "summarizing",
                "intent_axes": {"subject": "coral reef"},
                "final_intent": final_intent,
            },
        )

        session_dict = _make_session_dict(session_id=session_id)
        real_service._repo.get_by_id.return_value = session_dict

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200, response.text
        state = response.json()["state"]
        assert "final_intent" in state, (
            f"Response state must surface 'final_intent' for resume; "
            f"got keys={list(state.keys())}"
        )
        fi = state["final_intent"]
        assert fi is not None, "final_intent must not be None for AC-1"
        assert fi["prompt"] == final_intent["prompt"], (
            f"final_intent.prompt must round-trip verbatim, "
            f"got {fi['prompt']!r}"
        )

    def test_get_session_returns_final_intent_with_settings_diff(
        self, client, patched_service
    ):
        """AC-1 extended: when ``settings_diff`` is populated, it propagates
        through the response so the frontend can mirror it into
        ``IntentSummaryPayload.settings_diff``.
        """
        graph, real_service = patched_service

        session_id = uuid4()
        thread_id = str(session_id)

        settings_diff = {
            "slotStrengths": [
                {"slotIndex": 0, "from": None, "to": 0.6},
            ],
        }
        final_intent = {
            "prompt": "A photorealistic cat",
            "settings_diff": settings_diff,
            "model_id": "flux-2-pro",
        }
        config = {"configurable": {"thread_id": thread_id}}
        graph.update_state(
            config,
            {
                **DEFAULT_STATE_VALUES,
                "messages": [HumanMessage(content="finalize")],
                "flow_state": "summarizing",
                "intent_axes": {"subject": "cat"},
                "final_intent": final_intent,
            },
        )

        session_dict = _make_session_dict(session_id=session_id)
        real_service._repo.get_by_id.return_value = session_dict

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200, response.text
        state = response.json()["state"]
        assert state["final_intent"] is not None
        diff = state["final_intent"].get("settings_diff")
        assert diff is not None, (
            "final_intent.settings_diff must be present when populated"
        )
        assert "slotStrengths" in diff, (
            f"settings_diff must contain 'slotStrengths' alias, got {diff}"
        )


# ---------------------------------------------------------------------------
# AC-2: Legacy checkpoint -> Defaults, no error
# ---------------------------------------------------------------------------


class TestGetSessionLegacyCheckpointDefaults:
    """AC-2: GIVEN eine aeltere persistierte Session ohne ``flow_state``/
    ``intent_axes``/``final_intent``
    WHEN ``GET /api/assistant/sessions/{id}`` aufgerufen wird
    THEN liefert das Backend ``state.flow_state === "idle"`` und
    ``state.intent_axes === {}`` (Defaults aus DEFAULT_STATE_VALUES); kein
    500-Error, keine ValidationError; bestehende Felder bleiben unveraendert.
    """

    def test_get_session_returns_defaults_for_legacy_checkpoint(
        self, client, patched_service
    ):
        """AC-2: Pre-Slice-14 checkpoint without FSM keys must yield defaults."""
        graph, real_service = patched_service

        session_id = uuid4()
        thread_id = str(session_id)

        # Simulate a pre-Slice-14 checkpoint via direct write — only the
        # legacy fields, without flow_state / intent_axes / final_intent.
        config = {"configurable": {"thread_id": thread_id}}
        graph.update_state(
            config,
            {
                "messages": [HumanMessage(content="hi")],
                "draft_prompt": None,
                "reference_images": [],
                "recommended_model": None,
                "collected_info": {},
                "phase": "understand",
            },
        )

        session_dict = _make_session_dict(session_id=session_id)
        real_service._repo.get_by_id.return_value = session_dict

        response = client.get(f"/api/assistant/sessions/{session_id}")

        # AC-2: NO 500/422
        assert response.status_code == 200, (
            f"Legacy checkpoint must NOT raise — got {response.status_code}; "
            f"body={response.text}"
        )

        data = response.json()
        state = data["state"]

        assert state["flow_state"] == "idle", (
            f"Legacy checkpoint must default flow_state to 'idle', "
            f"got {state['flow_state']!r}"
        )
        assert state["intent_axes"] == {}, (
            f"Legacy checkpoint must default intent_axes to {{}}, "
            f"got {state['intent_axes']!r}"
        )
        assert state.get("final_intent") is None, (
            f"Legacy checkpoint must default final_intent to None, "
            f"got {state.get('final_intent')!r}"
        )

    def test_get_session_legacy_preserves_existing_fields(
        self, client, patched_service
    ):
        """AC-2: ``messages``, ``draft_prompt``, ``recommended_model`` remain
        unchanged for a legacy checkpoint.
        """
        graph, real_service = patched_service

        session_id = uuid4()
        thread_id = str(session_id)

        legacy_messages = [HumanMessage(content="legacy hello")]
        config = {"configurable": {"thread_id": thread_id}}
        graph.update_state(
            config,
            {
                "messages": legacy_messages,
                "draft_prompt": {"prompt": "old draft"},
                "reference_images": [],
                "recommended_model": {
                    "id": "flux-1",
                    "name": "Flux 1",
                    "reason": "legacy reason",
                },
                "collected_info": {},
                "phase": "understand",
            },
        )

        session_dict = _make_session_dict(session_id=session_id)
        real_service._repo.get_by_id.return_value = session_dict

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200, response.text
        state = response.json()["state"]
        assert isinstance(state["messages"], list)
        assert any(
            m.get("content") == "legacy hello" for m in state["messages"]
        ), f"Legacy messages must round-trip; got {state['messages']!r}"
        assert state["draft_prompt"] == {"prompt": "old draft"}
        assert state["recommended_model"]["id"] == "flux-1"

    def test_get_session_legacy_no_validation_error(
        self, client, patched_service
    ):
        """AC-2: Even when the persisted state has ``None`` for missing FSM
        keys (instead of being absent), the response is well-formed.
        """
        graph, real_service = patched_service

        session_id = uuid4()
        thread_id = str(session_id)

        config = {"configurable": {"thread_id": thread_id}}
        graph.update_state(
            config,
            {
                "messages": [HumanMessage(content="hi")],
                "draft_prompt": None,
                "reference_images": [],
                "recommended_model": None,
                "collected_info": {},
                "phase": "understand",
                "final_intent": None,
            },
        )

        session_dict = _make_session_dict(session_id=session_id)
        real_service._repo.get_by_id.return_value = session_dict

        response = client.get(f"/api/assistant/sessions/{session_id}")
        assert response.status_code == 200, response.text
        state = response.json()["state"]
        assert state["flow_state"] == "idle"
        assert state["intent_axes"] == {}
        assert state.get("final_intent") is None
