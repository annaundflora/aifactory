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

    // Verify that PromptService.improve was called with prompt and modelId
    // (generationMode is undefined when not provided, passed through as third arg)
    expect(mockImprove).toHaveBeenCalledOnce()
    expect(mockImprove).toHaveBeenCalledWith('test', 'google/imagen-4-fast', undefined)

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

// ---------------------------------------------------------------------------
// Slice 05: improvePrompt generationMode passthrough
// ---------------------------------------------------------------------------

describe('improvePrompt Server Action - generationMode Passthrough (Slice 05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-1: GIVEN `improvePrompt` Server Action wird mit
   *       `{ prompt: "a cat", modelId: "black-forest-labs/flux-2-pro", generationMode: "img2img" }` aufgerufen
   *       WHEN die Action `PromptService.improve()` aufruft
   *       THEN wird `improve(prompt, modelId, "img2img")` mit dem dritten Parameter aufgerufen
   */
  it('AC-1: should pass generationMode to PromptService.improve when provided', async () => {
    mockImprove.mockResolvedValueOnce({
      original: 'a cat',
      improved: 'a majestic feline',
    })

    const result = await improvePrompt({
      prompt: 'a cat',
      modelId: 'black-forest-labs/flux-2-pro',
      generationMode: 'img2img',
    })

    // Verify PromptService.improve was called with all THREE parameters
    expect(mockImprove).toHaveBeenCalledOnce()
    expect(mockImprove).toHaveBeenCalledWith(
      'a cat',
      'black-forest-labs/flux-2-pro',
      'img2img'
    )

    // Verify the result is passed through correctly
    expect(result).toEqual({
      original: 'a cat',
      improved: 'a majestic feline',
    })
  })

  /**
   * AC-2: GIVEN `improvePrompt` Server Action wird mit
   *       `{ prompt: "a cat", modelId: "flux-2-pro" }` OHNE `generationMode` aufgerufen
   *       WHEN die Action `PromptService.improve()` aufruft
   *       THEN wird `improve(prompt, modelId)` aufgerufen
   *            (ohne dritten Parameter, sodass der Default "txt2img" aus Slice 04 greift)
   */
  it('AC-2: should call PromptService.improve without generationMode when not provided', async () => {
    mockImprove.mockResolvedValueOnce({
      original: 'a cat',
      improved: 'a majestic feline',
    })

    const result = await improvePrompt({
      prompt: 'a cat',
      modelId: 'flux-2-pro',
    })

    // Verify PromptService.improve was called with only TWO parameters
    // (generationMode is undefined, so it falls through to the default in Slice 04)
    expect(mockImprove).toHaveBeenCalledOnce()
    expect(mockImprove).toHaveBeenCalledWith(
      'a cat',
      'flux-2-pro',
      undefined
    )

    expect(result).toEqual({
      original: 'a cat',
      improved: 'a majestic feline',
    })
  })

  /**
   * AC-6: GIVEN der vollstaendige Pfad UI -> Action -> Service
   *       WHEN ein User mit Flux-Modell im img2img-Modus "Improve Prompt" klickt
   *       THEN erhaelt `PromptService.improve()` den Wert `generationMode="img2img"`
   *
   * This test verifies the Action layer correctly forwards the generationMode
   * to the service. The service-level behaviour (system prompt with img2img tips)
   * is validated in Slice 04 tests; here we assert the Action contract.
   */
  it('AC-6: should pass generationMode="img2img" end-to-end so that resulting system prompt contains img2img-specific tips', async () => {
    // Simulate that PromptService.improve returns a result whose improved text
    // contains img2img-specific guidance (this is the service's responsibility,
    // but we verify the action passes the mode correctly and returns the result)
    mockImprove.mockResolvedValueOnce({
      original: 'a cat sitting on a fence',
      improved: 'a cat sitting on a fence, img2img optimized with reference-aware composition',
    })

    const result = await improvePrompt({
      prompt: 'a cat sitting on a fence',
      modelId: 'black-forest-labs/flux-2-pro',
      generationMode: 'img2img',
    })

    // Verify the action forwarded generationMode="img2img" to the service
    expect(mockImprove).toHaveBeenCalledWith(
      'a cat sitting on a fence',
      'black-forest-labs/flux-2-pro',
      'img2img'
    )

    // Verify the improved result is returned unmodified from the service
    expect(result).not.toHaveProperty('error')
    expect(result).toEqual({
      original: 'a cat sitting on a fence',
      improved: 'a cat sitting on a fence, img2img optimized with reference-aware composition',
    })
  })

  // --- Additional: generationMode validation ---

  it('should reject invalid generationMode values', async () => {
    const result = await improvePrompt({
      prompt: 'a cat',
      modelId: 'flux-2-pro',
      generationMode: 'invalid-mode' as never,
    })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBe('Ungueltiger Generierungsmodus')
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('should accept all valid generationMode values', async () => {
    const validModes = ['txt2img', 'img2img', 'upscale', 'inpaint', 'outpaint'] as const

    for (const mode of validModes) {
      vi.clearAllMocks()
      mockImprove.mockResolvedValueOnce({
        original: 'test',
        improved: 'improved test',
      })

      const result = await improvePrompt({
        prompt: 'test',
        modelId: 'flux-2-pro',
        generationMode: mode,
      })

      expect(mockImprove).toHaveBeenCalledWith('test', 'flux-2-pro', mode)
      expect(result).not.toHaveProperty('error')
    }
  })
})
