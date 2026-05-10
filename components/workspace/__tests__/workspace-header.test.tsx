// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills (Radix Dropdown / Dialog uses pointer-capture + ResizeObserver)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }

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
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
//
// - `<ProjectContextSettings>` is stubbed so we can assert prop-wiring
//   (projectId, open, onOpenChange) without exercising Slice 06 internals.
// - `<SettingsDialog>` is stubbed to verify it stays CLOSED when "Edit context"
//   is clicked (AC-4 — both modals must remain independently controllable).
// - `<ConfirmDialog>` is stubbed (Delete-flow not the focus of these tests).
// - Server actions, navigation, sonner are mocked away.
// ---------------------------------------------------------------------------

// next/navigation router
const mockRouterRefresh = vi.fn();
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
}));

// Server actions (projects)
vi.mock("@/app/actions/projects", () => ({
  renameProject: vi.fn().mockResolvedValue({ id: "proj-h", name: "Header Project" }),
  deleteProject: vi.fn().mockResolvedValue({ success: true }),
  generateThumbnail: vi.fn().mockResolvedValue({ ok: true }),
}));

// Sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// SidebarTrigger — stub to plain element
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button className={className} data-testid="sidebar-trigger">
      Toggle Sidebar
    </button>
  ),
}));

// ThemeToggle — stub
vi.mock("@/components/shared/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

// ConfirmDialog — keep simple
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? <div data-testid="confirm-dialog">{title}</div> : null,
}));

// SettingsDialog — stub renders only when open=true so we can assert it
// stays CLOSED for the Edit-context path (AC-4).
const settingsDialogMock = vi.fn();
vi.mock("@/components/settings/settings-dialog", () => ({
  SettingsDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    settingsDialogMock(props);
    return props.open ? (
      <div data-testid="settings-dialog">Workspace Settings</div>
    ) : null;
  },
}));

