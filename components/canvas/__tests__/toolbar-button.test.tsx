// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Tooltip uses ResizeObserver internally)
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

// Import AFTER mocks
import { ToolbarButton } from "@/components/canvas/toolbar-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A simple mock icon component that satisfies the LucideIcon interface.
 * We do not mock the lucide-react module because ToolbarButton only imports
 * the LucideIcon TYPE from it — the actual icon is passed as a prop.
 */
const MockIcon: LucideIcon = ((props: Record<string, unknown>) => (
  <svg data-testid="mock-icon" {...props} />
)) as unknown as LucideIcon;
MockIcon.displayName = "MockIcon";

/**
 * ToolbarButton requires a TooltipProvider ancestor (from Radix).
 * We wrap each render in TooltipProvider to avoid context errors.
 */
function renderButton(
  overrides: Partial<{
    isActive: boolean;
    disabled: boolean;
    onClick: () => void;
    tooltip: string;
  }> = {}
) {
  const onClick = overrides.onClick ?? vi.fn();

  return {
    ...render(
      <TooltipProvider>
        <ToolbarButton
          icon={MockIcon}
          isActive={overrides.isActive ?? false}
          disabled={overrides.disabled ?? false}
          onClick={onClick}
          tooltip={overrides.tooltip ?? "Test Tool"}
          data-testid="toolbar-test"
        />
      </TooltipProvider>
    ),
    onClick,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToolbarButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Basis: GIVEN ToolbarButton is rendered with default props
   *        WHEN it appears in the DOM
   *        THEN it renders the icon, has the correct aria-label,
   *             and responds to click events
   */
  it("should render icon and be clickable in default state", async () => {
    const user = userEvent.setup();
    const { onClick } = renderButton({ tooltip: "Variation" });

    const button = screen.getByTestId("toolbar-test");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("aria-label", "Variation");
    expect(button).toHaveAttribute("aria-pressed", "false");

    // Icon should be rendered inside the button
    expect(screen.getByTestId("mock-icon")).toBeInTheDocument();

    // Click should trigger onClick
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-2: GIVEN ToolbarButton is rendered with isActive=true
   *       WHEN it appears in the DOM
   *       THEN it has active styling (bg-accent) and aria-pressed="true"
   *            so it is visually distinguishable from inactive buttons
   */
  it("AC-2: should render with active styling when isActive is true", () => {
    renderButton({ isActive: true });

    const button = screen.getByTestId("toolbar-test");

    // aria-pressed indicates active state
    expect(button).toHaveAttribute("aria-pressed", "true");

    // Active styling: bg-accent and text-accent-foreground
    expect(button.className).toMatch(/bg-accent/);
    expect(button.className).toMatch(/text-accent-foreground/);
  });

  /**
   * AC-9: GIVEN ToolbarButton is rendered with disabled=true
   *       WHEN the user attempts to click it
   *       THEN it is visually disabled (opacity-50, pointer-events-none),
   *            has aria-disabled="true", and does NOT respond to clicks
   */
  it("AC-9: should render as disabled and not respond to clicks when disabled is true", async () => {
    const user = userEvent.setup();
    const { onClick } = renderButton({ disabled: true });

    const button = screen.getByTestId("toolbar-test");

    // aria-disabled attribute
    expect(button).toHaveAttribute("aria-disabled", "true");

    // Disabled styling
    expect(button.className).toMatch(/pointer-events-none/);
    expect(button.className).toMatch(/opacity-50/);

    // Click should NOT trigger onClick — pointer-events-none prevents it,
    // but we also verify via the handler guard
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
