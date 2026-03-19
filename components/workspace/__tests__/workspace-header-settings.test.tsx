// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

beforeAll(() => {
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

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/navigation (WorkspaceHeader uses useRouter)
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock server actions used by WorkspaceHeader
vi.mock("@/app/actions/projects", () => ({
  renameProject: vi.fn().mockResolvedValue({}),
  deleteProject: vi.fn().mockResolvedValue({}),
  generateThumbnail: vi.fn().mockResolvedValue({}),
}));

// Mock server actions used by SettingsDialog (loaded lazily when dialog opens)
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([]),
  updateModelSetting: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock ThemeToggle to isolate WorkspaceHeader logic
// (ThemeToggle requires ThemeProvider context)
vi.mock("@/components/shared/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">ThemeToggle</button>,
}));

// Mock SidebarTrigger (requires SidebarProvider context)
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className, ...props }: { className?: string; [key: string]: unknown }) => (
    <button data-testid="sidebar-trigger" className={className} {...props}>
      SidebarTrigger
    </button>
  ),
}));

// Mock ConfirmDialog (simplify to avoid AlertDialog complexity)
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="confirm-dialog">ConfirmDialog</div> : null,
}));

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------

import { WorkspaceHeader } from "@/components/workspace/workspace-header";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WorkspaceHeader Settings Button", () => {
  const defaultProject = { id: "proj-1", name: "Test Project" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: GIVEN die WorkspaceHeader-Komponente wird gerendert
   *       WHEN der User den rechten Aktionsbereich betrachtet
   *       THEN ist ein Gear-Icon-Button links neben dem ThemeToggle sichtbar
   */
  it("AC-1: should render settings button with gear icon before ThemeToggle", () => {
    render(<WorkspaceHeader project={defaultProject} />);

    // Settings button should be present with aria-label
    const settingsButton = screen.getByRole("button", {
      name: /open settings/i,
    });
    expect(settingsButton).toBeInTheDocument();

    // ThemeToggle should also be present
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();

    // Settings button should appear before ThemeToggle in the DOM
    // (both are in the ml-auto container)
    const container = settingsButton.parentElement;
    expect(container).toBeTruthy();

    const children = Array.from(container!.children);
    const settingsIndex = children.indexOf(settingsButton);
    const themeToggle = screen.getByTestId("theme-toggle");
    const themeIndex = children.indexOf(themeToggle);

    expect(settingsIndex).toBeLessThan(themeIndex);
  });

  /**
   * AC-2: GIVEN der Settings-Button im Header ist sichtbar
   *       WHEN der User auf den Settings-Button klickt
   *       THEN oeffnet sich ein modaler Dialog mit dem Titel "Model Settings"
   */
  it("AC-2: should open SettingsDialog when settings button is clicked", async () => {
    const user = userEvent.setup();

    render(<WorkspaceHeader project={defaultProject} />);

    // Initially, the dialog should not be open (no "Model Settings" heading)
    expect(screen.queryByText("Model Settings")).not.toBeInTheDocument();

    // Click the settings button
    const settingsButton = screen.getByRole("button", {
      name: /open settings/i,
    });
    await user.click(settingsButton);

    // Dialog should now be open with "Model Settings" title
    await waitFor(() => {
      expect(screen.getByText("Model Settings")).toBeInTheDocument();
    });

    // Should be rendered as a dialog role
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
