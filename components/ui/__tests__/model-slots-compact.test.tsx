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
// Mocking Strategy: mock_external
// ---------------------------------------------------------------------------

const mockUpdateModelSlot = vi.fn();
const mockClearModelSlot = vi.fn();

vi.mock("@/app/actions/model-slots", () => ({
  updateModelSlot: (...args: unknown[]) => mockUpdateModelSlot(...args),
  clearModelSlot: (...args: unknown[]) => mockClearModelSlot(...args),
}));

const mockUseModelSchema = vi.fn();

vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: (...args: unknown[]) => mockUseModelSchema(...args),
}));

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

  mockUpdateModelSlot.mockImplementation(
    async (input: { slot: number; modelId: string }) =>
      createSlot({ slot: input.slot, active: true, modelId: input.modelId }),
  );

  mockClearModelSlot.mockImplementation(
    async (input: { slot: number }) =>
      createSlot({ slot: input.slot, active: false, modelId: null }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Compact Variant Acceptance Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Compact Acceptance", () => {
  it("AC-1: should render slots with models in a horizontal row with add button", () => {
    render(<ModelSlots {...defaultProps()} />);

    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "compact");
    expect(container.className).toMatch(/flex/);
    expect(container.className).not.toMatch(/space-y/);

    expect(screen.getByTestId("slot-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("add-slot-button")).toBeInTheDocument();

    // No checkboxes
    expect(screen.queryByTestId("slot-checkbox-1")).not.toBeInTheDocument();
  });

  it("AC-2: should truncate model name in dropdown trigger", () => {
    render(<ModelSlots {...defaultProps()} />);

    const trigger = screen.getByTestId("slot-select-1");
    expect(trigger.className).toMatch(/max-w/);
    expect(trigger.className).toMatch(/text-xs/);
    expect(trigger.className).toContain("truncate");

    const slotRow1 = screen.getByTestId("slot-row-1");
    const options = within(slotRow1).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Flux Schnell");
    expect(optionTexts).toContain("SDXL");
    expect(optionTexts).toContain("FastGen");
  });

  it("AC-3: should not render any ParameterPanel in compact variant", () => {
    render(<ModelSlots {...defaultProps()} />);

    expect(screen.queryByTestId("slot-params-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-params-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

    for (const call of mockUseModelSchema.mock.calls) {
      expect(call[0]).toBeUndefined();
    }
  });

  it("AC-4: should show compact placeholder for empty revealed slot", async () => {
    const user = userEvent.setup();
    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("add-slot-button"));

    const selectTrigger3 = screen.getByTestId("slot-select-3");
    expect(within(selectTrigger3).getByText("--")).toBeInTheDocument();
  });

  it("AC-6: should show full model names and only mode-compatible models in dropdown", () => {
    render(<ModelSlots {...defaultProps()} />);

    const slotRow2 = screen.getByTestId("slot-row-2");
    const options = within(slotRow2).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("Flux Schnell");
    expect(optionTexts).toContain("SDXL");
    expect(optionTexts).toContain("FastGen");
    expect(optionTexts).not.toContain("Upscaler V2");
    expect(options).toHaveLength(3);
  });

  it("AC-7: should auto-activate and dispatch event on model selection", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("model-slots-changed", eventSpy);

    mockUpdateModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 3, active: true, modelId: "black-forest-labs/flux-schnell" }),
    );

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("add-slot-button"));

    const slotRow3 = screen.getByTestId("slot-row-3");
    await user.click(within(slotRow3).getByRole("option", { name: "Flux Schnell" }));

    expect(mockUpdateModelSlot).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "txt2img", slot: 3 }),
    );

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    window.removeEventListener("model-slots-changed", eventSpy);
  });

  it("AC-8: should disable all visible dropdowns and hide add button when disabled", () => {
    render(<ModelSlots {...defaultProps({ disabled: true })} />);

    for (const num of [1, 2]) {
      expect(screen.getByTestId(`slot-select-${num}`)).toBeDisabled();
    }

    expect(screen.queryByTestId("slot-row-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-slot-button")).not.toBeInTheDocument();

    const container = screen.getByTestId("model-slots");
    expect(container).toHaveAttribute("data-variant", "compact");
    expect(container.className).toMatch(/flex/);
  });
});

// ---------------------------------------------------------------------------
// Compact Unit Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Compact Unit", () => {
  it("should apply min-w-0 on slot rows in compact variant", () => {
    render(<ModelSlots {...defaultProps()} />);

    for (const num of [1, 2]) {
      const row = screen.getByTestId(`slot-row-${num}`);
      expect(row.className).toMatch(/min-w-0/);
    }
  });

  it("should use compact gap between slots", () => {
    render(<ModelSlots {...defaultProps()} />);

    const container = screen.getByTestId("model-slots");
    expect(container.className).toMatch(/gap-3/);
  });

  it("compact placeholder differs from stacked placeholder", async () => {
    const user = userEvent.setup();

    const { unmount } = render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("add-slot-button"));

    const compactTrigger = screen.getByTestId("slot-select-3");
    expect(within(compactTrigger).getByText("--")).toBeInTheDocument();

    unmount();

    render(<ModelSlots {...defaultProps({ variant: "stacked" })} />);
    await user.click(screen.getByTestId("add-slot-button"));

    const stackedTrigger = screen.getByTestId("slot-select-3");
    expect(within(stackedTrigger).getByText("select model")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Compact Remove Button Tests
// ---------------------------------------------------------------------------

describe("ModelSlots Compact Remove", () => {
  it("should show remove button on slot 2 in compact variant", () => {
    render(<ModelSlots {...defaultProps()} />);

    expect(screen.getByTestId("slot-remove-2")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-remove-1")).not.toBeInTheDocument();
  });

  it("should call clearModelSlot and hide slot when remove is clicked in compact", async () => {
    const user = userEvent.setup();

    mockClearModelSlot.mockResolvedValueOnce(
      createSlot({ slot: 2, active: false, modelId: null }),
    );

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("slot-remove-2"));

    expect(mockClearModelSlot).toHaveBeenCalledWith({
      mode: "txt2img",
      slot: 2,
    });

    await waitFor(() => {
      expect(screen.queryByTestId("slot-row-2")).not.toBeInTheDocument();
    });
  });

  it("should rollback when clearModelSlot fails in compact", async () => {
    const user = userEvent.setup();
    mockClearModelSlot.mockResolvedValueOnce({ error: "Server error" });

    render(<ModelSlots {...defaultProps()} />);

    await user.click(screen.getByTestId("slot-remove-2"));

    await waitFor(() => {
      expect(screen.getByTestId("slot-row-2")).toBeInTheDocument();
    });
  });
});
