import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Integration Tests for Migration 0012: Drop prompt_style and negative_prompt
 *
 * These tests validate the generated migration SQL file and the Drizzle journal
 * against the Acceptance Criteria in the slice-01-db-schema-migration spec.
 *
 * Mocking Strategy: no_mocks (file inspection only, no DB connection needed)
 */

const DRIZZLE_DIR = resolve(__dirname, '..')
const MIGRATION_FILE = resolve(DRIZZLE_DIR, '0013_drop_prompt_style_negative.sql')
const JOURNAL_FILE = resolve(DRIZZLE_DIR, 'meta', '_journal.json')

describe('migration 0012 - drop prompt_style and negative_prompt', () => {
  // -----------------------------------------------------------
  // AC-2: Migration-SQL enthaelt korrekte DROP COLUMN Statements
  // -----------------------------------------------------------
  it('should contain ALTER TABLE DROP COLUMN for prompt_style', () => {
    /**
     * AC-2: GIVEN das bereinigte Schema aus AC-1
     *       WHEN `npx drizzle-kit generate` ausgefuehrt wird
     *       THEN existiert die Datei `drizzle/0012_drop_prompt_style_negative.sql`
     *       AND die SQL-Datei enthaelt ein `ALTER TABLE ... DROP COLUMN`-Statement
     *       fuer `prompt_style`
     */
    expect(existsSync(MIGRATION_FILE)).toBe(true)

    const sql = readFileSync(MIGRATION_FILE, 'utf-8')
    expect(sql).toMatch(/ALTER TABLE\s+"generations"\s+DROP COLUMN\s+"prompt_style"/i)
  })

  // -----------------------------------------------------------
  // AC-2: Migration-SQL enthaelt korrekte DROP COLUMN Statements
  // -----------------------------------------------------------
  it('should contain ALTER TABLE DROP COLUMN for negative_prompt', () => {
    /**
     * AC-2: GIVEN das bereinigte Schema aus AC-1
     *       WHEN `npx drizzle-kit generate` ausgefuehrt wird
     *       THEN die SQL-Datei enthaelt ein `ALTER TABLE ... DROP COLUMN`-Statement
     *       fuer `negative_prompt`
     */
    expect(existsSync(MIGRATION_FILE)).toBe(true)

    const sql = readFileSync(MIGRATION_FILE, 'utf-8')
    expect(sql).toMatch(/ALTER TABLE\s+"generations"\s+DROP COLUMN\s+"negative_prompt"/i)
  })

  // -----------------------------------------------------------
  // AC-2: Statement-Breakpoint Konvention
  // -----------------------------------------------------------
  it('should use statement-breakpoint separator between statements', () => {
    /**
     * AC-2: GIVEN die generierte Migration
     *       WHEN die SQL-Datei inspiziert wird
     *       THEN verwenden die Statements `--> statement-breakpoint` als Separator
     *       (Drizzle-Konvention)
     */
    expect(existsSync(MIGRATION_FILE)).toBe(true)

    const sql = readFileSync(MIGRATION_FILE, 'utf-8')

    // Must contain the statement-breakpoint separator
    expect(sql).toContain('--> statement-breakpoint')

    // Must have exactly 2 ALTER TABLE DROP COLUMN statements
    const dropStatements = sql.match(/ALTER TABLE\s+"generations"\s+DROP COLUMN/gi)
    expect(dropStatements).not.toBeNull()
    expect(dropStatements!.length).toBe(2)

    // The separator must appear between the two statements
    const parts = sql.split('--> statement-breakpoint')
    expect(parts.length).toBe(2)

    // First part contains one DROP COLUMN, second part contains the other
    expect(parts[0]).toMatch(/ALTER TABLE\s+"generations"\s+DROP COLUMN/i)
    expect(parts[1]).toMatch(/ALTER TABLE\s+"generations"\s+DROP COLUMN/i)
  })

  // -----------------------------------------------------------
  // AC-3: Journal-Eintrag ist korrekt
  // -----------------------------------------------------------
  it('should have journal entry with idx 13 and tag 0013_drop_prompt_style_negative', () => {
    /**
     * AC-3: GIVEN die generierte Migration aus AC-2
     *       WHEN die Datei `drizzle/meta/_journal.json` geprueft wird
     *       THEN enthaelt das `entries`-Array einen Eintrag mit
     *       `"idx": 13` und `"tag": "0013_drop_prompt_style_negative"`
     */
    expect(existsSync(JOURNAL_FILE)).toBe(true)

    const journal = JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8'))

    expect(journal.entries).toBeDefined()
    expect(Array.isArray(journal.entries)).toBe(true)

    const entry13 = journal.entries.find((e: any) => e.idx === 13)
    expect(entry13).toBeDefined()
    expect(entry13.tag).toBe('0013_drop_prompt_style_negative')
    expect(entry13.version).toBe('7')
    expect(entry13.breakpoints).toBe(true)
  })

  // -----------------------------------------------------------
  // AC-3: Vorherige Journal-Eintraege intakt
  // -----------------------------------------------------------
  it('should preserve all 13 previous journal entries (idx 0-12)', () => {
    /**
     * AC-3: GIVEN die generierte Migration aus AC-2
     *       WHEN die Datei `drizzle/meta/_journal.json` geprueft wird
     *       THEN hat das Journal weiterhin alle 13 vorherigen Eintraege (idx 0-12)
     */
    expect(existsSync(JOURNAL_FILE)).toBe(true)

    const journal = JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8'))

    expect(journal.version).toBe('7')
    expect(journal.dialect).toBe('postgresql')

    // Must have at least 14 entries (idx 0 through 13)
    expect(journal.entries.length).toBeGreaterThanOrEqual(14)

    // All previous entries (idx 0-12) must exist
    for (let i = 0; i <= 12; i++) {
      const entry = journal.entries.find((e: any) => e.idx === i)
      expect(entry, `Journal entry for idx ${i} should exist`).toBeDefined()
      expect(entry.version).toBe('7')
      expect(entry.breakpoints).toBe(true)
    }

    // Verify specific known tags for key migrations
    const entry11 = journal.entries.find((e: any) => e.idx === 11)
    expect(entry11.tag).toBe('0011_add_models_table')

    const entry0 = journal.entries.find((e: any) => e.idx === 0)
    expect(entry0.tag).toBe('0000_fine_killraven')
  })

  // -----------------------------------------------------------
  // AC-2: Migration file contains exactly the expected content
  // -----------------------------------------------------------
  it('should contain exactly 2 DROP COLUMN statements and no other DDL operations', () => {
    /**
     * AC-2: Supplementary validation -- the migration should ONLY contain
     * DROP COLUMN statements, no CREATE, ADD, or ALTER TYPE operations.
     */
    const sql = readFileSync(MIGRATION_FILE, 'utf-8')

    // No CREATE TABLE
    expect(sql).not.toMatch(/CREATE TABLE/i)
    // No ADD COLUMN
    expect(sql).not.toMatch(/ADD COLUMN/i)
    // No CREATE INDEX
    expect(sql).not.toMatch(/CREATE INDEX/i)
    // Only ALTER TABLE with DROP COLUMN
    const alterStatements = sql.match(/ALTER TABLE/gi)
    expect(alterStatements).not.toBeNull()
    expect(alterStatements!.length).toBe(2)
  })
})
