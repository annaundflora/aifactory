/**
 * Tests for POST /api/models/sync — Streaming Sync Route Handler
 * Slice: slice-05-sync-route
 *
 * Mocking Strategy: mock_external (from Slice Spec)
 *   - auth (@/auth): globally mocked in vitest.setup.ts, overridden per-test
 *   - ModelSyncService (@/lib/services/model-sync-service): mocked via vi.mock
 *   - DB module (@/lib/db): globally mocked in vitest.setup.ts
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

const mockSyncAll = vi.fn()

vi.mock('@/lib/services/model-sync-service', () => ({
  ModelSyncService: {
    syncAll: (...args: unknown[]) => mockSyncAll(...args),
  },
}))

// Import auth mock to override per-test
import { auth } from '@/auth'
const mockAuth = vi.mocked(auth)

// Import AFTER mocks are set up
import { POST, runtime } from '../route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads all newline-delimited JSON events from a ReadableStream response body.
 * Returns an array of parsed event objects.
 */
async function readStreamEvents(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text()
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default: authenticated session
  mockAuth.mockResolvedValue({
    user: { id: 'mock-user-id', email: 'test@example.com' },
  } as Awaited<ReturnType<typeof auth>>)
  // Default: syncAll resolves immediately with empty result
  mockSyncAll.mockResolvedValue({ synced: 0, failed: 0, new: 0, updated: 0 })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/models/sync', () => {
  // AC-1: Unauthentifizierter Request -> 401
  it('should return 401 when auth() returns null', async () => {
    /**
     * AC-1: GIVEN ein unauthentifizierter Request (kein Session-Cookie / auth() gibt null zurueck)
     *       WHEN POST /api/models/sync aufgerufen wird
     *       THEN antwortet die Route mit HTTP 401 und Body { error: "Unauthorized" }
     */
    mockAuth.mockResolvedValueOnce(null)

    const response = await POST()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  // AC-2: Authentifizierter Request -> 200 mit ReadableStream
  it('should return 200 with streaming response when authenticated', async () => {
    /**
     * AC-2: GIVEN ein authentifizierter Request und KEIN laufender Sync
     *       WHEN POST /api/models/sync aufgerufen wird
     *       THEN antwortet die Route mit HTTP 200 und Content-Type: text/event-stream
     *            (oder application/x-ndjson) und der Body ist ein ReadableStream
     */
    mockSyncAll.mockResolvedValueOnce({ synced: 1, failed: 0, new: 1, updated: 0 })

    const response = await POST()

    expect(response.status).toBe(200)
    const contentType = response.headers.get('Content-Type')
    expect(
      contentType === 'text/event-stream' || contentType === 'application/x-ndjson'
    ).toBe(true)
    expect(response.body).toBeInstanceOf(ReadableStream)
  })

  // AC-3: Doppelter Sync -> Error-Event "Sync bereits aktiv"
  it('should stream error event when sync is already in progress', async () => {
    /**
     * AC-3: GIVEN ein authentifizierter Request und ein Sync ist BEREITS aktiv
     *            (module-scoped Lock ist gesetzt)
     *       WHEN POST /api/models/sync aufgerufen wird
     *       THEN streamt die Route ein einzelnes Error-Event
     *            { type: "error", message: "Sync bereits aktiv" } gefolgt von Stream-Close
     */

    // Make syncAll hang so the lock stays active
    let resolveSyncAll: (value: unknown) => void
    mockSyncAll.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolveSyncAll = resolve
      })
    })

    // Start first sync (will hold the lock)
    const firstResponsePromise = POST()

    // The first POST returns immediately (with the streaming response),
    // but the stream's start() is still running (syncAll hasn't resolved).
    const firstResponse = await firstResponsePromise

    // Now start second sync while first is still running
    const secondResponse = await POST()
    const events = await readStreamEvents(secondResponse)

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'error', message: 'Sync bereits aktiv' })

    // Clean up: resolve the first sync to release the lock
    resolveSyncAll!({ synced: 0, failed: 0, new: 0, updated: 0 })
    // Consume first response to ensure stream completes
    await firstResponse.text()
  })

  // AC-4: Progress-Events mit completed und total
  it('should stream progress events from onProgress callback', async () => {
    /**
     * AC-4: GIVEN ein laufender Sync mit 6 Models
     *       WHEN ModelSyncService.syncAll(onProgress) den Progress-Callback
     *            mit (3, 6) aufruft
     *       THEN wird ein Event { type: "progress", completed: 3, total: 6 }\n
     *            in den Stream geschrieben
     */
    mockSyncAll.mockImplementationOnce(async (onProgress: (completed: number, total: number) => void) => {
      onProgress(3, 6)
      return { synced: 6, failed: 0, new: 3, updated: 3 }
    })

    const response = await POST()
    const events = await readStreamEvents(response)

    const progressEvent = events.find((e) => e.type === 'progress')
    expect(progressEvent).toBeDefined()
    expect(progressEvent).toEqual({ type: 'progress', completed: 3, total: 6 })
  })

  // AC-5: Complete-Event mit synced, failed, new, updated
  it('should stream complete event with SyncResult fields and close stream', async () => {
    /**
     * AC-5: GIVEN ein Sync der erfolgreich abschliesst mit
     *            SyncResult { synced: 5, failed: 1, new: 2, updated: 3 }
     *       WHEN ModelSyncService.syncAll() resolved
     *       THEN wird ein Complete-Event
     *            { type: "complete", synced: 5, failed: 1, new: 2, updated: 3 }\n
     *            in den Stream geschrieben, danach wird der Stream geschlossen
     *            und das module-scoped Lock freigegeben
     */
    mockSyncAll.mockResolvedValueOnce({ synced: 5, failed: 1, new: 2, updated: 3 })

    const response = await POST()
    const events = await readStreamEvents(response)

    const completeEvent = events.find((e) => e.type === 'complete')
    expect(completeEvent).toBeDefined()
    expect(completeEvent).toEqual({
      type: 'complete',
      synced: 5,
      failed: 1,
      new: 2,
      updated: 3,
    })

    // Stream should be closed (text() consumed it fully above)
    // Lock should be released — verify by starting another sync successfully
    mockSyncAll.mockResolvedValueOnce({ synced: 1, failed: 0, new: 0, updated: 1 })
    const secondResponse = await POST()
    expect(secondResponse.status).toBe(200)
    const secondEvents = await readStreamEvents(secondResponse)
    // Should NOT get "Sync bereits aktiv" error — lock was released
    const errorEvent = secondEvents.find(
      (e) => e.type === 'error' && e.message === 'Sync bereits aktiv'
    )
    expect(errorEvent).toBeUndefined()
  })

  // AC-6: Exception -> Error-Event + Stream-Close + Lock-Release
  it('should stream error event and release lock when syncAll throws', async () => {
    /**
     * AC-6: GIVEN ein Sync bei dem ModelSyncService.syncAll() eine unbehandelte
     *            Exception wirft
     *       WHEN die Exception gefangen wird
     *       THEN wird ein Error-Event { type: "error", message: <error.message> }\n
     *            in den Stream geschrieben, danach wird der Stream geschlossen
     *            und das module-scoped Lock freigegeben
     */
    mockSyncAll.mockRejectedValueOnce(new Error('Replicate API timeout'))

    const response = await POST()
    const events = await readStreamEvents(response)

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent).toEqual({ type: 'error', message: 'Replicate API timeout' })

    // Lock should be released — verify by starting another sync successfully
    mockSyncAll.mockResolvedValueOnce({ synced: 1, failed: 0, new: 0, updated: 1 })
    const secondResponse = await POST()
    expect(secondResponse.status).toBe(200)
    const secondEvents = await readStreamEvents(secondResponse)
    const lockError = secondEvents.find(
      (e) => e.type === 'error' && e.message === 'Sync bereits aktiv'
    )
    expect(lockError).toBeUndefined()
  })

  // AC-7: Runtime = nodejs
  it('should export runtime as nodejs', () => {
    /**
     * AC-7: GIVEN der Route Handler
     *       WHEN die Response erstellt wird
     *       THEN enthaelt die Response export const runtime = "nodejs"
     *            (kein Edge Runtime, da DB-Zugriff ueber postgres-js TCP)
     */
    expect(runtime).toBe('nodejs')
  })

  // AC-8: GET Request -> 405 Method Not Allowed
  it('should return 405 for GET requests (only POST is exported)', async () => {
    /**
     * AC-8: GIVEN ein GET-Request an /api/models/sync
     *       WHEN der Request verarbeitet wird
     *       THEN antwortet die Route mit HTTP 405 (nur POST ist exportiert)
     *
     * In Next.js App Router, only exported HTTP method handlers are routed.
     * Since the route module only exports POST (no GET export), Next.js
     * automatically returns 405 for GET requests. We verify this by checking
     * that the module has no GET export.
     */
    // Dynamic import to inspect all exports
    const routeModule = await import('../route')
    expect(routeModule).not.toHaveProperty('GET')
    expect(routeModule).toHaveProperty('POST')
    expect(typeof routeModule.POST).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Additional Integration-style Tests (stream format validation)
// ---------------------------------------------------------------------------

describe('POST /api/models/sync — Stream format', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'mock-user-id', email: 'test@example.com' },
    } as Awaited<ReturnType<typeof auth>>)
  })

  it('should emit events as newline-delimited JSON', async () => {
    /**
     * Integration: verify that each event is separated by a newline character
     * and is valid JSON when parsed line by line.
     */
    mockSyncAll.mockImplementationOnce(async (onProgress: (c: number, t: number) => void) => {
      onProgress(1, 3)
      onProgress(2, 3)
      onProgress(3, 3)
      return { synced: 3, failed: 0, new: 1, updated: 2 }
    })

    const response = await POST()
    const rawText = await response.text()

    // Each line should be valid JSON
    const lines = rawText.split('\n').filter((l) => l.trim().length > 0)
    expect(lines.length).toBe(4) // 3 progress + 1 complete

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('should set Cache-Control: no-cache and Connection: keep-alive headers', async () => {
    /**
     * Integration: verify streaming-related response headers are set correctly.
     */
    mockSyncAll.mockResolvedValueOnce({ synced: 0, failed: 0, new: 0, updated: 0 })

    const response = await POST()

    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Connection')).toBe('keep-alive')

    // Consume stream to clean up
    await response.text()
  })

  it('should emit multiple progress events in correct order', async () => {
    /**
     * Integration: verify progress events arrive in the order the callback was called.
     */
    mockSyncAll.mockImplementationOnce(async (onProgress: (c: number, t: number) => void) => {
      onProgress(1, 4)
      onProgress(2, 4)
      onProgress(3, 4)
      onProgress(4, 4)
      return { synced: 4, failed: 0, new: 2, updated: 2 }
    })

    const response = await POST()
    const events = await readStreamEvents(response)

    // First 4 should be progress events in order
    const progressEvents = events.filter((e) => e.type === 'progress')
    expect(progressEvents).toHaveLength(4)
    expect(progressEvents[0]).toEqual({ type: 'progress', completed: 1, total: 4 })
    expect(progressEvents[1]).toEqual({ type: 'progress', completed: 2, total: 4 })
    expect(progressEvents[2]).toEqual({ type: 'progress', completed: 3, total: 4 })
    expect(progressEvents[3]).toEqual({ type: 'progress', completed: 4, total: 4 })

    // Last event should be complete
    const lastEvent = events[events.length - 1]
    expect(lastEvent).toEqual({
      type: 'complete',
      synced: 4,
      failed: 0,
      new: 2,
      updated: 2,
    })
  })

  it('should handle non-Error exceptions gracefully', async () => {
    /**
     * Edge case: syncAll throws a non-Error value (e.g., a string).
     * The handler should still produce an error event with a fallback message.
     */
    mockSyncAll.mockRejectedValueOnce('string-error-thrown')

    const response = await POST()
    const events = await readStreamEvents(response)

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent!.type).toBe('error')
    expect(errorEvent!.message).toBe('Unknown sync error')
  })
})
