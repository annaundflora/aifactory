# E2E Checklist: Canvas Detail-View & Editing Flow

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-13

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 18/18 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 missing

---

## Happy Path Tests

### Flow 1: Gallery -> Detail-View -> Iteration via Tool (Variation)

1. [ ] **Slice 05:** User opens Gallery with at least one completed image
2. [ ] **Slice 05/06:** User clicks on a Gallery image (GenerationCard) -- animated transition plays, Detail-View appears fullscreen
3. [ ] **Slice 05:** Detail-View shows 3-column layout: Toolbar (48px left), Canvas (center), Chat (right)
4. [ ] **Slice 08:** Current image is displayed centered with `object-contain` in canvas area
5. [ ] **Slice 08:** Sibling thumbnails appear below image (if batch has multiple images)
6. [ ] **Slice 07:** Toolbar shows 6 icons vertically: Variation, img2img, Upscale, Download, Delete, Details
7. [ ] **Slice 07:** User clicks Variation icon -- icon becomes active (highlighted)
8. [ ] **Slice 11:** Variation Popover appears next to icon with pre-filled prompt, Strength dropdown (Subtle/Balanced/Creative), Count (1-4), Generate button
9. [ ] **Slice 11:** User selects "Creative" strength, count 2
10. [ ] **Slice 14:** User clicks Generate -- Popover closes, loading overlay appears on canvas image ("Generating" + spinner)
11. [ ] **Slice 14:** All toolbar icons become disabled, chat input becomes disabled
12. [ ] **Slice 14:** Polling detects completed generation -- new image replaces current, loading overlay disappears
13. [ ] **Slice 14:** Previous image is pushed onto undo stack
14. [ ] **Slice 15:** User presses Cmd+Z -- previous image is restored, current goes to redo stack
15. [ ] **Slice 15:** User presses Cmd+Shift+Z -- redo image is restored

### Flow 2: Detail-View -> Iteration via Chat

1. [ ] **Slice 09:** Chat panel is visible on the right (expanded, 320-480px width)
2. [ ] **Slice 09:** First message shows Init-Message with image context (Model, Prompt, Steps, CFG)
3. [ ] **Slice 17:** Session is automatically created via POST /api/assistant/canvas/sessions
4. [ ] **Slice 09/17:** User types "Mach den Hintergrund blauer" and clicks Send
5. [ ] **Slice 17:** Message appears as user bubble (right-aligned), SSE stream opens
6. [ ] **Slice 17:** Streaming indicator visible while bot response streams in
7. [ ] **Slice 17:** Bot responds with clarification chips: ["Subtil", "Dramatisch"]
8. [ ] **Slice 09:** Chips appear as clickable buttons below bot message
9. [ ] **Slice 17:** User clicks "Dramatisch" -- chip text sent as new message
10. [ ] **Slice 16/17:** Agent triggers generation, SSE `canvas-generate` event received
11. [ ] **Slice 17/14:** `generateImages()` called with agent-provided params, loading state activates
12. [ ] **Slice 14:** Polling detects completion -- new image replaces current, old to undo stack
13. [ ] **Slice 17:** Chat shows text confirmation (no thumbnail -- image appears in canvas only)

### Flow 3: Detail-View -> img2img with References

1. [ ] **Slice 07:** User clicks img2img icon in toolbar
2. [ ] **Slice 12:** Large img2img popover appears with: References section [0/5], Prompt fields (Motiv + Style/Modifier), Variants counter, Generate button
3. [ ] **Slice 12:** User adds reference image via dropzone -- slot appears with Role dropdown and Strength dropdown
4. [ ] **Slice 12:** User sets role to "style", strength to "strong"
5. [ ] **Slice 12:** User types prompt in Motiv field, sets variants to 2
6. [ ] **Slice 14:** User clicks Generate -- popover closes, loading overlay appears
7. [ ] **Slice 14:** Generation completes, new image replaces current

### Flow 4: Navigation within Detail-View

1. [ ] **Slice 08:** User clicks a sibling thumbnail -- main image switches, no popover state lost
2. [ ] **Slice 08:** User clicks Next button -- switches to next (older) gallery image, siblings update
3. [ ] **Slice 09:** Chat shows context separator with new image context
4. [ ] **Slice 08:** At first (newest) image -- Prev button is hidden
5. [ ] **Slice 08:** At last (oldest) image -- Next button is hidden
6. [ ] **Slice 05:** User presses ESC (no input focused) -- animated transition back to Gallery
7. [ ] **Slice 05:** User clicks Back button -- animated transition back to Gallery

### Flow 5: Upscale

1. [ ] **Slice 07:** User clicks Upscale icon in toolbar
2. [ ] **Slice 13:** Upscale popover appears with "2x Upscale" and "4x Upscale" buttons
3. [ ] **Slice 14:** User clicks "4x Upscale" -- popover closes, loading state
4. [ ] **Slice 14:** `upscaleImage()` called with scale 4 and hardcoded `nightmareai/real-esrgan`
5. [ ] **Slice 14:** Upscale completes -- new image replaces current, original in undo stack

### Flow 6: Details Overlay

1. [ ] **Slice 07:** User clicks Details icon in toolbar
2. [ ] **Slice 10:** Details overlay expands at top of canvas area, pushes content down
3. [ ] **Slice 10:** Shows: full prompt text, Model name, Steps, CFG, Seed, Size
4. [ ] **Slice 10:** ProvenanceRow shows reference inputs (if any)
5. [ ] **Slice 10:** User clicks Hide button -- overlay collapses, canvas returns to full height

