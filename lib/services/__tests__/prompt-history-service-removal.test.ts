import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Unit Tests for Slice 02 (Phase 7): Prompt History Service -- Field Removal
 *
 * These tests validate that `prompt-history-service.ts` interface and mapping
 * functions no longer reference the removed fields `promptStyle` and `negativePrompt`.
 *
 * Mocking Strategy: mock_external (per Slice-Spec)
 */

// Read the service source file once for all source-inspection tests
const serviceSourcePath = path.resolve(
  __dirname,
  '..',
  'prompt-history-service.ts'
)
const serviceSource = fs.readFileSync(serviceSourcePath, 'utf-8')

// ---------------------------------------------------------------------------
// Mock DB query layer (Mocking Strategy: mock_external per Slice Spec)
// ---------------------------------------------------------------------------
const mockGetPromptHistoryQuery = vi.fn()
const mockGetFavoritesQuery = vi.fn()
const mockToggleFavoriteQuery = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getPromptHistoryQuery: (...args: unknown[]) =>
    mockGetPromptHistoryQuery(...args),
  getFavoritesQuery: (...args: unknown[]) => mockGetFavoritesQuery(...args),
  toggleFavoriteQuery: (...args: unknown[]) =>
    mockToggleFavoriteQuery(...args),
}))

