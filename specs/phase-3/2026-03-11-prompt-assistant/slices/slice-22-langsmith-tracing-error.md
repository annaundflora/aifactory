# Slice 22: LangSmith Tracing + Error Handling

> **Slice 22 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-22-langsmith-tracing-error` |
| **Test** | `pnpm test components/assistant/__tests__/error-message.test.tsx && cd backend && python -m pytest tests/test_error_handling.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-10-core-chat-loop"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` + `python-fastapi` (Dual-Stack: Frontend vitest, Backend pytest) |
| **Test Command** | `pnpm test components/assistant/__tests__/error-message.test.tsx && cd backend && python -m pytest tests/test_error_handling.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/test_error_handling.py -v -k integration` |
| **Acceptance Command** | `pnpm dev` + `cd backend && uvicorn app.main:app` (manuell: LangSmith Dashboard pruefen, Fehler provozieren) |
| **Start Command** | `pnpm dev` + `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (LLM-Calls gemockt, LangSmith-Calls gemockt) |

---

## Ziel

LangSmith Tracing fuer alle LLM-Calls aktivieren (LangGraph-native, konfiguriert ueber Environment-Variablen) und das Error-Handling im Chat polieren: Error-Bubbles mit Retry-Logik (max 3 Versuche), Backend-Unreachable-Toast und Session-Limit-Nachricht.

---

## Acceptance Criteria

1) GIVEN `LANGSMITH_TRACING=true` und `LANGSMITH_API_KEY` in der Backend-Config gesetzt
   WHEN `config.py` geladen wird
   THEN sind `langsmith_tracing: bool` und `langsmith_api_key: str | None` als Settings-Felder verfuegbar und werden als Env-Vars gelesen

2) GIVEN ein laufender FastAPI Server mit LangSmith-Config
   WHEN ein LLM-Call ueber LangGraph ausgefuehrt wird
   THEN werden die Environment-Variablen `LANGSMITH_TRACING` und `LANGSMITH_API_KEY` automatisch von LangChain/LangGraph gelesen (keine explizite Instrumentierung noetig)

3) GIVEN der SSE-Stream liefert ein `error` Event mit `{"message": "..."}`
   WHEN die `ErrorMessage` Component gerendert wird
   THEN zeigt sie eine rot-getoeinte Chat-Bubble mit Warning-Icon und dem Fehlertext an

4) GIVEN eine `ErrorMessage` mit `retryCount < 3`
   WHEN der User auf den "Erneut versuchen" Retry-Button klickt
   THEN wird die letzte User-Message erneut an das Backend gesendet und der Button zeigt einen Spinner mit "Versuche erneut..."

5) GIVEN eine `ErrorMessage` bei der bereits 3 Retries fehlgeschlagen sind (`retryCount === 3`)
   WHEN die Component gerendert wird
   THEN zeigt sie den Text "Der Assistent ist gerade nicht verfuegbar. Bitte versuche es spaeter erneut." und KEINEN Retry-Button

6) GIVEN das Backend ist nicht erreichbar (Netzwerkfehler / HTTP 502)
   WHEN der Frontend-SSE-Fetch fehlschlaegt
   THEN wird ein Toast (sonner) angezeigt: "Assistent nicht verfuegbar" und im Chat erscheint eine ErrorMessage

7) GIVEN eine Session mit `message_count >= 100`
   WHEN der User eine weitere Nachricht senden will
   THEN antwortet das Backend mit HTTP 400 und `{"detail": "Session-Limit erreicht. Bitte starte eine neue Session."}` und das Frontend zeigt eine Hinweis-Nachricht im Chat (nicht rot, sondern informativ)

8) GIVEN der `AssistantService` im Backend empfaengt einen LLM-API-Fehler (z.B. OpenRouter Timeout, 500er)
   WHEN der Fehler in `stream_response()` abgefangen wird
   THEN wird ein SSE `error` Event mit beschreibender Fehlermeldung gesendet, der Stream geschlossen, und der Fehler im Python-Logger als ERROR geloggt

9) GIVEN die `ErrorMessage` Component
   WHEN sie mit Props `message: string`, `onRetry?: () => void`, `retryCount: number` gerendert wird
   THEN ist sie eine eigenstaendige, wiederverwendbare Component ohne externe State-Abhaengigkeiten

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/assistant/__tests__/error-message.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ErrorMessage', () => {
  // AC-3: Rot-getoeinte Error-Bubble mit Warning-Icon
  it.todo('should render red-tinted bubble with warning icon and error text')

  // AC-4: Retry-Button sendet erneut und zeigt Spinner
  it.todo('should show retry button when retryCount < 3 and call onRetry on click')

  // AC-5: Permanenter Fehler nach 3 Retries ohne Button
  it.todo('should show permanent error message without retry button when retryCount is 3')

  // AC-9: Component akzeptiert message, onRetry, retryCount Props
  it.todo('should render correctly with only message prop and no onRetry callback')
})
```
</test_spec>

