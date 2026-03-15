import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock DB query layer (Mocking Strategy: mock_external per Slice Spec)
// ---------------------------------------------------------------------------
const mockGetPromptHistoryQuery = vi.fn()
const mockGetFavoritesQuery = vi.fn()
const mockToggleFavoriteQuery = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getPromptHistoryQuery: (...args: unknown[]) => mockGetPromptHistoryQuery(...args),
  getFavoritesQuery: (...args: unknown[]) => mockGetFavoritesQuery(...args),
  toggleFavoriteQuery: (...args: unknown[]) => mockToggleFavoriteQuery(...args),
}))

import { promptHistoryService, type PromptHistoryEntry } from '@/lib/services/prompt-history-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRow(overrides: Partial<{
  id: string
  promptMotiv: string
  promptStyle: string | null
  negativePrompt: string | null
  modelId: string
  modelParams: unknown
  isFavorite: boolean
  createdAt: Date
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    promptMotiv: overrides.promptMotiv ?? 'a cat',
    promptStyle: overrides.promptStyle ?? 'watercolor',
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? 'model-1',
    modelParams: overrides.modelParams ?? {},
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

describe('PromptHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // getHistory
  // =========================================================================
  describe('getHistory', () => {
    /**
     * AC-1: GIVEN die `generations`-Tabelle mit 5 Eintraegen, davon 3 mit
     *       unterschiedlichen (prompt_motiv, prompt_style, negative_prompt, model_id)-Kombinationen
     *       WHEN `getHistory(0, 50)` aufgerufen wird
     *       THEN werden genau 3 Eintraege zurueckgegeben (DISTINCT ON unique prompt-Kombinationen),
     *            sortiert nach `created_at DESC`
     */
    it('AC-1: should return distinct prompt combinations sorted by created_at DESC', async () => {
      // Simulate the DB query layer already returning DISTINCT rows (3 unique combos)
      const now = new Date()
      const t1 = new Date(now.getTime() - 0)
      const t2 = new Date(now.getTime() - 1000)
      const t3 = new Date(now.getTime() - 2000)

      const distinctRows = [
        makeRow({ id: 'id-1', promptMotiv: 'cat', promptStyle: 'oil', createdAt: t1 }),
        makeRow({ id: 'id-2', promptMotiv: 'dog', promptStyle: 'photo', createdAt: t2 }),
        makeRow({ id: 'id-3', promptMotiv: 'bird', promptStyle: 'sketch', createdAt: t3 }),
      ]

      mockGetPromptHistoryQuery.mockResolvedValueOnce(distinctRows)

      const result = await promptHistoryService.getHistory('user-1', 0, 50)

      // Exactly 3 distinct entries
      expect(result).toHaveLength(3)
      // Query was called with correct userId/offset/limit
      expect(mockGetPromptHistoryQuery).toHaveBeenCalledWith('user-1', 0, 50)
      // Verify ordering: newest first (already done by DB, service preserves order)
      expect(new Date(result[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result[1].createdAt).getTime()
      )
      expect(new Date(result[1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result[2].createdAt).getTime()
      )
    })

    /**
     * AC-2: GIVEN die `generations`-Tabelle mit 60 Eintraegen (alle unique)
     *       WHEN `getHistory(0, 50)` aufgerufen wird
     *       THEN werden genau 50 Eintraege zurueckgegeben (Limit greift)
     */
    it('AC-2: should respect limit parameter and return at most N entries', async () => {
      const fiftyRows = Array.from({ length: 50 }, (_, i) =>
        makeRow({ id: `id-${i}`, promptMotiv: `motiv-${i}` })
      )

      mockGetPromptHistoryQuery.mockResolvedValueOnce(fiftyRows)

      const result = await promptHistoryService.getHistory('user-1', 0, 50)

      expect(result).toHaveLength(50)
      expect(mockGetPromptHistoryQuery).toHaveBeenCalledWith('user-1', 0, 50)
    })

    /**
     * AC-3: GIVEN die `generations`-Tabelle mit 60 Eintraegen
     *       WHEN `getHistory(50, 50)` aufgerufen wird
     *       THEN werden genau 10 Eintraege zurueckgegeben (Offset + Limit Pagination)
     */
    it('AC-3: should skip entries according to offset parameter', async () => {
      const tenRows = Array.from({ length: 10 }, (_, i) =>
        makeRow({ id: `id-${50 + i}`, promptMotiv: `motiv-${50 + i}` })
      )

      mockGetPromptHistoryQuery.mockResolvedValueOnce(tenRows)

      const result = await promptHistoryService.getHistory('user-1', 50, 50)

      expect(result).toHaveLength(10)
      expect(mockGetPromptHistoryQuery).toHaveBeenCalledWith('user-1', 50, 50)
    })

    /**
     * AC-8: GIVEN der Service ist korrekt implementiert
     *       WHEN `getHistory` aufgerufen wird
     *       THEN entspricht jeder Eintrag im Ergebnis dem `PromptHistoryEntry`-Typ
     */
    it('AC-8: should return entries matching PromptHistoryEntry shape', async () => {
      const now = new Date()
      const row = makeRow({
        id: 'gen-uuid-1',
        promptMotiv: 'a sunset',
        promptStyle: 'impressionist',
        negativePrompt: 'blurry',
        modelId: 'model-x',
        modelParams: { steps: 30 },
        isFavorite: true,
        createdAt: now,
      })

      mockGetPromptHistoryQuery.mockResolvedValueOnce([row])

      const result = await promptHistoryService.getHistory('user-1', 0, 50)

      expect(result).toHaveLength(1)
      const entry: PromptHistoryEntry = result[0]

      // Verify all required fields of PromptHistoryEntry exist with correct types
      expect(entry).toHaveProperty('generationId')
      expect(typeof entry.generationId).toBe('string')

      expect(entry).toHaveProperty('promptMotiv')
      expect(typeof entry.promptMotiv).toBe('string')

      expect(entry).toHaveProperty('promptStyle')
      expect(typeof entry.promptStyle).toBe('string')

      expect(entry).toHaveProperty('negativePrompt')
      // negativePrompt is string | null
      expect(typeof entry.negativePrompt === 'string' || entry.negativePrompt === null).toBe(true)

      expect(entry).toHaveProperty('modelId')
      expect(typeof entry.modelId).toBe('string')

      expect(entry).toHaveProperty('modelParams')
      expect(typeof entry.modelParams).toBe('object')

      expect(entry).toHaveProperty('isFavorite')
      expect(typeof entry.isFavorite).toBe('boolean')

      expect(entry).toHaveProperty('createdAt')
      expect(entry.createdAt).toBeInstanceOf(Date)

      // Verify correct mapping from row to entry
      expect(entry.generationId).toBe('gen-uuid-1')
      expect(entry.promptMotiv).toBe('a sunset')
      expect(entry.promptStyle).toBe('impressionist')
      expect(entry.negativePrompt).toBe('blurry')
      expect(entry.modelId).toBe('model-x')
      expect(entry.modelParams).toEqual({ steps: 30 })
      expect(entry.isFavorite).toBe(true)
      expect(entry.createdAt).toBe(now)
    })
  })

  // =========================================================================
  // getFavorites
  // =========================================================================
  describe('getFavorites', () => {
    /**
     * AC-4: GIVEN die `generations`-Tabelle mit 5 Eintraegen, davon 2 mit `is_favorite = true`
     *       WHEN `getFavorites(0, 50)` aufgerufen wird
     *       THEN werden genau 2 Eintraege zurueckgegeben, alle mit `isFavorite: true`
     */
    it('AC-4: should return only entries with isFavorite true', async () => {
      const favRows = [
        makeRow({ id: 'fav-1', isFavorite: true, promptMotiv: 'cat' }),
        makeRow({ id: 'fav-2', isFavorite: true, promptMotiv: 'dog' }),
      ]

      mockGetFavoritesQuery.mockResolvedValueOnce(favRows)

      const result = await promptHistoryService.getFavorites('user-1', 0, 50)

      expect(result).toHaveLength(2)
      expect(mockGetFavoritesQuery).toHaveBeenCalledWith('user-1', 0, 50)
      // Every entry must have isFavorite === true
      for (const entry of result) {
        expect(entry.isFavorite).toBe(true)
      }
    })
  })

  // =========================================================================
  // toggleFavorite
  // =========================================================================
  describe('toggleFavorite', () => {
    /**
     * AC-5: GIVEN eine Generation mit `id = "gen-uuid-1"` und `is_favorite = false`
     *       WHEN `toggleFavorite("gen-uuid-1")` aufgerufen wird
     *       THEN wird `{ isFavorite: true }` zurueckgegeben und der DB-Wert ist `true`
     */
    it('AC-5: should toggle isFavorite from false to true', async () => {
      mockToggleFavoriteQuery.mockResolvedValueOnce({ isFavorite: true })

      const result = await promptHistoryService.toggleFavorite('user-1', 'gen-uuid-1')

      expect(mockToggleFavoriteQuery).toHaveBeenCalledWith('user-1', 'gen-uuid-1')
      expect(result).toEqual({ isFavorite: true })
    })

    /**
     * AC-6: GIVEN eine Generation mit `id = "gen-uuid-2"` und `is_favorite = true`
     *       WHEN `toggleFavorite("gen-uuid-2")` aufgerufen wird
     *       THEN wird `{ isFavorite: false }` zurueckgegeben und der DB-Wert ist `false`
     */
    it('AC-6: should toggle isFavorite from true to false', async () => {
      mockToggleFavoriteQuery.mockResolvedValueOnce({ isFavorite: false })

      const result = await promptHistoryService.toggleFavorite('user-1', 'gen-uuid-2')

      expect(mockToggleFavoriteQuery).toHaveBeenCalledWith('user-1', 'gen-uuid-2')
      expect(result).toEqual({ isFavorite: false })
    })

    /**
     * AC-7: GIVEN eine nicht existierende `generationId = "non-existent"`
     *       WHEN `toggleFavorite("non-existent")` aufgerufen wird
     *       THEN wird ein Fehler geworfen (z.B. "Generation not found")
     */
    it('AC-7: should throw error for non-existent generationId', async () => {
      mockToggleFavoriteQuery.mockRejectedValueOnce(new Error('Generation not found'))

      await expect(
        promptHistoryService.toggleFavorite('user-1', 'non-existent')
      ).rejects.toThrow('Generation not found')

      expect(mockToggleFavoriteQuery).toHaveBeenCalledWith('user-1', 'non-existent')
    })
  })
})
