<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Date:** 2026-03-15
**Reviewer:** UX Expert Agent
**Verdict:** CHANGES_REQUESTED

---

## Summary

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Wireframe layout contradicts actual code structure for Prompt Panel control placement | Improvement |
| F-2 | ParameterPanel EXCLUDED_KEYS set is insufficient for the Advanced filtering scope | Improvement |
| F-3 | imageParams state not integrated into mode persistence matrix | Improvement |
| F-4 | Canvas popovers do not pass imageParams through to generation handlers | Improvement |
| F-5 | No visual indication of which model is active when controls change | Suggestion |
| F-6 | Aspect ratio dropdown with 14 options (Nano Banana 2) needs usability consideration | Suggestion |

**Totals:** 0 Critical, 4 Improvement, 2 Suggestion

**High-Level Assessment:** The concept is well-founded -- schema-driven controls with a Primary/Advanced split is the right architectural approach for multi-model parameter exposure. The reuse of the existing `ParameterPanel` component and `getModelSchema` server action is sound. However, four Improvement-level inconsistencies between Discovery/Wireframes and the actual codebase need resolution before implementation can proceed cleanly.

---

## Workflow Analysis

### State Machine Evaluation

The four-state machine (`schema_loading`, `schema_ready`, `schema_empty`, `schema_error`) is well-defined and covers the realistic states. All states have clear entry conditions and exit paths.

**Reachability:** All states are reachable. `schema_loading` is the entry state triggered by mount or tier change. The three terminal states (`schema_ready`, `schema_empty`, `schema_error`) are all reachable from `schema_loading`.

**Recoverability:** `schema_error` gracefully degrades by hiding controls and allowing generation without custom params. This is the correct choice -- the user is never blocked.

**Tier change transition:** The `schema_ready -> schema_loading -> schema_ready` cycle on tier change with invalid value reset to model defaults is well-specified. The "skeleton flash" feedback during this transition is appropriate.

**No dead ends identified.** The user can always generate regardless of schema state.

### Flow Completeness

The primary flow (select params -> generate) and the canvas flow (popover -> select params -> generate) both reach completion. Error recovery paths (schema fetch failure, tier change invalidation) are defined.

One implicit assumption worth noting: the flow states that "imageParams werden mit modelParams gemergt" (user params merged with model params), but the merge priority is not explicitly stated in the state machine. Discovery line 176 clarifies that "User-gewaehlte Werte ueberschreiben Model-Defaults" -- this is correct behavior and is consistent with the `buildReplicateInput` spread pattern at `generation-service.ts:273` where `...params` is spread first, then explicit fields override.

---

## Findings

### Finding F-1: Wireframe layout contradicts actual code structure for Prompt Panel control placement

**Severity:** Improvement
**Category:** Inconsistency

**Problem:**
The wireframe shows the new parameter controls positioned between TierToggle (item 1) and the Variants stepper, with the Generate button below. However, in the actual `prompt-area.tsx`, the layout order is: TierToggle -> Variant Count Stepper -> Generate Button, all inside a single `<div className="space-y-3">` block (the "Action Bar" section starting at line 962). The wireframe inserts the parameter controls *between* TierToggle and Variants, but Discovery line 112 says "Bereich zwischen Tier Toggle / MaxQuality Toggle und Variant Count Stepper" -- this matches the wireframe.

The issue is that the wireframe shows this as a clean separation, but the actual code has TierToggle and Variants tightly coupled in the same section. The implementer needs clear guidance on whether the parameter controls go inside the Action Bar div or between the prompt tools section and the Action Bar.

**Context:**
> **From Discovery (line 112):**
> ```
> Primary Controls: 1-2 Dropdowns (Aspect Ratio + megapixels/resolution) -- immer sichtbar
> ```
>
> **From Wireframe (lines 66-79):**
> ```
> 1 [Draft | Quality]        <-- TierToggle
>   Aspect Ratio             <-- NEW: between Tier and Variants
>   [1:1                  v]
>   Megapixels
>   [1                    v]
>   > Advanced
> ```
>
> **From actual code (`prompt-area.tsx:961-1010`):**
> ```
> {/* Action Bar: Tier Toggle + Variants + Generate */}
> <div className="space-y-3">
>   <TierToggle ... />
>   {showVariants && ( <Variants stepper> )}
>   <Button>Generate</Button>
> </div>
> ```

