// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per spec)
// Mock server actions, useModelSchema hook, ParameterPanel, and Radix Select.
//
// Radix Select uses portals + pointer-events that do not work in jsdom.
// We replace the Select component with a native <select> wrapper that
// faithfully calls onValueChange. This allows us to test the ModelSlots
// component logic (filtering, auto-activation, event dispatch) without
// being blocked by Radix's DOM/layout requirements.
// ---------------------------------------------------------------------------

// --- Mock server actions ---
const mockUpdateModelSlot = vi.fn();
const mockToggleSlotActive = vi.fn();

vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: (...args: unknown[]) => mockUpdateModelSlot(...args),
  toggleSlotActive: (...args: unknown[]) => mockToggleSlotActive(...args),
}));

// --- Mock useModelSchema hook ---
const mockUseModelSchema = vi.fn();

vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: (...args: unknown[]) => mockUseModelSchema(...args),
}));

// --- Mock ParameterPanel ---
vi.mock("@/components/workspace/parameter-panel", () => ({
  ParameterPanel: (props: { schema: unknown; isLoading: boolean; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) => (
    <div data-testid="parameter-panel" data-loading={props.isLoading}>
      {props.schema ? "schema-loaded" : "no-schema"}
    </div>
  ),
}));

// --- Mock Radix Select with a jsdom-compatible native select ---
// This preserves the onValueChange contract while being testable in jsdom.
vi.mock("@/components/ui/select", () => {
  // Track the onValueChange handler via context so SelectItem can call it
  const SelectContext = React.createContext<{
    onValueChange?: (v: string) => void;
    value?: string;
    disabled?: boolean;
  }>({});

  function Select(props: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void; disabled?: boolean }) {
    return (
      <SelectContext.Provider value={{ onValueChange: props.onValueChange, value: props.value, disabled: props.disabled }}>
        {props.children}
      </SelectContext.Provider>
    );
  }

  function SelectTrigger(props: { children: React.ReactNode; className?: string; size?: string; "data-testid"?: string }) {
    const ctx = React.useContext(SelectContext);
    return (
      <button
        role="combobox"
        data-testid={props["data-testid"]}
        data-slot="select-trigger"
        disabled={ctx.disabled}
        type="button"
      >
        {props.children}
      </button>
    );
  }

  function SelectValue(props: { placeholder?: string }) {
    const ctx = React.useContext(SelectContext);
    return (
      <span data-slot="select-value">
        {ctx.value ? undefined : props.placeholder}
      </span>
    );
  }

  function SelectContent(props: { children: React.ReactNode }) {
    return <div data-slot="select-content" role="listbox">{props.children}</div>;
  }

  function SelectItem(props: { children: React.ReactNode; value: string }) {
    const ctx = React.useContext(SelectContext);
    return (
      <div
        role="option"
        aria-selected={ctx.value === props.value}
        data-slot="select-item"
        onClick={() => ctx.onValueChange?.(props.value)}
      >
        {props.children}
      </div>
    );
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// --- Import component under test AFTER mocks ---
import { ModelSlots, type ModelSlotsProps } from "@/components/ui/model-slots";
import type { GenerationMode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Helper to create a ModelSlot-like object with sensible defaults */
function createSlot(overrides: {
  slot: number;
  active?: boolean;
  modelId?: string | null;
  modelParams?: Record<string, unknown>;
}) {
  return {
    id: `slot-${overrides.slot}-id`,
    mode: "txt2img" as const,
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
    capabilities: overrides.capabilities ?? { txt2img: true },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

// Standard fixture: 3 slots (slot 1 active + model, slot 2 active + model, slot 3 inactive no model)
const standardSlots = [
  createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
  createSlot({ slot: 2, active: true, modelId: "stability-ai/sdxl" }),
  createSlot({ slot: 3, active: false, modelId: null }),
];

// 5 models: 3 compatible with txt2img, 2 not
const allModels = [
  createModel({ replicateId: "black-forest-labs/flux-schnell", name: "Flux Schnell", capabilities: { txt2img: true } }),
  createModel({ replicateId: "stability-ai/sdxl", name: "SDXL", capabilities: { txt2img: true } }),
  createModel({ replicateId: "acme/fast-gen", name: "FastGen", capabilities: { txt2img: true } }),
  createModel({ replicateId: "acme/upscaler-v2", name: "Upscaler V2", capabilities: { txt2img: false, upscale: true } }),
  createModel({ replicateId: "acme/inpaint-pro", name: "Inpaint Pro", capabilities: { txt2img: false, inpaint: true } }),
];

function defaultProps(overrides?: Partial<ModelSlotsProps>): ModelSlotsProps {
  return {
    mode: "txt2img" as GenerationMode,
    slots: standardSlots,
    models: allModels,
    variant: "stacked",
    disabled: false,
    ...overrides,
  } as ModelSlotsProps;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: useModelSchema returns a loaded schema
  mockUseModelSchema.mockReturnValue({
    schema: { aspect_ratio: { type: "string", default: "1:1" } },
    isLoading: false,
    error: null,
  });

  // Default: server actions resolve with updated slot
  mockToggleSlotActive.mockImplementation(async (input: { slot: number; active: boolean }) =>
    createSlot({ slot: input.slot, active: input.active, modelId: "black-forest-labs/flux-schnell" }),
  );

  mockUpdateModelSlot.mockImplementation(async (input: { slot: number; modelId: string }) =>
    createSlot({ slot: input.slot, active: true, modelId: input.modelId }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Acceptance Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Acceptance", () => {
  /**
   * AC-1: GIVEN die ModelSlots-Komponente wird mit mode="txt2img" und 3 Slots
   * (Slot 1 active mit Model, Slot 2 active mit Model, Slot 3 inactive ohne Model) gerendert
   * WHEN die Komponente sichtbar ist
   * THEN werden nur die Slots mit zugewiesenen Models angezeigt (progressive disclosure)
   * AND ein "+ Add model" Button wird angezeigt wenn weniger als 3 Slots sichtbar sind
   */
  it("AC-1: should render slots with models visible and show add button for hidden slots", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Slots 1 and 2 (have models) should be visible
    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();

    // Slot 3 (no model) should be hidden initially
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    // Add button should be visible
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();

    // Checkboxes for visible slots
    expect(screen.getByTestId("slot-checkbox-1")).toHaveAttribute("data-state", "checked");
    expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute("data-state", "checked");
  });

  /**
   * AC-2: GIVEN Slot 1 ist der einzige aktive Slot
   * WHEN der User die Checkbox von Slot 1 uncheckt
   * THEN bleibt Slot 1 checked (min-1-active Regel)
   * AND toggleSlotActive wird NICHT aufgerufen
   */
  it("AC-2: should prevent unchecking the last active slot and not call toggleSlotActive", async () => {
    const user = userEvent.setup();

    // Only slot 1 is active
    const singleActiveSlots = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
      createSlot({ slot: 2, active: false, modelId: "stability-ai/sdxl" }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    render(<ModelSlots {...defaultProps({ slots: singleActiveSlots })} />);

    const cb1 = screen.getByTestId("slot-checkbox-1");

    // Checkbox should be disabled because it is the last active slot
    expect(cb1).toBeDisabled();

    // Attempt to click it anyway
    await user.click(cb1);

    // toggleSlotActive should NOT have been called
    expect(mockToggleSlotActive).not.toHaveBeenCalled();

    // Should still be checked
    expect(cb1).toHaveAttribute("data-state", "checked");
  });

  /**
   * AC-3: GIVEN Slot 2 ist active und hat ein Model zugewiesen
   * WHEN der User die Checkbox von Slot 2 uncheckt
   * THEN wird toggleSlotActive({ mode, slot: 2, active: false }) aufgerufen
   * AND nach Server-Antwort ist Slot 2 unchecked
   */
  it("AC-3: should call toggleSlotActive when unchecking a slot that is not the last active", async () => {
    const user = userEvent.setup();

    mockToggleSlotActive.mockResolvedValueOnce(
      createSlot({ slot: 2, active: false, modelId: "stability-ai/sdxl" }),
    );

    render(<ModelSlots {...defaultProps()} />);

    const cb2 = screen.getByTestId("slot-checkbox-2");
    expect(cb2).toHaveAttribute("data-state", "checked");

    // Click to uncheck
    await user.click(cb2);

    // Server action must be called with correct arguments
    expect(mockToggleSlotActive).toHaveBeenCalledWith({
      mode: "txt2img",
      slot: 2,
      active: false,
    });

    // After server response, slot 2 should be unchecked
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute("data-state", "unchecked");
    });
  });

  /**
   * AC-4: GIVEN Slot 3 hat kein Model zugewiesen (model_id ist null)
   * WHEN der User den "+ Add model" Button klickt um Slot 3 aufzudecken
   * THEN ist die Checkbox von Slot 3 disabled (nicht klickbar)
   * AND das Dropdown zeigt den Placeholder-Text (z.B. "select model")
   */
  it("AC-4: should disable checkbox for empty slot and show placeholder in dropdown", async () => {
    const user = userEvent.setup();
    render(<ModelSlots {...defaultProps()} />);

    // Slot 3 is hidden initially — reveal it via add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Checkbox for slot 3 is disabled
    const cb3 = screen.getByTestId("slot-checkbox-3");
    expect(cb3).toBeDisabled();

    // Select trigger for slot 3 should show placeholder text
    const selectTrigger3 = screen.getByTestId("slot-select-3");
    expect(within(selectTrigger3).getByText("select model")).toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN Slot 3 ist leer (kein Model, inactive)
   * WHEN der User ein Model aus dem Dropdown von Slot 3 auswaehlt
   * THEN wird updateModelSlot({ mode, slot: 3, modelId: selectedModelId }) aufgerufen
   * AND nach Server-Antwort ist Slot 3 automatisch active (Checkbox checked)
   */
  it("AC-5: should call updateModelSlot on empty slot model selection and auto-activate", async () => {
    const user = userEvent.setup();

    const selectedModelId = "black-forest-labs/flux-schnell";
    mockUpdateModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 3, active: true, modelId: selectedModelId }),
    );

    render(<ModelSlots {...defaultProps()} />);

    // Reveal slot 3 via add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Slot 3 starts unchecked with no model
    expect(screen.getByTestId("slot-checkbox-3")).toHaveAttribute("data-state", "unchecked");

    // Find and click the "Flux Schnell" option within slot 3's row
    const slotRow3 = screen.getByTestId("slot-row-3");
    const fluxOption = within(slotRow3).getByRole("option", { name: "Flux Schnell" });
    await user.click(fluxOption);

    // updateModelSlot must have been called
    expect(mockUpdateModelSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "txt2img",
        slot: 3,
        modelId: selectedModelId,
      }),
    );

    // After server response, slot 3 should be auto-activated
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-3")).toHaveAttribute("data-state", "checked");
    });
  });

  /**
   * AC-6: GIVEN der aktuelle Mode ist txt2img und es gibt 5 Models im Katalog,
   * davon 3 kompatibel mit txt2img
   * WHEN der User das Dropdown von Slot 1 oeffnet
   * THEN zeigt das Dropdown nur die 3 kompatiblen Models an
   */
  it("AC-6: should only show models compatible with current mode in dropdown", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Get all options within slot 1's select dropdown
    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");

    const optionTexts = options.map((o) => o.textContent);

    // Should show the 3 compatible txt2img models
    expect(optionTexts).toContain("Flux Schnell");
    expect(optionTexts).toContain("SDXL");
    expect(optionTexts).toContain("FastGen");

    // Should NOT show the 2 incompatible models
    expect(optionTexts).not.toContain("Upscaler V2");
    expect(optionTexts).not.toContain("Inpaint Pro");

    // Exactly 3 options
    expect(options).toHaveLength(3);
  });

  /**
   * AC-7: GIVEN Slot 1 ist active mit Model "flux-schnell" und die Komponente
   * hat variant="stacked"
   * WHEN die Komponente rendert
   * THEN wird unterhalb von Slot 1 ein ParameterPanel gerendert (via useModelSchema Hook)
   * AND das ParameterPanel zeigt die schema-basierten Parameter des zugewiesenen Models
   */
  it("AC-7: should render ParameterPanel below active slots in stacked variant", () => {
    render(<ModelSlots {...defaultProps({ variant: "stacked" })} />);

    // ParameterPanel should be rendered for active slots (1 and 2)
    const paramsSlot1 = screen.getByTestId("slot-params-1");
    expect(paramsSlot1).toBeInTheDocument();

    // The mock ParameterPanel should show "schema-loaded"
    const paramPanel = within(paramsSlot1).getByTestId("parameter-panel");
    expect(paramPanel).toBeInTheDocument();
    expect(paramPanel).toHaveTextContent("schema-loaded");

    // useModelSchema should have been called with the model ID for active slots
    expect(mockUseModelSchema).toHaveBeenCalledWith("black-forest-labs/flux-schnell");
    expect(mockUseModelSchema).toHaveBeenCalledWith("stability-ai/sdxl");
  });

  /**
   * AC-8: GIVEN Slot 2 ist inactive mit zugewiesenem Model
   * WHEN die Komponente rendert
   * THEN wird KEIN ParameterPanel fuer Slot 2 gerendert
   */
  it("AC-8: should not render ParameterPanel for inactive slots", () => {
    const slotsWithInactiveSlot2 = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
      createSlot({ slot: 2, active: false, modelId: "stability-ai/sdxl" }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    render(<ModelSlots {...defaultProps({ slots: slotsWithInactiveSlot2 })} />);

    // Slot 1 (active) should have params
    expect(screen.getByTestId("slot-params-1")).toBeInTheDocument();

    // Slot 2 (inactive, even with model) should NOT have params
    expect(screen.queryByTestId("slot-params-2")).not.toBeInTheDocument();

    // Slot 3 (inactive, no model) should NOT have params
    expect(screen.queryByTestId("slot-params-3")).not.toBeInTheDocument();
  });

  /**
   * AC-9: GIVEN die Komponente hat variant="compact"
   * WHEN die Komponente rendert
   * THEN werden alle 3 Slots horizontal in einer Zeile dargestellt
   * AND es werden KEINE ParameterPanels gerendert (unabhaengig vom Active-Status)
   */
  it("AC-9: should render slots horizontally without ParameterPanels in compact variant", () => {
    render(<ModelSlots {...defaultProps({ variant: "compact" })} />);

    // Container should have data-variant="compact" and flex layout
    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "compact");
    expect(container.className).toMatch(/flex/);

    // Slots with models (1 and 2) should be rendered, slot 3 hidden (progressive disclosure)
    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    // Add button should be visible in compact variant
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();

    // NO ParameterPanels should be rendered, even though slots 1 and 2 are active
    expect(screen.queryByTestId("slot-params-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-params-2")).not.toBeInTheDocument();

    // useModelSchema should have been called with undefined for all slots in compact mode
    // (because showParams = false when variant is compact)
    for (const call of mockUseModelSchema.mock.calls) {
      expect(call[0]).toBeUndefined();
    }
  });

  /**
   * AC-10: GIVEN ein updateModelSlot() Aufruf gibt erfolgreich einen aktualisierten Slot zurueck
   * WHEN die Server-Antwort verarbeitet wird
   * THEN wird ein "model-slots-changed" CustomEvent auf window dispatcht
   */
  it("AC-10: should dispatch model-slots-changed CustomEvent after successful updateModelSlot", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    const selectedModelId = "acme/fast-gen";
    mockUpdateModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 3, active: true, modelId: selectedModelId }),
    );

    render(<ModelSlots {...defaultProps()} />);

    // Reveal slot 3 via add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Click the FastGen option within slot 3
    const slotRow3 = screen.getByTestId("slot-row-3");
    const option = within(slotRow3).getByRole("option", { name: "FastGen" });
    await user.click(option);

    // Wait for the custom event to be dispatched
    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    // Verify it was a CustomEvent
    const event = eventSpy.mock.calls[0][0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe("model-slots-changed");

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  /**
   * AC-11: GIVEN ein toggleSlotActive() Aufruf gibt erfolgreich einen aktualisierten Slot zurueck
   * WHEN die Server-Antwort verarbeitet wird
   * THEN wird ein "model-slots-changed" CustomEvent auf window dispatcht
   */
  it("AC-11: should dispatch model-slots-changed CustomEvent after successful toggleSlotActive", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    mockToggleSlotActive.mockResolvedValueOnce(
      createSlot({ slot: 2, active: false, modelId: "stability-ai/sdxl" }),
    );

    render(<ModelSlots {...defaultProps()} />);

    // Click to uncheck slot 2 (not the last active -- slot 1 is also active)
    const cb2 = screen.getByTestId("slot-checkbox-2");
    await user.click(cb2);

    // Wait for the custom event to be dispatched
    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    const event = eventSpy.mock.calls[0][0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe("model-slots-changed");

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  /**
   * AC-12: GIVEN die Komponente empfaengt disabled={true} (z.B. waehrend Generierung)
   * WHEN die Komponente rendert
   * THEN sind alle Checkboxen und Dropdowns disabled
   */
  it("AC-12: should disable all visible checkboxes and dropdowns when disabled prop is true", () => {
    render(<ModelSlots {...defaultProps({ disabled: true })} />);

    // Visible slots (1 and 2) must have disabled checkboxes and select triggers
    for (const num of [1, 2]) {
      expect(screen.getByTestId(`slot-checkbox-${num}`)).toBeDisabled();
      expect(screen.getByTestId(`slot-select-${num}`)).toBeDisabled();
    }

    // Slot 3 is hidden (progressive disclosure)
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    // Add button must NOT be shown when disabled
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Unit Tests -- Pure helper functions (tested indirectly via component)
// ---------------------------------------------------------------------------

describe("ModelSlots Unit - getCompatibleModels", () => {
  // getCompatibleModels is not exported, so we test the filtering logic
  // indirectly through the component render. AC-6 covers the main case,
  // these tests cover edge cases.

  it("should include models without capabilities data (permissive fallback)", () => {
    const modelsWithNullCaps = [
      createModel({ replicateId: "unknown/model-x", name: "Model X" }),
      createModel({ replicateId: "acme/fast-gen", name: "FastGen", capabilities: { txt2img: true } }),
    ];
    // Override capabilities to null for the first model
    (modelsWithNullCaps[0] as { capabilities: null }).capabilities = null;

    render(<ModelSlots {...defaultProps({ models: modelsWithNullCaps })} />);

    // Check the options rendered in slot 1 (all models visible inline via mock select)
    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    // Both models should appear (null capabilities = permissive fallback)
    expect(optionTexts).toContain("Model X");
    expect(optionTexts).toContain("FastGen");
  });

  it("should include models where capability key is missing (undefined = compatible)", () => {
    const modelsWithMissingKey = [
      createModel({ replicateId: "acme/multi", name: "MultiModel", capabilities: { img2img: true } }),
    ];

    render(<ModelSlots {...defaultProps({ models: modelsWithMissingKey })} />);

    // Check the options rendered in slot 1
    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    // Should appear because missing key = compatible (permissive fallback)
    expect(optionTexts).toContain("MultiModel");
  });

  it("should exclude models with capability explicitly set to false", () => {
    const mixedModels = [
      createModel({ replicateId: "acme/good", name: "Good Model", capabilities: { txt2img: true } }),
      createModel({ replicateId: "acme/bad", name: "Bad Model", capabilities: { txt2img: false } }),
    ];

    render(<ModelSlots {...defaultProps({ models: mixedModels })} />);

    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("Good Model");
    expect(optionTexts).not.toContain("Bad Model");
  });
});

// ---------------------------------------------------------------------------
// Integration Tests -- Component interaction patterns
// ---------------------------------------------------------------------------

describe("ModelSlots Integration", () => {
  it("should show only slot 1 with add button when only one slot has a model", () => {
    const oneSlot = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
    ];

    render(<ModelSlots {...defaultProps({ slots: oneSlot })} />);

    // Only slot 1 should be visible (progressive disclosure)
    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    // Add button should be shown
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();
  });

  it("should rollback optimistic update when server action fails on toggle", async () => {
    const user = userEvent.setup();

    mockToggleSlotActive.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    const cb2 = screen.getByTestId("slot-checkbox-2");
    expect(cb2).toHaveAttribute("data-state", "checked");

    // Click to toggle off
    await user.click(cb2);

    // After error, should roll back to checked
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute("data-state", "checked");
    });
  });

  it("should rollback optimistic update when server action fails on model update", async () => {
    const user = userEvent.setup();
    mockUpdateModelSlot.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    // Reveal slot 3 via add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Click the Flux Schnell option within slot 3
    const slotRow3 = screen.getByTestId("slot-row-3");
    const option = within(slotRow3).getByRole("option", { name: "Flux Schnell" });
    await user.click(option);

    // After error, slot 3 should roll back to unchecked/no model
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-3")).toHaveAttribute("data-state", "unchecked");
    });
  });

  it("should not dispatch custom event when server action returns an error", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    mockToggleSlotActive.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    const cb2 = screen.getByTestId("slot-checkbox-2");
    await user.click(cb2);

    // Wait for the action to complete and ensure no event was dispatched
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute("data-state", "checked");
    });

    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  it("stacked variant should have data-variant=stacked and vertical layout", () => {
    render(<ModelSlots {...defaultProps({ variant: "stacked" })} />);

    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "stacked");
    // Stacked uses space-y-3 (not flex)
    expect(container.className).toMatch(/space-y/);
    expect(container.className).not.toMatch(/flex/);
  });
});

