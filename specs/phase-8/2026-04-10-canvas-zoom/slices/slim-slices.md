# Slice Decomposition

**Feature:** Canvas Zoom & Pan
**Discovery-Slices:** 2 (Desktop Zoom & Pan, Touch Gesten)
**Atomare Slices:** 9
**Stack:** typescript-nextjs (vitest + playwright)

---

## Dependency Graph

```
slice-01 (Zoom State)
    |
    +---> slice-02 (Zoom Hook + Transform Wrapper)
    |         |
    |         +---> slice-03 (ZoomControls UI)
    |         |
    |         +---> slice-04 (Wheel + Keyboard Handler)
    |         |         |
    |         |         +---> slice-05 (Space+Drag Pan)
    |         |
    |         +---> slice-06 (MaskCanvas Zoom-Fix)
    |         |
    |         +---> slice-07 (Touch Pinch-Zoom + Pan)
    |                   |
    |                   +---> slice-08 (Double-Tap + Swipe Guard)
    |                   |
    |                   +---> slice-09 (Procreate Stroke-Undo)
```

---

## Slice-Liste

### Slice 1: Zoom State Extension
- **Scope:** CanvasDetailContext um zoomLevel/panX/panY erweitern. Neue Actions SET_ZOOM_PAN und RESET_ZOOM_PAN. SET_CURRENT_IMAGE Reset-Logik fuer Zoom. Initial-State mit zoomLevel=1, panX=0, panY=0.
- **Deliverables:**
  - `lib/canvas-detail-context.tsx` (State-Interface, Action-Union, Reducer-Cases, Initial-State)
  - `__tests__/lib/canvas-detail-context.test.ts` (Unit-Tests fuer neue Reducer-Cases)
- **Done-Signal:** `vitest run` -- alle neuen Reducer-Tests pass: SET_ZOOM_PAN clampt auf 0.5..3.0, RESET_ZOOM_PAN setzt auf Defaults, SET_CURRENT_IMAGE resettet Zoom/Pan
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Desktop Zoom & Pan"

### Slice 2: Zoom Hook + Transform Wrapper
- **Scope:** Custom Hook `useCanvasZoom` mit Fit-Level-Berechnung (ResizeObserver), Anchor-Point-Zoom-Mathematik, Zoom-Stufen-Navigation, clamp-Logik. Transform-Wrapper-Div in canvas-detail-view.tsx um CanvasImage+MaskCanvas+OutpaintControls einfuegen. CSS transform: translate(panX, panY) scale(zoom) mit transform-origin: 0 0 und will-change: transform. CanvasImage Sizing-Klassen anpassen fuer Transform-Kompatibilitaet (object-contain -> natuerliche Dimensionen).
- **Deliverables:**
  - `lib/hooks/use-canvas-zoom.ts` (Hook: fitLevel-Berechnung, zoomToPoint, zoomToStep, clamp)
  - `components/canvas/canvas-detail-view.tsx` (Transform-Wrapper-Div einfuegen, overflow-hidden besteht bereits)
  - `components/canvas/canvas-image.tsx` (Sizing-Klassen anpassen: ref forwarding fuer naturalWidth/Height)
- **Done-Signal:** `vitest run` -- Hook-Unit-Tests pass (fitLevel-Berechnung, Anchor-Point-Math, Stufen-Navigation). Visuell: Bild wird im Transform-Wrapper gerendert, keine Regressions im Fit-State
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Desktop Zoom & Pan"

### Slice 3: ZoomControls UI Component
- **Scope:** Neue ZoomControls-Komponente: Floating-Panel unten rechts (absolute bottom-4 right-4 z-20). Vertikaler Stack: Fit-Button, Zoom-In-Button, Prozent-Anzeige, Zoom-Out-Button. Button-States: disabled bei Min/Max, active bei Fit. Buttons rufen useCanvasZoom-Funktionen auf. Styling nach FloatingBrushToolbar-Pattern (bg-card, border, shadow-md, rounded-lg).
- **Deliverables:**
  - `components/canvas/zoom-controls.tsx` (ZoomControls-Komponente)
  - `components/canvas/canvas-detail-view.tsx` (ZoomControls mounten, innerhalb <main> aber ausserhalb Transform-Wrapper)
  - `__tests__/components/canvas/zoom-controls.test.tsx` (Render-Tests: Buttons, disabled-States, Prozent-Anzeige)
- **Done-Signal:** `vitest run` -- ZoomControls rendert mit korrekten Button-States. Klick auf + erhoht Zoom-Stufe, Klick auf - senkt sie, Klick auf Fit resettet
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Desktop Zoom & Pan"

