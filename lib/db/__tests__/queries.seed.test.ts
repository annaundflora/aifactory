/**
 * Tests for seedModelSlotDefaults() in lib/db/queries.ts
 * Slice: slice-01-types-model-slots
 *
 * Mocking Strategy: mock_external (DB via Vitest mocks, kein echter DB-Zugriff)
 * Reason: The mocking strategy follows the spec's `test_containers` hint but
 *         since no test container is available, we mock the DB layer as in the
 *         existing queries-model-slots.test.ts pattern.
 *
 * ACs covered:
 *   AC-3: 21 Rows nach Seed (7 Modi x 3 Slots)
 *   AC-4: Korrekte Default-Modell-IDs fuer Slot 1
 *   AC-5: Null-Modelle fuer leere Slots
 *   AC-6: Idempotenz
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
import { seedModelSlotDefaults } from '../queries'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedModelSlotDefaults() — Slice 01 Types & Model Slot Defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // AC-3: GIVEN eine leere Datenbank
  //       WHEN seedModelSlotDefaults() aufgerufen wird
  //       THEN existieren 21 Rows in model_slots (7 Modi x 3 Slots)
  // =========================================================================
  it('AC-3: should create 21 model_slot rows for 7 modes x 3 slots', async () => {
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

    // Must be exactly 21 rows (7 modes x 3 slots)
    expect(valuesCall).toHaveLength(21)

    // Verify all 7 modes are present
    const modes = [...new Set(valuesCall.map((v) => v.mode))]
    expect(modes.sort()).toEqual([
      'erase',
      'img2img',
      'inpaint',
      'instruction',
      'outpaint',
      'txt2img',
      'upscale',
    ])

    // Verify each mode has exactly 3 slots (1, 2, 3)
    for (const mode of modes) {
      const modeRows = valuesCall.filter((v) => v.mode === mode)
      expect(modeRows, `${mode} should have 3 slots`).toHaveLength(3)

      const slotNumbers = modeRows.map((v) => v.slot).sort()
      expect(slotNumbers, `${mode} slots should be 1, 2, 3`).toEqual([1, 2, 3])
    }
  })

  // =========================================================================
  // AC-4: GIVEN eine leere Datenbank
  //       WHEN seedModelSlotDefaults() aufgerufen wird
  //       THEN hat der Row mode="inpaint", slot=1 die modelId "black-forest-labs/flux-fill-pro"
  //       AND hat der Row mode="erase", slot=1 die modelId "bria/eraser"
  //       AND hat der Row mode="instruction", slot=1 die modelId "black-forest-labs/flux-kontext-pro"
  //       AND hat der Row mode="outpaint", slot=1 die modelId "black-forest-labs/flux-fill-pro"
  // =========================================================================
  it('AC-4: should set correct default modelId for inpaint, erase, instruction, outpaint slot 1', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSlotDefaults()

    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
      modelId: string | null
      modelParams: Record<string, unknown>
      active: boolean
    }>

    // inpaint slot 1 -> "black-forest-labs/flux-fill-pro"
    const inpaint1 = valuesCall.find((v) => v.mode === 'inpaint' && v.slot === 1)
    expect(inpaint1).toBeDefined()
    expect(inpaint1!.modelId).toBe('black-forest-labs/flux-fill-pro')

    // erase slot 1 -> "bria/eraser"
    const erase1 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 1)
    expect(erase1).toBeDefined()
    expect(erase1!.modelId).toBe('bria/eraser')

    // instruction slot 1 -> "black-forest-labs/flux-kontext-pro"
    const instruction1 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 1)
    expect(instruction1).toBeDefined()
    expect(instruction1!.modelId).toBe('black-forest-labs/flux-kontext-pro')

    // outpaint slot 1 -> "black-forest-labs/flux-fill-pro"
    const outpaint1 = valuesCall.find((v) => v.mode === 'outpaint' && v.slot === 1)
    expect(outpaint1).toBeDefined()
    expect(outpaint1!.modelId).toBe('black-forest-labs/flux-fill-pro')
  })

  // =========================================================================
  // AC-5: GIVEN eine leere Datenbank
  //       WHEN seedModelSlotDefaults() aufgerufen wird
  //       THEN haben die Rows mode="erase" slot=2, mode="erase" slot=3,
  //            mode="instruction" slot=2, mode="instruction" slot=3
  //            jeweils modelId = null
  // =========================================================================
  it('AC-5: should set modelId null for erase slot 2/3 and instruction slot 2/3', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSlotDefaults()

    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
      modelId: string | null
      modelParams: Record<string, unknown>
      active: boolean
    }>

    // erase slot 2 -> modelId null
    const erase2 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 2)
    expect(erase2).toBeDefined()
    expect(erase2!.modelId).toBeNull()

    // erase slot 3 -> modelId null
    const erase3 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 3)
    expect(erase3).toBeDefined()
    expect(erase3!.modelId).toBeNull()

    // instruction slot 2 -> modelId null
    const instruction2 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 2)
    expect(instruction2).toBeDefined()
    expect(instruction2!.modelId).toBeNull()

    // instruction slot 3 -> modelId null
    const instruction3 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 3)
    expect(instruction3).toBeDefined()
    expect(instruction3!.modelId).toBeNull()
  })

  // =========================================================================
  // AC-6: GIVEN seedModelSlotDefaults() wurde bereits ausgefuehrt
  //       WHEN seedModelSlotDefaults() erneut aufgerufen wird
  //       THEN bleiben alle 21 Rows unveraendert (Idempotenz via onConflictDoNothing)
  // =========================================================================
  it('AC-6: should be idempotent — second call does not change existing rows', async () => {
    // First call
    mockChain = createChainableMock(undefined)
    await seedModelSlotDefaults()

    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    const firstValues = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
    }>
    expect(firstValues).toHaveLength(21)

    // Second call (simulates calling again with all 21 rows already existing)
    vi.clearAllMocks()
    mockChain = createChainableMock(undefined)

    // Must not throw
    await expect(seedModelSlotDefaults()).resolves.not.toThrow()

    // The function still calls insert with the same 21 values,
    // but with onConflictDoNothing so no rows are actually modified
    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    // Verify the same 21 values are passed on the second call (idempotent payload)
    const secondValues = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
    }>
    expect(secondValues).toHaveLength(21)

    // Verify the values are identical between first and second call
    expect(secondValues).toEqual(firstValues)
  })
})
