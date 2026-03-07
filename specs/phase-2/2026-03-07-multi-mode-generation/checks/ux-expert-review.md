<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Multi-Mode Generation (img2img + Upscale)

**Feature:** Multi-Mode Generation
**Date:** 2026-03-07
**Reviewer:** UX Expert Agent

---

## Summary

**Verdict:** CHANGES_REQUESTED

The overall design is solid and well-thought-out. The Segmented Control approach for mode switching is the right call -- compact, no context-switch, and extensible. The cross-mode flows from the Lightbox are a genuine workflow accelerator. However, there are several issues that need addressing before implementation.

### Findings Overview

| ID | Title | Severity |
|----|-------|----------|
| F-1 | WorkspaceState needs significant extension for cross-mode data | Critical |
| F-2 | Generate button must be disabled when img2img prerequisites are incomplete | Critical |
| F-3 | Mode switch state persistence is underspecified | Improvement |
| F-4 | Upscale-on-upscale and img2img-on-upscale need explicit prevention in Prompt Area mode | Improvement |
| F-5 | Popover component does not exist in codebase yet | Improvement |
| F-6 | Model dropdown behavior when switching to img2img with incompatible model | Improvement |
| F-7 | Negative prompt field visibility inconsistency between discovery layout and wireframe | Improvement |
| F-8 | Gallery filter is client-side but generations query may not fetch all modes | Suggestion |
| F-9 | Upscale result has no prompt -- empty prompt field in DB schema requires workaround | Suggestion |

**Totals:** 2 Critical, 5 Improvement, 2 Suggestion

---

## Workflow Analysis

### State Machine Review

The Generation Mode state machine (Discovery lines 238-248) covers all transitions between three modes and the cross-mode entry from Lightbox. All states are reachable and leavable. No dead ends.

The Image Upload state machine (lines 250-258) is clean with proper error recovery via retry.

The Upscale Lightbox state machine (lines 260-267) covers the happy path and error case.

**One gap identified:** The state machine does not define what happens when a user is in img2img mode with a source image uploaded and switches to upscale mode. Does the source image carry over? Discovery line 284 says "mode switch keeps state where possible" but the state machine does not explicitly model this transition for the Dropzone. This is addressed in F-3.

### Flow Walkthrough

All five user flows (Discovery lines 98-151) are logically sound. The cross-mode flows (F4, F5) are particularly well-designed -- they follow the principle of least surprise by pre-filling everything the user would expect.

The Variation flow for img2img (Flow 5) correctly distinguishes between the generated result and the original source image. This is a subtle but important design decision that enables true iterative refinement.

---

## Findings

### Finding F-1: WorkspaceState needs significant extension for cross-mode data

**Severity:** Critical
**Category:** Workflow / Lücke

**Problem:**
The existing `WorkspaceVariationState` (in `lib/workspace-state.tsx`) only carries `promptMotiv`, `promptStyle`, `negativePrompt`, `modelId`, and `modelParams`. The cross-mode flows (Flow 4: Lightbox to img2img, Flow 5: img2img Variation) require passing additional data: the source image URL, the generation mode to switch to, and the strength value. Without extending this context, the cross-mode transitions described in Discovery cannot work.

**Context:**
> **From Discovery (lines 137-141):**
> ```
> 3. Mode-Selector wechselt auf "Image to Image"
> 4. Source-Image wird aus dem generierten Bild gesetzt (imageUrl als Source)
> 5. Prompt (Motiv + Style) wird uebernommen
> ```
>
> **From Codebase (`lib/workspace-state.tsx`, lines 10-16):**
> ```typescript
> export interface WorkspaceVariationState {
>   promptMotiv: string;
>   promptStyle?: string;
>   negativePrompt?: string;
>   modelId: string;
>   modelParams: Record<string, unknown>;
> }
> ```

**Impact:**
Cross-mode flows (Flow 4 and Flow 5) are core to the iterative workflow value proposition. If WorkspaceState cannot carry source image and mode information, these flows are dead ends -- the lightbox button would close but the prompt area would not receive the source image or switch mode.

