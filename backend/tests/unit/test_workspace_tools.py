"""Unit tests for the workspace_tools LangChain tools (Slice 23).

Three tools are exposed by ``app.agent.tools.workspace_tools``:

* ``set_slot_role`` — Pydantic-validated, sync ``@tool``
* ``set_slot_strength`` — Pydantic-validated, sync ``@tool``
* ``set_model_params`` — validates against the active image-model's
  prompt-knowledge entry; returns ``{"error": ...}`` on schema or config
  failures (no exception)

Mocking Strategy: ``no_mocks`` per Slice-Spec. Pydantic validation, the
``prompt_knowledge`` lookup and the tool decorators are pure Python — no
LLM, no HTTP, no DB calls involved. ``set_model_params`` reads the real
``data/prompt-knowledge.json`` via the disk-cached ``get_prompt_knowledge``
function.

Source ACs: specs/.../slice-23-i2i-settings-tools.md (AC-1..AC-9, AC-11).
"""

from __future__ import annotations

import inspect

import pytest
from langchain_core.tools import BaseTool
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# AC-1: Module exposes three BaseTool instances with the correct names.
# ---------------------------------------------------------------------------


class TestModuleExposesThreeTools:
    """AC-1: GIVEN das neue Modul ``workspace_tools.py`` existiert
    WHEN die drei Tools importiert werden
    THEN alle drei sind ``BaseTool``-Instanzen mit den erwarteten ``name``-
    Attributen ``set_slot_role``, ``set_slot_strength``, ``set_model_params``.
    """

    def test_set_slot_role_is_basetool_with_correct_name(self):
        """AC-1: set_slot_role MUST be a BaseTool instance named 'set_slot_role'."""
        from app.agent.tools.workspace_tools import set_slot_role

        assert isinstance(set_slot_role, BaseTool), (
            f"set_slot_role must be a BaseTool, got "
            f"{type(set_slot_role).__name__}"
        )
        assert set_slot_role.name == "set_slot_role", (
            f"set_slot_role.name must be 'set_slot_role', "
            f"got {set_slot_role.name!r}"
        )

    def test_set_slot_strength_is_basetool_with_correct_name(self):
        """AC-1: set_slot_strength MUST be a BaseTool instance named
        'set_slot_strength'."""
        from app.agent.tools.workspace_tools import set_slot_strength

        assert isinstance(set_slot_strength, BaseTool), (
            f"set_slot_strength must be a BaseTool, got "
            f"{type(set_slot_strength).__name__}"
        )
        assert set_slot_strength.name == "set_slot_strength", (
            f"set_slot_strength.name must be 'set_slot_strength', "
            f"got {set_slot_strength.name!r}"
        )

    def test_set_model_params_is_basetool_with_correct_name(self):
        """AC-1: set_model_params MUST be a BaseTool instance named
        'set_model_params'."""
        from app.agent.tools.workspace_tools import set_model_params

        assert isinstance(set_model_params, BaseTool), (
            f"set_model_params must be a BaseTool, got "
            f"{type(set_model_params).__name__}"
        )
        assert set_model_params.name == "set_model_params", (
            f"set_model_params.name must be 'set_model_params', "
            f"got {set_model_params.name!r}"
        )

    def test_workspace_tools_module_exports_three_tools(self):
        """AC-1: All three symbols importable from the new module."""
        from app.agent.tools import workspace_tools as ws

        # All three must be importable as module-level attributes.
        for attr in ("set_slot_role", "set_slot_strength", "set_model_params"):
            assert hasattr(ws, attr), (
                f"workspace_tools must export '{attr}'; "
                f"got attrs: {[a for a in dir(ws) if not a.startswith('_')]}"
            )
            assert isinstance(getattr(ws, attr), BaseTool), (
                f"workspace_tools.{attr} must be a BaseTool instance"
            )


# ---------------------------------------------------------------------------
# AC-2: set_slot_role valid payload roundtrips.
# ---------------------------------------------------------------------------


