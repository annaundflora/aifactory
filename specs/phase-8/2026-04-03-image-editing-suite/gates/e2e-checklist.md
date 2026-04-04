# E2E Checklist: AI Image Editing Suite

**Integration Map:** `integration-map.md`
**Generated:** 2026-04-04

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 16/16 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 missing
- [x] Integration Map has no RUNTIME PATH GAPS -- 0 gaps
- [x] Discovery Coverage 100% -- 56/56 elements covered

---

## Happy Path Tests

### Flow 1: Mask-Inpainting (Object Replacement)

1. [ ] **Slice 07:** User clicks `brush-edit` toolbar button -> `editMode` becomes `"inpaint"`
2. [ ] **Slice 03:** Mask-Canvas overlay appears over the image, cursor becomes circle
3. [ ] **Slice 04:** Floating Brush Toolbar appears above the canvas (brush-size slider, brush/eraser toggle, clear button)
4. [ ] **Slice 03:** User paints mask over target area (red semi-transparent overlay, rgba 255,0,0,128)
5. [ ] **Slice 04:** User can adjust brush size via slider (1-100), value displays next to slider
6. [ ] **Slice 03:** On mouseup, `SET_MASK_DATA` is dispatched with ImageData
7. [ ] **Slice 07:** User types prompt in Canvas-Chat and sends
8. [ ] **Slice 06b:** Canvas Agent classifies intent as inpaint (mask+prompt -> inpaint action)
9. [ ] **Slice 07:** SSE event with `action: "inpaint"` is parsed correctly
10. [ ] **Slice 07:** `handleCanvasGenerate` executes inpaint branch: validateMinSize -> applyFeathering(10) -> scaleToOriginal -> toGrayscalePng -> R2 upload -> generateImages(mode: "inpaint", maskUrl)
11. [ ] **Slice 06a:** `buildReplicateInput` produces `{image, mask, prompt}` for FLUX Fill Pro
12. [ ] **Slice 07:** On success: PUSH_UNDO with current image, SET_CURRENT_IMAGE with new image
13. [ ] **Slice 07:** Mask remains visible after generation (user can iterate)

### Flow 2: Object Removal (Erase)

1. [ ] **Slice 07:** User clicks `erase` toolbar button -> `editMode` becomes `"erase"`
2. [ ] **Slice 03:** Mask-Canvas overlay appears, cursor becomes circle
3. [ ] **Slice 04:** Floating Brush Toolbar appears with additional "Entfernen" button
4. [ ] **Slice 03:** User paints mask over object to remove
5. [ ] **Slice 04:** "Entfernen" button is enabled (maskData not null)
6. [ ] **Slice 09:** User clicks "Entfernen" -> `handleEraseAction` executes: MaskService pipeline -> R2 upload -> generateImages(mode: "erase", maskUrl) directly (no SSE/Agent)
7. [ ] **Slice 06a:** `buildReplicateInput` produces `{image, mask}` (no prompt) for Bria Eraser
8. [ ] **Slice 09:** On success: PUSH_UNDO + SET_CURRENT_IMAGE, mask remains in state

### Flow 3: Instruction Editing (Text-only)

1. [ ] **Slice 08:** No edit tool is active (`editMode === null`)
2. [ ] **Slice 08:** User types "Mach den Himmel blauer" in Canvas-Chat and sends
3. [ ] **Slice 06b:** Canvas Agent classifies as instruction (no mask + edit intent)
4. [ ] **Slice 08:** SSE event with `action: "instruction"` is parsed
5. [ ] **Slice 08:** `handleCanvasGenerate` instruction branch executes: resolveActiveSlots("instruction") -> generateImages(mode: "instruction", sourceImageUrl, prompt)
6. [ ] **Slice 06a:** `buildReplicateInput` produces `{image_url, prompt}` (no mask) for FLUX Kontext Pro
7. [ ] **Slice 08:** On success: PUSH_UNDO + SET_CURRENT_IMAGE + onGenerationsCreated

### Flow 4: Click-to-Edit (SAM Auto-Mask)

