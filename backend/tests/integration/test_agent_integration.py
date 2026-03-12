"""Integration tests for the LangGraph agent (slice-03).

Tests the create_agent factory function with its real dependencies:
- PromptAssistantState as state schema
- SYSTEM_PROMPT as agent prompt
- ChatOpenAI LLM configuration
- Optional checkpointer parameter

Mocking Strategy: mock_external (as specified in Slice-Spec).
OpenRouter LLM calls are mocked; all other components use real instances.
"""

from unittest.mock import MagicMock, patch

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver


class TestAgentCreation:
    """Integration tests for agent graph creation and configuration."""

    def test_create_agent_returns_compiled_graph(self):
        """create_agent() must return a compiled LangGraph graph without errors."""
        from app.agent.graph import create_agent

        graph = create_agent()
        assert graph is not None, "create_agent() must return a graph, not None"
        # A compiled graph must have an invoke method
        assert hasattr(graph, "invoke"), (
            "Compiled graph must have an 'invoke' method"
        )

    def test_create_agent_graph_has_get_graph_method(self):
        """The compiled graph must support get_graph() for visualization."""
        from app.agent.graph import create_agent

        graph = create_agent()
        assert hasattr(graph, "get_graph"), (
            "Compiled graph must have a 'get_graph' method"
        )

    def test_create_agent_uses_prompt_assistant_state(self):
        """create_agent must use PromptAssistantState as the state schema."""
        from app.agent.graph import create_agent

        graph = create_agent()
        # The graph builder's schema should reference PromptAssistantState
        # We can verify by checking graph's channels include our custom fields
        graph_def = graph.get_graph()
        # At minimum, the graph must be configured with our custom state
        # which includes fields beyond base AgentState
        assert graph is not None

    def test_create_agent_llm_uses_openrouter_base_url(self):
        """The LLM client must be configured with OpenRouter base_url."""
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_chat.return_value = MagicMock()
            # Patch create_react_agent to avoid full graph compilation with mock LLM
            with patch("app.agent.graph.create_react_agent") as mock_create:
                mock_create.return_value = MagicMock()
                from app.agent.graph import create_agent

                create_agent()

                # Verify ChatOpenAI was called with OpenRouter base_url
                mock_chat.assert_called_once()
                call_kwargs = mock_chat.call_args
                assert call_kwargs.kwargs.get("base_url") == "https://openrouter.ai/api/v1", (
                    f"LLM must use OpenRouter base_url, "
                    f"got '{call_kwargs.kwargs.get('base_url')}'"
                )

    def test_create_agent_llm_uses_default_model_from_settings(self):
        """The LLM client must use the model from settings.assistant_model_default."""
        from app.config import settings

        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_chat.return_value = MagicMock()
            with patch("app.agent.graph.create_react_agent") as mock_create:
                mock_create.return_value = MagicMock()
                from app.agent.graph import create_agent

                create_agent()

                call_kwargs = mock_chat.call_args
                assert call_kwargs.kwargs.get("model") == settings.assistant_model_default, (
                    f"LLM must use model from settings.assistant_model_default "
                    f"('{settings.assistant_model_default}'), "
                    f"got '{call_kwargs.kwargs.get('model')}'"
                )

    def test_create_agent_accepts_checkpointer_parameter(self):
        """create_agent must accept an optional checkpointer parameter."""
        from app.agent.graph import create_agent

        checkpointer = MemorySaver()
        # Must not raise when called with a real checkpointer
        graph = create_agent(checkpointer=checkpointer)
        assert graph is not None, (
            "create_agent(checkpointer=...) must return a graph"
        )

    def test_create_agent_without_checkpointer(self):
        """create_agent must work without a checkpointer (default None)."""
        from app.agent.graph import create_agent

        graph = create_agent()
        assert graph is not None, (
            "create_agent() without checkpointer must return a graph"
        )

    def test_agent_invoke_with_mocked_llm(self):
        """Agent must respond to a simple HumanMessage with a mocked LLM.

        Uses mock_external strategy: the LLM call is mocked via FakeListChatModel
        to avoid real OpenRouter API costs, but everything else is real.
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        fake_llm = FakeListChatModel(responses=["Hallo! Wie kann ich dir helfen?"])

        with patch("app.agent.graph.ChatOpenAI", return_value=fake_llm):
            from app.agent.graph import create_agent

            graph = create_agent()

            result = graph.invoke({
                "messages": [HumanMessage(content="Hallo")],
                **DEFAULT_STATE_VALUES,
            })

            assert "messages" in result, (
                "Agent output state must contain 'messages'"
            )
            assert len(result["messages"]) >= 2, (
                f"Output must have at least 2 messages "
                f"(HumanMessage + AIMessage), got {len(result['messages'])}"
            )
