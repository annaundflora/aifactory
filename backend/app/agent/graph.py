"""LangGraph agent factory for the Prompt Assistant.

Creates a compiled ReAct agent graph using create_react_agent with custom state,
OpenRouter LLM via langchain-openai, and optional checkpointer support.
"""

from typing import Optional

from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.prebuilt import create_react_agent

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.state import PromptAssistantState
from app.config import settings


def create_agent(
    checkpointer: Optional[BaseCheckpointSaver] = None,
):
    """Create a compiled LangGraph agent for the Prompt Assistant.

    Creates a ReAct agent using create_react_agent with:
    - Custom PromptAssistantState for extended state fields
    - OpenRouter LLM via ChatOpenAI with base_url override
    - System prompt with bilingual instructions (German chat, English prompts)
    - Optional checkpointer for session persistence (PostgresSaver in production)

    Args:
        checkpointer: Optional checkpoint saver for state persistence.
            Pass a PostgresSaver instance for production session resume.
            Pass None for stateless operation (e.g., testing).

    Returns:
        A compiled LangGraph graph ready for invocation.
    """
    llm = ChatOpenAI(
        model=settings.assistant_model_default,
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
        streaming=True,
    )

    # No tools in this slice -- tools are added in later slices (12, 16, 20).
    # The agent can only generate text responses at this stage.
    tools: list = []

    graph = create_react_agent(
        model=llm,
        tools=tools,
        state_schema=PromptAssistantState,
        prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )

    return graph
