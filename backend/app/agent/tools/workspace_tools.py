"""LangGraph workspace-mutation tools for the Prompt Assistant (Slice 23).

Three tools that allow the assistant to express *intended* workspace mutations
during the interview:

* ``set_slot_role`` — pick a role ("subject" / "style" / "composition") for a
  given reference-bar slot.
* ``set_slot_strength`` — pick a strength (0.0..1.0) for a slot.
* ``set_model_params`` — propose a ``modelParams`` dict; keys are validated
  against the active image-model's prompt-knowledge entry (where available).

Important: tool bodies are pure data roundtrips. They do NOT manipulate
LangGraph state, do NOT make HTTP calls, and do NOT trigger generation. The
SSE emitter in ``assistant_service.py`` automatically streams the tool result
to the frontend, where the SSE handler (Slice 24) dispatches reducer actions
and calls ``setVariation``. The UI is the authoritative slot owner — see
``architecture.md → Open Decisions Q17``.

The three tools intentionally mirror the decorator + Pydantic-args pattern
used by ``emit_intent_summary`` (Slice 13) and the keyword/return shape used
by ``model_tools.py``: validation errors raise ``ValidationError`` (Pydantic
default for ``set_slot_*``), schema-lookup or knowledge errors return a dict
with an ``"error"`` key (matching ``recommend_model`` / ``get_model_info``).
"""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field

from app.agent.prompt_knowledge import get_prompt_knowledge

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic input schemas
# ---------------------------------------------------------------------------


class SetSlotRoleInput(BaseModel):
    """Input schema for ``set_slot_role``.

    Mirrors ``architecture.md → API Endpoints → LangGraph Tool Schemas``
    (line 99) and ``architecture.md → Validation Rules`` (line 343):

    * ``slot_index``: zero-based index of the reference-bar slot (>= 0).
    * ``role``: one of ``"subject"``, ``"style"``, ``"composition"``.
    """

    model_config = ConfigDict(extra="forbid")

    slot_index: int = Field(
        ...,
        ge=0,
        description="Zero-based reference-bar slot index.",
    )
    role: Literal["subject", "style", "composition"] = Field(
        ...,
        description=(
            "Slot role to assign. One of 'subject', 'style', 'composition'."
        ),
    )


class SetSlotStrengthInput(BaseModel):
    """Input schema for ``set_slot_strength``.

    Mirrors ``architecture.md → API Endpoints → LangGraph Tool Schemas``
    (line 100) and ``architecture.md → Validation Rules`` (line 344):

    * ``slot_index``: zero-based index of the reference-bar slot (>= 0).
    * ``strength``: float in the inclusive range ``[0.0, 1.0]``.
    """

    model_config = ConfigDict(extra="forbid")

    slot_index: int = Field(
        ...,
        ge=0,
        description="Zero-based reference-bar slot index.",
    )
    strength: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Slot strength in the inclusive range 0.0..1.0.",
    )


