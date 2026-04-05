# Feature: AI Image Editing Suite

**Epic:** --
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- User kann generierte Bilder nicht punktuell bearbeiten (Objekte entfernen, ersetzen, hinzufuegen)
- Fuer jede Aenderung muss ein komplett neues Bild generiert werden (txt2img/img2img)
- Kein Weg, gezielte Bereiche eines Bildes zu modifizieren ohne den Rest zu veraendern

**Solution:**
- 5 Edit-Modi im bestehenden Canvas Detail-View: Mask-Inpainting, Object Removal (Erase), Instruction Editing, Click-to-Edit (SAM), Outpainting
- Canvas-Chat als zentraler Prompt-Hub fuer alle Modi (ausser Erase)
- Canvas Agent (Backend) waehlt automatisch das richtige Modell basierend auf Kontext (Maske vorhanden? Prompt vorhanden? Outpaint-Kontext?)

**Business Value:**
- Iteratives Arbeiten: Bilder verfeinern statt neu generieren (weniger API-Kosten, schnellere Ergebnisse)
- Professionellerer Workflow: naeher an Photoshop Generative Fill / Figma AI Edit
- Neue Use Cases: Object Removal, Background Extension, Detail-Korrekturen

---

## Scope & Boundaries

| In Scope |
|----------|
| Mask-Inpainting: Brush-basierte Masken-Erstellung + Prompt -> AI fuellt maskierten Bereich |
| Object Removal (Erase): Maske malen -> ohne Prompt entfernen |
| Instruction Editing: Text-Instruktion ueber Canvas-Chat -> AI erkennt und aendert Bereich (kein Maske noetig) |
| Click-to-Edit: Objekt klicken -> SAM 2 Auto-Mask -> Prompt fuer Replacement |
| Outpainting: Bildrand erweitern in gewaehlte Richtung(en) + optionaler Prompt |
| Neue Model Slots pro Modus (inpaint, erase, outpaint) mit Smart Defaults |
| Canvas Agent erweitern: Edit-Intent-Erkennung, Modell-Routing, Mask-Verarbeitung |
| Mask Canvas Layer (HTML5 Canvas ueber dem Bild) |
| Floating Brush Toolbar (Size, Brush/Eraser Toggle, Clear) |
| Automatisches Mask-Edge-Feathering (10px Gaussian Blur) |

| Out of Scope |
|--------------|
| Mask-Persistierung in DB (Masken sind Session-only) |
| Lasso/Polygon Selection Tools |
| Multi-Layer Masken |
| Batch-Editing (gleicher Edit auf mehrere Bilder) |
| Echtzeit-Preview des Inpainting-Ergebnisses |
| Pressure Sensitivity fuer Tablets |
| Dedizierter Editor-Screen (alles im bestehenden Canvas) |
| Mobile-optimierte Brush-Interaktion |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Hybrid: Existing SSE Canvas Agent pipeline (inpaint, erase, instruction edit, outpaint) + new REST endpoint (SAM 2 segmentation) |
| Authentication | Existing `requireAuth()` session-based auth on all endpoints |
| Rate Limiting | Existing Replicate client rate-limiting queue (`lib/clients/replicate.ts`) |

### Endpoints

#### Existing Pipeline (Extended)

The inpaint, erase, instruction edit, and outpaint flows use the **existing Canvas Agent SSE pipeline**. No new HTTP endpoints needed. The `generate_image` tool returns structured parameters, and `handleCanvasGenerate` in the frontend triggers `generateImages()`.

| Method | Path | Change | Business Logic |
|--------|------|--------|----------------|
| POST | `/api/assistant/canvas/sessions` | Extend `CanvasImageContext` DTO | Add `mask_url` field for mask-aware agent routing |
| POST | `/api/assistant/canvas/sessions/{id}/messages` | No change (receives updated `image_context`) | Agent receives mask_url via image_context |
| -- | `generate_image` tool (LangGraph) | Extend actions + params | New actions: `inpaint`, `erase`, `instruction`, `outpaint`. New params: `mask_url`, `outpaint_directions`, `outpaint_size` |
| -- | `generateImages` server action | Extend input type | Accept `maskUrl`, `outpaintDirections`, `outpaintSize` |

#### New Endpoint: SAM 2 Segmentation

