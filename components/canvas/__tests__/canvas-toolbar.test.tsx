// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy — mock downloadImage utility, lucide icons)
// ---------------------------------------------------------------------------

// Mock lucide-react icons used by the toolbar
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
}));

// Mock the downloadImage utility — it does fetch+blob+anchor click which is not
// possible in jsdom. generateDownloadFilename is kept real.
const mockDownloadImage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadImage: (...args: unknown[]) => mockDownloadImage(...args),
  };
});

// Mock sonner toast (external)
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Import AFTER mocks
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-toolbar-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    negativePrompt: overrides.negativePrompt ?? null,
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
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

// We need React for the SetGeneratingHelper
import React from "react";
// We need the hook for SetGeneratingHelper
import { useCanvasDetail } from "@/lib/canvas-detail-context";

/**
 * A small helper component that dispatches SET_GENERATING on mount.
 */
function SetGeneratingHelper() {
  const { dispatch } = useCanvasDetail();
  React.useEffect(() => {
    dispatch({ type: "SET_GENERATING", isGenerating: true });
  }, [dispatch]);
  return null;
}

function renderToolbarWithGenerating(options: {
  generation?: Generation;
  onDelete?: () => void;
}) {
  const generation = options.generation ?? makeGeneration();
  const onDelete = options.onDelete ?? vi.fn();

  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <SetGeneratingHelper />
        <CanvasToolbar generation={generation} onDelete={onDelete} />
      </CanvasDetailProvider>
    ),
    onDelete,
    generation,
  };
}

