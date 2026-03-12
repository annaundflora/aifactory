"""LangGraph agent factory for the Prompt Assistant.

Creates a compiled ReAct-style agent graph with custom state,
OpenRouter LLM via langchain-openai, optional checkpointer support,
and a post_process_node that updates state fields after tool execution.

Tools: draft_prompt, refine_prompt, analyze_image, recommend_model, get_model_info

Graph structure:
    START -> assistant_node -> (has tool calls?) -> tools_node -> post_process_node -> assistant_node
                            -> (no tool calls?) -> END
"""

import json
import logging
from typing import Optional

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableLambda
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt import create_react_agent  # noqa: F401 - kept for test backward compat

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.state import PromptAssistantState
from app.agent.tools.image_tools import analyze_image
from app.agent.tools.model_tools import get_model_info, recommend_model
from app.agent.tools.prompt_tools import draft_prompt, refine_prompt
from app.config import settings

logger = logging.getLogger(__name__)

# Tool registry: all tools available to the agent.
ALL_TOOLS = [draft_prompt, refine_prompt, analyze_image, recommend_model, get_model_info]

# Tool names whose results should update state fields via post_process_node.
# Maps tool name -> state field to update.
TOOL_STATE_MAPPING: dict[str, str] = {
    "draft_prompt": "draft_prompt",
    "refine_prompt": "draft_prompt",
    "analyze_image": "reference_images",
    "recommend_model": "recommended_model",
}

# Tools whose results should be appended to a list field (not overwritten).
# The value is the state field that holds the list.
TOOL_APPEND_MAPPING: dict[str, str] = {
    "analyze_image": "reference_images",
}


def post_process_node(state: PromptAssistantState) -> dict:
    """Process tool results and update state fields accordingly.

    Reads the most recent ToolMessage(s) from state and checks if they
    correspond to tools in TOOL_STATE_MAPPING. If so, extracts the tool
    result and updates the corresponding state field.

    For draft_prompt and refine_prompt: updates state["draft_prompt"] (overwrite).
    For analyze_image: appends {"url": <image_url>, "analysis": <result>} to
    state["reference_images"] (append, not overwrite).

    Returns:
        Dict with state field updates (e.g., {"draft_prompt": {...}}).
    """
    updates: dict = {}
    messages = state.get("messages", [])

    # Walk backwards through messages to find the most recent ToolMessages.
    # Also collect corresponding AIMessage tool_calls to extract tool arguments
    # (needed for analyze_image to get the image_url).
    tool_messages: list[ToolMessage] = []
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            tool_messages.append(msg)
        else:
            break

    # Find the AIMessage just before the tool messages to get tool_call args
    ai_message = None
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            ai_message = msg
            break

    # Build a mapping from tool_call_id -> tool_call args for URL extraction
    tool_call_args: dict[str, dict] = {}
    if ai_message and hasattr(ai_message, "tool_calls"):
        for tc in ai_message.tool_calls or []:
            tool_call_args[tc["id"]] = tc.get("args", {})

    for msg in tool_messages:
        tool_name = getattr(msg, "name", None)
        if not tool_name or tool_name not in TOOL_STATE_MAPPING:
            continue

        state_field = TOOL_STATE_MAPPING[tool_name]

        # Parse the tool result content
        content = msg.content
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                logger.warning(
                    "Could not parse tool result for %s as JSON: %s",
                    tool_name,
                    content[:100] if content else "(empty)",
                )
                continue

        if not isinstance(content, dict):
            continue

        # Skip error results (e.g., recommend_model returning {"error": "..."})
        # These should not update state fields.
        if "error" in content and len(content) == 1:
            logger.debug(
                "post_process_node: Skipping error result from tool %s: %s",
                tool_name,
                str(content.get("error", ""))[:100],
            )
            continue

        # Check if this tool uses append semantics (list field)
        if tool_name in TOOL_APPEND_MAPPING:
            # For analyze_image: append {"url": <image_url>, "analysis": <result>}
            # Extract the image_url from the original tool call arguments
            tool_call_id = getattr(msg, "tool_call_id", None)
            args = tool_call_args.get(tool_call_id, {}) if tool_call_id else {}
            image_url = args.get("image_url", "")

            entry = {"url": image_url, "analysis": content}

            # Get existing list from updates (prior iterations) or state and append
            existing = list(updates.get(state_field, state.get(state_field, [])))
            existing.append(entry)
            updates[state_field] = existing

            logger.debug(
                "post_process_node: Appended to state[%s] from tool %s (url=%s)",
                state_field,
                tool_name,
                image_url[:80] if image_url else "(unknown)",
            )
        else:
            # Simple overwrite semantics (draft_prompt, refine_prompt)
            # Only update if we haven't already set this field
            # (in case of multiple tool calls, last one wins)
            if state_field not in updates:
                updates[state_field] = content
                logger.debug(
                    "post_process_node: Updated state[%s] from tool %s",
                    state_field,
                    tool_name,
                )

    return updates