### Test-Datei: `backend/tests/test_error_handling.py`

<test_spec>
```python
import pytest

# AC-1: LangSmith Config-Felder in Settings
@pytest.mark.skip(reason="AC-1")
def test_config_has_langsmith_settings():
    ...

# AC-7: Session-Limit bei 100 Messages
@pytest.mark.skip(reason="AC-7")
def test_session_limit_returns_400_at_100_messages():
    ...

# AC-8: LLM-Fehler wird als SSE error Event gesendet
@pytest.mark.skip(reason="AC-8")
def test_llm_error_sends_sse_error_event():
    ...

# AC-8: LLM-Fehler wird im Logger geloggt
@pytest.mark.skip(reason="AC-8")
def test_llm_error_is_logged():
    ...
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/error-handling.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Frontend Error Handling', () => {
  // AC-6: Backend unreachable zeigt Toast
  it.todo('should show toast when fetch fails with network error or 502')

  // AC-6: Backend unreachable zeigt ErrorMessage im Chat
  it.todo('should add error message to chat when backend is unreachable')

  // AC-7: Session-Limit Hinweis im Chat (informativ, nicht rot)
  it.todo('should show informational session limit message when backend returns 400 with limit detail')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-python-projekt-setup` | `app.config.settings` | Settings-Instanz | Basis-Settings vorhanden, wird erweitert |
| `slice-04-sse-streaming-endpoint` | `app.services.assistant_service.AssistantService` | Service-Klasse | `stream_response()` existiert, wird erweitert |
| `slice-04-sse-streaming-endpoint` | SSE Event Protocol (`error` Event) | Event-Format | Error-Events bereits definiert |
| `slice-10-core-chat-loop` | `PromptAssistantContext` | React Context | `sendMessage()`, `messages`, `isStreaming` verfuegbar |
| `slice-10-core-chat-loop` | `useAssistantRuntime` | Hook | SSE-Parser verarbeitet error Events |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ErrorMessage` | React Component | Alle Chat-nutzenden Slices | `<ErrorMessage message={string} onRetry?={() => void} retryCount={number} />` |
| LangSmith Tracing | Backend Config | Alle Backend-Slices | Automatisch via LangGraph-native env vars |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/error-message.tsx` -- Error-Bubble Component: rot-getoeint, Warning-Icon, optionaler Retry-Button, permanenter Fehler-State
- [ ] `backend/app/config.py` (erweitert) -- LangSmith env vars: `langsmith_tracing`, `langsmith_api_key`, `langsmith_project`
- [ ] `backend/app/services/assistant_service.py` (erweitert) -- Error-Handling in stream_response(): try/catch um LLM-Calls, SSE error Event senden, Logging
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Custom LangSmith Traces oder Decorators -- LangGraph traced automatisch wenn env vars gesetzt sind
- Dieser Slice implementiert KEINE neuen SSE Event Types -- nutzt den existierenden `error` Event-Typ aus Slice 04
- Dieser Slice implementiert KEIN Dashboard oder Monitoring-UI -- LangSmith Dashboard ist extern
- Die Retry-Logik ist Frontend-seitig (Client resent die letzte Message) -- kein serverseitiger Auto-Retry

**Technische Constraints:**
- LangSmith aktiviert via `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` env vars (LangChain/LangGraph erkennt diese automatisch)
- `ErrorMessage` Component nutzt Tailwind fuer Styling (rot-getoenter Hintergrund, passend zum Design-System)
- Toast-Notifications via `sonner` (bereits installiert, v2.0.7)
- Backend-Fehler werden im `stream_response()` per try/except abgefangen und als SSE error Event gesendet
- Session-Limit Check nutzt `message_count` aus dem Rate-Limiting (Slice 04) -- bei 100 Messages wird HTTP 400 zurueckgegeben

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Error Handling Strategy" (Error-Typen, User-Responses, Logging)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Rate Limiting & Abuse Prevention" (100 msg/session lifetime)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Monitoring & Observability" (LangSmith trace success)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Error State" (Error-Bubble Layout, Retry-Button)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Error Paths" und "Business Rules" (Retry-Logik, max 3 Retries)
