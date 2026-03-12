# Slice 02: FastAPI Server + Health Endpoint

> **Slice 2 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-fastapi-server-health` |
| **Test** | `cd backend && python -m pytest tests/test_server_health.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-python-projekt-setup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/test_server_health.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/test_server_health.py -v -k integration` |
| **Acceptance Command** | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 & sleep 2 && curl -s http://localhost:8000/api/assistant/health && kill %1` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

FastAPI Application Factory mit CORS-Middleware und Lifespan-Handler erstellen, sodass der Server via Uvicorn startet und ein Health-Check Endpoint unter `GET /api/assistant/health` erreichbar ist. Dies bildet das HTTP-Fundament fuer alle nachfolgenden Backend-Slices (LangGraph Agent, SSE Streaming, Session Management).

---

## Acceptance Criteria

1) GIVEN die installierte `app` Package aus Slice 01
   WHEN `uvicorn app.main:app --host 0.0.0.0 --port 8000` ausgefuehrt wird
   THEN startet der Server ohne Fehler und loggt "Uvicorn running on http://0.0.0.0:8000"

2) GIVEN der laufende FastAPI Server
   WHEN `GET /api/assistant/health` aufgerufen wird
   THEN antwortet der Server mit HTTP 200 und JSON-Body `{"status": "ok", "version": "1.0.0"}`

3) GIVEN der laufende FastAPI Server
   WHEN `GET /api/assistant/health` aufgerufen wird mit Header `Accept: application/json`
   THEN enthaelt der Response-Header `content-type: application/json`

4) GIVEN die FastAPI Application in `backend/app/main.py`
   WHEN die App-Instanz inspiziert wird
   THEN ist CORS-Middleware konfiguriert mit `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]`

5) GIVEN die FastAPI Application in `backend/app/main.py`
   WHEN die App-Instanz inspiziert wird
   THEN existiert ein Lifespan-Handler (async context manager) der als Platzhalter fuer spaetere DB-Connection dient

6) GIVEN der laufende FastAPI Server
   WHEN `GET /nonexistent-route` aufgerufen wird
   THEN antwortet der Server mit HTTP 404 (nicht 500)

7) GIVEN die Health-Route in `backend/app/routes/health.py`
   WHEN das Modul inspiziert wird
   THEN ist die Route als `APIRouter` definiert und in `main.py` via `include_router` eingebunden, mit Prefix `/api/assistant`

8) GIVEN die `backend/app/main.py`
   WHEN die Version im Health-Response inspiziert wird
   THEN stammt der Wert `"1.0.0"` aus `settings.app_version` (nicht hardcoded in der Route)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest mit httpx (FastAPI TestClient)

### Test-Datei: `backend/tests/test_server_health.py`

<test_spec>
```python
import pytest

# AC-1: Server startet ohne Fehler
@pytest.mark.skip(reason="AC-1")
def test_app_instance_creates_without_error():
    ...

# AC-2: Health Endpoint antwortet mit 200 und korrektem JSON
@pytest.mark.skip(reason="AC-2")
def test_health_endpoint_returns_ok():
    ...

# AC-3: Health Endpoint liefert JSON Content-Type
@pytest.mark.skip(reason="AC-3")
def test_health_endpoint_content_type_json():
    ...

# AC-4: CORS-Middleware ist konfiguriert
@pytest.mark.skip(reason="AC-4")
def test_cors_middleware_configured():
    ...

# AC-5: Lifespan-Handler existiert
@pytest.mark.skip(reason="AC-5")
def test_lifespan_handler_exists():
    ...

# AC-6: Unbekannte Route gibt 404 zurueck
@pytest.mark.skip(reason="AC-6")
def test_unknown_route_returns_404():
    ...

# AC-7: Health-Route ist via APIRouter eingebunden
@pytest.mark.skip(reason="AC-7")
def test_health_route_uses_api_router():
    ...

# AC-8: Version stammt aus Settings
@pytest.mark.skip(reason="AC-8")
def test_health_version_from_settings():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-python-projekt-setup` | `app.config.settings` | Settings-Instanz | `settings.app_version` liefert `"1.0.0"` |
| `slice-01-python-projekt-setup` | `backend/pyproject.toml` | Installierbare Deps | `fastapi`, `uvicorn` sind installiert |
| `slice-01-python-projekt-setup` | `backend/app/routes/__init__.py` | Package-Verzeichnis | Verzeichnis existiert mit `__init__.py` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.main.app` | FastAPI Application | slice-03, slice-04, slice-13a | `from app.main import app` (oder `create_app()`) |
| `app.main.lifespan` | Lifespan Context Manager | slice-03 (PostgresSaver Setup) | Lifespan-Handler fuer DB-Connection-Pool |
| Health-Route Pattern | APIRouter + `include_router` | slice-04, slice-13a | Router-Registrierung in `main.py` als Vorlage |
| Laufender Server | HTTP auf Port 8000 | slice-04, slice-10, slice-22 | `uvicorn app.main:app --reload` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/main.py` -- FastAPI Application Factory mit CORS, Lifespan, Router-Einbindung
- [ ] `backend/app/routes/__init__.py` -- Package-Marker (kann leer sein, existiert ggf. bereits aus Slice 01)
- [ ] `backend/app/routes/health.py` -- Health-Check Endpoint als APIRouter
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINEN LangGraph Agent (kommt in Slice 03)
- Dieser Slice erstellt KEINE SSE-Streaming Endpoints (kommt in Slice 04)
- Dieser Slice erstellt KEINE DB-Verbindung im Lifespan (nur Platzhalter-Struktur, konkrete Connection kommt in Slice 03)
- CORS `allow_origins=["*"]` ist bewusst offen fuer Entwicklung; Einschraenkung in Production ist kein Scope dieses Slices

**Technische Constraints:**
- FastAPI mit Lifespan-Pattern (nicht `@app.on_event("startup")` -- deprecated)
- Health-Route als separater `APIRouter` in eigener Datei (nicht inline in `main.py`)
- Version aus `settings.app_version` lesen (Dependency Injection via Import, nicht hardcoded)
- Router-Prefix: `/api/assistant` (konsistent mit architecture.md API Design)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design" (Base Path, Health Endpoint)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Architecture Layers" (FastAPI Routes Layer)
- slim-slices: `specs/phase-3/2026-03-11-prompt-assistant/slim-slices.md` -> Slice 02 (Scope + Done-Signal)