function renderToolbarDefault(options?: {
  generation?: Generation;
  onDelete?: () => void;
}) {
  const generation = options?.generation ?? makeGeneration();
  const onDelete = options?.onDelete ?? vi.fn();

  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <CanvasToolbar generation={generation} onDelete={onDelete} />
      </CanvasDetailProvider>
    ),
    onDelete,
    generation,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: GIVEN die CanvasDetailView ist sichtbar
   *       WHEN die Toolbar gerendert wird
   *       THEN zeigt sie 6 Icons vertikal gestapelt in folgender Reihenfolge
   *            (top-down): Variation, img2img, Upscale, Download, Delete, Details
   */
  it("AC-1: should render 6 tool icons in correct order: Variation, img2img, Upscale, Download, Delete, Details", () => {
    renderToolbarDefault();

    const toolbar = screen.getByTestId("canvas-toolbar");
    expect(toolbar).toBeInTheDocument();

    // All 6 buttons should exist with correct test IDs
    const variationBtn = screen.getByTestId("toolbar-variation");
    const img2imgBtn = screen.getByTestId("toolbar-img2img");
    const upscaleBtn = screen.getByTestId("toolbar-upscale");
    const downloadBtn = screen.getByTestId("toolbar-download");
    const deleteBtn = screen.getByTestId("toolbar-delete");
    const detailsBtn = screen.getByTestId("toolbar-details");

    expect(variationBtn).toBeInTheDocument();
    expect(img2imgBtn).toBeInTheDocument();
    expect(upscaleBtn).toBeInTheDocument();
    expect(downloadBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();
    expect(detailsBtn).toBeInTheDocument();

    // Verify order: all buttons should be within the toolbar nav
    // and their DOM order should match the expected top-down order
    const allButtons = within(toolbar).getAllByRole("button");
    expect(allButtons).toHaveLength(6);

    // Verify aria-labels match the expected order
    const labels = allButtons.map((btn) => btn.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Variation",
      "img2img",
      "Upscale",
      "Download",
      "Delete",
      "Details",
    ]);
  });

  /**
   * AC-2: GIVEN kein Tool ist aktiv
   *       WHEN der User auf das Variation-Icon klickt
   *       THEN wird das Variation-Icon als aktiv hervorgehoben (visuell unterscheidbar)
   *            und `activeToolId` im CanvasDetailContext ist `"variation"`
   */
  it('AC-2: should set activeToolId to "variation" when Variation icon is clicked', async () => {
    const user = userEvent.setup();
    renderToolbarDefault();

    const variationBtn = screen.getByTestId("toolbar-variation");

    // Initially not active
    expect(variationBtn).toHaveAttribute("aria-pressed", "false");

    // Click Variation
    await user.click(variationBtn);

    // Now active — aria-pressed should be true
    expect(variationBtn).toHaveAttribute("aria-pressed", "true");
    // Active styling class applied
    expect(variationBtn.className).toMatch(/bg-accent/);
  });

  /**
   * AC-3: GIVEN das Variation-Icon ist aktiv (`activeToolId: "variation"`)
   *       WHEN der User erneut auf das Variation-Icon klickt
   *       THEN wird es deaktiviert und `activeToolId` im CanvasDetailContext ist `null`
   */
  it("AC-3: should set activeToolId to null when active tool icon is clicked again (toggle off)", async () => {
    const user = userEvent.setup();
    renderToolbarDefault();

    const variationBtn = screen.getByTestId("toolbar-variation");

    // Click once to activate
    await user.click(variationBtn);
    expect(variationBtn).toHaveAttribute("aria-pressed", "true");

    // Click again to deactivate
    await user.click(variationBtn);
    expect(variationBtn).toHaveAttribute("aria-pressed", "false");
  });

  /**
   * AC-4: GIVEN das Variation-Icon ist aktiv
   *       WHEN der User auf das img2img-Icon klickt
   *       THEN wechselt der Active-State: img2img ist aktiv, Variation ist inaktiv,
   *            `activeToolId` ist `"img2img"`
   */
  it('AC-4: should switch activeToolId when a different tool icon is clicked', async () => {
    const user = userEvent.setup();
    renderToolbarDefault();

    const variationBtn = screen.getByTestId("toolbar-variation");
    const img2imgBtn = screen.getByTestId("toolbar-img2img");

    // Activate Variation
    await user.click(variationBtn);
    expect(variationBtn).toHaveAttribute("aria-pressed", "true");
    expect(img2imgBtn).toHaveAttribute("aria-pressed", "false");

    // Click img2img — should switch active state
    await user.click(img2imgBtn);
    expect(img2imgBtn).toHaveAttribute("aria-pressed", "true");
    expect(variationBtn).toHaveAttribute("aria-pressed", "false");
  });

  /**
   * AC-5: GIVEN die CanvasDetailView zeigt ein Bild mit `imageUrl: "https://r2.example.com/image.png"`
   *       WHEN der User auf das Download-Icon klickt
   *       THEN wird ein Datei-Download der Bild-URL gestartet (kein Popover, kein Active-State)
   */
  it("AC-5: should trigger file download when Download icon is clicked", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      imageUrl: "https://r2.example.com/image.png",
      prompt: "beautiful sunset",
      createdAt: new Date("2025-06-15T12:00:00Z"),
    });
    renderToolbarDefault({ generation });

    const downloadBtn = screen.getByTestId("toolbar-download");

    await user.click(downloadBtn);

    // downloadImage should have been called with the image URL and a generated filename
    expect(mockDownloadImage).toHaveBeenCalledTimes(1);
    expect(mockDownloadImage).toHaveBeenCalledWith(
      "https://r2.example.com/image.png",
      expect.stringContaining("beautiful-sunset")
    );

    // Download button should NOT have active state (no toggle)
    expect(downloadBtn).toHaveAttribute("aria-pressed", "false");
  });

  /**
   * AC-6: GIVEN die CanvasDetailView zeigt ein Bild
   *       WHEN der User auf das Delete-Icon klickt
   *       THEN erscheint ein AlertDialog mit Titel "Delete Image?",
   *            Beschreibung "This action cannot be undone."
   *            und Buttons "Cancel" und "Delete"
   */
  it('AC-6: should show AlertDialog with correct content when Delete icon is clicked', async () => {
    const user = userEvent.setup();
    renderToolbarDefault();

    const deleteBtn = screen.getByTestId("toolbar-delete");

    // Click Delete
    await user.click(deleteBtn);

    // AlertDialog should appear with correct content
    expect(screen.getByText("Delete Image?")).toBeInTheDocument();
    expect(
      screen.getByText("This action cannot be undone.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete/i })
    ).toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN der Delete-AlertDialog ist sichtbar
   *       WHEN der User auf "Cancel" klickt
   *       THEN schliesst der Dialog und das Bild bleibt unveraendert
   */
  it('AC-7: should close AlertDialog without action when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderToolbarDefault({ onDelete });

    // Open the dialog
    const deleteBtn = screen.getByTestId("toolbar-delete");
    await user.click(deleteBtn);

    // Verify dialog is open
    expect(screen.getByText("Delete Image?")).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    // Dialog should close (title no longer visible)
    expect(screen.queryByText("Delete Image?")).not.toBeInTheDocument();

    // onDelete should NOT have been called
    expect(onDelete).not.toHaveBeenCalled();
  });

  /**
   * AC-8: GIVEN der Delete-AlertDialog ist sichtbar
   *       WHEN der User auf "Delete" klickt
   *       THEN wird der `onDelete`-Callback aufgerufen und der Dialog schliesst
   */
  it("AC-8: should call onDelete callback when Delete is confirmed", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderToolbarDefault({ onDelete });

    // Open the dialog
    const deleteBtn = screen.getByTestId("toolbar-delete");
    await user.click(deleteBtn);

    // Click Delete in the dialog
    // The dialog has two elements with "Delete" text — the button in the toolbar
    // and the action button in the dialog. We need the dialog action button.
    const dialogDeleteBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(dialogDeleteBtn);

    // onDelete callback should have been called
    expect(onDelete).toHaveBeenCalledTimes(1);

    // Dialog should close
    expect(screen.queryByText("Delete Image?")).not.toBeInTheDocument();
  });

  /**
   * AC-9: GIVEN `isGenerating` ist `true` im CanvasDetailContext
   *       WHEN die Toolbar gerendert wird
   *       THEN sind alle 6 Icons visuell als disabled dargestellt und nicht klickbar
   */
  it("AC-9: should disable all icons when isGenerating is true", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderToolbarWithGenerating({ onDelete });

    // All 6 buttons should be aria-disabled
    const toolbar = screen.getByTestId("canvas-toolbar");
    const allButtons = within(toolbar).getAllByRole("button");
    expect(allButtons).toHaveLength(6);

    for (const btn of allButtons) {
      expect(btn).toHaveAttribute("aria-disabled", "true");
      // Disabled styling: opacity-50 and pointer-events-none
      expect(btn.className).toMatch(/opacity-50/);
      expect(btn.className).toMatch(/pointer-events-none/);
    }

    // Clicking should not trigger any action
    const variationBtn = screen.getByTestId("toolbar-variation");
    await user.click(variationBtn);
    // Should remain inactive (aria-pressed false, no state change)
    expect(variationBtn).toHaveAttribute("aria-pressed", "false");

    // Download should not trigger
    const downloadBtn = screen.getByTestId("toolbar-download");
    await user.click(downloadBtn);
    expect(mockDownloadImage).not.toHaveBeenCalled();

    // Delete should not open dialog
    const deleteBtnEl = screen.getByTestId("toolbar-delete");
    await user.click(deleteBtnEl);
    expect(screen.queryByText("Delete Image?")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  /**
   * AC-10: GIVEN kein Tool ist aktiv
   *        WHEN der User auf das Details-Icon klickt
   *        THEN wird `activeToolId` auf `"details"` gesetzt
   *             (Details-Overlay-Toggle wird von Slice 10 konsumiert)
   */
  it('AC-10: should set activeToolId to "details" when Details icon is clicked', async () => {
    const user = userEvent.setup();
    renderToolbarDefault();

    const detailsBtn = screen.getByTestId("toolbar-details");

    // Initially not active
    expect(detailsBtn).toHaveAttribute("aria-pressed", "false");

    // Click Details
    await user.click(detailsBtn);

    // Now active
    expect(detailsBtn).toHaveAttribute("aria-pressed", "true");
  });
});
