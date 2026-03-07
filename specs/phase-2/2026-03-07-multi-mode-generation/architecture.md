# Feature: Multi-Mode Generation (img2img + Upscale)

**Epic:** Multi-Mode Generation
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- App supports only text-to-image generation (txt2img)
- No way to use an existing image as starting point for new generations
- No upscaling for generated images (only native model resolution)
- No UX pattern for future modes (Edit, Video, etc.)

**Solution:**
- Mode-Selector (Segmented Control) in Prompt-Area: extensible for future modes
- img2img mode: Source-Image upload + Prompt + Strength parameter
- Upscale: as own mode in Prompt-Area AND as Lightbox action
- Cross-Mode interactions from Lightbox (start img2img, execute Upscale)
- Unified gallery with filter chips by mode

**Business Value:**
- Broader workflow: users can transform and upscale existing images
- Iterative workflow: txt2img -> img2img refine -> upscale
- Extensible architecture for future modes (Edit, Video, etc.)

---

## Scope & Boundaries

| In Scope |
|----------|
| Mode-Selector (Segmented Control) at top of Prompt-Area |
| img2img mode with Source-Image Upload (Drag & Drop + Click + URL) |
| Strength-Slider with Presets (Subtle/Balanced/Creative) |
| Upscale as mode in Mode-Selector (Upload + Scale 2x/4x) |
| Upscale as Lightbox action (Popover with 2x/4x) |
| Cross-Mode: "img2img" Button in Lightbox (sets image as Source) |
| img2img Variation: loads Source-Image (not generated image) into img2img mode |
| Source-Image Upload to R2 (persistent under `sources/{projectId}/{id}`) |
| DB extension: `sourceImageUrl`, `generationMode`, `sourceGenerationId` |
| Gallery Filter-Chips: [Alle] [Text to Image] [Image to Image] [Upscale] |
| Dynamic model compatibility from Schema (image/image_prompt parameter detection) |
| Variant count (1-4) also for img2img |

| Out of Scope |
|--------------|
| Edit / Inpainting (Canvas-UI with Brush/Mask -- separate Discovery) |
| Video Generation |
| ControlNet / Depth / Canny modes |
| Model-specific img2img settings beyond Strength |
| Batch-Upload (multiple Source-Images at once) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (existing pattern) |
| Authentication | None (single-user app, no auth layer) |
| Rate Limiting | Replicate API rate limits (handled via error messages) |

### Server Actions (New / Modified)

| Action | File | Request | Response | Business Logic |
|--------|------|---------|----------|----------------|
| `generateImages` (MODIFY) | `app/actions/generations.ts` | `GenerateImagesInput` + new fields: `generationMode`, `sourceImageUrl?`, `strength?`, `sourceGenerationId?` | `Generation[] \| { error }` | Validates mode-specific inputs, delegates to GenerationService |
| `uploadSourceImage` (NEW) | `app/actions/generations.ts` | `{ projectId: string, file: File }` | `{ url: string } \| { error }` | Validates file type/size, uploads to R2 under `sources/{projectId}/{uuid}.{ext}`, returns public URL |
| `upscaleImage` (NEW) | `app/actions/generations.ts` | `{ projectId: string, sourceImageUrl: string, scale: 2 \| 4, sourceGenerationId?: string }` | `Generation \| { error }` | Creates generation with mode="upscale", calls fixed upscale model. Prompt auto-generated (see Upscale Prompt Composition). |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `GenerateImagesInput` (EXTEND) | existing + `generationMode: string`, `sourceImageUrl?: string`, `strength?: number`, `sourceGenerationId?: string` | mode must be "txt2img" or "img2img"; if img2img: sourceImageUrl required, strength 0.0-1.0 | Backwards compatible: mode defaults to "txt2img" |
| `UploadSourceImageInput` (NEW) | `projectId: string`, `file: File` | PNG/JPG/JPEG/WebP only, max 10MB | File validation on server |
| `UpscaleImageInput` (NEW) | `projectId: string`, `sourceImageUrl: string`, `scale: 2 \| 4`, `sourceGenerationId?: string` | scale must be 2 or 4, sourceImageUrl required | sourceGenerationId for Lightbox upscale; prompt auto-composed server-side |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `generations` (MODIFY) | Stores all generations across modes | + `generationMode`, `sourceImageUrl`, `sourceGenerationId` |

