// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProjectCard } from "@/components/project-card";

// Mock next/link to render as a plain anchor
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

// Mock ConfirmDialog to a simpler testable version
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

const baseProject = {
  id: "proj-1",
  name: "Test Project",
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
};

describe("ProjectCard", () => {
  let onRename: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRename = vi.fn().mockResolvedValue(undefined);
    onDelete = vi.fn().mockResolvedValue(undefined);
  });

  /**
   * AC-2: GIVEN 3 Projekte existieren in der DB
   * WHEN die Root-Seite `/` geladen wird
   * THEN werden 3 Project-Cards in einem responsiven Grid angezeigt,
   * jede mit Projektname, Generation-Count, Erstelldatum und Thumbnail-Bereich
   */
  it("AC-2: should render project name, generation count, date, and thumbnail area", () => {
    render(
      <ProjectCard
        project={baseProject}
        generationCount={5}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Project name
    expect(screen.getByText("Test Project")).toBeInTheDocument();

    // Generation count
    expect(screen.getByText("5 images")).toBeInTheDocument();

    // Date (de-DE format)
    expect(screen.getByText("15.01.2026")).toBeInTheDocument();

    // Thumbnail area (contains an image icon placeholder)
    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN eine Project-Card wird angezeigt
   * WHEN der User auf die Card klickt (nicht auf Rename/Delete Icons)
   * THEN wird zur Route `/projects/{id}` navigiert
   */
  it("AC-6: should link to /projects/{id} on card click", () => {
    render(
      <ProjectCard
        project={baseProject}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/projects/proj-1");
  });

  /**
   * AC-7: GIVEN eine Project-Card wird angezeigt
   * WHEN der User auf das Rename-Icon (Stift) klickt
   * THEN wird der Projektname zu einem editierbaren Inline-Input (auto-fokussiert, Wert vorausgefuellt)
   */
  it("AC-7: should switch to inline input when rename icon is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={baseProject}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Click rename button
    const renameBtn = screen.getByRole("button", { name: /rename project/i });
    await user.click(renameBtn);

    // Input should appear with pre-filled value
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Test Project");
  });

  /**
   * AC-8: GIVEN der Rename-Input ist aktiv mit neuem Wert "Renamed Project"
   * WHEN der User Enter drueckt oder der Input den Fokus verliert (Blur)
   * THEN wird `renameProject({ id, name: "Renamed Project" })` aufgerufen
   * und die Card zeigt den aktualisierten Namen
   */
  it("AC-8: should call onRename on Enter with new name", async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={baseProject}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Activate rename
    const renameBtn = screen.getByRole("button", { name: /rename project/i });
    await user.click(renameBtn);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Renamed Project");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("proj-1", "Renamed Project");
    });
  });

  it("AC-8: should call onRename on blur with new name", async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={baseProject}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    const renameBtn = screen.getByRole("button", { name: /rename project/i });
    await user.click(renameBtn);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Renamed Project");

    // Blur by tabbing away
    await user.tab();

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("proj-1", "Renamed Project");
    });
  });

  /**
   * AC-9: GIVEN eine Project-Card wird angezeigt
   * WHEN der User auf das Delete-Icon (Papierkorb) klickt
   * THEN oeffnet sich ein ConfirmDialog mit Titel "Delete Project?"
   * und Beschreibung "This will permanently delete "{name}" and all N generations."
   */
  it("AC-9: should open ConfirmDialog when delete icon is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={baseProject}
        generationCount={3}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Dialog should not be visible initially
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    // Click delete button
    const deleteBtn = screen.getByRole("button", { name: /delete project/i });
    await user.click(deleteBtn);

    // Dialog should appear with correct content
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Delete Project?"
    );
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      'This will permanently delete "Test Project" and all 3 generations.'
    );
  });

  /**
   * AC-12: GIVEN ein Projekt hat 0 Generierungen
   * WHEN die Card angezeigt wird
   * THEN zeigt der Thumbnail-Bereich einen Placeholder (kein Bild),
   * der Count zeigt "0 images"
   */
  it("AC-12: should show placeholder and '0 images' when generation count is 0", () => {
    render(
      <ProjectCard
        project={baseProject}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Count text
    expect(screen.getByText("0 images")).toBeInTheDocument();

    // Thumbnail area with placeholder (ImageIcon from lucide renders an SVG)
    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
    // Should contain an SVG icon as placeholder, not an <img>
    expect(thumbnailArea?.querySelector("img")).toBeNull();
    expect(thumbnailArea?.querySelector("svg")).toBeInTheDocument();
  });
});
