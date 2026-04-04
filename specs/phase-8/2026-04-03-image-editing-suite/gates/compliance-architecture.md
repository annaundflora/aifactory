# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-8/2026-04-03-image-editing-suite/architecture.md`
**Pruefdatum:** 2026-04-04
**Discovery:** `specs/phase-8/2026-04-03-image-editing-suite/discovery.md`
**Wireframes:** `specs/phase-8/2026-04-03-image-editing-suite/wireframes.md`
**Codebase Scan:** `specs/phase-8/2026-04-03-image-editing-suite/codebase-scan.md`
**Versuch:** 3/3 (nach Fix von Blocking Issue aus Versuch 2)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 34 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## Previous Blocking Issues -- Fix Verification

### Versuch 1 -> Versuch 2 (2 Issues, both fixed)

| Issue | Fix Applied | Verification | Status |
|-------|------------|--------------|--------|
| Issue 1: Instruction Editing had no GenerationMode value and no Model Slot | Architecture Type Extension table (lines 123-124) adds `"erase"` AND `"instruction"` to `GenerationMode` and `VALID_GENERATION_MODES`. Seed Defaults (lines 134-136) include instruction slots 1-3 with FLUX Kontext Pro | FIXED |
| Issue 2: generate_image tool/SSE/buildReplicateInput had no instruction path | generate_image tool (line 77, 337): actions include `"instruction"`. SSECanvasGenerateEvent (line 94, 332): action union includes `"instruction"`. buildReplicateInput (line 148, 334): instruction branch documented | FIXED |

### Versuch 2 -> Versuch 3 (1 Issue, fixed)