import {
  promptHistoryService,
  type PromptHistoryEntry,
} from '@/lib/services/prompt-history-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock PromptHistoryRow WITHOUT removed fields (as the cleaned query would return) */
function makeCleanRow(
  overrides: Partial<{
    id: string
    promptMotiv: string
    modelId: string
    modelParams: unknown
    isFavorite: boolean
    createdAt: Date
  }> = {}
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    promptMotiv: overrides.promptMotiv ?? 'a cat',
    modelId: overrides.modelId ?? 'model-1',
    modelParams: overrides.modelParams ?? {},
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

describe('prompt-history-service - field removal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // AC-5: PromptHistoryEntry Interface ohne promptStyle/negativePrompt
  // =========================================================================

  it('AC-5: should not include promptStyle in PromptHistoryEntry', () => {
    /**
     * AC-5: GIVEN die bereinigten Queries aus AC-1 bis AC-4
     *       WHEN das Interface PromptHistoryEntry in prompt-history-service.ts geprueft wird
     *       THEN enthaelt es KEINE Property promptStyle
     */

    // Type-level check
    type HasPromptStyle = 'promptStyle' extends keyof PromptHistoryEntry
      ? true
      : false
    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()

    // Runtime source inspection
    const interfaceMatch = serviceSource.match(
      /export\s+interface\s+PromptHistoryEntry\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).not.toMatch(/promptStyle/)
  })

  it('AC-5: should not include negativePrompt in PromptHistoryEntry', () => {
    /**
     * AC-5: GIVEN die bereinigten Queries aus AC-1 bis AC-4
     *       WHEN das Interface PromptHistoryEntry in prompt-history-service.ts geprueft wird
     *       THEN enthaelt es KEINE Property negativePrompt
     */

    // Type-level check
    type HasNegativePrompt = 'negativePrompt' extends keyof PromptHistoryEntry
      ? true
      : false
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Runtime source inspection
    const interfaceMatch = serviceSource.match(
      /export\s+interface\s+PromptHistoryEntry\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).not.toMatch(/negativePrompt/)
  })

  it('AC-5: PromptHistoryEntry should still have all required fields', () => {
    /**
     * AC-5: GIVEN die bereinigten Queries aus AC-1 bis AC-4
     *       WHEN das Interface PromptHistoryEntry in prompt-history-service.ts geprueft wird
     *       THEN enthaelt es weiterhin generationId, promptMotiv, modelId, modelParams, isFavorite, createdAt
     */

    // Type-level: verify all required properties exist
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('generationId')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('promptMotiv')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('modelId')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('modelParams')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('isFavorite')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('createdAt')

    // Type-level: verify types
    expectTypeOf<PromptHistoryEntry['generationId']>().toEqualTypeOf<string>()
    expectTypeOf<PromptHistoryEntry['promptMotiv']>().toEqualTypeOf<string>()
    expectTypeOf<PromptHistoryEntry['modelId']>().toEqualTypeOf<string>()
    expectTypeOf<
      PromptHistoryEntry['modelParams']
    >().toEqualTypeOf<Record<string, unknown>>()
    expectTypeOf<PromptHistoryEntry['isFavorite']>().toEqualTypeOf<boolean>()
    expectTypeOf<PromptHistoryEntry['createdAt']>().toEqualTypeOf<Date>()
  })

  // =========================================================================
  // AC-5: getHistory Mapping ohne entfernte Felder
  // =========================================================================

  it('AC-5: should map history rows without promptStyle or negativePrompt', async () => {
    /**
     * AC-5: GIVEN die bereinigten Queries aus AC-1 bis AC-4
     *       WHEN die Mapping-Funktion in getHistory() aufgerufen wird
     *       THEN referenziert sie KEINE row.promptStyle oder row.negativePrompt
     *       AND das gemappte Ergebnis enthaelt KEINE promptStyle/negativePrompt Properties
     */

    const now = new Date()
    const cleanRows = [
      makeCleanRow({
        id: 'gen-1',
        promptMotiv: 'a sunset',
        modelId: 'model-x',
        modelParams: { steps: 30 },
        isFavorite: false,
        createdAt: now,
      }),
      makeCleanRow({
        id: 'gen-2',
        promptMotiv: 'a forest',
        modelId: 'model-y',
        modelParams: {},
        isFavorite: true,
        createdAt: new Date(now.getTime() - 1000),
      }),
    ]

    mockGetPromptHistoryQuery.mockResolvedValueOnce(cleanRows)

    const result = await promptHistoryService.getHistory('user-1', 0, 50)

    expect(result).toHaveLength(2)

    for (const entry of result) {
      // Must NOT have removed fields
      expect(entry).not.toHaveProperty('promptStyle')
      expect(entry).not.toHaveProperty('negativePrompt')

      // Must have all required fields
      expect(entry).toHaveProperty('generationId')
      expect(entry).toHaveProperty('promptMotiv')
      expect(entry).toHaveProperty('modelId')
      expect(entry).toHaveProperty('modelParams')
      expect(entry).toHaveProperty('isFavorite')
      expect(entry).toHaveProperty('createdAt')
    }

    // Verify correct mapping of values
    expect(result[0].generationId).toBe('gen-1')
    expect(result[0].promptMotiv).toBe('a sunset')
    expect(result[0].modelId).toBe('model-x')
    expect(result[0].modelParams).toEqual({ steps: 30 })
    expect(result[0].isFavorite).toBe(false)
    expect(result[0].createdAt).toBe(now)

    // Source inspection: getHistory mapping must not reference removed fields
    const getHistoryMatch = serviceSource.match(
      /async\s+function\s+getHistory[\s\S]*?^}/m
    )
    expect(getHistoryMatch).not.toBeNull()
    const getHistoryBody = getHistoryMatch![0]
    expect(getHistoryBody).not.toMatch(/row\.promptStyle/)
    expect(getHistoryBody).not.toMatch(/row\.negativePrompt/)
    expect(getHistoryBody).not.toMatch(/promptStyle\s*:/)
    expect(getHistoryBody).not.toMatch(/negativePrompt\s*:/)
  })

  // =========================================================================
  // AC-5: getFavorites Mapping ohne entfernte Felder
  // =========================================================================

  it('AC-5: should map favorite rows without promptStyle or negativePrompt', async () => {
    /**
     * AC-5: GIVEN die bereinigten Queries aus AC-1 bis AC-4
     *       WHEN die Mapping-Funktion in getFavorites() aufgerufen wird
     *       THEN referenziert sie KEINE row.promptStyle oder row.negativePrompt
     *       AND das gemappte Ergebnis enthaelt KEINE promptStyle/negativePrompt Properties
     */

    const now = new Date()
    const cleanRows = [
      makeCleanRow({
        id: 'fav-1',
        promptMotiv: 'a cat',
        modelId: 'model-a',
        modelParams: { steps: 20 },
        isFavorite: true,
        createdAt: now,
      }),
    ]

    mockGetFavoritesQuery.mockResolvedValueOnce(cleanRows)

    const result = await promptHistoryService.getFavorites('user-1', 0, 50)

    expect(result).toHaveLength(1)

    for (const entry of result) {
      // Must NOT have removed fields
      expect(entry).not.toHaveProperty('promptStyle')
      expect(entry).not.toHaveProperty('negativePrompt')

      // Must have all required fields
      expect(entry).toHaveProperty('generationId')
      expect(entry).toHaveProperty('promptMotiv')
      expect(entry).toHaveProperty('modelId')
      expect(entry).toHaveProperty('modelParams')
      expect(entry).toHaveProperty('isFavorite')
      expect(entry).toHaveProperty('createdAt')
    }

    // Verify correct mapping
    expect(result[0].generationId).toBe('fav-1')
    expect(result[0].promptMotiv).toBe('a cat')
    expect(result[0].isFavorite).toBe(true)

    // Source inspection: getFavorites mapping must not reference removed fields
    const getFavoritesMatch = serviceSource.match(
      /async\s+function\s+getFavorites[\s\S]*?^}/m
    )
    expect(getFavoritesMatch).not.toBeNull()
    const getFavoritesBody = getFavoritesMatch![0]
    expect(getFavoritesBody).not.toMatch(/row\.promptStyle/)
    expect(getFavoritesBody).not.toMatch(/row\.negativePrompt/)
    expect(getFavoritesBody).not.toMatch(/promptStyle\s*:/)
    expect(getFavoritesBody).not.toMatch(/negativePrompt\s*:/)
  })
})