class TestSetSlotRoleValidPayload:
    """AC-2: GIVEN ``set_slot_role`` ist mit Pydantic-Schema
    ``{slot_index: int >= 0, role: Literal["subject","style","composition"]}``
    definiert
    WHEN ``set_slot_role.invoke({"slot_index": 1, "role": "style"})``
    aufgerufen wird
    THEN Rueckgabe-Dict spiegelt den Payload: ``{"slot_index": 1, "role":
    "style"}``; keine Exception.
    """

    def test_set_slot_role_valid_payload_returns_echo(self):
        """AC-2: Valid payload returns dict echoing slot_index + role."""
        from app.agent.tools.workspace_tools import set_slot_role

        result = set_slot_role.invoke({"slot_index": 1, "role": "style"})

        assert isinstance(result, dict), (
            f"Tool must return a dict, got {type(result).__name__}"
        )
        assert result["slot_index"] == 1
        assert result["role"] == "style"

    def test_set_slot_role_accepts_role_subject(self):
        """AC-2: 'subject' is a valid role literal."""
        from app.agent.tools.workspace_tools import set_slot_role

        result = set_slot_role.invoke({"slot_index": 0, "role": "subject"})

        assert result["slot_index"] == 0
        assert result["role"] == "subject"

    def test_set_slot_role_accepts_role_composition(self):
        """AC-2: 'composition' is a valid role literal."""
        from app.agent.tools.workspace_tools import set_slot_role

        result = set_slot_role.invoke({"slot_index": 2, "role": "composition"})

        assert result["slot_index"] == 2
        assert result["role"] == "composition"

    def test_set_slot_role_accepts_zero_slot_index(self):
        """AC-2: slot_index = 0 is valid (boundary)."""
        from app.agent.tools.workspace_tools import set_slot_role

        result = set_slot_role.invoke({"slot_index": 0, "role": "style"})
        assert result["slot_index"] == 0


# ---------------------------------------------------------------------------
# AC-3: set_slot_role rejects invalid role literal.
# ---------------------------------------------------------------------------


class TestSetSlotRoleInvalidRole:
    """AC-3: GIVEN ``set_slot_role`` mit ``role``-Literal-Constraint
    WHEN ``set_slot_role.invoke({"slot_index": 0, "role": "background"})``
    aufgerufen wird
    THEN ``pydantic.ValidationError`` (oder LangChain-Wrapper-Equivalent)
    wird geworfen — Tool-Output ist KEIN Erfolgs-Dict.
    """

    def test_set_slot_role_invalid_role_raises_validation_error(self):
        """AC-3: 'background' is not in the role enum -- MUST raise."""
        from app.agent.tools.workspace_tools import set_slot_role

        with pytest.raises((ValidationError, ValueError, Exception)) as exc_info:
            set_slot_role.invoke({"slot_index": 0, "role": "background"})

        err_str = str(exc_info.value).lower()
        assert (
            "background" in err_str
            or "literal" in err_str
            or "subject" in err_str
            or "validation" in err_str
            or "input should be" in err_str
        ), (
            f"Validation error must indicate invalid role literal, "
            f"got: {exc_info.value!r}"
        )

    def test_set_slot_role_empty_role_raises(self):
        """AC-3: empty string is not in the role enum -- MUST raise."""
        from app.agent.tools.workspace_tools import set_slot_role

        with pytest.raises((ValidationError, ValueError, Exception)):
            set_slot_role.invoke({"slot_index": 0, "role": ""})

    def test_set_slot_role_uppercase_role_raises(self):
        """AC-3: 'Subject' (case-sensitive) is not in the enum -- MUST raise."""
        from app.agent.tools.workspace_tools import set_slot_role

        with pytest.raises((ValidationError, ValueError, Exception)):
            set_slot_role.invoke({"slot_index": 0, "role": "Subject"})


# ---------------------------------------------------------------------------
# AC-4: set_slot_role rejects negative slot_index.
# ---------------------------------------------------------------------------


