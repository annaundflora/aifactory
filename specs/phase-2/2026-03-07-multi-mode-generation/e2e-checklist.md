# E2E Checklist: Multi-Mode Generation (img2img + Upscale)

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-09

---

## Pre-Conditions

- [ ] All slices APPROVED (Gate 2) — all 17 slices: APPROVED
- [ ] Architecture APPROVED (Gate 1)
- [ ] Integration Map has no MISSING INPUTS (confirmed: 0 missing inputs)
- [ ] DB migration applied: `drizzle/migrations/XXXX_add_generation_mode.sql`
- [ ] R2 bucket accessible, `NEXT_PUBLIC_R2_PUBLIC_URL` set
- [ ] `pnpm dev` starts without errors on `http://localhost:3000`

---

## Happy Path Tests

### Flow 1: img2img Generation (slice-14 → slice-09 → slice-06 → slice-02 → Replicate)

1. [ ] **slice-14:** Open a project workspace — PromptArea shows `ModeSelector` with "Text to Image" active; `ImageDropzone` and `StrengthSlider` are NOT in DOM
2. [ ] **slice-14:** Click "Image to Image" in ModeSelector — `ImageDropzone` and `StrengthSlider` appear; Prompt fields, Model selector, Variants and "Generate" button remain visible
3. [ ] **slice-12 + slice-08 + slice-03:** Drag a valid PNG image into `ImageDropzone` — component transitions: empty → uploading (progress visible) → preview (thumbnail, filename, dimensions, Remove button)
4. [ ] **slice-12:** After successful upload, `onUpload` receives an R2 URL starting with the R2 public URL prefix and containing `sources/{projectId}/`
5. [ ] **slice-13:** StrengthSlider shows default value 0.60, "Balanced" preset is active
6. [ ] **slice-13:** Click "Subtle" preset — value changes to 0.30; click "Creative" — value changes to 0.85; drag slider to 0.4 — no preset is active, value shows "0.40"
7. [ ] **slice-14:** Enter a prompt, set Strength to 0.6, keep Variants at 1
8. [ ] **slice-09 + slice-06:** Click "Generate" — `generateImages` action called with `generationMode: "img2img"`, `sourceImageUrl: <R2 URL>`, `strength: 0.6`
9. [ ] **slice-01 + slice-02:** A new `generations` row is created with `generationMode = 'img2img'` and `sourceImageUrl` populated
10. [ ] **slice-16:** The new img2img generation appears in the gallery with a `ModeBadge` showing "I"

### Flow 2: Upscale via PromptArea Mode (slice-14 → slice-09 → slice-07 → slice-02)

1. [ ] **slice-14:** Click "Upscale" in ModeSelector — `ImageDropzone` appears; Prompt fields, StrengthSlider, Model selector, Variants are NOT in DOM; button label changes to "Upscale"
2. [ ] **slice-12 + slice-08:** Upload an image in the Dropzone — same upload flow as Flow 1
3. [ ] **slice-14:** Scale selector shows "2x" as default; click "4x" to switch
4. [ ] **slice-09 + slice-07:** Click "Upscale" button — `upscaleImage` action called with `sourceImageUrl: <R2 URL>`, `scale: 4`; `GenerationService.upscale()` called with `UPSCALE_MODEL = "nightmareai/real-esrgan"`
5. [ ] **slice-01 + slice-02:** A new `generations` row created with `generationMode = 'upscale'`, `sourceImageUrl` populated; prompt is "Upscale 4x"
6. [ ] **slice-16:** The upscale generation appears in the gallery with a `ModeBadge` showing "U"

### Flow 3: Upscale via Lightbox (slice-17 → slice-09 → slice-07)