// ProjectContextSettings — stub captures props for assertion
const projectContextSettingsMock = vi.fn();
vi.mock("@/components/projects/project-context-settings", () => ({
  __esModule: true,
  default: (props: {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    projectContextSettingsMock(props);
    return props.open ? (
      <div
        data-testid="project-context-settings"
        data-project-id={props.projectId}
      >
        <span data-testid="pcs-project-id">{props.projectId}</span>
        <button
          data-testid="pcs-close"
          onClick={() => props.onOpenChange(false)}
        >
          close
        </button>
      </div>
    ) : null;
  },
}));

import { WorkspaceHeader } from "@/components/workspace/workspace-header";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseProject = {
  id: "proj-h",
  name: "Header Project",
};

// ---------------------------------------------------------------------------
// Slice 07: Workspace-Header "Edit context" Entry-Point
// ---------------------------------------------------------------------------

describe("WorkspaceHeader - Edit context entry (Slice 07)", () => {
  beforeEach(() => {
    projectContextSettingsMock.mockClear();
    settingsDialogMock.mockClear();
    mockRouterRefresh.mockClear();
    mockRouterPush.mockClear();
  });

  /**
   * AC-3: GIVEN User ist im Workspace eines Projekts (Workspace-Header sichtbar)
   * WHEN User oeffnet das Kebab-Menue (<MoreVertical>)
   * THEN enthaelt das Dropdown einen <DropdownMenuItem> "Edit context" mit
   *      Settings-Icon, platziert zwischen "Refresh Thumbnail" und der
   *      <DropdownMenuSeparator> vor "Delete Project"
   */
  it("AC-3: dropdown menu contains Edit context item between Refresh Thumbnail and Delete separator", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHeader project={baseProject} />);

    // Open the kebab dropdown
    const kebabBtn = screen.getByRole("button", { name: /project actions/i });
    await user.click(kebabBtn);

    // Wait for the dropdown content to be visible
    await waitFor(() => {
      expect(screen.getByText("Edit context")).toBeInTheDocument();
    });

    // The dropdown should expose the standard items
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Refresh Thumbnail")).toBeInTheDocument();
    expect(screen.getByText("Edit context")).toBeInTheDocument();
    expect(screen.getByText("Delete Project")).toBeInTheDocument();

    // Verify ordering by walking the dropdown menu items in DOM order.
    // Radix DropdownMenuItem has role="menuitem".
    const menuItems = screen.getAllByRole("menuitem");
    const labels = menuItems.map((mi) => mi.textContent?.trim() || "");

    const idxRefresh = labels.findIndex((l) => l.includes("Refresh Thumbnail"));
    const idxEdit = labels.findIndex((l) => l.includes("Edit context"));
    const idxDelete = labels.findIndex((l) => l.includes("Delete Project"));

    expect(idxRefresh).toBeGreaterThanOrEqual(0);
    expect(idxEdit).toBeGreaterThanOrEqual(0);
    expect(idxDelete).toBeGreaterThanOrEqual(0);

    // Edit context MUST come AFTER Refresh Thumbnail
    expect(idxEdit).toBeGreaterThan(idxRefresh);
    // Edit context MUST come BEFORE Delete Project
    expect(idxEdit).toBeLessThan(idxDelete);

    // Edit context item must contain a Settings <svg> icon (lucide)
    const editItem = menuItems.find((mi) =>
      mi.textContent?.includes("Edit context")
    );
    expect(editItem?.querySelector("svg")).toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN Workspace-Header-Dropdown offen mit "Edit context"-Eintrag
   * WHEN User klickt den Eintrag
   * THEN oeffnet sich <ProjectContextSettings> mit { projectId:<header-project-id>,
   *      open:true, onOpenChange:<fn> }; das bestehende <SettingsDialog>
   *      (Workspace-Settings) wird NICHT geoeffnet — beide Modals bleiben
   *      getrennt steuerbar.
   */
  it("AC-4: clicking Edit context item opens ProjectContextSettings with header projectId; SettingsDialog stays closed", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHeader project={baseProject} />);

    // Initial state: ProjectContextSettings rendered with open=false; modal not in DOM
    expect(
      screen.queryByTestId("project-context-settings")
    ).not.toBeInTheDocument();
    const initialPCS =
      projectContextSettingsMock.mock.calls[
        projectContextSettingsMock.mock.calls.length - 1
      ]?.[0];
    expect(initialPCS).toMatchObject({
      projectId: "proj-h",
      open: false,
    });
    expect(typeof initialPCS.onOpenChange).toBe("function");

    // SettingsDialog is also rendered with open=false (sibling, separate state)
    const initialSD =
      settingsDialogMock.mock.calls[settingsDialogMock.mock.calls.length - 1]?.[0];
    expect(initialSD).toMatchObject({ open: false });

    // Open the kebab and click Edit context
    const kebabBtn = screen.getByRole("button", { name: /project actions/i });
    await user.click(kebabBtn);

    await waitFor(() => {
      expect(screen.getByText("Edit context")).toBeInTheDocument();
    });

    const editItem = screen
      .getAllByRole("menuitem")
      .find((mi) => mi.textContent?.includes("Edit context"));
    expect(editItem).toBeDefined();

    await user.click(editItem!);

    // ProjectContextSettings must now render with open=true and the project's id
    await waitFor(() => {
      expect(screen.getByTestId("project-context-settings")).toBeInTheDocument();
    });
    expect(screen.getByTestId("pcs-project-id")).toHaveTextContent("proj-h");

    const lastPCS =
      projectContextSettingsMock.mock.calls[
        projectContextSettingsMock.mock.calls.length - 1
      ]?.[0];
    expect(lastPCS).toMatchObject({
      projectId: "proj-h",
      open: true,
    });
    expect(typeof lastPCS.onOpenChange).toBe("function");

    // Crucial: the workspace SettingsDialog MUST stay closed
    expect(screen.queryByTestId("settings-dialog")).not.toBeInTheDocument();

    // Last props snapshot of SettingsDialog must show open=false (separate state)
    const lastSD =
      settingsDialogMock.mock.calls[settingsDialogMock.mock.calls.length - 1]?.[0];
    expect(lastSD).toMatchObject({ open: false });

    // Dropdown should have closed (Radix closes on item select)
    await waitFor(() => {
      // After selection, the menuitems should no longer be in the accessibility tree
      expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    });
  });

  /**
   * AC-5: GIVEN Modal aus Header-Pfad ist offen
   * WHEN User schliesst das Modal (onOpenChange(false))
   * THEN ruft Slice 06's onOpenChange(false) auf und der Header-lokale
   *      Open-State wird auf false gesetzt; Re-Open zeigt Modal erneut.
   */
  it("AC-5: onOpenChange(false) from settings modal resets header local open state", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHeader project={baseProject} />);

    // Open the kebab and click Edit context
    const kebabBtn = screen.getByRole("button", { name: /project actions/i });
    await user.click(kebabBtn);

    await waitFor(() => {
      expect(screen.getByText("Edit context")).toBeInTheDocument();
    });

    const editItem = screen
      .getAllByRole("menuitem")
      .find((mi) => mi.textContent?.includes("Edit context"));
    await user.click(editItem!);

    // Modal should be open
    await waitFor(() => {
      expect(screen.getByTestId("project-context-settings")).toBeInTheDocument();
    });

    // Close via the modal's onOpenChange(false) callback
    await user.click(screen.getByTestId("pcs-close"));

    // Modal should disappear
    await waitFor(() => {
      expect(
        screen.queryByTestId("project-context-settings")
      ).not.toBeInTheDocument();
    });

    // Re-open path: open kebab, click Edit context again -> Modal must reappear
    await user.click(kebabBtn);
    await waitFor(() => {
      expect(screen.getByText("Edit context")).toBeInTheDocument();
    });
    const editItem2 = screen
      .getAllByRole("menuitem")
      .find((mi) => mi.textContent?.includes("Edit context"));
    await user.click(editItem2!);

    await waitFor(() => {
      expect(screen.getByTestId("project-context-settings")).toBeInTheDocument();
    });

    // The fresh modal must again receive the correct projectId in its props
    const latest =
      projectContextSettingsMock.mock.calls[
        projectContextSettingsMock.mock.calls.length - 1
      ]?.[0];
    expect(latest).toMatchObject({
      projectId: "proj-h",
      open: true,
    });
  });

  /**
   * Adversarial / Interaction Test:
   * AC-4 + Constraint "KEINE Aenderung am bestehenden <SettingsDialog>":
   * The workspace-settings gear button (separate from Edit context) MUST still
   * open the workspace SettingsDialog without affecting ProjectContextSettings,
   * proving both modals are independently mounted and controlled.
   */
  it("AC-4 (adversarial): clicking gear button opens SettingsDialog without opening ProjectContextSettings", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHeader project={baseProject} />);

    // Click the gear "Open settings" button
    const gearBtn = screen.getByRole("button", { name: /open settings/i });
    await user.click(gearBtn);

    // SettingsDialog should now be open
    await waitFor(() => {
      expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
    });

    // ProjectContextSettings must NOT be open (separate state)
    expect(
      screen.queryByTestId("project-context-settings")
    ).not.toBeInTheDocument();

    const lastPCS =
      projectContextSettingsMock.mock.calls[
        projectContextSettingsMock.mock.calls.length - 1
      ]?.[0];
    expect(lastPCS).toMatchObject({ open: false });
  });
});
