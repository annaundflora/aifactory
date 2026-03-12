"""Unit tests for agent state definition (slice-03).

Tests the PromptAssistantState TypedDict and DEFAULT_STATE_VALUES
against the architecture specification.
"""

import typing
from typing import get_type_hints

import pytest


class TestPromptAssistantState:
    """Unit tests for PromptAssistantState fields and types."""

    def test_state_has_messages_field(self):
        """PromptAssistantState must have a 'messages' field inherited from AgentState."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState, include_extras=True)
        assert "messages" in hints, (
            "PromptAssistantState must have a 'messages' field "
            "(inherited from AgentState with add_messages reducer)"
        )

    def test_state_messages_has_add_messages_reducer(self):
        """The 'messages' field must use the add_messages reducer (Annotated type)."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState, include_extras=True)
        messages_type = hints["messages"]
        # add_messages reducer is applied via typing.Annotated
        assert hasattr(messages_type, "__metadata__"), (
            "messages field must be Annotated with add_messages reducer"
        )

    def test_state_has_draft_prompt_field(self):
        """PromptAssistantState must have 'draft_prompt' as Optional[dict]."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "draft_prompt" in hints, (
            "PromptAssistantState must have a 'draft_prompt' field"
        )

    def test_state_has_reference_images_field(self):
        """PromptAssistantState must have 'reference_images' as list."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "reference_images" in hints, (
            "PromptAssistantState must have a 'reference_images' field"
        )

    def test_state_has_recommended_model_field(self):
        """PromptAssistantState must have 'recommended_model' as Optional[dict]."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "recommended_model" in hints, (
            "PromptAssistantState must have a 'recommended_model' field"
        )

    def test_state_has_collected_info_field(self):
        """PromptAssistantState must have 'collected_info' as dict."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "collected_info" in hints, (
            "PromptAssistantState must have a 'collected_info' field"
        )

    def test_state_has_phase_field(self):
        """PromptAssistantState must have 'phase' as str."""
        from app.agent.state import PromptAssistantState

        hints = get_type_hints(PromptAssistantState)
        assert "phase" in hints, (
            "PromptAssistantState must have a 'phase' field"
        )

    def test_default_state_phase_is_understand(self):
        """Default phase value must be 'understand'."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["phase"] == "understand", (
            f"Default phase must be 'understand', "
            f"got '{DEFAULT_STATE_VALUES.get('phase')}'"
        )

    def test_default_state_reference_images_is_empty_list(self):
        """Default reference_images must be an empty list."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["reference_images"] == [], (
            f"Default reference_images must be [], "
            f"got {DEFAULT_STATE_VALUES.get('reference_images')}"
        )

    def test_default_state_collected_info_is_empty_dict(self):
        """Default collected_info must be an empty dict."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["collected_info"] == {}, (
            f"Default collected_info must be {{}}, "
            f"got {DEFAULT_STATE_VALUES.get('collected_info')}"
        )

    def test_default_state_draft_prompt_is_none(self):
        """Default draft_prompt must be None."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["draft_prompt"] is None, (
            f"Default draft_prompt must be None, "
            f"got {DEFAULT_STATE_VALUES.get('draft_prompt')}"
        )

    def test_default_state_recommended_model_is_none(self):
        """Default recommended_model must be None."""
        from app.agent.state import DEFAULT_STATE_VALUES

        assert DEFAULT_STATE_VALUES["recommended_model"] is None, (
            f"Default recommended_model must be None, "
            f"got {DEFAULT_STATE_VALUES.get('recommended_model')}"
        )


class TestSystemPrompt:
    """Unit tests for the system prompt content."""

    def test_system_prompt_is_string(self):
        """SYSTEM_PROMPT must be a non-empty string constant."""
        from app.agent.prompts import SYSTEM_PROMPT

        assert isinstance(SYSTEM_PROMPT, str), (
            f"SYSTEM_PROMPT must be a string, got {type(SYSTEM_PROMPT).__name__}"
        )
        assert len(SYSTEM_PROMPT) > 0, "SYSTEM_PROMPT must not be empty"

    def test_system_prompt_instructs_german_chat(self):
        """System prompt must instruct the agent to speak German with the user."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        assert "deutsch" in prompt_lower, (
            "System prompt must contain instruction for German chat language"
        )

    def test_system_prompt_instructs_english_prompts(self):
        """System prompt must instruct the agent to create prompts in English."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        assert "englisch" in prompt_lower or "english" in prompt_lower.replace("ä", "a"), (
            "System prompt must contain instruction for English prompt output"
        )

    def test_system_prompt_creative_partner_role(self):
        """System prompt must define a creative partner role, not a questionnaire."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        assert "kreativ" in prompt_lower, (
            "System prompt must define a creative partner role"
        )
        assert "fragebogen" in prompt_lower, (
            "System prompt must explicitly state it should NOT be a questionnaire "
            "(mention 'Fragebogen' to distinguish the role)"
        )

    def test_system_prompt_must_haves_motiv(self):
        """System prompt must include Motiv/Subjekt as a must-have."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        assert "motiv" in prompt_lower or "subjekt" in prompt_lower, (
            "System prompt must mention 'Motiv' or 'Subjekt' as a must-have"
        )

    def test_system_prompt_must_haves_stil(self):
        """System prompt must include Stil as a must-have."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        assert "stil" in prompt_lower, (
            "System prompt must mention 'Stil' as a must-have"
        )

    def test_system_prompt_must_haves_zweck(self):
        """System prompt must include Zweck (purpose) as a must-have."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        assert "zweck" in prompt_lower, (
            "System prompt must mention 'Zweck' as a must-have"
        )

    def test_system_prompt_tool_usage_hints(self):
        """System prompt must contain tool usage hints."""
        from app.agent.prompts import SYSTEM_PROMPT

        prompt_lower = SYSTEM_PROMPT.lower()
        # Must mention tools like draft_prompt, analyze_image, or recommend_model
        has_tool_hint = (
            "tool" in prompt_lower
            or "draft_prompt" in prompt_lower
            or "analyze_image" in prompt_lower
            or "recommend_model" in prompt_lower
        )
        assert has_tool_hint, (
            "System prompt must contain tool usage hints "
            "(e.g., draft_prompt, analyze_image, recommend_model)"
        )