| Method | Path | Request | Response | Auth | Business Logic |
|--------|------|---------|----------|------|----------------|
| POST | `/api/sam/segment` | `SAMSegmentRequest` | `SAMSegmentResponse` | `requireAuth()` | Send click coordinates to SAM 2 via Replicate, return mask PNG URL |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `CanvasImageContext` (extended) | + `mask_url: Optional[HttpUrl]` | Valid URL or null | Passed to backend agent for routing decisions |
| `SAMSegmentRequest` | `image_url: string`, `click_x: number`, `click_y: number` | `click_x/y` in 0.0-1.0 range (normalized), `image_url` must be valid R2 URL | Coordinates normalized to image dimensions |
| `SAMSegmentResponse` | `mask_url: string` | Valid R2 URL | Grayscale PNG mask uploaded to R2 (temporary, TTL-based cleanup) |
| `GenerateImagesInput` (extended) | + `maskUrl?: string`, `outpaintDirections?: string[]`, `outpaintSize?: number` | `outpaintDirections` subset of `["top","bottom","left","right"]`, `outpaintSize` one of `25,50,100` | Passed through to `GenerationService.generate()` |
| `SSECanvasGenerateEvent` (extended) | `action: "variation" \| "img2img" \| "inpaint" \| "erase" \| "instruction" \| "outpaint"`, + `mask_url?: string`, `outpaint_directions?: string[]`, `outpaint_size?: number` | -- | Extends existing SSE event type |

---

## Database Schema

### Entities

| Table | Purpose | Change |
|-------|---------|--------|
| `generations` | Stores generation records | No schema change. `generationMode` column already supports arbitrary varchar(20) values. `sourceImageUrl` reused for edit source. |
| `model_slots` | Mode-based model assignment | No schema change. Existing `mode` varchar(20) column accepts new values. Seed defaults need update for `inpaint`, `erase`, `outpaint`. |

### Schema Details

No new tables. No new columns. Existing schema is sufficient:

| Table | Column | Type | Usage for Edit Suite |
|-------|--------|------|---------------------|
| `generations` | `generation_mode` | `varchar(20)` | New values: `"inpaint"`, `"erase"`, `"instruction"`, `"outpaint"` (inpaint/outpaint already in `GenerationMode` type) |
| `generations` | `source_image_url` | `text` | URL of the image being edited (reused from img2img) |
| `generations` | `model_params` | `jsonb` | Stores mask_url, outpaint config for retry/audit |
| `model_slots` | `mode` | `varchar(20)` | New values: `"erase"`, `"instruction"` (inpaint/outpaint already exist) |
| `model_slots` | `model_id` | `varchar(255)` | Currently `null` for inpaint/outpaint rows. Will be populated with defaults |

### Type Extension

| Type | Current Values | Added Values |
|------|----------------|--------------|
| `GenerationMode` (`lib/types.ts:19`) | `"txt2img" \| "img2img" \| "upscale" \| "inpaint" \| "outpaint"` | `"erase"`, `"instruction"` |
| `VALID_GENERATION_MODES` (`lib/types.ts:26`) | `["txt2img", "img2img", "upscale", "inpaint", "outpaint"]` | + `"erase"`, `"instruction"` |

### Seed Defaults Update

| Mode | Slot | Default Model | Replicate ID |
|------|------|---------------|--------------|
| `inpaint` | 1 | FLUX Fill Pro | `black-forest-labs/flux-fill-pro` |
| `erase` | 1 | Bria Eraser | `bria/eraser` |
| `erase` | 2 | -- | `null` |
| `erase` | 3 | -- | `null` |
| `instruction` | 1 | FLUX Kontext Pro | `black-forest-labs/flux-kontext-pro` |
| `instruction` | 2 | -- | `null` |
| `instruction` | 3 | -- | `null` |
| `outpaint` | 1 | FLUX Fill Pro | `black-forest-labs/flux-fill-pro` |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `GenerationService.generate()` | Orchestrate edit generation | `GenerateImagesInput` (extended) | `Generation[]` | DB writes (generation records), Replicate API call |
| `GenerationService.buildReplicateInput()` | Build mode-specific Replicate API input (inpaint: image+mask+prompt, erase: image+mask, instruction: image+prompt, outpaint: extended-image+mask+prompt) | `Generation` + mode | `Record<string, unknown>` | None |
| `SAMService` (new) | SAM 2 segmentation | `image_url`, `click_x`, `click_y` | `mask_url` (R2) | R2 upload (temporary mask), Replicate API call |
| `MaskService` (new, frontend) | Canvas mask operations | HTML5 Canvas ImageData | Grayscale PNG Blob | None (pure computation) |
| Canvas Agent (extended) | Edit intent classification + routing. Mask present + prompt → action="inpaint". Mask present + no prompt → action="erase". No mask + edit intent → action="instruction". Outpaint context → action="outpaint" | User message + `CanvasImageContext` (with mask_url) | `generate_image` tool call with appropriate action | None |

