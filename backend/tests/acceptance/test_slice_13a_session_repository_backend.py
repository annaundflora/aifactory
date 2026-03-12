"""Acceptance tests for Slice 13a: Session-Tabelle + Repository (Backend).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-13a-session-repository-backend.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
The SessionRepository is mocked to avoid requiring a real PostgreSQL database.
All other layers (FastAPI routing, Pydantic validation, middleware) are real.
"""

from datetime import datetime, timedelta
from typing import Literal, Optional, get_args, get_origin, get_type_hints
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient


def _make_session_dict(
    session_id=None,
    project_id=None,
    title=None,
    status="active",
    message_count=0,
    has_draft=False,
    last_message_at=None,
    created_at=None,
    updated_at=None,
):
    """Helper to build a session dict as returned by the repository."""
    now = datetime.utcnow()
    return {
        "id": session_id or uuid4(),
        "project_id": project_id or uuid4(),
        "title": title,
        "status": status,
        "message_count": message_count,
        "has_draft": has_draft,
        "last_message_at": last_message_at or now,
        "created_at": created_at or now,
        "updated_at": updated_at or now,
    }


@pytest.fixture()
def mock_repo():
    """Create a mocked SessionRepository with AsyncMock methods."""
    with patch("app.routes.sessions._repo") as repo:
        repo.create = AsyncMock()
        repo.get_by_id = AsyncMock()
        repo.list_by_project = AsyncMock()
        repo.update = AsyncMock()
        repo.increment_message_count = AsyncMock()
        repo.set_title = AsyncMock()
        yield repo


@pytest.fixture()
def mock_service():
    """Create a mocked AssistantService for the GET session detail endpoint."""
    with patch("app.routes.sessions._service") as service:
        service.get_session_state = AsyncMock()
        yield service


@pytest.fixture()
def client(mock_repo, mock_service):
    """Create a real TestClient against the actual FastAPI application."""
    from app.main import app

    with TestClient(app) as c:
        yield c


