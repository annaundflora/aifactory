import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: OpenRouter client (external API -- mocked per Mocking Strategy)
// ---------------------------------------------------------------------------
const mockChat = vi.fn()

vi.mock('@/lib/clients/openrouter', () => ({
  openRouterClient: {
    chat: (...args: unknown[]) => mockChat(...args),
  },
}))

import { buildSystemPrompt, PromptService } from '@/lib/services/prompt-service'

/**
 * Helper: Extracts the system prompt content from the mockChat call arguments.
 * The mock is called with { model, messages: [...] } and we want the system message content.
 */
function getSystemPromptFromLastCall(): string {
  const callArgs = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
  const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
  return systemMessage?.content ?? ''
}

// ==========================================================================
// buildSystemPrompt -- Slice 04 Acceptance Tests
// ==========================================================================

describe('buildSystemPrompt', () => {
  /**
   * AC-1: GIVEN ein bekanntes Modell "black-forest-labs/flux-2-pro" und generationMode = "txt2img"
   *       WHEN buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "txt2img") aufgerufen wird
   *       THEN enthaelt der zurueckgegebene String die Flux-spezifischen Tipps aus der Knowledge-Datei
   *            (NICHT die alten statischen Hints wie "FLUX models: Detailed scene descriptions")
   *       AND wenn generationMode weggelassen wird, wird "txt2img" als Default verwendet
   */
  it('AC-1: should include flux-specific knowledge tips for flux-2-pro model with txt2img', () => {
    const result = buildSystemPrompt('black-forest-labs/flux-2-pro', 'Flux 2 Pro', 'txt2img')

    // Must contain Flux-specific tips from knowledge file
    expect(result).toContain('Flux 2 Pro')
    // Knowledge file has tips like "Use detailed, natural-language scene descriptions"
    expect(result).toContain('natural-language scene descriptions')
    // Knowledge file has strengths like "Photorealistic rendering with fine detail"
    expect(result).toContain('Photorealistic rendering')
    // Must NOT contain old static hints
    expect(result).not.toContain('FLUX models: Detailed scene descriptions')
  })

  it('AC-1 (default): should use txt2img as default when generationMode is omitted', () => {
    const withDefault = buildSystemPrompt('black-forest-labs/flux-2-pro', 'Flux 2 Pro')
    const withExplicit = buildSystemPrompt('black-forest-labs/flux-2-pro', 'Flux 2 Pro', 'txt2img')

    // Both calls should produce the same result
    expect(withDefault).toBe(withExplicit)
  })

  /**
   * AC-2: GIVEN ein bekanntes Modell mit img2img-Modus-Wissen
   *       WHEN buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "img2img") aufgerufen wird
   *       THEN enthaelt der zurueckgegebene String sowohl die allgemeinen Modell-Tipps als auch die img2img-spezifischen Tipps
   */
  it('AC-2: should include both model tips and img2img mode tips', () => {
    const result = buildSystemPrompt('black-forest-labs/flux-2-pro', 'Flux 2 Pro', 'img2img')

    // General model tips (from knowledge file flux-2 entry)
    expect(result).toContain('natural-language scene descriptions')
    expect(result).toContain('Photorealistic rendering')

    // img2img-specific tips from knowledge file
    expect(result).toContain('Describe the desired changes relative to the source image')
    expect(result).toContain('Mode-specific tips')
  })

  /**
   * AC-3: GIVEN ein unbekanntes Modell "unknown-vendor/mystery-model"
   *       WHEN buildSystemPrompt("unknown-vendor/mystery-model", "Mystery Model", "txt2img") aufgerufen wird
   *       THEN enthaelt der zurueckgegebene String die generischen Fallback-Tipps (mit displayName: "Generic")
   */
  it('AC-3: should include generic fallback tips for unknown model', () => {
    const result = buildSystemPrompt('unknown-vendor/mystery-model', 'Mystery Model', 'txt2img')

    // Fallback section uses "General Prompting Tips" heading
    expect(result).toContain('General Prompting Tips')
    // Fallback tips from knowledge file
    expect(result).toContain('Be specific and descriptive')
    // Should not contain model-specific section header
    expect(result).not.toContain('Prompting Tips for Flux')
  })

  /**
   * AC-4: GIVEN der statische Hint-Block (alte Zeilen 24-31)
   *       WHEN buildSystemPrompt mit einem beliebigen Modell aufgerufen wird
   *       THEN ist KEINER der alten statischen Hint-Strings mehr enthalten
   */
  it('AC-4: should not contain any old static model hint strings', () => {
    // Test with multiple models to ensure no static hints leak through
    const models = [
      { id: 'black-forest-labs/flux-2-pro', name: 'Flux 2 Pro' },
      { id: 'recraft-ai/recraft-v4', name: 'Recraft V4' },
      { id: 'unknown-vendor/mystery-model', name: 'Mystery Model' },
    ]

    const oldStaticHints = [
      'FLUX models: Detailed scene descriptions',
      'Recraft V4: Minimalistic, design-oriented',
      'Google Imagen: Natural language descriptions',
      'Stable Diffusion: Keyword-rich prompts',
    ]

    for (const model of models) {
      const result = buildSystemPrompt(model.id, model.name, 'txt2img')

      for (const hint of oldStaticHints) {
        expect(result).not.toContain(hint)
      }
    }
  })

  /**
   * AC-5: GIVEN buildSystemPrompt wird mit einem bekannten Modell aufgerufen
   *       WHEN der zurueckgegebene String geprueft wird
   *       THEN enthaelt er weiterhin die Sections "Analysis Phase", "Improvement Strategy" und "Rules"
   */
  it('AC-5: should still contain Analysis Phase, Improvement Strategy and Rules sections', () => {
    const result = buildSystemPrompt('black-forest-labs/flux-2-pro', 'Flux 2 Pro', 'txt2img')

    expect(result).toContain('Analysis Phase')
    expect(result).toContain('Improvement Strategy')
    expect(result).toContain('Rules')
  })

  it('AC-5: should contain Analysis Phase, Improvement Strategy and Rules for unknown model too', () => {
    const result = buildSystemPrompt('unknown-vendor/mystery-model', 'Mystery Model', 'txt2img')

    expect(result).toContain('Analysis Phase')
    expect(result).toContain('Improvement Strategy')
    expect(result).toContain('Rules')
  })
})

