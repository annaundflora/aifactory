# Slice 13a: Session-Tabelle + Repository (Backend)

> **Slice 13a von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13a-session-repository-backend` |
| **Test** | `cd backend && python -m pytest tests/test_session_repository.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-sse-streaming-endpoint", "slice-05-db-schema-drizzle"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder) |
| **Test Command** | `cd backend && python -m pytest tests/test_session_repository.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/test_session_repository.py -v -k integration` |
| **Acceptance Command** | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 & sleep 2 && curl -s http://localhost:8000/api/assistant/sessions?project_id=00000000-0000-0000-0000-000000000001 && kill %1` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (DB-Calls werden in Unit-Tests gemockt, Integration-Tests gegen echte DB) |

---

## Ziel

Python-seitiges Session-Repository bereitstellen, das CRUD-Operationen fuer die `assistant_sessions` Tabelle via psycopg3 ausfuehrt. Dazu vier REST-Endpoints (POST, GET-Liste, GET-Detail, PATCH) in FastAPI einbinden, die Session-Erstellung, -Abfrage und -Archivierung ermoeglichen.

---

## Acceptance Criteria

1) GIVEN ein laufender FastAPI Server mit registriertem Sessions-Router
   WHEN `POST /api/assistant/sessions` mit Body `{"project_id": "<valid-uuid>"}` aufgerufen wird
   THEN antwortet der Server mit HTTP 201 und einem JSON-Body der `id` (UUID), `project_id`, `title` (null), `status` ("active"), `message_count` (0), `has_draft` (false), `created_at` und `updated_at` enthaelt

2) GIVEN eine existierende Session mit bekannter `id`
   WHEN `GET /api/assistant/sessions/<id>` aufgerufen wird
   THEN antwortet der Server mit HTTP 200 und dem vollstaendigen Session-Objekt (alle Felder aus AC-1)

3) GIVEN keine Session mit der angegebenen `id` existiert
   WHEN `GET /api/assistant/sessions/<non-existent-uuid>` aufgerufen wird
   THEN antwortet der Server mit HTTP 404 und `{"detail": "Session nicht gefunden"}`

4) GIVEN zwei Sessions existieren fuer `project_id` "P1" (Session A: `last_message_at` = 10:00, Session B: `last_message_at` = 11:00) und eine Session fuer `project_id` "P2"
   WHEN `GET /api/assistant/sessions?project_id=P1` aufgerufen wird
   THEN antwortet der Server mit HTTP 200 und einem Array mit genau 2 Sessions, sortiert nach `last_message_at` DESC (Session B zuerst)

5) GIVEN `GET /api/assistant/sessions` ohne Query-Parameter `project_id`
   WHEN der Request ausgefuehrt wird
   THEN antwortet der Server mit HTTP 422 (Validation Error)

6) GIVEN eine existierende aktive Session mit bekannter `id`
   WHEN `PATCH /api/assistant/sessions/<id>` mit Body `{"status": "archived"}` aufgerufen wird
   THEN antwortet der Server mit HTTP 200, das Session-Objekt hat `status` = "archived" und `updated_at` ist aktualisiert

7) GIVEN eine existierende Session
   WHEN `PATCH /api/assistant/sessions/<id>` mit Body `{"status": "invalid_value"}` aufgerufen wird
   THEN antwortet der Server mit HTTP 422 (Validation Error)

8) GIVEN das `SessionRepository`
   WHEN `increment_message_count(session_id)` aufgerufen wird
   THEN wird `message_count` um 1 erhoeht und `last_message_at` auf NOW() gesetzt

9) GIVEN das `SessionRepository`
   WHEN `set_title(session_id, "Mein erstes Bild")` aufgerufen wird
   THEN wird das `title`-Feld der Session auf "Mein erstes Bild" gesetzt

10) GIVEN `POST /api/assistant/sessions` mit Body `{"project_id": "nicht-eine-uuid"}`
    WHEN der Request ausgefuehrt wird
    THEN antwortet der Server mit HTTP 422 (Validation Error: project_id muss UUID sein)

11) GIVEN die Session-DTOs in `dtos.py`
    WHEN `CreateSessionRequest`, `UpdateSessionRequest`, `SessionResponse` und `SessionListResponse` inspiziert werden
    THEN sind alle Felder mit korrekten Pydantic-Typen definiert gemaess architecture.md Section "Data Transfer Objects"

12) GIVEN die Sessions-Route in `backend/app/routes/sessions.py`
    WHEN das Modul inspiziert wird
    THEN ist die Route als `APIRouter` definiert und in `main.py` via `include_router` eingebunden

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest mit httpx (FastAPI TestClient)

### Test-Datei: `backend/tests/test_session_repository.py`

