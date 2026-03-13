# Slice 16: Canvas Agent Backend

> **Slice 16 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-canvas-agent-backend` |
| **Test** | `cd backend && python -m pytest tests/test_canvas_agent.py tests/test_canvas_assistant_service.py tests/test_canvas_sessions.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-15-undo-redo"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/test_canvas_agent.py tests/test_canvas_assistant_service.py tests/test_canvas_sessions.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/ -v --timeout=30` |
| **Acceptance Command** | `cd backend && python -m pytest tests/test_canvas_sessions.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Einen separaten LangGraph-Agent fuer Canvas-Editing im Backend erstellen, der Bild-Kontext versteht, Editing-Intents erkennt und strukturierte Generation-Parameter via SSE `canvas-generate` Event zurueckgibt. Dazu gehoeren ein neuer CanvasAssistantService (mit Rate-Limiting und SSE-Streaming) und dedizierte FastAPI-Routes fuer Canvas-Chat-Sessions.

---

## Acceptance Criteria

1) GIVEN kein Canvas-Session existiert
   WHEN POST `/api/assistant/canvas/sessions` mit `{ "project_id": "<valid-uuid>", "image_context": { "image_url": "https://example.com/img.png", "prompt": "A sunset", "model_id": "flux-2-max", "model_params": {}, "generation_id": "<uuid>" } }`
   THEN response HTTP 201 mit `{ "id": "<uuid>", "project_id": "<uuid>", "status": "active" }` (Schema wie `SessionResponse`)

2) GIVEN eine aktive Canvas-Session existiert
   WHEN POST `/api/assistant/canvas/sessions/{id}/messages` mit `{ "content": "Make the sky more blue", "image_context": { "image_url": "https://example.com/img.png", "prompt": "A sunset", "model_id": "flux-2-max", "model_params": {}, "generation_id": "<uuid>" } }`
   THEN SSE-Stream liefert mindestens ein `text-delta` Event und ein `text-done` Event

3) GIVEN der Agent erkennt einen Editing-Intent (z.B. "Mach den Himmel blauer")
   WHEN der Agent das `generate_image` Tool aufruft
   THEN SSE-Stream liefert ein `canvas-generate` Event mit `{ "action": "variation"|"img2img", "prompt": "<optimierter-prompt>", "model_id": "<string>", "params": {} }`

4) GIVEN eine Session hat 100 Nachrichten (Lifetime-Limit)
   WHEN POST `.../messages` mit neuem Content
   THEN response HTTP 400 mit Fehlermeldung (Session-Lifetime-Limit erreicht)

5) GIVEN eine Session empfaengt >30 Nachrichten in einer Minute
   WHEN POST `.../messages` mit neuem Content
   THEN response HTTP 429 (Rate-Limit ueberschritten)

6) GIVEN POST `.../messages` mit leerem `content` (oder >5000 Zeichen)
   WHEN die Validierung laeuft
   THEN response HTTP 422 (Pydantic-Validierungsfehler)

7) GIVEN der LLM-API-Call schlaegt fehl (Timeout, 500)
   WHEN der Agent verarbeitet
   THEN SSE-Stream liefert ein `error` Event mit Fehlerbeschreibung, kein Crash

8) GIVEN der Canvas-Agent-Graph wird erstellt
   WHEN die Tool-Liste inspiziert wird
   THEN enthaelt sie `generate_image` als einziges Canvas-spezifisches Tool

9) GIVEN POST `.../messages` mit `image_context`
   WHEN der Agent-System-Prompt erstellt wird
   THEN enthaelt der System-Prompt den Bild-Kontext (image_url, prompt, model_id) als Editing-Kontext

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/test_canvas_sessions.py`

<test_spec>
```python
import pytest

class TestCanvasSessionRoutes:
    # AC-1: Session erstellen
    @pytest.mark.skip(reason='AC-1')
    def test_create_canvas_session_returns_201(self): ...

    # AC-6: Validierungsfehler bei leerem Content
    @pytest.mark.skip(reason='AC-6')
    def test_send_message_with_empty_content_returns_422(self): ...

    # AC-6: Validierungsfehler bei zu langem Content
    @pytest.mark.skip(reason='AC-6')
    def test_send_message_with_content_over_5000_chars_returns_422(self): ...
```
</test_spec>

### Test-Datei: `backend/tests/test_canvas_assistant_service.py`

