"""Sessions routes for the Prompt Assistant API.

CRUD endpoints for assistant sessions:
- POST /sessions              -- Create a new session
- GET  /sessions              -- List sessions by project_id
- GET  /sessions/{id}         -- Get session with full state from checkpointer
- PATCH /sessions/{id}        -- Update a session (archive)
- PATCH /sessions/{id}/title  -- Set session title (auto-title)
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.models.dtos import (
    CreateSessionRequest,
    SessionDetailResponse,
    SessionListResponse,
    SessionResponse,
    UpdateSessionRequest,
    UpdateTitleRequest,
)
from app.services.assistant_service import AssistantService
from app.services.session_repository import SessionRepository

router = APIRouter()

# Module-level instances
_repo = SessionRepository()
_service = AssistantService()


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(request: CreateSessionRequest):
    """Create a new assistant session.

    Creates a session linked to the given project_id. Returns the full
    session object with default values (status="active", message_count=0, etc.).

    Args:
        request: CreateSessionRequest with project_id (UUID).

    Returns:
        SessionResponse with HTTP 201.
    """
    session = await _repo.create(project_id=request.project_id)
    return SessionResponse(**session)


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    project_id: UUID = Query(
        ...,
        description="UUID of the project to list sessions for",
    ),
):
    """List all sessions for a project.

    Returns sessions sorted by last_message_at DESC (newest first).
    The project_id query parameter is required; omitting it returns 422.

    Args:
        project_id: Required query parameter (UUID).

    Returns:
        SessionListResponse with list of SessionResponse objects.
    """
    sessions = await _repo.list_by_project(project_id=project_id)
    return SessionListResponse(
        sessions=[SessionResponse(**s) for s in sessions],
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: UUID):
    """Get a session with full state from the LangGraph checkpointer.

    Returns session metadata plus conversation state (messages, draft_prompt,
    recommended_model) reconstructed from the LangGraph checkpoint.

    AC-1: Returns state with messages array.
    AC-2: Returns draft_prompt if present.
    AC-3: Returns 404 if session not found.

    Args:
        session_id: UUID of the session.

    Returns:
        SessionDetailResponse with HTTP 200.

    Raises:
        HTTPException 404: If the session does not exist.
    """
    result = await _service.get_session_state(session_id=str(session_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    return result


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(session_id: UUID, request: UpdateSessionRequest):
    """Update a session (archive).

    Only status="archived" is accepted. Returns the updated session.

    Args:
        session_id: UUID of the session.
        request: UpdateSessionRequest with status.

    Returns:
        SessionResponse with HTTP 200.

    Raises:
        HTTPException 404: If the session does not exist.
    """
    session = await _repo.update(
        session_id=session_id,
        status=request.status,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    return SessionResponse(**session)


@router.patch("/sessions/{session_id}/title", response_model=SessionResponse)
async def update_session_title(session_id: UUID, request: UpdateTitleRequest):
    """Set the title of a session.

    Used for auto-title generation from the first user message.
    AC-9: Title derived from first user message (truncated to 80 chars).

    Args:
        session_id: UUID of the session.
        request: UpdateTitleRequest with title string.

    Returns:
        SessionResponse with HTTP 200.

    Raises:
        HTTPException 404: If the session does not exist.
    """
    session = await _repo.set_title(
        session_id=session_id,
        title=request.title,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    return SessionResponse(**session)
