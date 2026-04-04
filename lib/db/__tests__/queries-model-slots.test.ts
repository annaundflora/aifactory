/**
 * Tests for model_slots query functions in lib/db/queries.ts
 * Slice: slice-02-db-queries
 *
 * Mocking Strategy: mock_external (DB via Vitest mocks, kein echter DB-Zugriff)
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the db module before importing queries
// ---------------------------------------------------------------------------

function createChainableMock(resolvedValue: unknown = []) {
  const createChain = (): Record<string, ReturnType<typeof vi.fn>> => {
    const proxy: Record<string, ReturnType<typeof vi.fn>> = {}
    const methods = [
      'select',
      'insert',
      'update',
      'delete',
      'from',
      'where',
      'set',
      'values',
      'returning',
      'orderBy',
      'onConflictDoUpdate',
      'onConflictDoNothing',
    ]
    for (const m of methods) {
      proxy[m] = vi.fn().mockReturnValue(proxy)
    }
    proxy.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      return Promise.resolve(resolvedValue).then(resolve)
    })
    return proxy
  }

  return createChain()
}

let mockChain: ReturnType<typeof createChainableMock>

vi.mock('../index', () => {
  return {
    get db() {
      return mockChain
    },
  }
})

// Import queries AFTER the mock is set up
import {
  getAllModelSlots,
  getModelSlotsByMode,
  upsertModelSlot,
  seedModelSlotDefaults,
} from '../queries'

// Also import the module itself for AC-7 export checks
import * as queriesModule from '../queries'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-29T12:00:00Z')
const LATER = new Date('2026-03-29T13:00:00Z')

/** Helper to create a mock ModelSlot row */
function makeSlot(overrides: Partial<{
  id: string
  mode: string
  slot: number
  modelId: string | null
  modelParams: Record<string, unknown>
  active: boolean
  createdAt: Date
  updatedAt: Date
}>): Record<string, unknown> {
  return {
    id: overrides.id ?? 'uuid-1',
    mode: overrides.mode ?? 'txt2img',
    slot: overrides.slot ?? 1,
    modelId: overrides.modelId ?? 'black-forest-labs/flux-schnell',
    modelParams: overrides.modelParams ?? {},
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  }
}

