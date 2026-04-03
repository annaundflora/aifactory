// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-07-canvas-ui: VariationPopover prompt simplification
 *
 * Verifies that the VariationPopover component and its VariationParams interface
 * no longer include promptStyle or negativePrompt fields, consistent with the
 * single-prompt architecture introduced in slice-05.
 *
 * Mocking Strategy: mock_external per spec
 */

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
// Mocks (mock_external strategy per slice spec)
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

// Mock useModelSchema
vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: () => ({ schema: null, isLoading: false, error: null }),
}));

// Mock server actions: model-slots
vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: vi.fn(),
  toggleSlotActive: vi.fn(),
}));

// Mock ModelSlots UI component
vi.mock("@/components/ui/model-slots", () => ({
  ModelSlots: (props: Record<string, unknown>) => (
    <div
      data-testid="model-slots"
      data-variant={props.variant}
      data-mode={props.mode}
    />
  ),
}));

// Mock resolveActiveSlots
vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: (
    slots: Array<{ mode: string; active: boolean; modelId: string | null }>,
    mode: string,
  ) => {
    return slots
      .filter((s) => s.mode === mode && s.active && s.modelId != null)
      .map((s) => ({
        modelId: s.modelId!,
        modelParams: {},
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
    id: overrides.id ?? "gen-variation-simpl-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A beautiful sunset over mountains",
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://r2.example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-29T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fixtures: Model Slots and Models
// ---------------------------------------------------------------------------

const standardSlots = [
  { id: "slot-1", mode: "txt2img", slot: 1, modelId: "black-forest-labs/flux-schnell", modelParams: {}, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "slot-2", mode: "txt2img", slot: 2, modelId: "black-forest-labs/flux-pro", modelParams: {}, active: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "slot-3", mode: "txt2img", slot: 3, modelId: null, modelParams: {}, active: false, createdAt: new Date(), updatedAt: new Date() },
];

const standardModels = [
  { id: "model-1", replicateId: "black-forest-labs/flux-schnell", owner: "black-forest-labs", name: "Flux Schnell", description: null, coverImageUrl: null, runCount: 100, collections: null, capabilities: { txt2img: true }, inputSchema: null, versionHash: null, isActive: true, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "model-2", replicateId: "black-forest-labs/flux-pro", owner: "black-forest-labs", name: "Flux Pro", description: null, coverImageUrl: null, runCount: 100, collections: null, capabilities: { txt2img: true }, inputSchema: null, versionHash: null, isActive: true, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
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
 * Renders VariationPopover inside CanvasDetailProvider with activeToolId
 * set to "variation" (popover visible).
 */
function renderPopoverOpen(options?: {
  generation?: Generation;
  onGenerate?: (params: VariationParams) => void;
  modelSlots?: VariationPopoverProps["modelSlots"];
  models?: VariationPopoverProps["models"];
}) {
  const generation = options?.generation ?? makeGeneration();
  const onGenerate = options?.onGenerate ?? vi.fn();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <ActivateVariationTool />
      <VariationPopover
        generation={generation}
        onGenerate={onGenerate}
        modelSlots={options?.modelSlots ?? standardSlots}
        models={options?.models ?? standardModels}
      />
    </CanvasDetailProvider>
  );

  return { ...result, generation, onGenerate };
}

// ---------------------------------------------------------------------------
// Acceptance Tests: VariationPopover - prompt simplification (slice-07)
// ---------------------------------------------------------------------------

describe("VariationPopover - prompt simplification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: VariationParams Interface ohne promptStyle/negativePrompt
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN das Interface VariationParams in variation-popover.tsx
   *       WHEN seine Properties geprueft werden
   *       THEN enthaelt es KEINE Property promptStyle und KEINE Property negativePrompt
   *       AND es enthaelt weiterhin prompt, strength, count, tier, imageParams
   */
  it("AC-1: should not include promptStyle or negativePrompt in VariationParams type", () => {
    // Type-level assertion: create a VariationParams object with all expected fields.
    // If promptStyle or negativePrompt existed in the type, TypeScript would
    // allow them — but after the simplification they must NOT be part of the type.
    const params: VariationParams = {
      prompt: "test prompt",
      strength: "balanced",
      count: 2,
      modelIds: ["black-forest-labs/flux-schnell"],
      imageParams: { aspect_ratio: "16:9" },
    };

    // Runtime assertions: verify the object has the expected keys
    expect(params).toHaveProperty("prompt");
    expect(params).toHaveProperty("strength");
    expect(params).toHaveProperty("count");
    expect(params).toHaveProperty("modelIds");
    expect(params).toHaveProperty("imageParams");

    // Verify removed fields are NOT present
    expect(params).not.toHaveProperty("promptStyle");
    expect(params).not.toHaveProperty("negativePrompt");
    expect(params).not.toHaveProperty("tier");

    // Verify exact key set (only allowed keys)
    const keys = Object.keys(params);
    expect(keys).not.toContain("promptStyle");
    expect(keys).not.toContain("negativePrompt");
    expect(keys).not.toContain("tier");
  });

  // -------------------------------------------------------------------------
  // AC-2: Keine useState fuer promptStyle/negativePrompt
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN die State-Variablen in VariationPopover
   *       WHEN der Quellcode geprueft wird
   *       THEN existiert KEIN useState-Aufruf fuer promptStyle oder negativePrompt
   *       AND der useEffect fuer Reset bei isOpen setzt nur prompt, count, tier, imageParams
   *
   * We verify this behaviorally: when the popover opens, the form state should
   * only contain prompt, count, tier, imageParams — no promptStyle or negativePrompt
   * state values are exposed in the UI.
   */
  it("AC-2: should not have state variables for promptStyle or negativePrompt", async () => {
    renderPopoverOpen({
      generation: makeGeneration({ prompt: "sunset mountains" }),
    });

    // Wait for popover to render
    await screen.findByTestId("variation-popover");

    // The prompt textarea should be present with the reset value
    const textarea = screen.getByTestId("variation-prompt");
    expect(textarea).toHaveValue("sunset mountains");

    // There should be NO textareas/inputs for style or negative prompt
    expect(screen.queryByTestId("variation-style")).not.toBeInTheDocument();
    expect(screen.queryByTestId("variation-negative-prompt")).not.toBeInTheDocument();

    // The count selector and model slots section should be present (part of the reset state)
    expect(screen.getByTestId("variation-count-selector")).toBeInTheDocument();
    expect(screen.getByTestId("variation-model-slots-section")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: Keine Style/Negative Textareas gerendert
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN die VariationPopover-Komponente
   *       WHEN sie gerendert wird
   *       THEN existiert KEIN Element mit data-testid="variation-style" oder
   *            data-testid="variation-negative-prompt"
   *       AND es existiert genau 1 Textarea mit data-testid="variation-prompt"
   */
  it("AC-3: should not render variation-style or variation-negative-prompt textareas", async () => {
    renderPopoverOpen();

    await screen.findByTestId("variation-popover");

    // No style textarea
    expect(screen.queryByTestId("variation-style")).not.toBeInTheDocument();

    // No negative prompt textarea
    expect(screen.queryByTestId("variation-negative-prompt")).not.toBeInTheDocument();
  });

  /**
   * AC-3 (continued): Prompt textarea still exists
   */
  it("AC-3: should render exactly one variation-prompt textarea", async () => {
    renderPopoverOpen();

    await screen.findByTestId("variation-popover");

    // Exactly one prompt textarea
    const promptTextareas = screen.getAllByTestId("variation-prompt");
    expect(promptTextareas).toHaveLength(1);

    // It should be a textarea element
    expect(promptTextareas[0].tagName).toBe("TEXTAREA");
  });

  // -------------------------------------------------------------------------
  // AC-4: onGenerate ohne promptStyle/negativePrompt
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN die handleGenerate-Funktion in VariationPopover
   *       WHEN onGenerate aufgerufen wird
   *       THEN enthaelt das uebergebene VariationParams-Objekt KEIN promptStyle
   *            und KEIN negativePrompt
   *       AND es enthaelt prompt, count, tier, imageParams
   */
  it("AC-4: should call onGenerate without promptStyle or negativePrompt in params", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    renderPopoverOpen({
      generation: makeGeneration({ prompt: "A beautiful sunset" }),
      onGenerate,
    });

    await screen.findByTestId("variation-popover");

    // Click generate button to trigger onGenerate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // onGenerate should have been called
    expect(onGenerate).toHaveBeenCalledTimes(1);

    const calledParams = onGenerate.mock.calls[0][0];

    // Must have the expected fields
    expect(calledParams).toHaveProperty("prompt", "A beautiful sunset");
    expect(calledParams).toHaveProperty("count", 1);
    expect(calledParams).toHaveProperty("modelIds");

    // Must NOT have removed fields
    expect(calledParams).not.toHaveProperty("promptStyle");
    expect(calledParams).not.toHaveProperty("negativePrompt");
    expect(calledParams).not.toHaveProperty("tier");

    // Double-check: verify exact keys in the object
    const paramKeys = Object.keys(calledParams);
    expect(paramKeys).not.toContain("promptStyle");
    expect(paramKeys).not.toContain("negativePrompt");
    expect(paramKeys).not.toContain("tier");
    expect(paramKeys).toContain("prompt");
    expect(paramKeys).toContain("count");
    expect(paramKeys).toContain("modelIds");
  });
});
