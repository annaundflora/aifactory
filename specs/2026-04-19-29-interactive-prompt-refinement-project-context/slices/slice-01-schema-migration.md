# Slice 01: Schema Migration für Project-Context

> **Slice 01 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-schema-migration` |
| **Test** | `pnpm drizzle-kit migrate` (up) + manuelles Down-Verify (siehe AC-3) |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js + Drizzle ORM. Schema-Slice hat KEINE Vitest-Tests; Verifikation erfolgt über `drizzle-kit`-CLI + Postgres-Introspektion.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + drizzle-orm` |
| **Test Command** | `pnpm drizzle-kit generate --name=add_project_context` (Diff-Check: erwartet leeren Diff, Migration bereits committed) |
| **Integration Command** | `pnpm drizzle-kit migrate` (up) |
| **Acceptance Command** | `psql $DATABASE_URL -c "\\d projects"` (Spalten sichtbar) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a (kein Runtime-Endpoint in diesem Slice) |
| **Mocking Strategy** | `no_mocks` (echte Postgres-Datenbank via `DATABASE_URL`) |

---

## Ziel

Erweitere die `projects`-Tabelle um zwei nullable Spalten (`context_instructions`, `context_updated_at`), damit Folge-Slices (02–11) Project-Context lesen/schreiben und in den Assistant-System-Prompt injizieren können. Dieser Slice ist reines Schema-Fundament — keine API, kein UI, keine Logik.

---

## Acceptance Criteria

1) **GIVEN** das aktuelle `projects`-Drizzle-Schema (siehe architecture.md → Section "Migration Map" → Zeile `lib/db/schema.ts`)
   **WHEN** `lib/db/schema.ts` um zwei neue Felder ergänzt wird
   **THEN** die `projects`-Definition enthält genau die Felder `contextInstructions` (Drizzle `text("context_instructions")`, nullable) und `contextUpdatedAt` (Drizzle `timestamp("context_updated_at", { withTimezone: true })`, nullable) — Spalten-Namen, Typen und Nullability MÜSSEN architecture.md → Section "Schema Details — Migration `drizzle/0015_add_project_context.sql`" exakt entsprechen.

2) **GIVEN** das aktualisierte Schema
   **WHEN** `pnpm drizzle-kit generate --name=add_project_context` ausgeführt wird
   **THEN** zwei neue Dateien werden erzeugt: `drizzle/0015_add_project_context.sql` und `drizzle/meta/0015_snapshot.json`; die SQL-Datei enthält die Statements aus architecture.md Section "Schema Details" (ALTER TABLE `projects` ADD COLUMN für beide Spalten); `drizzle/meta/_journal.json` listet `0015` als jüngsten Eintrag.

3) **GIVEN** eine Postgres-Datenbank im Migrations-Stand `0014`
   **WHEN** `pnpm drizzle-kit migrate` ausgeführt wird
   **THEN** die Migration `0015_add_project_context` läuft fehlerfrei durch (Exit-Code 0); `psql -c "\\d projects"` zeigt beide Spalten mit Typ `text` bzw. `timestamp with time zone`, jeweils `NULL`-erlaubt; bestehende `projects`-Zeilen sind unverändert (Row-Count vor/nach identisch, alte Spalten unverändert).

4) **GIVEN** eine Datenbank mit angewendeter `0015`-Migration
   **WHEN** Down-Verifikation per Roll-Back-SQL gefahren wird (`ALTER TABLE projects DROP COLUMN context_instructions, DROP COLUMN context_updated_at`)
   **THEN** die Tabelle kehrt zum `0014`-Zustand zurück, ohne Daten in anderen Spalten zu verlieren; Re-Apply der Migration funktioniert erneut idempotent (Up→Down→Up läuft fehlerfrei).

5) **GIVEN** TypeScript-Compilation in einem Consumer-Modul, das `db.select().from(projects)` aufruft
   **WHEN** `pnpm tsc --noEmit` läuft
   **THEN** `typeof projects.$inferSelect` enthält die Felder `contextInstructions: string | null` und `contextUpdatedAt: Date | null`; keine TS-Errors in bestehenden Query-Helpers (`lib/db/queries.ts`).

---

## Test Skeletons

> **Hinweis für Test-Writer:** Schema-Migrations werden nicht über Vitest geprüft, sondern über `drizzle-kit`-CLI und Postgres-Introspektion. Skeletons unten sind Verifikations-Skripte, KEINE Unit-Tests. Test-Writer kann sie als Shell-/Bash-Checks oder Vitest-Integration-Test mit echtem DB-Connection umsetzen — Entscheidung folgt der Repo-Konvention.

### Verifikations-Datei: `drizzle/0015_add_project_context.sql` (Inhaltsprüfung)

<test_spec>
```typescript
// AC-2: Migration-Datei wurde via drizzle-kit generate erzeugt
it.todo('migration file 0015_add_project_context.sql exists with expected ALTER TABLE statements')

// AC-2: Snapshot + Journal aktualisiert
it.todo('drizzle/meta/0015_snapshot.json exists and _journal.json lists 0015 as latest')
```
</test_spec>

