// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix uses ResizeObserver / DOMRect internally)
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
// Imports (after polyfills)
// ---------------------------------------------------------------------------

import { UpscalePopover } from "@/components/canvas/popovers/upscale-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inner component that dispatches SET_ACTIVE_TOOL on mount to simulate
 * the toolbar having activated a specific tool.
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
 * Render helper that wraps UpscalePopover in CanvasDetailProvider and
 * optionally activates a tool via dispatch.
 */
function renderUpscalePopover(
  overrides: Partial<{
    onUpscale: (params: { scale: 2 | 4; tier: import("@/lib/types").Tier }) => void;
    isUpscaleDisabled: boolean;
    initialActiveToolId: string | null;
  }> = {}
) {
  const onUpscale = overrides.onUpscale ?? vi.fn();
  const isUpscaleDisabled = overrides.isUpscaleDisabled ?? false;
  const initialActiveToolId = overrides.initialActiveToolId ?? null;

  const result = render(
    <CanvasDetailProvider initialGenerationId="gen-test-123">
      <ToolActivator toolId={initialActiveToolId}>
        <UpscalePopover
          onUpscale={onUpscale}
          isUpscaleDisabled={isUpscaleDisabled}
        />
      </ToolActivator>
    </CanvasDetailProvider>
  );

  return { ...result, onUpscale };
}

// ---------------------------------------------------------------------------
// Tests: UpscalePopover Acceptance
// ---------------------------------------------------------------------------

describe("UpscalePopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: Popover sichtbar mit Titel und zwei Buttons
  // -------------------------------------------------------------------------
  it('AC-1: GIVEN activeToolId is "upscale" WHEN the popover renders THEN it is visible with title "Upscale" and two buttons "2x Upscale" and "4x Upscale"', async () => {
    renderUpscalePopover({ initialActiveToolId: "upscale" });

    // The popover content should be rendered
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Title
    expect(within(popover).getByText("Upscale")).toBeInTheDocument();

    // Two buttons
    const btn2x = within(popover).getByTestId("upscale-2x-button");
    const btn4x = within(popover).getByTestId("upscale-4x-button");
    expect(btn2x).toBeInTheDocument();
    expect(btn2x).toHaveTextContent("2x Upscale");
    expect(btn4x).toBeInTheDocument();
    expect(btn4x).toHaveTextContent("4x Upscale");
  });

  // -------------------------------------------------------------------------
  // AC-2: 2x-Button ruft Callback mit scale 2 auf und schliesst Popover
  // -------------------------------------------------------------------------
  it('AC-2: GIVEN the upscale popover is visible WHEN the user clicks "2x Upscale" THEN onUpscale is called with { scale: 2 } and the popover closes', async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();
    renderUpscalePopover({ initialActiveToolId: "upscale", onUpscale });

    const btn2x = await screen.findByTestId("upscale-2x-button");

    // Click the 2x button
    await user.click(btn2x);

    // Callback should have been called with scale: 2
    expect(onUpscale).toHaveBeenCalledTimes(1);
    expect(onUpscale).toHaveBeenCalledWith({ scale: 2, tier: "draft" });

    // Popover should close (content removed from DOM)
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: 4x-Button ruft Callback mit scale 4 auf und schliesst Popover
  // -------------------------------------------------------------------------
  it('AC-3: GIVEN the upscale popover is visible WHEN the user clicks "4x Upscale" THEN onUpscale is called with { scale: 4 } and the popover closes', async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();
    renderUpscalePopover({ initialActiveToolId: "upscale", onUpscale });

    const btn4x = await screen.findByTestId("upscale-4x-button");

    // Click the 4x button
    await user.click(btn4x);

    // Callback should have been called with scale: 4
    expect(onUpscale).toHaveBeenCalledTimes(1);
    expect(onUpscale).toHaveBeenCalledWith({ scale: 4, tier: "draft" });

    // Popover should close (content removed from DOM)
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-4: Klick ausserhalb schliesst Popover
  // -------------------------------------------------------------------------
  it("AC-4: GIVEN the upscale popover is visible WHEN the user clicks outside the popover THEN it closes", async () => {
    const user = userEvent.setup();
    renderUpscalePopover({ initialActiveToolId: "upscale" });

    // Wait for popover to appear
    await screen.findByTestId("upscale-popover");

    // Click outside the popover (on the body/document)
    await user.click(document.body);

    // Popover should close
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-5: Popover unsichtbar wenn nicht aktiv
  // -------------------------------------------------------------------------
  it('AC-5: GIVEN activeToolId is not "upscale" WHEN the component renders THEN the popover content is not in the DOM', () => {
    // Default: activeToolId is null
    renderUpscalePopover({ initialActiveToolId: null });

    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  it('AC-5b: GIVEN activeToolId is "variation" WHEN the component renders THEN the popover content is not in the DOM', () => {
    // activeToolId is "variation", not "upscale"
    renderUpscalePopover({ initialActiveToolId: "variation" });

    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-6: Disabled-Icon mit Tooltip bei zu grossem Bild
  // -------------------------------------------------------------------------
  it('AC-6: GIVEN isUpscaleDisabled is true WHEN the toolbar renders THEN the upscale icon is visually disabled, not clickable, and shows tooltip "Image too large for upscale" on hover', async () => {
    const user = userEvent.setup();
    renderUpscalePopover({ isUpscaleDisabled: true });

    // Disabled icon should be in DOM
    const disabledIcon = screen.getByTestId("upscale-icon-disabled");
    expect(disabledIcon).toBeInTheDocument();
    expect(disabledIcon).toHaveAttribute("aria-disabled", "true");
    expect(disabledIcon.className).toMatch(/pointer-events-none/);
    expect(disabledIcon.className).toMatch(/opacity-50/);

    // Hover on the tooltip trigger (the wrapping span, since the button has pointer-events-none)
    const trigger = screen.getByTestId("upscale-disabled-trigger");
    await user.hover(trigger);

    // Tooltip should appear with the correct text.
    // Radix renders the text in both the visible tooltip and an accessibility
    // span (role="tooltip"), so we use findByRole to target the semantic one.
    const tooltip = await screen.findByRole("tooltip", {
      name: "Image too large for upscale",
    });
    expect(tooltip).toBeInTheDocument();

    // Popover should NOT be rendered
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-7: Klick auf Disabled-Icon hat keine Wirkung
  // -------------------------------------------------------------------------
  it("AC-7: GIVEN isUpscaleDisabled is true WHEN the user clicks the upscale icon THEN nothing happens (popover does not open)", async () => {
    const user = userEvent.setup();
    renderUpscalePopover({ isUpscaleDisabled: true });

    // The disabled icon is rendered, but has pointer-events-none
    const trigger = screen.getByTestId("upscale-disabled-trigger");

    // Click on the wrapping trigger
    await user.click(trigger);

    // Popover should NOT appear
    expect(screen.queryByTestId("upscale-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-8: Normaler Klick bei nicht-disabled
  // -------------------------------------------------------------------------
  it("AC-8: GIVEN isUpscaleDisabled is false WHEN the user activates the upscale tool THEN the popover opens normally with no tooltip and no disabled state", async () => {
    renderUpscalePopover({
      isUpscaleDisabled: false,
      initialActiveToolId: "upscale",
    });

    // Popover should be visible
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // No disabled icon should be present
    expect(
      screen.queryByTestId("upscale-icon-disabled")
    ).not.toBeInTheDocument();

    // No tooltip text for disabled state
    expect(
      screen.queryByText("Image too large for upscale")
    ).not.toBeInTheDocument();
  });
});
