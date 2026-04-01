// @vitest-environment jsdom
/**
 * Slice-09: Variation Popover -- ModelSlots integration
 *
 * Tests AC-1 through AC-10 from the slice-09-variation-popover spec.
 * Mocking Strategy: mock_external (per spec -- Server Actions, useModelSchema, ModelSlots internals).
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  Check: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-up" {...props} />
  ),
}));

// Mock useModelSchema -- controlled via mockUseModelSchemaReturn
const mockUseModelSchemaReturn = {
  schema: null as Record<string, unknown> | null,
  isLoading: false,
  error: null as string | null,
};

vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: () => mockUseModelSchemaReturn,
}));

// Mock server actions (used by ModelSlots internally)
const mockUpdateModelSlot = vi.fn();
const mockToggleSlotActive = vi.fn();

vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: (...args: unknown[]) => mockUpdateModelSlot(...args),
  toggleSlotActive: (...args: unknown[]) => mockToggleSlotActive(...args),
  clearModelSlot: vi.fn(),
}));

// Track ModelSlots props for assertion
let capturedModelSlotsProps: Record<string, unknown> | null = null;

vi.mock("@/components/ui/model-slots", () => ({
  ModelSlots: (props: Record<string, unknown>) => {
    capturedModelSlotsProps = props;
    return (
      <div
        data-testid="model-slots"
        data-variant={props.variant}
        data-mode={props.mode}
        data-disabled={props.disabled}
      >
        {/* Render slot info for assertion purposes */}
        {Array.isArray(props.slots) &&
          (props.slots as Array<{ slot: number; active: boolean; modelId: string | null }>).map(
            (s) => (
              <div
                key={s.slot}
                data-testid={`mock-slot-${s.slot}`}
                data-active={s.active}
                data-model-id={s.modelId ?? "none"}
              >
                Slot {s.slot}
              </div>
            ),
          )}
      </div>
    );
  },
}));