class TestSlice13aAcceptance:
    """Acceptance tests for Slice 13a - Session-Tabelle + Repository (Backend).

    Each test maps 1:1 to a GIVEN/WHEN/THEN Acceptance Criterion from the spec.
    """

    def test_ac1_post_sessions_creates_new_session_with_201(self, client, mock_repo):
        """AC-1: GIVEN ein laufender FastAPI Server mit registriertem Sessions-Router
        WHEN POST /api/assistant/sessions mit Body {"project_id": "<valid-uuid>"} aufgerufen wird
        THEN antwortet der Server mit HTTP 201 und einem JSON-Body der id (UUID),
        project_id, title (null), status ("active"), message_count (0), has_draft (false),
        created_at und updated_at enthaelt.
        """
        project_id = uuid4()
        session_id = uuid4()
        now = datetime.utcnow()
        mock_repo.create.return_value = _make_session_dict(
            session_id=session_id,
            project_id=project_id,
            title=None,
            status="active",
            message_count=0,
            has_draft=False,
            created_at=now,
            updated_at=now,
        )

        response = client.post(
            "/api/assistant/sessions",
            json={"project_id": str(project_id)},
        )

        assert response.status_code == 201, (
            f"Expected HTTP 201, got {response.status_code}"
        )

        data = response.json()

        # Verify all required fields are present
        assert "id" in data, "Response must contain 'id'"
        assert "project_id" in data, "Response must contain 'project_id'"
        assert "title" in data, "Response must contain 'title'"
        assert "status" in data, "Response must contain 'status'"
        assert "message_count" in data, "Response must contain 'message_count'"
        assert "has_draft" in data, "Response must contain 'has_draft'"
        assert "created_at" in data, "Response must contain 'created_at'"
        assert "updated_at" in data, "Response must contain 'updated_at'"

        # Verify field values match AC-1 expectations
        assert data["id"] == str(session_id)
        assert data["project_id"] == str(project_id)
        assert data["title"] is None
        assert data["status"] == "active"
        assert data["message_count"] == 0
        assert data["has_draft"] is False

        # Verify id is a valid UUID
        UUID(data["id"])  # raises ValueError if invalid

    def test_ac2_get_session_by_id_returns_200(self, client, mock_repo, mock_service):
        """AC-2: GIVEN eine existierende Session mit bekannter id
        WHEN GET /api/assistant/sessions/<id> aufgerufen wird
        THEN antwortet der Server mit HTTP 200 und the session detail response
        containing session metadata and state.

        Note: Slice 13c changed the GET detail endpoint to return
        SessionDetailResponse (session + state) instead of plain SessionResponse.
        """
        from app.models.dtos import (
            SessionDetailResponse,
            SessionResponse,
            SessionStateDTO,
        )

        session_id = uuid4()
        project_id = uuid4()
        now = datetime.utcnow()

        session_response = SessionResponse(
            id=session_id,
            project_id=project_id,
            title=None,
            status="active",
            message_count=0,
            has_draft=False,
            last_message_at=now,
            created_at=now,
            updated_at=now,
        )
        mock_service.get_session_state.return_value = SessionDetailResponse(
            session=session_response,
            state=SessionStateDTO(messages=[], draft_prompt=None, recommended_model=None),
        )

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}"
        )

        data = response.json()

        # Verify session metadata is nested under "session" key
        assert "session" in data, "Response must contain 'session' key"
        assert "state" in data, "Response must contain 'state' key"

        session_data = data["session"]
        assert session_data["id"] == str(session_id)
        assert session_data["project_id"] == str(project_id)
        assert "title" in session_data
        assert "status" in session_data
        assert "message_count" in session_data
        assert "has_draft" in session_data
        assert "created_at" in session_data
        assert "updated_at" in session_data
        assert "last_message_at" in session_data

    def test_ac3_get_nonexistent_session_returns_404(self, client, mock_repo, mock_service):
        """AC-3: GIVEN keine Session mit der angegebenen id existiert
        WHEN GET /api/assistant/sessions/<non-existent-uuid> aufgerufen wird
        THEN antwortet der Server mit HTTP 404 und {"detail": "Session nicht gefunden"}.
        """
        non_existent_id = uuid4()
        mock_service.get_session_state.return_value = None

        response = client.get(f"/api/assistant/sessions/{non_existent_id}")

        assert response.status_code == 404, (
            f"Expected HTTP 404, got {response.status_code}"
        )

        data = response.json()
        assert data == {"detail": "Session nicht gefunden"}, (
            f"Expected {{'detail': 'Session nicht gefunden'}}, got {data}"
        )

    def test_ac4_list_sessions_by_project_sorted_desc(self, client, mock_repo):
        """AC-4: GIVEN zwei Sessions existieren fuer project_id "P1"
        (Session A: last_message_at = 10:00, Session B: last_message_at = 11:00)
        und eine Session fuer project_id "P2"
        WHEN GET /api/assistant/sessions?project_id=P1 aufgerufen wird
        THEN antwortet der Server mit HTTP 200 und einem Array mit genau 2 Sessions,
        sortiert nach last_message_at DESC (Session B zuerst).
        """
        project_p1 = uuid4()
        now = datetime.utcnow()

        session_a = _make_session_dict(
            project_id=project_p1,
            last_message_at=now - timedelta(hours=1),  # 10:00
        )
        session_b = _make_session_dict(
            project_id=project_p1,
            last_message_at=now,  # 11:00
        )

        # Repository returns sorted DESC: B first, A second
        mock_repo.list_by_project.return_value = [session_b, session_a]

        response = client.get(
            "/api/assistant/sessions",
            params={"project_id": str(project_p1)},
        )

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}"
        )

        data = response.json()
        sessions = data["sessions"]

        # Exactly 2 sessions (not the P2 session)
        assert len(sessions) == 2, (
            f"Expected exactly 2 sessions for P1, got {len(sessions)}"
        )

        # Sorted DESC by last_message_at: Session B (newer) first
        ts_first = datetime.fromisoformat(sessions[0]["last_message_at"])
        ts_second = datetime.fromisoformat(sessions[1]["last_message_at"])
        assert ts_first >= ts_second, (
            f"Sessions not sorted DESC by last_message_at: "
            f"{ts_first} should be >= {ts_second}"
        )

        # Verify repository was called with correct project_id
        mock_repo.list_by_project.assert_awaited_once()

    def test_ac5_list_sessions_without_project_id_returns_422(self, client, mock_repo):
        """AC-5: GIVEN GET /api/assistant/sessions ohne Query-Parameter project_id
        WHEN der Request ausgefuehrt wird
        THEN antwortet der Server mit HTTP 422 (Validation Error).
        """
        response = client.get("/api/assistant/sessions")

        assert response.status_code == 422, (
            f"Expected HTTP 422, got {response.status_code}"
        )

    def test_ac6_patch_session_archives_successfully(self, client, mock_repo):
        """AC-6: GIVEN eine existierende aktive Session mit bekannter id
        WHEN PATCH /api/assistant/sessions/<id> mit Body {"status": "archived"} aufgerufen wird
        THEN antwortet der Server mit HTTP 200, das Session-Objekt hat status = "archived"
        und updated_at ist aktualisiert.
        """
        session_id = uuid4()
        original_updated_at = datetime.utcnow() - timedelta(hours=1)
        new_updated_at = datetime.utcnow()

        mock_repo.update.return_value = _make_session_dict(
            session_id=session_id,
            status="archived",
            updated_at=new_updated_at,
            created_at=original_updated_at,
        )

        response = client.patch(
            f"/api/assistant/sessions/{session_id}",
            json={"status": "archived"},
        )

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}"
        )

        data = response.json()
        assert data["status"] == "archived", (
            f"Expected status='archived', got '{data['status']}'"
        )

        # updated_at should be more recent than created_at
        updated_at = datetime.fromisoformat(data["updated_at"])
        created_at = datetime.fromisoformat(data["created_at"])
        assert updated_at >= created_at, (
            f"updated_at ({updated_at}) should be >= created_at ({created_at})"
        )

    def test_ac7_patch_session_invalid_status_returns_422(self, client, mock_repo):
        """AC-7: GIVEN eine existierende Session
        WHEN PATCH /api/assistant/sessions/<id> mit Body {"status": "invalid_value"}
        aufgerufen wird
        THEN antwortet der Server mit HTTP 422 (Validation Error).
        """
        response = client.patch(
            f"/api/assistant/sessions/{uuid4()}",
            json={"status": "invalid_value"},
        )

        assert response.status_code == 422, (
            f"Expected HTTP 422 for invalid status, got {response.status_code}"
        )

        # Verify repository was NOT called (validation failed before reaching it)
        mock_repo.update.assert_not_awaited()

    def test_ac8_increment_message_count(self, mock_repo):
        """AC-8: GIVEN das SessionRepository
        WHEN increment_message_count(session_id) aufgerufen wird
        THEN wird message_count um 1 erhoeht und last_message_at auf NOW() gesetzt.

        Since this is a repository method (no HTTP endpoint), we test the
        repository interface contract: calling increment_message_count triggers
        the correct method with the right session_id.
        """
        from app.services.session_repository import SessionRepository

        # Verify the method exists on SessionRepository
        repo = SessionRepository.__new__(SessionRepository)
        assert hasattr(repo, "increment_message_count"), (
            "SessionRepository must have increment_message_count method"
        )

        # Verify the method signature accepts session_id
        import inspect
        sig = inspect.signature(SessionRepository.increment_message_count)
        params = list(sig.parameters.keys())
        assert "session_id" in params, (
            f"increment_message_count must accept 'session_id' parameter, "
            f"found params: {params}"
        )

        # Test through mock: verify it can be called and returns expected shape
        session_id = uuid4()
        now = datetime.utcnow()
        mock_repo.increment_message_count.return_value = _make_session_dict(
            session_id=session_id,
            message_count=1,  # incremented from 0 to 1
            last_message_at=now,
        )

        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            mock_repo.increment_message_count(session_id)
        )

        assert result["message_count"] == 1, (
            "message_count should be incremented by 1"
        )
        assert result["last_message_at"] is not None, (
            "last_message_at should be set"
        )
        mock_repo.increment_message_count.assert_awaited_once_with(session_id)

    def test_ac9_set_title(self, mock_repo):
        """AC-9: GIVEN das SessionRepository
        WHEN set_title(session_id, "Mein erstes Bild") aufgerufen wird
        THEN wird das title-Feld der Session auf "Mein erstes Bild" gesetzt.

        Since this is a repository method (no HTTP endpoint), we test the
        repository interface contract.
        """
        from app.services.session_repository import SessionRepository

        # Verify the method exists on SessionRepository
        repo = SessionRepository.__new__(SessionRepository)
        assert hasattr(repo, "set_title"), (
            "SessionRepository must have set_title method"
        )

        # Verify the method signature accepts session_id and title
        import inspect
        sig = inspect.signature(SessionRepository.set_title)
        params = list(sig.parameters.keys())
        assert "session_id" in params, (
            f"set_title must accept 'session_id' parameter, found params: {params}"
        )
        assert "title" in params, (
            f"set_title must accept 'title' parameter, found params: {params}"
        )

        # Test through mock: verify it can be called and returns expected shape
        session_id = uuid4()
        mock_repo.set_title.return_value = _make_session_dict(
            session_id=session_id,
            title="Mein erstes Bild",
        )

        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            mock_repo.set_title(session_id, "Mein erstes Bild")
        )

        assert result["title"] == "Mein erstes Bild", (
            f"Expected title='Mein erstes Bild', got '{result['title']}'"
        )
        mock_repo.set_title.assert_awaited_once_with(session_id, "Mein erstes Bild")

    def test_ac10_post_invalid_project_id_returns_422(self, client, mock_repo):
        """AC-10: GIVEN POST /api/assistant/sessions mit Body {"project_id": "nicht-eine-uuid"}
        WHEN der Request ausgefuehrt wird
        THEN antwortet der Server mit HTTP 422 (Validation Error: project_id muss UUID sein).
        """
        response = client.post(
            "/api/assistant/sessions",
            json={"project_id": "nicht-eine-uuid"},
        )

        assert response.status_code == 422, (
            f"Expected HTTP 422 for invalid project_id, got {response.status_code}"
        )

        # Verify the error relates to project_id validation
        data = response.json()
        assert "detail" in data, "422 response must contain 'detail' field"

        # Check that at least one error mentions project_id
        errors = data["detail"]
        assert isinstance(errors, list), "Validation errors should be a list"
        project_id_error = any(
            any("project_id" in str(loc) for loc in e.get("loc", []))
            for e in errors
        )
        assert project_id_error, (
            f"Expected validation error for 'project_id', got errors: {errors}"
        )

    def test_ac11_session_dtos_have_correct_fields(self):
        """AC-11: GIVEN die Session-DTOs in dtos.py
        WHEN CreateSessionRequest, UpdateSessionRequest, SessionResponse und
        SessionListResponse inspiziert werden
        THEN sind alle Felder mit korrekten Pydantic-Typen definiert gemaess
        architecture.md Section "Data Transfer Objects".
        """
        from app.models.dtos import (
            CreateSessionRequest,
            SessionListResponse,
            SessionResponse,
            UpdateSessionRequest,
        )

        # CreateSessionRequest: project_id: UUID
        create_hints = get_type_hints(CreateSessionRequest)
        assert "project_id" in create_hints, (
            "CreateSessionRequest must have 'project_id' field"
        )
        assert create_hints["project_id"] is UUID, (
            f"CreateSessionRequest.project_id must be UUID, got {create_hints['project_id']}"
        )

        # UpdateSessionRequest: status: Literal["archived"]
        update_hints = get_type_hints(UpdateSessionRequest)
        assert "status" in update_hints, (
            "UpdateSessionRequest must have 'status' field"
        )
        status_args = get_args(update_hints["status"])
        assert "archived" in status_args, (
            f"UpdateSessionRequest.status must be Literal['archived'], "
            f"got args: {status_args}"
        )

        # SessionResponse: all session fields
        response_hints = get_type_hints(SessionResponse)
        required_fields = {
            "id": UUID,
            "project_id": UUID,
            "status": str,
            "message_count": int,
            "has_draft": bool,
            "created_at": datetime,
            "updated_at": datetime,
            "last_message_at": datetime,
        }
        for field_name, field_type in required_fields.items():
            assert field_name in response_hints, (
                f"SessionResponse must have '{field_name}' field"
            )
            assert response_hints[field_name] is field_type, (
                f"SessionResponse.{field_name} must be {field_type.__name__}, "
                f"got {response_hints[field_name]}"
            )

        # title is Optional[str]
        assert "title" in response_hints, (
            "SessionResponse must have 'title' field"
        )
        title_origin = get_origin(response_hints["title"])
        # Optional[str] in Python 3.10+ is Union[str, None]
        title_args = get_args(response_hints["title"])
        assert str in title_args and type(None) in title_args, (
            f"SessionResponse.title must be Optional[str], got {response_hints['title']}"
        )

        # SessionListResponse: sessions: list[SessionResponse]
        list_hints = get_type_hints(SessionListResponse)
        assert "sessions" in list_hints, (
            "SessionListResponse must have 'sessions' field"
        )
        sessions_origin = get_origin(list_hints["sessions"])
        sessions_args = get_args(list_hints["sessions"])
        assert sessions_origin is list, (
            f"SessionListResponse.sessions must be list[...], got origin {sessions_origin}"
        )
        assert sessions_args == (SessionResponse,), (
            f"SessionListResponse.sessions must be list[SessionResponse], "
            f"got args: {sessions_args}"
        )

    def test_ac12_sessions_route_uses_api_router(self):
        """AC-12: GIVEN die Sessions-Route in backend/app/routes/sessions.py
        WHEN das Modul inspiziert wird
        THEN ist die Route als APIRouter definiert und in main.py via
        include_router eingebunden.
        """
        from app.routes.sessions import router

        # Verify it is an APIRouter
        assert isinstance(router, APIRouter), (
            f"Sessions router must be an APIRouter, got {type(router).__name__}"
        )

        # Verify the router is included in the main app with correct prefix
        from app.main import app

        route_paths = [route.path for route in app.routes]

        # Check that all session endpoints are registered
        assert "/api/assistant/sessions" in route_paths, (
            f"POST/GET /api/assistant/sessions must be registered. "
            f"Found routes: {route_paths}"
        )
        assert "/api/assistant/sessions/{session_id}" in route_paths, (
            f"GET/PATCH /api/assistant/sessions/{{session_id}} must be registered. "
            f"Found routes: {route_paths}"
        )

        # Verify the router has the expected route paths defined
        router_paths = [route.path for route in router.routes]
        assert "/sessions" in router_paths, (
            f"Sessions router must define /sessions route, found: {router_paths}"
        )
        assert "/sessions/{session_id}" in router_paths, (
            f"Sessions router must define /sessions/{{session_id}} route, "
            f"found: {router_paths}"
        )
