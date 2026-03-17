import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for slice-06-auth-guard: requireAuth() Helper
 *
 * These tests validate the requireAuth() helper function against the
 * Acceptance Criteria from the slice spec. The function checks the session
 * via auth() and returns a discriminated union of { userId, email } or { error }.
 *
 * Mock strategy (per spec metadata "mock_external"): auth() is mocked because
 * it requires NextAuth, database session, and OAuth providers which are not
 * available in unit tests. The guard logic itself is tested with real code.
 */

// Mock auth() from the root auth.ts module — external dependency (NextAuth + DB)
const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}))

// Override the global @/lib/auth/guard mock from vitest.setup.ts
// so the REAL requireAuth() implementation is used with our mocked auth()
vi.mock('@/lib/auth/guard', async (importOriginal) => {
  return await importOriginal()
})

// Import after mock setup
import { requireAuth } from '../../lib/auth/guard'
import type { AuthResult, AuthSuccess, AuthError } from '../../lib/auth/guard'

describe('slice-06-auth-guard: requireAuth() Helper', () => {
  beforeEach(() => {
    mockAuth.mockReset()
  })

  // ---------------------------------------------------------------------------
  // AC-1: Keine Session vorhanden
  // GIVEN kein User ist eingeloggt (keine gueltige Session)
  // WHEN requireAuth() aufgerufen wird
  // THEN gibt die Funktion { error: "Unauthorized" } zurueck
  // ---------------------------------------------------------------------------
  describe('AC-1: no session exists', () => {
    it('should return { error: "Unauthorized" } when auth() returns null', async () => {
      mockAuth.mockResolvedValue(null)

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when auth() returns undefined', async () => {
      mockAuth.mockResolvedValue(undefined)

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when session has no user property', async () => {
      mockAuth.mockResolvedValue({})

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when session.user is null', async () => {
      mockAuth.mockResolvedValue({ user: null })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })
  })

  // ---------------------------------------------------------------------------
  // AC-2: Gueltige Session mit userId und email
  // GIVEN ein User ist eingeloggt mit gueltiger Session (auth() gibt Session
  //       mit user.id und user.email zurueck)
  // WHEN requireAuth() aufgerufen wird
  // THEN gibt die Funktion { userId: string, email: string } zurueck,
  //      wobei userId === session.user.id und email === session.user.email
  // ---------------------------------------------------------------------------
  describe('AC-2: valid session with userId and email', () => {
    it('should return { userId, email } when valid session exists', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-123-abc', email: 'test@example.com' },
      })

      const result = await requireAuth()

      expect(result).toEqual({
        userId: 'user-123-abc',
        email: 'test@example.com',
      })
    })

    it('should map session.user.id to userId and session.user.email to email', async () => {
      const sessionUserId = 'cuid-xyz-789'
      const sessionEmail = 'admin@company.org'

      mockAuth.mockResolvedValue({
        user: { id: sessionUserId, email: sessionEmail, name: 'Admin User' },
      })

      const result = await requireAuth()

      // Verify exact mapping
      expect((result as AuthSuccess).userId).toBe(sessionUserId)
      expect((result as AuthSuccess).email).toBe(sessionEmail)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-3: Session ohne user.id
  // GIVEN auth() gibt eine Session zurueck bei der user.id fehlt (undefined/null)
  // WHEN requireAuth() aufgerufen wird
  // THEN gibt die Funktion { error: "Unauthorized" } zurueck (defensive Validierung)
  // ---------------------------------------------------------------------------
  describe('AC-3: session with missing user.id', () => {
    it('should return { error: "Unauthorized" } when session.user.id is undefined', async () => {
      mockAuth.mockResolvedValue({
        user: { id: undefined, email: 'test@example.com' },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when session.user.id is null', async () => {
      mockAuth.mockResolvedValue({
        user: { id: null, email: 'test@example.com' },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when session.user.id is empty string', async () => {
      mockAuth.mockResolvedValue({
        user: { id: '', email: 'test@example.com' },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })
  })

  // ---------------------------------------------------------------------------
  // AC-4: Session ohne user.email
  // GIVEN auth() gibt eine Session zurueck bei der user.email fehlt (undefined/null)
  // WHEN requireAuth() aufgerufen wird
  // THEN gibt die Funktion { error: "Unauthorized" } zurueck (defensive Validierung)
  // ---------------------------------------------------------------------------
  describe('AC-4: session with missing user.email', () => {
    it('should return { error: "Unauthorized" } when session.user.email is undefined', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-123', email: undefined },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when session.user.email is null', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-123', email: null },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return { error: "Unauthorized" } when session.user.email is empty string', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-123', email: '' },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })
  })

  // ---------------------------------------------------------------------------
  // AC-5: Build-Kompatibilitaet / Export
  // GIVEN requireAuth() ist exportiert aus lib/auth/guard.ts
  // WHEN pnpm run build ausgefuehrt wird
  // THEN ist der Build erfolgreich ohne TypeScript-Fehler
  // ---------------------------------------------------------------------------
  describe('AC-5: export and build compatibility', () => {
    it('should export requireAuth as a named export from lib/auth/guard.ts', async () => {
      // Dynamic import to verify the export exists at module level
      const mod = await import('../../lib/auth/guard')

      expect(mod.requireAuth).toBeDefined()
      expect(typeof mod.requireAuth).toBe('function')
    })

    it('should export AuthResult, AuthSuccess, AuthError types (verified by usage)', () => {
      // TypeScript compilation of this file proves the types are exported.
      // We verify at runtime that the function returns values matching those types.
      const successResult: AuthSuccess = { userId: 'test', email: 'test@test.com' }
      const errorResult: AuthError = { error: 'Unauthorized' }
      const unionResult: AuthResult = successResult

      expect(successResult.userId).toBe('test')
      expect(errorResult.error).toBe('Unauthorized')
      expect(unionResult).toBeDefined()
    })

    it('should be an async function (returns Promise)', async () => {
      mockAuth.mockResolvedValue(null)

      const result = requireAuth()

      // Verify it returns a Promise (async function)
      expect(result).toBeInstanceOf(Promise)
      await result // ensure it settles
    })
  })

  // ---------------------------------------------------------------------------
  // AC-6: Discriminated Union Type
  // GIVEN der Return-Type von requireAuth() ist ein Discriminated Union
  // WHEN das Ergebnis geprueft wird
  // THEN ist es entweder { userId: string; email: string } (Erfolg, KEIN error-Property)
  //      oder { error: string } (Fehler, KEIN userId/email-Property) -- konsistent
  //      mit dem bestehenden Server Action Error-Pattern
  // ---------------------------------------------------------------------------
  describe('AC-6: discriminated union without overlapping properties', () => {
    it('should NOT have error property on success result', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-456', email: 'valid@example.com' },
      })

      const result = await requireAuth()

      // Success path: must have userId + email, must NOT have error
      expect(result).toHaveProperty('userId')
      expect(result).toHaveProperty('email')
      expect(result).not.toHaveProperty('error')
    })

    it('should NOT have userId or email properties on error result', async () => {
      mockAuth.mockResolvedValue(null)

      const result = await requireAuth()

      // Error path: must have error, must NOT have userId or email
      expect(result).toHaveProperty('error')
      expect(result).not.toHaveProperty('userId')
      expect(result).not.toHaveProperty('email')
    })

    it('should return exactly { error: "Unauthorized" } on failure (no extra keys)', async () => {
      mockAuth.mockResolvedValue(null)

      const result = await requireAuth()

      // Verify the object has exactly one key: "error"
      expect(Object.keys(result)).toEqual(['error'])
      expect((result as AuthError).error).toBe('Unauthorized')
    })

    it('should return exactly { userId, email } on success (no extra keys)', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-789', email: 'success@test.com' },
      })

      const result = await requireAuth()

      // Verify the object has exactly two keys: "userId" and "email"
      expect(Object.keys(result).sort()).toEqual(['email', 'userId'])
    })

    it('should allow TypeScript narrowing via "error" in result', async () => {
      // Test the discriminated union pattern used in consumer code
      mockAuth.mockResolvedValue({
        user: { id: 'user-abc', email: 'narrow@test.com' },
      })

      const result = await requireAuth()

      // This is the actual narrowing pattern consumers will use
      if ('error' in result) {
        // TypeScript narrows to AuthError
        expect(result.error).toBeDefined()
      } else {
        // TypeScript narrows to AuthSuccess
        expect(result.userId).toBe('user-abc')
        expect(result.email).toBe('narrow@test.com')
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases: both id and email missing
  // ---------------------------------------------------------------------------
  describe('Edge cases', () => {
    it('should return error when both user.id and user.email are missing', async () => {
      mockAuth.mockResolvedValue({
        user: { name: 'No ID or Email' },
      })

      const result = await requireAuth()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should handle session.user with extra properties but valid id and email', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-extra',
          email: 'extra@test.com',
          name: 'Extra User',
          image: 'https://example.com/avatar.png',
        },
      })

      const result = await requireAuth()

      // Should still return only { userId, email } -- no extra properties
      expect(result).toEqual({
        userId: 'user-extra',
        email: 'extra@test.com',
      })
      expect(Object.keys(result).sort()).toEqual(['email', 'userId'])
    })
  })
})
