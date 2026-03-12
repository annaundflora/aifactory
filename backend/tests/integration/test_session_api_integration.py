"""Integration tests for Slice 13a: Session API endpoints.

Tests the full HTTP request/response cycle through the real FastAPI
application with real router, middleware, and Pydantic validation chain.

Mocking Strategy: mock_external (as specified in Slice-Spec).
The SessionRepository is mocked to avoid requiring a real PostgreSQL database,
while all other layers (FastAPI routing, Pydantic validation, middleware) are real.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient


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


class TestCreateSessionIntegration:
    """Integration tests for POST /api/assistant/sessions."""

    def test_create_session_returns_201(self, client, mock_repo):
        """POST /sessions with valid project_id returns 201 through full stack."""
        project_id = uuid4()
        session_data = _make_session_dict(project_id=project_id)
        mock_repo.create.return_value = session_data

        response = client.post(
            "/api/assistant/sessions",
            json={"project_id": str(project_id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == str(project_id)
        assert data["status"] == "active"
        assert data["message_count"] == 0
        assert data["has_draft"] is False

    def test_create_session_calls_repository(self, client, mock_repo):
        """POST /sessions correctly passes project_id to the repository."""
        project_id = uuid4()
        mock_repo.create.return_value = _make_session_dict(project_id=project_id)

        client.post(
            "/api/assistant/sessions",
            json={"project_id": str(project_id)},
        )

        mock_repo.create.assert_awaited_once()
        call_kwargs = mock_repo.create.call_args
        assert call_kwargs.kwargs.get("project_id") == project_id

    def test_create_session_invalid_uuid_returns_422(self, client, mock_repo):
        """POST /sessions with invalid UUID triggers Pydantic 422 before reaching repo."""
        response = client.post(
            "/api/assistant/sessions",
            json={"project_id": "nicht-eine-uuid"},
        )

        assert response.status_code == 422
        mock_repo.create.assert_not_awaited()

    def test_create_session_missing_body_returns_422(self, client, mock_repo):
        """POST /sessions without body returns 422."""
        response = client.post("/api/assistant/sessions")

        assert response.status_code == 422

    def test_create_session_content_type_json(self, client, mock_repo):
        """POST /sessions returns application/json content-type."""
        mock_repo.create.return_value = _make_session_dict()

        response = client.post(
            "/api/assistant/sessions",
            json={"project_id": str(uuid4())},
        )

        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestGetSessionIntegration:
    """Integration tests for GET /api/assistant/sessions/{id}.

    Note: Slice 13c changed the GET detail endpoint to return
    SessionDetailResponse (session + state) instead of plain SessionResponse.
    """

    def test_get_session_returns_200(self, client, mock_repo, mock_service):
        """GET /sessions/{id} returns 200 with session detail (session + state)."""
        from app.models.dtos import (
            SessionDetailResponse,
            SessionResponse,
            SessionStateDTO,
        )

        session_id = uuid4()
        session_response = SessionResponse(
            id=session_id,
            project_id=uuid4(),
            title=None,
            status="active",
            message_count=0,
            has_draft=False,
            last_message_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session_state.return_value = SessionDetailResponse(
            session=session_response,
            state=SessionStateDTO(messages=[], draft_prompt=None, recommended_model=None),
        )

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert data["session"]["id"] == str(session_id)

    def test_get_session_not_found_returns_404(self, client, mock_repo, mock_service):
        """GET /sessions/{id} returns 404 when session does not exist."""
        mock_service.get_session_state.return_value = None

        response = client.get(f"/api/assistant/sessions/{uuid4()}")

        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "Session nicht gefunden"

    def test_get_session_invalid_uuid_returns_422(self, client, mock_repo, mock_service):
        """GET /sessions/{invalid-uuid} returns 422."""
        response = client.get("/api/assistant/sessions/not-a-valid-uuid")

        assert response.status_code == 422


class TestListSessionsIntegration:
    """Integration tests for GET /api/assistant/sessions?project_id=..."""

    def test_list_sessions_returns_200_with_array(self, client, mock_repo):
        """GET /sessions?project_id=... returns 200 with sessions array."""
        project_id = uuid4()
        mock_repo.list_by_project.return_value = [
            _make_session_dict(project_id=project_id),
            _make_session_dict(project_id=project_id),
        ]

        response = client.get(
            "/api/assistant/sessions",
            params={"project_id": str(project_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert len(data["sessions"]) == 2

    def test_list_sessions_without_project_id_returns_422(self, client, mock_repo):
        """GET /sessions without project_id query param returns 422."""
        response = client.get("/api/assistant/sessions")

        assert response.status_code == 422
        mock_repo.list_by_project.assert_not_awaited()

    def test_list_sessions_empty_result(self, client, mock_repo):
        """GET /sessions?project_id=... with no matching sessions returns empty list."""
        mock_repo.list_by_project.return_value = []

        response = client.get(
            "/api/assistant/sessions",
            params={"project_id": str(uuid4())},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["sessions"] == []

    def test_list_sessions_sorted_desc_by_last_message_at(self, client, mock_repo):
        """GET /sessions returns sessions in desc order of last_message_at."""
        project_id = uuid4()
        now = datetime.utcnow()
        session_a = _make_session_dict(
            project_id=project_id,
            last_message_at=now - timedelta(hours=1),
        )
        session_b = _make_session_dict(
            project_id=project_id,
            last_message_at=now,
        )
        # Repository returns them already sorted DESC (B first, A second)
        mock_repo.list_by_project.return_value = [session_b, session_a]

        response = client.get(
            "/api/assistant/sessions",
            params={"project_id": str(project_id)},
        )

        assert response.status_code == 200
        data = response.json()
        sessions = data["sessions"]
        assert len(sessions) == 2
        # Session B (newer) should be first
        ts_first = datetime.fromisoformat(sessions[0]["last_message_at"])
        ts_second = datetime.fromisoformat(sessions[1]["last_message_at"])
        assert ts_first >= ts_second, (
            f"Sessions not sorted DESC by last_message_at: "
            f"{ts_first} should be >= {ts_second}"
        )


class TestUpdateSessionIntegration:
    """Integration tests for PATCH /api/assistant/sessions/{id}."""

    def test_patch_session_archives_returns_200(self, client, mock_repo):
        """PATCH /sessions/{id} with status='archived' returns 200."""
        session_id = uuid4()
        mock_repo.update.return_value = _make_session_dict(
            session_id=session_id,
            status="archived",
        )

        response = client.patch(
            f"/api/assistant/sessions/{session_id}",
            json={"status": "archived"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "archived"

    def test_patch_session_invalid_status_returns_422(self, client, mock_repo):
        """PATCH /sessions/{id} with invalid status returns 422."""
        response = client.patch(
            f"/api/assistant/sessions/{uuid4()}",
            json={"status": "invalid_value"},
        )

        assert response.status_code == 422
        mock_repo.update.assert_not_awaited()

    def test_patch_session_not_found_returns_404(self, client, mock_repo):
        """PATCH /sessions/{id} for non-existent session returns 404."""
        mock_repo.update.return_value = None

        response = client.patch(
            f"/api/assistant/sessions/{uuid4()}",
            json={"status": "archived"},
        )

        assert response.status_code == 404


class TestSessionRouterIntegration:
    """Integration tests for router registration and prefix configuration."""

    def test_sessions_routes_registered_with_correct_prefix(self):
        """All session routes are registered under /api/assistant prefix."""
        from app.main import app

        route_paths = [route.path for route in app.routes]
        assert "/api/assistant/sessions" in route_paths
        assert "/api/assistant/sessions/{session_id}" in route_paths

    def test_cors_on_sessions_endpoint(self, client, mock_repo):
        """CORS headers are returned for sessions endpoints."""
        mock_repo.list_by_project.return_value = []

        response = client.get(
            "/api/assistant/sessions",
            params={"project_id": str(uuid4())},
            headers={"Origin": "http://localhost:3000"},
        )

        allow_origin = response.headers.get("access-control-allow-origin", "")
        assert allow_origin == "*"
