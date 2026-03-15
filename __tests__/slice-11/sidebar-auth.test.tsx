// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

/**
 * Tests for slice-11-sidebar-auth: Sidebar Auth - User-Info + Logout
 *
 * Tests the Sidebar component's SidebarFooter which displays user info
 * (Google Avatar, Display Name, Email) and a Logout button when authenticated.
 *
 * Mock strategy (mock_external): useSession/signOut from next-auth/react are
 * mocked because they require a real OAuth session + SessionProvider which
 * is technically impossible in jsdom. next/navigation, server actions, and
 * ProjectList are mocked because they depend on Next.js server runtime.
 * All DOM rendering, event handling, and component logic is real.
 */

// --------------------------------------------------------------------------
// jsdom polyfills (required by Radix UI Popper/Tooltip)
// --------------------------------------------------------------------------

// ResizeObserver is used by @radix-ui/react-use-size but missing in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// --------------------------------------------------------------------------
// Mock setup
// --------------------------------------------------------------------------

// Mock next-auth/react -- OAuth session not available in jsdom
const mockSignOut = vi.fn()
let mockUseSession: () => { data: unknown; status: string }

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

// Mock next/navigation -- Next.js router not available in jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/projects/test-123',
}))

// Mock sonner -- toast not relevant for these ACs
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// Mock server actions -- not available in jsdom
vi.mock('@/app/actions/projects', () => ({
  createProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  generateThumbnail: vi.fn(),
}))

// Mock ProjectList -- unrelated component with complex dependencies
vi.mock('@/components/project-list', () => ({
  ProjectList: () => <div data-testid="mock-project-list">Projects</div>,
}))

// Mock useIsMobile -- matchMedia not reliably available in jsdom
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

// Import component under test AFTER mocks
import { Sidebar } from '../../components/sidebar'
import { SidebarProvider } from '../../components/ui/sidebar'

// --------------------------------------------------------------------------
// Helper: Render sidebar with SidebarProvider wrapper
// --------------------------------------------------------------------------

function renderSidebar() {
  return render(
    <SidebarProvider defaultOpen={true}>
      <Sidebar projects={[]} />
    </SidebarProvider>
  )
}

// --------------------------------------------------------------------------
// Session fixtures
// --------------------------------------------------------------------------

const authenticatedSession = {
  data: {
    user: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      image: 'https://lh3.googleusercontent.com/photo.jpg',
    },
    expires: '2099-01-01T00:00:00.000Z',
  },
  status: 'authenticated' as const,
}

const authenticatedSessionNoImage = {
  data: {
    user: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      image: null,
    },
    expires: '2099-01-01T00:00:00.000Z',
  },
  status: 'authenticated' as const,
}

const authenticatedSessionNoName = {
  data: {
    user: {
      name: null,
      email: 'max@example.com',
      image: 'https://lh3.googleusercontent.com/photo.jpg',
    },
    expires: '2099-01-01T00:00:00.000Z',
  },
  status: 'authenticated' as const,
}

const loadingSession = {
  data: null,
  status: 'loading' as const,
}

// --------------------------------------------------------------------------
// Acceptance Tests
// --------------------------------------------------------------------------

