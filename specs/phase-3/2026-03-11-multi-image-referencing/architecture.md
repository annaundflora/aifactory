# Feature: Multi-Image Referencing

**Epic:** AI Image Studio - Phase 3
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- img2img supports only 1 source image — no way to combine motif, style, and colors from different sources
- No semantic assignment: user cannot control whether an image serves as style, content, or structure reference
- No inline referencing in prompt ("take the object from image A and style of image B")
- Reference images not persistent — must re-upload each session

**Solution:**
- Extend img2img mode: up to 5 reference images with semantic roles (Style, Content, Structure, Character, Color)
- Hybrid UX: image slots with role dropdown + optional @1-@5 inline references in prompt text
- Per-image strength dropdown with 4 levels (Subtle/Moderate/Strong/Dominant) as prompt hints (FLUX.2 Edit has no native per-image weights)
- Persistent reference library per project (DB + R2)

**Business Value:**
- Enables complex creative workflows: "motif from A, style from B, colors from C"
- Foundation for AI Image Studio vision (Character Consistency, Compositing, Workflow Builder)
- Iterative work with consistent references across sessions

---

## Scope & Boundaries

| In Scope |
|----------|
| Up to 5 reference images per generation |
| 5 roles: Style, Content, Structure, Character, Color (per dropdown) |
| Per-image strength dropdown with 4 levels: Subtle, Moderate, Strong, Dominant |
| @1-@5 inline reference syntax in prompt text (optional) + hint banner for discoverability |
| Vertical slot list (1 slot per row, 480px panel) with 80x80 thumbnails |
| Color coding per role: Style=Violet, Content=Blue, Structure=Green, Character=Amber, Color=Pink |
| Image sources: File Upload (Drag & Drop, Click, URL Paste) + Gallery (Drag & Drop + Lightbox button) |
| Persistent reference images per project (DB + R2) |
| Provenance: Lightbox shows used references as thumbnail row with roles |
| Model compatibility: Warning when model supports fewer images than uploaded |
| Replaces single-image img2img: 1 reference with role "Content" = classic img2img |
| Collapsible reference section when no images present |

| Out of Scope |
|--------------|
| IP-Adapter / ControlNet with explicit API parameters (later phase with fal.ai) |
| Inpainting / Outpainting (Phase 4) |
| Background Removal / Compositing (Phase 5) |
| Character Consistency across sessions/generations (Phase 6) |
| Workflow Builder / Pipeline chaining (Phase 7) |
| Freely named references (@cat, @background) |
| Node-based composition |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (RPC-style, `"use server"`) |
| Authentication | None (single-user app, no auth layer) |
| Rate Limiting | None (single-user) |

### Server Actions

| Action | Input | Output | Business Logic |
|--------|-------|--------|----------------|
| `uploadReferenceImage` | `{ projectId: string, file?: File, url?: string }` | `{ id, imageUrl, width, height }` or `{ error }` | Validate format/size → Upload to R2 → Insert `reference_images` row → Return record |
| `deleteReferenceImage` | `{ id: string }` | `{ success: boolean }` | Delete R2 object → Delete DB row |
| `getReferenceImages` | `{ projectId: string }` | `ReferenceImage[]` | Query all reference images for project, ordered by createdAt |
| `generateImages` (EXTEND) | existing + `{ references?: ReferenceInput[] }` | existing | Compose multi-reference prompt → Map images to API input → Create generation_references records |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `ReferenceInput` | `referenceImageId: string, role: RoleEnum, strength: StrengthEnum, slotPosition: 1-5` | role in 5 values, strength in 4 values, position 1-5 | Passed from UI per generation |
| `ReferenceImage` | `id, projectId, imageUrl, originalFilename?, width?, height?, sourceType, sourceGenerationId?, createdAt` | — | DB entity |
| `GenerationReference` | `generationId, referenceImageId, role, strength, slotPosition` | — | Junction record |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `reference_images` | Persistent reference image library per project | id, projectId, imageUrl, sourceType |
| `generation_references` | Junction: which references were used per generation with what role/strength | generationId, referenceImageId, role, strength, slotPosition |
| `generations` (CHANGE) | Deprecate `sourceImageUrl` column | sourceImageUrl → deprecated, replaced by generation_references |

### Schema Details: `reference_images`

