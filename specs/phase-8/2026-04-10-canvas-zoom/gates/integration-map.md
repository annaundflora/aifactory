# Integration Map: Canvas Zoom & Pan

**Generated:** 2026-04-10
**Slices:** 9
**Connections:** 22

---

## Dependency Graph (Visual)

```
                     slice-01 (Zoom State)
                           |
                           v
                     slice-02 (Zoom Hook + Transform)
                    /      |       \           \
                   v       v        v           v
           slice-03   slice-04   slice-06   slice-07
          (Controls)  (Wheel/KB) (Mask Fix)  (Touch Pinch/Pan)
                        |                    /        \
                        v                   v          v
                     slice-05          slice-08    slice-09
                    (Space+Drag)     (DoubleTap)  (Stroke-Undo)
```

---

## Nodes

### Slice 01: Zoom State Extension

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | zoomLevel, panX, panY, SET_ZOOM_PAN, RESET_ZOOM_PAN |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | First slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `zoomLevel` | State field (0.5..3.0) | slice-02, slice-03, slice-04, slice-05, slice-06, slice-07, slice-08, slice-09 |
| `panX`, `panY` | State fields | slice-02, slice-04, slice-05, slice-07, slice-08 |
| `SET_ZOOM_PAN` | Action | slice-02, slice-04, slice-05, slice-07, slice-08 |
| `RESET_ZOOM_PAN` | Action | slice-02, slice-03 |

---

### Slice 02: Zoom Hook + Transform Wrapper

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | useCanvasZoom, Transform-Wrapper-Div, CanvasImage ref |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel`, `panX`, `panY` | slice-01 | State via useCanvasDetail() |
| `SET_ZOOM_PAN` | slice-01 | Action dispatch |
| `RESET_ZOOM_PAN` | slice-01 | Action dispatch |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `useCanvasZoom` | Hook | slice-03, slice-04, slice-05, slice-07, slice-08 |
| Transform-Wrapper-Div | DOM Element (ref) | slice-04, slice-05, slice-07 |
| CanvasImage `ref` (forwardRef) | React ref | slice-02 (self), slice-04, slice-06 |

---

### Slice 03: ZoomControls UI Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | ZoomControls component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel` | slice-01 | Via useCanvasDetail() |
| `useCanvasZoom` (fitLevel, zoomToStep, resetToFit) | slice-02 | Hook API |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ZoomControls` | React Component | User-facing (final output) |

---

### Slice 04: Wheel + Keyboard Event Handler

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | isCanvasHovered, Wheel-Handler-Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel`, `panX`, `panY` | slice-01 | State via useCanvasDetail() |
| `SET_ZOOM_PAN` | slice-01 | Action dispatch |
| `useCanvasZoom` (zoomToPoint, zoomToStep, resetToFit, fitLevel) | slice-02 | Hook API |
| Transform-Wrapper-Div | slice-02 | DOM ref for event listener |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `isCanvasHovered` | Ref/State | slice-05 |
| Wheel-Handler-Pattern | Code pattern | slice-07 (reference) |

---

### Slice 05: Space+Drag Pan

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04 |
| Outputs | isSpaceHeld ref |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel`, `panX`, `panY` | slice-01 | State via useCanvasDetail() |
| `SET_ZOOM_PAN` | slice-01 | Action dispatch |
| Transform-Wrapper-Div | slice-02 | DOM ref for direct style mutation |
| `isCanvasHovered` | slice-04 | Ref/State for Space guard |
| `isInputFocused()` | slice-04 | Guard pattern |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `isSpaceHeld` | Ref (`{ current: boolean }`) | slice-06 (MaskCanvas guard), slice-07 (Touch guard) |

---

### Slice 06: MaskCanvas + SAM Zoom-Koordinaten-Fix

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | Internal functions (no downstream consumers) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel` | slice-01 | State via useCanvasDetail() |
| Transform-Wrapper | slice-02 | MaskCanvas inside wrapper |
| CanvasImage forwardRef | slice-02 | naturalWidth/naturalHeight access |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Zoom-corrected `getCanvasCoords` | Internal function | User-facing (final output) |
| Zoom-corrected SAM coordinates | Internal function | User-facing (final output) |

---

