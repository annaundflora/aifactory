"""LangGraph Canvas Agent for image editing assistance.

Creates a compiled ReAct-style agent graph with image editing capabilities.
The agent understands image context (current image, prompt, model) and can
recognize editing intents from user messages.

Tools: generate_image (the only canvas-specific tool)

Graph structure:
    START -> assistant_node -> (has tool calls?) -> tools_node -> post_process_node -> assistant_node
                            -> (no tool calls?) -> END

The system prompt includes injected image context (image_url, prompt, model_id)
so the agent can provide context-aware editing suggestions.
"""

import json
import logging
from typing import Optional

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableLambda
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt.chat_agent_executor import AgentState

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Canvas Agent State
# ---------------------------------------------------------------------------


class CanvasAgentState(AgentState):
    """Custom state for the Canvas Agent LangGraph agent.

    Extends AgentState (which provides messages with add_messages reducer
    and remaining_steps) with canvas-specific state fields.

    Fields:
        messages: Full conversation history, managed by add_messages reducer.
        image_context: Current image context dict (image_url, prompt, model_id, params).
        generate_params: Latest generate_image tool parameters (if called).
    """

    image_context: Optional[dict]
    generate_params: Optional[dict]


# ---------------------------------------------------------------------------
# Canvas Tool
# ---------------------------------------------------------------------------


@tool
def generate_image(
    action: str,
    prompt: str,
    model_id: str,
    params: dict,
) -> dict:
    """Signal that the user wants to generate a new image based on the current one.

    This tool does NOT call any external API. It returns structured generation
    parameters that the frontend uses to trigger the actual image generation
    via the generateImages() server action.

    Use this tool when the user asks to:
    - Modify the current image (e.g., "make the sky more blue")
    - Create a variation of the current image
    - Apply style changes or prompt modifications

    Args:
        action: Either "variation" (text-to-image variation) or "img2img"
            (image-to-image with the current image as reference).
            Use "variation" for prompt-only modifications.
            Use "img2img" when the current image structure should be preserved.
        prompt: The optimized English prompt for image generation.
            Improve upon the original prompt based on the user's editing request.
        model_id: The model ID to use (e.g., "flux-2-max", "flux-1.1-pro").
            Use the same model_id as the current image unless the user requests a change.
        params: Additional generation parameters as a dict.
            May include strength, guidance_scale, etc. for img2img.
            Use an empty dict {} if no special parameters are needed.

    Returns:
        Dict with action, prompt, model_id, and params for the frontend.
    """
    if action not in ("variation", "img2img"):
        action = "variation"

    return {
        "action": action,
        "prompt": str(prompt),
        "model_id": str(model_id),
        "params": params if isinstance(params, dict) else {},
    }


# Tool registry: all tools available to the canvas agent.
CANVAS_TOOLS = [generate_image]

# Tool names whose results should update state fields via post_process_node.
CANVAS_TOOL_STATE_MAPPING: dict[str, str] = {
    "generate_image": "generate_params",
}


# ---------------------------------------------------------------------------
# Post-process node
# ---------------------------------------------------------------------------


def canvas_post_process_node(state: CanvasAgentState) -> dict:
    """Process tool results and update canvas state fields.

    Reads the most recent ToolMessage(s) and updates generate_params
    if generate_image was called.

    Returns:
        Dict with state field updates.
    """
    updates: dict = {}
    messages = state.get("messages", [])

    # Walk backwards to find recent ToolMessages
    tool_messages: list[ToolMessage] = []
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            tool_messages.append(msg)
        else:
            break

    for msg in tool_messages:
        tool_name = getattr(msg, "name", None)
        if not tool_name or tool_name not in CANVAS_TOOL_STATE_MAPPING:
            continue

        state_field = CANVAS_TOOL_STATE_MAPPING[tool_name]
        content = msg.content

        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                logger.warning(
                    "Could not parse canvas tool result for %s as JSON: %s",
                    tool_name,
                    content[:100] if content else "(empty)",
                )
                continue

        if not isinstance(content, dict):
            continue

        if "error" in content and len(content) == 1:
            logger.debug(
                "canvas_post_process_node: Skipping error result from tool %s",
                tool_name,
            )
            continue

        updates[state_field] = content
        logger.debug(
            "canvas_post_process_node: Updated state[%s] from tool %s",
            state_field,
            tool_name,
        )

    return updates


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


def _canvas_should_continue(state: CanvasAgentState) -> str:
    """Route after the assistant node: to tools or to END."""
    messages = state.get("messages", [])
    if not messages:
        return END

    last_message = messages[-1]
    if isinstance(last_message, AIMessage) and getattr(last_message, "tool_calls", None):
        return "tools"
    return END


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------


