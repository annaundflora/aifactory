import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Tests for Slice 21: DB Migration SQL
 *
 * AC-1 through AC-5 are file-inspection tests that validate the generated
 * migration SQL file content against the spec requirements.
 *
 * AC-6 through AC-8 are runtime tests requiring a live PostgreSQL database
 * and are marked as skipped since they cannot run without one.
 */

const DRIZZLE_DIR = join(process.cwd(), 'drizzle')

function findMigrationFile(): string | null {
  if (!existsSync(DRIZZLE_DIR)) return null
  const files = readdirSync(DRIZZLE_DIR)
  const match = files.find((f) => /^0001_.*\.sql$/.test(f))
  return match ? join(DRIZZLE_DIR, match) : null
}

function readMigrationSQL(): string {
  const filePath = findMigrationFile()
  if (!filePath) {
    throw new Error('No migration file matching drizzle/0001_*.sql found')
  }
  return readFileSync(filePath, 'utf-8')
}

describe('DB Migration SQL', () => {
  // =================================================================
  // AC-1: Migration file exists
  // =================================================================
  it('AC-1: GIVEN das erweiterte Drizzle-Schema aus Slice 01 und Slice 02 WHEN npx drizzle-kit generate ausgefuehrt wird THEN wird eine SQL-Datei im Verzeichnis drizzle/ erzeugt (Dateiname-Pattern: 0001_*.sql)', () => {
    const migrationFile = findMigrationFile()

    expect(migrationFile).not.toBeNull()
    expect(existsSync(migrationFile!)).toBe(true)

    // Verify the file is in the drizzle/ directory
    expect(migrationFile!).toContain(join('drizzle', '0001_'))

    // Verify it ends with .sql
    expect(migrationFile!).toMatch(/\.sql$/)
  })

  // =================================================================
  // AC-2: Generations ALTER TABLE Statements
  // =================================================================
  it('AC-2: GIVEN die generierte Migration-Datei WHEN ihr Inhalt inspiziert wird THEN enthaelt sie ALTER TABLE-Statements fuer die generations-Tabelle mit den Spalten prompt_motiv (TEXT NOT NULL DEFAULT \'\'), prompt_style (TEXT DEFAULT \'\'), is_favorite (BOOLEAN NOT NULL DEFAULT false)', () => {
    const sql = readMigrationSQL()

    // prompt_motiv: TEXT NOT NULL DEFAULT ''
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"prompt_motiv"\s+text\b/i
    )
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"prompt_motiv"\s+text\s+DEFAULT\s+''/i
    )
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"prompt_motiv"\s+text\s+DEFAULT\s+''\s+NOT NULL/i
    )

    // prompt_style: TEXT DEFAULT ''
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"prompt_style"\s+text\b/i
    )
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"prompt_style"\s+text\s+DEFAULT\s+''/i
    )

    // is_favorite: BOOLEAN NOT NULL DEFAULT false
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"is_favorite"\s+boolean\b/i
    )
    expect(sql).toMatch(
      /ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"is_favorite"\s+boolean\s+DEFAULT\s+false\s+NOT NULL/i
    )
  })

  // =================================================================
  // AC-3: Projects ALTER TABLE Statements
  // =================================================================
  it('AC-3: GIVEN die generierte Migration-Datei WHEN ihr Inhalt inspiziert wird THEN enthaelt sie ALTER TABLE-Statements fuer die projects-Tabelle mit den Spalten thumbnail_url (TEXT) und thumbnail_status (VARCHAR(20) NOT NULL DEFAULT \'none\')', () => {
    const sql = readMigrationSQL()

    // thumbnail_url: TEXT (nullable)
    expect(sql).toMatch(
      /ALTER TABLE\s+"projects"\s+ADD COLUMN\s+"thumbnail_url"\s+text/i
    )

    // thumbnail_status: VARCHAR(20) NOT NULL DEFAULT 'none'
    expect(sql).toMatch(
      /ALTER TABLE\s+"projects"\s+ADD COLUMN\s+"thumbnail_status"\s+varchar\(20\)/i
    )
    expect(sql).toMatch(
      /ALTER TABLE\s+"projects"\s+ADD COLUMN\s+"thumbnail_status"\s+varchar\(20\)\s+DEFAULT\s+'none'\s+NOT NULL/i
    )
  })

  // =================================================================
  // AC-4: CREATE INDEX Statements
  // =================================================================
  it('AC-4: GIVEN die generierte Migration-Datei WHEN ihr Inhalt inspiziert wird THEN enthaelt sie CREATE INDEX-Statements fuer generations_is_favorite_idx und projects_thumbnail_status_idx', () => {
    const sql = readMigrationSQL()

    // Index on generations.is_favorite
    expect(sql).toMatch(
      /CREATE INDEX\s+"generations_is_favorite_idx"\s+ON\s+"generations"/i
    )
    expect(sql).toMatch(
      /CREATE INDEX\s+"generations_is_favorite_idx"\s+ON\s+"generations"[^;]*\("is_favorite"\)/i
    )

    // Index on projects.thumbnail_status
    expect(sql).toMatch(
      /CREATE INDEX\s+"projects_thumbnail_status_idx"\s+ON\s+"projects"/i
    )
    expect(sql).toMatch(
      /CREATE INDEX\s+"projects_thumbnail_status_idx"\s+ON\s+"projects"[^;]*\("thumbnail_status"\)/i
    )
  })

  // =================================================================
  // AC-5: Backfill Statement
  // =================================================================
  it('AC-5: GIVEN die generierte Migration-Datei WHEN ihr Inhalt inspiziert wird THEN enthaelt sie am Ende das Backfill-Statement: UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = \'\';', () => {
    const sql = readMigrationSQL()

    // The backfill statement must exist
    expect(sql).toContain(
      "UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = '';"
    )

    // The backfill statement must be at the END of the file (after all ALTER/CREATE statements)
    const lines = sql.trim().split('\n').filter((line) => line.trim() !== '')
    const lastNonEmptyLine = lines[lines.length - 1].trim()
    expect(lastNonEmptyLine).toBe(
      "UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = '';"
    )

    // Verify the backfill comes AFTER the last CREATE INDEX (structural ordering)
    const backfillIndex = sql.lastIndexOf('UPDATE generations SET prompt_motiv')
    const lastCreateIndex = sql.lastIndexOf('CREATE INDEX')
    expect(backfillIndex).toBeGreaterThan(lastCreateIndex)
  })

  // =================================================================
  // AC-6: Migration runs without errors (runtime - requires live DB)
  // =================================================================
  it.skip('AC-6: GIVEN eine laufende PostgreSQL-Datenbank mit bestehenden Daten WHEN npx drizzle-kit migrate ausgefuehrt wird THEN laeuft die Migration fehlerfrei durch (Exit Code 0)', () => {
    // Runtime test: requires a running PostgreSQL database.
    // Would execute: npx drizzle-kit migrate
    // and verify exit code === 0
  })

  // =================================================================
  // AC-7: Backfill correctly populates prompt_motiv (runtime - requires live DB)
  // =================================================================
  it.skip('AC-7: GIVEN eine erfolgreiche Migration und bestehende Generations mit prompt = \'A cat on a roof\' WHEN die generations-Tabelle abgefragt wird THEN hat jede bestehende Generation prompt_motiv befuellt mit dem Wert aus prompt', () => {
    // Runtime test: requires a running PostgreSQL database with seeded data.
    // Would:
    // 1. Insert a generation with prompt = 'A cat on a roof'
    // 2. Run migration
    // 3. Query and verify prompt_motiv = 'A cat on a roof'
  })

  // =================================================================
  // AC-8: New columns and indexes visible in DB (runtime - requires live DB)
  // =================================================================
  it.skip('AC-8: GIVEN eine erfolgreiche Migration WHEN die DB-Struktur inspiziert wird THEN sind alle neuen Spalten und Indexes in der Datenbank sichtbar und die bestehenden Daten intakt', () => {
    // Runtime test: requires a running PostgreSQL database after migration.
    // Would inspect information_schema.columns and pg_indexes
    // to verify presence of all new columns and indexes.
  })
})
