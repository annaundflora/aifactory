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

// Mock lucide-react X icon
vi.mock("lucide-react", () => ({
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
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
