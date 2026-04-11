# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-8/2026-04-10-canvas-zoom/discovery.md`
**Wireframes:** `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md`
**Pruefdatum:** 2026-04-07

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 22 |
| Auto-Fixed (Discovery update needed) | 3 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Blocking Issues. 3 Discovery-Updates empfohlen (Wireframe-Details die in Discovery fehlen).

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Button-Zoom | 3 | Screen 1 (Fit State) -- Zoom Controls Detail, annotations 1-4 | Pass |
| Flow 2: Desktop Ctrl+Scroll Zoom | 2 | Screen 2 (Zoomed In) -- shortcut annotations at bottom | Pass |
| Flow 3: Desktop Scroll/Pan | 3 | Screen 2 -- "Scroll = vertical pan, Shift+Scroll = horizontal pan, Space+Drag = free pan" | Pass |
| Flow 4: Touch Pinch-Zoom | 3 | Screen 4 (Touch Interaction) -- "2 fingers: pinch = zoom (to midpoint)" | Pass |
| Flow 5: Touch Pan | 2 | Screen 4 -- "1 finger: zoomed, no mask = pan" + "2 fingers: drag = pan (any mode)" | Pass |
| Flow 6: Double-Tap | 2 | Screen 4 -- "double-tap: no mask = toggle fit <-> 100%" + "masking = disabled" | Pass |
| Flow 7: Procreate-Style Stroke-Undo | 5 | Screen 4 -- "during stroke = undo + gesture" + Screen 3 state "gesture-active during stroke" | Pass |
| Flow 8: Image-Wechsel | 1 | Screen 1 -- prev/next arrows shown; reset is state transition | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| Zoom-In Button | default, hover, disabled (300%) | default, disabled at-max (300%) | hover (standard CSS, no wireframe needed) | Pass |
| Zoom-Out Button | default, hover, disabled (50%) | default, disabled at-min (50%) | hover (standard CSS) | Pass |
| Fit Button | default, hover, active (Fit aktiv) | default, active/highlight when at fit level | hover (standard CSS) | Pass |
| Zoom-Prozent | text display "50%"..."300%" | "100%", "200%", "150%" shown in screens | -- | Pass |
| Canvas: fit | Bild passt in Container | Screen 1: image within container | -- | Pass |
| Canvas: zoomed-in | Bild groesser als Container | Screen 2: image exceeds container, clipped | -- | Pass |
| Canvas: zoomed-out | Bild kleiner als Container | Screen 1 state table: "Image smaller than container, surrounded by empty space" | -- | Pass |
| Canvas: panning | Cursor: Grab-Hand | Screen 2: "Cursor changes to grab hand" + "grabbing hand" | -- | Pass |
| Canvas: gesture-active | Touch-Geste laeuft | Screen 4: pinch/pan states documented | -- | Pass |
| Error: Min + [-] | Button disabled | Screen 1 state: at-min "Zoom-Out button disabled (grayed out)" | -- | Pass |
| Error: Max + [+] | Button disabled | Screen 1 state: at-max "Zoom-In button disabled (grayed out)" | -- | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| Zoom-In Button | Screen 1, Zoom Controls Detail | (2) | Pass |
| Zoom-Out Button | Screen 1, Zoom Controls Detail | (4) | Pass |
| Fit Button | Screen 1, Zoom Controls Detail | (1) | Pass |
| Zoom-Prozent | Screen 1, Zoom Controls Detail | (3) | Pass |

---

## B) Wireframe -> Discovery (Rueckfluss)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Zoom Controls: vertical block, rounded, border, shadow | Like FloatingBrushToolbar | UI Layout (line 141) | Pass -- Already Present |
| Order: Fit / + / % / - (top to bottom) | Vertical stack | UI Layout (line 142) | Pass -- Already Present |
| Z-Index: above image, below Brush Toolbar | Layering rule | UI Layout (line 143) | Pass -- Already Present |
| Position: floating bottom-right | In canvas main area | UI Layout (line 137) | Pass -- Already Present |
| Image: object-contain | object-fit | Current State (line 56) | Pass -- Already Present |
| Mask-Canvas sync with zoom/pan | Synchronized | Business Rules (line 205) | Pass -- Already Present |

### Implicit Constraints -- Discovery Updates Needed

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| "Brush cursor (circular, scaled with zoom)" (Screen 3) | Brush cursor visual size must scale inversely with zoom to maintain apparent size on image | Business Rules | Auto-Fix needed |
| Cursor: "grab hand" (Space held) vs "grabbing hand" (dragging) (Screen 2) | Two distinct cursor states: cursor:grab when Space held, cursor:grabbing during active drag | Feature State Machine, panning state | Auto-Fix needed |
| "Image is clipped by the overflow-hidden container" (Screen 2) | Canvas container requires overflow-hidden CSS to clip zoomed image | UI Layout | Auto-Fix needed |

---

## C) Auto-Fix Summary

### Discovery Updates Needed

| # | Section | Content to Add |
|---|---------|---------------|
| 1 | Business Rules (after line 205) | "Brush-Cursor (Kreis) skaliert visuell mit dem Zoom-Level -- erscheint gleich gross auf dem Bild unabhaengig vom Zoom" |
| 2 | Feature State Machine, panning state (line 168) | Expand cursor description: "Cursor: grab (Space gehalten), grabbing (waehrend Drag)" |
| 3 | UI Layout (after line 143) | "Canvas-Container benoetigt overflow-hidden um gezoomtes Bild zu clippen" |

### Wireframe Updates Needed (Blocking)

None.

---

## D) Design Decisions -> Wireframe

**design-decisions.md existiert nicht.** Phase uebersprungen.

---

## Blocking Issues

Keine.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 3
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Discovery Auto-Fix: 3 implizite Constraints aus Wireframes in Discovery zurueckschreiben
- [ ] Weiter zu Gate 1 (Architecture Compliance)
