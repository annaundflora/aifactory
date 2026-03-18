// @vitest-environment jsdom
/**
 * Tests for MODE_LABELS and TIERS_BY_MODE constants in model-mode-section.tsx
 * Slice: slice-08-types-seed
 *
 * Since MODE_LABELS and TIERS_BY_MODE are not exported, we verify their values
 * through the component's rendered output for each GenerationMode.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

import type { CollectionModel } from "@/lib/types/collection-model";
import type { GenerationMode, Tier } from "@/lib/types";
import { ModelModeSection } from "@/components/settings/model-mode-section";

interface MockModelSetting {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Settings covering all 9 valid mode/tier combinations
const SETTINGS: MockModelSetting[] = [
  { id: "1", mode: "txt2img", tier: "draft", modelId: "owner/m1", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", mode: "txt2img", tier: "quality", modelId: "owner/m2", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", mode: "txt2img", tier: "max", modelId: "owner/m3", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", mode: "img2img", tier: "draft", modelId: "owner/m4", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "5", mode: "img2img", tier: "quality", modelId: "owner/m5", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "6", mode: "upscale", tier: "quality", modelId: "owner/m6", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "7", mode: "upscale", tier: "max", modelId: "owner/m7", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "8", mode: "inpaint", tier: "quality", modelId: "owner/m8", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "9", mode: "outpaint", tier: "quality", modelId: "owner/m9", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
];

const COLLECTION_MODELS: CollectionModel[] = [
  { url: "https://replicate.com/owner/m1", owner: "owner", name: "m1", description: "Model 1", cover_image_url: null, run_count: 100, created_at: "2024-01-01" },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderSection(mode: GenerationMode) {
  return render(
    <ModelModeSection
      mode={mode}
      settings={SETTINGS as any}
      collectionModels={COLLECTION_MODELS}
      collectionError={null}
      compatibilityMap={{}}
      onModelChange={vi.fn()}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests: MODE_LABELS (AC-3)
// ---------------------------------------------------------------------------

describe("MODE_LABELS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-3: GIVEN model-mode-section.tsx
   *       WHEN MODE_LABELS fuer alle 5 GenerationMode-Keys abgefragt wird
   *       THEN gibt es Eintraege: txt2img: "TEXT TO IMAGE", img2img: "IMAGE TO IMAGE",
   *            upscale: "UPSCALE", inpaint: "INPAINT", outpaint: "OUTPAINT"
   */
  it('AC-3: should have labels for all 5 generation modes', () => {
    const expectedLabels: Record<GenerationMode, string> = {
      txt2img: "TEXT TO IMAGE",
      img2img: "IMAGE TO IMAGE",
      upscale: "UPSCALE",
      inpaint: "INPAINT",
      outpaint: "OUTPAINT",
    };

    for (const [mode, label] of Object.entries(expectedLabels)) {
      const { unmount } = renderSection(mode as GenerationMode);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: TIERS_BY_MODE (AC-4 through AC-8)
// ---------------------------------------------------------------------------

describe("TIERS_BY_MODE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-4: GIVEN model-mode-section.tsx
   *       WHEN TIERS_BY_MODE["txt2img"] abgefragt wird
   *       THEN ist der Wert ["draft", "quality", "max"] (unveraendert)
   */
  it('AC-4: should map txt2img to draft, quality, max', () => {
    renderSection("txt2img");

    // All three tier labels present
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();

    // Exactly 3 combobox triggers (dropdowns)
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(3);
  });

  /**
   * AC-5: GIVEN model-mode-section.tsx
   *       WHEN TIERS_BY_MODE["img2img"] abgefragt wird
   *       THEN ist der Wert ["draft", "quality"] (NICHT mehr ["draft", "quality", "max"])
   */
  it('AC-5: should map img2img to draft, quality only (no max)', () => {
    renderSection("img2img");

    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.queryByText("Max")).not.toBeInTheDocument();

    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(2);
  });

  /**
   * AC-6: GIVEN model-mode-section.tsx
   *       WHEN TIERS_BY_MODE["upscale"] abgefragt wird
   *       THEN ist der Wert ["quality", "max"] (NICHT mehr ["draft", "quality"])
   */
  it('AC-6: should map upscale to quality, max only (no draft)', () => {
    renderSection("upscale");

    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();

    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(2);
  });

  /**
   * AC-7: GIVEN model-mode-section.tsx
   *       WHEN TIERS_BY_MODE["inpaint"] abgefragt wird
   *       THEN ist der Wert ["quality"]
   */
  it('AC-7: should map inpaint to quality only', () => {
    renderSection("inpaint");

    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.queryByText("Max")).not.toBeInTheDocument();

    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(1);
  });

  /**
   * AC-8: GIVEN model-mode-section.tsx
   *       WHEN TIERS_BY_MODE["outpaint"] abgefragt wird
   *       THEN ist der Wert ["quality"]
   */
  it('AC-8: should map outpaint to quality only', () => {
    renderSection("outpaint");

    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.queryByText("Max")).not.toBeInTheDocument();

    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(1);
  });
});
