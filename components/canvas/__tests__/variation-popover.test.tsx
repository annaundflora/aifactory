// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  // Radix Select uses pointer events which jsdom does not support
  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  // Radix may call scrollIntoView which jsdom does not support
  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  // Radix measures elements for positioning — mock hasPointerCapture / setPointerCapture / releasePointerCapture
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
// Mocks (mock_external strategy — mock lucide icons for deterministic rendering)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  Copy: (props: Record<string, unknown>) => (
    <span data-testid="icon-copy" {...props} />
  ),
  Sparkles: (props: Record<string, unknown>) => (
    <span data-testid="icon-sparkles" {...props} />
  ),
  ChevronDown: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-variation-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A beautiful sunset over mountains",
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

/**
 * Renders VariationPopover inside CanvasDetailProvider WITHOUT activating
 * the tool (popover not visible).
 */
function renderPopoverClosed(options?: {
  generation?: Generation;
  onGenerate?: (params: VariationParams) => void;
  initialToolId?: string;
}) {
  const generation = options?.generation ?? makeGeneration();
  const onGenerate = options?.onGenerate ?? vi.fn();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <VariationPopover generation={generation} onGenerate={onGenerate} />
    </CanvasDetailProvider>
  );

  return { ...result, generation, onGenerate };
}

/**
 * Helper component that activates a different tool (e.g. "img2img").
 */
function ActivateOtherTool({ toolId }: { toolId: string }) {
  const { dispatch } = useCanvasDetail();
  React.useEffect(() => {
    dispatch({ type: "SET_ACTIVE_TOOL", toolId });
  }, [dispatch, toolId]);
  return null;
}

/**
 * Renders VariationPopover with a different activeToolId (not "variation").
 */
