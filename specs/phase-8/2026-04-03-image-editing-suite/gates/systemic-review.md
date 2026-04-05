# Systemic Review Report

**Feature:** AI Image Editing Suite
**Branch:** feature/image-editing-suite
**Datum:** 2026-04-04

---

## Summary

**Verdict:** FAILED

| Kriterium | Findings |
|-----------|----------|
| Duplicate Solution Paths | 2 |
| Abstraction Reuse | 1 |
| Schema Consistency | 0 |
| Dead Code / Unused Imports | 0 |
| Error Handling Divergence | 1 |
| Configuration Drift | 1 |
| Interface Inconsistency | 1 |
| Dependency Direction | 0 |
| Security Pattern Consistency | 0 |
| Performance Pattern Consistency | 0 |
| **Total** | **6** |

---

## Findings

### SR-1: Duplicated Mask Export Pipeline in canvas-detail-view.tsx and canvas-chat-panel.tsx

**Kriterium:** 3.1 Duplicate Solution Paths
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
The mask export pipeline (validate -> feather -> scale -> grayscale -> upload) is implemented twice with nearly identical logic: once as `exportMaskToR2` in `canvas-chat-panel.tsx` (line 288) and once inline in `handleEraseAction` in `canvas-detail-view.tsx` (lines 268-294). Both call the same sequence: `validateMinSize(maskData, 10)` -> `applyFeathering(maskData, 10)` -> `scaleToOriginal(...)` -> `toGrayscalePng(...)` -> `uploadMask(formData)`. Both import the same 4 functions from `mask-service.ts` and `uploadMask` from `upload.ts`. This creates two code paths for the same operation.

**Neuer Code:** `components/canvas/canvas-detail-view.tsx:268-294` (inline pipeline in `handleEraseAction`)
**Bestehendes Pattern:** `components/canvas/canvas-chat-panel.tsx:288-320` (`exportMaskToR2` as reusable `useCallback`)

**Empfehlung:**
Extract the mask export pipeline into a shared hook (e.g., `useExportMaskToR2` in `lib/hooks/` or as a standalone function in `lib/services/mask-service.ts`) and call it from both `canvas-detail-view.tsx` (`handleEraseAction`) and `canvas-chat-panel.tsx` (`handleCanvasGenerate`). The `canvas-chat-panel.tsx` already has a clean `exportMaskToR2` callback -- `canvas-detail-view.tsx` should reuse a common abstraction rather than duplicating the pipeline inline.

---

### SR-2: Duplicated Validation Constants (EDIT_MODES, VALID_OUTPAINT_SIZES, VALID_DIRECTIONS) across layers

**Kriterium:** 3.1 Duplicate Solution Paths
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
Several validation constants are defined locally in multiple files instead of being shared from a single source:

1. `EDIT_MODES = ["inpaint", "erase", "instruction", "outpaint"]` is defined identically in `app/actions/generations.ts:140` and `lib/services/generation-service.ts:502`.
2. `VALID_OUTPAINT_SIZES = [25, 50, 100]` is defined identically in `app/actions/generations.ts:155`, `lib/services/generation-service.ts:525`, and `backend/app/agent/tools/image_tools.py:313`.
3. `VALID_DIRECTIONS = ["top", "bottom", "left", "right"]` is defined in `lib/services/generation-service.ts:519` and `backend/app/agent/tools/image_tools.py:310`.

The codebase already has a centralized pattern: `VALID_GENERATION_MODES` and `VALID_SLOTS` are exported from `lib/types.ts` and reused across `app/actions/generations.ts`, `app/actions/model-slots.ts`, `app/actions/models.ts`, and `lib/services/generation-service.ts`. The new constants break this pattern by inlining values locally.

**Neuer Code:** `app/actions/generations.ts:140,155` and `lib/services/generation-service.ts:502,519,525`
**Bestehendes Pattern:** `lib/types.ts:27-28` (centralized `VALID_GENERATION_MODES`, `VALID_SLOTS` exported and reused everywhere)

**Empfehlung:**
Export `VALID_EDIT_MODES`, `VALID_OUTPAINT_SIZES`, and `VALID_OUTPAINT_DIRECTIONS` from `lib/types.ts` (alongside the existing `VALID_GENERATION_MODES`), then import them in `app/actions/generations.ts` and `lib/services/generation-service.ts`. For the Python backend, the duplication is across language boundaries and acceptable, but the TypeScript-side duplication within the same codebase should use the centralized pattern.

---

### SR-3: handleCanvasGenerate has 4 near-identical result-handling blocks

**Kriterium:** 3.2 Abstraction Reuse
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
`handleCanvasGenerate` in `canvas-chat-panel.tsx` grew from a single code path (master: lines 284-342) to 4 separate branches (instruction: lines 342-386, outpaint: lines 389-470, inpaint/erase with mask: lines 485-587, default: lines 591-650). Each branch repeats the same result-handling pattern:

```
const result = await generateImages({...});
if (result && "error" in result) { toast.error(...); dispatch(...); return; }
onGenerationsCreated?.(result as Generation[]);
const pendingIds = (result as Generation[]).filter(...).map(...);
if (pendingIds.length > 0 && onPendingGenerations) { onPendingGenerations(pendingIds); }
else { dispatch({ type: "SET_GENERATING", isGenerating: false }); }
```

