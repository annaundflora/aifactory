/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * Tests for slice-01-auth-setup: SessionProvider in Layout
 *
 * AC-8: SessionProvider wraps children in RootLayout
 *
 * We test the AuthSessionProvider wrapper component directly, since
 * RootLayout uses Next.js-specific features (html/body tags, fonts) that
 * cannot be rendered in jsdom. The key requirement is that SessionProvider
 * from next-auth/react wraps children so useSession() is available.
 *
 * Mock strategy: next-auth/react SessionProvider is mocked because it
 * requires a running Auth.js backend. We verify the wrapping structure.
 */

// Track whether SessionProvider was rendered with children
let sessionProviderRendered = false
let sessionProviderChildren: React.ReactNode = null

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => {
    sessionProviderRendered = true
    sessionProviderChildren = children
    return React.createElement('div', { 'data-testid': 'session-provider' }, children)
  },
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
}))

describe('slice-01-auth-setup: Layout SessionProvider', () => {
  // ---------------------------------------------------------------------------
  // AC-8: SessionProvider in Layout
  // GIVEN app/layout.tsx wurde mit SessionProvider gewrappt
  // WHEN die App gerendert wird
  // THEN ist useSession() in Client Components verfuegbar ohne Fehler
  // ---------------------------------------------------------------------------
  it('AC-8: should wrap children with SessionProvider in AuthSessionProvider', async () => {
    // Import the actual AuthSessionProvider component
    const { default: AuthSessionProvider } = await import(
      '../../components/shared/session-provider'
    )

    // Reset tracking
    sessionProviderRendered = false

    const testContent = 'Test Child Content'

    render(
      React.createElement(
        AuthSessionProvider,
        null,
        React.createElement('div', null, testContent)
      )
    )

    // Verify SessionProvider was rendered (it wraps children)
    expect(sessionProviderRendered).toBe(true)

    // Verify the children are rendered inside SessionProvider
    const provider = screen.getByTestId('session-provider')
    expect(provider).toBeDefined()
    expect(provider.textContent).toContain(testContent)
  })

  it('AC-8: AuthSessionProvider should be a client component ("use client" directive)', async () => {
    // Read the source file to verify "use client" directive
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      __dirname,
      '../../components/shared/session-provider.tsx'
    )
    const source = fs.readFileSync(filePath, 'utf-8')

    // The file must start with "use client" directive
    const firstLine = source.trim().split('\n')[0].trim()
    expect(firstLine).toMatch(/^["']use client["'];?$/)
  })

  it('AC-8: layout.tsx should import and use AuthSessionProvider', async () => {
    // Verify that the layout.tsx file imports AuthSessionProvider
    const fs = await import('fs')
    const path = await import('path')
    const layoutPath = path.resolve(__dirname, '../../app/layout.tsx')
    const layoutSource = fs.readFileSync(layoutPath, 'utf-8')

    // Must import the session provider
    expect(layoutSource).toContain('session-provider')

    // Must use AuthSessionProvider in the JSX
    expect(layoutSource).toContain('AuthSessionProvider')

    // Verify it wraps children (AuthSessionProvider should appear before {children})
    const providerOpen = layoutSource.indexOf('<AuthSessionProvider>')
    const providerClose = layoutSource.indexOf('</AuthSessionProvider>')
    const childrenPos = layoutSource.indexOf('{children}')

    expect(providerOpen).toBeGreaterThan(-1)
    expect(providerClose).toBeGreaterThan(-1)
    expect(childrenPos).toBeGreaterThan(providerOpen)
    expect(childrenPos).toBeLessThan(providerClose)
  })
})