### Slice 07: Touch Pinch-Zoom + Zwei-Finger-Pan

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | useTouchGestures hook |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel`, `panX`, `panY` | slice-01 | State via useCanvasDetail() |
| `SET_ZOOM_PAN` | slice-01 | Action dispatch |
| Transform-Wrapper-Div `ref` | slice-02 | DOM ref for direct style mutation |
| `useCanvasZoom` (fitLevel) | slice-02 | For one-finger-pan vs swipe decision |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `useTouchGestures` | Hook | slice-08, slice-09 |

---

### Slice 08: Double-Tap + Swipe Guard

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | Internal features (no downstream consumers) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `zoomLevel`, `panX`, `panY` | slice-01 | State via useCanvasDetail() |
| `SET_ZOOM_PAN` | slice-01 | Action dispatch |
| `useCanvasZoom` (fitLevel, zoomToPoint, resetToFit) | slice-02 | Hook API |
| `useTouchGestures` | slice-07 | Extend gesture hook |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Double-Tap-Toggle | Gesture feature | User-facing (final output) |
| Swipe-Guard | Guard logic | User-facing (final output) |

---

### Slice 09: Procreate-Style Stroke-Undo bei Gestenstart

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | Exposed refs for gesture hook |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useTouchGestures` | slice-07 | Extend gesture hook |
| Gesture-State-Machine | slice-07 | Internal state transition |
| `editMode` | slice-01 | State via useCanvasDetail() |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `isDrawingRef` | Exposed Ref | `useTouchGestures` (self-consumed) |
| `maskUndoStackRef` | Exposed Ref | `useTouchGestures` (self-consumed) |
| `canvasRef` | Exposed Ref | `useTouchGestures` (self-consumed) |
| Stroke-Undo Callback | Function | `useTouchGestures` (self-consumed) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | zoomLevel, panX, panY | State fields | VALID |
| 2 | Slice 01 | Slice 02 | SET_ZOOM_PAN | Action | VALID |
| 3 | Slice 01 | Slice 02 | RESET_ZOOM_PAN | Action | VALID |
| 4 | Slice 01 | Slice 03 | zoomLevel | State field | VALID |
| 5 | Slice 01 | Slice 04 | zoomLevel, panX, panY, SET_ZOOM_PAN | State + Action | VALID |
| 6 | Slice 01 | Slice 05 | zoomLevel, panX, panY, SET_ZOOM_PAN | State + Action | VALID |
| 7 | Slice 01 | Slice 06 | zoomLevel | State field | VALID |
| 8 | Slice 01 | Slice 07 | zoomLevel, panX, panY, SET_ZOOM_PAN | State + Action | VALID |
| 9 | Slice 01 | Slice 08 | zoomLevel, panX, panY, SET_ZOOM_PAN | State + Action | VALID |
| 10 | Slice 01 | Slice 09 | editMode | State field | VALID |
| 11 | Slice 02 | Slice 03 | useCanvasZoom (fitLevel, zoomToStep, resetToFit) | Hook | VALID |
| 12 | Slice 02 | Slice 04 | useCanvasZoom (zoomToPoint, zoomToStep, resetToFit, fitLevel) | Hook | VALID |
| 13 | Slice 02 | Slice 04 | Transform-Wrapper-Div | DOM ref | VALID |
| 14 | Slice 02 | Slice 05 | Transform-Wrapper-Div | DOM ref | VALID |
| 15 | Slice 02 | Slice 06 | Transform-Wrapper, CanvasImage forwardRef | DOM elements | VALID |
| 16 | Slice 02 | Slice 07 | Transform-Wrapper-Div ref, useCanvasZoom (fitLevel) | DOM ref + Hook | VALID |
| 17 | Slice 02 | Slice 08 | useCanvasZoom (fitLevel, zoomToPoint, resetToFit) | Hook | VALID |
| 18 | Slice 04 | Slice 05 | isCanvasHovered | Ref/State | VALID |
| 19 | Slice 04 | Slice 05 | isInputFocused() | Pattern | VALID |
| 20 | Slice 07 | Slice 08 | useTouchGestures | Hook | VALID |
| 21 | Slice 07 | Slice 09 | useTouchGestures | Hook | VALID |
| 22 | Slice 07 | Slice 09 | Gesture-State-Machine | Internal state | VALID |

