// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import type { ReferenceSlotData } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix uses ResizeObserver / DOMRect internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (!Element.prototype.getBoundingClientRect) {
    Element.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        top: 0,
        right: 100,
        bottom: 40,
        left: 0,
        toJSON() {},
      }) as DOMRect;
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
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
  ArrowRightLeft: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right-left" {...props} />
  ),
  Minus: (props: Record<string, unknown>) => (
    <span data-testid="icon-minus" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="icon-plus" {...props} />
  ),
  ChevronDown: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
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
  Copy: (props: Record<string, unknown>) => (
    <span data-testid="icon-copy" {...props} />
  ),
  Sparkle: (props: Record<string, unknown>) => (
    <span data-testid="icon-sparkle" {...props} />
  ),
  ArrowUpRight: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-up-right" {...props} />
  ),
}));

// Mock ReferenceBar (complex sub-component)
vi.mock("@/components/workspace/reference-bar", () => ({
  ReferenceBar: (props: {
    slots: ReferenceSlotData[];
    onAdd?: (file: File, position: number) => void;
    onRemove?: (slotPosition: number) => void;
    onRoleChange?: (slotPosition: number, role: string) => void;
    onStrengthChange?: (slotPosition: number, strength: string) => void;
    onUpload?: (file: File, slotPosition: number) => void;
    onUploadUrl?: (url: string, slotPosition: number) => void;
  }) => (
    <div data-testid="reference-bar-mock">
      <span data-testid="reference-bar-slot-count">{props.slots.length}</span>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import {
  Img2imgPopover,
  type Img2imgParams,
} from "@/components/canvas/popovers/img2img-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";
// Tier type removed from @/lib/types in slice-03; no longer imported

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-img2img-tier-1",
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

/**
 * Renders Img2imgPopover inside CanvasDetailProvider with optional active tool.
 */
function renderImg2imgPopover(
  overrides: Partial<{
    generation: Generation;
    onGenerate: (params: Img2imgParams) => void;
    initialActiveToolId: string | null;
  }> = {}
) {
  const generation = overrides.generation ?? makeGeneration();
  const onGenerate = overrides.onGenerate ?? vi.fn();
  const initialActiveToolId = overrides.initialActiveToolId ?? null;

  function SetupDispatcher({ children }: { children: ReactNode }) {
    const { dispatch } = useCanvasDetail();

    const ref = React.useRef(false);
    React.useEffect(() => {
      if (!ref.current && initialActiveToolId) {
        ref.current = true;
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: initialActiveToolId });
      }
    }, [dispatch]);

    return <>{children}</>;
  }

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetupDispatcher>
        <Img2imgPopover onGenerate={onGenerate} />
      </SetupDispatcher>
    </CanvasDetailProvider>
  );

  return { ...result, onGenerate, generation };
}

// ---------------------------------------------------------------------------
// Tests: Img2imgPopover TierToggle (Slice 09 ACs)
// ---------------------------------------------------------------------------

describe("Img2imgPopover TierToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-4: TierToggle sichtbar mit Draft Default
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN das Img2Img-Popover wird geoeffnet
   *       WHEN es gerendert wird
   *       THEN zeigt es einen TierToggle (Draft | Quality) oberhalb des
   *            Generate-Buttons, Default-Segment ist "Draft"
   */
  it("AC-4: should render TierToggle with Draft as default active segment", async () => {
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("img2img-popover");
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
    const tierSection = screen.getByTestId("tier-section");
    const generateButton = screen.getByTestId("generate-button");
    const popoverContent = popover;
    const allElements = popoverContent.querySelectorAll(
      '[data-testid="tier-section"], [data-testid="generate-button"]'
    );
    expect(allElements[0]).toBe(tierSection);
    expect(allElements[1]).toBe(generateButton);
  });

  // -------------------------------------------------------------------------
  // AC-5: Max-Segment im TierToggle direkt anklickbar
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN das Img2Img-Popover ist geoeffnet
   *       WHEN der User auf "Max" im TierToggle klickt
   *       THEN wechselt das aktive Segment zu "Max"
   */
  it("AC-5: should switch to Max tier directly via TierToggle segment", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    // Wait for popover
    await screen.findByTestId("img2img-popover");

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
  // AC-13: Unabhaengiger Tier-State
  // -------------------------------------------------------------------------

  /**
   * AC-13: GIVEN Variation-Popover und Img2Img-Popover jeweils geoeffnet
   *        WHEN User in Variation-Popover auf "Quality" wechselt
   *        THEN bleibt der Tier-State im Img2Img-Popover auf "Draft" (unabhaengig)
   *
   * Note: Since each popover manages its own useState<Tier>("draft"), changing
   * one does not affect the other. We test this by rendering both popovers:
   * first activate variation and change its tier to "Quality", then switch
   * directly to img2img (the reducer replaces activeToolId when a different
   * tool is dispatched) and verify img2img still starts at "Draft".
   */
  it("AC-13: should maintain independent tier state from other popovers", async () => {
    const user = userEvent.setup();

    // We need a component that allows switching between active tools
    // to verify independence of tier state per popover.
    function TestHarness() {
      const { dispatch } = useCanvasDetail();
      return (
        <>
          <button
            data-testid="activate-variation"
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_TOOL", toolId: "variation" })
            }
          >
            Activate Variation
          </button>
          <button
            data-testid="activate-img2img"
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_TOOL", toolId: "img2img" })
            }
          >
            Activate Img2Img
          </button>
        </>
      );
    }

    // Need to import VariationPopover here for the combined test
    const { VariationPopover } = await import(
      "@/components/canvas/popovers/variation-popover"
    );

    const generation = makeGeneration();
    const onVariationGenerate = vi.fn();
    const onImg2imgGenerate = vi.fn();

    render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <TestHarness />
        <VariationPopover
          generation={generation}
          onGenerate={onVariationGenerate}
        />
        <Img2imgPopover onGenerate={onImg2imgGenerate} />
      </CanvasDetailProvider>
    );

    // Step 1: Open the variation popover
    const activateVariation = screen.getByTestId("activate-variation");
    await user.click(activateVariation);

    // Wait for variation popover to appear
    const variationPopover = await screen.findByTestId("variation-popover");
    expect(variationPopover).toBeInTheDocument();

    // Step 2: Change Variation tier to "Quality"
    const qualityButtons = screen.getAllByText("Quality");
    // The Quality button inside the variation popover
    const variationQualityBtn = qualityButtons[0];
    await user.click(variationQualityBtn);

    // Verify variation popover now has Quality active
    expect(variationQualityBtn).toHaveAttribute("aria-pressed", "true");

    // Step 3: Directly switch to img2img (reducer sets activeToolId="img2img",
    // which causes variation popover to close and img2img popover to open)
    const activateImg2img = screen.getByTestId("activate-img2img");
    await user.click(activateImg2img);

    // Wait for img2img popover to appear
    const img2imgPopover = await screen.findByTestId("img2img-popover");
    expect(img2imgPopover).toBeInTheDocument();

    // Step 4: Verify img2img TierToggle is still at "Draft" (independent state)
    // We need to find the Draft/Quality buttons within the img2img popover
    // since the variation popover's buttons may still be transitioning out
    const img2imgDraftBtn = within(img2imgPopover).getByText("Draft");
    expect(img2imgDraftBtn).toHaveAttribute("aria-pressed", "true");
    expect(img2imgDraftBtn).toHaveAttribute("data-active", "true");

    const img2imgQualityBtn = within(img2imgPopover).getByText("Quality");
    expect(img2imgQualityBtn).toHaveAttribute("aria-pressed", "false");
    expect(img2imgQualityBtn).toHaveAttribute("data-active", "false");
  });
});

