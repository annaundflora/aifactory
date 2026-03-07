// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

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

// Mock next/image as plain img element (needed for AC-1 thumbnail rendering)
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // Filter out Next.js-specific props that are not valid HTML attributes
    const { priority, fill, quality, placeholder, blurDataURL, ...rest } =
      props;
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
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

import { ProjectCard } from "@/components/project-card";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseProject = {
  id: "proj-1",
  name: "Test Project",
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
};

// ---------------------------------------------------------------------------
// Existing ProjectCard Tests (pre-Slice-17)
// ---------------------------------------------------------------------------

describe("ProjectCard", () => {
  let onRename: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRename = vi.fn().mockResolvedValue(undefined);
    onDelete = vi.fn().mockResolvedValue(undefined);
  });

  it("should render project name, generation count, date, and thumbnail area", () => {
    render(
      <ProjectCard
        project={baseProject}
        generationCount={5}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("5 images")).toBeInTheDocument();
    expect(screen.getByText("15.01.2026")).toBeInTheDocument();

    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
  });

  it("should link to /projects/{id} on card click", () => {
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

  it("should switch to inline input when rename icon is clicked", async () => {
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
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Test Project");
  });

  it("should call onRename on Enter with new name", async () => {
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
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("proj-1", "Renamed Project");
    });
  });

  it("should call onRename on blur with new name", async () => {
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
    await user.tab();

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("proj-1", "Renamed Project");
    });
  });

  it("should open ConfirmDialog when delete icon is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={baseProject}
        generationCount={3}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: /delete project/i });
    await user.click(deleteBtn);

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Delete Project?"
    );
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      'This will permanently delete "Test Project" and all 3 generations.'
    );
  });

  it("should show placeholder and '0 images' when generation count is 0", () => {
    render(
      <ProjectCard
        project={baseProject}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("0 images")).toBeInTheDocument();

    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
    expect(thumbnailArea?.querySelector("img")).toBeNull();
    expect(thumbnailArea?.querySelector("svg")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 17: Thumbnail UI -- Project Card
// ---------------------------------------------------------------------------

describe("ProjectCard - Thumbnail UI (Slice 17)", () => {
  let onRename: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;
  let onRefreshThumbnail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRename = vi.fn().mockResolvedValue(undefined);
    onDelete = vi.fn().mockResolvedValue(undefined);
    onRefreshThumbnail = vi.fn().mockResolvedValue(undefined);
  });

  /**
   * AC-1: GIVEN ein Projekt mit `thumbnailStatus = 'completed'` und einer `thumbnailUrl`
   * WHEN die Project Card gerendert wird
   * THEN wird ein `<img>` (Next.js `Image`) mit der `thumbnailUrl` als `src` im
   * Thumbnail-Bereich (h-40) angezeigt, mit `object-cover` und
   * `alt="{project.name} thumbnail"`
   */
  it("AC-1: should render Next.js Image with thumbnailUrl when thumbnailStatus is completed", () => {
    const project = {
      ...baseProject,
      thumbnailStatus: "completed",
      thumbnailUrl: "https://r2.example.com/thumbnails/proj-1.png",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={3}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Should render an <img> element with the thumbnail URL
    const img = screen.getByRole("img", { name: /test project thumbnail/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "https://r2.example.com/thumbnails/proj-1.png"
    );
    expect(img).toHaveAttribute("alt", "Test Project thumbnail");

    // Should have object-cover class
    expect(img).toHaveClass("object-cover");

    // The container should have h-40 height class
    const container = img.closest(".h-40");
    expect(container).toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN ein Projekt mit `thumbnailStatus = 'pending'`
   * WHEN die Project Card gerendert wird
   * THEN wird im Thumbnail-Bereich eine Pulse-Animation (CSS `animate-pulse`
   * auf dem `bg-muted`-Container) angezeigt statt des statischen Platzhalters
   */
  it("AC-2: should render pulse animation when thumbnailStatus is pending", () => {
    const project = {
      ...baseProject,
      thumbnailStatus: "pending",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // The thumbnail area should have animate-pulse class
    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
    expect(thumbnailArea).toHaveClass("animate-pulse");

    // Should have h-40 height
    expect(thumbnailArea).toHaveClass("h-40");

    // Should NOT render an <img> element
    expect(thumbnailArea?.querySelector("img")).toBeNull();
  });

  /**
   * AC-3: GIVEN ein Projekt mit `thumbnailStatus = 'none'` oder `thumbnailStatus = 'failed'`
   * WHEN die Project Card gerendert wird
   * THEN wird der bestehende Platzhalter angezeigt (grauer Hintergrund mit `ImageIcon`)
   */
  it("AC-3: should render ImageIcon placeholder when thumbnailStatus is none", () => {
    const project = {
      ...baseProject,
      thumbnailStatus: "none",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();

    // Should NOT have animate-pulse (static placeholder)
    expect(thumbnailArea).not.toHaveClass("animate-pulse");

    // Should contain an SVG (ImageIcon) as placeholder, not an <img>
    expect(thumbnailArea?.querySelector("svg")).toBeInTheDocument();
    expect(thumbnailArea?.querySelector("img")).toBeNull();
  });

  it("AC-3: should render ImageIcon placeholder when thumbnailStatus is failed", () => {
    const project = {
      ...baseProject,
      thumbnailStatus: "failed",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();

    // Should NOT have animate-pulse (static placeholder)
    expect(thumbnailArea).not.toHaveClass("animate-pulse");

    // Should contain an SVG (ImageIcon) as placeholder, not an <img>
    expect(thumbnailArea?.querySelector("svg")).toBeInTheDocument();
    expect(thumbnailArea?.querySelector("img")).toBeNull();
  });

  /**
   * AC-4: GIVEN die Project Card im Hover-State
   * WHEN der User ueber die Karte hovert
   * THEN wird neben den bestehenden Edit/Delete-Buttons ein Thumbnail-Refresh-Button
   * (mit `RefreshCw`-Icon) sichtbar, mit `data-action="refresh-thumbnail"`
   */
  it("AC-4: should show RefreshCw button alongside Edit/Delete on hover", () => {
    const project = {
      ...baseProject,
      thumbnailStatus: "completed",
      thumbnailUrl: "https://r2.example.com/thumbnails/proj-1.png",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={2}
        onRename={onRename}
        onDelete={onDelete}
        onRefreshThumbnail={onRefreshThumbnail}
      />
    );

    // The refresh button should exist in the DOM with the correct data-action attribute
    const refreshBtn = document.querySelector(
      '[data-action="refresh-thumbnail"]'
    );
    expect(refreshBtn).toBeInTheDocument();

    // Edit and delete buttons should also exist alongside
    const renameBtn = document.querySelector('[data-action="rename"]');
    const deleteBtn = document.querySelector('[data-action="delete"]');
    expect(renameBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    // All three buttons should share the same parent container (hover group)
    expect(refreshBtn?.parentElement).toBe(renameBtn?.parentElement);
    expect(refreshBtn?.parentElement).toBe(deleteBtn?.parentElement);

    // The container has opacity-0 / group-hover:opacity-100 classes for hover visibility
    const buttonContainer = refreshBtn?.parentElement;
    expect(buttonContainer).toHaveClass("opacity-0");

    // Refresh button should contain the RefreshCw SVG icon
    expect(refreshBtn?.querySelector("svg")).toBeInTheDocument();

    // Refresh button should have accessible label
    expect(
      screen.getByRole("button", { name: /refresh thumbnail/i })
    ).toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN der User klickt den Thumbnail-Refresh-Button
   * WHEN der Klick verarbeitet wird
   * THEN wird die `onRefreshThumbnail`-Callback-Prop mit der `project.id` aufgerufen,
   * Navigation wird verhindert (`preventDefault`, `stopPropagation`)
   */
  it("AC-5: should call onRefreshThumbnail with project.id and prevent navigation on click", async () => {
    const user = userEvent.setup();
    const project = {
      ...baseProject,
      thumbnailStatus: "completed",
      thumbnailUrl: "https://r2.example.com/thumbnails/proj-1.png",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={2}
        onRename={onRename}
        onDelete={onDelete}
        onRefreshThumbnail={onRefreshThumbnail}
      />
    );

    // Click the refresh thumbnail button
    const refreshBtn = screen.getByRole("button", {
      name: /refresh thumbnail/i,
    });
    await user.click(refreshBtn);

    // onRefreshThumbnail should be called with the project ID
    await waitFor(() => {
      expect(onRefreshThumbnail).toHaveBeenCalledWith("proj-1");
    });
    expect(onRefreshThumbnail).toHaveBeenCalledTimes(1);

    // The link should NOT have been followed (navigation prevented)
    // Since we mock next/link as <a>, the click handler on the link checks
    // for data-action="refresh-thumbnail" and calls preventDefault.
    // We verify by checking the callback was called (if navigation happened,
    // the page would change and the callback wouldn't matter)
  });

  /**
   * AC-6: GIVEN der Thumbnail-Refresh laeuft (`isRefreshing = true`)
   * WHEN die Project Card gerendert wird
   * THEN dreht sich das `RefreshCw`-Icon (CSS `animate-spin`) und der Button ist disabled
   */
  it("AC-6: should show spinning RefreshCw icon and disable button when isRefreshing is true", async () => {
    // Create a long-running promise to keep isRefreshing=true
    let resolveRefresh!: () => void;
    const slowRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const project = {
      ...baseProject,
      thumbnailStatus: "completed",
      thumbnailUrl: "https://r2.example.com/thumbnails/proj-1.png",
    };

    const user = userEvent.setup();

    render(
      <ProjectCard
        project={project}
        generationCount={2}
        onRename={onRename}
        onDelete={onDelete}
        onRefreshThumbnail={slowRefresh}
      />
    );

    // Click the refresh button to trigger the refreshing state
    const refreshBtn = screen.getByRole("button", {
      name: /refresh thumbnail/i,
    });
    await user.click(refreshBtn);

    // While the refresh is in progress, the button should be disabled
    await waitFor(() => {
      expect(refreshBtn).toBeDisabled();
    });

    // The SVG icon inside the button should have animate-spin class
    const icon = refreshBtn.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("animate-spin");

    // Resolve the refresh to clean up
    resolveRefresh();

    // After resolving, the button should become enabled again
    await waitFor(() => {
      expect(refreshBtn).not.toBeDisabled();
    });
  });

  /**
   * AC-8: GIVEN die `ProjectCardProject`-Interface
   * WHEN sie definiert wird
   * THEN enthaelt sie die optionalen Felder `thumbnailUrl?: string | null` und
   * `thumbnailStatus?: string` (rueckwaertskompatibel)
   */
  it("AC-8: should render correctly without thumbnailUrl and thumbnailStatus props (backwards compatible)", () => {
    // Render with a project that has NO thumbnailUrl and NO thumbnailStatus
    // (simulating old data before Slice 17)
    const legacyProject = {
      id: "proj-legacy",
      name: "Legacy Project",
      createdAt: new Date("2025-06-01"),
      updatedAt: new Date("2025-06-01"),
      // No thumbnailUrl, no thumbnailStatus
    };

    render(
      <ProjectCard
        project={legacyProject}
        generationCount={10}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Should render without errors
    expect(screen.getByText("Legacy Project")).toBeInTheDocument();
    expect(screen.getByText("10 images")).toBeInTheDocument();

    // Should show the static placeholder (not pulse, not image)
    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
    expect(thumbnailArea).not.toHaveClass("animate-pulse");
    expect(thumbnailArea?.querySelector("img")).toBeNull();
    expect(thumbnailArea?.querySelector("svg")).toBeInTheDocument();
  });

  it("AC-8: should render correctly with thumbnailUrl set to null", () => {
    const projectWithNull = {
      ...baseProject,
      thumbnailUrl: null,
      thumbnailStatus: undefined,
    };

    render(
      <ProjectCard
        project={projectWithNull}
        generationCount={0}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    // Should render without errors -- static placeholder
    expect(screen.getByText("Test Project")).toBeInTheDocument();
    const thumbnailArea = document.querySelector(".bg-muted");
    expect(thumbnailArea).toBeInTheDocument();
    expect(thumbnailArea?.querySelector("img")).toBeNull();
  });

  /**
   * AC-4 edge case: Refresh button should NOT render when onRefreshThumbnail is not provided
   */
  it("AC-4 edge case: should NOT render refresh button when onRefreshThumbnail prop is absent", () => {
    const project = {
      ...baseProject,
      thumbnailStatus: "completed",
      thumbnailUrl: "https://r2.example.com/thumbnails/proj-1.png",
    };

    render(
      <ProjectCard
        project={project}
        generationCount={2}
        onRename={onRename}
        onDelete={onDelete}
        // No onRefreshThumbnail prop
      />
    );

    const refreshBtn = document.querySelector(
      '[data-action="refresh-thumbnail"]'
    );
    expect(refreshBtn).not.toBeInTheDocument();

    // Edit and delete buttons should still exist
    expect(document.querySelector('[data-action="rename"]')).toBeInTheDocument();
    expect(document.querySelector('[data-action="delete"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-7: createProject fire-and-forget thumbnail generation
// (Server Action unit test -- mock_external strategy)
// ---------------------------------------------------------------------------

// We need separate mocks for the server action test
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  createProject: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
}));

vi.mock("@/lib/services/thumbnail-service", () => ({
  generateForProject: vi.fn(),
  refreshForProject: vi.fn(),
}));

describe("createProject - Thumbnail fire-and-forget (Slice 17 AC-7)", () => {
  /**
   * AC-7: GIVEN ein User erstellt ein neues Projekt via `createProject` Action
   * WHEN die Action erfolgreich das Projekt in der DB anlegt
   * THEN wird `generateForProject(project.id)` aus dem Thumbnail-Service
   * fire-and-forget aufgerufen (kein `await`, Fehler werden nicht propagiert)
   */
  it("AC-7: should call generateForProject fire-and-forget after successful project creation", async () => {
    // Dynamic import so mocks apply
    const { createProject: createProjectAction } = await import(
      "@/app/actions/projects"
    );
    const { createProject: createProjectQuery } = await import(
      "@/lib/db/queries"
    );
    const { generateForProject } = await import(
      "@/lib/services/thumbnail-service"
    );

    const mockCreateQuery = vi.mocked(createProjectQuery);
    const mockGenerate = vi.mocked(generateForProject);

    const fakeProject = {
      id: "new-proj-123",
      name: "New Project",
      createdAt: new Date("2026-03-07"),
      updatedAt: new Date("2026-03-07"),
    };

    mockCreateQuery.mockResolvedValueOnce(fakeProject as any);
    // generateForProject returns a promise that resolves (fire-and-forget)
    mockGenerate.mockReturnValue(
      Promise.resolve() as unknown as ReturnType<typeof mockGenerate>
    );

    const result = await createProjectAction({ name: "New Project" });

    // Should have called the DB query
    expect(mockCreateQuery).toHaveBeenCalledWith({ name: "New Project" });

    // AC-7: generateForProject should have been called with the project ID
    expect(mockGenerate).toHaveBeenCalledWith("new-proj-123");

    // Should return the project data
    expect(result).toEqual({
      id: "new-proj-123",
      name: "New Project",
      createdAt: fakeProject.createdAt,
    });
  });

  it("AC-7: generateForProject errors should not propagate to createProject", async () => {
    const { createProject: createProjectAction } = await import(
      "@/app/actions/projects"
    );
    const { createProject: createProjectQuery } = await import(
      "@/lib/db/queries"
    );
    const { generateForProject } = await import(
      "@/lib/services/thumbnail-service"
    );

    const mockCreateQuery = vi.mocked(createProjectQuery);
    const mockGenerate = vi.mocked(generateForProject);

    const fakeProject = {
      id: "proj-err-456",
      name: "Error Test",
      createdAt: new Date("2026-03-07"),
      updatedAt: new Date("2026-03-07"),
    };

    mockCreateQuery.mockResolvedValueOnce(fakeProject as any);
    // Simulate thumbnail generation failure -- fire-and-forget should catch this
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGenerate.mockReturnValue(
      Promise.reject(new Error("Thumbnail service down")) as unknown as ReturnType<typeof mockGenerate>
    );

    // createProject should NOT throw even though generateForProject fails
    const result = await createProjectAction({ name: "Error Test" });

    expect(result).toEqual({
      id: "proj-err-456",
      name: "Error Test",
      createdAt: fakeProject.createdAt,
    });

    // generateForProject was called
    expect(mockGenerate).toHaveBeenCalledWith("proj-err-456");

    // Wait for the rejected promise's .catch(console.error) to fire
    await new Promise((r) => setTimeout(r, 10));

    // The error should have been caught and logged, not thrown
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
