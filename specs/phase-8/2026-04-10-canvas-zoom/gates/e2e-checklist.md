# E2E Checklist: Canvas Zoom & Pan

**Integration Map:** `integration-map.md`
**Generated:** 2026-04-10

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 9/9 approved
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 gaps

---

## Happy Path Tests

### Flow 1: Button-Zoom

1. [ ] **Slice 01:** Reducer has zoomLevel=1, panX=0, panY=0 in initial state
2. [ ] **Slice 02:** Transform-Wrapper renders with `transform: translate(0px, 0px) scale(1)` at initial state
3. [ ] **Slice 03:** ZoomControls panel visible at bottom-right with 3 buttons and percent display
4. [ ] **Slice 03:** Click [+] -> zoomLevel steps to 1.5 (next step after 1.0), percent shows "150%"
5. [ ] **Slice 03:** Click [+] again -> zoomLevel steps to 2.0, percent shows "200%"
6. [ ] **Slice 03:** Click [-] -> zoomLevel steps back to 1.5, percent shows "150%"
7. [ ] **Slice 03:** Click [Fit] -> zoomLevel returns to fitLevel, panX=0, panY=0
8. [ ] **Slice 02:** Transform-Wrapper style updates correctly after each button press

### Flow 2: Desktop Ctrl+Scroll Zoom

1. [ ] **Slice 04:** Ctrl+Scroll up over canvas -> zoomLevel increases smoothly (stufenlos), preventDefault blocks browser zoom
2. [ ] **Slice 04:** Ctrl+Scroll down over canvas -> zoomLevel decreases smoothly
3. [ ] **Slice 02:** Zoom anchor at cursor position (image point under cursor stays fixed)
4. [ ] **Slice 01:** zoomLevel clamps at 3.0 (max) and 0.5 (min)
5. [ ] **Slice 04:** Ctrl+Scroll outside canvas area -> normal browser zoom (no interception)

### Flow 3: Desktop Scroll/Pan (zoomed)

1. [ ] **Slice 04:** At zoom > fit: scroll wheel -> image pans vertically (panY changes)
2. [ ] **Slice 04:** At zoom > fit: Shift+scroll -> image pans horizontally (panX changes)
3. [ ] **Slice 04:** At zoom = fit: scroll wheel -> no pan effect
4. [ ] **Slice 05:** Hold Space -> cursor changes to `grab`
5. [ ] **Slice 05:** Space held + mouse drag -> cursor changes to `grabbing`, image pans freely at 60fps
6. [ ] **Slice 05:** Release drag (mouse up) -> pan position synced to state, cursor back to `grab`
7. [ ] **Slice 05:** Release Space -> cursor back to default

### Flow 4: Touch Pinch-Zoom

1. [ ] **Slice 07:** Two fingers on canvas, spread apart -> zoom increases (anchor at finger midpoint)
2. [ ] **Slice 07:** Two fingers on canvas, pinch together -> zoom decreases (clamped at 0.5)
3. [ ] **Slice 07:** During pinch: ref-based DOM update (no React render per touchmove)
4. [ ] **Slice 07:** Fingers released -> SET_ZOOM_PAN dispatched with clamped values
5. [ ] **Slice 07:** `touch-action: none` on canvas container prevents browser zoom

### Flow 5: Touch Pan

1. [ ] **Slice 07:** Two fingers, slide together -> image pans (midpoint delta applied)
2. [ ] **Slice 07:** Simultaneous pinch + pan works (both zoom and pan update)
3. [ ] **Slice 07:** One-finger drag when zoomed + editMode null/instruction/outpaint -> image pans
4. [ ] **Slice 07:** One-finger drag when editMode=inpaint/erase -> NO pan (mask stroke instead)
5. [ ] **Slice 07:** One-finger horizontal swipe at fitLevel -> existing swipe-nav fires (not intercepted)

### Flow 6: Double-Tap

1. [ ] **Slice 08:** At fitLevel, editMode=null: double-tap -> zoom to 1.0 (100%) with anchor at tap position
2. [ ] **Slice 08:** At 1.0, editMode=null: double-tap -> zoom to fitLevel, panX=0, panY=0
3. [ ] **Slice 08:** At arbitrary zoom (e.g. 2.5), editMode=null: double-tap -> zoom to fitLevel, panX=0, panY=0
4. [ ] **Slice 08:** At editMode=inpaint: double-tap -> nothing happens
5. [ ] **Slice 08:** At editMode=erase: double-tap -> nothing happens
6. [ ] **Slice 08:** At editMode=instruction/outpaint: double-tap -> zoom toggle works
7. [ ] **Slice 08:** Single tap (no second tap within 300ms) -> no zoom toggle

### Flow 7: Pinch during Mask-Stroke (Procreate-Style)

1. [ ] **Slice 09:** editMode=inpaint, drawing mask stroke with one finger
2. [ ] **Slice 09:** Second finger touches canvas -> current stroke is undone (canvas restored from undo stack)
3. [ ] **Slice 09:** After undo: isDrawing=false, gesture mode activated
4. [ ] **Slice 09:** Pinch/pan works normally after stroke-undo
5. [ ] **Slice 09:** All fingers released -> back to mask painting mode
6. [ ] **Slice 09:** If isDrawing=false when 2nd finger arrives -> no undo, just pinch/pan starts

