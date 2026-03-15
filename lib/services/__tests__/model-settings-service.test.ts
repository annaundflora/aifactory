/**
 * Unit & Acceptance Tests for ModelSettingsService
 * Slice: slice-02-model-settings-service
 *
 * Mocking Strategy: mock_external
 *   - DB query functions from lib/db/queries are mocked
 *   - ModelSchemaService is mocked (external API dependency)
 *
 * ACs covered: AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the DB query functions
// ---------------------------------------------------------------------------
const mockGetAllModelSettings = vi.fn()
const mockGetModelSettingByModeTier = vi.fn()
const mockUpsertModelSetting = vi.fn()
const mockSeedModelSettingsDefaults = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getAllModelSettings: (...args: unknown[]) => mockGetAllModelSettings(...args),
  getModelSettingByModeTier: (...args: unknown[]) => mockGetModelSettingByModeTier(...args),
  upsertModelSetting: (...args: unknown[]) => mockUpsertModelSetting(...args),
  seedModelSettingsDefaults: (...args: unknown[]) => mockSeedModelSettingsDefaults(...args),
}))

// ---------------------------------------------------------------------------
// Mock the ModelSchemaService
// ---------------------------------------------------------------------------
const mockSupportsImg2Img = vi.fn()

vi.mock('@/lib/services/model-schema-service', () => ({
  ModelSchemaService: {
    supportsImg2Img: (...args: unknown[]) => mockSupportsImg2Img(...args),
  },
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll()', () => {
    // AC-9: GIVEN ModelSettingsService.getAll() wird aufgerufen und die Tabelle ist leer
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

    // AC-10: GIVEN ModelSettingsService.getAll() wird aufgerufen und die Tabelle hat Eintraege
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

  describe('checkCompatibility()', () => {
    // AC-11: GIVEN ein Model mit modelId="compatible/model" das img2img unterstuetzt (Schema hat img2img-Feld)
    //        WHEN ModelSettingsService.checkCompatibility("compatible/model", "img2img") aufgerufen wird
    //        THEN wird true zurueckgegeben
    it('AC-11: should return true for img2img-compatible model', async () => {
      mockSupportsImg2Img.mockResolvedValueOnce(true)

      const result = await ModelSettingsService.checkCompatibility('compatible/model', 'img2img')

      expect(result).toBe(true)
      expect(mockSupportsImg2Img).toHaveBeenCalledWith('compatible/model')
      expect(mockSupportsImg2Img).toHaveBeenCalledTimes(1)
    })

    // AC-12: GIVEN ein Model mit modelId="incompatible/model" das kein img2img-Feld im Schema hat
    //        WHEN ModelSettingsService.checkCompatibility("incompatible/model", "img2img") aufgerufen wird
    //        THEN wird false zurueckgegeben
    it('AC-12: should return false for model without img2img support', async () => {
      mockSupportsImg2Img.mockResolvedValueOnce(false)

      const result = await ModelSettingsService.checkCompatibility('incompatible/model', 'img2img')

      expect(result).toBe(false)
      expect(mockSupportsImg2Img).toHaveBeenCalledWith('incompatible/model')
    })

    // AC-13: GIVEN ein beliebiges Model
    //        WHEN ModelSettingsService.checkCompatibility("any/model", "txt2img") aufgerufen wird
    //        THEN wird true zurueckgegeben (txt2img ist immer kompatibel)
    it('AC-13: should return true for any model with txt2img mode', async () => {
      const result = await ModelSettingsService.checkCompatibility('any/model', 'txt2img')

      expect(result).toBe(true)
      // supportsImg2Img should NOT be called for txt2img mode
      expect(mockSupportsImg2Img).not.toHaveBeenCalled()
    })

    // AC-14: GIVEN ein beliebiges Model
    //        WHEN ModelSettingsService.checkCompatibility("any/model", "upscale") aufgerufen wird
    //        THEN wird true zurueckgegeben (upscale-Kompatibilitaet wird nicht per Schema geprueft)
    it('AC-14: should return true for any model with upscale mode', async () => {
      const result = await ModelSettingsService.checkCompatibility('any/model', 'upscale')

      expect(result).toBe(true)
      // supportsImg2Img should NOT be called for upscale mode
      expect(mockSupportsImg2Img).not.toHaveBeenCalled()
    })
  })

  describe('update()', () => {
    // AC-15: GIVEN ModelSettingsService.update("img2img", "quality", "new/model") wird aufgerufen
    //        WHEN checkCompatibility("new/model", "img2img") false zurueckgibt
    //        THEN gibt update() ein Error-Objekt zurueck { error: "Model does not support this mode" } und schreibt NICHT in die DB
    it('AC-15: should return error object when model is incompatible with mode', async () => {
      mockSupportsImg2Img.mockResolvedValueOnce(false)

      const result = await ModelSettingsService.update('img2img', 'quality', 'new/model')

      expect(result).toEqual({ error: 'Model does not support this mode' })
      // Verify DB was NOT written to
      expect(mockUpsertModelSetting).not.toHaveBeenCalled()
      // Verify compatibility check was performed
      expect(mockSupportsImg2Img).toHaveBeenCalledWith('new/model')
    })

    // AC-16: GIVEN ModelSettingsService.update("txt2img", "draft", "valid/model") wird aufgerufen
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
      // txt2img is always compatible, so supportsImg2Img should not be called
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
