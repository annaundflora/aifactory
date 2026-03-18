# E2E Checklist: Model Catalog

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-18

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 12/12 APPROVED
- [x] Architecture APPROVED (Gate 1) -- APPROVED, 0 blocking issues
- [x] Integration Map has no MISSING INPUTS -- 0 missing inputs

---

## Happy Path Tests

### Flow 1: First App Start (Empty DB)

1. [ ] **Slice 01:** `models` table exists in DB with correct schema (15 columns, indexes on `replicate_id` and `is_active`)
2. [ ] **Slice 11:** Settings-Dialog opens, detects empty `models` table, triggers auto-sync
3. [ ] **Slice 09:** Sync-Button switches to `syncing` state (disabled, spinner icon, "Syncing..." label)
4. [ ] **Slice 09:** Progress-Toast appears: "Syncing Models..."
5. [ ] **Slice 05:** Route Handler streams progress events as newline-delimited JSON
6. [ ] **Slice 04:** 3 collections fetched in parallel, models deduplicated, schemas fetched (max 5 concurrent)
7. [ ] **Slice 02:** `detectCapabilities` correctly classifies models (txt2img, img2img, upscale, inpaint, outpaint)
8. [ ] **Slice 04:** Models upserted to DB with capabilities, input_schema, version_hash
9. [ ] **Slice 09:** Progress-Toast updates: "Syncing Models... 45/120"
10. [ ] **Slice 09:** Complete-Event received -> Success-Toast "120 Models synced" (auto-dismiss 3s)
11. [ ] **Slice 09:** `window.dispatchEvent("model-settings-changed")` fires
12. [ ] **Slice 10:** Dropdowns refresh and show filtered models per capability
13. [ ] **Slice 10:** TEXT TO IMAGE section shows only txt2img-capable models
14. [ ] **Slice 10:** INPAINT section shows only inpaint-capable models
15. [ ] **Slice 10:** OUTPAINT section shows only outpaint-capable models

### Flow 2: Manual Sync (Existing Data)

1. [ ] **Slice 10:** Settings-Dialog opens, `getModels()` returns models from DB
2. [ ] **Slice 10:** 5 sections render in order: TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, OUTPAINT
3. [ ] **Slice 09:** User clicks "Sync Models" button
4. [ ] **Slice 09:** Button goes disabled, Loading-Toast appears
5. [ ] **Slice 05:** POST /api/models/sync returns streaming response
6. [ ] **Slice 04:** Delta-sync: unchanged version_hash -> skip schema re-fetch
7. [ ] **Slice 04:** Changed version_hash -> fetch schema, update DB
8. [ ] **Slice 04:** New models inserted, removed models soft-deleted (is_active = false)
9. [ ] **Slice 09:** Complete-Event -> Toast shows summary "95 synced, 3 new, 1 updated"
10. [ ] **Slice 10:** Dropdowns update with new/changed models

### Flow 3: Model Selection and Schema Read

1. [ ] **Slice 10:** User opens TEXT TO IMAGE > Quality dropdown
2. [ ] **Slice 10:** Dropdown shows only models with `capabilities.txt2img = true`
3. [ ] **Slice 10:** User selects a model
4. [ ] **Slice 11:** `useModelSchema` hook fetches schema from DB via `getModelSchema` action
5. [ ] **Slice 06:** `getModelSchema` reads `input_schema` from DB (not live API)
6. [ ] **Slice 11:** Parameter-Panel renders schema properties (Enums as Select, Numbers as Input)

### Flow 4: On-the-fly Schema Fetch

1. [ ] **Slice 06:** Model selected but `input_schema` is null in DB
2. [ ] **Slice 06:** `getModelSchema` fetches schema from Replicate API
3. [ ] **Slice 02:** `resolveSchemaRefs` resolves `$ref`-based enums
4. [ ] **Slice 06:** Schema stored in DB for future reads
5. [ ] **Slice 11:** Loading-Spinner visible in Parameter-Panel during fetch
6. [ ] **Slice 11:** Spinner disappears, Parameter-Panel renders properties

### Flow 5: Service Replacement Verification

1. [ ] **Slice 07:** `generation-service.ts` uses `ModelCatalogService.getSchema()` instead of `ModelSchemaService`
2. [ ] **Slice 07:** `buildReplicateInput()` produces identical output as before
3. [ ] **Slice 07:** `model-settings-service.ts` uses DB capabilities instead of live API
4. [ ] **Slice 07:** `checkCompatibility()` works for all 5 modes (txt2img, img2img, upscale, inpaint, outpaint)
5. [ ] **Slice 12:** No imports of `collection-model-service`, `model-schema-service`, or `collection-model.ts` remain

---

## Edge Cases

### Error Handling

