"""Unit tests for `_call_model_sync` / `_call_model_async` project-context
forwarding (Slice 11: System-Prompt-Komposition mit Project-Context).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-11-prompts-context-block.md.

Mocking Strategy: ``mock_external`` (as specified in the Slice-Spec
Test-Strategy):
- ``build_assistant_system_prompt`` is patched so we capture the third
  argument (the ``project_context`` value) without paying for a real LLM
  call.
- ``ChatOpenAI`` (and the LLM ``invoke`` / ``ainvoke``) is patched to a
  predictable response.

Covered Acceptance Criteria:
- AC-10: Both sync and async LangGraph nodes forward
         ``configurable["project_context"]`` as the third positional argument
         to ``build_assistant_system_prompt`` -- no drift between paths.
- AC-11: When the ``project_context`` key is missing in ``configurable``,
         both nodes default to ``None`` and do NOT raise ``KeyError``.
"""

from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_agent_with_captured_prompt():
    """Build a LangGraph agent whose system-prompt builder is captured.

    Patches ``build_assistant_system_prompt`` (in ``app.agent.graph``) and
    the underlying LLM constructor so the agent can be created without
    talking to OpenRouter.

    Returns:
        Tuple ``(agent, captured_calls, fake_llm)`` where ``captured_calls``
        is a list of tuples ``(image_model_id, generation_mode, project_context)``
        appended every time the patched builder is invoked.
    """
    captured_calls: list[tuple] = []

    def fake_build_prompt(image_model_id=None, generation_mode=None, project_context=None):
        captured_calls.append((image_model_id, generation_mode, project_context))
        return "FAKE_SYSTEM_PROMPT"

    # Build a fake LLM with both .invoke (sync) and .ainvoke (async).
    fake_llm = MagicMock()
    fake_llm.invoke = MagicMock(return_value=AIMessage(content="ok"))

    async def _ainvoke(messages):
        return AIMessage(content="ok")

    fake_llm.ainvoke = _ainvoke
    fake_llm.bind_tools = MagicMock(return_value=fake_llm)

    return fake_build_prompt, captured_calls, fake_llm


def _extract_node_callables(monkeypatch):
    """Patch dependencies and return ``(sync_fn, async_fn, captured_calls)``
    for the inner ``_call_model_sync`` / ``_call_model_async`` closures in
    ``create_agent``.

    We re-implement the closure here because the originals are defined inside
    ``create_agent`` and there is no public handle. The contract is:

        configurable = config.get("configurable", {})
        image_model_id = configurable.get("image_model_id")
        generation_mode = configurable.get("generation_mode")
        project_context = configurable.get("project_context")
        prompt = build_assistant_system_prompt(
            image_model_id, generation_mode, project_context
        )

    To avoid duplicating logic in the test, we use ``inspect.getsource`` plus
    direct invocation against the module's actual builder via monkeypatch and
    re-create the agent in a way that we can call the assistant node.
    """
    fake_build_prompt, captured_calls, fake_llm = _build_agent_with_captured_prompt()

    import app.agent.graph as graph_module

    monkeypatch.setattr(graph_module, "build_assistant_system_prompt", fake_build_prompt)
    monkeypatch.setattr(graph_module, "ChatOpenAI", MagicMock(return_value=fake_llm))

    # Build the agent. The compiled graph exposes the inner nodes via
    # `nodes`, but the safer, framework-stable path is to invoke the graph
    # itself with a known config and inspect the captured builder calls.
    agent = graph_module.create_agent()
    return agent, captured_calls


# ===========================================================================
# AC-10: Sync + Async path both forward configurable[project_context]
# ===========================================================================


