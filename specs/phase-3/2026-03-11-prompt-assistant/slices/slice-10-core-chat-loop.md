# Slice 10: Core Chat Loop (Frontend <-> Backend)

> **Slice 10 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-core-chat-loop` |
| **Test** | `pnpm test lib/assistant/__tests__ components/assistant/__tests__/chat-thread.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-sse-streaming-endpoint", "slice-06-nextjs-proxy-config", "slice-09-startscreen-chips"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test lib/assistant/__tests__ components/assistant/__tests__/chat-thread.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` (manuell: Nachricht senden, SSE-Stream pruefen) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (fetch/SSE-Calls werden in Tests gemockt) |

---

## Ziel

Erster vollstaendiger Frontend-Backend-Roundtrip: User sendet eine Nachricht ueber den ChatInput, der `useAssistantRuntime` Hook erstellt automatisch eine neue Session (POST `/api/assistant/sessions`) und sendet die Nachricht (POST `/api/assistant/sessions/{id}/messages`), der SSE-Stream wird geparst und die Antwort erscheint als Assistant-Bubble im Chat-Thread.

---

## Acceptance Criteria

1) GIVEN der AssistantSheet ist geoeffnet mit Startscreen
   WHEN der User Text in den ChatInput eingibt und auf Send klickt
   THEN wird zuerst POST `/api/assistant/sessions` aufgerufen (Body: `{project_id}`), und danach POST `/api/assistant/sessions/{id}/messages` mit `{content, model}` -- die Session-ID stammt aus dem metadata SSE-Event der Session-Erstellung

2) GIVEN der User hat eine Nachricht gesendet
   WHEN die Nachricht abgeschickt wurde
   THEN erscheint sofort eine User-Message-Bubble (rechts-ausgerichtet) im Chat-Thread mit dem eingegebenen Text

3) GIVEN der SSE-Stream liefert `text-delta` Events
   WHEN die Events eintreffen
   THEN erscheint eine Assistant-Message-Bubble (links-ausgerichtet) im Chat-Thread, deren Text sich mit jedem `text-delta` Event erweitert

4) GIVEN der SSE-Stream sendet ein `text-done` Event
   WHEN das Event eintrifft
   THEN ist die Assistant-Message als vollstaendig markiert (kein weiteres Streaming erwartet)

5) GIVEN der SSE-Stream liefert ein `tool-call-result` Event
   WHEN das Event eintrifft
   THEN wird das Event im `PromptAssistantContext` State gespeichert (fuer nachfolgende Slices wie Canvas), aber nicht als eigene Bubble dargestellt

6) GIVEN der SSE-Stream liefert ein `error` Event
   WHEN das Event eintrifft
   THEN wird die Fehlermeldung als Fehler-Nachricht im Chat angezeigt

7) GIVEN der User klickt auf einen Suggestion-Chip auf dem Startscreen
   WHEN der Chip-Text als erste Nachricht gesendet wird
   THEN wird eine neue Session erstellt und der Chip-Text als User-Message verarbeitet (identisches Verhalten wie manuelles Tippen)

8) GIVEN der `PromptAssistantContext` wird bereitgestellt
   WHEN eine Komponente den Context konsumiert
   THEN sind folgende Werte verfuegbar: `sessionId`, `messages`, `isStreaming`, `draftPrompt`, `recommendedModel`, `sendMessage(content, imageUrl?)`, `selectedModel`

9) GIVEN der `useAssistantRuntime` Hook
   WHEN der Hook die SSE-Response parst
   THEN dekodiert der SSE-Parser Events im Format `event: {type}\ndata: {json}\n\n` korrekt, inklusive mehrzeiliger data-Felder und UTF-8 Sonderzeichen

10) GIVEN der Chat-Thread enthaelt mehrere Messages
    WHEN eine neue Assistant-Message eingeht
    THEN scrollt der Chat-Thread automatisch nach unten zur neuesten Message

