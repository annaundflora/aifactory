# Integration Map: Model Catalog

**Generated:** 2026-03-18
**Slices:** 12
**Connections:** 32

---

## Dependency Graph (Visual)

```
                  +-----------------------+     +------------------------------+
                  |  Slice 01             |     |  Slice 02                    |
                  |  DB Schema            |     |  Capability Detection        |
                  +-----------+-----------+     +-----------+------------------+
                              |                             |
            +-----------------+-----------------------------+
            |                 |                             |
            v                 v                             v
+-----------+-----------+  +--+----------------------------+---+
|  Slice 03             |  |  Slice 04                         |
|  Catalog Service      |  |  Sync Service                     |
+--+----+----+----------+  +-----------+-----------------------+
   |    |    |                          |
   |    |    +------+                   |
   |    |           |                   v
   |    |    +------+------+ +---------+-----------+
   |    |    | Slice 06    | | Slice 05            |
   |    |    | Server Act. | | Sync Route          |
   |    |    +--+---+------+ +--------+------------+
   |    |       |   |                 |
   |    |       |   |                 |
   |    v       |   |                 |
   | +---------+++ |                  |
   | | Slice 07 || |                  |
   | | Svc Repl.|| |                  |
   | +----------++ |                  |
   |        |      |                  |
   |        v      v                  |
   |   +----+------+------+          |
   |   |  Slice 08         |          |
   |   |  Types & Seed     |          |
   |   +---+--------+------+          |
   |       |        |                 |
   |       |        +-----+           |
   |       |              |           |
   |       v              v           v
   |  +----+--------+ +--+--------+--+-+
   |  | Slice 10    | | Slice 09       |
   |  | Dropdown    | | Sync Button    |
   |  +----+--------+ +--+------------+
   |       |              |
   |       +------+-------+
   |              |
   |              v
   |       +------+--------+
   |       | Slice 11      |
   |       | Auto-Sync     |
   |       +------+--------+
   |              |
   +--------------+
                  |
           +------+--------+
           | Slice 12      |
           | Cleanup       |
           +---------------+
```

---

## Nodes

### Slice 01: DB Schema & Migration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `models` table, `$inferSelect`, `$inferInsert`, Migration SQL |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | First slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `models` PgTable Export | Drizzle Table | Slice 03, Slice 04, Slice 12 |
| `typeof models.$inferSelect` | Inferred Type | Slice 03, Slice 04, Slice 12 |
| `typeof models.$inferInsert` | Inferred Type | Slice 04 |
| `0011_add_models_table.sql` | SQL Migration | Runtime (DB) |

---

### Slice 02: Capability Detection (Pure Functions)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | 4 pure functions + 1 type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies (pure functions) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `detectCapabilities` | Pure Function | Slice 04 |
| `resolveSchemaRefs` | Pure Function | Slice 04, Slice 06 |
| `getImg2ImgFieldName` | Pure Function | Slice 07 |
| `getMaxImageCount` | Pure Function | generation-service.ts (existing) |
| `Capabilities` | Type Export | Slice 04 |

---

### Slice 03: Model Catalog Service (DB Reads)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | Query functions + Service object + Model type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `models` Table Export | Slice 01 | VALID |
| `typeof models.$inferSelect` | Slice 01 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getActiveModels` | Query Function | Slice 06 |
| `getModelsByCapability` | Query Function | Slice 06 |
| `getModelByReplicateId` | Query Function | Slice 04, Slice 07 |
| `getModelSchema` (Query) | Query Function | Slice 06 |
| `ModelCatalogService` | Service Object | Slice 06, Slice 07 |
| `Model` | Type Export | All consumers |

---

### Slice 04: Model Sync Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01, Slice 02, Slice 03 |
| Outputs | Sync service + write queries |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `models` Table Export | Slice 01 | VALID |
| `detectCapabilities` | Slice 02 | VALID |
| `resolveSchemaRefs` | Slice 02 | VALID |
| `getModelByReplicateId` | Slice 03 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModelSyncService.syncAll` | Service Method | Slice 05 |
| `SyncResult` | Type Export | Slice 05 |
| `upsertModel` | Query Function | Internal (Sync Service) |
| `deactivateModelsNotIn` | Query Function | Internal (Sync Service) |

---

