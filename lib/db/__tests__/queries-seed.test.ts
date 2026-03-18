/**
 * Tests for seedModelSettingsDefaults() in lib/db/queries.ts
 * Slice: slice-08-types-seed
 *
 * Mocking Strategy: mock_external (DB layer is mocked per spec)
 *
 * ACs covered: AC-9, AC-10, AC-11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the db module before importing queries
// ---------------------------------------------------------------------------

function createChainableMock(resolvedValue: unknown = undefined) {
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
import { seedModelSettingsDefaults } from '../queries'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedModelSettingsDefaults (slice-08-types-seed)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChain = createChainableMock(undefined)
  })

  /**
   * AC-9: GIVEN seedModelSettingsDefaults() wird aufgerufen auf eine leere model_settings-Tabelle
   *       WHEN die eingefuegten Rows gezaehlt werden
   *       THEN sind es exakt 9 Rows: txt2img/draft, txt2img/quality, txt2img/max,
   *            img2img/draft, img2img/quality, upscale/quality, upscale/max,
   *            inpaint/quality, outpaint/quality
   */
  it('AC-9: should insert exactly 9 default rows', async () => {
    await seedModelSettingsDefaults()

    // Verify insert was called
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()

    // Extract the values passed to insert
    const valuesCall = mockChain.values.mock.calls[0][0]
    expect(valuesCall).toHaveLength(9)

    // Verify all 9 expected mode/tier combinations exist
    const expectedCombinations = [
      { mode: 'txt2img', tier: 'draft' },
      { mode: 'txt2img', tier: 'quality' },
      { mode: 'txt2img', tier: 'max' },
      { mode: 'img2img', tier: 'draft' },
      { mode: 'img2img', tier: 'quality' },
      { mode: 'upscale', tier: 'quality' },
      { mode: 'upscale', tier: 'max' },
      { mode: 'inpaint', tier: 'quality' },
      { mode: 'outpaint', tier: 'quality' },
    ]

    for (const expected of expectedCombinations) {
      const found = valuesCall.find(
        (v: { mode: string; tier: string }) =>
          v.mode === expected.mode && v.tier === expected.tier
      )
      expect(found, `Expected row for ${expected.mode}/${expected.tier}`).toBeDefined()
    }

    // Verify each row has required fields
    for (const row of valuesCall) {
      expect(row).toHaveProperty('mode')
      expect(row).toHaveProperty('tier')
      expect(row).toHaveProperty('modelId')
      expect(row).toHaveProperty('modelParams')
    }

    // Verify onConflictDoNothing is used for idempotency
    expect(mockChain.onConflictDoNothing).toHaveBeenCalled()
  })

  /**
   * AC-10: GIVEN seedModelSettingsDefaults() Rows
   *        WHEN die img2img-Rows geprueft werden
   *        THEN existiert KEINE Row mit mode = "img2img" und tier = "max"
   */
  it('AC-10: should not include img2img/max row', async () => {
    await seedModelSettingsDefaults()

    const valuesCall = mockChain.values.mock.calls[0][0]

    // Verify no img2img/max combination exists
    const img2imgMax = valuesCall.find(
      (v: { mode: string; tier: string }) =>
        v.mode === 'img2img' && v.tier === 'max'
    )
    expect(img2imgMax, 'img2img/max should NOT exist in seed data').toBeUndefined()

    // Verify img2img rows are only draft and quality
    const img2imgRows = valuesCall.filter(
      (v: { mode: string }) => v.mode === 'img2img'
    )
    expect(img2imgRows).toHaveLength(2)
    expect(img2imgRows.map((r: { tier: string }) => r.tier).sort()).toEqual([
      'draft',
      'quality',
    ])
  })

  /**
   * AC-11: GIVEN seedModelSettingsDefaults() Rows
   *        WHEN die upscale-Rows geprueft werden
   *        THEN existiert KEINE Row mit mode = "upscale" und tier = "draft"
   */
  it('AC-11: should not include upscale/draft row', async () => {
    await seedModelSettingsDefaults()

    const valuesCall = mockChain.values.mock.calls[0][0]

    // Verify no upscale/draft combination exists
    const upscaleDraft = valuesCall.find(
      (v: { mode: string; tier: string }) =>
        v.mode === 'upscale' && v.tier === 'draft'
    )
    expect(upscaleDraft, 'upscale/draft should NOT exist in seed data').toBeUndefined()

    // Verify upscale rows are only quality and max
    const upscaleRows = valuesCall.filter(
      (v: { mode: string }) => v.mode === 'upscale'
    )
    expect(upscaleRows).toHaveLength(2)
    expect(upscaleRows.map((r: { tier: string }) => r.tier).sort()).toEqual([
      'max',
      'quality',
    ])
  })
})
