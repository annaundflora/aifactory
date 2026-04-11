# Slice 4: Wheel + Keyboard Event Handler

> **Slice 4 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-wheel-keyboard` |
| **Test** | `pnpm test __tests__/lib/hooks/use-canvas-zoom-events.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-zoom-hook-transform"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/hooks/use-canvas-zoom-events.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (addEventListener, ResizeObserver, document.activeElement mocken) |

---

## Ziel

Wheel-Events auf der canvas-area mit drei Modi verdrahten: Ctrl/Cmd+Scroll fuer stufenlosen Cursor-Anchor-Zoom, nacktes Scroll fuer vertikales Pan, Shift+Scroll fuer horizontales Pan. Keyboard-Shortcuts +/-/0 mit Focus-Guard registrieren. Container-Resize-Handling fuer fitLevel-Neuberechnung.

---

## Acceptance Criteria

1) GIVEN canvas-area ist gemountet und Maus ist ueber dem Canvas
   WHEN ein `wheel`-Event mit `ctrlKey: true` und `deltaY: -100` gefeuert wird
   THEN `preventDefault()` wird aufgerufen UND `zoomToPoint()` wird mit einer Zoom-Erhoehung und Cursor-Position als Anchor aufgerufen

2) GIVEN canvas-area ist gemountet und Maus ist ueber dem Canvas
   WHEN ein `wheel`-Event mit `ctrlKey: true` und `deltaY: 100` gefeuert wird
   THEN `preventDefault()` wird aufgerufen UND `zoomToPoint()` wird mit einer Zoom-Verringerung und Cursor-Position als Anchor aufgerufen

3) GIVEN canvas-area ist gemountet und zoomLevel > fitLevel (Bild ist gezoomt)
   WHEN ein `wheel`-Event OHNE Modifier (ctrlKey=false, shiftKey=false) mit `deltaY: 50` gefeuert wird
   THEN panY wird um `-50` veraendert (Scroll runter = Bild nach oben verschieben), `preventDefault()` wird NICHT aufgerufen fuer Ctrl

4) GIVEN canvas-area ist gemountet und zoomLevel > fitLevel
   WHEN ein `wheel`-Event mit `shiftKey: true` und `deltaY: 80` gefeuert wird
   THEN panX wird um `-80` veraendert (horizontaler Pan), panY bleibt unveraendert

5) GIVEN zoomLevel === fitLevel (Bild im Fit-Modus, nicht gezoomt)
   WHEN ein `wheel`-Event OHNE Modifier gefeuert wird
   THEN kein Pan-Update erfolgt (Scroll hat keinen Effekt bei Fit)

6) GIVEN der `wheel`-Listener auf canvas-area
   WHEN der Listener registriert wird
   THEN wird `addEventListener("wheel", handler, { passive: false })` verwendet (nicht React onWheel)

7) GIVEN ein Input-Element ist fokussiert (z.B. Chat-Textfeld) ODER Maus ist NICHT ueber canvas-area
   WHEN die Taste `+` oder `=` gedrueckt wird
   THEN passiert NICHTS (isInputFocused()-Guard + Canvas-Hover-Check blockieren)

8) GIVEN kein Input-Element fokussiert UND Maus ueber canvas-area
   WHEN die Taste `+` oder `=` gedrueckt wird
   THEN `zoomToStep("in")` wird aufgerufen (naechste Zoom-Stufe, Anchor=Container-Mitte)

9) GIVEN kein Input-Element fokussiert UND Maus ueber canvas-area
   WHEN die Taste `-` gedrueckt wird
   THEN `zoomToStep("out")` wird aufgerufen (vorherige Zoom-Stufe, Anchor=Container-Mitte)

10) GIVEN kein Input-Element fokussiert UND Maus ueber canvas-area
    WHEN die Taste `0` gedrueckt wird
    THEN `resetToFit()` wird aufgerufen (Zoom=Fit, Pan=0,0)

11) GIVEN canvas-area Container wird resized (z.B. Chat-Panel oeffnet/schliesst)
    WHEN ResizeObserver callback feuert
    THEN fitLevel wird neu berechnet UND aktueller zoomLevel bleibt erhalten (nur fitLevel-Referenz aktualisiert)

12) GIVEN die Komponente wird unmounted
    WHEN Cleanup laeuft
    THEN `wheel`-Listener wird von canvas-area entfernt UND `keydown`-Listener wird von `document` entfernt

---

## Test Skeletons

### Test-Datei: `__tests__/lib/hooks/use-canvas-zoom-events.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Wheel Handler', () => {
  // AC-1: Ctrl+Scroll up -> zoom in mit Cursor-Anchor
  it.todo('should call zoomToPoint with zoom increase on Ctrl+wheel deltaY negative')

  // AC-2: Ctrl+Scroll down -> zoom out mit Cursor-Anchor
  it.todo('should call zoomToPoint with zoom decrease on Ctrl+wheel deltaY positive')

  // AC-3: Scroll ohne Modifier -> vertikaler Pan
  it.todo('should update panY by negative deltaY on wheel without modifier when zoomed')

  // AC-4: Shift+Scroll -> horizontaler Pan
  it.todo('should update panX by negative deltaY on Shift+wheel when zoomed')

  // AC-5: Scroll bei Fit -> kein Effekt
  it.todo('should not pan when zoomLevel equals fitLevel on wheel without modifier')

  // AC-6: passive:false Registrierung
  it.todo('should register wheel listener with passive false via addEventListener')
})