1. [ ] **slice-16:** Open any generation (txt2img or img2img) in the Lightbox
2. [ ] **slice-17:** Lightbox shows "img2img" and "Upscale" buttons in the action bar
3. [ ] **slice-17:** Click "Upscale" — a popover opens with "2x" and "4x" buttons
4. [ ] **slice-17 + slice-09:** Click "2x" — `upscaleImage` called with `scale: 2` and `sourceGenerationId` set to the generation ID; Toast "Upscaling..." appears; popover closes
5. [ ] **slice-01 + slice-02:** New `generations` row created with `generationMode = 'upscale'` and `sourceGenerationId` = ID of the source generation; prompt is "{original prompt} (Upscale 2x)"
6. [ ] **slice-16:** New upscale generation appears in gallery with "U" badge

### Flow 4: Cross-Mode — Lightbox to img2img (slice-17 → slice-10 → slice-14)

1. [ ] **slice-16:** Open a txt2img generation in the Lightbox
2. [ ] **slice-17:** Lightbox shows "img2img" button
3. [ ] **slice-17 + slice-10:** Click "img2img" button — `setVariation` called with `{ targetMode: "img2img", sourceImageUrl: <imageUrl of generation>, promptMotiv, modelId, ... }`; Lightbox closes
4. [ ] **slice-14 + slice-10:** PromptArea reacts to `WorkspaceVariationState` change — mode switches to "img2img", `ImageDropzone` shows preview of the generation image, Prompt fields are pre-filled
5. [ ] **slice-10:** `clearVariation` is called after state consumed (no loop)
6. [ ] User adjusts Strength, clicks "Generate" — standard img2img flow executes

### Flow 5: img2img Variation from Lightbox (slice-17 → slice-10 → slice-14)

1. [ ] Open an img2img-generated image in the Lightbox
2. [ ] **slice-17:** Lightbox shows "img2img", "Upscale", and "Variation" buttons
3. [ ] **slice-17 + slice-10:** Click "Variation" — `setVariation` called with `sourceImageUrl` from the generation's `sourceImageUrl` field (original source, not the generated imageUrl), `targetMode: "img2img"`
4. [ ] **slice-14:** PromptArea switches to img2img mode with original source image pre-loaded in `ImageDropzone`

### Flow 6: Gallery Filter (slice-15 + slice-16)

1. [ ] **slice-16:** Initial gallery state shows FilterChips with "Alle" active; all completed generations visible with mode badges (T, I, U)
2. [ ] **slice-16 + slice-15:** Click "Image to Image" chip — only img2img generations remain; "Alle" chip becomes inactive, "Image to Image" chip becomes active
3. [ ] **slice-16 + slice-15:** Click "Upscale" chip — only upscale generations visible; if none exist, "No Upscale generations yet" message shown
4. [ ] **slice-16 + slice-15:** Click "Alle" chip — all generations visible again
5. [ ] **slice-16:** Filter state is per-session (persists within page visit, reset on reload)

---

## Edge Cases

### Error Handling

- [ ] **slice-08 AC-4:** Upload a GIF file → `{ error: "Nur PNG, JPG, JPEG und WebP erlaubt" }` returned; R2 not called; `ImageDropzone` shows error state
- [ ] **slice-08 AC-6:** Upload a file > 10MB → `{ error: "Datei darf maximal 10MB groß sein" }` returned; `ImageDropzone` shows error state
- [ ] **slice-08 AC-7:** Upload a file at exactly 10MB → upload succeeds
- [ ] **slice-09 AC-1:** Call `generateImages` with `generationMode: "img2img"` and no `sourceImageUrl` → `{ error: "Source-Image ist erforderlich fuer img2img" }` returned; no `GenerationService.generate()` call
- [ ] **slice-09 AC-2:** Call `generateImages` with `strength: 1.5` → `{ error: "Strength muss zwischen 0 und 1 liegen" }` returned
- [ ] **slice-09 AC-6:** Call `upscaleImage` with `scale: 3` → `{ error: "Scale muss 2 oder 4 sein" }` returned
- [ ] **slice-17 AC-8:** `upscaleImage` returns `{ error: "..." }` from Lightbox → error Toast shown; Lightbox stays open
- [ ] **slice-07 AC-7:** Error during fire-and-forget upscale processing → generation status set to "failed"; no error propagated to caller
- [ ] **slice-14 AC-8:** Click "Generate" in img2img mode without uploading an image → button is disabled, `generateImages` not called
- [ ] **slice-14 AC-11:** Click "Upscale" button in upscale mode without uploading an image → button is disabled, `upscaleImage` not called

