# Slice 13c: Session Resume + Switcher

> **Slice 13c von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13c-session-resume-switcher` |
| **Test** | `pnpm vitest run components/assistant/__tests__/session-switcher.test.tsx lib/assistant/__tests__/assistant-context-resume.test.ts && cd backend && python -m pytest tests/test_session_resume.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-13b-session-list-ui", "slice-10-core-chat-loop"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` + `python-fastapi` (beide Stacks betroffen) |
| **Test Command** | `pnpm vitest run components/assistant/__tests__/session-switcher.test.tsx lib/assistant/__tests__/assistant-context-resume.test.ts` |
| **Integration Command** | `cd backend && python -m pytest tests/test_session_resume.py -v` |
| **Acceptance Command** | `pnpm dev` + Backend: Session erstellen, Messages senden, Session-Liste oeffnen, Session anklicken, Chat-History pruefen |
| **Start Command** | `pnpm dev` + `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:3000` + `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (Frontend: fetch gemockt; Backend: DB gemockt in Unit-Tests) |

---

## Ziel

Session-Fortsetzen ermoeglichen: Klick auf eine Session in der Liste laedt den vollstaendigen State (Messages, Draft, Recommendation) vom Backend via LangGraph Checkpointer und stellt den Chat wieder her. Dazu einen Session-Switcher Button im Sheet-Header und Auto-Title-Generierung aus der ersten User-Message.

---

## Acceptance Criteria

1) GIVEN eine existierende Session mit `id` "S1" die 4 Messages im LangGraph Checkpointer hat
   WHEN `GET /api/assistant/sessions/S1` aufgerufen wird
   THEN antwortet der Server mit HTTP 200, das Response-Objekt enthaelt `session` (Metadata aus `assistant_sessions`) und `state` mit `messages` (Array mit 4 Message-Objekten, je `role` und `content`), `draft_prompt` (oder null) und `recommended_model` (oder null)

2) GIVEN eine Session "S1" deren LangGraph-State einen `draft_prompt` mit `{motiv: "A cat...", style: "watercolor...", negative_prompt: "blurry..."}` enthaelt
   WHEN `GET /api/assistant/sessions/S1` aufgerufen wird
   THEN enthaelt `state.draft_prompt` exakt diese drei Felder mit ihren Werten

3) GIVEN eine Session-ID die nicht existiert oder keinen Checkpoint hat
   WHEN `GET /api/assistant/sessions/<unknown-id>` aufgerufen wird
   THEN antwortet der Server mit HTTP 404 und `{"detail": "Session nicht gefunden"}`

4) GIVEN der User befindet sich in der Session-Liste und klickt auf Session "S1"
   WHEN die Session geladen wird
   THEN wechselt die Ansicht zum Chat-Thread, alle Messages aus `state.messages` werden als Bubbles angezeigt (Human rechts, Assistant links), und die `sessionId` im `PromptAssistantContext` ist "S1"

5) GIVEN eine geladene Session die einen `draft_prompt` im State hat
   WHEN der Chat-Thread angezeigt wird
   THEN wird `draftPrompt` im `PromptAssistantContext` gesetzt (Canvas kann in nachfolgenden Slices darauf reagieren)

6) GIVEN eine geladene Session die ein `recommended_model` im State hat
   WHEN der Chat-Thread angezeigt wird
   THEN wird `recommendedModel` im `PromptAssistantContext` gesetzt

7) GIVEN der Assistant-Drawer ist geoeffnet (egal ob Startscreen, Chat oder Session-Liste)
   WHEN der User auf den Session-Switcher Button im Sheet-Header klickt
   THEN navigiert die Ansicht zur Session-Liste

8) GIVEN der Session-Switcher Button im Sheet-Header
   WHEN er gerendert wird
   THEN ist er sichtbar als Icon-Button (z.B. List oder History Icon) rechts neben dem Model-Selector und links neben dem Close-Button

9) GIVEN der User sendet die erste Nachricht "Ein Portraet von einer Katze" in einer neuen Session
   WHEN die Nachricht erfolgreich gesendet wurde (SSE-Stream gestartet)
   THEN wird `PATCH /api/assistant/sessions/{id}` oder `set_title` im Backend aufgerufen mit einem Titel abgeleitet aus der ersten User-Message (z.B. "Ein Portraet von einer Katze"), und die Session-Metadata wird aktualisiert

10) GIVEN der `PromptAssistantContext` hat eine aktive Session "S1"
    WHEN der User eine Session "S2" aus der Liste laedt
    THEN wird die aktive Session auf "S2" gewechselt: `sessionId` ist "S2", `messages` enthaelt die Messages von S2, vorherige S1-Messages sind nicht mehr sichtbar

11) GIVEN eine Session wird geladen
    WHEN der fetch-Call fehlschlaegt (Netzwerk-Fehler oder 500)
    THEN wird eine Fehlermeldung angezeigt (Toast: "Session konnte nicht geladen werden") und der User bleibt auf der Session-Liste

12) GIVEN der `assistant_service.py` im Backend
    WHEN `get_session_state(session_id)` aufgerufen wird
    THEN liest die Methode den LangGraph Checkpoint via `PostgresSaver.aget` (oder `checkpointer.aget_tuple`) mit `config={"configurable": {"thread_id": session_id}}` und konvertiert den State in das `SessionDetailResponse` DTO

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `backend/tests/test_session_resume.py`

<test_spec>
```python
import pytest

# AC-1: GET session detail liefert State mit Messages
@pytest.mark.skip(reason="AC-1")
def test_get_session_detail_returns_messages_from_checkpointer():
    ...

# AC-2: GET session detail liefert draft_prompt aus State
@pytest.mark.skip(reason="AC-2")
def test_get_session_detail_returns_draft_prompt():
    ...

