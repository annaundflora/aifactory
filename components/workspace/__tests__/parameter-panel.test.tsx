// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI needs ResizeObserver + pointer events)
// ---------------------------------------------------------------------------

beforeAll(() => {
  // ResizeObserver polyfill for Radix Slider
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // Radix Select needs pointer events
  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  // Radix Select needs scrollIntoView
  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
});

// ---------------------------------------------------------------------------
// Mocks (lucide-react icons used by shadcn Select component)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="chevron-down-icon" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="chevron-up-icon" {...props} />
  ),
  CheckIcon: (props: Record<string, unknown>) => (
    <span data-testid="check-icon" {...props} />
  ),
}));

import {
  ParameterPanel,
  type SchemaProperties,
} from "@/components/workspace/parameter-panel";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const schemaWithMixedProperties: SchemaProperties = {
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16"],
    default: "1:1",
    title: "Aspect Ratio",
  },
  num_inference_steps: {
    type: "integer",
    minimum: 1,
    maximum: 50,
    default: 28,
    title: "Num Inference Steps",
  },
  guidance_scale: {
    type: "number",
    minimum: 0,
    maximum: 20,
    default: 3.5,
    title: "Guidance Scale",
  },
};

const schemaWithExcluded: SchemaProperties = {
  prompt: { type: "string" },
  negative_prompt: { type: "string" },
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9"],
    default: "1:1",
    title: "Aspect Ratio",
  },
};

const updatedSchema: SchemaProperties = {
  style: {
    type: "string",
    enum: ["photorealistic", "anime", "oil-painting"],
    default: "photorealistic",
    title: "Style",
  },
  strength: {
    type: "number",
    minimum: 0,
    maximum: 1,
    default: 0.5,
    title: "Strength",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ParameterPanel", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-3: GIVEN das Parameter-Panel laedt ein neues Schema
   * WHEN die API noch nicht geantwortet hat
   * THEN zeigt das Panel Skeleton-Platzhalter an (Loading-State)
   */
  it("AC-3: should show skeleton placeholders while schema is loading", () => {
    render(
      <ParameterPanel
        schema={null}
        isLoading={true}
        values={{}}
        onChange={mockOnChange}
      />
    );

    // Loading skeleton container should be present
    const loadingPanel = screen.getByTestId("parameter-panel-loading");
    expect(loadingPanel).toBeInTheDocument();

    // Should have skeleton placeholder elements (3 skeleton groups)
    const skeletons = loadingPanel.querySelectorAll("[data-slot='skeleton']");
    // Each group has 2 skeletons (label + control), so 6 total
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * AC-4: GIVEN ein Model-Schema mit Properties aspect_ratio (enum), num_inference_steps (integer), guidance_scale (number)
   * WHEN das Parameter-Panel gerendert wird
   * THEN wird fuer enum-Properties ein Dropdown/Select, fuer integer/number-Properties ein Slider mit Min/Max/Default gerendert
   */
  it("AC-4: should render select for enum properties and input for integer/number properties with min/max/default", () => {
    render(
      <ParameterPanel
        schema={schemaWithMixedProperties}
        isLoading={false}
        values={{}}
        onChange={mockOnChange}
      />
    );

    const panel = screen.getByTestId("parameter-panel");
    expect(panel).toBeInTheDocument();

    // Enum property: aspect_ratio should have a label
    expect(screen.getByText("Aspect Ratio")).toBeInTheDocument();
    // The select trigger should exist for aspect_ratio
    const aspectSelect = document.getElementById("param-aspect_ratio");
    expect(aspectSelect).toBeInTheDocument();

    // Integer property: num_inference_steps should have an Input
    expect(screen.getByText("Num Inference Steps")).toBeInTheDocument();
    const stepsInput = document.getElementById("param-num_inference_steps") as HTMLInputElement;
    expect(stepsInput).toBeInTheDocument();
    expect(stepsInput.type).toBe("number");
    expect(stepsInput.value).toBe("28");

    // Number property: guidance_scale should have an Input
    expect(screen.getByText("Guidance Scale")).toBeInTheDocument();
    const guidanceInput = document.getElementById("param-guidance_scale") as HTMLInputElement;
    expect(guidanceInput).toBeInTheDocument();
    expect(guidanceInput.type).toBe("number");
    expect(guidanceInput.value).toBe("3.5");
  });

  /**
   * AC-4 additional: prompt and negative_prompt should be excluded from parameter panel
   */
  it("AC-4: should exclude prompt and negative_prompt properties from the panel", () => {
    render(
      <ParameterPanel
        schema={schemaWithExcluded}
        isLoading={false}
        values={{}}
        onChange={mockOnChange}
      />
    );

    // prompt and negative_prompt should NOT be rendered as controls
    // They are string-type without enum, so they are excluded by isSupportedType AND EXCLUDED_KEYS
    expect(screen.queryByText("Prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("Negative Prompt")).not.toBeInTheDocument();

    // aspect_ratio should still be rendered
    expect(screen.getByText("Aspect Ratio")).toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN ein Modell ist ausgewaehlt und das Schema aendert sich
   * WHEN das Parameter-Panel mit einem neuen Schema gerendert wird
   * THEN werden die Controls entsprechend dem neuen Schema aktualisiert
   */
  it("AC-2: should re-render controls when model schema changes", () => {
    const { rerender } = render(
      <ParameterPanel
        schema={schemaWithMixedProperties}
        isLoading={false}
        values={{}}
        onChange={mockOnChange}
      />
    );

    // Initial schema should show aspect_ratio, num_inference_steps, guidance_scale
    expect(screen.getByText("Aspect Ratio")).toBeInTheDocument();
    expect(screen.getByText("Num Inference Steps")).toBeInTheDocument();
    expect(screen.getByText("Guidance Scale")).toBeInTheDocument();

    // Re-render with updated schema
    rerender(
      <ParameterPanel
        schema={updatedSchema}
        isLoading={false}
        values={{}}
        onChange={mockOnChange}
      />
    );

    // Previous properties should be gone
    expect(screen.queryByText("Aspect Ratio")).not.toBeInTheDocument();
    expect(screen.queryByText("Num Inference Steps")).not.toBeInTheDocument();
    expect(screen.queryByText("Guidance Scale")).not.toBeInTheDocument();

    // New properties should be rendered
    expect(screen.getByText("Style")).toBeInTheDocument();
    expect(screen.getByText("Strength")).toBeInTheDocument();
  });

  /**
   * AC-4 interaction: enum select change triggers onChange callback
   */
  it("AC-4: should call onChange when an enum select value is changed", async () => {
    const user = userEvent.setup();

    render(
      <ParameterPanel
        schema={schemaWithMixedProperties}
        isLoading={false}
        values={{}}
        onChange={mockOnChange}
      />
    );

    // Click the aspect ratio select trigger
    const aspectSelect = document.getElementById(
      "param-aspect_ratio"
    ) as HTMLElement;
    await user.click(aspectSelect);

    // Select 16:9
    const option = await screen.findByText("16:9");
    await user.click(option);

    // onChange should be called with updated values
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ aspect_ratio: "16:9" })
    );
  });
});
