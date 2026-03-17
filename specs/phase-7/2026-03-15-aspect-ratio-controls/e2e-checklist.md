# E2E Checklist: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-16

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 7/7 APPROVED
- [x] Architecture APPROVED (Gate 1) -- APPROVED, 0 blocking issues
- [x] Integration Map has no MISSING INPUTS -- 0 missing inputs

---

## Happy Path Tests

### Flow 1: Prompt Panel txt2img -- Select Aspect Ratio and Generate

1. [ ] **Slice 01:** `resolveModel` is importable from `@/lib/utils/resolve-model` and `prompt-area.tsx` compiles without inline `resolveModel`
2. [ ] **Slice 02:** `useModelSchema("black-forest-labs/flux-schnell")` returns a schema with `aspect_ratio` enum property
3. [ ] **Slice 03:** `ParameterPanel` with schema containing `aspect_ratio` + `megapixels` + `quality` renders: `aspect_ratio` and `megapixels` visible (Primary), `quality` hidden (Advanced collapsed), `prompt` excluded
4. [ ] **Slice 04:** In txt2img mode, ParameterPanel appears between TierToggle and Variants-Stepper showing aspect_ratio dropdown
5. [ ] **Slice 04:** User selects "16:9" from aspect_ratio dropdown -- `imageParams` state updates to `{ aspect_ratio: "16:9" }`
6. [ ] **Slice 05:** User clicks Generate -- `generateImages()` is called with `params: { ...modelParams, aspect_ratio: "16:9" }`
7. [ ] **Slice 05:** Generated image uses 16:9 aspect ratio (visible in generation details / modelParams)

### Flow 2: Prompt Panel img2img -- Select Multiple Params and Generate

1. [ ] **Slice 04:** In img2img mode with Nano Banana 2 model, ParameterPanel shows `aspect_ratio` and `resolution` as Primary Controls
2. [ ] **Slice 04:** User selects `aspect_ratio: "3:2"` and `resolution: "2K"`
3. [ ] **Slice 05:** User clicks Generate -- `generateImages()` is called with `params` containing both `aspect_ratio: "3:2"` and `resolution: "2K"`

### Flow 3: Canvas Variation Popover -- Select Aspect Ratio and Generate

1. [ ] **Slice 06:** Variation Popover shows ParameterPanel between TierToggle/MaxQualityToggle and Generate button
2. [ ] **Slice 06:** User selects `aspect_ratio: "16:9"` in Variation Popover
3. [ ] **Slice 06:** User clicks Generate -- `onGenerate` callback receives `VariationParams` with `imageParams: { aspect_ratio: "16:9" }`
4. [ ] **Slice 07:** `handleVariationGenerate` calls `generateImages()` with `params: { prompt_strength: <number>, aspect_ratio: "16:9" }`

### Flow 4: Canvas Img2img Popover -- Select Resolution and Generate

1. [ ] **Slice 06:** Img2img Popover shows ParameterPanel between Tier section and Generate button
2. [ ] **Slice 06:** User selects `resolution: "2K"` in Img2img Popover
3. [ ] **Slice 06:** User clicks Generate -- `onGenerate` callback receives `Img2imgParams` with `imageParams: { resolution: "2K" }`
4. [ ] **Slice 07:** `handleImg2imgGenerate` calls `generateImages()` with `params: { resolution: "2K" }`

### Flow 5: Advanced Parameters

1. [ ] **Slice 03:** ParameterPanel with GPT Image 1.5 schema shows `aspect_ratio` (Primary) and `quality`, `background`, `input_fidelity` (Advanced, collapsed)
2. [ ] **Slice 03:** User clicks Advanced toggle -- Advanced section expands showing quality/background/input_fidelity dropdowns
3. [ ] **Slice 04/05:** User selects advanced param values and generates -- all selected values flow to `generateImages()`

---

## Edge Cases

### Error Handling

