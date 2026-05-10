# Slice 05: FastAPI ProjectRepository (Read-only Context)

> **Slice 05 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-project-repository-fastapi` |
| **Test** | `cd backend && python -m pytest tests/unit/test_project_repository.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["01-schema-migration"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + psycopg3 (async). Backend-Test-Konvention liegt in `backend/tests/unit/`. Mocking-Pattern aus `tests/unit/test_image_repository.py` ist Vorbild (DB-Layer wird via `unittest.mock.AsyncMock` abstrahiert; keine echte Postgres-Connection im Unit-Test).

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + psycopg3-async` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_project_repository.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/ -v -k project_repository` (optional, falls echter Test-DB-Container verfügbar) |
| **Acceptance Command** | `cd backend && python -m pytest tests/unit/test_project_repository.py tests/unit/test_assistant_dto_route.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | n/a (Repository ist kein HTTP-Endpoint; wird in Slice 11 von `AssistantService` konsumiert) |
| **Mocking Strategy** | `mock_external` (psycopg `AsyncConnection` + Cursor via `AsyncMock`/`MagicMock`, analog zu `tests/unit/test_image_repository.py`) |

---

## Ziel

Ein read-only Python-Repository, das `projects.context_instructions` für einen gegebenen `project_id` lädt und die Ownership gegen `user_id` prüft, damit Slice 11 (`AssistantService`) den Projekt-Context für jeden Assistant-Turn in den System-Prompt injizieren kann. Defence-in-depth: zweite Ownership-Prüfung backend-seitig, zusätzlich zum Next.js-Auth-Layer.

---

## Acceptance Criteria

1) **GIVEN** eine `projects`-Zeile mit `id = P1`, `user_id = U1`, `context_instructions = "POD-Shop für Magic-Mushroom-Art"`
   **WHEN** `ProjectRepository.get_context(project_id=P1, user_id=U1)` aufgerufen wird
   **THEN** der Aufruf liefert ein Tuple `(context_instructions: str, owner_id: UUID)` mit `context_instructions == "POD-Shop für Magic-Mushroom-Art"` und `owner_id == U1`; SQL-Query selektiert `context_instructions` und `user_id` aus `projects` mit parametrisiertem `WHERE id = %s` (kein String-Concat).

2) **GIVEN** eine `projects`-Zeile mit `id = P1`, `user_id = U1`
   **WHEN** `get_context(project_id=P1, user_id=U2)` aufgerufen wird (User U2 ≠ Owner U1)
   **THEN** der Aufruf wirft `HTTPException(status_code=403, detail="Project access denied")` (oder semantisch äquivalente Exception, siehe Constraints — finale Exception-Klasse folgt Repo-Konvention); KEIN Context-Wert wird zurückgegeben; KEINE Information über Existenz/Nicht-Existenz wird geleakt (gleiche Exception wie für nicht-existente Projekte, siehe AC-3).

3) **GIVEN** kein Projekt mit `id = P_UNKNOWN` existiert in der DB
   **WHEN** `get_context(project_id=P_UNKNOWN, user_id=U1)` aufgerufen wird
   **THEN** der Aufruf wirft dieselbe Exception wie bei Ownership-Mismatch (HTTP 403 oder semantisch äquivalent) — UI darf keinen 404-vs-403-Unterschied sehen, um Existenz nicht zu leaken; siehe architecture.md → Section "Authentication & Authorization" → "404 if `userId` mismatch (do not leak existence)".

4) **GIVEN** eine `projects`-Zeile mit `id = P1`, `user_id = U1`, `context_instructions IS NULL` (User hat noch keinen Context gesetzt)
   **WHEN** `get_context(project_id=P1, user_id=U1)` aufgerufen wird
   **THEN** der Aufruf liefert Tuple `(None, U1)` — `None` repräsentiert "kein Context gesetzt", semantisch unterschiedlich zum leeren String (siehe Slice 01 Constraints, "kein Default-Wert für context_instructions"); Slice 11 prüft auf `None` für Block-Insertion-Entscheidung.

5) **GIVEN** ein Repository-Aufruf mit `project_id = P1`, `user_id = U1`
   **WHEN** das Repository eine psycopg `AsyncConnection` öffnet
   **THEN** die Connection nutzt `settings.psycopg_database_url` als Default (analog `SessionRepository.__init__` in `backend/app/services/session_repository.py:26-27`), `autocommit=True`, `row_factory=dict_row`; die Connection wird via `async with`-Context-Manager geschlossen (kein Connection-Leak im Happy- oder Error-Path).

6) **GIVEN** der Repository-Aufruf wird mit Logging instrumentiert
   **WHEN** `get_context` ausgeführt wird (egal ob Success oder Ownership-Fail)
   **THEN** das Logging enthält NIEMALS den Klartext-Wert von `context_instructions` (nur Längen-Marker oder Boolean "has_context"), siehe architecture.md → Section "Data Protection" → "Logging in `AssistantService` redacts to length-only".

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Mocking-Vorbild ist `backend/tests/unit/test_image_repository.py` (AsyncMock für Cursor, MagicMock für `cursor()`-Aufruf, AsyncMock für `__aenter__/__aexit__`). Test-Writer implementiert Assertions selbstständig basierend auf den ACs.

### Test-Datei: `backend/tests/unit/test_project_repository.py`

<test_spec>
```python
# AC-1: Happy-Path liefert (context, owner_id)
@pytest.mark.skip(reason='AC-1: get_context returns tuple (context, owner_id) for project owner')
@pytest.mark.asyncio
async def test_get_context_returns_tuple_for_owner():
    ...

# AC-1: SQL-Query ist parametrisiert (kein String-Concat)
@pytest.mark.skip(reason='AC-1: SQL uses parameterized %s placeholders, not f-string interpolation')
@pytest.mark.asyncio
async def test_get_context_uses_parameterized_query():
    ...

# AC-2: Ownership-Mismatch wirft HTTP 403
@pytest.mark.skip(reason='AC-2: get_context raises HTTPException(403) when user_id != owner_id')
@pytest.mark.asyncio
async def test_get_context_raises_403_on_ownership_mismatch():
    ...

# AC-3: Unbekanntes Projekt wirft dieselbe Exception wie AC-2 (kein Existence-Leak)
@pytest.mark.skip(reason='AC-3: get_context raises same 403 for unknown project as for ownership mismatch')
@pytest.mark.asyncio
async def test_get_context_raises_403_for_unknown_project():
    ...

# AC-4: NULL-Context liefert (None, owner_id)
@pytest.mark.skip(reason='AC-4: get_context returns (None, owner_id) when context_instructions IS NULL')
@pytest.mark.asyncio
async def test_get_context_returns_none_for_null_context():
    ...

# AC-5: Connection nutzt settings + dict_row + autocommit, wird sauber geschlossen
@pytest.mark.skip(reason='AC-5: Repository uses settings.psycopg_database_url + dict_row + autocommit and closes connection')
@pytest.mark.asyncio
async def test_repository_uses_correct_connection_settings():
    ...

# AC-6: Logging enthält keinen Klartext-Context
@pytest.mark.skip(reason='AC-6: Logging redacts context_instructions to length-only marker')
@pytest.mark.asyncio
async def test_logging_does_not_leak_context_plaintext():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-schema-migration` | `projects.context_instructions` Spalte (text, nullable) | Postgres column | psycopg-Query liest Spalte ohne Schema-Error; `\d projects` zeigt Spalte vorhanden |
| `slice-01-schema-migration` | `projects.user_id` Spalte (existiert bereits, unverändert) | Postgres column | Ownership-Check vergleicht gegen diese Spalte |
| Bestehender Code | `app.config.settings.psycopg_database_url` | str | Existierende Config-Konstante (siehe `backend/app/services/session_repository.py:27`) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ProjectRepository` Klasse | Python class | `slice-11-prompts-context-block` (`AssistantService`) | `__init__(database_url: Optional[str] = None)` analog `SessionRepository` |
| `ProjectRepository.get_context` | async method | `slice-11-prompts-context-block` | `async def get_context(project_id: UUID, user_id: UUID) -> tuple[str \| None, UUID]` — raises HTTPException(403) bei Mismatch oder Unknown |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/services/project_repository.py` — NEW: Klasse `ProjectRepository` mit `__init__` (analog `SessionRepository`) und einer Methode `async def get_context(project_id: UUID, user_id: UUID) -> tuple[str | None, UUID]`. Read-only (kein UPDATE/INSERT/DELETE). Single-Query-Implementation (ein SELECT mit WHERE auf `id` + Ownership-Check im Python-Code, NICHT im WHERE — siehe Constraints AC-3-Begründung).
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt `backend/tests/unit/test_project_repository.py` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN UPDATE/INSERT/DELETE — Repository ist explizit read-only; Schreibpfade gehören zu Slice 02/04 (Next.js/Drizzle), NICHT zu FastAPI
- KEINE Caching-Logik — jeder Aufruf macht eine frische DB-Query (Frequenz: 1× pro Assistant-Turn, akzeptable Last)
- KEIN Aufruf in einer Route (das macht Slice 11 — `AssistantService` instanziiert + ruft `ProjectRepository`)
- KEINE Pydantic-DTO-Definition für Return-Type — schlankes Tuple reicht für den einzigen Consumer (Slice 11)
- KEINE Logik für `context_updated_at` — der Consumer (System-Prompt-Composer) nutzt nur `context_instructions`; falls später UI-Anzeige in FastAPI-Pfad benötigt wird, separater Slice
- KEINE Escape-/Sanitize-Logik im Repository — das macht `_escape_project_context` in Slice 11 (`backend/app/agent/prompts.py`)

**Technische Constraints:**
- psycopg3 (async): `AsyncConnection` + `dict_row` + `autocommit=True` — exaktes Pattern aus `backend/app/services/session_repository.py:29-35` spiegeln
- SQL-Query MUSS parametrisiert sein (`WHERE id = %s`), KEIN String-Format/f-String mit User-Input — SQL-Injection-Schutz
- Ownership-Check geschieht im Python-Code NACH SELECT (nicht via `WHERE id = %s AND user_id = %s`), damit Existenz-Check und Ownership-Check unterschieden werden können — beide werfen aber dieselbe Exception nach außen (AC-3, kein Existence-Leak)
- Exception-Typ: `fastapi.HTTPException(status_code=403, detail=...)` — analog Defence-in-depth-Pattern, FastAPI fängt das in der Route-Layer und liefert sauberes 403; alternativ Repo-Konvention (z.B. eigene Exception-Klasse) — Test-Writer prüft AC-2/3 gegen die gewählte Variante
- Logging via `logging.getLogger(__name__)` — analog `SessionRepository:16`; KEIN Klartext-Context im Log-Output
- Type Hints PFLICHT: `UUID`, `Optional[str]`, `tuple[str | None, UUID]` — modernes Python 3.10+-Syntax (Backend nutzt das bereits, siehe `session_repository.py`)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/services/session_repository.py` | Strukturelles Vorbild — Connection-Pattern (`_get_connection`), Constructor-Signatur, Logging-Setup, `dict_row`-Factory. NICHT importieren, sondern Pattern spiegeln. |
| `backend/app/config.py` (`settings.psycopg_database_url`) | Import + nutzen — bestehende Connection-URL-Konstante |
| `backend/tests/unit/test_image_repository.py` | Mocking-Vorbild für Test-Writer (AsyncMock-Pattern für psycopg) — keine direkte Code-Abhängigkeit, nur Test-Konvention |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Services & Processing" → Zeile `ProjectRepository.get_context` (Ziel-Signatur, Side-Effects, 403-Verhalten)
- Architecture: gleiche Datei → Section "Authentication & Authorization" → "FastAPI assistant endpoints … `ProjectRepository.get_context` re-verifies ownership before returning context | Defence-in-depth"
- Architecture: gleiche Datei → Section "Migration Map" → Zeile `backend/app/services/project_repository.py (NEW FILE)` ("Read-only repository for `projects.context_instructions` (ownership-checked); psycopg query mirroring `SessionRepository`")
- Architecture: gleiche Datei → Section "Data Protection" → "Logging in `AssistantService` redacts to length-only" (gilt für Repository ebenso)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Business Rule "Projekt-Context wird nur geladen, wenn User Projekt-Ownership hat (existierende Auth-Rules)"
- Wireframes: nicht relevant für diesen Slice (Backend-only, kein UI)
