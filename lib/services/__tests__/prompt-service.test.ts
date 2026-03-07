import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChat = vi.fn()

vi.mock('@/lib/clients/openrouter', () => ({
  openRouterClient: {
    chat: (...args: unknown[]) => mockChat(...args),
  },
}))

import { PromptService } from '@/lib/services/prompt-service'

describe('PromptService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-2: GIVEN ein gueltiger Prompt-String
   *       WHEN PromptService.improve(prompt) aufgerufen wird
   *       THEN ruft der Service den OpenRouter-Client mit Model google/gemini-3.1-pro-preview,
   *            einem System-Prompt (Anweisung zur Prompt-Verbesserung) und dem User-Prompt auf
   *            und gibt { original: string, improved: string } zurueck
   */
  it('AC-2: should call openRouterClient with model google/gemini-3.1-pro-preview and return original plus improved', async () => {
    mockChat.mockResolvedValueOnce('A beautifully detailed cat sitting on a sunlit roof')

    const result = await PromptService.improve('A cat on a roof')

    expect(result).toEqual({
      original: 'A cat on a roof',
      improved: 'A beautifully detailed cat sitting on a sunlit roof',
    })

    expect(mockChat).toHaveBeenCalledOnce()
    expect(mockChat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-3.1-pro-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.any(String) }),
          expect.objectContaining({ role: 'user', content: 'A cat on a roof' }),
        ]),
      })
    )

    // Verify system prompt is about prompt engineering
    const callArgs = mockChat.mock.calls[0][0]
    const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
    expect(systemMessage.content).toContain('prompt')
  })

  it('AC-2: should trim the improved prompt string', async () => {
    mockChat.mockResolvedValueOnce('  improved text with spaces  ')

    const result = await PromptService.improve('original')

    expect(result.improved).toBe('improved text with spaces')
    expect(result.original).toBe('original')
  })

  /**
   * AC-3: GIVEN der OpenRouter-Client gibt einen HTTP-Fehler zurueck (z.B. 429 oder 500)
   *       WHEN PromptService.improve(prompt) aufgerufen wird
   *       THEN wirft der Service einen Error mit einer beschreibenden Fehlermeldung
   */
  it('AC-3: should throw error with descriptive message when openRouterClient fails', async () => {
    mockChat.mockRejectedValueOnce(new Error('OpenRouter API Fehler (429): Rate limit exceeded'))

    await expect(PromptService.improve('test prompt')).rejects.toThrow(
      'OpenRouter API Fehler (429): Rate limit exceeded'
    )
  })

  it('AC-3: should propagate generic errors from openRouterClient', async () => {
    mockChat.mockRejectedValueOnce(new Error('Network error'))

    await expect(PromptService.improve('test prompt')).rejects.toThrow('Network error')
  })
})
