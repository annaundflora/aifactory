/**
 * Tests for POST /api/projects/context/generate — Help-Me-Write Route Handler
 * Slice: slice-08-helper-modal-route
 *
 * Mocking Strategy: mock_external (from Slice Spec)
 *   - @/lib/clients/openrouter: vi.mock to stub openRouterClient.chat (no real HTTP)
 *   - @/lib/auth/guard:         globally mocked in vitest.setup.ts; per-test override via vi.mocked
 *   - @/lib/db:                 globally mocked in vitest.setup.ts (transitive safety, no DB used)
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before route imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

const mockChat = vi.fn()

vi.mock('@/lib/clients/openrouter', () => ({
  openRouterClient: {
    chat: (...args: unknown[]) => mockChat(...args),
  },
}))

// requireAuth comes pre-mocked from vitest.setup.ts; grab the typed mock
import { requireAuth } from '@/lib/auth/guard'
const mockRequireAuth = vi.mocked(requireAuth)

// Import AFTER mocks are set up
import { POST, runtime } from '../route'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'mock-user-id'
const USER_EMAIL = 'test@example.com'

/** Wortlaut-MUST exact aus architecture.md Zeile 338 + 492 — i18n-Konsistenz mit Frontend-Modal */
const ERROR_BRIEF_LENGTH =
  'Please describe your project briefly (10–500 characters).'
const ERROR_INVALID_BODY = 'Invalid request body'
const ERROR_GENERATE_FAILED = 'Could not generate. Try again.'
const ERROR_UNAUTHORIZED = 'Unauthorized'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a Request with a JSON body for POST calls. */
function buildJsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/projects/context/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** Builds a Request with a raw (non-JSON-parsable) body. */
function buildRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/projects/context/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

// ---------------------------------------------------------------------------
// Reset state between tests — restore happy-path defaults
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL })
  mockChat.mockResolvedValue('Project subject: a generic project. Aesthetic: neutral.')
})

// ===========================================================================
// Acceptance tests — 1:1 mapping to GIVEN/WHEN/THEN
// ===========================================================================

