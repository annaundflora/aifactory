# Slice 15: Undo/Redo Stack (Keyboard + UI)

> **Slice 15 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-undo-redo` |
| **Test** | `pnpm test components/canvas/__tests__/undo-redo.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-14-in-place-generation"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/undo-redo.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/undo-redo.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Undo- und Redo-Buttons im Canvas-Header rendern und Keyboard-Shortcuts (Cmd+Z / Cmd+Shift+Z) implementieren. Die Shortcuts werden bei Fokus in Input/Textarea unterdrueckt. Der bestehende Reducer aus Slice 3 liefert die Undo/Redo-Logik; dieser Slice verbindet sie mit der UI und den Keyboard-Events.

---

## Acceptance Criteria

1) GIVEN die Detail-View ist sichtbar mit `undoStack: ["gen-A"]` und `currentGenerationId: "gen-B"`
   WHEN der User den Undo-Button im Header klickt
   THEN dispatcht `POP_UNDO`, `currentGenerationId` wird `"gen-A"`, und `"gen-B"` wandert auf den `redoStack`

2) GIVEN die Detail-View ist sichtbar mit `redoStack: ["gen-C"]` und `currentGenerationId: "gen-A"`
   WHEN der User den Redo-Button im Header klickt
   THEN dispatcht `POP_REDO`, `currentGenerationId` wird `"gen-C"`, und `"gen-A"` wandert auf den `undoStack`

3) GIVEN `undoStack: []`
   WHEN der Undo-Button gerendert wird
   THEN ist er visuell disabled (`aria-disabled="true"`, nicht klickbar)

4) GIVEN `redoStack: []`
   WHEN der Redo-Button gerendert wird
   THEN ist er visuell disabled (`aria-disabled="true"`, nicht klickbar)

5) GIVEN die Detail-View ist sichtbar, kein Input/Textarea hat Fokus, `undoStack` ist nicht leer
   WHEN der User Cmd+Z (Mac) bzw. Ctrl+Z (Windows) drueckt
   THEN wird `POP_UNDO` dispatcht (identisch zum Button-Klick)

6) GIVEN die Detail-View ist sichtbar, kein Input/Textarea hat Fokus, `redoStack` ist nicht leer
   WHEN der User Cmd+Shift+Z (Mac) bzw. Ctrl+Shift+Z (Windows) drueckt
   THEN wird `POP_REDO` dispatcht (identisch zum Button-Klick)

7) GIVEN ein `<input>` oder `<textarea>` hat Fokus
   WHEN der User Cmd+Z drueckt
   THEN wird das Event NICHT abgefangen (Browser-Default: Text-Undo im Feld)

8) GIVEN ein `<input>` oder `<textarea>` hat Fokus
   WHEN der User Cmd+Shift+Z drueckt
   THEN wird das Event NICHT abgefangen (Browser-Default: Text-Redo im Feld)

9) GIVEN `isGenerating: true`
   WHEN die Undo/Redo-Buttons gerendert werden
   THEN sind beide Buttons disabled (unabhaengig vom Stack-Inhalt)

10) GIVEN `isGenerating: true` und kein Input hat Fokus
    WHEN der User Cmd+Z oder Cmd+Shift+Z drueckt
    THEN passiert nichts (Shortcuts sind waehrend Generation blockiert)

11) GIVEN eine neue Generation wurde completed (via Slice 14: `PUSH_UNDO` dispatcht)
    WHEN der Undo-Stack aktualisiert wird
    THEN ist der Redo-Stack leer (PUSH_UNDO aus Slice 3 leert redoStack automatisch)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/undo-redo.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Undo/Redo Buttons', () => {
  // AC-1: Undo-Button dispatcht POP_UNDO
  it.todo('should dispatch POP_UNDO when undo button is clicked')

  // AC-2: Redo-Button dispatcht POP_REDO
  it.todo('should dispatch POP_REDO when redo button is clicked')

  // AC-3: Undo-Button disabled bei leerem Stack
  it.todo('should render undo button as disabled when undoStack is empty')

  // AC-4: Redo-Button disabled bei leerem Stack
  it.todo('should render redo button as disabled when redoStack is empty')

  // AC-9: Beide Buttons disabled waehrend isGenerating
  it.todo('should disable both buttons when isGenerating is true regardless of stack content')
})

