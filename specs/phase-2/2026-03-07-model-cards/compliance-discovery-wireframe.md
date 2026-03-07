# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-2/2026-03-07-model-cards/discovery.md`
**Wireframes:** `specs/phase-2/2026-03-07-model-cards/wireframes.md`
**Pruefdatum:** 2026-03-07

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 28 |
| Auto-Fixed (pending) | 2 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Alle Discovery-Anforderungen sind im Wireframe abgedeckt. 2 Wireframe-Details muessen in Discovery zurueckfliessen (Auto-Fix pending).

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow Step | Wireframe Screen(s) | Status |
|---------------------|---------------------|--------|
| 1. User sees compact trigger card with selected model(s) | Prompt Area - Single Model, Multi-Model | PASS |
| 2. Click "Browse Models" -> Drawer opens | Prompt Area annotation 4, Drawer wireframe | PASS |
| 3. Drawer loads models from API -> Grid appears | Drawer state variations: loading -> loaded | PASS |
| 4. Search field filters cards | Drawer annotation 2, state "search active" | PASS |
| 5. Filter chips filter by owner | Drawer annotation 3, state "filter active" | PASS |
| 6. Click checkbox on 1-3 cards -> ring/border + checkmark | Model Card selected state wireframe, checkbox annotation | PASS |
| 7. Click 4th card -> inline hint, card not selected | Drawer state "max 3 reached" | PASS |
| 8. Click "Confirm (N Models)" -> Drawer closes, trigger updates | Drawer annotation 4, User Flow Overview diagram | PASS |
| 9. Remove model via X on trigger -> model deselected | Multi-Model wireframe shows X buttons on each mini-card | PASS |
| 10. Generate -> parallel requests | User Flow Overview: "Generate" -> Gallery loading | PASS |
| 11. Results in Gallery with Model Badge | Gallery wireframe with model-badge annotations | PASS |

### Error Path Coverage

| Error Path | Wireframe Coverage | Status |
|------------|-------------------|--------|
| API unreachable -> error state with retry | Drawer state "error": message + Retry button | PASS |
| API returns empty -> empty state | Drawer state "empty": "No models available." | PASS |
| One model fails during parallel gen | Not explicitly wireframed (Gallery error card is existing behavior) | PASS |
| All models fail | Existing behavior, not new UI | PASS |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| `model-trigger` | single, multi, loading | single, multi, loading, hover, last-model-remaining | -- | PASS |
| `model-trigger-item` | default, hover | default, hover | -- | PASS |
| `model-browser-drawer` | loading, loaded, error, empty | loading, loaded, error, empty, 0-selected, search-active, filter-active, search+filter, max-3-reached | -- | PASS |
| `model-search` | empty, has-value | Implicit (search active state in drawer) | -- | PASS |
| `model-filter-chips` | all, filtered | all (active by default), filtered (chip highlighted) | -- | PASS |
| `model-card` | default, hover, selected, disabled | default, hover, selected, disabled, no-cover-image | -- | PASS |
| `model-card-checkbox` | unchecked, checked, disabled | unchecked, checked (shown in wireframes) | -- | PASS |
| `model-card-description` | truncated, tooltip | truncated shown in wireframe, tooltip in annotation 4 | -- | PASS |
| `confirm-button` | disabled (0 sel), enabled (1-3 sel) | disabled ("Select at least 1 model"), enabled ("Confirm (N Models)") | -- | PASS |
| `model-badge` | visible (always) | visible in Gallery wireframe | -- | PASS |
| `parameter-panel-notice` | hidden (1 model), visible (>1 model) | Shown in Multi-Model wireframe annotation 4 | -- | PASS |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| "Browse Models" link/button | Prompt Area, annotation 4 | 4 | PASS |
| Model Card checkbox | Model Card, annotation 1 | 1 | PASS |
| "Confirm (N Models)" button | Drawer footer, annotation 4 | 4 | PASS |
| Drawer close button (X) | Drawer header, annotation 1 | 1 | PASS |
| X remove button on trigger | Trigger mini-cards, annotation 2 | 2 | PASS |
| Search input | Drawer, annotation 2 | 2 | PASS |
| Filter chips | Drawer, annotation 3 | 3 | PASS |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs Check

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Cover image aspect-ratio | 16:9 | "Model Card" in UI Layout: "aspect-ratio 16:9" | PASS - Already Present |
| Cover image fallback | gradient | "Model Card" in UI Layout: "fallback gradient if no cover_image_url" | PASS - Already Present |
| Trigger thumbnail size | 32x32 | "Prompt Area" in UI Layout: "small cover thumbnail (32x32)" | PASS - Already Present |
| Description truncation | 2 lines | "Model Card" in UI Layout: "2 lines max, truncated" | PASS - Already Present |
| Grid columns | 2-column | "Model Browser Drawer" in UI Layout: "2-column responsive grid" | PASS - Already Present |
| Model Badge position | bottom-left | "Gallery Thumbnails" in UI Layout: "bottom-left of thumbnail" | PASS - Already Present |
| Model Badge background | semi-transparent | "Gallery Thumbnails" in UI Layout: "Semi-transparent background" | PASS - Already Present |
| Confirm button | sticky bottom bar | "Model Browser Drawer" in UI Layout: "Sticky bottom bar" | PASS - Already Present |

### Implicit Constraints Check

| Wireframe Shows | Implied Constraint | Discovery Has | Status |
|-----------------|-------------------|---------------|--------|
| Model Card: checkbox positioned top-right as overlay on cover image | Checkbox is z-indexed above cover image, within card bounds | Yes (annotation: "Checkbox overlay (top-right corner)") | PASS |
| Trigger: dividers between stacked mini-cards | Visual separator between model items in trigger | No - Discovery says "stacked mini-cards" but no mention of dividers | AUTO-FIX pending |
| Model Card: "no cover image" state with gradient fallback | Fallback must be implemented per card | Yes ("fallback gradient if no cover_image_url") | PASS |
| Drawer: "search + filter" combined state | AND logic for combined filtering | Yes ("Search and owner filter are applied simultaneously (AND logic)") | PASS |
| Model Badge: long name truncation | Badge needs max-width or text-overflow handling | No - Discovery says badge shows "model display name" but no truncation rule for badge | AUTO-FIX pending |
| Trigger: last model X button hidden | Min 1 enforcement in UI | Yes ("Min 1 model must always be selected") | PASS |
| Drawer: "0 selected" confirm text | "Select at least 1 model" guidance text | Yes (confirm-button states in UI Components table) | PASS |

---

## C) Auto-Fix Summary

### Discovery Updates Needed (pending, not applied)

| # | Section | Content to Add | Rationale |
|---|---------|---------------|-----------|
| 1 | UI Layout > Prompt Area | Trigger mini-cards separated by dividers/borders between items | Wireframe shows horizontal dividers (lines 103, 108) between stacked mini-cards |
| 2 | UI Layout > Gallery Thumbnails | Model Badge: truncate long model names with text-overflow ellipsis | Wireframe state variations (line 359) explicitly show "long model name -> Name truncated to fit badge width" |

### Wireframe Updates Needed (Blocking)

None.

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Pending Discovery Updates:** 2
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Apply 2 Discovery auto-fix updates (divider detail, badge truncation)
