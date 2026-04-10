# Slice 2: Zoom Hook + Transform Wrapper

> **Slice 2 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-zoom-hook-transform` |
| **Test** | `pnpm test __tests__/lib/hooks/use-canvas-zoom.test.ts __tests__/components/canvas/canvas-detail-view.test.tsx __tests__/components/canvas/canvas-image.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-zoom-state"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/hooks/use-canvas-zoom.test.ts __tests__/components/canvas/canvas-detail-view.test.tsx __tests__/components/canvas/canvas-image.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (ResizeObserver mocken) |

---

## Ziel

Custom Hook `useCanvasZoom` bereitstellen, der Fit-Level dynamisch berechnet (ResizeObserver), Anchor-Point-Zoom-Mathematik kapselt und Zoom-Stufen-Navigation ermoeglicht. Transform-Wrapper-Div in `canvas-detail-view.tsx` einfuegen, damit Bild+Mask+Outpaint via CSS `transform` skaliert/verschoben werden. `CanvasImage` Sizing-Klassen fuer Transform-Kompatibilitaet anpassen.

---

## Acceptance Criteria

1) GIVEN ein Container von 800x600px und ein Bild mit naturalWidth=1600, naturalHeight=1200
   WHEN `useCanvasZoom` initialisiert wird
   THEN `fitLevel === 0.5` (min(800/1600, 600/1200))

2) GIVEN ein Container von 800x600px und ein Bild mit naturalWidth=400, naturalHeight=300
   WHEN `useCanvasZoom` initialisiert wird
   THEN `fitLevel === 1.5` (min(800/400, 600/300)), aber geclampt auf max 1.0 (Fit darf nicht ueber 100% liegen, Bild wird nicht vergroessert)

3) GIVEN der Container wird von 800x600 auf 400x300 resized (z.B. Chat-Panel oeffnet)
   WHEN ResizeObserver feuert
   THEN `fitLevel` wird neu berechnet; wenn aktueller zoomLevel === alter fitLevel, wird zoomLevel auf neuen fitLevel angepasst

4) GIVEN zoomLevel=1.0, panX=0, panY=0 und Cursor bei containerX=200, containerY=150
   WHEN `zoomToPoint(2.0, 200, 150)` aufgerufen wird
   THEN neuer panX === -200, panY === -150 (Anchor-Point-Formel: newPan = cursor - imageCoord * newZoom)

5) GIVEN zoomLevel=1.0
   WHEN `zoomToStep("in")` aufgerufen wird
   THEN zoomLevel wird auf 1.5 gesetzt (naechste Stufe aus `[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]`), Anchor=Container-Mitte

6) GIVEN zoomLevel=3.0
   WHEN `zoomToStep("in")` aufgerufen wird
   THEN zoomLevel bleibt 3.0 (bereits am Maximum, keine hoehere Stufe)

7) GIVEN zoomLevel=0.5
   WHEN `zoomToStep("out")` aufgerufen wird
   THEN zoomLevel bleibt 0.5 (bereits am Minimum, keine niedrigere Stufe)

8) GIVEN beliebiger Zoom-State
   WHEN `resetToFit()` aufgerufen wird
   THEN zoomLevel === fitLevel, panX === 0, panY === 0

9) GIVEN `canvas-detail-view.tsx` rendert ein Bild
   WHEN die Komponente gemountet ist
   THEN existiert ein Wrapper-Div um CanvasImage+MaskCanvas+OutpaintControls mit `style` containing `transform: translate(${panX}px, ${panY}px) scale(${zoomLevel})`, `transformOrigin: "0 0"` und `willChange: "transform"`

10) GIVEN `canvas-image.tsx` im Transform-Wrapper
    WHEN das Bild geladen ist
    THEN das `<img>`-Element hat KEINE `max-h-full max-w-full object-contain` Klassen mehr, sondern nutzt natuerliche Dimensionen (width/height aus naturalWidth/naturalHeight) damit der Transform-Wrapper die Skalierung uebernimmt

11) GIVEN `canvas-image.tsx`
    WHEN von einem Parent eine `ref` uebergeben wird
    THEN wird diese ref an das `<img>`-Element weitergeleitet (forwardRef), damit `useCanvasZoom` auf `naturalWidth`/`naturalHeight` zugreifen kann

---

## Test Skeletons