| Column | Type | Constraints | Index |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | Yes (PK) |
| `projectId` | UUID | FK → projects.id, NOT NULL | Yes |
| `imageUrl` | TEXT | NOT NULL | No |
| `originalFilename` | VARCHAR(255) | nullable | No |
| `width` | INTEGER | nullable | No |
| `height` | INTEGER | nullable | No |
| `sourceType` | VARCHAR(20) | NOT NULL, "upload" or "gallery" | No |
| `sourceGenerationId` | UUID | FK → generations.id, nullable, ON DELETE SET NULL | No |
| `createdAt` | TIMESTAMP WITH TIMEZONE | NOT NULL, default now() | No |

### Schema Details: `generation_references`

| Column | Type | Constraints | Index |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | Yes (PK) |
| `generationId` | UUID | FK → generations.id, NOT NULL, ON DELETE CASCADE | Yes |
| `referenceImageId` | UUID | FK → reference_images.id, NOT NULL, ON DELETE CASCADE | Yes |
| `role` | VARCHAR(20) | NOT NULL, enum: style/content/structure/character/color | No |
| `strength` | VARCHAR(20) | NOT NULL, enum: subtle/moderate/strong/dominant | No |
| `slotPosition` | INTEGER | NOT NULL, 1-5 | No |

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `reference_images` | `projects` | N:1 | DELETE CASCADE (project deleted → refs deleted) |
| `reference_images` | `generations` | N:1 (optional source) | DELETE SET NULL |
| `generation_references` | `generations` | N:1 | DELETE CASCADE |
| `generation_references` | `reference_images` | N:1 | DELETE CASCADE |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `ReferenceService.upload` | Upload reference image to R2, create DB record | projectId, File or URL | ReferenceImage record | R2 write, DB insert |
| `ReferenceService.uploadFromGallery` | Create reference from existing gallery image (no re-upload) | projectId, generationId, imageUrl | ReferenceImage record | DB insert only |
| `ReferenceService.delete` | Remove reference image | referenceImageId | void | R2 delete, DB delete |
| `ReferenceService.getByProject` | Get all references for a project | projectId | ReferenceImage[] | None |
| `GenerationService.generate` (EXTEND) | Build multi-reference prompt + API input | existing + references[] | existing | DB insert generation_references |
| `buildReplicateInput` (EXTEND) | Map multiple reference images to API `input_images` array | Generation + references | Replicate input object | None |
| `composeMultiReferencePrompt` (NEW) | Inject role/strength hints + @image mapping into prompt | prompt, references[] | Enhanced prompt string | None |

### Business Logic Flow

```
UI (ReferenceBar) → uploadReferenceImage → R2 + DB (reference_images)
                                              ↓
UI (Generate) → generateImages(references[]) → composeMultiReferencePrompt()
                                              → buildReplicateInput() with input_images[]
                                              → Replicate API
                                              → DB insert generation_references
                                              → processGeneration (existing flow)
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| File MIME type | image/png, image/jpeg, image/webp | "Nur PNG, JPG, JPEG und WebP erlaubt" |
| File size | ≤ 10 MB | "Datei darf maximal 10MB groß sein" |
| References count | ≤ 5 per generation | "Maximale Anzahl Referenzen erreicht (5)" |
| Slot position | 1-5, unique per generation | "Ungültige Slot-Position" |
| Role | One of: style, content, structure, character, color | "Ungültige Rolle" |
| Strength | One of: subtle, moderate, strong, dominant | "Ungültige Stärke" |
| Total input megapixels | ≤ 9 MP (FLUX.2 API limit) | "Gesamte Bildgröße überschreitet API-Limit" |

### Prompt Composition: `composeMultiReferencePrompt()`

```
Input:
  promptMotiv: "Extract the building from @3 and render it in the style of @1"
  promptStyle: "oil painting"
  references: [
    { slotPosition: 1, role: "style", strength: "strong" },
    { slotPosition: 3, role: "content", strength: "moderate" },
    { slotPosition: 5, role: "structure", strength: "subtle" }
  ]

Step 1: Compose base prompt
  → "Extract the building from @image3 and render it in the style of @image1. oil painting"
  (Map @N → @imageN for FLUX.2 API)

Step 2: Append role/strength context (system instruction)
  → Append: "Reference guidance: @image1 provides style reference with strong influence. @image3 provides content reference with moderate influence. @image5 provides structure reference with subtle influence."

Step 3: Handle unused references (no @-mention in prompt)
  → References without explicit @-mention get appended as context hints