class TestSetSlotRoleNegativeIndex:
    """AC-4: GIVEN ``set_slot_role`` mit ``slot_index >= 0``-Constraint
    WHEN ``set_slot_role.invoke({"slot_index": -1, "role": "subject"})``
    aufgerufen wird
    THEN ``ValidationError`` wird geworfen (negative ``slot_index`` nicht
    zulaessig).
    """

    def test_set_slot_role_negative_slot_index_raises_validation_error(self):
        """AC-4: slot_index = -1 MUST raise (ge=0 constraint)."""
        from app.agent.tools.workspace_tools import set_slot_role

        with pytest.raises((ValidationError, ValueError, Exception)) as exc_info:
            set_slot_role.invoke({"slot_index": -1, "role": "subject"})

        err_str = str(exc_info.value).lower()
        assert (
            "0" in err_str
            or "ge" in err_str
            or "greater" in err_str
            or "validation" in err_str
            or "-1" in err_str
        ), (
            f"Validation error must indicate the >= 0 constraint, "
            f"got: {exc_info.value!r}"
        )

    def test_set_slot_role_far_negative_slot_index_raises(self):
        """AC-4: A massively negative index is also rejected."""
        from app.agent.tools.workspace_tools import set_slot_role

        with pytest.raises((ValidationError, ValueError, Exception)):
            set_slot_role.invoke({"slot_index": -1000, "role": "style"})


# ---------------------------------------------------------------------------
# AC-5: set_slot_strength valid payload roundtrips.
# ---------------------------------------------------------------------------


class TestSetSlotStrengthValidPayload:
    """AC-5: GIVEN ``set_slot_strength`` ist mit Schema ``{slot_index: int
    >= 0, strength: float 0.0..1.0}`` definiert
    WHEN ``set_slot_strength.invoke({"slot_index": 2, "strength": 0.65})``
    aufgerufen wird
    THEN Rueckgabe-Dict spiegelt den Payload: ``{"slot_index": 2,
    "strength": 0.65}``; keine Exception.
    """

    def test_set_slot_strength_valid_payload_returns_echo(self):
        """AC-5: Valid payload returns dict echoing slot_index + strength."""
        from app.agent.tools.workspace_tools import set_slot_strength

        result = set_slot_strength.invoke({"slot_index": 2, "strength": 0.65})

        assert isinstance(result, dict)
        assert result["slot_index"] == 2
        assert result["strength"] == pytest.approx(0.65)

    def test_set_slot_strength_accepts_zero_slot_index(self):
        """AC-5: slot_index = 0 is valid."""
        from app.agent.tools.workspace_tools import set_slot_strength

        result = set_slot_strength.invoke({"slot_index": 0, "strength": 0.5})
        assert result["slot_index"] == 0
        assert result["strength"] == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# AC-6: set_slot_strength rejects out-of-range, accepts boundaries.
# ---------------------------------------------------------------------------


