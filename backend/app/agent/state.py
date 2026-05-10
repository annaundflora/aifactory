"""LangGraph state definition for the Prompt Assistant agent.

Defines PromptAssistantState with all fields required by the agent graph,
including the messages reducer for LangGraph conversation management.
"""

from typing import Optional

from langgraph.prebuilt.chat_agent_executor import AgentState


class PromptAssistantState(AgentState):
    """Custom state for the Prompt Assistant LangGraph agent.

    Extends AgentState (which provides messages with add_messages reducer
    and remaining_steps) with additional fields for prompt drafting,
    image analysis, model recommendation, and conversation phase tracking.

    Fields:
        messages: Full conversation history, managed by add_messages reducer (from AgentState).
        draft_prompt: Current prompt draft (prompt).
        reference_images: List of uploaded reference images with analysis results.
        recommended_model: Currently recommended model (id, name, reason).
        collected_info: Information gathered during conversation (subject, style, purpose, etc.).
        phase: Current conversation phase (understand, explore, draft, refine).
        flow_state: Current FSM state for the Interactive Prompt Refinement flow.
            Plain ``str`` (not ``Literal``) — enum validation lives in the SSE layer
            (Slice 15) and the frontend reducer (Slice 17). Expected values:
            ``"idle" | "interviewing" | "summarizing" | "reviewing" | "refining" | "generating"``.
        intent_axes: Generic dict container for intent-summary axes
            (subject/medium/style/lighting/composition/palette). Typed as
            ``IntentSummaryPayload.axes`` in Slice 15; here held as plain ``dict``.
        final_intent: Final intent payload written by ``post_process_node`` after
            ``emit_intent_summary`` is invoked (Slice 13). Either ``None`` (initial)
            or a dict with ``prompt`` / ``settings_diff`` / ``model_id`` keys.
    """

    draft_prompt: Optional[dict]
    reference_images: list[dict]
    recommended_model: Optional[dict]
    collected_info: dict
    phase: str
    flow_state: str
    intent_axes: dict
    final_intent: Optional[dict]


# Default values for initializing a new conversation state.
# Used by AssistantService when creating new sessions.
DEFAULT_STATE_VALUES: dict = {
    "draft_prompt": None,
    "reference_images": [],
    "recommended_model": None,
    "collected_info": {},
    "phase": "understand",
    "flow_state": "idle",
    "intent_axes": {},
    "final_intent": None,
}
