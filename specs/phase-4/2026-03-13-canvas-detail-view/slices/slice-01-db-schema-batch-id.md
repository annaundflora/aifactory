# Slice 1: DB Schema — batchId Column

> **Slice 1 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema-batch-id` |
| **Test** | `pnpm test lib/db/__tests__/schema.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/schema.test.ts` |
| **Integration Command** | `pnpm drizzle-kit generate` |
| **Acceptance Command** | `pnpm drizzle-kit generate --dry-run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Nullable UUID-Feld `batch_id` zur `generations`-Tabelle hinzufuegen, um Bilder einer gemeinsamen Generierungs-Anfrage (Batch) zu gruppieren. Dies ist die Grundlage fuer Sibling-Navigation in der Canvas-Detail-View.

---

## Acceptance Criteria

1) GIVEN das aktuelle Drizzle-Schema in `lib/db/schema.ts`
   WHEN der Entwickler das Feld `batchId` zur `generations`-Tabelle hinzufuegt
   THEN enthaelt die Tabellendefinition ein Feld `batchId: uuid("batch_id")` das nullable ist und `DEFAULT NULL` hat

2) GIVEN die aktualisierte `generations`-Tabelle mit `batchId`-Feld
   WHEN die Index-Definitionen der Tabelle geprueft werden
   THEN existiert ein Index `generations_batch_id_idx` auf der Spalte `batch_id`

3) GIVEN das aktualisierte Schema
   WHEN `pnpm drizzle-kit generate` ausgefuehrt wird
   THEN wird eine SQL-Migrationsdatei in `drizzle/` erzeugt die `ALTER TABLE generations ADD COLUMN batch_id UUID DEFAULT NULL` und `CREATE INDEX generations_batch_id_idx ON generations (batch_id)` enthaelt

4) GIVEN das aktualisierte Schema
   WHEN der TypeScript-Typ der `generations`-Tabelle inferiert wird (`typeof generations.$inferSelect`)
   THEN enthaelt der Typ ein Feld `batchId` vom Typ `string | null`

5) GIVEN bestehende Rows in der `generations`-Tabelle ohne `batch_id`-Wert
   WHEN die Migration angewendet wird
   THEN haben alle bestehenden Rows den Wert `NULL` fuer `batch_id` (kein Backfill noetig)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generations schema — batchId column', () => {
  // AC-1: batchId Feld existiert und ist nullable UUID mit DEFAULT NULL
  it.todo('should have a nullable uuid batchId column on generations table')

  // AC-2: Index auf batch_id existiert
  it.todo('should define generations_batch_id_idx index on batch_id column')

  // AC-3: Migration-Datei mit korrektem ALTER TABLE und CREATE INDEX SQL
  it.todo('should generate migration with ALTER TABLE ADD COLUMN batch_id and CREATE INDEX')

  // AC-4: Inferierter Typ enthaelt batchId als string | null
  it.todo('should infer batchId as string | null in Generation select type')

  // AC-5: Bestehende Rows defaulten auf NULL nach Migration
  it.todo('should default existing rows to NULL for batch_id after migration')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Erster Slice, keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generations.batchId` | Schema Column | `slice-02-batch-id-service` | `uuid("batch_id")` — nullable UUID-Spalte in `generations`-Tabelle |
| `generations_batch_id_idx` | DB Index | `slice-02-batch-id-service` | Index fuer performante `WHERE batch_id = :id`-Queries |
| `Generation["batchId"]` | TypeScript Type | `slice-02-batch-id-service`, `slice-04-siblings-action` | `batchId: string \| null` im inferierten Select-Typ |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — `batchId` Column + `generations_batch_id_idx` Index zur `generations`-Tabelle hinzufuegen
- [ ] `drizzle/XXXX_add_batch_id.sql` — Generierte Migration via `pnpm drizzle-kit generate`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Backfill bestehender Daten (bestehende Rows bleiben `batch_id = NULL`)
- KEINE Aenderung an `CreateGenerationInput` oder Query-Funktionen (das ist Slice 2)
- KEINE Foreign-Key-Constraint auf `batch_id` (Self-Grouping, kein FK — siehe architecture.md Relationships)
- KEINE Aenderungen an anderen Tabellen

**Technische Constraints:**
- Drizzle ORM `^0.45.1` fuer Schema-Definition (kein raw SQL im Schema)
- `drizzle-kit ^0.31.9` fuer Migration-Generierung
- Migration muss idempotent bezueglich bestehender Daten sein (DEFAULT NULL)
- Column-Definition: `uuid("batch_id")` (snake_case in DB, camelCase in Drizzle)

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Database Schema" (Schema Details — New Column, Migration)
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Database Schema" (Relationships: Self-Grouping, no FK)
- Bestehendes Schema-Pattern: `lib/db/schema.ts` → `generations`-Tabelle (Index-Pattern in Zeile 78-87)