// Mock resolveActiveSlots -- returns entries for active slots with modelId
vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: (
    slots: Array<{ mode: string; active: boolean; modelId: string | null; modelParams?: unknown }>,
    mode: string,
  ) => {
    return slots
      .filter((s) => s.mode === mode && s.active && s.modelId != null)
      .map((s) => ({
        modelId: s.modelId!,
        modelParams: (s.modelParams ?? {}) as Record<string, unknown>,
      }));
  },
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import {
  VariationPopover,
  type VariationParams,
  type VariationPopoverProps,
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
    id: overrides.id ?? "gen-slot-test-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A test prompt for slot testing",
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

/** Creates a ModelSlot-like object matching the DB schema shape */
function createSlot(overrides: {
  slot: number;
  active?: boolean;
  modelId?: string | null;
  mode?: string;
  modelParams?: Record<string, unknown>;
}) {
  return {
    id: `slot-${overrides.slot}-id`,
    mode: overrides.mode ?? "txt2img",
    slot: overrides.slot,
    modelId: overrides.modelId ?? null,
    modelParams: overrides.modelParams ?? {},
    active: overrides.active ?? false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

/** Creates a Model-like object matching the DB schema shape */
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
    capabilities: overrides.capabilities ?? { txt2img: true },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}


// Standard fixtures
const standardSlots = [
  createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
  createSlot({ slot: 2, active: false, modelId: "black-forest-labs/flux-pro" }),
  createSlot({ slot: 3, active: false, modelId: null }),
];

const bothActiveSlots = [
  createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
  createSlot({ slot: 2, active: true, modelId: "stability-ai/sdxl" }),
  createSlot({ slot: 3, active: false, modelId: null }),
];

const standardModels = [
  createModel({ replicateId: "black-forest-labs/flux-schnell", name: "Flux Schnell" }),
  createModel({ replicateId: "black-forest-labs/flux-pro", name: "Flux Pro" }),
  createModel({ replicateId: "stability-ai/sdxl", name: "SDXL" }),
];

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
 * Helper component that sets isGenerating=true in the context.
 */
function SetGenerating() {
  const { dispatch } = useCanvasDetail();
  React.useEffect(() => {
    dispatch({ type: "SET_GENERATING", isGenerating: true });
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
  modelSlots?: VariationPopoverProps["modelSlots"];
  models?: VariationPopoverProps["models"];
  isGenerating?: boolean;
}) {
  const generation = options?.generation ?? makeGeneration();
  const onGenerate = options?.onGenerate ?? vi.fn();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <ActivateVariationTool />
      {options?.isGenerating && <SetGenerating />}
      <VariationPopover
        generation={generation}
        onGenerate={onGenerate}
        modelSlots={options?.modelSlots ?? standardSlots}
        models={options?.models ?? standardModels}
      />
    </CanvasDetailProvider>,
  );

  return { ...result, generation, onGenerate };
}

// ---------------------------------------------------------------------------
// Tests: Acceptance Tests -- Slice 09 ACs
// ---------------------------------------------------------------------------

describe("VariationPopover ModelSlots Acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedModelSlotsProps = null;
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;
  });

  // -------------------------------------------------------------------------
  // AC-1: ModelSlots gerendert
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN der Variation Popover wird geoeffnet (activeToolId === "variation")
   *       WHEN die Komponente rendert
   *       THEN wird eine ModelSlots-Komponente mit variant="stacked"
   *       und mode="txt2img" gerendert
   */
  it('AC-1: should render ModelSlots with variant="stacked"', async () => {
    renderPopoverOpen({
      modelSlots: standardSlots,
      models: standardModels,
    });

    // Wait for the popover to be visible
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // Legacy tier section should not exist
    expect(screen.queryByTestId("variation-tier-section")).not.toBeInTheDocument();

    // ModelSlots section should be rendered
    const modelSlotsSection = screen.getByTestId("variation-model-slots-section");
    expect(modelSlotsSection).toBeInTheDocument();

    // ModelSlots component should be rendered with correct props
    const modelSlots = screen.getByTestId("model-slots");
    expect(modelSlots).toBeInTheDocument();
    expect(modelSlots).toHaveAttribute("data-variant", "stacked");
    expect(modelSlots).toHaveAttribute("data-mode", "txt2img");
  });

  // -------------------------------------------------------------------------
  // AC-2: Generate sendet nur aktive Slot-ModelIds
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN der Variation Popover zeigt ModelSlots mit Slot 1 (active, "flux-schnell")
   *       und Slot 2 (inactive, "flux-pro")
   *       WHEN der User auf "Generate" klickt
   *       THEN wird onGenerate mit modelIds: ["black-forest-labs/flux-schnell"] aufgerufen
   *       (nur aktive Slots)
   *       AND der Generate-Handler setzt tier NICHT im Params-Objekt
   *       (Feld bleibt undefined)
   */
  it("AC-2: should call onGenerate with modelIds from active slots only", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderPopoverOpen({
      onGenerate,
      modelSlots: standardSlots, // Slot 1 active, Slot 2 inactive
      models: standardModels,
    });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;

    // Only active slot's modelId should be included
    expect(params.modelIds).toEqual(["black-forest-labs/flux-schnell"]);

    // tier should NOT be set (undefined) in new path
    expect(params.tier).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // AC-3: Generate sendet mehrere aktive ModelIds
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN der Variation Popover zeigt ModelSlots mit Slot 1 und Slot 2 beide active
   *       WHEN der User auf "Generate" klickt
   *       THEN wird onGenerate mit modelIds aufgerufen, das beide aktiven Model-IDs enthaelt
   */
  it("AC-3: should call onGenerate with multiple modelIds when multiple slots are active", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderPopoverOpen({
      onGenerate,
      modelSlots: bothActiveSlots, // Both slots active
      models: standardModels,
    });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;

    // Both active slot modelIds should be included
    expect(params.modelIds).toEqual([
      "black-forest-labs/flux-schnell",
      "stability-ai/sdxl",
    ]);
  });

  // -------------------------------------------------------------------------
  // AC-4: VariationParams enthaelt modelIds und behaelt tier als optionales deprecated Feld
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN das VariationParams Interface
   *       WHEN es importiert wird
   *       THEN enthaelt es modelIds: string[] als Pflichtfeld
   *       AND alle anderen Felder (prompt, strength, count, imageParams)
   *       bleiben unveraendert
   */
  it("AC-4: should include modelIds in VariationParams as required field", () => {
    // Type-level check: VariationParams must accept modelIds as required field
    const paramsWithModelIds: VariationParams = {
      prompt: "test prompt",
      count: 2,
      modelIds: ["model-a", "model-b"],
    };
    expect(paramsWithModelIds.modelIds).toEqual(["model-a", "model-b"]);
    expect(paramsWithModelIds.prompt).toBe("test prompt");
    expect(paramsWithModelIds.count).toBe(2);

    // strength remains optional
    const paramsWithStrength: VariationParams = {
      prompt: "test",
      count: 1,
      modelIds: ["model-a"],
      strength: "subtle",
    };
    expect(paramsWithStrength.strength).toBe("subtle");

    // imageParams remains optional
    const paramsWithImageParams: VariationParams = {
      prompt: "test",
      count: 1,
      modelIds: ["model-a"],
      imageParams: { aspect_ratio: "16:9" },
    };
    expect(paramsWithImageParams.imageParams).toEqual({ aspect_ratio: "16:9" });
  });

  // -------------------------------------------------------------------------
  // AC-5: Per-Slot ParameterPanel fuer aktive Slots sichtbar
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN der Variation Popover zeigt ModelSlots
   *       WHEN Slot 1 aktiv ist mit einem zugewiesenen Model
   *       THEN wird unterhalb von Slot 1 ein Per-Slot ParameterPanel angezeigt
   *       (via ModelSlots stacked-Layout)
   */
  it("AC-5: should show per-slot ParameterPanel for active slots via ModelSlots stacked layout", async () => {
    renderPopoverOpen({
      modelSlots: standardSlots,
      models: standardModels,
    });

    // Wait for the popover to be visible
    await screen.findByTestId("variation-popover");

    // ModelSlots is rendered with variant="stacked" which internally handles ParameterPanel
    // We verify that ModelSlots was called with the correct props
    expect(capturedModelSlotsProps).not.toBeNull();
    expect(capturedModelSlotsProps!.variant).toBe("stacked");
    expect(capturedModelSlotsProps!.mode).toBe("txt2img");

    // The slots data should include the active slot with a model
    const passedSlots = capturedModelSlotsProps!.slots as Array<{ slot: number; active: boolean; modelId: string | null }>;
    const activeSlotWithModel = passedSlots.find(
      (s) => s.slot === 1 && s.active && s.modelId !== null,
    );
    expect(activeSlotWithModel).toBeDefined();
    expect(activeSlotWithModel!.modelId).toBe("black-forest-labs/flux-schnell");

    // In stacked variant, ModelSlots renders ParameterPanel for active slots internally
    // The mock slot element should be present
    expect(screen.getByTestId("mock-slot-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("mock-slot-1")).toHaveAttribute(
      "data-model-id",
      "black-forest-labs/flux-schnell",
    );
  });

  // -------------------------------------------------------------------------
  // AC-6: Count-Button-Gruppe funktioniert weiterhin
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der Variation Popover wird geoeffnet
   *       WHEN der Popover rendert
   *       THEN zeigt die Count-Button-Gruppe ([ 1 ] [ 2 ] [ 3 ] [ 4 ]) weiterhin korrekt an
   *       AND Count-Aenderung aktualisiert den lokalen State
   */
  it("AC-6: should render count button group and update count state on click", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderPopoverOpen({
      onGenerate,
      modelSlots: standardSlots,
      models: standardModels,
    });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // Count selector should be visible with role="radiogroup"
    const countSelector = screen.getByTestId("variation-count-selector");
    expect(countSelector).toBeInTheDocument();
    expect(countSelector).toHaveAttribute("role", "radiogroup");

    // All four count buttons (1, 2, 3, 4) should be rendered
    for (const n of [1, 2, 3, 4]) {
      const btn = screen.getByTestId(`variation-count-${n}`);
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("role", "radio");
    }

    // Default count is 1 (aria-checked=true)
    expect(screen.getByTestId("variation-count-1")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("variation-count-3")).toHaveAttribute("aria-checked", "false");

    // Click count "3" to change state
    await user.click(screen.getByTestId("variation-count-3"));

    // Count 3 should now be active
    expect(screen.getByTestId("variation-count-3")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("variation-count-1")).toHaveAttribute("aria-checked", "false");

    // Click Generate and verify count is passed correctly
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.count).toBe(3);
  });

  // -------------------------------------------------------------------------
  // AC-7: Props require modelSlots and models
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN die VariationPopoverProps
   *       WHEN die Props definiert werden
   *       THEN akzeptiert die Komponente modelSlots (vom Typ ModelSlot[])
   *       und models (vom Typ Model[]) als Pflicht-Props
   */
  it("AC-7: should accept modelSlots and models as required props", async () => {
    renderPopoverOpen({
      modelSlots: standardSlots,
      models: standardModels,
    });
    await screen.findByTestId("variation-popover");

    // ModelSlots should be rendered
    expect(screen.getByTestId("model-slots")).toBeInTheDocument();

    // Type-level check: VariationPopoverProps requires modelSlots and models
    const propsCheck: VariationPopoverProps = {
      generation: makeGeneration(),
      onGenerate: vi.fn(),
      modelSlots: standardSlots,
      models: standardModels,
    };
    expect(propsCheck.modelSlots).toBeDefined();
    expect(propsCheck.models).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // AC-8: Disabled-State waehrend Generierung
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN der Variation Popover ist geoeffnet und state.isGenerating === true
   *       WHEN die Komponente rendert
   *       THEN wird disabled={true} an die ModelSlots-Komponente uebergeben
   *       AND alle Slot-Checkboxen und Dropdowns sind deaktiviert
   */
  it("AC-8: should pass disabled=true to ModelSlots when isGenerating is true", async () => {
    renderPopoverOpen({
      modelSlots: standardSlots,
      models: standardModels,
      isGenerating: true,
    });

    // Wait for popover
    await screen.findByTestId("variation-popover");

    // ModelSlots should be rendered with disabled=true
    const modelSlots = screen.getByTestId("model-slots");
    expect(modelSlots).toHaveAttribute("data-disabled", "true");

    // Verify via captured props
    expect(capturedModelSlotsProps).not.toBeNull();
    expect(capturedModelSlotsProps!.disabled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // AC-9: Kein lokaler Slot-Cache beim Wiederoeffnen
  // -------------------------------------------------------------------------

  /**
   * AC-9: GIVEN der User oeffnet den Variation Popover, aendert Slots, und schliesst ihn
   *       WHEN der Popover erneut geoeffnet wird
   *       THEN werden die aktuellen Slot-Daten aus den Props verwendet (kein lokaler Slot-Cache)
   */
  it("AC-9: should use current slot data from props when popover reopens", async () => {
    const initialSlots = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
      createSlot({ slot: 2, active: false, modelId: null }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    const updatedSlots = [
      createSlot({ slot: 1, active: true, modelId: "stability-ai/sdxl" }),
      createSlot({ slot: 2, active: true, modelId: "black-forest-labs/flux-pro" }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    // First render with initial slots
    const { rerender, generation, onGenerate } = renderPopoverOpen({
      modelSlots: initialSlots,
      models: standardModels,
    });

    await screen.findByTestId("variation-popover");

    // Verify initial slot data
    expect(screen.getByTestId("mock-slot-1")).toHaveAttribute(
      "data-model-id",
      "black-forest-labs/flux-schnell",
    );

    // Re-render with updated slots (simulating prop change after close/reopen)
    rerender(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <ActivateVariationTool />
        <VariationPopover
          generation={generation}
          onGenerate={onGenerate}
          modelSlots={updatedSlots}
          models={standardModels}
        />
      </CanvasDetailProvider>,
    );

    await screen.findByTestId("variation-popover");

    // Should reflect the NEW slot data from props, not cached old data
    expect(screen.getByTestId("mock-slot-1")).toHaveAttribute(
      "data-model-id",
      "stability-ai/sdxl",
    );
    expect(screen.getByTestId("mock-slot-2")).toHaveAttribute(
      "data-model-id",
      "black-forest-labs/flux-pro",
    );
    expect(screen.getByTestId("mock-slot-2")).toHaveAttribute("data-active", "true");
  });

  // -------------------------------------------------------------------------
  // AC-10: Legacy-Fallback wenn modelSlots/models nicht uebergeben werden
  // -------------------------------------------------------------------------

  // AC-10: Legacy fallback path removed in slice-15 cleanup.
  // modelSlots and models are now required props.
});

// ---------------------------------------------------------------------------
// Unit Tests: VariationParams / VariationPopoverProps type contracts
// ---------------------------------------------------------------------------

describe("VariationPopover Unit -- Type Contracts", () => {
  it("VariationParams modelIds is required and cannot be omitted at type level", () => {
    // This test verifies the runtime shape of VariationParams objects.
    // If modelIds were removed from the interface, the test file would not compile.
    const params: VariationParams = {
      prompt: "a",
      count: 1,
      modelIds: ["id-1"],
    };
    expect(params.modelIds).toHaveLength(1);
    expect(Array.isArray(params.modelIds)).toBe(true);
  });

  it("VariationPopoverProps requires modelSlots and models", () => {
    const props: VariationPopoverProps = {
      generation: makeGeneration(),
      onGenerate: vi.fn(),
      modelSlots: standardSlots,
      models: standardModels,
    };
    expect(props.modelSlots).toBeDefined();
    expect(props.models).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration Tests: VariationPopover ModelSlots integration
// ---------------------------------------------------------------------------

describe("VariationPopover Integration -- ModelSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedModelSlotsProps = null;
    mockUseModelSchemaReturn.schema = null;
    mockUseModelSchemaReturn.isLoading = false;
    mockUseModelSchemaReturn.error = null;
  });

  it("should render ModelSlots section when modelSlots and models are provided", async () => {
    renderPopoverOpen({
      modelSlots: standardSlots,
      models: standardModels,
    });

    await screen.findByTestId("variation-popover");

    // ModelSlots section rendered
    expect(screen.getByTestId("variation-model-slots-section")).toBeInTheDocument();
  });

  it("should pass modelSlots data directly from props to ModelSlots component (no local cache)", async () => {
    const slots = [
      createSlot({ slot: 1, active: true, modelId: "custom/model-a" }),
      createSlot({ slot: 2, active: false, modelId: "custom/model-b" }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    renderPopoverOpen({
      modelSlots: slots,
      models: standardModels,
    });

    await screen.findByTestId("variation-popover");

    // Captured props should contain the exact slots from props
    expect(capturedModelSlotsProps).not.toBeNull();
    const passedSlots = capturedModelSlotsProps!.slots as typeof slots;
    expect(passedSlots).toBe(slots); // Same reference = no local copy/cache
  });

  it("should preserve prompt and count state through generate in new path", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderPopoverOpen({
      onGenerate,
      generation: makeGeneration({ prompt: "initial prompt" }),
      modelSlots: standardSlots,
      models: standardModels,
    });

    await screen.findByTestId("variation-popover");

    // Change count to 4
    await user.click(screen.getByTestId("variation-count-4"));

    // Click Generate
    await user.click(screen.getByTestId("variation-generate-button"));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const params = onGenerate.mock.calls[0][0] as VariationParams;
    expect(params.prompt).toBe("initial prompt");
    expect(params.count).toBe(4);
    expect(params.modelIds).toEqual(["black-forest-labs/flux-schnell"]);
  });
});
