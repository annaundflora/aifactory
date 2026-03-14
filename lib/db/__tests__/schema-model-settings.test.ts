import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { modelSettings } from '../schema'

/**
 * Unit Tests for modelSettings schema definition (slice-01-db-schema-migration)
 *
 * These tests validate the Drizzle ORM schema definition for the modelSettings
 * table against the Acceptance Criteria in the slice spec. They inspect the
 * schema objects directly without requiring a running database.
 *
 * Covers: AC-1 (table structure), AC-4 (unique constraint), AC-5 (export/schema shape)
 */

type ModelSettingsSelect = InferSelectModel<typeof modelSettings>

describe('modelSettings schema definition', () => {
  const config = getTableConfig(modelSettings)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: Tabellen-Struktur
  // -----------------------------------------------------------
  it('AC-1: should define modelSettings table with all required columns and correct types', () => {
    /**
     * AC-1: GIVEN eine leere Datenbank ohne `model_settings` Tabelle
     *       WHEN die Migration `0007_*.sql` ausgefuehrt wird
     *       THEN existiert die Tabelle `model_settings` mit den Spalten
     *            `id` (uuid PK), `mode` (varchar(20) NOT NULL),
     *            `tier` (varchar(20) NOT NULL), `model_id` (varchar(255) NOT NULL),
     *            `model_params` (jsonb NOT NULL DEFAULT '{}'),
     *            `created_at` (timestamptz NOT NULL DEFAULT now()),
     *            `updated_at` (timestamptz NOT NULL DEFAULT now())
     */
    expect(config.name).toBe('model_settings')
    expect(config.columns.length).toBe(7)

    // id: UUID, primary key, default gen_random_uuid()
    expect(columnMap['id']).toBeDefined()
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].dataType).toBe('string')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['id'].hasDefault).toBe(true)

    // mode: VARCHAR(20) NOT NULL
    expect(columnMap['mode']).toBeDefined()
    expect(columnMap['mode'].columnType).toBe('PgVarchar')
    expect(columnMap['mode'].notNull).toBe(true)
    expect((columnMap['mode'] as any).config.length).toBe(20)

    // tier: VARCHAR(20) NOT NULL
    expect(columnMap['tier']).toBeDefined()
    expect(columnMap['tier'].columnType).toBe('PgVarchar')
    expect(columnMap['tier'].notNull).toBe(true)
    expect((columnMap['tier'] as any).config.length).toBe(20)

    // model_id: VARCHAR(255) NOT NULL
    expect(columnMap['model_id']).toBeDefined()
    expect(columnMap['model_id'].columnType).toBe('PgVarchar')
    expect(columnMap['model_id'].notNull).toBe(true)
    expect((columnMap['model_id'] as any).config.length).toBe(255)

    // model_params: JSONB NOT NULL DEFAULT '{}'
    expect(columnMap['model_params']).toBeDefined()
    expect(columnMap['model_params'].columnType).toBe('PgJsonb')
    expect(columnMap['model_params'].notNull).toBe(true)
    expect(columnMap['model_params'].hasDefault).toBe(true)

    // created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
    expect(columnMap['created_at']).toBeDefined()
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['created_at'].notNull).toBe(true)
    expect(columnMap['created_at'].hasDefault).toBe(true)

    // updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
    expect(columnMap['updated_at']).toBeDefined()
    expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['updated_at'].notNull).toBe(true)
    expect(columnMap['updated_at'].hasDefault).toBe(true)
  })

  // -----------------------------------------------------------
  // AC-4: Unique Constraint auf (mode, tier)
  // -----------------------------------------------------------
  it('AC-4: should have a unique constraint on (mode, tier)', () => {
    /**
     * AC-4: GIVEN die Tabelle `model_settings` existiert
     *       WHEN ein INSERT mit einer bereits existierenden `(mode, tier)` Kombination versucht wird
     *       THEN wird der INSERT durch den unique constraint auf `(mode, tier)` abgelehnt (conflict)
     *
     * We validate this at the schema level by inspecting the uniqueIndex definition.
     */
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('model_settings_mode_tier_idx')

    const modeTierIdx = config.indexes.find(
      (idx) => idx.config.name === 'model_settings_mode_tier_idx'
    )
    expect(modeTierIdx).toBeDefined()

    // Index must be unique
    expect(modeTierIdx!.config.unique).toBe(true)

    // Index must be on exactly 2 columns: mode and tier
    expect(modeTierIdx!.config.columns.length).toBe(2)
    const indexColumnNames = modeTierIdx!.config.columns.map(
      (c: any) => c.name
    )
    expect(indexColumnNames).toContain('mode')
    expect(indexColumnNames).toContain('tier')
  })

  // -----------------------------------------------------------
  // AC-5: Export und Schema-Shape
  // -----------------------------------------------------------
  it('AC-5: should export modelSettings with correct table name and column configuration', () => {
    /**
     * AC-5: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN `modelSettings` exportiert wird
     *       THEN hat die Tabellen-Definition eine `uniqueIndex` oder `unique` Constraint
     *            auf den Spalten `(mode, tier)`
     */

    // Verify modelSettings is exported and has the correct table name
    expect(modelSettings).toBeDefined()
    expect(config.name).toBe('model_settings')

    // Verify all expected camelCase column accessors exist
    expect(modelSettings.id).toBeDefined()
    expect(modelSettings.mode).toBeDefined()
    expect(modelSettings.tier).toBeDefined()
    expect(modelSettings.modelId).toBeDefined()
    expect(modelSettings.modelParams).toBeDefined()
    expect(modelSettings.createdAt).toBeDefined()
    expect(modelSettings.updatedAt).toBeDefined()

    // Verify DB column names match
    expect(modelSettings.id.name).toBe('id')
    expect(modelSettings.mode.name).toBe('mode')
    expect(modelSettings.tier.name).toBe('tier')
    expect(modelSettings.modelId.name).toBe('model_id')
    expect(modelSettings.modelParams.name).toBe('model_params')
    expect(modelSettings.createdAt.name).toBe('created_at')
    expect(modelSettings.updatedAt.name).toBe('updated_at')

    // Verify inferred TypeScript types
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('id')
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('mode')
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('tier')
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('modelId')
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('modelParams')
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('createdAt')
    expectTypeOf<ModelSettingsSelect>().toHaveProperty('updatedAt')

    expectTypeOf<ModelSettingsSelect['id']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['mode']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['tier']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['modelId']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['createdAt']>().toEqualTypeOf<Date>()
    expectTypeOf<ModelSettingsSelect['updatedAt']>().toEqualTypeOf<Date>()
  })
})
