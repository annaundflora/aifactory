/**
 * Acceptance Tests for Slice 01: Types & Model Slot Defaults
 * Slice: slice-01-types-model-slots
 *
 * Each test maps 1:1 to an Acceptance Criterion from the slice spec.
 * Tests validate the GenerationMode type extension and seedModelSlotDefaults behavior.
 *
 * Mocking Strategy: no_mocks for types (pure type/const checks),
 *                   mock_external for DB (seedModelSlotDefaults uses DB layer)
 */

import { describe, it, expect, vi, beforeEach, expectTypeOf } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ===========================================================================
// Type-level imports (AC-1, AC-2, AC-7)
// ===========================================================================

import type { GenerationMode } from '@/lib/types'
import { VALID_GENERATION_MODES } from '@/lib/types'

// ===========================================================================
// DB mock setup (AC-3, AC-4, AC-5, AC-6)
// ===========================================================================

function createChainableMock(resolvedValue: unknown = []) {
  const createChain = (): Record<string, ReturnType<typeof vi.fn>> => {
    const proxy: Record<string, ReturnType<typeof vi.fn>> = {}
    const methods = [
      'select', 'insert', 'update', 'delete', 'from', 'where', 'set',
      'values', 'returning', 'orderBy', 'onConflictDoUpdate', 'onConflictDoNothing',
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

vi.mock('@/lib/db/index', () => {
  return {
    get db() {
      return mockChain
    },
  }
})

// Import seedModelSlotDefaults AFTER mock setup
import { seedModelSlotDefaults } from '@/lib/db/queries'

// ===========================================================================
// Acceptance Tests
// ===========================================================================

describe('Slice 01: Types & Model Slot Defaults — Acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // AC-1: GIVEN lib/types.ts wird importiert
  //       WHEN GenerationMode als Type geprueft wird
  //       THEN ist es eine Union aus genau 7 Werten:
  //            "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint" | "erase" | "instruction"
  // =========================================================================
  it('AC-1: GIVEN lib/types.ts wird importiert WHEN GenerationMode als Type geprueft wird THEN ist es eine Union aus genau 7 Werten', () => {
    // Type-level check: GenerationMode must be exactly the 7-member union
    expectTypeOf<GenerationMode>().toEqualTypeOf<
      'txt2img' | 'img2img' | 'upscale' | 'inpaint' | 'outpaint' | 'erase' | 'instruction'
    >()

    // Verify each member is assignable to GenerationMode
    const modes: GenerationMode[] = [
      'txt2img', 'img2img', 'upscale', 'inpaint', 'outpaint', 'erase', 'instruction',
    ]
    expect(modes).toHaveLength(7)

    // Verify "erase" and "instruction" are valid GenerationMode values
    const erase: GenerationMode = 'erase'
    const instruction: GenerationMode = 'instruction'
    expect(erase).toBe('erase')
    expect(instruction).toBe('instruction')
  })

  // =========================================================================
  // AC-2: GIVEN lib/types.ts wird importiert
  //       WHEN VALID_GENERATION_MODES gelesen wird
  //       THEN enthaelt das Array genau 7 Eintraege in der Reihenfolge
  //            ["txt2img", "img2img", "upscale", "inpaint", "outpaint", "erase", "instruction"]
  // =========================================================================
  it('AC-2: GIVEN lib/types.ts wird importiert WHEN VALID_GENERATION_MODES gelesen wird THEN enthaelt das Array genau 7 Eintraege in der korrekten Reihenfolge', () => {
    // Exact order and count
    expect(VALID_GENERATION_MODES).toEqual([
      'txt2img',
      'img2img',
      'upscale',
      'inpaint',
      'outpaint',
      'erase',
      'instruction',
    ])
    expect(VALID_GENERATION_MODES).toHaveLength(7)

    // Verify it is a readonly array
    expect(Array.isArray(VALID_GENERATION_MODES)).toBe(true)

    // Verify individual entries at correct indices
    expect(VALID_GENERATION_MODES[0]).toBe('txt2img')
    expect(VALID_GENERATION_MODES[1]).toBe('img2img')
    expect(VALID_GENERATION_MODES[2]).toBe('upscale')
    expect(VALID_GENERATION_MODES[3]).toBe('inpaint')
    expect(VALID_GENERATION_MODES[4]).toBe('outpaint')
    expect(VALID_GENERATION_MODES[5]).toBe('erase')
    expect(VALID_GENERATION_MODES[6]).toBe('instruction')
  })

  // =========================================================================
  // AC-3: GIVEN eine leere Datenbank
  //       WHEN seedModelSlotDefaults() aufgerufen wird
  //       THEN existieren 21 Rows in model_slots (7 Modi x 3 Slots)
  // =========================================================================
  it('AC-3: GIVEN eine leere Datenbank WHEN seedModelSlotDefaults() aufgerufen wird THEN existieren 21 Rows in model_slots (7 Modi x 3 Slots)', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSlotDefaults()

    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()

    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
      modelId: string | null
    }>

    // Exactly 21 rows
    expect(valuesCall).toHaveLength(21)

    // All 7 modes present
    const modes = [...new Set(valuesCall.map((v) => v.mode))].sort()
    expect(modes).toEqual([
      'erase', 'img2img', 'inpaint', 'instruction', 'outpaint', 'txt2img', 'upscale',
    ])

    // Each mode has exactly 3 slots
    for (const mode of modes) {
      const modeRows = valuesCall.filter((v) => v.mode === mode)
      expect(modeRows).toHaveLength(3)
      const slots = modeRows.map((v) => v.slot).sort()
      expect(slots).toEqual([1, 2, 3])
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
  it('AC-4: GIVEN eine leere Datenbank WHEN seedModelSlotDefaults() aufgerufen wird THEN haben die Slot-1 Rows die korrekten Default-Modell-IDs', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSlotDefaults()

    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
      modelId: string | null
    }>

    // inpaint slot 1
    const inpaint1 = valuesCall.find((v) => v.mode === 'inpaint' && v.slot === 1)
    expect(inpaint1).toBeDefined()
    expect(inpaint1!.modelId).toBe('black-forest-labs/flux-fill-pro')

    // erase slot 1
    const erase1 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 1)
    expect(erase1).toBeDefined()
    expect(erase1!.modelId).toBe('bria/eraser')

    // instruction slot 1
    const instruction1 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 1)
    expect(instruction1).toBeDefined()
    expect(instruction1!.modelId).toBe('black-forest-labs/flux-kontext-pro')

    // outpaint slot 1
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
  it('AC-5: GIVEN eine leere Datenbank WHEN seedModelSlotDefaults() aufgerufen wird THEN haben erase slot 2/3 und instruction slot 2/3 jeweils modelId null', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSlotDefaults()

    const valuesCall = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
      modelId: string | null
    }>

    // erase slot 2
    const erase2 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 2)
    expect(erase2).toBeDefined()
    expect(erase2!.modelId).toBeNull()

    // erase slot 3
    const erase3 = valuesCall.find((v) => v.mode === 'erase' && v.slot === 3)
    expect(erase3).toBeDefined()
    expect(erase3!.modelId).toBeNull()

    // instruction slot 2
    const instruction2 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 2)
    expect(instruction2).toBeDefined()
    expect(instruction2!.modelId).toBeNull()

    // instruction slot 3
    const instruction3 = valuesCall.find((v) => v.mode === 'instruction' && v.slot === 3)
    expect(instruction3).toBeDefined()
    expect(instruction3!.modelId).toBeNull()
  })

  // =========================================================================
  // AC-6: GIVEN seedModelSlotDefaults() wurde bereits ausgefuehrt
  //       WHEN seedModelSlotDefaults() erneut aufgerufen wird
  //       THEN bleiben alle 21 Rows unveraendert (Idempotenz via onConflictDoNothing)
  // =========================================================================
  it('AC-6: GIVEN seedModelSlotDefaults() wurde bereits ausgefuehrt WHEN erneut aufgerufen THEN bleiben alle 21 Rows unveraendert (Idempotenz)', async () => {
    // First call
    mockChain = createChainableMock(undefined)
    await seedModelSlotDefaults()

    const firstCallValues = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
    }>
    expect(firstCallValues).toHaveLength(21)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    // Second call
    vi.clearAllMocks()
    mockChain = createChainableMock(undefined)

    await expect(seedModelSlotDefaults()).resolves.not.toThrow()

    // Same insert with 21 values and onConflictDoNothing
    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    const secondCallValues = mockChain.values.mock.calls[0][0] as Array<{
      mode: string
      slot: number
    }>
    expect(secondCallValues).toHaveLength(21)

    // Payload is identical between calls (idempotent)
    expect(secondCallValues).toEqual(firstCallValues)
  })

  // =========================================================================
  // AC-7: GIVEN bestehende Tests in lib/__tests__/types.test.ts
  //       WHEN die Tests die alte 5er-Union pruefen
  //       THEN muessen diese Tests auf die neue 7er-Union angepasst werden
  //            damit pnpm test gruen bleibt
  // =========================================================================
  it('AC-7: GIVEN bestehende Tests in types.test.ts WHEN geprueft wird THEN referenzieren sie die 7er-Union (nicht die alte 5er)', () => {
    // Read the actual types.test.ts source to verify it tests the 7-member union
    const testSource = readFileSync(
      resolve(__dirname, '../../lib/__tests__/types.test.ts'),
      'utf-8'
    )

    // The test file must reference all 7 modes
    expect(testSource).toContain('"erase"')
    expect(testSource).toContain('"instruction"')
    expect(testSource).toContain('"txt2img"')
    expect(testSource).toContain('"img2img"')
    expect(testSource).toContain('"upscale"')
    expect(testSource).toContain('"inpaint"')
    expect(testSource).toContain('"outpaint"')

    // The test file must NOT reference a 5-element assertion for VALID_GENERATION_MODES
    // (the old 5er-Union had only txt2img, img2img, upscale, inpaint, outpaint)
    expect(testSource).not.toMatch(/toHaveLength\(5\)/)

    // The test file should assert 7 entries
    expect(testSource).toMatch(/toHaveLength\(7\)/)

    // Read the types source to confirm the 7-member union exists
    const typesSource = readFileSync(
      resolve(__dirname, '../../lib/types.ts'),
      'utf-8'
    )

    // GenerationMode must include "erase" and "instruction"
    expect(typesSource).toMatch(/"erase"/)
    expect(typesSource).toMatch(/"instruction"/)

    // VALID_GENERATION_MODES must include all 7 modes
    expect(typesSource).toMatch(/VALID_GENERATION_MODES/)
  })
})
