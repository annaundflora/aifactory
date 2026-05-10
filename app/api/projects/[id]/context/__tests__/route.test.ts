/**
 * Tests for GET / PATCH /api/projects/[id]/context
 * Slice: slice-03-context-routes
 *
 * Mocking Strategy: mock_external (from Slice Spec)
 *   - @/lib/auth/guard:    globally mocked in vitest.setup.ts; per-test override via vi.mocked
 *   - @/lib/db/queries:    explicit vi.mock to stub getProjectContext / updateProjectContext
 *   - @/lib/db:            globally mocked in vitest.setup.ts (transitive safety)
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before route imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

const mockGetProjectContext = vi.fn()
const mockUpdateProjectContext = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getProjectContext: (...args: unknown[]) => mockGetProjectContext(...args),
  updateProjectContext: (...args: unknown[]) => mockUpdateProjectContext(...args),
}))

// requireAuth comes pre-mocked from vitest.setup.ts; grab the typed mock
import { requireAuth } from '@/lib/auth/guard'
const mockRequireAuth = vi.mocked(requireAuth)

// Import AFTER mocks are set up
import { GET, PATCH, runtime } from '../route'

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const PROJECT_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID = 'mock-user-id'
const USER_EMAIL = 'test@example.com'

const FIXED_TIMESTAMP = new Date('2026-05-01T10:00:00.000Z')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds the params object that Next.js 16 passes to dynamic route handlers. */
function buildParams(id: string = PROJECT_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

/** Builds a Request with a JSON body for PATCH calls. */
function buildPatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/projects/x/context', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** Builds a Request with a non-JSON raw body. */
function buildRawPatchRequest(rawBody: string): Request {
  return new Request('http://localhost/api/projects/x/context', {
    method: 'PATCH',
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
  mockGetProjectContext.mockResolvedValue(null)
  mockUpdateProjectContext.mockResolvedValue(null)
})

// ===========================================================================
// Acceptance tests — 1:1 mapping to GIVEN/WHEN/THEN
// ===========================================================================

describe('Slice 03 Acceptance — GET/PATCH /api/projects/[id]/context', () => {
  // -------------------------------------------------------------------------
  // AC-1: 401 when auth fails — both methods, no DB call
  // -------------------------------------------------------------------------
  describe('AC-1: Unauthenticated -> 401, no DB call', () => {
    it('GET returns 401 with { error: "Unauthorized" } when requireAuth returns { error }', async () => {
      /**
       * AC-1: GIVEN kein gueltiger Auth-Session-Cookie (requireAuth liefert { error })
       *       WHEN GET /api/projects/{id}/context aufgerufen wird
       *       THEN Response ist 401 Unauthorized mit Body { error: "Unauthorized" };
       *            KEIN DB-Aufruf erfolgt.
       */
      mockRequireAuth.mockResolvedValueOnce({ error: 'Unauthorized' })

      const response = await GET(new Request('http://localhost/'), buildParams())

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
      expect(mockGetProjectContext).not.toHaveBeenCalled()
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })

    it('PATCH returns 401 with { error: "Unauthorized" } when requireAuth returns { error }', async () => {
      /**
       * AC-1: GIVEN kein gueltiger Auth-Session-Cookie (requireAuth liefert { error })
       *       WHEN PATCH /api/projects/{id}/context aufgerufen wird
       *       THEN Response ist 401 Unauthorized mit Body { error: "Unauthorized" };
       *            KEIN DB-Aufruf erfolgt.
       */
      mockRequireAuth.mockResolvedValueOnce({ error: 'Unauthorized' })

      const response = await PATCH(
        buildPatchRequest({ context_instructions: 'hello' }),
        buildParams(),
      )

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
      expect(mockGetProjectContext).not.toHaveBeenCalled()
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // AC-2: GET 200 with ProjectContextResponse shape (snake_case + ISO)
  // -------------------------------------------------------------------------
  describe('AC-2: GET 200 -> ProjectContextResponse shape', () => {
    it('returns 200 with snake_case fields and ISO timestamp', async () => {
      /**
       * AC-2: GIVEN authentifizierter User mit Projekt
       *            (contextInstructions = "draw cyberpunk",
       *             contextUpdatedAt = 2026-05-01T10:00:00Z)
       *       WHEN GET /api/projects/{id}/context aufgerufen wird
       *       THEN Response ist 200 mit JSON-Body
       *            { id, context_instructions: "draw cyberpunk",
       *              context_updated_at: "2026-05-01T10:00:00.000Z" }
       */
      mockGetProjectContext.mockResolvedValueOnce({
        contextInstructions: 'draw cyberpunk',
        contextUpdatedAt: FIXED_TIMESTAMP,
      })

      const response = await GET(new Request('http://localhost/'), buildParams())

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        id: PROJECT_ID,
        context_instructions: 'draw cyberpunk',
        context_updated_at: '2026-05-01T10:00:00.000Z',
      })

      // Helper called with combined id + userId filter (architecture.md ownership pattern)
      expect(mockGetProjectContext).toHaveBeenCalledTimes(1)
      expect(mockGetProjectContext).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: USER_ID,
      })
    })

    it('returns 200 with context_updated_at: null when timestamp is null', async () => {
      /**
       * AC-2 boundary: ein Projekt ohne jemals gesetzten Context kann
       * contextUpdatedAt === null haben. ISO-Konvertierung darf nicht
       * crashen — Handler muss null durchreichen.
       */
      mockGetProjectContext.mockResolvedValueOnce({
        contextInstructions: null,
        contextUpdatedAt: null,
      })

      const response = await GET(new Request('http://localhost/'), buildParams())

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      })
    })
  })

  // -------------------------------------------------------------------------
  // AC-3: GET 404 — same behaviour for foreign + non-existent (no leak)
  // -------------------------------------------------------------------------
  describe('AC-3: GET 404 -> Project not found (no existence leak)', () => {
    it('returns 404 with { error: "Project not found" } when getProjectContext returns null', async () => {
      /**
       * AC-3: GIVEN authentifizierter User, dem das Projekt nicht gehoert
       *            (oder Projekt existiert nicht)
       *       WHEN GET /api/projects/{id}/context aufgerufen wird
       *       THEN Response ist 404 mit Body { error: "Project not found" };
       *            kein Unterschied zwischen "fremd" und "nicht existent".
       */
      mockGetProjectContext.mockResolvedValueOnce(null)

      const response = await GET(new Request('http://localhost/'), buildParams())

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Project not found' })
    })

    it('does NOT use status 403 (would leak existence)', async () => {
      /**
       * AC-3 invariant: 403 MUST NOT be used — that would distinguish
       * "exists but not yours" from "does not exist".
       */
      mockGetProjectContext.mockResolvedValueOnce(null)

      const response = await GET(new Request('http://localhost/'), buildParams())

      expect(response.status).not.toBe(403)
      expect(response.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // AC-4: PATCH happy path — trim + persist + re-GET
  // -------------------------------------------------------------------------
  describe('AC-4: PATCH happy path — trim + persist', () => {
    it('trims whitespace and returns updated context_instructions + new context_updated_at', async () => {
      /**
       * AC-4: GIVEN authentifizierter Owner, Body { context_instructions: "  hello world  " }
       *       WHEN PATCH /api/projects/{id}/context (Content-Type: application/json)
       *       THEN Response ist 200 mit
       *            { id, context_instructions: "hello world",
       *              context_updated_at: "<ISO timestamp >= request-time>" };
       *            Whitespace ist getrimmt.
       */
      const requestStart = new Date()
      const updatedAt = new Date(requestStart.getTime() + 1)

      mockUpdateProjectContext.mockResolvedValueOnce({
        contextInstructions: 'hello world',
        contextUpdatedAt: updatedAt,
      })

      const response = await PATCH(
        buildPatchRequest({ context_instructions: '  hello world  ' }),
        buildParams(),
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(PROJECT_ID)
      expect(body.context_instructions).toBe('hello world')
      // Timestamp must be ISO string >= request-time
      expect(typeof body.context_updated_at).toBe('string')
      expect(new Date(body.context_updated_at).getTime()).toBeGreaterThanOrEqual(
        requestStart.getTime(),
      )

      // Helper called with TRIMMED value (not raw)
      expect(mockUpdateProjectContext).toHaveBeenCalledTimes(1)
      expect(mockUpdateProjectContext).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: USER_ID,
        contextInstructions: 'hello world',
      })
    })

    it('follow-up GET returns the value persisted by PATCH (round-trip)', async () => {
      /**
       * AC-4 (round-trip): nach erfolgreichem PATCH liefert eine Folge-
       * GET-Anfrage denselben Wert. Da der DB-Helper hier gemockt ist,
       * simulieren wir die Persistierung durch eine vom PATCH-Mock
       * ueberlebende getProjectContext-Antwort.
       */
      const ts = new Date()

      mockUpdateProjectContext.mockResolvedValueOnce({
        contextInstructions: 'persistent value',
        contextUpdatedAt: ts,
      })
      mockGetProjectContext.mockResolvedValueOnce({
        contextInstructions: 'persistent value',
        contextUpdatedAt: ts,
      })

      const patchResponse = await PATCH(
        buildPatchRequest({ context_instructions: '  persistent value  ' }),
        buildParams(),
      )
      expect(patchResponse.status).toBe(200)
      const patchBody = await patchResponse.json()
      expect(patchBody.context_instructions).toBe('persistent value')

      const getResponse = await GET(new Request('http://localhost/'), buildParams())
      expect(getResponse.status).toBe(200)
      const getBody = await getResponse.json()
      expect(getBody.context_instructions).toBe('persistent value')
      expect(getBody.context_updated_at).toBe(ts.toISOString())
    })
  })

  // -------------------------------------------------------------------------
  // AC-5: PATCH 422 when post-trim length > 8000
  // -------------------------------------------------------------------------
  describe('AC-5: PATCH 422 -> length exceeded (exact wording)', () => {
    it('returns 422 with exact error message when context_instructions has 8001 chars post-trim', async () => {
      /**
       * AC-5: GIVEN authentifizierter Owner, Body mit context_instructions
       *            mit 8001 Zeichen (post-trim)
       *       WHEN PATCH aufgerufen wird
       *       THEN Response ist 422 mit Body
       *            { error: "Context exceeds maximum length of 8000 characters." };
       *            KEIN DB-UPDATE.
       */
      const tooLong = 'a'.repeat(8001)

      const response = await PATCH(
        buildPatchRequest({ context_instructions: tooLong }),
        buildParams(),
      )

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({
        error: 'Context exceeds maximum length of 8000 characters.',
      })
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })

    it('accepts exactly 8000 chars post-trim (boundary, inclusive)', async () => {
      /**
       * AC-5 boundary: 8000 chars post-trim is VALID (the limit is "<=8000",
       * 422 only triggers at 8001+).
       */
      const exact = 'a'.repeat(8000)

      mockUpdateProjectContext.mockResolvedValueOnce({
        contextInstructions: exact,
        contextUpdatedAt: new Date(),
      })

      const response = await PATCH(
        buildPatchRequest({ context_instructions: exact }),
        buildParams(),
      )

      expect(response.status).toBe(200)
      expect(mockUpdateProjectContext).toHaveBeenCalledTimes(1)
    })

    it('accepts 8001 raw chars when surrounding whitespace makes post-trim <= 8000', async () => {
      /**
       * AC-5 trim-order invariant: 8001 chars vor Trim mit umgebenden
       * Spaces ist gueltig wenn post-trim Laenge <= 8000 (architecture.md
       * Zeile 383). Trim ZUERST, dann length-check.
       */
      const inner = 'b'.repeat(8000)
      const padded = `   ${inner}   ` // > 8000 raw, == 8000 post-trim

      mockUpdateProjectContext.mockResolvedValueOnce({
        contextInstructions: inner,
        contextUpdatedAt: new Date(),
      })

      const response = await PATCH(
        buildPatchRequest({ context_instructions: padded }),
        buildParams(),
      )

      expect(response.status).toBe(200)
      expect(mockUpdateProjectContext).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: USER_ID,
        contextInstructions: inner,
      })
    })
  })

  // -------------------------------------------------------------------------
  // AC-6: PATCH null clears context
  // -------------------------------------------------------------------------
  describe('AC-6: PATCH null -> clear path', () => {
    it('accepts context_instructions: null and persists null', async () => {
      /**
       * AC-6: GIVEN authentifizierter Owner, Body { context_instructions: null }
       *       WHEN PATCH aufgerufen wird
       *       THEN Response ist 200; updateProjectContext wird mit
       *            contextInstructions: null aufgerufen; Response-Body
       *            enthaelt context_instructions: null.
       */
      mockUpdateProjectContext.mockResolvedValueOnce({
        contextInstructions: null,
        contextUpdatedAt: new Date(),
      })

      const response = await PATCH(
        buildPatchRequest({ context_instructions: null }),
        buildParams(),
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.context_instructions).toBeNull()

      // Helper called with literal null (not "" or undefined)
      expect(mockUpdateProjectContext).toHaveBeenCalledTimes(1)
      expect(mockUpdateProjectContext).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: USER_ID,
        contextInstructions: null,
      })
    })
  })

  // -------------------------------------------------------------------------
  // AC-7: PATCH 422 — malformed body / missing field / non-JSON
  // -------------------------------------------------------------------------
  describe('AC-7: PATCH 422 -> Invalid request body', () => {
    it('returns 422 when body is empty object {}', async () => {
      /**
       * AC-7: GIVEN Body {} (kein context_instructions Feld)
       *       WHEN PATCH aufgerufen wird
       *       THEN 422 mit { error: "Invalid request body" }; KEIN DB-Aufruf.
       */
      const response = await PATCH(buildPatchRequest({}), buildParams())

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Invalid request body' })
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })

    it('returns 422 when body has wrong field { foo: "bar" }', async () => {
      /**
       * AC-7: { foo: "bar" } enthaelt kein context_instructions -> 422.
       */
      const response = await PATCH(
        buildPatchRequest({ foo: 'bar' }),
        buildParams(),
      )

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Invalid request body' })
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })

    it('returns 422 when body is a raw JSON string (e.g. "text")', async () => {
      /**
       * AC-7: rohes JSON-string ist kein Objekt -> 422.
       */
      const response = await PATCH(buildRawPatchRequest('"text"'), buildParams())

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Invalid request body' })
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })

    it('returns 422 when body is non-JSON garbage', async () => {
      /**
       * AC-7: nicht-parseable body -> 422.
       */
      const response = await PATCH(
        buildRawPatchRequest('not json {{{'),
        buildParams(),
      )

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Invalid request body' })
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })

    it('returns 422 when context_instructions has wrong type (number)', async () => {
      /**
       * AC-7: context_instructions: 42 (Zahl) ist weder string noch null -> 422.
       */
      const response = await PATCH(
        buildPatchRequest({ context_instructions: 42 }),
        buildParams(),
      )

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Invalid request body' })
      expect(mockUpdateProjectContext).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // AC-8: PATCH 404 -> ownership mismatch
  // -------------------------------------------------------------------------
  describe('AC-8: PATCH 404 -> foreign user (no UPDATE)', () => {
    it('returns 404 when updateProjectContext returns null', async () => {
      /**
       * AC-8: GIVEN authentifizierter User, dem das Projekt nicht gehoert
       *       WHEN PATCH /api/projects/{id}/context mit gueltigem Body aufgerufen
       *       THEN Response ist 404 (gleiche Semantik wie AC-3);
       *            updateProjectContext liefert null -> Handler mappt zu 404.
       */
      mockUpdateProjectContext.mockResolvedValueOnce(null)

      const response = await PATCH(
        buildPatchRequest({ context_instructions: 'hello' }),
        buildParams(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Project not found' })

      // Helper WAS called (auth + body validation passed)
      expect(mockUpdateProjectContext).toHaveBeenCalledTimes(1)
      expect(mockUpdateProjectContext).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: USER_ID,
        contextInstructions: 'hello',
      })
    })
  })

  // -------------------------------------------------------------------------
  // AC-9: Next.js 16 params Promise convention + runtime nodejs
  // -------------------------------------------------------------------------
  describe('AC-9: Next.js 16 params Promise + runtime', () => {
    it('GET awaits params: Promise<{ id: string }> and uses the resolved id', async () => {
      /**
       * AC-9: GIVEN Next.js 16 App Router Dynamic-Segment-Konvention
       *       WHEN der Handler aufgerufen wird
       *       THEN params ist Promise<{ id: string }> und wird via await
       *            extrahiert (Pattern aus app/projects/[id]/page.tsx:14-18).
       *
       * Test: wir uebergeben eine NICHT-noch-resolvte Promise und pruefen,
       * dass der Handler dennoch den korrekten id-Wert an den Helper weitergibt.
       */
      const customId = '99999999-9999-9999-9999-999999999999'
      mockGetProjectContext.mockResolvedValueOnce({
        contextInstructions: 'x',
        contextUpdatedAt: FIXED_TIMESTAMP,
      })

      // Pass a deferred Promise<{id}> to ensure the handler awaits it
      let resolveParams: (val: { id: string }) => void
      const deferred = new Promise<{ id: string }>((res) => {
        resolveParams = res
      })
      const responsePromise = GET(new Request('http://localhost/'), {
        params: deferred,
      })

      // Resolve params after the handler has been invoked
      resolveParams!({ id: customId })

      const response = await responsePromise
      expect(response.status).toBe(200)
      expect(mockGetProjectContext).toHaveBeenCalledWith({
        projectId: customId,
        userId: USER_ID,
      })
      const body = await response.json()
      expect(body.id).toBe(customId)
    })

    it('PATCH awaits params: Promise<{ id: string }> and uses the resolved id', async () => {
      /**
       * AC-9 (PATCH variant): same Promise<{id}> convention applies.
       */
      const customId = '88888888-8888-8888-8888-888888888888'
      mockUpdateProjectContext.mockResolvedValueOnce({
        contextInstructions: 'value',
        contextUpdatedAt: FIXED_TIMESTAMP,
      })

      let resolveParams: (val: { id: string }) => void
      const deferred = new Promise<{ id: string }>((res) => {
        resolveParams = res
      })
      const responsePromise = PATCH(
        buildPatchRequest({ context_instructions: 'value' }),
        { params: deferred },
      )
      resolveParams!({ id: customId })

      const response = await responsePromise
      expect(response.status).toBe(200)
      expect(mockUpdateProjectContext).toHaveBeenCalledWith({
        projectId: customId,
        userId: USER_ID,
        contextInstructions: 'value',
      })
    })

    it('exports runtime as "nodejs" (postgres-js needs TCP, no Edge)', () => {
      /**
       * AC-9: runtime = "nodejs" MUSS explizit gesetzt sein (postgres-js
       * funktioniert nicht in Edge — siehe app/api/models/sync/route.ts:17-19).
       */
      expect(runtime).toBe('nodejs')
    })
  })
})

// ===========================================================================
// Unit tests — pure handler-level concerns (validation, mapping)
// ===========================================================================

describe('Slice 03 Unit — Handler logic invariants', () => {
  it('GET does NOT call updateProjectContext (read-only)', async () => {
    mockGetProjectContext.mockResolvedValueOnce({
      contextInstructions: 'x',
      contextUpdatedAt: FIXED_TIMESTAMP,
    })

    await GET(new Request('http://localhost/'), buildParams())

    expect(mockUpdateProjectContext).not.toHaveBeenCalled()
  })

  it('PATCH does NOT call getProjectContext (write-only path)', async () => {
    mockUpdateProjectContext.mockResolvedValueOnce({
      contextInstructions: 'x',
      contextUpdatedAt: FIXED_TIMESTAMP,
    })

    await PATCH(buildPatchRequest({ context_instructions: 'x' }), buildParams())

    expect(mockGetProjectContext).not.toHaveBeenCalled()
  })

  it('PATCH validates body BEFORE calling updateProjectContext', async () => {
    /**
     * Invariant: invalid bodies (AC-7) must short-circuit before any DB call.
     */
    await PATCH(buildPatchRequest({}), buildParams())
    await PATCH(buildPatchRequest({ foo: 'bar' }), buildParams())
    await PATCH(buildRawPatchRequest('not json'), buildParams())

    expect(mockUpdateProjectContext).not.toHaveBeenCalled()
  })

  it('PATCH validates length BEFORE calling updateProjectContext', async () => {
    /**
     * Invariant: length violation (AC-5) must short-circuit before DB call.
     */
    await PATCH(
      buildPatchRequest({ context_instructions: 'x'.repeat(8001) }),
      buildParams(),
    )

    expect(mockUpdateProjectContext).not.toHaveBeenCalled()
  })

  it('GET response Content-Type is application/json', async () => {
    mockGetProjectContext.mockResolvedValueOnce({
      contextInstructions: 'x',
      contextUpdatedAt: FIXED_TIMESTAMP,
    })

    const response = await GET(new Request('http://localhost/'), buildParams())
    const ct = response.headers.get('Content-Type') || ''
    expect(ct).toMatch(/application\/json/i)
  })

  it('PATCH response Content-Type is application/json', async () => {
    mockUpdateProjectContext.mockResolvedValueOnce({
      contextInstructions: 'x',
      contextUpdatedAt: FIXED_TIMESTAMP,
    })

    const response = await PATCH(
      buildPatchRequest({ context_instructions: 'x' }),
      buildParams(),
    )
    const ct = response.headers.get('Content-Type') || ''
    expect(ct).toMatch(/application\/json/i)
  })
})

// ===========================================================================
// Integration tests — handler + helper contract via mocked DI
// ===========================================================================

describe('Slice 03 Integration — Handler <-> Query Helpers contract', () => {
  it('GET passes the resolved {projectId, userId} pair to getProjectContext', async () => {
    mockGetProjectContext.mockResolvedValueOnce({
      contextInstructions: 'integration',
      contextUpdatedAt: FIXED_TIMESTAMP,
    })

    await GET(new Request('http://localhost/'), buildParams('aaa-bbb'))

    expect(mockGetProjectContext).toHaveBeenCalledWith({
      projectId: 'aaa-bbb',
      userId: USER_ID,
    })
  })

  it('PATCH passes the resolved {projectId, userId, contextInstructions} triple to updateProjectContext', async () => {
    mockUpdateProjectContext.mockResolvedValueOnce({
      contextInstructions: 'trimmed',
      contextUpdatedAt: FIXED_TIMESTAMP,
    })

    await PATCH(
      buildPatchRequest({ context_instructions: '   trimmed   ' }),
      buildParams('ccc-ddd'),
    )

    expect(mockUpdateProjectContext).toHaveBeenCalledWith({
      projectId: 'ccc-ddd',
      userId: USER_ID,
      contextInstructions: 'trimmed',
    })
  })

  it('handler treats helper-null as 404 for both GET and PATCH (semantic equivalence)', async () => {
    /**
     * Integration: AC-3 + AC-8 share the same 404 mapping.
     * Both helpers returning null -> identical 404 response shape.
     */
    mockGetProjectContext.mockResolvedValueOnce(null)
    mockUpdateProjectContext.mockResolvedValueOnce(null)

    const getResponse = await GET(new Request('http://localhost/'), buildParams())
    const patchResponse = await PATCH(
      buildPatchRequest({ context_instructions: 'any' }),
      buildParams(),
    )

    expect(getResponse.status).toBe(404)
    expect(patchResponse.status).toBe(404)
    expect(await getResponse.json()).toEqual({ error: 'Project not found' })
    expect(await patchResponse.json()).toEqual({ error: 'Project not found' })
  })

  it('auth failure short-circuits BOTH GET and PATCH before any helper call', async () => {
    /**
     * Integration: AC-1 invariant across both methods. requireAuth-error path
     * must never invoke a query helper (no information leak via timing/DB).
     */
    mockRequireAuth.mockResolvedValue({ error: 'Unauthorized' })

    await GET(new Request('http://localhost/'), buildParams())
    await PATCH(
      buildPatchRequest({ context_instructions: 'x' }),
      buildParams(),
    )

    expect(mockGetProjectContext).not.toHaveBeenCalled()
    expect(mockUpdateProjectContext).not.toHaveBeenCalled()
  })
})