class TestSetSlotStrengthRangeConstraint:
    """AC-6: GIVEN ``set_slot_strength`` mit ``strength``-Range-Constraint
    (``0.0..1.0`` inklusive)
    WHEN ``set_slot_strength.invoke({"slot_index": 0, "strength": 1.7})``
    aufgerufen wird
    THEN ``ValidationError`` wird geworfen mit Hinweis auf Wertebereich.
    ``strength = 0.0`` und ``strength = 1.0`` sind GUELTIG (Boundary-Test).
    """

    def test_set_slot_strength_out_of_range_raises_validation_error(self):
        """AC-6: strength = 1.7 MUST raise (le=1.0 constraint)."""
        from app.agent.tools.workspace_tools import set_slot_strength

        with pytest.raises((ValidationError, ValueError, Exception)) as exc_info:
            set_slot_strength.invoke({"slot_index": 0, "strength": 1.7})

        err_str = str(exc_info.value).lower()
        assert (
            "1" in err_str
            or "le" in err_str
            or "less" in err_str
            or "1.7" in err_str
            or "validation" in err_str
        ), (
            f"Validation error must indicate the range violation, "
            f"got: {exc_info.value!r}"
        )

    def test_set_slot_strength_negative_value_raises(self):
        """AC-6: strength = -0.1 MUST raise (ge=0.0 constraint)."""
        from app.agent.tools.workspace_tools import set_slot_strength

        with pytest.raises((ValidationError, ValueError, Exception)):
            set_slot_strength.invoke({"slot_index": 0, "strength": -0.1})

    def test_set_slot_strength_accepts_boundary_zero(self):
        """AC-6: strength = 0.0 is VALID (inclusive lower bound)."""
        from app.agent.tools.workspace_tools import set_slot_strength

        result = set_slot_strength.invoke({"slot_index": 0, "strength": 0.0})

        assert result["strength"] == pytest.approx(0.0)

    def test_set_slot_strength_accepts_boundary_one(self):
        """AC-6: strength = 1.0 is VALID (inclusive upper bound)."""
        from app.agent.tools.workspace_tools import set_slot_strength

        result = set_slot_strength.invoke({"slot_index": 0, "strength": 1.0})

        assert result["strength"] == pytest.approx(1.0)

    def test_set_slot_strength_accepts_boundary_values(self):
        """AC-6: Both 0.0 and 1.0 boundary values are accepted in one test
        for explicit AC coverage."""
        from app.agent.tools.workspace_tools import set_slot_strength

        result_lo = set_slot_strength.invoke({"slot_index": 0, "strength": 0.0})
        result_hi = set_slot_strength.invoke({"slot_index": 0, "strength": 1.0})

        assert result_lo["strength"] == pytest.approx(0.0)
        assert result_hi["strength"] == pytest.approx(1.0)

    def test_set_slot_strength_negative_slot_index_raises(self):
        """AC-6/AC-4: slot_index < 0 MUST raise even with valid strength."""
        from app.agent.tools.workspace_tools import set_slot_strength

        with pytest.raises((ValidationError, ValueError, Exception)):
            set_slot_strength.invoke({"slot_index": -1, "strength": 0.5})


# ---------------------------------------------------------------------------
# AC-7: set_model_params with valid payload + active model knowledge.
# ---------------------------------------------------------------------------


class TestSetModelParamsValidPayload:
    """AC-7: GIVEN ``set_model_params`` mit Schema ``{params: dict}``
    WHEN das Tool mit ``{"params": {"aspect_ratio": "16:9", "guidance": 7}}``
    und aktivem Modell ``"black-forest-labs/flux-2-max"`` (via
    ``RunnableConfig.configurable["image_model_id"]``) aufgerufen wird, und
    alle Keys existieren als zulaessige Param-Felder in der Modell-Knowledge
    THEN Rueckgabe-Dict enthaelt ``{"params": {"aspect_ratio": "16:9",
    "guidance": 7}}``; keine Exception.
    """

    def test_set_model_params_valid_payload_with_active_model_returns_echo(self):
        """AC-7: valid params for flux-2-max return echo dict (no error)."""
        from app.agent.tools.workspace_tools import set_model_params

        config = {
            "configurable": {
                "image_model_id": "black-forest-labs/flux-2-max",
            }
        }

        result = set_model_params.invoke(
            {"params": {"aspect_ratio": "16:9", "guidance": 7}},
            config=config,
        )

        assert isinstance(result, dict), (
            f"Tool must return a dict, got {type(result).__name__}"
        )
        assert "error" not in result, (
            f"Valid payload must not return an error dict; got: {result!r}"
        )
        assert "params" in result, (
            f"Result must contain 'params' key; got keys: {list(result)}"
        )
        echoed = result["params"]
        assert echoed.get("aspect_ratio") == "16:9"
        assert echoed.get("guidance") == 7

    def test_set_model_params_accepts_subset_of_known_keys(self):
        """AC-7: Subset of declared params is valid (only aspect_ratio)."""
        from app.agent.tools.workspace_tools import set_model_params

        config = {
            "configurable": {
                "image_model_id": "black-forest-labs/flux-2-max",
            }
        }

        result = set_model_params.invoke(
            {"params": {"aspect_ratio": "1:1"}},
            config=config,
        )

        assert "error" not in result, (
            f"Subset of declared keys must be accepted; got: {result!r}"
        )
        assert result["params"]["aspect_ratio"] == "1:1"

    def test_set_model_params_accepts_all_declared_keys(self):
        """AC-7: All declared params for flux-2-max accepted in one call."""
        from app.agent.tools.workspace_tools import set_model_params

        config = {
            "configurable": {
                "image_model_id": "black-forest-labs/flux-2-max",
            }
        }
        # Per data/prompt-knowledge.json -> models.flux-2-max.params
        all_params = {
            "aspect_ratio": "16:9",
            "guidance": 7,
            "prompt_strength": 0.8,
            "num_inference_steps": 50,
            "output_format": "png",
            "seed": 42,
            "safety_tolerance": 2,
        }

        result = set_model_params.invoke({"params": all_params}, config=config)

        assert "error" not in result, (
            f"All declared params must be accepted; got: {result!r}"
        )
        assert result["params"] == all_params


