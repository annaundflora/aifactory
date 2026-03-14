# Architecture: Model Handling Redesign — Draft/Quality Tier System

**Epic:** –
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- User muss aktuell aus 30+ Replicate-Models selbst wählen — überfordert und irrelevant für die meisten Use Cases
- Parameter-Panel zeigt dynamische Model-Parameter (steps, guidance_scale, etc.) — erhöht Complexity ohne Mehrwert für Nicht-Experten
- Multi-Model-Selektion (1-3 Models gleichzeitig) wird kaum genutzt, erhöht aber Code-Complexity
- Kein Settings-UI vorhanden — Konfiguration verstreut über Projekt-Selections und Favorites

**Solution:**
- Jeder Mode (txt2img, img2img, upscale) bekommt fest zugewiesene Models mit voreingestellten Parametern
- 2 Tiers: **Draft** (schnell/günstig iterieren) und **Quality** (Production/Finishing) + optionaler **Max Quality** Toggle Button (Premium)
- Neuer globaler Settings-Dialog für Model-Zuweisung pro Mode
- Parameter-Panel und Multi-Model-Selektion entfallen komplett

**Business Value:**
- Drastisch vereinfachte UX — weniger Entscheidungen, schnellerer Workflow
- Klare Kosten-Transparenz: Draft = günstig, Quality = teurer, Max Quality = Premium
- Weniger Code-Complexity durch Entfernung von ModelBrowserDrawer, ParameterPanel, Multi-Model-Logik

---

## Scope & Boundaries

| In Scope |
|----------|
| Draft/Quality Toggle in Workspace Prompt-Area |
| Draft/Quality Toggle pro Canvas-Tool (in Variation/Img2Img/Upscale-Popovers + Chat-Panel) |
| Max Quality Toggle Button (nur bei Quality sichtbar, pro Generation) |
| Neuer Settings-Dialog (Modal) mit Model-Zuweisung pro Mode + Tier |
| Schema-Check bei Model-Zuweisung in Settings (Kompatibilitätsvalidierung) |
| Default-Models bei Erstinstallation (Flux Schnell / Flux 2 Pro / Flux 2 Max / Real-ESRGAN / Crystal-Upscaler) |
| Neue DB-Tabelle für globale Model-Settings |
| Entfernung: ModelBrowserDrawer aus Workspace/Canvas |
| Entfernung: ParameterPanel |
| Entfernung: Multi-Model-Selektion (1-3 Models) |
| Preset-Parameter pro zugewiesenem Model (nicht user-konfigurierbar) |

| Out of Scope |
|--------------|
| Stil-Presets (Logo/Photo/Art Mode) — separates Feature |
| Per-Projekt Model-Overrides |
| API Key Verwaltung in Settings |
| Migration bestehender favorite_models / project_selected_models Daten |
| Entfernung alter DB-Tabellen (können deprecated bleiben) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (`"use server"`) |
| Authentication | None (single-user app, no auth layer) |
| Rate Limiting | Replicate API concurrency limit (1 concurrent, existing) |

### Server Actions (new)

| Action | File | Input | Output | Business Logic |
|--------|------|-------|--------|----------------|
| `getModelSettings` | `app/actions/model-settings.ts` | `void` | `ModelSetting[]` | Fetches all model_settings rows. If table empty, seeds defaults first. |
| `updateModelSetting` | `app/actions/model-settings.ts` | `{ mode: GenerationMode, tier: Tier, modelId: string }` | `ModelSetting \| { error: string }` | Validates modelId format. Runs schema compatibility check for mode. Upserts row. Returns updated setting. |

### Server Actions (changed)

| Action | File | Change | Reason |
|--------|------|--------|--------|
| `generateImages` | `app/actions/generations.ts` | `modelIds` still accepts array but always receives single item. `params` receives preset params from settings. | Multi-model removed, params come from model_settings |
| `upscaleImage` | `app/actions/generations.ts` | Add `modelId: string` and `modelParams: Record<string, unknown>` to input. Remove hardcoded `UPSCALE_MODEL`. | Upscale model now comes from settings (draft/quality tier) |

