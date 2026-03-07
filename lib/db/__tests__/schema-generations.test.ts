import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { generations } from '../schema'

/**
 * Acceptance Tests for Slice 01: DB Schema -- Generations Extensions
 *
 * These tests validate the three new columns (prompt_motiv, prompt_style,
 * is_favorite), the new index (generations_is_favorite_idx), and the
 * extended InferSelectModel type against the Acceptance Criteria.
 *
 * Mocking Strategy: no_mocks (pure schema inspection, no DB connection needed)
 */

type GenerationSelect = InferSelectModel<typeof generations>

describe('Generations Schema Extensions', () => {
  // Helper: get table config and column map once for reuse
  const config = getTableConfig(generations)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: Schema kompiliert fehlerfrei
  // -----------------------------------------------------------
  it('AC-1: should compile without errors (verified by test execution itself)', () => {
    /**
     * AC-1: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN die Datei kompiliert wird (`tsc --noEmit`)
     *       THEN kompiliert sie fehlerfrei mit den drei neuen Spalten
     *
     * If this test file executes at all, the schema compiled successfully.
     * We verify the generations table is importable and has a valid config.
     */
    expect(generations).toBeDefined()
    expect(config.name).toBe('generations')
    expect(config.columns.length).toBeGreaterThan(0)
  })

  // -----------------------------------------------------------
  // AC-2: prompt_motiv Spaltendefinition
  // -----------------------------------------------------------
  it('AC-2: should define prompt_motiv as text, not null, default empty string', () => {
    /**
     * AC-2: GIVEN die `generations`-Tabellendefinition
     *       WHEN man die Spalte `prompt_motiv` inspiziert
     *       THEN ist sie vom Typ `text`, `NOT NULL`, mit Default `''` (leerer String)
     */
    const col = columnMap['prompt_motiv']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.dataType).toBe('string')
    expect(col.notNull).toBe(true)
    expect(col.hasDefault).toBe(true)
    expect(col.default).toBe('')
  })

  // -----------------------------------------------------------
  // AC-3: prompt_style Spaltendefinition
  // -----------------------------------------------------------
  it('AC-3: should define prompt_style as text with default empty string', () => {
    /**
     * AC-3: GIVEN die `generations`-Tabellendefinition
     *       WHEN man die Spalte `prompt_style` inspiziert
     *       THEN ist sie vom Typ `text` mit Default `''` (leerer String)
     */
    const col = columnMap['prompt_style']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.dataType).toBe('string')
    expect(col.hasDefault).toBe(true)
    expect(col.default).toBe('')
    // AC-3 does NOT specify NOT NULL -- prompt_style should be nullable
    expect(col.notNull).toBe(false)
  })

  // -----------------------------------------------------------
  // AC-4: is_favorite Spaltendefinition
  // -----------------------------------------------------------
  it('AC-4: should define is_favorite as boolean, not null, default false', () => {
    /**
     * AC-4: GIVEN die `generations`-Tabellendefinition
     *       WHEN man die Spalte `is_favorite` inspiziert
     *       THEN ist sie vom Typ `boolean`, `NOT NULL`, mit Default `false`
     */
    const col = columnMap['is_favorite']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgBoolean')
    expect(col.dataType).toBe('boolean')
    expect(col.notNull).toBe(true)
    expect(col.hasDefault).toBe(true)
    expect(col.default).toBe(false)
  })

  // -----------------------------------------------------------
  // AC-5: Index auf is_favorite
  // -----------------------------------------------------------
  it('AC-5: should define generations_is_favorite_idx index on is_favorite', () => {
    /**
     * AC-5: GIVEN die `generations`-Tabellendefinition
     *       WHEN man die Index-Definitionen inspiziert
     *       THEN existiert ein Index `generations_is_favorite_idx` auf der Spalte `is_favorite`
     */
    const indexNames = config.indexes.map((idx) => idx.config.name)

    expect(indexNames).toContain('generations_is_favorite_idx')

    // Verify the index is on the is_favorite column
    const favIdx = config.indexes.find(
      (idx) => idx.config.name === 'generations_is_favorite_idx'
    )
    expect(favIdx).toBeDefined()
    expect(favIdx!.config.columns.length).toBe(1)
    expect((favIdx!.config.columns[0] as any).name).toBe('is_favorite')
  })

  // -----------------------------------------------------------
  // AC-6: Bestehende Spalten und Indexes unveraendert
  // -----------------------------------------------------------
  it('AC-6: should preserve all existing columns and indexes unchanged', () => {
    /**
     * AC-6: GIVEN die bestehenden Spalten und Indexes der `generations`-Tabelle
     *       WHEN die neuen Spalten hinzugefuegt werden
     *       THEN bleiben alle bestehenden Spalten (id, projectId, prompt,
     *            negativePrompt, modelId, modelParams, status, imageUrl,
     *            replicatePredictionId, errorMessage, width, height, seed,
     *            createdAt) und bestehenden Indexes (generations_project_id_idx,
     *            generations_status_idx, generations_created_at_idx) unveraendert
     */

    // Verify all existing columns are still present
    const existingColumns = [
      'id',
      'project_id',
      'prompt',
      'negative_prompt',
      'model_id',
      'model_params',
      'status',
      'image_url',
      'replicate_prediction_id',
      'error_message',
      'width',
      'height',
      'seed',
      'created_at',
    ]

    for (const colName of existingColumns) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }

    // Verify existing column types are unchanged
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['project_id'].columnType).toBe('PgUUID')
    expect(columnMap['project_id'].notNull).toBe(true)
    expect(columnMap['prompt'].columnType).toBe('PgText')
    expect(columnMap['prompt'].notNull).toBe(true)
    expect(columnMap['negative_prompt'].columnType).toBe('PgText')
    expect(columnMap['model_id'].columnType).toBe('PgVarchar')
    expect(columnMap['model_id'].notNull).toBe(true)
    expect(columnMap['model_params'].columnType).toBe('PgJsonb')
    expect(columnMap['model_params'].notNull).toBe(true)
    expect(columnMap['status'].columnType).toBe('PgVarchar')
    expect(columnMap['status'].notNull).toBe(true)
    expect(columnMap['image_url'].columnType).toBe('PgText')
    expect(columnMap['replicate_prediction_id'].columnType).toBe('PgVarchar')
    expect(columnMap['error_message'].columnType).toBe('PgText')
    expect(columnMap['width'].columnType).toBe('PgInteger')
    expect(columnMap['height'].columnType).toBe('PgInteger')
    expect(columnMap['seed'].columnType).toBe('PgBigInt53')
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['created_at'].hasDefault).toBe(true)

    // Verify existing indexes are still present
    const indexNames = config.indexes.map((idx) => idx.config.name)

    expect(indexNames).toContain('generations_project_id_idx')
    expect(indexNames).toContain('generations_status_idx')
    expect(indexNames).toContain('generations_created_at_idx')

    // Total should be 4: 3 existing + 1 new (generations_is_favorite_idx)
    expect(config.indexes.length).toBe(4)
  })

  // -----------------------------------------------------------
  // AC-7: InferSelectModel Typ
  // -----------------------------------------------------------
  it('AC-7: should expose promptMotiv, promptStyle, and isFavorite in inferred select type', () => {
    /**
     * AC-7: GIVEN den `InferSelectModel`-Typ der erweiterten `generations`-Tabelle
     *       WHEN ein TypeScript-Modul diesen Typ importiert
     *       THEN enthaelt der Typ die Properties `promptMotiv: string`,
     *            `promptStyle: string | null` und `isFavorite: boolean`
     */

    // Type-level assertions using vitest expectTypeOf
    expectTypeOf<GenerationSelect>().toHaveProperty('promptMotiv')
    expectTypeOf<GenerationSelect['promptMotiv']>().toEqualTypeOf<string>()

    expectTypeOf<GenerationSelect>().toHaveProperty('promptStyle')
    expectTypeOf<GenerationSelect['promptStyle']>().toEqualTypeOf<string | null>()

    expectTypeOf<GenerationSelect>().toHaveProperty('isFavorite')
    expectTypeOf<GenerationSelect['isFavorite']>().toEqualTypeOf<boolean>()

    // Runtime verification: columns with camelCase names exist in the schema object
    expect(generations.promptMotiv).toBeDefined()
    expect(generations.promptStyle).toBeDefined()
    expect(generations.isFavorite).toBeDefined()
  })
})
