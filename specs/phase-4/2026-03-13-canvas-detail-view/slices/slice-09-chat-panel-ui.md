# Slice 9: Chat Panel UI (Shell + Messages)

> **Slice 9 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-chat-panel-ui` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-chat-panel.test.tsx components/canvas/__tests__/canvas-chat-messages.test.tsx components/canvas/__tests__/canvas-chat-input.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-detail-view-shell"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-chat-panel.test.tsx components/canvas/__tests__/canvas-chat-messages.test.tsx components/canvas/__tests__/canvas-chat-input.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/canvas-chat-panel.test.tsx components/canvas/__tests__/canvas-chat-messages.test.tsx components/canvas/__tests__/canvas-chat-input.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Chat-Panel als rechte Spalte im Detail-View erstellen: Collapsible Container (48px Icon-Strip vs. 320-480px expanded) mit Resize-Handle, Message-Bubbles (User/Bot), Init-Message mit Bild-Kontext, Chat-Input mit Send-Button und Neue-Session-Button. Reine UI-Komponenten ohne Backend-Anbindung (kommt in Slice 17).

---

## Acceptance Criteria

1) GIVEN die CanvasDetailView ist sichtbar mit einem Bild
   WHEN der Chat-Slot (rechte Spalte) geprueft wird
   THEN rendert das `CanvasChatPanel` im expanded State mit einer Breite zwischen 320px und 480px

2) GIVEN das Chat-Panel ist expanded
   WHEN der User den Collapse-Button ([-] Icon) klickt
   THEN kollabiert das Panel auf einen 48px breiten Icon-Strip mit nur einem Chat-Icon sichtbar

3) GIVEN das Chat-Panel ist collapsed (48px Icon-Strip)
   WHEN der User auf den Chat-Icon-Strip klickt
   THEN expandiert das Panel auf die vorherige Breite (oder Default 360px)

4) GIVEN das Chat-Panel ist expanded
   WHEN der User den Resize-Handle am linken Rand zieht
   THEN aendert sich die Panel-Breite, begrenzt auf Minimum 320px und Maximum 480px

5) GIVEN das Chat-Panel ist expanded und ein Bild mit Metadaten ist geladen
   WHEN der Nachrichten-Bereich geprueft wird
   THEN zeigt die erste Nachricht eine Init-Message mit Bild-Kontext: Model-Name, Prompt (gekuerzt), und Key-Parameter (Steps, CFG)

6) GIVEN der Chat hat eine History mit mindestens einer User- und einer Bot-Nachricht
   WHEN der Nachrichten-Bereich geprueft wird
   THEN werden User-Messages rechtsbuendig und Bot-Messages linksbuendig als Bubbles dargestellt

7) GIVEN eine Bot-Nachricht enthaelt Chip-Optionen (z.B. ["Subtil", "Dramatisch"])
   WHEN der Nachrichten-Bereich geprueft wird
   THEN werden die Chips als klickbare Buttons unterhalb des Bot-Texts angezeigt

8) GIVEN der User klickt auf einen Chip in einer Bot-Nachricht
   WHEN der Chip-Click verarbeitet wird
   THEN wird der Chip-Text als neue User-Message in die History eingefuegt

9) GIVEN der User wechselt das Bild via Prev/Next Navigation (andere generationId)
   WHEN der Chat geprueft wird
   THEN erscheint ein visueller Context-Separator ("Kontext: [Bild-Identifier]") gefolgt von einer neuen Init-Message mit dem Kontext des neuen Bildes

10) GIVEN das Chat-Panel ist expanded
    WHEN das Input-Feld geprueft wird
    THEN zeigt es ein Textfeld mit Placeholder "Describe changes..." und einen Send-Button rechts

11) GIVEN der User tippt Text in das Chat-Input und klickt Send (oder drueckt Enter)
    WHEN die Nachricht gesendet wird
    THEN erscheint der Text als neue User-Message in der History und das Input-Feld wird geleert

12) GIVEN der Chat hat Nachrichten in der History
    WHEN der User den [+] Button (Neue-Session) im Chat-Header klickt
    THEN wird die gesamte Chat-History geleert und nur die Init-Message mit aktuellem Bild-Kontext bleibt

13) GIVEN der Chat hat mehrere Nachrichten
    WHEN eine neue Nachricht hinzugefuegt wird
    THEN scrollt der Nachrichten-Bereich automatisch nach unten zur neuesten Nachricht

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-chat-panel.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasChatPanel', () => {
  // AC-1: Panel rendert expanded mit Breite 320-480px
  it.todo('should render in expanded state with width between 320px and 480px')

  // AC-2: Collapse-Button kollabiert Panel auf 48px Icon-Strip
  it.todo('should collapse to 48px icon strip when collapse button is clicked')

  // AC-3: Klick auf Icon-Strip expandiert Panel
  it.todo('should expand to previous width when collapsed icon strip is clicked')

  // AC-4: Resize-Handle begrenzt Breite auf 320-480px
  it.todo('should constrain panel width between 320px and 480px during resize')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-chat-messages.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasChatMessages', () => {
  // AC-5: Init-Message zeigt Bild-Kontext (Model, Prompt, Params)
  it.todo('should render init message with image context including model, prompt, and params')

  // AC-6: User-Messages rechtsbuendig, Bot-Messages linksbuendig
  it.todo('should render user messages right-aligned and bot messages left-aligned')

  // AC-7: Bot-Nachricht mit Chips zeigt klickbare Buttons
  it.todo('should render clickable chip buttons below bot message text')

  // AC-8: Chip-Klick fuegt Chip-Text als User-Message ein
  it.todo('should add chip text as new user message when chip is clicked')

  // AC-9: Context-Separator bei Bildwechsel mit neuer Init-Message
  it.todo('should render context separator and new init message when image changes')

  // AC-12: Neue-Session-Button leert History bis auf Init-Message
  it.todo('should clear chat history and show only init message when new session button is clicked')

  // AC-13: Auto-Scroll bei neuer Nachricht
  it.todo('should auto-scroll to latest message when new message is added')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-chat-input.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasChatInput', () => {
  // AC-10: Input-Feld mit Placeholder und Send-Button
  it.todo('should render text input with placeholder "Describe changes..." and send button')

  // AC-11: Send fuegt User-Message ein und leert Input
  it.todo('should add user message to history and clear input on send')

  // AC-11: Enter-Taste sendet Nachricht
  it.todo('should send message when Enter key is pressed')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-detail-view-shell` | Chat-Slot (right column) | Layout Slot | Panel rendert im rechten Slot der `CanvasDetailView` |
