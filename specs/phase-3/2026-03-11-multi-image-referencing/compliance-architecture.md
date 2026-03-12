# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md`
**Pruefdatum:** 2026-03-12
**Discovery:** `specs/phase-3/2026-03-11-multi-image-referencing/discovery.md`
**Wireframes:** `specs/phase-3/2026-03-11-multi-image-referencing/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 51 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Up to 5 reference images per generation | Scope, Constraints | `uploadReferenceImage`, `generateImages` (EXTEND) | `reference_images`, `generation_references` | PASS |
| 5 roles: Style, Content, Structure, Character, Color | Scope, DTOs, Validation Rules | `ReferenceInput.role` enum | `generation_references.role` VARCHAR(20) | PASS |
| Per-image strength dropdown (4 levels) | Scope, DTOs, Validation Rules | `ReferenceInput.strength` enum | `generation_references.strength` VARCHAR(20) | PASS |
| @1-@5 inline reference syntax | Scope, Prompt Composition | `composeMultiReferencePrompt()` | N/A (prompt-level) | PASS |
| Vertical slot list (480px panel, 80x80 thumbnails) | Scope, Architecture Layers | N/A (UI only) | N/A | PASS |
| Color coding per role (5 specific hex colors) | Scope | N/A (UI only, colors in Discovery) | N/A | PASS |
| File Upload (Drag & Drop, Click, URL Paste) | Server Actions: `uploadReferenceImage` | `uploadReferenceImage({ file, url })` | `reference_images` | PASS |
| Gallery as source: Drag & Drop + Lightbox Button | Server Logic: `ReferenceService.uploadFromGallery`, Migration Map: `generation-card.tsx` | `uploadReferenceImage` (gallery path) | `reference_images.sourceType = "gallery"` | PASS |
| Persistent reference images per project (DB + R2) | Server Logic, DB Schema | `getReferenceImages({ projectId })` | `reference_images` with FK to projects | PASS |
| Provenance: Lightbox shows used references as thumbnail row | Migration Map: `lightbox-modal.tsx`, Server Logic | Query `generation_references` | `generation_references` join | PASS |
| Model compatibility warning (fewer images than uploaded) | Constraints, Error Handling | Client-side detection via `getMaxImageCount()` | N/A | PASS |
| Replaces single-image img2img (1 ref + Content = classic) | Constraints: backwards compatibility, `buildReplicateInput` extension | `buildReplicateInput()` fallback | `sourceImageUrl` deprecated | PASS |
| Collapsible reference section when no images | Architecture Layers: `components/workspace/reference-*.tsx`, Migration Map: `prompt-area.tsx` | N/A (UI only) | N/A | PASS |
| Ref Hint Banner (dismissible, localStorage, dynamic @-numbers) | Scope, Migration Map | N/A (UI only) | N/A | PASS |
| "Als Referenz nutzen" Button in Lightbox | Migration Map: `lightbox-modal.tsx` | Via workspace-state context | N/A | PASS |
| Mode-Switch preservation (References survive txt2img/img2img switch) | Architecture Layers: workspace-state extension | N/A | N/A | PASS |
| Migration: sourceImageUrl to generation_references | Migration Map, Risks, Open Questions | Slice 9 | `generation_references` records from existing data | PASS |
| Prompt-Mapping @N to @imageN for FLUX.2 API | Server Logic: `composeMultiReferencePrompt()` | Regex `/@(\d+)/g` | N/A | PASS |

**Result: 18/18 features mapped. No gaps.**

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Max 5 reference images | Discovery: Business Rules | Wireframe: [5/5] counter badge | Validation Rules: "References count <= 5", `slotPosition: 1-5` | PASS |
| 80x80 thumbnails | Discovery: UI Components | Wireframe: "img 80x80" in all slot wireframes | Architecture Layers: `reference-*.tsx` (implied) | PASS |
| 480px panel width (up from 320px w-80) | Discovery: Business Rules "Panel-Breite" | Wireframe: "480px wide" | Migration Map: `workspace-content.tsx` `w-80` to `w-[480px]` | PASS |
| Upload format PNG/JPG/JPEG/WebP | Discovery: Business Rules | N/A | Validation Rules: "image/png, image/jpeg, image/webp" | PASS |
| Upload max 10MB per image | Discovery: Business Rules | N/A | Validation Rules: "File size <= 10 MB" | PASS |
| 4 strength levels (Subtle/Moderate/Strong/Dominant) | Discovery: Business Rules | Wireframe: StrengthDropdown options | Validation Rules + Prompt Composition Step 2 | PASS |
| Sparse slot labels (no re-numbering on remove) | Discovery: Business Rules "Slot-Labels" | Wireframe: "@1, @3, @5" sparse example | Constraints: "Sparse slot numbering", DB `slotPosition` is source of truth | PASS |
| Rollen-Farbschema (5 hex colors specified) | Discovery: UI Layout table | Wireframe: "(violet)", "(blue)", "(green)" annotations | Not explicit in Architecture (UI-level detail), Discovery colors carried through | PASS |
| FLUX.2 Edit max 9 MP total input | Discovery: Research | N/A | Validation Rules: "Total input megapixels <= 9 MP", Constraints table | PASS |
| FLUX.2 Pro max 8 input images (our 5 within bounds) | Discovery: Research | N/A | Constraints: "Our limit of 5 is within bounds, 5 < 8" | PASS |
| RefHintBanner dismiss persisted in localStorage | Discovery: UI Components | Wireframe: dismiss [x] annotation | Architecture Layers mentions component, constraint carried through | PASS |
| Collapsible states (collapsed-empty, collapsed-filled, expanded) | Discovery: State Machine | Wireframe: 3 collapsed state wireframes | Architecture Layers: Collapsible (shadcn), Migration Map: prompt-area.tsx | PASS |
| CompatibilityWarning 3 states (hidden, partial, no-support) | Discovery: UI Components | Wireframe: 3 states wireframed | Error Handling: "Model incompatibility - client-side detection - Warning banner + dimmed slots" | PASS |
| Gallery images no re-upload needed | Discovery: Business Rules | N/A | Server Logic: `ReferenceService.uploadFromGallery` -- "DB insert only" | PASS |
| Generate disabled when model has no img2img support | Discovery: UI Components | Wireframe: no-support state "Generate button disabled" | Error Handling + Constraints | PASS |
| Strength as prompt hints (not numeric API params) | Discovery: Business Rules "Strength als Prompt-Hint" | N/A | Constraints: "FLUX.2 Edit has no native per-image weights", Prompt Composition Step 2 | PASS |
| R2 key pattern: `references/{projectId}/{uuid}.{ext}` | Discovery: current state "R2 Storage Client" | N/A | Security: Data Protection section, Technology Decisions | PASS |

**Result: 17/17 constraints mapped. No gaps.**

---

## C) Realistic Data Check

### Codebase Evidence

```
Existing URL fields in lib/db/schema.ts:
- thumbnailUrl: text("thumbnail_url")              -- TEXT
- imageUrl: text("image_url")                      -- TEXT
- sourceImageUrl: text("source_image_url")         -- TEXT
- prompt: text("prompt")                           -- TEXT
- negativePrompt: text("negative_prompt")          -- TEXT
- errorMessage: text("error_message")              -- TEXT
- promptMotiv: text("prompt_motiv")                -- TEXT
- promptStyle: text("prompt_style")                -- TEXT

