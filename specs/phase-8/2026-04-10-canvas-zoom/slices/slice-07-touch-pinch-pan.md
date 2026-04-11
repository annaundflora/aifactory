# Slice 7: Touch Pinch-Zoom + Zwei-Finger-Pan

> **Slice 7 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-touch-pinch-pan` |
| **Test** | `pnpm test __tests__/lib/hooks/use-touch-gestures.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-zoom-hook-transform"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/hooks/use-touch-gestures.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (TouchEvent simulieren, dispatch mocken) |

---

## Ziel

Touch-Gesture-Recognizer implementieren, der Pinch-to-Zoom (2-Finger-Abstandsaenderung), Zwei-Finger-Pan (Mittelpunkt-Verschiebung) und Ein-Finger-Pan (bei Zoom > Fit, ohne Mask-Modus) erkennt. Waehrend der Geste werden Transform-Updates ref-basiert direkt auf dem DOM ausgefuehrt (60fps). Erst bei Gesture-Ende wird der finale State per Dispatch synchronisiert.

---

## Acceptance Criteria

1) GIVEN ein Touch-Geraet und zwei Finger auf dem Canvas-Container
   WHEN der Abstand zwischen den Fingern sich von 200px auf 400px aendert (Faktor 2.0)
   THEN `zoomLevel` verdoppelt sich relativ zum Start-Zoom (z.B. 1.0 -> 2.0), Ankerpunkt ist der Mittelpunkt zwischen den zwei Fingern

2) GIVEN ein Touch-Geraet und zwei Finger auf dem Canvas-Container
   WHEN der Abstand zwischen den Fingern sich von 400px auf 200px aendert (Faktor 0.5)
   THEN `zoomLevel` halbiert sich relativ zum Start-Zoom, geclampt auf Minimum 0.5

3) GIVEN ein Touch-Geraet und zwei Finger auf dem Canvas-Container
   WHEN beide Finger 100px nach rechts und 50px nach unten bewegt werden (Mittelpunkt-Delta)
   THEN `panX` verschiebt sich um +100, `panY` um +50

4) GIVEN Pinch+Pan gleichzeitig (Abstand aendert sich UND Mittelpunkt verschiebt sich)
   WHEN die Geste laeuft
   THEN Zoom und Pan werden simultan angewendet (nicht sequenziell)

5) GIVEN waehrend einer laufenden Pinch/Pan-Geste
   WHEN touchmove Events eintreffen
   THEN wird das Transform-Wrapper-Div direkt via `ref.current.style.transform` aktualisiert (kein React-Render, kein dispatch)

6) GIVEN eine Pinch/Pan-Geste laeuft
   WHEN alle Finger losgelassen werden (touchend)
   THEN wird `SET_ZOOM_PAN` mit den finalen Werten dispatched, zoomLevel geclampt auf 0.5..3.0

7) GIVEN `zoomLevel > fitLevel` und `editMode` ist `null`, `"instruction"` oder `"outpaint"`
   WHEN ein einzelner Finger auf dem Canvas-Container dragged wird
   THEN wird das Bild gepannt (Pan-Offset folgt der Finger-Bewegung)

8) GIVEN `zoomLevel === fitLevel` und `editMode` ist `null`
   WHEN ein einzelner Finger horizontal swiped
   THEN wird die bestehende Swipe-Navigation (prev/next) ausgefuehrt, NICHT Ein-Finger-Pan

9) GIVEN `editMode` ist `"inpaint"` oder `"erase"` und Zoom beliebig
   WHEN ein einzelner Finger auf dem Canvas dragged wird
   THEN wird KEIN Ein-Finger-Pan ausgefuehrt (Finger zeichnet Mask-Stroke)

10) GIVEN der Canvas-Container (canvas-area `<main>`)
    WHEN die Komponente gemountet ist
    THEN hat der Container `touch-action: none` als CSS-Eigenschaft, um Browser-eigenes Pinch/Pan zu unterdruecken

---

## Test Skeletons

### Test-Datei: `__tests__/lib/hooks/use-touch-gestures.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useTouchGestures - Pinch-to-Zoom', () => {
  // AC-1: Pinch-out verdoppelt Zoom
  it.todo('should double zoomLevel when finger distance doubles during pinch')

  // AC-2: Pinch-in halbiert Zoom, geclampt auf 0.5
  it.todo('should halve zoomLevel when finger distance halves, clamped to 0.5')

  // AC-6: Dispatch bei Gesture-Ende
  it.todo('should dispatch SET_ZOOM_PAN with clamped values on touchend')
})

