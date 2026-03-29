// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Popover / Select use these internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  Copy: (props: Record<string, unknown>) => (
    <span data-testid="icon-copy" {...props} />
  ),
  Sparkles: (props: Record<string, unknown>) => (
    <span data-testid="icon-sparkles" {...props} />
  ),
  CheckIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-up" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import {
  VariationPopover,
  type VariationParams,
} from "@/components/canvas/popovers/variation-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";
import type { Tier } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-tier-test-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A test prompt for tier testing",
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
 * Helper component that dispatches SET_ACTIVE_TOOL with toolId "variation"
 * on mount, making the popover visible.
 */
function ActivateVariationTool() {
  const { dispatch } = useCanvasDetail();
  React.useEffect(() => {
    dispatch({ type: "SET_ACTIVE_TOOL", toolId: "variation" });
  }, [dispatch]);
  return null;
}

/**
 * Renders VariationPopover inside CanvasDetailProvider with activeToolId
 * set to "variation" (popover visible).
 */
function renderPopoverOpen(options?: {
  generation?: Generation;
  onGenerate?: (params: VariationParams) => void;
}) {
  const generation = options?.generation ?? makeGeneration();
  const onGenerate = options?.onGenerate ?? vi.fn();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <ActivateVariationTool />
      <VariationPopover generation={generation} onGenerate={onGenerate} />
    </CanvasDetailProvider>
  );

  return { ...result, generation, onGenerate };
}

// ---------------------------------------------------------------------------
// Tests: VariationPopover TierToggle (Slice 09 ACs)
// ---------------------------------------------------------------------------

describe("VariationPopover TierToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: TierToggle sichtbar mit Draft Default
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN das Variation-Popover wird geoeffnet
   *       WHEN es gerendert wird
   *       THEN zeigt es einen TierToggle (Draft | Quality) oberhalb des
   *            Generate-Buttons, Default-Segment ist "Draft"
   */
  it("AC-1: should render TierToggle with Draft as default active segment", async () => {
    renderPopoverOpen();

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // TierToggle should be visible
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();

    // The "Draft" button should be active (aria-pressed=true)
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toBeInTheDocument();
    expect(draftButton).toHaveAttribute("aria-pressed", "true");
    expect(draftButton).toHaveAttribute("data-active", "true");

    // The "Quality" button should NOT be active
    const qualityButton = screen.getByText("Quality");
    expect(qualityButton).toBeInTheDocument();
    expect(qualityButton).toHaveAttribute("aria-pressed", "false");
    expect(qualityButton).toHaveAttribute("data-active", "false");

    // TierToggle should be above the Generate button in DOM order
    const tierSection = screen.getByTestId("variation-tier-section");
    const generateButton = screen.getByTestId("variation-generate-button");
    // Verify ordering: tier section comes before generate button
    const popoverContent = popover;
    const allElements = popoverContent.querySelectorAll(
      '[data-testid="variation-tier-section"], [data-testid="variation-generate-button"]'
    );
    expect(allElements[0]).toBe(tierSection);
    expect(allElements[1]).toBe(generateButton);
  });

  // -------------------------------------------------------------------------
  // AC-2: Max-Segment im TierToggle direkt anklickbar
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN das Variation-Popover ist geoeffnet
   *       WHEN der User auf "Max" im TierToggle klickt
   *       THEN wechselt das aktive Segment zu "Max"
   */
  it("AC-2: should switch to Max tier directly via TierToggle segment", async () => {
    const user = userEvent.setup();
    renderPopoverOpen();

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // All three segments should be visible
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();

    // Click on "Max" to switch tier
    const maxButton = screen.getByText("Max");
    await user.click(maxButton);

    // Max should now be active
    expect(maxButton).toHaveAttribute("aria-pressed", "true");
    expect(maxButton).toHaveAttribute("data-active", "true");

    // No separate MaxQualityToggle should exist
    expect(screen.queryByTestId("max-quality-toggle")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-8: onGenerate mit tier=draft
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN Variation-Popover mit tier="draft" und User klickt Generate
   *       WHEN onGenerate aufgerufen wird
   *       THEN enthaelt VariationParams.tier den Wert "draft"
   */
  it('AC-8: should call onGenerate with tier draft when Generate clicked in draft mode', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderPopoverOpen({ onGenerate });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // Default tier is "draft" -- just click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.tier).toBe("draft");
  });

  // -------------------------------------------------------------------------
  // AC-9: onGenerate mit tier=quality
  // -------------------------------------------------------------------------

  /**
   * AC-9: GIVEN Variation-Popover mit tier="quality",
   *       User klickt Generate
   *       WHEN onGenerate aufgerufen wird
   *       THEN enthaelt VariationParams.tier den Wert "quality"
   */
  it('AC-9: should call onGenerate with tier quality when Generate clicked in quality mode', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderPopoverOpen({ onGenerate });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // Switch to "Quality"
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);

    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.tier).toBe("quality");
  });

  // -------------------------------------------------------------------------
  // AC-10: onGenerate mit tier=max bei MaxQuality on
  // -------------------------------------------------------------------------

  /**
   * AC-10: GIVEN Variation-Popover mit tier="max" direkt im TierToggle,
   *        User klickt Generate
   *        WHEN onGenerate aufgerufen wird
   *        THEN enthaelt VariationParams.tier den Wert "max"
   */
  it('AC-10: should call onGenerate with tier max when Max segment is selected', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderPopoverOpen({ onGenerate });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // Switch to "Max" directly via TierToggle
    const maxButton = screen.getByText("Max");
    await user.click(maxButton);

    // Click Generate (tier should be "max")
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.tier).toBe("max");
  });
});

// ---------------------------------------------------------------------------
// Tests: VariationParams interface (Slice 09 AC-6)
// ---------------------------------------------------------------------------

describe("VariationParams interface", () => {
  /**
   * AC-6: GIVEN VariationParams Interface
   *       WHEN inspiziert
   *       THEN enthaelt es ein Feld tier vom Typ Tier ("draft" | "quality" | "max")
   */
  it("AC-6: should include tier field in VariationParams", () => {
    // Type-level check: Create a VariationParams object with each valid Tier value.
    // If the interface does NOT include `tier: Tier`, this code would cause a
    // TypeScript compilation error.
    const draftParams: VariationParams = {
      prompt: "test",
      count: 1,
      tier: "draft",
    };
    expect(draftParams.tier).toBe("draft");

    const qualityParams: VariationParams = {
      prompt: "test",
      count: 1,
      tier: "quality",
    };
    expect(qualityParams.tier).toBe("quality");

    const maxParams: VariationParams = {
      prompt: "test",
      count: 1,
      tier: "max",
    };
    expect(maxParams.tier).toBe("max");

    // Verify that the tier field accepts Tier type values
    const allTiers: Tier[] = ["draft", "quality", "max"];
    for (const tier of allTiers) {
      const params: VariationParams = {
        prompt: "test",
        count: 1,
        tier,
      };
      expect(allTiers).toContain(params.tier);
    }
  });
});