def _should_continue(state: PromptAssistantState) -> str:
    """Route after the assistant node: to tools or to END.

    If the last AI message has tool calls, route to the tools node.
    Otherwise, end the conversation turn.
    """
    messages = state.get("messages", [])
    if not messages:
        return END

    last_message = messages[-1]
    if isinstance(last_message, AIMessage) and getattr(last_message, "tool_calls", None):
        return "tools"
    return END


def create_agent(
    checkpointer: Optional[BaseCheckpointSaver] = None,
):
    """Create a compiled LangGraph agent for the Prompt Assistant.

    Builds a custom ReAct-style graph with:
    - assistant_node: Calls the LLM with tools bound
    - tools_node: Executes tool calls (ToolNode from langgraph.prebuilt)
    - post_process_node: Updates state fields based on tool results
    - Conditional routing: assistant -> tools -> post_process -> assistant, or assistant -> END

    The graph uses:
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
        max_tokens=4096,
        streaming=True,
    )

    # Bind tools to the LLM if available.
    # Some LLM implementations (e.g., FakeListChatModel in tests) don't
    # support bind_tools. Fall back gracefully to the raw LLM in that case.
    if ALL_TOOLS:
        try:
            llm_with_tools = llm.bind_tools(ALL_TOOLS)
        except NotImplementedError:
            logger.warning(
                "LLM does not support bind_tools. "
                "Tools will not be available for this agent instance."
            )
            llm_with_tools = llm
    else:
        llm_with_tools = llm

    # Define both sync and async assistant node implementations as closures
    # over the LLM instance. LangGraph requires sync for invoke() and
    # async for ainvoke()/astream_events().
    def _call_model_sync(state: PromptAssistantState) -> dict:
        """Sync: Call the LLM with the current messages and system prompt."""
        system_msg = SystemMessage(content=SYSTEM_PROMPT)
        messages = [system_msg] + list(state["messages"])
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    async def _call_model_async(state: PromptAssistantState) -> dict:
        """Async: Call the LLM with the current messages and system prompt."""
        system_msg = SystemMessage(content=SYSTEM_PROMPT)
        messages = [system_msg] + list(state["messages"])
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    assistant_node = RunnableLambda(_call_model_sync, afunc=_call_model_async)

    # Build the graph
    workflow = StateGraph(PromptAssistantState)

    # Add nodes
    workflow.add_node("assistant", assistant_node)

    if ALL_TOOLS:
        tool_node = ToolNode(ALL_TOOLS)
        workflow.add_node("tools", tool_node)
        workflow.add_node("post_process", post_process_node)

    # Set entry point
    workflow.set_entry_point("assistant")

    # Add edges
    if ALL_TOOLS:
        # assistant -> tools (if tool calls) or -> END (if no tool calls)
        workflow.add_conditional_edges(
            "assistant",
            _should_continue,
            {"tools": "tools", END: END},
        )
        # tools -> post_process
        workflow.add_edge("tools", "post_process")
        # post_process -> assistant
        workflow.add_edge("post_process", "assistant")
    else:
        # No tools: assistant always goes to END
        workflow.add_edge("assistant", END)

    graph = workflow.compile(checkpointer=checkpointer)
    return graph
