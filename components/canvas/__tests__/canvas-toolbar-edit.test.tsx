// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy — lucide icons, downloadImage, sonner)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  Copy: (props: Record<string, unknown>) => (
    <span data-testid="icon-copy" {...props} />
  ),
  ArrowRightLeft: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right-left" {...props} />
  ),
  ZoomIn: (props: Record<string, unknown>) => (
    <span data-testid="icon-zoom-in" {...props} />
  ),
  Download: (props: Record<string, unknown>) => (
    <span data-testid="icon-download" {...props} />
  ),
  Trash2: (props: Record<string, unknown>) => (
    <span data-testid="icon-trash2" {...props} />
  ),
  Info: (props: Record<string, unknown>) => (
    <span data-testid="icon-info" {...props} />
  ),
  PanelLeftIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-panel-left" {...props} />
  ),
  Paintbrush: (props: Record<string, unknown>) => (
    <span data-testid="icon-paintbrush" {...props} />
  ),
  Eraser: (props: Record<string, unknown>) => (
    <span data-testid="icon-eraser" {...props} />
  ),
  MousePointerClick: (props: Record<string, unknown>) => (
    <span data-testid="icon-mouse-pointer-click" {...props} />
  ),
  Expand: (props: Record<string, unknown>) => (
    <span data-testid="icon-expand" {...props} />
  ),
}));

// Mock downloadImage utility
const mockDownloadImage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadImage: (...args: unknown[]) => mockDownloadImage(...args),
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-toolbar-edit-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://r2.example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2025-06-15T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

/**
 * Spy component that captures the current editMode from context.
 */
function EditModeSpy({ onEditMode }: { onEditMode: (mode: string | null) => void }) {
  const { state } = useCanvasDetail();
  useEffect(() => {
    onEditMode(state.editMode);
  });
  return null;
}