describe('Slice 08 Acceptance — POST /api/projects/context/generate', () => {
  // -------------------------------------------------------------------------
  // AC-1: 401 when auth fails — no OpenRouter call
  // -------------------------------------------------------------------------
  it('AC-1: POST returns 401 when requireAuth returns { error } and does not call OpenRouter', async () => {
    /**
     * AC-1: GIVEN kein gueltiger Auth-Session-Cookie (requireAuth liefert { error })
     *       WHEN POST /api/projects/context/generate aufgerufen wird
     *       THEN Response ist 401 Unauthorized mit Body { error: "Unauthorized" };
     *            KEIN OpenRouter-Aufruf erfolgt.
     */
    mockRequireAuth.mockResolvedValueOnce({ error: 'Unauthorized' })

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_UNAUTHORIZED })
    expect(mockChat).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC-2: 200 with { draft } shape
  // -------------------------------------------------------------------------
  it('AC-2: POST returns 200 with { draft } when OpenRouter responds with valid content', async () => {
    /**
     * AC-2: GIVEN authentifizierter User und Body { brief: "Magic Mushroom POD shop, dark academia, no hyperreal" }
     *       WHEN der Handler aufgerufen wird und der OpenRouter-Client einen gueltigen Draft zurueckliefert
     *       THEN Response ist 200 OK mit { draft: "<llm-text>" } matching GenerateProjectContextResponse;
     *            der draft-String ist nicht leer und <= 8000 Zeichen.
     */
    const llmDraft = 'Magic Mushroom POD shop. Aesthetic: dark academia, vintage botanical illustration. Avoid: hyperreal, glossy.'
    mockChat.mockResolvedValueOnce(llmDraft)

    const response = await POST(
      buildJsonRequest({
        brief: 'Magic Mushroom POD shop, dark academia, no hyperreal',
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ draft: llmDraft })
    expect(typeof body.draft).toBe('string')
    expect(body.draft.length).toBeGreaterThan(0)
    expect(body.draft.length).toBeLessThanOrEqual(8000)
  })

  // -------------------------------------------------------------------------
  // AC-3: 422 when brief post-trim < 10 chars (with exact message)
  // -------------------------------------------------------------------------
  it('AC-3: POST returns 422 with exact length-error message when brief is shorter than 10 chars after trim', async () => {
    /**
     * AC-3: GIVEN authentifizierter User und Body { brief: "  Hi  " } (post-trim 2 chars)
     *       WHEN der Handler aufgerufen wird
     *       THEN Response ist 422 Unprocessable Entity mit Body { error: "Please describe your project briefly (10–500 characters)." }
     *            (Wortlaut exakt aus architecture.md Zeile 338); KEIN OpenRouter-Aufruf.
     */
    const response = await POST(buildJsonRequest({ brief: '  Hi  ' }))

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_BRIEF_LENGTH })
    expect(mockChat).not.toHaveBeenCalled()
  })

  it('AC-3: POST returns 422 when brief is exactly 9 chars after trim', async () => {
    // Boundary check: 9 chars must fail (BRIEF_MIN_LENGTH = 10).
    const nineChars = 'a'.repeat(9)
    const response = await POST(buildJsonRequest({ brief: nineChars }))

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_BRIEF_LENGTH })
    expect(mockChat).not.toHaveBeenCalled()
  })

  it('AC-3: POST returns 422 when brief is empty after trim', async () => {
    // Whitespace-only brief reduces to "" post-trim.
    const response = await POST(buildJsonRequest({ brief: '          ' }))

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_BRIEF_LENGTH })
    expect(mockChat).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC-4: 422 when brief post-trim > 500 chars
  // -------------------------------------------------------------------------
  it('AC-4: POST returns 422 with same length-error message when brief exceeds 500 chars after trim', async () => {
    /**
     * AC-4: GIVEN authentifizierter User und Body mit brief von 501 Zeichen (post-trim)
     *       WHEN der Handler aufgerufen wird
     *       THEN Response ist 422 mit demselben Wortlaut wie AC-3; KEIN OpenRouter-Aufruf.
     */
    const fiveHundredOneChars = 'a'.repeat(501)
    const response = await POST(buildJsonRequest({ brief: fiveHundredOneChars }))

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_BRIEF_LENGTH })
    expect(mockChat).not.toHaveBeenCalled()
  })

  it('AC-4: POST returns 200 when brief is exactly 500 chars (boundary in-range)', async () => {
    // Boundary check: 500 chars must pass (BRIEF_MAX_LENGTH = 500 inclusive).
    const fiveHundredChars = 'a'.repeat(500)
    mockChat.mockResolvedValueOnce('valid draft response')
    const response = await POST(buildJsonRequest({ brief: fiveHundredChars }))

    expect(response.status).toBe(200)
    expect(mockChat).toHaveBeenCalledOnce()
  })

  it('AC-4: POST returns 200 when brief is exactly 10 chars (boundary in-range)', async () => {
    // Boundary check: 10 chars must pass (BRIEF_MIN_LENGTH = 10 inclusive).
    const tenChars = 'a'.repeat(10)
    mockChat.mockResolvedValueOnce('valid draft response')
    const response = await POST(buildJsonRequest({ brief: tenChars }))

    expect(response.status).toBe(200)
    expect(mockChat).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // AC-5: 422 when body is malformed (non-JSON / missing field / wrong type)
  // -------------------------------------------------------------------------
  describe('AC-5: malformed body returns 422 with "Invalid request body"', () => {
    /**
     * AC-5: GIVEN authentifizierter User und Request-Body, der NICHT JSON ist, kein brief enthaelt,
     *            oder brief nicht-string ist (z.B. {}, { brief: 42 }, { foo: "bar" }, oder rohes "text")
     *       WHEN der Handler aufgerufen wird
     *       THEN Response ist 422 mit Body { error: "Invalid request body" }; KEIN OpenRouter-Aufruf.
     */
    it('returns 422 when body is non-JSON garbage', async () => {
      const response = await POST(buildRawRequest('not-json-at-all{{{'))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({ error: ERROR_INVALID_BODY })
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('returns 422 when body is empty object {}', async () => {
      const response = await POST(buildJsonRequest({}))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({ error: ERROR_INVALID_BODY })
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('returns 422 when brief is a number (non-string)', async () => {
      const response = await POST(buildJsonRequest({ brief: 42 }))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({ error: ERROR_INVALID_BODY })
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('returns 422 when body has no brief field (e.g. { foo: "bar" })', async () => {
      const response = await POST(buildJsonRequest({ foo: 'bar' }))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({ error: ERROR_INVALID_BODY })
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('returns 422 when body is a raw JSON string (not an object)', async () => {
      const response = await POST(buildRawRequest('"text"'))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({ error: ERROR_INVALID_BODY })
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('returns 422 when body is null', async () => {
      const response = await POST(buildRawRequest('null'))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({ error: ERROR_INVALID_BODY })
      expect(mockChat).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // AC-6: 502 when OpenRouter throws — error logged, retry-hint message
  // -------------------------------------------------------------------------
  it('AC-6: POST returns 502 with retry-hint message when openRouterClient.chat throws', async () => {
    /**
     * AC-6: GIVEN authentifizierter User, gueltiger Brief, und der OpenRouter-Client wirft eine Exception
     *            (Timeout, Non-2xx, leere Response)
     *       WHEN der Handler aufgerufen wird
     *       THEN Response ist 502 Bad Gateway mit Body { error: "Could not generate. Try again." }
     *            (Wortlaut aus architecture.md Zeile 492); der Fehler wird einmal serverseitig geloggt;
     *            das Frontend kann via Modal-Regenerate retryen.
     */
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockChat.mockRejectedValueOnce(new Error('OpenRouter request timed out after 30 seconds'))

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_GENERATE_FAILED })
    // Error must be logged once (architecture.md Zeile 492: "Error log w/ correlation id")
    expect(consoleErrorSpy).toHaveBeenCalledOnce()

    consoleErrorSpy.mockRestore()
  })

  it('AC-6: POST returns 502 when OpenRouter rejects with non-Error value', async () => {
    // Robustness: handler must still produce 502 when the client throws a string.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockChat.mockRejectedValueOnce('string-error')

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body).toEqual({ error: ERROR_GENERATE_FAILED })
    expect(consoleErrorSpy).toHaveBeenCalledOnce()

    consoleErrorSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // AC-7: Exactly one OpenRouter call with default model + system+user messages
  // -------------------------------------------------------------------------
  it('AC-7: POST invokes openRouterClient.chat exactly once with default model and system+user messages containing trimmed brief', async () => {
    /**
     * AC-7: GIVEN authentifizierter User, gueltiger Brief
     *       WHEN der Handler den OpenRouter-Client aufruft
     *       THEN der Aufruf nutzt genau ein chat({ model, messages })-Invocation mit
     *            model = "anthropic/claude-sonnet-4.6" und einer messages-Liste, die mindestens
     *            eine system-Message mit Helper-Anweisungen sowie eine user-Message mit dem
     *            getrimmten Brief enthaelt. KEIN Streaming, KEINE Schleife, KEIN zweiter Aufruf.
     */
    mockChat.mockResolvedValueOnce('valid draft text')
    const briefRaw = '   a brief about a magical project   '
    const briefTrimmed = 'a brief about a magical project'

    await POST(buildJsonRequest({ brief: briefRaw }))

    // Exactly one invocation
    expect(mockChat).toHaveBeenCalledOnce()

    const callArg = mockChat.mock.calls[0][0]

    // Default model
    expect(callArg.model).toBe(DEFAULT_MODEL)

    // Messages list shape
    expect(Array.isArray(callArg.messages)).toBe(true)
    const systemMsgs = callArg.messages.filter(
      (m: { role: string }) => m.role === 'system',
    )
    const userMsgs = callArg.messages.filter(
      (m: { role: string }) => m.role === 'user',
    )

    // At least one system message with non-empty helper instructions
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1)
    expect(typeof systemMsgs[0].content).toBe('string')
    expect(systemMsgs[0].content.length).toBeGreaterThan(0)

    // At least one user message containing the TRIMMED brief (not the raw input)
    expect(userMsgs.length).toBeGreaterThanOrEqual(1)
    const userContent = userMsgs.map((m: { content: string }) => m.content).join('\n')
    expect(userContent).toContain(briefTrimmed)
    // Defence: raw (untrimmed) brief MUST NOT appear verbatim.
    expect(userContent).not.toContain(briefRaw)
  })

  it('AC-7: POST does not pass a streaming flag or a model field from the body', async () => {
    // Constraint: model is NOT taken from the body (architecture.md Zeile 515),
    // and streaming is disabled (Zeile 576).
    mockChat.mockResolvedValueOnce('valid draft text')

    await POST(
      buildJsonRequest({
        brief: 'a perfectly valid brief for testing',
        // Attempt to inject a different model — must be ignored
        model: 'openai/gpt-3.5-turbo',
        stream: true,
      }),
    )

    expect(mockChat).toHaveBeenCalledOnce()
    const callArg = mockChat.mock.calls[0][0]
    expect(callArg.model).toBe(DEFAULT_MODEL)
    // No `stream: true` should be forwarded (handler must not enable streaming)
    expect(callArg.stream).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // AC-8: Draft > 8000 chars -> truncated to 8000
  // -------------------------------------------------------------------------
  it('AC-8: POST truncates draft to 8000 characters when OpenRouter returns longer content', async () => {
    /**
     * AC-8: GIVEN der OpenRouter-Client liefert einen Draft mit > 8000 Zeichen
     *       WHEN der Handler die Response konstruiert
     *       THEN der Draft wird auf 8000 Zeichen gekuerzt (draft.slice(0, 8000)),
     *            bevor er als { draft } zurueckgegeben wird; Response bleibt 200 OK.
     */
    const longDraft = 'X'.repeat(9000)
    mockChat.mockResolvedValueOnce(longDraft)

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.draft.length).toBe(8000)
    // Truncation must be a leading-slice (defence-in-depth), not an arbitrary substring
    expect(body.draft).toBe(longDraft.slice(0, 8000))
  })

  it('AC-8: POST does NOT truncate when draft is exactly 8000 characters', async () => {
    // Boundary: 8000 chars must pass through unchanged.
    const exactly8k = 'Y'.repeat(8000)
    mockChat.mockResolvedValueOnce(exactly8k)

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.draft.length).toBe(8000)
    expect(body.draft).toBe(exactly8k)
  })

  it('AC-8: POST does NOT truncate when draft is shorter than 8000 characters', async () => {
    const shortDraft = 'a short draft'
    mockChat.mockResolvedValueOnce(shortDraft)

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.draft).toBe(shortDraft)
  })

  // -------------------------------------------------------------------------
  // AC-9: Module exports POST + runtime = "nodejs", no GET/PATCH
  // -------------------------------------------------------------------------
  it('AC-9: route module exports POST handler and sets runtime to "nodejs"', async () => {
    /**
     * AC-9: GIVEN Next.js 16 App Router Konvention fuer Route Handler
     *       WHEN der Handler-Implementer die Datei erstellt
     *       THEN der Handler exportiert ausschliesslich POST (kein GET/PATCH);
     *            runtime = "nodejs" ist explizit gesetzt; Response wird via
     *            Response.json(payload, { status }) zurueckgegeben.
     */
    expect(runtime).toBe('nodejs')

    // Dynamic import to inspect all exports
    const routeModule = await import('../route')
    expect(routeModule).toHaveProperty('POST')
    expect(typeof routeModule.POST).toBe('function')
    expect(routeModule).not.toHaveProperty('GET')
    expect(routeModule).not.toHaveProperty('PATCH')
    expect(routeModule).not.toHaveProperty('PUT')
    expect(routeModule).not.toHaveProperty('DELETE')
  })

  it('AC-9: response is constructed via Response.json (proper Response instance with JSON body)', async () => {
    // Verify the Response shape: instance of Response, JSON content-type, parseable body.
    mockChat.mockResolvedValueOnce('a draft')
    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toMatch(/application\/json/)

    const body = await response.json()
    expect(body).toHaveProperty('draft')
  })
})

// ===========================================================================
// Adversarial / Robustness tests for the LLM integration
// ===========================================================================

describe('Slice 08 Adversarial — LLM/validation edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL })
  })

  it('Adversarial: handler tolerates LLM returning empty string (still 200, empty draft)', async () => {
    // The architecture allows an empty string draft; the OpenRouter client itself rejects
    // empty content, but if for some reason a literal "" comes through, the handler
    // must NOT crash. It should still produce a valid Response.
    mockChat.mockResolvedValueOnce('')

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ draft: '' })
  })

  it('Adversarial: handler tolerates LLM returning multibyte/unicode content within 8000 char cap', async () => {
    // Provoke string-cap edge with multi-byte characters: "slice(0, 8000)" works on
    // UTF-16 code units, so the resulting string length is exactly 8000.
    const unicodeDraft = '\u{1F44B}'.repeat(5000) // wave emoji is surrogate-pair (length 2)
    mockChat.mockResolvedValueOnce(unicodeDraft)

    const response = await POST(
      buildJsonRequest({ brief: 'a perfectly valid brief for testing' }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    // The original is 10000 UTF-16 code units, must be truncated to 8000.
    expect(body.draft.length).toBe(8000)
  })

  it('Adversarial: handler does NOT call OpenRouter when auth check happens before body parse', async () => {
    // Even with a perfectly valid brief, an unauthenticated request must short-circuit.
    mockRequireAuth.mockResolvedValueOnce({ error: 'Unauthorized' })

    await POST(
      buildJsonRequest({
        brief: 'a perfectly valid brief that should never reach OpenRouter',
      }),
    )

    expect(mockChat).not.toHaveBeenCalled()
  })

  it('Adversarial: handler does NOT call OpenRouter when validation fails (defence: validation BEFORE LLM)', async () => {
    // Both empty body and short brief: OpenRouter must never be hit.
    await POST(buildJsonRequest({}))
    await POST(buildJsonRequest({ brief: 'short' }))
    await POST(buildRawRequest('not-json'))

    expect(mockChat).not.toHaveBeenCalled()
  })

  it('Adversarial: brief with leading/trailing whitespace is trimmed before length check (boundary 10 chars)', async () => {
    // Pre-trim: 14 chars; post-trim: 10 chars (BRIEF_MIN_LENGTH = 10) — must pass.
    const briefWithWhitespace = '  abcdefghij  '
    mockChat.mockResolvedValueOnce('valid draft')

    const response = await POST(buildJsonRequest({ brief: briefWithWhitespace }))

    expect(response.status).toBe(200)
    expect(mockChat).toHaveBeenCalledOnce()
    // The trimmed brief is forwarded to OpenRouter
    const callArg = mockChat.mock.calls[0][0]
    const userContent = callArg.messages
      .filter((m: { role: string }) => m.role === 'user')
      .map((m: { content: string }) => m.content)
      .join('\n')
    expect(userContent).toContain('abcdefghij')
    expect(userContent).not.toContain('  abcdefghij  ')
  })
})
