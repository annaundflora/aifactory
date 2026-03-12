# Slice 19: Iterativer Loop

> **Slice 19 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-19-iterativer-loop` |
| **Test** | `pnpm test lib/assistant/__tests__/assistant-context-persistence.test.tsx components/assistant/__tests__/assistant-sheet-resume.test.tsx components/assistant/__tests__/chat-thread-feedback.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-15-apply-button-workspace"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test lib/assistant/__tests__/assistant-context-persistence.test.tsx components/assistant/__tests__/assistant-sheet-resume.test.tsx components/assistant/__tests__/chat-thread-feedback.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` (manuell: Apply -> Sheet schliessen -> Sheet oeffnen -> Chat-History pruefen -> Feedback geben -> Re-Apply) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Backend-Calls und PromptAssistantContext werden gemockt) |

---

## Ziel

Nach einem Apply bleibt die Session persistent ueber Sheet open/close Zyklen hinweg. Beim erneuten Oeffnen des Sheets wird die letzte aktive Session automatisch geladen (Chat-History + Canvas-State). Der User kann iteratives Feedback geben ("zu dunkel, aendere den Prompt"), der Agent passt den Canvas via `refine_prompt` an, und ein Re-Apply ist moeglich.

---

## Acceptance Criteria

1) GIVEN der User hat in einer Session Apply geklickt und das Sheet geschlossen
   WHEN der User das Sheet erneut oeffnet (via Trigger-Button)
   THEN wird die letzte aktive Session automatisch geladen: Chat-History zeigt alle bisherigen Messages, Canvas-Panel ist sichtbar mit dem zuletzt applied Prompt

2) GIVEN die Session wurde nach Sheet-Schliessung wiederhergestellt
   WHEN der User im Chat-Input "zu dunkel, aendere den Prompt" eingibt und sendet
   THEN wird die Nachricht an dieselbe Session-ID gesendet (POST `/api/assistant/sessions/{id}/messages`), der Agent antwortet und ruft `refine_prompt` auf, die Canvas-Felder werden aktualisiert

3) GIVEN der Agent hat den Canvas via `refine_prompt` angepasst nach User-Feedback
   WHEN der User erneut auf Apply klickt
   THEN werden die aktualisierten Canvas-Felder in den Workspace uebertragen (identisches Verhalten wie Slice 15: `setVariation()` mit neuen Werten, Undo-Toast erscheint)

4) GIVEN der `PromptAssistantContext` verwaltet die aktive Session-ID
   WHEN das Sheet geschlossen wird (X-Button, Escape, oder Trigger-Button)
   THEN bleibt die aktive `sessionId` im Context erhalten (wird NICHT zurueckgesetzt), sodass beim naechsten Oeffnen die Session fortgesetzt werden kann

5) GIVEN keine aktive Session existiert (erster Besuch oder alle Sessions archiviert)
   WHEN der User das Sheet oeffnet
   THEN wird der Startscreen angezeigt (keine automatische Session-Erstellung)

6) GIVEN der User hat Applied und das Sheet geschlossen
   WHEN der User das Sheet erneut oeffnet und die Session geladen wird
   THEN ist der `isApplied`-State auf `true` gesetzt und der Apply-Button zeigt den normalen "Apply"-Text (nicht "Applied!" -- der 2-Sekunden-Feedback-Zustand ist transient und nicht persistent)

7) GIVEN eine aktive Session mit Canvas existiert
   WHEN der User das Sheet schliesst und eine Bild-Generierung durchfuehrt
   THEN bleibt die Session im Context intakt -- beim erneuten Oeffnen ist die gesamte Chat-History und der Canvas-State unveraendert verfuegbar

8) GIVEN der "Verbessere meinen aktuellen Prompt" Suggestion-Chip auf dem Startscreen
   WHEN der User den Chip klickt und aktuelle Workspace-Felder nicht leer sind (`promptMotiv` hat Inhalt)
   THEN werden die aktuellen Workspace-Felder als Kontext an den Agent mitgesendet, damit der Agent den bestehenden Prompt analysieren und verbessern kann

