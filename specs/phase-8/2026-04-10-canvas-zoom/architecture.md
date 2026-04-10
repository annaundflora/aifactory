# Feature: Canvas Zoom & Pan

**Epic:** --
**Issue:** #26
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Bilder in der Canvas-Ansicht koennen nicht vergroessert werden -- Detailarbeit (z.B. Masking kleiner Bereiche) ist ungenau
- Auf Touch-Geraeten (iPad, Tablet) fehlt die natuerliche Pinch-to-Zoom-Interaktion -- das Bild ist statisch

**Solution:**
- Zoom-Controls (Buttons + Prozentanzeige + Fit) als Floating-Panel unten rechts
- Touch-Gesten: Pinch-to-Zoom + Zwei-Finger-Pan
- Desktop: Ctrl/Cmd+Scroll zum Zoomen, Space+Drag zum Pannen, Wheel zum Scrollen

**Business Value:**
- Hoehere Masking-Praezision bei Inpaint/Erase durch Zoom
- Native Touch-Erfahrung auf Tablets (iPad Pro etc.)

---

## Scope & Boundaries

| In Scope |
|----------|
| Zoom-Controls: +/- Buttons, Prozent-Anzeige, Fit-Button (unten rechts, floating) |
| Touch: Pinch-to-Zoom, Zwei-Finger-Pan |
| Desktop: Ctrl/Cmd+Scroll=Zoom, Space+Drag=Pan, Scroll=V-Scroll, Shift+Scroll=H-Scroll |
| Keyboard: +/-=Zoom, 0=Fit (nur wenn Canvas-Bereich aktiv) |
| Double-Tap: Toggle Fit <-> 100% |
| Zoom in allen Modi (idle, inpaint, erase, outpaint) |
| Procreate-Style Stroke-Undo bei Gestenstart waehrend Masking |
| Zoom-Reset bei Image-Wechsel |
| Zoom-Ankerpunkt: Cursor-/Finger-Position |
| Mask-Canvas synchron mitskalieren/mitverschieben |

| Out of Scope |
|--------------|
| Rotation |
| Minimap / Uebersichtsfenster |
| Zoom-Level Persistenz ueber Image-Wechsel hinaus |
| Zoom-Animations-Easing (Performance-Optimierung) |
| Mobile-spezifische Toolbar-Anpassung |

---

## API Design

N/A — Reines Frontend-Feature, kein Backend-Aufruf noetig.

---

## Database Schema

N/A — Kein persistenter Zoom-State, kein DB-Schema.

---

## Server Logic

N/A — Gesamte Logik im Client (React State + Event Handler).

---

## Security

### Input Validation

| Input | Validation | Notes |
|-------|------------|-------|
| zoomLevel | Clamp 0.5..3.0 | Sowohl im Reducer als auch in Gesture-Handlern clampen |
| panX / panY | Number (keine NaN/Infinity) | Sanitize nach Gesture-Ende |
| Keyboard shortcuts | isInputFocused() guard | Existierendes Pattern (mask-canvas.tsx:86-97) wiederverwenden |

### Keine weiteren Security-Aspekte

- Kein User-Input wird an Server gesendet
- Keine externe Resource-Loading-Logik
- Zoom-State existiert nur in-memory (React Context)

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| State (CanvasDetailContext) | Zoom/Pan State + Actions | EXTEND: Reducer + Provider (existiert) |
| Component (ZoomControls) | UI fuer +/-/Fit/Prozent | NEW: Floating Panel (REUSE FloatingBrushToolbar Styling) |
| Hook/Logic (useCanvasZoom) | Zoom-Berechnungen, Fit-Level, Anchor-Point Math | NEW: Custom Hook |
| Event Layer (Canvas-Detail-View) | Wheel, Keyboard, Space+Drag Handler | EXTEND: canvas-detail-view.tsx |
| Gesture Layer (Touch) | Pinch/Pan/Double-Tap/Stroke-Undo Erkennung | NEW: Gesture-Recognizer |
| Transform Layer (CSS) | GPU-beschleunigte Bild-Transformation | NEW: CSS transform auf Wrapper-Div |

### Data Flow

