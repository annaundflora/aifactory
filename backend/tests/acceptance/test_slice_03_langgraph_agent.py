"""Acceptance tests for Slice 03: LangGraph Agent Grundstruktur.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-03-langgraph-agent.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
OpenRouter LLM calls are mocked; all other components use real instances.
"""

from typing import get_type_hints
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver


class TestSlice03Acceptance:
    """Acceptance tests for Slice 03 - LangGraph Agent Grundstruktur."""

    def test_ac1_create_agent_returns_compiled_graph(self):
        """AC-1: GIVEN die installierte app Package aus Slice 01/02
        WHEN python -c "from app.agent.graph import create_agent; g = create_agent()"
        ausgefuehrt wird
        THEN wird ein kompilierter LangGraph-Graph zurueckgegeben ohne Fehler
        (kein Import-/Runtime-Error)
        """
        from app.agent.graph import create_agent

        graph = create_agent()

        # Must return a compiled graph (not None, not an error)
        assert graph is not None, (
            "create_agent() must return a compiled graph, not None"
        )

        # A compiled LangGraph graph must have invoke and ainvoke methods
        assert hasattr(graph, "invoke"), (
            "Compiled graph must have an 'invoke' method"
        )
        assert hasattr(graph, "ainvoke"), (
            "Compiled graph must have an 'ainvoke' method"
        )

    def test_ac2_state_has_all_required_fields(self):
        """AC-2: GIVEN die app.agent.state Modul-Definition
        WHEN PromptAssistantState inspiziert wird
        THEN enthaelt der State alle Felder gemaess architecture.md Section
        "LangGraph State": messages (mit add_messages Reducer), draft_prompt
        (optional dict), reference_images (list), recommended_model (optional dict),
        collected_info (dict), phase (str, default "understand")
        """
        from app.agent.state import DEFAULT_STATE_VALUES, PromptAssistantState

        hints = get_type_hints(PromptAssistantState, include_extras=True)

        # 1. messages field with add_messages reducer (Annotated type)
        assert "messages" in hints, (
            "PromptAssistantState must have a 'messages' field"
        )
        messages_type = hints["messages"]
        assert hasattr(messages_type, "__metadata__"), (
            "messages field must be Annotated (with add_messages reducer)"
        )

        # 2. draft_prompt (optional dict)
        assert "draft_prompt" in hints, (
            "PromptAssistantState must have a 'draft_prompt' field"
        )

        # 3. reference_images (list)
        assert "reference_images" in hints, (
            "PromptAssistantState must have a 'reference_images' field"
        )

        # 4. recommended_model (optional dict)
        assert "recommended_model" in hints, (
            "PromptAssistantState must have a 'recommended_model' field"
        )

        # 5. collected_info (dict)
        assert "collected_info" in hints, (
            "PromptAssistantState must have a 'collected_info' field"
        )

        # 6. phase (str, default "understand")
        assert "phase" in hints, (
            "PromptAssistantState must have a 'phase' field"
        )
        assert DEFAULT_STATE_VALUES["phase"] == "understand", (
            f"Default phase must be 'understand', "
            f"got '{DEFAULT_STATE_VALUES.get('phase')}'"
        )

    def test_ac3_agent_responds_to_simple_message(self):
        """AC-3: GIVEN ein erstellter Agent-Graph
        WHEN der Graph mit einer einfachen HumanMessage invoked wird
        (z.B. "Hallo") und einem gemockten LLM
        THEN enthaelt der Output-State ein messages-Array mit mindestens
        2 Eintraegen (HumanMessage + AIMessage)
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        fake_llm = FakeListChatModel(
            responses=["Hallo! Wie kann ich dir bei der Bildgenerierung helfen?"]
        )

        with patch("app.agent.graph.ChatOpenAI", return_value=fake_llm):
            from app.agent.graph import create_agent

            graph = create_agent()

            result = graph.invoke({
                "messages": [HumanMessage(content="Hallo")],
                **DEFAULT_STATE_VALUES,
            })

        # Output must contain messages
        assert "messages" in result, (
            "Output state must contain 'messages' key"
        )

        messages = result["messages"]
        assert len(messages) >= 2, (
            f"Output must contain at least 2 messages "
            f"(HumanMessage + AIMessage), got {len(messages)}"
        )

        # First message should be the HumanMessage
        assert isinstance(messages[0], HumanMessage), (
            f"First message must be HumanMessage, got {type(messages[0]).__name__}"
        )

        # Last message should be an AIMessage
        assert isinstance(messages[-1], AIMessage), (
            f"Last message must be AIMessage, got {type(messages[-1]).__name__}"
        )

    def test_ac4_system_prompt_contains_core_instructions(self):
        """AC-4: GIVEN das app.agent.prompts Modul
        WHEN der System Prompt geladen wird
        THEN enthaelt er Instruktionen fuer: deutsche Chat-Sprache,
        englische Prompt-Ausgabe, kreative-Partner-Rolle (nicht Fragebogen),
        Must-Haves (Motiv, Stil, Zweck), und Tool-Nutzungs-Hinweise
        """
        from app.agent.prompts import SYSTEM_PROMPT

        assert isinstance(SYSTEM_PROMPT, str) and len(SYSTEM_PROMPT) > 0, (
            "SYSTEM_PROMPT must be a non-empty string"
        )

        prompt_lower = SYSTEM_PROMPT.lower()

        # 1. German chat language
        assert "deutsch" in prompt_lower, (
            "System prompt must instruct German chat language "
            "(must contain 'Deutsch')"
        )

        # 2. English prompt output
        assert "englisch" in prompt_lower, (
            "System prompt must instruct English prompt output "
            "(must contain 'Englisch')"
        )

        # 3. Creative partner role (not questionnaire)
        assert "kreativ" in prompt_lower, (
            "System prompt must define creative partner role "
            "(must contain 'kreativ')"
        )
        assert "fragebogen" in prompt_lower, (
            "System prompt must explicitly state it is NOT a questionnaire "
            "(must mention 'Fragebogen')"
        )

        # 4. Must-haves: Motiv, Stil, Zweck
        assert "motiv" in prompt_lower, (
            "System prompt must include 'Motiv' as a must-have"
        )
        assert "stil" in prompt_lower, (
            "System prompt must include 'Stil' as a must-have"
        )
        assert "zweck" in prompt_lower, (
            "System prompt must include 'Zweck' as a must-have"
        )

        # 5. Tool usage hints
        has_tool_hints = (
            "draft_prompt" in SYSTEM_PROMPT
            or "analyze_image" in SYSTEM_PROMPT
            or "recommend_model" in SYSTEM_PROMPT
        )
        assert has_tool_hints, (
            "System prompt must contain tool usage hints "
            "(e.g., draft_prompt, analyze_image, recommend_model)"
        )

    def test_ac5_llm_configured_with_openrouter_base_url(self):
        """AC-5: GIVEN die create_agent() Factory-Funktion
        WHEN sie ohne Argumente aufgerufen wird
        THEN wird der LLM-Client mit OpenRouter base_url
        (https://openrouter.ai/api/v1) und dem Default-Model aus
        settings.assistant_model_default konfiguriert
        """
        from app.config import settings

        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_chat.return_value = MagicMock()
            with patch("app.agent.graph.create_react_agent") as mock_create:
                mock_create.return_value = MagicMock()

                from app.agent.graph import create_agent

                create_agent()

                # Verify ChatOpenAI was called exactly once
                mock_chat.assert_called_once()
                call_kwargs = mock_chat.call_args

                # Verify base_url is OpenRouter
                assert call_kwargs.kwargs.get("base_url") == "https://openrouter.ai/api/v1", (
                    f"LLM base_url must be 'https://openrouter.ai/api/v1', "
                    f"got '{call_kwargs.kwargs.get('base_url')}'"
                )

                # Verify model comes from settings
                assert call_kwargs.kwargs.get("model") == settings.assistant_model_default, (
                    f"LLM model must be '{settings.assistant_model_default}' "
                    f"(from settings.assistant_model_default), "
                    f"got '{call_kwargs.kwargs.get('model')}'"
                )

    def test_ac6_create_agent_accepts_checkpointer(self):
        """AC-6: GIVEN die create_agent() Factory-Funktion
        WHEN sie mit einem optionalen checkpointer Parameter aufgerufen wird
        THEN wird der Checkpointer an den kompilierten Graphen uebergeben
        (fuer spaetere PostgresSaver-Integration)
        """
        from app.agent.graph import create_agent

        checkpointer = MemorySaver()

        # Must not raise when called with a checkpointer
        graph = create_agent(checkpointer=checkpointer)

        assert graph is not None, (
            "create_agent(checkpointer=...) must return a compiled graph"
        )
        assert hasattr(graph, "invoke"), (
            "Graph created with checkpointer must still have 'invoke' method"
        )

    def test_ac7_agent_accepts_thread_id_config(self):
        """AC-7: GIVEN ein erstellter Agent-Graph mit Checkpointer (Mock)
        WHEN der Graph mit config={"configurable": {"thread_id": "test-123"}}
        invoked wird
        THEN wird der thread_id-basierte Config an den Checkpointer durchgereicht
        (kein Fehler)
        """
        from app.agent.state import DEFAULT_STATE_VALUES

        checkpointer = MemorySaver()

        fake_llm = FakeListChatModel(responses=["Hallo!"])

        with patch("app.agent.graph.ChatOpenAI", return_value=fake_llm):
            from app.agent.graph import create_agent

            graph = create_agent(checkpointer=checkpointer)

            # Invoke with thread_id config -- must not raise
            result = graph.invoke(
                {
                    "messages": [HumanMessage(content="Test")],
                    **DEFAULT_STATE_VALUES,
                },
                config={"configurable": {"thread_id": "test-123"}},
            )

        assert "messages" in result, (
            "Agent must return messages when invoked with thread_id config"
        )
        assert len(result["messages"]) >= 2, (
            f"Agent with checkpointer and thread_id must return at least 2 messages, "
            f"got {len(result['messages'])}"
        )