11) GIVEN eine aktive Session mit vorherigen Messages
    WHEN der User eine weitere Nachricht sendet
    THEN wird die Nachricht an dieselbe Session-ID gesendet (keine neue Session erstellt)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `lib/assistant/__tests__/use-assistant-runtime.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useAssistantRuntime', () => {
  // AC-1: Session-Erstellung und Message-Senden
  it.todo('should create session via POST /api/assistant/sessions then send message to session endpoint')

  // AC-9: SSE-Parser dekodiert Events korrekt
  it.todo('should parse SSE events with event type and JSON data correctly')

  // AC-4: text-done markiert Message als vollstaendig
  it.todo('should mark assistant message as complete on text-done event')

  // AC-5: tool-call-result wird gespeichert
  it.todo('should store tool-call-result events in context state')

  // AC-6: error Event wird verarbeitet
  it.todo('should handle error SSE events and surface error message')

  // AC-11: Folge-Nachrichten nutzen bestehende Session-ID
  it.todo('should reuse existing session ID for subsequent messages')
})
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptAssistantContext', () => {
  // AC-8: Context stellt alle erforderlichen Werte bereit
  it.todo('should provide sessionId, messages, isStreaming, draftPrompt, recommendedModel, sendMessage, selectedModel')

  // AC-5: tool-call-result aktualisiert draftPrompt
  it.todo('should update draftPrompt when tool-call-result with tool=draft_prompt is received')

  // AC-5: tool-call-result aktualisiert recommendedModel
  it.todo('should update recommendedModel when tool-call-result with tool=recommend_model is received')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-thread.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ChatThread', () => {
  // AC-2: User-Message-Bubble rechts
  it.todo('should render user messages right-aligned with user styling')

  // AC-3: Assistant-Message-Bubble links
  it.todo('should render assistant messages left-aligned with assistant styling')

  // AC-10: Auto-Scroll bei neuer Message
  it.todo('should scroll to bottom when new message is added')

  // AC-7: Chip-Klick wird als erste Nachricht behandelt
  it.todo('should display chip text as user message when triggered via onChipClick')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-04-sse-streaming-endpoint | `POST /api/assistant/sessions/{id}/messages` -> SSE Stream | HTTP Endpoint | Stream liefert `text-delta`, `text-done`, `tool-call-result`, `error` Events |
| slice-04-sse-streaming-endpoint | SSE Event Protocol | Event-Format | Events im Format `event: {type}\ndata: {json}\n\n` |
| slice-06-nextjs-proxy-config | Proxy `/api/assistant/:path*` -> FastAPI | Next.js Rewrite | Requests werden transparent an Backend proxied |
| slice-09-startscreen-chips | `ChatInput` Component | Component | `<ChatInput onSend={(text: string) => void} disabled={boolean} autoFocus={boolean}>` |
| slice-09-startscreen-chips | `Startscreen` Component | Component | `<Startscreen onChipClick={(text: string) => void} ...>` |
| slice-09-startscreen-chips | `ModelSelector` Component | Component | `<ModelSelector value={string} onChange={(slug: string) => void}>` |
| slice-08-assistant-sheet-shell | `AssistantSheet` Component | Component | children-Slot fuer Chat-Thread und Startscreen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `useAssistantRuntime` | Hook | slice-11, slice-14 | `useAssistantRuntime() -> { sendMessage, isStreaming, cancelStream }` |
| `PromptAssistantContext` | React Context | slice-11, slice-14, slice-15, slice-17, slice-19 | Context mit `sessionId, messages, isStreaming, draftPrompt, recommendedModel, sendMessage, selectedModel` |
| `ChatThread` | Component | slice-11 (erweitert), slice-14 (Split-View) | `<ChatThread messages={Message[]} isStreaming={boolean}>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/use-assistant-runtime.ts` -- Custom Hook: Session-Erstellung, ChatModelAdapter mit SSE-Parser, fetch-basierter Stream-Consumer
- [ ] `lib/assistant/assistant-context.tsx` -- React Context Provider: Session-State, Messages, Streaming-Status, tool-call-result Dispatch
- [ ] `components/assistant/chat-thread.tsx` -- Message-Liste mit User/Assistant Bubbles (rechts/links), Auto-Scroll
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Streaming-Indicator Dots oder Stop-Button (kommt in Slice 11)
- Dieser Slice implementiert KEIN Canvas-Panel oder Split-View (kommt in Slice 14)
- Dieser Slice implementiert KEINE Image-Upload Funktionalitaet (kommt in Slice 17)
- Dieser Slice implementiert KEINE Session-Liste oder Session-Resume (kommt in Slice 13b/13c)
- Dieser Slice implementiert KEINE Error-Retry-Logik (kommt in Slice 22)
- Die Session-Erstellung nutzt den SSE-Endpoint POST `/api/assistant/sessions` -- das `metadata` SSE-Event liefert `session_id` und `thread_id`

**Technische Constraints:**
- SSE-Parsing: Nativer `fetch` mit `ReadableStream` (kein EventSource, da POST erforderlich)
- `PromptAssistantContext` verwaltet State via `useReducer` (Messages, Session, Streaming-Flag, tool-call-results)
- Chat-Thread nutzt einfache div-basierte Bubbles (kein @assistant-ui/react Thread-Rendering -- Custom-Rendering fuer volle Kontrolle)
- Model-Slug wird aus `ModelSelector` State gelesen und bei jedem Message-Request im Body mitgesendet
- Auto-Scroll via `scrollIntoView` auf ein Anchor-Element am Ende der Message-Liste

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design" (Endpoints, SSE Event Types)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Business Logic Flow" (ChatModelAdapter -> POST -> SSE -> Parse)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Chatting (No Canvas)" (Bubble-Layout)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Feature State Machine" (start -> streaming -> chatting Transitions)
