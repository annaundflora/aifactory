// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per spec)
// Reuse the same mocking approach as the stacked variant tests.
// Mock server actions, useModelSchema hook, ParameterPanel, and Radix Select.
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
  ParameterPanel: (props: {
    schema: unknown;
    isLoading: boolean;
    values: Record<string, unknown>;
    onChange: (v: Record<string, unknown>) => void;
  }) => (
    <div data-testid="parameter-panel" data-loading={props.isLoading}>
      {props.schema ? "schema-loaded" : "no-schema"}
    </div>
  ),
}));

// --- Mock Radix Select with a jsdom-compatible native select ---
vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    onValueChange?: (v: string) => void;
    value?: string;
    disabled?: boolean;
  }>({});

  function Select(props: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }) {
    return (
      <SelectContext.Provider
        value={{
          onValueChange: props.onValueChange,
          value: props.value,
          disabled: props.disabled,
        }}
      >
        {props.children}
      </SelectContext.Provider>
    );
  }

  function SelectTrigger(props: {
    children: React.ReactNode;
    className?: string;
    size?: string;
    "data-testid"?: string;
  }) {
    const ctx = React.useContext(SelectContext);
    return (
      <button
        role="combobox"
        data-testid={props["data-testid"]}
        data-slot="select-trigger"
        className={props.className}
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
    return (
      <div data-slot="select-content" role="listbox">
        {props.children}
      </div>
    );
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
import {
  ModelSlots,
  type ModelSlotsProps,
} from "@/components/ui/model-slots";
import type { GenerationMode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

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
  createSlot({
    slot: 1,
    active: true,
    modelId: "black-forest-labs/flux-schnell",
  }),
  createSlot({ slot: 2, active: true, modelId: "stability-ai/sdxl" }),
  createSlot({ slot: 3, active: false, modelId: null }),
];

// 5 models: 3 compatible with txt2img, 2 not
const allModels = [
  createModel({
    replicateId: "black-forest-labs/flux-schnell",
    name: "Flux Schnell",
    capabilities: { txt2img: true },
  }),
  createModel({
    replicateId: "stability-ai/sdxl",
    name: "SDXL",
    capabilities: { txt2img: true },
  }),
  createModel({
    replicateId: "acme/fast-gen",
    name: "FastGen",
    capabilities: { txt2img: true },
  }),
  createModel({
    replicateId: "acme/upscaler-v2",
    name: "Upscaler V2",
    capabilities: { txt2img: false, upscale: true },
  }),
  createModel({
    replicateId: "acme/inpaint-pro",
    name: "Inpaint Pro",
    capabilities: { txt2img: false, inpaint: true },
  }),
];

function defaultProps(
  overrides?: Partial<ModelSlotsProps>,
): ModelSlotsProps {
  return {
    mode: "txt2img" as GenerationMode,
    slots: standardSlots,
    models: allModels,
    variant: "compact",
    disabled: false,
    ...overrides,
  } as ModelSlotsProps;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockUseModelSchema.mockReturnValue({
    schema: { aspect_ratio: { type: "string", default: "1:1" } },
    isLoading: false,
    error: null,
  });

  mockToggleSlotActive.mockImplementation(
    async (input: { slot: number; active: boolean }) =>
      createSlot({
        slot: input.slot,
        active: input.active,
        modelId: "black-forest-labs/flux-schnell",
      }),
  );

  mockUpdateModelSlot.mockImplementation(
    async (input: { slot: number; modelId: string }) =>
      createSlot({ slot: input.slot, active: true, modelId: input.modelId }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Acceptance Tests -- Compact Variant (Slice 07)
// ---------------------------------------------------------------------------

describe("ModelSlots Compact Acceptance", () => {
  /**
   * AC-1: GIVEN die ModelSlots-Komponente wird mit variant="compact" und 3 Slots gerendert
   * WHEN die Komponente sichtbar ist
   * THEN werden alle 3 Slots horizontal in einer einzigen Zeile dargestellt (Flex-Row)
   * AND die Gesamthoehe der Komponente ist eine einzelne Zeile (kein vertikales Stacking)
   */
  it("AC-1: should render all 3 slots in a single horizontal row when variant is compact", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Container must have data-variant="compact"
    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "compact");

    // Container must use flex layout (horizontal row) -- no space-y (vertical stacking)
    expect(container.className).toMatch(/flex/);
    expect(container.className).not.toMatch(/space-y/);

    // All 3 slot rows must be present
    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-3")).toBeInTheDocument();

    // Each slot row must also use flex for inline checkbox+dropdown
    for (const num of [1, 2, 3]) {
      const row = screen.getByTestId(`slot-row-${num}`);
      expect(row.className).toMatch(/flex/);
      expect(row.className).toMatch(/items-center/);
    }

    // All 3 slot rows are direct children of the container (single row)
    const children = Array.from(container.children);
    expect(children).toHaveLength(3);
  });

  /**
   * AC-2: GIVEN variant="compact" und Slot 1 hat Model "black-forest-labs/flux-schnell"
   *   (display name "Flux Schnell")
   * WHEN die Komponente rendert
   * THEN wird der Model-Name im Dropdown-Trigger auf maximal ~12-15 Zeichen truncated mit Ellipsis
   * AND der volle Model-Name ist im geoeffneten Dropdown sichtbar (nicht truncated)
   */
  it("AC-2: should truncate model name in dropdown trigger and show full name in open dropdown", () => {
    render(<ModelSlots {...defaultProps()} />);

    // The select trigger for slot 1 must apply CSS truncation classes
    const trigger = screen.getByTestId("slot-select-1");
    // The trigger has a className with truncate styling for the select-value
    // Check that the trigger has max-width constraints for truncation
    expect(trigger.className).toMatch(/max-w/);
    // The trigger also has text-xs for compact sizing
    expect(trigger.className).toMatch(/text-xs/);

    // The trigger's select-value child must have truncation styling
    const selectValue = within(trigger).getByText(
      (_content, element) =>
        element?.getAttribute("data-slot") === "select-value",
    );
    // Note: The CSS truncate class is applied via Tailwind descendant selector
    // (*:data-[slot=select-value]:truncate) on the trigger, which the mock
    // propagates as className. We verify the trigger carries this class.
    expect(trigger.className).toContain("truncate");

    // Full model names must be visible in the dropdown content (not truncated)
    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Flux Schnell");
    expect(optionTexts).toContain("SDXL");
    expect(optionTexts).toContain("FastGen");
  });

  /**
   * AC-3: GIVEN variant="compact" und Slot 1 ist active
   * WHEN die Komponente rendert
   * THEN wird KEIN ParameterPanel unterhalb oder neben dem Slot gerendert
   * AND dies gilt unabhaengig davon ob das Model ein Schema hat
   */
  it("AC-3: should not render any ParameterPanel in compact variant regardless of active state", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Even though slots 1 and 2 are active with models assigned,
    // no ParameterPanel should be rendered in compact mode
    expect(screen.queryByTestId("slot-params-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-params-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-params-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

    // useModelSchema should have been called with undefined for all slots
    // (because showParams = false when variant is compact)
    for (const call of mockUseModelSchema.mock.calls) {
      expect(call[0]).toBeUndefined();
    }
  });

  /**
   * AC-4: GIVEN variant="compact" und Slot 3 hat kein Model zugewiesen
   * WHEN die Komponente rendert
   * THEN zeigt der Dropdown-Trigger einen kurzen Placeholder (z.B. "--" oder aehnlich kompakt)
   * AND die Checkbox ist disabled (identisch zum Stacked-Verhalten)
   */
  it("AC-4: should show compact placeholder for empty slot with disabled checkbox", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Checkbox for slot 3 must be disabled (no model assigned)
    const cb3 = screen.getByTestId("slot-checkbox-3");
    expect(cb3).toBeDisabled();

    // Select trigger for slot 3 should show the compact placeholder "--"
    const selectTrigger3 = screen.getByTestId("slot-select-3");
    expect(within(selectTrigger3).getByText("--")).toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN variant="compact" und nur Slot 1 ist active
   * WHEN der User versucht Slot 1 zu unchecken
   * THEN bleibt Slot 1 checked (min-1-active Regel, identisch zum Stacked-Verhalten)
   */
  it("AC-5: should prevent unchecking the last active slot in compact variant", async () => {
    const user = userEvent.setup();

    // Only slot 1 is active
    const singleActiveSlots = [
      createSlot({
        slot: 1,
        active: true,
        modelId: "black-forest-labs/flux-schnell",
      }),
      createSlot({
        slot: 2,
        active: false,
        modelId: "stability-ai/sdxl",
      }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    render(
      <ModelSlots {...defaultProps({ slots: singleActiveSlots })} />,
    );

    const cb1 = screen.getByTestId("slot-checkbox-1");

    // Checkbox must be disabled because it is the last active slot
    expect(cb1).toBeDisabled();

    // Attempt to click it anyway
    await user.click(cb1);

    // toggleSlotActive should NOT have been called
    expect(mockToggleSlotActive).not.toHaveBeenCalled();

    // Should still be checked
    expect(cb1).toHaveAttribute("data-state", "checked");
  });

  /**
   * AC-6: GIVEN variant="compact" und der User oeffnet das Dropdown von Slot 2
   * WHEN das Dropdown-Menu erscheint
   * THEN zeigt es die vollen Model-Namen (nicht truncated) in normaler Groesse
   * AND es werden nur mode-kompatible Models angezeigt (identisch zum Stacked-Verhalten)
   */
  it("AC-6: should show full model names and only mode-compatible models in compact dropdown", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Get all options within slot 2's row
    const slotRow2 = screen.getByTestId("slot-row-2");
    const options = within(slotRow2).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    // Should show the 3 compatible txt2img models with full names
    expect(optionTexts).toContain("Flux Schnell");
    expect(optionTexts).toContain("SDXL");
    expect(optionTexts).toContain("FastGen");

    // Should NOT show the 2 incompatible models
    expect(optionTexts).not.toContain("Upscaler V2");
    expect(optionTexts).not.toContain("Inpaint Pro");

    // Exactly 3 compatible options
    expect(options).toHaveLength(3);
  });

  /**
   * AC-7: GIVEN variant="compact" und der User waehlt ein Model auf einem leeren Slot
   * WHEN updateModelSlot erfolgreich zurueckgibt
   * THEN wird der Slot auto-aktiviert (Checkbox checked)
   * AND ein "model-slots-changed" CustomEvent wird dispatcht
   * AND das Verhalten ist identisch zum Stacked-Layout
   */
  it("AC-7: should auto-activate slot and dispatch model-slots-changed event on model selection", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    const selectedModelId = "black-forest-labs/flux-schnell";
    mockUpdateModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 3, active: true, modelId: selectedModelId }),
    );

    render(<ModelSlots {...defaultProps()} />);

    // Slot 3 starts unchecked with no model
    expect(screen.getByTestId("slot-checkbox-3")).toHaveAttribute(
      "data-state",
      "unchecked",
    );

    // Find and click the "Flux Schnell" option within slot 3's row
    const slotRow3 = screen.getByTestId("slot-row-3");
    const fluxOption = within(slotRow3).getByRole("option", {
      name: "Flux Schnell",
    });
    await user.click(fluxOption);

    // updateModelSlot must have been called with correct arguments
    expect(mockUpdateModelSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "txt2img",
        slot: 3,
        modelId: selectedModelId,
      }),
    );

    // After server response, slot 3 should be auto-activated
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-3")).toHaveAttribute(
        "data-state",
        "checked",
      );
    });

    // CustomEvent "model-slots-changed" should have been dispatched
    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    const event = eventSpy.mock.calls[0][0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe("model-slots-changed");

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  /**
   * AC-8: GIVEN variant="compact" und disabled={true}
   * WHEN die Komponente rendert
   * THEN sind alle Checkboxen und Dropdowns disabled
   * AND die visuelle Darstellung bleibt horizontal einzeilig
   */
  it("AC-8: should disable all checkboxes and dropdowns when disabled prop is true in compact variant", () => {
    render(<ModelSlots {...defaultProps({ disabled: true })} />);

    // All 3 checkboxes must be disabled
    for (const num of [1, 2, 3]) {
      const checkbox = screen.getByTestId(`slot-checkbox-${num}`);
      expect(checkbox).toBeDisabled();
    }

    // All 3 select triggers must be disabled
    for (const num of [1, 2, 3]) {
      const selectTrigger = screen.getByTestId(`slot-select-${num}`);
      expect(selectTrigger).toBeDisabled();
    }

    // Layout must still be horizontal (flex row, not stacked)
    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "compact");
    expect(container.className).toMatch(/flex/);
    expect(container.className).not.toMatch(/space-y/);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests -- Compact-specific rendering logic
// ---------------------------------------------------------------------------

describe("ModelSlots Compact Unit", () => {
  it("should use smaller checkbox size in compact variant compared to stacked", () => {
    const { unmount } = render(<ModelSlots {...defaultProps()} />);

    // In compact mode, checkbox has size-4 class
    const compactCb = screen.getByTestId("slot-checkbox-1");
    expect(compactCb.className).toMatch(/size-4/);

    unmount();

    // In stacked mode, checkbox has size-5 class
    render(
      <ModelSlots {...defaultProps({ variant: "stacked" })} />,
    );
    const stackedCb = screen.getByTestId("slot-checkbox-1");
    expect(stackedCb.className).toMatch(/size-5/);
  });

  it("should apply min-w-0 on slot rows in compact variant for truncation to work", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Each compact slot row must have min-w-0 to allow flex children to shrink
    for (const num of [1, 2, 3]) {
      const row = screen.getByTestId(`slot-row-${num}`);
      expect(row.className).toMatch(/min-w-0/);
    }
  });

  it("should use compact gap between slots in compact layout", () => {
    render(<ModelSlots {...defaultProps()} />);

    const container = screen.getByTestId("model-slots");
    // Container uses gap-3 between slots
    expect(container.className).toMatch(/gap-3/);
  });

  it("compact placeholder differs from stacked placeholder", () => {
    const { unmount } = render(<ModelSlots {...defaultProps()} />);

    // Compact placeholder is "--"
    const compactTrigger = screen.getByTestId("slot-select-3");
    expect(within(compactTrigger).getByText("--")).toBeInTheDocument();

    unmount();

    // Stacked placeholder is "select model"
    render(
      <ModelSlots {...defaultProps({ variant: "stacked" })} />,
    );
    const stackedTrigger = screen.getByTestId("slot-select-3");
    expect(
      within(stackedTrigger).getByText("select model"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Integration Tests -- Compact variant interactions with server actions
// ---------------------------------------------------------------------------

describe("ModelSlots Compact Integration", () => {
  it("should rollback optimistic update when server action fails on toggle in compact mode", async () => {
    const user = userEvent.setup();
    mockToggleSlotActive.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    const cb2 = screen.getByTestId("slot-checkbox-2");
    expect(cb2).toHaveAttribute("data-state", "checked");

    // Click to toggle off
    await user.click(cb2);

    // After error, should roll back to checked
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute(
        "data-state",
        "checked",
      );
    });
  });

  it("should rollback optimistic update when server action fails on model update in compact mode", async () => {
    const user = userEvent.setup();
    mockUpdateModelSlot.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    // Click the FastGen option within slot 3
    const slotRow3 = screen.getByTestId("slot-row-3");
    const option = within(slotRow3).getByRole("option", {
      name: "FastGen",
    });
    await user.click(option);

    // After error, slot 3 should roll back to unchecked/no model
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-3")).toHaveAttribute(
        "data-state",
        "unchecked",
      );
    });
  });

  it("should not dispatch custom event when server action returns error in compact mode", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    mockToggleSlotActive.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    const cb2 = screen.getByTestId("slot-checkbox-2");
    await user.click(cb2);

    // Wait for the action to complete and ensure rollback
    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute(
        "data-state",
        "checked",
      );
    });

    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  it("should call toggleSlotActive when unchecking non-last-active slot in compact mode", async () => {
    const user = userEvent.setup();

    mockToggleSlotActive.mockResolvedValueOnce(
      createSlot({
        slot: 2,
        active: false,
        modelId: "stability-ai/sdxl",
      }),
    );

    render(<ModelSlots {...defaultProps()} />);

    const cb2 = screen.getByTestId("slot-checkbox-2");
    expect(cb2).toHaveAttribute("data-state", "checked");

    await user.click(cb2);

    expect(mockToggleSlotActive).toHaveBeenCalledWith({
      mode: "txt2img",
      slot: 2,
      active: false,
    });

    await waitFor(() => {
      expect(screen.getByTestId("slot-checkbox-2")).toHaveAttribute(
        "data-state",
        "unchecked",
      );
    });
  });
});
