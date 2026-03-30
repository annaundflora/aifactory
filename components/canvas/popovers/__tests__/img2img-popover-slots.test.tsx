// @vitest-environment jsdom
/**
 * Slice 10: Img2img Popover -- ModelSlots integration
 *
 * Tests AC-1 through AC-10 from slice-10-img2img-popover spec.
 * Mocking Strategy: mock_external (Server Actions, useModelSchema, getModelSlots via Vitest mocks)
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  Check: (props: Record<string, unknown>) => (
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

// Mock ReferenceBar (complex sub-component, not under test)
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

// Mock ModelSlots -- capture all props for assertion
let capturedModelSlotsProps: Record<string, unknown> = {};

vi.mock("@/components/ui/model-slots", () => ({
  ModelSlots: (props: Record<string, unknown>) => {
    capturedModelSlotsProps = props;
    return (
      <div
        data-testid="model-slots"
        data-variant={props.variant}
        data-mode={props.mode}
        data-disabled={String(props.disabled)}
      >
        ModelSlots mock
      </div>
    );
  },
}));

// Mock useModelSchema (used by legacy path)
vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: () => ({
    schema: null,
    isLoading: false,
    error: null,
  }),
}));

// Mock resolveActiveSlots -- return controlled results
const mockResolveActiveSlots = vi.fn();

vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: (...args: unknown[]) => mockResolveActiveSlots(...args),
}));

// Mock server actions (used by ModelSlots internally, but also needed here for module resolution)
vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: vi.fn(),
  toggleSlotActive: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import {
  Img2imgPopover,
  type Img2imgParams,
  type Img2imgPopoverProps,
} from "@/components/canvas/popovers/img2img-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-img2img-slots-1",
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

function createModelSlot(overrides: {
  slot: number;
  active?: boolean;
  modelId?: string | null;
  mode?: string;
  modelParams?: Record<string, unknown>;
}) {
  return {
    id: `slot-${overrides.slot}-id`,
    mode: overrides.mode ?? "img2img",
    slot: overrides.slot,
    modelId: overrides.modelId ?? null,
    modelParams: overrides.modelParams ?? {},
    active: overrides.active ?? false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function createModel(overrides: {
  replicateId: string;
  name: string;
  capabilities?: Record<string, boolean>;
}) {
  return {
    id: `model-${overrides.replicateId}`,
    replicateId: overrides.replicateId,
    owner: overrides.replicateId.split("/")[0] ?? "owner",
    name: overrides.name,
    description: null,
    coverImageUrl: null,
    runCount: 100,
    collections: null,
    capabilities: overrides.capabilities ?? { img2img: true },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

// Standard fixtures
const standardModelSlots = [
  createModelSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
  createModelSlot({ slot: 2, active: false, modelId: "black-forest-labs/flux-pro" }),
  createModelSlot({ slot: 3, active: false, modelId: null }),
];

const standardModels = [
  createModel({ replicateId: "black-forest-labs/flux-schnell", name: "Flux Schnell" }),
  createModel({ replicateId: "black-forest-labs/flux-pro", name: "Flux Pro" }),
];

/**
 * Renders Img2imgPopover inside CanvasDetailProvider with controllable state.
 */
function renderImg2imgPopover(
  overrides: Partial<{
    generation: Generation;
    onGenerate: (params: Img2imgParams) => void;
    initialActiveToolId: string | null;
    modelSlots: typeof standardModelSlots;
    models: typeof standardModels;
    isGenerating: boolean;
  }> = {},
) {
  const generation = overrides.generation ?? makeGeneration();
  const onGenerate = overrides.onGenerate ?? vi.fn();
  const initialActiveToolId = overrides.initialActiveToolId ?? null;
  const isGenerating = overrides.isGenerating ?? false;

  const popoverProps: Img2imgPopoverProps = {
    onGenerate,
    modelSlots: overrides.modelSlots ?? standardModelSlots,
    models: overrides.models ?? standardModels,
  };

  function SetupDispatcher({ children }: { children: ReactNode }) {
    const { dispatch } = useCanvasDetail();

    const ref = React.useRef(false);
    React.useEffect(() => {
      if (!ref.current) {
        ref.current = true;
        if (initialActiveToolId) {
          dispatch({ type: "SET_ACTIVE_TOOL", toolId: initialActiveToolId });
        }
        if (isGenerating) {
          dispatch({ type: "SET_GENERATING", isGenerating: true });
        }
      }
    }, [dispatch]);

    return <>{children}</>;
  }

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetupDispatcher>
        <Img2imgPopover {...popoverProps} />
      </SetupDispatcher>
    </CanvasDetailProvider>,
  );

  return { ...result, onGenerate, generation };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  capturedModelSlotsProps = {};

  // Default: resolveActiveSlots returns slot 1 as active
  mockResolveActiveSlots.mockReturnValue([
    { modelId: "black-forest-labs/flux-schnell", modelParams: {} },
  ]);
});

