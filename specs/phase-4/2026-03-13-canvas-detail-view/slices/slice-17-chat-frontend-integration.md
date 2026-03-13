# Slice 17: Canvas Chat Frontend Integration

> **Slice 17 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-chat-frontend-integration` |
| **Test** | `pnpm test lib/__tests__/canvas-chat-service.test.ts components/canvas/__tests__/canvas-chat-integration.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-chat-panel-ui", "slice-14-in-place-generation", "slice-16-canvas-agent-backend"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/canvas-chat-service.test.ts components/canvas/__tests__/canvas-chat-integration.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test lib/__tests__/canvas-chat-service.test.ts components/canvas/__tests__/canvas-chat-integration.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Chat-Panel (aus Slice 9) an das Canvas-Agent-Backend (aus Slice 16) anbinden: SSE-Client-Service fuer Session-Erstellung und Message-Streaming, Verarbeitung von `canvas-generate` Events zur Ausloesung von `generateImages()`, Streaming-Indicator waehrend Bot-Antworten, Clarification-Chips und Error-Handling bei Timeout/Fehlern.

---

## Acceptance Criteria

1) GIVEN die CanvasDetailView ist mit einem Bild geoeffnet und das Chat-Panel ist expanded
   WHEN das Panel erstmals rendert
   THEN wird automatisch eine Canvas-Session via `POST /api/assistant/canvas/sessions` erstellt mit der `project_id` und dem aktuellen `image_context` (image_url, prompt, model_id, generation_id)

2) GIVEN eine Canvas-Session existiert
   WHEN der User "mach den Hintergrund blauer" eingibt und Send klickt
   THEN wird `POST /api/assistant/canvas/sessions/{id}/messages` aufgerufen mit dem Nachrichten-Text und dem aktuellen `image_context`, und ein SSE-Stream wird geoeffnet

3) GIVEN ein SSE-Stream laeuft
   WHEN `text-delta` Events empfangen werden
   THEN wird der Bot-Antwort-Text inkrementell in einer neuen Bot-Message-Bubble aufgebaut (Streaming-Indicator sichtbar waehrend des Streams)

4) GIVEN ein SSE-Stream laeuft
   WHEN ein `text-done` Event empfangen wird
   THEN wird der Streaming-Indicator ausgeblendet und die Bot-Message als abgeschlossen markiert

5) GIVEN der Agent eine Clarification zurueckgibt mit Chips (z.B. `["Subtil", "Dramatisch"]`)
   WHEN die Bot-Message gerendert wird
   THEN werden die Chips als klickbare Buttons angezeigt und ein Klick auf "Dramatisch" sendet diesen Text als neue Nachricht an die Session

6) GIVEN ein SSE-Stream ein `canvas-generate` Event liefert mit `{ action: "variation", prompt: "...", model_id: "flux-2-max", params: {} }`
   WHEN das Event verarbeitet wird
   THEN wird `generateImages()` Server Action aufgerufen mit den Parametern aus dem Event, `isGenerating` wird auf `true` gesetzt, und der bestehende Polling/Replace-Flow (aus Slice 14) uebernimmt

7) GIVEN eine Generation via Chat-`canvas-generate` laeuft
   WHEN das Chat-Panel gerendert wird
   THEN ist der Chat-Input disabled und zeigt keinen weiteren Streaming-Indicator (Loading-State auf Canvas-Image genuegt)

8) GIVEN der SSE-Stream innerhalb von 60 Sekunden kein Event liefert
   WHEN der Timeout erkannt wird
   THEN wird eine Error-Message als Bot-Bubble angezeigt mit "Keine Antwort. Bitte erneut versuchen." und der Chat-Input wird wieder enabled

9) GIVEN der SSE-Stream ein `error` Event liefert
   WHEN das Event verarbeitet wird
   THEN wird die Fehlerbeschreibung als Error-Bot-Bubble angezeigt (visuell als Fehler markiert) und der Chat-Input wird wieder enabled

10) GIVEN der User das Bild via Prev/Next wechselt (neue `currentGenerationId`)
    WHEN der Bildwechsel erkannt wird
    THEN wird der aktuelle `image_context` fuer nachfolgende Nachrichten aktualisiert (keine neue Session, bestehende Session wird weiterverwendet)