1. [ ] **Slice 07:** User clicks `click-edit` toolbar button -> `editMode` becomes `"click-edit"`
2. [ ] **Slice 11:** Cursor changes to crosshair, no mask overlay visible, no floating toolbar
3. [ ] **Slice 11:** User clicks on an object in the image
4. [ ] **Slice 11:** Normalized coordinates calculated (offsetX/clientWidth, offsetY/clientHeight)
5. [ ] **Slice 11:** `POST /api/sam/segment` called with `{image_url, click_x, click_y}`
6. [ ] **Slice 10:** SAM API validates input, calls Replicate `meta/sam-2`, uploads mask to R2
7. [ ] **Slice 11:** Loading spinner visible during SAM call
8. [ ] **Slice 11:** On SAM success: mask PNG loaded, rendered as red overlay in MaskCanvas
9. [ ] **Slice 11:** `SET_MASK_DATA` dispatched, `SET_EDIT_MODE` set to `"inpaint"`
10. [ ] **Slice 04:** Floating Brush Toolbar appears (user can refine mask)
11. [ ] **Slice 07:** User types prompt -> Inpaint flow (Flow 1 from step 7)

### Flow 5: Outpainting (Image Extension)

1. [ ] **Slice 07:** User clicks `expand` toolbar button -> `editMode` becomes `"outpaint"`
2. [ ] **Slice 13:** `OutpaintControls` appears at image edges, MaskCanvas/FloatingToolbar hidden
3. [ ] **Slice 12:** 4 Direction buttons visible (Top, Bottom, Left, Right), Size selection (25%, 50%, 100%) with 50% pre-selected
4. [ ] **Slice 12:** User clicks "Top" -> `SET_OUTPAINT_DIRECTIONS` dispatched with `["top"]`
5. [ ] **Slice 13:** Chat Send-button is enabled (direction selected)
6. [ ] **Slice 13:** User types prompt and sends
7. [ ] **Slice 06b:** Canvas Agent classifies as outpaint
8. [ ] **Slice 13:** `handleCanvasGenerate` outpaint branch: passes `outpaintDirections`, `outpaintSize` to `generateImages(mode: "outpaint")`
9. [ ] **Slice 13:** `buildReplicateInput` extends image via sharp (transparent padding), generates mask (black=original, white=extended), sends to FLUX Fill Pro
10. [ ] **Slice 13:** On success: PUSH_UNDO + SET_CURRENT_IMAGE with extended image

---

## Edge Cases

### Error Handling

- [ ] **Slice 07 AC-5:** Mask too small (< 10px bounding box) -> Toast "Markiere einen groesseren Bereich", no generation
- [ ] **Slice 09 AC-3:** Erase with too small mask -> Toast "Markiere einen groesseren Bereich"
- [ ] **Slice 09 AC-6:** R2 mask upload failure -> Toast "Mask-Upload fehlgeschlagen", mask preserved
- [ ] **Slice 08 AC-5:** Instruction generation error -> Error toast, SET_GENERATING false, image unchanged
- [ ] **Slice 11 AC-8:** SAM returns no object (HTTP 422) -> Toast "Kein Objekt erkannt. Versuche einen anderen Punkt."
- [ ] **Slice 11 AC-9:** SAM API failure (HTTP 502) -> Toast "SAM-Fehler. Versuche manuelles Maskieren."
- [ ] **Slice 13 AC-8:** Outpaint would exceed 2048px limit -> Toast "Bild wuerde API-Limit ueberschreiten"
- [ ] **Slice 06a AC-5:** Inpaint without maskUrl -> Error "Maske ist erforderlich fuer Inpaint/Erase"
- [ ] **Slice 06a AC-7:** Outpaint without directions -> Error "Mindestens eine Richtung erforderlich"
- [ ] **Slice 06a AC-8:** Outpaint with invalid size (99) -> Error "Ungueltiger Erweiterungswert"
- [ ] **Slice 06a AC-13:** Invalid generation mode -> Error "Ungueltiger Generierungsmodus"
- [ ] **Slice 10 AC-2:** Unauthenticated SAM request -> HTTP 401
- [ ] **Slice 10 AC-3:** SAM click coordinates out of range -> HTTP 400

### State Transitions

- [ ] **Slice 02 AC-10:** Mask survives mode switch (inpaint -> outpaint): maskData preserved
- [ ] **Slice 15 AC-3:** Clicking variation tool during inpaint: editMode -> null, maskData preserved
- [ ] **Slice 15 AC-5:** Returning to brush-edit after tool switch: mask visible again, fully preserved
- [ ] **Slice 07 AC-4:** Inpaint action with null maskData: fallback to instruction mode
- [ ] **Slice 09 AC-5:** Chat prompt in erase mode with mask: upgrades to inpaint
- [ ] **Slice 11 AC-5/6/7:** Click-to-edit with existing mask: confirmation dialog -> Ersetzen/Abbrechen
- [ ] **Slice 13 AC-3:** Outpaint with no directions selected: Send button disabled, inline hint shown

