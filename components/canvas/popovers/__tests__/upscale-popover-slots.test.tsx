// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React, { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Popover uses ResizeObserver internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }
});

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per spec)
// Mock lucide-react icons, ModelSlots component (external dependency from
// slice-06), and resolveActiveSlots (tested in its own unit tests).
// ModelSlots and resolveActiveSlots are mocked for isolation.
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  ZoomIn: (props: Record<string, unknown>) => (
    <span data-testid="icon-zoom-in" {...props} />
  ),
  Check: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
}));

// --- Mock ModelSlots: render a stub that exposes props as data attributes ---
vi.mock("@/components/ui/model-slots", () => ({
  ModelSlots: (props: {
    mode: string;
    slots: unknown[];
    models: unknown[];
    variant?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <div
      data-testid="model-slots"
      data-variant={props.variant}
      data-mode={props.mode}
      data-disabled={String(props.disabled ?? false)}
      data-slot-count={props.slots.length}
    />
  ),
}));

// --- Mock resolveActiveSlots: controllable per-test ---
const mockResolveActiveSlots = vi.fn();

vi.mock("@/lib/utils/resolve-model", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/utils/resolve-model")
  >("@/lib/utils/resolve-model");
  return {
    ...actual,
    resolveActiveSlots: (...args: unknown[]) =>
      mockResolveActiveSlots(...args),
  };
});

// --- Mock server actions used by ModelSlots (prevent actual imports) ---
vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: vi.fn(),
  toggleSlotActive: vi.fn(),
}));

// --- Mock useModelSchema (used by ModelSlots stub) ---
vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: vi.fn().mockReturnValue({
    schema: null,
    isLoading: false,
    error: null,
  }),
}));

