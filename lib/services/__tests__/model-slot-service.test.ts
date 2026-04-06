/**
 * Unit & Acceptance Tests for ModelSlotService
 *
 * Mocking Strategy: mock_external
 *   - DB query functions from lib/db/queries are mocked
 *   - getModelByReplicateId is mocked (DB dependency for capability lookup)
 *
 * The active toggle was removed in favor of "slot has a model" semantics.
 * Any slot with an assigned model is considered live; there is no
 * separate toggleActive path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the DB query functions
// ---------------------------------------------------------------------------
const mockGetAllModelSlots = vi.fn()
const mockGetModelSlotsByMode = vi.fn()
const mockUpsertModelSlot = vi.fn()
const mockSeedModelSlotDefaults = vi.fn()
const mockGetModelByReplicateId = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getAllModelSlots: (...args: unknown[]) => mockGetAllModelSlots(...args),
  getModelSlotsByMode: (...args: unknown[]) => mockGetModelSlotsByMode(...args),
  upsertModelSlot: (...args: unknown[]) => mockUpsertModelSlot(...args),
  clearModelSlot: vi.fn(),
  seedModelSlotDefaults: (...args: unknown[]) => mockSeedModelSlotDefaults(...args),
  getModelByReplicateId: (...args: unknown[]) => mockGetModelByReplicateId(...args),
}))

// Import AFTER mocks are set up
import { ModelSlotService } from '../model-slot-service'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-29T12:00:00Z')

/** Helper: create a mock ModelSlot row */
function makeSlot(overrides: Partial<{
  id: string
  mode: string
  slot: number
  modelId: string | null
  modelParams: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}>): Record<string, unknown> {
  return {
    id: overrides.id !== undefined ? overrides.id : 'uuid-1',
    mode: overrides.mode !== undefined ? overrides.mode : 'txt2img',
    slot: overrides.slot !== undefined ? overrides.slot : 1,
    modelId: 'modelId' in overrides ? overrides.modelId : 'black-forest-labs/flux-schnell',
    modelParams: overrides.modelParams !== undefined ? overrides.modelParams : {},
    createdAt: overrides.createdAt !== undefined ? overrides.createdAt : NOW,
    updatedAt: overrides.updatedAt !== undefined ? overrides.updatedAt : NOW,
  }
}