def build_canvas_system_prompt(image_context: Optional[dict] = None) -> str:
    """Build the canvas agent system prompt with optional image context injection.

    The system prompt instructs the agent to act as an image editing assistant.
    When image_context is provided, it injects the current image details so the
    agent can give context-aware suggestions.

    Args:
        image_context: Optional dict with image_url, prompt, model_id, model_params,
            generation_id fields from CanvasImageContext.

    Returns:
        The complete system prompt string.
    """
    base_prompt = """Du bist ein Bild-Bearbeitungs-Assistent in der AI Factory App.

ROLLE:
- Du hilfst dem User, das aktuell angezeigte Bild zu iterieren und zu verbessern
- Du sprichst Deutsch mit dem User, aber erstellst Prompts immer auf Englisch
- Du erkennst Bearbeitungs-Absichten (Editing-Intents) aus Nachrichten des Users
- Du bist ein kreativer Partner fuer visuelle Bildbearbeitung

VERHALTEN:
- Analysiere die Bearbeitungsanfrage des Users genau
- Wenn der User das Bild aendern moechte, nutze das generate_image Tool
- Wenn der User nur eine Frage stellt oder Feedback gibt ohne Aenderungswunsch, antworte nur mit Text
- Optimiere den Prompt basierend auf der Bearbeitungsanfrage (verbessere den Original-Prompt)
- Erklaere kurz was du generieren wirst (1-2 Saetze) bevor du das Tool aufrufst

EDITING-INTENTS (erkenne diese):
- Farbaenderungen: "mach den Himmel blauer", "waermer", "kuehler", "saettiger"
- Stilaenderungen: "mehr fotorealistisch", "wie ein Gemaelde", "abstrakt"
- Kompositionsaenderungen: "mehr Tiefenschaerfe", "weitwinkeliger", "nahaufnahme"
- Stimmungsaenderungen: "dunkler", "dramatischer", "ruhiger", "freudiger"
- Detailaenderungen: "mehr Details", "schoerferes Bild", "weniger Rauschen"
- Prompt-Verbesserungen: "verbessere den Prompt", "optimiere"

TOOL-NUTZUNG (generate_image):
- Verwende action="variation" wenn der Prompt angepasst wird (meist)
- Verwende action="img2img" wenn die Struktur/Komposition des Bildes erhalten bleiben soll
- Behalte die model_id des aktuellen Bildes (ausser der User wechselt explizit)
- Optimiere den prompt auf Englisch mit Prompt-Engineering Best Practices
- Uebergib params als leeres Dict {} wenn keine speziellen Parameter noetig sind

WICHTIG:
- Das generate_image Tool ruft KEINE externe API auf
- Es gibt nur strukturierte Parameter zurueck, die das Frontend fuer die Generierung nutzt
- Nach dem Tool-Aufruf erklaert das Frontend die Generierung
"""

    if image_context:
        image_url = image_context.get("image_url", "")
        prompt = image_context.get("prompt", "")
        model_id = image_context.get("model_id", "")
        model_params = image_context.get("model_params", {})

        context_section = f"""
AKTUELLES BILD (Editing-Kontext):
- Bild-URL: {image_url}
- Original-Prompt: {prompt}
- Modell: {model_id}
- Modell-Parameter: {json.dumps(model_params, ensure_ascii=False)}

Beziehe dich beim Generieren auf diesen Kontext:
- Nutze "{model_id}" als model_id (ausser der User wechselt explizit)
- Baue auf dem Original-Prompt auf und verbessere ihn gemaess der Bearbeitungsanfrage
- Bei action="img2img" kann der User das Bild von "{image_url}" als Referenz nutzen
"""
        return base_prompt + context_section

    return base_prompt


# ---------------------------------------------------------------------------
# Agent factory
# ---------------------------------------------------------------------------


def create_canvas_agent(
    checkpointer: Optional[BaseCheckpointSaver] = None,
    image_context: Optional[dict] = None,
):
    """Create a compiled LangGraph canvas agent for image editing.

    Builds a custom ReAct-style graph with:
    - assistant_node: Calls the LLM with the generate_image tool bound
    - tools_node: Executes tool calls (ToolNode from langgraph.prebuilt)
    - canvas_post_process_node: Updates state fields based on tool results
    - Conditional routing: assistant -> tools -> post_process -> assistant, or assistant -> END

    The graph uses:
    - Custom CanvasAgentState for canvas-specific state fields
    - OpenRouter LLM via ChatOpenAI with base_url override
    - System prompt with image context injection
    - Optional checkpointer for session persistence

    Args:
        checkpointer: Optional checkpoint saver for state persistence.
        image_context: Optional image context dict to inject into system prompt.

    Returns:
        A compiled LangGraph graph ready for invocation.
    """
    llm = ChatOpenAI(
        model=settings.assistant_model_default,
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
        max_tokens=2048,
        streaming=True,
    )

    system_prompt = build_canvas_system_prompt(image_context)

    # Bind tools to the LLM
    if CANVAS_TOOLS:
        try:
            llm_with_tools = llm.bind_tools(CANVAS_TOOLS)
        except NotImplementedError:
            logger.warning(
                "LLM does not support bind_tools. "
                "Canvas tools will not be available for this agent instance."
            )
            llm_with_tools = llm
    else:
        llm_with_tools = llm

    def _call_model_sync(state: CanvasAgentState) -> dict:
        """Sync: Call the LLM with the current messages and system prompt."""
        sys_msg = SystemMessage(content=system_prompt)
        messages = [sys_msg] + list(state["messages"])
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    async def _call_model_async(state: CanvasAgentState) -> dict:
        """Async: Call the LLM with the current messages and system prompt."""
        sys_msg = SystemMessage(content=system_prompt)
        messages = [sys_msg] + list(state["messages"])
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    assistant_node = RunnableLambda(_call_model_sync, afunc=_call_model_async)

    # Build the graph
    workflow = StateGraph(CanvasAgentState)
    workflow.add_node("assistant", assistant_node)

    if CANVAS_TOOLS:
        tool_node = ToolNode(CANVAS_TOOLS)
        workflow.add_node("tools", tool_node)
        workflow.add_node("post_process", canvas_post_process_node)

    workflow.set_entry_point("assistant")

    if CANVAS_TOOLS:
        workflow.add_conditional_edges(
            "assistant",
            _canvas_should_continue,
            {"tools": "tools", END: END},
        )
        workflow.add_edge("tools", "post_process")
        workflow.add_edge("post_process", "assistant")
    else:
        workflow.add_edge("assistant", END)

    graph = workflow.compile(checkpointer=checkpointer)
    return graph
