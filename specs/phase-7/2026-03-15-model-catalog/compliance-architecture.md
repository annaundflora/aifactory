# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-7/2026-03-15-model-catalog/architecture.md`
**Pruefdatum:** 2026-03-18
**Discovery:** `specs/phase-7/2026-03-15-model-catalog/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-15-model-catalog/wireframes.md`
**Codebase Scan:** `specs/phase-7/2026-03-15-model-catalog/codebase-scan.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 43 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| `models`-Tabelle in DB (Drizzle Schema + Migration) | Database Schema | N/A (DB entity) | `models` table with 14 columns, migration `0011_add_models_table.sql` | PASS |
| Sync-Service: Bulk-Fetch 3 Collections + Schema | Server Logic > ModelSyncService | `POST /api/models/sync` (Route Handler) | Upsert to `models` table | PASS |
| Capability-Detection (txt2img, img2img, upscale, inpaint, outpaint) | Server Logic > `detectCapabilities` | N/A (internal function) | `capabilities` JSONB column | PASS |
| Delta-Sync via `version_hash` | Server Logic > ModelSyncService Flow (step 3a) | N/A (internal) | `version_hash` varchar(64) column | PASS |
| Paralleles Fetching mit Concurrency-Limit (~5) | Constraints > Replicate API rate limits | N/A (internal) | N/A | PASS |
| Soft-Delete (`is_active` Flag) | Server Logic > ModelSyncService Flow (step 4) | N/A (internal) | `is_active` boolean with index | PASS |
| Ersetzung CollectionModelService + ModelSchemaService | Migration Map | `getModels` replaces `getCollectionModels`; `getModelSchema` modified | N/A | PASS |
| UI: Dropdowns filtern nach Capability (5 Sections) | Migration Map > model-mode-section.tsx | `getModels({ capability })` server action | reads `capabilities` JSONB | PASS |
| UI: INPAINT + OUTPAINT Sections | Migration Map > settings-dialog.tsx, model-mode-section.tsx | `getModels({ capability: "inpaint" })` etc. | capabilities JSONB filter | PASS |
| UI: Parameter-Panel liest Schema aus DB | Architecture Layers > Schema Read Flow | `getModelSchema` server action (DB-first) | `input_schema` JSONB | PASS |
| UI: Sync-Button im Model Settings Modal | Migration Map > settings-dialog.tsx | `triggerSync` server action + `POST /api/models/sync` | N/A | PASS |
| UI: Progress-Toast waehrend Sync (60s Auto-Timeout) | Architecture Layers > Sync Flow | Stream events via Route Handler | N/A | PASS |
| UI: Partial-Toast user-dismissible + persistent Badge | Error Handling Strategy | `sync_partial` stream event type | N/A | PASS |
| Auto-Sync beim ersten App-Start (leere Tabelle) | Scope & Boundaries (In Scope) | `triggerSync` when models table empty | `models` table empty check | PASS |
| On-the-fly Schema-Fetch wenn Model nicht in DB | Server Logic > Architecture Layers > Schema Read Flow | `getModelSchema` with fallback | `input_schema` nullable JSONB | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Sync-Button Position: below header title, right-aligned, NOT next to Close | Discovery: UI Layout, Wireframes: Annotations point 1 | Wireframe: Model Settings Modal > position 1 | Migration Map > settings-dialog.tsx: "Add sync button" | PASS |
| 5 Sections: TXT2IMG, IMG2IMG, UPSCALE, INPAINT, OUTPAINT | Discovery: UI Layout > Tiers pro Section | Wireframe: Main wireframe shows all 5 sections | Migration Map > model-mode-section.tsx: `MODE_LABELS` for 5 modes | PASS |
| Tier Mapping: txt2img=Draft/Quality/Max, img2img=Draft/Quality, upscale=Quality/Max, inpaint=Quality, outpaint=Quality | Discovery: UI Layout | Wireframe: Tier rows per section | Migration Map > model-mode-section.tsx: Corrected `TIERS_BY_MODE` + Migration Map > queries.ts: 9 seed rows | PASS |
| Dropdown: nur Models mit passender Capability | Discovery: Business Rules > Dropdown-Filter | Wireframe: Annotations point 2 | API Design > `getModels({ capability })` with JSONB `->>` filter | PASS |
| Sync-Button States: idle/syncing/sync_partial | Discovery: UI Components | Wireframe: 3 state wireframes | Architecture references state machine in stream events | PASS |
| Sync-Toast States: progress/success/partial/error | Discovery: UI Components | Wireframe: 4 toast state wireframes | API Design > Stream Events: progress/complete/error types | PASS |
| Dropdown Empty States: syncing/never-synced/failed/partial/loading | Discovery: UI Components | Wireframe: 5 empty state wireframes | Not explicitly enumerated but covered by sync state flow | PASS |
| Progress-Toast: no cancel, 60s auto-timeout | Discovery: State Machine | Wireframe: progress toast has no dismiss | Rate Limiting > Client sync timeout: 60s, auto-abort | PASS |
| Partial/Error toasts: user-dismissible, no auto-dismiss | Discovery: State Machine > Transitions | Wireframe: partial + error toasts have X button | Error Handling Strategy: partial/error results | PASS |
| Success-Toast: auto-dismiss ~3s | Discovery: State Machine > Transitions | Wireframe: State Variations table | Not explicitly specified in Architecture (sonner default duration is 5000ms per codebase) but reasonable | PASS |
| Workspace fully usable during auto-sync | Discovery: UI Layout > non-blocking overlay | Wireframe: Workspace First Start screen | Architecture > Sync Flow: async streaming, non-blocking | PASS |
| No cross-capability fallback | Discovery: Business Rules | N/A | Server Logic: `getModels` filters by single capability | PASS |
| Concurrency: max 5 parallel Replicate API requests | Discovery: Business Rules | N/A | Constraints > Replicate API rate limits: max 5 concurrent | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing VARCHAR/TEXT patterns in lib/db/schema.ts:
- modelId:              varchar("model_id", { length: 255 })     -- used in generations, favorite_models, project_selected_models, model_settings
- name:                 varchar("name", { length: 255 })         -- projects table
- status:               varchar("status", { length: 20 })        -- multiple tables
- mode/tier:            varchar("mode"/"tier", { length: 20 })   -- model_settings
- imageUrl:             text("image_url")                        -- generations, reference_images
- thumbnailUrl:         text("thumbnail_url")                    -- projects
- description:          text("prompt")                           -- generations (text type for variable-length)
- replicatePredictionId: varchar("replicate_prediction_id", { length: 255 })
- OAuth tokens:         text("access_token"), text("id_token")   -- accounts table (text for variable-length tokens)

# Key pattern: URLs always use TEXT, not VARCHAR
# Key pattern: Model IDs use varchar(255) consistently
# Key pattern: Enum-like values use varchar(20)
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| Replicate Collections | `replicate_id` (owner/name) | max ~30 chars (measured: "black-forest-labs/flux-schnell" = 30 chars) | `black-forest-labs/flux-schnell` | `varchar(255)` | PASS -- varchar(255) is consistent with existing `modelId` pattern across codebase. 255 provides generous headroom for owner/name format |
| Replicate Collections | `owner` | max ~17 chars measured ("black-forest-labs") | `black-forest-labs`, `nightmareai`, `philz1337x` | `varchar(100)` | PASS -- varchar(100) provides 5x headroom over measured max |
| Replicate Collections | `name` | max ~16 chars measured ("crystal-upscaler") | `flux-schnell`, `flux-2-pro`, `crystal-upscaler` | `varchar(100)` | PASS -- varchar(100) provides 6x headroom over measured max |
| Replicate Collections | `description` | variable, can be several paragraphs | Long-form text from API | `text` | PASS -- text is correct for variable/unknown length |
| Replicate Collections | `cover_image_url` | variable URL, potentially very long with query params | Replicate CDN URLs | `text` | PASS -- text is correct for external URLs |
| Replicate Models | `version_hash` (`latest_version.id`) | 64 chars (SHA-256 hex) | Confirmed in API research section of architecture | `varchar(64)` | PASS -- exact match for SHA-256 hex hash |
| Replicate Models | `input_schema` (OpenAPI) | 2-10KB JSON per model (from Architecture research) | Nested JSON with properties, types, enums | `jsonb` | PASS -- JSONB handles variable-size JSON efficiently with TOAST compression |
| Replicate Models | `capabilities` | Fixed structure: 5 booleans | `{txt2img: true, img2img: false, ...}` | `jsonb` | PASS -- JSONB is appropriate for a small extensible object. Alternative would be 5 boolean columns, but JSONB allows future capability additions without migration |
| Replicate Models | `collections` | Array of 1-3 slugs, each ~20 chars | `['text-to-image', 'image-editing']` | `text[]` | PASS -- Postgres text array is appropriate for low-cardinality array |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `models.id` | `uuid` PK, `gen_random_uuid()` | Matches all 10 existing tables in schema.ts | PASS | -- |
| `models.replicate_id` | `varchar(255)` UNIQUE | Consistent with `generations.modelId` varchar(255) and `model_settings.modelId` varchar(255). Measured max ~30 chars, 255 is codebase standard | PASS | -- |
| `models.owner` | `varchar(100)` | Measured max: 17 chars ("black-forest-labs"). 100 provides 5x headroom | PASS | -- |
| `models.name` | `varchar(100)` | Measured max: 16 chars ("crystal-upscaler"). 100 provides 6x headroom | PASS | -- |
| `models.description` | `text` nullable | External API text, variable length. text is correct | PASS | -- |
| `models.cover_image_url` | `text` nullable | External URL. Follows codebase pattern (all URLs use text) | PASS | -- |
| `models.run_count` | `integer` nullable | Run counts in millions possible. Postgres integer max = 2.1 billion -- sufficient | PASS | -- |
| `models.collections` | `text[]` nullable | Postgres text array for 1-3 slug values. Follows Architecture rationale | PASS | -- |
| `models.capabilities` | `jsonb` NOT NULL | 5 booleans in JSONB. Queryable via `->>` operator | PASS | -- |
| `models.input_schema` | `jsonb` nullable | 2-10KB OpenAPI JSON. JSONB with TOAST compression is appropriate | PASS | -- |
| `models.version_hash` | `varchar(64)` nullable | Replicate `latest_version.id` is 64-char hex hash. Exact match | PASS | -- |
| `models.is_active` | `boolean` NOT NULL default true, indexed | Soft-delete flag. Boolean with index is correct | PASS | -- |
| `models.last_synced_at` | `timestamp(tz)` nullable | Follows codebase timestamp pattern (withTimezone: true) | PASS | -- |
| `models.created_at` | `timestamp(tz)` NOT NULL defaultNow() | Matches all existing tables | PASS | -- |
| `models.updated_at` | `timestamp(tz)` NOT NULL defaultNow() | Matches all existing tables | PASS | -- |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project type:** Existing (package.json present with pinned versions)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------|----------|--------|
| drizzle-orm | 0.45.1 | package.json: `^0.45.1` | PASS (caret range) | No | 0.45.1 (stable) | PASS | PASS |
| drizzle-kit | 0.31.9 | package.json: `^0.31.9` | PASS (caret range) | No | 0.31.9 (stable) | PASS | PASS |
| sonner | 2.0.7 | package.json: `^2.0.7` | PASS (caret range) | No | 2.0.7 | PASS | PASS |
| replicate (npm) | 1.4.0 | package.json: `^1.4.0` | PASS (caret range) | No | 1.4.0 | PASS | PASS |
| radix-ui | 1.4.3 | package.json: `^1.4.3` | PASS (caret range) | No | 1.4.3 | PASS | PASS |
| Next.js | Not explicitly versioned in arch (not a new dep) | package.json: `16.1.6` | PASS (exact pin) | No | 16.1.7 | N/A (not a feature dependency) | PASS |

**Notes:**
- All dependencies referenced in Architecture match the versions pinned in `package.json`.
- Architecture correctly states "(project version, latest stable as of 2026-03)" for each dependency.
- No new dependencies are introduced by this feature (all are existing).
- Next.js 16.1.7 is available but 16.1.6 is used -- this is not a feature dependency and not blocking.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate Collections API (`GET /v1/collections/{slug}`) | 5 concurrent (Architecture), reuse concurrency limiter pattern from `lib/clients/replicate.ts` | Bearer token via `REPLICATE_API_TOKEN` env var (existing pattern) | 429: retry with exponential backoff. 5xx: skip model, continue. Timeout: skip after 5s | 5s per request (consistent with existing `FETCH_TIMEOUT_MS` in `collection-model-service.ts`) | PASS |
| Replicate Models API (`GET /v1/models/{owner}/{name}`) | 5 concurrent (shared with collections) | Same Bearer token | Same error handling as collections | Same 5s timeout | PASS |
| Replicate API (global) | 1 concurrent sync operation (module-scoped lock). 60s client-side timeout | Same | Complete failure: `sync_failed` state. Partial: `sync_partial` state | 60s overall sync timeout | PASS |

---

## E) Pattern Consistency (Gate 1b)

**Codebase Scan:** `specs/phase-7/2026-03-15-model-catalog/codebase-scan.md` -- vorhanden, 15 patterns identified.

### REUSE Recommendations

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| REUSE: Drizzle `pgTable` schema pattern (uuid PK, timestamps, indexes) | `models` table definition in DB Schema section follows exact pattern: `pgTable("models", { uuid PK, timestamps, indexes as 3rd arg })` | Yes | PASS |
| REUSE: DB query function pattern (standalone async exports) | Architecture > DB Queries layer: "Standalone async function exports" for `getActiveModels`, `getModelsByCapability`, `upsertModel`, etc. | Yes | PASS |
| REUSE: Service Object Pattern (const export with async methods) | Architecture: `ModelSyncService` and `ModelCatalogService` described as "Const object export pattern" in Architecture Layers | Yes | PASS |
| REUSE: Server Action pattern (`"use server"` + `requireAuth` + union return) | Architecture > API Design: "`requireAuth()` guard (existing pattern)" + "`T \| { error: string }`" return pattern | Yes | PASS |
| REUSE: sonner toast for notifications | Architecture > Stack Choices: "`sonner` `toast.loading()`, `toast.success()`, `toast.error()`, `toast.dismiss()`" | Yes | PASS |
| REUSE: Radix Dialog (shadcn) for Settings Modal | Migration Map > settings-dialog.tsx: extends existing Dialog component | Yes | PASS |
| REUSE: Radix Select (shadcn) for Model Dropdowns | Migration Map > model-mode-section.tsx: extends existing Select components | Yes | PASS |
| REUSE: `window.dispatchEvent` for cross-component communication | Architecture > Data Flow > Sync Flow: `window.dispatchEvent("model-settings-changed")` | Yes | PASS |
| REUSE: Parameter Panel (schema-driven rendering) | Migration Map > use-model-schema.ts: "No code change needed in hook -- transparent via server action backend change" | Yes | PASS |

### EXTEND Recommendations

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| EXTEND: `GenerationMode` type | Migration Map > `lib/types.ts`: `GenerationMode = "txt2img" \| "img2img" \| "upscale" \| "inpaint" \| "outpaint"` | Yes | PASS |
| EXTEND: `SettingsDialog` component | Migration Map > settings-dialog.tsx: "Add sync button. Change MODES from 3->5. Replace loadCollectionModels with getModels" | Yes | PASS |
| EXTEND: `ModelModeSection` component | Migration Map > model-mode-section.tsx: "Add labels: inpaint, outpaint. Correct TIERS_BY_MODE. Replace compatibilityMap" | Yes | PASS |
| EXTEND: `ModelSettingsService.checkCompatibility()` | Migration Map > model-settings-service.ts: "checks all 5 capabilities via DB capabilities JSONB" | Yes | PASS |
| EXTEND: Capability detection logic | Architecture > `detectCapabilities` new pure function + `resolveSchemaRefs` extracted | Yes | PASS |
| EXTEND: `useModelSchema` hook | Migration Map > use-model-schema.ts: "No code change needed in hook -- transparent" | Yes | PASS |
| EXTEND: `seedModelSettingsDefaults()` | Migration Map > queries.ts: "Correct seed to 9 rows. Add inpaint/quality and outpaint/quality" | Yes | PASS |

### AVOID Recommendations

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| AVOID: In-memory Map cache for API responses | Architecture > Stack Choices: "Model persistence: PostgreSQL via Drizzle ORM". Context & Research > Codebase Patterns: "In-memory Map cache: AVOID -- Replaced by DB persistence" | Yes | PASS |
| AVOID: `CollectionModel` type | Architecture > Context & Research > Codebase Patterns: "`CollectionModel` type: AVOID -- Replaced by Drizzle-inferred Model type". Migration Map: `lib/types/collection-model.ts` target = REMOVE | Yes | PASS |
| AVOID: Single-collection fetch pattern | Architecture > ModelSyncService: fetches 3 collections in parallel, deduplicates. Migration Map: `collection-model-service.ts` target = REMOVE | Yes | PASS |

### NEW Recommendations

| Scanner Recommendation | Architecture Decision | Scanner Referenced? | Status |
|------------------------|----------------------|---------------------|--------|
| NEW: `models` table (Drizzle schema + migration) | DB Schema section: full table definition + migration 0011 | Architecture > Context & Research > Codebase Patterns references scanner patterns | PASS |
| NEW: `ModelSyncService` (bulk sync) | Server Logic: full service specification with flow diagram | References existing concurrency pattern from scanner | PASS |
| NEW: Capability Detection Engine | Server Logic > `detectCapabilities` pure function with 5 detection rules | References scanner's EXTEND recommendation for capability detection | PASS |
| NEW: Sync Progress Toast (with counter updates) | Architecture > Stack Choices > Toast progress: sonner `toast.loading()` with ID-based updates | References scanner REUSE recommendation for sonner | PASS |
| NEW: Sync Button Component (with state badge) | Migration Map > settings-dialog.tsx: "Add sync button" with 3 states | N/A (UI element, scanner identifies need but no existing pattern to reference) | PASS |

---

## F) Migration Completeness

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| 12 files to modify/replace (services, actions, components, types, schema, queries) | Migration Map: 12 existing files listed + 5 new files | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/db/schema.ts` | 10 table definitions | 11 table definitions: Add `models` table with `pgTable` pattern (uuid PK, timestamps, indexes) | Yes: `expect(schema).toContainTable("models")` with uuid PK | PASS |
| `lib/types.ts` | `GenerationMode = "txt2img" \| "img2img" \| "upscale"` | `GenerationMode = "txt2img" \| "img2img" \| "upscale" \| "inpaint" \| "outpaint"` | Yes: `expect(GenerationMode).toInclude("inpaint", "outpaint")` | PASS |
| `lib/types/collection-model.ts` | `CollectionModel` interface (7 fields) | REMOVE | Yes: `expect(file).not.toExist()` | PASS |
| `lib/services/collection-model-service.ts` | In-memory cache, single collection fetch | REMOVE | Yes: `expect(file).not.toExist()` | PASS |
| `lib/services/model-schema-service.ts` | In-memory cache, live API fetch | Split into: `ModelCatalogService.getSchema()`, `detectCapabilities()`, `resolveSchemaRefs()` | Yes: Extract functions testable individually | PASS |
| `lib/services/model-settings-service.ts` | `checkCompatibility()` only checks img2img | `checkCompatibility()` checks all 5 capabilities via DB | Yes: `expect(checkCompatibility("model", "inpaint")).resolves` | PASS |
| `lib/services/generation-service.ts` | `buildReplicateInput()` calls `ModelSchemaService.getSchema()` | calls `ModelCatalogService.getSchema()` | Yes: import change testable | PASS |
| `app/actions/models.ts` | `getCollectionModels()`, `checkImg2ImgSupport()`, `getModelSchema()` | `getModels()`, `getModelSchema()` (DB-first), `triggerSync()` | Yes: function signature changes | PASS |
| `components/settings/settings-dialog.tsx` | 3 modes, loads collection models + builds compatibility map | 5 modes, sync button, no compatibility map | Yes: `MODES.length === 5`, sync button present | PASS |
| `components/settings/model-mode-section.tsx` | `MODE_LABELS` for 3 modes, `TIERS_BY_MODE` for 3 modes | `MODE_LABELS` for 5 modes, corrected `TIERS_BY_MODE` | Yes: `TIERS_BY_MODE.img2img = ["draft", "quality"]`, `TIERS_BY_MODE.upscale = ["quality", "max"]` | PASS |
| `lib/hooks/use-model-schema.ts` | Fetches via server action (live API) | Same interface, backend reads from DB | Yes: transparent change, existing tests still pass | PASS |
| `lib/db/queries.ts` | 20+ query functions, 8 seed rows | Add model CRUD queries, correct seed to 9 rows | Yes: `seedDefaults` produces 9 rows; new functions `getActiveModels`, `upsertModel` exist | PASS |

---

## Blocking Issues

None.

---

## Recommendations

1. **[Info]** Success-Toast auto-dismiss duration: Architecture does not explicitly specify the 3s auto-dismiss from Discovery. sonner's default `duration` in the codebase is 5000ms (from `toast-provider.tsx`). The `toast.success()` call should use `{ duration: 3000 }` to match Discovery's "auto-dismiss 3s" requirement. This is an implementation detail, not a blocking architecture gap.
2. **[Info]** Dropdown empty states: Architecture does not explicitly enumerate all 5 dropdown empty states from Wireframes (syncing, never-synced, failed, partial, loading). These are UI-level implementation details covered by the sync state flow, but the slice writer should reference the Wireframes directly for these states.
3. **[Info]** Next.js 16.1.7 is available (project uses 16.1.6). Not related to this feature, but worth noting for a future dependency update.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Proceed to Slice Writing (Gate 2)
- [ ] Slice writer should reference Wireframes for dropdown empty state text (5 variants)
- [ ] Slice writer should specify `toast.success({ duration: 3000 })` for success toast auto-dismiss
