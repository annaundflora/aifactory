# Slice 4: Model Sync Service (Bulk-Sync-Orchestrierung)

> **Slice 4 von 6** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-sync-service` |
| **Test** | `pnpm test lib/services/__tests__/model-sync-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema", "slice-02-capability-detection", "slice-03-catalog-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/model-sync-service.test.ts` |
| **Integration Command** | — (Replicate API gemockt) |
| **Acceptance Command** | `pnpm test lib/services/__tests__/model-sync-service.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Replicate API + DB-Modul werden gemockt) |

---

## Ziel

Bulk-Sync-Orchestrierung: 3 Replicate Collections parallel fetchen, Models ueber `replicate_id` deduplizieren, Schema pro Model parallel holen (max 5 concurrent), `resolveSchemaRefs` + `detectCapabilities` ausfuehren, DB-Upsert (`upsertModel`), Soft-Delete (`deactivateModelsNotIn`), Delta-Sync via `version_hash`, Progress-Callback.

---

## Acceptance Criteria

1) GIVEN 3 Replicate Collections mit insgesamt 8 Models (davon 2 Duplikate ueber Collections hinweg)
   WHEN `syncAll(onProgress)` aufgerufen wird
   THEN werden exakt 6 deduplizierte Models verarbeitet (Deduplizierung ueber `replicate_id` = `owner/name`)

2) GIVEN ein Model mit `replicate_id = "owner/model-a"` existiert in DB mit `version_hash = "abc123"`
   WHEN `syncAll` laeuft und die API denselben `latest_version.id = "abc123"` zurueckgibt
   THEN wird KEIN Schema-Fetch fuer dieses Model ausgefuehrt (Delta-Sync: `version_hash` unveraendert)

3) GIVEN ein Model mit `replicate_id = "owner/model-b"` existiert in DB mit `version_hash = "old-hash"`
   WHEN `syncAll` laeuft und die API `latest_version.id = "new-hash"` zurueckgibt
   THEN wird ein Schema-Fetch ausgefuehrt, `resolveSchemaRefs` + `detectCapabilities` aufgerufen, und das Model via `upsertModel` mit neuem `version_hash`, `input_schema` und `capabilities` aktualisiert

4) GIVEN 10 Models in DB mit `is_active = true`, aber nur 7 davon in den aktuellen Collections vorhanden
   WHEN `syncAll` abgeschlossen ist
   THEN werden die 3 fehlenden Models via `deactivateModelsNotIn(activeReplicateIds)` auf `is_active = false` gesetzt

5) GIVEN 6 Models zu syncen, wobei Model 3 einen API-Fehler (z.B. 500) wirft
   WHEN `syncAll` laeuft
   THEN werden Models 1, 2, 4, 5, 6 erfolgreich gesynct und Model 3 uebersprungen; `SyncResult.failed = 1`, `SyncResult.synced = 5`

6) GIVEN 6 Models zu syncen
   WHEN `syncAll(onProgress)` laeuft
   THEN wird `onProgress` nach jedem abgeschlossenen Model aufgerufen mit `(completed, total)`, z.B. `(1, 6)`, `(2, 6)`, ..., `(6, 6)`

7) GIVEN die `upsertModel`-Funktion erhaelt ein Model das noch NICHT in DB existiert
   WHEN `upsertModel(modelData)` aufgerufen wird
   THEN wird ein neues Model in die `models`-Tabelle eingefuegt (INSERT via Drizzle `onConflictDoUpdate` auf `replicate_id`)

8) GIVEN die `upsertModel`-Funktion erhaelt ein Model dessen `replicate_id` bereits in DB existiert
   WHEN `upsertModel(modelData)` aufgerufen wird
   THEN werden alle Felder aktualisiert (UPDATE) und `updated_at` auf aktuelle Zeit gesetzt

9) GIVEN `deactivateModelsNotIn(["owner/a", "owner/b"])` wird aufgerufen
   WHEN Models `owner/a`, `owner/b`, `owner/c` in DB existieren (alle `is_active = true`)
   THEN wird `owner/c` auf `is_active = false` gesetzt; `owner/a` und `owner/b` bleiben `is_active = true`

