// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
      <ProjectList projects={projects} activeProjectId="proj-b" />
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

    // Active project (Beta) should have visual highlight (font-bold)
    const betaLink = screen.getByText("Project Beta");
    expect(betaLink).toHaveClass("font-bold");

    // Inactive projects should NOT be bold
    expect(screen.getByText("Project Alpha")).not.toHaveClass("font-bold");
    expect(screen.getByText("Project Gamma")).not.toHaveClass("font-bold");
  });

  /**
   * AC-9 edge case: Empty project list should render empty list container
   */
  it("AC-9: should render empty list when no projects provided", () => {
    render(<ProjectList projects={[]} />);

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

    render(<ProjectList projects={projects} />);

    // No project should be bold
    expect(screen.getByText("Project Alpha")).not.toHaveClass("font-bold");
    expect(screen.getByText("Project Beta")).not.toHaveClass("font-bold");
  });
});
