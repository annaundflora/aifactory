// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/image as plain img element
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = Object.fromEntries(
      Object.entries(props).filter(([k]) => k !== "priority" && k !== "fill")
    );
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

// Mock lucide-react icons (including slice-17 icons: ArrowRightLeft, ZoomIn, Trash2)
vi.mock("lucide-react", () => ({
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
  Download: (props: Record<string, unknown>) => (
    <svg data-testid="download-icon" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <svg data-testid="loader2-icon" {...props} />
  ),
  Copy: (props: Record<string, unknown>) => (
    <svg data-testid="copy-icon" {...props} />
  ),
  Maximize2: (props: Record<string, unknown>) => (
    <svg data-testid="maximize2-icon" {...props} />
  ),
  Minimize2: (props: Record<string, unknown>) => (
    <svg data-testid="minimize2-icon" {...props} />
  ),
  ArrowRightLeft: (props: Record<string, unknown>) => (
    <svg data-testid="arrow-right-left-icon" {...props} />
  ),
  ZoomIn: (props: Record<string, unknown>) => (
    <svg data-testid="zoom-in-icon" {...props} />
  ),
  Trash2: (props: Record<string, unknown>) => (
    <svg data-testid="trash2-icon" {...props} />
  ),
}));

// Mock sonner toast — supports both toast("msg") and toast.error("msg")
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToast = Object.assign(vi.fn(), {
  error: mockToastError,
  success: mockToastSuccess,
});
vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Mock lib/utils download helpers
vi.mock("@/lib/utils", () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("test-image.png"),
}));

// Mock lib/models
vi.mock("@/lib/models", () => ({
  getModelById: (id: string) => {
    if (id === "black-forest-labs/flux-2-pro") {
      return { id: "black-forest-labs/flux-2-pro", displayName: "FLUX 2 Pro", pricePerImage: 0.055 };
    }
    return undefined;
  },
}));

// Mock workspace-state — setVariation is a trackable spy
const mockSetVariation = vi.fn();
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

// Mock server actions (upscaleImage + deleteGeneration)
const mockUpscaleImage = vi.fn().mockResolvedValue({ id: "gen-upscaled" });
const mockDeleteGeneration = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/app/actions/generations", () => ({
  upscaleImage: (...args: unknown[]) => mockUpscaleImage(...args),
  deleteGeneration: (...args: unknown[]) => mockDeleteGeneration(...args),
}));

// Mock Popover — renders children directly; manages open/close via data attributes
vi.mock("@/components/ui/popover", () => {
  let onOpenChangeFn: ((open: boolean) => void) | null = null;
  let isOpen = false;

  return {
    Popover: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
      if (open !== undefined) isOpen = open;
      if (onOpenChange) onOpenChangeFn = onOpenChange;
      return <div data-testid="popover-root" data-open={isOpen}>{children}</div>;
    },
    PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
      if (asChild) {
        // When asChild, clicking the child should toggle the popover
        return <div data-testid="popover-trigger" onClick={() => onOpenChangeFn?.(!isOpen)}>{children}</div>;
      }
      return <div data-testid="popover-trigger" onClick={() => onOpenChangeFn?.(!isOpen)}>{children}</div>;
    },
    PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => {
      if (!isOpen) return null;
      return <div data-testid="popover-content">{children}</div>;
    },
  };
});

// Mock ConfirmDialog
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm, onCancel }: { open: boolean; title?: string; description?: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) => {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <button data-testid="confirm-dialog-confirm" onClick={onConfirm}>Confirm</button>
        <button data-testid="confirm-dialog-cancel" onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------
import { LightboxModal } from "@/components/lightbox/lightbox-modal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-abc-123",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a beautiful sunset over the ocean",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "black-forest-labs/flux-2-pro",
    modelParams: overrides.modelParams ?? { steps: 30, guidance: 7.5 },
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/sunset.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 1024,
    height: overrides.height ?? 768,
    seed: overrides.seed ?? null,
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-03-01T14:30:00Z"),
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
  };
}

const defaultOnClose = vi.fn();

