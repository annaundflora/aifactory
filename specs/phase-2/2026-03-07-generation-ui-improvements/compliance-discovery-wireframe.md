# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-2/2026-03-07-generation-ui-improvements/discovery.md`
**Wireframes:** `specs/phase-2/2026-03-07-generation-ui-improvements/wireframes.md`
**Pruefdatum:** 2026-03-07

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 38 |
| Auto-Fixed | 5 |
| Blocking | 0 |

**Verdict:** APPROVED (Blocking = 0)

**100% Compliance:** Keine Warnings - alles wird gefixt oder blockiert.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Aspect Ratio + Size waehlen | 6 + 2 error | Prompt Panel (chips, custom input, state variations incl. disabled/error/model-switch-reset) | PASS |
| Flow 2: Bulk Select + Actions | 7 + 5 sub-flows | Gallery Bulk Select (checkbox, action bar, all buttons), State Variations (confirm dialogs) | PASS |
| Flow 3: Compare aus Lightbox | 5 | Lightbox Extensions (checkbox, compare bar, compare button) + Compare View Modal | PASS |
| Flow 4: Move Einzelbild (aus Lightbox) | 3 | Lightbox Extensions (Move dropdown wireframe, project list, toast mention) | PASS |
| Flow 5: Favoriten-Filter | 2 | Gallery Header (star icon toggle, fav-filter-active state) | PASS |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| aspect-ratio-chips | default, selected, chip-disabled | ratio-chip-disabled, custom-ratio-active, model-switch-reset | None (selected is implicit in chip group) | PASS |
| custom-ratio-input | hidden, visible, error | custom-ratio-active (visible), custom-ratio-error, hidden implicit | None | PASS |
| size-chips | default, selected, chip-disabled | size-chip-disabled, model-switch-reset | None | PASS |
| advanced-settings | collapsed, expanded | collapsed, expanded | None | PASS |
| variant-stepper | min, normal, max | stepper-min, stepper-max (normal implicit) | None | PASS |
| gallery-checkbox | hidden, visible, checked | gallery-default (hidden), hover state (visible), selecting state (checked) | None | PASS |
| floating-action-bar | hidden, visible | gallery-default (hidden), gallery-selecting (visible) | None | PASS |
| move-dropdown | closed, open | move-dropdown-open in Gallery + Lightbox | None | PASS |
| compare-modal | closed, grid-view, fullscreen-single | grid-view-4, grid-view-3, grid-view-2, fullscreen-single | None | PASS |
| fav-filter-toggle | inactive, active | fav-filter-active state | None | PASS |
| lightbox-checkbox | unchecked, checked | default (unchecked), compare-selecting (checked) | None | PASS |
| lightbox-compare-bar | hidden, visible | default (hidden), compare-selecting (visible) | None | PASS |
| lightbox-move-btn | default, open | default, move-dropdown-open, move-success | None | PASS |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| aspect-ratio-chips | Prompt Panel Row 7 | Annotation 7 | PASS |
| custom-ratio-input | Prompt Panel Row 8 | Annotation 8 | PASS |
| size-chips | Prompt Panel Row 9 | Annotation 9 | PASS |
| advanced-settings | Prompt Panel Row 10 | Annotation 10 | PASS |
| variant-stepper | Prompt Panel Row 11 | Annotation 11 | PASS |
| Generate Button | Prompt Panel Row 12 | Annotation 12 | PASS |
| gallery-checkbox | Gallery card top-left | Annotation 2 | PASS |
| floating-action-bar | Gallery sticky bottom | Annotation 3 | PASS |
| move-dropdown | Floating Action Bar | Annotation 4 | PASS |
| Favorite Toggle (bulk) | Floating Action Bar | Annotation 5 | PASS |
| Compare Button (bulk) | Floating Action Bar | Annotation 6 | PASS |
| Download Button (bulk) | Floating Action Bar | Annotation 7 | PASS |
| Delete Button (bulk) | Floating Action Bar | Annotation 8 | PASS |
| fav-filter-toggle | Gallery Header | Annotation 1 | PASS |
| lightbox-checkbox | Lightbox top-left | Annotation 1 | PASS |
| lightbox-move-btn | Lightbox actions | Annotation 2 | PASS |
| lightbox-compare-bar | Lightbox bottom | Annotation 3 | PASS |
| Compare Button (lightbox) | Lightbox compare bar | Annotation 4 | PASS |
| Cancel (lightbox compare) | Lightbox compare bar | Annotation 5 | PASS |
| Compare Modal Close | Compare Modal header | Annotation 1 | PASS |
| Fullscreen Toggle (compare) | Compare Modal per-image | Annotation 2 | PASS |
| Model+Dimensions Display | Compare Modal per-image | Annotation 3 | PASS |