### Business Logic Flow

```
[User Action] → [Frontend State Machine] → [Canvas Agent SSE]
                                               ↓
                                    [Intent Classification]
                                               ↓
                              ┌─────────────────┼─────────────────┐
                              ↓                 ↓                 ↓
                    [Mask + Prompt]     [No Mask + Edit]    [Outpaint Config]
                    action="inpaint"   action="instruction"  action="outpaint"
                              ↓                 ↓                 ↓
                    [generate_image tool returns params]
                              ↓
                    [SSE event → Frontend]
                              ↓
                    [generateImages() server action]
                              ↓
                    [GenerationService.generate()]
                              ↓
                    [buildReplicateInput() — mode-specific]
                              ↓
                    [Replicate API call]
                              ↓
                    [Polling → PUSH_UNDO → Display Result]


[Erase Flow — No Agent]
[User paints mask] → [Clicks "Entfernen"] → [generateImages() directly]
                                               ↓
                                    [GenerationService.generate() with mode="erase"]
                                               ↓
                                    [Replicate API: Bria Eraser]
                                               ↓
                                    [Polling → PUSH_UNDO → Display Result]


[SAM Flow]
[User clicks on image] → [POST /api/sam/segment]
                              ↓
                    [SAMService → Replicate meta/sam-2]
                              ↓
                    [Mask PNG → R2 upload → mask_url]
                              ↓
                    [Frontend renders mask overlay]
                              ↓
                    [User continues to Inpaint/Erase flow]
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `generationMode` | Must be in `VALID_GENERATION_MODES` (extended with `erase`, `instruction`) | "Ungueltiger Generierungsmodus" |
| `maskUrl` | Required when `generationMode` is `"inpaint"` or `"erase"` | "Maske ist erforderlich fuer Inpaint/Erase" |
| `sourceImageUrl` | Required for all edit modes (`inpaint`, `erase`, `instruction`, `outpaint`) | "Source-Image ist erforderlich" |
| `outpaintDirections` | Required when `generationMode` is `"outpaint"`, subset of `["top","bottom","left","right"]` | "Mindestens eine Richtung erforderlich" |
| `outpaintSize` | Required when `generationMode` is `"outpaint"`, one of `25, 50, 100` | "Ungueltiger Erweiterungswert" |
| `click_x` / `click_y` (SAM) | Float in range 0.0–1.0 | "Koordinaten muessen normalisiert sein (0-1)" |
| Mask minimum size | Mask bounding box >= 10px in both dimensions | "Markiere einen groesseren Bereich" (frontend validation) |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| SAM endpoint | `requireAuth()` session check | Same as all existing API routes |
| Canvas Agent SSE | Existing session-based auth | No change |
| `generateImages` server action | `requireAuth()` | No change |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Mask PNG (R2) | Temporary storage, signed URLs | Masks uploaded to R2 with TTL-based cleanup (24h). Not persisted in DB |
| Click coordinates | Normalized (0-1 range) | No raw pixel coordinates exposed to API |
| Image URLs | Existing R2 signed URL pattern | No change |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| `mask_url` | Must be valid R2 URL (domain check) | Prevent SSRF: validate URL against allowed R2 domain |
| `click_x` / `click_y` | Float, range 0.0-1.0 | Clamp to valid range |
| `outpaintDirections` | Array of known strings | Filter unknown values |
| `outpaintSize` | Integer, one of [25, 50, 100] | Reject invalid values |
| Mask PNG content | Validate PNG header, max file size (10MB) | Prevent malformed uploads |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| SAM segmentation | Existing Replicate rate limiter | Per-user | Queue-based backpressure |
| Edit generations | Existing Replicate rate limiter | Per-user | Queue-based backpressure |
| Mask uploads (R2) | 10MB max per upload | Per request | 413 response |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Frontend Components | Mask Canvas, Floating Toolbar, Outpaint Controls, State Machine | React components with `useReducer` |
| Frontend Context | Edit mode state, mask data, brush settings | EXTEND `CanvasDetailState` + `canvasDetailReducer` |
| Frontend Services | Mask-to-PNG conversion, feathering, coordinate mapping | Pure utility functions |
| Canvas Chat Panel | Trigger edit generation via SSE pipeline | EXTEND `handleCanvasGenerate` |
| Server Actions | `generateImages()` extended for edit modes | EXTEND `app/actions/generations.ts` |
| Generation Service | Mode-specific Replicate input building | EXTEND `GenerationService.generate()` + `buildReplicateInput()` |
| SAM API Route | New REST endpoint for segmentation | NEW `app/api/sam/segment/route.ts` (Next.js route handler) |
| Canvas Agent (Python) | Intent classification, model routing | EXTEND `canvas_graph.py` + `generate_image` tool |
| Replicate Client | API calls to models | REUSE existing rate-limited client |
| R2 Storage | Mask PNG upload | REUSE existing `StorageService.upload()` |

### Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend                                                          │
│                                                                    │
│  [MaskCanvas] ──mask data──► [MaskService] ──PNG blob──► [R2]     │
│       │                                                    │       │
│       ▼                                                    ▼       │
│  [CanvasDetailState] ────► [CanvasChatPanel] ──SSE──► [Canvas Agent]
│       │                         │                          │       │
│       │                         ▼                          ▼       │
│       │                   [handleCanvasGenerate]    [generate_image tool]
│       │                         │                          │       │
│       │                         ▼                          │       │
│       │                   [generateImages()]               │       │
│       │                         │                          │       │
└───────┼─────────────────────────┼──────────────────────────┼───────┘
        │                         │                          │
┌───────┼─────────────────────────┼──────────────────────────┼───────┐
│ Backend                         ▼                          │       │
│                         [GenerationService]                │       │
│                              │                             │       │
│                              ▼                             │       │
│                    [buildReplicateInput()]                  │       │
│                              │                             │       │
│                              ▼                             │       │
│                    [ReplicateClient.run()]                  │       │
│                              │                             │       │
│                              ▼                             │       │
│                    [Replicate API]                          │       │
│                    (FLUX Fill Pro / Bria Eraser /           │       │
│                     FLUX Kontext Pro)                       │       │
└────────────────────────────────────────────────────────────────────┘
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Mask too small | Frontend validation (< 10px) | Toast: "Markiere einen groesseren Bereich" | None |
| SAM no object found | SAM returns empty mask | Toast: "Kein Objekt erkannt. Versuche einen anderen Punkt." | Info log |
| SAM API error | Replicate timeout/error | Toast: "SAM-Fehler. Versuche manuelles Maskieren." | Error log |
| Replicate API error (inpaint/erase/outpaint) | Existing error handling in polling | Toast: error message | Error log (existing) |
| Mask upload failed | R2 upload error | Toast: "Mask-Upload fehlgeschlagen" | Error log |
| Invalid generation mode | Server-side validation | Toast: "Ungueltiger Generierungsmodus" | Warn log |
| Image size exceeds API limit (outpaint) | Frontend pre-validation | Toast: "Bild wuerde API-Limit ueberschreiten" | None |

---

## Migration Map

> Existing files that need modification. No file renames or deletions.

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/types.ts` | `GenerationMode` has 5 values, `VALID_GENERATION_MODES` has 5 entries | Add `"erase"` and `"instruction"` to both `GenerationMode` type and `VALID_GENERATION_MODES` array | 2 line changes |
| `lib/canvas-detail-context.tsx` | `CanvasDetailState` with 7 fields, 8 action types, reducer with 8 cases | Add ~6 state fields (editMode, maskData, brushSize, brushTool, outpaintDirections, outpaintSize), ~7 action types, ~7 reducer cases | State + actions + reducer extension |
| `components/canvas/canvas-toolbar.tsx` | TOOLS array with 6 entries | Add 4 new ToolDef entries (brush-edit, erase, click-edit, expand) with `toggle: true` | Array extension + new separator group |
| `components/canvas/canvas-detail-view.tsx` | 3-column layout, polling logic | Add mask overlay + floating toolbar + outpaint controls in center column. Extend polling to handle edit modes | Component composition in center column |
| `components/canvas/canvas-chat-panel.tsx` | `handleCanvasGenerate` resolves img2img slots | Extend to resolve mode-specific slots (inpaint/erase/instruction/outpaint) based on event action. Pass maskUrl, outpaintDirections, outpaintSize. Map action to `generationMode` | `handleCanvasGenerate` extension |
| `lib/canvas-chat-service.ts` | `SSECanvasGenerateEvent` with 2 actions | Extend action union to 6 (`variation`, `img2img`, `inpaint`, `erase`, `instruction`, `outpaint`). Add optional mask_url, outpaint_directions, outpaint_size fields. Extend `parseSSEEvent` | Type + parser extension |
| `app/actions/generations.ts` | `GenerateImagesInput` with 10 fields | Add maskUrl, outpaintDirections, outpaintSize fields. Pass through to GenerationService | Input type extension |
| `lib/services/generation-service.ts` | `generate()` validates 2 modes, `buildReplicateInput()` handles img2img only | Extend mode validation to 7 modes. Add inpaint/erase/instruction/outpaint branches in `buildReplicateInput()` | Validation + input building extension |
| `lib/db/queries.ts` | `seedModelSlotDefaults()` has null modelId for inpaint/outpaint | Populate with default models: FLUX Fill Pro for inpaint/outpaint, Bria Eraser for erase, FLUX Kontext Pro for instruction. Add erase + instruction seed rows | Seed data update |
| `backend/app/agent/canvas_graph.py` | System prompt with variation/img2img intents, no mask awareness | Add edit intent classification rules, mask-aware routing, outpaint context recognition | System prompt extension |
| `backend/app/agent/tools/image_tools.py` | `generate_image` tool accepts 2 actions, 4 params | Extend to 6 actions (`variation`, `img2img`, `inpaint`, `erase`, `instruction`, `outpaint`). Add mask_url, outpaint_directions, outpaint_size params | Tool signature + validation extension |
| `backend/app/routes/canvas_sessions.py` | `CanvasImageContext` with 7 fields | Add `mask_url: Optional[HttpUrl]` field | DTO extension |