11) GIVEN der User den [+] Button (Neue-Session) klickt
    WHEN die neue Session erstellt wird
    THEN wird die bestehende Session verworfen, eine neue via `POST /api/assistant/canvas/sessions` erstellt, und die Chat-History auf nur die Init-Message zurueckgesetzt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/canvas-chat-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasChatService', () => {
  // AC-1: Session erstellen
  it.todo('should create a canvas session via POST with project_id and image_context')

  // AC-2: Nachricht senden und SSE-Stream oeffnen
  it.todo('should send message via POST with content and image_context and return SSE stream')

  // AC-3: text-delta Events parsen
  it.todo('should parse text-delta SSE events and yield incremental text chunks')

  // AC-4: text-done Event parsen
  it.todo('should parse text-done SSE event and signal stream completion')

  // AC-6: canvas-generate Event parsen
  it.todo('should parse canvas-generate SSE event and return structured generation params')

  // AC-8: Timeout nach 60s
  it.todo('should reject with timeout error when no SSE event received within 60 seconds')

  // AC-9: error Event parsen
  it.todo('should parse error SSE event and yield error with description')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-chat-integration.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasChatPanel (Backend-Integration)', () => {
  // AC-1: Auto-Session-Erstellung beim Mount
  it.todo('should create canvas session on mount with current image context')

  // AC-2: Send-Button sendet Nachricht an Backend
  it.todo('should call sendMessage with text and image_context when user sends message')

  // AC-3: Streaming-Indicator waehrend text-delta
  it.todo('should show streaming indicator while text-delta events are being received')

  // AC-4: Streaming-Indicator verschwindet bei text-done
  it.todo('should hide streaming indicator when text-done event is received')

  // AC-5: Chip-Klick sendet als neue Nachricht
  it.todo('should send chip text as new message when clarification chip is clicked')

  // AC-6: canvas-generate Event triggert generateImages
  it.todo('should call generateImages and set isGenerating when canvas-generate event is received')

  // AC-7: Chat-Input disabled waehrend Generation
  it.todo('should disable chat input when isGenerating is true')

  // AC-8: Timeout-Error als Bot-Bubble
  it.todo('should show error bot message on SSE timeout after 60 seconds')

  // AC-9: Error-Event als Error-Bubble
  it.todo('should show error bot message with description when error SSE event is received')

  // AC-10: Bild-Kontext-Update bei Prev/Next
  it.todo('should update image_context for subsequent messages when currentGenerationId changes')

  // AC-11: Neue-Session-Button erstellt neue Session
  it.todo('should create new session and reset chat history when new session button is clicked')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09-chat-panel-ui` | `CanvasChatPanel`, `CanvasChatMessages`, `CanvasChatInput` | React Components | Erweitern um Backend-Anbindung (SSE-Hooks, Streaming-State, Error-State) |
| `slice-09-chat-panel-ui` | `ChatMessage` Type | TypeScript Type | `{ role, content, chips? }` als Basis fuer Streaming-Messages |
| `slice-14-in-place-generation` | Generation-Flow Pattern | Architecture | `generateImages()` -> Polling -> Replace + Undo-Push |
| `slice-14-in-place-generation` | `isGenerating` State | Context | Disable Chat-Input waehrend Generation |
| `slice-16-canvas-agent-backend` | `POST /api/assistant/canvas/sessions` | REST Endpoint | Session erstellen mit `project_id` + `image_context` |
| `slice-16-canvas-agent-backend` | `POST /api/assistant/canvas/sessions/{id}/messages` | SSE Endpoint | Events: `text-delta`, `canvas-generate`, `text-done`, `error` |
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `currentGenerationId`, `isGenerating`, `dispatch` |
| Existing | `generateImages()` | Server Action | `app/actions/generations.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `canvasChatService` | Service Module | intern (dieser Slice) | `createSession(projectId, imageContext) => sessionId`, `sendMessage(sessionId, content, imageContext) => AsyncIterable<SSEEvent>` |
| Chat-Backend-Integration | Feature-Complete | `slice-18-lightbox-removal` | Chat sendet und empfaengt via Backend, triggert Generierungen |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/canvas-chat-service.ts` -- SSE-Client fuer Canvas-Agent: Session erstellen (POST), Messages senden (POST + SSE-Stream parsen), Events typisieren (text-delta, canvas-generate, text-done, error), 60s Timeout
- [ ] `components/canvas/canvas-chat-panel.tsx` -- Backend-Anbindung: Auto-Session-Erstellung, onSend -> Service-Aufruf, SSE-Event-Loop, canvas-generate -> generateImages() Aufruf, Neue-Session-Handler
- [ ] `components/canvas/canvas-chat-messages.tsx` -- Streaming-Indicator waehrend text-delta, Error-Message-Bubbles (visuell markiert), Chip-Click sendet als Nachricht, image_context-Update bei Bildwechsel
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung am Backend (Canvas-Agent, Routes, Service — alles in Slice 16)
- KEINE neuen UI-Komponenten (Chat-Panel-Shell, Messages, Input existieren aus Slice 9)
- KEIN neuer Polling-Mechanismus (bestehender aus Slice 14 / WorkspaceContent wird genutzt)
- KEINE Aenderung am Generation-Flow (Slice 14 Pattern wird aufgerufen, nicht modifiziert)
- KEIN Thumbnail im Chat fuer generierte Bilder (Ergebnis erscheint nur im Canvas via Replace)

**Technische Constraints:**
- `"use client"` Direktive fuer alle Deliverables
- SSE-Parsing: `EventSource` API oder `fetch()` mit `ReadableStream` (kein Polyfill noetig)
- Timeout: 60s ohne Event -> Error-Bubble + Input re-enabled
- Clarification-Chips: Agent liefert Chips als Teil der Bot-Antwort; Klick ruft `sendMessage()` mit Chip-Text auf
- `canvas-generate` Event-Verarbeitung: Extrahiere `{ action, prompt, model_id, params }`, rufe `generateImages()` auf
- Toast-Notifications via Sonner (`toast.error()` bei Netzwerkfehler)
- Session-State (`sessionId`) als lokaler State im Chat-Panel (nicht im Context)

**Referenzen:**
- Architecture: `architecture.md` -> Section "API Design > New Endpoints" (Canvas-Session + Message Routes)
- Architecture: `architecture.md` -> Section "API Design > DTOs" (CanvasImageContext, CanvasSendMessageRequest, CanvasGenerateEvent)
- Architecture: `architecture.md` -> Section "Server Logic > Business Logic Flow" (Agent -> SSE -> Frontend -> Server Action)
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (Chat agent timeout 60s, SSE error event)
- Wireframes: `wireframes.md` -> Screen "Chat Panel Active" (Annotations 4-8 fuer Message-Flow und Chips)
- Discovery: `discovery.md` -> "Feature State Machine" -> `detail-chat-active` State und Transitions