### Server Actions (deprecated — not called anymore, keep for now)

| Action | File | Status |
|--------|------|--------|
| `getFavoriteModels` | `app/actions/models.ts` | Deprecated — no UI calls this |
| `toggleFavoriteModel` | `app/actions/models.ts` | Deprecated — no UI calls this |
| `getProjectSelectedModels` | `app/actions/models.ts` | Deprecated — no UI calls this |
| `saveProjectSelectedModels` | `app/actions/models.ts` | Deprecated — no UI calls this |

### Data Transfer Objects

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `ModelSetting` | `id: string`, `mode: GenerationMode`, `tier: Tier`, `modelId: string`, `modelParams: Record<string, unknown>`, `createdAt: Date`, `updatedAt: Date` | — | DB row type (Drizzle inferred) |
| `UpdateModelSettingInput` | `mode: GenerationMode`, `tier: Tier`, `modelId: string` | `mode` ∈ {txt2img, img2img, upscale}. `tier` ∈ {draft, quality, max}. `modelId` matches `/^[a-z0-9-]+\/[a-z0-9._-]+$/`. Combo (upscale, max) rejected. | `modelParams` not user-settable — resolved from preset defaults |
| `UpscaleImageInput` (changed) | existing fields + `modelId: string`, `modelParams: Record<string, unknown>` | `modelId` matches model regex | Replaces hardcoded UPSCALE_MODEL |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `model_settings` (new) | Global model assignment per mode+tier | `id`, `mode`, `tier`, `model_id`, `model_params` |
| `generations` (existing) | Generation records | `modelId`, `modelParams`, `generationMode` — unchanged |
| `favorite_models` (existing) | Deprecated — no longer read/written | — |
| `project_selected_models` (existing) | Deprecated — no longer read/written | — |

### Schema Details — `model_settings` (new)

| Column | Type | Constraints | Index |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Yes (PK) |
| `mode` | `varchar(20)` | NOT NULL | Part of unique |
| `tier` | `varchar(20)` | NOT NULL | Part of unique |
| `model_id` | `varchar(255)` | NOT NULL | No |
| `model_params` | `jsonb` | NOT NULL, default `{}` | No |
| `created_at` | `timestamp with time zone` | NOT NULL, default `now()` | No |
| `updated_at` | `timestamp with time zone` | NOT NULL, default `now()` | No |

**Unique Constraint:** `(mode, tier)` — max 1 model per mode+tier combination

### Seed Data (migration inserts)

| mode | tier | model_id | model_params |
|------|------|----------|--------------|
| `txt2img` | `draft` | `black-forest-labs/flux-schnell` | `{}` |
| `txt2img` | `quality` | `black-forest-labs/flux-2-pro` | `{}` |
| `txt2img` | `max` | `black-forest-labs/flux-2-max` | `{}` |
| `img2img` | `draft` | `black-forest-labs/flux-schnell` | `{ "prompt_strength": 0.6 }` |
| `img2img` | `quality` | `black-forest-labs/flux-2-pro` | `{ "prompt_strength": 0.6 }` |
| `img2img` | `max` | `black-forest-labs/flux-2-max` | `{ "prompt_strength": 0.6 }` |
| `upscale` | `draft` | `nightmareai/real-esrgan` | `{ "scale": 2 }` |
| `upscale` | `quality` | `philz1337x/crystal-upscaler` | `{ "scale": 4 }` |

### Relationships

| From | To | Relationship | Cascade |
|------|----|--------------|---------|
| `model_settings` | — | Standalone (no FK) | — |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `ModelSettingsService` (new) | CRUD for model_settings table, seed defaults, compatibility check | mode, tier, modelId | ModelSetting rows | DB writes on update/seed |
| `GenerationService` (changed) | Image generation orchestration | projectId, prompt, modelId (single), params (preset) | Generation[] | DB writes, Replicate API calls, R2 uploads |
| `ModelSchemaService` (unchanged) | Fetch + cache Replicate model schemas | modelId | Schema properties | HTTP to Replicate API |
| `CollectionModelService` (unchanged) | Fetch Replicate collection models | void | CollectionModel[] | HTTP to Replicate API (cached 1h) |

