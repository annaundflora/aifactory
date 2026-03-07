import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Save original fetch and timers
const originalFetch = globalThis.fetch

describe('OpenRouterClient', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key-123')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.resetModules()
  })

  // --- Existing baseline tests ---

  it('should send POST to OpenRouter chat/completions with auth header and return content string', async () => {
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

  it('should throw descriptive error when API returns non-OK status (429)', async () => {
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

  it('should throw descriptive error when API returns non-OK status (500)', async () => {
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

  // --- Timeout Tests (Slice-20 ACs) ---

  describe('OpenRouter Client Timeout', () => {
    /**
     * AC-1: GIVEN der OpenRouter-Client wird ohne timeout-Parameter aufgerufen
     *       WHEN chat() ausgefuehrt wird
     *       THEN wird ein AbortController mit 30000ms Timeout an den fetch()-Call uebergeben
     */
    it('AC-1: should use 30000ms as default timeout when no timeout parameter is provided', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      })

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      await openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
      })

      // Find the setTimeout call that was made with 30000ms
      const timeoutCalls = setTimeoutSpy.mock.calls.filter(
        (call) => call[1] === 30000
      )
      expect(timeoutCalls.length).toBeGreaterThanOrEqual(1)

      // Verify fetch was called with an AbortSignal
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      const fetchCallArgs = fetchMock.mock.calls[0]
      expect(fetchCallArgs[1]).toHaveProperty('signal')
      expect(fetchCallArgs[1].signal).toBeInstanceOf(AbortSignal)
    })

    /**
     * AC-2: GIVEN der OpenRouter-Client wird mit timeout: 15000 aufgerufen
     *       WHEN chat() ausgefuehrt wird
     *       THEN wird ein AbortController mit 15000ms Timeout an den fetch()-Call uebergeben
     */
    it('AC-2: should use the provided timeout value when timeout parameter is specified', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      })

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      await openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        timeout: 15000,
      })

      // Find the setTimeout call that was made with 15000ms
      const timeoutCalls = setTimeoutSpy.mock.calls.filter(
        (call) => call[1] === 15000
      )
      expect(timeoutCalls.length).toBeGreaterThanOrEqual(1)

      // Verify fetch was called with an AbortSignal
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      const fetchCallArgs = fetchMock.mock.calls[0]
      expect(fetchCallArgs[1]).toHaveProperty('signal')
      expect(fetchCallArgs[1].signal).toBeInstanceOf(AbortSignal)
    })

    /**
     * AC-3: GIVEN ein laufender chat()-Call
     *       WHEN der konfigurierte Timeout ueberschritten wird
     *       THEN wird der Fetch abgebrochen und ein Fehler mit aussagekraeftiger Nachricht
     *            geworfen (enthaelt "timeout" und die konfigurierte Dauer in Sekunden)
     */
    it('AC-3: should throw a descriptive timeout error when the configured timeout is exceeded', async () => {
      vi.useFakeTimers()

      // Mock fetch to return a promise that never resolves (simulating slow response)
      // but that does reject when the signal is aborted
      globalThis.fetch = vi.fn().mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                const abortError = new Error('The operation was aborted')
                abortError.name = 'AbortError'
                reject(abortError)
              })
            }
          })
        }
      )

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      const chatPromise = openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        timeout: 5000,
      })

      // Advance timers past the timeout
      vi.advanceTimersByTime(5001)

      // Catch the error and verify it contains "timeout" and the duration in seconds
      let thrownError: Error | undefined
      try {
        await chatPromise
      } catch (e) {
        thrownError = e as Error
      }

      expect(thrownError).toBeDefined()
      expect(thrownError!.message).toMatch(/timed out/i)
      expect(thrownError!.message).toMatch(/5/)
    })

    /**
     * AC-3 variant: Verify default timeout (30s) also produces correct error message
     */
    it('AC-3: should include duration in seconds (30) in timeout error for default timeout', async () => {
      vi.useFakeTimers()

      globalThis.fetch = vi.fn().mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                const abortError = new Error('The operation was aborted')
                abortError.name = 'AbortError'
                reject(abortError)
              })
            }
          })
        }
      )

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      const chatPromise = openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        // No timeout param -- uses default 30000ms
      })

      vi.advanceTimersByTime(30001)

      // Catch the error and verify it contains "timeout" and the duration in seconds
      let thrownError: Error | undefined
      try {
        await chatPromise
      } catch (e) {
        thrownError = e as Error
      }

      expect(thrownError).toBeDefined()
      expect(thrownError!.message).toMatch(/timed out/i)
      expect(thrownError!.message).toMatch(/30/)
    })

    /**
     * AC-4: GIVEN ein laufender chat()-Call mit AbortController
     *       WHEN der Call erfolgreich vor dem Timeout abschliesst
     *       THEN wird der Timeout-Timer aufgeraeumt (clearTimeout) um Memory Leaks zu vermeiden
     */
    it('AC-4: should clear the timeout timer after a successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'success response' } }],
        }),
      })

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      const result = await openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        timeout: 10000,
      })

      expect(result).toBe('success response')

      // clearTimeout must have been called at least once (to clean up the timer)
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // The clearTimeout should have been called with a timer ID (number or NodeJS.Timeout)
      const clearTimeoutCalls = clearTimeoutSpy.mock.calls
      const calledWithTimerId = clearTimeoutCalls.some(
        (call) => call[0] !== undefined && call[0] !== null
      )
      expect(calledWithTimerId).toBe(true)
    })

    /**
     * AC-4 variant: clearTimeout is also called in error path (no leak on API errors)
     */
    it('AC-4: should clear the timeout timer even when fetch returns an API error', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'server error',
      })

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      await expect(
        openRouterClient.chat({
          model: 'test-model',
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow()

      // clearTimeout must have been called to prevent memory leak
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    /**
     * AC-5: GIVEN das bestehende ChatParams-Interface
     *       WHEN der timeout-Parameter hinzugefuegt wird
     *       THEN ist er optional (timeout?: number) und bricht keine bestehenden Aufrufer
     */
    it('AC-5: should accept calls without timeout parameter without breaking existing interface', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'backward compatible response' } }],
        }),
      })

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      // Call without timeout -- should work exactly like before
      const result = await openRouterClient.chat({
        model: 'openai/gpt-oss-120b:exacto',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'A cat on a roof' },
        ],
      })

      expect(result).toBe('backward compatible response')

      // Verify fetch was still called correctly
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key-123',
          }),
        })
      )
    })

    /**
     * AC-5 variant: TypeScript type compatibility -- timeout is optional,
     * calling with only model + messages compiles and works
     */
    it('AC-5: should work with various message configurations without timeout', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'single message response' } }],
        }),
      })

      const { openRouterClient } = await import('@/lib/clients/openrouter')

      // Minimal call -- only required params
      const result = await openRouterClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'hello' }],
      })

      expect(result).toBe('single message response')
    })
  })
})