function renderPopoverWithOtherTool(toolId: string) {
  const generation = makeGeneration();
  const onGenerate = vi.fn();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <ActivateOtherTool toolId={toolId} />
      <VariationPopover generation={generation} onGenerate={onGenerate} />
    </CanvasDetailProvider>
  );

  return { ...result, generation, onGenerate };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VariationPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: Popover sichtbar mit vorausgefuelltem Prompt
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN `activeToolId` ist `"variation"` im CanvasDetailContext und die
   *       aktuelle Generation hat `prompt: "A beautiful sunset over mountains"`
   *       WHEN das Popover gerendert wird
   *       THEN ist das Popover sichtbar, positioniert neben dem Variation-Toolbar-
   *            Icon, und das Prompt-Textarea ist mit `"A beautiful sunset over
   *            mountains"` vorausgefuellt
   */
  it('AC-1: should render popover with pre-filled prompt when activeToolId is "variation"', async () => {
    renderPopoverOpen({
      generation: makeGeneration({
        prompt: "A beautiful sunset over mountains",
      }),
    });

    // Popover content should be visible
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // Prompt textarea should be pre-filled
    const textarea = screen.getByTestId("variation-prompt");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("A beautiful sunset over mountains");
  });

  // -------------------------------------------------------------------------
  // AC-2: Prompt editierbar
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN das Variation-Popover ist sichtbar
   *       WHEN der User den Prompt-Text auf `"A dramatic sunset over mountains"` aendert
   *       THEN enthaelt das Textarea den neuen Text `"A dramatic sunset over mountains"`
   */
  it("AC-2: should allow editing the prompt text", async () => {
    const user = userEvent.setup();
    renderPopoverOpen({
      generation: makeGeneration({
        prompt: "A beautiful sunset over mountains",
      }),
    });

    const textarea = await screen.findByTestId("variation-prompt");

    // Clear and type new text
    await user.clear(textarea);
    await user.type(textarea, "A dramatic sunset over mountains");

    expect(textarea).toHaveValue("A dramatic sunset over mountains");
  });

  // -------------------------------------------------------------------------
  // AC-3: Count-Selector zeigt 1-4 mit initial 1
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN das Variation-Popover ist sichtbar
   *       WHEN das Popover gerendert wird
   *       THEN zeigt der Count-Selector 4 Buttons mit den Werten `1`, `2`, `3`, `4`
   *            und der Wert `1` ist initial selektiert
   */
  it("AC-5: should render count selector with buttons 1-4 and initial selection of 1", async () => {
    renderPopoverOpen();

    await screen.findByTestId("variation-popover");

    // Count selector container
    const countSelector = screen.getByTestId("variation-count-selector");
    expect(countSelector).toBeInTheDocument();
    expect(countSelector).toHaveAttribute("role", "radiogroup");

    // All 4 count buttons should exist
    const btn1 = screen.getByTestId("variation-count-1");
    const btn2 = screen.getByTestId("variation-count-2");
    const btn3 = screen.getByTestId("variation-count-3");
    const btn4 = screen.getByTestId("variation-count-4");

    expect(btn1).toBeInTheDocument();
    expect(btn2).toBeInTheDocument();
    expect(btn3).toBeInTheDocument();
    expect(btn4).toBeInTheDocument();

    // Verify text content
    expect(btn1).toHaveTextContent("1");
    expect(btn2).toHaveTextContent("2");
    expect(btn3).toHaveTextContent("3");
    expect(btn4).toHaveTextContent("4");

    // Button 1 should be initially selected (aria-checked="true")
    expect(btn1).toHaveAttribute("aria-checked", "true");
    expect(btn2).toHaveAttribute("aria-checked", "false");
    expect(btn3).toHaveAttribute("aria-checked", "false");
    expect(btn4).toHaveAttribute("aria-checked", "false");

    // Button 1 should have default variant (not outline)
    expect(btn1).toHaveAttribute("data-variant", "default");
    expect(btn2).toHaveAttribute("data-variant", "outline");
    expect(btn3).toHaveAttribute("data-variant", "outline");
    expect(btn4).toHaveAttribute("data-variant", "outline");
  });

  // -------------------------------------------------------------------------
  // AC-6: Count-Wert aenderbar
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der Count-Selector zeigt `1` als selektiert
   *       WHEN der User auf den Button `3` klickt
   *       THEN ist `3` visuell selektiert und der vorherige Wert `1` ist deselektiert
   */
  it("AC-6: should update selected count when a different count button is clicked", async () => {
    const user = userEvent.setup();
    renderPopoverOpen();

    await screen.findByTestId("variation-popover");

    const btn1 = screen.getByTestId("variation-count-1");
    const btn3 = screen.getByTestId("variation-count-3");

    // Initially 1 is selected
    expect(btn1).toHaveAttribute("aria-checked", "true");
    expect(btn3).toHaveAttribute("aria-checked", "false");

    // Click on 3
    await user.click(btn3);

    // Now 3 is selected, 1 is deselected
    expect(btn3).toHaveAttribute("aria-checked", "true");
    expect(btn1).toHaveAttribute("aria-checked", "false");

    // Variant should reflect selection
    expect(btn3).toHaveAttribute("data-variant", "default");
    expect(btn1).toHaveAttribute("data-variant", "outline");
  });

  // -------------------------------------------------------------------------
  // AC-7: Generate-Button ruft Callback mit korrekten Werten auf
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN das Variation-Popover ist sichtbar mit Prompt und Count
   *       WHEN der User auf den Generate-Button klickt
   *       THEN wird ein `onGenerate`-Callback aufgerufen mit
   *            `{ prompt, promptStyle, negativePrompt, count, tier }`
   *            und das Popover schliesst sich (`activeToolId` wird auf `null` gesetzt)
   */
  it("AC-5: should call onGenerate with prompt and count and close popover", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderPopoverOpen({
      generation: makeGeneration({
        prompt: "A beautiful sunset over mountains",
      }),
      onGenerate,
    });

    await screen.findByTestId("variation-popover");

    // Default state: prompt pre-filled, count 1
    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // onGenerate should be called with correct parameters
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith({
      prompt: "A beautiful sunset over mountains",
      promptStyle: "",
      negativePrompt: "",
      count: 1,
      tier: "draft",
      imageParams: {},
    });

    // Popover should close (activeToolId toggled to null)
    await waitFor(() => {
      expect(
        screen.queryByTestId("variation-popover")
      ).not.toBeInTheDocument();
    });
  });

  /**
   * AC-5 extended: Verify onGenerate with modified values (edited prompt and count)
   * to ensure all form values are correctly passed.
   */
  it("AC-5 extended: should call onGenerate with modified values after user edits form", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderPopoverOpen({
      generation: makeGeneration({
        prompt: "A beautiful sunset over mountains",
      }),
      onGenerate,
    });

    await screen.findByTestId("variation-popover");

    // Edit prompt
    const textarea = screen.getByTestId("variation-prompt");
    await user.clear(textarea);
    await user.type(textarea, "A dramatic ocean scene");

    // Change count to 3
    const btn3 = screen.getByTestId("variation-count-3");
    await user.click(btn3);

    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith({
      prompt: "A dramatic ocean scene",
      promptStyle: "",
      negativePrompt: "",
      count: 3,
      tier: "draft",
      imageParams: {},
    });
  });

  // -------------------------------------------------------------------------
  // AC-8: Klick ausserhalb schliesst Popover
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN das Variation-Popover ist sichtbar
   *       WHEN der User ausserhalb des Popovers klickt
   *       THEN schliesst sich das Popover (`activeToolId` wird auf `null` gesetzt)
   */
  it("AC-8: should close popover when clicking outside", async () => {
    const user = userEvent.setup();
    renderPopoverOpen();

    // Wait for popover to appear
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // Click outside the popover (on document body)
    await user.click(document.body);

    // Popover should close
    await waitFor(() => {
      expect(
        screen.queryByTestId("variation-popover")
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-9: Popover unsichtbar wenn nicht aktiv
  // -------------------------------------------------------------------------

  /**
   * AC-9: GIVEN `activeToolId` ist nicht `"variation"` (z.B. `null` oder `"img2img"`)
   *       WHEN die Komponente gerendert wird
   *       THEN ist das Popover nicht sichtbar (kein DOM-Element fuer Popover-Content)
   */
  it('AC-9: should not render popover content when activeToolId is null', () => {
    renderPopoverClosed();

    // Popover content should NOT be in the DOM
    expect(
      screen.queryByTestId("variation-popover")
    ).not.toBeInTheDocument();

    // Anchor should still exist (it is always rendered)
    expect(
      screen.getByTestId("variation-popover-anchor")
    ).toBeInTheDocument();
  });

  it('AC-9: should not render popover content when activeToolId is "img2img"', async () => {
    renderPopoverWithOtherTool("img2img");

    // Allow the effect to run
    await waitFor(() => {
      // Popover content should NOT be in the DOM
      expect(
        screen.queryByTestId("variation-popover")
      ).not.toBeInTheDocument();
    });
  });
});
