# Feature: Model Catalog

**Epic:** –
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Model-Capabilities (Inputs, Aspect Ratios, Resolutions, img2img-Support) werden per Live-API-Call von Replicate geholt und nur im In-Memory-Cache gehalten
- Die App weiß vor einem API-Call nicht, welche Parameter ein Model unterstützt
- UI kann keine modellspezifischen Controls (Aspect Ratio Dropdown, Megapixel-Selector) anbieten, ohne vorher die API zu fragen
- img2img-Feld-Erkennung ist hardcoded in `model-schema-service.ts` (6+ Feldnamen-Prioritätsliste)
- Beim App-Neustart gehen alle Schema-Caches verloren

**Solution:**
- Neue `models`-Tabelle als persistenter Model-Katalog mit vollem OpenAPI Input-Schema
- Auto-Sync von 3 Replicate Collections (text-to-image, image-editing, super-resolution)
- Schema-basierte Capability-Detection (txt2img, img2img, upscale, inpaint, outpaint)
- UI liest Schema aus DB statt Live-API → Parameter-Panel und Dropdowns reagieren sofort

**Business Value:**
- Optimale API-Calls: App sendet nur Parameter die das Model versteht
- Bessere UX: Modellspezifische Controls sofort verfügbar, keine Loading-Delays
- Wartbarkeit: Neue Models brauchen keinen Code-Change, nur einen Sync

---

## Scope & Boundaries

| In Scope |
|----------|
| `models`-Tabelle in DB (Drizzle Schema + Migration) |
| Sync-Service: Bulk-Fetch aller 3 Collections + Schema pro Model |
| Capability-Detection: Schema → Capabilities (txt2img, img2img, upscale, inpaint, outpaint) |
| Delta-Sync via `version_hash` (nur bei Schema-Änderung neu parsen) |
| Paralleles Fetching mit Concurrency-Limit (~5) |
| Soft-Delete (`is_active` Flag) für entfernte Models |
| Ersetzung von `CollectionModelService` und `ModelSchemaService` |
| UI: Model-Settings-Dropdowns filtern nach Capability (5 Sections) |
| UI: INPAINT + OUTPAINT Sections im Model Settings Modal |
| UI: Parameter-Panel liest Schema aus DB |
| UI: Sync-Button im Model Settings Modal |
| UI: Progress-Toast während Sync (60s Auto-Timeout → sync_failed) |
| UI: Partial-Toast user-dismissible mit persistentem ⚠ Badge am Sync-Button |
| Auto-Sync beim ersten App-Start (leere Tabelle) |
| On-the-fly Schema-Fetch wenn Model nicht in DB |

| Out of Scope |
|--------------|
| Periodischer Cron-basierter Sync |
| Manuelle Eingabe beliebiger Model-IDs (nur DB-Models in Dropdowns) |
| Model-Vergleich / Empfehlungs-Features |
| Kosten/Pricing-Informationen pro Model |
| Training-Endpoints / LoRA-Management |
| Änderungen an `model_settings`-Tabelle (bleibt unverändert) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (`"use server"`) + 1 Route Handler for streaming sync progress |
| Authentication | `requireAuth()` guard (existing pattern) on all endpoints |
| Rate Limiting | Replicate API: max 5 concurrent requests (client-side concurrency limiter) |

### Endpoints

#### Server Actions (`app/actions/models.ts`)

| Action | Input | Output | Auth | Business Logic |
|--------|-------|--------|------|----------------|
| `getModels` | `{ capability?: GenerationMode }` | `Model[] \| { error: string }` | Required | DB read: `is_active = true`, optional capability filter via JSONB `capabilities->>` |
| `getModelSchema` | `{ modelId: string }` | `{ properties: SchemaProperties } \| { error: string }` | Required | DB read (`input_schema`). If `null` → on-the-fly fetch from Replicate API, store in DB, return. Preserves `$ref` resolution |
| `triggerSync` | `void` | `{ status: "started" } \| { error: string }` | Required | Validates no sync in progress, returns immediately. Actual sync happens via Route Handler stream |

