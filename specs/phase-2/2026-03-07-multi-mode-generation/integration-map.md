# Integration Map: Multi-Mode Generation (img2img + Upscale)

**Generated:** 2026-03-09
**Slices:** 17
**Connections:** 28

---

## Dependency Graph (Visual)

```
slice-01 (DB Schema)
    |
    +---> slice-02 (DB Queries) --------+
    |                                   |
    +---> slice-06 (Gen Svc img2img) <--+---> slice-09 (Actions) <--- slice-08 <--- slice-03
    |                                                   |                            (Storage)
    +---> slice-16 (Gallery/Filter)                    |
                                                       +---> slice-14 (PromptArea)
slice-03 (Storage)                                     |
    |                                                  |
    +---> slice-08 (Action: upload) ---+               +---> slice-17 (Lightbox)
                                       |
slice-04 (ModelSchemaService) -----> slice-06
                                       |
slice-05 (UPSCALE_MODEL) ---------> slice-07 (Gen Svc upscale) --> slice-09

slice-07 (Gen Svc upscale) ------> slice-09 --> slice-14
                                             --> slice-17

slice-10 (WorkspaceState) ---------> slice-14
                                 --> slice-17

slice-11 (ModeSelector) ----------> slice-14
slice-12 (ImageDropzone) ---------> slice-14
slice-13 (StrengthSlider) --------> slice-14

slice-15 (FilterChips+ModeBadge) -> slice-16
```

### Layered View

```
Layer 0 (Foundation — No Dependencies):
  slice-01, slice-03, slice-04, slice-05, slice-10, slice-11, slice-13, slice-15

Layer 1 (Depends on Layer 0):
  slice-02 (-> slice-01)
  slice-08 (-> slice-03)
  slice-12 (-> slice-08)

Layer 2 (Depends on Layer 0+1):
  slice-06 (-> slice-01, slice-02, slice-04)
  slice-07 (-> slice-02, slice-05)
  slice-16 (-> slice-01, slice-15)

Layer 3 (Depends on Layer 2):
  slice-09 (-> slice-06, slice-07, slice-08)

Layer 4 (Integration Layer):
  slice-14 (-> slice-09, slice-10, slice-11, slice-12, slice-13)
  slice-17 (-> slice-09, slice-10)
```

---

## Nodes

### Slice 01: DB Schema — Neue Spalten in generations

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `generations.generationMode`, `generations.sourceImageUrl`, `generations.sourceGenerationId`, `GenerationSelect` type, migration SQL |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `generations.generationMode` | Schema Column | slice-02, slice-06, slice-16 |
| `generations.sourceImageUrl` | Schema Column | slice-02, slice-06 |
| `generations.sourceGenerationId` | Schema Column | slice-02, slice-06 |
| `GenerationSelect` (InferSelectModel) | TypeScript Type | slice-02, slice-06, slice-07, slice-16 |
| `drizzle/migrations/XXXX_add_generation_mode.sql` | Migration File | Deployment |

---

### Slice 02: DB Queries — createGeneration für neue Felder

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `createGeneration` (extended), `CreateGenerationInput` type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `generations.generationMode`, `sourceImageUrl`, `sourceGenerationId` | slice-01 | Columns present in schema |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `createGeneration` | Function | slice-06, slice-07 |
| `CreateGenerationInput` | TypeScript Type | slice-06, slice-07 |
| `getGeneration` (existing, unchanged) | Function | slice-07 |

---

### Slice 03: Storage Client — Dynamischer ContentType

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `upload(stream, key, contentType?)` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `upload` (extended with `contentType?`) | Function | slice-08 |

---

