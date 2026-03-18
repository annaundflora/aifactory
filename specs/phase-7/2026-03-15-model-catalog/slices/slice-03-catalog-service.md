# Slice 3: Model Catalog Service (DB Reads)

> **Slice 3 von 3** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-catalog-service` |
| **Test** | `pnpm test lib/services/__tests__/model-catalog-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/model-catalog-service.test.ts` |
| **Integration Command** | — (DB-Reads via gemockte DB, keine Live-DB noetig) |
| **Acceptance Command** | `pnpm test lib/services/__tests__/model-catalog-service.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (DB-Modul wird gemockt) |

---

## Ziel

Read-only Service-Schicht fuer Model-Daten aus der `models`-Tabelle. Der `ModelCatalogService` und die zugehoerigen Query-Funktionen in `queries.ts` ersetzen die bisherigen In-Memory-Cache-Reads aus `collection-model-service.ts`. Alle Reads filtern auf `is_active = true`.

---

## Acceptance Criteria

1) GIVEN die `models`-Tabelle enthaelt 5 aktive Models (is_active = true) und 2 inaktive (is_active = false)
   WHEN `getActiveModels()` aufgerufen wird
   THEN werden exakt 5 Models zurueckgegeben, keines mit `is_active = false`

2) GIVEN die `models`-Tabelle enthaelt 3 Models mit `capabilities.txt2img = true` und 2 Models mit `capabilities.txt2img = false`, alle `is_active = true`
   WHEN `getModelsByCapability("txt2img")` aufgerufen wird
   THEN werden exakt 3 Models zurueckgegeben, jedes hat `capabilities.txt2img = true`

3) GIVEN die `models`-Tabelle enthaelt ein Model mit `capabilities.img2img = true` und `is_active = false`
   WHEN `getModelsByCapability("img2img")` aufgerufen wird
   THEN wird dieses Model NICHT zurueckgegeben (is_active-Filter greift)

4) GIVEN die `models`-Tabelle enthaelt ein Model mit `replicate_id = "black-forest-labs/flux-2-pro"` und `is_active = true`
   WHEN `getModelByReplicateId("black-forest-labs/flux-2-pro")` aufgerufen wird
   THEN wird exakt dieses Model zurueckgegeben (Typ: `Model`)

5) GIVEN die `models`-Tabelle enthaelt KEIN Model mit `replicate_id = "nonexistent/model"`
   WHEN `getModelByReplicateId("nonexistent/model")` aufgerufen wird
   THEN wird `null` zurueckgegeben (kein Error)

6) GIVEN die `models`-Tabelle enthaelt ein Model mit `replicate_id = "owner/name"` und `input_schema = { "prompt": { "type": "string" } }`
   WHEN `getModelSchema("owner/name")` aufgerufen wird
   THEN wird `{ prompt: { type: "string" } }` als JSONB-Objekt zurueckgegeben

7) GIVEN die `models`-Tabelle enthaelt ein Model mit `replicate_id = "owner/name"` und `input_schema = null`
   WHEN `getModelSchema("owner/name")` aufgerufen wird
   THEN wird `null` zurueckgegeben

8) GIVEN die `models`-Tabelle enthaelt ein inaktives Model mit `replicate_id = "owner/inactive"` und `is_active = false`
   WHEN `getModelByReplicateId("owner/inactive")` aufgerufen wird
   THEN wird `null` zurueckgegeben (is_active-Filter greift auch bei Einzelabfrage)

9) GIVEN der `ModelCatalogService` wird als const-Objekt exportiert
   WHEN `ModelCatalogService.getByCapability("txt2img")` aufgerufen wird
   THEN delegiert er an die Query-Funktion `getModelsByCapability` und gibt das Ergebnis zurueck

