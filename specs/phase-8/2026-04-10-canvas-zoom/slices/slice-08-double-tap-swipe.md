# Slice 8: Double-Tap + Swipe Guard

> **Slice 8 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-double-tap-swipe` |
| **Test** | `pnpm test __tests__/lib/hooks/use-touch-gestures-double-tap.test.ts __tests__/components/canvas/canvas-detail-view-swipe-guard.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-touch-pinch-pan"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/hooks/use-touch-gestures-double-tap.test.ts __tests__/components/canvas/canvas-detail-view-swipe-guard.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (TouchEvent simulieren, dispatch + useCanvasZoom mocken) |

---

## Ziel

Double-Tap-Detection in den bestehenden Touch-Gesture-Hook einbauen: Zwei Taps innerhalb 300ms toggeln zwischen Fit-Level und 100%. Die Geste wird bei `editMode === "inpaint"` oder `editMode === "erase"` ignoriert, um versehentliche Mask-Punkte zu verhindern. Zusaetzlich die bestehende Swipe-Navigation in `canvas-detail-view.tsx` mit einem Zoom-Guard absichern, sodass Swipes nur bei `zoomLevel === fitLevel` ausgeloest werden.

---

## Acceptance Criteria

1) GIVEN `zoomLevel === fitLevel` (Fit-Ansicht) und `editMode` ist `null`
   WHEN der User zwei Mal innerhalb von 300ms auf den Canvas tippt (Double-Tap)
   THEN wird `zoomLevel` auf `1.0` (100%) gesetzt mit Ankerpunkt an der Tap-Position

2) GIVEN `zoomLevel === 1.0` (100%) und `editMode` ist `null`
   WHEN der User einen Double-Tap ausfuehrt
   THEN wird `zoomLevel` auf `fitLevel` gesetzt und `panX === 0`, `panY === 0`

3) GIVEN `zoomLevel === 2.5` (beliebiger Zoom ungleich Fit und ungleich 1.0)
   WHEN der User einen Double-Tap ausfuehrt und `editMode` ist `null`
   THEN wird `zoomLevel` auf `fitLevel` gesetzt und `panX === 0`, `panY === 0`

4) GIVEN `editMode === "inpaint"`
   WHEN der User einen Double-Tap ausfuehrt
   THEN passiert nichts (kein Zoom-Toggle, kein Mask-Punkt)

5) GIVEN `editMode === "erase"`
   WHEN der User einen Double-Tap ausfuehrt
   THEN passiert nichts (kein Zoom-Toggle, kein Mask-Punkt)

6) GIVEN `editMode === "instruction"` oder `editMode === "outpaint"`
   WHEN der User einen Double-Tap ausfuehrt
   THEN wird der Zoom-Toggle normal ausgefuehrt (nicht blockiert)

7) GIVEN ein einzelner Tap (kein zweiter Tap innerhalb 300ms)
   WHEN 300ms vergehen
   THEN wird KEIN Zoom-Toggle ausgefuehrt

8) GIVEN `zoomLevel === fitLevel` (Fit-Ansicht) und `state.maskData === null`
   WHEN der User horizontal swiped (deltaX > 50px)
   THEN wird die Swipe-Navigation (prev/next Image) ausgefuehrt

9) GIVEN `zoomLevel > fitLevel` (gezoomtes Bild) und `state.maskData === null`
   WHEN der User horizontal swiped (deltaX > 50px)
   THEN wird die Swipe-Navigation NICHT ausgefuehrt

10) GIVEN `zoomLevel === fitLevel` und `state.maskData !== null`
    WHEN der User horizontal swiped
    THEN wird die Swipe-Navigation NICHT ausgefuehrt (bestehender maskData-Guard bleibt erhalten)

---

## Test Skeletons

