# Codebase Scan

**Feature:** Model Catalog
**Scan-Datum:** 2026-03-18
**Discovery:** `specs/phase-7/2026-03-15-model-catalog/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Drizzle Schema Definition | `lib/db/schema.ts` | 10 tables | REUSE |
| 2 | Drizzle Migration (SQL + journal) | `drizzle/0000_*.sql` - `drizzle/0010_*.sql`, `drizzle/meta/_journal.json` | 11 migrations | REUSE |
| 3 | Service Object Pattern (singleton export) | `lib/services/collection-model-service.ts`, `lib/services/model-schema-service.ts`, `lib/services/model-settings-service.ts`, `lib/services/generation-service.ts` | 6 services | REUSE |
| 4 | Server Action Pattern (`"use server"` + requireAuth + error union) | `app/actions/models.ts`, `app/actions/model-settings.ts`, `app/actions/generations.ts`, `app/actions/projects.ts`, `app/actions/prompts.ts`, `app/actions/references.ts`, `app/actions/upload.ts` | 7 action files | REUSE |
| 5 | In-Memory Cache (Map-based, service-level) | `lib/services/collection-model-service.ts:14`, `lib/services/model-schema-service.ts:3` | 2 services | AVOID |
| 6 | Toast Notifications (sonner) | `components/shared/toast-provider.tsx`, used across 12+ components | 12+ usages | REUSE |
| 7 | Dialog/Modal (Radix Dialog via shadcn) | `components/ui/dialog.tsx`, `components/settings/settings-dialog.tsx` | 2 dialogs | REUSE |
| 8 | Select/Dropdown (Radix Select via shadcn) | `components/ui/select.tsx`, `components/settings/model-mode-section.tsx`, `components/workspace/parameter-panel.tsx` | 3+ usages | REUSE |
| 9 | DB Query Functions (standalone exports in queries.ts) | `lib/db/queries.ts` | 20+ functions | REUSE |
| 10 | Custom React Hooks (data fetching) | `lib/hooks/use-model-schema.ts`, `lib/hooks/use-model-filters.ts` | 2 hooks | REUSE |
| 11 | Replicate API Client (concurrency + retry) | `lib/clients/replicate.ts` | 1 client | EXTEND |
| 12 | Type Definitions (GenerationMode, Tier) | `lib/types.ts`, `lib/types/collection-model.ts` | 2 type files | EXTEND |
| 13 | Event-Based Component Communication | `components/settings/settings-dialog.tsx:126` (`window.dispatchEvent`) | 1 emitter, 1 listener | REUSE |
| 14 | Capability Detection (img2img field detection) | `lib/services/model-schema-service.ts:20-46` | 1 function | EXTEND |
| 15 | Parameter Panel (schema-driven UI) | `components/workspace/parameter-panel.tsx` | 1 component | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| Drizzle pgTable schema definition | `lib/db/schema.ts` | All DB-interacting code (queries.ts, services) | REUSE | All 10 tables follow the same pattern: uuid PK, timestamps, indexes as 3rd arg. New `models` table follows same convention. |
| Drizzle migration SQL + journal | `drizzle/` + `drizzle/meta/_journal.json` | CI/CD pipeline | REUSE | Next migration is idx 11, file `0011_*.sql`. Journal auto-maintained by `drizzle-kit generate`. |
| Service Object Pattern | `lib/services/*.ts` | Server actions, other services | REUSE | All services export a const object with async methods. No class inheritance. Consistent naming: `{Domain}Service`. |
| Server Action Pattern | `app/actions/*.ts` | Client components via direct import | REUSE | Every action: `"use server"` + `requireAuth()` guard + discriminated union return (`T | { error: string }`). |
| `requireAuth()` guard | `lib/auth/guard.ts` | All 7 server action files | REUSE | Returns `AuthSuccess | AuthError` discriminated union. First line of every server action. |
| Toast via sonner | `components/shared/toast-provider.tsx` (Toaster), `sonner` (toast API) | 12+ components | REUSE | `toast.error()`, `toast.success()` used throughout. Toaster configured with `richColors duration={5000}`. No `toast.loading()` or `toast.promise()` used yet -- these exist in sonner for progress toasts. |
| Replicate concurrency limiter | `lib/clients/replicate.ts:30-53` | `replicateRun()` | EXTEND | Queue-based slot system with configurable `maxConcurrent`. Currently set to 1. Could be reused/extended for sync concurrency. |
| `CollectionModelService` | `lib/services/collection-model-service.ts` | `app/actions/models.ts`, `components/settings/settings-dialog.tsx` | AVOID | In-memory cache, single collection only (`text-to-image`). Will be replaced by DB-backed service. |
| `ModelSchemaService` | `lib/services/model-schema-service.ts` | `app/actions/models.ts`, `lib/services/generation-service.ts`, `lib/services/model-settings-service.ts` | AVOID | In-memory schema cache, live API fetches. Will be replaced by DB reads. Core logic (`getImg2ImgFieldName`, `getMaxImageCount`, `$ref` resolution) should be extracted/preserved. |
| `ModelSettingsService` | `lib/services/model-settings-service.ts` | `app/actions/model-settings.ts` | EXTEND | Seeds defaults, upserts. `checkCompatibility()` currently only checks img2img. Needs extension for 5 capabilities. |
| `useModelSchema` hook | `lib/hooks/use-model-schema.ts` | Workspace prompt area | EXTEND | Fetches schema via server action. Data source will change from live API to DB, but hook interface remains stable. |
| `CollectionModel` type | `lib/types/collection-model.ts` | `model-browser-drawer.tsx`, `model-trigger.tsx`, `model-mode-section.tsx`, `settings-dialog.tsx` | AVOID | Minimal type (7 fields). Will be superseded by richer `Model` type from new `models` table with capabilities + schema. |
| `GenerationMode` / `Tier` types | `lib/types.ts` | `settings-dialog.tsx`, `model-mode-section.tsx`, server actions | EXTEND | Currently: `"txt2img" | "img2img" | "upscale"`. Needs extension to include `"inpaint" | "outpaint"` for dropdown sections. |
| `SettingsDialog` component | `components/settings/settings-dialog.tsx` | Workspace header | EXTEND | Currently renders 3 mode sections (txt2img, img2img, upscale). Needs: Sync button, 5 sections, capability-filtered dropdowns. |
| `ModelModeSection` component | `components/settings/model-mode-section.tsx` | `SettingsDialog` | EXTEND | Currently: mode label + tier dropdowns + compatibility map. Needs: capability-based filtering from DB instead of live API compatibility check. |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | Drizzle `pgTable` schema pattern (uuid PK, timestamps, indexes) | `lib/db/schema.ts` | All 10 tables use identical pattern. New `models` table fits perfectly. |
| 2 | DB query function pattern (standalone async exports) | `lib/db/queries.ts` | 20+ functions follow same pattern. New model queries (getActiveModels, getModelsByCapability, upsertModel, etc.) follow same convention. |
| 3 | Service Object Pattern (const export with async methods) | `lib/services/*.ts` (6 services) | New `ModelCatalogService` or `ModelSyncService` follows same `const XService = { ... }; export` pattern. |
| 4 | Server Action pattern (`"use server"` + `requireAuth` + union return) | `app/actions/*.ts` (7 files) | New sync action, model query actions follow identical auth + error handling pattern. |
| 5 | sonner toast for notifications | `components/shared/toast-provider.tsx`, `sonner` package | sonner supports `toast.loading()`, `toast.success()`, `toast.error()` with auto-dismiss control. Progress toast can use `toast.loading()` with update via `toast.dismiss()` + `toast.success()`. |
| 6 | Radix Dialog (shadcn) for Settings Modal | `components/ui/dialog.tsx` | Existing SettingsDialog already uses this. Sync button added inside same Dialog. |
| 7 | Radix Select (shadcn) for Model Dropdowns | `components/ui/select.tsx` | Existing model-mode-section already uses SelectTrigger/SelectContent/SelectItem. |
| 8 | `window.dispatchEvent` for cross-component communication | `components/settings/settings-dialog.tsx:126` | After sync completion, dispatch event to refresh dropdowns in other open views. |
| 9 | Parameter Panel (schema-driven rendering) | `components/workspace/parameter-panel.tsx` | Data source changes from live API to DB, but component interface (`schema`, `isLoading`, `values`, `onChange`) remains identical. |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `GenerationMode` type | `lib/types.ts:19` | Add `"inpaint" | "outpaint"` to union type. Update `VALID_GENERATION_MODES` array. Add TIERS_BY_MODE entries. |
| 2 | `SettingsDialog` component | `components/settings/settings-dialog.tsx` | Add Sync button below header. Change MODES array from 3 to 5. Replace `loadCollectionModels()` with DB query. Remove live compatibility map building. |
| 3 | `ModelModeSection` component | `components/settings/model-mode-section.tsx` | Add MODE_LABELS for inpaint/outpaint. Add TIERS_BY_MODE entries. Change model filtering from compatibilityMap to capability field from DB. |
| 4 | `ModelSettingsService.checkCompatibility()` | `lib/services/model-settings-service.ts:70-82` | Currently only checks img2img via live API. Needs to check all 5 capabilities from DB `capabilities` JSONB column. |
| 5 | Capability detection logic | `lib/services/model-schema-service.ts:20-46` | `getImg2ImgFieldName()` detects img2img. Needs expansion to detect all 5 capabilities (txt2img, img2img, inpaint, outpaint, upscale) from schema properties + description. |
| 6 | `useModelSchema` hook | `lib/hooks/use-model-schema.ts` | Data source changes from live API (via `getModelSchema` server action) to DB read. Hook interface stays the same, but server action implementation changes. |
| 7 | `seedModelSettingsDefaults()` | `lib/db/queries.ts:512-530` | Add default entries for inpaint and outpaint modes. Currently seeds 8 rows, needs to add inpaint/quality and outpaint/quality. |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | `models` table (Drizzle schema + migration) | No existing model catalog table. `model_settings` stores assignments, not model metadata/schemas. Completely new domain entity. |
| 2 | `ModelSyncService` (bulk sync from Replicate Collections API) | No existing bulk sync pattern. `CollectionModelService` only fetches 1 collection with no persistence. New service needs: 3-collection fetch, parallel schema fetch with concurrency limit, capability detection, delta-sync, soft-delete. |
| 3 | Capability Detection Engine (schema -> 5 booleans) | `getImg2ImgFieldName()` only detects img2img. Full capability detection (txt2img, img2img, inpaint, outpaint, upscale) from schema + description is new logic. |
| 4 | Sync Progress Toast (with counter updates) | No progress toast pattern exists. Existing toasts are simple `toast.error()`/`toast.success()`. Progress toast with live counter ("Syncing... 45/120") requires `toast.loading()` + periodic update -- new pattern for this codebase. |
| 5 | Sync Button Component (with state badge) | No existing button with persistent warning badge pattern. Sync button with idle/syncing/partial states and persistent badge is new UI element. |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| 1 | In-memory Map cache for API responses | No .decisions.md found, but `CollectionModelService` and `ModelSchemaService` both use `new Map()` caches that are lost on restart -- this is the exact problem the feature solves | Use persistent DB storage (`models` table) instead of in-memory cache. |
| 2 | `CollectionModel` type | Minimal type without capabilities, schema, or version tracking | Define new `Model` type inferred from Drizzle `models` table schema (`typeof models.$inferSelect`). |
| 3 | Single-collection fetch pattern | `CollectionModelService` hardcodes `text-to-image` collection URL | New sync service fetches 3 collections, deduplicates by `replicate_id`. |

---

## Decision Log Context

> No `.decisions.md` found at project root.

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| Path alias `@/*` (root-relative imports) | `tsconfig.json:22`, all services and components | 100+ files |
| Service naming: `{Domain}Service` const export | `CollectionModelService`, `ModelSchemaService`, `ModelSettingsService`, `GenerationService`, `StorageService`, `ReplicateClient` | 6 services |
| Server action file naming: `app/actions/{domain}.ts` | `models.ts`, `model-settings.ts`, `generations.ts`, `projects.ts`, `prompts.ts`, `references.ts`, `upload.ts` | 7 files |
| Query function naming: `{verb}{Entity}` (e.g. `getModelSettingByModeTier`, `upsertModelSetting`) | `lib/db/queries.ts` | 20+ functions |
| Error return pattern: `T | { error: string }` (discriminated union, no exceptions to caller) | All server actions, all services | 15+ functions |
| Schema table naming: snake_case for DB, camelCase for TS | `lib/db/schema.ts` (e.g. `model_id` -> `modelId`) | 10 tables |
| Migration naming: `{NNNN}_{description}.sql` (sequential, underscore-separated) | `drizzle/0000_*.sql` to `drizzle/0010_*.sql` | 11 files |
| Component file naming: kebab-case | `model-mode-section.tsx`, `settings-dialog.tsx`, `parameter-panel.tsx` | All component files |
| Test file co-location in `__tests__/` subdirectory | `lib/services/__tests__/`, `components/settings/__tests__/`, `lib/hooks/` | Consistent across all modules |
| Toast library: `sonner` (`toast.error()`, `toast.success()`) | `components/shared/toast-provider.tsx`, 12+ component usages | 12+ files |
| UI component library: shadcn (Radix UI wrappers in `components/ui/`) | `components/ui/dialog.tsx`, `components/ui/select.tsx`, `components/ui/button.tsx`, etc. | 20+ UI components |
| German error messages in services, English in types/interfaces | `lib/services/generation-service.ts`, `lib/clients/replicate.ts` | Consistent pattern |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| `generation-service.ts` reads schema via `ModelSchemaService.getSchema()` | `lib/services/generation-service.ts:282` | Must switch to DB read. `buildReplicateInput()` calls `ModelSchemaService.getSchema()` for img2img field detection. |
| `model-settings-service.ts` checks compatibility via `ModelSchemaService.supportsImg2Img()` | `lib/services/model-settings-service.ts:77` | Must switch to DB capability check. |
| `settings-dialog.tsx` loads models via `getCollectionModels()` server action | `components/settings/settings-dialog.tsx:64-88` | Must switch to DB query for models with capabilities. |
| `settings-dialog.tsx` builds compatibility map via `checkImg2ImgSupport()` | `components/settings/settings-dialog.tsx:72-88` | Replaced by capability field in DB. No more N live API calls on dialog open. |
| `use-model-schema.ts` fetches schema via `getModelSchema()` server action | `lib/hooks/use-model-schema.ts:47` | Server action implementation changes to DB read with on-the-fly fallback. |
| `prompt-area.tsx` uses `useModelSchema` hook for parameter panel | `components/workspace/prompt-area.tsx` | Transparent change -- hook interface unchanged, only data source. |

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 15 |
| REUSE recommendations | 9 |
| EXTEND recommendations | 7 |
| NEW recommendations | 5 |
| AVOID recommendations | 3 |
| Decision Log entries | 0 |