| `slice-05-detail-view-shell` | `CanvasDetailView` generation Prop | React Prop | Zugriff auf `generation.prompt`, `generation.modelId`, `generation.steps`, `generation.cfgScale` fuer Init-Message |
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `currentGenerationId` fuer Bild-Kontext und Bildwechsel-Erkennung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasChatPanel` | React Component | `slice-17-canvas-chat-frontend` | `<CanvasChatPanel generation={Generation} onSendMessage={(text: string) => void} />` |
| `CanvasChatMessages` | React Component | `slice-17-canvas-chat-frontend` | `<CanvasChatMessages messages={ChatMessage[]} onChipClick={(text: string) => void} />` |
| `CanvasChatInput` | React Component | `slice-17-canvas-chat-frontend` | `<CanvasChatInput onSend={(text: string) => void} disabled={boolean} />` |
| Chat-Message-Types | TypeScript Types | `slice-17-canvas-chat-frontend` | `ChatMessage { role: 'user' | 'bot' | 'system' | 'separator'; content: string; chips?: string[] }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-chat-panel.tsx` -- Chat-Container mit Collapse/Expand-Toggle, Resize-Handle (320-480px), Neue-Session-Button, Chat-Header
- [ ] `components/canvas/canvas-chat-messages.tsx` -- Message-Bubbles (User/Bot), Init-Message mit Bild-Kontext, Context-Separator, Chips, Auto-Scroll
- [ ] `components/canvas/canvas-chat-input.tsx` -- Text-Input mit Placeholder, Send-Button, Enter-Handler
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Backend-Anbindung (kein SSE-Streaming, kein API-Call) -- kommt in Slice 17
- KEINE Streaming-Indicator-Logik (kommt in Slice 17 mit Backend-Integration)
- KEINE canvas-generate Event-Verarbeitung (kommt in Slice 17)
- KEIN Loading/Sending-State der auf Backend wartet -- nur lokale UI-State-Verwaltung
- KEINE Aenderung an `canvas-detail-view.tsx` ausser Einbindung des Chat-Panels im Chat-Slot

**Technische Constraints:**
- `"use client"` Direktive fuer alle drei Komponenten
- Chat-State (messages, collapsed, width) als lokaler `useState` -- kein Context noetig fuer diesen Slice
- Resize: CSS `resize` oder mousedown/mousemove-Handler mit `requestAnimationFrame` fuer jank-freies Resizing
- Auto-Scroll: `scrollIntoView({ behavior: 'smooth' })` auf letztem Message-Element
- Bestehende `components/assistant/chat-thread.tsx` und `chat-input.tsx` als Pattern-Referenz (nicht importieren, da Canvas-Chat eigene Anforderungen hat: Init-Message, Separator, Collapse)

**Referenzen:**
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` -- Screen "Chat Panel Active" und "Chat Panel Collapsed"
- Discovery: `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md` -- Section "UI Components & States" (chat-panel, chat-init, chat-input, chat-message.*, chat-chips, chat-context-separator, chat-new-session)
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` -- Section "Architecture Layers" (Chat-Panel Verantwortlichkeit)
- Bestehende Chat-Patterns: `components/assistant/chat-thread.tsx`, `components/assistant/chat-input.tsx` als Referenz fuer Message-Rendering und Input-Handling