**Impact:**
Ambiguous placement will lead to implementer guessing, potentially placing controls in the wrong position. Could result in rework.

**Recommendation:**
Clarify in the wireframe annotation that the new ParameterPanel (Primary + Advanced) goes *inside* the Action Bar div, between TierToggle and the Variants stepper. Alternatively, restructure the wireframe to show the exact insertion point relative to the existing Action Bar boundary.

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-2: ParameterPanel EXCLUDED_KEYS set is insufficient for the Advanced filtering scope

**Severity:** Improvement
**Category:** Inconsistency

**Problem:**
Discovery (line 174) specifies that Advanced Controls should filter out "interne Felder wie `prompt`, img2img-Felder, `openai_api_key`". The existing `ParameterPanel` component (`parameter-panel.tsx:43`) only excludes `prompt` and `negative_prompt` in its `EXCLUDED_KEYS` set. The discovery requires a significantly broader exclusion list that includes:
- `prompt`, `negative_prompt` (already excluded)
- img2img fields: `image`, `image_input`, `input_images`, `images`, `input_image` (per `model-schema-service.ts:13-16`)
- `openai_api_key`
- `prompt_strength` (set internally by variation/img2img handlers)
- Potentially `seed`, `num_outputs` and other internally-managed fields

Neither Discovery nor Wireframe explicitly lists the full exclusion set. Slice 2 mentions "filtert interne Felder (prompt, img2img-Felder, openai_api_key)" but this is not a concrete list.

**Context:**
> **From Discovery (line 174):**
> ```
> Advanced: Alle anderen Schema-Properties (ausser internen Feldern wie prompt, img2img-Felder, openai_api_key) -- einklappbar
> ```
>
> **From existing code (`parameter-panel.tsx:43`):**
> ```typescript
> const EXCLUDED_KEYS = new Set(["prompt", "negative_prompt"]);
> ```
>
> **From `model-schema-service.ts:13-16` (img2img field names):**
> ```
> input_images, image_input, images, input_image, image
> ```

**Impact:**
Without an explicit exclusion list, the Advanced section will expose internal API fields (like `openai_api_key` or `image_input`) that are dangerous or meaningless for end users. Exposing `openai_api_key` would be a security issue. Exposing img2img fields would confuse users since those are managed internally.

**Recommendation:**
Add an explicit `INTERNAL_FIELDS` constant to Discovery's Business Rules section that lists all field names to exclude from both Primary and Advanced controls. Suggested list: `prompt`, `negative_prompt`, `openai_api_key`, `image`, `image_input`, `input_images`, `images`, `input_image`, `prompt_strength`, `seed`, `num_outputs`, `num_inference_steps`, `guidance_scale` (the last few are commonly internal). This list should be reviewed against actual Replicate schemas for the three supported model families.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-3: imageParams state not integrated into mode persistence matrix

**Severity:** Improvement
**Category:** Gap

**Problem:**
Discovery says (line 88) "Wert wird in lokalen imageParams State gespeichert" and (line 166) "imageParams werden beibehalten" on mode switch. However, the existing mode persistence system in `prompt-area.tsx` (lines 56-114) saves/restores per-mode state (`Txt2ImgState`, `Img2ImgState`, `UpscaleState`) and does NOT include an `imageParams` field in any of these interfaces.

The wireframe and discovery assume `imageParams` just works as local state, but there is a real UX concern: when a user sets aspect_ratio to 16:9 in txt2img, switches to img2img (which may use the same model), then switches back to txt2img -- their aspect_ratio selection would be lost if `imageParams` is not persisted per mode.

Discovery line 166 states "imageParams werden beibehalten" for mode switches where the model stays the same, but this conflicts with the general mode-switch architecture which saves/restores state per mode.