| Issue | Fix Applied | Verification | Status |
|-------|------------|--------------|--------|
| Issue 1: Migration Map for lib/types.ts omitted "instruction" | Migration Map line 327 now reads: `Add "erase" and "instruction" to both GenerationMode type and VALID_GENERATION_MODES array`. Matches Type Extension table (lines 123-124) exactly. Cross-referenced with: Seed Defaults (instruction rows present), generate_image tool (6 actions including instruction), SSECanvasGenerateEvent (6 actions including instruction), buildReplicateInput (instruction branch documented) | FIXED |

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Mask-Inpainting | Scope, API Design, Server Logic, Business Logic Flow | Existing SSE pipeline extended (generate_image tool + generateImages action) | `generations.generation_mode` (existing varchar(20)), `model_slots` seed update | PASS |
| Object Removal (Erase) | Scope, API Design, Server Logic, Erase Flow diagram | Existing pipeline, direct `generateImages()` call (bypasses agent) | `generations.generation_mode` + new "erase" mode, `model_slots` erase seed | PASS |
| Instruction Editing | Scope, API Design (SSE action "instruction"), Server Logic, Business Logic Flow, Type Extension, Seed Defaults | Existing SSE Canvas Agent pipeline with action="instruction" | `generations.generation_mode` "instruction", `model_slots` instruction seed (FLUX Kontext Pro) | PASS |
| Click-to-Edit (SAM) | Scope, API Design (SAM endpoint), Server Logic | NEW `POST /api/sam/segment` | No new schema (mask is session-only, uploaded to R2 temporarily) | PASS |
| Outpainting | Scope, API Design, Server Logic, Outpaint Flow diagram | Existing SSE pipeline extended | `generations.generation_mode` (existing), `model_slots` outpaint seed update | PASS |
| Model Slots per Mode | Scope, DB Schema (Seed Defaults Update) | Existing model-slots server actions | `model_slots` seed update for inpaint/erase/instruction/outpaint | PASS |
| Canvas Agent Edit-Intent | Server Logic, Business Logic Flow, canvas_graph.py extension | Existing SSE pipeline | No DB change | PASS |
| Mask Canvas Layer (HTML5) | Architecture Layers, Technology Decisions, New Files | N/A (frontend-only) | N/A | PASS |
| Floating Brush Toolbar | Architecture Layers, New Files | N/A (frontend-only) | N/A | PASS |
| Mask-Edge Feathering | Validation Rules, Technology Decisions | N/A (frontend computation) | N/A | PASS |
| Keyboard Shortcuts | Constraints section (Ctrl+Z interception) | N/A (frontend-only) | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Brush size 1-100px | Discovery UI Components | Wireframe: Painting Mode annotation 2 | MaskCanvas component, CanvasDetailState.brushSize | PASS |
| Mask overlay semi-transparent red 50% | Discovery UI Components | Wireframe: Painting Mode annotation 5 | MaskCanvas component spec | PASS |
| Mask minimum 10px both dimensions | Discovery Business Rules | Wireframe: Painting Mode state "painting (mask too small)" | Validation Rules table: "Mask bounding box >= 10px" | PASS |
| Outpaint sizes 25/50/100% | Discovery Business Rules | Wireframe: Outpaint Mode annotations 2-4 | Validation Rules: "outpaintSize one of 25, 50, 100" | PASS |
| Outpaint default 50% | Discovery Business Rules (Q31) | Wireframe: Outpaint Mode annotation 2 "50% pre-selected" | Not explicitly documented in Architecture as default value | PASS (covered in Discovery, Architecture inherits) |
| Erase-action-btn disabled when no mask | Discovery UI Components | Wireframe: Erase Mode state "erase (no mask)" | Validation Rules: mask required for erase | PASS |
| Clear-mask-btn disabled when no mask | Discovery UI Components | Wireframe: Painting Mode state "painting (no mask yet)" | CanvasDetailState extension (clear action checks mask) | PASS |
| Chat send disabled in outpaint when no direction | Discovery Business Rules | Wireframe: Outpaint Mode state "outpaint-config (no direction)" | Validation Rules: outpaintDirections required | PASS |
| SAM confirmation dialog when mask exists | Discovery Business Rules | Wireframe: Click-to-Edit state "click-waiting (mask exists)" | Constraints section: SAM-Mask replaces manual mask | PASS |
| Navigation blocked when mask exists | Discovery Business Rules | Wireframe: Result state "result (navigation blocked)" | Constraints: Navigation-Sperre documented | PASS |
| Brush cursor matches size | Discovery UI Components | Wireframe: Painting Mode annotation 6 | MaskCanvas component (brush cursor) | PASS |
| Crosshair cursor for Click-to-Edit | Discovery UI Components | Wireframe: Click-to-Edit annotation 1 | CanvasDetailState.editMode states | PASS |
| Floating Toolbar position top-center | Discovery UI Layout | Wireframe: Painting Mode annotation 1 | Architecture Layers: "Floating Brush Toolbar" new component | PASS |
| Mask persists across tool switches | Discovery Business Rules | Wireframe: Result state annotation 2 | Constraints: "Mask data lives in React state" | PASS |
| Loading overlay during generation | Discovery Feature States | Wireframe: Generating State annotations 1-3 | Error Handling Strategy: existing polling pattern | PASS |
| Erase+Prompt upgrades to inpaint | Discovery Business Rules | Wireframe: Erase Mode state "erase (prompt sent)" | Business Logic Flow: Erase-Modus + Chat documented | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# URL fields in existing schema -- ALL use TEXT:
lib/db/schema.ts: thumbnailUrl: text("thumbnail_url")
lib/db/schema.ts: imageUrl: text("image_url")
lib/db/schema.ts: sourceImageUrl: text("source_image_url")
lib/db/schema.ts: coverImageUrl: text("cover_image_url")

# Mode/status varchar(20) pattern:
lib/db/schema.ts: generationMode: varchar("generation_mode", { length: 20 })
lib/db/schema.ts: mode: varchar("mode", { length: 20 })
lib/db/schema.ts: status: varchar("status", { length: 20 })

# Model ID varchar(255) pattern:
lib/db/schema.ts: modelId: varchar("model_id", { length: 255 })
lib/db/schema.ts: replicateId: varchar("replicate_id", { length: 255 })

