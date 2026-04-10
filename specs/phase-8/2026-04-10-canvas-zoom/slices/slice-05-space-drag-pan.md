# Slice 5: Space+Drag Pan

> **Slice 5 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-space-drag-pan` |
| **Test** | `pnpm test __tests__/lib/hooks/use-canvas-zoom-space-drag.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-wheel-keyboard"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/hooks/use-canvas-zoom-space-drag.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (PointerEvent, keydown/keyup Events, requestAnimationFrame mocken) |

---

## Ziel

Space+Drag Pan-Modus implementieren: Space-Taste halten aktiviert Pan-Modus (Cursor grab/grabbing), Pointer-Drag verschiebt das gezoomte Bild via Ref-basierter DOM-Manipulation fuer 60fps, und ein `isSpaceHeld`-Flag unterdrueckt Mask-Painting auf dem MaskCanvas waehrend Space gehalten wird.

---

## Acceptance Criteria

1) GIVEN Space-Taste ist NICHT gedrueckt
   WHEN die Taste `Space` auf `document` keydown feuert UND kein Input-Element fokussiert ist UND Maus ueber canvas-area
   THEN `isSpaceHeld`-Ref wird `true` UND Cursor auf canvas-area wechselt zu `grab`

2) GIVEN `isSpaceHeld === true` UND kein Pointer-Drag aktiv
   WHEN `keyup` fuer Space feuert
   THEN `isSpaceHeld`-Ref wird `false` UND Cursor auf canvas-area wechselt zurueck zu `default` (bzw. zum vorherigen Cursor-Stil des Edit-Modus)

3) GIVEN `isSpaceHeld === true`
   WHEN `pointerdown` auf canvas-area feuert
   THEN Cursor wechselt zu `grabbing`, Drag-Startposition wird gespeichert, `setPointerCapture()` wird aufgerufen

4) GIVEN `isSpaceHeld === true` UND Pointer-Drag laeuft (nach pointerdown)
   WHEN `pointermove` mit deltaX=+30, deltaY=-20 feuert
   THEN Transform-Wrapper `style.transform` wird direkt via Ref aktualisiert (KEIN React-Render): panX += 30, panY += -20

5) GIVEN Pointer-Drag laeuft mit `isSpaceHeld === true`
   WHEN `pointerup` feuert
   THEN `releasePointerCapture()` wird aufgerufen, finale panX/panY werden via `dispatch(SET_ZOOM_PAN)` in den Reducer synchronisiert, Cursor wechselt zurueck zu `grab`

6) GIVEN Pointer-Drag laeuft
   WHEN `keyup` fuer Space feuert WAEHREND des Drags
   THEN Drag wird beendet (wie pointerup), State wird synchronisiert, Cursor wechselt zu `default`

7) GIVEN `isSpaceHeld === true` UND editMode ist `inpaint` oder `erase`
   WHEN `pointerdown` auf MaskCanvas feuert
   THEN MaskCanvas `onPointerDown`-Handler wird NICHT ausgefuehrt (Painting unterdrueckt), stattdessen Pan-Drag beginnt

8) GIVEN `isSpaceHeld === false` UND editMode ist `inpaint`
   WHEN `pointerdown` auf MaskCanvas feuert
   THEN normales Mask-Painting beginnt (bestehende Funktionalitaet unveraendert)

9) GIVEN ein Input-Element (z.B. Chat-Textfeld) ist fokussiert
   WHEN Space-Taste gedrueckt wird
   THEN `isSpaceHeld` wird NICHT gesetzt (Guard verhindert Aktivierung)

10) GIVEN die Komponente wird unmounted
    WHEN Cleanup laeuft
    THEN `keydown`/`keyup`-Listener fuer Space werden entfernt, `isSpaceHeld` ist `false`

---

## Test Skeletons

### Test-Datei: `__tests__/lib/hooks/use-canvas-zoom-space-drag.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Space Key Handler', () => {
  // AC-1: Space keydown setzt isSpaceHeld und Cursor grab
  it.todo('should set isSpaceHeld to true and cursor to grab on Space keydown')

  // AC-2: Space keyup loescht isSpaceHeld und Cursor default
  it.todo('should set isSpaceHeld to false and restore cursor on Space keyup')

  // AC-9: Space keydown bei fokussiertem Input -> kein Effekt
  it.todo('should not set isSpaceHeld when input element is focused')
})

describe('Pointer Drag Handler', () => {
  // AC-3: pointerdown bei isSpaceHeld -> grabbing + pointerCapture
  it.todo('should set cursor to grabbing and call setPointerCapture on pointerdown when space held')

  // AC-4: pointermove bei Drag -> Ref-basiertes Transform-Update
  it.todo('should update transform wrapper style directly via ref on pointermove during drag')

  // AC-5: pointerup -> dispatch SET_ZOOM_PAN + releasePointerCapture
  it.todo('should dispatch SET_ZOOM_PAN and release pointer capture on pointerup')

  // AC-6: Space keyup waehrend Drag -> Drag beenden
  it.todo('should end drag and sync state when Space is released during active drag')
})

