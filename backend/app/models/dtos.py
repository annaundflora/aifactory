"""Data Transfer Objects for the Prompt Assistant API.

Pydantic models for request/response validation on API endpoints.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


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
    """

    messages: list[MessageDTO] = Field(default_factory=list)
    draft_prompt: Optional[DraftPromptDTO] = None
    recommended_model: Optional[ModelRecDTO] = None
    flow_state: str = "idle"
    intent_axes: dict = Field(default_factory=dict)


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