**Context:**
> **From Discovery (line 166):**
> ```
> schema_ready | Mode-Wechsel (txt2img <-> img2img) | Controls bleiben wenn gleiches Model | schema_ready | imageParams werden beibehalten
> ```
>
> **From actual code (`prompt-area.tsx:56-80`):**
> ```typescript
> interface Txt2ImgState {
>   promptMotiv: string;
>   promptStyle: string;
>   negativePrompt: string;
>   variantCount: number;
>   // NOTE: no imageParams field
> }
> ```

**Impact:**
Users who frequently switch between txt2img and img2img (a common workflow) will lose their parameter selections each time. This creates friction for power users who carefully configure aspect ratio and quality settings.

**Recommendation:**
Add `imageParams: Record<string, unknown>` to both `Txt2ImgState` and `Img2ImgState` interfaces, and include it in the `saveCurrentModeState`/restore logic. When the model is the same across modes, carry over imageParams; when it differs, reset to defaults (already covered by the tier-change rule).

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-4: Canvas popovers do not pass imageParams through to generation handlers

**Severity:** Improvement
**Category:** Gap

**Problem:**
The canvas `VariationPopover` and `Img2imgPopover` both have typed params interfaces (`VariationParams`, `Img2imgParams`) that are passed to their respective `onGenerate` callbacks. Neither interface includes a field for the new image parameters (aspect_ratio, megapixels, resolution, or any advanced params).

Discovery says (line 95): "imageParams fliessen in API-Call" for canvas flows. But the wireframe only shows the controls being added *visually* to the popovers without specifying how the selected values flow through the existing `VariationParams`/`Img2imgParams` types to `canvas-detail-view.tsx`'s `handleVariationGenerate`/`handleImg2imgGenerate` handlers, which currently construct the `params` object themselves (e.g., `canvas-detail-view.tsx:273` passes `params: { prompt_strength: promptStrength }`).

**Context:**
> **From Discovery (line 95):**
> ```
> User konfiguriert Werte + andere Popover-Settings -> Generate -> imageParams fliessen in API-Call
> ```
>
> **From existing code (`variation-popover.tsx:33-38`):**
> ```typescript
> export interface VariationParams {
>   prompt: string;
>   strength: VariationStrength;
>   count: number;
>   tier: Tier;
>   // NOTE: no imageParams field
> }
> ```
>
> **From `canvas-detail-view.tsx:273`:**
> ```typescript
> params: { prompt_strength: promptStrength },
> ```

**Impact:**
Without updating the params interfaces and the handler merge logic in `canvas-detail-view.tsx`, the parameter controls will be visible in the popovers but their values will be silently dropped on generation. Users will see the controls, configure them, and then get default-parameter images -- a classic "visible but broken" usability failure.

**Recommendation:**
Add `imageParams?: Record<string, unknown>` to both `VariationParams` and `Img2imgParams` interfaces. Update the `handleVariationGenerate` and `handleImg2imgGenerate` handlers in `canvas-detail-view.tsx` to spread imageParams into the `params` object alongside existing params like `prompt_strength`. Discovery should explicitly describe this data flow for the Canvas context.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-5: No visual indication of which model is active when controls change

**Severity:** Suggestion
**Category:** Usability

**Problem:**
When a user changes tiers (Draft -> Quality -> Max), the underlying model changes silently (e.g., Flux Schnell -> Flux 2 Pro -> Nano Banana 2), and the parameter controls update accordingly. The available aspect ratio options could change dramatically (from 9 options to 14 options, or from Megapixels to Resolution). There is no visual indicator telling the user *why* the controls changed.

A user who switches from Quality (Flux 2 Pro with Megapixels) to Max (Nano Banana 2 with Resolution) will see their "Megapixels" dropdown replaced by a "Resolution" dropdown without explanation.

**Context:**
> **From Discovery (line 99):**
> ```
> Tier-Wechsel aendert Model -> Schema wird neu gefetcht, Controls aktualisieren sich, ungueltige Werte werden auf Model-Default zurueckgesetzt
> ```

