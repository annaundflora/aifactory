"""Unit tests for ProjectRepository (Slice 05: FastAPI ProjectRepository).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-05-project-repository-fastapi.md.

Mocking Strategy: ``mock_external`` (as specified in Slice-Spec Test-Strategy).
psycopg ``AsyncConnection`` and Cursor are mocked via ``AsyncMock`` /
``MagicMock`` (analog to ``backend/tests/unit/test_image_repository.py``);
no real Postgres connection is opened in unit tests.

The Slice-Spec Mocking-Strategy overrides the test-writer default of
"never mock". DB-Layer mocking is explicitly required here.
"""

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------


def _make_mock_conn(fetchone_return):
    """Build a fully-async-context-manager-aware mock connection.

    Mirrors the helper pattern used in ``test_image_repository.py`` so the
    repository can ``async with await self._get_connection() as conn`` and
    then ``async with conn.cursor() as cur`` without raising.
    """
    mock_cursor = AsyncMock()
    mock_cursor.execute = AsyncMock()
    mock_cursor.fetchone = AsyncMock(return_value=fetchone_return)
    mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
    mock_cursor.__aexit__ = AsyncMock(return_value=False)

    mock_conn = AsyncMock()
    mock_conn.cursor = MagicMock(return_value=mock_cursor)
    mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_conn.__aexit__ = AsyncMock(return_value=False)

    return mock_conn, mock_cursor


# ============================================================================
# AC-1: Happy-path returns ``(context_instructions, owner_id)`` tuple
# ============================================================================


class TestAC1HappyPath:
    """AC-1: GIVEN a projects row (P1, U1, "POD-Shop für Magic-Mushroom-Art")
    WHEN ``get_context(P1, U1)`` is called
    THEN returns tuple ``(context_instructions, owner_id)`` with matching
    values; SQL is parameterised (``WHERE id = %s``).
    """

    @pytest.mark.asyncio
    async def test_get_context_returns_tuple_for_owner(self):
        """AC-1: ``get_context`` returns ``(context, owner_id)`` for the project owner."""
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        user_id = uuid4()
        expected_context = "POD-Shop für Magic-Mushroom-Art"

        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": expected_context,
                "user_id": user_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_context(project_id=project_id, user_id=user_id)

        # THEN: tuple shape and values match.
        assert isinstance(result, tuple)
        assert len(result) == 2
        context, owner_id = result
        assert context == expected_context
        assert owner_id == user_id

    @pytest.mark.asyncio
    async def test_get_context_uses_parameterized_query(self):
        """AC-1: SQL must use parameterised ``%s`` placeholders, no f-string concat.

        The test inspects the executed SQL plus the params tuple to make sure:
        * ``WHERE id = %s`` is present (parameter placeholder).
        * The ``project_id`` value is passed via the params tuple (not embedded
          in the SQL string).
        * The query selects both ``context_instructions`` and ``user_id``.
        """
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        user_id = uuid4()

        mock_conn, mock_cursor = _make_mock_conn(
            fetchone_return={
                "context_instructions": "any",
                "user_id": user_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            await repo.get_context(project_id=project_id, user_id=user_id)

        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        sql = call_args[0][0]
        params = call_args[0][1]

        normalized_sql = " ".join(sql.split())

        # Parameterised placeholder for the project id.
        assert "WHERE id = %s" in normalized_sql, (
            f"SQL must use parameterised WHERE id = %s, got: {normalized_sql}"
        )

        # The project_id MUST NOT appear inside the SQL string itself
        # (string-concat / f-string usage = SQL-Injection risk).
        assert str(project_id) not in normalized_sql, (
            "project_id leaked into SQL string -- looks like f-string "
            "interpolation rather than parameterised query."
        )

        # Both required columns are selected.
        assert "context_instructions" in normalized_sql
        assert "user_id" in normalized_sql
        assert normalized_sql.lower().startswith("select")

        # The project_id value must be carried via the params tuple.
        assert params is not None
        assert len(params) == 1
        assert str(params[0]) == str(project_id)


# ============================================================================
# AC-2: Ownership mismatch raises HTTP 403
# ============================================================================


class TestAC2OwnershipMismatch:
    """AC-2: GIVEN P1 owned by U1, WHEN ``get_context(P1, U2)`` is called,
    THEN ``HTTPException(403, "Project access denied")`` is raised.
    """

    @pytest.mark.asyncio
    async def test_get_context_raises_403_on_ownership_mismatch(self):
        """AC-2: ownership mismatch -> ``HTTPException(403)``, no context returned."""
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        owner_id = uuid4()  # U1
        requesting_user_id = uuid4()  # U2 (different)
        assert owner_id != requesting_user_id

        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": "secret context",
                "user_id": owner_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            with pytest.raises(HTTPException) as exc_info:
                await repo.get_context(
                    project_id=project_id, user_id=requesting_user_id
                )

        # 403, not 404 -- existence must not leak.
        assert exc_info.value.status_code == 403
        assert "denied" in str(exc_info.value.detail).lower()


# ============================================================================
# AC-3: Unknown project raises the SAME exception (no existence leak)
# ============================================================================


class TestAC3NoExistenceLeak:
    """AC-3: GIVEN no project with ``id = P_UNKNOWN`` exists,
    WHEN ``get_context(P_UNKNOWN, U1)`` is called,
    THEN the SAME exception as for an ownership mismatch is raised.
    """

    @pytest.mark.asyncio
    async def test_get_context_raises_403_for_unknown_project(self):
        """AC-3: unknown project must raise the same 403 as AC-2 (no 404 leak)."""
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        user_id = uuid4()

        # Empty result set -- DB returns no row.
        mock_conn, _ = _make_mock_conn(fetchone_return=None)

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            with pytest.raises(HTTPException) as exc_info:
                await repo.get_context(project_id=project_id, user_id=user_id)

        # MUST be 403 (not 404) -- otherwise the API leaks the fact that the
        # project does not exist.
        assert exc_info.value.status_code == 403
        assert "denied" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_unknown_and_mismatch_raise_same_exception(self):
        """AC-3 (cross-check with AC-2): both error paths produce the same
        HTTP status + detail so callers cannot tell the cases apart.
        """
        from app.services.project_repository import ProjectRepository

        # ------ Path A: unknown project ------
        mock_conn_a, _ = _make_mock_conn(fetchone_return=None)
        repo_a = ProjectRepository(
            database_url="postgresql://test:test@localhost/test"
        )

        with patch.object(repo_a, "_get_connection", return_value=mock_conn_a):
            with pytest.raises(HTTPException) as exc_a:
                await repo_a.get_context(project_id=uuid4(), user_id=uuid4())

        # ------ Path B: ownership mismatch ------
        mock_conn_b, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": "anything",
                "user_id": uuid4(),  # different from requester below
            }
        )
        repo_b = ProjectRepository(
            database_url="postgresql://test:test@localhost/test"
        )

        with patch.object(repo_b, "_get_connection", return_value=mock_conn_b):
            with pytest.raises(HTTPException) as exc_b:
                await repo_b.get_context(project_id=uuid4(), user_id=uuid4())

        # Both raise an indistinguishable exception (status code + detail).
        assert exc_a.value.status_code == exc_b.value.status_code == 403
        assert exc_a.value.detail == exc_b.value.detail


