// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { LightboxModal } from "@/components/lightbox/lightbox-modal";
import { type Generation } from "@/lib/db/queries";

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

// Mock lucide-react icons
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
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

// Mock workspace-state (LightboxModal uses useWorkspaceVariation internally;
// variation-specific behaviour is tested in variation-flow.test.tsx)
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
}));

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
  };
}

const defaultOnClose = vi.fn();

beforeEach(() => {
  defaultOnClose.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
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