10) GIVEN die Sync-Orchestrierung
    WHEN Schema-Fetches parallel laufen
    THEN sind maximal 5 Requests gleichzeitig aktiv (Concurrency-Limit)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `lib/services/__tests__/model-sync-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelSyncService.syncAll', () => {
  // AC-1: Deduplizierung ueber replicate_id
  it.todo('should deduplicate models across 3 collections by replicate_id')

  // AC-2: Delta-Sync — unveraenderter version_hash -> kein Schema-Re-Fetch
  it.todo('should skip schema fetch when version_hash is unchanged')

  // AC-3: Delta-Sync — veraenderter version_hash -> Schema-Fetch + Update
  it.todo('should fetch schema and update model when version_hash changed')

  // AC-4: Soft-Delete — Models nicht mehr in Collections
  it.todo('should deactivate models not present in any collection')

  // AC-5: Partial Success — einzelne Model-Fehler werden uebersprungen
  it.todo('should skip failed models and continue syncing remaining ones')

  // AC-6: Progress-Callback wird mit (completed, total) aufgerufen
  it.todo('should call onProgress with completed and total after each model')

  // AC-10: Concurrency-Limit bei Schema-Fetches
  it.todo('should not exceed 5 concurrent schema fetch requests')
})

describe('queries: upsertModel', () => {
  // AC-7: INSERT bei neuem Model
  it.todo('should insert new model via onConflictDoUpdate on replicate_id')

  // AC-8: UPDATE bei bestehendem Model
  it.todo('should update existing model and set updated_at to current time')
})

describe('queries: deactivateModelsNotIn', () => {
  // AC-9: Soft-Delete fuer nicht-gelistete Models
  it.todo('should set is_active to false for models not in the provided replicate_id list')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema` | `models` Table Export | Drizzle PgTable | Import `models` from `lib/db/schema` kompiliert |
| `slice-02-capability-detection` | `detectCapabilities` | Pure Function | `(schema, description, collections) => Capabilities` aufrufbar |
| `slice-02-capability-detection` | `resolveSchemaRefs` | Pure Function | `(properties, allSchemas) => SchemaProperties` aufrufbar |
| `slice-03-catalog-service` | `getModelByReplicateId` | Query Function | `(replicateId: string) => Promise<Model \| null>` fuer version_hash-Vergleich |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelSyncService.syncAll` | Service Method | Route Handler (`app/api/models/sync/route.ts`) | `(onProgress: (completed: number, total: number) => void) => Promise<SyncResult>` |
| `SyncResult` | Type Export | Route Handler | `{ synced: number; failed: number; new: number; updated: number }` |
| `upsertModel` | Query Function | `ModelSyncService` (intern) | `(data: ModelUpsertData) => Promise<void>` |
| `deactivateModelsNotIn` | Query Function | `ModelSyncService` (intern) | `(activeReplicateIds: string[]) => Promise<void>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/model-sync-service.ts` — NEU: `ModelSyncService` mit `syncAll(onProgress)` — Bulk-Sync-Orchestrierung (Collection-Fetch, Dedup, Schema-Fetch, Capability-Detection, Upsert, Soft-Delete, Delta-Sync)
- [ ] `lib/db/queries.ts` — MODIFY: Neue Query-Funktionen `upsertModel()` und `deactivateModelsNotIn()` hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions, KEIN Route Handler, KEINE UI-Aenderungen
- KEINE Aenderung an bestehenden Query-Funktionen in `queries.ts`
- KEIN On-the-fly Schema-Fetch (kommt via Server Action in spaeteren Slices)
- KEINE Aenderung an `model-catalog-service.ts` oder `capability-detection.ts`

**Technische Constraints:**
- `ModelSyncService` als `export const ModelSyncService = { syncAll }` (bestehendes Service-Object-Pattern)
- Replicate Collections API: `GET /v1/collections/{slug}` fuer 3 Slugs: `text-to-image`, `image-editing`, `super-resolution`
- Replicate Models API: `GET /v1/models/{owner}/{name}` fuer Schema + `latest_version.id`
- Schema-Extraktion: `latest_version.openapi_schema.components.schemas.Input.properties`
- `allSchemas` fuer `resolveSchemaRefs`: `latest_version.openapi_schema.components.schemas`
- Concurrency-Limit: Max 5 parallele Schema-Requests (Queue-based Slot-System)
- `upsertModel`: Drizzle `onConflictDoUpdate` auf `replicate_id` (UNIQUE)
- `deactivateModelsNotIn`: Drizzle `UPDATE models SET is_active = false WHERE replicate_id NOT IN (...) AND is_active = true`
- `SyncResult` Typ: `{ synced: number; failed: number; new: number; updated: number }`
- `collections`-Feld pro Model: Array der Collection-Slugs in denen das Model vorkommt (Merge bei Duplikaten)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/capability-detection.ts` | Import `detectCapabilities` + `resolveSchemaRefs` — aufrufen, NICHT neu implementieren |
| `lib/db/queries.ts` | MODIFY — Neue Funktionen `upsertModel`, `deactivateModelsNotIn` nach bestehendem Pattern hinzufuegen |
| `lib/db/schema.ts` | Import — `models` Table-Definition (NICHT aendern) |
| `lib/db/index.ts` | Import — `db`-Instanz fuer Queries (bestehend, unveraendert) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Server Logic" → "ModelSyncService Flow" (Sync-Ablauf 1-5)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Constraints & Integrations" → Concurrency-Limit, Dedup, Delta-Sync
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Error Handling Strategy" → Partial Success, Skip-on-Failure
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Migration Map" → `lib/services/model-sync-service.ts` + `lib/db/queries.ts`