### New Service: `ModelSettingsService` (`lib/services/model-settings-service.ts`)

| Function | Input | Output | Side Effects |
|----------|-------|--------|--------------|
| `getAll()` | void | `ModelSetting[]` | Seeds defaults if table empty |
| `getForModeTier(mode, tier)` | mode: GenerationMode, tier: Tier | `ModelSetting \| undefined` | — |
| `update(mode, tier, modelId, modelParams)` | mode, tier, modelId, modelParams | `ModelSetting` | DB upsert (ON CONFLICT update) |
| `seedDefaults()` | void | `void` | Inserts 8 default rows (ON CONFLICT ignore) |
| `checkCompatibility(modelId, mode)` | modelId, mode | `boolean` | Calls ModelSchemaService for img2img check |

### Business Logic Flow

```
[Settings Dialog]
  → updateModelSetting(mode, tier, modelId)
    → Validate modelId format
    → checkCompatibility(modelId, mode) via ModelSchemaService
    → If incompatible → return { error }
    → Upsert model_settings row
    → Return updated setting

[Generation (Workspace/Canvas)]
  → UI reads model_settings (cached in React state)
  → User selects tier → resolves modelId + modelParams from settings
  → generateImages({ modelIds: [resolvedModelId], params: resolvedParams, ... })
    → GenerationService.generate() (existing flow, single model)
    → processGeneration() → ReplicateClient.run() → R2 upload

[Upscale (Workspace/Canvas)]
  → UI reads model_settings for upscale mode + selected tier
  → upscaleImage({ modelId: resolvedModelId, modelParams: resolvedParams, ... })
    → GenerationService.upscale() (changed: accepts modelId + params)
    → processGeneration() → ReplicateClient.run() → R2 upload
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `modelId` | Matches `/^[a-z0-9-]+\/[a-z0-9._-]+$/` | "Invalid model ID format" |
| `mode` | One of `txt2img`, `img2img`, `upscale` | "Invalid generation mode" |
| `tier` | One of `draft`, `quality`, `max` | "Invalid tier" |
| `(upscale, max)` | Rejected — upscale has no max tier | "Upscale mode does not support max tier" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| App Access | None | Single-user local app, no auth |
| DB Access | Direct connection via `DATABASE_URL` | Existing pattern |
| Replicate API | `REPLICATE_API_TOKEN` env var | Existing pattern |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| `model_id` | Format validation | Regex prevents injection |
| `model_params` | JSONB type | Drizzle handles serialization |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| `modelId` (server action) | Regex check `/^[a-z0-9-]+\/[a-z0-9._-]+$/` | No HTML/XSS risk (internal data) |
| `mode` (server action) | Enum whitelist check | — |
| `tier` (server action) | Enum whitelist check | — |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Replicate API | 1 concurrent (existing) | Per-request | Queue-based (existing ReplicateClient) |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| UI Components | Tier selection, Settings dialog, generation triggers | React components with local state |
| Server Actions | Input validation, service orchestration | Next.js `"use server"` functions |
| Services | Business logic, external API calls | Stateless service modules |
| Database Queries | Data access, CRUD operations | Drizzle ORM query functions |
| External APIs | Replicate model execution, schema/collection fetch | HTTP clients with caching |

### Data Flow

```
[UI: TierToggle + PromptArea/Canvas]
  ↓ (user selects tier, clicks Generate)
  → [Server Action: generateImages / upscaleImage]
    → [GenerationService: generate / upscale]
      → [DB: createGeneration]
      → [ReplicateClient: run] (fire-and-forget)
        → [R2: upload result]
        → [DB: updateGeneration]

