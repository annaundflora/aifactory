import { describe, it, expect, vi } from 'vitest'

/**
 * Tests for slice-01-auth-setup: Auth Route Handler
 *
 * AC-7: Route Handler at app/api/auth/[...nextauth]/route.ts
 *
 * This test verifies that the route handler module correctly re-exports
 * GET and POST from the auth.ts handlers. Since we cannot spin up a real
 * Next.js server in unit tests, we verify the module structure and exports.
 *
 * Mock strategy: @/auth is mocked to avoid DB/env side effects.
 * The route handler simply re-exports, so we verify the wiring.
 */

// Mock the auth module to avoid DB and env var side effects
vi.mock('@/auth', () => ({
  handlers: {
    GET: async function GET() {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
    POST: async function POST() {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  },
}))

describe('slice-01-auth-setup: Auth Route Handler', () => {
  // ---------------------------------------------------------------------------
  // AC-7: Session Endpoint
  // GIVEN der Route Handler existiert unter app/api/auth/[...nextauth]/route.ts
  // WHEN ein GET Request an /api/auth/session gesendet wird
  // THEN antwortet der Endpoint mit HTTP 200 und einem JSON-Body
  //      (leeres Objekt {} wenn nicht eingeloggt)
  // ---------------------------------------------------------------------------
  it('AC-7: should export GET and POST handlers from route.ts', async () => {
    const routeModule = await import('../../app/api/auth/[...nextauth]/route')

    // The route module must export GET and POST (re-exported from auth handlers)
    expect(routeModule.GET).toBeDefined()
    expect(typeof routeModule.GET).toBe('function')
    expect(routeModule.POST).toBeDefined()
    expect(typeof routeModule.POST).toBe('function')
  })

  it('AC-7: GET handler should respond with 200 and JSON body', async () => {
    const routeModule = await import('../../app/api/auth/[...nextauth]/route')

    // Call the GET handler (mocked to return empty session JSON)
    const response = await routeModule.GET()

    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)

    const body = await response.json()
    // When not logged in, Auth.js returns an empty object {}
    expect(body).toBeDefined()
    expect(typeof body).toBe('object')
  })
})