### Verifikations-Datei: `lib/db/__tests__/schema.test.ts` (Type-Check + Schema-Shape)

<test_spec>
```typescript
// AC-1: Schema enthält neue Spalten mit korrekten Typen
it.todo('projects schema declares contextInstructions as nullable text column')
it.todo('projects schema declares contextUpdatedAt as nullable timestamptz column')

// AC-5: $inferSelect-Type enthält neue Felder
it.todo('typeof projects.$inferSelect includes contextInstructions: string | null and contextUpdatedAt: Date | null')
```
</test_spec>

### Verifikations-Skript: `scripts/verify-migration-0015.sh` (Up/Down-Round-Trip)

<test_spec>
```bash
# AC-3: drizzle-kit migrate (up) läuft ohne Fehler und Spalten existieren
# it.todo('pnpm drizzle-kit migrate exits 0 and \\d projects shows both new columns')

# AC-4: Down-Verify (manuelles Roll-Back-SQL) + Re-Apply
# it.todo('rollback SQL drops both columns; re-running 0015 migration succeeds idempotent')
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
| `projects.contextInstructions` | Drizzle column | `slice-02-db-queries-helpers` | `text` column on `projects`, nullable, max 8000 chars (DTO-enforced, nicht DB) |
| `projects.contextUpdatedAt` | Drizzle column | `slice-02-db-queries-helpers`, `slice-06-context-settings-page` (UI-Anzeige "zuletzt geändert") | `timestamp with time zone`, nullable |
| `projects.$inferSelect` (extended) | Drizzle type | alle TS-Consumer (queries, actions, components) | enthält neue Felder als `string \| null` und `Date \| null` |
| Migration `0015_add_project_context` | SQL migration | `slice-05-project-repository-fastapi` (Python liest dieselbe Tabelle via psycopg) | beide Spalten als `text` und `timestamp with time zone` in Postgres `projects` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — Edit: zwei neue Spalten in `projects`-pgTable-Definition (`contextInstructions`, `contextUpdatedAt`), Reihenfolge nach `userId` und vor `createdAt`
- [ ] `drizzle/0015_add_project_context.sql` — NEW: via `pnpm drizzle-kit generate --name=add_project_context` erzeugt, ALTER-TABLE-Statements für beide Spalten
- [ ] `drizzle/meta/0015_snapshot.json` — NEW: vom drizzle-kit erzeugter Snapshot des aktualisierten Schemas
- [ ] `drizzle/meta/_journal.json` — Edit: `0015`-Eintrag automatisch durch `drizzle-kit generate` angehängt
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Query-Helpers (`getProjectContext`, `updateProjectContext`) — gehören zu Slice 02
- KEINE Route-Handlers oder Server-Actions — gehören zu Slice 03/04
- KEINE Validierung der 8000-Zeichen-Grenze auf DB-Ebene (TEXT ohne Length-Constraint, Validierung nur im DTO ab Slice 03)
- KEIN Index auf den neuen Spalten (kein Query-Path rechtfertigt das aktuell — siehe architecture.md Section "Schema Details", "Index: No")
- KEIN Default-Wert für `contextInstructions` (NULL bedeutet "kein Context gesetzt", semantisch unterscheidbar von leerem String)

**Technische Constraints:**
- Drizzle-Kit-Version: `^0.31.9` (siehe package.json) — Migration-Generation MUSS über `pnpm drizzle-kit generate` laufen, NICHT manuell SQL schreiben
- Spaltennamen in Postgres: `context_instructions`, `context_updated_at` (snake_case, MUSS exakt diesem Naming folgen — Backend FastAPI/psycopg liest dieselben Spalten in Slice 05)
- TypeScript-Field-Namen: `contextInstructions`, `contextUpdatedAt` (camelCase, Drizzle-Konvention)
- Beide Spalten MÜSSEN `nullable` sein (kein `.notNull()`); siehe architecture.md → "Schema Details" → "Constraints: NULLABLE"
- Migrationsnummer MUSS `0015` sein (nächste sequenzielle nach `0014_drop_model_slots_active.sql`)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/schema.ts` | Edit — `projects`-pgTable um zwei Spalten erweitern, ALLE bestehenden Felder unverändert lassen (id, name, thumbnailUrl, thumbnailStatus, userId, createdAt, updatedAt, beide bestehenden Indexes) |
| `drizzle.config.ts` | Unverändert nutzen — bestehende Drizzle-Config steuert `generate`-Output ins `drizzle/`-Verzeichnis |
| `drizzle/meta/_journal.json` | Wird automatisch durch `drizzle-kit generate` aktualisiert — NICHT manuell editieren |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Database Schema" / "Schema Details — Migration `drizzle/0015_add_project_context.sql`" (exaktes Ziel-Schema, SQL-Snippet, Begründung TEXT vs VARCHAR)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeile `lib/db/schema.ts` (Slice-A-Attribution) und Zeile `drizzle/0015_add_project_context.sql` (NEW FILE)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Tabelle "Data" (Felder `projects.context_instructions` max 8000, `projects.context_updated_at` für UI-Anzeige)
- Wireframes: nicht relevant für diesen Slice (Schema-only, kein UI)