# AC-3: GET session detail liefert 404 fuer unbekannte Session
@pytest.mark.skip(reason="AC-3")
def test_get_session_detail_returns_404_when_not_found():
    ...

# AC-9: Auto-Title wird aus erster User-Message gesetzt
@pytest.mark.skip(reason="AC-9")
def test_auto_title_set_from_first_user_message():
    ...

# AC-12: get_session_state liest LangGraph Checkpoint korrekt
@pytest.mark.skip(reason="AC-12")
def test_get_session_state_reads_checkpoint_via_thread_id():
    ...
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/session-switcher.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SessionSwitcher', () => {
  // AC-7: Klick auf Switcher navigiert zur Session-Liste
  it.todo('should call onNavigateToSessions when clicked')

  // AC-8: Switcher ist im Header sichtbar mit korrekter Position
  it.todo('should render as icon button in sheet header between model-selector and close button')
})
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-resume.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptAssistantContext - Session Resume', () => {
  // AC-4: Session laden stellt Messages wieder her
  it.todo('should restore messages from session state when loadSession is called')

  // AC-5: Session laden setzt draftPrompt
  it.todo('should set draftPrompt from session state when draft exists')

  // AC-6: Session laden setzt recommendedModel
  it.todo('should set recommendedModel from session state when recommendation exists')

  // AC-10: Session-Wechsel ersetzt vorherigen State
  it.todo('should replace current session state when switching to different session')

  // AC-11: Fehler beim Laden zeigt Toast
  it.todo('should show error toast when session loading fails')

  // AC-9: Auto-Title nach erster Nachricht
  it.todo('should trigger auto-title update after first user message is sent')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-13a` | `SessionRepository.get_by_id()` | Python Method | Liefert Session-Metadata aus DB |
| `slice-13a` | `SessionRepository.set_title()` | Python Method | Setzt Title-Feld der Session |
| `slice-13a` | `GET /api/assistant/sessions/{id}` | REST Endpoint | Bisher nur Metadata, wird erweitert um State |
| `slice-13b` | `SessionList` Component | React Component | `onSelectSession(id)` Callback verfuegbar |
| `slice-13b` | `useSessions` Hook | React Hook | Sessions-Daten fuer Liste |
| `slice-10` | `PromptAssistantContext` | React Context | `sessionId`, `messages`, `draftPrompt`, `recommendedModel`, `sendMessage` |
| `slice-10` | `useAssistantRuntime` | React Hook | Session-Erstellung und Message-Senden |
| `slice-04` | `AssistantService` | Python Service | Wird erweitert um `get_session_state` |
| `slice-03` | LangGraph `PostgresSaver` | Checkpointer | Checkpoint-Daten lesen via `thread_id` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SessionSwitcher` | React Component | slice-08 (Sheet Header) | `<SessionSwitcher onClick={() => void} />` |
| `PromptAssistantContext.loadSession(id)` | Context Method | slice-13b, slice-19 | `loadSession(sessionId: string) => Promise<void>` |
| `PromptAssistantContext.activeView` | Context State | slice-08, slice-13b | `"chat" \| "session-list" \| "startscreen"` |
| `AssistantService.get_session_state(id)` | Python Method | -- | `get_session_state(session_id: UUID) -> SessionDetailResponse` |
| Auto-Title Mechanismus | Side Effect | slice-10 (nach erster Message) | Automatisch bei erster Message, kein expliziter Consumer |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/session-switcher.tsx` -- Icon-Button fuer Sheet-Header, navigiert zur Session-Liste
- [ ] `lib/assistant/assistant-context.tsx` (erweitert) -- `loadSession`, `activeView` State, Auto-Title Trigger, Session-Wechsel-Logik
- [ ] `backend/app/services/assistant_service.py` (erweitert) -- `get_session_state`: LangGraph Checkpoint lesen und in SessionDetailResponse konvertieren; Auto-Title Logik
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Session-Archivierung/Loeschung UI (nur Backend PATCH existiert aus 13a)
- Dieser Slice implementiert KEIN Canvas-Rendering beim Session-Resume (Canvas-Panel kommt in Slice 14, reagiert aber auf `draftPrompt` im Context)
- Dieser Slice implementiert KEINE "Letzte aktive Session beim Sheet-Oeffnen laden" Logik (kommt in Slice 19)
- Dieser Slice aendert NICHT die GET-Liste-Route (bleibt in 13a), nur die GET-Detail-Route wird um State erweitert

**Technische Constraints:**
- LangGraph Checkpoint wird via `PostgresSaver` mit `thread_id = session_id` gelesen (Konvention aus Slice 03/04)
- Messages aus dem Checkpoint muessen von LangChain `BaseMessage` in das Frontend `Message`-Format konvertiert werden (`role: "human"|"assistant"`, `content: string`)
- Auto-Title: Erste User-Message wird auf max 80 Zeichen gekuerzt und als Titel gesetzt (kein LLM-Call fuer Title-Generierung)
- `activeView` State-Management im Context via `useReducer` (konsistent mit Slice 10 Pattern)
- Session-Switcher nutzt Lucide `List` oder `History` Icon (konsistent mit bestehendem Icon-Set)
- Toast-Notifications via `sonner` (bereits installiert, Pattern aus Slice 15)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design > Endpoints" (GET `/api/assistant/sessions/{id}`)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Data Transfer Objects" (SessionDetailResponse, SessionState, Message)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "LangGraph State" (PromptAssistantState Felder)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Session List" (Annotation 2: Klick laedt Session)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Startscreen" (Annotation 2: session-switcher Button)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "User Flow > Session fortsetzen"
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Feature State Machine" (session-list -> loading-session -> chatting/drafting)
