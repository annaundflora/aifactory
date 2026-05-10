"""LangGraph tools for prompt drafting, refinement, and intent finalization.

Provides draft_prompt, refine_prompt, and emit_intent_summary tools that the
agent uses to create, iteratively improve, and finalize image generation
prompts. Each tool returns a dict (echo of validated payload) and triggers
state-update logic in graph.post_process_node.

The LLM agent is responsible for the creative prompt engineering. These tools
serve as structured output wrappers that validate input, return the structured
dict, and trigger the post_process_node to update the graph state.

Important: ``emit_intent_summary`` is a pure data-roundtrip tool. It does NOT
trigger image generation, does NOT apply settings to the workspace, and does
NOT make any HTTP calls. The user click on the Intent-Summary-Card in the
frontend is the single gate that triggers Auto-Apply + Auto-Generate
(see Slice 17). This tool only emits the intent payload; the backend
``post_process_node`` then advances ``flow_state`` to ``"summarizing"`` and
persists the payload to ``final_intent``.
"""

from typing import Literal, Optional

from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# SettingsDiff sub-models
# ---------------------------------------------------------------------------
#
# Wire format mirrors ``architecture.md → SettingsDiff Type Schema``.
# The LLM tool-call schema therefore uses camelCase for ``SettingsDiff`` sub-
# fields (matching the published TypeScript type the frontend renders against).
# Top-level tool arguments stay snake_case (``settings_diff``, ``model_id``)
# to match the snake_case tool-arg shape documented in
# ``architecture.md → API Endpoints → LangGraph Tool Schemas``.


class SlotRoleDiff(BaseModel):
    """Single entry in ``SettingsDiff.slotRoles``."""

    model_config = ConfigDict(extra="forbid")

    slotIndex: int = Field(..., ge=0, description="Zero-based slot index.")
    from_: Optional[Literal["subject", "style", "composition"]] = Field(
        default=None,
        alias="from",
        description="Previous role assignment for this slot, or null if unset.",
    )
    to: Literal["subject", "style", "composition"] = Field(
        ...,
        description="New role assigned to this slot.",
    )


class SlotStrengthDiff(BaseModel):
    """Single entry in ``SettingsDiff.slotStrengths``."""

    model_config = ConfigDict(extra="forbid")

    slotIndex: int = Field(..., ge=0, description="Zero-based slot index.")
    from_: Optional[float] = Field(
        default=None,
        alias="from",
        ge=0.0,
        le=1.0,
        description="Previous strength value (0.0..1.0), or null if unset.",
    )
    to: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="New strength value (0.0..1.0).",
    )


class ModelIdDiff(BaseModel):
    """``SettingsDiff.modelId`` — single transition object."""

    model_config = ConfigDict(extra="forbid")

    from_: str = Field(
        ...,
        alias="from",
        description="Previous model identifier.",
    )
    to: str = Field(..., description="New model identifier.")


class ModelParamDiff(BaseModel):
    """Single entry in ``SettingsDiff.modelParams``."""

    model_config = ConfigDict(extra="forbid")

    key: str = Field(..., min_length=1, description="Parameter key.")
    from_: object = Field(
        default=None,
        alias="from",
        description="Previous parameter value (any JSON type, or null if unset).",
    )
    to: object = Field(..., description="New parameter value (any JSON type).")