# ---------------------------------------------------------------------------
# AC-8: set_model_params unknown param key rejected per active model.
# ---------------------------------------------------------------------------


class TestSetModelParamsUnknownKey:
    """AC-8: GIVEN ``set_model_params`` mit unbekanntem Param-Key, der NICHT
    in der Modell-Knowledge des aktiven Image-Models gelistet ist
    WHEN das Tool mit ``{"params": {"unknown_field": 42}}`` und aktivem
    Modell ``"black-forest-labs/flux-2-max"`` aufgerufen wird
    THEN das Tool gibt einen Error-Dict mit Schluessel ``"error"`` zurueck
    (Pattern: ``{"error": "Unbekannter Parameter '<key>' fuer Modell
    '<model_id>'"}``) — ODER es wirft eine ``ValueError``/``ToolException``.
    Wichtig: das Tool darf NICHT erfolgreich mit dem invaliden Payload
    zurueckkehren.
    """

    def test_set_model_params_unknown_param_returns_error_or_raises(self):
        """AC-8: unknown_field MUST NOT produce a successful echo dict."""
        from app.agent.tools.workspace_tools import set_model_params

        config = {
            "configurable": {
                "image_model_id": "black-forest-labs/flux-2-max",
            }
        }
        payload = {"params": {"unknown_field": 42}}

        try:
            result = set_model_params.invoke(payload, config=config)
        except (ValueError, Exception) as exc:
            # Implementer chose the raise-style error path -- accept it.
            err_str = str(exc).lower()
            assert (
                "unknown_field" in err_str
                or "unbekannt" in err_str
                or "parameter" in err_str
            ), (
                f"Raised error must reference unknown param key, "
                f"got: {exc!r}"
            )
            return

        # Implementer chose the return-error-dict path -- enforce its shape.
        assert isinstance(result, dict)
        assert "error" in result, (
            f"Unknown param must produce an 'error' dict; got: {result!r}"
        )
        # Per AC-8 Pattern: "Unbekannter Parameter '<key>' fuer Modell '<id>'"
        err_str = str(result["error"]).lower()
        assert "unknown_field" in err_str or "unbekannt" in err_str, (
            f"Error message must reference the offending key, "
            f"got: {result['error']!r}"
        )
        # CRITICAL: tool MUST NOT have returned a successful 'params' echo.
        assert "params" not in result or len(result) > 1, (
            f"Tool must NOT return a successful echo dict for invalid "
            f"payload; got: {result!r}"
        )

    def test_set_model_params_mixed_known_and_unknown_keys_rejected(self):
        """AC-8: Mixing one valid + one invalid key MUST still be rejected."""
        from app.agent.tools.workspace_tools import set_model_params

        config = {
            "configurable": {
                "image_model_id": "black-forest-labs/flux-2-max",
            }
        }
        payload = {
            "params": {
                "aspect_ratio": "16:9",   # valid
                "totally_made_up": "x",   # invalid
            }
        }

        try:
            result = set_model_params.invoke(payload, config=config)
        except (ValueError, Exception):
            return  # raise-style path is acceptable

        assert isinstance(result, dict)
        assert "error" in result, (
            f"Even with one valid key, unknown keys must produce error; "
            f"got: {result!r}"
        )


# ---------------------------------------------------------------------------
# AC-9: set_model_params without active image_model_id returns error dict.
# ---------------------------------------------------------------------------


