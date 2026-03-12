# Slice 2: Reference Image Queries definieren

> **Slice 2 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-reference-queries` |
| **Test** | `pnpm test lib/db/__tests__/queries-references` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest) |
| **Test Command** | `pnpm test lib/db/__tests__/queries-references` |
| **Integration Command** | N/A (Query-Only Slice, Integration via echte DB in Slice 03+) |
| **Acceptance Command** | `pnpm test lib/db/__tests__/queries-references` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Drizzle `db` Instanz mocken, kein echter DB-Zugriff in Unit-Tests) |

---

## Ziel

Fuenf Drizzle-Query-Funktionen fuer die Tabellen `reference_images` und `generation_references` bereitstellen, damit nachfolgende Slices (Service, Actions, UI) auf typsichere CRUD-Operationen zugreifen koennen.

---

## Acceptance Criteria

1) GIVEN ein `createReferenceImage`-Aufruf mit `{ projectId: <UUID>, imageUrl: "https://r2.example/ref.png", sourceType: "upload" }`
   WHEN die Funktion ausgefuehrt wird
   THEN wird ein `INSERT` in `referenceImages` ausgefuehrt und das zurueckgegebene Objekt enthaelt `id` (UUID), `projectId`, `imageUrl`, `sourceType`, `createdAt` (Timestamp) — Type entspricht `typeof referenceImages.$inferSelect`

2) GIVEN ein existierender `reference_images`-Eintrag mit bekannter `id`
   WHEN `deleteReferenceImage(id)` aufgerufen wird
   THEN wird ein `DELETE FROM reference_images WHERE id = <id>` ausgefuehrt und die Funktion resolved ohne Fehler

3) GIVEN zwei `reference_images`-Eintraege fuer `projectId = "proj-A"` und ein Eintrag fuer `projectId = "proj-B"`
   WHEN `getReferenceImagesByProject("proj-A")` aufgerufen wird
   THEN werden genau 2 Eintraege zurueckgegeben, aufsteigend nach `createdAt` sortiert, alle mit `projectId = "proj-A"`

4) GIVEN ein `createGenerationReferences`-Aufruf mit einem Array von 3 Eintraegen `[{ generationId, referenceImageId, role: "style", strength: "strong", slotPosition: 1 }, ...]`
   WHEN die Funktion ausgefuehrt wird
   THEN werden 3 Rows in `generationReferences` per Batch-Insert eingefuegt und die eingefuegten Records zurueckgegeben — jeder mit `id` (UUID), allen Input-Feldern und korrekten Werten

5) GIVEN 2 `generation_references`-Eintraege fuer `generationId = "gen-X"` und 1 Eintrag fuer `generationId = "gen-Y"`
   WHEN `getGenerationReferences("gen-X")` aufgerufen wird
   THEN werden genau 2 Eintraege zurueckgegeben, aufsteigend nach `slotPosition` sortiert, alle mit `generationId = "gen-X"`

6) GIVEN die 5 neuen Funktionen
   WHEN deren Typen inspiziert werden
   THEN exportiert `queries.ts` die Typen `ReferenceImage` (via `typeof referenceImages.$inferSelect`) und `GenerationReference` (via `typeof generationReferences.$inferSelect`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/queries-references.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('createReferenceImage', () => {
  // AC-1: Insert in referenceImages mit korrektem Return-Type
  it.todo('should insert a reference_images row and return the full record with id and createdAt')
})

describe('deleteReferenceImage', () => {
  // AC-2: Delete by id ohne Fehler
  it.todo('should delete the reference_images row by id')
})

describe('getReferenceImagesByProject', () => {
  // AC-3: Filtern nach projectId, sortiert nach createdAt ASC
  it.todo('should return only references for the given projectId ordered by createdAt ascending')
})

describe('createGenerationReferences', () => {
  // AC-4: Batch-Insert mit korrektem Return
  it.todo('should batch-insert multiple generation_references rows and return all inserted records')
})

describe('getGenerationReferences', () => {
  // AC-5: Filtern nach generationId, sortiert nach slotPosition ASC
  it.todo('should return only references for the given generationId ordered by slotPosition ascending')
})

describe('Type Exports', () => {
  // AC-6: ReferenceImage und GenerationReference Types exportiert
  it.todo('should export ReferenceImage and GenerationReference types')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01-db-schema-migration | `referenceImages` | Drizzle Table | Import aus `lib/db/schema` verfuegbar |
| slice-01-db-schema-migration | `generationReferences` | Drizzle Table | Import aus `lib/db/schema` verfuegbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `createReferenceImage` | Async Function | slice-03 (Service), slice-05 (Gallery-as-Ref) | `(input: { projectId, imageUrl, originalFilename?, width?, height?, sourceType, sourceGenerationId? }) => Promise<ReferenceImage>` |
| `deleteReferenceImage` | Async Function | slice-03 (Service) | `(id: string) => Promise<void>` |
| `getReferenceImagesByProject` | Async Function | slice-03 (Service), slice-04 (Action) | `(projectId: string) => Promise<ReferenceImage[]>` |
| `createGenerationReferences` | Async Function | slice-13 (Generation Integration) | `(refs: { generationId, referenceImageId, role, strength, slotPosition }[]) => Promise<GenerationReference[]>` |
| `getGenerationReferences` | Async Function | slice-13 (Generation), slice-15 (Provenance) | `(generationId: string) => Promise<GenerationReference[]>` |
| `ReferenceImage` | Type Export | slice-03, slice-04, slice-07, slice-08 | `typeof referenceImages.$inferSelect` |
| `GenerationReference` | Type Export | slice-13, slice-15 | `typeof generationReferences.$inferSelect` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` — Erweitert: 5 neue Query-Funktionen + 2 Type-Exports fuer reference_images und generation_references
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Business-Logik (Validierung, R2-Upload, MIME-Check) — das ist Slice 03 (Service)
- KEINE Server Actions — das ist Slice 04
- KEINE Aenderungen an bestehenden Query-Funktionen
- KEINE Relations-Definitionen (`relations()`) — nur Query-Funktionen

**Technische Constraints:**
- Nutze Drizzle ORM Query-Pattern konsistent mit bestehenden Funktionen in `lib/db/queries.ts` (select/insert/delete mit `.from()`, `.values()`, `.returning()`)
- Import `referenceImages` und `generationReferences` aus `lib/db/schema`
- Import `db` aus `lib/db/index`
- `getReferenceImagesByProject` sortiert nach `createdAt ASC` (aelteste zuerst, chronologische Reihenfolge)
- `getGenerationReferences` sortiert nach `slotPosition ASC` (Slot-Reihenfolge fuer API-Mapping)
- `createGenerationReferences` nutzt Batch-Insert (ein `db.insert().values([...])` Aufruf, kein Loop)
- `createReferenceImage` akzeptiert optionale Felder `originalFilename`, `width`, `height`, `sourceGenerationId` (nullable in Schema)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` Section "Server Actions" (Zeile 73) + Section "Database Schema" (Zeilen 89-131)
- Query-Pattern: `lib/db/queries.ts` (bestehendes Pattern fuer CRUD-Funktionen)
- Schema-Definition: `lib/db/schema.ts` (Slice 01 Deliverable)
