"""Unit tests for the emit_intent_summary LangChain tool (Slice 13).

Tests Pydantic schema validation, tool name/instance type, valid payload
roundtrip, validation error paths and absence of generation side-effects.

Mocking Strategy: no_mocks (per Slice-Spec). Tool schema + state mapping are
pure Python; no external services involved.

Source ACs: specs/.../slice-13-emit-intent-summary-tool.md (AC-1..AC-4, AC-7).
"""

import inspect

import pytest
from langchain_core.tools import BaseTool
from pydantic import BaseModel, ValidationError


# ---------------------------------------------------------------------------
# AC-1: Tool name + Pydantic schema shape
# ---------------------------------------------------------------------------


class TestToolNameAndSchemaShape:
    """AC-1: GIVEN das neue Tool ist in prompt_tools.py definiert
    WHEN sein name-Attribut und sein args_schema inspiziert werden
    THEN tool.name == 'emit_intent_summary'; das Pydantic-Schema enthaelt
    die Felder prompt: str (1..2000), settings_diff: SettingsDiff | None,
    model_id: str | None. Das Tool ist eine Instanz von
    langchain_core.tools.BaseTool.
    """

    def test_tool_name_is_emit_intent_summary(self):
        """AC-1: tool.name MUST equal 'emit_intent_summary'."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        assert emit_intent_summary.name == "emit_intent_summary"

    def test_tool_is_basetool_instance(self):
        """AC-1: Tool MUST be an instance of langchain_core.tools.BaseTool."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        assert isinstance(emit_intent_summary, BaseTool), (
            f"emit_intent_summary must be a BaseTool, got "
            f"{type(emit_intent_summary).__name__}"
        )

    def test_tool_has_args_schema(self):
        """AC-1: Tool MUST expose a Pydantic args_schema."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        schema = emit_intent_summary.args_schema
        assert schema is not None, "Tool must define args_schema"
        # args_schema is a Pydantic BaseModel subclass
        assert inspect.isclass(schema), "args_schema must be a class"
        assert issubclass(schema, BaseModel), (
            f"args_schema must be a Pydantic BaseModel subclass, got {schema}"
        )

    def test_args_schema_has_prompt_field(self):
        """AC-1: Schema MUST contain a 'prompt' field of type str."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        schema = emit_intent_summary.args_schema
        fields = schema.model_fields

        assert "prompt" in fields, (
            f"Schema must declare 'prompt' field, got fields={list(fields)}"
        )
        prompt_field = fields["prompt"]
        # Must be required (no default)
        assert prompt_field.is_required(), "prompt must be a required field"

    def test_prompt_field_has_min_length_1_max_length_2000(self):
        """AC-1: 'prompt' field MUST enforce 1..2000 chars."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        schema = emit_intent_summary.args_schema
        # Validate via the schema directly: extreme values
        # Empty prompt rejected (min_length=1)
        with pytest.raises(ValidationError):
            schema(prompt="")
        # 2001 chars rejected (max_length=2000)
        with pytest.raises(ValidationError):
            schema(prompt="x" * 2001)
        # 1 char accepted
        schema(prompt="a")
        # 2000 chars accepted
        schema(prompt="x" * 2000)

    def test_args_schema_has_settings_diff_field_optional(self):
        """AC-1: Schema MUST declare optional 'settings_diff' field."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        schema = emit_intent_summary.args_schema
        fields = schema.model_fields
        assert "settings_diff" in fields, (
            f"Schema must declare 'settings_diff' field, got fields={list(fields)}"
        )
        # settings_diff is optional - default None means it's not required
        assert not fields["settings_diff"].is_required(), (
            "settings_diff must be optional (default None)"
        )

    def test_args_schema_has_model_id_field_optional(self):
        """AC-1: Schema MUST declare optional 'model_id: str | None' field."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        schema = emit_intent_summary.args_schema
        fields = schema.model_fields
        assert "model_id" in fields, (
            f"Schema must declare 'model_id' field, got fields={list(fields)}"
        )
        assert not fields["model_id"].is_required(), (
            "model_id must be optional (default None)"
        )


# ---------------------------------------------------------------------------
# AC-2: Valid payload roundtrips
# ---------------------------------------------------------------------------


class TestValidPayloadRoundtrip:
    """AC-2: GIVEN ein gueltiger Payload {prompt, settings_diff, model_id}
    WHEN das Tool via tool.invoke(payload) aufgerufen wird
    THEN der Rueckgabewert ist ein Dict, das den eingegebenen Payload
    spiegelt (Schluessel prompt, settings_diff, model_id); keine Exception.
    """

    def test_valid_payload_invocation_returns_echo_dict(self):
        """AC-2: Valid payload returns a dict echoing prompt/settings_diff/model_id."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {
            "prompt": "A serene mountain landscape at sunset, photorealistic",
            "settings_diff": {
                "slotStrengths": [
                    {"slotIndex": 0, "from": None, "to": 0.8},
                ],
            },
            "model_id": "openai/gpt-5.4",
        }

        result = emit_intent_summary.invoke(payload)

        assert isinstance(result, dict), (
            f"Tool must return a dict, got {type(result).__name__}"
        )
        # Echo of prompt
        assert result["prompt"] == payload["prompt"]
        # model_id passed through
        assert result["model_id"] == "openai/gpt-5.4"
        # settings_diff is present (may be normalized via SettingsDiff serialization)
        assert "settings_diff" in result
        assert result["settings_diff"] is not None
        # Strength entry is preserved
        slot_strengths = result["settings_diff"].get("slotStrengths") or []
        assert len(slot_strengths) == 1
        assert slot_strengths[0]["slotIndex"] == 0
        assert slot_strengths[0]["to"] == 0.8

    def test_valid_payload_minimal_only_prompt(self):
        """AC-2: Minimal valid payload (prompt only) returns dict with all keys."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        result = emit_intent_summary.invoke({"prompt": "a cat on a roof"})

        assert isinstance(result, dict)
        assert result["prompt"] == "a cat on a roof"
        assert result["settings_diff"] is None
        assert result["model_id"] is None

    def test_valid_payload_with_full_settings_diff(self):
        """AC-2: Full SettingsDiff with all four sub-arrays is accepted."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {
            "prompt": "Detailed product photo on white background",
            "settings_diff": {
                "slotRoles": [
                    {"slotIndex": 0, "from": None, "to": "subject"},
                ],
                "slotStrengths": [
                    {"slotIndex": 0, "from": 0.5, "to": 0.7},
                ],
                "modelId": {"from": "flux-1-dev", "to": "flux-2-pro"},
                "modelParams": [
                    {"key": "guidance_scale", "from": 7.5, "to": 9.0},
                ],
            },
            "model_id": "flux-2-pro",
        }

        result = emit_intent_summary.invoke(payload)

        assert isinstance(result, dict)
        assert result["prompt"] == payload["prompt"]
        assert result["model_id"] == "flux-2-pro"
        diff = result["settings_diff"]
        assert diff is not None
        assert "slotRoles" in diff
        assert "slotStrengths" in diff
        assert "modelId" in diff
        assert "modelParams" in diff

    def test_valid_payload_with_2000_char_prompt(self):
        """AC-2: prompt at the max boundary (exactly 2000 chars) is accepted."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {"prompt": "x" * 2000}
        result = emit_intent_summary.invoke(payload)
        assert result["prompt"] == "x" * 2000


# ---------------------------------------------------------------------------
# AC-3: prompt > 2000 chars rejected
# ---------------------------------------------------------------------------


class TestPromptOverLimit:
    """AC-3: GIVEN ein Payload mit prompt = 'x' * 2001 (2001 Zeichen)
    WHEN das Tool via tool.invoke(payload) aufgerufen wird
    THEN ein pydantic.ValidationError (oder LangChain-Wrapper-Equivalent)
    wird geworfen; das Tool wird NICHT erfolgreich ausgefuehrt.
    """

    def test_prompt_over_2000_chars_raises_validation_error(self):
        """AC-3: 2001-char prompt MUST raise ValidationError (or LangChain equivalent)."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {"prompt": "x" * 2001}

        with pytest.raises((ValidationError, ValueError, Exception)) as exc_info:
            emit_intent_summary.invoke(payload)

        # Sanity: error message should reference length / max
        err_str = str(exc_info.value).lower()
        assert (
            "2000" in err_str
            or "max" in err_str
            or "length" in err_str
            or "string_too_long" in err_str
            or "validation" in err_str
        ), f"Validation error must indicate length issue, got: {exc_info.value!r}"

    def test_prompt_far_over_limit_raises(self):
        """AC-3: A massively over-limit prompt is also rejected."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {"prompt": "x" * 10_000}

        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke(payload)


# ---------------------------------------------------------------------------
# AC-4: empty prompt OR malformed settings_diff rejected
# ---------------------------------------------------------------------------


class TestInvalidPayloads:
    """AC-4: GIVEN ein Payload mit prompt='' ODER settings_diff
    {slotStrengths:[{slotIndex:0, from:null, to:1.7}]} (to > 1.0)
    WHEN tool.invoke(payload) aufgerufen wird
    THEN Pydantic-Validation schlaegt fehl; kein erfolgreicher Tool-Output.
    """

    def test_empty_prompt_raises_validation_error(self):
        """AC-4: Empty prompt MUST be rejected (min_length=1)."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke({"prompt": ""})

    def test_settings_diff_strength_out_of_range_raises_validation_error(self):
        """AC-4: slotStrengths[].to > 1.0 MUST be rejected."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {
            "prompt": "valid prompt",
            "settings_diff": {
                "slotStrengths": [
                    {"slotIndex": 0, "from": None, "to": 1.7},
                ],
            },
        }

        with pytest.raises((ValidationError, ValueError, Exception)) as exc_info:
            emit_intent_summary.invoke(payload)

        err_str = str(exc_info.value).lower()
        assert (
            "1" in err_str
            or "less than" in err_str
            or "le" in err_str
            or "1.7" in err_str
            or "validation" in err_str
        ), f"Error must indicate range violation, got: {exc_info.value!r}"

    def test_settings_diff_strength_negative_raises_validation_error(self):
        """AC-4: slotStrengths[].to < 0.0 MUST be rejected (range 0.0..1.0)."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {
            "prompt": "valid prompt",
            "settings_diff": {
                "slotStrengths": [
                    {"slotIndex": 0, "from": None, "to": -0.1},
                ],
            },
        }

        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke(payload)

    def test_settings_diff_negative_slot_index_raises(self):
        """AC-4: slotIndex < 0 MUST be rejected (>=0 constraint)."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {
            "prompt": "valid prompt",
            "settings_diff": {
                "slotStrengths": [
                    {"slotIndex": -1, "from": None, "to": 0.5},
                ],
            },
        }

        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke(payload)

    def test_settings_diff_invalid_slot_role_raises(self):
        """AC-4: slotRoles[].to outside enum MUST be rejected."""
        from app.agent.tools.prompt_tools import emit_intent_summary

        payload = {
            "prompt": "valid prompt",
            "settings_diff": {
                "slotRoles": [
                    {"slotIndex": 0, "from": None, "to": "not-a-valid-role"},
                ],
            },
        }

        with pytest.raises((ValidationError, ValueError, Exception)):
            emit_intent_summary.invoke(payload)


# ---------------------------------------------------------------------------
# AC-7: no generation side-effects
# ---------------------------------------------------------------------------


class TestNoGenerationSideEffects:
    """AC-7: GIVEN das Tool wurde NICHT mit Generierungs-Side-Effects
    implementiert
    WHEN der Tool-Body durchgelesen wird (statische Inspektion)
    THEN kein Aufruf an generateImages, kein HTTP-Request zu
    /api/generations, kein Workspace-Apply. Tool-Output ist ein reiner
    Daten-Roundtrip.
    """

    def test_tool_body_has_no_generation_side_effects(self):
        """AC-7: Static inspection -- tool body must not call generateImages,
        not POST to /api/generations, and not invoke workspace-apply.
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Get the underlying function (LangChain @tool wraps it)
        func = getattr(emit_intent_summary, "func", None) or getattr(
            emit_intent_summary, "_run", None
        )
        assert func is not None, "Could not access tool function for inspection"

        source = inspect.getsource(func)
        lower = source.lower()

        # Forbidden side-effects (per AC-7)
        forbidden = [
            "generateimages",
            "/api/generations",
            "generate_images",
            "workspace_apply",
            "applyworkspace",
        ]
        for needle in forbidden:
            assert needle.lower() not in lower, (
                f"Tool body must not contain '{needle}' (Slice-13 AC-7)"
            )

        # Forbidden HTTP-call patterns inside the tool body
        forbidden_http = ["httpx.post", "httpx.get", "requests.post", "requests.get"]
        for needle in forbidden_http:
            assert needle not in source, (
                f"Tool body must not perform HTTP calls ('{needle}'); "
                f"emit_intent_summary is a pure echo tool."
            )

    def test_tool_invoke_does_not_raise_when_called_in_isolation(self):
        """AC-7: Tool can be invoked stand-alone without any external services
        being available (proves it has no I/O side effects).
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        # Pure call with no patches/mocks/fixtures: if this passes, the tool
        # has no external dependency at runtime.
        result = emit_intent_summary.invoke(
            {
                "prompt": "no side effects test",
                "settings_diff": None,
                "model_id": None,
            }
        )

        assert result["prompt"] == "no side effects test"
        assert result["settings_diff"] is None
        assert result["model_id"] is None

    def test_tool_returns_pure_data_roundtrip(self):
        """AC-7: Output keys are exactly {prompt, settings_diff, model_id} --
        no extra fields hinting at side-effects (e.g. generation_id, job_id).
        """
        from app.agent.tools.prompt_tools import emit_intent_summary

        result = emit_intent_summary.invoke({"prompt": "roundtrip"})

        # Output must be a plain echo - no generation handles
        assert set(result.keys()) == {"prompt", "settings_diff", "model_id"}, (
            f"Tool must return exactly the echo keys; got {set(result.keys())}"
        )
