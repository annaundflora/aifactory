# Slice 3: ZoomControls UI Component

> **Slice 3 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-zoom-controls` |
| **Test** | `pnpm test __tests__/components/canvas/zoom-controls.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-zoom-hook-transform"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/components/canvas/zoom-controls.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (useCanvasZoom + useCanvasDetail mocken) |

---

## Ziel

Neue `ZoomControls`-Komponente als Floating-Panel (bottom-right) erstellen, die Fit-Button, Zoom-In, Prozent-Anzeige und Zoom-Out als vertikalen Stack rendert. Buttons rufen `useCanvasZoom`-Funktionen auf und zeigen korrekte Disabled/Active-States basierend auf dem aktuellen Zoom-Level.

---

## Acceptance Criteria

1) GIVEN ZoomControls gemountet mit zoomLevel=1.0 und fitLevel=0.5
   WHEN die Komponente rendert
   THEN sind 3 Buttons sichtbar (Fit, Zoom-In, Zoom-Out) und ein Text-Element zeigt "100%"

2) GIVEN zoomLevel=3.0 (Maximum)
   WHEN die Komponente rendert
   THEN ist der Zoom-In-Button `disabled` und der Zoom-Out-Button NICHT disabled

3) GIVEN zoomLevel=0.5 (Minimum)
   WHEN die Komponente rendert
   THEN ist der Zoom-Out-Button `disabled` und der Zoom-In-Button NICHT disabled

4) GIVEN zoomLevel === fitLevel (z.B. beide 0.5)
   WHEN die Komponente rendert
   THEN hat der Fit-Button einen visuellen Active/Highlight-State (z.B. `bg-accent` oder vergleichbar)

5) GIVEN zoomLevel !== fitLevel (z.B. zoomLevel=1.5, fitLevel=0.5)
   WHEN die Komponente rendert
   THEN hat der Fit-Button KEINEN Active-State (default Styling)

6) GIVEN ZoomControls gemountet
   WHEN User auf den Zoom-In-Button klickt
   THEN wird `zoomToStep("in")` aus useCanvasZoom aufgerufen (genau einmal)

7) GIVEN ZoomControls gemountet
   WHEN User auf den Zoom-Out-Button klickt
   THEN wird `zoomToStep("out")` aus useCanvasZoom aufgerufen (genau einmal)

8) GIVEN ZoomControls gemountet
   WHEN User auf den Fit-Button klickt
   THEN wird `resetToFit()` aus useCanvasZoom aufgerufen (genau einmal)

9) GIVEN zoomLevel=1.5
   WHEN die Komponente rendert
   THEN zeigt das Prozent-Element "150%" an (gerundeter Integer mit %-Suffix)

10) GIVEN zoomLevel=0.75
    WHEN die Komponente rendert
    THEN zeigt das Prozent-Element "75%" an

11) GIVEN ZoomControls gemountet
    WHEN die Komponente rendert
    THEN hat der aeussere Container die Positionierung `absolute bottom-4 right-4 z-20` und das Styling-Pattern aus FloatingBrushToolbar (`bg-card`, `border`, `shadow-md`, `rounded-lg`)

---

## Test Skeletons

### Test-Datei: `__tests__/components/canvas/zoom-controls.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ZoomControls', () => {
  // AC-1: Rendert 3 Buttons und Prozent-Anzeige
  it.todo('should render Fit, Zoom-In, Zoom-Out buttons and a percent display')

  // AC-2: Zoom-In disabled bei Maximum
  it.todo('should disable Zoom-In button when zoomLevel is 3.0')

  // AC-3: Zoom-Out disabled bei Minimum
  it.todo('should disable Zoom-Out button when zoomLevel is 0.5')

  // AC-4: Fit-Button active wenn zoomLevel === fitLevel
  it.todo('should show active state on Fit button when zoomLevel equals fitLevel')

  // AC-5: Fit-Button default wenn zoomLevel !== fitLevel
  it.todo('should show default state on Fit button when zoomLevel differs from fitLevel')

  // AC-6: Klick auf Zoom-In ruft zoomToStep("in")
  it.todo('should call zoomToStep("in") when Zoom-In button is clicked')

  // AC-7: Klick auf Zoom-Out ruft zoomToStep("out")
  it.todo('should call zoomToStep("out") when Zoom-Out button is clicked')

  // AC-8: Klick auf Fit ruft resetToFit()
  it.todo('should call resetToFit() when Fit button is clicked')

  // AC-9: Prozent-Anzeige bei 150%
  it.todo('should display "150%" when zoomLevel is 1.5')

  // AC-10: Prozent-Anzeige bei 75%
  it.todo('should display "75%" when zoomLevel is 0.75')

  // AC-11: Korrekte Positionierung und Styling-Klassen
  it.todo('should have absolute bottom-4 right-4 z-20 positioning with bg-card border shadow-md rounded-lg')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-zoom-state` | `zoomLevel` | State-Feld | Via `useCanvasDetail()` lesen |
| `slice-02-zoom-hook-transform` | `useCanvasZoom` | Hook | `{ fitLevel, zoomToStep, resetToFit }` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ZoomControls` | React Component | slice-04 (kein Modify noetig, bereits gemountet) | `<ZoomControls />` (keine Props, liest Context intern) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/zoom-controls.tsx` -- Neue ZoomControls-Komponente: Floating-Panel mit Fit/+/Prozent/- Buttons
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: `<ZoomControls />` importieren und im JSX mounten (ausserhalb Transform-Wrapper, innerhalb canvas-area)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Event-Handler (Wheel, Keyboard, Space+Drag kommen in Slice 4)
- KEINE Touch-Gesten (kommen in Slice 5)
- KEINE Mask-Canvas-Koordinaten-Korrektur (kommt in Slice 6)
- KEINE Logik fuer Anchor-Point-Zoom oder Fit-Berechnung (liegt in useCanvasZoom aus Slice 2)
- KEINE Aenderung am Reducer oder State-Interface (Slice 1)
- Die Komponente liest State via Hook und dispatched via Hook-Funktionen -- keine eigene Zoom-Mathematik

**Technische Constraints:**
- Zoom-Range fuer Disabled-Logik: `MIN_ZOOM = 0.5`, `MAX_ZOOM = 3.0`
- Prozent-Anzeige: `Math.round(zoomLevel * 100) + "%"`
- Fit-Active-Vergleich: Toleranz-Vergleich empfohlen (z.B. `Math.abs(zoomLevel - fitLevel) < 0.01`) wegen Float-Praezision
- Icons: Lucide `Maximize2` (Fit), `Plus` (Zoom-In), `Minus` (Zoom-Out) -- oder `ZoomIn`/`ZoomOut` nach Implementer-Wahl
- Button-Variante: `size="icon"` oder `size="icon-sm"` (wie FloatingBrushToolbar)
- Z-Index 20 (unter FloatingBrushToolbar z-30)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY: ZoomControls mounten. Slice 2 hat bereits Transform-Wrapper eingefuegt -- ZoomControls wird AUSSERHALB des Transform-Wrappers platziert |
| `components/ui/button.tsx` | Import: Button-Komponente fuer die 3 Buttons |
| `components/canvas/floating-brush-toolbar.tsx` | REFERENZ ONLY (nicht modifizieren): Styling-Pattern (bg-card, border, shadow-md, rounded-lg) uebernehmen |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Component Hierarchy" (ZoomControls Positionierung)
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Event Handler Map" (Button-Clicks)
- Wireframes: `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md` -> Section "Zoom Controls Detail" (Reihenfolge: Fit, +, Prozent, -)
- Wireframes: `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md` -> Section "State Variations" (disabled/active States)
