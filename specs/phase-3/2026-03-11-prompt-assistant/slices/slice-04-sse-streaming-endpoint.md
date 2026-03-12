# Slice 04: SSE Streaming Endpoint

> **Slice 4 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-sse-streaming-endpoint` |
| **Test** | `cd backend && python -m pytest tests/test_sse_streaming.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-langgraph-agent"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/test_sse_streaming.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/test_sse_streaming.py -v -k integration` |
| **Acceptance Command** | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 & sleep 2 && curl -s -X POST http://localhost:8000/api/assistant/sessions/test-123/messages -H "Content-Type: application/json" -d '{"content":"Hallo"}' && kill %1` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (LangGraph Agent-Calls werden in Tests gemockt) |

---

## Ziel

SSE-Streaming Endpoint fuer Chat-Messages bereitstellen: POST-Route nimmt User-Nachrichten entgegen, leitet sie an den LangGraph Agent weiter und streamt die Antwort als Server-Sent Events (text-delta, tool-call-result, text-done, error) zurueck. Rate Limiting schuetzt vor Missbrauch.

---

## Acceptance Criteria

1) GIVEN ein laufender FastAPI Server mit registriertem Messages-Router
   WHEN `POST /api/assistant/sessions/{id}/messages` mit Body `{"content": "Hallo"}` aufgerufen wird
   THEN antwortet der Server mit HTTP 200, Content-Type `text/event-stream`, und einem SSE-Stream

2) GIVEN ein laufender SSE-Stream als Antwort auf eine gueltige Nachricht
   WHEN der LangGraph Agent Text-Tokens generiert
   THEN enthaelt der Stream mindestens ein Event mit `event: text-delta` und `data: {"content": "<token>"}` (JSON-String)

3) GIVEN ein laufender SSE-Stream
   WHEN der Agent seine Antwort abgeschlossen hat
   THEN wird als letztes Event `event: text-done` mit `data: {}` gesendet

4) GIVEN ein SSE-Stream waehrend dem der Agent ein Tool aufruft
   WHEN das Tool-Ergebnis vorliegt
   THEN wird ein Event `event: tool-call-result` mit `data: {"tool": "<tool_name>", "data": <tool_output>}` gesendet

5) GIVEN ein SSE-Stream bei dem ein Fehler im LangGraph Agent auftritt
   WHEN der Fehler abgefangen wird
   THEN wird ein Event `event: error` mit `data: {"message": "<error_description>"}` gesendet und der Stream geschlossen

6) GIVEN die `SendMessageRequest` DTO-Validierung
   WHEN `POST /api/assistant/sessions/{id}/messages` mit leerem `content` (`""`) oder `content` laenger als 5000 Zeichen aufgerufen wird
   THEN antwortet der Server mit HTTP 422 und einer Validierungs-Fehlermeldung

7) GIVEN die `SendMessageRequest` DTO-Validierung
   WHEN `POST /api/assistant/sessions/{id}/messages` mit optionalem `image_url` aufgerufen wird das keine gueltige URL ist
   THEN antwortet der Server mit HTTP 422

8) GIVEN eine Session die bereits 30 Nachrichten innerhalb der letzten Minute empfangen hat
   WHEN eine weitere Nachricht gesendet wird
   THEN antwortet der Server mit HTTP 429 und `{"detail": "Zu viele Nachrichten. Bitte warte einen Moment."}`

9) GIVEN eine Session mit genau 100 gesendeten Nachrichten (Lifetime)
   WHEN eine weitere Nachricht gesendet wird
   THEN antwortet der Server mit HTTP 400 und `{"detail": "Session-Limit erreicht. Bitte starte eine neue Session."}`

10) GIVEN die `AssistantService`
    WHEN `stream_response(session_id, content, image_url, model)` aufgerufen wird
    THEN orchestriert der Service: Message-Validierung, LangGraph `astream_events()` Aufruf mit `config={"configurable": {"thread_id": session_id}}`, und Event-Konvertierung in SSE-Format

11) GIVEN die `SendMessageRequest` DTO
    WHEN das optionale `model`-Feld gesetzt wird mit einem Wert der nicht in `["anthropic/claude-sonnet-4.6", "openai/gpt-5.4", "google/gemini-3.1-pro-preview"]` ist
    THEN antwortet der Server mit HTTP 422

12) GIVEN die Messages-Route in `backend/app/routes/messages.py`
    WHEN das Modul inspiziert wird
    THEN ist die Route als `APIRouter` definiert und in `main.py` via `include_router` eingebunden

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest mit httpx (FastAPI TestClient)

### Test-Datei: `backend/tests/test_sse_streaming.py`

