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

    Validates user message content, optional image URL, and optional model selection.

    Fields:
        content: The user message text (1-5000 characters).
        image_url: Optional URL to a reference image (must be a valid URL).
        model: Optional LLM model slug. Must be one of the allowed models.
    """

    content: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User message content (1-5000 characters)",
    )
    image_url: Optional[HttpUrl] = Field(
        default=None,
        description="Optional reference image URL",
    )
    model: Optional[Literal[
        "anthropic/claude-sonnet-4.6",
        "openai/gpt-5.4",
        "google/gemini-3.1-pro-preview",
    ]] = Field(
        default=None,
        description="Optional LLM model slug",
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
