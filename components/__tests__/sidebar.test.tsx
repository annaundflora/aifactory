// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockPathname = "/projects/proj-b";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock server action createProject
const mockCreateProject = vi.fn();
vi.mock("@/app/actions/projects", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

// Mock lucide-react icons (includes XIcon used by Sheet close button)
vi.mock("lucide-react", () => ({
  ArrowLeft: (props: Record<string, unknown>) => (
    <span data-testid="arrow-left-icon" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="plus-icon" {...props} />
  ),
  PanelLeftIcon: (props: Record<string, unknown>) => (
    <span data-testid="panel-left-icon" {...props} />
  ),
  XIcon: (props: Record<string, unknown>) => (
    <span data-testid="x-icon" {...props} />
  ),
}));

// Mock useIsMobile hook - default to desktop
let mockIsMobileValue = false;
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobileValue,
}));

// Import AFTER mocks
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeProject = (id: string, name: string) => ({
  id,
  name,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  thumbnailUrl: null,
  thumbnailStatus: "none",
});

const twoProjects = [
  makeProject("proj-a", "Eagle Logos"),
  makeProject("proj-b", "POD Designs"),
];

const fourProjects = [
  makeProject("proj-a", "Project Alpha"),
  makeProject("proj-b", "Project Beta"),
  makeProject("proj-c", "Project Gamma"),
  makeProject("proj-d", "Project Delta"),
];

/**
 * Renders the Sidebar wrapped in SidebarProvider (required context).
 * defaultOpen controls whether the sidebar starts expanded or collapsed.
 */
