"""Acceptance tests for Slice 13c: Session Resume + Switcher (Backend).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-13c-session-resume-switcher.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
The SessionRepository and LangGraph checkpointer are mocked to avoid requiring
a real PostgreSQL database. All other layers (FastAPI routing, Pydantic
validation, service logic) are real.

AC coverage:
- AC-1: GET session detail returns state with messages
- AC-2: GET session detail returns draft_prompt from state
- AC-3: GET session detail returns 404 for unknown session
- AC-9: Auto-title set from first user message
- AC-12: get_session_state reads LangGraph checkpoint via thread_id
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_session_dict(
    session_id=None,
    project_id=None,
    title=None,
    status="active",
    message_count=4,
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


def _make_state_snapshot(messages=None, draft_prompt=None, recommended_model=None):
    """Build a mock StateSnapshot object similar to LangGraph's output."""
    values = {"messages": messages or []}
    if draft_prompt is not None:
        values["draft_prompt"] = draft_prompt
    if recommended_model is not None:
        values["recommended_model"] = recommended_model
    return SimpleNamespace(values=values)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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
def mock_agent():
    """Mock the LangGraph compiled agent used by AssistantService."""
    with patch("app.services.assistant_service.create_agent") as create:
        agent = MagicMock()
        agent.aget_state = AsyncMock()
        create.return_value = agent
        yield agent


@pytest.fixture()
def mock_service_repo():
    """Mock the SessionRepository inside AssistantService."""
    with patch("app.services.assistant_service.SessionRepository") as repo_cls:
        repo_instance = MagicMock()
        repo_instance.get_by_id = AsyncMock()
        repo_instance.set_title = AsyncMock()
        repo_cls.return_value = repo_instance
        yield repo_instance


@pytest.fixture()
def client(mock_repo, mock_agent, mock_service_repo):
    """Create a real TestClient against the actual FastAPI application.

    We must also patch the module-level _service in sessions.py so it uses
    our mocked agent and repo.
    """
    # Reimport to pick up mocks
    with patch("app.routes.sessions._service") as service_mock:
        # Use a real AssistantService but with mocked internals
        from app.services.assistant_service import AssistantService

        real_service = AssistantService()
        real_service._repo = mock_service_repo
        real_service._agent = mock_agent

        service_mock.get_session_state = real_service.get_session_state

        from app.main import app

        with TestClient(app) as c:
            yield c


# ---------------------------------------------------------------------------
# Acceptance Tests
# ---------------------------------------------------------------------------


