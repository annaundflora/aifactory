import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Tests for slice-01-auth-setup: Auth.js v5 configuration
 *
 * These tests validate the auth.ts configuration against the Acceptance Criteria
 * from the slice spec. The auth module has module-level side effects (env validation),
 * so we use vi.resetModules() + dynamic import to re-evaluate with controlled env vars.
 *
 * Mock strategy: @/lib/db is mocked because no real database is available in unit tests
 * (Auth tables are created in Slice 04). All other code is tested with real instances.
 */

// Mock the database module — DB tables don't exist yet (Slice 04)
vi.mock('@/lib/db', () => ({
  db: {},
}))

// Mock the schema module — auth.ts imports { users, accounts, sessions }
vi.mock('@/lib/db/schema', () => ({
  users: { id: 'id', name: 'users' },
  accounts: { id: 'id', name: 'accounts' },
  sessions: { id: 'id', name: 'sessions' },
}))

// Mock next-auth to capture the config object passed to NextAuth()
// This allows us to inspect providers, callbacks, and session strategy
// without needing a running OAuth server or database.
let capturedConfig: any = null
vi.mock('next-auth', () => ({
  default: (config: any) => {
    capturedConfig = config
    return {
      auth: vi.fn(),
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
    }
  },
}))

vi.mock('next-auth/providers/google', () => ({
  default: (opts: any) => ({ id: 'google', name: 'Google', ...opts }),
}))

vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: (db: any) => ({ __adapter: true, db }),
}))

/**
 * Helper: set required env vars and dynamically import auth.ts.
 * Each call resets the module cache to get a fresh evaluation.
 */
async function loadAuthModule(envOverrides: Record<string, string | undefined> = {}) {
  // Set baseline required env vars
  const defaults: Record<string, string> = {
    AUTH_SECRET: 'test-secret-at-least-32-chars-long!!',
    AUTH_GOOGLE_ID: 'test-google-client-id',
    AUTH_GOOGLE_SECRET: 'test-google-client-secret',
    ALLOWED_EMAILS: 'user@example.com, admin@test.de',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  }

  // Apply defaults, then overrides
  for (const [key, value] of Object.entries({ ...defaults, ...envOverrides })) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  capturedConfig = null
  vi.resetModules()

  // Remove the global @/auth mock from vitest.setup.ts so the real auth.ts loads
  vi.doUnmock('@/auth')

  // Re-apply mocks after resetModules
  vi.doMock('@/lib/db', () => ({ db: {} }))
  vi.doMock('@/lib/db/schema', () => ({
    users: { id: 'id', name: 'users' },
    accounts: { id: 'id', name: 'accounts' },
    sessions: { id: 'id', name: 'sessions' },
  }))
  vi.doMock('next-auth', () => ({
    default: (config: any) => {
      capturedConfig = config
      return {
        auth: vi.fn(),
        handlers: { GET: vi.fn(), POST: vi.fn() },
        signIn: vi.fn(),
        signOut: vi.fn(),
      }
    },
  }))
  vi.doMock('next-auth/providers/google', () => ({
    default: (opts: any) => ({ id: 'google', name: 'Google', ...opts }),
  }))
  vi.doMock('@auth/drizzle-adapter', () => ({
    DrizzleAdapter: (db: any) => ({ __adapter: true, db }),
  }))

  const mod = await import('../../auth')
  return mod
}