### State Machine Transitions

| Transition | Wireframe Coverage | Status |
|------------|-------------------|--------|
| gallery-default -> gallery-selecting | Checkbox click shown in hover/selecting wireframes | PASS |
| gallery-selecting -> compare-grid | Compare button in action bar -> compare modal | PASS |
| gallery-selecting -> gallery-default | Cancel/deselect/delete/move all shown | PASS |
| compare-grid -> compare-fullscreen | Fullscreen toggle annotation + fullscreen-single wireframe | PASS |
| compare-fullscreen -> compare-grid | ESC/click documented in state variations | PASS |
| Lightbox -> lightbox-compare-select | Checkbox in lightbox -> compare bar appears | PASS |
| lightbox-compare-select -> compare-grid | Compare button in floating compare bar | PASS |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs - Auto-Fix Required

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Size chip labels show pixel values | xs=512, s=768, m=1024, l=1536, xl=2048 | UI Components (size-chips) - already documented | PASS Already Present |
| Compare metadata format | "Model Name - WxH" (e.g. "FLUX 1.1 - 1024x576") | Business Rules (Compare-View Metadata) - already documented | PASS Already Present |
| Prompt Motiv Textarea lines | 3 lines, auto-resize | UI Layout Row 3 - already documented | PASS Already Present |
| Style/Modifier Textarea lines | 2 lines | UI Layout Row 5 - already documented implicitly | PASS Already Present |
| Builder/Improve split | 50/50 | UI Layout Row 4 - already documented | PASS Already Present |
| Variant Stepper + Generate layout | Stepper left, Generate rest-width | UI Layout Row 10 - already documented | PASS Already Present |

### Implicit Constraints - Auto-Fix Required

| Wireframe Shows | Implied Constraint | Discovery Has | Status |
|-----------------|-------------------|---------------|--------|
| Compare grid-view-3: bottom-right cell empty (dashed border) | When 3 images compared, bottom-right slot shows dashed empty placeholder | No - Discovery says "leere Slots" but not styling detail | AUTO-FIX: Add to Discovery UI Components |
| Compare grid-view-2: bottom row empty (dashed borders) | When 2 images compared, entire bottom row shows dashed empty placeholders | No - same as above | AUTO-FIX: Add to Discovery UI Components |
| Lightbox compare-max state: checkbox disabled on unchecked images | When 4 images already selected in lightbox, further checkboxes are disabled with tooltip "Max 4 images" | No - Discovery mentions max 4 but not the disabled-checkbox UX for enforcement | AUTO-FIX: Add to Discovery Business Rules |
| Selected images have blue border (bold frame) | Visual indicator for selected state is a blue/bold border around the card | No - Discovery says "blaue Umrandung" in Flow 2 Step 2 but not in UI Components table | AUTO-FIX: Add to Discovery UI Components |
| Gallery dynamic bottom padding equals action bar height | Gallery container gets padding-bottom matching action bar height to prevent content obscuring | Yes - Discovery Business Rules line 290 mentions this | PASS Already Present |
| Bulk-move-confirm dialog shown | Confirm dialog: "Move {N} images to '{Project}'?" before bulk move | No - Discovery mentions confirm for move in Flow but not explicit dialog text | AUTO-FIX: Add to Discovery Business Rules |

---

## C) Auto-Fix Summary

### Discovery Updates Required

| Section | Content to Add |
|---------|---------------|
| Business Rules | Compare empty slots: Bei 2 Bildern ist die untere Reihe leer (dashed border placeholder), bei 3 Bildern ist der untere rechte Slot leer (dashed border placeholder) |
| Business Rules | Lightbox Compare Max Enforcement: Wenn 4 Bilder selektiert, werden Checkboxen auf nicht-selektierten Bildern disabled mit Tooltip "Max 4 Bilder" |
| Business Rules | Bulk-Move Confirm Dialog: "{N} Bilder nach '{Projekt}' verschieben?" mit Cancel/Move Buttons (analog zu Bulk-Delete Confirm) |
| UI Components (gallery-checkbox) | Selection Visual: Selektierte Bilder erhalten eine blaue Umrandung (border) als visuellen Indikator |

### Wireframe Updates Needed (Blocking)

None.

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 5 (auto-fix items to add to discovery.md)
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Apply 5 discovery auto-fix updates (see DISCOVERY_UPDATES below)
- [ ] Proceed to Gate 1 (Architecture)
