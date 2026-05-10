"""Project repository for read-only access to per-project assistant context.

Used by `AssistantService` (Slice 11) to hydrate `context_instructions` into the
LangGraph system prompt on every assistant turn. Performs a defence-in-depth
ownership check (in addition to the Next.js auth layer) before returning the
context.

Uses psycopg3 (async) for direct SQL queries against PostgreSQL.
Mirrors the connection / logging pattern of `SessionRepository` -- no ORM,
parameterised SQL, `dict_row` factory, autocommit.

Read-only by design: no UPDATE / INSERT / DELETE operations. Project-context
write paths live in the Next.js / Drizzle layer (Slices 02 / 04).
"""

import logging
from typing import Optional
from uuid import UUID

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row

from app.config import settings

logger = logging.getLogger(__name__)


class ProjectRepository:
    """Read-only repository for the `projects` table.

    Currently exposes a single method, `get_context`, used by the assistant
    pipeline to hydrate per-project context with backend-side ownership
    enforcement.
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

    async def get_context(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> tuple[Optional[str], UUID]:
        """Load `context_instructions` for a project after verifying ownership.

        The ownership check is performed in Python (not in the WHERE clause)
        so we can distinguish "project does not exist" from "user does not
        own project" while still surfacing the same 403 error to callers --
        avoiding any existence leak through differing error responses.

        Args:
            project_id: UUID of the project whose context should be loaded.
            user_id: UUID of the user requesting the context. Must match the
                project's `user_id` column.

        Returns:
            Tuple of `(context_instructions, owner_id)` where
            `context_instructions` may be `None` if the user has not yet set
            any context (semantically distinct from an empty string).

        Raises:
            HTTPException: 403 "Project access denied" when the project does
                not exist OR the requesting user is not the owner. The same
                exception is raised in both cases to prevent existence leaks.
        """
        async with await self._get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT context_instructions, user_id
                    FROM projects
                    WHERE id = %s
                    """,
                    (str(project_id),),
                )
                row = await cur.fetchone()

        if row is None:
            # Same error as ownership mismatch -- never leak existence.
            logger.warning(
                "ProjectRepository.get_context: project not found",
                extra={"project_id": str(project_id), "user_id": str(user_id)},
            )
            raise HTTPException(status_code=403, detail="Project access denied")

        owner_id: UUID = row["user_id"]
        if owner_id != user_id:
            logger.warning(
                "ProjectRepository.get_context: ownership mismatch",
                extra={"project_id": str(project_id), "user_id": str(user_id)},
            )
            raise HTTPException(status_code=403, detail="Project access denied")

        context_instructions: Optional[str] = row["context_instructions"]

        # Logging MUST NOT contain the plaintext context. Emit length / presence only.
        logger.info(
            "ProjectRepository.get_context: loaded",
            extra={
                "project_id": str(project_id),
                "user_id": str(user_id),
                "has_context": context_instructions is not None,
                "context_length": (
                    len(context_instructions)
                    if context_instructions is not None
                    else 0
                ),
            },
        )

        return context_instructions, owner_id