/** All 21 seed default rows as described in architecture.md */
function makeAll21Rows(): Record<string, unknown>[] {
  return [
    makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: { prompt_strength: 0.6 }, active: true }),
    makeSlot({ id: 'uuid-05', mode: 'img2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: { prompt_strength: 0.6 }, active: false }),
    makeSlot({ id: 'uuid-06', mode: 'img2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', modelParams: { prompt_strength: 0.6 }, active: false }),
    makeSlot({ id: 'uuid-07', mode: 'upscale', slot: 1, modelId: 'philz1337x/crystal-upscaler', modelParams: { scale: 4 }, active: true }),
    makeSlot({ id: 'uuid-08', mode: 'upscale', slot: 2, modelId: 'nightmareai/real-esrgan', modelParams: { scale: 2 }, active: false }),
    makeSlot({ id: 'uuid-09', mode: 'upscale', slot: 3, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-10', mode: 'inpaint', slot: 1, modelId: 'black-forest-labs/flux-fill-pro', modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-11', mode: 'inpaint', slot: 2, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-12', mode: 'inpaint', slot: 3, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-13', mode: 'outpaint', slot: 1, modelId: 'black-forest-labs/flux-fill-pro', modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-14', mode: 'outpaint', slot: 2, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-15', mode: 'outpaint', slot: 3, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-16', mode: 'erase', slot: 1, modelId: 'bria/eraser', modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-17', mode: 'erase', slot: 2, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-18', mode: 'erase', slot: 3, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-19', mode: 'instruction', slot: 1, modelId: 'black-forest-labs/flux-kontext-pro', modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-20', mode: 'instruction', slot: 2, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-21', mode: 'instruction', slot: 3, modelId: null, modelParams: {}, active: false }),
  ]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('model_slots query functions (slice-02-db-queries)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // AC-1: GIVEN die model_slots Tabelle enthaelt 21 Rows (7 Modes x 3 Slots)
  //       WHEN getAllModelSlots() aufgerufen wird
  //       THEN wird ein Array mit exakt 21 Elementen zurueckgegeben
  //       AND jedes Element entspricht dem ModelSlot inferred Type
  // =========================================================================
  it('AC-1: should return all 21 model slot rows', async () => {
    const all21 = makeAll21Rows()
    mockChain = createChainableMock(all21)

    const result = await getAllModelSlots()

    // Must return exactly 21 elements
    expect(result).toHaveLength(21)

    // Each element must have all ModelSlot fields
    for (const row of result) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('mode')
      expect(row).toHaveProperty('slot')
      expect(row).toHaveProperty('modelId')
      expect(row).toHaveProperty('modelParams')
      expect(row).toHaveProperty('active')
      expect(row).toHaveProperty('createdAt')
      expect(row).toHaveProperty('updatedAt')
    }

    // Verify the Drizzle query chain was called correctly
    expect(mockChain.select).toHaveBeenCalled()
    expect(mockChain.from).toHaveBeenCalled()

    // Verify the result matches fixtures exactly
    expect(result).toEqual(all21)
  })

  // =========================================================================
  // AC-2: GIVEN model_slots enthaelt Rows fuer mode txt2img (slot 1, 2, 3) und mode img2img (slot 1, 2, 3)
  //       WHEN getModelSlotsByMode("txt2img") aufgerufen wird
  //       THEN wird ein Array mit exakt 3 Elementen zurueckgegeben
  //       AND alle Elemente haben mode === "txt2img"
  //       AND die Elemente sind nach slot aufsteigend sortiert (1, 2, 3)
  // =========================================================================
  it('AC-2: should return only slots for the given mode sorted by slot asc', async () => {
    const txt2imgSlots = [
      makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
      makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', active: false }),
      makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', active: false }),
    ]
    mockChain = createChainableMock(txt2imgSlots)

    const result = await getModelSlotsByMode('txt2img')

    // Must return exactly 3 elements
    expect(result).toHaveLength(3)

    // All elements must have mode === 'txt2img'
    for (const row of result) {
      expect(row.mode).toBe('txt2img')
    }

    // Elements must be sorted by slot ascending (1, 2, 3)
    const slots = result.map((r) => r.slot)
    expect(slots).toEqual([1, 2, 3])

    // Verify correct Drizzle chain usage: select -> from -> where -> orderBy
    expect(mockChain.select).toHaveBeenCalled()
    expect(mockChain.from).toHaveBeenCalled()
    expect(mockChain.where).toHaveBeenCalled()
    expect(mockChain.orderBy).toHaveBeenCalled()
  })

  // =========================================================================
  // AC-3: GIVEN model_slots enthaelt fuer mode txt2img, slot 1 den model_id "black-forest-labs/flux-schnell"
  //       WHEN upsertModelSlot("txt2img", 1, "black-forest-labs/flux-2-pro", { guidance: 3.5 }, true) aufgerufen wird
  //       THEN wird die bestehende Row aktualisiert (kein neuer INSERT)
  //       AND die zurueckgegebene Row hat modelId === "black-forest-labs/flux-2-pro", modelParams === { guidance: 3.5 }, active === true
  //       AND updatedAt ist auf den aktuellen Zeitpunkt gesetzt
  // =========================================================================
  it('AC-3: should update existing row on conflict and set updatedAt', async () => {
    const updatedRow = makeSlot({
      id: 'uuid-01',
      mode: 'txt2img',
      slot: 1,
      modelId: 'black-forest-labs/flux-2-pro',
      modelParams: { guidance: 3.5 },
      active: true,
      createdAt: NOW,
      updatedAt: LATER,
    })
    // Drizzle upsert returns [row] from .returning()
    mockChain = createChainableMock([updatedRow])

    const result = await upsertModelSlot('txt2img', 1, 'black-forest-labs/flux-2-pro', { guidance: 3.5 }, true)

    // Verify the returned row fields
    expect(result.modelId).toBe('black-forest-labs/flux-2-pro')
    expect(result.modelParams).toEqual({ guidance: 3.5 })
    expect(result.active).toBe(true)
    expect(result.mode).toBe('txt2img')
    expect(result.slot).toBe(1)

    // updatedAt must be later than createdAt (row was updated, not newly inserted)
    expect(new Date(result.updatedAt as unknown as string).getTime())
      .toBeGreaterThan(new Date(result.createdAt as unknown as string).getTime())

    // Verify Drizzle upsert chain: insert -> values -> onConflictDoUpdate -> returning
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()
    expect(mockChain.onConflictDoUpdate).toHaveBeenCalled()
    expect(mockChain.returning).toHaveBeenCalled()
  })

  // =========================================================================
  // AC-4: GIVEN model_slots enthaelt KEINE Row fuer mode "inpaint", slot 2
  //       WHEN upsertModelSlot("inpaint", 2, "some-model/id", {}, false) aufgerufen wird
  //       THEN wird eine neue Row inserted
  //       AND die zurueckgegebene Row hat mode "inpaint", slot 2, modelId "some-model/id"
  // =========================================================================
  it('AC-4: should insert new row when no conflict exists', async () => {
    const insertedRow = makeSlot({
      id: 'uuid-new',
      mode: 'inpaint',
      slot: 2,
      modelId: 'some-model/id',
      modelParams: {},
      active: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    mockChain = createChainableMock([insertedRow])

    const result = await upsertModelSlot('inpaint', 2, 'some-model/id', {}, false)

    // Verify the returned row fields
    expect(result.mode).toBe('inpaint')
    expect(result.slot).toBe(2)
    expect(result.modelId).toBe('some-model/id')
    expect(result.modelParams).toEqual({})
    expect(result.active).toBe(false)

    // Verify the upsert chain was invoked
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()
    expect(mockChain.onConflictDoUpdate).toHaveBeenCalled()
    expect(mockChain.returning).toHaveBeenCalled()
  })

  // =========================================================================
  // AC-5: GIVEN model_slots ist leer (0 Rows)
  //       WHEN seedModelSlotDefaults() aufgerufen wird
  //       THEN enthaelt model_slots exakt 21 Rows
  //       AND die Seed-Daten entsprechen der Tabelle in architecture.md Section "Seed Defaults"
  //       AND fuer jeden Mode ist slot 1 active=true, slots 2 und 3 active=false
  // =========================================================================
  it('AC-5: should seed 21 default rows matching architecture.md defaults', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSlotDefaults()

    // Verify insert was called
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()

    // Extract the values passed to insert
    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
      modelId: string | null
      modelParams: Record<string, unknown>
      active: boolean
    }>

    // Must be exactly 21 rows
    expect(valuesCall).toHaveLength(21)

    // -- Verify all 7 modes are present --
    const modes = [...new Set(valuesCall.map((v) => v.mode))]
    expect(modes.sort()).toEqual(['erase', 'img2img', 'inpaint', 'instruction', 'outpaint', 'txt2img', 'upscale'])

    // -- Verify each mode has exactly 3 slots --
    for (const mode of modes) {
      const modeRows = valuesCall.filter((v) => v.mode === mode)
      expect(modeRows, `${mode} should have 3 slots`).toHaveLength(3)

      const slotNumbers = modeRows.map((v) => v.slot).sort()
      expect(slotNumbers, `${mode} slots should be 1, 2, 3`).toEqual([1, 2, 3])
    }

    // -- Verify slot 1 is active=true, slots 2 and 3 are active=false for every mode --
    for (const mode of modes) {
      const modeRows = valuesCall.filter((v) => v.mode === mode)
      const slot1 = modeRows.find((v) => v.slot === 1)
      const slot2 = modeRows.find((v) => v.slot === 2)
      const slot3 = modeRows.find((v) => v.slot === 3)

      expect(slot1!.active, `${mode} slot 1 should be active`).toBe(true)
      expect(slot2!.active, `${mode} slot 2 should be inactive`).toBe(false)
      expect(slot3!.active, `${mode} slot 3 should be inactive`).toBe(false)
    }

    // -- Verify specific seed data from architecture.md --

    // txt2img
    const txt2img1 = valuesCall.find((v) => v.mode === 'txt2img' && v.slot === 1)
    expect(txt2img1!.modelId).toBe('black-forest-labs/flux-schnell')
    expect(txt2img1!.modelParams).toEqual({})

    const txt2img2 = valuesCall.find((v) => v.mode === 'txt2img' && v.slot === 2)
    expect(txt2img2!.modelId).toBe('black-forest-labs/flux-2-pro')
    expect(txt2img2!.modelParams).toEqual({})

    const txt2img3 = valuesCall.find((v) => v.mode === 'txt2img' && v.slot === 3)
    expect(txt2img3!.modelId).toBe('black-forest-labs/flux-2-max')
    expect(txt2img3!.modelParams).toEqual({})

    // img2img
    const img2img1 = valuesCall.find((v) => v.mode === 'img2img' && v.slot === 1)
    expect(img2img1!.modelId).toBe('black-forest-labs/flux-schnell')
    expect(img2img1!.modelParams).toEqual({ prompt_strength: 0.6 })

    const img2img2 = valuesCall.find((v) => v.mode === 'img2img' && v.slot === 2)
    expect(img2img2!.modelId).toBe('black-forest-labs/flux-2-pro')
    expect(img2img2!.modelParams).toEqual({ prompt_strength: 0.6 })

    const img2img3 = valuesCall.find((v) => v.mode === 'img2img' && v.slot === 3)
    expect(img2img3!.modelId).toBe('black-forest-labs/flux-2-max')
    expect(img2img3!.modelParams).toEqual({ prompt_strength: 0.6 })

    // upscale
    const upscale1 = valuesCall.find((v) => v.mode === 'upscale' && v.slot === 1)
    expect(upscale1!.modelId).toBe('philz1337x/crystal-upscaler')
    expect(upscale1!.modelParams).toEqual({ scale: 4 })

    const upscale2 = valuesCall.find((v) => v.mode === 'upscale' && v.slot === 2)
    expect(upscale2!.modelId).toBe('nightmareai/real-esrgan')
    expect(upscale2!.modelParams).toEqual({ scale: 2 })

    const upscale3 = valuesCall.find((v) => v.mode === 'upscale' && v.slot === 3)
    expect(upscale3!.modelId).toBeNull()
    expect(upscale3!.modelParams).toEqual({})

    // inpaint (slot 1 has flux-fill-pro, slots 2/3 null)
    const inpaint1 = valuesCall.find((v) => v.mode === 'inpaint' && v.slot === 1)
    expect(inpaint1!.modelId).toBe('black-forest-labs/flux-fill-pro')
    expect(inpaint1!.modelParams).toEqual({})

    const inpaint2 = valuesCall.find((v) => v.mode === 'inpaint' && v.slot === 2)
    expect(inpaint2!.modelId).toBeNull()

    const inpaint3 = valuesCall.find((v) => v.mode === 'inpaint' && v.slot === 3)
    expect(inpaint3!.modelId).toBeNull()

    // outpaint (slot 1 has flux-fill-pro, slots 2/3 null)
    const outpaint1 = valuesCall.find((v) => v.mode === 'outpaint' && v.slot === 1)
    expect(outpaint1!.modelId).toBe('black-forest-labs/flux-fill-pro')
    expect(outpaint1!.modelParams).toEqual({})

    const outpaint2 = valuesCall.find((v) => v.mode === 'outpaint' && v.slot === 2)
    expect(outpaint2!.modelId).toBeNull()

    const outpaint3 = valuesCall.find((v) => v.mode === 'outpaint' && v.slot === 3)
    expect(outpaint3!.modelId).toBeNull()

    // erase (slot 1 has bria/eraser, slots 2/3 null)
    const erase1 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 1)
    expect(erase1!.modelId).toBe('bria/eraser')
    expect(erase1!.modelParams).toEqual({})

    const erase2 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 2)
    expect(erase2!.modelId).toBeNull()

    const erase3 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 3)
    expect(erase3!.modelId).toBeNull()

    // instruction (slot 1 has flux-kontext-pro, slots 2/3 null)
    const instruction1 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 1)
    expect(instruction1!.modelId).toBe('black-forest-labs/flux-kontext-pro')
    expect(instruction1!.modelParams).toEqual({})

    const instruction2 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 2)
    expect(instruction2!.modelId).toBeNull()

    const instruction3 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 3)
    expect(instruction3!.modelId).toBeNull()

    // Verify onConflictDoNothing was used for idempotency
    expect(mockChain.onConflictDoNothing).toHaveBeenCalled()
  })

  // =========================================================================
  // AC-6: GIVEN model_slots enthaelt bereits 21 Rows (vollstaendig geseeded)
  //       WHEN seedModelSlotDefaults() erneut aufgerufen wird
  //       THEN bleiben alle 21 Rows unveraendert (idempotent, ON CONFLICT DO NOTHING)
  //       AND kein Fehler wird geworfen
  // =========================================================================
  it('AC-6: should not modify existing rows when called again', async () => {
    // First call
    mockChain = createChainableMock(undefined)
    await seedModelSlotDefaults()

    const firstInsertCallCount = mockChain.insert.mock.calls.length
    expect(firstInsertCallCount).toBe(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    // Second call (simulates calling again with all 21 rows already existing)
    vi.clearAllMocks()
    mockChain = createChainableMock(undefined)

    // Must not throw
    await expect(seedModelSlotDefaults()).resolves.not.toThrow()

    // The function still calls insert with the same 21 values,
    // but with onConflictDoNothing so no rows are actually modified.
    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    // Verify the same 21 values are passed on each call (idempotent payload)
    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
    }>
    expect(valuesCall).toHaveLength(21)

    // Verify onConflictDoNothing ensures existing rows remain unchanged
    // (The DB layer handles this — the function just sends the same payload with DO NOTHING)
  })

  // =========================================================================
  // AC-7: GIVEN queries.ts wird importiert
  //       WHEN die Exports geprueft werden
  //       THEN existieren KEINE Exports fuer getAllModelSettings, getModelSettingByModeTier,
  //            upsertModelSetting, seedModelSettingsDefaults
  //       AND der Import von modelSettings aus ./schema ist entfernt
  //       AND der ModelSetting Type-Export ist entfernt
  // =========================================================================
  it('AC-7: should not export getAllModelSettings, getModelSettingByModeTier, upsertModelSetting, seedModelSettingsDefaults, or ModelSetting type', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const queriesSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'queries.ts'),
      'utf-8'
    )

    // Verify old model_settings function exports do NOT exist in source
    expect(queriesSource).not.toMatch(/export\s+(async\s+)?function\s+getAllModelSettings/)
    expect(queriesSource).not.toMatch(/export\s+(async\s+)?function\s+getModelSettingByModeTier/)
    expect(queriesSource).not.toMatch(/export\s+(async\s+)?function\s+upsertModelSetting/)
    expect(queriesSource).not.toMatch(/export\s+(async\s+)?function\s+seedModelSettingsDefaults/)

    // Verify the old ModelSetting type export is removed
    expect(queriesSource).not.toMatch(/export\s+type\s+ModelSetting\b/)

    // Verify the old modelSettings schema import is removed
    expect(queriesSource).not.toMatch(/\bmodelSettings\b/)

    // Verify old function exports are also not present at runtime
    const exportedNames = Object.keys(queriesModule)
    expect(exportedNames).not.toContain('getAllModelSettings')
    expect(exportedNames).not.toContain('getModelSettingByModeTier')
    expect(exportedNames).not.toContain('upsertModelSetting')
    expect(exportedNames).not.toContain('seedModelSettingsDefaults')

    // Verify new model_slots function exports DO exist at runtime
    expect(exportedNames).toContain('getAllModelSlots')
    expect(exportedNames).toContain('getModelSlotsByMode')
    expect(exportedNames).toContain('upsertModelSlot')
    expect(exportedNames).toContain('seedModelSlotDefaults')

    // Verify the new ModelSlot type export exists in source
    // (Type exports are erased at runtime, so we check source code)
    expect(queriesSource).toMatch(/export\s+type\s+ModelSlot\b/)

    // Verify the exported functions are actual functions
    expect(typeof queriesModule.getAllModelSlots).toBe('function')
    expect(typeof queriesModule.getModelSlotsByMode).toBe('function')
    expect(typeof queriesModule.upsertModelSlot).toBe('function')
    expect(typeof queriesModule.seedModelSlotDefaults).toBe('function')
  })
})
