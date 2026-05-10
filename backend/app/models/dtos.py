"""Data Transfer Objects for the Prompt Assistant API.

Pydantic models for request/response validation on API endpoints.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

# Re-export the SettingsDiff Pydantic model from the prompt-tools module so
# Slice 15 SSE consumers can build ``IntentSummaryPayload`` payloads without
# pulling in the LangGraph tool-registration module directly. The schema is
# the canonical wire format mirrored in architecture.md → "SettingsDiff Type
# Schema" and is shared with the ``emit_intent_summary`` tool input schema.
from app.agent.tools.prompt_tools import SettingsDiff  # noqa: E402,F401


# Allowed model slugs for the model field
ALLOWED_MODELS = [
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-5.4",
    "google/gemini-3.1-pro-preview",
]


class ReferenceSlotDTO(BaseModel):
    """DTO for a single active ReferenceBar slot snapshot.

    The frontend sends a list of these every assistant turn (when in img2img mode);
    the backend uses them to build the multimodal HumanMessage. Per architecture.md
    Section "Data Models" (line 145).

    Fields:
        slot_index: Zero-based position of the slot in the ReferenceBar.
        image_url: Public URL of the reference image (S3 / Replicate / etc.).
        role: Optional semantic role of the reference: subject, style or composition.
        strength: Optional strength weight for the reference (0.0..1.0 inclusive).
    """

    slot_index: int = Field(
        ...,
        ge=0,
        description="Zero-based slot position in the ReferenceBar",
    )
    image_url: HttpUrl = Field(
        ...,
        description="Public URL of the reference image",
    )
    role: Optional[Literal["subject", "style", "composition"]] = Field(
        default=None,
        description='Optional semantic role: "subject" | "style" | "composition"',
    )
    strength: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Optional strength weight for the reference (0.0..1.0)",
    )


class SendMessageRequest(BaseModel):
    """DTO for POST /api/assistant/sessions/{id}/messages.

    Validates user message content, optional image URLs, and optional model selection.

    Fields:
        content: The user message text (1-5000 characters).
        image_urls: Optional list of reference image URLs (max 5).
        model: Optional LLM model slug. Must be one of the allowed models.
        image_model_id: Optional image generation model ID.
        generation_mode: Optional generation mode ("txt2img" | "img2img").
        project_id: Optional UUID of the project (enables loading project context).
        reference_slots: Optional snapshot of active ReferenceBar slots (max 5).
        last_result_image_url: Optional URL of the last successfully generated image.
    """

    content: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User message content (1-5000 characters)",
    )
    image_urls: Optional[list[HttpUrl]] = Field(
        default=None,
        max_length=5,
        description="Optional reference image URLs (max 5)",
    )
    model: Optional[Literal[
        "anthropic/claude-sonnet-4.6",
        "openai/gpt-5.4",
        "google/gemini-3.1-pro-preview",
    ]] = Field(
        default=None,
        description="Optional LLM model slug",
    )
    image_model_id: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional image generation model ID (e.g. 'flux-2-pro')",
    )
    generation_mode: Optional[Literal["txt2img", "img2img"]] = Field(
        default=None,
        description="Optional generation mode: 'txt2img' or 'img2img'",
    )
    project_id: Optional[UUID] = Field(
        default=None,
        description="Optional UUID of the project; enables loading project context",
    )
    reference_slots: Optional[list[ReferenceSlotDTO]] = Field(
        default=None,
        max_length=5,
        description="Optional snapshot of active ReferenceBar slots (max 5)",
    )
    last_result_image_url: Optional[HttpUrl] = Field(
        default=None,
        description="Optional URL of the last successfully generated image",
    )


# ---------------------------------------------------------------------------
# Session DTOs (Slice 13a)
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    """DTO for POST /api/assistant/sessions.

    Creates a new assistant session linked to an AI Factory project.

    Fields:
        project_id: UUID of the project this session belongs to.
    """

    project_id: UUID = Field(
        ...,
        description="UUID of the project this session belongs to",
    )


class UpdateSessionRequest(BaseModel):
    """DTO for PATCH /api/assistant/sessions/{id}.

    Only archiving is supported.

    Fields:
        status: Must be "archived".
    """

    status: Literal["archived"] = Field(
        ...,
        description='New session status. Only "archived" is allowed.',
    )


class SessionResponse(BaseModel):
    """DTO for a single session in API responses.

    Contains all metadata fields from the assistant_sessions table.
    """

    id: UUID
    project_id: UUID
    title: Optional[str] = None
    status: str
    message_count: int
    has_draft: bool
    last_message_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    """DTO for GET /api/assistant/sessions (list).

    Wraps a list of SessionResponse objects.
    """

    sessions: list[SessionResponse]


# ---------------------------------------------------------------------------
# Session Detail DTOs (Slice 13c)
# ---------------------------------------------------------------------------


class MessageDTO(BaseModel):
    """A single message in the conversation history.

    Converted from LangChain BaseMessage.
    """

    role: str = Field(
        ...,
        description='Message role: "human" or "assistant"',
    )
    content: str = Field(
        ...,
        description="Message text content",
    )


class DraftPromptDTO(BaseModel):
    """Current prompt draft from LangGraph state."""

    prompt: str


class ModelRecDTO(BaseModel):
    """Model recommendation from LangGraph state."""

    id: str
    name: str
    reason: str


class FinalIntentDTO(BaseModel):
    """Persisted ``final_intent`` payload from the LangGraph checkpoint.

    Slice 28: surfaces the payload written by the ``emit_intent_summary``
    tool so the frontend can rebuild the ``IntentSummaryPayload`` after a
    page reload (architecture.md → "Frontend State Machine Wiring" → row
    "Resume on session reload"). The shape mirrors the ``emit_intent_summary``
    tool input schema (architecture.md → "Tool Catalog (NEW)").

    Fields:
        prompt: Final EN image-generation prompt (1..2000 chars).
        settings_diff: Optional typed diff of settings changes; ``None`` when
            no settings changed.
        model_id: Optional image-model id captured at emit-time. Frontend
            ``RENDER_INTENT_SUMMARY`` mapping discards this field because
            ``IntentSummaryPayload`` does not carry it.
    """

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Final EN image-generation prompt (1..2000 chars).",
    )
    settings_diff: Optional[SettingsDiff] = Field(
        default=None,
        description="Optional typed diff of settings changes.",
    )
    model_id: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional image-model id captured at emit-time.",
    )


class SessionStateDTO(BaseModel):
    """Reconstructed state from LangGraph checkpoint.

    Contains all relevant state fields for session resume.

    Fields:
        messages: Full conversation history projected from LangGraph state.
        draft_prompt: Current prompt draft, if any.
        recommended_model: Current model recommendation, if any.
        flow_state: Current FSM state of the Interactive Prompt Refinement flow.
            Defaults to ``"idle"`` for backward compatibility with checkpoints
            persisted before Slice 14 (architecture.md → Risks: "LangGraph state
            field rename breaks existing sessions").
        intent_axes: Intent-summary axes (subject/medium/style/lighting/composition/
            palette). Defaults to empty dict for legacy checkpoints. Slice 15
            consumers re-shape this into the typed ``IntentSummaryPayload.axes``.
        final_intent: Slice 28 — persisted ``final_intent`` payload (written by
            the ``emit_intent_summary`` tool). ``None`` for legacy checkpoints
            and for sessions where the tool was never invoked. Frontend uses
            this to rebuild the ``IntentSummaryPayload`` on session reload.
    """

    messages: list[MessageDTO] = Field(default_factory=list)
    draft_prompt: Optional[DraftPromptDTO] = None
    recommended_model: Optional[ModelRecDTO] = None
    flow_state: str = "idle"
    intent_axes: dict = Field(default_factory=dict)
    final_intent: Optional[FinalIntentDTO] = None


class SessionDetailResponse(BaseModel):
    """DTO for GET /api/assistant/sessions/{id} with full state.

    Returns session metadata plus the full conversational state
    reconstructed from the LangGraph checkpointer.
    """

    session: SessionResponse
    state: SessionStateDTO


class UpdateTitleRequest(BaseModel):
    """DTO for PATCH /api/assistant/sessions/{id}/title.

    Sets the session title (used for auto-title from first user message).
    """

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="New title for the session",
    )


# ---------------------------------------------------------------------------
# Intent Summary SSE Payload (Slice 15)
# ---------------------------------------------------------------------------


# Maximum length of any single ``IntentAxes`` axis string. Mirrors
# architecture.md → "Data Transfer Objects" → ``IntentSummaryPayload``:
# "every axis ≤ 200 chars".
INTENT_AXES_MAX_LENGTH: int = 200


class IntentAxes(BaseModel):
    """Typed axes container for ``IntentSummaryPayload.axes``.

    All six axes are optional; the LLM populates whatever it has gathered
    during the interview. Each axis string is bounded by
    :data:`INTENT_AXES_MAX_LENGTH` (200 chars) per architecture.md →
    "Data Transfer Objects" / "Validation Rules". Field validation raises
    a ``ValidationError`` which is propagated as an SSE ``error`` event by
    :mod:`app.services.assistant_service` (Slice 15 AC-4).
    """

    model_config = ConfigDict(extra="forbid")

    subject: Optional[str] = Field(
        default=None,
        max_length=INTENT_AXES_MAX_LENGTH,
        description="Subject / motif axis (≤ 200 chars).",
    )
    medium: Optional[str] = Field(
        default=None,
        max_length=INTENT_AXES_MAX_LENGTH,
        description="Medium axis (e.g. photo, illustration; ≤ 200 chars).",
    )
    style: Optional[str] = Field(
        default=None,
        max_length=INTENT_AXES_MAX_LENGTH,
        description="Style axis (e.g. cinematic, minimalist; ≤ 200 chars).",
    )
    lighting: Optional[str] = Field(
        default=None,
        max_length=INTENT_AXES_MAX_LENGTH,
        description="Lighting axis (≤ 200 chars).",
    )
    composition: Optional[str] = Field(
        default=None,
        max_length=INTENT_AXES_MAX_LENGTH,
        description="Composition axis (≤ 200 chars).",
    )
    palette: Optional[str] = Field(
        default=None,
        max_length=INTENT_AXES_MAX_LENGTH,
        description="Color palette axis (≤ 200 chars).",
    )


class IntentSummaryPayload(BaseModel):
    """Wire payload of the SSE ``intent-summary`` event (Slice 15).

    Mirrors architecture.md → "Data Transfer Objects" → ``IntentSummaryPayload``:

    * ``axes``: typed :class:`IntentAxes` (subject/medium/style/lighting/
      composition/palette).
    * ``prompt_preview``: final EN image-generation prompt (1..2000 chars,
      mirroring the ``emit_intent_summary.prompt`` constraint so the
      preview never exceeds the validated tool argument).
    * ``settings_diff``: optional :class:`SettingsDiff`. When the
      ``emit_intent_summary`` tool emits no settings changes (or an empty
      diff), the field is omitted from the JSON via
      ``model_dump(exclude_none=True)`` (Slice 15 AC-3).
    """

    model_config = ConfigDict(extra="forbid")

    axes: IntentAxes = Field(
        default_factory=IntentAxes,
        description="Typed axes container. All sub-fields optional.",
    )
    prompt_preview: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Final EN image-generation prompt (1..2000 chars).",
    )
    settings_diff: Optional[SettingsDiff] = Field(
        default=None,
        description=(
            "Optional typed diff of settings changes. Omitted from the wire "
            "payload (not serialised as null) when no settings changed."
        ),
    )
