import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock services (Mocking Strategy: mock_external per Slice Spec)
// ---------------------------------------------------------------------------
const mockGetHistory = vi.fn()
const mockGetFavorites = vi.fn()
const mockToggleFavorite = vi.fn()

vi.mock('@/lib/services/prompt-history-service', () => ({
  promptHistoryService: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    getFavorites: (...args: unknown[]) => mockGetFavorites(...args),
    toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
  },
}))

vi.mock('@/lib/services/prompt-service', () => ({
  PromptService: {
    improve: vi.fn(),
  },
}))

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'mock-user-id', email: 'test@example.com' }),
}))

import {
  getPromptHistory,
  getFavoritePrompts,
  toggleFavorite,
} from '@/app/actions/prompts'

describe('Prompt History Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-9: GIVEN die Server Action `getPromptHistory` in `app/actions/prompts.ts`
   *       WHEN mit `{ offset: 0, limit: 20 }` aufgerufen
   *       THEN delegiert sie an `promptHistoryService.getHistory(0, 20)` und gibt das Ergebnis zurueck
   */
  it('AC-9: should delegate getPromptHistory to promptHistoryService.getHistory', async () => {
    const fakeEntries = [
      {
        generationId: 'gen-1',
        promptMotiv: 'cat',
        promptStyle: 'oil',
        negativePrompt: null,
        modelId: 'model-1',
        modelParams: {},
        isFavorite: false,
        createdAt: new Date(),
      },
    ]

    mockGetHistory.mockResolvedValueOnce(fakeEntries)

    const result = await getPromptHistory({ offset: 0, limit: 20 })

    expect(mockGetHistory).toHaveBeenCalledOnce()
    expect(mockGetHistory).toHaveBeenCalledWith('mock-user-id', 0, 20)
    expect(result).toEqual(fakeEntries)
  })

  it('AC-9 (defaults): should use default offset=0 and limit=50 when not provided', async () => {
    mockGetHistory.mockResolvedValueOnce([])

    await getPromptHistory({})

    expect(mockGetHistory).toHaveBeenCalledWith('mock-user-id', 0, 50)
  })

  it('AC-9 (getFavoritePrompts): should delegate getFavoritePrompts to promptHistoryService.getFavorites', async () => {
    const fakeEntries = [
      {
        generationId: 'fav-1',
        promptMotiv: 'dog',
        promptStyle: 'photo',
        negativePrompt: null,
        modelId: 'model-2',
        modelParams: {},
        isFavorite: true,
        createdAt: new Date(),
      },
    ]

    mockGetFavorites.mockResolvedValueOnce(fakeEntries)

    const result = await getFavoritePrompts({ offset: 0, limit: 20 })

    expect(mockGetFavorites).toHaveBeenCalledOnce()
    expect(mockGetFavorites).toHaveBeenCalledWith('mock-user-id', 0, 20)
    expect(result).toEqual(fakeEntries)
  })

  /**
   * AC-10: GIVEN die Server Action `toggleFavorite` in `app/actions/prompts.ts`
   *        WHEN mit `{ generationId: "valid-uuid" }` aufgerufen
   *        THEN delegiert sie an `promptHistoryService.toggleFavorite("valid-uuid")`
   *             und gibt `{ isFavorite: boolean }` zurueck
   */
  it('AC-10: should delegate toggleFavorite to promptHistoryService.toggleFavorite', async () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'
    mockToggleFavorite.mockResolvedValueOnce({ isFavorite: true })

    const result = await toggleFavorite({ generationId: validUuid })

    expect(mockToggleFavorite).toHaveBeenCalledOnce()
    expect(mockToggleFavorite).toHaveBeenCalledWith('mock-user-id', validUuid)
    expect(result).toEqual({ isFavorite: true })
  })

  /**
   * AC-11: GIVEN die Server Action `toggleFavorite` in `app/actions/prompts.ts`
   *        WHEN mit einer ungueltige `generationId` (kein UUID-Format) aufgerufen
   *        THEN wird ein Validierungsfehler zurueckgegeben, bevor der Service aufgerufen wird
   */
  it('AC-11: should reject toggleFavorite with invalid UUID format', async () => {
    await expect(
      toggleFavorite({ generationId: 'not-a-uuid' })
    ).rejects.toThrow()

    // Service must NOT be called for invalid input
    expect(mockToggleFavorite).not.toHaveBeenCalled()
  })

  it('AC-11: should reject toggleFavorite with empty string', async () => {
    await expect(
      toggleFavorite({ generationId: '' })
    ).rejects.toThrow()

    expect(mockToggleFavorite).not.toHaveBeenCalled()
  })

  it('AC-11: should reject toggleFavorite with whitespace-only string', async () => {
    await expect(
      toggleFavorite({ generationId: '   ' })
    ).rejects.toThrow()

    expect(mockToggleFavorite).not.toHaveBeenCalled()
  })

  it('AC-11: should reject toggleFavorite with partial UUID', async () => {
    await expect(
      toggleFavorite({ generationId: '550e8400-e29b-41d4' })
    ).rejects.toThrow()

    expect(mockToggleFavorite).not.toHaveBeenCalled()
  })
})