// ---------------------------------------------------------------------------
// Progressive Disclosure Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Progressive Disclosure", () => {
  it("should show all 3 slots without add button when all slots have models", () => {
    const allAssigned = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
      createSlot({ slot: 2, active: true, modelId: "stability-ai/sdxl" }),
      createSlot({ slot: 3, active: false, modelId: "acme/fast-gen" }),
    ];

    render(<ModelSlots {...defaultProps({ slots: allAssigned })} />);

    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-3")).toBeInTheDocument();
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();
  });

  it("should show only slot 1 when no slots have models", () => {
    const noModels = [
      createSlot({ slot: 1, active: true, modelId: null }),
      createSlot({ slot: 2, active: false, modelId: null }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    render(<ModelSlots {...defaultProps({ slots: noModels })} />);

    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();
  });

  it("should reveal next slot when add button is clicked", async () => {
    const user = userEvent.setup();

    render(<ModelSlots {...defaultProps()} />);

    // Initially: 2 slots visible (slots 1+2 have models)
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    // Click add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Now slot 3 should be visible
    expect(screen.getByTestId("slot-row-3")).toBeInTheDocument();

    // Add button should disappear (all 3 slots now visible)
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();
  });

  it("should reveal slots one at a time with multiple add button clicks", async () => {
    const user = userEvent.setup();
    const noModels = [
      createSlot({ slot: 1, active: true, modelId: null }),
      createSlot({ slot: 2, active: false, modelId: null }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    render(<ModelSlots {...defaultProps({ slots: noModels })} />);

    // Initially: only slot 1
    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();

    // First click: reveal slot 2
    await user.click(screen.getByTestId("add-slot-button"));
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();

    // Second click: reveal slot 3
    await user.click(screen.getByTestId("add-slot-button"));
    expect(screen.getByTestId("slot-row-3")).toBeInTheDocument();
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();
  });
});
