import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { generations } from '../schema'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Acceptance Tests for Slice 01 (Phase 2): DB Schema -- Multi-Mode Generation Columns
 *
 * These tests validate the three new columns (generation_mode, source_image_url,
 * source_generation_id), the new composite index (generations_project_mode_idx),
 * and the extended InferSelectModel type against the Acceptance Criteria.
 *
 * Mocking Strategy: no_mocks (pure schema inspection, no DB connection needed)
 */

type GenerationSelect = InferSelectModel<typeof generations>

describe('Generations Schema — Multi-Mode Extensions (slice-01-db-schema)', () => {
  // Helper: get table config and column map once for reuse
  const config = getTableConfig(generations)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: generation_mode Spaltendefinition
  // -----------------------------------------------------------
  it('AC-1: should define generation_mode as varchar(20), not null, default txt2img', () => {
    /**
     * AC-1: GIVEN die `generations`-Tabellendefinition in `lib/db/schema.ts`
     *       WHEN die Spalte `generation_mode` inspiziert wird
     *       THEN ist sie `varchar(20)`, `NOT NULL`, mit Default `'txt2img'`
     */
    const col = columnMap['generation_mode']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgVarchar')
    expect(col.dataType).toBe('string')
    expect(col.notNull).toBe(true)
    expect(col.hasDefault).toBe(true)
    expect(col.default).toBe('txt2img')
    // Verify varchar length constraint is 20
    expect((col as any).length).toBe(20)
  })

  // -----------------------------------------------------------
  // AC-2: source_image_url Spaltendefinition
  // -----------------------------------------------------------
  it('AC-2: should define source_image_url as text, nullable, no default', () => {
    /**
     * AC-2: GIVEN die `generations`-Tabellendefinition
     *       WHEN die Spalte `source_image_url` inspiziert wird
     *       THEN ist sie `text`, NULLABLE (kein `notNull()`, kein Default)
     */
    const col = columnMap['source_image_url']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.dataType).toBe('string')
    expect(col.notNull).toBe(false)
    expect(col.hasDefault).toBe(false)
  })

  // -----------------------------------------------------------
  // AC-3: source_generation_id Spaltendefinition und Self-Ref-FK
  // -----------------------------------------------------------
  it('AC-3: should define source_generation_id as uuid, nullable, with FK to generations.id ON DELETE SET NULL', () => {
    /**
     * AC-3: GIVEN die `generations`-Tabellendefinition
     *       WHEN die Spalte `source_generation_id` inspiziert wird
     *       THEN ist sie `uuid`, NULLABLE, mit Foreign-Key auf `generations.id` (ON DELETE SET NULL)
     */
    const col = columnMap['source_generation_id']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgUUID')
    expect(col.dataType).toBe('string')
    expect(col.notNull).toBe(false)
    expect(col.hasDefault).toBe(false)

    // Verify self-referencing FK: source_generation_id -> generations.id
    const selfRefFk = config.foreignKeys.find((fk) => {
      const ref = fk.reference()
      return ref.columns.some((c) => c.name === 'source_generation_id')
    })
    expect(selfRefFk).toBeDefined()

    // Verify FK target is the generations table itself (self-reference)
    const fkRef = selfRefFk!.reference()
    expect(fkRef.foreignTable).toBe(generations)
    expect(fkRef.foreignColumns.length).toBe(1)
    expect(fkRef.foreignColumns[0].name).toBe('id')

    // Verify ON DELETE SET NULL
    expect(selfRefFk!.onDelete).toBe('set null')
  })

  // -----------------------------------------------------------
  // AC-4: Composite Index auf (project_id, generation_mode)
  // -----------------------------------------------------------
  it('AC-4: should define generations_project_mode_idx on (project_id, generation_mode)', () => {
    /**
     * AC-4: GIVEN die erweiterte `generations`-Tabelle
     *       WHEN die Index-Definitionen inspiziert werden
     *       THEN existiert ein Index `generations_project_mode_idx` auf den Spalten
     *            `(project_id, generation_mode)` -- in dieser Reihenfolge
     */
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('generations_project_mode_idx')

    const modeIdx = config.indexes.find(
      (idx) => idx.config.name === 'generations_project_mode_idx'
    )
    expect(modeIdx).toBeDefined()

    // Composite index should have exactly 2 columns
    expect(modeIdx!.config.columns.length).toBe(2)

    // Verify column order: project_id first, generation_mode second
    expect((modeIdx!.config.columns[0] as any).name).toBe('project_id')
    expect((modeIdx!.config.columns[1] as any).name).toBe('generation_mode')
  })

  // -----------------------------------------------------------
  // AC-5: InferSelectModel Typ enthält neue Properties
  // -----------------------------------------------------------
  it('AC-5: should expose generationMode, sourceImageUrl, sourceGenerationId in inferred select type', () => {
    /**
     * AC-5: GIVEN den `InferSelectModel`-Typ der erweiterten `generations`-Tabelle
     *       WHEN ein TypeScript-Modul diesen Typ importiert
     *       THEN enthaelt er `generationMode: string`, `sourceImageUrl: string | null`
     *            und `sourceGenerationId: string | null`
     */

    // Type-level assertions using vitest expectTypeOf
    expectTypeOf<GenerationSelect>().toHaveProperty('generationMode')
    expectTypeOf<GenerationSelect['generationMode']>().toEqualTypeOf<string>()

    expectTypeOf<GenerationSelect>().toHaveProperty('sourceImageUrl')
    expectTypeOf<GenerationSelect['sourceImageUrl']>().toEqualTypeOf<string | null>()

    expectTypeOf<GenerationSelect>().toHaveProperty('sourceGenerationId')
    expectTypeOf<GenerationSelect['sourceGenerationId']>().toEqualTypeOf<string | null>()

    // Runtime verification: columns with camelCase names exist in the schema object
    expect(generations.generationMode).toBeDefined()
    expect(generations.sourceImageUrl).toBeDefined()
    expect(generations.sourceGenerationId).toBeDefined()
  })

  // -----------------------------------------------------------
  // AC-6: Bestehende Spalten und Indexes unveraendert
  // -----------------------------------------------------------
  it('AC-6: should preserve all 17 existing columns and all 4 existing indexes; total index count is 5', () => {
    /**
     * AC-6: GIVEN die bestehenden Spalten und 4 Indexes der `generations`-Tabelle
     *       (Stand vor diesem Slice: id, projectId, prompt, negativePrompt, modelId,
     *        modelParams, status, imageUrl, replicatePredictionId, errorMessage,
     *        width, height, seed, promptMotiv, promptStyle, isFavorite, createdAt)
     *       WHEN die drei neuen Spalten hinzugefuegt werden
     *       THEN bleiben alle bestehenden Spalten mit unveraendertem Typ und allen
     *            4 bestehenden Indexes erhalten; die Gesamtzahl der Indexes erhoeht sich auf 5
     */

    // All 17 pre-existing columns (snake_case DB names)
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
      'prompt_motiv',
      'prompt_style',
      'is_favorite',
      'created_at',
    ]

    // Verify all 17 existing columns are still present
    for (const colName of existingColumns) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }

    // Verify key existing column types are unchanged
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['project_id'].columnType).toBe('PgUUID')
    expect(columnMap['project_id'].notNull).toBe(true)
    expect(columnMap['prompt'].columnType).toBe('PgText')
    expect(columnMap['prompt'].notNull).toBe(true)
    expect(columnMap['status'].columnType).toBe('PgVarchar')
    expect(columnMap['status'].notNull).toBe(true)
    expect(columnMap['prompt_motiv'].columnType).toBe('PgText')
    expect(columnMap['prompt_motiv'].notNull).toBe(true)
    expect(columnMap['prompt_style'].columnType).toBe('PgText')
    expect(columnMap['is_favorite'].columnType).toBe('PgBoolean')
    expect(columnMap['is_favorite'].notNull).toBe(true)

    // Verify all 4 existing indexes are still present
    const indexNames = config.indexes.map((idx) => idx.config.name)

    expect(indexNames).toContain('generations_project_id_idx')
    expect(indexNames).toContain('generations_status_idx')
    expect(indexNames).toContain('generations_created_at_idx')
    expect(indexNames).toContain('generations_is_favorite_idx')

    // Total: 4 existing + 1 new (generations_project_mode_idx) = 5
    expect(config.indexes.length).toBe(5)

    // Total columns: 17 existing + 3 new = 20
    expect(config.columns.length).toBe(20)
  })

  // -----------------------------------------------------------
  // AC-7: Migration-Datei enthält ADD COLUMN generation_mode mit DEFAULT
  // -----------------------------------------------------------
  it('AC-7: should verify migration file contains ADD COLUMN generation_mode with DEFAULT txt2img', () => {
    /**
     * AC-7: GIVEN `npx drizzle-kit generate` wurde ausgefuehrt
     *       WHEN der Befehl abgeschlossen ist
     *       THEN wird eine neue `.sql`-Datei unter `drizzle/` erzeugt,
     *            die `ALTER TABLE generations ADD COLUMN generation_mode`
     *            mit `DEFAULT 'txt2img'` enthaelt
     */
    const drizzleDir = path.resolve(__dirname, '..', '..', '..', 'drizzle')
    const migrationFile = path.join(drizzleDir, '0002_dry_vance_astro.sql')

    // Migration file must exist
    expect(fs.existsSync(migrationFile)).toBe(true)

    const content = fs.readFileSync(migrationFile, 'utf-8')

    // Must contain ADD COLUMN generation_mode with DEFAULT 'txt2img'
    expect(content).toContain('generation_mode')
    expect(content).toMatch(/ADD COLUMN\s+"generation_mode"/)
    expect(content).toMatch(/DEFAULT\s+'txt2img'/)
  })
})
