import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { generations } from '../schema'

/**
 * Unit Tests for Slice 01 (Phase 7): DB Schema -- Prompt Field Removal
 *
 * These tests validate that the columns `promptStyle` and `negativePrompt`
 * have been removed from the `generations` table definition, while all
 * remaining columns are preserved unchanged.
 *
 * Mocking Strategy: no_mocks (pure schema inspection, no DB connection needed)
 */

type GenerationSelect = InferSelectModel<typeof generations>

describe('generations schema - prompt field removal', () => {
  const config = getTableConfig(generations)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: Schema hat keine promptStyle/negativePrompt Spalten
  // -----------------------------------------------------------
  it('should not have promptStyle column in generations table definition', () => {
    /**
     * AC-1: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN der TypeScript-Compiler `lib/db/schema.ts` prueft
     *       THEN existiert KEINE Spalte `promptStyle` in der `generations`-Tabellendefinition
     */
    expect(columnMap['prompt_style']).toBeUndefined()
    expect((generations as any).promptStyle).toBeUndefined()
  })

  // -----------------------------------------------------------
  // AC-1: Schema hat keine promptStyle/negativePrompt Spalten
  // -----------------------------------------------------------
  it('should not have negativePrompt column in generations table definition', () => {
    /**
     * AC-1: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN der TypeScript-Compiler `lib/db/schema.ts` prueft
     *       THEN existiert KEINE Spalte `negativePrompt` in der `generations`-Tabellendefinition
     */
    expect(columnMap['negative_prompt']).toBeUndefined()
    expect((generations as any).negativePrompt).toBeUndefined()
  })

  // -----------------------------------------------------------
  // AC-5: Bestehende Spalten prompt und promptMotiv sind unveraendert
  // -----------------------------------------------------------
  it('should still have prompt column as text NOT NULL', () => {
    /**
     * AC-5: GIVEN die bestehenden Spalten `prompt` (text, NOT NULL)
     *       WHEN das Schema nach der Aenderung geprueft wird
     *       THEN ist die Spalte `prompt` UNVERAENDERT vorhanden
     */
    const col = columnMap['prompt']
    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.notNull).toBe(true)
    expect(col.hasDefault).toBe(false)
  })

  // -----------------------------------------------------------
  // AC-5: Bestehende Spalten prompt und promptMotiv sind unveraendert
  // -----------------------------------------------------------
  it('should still have promptMotiv column as text NOT NULL with default empty string', () => {
    /**
     * AC-5: GIVEN die bestehenden Spalten `promptMotiv` (text, NOT NULL, default "")
     *       WHEN das Schema nach der Aenderung geprueft wird
     *       THEN ist die Spalte `promptMotiv` UNVERAENDERT vorhanden
     */
    const col = columnMap['prompt_motiv']
    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.notNull).toBe(true)
    expect(col.hasDefault).toBe(true)
    expect(col.default).toBe('')
  })

  // -----------------------------------------------------------
  // AC-1: Inferred TypeScript-Typ hat keine entfernten Properties
  // -----------------------------------------------------------
  it('should not include promptStyle or negativePrompt in inferred select type', () => {
    /**
     * AC-1: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN der TypeScript-Compiler `lib/db/schema.ts` prueft
     *       THEN hat der inferred TypeScript-Typ `typeof generations.$inferSelect`
     *       KEINE Properties `promptStyle` oder `negativePrompt`
     */

    // Type-level: GenerationSelect should NOT have promptStyle or negativePrompt
    // We verify by checking that these keys do not exist on the type
    type HasPromptStyle = 'promptStyle' extends keyof GenerationSelect ? true : false
    type HasNegativePrompt = 'negativePrompt' extends keyof GenerationSelect ? true : false

    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Type-level: GenerationSelect SHOULD still have prompt and promptMotiv
    expectTypeOf<GenerationSelect>().toHaveProperty('prompt')
    expectTypeOf<GenerationSelect['prompt']>().toEqualTypeOf<string>()
    expectTypeOf<GenerationSelect>().toHaveProperty('promptMotiv')
    expectTypeOf<GenerationSelect['promptMotiv']>().toEqualTypeOf<string>()

    // Runtime: the schema object should not expose these as column accessors
    const generationsKeys = Object.keys(generations)
    expect(generationsKeys).not.toContain('promptStyle')
    expect(generationsKeys).not.toContain('negativePrompt')
  })

  // -----------------------------------------------------------
  // AC-5: Alle uebrigen Spalten unveraendert
  // -----------------------------------------------------------
  it('should preserve all remaining columns of the generations table', () => {
    /**
     * AC-5: GIVEN die bestehenden Spalten der `generations`-Tabelle
     *       WHEN das Schema nach der Aenderung geprueft wird
     *       THEN sind alle uebrigen Spalten unveraendert
     *       (id, projectId, modelId, modelParams, status, imageUrl, etc.)
     */

    // All columns that must still exist (snake_case DB names)
    const expectedColumns = [
      'id',
      'project_id',
      'prompt',
      'model_id',
      'model_params',
      'status',
      'image_url',
      'replicate_prediction_id',
      'error_message',
      'width',
      'height',
      'seed',
      'prompt_motiv',
      'is_favorite',
      'created_at',
      'generation_mode',
      'source_image_url',
      'source_generation_id',
      'batch_id',
    ]

    for (const colName of expectedColumns) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }

    // Removed columns must NOT exist
    expect(columnMap['prompt_style']).toBeUndefined()
    expect(columnMap['negative_prompt']).toBeUndefined()

    // Total column count: 19 (21 original minus 2 removed)
    expect(config.columns.length).toBe(19)

    // Verify key column types unchanged
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['project_id'].columnType).toBe('PgUUID')
    expect(columnMap['project_id'].notNull).toBe(true)
    expect(columnMap['model_id'].columnType).toBe('PgVarchar')
    expect(columnMap['model_id'].notNull).toBe(true)
    expect(columnMap['model_params'].columnType).toBe('PgJsonb')
    expect(columnMap['model_params'].notNull).toBe(true)
    expect(columnMap['status'].columnType).toBe('PgVarchar')
    expect(columnMap['status'].notNull).toBe(true)
    expect(columnMap['image_url'].columnType).toBe('PgText')
    expect(columnMap['is_favorite'].columnType).toBe('PgBoolean')
    expect(columnMap['is_favorite'].notNull).toBe(true)

    // Indexes should all still be present
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('generations_project_id_idx')
    expect(indexNames).toContain('generations_status_idx')
    expect(indexNames).toContain('generations_created_at_idx')
    expect(indexNames).toContain('generations_is_favorite_idx')
    expect(indexNames).toContain('generations_project_mode_idx')
    expect(indexNames).toContain('generations_batch_id_idx')
    expect(config.indexes.length).toBe(6)
  })
})