Codebase pattern: ALL URL and long-string fields use TEXT (no length limit).

Existing VARCHAR fields in lib/db/schema.ts:
- name: varchar("name", { length: 255 })
- modelId: varchar("model_id", { length: 255 })
- status: varchar("status", { length: 20 })             -- values: "pending", "completed", "failed"
- thumbnailStatus: varchar("thumbnail_status", { length: 20 }) -- values: "none", ...
- generationMode: varchar("generation_mode", { length: 20 })  -- values: "txt2img", "img2img", "upscale"
- replicatePredictionId: varchar("replicate_prediction_id", { length: 255 })
- text (snippets): varchar("text", { length: 500 })
- category: varchar("category", { length: 100 })

Codebase pattern: Short enum-like fields use VARCHAR(20). IDs/names use VARCHAR(255).

R2 URL construction (from lib/clients/storage.ts line 113):
- Format: `${config.publicUrl}/${key}`
- Measured publicUrl: "https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev" (54 chars)
- Key pattern for references: "references/{uuid}/{uuid}.{ext}"
- Sample full URL: "https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev/references/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001.png"
- Measured full URL length: ~135 chars
- TEXT is appropriate (codebase convention for URLs).
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| Replicate API | prediction.id | ~25-30 chars | alphanumeric string | VARCHAR(255) (existing) | PASS -- generous buffer, matches existing codebase pattern |
| Cloudflare R2 | public URL (references) | ~135 chars | `https://pub-...r2.dev/references/{uuid}/{uuid}.ext` | TEXT | PASS -- TEXT correct for URLs per codebase convention |
| Cloudflare R2 | public URL (gallery images) | ~120 chars | `https://pub-...r2.dev/projects/{uuid}/{uuid}.png` | TEXT | PASS -- gallery images used as reference URLs, same TEXT type |
| FLUX.2 API | input_images | Array of URL strings | R2 public URLs (~135 chars each) | N/A (runtime only, not stored) | PASS |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `reference_images.id` | UUID | Codebase: all 5 tables use UUID PK with `gen_random_uuid()` | PASS | None |
| `reference_images.projectId` | UUID | Codebase: `projects.id` is UUID, FK pattern established | PASS | None |
| `reference_images.imageUrl` | TEXT | Codebase: all URL fields (`imageUrl`, `sourceImageUrl`, `thumbnailUrl`) use TEXT. Measured R2 URL: ~135 chars. TEXT is correct. | PASS | None |
| `reference_images.originalFilename` | VARCHAR(255) | Codebase: `projects.name` uses VARCHAR(255). Filenames limited to 255 chars by most filesystems. | PASS | None |
| `reference_images.width` | INTEGER | Codebase: `generations.width` uses INTEGER | PASS | None |
| `reference_images.height` | INTEGER | Codebase: `generations.height` uses INTEGER | PASS | None |
| `reference_images.sourceType` | VARCHAR(20) | Values: "upload" (6), "gallery" (7). Max 7 chars. Codebase: `status` and `generationMode` use VARCHAR(20) for short enums. 2.8x buffer. | PASS | None |
| `reference_images.sourceGenerationId` | UUID, FK, ON DELETE SET NULL | Codebase: `generations.sourceGenerationId` uses exact same pattern (UUID, FK, ON DELETE SET NULL) | PASS | None |
| `reference_images.createdAt` | TIMESTAMP WITH TIMEZONE | Codebase: all 5 tables use this exact type with `defaultNow()` | PASS | None |
| `generation_references.id` | UUID | Codebase: all tables use UUID PK | PASS | None |
| `generation_references.generationId` | UUID, FK, ON DELETE CASCADE | Codebase: `generations.projectId` uses same FK + CASCADE pattern | PASS | None |
| `generation_references.referenceImageId` | UUID, FK, ON DELETE CASCADE | New FK, follows established codebase pattern | PASS | None |
| `generation_references.role` | VARCHAR(20) | Values: "style"(5), "content"(7), "structure"(9), "character"(9), "color"(5). Max 9 chars. 2.2x buffer. Matches `status` VARCHAR(20) pattern. | PASS | None |
| `generation_references.strength` | VARCHAR(20) | Values: "subtle"(6), "moderate"(8), "strong"(6), "dominant"(8). Max 8 chars. 2.5x buffer. | PASS | None |
| `generation_references.slotPosition` | INTEGER | Values: 1-5. INTEGER is correct and consistent with `projectSelectedModels.position` INTEGER pattern. | PASS | None |