class SettingsDiff(BaseModel):
    """Typed diff payload for ``emit_intent_summary.settings_diff``.

    All four sub-arrays are optional; if no settings changed, the entire
    ``settings_diff`` field is omitted from the parent payload.

    Wire format follows ``architecture.md → SettingsDiff Type Schema`` —
    camelCase keys to match the frontend TypeScript type.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    slotRoles: Optional[list[SlotRoleDiff]] = Field(
        default=None,
        description="Role-assignment changes per slot.",
    )
    slotStrengths: Optional[list[SlotStrengthDiff]] = Field(
        default=None,
        description="Strength-value changes per slot.",
    )
    modelId: Optional[ModelIdDiff] = Field(
        default=None,
        description="Active-model identifier transition (only set if model changed).",
    )
    modelParams: Optional[list[ModelParamDiff]] = Field(
        default=None,
        description="Per-key model-parameter changes.",
    )


# ---------------------------------------------------------------------------
# emit_intent_summary input schema
# ---------------------------------------------------------------------------


class EmitIntentSummaryInput(BaseModel):
    """Input schema for the ``emit_intent_summary`` tool.

    Mirrors ``architecture.md → API Endpoints → LangGraph Tool Schemas`` and
    ``architecture.md → Validation Rules``:

    * ``prompt``: non-empty, max 2000 characters
    * ``settings_diff``: optional, must match ``SettingsDiff`` schema if present
    * ``model_id``: optional active-model identifier
    """

    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description=(
            "Final image-generation prompt in English. Non-empty, "
            "max 2000 characters."
        ),
    )
    settings_diff: Optional[SettingsDiff] = Field(
        default=None,
        description=(
            "Typed diff of settings changes accumulated during the interview. "
            "Omit when no settings changed."
        ),
    )
    model_id: Optional[str] = Field(
        default=None,
        description="Optional active-model identifier (e.g. 'flux-2-pro').",
    )


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------


@tool
def draft_prompt(collected_info: dict) -> dict:
    """Create an image generation prompt from collected information.

    Takes the information gathered during conversation (subject, style, purpose, mood, etc.)
    and produces a single prompt string. All prompt text must be in English regardless of
    the conversation language.

    The collected_info dict must contain at least a 'subject' key. Additional keys like
    'style', 'purpose', 'mood', 'lighting', 'composition', 'color_palette' are used
    to enrich the prompt.

    If the agent already provides a complete prompt via the 'prompt' key in
    collected_info, that value is returned directly.

    Args:
        collected_info: Dict with gathered information. Required: 'subject'.
            Optional: 'prompt' (complete prompt), 'style', 'purpose', 'mood',
            'lighting', 'composition', 'color_palette', 'quality_markers', etc.

    Returns:
        Dict with a single key 'prompt' (str).

    Raises:
        ValueError: If 'subject' is missing or empty in collected_info.
    """
    if not collected_info or not collected_info.get("subject"):
        raise ValueError(
            "collected_info must contain a non-empty 'subject' key. "
            "Please gather at least the subject/motif from the user before drafting."
        )

    # If the agent already provides a complete prompt, use it directly
    if collected_info.get("prompt"):
        return {"prompt": str(collected_info["prompt"])}

    subject = collected_info["subject"]
    style_direction = collected_info.get("style", "photorealistic")
    purpose = collected_info.get("purpose", "general")
    mood = collected_info.get("mood", "")
    lighting = collected_info.get("lighting", "")
    composition = collected_info.get("composition", "")
    color_palette = collected_info.get("color_palette", "")

    # Build a single prompt from components
    prompt_parts = [subject]
    if composition:
        prompt_parts.append(composition)
    if mood:
        prompt_parts.append(f"{mood} atmosphere")
    if lighting:
        prompt_parts.append(f"{lighting} lighting")

    # Append style and quality markers
    prompt_parts.append(style_direction)
    if color_palette:
        prompt_parts.append(f"{color_palette} color palette")

    purpose_quality = {
        "social media": "vibrant colors, eye-catching",
        "web": "clean, professional, high resolution",
        "print": "ultra high resolution, print quality, sharp details",
        "art": "artistic, gallery quality, masterpiece",
        "general": "highly detailed, professional quality",
    }
    quality = purpose_quality.get(purpose.lower(), purpose_quality["general"])
    prompt_parts.append(quality)

    prompt = ", ".join(part for part in prompt_parts if part)

    return {"prompt": prompt}


@tool
def refine_prompt(current_draft: dict, feedback: str) -> dict:
    """Refine an existing prompt based on user feedback.

    Takes the current prompt draft and user feedback, then produces an updated
    version incorporating the requested changes. The agent (LLM) should modify
    the prompt based on the feedback and pass the updated value. The prompt
    should differ from the original draft.

    All prompt text must be in English regardless of the conversation language.

    Args:
        current_draft: Dict with current prompt. Expected key: 'prompt' (str).
        feedback: User feedback describing desired changes (e.g., "add dramatic lighting",
            "make it more vibrant", "add storm clouds").

    Returns:
        Dict with a single key 'prompt' (str).
    """
    prompt = current_draft.get("prompt", "")

    # If the agent provides a fully updated prompt in current_draft, use it.
    # The agent is expected to do the creative refinement and pass the result
    # through this tool for state update. The feedback string documents what
    # was changed for traceability.

    # Ensure prompt is a non-empty string
    if not prompt:
        prompt = feedback

    return {"prompt": str(prompt)}


@tool("emit_intent_summary", args_schema=EmitIntentSummaryInput)
def emit_intent_summary(
    prompt: str,
    settings_diff: Optional[SettingsDiff] = None,
    model_id: Optional[str] = None,
) -> dict:
    """Emit the final intent summary at the end of the interview.

    Signals that the assistant has reached semantic confidence about the user's
    intent. **Carries the payload only — does NOT trigger generate.** The
    frontend renders an Intent-Summary-Card; the user click on "So generieren"
    is the gate that triggers Auto-Apply + Auto-Generate.

    State side-effect (handled in ``graph.post_process_node``):
    * ``flow_state`` advances to ``"summarizing"``.
    * ``final_intent`` is set to the validated payload dict.

    The tool body itself is a pure data-roundtrip — it performs no HTTP calls,
    no workspace mutations, and no generation triggers.

    Args:
        prompt: Final English image-generation prompt (1..2000 chars).
        settings_diff: Optional typed diff of settings accumulated during the
            interview. Omit when no settings changed.
        model_id: Optional active-model identifier (e.g. ``"flux-2-pro"``).

    Returns:
        Dict echoing the validated payload with keys ``prompt``,
        ``settings_diff`` (dict or None), and ``model_id`` (str or None).
    """
    # Pure echo: serialise the validated SettingsDiff (if any) so the
    # tool-result content is JSON-serialisable.
    settings_diff_out: Optional[dict] = None
    if settings_diff is not None:
        if isinstance(settings_diff, SettingsDiff):
            settings_diff_out = settings_diff.model_dump(
                by_alias=True, exclude_none=True
            )
        elif isinstance(settings_diff, dict):
            # Re-validate dict input through SettingsDiff to enforce schema,
            # then serialise back to camelCase wire format.
            settings_diff_out = SettingsDiff.model_validate(
                settings_diff
            ).model_dump(by_alias=True, exclude_none=True)
        else:
            settings_diff_out = settings_diff  # type: ignore[assignment]

    return {
        "prompt": prompt,
        "settings_diff": settings_diff_out,
        "model_id": model_id,
    }
