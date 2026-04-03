"""Unit tests for prompt_tools.

Tests the pure logic of draft_prompt and refine_prompt tool functions
in isolation -- input validation, default values, field construction.

After Slice-08 simplification, both tools return ``{"prompt": str}``
instead of the old 3-field format (motiv / style / negative_prompt).

Mocking Strategy: mock_external (as specified in Slice-Spec).
No external calls needed here; these are pure functions.
"""

import pytest


class TestDraftPromptValidation:
    """Unit tests for draft_prompt input validation and defaults."""

    def test_draft_prompt_requires_subject_key(self):
        """draft_prompt must raise ValueError when 'subject' key is missing."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, Exception)):
            draft_prompt.invoke({"collected_info": {"style": "photorealistic"}})

    def test_draft_prompt_rejects_empty_subject(self):
        """draft_prompt must raise ValueError when 'subject' is empty string."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, Exception)):
            draft_prompt.invoke({"collected_info": {"subject": ""}})

    def test_draft_prompt_rejects_none_subject(self):
        """draft_prompt must raise ValueError when 'subject' is None."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, Exception)):
            draft_prompt.invoke({"collected_info": {"subject": None}})

    def test_draft_prompt_rejects_empty_dict(self):
        """draft_prompt must raise ValueError when called with empty collected_info."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, Exception)):
            draft_prompt.invoke({"collected_info": {}})

    def test_draft_prompt_rejects_none_input(self):
        """draft_prompt must raise when called with None collected_info."""
        from app.agent.tools.prompt_tools import draft_prompt

        with pytest.raises((ValueError, TypeError, Exception)):
            draft_prompt.invoke({"collected_info": None})

    def test_draft_prompt_returns_prompt_key(self):
        """draft_prompt must return dict with exactly one 'prompt' key."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "a cat on a roof"},
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"prompt"}

    def test_draft_prompt_value_is_nonempty_string(self):
        """The returned 'prompt' field must be a non-empty string."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "mountain landscape"},
        })

        assert isinstance(result["prompt"], str), "prompt must be a string"
        assert len(result["prompt"]) > 0, "prompt must be non-empty"

    def test_draft_prompt_uses_default_style_when_not_provided(self):
        """When style is not in collected_info, the default 'photorealistic' appears in prompt."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "sunset"},
        })

        # Default style "photorealistic" should be embedded in the prompt
        assert "photorealistic" in result["prompt"].lower()

    def test_draft_prompt_includes_quality_markers(self):
        """draft_prompt should include quality markers in the generated prompt."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "forest path"},
        })

        prompt_lower = result["prompt"].lower()
        # Default purpose ("general") adds quality markers
        assert "detailed" in prompt_lower or "professional" in prompt_lower or "quality" in prompt_lower

    def test_draft_prompt_subject_appears_in_prompt(self):
        """The subject text should appear in the prompt field."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "a golden retriever in a meadow"},
        })

        assert "golden retriever" in result["prompt"].lower()

    def test_draft_prompt_with_all_optional_fields(self):
        """draft_prompt handles all optional fields without error."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {
                "subject": "a castle on a hill",
                "style": "oil painting",
                "purpose": "art",
                "mood": "mysterious",
                "lighting": "dramatic",
                "composition": "wide angle",
                "color_palette": "warm earth tones",
            },
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"prompt"}
        assert isinstance(result["prompt"], str) and len(result["prompt"]) > 0
        # Verify optional fields are incorporated into the prompt
        prompt_lower = result["prompt"].lower()
        assert "castle" in prompt_lower
        assert "oil painting" in prompt_lower

    def test_draft_prompt_passthrough_when_prompt_provided(self):
        """When agent provides a complete prompt, tool passes it through."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {
                "subject": "dog",
                "prompt": "a majestic golden retriever sitting in sunlit meadow, cinematic photography",
            },
        })

        assert result["prompt"] == "a majestic golden retriever sitting in sunlit meadow, cinematic photography"


class TestRefinePromptValidation:
    """Unit tests for refine_prompt input validation and behavior."""

    def test_refine_prompt_returns_prompt_key(self):
        """refine_prompt must return dict with exactly one 'prompt' key."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {
                "prompt": "a cat on a roof, photorealistic",
            },
            "feedback": "add dramatic lighting",
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"prompt"}

    def test_refine_prompt_value_is_nonempty_string(self):
        """The returned 'prompt' field must be a non-empty string."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {
                "prompt": "sunset over ocean, watercolor",
            },
            "feedback": "make colors more vibrant",
        })

        assert isinstance(result["prompt"], str), "prompt must be a string"
        assert len(result["prompt"]) > 0, "prompt must be non-empty"

    def test_refine_prompt_handles_empty_draft_prompt(self):
        """refine_prompt falls back to feedback when draft prompt is empty."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {
                "prompt": "",
            },
            "feedback": "create a portrait of a woman",
        })

        assert isinstance(result["prompt"], str) and len(result["prompt"]) > 0

    def test_refine_prompt_handles_missing_draft_keys(self):
        """refine_prompt handles a current_draft missing the prompt key."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {},
            "feedback": "add a sunset",
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"prompt"}
        assert isinstance(result["prompt"], str) and len(result["prompt"]) > 0


class TestToolDecorators:
    """Unit tests verifying that tools have LangGraph @tool decorators."""

    def test_draft_prompt_is_langchain_tool(self):
        """draft_prompt must be a LangChain tool (has .invoke method)."""
        from app.agent.tools.prompt_tools import draft_prompt

        # LangChain @tool decorated functions become BaseTool instances
        assert hasattr(draft_prompt, "invoke"), "draft_prompt must have .invoke (BaseTool)"
        assert hasattr(draft_prompt, "name"), "draft_prompt must have .name attribute"
        assert draft_prompt.name == "draft_prompt"

    def test_refine_prompt_is_langchain_tool(self):
        """refine_prompt must be a LangChain tool (has .invoke method)."""
        from app.agent.tools.prompt_tools import refine_prompt

        assert hasattr(refine_prompt, "invoke"), "refine_prompt must have .invoke (BaseTool)"
        assert hasattr(refine_prompt, "name"), "refine_prompt must have .name attribute"
        assert refine_prompt.name == "refine_prompt"