<test_spec>
```python
import pytest

class TestCanvasAssistantService:
    # AC-2: SSE-Stream liefert text-delta und text-done
    @pytest.mark.skip(reason='AC-2')
    def test_stream_response_yields_text_delta_and_text_done(self): ...

    # AC-3: canvas-generate Event bei Editing-Intent
    @pytest.mark.skip(reason='AC-3')
    def test_stream_response_yields_canvas_generate_on_tool_call(self): ...

    # AC-4: Lifetime-Limit
    @pytest.mark.skip(reason='AC-4')
    def test_rejects_message_at_session_lifetime_limit(self): ...

    # AC-5: Rate-Limit
    @pytest.mark.skip(reason='AC-5')
    def test_rejects_message_at_rate_limit(self): ...

    # AC-7: Fehlerbehandlung bei LLM-Fehler
    @pytest.mark.skip(reason='AC-7')
    def test_stream_response_yields_error_event_on_llm_failure(self): ...

    # AC-9: System-Prompt enthaelt Bild-Kontext
    @pytest.mark.skip(reason='AC-9')
    def test_system_prompt_includes_image_context(self): ...
```
</test_spec>

### Test-Datei: `backend/tests/test_canvas_agent.py`

<test_spec>
```python
import pytest

class TestCanvasAgentGraph:
    # AC-8: generate_image Tool registriert
    @pytest.mark.skip(reason='AC-8')
    def test_canvas_graph_has_generate_image_tool(self): ...

    # AC-3: generate_image Tool liefert strukturierte Parameter
    @pytest.mark.skip(reason='AC-3')
    def test_generate_image_tool_returns_structured_params(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| Existing | `AssistantService` | Class | SSE-Streaming-Pattern, RateLimiter-Pattern als Vorlage |
| Existing | `create_agent()` | Function | Graph-Struktur (assistant_node -> tools_node -> post_process_node) als Vorlage |
| Existing | `SessionRepository` | Class | Session-CRUD (create, list_by_project, update) |
| Existing | `MemorySaver` / `PostgresSaver` | Checkpointer | Session-Persistenz fuer LangGraph |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `POST /api/assistant/canvas/sessions` | REST Endpoint | `slice-17-canvas-chat-frontend` | `(CreateCanvasSessionRequest) -> SessionResponse` |
| `POST /api/assistant/canvas/sessions/{id}/messages` | SSE Endpoint | `slice-17-canvas-chat-frontend` | `(CanvasSendMessageRequest) -> SSE stream (text-delta, canvas-generate, text-done, error)` |
| `canvas-generate` SSE Event | Event Schema | `slice-17-canvas-chat-frontend` | `{ action: str, prompt: str, model_id: str, params: dict }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/canvas_graph.py` -- LangGraph Canvas-Agent mit eigenem System-Prompt und generate_image Tool
- [ ] `backend/app/services/canvas_assistant_service.py` -- SSE-Streaming-Service mit Rate-Limiting, image_context-Handling und canvas-generate Event-Konvertierung
- [ ] `backend/app/routes/canvas_sessions.py` -- FastAPI-Routes fuer Canvas-Session-CRUD und Message-Streaming
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Frontend-Code (Chat-Panel-Anbindung ist Slice 17)
- KEINE Aenderung am bestehenden Prompt-Assistant-Agent (`graph.py`, `assistant_service.py`)
- KEINE Aenderung an der DB-Schema oder Session-Repository (bestehende `assistant_sessions` Tabelle wird wiederverwendet)
- KEIN direktes Aufrufen von Generierungs-APIs (Agent liefert nur Parameter via SSE-Event, Frontend triggert)

**Technische Constraints:**
- Canvas-Agent ist ein separater LangGraph StateGraph (NICHT der Prompt-Assistant erweitert)
- `generate_image` Tool gibt strukturierte Parameter zurueck (dict), ruft KEINE externe API auf
- SSE-Events folgen dem bestehenden Pattern: `text-delta`, `tool-call-result`, `text-done`, `error` plus neues `canvas-generate`
- Rate-Limiting: 30 msg/min, 100 msg/session (gleiche Limits wie Prompt-Assistant)
- System-Prompt bekommt `image_context` injiziert (Bild-URL, Prompt, Model, Params)
- LLM-Provider: OpenRouter via ChatOpenAI (wie bestehender Agent)
- Checkpointer: MemorySaver (oder PostgresSaver wenn verfuegbar)
- DTOs: `CanvasImageContext`, `CanvasSendMessageRequest`, `CanvasGenerateEvent` — siehe architecture.md Section "DTOs"
- Route-Registration: Neuer Router unter Prefix `/api/assistant/canvas` (bestehendes Rewrite `/api/assistant/:path*` deckt das ab)

**Referenzen:**
- Architecture: `architecture.md` -> Section "API Design > New Endpoints" (Route-Definitionen)
- Architecture: `architecture.md` -> Section "API Design > DTOs" (CanvasImageContext, CanvasSendMessageRequest, CanvasGenerateEvent)
- Architecture: `architecture.md` -> Section "Server Logic > Business Logic Flow" (Agent -> SSE -> Frontend Flow)
- Architecture: `architecture.md` -> Section "Rate Limiting" (30/min, 100/session)
- Architecture: `architecture.md` -> Section "Technology Decisions" (Separater Graph, nicht erweitert)