class SetModelParamsInput(BaseModel):
    """Input schema for ``set_model_params``.

    Mirrors ``architecture.md → API Endpoints → LangGraph Tool Schemas``
    (line 101) and ``architecture.md → Validation Rules`` (line 345):

    * ``params``: free-form dict; keys are validated at tool-call time
      against the active image-model's prompt-knowledge entry (if a
      params-schema is declared there).
    """

    model_config = ConfigDict(extra="forbid")

    params: dict[str, Any] = Field(
        ...,
        description=(
            "Model-parameter map. Keys must exist in the active image "
            "model's prompt-knowledge params schema (where defined)."
        ),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _allowed_param_keys(model_knowledge: dict) -> Optional[set[str]]:
    """Return the set of allowed param keys for a model, or ``None`` if no
    params schema is declared for this model.

    Looks for, in order, a ``params`` or ``knobs`` field on the inner
    ``model`` dict returned by ``get_prompt_knowledge``. The container may be
    either a list of allowed key names or a dict (key -> spec). When neither
    field is present, we cannot validate and return ``None`` so callers can
    decide whether to be permissive or strict.

    Args:
        model_knowledge: The inner ``"model"`` dict from
            ``get_prompt_knowledge(...)`` when ``kind == "model"``.

    Returns:
        A set of allowed key names, or ``None`` when no schema is declared.
    """
    for field_name in ("params", "knobs"):
        container = model_knowledge.get(field_name)
        if container is None:
            continue
        if isinstance(container, dict):
            return set(container.keys())
        if isinstance(container, list):
            keys: set[str] = set()
            for entry in container:
                if isinstance(entry, str):
                    keys.add(entry)
                elif isinstance(entry, dict):
                    name = entry.get("key") or entry.get("name")
                    if isinstance(name, str):
                        keys.add(name)
            return keys
    return None


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------


@tool("set_slot_role", args_schema=SetSlotRoleInput)
def set_slot_role(slot_index: int, role: str) -> dict:
    """Assign a role to a reference-bar slot in the active workspace.

    This tool only emits the *intended* slot-role assignment via the SSE
    ``tool-result`` event; the frontend reducer (Slice 24) is responsible
    for applying the change to the workspace via ``setVariation``. The tool
    body itself does NOT mutate LangGraph state and performs no I/O — see
    ``architecture.md → Open Decisions Q17``.

    Use this tool during the multi-reference interview when you have
    determined the role of a specific reference image (e.g. "this slot is
    the subject", "this slot drives the style").

    Args:
        slot_index: Zero-based slot index in the reference bar.
        role: One of ``"subject"``, ``"style"``, or ``"composition"``.

    Returns:
        Dict echoing the validated payload: ``{"slot_index": int,
        "role": str}``.
    """
    logger.info(
        "set_slot_role: slot_index=%d role=%s",
        slot_index,
        role,
    )
    return {"slot_index": slot_index, "role": role}


@tool("set_slot_strength", args_schema=SetSlotStrengthInput)
def set_slot_strength(slot_index: int, strength: float) -> dict:
    """Set the strength of a reference-bar slot in the active workspace.

    This tool only emits the *intended* slot-strength value via the SSE
    ``tool-result`` event; the frontend reducer (Slice 24) is responsible
    for applying the change to the workspace via ``setVariation``. The tool
    body itself does NOT mutate LangGraph state and performs no I/O — see
    ``architecture.md → Open Decisions Q17``.

    Use this tool during the multi-reference interview when you have
    determined how strongly a specific reference image should influence the
    final generation (0.0 = no influence, 1.0 = maximum influence).

    Args:
        slot_index: Zero-based slot index in the reference bar.
        strength: Strength in the inclusive range ``[0.0, 1.0]``.

    Returns:
        Dict echoing the validated payload: ``{"slot_index": int,
        "strength": float}``.
    """
    logger.info(
        "set_slot_strength: slot_index=%d strength=%.4f",
        slot_index,
        strength,
    )
    return {"slot_index": slot_index, "strength": strength}


@tool("set_model_params", args_schema=SetModelParamsInput)
def set_model_params(
    params: dict[str, Any],
    config: RunnableConfig = None,
) -> dict:
    """Propose updated model parameters for the active workspace variation.

    The active image-model identifier is read from
    ``RunnableConfig.configurable["image_model_id"]`` (same pattern as the
    LLM-binding code in ``graph.py``). When the active model declares a
    parameter schema in ``prompt-knowledge.json`` (under ``params`` or
    ``knobs``), all proposed keys are validated against it; unknown keys
    cause the tool to return an error dict (no exception, consistent with
    ``recommend_model`` / ``get_model_info``).

    When no active model is set, or when the model's knowledge entry does
    not declare a params schema, the tool defers to the frontend reducer:
    in the latter case keys are accepted as-is (permissive); in the former
    case an error dict is returned so the assistant can retry or ask the
    user (see ``architecture.md → Risks & Mitigations``, line 645).

    The tool body itself does NOT mutate LangGraph state and performs no
    HTTP calls — the SSE emitter in ``assistant_service.py`` streams the
    tool-result to the frontend, where Slice 24's SSE handler applies the
    change via reducer + ``setVariation``.

    Args:
        params: Map of model-parameter keys to proposed values.

    Returns:
        On success: dict echoing the validated payload (``{"params": {...}}``).
        On failure: dict with an ``"error"`` key describing the issue.
    """
    # Step 1: Resolve the active image_model_id from the runnable config.
    configurable: dict = {}
    if config and isinstance(config, dict):
        configurable = config.get("configurable") or {}
    image_model_id: Optional[str] = configurable.get("image_model_id")

    if not image_model_id:
        logger.error(
            "set_model_params: no active image_model_id in RunnableConfig"
        )
        return {
            "error": (
                "Kein aktives Image-Model gesetzt — Parameter koennen nicht "
                "validiert werden."
            )
        }

    # Step 2: Look up the model's prompt-knowledge entry (cached, sync).
    try:
        knowledge = get_prompt_knowledge(image_model_id)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "set_model_params: knowledge lookup failed for '%s': %s",
            image_model_id,
            exc,
        )
        return {
            "error": (
                f"Modell-Knowledge fuer '{image_model_id}' konnte nicht "
                "geladen werden."
            )
        }

    # Step 3: Determine the set of allowed param keys, if a schema exists.
    allowed_keys: Optional[set[str]] = None
    if knowledge.get("kind") == "model":
        model_knowledge = knowledge.get("model") or {}
        allowed_keys = _allowed_param_keys(model_knowledge)

    # Step 4: Validate proposed keys against the schema (when one exists).
    if allowed_keys is not None:
        for key in params.keys():
            if key not in allowed_keys:
                logger.error(
                    "set_model_params: unknown param '%s' for model '%s' "
                    "(allowed: %s)",
                    key,
                    image_model_id,
                    sorted(allowed_keys),
                )
                return {
                    "error": (
                        f"Unbekannter Parameter '{key}' fuer Modell "
                        f"'{image_model_id}'"
                    )
                }
    # When allowed_keys is None (no schema declared / fallback knowledge)
    # we accept the params as-is; frontend reducer will perform the
    # ultimate apply. This matches the architecture's intent: validation is
    # advisory, the UI is the authoritative state owner.

    logger.info(
        "set_model_params: accepted %d param(s) for model '%s' (schema=%s)",
        len(params),
        image_model_id,
        "declared" if allowed_keys is not None else "permissive",
    )
    return {"params": dict(params)}