### State Persistence / Mode Switching

- [ ] **slice-14 AC-4:** Enter prompt "sunset landscape" in img2img mode → switch to txt2img → switch back to img2img → prompt "sunset landscape" is still present
- [ ] **slice-14 AC-5:** Enter prompt "ocean waves" in txt2img mode → switch to upscale → switch back to txt2img → prompt "ocean waves" is restored
- [ ] **slice-14 AC-6:** Upload image in img2img mode → switch to upscale → switch back to img2img → `ImageDropzone` restores to preview state with the previously uploaded image
- [ ] **discovery State Persistence Matrix:** img2img → upscale carries the source image (ImageDropzone in upscale mode shows the same image)

### Model Auto-Switch

- [ ] **slice-14 AC-12:** Select a model that does not support img2img (no `image`, `image_prompt`, or `init_image` in schema) → switch ModeSelector to "Image to Image" → model auto-switches to first compatible model; Toast: "Model switched to {displayName} (supports img2img)" shown
- [ ] **slice-11 AC-7:** If no compatible img2img model exists → "Image to Image" segment has `disabledModes` prop causing it to be non-clickable

### Upscale Mode Specifics

- [ ] **slice-07 AC-8:** Invalid scale value (not 2 or 4) → error thrown before DB record creation
- [ ] **slice-17 AC-3:** Opening an upscale-generated image in Lightbox → "Upscale" and "Variation" buttons are NOT visible; only "img2img" (and Download, Fav, Delete) are visible

### Backwards Compatibility

- [ ] **slice-02 AC-1 / slice-06 AC-1 / slice-09 AC-5:** Existing txt2img generation flow (no new fields) continues to work without change; `generationMode` defaults to "txt2img"
- [ ] **slice-03 AC-1 / AC-4:** Existing `upload()` calls without `contentType` parameter continue to use `"image/png"` default
- [ ] **slice-01 AC-6:** All existing columns on `generations` table remain unchanged; total index count is 5 (was 4)

### Variant Count for img2img

- [ ] **slice-06 AC-9:** Set Variants to 3 in img2img mode → click "Generate" → 3 separate generation records created, each with `generationMode: "img2img"` and the same `sourceImageUrl`

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | DB schema → DB queries | slice-01 → slice-02 | `createGeneration` with new fields inserts without error; select returns new fields |
| 2 | Storage upload with contentType | slice-03 → slice-08 | R2 object for JPEG has `Content-Type: image/jpeg` header |
| 3 | supportsImg2Img schema detection | slice-04 → slice-06 | img2img generation sets correct parameter (`image`, `image_prompt`, or `init_image`) based on model |
| 4 | UPSCALE_MODEL constant | slice-05 → slice-07 | Replicate called with `nightmareai/real-esrgan` for upscale |
| 5 | uploadSourceImage → ImageDropzone | slice-08 → slice-12 | Component shows preview after upload; `onUpload` callback receives R2 URL |
| 6 | All server actions → PromptArea | slice-09 → slice-14 | PromptArea calls correct action with correct parameters per mode |
| 7 | WorkspaceState extension | slice-10 → slice-14 + slice-17 | Cross-mode flows transfer data correctly through shared state |
| 8 | Sub-components → PromptArea | slice-11,12,13 → slice-14 | All three components render and interact within PromptArea |
| 9 | FilterChips+ModeBadge → gallery | slice-15 → slice-16 | Gallery filters correctly; badges show correct letter for each mode |
| 10 | Lightbox upscale → service | slice-17 → slice-09 → slice-07 | Lightbox upscale creates a real DB record with `sourceGenerationId` |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| — | — | — |

**Notes:**
- Run unit tests for all slices first: `pnpm test`
- All 17 slice tests must pass before E2E testing
- DB migration must be applied before any runtime testing
- Shadcn Popover must be installed (`npx shadcn@latest add popover`) before slice-17 is functional