#### Route Handler (`app/api/models/sync/route.ts`)

| Method | Path | Request | Response | Auth | Business Logic |
|--------|------|---------|----------|------|----------------|
| POST | `/api/models/sync` | `{}` | `ReadableStream` (newline-delimited JSON events) | Session cookie (via `auth()`) | Fetches 3 collections, deduplicates, fetches schemas with progress events, upserts to DB |

**Stream Events:**

| Event Type | Payload | When |
|------------|---------|------|
| `progress` | `{ type: "progress", completed: number, total: number }` | After each model schema fetch completes |
| `complete` | `{ type: "complete", synced: number, failed: number, new: number, updated: number }` | Sync finished successfully |
| `error` | `{ type: "error", message: string }` | Unrecoverable error (API down, auth failed) |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `Model` | Inferred from Drizzle `models` table (`typeof models.$inferSelect`) | N/A (DB-generated) | Replaces `CollectionModel` type |
| `SyncProgressEvent` | `type: "progress" \| "complete" \| "error"`, varying payload per type | Discriminated union on `type` | Streamed as newline-delimited JSON |
| `GetModelsInput` | `capability?: GenerationMode` | Optional, must be valid `GenerationMode` if provided | Used by `getModels` server action |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `models` (NEW) | Persistent model catalog with schemas + capabilities | `id` (PK), `replicate_id` (UNIQUE), `capabilities` (JSONB), `input_schema` (JSONB) |
| `model_settings` (UNCHANGED) | Mode/Tier → Model assignment + default params | `mode` + `tier` (UNIQUE), `modelId` (varchar) |

### Schema Details: `models` Table

| Column | Type | Constraints | Index | Notes |
|--------|------|-------------|-------|-------|
| `id` | `uuid` | PK, `gen_random_uuid()` | PK | Auto-generated |
| `replicate_id` | `varchar(255)` | NOT NULL, UNIQUE | uniqueIndex | Format: `owner/name` |
| `owner` | `varchar(100)` | NOT NULL | — | e.g. "black-forest-labs" |
| `name` | `varchar(100)` | NOT NULL | — | e.g. "flux-2-pro" |
| `description` | `text` | nullable | — | From Replicate API |
| `cover_image_url` | `text` | nullable | — | From Replicate API |
| `run_count` | `integer` | nullable | — | Popularity metric, updated on sync |
| `collections` | `text[]` | nullable | — | e.g. `['text-to-image', 'image-editing']`. Postgres array via `text("collections").array()` |
| `capabilities` | `jsonb` | NOT NULL | — | `{txt2img: bool, img2img: bool, upscale: bool, inpaint: bool, outpaint: bool}` |
| `input_schema` | `jsonb` | nullable | — | Full resolved OpenAPI Input properties (after `$ref` resolution). Can be large (~2-10KB per model) |
| `version_hash` | `varchar(64)` | nullable | — | `latest_version.id` from Replicate API. Used for delta-sync |
| `is_active` | `boolean` | NOT NULL, default `true` | index | Soft-delete flag |
| `last_synced_at` | `timestamp(tz)` | nullable | — | Last successful schema fetch |
| `created_at` | `timestamp(tz)` | NOT NULL, `defaultNow()` | — | — |
| `updated_at` | `timestamp(tz)` | NOT NULL, `defaultNow()` | — | — |

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `model_settings.modelId` | `models.replicate_id` | Logical (no FK constraint) | None — `model_settings` uses varchar string match, not FK. Keeps backward compat with models not yet synced |

### Drizzle Schema Pattern

```
// Follows existing pattern from schema.ts:
pgTable("models", { columns }, (table) => [indexes])
```