**Impact:**
Low -- power users will learn the association quickly, and casual users may not notice. But the sudden control swap without context can cause momentary confusion.

**Recommendation:**
Consider adding a subtle model name indicator (e.g., small muted text "Flux Schnell" or "Nano Banana 2") near the parameter controls. The existing `modelIdToDisplayName` utility (already imported in `prompt-area.tsx:36`) could be reused for this. This is a nice-to-have for V1; it could also be deferred.

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-6: Aspect ratio dropdown with 14 options (Nano Banana 2) needs usability consideration

**Severity:** Suggestion
**Category:** Usability

**Problem:**
Nano Banana 2 offers 14 aspect ratio options including unusual values like 1:4, 4:1, 1:8, and 8:1. A standard Select dropdown with 14 items is still navigable, but the extreme ratios (1:8, 8:1) may confuse users who do not understand what those dimensions look like. The current `ParameterPanel` renders enum values as raw strings (e.g., "1:8").

**Context:**
> **From Discovery (line 239):**
> ```
> Nano Banana 2: aspect_ratio enum: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1
> ```

**Impact:**
Minimal -- the dropdown is functional and users who need extreme ratios will find them. But less experienced users might accidentally select 1:8 expecting something different.

**Recommendation:**
Consider adding a small aspect ratio preview icon next to each option in a future iteration, or grouping common ratios (Landscape, Portrait, Square, Extreme) with visual separators. For V1, the raw enum values are acceptable since this is schema-driven and adding custom rendering per-value would fight the dynamic approach.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

## Scalability & Risks

### Extensibility

The schema-driven approach is inherently scalable -- new models with new parameters will automatically get controls without code changes. The Primary/Advanced whitelist split means new primary parameters require a code change (whitelist update), but this is a reasonable tradeoff for keeping the primary UI clean.

### Risk: Whitelist Brittleness

The Primary whitelist (`aspect_ratio`, `megapixels`, `resolution`) is hardcoded by field name. If a future model uses a different field name for size control (e.g., `dimensions`, `output_size`), it will be classified as Advanced. This is acceptable for V1 but should be documented as a known limitation.

### Risk: Schema Variability

Different Replicate models may have overlapping but inconsistent enum values for the same field (e.g., `aspect_ratio` with different sets of ratios). The current approach handles this correctly by always using the current model's schema. No risk identified here.

---

## Expert Assessment

**Is this the right solution?** Yes. Schema-driven parameter controls are the standard approach for multi-model systems. The Primary/Advanced split correctly balances discoverability with simplicity. The reuse of existing `ParameterPanel`, `getModelSchema`, and `buildReplicateInput` (which already spreads params) minimizes implementation risk.

**What was done well:**
- Graceful degradation on schema errors (controls disappear, generation still works)
- The skeleton loading state prevents layout shift
- The tier-change -> schema refresh cycle with value reset is well thought out
- Reuse of existing infrastructure (`ParameterPanel`, `ModelSchemaService`, `Collapsible`) is pragmatic
- Out-of-scope boundaries are clearly drawn (no custom width/height, no session persistence, no upscale mode)

**Strategic fit:** This feature removes a genuine user friction point (no control over output format) and positions the system for future model additions without UI work. The Primary/Advanced pattern scales well to models with many parameters (GPT Image 1.5 has ~6 Advanced params).

---

## Verdict

**CHANGES_REQUESTED**

4 Improvement findings need resolution before implementation:

1. **F-1:** Clarify exact insertion point for controls in Prompt Panel layout (wireframe vs actual code structure mismatch)
2. **F-2:** Define explicit INTERNAL_FIELDS exclusion list to prevent exposing dangerous/internal API fields
3. **F-3:** Integrate imageParams into the mode persistence matrix to prevent state loss on mode switch
4. **F-4:** Extend VariationParams/Img2imgParams interfaces to carry imageParams through to canvas generation handlers

**Next steps:**
- Update Discovery to address F-2 (exclusion list), F-3 (mode persistence), and F-4 (canvas params flow)
- Update Wireframe to address F-1 (clarify control placement annotation)
- Re-run UX review after changes
