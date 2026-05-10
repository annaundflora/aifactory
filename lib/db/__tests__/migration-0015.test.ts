import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Acceptance Tests for Slice 01: Schema Migration -- Migration File Inspection
 *
 * Validates the artifacts produced by `pnpm drizzle-kit generate --name=add_project_context`:
 *  - drizzle/0015_add_project_context.sql  (ALTER TABLE statements)
 *  - drizzle/meta/0015_snapshot.json       (Drizzle schema snapshot)
 *  - drizzle/meta/_journal.json            (entry 0015 listed as latest)
 *
 * Source: specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *         slices/slice-01-schema-migration.md
 *
 * Mocking Strategy: no_mocks (file-system inspection only).
 * AC-3 / AC-4 (live Postgres up/down round-trip) are documented as runtime
 * verifications and skipped here because they require a live DB at the
 * 0014 migration state.
 *
 * Coverage:
 *  - AC-2: Migration file + snapshot + journal artifacts present and well-formed
 *  - AC-3: Documented (skipped, runtime-only)
 *  - AC-4: Documented (skipped, runtime-only)
 */

const REPO_ROOT = process.cwd()
const DRIZZLE_DIR = join(REPO_ROOT, 'drizzle')
const MIGRATION_FILE = join(DRIZZLE_DIR, '0015_add_project_context.sql')
const SNAPSHOT_FILE = join(DRIZZLE_DIR, 'meta', '0015_snapshot.json')
const JOURNAL_FILE = join(DRIZZLE_DIR, 'meta', '_journal.json')

