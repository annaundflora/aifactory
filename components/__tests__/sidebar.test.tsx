// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowLeft: (props: Record<string, unknown>) => (
    <span data-testid="arrow-left-icon" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="plus-icon" {...props} />
  ),
}));

// Import AFTER mocks
import { Sidebar } from "@/components/sidebar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeProject = (id: string, name: string) => ({
  id,
  name,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
});

const fourProjects = [
  makeProject("proj-a", "Project Alpha"),
  makeProject("proj-b", "Project Beta"),
  makeProject("proj-c", "Project Gamma"),
  makeProject("proj-d", "Project Delta"),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/projects/proj-b";
    mockCreateProject.mockResolvedValue({
      id: "new-proj-1",
      name: "Untitled Project",
      createdAt: new Date(),
    });
  });

  /**
   * AC-3: GIVEN 4 Projekte existieren und Projekt B ist aktiv (URL: `/projects/{id-b}`)
   * WHEN die Sidebar gerendert wird
   * THEN zeigt die `sidebar-project-list` alle 4 Projekte und Projekt B hat eine
   * visuelle Hervorhebung (aktive Background-Farbe oder `font-weight: bold`)
   */
  it("AC-3: should render all projects and highlight the active one", () => {
    render(<Sidebar projects={fourProjects} />);

    // All 4 projects should be visible
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();
    expect(screen.getByText("Project Delta")).toBeInTheDocument();

    // The sidebar-project-list data-testid should be present
    expect(screen.getByTestId("sidebar-project-list")).toBeInTheDocument();

    // Project Beta (active) should have font-bold class for visual highlight
    const betaLink = screen.getByText("Project Beta");
    expect(betaLink).toHaveClass("font-bold");

    // Other projects should NOT have font-bold
    expect(screen.getByText("Project Alpha")).not.toHaveClass("font-bold");
    expect(screen.getByText("Project Gamma")).not.toHaveClass("font-bold");
    expect(screen.getByText("Project Delta")).not.toHaveClass("font-bold");
  });

  /**
   * AC-4: GIVEN die Sidebar ist sichtbar
   * WHEN der User auf einen anderen Projektnamen in der Liste klickt
   * THEN wird zur Route `/projects/{andere-id}` navigiert
   */
  it("AC-4: should navigate to /projects/{id} when clicking another project", async () => {
    const user = userEvent.setup();
    render(<Sidebar projects={fourProjects} />);

    // Click on Project Gamma (not the active project)
    const gammaLink = screen.getByText("Project Gamma").closest("a");
    expect(gammaLink).toBeInTheDocument();
    expect(gammaLink).toHaveAttribute("href", "/projects/proj-c");

    // Simulate click to verify the link is clickable
    await user.click(gammaLink!);

    // The link has href="/projects/proj-c" - in real app Next.js Link handles navigation
    // We verify the link element has the correct href attribute
    expect(gammaLink).toHaveAttribute("href", "/projects/proj-c");
  });

  /**
   * AC-5: GIVEN die Sidebar ist sichtbar
   * WHEN der User auf den `[+ New]` Button in der Sidebar klickt
   * THEN wird die `createProject` Server Action mit einem Default-Namen aufgerufen
   * und anschliessend zur neuen Projekt-Route navigiert
   */
  it("AC-5: should call createProject and navigate to new project on new-project click", async () => {
    const user = userEvent.setup();
    render(<Sidebar projects={fourProjects} />);

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

    // Should also trigger refresh
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  /**
   * AC-5 error case: When createProject returns an error, toast should show
   */
  it("AC-5: should show toast error when createProject fails", async () => {
    mockCreateProject.mockResolvedValue({ error: "Creation failed" });

    const user = userEvent.setup();
    render(<Sidebar projects={fourProjects} />);

    const newProjectBtn = screen.getByTestId("sidebar-new-project");
    await user.click(newProjectBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Creation failed");
    });

    // Should NOT navigate on error
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * AC-6: GIVEN die Sidebar ist sichtbar
   * WHEN der User auf den "Zurueck zur Uebersicht" Link klickt
   * THEN wird zur Route `/` navigiert
   */
  it("AC-6: should navigate to / when clicking back-to-overview link", async () => {
    const user = userEvent.setup();
    render(<Sidebar projects={fourProjects} />);

    // Find the back-to-overview link
    const backLink = screen.getByTestId("sidebar-back-to-overview");
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/");

    // Simulate click to verify the link is interactive
    await user.click(backLink);

    // The link has href="/" - in real app Next.js Link handles navigation
    expect(backLink).toHaveAttribute("href", "/");
    expect(backLink).toHaveTextContent(/back to overview/i);
  });
});