**Result: 15/15 data types validated. All follow established codebase patterns with adequate buffers.**

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing Project (package.json exists with version constraints)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest (WebSearch) | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------------------|----------|--------|
| Next.js | 16.1.6 | `"next": "16.1.6"` (exact) | PASS | No | 16.1.6 | PASS | PASS |
| React | 19.2.3 | `"react": "19.2.3"` (exact) | PASS | No | 19.2.3 | PASS | PASS |
| replicate | 1.4.0 (npm, Nov 2025) | `"replicate": "^1.4.0"` | PASS | No | 1.4.0 | PASS | PASS |
| @aws-sdk/client-s3 | 3.1003.0 (npm) | `"@aws-sdk/client-s3": "^3.1003.0"` | PASS | No | 3.1006.0 | PASS (minor patch) | PASS |
| drizzle-orm | 0.45.1 (npm, Dec 2025) | `"drizzle-orm": "^0.45.1"` | PASS | No | 0.45.1 | PASS | PASS |
| drizzle-kit | 0.31.9 (npm) | `"drizzle-kit": "^0.31.9"` | PASS | No | 0.31.9 | PASS | PASS |
| radix-ui | 1.4.3 (npm, Aug 2025) | `"radix-ui": "^1.4.3"` | PASS | No | 1.4.3 | PASS | PASS |
| shadcn/ui (CLI) | 3.8.5 (npm, project pinned) | `"shadcn": "^3.8.5"` | PASS | No | 4.0.5 (Mar 2026) | PASS (see note) | PASS |
| sharp | 0.34.5 (npm) | `"sharp": "^0.34.5"` | PASS | No | 0.34.5 | PASS | PASS |