function renderSidebar(
  projects: ReturnType<typeof makeProject>[],
  options: { defaultOpen?: boolean } = {}
) {
  const { defaultOpen = true } = options;
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar projects={projects} />
    </SidebarProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sidebar Content Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/projects/proj-b";
    mockIsMobileValue = false;
    mockCreateProject.mockResolvedValue({
      id: "new-proj-1",
      name: "Untitled Project",
      createdAt: new Date(),
    });

    // Setup matchMedia for jsdom (needed by SidebarProvider keyboard shortcut)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Polyfill ResizeObserver for jsdom (used by radix-ui popper/tooltip)
    if (typeof window.ResizeObserver === "undefined") {
      window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof window.ResizeObserver;
    }
  });

  // -------------------------------------------------------------------------
  // AC-1: Expanded Sidebar zeigt Header, Projektliste, Footer
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN die Sidebar im expanded State
   * WHEN der User die Sidebar betrachtet
   * THEN zeigt sie den Header "Projects" mit einem "+"-Button,
   *      eine scrollbare Projektliste und einen "Back to Overview"-Link im Footer
   */
  it('AC-1: should render Projects header with new-project button, project list, and back-to-overview link', () => {
    renderSidebar(twoProjects);

    // Header: "Projects" label
    expect(screen.getByText("Projects")).toBeInTheDocument();

    // "+"-Button (new project) with data-testid
    const newProjectBtn = screen.getByTestId("sidebar-new-project");
    expect(newProjectBtn).toBeInTheDocument();

    // Scrollable project list with data-testid
    const projectList = screen.getByTestId("sidebar-project-list");
    expect(projectList).toBeInTheDocument();

    // Project names visible
    expect(screen.getByText("Eagle Logos")).toBeInTheDocument();
    expect(screen.getByText("POD Designs")).toBeInTheDocument();

    // Footer: "Back to Overview" link
    const backLink = screen.getByTestId("sidebar-back-to-overview");
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/");
    expect(backLink).toHaveTextContent(/back to overview/i);
  });

  // -------------------------------------------------------------------------
  // AC-2: Projekt-Navigation und Active-State
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN eine Projektliste mit mindestens 2 Projekten (z.B. "Eagle Logos", "POD Designs")
   * WHEN der User auf einen Projektnamen klickt
   * THEN navigiert der Browser zu `/projects/{projectId}` und das aktive Projekt ist visuell hervorgehoben
   */
  it('AC-2: should navigate to project page and highlight active project', async () => {
    const user = userEvent.setup();
    renderSidebar(twoProjects);

    // Active project (POD Designs, proj-b) should be visually highlighted
    // SidebarMenuButton sets data-active="true" on active items
    const podLink = screen.getByText("POD Designs").closest("a");
    expect(podLink).toBeInTheDocument();
    expect(podLink).toHaveAttribute("href", "/projects/proj-b");

    // The menu button wrapping the active project has data-active="true"
    const activeButton = podLink?.closest('[data-slot="sidebar-menu-button"]') || podLink;
    expect(activeButton).toHaveAttribute("data-active", "true");

    // Non-active project (Eagle Logos) should have data-active="false"
    const eagleLink = screen.getByText("Eagle Logos").closest("a");
    expect(eagleLink).toBeInTheDocument();
    expect(eagleLink).toHaveAttribute("href", "/projects/proj-a");

    const inactiveButton = eagleLink?.closest('[data-slot="sidebar-menu-button"]') || eagleLink;
    expect(inactiveButton).toHaveAttribute("data-active", "false");

    // Click on Eagle Logos link to verify navigation
    await user.click(eagleLink!);

    // The link has href="/projects/proj-a" -- Next.js Link handles actual navigation
    expect(eagleLink).toHaveAttribute("href", "/projects/proj-a");
  });

  // -------------------------------------------------------------------------
  // AC-3: Collapse auf Icon-Mode mit Initialen
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN die Sidebar im expanded State
   * WHEN der User den Collapse-Trigger betaetigt
   * THEN kollabiert die Sidebar auf Icon-Mode und zeigt pro Projekt den ersten
   *      Buchstaben des Namens als Initiale (z.B. "E" fuer "Eagle Logos")
   */
  it('AC-3: should collapse to icon-mode showing project initials', async () => {
    const user = userEvent.setup();
    renderSidebar(twoProjects);

    // Verify initials are rendered even in expanded state (they appear alongside names)
    expect(screen.getByText("E")).toBeInTheDocument(); // "Eagle Logos" initial
    expect(screen.getByText("P")).toBeInTheDocument(); // "POD Designs" initial

    // Sidebar should start in expanded state
    const sidebarWrapper = document.querySelector('[data-state="expanded"]');
    expect(sidebarWrapper).toBeInTheDocument();

    // Click the SidebarTrigger to collapse
    const triggerButton = screen.getByRole("button", { name: /toggle sidebar/i });
    expect(triggerButton).toBeInTheDocument();
    await user.click(triggerButton);

    // After collapse, state should be "collapsed"
    const collapsedSidebar = document.querySelector('[data-state="collapsed"]');
    expect(collapsedSidebar).toBeInTheDocument();

    // The collapsible attribute should be "icon" when collapsed
    expect(collapsedSidebar).toHaveAttribute("data-collapsible", "icon");

    // Initials should still be visible in collapsed mode
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-4: Tooltip bei Hover ueber Initialen
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN die Sidebar im collapsed (Icon-Mode) State
   * WHEN der User ueber eine Projekt-Initiale hovert
   * THEN erscheint ein Tooltip mit dem vollstaendigen Projektnamen
   */
  it('AC-4: should show tooltip with full project name on initial hover', async () => {
    const user = userEvent.setup();

    // Start expanded so we can collapse via trigger (ensures proper state transitions)
    renderSidebar(twoProjects);

    // Collapse the sidebar first
    const triggerButton = screen.getByRole("button", { name: /toggle sidebar/i });
    await user.click(triggerButton);

    // Verify collapsed state
    const collapsedSidebar = document.querySelector('[data-state="collapsed"]');
    expect(collapsedSidebar).toBeInTheDocument();
    expect(collapsedSidebar).toHaveAttribute("data-collapsible", "icon");

    // Each project's SidebarMenuButton has tooltip={project.name} prop.
    // With asChild + TooltipTrigger asChild, Slot merges data-slot attributes
    // so data-slot="tooltip-trigger" gets overwritten by data-slot="sidebar-menu-button".
    // We verify the tooltip works by hovering and checking for tooltip content.

    // Find all project links (they have href starting with /projects/)
    const projectLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href")?.startsWith("/projects/")
    );
    expect(projectLinks.length).toBe(2);

    // Each project link should have data-sidebar="menu-button" (from SidebarMenuButton)
    for (const link of projectLinks) {
      expect(link).toHaveAttribute("data-sidebar", "menu-button");
    }

    // Hover over the first project link to trigger its tooltip
    const eagleLink = projectLinks.find(
      (link) => link.getAttribute("href") === "/projects/proj-a"
    );
    expect(eagleLink).toBeDefined();
    await user.hover(eagleLink!);

    // After hover, tooltip content should appear with full project name
    // Radix Tooltip renders content via portal into document body
    await waitFor(() => {
      const tooltipContent = document.querySelector('[data-slot="tooltip-content"]');
      expect(tooltipContent).toBeInTheDocument();
      expect(tooltipContent?.textContent).toContain("Eagle Logos");
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Expand zurueck auf volle Breite
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN die Sidebar im collapsed State
   * WHEN der User den Expand-Trigger betaetigt
   * THEN expandiert die Sidebar zurueck auf volle Breite mit Projektliste
   */
  it('AC-5: should expand back to full width with project list', async () => {
    const user = userEvent.setup();
    // Start collapsed
    renderSidebar(twoProjects, { defaultOpen: false });

    // Verify collapsed state
    expect(document.querySelector('[data-state="collapsed"]')).toBeInTheDocument();

    // Click the SidebarTrigger to expand
    const triggerButton = screen.getByRole("button", { name: /toggle sidebar/i });
    await user.click(triggerButton);

    // After expand, state should be "expanded"
    const expandedSidebar = document.querySelector('[data-state="expanded"]');
    expect(expandedSidebar).toBeInTheDocument();

    // Project list with full names should be visible
    expect(screen.getByText("Eagle Logos")).toBeInTheDocument();
    expect(screen.getByText("POD Designs")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-project-list")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-6: Cookie-Persistierung des Collapse-States
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der User kollabiert die Sidebar und laedt die Seite neu (Page Reload)
   * WHEN die Seite vollstaendig geladen ist
   * THEN ist die Sidebar weiterhin im collapsed State (Cookie-Persistierung)
   */
  it('AC-6: should persist collapsed state across page reload via cookie', async () => {
    const user = userEvent.setup();

    // Clear any existing cookies
    document.cookie = "sidebar_state=; path=/; max-age=0";

    renderSidebar(twoProjects);

    // Sidebar starts expanded
    expect(document.querySelector('[data-state="expanded"]')).toBeInTheDocument();

    // Collapse the sidebar
    const triggerButton = screen.getByRole("button", { name: /toggle sidebar/i });
    await user.click(triggerButton);

    // Verify collapsed state
    expect(document.querySelector('[data-state="collapsed"]')).toBeInTheDocument();

    // SidebarProvider sets a cookie when toggling: sidebar_state=false
    // Verify that document.cookie was set
    expect(document.cookie).toContain("sidebar_state=false");

    // Simulate page reload: render a new instance with defaultOpen=false
    // (which is what the server would pass after reading the cookie)
    const { unmount } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar projects={twoProjects} />
      </SidebarProvider>
    );

    // The sidebar should be in collapsed state after "reload"
    const collapsedSidebars = document.querySelectorAll('[data-state="collapsed"]');
    expect(collapsedSidebars.length).toBeGreaterThanOrEqual(1);

    unmount();
  });

  // -------------------------------------------------------------------------
  // AC-7: Neues Projekt erstellen
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN der User klickt den "+"-Button in der Sidebar
   * WHEN die Server Action `createProject` erfolgreich zurueckgibt
   * THEN navigiert der Browser zum neuen Projekt unter `/projects/{newId}`
   *      und die Projektliste aktualisiert sich
   */
  it('AC-7: should create new project via server action and navigate to it', async () => {
    const user = userEvent.setup();
    renderSidebar(fourProjects);

    // Find and click the new project button
    const newProjectBtn = screen.getByTestId("sidebar-new-project");
    expect(newProjectBtn).toBeInTheDocument();
    await user.click(newProjectBtn);

    // createProject should be called with a default name
    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: "Untitled Project",
      });
    });

    // After successful creation, should navigate to the new project
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/projects/new-proj-1");
    });

    // Should also trigger router.refresh to update the project list
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  /**
   * AC-7 error case: When createProject returns an error, toast should show
   * and no navigation should occur
   */
  it('AC-7: should show toast error when createProject fails', async () => {
    mockCreateProject.mockResolvedValue({ error: "Creation failed" });

    const user = userEvent.setup();
    renderSidebar(fourProjects);

    const newProjectBtn = screen.getByTestId("sidebar-new-project");
    await user.click(newProjectBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Creation failed");
    });

    // Should NOT navigate on error
    expect(mockPush).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-8: Mobile Overlay-Drawer
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN ein Viewport unter 768px Breite (Mobile)
   * WHEN der User den Hamburger-Button/SidebarTrigger betaetigt
   * THEN oeffnet sich die Sidebar als Overlay-Drawer von links mit dimmed Backdrop
   */
  it('AC-8: should open as overlay drawer on mobile viewport', async () => {
    // Set mobile mode
    mockIsMobileValue = true;

    const user = userEvent.setup();

    // On mobile, the shadcn Sidebar renders as a Sheet (radix Dialog overlay).
    // openMobile starts as false (hardcoded in SidebarProvider).
    // We render a SidebarTrigger OUTSIDE the sidebar so it is always accessible
    // (in a real app, the trigger is placed in the layout header).
    render(
      <SidebarProvider defaultOpen={true}>
        <SidebarTrigger data-testid="mobile-trigger" />
        <Sidebar projects={twoProjects} />
      </SidebarProvider>
    );

    // Initially, the mobile sidebar is closed (openMobile=false)
    // Sheet content should not be visible
    expect(screen.queryByText("Eagle Logos")).not.toBeInTheDocument();

    // Click the SidebarTrigger to open the mobile drawer
    // On mobile, toggleSidebar sets openMobile(true)
    const triggerButton = screen.getByTestId("mobile-trigger");
    await user.click(triggerButton);

    // After toggle, the Sheet should open showing sidebar content as overlay
    await waitFor(() => {
      expect(screen.getByText("Eagle Logos")).toBeInTheDocument();
    });

    // Project names should be visible inside the mobile drawer
    expect(screen.getByText("POD Designs")).toBeInTheDocument();

    // The Sheet renders with data-mobile="true" indicating it is a mobile overlay
    const mobileSheet = document.querySelector('[data-mobile="true"]');
    expect(mobileSheet).toBeInTheDocument();

    // The Sheet overlay (backdrop with dimmed background bg-black/50) should be present
    const sheetOverlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(sheetOverlay).toBeInTheDocument();

    // The mobile sidebar renders as a radix Dialog (Sheet) with role="dialog"
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Dialog should contain the sidebar content
    expect(within(dialog).getByText("Eagle Logos")).toBeInTheDocument();
  });
});