### Test-Datei: `__tests__/lib/hooks/use-canvas-zoom.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useCanvasZoom', () => {
  // AC-1: fitLevel Berechnung (Bild groesser als Container)
  it.todo('should calculate fitLevel as min(containerW/imageW, containerH/imageH)')

  // AC-2: fitLevel clamped bei kleinem Bild
  it.todo('should clamp fitLevel to 1.0 when image is smaller than container')

  // AC-3: fitLevel Neuberechnung bei Container-Resize
  it.todo('should recalculate fitLevel when ResizeObserver fires')

  // AC-4: Anchor-Point Zoom Mathematik
  it.todo('should compute correct panX/panY for zoomToPoint with anchor at cursor position')

  // AC-5: zoomToStep("in") naechste Stufe
  it.todo('should step to next zoom level from predefined steps on zoomToStep("in")')

  // AC-6: zoomToStep("in") bei Maximum
  it.todo('should not exceed max zoom level on zoomToStep("in") when already at 3.0')

  // AC-7: zoomToStep("out") bei Minimum
  it.todo('should not go below min zoom level on zoomToStep("out") when already at 0.5')

  // AC-8: resetToFit
  it.todo('should set zoomLevel to fitLevel and panX/panY to 0 on resetToFit')
})

describe('canvas-detail-view Transform Wrapper', () => {
  // AC-9: Transform-Wrapper-Div mit korrektem Style
  it.todo('should render transform wrapper div with translate/scale style, transformOrigin 0 0, and willChange transform')
})

describe('CanvasImage Transform Compatibility', () => {
  // AC-10: CanvasImage ohne Sizing-Klassen
  it.todo('should render CanvasImage img without max-h-full max-w-full object-contain classes')

  // AC-11: CanvasImage forwardRef
  it.todo('should forward ref to the img element in CanvasImage')
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
| `slice-01-zoom-state` | `RESET_ZOOM_PAN` | Action | `dispatch({ type: "RESET_ZOOM_PAN" })` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `useCanvasZoom` | Hook | slice-03 (ZoomControls), slice-04 (Wheel/Keyboard), slice-05 (Touch) | `useCanvasZoom(containerRef, imageRef) => { fitLevel, zoomToPoint, zoomToStep, resetToFit }` |
| Transform-Wrapper-Div | DOM-Element | slice-04 (Event Handler), slice-05 (Gesture Handler) | `ref` auf Wrapper-Div in canvas-detail-view.tsx |
| CanvasImage `ref` | forwardRef | slice-02 (dieser Slice), slice-04 | `React.forwardRef` auf `<img>` Element |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-canvas-zoom.ts` -- Custom Hook: fitLevel-Berechnung (ResizeObserver), zoomToPoint (Anchor-Math), zoomToStep (Stufen-Navigation), resetToFit, clamp-Logik
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: Transform-Wrapper-Div um CanvasImage+MaskCanvas+OutpaintControls einfuegen, useCanvasZoom integrieren
- [ ] `components/canvas/canvas-image.tsx` -- MODIFY: Sizing-Klassen entfernen (object-contain -> natuerliche Dimensionen), forwardRef hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Event-Handler (Wheel, Keyboard, Space+Drag kommen in Slice 4)
- KEINE Touch-Gesten (Pinch, Pan, Double-Tap kommen in Slice 5)
- KEINE ZoomControls-UI (kommt in Slice 3)
- KEINE Mask-Canvas-Koordinaten-Korrektur (kommt in Slice 6)
- KEINE ref-basierte DOM-Manipulation waehrend Gesten (kommt in Slice 4/5)
- Der Hook dispatched nur via den Reducer aus Slice 1 -- keine direkte DOM-Style-Mutation

**Technische Constraints:**
- Zoom-Stufen: `[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]` (siehe architecture.md -> "Zoom-Stufen")
- Clamp-Grenzen: `0.5 <= zoomLevel <= 3.0`
- Fit-Level darf `1.0` nicht ueberschreiten (Bild wird bei Fit nicht hochskaliert)
- Transform-Syntax: `transform: translate(${panX}px, ${panY}px) scale(${zoomLevel})` mit `transform-origin: 0 0`
- `will-change: transform` auf dem Wrapper-Div fuer GPU-Compositing
- ResizeObserver auf den Container (canvas-image-area), nicht auf das Bild selbst

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY: Transform-Wrapper-Div einfuegen, Hook einbinden. Bestehende Struktur (CanvasImage, MaskCanvas, OutpaintControls Rendering) bleibt erhalten |
| `components/canvas/canvas-image.tsx` | MODIFY: Sizing-Klassen anpassen, forwardRef hinzufuegen. Loading/Error-States bleiben unberuehrt |
| `lib/canvas-detail-context.tsx` | Import (aus Slice 1): `useCanvasDetail()` fuer State-Lesen und Dispatch |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Zoom-Berechnungen" (Fit-Level, Anchor-Point, Zoom-Stufen)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Component Hierarchy" (Wrapper-Div Position)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Transform-Strategie"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Migration Map" (canvas-image.tsx Aenderungen)
