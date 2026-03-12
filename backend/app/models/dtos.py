"""Data Transfer Objects for the Prompt Assistant API.

Pydantic models for request/response validation on API endpoints.
"""

from typing import Literal, Optional

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