// ===========================================================================
// ACCEPTANCE TESTS (1:1 from GIVEN/WHEN/THEN in Slice-10 spec)
// ===========================================================================

describe("Img2imgPopover ModelSlots Acceptance (Slice 10)", () => {
  // -------------------------------------------------------------------------
  // AC-1: ModelSlots gerendert
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN der Img2img Popover wird geoeffnet (activeToolId === "img2img")
   *       und `modelSlots` + `models` Props sind uebergeben
   *       WHEN die Komponente rendert
   *       THEN wird eine `ModelSlots`-Komponente mit
   *       `variant="stacked"` und `mode="img2img"` gerendert
   */
  it('AC-1: should render ModelSlots with variant="stacked" and mode="img2img"', async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // ModelSlots should be rendered
    const modelSlotsEl = screen.getByTestId("model-slots");
    expect(modelSlotsEl).toBeInTheDocument();

    // ModelSlots should have variant="stacked" and mode="img2img"
    expect(modelSlotsEl).toHaveAttribute("data-variant", "stacked");
    expect(modelSlotsEl).toHaveAttribute("data-mode", "img2img");

    // Also verify via captured props
    expect(capturedModelSlotsProps.variant).toBe("stacked");
    expect(capturedModelSlotsProps.mode).toBe("img2img");
  });

  // -------------------------------------------------------------------------
  // AC-2: Generate sendet nur aktive Slot-ModelIds
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN der Img2img Popover zeigt ModelSlots mit Slot 1 (active, "flux-schnell")
   *       und Slot 2 (inactive, "flux-pro")
   *       WHEN der User auf "Generate" klickt
   *       THEN wird `onGenerate` mit `modelIds: ["black-forest-labs/flux-schnell"]`
   *       aufgerufen (nur aktive Slots)
   *       AND `tier` ist NICHT im Params-Objekt gesetzt (bleibt `undefined`)
   */
  it("AC-2: should call onGenerate with modelIds from active slots only", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    // resolveActiveSlots returns only the active slot (slot 1)
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "black-forest-labs/flux-schnell", modelParams: {} },
    ]);

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
      onGenerate,
    });

    await screen.findByTestId("img2img-popover");

    // Click Generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // Verify onGenerate was called
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as Img2imgParams;

    // Should contain only active slot modelIds
    expect(params.modelIds).toEqual(["black-forest-labs/flux-schnell"]);

    // tier should NOT be set (undefined)
    expect(params.tier).toBeUndefined();

    // resolveActiveSlots should have been called with the slots and mode
    expect(mockResolveActiveSlots).toHaveBeenCalledWith(standardModelSlots, "img2img");
  });

  // -------------------------------------------------------------------------
  // AC-3: Generate sendet mehrere aktive ModelIds
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN der Img2img Popover zeigt ModelSlots mit Slot 1 und Slot 2 beide active
   *       WHEN der User auf "Generate" klickt
   *       THEN wird `onGenerate` mit `modelIds` aufgerufen, das beide aktiven Model-IDs enthaelt
   */
  it("AC-3: should call onGenerate with multiple modelIds when multiple slots are active", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    const bothActiveSlots = [
      createModelSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
      createModelSlot({ slot: 2, active: true, modelId: "black-forest-labs/flux-pro" }),
    ];

    // resolveActiveSlots returns both active slots
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "black-forest-labs/flux-schnell", modelParams: {} },
      { modelId: "black-forest-labs/flux-pro", modelParams: {} },
    ]);

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: bothActiveSlots,
      models: standardModels,
      onGenerate,
    });

    await screen.findByTestId("img2img-popover");

    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as Img2imgParams;

    // Should contain both active model IDs
    expect(params.modelIds).toEqual([
      "black-forest-labs/flux-schnell",
      "black-forest-labs/flux-pro",
    ]);
  });

  // -------------------------------------------------------------------------
  // AC-4: Img2imgParams enthaelt modelIds und behaelt tier als optionales deprecated Feld
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN das `Img2imgParams` Interface
   *       WHEN es importiert wird
   *       THEN enthaelt es `modelIds: string[]` als Pflichtfeld
   *       AND alle anderen Felder (references, motiv, style, variants, imageParams) bleiben unveraendert
   */
  it("AC-4: should include modelIds in Img2imgParams as required field", () => {
    // Type-level check: modelIds is required
    const paramsWithModelIds: Img2imgParams = {
      references: [],
      motiv: "test motiv",
      style: "test style",
      variants: 2,
      modelIds: ["model-a", "model-b"],
    };
    expect(paramsWithModelIds.modelIds).toEqual(["model-a", "model-b"]);
    expect(paramsWithModelIds.references).toEqual([]);
    expect(paramsWithModelIds.motiv).toBe("test motiv");
    expect(paramsWithModelIds.style).toBe("test style");
    expect(paramsWithModelIds.variants).toBe(2);

    // imageParams is optional
    const paramsWithImageParams: Img2imgParams = {
      references: [],
      motiv: "test",
      style: "",
      variants: 1,
      modelIds: [],
      imageParams: { aspect_ratio: "16:9" },
    };
    expect(paramsWithImageParams.imageParams).toEqual({ aspect_ratio: "16:9" });
  });

  // -------------------------------------------------------------------------
  // AC-5: Per-Slot ParameterPanel via ModelSlots stacked, separates ParameterPanel entfaellt
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN der Img2img Popover zeigt ModelSlots
   *       WHEN Slot 1 aktiv ist mit einem zugewiesenen Model
   *       THEN wird unterhalb von Slot 1 ein Per-Slot ParameterPanel angezeigt
   *       (via ModelSlots stacked-Layout)
   *       AND das bisherige separate `<ParameterPanel>` Section wird im neuen Pfad
   *       NICHT mehr gerendert
   */
  it("AC-5: should show per-slot ParameterPanel via ModelSlots and remove separate ParameterPanel section", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // ModelSlots is rendered (which handles per-slot ParameterPanel internally via stacked variant)
    const modelSlotsEl = screen.getByTestId("model-slots");
    expect(modelSlotsEl).toBeInTheDocument();
    expect(modelSlotsEl).toHaveAttribute("data-variant", "stacked");

    // The separate legacy ParameterPanel section should NOT be rendered in the new path
    expect(screen.queryByTestId("parameter-section")).not.toBeInTheDocument();

    // The ModelSlots component received the slots including the active slot with a model
    expect(capturedModelSlotsProps.slots).toBeDefined();
    expect(capturedModelSlotsProps.variant).toBe("stacked");
  });

  // -------------------------------------------------------------------------
  // AC-6: Variants-Stepper funktioniert weiterhin oberhalb der ModelSlots
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der Img2img Popover wird geoeffnet
   *       WHEN der Popover rendert
   *       THEN zeigt der Variants-Stepper ([ - ] N [ + ]) weiterhin korrekt an
   *       AND Variants-Aenderung aktualisiert den lokalen State
   *       AND der Stepper liegt OBERHALB der ModelSlots-Komponente
   */
  it("AC-6: should render variants stepper above ModelSlots and update variants state", async () => {
    const user = userEvent.setup();

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // Variants section should be visible
    const variantsSection = screen.getByTestId("variants-section");
    expect(variantsSection).toBeInTheDocument();

    // Variants value starts at 1
    const variantsValue = screen.getByTestId("variants-value");
    expect(variantsValue).toHaveTextContent("1");

    // Minus and Plus buttons exist
    const minusBtn = screen.getByTestId("variants-minus");
    const plusBtn = screen.getByTestId("variants-plus");
    expect(minusBtn).toBeInTheDocument();
    expect(plusBtn).toBeInTheDocument();

    // Click plus to increment
    await user.click(plusBtn);
    expect(variantsValue).toHaveTextContent("2");

    // Click plus again
    await user.click(plusBtn);
    expect(variantsValue).toHaveTextContent("3");

    // Click minus to decrement
    await user.click(minusBtn);
    expect(variantsValue).toHaveTextContent("2");

    // Verify Variants section is ABOVE ModelSlots in DOM order
    const modelSlotsSection = screen.getByTestId("model-slots-section");
    const allSections = popover.querySelectorAll(
      '[data-testid="variants-section"], [data-testid="model-slots-section"]',
    );
    expect(allSections.length).toBe(2);
    expect(allSections[0]).toBe(variantsSection);
    expect(allSections[1]).toBe(modelSlotsSection);
  });

  // -------------------------------------------------------------------------
  // AC-7: Props require modelSlots and models
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN die `Img2imgPopoverProps`
   *       WHEN die Props definiert werden
   *       THEN akzeptiert die Komponente `modelSlots` (vom Typ `ModelSlot[]`)
   *       und `models` (vom Typ `Model[]`) als Pflicht-Props
   */
  it("AC-7: should accept modelSlots and models as required props", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // ModelSlots should be rendered
    expect(screen.getByTestId("model-slots")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-8: Disabled-State waehrend Generierung
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN der Img2img Popover ist geoeffnet und `state.isGenerating === true`
   *       WHEN die Komponente rendert
   *       THEN wird `disabled={true}` an die ModelSlots-Komponente uebergeben
   *       AND alle Slot-Checkboxen und Dropdowns sind deaktiviert
   */
  it("AC-8: should pass disabled=true to ModelSlots when isGenerating is true", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
      isGenerating: true,
    });

    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // ModelSlots should be rendered with disabled=true
    const modelSlotsEl = screen.getByTestId("model-slots");
    expect(modelSlotsEl).toBeInTheDocument();
    expect(modelSlotsEl).toHaveAttribute("data-disabled", "true");

    // Also verify via captured props
    expect(capturedModelSlotsProps.disabled).toBe(true);
  });

  // AC-9: Legacy fallback path removed in slice-15 cleanup.
  // modelSlots and models are now required props.

  // -------------------------------------------------------------------------
  // AC-10: Unveraenderte Sections (References, Prompt, Generate)
  // -------------------------------------------------------------------------

  /**
   * AC-10: GIVEN der Img2img Popover im neuen Pfad
   *        WHEN die Komponente rendert
   *        THEN bleiben References-Section (ReferenceBar), Prompt-Section
   *        (Motiv + Style Textareas) und Generate-Button unveraendert
   *        AND die Model-Section zeigt ModelSlots
   */
  it("AC-10: should keep references section, prompt section, and generate button unchanged", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // References section remains
    const referencesSection = screen.getByTestId("references-section");
    expect(referencesSection).toBeInTheDocument();
    expect(screen.getByTestId("reference-bar-mock")).toBeInTheDocument();

    // Prompt section remains with Motiv and Style textareas
    const promptSection = screen.getByTestId("prompt-section");
    expect(promptSection).toBeInTheDocument();
    expect(screen.getByTestId("motiv-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("style-textarea")).toBeInTheDocument();

    // Generate button remains
    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeInTheDocument();

    // ModelSlots is present (new path replacement for tier/parameter sections)
    expect(screen.getByTestId("model-slots")).toBeInTheDocument();

    // But legacy tier and parameter sections are NOT present
    expect(screen.queryByTestId("tier-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-section")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// UNIT TESTS
// ===========================================================================

describe("Img2imgPopover Unit (Slice 10)", () => {
  it("should determine new path when both modelSlots and models are provided", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    await screen.findByTestId("img2img-popover");
    expect(screen.getByTestId("model-slots")).toBeInTheDocument();
    expect(screen.queryByTestId("tier-section")).not.toBeInTheDocument();
  });

  it("should determine legacy path when modelSlots is missing", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      models: standardModels,
      // modelSlots not provided
    });

    await screen.findByTestId("img2img-popover");
    expect(screen.queryByTestId("model-slots")).not.toBeInTheDocument();
    expect(screen.getByTestId("tier-section")).toBeInTheDocument();
  });

  it("should determine legacy path when models is missing", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      // models not provided
    });

    await screen.findByTestId("img2img-popover");
    expect(screen.queryByTestId("model-slots")).not.toBeInTheDocument();
    expect(screen.getByTestId("tier-section")).toBeInTheDocument();
  });

  it("should pass modelSlots and models to ModelSlots component", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    await screen.findByTestId("img2img-popover");

    expect(capturedModelSlotsProps.slots).toBe(standardModelSlots);
    expect(capturedModelSlotsProps.models).toBe(standardModels);
  });

  it("should clamp variants between VARIANTS_MIN (1) and VARIANTS_MAX (4)", async () => {
    const user = userEvent.setup();

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    await screen.findByTestId("img2img-popover");

    const variantsValue = screen.getByTestId("variants-value");
    const minusBtn = screen.getByTestId("variants-minus");
    const plusBtn = screen.getByTestId("variants-plus");

    // Start at 1 -- minus should be disabled
    expect(variantsValue).toHaveTextContent("1");
    expect(minusBtn).toBeDisabled();

    // Increment to 4 (max)
    await user.click(plusBtn); // 2
    await user.click(plusBtn); // 3
    await user.click(plusBtn); // 4
    expect(variantsValue).toHaveTextContent("4");

    // Plus should be disabled at max
    expect(plusBtn).toBeDisabled();

    // Can still decrement
    await user.click(minusBtn);
    expect(variantsValue).toHaveTextContent("3");
  });

  it("should include variants value in onGenerate params (new path)", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
      onGenerate,
    });

    await screen.findByTestId("img2img-popover");

    // Set variants to 3
    const plusBtn = screen.getByTestId("variants-plus");
    await user.click(plusBtn); // 2
    await user.click(plusBtn); // 3

    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as Img2imgParams;
    expect(params.variants).toBe(3);
  });
});