### Slice 05: Sync Route Handler

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | POST /api/models/sync route |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSyncService.syncAll` | Slice 04 | VALID |
| `SyncResult` | Slice 04 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `POST /api/models/sync` | Route Handler | Slice 09 |

---

### Slice 06: Server Actions

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | 3 server actions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelCatalogService` | Slice 03 | VALID |
| `getModelsByCapability` | Slice 03 | VALID |
| `getActiveModels` | Slice 03 | VALID |
| `getModelSchema` (Query) | Slice 03 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getModels` | Server Action | Slice 10, Slice 11, Slice 12 |
| `getModelSchema` (Action) | Server Action | Slice 11 (useModelSchema hook) |
| `triggerSync` | Server Action | Slice 09 |

---

### Slice 07: Service Replacement

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | Updated services (internal) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelCatalogService` | Slice 03 | VALID |
| `getModelByReplicateId` | Slice 03 | VALID |
| `getImg2ImgFieldName` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `buildReplicateInput` (updated) | Async Function | Internal (GenerationService) |
| `checkCompatibility` (updated) | Async Method | Internal (ModelSettingsService), Slice 08 |

---

### Slice 08: Types & Seed Update

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06, Slice 07 |
| Outputs | Extended types, corrected constants, seed |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModels` uses `VALID_GENERATION_MODES` | Slice 06 | VALID |
| `checkCompatibility` uses `GenerationMode` | Slice 07 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationMode` (5 values) | Union Type | Slice 09, Slice 10, Slice 11 |
| `VALID_GENERATION_MODES` (5 entries) | Const Array | Slice 06 (validation) |
| `TIERS_BY_MODE` (corrected) | Const Record | Slice 10 |
| `MODE_LABELS` (5 entries) | Const Record | Slice 10 |
| `seedModelSettingsDefaults` (9 rows) | Async Function | App-Init |

---

### Slice 09: Sync-Button & Progress-Toast

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05, Slice 08 |
| Outputs | Sync button UI, handleSync, model-settings-changed event |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `POST /api/models/sync` | Slice 05 | VALID |
| `GenerationMode` (5 values) | Slice 08 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `handleSync()` in settings-dialog | Internal Function | Slice 11 |
| `window.dispatchEvent("model-settings-changed")` | DOM Event | Slice 10 |

---