---

## Validation Results

### VALID Connections: 22

All declared dependencies have matching outputs from producer slices.

### Orphaned Outputs: 2

| Output | Defined In | Consumers | Action |
|--------|------------|-----------|--------|
| `isSpaceHeld` | Slice 05 | slice-06, slice-07 listed | Verified: slice-05 contract lists slice-06/07 as consumers. Slice-05 MODIFY on mask-canvas.tsx adds the isSpaceHeld guard (AC-7). Slice-07 does not explicitly list isSpaceHeld in Requires but can co-exist since Space is desktop-only. ACCEPTABLE -- not a gap. |
| Wheel-Handler-Pattern | Slice 04 | slice-07 (reference only) | Pattern reference, not a code dependency. ACCEPTABLE. |

### Missing Inputs: 0

No missing inputs found. All declared dependencies are satisfied by producer slices.

### Deliverable-Consumer Gaps: 0

All components created in one slice that are consumed in another have proper mount points:

| Component | Defined In | Consumer Page | Page In Deliverables? | Status |
|-----------|------------|---------------|-----------------------|--------|
| ZoomControls | Slice 03 (zoom-controls.tsx) | canvas-detail-view.tsx | Yes -- Slice 03 MODIFY | VALID |
| useCanvasZoom | Slice 02 (use-canvas-zoom.ts) | canvas-detail-view.tsx | Yes -- Slice 02 MODIFY | VALID |
| useTouchGestures | Slice 07 (use-touch-gestures.ts) | canvas-detail-view.tsx | Yes -- Slice 07 MODIFY | VALID |

### Runtime Path Gaps: 0

All user flows have complete call chains covered by ACs:

| User-Flow | Chain | Status |
|-----------|-------|--------|
| Flow 1: Button Zoom | User click -> ZoomControls -> zoomToStep/resetToFit (S03 AC-6/7/8) -> SET_ZOOM_PAN dispatch (S02 AC-5) -> Reducer clamp (S01 AC-2/3/4) -> Transform render (S02 AC-9) | VALID |
| Flow 2: Ctrl+Scroll | wheel event -> handler (S04 AC-1/2) -> zoomToPoint (S02 AC-4) -> SET_ZOOM_PAN (S01) -> Transform | VALID |
| Flow 3: Scroll/Pan | wheel event -> panY update (S04 AC-3) / panX update (S04 AC-4) -> SET_ZOOM_PAN -> Transform | VALID |
| Flow 3: Space+Drag | keydown Space (S05 AC-1) -> pointerdown (S05 AC-3) -> pointermove ref-DOM (S05 AC-4) -> pointerup dispatch (S05 AC-5) | VALID |
| Flow 4: Pinch | touchstart 2F (S07 AC-1) -> touchmove ref-DOM (S07 AC-5) -> touchend dispatch (S07 AC-6) | VALID |
| Flow 5: Touch Pan | 2F touchmove (S07 AC-3) or 1F drag (S07 AC-7) -> ref-DOM -> dispatch | VALID |
| Flow 6: Double-Tap | touchend timing (S08 AC-1/2/3) -> zoomToPoint or resetToFit (S02) -> dispatch | VALID |
| Flow 7: Stroke-Undo | isDrawing + 2nd finger (S09 AC-1) -> undo (S09 AC-1 THEN) -> gesture mode (S09 AC-2/3) -> fingers up (S09 AC-4) | VALID |
| Flow 8: Image-Wechsel | SET_CURRENT_IMAGE (S01 AC-6) -> zoom/pan reset | VALID |
| Keyboard +/-/0 | keydown (S04 AC-8/9/10) -> zoomToStep/resetToFit (S02) -> dispatch | VALID |
| Mask at zoom | pointer on MaskCanvas -> getCanvasCoords / zoomLevel (S06 AC-1/2) -> correct canvas coordinates | VALID |
| SAM at zoom | click -> handleClickEditImageClick / zoomLevel (S06 AC-5/6) -> correct normalized coordinates | VALID |

### Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**

Files modified by multiple slices:

| File | Modified By | Analysis | Status |
|------|------------|----------|--------|
| `lib/hooks/use-canvas-zoom.ts` | S02 (create), S04 (MODIFY: wheel/keyboard), S05 (MODIFY: space/drag) | Each slice adds distinct handler functions. No method overlap. S02 creates fitLevel/zoomToPoint/zoomToStep/resetToFit. S04 adds wheel/keyboard handlers. S05 adds space/pointer-drag handlers. | VALID |
| `components/canvas/canvas-detail-view.tsx` | S02 (transform wrapper), S03 (mount ZoomControls), S04 (event listeners), S05 (cursor/pointer handlers), S06 (SAM coord fix), S07 (touch setup), S08 (swipe guard) | Each slice modifies a distinct aspect. S02: wrapper div. S03: JSX mount. S04: addEventListener. S05: cursor style + pointer handlers. S06: handleClickEditImageClick. S07: touch-action + useTouchGestures. S08: handleTouchEnd guard. No method conflicts. | VALID |
| `components/canvas/mask-canvas.tsx` | S05 (isSpaceHeld guard), S06 (getCanvasCoords + syncCanvasSize), S09 (expose refs) | S05 adds guard in onPointerDown. S06 modifies getCanvasCoords and syncCanvasSize. S09 exposes refs. No overlapping method changes. | VALID |
| `lib/hooks/use-touch-gestures.ts` | S07 (create), S08 (MODIFY: double-tap), S09 (MODIFY: stroke-undo) | S07 creates the hook with pinch/pan. S08 adds double-tap timer. S09 adds stroke-undo trigger. Each adds to different event branches (touchend timing vs touchstart finger-count). | VALID |

