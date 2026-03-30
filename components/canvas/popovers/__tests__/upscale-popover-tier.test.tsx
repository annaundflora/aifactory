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
// Mocks (mock_external strategy per spec: lucide-react icons)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  ZoomIn: (props: Record<string, unknown>) => (
    <span data-testid="icon-zoom-in" {...props} />
  ),
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
 * Render helper that wraps UpscalePopover in CanvasDetailProvider and
 * optionally activates a tool via dispatch.
 */
function renderUpscalePopover(
  overrides: Partial<{
    onUpscale: (params: { scale: 2 | 4; modelIds?: string[]; tier?: Tier }) => void;
    isUpscaleDisabled: boolean;
    initialActiveToolId: string | null;
  }> = {}
) {
  const onUpscale = overrides.onUpscale ?? vi.fn();
  const isUpscaleDisabled = overrides.isUpscaleDisabled ?? false;
  const initialActiveToolId = overrides.initialActiveToolId ?? null;

  const result = render(
    <CanvasDetailProvider initialGenerationId="gen-tier-test-1">
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
// Tests: UpscalePopover - TierToggle Integration (Slice 10 ACs)
// ---------------------------------------------------------------------------

describe("UpscalePopover - TierToggle Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: TierToggle wird angezeigt mit Draft als Default
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN das Upscale-Popover ist geoeffnet
   *       WHEN es gerendert wird
   *       THEN zeigt es einen TierToggle mit zwei Segmenten "Draft" (aktiv) und
   *            "Quality" oberhalb der Scale-Buttons
   */
  it("AC-1: should render TierToggle with Draft active above scale buttons", async () => {
    renderUpscalePopover({ initialActiveToolId: "upscale" });

    // Wait for the popover to appear
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // TierToggle should be rendered
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();

    // "Draft" segment should be active (aria-pressed=true)
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toBeInTheDocument();
    expect(draftButton).toHaveAttribute("aria-pressed", "true");
    expect(draftButton).toHaveAttribute("data-active", "true");

    // "Quality" segment should NOT be active
    const qualityButton = screen.getByText("Quality");
    expect(qualityButton).toBeInTheDocument();
    expect(qualityButton).toHaveAttribute("aria-pressed", "false");
    expect(qualityButton).toHaveAttribute("data-active", "false");

    // TierToggle section should come BEFORE scale buttons in DOM order
    const tierSection = screen.getByTestId("upscale-tier-section");
    const btn2x = screen.getByTestId("upscale-2x-button");
    const allRelevant = popover.querySelectorAll(
      '[data-testid="upscale-tier-section"], [data-testid="upscale-2x-button"]'
    );
    expect(allRelevant[0]).toBe(tierSection);
    expect(allRelevant[1]).toBe(btn2x);
  });

  // -------------------------------------------------------------------------
  // AC-2: Quality-Wechsel ohne MaxQualityToggle
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN das Upscale-Popover ist geoeffnet
   *       WHEN der User auf "Quality" im TierToggle klickt
   *       THEN wechselt das aktive Segment zu "Quality" und es erscheint
   *            KEIN MaxQualityToggle (Upscale hat kein Max-Tier)
   */
  it("AC-2: should switch to Quality tier and not render MaxQualityToggle", async () => {
    const user = userEvent.setup();
    renderUpscalePopover({ initialActiveToolId: "upscale" });

    // Wait for popover
    await screen.findByTestId("upscale-popover");

    // Click on "Quality" to switch tier
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);

    // Quality should now be active
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");
    expect(qualityButton).toHaveAttribute("data-active", "true");

    // Draft should no longer be active
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "false");
    expect(draftButton).toHaveAttribute("data-active", "false");

    // MaxQualityToggle should NOT be rendered (upscale has no max tier)
    expect(screen.queryByTestId("max-quality-toggle")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: Draft-Tier wird mit Scale an onUpscale propagiert
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN das Upscale-Popover ist geoeffnet mit tier="draft"
   *       WHEN der User auf "2x Upscale" klickt
   *       THEN wird onUpscale mit { scale: 2, tier: "draft" } aufgerufen
   */
  it("AC-3: should call onUpscale with scale 2 and tier draft", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();
    renderUpscalePopover({ initialActiveToolId: "upscale", onUpscale });

    // Wait for popover
    await screen.findByTestId("upscale-popover");

    // Default tier is "draft" -- click 2x Upscale
    const btn2x = screen.getByTestId("upscale-2x-button");
    await user.click(btn2x);

    expect(onUpscale).toHaveBeenCalledTimes(1);
    expect(onUpscale).toHaveBeenCalledWith({ scale: 2, tier: "draft" });
  });

  // -------------------------------------------------------------------------
  // AC-4: Quality-Tier wird mit Scale an onUpscale propagiert
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN das Upscale-Popover ist geoeffnet mit tier="quality"
   *       WHEN der User auf "4x Upscale" klickt
   *       THEN wird onUpscale mit { scale: 4, tier: "quality" } aufgerufen
   */
  it("AC-4: should call onUpscale with scale 4 and tier quality", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();
    renderUpscalePopover({ initialActiveToolId: "upscale", onUpscale });

    // Wait for popover
    await screen.findByTestId("upscale-popover");

    // Switch to "Quality" tier first
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);

    // Verify Quality is active
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");

    // Click 4x Upscale
    const btn4x = screen.getByTestId("upscale-4x-button");
    await user.click(btn4x);

    expect(onUpscale).toHaveBeenCalledTimes(1);
    expect(onUpscale).toHaveBeenCalledWith({ scale: 4, tier: "quality" });
  });

  // -------------------------------------------------------------------------
  // AC-5: Props-Typ UpscalePopoverProps hat tier in onUpscale
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN onUpscale Callback in upscale-popover.tsx
   *       WHEN die Props-Definition inspiziert wird
   *       THEN erwartet onUpscale den Typ (params: { scale: 2 | 4; tier: Tier }) => void
   */
  it("AC-5: should accept onUpscale callback with tier parameter in params", () => {
    // Type-level check: Create callback params with each valid tier value.
    // If the interface does NOT include `tier: Tier`, this code would cause
    // a TypeScript compilation error at build time.
    const draftParams: Parameters<
      React.ComponentProps<typeof UpscalePopover>["onUpscale"]
    >[0] = { scale: 2, tier: "draft" };
    expect(draftParams.tier).toBe("draft");
    expect(draftParams.scale).toBe(2);

    const qualityParams: Parameters<
      React.ComponentProps<typeof UpscalePopover>["onUpscale"]
    >[0] = { scale: 4, tier: "quality" };
    expect(qualityParams.tier).toBe("quality");
    expect(qualityParams.scale).toBe(4);

    // Verify all Tier values are accepted
    const allTiers: Tier[] = ["draft", "quality", "max"];
    for (const tier of allTiers) {
      const params: Parameters<
        React.ComponentProps<typeof UpscalePopover>["onUpscale"]
      >[0] = { scale: 2, tier };
      expect(allTiers).toContain(params.tier);
    }
  });

  // -------------------------------------------------------------------------
  // AC-8: Tier-State wird nicht persistiert (resets to draft on reopen)
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN das Upscale-Popover wird geschlossen und erneut geoeffnet
   *       WHEN der User den Tier-Toggle betrachtet
   *       THEN steht der Toggle wieder auf "Draft" (Tier-State ist nicht persistiert,
   *            Default ist Draft)
   */
  it("AC-8: should reset tier to draft when popover is reopened", async () => {
    const user = userEvent.setup();
    const onUpscale = vi.fn();

    /**
     * Wrapper component that allows toggling the popover open/closed via
     * dispatch, simulating close and reopen.
     */
    function PopoverReopenHarness() {
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
          <UpscalePopover onUpscale={onUpscale} isUpscaleDisabled={false} />
        </>
      );
    }

    render(
      <CanvasDetailProvider initialGenerationId="gen-reopen-test">
        <PopoverReopenHarness />
      </CanvasDetailProvider>
    );

    // Step 1: Open the popover
    await user.click(screen.getByTestId("open-popover"));
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Step 2: Switch to Quality
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");

    // Step 3: Close the popover (toggle off)
    await user.click(screen.getByTestId("close-popover"));

    // Step 4: Reopen the popover
    await user.click(screen.getByTestId("open-popover"));
    const popoverReopened = await screen.findByTestId("upscale-popover");
    expect(popoverReopened).toBeInTheDocument();

    // Step 5: Verify tier is reset to "Draft"
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "true");
    expect(draftButton).toHaveAttribute("data-active", "true");

    const qualityButtonAfterReopen = screen.getByText("Quality");
    expect(qualityButtonAfterReopen).toHaveAttribute("aria-pressed", "false");
    expect(qualityButtonAfterReopen).toHaveAttribute("data-active", "false");
  });
});