### Slice 10: Dropdown Capability-Filter

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06, Slice 08 |
| Outputs | Capability-filtered dropdowns |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModels({ capability })` | Slice 06 | VALID |
| `GenerationMode` (5 values) | Slice 08 | VALID |
| `MODE_LABELS` (5 entries) | Slice 08 | VALID |
| `TIERS_BY_MODE` (corrected) | Slice 08 | VALID |
| `window.dispatchEvent("model-settings-changed")` | Slice 09 | VALID |
| Sync-State (syncing/idle/etc.) | Slice 09 | VALID (same file state) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Capability-filtered Dropdowns | UI Component | End-user |
| `ModelModeSectionProps` (updated) | Props Interface | settings-dialog.tsx |

---

### Slice 11: Auto-Sync & On-the-fly Schema-Fetch

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 09, Slice 10 |
| Outputs | Auto-sync trigger, loading state |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `handleSync()` in settings-dialog | Slice 09 | VALID |
| `window.dispatchEvent("model-settings-changed")` | Slice 09 | VALID |
| `getModels({ capability })` calls | Slice 10 | VALID |
| `getModelSchema({ modelId })` | Slice 06 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Auto-Sync trigger at empty catalog | Logic | End-user (first app start) |
| Loading-State display in Parameter-Panel | UI Behavior | End-user |

---

### Slice 12: Cleanup (Legacy Removal)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06, Slice 07, Slice 10, Slice 11 |
| Outputs | Clean codebase |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `models` Drizzle Table + `$inferSelect` | Slice 01 | VALID |
| `getModels({ capability })` | Slice 06 | VALID |
| `generation-service.ts` already migrated | Slice 07 | VALID |
| `settings-dialog.tsx` + `model-mode-section.tsx` already migrated | Slice 10 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Clean codebase without legacy services | File Deletion | End-product (no consumer) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 03 | `models` PgTable Export | Drizzle Table | VALID |
| 2 | Slice 01 | Slice 03 | `typeof models.$inferSelect` | Inferred Type | VALID |
| 3 | Slice 01 | Slice 04 | `models` PgTable Export | Drizzle Table | VALID |
| 4 | Slice 01 | Slice 12 | `typeof models.$inferSelect` | Inferred Type | VALID |
| 5 | Slice 02 | Slice 04 | `detectCapabilities` | Pure Function | VALID |
| 6 | Slice 02 | Slice 04 | `resolveSchemaRefs` | Pure Function | VALID |
| 7 | Slice 02 | Slice 06 | `resolveSchemaRefs` | Pure Function | VALID |
| 8 | Slice 02 | Slice 07 | `getImg2ImgFieldName` | Pure Function | VALID |
| 9 | Slice 03 | Slice 04 | `getModelByReplicateId` | Query Function | VALID |
| 10 | Slice 03 | Slice 06 | `ModelCatalogService` | Service Object | VALID |
| 11 | Slice 03 | Slice 06 | `getModelsByCapability` | Query Function | VALID |
| 12 | Slice 03 | Slice 06 | `getActiveModels` | Query Function | VALID |
| 13 | Slice 03 | Slice 06 | `getModelSchema` (Query) | Query Function | VALID |
| 14 | Slice 03 | Slice 07 | `ModelCatalogService` | Service Object | VALID |
| 15 | Slice 03 | Slice 07 | `getModelByReplicateId` | Query Function | VALID |
| 16 | Slice 04 | Slice 05 | `ModelSyncService.syncAll` | Service Method | VALID |
| 17 | Slice 04 | Slice 05 | `SyncResult` | Type Export | VALID |
| 18 | Slice 05 | Slice 09 | `POST /api/models/sync` | Route Handler | VALID |
| 19 | Slice 06 | Slice 10 | `getModels` Server Action | Server Action | VALID |
| 20 | Slice 06 | Slice 11 | `getModelSchema` Server Action | Server Action | VALID |
| 21 | Slice 06 | Slice 12 | `getModels` Server Action | Server Action | VALID |
| 22 | Slice 07 | Slice 08 | `checkCompatibility` uses `GenerationMode` | Type Dependency | VALID |
| 23 | Slice 06 | Slice 08 | `getModels` uses `VALID_GENERATION_MODES` | Validation Dependency | VALID |
| 24 | Slice 08 | Slice 09 | `GenerationMode` (5 values) | Type Export | VALID |
| 25 | Slice 08 | Slice 10 | `GenerationMode`, `MODE_LABELS`, `TIERS_BY_MODE` | Type + Const | VALID |
| 26 | Slice 09 | Slice 10 | `window.dispatchEvent("model-settings-changed")` | DOM Event | VALID |
| 27 | Slice 09 | Slice 10 | Sync-State (shared React state) | React State | VALID |
| 28 | Slice 09 | Slice 11 | `handleSync()` internal function | Internal Logic | VALID |
| 29 | Slice 09 | Slice 11 | `window.dispatchEvent("model-settings-changed")` | DOM Event | VALID |
| 30 | Slice 10 | Slice 11 | `getModels({ capability })` calls | Server Action Calls | VALID |
| 31 | Slice 07 | Slice 12 | generation-service.ts migrated | Prerequisite | VALID |
| 32 | Slice 10 | Slice 12 | settings-dialog.tsx migrated | Prerequisite | VALID |

---

## Validation Results

### VALID Connections: 32

All declared dependencies have matching outputs.

### Orphaned Outputs: 1

| Output | Defined In | Consumers | Action |
|--------|------------|-----------|--------|
| `getMaxImageCount` | Slice 02 | `generation-service.ts` (existing, not a slice consumer) | OK -- consumed by existing codebase, not a slice-internal consumer. Not a gap. |

**Note:** `getMaxImageCount` is consumed by the existing `generation-service.ts` (which already imports it from `model-schema-service.ts`). After Slice 07 migrates the service, it will import from `capability-detection.ts`. This is properly handled in Slice 07's import update. No action needed.

### Missing Inputs: 0

No missing inputs detected.

### Deliverable-Consumer Gaps: 0

All components have mount points. Key multi-slice file analysis:

| File | Modified By | Coordination | Status |
|------|------------|--------------|--------|
| `settings-dialog.tsx` | Slice 09 (sync button), Slice 10 (dropdown filter), Slice 11 (auto-sync) | Each slice adds distinct functionality. Order enforced by dependencies | VALID |
| `model-mode-section.tsx` | Slice 08 (constants), Slice 10 (props/logic) | Slice 08 only changes constants, Slice 10 changes component logic | VALID |
| `queries.ts` | Slice 03 (read queries), Slice 04 (write queries), Slice 08 (seed update) | Each slice adds new functions or modifies distinct existing functions | VALID |

### Runtime Path Gaps: 0

All user flows have complete call chains:

| User-Flow | Chain | Covered |
|-----------|-------|---------|
| Manual Sync | Button (S09) -> fetch POST (S09) -> Route Handler (S05) -> SyncService (S04) -> Collections API + Schema Fetch -> detectCapabilities (S02) -> upsertModel (S04) -> Stream Events -> Toast (S09) -> dispatchEvent -> Dropdown Refresh (S10) | VALID |
| First App Start | Dialog Mount (S11) -> getModels returns empty (S06/S10) -> handleSync auto-trigger (S11/S09) -> same sync chain as above | VALID |
| Model Selection | Dropdown (S10) -> getModels({ capability }) (S06) -> getModelsByCapability (S03) -> DB Read -> Model[] returned -> Dropdown populated | VALID |
| Schema Read | Model selected -> useModelSchema hook (S11) -> getModelSchema action (S06) -> DB Read (S03) -> if null: on-the-fly fetch + resolveSchemaRefs (S02) -> return properties -> Parameter Panel renders | VALID |
| Service Replacement | generation-service reads schema via ModelCatalogService (S07) -> DB (S03). model-settings-service reads capabilities via DB (S07) -> DB (S03) | VALID |

### Semantic Consistency Gaps: 0

| Check | Result |
|-------|--------|
| MODIFY-Chain: `settings-dialog.tsx` (S09, S10, S11) | Slice 09 adds handleSync + sync button. Slice 10 adds dropdown filter + MODES array. Slice 11 adds auto-sync check. No overlapping method modifications. VALID |
| MODIFY-Chain: `model-mode-section.tsx` (S08, S10) | Slice 08 only changes MODE_LABELS and TIERS_BY_MODE constants. Slice 10 changes Props interface and rendering logic. No conflict. VALID |
| MODIFY-Chain: `queries.ts` (S03, S04, S08) | Slice 03 adds read queries. Slice 04 adds write queries. Slice 08 modifies seedModelSettingsDefaults. All add/modify distinct functions. VALID |
| Return-Type Consistency: `ModelCatalogService.getSchema()` | Slice 03 provides, Slice 06 and Slice 07 consume. All use `SchemaProperties | null`. VALID |
| Return-Type Consistency: `getModelByReplicateId()` | Slice 03 provides, Slice 04 and Slice 07 consume. All use `Model | null`. VALID |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `sync-button` | Button | Model Settings Modal | Slice 09 (AC-1 to AC-10) | VALID |
| `sync-toast` | Toast | Global Toast Area | Slice 09 (AC-2 to AC-7, AC-10) | VALID |
| `model-dropdown` | Select | Pro Mode/Tier Row | Slice 10 (AC-1 to AC-11) | VALID |
| `inpaint-dropdown` | Select | INPAINT Section Row | Slice 10 (AC-2, AC-4, AC-11) | VALID |
| `outpaint-dropdown` | Select | OUTPAINT Section Row | Slice 10 (AC-2, AC-5) | VALID |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `no_models` | Dropdowns show empty:syncing, Auto-Sync runs | Wait (no user input needed) | Slice 11 (AC-1), Slice 10 (AC-4) | VALID |
| `syncing` | Progress-Toast, Button disabled | No cancel, 60s timeout | Slice 09 (AC-2, AC-3, AC-7, AC-8) | VALID |
| `synced` | Dropdowns filled, Button idle | Select model, start sync | Slice 10 (AC-2), Slice 09 (AC-4) | VALID |
| `sync_partial` | Warning-Toast, Badge on button | Dismiss toast, retry sync | Slice 09 (AC-5, AC-9) | VALID |
| `sync_failed` | Error-Toast, empty:failed dropdowns | Dismiss toast, retry sync | Slice 09 (AC-6), Slice 10 (AC-6) | VALID |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `no_models` | App-Start, table empty | `syncing` | Slice 11 (AC-1) | VALID |
| `synced` | User clicks Sync-Button | `syncing` | Slice 09 (AC-2) | VALID |
| `sync_partial` | User clicks Sync again | `syncing` | Slice 09 (AC-9 implies retry) | VALID |
| `sync_failed` | User clicks Sync again | `syncing` | Slice 09 (AC-2, general idle->syncing) | VALID |
| `syncing` | All models successful | `synced` | Slice 09 (AC-4) | VALID |
| `syncing` | Partial success | `sync_partial` | Slice 09 (AC-5) | VALID |
| `syncing` | Complete failure (API down) | `sync_failed` | Slice 09 (AC-6) | VALID |
| `syncing` | Timeout after 60s | `sync_failed` | Slice 09 (AC-7) | VALID |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Deduplication via `replicate_id` | Slice 04 (AC-1) | VALID |
| Capability Detection: txt2img (prompt field) | Slice 02 (AC-1) | VALID |
| Capability Detection: img2img (image field without mask) | Slice 02 (AC-2) | VALID |
| Capability Detection: inpaint (image+mask OR description) | Slice 02 (AC-3, AC-4) | VALID |
| Capability Detection: outpaint (description keywords OR schema) | Slice 02 (AC-5) | VALID |
| Capability Detection: upscale (collection OR scale+image) | Slice 02 (AC-6, AC-7, AC-8) | VALID |
| Capability -> Modal Section Mapping (5 sections) | Slice 10 (AC-3), Slice 08 (AC-3) | VALID |
| Dropdown-Filter: only matching capability | Slice 10 (AC-2), Slice 06 (AC-1) | VALID |
| Soft-Delete: is_active = false for removed models | Slice 04 (AC-4) | VALID |
| Delta-Sync: version_hash comparison | Slice 04 (AC-2, AC-3) | VALID |
| Concurrency: max 5 parallel requests | Slice 04 (AC-10) | VALID |
| Partial Success: save successful, skip failed | Slice 04 (AC-5) | VALID |
| Only DB-Models in dropdowns | Slice 10 (AC-1), Slice 06 (AC-1) | VALID |
| No cross-capability fallback | Slice 10 (AC-2 -- each section shows only matching capability) | VALID |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `id` (uuid PK) | Yes | Slice 01 (AC-1) | VALID |
| `replicate_id` (varchar 255, unique) | Yes | Slice 01 (AC-1, AC-3) | VALID |
| `owner` (varchar 100) | Yes | Slice 01 (AC-1) | VALID |
| `name` (varchar 100) | Yes | Slice 01 (AC-1) | VALID |
| `description` (text, nullable) | No | Slice 01 (AC-1) | VALID |
| `cover_image_url` (text, nullable) | No | Slice 01 (AC-1) | VALID |
| `run_count` (integer, nullable) | No | Slice 01 (AC-1) | VALID |
| `collections` (text[], nullable) | No | Slice 01 (AC-8) | VALID |
| `capabilities` (jsonb, NOT NULL) | Yes | Slice 01 (AC-7) | VALID |
| `input_schema` (jsonb, nullable) | No | Slice 01 (AC-1) | VALID |
| `version_hash` (varchar 64, nullable) | No | Slice 01 (AC-1) | VALID |
| `is_active` (boolean, default true) | Yes | Slice 01 (AC-4) | VALID |
| `last_synced_at` (timestamp, nullable) | No | Slice 01 (AC-1) | VALID |
| `created_at` (timestamp, default now) | Yes | Slice 01 (AC-1) | VALID |
| `updated_at` (timestamp, default now) | Yes | Slice 01 (AC-1) | VALID |

**Discovery Coverage:** 43/43 (100%)

---

## Infrastructure Prerequisite Check

| Check | Result | Status |
|-------|--------|--------|
| Health Endpoint (`http://localhost:3000`) | Next.js dev server -- standard, no custom health route needed | VALID |
| `POST /api/models/sync` route | Created by Slice 05 (new file) | VALID |
| `model-settings-changed` event | Already exists in codebase (`settings-dialog.tsx`, `canvas-detail-view.tsx`, `prompt-area.tsx`) | VALID |
| `auth()` function for Route Handler | Exists in `auth.ts` (confirmed by compliance report) | VALID |
| `requireAuth()` for Server Actions | Exists in `lib/auth/guard.ts` (confirmed by compliance report) | VALID |
| `sonner` toast library | Installed in project (version 2.0.7) | VALID |
| Drizzle migration index 0011 | Next available after `0010_add_assistant_tables.sql` | VALID |

No prerequisites missing.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 12 |
| Total Connections | 32 |
| Valid Connections | 32 |
| Missing Inputs | 0 |
| Orphaned Outputs | 0 (1 consumed by existing codebase, not a gap) |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 43/43 (100%) |

**Verdict:** READY FOR ORCHESTRATION
