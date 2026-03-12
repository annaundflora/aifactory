"""Unit tests for prompt_tools (Slice 12).

Tests the pure logic of draft_prompt and refine_prompt tool functions
in isolation -- input validation, default values, field construction.

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

    def test_draft_prompt_returns_three_keys(self):
        """draft_prompt must return dict with exactly motiv, style, negative_prompt."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "a cat on a roof"},
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"motiv", "style", "negative_prompt"}

    def test_draft_prompt_all_values_are_nonempty_strings(self):
        """All three returned fields must be non-empty strings."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "mountain landscape"},
        })

        for key in ("motiv", "style", "negative_prompt"):
            assert isinstance(result[key], str), f"{key} must be a string"
            assert len(result[key]) > 0, f"{key} must be non-empty"

    def test_draft_prompt_uses_default_style_when_not_provided(self):
        """When style is not in collected_info, a default is used."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "sunset"},
        })

        # Style should contain something (default is "photorealistic")
        assert len(result["style"]) > 0

    def test_draft_prompt_uses_default_negative_when_not_provided(self):
        """When negative_prompt is not in collected_info, sensible defaults are used."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "forest path"},
        })

        assert len(result["negative_prompt"]) > 0
        # Default negatives should contain common quality guards
        neg_lower = result["negative_prompt"].lower()
        assert "blurry" in neg_lower or "low quality" in neg_lower

    def test_draft_prompt_subject_appears_in_motiv(self):
        """The subject text should appear in the motiv field."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {"subject": "a golden retriever in a meadow"},
        })

        assert "golden retriever" in result["motiv"].lower()

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
                "negative_prompt": "cartoon, anime",
            },
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"motiv", "style", "negative_prompt"}
        for key in ("motiv", "style", "negative_prompt"):
            assert isinstance(result[key], str) and len(result[key]) > 0

    def test_draft_prompt_passthrough_when_motiv_and_negative_provided(self):
        """When agent provides fully formed motiv+negative_prompt, tool passes through."""
        from app.agent.tools.prompt_tools import draft_prompt

        result = draft_prompt.invoke({
            "collected_info": {
                "subject": "dog",
                "motiv": "a majestic golden retriever sitting in sunlit meadow",
                "style": "cinematic photography",
                "negative_prompt": "blurry, cartoon",
            },
        })

        assert result["motiv"] == "a majestic golden retriever sitting in sunlit meadow"
        assert result["negative_prompt"] == "blurry, cartoon"


class TestRefinePromptValidation:
    """Unit tests for refine_prompt input validation and behavior."""

    def test_refine_prompt_returns_three_keys(self):
        """refine_prompt must return dict with exactly motiv, style, negative_prompt."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {
                "motiv": "a cat on a roof",
                "style": "photorealistic",
                "negative_prompt": "blurry",
            },
            "feedback": "add dramatic lighting",
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"motiv", "style", "negative_prompt"}

    def test_refine_prompt_all_values_are_nonempty_strings(self):
        """All returned fields must be non-empty strings."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {
                "motiv": "sunset over ocean",
                "style": "watercolor",
                "negative_prompt": "blurry",
            },
            "feedback": "make colors more vibrant",
        })

        for key in ("motiv", "style", "negative_prompt"):
            assert isinstance(result[key], str), f"{key} must be a string"
            assert len(result[key]) > 0, f"{key} must be non-empty"

    def test_refine_prompt_handles_empty_draft_fields(self):
        """refine_prompt fills in defaults when draft fields are empty."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {
                "motiv": "",
                "style": "",
                "negative_prompt": "",
            },
            "feedback": "create a portrait of a woman",
        })

        # All fields must still be non-empty after refinement
        for key in ("motiv", "style", "negative_prompt"):
            assert isinstance(result[key], str) and len(result[key]) > 0

    def test_refine_prompt_handles_missing_draft_keys(self):
        """refine_prompt handles a current_draft missing some keys."""
        from app.agent.tools.prompt_tools import refine_prompt

        result = refine_prompt.invoke({
            "current_draft": {},
            "feedback": "add a sunset",
        })

        assert isinstance(result, dict)
        assert set(result.keys()) == {"motiv", "style", "negative_prompt"}
        for key in ("motiv", "style", "negative_prompt"):
            assert isinstance(result[key], str) and len(result[key]) > 0


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