describe('Undo/Redo Keyboard Shortcuts', () => {
  // AC-5: Cmd+Z dispatcht POP_UNDO
  it.todo('should dispatch POP_UNDO on Cmd+Z when no input is focused')

  // AC-6: Cmd+Shift+Z dispatcht POP_REDO
  it.todo('should dispatch POP_REDO on Cmd+Shift+Z when no input is focused')

  // AC-7: Cmd+Z unterdrueckt bei Input-Fokus
  it.todo('should not intercept Cmd+Z when an input element has focus')

  // AC-8: Cmd+Shift+Z unterdrueckt bei Textarea-Fokus
  it.todo('should not intercept Cmd+Shift+Z when a textarea element has focus')

  // AC-10: Shortcuts blockiert waehrend Generation
  it.todo('should not dispatch any action on Cmd+Z or Cmd+Shift+Z when isGenerating is true')
})

describe('Redo-Stack Clearing', () => {
  // AC-11: Neue Generation leert Redo-Stack
  it.todo('should have empty redoStack after PUSH_UNDO is dispatched from new generation')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.undoStack`, `state.redoStack`, `state.isGenerating`, `dispatch(POP_UNDO)`, `dispatch(POP_REDO)` |
| `slice-03-canvas-detail-context` | `canvasDetailReducer` | Reducer | `PUSH_UNDO` leert `redoStack` automatisch (AC-11 ist Reducer-Verhalten) |
| `slice-05-detail-view-shell` | `CanvasHeader` | React Component | Rendert children-Slots fuer Undo/Redo-Buttons |
| `slice-14-in-place-generation` | `isGenerating` State | Context Dispatch | `true` waehrend Generation, disabled Undo/Redo |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Undo/Redo-Buttons in Header | React UI | `slice-16`, `slice-17` | Buttons reagieren automatisch auf Stack-State-Aenderungen durch Chat-generierte Bilder |
| Keyboard-Shortcut-Handler | useEffect | Keine direkten Consumer | Global aktiv solange Detail-View geoeffnet |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-header.tsx` -- Undo/Redo-Buttons mit Icons, Disabled-States basierend auf Stack-Inhalt und isGenerating, onClick dispatcht POP_UNDO/POP_REDO
- [ ] `lib/canvas-detail-context.tsx` -- useEffect-Hook fuer globale Keyboard-Shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) mit Input/Textarea-Fokus-Check und isGenerating-Guard
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an der Reducer-Logik (POP_UNDO, POP_REDO, PUSH_UNDO sind in Slice 3 definiert und getestet)
- KEINE eigene Undo/Redo-History-UI (nur zwei Buttons, kein History-Panel/Dropdown)
- KEINE Persistierung des Undo/Redo-Stacks (Client-only, siehe Discovery Q&A #2)
- KEINE Aenderung am Generation-Flow (PUSH_UNDO wird von Slice 14 dispatcht)

**Technische Constraints:**
- Keyboard-Listener als `useEffect` mit `keydown`-Event auf `document`
- Fokus-Check: `document.activeElement?.tagName` gegen `"INPUT"` und `"TEXTAREA"` pruefen, plus `contentEditable`-Elemente
- Plattform-Detection: `metaKey` fuer Mac, `ctrlKey` fuer Windows/Linux (via `event.metaKey || event.ctrlKey`)
- `event.preventDefault()` nur wenn Shortcut tatsaechlich verarbeitet wird
- Icons: Lucide React `Undo2` und `Redo2` (oder passende Varianten aus dem Projekt-Icon-Set)
- Buttons muessen `aria-disabled` und visuellen Disabled-State haben (nicht HTML `disabled` auf einem non-form-Element)

**Referenzen:**
- Architecture: `architecture.md` -> Section "Quality Attributes" (Undo Responsiveness < 50ms)
- Discovery: `discovery.md` -> Section "Business Rules" (Undo/Redo-Stack-Verhalten, Keyboard-Shortcuts)
- Discovery: `discovery.md` -> Section "Trigger-Inventory" (Cmd+Z / Cmd+Shift+Z Trigger)
- Wireframes: `wireframes.md` -> Screen "Canvas-Detail-View (Idle)" Annotations 3+4 (undo-button, redo-button)
- Wireframes: `wireframes.md` -> "State Variations" (undo-button.disabled, redo-button.disabled, detail-generating)