### Schema Changes (Drizzle)

| Table | Column | Type | Constraints | Index | Migration |
|-------|--------|------|-------------|-------|-----------|
| `generations` | `generationMode` | `varchar(20)` | NOT NULL, DEFAULT `'txt2img'` | YES (composite with `projectId`) | ADD COLUMN with default -- safe for existing data |
| `generations` | `sourceImageUrl` | `text` | NULLABLE | NO | ADD COLUMN |
| `generations` | `sourceGenerationId` | `uuid` | NULLABLE, FK -> `generations.id` ON DELETE SET NULL | NO | ADD COLUMN + FK |

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `generations.projectId` | `projects.id` | N:1 | ON DELETE CASCADE (existing) |
| `generations.sourceGenerationId` | `generations.id` | N:1 (self-ref) | ON DELETE SET NULL (new) |

### Index Strategy

| Index | Columns | Purpose |
|-------|---------|---------|
| `generations_project_mode_idx` | `(projectId, generationMode)` | Filter by mode within project (future server-side filtering) |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `GenerationService.generate` (MODIFY) | Create N pending records, process via Replicate | projectId, prompt, mode, sourceImageUrl?, strength?, count | `Generation[]` | DB inserts, Replicate API calls, R2 uploads |
| `GenerationService.upscale` (NEW) | Create 1 pending record, process via fixed upscale model | projectId, sourceImageUrl, scale, sourceGenerationId? | `Generation` | DB insert, Replicate API call, R2 upload |
| `SourceImageService` (NEW) | Upload source images to R2 | projectId, file buffer, filename | `{ url: string }` | R2 upload under `sources/{projectId}/{uuid}.{ext}` |
| `ModelSchemaService.getSchema` (EXISTING) | Fetch model input schema from Replicate | modelId | `SchemaProperties` | Cached in-memory |
| `ModelSchemaService.supportsImg2Img` (NEW helper) | Check if model has `image`, `image_prompt`, or `init_image` parameter | modelId | `boolean` | Uses cached schema |

### Business Logic Flow

#### img2img Generation
```
Client (PromptArea)
  -> uploadSourceImage (if not already uploaded)
  -> generateImages({ mode: "img2img", sourceImageUrl, strength, ... })
    -> GenerationService.generate()
      -> createGeneration() x N (with generationMode, sourceImageUrl)
      -> return pending generations
      -> (async) for each: buildReplicateInput() adds `image` + `prompt_strength`
      -> (async) ReplicateClient.run() -> streamToPngBuffer() -> StorageService.upload()
      -> (async) updateGeneration({ status: "completed", imageUrl, ... })
```

#### Upscale (Mode or Lightbox)
```
Client (PromptArea or Lightbox)
  -> upscaleImage({ sourceImageUrl, scale, sourceGenerationId? })
    -> GenerationService.upscale()
      -> createGeneration({ mode: "upscale", prompt: "Upscale {scale}x", ... })
      -> return pending generation
      -> (async) ReplicateClient.run(UPSCALE_MODEL, { image: sourceImageUrl, scale })
      -> (async) streamToPngBuffer() -> StorageService.upload()
      -> (async) updateGeneration({ status: "completed", ... })
```

### buildReplicateInput Enhancement

| Mode | Additional Input Parameters |
|------|---------------------------|
| `txt2img` | `{ prompt, negative_prompt?, ...params }` (unchanged) |
| `img2img` | `{ prompt, negative_prompt?, image: sourceImageUrl, prompt_strength: strength, ...params }` |
| `upscale` | `{ image: sourceImageUrl, scale }` (no prompt to Replicate) |

### Upscale Prompt Composition

| Path | Prompt Value Stored in DB | Logic |
|------|--------------------------|-------|
| Upscale via Mode (no sourceGenerationId) | `"Upscale {scale}x"` | No user prompt; auto-generated string |
| Upscale via Lightbox (has sourceGenerationId) | `"{originalPrompt} (Upscale {scale}x)"` | `originalPrompt` fetched from source generation's `prompt` field |