function renderToolbarDefault(options?: {
  generation?: Generation;
  onDelete?: () => void;
  onEditMode?: (mode: string | null) => void;
}) {
  const generation = options?.generation ?? makeGeneration();
  const onDelete = options?.onDelete ?? vi.fn();
  const onEditMode = options?.onEditMode ?? vi.fn();

  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <EditModeSpy onEditMode={onEditMode} />
        <CanvasToolbar generation={generation} onDelete={onDelete} />
      </CanvasDetailProvider>
    ),
    onDelete,
    generation,
    onEditMode,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasToolbar — Edit Mode Buttons (Slice 07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-7: GIVEN die TOOLS-Array in `canvas-toolbar.tsx`
   *       WHEN die Toolbar gerendert wird
   *       THEN enthaelt sie 4 neue Eintraege: `brush-edit` (Label: "Brush Edit"),
   *            `erase` (Label: "Erase"), `click-edit` (Label: "Click Edit"),
   *            `expand` (Label: "Expand")
   *       AND alle 4 haben `toggle: true`
   */
  it('AC-7: should render brush-edit, erase, click-edit, and expand buttons with toggle true', () => {
    renderToolbarDefault();

    const toolbar = screen.getByTestId("canvas-toolbar");
    expect(toolbar).toBeInTheDocument();

    // Verify all 4 new edit buttons exist with correct test IDs
    const brushEditBtn = screen.getByTestId("toolbar-brush-edit");
    const eraseBtn = screen.getByTestId("toolbar-erase");
    const clickEditBtn = screen.getByTestId("toolbar-click-edit");
    const expandBtn = screen.getByTestId("toolbar-expand");

    expect(brushEditBtn).toBeInTheDocument();
    expect(eraseBtn).toBeInTheDocument();
    expect(clickEditBtn).toBeInTheDocument();
    expect(expandBtn).toBeInTheDocument();

    // Verify aria-labels match the tooltip/label
    expect(brushEditBtn).toHaveAttribute("aria-label", "Brush Edit");
    expect(eraseBtn).toHaveAttribute("aria-label", "Erase");
    expect(clickEditBtn).toHaveAttribute("aria-label", "Click Edit");
    expect(expandBtn).toHaveAttribute("aria-label", "Expand");

    // Verify all 4 have toggle behavior (aria-pressed attribute exists,
    // meaning the ToolbarButton renders them as toggle buttons)
    expect(brushEditBtn).toHaveAttribute("aria-pressed");
    expect(eraseBtn).toHaveAttribute("aria-pressed");
    expect(clickEditBtn).toHaveAttribute("aria-pressed");
    expect(expandBtn).toHaveAttribute("aria-pressed");

    // Initially none should be active
    expect(brushEditBtn).toHaveAttribute("aria-pressed", "false");
    expect(eraseBtn).toHaveAttribute("aria-pressed", "false");
    expect(clickEditBtn).toHaveAttribute("aria-pressed", "false");
    expect(expandBtn).toHaveAttribute("aria-pressed", "false");
  });

  it('AC-7 (order): edit buttons appear after generation tools and before action tools', () => {
    renderToolbarDefault();

    const toolbar = screen.getByTestId("canvas-toolbar");
    const allButtons = within(toolbar).getAllByRole("button");

    // Expected order: expand/collapse toggle, Variation, img2img, Upscale,
    // Brush Edit, Erase, Click Edit, Expand, Download, Delete, Details
    const labels = allButtons.map((btn) => btn.getAttribute("aria-label"));

    expect(labels).toEqual([
      "Expand toolbar",
      "Variation",
      "img2img",
      "Upscale",
      "Brush Edit",
      "Erase",
      "Click Edit",
      "Expand",
      "Download",
      "Delete",
      "Details",
    ]);
  });

  /**
   * AC-8: GIVEN der User klickt den `brush-edit` Button in der Toolbar
   *       WHEN der Toggle-Handler ausgefuehrt wird
   *       THEN wird `SET_EDIT_MODE` mit `"inpaint"` dispatched
   */
  it('AC-8: should dispatch SET_EDIT_MODE with inpaint when brush-edit toggled', async () => {
    const user = userEvent.setup();
    const editModeCaptures: (string | null)[] = [];

    renderToolbarDefault({
      onEditMode: (mode) => editModeCaptures.push(mode),
    });

    const brushEditBtn = screen.getByTestId("toolbar-brush-edit");

    // Initially not active
    expect(brushEditBtn).toHaveAttribute("aria-pressed", "false");

    // Click brush-edit button
    await user.click(brushEditBtn);

    // Button should now be active
    expect(brushEditBtn).toHaveAttribute("aria-pressed", "true");

    // editMode should have been set to "inpaint"
    const lastCapture = editModeCaptures[editModeCaptures.length - 1];
    expect(lastCapture).toBe("inpaint");
  });

  /**
   * AC-9: GIVEN der User klickt den `erase` Button in der Toolbar
   *       WHEN der Toggle-Handler ausgefuehrt wird
   *       THEN wird `SET_EDIT_MODE` mit `"erase"` dispatched
   */
  it('AC-9: should dispatch SET_EDIT_MODE with erase when erase toggled', async () => {
    const user = userEvent.setup();
    const editModeCaptures: (string | null)[] = [];

    renderToolbarDefault({
      onEditMode: (mode) => editModeCaptures.push(mode),
    });

    const eraseBtn = screen.getByTestId("toolbar-erase");

    // Initially not active
    expect(eraseBtn).toHaveAttribute("aria-pressed", "false");

    // Click erase button
    await user.click(eraseBtn);

    // Button should now be active
    expect(eraseBtn).toHaveAttribute("aria-pressed", "true");

    // editMode should have been set to "erase"
    const lastCapture = editModeCaptures[editModeCaptures.length - 1];
    expect(lastCapture).toBe("erase");
  });

  // ---------------------------------------------------------------------------
  // Additional edit-button tests for completeness
  // ---------------------------------------------------------------------------

  it('click-edit button should dispatch SET_EDIT_MODE with inpaint', async () => {
    const user = userEvent.setup();
    const editModeCaptures: (string | null)[] = [];

    renderToolbarDefault({
      onEditMode: (mode) => editModeCaptures.push(mode),
    });

    const clickEditBtn = screen.getByTestId("toolbar-click-edit");
    await user.click(clickEditBtn);

    expect(clickEditBtn).toHaveAttribute("aria-pressed", "true");

    const lastCapture = editModeCaptures[editModeCaptures.length - 1];
    expect(lastCapture).toBe("inpaint");
  });

  it('expand button should dispatch SET_EDIT_MODE with outpaint', async () => {
    const user = userEvent.setup();
    const editModeCaptures: (string | null)[] = [];

    renderToolbarDefault({
      onEditMode: (mode) => editModeCaptures.push(mode),
    });

    const expandBtn = screen.getByTestId("toolbar-expand");
    await user.click(expandBtn);

    expect(expandBtn).toHaveAttribute("aria-pressed", "true");

    const lastCapture = editModeCaptures[editModeCaptures.length - 1];
    expect(lastCapture).toBe("outpaint");
  });

  it('toggling brush-edit off should clear editMode to null', async () => {
    const user = userEvent.setup();
    const editModeCaptures: (string | null)[] = [];

    renderToolbarDefault({
      onEditMode: (mode) => editModeCaptures.push(mode),
    });

    const brushEditBtn = screen.getByTestId("toolbar-brush-edit");

    // Toggle on
    await user.click(brushEditBtn);
    expect(brushEditBtn).toHaveAttribute("aria-pressed", "true");

    // Toggle off
    await user.click(brushEditBtn);
    expect(brushEditBtn).toHaveAttribute("aria-pressed", "false");

    // Last capture should be null (editMode cleared)
    const lastCapture = editModeCaptures[editModeCaptures.length - 1];
    expect(lastCapture).toBeNull();
  });
});