/** All 21 seed default rows. */
function makeAll21Rows(): Record<string, unknown>[] {
  return [
    makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: {} }),
    makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: {} }),
    makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', modelParams: {} }),
    makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: { prompt_strength: 0.6 } }),
    makeSlot({ id: 'uuid-05', mode: 'img2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: { prompt_strength: 0.6 } }),
    makeSlot({ id: 'uuid-06', mode: 'img2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', modelParams: { prompt_strength: 0.6 } }),
    makeSlot({ id: 'uuid-07', mode: 'upscale', slot: 1, modelId: 'philz1337x/crystal-upscaler', modelParams: { scale: 4 } }),
    makeSlot({ id: 'uuid-08', mode: 'upscale', slot: 2, modelId: 'nightmareai/real-esrgan', modelParams: { scale: 2 } }),
    makeSlot({ id: 'uuid-09', mode: 'upscale', slot: 3, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-10', mode: 'inpaint', slot: 1, modelId: 'black-forest-labs/flux-fill-pro', modelParams: {} }),
    makeSlot({ id: 'uuid-11', mode: 'inpaint', slot: 2, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-12', mode: 'inpaint', slot: 3, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-13', mode: 'outpaint', slot: 1, modelId: 'black-forest-labs/flux-fill-pro', modelParams: {} }),
    makeSlot({ id: 'uuid-14', mode: 'outpaint', slot: 2, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-15', mode: 'outpaint', slot: 3, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-16', mode: 'erase', slot: 1, modelId: 'bria/eraser', modelParams: {} }),
    makeSlot({ id: 'uuid-17', mode: 'erase', slot: 2, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-18', mode: 'erase', slot: 3, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-19', mode: 'instruction', slot: 1, modelId: 'black-forest-labs/flux-kontext-pro', modelParams: {} }),
    makeSlot({ id: 'uuid-20', mode: 'instruction', slot: 2, modelId: null, modelParams: {} }),
    makeSlot({ id: 'uuid-21', mode: 'instruction', slot: 3, modelId: null, modelParams: {} }),
  ]
}

/**
 * Helper: create a mock Model object with capabilities JSONB.
 */
function makeModel(replicateId: string, capabilities: Record<string, boolean>) {
  return {
    id: `model-${replicateId.replace('/', '-')}`,
    replicateId,
    displayName: replicateId,
    description: null,
    inputSchema: {},
    capabilities,
    isActive: true,
    runCount: 0,
    coverImageUrl: null,
    collectionSlugs: [],
    createdAt: NOW,
    updatedAt: NOW,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelSlotService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // getAll()
  // =========================================================================

  describe('getAll()', () => {
    it('should return all 21 model slots', async () => {
      const all21 = makeAll21Rows()
      mockGetAllModelSlots.mockResolvedValueOnce(all21)

      const result = await ModelSlotService.getAll()

      expect(result).toHaveLength(21)
      expect(result).toEqual(all21)

      expect(mockGetAllModelSlots).toHaveBeenCalledTimes(1)
      expect(mockSeedModelSlotDefaults).not.toHaveBeenCalled()
    })

    it('should seed defaults and return 21 rows when table is empty', async () => {
      const all21 = makeAll21Rows()
      mockGetAllModelSlots
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(all21)
      mockSeedModelSlotDefaults.mockResolvedValueOnce(undefined)

      const result = await ModelSlotService.getAll()

      expect(mockSeedModelSlotDefaults).toHaveBeenCalledTimes(1)
      expect(mockGetAllModelSlots).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(21)
      expect(result).toEqual(all21)
    })
  })

  // =========================================================================
  // getForMode()
  // =========================================================================

  describe('getForMode()', () => {
    it('should return exactly 3 slots for the given mode', async () => {
      const txt2imgSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell' }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro' }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max' }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(txt2imgSlots)

      const result = await ModelSlotService.getForMode('txt2img')

      expect(result).toHaveLength(3)

      for (const row of result) {
        expect(row.mode).toBe('txt2img')
      }

      const slotNumbers = result.map((r: Record<string, unknown>) => r.slot)
      expect(slotNumbers).toEqual([1, 2, 3])

      expect(mockGetModelSlotsByMode).toHaveBeenCalledWith('txt2img')
      expect(mockGetModelSlotsByMode).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    it('should update model_id when model is compatible with mode', async () => {
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell' }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro' }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max' }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-01',
        mode: 'txt2img',
        slot: 1,
        modelId: 'black-forest-labs/flux-2-pro',
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('txt2img', 1 as const, 'black-forest-labs/flux-2-pro')

      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).modelId).toBe('black-forest-labs/flux-2-pro')

      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
      expect(mockUpsertModelSlot).toHaveBeenCalledWith(
        'txt2img',
        1,
        'black-forest-labs/flux-2-pro',
        {}  // existing modelParams
      )
    })

    it('should return error when model capabilities indicate incompatibility', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('some-org/img-only-model', { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false })
      )

      const result = await ModelSlotService.update('img2img', 1 as const, 'some-org/img-only-model')

      expect(result).toEqual({ error: 'Model not compatible with mode' })
      expect(mockUpsertModelSlot).not.toHaveBeenCalled()
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('some-org/img-only-model')
    })

    it('should allow update when model is not found in catalog', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(null)

      const existingSlots = [
        makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: { prompt_strength: 0.6 } }),
        makeSlot({ id: 'uuid-05', mode: 'img2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: { prompt_strength: 0.6 } }),
        makeSlot({ id: 'uuid-06', mode: 'img2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', modelParams: { prompt_strength: 0.6 } }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-04',
        mode: 'img2img',
        slot: 1,
        modelId: 'unknown-org/new-model',
        modelParams: { prompt_strength: 0.6 },
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('img2img', 1 as const, 'unknown-org/new-model')

      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).modelId).toBe('unknown-org/new-model')

      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('unknown-org/new-model')
    })

    it('should assign a model to a previously empty slot', async () => {
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell' }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: null }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max' }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-02',
        mode: 'txt2img',
        slot: 2,
        modelId: 'black-forest-labs/flux-2-pro',
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('txt2img', 2 as const, 'black-forest-labs/flux-2-pro')

      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).modelId).toBe('black-forest-labs/flux-2-pro')

      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
      expect(mockUpsertModelSlot).toHaveBeenCalledWith(
        'txt2img',
        2,
        'black-forest-labs/flux-2-pro',
        {}
      )
    })
  })

  // =========================================================================
  // seedDefaults()
  // =========================================================================

  describe('seedDefaults()', () => {
    it('should call seedModelSlotDefaults once', async () => {
      mockSeedModelSlotDefaults.mockResolvedValueOnce(undefined)

      await ModelSlotService.seedDefaults()

      expect(mockSeedModelSlotDefaults).toHaveBeenCalledTimes(1)
      expect(mockSeedModelSlotDefaults).toHaveBeenCalledWith()
    })
  })

  // =========================================================================
  // Integration / Edge Case Tests (Unit scope)
  // =========================================================================

  describe('checkCompatibility (internal, tested via update())', () => {
    it('should skip DB lookup for txt2img mode (always compatible)', async () => {
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell' }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)
      mockUpsertModelSlot.mockResolvedValueOnce(
        makeSlot({ modelId: 'any/model', mode: 'txt2img', slot: 1 })
      )

      const result = await ModelSlotService.update('txt2img', 1 as const, 'any/model')

      expect(result).not.toHaveProperty('error')
      expect(mockGetModelByReplicateId).not.toHaveBeenCalled()
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
    })

    it('should allow update when model has null capabilities (fallback true)', async () => {
      const modelWithNullCaps = makeModel('owner/model', {} as Record<string, boolean>)
      modelWithNullCaps.capabilities = null as unknown as Record<string, boolean>
      mockGetModelByReplicateId.mockResolvedValueOnce(modelWithNullCaps)

      const existingSlots = [
        makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'old/model', modelParams: { prompt_strength: 0.6 } }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)
      mockUpsertModelSlot.mockResolvedValueOnce(
        makeSlot({ modelId: 'owner/model', mode: 'img2img', slot: 1 })
      )

      const result = await ModelSlotService.update('img2img', 1 as const, 'owner/model')

      expect(result).not.toHaveProperty('error')
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
    })

    it('should allow update when DB lookup throws (fallback true)', async () => {
      mockGetModelByReplicateId.mockRejectedValueOnce(new Error('DB connection failed'))

      const existingSlots = [
        makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'old/model', modelParams: { prompt_strength: 0.6 } }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)
      mockUpsertModelSlot.mockResolvedValueOnce(
        makeSlot({ modelId: 'owner/model', mode: 'img2img', slot: 1 })
      )

      const result = await ModelSlotService.update('img2img', 1 as const, 'owner/model')

      expect(result).not.toHaveProperty('error')
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
    })
  })
})