# ============================================================================
# AC-4: NULL context returns ``(None, owner_id)``
# ============================================================================


class TestAC4NullContext:
    """AC-4: GIVEN a projects row with ``context_instructions IS NULL``,
    WHEN ``get_context(P1, U1)`` is called as the owner,
    THEN tuple ``(None, owner_id)`` is returned.
    """

    @pytest.mark.asyncio
    async def test_get_context_returns_none_for_null_context(self):
        """AC-4: ``None`` (not empty string) is returned when no context is set."""
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        user_id = uuid4()

        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": None,  # No context yet.
                "user_id": user_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            result = await repo.get_context(project_id=project_id, user_id=user_id)

        context, owner_id = result
        assert context is None, (
            "NULL context must surface as Python None -- semantically "
            "different from an empty string."
        )
        assert context != ""  # Defence: not coerced to empty string.
        assert owner_id == user_id


# ============================================================================
# AC-5: Connection settings + dict_row + autocommit + clean close
# ============================================================================


class TestAC5ConnectionSettings:
    """AC-5: GIVEN a repository call,
    WHEN it opens a psycopg AsyncConnection,
    THEN the connection uses ``settings.psycopg_database_url`` as default,
    ``autocommit=True``, ``row_factory=dict_row``, and is closed via
    ``async with`` (no leak in success or error path).
    """

    @pytest.mark.asyncio
    async def test_repository_default_uses_settings_database_url(self):
        """AC-5: ``__init__`` without an explicit URL falls back to
        ``settings.psycopg_database_url`` (analog to ``SessionRepository``).
        """
        from app.config import settings
        from app.services.project_repository import ProjectRepository

        repo = ProjectRepository()
        # Internal field name must match the SessionRepository pattern.
        assert hasattr(repo, "_database_url")
        assert repo._database_url == settings.psycopg_database_url

    @pytest.mark.asyncio
    async def test_repository_overrides_database_url_when_provided(self):
        """AC-5: an explicit ``database_url`` overrides the settings default."""
        from app.services.project_repository import ProjectRepository

        url = "postgresql://override:override@localhost/override"
        repo = ProjectRepository(database_url=url)
        assert repo._database_url == url

    @pytest.mark.asyncio
    async def test_get_connection_uses_dict_row_and_autocommit(self):
        """AC-5: ``_get_connection`` opens an async connection with
        ``autocommit=True`` and ``row_factory=dict_row``.
        """
        from app.services.project_repository import ProjectRepository
        from psycopg.rows import dict_row

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        # Patch the actual psycopg.AsyncConnection.connect classmethod.
        with patch(
            "app.services.project_repository.psycopg.AsyncConnection.connect",
            new=AsyncMock(return_value=AsyncMock()),
        ) as mock_connect:
            await repo._get_connection()

        mock_connect.assert_awaited_once()
        _, kwargs = mock_connect.call_args
        assert kwargs.get("autocommit") is True
        assert kwargs.get("row_factory") is dict_row

    @pytest.mark.asyncio
    async def test_connection_is_closed_via_context_manager_on_success(self):
        """AC-5: Happy-path closes the connection (``__aexit__`` is awaited)."""
        from app.services.project_repository import ProjectRepository

        user_id = uuid4()
        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": "ctx",
                "user_id": user_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            await repo.get_context(project_id=uuid4(), user_id=user_id)

        mock_conn.__aenter__.assert_awaited()
        mock_conn.__aexit__.assert_awaited()

    @pytest.mark.asyncio
    async def test_connection_is_closed_via_context_manager_on_error(self):
        """AC-5: Error path (ownership mismatch) still closes the connection.

        The 403 must be raised AFTER the ``async with`` block exits, so
        ``__aexit__`` is guaranteed to run -- no leaked connection.
        """
        from app.services.project_repository import ProjectRepository

        owner_id = uuid4()
        requester = uuid4()
        assert owner_id != requester

        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": "ctx",
                "user_id": owner_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with patch.object(repo, "_get_connection", return_value=mock_conn):
            with pytest.raises(HTTPException):
                await repo.get_context(project_id=uuid4(), user_id=requester)

        mock_conn.__aenter__.assert_awaited()
        mock_conn.__aexit__.assert_awaited()