- uuid PK with `gen_random_uuid()`
- `createdAt`/`updatedAt` with `{ withTimezone: true }`
- Indexes as 3rd argument array
- Migration: idx 11 → `drizzle/0011_add_models_table.sql`

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `ModelSyncService` (NEW) | Bulk sync from Replicate Collections API | 3 collection slugs, progress callback | `SyncResult { synced, failed, new, updated }` | DB writes (upsert models), soft-delete removed models |
| `ModelCatalogService` (NEW) | DB reads for model data | `replicateId` or `capability` filter | `Model[]` or `Model \| null` | None (read-only) |
| `detectCapabilities` (NEW, pure function) | Schema → 5 capability booleans | `SchemaProperties`, `description: string \| null`, `collectionSlugs: string[]` | `Capabilities` object | None (pure) |
| `resolveSchemaRefs` (EXTRACTED) | Resolves `$ref`-based enums in OpenAPI schema | Raw OpenAPI schema data | Resolved `SchemaProperties` | None (pure) |
| `ModelSettingsService` (EXTENDED) | Model assignment + compatibility | `modelId`, `mode` | `boolean` | Modified: reads `capabilities` from DB instead of live API |

### ModelSyncService Flow

```
syncAll(onProgress) →
  1. Fetch 3 collections (parallel):
     GET /v1/collections/text-to-image
     GET /v1/collections/image-editing
     GET /v1/collections/super-resolution
  2. Deduplicate by replicate_id (owner/name)
  3. For each model (concurrent, max 5):
     a. Check version_hash → skip if unchanged (delta-sync)
     b. GET /v1/models/{owner}/{name} → extract schema + version
     c. resolveSchemaRefs(rawSchema) → resolved properties
     d. detectCapabilities(properties, description, collections)
     e. Upsert to DB
     f. onProgress(completed, total)
  4. Soft-delete: models in DB but not in any collection → is_active = false
  5. Return SyncResult
```

### Capability Detection Rules

| Capability | Detection Rule | Priority |
|------------|----------------|----------|
| `txt2img` | Schema has `prompt` field | Schema-based |
| `img2img` | Schema has image input field (6-name priority list) WITHOUT `mask` field | Schema-based. Field priority: `input_images` > `image_input` > `images` > `input_image` > `image_prompt` > `init_image` > `image` (without `mask`) |
| `inpaint` | Schema has `image` + `mask` fields, OR description contains "inpainting" | Schema + description |
| `outpaint` | Description contains "outpainting" or "expand", OR schema has `outpaint` parameter | Description + schema |
| `upscale` | Model in `super-resolution` collection, OR has `scale` parameter + `image` input without `prompt` | Collection + schema |

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `modelId` (server action) | Regex: `/^[a-z0-9-]+\/[a-z0-9._-]+$/` | "Ungueltiges Model-ID-Format" |
| `capability` (server action) | Must be valid `GenerationMode` if provided | "Ungueltige Capability" |
| Sync in progress | Only one sync at a time (module-scoped flag) | "Sync bereits aktiv" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| Server Actions | `requireAuth()` guard (existing) | Returns `{ error: string }` on auth failure |
| Route Handler `/api/models/sync` | `auth()` from next-auth (session check) | Returns 401 if no session |
| Replicate API | `REPLICATE_API_TOKEN` env var | Bearer token. Existing pattern from `replicate.ts` |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| `REPLICATE_API_TOKEN` | Server-side only (env var) | Never exposed to client. Used in server actions and route handler only |
| `input_schema` (JSONB) | No PII — contains model parameter definitions only | Public data from Replicate API |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| `modelId` parameter | Regex format check | — (used as API path segment, not SQL) |
| Replicate API responses | Type guards on response shape | Unknown fields ignored via explicit field mapping |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Replicate API (sync) | 5 concurrent requests | Per sync operation | Queue-based (wait for slot) |
| Sync trigger | 1 concurrent sync operation | Global (module-scoped lock) | Reject with error message |
| Client sync timeout | 60 seconds | Per sync invocation | Auto-abort → `sync_failed` state |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Client Components | UI state, toast management, sync trigger, dropdown rendering | React hooks + sonner toast |
| Server Actions (`app/actions/`) | Auth guard, input validation, service delegation | `"use server"` + `requireAuth()` + `T \| { error: string }` |
| Route Handler (`app/api/`) | Streaming sync progress (single endpoint) | `POST` with `ReadableStream` response |
| Services (`lib/services/`) | Business logic: sync orchestration, capability detection, DB queries | Const object export pattern |
| DB Queries (`lib/db/queries.ts`) | Data access: model CRUD, upsert, filtered reads | Standalone async function exports |
| Database | Persistent model catalog | Drizzle ORM + PostgreSQL |

