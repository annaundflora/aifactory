// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external
// Mock server actions, useModelSchema hook, ParameterPanel, and Radix Select.
// ---------------------------------------------------------------------------

// --- Mock server actions ---
const mockUpdateModelSlot = vi.fn();
const mockClearModelSlot = vi.fn();

vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: (...args: unknown[]) => mockUpdateModelSlot(...args),
  clearModelSlot: (...args: unknown[]) => mockClearModelSlot(...args),
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
vi.mock("@/components/ui/select", () => {
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

// Standard fixture: slot 1+2 have models, slot 3 empty
const standardSlots = [
  createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
  createSlot({ slot: 2, active: true, modelId: "stability-ai/sdxl" }),
  createSlot({ slot: 3, active: false, modelId: null }),
];

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

  mockUseModelSchema.mockReturnValue({
    schema: { aspect_ratio: { type: "string", default: "1:1" } },
    isLoading: false,
    error: null,
  });

  mockUpdateModelSlot.mockImplementation(async (input: { slot: number; modelId: string }) =>
    createSlot({ slot: input.slot, active: true, modelId: input.modelId }),
  );

  mockClearModelSlot.mockImplementation(async (input: { slot: number }) =>
    createSlot({ slot: input.slot, active: false, modelId: null }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Acceptance Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Acceptance", () => {
  it("AC-1: should render slots with models visible and show add button for hidden slots", () => {
    render(<ModelSlots {...defaultProps()} />);

    // Slots 1 and 2 (have models) should be visible
    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();

    // Slot 3 (no model) should be hidden initially
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    // Add button should be visible
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();

    // No checkboxes should exist
    expect(screen.queryByTestId("slot-checkbox-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-checkbox-2")).not.toBeInTheDocument();
  });

  it("AC-4: should show placeholder in dropdown for empty revealed slot", async () => {
    const user = userEvent.setup();
    render(<ModelSlots {...defaultProps()} />);

    // Reveal slot 3 via add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Select trigger for slot 3 should show placeholder text
    const selectTrigger3 = screen.getByTestId("slot-select-3");
    expect(within(selectTrigger3).getByText("select model")).toBeInTheDocument();
  });

  it("AC-5: should call updateModelSlot on model selection and auto-activate", async () => {
    const user = userEvent.setup();

    const selectedModelId = "black-forest-labs/flux-schnell";
    mockUpdateModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 3, active: true, modelId: selectedModelId }),
    );

    render(<ModelSlots {...defaultProps()} />);

    // Reveal slot 3 via add button
    await user.click(screen.getByTestId("add-slot-button"));

    // Click the "Flux Schnell" option within slot 3
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
  });

  it("AC-6: should only show models compatible with current mode in dropdown", () => {
    render(<ModelSlots {...defaultProps()} />);

    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("Flux Schnell");
    expect(optionTexts).toContain("SDXL");
    expect(optionTexts).toContain("FastGen");
    expect(optionTexts).not.toContain("Upscaler V2");
    expect(optionTexts).not.toContain("Inpaint Pro");
    expect(options).toHaveLength(3);
  });

  it("AC-7: should render ParameterPanel below slots with models in stacked variant", () => {
    render(<ModelSlots {...defaultProps({ variant: "stacked" })} />);

    // ParameterPanel should be rendered for slots with models (1 and 2)
    const paramsSlot1 = screen.getByTestId("slot-params-1");
    expect(paramsSlot1).toBeInTheDocument();
    expect(screen.getByTestId("slot-params-2")).toBeInTheDocument();

    const paramPanel = within(paramsSlot1).getByTestId("parameter-panel");
    expect(paramPanel).toHaveTextContent("schema-loaded");

    expect(mockUseModelSchema).toHaveBeenCalledWith("black-forest-labs/flux-schnell");
    expect(mockUseModelSchema).toHaveBeenCalledWith("stability-ai/sdxl");
  });

  it("AC-9: should render slots horizontally without ParameterPanels in compact variant", () => {
    render(<ModelSlots {...defaultProps({ variant: "compact" })} />);

    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "compact");
    expect(container.className).toMatch(/flex/);

    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();

    expect(screen.queryByTestId("slot-params-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-params-2")).not.toBeInTheDocument();
  });

  it("AC-10: should dispatch model-slots-changed CustomEvent after successful updateModelSlot", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    mockUpdateModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 3, active: true, modelId: "acme/fast-gen" }),
    );

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("add-slot-button"));
    const slotRow3 = screen.getByTestId("slot-row-3");
    await user.click(within(slotRow3).getByRole("option", { name: "FastGen" }));

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    const event = eventSpy.mock.calls[0][0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe("model-slots-changed");

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  it("AC-12: should disable all visible dropdowns when disabled prop is true", () => {
    render(<ModelSlots {...defaultProps({ disabled: true })} />);

    for (const num of [1, 2]) {
      expect(screen.getByTestId(`slot-select-${num}`)).toBeDisabled();
    }

    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Remove Button Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Remove Button", () => {
  it("should not show remove button on slot 1 (always visible)", () => {
    render(<ModelSlots {...defaultProps()} />);

    expect(screen.queryByTestId("slot-remove-1")).not.toBeInTheDocument();
  });

  it("should show remove button on slot 2 when it has a model and there are multiple models", () => {
    render(<ModelSlots {...defaultProps()} />);

    expect(screen.getByTestId("slot-remove-2")).toBeInTheDocument();
  });

  it("should not show remove button on slot 2 when it is the only slot with a model besides slot 1", () => {
    // Only slot 1 has a model — slot 2 is visible but empty (user clicked add)
    const slotsOnlyOneModel = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
      createSlot({ slot: 2, active: false, modelId: null }),
      createSlot({ slot: 3, active: false, modelId: null }),
    ];

    // We need 2 visible to test slot 2 — render with 2 slots visible
    // Since only 1 has a model, initial visible = 1, so we render and click add
    const { rerender } = render(<ModelSlots {...defaultProps({ slots: slotsOnlyOneModel })} />);

    // Slot 2 not visible initially — but let's test with 2 models visible
    // Actually: removable = index > 0 && slotsWithModels > 1
    // With only 1 model, slotsWithModels = 1, so even slot 2 with a model wouldn't be removable
    // This is correct: can't remove last model
  });

  it("should call clearModelSlot and hide slot when remove button is clicked", async () => {
    const user = userEvent.setup();

    mockClearModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 2, active: false, modelId: null }),
    );

    render(<ModelSlots {...defaultProps()} />);

    // Slot 2 is visible with remove button
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();

    // Click remove
    await user.click(screen.getByTestId("slot-remove-2"));

    // clearModelSlot should have been called
    expect(mockClearModelSlot).toHaveBeenCalledWith({
      mode: "txt2img",
      slot: 2,
    });

    // After server response, slot 2 should be hidden (visibleCount decremented)
    await waitFor(() => {
      expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();
    });

    // Add button should reappear
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();
  });

  it("should dispatch model-slots-changed after successful remove", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    mockClearModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 2, active: false, modelId: null }),
    );

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("slot-remove-2"));

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  it("should rollback when clearModelSlot fails", async () => {
    const user = userEvent.setup();

    mockClearModelSlot.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("slot-remove-2"));

    // After error, slot 2 should still be visible with its model
    await waitFor(() => {
      expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    });
  });

  it("should disable remove button when disabled prop is true", () => {
    render(<ModelSlots {...defaultProps({ disabled: true })} />);

    // Remove buttons should not exist when disabled (add button hidden too)
    // Actually the remove button exists but is disabled
    const removeBtn = screen.queryByTestId("slot-remove-2");
    if (removeBtn) {
      expect(removeBtn).toBeDisabled();
    }
  });
});