### New Files

| New File | Purpose | Pattern |
|----------|---------|---------|
| `components/canvas/mask-canvas.tsx` | HTML5 Canvas overlay for mask painting | New component (no existing canvas drawing pattern) |
| `components/canvas/floating-brush-toolbar.tsx` | Floating toolbar with brush controls | New component (follows ToolbarButton style) |
| `components/canvas/outpaint-controls.tsx` | Direction + size selection at image edges | New component |
| `lib/services/mask-service.ts` | Mask-to-PNG conversion, feathering, coordinate scaling | New utility service |
| `app/api/sam/segment/route.ts` | SAM 2 segmentation endpoint | Next.js route handler pattern (like existing API routes) |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Mask is session-only (not in DB) | Mask data lives in React state (`CanvasDetailState`). Lost on navigation/refresh | Store as `ImageData` in reducer state. Convert to PNG only on submit |
| Mask-Canvas must align pixel-perfectly with image | Display vs original resolution mismatch | Render mask at display resolution, export with scale factor (`original / display`). Use `CanvasImage` `<img>` ref for dimensions |
| Existing `SET_ACTIVE_TOOL` toggle pattern must be preserved | Edit tools must participate in mutual exclusion with existing tools | Use same `activeToolId` field. Detect edit tool IDs in reducer to show/hide mask-related UI |
| Erase flow bypasses Canvas Agent | No LLM routing needed for mask-only removal | `handleEraseAction()` calls `generateImages()` directly with mode="erase", skipping SSE pipeline |
| Canvas Agent is stateless per message | Mask context must be passed with every message | `mask_url` in `CanvasImageContext` DTO. Agent checks for mask presence to route intent |
| `GenerationService.generate()` rejects unknown modes | Mode validation at line 350 is a hard blocker | Extend validation array to include `"inpaint"`, `"erase"`, `"outpaint"` |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Inpainting | FLUX Fill Pro (Black Forest Labs) | Replicate API `black-forest-labs/flux-fill-pro` | Latest stable on Replicate (no pinned version — Replicate manages model versions) | Input: image + mask (grayscale PNG) + prompt. Output: edited image |
| Object Removal | Bria Eraser | Replicate API `bria/eraser` | Latest stable on Replicate | Input: image + mask. No prompt. Trained on licensed data (commercially safe) |
| Instruction Editing | FLUX Kontext Pro (Black Forest Labs) | Replicate API `black-forest-labs/flux-kontext-pro` | Latest stable on Replicate | Input: image + text instruction. No mask. Up to 8x faster than competitors |
| Auto-Segmentation | SAM 2 (Meta) | Replicate API `meta/sam-2` | Latest stable on Replicate | Input: image + point coordinates. Output: segmentation mask. Open source, zero licensing fees |
| Outpainting | FLUX Fill Pro (reused) | Same as Inpainting | Same as above | Input: extended canvas (image + padding) + mask (extended area) + prompt |
| Image Processing | sharp | npm `sharp@^0.34.5` | 0.34.5 (in package.json) | Server-side: outpaint canvas extension (add padding to image). Already in dependencies |
| Frontend Framework | Next.js | App Router | 16.1.6 (in package.json) | Route handler for SAM endpoint, server actions for generation |
| Replicate SDK | replicate | npm `replicate@^1.4.0` | 1.4.x (in package.json) | Existing client with rate limiting |
| R2 Storage | Cloudflare R2 via AWS S3 SDK | `@aws-sdk/client-s3@^3.1003.0` | 3.1003.x (in package.json) | Mask PNG temporary upload |
| Canvas Agent | LangGraph + LangChain | Python `langgraph` + `langchain-core` + `langchain-openai` | As in `backend/requirements.txt` (unpinned) | Agent graph extension for edit intent routing |
| Image Processing (Backend) | Pillow | Python `Pillow` | As in `backend/requirements.txt` (unpinned) | SAM mask post-processing if needed |