[UI: SettingsDialog]
  ↓ (user changes model assignment)
  → [Server Action: updateModelSetting]
    → [ModelSettingsService: checkCompatibility + update]
      → [ModelSchemaService: getSchema] (for compatibility)
      → [DB: upsert model_settings]
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Invalid model format | Return `{ error }` from server action | Toast notification | None needed |
| Incompatible model | Return `{ error }` from server action | Model greyed out in dropdown | None needed |
| Collection fetch fail | Return `{ error }` from service | Error message replaces dropdown | Console warn |
| Replicate API fail | Existing error handling | Toast "Generierung fehlgeschlagen" | Console error |
| Schema fetch fail | Return `{ error }` from service | Fallback: allow selection (no filter) | Console warn |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | Defines `favoriteModels`, `projectSelectedModels`, `generations` tables | Add `modelSettings` table definition | Add new `modelSettings` pgTable with columns (id, mode, tier, model_id, model_params, created_at, updated_at) + unique constraint on (mode, tier) |
| `lib/db/queries.ts` | Exports `getFavoriteModelIds`, `addFavoriteModel`, `removeFavoriteModel`, `getProjectSelectedModelIds`, `saveProjectSelectedModelIds` | Add model_settings queries, keep old queries (deprecated) | Add `getAllModelSettings()`, `getModelSettingByModeTier()`, `upsertModelSetting()`, `seedModelSettingsDefaults()` |
| `lib/services/generation-service.ts` | `upscale()` uses hardcoded `UPSCALE_MODEL` from `lib/models.ts`. `generate()` accepts `modelIds[]` (1-3). Multi-model logic creates separate generations per model. | `upscale()` accepts `modelId` + `modelParams` parameters. `generate()` still accepts `modelIds[]` but always receives single item. Multi-model branching can remain (no-op for single model). | Change `upscale()` signature: add `modelId: string, modelParams: Record<string, unknown>`. Remove `UPSCALE_MODEL` import. Pass `modelId` to `createGeneration()`. Merge `modelParams` with `{ image, scale }` in `processGeneration()`. |
| `lib/models.ts` | Exports `UPSCALE_MODEL = "nightmareai/real-esrgan"` | No longer imported by generation-service | Constant can remain for test backwards compat, but no production import |
| `app/actions/generations.ts` | `upscaleImage()` calls `GenerationService.upscale(projectId, sourceImageUrl, scale, sourceGenerationId)` | `upscaleImage()` input adds `modelId` + `modelParams`. Passes to service. | Add `modelId: string` and `modelParams: Record<string, unknown>` to `UpscaleImageInput`. Validate `modelId`. Pass to `GenerationService.upscale()`. |
| `components/workspace/prompt-area.tsx` | Uses `selectedModels[]` state, `ModelTrigger`, `ModelBrowserDrawer`, `ParameterPanel`. `handleGenerate()` passes `modelIds` from selectedModels + `params` from paramValues. Loads schema per model. | Uses `tierState` (draft/quality/max). Resolves model from cached `modelSettings`. Passes single modelId + preset params. No ModelTrigger, ModelBrowserDrawer, ParameterPanel. | Remove: `selectedModels` state, `ModelTrigger` import/render, `ModelBrowserDrawer` import/render, `ParameterPanel` import/render, `paramValues` state, schema loading for parameter panel, multi-model logic. Add: `tier` state (default: "draft"), `maxQuality` boolean state. Fetch `modelSettings` on mount. `handleGenerate()` resolves model via `mode + tier → settings lookup`. For upscale: pass modelId + modelParams to `upscaleImage()`. |
| `components/workspace/workspace-header.tsx` | Right-side actions: `ThemeToggle` + kebab DropdownMenu | Add Settings icon button before ThemeToggle | Add `Settings` lucide icon import. Add `<Button variant="ghost" size="icon">` with gear icon. Add `useState` for settings dialog open state. Render `<SettingsDialog>` conditionally. |
| `components/canvas/canvas-detail-view.tsx` | Renders `CanvasModelSelector` in header via `modelSelectorSlot`. `handleVariationGenerate()` / `handleImg2imgGenerate()` use `state.selectedModelId ?? currentGeneration.modelId`. `handleUpscale()` hardcodes Real-ESRGAN. | Remove `CanvasModelSelector` from header slot (empty center). Each tool handler resolves model from settings + per-tool tier state. `handleUpscale()` uses tier-based model. | Remove: `CanvasModelSelector` import/render, `modelSelectorSlot` prop value. Add: `modelSettings` state (fetched on mount). Pass `tier` state + `modelSettings` to each popover or resolve model in handler. Change `handleVariationGenerate()`: resolve model from `img2img + tier`. Change `handleImg2imgGenerate()`: resolve model from `img2img + tier`. Change `handleUpscale()`: resolve model from `upscale + tier`, pass to `upscaleImage()`. |
| `components/canvas/canvas-model-selector.tsx` | Single-model dropdown for canvas header with ModelBrowserDrawer | No longer used — removed from canvas-detail-view render | File becomes unused. Can be deleted in Slice 5 (Cleanup). |
| `components/canvas/canvas-chat-panel.tsx` | `handleCanvasGenerate()` uses `event.model_id` from AI SSE event. No tier selection UI. | Add TierToggle above chat input. `handleCanvasGenerate()` overrides model_id with tier-resolved model from settings. | Add: `tier` state (default: "draft"), `maxQuality` boolean state. Render `TierToggle` + `MaxQualityToggle` above chat input. `handleCanvasGenerate()`: ignore `event.model_id`, resolve model from `img2img + chatTier` via settings. Pass resolved modelId + params to `generateImages()`. |
| `components/canvas/popovers/variation-popover.tsx` | No model selection. Calls `onGenerate()` with prompt/strength/count. | Add TierToggle + MaxQualityToggle inside popover. Pass tier to parent via extended `VariationParams`. | Add: `tier` state, `maxQuality` state. Render TierToggle + MaxQualityToggle above Generate button. Extend `VariationParams` with `tier: Tier`. Parent resolves model from settings. |
| `components/canvas/popovers/img2img-popover.tsx` | No model selection. Calls `onGenerate()` with references/prompt/variants. | Add TierToggle + MaxQualityToggle inside popover. Pass tier to parent via extended `Img2imgParams`. | Add: `tier` state, `maxQuality` state. Render TierToggle + MaxQualityToggle above Generate button. Extend `Img2imgParams` with `tier: Tier`. Parent resolves model from settings. |
| `components/canvas/popovers/upscale-popover.tsx` | No model selection. Calls `onUpscale()` with `{ scale }`. | Add TierToggle inside popover (no MaxQualityToggle — upscale has no max tier). Pass tier to parent via extended params. | Add: `tier` state. Render TierToggle above scale buttons. Extend `onUpscale` params with `tier: Tier`. Parent resolves model from settings. |
| `lib/canvas-detail-context.tsx` | State has `selectedModelId: string \| null`. Reducer handles `SET_SELECTED_MODEL`. | Remove `selectedModelId` from state. Remove `SET_SELECTED_MODEL` action. | Delete `selectedModelId` field. Delete `SET_SELECTED_MODEL` case. Consumers that read `state.selectedModelId` get model from settings instead. |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Single-user app (no multi-tenant) | model_settings table has no user_id column | Global settings, no RLS needed |
| Replicate concurrency limit (1 concurrent) | Only 1 Replicate API call at a time | Existing queue in `replicate.ts` unchanged |
| Model compatibility varies per mode | Not all models support img2img (need image input field) | Schema-check via `ModelSchemaService.getImg2ImgFieldName()` before allowing assignment |
| Upscale has no Max tier | Only 2 models (Draft + Quality) for upscale mode | Reject `(upscale, max)` combination in validation |
| Preset params not user-editable | Parameters come from `model_settings.model_params` | No ParameterPanel, params stored in DB |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| AI Model Execution | Replicate | REST API via `replicate` npm package | 1.4.0 (in project package.json) | `replicateRun()` unchanged |
| Model Discovery | Replicate Collections API | `GET /v1/collections/text-to-image` | v1 (REST) | Used in Settings dialog model dropdowns |
| Model Schema | Replicate Models API | `GET /v1/models/{owner}/{name}` | v1 (REST) | Used for compatibility check |
| Image Storage | Cloudflare R2 | AWS S3 SDK (`@aws-sdk/client-s3` 3.1003.0) | S3-compatible | Unchanged |
| Image Processing | Sharp | Node.js library | 0.34.5 (in project package.json) | Unchanged |
| ORM | Drizzle | TypeScript ORM | 0.45.1 (in project package.json) | New table definition + queries |
| UI Framework | Next.js | App Router, Server Actions | 16.1.6 (in project package.json) | New server actions for settings |
| UI Components | Radix UI / Shadcn | React component primitives | Radix 1.4.3, Shadcn CLI 3.8.5 | Dialog, Select, Toggle for Settings |
| Styling | Tailwind CSS | Utility-first CSS | 4.x (in project package.json) | Existing patterns reused |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| UX Simplicity | 2 clicks to generate (select tier + Generate) | Remove ModelBrowserDrawer, ParameterPanel, Multi-Model. Single TierToggle. | Manual test: count clicks from app open to generation |
| Settings Responsiveness | Model change saved < 200ms | Server action with direct DB upsert (no batch) | Manual test: change model, close dialog, reopen — should show new model |
| Generation Latency | Same as current (no regression) | Model resolution happens client-side (no extra server call before generate) | Compare generation start times before/after |
| Compatibility Safety | No incompatible model assignable | Schema check before DB write in `updateModelSetting()` | Test: assign non-img2img model to img2img mode → rejected |
| Settings Persistence | Survive app restart | PostgreSQL table (not localStorage) | Test: change model, restart app, verify setting persists |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| N/A | — | — | Single-user app, no monitoring infrastructure | — |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Replicate Collection API always returns current Flux models | Collection is curated by Replicate, checked via `GET /v1/collections/text-to-image` | If model removed: Settings dropdown shows stale modelId. Generation fails with Replicate error. User must reassign in Settings. |
| Schema-based compatibility check is reliable | `ModelSchemaService.getImg2ImgFieldName()` checks 5 known field patterns | If new model uses unknown field name: falsely marked incompatible. User cannot assign it. Fix: add field pattern to service. |
| Default models remain available on Replicate | Flux Schnell, Flux 2 Pro, Flux 2 Max, Real-ESRGAN, Crystal-Upscaler | If deprecated: Generation fails. User must change in Settings. |
| `model_params` preset covers all required fields | Each model has sensible defaults when params are `{}` or minimal | If model requires mandatory param not in preset: Replicate returns validation error. Fix: update seed data. |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Model removed from Replicate | Low | Medium | No proactive check (reactive: generation fails) | User changes model in Settings. Error message guides to Settings. |
| Collection API returns 500+ models | Low | Low | Already handled: 1h cache, existing CollectionModelService | Pagination if needed (not now) |
| Schema check false negative (incompatible model passes) | Low | Medium | 5 known img2img field patterns cover all current models | Generation fails, user sees error, changes model |
| DB migration fails on existing data | Very Low | High | New table, no ALTER on existing tables. Seed uses ON CONFLICT DO NOTHING. | Manual seed via SQL if migration breaks |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Database | PostgreSQL + Drizzle ORM | Existing stack. New table follows existing patterns. |
| Server Logic | Next.js Server Actions | Existing pattern for all mutations in this app. |
| UI Components | Shadcn Dialog + Select + Toggle | Existing component library. Settings Dialog uses Dialog. Model dropdowns use Select (Combobox). TierToggle uses custom segmented control (like ModeSelector). |
| State Management | React `useState` (local) | Tier state is per-context (Workspace, each Canvas tool, Chat). No global state needed. Model settings fetched once and cached in component state. |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Client-side model resolution (UI looks up settings, passes modelId to server action) | No server action interface changes for generateImages. Settings fetched once, cached. | Client must have settings data before generating. | Fetch settings on mount. If not loaded, disable Generate button. |
| Preset params in DB (not UI-editable) | Maximum UX simplicity. No ParameterPanel complexity. | Power users cannot tweak params. | Future: per-model param editor in Settings (out of scope). |
| Per-tool tier state (not shared) | User can be on Quality for variation but Draft for upscale simultaneously. More control. | Slightly more state to manage. Each popover tracks own tier. | All defaults to "draft". Simple `useState` per component. |
| Keep `generateImages` interface unchanged | No breaking change to server action contract. Tests don't break. | `modelIds` array always has 1 item (array is misleading). | Multi-model code path still works but is dead code. Clean up in Slice 5. |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Should `modelParams` in `model_settings` be editable via Settings UI? | A) Yes — add param editor B) No — preset only | B) No — preset only | Preset only (Discovery decision) |
| 2 | How to handle canvas-chat `event.model_id` from AI? | A) Override with tier-resolved model B) Remove model_id from SSE event schema | A) Override | Override in `handleCanvasGenerate()` — less backend change |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-14 | Codebase | `GenerationService.generate()` accepts `modelIds[]` (1-3), creates separate generation per model for multi-model. Single model uses full params. |
| 2026-03-14 | Codebase | `GenerationService.upscale()` hardcodes `UPSCALE_MODEL` from `lib/models.ts`. Only passes `image + scale`. Signature: `upscale(projectId, sourceImageUrl, scale, sourceGenerationId?)`. |
| 2026-03-14 | Codebase | `ModelSchemaService.getImg2ImgFieldName()` detects 5 field patterns: `input_images`, `image_input`, `image_prompt`, `init_image`, `image` (without mask). Returns `{ field, isArray }` or undefined. |
| 2026-03-14 | Codebase | `CollectionModelService.getCollectionModels()` fetches from `text-to-image` collection. 1h cache. Returns `CollectionModel[]` with owner, name, description, cover_image_url, run_count. |
| 2026-03-14 | Codebase | Workspace header has right-side actions: `<ThemeToggle />` + kebab dropdown. Settings button goes between ThemeToggle and kebab. |
| 2026-03-14 | Codebase | `CanvasDetailContext` has `selectedModelId` state + `SET_SELECTED_MODEL` action. Used by `CanvasModelSelector` and tool handlers. Will be removed. |
| 2026-03-14 | Codebase | Canvas tool handlers resolve model via `state.selectedModelId ?? currentGeneration.modelId`. New pattern: resolve from settings via `mode + tier`. |
| 2026-03-14 | Codebase | `canvas-chat-panel.tsx` `handleCanvasGenerate()` receives `SSECanvasGenerateEvent` with `model_id`, `prompt`, `params`, `action`. Currently uses `event.model_id` directly. Will be overridden by tier-resolved model. |
| 2026-03-14 | Codebase | Drizzle migrations in `drizzle/` folder. Latest: `0006_add_batch_id.sql`. New migration generated via `drizzle-kit generate` (auto-naming). |
| 2026-03-14 | Codebase | `prompt-area.tsx` is ~1615 lines. Major state: `selectedModels[]`, `paramValues`, schema cache, mode states. TierToggle replaces model selection + parameter panel (significant line reduction). |
| 2026-03-14 | Codebase | `mode-selector.tsx` (84 lines) — segmented control with `bg-primary text-primary-foreground` active styling. TierToggle can reuse same pattern with 2 segments. |
| 2026-03-14 | Codebase | `UpscalePopover` currently takes `onUpscale({ scale: 2 | 4 })`. Needs `tier` added. `VariationPopover` takes `onGenerate({ prompt, strength, count })`. Needs `tier` added. |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Architecture-Tiefe: Kurz, Standard oder Detailliert? | Standard — codebase-guided, no over-engineering |
| 2 | Should we change `generateImages` interface to accept tier instead of modelIds? | No — keep interface stable. Client resolves model from settings, passes as `modelIds: [resolvedId]`. Less blast radius. |
