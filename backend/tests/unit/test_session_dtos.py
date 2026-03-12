"""Unit tests for Slice 13a: Session DTOs and validation logic.

Tests the Pydantic models (CreateSessionRequest, UpdateSessionRequest,
SessionResponse, SessionListResponse) for correct field types, validation,
and serialization behavior.

Mocking Strategy: mock_external (as specified in Slice-Spec).
DB/external calls are not involved -- these are pure Pydantic model tests.
"""

from datetime import datetime
from typing import Optional, get_args, get_origin, get_type_hints
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.models.dtos import (
    CreateSessionRequest,
    SessionListResponse,
    SessionResponse,
    UpdateSessionRequest,
)


class TestCreateSessionRequest:
    """Unit tests for CreateSessionRequest DTO."""

    def test_valid_uuid_project_id_accepted(self):
        """CreateSessionRequest accepts a valid UUID for project_id."""
        pid = uuid4()
        dto = CreateSessionRequest(project_id=pid)
        assert dto.project_id == pid

    def test_string_uuid_coerced(self):
        """CreateSessionRequest accepts a UUID string and coerces it."""
        pid_str = "00000000-0000-0000-0000-000000000001"
        dto = CreateSessionRequest(project_id=pid_str)
        assert isinstance(dto.project_id, UUID)
        assert str(dto.project_id) == pid_str

    def test_invalid_project_id_rejected(self):
        """CreateSessionRequest rejects a non-UUID string for project_id."""
        with pytest.raises(ValidationError) as exc_info:
            CreateSessionRequest(project_id="nicht-eine-uuid")
        errors = exc_info.value.errors()
        assert len(errors) >= 1
        # The error should relate to the project_id field
        assert any(e["loc"] == ("project_id",) for e in errors)

    def test_missing_project_id_rejected(self):
        """CreateSessionRequest rejects missing project_id (required field)."""
        with pytest.raises(ValidationError):
            CreateSessionRequest()

    def test_project_id_field_type_is_uuid(self):
        """CreateSessionRequest.project_id must be typed as UUID."""
        hints = get_type_hints(CreateSessionRequest)
        assert hints["project_id"] is UUID


class TestUpdateSessionRequest:
    """Unit tests for UpdateSessionRequest DTO."""

    def test_archived_status_accepted(self):
        """UpdateSessionRequest accepts status='archived'."""
        dto = UpdateSessionRequest(status="archived")
        assert dto.status == "archived"

    def test_invalid_status_rejected(self):
        """UpdateSessionRequest rejects status values other than 'archived'."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateSessionRequest(status="invalid_value")
        errors = exc_info.value.errors()
        assert len(errors) >= 1
        assert any(e["loc"] == ("status",) for e in errors)

    def test_active_status_rejected(self):
        """UpdateSessionRequest rejects status='active' (only 'archived' is allowed)."""
        with pytest.raises(ValidationError):
            UpdateSessionRequest(status="active")

    def test_missing_status_rejected(self):
        """UpdateSessionRequest rejects missing status (required field)."""
        with pytest.raises(ValidationError):
            UpdateSessionRequest()

    def test_status_field_is_literal_archived(self):
        """UpdateSessionRequest.status must be a Literal['archived'] type."""
        hints = get_type_hints(UpdateSessionRequest)
        status_type = hints["status"]
        args = get_args(status_type)
        assert "archived" in args, (
            f"UpdateSessionRequest.status must be Literal['archived'], got {status_type}"
        )


class TestSessionResponse:
    """Unit tests for SessionResponse DTO."""

    @pytest.fixture()
    def valid_session_data(self):
        """Provide a valid session data dict for SessionResponse."""
        now = datetime.utcnow()
        return {
            "id": uuid4(),
            "project_id": uuid4(),
            "title": None,
            "status": "active",
            "message_count": 0,
            "has_draft": False,
            "last_message_at": now,
            "created_at": now,
            "updated_at": now,
        }

    def test_all_fields_present(self, valid_session_data):
        """SessionResponse contains all required fields."""
        dto = SessionResponse(**valid_session_data)
        assert isinstance(dto.id, UUID)
        assert isinstance(dto.project_id, UUID)
        assert dto.title is None
        assert dto.status == "active"
        assert dto.message_count == 0
        assert dto.has_draft is False
        assert isinstance(dto.created_at, datetime)
        assert isinstance(dto.updated_at, datetime)
        assert isinstance(dto.last_message_at, datetime)

    def test_title_is_optional(self, valid_session_data):
        """SessionResponse.title can be None (optional field)."""
        valid_session_data["title"] = None
        dto = SessionResponse(**valid_session_data)
        assert dto.title is None

    def test_title_accepts_string(self, valid_session_data):
        """SessionResponse.title accepts a string value."""
        valid_session_data["title"] = "Mein erstes Bild"
        dto = SessionResponse(**valid_session_data)
        assert dto.title == "Mein erstes Bild"

    def test_field_types_correct(self):
        """SessionResponse fields have correct Pydantic types."""
        hints = get_type_hints(SessionResponse)
        assert hints["id"] is UUID
        assert hints["project_id"] is UUID
        assert hints["status"] is str or hints["status"] == str
        assert hints["message_count"] is int or hints["message_count"] == int
        assert hints["has_draft"] is bool or hints["has_draft"] == bool
        assert hints["created_at"] is datetime or hints["created_at"] == datetime
        assert hints["updated_at"] is datetime or hints["updated_at"] == datetime
        assert hints["last_message_at"] is datetime or hints["last_message_at"] == datetime

    def test_from_attributes_config(self):
        """SessionResponse has from_attributes=True in model_config."""
        config = SessionResponse.model_config
        assert config.get("from_attributes") is True

    def test_serialization_to_dict(self, valid_session_data):
        """SessionResponse can be serialized to a dict with correct keys."""
        dto = SessionResponse(**valid_session_data)
        data = dto.model_dump()
        expected_keys = {
            "id", "project_id", "title", "status",
            "message_count", "has_draft", "last_message_at",
            "created_at", "updated_at",
        }
        assert set(data.keys()) == expected_keys


class TestSessionListResponse:
    """Unit tests for SessionListResponse DTO."""

    def test_empty_sessions_list(self):
        """SessionListResponse accepts an empty sessions list."""
        dto = SessionListResponse(sessions=[])
        assert dto.sessions == []
        assert len(dto.sessions) == 0

    def test_sessions_list_with_items(self):
        """SessionListResponse accepts a list of SessionResponse items."""
        now = datetime.utcnow()
        session_data = {
            "id": uuid4(),
            "project_id": uuid4(),
            "title": None,
            "status": "active",
            "message_count": 0,
            "has_draft": False,
            "last_message_at": now,
            "created_at": now,
            "updated_at": now,
        }
        session = SessionResponse(**session_data)
        dto = SessionListResponse(sessions=[session])
        assert len(dto.sessions) == 1
        assert dto.sessions[0].id == session_data["id"]

    def test_sessions_field_type_is_list_of_session_response(self):
        """SessionListResponse.sessions must be list[SessionResponse]."""
        hints = get_type_hints(SessionListResponse)
        sessions_type = hints["sessions"]
        origin = get_origin(sessions_type)
        args = get_args(sessions_type)
        assert origin is list
        assert args == (SessionResponse,)
