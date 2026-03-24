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


class SendMessageRequest(BaseModel):
    """DTO for POST /api/assistant/sessions/{id}/messages.

    Validates user message content, optional image URLs, and optional model selection.

    Fields:
        content: The user message text (1-5000 characters).
        image_urls: Optional list of reference image URLs (max 5).
        model: Optional LLM model slug. Must be one of the allowed models.
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

    motiv: str
    style: str
    negative_prompt: str


class ModelRecDTO(BaseModel):
    """Model recommendation from LangGraph state."""

    id: str
    name: str
    reason: str


class SessionStateDTO(BaseModel):
    """Reconstructed state from LangGraph checkpoint.

    Contains all relevant state fields for session resume.
    """

    messages: list[MessageDTO] = Field(default_factory=list)
    draft_prompt: Optional[DraftPromptDTO] = None
    recommended_model: Optional[ModelRecDTO] = None


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