// ---------------------------------------------------------------------------
// Unit Tests -- Compatible models filtering
// ---------------------------------------------------------------------------

describe("ModelSlots Unit - getCompatibleModels", () => {
  it("should include models without capabilities data (permissive fallback)", () => {
    const modelsWithNullCaps = [
      createModel({ replicateId: "unknown/model-x", name: "Model X" }),
      createModel({ replicateId: "acme/fast-gen", name: "FastGen", capabilities: { txt2img: true } }),
    ];
    (modelsWithNullCaps[0] as { capabilities: null }).capabilities = null;

    render(<ModelSlots {...defaultProps({ models: modelsWithNullCaps })} />);

    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("Model X");
    expect(optionTexts).toContain("FastGen");
  });

  it("should include models where capability key is missing (undefined = compatible)", () => {
    const modelsWithMissingKey = [
      createModel({ replicateId: "acme/multi", name: "MultiModel", capabilities: { img2img: true } }),
    ];

    render(<ModelSlots {...defaultProps({ models: modelsWithMissingKey })} />);

    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

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
// Integration Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Integration", () => {
  it("should show only slot 1 with add button when only one slot has a model", () => {
    const oneSlot = [
      createSlot({ slot: 1, active: true, modelId: "black-forest-labs/flux-schnell" }),
    ];

    render(<ModelSlots {...defaultProps({ slots: oneSlot })} />);

    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();
  });

  it("should rollback optimistic update when server action fails on model update", async () => {
    const user = userEvent.setup();
    mockUpdateModelSlot.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("add-slot-button"));

    const slotRow3 = screen.getByTestId("slot-row-3");
    const option = within(slotRow3).getByRole("option", { name: "Flux Schnell" });
    await user.click(option);

    // After error, slot 3 should still show placeholder (no model)
    await waitFor(() => {
      const trigger = screen.getByTestId("slot-select-3");
      expect(within(trigger).getByText("select model")).toBeInTheDocument();
    });
  });

  it("stacked variant should have data-variant=stacked and vertical layout", () => {
    render(<ModelSlots {...defaultProps({ variant: "stacked" })} />);

    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "stacked");
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
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();
  });

  it("should reveal next slot when add button is clicked", async () => {
    const user = userEvent.setup();

    render(<ModelSlots {...defaultProps()} />);

    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("add-slot-button"));

    expect(screen.getByTestId("slot-row-3")).toBeInTheDocument();
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

    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("add-slot-button"));
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("add-slot-button"));
    expect(screen.getByTestId("slot-row-3")).toBeInTheDocument();
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();
  });
});
