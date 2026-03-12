"""Session repository for CRUD operations on the assistant_sessions table.

Uses psycopg3 (async) for direct SQL queries against PostgreSQL.
No ORM -- all queries are parameterized SQL.
"""

import logging
from typing import Optional
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from app.config import settings

logger = logging.getLogger(__name__)


class SessionRepository:
    """Repository for assistant_sessions table CRUD operations.

    All methods accept an optional psycopg AsyncConnection. If none is provided,
    a new connection is created from settings.database_url.
    """

    def __init__(self, database_url: Optional[str] = None):
        self._database_url = database_url or settings.psycopg_database_url

    async def _get_connection(self) -> psycopg.AsyncConnection:
        """Create a new async connection with dict_row factory."""
        return await psycopg.AsyncConnection.connect(
            self._database_url,
            autocommit=True,
            row_factory=dict_row,
        )

    async def create(self, project_id: UUID) -> dict:
        """Create a new session for the given project.

        Args:
            project_id: UUID of the project this session belongs to.

        Returns:
            Dict with all session fields (id, project_id, title, status,
            message_count, has_draft, last_message_at, created_at, updated_at).
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO assistant_sessions (project_id)
                    VALUES (%s)
                    RETURNING id, project_id, title, status, message_count,
                              has_draft, last_message_at, created_at, updated_at
                    """,
                    (str(project_id),),
                )
                row = await cur.fetchone()
                return dict(row)

    async def get_by_id(self, session_id: UUID) -> Optional[dict]:
        """Get a session by its ID.

        Args:
            session_id: UUID of the session.

        Returns:
            Dict with all session fields, or None if not found.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, project_id, title, status, message_count,
                           has_draft, last_message_at, created_at, updated_at
                    FROM assistant_sessions
                    WHERE id = %s
                    """,
                    (str(session_id),),
                )
                row = await cur.fetchone()
                if row is None:
                    return None
                return dict(row)

    async def list_by_project(self, project_id: UUID) -> list[dict]:
        """List all sessions for a project, sorted by last_message_at DESC.

        Args:
            project_id: UUID of the project.

        Returns:
            List of dicts with all session fields, newest first.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, project_id, title, status, message_count,
                           has_draft, last_message_at, created_at, updated_at
                    FROM assistant_sessions
                    WHERE project_id = %s
                    ORDER BY last_message_at DESC
                    """,
                    (str(project_id),),
                )
                rows = await cur.fetchall()
                return [dict(row) for row in rows]

    async def update(self, session_id: UUID, status: str) -> Optional[dict]:
        """Update a session's status and refresh updated_at.

        Args:
            session_id: UUID of the session.
            status: New status value (e.g. "archived").

        Returns:
            Dict with all session fields after update, or None if not found.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE assistant_sessions
                    SET status = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, project_id, title, status, message_count,
                              has_draft, last_message_at, created_at, updated_at
                    """,
                    (status, str(session_id)),
                )
                row = await cur.fetchone()
                if row is None:
                    return None
                return dict(row)

    async def increment_message_count(self, session_id: UUID) -> Optional[dict]:
        """Increment message_count by 1 and set last_message_at to NOW().

        Args:
            session_id: UUID of the session.

        Returns:
            Dict with all session fields after update, or None if not found.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE assistant_sessions
                    SET message_count = message_count + 1,
                        last_message_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, project_id, title, status, message_count,
                              has_draft, last_message_at, created_at, updated_at
                    """,
                    (str(session_id),),
                )
                row = await cur.fetchone()
                if row is None:
                    return None
                return dict(row)

    async def set_title(self, session_id: UUID, title: str) -> Optional[dict]:
        """Set the title of a session.

        Args:
            session_id: UUID of the session.
            title: New title string.

        Returns:
            Dict with all session fields after update, or None if not found.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE assistant_sessions
                    SET title = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, project_id, title, status, message_count,
                              has_draft, last_message_at, created_at, updated_at
                    """,
                    (title, str(session_id)),
                )
                row = await cur.fetchone()
                if row is None:
                    return None
                return dict(row)
