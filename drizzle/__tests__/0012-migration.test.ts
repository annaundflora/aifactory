import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Integration Tests for model_slots migration (slice-01-db-schema-migration)
 *
 * These tests validate the migration SQL file content (0012_add_model_slots.sql)
 * against the Acceptance Criteria. They inspect the SQL file directly to verify:
 * - Tier-to-slot data migration (AC-2)
 * - Seed defaults for missing modes (AC-3)
 * - Total row count and model_settings drop (AC-4)
 * - CHECK constraint enforcement (AC-6)
 * - UNIQUE constraint enforcement (AC-7)
 *
 * Mocking Strategy: no_mocks (file inspection, no DB required for SQL analysis)
 */

const DRIZZLE_DIR = resolve(__dirname, '..')
const MIGRATION_FILE = resolve(DRIZZLE_DIR, '0012_add_model_slots.sql')

function readMigrationSQL(): string {
  if (!existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration file not found: ${MIGRATION_FILE}`)
  }
  return readFileSync(MIGRATION_FILE, 'utf-8')
}

/**
 * Parse seed INSERT VALUES from the migration SQL.
 * Returns array of { mode, slot, model_id, model_params, active } objects.
 * Handles NULL model_id values.
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

  // Match all INSERT INTO "model_slots" ... VALUES blocks (seed section, Steps 3)
  // Pattern: ('mode', slot, 'model_id' or NULL, '{...}'::jsonb, true/false)
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

describe('0012_add_model_slots migration', () => {
  // -----------------------------------------------------------
  // AC-2: Tier-to-Slot Datenmigration
  // -----------------------------------------------------------
  it('AC-2: should migrate model_settings tier=draft to slot=1 active=true, tier=quality to slot=2 active=false, tier=max to slot=3 active=false', () => {
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

    // Step 2: Migration SELECT from model_settings with tier-to-slot mapping
    expect(sql).toContain('INSERT INTO "model_slots"')
    expect(sql).toContain('FROM "model_settings" ms')

    // Verify tier-to-slot mapping: draft -> 1, quality -> 2, max -> 3
    expect(sql).toMatch(/WHEN\s+'draft'\s+THEN\s+1/i)
    expect(sql).toMatch(/WHEN\s+'quality'\s+THEN\s+2/i)
    expect(sql).toMatch(/WHEN\s+'max'\s+THEN\s+3/i)

    // Verify active flag mapping: draft -> true, else -> false
    expect(sql).toMatch(/WHEN\s+'draft'\s+THEN\s+true/i)

    // Verify model_params are copied directly (ms."model_params")
    expect(sql).toContain('ms."model_params"')

    // Verify model_id is copied directly (ms."model_id")
    expect(sql).toContain('ms."model_id"')

    // Verify ON CONFLICT handling for idempotency
    expect(sql).toContain('ON CONFLICT ("mode", "slot") DO NOTHING')
  })

  // -----------------------------------------------------------
  // AC-3: Seed-Defaults fuer fehlende Modes
  // -----------------------------------------------------------
  it('AC-3: should seed 3 rows per missing mode with slot 1 active and model_id NULL', () => {
    /**
     * AC-3: GIVEN model_settings enthaelt KEINE Rows fuer modes inpaint und outpaint
     *       WHEN Migration ausgefuehrt wird
     *       THEN model_slots enthaelt fuer jede dieser modes je 3 Rows (slot 1-3)
     *            mit model_id=NULL, model_params='{}', slot 1 active=true, slots 2-3 active=false
     */
    const allRows = parseSeedRows()

    // Check inpaint mode rows
    const inpaintRows = allRows.filter((r) => r.mode === 'inpaint')
    expect(inpaintRows.length).toBe(3)

    // inpaint slot 1: active=true, model_id=NULL
    const inpaintSlot1 = inpaintRows.find((r) => r.slot === 1)
    expect(inpaintSlot1).toBeDefined()
    expect(inpaintSlot1!.active).toBe(true)
    expect(inpaintSlot1!.model_id).toBeNull()
    expect(inpaintSlot1!.model_params).toBe('{}')

    // inpaint slot 2: active=false, model_id=NULL
    const inpaintSlot2 = inpaintRows.find((r) => r.slot === 2)
    expect(inpaintSlot2).toBeDefined()
    expect(inpaintSlot2!.active).toBe(false)
    expect(inpaintSlot2!.model_id).toBeNull()
    expect(inpaintSlot2!.model_params).toBe('{}')

    // inpaint slot 3: active=false, model_id=NULL
    const inpaintSlot3 = inpaintRows.find((r) => r.slot === 3)
    expect(inpaintSlot3).toBeDefined()
    expect(inpaintSlot3!.active).toBe(false)
    expect(inpaintSlot3!.model_id).toBeNull()
    expect(inpaintSlot3!.model_params).toBe('{}')

    // Check outpaint mode rows
    const outpaintRows = allRows.filter((r) => r.mode === 'outpaint')
    expect(outpaintRows.length).toBe(3)

    // outpaint slot 1: active=true, model_id=NULL
    const outpaintSlot1 = outpaintRows.find((r) => r.slot === 1)
    expect(outpaintSlot1).toBeDefined()
    expect(outpaintSlot1!.active).toBe(true)
    expect(outpaintSlot1!.model_id).toBeNull()

    // outpaint slots 2-3: active=false
    const outpaintSlot2 = outpaintRows.find((r) => r.slot === 2)
    expect(outpaintSlot2).toBeDefined()
    expect(outpaintSlot2!.active).toBe(false)
    expect(outpaintSlot2!.model_id).toBeNull()

    const outpaintSlot3 = outpaintRows.find((r) => r.slot === 3)
    expect(outpaintSlot3).toBeDefined()
    expect(outpaintSlot3!.active).toBe(false)
    expect(outpaintSlot3!.model_id).toBeNull()
  })

  // -----------------------------------------------------------
  // AC-4: 15 Rows total + model_settings gedroppt
  // -----------------------------------------------------------
  it('AC-4: should result in exactly 15 rows in model_slots and model_settings table dropped', () => {
    /**
     * AC-4: GIVEN Migration wurde vollstaendig ausgefuehrt
     *       WHEN SELECT count(*) FROM model_slots abgefragt wird
     *       THEN Ergebnis ist exakt 15 (5 modes x 3 slots)
     *       AND SELECT count(*) FROM information_schema.tables
     *           WHERE table_name='model_settings' ergibt 0
     */
    const allRows = parseSeedRows()

    // 5 modes x 3 slots = 15 seed rows total
    expect(allRows.length).toBe(15)

    // Verify exactly 5 distinct modes
    const uniqueModes = [...new Set(allRows.map((r) => r.mode))]
    expect(uniqueModes.sort()).toEqual([
      'img2img',
      'inpaint',
      'outpaint',
      'txt2img',
      'upscale',
    ])

    // Each mode has exactly 3 slots (1, 2, 3)
    for (const mode of uniqueModes) {
      const modeRows = allRows.filter((r) => r.mode === mode)
      expect(modeRows.length).toBe(3)
      const slots = modeRows.map((r) => r.slot).sort()
      expect(slots).toEqual([1, 2, 3])
    }

    // Each mode has exactly one active slot (slot 1)
    for (const mode of uniqueModes) {
      const activeRows = allRows.filter(
        (r) => r.mode === mode && r.active === true
      )
      expect(activeRows.length).toBe(1)
      expect(activeRows[0].slot).toBe(1)
    }

    // Verify model_settings is dropped
    const sql = readMigrationSQL()
    expect(sql).toMatch(/DROP TABLE\s+(IF EXISTS\s+)?"model_settings"/i)
  })

  // -----------------------------------------------------------
  // AC-6: CHECK-Constraint Enforcement
  // -----------------------------------------------------------
  it('AC-6: should reject insert with slot=4 via CHECK constraint', () => {
    /**
     * AC-6: GIVEN ein INSERT mit slot=4 auf model_slots versucht wird
     *       WHEN die DB den CHECK-Constraint prueft
     *       THEN wird der INSERT abgelehnt (CHECK violation: slot IN (1,2,3))
     *
     * At SQL level we verify the CHECK constraint exists in the CREATE TABLE.
     */
    const sql = readMigrationSQL()

    // CHECK constraint must be defined in the CREATE TABLE
    expect(sql).toMatch(
      /CONSTRAINT\s+"model_slots_slot_check"\s+CHECK\s*\(\s*"slot"\s+IN\s*\(\s*1\s*,\s*2\s*,\s*3\s*\)\s*\)/i
    )

    // All seed rows only use slots 1, 2, 3
    const allRows = parseSeedRows()
    for (const row of allRows) {
      expect([1, 2, 3]).toContain(row.slot)
    }
  })

  // -----------------------------------------------------------
  // AC-7: UNIQUE-Constraint Enforcement
  // -----------------------------------------------------------
  it('AC-7: should reject duplicate mode+slot insert via UNIQUE constraint', () => {
    /**
     * AC-7: GIVEN ein INSERT mit identischem (mode, slot) Paar versucht wird
     *       WHEN die DB den UNIQUE-Constraint prueft
     *       THEN wird der INSERT abgelehnt (UNIQUE violation)
     *
     * At SQL level we verify:
     * 1. A UNIQUE INDEX on (mode, slot) is created
     * 2. All INSERTs use ON CONFLICT ("mode", "slot") DO NOTHING for idempotency
     * 3. No duplicate (mode, slot) combinations exist in the seed data
     */
    const sql = readMigrationSQL()

    // UNIQUE index must be created
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(IF NOT EXISTS\s+)?"model_slots_mode_slot_idx"\s+ON\s+"model_slots"/i
    )

    // All INSERT statements use ON CONFLICT for idempotency
    const insertBlocks = sql.match(/INSERT INTO "model_slots"[\s\S]*?;/g) || []
    expect(insertBlocks.length).toBeGreaterThan(0)
    for (const block of insertBlocks) {
      expect(block).toContain('ON CONFLICT')
    }

    // Verify no duplicate (mode, slot) pairs in seed data
    const allRows = parseSeedRows()
    const pairs = allRows.map((r) => `${r.mode}:${r.slot}`)
    const uniquePairs = new Set(pairs)
    expect(pairs.length).toBe(uniquePairs.size)
  })

  // -----------------------------------------------------------
  // Additional: Transaction wrapping
  // -----------------------------------------------------------
  it('should wrap the entire migration in a transaction (BEGIN/COMMIT)', () => {
    /**
     * Constraint: Migration MUSS in einer Transaction laufen
     */
    const sql = readMigrationSQL()
    expect(sql).toMatch(/^\s*BEGIN\s*;/im)
    expect(sql).toMatch(/COMMIT\s*;\s*$/im)
  })

  // -----------------------------------------------------------
  // Additional: Idempotency (IF NOT EXISTS)
  // -----------------------------------------------------------
  it('should use IF NOT EXISTS for CREATE TABLE (idempotent-safe)', () => {
    /**
     * Constraint: Migration MUSS idempotent-sicher sein (IF NOT EXISTS fuer CREATE TABLE)
     */
    const sql = readMigrationSQL()
    expect(sql).toMatch(
      /CREATE TABLE\s+IF NOT EXISTS\s+"model_slots"/i
    )
  })
})
