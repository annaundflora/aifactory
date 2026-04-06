import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Acceptance Tests for Slice 01: DB Schema + Migration (slice-01-db-schema-migration)
 *
 * Each test maps 1:1 to an Acceptance Criterion from the slice spec.
 * Tests validate both the Drizzle schema definition and the migration SQL file.
 *
 * Mocking Strategy: no_mocks
 */

// Import the schema under test
import { modelSlots } from '@/lib/db/schema'
import * as schemaExports from '@/lib/db/schema'

type ModelSlotsSelect = InferSelectModel<typeof modelSlots>

const DRIZZLE_DIR = resolve(process.cwd(), 'drizzle')
const MIGRATION_FILE = resolve(DRIZZLE_DIR, '0012_add_model_slots.sql')

function readMigrationSQL(): string {
  if (!existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration file not found: ${MIGRATION_FILE}`)
  }
  return readFileSync(MIGRATION_FILE, 'utf-8')
}

/**
 * Parse all seed INSERT VALUES from the migration SQL.
 */
function parseSeedRows(): Array<{
  mode: string
  slot: number
  model_id: string | null
  model_params: string
  active: boolean
}> {
  const sql = readMigrationSQL()
  const rows: Array<{
    mode: string
    slot: number
    model_id: string | null
    model_params: string
    active: boolean
  }> = []

  const rowPattern =
    /\(\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(?:'([^']*)'|NULL)\s*,\s*'([^']*)'::jsonb\s*,\s*(true|false)\s*\)/g

  let match
  while ((match = rowPattern.exec(sql)) !== null) {
    rows.push({
      mode: match[1],
      slot: parseInt(match[2], 10),
      model_id: match[3] ?? null,
      model_params: match[4],
      active: match[5] === 'true',
    })
  }

  return rows
}

describe('Slice 01: DB Schema + Migration Acceptance', () => {
  // =================================================================
  // AC-1: model_slots Tabellen-Struktur
  // =================================================================
  it('AC-1: GIVEN eine Datenbank mit der bestehenden model_settings Tabelle WHEN Migration 0012_add_model_slots.sql ausgefuehrt wird THEN existiert eine Tabelle model_slots mit allen Spalten AND ein UNIQUE-Index auf (mode, slot) existiert', () => {
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

    // --- Schema validation ---
    const config = getTableConfig(modelSlots)
    expect(config.name).toBe('model_slots')

    const columnMap = Object.fromEntries(
      config.columns.map((c) => [c.name, c])
    )

    // Current schema columns (active column was removed in migration 0014)
    const expectedColumns = [
      'id', 'mode', 'slot', 'model_id',
      'model_params', 'created_at', 'updated_at',
    ]
    for (const col of expectedColumns) {
      expect(columnMap[col]).toBeDefined()
    }

    // active column no longer exists
    expect(columnMap['active']).toBeUndefined()

    // id: uuid PK
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)

    // mode: varchar(20) NOT NULL
    expect(columnMap['mode'].columnType).toBe('PgVarchar')
    expect(columnMap['mode'].notNull).toBe(true)

    // slot: integer NOT NULL
    expect(columnMap['slot'].columnType).toBe('PgInteger')
    expect(columnMap['slot'].notNull).toBe(true)

    // model_id: varchar(255) NULLABLE
    expect(columnMap['model_id'].columnType).toBe('PgVarchar')
    expect(columnMap['model_id'].notNull).toBe(false)

    // model_params: jsonb NOT NULL DEFAULT '{}'
    expect(columnMap['model_params'].columnType).toBe('PgJsonb')
    expect(columnMap['model_params'].notNull).toBe(true)
    expect(columnMap['model_params'].hasDefault).toBe(true)

    // timestamps
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')

    // UNIQUE index on (mode, slot)
    const modeSlotIdx = config.indexes.find(
      (idx) => idx.config.name === 'model_slots_mode_slot_idx'
    )
    expect(modeSlotIdx).toBeDefined()
    expect(modeSlotIdx!.config.unique).toBe(true)

    // --- Migration SQL validation ---
    const sql = readMigrationSQL()
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"model_slots"/i)
    expect(sql).toMatch(
      /CONSTRAINT\s+"model_slots_slot_check"\s+CHECK\s*\(\s*"slot"\s+IN\s*\(\s*1\s*,\s*2\s*,\s*3\s*\)\s*\)/i
    )
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(IF NOT EXISTS\s+)?"model_slots_mode_slot_idx"/i
    )
  })

  // =================================================================
  // AC-2: Tier-to-Slot Datenmigration
  // =================================================================
  it('AC-2: GIVEN model_settings enthaelt Rows fuer mode txt2img mit tiers draft/quality/max WHEN Migration ausgefuehrt wird THEN model_slots enthaelt korrekte slot-Zuordnungen mit model_params 1:1 uebernommen', () => {
    /**
     * AC-2: GIVEN model_settings enthaelt Rows fuer mode txt2img mit tiers draft, quality, max
     *       WHEN Migration ausgefuehrt wird
     *       THEN model_slots enthaelt fuer mode txt2img:
     *            slot=1 mit model_id und active=true (aus tier=draft),
     *            slot=2 mit model_id und active=false (aus tier=quality),
     *            slot=3 mit model_id und active=false (aus tier=max)
     *       AND model_params werden 1:1 uebernommen
     */
    const sql = readMigrationSQL()

    // Tier-to-slot CASE mapping exists
    expect(sql).toMatch(/WHEN\s+'draft'\s+THEN\s+1/i)
    expect(sql).toMatch(/WHEN\s+'quality'\s+THEN\s+2/i)
    expect(sql).toMatch(/WHEN\s+'max'\s+THEN\s+3/i)

    // Active flag mapping: draft -> true, else -> false
    expect(sql).toMatch(/WHEN\s+'draft'\s+THEN\s+true/i)

    // model_params and model_id are copied from model_settings
    expect(sql).toContain('ms."model_params"')
    expect(sql).toContain('ms."model_id"')

    // The migration reads from model_settings
    expect(sql).toContain('FROM "model_settings" ms')

    // Uses ON CONFLICT for idempotency
    expect(sql).toContain('ON CONFLICT ("mode", "slot") DO NOTHING')

    // Verify seed defaults for txt2img reflect the expected mapping
    const allRows = parseSeedRows()
    const txt2imgRows = allRows.filter((r) => r.mode === 'txt2img')
    expect(txt2imgRows.length).toBe(3)

    const txt2imgSlot1 = txt2imgRows.find((r) => r.slot === 1)
    expect(txt2imgSlot1!.active).toBe(true)
    expect(txt2imgSlot1!.model_id).not.toBeNull()

    const txt2imgSlot2 = txt2imgRows.find((r) => r.slot === 2)
    expect(txt2imgSlot2!.active).toBe(false)
    expect(txt2imgSlot2!.model_id).not.toBeNull()

    const txt2imgSlot3 = txt2imgRows.find((r) => r.slot === 3)
    expect(txt2imgSlot3!.active).toBe(false)
    expect(txt2imgSlot3!.model_id).not.toBeNull()
  })

  // =================================================================
  // AC-3: Seed-Defaults fuer fehlende Modes
  // =================================================================
  it('AC-3: GIVEN model_settings enthaelt KEINE Rows fuer modes inpaint und outpaint WHEN Migration ausgefuehrt wird THEN model_slots enthaelt fuer jede mode je 3 Rows mit korrekten Defaults', () => {
    /**
     * AC-3: GIVEN model_settings enthaelt KEINE Rows fuer modes inpaint und outpaint
     *       WHEN Migration ausgefuehrt wird
     *       THEN model_slots enthaelt fuer jede dieser modes je 3 Rows (slot 1-3)
     *            mit model_id=NULL, model_params='{}', slot 1 active=true, slots 2-3 active=false
     */
    const allRows = parseSeedRows()

    for (const mode of ['inpaint', 'outpaint']) {
      const modeRows = allRows.filter((r) => r.mode === mode)
      expect(modeRows.length).toBe(3)

      // Slot 1: active=true, model_id=NULL, model_params='{}'
      const slot1 = modeRows.find((r) => r.slot === 1)
      expect(slot1).toBeDefined()
      expect(slot1!.active).toBe(true)
      expect(slot1!.model_id).toBeNull()
      expect(slot1!.model_params).toBe('{}')

      // Slot 2: active=false, model_id=NULL
      const slot2 = modeRows.find((r) => r.slot === 2)
      expect(slot2).toBeDefined()
      expect(slot2!.active).toBe(false)
      expect(slot2!.model_id).toBeNull()
      expect(slot2!.model_params).toBe('{}')

      // Slot 3: active=false, model_id=NULL
      const slot3 = modeRows.find((r) => r.slot === 3)
      expect(slot3).toBeDefined()
      expect(slot3!.active).toBe(false)
      expect(slot3!.model_id).toBeNull()
      expect(slot3!.model_params).toBe('{}')
    }
  })

  // =================================================================
  // AC-4: 15 Rows total + model_settings gedroppt
  // =================================================================
  it('AC-4: GIVEN Migration wurde vollstaendig ausgefuehrt WHEN SELECT count(*) FROM model_slots THEN Ergebnis ist exakt 15 AND model_settings table dropped', () => {
    /**
     * AC-4: GIVEN Migration wurde vollstaendig ausgefuehrt
     *       WHEN SELECT count(*) FROM model_slots abgefragt wird
     *       THEN Ergebnis ist exakt 15 (5 modes x 3 slots)
     *       AND SELECT count(*) FROM information_schema.tables
     *           WHERE table_name='model_settings' ergibt 0
     */
    const allRows = parseSeedRows()
    expect(allRows.length).toBe(15)

    // 5 modes x 3 slots
    const modes = [...new Set(allRows.map((r) => r.mode))]
    expect(modes.length).toBe(5)
    expect(modes.sort()).toEqual([
      'img2img', 'inpaint', 'outpaint', 'txt2img', 'upscale',
    ])

    for (const mode of modes) {
      const modeRows = allRows.filter((r) => r.mode === mode)
      expect(modeRows.length).toBe(3)
    }

    // model_settings table is dropped
    const sql = readMigrationSQL()
    expect(sql).toMatch(/DROP TABLE\s+(IF EXISTS\s+)?"model_settings"/i)
  })

  // =================================================================
  // AC-5: Schema-Export korrekt
  // =================================================================
  it('AC-5: GIVEN die neue model_slots Tabelle existiert WHEN das Drizzle-Schema geladen wird THEN ist modelSlots exportiert AND modelSettings existiert NICHT', () => {
    /**
     * AC-5: GIVEN die neue model_slots Tabelle existiert
     *       WHEN das Drizzle-Schema in lib/db/schema.ts geladen wird
     *       THEN ist modelSlots als pgTable exportiert mit allen Spalten
     *       AND modelSettings pgTable-Export existiert NICHT mehr
     */
    // modelSlots must be exported
    expect(schemaExports.modelSlots).toBeDefined()

    // modelSettings must NOT be exported
    expect((schemaExports as any).modelSettings).toBeUndefined()

    // Verify modelSlots has all expected column accessors
    expect(modelSlots.id).toBeDefined()
    expect(modelSlots.mode).toBeDefined()
    expect(modelSlots.slot).toBeDefined()
    expect(modelSlots.modelId).toBeDefined()
    expect(modelSlots.modelParams).toBeDefined()
    expect(modelSlots.createdAt).toBeDefined()
    expect(modelSlots.updatedAt).toBeDefined()

    // active column was removed in migration 0014
    expect((modelSlots as unknown as Record<string, unknown>).active).toBeUndefined()

    // Verify TypeScript types
    expectTypeOf<ModelSlotsSelect['id']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSlotsSelect['mode']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSlotsSelect['slot']>().toEqualTypeOf<number>()
    expectTypeOf<ModelSlotsSelect['modelId']>().toEqualTypeOf<string | null>()
  })

  // =================================================================
  // AC-6: CHECK-Constraint slot IN (1,2,3)
  // =================================================================
  it('AC-6: GIVEN ein INSERT mit slot=4 auf model_slots versucht wird WHEN die DB den CHECK-Constraint prueft THEN wird der INSERT abgelehnt', () => {
    /**
     * AC-6: GIVEN ein INSERT mit slot=4 auf model_slots versucht wird
     *       WHEN die DB den CHECK-Constraint prueft
     *       THEN wird der INSERT abgelehnt (CHECK violation: slot IN (1,2,3))
     */

    // Schema-level: CHECK constraint defined
    const config = getTableConfig(modelSlots)
    expect(config.checks).toBeDefined()
    expect(config.checks.length).toBeGreaterThan(0)
    const checkConstraintNames = config.checks.map((c: any) => c.name)
    expect(checkConstraintNames).toContain('model_slots_slot_check')

    // SQL-level: CHECK constraint in CREATE TABLE
    const sql = readMigrationSQL()
    expect(sql).toMatch(
      /CONSTRAINT\s+"model_slots_slot_check"\s+CHECK\s*\(\s*"slot"\s+IN\s*\(\s*1\s*,\s*2\s*,\s*3\s*\)\s*\)/i
    )

    // All seed data uses only valid slot values
    const allRows = parseSeedRows()
    for (const row of allRows) {
      expect(row.slot).toBeGreaterThanOrEqual(1)
      expect(row.slot).toBeLessThanOrEqual(3)
    }
  })

  // =================================================================
  // AC-7: UNIQUE-Constraint mode+slot
  // =================================================================
  it('AC-7: GIVEN ein INSERT mit identischem (mode, slot) Paar versucht wird WHEN die DB den UNIQUE-Constraint prueft THEN wird der INSERT abgelehnt', () => {
    /**
     * AC-7: GIVEN ein INSERT mit identischem (mode, slot) Paar versucht wird
     *       WHEN die DB den UNIQUE-Constraint prueft
     *       THEN wird der INSERT abgelehnt (UNIQUE violation)
     */

    // Schema-level: unique index on (mode, slot)
    const config = getTableConfig(modelSlots)
    const modeSlotIdx = config.indexes.find(
      (idx) => idx.config.name === 'model_slots_mode_slot_idx'
    )
    expect(modeSlotIdx).toBeDefined()
    expect(modeSlotIdx!.config.unique).toBe(true)

    const indexColumnNames = modeSlotIdx!.config.columns.map(
      (c: any) => c.name
    )
    expect(indexColumnNames).toContain('mode')
    expect(indexColumnNames).toContain('slot')

    // SQL-level: UNIQUE INDEX created
    const sql = readMigrationSQL()
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(IF NOT EXISTS\s+)?"model_slots_mode_slot_idx"/i
    )

    // All INSERTs use ON CONFLICT for idempotency
    const insertBlocks = sql.match(/INSERT INTO "model_slots"[\s\S]*?;/g) || []
    expect(insertBlocks.length).toBeGreaterThan(0)
    for (const block of insertBlocks) {
      expect(block).toContain('ON CONFLICT')
    }

    // No duplicate (mode, slot) pairs in seed data
    const allRows = parseSeedRows()
    const pairs = allRows.map((r) => `${r.mode}:${r.slot}`)
    const uniquePairs = new Set(pairs)
    expect(pairs.length).toBe(uniquePairs.size)
  })
})