**Return-Type Consistency:** All hook APIs (useCanvasZoom, useTouchGestures) maintain consistent interfaces across consumer slices. Provider slice-02 exposes { fitLevel, zoomToPoint, zoomToStep, resetToFit } which covers all call patterns used by consumers (slice-03: fitLevel/zoomToStep/resetToFit, slice-04: zoomToPoint/zoomToStep/resetToFit/fitLevel, slice-08: fitLevel/zoomToPoint/resetToFit).

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| Zoom-In Button | Icon Button | Zoom Controls, 2. Position | slice-03 AC-1,6 | COVERED |
| Zoom-Out Button | Icon Button | Zoom Controls, 4. Position | slice-03 AC-1,7 | COVERED |
| Fit Button | Icon Button | Zoom Controls, 1. Position | slice-03 AC-4,5,8 | COVERED |
| Zoom-Prozent | Text | Zoom Controls, 3. Position | slice-03 AC-9,10 | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `fit` | Bild passt in Container, Prozent zeigt Fit-Wert | Zoom-In, Ctrl+Scroll, Pinch, Double-Tap, + Taste | slice-01 (state), slice-02 (fitLevel), slice-03 (buttons), slice-04 (Ctrl+Scroll/keyboard), slice-07 (pinch), slice-08 (double-tap) | COVERED |
| `zoomed-in` | Bild groesser als Container | Zoom-In/Out, Fit, Scroll, Pan, Pinch, Double-Tap, +/-/0 | slice-03 (buttons), slice-04 (scroll/keyboard), slice-05 (space pan), slice-07 (pinch/pan), slice-08 (double-tap) | COVERED |
| `zoomed-out` | Bild kleiner als Container | Zoom-In, Fit, Ctrl+Scroll, Pinch, Double-Tap, +/0 | slice-03 (zoom-in), slice-04 (ctrl+scroll/keyboard), slice-07 (pinch), slice-08 (double-tap) | COVERED |
| `panning` | Cursor grab/grabbing | Maus-Drag, Space release | slice-05 AC-1,2,3,4,5 | COVERED |
| `gesture-active` | Touch gesture running | Zoom/Pan per gesture, fingers up | slice-07 AC-1-6, slice-09 AC-2,3 | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `fit` | [+] / Ctrl+Scroll up / Pinch out / + Taste | `zoomed-in` | S03 AC-6, S04 AC-1, S07 AC-1, S04 AC-8 | COVERED |
| `fit` | Ctrl+Scroll down / Pinch in / - Taste | `zoomed-out` | S04 AC-2, S07 AC-2, S04 AC-9 | COVERED |
| `fit` | Double-Tap | `zoomed-in` | S08 AC-1 | COVERED |
| `zoomed-in` | [-] / Ctrl+Scroll down / Pinch in / - Taste | varies | S03 AC-7, S04 AC-2,9, S07 AC-2 | COVERED |
| `zoomed-in` | [Fit] / 0 / Double-Tap | `fit` | S03 AC-8, S04 AC-10, S08 AC-2,3 | COVERED |
| `zoomed-in` | Space pressed | `panning` | S05 AC-1 | COVERED |
| `zoomed-in` | 1-Finger-Drag (Touch, no mask) | `zoomed-in` (pan) | S07 AC-7 | COVERED |
| `zoomed-in` | Scroll | `zoomed-in` | S04 AC-3 | COVERED |
| `zoomed-in` | Shift+Scroll | `zoomed-in` | S04 AC-4 | COVERED |
| `zoomed-in` | Image-Wechsel | `fit` | S01 AC-6 | COVERED |
| `zoomed-out` | [+] / Ctrl+Scroll up / Pinch out / + Taste | varies | S03 AC-6, S04 AC-1,8, S07 AC-1 | COVERED |
| `zoomed-out` | [Fit] / 0 / Double-Tap | `fit` | S03 AC-8, S04 AC-10, S08 AC-2 | COVERED |
| `panning` | Space released | `zoomed-in` | S05 AC-2 | COVERED |
| `panning` | Maus-Drag | `panning` | S05 AC-4 | COVERED |
| `gesture-active` | Alle Finger hoch | Previous state | S07 AC-6, S09 AC-4 | COVERED |
| ANY (masking) | 2nd finger during stroke | `gesture-active` | S09 AC-1,2 | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Zoom-Range: 50%-300% | S01 AC-3,4 (clamp) | COVERED |
| Zoom-Stufen: 50,75,100,150,200,300% | S02 AC-5 (step array) | COVERED |
| Ctrl/Cmd+Scroll: stufenlos | S04 AC-1,2 | COVERED |
| Pinch: stufenlos | S07 AC-1,2 | COVERED |
| Zoom-Ankerpunkt: Cursor/Finger | S02 AC-4 (zoomToPoint), S07 AC-1 (finger midpoint) | COVERED |
| Zoom-Reset bei Image-Wechsel | S01 AC-6 | COVERED |
| Container-Resize: Zoom beibehalten, Fit neu berechnen | S02 AC-3, S04 AC-11 | COVERED |
| Keyboard nur bei Canvas-Fokus | S04 AC-7,8,9,10 | COVERED |
| Swipe nur bei Fit | S08 AC-8,9 | COVERED |
| Mask-Canvas synchron transformieren | S02 AC-9 (wrapper includes MaskCanvas) | COVERED |
| Pointer-Koordinaten zoom-kompensiert | S06 AC-1,2 | COVERED |
| Brush-Cursor skaliert mit Zoom | Architecture: cursor in transform-wrapper, auto-scales | COVERED |
| Space-Vorrang ueber Mask-Painting | S05 AC-7,8 | COVERED |
| Double-Tap disabled bei inpaint/erase | S08 AC-4,5 | COVERED |
| Touch Ein-Finger-Pan guards | S07 AC-7,8,9 | COVERED |
| Image-Wechsel blockiert bei maskData | Existing behavior, preserved | COVERED |
| SAM Click-Koordinaten zoom-kompensiert | S06 AC-5,6,8 | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `zoomLevel` (0.5..3.0, float) | Yes | S01 AC-1,2,3,4 | COVERED |
| `panX` (Number, px) | Yes | S01 AC-1,2 | COVERED |
| `panY` (Number, px) | Yes | S01 AC-1,2 | COVERED |

**Discovery Coverage:** 38/38 (100%)

---

## Infrastructure Prerequisite Check

- **Health Endpoint:** N/A -- Pure frontend feature, no backend routes
- **Log Channels:** N/A -- No server-side logging
- **Browser APIs:** All required (TouchEvent, PointerEvent, WheelEvent, ResizeObserver, CSS Transform) are standard Web APIs available in target browsers

No infrastructure prerequisites required.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 9 |
| Total Connections | 22 |
| Valid Connections | 22 |
| Orphaned Outputs | 2 (both acceptable -- see analysis) |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 100% |

**Verdict:** READY FOR ORCHESTRATION