The `upscaleImage` Server Action composes the prompt:
- If `sourceGenerationId` is provided: fetch source generation, use its `prompt` + ` (Upscale {scale}x)`
- If no `sourceGenerationId` (Mode upload): use `"Upscale {scale}x"`
- No user-entered prompt is needed for upscale; the prompt field is auto-generated for traceability

### Model Auto-Switch (Client-Side)

| Aspect | Specification |
|--------|---------------|
| Trigger | User switches ModeSelector to "Image to Image" AND current model does not support img2img |
| Detection | Client calls `getModelSchema` (Server Action, cached), checks for `image`, `image_prompt`, or `init_image` in schema properties |
| Fallback Selection | First model in `MODELS` array (from `lib/models.ts`) where schema contains an image input parameter |
| Location | Client-side in `PromptArea` component, on mode change to img2img |
| Toast | `"Model switched to {displayName} (supports img2img)"` via Sonner |
| Edge Case: No compatible model | Disable "Image to Image" segment in ModeSelector; show tooltip "No models support img2img" |
| Edge Case: Current model is compatible | No action needed, keep current model |

### State Persistence Matrix (Mode Switch)

State is **never destroyed** on mode switch, only hidden. Each mode maintains its own state object.

**Implementation:** PromptArea stores per-mode state in React component state:
```
modeStates: {
  txt2img: { promptMotiv, promptStyle, negativePrompt, modelId, paramValues, variantCount },
  img2img: { promptMotiv, promptStyle, negativePrompt, modelId, paramValues, variantCount, sourceImageUrl, strength },
  upscale: { sourceImageUrl, scale }
}
```

On mode switch: save current state to `modeStates[currentMode]`, restore from `modeStates[targetMode]`.

| From | To | Prompt (Motiv/Style) | Source-Image | Strength | Model |
|------|-----|---------------------|-------------|----------|-------|
| txt2img | img2img | Keep | -- (empty) | Default 0.6 | Keep if compatible, else Auto-Switch |
| txt2img | upscale | Hidden (not deleted) | -- (empty) | -- | -- |
| img2img | txt2img | Keep | Hidden (not deleted) | Hidden | Keep |
| img2img | upscale | Hidden (not deleted) | Keep (transfer) | Hidden | -- |
| upscale | txt2img | Restore | Hidden (not deleted) | -- | Restore |
| upscale | img2img | Restore | Keep (transfer) | Default 0.6 | Restore if compatible |

**Cross-Mode (Lightbox):** When Lightbox triggers a mode switch via WorkspaceState, the incoming data **overrides** the target mode's stored state (prompt, sourceImageUrl, etc.). This is intentional -- Lightbox actions set explicit values.

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `generationMode` | Must be "txt2img", "img2img", or "upscale" | "Ungueltiger Generierungsmodus" |
| `sourceImageUrl` (img2img) | Required when mode is "img2img" | "Source-Image ist erforderlich fuer img2img" |
| `strength` (img2img) | 0.0 - 1.0 | "Strength muss zwischen 0 und 1 liegen" |
| `scale` (upscale) | 2 or 4 | "Scale muss 2 oder 4 sein" |
| Source file type | PNG, JPG, JPEG, WebP | "Nur PNG, JPG, JPEG und WebP erlaubt" |
| Source file size | Max 10MB | "Datei darf maximal 10MB gross sein" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| API Auth | None | Single-user app, no auth layer |
| Resource Access | Project-scoped | All operations require valid projectId |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Source Images | R2 public URL | Same pattern as generated images |
| Replicate API Token | Server-side only | Never exposed to client |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| Source Image File | Type check (magic bytes), size check (10MB) | sharp metadata extraction for dimensions |
| Source Image URL (paste) | URL format validation | Fetch + re-upload to R2 (prevents SSRF via Replicate) |
| `strength` | Number, 0.0-1.0 range | Clamp to valid range |
| `scale` | Integer, 2 or 4 | Strict enum check |
| `generationMode` | String enum | Strict enum check |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Source Image Upload | 10MB per file | Per request | 413 error |
| Replicate API | Replicate-managed | Per account | 429 -> toast "Zu viele Anfragen" |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Server Actions (`app/actions/`) | Validate input, delegate to services, revalidate | Next.js Server Actions |
| Services (`lib/services/`) | Business logic, orchestration, Replicate calls | Service pattern |
| Clients (`lib/clients/`) | External API communication (Replicate, R2) | Client wrapper |
| DB Queries (`lib/db/queries.ts`) | Data access, CRUD operations | Query functions |
| Components (`components/workspace/`, `components/lightbox/`) | UI rendering, state management | React components |
| State (`lib/workspace-state.tsx`) | Cross-component state (variation/cross-mode data) | React Context |

