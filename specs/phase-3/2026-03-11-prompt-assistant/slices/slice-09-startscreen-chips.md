# Slice 09: Startscreen + Suggestion Chips

> **Slice 9 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-startscreen-chips` |
| **Test** | `pnpm test components/assistant/__tests__/startscreen.test.tsx components/assistant/__tests__/chat-input.test.tsx components/assistant/__tests__/model-selector.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-assistant-sheet-shell"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/assistant/__tests__` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Erstelle den Startscreen-Inhalt innerhalb der AssistantSheet-Shell (aus Slice 08): Willkommens-Text, 4 klickbare Suggestion-Chips, Session-History-Link, Chat-Input-Footer und Model-Selector im Header. Damit hat die Sheet-UI alle statischen Elemente fuer den leeren Zustand, bevor in Slice 10 der eigentliche Chat-Loop angebunden wird.

---

## Acceptance Criteria

1) GIVEN der AssistantSheet ist geoeffnet und es existiert keine aktive Session
   WHEN der Startscreen gerendert wird
   THEN wird der Text "Womit kann ich dir helfen?" zentriert im Main-Bereich angezeigt

2) GIVEN der Startscreen wird angezeigt
   WHEN der User die Suggestion-Chips betrachtet
   THEN sind 4 Chips in einem 2x2 Grid sichtbar mit den Texten: "Hilf mir einen Prompt zu schreiben", "Analysiere ein Referenzbild", "Verbessere meinen aktuellen Prompt", "Welches Modell passt zu meiner Idee?"

3) GIVEN der Startscreen wird angezeigt
   WHEN der User auf einen Suggestion-Chip klickt (z.B. "Hilf mir einen Prompt zu schreiben")
   THEN wird ein `onChipClick` Callback mit dem Chip-Text als Argument aufgerufen und der Intent in der Console geloggt

4) GIVEN es existieren keine vergangenen Sessions fuer das aktuelle Projekt
   WHEN der Startscreen gerendert wird
   THEN ist der Session-History-Link ("Vergangene Sessions anzeigen") nicht sichtbar (hidden)

5) GIVEN es existieren vergangene Sessions fuer das aktuelle Projekt
   WHEN der Startscreen gerendert wird
   THEN ist der Session-History-Link "Vergangene Sessions anzeigen" sichtbar und klickbar

6) GIVEN der Startscreen wird angezeigt
   WHEN der User den Footer-Bereich betrachtet
   THEN ist ein Chat-Input sichtbar mit: Textarea (Placeholder "Nachricht eingeben..."), einem Send-Button (ArrowUp Icon, disabled), und einem Image-Upload-Button (Image Icon, als Placeholder ohne Funktionalitaet)

7) GIVEN die Chat-Input Textarea ist leer
   WHEN der User den Send-Button betrachtet
   THEN ist der Send-Button disabled (nicht klickbar)

8) GIVEN die Chat-Input Textarea enthaelt Text
   WHEN der User den Send-Button betrachtet
   THEN ist der Send-Button enabled (klickbar)

9) GIVEN der AssistantSheet ist geoeffnet
   WHEN der User den Header betrachtet
   THEN ist ein Model-Selector Dropdown sichtbar zwischen dem Titel "Prompt Assistent" und dem Close-Button

10) GIVEN der Model-Selector Dropdown wird geoeffnet
    WHEN der User die Optionen betrachtet
    THEN sind 3 Modelle verfuegbar: "Sonnet 4.6" (ausgewaehlt als Default), "GPT-5.4", "Gemini 3.1 Pro"

11) GIVEN der Model-Selector zeigt "Sonnet 4.6" als Default
    WHEN der User "GPT-5.4" auswaehlt
    THEN zeigt der Dropdown "GPT-5.4" als aktuelles Modell und der Wert wird im lokalen State persistiert