// ---------------------------------------------------------------------------
// Tests: Img2imgParams interface (Slice 09 AC-7)
// ---------------------------------------------------------------------------

describe("Img2imgParams interface", () => {
  /**
   * AC-7: GIVEN Img2imgParams Interface
   *       WHEN inspiziert
   *       THEN enthaelt es ein Feld tier vom Typ Tier ("draft" | "quality" | "max")
   */
  it("AC-7: should include tier field in Img2imgParams", () => {
    // Type-level check: Create an Img2imgParams object with each valid Tier value.
    // If the interface does NOT include `tier: Tier`, this code would cause a
    // TypeScript compilation error.
    const draftParams: Img2imgParams = {
      references: [],
      motiv: "test",
      style: "",
      variants: 1,
      modelIds: [],
      tier: "draft",
    };
    expect(draftParams.tier).toBe("draft");

    const qualityParams: Img2imgParams = {
      references: [],
      motiv: "test",
      style: "",
      variants: 1,
      modelIds: [],
      tier: "quality",
    };
    expect(qualityParams.tier).toBe("quality");

    const maxParams: Img2imgParams = {
      references: [],
      motiv: "test",
      style: "",
      variants: 1,
      modelIds: [],
      tier: "max",
    };
    expect(maxParams.tier).toBe("max");

    // Verify that all Tier values are assignable
    const allTiers: ("draft" | "quality" | "max")[] = ["draft", "quality", "max"];
    for (const tier of allTiers) {
      const params: Img2imgParams = {
        references: [],
        motiv: "test",
        style: "",
        variants: 1,
        modelIds: [],
        tier,
      };
      expect(allTiers).toContain(params.tier);
    }
  });
});