### Boundary Conditions

- [ ] **Slice 04 AC-7:** Clear-mask button disabled when maskData is null
- [ ] **Slice 04 AC-10:** Erase-action button disabled when maskData is null in erase mode
- [ ] **Slice 14 AC-1:** Brush size increase with `]`: clamped to max 100
- [ ] **Slice 14 AC-2:** Brush size decrease with `[`: clamped to min 1
- [ ] **Slice 14 AC-4:** Keyboard shortcuts inactive outside painting modes (null, instruction, outpaint, click-edit)
- [ ] **Slice 14 AC-6:** Ctrl+Z with empty undo stack: no error, no action
- [ ] **Slice 14 AC-8:** Keyboard shortcuts inactive when input/textarea/contenteditable has focus
- [ ] **Slice 14 AC-9:** CLEAR_MASK resets mask undo stack
- [ ] **Slice 01 AC-6:** seedModelSlotDefaults idempotent (second call no change)
- [ ] **Slice 03 AC-8:** MaskCanvas hidden/unmounted when editMode is null
- [ ] **Slice 03 AC-9:** Canvas resizes with image via ResizeObserver, mask data preserved
- [ ] **Slice 15 AC-1:** Prev/Next navigation disabled when mask exists (opacity-50, pointer-events-none, arrow keys suppressed)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | GenerationMode type flows to all consumers | 01 -> 02, 06a, 06b | Import succeeds, 7-member union accepted |
| 2 | Context state fields used by MaskCanvas | 02 -> 03 | Paint/erase works, state updates visible |
| 3 | MaskService functions called in handleCanvasGenerate | 05 -> 07 | Inpaint flow: validate+feather+scale+grayscale all execute |
| 4 | SSE events parsed with new action types | 06b -> 07 | Backend sends inpaint/erase/instruction/outpaint, frontend parses them |
| 5 | generateImages accepts new parameters | 06a -> 07, 09, 13 | maskUrl, outpaintDirections, outpaintSize pass through |
| 6 | Toolbar buttons dispatch SET_EDIT_MODE | 07 -> 08, 09, 11, 13, 15 | Each edit mode activates correctly |
| 7 | SAM API -> Click-to-Edit frontend | 10 -> 11 | Click produces mask overlay, transitions to painting state |
| 8 | OutpaintControls -> Outpaint integration | 12 -> 13 | Controls mounted when outpaint active, state read correctly |
| 9 | handleCanvasGenerate action-Switch extensibility | 07 -> 08, 13 | instruction and outpaint branches added without breaking inpaint |
| 10 | Mutual exclusion across all toolbar tools | 07 + 15 | Switching between edit/non-edit tools works correctly |
| 11 | Mask-Upload Pipeline reuse | 07 -> 09, 13 | Erase direct and outpaint use same R2 upload pattern |
| 12 | canvas-detail-view.tsx multi-slice composition | 03, 04, 09, 11, 13, 15 | All child components mount correctly, conditional rendering works |

---

## E2E Smoke Tests (Slice 16)

| # | Test | Dependencies | Mocking |
|---|------|-------------|---------|
| 1 | Inpaint: paint mask -> prompt -> image replaced | 07, 03, 04, 05, 06a, 06b | Replicate API mocked via page.route() |
| 2 | Erase: paint mask -> "Entfernen" -> image replaced | 07, 09, 05, 06a | Replicate API mocked |
| 3 | Instruction: prompt without mask -> image changed | 07, 08, 06a, 06b | Replicate API mocked |
| 4 | Click-to-Edit: click -> SAM mask -> prompt -> image replaced | 07, 10, 11, 06a, 06b | SAM API + Replicate API mocked |
| 5 | Outpaint: select direction -> prompt -> image extended | 07, 12, 13, 06a, 06b | Replicate API mocked |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- All API calls should be mocked for E2E tests (Replicate, SAM)
- Canvas painting simulation via Playwright mouse API (mouse.move, mouse.down, mouse.move, mouse.up)
- Test setup requires navigation to Canvas Detail-View with an existing generated image