12) GIVEN der User oeffnet den AssistantSheet und die Textarea ist leer
    WHEN der Focus-State geprueft wird
    THEN liegt der Focus auf der Chat-Input Textarea

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/startscreen.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Startscreen', () => {
  // AC-1: Willkommens-Text
  it.todo('should display "Womit kann ich dir helfen?" centered text')

  // AC-2: 4 Suggestion-Chips in 2x2 Grid
  it.todo('should render 4 suggestion chips with correct texts in a 2x2 grid')

  // AC-3: Chip-Klick ruft Callback auf
  it.todo('should call onChipClick with chip text when a chip is clicked')

  // AC-4: Session-History-Link hidden wenn keine Sessions
  it.todo('should hide session history link when hasSessions is false')

  // AC-5: Session-History-Link sichtbar wenn Sessions existieren
  it.todo('should show "Vergangene Sessions anzeigen" link when hasSessions is true')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-input.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ChatInput', () => {
  // AC-6: Textarea + Send-Button + Image-Upload-Button sichtbar
  it.todo('should render textarea with placeholder, disabled send button, and image upload button')

  // AC-7: Send-Button disabled bei leerer Textarea
  it.todo('should keep send button disabled when textarea is empty')

  // AC-8: Send-Button enabled bei Text in Textarea
  it.todo('should enable send button when textarea contains text')

  // AC-12: Focus auf Textarea
  it.todo('should receive focus when autoFocus prop is true')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/model-selector.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelSelector', () => {
  // AC-9: Dropdown im Header sichtbar
  it.todo('should render a dropdown trigger showing the current model name')

  // AC-10: 3 Modelle verfuegbar mit Sonnet 4.6 als Default
  it.todo('should show three model options with "Sonnet 4.6" selected by default')

  // AC-11: Modell-Wechsel
  it.todo('should update selected model and call onChange when a different model is selected')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-08-assistant-sheet-shell | `AssistantSheet` mit children-Slot | Component | Startscreen wird als child gerendert, Sheet oeffnet/schliesst korrekt |
| slice-08-assistant-sheet-shell | Sheet Header Bereich | Component-Slot | Model-Selector wird im Header-Bereich integriert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Startscreen` | Component | slice-10 (Core Chat Loop) | `<Startscreen hasSessions={boolean} onChipClick={(text: string) => void} onSessionHistoryClick={() => void}>` |
| `ChatInput` | Component | slice-10 (Core Chat Loop), slice-11 (Streaming) | `<ChatInput onSend={(text: string) => void} disabled={boolean} autoFocus={boolean}>` |
| `ModelSelector` | Component | slice-10 (Core Chat Loop) | `<ModelSelector value={string} onChange={(modelSlug: string) => void}>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/startscreen.tsx` -- Willkommens-Text, 4 Suggestion-Chips (2x2 Grid), Session-History-Link
- [ ] `components/assistant/chat-input.tsx` -- Textarea + Send-Button (disabled/enabled) + Image-Upload-Button (Placeholder)
- [ ] `components/assistant/model-selector.tsx` -- Dropdown mit 3 LLM-Optionen, Default Sonnet 4.6, lokaler State
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Chat-Funktionalitaet (kein Message senden, kein SSE, kein Backend-Call) -- kommt in Slice 10
- Dieser Slice implementiert KEINEN Session-Switcher Button im Header (kommt in Slice 13c)
- Der Image-Upload-Button ist nur ein visueller Placeholder -- keine Upload-Funktionalitaet (kommt in Slice 17)
- Der Send-Button loggt bei Klick den eingegebenen Text in die Console, sendet aber NICHT an ein Backend
- Die Suggestion-Chips senden NICHT an ein Backend -- sie rufen nur einen Callback auf (Console-Log)
- `hasSessions` wird als Prop uebergeben, KEIN Backend-Call zum Pruefen (kommt in Slice 13b)

**Technische Constraints:**
- Nutze `lucide-react` Icons: `ArrowUp` (Send), `Image` (Upload), `ChevronDown` (Dropdown)
- Chat-Input Textarea: Enter = Submit (via onSend Callback), Shift+Enter = Newline
- Model-Selector: Die 3 Slugs sind `anthropic/claude-sonnet-4.6`, `openai/gpt-5.4`, `google/gemini-3.1-pro-preview` -- Display-Namen: "Sonnet 4.6", "GPT-5.4", "Gemini 3.1 Pro"
- Suggestion-Chip Texte exakt wie in discovery.md Section "Empfohlene Vorschlaege fuer Conversation Starters"
- Startscreen wird als children in `AssistantSheet` gerendert (aus Slice 08)
- Model-Selector muss in den Sheet-Header integriert werden (erfordert Erweiterung des Header-Bereichs aus Slice 08)

**Referenzen:**
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Startscreen"
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (suggestion-chip, chat-input, send-btn, image-upload-btn, model-selector)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "LLM Model Selection" (Model Slugs + Defaults)
