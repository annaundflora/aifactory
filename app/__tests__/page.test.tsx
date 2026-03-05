// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Mock server actions
const mockCreateProject = vi.fn();
const mockRenameProject = vi.fn();
const mockDeleteProject = vi.fn();

vi.mock("@/app/actions/projects", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  renameProject: (...args: unknown[]) => mockRenameProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
}));

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
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

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

// Mock ConfirmDialog
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p data-testid="dialog-title">{title}</p>
        <p data-testid="dialog-description">{description}</p>
        <button data-testid="dialog-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="dialog-confirm" onClick={onConfirm}>
          {confirmLabel || "Delete"}
        </button>
      </div>
    ) : null,
}));

// Import the client component (not the server component page.tsx)
import { ProjectList } from "@/components/project-list";

const makeProject = (
  id: string,
  name: string,
  date: string = "2026-01-15"
) => ({
  id,
  name,
  createdAt: new Date(date),
  updatedAt: new Date(date),
});

describe("Root Page (/) - ProjectList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateProject.mockResolvedValue({
      id: "new-1",
      name: "My Design",
      createdAt: new Date(),
    });
    mockRenameProject.mockResolvedValue({
      id: "proj-1",
      name: "Renamed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDeleteProject.mockResolvedValue({ success: true });
  });

  /**
   * AC-1: GIVEN keine Projekte in der DB
   * WHEN die Root-Seite `/` geladen wird
   * THEN wird ein Empty State angezeigt mit Text "Create your first project"
   * und einem prominenten New-Project-Button
   */
  it('AC-1: should render empty state with "Create your first project" and New Project button when no projects exist', () => {
    render(<ProjectList projects={[]} />);

    expect(screen.getByText("Create your first project")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new project/i })
    ).toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN 3 Projekte existieren in der DB
   * WHEN die Root-Seite `/` geladen wird
   * THEN werden 3 Project-Cards in einem responsiven Grid angezeigt
   */
  it("AC-2: should render project cards for all projects", () => {
    const projects = [
      makeProject("p1", "Project Alpha"),
      makeProject("p2", "Project Beta"),
      makeProject("p3", "Project Gamma"),
    ];

    render(<ProjectList projects={projects} />);

    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();
  });

  /**
   * AC-3: GIVEN die Root-Seite ist geladen
   * WHEN der User auf den [+ New Project] Button klickt
   * THEN erscheint ein Inline-Input-Feld (auto-fokussiert) fuer den Projektnamen
   */
  it("AC-3: should show inline input when New Project button is clicked", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "Existing")];

    render(<ProjectList projects={projects} />);

    const newBtn = screen.getByRole("button", { name: /new project/i });
    await user.click(newBtn);

    const input = screen.getByPlaceholderText("Project name...");
    expect(input).toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN das Inline-Input ist sichtbar und der User hat "My Design" eingegeben
   * WHEN der User Enter drueckt
   * THEN wird createProject({ name: "My Design" }) aufgerufen
   * und eine neue Card erscheint im Grid
   */
  it('AC-4: should call createProject on Enter with "My Design"', async () => {
    const user = userEvent.setup();

    render(<ProjectList projects={[]} />);

    // In empty state, click the new project button
    const newBtn = screen.getByRole("button", { name: /new project/i });
    await user.click(newBtn);

    const input = screen.getByPlaceholderText("Project name...");
    await user.type(input, "My Design");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({ name: "My Design" });
    });
  });

  /**
   * AC-5: GIVEN das Inline-Input ist sichtbar und leer
   * WHEN der User Escape drueckt oder ausserhalb klickt (Blur)
   * THEN wird das Input-Feld ausgeblendet ohne ein Projekt zu erstellen
   */
  it("AC-5: should hide input on Escape without creating project", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "Existing")];

    render(<ProjectList projects={projects} />);

    const newBtn = screen.getByRole("button", { name: /new project/i });
    await user.click(newBtn);

    const input = screen.getByPlaceholderText("Project name...");
    expect(input).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByPlaceholderText("Project name...")
    ).not.toBeInTheDocument();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("AC-5: should hide input on blur when empty without creating project", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "Existing")];

    render(<ProjectList projects={projects} />);

    const newBtn = screen.getByRole("button", { name: /new project/i });
    await user.click(newBtn);

    const input = screen.getByPlaceholderText("Project name...");
    expect(input).toBeInTheDocument();

    // Blur by clicking elsewhere (tab away)
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Project name...")
      ).not.toBeInTheDocument();
    });
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  /**
   * AC-10: GIVEN der ConfirmDialog ist offen
   * WHEN der User auf den destruktiven "Delete" Button klickt
   * THEN wird deleteProject({ id }) aufgerufen, der Dialog schliesst sich,
   * und die Card verschwindet aus dem Grid
   */
  it("AC-10: should call deleteProject and refresh after ConfirmDialog confirm", async () => {
    const user = userEvent.setup();
    const projects = [makeProject("p1", "To Delete")];

    render(<ProjectList projects={projects} />);

    // Open delete dialog by clicking delete button on the card
    const deleteBtn = screen.getByRole("button", { name: /delete project/i });
    await user.click(deleteBtn);

    // Confirm dialog should be open
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    // Click confirm
    const confirmBtn = screen.getByTestId("dialog-confirm");
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith({ id: "p1" });
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  /**
   * AC-13: GIVEN die createProject Server Action gibt { error: "..." } zurueck
   * WHEN der User ein Projekt erstellen wollte
   * THEN wird ein Toast mit der Fehlermeldung angezeigt
   */
  it("AC-13: should show toast when createProject returns error", async () => {
    mockCreateProject.mockResolvedValue({
      error: "Projektname darf nicht leer sein",
    });

    const user = userEvent.setup();

    render(<ProjectList projects={[]} />);

    const newBtn = screen.getByRole("button", { name: /new project/i });
    await user.click(newBtn);

    const input = screen.getByPlaceholderText("Project name...");
    await user.type(input, "Bad Name");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Projektname darf nicht leer sein"
      );
    });
  });
});
