# Slice 1: DB Schema & Migration fuer Models-Tabelle

> **Slice 1 von 3** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema` |
| **Test** | `pnpm test lib/db/__tests__/models-schema.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/models-schema.test.ts` |
| **Integration Command** | `pnpm drizzle-kit generate` |
| **Acceptance Command** | `pnpm drizzle-kit generate --dry-run` (keine neuen Aenderungen = Schema konsistent) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Drizzle-Schema fuer die neue `models`-Tabelle definieren und die zugehoerige SQL-Migration generieren lassen. Diese Tabelle ist das Fundament fuer den gesamten Model Catalog — alle nachfolgenden Slices (Sync-Service, UI) bauen darauf auf.

---

## Acceptance Criteria

1) GIVEN die Datei `lib/db/schema.ts` existiert mit 12 bestehenden Tabellen
   WHEN der Implementer die `models`-Table-Definition hinzufuegt
   THEN enthaelt `schema.ts` einen exportierten `models`-pgTable mit exakt 15 Spalten gemaess architecture.md → Section "Schema Details: models Table"

2) GIVEN die `models`-Table-Definition in `schema.ts`
   WHEN `typeof models.$inferSelect` evaluiert wird
   THEN ist der inferierte Typ ein gueltiges TypeScript-Interface mit allen 15 Feldern und korrekten Typen (uuid → string, jsonb → unknown, varchar → string, text → string | null, boolean → boolean, timestamp → Date, text[] → string[], integer → number | null)

3) GIVEN die `models`-Table-Definition enthaelt `replicate_id` als varchar(255) NOT NULL
   WHEN die Index-Definition geprueft wird
   THEN existiert ein `uniqueIndex` auf `replicate_id`

4) GIVEN die `models`-Table-Definition enthaelt `is_active` als boolean NOT NULL default true
   WHEN die Index-Definition geprueft wird
   THEN existiert ein `index` auf `is_active`

5) GIVEN `schema.ts` enthaelt die vollstaendige `models`-Definition
   WHEN `drizzle-kit generate` ausgefuehrt wird
   THEN wird eine Migrationsdatei `drizzle/0011_add_models_table.sql` erzeugt ohne Fehler

6) GIVEN die generierte Migrationsdatei `drizzle/0011_add_models_table.sql`
   WHEN der SQL-Inhalt geprueft wird
   THEN enthaelt sie ein `CREATE TABLE "models"` Statement mit allen 15 Spalten, `gen_random_uuid()` als PK-Default, einem `UNIQUE`-Constraint auf `replicate_id`, und Indexes auf `replicate_id` (unique) und `is_active`

7) GIVEN die `models`-Table-Definition
   WHEN die `capabilities`-Spalte geprueft wird
   THEN ist sie als `jsonb` NOT NULL definiert (kein Default-Wert, da der Sync-Service den Wert immer explizit setzt)

8) GIVEN die `models`-Table-Definition
   WHEN die `collections`-Spalte geprueft wird
   THEN ist sie als `text` Array (Postgres `text[]`) und nullable definiert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `lib/db/__tests__/models-schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('models table schema', () => {
  // AC-1: Schema export mit 15 Spalten
  it.todo('should export models table with all 15 columns from architecture spec')

  // AC-2: Inferred select type mit 15 Feldern
  it.todo('should infer correct TypeScript types from models.$inferSelect')

  // AC-3: uniqueIndex auf replicate_id
  it.todo('should define uniqueIndex on replicate_id column')

  // AC-4: index auf is_active
  it.todo('should define index on is_active column')

  // AC-7: capabilities als jsonb NOT NULL
  it.todo('should define capabilities as jsonb NOT NULL without default')

  // AC-8: collections als text array nullable
  it.todo('should define collections as nullable text array')
})
```
</test_spec>

> **Hinweis:** AC-5 und AC-6 (Migration-Generierung und SQL-Inhalt) werden via CLI-Ausfuehrung von `drizzle-kit generate` validiert, nicht ueber Unit-Tests.

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Erster Slice, keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `models` | Drizzle Table Export | `slice-02-sync-service` | `export const models: PgTable` |
| `typeof models.$inferSelect` | Inferred Type | `slice-02-sync-service`, `slice-03-ui` | TypeScript-Typ fuer DB-Reads |
| `typeof models.$inferInsert` | Inferred Type | `slice-02-sync-service` | TypeScript-Typ fuer DB-Writes (Upsert) |
| `0011_add_models_table.sql` | SQL Migration | Runtime (DB) | `CREATE TABLE "models"` mit Indexes |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — MODIFY: Neue `models`-Table-Definition hinzufuegen (nach bestehenden Tabellen)
- [ ] `drizzle/0011_add_models_table.sql` — NEW: Generiert via `drizzle-kit generate` (nicht manuell geschrieben)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Sync-Service, KEINE Server Actions, KEINE UI-Aenderungen
- KEIN Seeding von Daten in die `models`-Tabelle
- KEINE Aenderungen an bestehenden Tabellen (insbesondere `model_settings` bleibt unveraendert)
- KEINE Query-Funktionen in `lib/db/queries.ts` (kommt in Slice 2)

**Technische Constraints:**
- Drizzle ORM Pattern: `pgTable("models", { columns }, (table) => [indexes])` — identisch zum bestehenden Pattern in `schema.ts`
- uuid PK mit `gen_random_uuid()` Default
- Timestamps mit `{ withTimezone: true }` und `.defaultNow()`
- Migration-Index muss 0011 sein (naechste nach 0010_add_assistant_tables.sql)
- Migration wird generiert via `drizzle-kit generate`, NICHT manuell geschrieben
- `collections`-Spalte: `text("collections").array()` fuer Postgres `text[]`

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/schema.ts` | MODIFY — bestehende Imports (`pgTable`, `uuid`, `varchar`, `text`, `timestamp`, `jsonb`, `boolean`, `integer`, `index`, `uniqueIndex`) wiederverwenden. Neue `models`-Definition nach `modelSettings` einfuegen |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Database Schema" → "Schema Details: models Table" (Spalten, Typen, Constraints, Indexes)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Drizzle Schema Pattern" (pgTable-Konvention)