describe('useTouchGestures - Zwei-Finger-Pan', () => {
  // AC-3: Mittelpunkt-Verschiebung als Pan-Offset
  it.todo('should update panX/panY by midpoint delta of two fingers')

  // AC-4: Simultaner Pinch+Pan
  it.todo('should apply zoom and pan simultaneously during combined gesture')
})

describe('useTouchGestures - Ref-basierte Updates', () => {
  // AC-5: Direkte DOM-Manipulation waehrend Geste
  it.todo('should update transform wrapper style.transform directly during touchmove without dispatch')
})

describe('useTouchGestures - Ein-Finger-Pan', () => {
  // AC-7: Ein-Finger-Pan bei Zoom > Fit, nicht-Mask-Modus
  it.todo('should pan on single-finger drag when zoomed and editMode is null/instruction/outpaint')

  // AC-8: Swipe-Navigation bei Fit-Level
  it.todo('should not intercept single-finger swipe when at fitLevel')

  // AC-9: Kein Ein-Finger-Pan bei inpaint/erase
  it.todo('should not pan on single-finger drag when editMode is inpaint or erase')
})

describe('canvas-detail-view - Touch Setup', () => {
  // AC-10: touch-action: none auf Canvas-Container
  it.todo('should set touch-action none on canvas-area main element')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-zoom-state` | `zoomLevel`, `panX`, `panY` | State-Felder | `useCanvasDetail()` lesen |
| `slice-01-zoom-state` | `SET_ZOOM_PAN` | Action | `dispatch({ type: "SET_ZOOM_PAN", ... })` bei Gesture-Ende |
| `slice-02-zoom-hook-transform` | Transform-Wrapper-Div `ref` | DOM-Element | Ref fuer direkte `style.transform` Mutation waehrend Geste |
| `slice-02-zoom-hook-transform` | `useCanvasZoom` | Hook | `fitLevel` lesen fuer Ein-Finger-Pan vs Swipe-Entscheidung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `useTouchGestures` | Hook | canvas-detail-view.tsx | `useTouchGestures(containerRef, transformRef, options) => void` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-touch-gestures.ts` -- Gesture-Recognizer Hook: Pinch-to-Zoom, Zwei-Finger-Pan, Ein-Finger-Pan, State-Machine (idle/pinch/pan), ref-basierte DOM-Updates, dispatch bei Gesture-Ende
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: useTouchGestures Hook einbinden, touch-action:none auf Canvas-Container setzen, bestehende Swipe-Handler mit Zoom-Guard erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Double-Tap-Toggle (kommt in einem separaten Slice)
- KEIN Procreate-Style Stroke-Undo bei Gestenstart waehrend Masking (separater Slice)
- KEINE Desktop-Event-Handler (Wheel, Keyboard, Space+Drag -- separate Slices)
- KEINE ZoomControls-UI (separater Slice)
- KEINE Mask-Canvas-Koordinaten-Korrektur (separater Slice)

**Technische Constraints:**
- Zoom-Clamp: `0.5 <= zoomLevel <= 3.0`
- Pinch-Ratio: `newZoom = startZoom * (currentDistance / initialDistance)`, geclampt
- Pan waehrend Geste: Ref-basierte DOM-Mutation auf `transformRef.current.style.transform` (kein React-Render)
- Dispatch nur bei touchend/touchcancel -- NICHT bei touchmove
- `touch-action: none` auf `<main>` (canvas-area), nicht auf einzelnen Kind-Elementen
- TouchEvent-Listener muessen via `addEventListener` mit `{ passive: false }` registriert werden, damit `preventDefault()` den Browser-Zoom zuverlaessig blockt
- Ein-Finger-Pan Guard: `zoomLevel > fitLevel && editMode !== "inpaint" && editMode !== "erase"`
- Bestehende Swipe-Navigation (`handleTouchStart`/`handleTouchEnd` in canvas-detail-view.tsx) muss durch Zoom-Guard erweitert werden: Swipe nur bei `zoomLevel === fitLevel`

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY: Hook einbinden, touch-action:none setzen, Swipe-Guard erweitern. Bestehende Touch-Handler (Zeilen ~207-230) bleiben erhalten, werden aber um Zoom-Guard ergaenzt |
| `lib/canvas-detail-context.tsx` | Import: `useCanvasDetail()` fuer State + Dispatch (aus Slice 1) |
| `lib/hooks/use-canvas-zoom.ts` | Import: `fitLevel` lesen (aus Slice 2) |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Gesture Recognition (Touch)"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Transform-Strategie" (ref-basierte Updates)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Event Handler Map" (Touch-Rows)
- Wireframes: `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md` -> Section "Screen: Canvas Detail View -- Touch Interaction"
- Discovery: `specs/phase-8/2026-04-10-canvas-zoom/discovery.md` -> Flow 4 (Touch Pinch-Zoom), Flow 5 (Touch Pan)
