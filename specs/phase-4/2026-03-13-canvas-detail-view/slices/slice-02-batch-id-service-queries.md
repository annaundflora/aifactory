# Slice 2: batchId in GenerationService + Queries

> **Slice 2 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-batch-id-service-queries` |
| **Test** | `pnpm test lib/db/__tests__/queries-batch.test.ts lib/services/__tests__/generation-service-batch.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-batch-id"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/queries-batch.test.ts lib/services/__tests__/generation-service-batch.test.ts` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test lib/db/__tests__/queries-batch.test.ts lib/services/__tests__/generation-service-batch.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`GenerationService.generate()` um eine shared batchId (UUID) pro Request erweitern, damit alle Bilder eines Generation-Requests gruppiert werden koennen. Neue Query `getSiblingsByBatchId()` fuer Sibling-Abfragen. Grundlage fuer Sibling-Navigation in der Canvas-Detail-View.

---

## Acceptance Criteria

1) GIVEN `CreateGenerationInput` in `lib/db/queries.ts`
   WHEN der Typ geprueft wird
   THEN enthaelt er ein optionales Feld `batchId?: string`

2) GIVEN ein `CreateGenerationInput` mit `batchId: "550e8400-e29b-41d4-a716-446655440000"`
   WHEN `createGeneration(input)` aufgerufen wird
   THEN enthaelt die zurueckgegebene `Generation` das Feld `batchId` mit dem Wert `"550e8400-e29b-41d4-a716-446655440000"`

3) GIVEN ein `CreateGenerationInput` ohne `batchId`-Feld
   WHEN `createGeneration(input)` aufgerufen wird
   THEN enthaelt die zurueckgegebene `Generation` das Feld `batchId` mit dem Wert `null`

4) GIVEN `GenerationService.generate()` wird mit `count: 3` und einem einzelnen Model aufgerufen
   WHEN die 3 pending Generations erstellt werden
   THEN haben alle 3 Rows denselben `batchId`-Wert (ein gueltiger UUID v4)

5) GIVEN `GenerationService.generate()` wird mit `modelIds: ["model/a", "model/b"]` (Multi-Model) aufgerufen
   WHEN die 2 pending Generations erstellt werden
   THEN haben beide Rows denselben `batchId`-Wert (ein gueltiger UUID v4)

6) GIVEN 3 completed Generations mit `batchId = "aaa-bbb-ccc"` und 2 Generations mit `batchId = "xxx-yyy-zzz"` in der DB
   WHEN `getSiblingsByBatchId("aaa-bbb-ccc")` aufgerufen wird
   THEN werden genau 3 Generations zurueckgegeben, sortiert nach `createdAt ASC`

7) GIVEN 2 Generations mit `batchId = "aaa-bbb-ccc"`, davon eine mit `status: "completed"` und eine mit `status: "failed"`
   WHEN `getSiblingsByBatchId("aaa-bbb-ccc")` aufgerufen wird
   THEN wird nur die Generation mit `status: "completed"` zurueckgegeben

8) GIVEN keine Generations mit `batchId = "nonexistent-id"` in der DB
   WHEN `getSiblingsByBatchId("nonexistent-id")` aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben

9) GIVEN Generations mit `batchId = null` in der DB
   WHEN `getSiblingsByBatchId(null)` aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben (kein Matching auf NULL-Werte)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/queries-batch.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CreateGenerationInput — batchId field', () => {
  // AC-1: CreateGenerationInput hat optionales batchId-Feld
  it.todo('should accept batchId as optional string field in CreateGenerationInput')

  // AC-2: createGeneration speichert batchId korrekt
  it.todo('should persist batchId value when provided in CreateGenerationInput')

  // AC-3: createGeneration defaultet batchId auf null
  it.todo('should default batchId to null when not provided in CreateGenerationInput')
})

describe('getSiblingsByBatchId', () => {
  // AC-6: Korrekte Siblings nach batchId gefiltert und sortiert
  it.todo('should return all completed generations with matching batchId sorted by createdAt ASC')

  // AC-7: Nur completed Generations zurueckgeben
  it.todo('should exclude non-completed generations from sibling results')

  // AC-8: Leeres Array bei nicht-existierender batchId
  it.todo('should return empty array when no generations match the given batchId')

  // AC-9: Leeres Array bei null batchId
  it.todo('should return empty array when batchId is null')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/generation-service-batch.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationService.generate — batchId assignment', () => {
  // AC-4: Single-Model Batch — gleiche batchId fuer alle Rows
  it.todo('should assign the same UUID batchId to all generations in a single-model batch')

  // AC-5: Multi-Model Batch — gleiche batchId fuer alle Rows
  it.todo('should assign the same UUID batchId to all generations in a multi-model batch')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-batch-id` | `generations.batchId` | Schema Column | Column existiert im Drizzle-Schema als nullable UUID |
| `slice-01-db-schema-batch-id` | `generations_batch_id_idx` | DB Index | Index existiert fuer performante WHERE-Queries |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CreateGenerationInput.batchId` | Type Extension | interne Nutzung | `batchId?: string` in `CreateGenerationInput` |
| `getSiblingsByBatchId()` | Query Function | `slice-04-siblings-action` | `(batchId: string \| null) => Promise<Generation[]>` |
| `GenerationService.generate()` (batchId) | Service Enhancement | alle nachfolgenden Slices | Automatische batchId-Zuweisung pro Request, keine API-Aenderung |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` — `CreateGenerationInput` um `batchId?: string` erweitern, `createGeneration()` um batchId-Mapping ergaenzen, neue Query `getSiblingsByBatchId()` hinzufuegen
- [ ] `lib/services/generation-service.ts` — In `generate()` eine shared UUID pro Request erzeugen und an alle `createGeneration()`-Aufrufe weitergeben
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Action aendern (das ist Slice 4)
- KEINE UI-Komponenten aendern
- KEINE neuen API-Routen erstellen
- `getSiblingsByBatchId()` liefert NUR `completed` Generations (nicht pending/failed)
- `getSiblingsByBatchId(null)` muss ein leeres Array liefern, KEIN Matching auf NULL-Werte

**Technische Constraints:**
- UUID-Generierung via `crypto.randomUUID()` (Node.js built-in, kein externes Package)
- Drizzle ORM fuer Queries (kein raw SQL fuer `getSiblingsByBatchId`)
- `getSiblingsByBatchId()` Query: `WHERE batch_id = :batchId AND status = 'completed' ORDER BY created_at ASC`
- batchId-Generierung geschieht einmalig am Anfang von `generate()`, wird an alle `createGeneration()`-Aufrufe im selben Request durchgereicht

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Database Schema" (Backfill-Strategie, Relationships)
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Server Logic" (GenerationService.generate mit batchId)
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "API Design" (getSiblingGenerations Endpoint)
- Bestehender Code: `lib/db/queries.ts` → `CreateGenerationInput` (Zeile 67-78), `createGeneration()` (Zeile 80-97)
- Bestehender Code: `lib/services/generation-service.ts` → `generate()` (Zeile 309-462), Multi-Model-Branch (Zeile 393-426), Single-Model-Branch (Zeile 428-462)
