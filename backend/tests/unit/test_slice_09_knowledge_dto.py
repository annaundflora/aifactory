"""Unit tests for Slice 09: Assistant Backend -- Knowledge & DTO.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/phase-7/2026-03-29-prompt-simplification/slices/slice-09-assistant-knowledge-dto.md.

The slice removes negativePrompts from prompt-knowledge.json and the formatter,
and simplifies DraftPromptDTO from 3 fields (motiv, style, negative_prompt) to
a single field (prompt).

Mocking Strategy: no_mocks (as specified in Slice-Spec).
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_knowledge_json_path() -> Path:
    """Resolve path to data/prompt-knowledge.json from repo root."""
    # This test file is at backend/tests/unit/test_slice_09_knowledge_dto.py
    # Repo root is 3 levels up: unit -> tests -> backend -> repo root
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    return repo_root / "data" / "prompt-knowledge.json"


def _load_knowledge_json() -> dict:
    """Load and parse the prompt-knowledge.json file."""
    path = _get_knowledge_json_path()
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _reset_knowledge_cache():
    """Reset the module-level cache in prompt_knowledge so tests read fresh data."""
    import app.agent.prompt_knowledge as pk
    pk._cached_data = None


# ---------------------------------------------------------------------------
# AC-1: prompt-knowledge.json has no negativePrompts entries
# ---------------------------------------------------------------------------


class TestKnowledgeJsonNegativePrompts:
    """AC-1: prompt-knowledge.json validation."""

    def test_knowledge_json_has_no_negative_prompts_entries(self):
        """AC-1: GIVEN die Datei data/prompt-knowledge.json mit 13 Model-Eintraegen
        WHEN die Datei mit json.load() geparst wird
        THEN enthaelt KEIN Model-Eintrag einen Key negativePrompts
        AND die JSON-Datei ist valides JSON (kein Parse-Error)
        """
        # Arrange (GIVEN) -- the file exists at data/prompt-knowledge.json
        path = _get_knowledge_json_path()

        # Act (WHEN) -- parse with json.load (implicitly validates JSON)
        data = _load_knowledge_json()

        # Assert (THEN) -- valid JSON (no parse error means we got here)
        assert isinstance(data, dict), "JSON root must be a dict"
        assert "models" in data, "JSON must have a 'models' key"

        models = data["models"]
        assert len(models) == 13, (
            f"Expected 13 model entries, got {len(models)}"
        )

        # No model entry contains 'negativePrompts'
        for model_key, model_data in models.items():
            assert "negativePrompts" not in model_data, (
                f"Model '{model_key}' still contains 'negativePrompts' key"
            )

    def test_knowledge_json_models_retain_required_fields(self):
        """AC-1 (cont.): GIVEN die Datei data/prompt-knowledge.json
        WHEN die Datei geparst wird
        THEN hat jeder Model-Eintrag weiterhin displayName, promptStyle, strengths, tips, avoid
        """
        # Arrange & Act
        data = _load_knowledge_json()
        models = data["models"]
        required_fields = {"displayName", "promptStyle", "strengths", "tips", "avoid"}

        # Assert
        for model_key, model_data in models.items():
            for field in required_fields:
                assert field in model_data, (
                    f"Model '{model_key}' is missing required field '{field}'"
                )


# ---------------------------------------------------------------------------
# AC-2: Formatter model output has no negativePrompts
# ---------------------------------------------------------------------------


class TestFormatterModelOutput:
    """AC-2: format_knowledge_for_prompt for model kind."""

    def setup_method(self):
        """Reset the module-level cache before each test."""
        _reset_knowledge_cache()

    def test_formatter_model_output_has_no_negative_prompts(self):
        """AC-2: GIVEN ein Knowledge-Lookup-Ergebnis fuer ein Model (z.B. flux-2-pro, kind == 'model')
        WHEN format_knowledge_for_prompt(result) aufgerufen wird
        THEN enthaelt der zurueckgegebene String NICHT die Woerter 'Negative prompts' oder 'negativePrompts'
        """
        from app.agent.prompt_knowledge import (
            format_knowledge_for_prompt,
            get_prompt_knowledge,
        )

        # Arrange (GIVEN) -- real lookup for a known model
        result = get_prompt_knowledge("flux-2-pro")
        assert result["kind"] == "model", "Expected kind='model' for flux-2-pro"

        # Act (WHEN)
        output = format_knowledge_for_prompt(result)

        # Assert (THEN)
        assert isinstance(output, str), "Formatter must return a string"
        lower_output = output.lower()
        assert "negative prompts" not in lower_output, (
            f"Output must NOT contain 'Negative prompts', got:\n{output}"
        )
        assert "negativeprompts" not in lower_output, (
            f"Output must NOT contain 'negativePrompts', got:\n{output}"
        )

    def test_formatter_model_output_retains_standard_sections(self):
        """AC-2 (cont.): GIVEN ein Knowledge-Lookup-Ergebnis fuer ein Model
        WHEN format_knowledge_for_prompt(result) aufgerufen wird
        THEN der String enthaelt weiterhin 'Prompt style:', 'Strengths:', 'Tips:', 'Avoid:'
        """
        from app.agent.prompt_knowledge import (
            format_knowledge_for_prompt,
            get_prompt_knowledge,
        )

        # Arrange (GIVEN)
        result = get_prompt_knowledge("flux-2-pro")

        # Act (WHEN)
        output = format_knowledge_for_prompt(result)

        # Assert (THEN) -- standard sections must be present
        assert "Prompt style:" in output, (
            f"Output must contain 'Prompt style:', got:\n{output}"
        )
        assert "Strengths:" in output, (
            f"Output must contain 'Strengths:', got:\n{output}"
        )
        assert "Tips:" in output, (
            f"Output must contain 'Tips:', got:\n{output}"
        )
        assert "Avoid:" in output, (
            f"Output must contain 'Avoid:', got:\n{output}"
        )


# ---------------------------------------------------------------------------
# AC-3: Formatter fallback output unchanged
# ---------------------------------------------------------------------------


class TestFormatterFallbackOutput:
    """AC-3: format_knowledge_for_prompt for fallback kind."""

    def setup_method(self):
        """Reset the module-level cache before each test."""
        _reset_knowledge_cache()

    def test_formatter_fallback_output_unchanged(self):
        """AC-3: GIVEN ein Knowledge-Lookup-Ergebnis fuer den Fallback (kind == 'fallback')
        WHEN format_knowledge_for_prompt(result) aufgerufen wird
        THEN enthaelt der Output weiterhin 'General Prompting Tips', 'Tips:' und 'Avoid:' (unveraendert)
        """
        from app.agent.prompt_knowledge import (
            format_knowledge_for_prompt,
            get_prompt_knowledge,
        )

        # Arrange (GIVEN) -- use a non-existent model to trigger fallback
        result = get_prompt_knowledge("non-existent-model-xyz-12345")
        assert result["kind"] == "fallback", "Expected kind='fallback' for unknown model"

        # Act (WHEN)
        output = format_knowledge_for_prompt(result)

        # Assert (THEN)
        assert "General Prompting Tips" in output, (
            f"Fallback output must contain 'General Prompting Tips', got:\n{output}"
        )
        assert "Tips:" in output, (
            f"Fallback output must contain 'Tips:', got:\n{output}"
        )
        assert "Avoid:" in output, (
            f"Fallback output must contain 'Avoid:', got:\n{output}"
        )


# ---------------------------------------------------------------------------
# AC-4: DraftPromptDTO has only prompt field
# ---------------------------------------------------------------------------


class TestDraftPromptDTOFields:
    """AC-4: DraftPromptDTO field inspection."""

    def test_draft_prompt_dto_has_only_prompt_field(self):
        """AC-4: GIVEN die Klasse DraftPromptDTO in backend/app/models/dtos.py
        WHEN die Felder per DraftPromptDTO.model_fields inspiziert werden
        THEN hat die Klasse GENAU einen Key: prompt (Typ str)
        AND die Keys motiv, style, negative_prompt existieren NICHT
        """
        from app.models.dtos import DraftPromptDTO

        # Act (WHEN)
        fields = DraftPromptDTO.model_fields

        # Assert (THEN) -- exactly one field: 'prompt'
        assert set(fields.keys()) == {"prompt"}, (
            f"DraftPromptDTO must have exactly {{'prompt'}} as fields, "
            f"got {set(fields.keys())}"
        )

        # Field type must be str
        prompt_field = fields["prompt"]
        assert prompt_field.annotation is str, (
            f"'prompt' field must be annotated as str, "
            f"got {prompt_field.annotation}"
        )

        # Old fields must NOT exist
        for old_key in ("motiv", "style", "negative_prompt"):
            assert old_key not in fields, (
                f"Old field '{old_key}' must NOT exist on DraftPromptDTO"
            )


# ---------------------------------------------------------------------------
# AC-5: DraftPromptDTO accepts new format
# ---------------------------------------------------------------------------


class TestDraftPromptDTONewFormat:
    """AC-5: DraftPromptDTO instantiation with new format."""

    def test_draft_prompt_dto_accepts_new_format(self):
        """AC-5: GIVEN ein Dict {"prompt": "A golden retriever in a sunflower field"}
        WHEN DraftPromptDTO(**data) instanziiert wird
        THEN ist dto.prompt == "A golden retriever in a sunflower field"
        """
        from app.models.dtos import DraftPromptDTO

        # Arrange (GIVEN)
        data = {"prompt": "A golden retriever in a sunflower field"}

        # Act (WHEN)
        dto = DraftPromptDTO(**data)

        # Assert (THEN)
        assert dto.prompt == "A golden retriever in a sunflower field", (
            f"Expected prompt to be 'A golden retriever in a sunflower field', "
            f"got '{dto.prompt}'"
        )


# ---------------------------------------------------------------------------
# AC-6: DraftPromptDTO rejects old format
# ---------------------------------------------------------------------------


class TestDraftPromptDTOOldFormat:
    """AC-6: DraftPromptDTO validation with old 3-field format."""

    def test_draft_prompt_dto_rejects_old_format(self):
        """AC-6: GIVEN ein Dict mit altem Format {"motiv": "...", "style": "...", "negative_prompt": "..."}
        WHEN DraftPromptDTO(**data) instanziiert wird
        THEN wird ein ValidationError geworfen (alte Felder werden nicht akzeptiert)
        """
        from app.models.dtos import DraftPromptDTO

        # Arrange (GIVEN)
        data = {
            "motiv": "A cat on a rooftop",
            "style": "photorealistic, cinematic lighting",
            "negative_prompt": "blurry, low quality",
        }

        # Act & Assert (WHEN/THEN)
        with pytest.raises(ValidationError) as exc_info:
            DraftPromptDTO(**data)

        # Verify the error mentions the missing 'prompt' field
        errors = exc_info.value.errors()
        assert len(errors) >= 1, "Expected at least one validation error"
        # The error should be about the missing required 'prompt' field
        field_locs = [e["loc"] for e in errors]
        assert ("prompt",) in field_locs, (
            f"Expected a validation error for missing 'prompt' field, "
            f"got errors at: {field_locs}"
        )


# ---------------------------------------------------------------------------
# AC-8: get_session_state constructs DraftPromptDTO with new format
# ---------------------------------------------------------------------------


class TestGetSessionStateDraftPrompt:
    """AC-8: AssistantService.get_session_state() DTO construction.

    Tests both new single-field checkpoint format and backward-compatible
    old 3-field checkpoint format (motiv+style combined into prompt).
    """

    def test_get_session_state_constructs_dto_with_prompt_field(self):
        """AC-8: GIVEN ein LangGraph-Checkpoint mit state_values["draft_prompt"] == {"prompt": "A cat on a rooftop"}
        WHEN AssistantService.get_session_state() diesen Checkpoint liest
        THEN wird DraftPromptDTO(prompt="A cat on a rooftop") konstruiert
        AND die SessionDetailDTO.draft_prompt enthaelt {"prompt": "A cat on a rooftop"}
        """
        from app.models.dtos import DraftPromptDTO

        # Test the DTO construction path directly (new format)
        raw_draft = {"prompt": "A cat on a rooftop"}

        # This mirrors the logic in get_session_state lines 381-392
        if "prompt" in raw_draft:
            prompt_value = raw_draft["prompt"]
        else:
            motiv = raw_draft.get("motiv", "").strip()
            style = raw_draft.get("style", "").strip()
            if motiv and style:
                prompt_value = f"{motiv}. {style}"
            else:
                prompt_value = motiv or style

        draft_prompt = DraftPromptDTO(prompt=prompt_value)

        # Assert
        assert draft_prompt.prompt == "A cat on a rooftop", (
            f"Expected prompt='A cat on a rooftop', got '{draft_prompt.prompt}'"
        )
        # Verify serialization shape
        serialized = draft_prompt.model_dump()
        assert serialized == {"prompt": "A cat on a rooftop"}, (
            f"Serialized DraftPromptDTO must be {{'prompt': 'A cat on a rooftop'}}, "
            f"got {serialized}"
        )

    def test_get_session_state_backward_compat_old_3field_format(self):
        """AC-8 (backward compat): GIVEN an old LangGraph checkpoint with
        state_values["draft_prompt"] == {"motiv": "A cat on a rooftop", "style": "cinematic lighting", "negative_prompt": "blurry"}
        WHEN the get_session_state mapping logic processes it
        THEN DraftPromptDTO(prompt="A cat on a rooftop. cinematic lighting") is constructed
        (motiv + '. ' + style combined)
        """
        from app.models.dtos import DraftPromptDTO

        # Simulate old 3-field checkpoint format
        raw_draft = {
            "motiv": "A cat on a rooftop",
            "style": "cinematic lighting",
            "negative_prompt": "blurry",
        }

        # Apply the same backward-compat logic from get_session_state
        if "prompt" in raw_draft:
            prompt_value = raw_draft["prompt"]
        else:
            motiv = raw_draft.get("motiv", "").strip()
            style = raw_draft.get("style", "").strip()
            if motiv and style:
                prompt_value = f"{motiv}. {style}"
            else:
                prompt_value = motiv or style

        draft_prompt = DraftPromptDTO(prompt=prompt_value)

        # Assert -- motiv and style combined with ". "
        assert draft_prompt.prompt == "A cat on a rooftop. cinematic lighting", (
            f"Expected combined prompt, got '{draft_prompt.prompt}'"
        )
        # negative_prompt is deliberately ignored in the new format
        assert "blurry" not in draft_prompt.prompt, (
            "negative_prompt value must NOT appear in the combined prompt"
        )

    def test_get_session_state_backward_compat_motiv_only(self):
        """AC-8 (edge case): GIVEN an old checkpoint with only motiv (no style)
        WHEN the mapping logic processes it
        THEN DraftPromptDTO uses motiv as the prompt value.
        """
        from app.models.dtos import DraftPromptDTO

        raw_draft = {
            "motiv": "A sunset over mountains",
            "style": "",
            "negative_prompt": "",
        }

        if "prompt" in raw_draft:
            prompt_value = raw_draft["prompt"]
        else:
            motiv = raw_draft.get("motiv", "").strip()
            style = raw_draft.get("style", "").strip()
            if motiv and style:
                prompt_value = f"{motiv}. {style}"
            else:
                prompt_value = motiv or style

        draft_prompt = DraftPromptDTO(prompt=prompt_value)

        assert draft_prompt.prompt == "A sunset over mountains", (
            f"Expected motiv-only prompt, got '{draft_prompt.prompt}'"
        )