### Slice 04: Model Schema Service — supportsImg2Img Helper

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `ModelSchemaService.supportsImg2Img` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | Uses internal cache and `lib/models.ts` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModelSchemaService.supportsImg2Img` | Function | slice-06 |
| `ModelSchemaService.getSchema` (existing) | Function | slice-06 |

---

### Slice 05: Models — UPSCALE_MODEL Konstante

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `UPSCALE_MODEL` constant |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `UPSCALE_MODEL` | `string` constant | slice-07 |

---

### Slice 06: Generation Service — img2img Erweiterung

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01, slice-02, slice-04 |
| Outputs | `GenerationService.generate` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `Generation.generationMode`, `Generation.sourceImageUrl` | slice-01 | Schema type present |
| `createGeneration` (with optional new fields) | slice-02 | Function signature matches |
| `ModelSchemaService.supportsImg2Img` / `getSchema` | slice-04 | Method present |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationService.generate` (extended) | Function | slice-09 |

---

### Slice 07: Generation Service — upscale() Methode

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02, slice-05 |
| Outputs | `GenerationService.upscale`, `UpscaleInput` type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createGeneration` (with generationMode, sourceImageUrl, sourceGenerationId) | slice-02 | Function signature matches |
| `getGeneration` | slice-02 | Existing function unchanged |
| `UPSCALE_MODEL` | slice-05 | Constant with correct value |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationService.upscale` | Function | slice-09 |
| `UpscaleInput` | TypeScript Type | slice-09 |

---

### Slice 08: Server Action — uploadSourceImage

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | `uploadSourceImage` Server Action |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `upload(stream, key, contentType?)` | slice-03 | Third parameter present |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `uploadSourceImage` | Server Action | slice-09, slice-12 |

---

### Slice 09: Server Actions — generateImages img2img + upscaleImage

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06, slice-07, slice-08 |
| Outputs | `generateImages` (extended), `upscaleImage` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerationService.generate` (with img2img params) | slice-06 | Signature matches |
| `GenerationService.upscale` | slice-07 | Signature matches |
| `uploadSourceImage` | slice-08 | Action signature matches |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `generateImages` (extended) | Server Action | slice-14 |
| `upscaleImage` | Server Action | slice-14, slice-17 |

---

### Slice 10: WorkspaceState Extension

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `WorkspaceVariationState` (extended), `useWorkspaceVariation` hook |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `WorkspaceVariationState` (+ `targetMode`, `sourceImageUrl`, `strength`, `sourceGenerationId`) | Interface | slice-14, slice-17 |
| `useWorkspaceVariation` | Hook | slice-14, slice-17 |

---

### Slice 11: ModeSelector Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `ModeSelector` component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModeSelector` | Component | slice-14 |

---