# ============================================================================
# AC-6: Logging redacts the plaintext context value
# ============================================================================


class TestAC6LoggingRedaction:
    """AC-6: GIVEN the repository emits log records,
    WHEN ``get_context`` runs (success or failure),
    THEN no log record contains the plaintext ``context_instructions`` value.
    Length / boolean ``has_context`` markers are allowed.
    """

    @pytest.mark.asyncio
    async def test_logging_does_not_leak_context_plaintext_on_success(
        self, caplog
    ):
        """AC-6: Happy-path logs MUST NOT contain the plaintext context value."""
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        user_id = uuid4()
        secret_context = "POD-Shop für Magic-Mushroom-Art SECRET_TOKEN_42"

        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": secret_context,
                "user_id": user_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with caplog.at_level(logging.DEBUG, logger="app.services.project_repository"):
            with patch.object(repo, "_get_connection", return_value=mock_conn):
                await repo.get_context(project_id=project_id, user_id=user_id)

        # Search the entire formatted log output (including extra-fields
        # that some formatters render, plus the raw record args/extra).
        for record in caplog.records:
            full_text_parts = [record.getMessage(), str(getattr(record, "args", ""))]
            for attr in ("project_id", "user_id", "has_context", "context_length"):
                if hasattr(record, attr):
                    full_text_parts.append(str(getattr(record, attr)))
            # Defensive: also stringify the whole __dict__ to catch any
            # custom extra= field the implementation might add.
            full_text_parts.append(str(record.__dict__))
            joined = " | ".join(full_text_parts)
            assert secret_context not in joined, (
                f"Log record leaked plaintext context: {joined}"
            )

    @pytest.mark.asyncio
    async def test_logging_does_not_leak_context_plaintext_on_ownership_fail(
        self, caplog
    ):
        """AC-6: Ownership-mismatch path must also avoid plaintext leakage."""
        from app.services.project_repository import ProjectRepository

        project_id = uuid4()
        owner_id = uuid4()
        requester = uuid4()
        secret_context = "ANOTHER_SECRET_LEAK_CANARY"

        mock_conn, _ = _make_mock_conn(
            fetchone_return={
                "context_instructions": secret_context,
                "user_id": owner_id,
            }
        )

        repo = ProjectRepository(database_url="postgresql://test:test@localhost/test")

        with caplog.at_level(logging.DEBUG, logger="app.services.project_repository"):
            with patch.object(repo, "_get_connection", return_value=mock_conn):
                with pytest.raises(HTTPException):
                    await repo.get_context(project_id=project_id, user_id=requester)

        for record in caplog.records:
            full_dump = str(record.__dict__) + " " + record.getMessage()
            assert secret_context not in full_dump, (
                f"Log record leaked plaintext context on error path: {full_dump}"
            )