// ==========================================================================
// improve -- Slice 04 Acceptance Tests
// ==========================================================================

describe('improve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChat.mockResolvedValue('improved prompt text')
  })

  /**
   * AC-6: GIVEN die Funktion improve(prompt, modelId, generationMode?) mit optionalem drittem Parameter
   *       WHEN improve("a cat", "black-forest-labs/flux-2-pro", "txt2img") aufgerufen wird
   *       THEN wird buildSystemPrompt intern mit allen drei Parametern (modelId, displayName, generationMode) aufgerufen
   *       AND wenn improve("a cat", "black-forest-labs/flux-2-pro") ohne generationMode aufgerufen wird,
   *            wird Default "txt2img" verwendet
   */
  it('AC-6: should pass generationMode through to buildSystemPrompt', async () => {
    await PromptService.improve('a cat', 'black-forest-labs/flux-2-pro', 'img2img')

    expect(mockChat).toHaveBeenCalledOnce()

    const systemPrompt = getSystemPromptFromLastCall()

    // When img2img is passed, the system prompt should contain img2img-specific tips
    expect(systemPrompt).toContain('Describe the desired changes relative to the source image')
    expect(systemPrompt).toContain('Mode-specific tips')
  })

  it('AC-6 (default): should use txt2img as default when generationMode is omitted in improve()', async () => {
    // Call without generationMode
    await PromptService.improve('a cat', 'black-forest-labs/flux-2-pro')

    expect(mockChat).toHaveBeenCalledOnce()

    const systemPromptNoMode = getSystemPromptFromLastCall()

    vi.clearAllMocks()
    mockChat.mockResolvedValue('improved prompt text')

    // Call with explicit txt2img
    await PromptService.improve('a cat', 'black-forest-labs/flux-2-pro', 'txt2img')

    const systemPromptWithMode = getSystemPromptFromLastCall()

    // Both should produce the same system prompt
    expect(systemPromptNoMode).toBe(systemPromptWithMode)
  })

  /**
   * AC-7: GIVEN die Funktion improve mit der neuen Signatur (generationMode optional mit Default "txt2img")
   *       WHEN TypeScript-Kompilierung (tsc --noEmit) laeuft
   *       THEN kompiliert das gesamte Projekt fehlerfrei -- insbesondere bestehende Aufrufer
   *            die improve(prompt, modelId) mit nur 2 Argumenten aufrufen
   *
   * Note: This test validates the type-level contract at runtime by exercising
   * both 2-arg and 3-arg call signatures. The full tsc --noEmit check is done
   * as acceptance command separately.
   */
  it('AC-7: should compile without errors when called with 2 args (no generationMode)', async () => {
    const result = await PromptService.improve('a cat', 'black-forest-labs/flux-2-pro')

    expect(result).toEqual({
      original: 'a cat',
      improved: 'improved prompt text',
    })
  })

  it('AC-7: should compile without errors when called with 3 args (explicit generationMode)', async () => {
    const result = await PromptService.improve('a cat', 'black-forest-labs/flux-2-pro', 'img2img')

    expect(result).toEqual({
      original: 'a cat',
      improved: 'improved prompt text',
    })
  })

  // --- Regression tests from previous slices (kept for backward compat) ---

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