### Slice 12: ImageDropzone Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-08 |
| Outputs | `ImageDropzone` component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `uploadSourceImage` | slice-08 | Signature `({ projectId, file }) => Promise<{ url } \| { error }>` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ImageDropzone` | Component | slice-14 |

---

### Slice 13: StrengthSlider Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `StrengthSlider` component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `StrengthSlider` | Component | slice-14 |

---

### Slice 14: PromptArea Refactoring — Mode-Awareness

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-09, slice-10, slice-11, slice-12, slice-13 |
| Outputs | `PromptArea` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `generateImages`, `upscaleImage` | slice-09 | Signatures match |
| `useWorkspaceVariation` (with targetMode, sourceImageUrl, strength) | slice-10 | Hook interface matches |
| `ModeSelector` | slice-11 | Component interface matches |
| `ImageDropzone` | slice-12 | Component interface matches |
| `StrengthSlider` | slice-13 | Component interface matches |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `PromptArea` (extended, unchanged external interface) | Component | `components/workspace/workspace-content.tsx` (EXISTING) |

---

### Slice 15: FilterChips + ModeBadge Components

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `FilterChips`, `ModeBadge`, `FilterValue` type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| — | — | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `FilterChips` | Component | slice-16 |
| `ModeBadge` | Component | slice-16 |
| `FilterValue` | TypeScript Type | slice-16 |

---

### Slice 16: GalleryGrid + GenerationCard + WorkspaceContent — Filter + Badge Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01, slice-15 |
| Outputs | Modified existing components |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerationSelect.generationMode` | slice-01 | Field present on Generation type |
| `FilterChips`, `ModeBadge`, `FilterValue` | slice-15 | Components and type exported |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GalleryGrid` (+ `modeFilter` prop) | Component (MODIFY EXISTING) | `workspace-content.tsx` |
| `GenerationCard` (+ ModeBadge overlay) | Component (MODIFY EXISTING) | `gallery-grid.tsx` |
| `WorkspaceContent` (+ FilterChips + modeFilter state) | Component (MODIFY EXISTING) | Workspace Page |

---

### Slice 17: Lightbox — Cross-Mode Buttons (img2img + Upscale Popover)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-09, slice-10 |
| Outputs | `lightbox-modal.tsx` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `upscaleImage` | slice-09 | Signature `({ projectId, sourceImageUrl, scale: 2\|4, sourceGenerationId? }) => Promise<Generation \| { error }>` |
| `useWorkspaceVariation` / `setVariation` | slice-10 | Accepts `targetMode?`, `sourceImageUrl?` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `lightbox-modal.tsx` (extended) | Component (MODIFY EXISTING) | None — terminal component |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | slice-01 | slice-02 | `generations.generationMode/sourceImageUrl/sourceGenerationId` | Schema Columns | VALID |
| 2 | slice-01 | slice-06 | `GenerationSelect` type with new fields | TypeScript Type | VALID |
| 3 | slice-01 | slice-16 | `GenerationSelect.generationMode` | Schema Field | VALID |
| 4 | slice-02 | slice-06 | `createGeneration` (extended) | Function | VALID |
| 5 | slice-02 | slice-07 | `createGeneration` + `getGeneration` | Functions | VALID |
| 6 | slice-03 | slice-08 | `upload(stream, key, contentType?)` | Function | VALID |
| 7 | slice-04 | slice-06 | `ModelSchemaService.supportsImg2Img` / `getSchema` | Function | VALID |
| 8 | slice-05 | slice-07 | `UPSCALE_MODEL` | String Constant | VALID |
| 9 | slice-06 | slice-09 | `GenerationService.generate` (extended) | Function | VALID |
| 10 | slice-07 | slice-09 | `GenerationService.upscale` + `UpscaleInput` | Function + Type | VALID |
| 11 | slice-08 | slice-09 | `uploadSourceImage` | Server Action | VALID |
| 12 | slice-08 | slice-12 | `uploadSourceImage` | Server Action | VALID |
| 13 | slice-09 | slice-14 | `generateImages` + `upscaleImage` | Server Actions | VALID |
| 14 | slice-09 | slice-17 | `upscaleImage` | Server Action | VALID |
| 15 | slice-10 | slice-14 | `useWorkspaceVariation` (extended) | Hook | VALID |
| 16 | slice-10 | slice-17 | `useWorkspaceVariation` / `setVariation` | Hook | VALID |
| 17 | slice-11 | slice-14 | `ModeSelector` | Component | VALID |
| 18 | slice-12 | slice-14 | `ImageDropzone` | Component | VALID |
| 19 | slice-13 | slice-14 | `StrengthSlider` | Component | VALID |
| 20 | slice-15 | slice-16 | `FilterChips` + `ModeBadge` + `FilterValue` | Components + Type | VALID |
| 21 | slice-14 | workspace-content.tsx | `PromptArea` (extended, same interface) | Component MODIFY | VALID |
| 22 | slice-16 | workspace-content.tsx | `WorkspaceContent` (adds FilterChips state) | Component MODIFY | VALID |
| 23 | slice-16 | gallery-grid.tsx | `GalleryGrid` (adds modeFilter prop) | Component MODIFY | VALID |
| 24 | slice-16 | generation-card.tsx | `GenerationCard` (adds ModeBadge) | Component MODIFY | VALID |
| 25 | slice-17 | lightbox-modal.tsx | `lightbox-modal.tsx` (adds buttons) | Component MODIFY | VALID |
| 26 | slice-02 | slice-07 | `getGeneration` (existing, unchanged) | Function | VALID |
| 27 | slice-06 | slice-09 | `GenerationService` via `lib/services/generation-service.ts` | Module | VALID |
| 28 | slice-07 | slice-09 | `GenerationService` via same file | Module | VALID |

---

## Validation Results

### Valid Connections: 28

All declared dependencies have matching outputs in prior or parallel slices.

### Orphaned Outputs: 0

Every output has at least one consumer:
- `drizzle/migrations/XXXX_add_generation_mode.sql` — consumed by Deployment (not a slice consumer but a required infrastructure artifact). Justified and not an orphan.
- `GenerationCard` (modified by slice-16) is consumed by `gallery-grid.tsx` which is also modified by slice-16 — internal to that slice. Valid.

### Missing Inputs: 0

Every declared input maps to an output in an APPROVED slice.

### Deliverable-Consumer Gaps: 0

**Mount-Point Analysis:**

| Component | Defined In | Consumer File | Status |
|-----------|------------|---------------|--------|
| `ModeSelector` | slice-11 → `components/workspace/mode-selector.tsx` | `components/workspace/prompt-area.tsx` | slice-14 MODIFIES `prompt-area.tsx` — VALID |
| `ImageDropzone` | slice-12 → `components/workspace/image-dropzone.tsx` | `components/workspace/prompt-area.tsx` | slice-14 MODIFIES `prompt-area.tsx` — VALID |
| `StrengthSlider` | slice-13 → `components/workspace/strength-slider.tsx` | `components/workspace/prompt-area.tsx` | slice-14 MODIFIES `prompt-area.tsx` — VALID |
| `FilterChips` | slice-15 → `components/workspace/filter-chips.tsx` | `components/workspace/workspace-content.tsx` | slice-16 MODIFIES `workspace-content.tsx` — VALID |
| `ModeBadge` | slice-15 → `components/workspace/mode-badge.tsx` | `components/workspace/generation-card.tsx` | slice-16 MODIFIES `generation-card.tsx` — VALID |
| `uploadSourceImage` | slice-08 → `app/actions/generations.ts` | `components/workspace/image-dropzone.tsx` | slice-12 CREATES `image-dropzone.tsx` which calls this action — VALID |
| `generateImages` (extended) | slice-09 → `app/actions/generations.ts` | `components/workspace/prompt-area.tsx` | slice-14 MODIFIES `prompt-area.tsx` — VALID |
| `upscaleImage` | slice-09 → `app/actions/generations.ts` | `components/workspace/prompt-area.tsx` | slice-14 MODIFIES `prompt-area.tsx` — VALID |
| `upscaleImage` | slice-09 → `app/actions/generations.ts` | `components/lightbox/lightbox-modal.tsx` | slice-17 MODIFIES `lightbox-modal.tsx` — VALID |
| `PromptArea` (extended) | slice-14 → `components/workspace/prompt-area.tsx` | `components/workspace/workspace-content.tsx` | `workspace-content.tsx` ALREADY EXISTS and already imports `PromptArea`. Interface unchanged. No mount-point gap. — VALID |

### Runtime Path Gaps: 0

**Flow Analysis:**

| User-Flow | Full Chain | Status |
|-----------|------------|--------|
| Flow 1: img2img Generation | User → PromptArea (slice-14) → `generateImages` (slice-09) → `GenerationService.generate` (slice-06) → `createGeneration` (slice-02) + Replicate + DB | COMPLETE |
| Flow 2: Upscale via Mode | User → PromptArea (slice-14) → `upscaleImage` (slice-09) → `GenerationService.upscale` (slice-07) → `createGeneration` (slice-02) + Replicate + DB | COMPLETE |
| Flow 3: Upscale via Lightbox | User → Lightbox (slice-17) → `upscaleImage` (slice-09) → `GenerationService.upscale` (slice-07) → DB | COMPLETE |
| Flow 4: Cross-Mode Lightbox → img2img | User → Lightbox (slice-17) → `setVariation` (slice-10) → PromptArea (slice-14) reads `useWorkspaceVariation` | COMPLETE |
| Flow 5: img2img Variation | User → Lightbox (slice-17) → `setVariation` with sourceImageUrl (slice-10) → PromptArea (slice-14) | COMPLETE |
| Source-Image Upload | ImageDropzone (slice-12) → `uploadSourceImage` (slice-08) → `StorageService.upload` (slice-03) → R2 | COMPLETE |
| Gallery Filter | User → FilterChips (slice-15) → WorkspaceContent filter state (slice-16) → GalleryGrid filter (slice-16) | COMPLETE |
| Mode-Switch Auto-Switch | PromptArea (slice-14) → `ModelSchemaService.supportsImg2Img` (slice-04) — NOTE: slice-14 calls this via a Server Action or client-side call; slice-14 constraint says "Model-Auto-Switch nutzt ModelSchemaService.supportsImg2Img() (Server Action oder cached)". slice-04 provides this function which slice-14 will call. VALID |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Covered In | Status |
|-------------------|------|------------|--------|
| ModeSelector (Segmented Control) | Component | slice-11 | COVERED |
| ImageDropzone (Upload Area, 5 states) | Component | slice-12 | COVERED |
| StrengthSlider (Slider + Presets) | Component | slice-13 | COVERED |
| ScaleSelector (Toggle Group 2x/4x) | Component | slice-14 (inline in PromptArea, no separate slice per constraint) | COVERED |
| FilterChips (Toggle Group, single-select) | Component | slice-15 | COVERED |
| ModeBadge (T/I/U) | Component | slice-15 | COVERED |
| UpscalePopover (Popover with 2x/4x) | Component | slice-17 (Shadcn Popover in lightbox-modal) | COVERED |
| LightboxImg2ImgButton | Component | slice-17 | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| txt2img (default) | ModeSelector, Prompt fields, Model, Variants, Generate | Click "Image to Image", Click "Upscale" | slice-14 AC-1 | COVERED |
| img2img | ModeSelector, ImageDropzone, StrengthSlider, Prompt, Model, Variants, Generate | Click "Text to Image", Click "Upscale", Generate | slice-14 AC-2 | COVERED |
| upscale (PromptArea mode) | ModeSelector, ImageDropzone, ScaleSelector, Upscale button | Click "Text to Image", Click "Image to Image", Upscale | slice-14 AC-3 | COVERED |
| Image upload empty | Dashed border, Drop/Click/Paste cues | Drop, Click, URL paste | slice-12 AC-1 | COVERED |
| Image upload drag-over | Border highlighting | dragleave | slice-12 AC-2, AC-3 | COVERED |
| Image upload uploading | Progress indicator | — | slice-12 AC-4 | COVERED |
| Image upload preview | Thumbnail, filename, dimensions, Remove | Remove click | slice-12 AC-5, AC-6 | COVERED |
| Image upload error | Error message | Retry | slice-12 AC-7, AC-8, AC-9 | COVERED |
| Lightbox idle | Variation, img2img, Upscale (mode-dependent) | Click img2img, Click Upscale | slice-17 AC-1, AC-2, AC-3 | COVERED |
| Lightbox popover-open | 2x/4x options | Click 2x, Click 4x | slice-17 AC-5 | COVERED |
| Lightbox upscale processing | Toast "Upscaling..." | — | slice-17 AC-6, AC-7 | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| txt2img | Click "Image to Image" | img2img | slice-14 AC-2 | COVERED |
| txt2img | Click "Upscale" | upscale | slice-14 AC-3 | COVERED |
| img2img | Click "Text to Image" | txt2img | slice-14 AC-4 (state persistence) | COVERED |
| img2img | Click "Upscale" | upscale | slice-14 (modeStates) | COVERED |
| upscale | Click "Text to Image" | txt2img | slice-14 AC-5 | COVERED |
| upscale | Click "Image to Image" | img2img | slice-14 AC-6 | COVERED |
| * | Lightbox "img2img" Click | img2img | slice-17 AC-4 + slice-14 AC-7 | COVERED |
| empty | File drop/Click/URL paste | uploading | slice-12 AC-4, AC-11, AC-12 | COVERED |
| uploading | Upload complete | preview | slice-12 AC-4 | COVERED |
| uploading | Upload error | error | slice-12 AC-7, AC-8 | COVERED |
| preview | Click Remove | empty | slice-12 AC-6 | COVERED |
| error | Retry | uploading | slice-12 AC-9 | COVERED |
| Lightbox idle | Click Upscale Button | popover-open | slice-17 AC-5 | COVERED |
| popover-open | Click 2x/4x | processing | slice-17 AC-6, AC-7 | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Modell-Kompatibilitaet (img2img zeigt nur kompatible Modelle) | slice-04 (supportsImg2Img), slice-14 AC-12 (auto-switch) | COVERED |
| Source-Image persistent (R2 unter sources/{projectId}/{uuid}.{ext}) | slice-08 AC-9, AC-10 | COVERED |
| Source-Image Formate (PNG/JPG/JPEG/WebP, max 10MB) | slice-08 AC-1 bis AC-8 | COVERED |
| Strength Default 0.6, Range 0.0-1.0 | slice-06 AC-7, slice-09 AC-2, AC-3 | COVERED |
| Upscale immer 1 Bild | slice-07 AC-5, slice-09 AC-8 | COVERED |
| Upscale Modell (Real-ESRGAN, fixed) | slice-05, slice-07 AC-1 | COVERED |
| Galerie Filter persistent per Session | slice-16 AC-9 (useState in WorkspaceContent) | COVERED |
| Empty Filter Message ("No {mode} generations yet") | slice-16 AC-3, AC-4, AC-5 | COVERED |
| Lightbox Variation bei img2img (laedt Original-Source) | slice-17 AC-9, AC-10 | COVERED |
| Cross-Mode Prompt (Prompt uebernommen) | slice-17 AC-4 + slice-14 AC-7 | COVERED |
| Modus-Wechsel behaelt State (State Persistence Matrix) | slice-14 AC-4, AC-5, AC-6 | COVERED |
| Modell Auto-Switch bei img2img + Toast | slice-14 AC-12 | COVERED |
| Negative Prompt schema-driven (alle Modi) | Existing ParameterPanel — not changed, Out of Scope for new slices | COVERED (existing) |
| Upscale Prompt Konvention ("Upscale Nx" / "... (Upscale Nx)") | slice-07 AC-1, AC-2, AC-3 | COVERED |
| Galerie Filter V1 client-side | slice-16 (client-side .filter()) | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `generationMode` (varchar(20), NOT NULL, DEFAULT 'txt2img') | Yes | slice-01 | COVERED |
| `sourceImageUrl` (text, NULLABLE) | No | slice-01 | COVERED |
| `sourceGenerationId` (uuid FK, NULLABLE) | No | slice-01 | COVERED |
| `strength` (in modelParams, 0.0-1.0) | No | slice-06 (buildReplicateInput), slice-09 | COVERED |
| `upscaleScale` (2 or 4, in modelParams) | No | slice-07 (Replicate input), slice-09 | COVERED |

**Discovery Coverage:** 100% — all elements from UI Components, State Machine, Transitions, Business Rules, and Data Fields sections are covered by at least one APPROVED slice.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 17 |
| Slices APPROVED | 17 |
| Total Connections | 28 |
| Valid Connections | 28 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |

**Verdict: READY FOR ORCHESTRATION**