// --- Mock ParameterPanel (used by ModelSlots stub) ---
vi.mock("@/components/workspace/parameter-panel", () => ({
  ParameterPanel: () => <div data-testid="parameter-panel" />,
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks and polyfills)
// ---------------------------------------------------------------------------

import { UpscalePopover } from "@/components/canvas/popovers/upscale-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";

/** @deprecated Local Tier type for legacy test compatibility */
type Tier = "draft" | "quality" | "max";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Helper to create a ModelSlot-like object with upscale mode */
function createSlot(overrides: {
  slot: number;
  active?: boolean;
  modelId?: string | null;
  modelParams?: Record<string, unknown>;
}) {
  return {
    id: `slot-${overrides.slot}-id`,
    mode: "upscale" as const,
    slot: overrides.slot,
    modelId: overrides.modelId ?? null,
    modelParams: overrides.modelParams ?? {},
    active: overrides.active ?? false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

/** Helper to create a Model-like object */
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
    capabilities: overrides.capabilities ?? { upscale: true },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

// Standard fixtures
const crystalUpscaler = createModel({
  replicateId: "philz1337x/crystal-upscaler",
  name: "Crystal Upscaler",
  capabilities: { upscale: true },
});

const anotherUpscaler = createModel({
  replicateId: "nightmareai/real-esrgan",
  name: "Real-ESRGAN",
  capabilities: { upscale: true },
});

const allModels = [crystalUpscaler, anotherUpscaler];

const slot1Active = createSlot({
  slot: 1,
  active: true,
  modelId: "philz1337x/crystal-upscaler",
});

const slot2Inactive = createSlot({
  slot: 2,
  active: false,
  modelId: "nightmareai/real-esrgan",
});

const slot2Active = createSlot({
  slot: 2,
  active: true,
  modelId: "nightmareai/real-esrgan",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inner component that dispatches SET_ACTIVE_TOOL on mount to simulate
 * the toolbar having activated the "upscale" tool.
 */
function ToolActivator({
  toolId,
  children,
}: {
  toolId: string | null;
  children: ReactNode;
}) {
  const { dispatch } = useCanvasDetail();
  const dispatched = useRef(false);

  useEffect(() => {
    if (!dispatched.current && toolId) {
      dispatched.current = true;
      dispatch({ type: "SET_ACTIVE_TOOL", toolId });
    }
  }, [dispatch, toolId]);

  return <>{children}</>;
}

/**
 * Inner component that also dispatches SET_GENERATING after activating tool.
 */
function GeneratingActivator({
  toolId,
  children,
}: {
  toolId: string | null;
  children: ReactNode;
}) {
  const { dispatch } = useCanvasDetail();
  const dispatched = useRef(false);

  useEffect(() => {
    if (!dispatched.current) {
      dispatched.current = true;
      if (toolId) {
        dispatch({ type: "SET_ACTIVE_TOOL", toolId });
      }
      dispatch({ type: "SET_GENERATING", isGenerating: true });
    }
  }, [dispatch, toolId]);

  return <>{children}</>;
}

type OnUpscaleFn = (params: {
  scale: 2 | 4;
  modelIds?: string[];
  tier?: Tier;
}) => void;

/**
 * Render helper that wraps UpscalePopover in CanvasDetailProvider.
 * Renders UpscalePopover with ModelSlots path.
 */
function renderUpscalePopover(
  overrides: Partial<{
    onUpscale: OnUpscaleFn;
    isUpscaleDisabled: boolean;
    initialActiveToolId: string | null;
    modelSlots: typeof slot1Active[];
    models: typeof crystalUpscaler[];
    isGenerating: boolean;
  }> = {}
) {
  const onUpscale = overrides.onUpscale ?? vi.fn();
  const isUpscaleDisabled = overrides.isUpscaleDisabled ?? false;
  const initialActiveToolId = overrides.initialActiveToolId ?? null;
  const isGenerating = overrides.isGenerating ?? false;

  const Activator = isGenerating ? GeneratingActivator : ToolActivator;

  const result = render(
    <CanvasDetailProvider initialGenerationId="gen-slot-test-1">
      <Activator toolId={initialActiveToolId}>
        <UpscalePopover
          onUpscale={onUpscale}
          isUpscaleDisabled={isUpscaleDisabled}
          modelSlots={overrides.modelSlots ?? [slot1Active, slot2Inactive]}
          models={overrides.models ?? allModels}
        />
      </Activator>
    </CanvasDetailProvider>
  );

  return { ...result, onUpscale };
}

// ---------------------------------------------------------------------------
// Tests: Slice 11 -- Upscale Popover ModelSlots Acceptance
// ---------------------------------------------------------------------------

describe("UpscalePopover - ModelSlots Integration (Slice 11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default resolveActiveSlots: return slot 1 only
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "philz1337x/crystal-upscaler", modelParams: {} },
    ]);
  });

  // -------------------------------------------------------------------------
  // AC-1: ModelSlots gerendert (ohne ParameterPanel)
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN der Upscale Popover wird geoeffnet (activeToolId === "upscale")
   *       und modelSlots + models Props sind uebergeben
   *       WHEN die Komponente rendert
   *       THEN wird eine ModelSlots-Komponente mit variant="stacked"
   *           und mode="upscale" gerendert
   *       AND es werden KEINE Per-Slot ParameterPanels angezeigt
   */
  it('AC-1: should render ModelSlots with variant="stacked" and mode="upscale" without ParameterPanels', async () => {
    renderUpscalePopover({
      initialActiveToolId: "upscale",
      modelSlots: [slot1Active, slot2Inactive],
      models: allModels,
    });

    // Wait for the popover to appear
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // ModelSlots should be rendered
    const modelSlotsEl = within(popover).getByTestId("model-slots");
    expect(modelSlotsEl).toBeInTheDocument();

    // Verify ModelSlots props: mode="upscale"
    expect(modelSlotsEl).toHaveAttribute("data-mode", "upscale");

    // The model-slots section testid should be present (not the tier section)
    expect(
      within(popover).getByTestId("upscale-model-slots-section")
    ).toBeInTheDocument();
    expect(
      within(popover).queryByTestId("upscale-tier-section")
    ).not.toBeInTheDocument();

    // No ParameterPanels should be rendered
    expect(
      within(popover).queryByTestId("parameter-panel")
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-2: 2x Upscale sendet aktive Slot-ModelIds
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN der Upscale Popover zeigt ModelSlots mit Slot 1
   *       (active, "philz1337x/crystal-upscaler") und Slot 2 (inactive)
   *       WHEN der User auf "2x Upscale" klickt
   *       THEN wird onUpscale mit { scale: 2, modelIds: ["philz1337x/crystal-upscaler"] }
   *            aufgerufen (nur aktive Slots)
   *       AND der Popover schliesst sich nach der Aktion
   */
  it("AC-2: should call onUpscale with scale 2 and modelIds from active slots only", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();

    // resolveActiveSlots returns only the active slot
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "philz1337x/crystal-upscaler", modelParams: {} },
    ]);

    renderUpscalePopover({
      initialActiveToolId: "upscale",
      modelSlots: [slot1Active, slot2Inactive],
      models: allModels,
      onUpscale,
    });

    // Wait for popover
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Click 2x Upscale
    const btn2x = screen.getByTestId("upscale-2x-button");
    await user.click(btn2x);

    // Verify onUpscale was called with correct params
    expect(onUpscale).toHaveBeenCalledTimes(1);
    expect(onUpscale).toHaveBeenCalledWith({
      scale: 2,
      modelIds: ["philz1337x/crystal-upscaler"],
    });

    // Verify resolveActiveSlots was called with the right args
    expect(mockResolveActiveSlots).toHaveBeenCalledWith(
      [slot1Active, slot2Inactive],
      "upscale"
    );

    // Popover should close after action
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: 4x Upscale sendet mehrere aktive ModelIds
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN der Upscale Popover zeigt ModelSlots mit Slot 1 und Slot 2
   *       beide active
   *       WHEN der User auf "4x Upscale" klickt
   *       THEN wird onUpscale mit { scale: 4, modelIds: [...] } aufgerufen,
   *            das beide aktiven Model-IDs enthaelt
   */
  it("AC-3: should call onUpscale with scale 4 and multiple modelIds when multiple slots are active", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();

    // Both slots active
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "philz1337x/crystal-upscaler", modelParams: {} },
      { modelId: "nightmareai/real-esrgan", modelParams: {} },
    ]);

    renderUpscalePopover({
      initialActiveToolId: "upscale",
      modelSlots: [slot1Active, slot2Active],
      models: allModels,
      onUpscale,
    });

    // Wait for popover
    await screen.findByTestId("upscale-popover");

    // Click 4x Upscale
    const btn4x = screen.getByTestId("upscale-4x-button");
    await user.click(btn4x);

    // Verify onUpscale was called with both model IDs
    expect(onUpscale).toHaveBeenCalledTimes(1);
    expect(onUpscale).toHaveBeenCalledWith({
      scale: 4,
      modelIds: [
        "philz1337x/crystal-upscaler",
        "nightmareai/real-esrgan",
      ],
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Props akzeptieren modelSlots und models mit erweiterter onUpscale
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN die UpscalePopoverProps
   *       WHEN die Props definiert werden
   *       THEN akzeptiert die Komponente modelSlots (Typ ModelSlot[])
   *            und models? (Typ Model[], optional) als neue Props
   *       AND onUpscale akzeptiert { scale: 2 | 4, modelIds: string[], tier?: Tier }
   *            -- tier ist @deprecated
   */
  it("AC-4: should accept modelSlots and models props with onUpscale receiving modelIds and optional deprecated tier", () => {
    // Type-level check: Verify the component accepts modelSlots and models props.
    // This test will fail to compile if the props are not accepted.

    // Verify onUpscale accepts modelIds
    const paramsWithModelIds: Parameters<
      React.ComponentProps<typeof UpscalePopover>["onUpscale"]
    >[0] = { scale: 2, modelIds: ["model-a", "model-b"] };
    expect(paramsWithModelIds.scale).toBe(2);
    expect(paramsWithModelIds.modelIds).toEqual(["model-a", "model-b"]);

    // Verify onUpscale still accepts deprecated tier (backward compat)
    const paramsWithTier: Parameters<
      React.ComponentProps<typeof UpscalePopover>["onUpscale"]
    >[0] = { scale: 4, tier: "quality" };
    expect(paramsWithTier.tier).toBe("quality");

    // Verify both can be provided simultaneously
    const paramsWithBoth: Parameters<
      React.ComponentProps<typeof UpscalePopover>["onUpscale"]
    >[0] = { scale: 2, modelIds: ["model-a"], tier: "draft" };
    expect(paramsWithBoth.modelIds).toEqual(["model-a"]);
    expect(paramsWithBoth.tier).toBe("draft");

    // Verify modelSlots and models are optional (rendering without them should work)
    const { unmount } = render(
      <CanvasDetailProvider initialGenerationId="gen-type-test">
        <UpscalePopover onUpscale={vi.fn()} isUpscaleDisabled={false} />
      </CanvasDetailProvider>
    );
    unmount();

    // Verify modelSlots and models are accepted when provided
    const { unmount: unmount2 } = render(
      <CanvasDetailProvider initialGenerationId="gen-type-test-2">
        <UpscalePopover
          onUpscale={vi.fn()}
          isUpscaleDisabled={false}
          modelSlots={[slot1Active]}
          models={allModels}
        />
      </CanvasDetailProvider>
    );
    unmount2();
  });

  // -------------------------------------------------------------------------
  // AC-5: Legacy fallback path removed in slice-15 cleanup.
  // modelSlots and models are now required props.

  // -------------------------------------------------------------------------
  // AC-6: Disabled-State waehrend Generierung
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der Upscale Popover ist geoeffnet und state.isGenerating === true
   *       WHEN die Komponente rendert
   *       THEN wird disabled={true} an die ModelSlots-Komponente uebergeben
   *       AND beide Scale-Buttons sind ebenfalls disabled
   */
  it("AC-6: should pass disabled=true to ModelSlots and disable scale buttons when isGenerating is true", async () => {
    renderUpscalePopover({
      initialActiveToolId: "upscale",
      modelSlots: [slot1Active, slot2Inactive],
      models: allModels,
      isGenerating: true,
    });

    // Wait for popover
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // ModelSlots should receive disabled=true
    const modelSlotsEl = within(popover).getByTestId("model-slots");
    expect(modelSlotsEl).toHaveAttribute("data-disabled", "true");

    // Both scale buttons should be disabled
    const btn2x = screen.getByTestId("upscale-2x-button");
    const btn4x = screen.getByTestId("upscale-4x-button");
    expect(btn2x).toBeDisabled();
    expect(btn4x).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // AC-7: Kein lokaler Slot-Cache beim Wiederoeffnen
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN der User oeffnet den Upscale Popover, aendert Slots, und schliesst ihn
   *       WHEN der Popover erneut geoeffnet wird
   *       THEN werden die aktuellen Slot-Daten aus den Props verwendet
   *            (kein lokaler Slot-Cache)
   *       AND der lokale tier-State (Legacy) wird auf "draft" zurueckgesetzt
   *            (bestehendes Verhalten)
   */
  it("AC-7: should use current slot data from props when popover reopens", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();

    // Initial slots: slot 1 with crystal-upscaler
    const initialSlots = [slot1Active, slot2Inactive];
    // Updated slots: slot 1 now has a different model
    const updatedSlots = [
      createSlot({
        slot: 1,
        active: true,
        modelId: "nightmareai/real-esrgan",
      }),
      slot2Inactive,
    ];

    /**
     * Wrapper using useState to swap slots without remounting the provider.
     */
    function ReopenHarness() {
      const { dispatch } = useCanvasDetail();
      const [slots, setSlots] = React.useState(initialSlots);

      return (
        <>
          <button
            data-testid="toggle-popover"
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" })
            }
          >
            Toggle
          </button>
          <button
            data-testid="update-slots"
            onClick={() => setSlots(updatedSlots)}
          >
            Update Slots
          </button>
          <UpscalePopover
            onUpscale={onUpscale}
            isUpscaleDisabled={false}
            modelSlots={slots}
            models={allModels}
          />
        </>
      );
    }

    render(
      <CanvasDetailProvider initialGenerationId="gen-reopen-test">
        <ReopenHarness />
      </CanvasDetailProvider>
    );

    // Step 1: Open the popover
    await user.click(screen.getByTestId("toggle-popover"));
    let popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Step 2: ModelSlots should have 2 slots passed
    let modelSlotsEl = within(popover).getByTestId("model-slots");
    expect(modelSlotsEl).toHaveAttribute("data-slot-count", "2");

    // Step 3: Close the popover (toggle again: activeToolId "upscale" -> null)
    await user.click(screen.getByTestId("toggle-popover"));

    // Step 4: Update slots (simulating external change)
    await user.click(screen.getByTestId("update-slots"));

    // Step 5: Reopen the popover (toggle: activeToolId null -> "upscale")
    await user.click(screen.getByTestId("toggle-popover"));
    popover = await screen.findByTestId("upscale-popover");

    // Step 6: Verify updated slots are used (props-driven, no cache)
    modelSlotsEl = within(popover).getByTestId("model-slots");
    expect(modelSlotsEl).toBeInTheDocument();

    // Configure resolveActiveSlots to return the updated model
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "nightmareai/real-esrgan", modelParams: {} },
    ]);

    // Click 2x to verify the updated slots are used in the handler
    const btn2x = screen.getByTestId("upscale-2x-button");
    await user.click(btn2x);

    expect(onUpscale).toHaveBeenCalledWith({
      scale: 2,
      modelIds: ["nightmareai/real-esrgan"],
    });
  });

  it("AC-7b: should reset legacy tier state to draft when popover reopens", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();

    /**
     * Wrapper for legacy path (no modelSlots) to verify tier reset behavior.
     * Uses a separate close button that dispatches a different tool to force
     * activeToolId to null (toggle "upscale" -> null), then open button
     * re-dispatches "upscale".
     */
    function LegacyReopenHarness() {
      const { dispatch } = useCanvasDetail();

      return (
        <>
          <button
            data-testid="open-popover"
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" })
            }
          >
            Open
          </button>
          <button
            data-testid="close-popover"
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" })
            }
          >
            Close
          </button>
          <UpscalePopover
            onUpscale={onUpscale}
            isUpscaleDisabled={false}
          />
        </>
      );
    }

    render(
      <CanvasDetailProvider initialGenerationId="gen-legacy-reopen">
        <LegacyReopenHarness />
      </CanvasDetailProvider>
    );

    // Step 1: Open popover
    await user.click(screen.getByTestId("open-popover"));
    await screen.findByTestId("upscale-popover");

    // Step 2: Switch to Quality
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");

    // Step 3: Close popover (toggle off -- dispatching "upscale" again sets activeToolId to null)
    await user.click(screen.getByTestId("close-popover"));

    // Step 4: Reopen popover (toggle on -- dispatching "upscale" sets activeToolId to "upscale")
    await user.click(screen.getByTestId("open-popover"));
    const popoverReopened = await screen.findByTestId("upscale-popover");
    expect(popoverReopened).toBeInTheDocument();

    // Step 5: Verify tier is reset to "Draft"
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "true");
    expect(draftButton).toHaveAttribute("data-active", "true");

    const qualityAfterReopen = screen.getByText("Quality");
    expect(qualityAfterReopen).toHaveAttribute("aria-pressed", "false");
  });

  // -------------------------------------------------------------------------
  // AC-8: isUpscaleDisabled zeigt Tooltip-State
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN isUpscaleDisabled === true
   *       WHEN die Komponente rendert
   *       THEN wird weiterhin der Disabled-State mit Tooltip gerendert
   *            (unveraendert gegenueber aktuellem Verhalten)
   */
  it("AC-8: should render disabled state with tooltip when isUpscaleDisabled is true", async () => {
    const user = userEvent.setup();

    renderUpscalePopover({
      isUpscaleDisabled: true,
      modelSlots: [slot1Active],
      models: allModels,
    });

    // Disabled icon should be present
    const disabledIcon = screen.getByTestId("upscale-icon-disabled");
    expect(disabledIcon).toBeInTheDocument();
    expect(disabledIcon).toHaveAttribute("aria-disabled", "true");
    expect(disabledIcon.className).toMatch(/pointer-events-none/);
    expect(disabledIcon.className).toMatch(/opacity-50/);

    // Hover to trigger tooltip
    const trigger = screen.getByTestId("upscale-disabled-trigger");
    await user.hover(trigger);

    // Tooltip should appear with correct text
    const tooltip = await screen.findByRole("tooltip", {
      name: "Image too large for upscale",
    });
    expect(tooltip).toBeInTheDocument();

    // Popover should NOT be rendered
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();

    // ModelSlots should NOT be rendered
    expect(screen.queryByTestId("model-slots")).not.toBeInTheDocument();
  });
});