- [ ] **Slice 04 (AC-5):** Single model schema fetch fails -> model skipped, rest continues, `SyncResult.failed = 1`
- [ ] **Slice 09 (AC-5):** Partial success -> Warning-Toast "95 synced, 25 failed" (user-dismissible, no auto-dismiss), Badge on button
- [ ] **Slice 09 (AC-6):** Complete failure (API down) -> Error-Toast "Sync failed: ..." (user-dismissible)
- [ ] **Slice 09 (AC-7):** 60s timeout -> Fetch aborted, Error-Toast "Sync timed out"
- [ ] **Slice 09 (AC-10):** Network error during fetch -> Error-Toast with message
- [ ] **Slice 05 (AC-1):** Unauthenticated request to sync route -> HTTP 401
- [ ] **Slice 05 (AC-3):** Concurrent sync attempt -> Error-Event "Sync bereits aktiv"
- [ ] **Slice 06 (AC-3):** Unauthenticated server action -> `{ error: string }` returned
- [ ] **Slice 06 (AC-4):** Invalid capability value -> `{ error: "Ungueltige Capability" }`
- [ ] **Slice 06 (AC-8):** Invalid modelId format -> `{ error: "Ungueltiges Model-ID-Format" }`
- [ ] **Slice 07 (AC-11):** Model not in DB -> `checkCompatibility` returns `true` (fallback)

### State Transitions

- [ ] `no_models` -> `syncing` (auto-sync on empty table) -- Slice 11 AC-1
- [ ] `synced` -> `syncing` (manual sync click) -- Slice 09 AC-2
- [ ] `syncing` -> `synced` (all successful) -- Slice 09 AC-4
- [ ] `syncing` -> `sync_partial` (partial success) -- Slice 09 AC-5
- [ ] `syncing` -> `sync_failed` (complete failure) -- Slice 09 AC-6
- [ ] `syncing` -> `sync_failed` (timeout) -- Slice 09 AC-7
- [ ] `sync_partial` -> `syncing` (retry) -- Slice 09 AC-9
- [ ] `sync_partial` -> `synced` (successful retry clears badge) -- Slice 09 AC-9

### Boundary Conditions

- [ ] **Slice 04 (AC-2):** Delta-sync: identical version_hash -> no schema re-fetch
- [ ] **Slice 04 (AC-1):** Duplicate models across collections -> deduplicated by replicate_id
- [ ] **Slice 04 (AC-10):** Concurrency limit: max 5 parallel requests during sync
- [ ] **Slice 03 (AC-3):** Inactive model with matching capability -> NOT returned by getModelsByCapability
- [ ] **Slice 03 (AC-8):** Inactive model -> NOT returned by getModelByReplicateId
- [ ] **Slice 10 (AC-4):** Empty dropdown during sync -> shows "Loading models... please wait."
- [ ] **Slice 10 (AC-5):** Empty dropdown, never synced -> shows "No models available. Click Sync Models to load."
- [ ] **Slice 10 (AC-6):** Empty dropdown, sync failed -> shows "Sync failed. Click Sync Models to retry."
- [ ] **Slice 10 (AC-7):** Empty dropdown, partial sync -> shows "No models for this mode yet. Click Sync Models to retry."
- [ ] **Slice 11 (AC-2):** Non-empty table -> no auto-sync triggered
- [ ] **Slice 11 (AC-7):** Dialog reopen with models -> no duplicate auto-sync
- [ ] **Slice 08 (AC-5):** img2img tiers = `["draft", "quality"]` only (no max)
- [ ] **Slice 08 (AC-6):** upscale tiers = `["quality", "max"]` only (no draft)
- [ ] **Slice 08 (AC-9):** Seed produces exactly 9 rows

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | DB Schema -> Read Queries | S01 -> S03 | `getActiveModels()` returns data from `models` table |
| 2 | Capability Detection -> Sync Service | S02 -> S04 | `syncAll` calls `detectCapabilities`, result stored in DB `capabilities` JSONB |
| 3 | Schema Resolution -> Sync Service | S02 -> S04 | `syncAll` calls `resolveSchemaRefs`, resolved schema stored in `input_schema` JSONB |
| 4 | Catalog Service -> Server Actions | S03 -> S06 | `getModels` delegates to `getModelsByCapability` / `getActiveModels` |
| 5 | Catalog Service -> Service Replacement | S03 -> S07 | `generation-service.ts` calls `ModelCatalogService.getSchema()` |
| 6 | Sync Service -> Route Handler | S04 -> S05 | Route Handler calls `ModelSyncService.syncAll(onProgress)` and streams events |
| 7 | Route Handler -> Sync Button | S05 -> S09 | Client `fetch` reads streaming response, updates toast |
| 8 | Server Actions -> Dropdown Filter | S06 -> S10 | `getModels({ capability })` returns filtered models for dropdowns |
| 9 | Types/Constants -> Dropdown Rendering | S08 -> S10 | 5 MODE_LABELS and corrected TIERS_BY_MODE drive section rendering |
| 10 | Sync Button -> Dropdown Refresh | S09 -> S10 | `window.dispatchEvent("model-settings-changed")` triggers data reload |
| 11 | Dropdown Data -> Auto-Sync Check | S10 -> S11 | Empty getModels results trigger auto-sync via handleSync() |
| 12 | Server Action -> Schema Loading | S06 -> S11 | `getModelSchema` with on-the-fly fallback drives useModelSchema hook |
| 13 | All Slices -> Cleanup | S06/S07/S10/S11 -> S12 | Legacy files can be safely deleted after all consumers migrated |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- All 12 slices APPROVED by Gate 2 compliance
- Architecture APPROVED by Gate 1 compliance
- Integration Map shows 0 gaps, 32 valid connections
- Discovery traceability: 100% (43/43 elements covered)
