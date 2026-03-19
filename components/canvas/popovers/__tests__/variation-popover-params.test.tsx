// @vitest-environment jsdom
/**
 * Slice-06: ParameterPanel Mount + imageParams State in Variation Popover
 *
 * Tests AC-1, AC-3, AC-5, AC-6, AC-9 from the slice-06-canvas-popovers-mount spec.
 * Mocking Strategy: mock_external (per spec).
 */
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
  ChevronDown: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-up" {...props} />
  ),
}));

// Mock useModelSchema — controlled via mockUseModelSchemaReturn
const mockUseModelSchemaReturn = {
  schema: null as Record<string, unknown> | null,
  isLoading: false,
  error: null as string | null,
};

vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: () => mockUseModelSchemaReturn,
}));

// Mock resolveModel — returns a modelId based on settings/mode/tier
vi.mock("@/lib/utils/resolve-model", () => ({
  resolveModel: (
    settings: Array<{ mode: string; tier: string; modelId: string }>,
    mode: string,
    tier: string,
  ) => {
    const setting = settings.find((s) => s.mode === mode && s.tier === tier);
    if (!setting) return undefined;
    return { modelId: setting.modelId, modelParams: {} };
  },
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
import type { Generation, ModelSetting } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-variation-param-1",
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

function makeModelSettings(
  overrides: Partial<{
    draftModelId: string;
    qualityModelId: string;
  }> = {},
): ModelSetting[] {
  return [
    {
      id: "ms-draft",
      mode: "img2img",
      tier: "draft",
      modelId: overrides.draftModelId ?? "black-forest-labs/flux-schnell",
      modelParams: {},
      createdAt: new Date("2025-06-15T12:00:00Z"),
      updatedAt: new Date("2025-06-15T12:00:00Z"),
    },
    {
      id: "ms-quality",
      mode: "img2img",
      tier: "quality",
      modelId: overrides.qualityModelId ?? "black-forest-labs/flux-pro",
      modelParams: {},
      createdAt: new Date("2025-06-15T12:00:00Z"),
      updatedAt: new Date("2025-06-15T12:00:00Z"),
    },
  ] as ModelSetting[];
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
 * set to "variation" (popover visible) and optional modelSettings.
 */
function renderPopoverOpen(options?: {
  generation?: Generation;
  onGenerate?: (params: VariationParams) => void;
  modelSettings?: ModelSetting[];
}) {
  const generation = options?.generation ?? makeGeneration();
  const onGenerate = options?.onGenerate ?? vi.fn();
  const modelSettings = options?.modelSettings ?? makeModelSettings();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <ActivateVariationTool />
      <VariationPopover
        generation={generation}
        onGenerate={onGenerate}
        modelSettings={modelSettings}
      />
    </CanvasDetailProvider>,
  );

  return { ...result, generation, onGenerate };
}

// ---------------------------------------------------------------------------
// Tests: VariationPopover – ParameterPanel Mount (Slice 06)
// ---------------------------------------------------------------------------

describe("VariationPopover – ParameterPanel Mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values to defaults
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;
  });

  // -------------------------------------------------------------------------
  // AC-1: ParameterPanel sichtbar mit Primary-Controls
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN das Variation-Popover ist offen mit Tier "draft" und modelSettings
   *       enthaelt ein Setting fuer img2img/draft mit modelId "black-forest-labs/flux-schnell"
   *       WHEN useModelSchema ein Schema mit aspect_ratio (enum) zurueckgibt
   *       THEN erscheint ein ParameterPanel zwischen dem TierToggle/MaxQualityToggle-Bereich
   *       und dem Generate-Button, das aspect_ratio als Primary-Control zeigt
   */
  it("AC-1: should render ParameterPanel with primary controls between tier section and generate button", async () => {
    // Setup: useModelSchema returns a schema with aspect_ratio enum
    mockUseModelSchemaReturn.schema = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16", "4:3", "3:2"],
        default: "1:1",
        title: "Aspect Ratio",
      },
    };
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;

    renderPopoverOpen({
      modelSettings: makeModelSettings({
        draftModelId: "black-forest-labs/flux-schnell",
      }),
    });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // ParameterPanel should be rendered with data-testid="parameter-panel"
    const parameterPanel = screen.getByTestId("parameter-panel");
    expect(parameterPanel).toBeInTheDocument();

    // Primary section should be visible with aspect_ratio control
    const primarySection = screen.getByTestId("parameter-panel-primary");
    expect(primarySection).toBeInTheDocument();

    // The aspect_ratio select should exist
    const aspectRatioSelect = screen.getByLabelText("Aspect Ratio");
    expect(aspectRatioSelect).toBeInTheDocument();

    // Verify DOM ordering: tier section -> parameter panel -> generate button
    const tierSection = screen.getByTestId("variation-tier-section");
    const generateButton = screen.getByTestId("variation-generate-button");

    // All three should be in order within the popover
    const allKeyElements = popover.querySelectorAll(
      '[data-testid="variation-tier-section"], [data-testid="parameter-panel"], [data-testid="variation-generate-button"]',
    );
    expect(allKeyElements.length).toBeGreaterThanOrEqual(3);
    expect(allKeyElements[0]).toBe(tierSection);
    expect(allKeyElements[1]).toBe(parameterPanel);
    expect(allKeyElements[2]).toBe(generateButton);
  });

  // -------------------------------------------------------------------------
  // AC-3: imageParams im onGenerate Callback enthalten
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN das Variation-Popover zeigt ParameterPanel mit aspect_ratio
   *       WHEN der User den Wert auf "16:9" aendert und auf Generate klickt
   *       THEN wird onGenerate mit VariationParams aufgerufen, wobei imageParams
   *       den Wert { aspect_ratio: "16:9" } enthaelt
   */
  it("AC-3: should include imageParams in onGenerate callback when user selects parameter values", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    // Setup: useModelSchema returns a schema with aspect_ratio enum
    mockUseModelSchemaReturn.schema = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16", "4:3", "3:2"],
        default: "1:1",
        title: "Aspect Ratio",
      },
    };
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;

    renderPopoverOpen({ onGenerate });

    // Wait for the popover to be visible
    await screen.findByTestId("variation-popover");

    // ParameterPanel should be visible
    expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();

    // Open the aspect_ratio select dropdown and choose "16:9"
    const aspectRatioTrigger = screen.getByLabelText("Aspect Ratio");
    await user.click(aspectRatioTrigger);

    // Find and click the "16:9" option
    const option16x9 = await screen.findByText("16:9");
    await user.click(option16x9);

    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Verify onGenerate was called with imageParams containing aspect_ratio: "16:9"
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.imageParams).toBeDefined();
    expect(params.imageParams).toEqual({ aspect_ratio: "16:9" });
  });

  // -------------------------------------------------------------------------
  // AC-5: Skeleton waehrend Schema-Loading
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN useModelSchema gibt { isLoading: true } zurueck in einem der Popovers
   *       WHEN das Popover gerendert wird
   *       THEN zeigt der Bereich zwischen TierToggle und Generate-Button
   *       Skeleton-Platzhalter (aus ParameterPanel)
   */
  it("AC-5: should render skeleton placeholders while schema is loading", async () => {
    // Setup: useModelSchema returns isLoading: true
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = true;
    mockUseModelSchemaReturn.error = null;

    renderPopoverOpen();

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // The loading skeleton should be rendered
    const loadingSkeleton = screen.getByTestId("parameter-panel-loading");
    expect(loadingSkeleton).toBeInTheDocument();

    // There should NOT be the actual parameter-panel (non-loading)
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

    // The generate button should still be present (functional)
    const generateBtn = screen.getByTestId("variation-generate-button");
    expect(generateBtn).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-6: imageParams Reset bei Tier-Wechsel
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der User aendert im Variation-Popover den Tier von "draft" zu "quality"
   *       (anderes Model)
   *       WHEN das neue Schema geladen wird
   *       THEN wird imageParams auf {} zurueckgesetzt
   */
  it("AC-6: should reset imageParams when tier changes", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    // Setup: useModelSchema returns a schema with aspect_ratio
    mockUseModelSchemaReturn.schema = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16", "4:3", "3:2"],
        default: "1:1",
        title: "Aspect Ratio",
      },
    };
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;

    renderPopoverOpen({
      onGenerate,
      modelSettings: makeModelSettings({
        draftModelId: "black-forest-labs/flux-schnell",
        qualityModelId: "black-forest-labs/flux-pro",
      }),
    });

    // Wait for the popover to be visible
    await screen.findByTestId("variation-popover");

    // Step 1: Change aspect_ratio to "16:9" while in draft tier
    const aspectRatioTrigger = screen.getByLabelText("Aspect Ratio");
    await user.click(aspectRatioTrigger);
    const option16x9 = await screen.findByText("16:9");
    await user.click(option16x9);

    // Step 2: Switch tier from "draft" to "quality"
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);

    // Step 3: Click Generate — imageParams should be reset to {}
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    // imageParams should be reset to {} because the modelId changed when tier changed
    expect(params.imageParams).toEqual({});
    expect(params.tier).toBe("quality");
  });

  // -------------------------------------------------------------------------
  // AC-9: Kein ParameterPanel bei Schema-Error
  // -------------------------------------------------------------------------

  /**
   * AC-9: GIVEN useModelSchema gibt { error: "..." } zurueck
   *       WHEN das Popover gerendert wird
   *       THEN wird KEIN ParameterPanel gerendert (graceful degradation)
   *       und der Generate-Button bleibt funktional
   */
  it("AC-9: should not render ParameterPanel when schema fetch returns error", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    // Setup: useModelSchema returns an error
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = "Failed to fetch schema";

    renderPopoverOpen({ onGenerate });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // ParameterPanel should NOT be rendered (neither loading nor loaded)
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("parameter-panel-loading"),
    ).not.toBeInTheDocument();

    // Generate button should still be functional
    const generateBtn = screen.getByTestId("variation-generate-button");
    expect(generateBtn).toBeInTheDocument();
    await user.click(generateBtn);

    // onGenerate should still work
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.imageParams).toEqual({});
  });
});