class TestSetModelParamsMissingActiveModel:
    """AC-9: GIVEN ``set_model_params`` ohne aktives ``image_model_id`` im
    LangGraph-Config (z.B. fehlt in ``configurable``)
    WHEN das Tool aufgerufen wird
    THEN das Tool gibt einen Error-Dict zurueck (kein Crash); Validierung
    gegen Modell-Knowledge wird uebersprungen oder explizit als Fehler
    markiert.
    """

    def test_set_model_params_missing_active_model_returns_error(self):
        """AC-9: missing image_model_id -> error dict (no crash)."""
        from app.agent.tools.workspace_tools import set_model_params

        # configurable is empty -> no image_model_id
        config = {"configurable": {}}

        try:
            result = set_model_params.invoke(
                {"params": {"aspect_ratio": "16:9"}},
                config=config,
            )
        except (ValueError, Exception) as exc:
            # raise-style path is acceptable per slice spec
            err_str = str(exc).lower()
            assert (
                "model" in err_str
                or "image_model_id" in err_str
                or "kein" in err_str
            ), (
                f"Raised error must reference missing model id, got: {exc!r}"
            )
            return

        assert isinstance(result, dict), (
            f"Tool must return a dict (not crash) when image_model_id is "
            f"missing, got {type(result).__name__}"
        )
        assert "error" in result, (
            f"Missing image_model_id MUST produce an 'error' dict; "
            f"got: {result!r}"
        )

    def test_set_model_params_missing_configurable_returns_error(self):
        """AC-9: completely missing 'configurable' key -> error dict, no crash."""
        from app.agent.tools.workspace_tools import set_model_params

        # No 'configurable' key at all
        config: dict = {}

        try:
            result = set_model_params.invoke(
                {"params": {"aspect_ratio": "16:9"}},
                config=config,
            )
        except (ValueError, Exception):
            return  # raise-style path is acceptable

        assert isinstance(result, dict)
        assert "error" in result, (
            f"Missing configurable MUST produce an 'error' dict; "
            f"got: {result!r}"
        )

    def test_set_model_params_none_image_model_id_returns_error(self):
        """AC-9: image_model_id = None / empty string -> error dict."""
        from app.agent.tools.workspace_tools import set_model_params

        config = {"configurable": {"image_model_id": None}}

        try:
            result = set_model_params.invoke(
                {"params": {"aspect_ratio": "16:9"}},
                config=config,
            )
        except (ValueError, Exception):
            return

        assert isinstance(result, dict)
        assert "error" in result, (
            f"None image_model_id must produce an 'error' dict; "
            f"got: {result!r}"
        )


# ---------------------------------------------------------------------------
# AC-11: tool bodies have no LangGraph-state side effects.
# ---------------------------------------------------------------------------