describe('Slice 01: Migration 0015 -- Add Project Context', () => {
  // -----------------------------------------------------------
  // AC-2a: Migration SQL file exists with expected ALTER TABLE statements
  // -----------------------------------------------------------
  it('AC-2a: migration file 0015_add_project_context.sql exists with expected ALTER TABLE statements', () => {
    /**
     * AC-2: GIVEN das aktualisierte Schema
     *       WHEN `pnpm drizzle-kit generate --name=add_project_context` ausgeführt wird
     *       THEN wird `drizzle/0015_add_project_context.sql` erzeugt; die SQL-Datei
     *            enthält ALTER TABLE `projects` ADD COLUMN für beide Spalten.
     */
    expect(existsSync(MIGRATION_FILE), `${MIGRATION_FILE} must exist`).toBe(true)

    const sql = readFileSync(MIGRATION_FILE, 'utf-8')

    // ALTER TABLE projects ADD COLUMN context_instructions text (nullable)
    expect(sql).toMatch(
      /ALTER TABLE\s+"projects"\s+ADD COLUMN\s+"context_instructions"\s+text/i
    )
    // No NOT NULL constraint on context_instructions
    expect(sql).not.toMatch(
      /ADD COLUMN\s+"context_instructions"\s+text\s+[^;]*NOT NULL/i
    )
    // No default value on context_instructions (NULL semantics)
    expect(sql).not.toMatch(
      /ADD COLUMN\s+"context_instructions"\s+text\s+DEFAULT/i
    )

    // ALTER TABLE projects ADD COLUMN context_updated_at timestamp with time zone (nullable)
    expect(sql).toMatch(
      /ALTER TABLE\s+"projects"\s+ADD COLUMN\s+"context_updated_at"\s+timestamp with time zone/i
    )
    expect(sql).not.toMatch(
      /ADD COLUMN\s+"context_updated_at"\s+timestamp with time zone\s+[^;]*NOT NULL/i
    )
    expect(sql).not.toMatch(
      /ADD COLUMN\s+"context_updated_at"\s+timestamp with time zone\s+DEFAULT/i
    )

    // No CREATE INDEX statements expected (Constraints: "Index: No")
    expect(sql).not.toMatch(/CREATE INDEX[^;]*context_instructions/i)
    expect(sql).not.toMatch(/CREATE INDEX[^;]*context_updated_at/i)
  })

  // -----------------------------------------------------------
  // AC-2b: Snapshot file exists with the new columns
  // -----------------------------------------------------------
  it('AC-2b: drizzle/meta/0015_snapshot.json exists and includes both new columns', () => {
    /**
     * AC-2: ... `drizzle/meta/0015_snapshot.json` wird erzeugt.
     *
     * Verifies that the Drizzle schema snapshot captures the new columns with
     * the correct types and nullability.
     */
    expect(existsSync(SNAPSHOT_FILE), `${SNAPSHOT_FILE} must exist`).toBe(true)

    const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'))
    const projectsTable = snapshot?.tables?.['public.projects']

    expect(projectsTable, 'public.projects must be present in snapshot').toBeDefined()

    const ci = projectsTable.columns?.['context_instructions']
    expect(ci, 'context_instructions column missing in snapshot').toBeDefined()
    expect(ci.type).toBe('text')
    expect(ci.notNull).toBe(false)
    expect(ci.primaryKey).toBe(false)
    expect(ci.default).toBeUndefined()

    const cu = projectsTable.columns?.['context_updated_at']
    expect(cu, 'context_updated_at column missing in snapshot').toBeDefined()
    expect(cu.type).toBe('timestamp with time zone')
    expect(cu.notNull).toBe(false)
    expect(cu.primaryKey).toBe(false)
    expect(cu.default).toBeUndefined()
  })

  // -----------------------------------------------------------
  // AC-2c: Journal lists 0015 as latest entry
  // -----------------------------------------------------------
  it('AC-2c: drizzle/meta/_journal.json lists 0015_add_project_context as the latest entry', () => {
    /**
     * AC-2: ... `drizzle/meta/_journal.json` listet `0015` als jüngsten Eintrag.
     *
     * Constraints: Migrationsnummer MUSS `0015` sein (nächste sequenzielle nach
     *              `0014_drop_model_slots_active.sql`).
     */
    expect(existsSync(JOURNAL_FILE), `${JOURNAL_FILE} must exist`).toBe(true)

    const journal = JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8'))
    expect(Array.isArray(journal.entries)).toBe(true)
    expect(journal.entries.length).toBeGreaterThan(0)

    // Latest entry MUST be 0015_add_project_context
    const latest = journal.entries[journal.entries.length - 1]
    expect(latest.tag).toBe('0015_add_project_context')
    expect(latest.idx).toBe(15)
    expect(latest.breakpoints).toBe(true)

    // Ensure 0014 still precedes 0015 (no gap, no skip)
    const tags = journal.entries.map((e: { tag: string }) => e.tag)
    const idx0014 = tags.findIndex((t: string) => t.startsWith('0014_'))
    const idx0015 = tags.findIndex((t: string) => t === '0015_add_project_context')
    expect(idx0014).toBeGreaterThanOrEqual(0)
    expect(idx0015).toBe(idx0014 + 1)
  })

  // -----------------------------------------------------------
  // AC-3: Migration up applies cleanly (RUNTIME -- requires live Postgres)
  // -----------------------------------------------------------
  it.skip('AC-3: pnpm drizzle-kit migrate exits 0 and \\d projects shows both new columns', () => {
    /**
     * AC-3: GIVEN eine Postgres-Datenbank im Migrations-Stand `0014`
     *       WHEN `pnpm drizzle-kit migrate` ausgeführt wird
     *       THEN die Migration `0015_add_project_context` läuft fehlerfrei durch
     *            (Exit-Code 0); `psql -c "\\d projects"` zeigt beide Spalten mit
     *            Typ `text` bzw. `timestamp with time zone`, jeweils NULL-erlaubt;
     *            bestehende `projects`-Zeilen sind unverändert.
     *
     * Runtime test: requires DATABASE_URL pointing at a Postgres instance
     * stuck at migration 0014. Verified via:
     *   1. Snapshot row-count for projects before migrate.
     *   2. `pnpm drizzle-kit migrate` -- expect exit 0.
     *   3. `psql $DATABASE_URL -c "\d projects"` shows context_instructions (text)
     *      and context_updated_at (timestamp with time zone), both NULL-able.
     *   4. Re-snapshot row-count -- must match step 1.
     *
     * Skipped because the suite must be runnable without a live DB.
     */
  })

  // -----------------------------------------------------------
  // AC-4: Down + Re-Apply round trip (RUNTIME -- requires live Postgres)
  // -----------------------------------------------------------
  it.skip('AC-4: rollback SQL drops both columns; re-running 0015 migration succeeds idempotent', () => {
    /**
     * AC-4: GIVEN eine Datenbank mit angewendeter `0015`-Migration
     *       WHEN Down-Verifikation per Roll-Back-SQL gefahren wird
     *            (`ALTER TABLE projects DROP COLUMN context_instructions, DROP COLUMN context_updated_at`)
     *       THEN die Tabelle kehrt zum `0014`-Zustand zurück, ohne Daten in
     *            anderen Spalten zu verlieren; Re-Apply der Migration funktioniert
     *            erneut idempotent (Up→Down→Up läuft fehlerfrei).
     *
     * Runtime test plan:
     *   1. Apply 0015 (up).
     *   2. Snapshot non-context column data (id, name, thumbnail_url, ...).
     *   3. Run rollback SQL.
     *   4. Verify both columns are gone; non-context data identical.
     *   5. Re-apply 0015; expect success and columns reappear.
     *
     * Skipped because the suite must be runnable without a live DB.
     */
  })
})
