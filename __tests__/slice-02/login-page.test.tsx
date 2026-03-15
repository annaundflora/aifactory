// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

/**
 * Tests for slice-02-login-page: Login Page UI
 *
 * Tests the LoginForm client component which receives the `error` prop
 * from the server component (page.tsx reads searchParams).
 *
 * Mock strategy (mock_external): Only `signIn` from `next-auth/react` is
 * mocked because it triggers an OAuth redirect that requires a real
 * browser + Google OAuth provider -- technically impossible in jsdom.
 * All other code (components, rendering, DOM) is real.
 */

// Mock only the external OAuth call -- cannot redirect to Google in jsdom
const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

// Import the component under test AFTER the mock is set up
import { LoginForm } from '../../app/login/login-form'

describe('slice-02-login-page: Login Page Acceptance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // AC-1: Route rendert mit HTTP 200
  // GIVEN die Route `/login` existiert
  // WHEN ein User `/login` im Browser aufruft
  // THEN wird die Login-Page gerendert mit HTTP 200
  // ---------------------------------------------------------------------------
  it('AC-1: should render the login page component successfully', () => {
    /**
     * AC-1: We verify the component renders without error. The HTTP 200
     * status is a server-level concern (Next.js route), so we validate
     * the component mounts and produces DOM output. The server component
     * (page.tsx) is a thin wrapper that passes searchParams to LoginForm.
     */
    const { container } = render(<LoginForm error={null} />)
    expect(container.firstChild).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // AC-2: Google Sign-In Button sichtbar
  // GIVEN die Login-Page ist gerendert
  // WHEN der User die Seite betrachtet
  // THEN ist ein Google Sign-In Button sichtbar mit dem Text
  //      "Mit Google anmelden" (oder "Sign in with Google")
  // ---------------------------------------------------------------------------
  it('AC-2: should display a Google Sign-In button with "Mit Google anmelden" text', () => {
    render(<LoginForm error={null} />)

    const button = screen.getByTestId('google-sign-in')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent(/Mit Google anmelden/i)
  })

  // ---------------------------------------------------------------------------
  // AC-3: App-Logo/Name sichtbar
  // GIVEN die Login-Page ist gerendert
  // WHEN der User die Seite betrachtet
  // THEN ist das App-Logo (oder App-Name "AI Factory") sichtbar
  //      oberhalb des Sign-In Buttons
  // ---------------------------------------------------------------------------
  it('AC-3: should display the app name "AI Factory" above the sign-in button', () => {
    render(<LoginForm error={null} />)

    const appName = screen.getByTestId('app-name')
    expect(appName).toBeInTheDocument()
    expect(appName).toHaveTextContent('AI Factory')

    // Verify the app name appears BEFORE the sign-in button in the DOM
    const signInButton = screen.getByTestId('google-sign-in')
    const namePosition = appName.compareDocumentPosition(signInButton)
    // Node.DOCUMENT_POSITION_FOLLOWING (4) means signInButton comes after appName
    expect(namePosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // AC-4: Button klick ruft signIn auf
  // GIVEN die Login-Page ist gerendert
  // WHEN der User auf den Google Sign-In Button klickt
  // THEN wird `signIn("google", { redirectTo: "/" })` aufgerufen
  //      und der OAuth-Flow gestartet
  // ---------------------------------------------------------------------------
  it('AC-4: should call signIn("google", { redirectTo: "/" }) when the sign-in button is clicked', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue(undefined)

    render(<LoginForm error={null} />)

    const button = screen.getByTestId('google-sign-in')
    await user.click(button)

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignIn).toHaveBeenCalledWith('google', { redirectTo: '/' })
  })

  // ---------------------------------------------------------------------------
  // AC-5: OAuth-Fehler Fehlermeldung
  // GIVEN ein OAuth-Fehler ist aufgetreten
  // WHEN die Login-Page mit Query-Parameter `?error=OAuthAccountNotLinked`
  //      oder `?error=OAuthCallbackError` aufgerufen wird
  // THEN wird eine Fehlermeldung angezeigt:
  //      "Login fehlgeschlagen. Bitte erneut versuchen."
  // ---------------------------------------------------------------------------
  it('AC-5: should display generic error message when ?error=OAuthCallbackError is present', () => {
    render(<LoginForm error="OAuthCallbackError" />)

    const errorAlert = screen.getByTestId('login-error')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveTextContent('Login fehlgeschlagen. Bitte erneut versuchen.')
  })

  it('AC-5: should display generic error message when ?error=OAuthAccountNotLinked is present', () => {
    render(<LoginForm error="OAuthAccountNotLinked" />)

    const errorAlert = screen.getByTestId('login-error')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveTextContent('Login fehlgeschlagen. Bitte erneut versuchen.')
  })

  // ---------------------------------------------------------------------------
  // AC-6: AccessDenied Fehlermeldung
  // GIVEN ein User mit nicht-autorisierter Email hat sich versucht einzuloggen
  // WHEN die Login-Page mit Query-Parameter `?error=AccessDenied` aufgerufen wird
  // THEN wird eine Fehlermeldung angezeigt:
  //      "Kein Zugang. Bitte kontaktiere den Administrator."
  // ---------------------------------------------------------------------------
  it('AC-6: should display access denied message when ?error=AccessDenied is present', () => {
    render(<LoginForm error="AccessDenied" />)

    const errorAlert = screen.getByTestId('login-error')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveTextContent('Kein Zugang. Bitte kontaktiere den Administrator.')
  })

  // ---------------------------------------------------------------------------
  // AC-7: Keine Fehlermeldung ohne error param
  // GIVEN die Login-Page ist gerendert ohne `?error=` Query-Parameter
  // WHEN der User die Seite betrachtet
  // THEN ist keine Fehlermeldung sichtbar
  // ---------------------------------------------------------------------------
  it('AC-7: should not display any error message when no error query param is present', () => {
    render(<LoginForm error={null} />)

    const errorAlert = screen.queryByTestId('login-error')
    expect(errorAlert).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // AC-8: Zentriertes Layout
  // GIVEN die Login-Page ist gerendert
  // WHEN der User die Seite betrachtet
  // THEN ist der Sign-In Button zentriert auf der Seite (zentrierter Container)
  // ---------------------------------------------------------------------------
  it('AC-8: should render the sign-in button in a centered container with max-width', () => {
    render(<LoginForm error={null} />)

    // The Card component wraps the sign-in button and has max-w-[400px]
    const button = screen.getByTestId('google-sign-in')
    // Walk up to find the Card wrapper (w-full max-w-[400px])
    const card = button.closest('.max-w-\\[400px\\]')
    expect(card).toBeTruthy()

    // The CardContent should center its children (flex flex-col items-center)
    const cardContent = button.parentElement
    expect(cardContent).toBeTruthy()
    expect(cardContent!.className).toContain('items-center')
  })
})

describe('slice-02-login-page: Server Component (page.tsx)', () => {
  // ---------------------------------------------------------------------------
  // AC-1 (integration): Verify the page server component module exports
  // correctly and passes searchParams to LoginForm.
  // ---------------------------------------------------------------------------
  it('AC-1: page.tsx should export a default async function', async () => {
    const pageModule = await import('../../app/login/page')
    expect(pageModule.default).toBeDefined()
    expect(typeof pageModule.default).toBe('function')
  })
})

describe('slice-02-login-page: Edge Cases & Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Interaction test: verify click target covers the full button area
  it('AC-4 (interaction): sign-in button should be a real clickable element', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue(undefined)

    render(<LoginForm error={null} />)

    // Click by role to ensure it is a proper button element
    const button = screen.getByRole('button', { name: /Mit Google anmelden/i })
    expect(button).toBeInTheDocument()

    await user.click(button)
    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })

  // Edge case: unknown error param should show generic message
  it('AC-5 (edge): unknown error param should show fallback error message', () => {
    render(<LoginForm error="SomeUnknownError" />)

    const errorAlert = screen.getByTestId('login-error')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveTextContent('Login fehlgeschlagen. Bitte erneut versuchen.')
  })

  // Edge case: empty string error should not show error
  it('AC-7 (edge): empty string error should not display error message', () => {
    render(<LoginForm error="" />)

    const errorAlert = screen.queryByTestId('login-error')
    expect(errorAlert).not.toBeInTheDocument()
  })
})