### Slice 4: Wheel + Keyboard Event Handler
- **Scope:** Ctrl/Cmd+Scroll Zoom (stufenlos, Anchor=Cursor) via addEventListener passive:false auf canvas-area. Normales Scroll = Pan vertikal (deltaY -> panY). Shift+Scroll = Pan horizontal (deltaY -> panX). Keyboard-Shortcuts +/-/0 mit isInputFocused()-Guard und Canvas-Hover-Check. Zoom-Reset bei Container-Resize (fitLevel neu berechnen, Zoom-Level beibehalten).
- **Deliverables:**
  - `lib/hooks/use-canvas-zoom.ts` (erweitern: Wheel-Handler-Logik, Keyboard-Handler-Logik, Container-Resize-Handler)
  - `components/canvas/canvas-detail-view.tsx` (Event-Listener registrieren: wheel passive:false, keydown auf document)
- **Done-Signal:** `vitest run` -- Unit-Tests fuer Wheel-Handler (Ctrl+deltaY -> Zoom, deltaY -> panY, Shift+deltaY -> panX). Keyboard-Tests (+/- -> Zoom-Stufen, 0 -> Fit). Kein Browser-Zoom bei Ctrl+Scroll ueber Canvas
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Desktop Zoom & Pan"

### Slice 5: Space+Drag Pan
- **Scope:** Space-Taste Hold -> Pan-Modus (Cursor: grab/grabbing). PointerMove bei Space -> Pan-Offset aendern. isSpaceHeld-Flag im Hook/Ref, das MaskCanvas-Painting unterdrueckt. Space loslassen -> zurueck zu vorherigem State. Ref-basierte DOM-Manipulation waehrend Drag fuer 60fps.
- **Deliverables:**
  - `lib/hooks/use-canvas-zoom.ts` (erweitern: Space-Key-Handler, isSpaceHeld-Ref, Pointer-Drag-Handler)
  - `components/canvas/canvas-detail-view.tsx` (Cursor-Style-Binding grab/grabbing, PointerMove/Up-Handler)
  - `components/canvas/mask-canvas.tsx` (isSpaceHeld-Guard in onPointerDown -- Painting unterdruecken)
- **Done-Signal:** `vitest run` -- Unit-Test: Space-Flag wird korrekt gesetzt/geloescht. Visuell: Space+Drag verschiebt gezoomtes Bild, Mask-Painting ist waehrend Space unterdrueckt
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 1 "Desktop Zoom & Pan"

### Slice 6: MaskCanvas + SAM Zoom-Koordinaten-Fix
- **Scope:** getCanvasCoords() in mask-canvas.tsx: Division durch zoomLevel bei Pointer-Koordinaten. SAM Click-Koordinaten in handleClickEditImageClick: Division durch zoomLevel. syncCanvasSize/Position: Zoom-Transform beruecksichtigen bei getBoundingClientRect. Brush-Cursor skaliert automatisch mit (liegt im Transform-Wrapper, kein extra Code).
- **Deliverables:**
  - `components/canvas/mask-canvas.tsx` (getCanvasCoords Zoom-Kompensation, syncCanvasSize Anpassung)
  - `components/canvas/canvas-detail-view.tsx` (handleClickEditImageClick: Zoom-kompensierte Koordinaten)
- **Done-Signal:** `vitest run` -- Bei Zoom 200%: Mask-Strich landet korrekt auf der Bildposition unter dem Cursor. SAM-Klick sendet korrekte normalisierte Koordinaten unabhaengig vom Zoom-Level
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Desktop Zoom & Pan"

### Slice 7: Touch Pinch-Zoom + Zwei-Finger-Pan
- **Scope:** Touch-Gesture-Erkennung: Pinch-to-Zoom (2 Finger, Abstandsaenderung -> stufenloser Zoom, Anchor=Finger-Mittelpunkt). Zwei-Finger-Pan (Mittelpunkt-Verschiebung -> Pan-Offset). Ein-Finger-Pan (wenn gezoomt + editMode null/instruction/outpaint). Ref-basierte DOM-Updates waehrend Geste fuer 60fps. Dispatch bei Gesture-Ende. touch-action:none auf Canvas-Container.
- **Deliverables:**
  - `lib/hooks/use-touch-gestures.ts` (Gesture-Recognizer: Pinch, 2F-Pan, 1F-Pan, State-Machine)
  - `components/canvas/canvas-detail-view.tsx` (Touch-Event-Listener registrieren, touch-action:none)
- **Done-Signal:** Auf Touch-Geraet: Pinch zoomt stufenlos zum Finger-Mittelpunkt. Zwei-Finger-Drag verschiebt Bild. Ein-Finger-Drag im Idle-Modus bei Zoom > Fit pannt das Bild
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 2 "Touch Gesten"

### Slice 8: Double-Tap + Swipe Guard
- **Scope:** Double-Tap-Detection (2x Tap innerhalb 300ms): Toggle Fit <-> 100%. Deaktiviert bei editMode=inpaint/erase. Swipe-Navigation nur bei Zoom=Fit (Guard in handleTouchStart/End). Bestehende Swipe-Logik bekommt zoomLevel-Pruefung.
- **Deliverables:**
  - `lib/hooks/use-touch-gestures.ts` (erweitern: Double-Tap-Timer, editMode-Guard)
  - `components/canvas/canvas-detail-view.tsx` (Swipe-Guard: zoomLevel === fitLevel Pruefung in handleTouchEnd)
