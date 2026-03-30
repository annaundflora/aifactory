// @vitest-environment jsdom
/**
 * Slice-06: ParameterPanel Mount + imageParams State in Img2img Popover
 *
 * Tests AC-2, AC-4, AC-5, AC-9 from the slice-06-canvas-popovers-mount spec.
 * Mocking Strategy: mock_external (per spec).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
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

  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    } as unknown as typeof globalThis.PointerEvent;
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
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-up" {...props} />
  ),
  CheckIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
}));

// Mock ReferenceBar (complex sub-component, not under test)
vi.mock("@/components/workspace/reference-bar", () => ({
  ReferenceBar: (props: {
    slots: ReferenceSlotData[];
  }) => (
    <div data-testid="reference-bar-mock">
      <span data-testid="reference-bar-slot-count">{props.slots.length}</span>
    </div>
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
  Img2imgPopover,
  type Img2imgParams,
} from "@/components/canvas/popovers/img2img-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

/** @deprecated Legacy type kept for backward compat until consumers migrate to ModelSlot. */
type ModelSetting = {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-img2img-param-1",
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

function makeModelSettings(
  overrides: Partial<{
    qualityModelId: string;
  }> = {},
): ModelSetting[] {
  return [
    {
      id: "ms-draft",
      mode: "img2img",
      tier: "draft",
      modelId: "black-forest-labs/flux-schnell",
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
 * Renders Img2imgPopover inside CanvasDetailProvider with optional active tool
 * dispatch on mount and modelSettings.
 */
function renderImg2imgPopover(
  overrides: Partial<{
    generation: Generation;
    onGenerate: (params: Img2imgParams) => void;
    initialActiveToolId: string | null;
    modelSettings: ModelSetting[];
  }> = {},
) {
  const generation = overrides.generation ?? makeGeneration();
  const onGenerate = overrides.onGenerate ?? vi.fn();
  const initialActiveToolId = overrides.initialActiveToolId ?? null;
  const modelSettings = overrides.modelSettings ?? makeModelSettings();

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
        <Img2imgPopover
          onGenerate={onGenerate}
          modelSettings={modelSettings}
        />
      </SetupDispatcher>
    </CanvasDetailProvider>,
  );

  return { ...result, onGenerate, generation };
}

// ---------------------------------------------------------------------------
// Tests: Img2imgPopover – ParameterPanel Mount (Slice 06)
// ---------------------------------------------------------------------------

describe("Img2imgPopover – ParameterPanel Mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values to defaults
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;
  });

  // -------------------------------------------------------------------------
  // AC-2: ParameterPanel sichtbar mit Primary-Controls
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN das Img2img-Popover ist offen mit Tier "quality" und modelSettings
   *       enthaelt ein Setting fuer img2img/quality
   *       WHEN useModelSchema ein Schema mit aspect_ratio und resolution (enums) zurueckgibt
   *       THEN erscheint ein ParameterPanel zwischen dem Tier-Section und dem Generate-Button,
   *       das beide Primary-Controls zeigt
   */
  it("AC-2: should render ParameterPanel with primary controls between tier section and generate button", async () => {
    // Setup: useModelSchema returns a schema with aspect_ratio and resolution
    mockUseModelSchemaReturn.schema = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16", "4:3", "3:2"],
        default: "1:1",
        title: "Aspect Ratio",
      },
      resolution: {
        type: "string",
        enum: ["1K", "2K", "4K"],
        default: "1K",
        title: "Resolution",
      },
    };
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSettings: makeModelSettings({ qualityModelId: "black-forest-labs/flux-pro" }),
    });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // ParameterPanel should be rendered inside the parameter-section
    const parameterSection = screen.getByTestId("parameter-section");
    expect(parameterSection).toBeInTheDocument();

    const parameterPanel = screen.getByTestId("parameter-panel");
    expect(parameterPanel).toBeInTheDocument();

    // Primary section should show both controls
    const primarySection = screen.getByTestId("parameter-panel-primary");
    expect(primarySection).toBeInTheDocument();

    // Both aspect_ratio and resolution selects should exist
    const aspectRatioSelect = screen.getByLabelText("Aspect Ratio");
    expect(aspectRatioSelect).toBeInTheDocument();

    const resolutionSelect = screen.getByLabelText("Resolution");
    expect(resolutionSelect).toBeInTheDocument();

    // Verify DOM ordering: tier-section -> parameter-section -> generate-button
    const tierSection = screen.getByTestId("tier-section");
    const generateButton = screen.getByTestId("generate-button");

    const allKeyElements = popover.querySelectorAll(
      '[data-testid="tier-section"], [data-testid="parameter-section"], [data-testid="generate-button"]',
    );
    expect(allKeyElements.length).toBeGreaterThanOrEqual(3);
    expect(allKeyElements[0]).toBe(tierSection);
    expect(allKeyElements[1]).toBe(parameterSection);
    expect(allKeyElements[2]).toBe(generateButton);
  });

  // -------------------------------------------------------------------------
  // AC-4: imageParams im onGenerate Callback enthalten
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN das Img2img-Popover zeigt ParameterPanel mit aspect_ratio
   *       WHEN der User den Wert auf "3:2" aendert und auf Generate klickt
   *       THEN wird onGenerate mit Img2imgParams aufgerufen, wobei imageParams
   *       den Wert { aspect_ratio: "3:2" } enthaelt
   */
  it("AC-4: should include imageParams in onGenerate callback when user selects parameter values", async () => {
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

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      onGenerate,
    });

    // Wait for the popover to be visible
    await screen.findByTestId("img2img-popover");

    // ParameterPanel should be visible
    expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();

    // Open the aspect_ratio select dropdown and choose "3:2"
    const aspectRatioTrigger = screen.getByLabelText("Aspect Ratio");
    await user.click(aspectRatioTrigger);

    // Find and click the "3:2" option
    const option3x2 = await screen.findByText("3:2");
    await user.click(option3x2);

    // Click Generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // Verify onGenerate was called with imageParams containing aspect_ratio: "3:2"
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as Img2imgParams;
    expect(params.imageParams).toBeDefined();
    expect(params.imageParams).toEqual({ aspect_ratio: "3:2" });
  });

  // -------------------------------------------------------------------------
  // AC-5: Skeleton waehrend Schema-Loading
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN useModelSchema gibt { isLoading: true } zurueck in einem der Popovers
   *       WHEN das Popover gerendert wird
   *       THEN zeigt der Bereich zwischen Model-Auswahl und Generate-Button
   *       Skeleton-Platzhalter (aus ParameterPanel)
   */
  it("AC-5: should render skeleton placeholders while schema is loading", async () => {
    // Setup: useModelSchema returns isLoading: true
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = true;
    mockUseModelSchemaReturn.error = null;

    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // The loading skeleton should be rendered
    const loadingSkeleton = screen.getByTestId("parameter-panel-loading");
    expect(loadingSkeleton).toBeInTheDocument();

    // There should NOT be the actual parameter-panel (non-loading)
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

    // The generate button should still be present (functional)
    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeInTheDocument();
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

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      onGenerate,
    });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // ParameterPanel should NOT be rendered (neither loading nor loaded)
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("parameter-panel-loading"),
    ).not.toBeInTheDocument();
    // The parameter-section wrapper should also not be rendered (conditionally hidden)
    expect(
      screen.queryByTestId("parameter-section"),
    ).not.toBeInTheDocument();

    // Generate button should still be functional
    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeInTheDocument();
    await user.click(generateBtn);

    // onGenerate should still work
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as Img2imgParams;
    expect(params.imageParams).toEqual({});
  });
});
