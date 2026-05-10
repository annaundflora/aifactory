"""Unit tests for `AssistantService.stream_response` project-context wiring
(Slice 11: System-Prompt-Komposition mit Project-Context).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-11-prompts-context-block.md.

Mocking Strategy: ``mock_external`` (as specified in the Slice-Spec
Test-Strategy):
- ``ProjectRepository.get_context`` is mocked via ``AsyncMock`` (no real
  Postgres connection in unit tests).
- ``create_agent`` is patched so we capture the LangGraph ``configurable``
  dict passed to ``astream_events`` without spinning up a real LLM.

Covered Acceptance Criteria:
- AC-8: ``stream_response`` calls ``ProjectRepository.get_context`` exactly
        once per turn and stamps the raw context value into
        ``configurable["project_context"]``.
- AC-9: When ``get_context`` returns ``(None, owner_id)``, ``configurable
        ["project_context"]`` is ``None`` (no fallback to empty string,
        no crash).
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Test helper: build an AssistantService with a fully captured agent and
# an injected mock ProjectRepository.
# ---------------------------------------------------------------------------


class _CapturedAgent:
    """A stand-in for the LangGraph compiled agent.

    ``astream_events`` records the ``config`` passed by the service so the
    test can assert on ``configurable["project_context"]`` after the fact.
    """

    def __init__(self):
        self.captured_configs = []
        self.captured_inputs = []

    def astream_events(self, input_state, config=None, version=None, **kwargs):
        self.captured_configs.append(config)
        self.captured_inputs.append(input_state)

        async def _empty_stream():
            # Yield nothing -- the service will then emit text-done.
            if False:  # pragma: no cover
                yield

        return _empty_stream()


def _make_service_with_mocks(get_context_return):
    """Build an ``AssistantService`` with a mocked agent + repo.

    Args:
        get_context_return: The tuple to return from ``project_repo.get_context``
            (e.g. ``("X", owner_id)`` or ``(None, owner_id)``).

    Returns:
        Tuple ``(service, captured_agent, project_repo_mock)``.
    """
    # Patch create_agent so AssistantService.__init__ does not spin up a real graph.
    with patch("app.services.assistant_service.create_agent") as mock_create:
        captured_agent = _CapturedAgent()
        mock_create.return_value = captured_agent

        # Also patch SessionRepository so __init__ does not need DB config.
        with patch("app.services.assistant_service.SessionRepository") as mock_sess_repo:
            mock_sess_repo.return_value = MagicMock()

            # Build a mock ProjectRepository whose get_context returns the
            # requested tuple.
            project_repo = MagicMock()
            project_repo.get_context = AsyncMock(return_value=get_context_return)

            from app.services.assistant_service import AssistantService

            service = AssistantService(project_repo=project_repo)

    # Re-assign the captured agent (inject in case __init__ overrode it).
    service._agent = captured_agent
    return service, captured_agent, project_repo


async def _drain(async_iter):
    """Consume an async iterator and return the collected events."""
    out = []
    async for ev in async_iter:
        out.append(ev)
    return out


# ===========================================================================
# AC-8: Service loads context and stamps it into configurable
# ===========================================================================


class TestAC8ContextLoadedAndForwarded:
    """AC-8: GIVEN a session whose ``project_id`` belongs to a project with
    ``context_instructions = "X"`` for the authenticated user,
    WHEN ``stream_response`` runs,
    THEN ``configurable["project_context"] == "X"`` (raw, NOT escaped) and
    ``ProjectRepository.get_context(project_id, user_id)`` is called
    exactly 1x.
    """

    @pytest.mark.asyncio
    async def test_stream_response_loads_context_and_passes_to_configurable(self):
        """AC-8: raw context value lands in configurable[project_context]."""
        owner_id = uuid4()
        project_id = uuid4()
        raw_context = "POD-Shop für Magic-Mushroom-Art"

        service, captured_agent, project_repo = _make_service_with_mocks(
            get_context_return=(raw_context, owner_id)
        )

        await _drain(
            service.stream_response(
                session_id="sess-123",
                content="hello",
                project_id=project_id,
                user_id=owner_id,
            )
        )

        # Exactly one config was captured (one astream_events call).
        assert len(captured_agent.captured_configs) == 1
        config = captured_agent.captured_configs[0]
        configurable = config.get("configurable", {})

        # The RAW (un-escaped) context value is present under the right key.
        assert "project_context" in configurable, (
            "configurable must carry the project_context key"
        )
        assert configurable["project_context"] == raw_context

    @pytest.mark.asyncio
    async def test_get_context_called_exactly_once_per_turn(self):
        """AC-8: ``ProjectRepository.get_context`` is called exactly 1x
        per ``stream_response`` invocation, with ``project_id`` + ``user_id``.
        """
        owner_id = uuid4()
        project_id = uuid4()

        service, _agent, project_repo = _make_service_with_mocks(
            get_context_return=("ctx", owner_id)
        )

        await _drain(
            service.stream_response(
                session_id="sess-once",
                content="hello",
                project_id=project_id,
                user_id=owner_id,
            )
        )

        assert project_repo.get_context.await_count == 1, (
            "ProjectRepository.get_context must be awaited exactly once "
            "per stream_response invocation"
        )

        # Args must be the (project_id, user_id) pair from the caller.
        call = project_repo.get_context.await_args
        # Allow either positional or keyword form.
        if call.args:
            assert call.args[0] == project_id
            assert call.args[1] == owner_id
        else:
            assert call.kwargs.get("project_id") == project_id
            assert call.kwargs.get("user_id") == owner_id

    @pytest.mark.asyncio
    async def test_context_value_in_configurable_is_not_escaped(self):
        """AC-8 (constraint cross-check): the value passed through
        ``configurable`` is the RAW DB value -- escape is the prompt-builder's
        job in ``prompts.py``, not the service's. A triple-backtick in the
        raw context must still be present in ``configurable``.
        """
        owner_id = uuid4()
        project_id = uuid4()
        # Raw context with characters the escape helper would touch -- those
        # characters must survive the service layer untouched.
        raw_context = "Brand uses ``` and <|tags|> in copy"

        service, captured_agent, _repo = _make_service_with_mocks(
            get_context_return=(raw_context, owner_id)
        )

        await _drain(
            service.stream_response(
                session_id="sess-raw",
                content="hello",
                project_id=project_id,
                user_id=owner_id,
            )
        )

        configurable = captured_agent.captured_configs[0].get("configurable", {})
        # RAW value preserved -- no escape applied at this layer.
        assert configurable["project_context"] == raw_context
        assert "```" in configurable["project_context"]
        assert "<|" in configurable["project_context"]


# ===========================================================================
# AC-9: None-context flows through unchanged (no fallback to empty string)
# ===========================================================================


class TestAC9NoneContextPassthrough:
    """AC-9: GIVEN ``ProjectRepository.get_context`` returns ``(None, owner_id)``
    (project exists but ``context_instructions IS NULL``),
    WHEN ``stream_response`` runs,
    THEN ``configurable["project_context"]`` is ``None`` (no crash, no
    fallback to empty string).
    """

    @pytest.mark.asyncio
    async def test_stream_response_passes_none_when_no_context_set(self):
        """AC-9: ``None`` propagates as ``None`` through configurable."""
        owner_id = uuid4()
        project_id = uuid4()

        service, captured_agent, _repo = _make_service_with_mocks(
            get_context_return=(None, owner_id)
        )

        events = await _drain(
            service.stream_response(
                session_id="sess-none",
                content="hello",
                project_id=project_id,
                user_id=owner_id,
            )
        )

        # No error event -- the None context must not crash anything.
        for ev in events:
            assert ev.get("event") != "error", (
                f"None context must not produce an error event, got: {ev}"
            )

        configurable = captured_agent.captured_configs[0].get("configurable", {})
        assert configurable["project_context"] is None, (
            "None from get_context must propagate as None (no empty-string "
            "fallback)"
        )
        # Defence: not coerced to empty string.
        assert configurable["project_context"] != ""

    @pytest.mark.asyncio
    async def test_stream_response_no_repo_call_when_project_id_missing(self):
        """AC-9 cross-check: when ``project_id`` is not provided, the service
        must NOT call ``get_context`` and must default ``configurable
        ["project_context"]`` to ``None`` (Slice-11 backward-compat path).
        """
        owner_id = uuid4()

        service, captured_agent, project_repo = _make_service_with_mocks(
            get_context_return=("never used", owner_id)
        )

        await _drain(
            service.stream_response(
                session_id="sess-noprj",
                content="hello",
                project_id=None,
                user_id=owner_id,
            )
        )

        # Repository must NOT have been called.
        project_repo.get_context.assert_not_awaited()

        configurable = captured_agent.captured_configs[0].get("configurable", {})
        # Key may be absent or set to None -- either way must not be a string.
        assert configurable.get("project_context") is None