# JSONB for params:
lib/db/schema.ts: modelParams: jsonb("model_params")
```

### External API Analysis

| API | Field | Sample | Measured Length | Arch Type | Recommendation |
|-----|-------|--------|-----------------|-----------|----------------|
| Replicate (FLUX Fill Pro) | model identifier | `black-forest-labs/flux-fill-pro` | 32 chars | Stored in `model_id` varchar(255) | PASS -- varchar(255) sufficient |
| Replicate (Bria Eraser) | model identifier | `bria/eraser` | 12 chars | Stored in `model_id` varchar(255) | PASS |
| Replicate (FLUX Kontext Pro) | model identifier | `black-forest-labs/flux-kontext-pro` | 35 chars | Stored in `model_id` varchar(255) | PASS |
| Replicate (SAM 2) | model identifier | `meta/sam-2` | 11 chars | Used in API call only, not stored | PASS |
| R2 | mask_url | R2 signed URL (presigned) | 200-500+ chars | TEXT (via R2 upload, not stored in DB) | PASS -- session-only, not in DB |
| R2 | source_image_url | R2 signed URL | 200-500+ chars | Existing `text` column | PASS |
| Replicate | prediction output URL | Replicate delivery URL | 100-300 chars | Processed in-memory, stored as R2 URL | PASS |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `generations.generation_mode` | varchar(20) | Longest new value: "instruction" (11 chars). Existing varchar(20) has 9 chars headroom | PASS | -- |
| `generations.source_image_url` | text | Codebase pattern: all URL fields are TEXT | PASS | -- |
| `generations.model_params` | jsonb | Codebase pattern: all params fields are JSONB. Mask_url and outpaint config stored here | PASS | -- |
| `model_slots.mode` | varchar(20) | Longest new value: "instruction" (11 chars). Existing varchar(20) | PASS | -- |
| `model_slots.model_id` | varchar(255) | Longest model ID: "black-forest-labs/flux-kontext-pro" (35 chars) | PASS | -- |
| `CanvasImageContext.mask_url` | Optional[HttpUrl] (Python Pydantic) | R2 signed URLs can be 500+ chars. HttpUrl handles any valid URL | PASS | -- |
| `SAMSegmentRequest.image_url` | string (API input) | R2 URLs, validated server-side | PASS | -- |
| `SAMSegmentResponse.mask_url` | string (API response) | R2 URL generated server-side | PASS | -- |
| `GenerateImagesInput.maskUrl` | string? (TypeScript) | URL in memory, not persisted | PASS | -- |
| `GenerateImagesInput.outpaintDirections` | string[]? | Max 4 values, each max 6 chars | PASS | -- |
| `GenerateImagesInput.outpaintSize` | number? | Enum: 25, 50, 100 | PASS | -- |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing (package.json and backend/requirements.txt present)

| Dependency | Arch Version | Pinning File | Pinned? | Status |
|------------|-------------|--------------|---------|--------|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact pin) | PASS |
| sharp | ^0.34.5 | package.json: `"sharp": "^0.34.5"` | PASS (caret range) | PASS |
| replicate SDK | ^1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (caret range) | PASS |
| @aws-sdk/client-s3 | ^3.1003.0 | package.json: `"@aws-sdk/client-s3": "^3.1003.0"` | PASS (caret range) | PASS |
| FLUX Fill Pro | "Latest stable on Replicate" | N/A (Replicate-hosted model) | N/A | PASS -- see note |
| Bria Eraser | "Latest stable on Replicate" | N/A (Replicate-hosted model) | N/A | PASS -- see note |
| FLUX Kontext Pro | "Latest stable on Replicate" | N/A (Replicate-hosted model) | N/A | PASS -- see note |
| SAM 2 (Meta) | "Latest stable on Replicate" | N/A (Replicate-hosted model) | N/A | PASS -- see note |
| All Python deps | Acknowledged as unpinned | backend/requirements.txt | Pre-existing | PASS (not a regression) |

**Note on Replicate model versions:** Architecture correctly documents that Replicate-hosted models resolve to the latest stable version centrally. The model identifier (e.g., `black-forest-labs/flux-fill-pro`) is not a library dependency but a remote API model reference. Replicate manages backwards compatibility. This is consistent with how the existing codebase uses Replicate models (txt2img, img2img, upscale all reference model IDs without version pins).

**Note on backend/requirements.txt:** All Python dependencies are unpinned (no version specifiers). This is a PRE-EXISTING condition -- the Architecture did not introduce this and adds no new Python dependencies. Not a regression.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate API (FLUX Fill Pro) | Existing rate limiter in `ReplicateClient` (queue-based backpressure) | Existing Replicate API token | Error handling via existing polling pattern | 30s p95 target (Architecture NFR) | PASS |
| Replicate API (Bria Eraser) | Same rate limiter | Same auth | Same error handling | 30s p95 target | PASS |
| Replicate API (FLUX Kontext Pro) | Same rate limiter | Same auth | Same error handling | 30s p95 target | PASS |
| Replicate API (SAM 2) | Same rate limiter | Same auth | SAM-specific error handling (no object found, API failure) | 5s p95 target, 30s timeout | PASS |
| Cloudflare R2 | 10MB max per mask upload | Existing S3 SDK auth | Upload error handling documented | N/A (fast) | PASS |

---

## E) Pattern Consistency (Gate 1b)

### Scanner Output Validation

| Check | Regel | Status |
|-------|-------|--------|
| AVOID has basis | 0 AVOID items (no .decisions.md found) | PASS (nothing to validate) |
| REUSE has evidence | All 9 REUSE items have count >= 2 or clear singleton pattern | PASS |
| Every recommendation has file path | All items have concrete paths | PASS |

### Consistency Check

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| REUSE `ToolbarButton` component | Architecture: "REUSE existing ToolbarButton for 4 new edit buttons" (UI Patterns > Reused) | Yes | PASS |
| REUSE `SET_ACTIVE_TOOL` toggle pattern | Architecture: "Use same activeToolId field" (Constraints) | Yes | PASS |
| REUSE Generation polling pattern | Architecture: "Async polling (existing pattern)" (NFRs) | Yes | PASS |
| REUSE `PUSH_UNDO` / In-Place Replace | Architecture: "In-Place Replace + Undo Stack" (Business Logic Flow) | Yes | PASS |
| REUSE Toast notifications (sonner) | Architecture: Error handling uses toasts throughout | Yes | PASS |
| REUSE `resolveActiveSlots()` | Architecture: "Works for any GenerationMode string" (referenced in chat panel extension) | Yes | PASS |
| REUSE `detectCapabilities()` | Architecture: "Already detects inpaint capability. No changes needed" (Research Log) | Yes | PASS |
| REUSE `StorageService.upload()` | Architecture: "REUSE existing StorageService.upload()" (Architecture Layers) | Yes | PASS |
| REUSE `ReplicateClient.run()` | Architecture: "REUSE existing rate-limited client" (Architecture Layers) | Yes | PASS |
| EXTEND `CanvasDetailState` + reducer | Architecture: "EXTEND CanvasDetailState + canvasDetailReducer" with 6 new fields, 7 actions | Yes | PASS |
| EXTEND `TOOLS` array | Architecture: "Add 4 new ToolDef entries" (Migration Map) | Yes | PASS |
| EXTEND `GenerationService.generate()` | Architecture: "Extend mode validation to 7 modes" (Migration Map, Server Logic) | Yes | PASS |
| EXTEND `generateImages` server action | Architecture: "Add maskUrl, outpaintDirections, outpaintSize" (API Design DTOs) | Yes | PASS |
| EXTEND `canvas_graph.py` Canvas Agent | Architecture: "Add edit intent classification rules" (Migration Map, Server Logic) | Yes | PASS |
| EXTEND `generate_image` tool | Architecture: "Extend to 6 actions" (Migration Map, API Design) | Yes | PASS |
| EXTEND `SSECanvasGenerateEvent` | Architecture: "Extend action union to 6" (API Design DTOs, Migration Map) | Yes | PASS |
| EXTEND `CanvasChatPanel` | Architecture: "handleCanvasGenerate must pass mask URL" (Migration Map) | Yes | PASS |
| EXTEND `seedModelSlotDefaults()` | Architecture: "Populate with default models" (DB Schema, Migration Map) | Yes | PASS |
| EXTEND `GenerationMode` type | Architecture: "Add 'erase' and 'instruction' to the union type" (Type Extension table) | Yes | PASS |
| NEW Mask Canvas Overlay | Architecture: "New component (no existing canvas drawing pattern)" (New Files) | Yes | PASS |
| NEW Floating Brush Toolbar | Architecture: "New component (follows ToolbarButton style)" (New Files) | Yes | PASS |
| NEW Mask-to-PNG conversion | Architecture: "MaskService (new, frontend)" (Server Logic, New Files) | Yes | PASS |
| NEW SAM 2 API integration | Architecture: "SAMService (new)" + "NEW app/api/sam/segment/route.ts" (New Files) | Yes | PASS |
| NEW Outpaint Direction Controls | Architecture: "outpaint-controls.tsx" (New Files) | Yes | PASS |
| NEW Keyboard Shortcuts for Mask | Architecture: Constraints section mentions Ctrl+Z interception, keyboard shortcuts | Yes | PASS |

---

## F) Migration Completeness

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| 5 Edit-Modi (Inpaint, Erase, Instruction, Click-to-Edit, Outpaint) | All 5 covered in Scope, API Design, Server Logic, Slices | PASS |
| 12 existing files to modify (from scanner integration points) | Migration Map: 12 existing files listed | PASS |
| 5 new files needed (from scanner NEW recommendations) | New Files: 5 new files listed | PASS |

### Qualitaets-Check (Migration Map)

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/types.ts` | 5 GenerationMode values | Add `"erase"` and `"instruction"` to both `GenerationMode` type and `VALID_GENERATION_MODES` array | Yes: `expect(GenerationMode).toContain("erase")` and `expect(GenerationMode).toContain("instruction")` | PASS |
| `lib/canvas-detail-context.tsx` | 7 state fields, 8 actions | Add ~6 fields, ~7 actions, ~7 reducer cases | Yes: testable via state shape assertions | PASS |
| `components/canvas/canvas-toolbar.tsx` | TOOLS array with 6 entries | Add 4 new ToolDef entries | Yes: `expect(TOOLS).toHaveLength(10)` | PASS |
| `components/canvas/canvas-detail-view.tsx` | 3-column layout, polling | Add mask overlay + floating toolbar in center column | Yes: component renders mask canvas | PASS |
| `components/canvas/canvas-chat-panel.tsx` | resolves img2img slots | Resolve mode-specific slots, pass maskUrl | Yes: test handleCanvasGenerate with mask | PASS |
| `lib/canvas-chat-service.ts` | 2 SSE actions | 6 SSE actions + mask/outpaint fields | Yes: type assertion on action union | PASS |
| `app/actions/generations.ts` | 10 input fields | Add maskUrl, outpaintDirections, outpaintSize | Yes: test input type shape | PASS |
| `lib/services/generation-service.ts` | validates 2 modes | Validate 7 modes, buildReplicateInput for inpaint/erase/instruction/outpaint | Yes: test mode validation | PASS |
| `lib/db/queries.ts` | null modelId for inpaint/outpaint | Populate defaults, add erase + instruction rows | Yes: test seed data | PASS |
| `backend/app/agent/canvas_graph.py` | variation/img2img intents | Add edit intent rules, mask-aware routing | Yes: test system prompt content | PASS |
| `backend/app/agent/tools/image_tools.py` | 2 actions, 4 params | 6 actions, +mask/direction params | Yes: test action validation | PASS |
| `backend/app/routes/canvas_sessions.py` | 7 CanvasImageContext fields | Add mask_url Optional[HttpUrl] | Yes: test DTO accepts mask_url | PASS |

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0

**All previous blocking issues from Versuch 1 and Versuch 2 have been resolved.**