- **Done-Signal:** `vitest run` -- Double-Tap bei Fit -> Zoom 100%. Double-Tap bei 100% -> Fit. Double-Tap bei inpaint/erase -> kein Effekt. Swipe-Navigation funktioniert nur bei Fit, nicht bei gezoomtem Bild
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Touch Gesten"

### Slice 9: Procreate-Style Stroke-Undo bei Gestenstart
- **Scope:** Waehrend aktivem Mask-Stroke (isDrawing=true): 2. Finger kommt -> aktueller Stroke wird automatisch rueckgaengig gemacht (maskUndoStackRef). isDrawing=false setzen. Gesten-Modus (Pinch/Pan) aktivieren. Beide Finger hoch -> zurueck zu Mask-Modus. Race-Condition-Schutz via isDrawing-Flag + requestAnimationFrame.
- **Deliverables:**
  - `lib/hooks/use-touch-gestures.ts` (erweitern: Stroke-Undo-Trigger bei 1->2 Finger-Transition)
  - `components/canvas/mask-canvas.tsx` (isDrawing-Flag exportieren/exponieren, maskUndoStackRef Zugriff fuer Gesture-Hook)
- **Done-Signal:** Auf Touch-Geraet: Mask-Strich beginnen, 2. Finger aufsetzen -> Strich wird rueckgaengig gemacht, Pinch/Pan wird aktiv. Finger hoch -> zurueck zu Mask-Modus. Kein korrupter Mask-State
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Touch Gesten"

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| 1 "Desktop Zoom & Pan" | Button-Klicks testen Zoom-Stufen | Slice 3 (ZoomControls UI) | Klick auf +/- aendert Zoom-Stufe, Prozent-Anzeige aktualisiert |
| 1 "Desktop Zoom & Pan" | Ctrl+Scroll testen | Slice 4 (Wheel + Keyboard Handler) | Ctrl+Scroll ueber Canvas -> stufenloser Zoom, kein Browser-Zoom |
| 1 "Desktop Zoom & Pan" | Pan testen (Space+Drag) | Slice 5 (Space+Drag Pan) | Space+Drag verschiebt gezoomtes Bild, Cursor grab/grabbing |
| 1 "Desktop Zoom & Pan" | Pan testen (Scroll/Shift+Scroll) | Slice 4 (Wheel + Keyboard Handler) | Scroll -> vertikal Pan, Shift+Scroll -> horizontal Pan |
| 1 "Desktop Zoom & Pan" | Keyboard +/-/0 testen | Slice 4 (Wheel + Keyboard Handler) | +/- -> Zoom-Stufen, 0 -> Fit, nur bei Canvas-Fokus |
| 1 "Desktop Zoom & Pan" | Mask-Overlay-Position verifizieren | Slice 6 (MaskCanvas Zoom-Fix) | Mask-Strich bei 200% trifft korrekte Bildposition |
| 1 "Desktop Zoom & Pan" | Zoom-Reset bei Image-Wechsel | Slice 1 (Zoom State) | SET_CURRENT_IMAGE resettet zoomLevel/panX/panY |
| 1 "Desktop Zoom & Pan" | Container-Resize-Handling | Slice 4 (Wheel + Keyboard Handler) | Chat-Panel auf/zu -> Fit-Level neu berechnet, Zoom beibehalten |
| 2 "Touch Gesten" | Pinch/Pan auf Touch-Geraet | Slice 7 (Touch Pinch-Zoom + Pan) | Pinch zoomt, 2F-Drag pannt, 1F-Drag pannt im Idle-Modus |
| 2 "Touch Gesten" | Stroke+Pinch Interaktion | Slice 9 (Procreate Stroke-Undo) | 2. Finger waehrend Stroke -> Stroke undo, Geste aktiv |
| 2 "Touch Gesten" | Double-Tap zwischen Fit/100% | Slice 8 (Double-Tap + Swipe Guard) | Double-Tap toggled Fit <-> 100%, disabled bei inpaint/erase |
| 2 "Touch Gesten" | Swipe-Nav nur bei Fit | Slice 8 (Double-Tap + Swipe Guard) | Swipe bei Zoom > Fit wird ignoriert |
| 2 "Touch Gesten" | touch-action:none auf Canvas-Container | Slice 7 (Touch Pinch-Zoom + Pan) | Browser-Zoom/-Scroll auf Canvas unterdrueckt |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (State, Hook, Transform-Wrapper, ZoomControls, Wheel/Keyboard, Space+Drag, MaskCanvas-Fix, SAM-Fix, Pinch, Pan, Double-Tap, Swipe-Guard, Stroke-Undo)
- [x] Kein Slice hat mehr als ein Concern
- [x] Schema/Service-Slices (State, Hook) kommen vor UI-Slices
- [x] Stack ist korrekt erkannt: typescript-nextjs (vitest + playwright)
- [x] Flow-Completeness: Alle Integration-Testfaelle aus Discovery-Testability haben zugehoerige Slices