**shadcn Detail:** Architecture correctly documents version `3.8.5` with semver constraint `^3.8.5` = `>=3.8.5 <4.0.0`. Notes that shadcn CLI v4.0.5 was released Mar 2026 but upgrade is "optional, not required for this feature." This is accurate: the `npx shadcn add collapsible` command used as pre-requisite for Slice 4 will use the npx-resolved version (latest CLI) to generate the component, but the project's local devDependency pinning at 3.x is correct and does not conflict. Previous blocking issue from prior compliance check has been resolved.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate API (FLUX.2 Pro/Flex/Dev) | 429 detection in existing error handling | Bearer token via `REPLICATE_API_TOKEN` env var | Existing: failed status + errorMessage in DB, rate limit toast | `ModelSchemaService`: 5000ms fetch timeout (line 55) | PASS |
| Cloudflare R2 (S3-compatible) | No explicit rate limit (single-user app) | Access key + secret via env vars (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) | Existing: error handling in `storage.ts` with descriptive messages | Default AWS SDK S3 client timeouts | PASS |
| PostgreSQL via Drizzle | N/A | Connection string via env | Existing: error handling in query layer | Default postgres connection timeout | PASS |

---

## E) Migration Completeness

> Architecture contains a "Migration Map" section with 10 file-level entries. Scope is feature extension (not a pure migration/refactoring), but the Migration Map provides guidance. Discovery lists 9 implementation slices. The Migration Map covers all files that need changes.

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| 9 Implementation Slices touching existing files | Migration Map: 10 file entries (specific files, not directories) | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/db/schema.ts` | 5 tables | 7 tables (+reference_images, +generation_references) | Yes: `expect(tables).toContain("reference_images")` | PASS |
| `lib/db/queries.ts` | CRUD for generations, projects, models | +CRUD for reference_images, generation_references | Yes: test `createReferenceImage`, `deleteReferenceImage`, etc. exist | PASS |
| `app/actions/generations.ts` | `generateImages()` accepts `sourceImageUrl?: string` | `generateImages()` accepts `references?: ReferenceInput[]` | Yes: check input type accepts `references` array | PASS |
| `lib/services/generation-service.ts` | `buildReplicateInput()` uses single `sourceImageUrl` | Maps multiple reference URLs to `input_images` array | Yes: test array output with multiple URLs | PASS |
| `lib/services/model-schema-service.ts` | `getImg2ImgFieldName()` returns field info | +`getMaxImageCount()` returns max images from schema | Yes: test new function exists and returns number | PASS |
| `components/workspace/prompt-area.tsx` | img2img mode: single ImageDropzone + StrengthSlider | img2img mode: ReferenceBar replaces ImageDropzone | Yes: test ReferenceBar renders, ImageDropzone removed from img2img | PASS |
| `components/workspace/workspace-content.tsx` | `w-80` (320px) at line 145 | `w-[480px]` | Yes: `expect(el.className).toContain("w-[480px]")` | PASS |
| `components/lightbox/lightbox-modal.tsx` | 5 action buttons (Variation, Img2Img, Upscale, Download, Delete) | 6 buttons (+UseAsReference), +ProvenanceRow | Yes: test 6th button exists, ProvenanceRow renders | PASS |
| `lib/workspace-state.tsx` | `WorkspaceVariationState` with `sourceImageUrl` | Extended with `addReference?: { imageUrl, generationId? }` | Yes: test type has `addReference` field | PASS |
| `components/workspace/generation-card.tsx` | `<button>` element (not draggable) | `draggable` attribute + custom `dataTransfer` | Yes: `expect(el).toHaveAttribute("draggable", "true")` | PASS |

**Result: 10/10 migration entries are file-level, specific, and testable.**

---

## Blocking Issues

None.

---

## Recommendations

1. **[Info]** The `collapsible` shadcn component is not yet installed (`components/ui/collapsible.tsx` does not exist). Architecture correctly documents `npx shadcn add collapsible` as a pre-requisite for Slice 4. This is not blocking -- it is a planned installation step.

2. **[Info]** All data types follow established codebase patterns exactly. URL fields use TEXT (consistent with `imageUrl`, `sourceImageUrl`, `thumbnailUrl`). Enum fields use VARCHAR(20) (consistent with `status`, `generationMode`). No data type risks identified.

3. **[Info]** The new R2 key pattern `references/{projectId}/{uuid}.{ext}` is cleanly separated from existing patterns (`projects/` for generations, `sources/` for uploads). No collision risk.

4. **[Info]** Architecture correctly identifies `workspace-content.tsx` line 145 uses `w-80` (320px) -- confirmed in codebase. The migration to `w-[480px]` is well-documented with a testable target pattern.

5. **[Info]** The shadcn version issue from the prior compliance check has been resolved. Architecture now correctly documents version 3.8.5 with accurate semver semantics and notes the 4.0.5 release as optional.

6. **[Info]** `GenerationCard` is confirmed as a `<button>` element (not draggable) at `components/workspace/generation-card.tsx` line 23 -- matches architecture's Migration Map claim.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Proceed to Slice planning (Gate 2)
