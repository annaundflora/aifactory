# Codebase Scan

**Feature:** AI Image Editing Suite
**Scan-Datum:** 2026-04-04
**Discovery:** `specs/phase-8/2026-04-03-image-editing-suite/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Canvas Detail Context (useReducer + Context) | `lib/canvas-detail-context.tsx` | 1 context, consumed by 8+ components | EXTEND |
| 2 | Toolbar Button + Toggle System | `components/canvas/toolbar-button.tsx`, `components/canvas/canvas-toolbar.tsx` | 6 tool definitions, 1 ToolbarButton component | REUSE |
| 3 | SET_ACTIVE_TOOL Toggle Pattern | `lib/canvas-detail-context.tsx:54-58` | 1 reducer case, used by toolbar + 3 popovers | REUSE |
| 4 | Generation Polling Pattern | `components/canvas/canvas-detail-view.tsx:220-301` | 1 implementation | REUSE |
| 5 | PUSH_UNDO / In-Place Replace | `lib/canvas-detail-context.tsx:60-72` | 1 reducer case, triggered from polling + 3 generation handlers | REUSE |
| 6 | Popover Anchored to Canvas | `components/canvas/popovers/variation-popover.tsx`, `img2img-popover.tsx`, `upscale-popover.tsx` | 3 popovers | REUSE |
| 7 | Canvas Chat Panel (SSE Streaming) | `components/canvas/canvas-chat-panel.tsx`, `lib/canvas-chat-service.ts` | 1 panel + 1 service | EXTEND |
| 8 | Canvas Agent (LangGraph) | `backend/app/agent/canvas_graph.py`, `backend/app/agent/tools/image_tools.py` | 1 graph + 2 tools | EXTEND |
| 9 | Model Slots System | `lib/services/model-slot-service.ts`, `lib/db/queries.ts:708-744`, `components/ui/model-slots.tsx` | 15 seed rows (5 modes x 3), service + UI | EXTEND |
| 10 | Capability Detection | `lib/services/capability-detection.ts` | 1 service, 5 capabilities detected | REUSE |
| 11 | Generation Service Pipeline | `lib/services/generation-service.ts` | 1 service (`processGeneration`, `buildReplicateInput`, `generate`) | EXTEND |
| 12 | Server Actions (generations) | `app/actions/generations.ts` | 1 file, `generateImages` + `upscaleImage` + `retryGeneration` | EXTEND |
| 13 | R2 Storage Upload | `lib/clients/storage.ts` | 1 client, used by generation-service | REUSE |
| 14 | Replicate Client | `lib/clients/replicate.ts` | 1 client with rate-limiting queue | REUSE |
| 15 | GenerationMode Type | `lib/types.ts:19` | 1 type union, already includes `inpaint` + `outpaint` | EXTEND |
| 16 | Toast Notifications (sonner) | Used across `canvas-detail-view.tsx`, `canvas-chat-panel.tsx`, `canvas-toolbar.tsx` | 6+ usage locations | REUSE |
| 17 | HTML5 Canvas Drawing | -- | 0 locations | NEW |
| 18 | Floating Toolbar UI | -- | 0 locations | NEW |
| 19 | SAM 2 API Integration | -- | 0 locations | NEW |
| 20 | Mask-to-PNG Conversion | -- | 0 locations | NEW |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `CanvasDetailState` + `canvasDetailReducer` | `lib/canvas-detail-context.tsx:12-125` | 8+ canvas components | EXTEND | Needs new state fields: mask data, active edit mode, brush settings, outpaint config. Reducer needs new action types for mask/edit state management. |
| `ToolbarButton` component | `components/canvas/toolbar-button.tsx` | `canvas-toolbar.tsx` (6 tools) | REUSE | Already supports icon, tooltip, isActive, disabled, expanded. New edit buttons can use this directly. |
| `ToolDef` type + TOOLS array | `components/canvas/canvas-toolbar.tsx:35-52` | Same file, renders 6 tools | EXTEND | Need to add 4 new tool definitions (brush-edit, erase, click-edit, expand) with toggle=true. |
| `Popover` anchored pattern | `components/canvas/popovers/*.tsx` | 3 popovers (variation, img2img, upscale) | REUSE | Pattern for popovers that appear adjacent to toolbar. Floating Brush Toolbar needs different positioning (above canvas). |
| `CanvasImage` component | `components/canvas/canvas-image.tsx` | `canvas-detail-view.tsx` | EXTEND | Mask overlay `<canvas>` element needs to be layered on top of this component. The `<img>` tag at line 98 provides the base for coordinate mapping. |
| `CanvasChatPanel` SSE flow | `components/canvas/canvas-chat-panel.tsx`, `lib/canvas-chat-service.ts` | 1 panel | EXTEND | Needs to pass mask data (as URL or base64) alongside messages. SSE event types need extension for edit-specific events. |
| `canvas_graph.py` LangGraph Agent | `backend/app/agent/canvas_graph.py` | `canvas_assistant_service.py` | EXTEND | Needs edit intent classification, mask-aware routing, new tool actions (inpaint, erase, outpaint). System prompt needs editing intent rules. |
| `generate_image` tool | `backend/app/agent/tools/image_tools.py:306-347` | `canvas_graph.py` | EXTEND | Currently supports "variation" and "img2img" actions only. Needs "inpaint", "erase", "outpaint" actions with mask/direction params. |
| `GenerationService.generate()` | `lib/services/generation-service.ts:317-398` | `app/actions/generations.ts` | EXTEND | Mode validation at line 350 only allows "txt2img" and "img2img". Must add "inpaint", "erase", "outpaint". `buildReplicateInput` needs mask + direction handling. |
| `seedModelSlotDefaults()` | `lib/db/queries.ts:708-744` | `model-slot-service.ts` | EXTEND | Inpaint/outpaint slots exist but have `modelId: null`. Need to populate with default models (FLUX Fill Pro, Bria Eraser). |
| `detectCapabilities()` | `lib/services/capability-detection.ts:177-224` | Model catalog sync | REUSE | Already detects `inpaint` (image+mask fields) and `outpaint` (description-based). No changes needed. |
| `resolveActiveSlots()` | `lib/utils/resolve-model.ts` | `canvas-chat-panel.tsx`, `variation-popover.tsx`, `img2img-popover.tsx` | REUSE | Works for any `GenerationMode` string. Will work for "inpaint"/"erase"/"outpaint" without changes. |
| `StorageService.upload()` | `lib/clients/storage.ts` | `generation-service.ts` | REUSE | Can be reused for mask PNG upload to R2 (temporary storage for API call). |
| `SSECanvasGenerateEvent` | `lib/canvas-chat-service.ts:38-44` | `canvas-chat-panel.tsx` | EXTEND | Currently only carries `action: "variation" | "img2img"`. Needs "inpaint", "erase", "outpaint" actions + mask_url + direction fields. |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | `ToolbarButton` component | `components/canvas/toolbar-button.tsx` | Already supports all needed props (icon, tooltip, isActive, disabled). 4 new edit buttons use identical pattern. |
| 2 | `SET_ACTIVE_TOOL` toggle pattern | `lib/canvas-detail-context.tsx:54-58` | Toggle logic (same tool = deactivate, different tool = activate) matches edit mode switching exactly. Mutual exclusion built-in. |
| 3 | Generation polling pattern | `components/canvas/canvas-detail-view.tsx:220-301` | Inpaint/erase/outpaint results arrive async from Replicate, same polling + PUSH_UNDO flow applies. |
| 4 | PUSH_UNDO / In-Place Replace | `lib/canvas-detail-context.tsx:60-72` | Edit results replace current image and push old to undo stack -- same as variation/img2img flow. |
| 5 | Toast notifications (sonner) | Used in 6+ canvas files | Error/success feedback for edit operations uses same pattern. |
| 6 | `resolveActiveSlots()` | `lib/utils/resolve-model.ts` | Model resolution for inpaint/erase/outpaint slots uses identical logic. |
| 7 | `detectCapabilities()` | `lib/services/capability-detection.ts:177-224` | Already detects inpaint (image+mask) and outpaint (description) capabilities. No changes needed. |
| 8 | `StorageService.upload()` | `lib/clients/storage.ts` | Mask PNGs uploaded to R2 before API call use same upload pipeline. |
| 9 | `ReplicateClient.run()` | `lib/clients/replicate.ts` | Inpaint/erase/outpaint API calls go through same rate-limited client. |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `CanvasDetailState` + reducer | `lib/canvas-detail-context.tsx` | Add state fields: `editMode` (idle/painting/click-waiting/sam-processing/outpaint-config), `maskData` (ImageData or null), `brushSize`, `brushTool` (brush/eraser), `outpaintDirections`, `outpaintSize`. Add actions: SET_EDIT_MODE, SET_MASK, SET_BRUSH_SIZE, SET_BRUSH_TOOL, CLEAR_MASK, SET_OUTPAINT_DIRECTIONS, SET_OUTPAINT_SIZE. |
| 2 | `TOOLS` array in `canvas-toolbar.tsx` | `components/canvas/canvas-toolbar.tsx:45-52` | Add 4 new ToolDef entries: brush-edit (Paintbrush icon), erase (Eraser icon), click-edit (MousePointer icon), expand (Maximize icon). All with `toggle: true`. Insert as a new group with separator between upscale and download. |
| 3 | `GenerationService.generate()` | `lib/services/generation-service.ts:350` | Change mode validation from `["txt2img", "img2img"]` to include `"inpaint"`, `"erase"`, `"outpaint"`. Extend `buildReplicateInput` to handle mask URL (for inpaint/erase) and outpaint canvas extension. |
| 4 | `generateImages` server action | `app/actions/generations.ts` | Add `maskUrl?: string` and `outpaintDirections?: string[]` and `outpaintSize?: number` to `GenerateImagesInput`. Pass through to `GenerationService.generate()`. |
| 5 | `canvas_graph.py` Canvas Agent | `backend/app/agent/canvas_graph.py:175-210` | Extend system prompt with edit intent classification rules (mask present + prompt = inpaint, mask + no prompt = erase, no mask + edit intent = instruction edit, outpaint context). Extend `generate_image` tool to accept new actions. |
| 6 | `generate_image` tool | `backend/app/agent/tools/image_tools.py:306-347` | Add actions: "inpaint", "erase", "outpaint". Add params: mask_url, outpaint_directions, outpaint_size. |
| 7 | `SSECanvasGenerateEvent` | `lib/canvas-chat-service.ts:38-44` | Extend action union to include "inpaint", "erase", "outpaint". Add optional fields: mask_url, outpaint_directions, outpaint_size. |
| 8 | `CanvasChatPanel` | `components/canvas/canvas-chat-panel.tsx:281-342` | `handleCanvasGenerate` must pass mask URL, directions, size to `generateImages`. Build image context with mask state. |
| 9 | `seedModelSlotDefaults()` | `lib/db/queries.ts:729-735` | Populate inpaint slot 1 with FLUX Fill Pro, erase needs new mode or inpaint subtype. Outpaint slot 1 with FLUX Fill Pro. |
| 10 | `GenerationMode` type | `lib/types.ts:19` | Add `"erase"` to the union type. Add to `VALID_GENERATION_MODES` array. (inpaint and outpaint already exist.) |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | Mask Canvas Overlay component | No HTML5 Canvas drawing exists in the codebase. Zero `<canvas>` elements, zero `getContext('2d')` calls found. Needs new component for brush-based mask painting on top of the image. |
| 2 | Floating Brush Toolbar | No floating toolbar pattern exists. Existing toolbar is vertical/left-side. Floating toolbar above canvas with brush size slider, brush/eraser toggle, clear button is a new UI pattern. |
| 3 | Mask-to-PNG conversion utility | No mask export/conversion logic exists. Need utility to convert HTML5 Canvas mask to grayscale PNG (white=edit, black=keep) with 10px Gaussian Blur feathering. |
| 4 | SAM 2 API integration | No SAM/segmentation API integration exists. Need new API route + client for sending click coordinates and receiving auto-generated masks. |
| 5 | Outpaint Direction Controls | No direction selection UI exists. Need new component with buttons/handles at 4 image edges for selecting outpaint directions + size (25/50/100%). |
| 6 | Keyboard Shortcuts for Mask Painting | Existing keyboard shortcuts only handle Cmd/Ctrl+Z undo/redo (line 166-203 in canvas-detail-context.tsx). Need `[`/`]` for brush size, `E` for eraser toggle, separate mask undo stack. |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| -- | -- | No .decisions.md found | -- |

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| `"use client"` directive on all interactive components | `canvas-detail-view.tsx:1`, `canvas-toolbar.tsx:1`, `canvas-chat-panel.tsx:1`, `toolbar-button.tsx:1`, `canvas-image.tsx:1` | 10+ files |
| `@/` alias for imports (absolute paths) | All canvas components, all lib files | 50+ files |
| `data-testid` attributes on all interactive elements | `canvas-detail-view.tsx`, `canvas-toolbar.tsx`, `canvas-image.tsx`, `canvas-chat-panel.tsx` | 20+ test IDs in canvas alone |
| Component file naming: kebab-case | `canvas-detail-view.tsx`, `canvas-chat-panel.tsx`, `toolbar-button.tsx` | All component files |
| Section comments with `// ----` separators | `canvas-detail-view.tsx`, `canvas-toolbar.tsx`, `lib/canvas-detail-context.tsx` | All major files |
| Type exports alongside component exports | `VariationParams`, `Img2imgParams`, `CanvasDetailState`, `ToolbarButtonProps` | 8+ exported types |
| Server actions in `app/actions/` with `"use server"` | `app/actions/generations.ts`, `app/actions/model-slots.ts` | 2+ server action files |
| Tests co-located in `__tests__/` subdirectories | `components/canvas/__tests__/`, `lib/__tests__/`, `lib/services/__tests__/` | 30+ test files |
| Reducer pattern: discriminated union actions | `CanvasDetailAction` type union in `canvas-detail-context.tsx:27-35` | 1 pattern, 8 action types |
| Error handling: `{ error: string }` return type | `app/actions/generations.ts`, `lib/services/model-slot-service.ts` | 5+ functions |
| Toast error messages in German | `canvas-toolbar.tsx:89`, `canvas-detail-view.tsx:265,354,466` | 6+ toast calls |
| Backend Python: docstrings on all public functions | `canvas_graph.py`, `image_tools.py`, `canvas_sessions.py` | All Python files |
| Popover pattern: `PopoverAnchor` + `PopoverContent` | `variation-popover.tsx`, `img2img-popover.tsx`, `upscale-popover.tsx` | 3 popovers |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| `CanvasDetailState.activeToolId` | `lib/canvas-detail-context.tsx:17` | 4 new edit tool IDs added to the toggle system. Must ensure mutual exclusion with existing tools (variation, img2img, upscale, details). |
| `canvas-toolbar.tsx` TOOLS array | `components/canvas/canvas-toolbar.tsx:45-52` | 4 new entries. Toolbar layout needs a new separator group. |
| `canvas-detail-view.tsx` 3-column layout | `components/canvas/canvas-detail-view.tsx:563-648` | Center column (`<main>`) needs mask overlay + floating toolbar + outpaint controls layered over `CanvasImage`. |
| `CanvasImage` `<img>` element | `components/canvas/canvas-image.tsx:98-106` | Mask canvas must be exactly aligned to this `<img>` (same position, same dimensions). `crossOrigin="anonymous"` already set (needed for canvas operations). |
| `GenerationService.generate()` mode validation | `lib/services/generation-service.ts:350` | Currently rejects anything except "txt2img" and "img2img". Must accept "inpaint", "erase", "outpaint". |
| `buildReplicateInput()` | `lib/services/generation-service.ts:264-301` | Only handles "img2img" mode for image input. Must add branches for inpaint (image + mask), erase (image + mask, no prompt), outpaint (extended canvas + mask). |
| `handleCanvasGenerate()` in chat panel | `components/canvas/canvas-chat-panel.tsx:281-342` | Must receive mask URL from the mask canvas state and pass it to `generateImages`. |
| `canvas_graph.py` system prompt | `backend/app/agent/canvas_graph.py:175-210` | Must add editing intent classification: detect when user wants inpaint vs instruction edit vs new generation. |
| `generate_image` tool action types | `backend/app/agent/tools/image_tools.py:338` | Currently validates `action in ("variation", "img2img")`. Must add "inpaint", "erase", "outpaint". |
| `SSECanvasGenerateEvent.action` | `lib/canvas-chat-service.ts:40` | Type union `"variation" | "img2img"` must be extended with edit actions. Frontend event parsing at line 97 must handle new action types. |
| `CanvasImageContext` DTO | `lib/canvas-chat-service.ts:15-23`, `backend/app/routes/canvas_sessions.py:41-60` | Needs mask_url field to pass mask data to the backend agent for routing decisions. |
| `seedModelSlotDefaults()` inpaint/outpaint rows | `lib/db/queries.ts:729-735` | Currently `modelId: null` for inpaint and outpaint. Needs migration or update to set default models. |
| Undo/Redo keyboard shortcuts | `lib/canvas-detail-context.tsx:166-203` | Ctrl+Z in mask-painting mode should undo mask strokes (separate stack), not image undo. Need to intercept when edit mode is active. |
| Global Ctrl+Z handler | `lib/canvas-detail-context.tsx:175-178` | Suppresses undo when input/textarea has focus. Mask canvas is neither -- needs additional check for active edit mode to route to mask undo instead. |

---

## Decision Log Context

> No .decisions.md found.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 20 |
| REUSE recommendations | 9 |
| EXTEND recommendations | 10 |
| NEW recommendations | 6 |
| AVOID recommendations | 0 |
| Decision Log entries | 0 |