This identical 15-line block appears 4 times (lines 353-385, 438-469, 553-587, 603-648). The only difference between branches is the `generateImages` input object. The original single-path pattern on master was clean; the new code should extract the shared result-handling logic.

**Neuer Code:** `components/canvas/canvas-chat-panel.tsx:342-650` (4 branches, each ~60 lines)
**Bestehendes Pattern:** `components/canvas/canvas-chat-panel.tsx:284-342` on master (single branch, ~60 lines)

**Empfehlung:**
Extract a helper function (e.g., `executeGeneration(input: GenerateImagesInput): Promise<void>`) that handles `generateImages` call + error check + `onGenerationsCreated` + pending polling dispatch. Each branch then only constructs the input and calls the helper. This would reduce the 4 x ~60 lines to 4 x ~15 lines + 1 x ~20 line helper.

---

### SR-4: uploadMask lacks MIME type validation unlike existing uploadSourceImage pattern

**Kriterium:** 3.5 Error Handling Divergence
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
The existing `uploadSourceImage` function in `app/actions/upload.ts` validates the uploaded file's MIME type against `ALLOWED_MIME_TYPES` (line 100, 125) before proceeding. The new `uploadMask` function (line 24-51) in the same file skips MIME type validation entirely -- it only checks for file existence and max size. While the mask is always generated client-side as `image/png`, the server action is a public endpoint that accepts any `FormData`, and the established pattern in the same file is to validate MIME types.

**Neuer Code:** `app/actions/upload.ts:24-51` (`uploadMask` -- no MIME check)
**Bestehendes Pattern:** `app/actions/upload.ts:100,125` (`uploadSourceImage` -- `ALLOWED_MIME_TYPES` check)

**Empfehlung:**
Add a MIME type check in `uploadMask` to verify the uploaded file is `image/png` (the only valid mask format), consistent with the `uploadSourceImage` validation pattern. Example: `if (maskFile.type !== "image/png") { return { error: "Mask-Upload fehlgeschlagen" }; }`.

---

### SR-5: Outpaint validation constants hardcoded instead of using centralized config

**Kriterium:** 3.6 Configuration Drift
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
The outpaint dimension limit `2048` is hardcoded in `canvas-chat-panel.tsx` (line 422) as a client-side validation. The `OutpaintSize` type `25 | 50 | 100` is defined in `lib/canvas-detail-context.tsx:20`, while the same values appear as `SIZE_OPTIONS` in `outpaint-controls.tsx:16`, `VALID_OUTPAINT_SIZES` in `generations.ts:155`, and `VALID_OUTPAINT_SIZES` in `generation-service.ts:525`. There is no single source of truth for the outpaint dimension limit.

The codebase has an established pattern for this: `VALID_GENERATION_MODES` is defined once in `lib/types.ts` and referenced everywhere. The `OutpaintSize` type in the context layer partially addresses this but is not referenced by the validation layers.

**Neuer Code:** `components/canvas/canvas-chat-panel.tsx:422` (hardcoded `2048`), `components/canvas/outpaint-controls.tsx:16` (`SIZE_OPTIONS`), `app/actions/generations.ts:155` (`VALID_OUTPAINT_SIZES`)
**Bestehendes Pattern:** `lib/types.ts:27-28` (centralized constants)

**Empfehlung:**
Define `VALID_OUTPAINT_SIZES`, `VALID_OUTPAINT_DIRECTIONS`, and `MAX_OUTPAINT_DIMENSION` as exports from `lib/types.ts` alongside the existing validation constants. Use `OutpaintSize` from the context or types module for the validation array type. Replace the hardcoded `2048` with the named constant.

---

### SR-6: generate() function grew to 13 positional parameters

**Kriterium:** 3.7 Interface Inconsistency
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
The internal `generate()` function in `lib/services/generation-service.ts` grew from 10 positional parameters (on master) to 13 positional parameters (lines 445-458):

```typescript
async function generate(
  projectId: string,        // 1
  promptMotiv: string,      // 2
  modelIds: string[],       // 3
  params: Record<...>,      // 4
  count: number,            // 5
  generationMode?: string,  // 6
  sourceImageUrl?: string,  // 7
  strength?: number,        // 8
  references?: ...[],       // 9
  sourceGenerationId?: string, // 10
  maskUrl?: string,         // 11  NEW
  outpaintDirections?: string[], // 12  NEW
  outpaintSize?: number     // 13  NEW
)
```

This makes call sites fragile and hard to read (the caller in `app/actions/generations.ts:177` passes 13 positional args). The codebase uses named-object parameters elsewhere (e.g., `GenerateImagesInput` interface for the server action at `app/actions/generations.ts:26-48`). The `generate()` function is the only internal function with this many positional parameters.

**Neuer Code:** `lib/services/generation-service.ts:445-458` (13 positional params)
**Bestehendes Pattern:** `app/actions/generations.ts:26-48` (`GenerateImagesInput` interface with named fields)

**Empfehlung:**
Refactor `generate()` to accept a single options object (e.g., `GenerateOptions`) instead of 13 positional parameters. This matches the pattern already used by the calling `generateImages` server action and would make future extensions (additional edit modes, new parameters) non-breaking.

---

## Decision Log Updates

| # | Neuer Eintrag | Date |
|---|---------------|------|
| -- | None. | -- |

> Falls keine "Bewusst akzeptiert"-Entscheidungen: "None."