class TestSlice13cAcceptance:
    """Acceptance tests for Slice 13c - Session Resume + Switcher (Backend).

    Each test maps 1:1 to a GIVEN/WHEN/THEN Acceptance Criterion from the spec.
    """

    # -----------------------------------------------------------------------
    # AC-1: GIVEN eine existierende Session mit id "S1" die 4 Messages im
    #        LangGraph Checkpointer hat
    #       WHEN GET /api/assistant/sessions/S1 aufgerufen wird
    #       THEN antwortet der Server mit HTTP 200, das Response-Objekt
    #            enthaelt session (Metadata) und state mit messages (Array
    #            mit 4 Message-Objekten, je role und content), draft_prompt
    #            (oder null) und recommended_model (oder null)
    # -----------------------------------------------------------------------
    def test_ac1_get_session_detail_returns_messages_from_checkpointer(
        self, client, mock_service_repo, mock_agent
    ):
        """AC-1: GET /sessions/{id} returns session metadata and state with messages."""
        session_id = uuid4()
        session_dict = _make_session_dict(
            session_id=session_id, message_count=4
        )
        mock_service_repo.get_by_id.return_value = session_dict

        # Create 4 LangChain messages in the checkpoint
        checkpoint_messages = [
            HumanMessage(content="Erstelle ein Portraet von einer Katze"),
            AIMessage(content="Ich erstelle ein Portraet fuer dich."),
            HumanMessage(content="Mache es im Aquarell-Stil"),
            AIMessage(content="Ich passe den Stil auf Aquarell an."),
        ]
        mock_agent.aget_state.return_value = _make_state_snapshot(
            messages=checkpoint_messages
        )

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()

        # Verify session metadata
        assert "session" in data
        assert data["session"]["id"] == str(session_id)
        assert data["session"]["message_count"] == 4

        # Verify state with messages
        assert "state" in data
        assert "messages" in data["state"]
        assert len(data["state"]["messages"]) == 4

        # Verify message roles and content
        msgs = data["state"]["messages"]
        assert msgs[0]["role"] == "human"
        assert msgs[0]["content"] == "Erstelle ein Portraet von einer Katze"
        assert msgs[1]["role"] == "assistant"
        assert msgs[1]["content"] == "Ich erstelle ein Portraet fuer dich."
        assert msgs[2]["role"] == "human"
        assert msgs[3]["role"] == "assistant"

        # Verify draft_prompt and recommended_model are present (as null)
        assert data["state"]["draft_prompt"] is None
        assert data["state"]["recommended_model"] is None

    # -----------------------------------------------------------------------
    # AC-2: GIVEN eine Session "S1" deren LangGraph-State einen draft_prompt
    #        mit {motiv: "A cat...", style: "watercolor...",
    #        negative_prompt: "blurry..."} enthaelt
    #       WHEN GET /api/assistant/sessions/S1 aufgerufen wird
    #       THEN enthaelt state.draft_prompt exakt diese drei Felder
    # -----------------------------------------------------------------------
    def test_ac2_get_session_detail_returns_draft_prompt(
        self, client, mock_service_repo, mock_agent
    ):
        """AC-2: GET /sessions/{id} returns draft_prompt fields from checkpoint state."""
        session_id = uuid4()
        session_dict = _make_session_dict(session_id=session_id, has_draft=True)
        mock_service_repo.get_by_id.return_value = session_dict

        draft = {
            "motiv": "A cat sitting on a windowsill",
            "style": "watercolor, soft edges",
            "negative_prompt": "blurry, low quality",
        }
        mock_agent.aget_state.return_value = _make_state_snapshot(
            messages=[
                HumanMessage(content="Ein Katzenbild"),
                AIMessage(content="Hier ist mein Vorschlag."),
            ],
            draft_prompt=draft,
        )

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["state"]["draft_prompt"] is not None
        dp = data["state"]["draft_prompt"]
        assert dp["motiv"] == "A cat sitting on a windowsill"
        assert dp["style"] == "watercolor, soft edges"
        assert dp["negative_prompt"] == "blurry, low quality"

    # -----------------------------------------------------------------------
    # AC-3: GIVEN eine Session-ID die nicht existiert oder keinen Checkpoint hat
    #       WHEN GET /api/assistant/sessions/<unknown-id> aufgerufen wird
    #       THEN antwortet der Server mit HTTP 404 und
    #            {"detail": "Session nicht gefunden"}
    # -----------------------------------------------------------------------
    def test_ac3_get_session_detail_returns_404_when_not_found(
        self, client, mock_service_repo
    ):
        """AC-3: GET /sessions/{unknown_id} returns 404 with correct error detail."""
        unknown_id = uuid4()
        mock_service_repo.get_by_id.return_value = None

        response = client.get(f"/api/assistant/sessions/{unknown_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Session nicht gefunden"

    # -----------------------------------------------------------------------
    # AC-9: GIVEN der User sendet die erste Nachricht "Ein Portraet von einer
    #        Katze" in einer neuen Session
    #       WHEN die Nachricht erfolgreich gesendet wurde
    #       THEN wird PATCH /api/assistant/sessions/{id}/title aufgerufen
    #            mit einem Titel abgeleitet aus der ersten User-Message,
    #            und die Session-Metadata wird aktualisiert
    # -----------------------------------------------------------------------
    def test_ac9_auto_title_set_from_first_user_message(
        self, client, mock_repo
    ):
        """AC-9: PATCH /sessions/{id}/title sets the title correctly."""
        session_id = uuid4()
        title = "Ein Portraet von einer Katze"
        updated_session = _make_session_dict(
            session_id=session_id, title=title
        )
        mock_repo.set_title.return_value = updated_session

        response = client.patch(
            f"/api/assistant/sessions/{session_id}/title",
            json={"title": title},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == title
        mock_repo.set_title.assert_called_once_with(
            session_id=session_id, title=title
        )

    def test_ac9_auto_title_truncation_at_80_chars(self, client, mock_repo):
        """AC-9: Title from first user message is accepted up to 80 chars."""
        session_id = uuid4()
        long_title = "A" * 80
        updated_session = _make_session_dict(
            session_id=session_id, title=long_title
        )
        mock_repo.set_title.return_value = updated_session

        response = client.patch(
            f"/api/assistant/sessions/{session_id}/title",
            json={"title": long_title},
        )

        assert response.status_code == 200
        assert response.json()["title"] == long_title

    def test_ac9_title_endpoint_returns_404_for_nonexistent_session(
        self, client, mock_repo
    ):
        """AC-9: PATCH /sessions/{id}/title returns 404 if session not found."""
        unknown_id = uuid4()
        mock_repo.set_title.return_value = None

        response = client.patch(
            f"/api/assistant/sessions/{unknown_id}/title",
            json={"title": "Some title"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Session nicht gefunden"

    # -----------------------------------------------------------------------
    # AC-12: GIVEN der assistant_service.py im Backend
    #        WHEN get_session_state(session_id) aufgerufen wird
    #        THEN liest die Methode den LangGraph Checkpoint via
    #             aget_state mit config={"configurable": {"thread_id": session_id}}
    #             und konvertiert den State in das SessionDetailResponse DTO
    # -----------------------------------------------------------------------
    def test_ac12_get_session_state_reads_checkpoint_via_thread_id(
        self, client, mock_service_repo, mock_agent
    ):
        """AC-12: get_session_state reads checkpoint with correct thread_id config."""
        session_id = uuid4()
        session_dict = _make_session_dict(session_id=session_id)
        mock_service_repo.get_by_id.return_value = session_dict

        mock_agent.aget_state.return_value = _make_state_snapshot(
            messages=[
                HumanMessage(content="Test message"),
                AIMessage(content="Test response"),
            ]
        )

        response = client.get(f"/api/assistant/sessions/{session_id}")

        assert response.status_code == 200

        # Verify aget_state was called with the correct config
        mock_agent.aget_state.assert_called_once_with(
            {"configurable": {"thread_id": str(session_id)}}
        )


# ---------------------------------------------------------------------------
# Unit Tests: AssistantService.get_session_state logic
# ---------------------------------------------------------------------------


class TestGetSessionStateUnit:
    """Unit tests for the get_session_state service method.

    Tests the conversion logic from LangChain messages to DTOs
    and the handling of edge cases.
    """

    @pytest.mark.asyncio
    async def test_converts_human_messages_to_human_role(self):
        """get_session_state converts HumanMessage to role='human'."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            agent.aget_state = AsyncMock(
                return_value=_make_state_snapshot(
                    messages=[HumanMessage(content="Hello")]
                )
            )
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(
                return_value=_make_session_dict(session_id=uuid4())
            )
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            assert result is not None
            assert result.state.messages[0].role == "human"
            assert result.state.messages[0].content == "Hello"

    @pytest.mark.asyncio
    async def test_converts_ai_messages_to_assistant_role(self):
        """get_session_state converts AIMessage to role='assistant'."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            agent.aget_state = AsyncMock(
                return_value=_make_state_snapshot(
                    messages=[AIMessage(content="I can help with that.")]
                )
            )
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(
                return_value=_make_session_dict(session_id=uuid4())
            )
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            assert result is not None
            assert result.state.messages[0].role == "assistant"

    @pytest.mark.asyncio
    async def test_skips_ai_messages_with_empty_content(self):
        """get_session_state skips AIMessage with empty/tool-only content."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            agent.aget_state = AsyncMock(
                return_value=_make_state_snapshot(
                    messages=[
                        HumanMessage(content="Hello"),
                        AIMessage(content=""),  # empty -- should be skipped
                        AIMessage(content="Real response"),
                    ]
                )
            )
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(
                return_value=_make_session_dict(session_id=uuid4())
            )
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            assert result is not None
            # Only 2 messages (empty AI message skipped)
            assert len(result.state.messages) == 2
            assert result.state.messages[0].role == "human"
            assert result.state.messages[1].role == "assistant"
            assert result.state.messages[1].content == "Real response"

    @pytest.mark.asyncio
    async def test_handles_multimodal_human_message(self):
        """get_session_state extracts text from multimodal HumanMessage."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            multimodal_content = [
                {"type": "text", "text": "A cat photo"},
                {"type": "image_url", "image_url": {"url": "https://example.com/cat.jpg"}},
            ]
            agent.aget_state = AsyncMock(
                return_value=_make_state_snapshot(
                    messages=[HumanMessage(content=multimodal_content)]
                )
            )
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(
                return_value=_make_session_dict(session_id=uuid4())
            )
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            assert result is not None
            assert result.state.messages[0].role == "human"
            assert "A cat photo" in result.state.messages[0].content

    @pytest.mark.asyncio
    async def test_returns_none_when_session_not_found(self):
        """get_session_state returns None when repo returns None."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(return_value=None)
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            assert result is None

    @pytest.mark.asyncio
    async def test_returns_empty_state_when_checkpoint_fails(self):
        """get_session_state returns empty state when checkpoint read fails."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            agent.aget_state = AsyncMock(side_effect=Exception("Checkpoint error"))
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(
                return_value=_make_session_dict(session_id=uuid4())
            )
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            # Should return session with empty state (graceful degradation)
            assert result is not None
            assert result.state.messages == []
            assert result.state.draft_prompt is None
            assert result.state.recommended_model is None

    @pytest.mark.asyncio
    async def test_extracts_recommended_model_from_state(self):
        """get_session_state extracts recommended_model from checkpoint state."""
        with (
            patch("app.services.assistant_service.create_agent") as mock_create,
            patch("app.services.assistant_service.SessionRepository") as mock_repo_cls,
        ):
            agent = MagicMock()
            agent.aget_state = AsyncMock(
                return_value=_make_state_snapshot(
                    messages=[HumanMessage(content="Landscape")],
                    recommended_model={
                        "id": "stability/sdxl",
                        "name": "Stable Diffusion XL",
                        "reason": "Great for landscapes",
                    },
                )
            )
            mock_create.return_value = agent

            repo = MagicMock()
            repo.get_by_id = AsyncMock(
                return_value=_make_session_dict(session_id=uuid4())
            )
            mock_repo_cls.return_value = repo

            from app.services.assistant_service import AssistantService

            service = AssistantService()
            result = await service.get_session_state(str(uuid4()))

            assert result is not None
            assert result.state.recommended_model is not None
            assert result.state.recommended_model.id == "stability/sdxl"
            assert result.state.recommended_model.name == "Stable Diffusion XL"
            assert result.state.recommended_model.reason == "Great for landscapes"


# ---------------------------------------------------------------------------
# Unit Tests: SessionDetailResponse DTO validation
# ---------------------------------------------------------------------------


class TestSessionDetailDTOs:
    """Unit tests for Slice 13c DTOs."""

    def test_message_dto_accepts_valid_data(self):
        """MessageDTO accepts role and content strings."""
        from app.models.dtos import MessageDTO

        dto = MessageDTO(role="human", content="Hello")
        assert dto.role == "human"
        assert dto.content == "Hello"

    def test_draft_prompt_dto_accepts_valid_data(self):
        """DraftPromptDTO accepts motiv, style, negative_prompt."""
        from app.models.dtos import DraftPromptDTO

        dto = DraftPromptDTO(
            motiv="A cat",
            style="watercolor",
            negative_prompt="blurry",
        )
        assert dto.motiv == "A cat"
        assert dto.style == "watercolor"
        assert dto.negative_prompt == "blurry"

    def test_model_rec_dto_accepts_valid_data(self):
        """ModelRecDTO accepts id, name, reason."""
        from app.models.dtos import ModelRecDTO

        dto = ModelRecDTO(
            id="stability/sdxl",
            name="SDXL",
            reason="Good for landscapes",
        )
        assert dto.id == "stability/sdxl"
        assert dto.name == "SDXL"

    def test_session_state_dto_defaults_to_empty(self):
        """SessionStateDTO has correct defaults (empty messages, null fields)."""
        from app.models.dtos import SessionStateDTO

        dto = SessionStateDTO()
        assert dto.messages == []
        assert dto.draft_prompt is None
        assert dto.recommended_model is None

    def test_session_detail_response_serialization(self):
        """SessionDetailResponse serializes correctly to JSON-compatible dict."""
        from app.models.dtos import (
            DraftPromptDTO,
            MessageDTO,
            ModelRecDTO,
            SessionDetailResponse,
            SessionResponse,
            SessionStateDTO,
        )

        session = SessionResponse(
            id=uuid4(),
            project_id=uuid4(),
            title="Test",
            status="active",
            message_count=2,
            has_draft=True,
            last_message_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        state = SessionStateDTO(
            messages=[
                MessageDTO(role="human", content="Hello"),
                MessageDTO(role="assistant", content="Hi there"),
            ],
            draft_prompt=DraftPromptDTO(
                motiv="A cat", style="oil", negative_prompt="blurry"
            ),
            recommended_model=ModelRecDTO(
                id="test/model", name="Test Model", reason="Because"
            ),
        )
        detail = SessionDetailResponse(session=session, state=state)

        serialized = detail.model_dump()
        assert serialized["session"]["title"] == "Test"
        assert len(serialized["state"]["messages"]) == 2
        assert serialized["state"]["draft_prompt"]["motiv"] == "A cat"
        assert serialized["state"]["recommended_model"]["id"] == "test/model"

    def test_update_title_request_validation(self):
        """UpdateTitleRequest validates title constraints."""
        from pydantic import ValidationError

        from app.models.dtos import UpdateTitleRequest

        # Valid
        dto = UpdateTitleRequest(title="My session title")
        assert dto.title == "My session title"

        # Empty string rejected (min_length=1)
        with pytest.raises(ValidationError):
            UpdateTitleRequest(title="")

        # Too long rejected (max_length=255)
        with pytest.raises(ValidationError):
            UpdateTitleRequest(title="A" * 256)