### Flow 7: Download and Delete

1. [ ] **Slice 07:** User clicks Download icon -- file download starts immediately (no popover)
2. [ ] **Slice 07:** User clicks Delete icon -- AlertDialog appears: "Delete Image?" / "This action cannot be undone."
3. [ ] **Slice 07:** User clicks Cancel -- dialog closes, image unchanged
4. [ ] **Slice 07:** User clicks Delete -- `onDelete` callback fires

### Flow 8: Model Selector

1. [ ] **Slice 14:** Model-Selector in header shows current image's model
2. [ ] **Slice 14:** User changes model to a different one
3. [ ] **Slice 14:** Variation generation uses the newly selected model
4. [ ] **Slice 14:** User selects a non-img2img model -- auto-switch to first compatible model, toast shown

### Flow 9: Lightbox Removal

1. [ ] **Slice 18:** No lightbox imports remain in workspace-content.tsx
2. [ ] **Slice 18:** No `lightboxOpen` or `lightboxIndex` state variables
3. [ ] **Slice 18:** lightbox-modal.tsx is deleted
4. [ ] **Slice 18:** lightbox-navigation.tsx is deleted
5. [ ] **Slice 18:** provenance-row.tsx is preserved and functional
6. [ ] **Slice 18:** `pnpm tsc --noEmit` compiles without errors

---

## Edge Cases

### Error Handling

- [ ] Generation fails (status: "failed") -- Toast notification, image unchanged, chat shows error message
- [ ] Chat agent timeout (60s no SSE event) -- Chat shows "Keine Antwort. Bitte erneut versuchen."
- [ ] Chat SSE error event -- Error description shown as error bot bubble
- [ ] Network error during generation -- Toast: "Verbindungsfehler"
- [ ] Upscale icon disabled when image too large -- Tooltip: "Image too large for upscale"
- [ ] Chat validation: empty content -- HTTP 422
- [ ] Chat validation: content > 5000 chars -- HTTP 422
- [ ] Chat rate limit: >30 msg/min -- HTTP 429
- [ ] Chat session limit: 100 messages -- HTTP 400

### State Transitions

- [ ] `gallery` -> `transitioning-in` -> `detail-idle` (happy path open)
- [ ] `detail-idle` -> `detail-tool-open` (tool click)
- [ ] `detail-tool-open` -> `detail-generating` (Generate click)
- [ ] `detail-generating` -> `detail-idle` (generation completed)
- [ ] `detail-generating` -> `detail-idle` (generation failed)
- [ ] `detail-idle` -> `detail-chat-active` (chat send)
- [ ] `detail-chat-active` -> `detail-generating` (agent triggers generation)
- [ ] `detail-chat-active` -> `detail-idle` (agent responds text-only)
- [ ] `detail-idle` -> `transitioning-out` -> `gallery` (Back/ESC)
- [ ] `detail-tool-open` -> `detail-idle` (click outside popover)
- [ ] `detail-tool-open` -> `detail-tool-open` (switch tool)

### Boundary Conditions

- [ ] Undo stack at max 20 entries -- oldest entry removed on push
- [ ] Undo with empty stack -- no-op (button disabled)
- [ ] Redo with empty stack -- no-op (button disabled)
- [ ] New generation clears redo stack
- [ ] Single image in gallery -- both Prev/Next buttons hidden
- [ ] Generation with batchId NULL (old data) -- no sibling thumbnails shown
- [ ] `getSiblingsByBatchId(null)` -- returns empty array (no DB call)
- [ ] ESC pressed while input has focus -- ESC ignored, detail-view stays open
- [ ] Cmd+Z pressed while input has focus -- browser text-undo, not canvas undo
- [ ] Chat panel collapsed to 48px -- expand on click
- [ ] Chat panel resize constrained to 320-480px
- [ ] Browser without View Transitions API support -- instant transition (graceful degradation)
- [ ] 5 references in img2img -- dropzone disabled
- [ ] Variants counter boundaries: min 1, max 4

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | batchId flows from schema to sibling UI | 01 -> 02 -> 04 -> 08 | Generate 3 images, open detail-view, verify 3 siblings shown |
| 2 | Context Provider wraps Detail-View | 03 -> 05 | Open detail-view, verify useCanvasDetail() works in child components |
| 3 | Toolbar activeToolId drives popovers | 07 -> 10, 11, 12, 13 | Click each tool icon, verify correct popover opens |
| 4 | Popover callbacks trigger generation | 11/12/13 -> 14 | Click Generate in any popover, verify generateImages() called |
| 5 | Generation result pushes undo stack | 14 -> 15 | Generate image, verify undo button becomes enabled |
| 6 | Chat SSE triggers in-place generation | 16 -> 17 -> 14 | Send chat message that triggers generation, verify image replaces |
| 7 | View Transitions animate Gallery/Detail switch | 05 -> 06 | Click image in gallery, verify smooth animation to detail-view |
| 8 | Lightbox fully replaced by Canvas Detail-View | 05 + 18 | Verify no lightbox code remains, detail-view works for all image clicks |
| 9 | Prev/Next updates chat context | 08 -> 09 | Navigate to next image, verify chat shows context separator |
| 10 | Model-Selector shared across variation + img2img | 14 -> 11, 12 | Change model in header, generate via variation, verify new model used |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**

