// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks — Radix UI primitives use portals/ARIA that jsdom cannot handle.
// We mock only the UI shell components, NOT the component-under-test logic.
// ---------------------------------------------------------------------------

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-down" {...props} />
  ),
}));

// Mock shadcn Collapsible — render as a real open/close div
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
    ...props
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    [key: string]: unknown;
  }) => (
    <div data-mock="collapsible" data-open={open} {...props}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(
          child as React.ReactElement<Record<string, unknown>>,
          { _collapsibleOpen: open, _onOpenChange: onOpenChange }
        );
      })}
    </div>
  ),
  CollapsibleTrigger: ({
    children,
    asChild,
    _collapsibleOpen,
    _onOpenChange,
    ...props
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    _collapsibleOpen?: boolean;
    _onOpenChange?: (open: boolean) => void;
    [key: string]: unknown;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        {
          onClick: () => _onOpenChange?.(!_collapsibleOpen),
          ...props,
        }
      );
    }
    return (
      <button
        type="button"
        onClick={() => _onOpenChange?.(!_collapsibleOpen)}
        {...props}
      >
        {children}
      </button>
    );
  },
  CollapsibleContent: ({
    children,
    _collapsibleOpen,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onOpenChange,
    ...props
  }: {
    children: React.ReactNode;
    _collapsibleOpen?: boolean;
    _onOpenChange?: (open: boolean) => void;
    [key: string]: unknown;
  }) => {
    if (!_collapsibleOpen) return null;
    return (
      <div data-slot="collapsible-content" {...props}>
        {children}
      </div>
    );
  },
}));

// Mock shadcn Select — render as testable DOM elements
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-mock="select" data-value={value} data-testid="select-root">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(
          child as React.ReactElement<Record<string, unknown>>,
          { _selectValue: value, _onValueChange: onValueChange }
        );
      })}
    </div>
  ),
  SelectTrigger: ({
    children,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _selectValue,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onValueChange,
    ...props
  }: {
    children: React.ReactNode;
    _selectValue?: string;
    _onValueChange?: (v: string) => void;
    [key: string]: unknown;
  }) => (
    <button type="button" data-slot="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: () => <span data-slot="select-value" />,
  SelectContent: ({
    children,
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-slot="select-content">{children}</div>
  ),
  SelectGroup: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-slot="select-group" {...props}>
      {children}
    </div>
  ),
  SelectItem: ({
    children,
    value,
    ...props
  }: {
    children: React.ReactNode;
    value: string;
    [key: string]: unknown;
  }) => (
    <div data-slot="select-item" data-value={value} {...props}>
      {children}
    </div>
  ),
  SelectSeparator: (props: Record<string, unknown>) => (
    <hr data-slot="select-separator" {...props} />
  ),
}));

// Mock shadcn Input
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-slot="input" {...props} />
  ),
}));

// Mock shadcn Label
vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <label data-slot="label" {...props}>
      {children}
    </label>
  ),
}));

// Mock shadcn Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: Record<string, unknown>) => (
    <div data-slot="skeleton" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { ParameterPanel, type SchemaProperties } from "./parameter-panel";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const defaultOnChange = vi.fn();

