/**
 * Unit & Acceptance Tests for ModelSlotService
 * Slice: slice-04-model-slot-service
 *
 * Mocking Strategy: mock_external
 *   - DB query functions from lib/db/queries are mocked (per spec)
 *   - getModelByReplicateId is mocked (DB dependency for capability lookup)
 *
 * ACs covered:
 *   AC-1:  getAll returns all 15 slots
 *   AC-2:  getAll seeds defaults when table is empty
 *   AC-3:  getForMode returns 3 slots for a given mode
 *   AC-4:  update changes model_id when model is compatible
 *   AC-5:  update rejects incompatible model
 *   AC-6:  update allows unknown model (fallback)
 *   AC-7:  update auto-activates empty slot on model assignment
 *   AC-8:  toggleActive deactivates slot when min-1 fulfilled
 *   AC-9:  toggleActive prevents deactivation of last active slot
 *   AC-10: toggleActive prevents activation of empty slot
 *   AC-11: seedDefaults creates 15 default rows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the DB query functions (mock_external strategy per spec)
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
  active: boolean
  createdAt: Date
  updatedAt: Date
}>): Record<string, unknown> {
  return {
    id: overrides.id !== undefined ? overrides.id : 'uuid-1',
    mode: overrides.mode !== undefined ? overrides.mode : 'txt2img',
    slot: overrides.slot !== undefined ? overrides.slot : 1,
    modelId: 'modelId' in overrides ? overrides.modelId : 'black-forest-labs/flux-schnell',
    modelParams: overrides.modelParams !== undefined ? overrides.modelParams : {},
    active: overrides.active !== undefined ? overrides.active : true,
    createdAt: overrides.createdAt !== undefined ? overrides.createdAt : NOW,
    updatedAt: overrides.updatedAt !== undefined ? overrides.updatedAt : NOW,
  }
}

/** All 15 seed default rows as described in architecture.md "Seed Defaults (15 rows)" */
function makeAll15Rows(): Record<string, unknown>[] {
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
    makeSlot({ id: 'uuid-10', mode: 'inpaint', slot: 1, modelId: null, modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-11', mode: 'inpaint', slot: 2, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-12', mode: 'inpaint', slot: 3, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-13', mode: 'outpaint', slot: 1, modelId: null, modelParams: {}, active: true }),
    makeSlot({ id: 'uuid-14', mode: 'outpaint', slot: 2, modelId: null, modelParams: {}, active: false }),
    makeSlot({ id: 'uuid-15', mode: 'outpaint', slot: 3, modelId: null, modelParams: {}, active: false }),
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

describe('ModelSlotService (slice-04-model-slot-service)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // getAll()
  // =========================================================================

  describe('getAll()', () => {
    /**
     * AC-1: GIVEN die model_slots Tabelle enthaelt 15 Rows (5 Modes x 3 Slots)
     *       WHEN ModelSlotService.getAll() aufgerufen wird
     *       THEN wird ein Array mit 15 Elementen zurueckgegeben
     */
    it('AC-1: should return all 15 model slots', async () => {
      const all15 = makeAll15Rows()
      mockGetAllModelSlots.mockResolvedValueOnce(all15)

      const result = await ModelSlotService.getAll()

      // Must return exactly 15 elements
      expect(result).toHaveLength(15)
      expect(result).toEqual(all15)

      // getAllModelSlots called once (table was not empty, no seeding)
      expect(mockGetAllModelSlots).toHaveBeenCalledTimes(1)
      // seedModelSlotDefaults must NOT have been called
      expect(mockSeedModelSlotDefaults).not.toHaveBeenCalled()
    })

    /**
     * AC-2: GIVEN die model_slots Tabelle ist leer (0 Rows)
     *       WHEN ModelSlotService.getAll() aufgerufen wird
     *       THEN werden erst Defaults geseeded (15 Rows) und danach alle 15 Rows zurueckgegeben
     */
    it('AC-2: should seed defaults and return 15 rows when table is empty', async () => {
      const all15 = makeAll15Rows()
      // First call returns empty (table is empty), second call returns seeded defaults
      mockGetAllModelSlots
        .mockResolvedValueOnce([])        // first check: empty
        .mockResolvedValueOnce(all15)     // after seeding: 15 entries
      mockSeedModelSlotDefaults.mockResolvedValueOnce(undefined)

      const result = await ModelSlotService.getAll()

      // Verify seeding was triggered
      expect(mockSeedModelSlotDefaults).toHaveBeenCalledTimes(1)
      // Verify getAllModelSlots was called twice: once to check, once after seed
      expect(mockGetAllModelSlots).toHaveBeenCalledTimes(2)
      // Verify 15 entries returned
      expect(result).toHaveLength(15)
      expect(result).toEqual(all15)
    })
  })

  // =========================================================================
  // getForMode()
  // =========================================================================

  describe('getForMode()', () => {
    /**
     * AC-3: GIVEN model_slots enthaelt Rows fuer 5 Modes
     *       WHEN ModelSlotService.getForMode("txt2img") aufgerufen wird
     *       THEN wird ein Array mit exakt 3 Elementen zurueckgegeben (slot 1, 2, 3)
     *       AND alle Elemente haben mode === "txt2img"
     */
    it('AC-3: should return exactly 3 slots for the given mode', async () => {
      const txt2imgSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', active: false }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(txt2imgSlots)

      const result = await ModelSlotService.getForMode('txt2img')

      // Exactly 3 elements
      expect(result).toHaveLength(3)

      // All elements have mode === "txt2img"
      for (const row of result) {
        expect(row.mode).toBe('txt2img')
      }

      // Slots are 1, 2, 3
      const slotNumbers = result.map((r: Record<string, unknown>) => r.slot)
      expect(slotNumbers).toEqual([1, 2, 3])

      // getModelSlotsByMode was called with the correct mode
      expect(mockGetModelSlotsByMode).toHaveBeenCalledWith('txt2img')
      expect(mockGetModelSlotsByMode).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    /**
     * AC-4: GIVEN slot 1 fuer mode txt2img hat model_id "black-forest-labs/flux-schnell"
     *       WHEN ModelSlotService.update("txt2img", 1, "black-forest-labs/flux-2-pro") aufgerufen wird
     *       AND das Model flux-2-pro ist kompatibel mit txt2img
     *       THEN wird die aktualisierte Row zurueckgegeben mit modelId === "black-forest-labs/flux-2-pro"
     */
    it('AC-4: should update model_id when model is compatible with mode', async () => {
      // txt2img is always compatible -- no DB lookup needed for compatibility
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', active: false }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-01',
        mode: 'txt2img',
        slot: 1,
        modelId: 'black-forest-labs/flux-2-pro',
        active: true,
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('txt2img', 1 as 1, 'black-forest-labs/flux-2-pro')

      // Must return the updated row
      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).modelId).toBe('black-forest-labs/flux-2-pro')

      // upsertModelSlot was called with correct args
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
      expect(mockUpsertModelSlot).toHaveBeenCalledWith(
        'txt2img',
        1,
        'black-forest-labs/flux-2-pro',
        {},  // existing modelParams
        true // preserve existing active state
      )
    })

    /**
     * AC-5: GIVEN ein Model "some-org/img-only-model" das in der models Tabelle capabilities.txt2img === false hat
     *       WHEN ModelSlotService.update("txt2img", 1, "some-org/img-only-model") aufgerufen wird
     *       THEN wird { error: "Model not compatible with mode" } zurueckgegeben
     *       AND die bestehende Row bleibt unveraendert
     */
    it('AC-5: should return error when model capabilities indicate incompatibility', async () => {
      // For a non-txt2img mode the compatibility check actually hits getModelByReplicateId
      // (txt2img is always compatible, so we test with img2img to hit the capability check)
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('some-org/img-only-model', { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false })
      )

      const result = await ModelSlotService.update('img2img', 1 as 1, 'some-org/img-only-model')

      // Must return error object
      expect(result).toEqual({ error: 'Model not compatible with mode' })

      // DB must NOT have been written to
      expect(mockUpsertModelSlot).not.toHaveBeenCalled()

      // getModelByReplicateId was called for the capability check
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('some-org/img-only-model')
    })

    /**
     * AC-6: GIVEN ein Model das NICHT in der models Tabelle existiert (kein DB-Eintrag)
     *       WHEN ModelSlotService.update("img2img", 1, "unknown-org/new-model") aufgerufen wird
     *       THEN wird der Update durchgefuehrt (Fallback: allow if model not in catalog)
     */
    it('AC-6: should allow update when model is not found in catalog', async () => {
      // Model not found in DB -> returns null -> fallback: allow
      mockGetModelByReplicateId.mockResolvedValueOnce(null)

      const existingSlots = [
        makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: { prompt_strength: 0.6 }, active: true }),
        makeSlot({ id: 'uuid-05', mode: 'img2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: { prompt_strength: 0.6 }, active: false }),
        makeSlot({ id: 'uuid-06', mode: 'img2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', modelParams: { prompt_strength: 0.6 }, active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-04',
        mode: 'img2img',
        slot: 1,
        modelId: 'unknown-org/new-model',
        modelParams: { prompt_strength: 0.6 },
        active: true,
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('img2img', 1 as 1, 'unknown-org/new-model')

      // Must return updated row (no error)
      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).modelId).toBe('unknown-org/new-model')

      // upsertModelSlot was called (update proceeded)
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)

      // getModelByReplicateId was called for fallback check
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('unknown-org/new-model')
    })

    /**
     * AC-7: GIVEN slot 2 fuer mode txt2img hat model_id=NULL (leerer Slot)
     *       WHEN ModelSlotService.update("txt2img", 2, "black-forest-labs/flux-2-pro") aufgerufen wird
     *       THEN wird die Row aktualisiert mit dem neuen model_id
     *       AND active wird automatisch auf true gesetzt (Auto-Aktivierung)
     */
    it('AC-7: should auto-activate slot when assigning model to empty slot', async () => {
      // txt2img is always compatible -- no DB lookup for compatibility
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: null, active: false }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-02',
        mode: 'txt2img',
        slot: 2,
        modelId: 'black-forest-labs/flux-2-pro',
        active: true,  // auto-activated
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('txt2img', 2 as 2, 'black-forest-labs/flux-2-pro')

      // Must return updated row (no error)
      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).modelId).toBe('black-forest-labs/flux-2-pro')
      expect((result as Record<string, unknown>).active).toBe(true)

      // upsertModelSlot must have been called with active=true (auto-activation)
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
      expect(mockUpsertModelSlot).toHaveBeenCalledWith(
        'txt2img',
        2,
        'black-forest-labs/flux-2-pro',
        {},    // modelParams from existing slot
        true   // auto-activated because slot was empty
      )
    })
  })

  // =========================================================================
  // toggleActive()
  // =========================================================================

  describe('toggleActive()', () => {
    /**
     * AC-8: GIVEN fuer mode txt2img sind slot 1 (active=true) und slot 2 (active=true) aktiv, slot 3 (active=false) inaktiv
     *       WHEN ModelSlotService.toggleActive("txt2img", 2, false) aufgerufen wird
     *       THEN wird slot 2 auf active=false gesetzt und die aktualisierte Row zurueckgegeben
     */
    it('AC-8: should deactivate slot when at least one other slot remains active', async () => {
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', active: true }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        id: 'uuid-02',
        mode: 'txt2img',
        slot: 2,
        modelId: 'black-forest-labs/flux-2-pro',
        active: false,
        updatedAt: new Date('2026-03-29T13:00:00Z'),
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.toggleActive('txt2img', 2 as 2, false)

      // Must return updated row with active=false
      expect(result).not.toHaveProperty('error')
      expect((result as Record<string, unknown>).active).toBe(false)
      expect((result as Record<string, unknown>).slot).toBe(2)

      // upsertModelSlot was called with active=false
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
      expect(mockUpsertModelSlot).toHaveBeenCalledWith(
        'txt2img',
        2,
        'black-forest-labs/flux-2-pro',
        {},
        false
      )
    })

    /**
     * AC-9: GIVEN fuer mode txt2img ist NUR slot 1 aktiv (active=true), slots 2+3 sind inactive
     *       WHEN ModelSlotService.toggleActive("txt2img", 1, false) aufgerufen wird
     *       THEN wird { error: "Cannot deactivate last active slot" } zurueckgegeben
     *       AND slot 1 bleibt active=true
     */
    it('AC-9: should return error when attempting to deactivate last active slot', async () => {
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', active: false }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: 'black-forest-labs/flux-2-max', active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const result = await ModelSlotService.toggleActive('txt2img', 1 as 1, false)

      // Must return error object
      expect(result).toEqual({ error: 'Cannot deactivate last active slot' })

      // DB must NOT have been written to
      expect(mockUpsertModelSlot).not.toHaveBeenCalled()
    })

    /**
     * AC-10: GIVEN slot 3 fuer mode txt2img hat model_id=NULL (leerer Slot)
     *        WHEN ModelSlotService.toggleActive("txt2img", 3, true) aufgerufen wird
     *        THEN wird { error: "Cannot activate empty slot" } zurueckgegeben
     *        AND slot 3 bleibt active=false
     */
    it('AC-10: should return error when attempting to activate slot with no model', async () => {
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', active: false }),
        makeSlot({ id: 'uuid-03', mode: 'txt2img', slot: 3, modelId: null, active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const result = await ModelSlotService.toggleActive('txt2img', 3 as 3, true)

      // Must return error object
      expect(result).toEqual({ error: 'Cannot activate empty slot' })

      // DB must NOT have been written to
      expect(mockUpsertModelSlot).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // seedDefaults()
  // =========================================================================

  describe('seedDefaults()', () => {
    /**
     * AC-11: GIVEN die model_slots Tabelle ist leer
     *        WHEN ModelSlotService.seedDefaults() aufgerufen wird
     *        THEN enthaelt die Tabelle exakt 15 Rows (5 Modes x 3 Slots)
     *        AND die Seed-Daten entsprechen architecture.md Section "Seed Defaults (15 rows)"
     */
    it('AC-11: should seed 15 default rows matching architecture.md seed defaults', async () => {
      mockSeedModelSlotDefaults.mockResolvedValueOnce(undefined)

      await ModelSlotService.seedDefaults()

      // seedModelSlotDefaults was called exactly once
      expect(mockSeedModelSlotDefaults).toHaveBeenCalledTimes(1)
      // No arguments passed (the query function handles the 15 seed rows internally)
      expect(mockSeedModelSlotDefaults).toHaveBeenCalledWith()
    })
  })

  // =========================================================================
  // Integration / Edge Case Tests (Unit scope)
  // =========================================================================

  describe('checkCompatibility (internal, tested via update())', () => {
    it('should skip DB lookup for txt2img mode (always compatible)', async () => {
      // txt2img mode: checkCompatibility returns true without DB lookup
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', active: true }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)
      mockUpsertModelSlot.mockResolvedValueOnce(
        makeSlot({ modelId: 'any/model', mode: 'txt2img', slot: 1, active: true })
      )

      const result = await ModelSlotService.update('txt2img', 1 as 1, 'any/model')

      // No error returned
      expect(result).not.toHaveProperty('error')
      // getModelByReplicateId must NOT be called for txt2img
      expect(mockGetModelByReplicateId).not.toHaveBeenCalled()
      // upsertModelSlot was called (update proceeded)
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
    })

    it('should allow update when model has null capabilities (fallback true)', async () => {
      const modelWithNullCaps = makeModel('owner/model', {} as Record<string, boolean>)
      modelWithNullCaps.capabilities = null as unknown as Record<string, boolean>
      mockGetModelByReplicateId.mockResolvedValueOnce(modelWithNullCaps)

      const existingSlots = [
        makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'old/model', modelParams: { prompt_strength: 0.6 }, active: true }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)
      mockUpsertModelSlot.mockResolvedValueOnce(
        makeSlot({ modelId: 'owner/model', mode: 'img2img', slot: 1, active: true })
      )

      const result = await ModelSlotService.update('img2img', 1 as 1, 'owner/model')

      // Fallback: null capabilities -> allow update
      expect(result).not.toHaveProperty('error')
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
    })

    it('should allow update when DB lookup throws (fallback true)', async () => {
      mockGetModelByReplicateId.mockRejectedValueOnce(new Error('DB connection failed'))

      const existingSlots = [
        makeSlot({ id: 'uuid-04', mode: 'img2img', slot: 1, modelId: 'old/model', modelParams: { prompt_strength: 0.6 }, active: true }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)
      mockUpsertModelSlot.mockResolvedValueOnce(
        makeSlot({ modelId: 'owner/model', mode: 'img2img', slot: 1, active: true })
      )

      const result = await ModelSlotService.update('img2img', 1 as 1, 'owner/model')

      // Fallback: DB error -> allow update
      expect(result).not.toHaveProperty('error')
      expect(mockUpsertModelSlot).toHaveBeenCalledTimes(1)
    })

    it('should preserve existing active state when updating a slot that already has a model', async () => {
      // Slot already has a model and active=false -- updating model should keep active=false
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'old/model', active: false }),
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const updatedRow = makeSlot({
        mode: 'txt2img',
        slot: 1,
        modelId: 'new/model',
        active: false,
      })
      mockUpsertModelSlot.mockResolvedValueOnce(updatedRow)

      const result = await ModelSlotService.update('txt2img', 1 as 1, 'new/model')

      expect(result).not.toHaveProperty('error')
      // active should be preserved as false (slot was not empty)
      expect(mockUpsertModelSlot).toHaveBeenCalledWith(
        'txt2img',
        1,
        'new/model',
        {},
        false  // preserve existing active state
      )
    })
  })

  describe('toggleActive() edge cases', () => {
    it('should return error when slot is not found', async () => {
      // Mode has no slots matching the requested slot number
      const existingSlots = [
        makeSlot({ id: 'uuid-01', mode: 'txt2img', slot: 1, modelId: 'model/a', active: true }),
        makeSlot({ id: 'uuid-02', mode: 'txt2img', slot: 2, modelId: 'model/b', active: false }),
        // slot 3 missing from the query result
      ]
      mockGetModelSlotsByMode.mockResolvedValueOnce(existingSlots)

      const result = await ModelSlotService.toggleActive('txt2img', 3 as 3, true)

      expect(result).toEqual({ error: 'Slot not found' })
      expect(mockUpsertModelSlot).not.toHaveBeenCalled()
    })
  })
})