describe('Keyboard Handler', () => {
  // AC-7: Input fokussiert -> kein Zoom
  it.todo('should not trigger zoom when input element is focused')

  // AC-8: + Taste -> zoomToStep in
  it.todo('should call zoomToStep in on plus key when canvas is hovered and no input focused')

  // AC-9: - Taste -> zoomToStep out
  it.todo('should call zoomToStep out on minus key when canvas is hovered and no input focused')

  // AC-10: 0 Taste -> resetToFit
  it.todo('should call resetToFit on 0 key when canvas is hovered and no input focused')
})

describe('Lifecycle', () => {
  // AC-11: Container-Resize -> fitLevel Neuberechnung
  it.todo('should recalculate fitLevel on container resize while preserving current zoomLevel')

  // AC-12: Cleanup bei Unmount
  it.todo('should remove wheel and keydown listeners on unmount')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-zoom-state` | `zoomLevel`, `panX`, `panY` | State-Felder | State aus `useCanvasDetail()` lesen |
| `slice-01-zoom-state` | `SET_ZOOM_PAN` | Action | `dispatch({ type: "SET_ZOOM_PAN", zoomLevel, panX, panY })` |
| `slice-02-zoom-hook-transform` | `useCanvasZoom` | Hook | `zoomToPoint(newZoom, cursorX, cursorY)`, `zoomToStep("in"/"out")`, `resetToFit()`, `fitLevel` |
| `slice-02-zoom-hook-transform` | Transform-Wrapper-Div | DOM-Element | `ref` auf canvas-area `<main>` fuer Event-Listener-Registrierung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `isCanvasHovered` | Ref/State | slice-05 (Space+Drag) | `isCanvasHovered: boolean` -- ob Maus ueber canvas-area |
| Wheel-Handler-Pattern | Pattern | slice-07 (Touch Events) | Muster fuer addEventListener mit passive:false auf canvas-area |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-canvas-zoom.ts` -- MODIFY: Wheel-Handler-Logik (Ctrl+Scroll Zoom, Scroll Pan, Shift+Scroll Pan), Keyboard-Handler-Logik (+/-/0 mit isInputFocused-Guard und Canvas-Hover-Check), Container-Resize fitLevel-Update
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: Event-Listener registrieren (wheel passive:false auf canvas-area, keydown auf document), isCanvasHovered-Tracking (mouseenter/mouseleave), Cleanup bei Unmount
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Space+Drag Pan (kommt in Slice 5)
- KEINE Touch-Events (Pinch, Pan, Double-Tap kommen in Slice 7/8)
- KEINE ZoomControls-UI-Aenderungen (Slice 3)
- KEINE MaskCanvas-Koordinaten-Korrektur (Slice 6)
- KEINE ref-basierte DOM-Manipulation waehrend Wheel (Wheel ist diskret, kein kontinuierlicher Gesture-Stream -- Reducer-Dispatch pro Event ist ausreichend)

**Technische Constraints:**
- Wheel-Listener MUSS via `addEventListener("wheel", handler, { passive: false })` registriert werden -- React `onWheel` kann `preventDefault()` nicht zuverlaessig aufrufen
- Keyboard-Listener auf `document` (nicht auf canvas-area), weil keydown kein fokussierbares Element braucht
- `isInputFocused()`-Guard wiederverwenden: Pruefung ob `document.activeElement` ein Input/Textarea/ContentEditable ist (bestehendes Pattern aus mask-canvas.tsx)
- Canvas-Hover-Check: `mouseenter`/`mouseleave` auf canvas-area tracken ob Maus ueber Canvas ist
- Stufenloser Zoom-Faktor: `newZoom = clamp(oldZoom * (1 - deltaY * 0.01), 0.5, 3.0)` (siehe architecture.md -> "Stufenloser Zoom")
- Container-Resize: fitLevel neu berechnen, zoomLevel NICHT aendern (es sei denn zoomLevel war === fitLevel, dann mitziehen)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/hooks/use-canvas-zoom.ts` | MODIFY: Event-Handler-Logik hinzufuegen (Wheel, Keyboard, Resize). Bestehende Funktionen (zoomToPoint, zoomToStep, resetToFit, fitLevel) werden aufgerufen |
| `components/canvas/canvas-detail-view.tsx` | MODIFY: addEventListener-Aufrufe in useEffect, mouseenter/mouseleave-Handler. Bestehende Struktur (Transform-Wrapper aus Slice 2) bleibt unberuehrt |
| `components/canvas/mask-canvas.tsx` | IMPORT: `isInputFocused()`-Pattern wiederverwenden (nicht die Datei aendern, sondern das Pattern extrahieren oder gleiche Logik implementieren) |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Event Handler Map" (Wheel + Keyboard Zeilen)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "Ctrl+Scroll darf nicht Browser-Zoom ausloesen"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "Keyboard-Shortcuts nur bei Canvas-Fokus"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Zoom-Berechnungen" -> "Stufenloser Zoom"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "Container-Resize bei Chat-Panel toggle"
