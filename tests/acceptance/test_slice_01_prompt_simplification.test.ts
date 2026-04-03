import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { generations } from '../../lib/db/schema'

/**
 * Acceptance Tests for slice-01-db-schema-migration (Phase 7: Prompt Simplification)
 *
 * Tests validate all 5 Acceptance Criteria from the slice spec.
 * AC-1: Schema columns removed
 * AC-2: Migration SQL file content
 * AC-3: Journal entry correctness
 * AC-4: Idempotency (runtime -- skipped without live env)
 * AC-5: Existing columns preserved
 *
 * Mocking Strategy: no_mocks
 */

type GenerationSelect = InferSelectModel<typeof generations>

const DRIZZLE_DIR = resolve(__dirname, '..', '..', 'drizzle')
const MIGRATION_FILE = resolve(DRIZZLE_DIR, '0013_drop_prompt_style_negative.sql')
const JOURNAL_FILE = resolve(DRIZZLE_DIR, 'meta', '_journal.json')

describe('slice-01-db-schema-migration Acceptance (Prompt Simplification)', () => {
  const config = getTableConfig(generations)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // =================================================================
  // AC-1: Schema hat keine promptStyle/negativePrompt Spalten
  // =================================================================
  it('AC-1: GIVEN das Drizzle-Schema in lib/db/schema.ts WHEN der TypeScript-Compiler prueft THEN existiert KEINE Spalte promptStyle und KEINE Spalte negativePrompt in der generations-Tabellendefinition', () => {
    /**
     * AC-1: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN der TypeScript-Compiler `lib/db/schema.ts` prueft
     *       THEN existiert KEINE Spalte `promptStyle` und KEINE Spalte `negativePrompt`
     *            in der `generations`-Tabellendefinition
     */

    // Schema-level: columns must not exist in the table config
    expect(columnMap['prompt_style']).toBeUndefined()
    expect(columnMap['negative_prompt']).toBeUndefined()

    // Runtime-level: column accessors must not exist on the schema object
    expect((generations as any).promptStyle).toBeUndefined()
    expect((generations as any).negativePrompt).toBeUndefined()

    // Verify column names list does not contain the removed columns
    const allColumnNames = config.columns.map((c) => c.name)
    expect(allColumnNames).not.toContain('prompt_style')
    expect(allColumnNames).not.toContain('negative_prompt')
  })

  // =================================================================
  // AC-1: Inferred TypeScript-Typ
  // =================================================================
  it('AC-1: GIVEN das Drizzle-Schema WHEN der inferred TypeScript-Typ geprueft wird THEN hat typeof generations.$inferSelect KEINE Properties promptStyle oder negativePrompt', () => {
    /**
     * AC-1: AND der inferred TypeScript-Typ `typeof generations.$inferSelect`
     *       hat KEINE Properties `promptStyle` oder `negativePrompt`
     */

    // Type-level checks: removed properties must not exist on the inferred type
    type HasPromptStyle = 'promptStyle' extends keyof GenerationSelect ? true : false
    type HasNegativePrompt = 'negativePrompt' extends keyof GenerationSelect ? true : false

    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Remaining properties must still exist
    expectTypeOf<GenerationSelect>().toHaveProperty('prompt')
    expectTypeOf<GenerationSelect>().toHaveProperty('promptMotiv')
    expectTypeOf<GenerationSelect>().toHaveProperty('id')
    expectTypeOf<GenerationSelect>().toHaveProperty('projectId')
    expectTypeOf<GenerationSelect>().toHaveProperty('modelId')
    expectTypeOf<GenerationSelect>().toHaveProperty('status')
  })

  // =================================================================
  // AC-2: Migration-Datei existiert mit korrekten DROP COLUMN Statements
  // =================================================================
  it('AC-2: GIVEN das bereinigte Schema aus AC-1 WHEN npx drizzle-kit generate ausgefuehrt wird THEN existiert die Datei drizzle/0013_drop_prompt_style_negative.sql mit genau 2 DROP COLUMN Statements', () => {
    /**
     * AC-2: GIVEN das bereinigte Schema aus AC-1
     *       WHEN `npx drizzle-kit generate` ausgefuehrt wird
     *       THEN existiert die Datei `drizzle/0013_drop_prompt_style_negative.sql`
     *       AND die SQL-Datei enthaelt genau 2 `ALTER TABLE ... DROP COLUMN`-Statements:
     *            eines fuer `prompt_style`, eines fuer `negative_prompt`
     *       AND die Statements verwenden `--> statement-breakpoint` als Separator
     */

    // File must exist
    expect(existsSync(MIGRATION_FILE)).toBe(true)

    const sql = readFileSync(MIGRATION_FILE, 'utf-8')

    // Must contain DROP COLUMN for both columns
    expect(sql).toMatch(/ALTER TABLE\s+"generations"\s+DROP COLUMN\s+"prompt_style"/i)
    expect(sql).toMatch(/ALTER TABLE\s+"generations"\s+DROP COLUMN\s+"negative_prompt"/i)

    // Exactly 2 DROP COLUMN statements
    const dropStatements = sql.match(/DROP COLUMN/gi)
    expect(dropStatements).not.toBeNull()
    expect(dropStatements!.length).toBe(2)

    // Uses statement-breakpoint separator (Drizzle convention)
    expect(sql).toContain('--> statement-breakpoint')
  })

  // =================================================================
  // AC-3: Journal-Eintrag korrekt
  // =================================================================
  it('AC-3: GIVEN die generierte Migration aus AC-2 WHEN drizzle/meta/_journal.json geprueft wird THEN enthaelt entries einen Eintrag mit idx 13 und tag 0013_drop_prompt_style_negative AND alle 13 vorherigen Eintraege sind intakt', () => {
    /**
     * AC-3: GIVEN die generierte Migration aus AC-2
     *       WHEN die Datei `drizzle/meta/_journal.json` geprueft wird
     *       THEN enthaelt das `entries`-Array einen Eintrag mit
     *            `"idx": 13` und `"tag": "0013_drop_prompt_style_negative"`
     *       AND das Journal hat weiterhin alle 13 vorherigen Eintraege (idx 0-12)
     */

    expect(existsSync(JOURNAL_FILE)).toBe(true)

    const journal = JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8'))
    expect(journal.version).toBe('7')
    expect(journal.dialect).toBe('postgresql')

    // Entry with idx 13 must exist with correct tag
    const entry13 = journal.entries.find((e: any) => e.idx === 13)
    expect(entry13).toBeDefined()
    expect(entry13.tag).toBe('0013_drop_prompt_style_negative')
    expect(entry13.breakpoints).toBe(true)

    // All 13 previous entries (idx 0-12) must still be present
    for (let i = 0; i <= 12; i++) {
      const entry = journal.entries.find((e: any) => e.idx === i)
      expect(entry, `Journal entry for idx ${i} should exist`).toBeDefined()
    }

    // Total entries: at least 13 (idx 0 through 12)
    expect(journal.entries.length).toBeGreaterThanOrEqual(13)
  })

  // =================================================================
  // AC-4: Idempotenz-Check (runtime -- requires drizzle-kit generate)
  // =================================================================
  it.skip('AC-4: GIVEN das bereinigte Schema und die generierte Migration WHEN npx drizzle-kit generate erneut ausgefuehrt wird THEN meldet Drizzle Kit keine neuen Aenderungen AND es wird KEINE weitere Migration-Datei erstellt', () => {
    /**
     * AC-4: GIVEN das bereinigte Schema und die generierte Migration
     *       WHEN `npx drizzle-kit generate` erneut ausgefuehrt wird (Idempotenz-Check)
     *       THEN meldet Drizzle Kit "No schema changes, nothing to migrate" (oder aequivalent)
     *       AND es wird KEINE weitere Migration-Datei erstellt
     *
     * NOTE: This test requires running `npx drizzle-kit generate` at runtime.
     * It is skipped in the unit test suite but can be run as a manual integration check.
     */
  })

  // =================================================================
  // AC-5: Bestehende Spalten prompt und promptMotiv unveraendert
  // =================================================================
  it('AC-5: GIVEN die bestehenden Spalten prompt und promptMotiv WHEN das Schema nach der Aenderung geprueft wird THEN sind beide Spalten UNVERAENDERT vorhanden AND alle uebrigen Spalten sind unveraendert', () => {
    /**
     * AC-5: GIVEN die bestehenden Spalten `prompt` (text, NOT NULL) und
     *       `promptMotiv` (text, NOT NULL, default "")
     *       WHEN das Schema nach der Aenderung geprueft wird
     *       THEN sind beide Spalten UNVERAENDERT vorhanden
     *       AND alle uebrigen Spalten der `generations`-Tabelle sind unveraendert
     *            (id, projectId, modelId, modelParams, status, imageUrl, etc.)
     */

    // prompt: text, NOT NULL, no default
    const promptCol = columnMap['prompt']
    expect(promptCol).toBeDefined()
    expect(promptCol.columnType).toBe('PgText')
    expect(promptCol.notNull).toBe(true)

    // promptMotiv: text, NOT NULL, default ""
    const promptMotivCol = columnMap['prompt_motiv']
    expect(promptMotivCol).toBeDefined()
    expect(promptMotivCol.columnType).toBe('PgText')
    expect(promptMotivCol.notNull).toBe(true)
    expect(promptMotivCol.hasDefault).toBe(true)
    expect(promptMotivCol.default).toBe('')

    // All other core columns still present and unchanged
    const coreColumns: Record<string, { type: string; notNull?: boolean }> = {
      'id': { type: 'PgUUID' }, // primary key
      'project_id': { type: 'PgUUID', notNull: true },
      'model_id': { type: 'PgVarchar', notNull: true },
      'model_params': { type: 'PgJsonb', notNull: true },
      'status': { type: 'PgVarchar', notNull: true },
      'image_url': { type: 'PgText' },
      'replicate_prediction_id': { type: 'PgVarchar' },
      'error_message': { type: 'PgText' },
      'width': { type: 'PgInteger' },
      'height': { type: 'PgInteger' },
      'seed': { type: 'PgBigInt53' },
      'is_favorite': { type: 'PgBoolean', notNull: true },
      'created_at': { type: 'PgTimestamp', notNull: true },
      'generation_mode': { type: 'PgVarchar', notNull: true },
      'source_image_url': { type: 'PgText' },
      'source_generation_id': { type: 'PgUUID' },
      'batch_id': { type: 'PgUUID' },
    }

    for (const [colName, expected] of Object.entries(coreColumns)) {
      const col = columnMap[colName]
      expect(col, `Column "${colName}" should exist`).toBeDefined()
      expect(col.columnType, `Column "${colName}" type`).toBe(expected.type)
      if (expected.notNull !== undefined) {
        expect(col.notNull, `Column "${colName}" notNull`).toBe(expected.notNull)
      }
    }

    // Table name unchanged
    expect(config.name).toBe('generations')
  })
})
