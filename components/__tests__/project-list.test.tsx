// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock window.matchMedia (used by use-mobile hook inside SidebarProvider)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

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

// Import AFTER mocks
import { ProjectList } from "@/components/project-list";
import { SidebarProvider } from "@/components/ui/sidebar";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectList", () => {
  /**
   * AC-9: GIVEN `ProjectList` wird mit einer Liste von Projekten und einer aktiven Projekt-ID gerendert
   * WHEN die Component dargestellt wird
   * THEN werden alle Projekte als anklickbare Links gerendert und das aktive Projekt ist visuell hervorgehoben
   */
  it("AC-9: should render all projects as links and highlight the active project", () => {
    const projects = [
      makeProject("proj-a", "Project Alpha"),
      makeProject("proj-b", "Project Beta"),
      makeProject("proj-c", "Project Gamma"),
    ];

    render(
      <SidebarProvider>
        <ProjectList projects={projects} activeProjectId="proj-b" />
      </SidebarProvider>
    );

    // All projects should be rendered
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();

    // All projects should be clickable links
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    // Links should point to correct routes
    expect(links[0]).toHaveAttribute("href", "/projects/proj-a");
    expect(links[1]).toHaveAttribute("href", "/projects/proj-b");
    expect(links[2]).toHaveAttribute("href", "/projects/proj-c");

    // Active project (Beta) should have visual highlight via data-active="true" on the link
    const betaLink = screen.getByText("Project Beta");
    const betaAnchor = betaLink.closest("a");
    expect(betaAnchor).toHaveAttribute("data-active", "true");

    // Inactive projects should NOT have data-active="true"
    const alphaAnchor = screen.getByText("Project Alpha").closest("a");
    const gammaAnchor = screen.getByText("Project Gamma").closest("a");
    expect(alphaAnchor).not.toHaveAttribute("data-active", "true");
    expect(gammaAnchor).not.toHaveAttribute("data-active", "true");
  });

  /**
   * AC-9 edge case: Empty project list should render empty list container
   */
  it("AC-9: should render empty list when no projects provided", () => {
    render(
      <SidebarProvider>
        <ProjectList projects={[]} />
      </SidebarProvider>
    );

    const list = screen.getByTestId("sidebar-project-list");
    expect(list).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  /**
   * AC-9 edge case: No activeProjectId means no project is highlighted
   */
  it("AC-9: should not highlight any project when no activeProjectId provided", () => {
    const projects = [
      makeProject("proj-a", "Project Alpha"),
      makeProject("proj-b", "Project Beta"),
    ];

    render(
      <SidebarProvider>
        <ProjectList projects={projects} />
      </SidebarProvider>
    );

    // No project should be bold
    expect(screen.getByText("Project Alpha")).not.toHaveClass("font-bold");
    expect(screen.getByText("Project Beta")).not.toHaveClass("font-bold");
  });
});