class TestAC10ForwardProjectContext:
    """AC-10: GIVEN a ``RunnableConfig`` with
    ``configurable["project_context"] = "Mein Brand"``,
    WHEN the assistant node builds the system prompt,
    THEN ``build_assistant_system_prompt`` is invoked with
    ``project_context="Mein Brand"`` -- and the same call is made by both
    the sync and the async node (no drift).
    """

    def test_call_model_sync_forwards_project_context(self, monkeypatch):
        """AC-10 (sync path): builder called with project_context='Mein Brand'."""
        agent, captured_calls = _extract_node_callables(monkeypatch)

        # Use the sync invocation path (.invoke) -- LangGraph picks the
        # sync RunnableLambda.func when the outer call is sync.
        agent.invoke(
            {"messages": [HumanMessage(content="hello")]},
            config={
                "configurable": {
                    "thread_id": "t-sync",
                    "image_model_id": "flux-2-pro",
                    "generation_mode": "txt2img",
                    "project_context": "Mein Brand",
                }
            },
        )

        # The builder must have been called at least once with our value.
        assert any(
            call[2] == "Mein Brand" for call in captured_calls
        ), (
            f"Sync node did not forward project_context='Mein Brand'. "
            f"Captured calls: {captured_calls}"
        )
        # Also: the third arg pairs with the right model_id and mode.
        for image_model_id, generation_mode, project_context in captured_calls:
            if project_context == "Mein Brand":
                assert image_model_id == "flux-2-pro"
                assert generation_mode == "txt2img"
                break

    @pytest.mark.asyncio
    async def test_call_model_async_forwards_project_context(self, monkeypatch):
        """AC-10 (async path): builder called with project_context='Mein Brand'."""
        agent, captured_calls = _extract_node_callables(monkeypatch)

        # Use the async invocation path (.ainvoke) -- LangGraph picks the
        # async RunnableLambda.afunc when the outer call is awaited.
        await agent.ainvoke(
            {"messages": [HumanMessage(content="hello")]},
            config={
                "configurable": {
                    "thread_id": "t-async",
                    "image_model_id": "flux-2-pro",
                    "generation_mode": "txt2img",
                    "project_context": "Mein Brand",
                }
            },
        )

        assert any(
            call[2] == "Mein Brand" for call in captured_calls
        ), (
            f"Async node did not forward project_context='Mein Brand'. "
            f"Captured calls: {captured_calls}"
        )

    def test_sync_and_async_use_same_call_signature(self):
        """AC-10 (no drift): static source check -- both sync and async use
        the same builder-invocation pattern, so future changes cannot drift
        between the two paths.
        """
        import inspect
        import re

        import app.agent.graph as graph_module

        source = inspect.getsource(graph_module.create_agent)

        # Both nodes must read project_context from configurable -- this is
        # the cheapest cross-check that the wiring is symmetric (sync + async).
        get_count = source.count('configurable.get("project_context")')
        assert get_count >= 2, (
            f"Both sync and async nodes must read project_context from "
            f"configurable.get(...) -- expected >= 2 occurrences, got "
            f"{get_count}."
        )

        # And both nodes must call build_assistant_system_prompt with
        # project_context being part of the call. We tolerate any whitespace
        # / line break inside the parentheses, plus either positional or
        # keyword form.
        builder_call_pattern = re.compile(
            r"build_assistant_system_prompt\([^)]*project_context[^)]*\)",
            re.DOTALL,
        )
        builder_calls = builder_call_pattern.findall(source)
        assert len(builder_calls) >= 2, (
            f"Both sync and async nodes must call "
            f"build_assistant_system_prompt(..., project_context=...) -- "
            f"expected >= 2 occurrences, got {len(builder_calls)}: "
            f"{builder_calls}"
        )


# ===========================================================================
# AC-11: Missing project_context key -> None, no KeyError
# ===========================================================================


class TestAC11MissingKeyDefaultsToNone:
    """AC-11: GIVEN a ``RunnableConfig`` whose ``configurable`` does NOT have
    a ``project_context`` key (backward-compat path -- old sessions, old
    tests),
    WHEN the assistant node runs,
    THEN ``configurable.get("project_context")`` -> ``None``,
    ``build_assistant_system_prompt`` is called with
    ``project_context=None`` and NO ``KeyError`` is raised.
    """

    def test_call_model_defaults_to_none_when_key_missing_sync(self, monkeypatch):
        """AC-11 (sync): missing key -> builder called with None."""
        agent, captured_calls = _extract_node_callables(monkeypatch)

        # NO project_context in configurable.
        agent.invoke(
            {"messages": [HumanMessage(content="hi")]},
            config={
                "configurable": {
                    "thread_id": "t-no-ctx",
                }
            },
        )

        # Builder must have been called -- with None as the third arg.
        assert captured_calls, "Builder was not called at all"
        assert all(
            call[2] is None for call in captured_calls
        ), (
            f"Missing project_context key must default to None. "
            f"Captured calls: {captured_calls}"
        )

    @pytest.mark.asyncio
    async def test_call_model_defaults_to_none_when_key_missing_async(
        self, monkeypatch
    ):
        """AC-11 (async): missing key -> builder called with None."""
        agent, captured_calls = _extract_node_callables(monkeypatch)

        await agent.ainvoke(
            {"messages": [HumanMessage(content="hi")]},
            config={
                "configurable": {
                    "thread_id": "t-no-ctx-async",
                }
            },
        )

        assert captured_calls, "Builder was not called at all"
        assert all(
            call[2] is None for call in captured_calls
        ), (
            f"Missing project_context key (async) must default to None. "
            f"Captured calls: {captured_calls}"
        )

    def test_no_keyerror_raised_when_configurable_empty(self, monkeypatch):
        """AC-11 (defensive): an empty configurable dict must not raise
        ``KeyError`` (the implementation must use ``.get("project_context")``).
        """
        agent, _captured = _extract_node_callables(monkeypatch)

        # An invocation with effectively empty configurable should complete
        # without raising KeyError.
        try:
            agent.invoke(
                {"messages": [HumanMessage(content="hi")]},
                config={"configurable": {"thread_id": "t-empty"}},
            )
        except KeyError as exc:
            pytest.fail(
                f"Empty configurable raised KeyError -- the implementation "
                f"must use .get() with default None. Error: {exc}"
            )
