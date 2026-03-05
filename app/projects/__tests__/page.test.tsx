// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/projects/proj-b",
}));

// Mock server actions
const mockGetProject = vi.fn();
const mockGetProjects = vi.fn();
const mockCreateProject = vi.fn();

vi.mock("@/app/actions/projects", () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
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

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock lucide-react icons to simple spans
vi.mock("lucide-react", () => ({
  ArrowLeft: (props: Record<string, unknown>) => <span data-testid="arrow-left-icon" {...props} />,
  Plus: (props: Record<string, unknown>) => <span data-testid="plus-icon" {...props} />,
}));

// Import AFTER mocks are set up
import WorkspacePage from "@/app/projects/[id]/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeProject = (id: string, name: string) => ({
  id,
  name,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
});

const allProjects = [
  makeProject("proj-a", "Project Alpha"),
  makeProject("proj-b", "Project Beta"),
  makeProject("proj-c", "Project Gamma"),
];

/**
 * Helper to render async server component.
 * Next.js server components are async functions that return JSX.
 */
async function renderServerComponent(id: string) {
  const params = Promise.resolve({ id });
  const jsx = await WorkspacePage({ params });
  return render(jsx);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Workspace Page (/projects/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue(allProjects);
  });

  /**
   * AC-1: GIVEN die Route `/projects/{id}` wird mit einer gueltigen Projekt-ID aufgerufen
   * WHEN die Seite geladen wird
   * THEN wird der Projektname als Ueberschrift im Main-Bereich angezeigt und die Sidebar ist links sichtbar
   */
  it("AC-1: should render project name and sidebar for valid project ID", async () => {
    mockGetProject.mockResolvedValue(makeProject("proj-b", "Project Beta"));

    await renderServerComponent("proj-b");

    // Project name as heading in main area
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Project Beta");

    // Sidebar is visible (contains the project list)
    expect(screen.getByText("Projects")).toBeInTheDocument();
    // All projects listed in sidebar
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN die Route `/projects/{id}` wird mit einer nicht existierenden ID aufgerufen
   * WHEN die Seite geladen wird
   * THEN wird `notFound()` ausgeloest (Next.js 404-Seite)
   */
  it("AC-2: should call notFound() for non-existent project ID", async () => {
    mockGetProject.mockResolvedValue({ error: "Project not found" });

    try {
      await renderServerComponent("non-existent-id");
    } catch {
      // notFound() may throw in test environment
    }

    expect(mockNotFound).toHaveBeenCalled();
  });

  /**
   * AC-8: GIVEN die Workspace-Seite ist geladen
   * WHEN der Main-Bereich gerendert wird
   * THEN zeigt er einen Platzhalter-Bereich fuer zukuenftige Workspace-Inhalte (Prompt Area, Gallery) mit dem Projektnamen
   */
  it("AC-8: should render placeholder area with project name for future workspace content", async () => {
    mockGetProject.mockResolvedValue(makeProject("proj-b", "Project Beta"));

    await renderServerComponent("proj-b");

    // Placeholder text mentioning project name
    const workspaceText = screen.getByText(/Workspace for/i);
    expect(workspaceText).toBeInTheDocument();
    // The project name appears inside the "Workspace for" paragraph
    expect(workspaceText.textContent).toContain("Project Beta");

    // Placeholder mentions future content areas
    expect(
      screen.getByText(/prompt area.*parameter panel.*gallery/i)
    ).toBeInTheDocument();
  });
});
