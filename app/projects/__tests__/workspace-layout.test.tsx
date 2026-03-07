// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/projects/proj-b",
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
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
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
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

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

const allProjects = [
  makeProject("proj-a", "Project Alpha"),
  makeProject("proj-b", "Project Beta"),
  makeProject("proj-c", "Project Gamma"),
];

/**
 * Renders the workspace layout structure matching app/projects/[id]/page.tsx.
 *
 * This mirrors the actual JSX tree from the page component:
 *   <SidebarProvider>
 *     <WorkspaceStateProvider>        -- mocked away, not relevant for layout
 *       <Sidebar projects={projects} />
 *       <SidebarInset>
 *         <header>
 *           <SidebarTrigger />
 *           <h1>{projectName}</h1>
 *         </header>
 *         <WorkspaceContent ... />    -- stubbed as simple div
 *       </SidebarInset>
 *     </WorkspaceStateProvider>
 *   </SidebarProvider>
 *
 * We use the REAL shadcn components (SidebarProvider, SidebarInset, SidebarTrigger)
 * and the REAL Sidebar component (from slice-04) to test their integration.
 */
function renderWorkspaceLayout(
  options: { projectName?: string; defaultOpen?: boolean } = {}
) {
  const { projectName = "Project Beta", defaultOpen = true } = options;
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar projects={allProjects} />
      <SidebarInset>
        <header className="flex h-14 items-center border-b px-4 gap-2">
          <SidebarTrigger className="shrink-0" />
          <h1 className="text-xl font-bold truncate">{projectName}</h1>
        </header>
        <div data-testid="workspace-content">Workspace Content</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests: Sidebar Layout Integration (Slice 05)
// ---------------------------------------------------------------------------

describe("Sidebar Layout Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  // =========================================================================
  // AC-1: SidebarProvider wrapping
  // =========================================================================

  /**
   * AC-1: GIVEN die Workspace-Seite `/projects/[id]`
   *       WHEN die Seite gerendert wird
   *       THEN ist das gesamte Layout in einem `SidebarProvider` gewrapped
   *            und die Sidebar wird ueber die shadcn `Sidebar`-Komponente gerendert
   */
  it("AC-1: should wrap workspace layout in SidebarProvider with Sidebar component", () => {
    renderWorkspaceLayout();

    // SidebarProvider renders a wrapper div with data-slot="sidebar-wrapper"
    const sidebarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]'
    );
    expect(sidebarWrapper).toBeInTheDocument();

    // The shadcn Sidebar primitive renders with data-slot="sidebar"
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();

    // Sidebar is inside the SidebarProvider wrapper (proves wrapping)
    expect(sidebarWrapper!.contains(sidebar!)).toBe(true);

    // SidebarInset renders as <main data-slot="sidebar-inset"> for main content
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    expect(sidebarInset).toBeInTheDocument();
    expect(sidebarInset!.tagName).toBe("MAIN");
    expect(sidebarWrapper!.contains(sidebarInset!)).toBe(true);

    // Project name appears in the header within SidebarInset
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Project Beta");

    // Sidebar renders the project list with shadcn Sidebar component
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-2: Keyboard shortcut Ctrl+B toggles sidebar on desktop
  // =========================================================================

  /**
   * AC-2: GIVEN ein Desktop-Viewport (>= 768px)
   *       WHEN der User den Keyboard-Shortcut `Ctrl+B` drueckt
   *       THEN toggled die Sidebar zwischen expanded und collapsed State
   */
  it("AC-2: should toggle sidebar on Ctrl+B keypress on desktop viewport", async () => {
    mockIsMobileValue = false;
    renderWorkspaceLayout();

    // Sidebar starts expanded
    expect(
      document.querySelector('[data-state="expanded"]')
    ).toBeInTheDocument();

    // Press Ctrl+B to collapse
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    // Sidebar should now be collapsed
    await waitFor(() => {
      expect(
        document.querySelector('[data-state="collapsed"]')
      ).toBeInTheDocument();
    });

    // Press Ctrl+B again to expand
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    // Sidebar should be expanded again
    await waitFor(() => {
      expect(
        document.querySelector('[data-state="expanded"]')
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // AC-3: SidebarTrigger in header collapses sidebar
  // =========================================================================

  /**
   * AC-3: GIVEN ein Desktop-Viewport mit expandierter Sidebar
   *       WHEN der User den `SidebarTrigger` im Header klickt
   *       THEN kollabiert die Sidebar auf Icon-Mode
   */
  it("AC-3: should collapse sidebar when SidebarTrigger in header is clicked", async () => {
    mockIsMobileValue = false;
    const user = userEvent.setup();
    renderWorkspaceLayout();

    // Sidebar starts expanded
    expect(
      document.querySelector('[data-state="expanded"]')
    ).toBeInTheDocument();

    // Find the SidebarTrigger inside the header (within SidebarInset)
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    expect(sidebarInset).toBeInTheDocument();

    const header = sidebarInset!.querySelector("header");
    expect(header).toBeInTheDocument();

    // SidebarTrigger renders a button with sr-only text "Toggle Sidebar"
    const triggerButton = within(header as HTMLElement).getByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton).toHaveAttribute("data-sidebar", "trigger");

    // Click the trigger to collapse
    await user.click(triggerButton);

    // Sidebar should now be collapsed with icon mode
    await waitFor(() => {
      const collapsedSidebar = document.querySelector(
        '[data-state="collapsed"]'
      );
      expect(collapsedSidebar).toBeInTheDocument();
      // The Sidebar component uses collapsible="icon"
      expect(collapsedSidebar).toHaveAttribute("data-collapsible", "icon");
    });
  });

  // =========================================================================
  // AC-4: Mobile hamburger button visible
  // =========================================================================

  /**
   * AC-4: GIVEN ein Mobile-Viewport (< 768px)
   *       WHEN die Seite gerendert wird
   *       THEN ist die Sidebar versteckt und ein Hamburger-Button (SidebarTrigger)
   *            ist im Header sichtbar
   */
  it("AC-4: should show hamburger SidebarTrigger in header on mobile viewport", () => {
    mockIsMobileValue = true;
    renderWorkspaceLayout();

    // On mobile, the sidebar renders as a Sheet (closed by default).
    // Sidebar content should NOT be visible when mobile sidebar is closed.
    expect(screen.queryByText("Project Alpha")).not.toBeInTheDocument();

    // The SidebarTrigger in the header should be present
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    expect(sidebarInset).toBeInTheDocument();

    const header = sidebarInset!.querySelector("header");
    expect(header).toBeInTheDocument();

    // Hamburger button (SidebarTrigger) is in the header
    const triggerButton = within(header as HTMLElement).getByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton).toHaveAttribute("data-sidebar", "trigger");
  });

  // =========================================================================
  // AC-5: Mobile sidebar opens as overlay drawer
  // =========================================================================

  /**
   * AC-5: GIVEN ein Mobile-Viewport mit geschlossener Sidebar
   *       WHEN der User den Hamburger-Button im Header klickt
   *       THEN oeffnet sich die Sidebar als Overlay-Drawer von links mit dimmed Backdrop
   */
  it("AC-5: should open sidebar as overlay drawer on mobile hamburger click", async () => {
    mockIsMobileValue = true;
    const user = userEvent.setup();
    renderWorkspaceLayout();

    // Find the SidebarTrigger in the header
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    const header = sidebarInset!.querySelector("header");
    const triggerButton = within(header as HTMLElement).getByRole("button", {
      name: /toggle sidebar/i,
    });

    // Initially, sidebar content should not be visible (Sheet is closed)
    expect(screen.queryByText("Project Alpha")).not.toBeInTheDocument();

    // Click the hamburger button to open mobile sidebar
    await user.click(triggerButton);

    // The sidebar should open as a Sheet overlay with data-mobile="true"
    await waitFor(() => {
      const mobileSheet = document.querySelector('[data-mobile="true"]');
      expect(mobileSheet).toBeInTheDocument();
    });

    // The dimmed backdrop (Sheet overlay) should be present
    const sheetOverlay = document.querySelector(
      '[data-slot="sheet-overlay"]'
    );
    expect(sheetOverlay).toBeInTheDocument();

    // The sidebar renders as a dialog (Sheet uses radix Dialog)
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Project content should now be visible inside the drawer
    expect(within(dialog).getByText("Projects")).toBeInTheDocument();
    expect(within(dialog).getByText("Project Alpha")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-6: Mobile backdrop click closes sidebar
  // =========================================================================

  /**
   * AC-6: GIVEN ein Mobile-Viewport mit geoeffneter Sidebar
   *       WHEN der User auf den dimmed Backdrop klickt
   *       THEN schliesst sich die Sidebar
   */
  it("AC-6: should close sidebar overlay when dimmed backdrop is clicked", async () => {
    mockIsMobileValue = true;
    const user = userEvent.setup();
    renderWorkspaceLayout();

    // Open the mobile sidebar first
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    const header = sidebarInset!.querySelector("header");
    const triggerButton = within(header as HTMLElement).getByRole("button", {
      name: /toggle sidebar/i,
    });
    await user.click(triggerButton);

    // Wait for sidebar to open
    await waitFor(() => {
      expect(
        document.querySelector('[data-mobile="true"]')
      ).toBeInTheDocument();
    });

    // Verify sidebar dialog is open with content
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();

    // Click the dimmed backdrop (Sheet overlay) to close the sidebar
    const sheetOverlay = document.querySelector(
      '[data-slot="sheet-overlay"]'
    );
    expect(sheetOverlay).toBeInTheDocument();
    await user.click(sheetOverlay as HTMLElement);

    // After clicking backdrop, the sidebar dialog should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // AC-7: Main content adjusts dynamically
  // =========================================================================

  /**
   * AC-7: GIVEN die Workspace-Seite mit SidebarProvider
   *       WHEN die Sidebar kollabiert oder expandiert wird
   *       THEN passt sich der Main-Content-Bereich (Header + WorkspaceContent)
   *            dynamisch an die verfuegbare Breite an
   */
  it("AC-7: should adjust main content area width when sidebar state changes", async () => {
    mockIsMobileValue = false;
    const user = userEvent.setup();
    renderWorkspaceLayout();

    // SidebarInset is the <main> element that holds header + workspace content
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    expect(sidebarInset).toBeInTheDocument();
    expect(sidebarInset!.tagName).toBe("MAIN");
    // flex-1 and w-full ensure dynamic width adjustment
    expect(sidebarInset!.className).toContain("flex-1");
    expect(sidebarInset!.className).toContain("w-full");

    // The sidebar-wrapper uses flex layout for children to distribute width
    const sidebarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]'
    );
    expect(sidebarWrapper).toBeInTheDocument();
    expect(sidebarWrapper!.className).toContain("flex");

    // The sidebar gap element adjusts width based on state
    const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]');
    expect(sidebarGap).toBeInTheDocument();

    // Sidebar starts expanded
    expect(
      document.querySelector('[data-state="expanded"]')
    ).toBeInTheDocument();

    // Header and WorkspaceContent are inside SidebarInset
    expect(sidebarInset!.querySelector("header")).toBeInTheDocument();
    expect(
      within(sidebarInset as HTMLElement).getByTestId("workspace-content")
    ).toBeInTheDocument();

    // Collapse the sidebar via the trigger in the header
    const header = sidebarInset!.querySelector("header");
    const triggerButton = within(header as HTMLElement).getByRole("button", {
      name: /toggle sidebar/i,
    });
    await user.click(triggerButton);

    // After collapse, sidebar state changes
    await waitFor(() => {
      expect(
        document.querySelector('[data-state="collapsed"]')
      ).toBeInTheDocument();
    });

    // SidebarInset remains present with dynamic layout classes
    const sidebarInsetAfter = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    expect(sidebarInsetAfter).toBeInTheDocument();
    expect(sidebarInsetAfter!.className).toContain("flex-1");
    expect(sidebarInsetAfter!.className).toContain("w-full");

    // Header and WorkspaceContent stay inside SidebarInset
    expect(sidebarInsetAfter!.querySelector("header")).toBeInTheDocument();
    expect(
      within(sidebarInsetAfter as HTMLElement).getByTestId("workspace-content")
    ).toBeInTheDocument();

    // Sidebar gap element is still present (CSS handles width transition)
    expect(
      document.querySelector('[data-slot="sidebar-gap"]')
    ).toBeInTheDocument();

    // Expand back via trigger
    const triggerAfterCollapse = within(
      sidebarInsetAfter!.querySelector("header") as HTMLElement
    ).getByRole("button", { name: /toggle sidebar/i });
    await user.click(triggerAfterCollapse);

    // Sidebar re-expands
    await waitFor(() => {
      expect(
        document.querySelector('[data-state="expanded"]')
      ).toBeInTheDocument();
    });

    // SidebarInset still adapts with flex-1
    const sidebarInsetFinal = document.querySelector(
      '[data-slot="sidebar-inset"]'
    );
    expect(sidebarInsetFinal).toBeInTheDocument();
    expect(sidebarInsetFinal!.className).toContain("flex-1");
  });
});
