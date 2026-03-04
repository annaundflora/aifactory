# Slice 1: Docker + DB Schema aufsetzen

> **Slice 1 von 7** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-docker-db-schema` |
| **Test** | `pnpm drizzle-kit generate && pnpm drizzle-kit migrate` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Greenfield) |
| **Test Command** | `pnpm test lib/db/__tests__/schema.test.ts` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate` |
| **Acceptance Command** | `docker compose up -d && pnpm drizzle-kit generate && pnpm drizzle-kit migrate` |
| **Start Command** | `docker compose up -d` |
| **Health Endpoint** | `localhost:5432` (PostgreSQL) |
| **Mocking Strategy** | `test_containers` |

---

## Ziel

PostgreSQL via Docker Compose bereitstellen und das vollstaendige Drizzle ORM Schema fuer alle drei Tabellen (projects, generations, prompt_snippets) definieren. Nach diesem Slice kann jeder nachfolgende Slice sofort mit der Datenbank arbeiten.

---

## Acceptance Criteria

1) GIVEN Docker und Docker Compose sind installiert
   WHEN `docker compose up -d` ausgefuehrt wird
   THEN ein PostgreSQL 16 Container startet und auf Port 5432 erreichbar ist

2) GIVEN der PostgreSQL Container laeuft
   WHEN `npx drizzle-kit generate` ausgefuehrt wird
   THEN wird eine SQL-Migration im `drizzle/` Verzeichnis erzeugt ohne Fehler

3) GIVEN eine Migration wurde generiert
   WHEN `npx drizzle-kit migrate` ausgefuehrt wird
   THEN werden die Tabellen `projects`, `generations`, `prompt_snippets` in der Datenbank erstellt

4) GIVEN die Tabellen existieren
   WHEN die Tabelle `projects` inspiziert wird
   THEN enthaelt sie die Spalten gemaess architecture.md Section "Schema Details" (id UUID PK, name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

5) GIVEN die Tabellen existieren
   WHEN die Tabelle `generations` inspiziert wird
   THEN enthaelt sie alle Spalten gemaess architecture.md Section "Schema Details" inkl. FK `project_id` mit ON DELETE CASCADE, Index auf `project_id`, `status` und `created_at`

6) GIVEN die Tabellen existieren
   WHEN die Tabelle `prompt_snippets` inspiziert wird
   THEN enthaelt sie die Spalten gemaess architecture.md Section "Schema Details" (id UUID PK, text VARCHAR(500), category VARCHAR(100) mit Index, created_at TIMESTAMPTZ)

7) GIVEN drizzle.config.ts existiert
   WHEN die Konfiguration gelesen wird
   THEN referenziert sie `lib/db/schema.ts` als Schema-Quelle und `drizzle/` als Migrations-Verzeichnis und nutzt den `postgresql` Dialect mit DATABASE_URL aus Environment

8) GIVEN docker-compose.yml existiert
   WHEN die Konfiguration gelesen wird
   THEN definiert sie einen PostgreSQL 16 Service mit Volume-Persistenz und konfigurierbaren Credentials via Environment-Variablen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('DB Schema Definition', () => {
  // AC-4: projects Tabelle
  it.todo('should define projects table with id, name, created_at, updated_at columns')

  // AC-5: generations Tabelle
  it.todo('should define generations table with all columns and project_id FK with CASCADE')

  // AC-5: generations Indizes
  it.todo('should define indexes on generations.project_id, generations.status, generations.created_at')

  // AC-6: prompt_snippets Tabelle
  it.todo('should define prompt_snippets table with id, text, category, created_at columns')

  // AC-6: prompt_snippets Index
  it.todo('should define index on prompt_snippets.category')
})
```
</test_spec>

### Test-Datei: `lib/db/__tests__/migration.integration.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('DB Migration Integration', () => {
  // AC-1: Docker PostgreSQL
  it.todo('should connect to PostgreSQL on port 5432')

  // AC-3: Tabellen nach Migration
  it.todo('should have projects table after migration')

  // AC-3: Tabellen nach Migration
  it.todo('should have generations table after migration')

  // AC-3: Tabellen nach Migration
  it.todo('should have prompt_snippets table after migration')

  // AC-5: CASCADE Delete
  it.todo('should cascade delete generations when project is deleted')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Erster Slice, keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `projects` Schema | Drizzle Table | slice-02+ | `projects` table export aus `lib/db/schema.ts` |
| `generations` Schema | Drizzle Table | slice-02+ | `generations` table export aus `lib/db/schema.ts` |
| `promptSnippets` Schema | Drizzle Table | slice-07 | `promptSnippets` table export aus `lib/db/schema.ts` |
| PostgreSQL Container | Docker Service | alle Slices | `docker compose up -d` startet DB |
| Drizzle Config | Config File | alle Slices | `drizzle.config.ts` fuer Migration-Generierung |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `docker-compose.yml` — PostgreSQL 16 Service mit Volume und Environment-Variablen
- [ ] `lib/db/schema.ts` — Drizzle ORM Schema fuer projects, generations, prompt_snippets
- [ ] `drizzle.config.ts` — Drizzle Kit Konfiguration fuer Migrations
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEIN DB Connection Setup (lib/db/index.ts) — kommt in Slice 2
- KEINE Queries (lib/db/queries.ts) — kommt in Slice 2
- KEINE Server Actions — kommt in Slice 2+
- KEINE .env Datei erstellen — wird manuell vom Entwickler angelegt

**Technische Constraints:**
- Drizzle ORM mit postgres.js Driver (nicht node-postgres)
- PostgreSQL 16 Docker Image
- UUID Primary Keys mit `gen_random_uuid()` Default
- TIMESTAMPTZ fuer alle Zeitstempel
- JSONB fuer `generations.model_params`
- Volume-Mount fuer PostgreSQL-Daten-Persistenz

**Referenzen:**
- Architecture: `architecture.md` → Section "Database Schema" (Schema Details, Relationships, Data Type Rationale)
- Architecture: `architecture.md` → Section "Constraints & Integrations" (DATABASE_URL Format)
- Architecture: `architecture.md` → Section "Project Structure" (Dateipfade)