Output:
  "Extract the building from @image3 and render it in the style of @image1. oil painting. Reference guidance: @image1 provides style reference with strong influence. @image3 provides content reference with moderate influence. @image5 provides structure reference with subtle influence."
```

### `buildReplicateInput()` Extension

```
Current:
  input[img2imgField] = isArray
    ? [generation.sourceImageUrl]
    : generation.sourceImageUrl

Extended:
  IF generation has references (via generation_references query):
    const referenceUrls = references
      .sort((a, b) => a.slotPosition - b.slotPosition)
      .map(r => r.imageUrl)

    input[img2imgField] = referenceUrls  // Array of URLs for input_images

  ELSE IF generation.sourceImageUrl (backwards compat):
    input[img2imgField] = isArray
      ? [generation.sourceImageUrl]
      : generation.sourceImageUrl
```

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| API Auth | None | Single-user app, no authentication layer |
| Resource Access | Project-scoped | All reference images scoped to projectId |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Uploaded images | R2 with project-scoped keys | `references/{projectId}/{uuid}.{ext}` |
| Image URLs | TEXT column (no length limit) | R2 URLs and gallery URLs can be arbitrarily long |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| File upload | MIME type whitelist + size limit | Buffer-based processing, no filesystem temp files |
| URL paste | Server-side fetch, MIME + size validation | Proxy through R2 (no direct external URLs stored for uploads) |
| Prompt @-tokens | Regex: `/@(\d+)/g` | Only numeric tokens 1-5 recognized, others passed through |
| Role/Strength values | Enum validation | Reject unknown values |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Reference uploads | 5 per project (functional limit) | N/A | UI prevents adding beyond 5 |
| Image size | 10 MB per image | N/A | Server rejects with error |
| Total API input | 9 MP (FLUX.2 limit) | Per request | Warning in UI, server validates |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Server Actions (`app/actions/references.ts`) | Validate input, call service, return result | Next.js Server Action pattern |
| Server Actions (`app/actions/generations.ts`) | Extended: accept references[], delegate to service | Existing pattern extended |
| Service (`lib/services/reference-service.ts`) | CRUD for reference images, business rules | Service pattern |
| Service (`lib/services/generation-service.ts`) | Extended: multi-reference prompt composition, API input building | Existing service extended |
| Queries (`lib/db/queries.ts`) | Extended: reference_images + generation_references CRUD | Existing query layer extended |
| Schema (`lib/db/schema.ts`) | Extended: 2 new tables | Drizzle schema definition |
| Storage (`lib/clients/storage.ts`) | R2 upload/delete | Existing pattern reused |
| Components (`components/workspace/reference-*.tsx`) | ReferenceBar, ReferenceSlot, dropdowns | React components |
| State (`lib/workspace-state.tsx`) | Extended: reference images state | React context |

### Data Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Client  │ ──▶ │ Server Action │ ──▶ │ ReferenceService  │ ──▶ │  DB + R2    │
│ (React)  │     │ (references) │     │                  │     │             │
└─────────┘     └──────────────┘     └──────────────────┘     └─────────────┘
     │                                                              │
     │          ┌──────────────┐     ┌──────────────────┐           │
     └────────▶ │ Server Action │ ──▶ │GenerationService │ ──▶──────┘
                │ (generations) │     │  + Replicate     │
                └──────────────┘     └──────────────────┘
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Upload validation (MIME, size) | Return `{ error: string }` | Toast with specific message | None |
| R2 upload failure | Return `{ error: string }` | Toast "Upload fehlgeschlagen" | Console error |
| Model incompatibility | Client-side detection | Warning banner + dimmed slots | None |
| Replicate API error | Existing error handling | Generation status "failed" | Console error |
| Reference not found | Return `{ error: string }` | Toast with message | None |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | 5 tables (projects, generations, favoriteModels, projectSelectedModels, promptSnippets) | 7 tables (+reference_images, +generation_references) | Add 2 new table definitions with FKs and indexes |
| `lib/db/queries.ts` | CRUD for generations, projects, models | +CRUD for reference_images, generation_references | Add createReferenceImage, deleteReferenceImage, getReferenceImagesByProject, createGenerationReferences, getGenerationReferences |
| `app/actions/generations.ts` | `generateImages()` accepts `sourceImageUrl?: string` | `generateImages()` accepts `references?: ReferenceInput[]` | Extend input type, pass references to service, create generation_references records after generation |
| `lib/services/generation-service.ts` | `buildReplicateInput()` uses single `sourceImageUrl` | `buildReplicateInput()` maps multiple reference URLs to `input_images` array | Query generation_references, build URL array, compose multi-reference prompt |
| `lib/services/model-schema-service.ts` | `getImg2ImgFieldName()` returns field info | +`getMaxImageCount()` returns max images from schema | Add function to detect array maxItems or similar constraints |
| `components/workspace/prompt-area.tsx` | img2img mode: single ImageDropzone + StrengthSlider | img2img mode: ReferenceBar replaces ImageDropzone | Replace single-image UI with ReferenceBar component, manage reference state |
| `components/workspace/workspace-content.tsx` | PromptArea width `w-80` (320px) | PromptArea width `w-[480px]` | Change width class for wider reference slots |
| `components/lightbox/lightbox-modal.tsx` | 5 action buttons (Variation, Img2Img, Upscale, Download, Delete) | 6 action buttons (+UseAsReference), +ProvenanceRow | Add UseAsReferenceButton between Variation and Img2Img, add ProvenanceRow below details |
| `lib/workspace-state.tsx` | `WorkspaceVariationState` with `sourceImageUrl` | Extended with `addReference?: { imageUrl, generationId? }` | Add field for "As Reference" action from lightbox |
| `components/workspace/generation-card.tsx` | Button-only (not draggable) | `draggable` attribute + custom `dataTransfer` | Add drag start handler with generation data in transfer |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| FLUX.2 Edit has no native per-image weights | Cannot set numeric influence per reference | Strength as prompt hints ("with strong/subtle influence from @imageN style") |
| FLUX.2 Edit max 9 MP total input | Large images may exceed limit | Validate total megapixels before API call, warn user |
| FLUX.2 Pro max 8 input images | Our limit of 5 is within bounds | No issue, 5 < 8 |
| Model-specific image field names | Different models use different field names (input_images, image_input, image, etc.) | Existing `getImg2ImgFieldName()` already handles detection dynamically |
| Array vs single-value image fields | Some models accept array, others single string | Existing `isArray` flag in `getImg2ImgFieldName()` handles this; for multi-image, require array-capable models |
| Sparse slot numbering | Removed slots leave gaps (@1, @3, @5) | @-tokens map by slot position, not array index. DB `slotPosition` is source of truth |
| Backwards compatibility | Existing img2img generations use `sourceImageUrl` | Migration creates `generation_references` record for each existing `sourceImageUrl`; `buildReplicateInput` falls back to `sourceImageUrl` if no references exist |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| AI Generation | Replicate API (FLUX.2 Pro, FLUX.2 Flex, FLUX.2 Dev) | REST API via `replicate` npm client | 1.4.0 (npm, Nov 2025) | `input_images` array field, @image1-@image8 prompt syntax |
| Object Storage | Cloudflare R2 | S3-compatible API via `@aws-sdk/client-s3` | 3.1003.0 (npm) | Key pattern: `references/{projectId}/{uuid}.{ext}` |
| Database | PostgreSQL | Drizzle ORM | 0.45.1 (npm, Dec 2025) | 2 new tables via Drizzle migration |
| Database Toolkit | drizzle-kit | CLI | 0.31.9 (npm) | `npx drizzle-kit generate` + `npx drizzle-kit push` |
| UI Primitives | Radix UI (via shadcn) | React components | 1.4.3 (npm, Aug 2025) | Collapsible, Select, Badge |
| UI Framework | shadcn/ui | CLI + components | 3.8.5 (npm, project pinned via `^3.8.5` = `>=3.8.5 <4.0.0`) | `npx shadcn add collapsible` as pre-requisite. Note: shadcn CLI v4.0.5 released Mar 2026 — upgrade is optional, not required for this feature. |
| Frontend Framework | Next.js | App Router, Server Actions | 16.1.6 | Existing stack |
| React | React | Hooks, Context | 19.2.3 | Existing stack |
| Image Processing | sharp | Metadata extraction | 0.34.5 (npm) | Width/height extraction for uploaded references |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Upload responsiveness | < 2s for 10MB image | Direct R2 upload via Server Action, optimistic UI with progress state | Manual test with 10MB file |
| Slot interaction speed | Instant role/strength changes | Client-side state only, no server round-trip for dropdown changes | UI renders < 16ms |
| Generate latency | No additional overhead vs single-image | References queried once at generate time, URLs passed in single API call | Compare generation times |
| Mode switch preservation | References survive txt2img ↔ img2img switch | State held in React state (not destroyed on mode switch), hidden when not img2img | Manual test: switch modes, verify refs preserved |
| Persistence | References available after page reload | DB + R2 storage, loaded via `getReferenceImages` on mount | Reload page, verify refs load |
| Total input size | ≤ 9 MP (FLUX.2 limit) | Sum width×height of all reference images, warn if exceeding | Validation before API call |
| Gallery drag performance | No jank during drag | Native HTML5 drag & drop API, lightweight `dataTransfer` payload | Manual test drag smoothness |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Reference upload failures | Counter | 0 in normal operation | Console error log |
| Generation with references success rate | Ratio | Same as single-image | Compare to baseline |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| FLUX.2 Pro supports `input_images` as array of URLs | Confirmed: Replicate model schema shows `input_images` as array type, `getImg2ImgFieldName()` already returns `isArray: true` | Would need to chain single-image calls or use different API |
| @image1-@image8 syntax works in FLUX.2 prompt | Confirmed: Replicate docs and Black Forest Labs docs describe this syntax | Would need to append all images without index control |
| Prompt-based strength hints have observable effect | Partially validated: LLM-based models respond to natural language instructions | Strength may have minimal effect; UI labels are still useful for user intent |
| R2 URLs are accessible by Replicate API | Already working: existing img2img uses R2 URLs as `sourceImageUrl` | Would need to generate presigned URLs |
| Gallery image URLs are directly usable as reference URLs | Already working: gallery images are R2 URLs | No change needed |
| Models that accept array fields also accept multiple URLs in that array | High confidence based on FLUX.2 docs ("up to 8 input images") | Would need to send images one at a time |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Some models only accept single image despite array field | Low | Medium | Check `maxItems` in schema if available; fall back to first image if model rejects | Use only first reference, warn user |
| Total megapixel limit exceeded with 5 large images | Medium | Medium | Pre-validate: sum all reference image dimensions, show warning before generate | Auto-downscale images before API call (future) |
| Drag & drop from gallery conflicts with existing click handlers | Low | Low | Use `dataTransfer.setData()` with custom MIME type to distinguish from file drops | Gallery drag is secondary; lightbox button is primary path |
| Migration of existing sourceImageUrl breaks old generations | Low | High | Migration script creates generation_references records; `buildReplicateInput` has fallback path | sourceImageUrl column preserved (deprecated, not deleted) |
| Collapsible component not yet installed | Low | Low | Pre-requisite: `npx shadcn add collapsible` before Slice 4 | Manual Radix Collapsible import |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Reference storage | Cloudflare R2 (existing) | Reuse existing storage infrastructure, same upload pattern |
| Reference DB | PostgreSQL + Drizzle (existing) | Reuse existing DB, relational model fits reference-generation junction |
| Prompt composition | Server-side string manipulation | Simple, no additional dependencies; @N → @imageN regex replacement |
| Strength implementation | Prompt hints (natural language) | FLUX.2 Edit has no native per-image weight API; prompt hints are the only option |
| Drag & drop | Native HTML5 Drag & Drop API | No library needed for simple intra-app drag; custom `dataTransfer` format |
| Collapsible | shadcn/ui Collapsible (Radix) | Consistent with existing UI, accessible, keyboard-navigable |
| Role/Strength selects | shadcn/ui Select (Radix) | Consistent with existing UI patterns |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Strength as prompt hints (not API params) | Works with any model, honest UX (no precision illusion) | Effect may be inconsistent or weak | 4 discrete levels manage expectations; future fal.ai integration can add true weights |
| Separate `reference_images` table (not JSONB) | Queryable, indexable, reusable across generations | More complex schema, 2 joins needed | Junction table is standard relational pattern |
| Sparse slot numbering (no re-numbering on remove) | Protects @-references in prompt from silent breakage | Users may see gaps (@1, @3, @5) | New images fill lowest free number; UI shows actual numbers |
| R2 key pattern `references/` (not `sources/`) | Clear separation from existing source images | Two key prefixes to manage | Consistent naming, easy to identify |
| 480px panel width (up from 320px) | Enough space for reference slots with all controls | Less gallery space | Responsive: gallery adapts with flexbox |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Should `sourceImageUrl` column be dropped after migration? | A) Drop column B) Keep deprecated | B) Keep deprecated | Keep — zero risk, can drop in future cleanup |
| 2 | Should reference images be auto-loaded on workspace mount? | A) Yes, always load B) Only when entering img2img mode | A) Always load | Pre-load enables instant mode switch |
| 3 | How to handle models that support array field but max 1 image? | A) Ignore limit, let API error B) Check schema maxItems C) Let user try, show error | B) Check maxItems if available, fall back to C | Check schema first, graceful fallback |

---

## Context & Research

### Codebase Patterns

| Pattern | Location | Relevance |
|---------|----------|-----------|
| `getImg2ImgFieldName()` returns `{ field, isArray }` | `lib/services/model-schema-service.ts:18-38` | Already detects `input_images` (array) vs `image` (single). Multi-image simply sends multiple URLs in the array. |
| `buildReplicateInput()` conditional array/string | `lib/services/generation-service.ts:136-146` | Extension point: query generation_references, build URL array |
| `uploadSourceImage()` handles File + URL | `app/actions/generations.ts:165-235` | Reusable pattern for `uploadReferenceImage()` — same MIME validation, R2 key generation, buffer processing |
| `WorkspaceVariationState` context | `lib/workspace-state.tsx` | Extension point for "As Reference" action from lightbox |
| `ImageDropzone` state machine (5 states) | `components/workspace/image-dropzone.tsx` | Reusable drag/drop pattern for ReferenceSlot — same drag-over, uploading, preview states |
| `GenerationCard` click-only (not draggable) | `components/workspace/generation-card.tsx` | Needs `draggable` attribute + `onDragStart` handler |
| `LightboxModal` action buttons | `components/lightbox/lightbox-modal.tsx` | Extension point: add UseAsReferenceButton + ProvenanceRow |
| `PromptArea` mode-specific state persistence | `components/workspace/prompt-area.tsx` | References state lives alongside existing img2img state |
| `workspace-content.tsx` panel width `w-80` (320px) | `components/workspace/workspace-content.tsx` | Must change to `w-[480px]` |
| Prompt composition: `${motivTrimmed}. ${styleTrimmed}` | `generation-service.ts:215-218` | Extension point for appending reference context hints |

### FLUX.2 API Research

| Finding | Source |
|---------|--------|
| FLUX.2 Pro accepts up to 8 input images via `input_images` array | Replicate model page, BFL docs |
| FLUX.2 Flex accepts up to 10 input images | Replicate model page |
| Images referenced in prompt via @image1-@image8 syntax | BFL docs, Replicate blog |
| Total input size limited to 9 megapixels | BFL docs |
| No native per-image weight/strength parameter | API schema analysis |
| FLUX.2 Dev (open-source) also supports multi-image | Replicate model page |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-11 | Codebase | `getImg2ImgFieldName()` already returns `isArray: true` for `input_images` field — multi-image is a natural extension |
| 2026-03-11 | Codebase | `uploadSourceImage()` pattern (File + URL, R2 key, MIME validation) directly reusable for reference uploads |
| 2026-03-11 | Codebase | `WorkspaceVariationState` context is the established pattern for lightbox → prompt-area data flow |
| 2026-03-11 | Codebase | `workspace-content.tsx` uses `w-80` (320px) for prompt panel — needs update to `w-[480px]` |
| 2026-03-11 | Codebase | GenerationCards are button elements, not draggable — need HTML5 drag infrastructure |
| 2026-03-11 | Codebase | Prompt composition is simple string concat (motiv + style) — extension point for reference hints |
| 2026-03-11 | Codebase | drizzle-orm 0.45.1, drizzle-kit 0.31.9 — stable, no breaking changes expected |
| 2026-03-11 | Codebase | replicate npm 1.4.0 — `predictions.create()` accepts any input object, no client-side limit on array size |
| 2026-03-11 | Web | FLUX.2 Pro: 8 images, $0.015 + $0.015/MP. FLUX.2 Flex: 10 images. FLUX.2 Dev: multi-image supported |
| 2026-03-11 | Web | @image1-@image8 syntax documented by BFL for referencing specific images in prompt |
| 2026-03-11 | Web | 9 MP total input limit — must validate sum of all reference image dimensions |
| 2026-03-11 | Web | shadcn Collapsible available at `ui.shadcn.com/docs/components/radix/collapsible`, install via `npx shadcn add collapsible` |
| 2026-03-11 | Web | radix-ui 1.4.3 (Aug 2025) — stable, no breaking changes |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| — | Architecture created from comprehensive codebase + web research without interactive Q&A | All technical decisions derived from discovery.md + codebase analysis + FLUX.2 API documentation |
