import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock lib/db/queries to prevent DATABASE_URL crash (imported transitively)
vi.mock('@/lib/db/queries', () => ({}))

// Mock PromptService
const mockImprove = vi.fn()

vi.mock('@/lib/services/prompt-service', () => ({
  PromptService: {
    improve: (...args: unknown[]) => mockImprove(...args),
  },
}))

import { improvePrompt } from '@/app/actions/prompts'

describe('improvePrompt Server Action - modelId Parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-6: GIVEN die Server Action `improvePrompt` wird mit
   *       `{ prompt: "test", modelId: "google/imagen-4-fast" }` aufgerufen
   *       WHEN die Action den PromptService aufruft
   *       THEN wird `PromptService.improve("test", "google/imagen-4-fast")`
   *            mit beiden Parametern aufgerufen
   */
  it('AC-6: should pass modelId to PromptService.improve when provided', async () => {
    mockImprove.mockResolvedValueOnce({
      original: 'test',
      improved: 'an improved test prompt',
    })

    const result = await improvePrompt({ prompt: 'test', modelId: 'google/imagen-4-fast' })

    // Verify that PromptService.improve was called with BOTH parameters
    expect(mockImprove).toHaveBeenCalledOnce()
    expect(mockImprove).toHaveBeenCalledWith('test', 'google/imagen-4-fast')

    // Verify the result is passed through correctly
    expect(result).toEqual({
      original: 'test',
      improved: 'an improved test prompt',
    })
  })

  /**
   * AC-7: GIVEN die Server Action `improvePrompt` wird mit leerem `modelId` aufgerufen
   *       WHEN die Validierung laeuft
   *       THEN gibt die Action `{ error: "..." }` zurueck (modelId ist Pflicht)
   */
  it('AC-7: should return error when modelId is empty', async () => {
    const result = await improvePrompt({ prompt: 'test', modelId: '' })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBeTruthy()
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('AC-7: should return error when modelId is only whitespace', async () => {
    const result = await improvePrompt({ prompt: 'test', modelId: '   ' })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBeTruthy()
    expect(mockImprove).not.toHaveBeenCalled()
  })

  // --- Regression: empty prompt validation still works ---

  it('should return error object when prompt is empty without calling service', async () => {
    const result = await improvePrompt({ prompt: '', modelId: 'google/imagen-4-fast' })

    expect(result).toEqual({ error: 'Prompt darf nicht leer sein' })
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('should return error object when prompt is only whitespace', async () => {
    const result = await improvePrompt({ prompt: '   ', modelId: 'google/imagen-4-fast' })

    expect(result).toEqual({ error: 'Prompt darf nicht leer sein' })
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('should return error object when PromptService.improve throws', async () => {
    mockImprove.mockRejectedValueOnce(new Error('API error'))

    const result = await improvePrompt({ prompt: 'A cat', modelId: 'google/imagen-4-fast' })

    expect(result).toHaveProperty('error')
  })
})