10) GIVEN der inferred `Model`-Typ aus `models.$inferSelect`
    WHEN Query-Funktionen Models zurueckgeben
    THEN entspricht jedes Objekt dem `Model`-Typ (wird via TypeScript-Compiler validiert)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `lib/services/__tests__/model-catalog-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('queries: getActiveModels', () => {
  // AC-1: Nur aktive Models zurueckgeben
  it.todo('should return only models with is_active = true')
})

describe('queries: getModelsByCapability', () => {
  // AC-2: Capability-Filter txt2img
  it.todo('should return only models where capabilities.txt2img = true')

  // AC-3: Inaktive Models trotz Capability ausschliessen
  it.todo('should exclude inactive models even if capability matches')
})

describe('queries: getModelByReplicateId', () => {
  // AC-4: Existierendes aktives Model finden
  it.todo('should return the model matching the given replicate_id')

  // AC-5: Null bei nicht existierendem Model
  it.todo('should return null when no model matches the replicate_id')

  // AC-8: Null bei inaktivem Model
  it.todo('should return null for inactive model even if replicate_id matches')
})

describe('queries: getModelSchema', () => {
  // AC-6: input_schema als JSONB zurueckgeben
  it.todo('should return the input_schema for the given replicate_id')

  // AC-7: Null wenn input_schema null ist
  it.todo('should return null when model has no input_schema')
})

describe('ModelCatalogService', () => {
  // AC-9: Delegation an Query-Funktionen
  it.todo('should delegate getByCapability to getModelsByCapability query function')

  // AC-10: Type-Safety (compile-time check)
  it.todo('should return objects conforming to Model type from schema')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema` | `models` Table Export | Drizzle PgTable | Import `models` from `lib/db/schema` kompiliert |
| `slice-01-db-schema` | `typeof models.$inferSelect` | Inferred Type | TypeScript-Compiler validiert Feld-Zugriffe |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getActiveModels` | Query Function | Server Actions (`app/actions/models.ts`) | `() => Promise<Model[]>` |
| `getModelsByCapability` | Query Function | Server Actions, `ModelCatalogService` | `(capability: string) => Promise<Model[]>` |
| `getModelByReplicateId` | Query Function | Server Actions, Sync-Service | `(replicateId: string) => Promise<Model \| null>` |
| `getModelSchema` | Query Function | Server Actions, `useModelSchema` hook | `(replicateId: string) => Promise<unknown \| null>` |
| `ModelCatalogService` | Service Object | Server Actions | Const-Object mit `getByCapability`, `getByReplicateId`, `getSchema`, `getAll` |
| `Model` | Type Export | Alle Consumers | `typeof models.$inferSelect` (re-export aus queries.ts) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/model-catalog-service.ts` — NEU: Const-Object `ModelCatalogService` mit read-only Methoden, delegiert an Query-Funktionen
- [ ] `lib/db/queries.ts` — MODIFY: Neue Query-Funktionen `getActiveModels`, `getModelsByCapability`, `getModelByReplicateId`, `getModelSchema` + `Model` Type-Export hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Sync-Service, KEINE Write-Operationen (kein upsert, kein deactivate)
- KEINE Server Actions (kommen in einem spaeteren Slice)
- KEINE UI-Aenderungen
- KEIN On-the-fly Schema-Fetch von Replicate API (kommt in Server Action / Sync-Service)
- KEINE Aenderung an bestehenden Query-Funktionen in `queries.ts`

**Technische Constraints:**
- Drizzle ORM fuer alle Queries (kein raw SQL)
- JSONB-Capability-Filter via `sql` Template-Tag: `capabilities->>'txt2img' = 'true'`
- `ModelCatalogService` als `export const ModelCatalogService = { ... }` (bestehendes Service-Object-Pattern)
- Alle Query-Funktionen als standalone `export async function` (bestehendes queries.ts Pattern)
- `Model` Type als `typeof models.$inferSelect` (kein manuelles Interface)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/queries.ts` | MODIFY — Neue Query-Funktionen nach bestehendem Pattern (standalone async function exports) hinzufuegen. `models`-Import aus `schema.ts` ergaenzen |
| `lib/db/schema.ts` | Import — `models` Table-Definition aus Slice 1 importieren (NICHT aendern) |
| `lib/db/index.ts` | Import — `db`-Instanz fuer Queries (bestehend, unverändert) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Server Logic" → `ModelCatalogService` Beschreibung
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Architecture Layers" → "DB Queries" und "Read Flow"
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Migration Map" → `lib/db/queries.ts` Zeile (neue Query-Funktionen)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Database Schema" → `models` Table fuer JSONB-Abfrage-Syntax