// ===========================================================================
// INTEGRATION TESTS
// ===========================================================================

describe("Img2imgPopover Integration (Slice 10)", () => {
  it("should pass disabled=false to ModelSlots when isGenerating is false", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
      isGenerating: false,
    });

    await screen.findByTestId("img2img-popover");

    const modelSlotsEl = screen.getByTestId("model-slots");
    expect(modelSlotsEl).toHaveAttribute("data-disabled", "false");
    expect(capturedModelSlotsProps.disabled).toBe(false);
  });

  // Legacy transition test removed in slice-15 cleanup.

  it("should render sections in correct order: references -> prompt -> variants -> model-slots -> generate", async () => {
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
    });

    const popover = await screen.findByTestId("img2img-popover");

    const allSections = popover.querySelectorAll(
      '[data-testid="references-section"], [data-testid="prompt-section"], [data-testid="variants-section"], [data-testid="model-slots-section"], [data-testid="generate-button"]',
    );

    expect(allSections.length).toBe(5);
    expect(allSections[0]).toBe(screen.getByTestId("references-section"));
    expect(allSections[1]).toBe(screen.getByTestId("prompt-section"));
    expect(allSections[2]).toBe(screen.getByTestId("variants-section"));
    expect(allSections[3]).toBe(screen.getByTestId("model-slots-section"));
    expect(allSections[4]).toBe(screen.getByTestId("generate-button"));
  });

  // Legacy path section order test removed in slice-15 cleanup.

  it("should pass motiv and style text to onGenerate in new path", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      modelSlots: standardModelSlots,
      models: standardModels,
      onGenerate,
    });

    await screen.findByTestId("img2img-popover");

    // Type motiv and style
    const motivTextarea = screen.getByTestId("motiv-textarea");
    const styleTextarea = screen.getByTestId("style-textarea");

    await user.type(motivTextarea, "a cat on a roof");
    await user.type(styleTextarea, "watercolor");

    // Generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as Img2imgParams;
    expect(params.motiv).toBe("a cat on a roof");
    expect(params.style).toBe("watercolor");
  });
});

// ---------------------------------------------------------------------------
// Helper component for rerender tests
// ---------------------------------------------------------------------------

function HelperDispatcher({ toolId, children }: { toolId: string; children: ReactNode }) {
  const { dispatch } = useCanvasDetail();
  const ref = React.useRef(false);
  React.useEffect(() => {
    if (!ref.current) {
      ref.current = true;
      dispatch({ type: "SET_ACTIVE_TOOL", toolId });
    }
  }, [dispatch, toolId]);
  return <>{children}</>;
}
