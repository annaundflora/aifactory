# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-2/2026-03-07-multi-mode-generation/discovery.md`
**Wireframes:** `specs/phase-2/2026-03-07-multi-mode-generation/wireframes.md`
**Pruefdatum:** 2026-03-07
**Durchlauf:** 2 (Re-Check nach Fixes)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 28 |
| Auto-Fixed | 1 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles gefixt oder blockiert.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: img2img Generation | 12 | Prompt Area img2img (empty + preview), Gallery with badges | PASS |
| Flow 2: Upscale via Modus | 8 | Prompt Area Upscale (empty + preview), Gallery | PASS |
| Flow 3: Upscale via Lightbox | 6 | Lightbox txt2img, Upscale Popover, processing toast | PASS |
| Flow 4: Cross-Mode Lightbox->img2img | 7 | Lightbox txt2img, Cross-Mode Transition screen | PASS |
| Flow 5: img2img Variation | 7 | Lightbox img2img image, Annotation 4 (original source) | PASS |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| ModeSelector | txt2img, img2img, upscale | All 3 shown as active in respective screens | -- | PASS |
| ImageDropzone (img2img) | empty, drag-over, uploading, preview, error | All 5 in state variations table (lines 173-179) | -- | PASS |
| ImageDropzone (upscale) | empty, drag-over, uploading, preview, error | All 5 in state variations table (lines 239-247) | -- | PASS |
| StrengthSlider | 0.0-1.0, Presets: Subtle/Balanced/Creative | Shown with presets + slider + value display | -- | PASS |
| ScaleSelector | 2x (default), 4x | Shown in upscale mode + lightbox popover | -- | PASS |
| FilterChips | Alle, Text to Image, Image to Image, Upscale | All 4 + empty filter result state | -- | PASS |
| ModeBadge | T, I, U | All 3 shown on gallery cards | -- | PASS |
| UpscalePopover | closed, open | Both states shown (lines 339-351) | -- | PASS |
| LightboxImg2ImgButton | idle | Shown in lightbox actions (line 336) | -- | PASS |
| Lightbox Actions (txt2img) | Variation, img2img, Upscale, Download, Fav, Delete | All shown (lines 329, 377) | -- | PASS |
| Lightbox Actions (img2img) | Variation (diff behavior), img2img, Upscale, Download, Fav, Delete | All shown (lines 364, 378) | -- | PASS |
| Lightbox Actions (upscale) | img2img, Download, Fav, Delete (no Variation, no Upscale) | Correct subset shown (line 379) | -- | PASS |
| Upscale Lightbox State | idle, popover-open, processing, error | popover-open shown, processing as toast (line 381) | -- | PASS |
| Gallery Empty Filter | empty filter result | Wireframe with "No {mode} generations yet" (lines 293-308) | -- | PASS |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| ModeSelector (Segmented Control) | Prompt Area - all 3 modes | Annotation 1 in each screen | PASS |
| ImageDropzone | Prompt Area img2img + upscale | Annotation 2 | PASS |
| StrengthSlider + Presets | Prompt Area img2img | Annotation 3 | PASS |
| ScaleSelector (toggle) | Prompt Area upscale + Lightbox popover | Annotation 3 (upscale), Annotation 3 (popover) | PASS |
| FilterChips | Gallery | Annotation 1 | PASS |
| ModeBadge | Gallery cards | Annotation 2 | PASS |
| UpscalePopover | Lightbox actions | Annotation 2 + 3 | PASS |
| LightboxImg2ImgButton | Lightbox actions | Annotation 1 | PASS |
| Generate button (disabled/enabled) | Prompt Area img2img | State variations table | PASS |
| Upscale button (disabled/enabled) | Prompt Area upscale | State variations table | PASS |
| Remove button [x] | Dropzone preview state | Shown in preview wireframes | PASS |
| Variation button (img2img context) | Lightbox img2img image | Annotation 4 | PASS |

---

## B) Wireframe -> Discovery (Rueckfluss)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Dropzone preview layout: thumb left, name+dims right, remove bottom-right | Layout pattern | UI Components (ImageDropzone states) | PASS - Already described |
| StrengthSlider preset values | 0.3, 0.6, 0.85 | UI Components (StrengthSlider) | PASS - Already present |
| ScaleSelector default | 2x | UI Components (ScaleSelector) | PASS - Already present |
| FilterChips single-select behavior | Only one chip active | UI Components (FilterChips) | PASS - Already present |
| Popover layout: vertical list 2x/4x | Vertical options | UI Components (UpscalePopover) | PASS - Adequately described |
| Panel width | w-80 | UI Layout (line 160) | PASS - Already present |
| Element order img2img | ModeSelector->Dropzone->Strength->Tabs->Prompt->Model->Variants->Generate | UI Layout (line 162) | PASS - Already present |
| Element order upscale | ModeSelector->Dropzone->Scale->Upscale | UI Layout (line 164) | PASS - Already present |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| Empty filter message "No {mode} generations yet" | Message template adapts per selected filter mode | Business Rules | AUTO-FIX: Add to Discovery |
| Dropzone dimensions display "1024x768" | Image metadata (w x h) must be read on upload | UI Components (ImageDropzone preview) | PASS - "Dimensionen" mentioned |
| Cross-mode source label "(from gen)" | Source origin distinguishable from manual upload | UI Components | PASS - Implied by flow context |

---

## C) Auto-Fix Summary

### Discovery Updates Needed

| Section | Content to Add |
|---------|---------------|
| Business Rules | Empty filter result message template: "No {mode} generations yet" where {mode} adapts to selected FilterChip (e.g. "No Upscale generations yet", "No Image to Image generations yet") |

**Note:** This agent ran in READ-ONLY mode. The update above must be applied manually.

### Wireframe Updates Needed (Blocking)

None. All previous blocking issues from Durchlauf 1 have been resolved:
1. ~~LightboxImg2ImgButton disabled state~~ -- Fixed: Discovery updated to idle-only (Lightbox always has image context)
2. ~~Upscale Dropzone missing states~~ -- Fixed: All 5 states now listed (lines 239-247)
3. ~~Empty filter result missing~~ -- Fixed: Wireframe added (lines 293-308)

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 1 (empty filter message template)
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Add empty filter message template to Discovery Business Rules section