### Test-Datei: `__tests__/lib/hooks/use-touch-gestures-double-tap.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useTouchGestures - Double-Tap Detection', () => {
  // AC-1: Double-Tap bei Fit -> Zoom 100%
  it.todo('should zoom to 1.0 with anchor at tap position on double-tap when at fitLevel')

  // AC-2: Double-Tap bei 100% -> Fit
  it.todo('should zoom to fitLevel with panX=0 panY=0 on double-tap when at 1.0')

  // AC-3: Double-Tap bei beliebigem Zoom -> Fit
  it.todo('should zoom to fitLevel with panX=0 panY=0 on double-tap when at arbitrary zoom')

  // AC-4: Double-Tap blockiert bei inpaint
  it.todo('should not toggle zoom on double-tap when editMode is inpaint')

  // AC-5: Double-Tap blockiert bei erase
  it.todo('should not toggle zoom on double-tap when editMode is erase')

  // AC-6: Double-Tap erlaubt bei instruction/outpaint
  it.todo('should toggle zoom on double-tap when editMode is instruction or outpaint')

  // AC-7: Einzelner Tap loest keinen Toggle aus
  it.todo('should not toggle zoom on single tap after 300ms timeout')
})
```
</test_spec>

### Test-Datei: `__tests__/components/canvas/canvas-detail-view-swipe-guard.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('canvas-detail-view - Swipe Guard', () => {
  // AC-8: Swipe bei Fit -> Navigation
  it.todo('should allow swipe navigation when zoomLevel equals fitLevel and no maskData')

  // AC-9: Swipe bei Zoom > Fit -> blockiert
  it.todo('should block swipe navigation when zoomLevel is greater than fitLevel')

  // AC-10: Swipe bei Fit + maskData -> blockiert (bestehender Guard)
  it.todo('should block swipe navigation when maskData exists even at fitLevel')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-zoom-state` | `zoomLevel`, `panX`, `panY` | State-Felder | `useCanvasDetail()` lesen |
| `slice-01-zoom-state` | `SET_ZOOM_PAN` | Action | `dispatch({ type: "SET_ZOOM_PAN", ... })` |
| `slice-02-zoom-hook-transform` | `useCanvasZoom` | Hook | `fitLevel`, `zoomToPoint`, `resetToFit` lesen/aufrufen |
| `slice-07-touch-pinch-pan` | `useTouchGestures` | Hook | Bestehende Gesture-Erkennung erweitern (Double-Tap-Timer integrieren) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Double-Tap-Toggle | Gesture-Feature | -- (kein Downstream-Consumer) | Integriert in `useTouchGestures` |
| Swipe-Guard | Guard-Logik | -- (kein Downstream-Consumer) | `zoomLevel === fitLevel` Check in `handleTouchEnd` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-touch-gestures.ts` -- MODIFY: Double-Tap-Detection (Timer-basiert, 300ms Window), editMode-Guard (inpaint/erase blockiert), Zoom-Toggle-Logik (Fit<->100%)
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: Swipe-Guard in `handleTouchEnd` erweitern: zusaetzlich `zoomLevel === fitLevel` pruefen neben bestehendem `maskData`-Guard
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Procreate-Style Stroke-Undo (kommt in Slice 9)
- KEINE Aenderung an Pinch/Pan-Logik (bereits in Slice 7 implementiert)
- KEINE Desktop-Event-Handler (Wheel, Keyboard, Space -- separate Slices)
- KEINE Mask-Canvas-Koordinaten-Korrektur

**Technische Constraints:**
- Double-Tap-Window: 300ms (siehe architecture.md -> "Double-Tap Detection")
- Double-Tap-Erkennung: `touchend` mit `touches.length === 0` und `changedTouches.length === 1`; Zeitstempel des vorherigen Taps vergleichen
- editMode-Guard: `editMode !== "inpaint" && editMode !== "erase"` (instruction und outpaint erlauben Double-Tap)
- Toggle-Logik: Wenn aktueller `zoomLevel` ungefaehr gleich `fitLevel` -> Zoom auf 1.0 mit Anchor an Tap-Position. Sonst -> `resetToFit()` (zoomLevel=fitLevel, panX=0, panY=0)
- Swipe-Guard in `handleTouchEnd`: `zoomLevel === fitLevel` Pruefung VOR dem bestehenden `maskData`-Guard (Early-Return)
- Bestehender `maskData`-Guard (canvas-detail-view.tsx Zeile ~215) darf NICHT entfernt werden

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/hooks/use-touch-gestures.ts` | MODIFY: Double-Tap-Timer und editMode-Guard in bestehenden Hook integrieren (aus Slice 7) |
| `components/canvas/canvas-detail-view.tsx` | MODIFY: `handleTouchEnd` Swipe-Guard erweitern. Bestehende Swipe-Logik (Zeilen ~207-234) bleibt erhalten, Guard wird ergaenzt |
| `lib/hooks/use-canvas-zoom.ts` | Import: `fitLevel`, `zoomToPoint`, `resetToFit` (aus Slice 2) |
| `lib/canvas-detail-context.tsx` | Import: `useCanvasDetail()` fuer `editMode`, `zoomLevel`, `maskData` (aus Slice 1) |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Gesture Recognition (Touch)" -> "Double-Tap Detection"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Event Handler Map" (Double-Tap Row)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "Swipe-Navigation nur bei Fit"
- Wireframes: `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md` -> Section "Screen: Canvas Detail View -- Touch Interaction" -> State Variations
- Discovery: `specs/phase-8/2026-04-10-canvas-zoom/discovery.md` -> Flow 6 (Double-Tap), Business Rules (Swipe-Navigation)