<test_spec>
```python
import pytest

# AC-1: SSE-Streaming Response auf gueltige Nachricht
@pytest.mark.skip(reason="AC-1")
def test_post_message_returns_sse_stream():
    ...

# AC-2: Stream enthaelt text-delta Events
@pytest.mark.skip(reason="AC-2")
def test_stream_contains_text_delta_events():
    ...

# AC-3: Stream endet mit text-done Event
@pytest.mark.skip(reason="AC-3")
def test_stream_ends_with_text_done_event():
    ...

# AC-4: Tool-Call-Result Event wird gesendet
@pytest.mark.skip(reason="AC-4")
def test_stream_contains_tool_call_result_event():
    ...

# AC-5: Error Event bei Agent-Fehler
@pytest.mark.skip(reason="AC-5")
def test_stream_sends_error_event_on_agent_failure():
    ...

# AC-6: Validierung leerer und zu langer content
@pytest.mark.skip(reason="AC-6")
def test_validation_rejects_invalid_content_length():
    ...

# AC-7: Validierung ungueltiger image_url
@pytest.mark.skip(reason="AC-7")
def test_validation_rejects_invalid_image_url():
    ...

# AC-8: Rate Limit 30 msg/min
@pytest.mark.skip(reason="AC-8")
def test_rate_limit_per_minute():
    ...

# AC-9: Session-Limit 100 msg/lifetime
@pytest.mark.skip(reason="AC-9")
def test_session_lifetime_limit():
    ...

# AC-10: AssistantService orchestriert korrekt
@pytest.mark.skip(reason="AC-10")
def test_assistant_service_calls_astream_events():
    ...

# AC-11: Validierung ungueltiges model
@pytest.mark.skip(reason="AC-11")
def test_validation_rejects_invalid_model():
    ...

# AC-12: Route als APIRouter eingebunden
@pytest.mark.skip(reason="AC-12")
def test_messages_route_uses_api_router():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-python-projekt-setup` | `app.config.settings` | Settings-Instanz | `settings.openrouter_api_key`, `settings.assistant_model_default` vorhanden |
| `slice-01-python-projekt-setup` | `backend/pyproject.toml` | Installierbare Deps | `sse-starlette` ist installiert |
| `slice-02-fastapi-server-health` | `app.main.app` | FastAPI Application | Router-Registrierung via `include_router` |
| `slice-03-langgraph-agent` | `app.agent.graph.create_agent` | Factory-Funktion | `create_agent(checkpointer=None) -> CompiledGraph` |
| `slice-03-langgraph-agent` | `app.agent.state.PromptAssistantState` | TypedDict | State mit `messages`-Feld |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.routes.messages` | APIRouter | slice-10 (Frontend Integration) | `POST /api/assistant/sessions/{id}/messages` -> SSE Stream |
| `app.services.assistant_service.AssistantService` | Service-Klasse | slice-13a, slice-13c, slice-22 | `stream_response(session_id, content, image_url?, model?) -> AsyncGenerator[SSE Event]` |
| `app.models.dtos.SendMessageRequest` | Pydantic Model | slice-13a | DTO mit `content`, `image_url?`, `model?` Feldern |
| SSE Event Protocol | Event-Format | slice-10, slice-11, slice-14 | Events: `text-delta`, `tool-call-result`, `text-done`, `error` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/routes/messages.py` -- POST-Route mit SSE-Streaming via sse-starlette, Rate-Limiting Logik
- [ ] `backend/app/services/assistant_service.py` -- Orchestrierung: Validierung, LangGraph astream_events(), Event-Konvertierung
- [ ] `backend/app/models/dtos.py` -- SendMessageRequest DTO (content, image_url?, model?) mit Pydantic-Validierung
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE LangGraph Tools (draft_prompt, analyze_image etc. kommen in Slice 12, 16, 20)
- Dieser Slice erstellt KEINE Session-CRUD Endpoints (kommt in Slice 13a)
- Dieser Slice erstellt KEINE DB-Verbindung fuer Session-Persistenz (Rate-Limiting nutzt In-Memory Tracking als Uebergangsloesung)
- Dieser Slice erstellt KEINEN POST `/api/assistant/sessions` Endpoint (Session-Erstellung kommt in Slice 13a)
- Der Endpoint akzeptiert beliebige UUIDs als session_id ohne DB-Validierung (Session-Existenzpruefung kommt mit Slice 13a)

**Technische Constraints:**
- `EventSourceResponse` aus `sse-starlette` fuer SSE-Streaming (nicht manuell)
- `astream_events()` von LangGraph (v2 API) fuer Event-basiertes Streaming
- Pydantic BaseModel fuer DTO-Validierung (FastAPI-native)
- Rate-Limiting: In-Memory Dict als Uebergangsloesung (sliding window, 30 msg/min pro session_id, 100 msg/session lifetime)
- SSE Event-Format: W3C-konform mit `event:` und `data:` Feldern, JSON-serialisiert
- Router-Prefix: `/api/assistant` (konsistent mit Slice 02)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design" (Endpoints, DTOs, SSE Event Types)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Validation Rules" (content 1-5000 chars, model enum, image_url)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Rate Limiting & Abuse Prevention" (30 msg/min, 100 msg/session)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Error Handling Strategy" (SSE error events)