<test_spec>
```python
import pytest

# AC-1: POST erstellt neue Session
@pytest.mark.skip(reason="AC-1")
def test_create_session_returns_201_with_session_data():
    ...

# AC-2: GET by id liefert Session
@pytest.mark.skip(reason="AC-2")
def test_get_session_by_id_returns_200():
    ...

# AC-3: GET by id fuer nicht-existierende Session
@pytest.mark.skip(reason="AC-3")
def test_get_session_by_id_returns_404_when_not_found():
    ...

# AC-4: GET list by project_id sortiert nach last_message_at DESC
@pytest.mark.skip(reason="AC-4")
def test_list_sessions_by_project_id_sorted_desc():
    ...

# AC-5: GET list ohne project_id liefert 422
@pytest.mark.skip(reason="AC-5")
def test_list_sessions_without_project_id_returns_422():
    ...

# AC-6: PATCH archiviert Session
@pytest.mark.skip(reason="AC-6")
def test_patch_session_archives_successfully():
    ...

# AC-7: PATCH mit ungueltigem Status liefert 422
@pytest.mark.skip(reason="AC-7")
def test_patch_session_rejects_invalid_status():
    ...

# AC-8: increment_message_count erhoeht Zaehler
@pytest.mark.skip(reason="AC-8")
def test_increment_message_count():
    ...

# AC-9: set_title setzt Titel
@pytest.mark.skip(reason="AC-9")
def test_set_title():
    ...

# AC-10: POST mit ungueltiger project_id liefert 422
@pytest.mark.skip(reason="AC-10")
def test_create_session_rejects_invalid_project_id():
    ...

# AC-11: Session-DTOs korrekt definiert
@pytest.mark.skip(reason="AC-11")
def test_session_dtos_have_correct_fields():
    ...

# AC-12: Route als APIRouter eingebunden
@pytest.mark.skip(reason="AC-12")
def test_sessions_route_uses_api_router():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-fastapi-server-health` | `app.main.app` | FastAPI Application | Router-Registrierung via `include_router` |
| `slice-04-sse-streaming-endpoint` | `app.models.dtos` | Pydantic DTOs (Modul) | Datei existiert, wird erweitert |
| `slice-05-db-schema-drizzle` | `assistant_sessions` Tabelle | PostgreSQL Tabelle | Tabelle existiert nach `drizzle-kit push` |
| `slice-01-python-projekt-setup` | `app.config.settings` | Settings-Instanz | `settings.database_url` vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.services.session_repository.SessionRepository` | Repository-Klasse | slice-13c, slice-04 (erweiterbar) | `create(project_id) -> Session`, `get_by_id(id) -> Session`, `list_by_project(project_id) -> list[Session]`, `update(id, status) -> Session`, `increment_message_count(id)`, `set_title(id, title)` |
| `app.routes.sessions` | APIRouter | slice-13b, slice-13c | POST/GET/PATCH Endpoints unter `/api/assistant/sessions` |
| `app.models.dtos.CreateSessionRequest` | Pydantic Model | slice-13c | DTO mit `project_id: UUID` |
| `app.models.dtos.SessionResponse` | Pydantic Model | slice-13b, slice-13c | DTO mit allen Session-Feldern |
| `app.models.dtos.SessionListResponse` | Pydantic Model | slice-13b | DTO mit `sessions: list[SessionResponse]` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/services/session_repository.py` -- SessionRepository mit CRUD-Methoden via psycopg3 (create, get_by_id, list_by_project, update, increment_message_count, set_title)
- [ ] `backend/app/routes/sessions.py` -- FastAPI APIRouter mit POST, GET (list + detail), PATCH Endpoints
- [ ] `backend/app/models/dtos.py` -- Erweitert um CreateSessionRequest, UpdateSessionRequest, SessionResponse, SessionListResponse
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE LangGraph-Integration (Session-State aus Checkpointer lesen kommt in Slice 13c)
- Dieser Slice erstellt KEINE Session-Erstellung bei erster Chat-Nachricht (kommt in Slice 10/13c)
- Dieser Slice erstellt KEINE Frontend-Komponenten (Session-Liste UI kommt in Slice 13b)
- Kein Auto-Title-Mechanismus (kommt in Slice 13c)
- Kein Session-Limit-Check (100 Messages) in den Endpoints -- das liegt in Slice 04 (SSE Streaming)

**Technische Constraints:**
- psycopg3 (async) fuer direkte SQL-Queries, KEIN ORM (laut Scope-Anforderung)
- Pydantic BaseModel fuer DTO-Validierung (FastAPI-native)
- DB-Connection-Pool wird aus `app.main` Lifespan uebernommen (Slice 02 Pattern)
- Router-Prefix: `/api/assistant` (konsistent mit Slice 02, Slice 04)
- UUID-Validierung ueber Pydantic `UUID4` Typ
- `UpdateSessionRequest.status` als Literal/Enum mit einzigem erlaubten Wert `"archived"`

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design > Endpoints" (POST/GET/PATCH Sessions)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Data Transfer Objects" (Session DTOs)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Database Schema > Schema Details > Table: assistant_sessions"
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Server Logic > Services" (SessionRepository Verantwortung)
