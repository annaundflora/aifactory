/**
 * Unit Tests for model_settings query functions in lib/db/queries.ts
 * Slice: slice-02-model-settings-service
 *
 * Mocking Strategy: mock_external (DB layer is mocked per spec)
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
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
  getAllModelSettings,
  getModelSettingByModeTier,
  upsertModelSetting,
  seedModelSettingsDefaults,
} from '../queries'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-14T12:00:00Z')
const LATER = new Date('2026-03-14T13:00:00Z')

const MOCK_SETTING_TXT2IMG_DRAFT = {
  id: 'uuid-1',
  mode: 'txt2img',
  tier: 'draft',
  modelId: 'black-forest-labs/flux-schnell',
  modelParams: {},
  createdAt: NOW,
  updatedAt: NOW,
}

const MOCK_SETTINGS_ALL = [
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

describe('model_settings query functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-1: GIVEN keine Eintraege in model_settings
  //       WHEN getAllModelSettings() Query aufgerufen wird
  //       THEN wird ein leeres Array [] zurueckgegeben
  it('AC-1: should return empty array when no model_settings exist', async () => {
    mockChain = createChainableMock([])

    const result = await getAllModelSettings()

    expect(result).toEqual([])
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
  })

  // AC-2: GIVEN 8 Seed-Eintraege in model_settings
  //       WHEN getAllModelSettings() Query aufgerufen wird
  //       THEN werden alle 8 Eintraege als Array zurueckgegeben mit Feldern id, mode, tier, modelId, modelParams, createdAt, updatedAt
  it('AC-2: should return all model_settings entries with correct fields', async () => {
    mockChain = createChainableMock(MOCK_SETTINGS_ALL)

    const result = await getAllModelSettings()

    expect(result).toHaveLength(8)
    for (const entry of result) {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('mode')
      expect(entry).toHaveProperty('tier')
      expect(entry).toHaveProperty('modelId')
      expect(entry).toHaveProperty('modelParams')
      expect(entry).toHaveProperty('createdAt')
      expect(entry).toHaveProperty('updatedAt')
    }
    expect(result).toEqual(MOCK_SETTINGS_ALL)
  })

  // AC-3: GIVEN ein Eintrag mit mode="txt2img" und tier="draft" existiert
  //       WHEN getModelSettingByModeTier("txt2img", "draft") aufgerufen wird
  //       THEN wird genau dieser eine Eintrag zurueckgegeben
  it('AC-3: should return matching entry for getModelSettingByModeTier', async () => {
    mockChain = createChainableMock([MOCK_SETTING_TXT2IMG_DRAFT])

    const result = await getModelSettingByModeTier('txt2img', 'draft')

    expect(result).toBeDefined()
    expect(result).toEqual(MOCK_SETTING_TXT2IMG_DRAFT)
    expect(result!.mode).toBe('txt2img')
    expect(result!.tier).toBe('draft')
    expect(result!.modelId).toBe('black-forest-labs/flux-schnell')
    // Verify select and from were called (correct Drizzle chain)
    expect(mockChain.select).toHaveBeenCalled()
    expect(mockChain.from).toHaveBeenCalled()
    expect(mockChain.where).toHaveBeenCalled()
  })

  // AC-4: GIVEN kein Eintrag fuer mode="txt2img" und tier="max" existiert
  //       WHEN getModelSettingByModeTier("txt2img", "max") aufgerufen wird
  //       THEN wird undefined zurueckgegeben
  it('AC-4: should return undefined when no entry matches mode+tier', async () => {
    // Return empty array => destructuring [row] yields undefined
    mockChain = createChainableMock([])

    const result = await getModelSettingByModeTier('txt2img', 'max')

    expect(result).toBeUndefined()
  })

  // AC-5: GIVEN kein Eintrag fuer (txt2img, draft) existiert
  //       WHEN upsertModelSetting("txt2img", "draft", "owner/new-model", {}) aufgerufen wird
  //       THEN wird ein neuer Eintrag erstellt und zurueckgegeben mit modelId="owner/new-model"
  it('AC-5: should insert new entry via upsertModelSetting when no conflict', async () => {
    const newEntry = {
      id: 'uuid-new',
      mode: 'txt2img',
      tier: 'draft',
      modelId: 'owner/new-model',
      modelParams: {},
      createdAt: NOW,
      updatedAt: NOW,
    }
    mockChain = createChainableMock([newEntry])

    const result = await upsertModelSetting('txt2img', 'draft', 'owner/new-model', {})

    expect(result).toBeDefined()
    expect(result.modelId).toBe('owner/new-model')
    expect(result.mode).toBe('txt2img')
    expect(result.tier).toBe('draft')
    expect(result.modelParams).toEqual({})
    // Verify the upsert chain was used
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()
    expect(mockChain.onConflictDoUpdate).toHaveBeenCalled()
    expect(mockChain.returning).toHaveBeenCalled()
  })

  // AC-6: GIVEN ein Eintrag fuer (txt2img, draft) mit modelId="old/model" existiert
  //       WHEN upsertModelSetting("txt2img", "draft", "owner/new-model", { "key": "val" }) aufgerufen wird
  //       THEN wird der bestehende Eintrag aktualisiert: modelId="owner/new-model", modelParams={ "key": "val" }, updatedAt ist neuer als vorher
  it('AC-6: should update existing entry via upsertModelSetting on conflict', async () => {
    const updatedEntry = {
      id: 'uuid-1',
      mode: 'txt2img',
      tier: 'draft',
      modelId: 'owner/new-model',
      modelParams: { key: 'val' },
      createdAt: NOW,
      updatedAt: LATER,
    }
    mockChain = createChainableMock([updatedEntry])

    const result = await upsertModelSetting('txt2img', 'draft', 'owner/new-model', { key: 'val' })

    expect(result).toBeDefined()
    expect(result.modelId).toBe('owner/new-model')
    expect(result.modelParams).toEqual({ key: 'val' })
    expect(result.updatedAt.getTime()).toBeGreaterThan(NOW.getTime())
    // Verify the upsert chain was used correctly
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.onConflictDoUpdate).toHaveBeenCalled()
  })

  // AC-7: GIVEN eine leere model_settings Tabelle
  //       WHEN seedModelSettingsDefaults() aufgerufen wird
  //       THEN existieren danach exakt 8 Eintraege (gleiche Daten wie in architecture.md -> "Seed Data")
  it('AC-7: should seed 8 default entries into empty table', async () => {
    mockChain = createChainableMock(undefined)

    await seedModelSettingsDefaults()

    // Verify insert was called with the seed data
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalled()

    // Verify the values call received an array of 8 defaults
    const valuesCall = mockChain.values.mock.calls[0][0]
    expect(valuesCall).toHaveLength(8)

    // Verify expected seed data structure
    const modes = valuesCall.map((v: { mode: string }) => v.mode)
    expect(modes).toContain('txt2img')
    expect(modes).toContain('img2img')
    expect(modes).toContain('upscale')

    const tiers = valuesCall.map((v: { tier: string }) => v.tier)
    expect(tiers).toContain('draft')
    expect(tiers).toContain('quality')
    expect(tiers).toContain('max')

    // Verify specific seed entries
    const txt2imgDraft = valuesCall.find((v: { mode: string; tier: string }) => v.mode === 'txt2img' && v.tier === 'draft')
    expect(txt2imgDraft.modelId).toBe('black-forest-labs/flux-schnell')

    const img2imgQuality = valuesCall.find((v: { mode: string; tier: string }) => v.mode === 'img2img' && v.tier === 'quality')
    expect(img2imgQuality.modelId).toBe('black-forest-labs/flux-2-pro')
    expect(img2imgQuality.modelParams).toEqual({ prompt_strength: 0.6 })

    const upscaleDraft = valuesCall.find((v: { mode: string; tier: string }) => v.mode === 'upscale' && v.tier === 'draft')
    expect(upscaleDraft.modelId).toBe('nightmareai/real-esrgan')
    expect(upscaleDraft.modelParams).toEqual({ scale: 2 })

    const upscaleQuality = valuesCall.find((v: { mode: string; tier: string }) => v.mode === 'upscale' && v.tier === 'quality')
    expect(upscaleQuality.modelId).toBe('philz1337x/crystal-upscaler')
    expect(upscaleQuality.modelParams).toEqual({ scale: 4 })

    // Verify onConflictDoNothing was used for idempotency
    expect(mockChain.onConflictDoNothing).toHaveBeenCalled()
  })

  // AC-8: GIVEN 8 bestehende Eintraege in model_settings
  //       WHEN seedModelSettingsDefaults() erneut aufgerufen wird
  //       THEN bleiben exakt 8 Eintraege bestehen (ON CONFLICT DO NOTHING, idempotent), keine Duplikate
  it('AC-8: should not create duplicates when seedModelSettingsDefaults called twice', async () => {
    // First call
    mockChain = createChainableMock(undefined)
    await seedModelSettingsDefaults()

    const firstInsertCall = mockChain.insert.mock.calls.length
    expect(firstInsertCall).toBe(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    // Second call (simulates calling again with 8 existing entries)
    vi.clearAllMocks()
    mockChain = createChainableMock(undefined)
    await seedModelSettingsDefaults()

    // The function still calls insert, but with onConflictDoNothing
    // so no duplicates are created — the DB handles it
    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    expect(mockChain.onConflictDoNothing).toHaveBeenCalledTimes(1)

    // Verify the same 8 values are passed each time (idempotent payload)
    const valuesCall = mockChain.values.mock.calls[0][0]
    expect(valuesCall).toHaveLength(8)
  })
})
