// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills (Radix Select needs matchMedia, ResizeObserver, etc.)
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

  // Radix Select uses hasPointerCapture / setPointerCapture / releasePointerCapture
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }

  // Radix Select scrolls to the selected item on open
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

import type { CollectionModel } from "@/lib/types/collection-model";
import type { GenerationMode, Tier } from "@/lib/types";

interface MockModelSetting {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SETTINGS: MockModelSetting[] = [
  { id: "1", mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", mode: "txt2img", tier: "quality", modelId: "black-forest-labs/flux-1.1-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", mode: "txt2img", tier: "max", modelId: "black-forest-labs/flux-1.1-pro-ultra", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "5", mode: "img2img", tier: "quality", modelId: "black-forest-labs/flux-1.1-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "6", mode: "img2img", tier: "max", modelId: "black-forest-labs/flux-1.1-pro-ultra", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "7", mode: "upscale", tier: "draft", modelId: "philz1337x/clarity-upscaler", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "8", mode: "upscale", tier: "quality", modelId: "nightmareai/real-esrgan", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
];

const COLLECTION_MODELS: CollectionModel[] = [
  { url: "https://replicate.com/black-forest-labs/flux-schnell", owner: "black-forest-labs", name: "flux-schnell", description: "Fast flux model", cover_image_url: null, run_count: 1000, created_at: "2024-01-01" },
  { url: "https://replicate.com/black-forest-labs/flux-1.1-pro", owner: "black-forest-labs", name: "flux-1.1-pro", description: "Pro flux model", cover_image_url: null, run_count: 2000, created_at: "2024-01-02" },
  { url: "https://replicate.com/black-forest-labs/flux-1.1-pro-ultra", owner: "black-forest-labs", name: "flux-1.1-pro-ultra", description: "Ultra model", cover_image_url: null, run_count: 500, created_at: "2024-01-03" },
  { url: "https://replicate.com/nightmareai/real-esrgan", owner: "nightmareai", name: "real-esrgan", description: "Upscaler", cover_image_url: null, run_count: 800, created_at: "2024-01-04" },
  { url: "https://replicate.com/philz1337x/clarity-upscaler", owner: "philz1337x", name: "clarity-upscaler", description: "Clarity upscaler", cover_image_url: null, run_count: 600, created_at: "2024-01-05" },
];

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------

import { ModelModeSection } from "@/components/settings/model-mode-section";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModelModeSection", () => {
  const defaultOnModelChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-4 (partial) / AC-11: GIVEN die `ModelModeSection`-Komponente wird mit
   *   `mode="upscale"` gerendert
   *   WHEN die Tier-Dropdowns angezeigt werden
   *   THEN werden nur 2 Dropdowns gerendert (Draft, Quality) -- kein Max-Dropdown
   */
  it("AC-11: should render only Draft and Quality dropdowns for upscale mode", () => {
    render(
      <ModelModeSection
        mode="upscale"
        settings={SETTINGS}
        collectionModels={COLLECTION_MODELS}
        collectionError={null}
        compatibilityMap={{}}
        onModelChange={defaultOnModelChange}
      />
    );

    // Section header
    expect(screen.getByText("UPSCALE")).toBeInTheDocument();

    // Only Draft and Quality tier labels
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();

    // Max should NOT be present
    expect(screen.queryByText("Max")).not.toBeInTheDocument();

    // Only 2 combobox triggers (dropdowns)
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(2);
  });

  /**
   * AC-4 (partial): GIVEN die `ModelModeSection`-Komponente wird mit
   *   `mode="txt2img"` gerendert
   *   WHEN die Tier-Dropdowns angezeigt werden
   *   THEN werden 3 Dropdowns gerendert (Draft, Quality, Max)
   */
  it("AC-4: should render Draft, Quality, and Max dropdowns for txt2img mode", () => {
    render(
      <ModelModeSection
        mode="txt2img"
        settings={SETTINGS}
        collectionModels={COLLECTION_MODELS}
        collectionError={null}
        compatibilityMap={{}}
        onModelChange={defaultOnModelChange}
      />
    );

    // Section header
    expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();

    // All three tier labels present
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();

    // 3 combobox triggers (dropdowns)
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(3);
  });

  /**
   * AC-6: GIVEN ein Dropdown in der txt2img-Section wird geoeffnet
   *       WHEN `getCollectionModels()` die Collection-Models zurueckliefert
   *       THEN zeigt die Dropdown-Liste alle Collection-Models mit
   *            Model-Name (fett) und Owner (muted) als Items
   */
  it("AC-6: should render collection models with name and owner in dropdown list", async () => {
    const user = userEvent.setup();

    render(
      <ModelModeSection
        mode="txt2img"
        settings={SETTINGS}
        collectionModels={COLLECTION_MODELS}
        collectionError={null}
        compatibilityMap={{}}
        onModelChange={defaultOnModelChange}
      />
    );

    // Click the first dropdown trigger to open it
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);

    // Each collection model should appear as an option
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(COLLECTION_MODELS.length);
    });

    // Model names should be displayed (bold text)
    for (const model of COLLECTION_MODELS) {
      expect(screen.getByText(model.name)).toBeInTheDocument();
    }

    // Owner names should be displayed (muted text)
    // Note: Some owners appear multiple times, just verify they exist
    expect(screen.getAllByText("black-forest-labs").length).toBeGreaterThan(0);
    expect(screen.getByText("nightmareai")).toBeInTheDocument();
    expect(screen.getByText("philz1337x")).toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN ein Dropdown in der img2img-Section wird geoeffnet
   *       WHEN ein Model in der Liste keinen img2img-Support hat
   *       THEN wird dieses Model nicht angezeigt (ausgeblendet, nicht ausgegraut)
   */
  it("AC-7: should hide incompatible models in img2img dropdown", async () => {
    const user = userEvent.setup();

    // Mark real-esrgan as incompatible for img2img
    const compatibilityMap: Record<string, boolean> = {
      "black-forest-labs/flux-schnell": true,
      "black-forest-labs/flux-1.1-pro": true,
      "black-forest-labs/flux-1.1-pro-ultra": true,
      "nightmareai/real-esrgan": false, // incompatible
      "philz1337x/clarity-upscaler": true,
    };

    render(
      <ModelModeSection
        mode="img2img"
        settings={SETTINGS}
        collectionModels={COLLECTION_MODELS}
        collectionError={null}
        compatibilityMap={compatibilityMap}
        onModelChange={defaultOnModelChange}
      />
    );

    // Open the first dropdown (img2img/draft)
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);

    // Wait for options to appear — should only show compatible models (4 of 5)
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(4);
    });

    // The incompatible model should NOT be in the DOM at all
    expect(screen.queryByText("real-esrgan")).not.toBeInTheDocument();

    // Compatible models should still be visible
    expect(screen.getByText("flux-schnell")).toBeInTheDocument();
    expect(screen.getByText("flux-1.1-pro")).toBeInTheDocument();
  });
});