9) GIVEN der "Verbessere meinen aktuellen Prompt" Chip wird geklickt
   WHEN alle Workspace-Prompt-Felder leer sind (`promptMotiv`, `promptStyle`, `negativePrompt` alle `""`)
   THEN wird der Chip-Text trotzdem als Nachricht gesendet -- der Agent erkennt die leeren Felder und leitet in die Verstehen-Phase ueber (siehe discovery.md Edge Cases)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `lib/assistant/__tests__/assistant-context-persistence.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptAssistantContext - Session Persistence', () => {
  // AC-4: Session-ID bleibt nach Sheet-Schliessung erhalten
  it.todo('should retain sessionId in context when sheet is closed')

  // AC-1: Aktive Session wird beim Sheet-Oeffnen geladen
  it.todo('should load last active session including messages and draftPrompt when sheet opens')

  // AC-5: Startscreen wenn keine aktive Session
  it.todo('should show startscreen when no active sessionId exists in context')

  // AC-6: isApplied State wird beim Session-Laden korrekt gesetzt
  it.todo('should set isApplied to true when loaded session has a draftPrompt that was applied')

  // AC-7: Session bleibt intakt ueber Sheet-Schliessung hinweg
  it.todo('should preserve full session state across sheet close and reopen cycle')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/assistant-sheet-resume.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('AssistantSheet - Session Resume', () => {
  // AC-1: Chat-History und Canvas nach Sheet-Reopen sichtbar
  it.todo('should render chat history and canvas panel when reopening sheet with active session')

  // AC-2: User kann Feedback senden nach Session-Resume
  it.todo('should allow sending message to existing session after sheet reopen')

  // AC-3: Re-Apply funktioniert nach Agent-Anpassung
  it.todo('should allow re-apply after agent refines prompt via feedback')

  // AC-5: Startscreen ohne aktive Session
  it.todo('should render startscreen when opening sheet without active session')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-thread-feedback.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ChatThread - Improve Prompt Chip', () => {
  // AC-8: Chip sendet aktuelle Workspace-Felder als Kontext
  it.todo('should include current workspace fields when improve-prompt chip is clicked with non-empty fields')

  // AC-9: Chip funktioniert auch bei leeren Workspace-Feldern
  it.todo('should send chip text without workspace fields when all prompt fields are empty')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-15-apply-button-workspace | `isApplied` | Context-Feld | `boolean` -- wurde der aktuelle Draft applied? |
| slice-15-apply-button-workspace | `applyToWorkspace` | Context-Funktion | `() => void` |
| slice-14-prompt-canvas-panel | `hasCanvas` | Context-Feld | `boolean` -- Canvas sichtbar? |
| slice-14-prompt-canvas-panel | `draftPrompt` | Context-Feld | `{ motiv: string, style: string, negativePrompt: string }` |
| slice-10-core-chat-loop | `PromptAssistantContext` | React Context | `sessionId`, `messages`, `sendMessage()`, `isStreaming` |
| slice-10-core-chat-loop | `useAssistantRuntime` | Hook | SSE-Verbindung und Session-Management |
| (existing) | `useWorkspaceVariation` | Hook | `{ variationData }` -- aktuelle Workspace-Felder lesen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `activeSessionId` Persistenz | Context-Logik | slice-13c (Session Resume) | Session-ID ueberlebt Sheet open/close |
| `loadSession(sessionId)` | Context-Funktion | slice-13c (Session Resume) | `(sessionId: string) => Promise<void>` -- laedt Session-State vom Backend |
| `getWorkspaceFieldsForChip` | Helper-Funktion | slice-19 intern | Liest aktuelle Workspace-Felder fuer "Verbessere"-Chip |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/assistant-context.tsx` (erweitert) -- Session-Persistenz ueber Sheet open/close: activeSessionId bleibt erhalten, `loadSession()` Funktion, isApplied Restore-Logik
- [ ] `components/assistant/assistant-sheet.tsx` (erweitert) -- Beim Oeffnen: wenn activeSessionId vorhanden, Session automatisch laden (Chat-History + Canvas), sonst Startscreen
- [ ] `components/assistant/chat-thread.tsx` (erweitert) -- "Verbessere meinen aktuellen Prompt" Chip-Handler: liest Workspace-Felder und sendet sie als Kontext mit der Nachricht
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Session-Liste oder Session-Wechsel (kommt in Slice 13b/13c)
- Dieser Slice implementiert KEINE neue Backend-Route -- die bestehenden Endpoints (POST messages, GET session/{id}) werden genutzt
- Dieser Slice implementiert KEINE persistente Speicherung der activeSessionId im localStorage -- der State lebt im React Context (page-level Persistenz, nicht browser-level)
- Dieser Slice implementiert KEIN Neuladen der Session nach Page-Refresh (das ist Scope von Slice 13c)

**Technische Constraints:**
- `activeSessionId` bleibt im `PromptAssistantContext` State erhalten, auch wenn das Sheet-UI unmounted wird -- der Context-Provider sitzt oberhalb des Sheet-Mounts
- Session-Laden via GET `/api/assistant/sessions/{id}` (bestehender Endpoint aus Slice 13a): Response enthaelt `SessionState` mit `messages`, `draft_prompt`, `recommended_model`
- "Verbessere"-Chip sendet die aktuellen Workspace-Felder als formatierten Kontext-String im Message-Content (z.B. "[Aktueller Prompt: motiv=..., style=..., negative=...]")
- Re-Apply nutzt exakt dieselbe `applyToWorkspace()` Funktion aus Slice 15 (kein neuer Code noetig)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design" (GET /api/assistant/sessions/{id} Response)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Applied State" (iterativer Loop User Flow)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "User Flow" (Happy Path Schritt 13: iterativer Loop)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Feature State Machine" (applied -> streaming Transition)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Edge Cases" (leere Workspace-Felder bei "Verbessere"-Chip)