```
User Input (Mouse/Touch/Keyboard)
       │
       ▼
Event/Gesture Handler
       │
       ├── Continuous: Ref-basierte Transform-Updates (kein React Render)
       │         │
       │         ▼
       │   DOM Style Mutation (transform auf Wrapper-Div)
       │
       └── Gesture-Ende: Dispatch an Reducer
                 │
                 ▼
          CanvasDetailState (zoomLevel, panX, panY)
                 │
                 ▼
          React Render → CSS transform: translate(panX, panY) scale(zoom)
```

### Transform-Strategie

- **CSS `transform: translate(panXpx, panYpx) scale(zoom)`** auf einem Wrapper-Div
- **`transform-origin: 0 0`** (top-left), Pan kompensiert den Ankerpunkt
- **`will-change: transform`** fuer GPU-Compositing
- **Waehrend Geste:** Direkte DOM-Manipulation via `ref.current.style.transform` (60fps, kein React-Render)
- **Nach Geste:** `dispatch({ type: "SET_ZOOM_PAN", ... })` → React-Render synchronisiert State

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/canvas-detail-context.tsx` | State ohne Zoom/Pan; Actions ohne Zoom-Actions | State mit zoomLevel/panX/panY; Actions SET_ZOOM_PAN, RESET_ZOOM_PAN | Interface + Action Union + Reducer Cases + Initial State erweitern |
| `components/canvas/canvas-detail-view.tsx` | Touch: nur Swipe-Handler; Keyboard: keine Zoom-Keys; Layout: kein Transform-Wrapper | Touch: Swipe gated behind zoom=fit; Wheel/Keyboard/Space handler; Transform-Wrapper um Image+Mask+Outpaint | Swipe-Guard, neue Event-Handler, Wrapper-Div einfuegen, ZoomControls rendern |
| `components/canvas/canvas-image.tsx` | Selbst-sizend via max-h-full max-w-full object-contain | Groesse durch natuerliche Bild-Dimensionen bestimmt (von Zoom-Wrapper skaliert) | Sizing-Klassen anpassen fuer Transform-Kompatibilitaet |
| `components/canvas/mask-canvas.tsx` | getCanvasCoords: clientX - rect.left (ohne Zoom-Offset); syncCanvasSize/Position: raw getBoundingClientRect | getCanvasCoords: Division durch zoomLevel; syncCanvasSize/Position: Zoom-Transform beruecksichtigen | Zoom-Kompensation in Koordinaten-Berechnung + Sizing |
| `components/canvas/outpaint-controls.tsx` | Absolute Position innerhalb Image-Container (ohne Transform) | Position innerhalb Transform-Wrapper (skaliert automatisch mit) | Keine Code-Aenderung noetig — liegt im Transform-Wrapper |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Mask-Canvas muss synchron mit Bild transformieren | MaskCanvas liegt im gleichen Transform-Wrapper → skaliert automatisch mit | Wrapper-Div um CanvasImage + MaskCanvas + OutpaintControls |
| Pointer-Koordinaten muessen Zoom/Pan rueckrechnen | getBoundingClientRect gibt transformierte Werte → Division durch zoomLevel noetig | `getCanvasCoords()` in mask-canvas.tsx anpassen |
| Brush-Cursor skaliert visuell mit Zoom | Cursor-Canvas liegt im Transform-Wrapper → CSS-Scale skaliert den Kreis automatisch | Kein extra Handling noetig (Cursor-Canvas im Wrapper) |
| Swipe-Navigation nur bei Fit | Touch-Swipe darf nicht bei gezoomtem Bild feuern | `handleTouchStart/End` pruefen `zoomLevel === fitLevel` |
| Space-Taste Vorrang ueber Mask-Painting | Wenn Space gehalten, duerfen Pointer Events auf MaskCanvas nicht zeichnen | `isSpaceHeld` Flag im Context, MaskCanvas prueft Flag vor onPointerDown |
| Ctrl+Scroll darf nicht Browser-Zoom ausloesen | `wheel` Event mit ctrlKey muss `preventDefault()` aufrufen | Wheel-Handler auf canvas-area <main> mit passive:false |
| Keyboard-Shortcuts nur bei Canvas-Fokus | +/-/0 duerfen nicht im Chat-Panel feuern | Bestehender isInputFocused() Guard + pruefen ob Maus ueber Canvas |
| Container-Resize bei Chat-Panel toggle | Zoom-Level beibehalten, nur Fit-Level neu berechnen | ResizeObserver auf canvas-area, Fit-Level dynamisch berechnen |
| SAM Click-Koordinaten | Klick-Koordinaten fuer click-to-edit muessen Zoom/Pan beruecksichtigen | Normalisierungs-Logik in handleClickEditImageClick anpassen |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| React | UI Framework | Hooks, Context, Reducer | 19.2.3 | PointerEvent, TouchEvent APIs |
| Next.js | App Router | Client Components ("use client") | 16.1.6 | Kein Server-seitiges Rendering fuer Zoom |
| Lucide React | Icons | ZoomIn, ZoomOut, Maximize2 | Aus package.json | Bereits im Projekt vorhanden |
| CSS Transform | Browser API | transform, transform-origin, will-change | CSS3 | GPU-beschleunigt, alle modernen Browser |
| PointerEvent API | Browser API | onPointerDown/Move/Up, setPointerCapture | Web Standard | Bereits in MaskCanvas genutzt |
| TouchEvent API | Browser API | onTouchStart/Move/End, touches, changedTouches | Web Standard | Fuer Pinch/Pan Gesture-Erkennung |
| WheelEvent API | Browser API | onWheel, deltaY, ctrlKey, shiftKey | Web Standard | Fuer Ctrl+Scroll Zoom + Scroll Pan |
| ResizeObserver | Browser API | observe, disconnect | Web Standard | Bereits in MaskCanvas genutzt |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Render Performance | 60fps waehrend Zoom/Pan | CSS Transform (GPU-composited, kein Reflow); Ref-basierte Updates waehrend Geste (kein React Render) | Chrome DevTools Performance Tab: kein Frame Drop bei Pinch/Pan |
| Input Latency | < 16ms Reaktionszeit | Pointer/Touch Events direkt in DOM-Mutation; Reducer-Dispatch nur bei Gesture-Ende | Kein wahrnehmbares Lag beim Zoomen/Pannen |
| Touch Responsiveness | Native-aehnliche Pinch-Erfahrung | `touch-action: none` auf Canvas-Container; passive:false fuer preventDefault | iPad Safari: fluessiges Pinch ohne Browser-Zoom-Interferenz |
| Mask Precision | Korrekte Strich-Position bei allen Zoom-Levels | Zoom-kompensierte Koordinaten-Berechnung in getCanvasCoords | Maske auf 200% zeichnen, auf Fit pruefen: Position stimmt |

### Monitoring & Observability

N/A — Frontend-only, kein Server-Monitoring. Debugging via Browser DevTools.

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| CSS Transform auf Wrapper skaliert MaskCanvas korrekt mit | Canvas-Element in CSS-Transform-Container: getBoundingClientRect gibt transformierte Werte zurueck | MaskCanvas-Position/Groesse stimmt nicht → Koordinaten-Fix in syncCanvasSize noetig |
| touch-action:none verhindert Browser-Zoom auf Canvas-Container | iOS Safari + Chrome Android respektieren touch-action:none | Pinch-to-Zoom loest Browser-Zoom aus → meta viewport + Gesture-Handler preventDefault |
| PointerEvent + TouchEvent koexistieren fuer Stroke+Gesture | PointerEvents fuer Single-Touch-Strokes, TouchEvents fuer Multi-Touch-Gesten | Touch-Event-Konflikte → PointerEvent-Only mit pointerType-Check |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| iOS Safari blockiert touch-action:none unter bestimmten Bedingungen | Low | High | Meta-Viewport `user-scalable=no` als Backup; Event.preventDefault() in touchstart/touchmove | Button-only Zoom (kein Pinch) auf iOS |
| MaskCanvas Koordinaten-Drift bei hohen Zoom-Levels | Medium | Medium | Praezise Division durch exakten zoomLevel-Wert (kein Rounding); E2E-Test bei 300% | Canvas-Offset-Kalibrierung bei jedem Stroke-Start |
| Wheel-Event passive-Listener Warnung in Chrome | Low | Low | Explizit `{ passive: false }` bei addEventListener (nicht React onWheel) | React onWheel mit CSS-Workaround |
| Procreate Stroke-Undo Race Condition (2. Finger waehrend Stroke) | Medium | Medium | isDrawing-Flag pruefen + Undo nur wenn Flag true; requestAnimationFrame-gated | Kein Auto-Undo, User muss manuell rueckgaengig machen |
| Conflict zwischen Space-Pan und Mask-Painting | Low | High | isSpaceHeld State-Flag: true → suppressPointerEvents auf MaskCanvas; false → normales Painting | Space-Pan nur via Button statt Keyboard |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Transform | CSS `transform: translate() scale()` | GPU-composited, kein Layout/Paint, 60fps garantiert |
| State | CanvasDetailContext Reducer (EXTEND) | Zoom-State gehoert zum Canvas-Detail-Context — alle Komponenten brauchen Zugriff |
| Gesture Recognition | Custom Implementation (kein Library) | Simpler als Hammer.js/use-gesture; nur Pinch+Pan+DoubleTap noetig; volle Kontrolle ueber Procreate-Undo |
| Continuous Updates | Ref-basierte DOM-Manipulation | React-State-Updates bei 60fps wuerden Render-Overhead erzeugen; Refs umgehen Virtual DOM |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Custom Gesture statt Library (use-gesture) | Kein extra Dependency; volle Kontrolle ueber Procreate-Undo | Mehr Code zu schreiben + maintainen | Gesture-Logik in eigene Datei isolieren (testbar) |
| CSS Transform statt Canvas Redraw | GPU-beschleunigt; MaskCanvas skaliert automatisch mit | Subpixel-Rendering bei nicht-ganzzahligen Zoom-Levels | Zoom-Stufen bei Buttons ganzzahlig; stufenloses Zoom akzeptiert Subpixel |
| Zoom-State im Reducer statt separatem Context | Ein Context fuer alles; kein zusaetzlicher Provider | CanvasDetailState wird groesser | 3 Felder (zoomLevel, panX, panY) → minimal |
| Ref-basierte Updates waehrend Geste | 60fps ohne React-Overhead | State und DOM koennen kurzzeitig divergieren | Sync bei Gesture-Ende via dispatch |

---

## Architecture Detail: State Extension

### Neue State-Felder

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `zoomLevel` | `number` | Dynamisch berechnet (Fit-Level) | Clamp 0.5..3.0 |
| `panX` | `number` | `0` | Number (kein NaN) |
| `panY` | `number` | `0` | Number (kein NaN) |

### Neue Actions

| Action | Payload | Reducer-Logik |
|--------|---------|---------------|
| `SET_ZOOM_PAN` | `{ zoomLevel: number; panX: number; panY: number }` | Clamp zoomLevel 0.5..3.0, setze alle drei Werte |
| `RESET_ZOOM_PAN` | -- | Setze zoomLevel auf 1.0 (Fit wird extern berechnet), panX/panY auf 0 |

### Zoom-Reset bei Image-Wechsel

`SET_CURRENT_IMAGE` Reducer-Case erweitern: panX/panY auf 0 zuruecksetzen, zoomLevel auf 1.0 (Fit).

---

## Architecture Detail: Component Hierarchy

```
<main> (canvas-area, overflow-hidden)
  │
  ├── <CanvasNavigation />     — Prev/Next Buttons (unveraendert, ausserhalb Transform)
  ├── <FloatingBrushToolbar /> — Brush-Controls (unveraendert, ausserhalb Transform)
  ├── <ZoomControls />         — NEU: Floating Zoom Panel (ausserhalb Transform)
  │
  └── <div> (canvas-image-area, p-4, items-center)
        │
        └── <div> (zoom-transform-wrapper)
              │   style: transform: translate(panX, panY) scale(zoom)
              │   transform-origin: 0 0
              │   will-change: transform
              │
              ├── <CanvasImage />        — Bild (skaliert via CSS Transform)
              ├── <MaskCanvas />         — Mask Overlay (skaliert mit)
              └── <OutpaintControls />   — Direction Buttons (skalieren mit)
