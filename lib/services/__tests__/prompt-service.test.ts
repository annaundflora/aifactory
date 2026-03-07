import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChat = vi.fn()

vi.mock('@/lib/clients/openrouter', () => ({
  openRouterClient: {
    chat: (...args: unknown[]) => mockChat(...args),
  },
}))

import { PromptService } from '@/lib/services/prompt-service'

/**
 * Helper: Extracts the system prompt content from the mockChat call arguments.
 * The mock is called with { model, messages: [...] } and we want the system message content.
 */
function getSystemPromptFromLastCall(): string {
  const callArgs = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
  const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
  return systemMessage?.content ?? ''
}

describe('PromptService.improve - Adaptive System Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: mockChat returns an improved prompt string
    mockChat.mockResolvedValue('improved prompt text')
  })

  /**
   * AC-1: GIVEN ein Prompt "a cat" und modelId "recraft-ai/recraft-v4"
   *       WHEN `improve(prompt, modelId)` aufgerufen wird
   *       THEN enthaelt der an OpenRouter gesendete System-Prompt den Modell-Display-Namen
   *            "Recraft V4" und modell-spezifische Optimierungshinweise
   */
  it('AC-1: should include model display name "Recraft V4" in system prompt when modelId is recraft-ai/recraft-v4', async () => {
    await PromptService.improve('a cat', 'recraft-ai/recraft-v4')

    expect(mockChat).toHaveBeenCalledOnce()

    const systemPrompt = getSystemPromptFromLastCall()
    expect(systemPrompt).toContain('Recraft V4')
    expect(systemPrompt).toContain('recraft-ai/recraft-v4')
  })

  /**
   * AC-2: GIVEN ein minimaler Prompt (1-3 Woerter, z.B. "sunset beach")
   *       WHEN der adaptive System-Prompt gebaut wird
   *       THEN enthaelt die Improvement-Strategie Anweisungen zum Hinzufuegen spezifischer Details
   *            (Lighting, Composition, Perspective, Texture)
   */
  it('AC-2: should use add-details strategy for minimal prompts with 1-3 words', async () => {
    await PromptService.improve('sunset beach', 'google/imagen-4-fast')

    const systemPrompt = getSystemPromptFromLastCall()

    // The system prompt instructs the LLM to add details for minimal prompts
    // Check for keywords related to adding details: lighting, composition, perspective, texture
    const lowerPrompt = systemPrompt.toLowerCase()
    const hasAddDetailsHints =
      lowerPrompt.includes('minimal') ||
      lowerPrompt.includes('add')
    expect(hasAddDetailsHints).toBe(true)

    // Should mention specific detail dimensions
    expect(lowerPrompt).toContain('lighting')
    expect(lowerPrompt).toContain('composition')
    expect(lowerPrompt).toContain('perspective')
    expect(lowerPrompt).toContain('texture')
  })

  /**
   * AC-3: GIVEN ein bereits detailreicher Prompt (>50 Woerter mit Stil-, Licht- und Kompositions-Keywords)
   *       WHEN der adaptive System-Prompt gebaut wird
   *       THEN enthaelt die Improvement-Strategie Anweisungen zum Polieren und Verfeinern
   *            statt zum Hinzufuegen neuer Details
   */
  it('AC-3: should use polish strategy for rich prompts with >50 words and style keywords', async () => {
    const richPrompt = [
      'A breathtaking cinematic photograph of a majestic snow-capped mountain range',
      'at golden hour with dramatic backlighting and lens flare, shot with a wide-angle',
      'perspective from a low vantage point, featuring moody atmospheric haze and volumetric',
      'fog in the valleys, rich saturated colors with teal and orange color grading,',
      'ultra-detailed 8k resolution, professional landscape photography style with shallow',
      'depth of field bokeh in the foreground wildflowers, composition following the rule of thirds',
    ].join(' ')

    await PromptService.improve(richPrompt, 'black-forest-labs/flux-2-pro')

    const systemPrompt = getSystemPromptFromLastCall()
    const lowerPrompt = systemPrompt.toLowerCase()

    // For rich prompts, the system prompt should contain polish/refine instructions
    const hasPolishHints =
      lowerPrompt.includes('rich') ||
      lowerPrompt.includes('polish')
    expect(hasPolishHints).toBe(true)
  })

  /**
   * AC-4: GIVEN ein moderater Prompt (10-30 Woerter mit einigen Stil-Keywords)
   *       WHEN der adaptive System-Prompt gebaut wird
   *       THEN enthaelt die Improvement-Strategie Anweisungen zum Verfeinern bestehender
   *            und Ergaenzen fehlender Dimensionen
   */
  it('AC-4: should use refine strategy for moderate prompts with 10-30 words', async () => {
    const moderatePrompt =
      'A cozy cabin in the woods during autumn with warm lighting and fallen leaves on the ground, painted in watercolor style'

    await PromptService.improve(moderatePrompt, 'google/imagen-4-fast')

    const systemPrompt = getSystemPromptFromLastCall()
    const lowerPrompt = systemPrompt.toLowerCase()

    // For moderate prompts, the system prompt should contain refine/enhance instructions
    const hasRefineHints =
      lowerPrompt.includes('moderate') ||
      lowerPrompt.includes('refine')
    expect(hasRefineHints).toBe(true)
  })

  /**
   * AC-5: GIVEN eine ungueltige modelId die nicht in MODELS existiert
   *       WHEN `improve(prompt, modelId)` aufgerufen wird
   *       THEN wird ein generischer Modellname verwendet (kein Fehler),
   *            und die Funktion gibt trotzdem ein `ImproveResult` zurueck
   */
  it('AC-5: should use generic model name for unknown modelId without throwing', async () => {
    mockChat.mockResolvedValueOnce('improved unknown model prompt')

    const result = await PromptService.improve('a cat', 'unknown/nonexistent-model-xyz')

    // Should not throw, should return a valid ImproveResult
    expect(result).toEqual({
      original: 'a cat',
      improved: 'improved unknown model prompt',
    })

    // The system prompt should still contain the modelId as fallback display name
    const systemPrompt = getSystemPromptFromLastCall()
    expect(systemPrompt).toContain('unknown/nonexistent-model-xyz')
  })

  // --- Regression tests from previous slice (kept for backward compat) ---

  it('should call openRouterClient with model and return original plus improved', async () => {
    mockChat.mockResolvedValueOnce('A beautifully detailed cat sitting on a sunlit roof')

    const result = await PromptService.improve('A cat on a roof', 'recraft-ai/recraft-v4')

    expect(result).toEqual({
      original: 'A cat on a roof',
      improved: 'A beautifully detailed cat sitting on a sunlit roof',
    })

    expect(mockChat).toHaveBeenCalledOnce()
    expect(mockChat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.any(String) }),
          expect.objectContaining({ role: 'user', content: 'A cat on a roof' }),
        ]),
      })
    )
  })

  it('should trim the improved prompt string', async () => {
    mockChat.mockResolvedValueOnce('  improved text with spaces  ')

    const result = await PromptService.improve('original', 'google/imagen-4-fast')

    expect(result.improved).toBe('improved text with spaces')
    expect(result.original).toBe('original')
  })

  it('should throw error with descriptive message when openRouterClient fails', async () => {
    mockChat.mockRejectedValueOnce(new Error('OpenRouter API Fehler (429): Rate limit exceeded'))

    await expect(PromptService.improve('test prompt', 'google/imagen-4-fast')).rejects.toThrow(
      'OpenRouter API Fehler (429): Rate limit exceeded'
    )
  })
})