describe('slice-11-sidebar-auth: Sidebar Auth Acceptance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // AC-1: Avatar-Anzeige mit Google-Profilbild
  // GIVEN ein User ist eingeloggt mit einer gueltigen Session (useSession liefert session.user)
  // WHEN die Sidebar gerendert wird
  // THEN wird im SidebarFooter das Google-Profilbild als Avatar angezeigt (32x32px, rund via rounded-full)
  // -------------------------------------------------------------------------
  it('AC-1: should render user avatar as 32x32 rounded image when session has user.image', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    const avatar = screen.getByTestId('sidebar-user-avatar')
    expect(avatar).toBeInTheDocument()
    expect(avatar.tagName).toBe('IMG')
    expect(avatar).toHaveAttribute('src', 'https://lh3.googleusercontent.com/photo.jpg')
    expect(avatar).toHaveAttribute('width', '32')
    expect(avatar).toHaveAttribute('height', '32')
    expect(avatar.className).toContain('rounded-full')
  })

  // -------------------------------------------------------------------------
  // AC-2: Display Name und Email
  // GIVEN ein User ist eingeloggt mit session.user.name = "Max Mustermann" und session.user.email = "max@example.com"
  // WHEN die Sidebar gerendert wird
  // THEN wird im SidebarFooter der Display Name "Max Mustermann" und die Email "max@example.com" als Text angezeigt
  // -------------------------------------------------------------------------
  it('AC-2: should render user name and email in SidebarFooter when session is authenticated', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    const nameEl = screen.getByTestId('sidebar-user-name')
    expect(nameEl).toBeInTheDocument()
    expect(nameEl).toHaveTextContent('Max Mustermann')

    const emailEl = screen.getByTestId('sidebar-user-email')
    expect(emailEl).toBeInTheDocument()
    expect(emailEl).toHaveTextContent('max@example.com')
  })

  // -------------------------------------------------------------------------
  // AC-3: Fallback-Avatar bei fehlendem Bild
  // GIVEN ein User ist eingeloggt aber session.user.image ist null oder undefined
  // WHEN die Sidebar gerendert wird
  // THEN wird ein Fallback-Avatar angezeigt (z.B. Initialen oder generisches User-Icon) statt eines gebrochenen Bild-Elements
  // -------------------------------------------------------------------------
  it('AC-3: should render fallback avatar when session.user.image is null', () => {
    mockUseSession = () => authenticatedSessionNoImage

    renderSidebar()

    const fallbackAvatar = screen.getByTestId('sidebar-user-avatar-fallback')
    expect(fallbackAvatar).toBeInTheDocument()

    // Should NOT render a broken img element
    const imgInFallback = screen.queryByTestId('sidebar-user-avatar')
    expect(imgInFallback).not.toBeInTheDocument()

    // Fallback should have rounded-full styling
    expect(fallbackAvatar.className).toContain('rounded-full')
  })

  it('AC-3 (edge): should render fallback avatar when session.user.image is undefined', () => {
    mockUseSession = () => ({
      data: {
        user: {
          name: 'Max Mustermann',
          email: 'max@example.com',
          image: undefined,
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      status: 'authenticated',
    })

    renderSidebar()

    const fallbackAvatar = screen.getByTestId('sidebar-user-avatar-fallback')
    expect(fallbackAvatar).toBeInTheDocument()

    const imgAvatar = screen.queryByTestId('sidebar-user-avatar')
    expect(imgAvatar).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-4: Email als Fallback fuer fehlenden Namen
  // GIVEN ein User ist eingeloggt aber session.user.name ist null oder undefined
  // WHEN die Sidebar gerendert wird
  // THEN wird die Email-Adresse als Fallback fuer den Display Name angezeigt
  // -------------------------------------------------------------------------
  it('AC-4: should render email as display name when session.user.name is null', () => {
    mockUseSession = () => authenticatedSessionNoName

    renderSidebar()

    const nameEl = screen.getByTestId('sidebar-user-name')
    expect(nameEl).toBeInTheDocument()
    // When name is null, email should be displayed as the name
    expect(nameEl).toHaveTextContent('max@example.com')
  })

  it('AC-4 (edge): should render email as display name when session.user.name is undefined', () => {
    mockUseSession = () => ({
      data: {
        user: {
          name: undefined,
          email: 'test@example.com',
          image: 'https://example.com/photo.jpg',
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      status: 'authenticated',
    })

    renderSidebar()

    const nameEl = screen.getByTestId('sidebar-user-name')
    expect(nameEl).toHaveTextContent('test@example.com')
  })

  // -------------------------------------------------------------------------
  // AC-5: Logout-Button ruft signOut auf
  // GIVEN ein User ist eingeloggt und sieht den SidebarFooter
  // WHEN der User auf den Logout-Button klickt
  // THEN wird signOut() von next-auth/react aufgerufen mit { callbackUrl: "/login" }
  // -------------------------------------------------------------------------
  it('AC-5: should call signOut with callbackUrl /login when logout button is clicked', async () => {
    mockUseSession = () => authenticatedSession
    const user = userEvent.setup()

    renderSidebar()

    const logoutButton = screen.getByTestId('sidebar-logout-button')
    expect(logoutButton).toBeInTheDocument()

    await user.click(logoutButton)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  // -------------------------------------------------------------------------
  // AC-6: Loading-State ohne User-Info
  // GIVEN die Session via useSession() den Status "loading" hat
  // WHEN die Sidebar gerendert wird
  // THEN wird kein User-Info-Bereich im Footer angezeigt (keine Skeleton-Flicker, kein leerer Bereich)
  // -------------------------------------------------------------------------
  it('AC-6: should not render user info section when session status is loading', () => {
    mockUseSession = () => loadingSession

    renderSidebar()

    const userInfo = screen.queryByTestId('sidebar-user-info')
    expect(userInfo).not.toBeInTheDocument()

    const avatar = screen.queryByTestId('sidebar-user-avatar')
    expect(avatar).not.toBeInTheDocument()

    const fallbackAvatar = screen.queryByTestId('sidebar-user-avatar-fallback')
    expect(fallbackAvatar).not.toBeInTheDocument()

    const logoutButton = screen.queryByTestId('sidebar-logout-button')
    expect(logoutButton).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-7: Collapsed-Modus zeigt nur Avatar
  // GIVEN die Sidebar im collapsed/icon-Modus ist (collapsible="icon")
  // WHEN die Sidebar gerendert wird
  // THEN sind Name, Email und Logout-Text ausgeblendet und nur der Avatar sichtbar
  //      (konsistent mit bestehendem group-data-[collapsible=icon]:hidden Pattern)
  // -------------------------------------------------------------------------
  it('AC-7: should hide name, email, and logout text in collapsed icon mode', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    // The Sidebar uses group-data-[collapsible=icon]:hidden CSS class to hide
    // name, email, and logout in collapsed mode. We verify the CSS classes are present.
    const nameEl = screen.getByTestId('sidebar-user-name')
    const nameContainer = nameEl.closest('[class*="group-data-[collapsible=icon]:hidden"]')
    expect(nameContainer).toBeTruthy()

    const emailEl = screen.getByTestId('sidebar-user-email')
    const emailContainer = emailEl.closest('[class*="group-data-[collapsible=icon]:hidden"]')
    expect(emailContainer).toBeTruthy()

    const logoutButton = screen.getByTestId('sidebar-logout-button')
    const logoutContainer = logoutButton.closest('[class*="group-data-[collapsible=icon]:hidden"]')
    expect(logoutContainer).toBeTruthy()

    // Avatar should NOT be inside a hidden container -- it remains visible
    const avatar = screen.getByTestId('sidebar-user-avatar')
    expect(avatar).toBeInTheDocument()
    // Avatar itself should not have the collapsible=icon:hidden class
    expect(avatar.className).not.toContain('group-data-[collapsible=icon]:hidden')
  })

  // -------------------------------------------------------------------------
  // AC-8: Back to Overview Link bleibt erhalten
  // GIVEN die User-Info wird im SidebarFooter angezeigt
  // WHEN die bestehende "Back to Overview"-Funktionalitaet geprueft wird
  // THEN ist der "Back to Overview"-Link weiterhin vorhanden und funktional (keine Regression)
  // -------------------------------------------------------------------------
  it('AC-8: should still render Back to Overview link in SidebarFooter', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    const backLink = screen.getByTestId('sidebar-back-to-overview')
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/')
    expect(backLink).toHaveTextContent(/Back to Overview/i)
  })
})

// --------------------------------------------------------------------------
// Interaction Tests
// --------------------------------------------------------------------------

describe('slice-11-sidebar-auth: Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-5 (interaction): Verify the logout button is a real clickable button element
  it('AC-5 (interaction): logout button should be a real clickable button element', async () => {
    mockUseSession = () => authenticatedSession
    const user = userEvent.setup()

    renderSidebar()

    // Query by role to ensure it is a proper button, not just a styled div
    const logoutButton = screen.getByRole('button', { name: /logout/i })
    expect(logoutButton).toBeInTheDocument()

    await user.click(logoutButton)
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  // AC-8 (interaction): Verify Back to Overview link is a real navigable link
  it('AC-8 (interaction): Back to Overview link should be a real anchor element with href', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    const backLink = screen.getByTestId('sidebar-back-to-overview')
    expect(backLink.tagName).toBe('A')
    expect(backLink).toHaveAttribute('href', '/')
  })
})

// --------------------------------------------------------------------------
// Edge Case Tests
// --------------------------------------------------------------------------

describe('slice-11-sidebar-auth: Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-6 (edge): Unauthenticated session should also not show user info
  it('AC-6 (edge): should not render user info when session status is unauthenticated', () => {
    mockUseSession = () => ({
      data: null,
      status: 'unauthenticated',
    })

    renderSidebar()

    const userInfo = screen.queryByTestId('sidebar-user-info')
    expect(userInfo).not.toBeInTheDocument()

    const logoutButton = screen.queryByTestId('sidebar-logout-button')
    expect(logoutButton).not.toBeInTheDocument()
  })

  // AC-8 (edge): Back to Overview should be present even without auth
  it('AC-8 (edge): Back to Overview link should be present even when not authenticated', () => {
    mockUseSession = () => loadingSession

    renderSidebar()

    const backLink = screen.getByTestId('sidebar-back-to-overview')
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/')
  })

  // AC-1 (edge): Avatar should have alt text from user name
  it('AC-1 (edge): avatar should have alt text derived from user name', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    const avatar = screen.getByTestId('sidebar-user-avatar')
    expect(avatar).toHaveAttribute('alt', 'Max Mustermann')
  })

  // AC-2 (edge): Both name and email should be present simultaneously
  it('AC-2 (edge): user info section should contain both name and email as separate elements', () => {
    mockUseSession = () => authenticatedSession

    renderSidebar()

    const userInfo = screen.getByTestId('sidebar-user-info')
    const nameEl = within(userInfo).getByTestId('sidebar-user-name')
    const emailEl = within(userInfo).getByTestId('sidebar-user-email')

    expect(nameEl).toBeInTheDocument()
    expect(emailEl).toBeInTheDocument()
    // Name and email should be different elements
    expect(nameEl).not.toBe(emailEl)
  })
})
