/**
 * Unit & Acceptance Tests for ModelSettingsService
 * Slice: slice-07-service-replace (updated from slice-02)
 *
 * Mocking Strategy: mock_external
 *   - DB query functions from lib/db/queries are mocked
 *   - getModelByReplicateId is mocked (DB dependency for capability lookup)
 *
 * ACs covered:
 *   - slice-02: AC-9, AC-10, AC-15, AC-16 (getAll, update)
 *   - slice-07: AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12 (checkCompatibility DB-backed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Mock the DB query functions
// ---------------------------------------------------------------------------
const mockGetAllModelSettings = vi.fn()
const mockGetModelSettingByModeTier = vi.fn()
const mockUpsertModelSetting = vi.fn()
const mockSeedModelSettingsDefaults = vi.fn()
const mockGetModelByReplicateId = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getAllModelSettings: (...args: unknown[]) => mockGetAllModelSettings(...args),
  getModelSettingByModeTier: (...args: unknown[]) => mockGetModelSettingByModeTier(...args),
  upsertModelSetting: (...args: unknown[]) => mockUpsertModelSetting(...args),
  seedModelSettingsDefaults: (...args: unknown[]) => mockSeedModelSettingsDefaults(...args),
  getModelByReplicateId: (...args: unknown[]) => mockGetModelByReplicateId(...args),
}))

// Import AFTER mocks
import { ModelSettingsService } from '../model-settings-service'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-14T12:00:00Z')

const DEFAULT_SETTINGS = [
  { id: 'uuid-1', mode: 'txt2img', tier: 'draft', modelId: 'black-forest-labs/flux-schnell', modelParams: {}, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-2', mode: 'txt2img', tier: 'quality', modelId: 'black-forest-labs/flux-2-pro', modelParams: {}, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-3', mode: 'txt2img', tier: 'max', modelId: 'black-forest-labs/flux-2-max', modelParams: {}, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-4', mode: 'img2img', tier: 'draft', modelId: 'black-forest-labs/flux-schnell', modelParams: { prompt_strength: 0.6 }, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-5', mode: 'img2img', tier: 'quality', modelId: 'black-forest-labs/flux-2-pro', modelParams: { prompt_strength: 0.6 }, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-6', mode: 'img2img', tier: 'max', modelId: 'black-forest-labs/flux-2-max', modelParams: { prompt_strength: 0.6 }, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-7', mode: 'upscale', tier: 'draft', modelId: 'nightmareai/real-esrgan', modelParams: { scale: 2 }, createdAt: NOW, updatedAt: NOW },
  { id: 'uuid-8', mode: 'upscale', tier: 'quality', modelId: 'philz1337x/crystal-upscaler', modelParams: { scale: 4 }, createdAt: NOW, updatedAt: NOW },
]

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

describe('ModelSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll()', () => {
    // AC-9 (slice-02): GIVEN ModelSettingsService.getAll() wird aufgerufen und die Tabelle ist leer
    //       WHEN der Service die Abfrage ausfuehrt
    //       THEN werden zuerst Defaults geseeded und danach die 8 Default-Eintraege zurueckgegeben
    it('AC-9: should seed defaults and return 8 entries when table is empty', async () => {
      // First call returns empty (table is empty), second call returns seeded defaults
      mockGetAllModelSettings
        .mockResolvedValueOnce([])           // first check: empty
        .mockResolvedValueOnce(DEFAULT_SETTINGS) // after seeding: 8 entries
      mockSeedModelSettingsDefaults.mockResolvedValueOnce(undefined)

      const result = await ModelSettingsService.getAll()

      // Verify seeding was triggered
      expect(mockSeedModelSettingsDefaults).toHaveBeenCalledTimes(1)
      // Verify getAllModelSettings was called twice: once to check, once after seed
      expect(mockGetAllModelSettings).toHaveBeenCalledTimes(2)
      // Verify 8 entries returned
      expect(result).toHaveLength(8)
      expect(result).toEqual(DEFAULT_SETTINGS)
    })

    // AC-10 (slice-02): GIVEN ModelSettingsService.getAll() wird aufgerufen und die Tabelle hat Eintraege
    //        WHEN der Service die Abfrage ausfuehrt
    //        THEN werden die vorhandenen Eintraege zurueckgegeben ohne erneutes Seeding
    it('AC-10: should return existing entries without seeding when table has data', async () => {
      mockGetAllModelSettings.mockResolvedValueOnce(DEFAULT_SETTINGS)

      const result = await ModelSettingsService.getAll()

      // Verify seeding was NOT triggered
      expect(mockSeedModelSettingsDefaults).not.toHaveBeenCalled()
      // Verify getAllModelSettings was called only once (no second call needed)
      expect(mockGetAllModelSettings).toHaveBeenCalledTimes(1)
      // Verify all entries returned
      expect(result).toHaveLength(8)
      expect(result).toEqual(DEFAULT_SETTINGS)
    })
  })

  // =========================================================================
  // Slice-07: checkCompatibility (DB-backed capabilities)
  // =========================================================================

  describe('checkCompatibility (DB-backed capabilities) [slice-07]', () => {
    // AC-5: GIVEN model-settings-service.ts importiert ModelCatalogService statt ModelSchemaService
    //       WHEN die Imports der Datei geprueft werden
    //       THEN existiert KEIN Import von model-schema-service mehr
    it('AC-5 (S07): should not import from model-schema-service', () => {
      const filePath = path.resolve(__dirname, '..', 'model-settings-service.ts')
      const source = fs.readFileSync(filePath, 'utf-8')

      // Must NOT import from model-schema-service
      expect(source).not.toMatch(/from\s+['"]@\/lib\/services\/model-schema-service['"]/)
      expect(source).not.toContain('model-schema-service')
      expect(source).not.toContain('ModelSchemaService')
    })

    // AC-6: GIVEN ein Model mit replicate_id = "owner/model" und capabilities = { txt2img: true, img2img: true, upscale: false, inpaint: false, outpaint: false } in der DB
    //       WHEN checkCompatibility("owner/model", "img2img") aufgerufen wird
    //       THEN wird true zurueckgegeben (Capability-Read aus DB statt Live-API)
    it('AC-6 (S07): should return true when model has img2img capability in DB', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('owner/model', { txt2img: true, img2img: true, upscale: false, inpaint: false, outpaint: false })
      )

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'img2img')

      expect(result).toBe(true)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/model')
      expect(mockGetModelByReplicateId).toHaveBeenCalledTimes(1)
    })

    // AC-7: GIVEN ein Model mit replicate_id = "owner/model" und capabilities = { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false } in der DB
    //       WHEN checkCompatibility("owner/model", "img2img") aufgerufen wird
    //       THEN wird false zurueckgegeben
    it('AC-7 (S07): should return false when model lacks img2img capability in DB', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('owner/model', { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false })
      )

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'img2img')

      expect(result).toBe(false)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/model')
    })

    // AC-8: GIVEN ein Model mit capabilities.inpaint = true in der DB
    //       WHEN checkCompatibility("owner/model", "inpaint") aufgerufen wird
    //       THEN wird true zurueckgegeben (neue Capability-Pruefung fuer inpaint)
    it('AC-8 (S07): should return true when model has inpaint capability in DB', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('owner/model', { txt2img: true, img2img: false, upscale: false, inpaint: true, outpaint: false })
      )

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'inpaint')

      expect(result).toBe(true)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/model')
    })

    // AC-9: GIVEN ein Model mit capabilities.outpaint = false in der DB
    //       WHEN checkCompatibility("owner/model", "outpaint") aufgerufen wird
    //       THEN wird false zurueckgegeben (neue Capability-Pruefung fuer outpaint)
    it('AC-9 (S07): should return false when model lacks outpaint capability in DB', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('owner/model', { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false })
      )

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'outpaint')

      expect(result).toBe(false)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/model')
    })

    // AC-10: GIVEN ein Model mit capabilities.upscale = true in der DB
    //        WHEN checkCompatibility("owner/model", "upscale") aufgerufen wird
    //        THEN wird true zurueckgegeben (upscale jetzt auch DB-basiert statt always-true)
    it('AC-10 (S07): should return true when model has upscale capability in DB', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('owner/model', { txt2img: true, img2img: false, upscale: true, inpaint: false, outpaint: false })
      )

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'upscale')

      expect(result).toBe(true)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/model')
    })

    // AC-11: GIVEN ein Model mit replicate_id = "owner/unknown" das NICHT in der DB existiert
    //        WHEN checkCompatibility("owner/unknown", "img2img") aufgerufen wird
    //        THEN wird true zurueckgegeben (Fallback: erlauben wenn DB-Lookup fehlschlaegt)
    it('AC-11 (S07): should return true as fallback when model is not found in DB', async () => {
      mockGetModelByReplicateId.mockResolvedValueOnce(null)

      const result = await ModelSettingsService.checkCompatibility('owner/unknown', 'img2img')

      expect(result).toBe(true)
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/unknown')
    })

    // AC-12: GIVEN checkCompatibility wird mit mode = "txt2img" aufgerufen
    //        WHEN beliebiges modelId uebergeben wird
    //        THEN wird true zurueckgegeben (txt2img ist immer kompatibel, kein DB-Lookup noetig)
    it('AC-12 (S07): should return true for txt2img without DB lookup', async () => {
      const result = await ModelSettingsService.checkCompatibility('any/model', 'txt2img')

      expect(result).toBe(true)
      // getModelByReplicateId should NOT be called for txt2img mode
      expect(mockGetModelByReplicateId).not.toHaveBeenCalled()
    })

    // Additional: DB error fallback — should return true when DB query throws
    it('should return true as fallback when DB query throws an error', async () => {
      mockGetModelByReplicateId.mockRejectedValueOnce(new Error('DB connection failed'))

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'img2img')

      expect(result).toBe(true)
    })

    // Additional: null capabilities — should return true when capabilities is null
    it('should return true when model exists but capabilities is null', async () => {
      const modelWithNullCaps = makeModel('owner/model', {} as Record<string, boolean>)
      modelWithNullCaps.capabilities = null as unknown as Record<string, boolean>
      mockGetModelByReplicateId.mockResolvedValueOnce(modelWithNullCaps)

      const result = await ModelSettingsService.checkCompatibility('owner/model', 'img2img')

      expect(result).toBe(true)
    })
  })

  describe('update()', () => {
    // AC-15 (slice-02): GIVEN ModelSettingsService.update("img2img", "quality", "new/model") wird aufgerufen
    //        WHEN checkCompatibility("new/model", "img2img") false zurueckgibt
    //        THEN gibt update() ein Error-Objekt zurueck { error: "Model does not support this mode" } und schreibt NICHT in die DB
    it('AC-15: should return error object when model is incompatible with mode', async () => {
      // Model has img2img: false in DB capabilities
      mockGetModelByReplicateId.mockResolvedValueOnce(
        makeModel('new/model', { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false })
      )

      const result = await ModelSettingsService.update('img2img', 'quality', 'new/model')

      expect(result).toEqual({ error: 'Model does not support this mode' })
      // Verify DB was NOT written to
      expect(mockUpsertModelSetting).not.toHaveBeenCalled()
      // Verify DB lookup was performed
      expect(mockGetModelByReplicateId).toHaveBeenCalledWith('new/model')
    })

    // AC-16 (slice-02): GIVEN ModelSettingsService.update("txt2img", "draft", "valid/model") wird aufgerufen
    //        WHEN checkCompatibility true zurueckgibt
    //        THEN wird die upsertModelSetting Query aufgerufen und der aktualisierte Eintrag zurueckgegeben
    it('AC-16: should upsert and return updated setting when model is compatible', async () => {
      const updatedEntry = {
        id: 'uuid-1',
        mode: 'txt2img',
        tier: 'draft',
        modelId: 'valid/model',
        modelParams: {},
        createdAt: NOW,
        updatedAt: new Date('2026-03-14T14:00:00Z'),
      }
      // txt2img is always compatible, so getModelByReplicateId should not be called
      mockUpsertModelSetting.mockResolvedValueOnce(updatedEntry)

      const result = await ModelSettingsService.update('txt2img', 'draft', 'valid/model')

      // Verify upsertModelSetting was called with correct arguments
      expect(mockUpsertModelSetting).toHaveBeenCalledWith('txt2img', 'draft', 'valid/model', {})
      expect(mockUpsertModelSetting).toHaveBeenCalledTimes(1)
      // Verify the updated entry is returned
      expect(result).toEqual(updatedEntry)
      expect(result).not.toHaveProperty('error')
      expect((result as typeof updatedEntry).modelId).toBe('valid/model')
    })
  })
})