**Recommendation:**
Discovery should specify the WorkspaceState extension. The state needs at minimum: `targetMode: 'txt2img' | 'img2img' | 'upscale'`, `sourceImageUrl?: string`, `strength?: number`. This is a design-level gap that should be documented, not just an implementation detail, because it affects the contract between Lightbox and PromptArea components.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-2: Generate button must be disabled when img2img prerequisites are incomplete

**Severity:** Critical
**Category:** Usability / Error Prevention

**Problem:**
In img2img mode, the user needs both a source image AND a prompt to generate. The wireframes show the Generate button in img2img mode but do not specify a disabled state when the source image is missing. The Upscale mode correctly shows "Upscale button disabled" when no image is uploaded (Wireframe line 243), but img2img has no equivalent safeguard.

If a user enters img2img mode, types a prompt, and hits Generate without uploading a source image, the system would either error silently or produce a confusing API error. This is a guaranteed stumble point.

**Context:**
> **From Wireframe (Upscale State Variations, line 243):**
> ```
> | `no image` | Upscale button disabled. Dashed dropzone with placeholder. |
> ```
>
> **From Wireframe (img2img State Variations, lines 173-179):**
> ```
> | `empty` | Dashed dropzone with placeholder text |
> | `drag-over` | Dropzone border highlighted |
> | `uploading` | Progress indicator |
> | `preview` | Thumbnail + filename + dimensions + remove button |
> | `error` | Error message in dropzone + retry option |
> ```
> (No "Generate button disabled" state listed)

**Impact:**
Users will hit Generate with an incomplete form, receive an error, and lose confidence in the interface.

**Recommendation:**
Add an explicit state variation to the img2img wireframe: Generate button disabled when Dropzone is in `empty` or `error` state. Optionally also disabled during `uploading` state to prevent race conditions.

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-3: Mode switch state persistence is underspecified

**Severity:** Improvement
**Category:** Usability / Inkonsistenz

**Problem:**
Discovery line 284 states "Mode switch keeps entered Prompt/Source-Image where possible" but does not define the exact rules. Several ambiguous scenarios exist:

1. User uploads source image in img2img, switches to upscale -- does the same source image carry over to upscale's dropzone? (Both modes use a dropzone, so logically yes, but not specified.)
2. User uploads source image in img2img, switches to txt2img, then back to img2img -- is the source image still there? (The state machine line 243 says "Dropzone + Strength disappear" on switch to txt2img, but doesn't say whether state is destroyed or hidden.)
3. User types prompt in img2img, switches to upscale (no prompt in upscale), switches back to img2img -- is the prompt still there?

**Context:**
> **From Discovery (line 284):**
> ```
> Modus-Wechsel behaelt State: Wechsel zwischen Modi behaelt eingegebenen Prompt/Source-Image wenn moeglich
> ```
>
> **From Discovery State Machine (line 243):**
> ```
> img2img | Click "Text to Image" | txt2img | Dropzone + Strength verschwinden
> ```

**Impact:**
Without clear rules, different developers might implement different behaviors, leading to inconsistent UX. Users who switch modes to explore will lose their work unpredictably.

**Recommendation:**
Add a brief state persistence matrix to Discovery, e.g.: Source image persists across img2img <-> upscale switches. Prompt persists across txt2img <-> img2img switches. All state is preserved (hidden, not destroyed) during mode switches within a session.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-4: Upscale-on-upscale and img2img-on-upscale need explicit prevention in Prompt Area mode

**Severity:** Improvement
**Category:** Usability / Lücke

**Problem:**
The Lightbox correctly hides img2img and Upscale buttons when viewing an upscale result (Wireframe line 359). However, nothing prevents a user from taking an already-upscaled image, downloading it, re-uploading it in the Upscale prompt-area mode, and upscaling it again. While this is technically valid, there is no guidance on whether this is intended or should be warned against (e.g., diminishing returns, potential quality degradation).

More importantly: If a user opens an upscaled image in the Lightbox and wants to do img2img on the high-res version, the Lightbox hides that button. This is a valid use case (take a 4x upscaled image as base for img2img transformation) that is explicitly blocked.

**Context:**
> **From Wireframe (line 359):**
> ```
> | `upscale image` | img2img and Upscale buttons hidden (no re-upscale or img2img on upscaled). Variation hidden. |
> ```

**Impact:**
Blocking img2img on upscaled images prevents a legitimate creative workflow: upscale first for resolution, then img2img for artistic transformation. Power users will notice this limitation.

**Recommendation:**
Reconsider hiding the img2img button on upscale results. The Upscale button hiding is defensible (re-upscaling has diminishing returns), but img2img on an upscaled image is a valid workflow. At minimum, document the rationale in Discovery so this is a conscious product decision rather than an oversight.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-5: Popover component does not exist in codebase yet

**Severity:** Improvement
**Category:** Lücke

**Problem:**
Discovery references `components/ui/popover.tsx` as a reused pattern (line 81), but this file does not exist in the codebase. The Upscale Lightbox action depends on this Popover component for the 2x/4x scale selector.

**Context:**
> **From Discovery (line 81):**
> ```
> | Popover (shadcn) | `components/ui/popover.tsx` | Upscale Scale-Selector in Lightbox |
> ```
>
> **From Codebase:** No `popover.tsx` found via Glob search in `components/ui/`.

**Impact:**
Not a blocker per se (shadcn popover can be installed with one command), but Discovery incorrectly marks this as a "Reused Pattern" when it is actually a new dependency. This may cause incorrect effort estimation in implementation slices.

**Recommendation:**
Move Popover from "Reused Patterns" to "New Patterns" in Discovery, or add a note that `npx shadcn@latest add popover` is a prerequisite in Slice 4.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-6: Model dropdown behavior when switching to img2img with incompatible model

**Severity:** Improvement
**Category:** Usability / Error Prevention

**Problem:**
Discovery states that img2img only shows models whose schema has `image`, `image_prompt`, or `init_image` parameters (line 275). But what happens when the user is in txt2img with a model that does NOT support img2img, and then switches to img2img mode? The currently selected model would not be in the filtered list.

This transition is not covered in the state machine or wireframes.

**Context:**
> **From Discovery (line 275):**
> ```
> img2img zeigt nur Modelle deren Schema image, image_prompt oder init_image Parameter hat
> ```
>
> **From Discovery State Machine (line 241):**
> ```
> txt2img | Click "Image to Image" | img2img | Dropzone + Strength erscheinen, Prompt bleibt
> ```

**Impact:**
If the model auto-switches to the first compatible model, the user loses their intended model context. If it stays on the incompatible model, generation will fail. Either way, the user is confused.

**Recommendation:**
Define the behavior explicitly: If current model supports img2img, keep it. If not, auto-select the first compatible model AND show a brief toast/notification: "Model switched to [X] (supports img2img)". This gives the user visibility and control.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-7: Negative prompt field visibility inconsistency between Discovery layout and Wireframe

**Severity:** Improvement
**Category:** Inkonsistenz

**Problem:**
The Discovery layout sketch (line 179) shows "Neg: [__________________]" as part of the prompt fields visible in both txt2img and img2img modes. However, the existing codebase already conditionally shows the negative prompt field based on schema support (`hasNegativePrompt` flag in `prompt-area.tsx` line 148-150). The wireframe for img2img preview state (line 156-157) omits the Neg field, only showing Motiv and Style.

This creates ambiguity: should Neg always be visible in img2img, or should it follow the existing schema-driven visibility?

**Context:**
> **From Discovery Layout (lines 177-180):**
> ```
> | --- Nur bei txt2img/img2img: -
> | Motiv: [__________________]  |
> | Style: [__________________]  |
> | Neg:   [__________________]  |
> ```
>
> **From Wireframe img2img preview (lines 156-157):**
> ```
> | Motiv:  [a sunset landscape__]  |
> | Style:  [oil painting________]  |
> ```
> (Neg field missing)

**Impact:**
Minor visual inconsistency. The existing schema-driven approach is the correct one -- showing Neg only when the model supports it. But the Discovery layout should reflect this to avoid confusion during implementation.

**Recommendation:**
Clarify in Discovery that Negative Prompt visibility remains schema-driven (as it is today), not always-visible. Wireframe already implicitly shows this correctly by omitting it in the preview state.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-8: Gallery filter is client-side but generations query may not fetch all modes

**Severity:** Suggestion
**Category:** Skalierung

**Problem:**
Discovery says filter chips work as "Client-side Filter auf generationMode" (line 309). This means ALL generations must be fetched to the client before filtering. As the gallery grows with three modes producing images, the initial data load increases. If the gallery already uses pagination or infinite scroll, client-side filtering would only filter the currently loaded page, not all generations of that mode.

**Context:**
> **From Discovery (line 309):**
> ```
> Filter Chip Click | Galerie | Client-side Filter auf generationMode | Galerie zeigt nur gefilterte Bilder
> ```

**Impact:**
For V1, client-side filtering is acceptable. At scale (hundreds of generations), users filtering for "Upscale" might see no results on the first page even though upscale results exist further back.

**Recommendation:**
Acceptable for initial implementation. Consider adding a note that this may need server-side filtering if performance degrades or if pagination is introduced.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-9: Upscale result has no prompt -- empty prompt field in DB schema requires workaround

**Severity:** Suggestion
**Category:** Lücke

**Problem:**
The `generations` table has `prompt: text("prompt").notNull()` -- it is a required field. Upscale generates an image without any prompt. Discovery's Data Fields section (lines 290-296) adds new fields but does not address how to handle the required `prompt` field for upscale generations. A placeholder like "Upscale 2x" would work but should be explicitly defined for consistency.

**Context:**
> **From Codebase (`lib/db/schema.ts`, line 51):**
> ```typescript
> prompt: text("prompt").notNull(),
> ```
>
> **From Discovery (lines 115-122):**
> ```
> Flow 2: Upscale via Modus
> ...Prompt-Felder, Strength-Slider, ParameterPanel und Model-Dropdown sind ausgeblendet
> ```

**Impact:**
Without a defined convention, upscale generations might have empty strings, "Upscale", "Upscale 2x", or other inconsistent values in the prompt field. This affects the gallery overlay text (GenerationCard shows `generation.prompt` on hover) and search/filter functionality.

**Recommendation:**
Define a convention in Discovery, e.g.: Upscale generations use "Upscale {scale}x" as the prompt value, or the original image's prompt if upscaling from Lightbox (via `sourceGenerationId`).

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

## Positive Highlights

1. **Segmented Control choice** is spot-on. It avoids the heavyweight tab/page approach of competitors while remaining extensible. Adding "Edit" later is a one-segment addition.

2. **Cross-mode flows from Lightbox** are a genuine workflow differentiator. The ability to go from viewing a result to refining it via img2img in one click, with prompt pre-filled, removes significant friction from iterative creative work.

3. **Variation behavior distinction** for img2img (loading original source, not generated result) shows deep understanding of the creative workflow. This prevents "generation drift" where quality degrades through successive re-generations.

4. **Upscale as both mode and Lightbox action** correctly maps to two distinct mental models: "I have an external image to upscale" (mode) vs. "I want to upscale this result" (lightbox action).

5. **Source image persistence to R2** is the right architectural call. It enables future features (Edit/Inpaint) and avoids the fragility of client-side-only image references.

---

## Scalability & Risks

- **Mode extensibility** is well-designed. The Segmented Control can accommodate 1-2 more modes before needing overflow (Edit, Video). Beyond that, a different pattern may be needed.
- **Strength parameter is model-dependent.** Discovery notes that FLUX needs higher strength (>0.95) than SD models (line 408). The fixed presets (0.3/0.6/0.85) may be inappropriate for some models. Consider making presets model-adaptive in a future iteration.
- **R2 source image cleanup** is not addressed. If users upload many source images, storage costs grow. A cleanup strategy (TTL, or delete when no generation references them) should be planned.

---

## Verdict

**CHANGES_REQUESTED**

Two critical findings (F-1: WorkspaceState extension gap, F-2: missing disabled state for Generate in img2img) and five improvements must be addressed before implementation. The critical findings represent genuine workflow blockers -- without F-1, the core cross-mode value proposition cannot function; without F-2, users will encounter preventable errors.

**Next Steps:**
1. Extend Discovery with WorkspaceState contract for cross-mode data (F-1)
2. Add Generate button disabled state to img2img wireframe (F-2)
3. Address improvements F-3 through F-7 in Discovery/Wireframes
4. Re-review after changes