function renderPanel(
  schema: SchemaProperties | null,
  overrides?: {
    isLoading?: boolean;
    values?: Record<string, unknown>;
    onChange?: (values: Record<string, unknown>) => void;
    primaryFields?: string[];
  }
) {
  return render(
    <ParameterPanel
      schema={schema}
      isLoading={overrides?.isLoading ?? false}
      values={overrides?.values ?? {}}
      onChange={overrides?.onChange ?? defaultOnChange}
      primaryFields={overrides?.primaryFields}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ParameterPanel - Primary/Advanced Split", () => {
  /**
   * AC-1: GIVEN ein Schema mit den Properties `aspect_ratio` (enum), `megapixels` (enum),
   *       `quality` (enum) und `prompt` (string)
   * WHEN `ParameterPanel` mit `primaryFields={["aspect_ratio", "megapixels", "resolution"]}` gerendert wird
   * THEN sind `aspect_ratio` und `megapixels` im Primary-Bereich sichtbar (ausserhalb des Collapsible),
   *      `quality` ist NICHT sichtbar (Advanced ist eingeklappt), und `prompt` ist NICHT gerendert (INTERNAL_FIELDS)
   */
  it("AC-1: should render primary fields visibly and hide advanced fields when collapsed", () => {
    const schema: SchemaProperties = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16"],
      },
      megapixels: {
        type: "string",
        enum: ["0.25", "1"],
      },
      quality: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      prompt: {
        type: "string",
      },
    };

    renderPanel(schema, {
      primaryFields: ["aspect_ratio", "megapixels", "resolution"],
    });

    // Primary section exists and contains aspect_ratio and megapixels
    const primarySection = screen.getByTestId("parameter-panel-primary");
    expect(primarySection).toBeInTheDocument();
    expect(within(primarySection).getByText("Aspect Ratio")).toBeInTheDocument();
    expect(within(primarySection).getByText("Megapixels")).toBeInTheDocument();

    // Advanced toggle exists (quality goes to advanced)
    const advancedToggle = screen.getByTestId("parameter-panel-advanced-toggle");
    expect(advancedToggle).toBeInTheDocument();

    // Quality is NOT visible because advanced is collapsed by default
    expect(screen.queryByText("Quality")).not.toBeInTheDocument();

    // prompt is INTERNAL_FIELDS — not rendered anywhere
    expect(screen.queryByText("Prompt")).not.toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN `ParameterPanel` zeigt den Advanced-Toggle-Button
   * WHEN der User auf den Advanced-Toggle klickt
   * THEN wird der Advanced-Bereich sichtbar und zeigt die Advanced-Fields (z.B. `quality`)
   */
  it("AC-2: should show advanced fields after clicking the advanced toggle", async () => {
    const user = userEvent.setup();

    const schema: SchemaProperties = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9"],
      },
      quality: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
    };

    renderPanel(schema, {
      primaryFields: ["aspect_ratio", "megapixels", "resolution"],
    });

    // Before click: quality is not visible
    expect(screen.queryByText("Quality")).not.toBeInTheDocument();

    // Click the advanced toggle
    const advancedToggle = screen.getByTestId("parameter-panel-advanced-toggle");
    await user.click(advancedToggle);

    // After click: quality is now visible
    expect(screen.getByText("Quality")).toBeInTheDocument();
  });

  /**
   * AC-3: GIVEN ein Schema mit den Properties `prompt`, `negative_prompt`, `image`,
   *       `image_input`, `seed`, `num_outputs`, `openai_api_key`, `mask`, `prompt_strength`, `strength`
   * WHEN `ParameterPanel` gerendert wird
   * THEN wird KEINES dieser Fields gerendert (weder Primary noch Advanced) — alle sind in INTERNAL_FIELDS
   */
  it("AC-3: should not render any INTERNAL_FIELDS properties", () => {
    const schema: SchemaProperties = {
      prompt: { type: "string" },
      negative_prompt: { type: "string" },
      image: { type: "string" },
      seed: { type: "integer", minimum: 0, maximum: 999999 },
      num_outputs: { type: "integer", minimum: 1, maximum: 4 },
      mask: { type: "string" },
      prompt_strength: { type: "number", minimum: 0, maximum: 1 },
      strength: { type: "number", minimum: 0, maximum: 1 },
    };

    const { container } = renderPanel(schema);

    // The component should return null when all fields are internal
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel-primary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel-advanced")).not.toBeInTheDocument();

    // Double-check: none of these labels should appear
    const internalFieldLabels = [
      "Prompt",
      "Negative Prompt",
      "Image",
      "Seed",
      "Num Outputs",
      "Mask",
      "Prompt Strength",
      "Strength",
    ];
    for (const label of internalFieldLabels) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }

    // Container should be empty (component returns null)
    expect(container.firstChild).toBeNull();
  });

  /**
   * AC-4: GIVEN ein Schema mit `description` (`type: "string"`, kein enum),
   *       `disable_safety` (`type: "boolean"`), `input_images` (`type: "array"`, kein enum)
   * WHEN `ParameterPanel` gerendert wird
   * THEN werden diese drei Fields NICHT gerendert — Type-Filter schliesst
   *      `string` ohne enum, `boolean` und `array` ohne enum aus
   */
  it("AC-4: should not render string-without-enum, boolean, or array-without-enum properties", () => {
    const schema: SchemaProperties = {
      description: { type: "string" },
      disable_safety: { type: "boolean" },
      input_images: { type: "array" },
    };

    const { container } = renderPanel(schema);

    // Component returns null when no visible fields
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    expect(screen.queryByText("Disable Safety")).not.toBeInTheDocument();
    expect(screen.queryByText("Input Images")).not.toBeInTheDocument();

    expect(container.firstChild).toBeNull();
  });

  /**
   * AC-5: GIVEN ein Schema mit `aspect_ratio` (enum mit 14 Werten:
   *       `1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1`)
   * WHEN das `aspect_ratio`-Select-Dropdown geoeffnet wird
   * THEN erscheinen zuerst die Common-Werte (`1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3`),
   *      dann ein visueller Separator, dann die restlichen Werte
   */
  it("AC-5: should show separator between common and extreme aspect ratio values when >8 options", () => {
    const allRatios = [
      "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4",
      "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1",
    ];

    const schema: SchemaProperties = {
      aspect_ratio: {
        type: "string",
        enum: allRatios,
      },
    };

    renderPanel(schema, {
      primaryFields: ["aspect_ratio"],
    });

    // The separator should be present (data-slot="select-separator")
    const separator = document.querySelector('[data-slot="select-separator"]');
    expect(separator).not.toBeNull();

    // Two groups should exist (data-slot="select-group")
    const groups = document.querySelectorAll('[data-slot="select-group"]');
    expect(groups.length).toBe(2);

    // First group: common ratios (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3)
    const commonGroup = groups[0];
    const commonItems = within(commonGroup as HTMLElement).getAllByText(/.+/);
    const commonValues = commonItems.map((el) => el.textContent);
    const expectedCommon = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
    // All expected common values should be in the first group
    for (const val of expectedCommon) {
      expect(commonValues).toContain(val);
    }

    // Second group: extreme/uncommon ratios
    const extremeGroup = groups[1];
    const extremeItems = within(extremeGroup as HTMLElement).getAllByText(/.+/);
    const extremeValues = extremeItems.map((el) => el.textContent);
    const expectedExtreme = ["4:5", "5:4", "21:9", "1:4", "4:1", "1:8", "8:1"];
    for (const val of expectedExtreme) {
      expect(extremeValues).toContain(val);
    }

    // Separator is between the two groups in DOM order
    const selectContent = document.querySelector('[data-slot="select-content"]');
    const children = Array.from(selectContent!.children);
    const group1Index = children.indexOf(groups[0] as Element);
    const separatorIndex = children.indexOf(separator as Element);
    const group2Index = children.indexOf(groups[1] as Element);
    expect(group1Index).toBeLessThan(separatorIndex);
    expect(separatorIndex).toBeLessThan(group2Index);
  });

  /**
   * AC-6: GIVEN ein Schema mit `aspect_ratio` (enum mit 3 Werten: `1:1, 3:2, 2:3`)
   * WHEN das `aspect_ratio`-Select-Dropdown geoeffnet wird
   * THEN werden alle Werte ohne Separator angezeigt (Gruppierung nur bei >8 Werten)
   */
  it("AC-6: should show all aspect ratio values without separator when <=8 options", () => {
    const schema: SchemaProperties = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "3:2", "2:3"],
      },
    };

    renderPanel(schema, {
      primaryFields: ["aspect_ratio"],
    });

    // No separator should be rendered
    const separator = document.querySelector('[data-slot="select-separator"]');
    expect(separator).toBeNull();

    // No groups should be rendered (items are rendered flat)
    const groups = document.querySelectorAll('[data-slot="select-group"]');
    expect(groups.length).toBe(0);

    // All three values should be present as flat select items
    const items = document.querySelectorAll('[data-slot="select-item"]');
    expect(items.length).toBe(3);
    const itemValues = Array.from(items).map((item) => item.getAttribute("data-value"));
    expect(itemValues).toContain("1:1");
    expect(itemValues).toContain("3:2");
    expect(itemValues).toContain("2:3");
  });

  /**
   * AC-7: GIVEN ein Schema mit NUR `quality` (enum) und `output_format` (enum) — keine Primary-Fields
   * WHEN `ParameterPanel` mit `primaryFields={["aspect_ratio", "megapixels", "resolution"]}` gerendert wird
   * THEN ist der Primary-Bereich leer, aber Advanced-Toggle und Advanced-Bereich existieren
   *
   * Note: output_format is in INTERNAL_FIELDS, so only quality ends up in advanced.
   */
  it("AC-7: should show empty primary area and advanced toggle when schema has no primary fields", () => {
    const schema: SchemaProperties = {
      quality: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      style: {
        type: "string",
        enum: ["natural", "vivid"],
      },
    };

    renderPanel(schema, {
      primaryFields: ["aspect_ratio", "megapixels", "resolution"],
    });

    // Primary section should NOT be rendered (no matching primary fields)
    expect(screen.queryByTestId("parameter-panel-primary")).not.toBeInTheDocument();

    // Advanced toggle should exist
    const advancedToggle = screen.getByTestId("parameter-panel-advanced-toggle");
    expect(advancedToggle).toBeInTheDocument();

    // Advanced section exists in DOM
    const advancedSection = screen.getByTestId("parameter-panel-advanced");
    expect(advancedSection).toBeInTheDocument();
  });

  /**
   * AC-8: GIVEN ein Schema mit NUR `aspect_ratio` (enum) — keine Advanced-Fields nach Filterung
   * WHEN `ParameterPanel` gerendert wird
   * THEN wird der Advanced-Toggle NICHT angezeigt
   */
  it("AC-8: should hide advanced toggle when schema has no advanced fields", () => {
    const schema: SchemaProperties = {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16"],
      },
    };

    renderPanel(schema, {
      primaryFields: ["aspect_ratio", "megapixels", "resolution"],
    });

    // Primary section with aspect_ratio should be visible
    const primarySection = screen.getByTestId("parameter-panel-primary");
    expect(primarySection).toBeInTheDocument();
    expect(within(primarySection).getByText("Aspect Ratio")).toBeInTheDocument();

    // Advanced toggle should NOT exist
    expect(screen.queryByTestId("parameter-panel-advanced-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel-advanced")).not.toBeInTheDocument();
  });
});