```

### ZoomControls Positionierung

- `absolute bottom-4 right-4 z-20` (unter FloatingBrushToolbar z-30)
- Vertikaler Stack: Fit → + → Prozent → -
- REUSE: `Button size="icon-sm"`, `bg-card border border-border/80 shadow-md rounded-lg`

---

## Architecture Detail: Zoom-Berechnungen

### Fit-Level Berechnung

```
fitLevel = min(containerWidth / imageNaturalWidth, containerHeight / imageNaturalHeight)
```

- Dynamisch bei Container-Resize (ResizeObserver)
- `imageNaturalWidth/Height` aus `<img>.naturalWidth/.naturalHeight`

### Anchor-Point Zoom (Cursor-Position)

```
// Punkt unter Cursor in Bild-Koordinaten (vor Zoom)
imageX = (cursorX - panX) / oldZoom
imageY = (cursorY - panY) / oldZoom

// Nach Zoom: gleicher Bild-Punkt unter Cursor
newPanX = cursorX - imageX * newZoom
newPanY = cursorY - imageY * newZoom
```

### Button/Keyboard Zoom (Mitte des sichtbaren Ausschnitts)

```
centerX = containerWidth / 2
centerY = containerHeight / 2
// Dann Anchor-Point-Formel mit center als Cursor-Position
```

### Zoom-Stufen (Buttons)

`[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]` — naechste/vorherige Stufe relativ zum aktuellen Level.

### Stufenloser Zoom (Ctrl+Scroll, Pinch)

`newZoom = clamp(oldZoom * (1 + delta * factor), 0.5, 3.0)`

---

## Architecture Detail: Event Handler Map

| Input | Event | Handler Location | Action |
|-------|-------|------------------|--------|
| + Button | click | ZoomControls | Naechste Zoom-Stufe, Anchor=Center |
| - Button | click | ZoomControls | Vorherige Zoom-Stufe, Anchor=Center |
| Fit Button | click | ZoomControls | Zoom=Fit, Pan=(0,0) |
| Ctrl/Cmd+Scroll | wheel (passive:false) | canvas-area <main> | Stufenloser Zoom, Anchor=Cursor |
| Scroll (kein Modifier) | wheel | canvas-area <main> | Pan vertikal (deltaY → panY) |
| Shift+Scroll | wheel | canvas-area <main> | Pan horizontal (deltaY → panX) |
| + Taste | keydown | document (mit Canvas-Focus-Guard) | Naechste Zoom-Stufe, Anchor=Center |
| - Taste | keydown | document (mit Canvas-Focus-Guard) | Vorherige Zoom-Stufe, Anchor=Center |
| 0 Taste | keydown | document (mit Canvas-Focus-Guard) | Zoom=Fit, Pan=(0,0) |
| Space+Drag | keydown+pointermove | canvas-area | Pan frei, Cursor grab/grabbing |
| Pinch | touchmove (2 Finger) | canvas-area | Stufenloser Zoom, Anchor=Finger-Mittelpunkt |
| 2-Finger-Drag | touchmove (2 Finger) | canvas-area | Pan frei |
| Double-Tap | touchend (Timing) | canvas-area | Toggle Fit <-> 100% (disabled bei inpaint/erase) |
| 1-Finger-Drag (Touch, zoomed, kein Mask) | touchmove (1 Finger) | canvas-area | Pan |
| Image-Wechsel | SET_CURRENT_IMAGE | Reducer | Reset Zoom=Fit, Pan=(0,0) |

---

## Architecture Detail: MaskCanvas Koordinaten-Fix

### Problem

`getCanvasCoords()` berechnet aktuell:
```
x = e.clientX - rect.left
y = e.clientY - rect.top
```

Bei CSS Transform `scale(zoom)` gibt `getBoundingClientRect()` die *visuelle* Groesse zurueck (= canvas.width * zoom). Der Canvas-interne Koordinatenraum bleibt aber unveraendert.

### Loesung

```
x = (e.clientX - rect.left) / zoomLevel
y = (e.clientY - rect.top) / zoomLevel
```

`zoomLevel` wird via `useCanvasDetail()` gelesen (bereits importiert).

### Brush-Cursor Groesse

Der Cursor-Canvas liegt im Transform-Wrapper. CSS-Scale skaliert den gezeichneten Kreis automatisch visuell mit → der Brush erscheint gleich gross auf dem Bild unabhaengig vom Zoom. Keine Aenderung am Cursor-Drawing-Code noetig.

---

## Architecture Detail: Gesture Recognition (Touch)

### Pinch-to-Zoom Algorithmus

1. `touchstart`: Wenn `touches.length === 2` → Initialen Abstand + Mittelpunkt speichern
2. `touchmove`: Neuen Abstand berechnen → `ratio = newDist / initialDist` → `newZoom = startZoom * ratio`
3. `touchend`: Final-Werte dispatchen

### Zwei-Finger-Pan

1. Waehrend Pinch: Mittelpunkt-Verschiebung tracken → `deltaX/Y = newMidpoint - oldMidpoint`
2. Pan-Offset entsprechend anpassen

### Double-Tap Detection

1. `touchend` mit `touches.length === 0` und `changedTouches.length === 1`
2. Zeitstempel merken; bei erneutem Tap innerhalb 300ms → Double-Tap
3. Guard: `editMode !== "inpaint" && editMode !== "erase"`

### Procreate-Style Stroke-Undo

1. MaskCanvas: Waehrend `isDrawing === true` und `touchstart` Event mit `touches.length === 2`
2. → Letzten Stroke via `maskUndoStackRef` rueckgaengig machen
3. → `isDrawing = false` setzen
4. → Gesture-Modus (Pinch/Pan) aktivieren

---

## Open Questions

_Keine offenen Fragen. Alle technischen Aspekte geklaert._

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-10 | Codebase | CanvasDetailState hat 12 Felder, Reducer 14 Action-Types — Erweiterung um 3 Felder + 2 Actions ist proportional |
| 2026-04-10 | Codebase | canvas-detail-view.tsx:874 <main> hat bereits overflow-hidden — kein extra Clipping noetig |
| 2026-04-10 | Codebase | MaskCanvas nutzt getBoundingClientRect fuer Koordinaten (mask-canvas.tsx:354-365) — muss durch zoomLevel dividiert werden |
| 2026-04-10 | Codebase | FloatingBrushToolbar z-30 — ZoomControls z-20 vermeidet Overlap |
| 2026-04-10 | Codebase | Swipe-Navigation hat bereits maskData-Guard (canvas-detail-view.tsx:215) — muss zusaetzlich Zoom-Guard bekommen |
| 2026-04-10 | Codebase | Kein wheel-Event-Handler existiert in der Codebase (grep: 0 Treffer) |
| 2026-04-10 | Codebase | OutpaintControls nutzt pointer-events-none + pointer-events-auto Pattern — funktioniert im Transform-Wrapper |
| 2026-04-10 | Codebase | SAM click-edit (canvas-detail-view.tsx:452-486) berechnet normalisierte Koordinaten — muss Zoom/Pan beruecksichtigen |
| 2026-04-10 | Codebase | TouchDragContext existiert (lib/touch-drag-context.tsx) aber handelt nur Single-Touch — nicht wiederverwendbar fuer Pinch |
| 2026-04-10 | Web | CSS transform: translate() scale() mit transform-origin: 0 0 ist Standard-Pattern fuer Zoom+Pan (Figma, Miro, Google Maps) |
| 2026-04-10 | Web | Procreate nutzt Finger-Count-Transition: 1→2 Finger = Stroke undo + Gesture start |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Custom Gesture-Erkennung oder Library (use-gesture)? | Custom — nur Pinch+Pan+DoubleTap noetig, volle Kontrolle fuer Procreate-Undo |
| 2 | Zoom-State im CanvasDetailContext oder separater Context? | CanvasDetailContext erweitern — alle Canvas-Komponenten brauchen Zugriff, ein Provider genuegt |
| 3 | CSS Transform oder Canvas-Redraw fuer Zoom? | CSS Transform — GPU-beschleunigt, MaskCanvas skaliert automatisch mit |
| 4 | Ref-basierte Updates waehrend Geste oder React State? | Refs fuer 60fps DOM-Updates, Reducer-Dispatch nur bei Gesture-Ende |