- [ ] **Slice 02 AC-3:** Schema fetch fails -- `useModelSchema` returns `{ error: "..." }`, no throw
- [ ] **Slice 04 AC-8:** Schema error in prompt-area -- ParameterPanel NOT rendered, Generate button still works
- [ ] **Slice 06 AC-9:** Schema error in canvas popover -- ParameterPanel NOT rendered, Generate button still works
- [ ] **Slice 02 AC-4:** `modelId` is `undefined` -- hook returns `{ schema: null, isLoading: false, error: null }` without calling server action
- [ ] **Slice 07 AC-4/5:** `imageParams` is `undefined` in canvas handlers -- behavior identical to pre-feature (only `prompt_strength` for variation, empty params for img2img)

### State Transitions

- [ ] **Slice 04 AC-5:** Tier change (draft -> quality) in prompt panel -- imageParams reset to `{}`, new schema loaded
- [ ] **Slice 04 AC-6:** Mode switch (txt2img -> img2img -> txt2img) -- imageParams per mode preserved
- [ ] **Slice 06 AC-6:** Tier change in variation popover -- imageParams reset to `{}`
- [ ] **Slice 02 AC-6:** Race condition: modelId changes during pending fetch -- stale response discarded

### Boundary Conditions

- [ ] **Slice 03 AC-5:** Aspect ratio with >8 enum values (e.g., Nano Banana 2 with 14 values) -- Common values first, separator, then Extreme values
- [ ] **Slice 03 AC-6:** Aspect ratio with <=8 enum values (e.g., GPT Image 1.5 with 3 values) -- all values shown without separator
- [ ] **Slice 03 AC-7:** Schema with NO Primary fields (only Advanced) -- Primary area empty, Advanced toggle visible
- [ ] **Slice 03 AC-8:** Schema with NO Advanced fields (only Primary) -- Advanced toggle hidden
- [ ] **Slice 04 AC-7:** Upscale mode -- ParameterPanel NOT rendered
- [ ] **Slice 05 AC-3:** Empty imageParams (`{}`) -- params identical to modelParams only (no change from pre-feature behavior)
- [ ] **Slice 05 AC-4:** imageParams overrides same-key modelParams -- user selection takes precedence

### INTERNAL_FIELDS Exclusion

- [ ] **Slice 03 AC-3:** Fields `prompt`, `negative_prompt`, `image`, `image_input`, `seed`, `num_outputs`, `openai_api_key`, `mask`, `prompt_strength`, `strength` -- NONE rendered
- [ ] **Slice 03 AC-4:** Properties with `type: "string"` (no enum), `type: "boolean"`, `type: "array"` (no enum) -- NONE rendered

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | `resolveModel` extraction + reimport | Slice 01 -> Slice 04, 06 | `pnpm tsc --noEmit` passes. No inline `resolveModel` in prompt-area.tsx |
| 2 | `useModelSchema` hook -> ParameterPanel props | Slice 02 -> Slice 04, 06 | Hook output (`schema`, `isLoading`, `error`) correctly wired to ParameterPanel in both prompt-area and popovers |
| 3 | `ParameterPanel` Primary/Advanced split -> all mount locations | Slice 03 -> Slice 04, 06 | `primaryFields` prop passed consistently as `["aspect_ratio", "megapixels", "resolution"]` in all 3 locations |
| 4 | imageParams state -> handleGenerate merge (prompt) | Slice 04 -> Slice 05 | `imageParams` from mode state included in `generateImages()` params |
| 5 | imageParams in popover interfaces -> handler merge (canvas) | Slice 06 -> Slice 07 | `imageParams` from `VariationParams`/`Img2imgParams` spread into `params` in handlers |
| 6 | modelSettings prop pass-through (canvas) | Slice 06 | `canvas-detail-view.tsx` passes `modelSettings` to both popovers |
| 7 | Scope overlap: canvas-detail-view.tsx handler merge | Slice 06 (ACs 7-8) + Slice 07 (ACs 1-5) | Verify Slice 07 adds defensive `?? {}` handling on top of Slice 06's initial merge |

---

## Full TypeScript Compilation

- [ ] After all slices: `pnpm tsc --noEmit` passes without errors
- [ ] After all slices: `pnpm test` passes (all unit tests)
- [ ] After all slices: `pnpm build` succeeds

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- Slice 06 and Slice 07 share modifications to `canvas-detail-view.tsx`. Slice 07 should be verified as a refinement of Slice 06's handler merge, not a duplicate.
- All manual tests require a running Replicate API connection to verify actual image generation with selected parameters.