describe('MaskCanvas Suppression', () => {
  // AC-7: isSpaceHeld unterdrueckt MaskCanvas Painting
  it.todo('should suppress MaskCanvas onPointerDown when isSpaceHeld is true')

  // AC-8: Normales Painting wenn isSpaceHeld false
  it.todo('should allow normal MaskCanvas painting when isSpaceHeld is false')
})

describe('Lifecycle', () => {
  // AC-10: Cleanup bei Unmount
  it.todo('should remove Space keydown/keyup listeners and reset isSpaceHeld on unmount')
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
| `slice-02-zoom-hook-transform` | Transform-Wrapper-Div | DOM-Element (Ref) | `ref.current.style.transform` fuer direkte DOM-Mutation waehrend Drag |
| `slice-04-wheel-keyboard` | `isCanvasHovered` | Ref/State | Pruefung ob Maus ueber canvas-area (Space-Guard) |
| `slice-04-wheel-keyboard` | `isInputFocused()` | Pattern | Guard-Logik fuer Keyboard-Events |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `isSpaceHeld` | Ref (`{ current: boolean }`) | slice-06 (MaskCanvas), slice-07 (Touch -- Guard) | `isSpaceHeld.current: boolean` -- via Context oder Ref-Prop |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-canvas-zoom.ts` -- MODIFY: Space-keydown/keyup-Handler, isSpaceHeld-Ref, Pointer-Drag-Handler (pointerdown/move/up) mit Ref-basierter DOM-Manipulation, SET_ZOOM_PAN dispatch bei Drag-Ende
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: Cursor-Style-Binding (grab/grabbing/default basierend auf isSpaceHeld + Drag-State), PointerMove/Up-Handler auf canvas-area registrieren
- [ ] `components/canvas/mask-canvas.tsx` -- MODIFY: isSpaceHeld-Guard in onPointerDown — wenn true, return early (Painting unterdruecken)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Touch-Gesten (Pinch, Pan, Double-Tap kommen in Slice 7/8/9)
- KEINE Wheel/Keyboard-Aenderungen (bereits in Slice 4 implementiert)
- KEINE MaskCanvas-Koordinaten-Korrektur (kommt in Slice 6)
- KEINE ZoomControls-UI-Aenderungen (Slice 3)
- Space+Drag ist NUR fuer Desktop (Maus/Trackpad), nicht fuer Touch

**Technische Constraints:**
- **Ref-basierte DOM-Manipulation** waehrend Drag: `transformWrapperRef.current.style.transform` direkt setzen, KEIN React-Render pro pointermove (60fps-Anforderung, siehe architecture.md -> "Transform-Strategie")
- **Reducer-Dispatch nur bei Drag-Ende** (pointerup oder Space-keyup): finale panX/panY via `SET_ZOOM_PAN` synchronisieren
- **`setPointerCapture`/`releasePointerCapture`** auf pointerdown/pointerup fuer zuverlaessiges Drag-Tracking ausserhalb der canvas-area
- **`isInputFocused()`-Guard** wiederverwenden: Space-Handler darf nicht feuern wenn Input/Textarea/ContentEditable fokussiert ist (bestehendes Pattern aus Slice 4)
- **`isCanvasHovered`-Check** wiederverwenden: Space-Handler nur aktiv wenn Maus ueber canvas-area (aus Slice 4)
- Space-Taste `keydown` mit `event.repeat`-Guard: Wiederholte keydown-Events bei gehaltener Taste ignorieren

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/hooks/use-canvas-zoom.ts` | MODIFY: Space-Handler und Pointer-Drag-Logik hinzufuegen. Bestehende Funktionen (zoomToPoint, zoomToStep, resetToFit, Wheel/Keyboard-Handler aus Slice 2+4) bleiben unberuehrt |
| `components/canvas/canvas-detail-view.tsx` | MODIFY: Cursor-Style und Pointer-Event-Handler hinzufuegen. Bestehende Struktur (Transform-Wrapper, Event-Listener aus Slice 2+4) bleibt erhalten |
| `components/canvas/mask-canvas.tsx` | MODIFY: `isSpaceHeld`-Guard in onPointerDown einfuegen. Bestehende Painting-Logik bleibt vollstaendig erhalten |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Event Handler Map" (Space+Drag Zeile)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "Space-Taste Vorrang ueber Mask-Painting"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Transform-Strategie" (Ref-basierte DOM-Manipulation waehrend Geste)
- Wireframes: `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md` -> Section "Screen: Canvas Detail View -- Zoomed In State" -> State Variations (panning: grab/grabbing)
- Discovery: `specs/phase-8/2026-04-10-canvas-zoom/discovery.md` -> Section "Feature State Machine" -> panning State + Transitions