> **Note on Replicate model versions:** Replicate hosts model versions centrally. The model identifier (e.g., `black-forest-labs/flux-fill-pro`) always resolves to the latest stable version. No version pinning needed — Replicate handles backwards compatibility.

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Latency (Inpaint/Erase/Outpaint) | Result in < 30s (p95) | Async polling (existing pattern). Loading overlay with spinner. Replicate warm model inference ~5-15s | Monitor Replicate prediction duration via existing polling |
| Latency (SAM segmentation) | Auto-mask in < 5s | Dedicated lightweight endpoint. SAM 2 on Replicate typically 2-5s | Measure `/api/sam/segment` response time |
| Latency (Mask painting) | Real-time (< 16ms per frame) | HTML5 Canvas 2D context. No React re-renders during painting. RequestAnimationFrame for smooth strokes | Manual testing: painting must feel instant (60fps) |
| UX Responsiveness | Mask persists across tool switches | State in `CanvasDetailState` reducer (not component-local). Mask survives tool toggle | Test: switch tools, verify mask still visible on return |
| Reliability | No data loss on API error | Mask + original image preserved on error. Toast notification. User can retry | Test: simulate API error, verify mask + image intact |
| Undo/Redo | Full undo for image edits, separate undo for mask strokes | Image undo: existing PUSH_UNDO stack. Mask undo: separate stack in MaskCanvas component | Test: Ctrl+Z undoes mask stroke (not image) in paint mode |
| Image Quality | No visible seams at mask edges | 10px Gaussian Blur feathering on mask before API call | Visual inspection of inpaint results at mask boundaries |
| Max Image Size | Respect Replicate model limits | Pre-validate outpaint result dimensions. FLUX Fill Pro: max ~2048x2048 (megapixel limit) | Frontend validation before API call |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| SAM segmentation duration | Histogram | < 5s p95 | > 10s |
| Inpaint/Erase generation duration | Histogram (existing) | < 30s p95 | > 60s |
| Mask upload size | Gauge | < 5MB average | > 10MB |
| Edit mode usage | Counter per mode | -- | -- (analytics) |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| FLUX Fill Pro accepts grayscale PNG masks | Replicate API docs confirm: `mask` input is "black and white image. White areas will be inpainted" | Would need mask format conversion. Low risk — well documented |
| Bria Eraser works without prompt | Replicate model page confirms: mask-only input, no prompt needed | Would need to fall back to FLUX Fill Pro with empty prompt. Low risk |
| SAM 2 on Replicate accepts normalized coordinates | Replicate docs for meta/sam-2 accept point prompts | If pixel coordinates needed: denormalize server-side using image dimensions. Low risk |
| Mask canvas resolution mapping is sufficient | `canvas.toDataURL()` exports at canvas element size. Scale factor `original / display` maps correctly | Off-by-one pixel errors at edges. Mitigated by feathering |
| Existing polling pattern works for edit modes | Same Replicate prediction flow as txt2img/img2img | Already proven pattern. No risk |
| `CanvasImage` `<img>` tag exposes dimensions for mask alignment | `crossOrigin="anonymous"` already set at line 98. `naturalWidth/naturalHeight` available | Would need alternative dimension source. Very low risk |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| SAM 2 cold start latency > 10s on Replicate | Medium | Medium | Show loading indicator immediately. Timeout after 30s | Suggest manual mask painting via Brush Edit |
| Mask-to-image coordinate drift on responsive layouts | Low | High | Lock mask canvas dimensions to `<img>` rendered dimensions. Recalculate on resize via ResizeObserver | Re-paint mask if drift detected |
| Outpaint canvas exceeds Replicate megapixel limit | Medium | Medium | Pre-calculate result dimensions. Block if > 2048px in either dimension. Show warning with max allowed size | Suggest smaller expansion percentage |
| Multiple rapid edit requests overload Replicate queue | Low | Medium | Existing rate limiter in `ReplicateClient`. Disable UI during generation (`isGenerating` state) | Queue-based backpressure already handles this |
| Canvas Agent misclassifies edit intent vs generate intent | Medium | Low | Clear system prompt rules for intent classification. Mask presence is strongest signal (deterministic, not LLM) | User can explicitly switch to txt2img mode |
| Browser memory pressure from large mask canvases | Low | Medium | Mask canvas matches image display size (not original). Single canvas layer (no multi-layer) | Clear mask explicitly. Canvas GC on tool deactivation |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Mask Drawing | HTML5 Canvas 2D API | Native browser API. No library dependency. Full control over brush rendering, export, and feathering |
| Mask Feathering | Canvas 2D `filter: blur(10px)` or manual Gaussian kernel | CSS filter on canvas is fastest. Fallback: manual convolution for exact control |
| Mask Export | `canvas.toBlob('image/png')` + grayscale conversion | Native API. Convert RGBA mask to grayscale (white=edit, black=keep) before upload |
| SAM Endpoint | Next.js Route Handler (`app/api/sam/segment/route.ts`) | Consistent with existing API patterns. Server-side Replicate call |
| Outpaint Canvas Extension | `sharp` (server-side) | Already in dependencies. Extend image canvas with transparent padding before upload |
| State Management | Extend existing `CanvasDetailState` reducer | Consistent with codebase. No new state library. Mask data + edit mode in same reducer |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Separate models per mode (FLUX Fill, Bria Eraser, FLUX Kontext) vs single model | Better quality per mode. Specialized training. Bria commercially safe | More model slots to manage. Multiple API endpoints | Model Slot system already handles per-mode assignment. Defaults handle DX |
| Mask upload to R2 vs Data-URL inline | Consistent with existing image pipeline. No request body size limits. Mask available for retry | Extra upload latency (~200ms). Temporary storage cost | R2 upload is fast. TTL-based cleanup. Retry reliability outweighs latency |
| SAM as separate REST endpoint vs through Canvas Agent | Simpler. No LLM overhead for a deterministic operation. Faster response | Different communication pattern than other edit flows | SAM is a pre-step (mask generation), not a generation flow. Separate endpoint is cleaner |
| Mask undo as separate stack vs extending existing undo | Clean separation: mask strokes vs image edits. No confusion on Ctrl+Z behavior | Two undo stacks to manage. User mental model split | Clear UX: Ctrl+Z in paint mode = mask undo. Toolbar Undo button = image undo |
| Frontend mask validation (min size) vs server-side | Instant feedback. No wasted API call | Could be bypassed (low risk — no security impact) | Validation is UX-only. Server accepts any mask. Bad masks just produce bad results |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Ein Modell fuer alle vs separate Modelle? | A) FLUX.2 Pro fuer alles B) Separate (FLUX Fill, Bria, Kontext) | B) Separate | **B) Separate** — spezialisierte Modelle, bessere Ergebnisse. Bria ist kommerziell sicher. Model Slot System handhabt die Komplexitaet |
| 2 | Mask-Upload: Data-URL oder R2? | A) Data-URL B) R2 Upload | B) R2 | **B) R2** — konsistent mit bestehender Pipeline, kein Body-Size-Limit, Mask fuer Retry verfuegbar |
| 3 | SAM 2 Latenz akzeptabel? | Typisch 2-5s auf Replicate | Akzeptabel mit Loading-Indicator | **Akzeptabel** — Loading Indicator + Timeout nach 30s + Fallback auf manuelles Masken |