### Data Flow

```
=== Sync Flow ===
Client (SettingsDialog)
  → fetch POST /api/models/sync (streaming)
    → auth() check
    → ModelSyncService.syncAll(onProgress)
      → Replicate Collections API (3x parallel)
      → Replicate Models API (Nx concurrent, max 5)
      → detectCapabilities(schema, description, collections)
      → DB upsert (models table)
      → Stream progress events back
  → Client reads stream → updates toast
  → window.dispatchEvent("model-settings-changed")

=== Read Flow ===
Client (ModelModeSection dropdown)
  → getModels({ capability: "txt2img" }) [server action]
    → requireAuth()
    → ModelCatalogService.getByCapability("txt2img")
      → DB SELECT WHERE is_active AND capabilities->>'txt2img' = 'true'
    → return Model[]

=== Schema Read Flow ===
Client (ParameterPanel via useModelSchema)
  → getModelSchema({ modelId }) [server action]
    → requireAuth()
    → DB SELECT input_schema WHERE replicate_id = modelId
    → If null: fetch from Replicate API, resolveSchemaRefs, store, return
    → return { properties }
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Auth failure | `requireAuth()` returns error | Redirect to login (existing) | — |
| Replicate API 429 | Retry with exponential backoff (reuse from `replicate.ts`) | Transparent to user | `console.warn` |
| Replicate API 5xx | Skip model, continue sync | Partial success toast | `console.error` |
| Replicate API timeout | Skip model after 5s | Partial success toast | `console.error` |
| Replicate API completely down | All fetches fail → sync_failed | Error toast: "Sync failed: API not reachable" | `console.error` |
| Single model schema fetch fail | Skip, mark as `input_schema: null` | Counted in "failed" total | `console.error` per model |
| Sync timeout (60s client-side) | Client aborts fetch | Error toast: "Sync timed out" → `sync_failed` | — |
| DB write failure | Propagate error, abort sync | Error toast | `console.error` |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | 10 table definitions | 11 table definitions | Add `models` table definition following existing `pgTable` pattern (uuid PK, timestamps, indexes) |
| `lib/types.ts` | `GenerationMode = "txt2img" \| "img2img" \| "upscale"` | `GenerationMode = "txt2img" \| "img2img" \| "upscale" \| "inpaint" \| "outpaint"` | Extend union type. Add to `VALID_GENERATION_MODES` array |
| `lib/types/collection-model.ts` | `CollectionModel` interface (7 fields) | REMOVE | Superseded by `Model` type inferred from Drizzle `models` table |
| `lib/services/collection-model-service.ts` | In-memory cache, single collection fetch | REMOVE | Replaced by `ModelCatalogService` with DB reads |
| `lib/services/model-schema-service.ts` | In-memory cache, live API fetch, `getImg2ImgFieldName`, `getMaxImageCount`, `$ref` resolution | Split into: `ModelCatalogService.getSchema()` (DB read), `detectCapabilities()` (pure function), `resolveSchemaRefs()` (pure function) | Preserve `getImg2ImgFieldName()`, `getMaxImageCount()`, `$ref` resolution logic. Remove in-memory cache. Remove live API fetch (moved to sync service) |
| `lib/services/model-settings-service.ts` | `checkCompatibility()` only checks img2img via live API | `checkCompatibility()` checks all 5 capabilities via DB `capabilities` JSONB | Replace `ModelSchemaService.supportsImg2Img()` call with DB capability read |
| `lib/services/generation-service.ts` | `buildReplicateInput()` calls `ModelSchemaService.getSchema()` | `buildReplicateInput()` calls `ModelCatalogService.getSchema()` | Change import + call. Schema source = DB (with on-the-fly fallback) |
| `app/actions/models.ts` | `getCollectionModels()`, `checkImg2ImgSupport()`, `getModelSchema()` | `getModels()`, `getModelSchema()` (DB-first) | Remove `getCollectionModels`, `checkImg2ImgSupport`. Add `getModels`. Modify `getModelSchema` to use DB |
| `components/settings/settings-dialog.tsx` | 3 modes, loads collection models + builds compatibility map | 5 modes, loads models from DB, sync button, no compatibility map building | Add sync button. Change `MODES` from 3→5. Replace `loadCollectionModels()` with `getModels()`. Remove `compatibilityMap` state + building. Add `handleSync()` with streaming + toast |
| `components/settings/model-mode-section.tsx` | `MODE_LABELS` for 3 modes, `TIERS_BY_MODE` for 3 modes, filter by `compatibilityMap` | `MODE_LABELS` for 5 modes, `TIERS_BY_MODE` for 5 modes, filter by `capabilities` field from model data | Add labels: `inpaint: "INPAINT"`, `outpaint: "OUTPAINT"`. **Correct existing TIERS_BY_MODE:** change `img2img` from `["draft", "quality", "max"]` to `["draft", "quality"]`, change `upscale` from `["draft", "quality"]` to `["quality", "max"]`. Add new tiers: `inpaint: ["quality"]`, `outpaint: ["quality"]`. Replace `compatibilityMap` filtering with direct capability check on model object |
| `lib/hooks/use-model-schema.ts` | Fetches via `getModelSchema` server action (live API backend) | Same interface, server action now reads from DB | No code change needed in hook — transparent via server action backend change |
| `lib/db/queries.ts` | 20+ query functions, `seedModelSettingsDefaults()` seeds 8 rows | Add model CRUD queries + correct seed to 9 rows | Add: `getActiveModels()`, `getModelsByCapability()`, `getModelByReplicateId()`, `upsertModel()`, `deactivateModelsNotIn()`, `getModelSchema()`. **Correct `seedModelSettingsDefaults()`:** remove `img2img/max` row (Discovery: img2img has only draft/quality). Change `upscale` rows from `[draft, quality]` to `[quality, max]` (Discovery: upscale tiers are quality/max). Add `inpaint/quality` and `outpaint/quality` rows. Final: 9 rows total: txt2img(3) + img2img(2) + upscale(2) + inpaint(1) + outpaint(1) |

### New Files

| File | Purpose |
|------|---------|
| `drizzle/0011_add_models_table.sql` | Migration SQL (auto-generated by `drizzle-kit generate`) |
| `lib/services/model-sync-service.ts` | `ModelSyncService` — bulk sync orchestration |
| `lib/services/model-catalog-service.ts` | `ModelCatalogService` — DB reads for models + schemas |
| `lib/services/capability-detection.ts` | `detectCapabilities()` pure function + `resolveSchemaRefs()` extracted from model-schema-service |
| `app/api/models/sync/route.ts` | Route Handler for streaming sync progress |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Replicate API rate limits | Burst of ~120+ schema fetches can trigger 429 | Concurrency limiter (max 5 parallel). Reuse queue pattern from `lib/clients/replicate.ts` but with `maxConcurrent: 5` |
| Replicate API has no `updated_at` on models | Cannot detect schema changes by timestamp | Delta-sync via `latest_version.id` hash comparison |
| OpenAPI schemas use `$ref` for enums | Raw schema not directly usable by Parameter Panel | `resolveSchemaRefs()` resolves `allOf/$ref` → inline enum (extracted from existing `model-schema-service.ts`) |
| Models can appear in multiple collections | Deduplication needed | Upsert by `replicate_id` (UNIQUE). Merge `collections` array |
| `model_settings` stores `modelId` as varchar string | No FK to `models` table possible without breaking existing data | Logical relationship via `replicate_id` string match. No schema-level FK constraint |
| Schema size varies (2-10KB per model) | Large JSONB column | PostgreSQL handles JSONB efficiently via TOAST compression. No issue for ~120 rows |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Model Metadata | Replicate Collections API | REST `GET /v1/collections/{slug}` | v1 (stable, no versioned breaking changes) | 3 slugs: `text-to-image`, `image-editing`, `super-resolution` |
| Model Schema | Replicate Models API | REST `GET /v1/models/{owner}/{name}` | v1 (stable) | Returns `latest_version.openapi_schema.components.schemas.Input.properties` + `latest_version.id` |
| DB ORM | drizzle-orm | TypeScript API | 0.45.1 (project version, latest stable as of 2026-03) | `pgTable`, JSONB, text array, uuid |
| DB Migrations | drizzle-kit | CLI `drizzle-kit generate` | 0.31.9 (project version, latest stable as of 2026-03) | Auto-generates SQL + journal |
| Toast Notifications | sonner | `toast.loading()`, `toast.success()`, `toast.error()`, `toast.dismiss()` | 2.0.7 (project version, latest stable as of 2026-03) | `toast.loading()` returns ID for later update/dismiss. New pattern: progress counter updates |
| Replicate SDK | replicate (npm) | `new Replicate({ auth })` | 1.4.0 (project version, latest stable as of 2026-03) | Used by existing `replicateRun()`. Sync service uses raw `fetch()` for collection/model endpoints (SDK doesn't expose collections API) |
| UI Components | shadcn (Radix UI) | `Dialog`, `Select`, `Button` | radix-ui 1.4.3 (project version) | Existing components, extended with new content |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Sync Performance | Full sync < 60s for ~120 models | Parallel schema fetching (5 concurrent). Collection fetches in parallel. Delta-sync skips unchanged schemas | Measure sync duration in complete event. Client-side 60s timeout as safety net |
| Dropdown Responsiveness | Instant model list on dialog open (< 100ms) | DB read instead of live API call. Models pre-synced | Compare: old = live API fetch (1-5s) vs. new = DB query (<50ms) |
| Parameter Panel Responsiveness | Schema available within 100ms for synced models | DB read for schema. Only on-the-fly fetch for unsynced models (1-2s) | Existing `useModelSchema` hook loading state |
| Data Freshness | Models current within last manual sync | Manual sync button. Auto-sync on first start. Delta-sync detects changes | `last_synced_at` timestamp on each model |
| Resilience | Partial failure doesn't block usable models | Partial success pattern: failed models skipped, successful models saved | `SyncResult.failed` count. `sync_partial` UI state |
| Storage | ~120 models × ~5KB schema = ~600KB | PostgreSQL JSONB with TOAST compression | Monitor `models` table size |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Sync duration | Timer (console.log) | < 60s | Client timeout at 60s |
| Models synced count | Counter | ~120 (matches Replicate collection sizes) | If 0 → API issue |
| Failed model count per sync | Counter | < 10% of total | If > 30% → investigate |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Replicate Collections API returns all relevant models | Manual comparison: 3 collections cover txt2img + img2img + upscale + inpaint + outpaint models | Missing capabilities → some dropdowns empty. Mitigation: add more collection slugs |
| `latest_version.id` changes when schema changes | Observed behavior from API research. No official guarantee | Delta-sync might miss schema updates → full re-sync on manual trigger (version_hash = null forces re-fetch) |
| Schema size is manageable (~2-10KB per model) | Measured via API research on Flux, SDXL, Imagen schemas | If much larger → monitor DB size. JSONB TOAST handles it |
| ~120 models total across 3 collections | Replicate research: ~96 + 37 + 33 with overlap → ~120 unique | If significantly more → sync may exceed 60s timeout. Adjust concurrency or timeout |
| `inpaint` and `outpaint` capabilities detectable from schema + description | Tested rules: `image` + `mask` = inpaint, description keywords = outpaint | If detection fails → some models misclassified. Mitigation: manual capability override in future |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Replicate API down during sync | Low | Med | Partial success: save what we can. Error toast. Existing DB data unchanged | Retry button. App works with stale data |
| Replicate API rate limit (429) during bulk sync | Med | Low | Concurrency limit (5). Exponential backoff retry per request | Partial success. Lower concurrency in future if persistent |
| Schema `$ref` resolution breaks for new schema patterns | Low | Med | Defensive parsing: if resolution fails, store raw schema. Log warning | Parameter Panel shows raw properties (less pretty but functional) |
| Capability detection rules don't cover all models | Med | Low | Conservative detection: only set `true` when confident | Models appear in fewer dropdowns than expected. User can re-sync after detection rules updated |
| Sync takes > 60s for large collection growth | Low | Low | Client timeout → `sync_failed` state with error toast | Increase timeout. Increase concurrency. Or paginate sync |
| Route Handler streaming not supported in production deployment | Low | High | Test in production environment (Docker + Caddy) | Fallback: non-streaming single-response server action (no progress, just final result) |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Sync progress delivery | Route Handler with `ReadableStream` (newline-delimited JSON) | Server Actions don't support streaming. Route Handler is standard Next.js pattern for long-running operations with progress |
| Model persistence | PostgreSQL via Drizzle ORM | Existing stack. JSONB for flexible schema storage |
| Capability storage | JSONB column `capabilities` | 5 booleans in JSONB. Queryable via `->>` operator. Extensible without migration |
| Schema storage | JSONB column `input_schema` | Variable structure across models. JSONB preserves full schema with efficient TOAST compression |
| Collection tracking | `text[]` array column | Simple, queryable, no join table needed for ~3 values |
| Concurrency control | Queue-based slot system (reuse pattern from `replicate.ts`) | Proven pattern in codebase. Configurable `maxConcurrent` |
| Toast progress | `sonner` `toast.loading()` with periodic updates via `toast.loading(msg, { id })` | sonner supports updating existing toasts by ID. No new dependencies |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Route Handler for sync (new pattern) | Real-time progress updates. Clean streaming API | Deviates from server-action-only pattern. Slightly more complex | Single, well-documented endpoint. Only used for sync. Fallback to non-streaming possible |
| JSONB for `input_schema` (denormalized) | No joins needed. Full schema in one read. Flexible | Not queryable at field level (don't need to). Storage overhead | TOAST compression. Only ~120 rows. Schema reads are by-PK lookups |
| Soft-delete (`is_active` flag) vs. hard delete | Preserves historical data. No cascade issues with `model_settings` | Grows table over time | `is_active` index for fast filtered queries. Negligible growth for ~120 models |
| No FK from `model_settings.modelId` to `models` | Backward compatible. Works with models not yet synced | No referential integrity | Logical validation in service layer. `model_settings` already works this way |
| `text[]` for `collections` vs. join table | Simple. ~3 values max. Queryable with `ANY()` | Not normalized | Acceptable for low-cardinality field |

---

## Context & Research

### Codebase Patterns (from Codebase Scan)

| Pattern | Recommendation | Applied In |
|---------|----------------|------------|
| Drizzle `pgTable` (uuid PK, timestamps, indexes) | REUSE | `models` table definition |
| Service Object Pattern (const export) | REUSE | `ModelSyncService`, `ModelCatalogService` |
| Server Action Pattern (`"use server"` + `requireAuth`) | REUSE | Modified `app/actions/models.ts` |
| sonner toast | REUSE + EXTEND | Progress toast with `toast.loading()` + ID-based updates |
| `window.dispatchEvent` | REUSE | Notify dropdowns after sync completes |
| Replicate concurrency limiter | EXTEND | Increase `maxConcurrent` to 5 for sync |
| `getImg2ImgFieldName` / `getMaxImageCount` | PRESERVE | Extract into `capability-detection.ts`, used by both sync and generation |
| `$ref` resolution logic | PRESERVE | Extract into `capability-detection.ts` as `resolveSchemaRefs()` |
| In-memory Map cache | AVOID | Replaced by DB persistence |
| `CollectionModel` type | AVOID | Replaced by Drizzle-inferred `Model` type |

### Replicate API Research

| Finding | Source | Impact |
|---------|--------|--------|
| Collections API returns `{ models: [...] }` with `owner`, `name`, `description`, `cover_image_url`, `run_count` | Existing `collection-model-service.ts` + API docs | Direct mapping to `models` table columns |
| Model detail API returns `latest_version.openapi_schema.components.schemas.Input.properties` | Existing `model-schema-service.ts` | Schema extraction path confirmed |
| `latest_version.id` is a 64-char hash that changes on new version | API research | Usable as `version_hash` for delta-sync |
| No `updated_at` field on model level | API research | Cannot use timestamp-based cache invalidation → hash-based delta-sync |
| ~96 text-to-image + ~37 image-editing + ~33 super-resolution models | Web research | ~120 unique after dedup. Sync feasible in <60s with concurrency 5 |
| Schema `allOf/$ref` pattern used for enum types | Existing `model-schema-service.ts:127-159` | Must preserve `$ref` resolution in sync pipeline |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| — | No open questions | — | — | — |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Architecture approach: full research or direct start? | Direct start — codebase scan provides comprehensive context, discovery is detailed, research targets confirmed via web search |
| 2 | Sync progress delivery: Server Action vs Route Handler vs Polling? | Route Handler with `ReadableStream`. Server Actions don't support streaming. Polling adds complexity + latency. Route Handler is standard Next.js for long-running operations |
| 3 | On-the-fly schema fetch: where does it happen? | In `getModelSchema` server action. DB read first, if `input_schema` is null → fetch from Replicate API, resolve refs, store in DB, return |
| 4 | FK between `model_settings.modelId` and `models.replicate_id`? | No FK constraint. Logical relationship only. Backward compatible with models not yet synced |
| 5 | Capability detection: where does the logic live? | New `lib/services/capability-detection.ts` — pure functions. Used by sync service (bulk detection) and preserved for generation service (img2img field detection) |

---

## ✅ Sign-Off

All sections checked against template:

| Template-Section | Vorhanden? | Abweichung/Grund |
|------------------|------------|------------------|
| Problem & Solution | ✅ | From Discovery |
| Scope & Boundaries | ✅ | From Discovery |
| API Design | ✅ | Server Actions + 1 Route Handler |
| Database Schema | ✅ | New `models` table |
| Server Logic | ✅ | 3 new services + 1 extended |
| Security | ✅ | Existing patterns reused |
| Architecture Layers | ✅ | Data flow for sync + read + schema |
| Migration Map | ✅ | 12 modified files + 5 new files |
| Constraints & Integrations | ✅ | 6 constraints + 7 integrations with exact versions |
| Quality Attributes (NFRs) | ✅ | 6 attributes with measures |
| Risks & Assumptions | ✅ | 5 assumptions + 6 risks |
| Technology Decisions | ✅ | 7 choices + 5 trade-offs |
| Q&A Log | ✅ | 5 entries |
