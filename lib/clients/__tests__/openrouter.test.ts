import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Save original fetch
const originalFetch = globalThis.fetch

describe('OpenRouterClient', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key-123')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  /**
   * AC-1: GIVEN ein gueltiger OPENROUTER_API_KEY in env
   *       WHEN openRouterClient.chat({ model, messages }) aufgerufen wird
   *       THEN sendet der Client einen POST-Request an https://openrouter.ai/api/v1/chat/completions
   *            mit Authorization: Bearer ${OPENROUTER_API_KEY} Header und gibt den
   *            choices[0].message.content String zurueck
   */
  it('AC-1: should send POST to OpenRouter chat/completions with auth header and return content string', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Improved prompt text' } }],
    }

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { openRouterClient } = await import('@/lib/clients/openrouter')

    const result = await openRouterClient.chat({
      model: 'openai/gpt-oss-120b:exacto',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'A cat on a roof' },
      ],
    })

    expect(result).toBe('Improved prompt text')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key-123',
        }),
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b:exacto',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'A cat on a roof' },
          ],
        }),
      })
    )
  })

  /**
   * AC-3: GIVEN der OpenRouter-Client gibt einen HTTP-Fehler zurueck (z.B. 429 oder 500)
   *       WHEN openRouterClient.chat aufgerufen wird
   *       THEN wirft der Client einen Error mit einer beschreibenden Fehlermeldung
   */
  it('AC-3: should throw descriptive error when API returns non-OK status (429)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded',
    })

    const { openRouterClient } = await import('@/lib/clients/openrouter')

    await expect(
      openRouterClient.chat({
        model: 'openai/gpt-oss-120b:exacto',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow(/429/)
  })

  it('AC-3: should throw descriptive error when API returns non-OK status (500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server broke',
    })

    const { openRouterClient } = await import('@/lib/clients/openrouter')

    await expect(
      openRouterClient.chat({
        model: 'openai/gpt-oss-120b:exacto',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow(/500/)
  })

  it('should throw error when OPENROUTER_API_KEY is not set', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')

    const { openRouterClient } = await import('@/lib/clients/openrouter')

    await expect(
      openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow(/OPENROUTER_API_KEY/)
  })

  it('should throw error when response has no content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    })

    const { openRouterClient } = await import('@/lib/clients/openrouter')

    await expect(
      openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow(/keine Antwort/)
  })
})
