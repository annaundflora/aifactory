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

Image context is injected at runtime via LangGraph configurable
(config["configurable"]["image_context"]) so the graph can be compiled once
and reused across requests.
"""

import json
import logging
from typing import Optional

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig, RunnableLambda
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt.chat_agent_executor import AgentState

from app.agent.tools.image_tools import generate_image
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
- Du kannst das aktuelle Bild SEHEN und visuell analysieren (es wird als Anhang zur User-Nachricht mitgeschickt)
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
        # Cast image_url to str (may be HttpUrl Pydantic object) and truncate prompt
        # to max 2000 characters to prevent prompt injection via oversized input.
        image_url = str(image_context.get("image_url", ""))
        prompt = image_context.get("prompt", "")
        if len(prompt) > 2000:
            prompt = prompt[:2000]
        model_id = image_context.get("model_id", "")
        model_params = image_context.get("model_params", {})

        context_section = f"""
AKTUELLES BILD (Editing-Kontext):
- Du siehst das aktuelle Bild als Anhang zur User-Nachricht
- Original-Prompt: {prompt}
- Modell: {model_id}
- Modell-Parameter: {json.dumps(model_params, ensure_ascii=False)}

VISUELLES FEEDBACK:
- Beschreibe was du im Bild siehst, wenn der User danach fragt
- Nutze deine visuelle Analyse fuer gezielte Verbesserungsvorschlaege
- Beziehe dich auf konkrete visuelle Elemente (Farben, Komposition, Objekte, Stimmung)

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
    - System prompt built at runtime from config["configurable"]["image_context"]
    - Optional checkpointer for session persistence

    Image context is injected per-request via config["configurable"]["image_context"],
    so the compiled graph can be reused across requests (compiled once, run many times).

    Args:
        checkpointer: Optional checkpoint saver for state persistence.

    Returns:
        A compiled LangGraph graph ready for invocation.
    """
    def _make_llm(model_slug: Optional[str] = None):
        """Create a ChatOpenAI instance, optionally with a model override."""
        llm = ChatOpenAI(
            model=model_slug or settings.assistant_model_default,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0.7,
            max_tokens=2048,
            streaming=True,
        )
        if CANVAS_TOOLS:
            try:
                return llm.bind_tools(CANVAS_TOOLS)
            except NotImplementedError:
                logger.warning(
                    "LLM does not support bind_tools. "
                    "Canvas tools will not be available for this agent instance."
                )
        return llm

    # Default LLM (reused when no model override is specified)
    _default_llm = _make_llm()

    def _get_llm(config: RunnableConfig):
        """Return the LLM for this request — default or per-request override."""
        model = config.get("configurable", {}).get("model")
        if model and model != settings.assistant_model_default:
            return _make_llm(model)
        return _default_llm

    def _call_model_sync(state: CanvasAgentState, config: RunnableConfig) -> dict:
        """Sync: Call the LLM with the current messages and system prompt.

        Reads image_context and model from config["configurable"] at
        runtime so the same compiled graph handles all requests.
        """
        image_context = config.get("configurable", {}).get("image_context")
        system_prompt = build_canvas_system_prompt(image_context)
        sys_msg = SystemMessage(content=system_prompt)
        messages = [sys_msg] + list(state["messages"])
        response = _get_llm(config).invoke(messages)
        return {"messages": [response]}

    async def _call_model_async(state: CanvasAgentState, config: RunnableConfig) -> dict:
        """Async: Call the LLM with the current messages and system prompt.

        Reads image_context and model from config["configurable"] at
        runtime so the same compiled graph handles all requests.
        """
        image_context = config.get("configurable", {}).get("image_context")
        system_prompt = build_canvas_system_prompt(image_context)
        sys_msg = SystemMessage(content=system_prompt)
        messages = [sys_msg] + list(state["messages"])
        response = await _get_llm(config).ainvoke(messages)
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
