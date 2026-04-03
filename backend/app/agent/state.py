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
    """

    draft_prompt: Optional[dict]
    reference_images: list[dict]
    recommended_model: Optional[dict]
    collected_info: dict
    phase: str


# Default values for initializing a new conversation state.
# Used by AssistantService when creating new sessions.
DEFAULT_STATE_VALUES: dict = {
    "draft_prompt": None,
    "reference_images": [],
    "recommended_model": None,
    "collected_info": {},
    "phase": "understand",
}