beforeEach(() => {
  defaultOnClose.mockClear();
  mockSetVariation.mockClear();
  mockUpscaleImage.mockClear();
  mockDeleteGeneration.mockClear();
  mockToast.mockClear();
  mockToastError.mockClear();
  mockToastSuccess.mockClear();
});

// ---------------------------------------------------------------------------
// Tests — Original Lightbox
// ---------------------------------------------------------------------------

describe("LightboxModal", () => {
  /**
   * AC-1: GIVEN eine Liste von completed Generierungen und eine ausgewaehlte
   * Generation mit image_url, prompt, model_id, model_params, width, height, created_at
   * WHEN <LightboxModal> mit dieser Generation geoeffnet wird
   * THEN wird das Bild gross und zentriert im Modal angezeigt mit der image_url als Source
   */
  it("AC-1: should render large centered image with image_url as source", () => {
    const generation = makeGeneration({
      imageUrl: "https://cdn.example.com/my-image.png",
      prompt: "a cat in space",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    const img = screen.getByTestId("lightbox-image");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://cdn.example.com/my-image.png");
    expect(img).toHaveAttribute("alt", "a cat in space");

    // Image should be inside the overlay (centered layout)
    const overlay = screen.getByTestId("lightbox-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toMatch(/flex/);
    expect(overlay.className).toMatch(/items-center/);
    expect(overlay.className).toMatch(/justify-center/);
  });

  /**
   * AC-2: GIVEN eine geoeffnete <LightboxModal> mit einer Generation
   * WHEN das Detail-Panel gerendert wird
   * THEN werden folgende Felder angezeigt: Prompt (vollstaendig), Modell-Name,
   * Parameter (aus model_params), Bildabmessungen (width x height), Erstelldatum (formatiert)
   */
  it("AC-2: should display prompt, model name, parameters, dimensions, and created date", () => {
    const generation = makeGeneration({
      prompt: "a beautiful sunset over the ocean",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { steps: 30, guidance: 7.5 },
      width: 1024,
      height: 768,
      createdAt: new Date("2026-03-01T14:30:00Z"),
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Prompt displayed fully
    const promptEl = screen.getByTestId("lightbox-prompt");
    expect(promptEl).toHaveTextContent("a beautiful sunset over the ocean");

    // Model name (resolved via getModelById mock)
    const modelEl = screen.getByTestId("lightbox-model");
    expect(modelEl).toHaveTextContent("FLUX 2 Pro");

    // Parameters
    const paramsEl = screen.getByTestId("lightbox-params");
    expect(paramsEl).toHaveTextContent("steps: 30");
    expect(paramsEl).toHaveTextContent("guidance: 7.5");

    // Dimensions
    const dimensionsEl = screen.getByTestId("lightbox-dimensions");
    expect(dimensionsEl).toHaveTextContent("1024 x 768");

    // Created date (formatted)
    const createdEl = screen.getByTestId("lightbox-created");
    expect(createdEl.textContent).toBeTruthy();
    // Should contain at least the year and month
    expect(createdEl.textContent).toMatch(/March/);
    expect(createdEl.textContent).toMatch(/2026/);
  });

  /**
   * AC-3: GIVEN eine Generation mit negative_prompt: "blurry, low quality"
   * WHEN <LightboxModal> diese Generation anzeigt
   * THEN wird das Negativ-Prompt-Feld mit dem Wert "blurry, low quality" im Detail-Panel angezeigt
   */
  it("AC-3: should show negative prompt when present", () => {
    const generation = makeGeneration({
      negativePrompt: "blurry, low quality",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    const negPrompt = screen.getByTestId("lightbox-negative-prompt");
    expect(negPrompt).toBeInTheDocument();
    expect(negPrompt).toHaveTextContent("blurry, low quality");
  });

  /**
   * AC-4: GIVEN eine Generation mit negative_prompt: null
   * WHEN <LightboxModal> diese Generation anzeigt
   * THEN wird das Negativ-Prompt-Feld NICHT im Detail-Panel gerendert
   */
  it("AC-4: should not render negative prompt field when value is null", () => {
    const generation = makeGeneration({
      negativePrompt: null,
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    const negPrompt = screen.queryByTestId("lightbox-negative-prompt");
    expect(negPrompt).not.toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN eine geoeffnete <LightboxModal>
   * WHEN der User auf den X-Button klickt
   * THEN wird ein onClose Callback aufgerufen und das Modal schliesst sich
   */
  it("AC-5: should call onClose when X button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    const closeButton = screen.getByTestId("lightbox-close");
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-6: GIVEN eine geoeffnete <LightboxModal>
   * WHEN der User auf den gedimmten Overlay-Hintergrund klickt
   * THEN wird ein onClose Callback aufgerufen und das Modal schliesst sich
   */
  it("AC-6: should call onClose when overlay background is clicked", async () => {
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    const overlay = screen.getByTestId("lightbox-overlay");
    // fireEvent.click directly on the overlay (not on content inside it)
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-7: GIVEN eine geoeffnete <LightboxModal>
   * WHEN der User auf das Bild oder das Detail-Panel klickt
   * THEN schliesst sich das Modal NICHT (kein Event-Bubbling zum Overlay)
   */
  it("AC-7: should not close when clicking on image or detail panel", async () => {
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    // Click on the content area (stopPropagation should prevent onClose)
    const content = screen.getByTestId("lightbox-content");
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();

    // Click on the image
    const img = screen.getByTestId("lightbox-image");
    fireEvent.click(img);
    expect(onClose).not.toHaveBeenCalled();

    // Click on the detail panel
    const details = screen.getByTestId("lightbox-details");
    fireEvent.click(details);
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * AC-8: GIVEN eine geoeffnete <LightboxModal>
   * WHEN der User die Escape-Taste drueckt
   * THEN wird ein onClose Callback aufgerufen und das Modal schliesst sich
   */
  it("AC-8: should call onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-9: GIVEN <LightboxModal> mit isOpen: false
   * WHEN die Komponente gerendert wird
   * THEN wird kein Modal im DOM angezeigt
   */
  it("AC-9: should not render modal when isOpen is false", () => {
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={false} onClose={defaultOnClose} />
    );

    const overlay = screen.queryByTestId("lightbox-overlay");
    expect(overlay).not.toBeInTheDocument();

    const content = screen.queryByTestId("lightbox-content");
    expect(content).not.toBeInTheDocument();

    const img = screen.queryByTestId("lightbox-image");
    expect(img).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice-19: Lightbox Fullscreen Toggle
// ---------------------------------------------------------------------------

describe("LightboxModal Fullscreen", () => {
  /**
   * AC-1 (slice-19): GIVEN die Lightbox ist im Normal-Modus geoeffnet
   * WHEN der User den Fullscreen-Toggle-Button klickt
   * THEN wechselt die Lightbox in den Fullscreen-Modus: Bild nimmt den gesamten
   * Viewport ein (object-contain), Details-Panel ist nicht sichtbar, Hintergrund ist schwarz
   */
  it("AC-1: should switch to fullscreen mode when toggle button is clicked in normal mode", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Pre-condition: normal mode — details panel is visible
    expect(screen.getByTestId("lightbox-details")).toBeInTheDocument();

    // Image should have max-h-[70vh] class in normal mode
    const imgBefore = screen.getByTestId("lightbox-image");
    expect(imgBefore.className).toMatch(/max-h-\[70vh\]/);

    // Act: click fullscreen toggle
    const toggleBtn = screen.getByTestId("fullscreen-toggle");
    await user.click(toggleBtn);

    // Assert: details panel is no longer visible
    expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();

    // Assert: image has fullscreen classes (w-full h-full object-contain)
    const imgAfter = screen.getByTestId("lightbox-image");
    expect(imgAfter.className).toMatch(/w-full/);
    expect(imgAfter.className).toMatch(/h-full/);
    expect(imgAfter.className).toMatch(/object-contain/);

    // Assert: content container has black background
    const content = screen.getByTestId("lightbox-content");
    expect(content.className).toMatch(/bg-black/);
  });

  /**
   * AC-2 (slice-19): GIVEN die Lightbox ist im Fullscreen-Modus
   * WHEN der User den Fullscreen-Toggle-Button klickt
   * THEN wechselt die Lightbox zurueck in den Normal-Modus: Bild hat max-h-[70vh],
   * Details-Panel ist sichtbar
   */
  it("AC-2: should switch back to normal mode when toggle button is clicked in fullscreen mode", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    const toggleBtn = screen.getByTestId("fullscreen-toggle");

    // Enter fullscreen
    await user.click(toggleBtn);
    expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();

    // Act: click again to exit fullscreen
    await user.click(toggleBtn);

    // Assert: details panel is visible again
    expect(screen.getByTestId("lightbox-details")).toBeInTheDocument();

    // Assert: image has normal mode class
    const img = screen.getByTestId("lightbox-image");
    expect(img.className).toMatch(/max-h-\[70vh\]/);
  });

  /**
   * AC-3 (slice-19): GIVEN die Lightbox ist im Normal-Modus
   * WHEN der User den Fullscreen-Toggle-Button betrachtet
   * THEN zeigt der Button das Maximize2-Icon (Lucide) und ist neben dem Close-Button (X) positioniert
   */
  it("AC-3: should show Maximize2 icon next to close button in normal mode", () => {
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Fullscreen toggle button exists
    const toggleBtn = screen.getByTestId("fullscreen-toggle");
    expect(toggleBtn).toBeInTheDocument();

    // Maximize2 icon is rendered inside the toggle button
    expect(screen.getByTestId("maximize2-icon")).toBeInTheDocument();

    // Minimize2 icon should NOT be present in normal mode
    expect(screen.queryByTestId("minimize2-icon")).not.toBeInTheDocument();

    // Close button also exists (they are siblings)
    const closeBtn = screen.getByTestId("lightbox-close");
    expect(closeBtn).toBeInTheDocument();

    // Both buttons share the same parent container
    expect(toggleBtn.parentElement).toBe(closeBtn.parentElement);
  });

  /**
   * AC-4 (slice-19): GIVEN die Lightbox ist im Fullscreen-Modus
   * WHEN der User den Fullscreen-Toggle-Button betrachtet
   * THEN zeigt der Button das Minimize2-Icon (Lucide)
   */
  it("AC-4: should show Minimize2 icon in fullscreen mode", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Enter fullscreen
    const toggleBtn = screen.getByTestId("fullscreen-toggle");
    await user.click(toggleBtn);

    // Assert: Minimize2 icon is shown
    expect(screen.getByTestId("minimize2-icon")).toBeInTheDocument();

    // Assert: Maximize2 icon is NOT shown
    expect(screen.queryByTestId("maximize2-icon")).not.toBeInTheDocument();
  });

  /**
   * AC-5 (slice-19): GIVEN die Lightbox ist im Fullscreen-Modus
   * WHEN der User die ESC-Taste drueckt
   * THEN kehrt die Lightbox zum Normal-Modus zurueck (schliesst NICHT die gesamte Lightbox)
   */
  it("AC-5: should return to normal mode when ESC is pressed in fullscreen mode", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    // Enter fullscreen
    const toggleBtn = screen.getByTestId("fullscreen-toggle");
    await user.click(toggleBtn);

    // Verify we are in fullscreen (no details panel)
    expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();

    // Act: press ESC
    fireEvent.keyDown(document, { key: "Escape" });

    // Assert: lightbox is still open (onClose NOT called)
    expect(onClose).not.toHaveBeenCalled();

    // Assert: returned to normal mode — details panel visible again
    expect(screen.getByTestId("lightbox-details")).toBeInTheDocument();

    // Assert: image has normal mode class
    const img = screen.getByTestId("lightbox-image");
    expect(img.className).toMatch(/max-h-\[70vh\]/);
  });

  /**
   * AC-6 (slice-19): GIVEN die Lightbox ist im Normal-Modus
   * WHEN der User die ESC-Taste drueckt
   * THEN schliesst die Lightbox wie bisher (unveraendertes Verhalten)
   */
  it("AC-6: should close lightbox when ESC is pressed in normal mode", () => {
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    // Verify we are in normal mode (details panel visible)
    expect(screen.getByTestId("lightbox-details")).toBeInTheDocument();

    // Act: press ESC
    fireEvent.keyDown(document, { key: "Escape" });

    // Assert: onClose was called
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-7 (slice-19): GIVEN die Lightbox ist im Fullscreen-Modus und zeigt Bild 3 von 5
   * WHEN der User die Navigations-Pfeile (links/rechts) nutzt
   * THEN navigiert die Lightbox zum naechsten/vorherigen Bild und bleibt im Fullscreen-Modus
   *
   * Note: Navigation is handled externally — LightboxModal receives a new generation prop.
   * This test verifies that the fullscreen state persists across re-renders with a new
   * generation prop (simulating navigation).
   */
  it("AC-7: should keep fullscreen mode when navigating between images", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const generation1 = makeGeneration({
      id: "gen-3",
      prompt: "image three",
      imageUrl: "https://example.com/img3.png",
    });
    const generation2 = makeGeneration({
      id: "gen-4",
      prompt: "image four",
      imageUrl: "https://example.com/img4.png",
    });

    const { rerender } = render(
      <LightboxModal generation={generation1} isOpen={true} onClose={onClose} />
    );

    // Enter fullscreen
    const toggleBtn = screen.getByTestId("fullscreen-toggle");
    await user.click(toggleBtn);

    // Verify fullscreen
    expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();
    expect(screen.getByTestId("minimize2-icon")).toBeInTheDocument();

    // Simulate navigation: re-render with a different generation (same component instance)
    rerender(
      <LightboxModal generation={generation2} isOpen={true} onClose={onClose} />
    );

    // Assert: still in fullscreen mode
    expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();
    expect(screen.getByTestId("minimize2-icon")).toBeInTheDocument();

    // Assert: the new image is shown
    const img = screen.getByTestId("lightbox-image");
    expect(img).toHaveAttribute("src", "https://example.com/img4.png");
    expect(img).toHaveAttribute("alt", "image four");
  });

  /**
   * AC-8 (slice-19): GIVEN die Lightbox ist im Fullscreen-Modus
   * WHEN der User die Lightbox ueber den Close-Button schliesst und erneut oeffnet
   * THEN startet die Lightbox im Normal-Modus (Fullscreen-State wird nicht persistiert)
   *
   * In a real app the parent unmounts the LightboxModal on close and mounts a fresh
   * instance on re-open, so isFullscreen (local useState) resets to false.
   * We simulate this by unmounting and rendering a new instance.
   */
  it("AC-8: should open in normal mode after closing and reopening", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const generation = makeGeneration();

    const { unmount } = render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    // Enter fullscreen
    const toggleBtn = screen.getByTestId("fullscreen-toggle");
    await user.click(toggleBtn);

    // Verify fullscreen is active
    expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();

    // Simulate close: unmount the component (parent removes it from tree)
    unmount();

    // Simulate re-open: mount a fresh instance
    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    // Assert: opens in normal mode — details panel visible
    expect(screen.getByTestId("lightbox-details")).toBeInTheDocument();

    // Assert: Maximize2 icon shown (normal mode), not Minimize2
    expect(screen.getByTestId("maximize2-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("minimize2-icon")).not.toBeInTheDocument();

    // Assert: image has normal mode class
    const img = screen.getByTestId("lightbox-image");
    expect(img.className).toMatch(/max-h-\[70vh\]/);
  });
});

// ---------------------------------------------------------------------------
// Slice-17: Lightbox — Cross-Mode Buttons (img2img + Upscale Popover)
// ---------------------------------------------------------------------------

describe("LightboxModal Cross-Mode Buttons (Slice-17)", () => {

  // -------------------------------------------------------------------------
  // AC-1: txt2img → img2img + Upscale + Variation sichtbar
  // -------------------------------------------------------------------------
  it("AC-1: should show img2img, Upscale and Variation buttons for txt2img generation", () => {
    /**
     * AC-1 (slice-17): GIVEN eine Lightbox ist geoeffnet mit einem Bild der generationMode: "txt2img"
     * WHEN die Aktionsleiste gerendert wird
     * THEN sind sowohl der "img2img"-Button als auch der "Upscale"-Button sichtbar;
     *      der "Variation"-Button ist ebenfalls sichtbar
     */
    const generation = makeGeneration({ generationMode: "txt2img" });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // img2img button visible
    const img2imgBtn = screen.getByTestId("img2img-btn");
    expect(img2imgBtn).toBeInTheDocument();
    expect(img2imgBtn).toHaveTextContent("img2img");

    // Upscale button visible
    const upscaleBtn = screen.getByTestId("upscale-btn");
    expect(upscaleBtn).toBeInTheDocument();
    expect(upscaleBtn).toHaveTextContent("Upscale");

    // Variation button visible
    const variationBtn = screen.getByTestId("variation-btn");
    expect(variationBtn).toBeInTheDocument();
    expect(variationBtn).toHaveTextContent("Variation");
  });

  // -------------------------------------------------------------------------
  // AC-2: img2img → all three buttons visible
  // -------------------------------------------------------------------------
  it("AC-2: should show img2img, Upscale and Variation buttons for img2img generation", () => {
    /**
     * AC-2 (slice-17): GIVEN eine Lightbox ist geoeffnet mit einem Bild der generationMode: "img2img"
     * WHEN die Aktionsleiste gerendert wird
     * THEN sind "img2img"-Button, "Upscale"-Button und "Variation"-Button sichtbar
     */
    const generation = makeGeneration({
      generationMode: "img2img",
      sourceImageUrl: "https://example.com/source.png",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    expect(screen.getByTestId("img2img-btn")).toBeInTheDocument();
    expect(screen.getByTestId("upscale-btn")).toBeInTheDocument();
    expect(screen.getByTestId("variation-btn")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: upscale → Upscale + Variation hidden, img2img visible
  // -------------------------------------------------------------------------
  it("AC-3: should hide Upscale and Variation buttons for upscale generation", () => {
    /**
     * AC-3 (slice-17): GIVEN eine Lightbox ist geoeffnet mit einem Bild der generationMode: "upscale"
     * WHEN die Aktionsleiste gerendert wird
     * THEN sind "Upscale"-Button und "Variation"-Button NICHT sichtbar;
     *      "img2img"-Button und uebrige Buttons (Download, Fav, Delete) sind sichtbar
     */
    const generation = makeGeneration({ generationMode: "upscale" });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Upscale and Variation should NOT be in the DOM
    expect(screen.queryByTestId("upscale-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("variation-btn")).not.toBeInTheDocument();

    // img2img button IS visible
    expect(screen.getByTestId("img2img-btn")).toBeInTheDocument();

    // Download and Delete buttons are also visible
    expect(screen.getByTestId("download-btn")).toBeInTheDocument();
    expect(screen.getByTestId("lightbox-delete-btn")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-4: img2img button click → setVariation with targetMode img2img + onClose
  // -------------------------------------------------------------------------
  it("AC-4: should call setVariation with targetMode img2img and imageUrl as sourceImageUrl on img2img button click", async () => {
    /**
     * AC-4 (slice-17): GIVEN ein txt2img-Bild ist in der Lightbox geoeffnet und der
     *      "img2img"-Button wird geklickt
     * WHEN der Click-Handler ausgefuehrt wird
     * THEN wird setVariation mit { targetMode: "img2img", sourceImageUrl: <imageUrl des Bildes>,
     *      ...restliche Felder des Bildes } aufgerufen und die Lightbox wird geschlossen (onClose)
     */
    const user = userEvent.setup();
    const onClose = vi.fn();
    const generation = makeGeneration({
      generationMode: "txt2img",
      imageUrl: "https://example.com/my-txt2img.png",
      prompt: "a sunset",
      negativePrompt: "blurry",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { steps: 30 },
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    const img2imgBtn = screen.getByTestId("img2img-btn");
    await user.click(img2imgBtn);

    // setVariation called with targetMode img2img and imageUrl as sourceImageUrl
    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArg = mockSetVariation.mock.calls[0][0];
    expect(callArg.targetMode).toBe("img2img");
    expect(callArg.sourceImageUrl).toBe("https://example.com/my-txt2img.png");
    expect(callArg.promptMotiv).toBe("a sunset");
    expect(callArg.negativePrompt).toBe("blurry");
    expect(callArg.modelId).toBe("black-forest-labs/flux-2-pro");
    expect(callArg.modelParams).toEqual({ steps: 30 });

    // Lightbox was closed
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // AC-5: Upscale button click → Popover with 2x and 4x
  // -------------------------------------------------------------------------
  it("AC-5: should show popover with 2x and 4x options when Upscale button is clicked", async () => {
    /**
     * AC-5 (slice-17): GIVEN der "Upscale"-Button wird geklickt
     * WHEN der Popover oeffnet
     * THEN zeigt er zwei Optionen: "2x" und "4x" — kein direkter Action-Aufruf beim Oeffnen
     */
    const user = userEvent.setup();
    const generation = makeGeneration({ generationMode: "txt2img" });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Click the upscale button to open popover
    const upscaleBtn = screen.getByTestId("upscale-btn");
    await user.click(upscaleBtn);

    // 2x and 4x options should be visible
    const btn2x = screen.getByTestId("upscale-2x-btn");
    const btn4x = screen.getByTestId("upscale-4x-btn");
    expect(btn2x).toBeInTheDocument();
    expect(btn2x).toHaveTextContent("2x");
    expect(btn4x).toBeInTheDocument();
    expect(btn4x).toHaveTextContent("4x");

    // No upscaleImage call on mere popover open
    expect(mockUpscaleImage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-6: Popover 2x click → upscaleImage with scale 2 + Toast
  // -------------------------------------------------------------------------
  it("AC-6: should call upscaleImage with scale 2 and show toast when 2x is selected", async () => {
    /**
     * AC-6 (slice-17): GIVEN der Popover ist offen und "2x" wird geklickt
     * WHEN der Click-Handler ausgefuehrt wird
     * THEN wird upscaleImage mit { projectId, sourceImageUrl, scale: 2, sourceGenerationId }
     *      aufgerufen; der Popover schliesst sich; ein Toast "Upscaling..." erscheint
     */
    const user = userEvent.setup();
    mockUpscaleImage.mockResolvedValue({ id: "gen-upscaled-2x" });
    const generation = makeGeneration({
      generationMode: "txt2img",
      id: "gen-source-1",
      projectId: "project-42",
      imageUrl: "https://example.com/source-img.png",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Open popover
    const upscaleBtn = screen.getByTestId("upscale-btn");
    await user.click(upscaleBtn);

    // Click 2x
    const btn2x = screen.getByTestId("upscale-2x-btn");
    await user.click(btn2x);

    // upscaleImage called with correct args
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });
    expect(mockUpscaleImage).toHaveBeenCalledWith({
      projectId: "project-42",
      sourceImageUrl: "https://example.com/source-img.png",
      scale: 2,
      sourceGenerationId: "gen-source-1",
    });

    // Toast "Upscaling..." was shown
    expect(mockToast).toHaveBeenCalledWith("Upscaling...");
  });

  // -------------------------------------------------------------------------
  // AC-7: Popover 4x click → upscaleImage with scale 4 + Toast
  // -------------------------------------------------------------------------
  it("AC-7: should call upscaleImage with scale 4 and show toast when 4x is selected", async () => {
    /**
     * AC-7 (slice-17): GIVEN der Popover ist offen und "4x" wird geklickt
     * WHEN der Click-Handler ausgefuehrt wird
     * THEN wird upscaleImage mit { projectId, sourceImageUrl, scale: 4, sourceGenerationId }
     *      aufgerufen; der Popover schliesst sich; ein Toast "Upscaling..." erscheint
     */
    const user = userEvent.setup();
    mockUpscaleImage.mockResolvedValue({ id: "gen-upscaled-4x" });
    const generation = makeGeneration({
      generationMode: "txt2img",
      id: "gen-source-2",
      projectId: "project-42",
      imageUrl: "https://example.com/source-img-4x.png",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Open popover
    const upscaleBtn = screen.getByTestId("upscale-btn");
    await user.click(upscaleBtn);

    // Click 4x
    const btn4x = screen.getByTestId("upscale-4x-btn");
    await user.click(btn4x);

    // upscaleImage called with correct args
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });
    expect(mockUpscaleImage).toHaveBeenCalledWith({
      projectId: "project-42",
      sourceImageUrl: "https://example.com/source-img-4x.png",
      scale: 4,
      sourceGenerationId: "gen-source-2",
    });

    // Toast "Upscaling..." was shown
    expect(mockToast).toHaveBeenCalledWith("Upscaling...");
  });

  // -------------------------------------------------------------------------
  // AC-8: upscaleImage error → error toast, lightbox stays open
  // -------------------------------------------------------------------------
  it("AC-8: should show error toast and keep lightbox open when upscaleImage returns error", async () => {
    /**
     * AC-8 (slice-17): GIVEN upscaleImage gibt { error: "..." } zurueck
     * WHEN der Fehler empfangen wird
     * THEN wird ein Fehler-Toast mit dem Error-Text angezeigt; die Lightbox bleibt geoeffnet
     */
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpscaleImage.mockResolvedValue({ error: "Scale limit exceeded" });
    const generation = makeGeneration({ generationMode: "txt2img" });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    // Open popover and click 2x
    const upscaleBtn = screen.getByTestId("upscale-btn");
    await user.click(upscaleBtn);

    const btn2x = screen.getByTestId("upscale-2x-btn");
    await user.click(btn2x);

    // Wait for the async handler to resolve
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Scale limit exceeded");
    });

    // Lightbox remains open — onClose was NOT called
    expect(onClose).not.toHaveBeenCalled();

    // The lightbox overlay is still in the DOM
    expect(screen.getByTestId("lightbox-overlay")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-9: Variation on img2img → setVariation with sourceImageUrl from generation.sourceImageUrl
  // -------------------------------------------------------------------------
  it("AC-9: should call setVariation with sourceImageUrl from generation sourceImageUrl for img2img variation", async () => {
    /**
     * AC-9 (slice-17): GIVEN ein img2img-Bild ist in der Lightbox geoeffnet und der
     *      "Variation"-Button wird geklickt
     * WHEN der Click-Handler ausgefuehrt wird
     * THEN wird setVariation mit sourceImageUrl aus dem sourceImageUrl-Feld des Bildes
     *      (nicht der imageUrl) und targetMode: "img2img" aufgerufen
     */
    const user = userEvent.setup();
    const generation = makeGeneration({
      generationMode: "img2img",
      imageUrl: "https://example.com/result-img2img.png",
      sourceImageUrl: "https://example.com/original-source.png",
      prompt: "an enhanced sunset",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { steps: 25 },
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    const variationBtn = screen.getByTestId("variation-btn");
    await user.click(variationBtn);

    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArg = mockSetVariation.mock.calls[0][0];

    // sourceImageUrl should come from generation.sourceImageUrl (the original source), NOT imageUrl
    expect(callArg.sourceImageUrl).toBe("https://example.com/original-source.png");
    expect(callArg.targetMode).toBe("img2img");
    expect(callArg.promptMotiv).toBe("an enhanced sunset");
  });

  // -------------------------------------------------------------------------
  // AC-10: Variation on txt2img → existing behavior, no sourceImageUrl
  // -------------------------------------------------------------------------
  it("AC-10: should call setVariation without sourceImageUrl for txt2img variation", async () => {
    /**
     * AC-10 (slice-17): GIVEN ein txt2img-Bild ist in der Lightbox geoeffnet und der
     *      "Variation"-Button wird geklickt
     * WHEN der Click-Handler ausgefuehrt wird
     * THEN wird setVariation mit dem bestehenden Verhalten aufgerufen —
     *      sourceImageUrl bleibt undefined (unveraendertes Verhalten)
     */
    const user = userEvent.setup();
    const generation = makeGeneration({
      generationMode: "txt2img",
      imageUrl: "https://example.com/txt2img-result.png",
      sourceImageUrl: null,
      prompt: "a basic sunset",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { steps: 30 },
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    const variationBtn = screen.getByTestId("variation-btn");
    await user.click(variationBtn);

    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArg = mockSetVariation.mock.calls[0][0];

    // For txt2img: no targetMode, no sourceImageUrl (unchanged behavior)
    expect(callArg.sourceImageUrl).toBeUndefined();
    expect(callArg.targetMode).toBeUndefined();
    expect(callArg.promptMotiv).toBe("a basic sunset");
    expect(callArg.modelId).toBe("black-forest-labs/flux-2-pro");
  });
});