---

## Context & Research

### Codebase Analysis (via Scanner)

- 20 Patterns identifiziert: 9 REUSE, 10 EXTEND, 6 NEW
- Kritischer Blocker: `GenerationService.generate()` at line 350 rejects all modes except txt2img/img2img
- `GenerationMode` type already includes `inpaint` + `outpaint` (but not `erase`)
- Model Slots for inpaint/outpaint exist with `modelId: null` — need default population
- `CanvasImage` has `crossOrigin="anonymous"` already set — required for canvas operations
- Capability Detection already detects inpaint capability (image + mask schema fields)
- Canvas Agent system prompt only knows variation/img2img intents — needs edit intent rules
- Global Ctrl+Z handler at `canvas-detail-context.tsx:175-178` needs mask-mode interception

### Web Research

| Model | Key Finding |
|-------|-------------|
| FLUX Fill Pro | SOTA inpainting + outpainting. Input: image + mask (grayscale PNG) + prompt. Handles complex scenes, text, lighting |
| Bria Eraser | Specialized object removal. No prompt needed. Trained on licensed data — commercially safe |
| FLUX Kontext Pro | Instruction-based editing without mask. Up to 8x faster than GPT-Image. Character consistency across edits |
| SAM 2 (Meta) | Click-based segmentation. Zero-shot. Open source. Available on Replicate as `meta/sam-2` |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-04 | Codebase | `GenerationService.generate()` line 350 is primary backend blocker — rejects non-txt2img/img2img modes |
| 2026-04-04 | Codebase | `GenerationMode` type already has `inpaint` + `outpaint`. Missing: `erase` |
| 2026-04-04 | Codebase | `model_slots` seed rows exist for inpaint/outpaint with `modelId: null`. No erase rows |
| 2026-04-04 | Codebase | `generate_image` tool validates `action in ("variation", "img2img")` — must add 3 new actions |
| 2026-04-04 | Codebase | `SSECanvasGenerateEvent.action` type union is `"variation" \| "img2img"` — must extend |
| 2026-04-04 | Codebase | `handleCanvasGenerate` hardcodes `resolveActiveSlots(modelSlots, "img2img")` — must use mode-specific resolution |
| 2026-04-04 | Codebase | Canvas Agent system prompt in `canvas_graph.py:175-210` only knows variation/img2img |
| 2026-04-04 | Codebase | `CanvasImage` has `crossOrigin="anonymous"` at line 98 — enables canvas operations |
| 2026-04-04 | Codebase | Global Ctrl+Z at `canvas-detail-context.tsx:175-178` needs mask-mode interception |
| 2026-04-04 | Web | FLUX Fill Pro available on Replicate as `black-forest-labs/flux-fill-pro` — accepts image + mask + prompt |
| 2026-04-04 | Web | Bria Eraser available on Replicate as `bria/eraser` — mask-only, no prompt, commercially safe |
| 2026-04-04 | Web | FLUX Kontext Pro available on Replicate as `black-forest-labs/flux-kontext-pro` — instruction editing, up to 8x faster |
| 2026-04-04 | Web | SAM 2 available on Replicate as `meta/sam-2` — click-based segmentation, open source |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Soll erst umfassend recherchiert oder direkt gestartet werden? | Direkt starten — Discovery ist sehr detailliert, Codebase Scanner liefert Pattern-Basis |
| 2 | Architecture-Tiefe: Kurz, Standard oder Detailliert? | Detailliert — Feature ist komplex (5 Edit-Modi, 4 externe APIs, Frontend Canvas + Backend Agent) |
| 3 | Ein Modell fuer alle Edit-Modi oder separate Modelle? | Separate Modelle — bessere Qualitaet, Bria kommerziell sicher, Model Slot System handhabt Komplexitaet |
| 4 | Mask-Upload als Data-URL oder R2? | R2 Upload — konsistent mit Pipeline, kein Size-Limit, Retry-faehig |
| 5 | SAM 2 Latenz akzeptabel? | Ja, 2-5s mit Loading-Indicator. Timeout 30s, Fallback auf manuelles Masken |