### Flow 8: Image-Wechsel

1. [ ] **Slice 01:** Navigate to next/prev image -> zoomLevel resets to 1, panX=0, panY=0
2. [ ] **Slice 01:** editMode, maskData, brushSize, brushTool are preserved on image change

---

## Edge Cases

### Error Handling

- [ ] Zoom at min (50%) + click [-] -> button is disabled, no effect (S03 AC-3)
- [ ] Zoom at max (300%) + click [+] -> button is disabled, no effect (S03 AC-2)
- [ ] SET_ZOOM_PAN with NaN zoomLevel -> safe handling (S01 AC-8)
- [ ] Empty undo stack + 2nd finger during stroke -> isDrawing=false, gesture mode, no canvas restore (S09 AC-7)
- [ ] Rapid 1->2 finger transition (<50ms) -> undo still executes correctly (S09 AC-9)

### State Transitions

- [ ] `fit` -> `zoomed-in` via [+] button (S03 AC-6)
- [ ] `fit` -> `zoomed-out` via Ctrl+Scroll down (S04 AC-2)
- [ ] `zoomed-in` -> `panning` via Space keydown (S05 AC-1)
- [ ] `panning` -> `zoomed-in` via Space keyup (S05 AC-2)
- [ ] `panning` -> state sync via Space keyup during drag (S05 AC-6)
- [ ] `zoomed-in` -> `fit` via [Fit] / 0 / Double-Tap (S03 AC-8, S04 AC-10, S08 AC-2)
- [ ] `gesture-active` -> previous state via all fingers up (S07 AC-6)
- [ ] ANY (masking) -> `gesture-active` via 2nd finger during stroke (S09 AC-1,2)

### Boundary Conditions

- [ ] fitLevel at exactly 1.0 (image fits perfectly) -> Fit-Button active state works (S03 AC-4)
- [ ] Container resize (chat panel toggle) -> fitLevel recalculated, zoomLevel preserved (S04 AC-11)
- [ ] Keyboard +/-/0 when input element focused (chat) -> no effect (S04 AC-7)
- [ ] Keyboard +/-/0 when mouse NOT over canvas -> no effect (S04 AC-7)
- [ ] Space keydown when input focused -> isSpaceHeld NOT set (S05 AC-9)
- [ ] Mask stroke at zoom 3.0 (max) -> correct coordinates, no drift (S06 AC-7)
- [ ] SAM click at zoom 2.0, click outside un-transformed bounds -> ignored (S06 AC-8)
- [ ] Swipe at fitLevel with maskData -> swipe blocked (existing guard preserved) (S08 AC-10)

### Mask Precision Verification

- [ ] Draw mask at zoom 2.0 -> mask pixels land exactly under cursor (S06 AC-1)
- [ ] Draw mask at zoom 1.0 -> identical to pre-feature behavior (S06 AC-2)
- [ ] syncCanvasSize at zoom 1.5 -> canvas uses natural image dimensions (S06 AC-3)
- [ ] Existing mask data preserved after syncCanvasSize at zoom (S06 AC-4)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | State -> Hook -> Transform | S01 -> S02 | Dispatch SET_ZOOM_PAN, verify transform-wrapper style updates |
| 2 | Hook -> ZoomControls | S02 -> S03 | Click button, verify zoomToStep called and state changes |
| 3 | Hook -> Wheel/Keyboard | S02 -> S04 | Ctrl+Scroll fires zoomToPoint, keyboard fires zoomToStep |
| 4 | isCanvasHovered -> Space guard | S04 -> S05 | Space only activates when mouse over canvas |
| 5 | Transform-Wrapper -> Mask coords | S02 -> S06 | Draw mask at zoom>1, verify pixel placement accuracy |
| 6 | Transform-Wrapper -> Touch gestures | S02 -> S07 | Pinch updates transform-wrapper ref directly |
| 7 | Touch gestures -> Double-tap | S07 -> S08 | Double-tap triggers zoom toggle via gesture hook |
| 8 | Touch gestures -> Stroke-undo | S07 -> S09 | 2nd finger during stroke undoes stroke, activates gesture |
| 9 | isSpaceHeld -> MaskCanvas guard | S05 -> S06 | Space held + click on MaskCanvas -> no painting |
| 10 | Swipe guard -> Touch pan | S08 <-> S07 | Swipe at fit works, swipe when zoomed blocked |
| 11 | canvas-detail-view.tsx 7-slice MODIFY chain | S02,S03,S04,S05,S06,S07,S08 | All modifications co-exist without conflict |
| 12 | use-canvas-zoom.ts 3-slice MODIFY chain | S02,S04,S05 | All handler additions work together |
| 13 | mask-canvas.tsx 3-slice MODIFY chain | S05,S06,S09 | Guard + coord fix + ref exposure co-exist |
| 14 | use-touch-gestures.ts 3-slice MODIFY chain | S07,S08,S09 | Pinch/pan + double-tap + stroke-undo co-exist |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- All tests are unit-testable (no E2E flag set on any slice)
- Touch gesture tests (S07, S08, S09) require simulated TouchEvents in test environment
- Mask precision tests (S06) require canvas context mocking
- The MODIFY chain on canvas-detail-view.tsx (7 slices) is the highest-risk integration point -- verify each slice's changes are additive and non-conflicting