### Data Flow

```
UI (PromptArea/Lightbox)
  -> Server Action (validation)
    -> Service (business logic)
      -> ReplicateClient (API call)
      -> StorageService (R2 upload)
      -> DB Queries (create/update)
  <- Return pending Generation(s)
  <- Polling updates UI (existing pattern)
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Invalid file type/size | 400 via return `{ error }` | Toast with message | None (expected) |
| R2 upload failure | Catch, return error | Toast "Bild konnte nicht hochgeladen werden" | `console.error` |
| Replicate API failure | Mark generation as "failed" | Toast with error (existing pattern) | `console.error` |
| Replicate rate limit (429) | Mark generation as "failed" | Toast "Zu viele Anfragen" (existing) | `console.error` |
| Invalid mode/params | 400 via return `{ error }` | Toast with message | None |

---

## Migration Map

> Files that change to support multi-mode generation.

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | generations table without mode columns | + `generationMode`, `sourceImageUrl`, `sourceGenerationId` columns + new index | Add 3 columns, 1 FK, 1 composite index |
| `lib/db/queries.ts` | `createGeneration` takes basic fields | Accept new fields: `generationMode`, `sourceImageUrl`, `sourceGenerationId` | Extend `createGeneration` input type + insert |
| `app/actions/generations.ts` | `GenerateImagesInput` without mode | Extended input + new `uploadSourceImage` + `upscaleImage` actions | Add mode-specific validation, 2 new actions |
| `lib/services/generation-service.ts` | `generate()` builds input without image params | `generate()` handles img2img input; new `upscale()` method | Extend `buildReplicateInput` for img2img, add `upscale()` |
| `lib/services/model-schema-service.ts` | Only `getSchema()` | + `supportsImg2Img()` helper | Add helper that checks schema for image params |
| `lib/clients/storage.ts` | `upload()` hardcodes `image/png` ContentType | Support dynamic ContentType for source images | Add contentType parameter to `upload()` |
| `lib/workspace-state.tsx` | `WorkspaceVariationState` with prompt/model only | Extended with `targetMode`, `sourceImageUrl`, `strength`, `sourceGenerationId` | Extend interface + context |
| `components/workspace/prompt-area.tsx` | Single txt2img form | Mode-aware form with conditional sections | Add ModeSelector, ImageDropzone, StrengthSlider integration |
| `components/workspace/workspace-content.tsx` | No filtering, direct gallery render | Filter state + FilterChips above gallery | Add filter state, pass to GalleryGrid |
| `components/workspace/gallery-grid.tsx` | Renders all completed generations | Accept filter prop, filter by mode | Add `modeFilter` prop, conditional rendering |
| `components/workspace/generation-card.tsx` | No badge | ModeBadge overlay | Add mode badge (T/I/U) |
| `components/lightbox/lightbox-modal.tsx` | Variation + Download + Delete buttons | + img2img button + Upscale popover, mode-aware Variation | Add 2 new action buttons, modify Variation for img2img |
| `lib/models.ts` | Static model list for txt2img | + `UPSCALE_MODEL` constant | Add upscale model definition |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Replicate models have different img2img parameter names | `image`, `image_prompt`, `init_image` variants | `buildReplicateInput` detects correct parameter name from schema |
| FLUX models need higher strength (>0.95) for visible changes | User may not understand model-specific strength behavior | Presets (Subtle/Balanced/Creative) abstract this; tooltip explains range |
| Upscale model is fixed, not user-selectable | Must hardcode a reliable upscale model | Use `nightmareai/real-esrgan` (well-maintained, cheap, fast on T4) |
| Source images must be accessible by Replicate | Replicate needs a URL, not a buffer | Upload to R2 first, pass R2 public URL to Replicate |
| Existing generations have no `generationMode` | Migration must be backwards-compatible | DEFAULT `'txt2img'` on column -- all existing rows get txt2img automatically |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Image Generation | Replicate API | REST API via `replicate` npm SDK | 1.4.0 (installed in package.json) | Existing integration, extended for img2img params |
| Upscale Model | `nightmareai/real-esrgan` on Replicate | Replicate predictions API | Model v1.7.0 (latest on Replicate, Mar 2026) | Input: `{ image, scale, face_enhance }` |
| Object Storage | Cloudflare R2 | S3-compatible API via `@aws-sdk/client-s3` | 3.1003.0 (installed) | Extended for source image uploads |
| UI Components | shadcn/ui | React components | radix-ui 1.4.3 (installed) | Popover needs `npx shadcn@latest add popover` |
| Image Processing | sharp | Node.js native | 0.34.5 (installed) | Used for format conversion + metadata extraction |
| Framework | Next.js | App Router, Server Actions | 16.1.6 (installed) | Server Actions for all mutations |
| ORM | Drizzle ORM | PostgreSQL driver | 0.45.1 (installed) | Schema migration via drizzle-kit 0.31.9 |

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Responsiveness | Mode switch < 50ms | Client-side state only, no server call on mode switch | Manual testing |
| Upload feedback | Progress visible during upload | Client-side upload progress via XHR/fetch progress events | Manual testing |
| Generation latency | Same as txt2img (~10-60s depending on model) | Same fire-and-forget + polling pattern | Existing monitoring |
| Upscale latency | < 10s for Real-ESRGAN on T4 | ~1.8s for 2x upscale (Real-ESRGAN benchmark) | Manual testing |
| Gallery performance | Client-side filter < 16ms (60fps) | Simple `.filter()` on `generationMode` field | Manual testing with 100+ items |
| State preservation | Mode switch preserves entered data | Hidden (not destroyed) state pattern per State Persistence Matrix | Unit tests |
| Backwards compatibility | Existing txt2img works unchanged | `generationMode` DEFAULT 'txt2img', all existing code paths unchanged | Regression tests |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Upload failures | Error count | 0 expected | `console.error` (existing pattern) |
| Upscale failures | Error count | < 5% | Toast notification (existing pattern) |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| `nightmareai/real-esrgan` remains available on Replicate | Check model page periodically | Swap to `daanelson/real-esrgan-a100` or `philz1337x/clarity-upscaler` |
| FLUX 2 Pro supports img2img via `image` or `image_prompt` parameter | Verified via Replicate schema API | Fallback: schema detection already handles multiple param names |
| R2 public URLs are accessible by Replicate | Current generated images already use R2 URLs | No impact -- same infra |
| Client-side gallery filtering is sufficient for V1 | Most projects have < 500 generations | If slow: add server-side filter with `generationMode` WHERE clause |
| Source images under 10MB are sufficient | Most user images are < 5MB | Increase limit or add compression on upload |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Replicate upscale model cold start | Medium | Low (user waits longer) | Real-ESRGAN is popular, rarely cold | Toast "Processing..." with polling |
| img2img parameter name varies across models | Medium | Medium (generation fails) | Schema-driven detection of `image`/`image_prompt`/`init_image` | Fallback to `image` as default param name |
| Large source images cause slow upload | Low | Low (UX) | 10MB limit + progress indicator | Compress client-side before upload |
| Self-referencing FK (sourceGenerationId) complicates deletes | Low | Low | ON DELETE SET NULL -- upscaled image survives source deletion | None needed |
| Mode state complexity (State Persistence Matrix) | Medium | Medium (bugs) | Comprehensive unit tests for mode switching | Simplify: reset state on mode switch (degraded UX) |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Upscale Model | `nightmareai/real-esrgan` | Well-maintained, fast on T4 (~1.8s), cheap (~$0.002/run), supports 2x/4x scale |
| Source Image Storage | R2 (existing) | Same infra as generated images, consistent URL pattern |
| File Upload | Server Action with FormData | Consistent with existing pattern, no additional API routes needed |
| Popover Component | shadcn/ui Popover | Existing design system, `npx shadcn@latest add popover` |
| Mode State | React Context (extend WorkspaceState) | Existing pattern for cross-component state |
| Gallery Filter | Client-side filter | Simple, fast for V1 scale; upgrade to server-side if needed |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Client-side gallery filter | Simple, no API changes, instant | Loads all generations regardless of filter | V1 acceptable; add server-side WHERE clause later |
| Fixed upscale model | Simple UX, no model selection complexity | Less flexibility | Can add model selection later if needed |
| Source images always uploaded to R2 | Replicate can access via URL, persistent | Storage cost for source images | Source images are small (< 10MB) |
| Extend existing `generateImages` action for img2img | Shared validation/flow logic | Action becomes more complex | Clear mode branching in validation |
| Separate `upscaleImage` action | Clean separation, different input/output | Two actions instead of one | Upscale has fundamentally different flow (no prompt, fixed model) |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | img2img parameter detection: should we cache which param name a model uses? | A) Check schema every time B) Cache in ModelSchemaService | B) Cache -- schema is already cached | B |
| 2 | Source image cleanup: should we delete source images when not referenced? | A) Keep forever B) Cleanup job C) Delete on generation delete | A) Keep forever for V1 (simple, storage cheap) | A |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-07 | Codebase | `lib/db/schema.ts`: generations table has 14 columns, uses Drizzle pgTable. No `generationMode` column yet. |
| 2026-03-07 | Codebase | `lib/services/generation-service.ts`: `buildReplicateInput()` currently only adds `prompt` + `negative_prompt`. Easy to extend for `image` + `prompt_strength`. |
| 2026-03-07 | Codebase | `lib/clients/storage.ts`: `upload()` hardcodes `ContentType: "image/png"`. Needs dynamic ContentType for source images (JPEG, WebP). |
| 2026-03-07 | Codebase | `lib/workspace-state.tsx`: `WorkspaceVariationState` has `promptMotiv`, `promptStyle`, `negativePrompt`, `modelId`, `modelParams`. Needs extension for `targetMode`, `sourceImageUrl`, `strength`. |
| 2026-03-07 | Codebase | `components/workspace/prompt-area.tsx`: 422 lines, monolithic component. ModeSelector + conditional rendering will add ~100 lines. |
| 2026-03-07 | Codebase | `components/lightbox/lightbox-modal.tsx`: Actions are inline buttons (Variation, Download, Delete). img2img + Upscale buttons add to this section. |
| 2026-03-07 | Codebase | `components/workspace/gallery-grid.tsx`: Simple filter on `status === "completed"`. Adding mode filter is straightforward. |
| 2026-03-07 | Codebase | `lib/models.ts`: Static MODELS array. No upscale model defined yet. |
| 2026-03-07 | Codebase | `lib/services/model-schema-service.ts`: Fetches OpenAPI schema from Replicate. Schema properties include parameter names -- can detect `image`/`image_prompt`/`init_image`. |
| 2026-03-07 | Codebase | `package.json`: replicate 1.4.0, sharp 0.34.5, @aws-sdk/client-s3 3.1003.0, Next.js 16.1.6, Drizzle 0.45.1, radix-ui 1.4.3. All current versions. |
| 2026-03-07 | Web | Real-ESRGAN on Replicate (`nightmareai/real-esrgan`): ~1.8s on T4 for 2x, supports scale + face_enhance params. Cost ~$0.002/run. |
| 2026-03-07 | Web | Clarity Upscaler (`philz1337x/clarity-upscaler`): Higher quality but slower and more expensive (~$0.011/run). Good fallback option. |
| 2026-03-07 | Web | shadcn/ui Popover: Built on Radix UI, `npx shadcn@latest add popover`. Already have radix-ui 1.4.3 installed. |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| - | Architecture created from Discovery Q&A (20 questions) without additional user interaction | All decisions derived from Discovery document |
