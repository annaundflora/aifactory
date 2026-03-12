# Slice 01: Python Projekt-Setup

> **Slice 1 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-python-projekt-setup` |
| **Test** | `cd backend && pip install -e . && python -c "from app.config import settings"` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/ -v` |
| **Integration Command** | `cd backend && pip install -e . && python -c "from app.config import settings"` |
| **Acceptance Command** | `cd backend && pip install -e . && python -c "from app.config import settings; print(settings.model_dump())"` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | n/a (kein Server in diesem Slice) |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Python-Backend Projektstruktur im `backend/` Subfolder anlegen, sodass alle nachfolgenden Slices (FastAPI Server, LangGraph Agent, SSE Streaming) eine saubere, installierbare Codebasis vorfinden. Config-Management via pydantic-settings mit allen benoetigten Environment-Variablen.

---

## Acceptance Criteria

1) GIVEN das Repository ohne `backend/` Verzeichnis
   WHEN der Implementer alle Deliverables erstellt hat
   THEN existiert die Ordnerstruktur: `backend/app/`, `backend/app/services/`, `backend/app/routes/`, `backend/app/agent/`, `backend/app/models/` (jeweils mit `__init__.py`)

2) GIVEN die erstellte `backend/pyproject.toml`
   WHEN `cd backend && pip install -e .` ausgefuehrt wird
   THEN laeuft die Installation erfolgreich durch (Exit-Code 0) und alle Dependencies sind installiert: `fastapi`, `langgraph`, `langchain-openai`, `langgraph-checkpoint-postgres`, `sse-starlette`, `pydantic-settings`, `psycopg`, `Pillow`, `langsmith`, `uvicorn`

3) GIVEN die installierte `app` Package
   WHEN `python -c "from app.config import settings"` ausgefuehrt wird
   THEN importiert das Modul ohne Fehler und `settings` ist eine Instanz der Settings-Klasse (pydantic-settings `BaseSettings`)

4) GIVEN die `backend/app/config.py` mit pydantic-settings
   WHEN die Settings-Klasse inspiziert wird
   THEN enthaelt sie mindestens folgende Felder: `database_url` (str), `openrouter_api_key` (str), `replicate_api_token` (str, default ""), `langsmith_api_key` (str, default ""), `langsmith_tracing` (bool, default False), `assistant_model_default` (str, default "anthropic/claude-sonnet-4.6"), `app_version` (str, default "1.0.0")

5) GIVEN die erstellte `backend/.env.example`
   WHEN ein Entwickler die Datei liest
   THEN enthaelt sie alle benoetigten Environment-Variablen als kommentierte Beispiele (passend zu den Settings-Feldern)

6) GIVEN die `backend/pyproject.toml`
   WHEN die Projekt-Metadaten inspiziert werden
   THEN ist `name` = "aifactory-backend", `python_requires` >= "3.11" und das Projekt nutzt ein modernes Build-System (`hatchling` oder `setuptools` mit `pyproject.toml`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest

### Test-Datei: `backend/tests/test_project_setup.py`

<test_spec>
```python
import pytest

# AC-1: Ordnerstruktur existiert
@pytest.mark.skip(reason="AC-1")
def test_directory_structure_exists():
    ...

# AC-2: pip install -e . erfolgreich
@pytest.mark.skip(reason="AC-2")
def test_package_installable():
    ...

# AC-3: settings importierbar
@pytest.mark.skip(reason="AC-3")
def test_settings_importable():
    ...

# AC-4: Settings-Felder vorhanden
@pytest.mark.skip(reason="AC-4")
def test_settings_fields_present():
    ...

# AC-5: .env.example vollstaendig
@pytest.mark.skip(reason="AC-5")
def test_env_example_contains_all_vars():
    ...

# AC-6: pyproject.toml Metadaten korrekt
@pytest.mark.skip(reason="AC-6")
def test_pyproject_metadata():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (keine) | -- | -- | -- |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.config.settings` | Settings-Instanz | slice-02, slice-03, slice-04, slice-20, slice-22 | `settings.database_url`, `settings.openrouter_api_key`, `settings.replicate_api_token`, `settings.langsmith_api_key`, `settings.langsmith_tracing`, `settings.assistant_model_default`, `settings.app_version` |
| `backend/pyproject.toml` | Installierbare Package-Definition | slice-02, slice-03, slice-04 | `pip install -e .` installiert alle Dependencies |
| Ordnerstruktur `backend/app/{services,routes,agent,models}/` | Package-Verzeichnisse mit `__init__.py` | slice-02, slice-03, slice-04 | Python-Module importierbar via `from app.services import ...` etc. |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/pyproject.toml` -- Projekt-Definition mit allen Dependencies und Build-System
- [ ] `backend/app/__init__.py` -- Package-Root (plus `__init__.py` in allen Sub-Packages: services, routes, agent, models)
- [ ] `backend/app/config.py` -- pydantic-settings BaseSettings mit allen env vars
- [ ] `backend/.env.example` -- Kommentierte Beispiel-Datei fuer alle Environment-Variablen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINEN FastAPI Server (kommt in Slice 02)
- Dieser Slice erstellt KEINEN LangGraph Agent (kommt in Slice 03)
- Dieser Slice erstellt KEINE Routen oder Endpoints
- `.env.example` ist Dokumentation, KEINE echte `.env` Datei mit Secrets

**Technische Constraints:**
- Python >= 3.11 (siehe architecture.md -> Integrations: "FastAPI: Python >= 3.10", wir nehmen 3.11 fuer modernere Features)
- pydantic-settings fuer Config-Management (nicht python-dotenv direkt)
- `pyproject.toml` als einzige Projekt-Definition (kein `setup.py`, kein `requirements.txt`)
- Alle `__init__.py` Dateien koennen leer sein (reine Package-Marker)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Constraints & Integrations" (Dependencies + Versionen)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Technology Decisions" (Monorepo Subfolder-Entscheidung)
- slim-slices: `specs/phase-3/2026-03-11-prompt-assistant/slim-slices.md` -> Slice 01 (Scope + Done-Signal)