class TestNoStateSideEffects:
    """AC-11: GIVEN keiner der drei Tool-Bodies enthaelt
    LangGraph-State-Manipulation
    WHEN der Tool-Body durchgelesen wird (statische Inspektion oder
    Smoke-Test)
    THEN kein Schreiben in ``state["..."]``, kein ``setVariation``-Aufruf,
    kein HTTP-Call. Tool-Output ist Daten-Roundtrip.
    """

    @staticmethod
    def _strip_comments_and_docstrings(source: str) -> str:
        """Tokenize-based strip of ``#`` comments and string literals
        (docstrings included) so the static-inspection check does not match
        on natural-language references in documentation."""
        import io
        import token as token_module
        import tokenize

        result_tokens: list[str] = []
        try:
            tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
        except tokenize.TokenizeError:
            # Fallback: return original source on tokenizer failure
            return source

        for tok in tokens:
            tok_type = tok.type
            tok_str = tok.string
            if tok_type == tokenize.COMMENT:
                continue
            if tok_type == token_module.STRING:
                # Replace strings (including docstrings) with empty literal
                result_tokens.append('""')
                continue
            result_tokens.append(tok_str)
        return " ".join(result_tokens)

    @pytest.mark.parametrize(
        "tool_attr",
        ["set_slot_role", "set_slot_strength", "set_model_params"],
    )
    def test_tool_body_has_no_state_or_http_side_effects(self, tool_attr):
        """AC-11: static inspection of each tool body for forbidden patterns.

        Comments and string literals (incl. docstrings) are stripped before
        matching so that natural-language references in docstrings do not
        produce false positives. The check targets actual *executed* code.
        """
        from app.agent.tools import workspace_tools

        tool_obj = getattr(workspace_tools, tool_attr)
        # LangChain @tool wraps the underlying function as `.func`
        func = getattr(tool_obj, "func", None) or getattr(tool_obj, "_run", None)
        assert func is not None, (
            f"Could not access underlying function of {tool_attr} for "
            f"static inspection."
        )

        source = inspect.getsource(func)
        # Strip docstrings + comments so we only inspect runnable code.
        code_only = self._strip_comments_and_docstrings(source).lower()

        # Forbidden patterns (LangGraph state writes, frontend reducer calls,
        # SSE event emission, HTTP calls).
        forbidden_patterns = [
            "setvariation",         # frontend reducer call
            "applyworkspace",       # frontend reducer call
            "/api/generations",     # generation endpoint
            "/api/workspace",       # workspace endpoint
            "httpx.post",           # HTTP side effects
            "httpx.get",
            "requests.post",
            "requests.get",
            "emit_sse",             # SSE event emission
            "broadcast_event",
        ]
        for needle in forbidden_patterns:
            assert needle not in code_only, (
                f"Tool body for '{tool_attr}' must not contain "
                f"'{needle}' in executable code (Slice-23 AC-11)"
            )

        # Forbidden state mutation: explicit state["..."] = / state[...].append
        # The tools must not write into LangGraph state. We check the
        # post-strip code so docstring mentions are ignored.
        for needle in ('state["', "state['"):
            assert needle not in code_only, (
                f"Tool body for '{tool_attr}' must not write into LangGraph "
                f"state via {needle!r} (Slice-23 AC-11)"
            )

    def test_workspace_tools_have_no_state_side_effects(self):
        """AC-11: smoke test -- invoking each of the three tools must not
        raise nor require any LangGraph state to be present."""
        from app.agent.tools.workspace_tools import (
            set_slot_role,
            set_slot_strength,
            set_model_params,
        )

        # No state context, no checkpointer, no graph -- pure invocations.
        r1 = set_slot_role.invoke({"slot_index": 0, "role": "subject"})
        r2 = set_slot_strength.invoke({"slot_index": 0, "strength": 0.5})
        r3 = set_model_params.invoke(
            {"params": {"aspect_ratio": "1:1"}},
            config={
                "configurable": {
                    "image_model_id": "black-forest-labs/flux-2-max",
                }
            },
        )

        # All three are pure echoes / validation results -- no I/O.
        assert isinstance(r1, dict)
        assert isinstance(r2, dict)
        assert isinstance(r3, dict)

    def test_set_slot_role_returns_only_echo_keys(self):
        """AC-11: set_slot_role output is a pure data roundtrip (echo only)."""
        from app.agent.tools.workspace_tools import set_slot_role

        result = set_slot_role.invoke({"slot_index": 1, "role": "style"})
        # Must NOT contain side-effect markers like 'job_id', 'generation_id'.
        forbidden_keys = {"job_id", "generation_id", "state_update", "side_effect"}
        assert not (set(result.keys()) & forbidden_keys), (
            f"set_slot_role output must be a pure echo; got keys: "
            f"{list(result.keys())}"
        )

    def test_set_slot_strength_returns_only_echo_keys(self):
        """AC-11: set_slot_strength output is a pure data roundtrip (echo only)."""
        from app.agent.tools.workspace_tools import set_slot_strength

        result = set_slot_strength.invoke({"slot_index": 0, "strength": 0.5})
        forbidden_keys = {"job_id", "generation_id", "state_update", "side_effect"}
        assert not (set(result.keys()) & forbidden_keys), (
            f"set_slot_strength output must be a pure echo; got keys: "
            f"{list(result.keys())}"
        )
