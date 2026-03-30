import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { modelSlots } from '../schema'
import * as schemaExports from '../schema'

/**
 * Unit Tests for modelSlots schema definition (slice-01-db-schema-migration)
 *
 * These tests validate the Drizzle ORM schema definition for the modelSlots
 * table against the Acceptance Criteria in the slice spec. They inspect the
 * schema objects directly without requiring a running database.
 *
 * Covers: AC-1 (table structure + unique index), AC-5 (export correctness),
 *         AC-6 (slot column type), AC-7 (unique index on mode+slot)
 */

type ModelSlotsSelect = InferSelectModel<typeof modelSlots>

describe('modelSlots schema definition', () => {
  const config = getTableConfig(modelSlots)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: model_slots Tabellen-Struktur
  // -----------------------------------------------------------
  it('AC-1: should define modelSlots table with all required columns and unique index on (mode, slot)', () => {
    /**
     * AC-1: GIVEN eine Datenbank mit der bestehenden model_settings Tabelle
     *       WHEN Migration 0012_add_model_slots.sql ausgefuehrt wird
     *       THEN existiert eine Tabelle model_slots mit den Spalten:
     *            id (uuid PK), mode (varchar(20) NOT NULL), slot (integer NOT NULL, CHECK 1-3),
     *            model_id (varchar(255) NULLABLE), model_params (jsonb NOT NULL DEFAULT '{}'),
     *            active (boolean NOT NULL DEFAULT false),
     *            created_at (timestamptz), updated_at (timestamptz)
     *       AND ein UNIQUE-Index auf (mode, slot) existiert
     */
    expect(config.name).toBe('model_slots')
    expect(config.columns.length).toBe(8)

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

    // slot: INTEGER NOT NULL
    expect(columnMap['slot']).toBeDefined()
    expect(columnMap['slot'].columnType).toBe('PgInteger')
    expect(columnMap['slot'].notNull).toBe(true)

    // model_id: VARCHAR(255) NULLABLE
    expect(columnMap['model_id']).toBeDefined()
    expect(columnMap['model_id'].columnType).toBe('PgVarchar')
    expect((columnMap['model_id'] as any).config.length).toBe(255)
    // model_id is nullable (notNull should be false or undefined)
    expect(columnMap['model_id'].notNull).toBe(false)

    // model_params: JSONB NOT NULL DEFAULT '{}'
    expect(columnMap['model_params']).toBeDefined()
    expect(columnMap['model_params'].columnType).toBe('PgJsonb')
    expect(columnMap['model_params'].notNull).toBe(true)
    expect(columnMap['model_params'].hasDefault).toBe(true)

    // active: BOOLEAN NOT NULL DEFAULT false
    expect(columnMap['active']).toBeDefined()
    expect(columnMap['active'].columnType).toBe('PgBoolean')
    expect(columnMap['active'].notNull).toBe(true)
    expect(columnMap['active'].hasDefault).toBe(true)

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

    // UNIQUE index on (mode, slot)
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('model_slots_mode_slot_idx')
  })

  // -----------------------------------------------------------
  // AC-5: Schema-Export korrekt
  // -----------------------------------------------------------
  it('AC-5: should export modelSlots pgTable and NOT export modelSettings', () => {
    /**
     * AC-5: GIVEN die neue model_slots Tabelle existiert
     *       WHEN das Drizzle-Schema in lib/db/schema.ts geladen wird
     *       THEN ist modelSlots als pgTable exportiert mit allen Spalten
     *       AND modelSettings pgTable-Export existiert NICHT mehr
     */

    // modelSlots is exported and has correct table name
    expect(modelSlots).toBeDefined()
    expect(config.name).toBe('model_slots')

    // Verify all expected camelCase column accessors exist
    expect(modelSlots.id).toBeDefined()
    expect(modelSlots.mode).toBeDefined()
    expect(modelSlots.slot).toBeDefined()
    expect(modelSlots.modelId).toBeDefined()
    expect(modelSlots.modelParams).toBeDefined()
    expect(modelSlots.active).toBeDefined()
    expect(modelSlots.createdAt).toBeDefined()
    expect(modelSlots.updatedAt).toBeDefined()

    // Verify DB column names match
    expect(modelSlots.id.name).toBe('id')
    expect(modelSlots.mode.name).toBe('mode')
    expect(modelSlots.slot.name).toBe('slot')
    expect(modelSlots.modelId.name).toBe('model_id')
    expect(modelSlots.modelParams.name).toBe('model_params')
    expect(modelSlots.active.name).toBe('active')
    expect(modelSlots.createdAt.name).toBe('created_at')
    expect(modelSlots.updatedAt.name).toBe('updated_at')

    // modelSettings must NOT be exported from schema.ts
    expect(schemaExports.modelSlots).toBeDefined()
    expect((schemaExports as any).modelSettings).toBeUndefined()

    // Verify inferred TypeScript types
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('id')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('mode')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('slot')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('modelId')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('modelParams')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('active')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('createdAt')
    expectTypeOf<ModelSlotsSelect>().toHaveProperty('updatedAt')

    expectTypeOf<ModelSlotsSelect['id']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSlotsSelect['mode']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSlotsSelect['slot']>().toEqualTypeOf<number>()
    expectTypeOf<ModelSlotsSelect['modelId']>().toEqualTypeOf<string | null>()
    expectTypeOf<ModelSlotsSelect['active']>().toEqualTypeOf<boolean>()
    expectTypeOf<ModelSlotsSelect['createdAt']>().toEqualTypeOf<Date>()
    expectTypeOf<ModelSlotsSelect['updatedAt']>().toEqualTypeOf<Date>()
  })

  // -----------------------------------------------------------
  // AC-6: CHECK-Constraint slot 1-3 (Schema-Level)
  // -----------------------------------------------------------
  it('AC-6: should define slot column with integer type and CHECK constraint', () => {
    /**
     * AC-6: GIVEN ein INSERT mit slot=4 auf model_slots versucht wird
     *       WHEN die DB den CHECK-Constraint prueft
     *       THEN wird der INSERT abgelehnt (CHECK violation: slot IN (1,2,3))
     *
     * At schema level we verify that:
     * 1. The slot column is defined as integer
     * 2. A CHECK constraint named 'model_slots_slot_check' exists
     */

    // slot column is integer type
    expect(columnMap['slot']).toBeDefined()
    expect(columnMap['slot'].columnType).toBe('PgInteger')
    expect(columnMap['slot'].notNull).toBe(true)

    // CHECK constraint exists on the table
    expect(config.checks).toBeDefined()
    expect(config.checks.length).toBeGreaterThan(0)

    // Find the slot check constraint
    const checkConstraintNames = config.checks.map((c: any) => c.name)
    expect(checkConstraintNames).toContain('model_slots_slot_check')
  })

  // -----------------------------------------------------------
  // AC-7: UNIQUE-Constraint mode+slot (Schema-Level)
  // -----------------------------------------------------------
  it('AC-7: should define unique index on mode and slot', () => {
    /**
     * AC-7: GIVEN ein INSERT mit identischem (mode, slot) Paar versucht wird
     *       WHEN die DB den UNIQUE-Constraint prueft
     *       THEN wird der INSERT abgelehnt (UNIQUE violation)
     *
     * At schema level we verify the unique index definition.
     */

    const modeSlotIdx = config.indexes.find(
      (idx) => idx.config.name === 'model_slots_mode_slot_idx'
    )
    expect(modeSlotIdx).toBeDefined()

    // Index must be unique
    expect(modeSlotIdx!.config.unique).toBe(true)

    // Index must be on exactly 2 columns: mode and slot
    expect(modeSlotIdx!.config.columns.length).toBe(2)
    const indexColumnNames = modeSlotIdx!.config.columns.map(
      (c: any) => c.name
    )
    expect(indexColumnNames).toContain('mode')
    expect(indexColumnNames).toContain('slot')
  })
})