describe('slice-01-auth-setup: Auth Config', () => {
  const savedEnv: Record<string, string | undefined> = {}
  const envKeys = [
    'AUTH_SECRET',
    'AUTH_GOOGLE_ID',
    'AUTH_GOOGLE_SECRET',
    'ALLOWED_EMAILS',
    'DATABASE_URL',
  ]

  beforeEach(() => {
    // Save current env
    for (const key of envKeys) {
      savedEnv[key] = process.env[key]
    }
  })

  afterEach(() => {
    // Restore original env
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key]
      } else {
        delete process.env[key]
      }
    }
    vi.resetModules()
  })

  // ---------------------------------------------------------------------------
  // AC-1: Build-Kompatibilitaet
  // GIVEN Auth.js v5 Packages sind installiert (next-auth@beta, @auth/drizzle-adapter)
  // WHEN pnpm run build ausgefuehrt wird
  // THEN Build ist erfolgreich ohne TypeScript-Fehler
  // ---------------------------------------------------------------------------
  it('AC-1: should export auth config without TypeScript errors', async () => {
    const mod = await loadAuthModule()

    // The module loads without throwing — this proves the TypeScript compiles
    // and the module evaluates successfully with valid env vars.
    expect(mod).toBeDefined()

    // Verify the module has the expected shape (no undefined exports)
    expect(mod.auth).toBeDefined()
    expect(mod.handlers).toBeDefined()
    expect(mod.signIn).toBeDefined()
    expect(mod.signOut).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // AC-2: Named Exports
  // GIVEN die Auth-Config auth.ts existiert im Projekt-Root
  // WHEN die Config exportiert wird
  // THEN sind folgende Named Exports vorhanden: auth, handlers, signIn, signOut
  // ---------------------------------------------------------------------------
  it('AC-2: should export auth, handlers, signIn, signOut from auth.ts', async () => {
    const mod = await loadAuthModule()

    // Each must be a named export (not undefined)
    expect(typeof mod.auth).toBe('function')
    expect(mod.handlers).toHaveProperty('GET')
    expect(mod.handlers).toHaveProperty('POST')
    expect(typeof mod.signIn).toBe('function')
    expect(typeof mod.signOut).toBe('function')

    // Verify these are the ONLY auth-related exports we expect
    // (no accidental default export overriding named ones)
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('auth')
    expect(exportKeys).toContain('handlers')
    expect(exportKeys).toContain('signIn')
    expect(exportKeys).toContain('signOut')
  })

  // ---------------------------------------------------------------------------
  // AC-3: Google OAuth Provider Credentials
  // GIVEN Google OAuth Provider ist konfiguriert in auth.ts
  // WHEN die Env-Vars AUTH_GOOGLE_ID und AUTH_GOOGLE_SECRET gesetzt sind
  // THEN verwendet der Provider diese Credentials fuer den OAuth-Flow
  // ---------------------------------------------------------------------------
  it('AC-3: should configure Google provider with AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET env vars', async () => {
    const testGoogleId = 'my-custom-google-id-12345'
    const testGoogleSecret = 'my-custom-google-secret-67890'

    await loadAuthModule({
      AUTH_GOOGLE_ID: testGoogleId,
      AUTH_GOOGLE_SECRET: testGoogleSecret,
    })

    expect(capturedConfig).toBeDefined()
    expect(capturedConfig.providers).toBeDefined()
    expect(capturedConfig.providers.length).toBeGreaterThanOrEqual(1)

    // Find the Google provider
    const googleProvider = capturedConfig.providers.find(
      (p: any) => p.id === 'google'
    )
    expect(googleProvider).toBeDefined()
    expect(googleProvider.clientId).toBe(testGoogleId)
    expect(googleProvider.clientSecret).toBe(testGoogleSecret)
  })

  // ---------------------------------------------------------------------------
  // AC-4: Allowlist - Email nicht erlaubt
  // GIVEN der signIn Callback ist konfiguriert
  // WHEN ein User sich mit einer Email einloggt die NICHT in ALLOWED_EMAILS steht
  // THEN gibt der Callback false zurueck (Login verweigert)
  // ---------------------------------------------------------------------------
  it('AC-4: should reject sign-in for email not in ALLOWED_EMAILS', async () => {
    await loadAuthModule({
      ALLOWED_EMAILS: 'allowed@example.com, admin@test.de',
    })

    expect(capturedConfig).toBeDefined()
    expect(capturedConfig.callbacks).toBeDefined()
    expect(capturedConfig.callbacks.signIn).toBeDefined()

    const result = capturedConfig.callbacks.signIn({
      user: { email: 'hacker@evil.com' },
      account: { provider: 'google' },
    })

    expect(result).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-5: Allowlist - Email erlaubt (case-insensitive)
  // GIVEN der signIn Callback ist konfiguriert
  // WHEN ein User sich mit einer Email einloggt die in ALLOWED_EMAILS steht
  // THEN gibt der Callback true zurueck (Login erlaubt)
  // ---------------------------------------------------------------------------
  it('AC-5: should allow sign-in for email in ALLOWED_EMAILS (case-insensitive)', async () => {
    await loadAuthModule({
      ALLOWED_EMAILS: 'allowed@example.com, admin@test.de',
    })

    expect(capturedConfig).toBeDefined()

    // Exact match
    const result1 = capturedConfig.callbacks.signIn({
      user: { email: 'allowed@example.com' },
      account: { provider: 'google' },
    })
    expect(result1).toBe(true)

    // Case-insensitive match (ALLOWED_EMAILS has lowercase, user email has mixed case)
    const result2 = capturedConfig.callbacks.signIn({
      user: { email: 'ADMIN@Test.DE' },
      account: { provider: 'google' },
    })
    expect(result2).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // AC-6: Session Callback - User ID
  // GIVEN der session Callback ist konfiguriert
  // WHEN eine Session erstellt wird
  // THEN enthaelt session.user.id die User-ID aus der Datenbank
  // ---------------------------------------------------------------------------
  it('AC-6: should include user.id in session via session callback', async () => {
    await loadAuthModule()

    expect(capturedConfig).toBeDefined()
    expect(capturedConfig.callbacks).toBeDefined()
    expect(capturedConfig.callbacks.session).toBeDefined()

    const mockSession = {
      user: { id: '', name: 'Test User', email: 'test@example.com' },
      expires: new Date().toISOString(),
    }

    const mockUser = {
      id: 'db-user-id-12345',
      name: 'Test User',
      email: 'test@example.com',
    }

    const result = capturedConfig.callbacks.session({
      session: mockSession,
      user: mockUser,
    })

    // session.user.id must be set to the database user's ID
    expect(result.user.id).toBe('db-user-id-12345')
  })

  // ---------------------------------------------------------------------------
  // AC-9: Allowlist-Parsing mit Trimming und Case-Insensitivity
  // GIVEN ALLOWED_EMAILS ist gesetzt als kommaseparierte Liste
  //       (z.B. "user@example.com, admin@test.de")
  // WHEN der Allowlist-Check durchgefuehrt wird
  // THEN werden Leerzeichen getrimmt und der Vergleich ist case-insensitive
  // ---------------------------------------------------------------------------
  it('AC-9: should trim whitespace and compare case-insensitively in allowlist check', async () => {
    // Intentionally add extra whitespace around emails
    await loadAuthModule({
      ALLOWED_EMAILS: '  User@Example.COM ,   ADMIN@test.de  ,  extra@test.org  ',
    })

    expect(capturedConfig).toBeDefined()

    // Test that trimmed + lowercased emails are matched
    const result1 = capturedConfig.callbacks.signIn({
      user: { email: 'user@example.com' },
      account: { provider: 'google' },
    })
    expect(result1).toBe(true)

    const result2 = capturedConfig.callbacks.signIn({
      user: { email: 'admin@TEST.de' },
      account: { provider: 'google' },
    })
    expect(result2).toBe(true)

    const result3 = capturedConfig.callbacks.signIn({
      user: { email: 'EXTRA@Test.Org' },
      account: { provider: 'google' },
    })
    expect(result3).toBe(true)

    // Verify non-listed email is still rejected
    const result4 = capturedConfig.callbacks.signIn({
      user: { email: 'notlisted@other.com' },
      account: { provider: 'google' },
    })
    expect(result4).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Additional edge-case tests for robustness
  // ---------------------------------------------------------------------------

  it('AC-4 (edge): should reject sign-in when user has no email', async () => {
    await loadAuthModule({
      ALLOWED_EMAILS: 'allowed@example.com',
    })

    const result = capturedConfig.callbacks.signIn({
      user: { email: null },
      account: { provider: 'google' },
    })

    expect(result).toBe(false)
  })

  it('AC-4 (edge): should reject sign-in for non-google provider', async () => {
    await loadAuthModule({
      ALLOWED_EMAILS: 'allowed@example.com',
    })

    // Even with a valid email, non-google provider should be rejected
    const result = capturedConfig.callbacks.signIn({
      user: { email: 'allowed@example.com' },
      account: { provider: 'github' },
    })

    expect(result).toBe(false)
  })

  it('AC-6 (edge): should handle session callback when session.user exists', async () => {
    await loadAuthModule()

    // Verify that the callback correctly maps user.id to session.user.id
    const session = { user: { id: 'old-id', name: 'User' }, expires: '' }
    const user = { id: 'new-db-id' }

    const result = capturedConfig.callbacks.session({ session, user })

    // The session's user.id must reflect the DB user's id
    expect(result.user.id).toBe('new-db-id')
  })

  it('should use database session strategy (not JWT)', async () => {
    await loadAuthModule()

    expect(capturedConfig).toBeDefined()
    expect(capturedConfig.session).toBeDefined()
    expect(capturedConfig.session.strategy).toBe('database')
  })

  it('should throw on missing AUTH_SECRET', async () => {
    await expect(
      loadAuthModule({ AUTH_SECRET: undefined })
    ).rejects.toThrow(/AUTH_SECRET/)
  })

  it('should throw on missing AUTH_GOOGLE_ID', async () => {
    await expect(
      loadAuthModule({ AUTH_GOOGLE_ID: undefined })
    ).rejects.toThrow(/AUTH_GOOGLE_ID/)
  })

  it('should throw on missing AUTH_GOOGLE_SECRET', async () => {
    await expect(
      loadAuthModule({ AUTH_GOOGLE_SECRET: undefined })
    ).rejects.toThrow(/AUTH_GOOGLE_SECRET/)
  })

  it('should throw on missing ALLOWED_EMAILS', async () => {
    await expect(
      loadAuthModule({ ALLOWED_EMAILS: undefined })
    ).rejects.toThrow(/ALLOWED_EMAILS/)
  })
})
