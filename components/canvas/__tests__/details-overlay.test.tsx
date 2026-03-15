// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock lucide-react icons used by DetailsOverlay
vi.mock("lucide-react", () => ({
  ChevronUp: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-up" {...props} />
  ),
  ChevronRight: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-right" {...props} />
  ),
}));

// Mock ProvenanceRow — it fetches data via server action (external dependency).
// We verify that it receives the correct generationId prop.
const mockProvenanceRow = vi.fn();
vi.mock("@/components/lightbox/provenance-row", () => ({
  ProvenanceRow: (props: Record<string, unknown>) => {
    mockProvenanceRow(props);
    return <div data-testid="provenance-row-mock">ProvenanceRow({String(props.generationId)})</div>;
  },
}));

// Import AFTER mocks
import { DetailsOverlay } from "@/components/canvas/details-overlay";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";
import React from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  const defaults: Generation = {
    id: "gen-overlay-1",
    projectId: "project-1",
    prompt: "a default test prompt",
    negativePrompt: null,
    modelId: "black-forest-labs/flux-2-max",
    modelParams: {},
    status: "completed",
    imageUrl: "https://example.com/image.png",
    replicatePredictionId: null,
    errorMessage: null,
    width: 1024,
    height: 1024,
    seed: null,
    createdAt: new Date("2025-06-15T12:00:00Z"),
    promptMotiv: "",
    promptStyle: "",
    isFavorite: false,
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    batchId: null,
  };
  // Spread overrides so explicit null values are preserved (unlike ??)
  return { ...defaults, ...overrides };
}

/**
 * Helper component that sets activeToolId to "details" on mount
 * by dispatching SET_ACTIVE_TOOL, simulating the toolbar toggle.
 */
function ActivateDetailsHelper() {
  const { dispatch } = useCanvasDetail();
  React.useEffect(() => {
    dispatch({ type: "SET_ACTIVE_TOOL", toolId: "details" });
  }, [dispatch]);
  return null;
}

/**
 * Render the DetailsOverlay in expanded state (activeToolId === "details").
 */
function renderExpanded(generation?: Generation) {
  const gen = generation ?? makeGeneration();
  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={gen.id}>
        <ActivateDetailsHelper />
        <DetailsOverlay generation={gen} />
      </CanvasDetailProvider>
    ),
    generation: gen,
  };
}

/**
 * Render the DetailsOverlay in collapsed state (activeToolId === null, default).
 */
function renderCollapsed(generation?: Generation) {
  const gen = generation ?? makeGeneration();
  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={gen.id}>
        <DetailsOverlay generation={gen} />
      </CanvasDetailProvider>
    ),
    generation: gen,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Acceptance Tests
// ---------------------------------------------------------------------------

describe("DetailsOverlay", () => {
  /**
   * AC-1: GIVEN `activeToolId` ist `"details"` im CanvasDetailContext
   *       WHEN das DetailsOverlay gerendert wird
   *       THEN ist das Panel sichtbar (expanded) und der Canvas-Bereich
   *            darunter wird nach unten verschoben
   */
  it('AC-1: should render expanded panel when activeToolId is "details"', () => {
    renderExpanded();

    const overlay = screen.getByTestId("details-overlay");
    expect(overlay).toBeInTheDocument();

    // Panel is expanded: aria-expanded = true
    expect(overlay).toHaveAttribute("aria-expanded", "true");

    // maxHeight should NOT be "0px" when expanded
    expect(overlay.style.maxHeight).not.toBe("0px");

    // Content should be visible — the "Details" heading should be present
    expect(screen.getByText("Details")).toBeInTheDocument();

    // The overlay is in normal document flow (no absolute/fixed positioning)
    // which means it pushes content below. We verify it uses overflow-hidden
    // in a block-flow element (div), not absolute/fixed.
    expect(overlay.tagName).toBe("DIV");
    expect(overlay.className).toContain("overflow-hidden");
  });

  /**
   * AC-2: GIVEN `activeToolId` ist `null` oder ein anderer Wert als `"details"`
   *       WHEN das DetailsOverlay gerendert wird
   *       THEN ist das Panel eingeklappt (collapsed, height 0) und der
   *            Canvas-Bereich nutzt die volle Hoehe
   */
  it('AC-2: should render collapsed panel when activeToolId is not "details"', () => {
    renderCollapsed();

    const overlay = screen.getByTestId("details-overlay");
    expect(overlay).toBeInTheDocument();

    // Panel is collapsed: aria-expanded = false
    expect(overlay).toHaveAttribute("aria-expanded", "false");

    // maxHeight is "0px" when collapsed
    expect(overlay.style.maxHeight).toBe("0px");
  });

  /**
   * AC-3: GIVEN das Overlay ist expanded und die Generation hat
   *       `prompt: "A beautiful sunset over mountains with golden light"`
   *       WHEN das Panel gerendert wird
   *       THEN zeigt es den vollstaendigen Prompt-Text (nicht gekuerzt)
   */
  it("AC-3: should display full prompt text without truncation", () => {
    const longPrompt = "A beautiful sunset over mountains with golden light";
    const gen = makeGeneration({ prompt: longPrompt });
    renderExpanded(gen);

    const promptEl = screen.getByTestId("details-prompt");
    expect(promptEl).toBeInTheDocument();
    expect(promptEl).toHaveTextContent(longPrompt);

    // Verify the full text is present, not truncated with ellipsis
    expect(promptEl.textContent).toBe(longPrompt);
  });

  /**
   * AC-4: GIVEN das Overlay ist expanded und die Generation hat
   *       `modelId: "flux-2-max"`, `steps: 30`, `cfgScale: 7.0`,
   *       `seed: 42`, `width: 1024`, `height: 1024`
   *       WHEN das Panel gerendert wird
   *       THEN zeigt es alle Parameter: Model-Name, Steps, CFG, Seed,
   *            Size als "1024x1024"
   */
  it('AC-4: should display model name, steps, CFG, seed, and size as "WIDTHxHEIGHT"', () => {
    const gen = makeGeneration({
      modelId: "flux-2-max",
      modelParams: {
        num_inference_steps: 30,
        guidance_scale: 7.0,
      },
      seed: 42,
      width: 1024,
      height: 1024,
    });
    renderExpanded(gen);

    // Model name — "flux-2-max" becomes "Flux 2 Max" via modelIdToDisplayName
    const modelEl = screen.getByTestId("details-model");
    expect(modelEl).toBeInTheDocument();
    expect(modelEl).toHaveTextContent("Flux 2 Max");

    // Steps
    const stepsEl = screen.getByTestId("details-steps");
    expect(stepsEl).toBeInTheDocument();
    expect(stepsEl).toHaveTextContent("30");

    // CFG
    const cfgEl = screen.getByTestId("details-cfg");
    expect(cfgEl).toBeInTheDocument();
    expect(cfgEl).toHaveTextContent("7");

    // Seed
    const seedEl = screen.getByTestId("details-seed");
    expect(seedEl).toBeInTheDocument();
    expect(seedEl).toHaveTextContent("42");

    // Size
    const sizeEl = screen.getByTestId("details-size");
    expect(sizeEl).toBeInTheDocument();
    expect(sizeEl).toHaveTextContent("1024x1024");
  });

  /**
   * AC-5: GIVEN das Overlay ist expanded und die Generation hat
   *       Referenz-Inputs (Provenance-Daten)
   *       WHEN das Panel gerendert wird
   *       THEN rendert es die bestehende `ProvenanceRow`-Komponente
   *            mit der `generationId` der aktuellen Generation
   */
  it("AC-5: should render ProvenanceRow component with current generation id", () => {
    const gen = makeGeneration({
      id: "gen-img2img-1",
      generationMode: "img2img",
    });
    renderExpanded(gen);

    // The provenance section should be rendered
    const provenanceSection = screen.getByTestId("details-provenance-section");
    expect(provenanceSection).toBeInTheDocument();

    // The mocked ProvenanceRow should have been called with the correct generationId
    expect(mockProvenanceRow).toHaveBeenCalledWith(
      expect.objectContaining({ generationId: "gen-img2img-1" })
    );

    // The mock content should be in the DOM
    expect(screen.getByTestId("provenance-row-mock")).toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN das Overlay ist expanded und die Generation hat KEINE
   *       Referenz-Inputs (reine txt2img)
   *       WHEN das Panel gerendert wird
   *       THEN wird die Provenance-Section nicht angezeigt (kein leerer Bereich)
   */
  it("AC-6: should not render provenance section when generation has no reference inputs", () => {
    const gen = makeGeneration({
      generationMode: "txt2img",
    });
    renderExpanded(gen);

    // The provenance section should NOT be in the DOM
    expect(screen.queryByTestId("details-provenance-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("provenance-row-mock")).not.toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN das Overlay ist expanded
   *       WHEN der User auf den "Hide"-Button im Overlay-Header klickt
   *       THEN wird `activeToolId` auf `null` gesetzt und das Panel klappt ein
   */
  it("AC-7: should dispatch SET_ACTIVE_TOOL toggle when Hide button is clicked, collapsing the panel", async () => {
    const user = userEvent.setup();
    renderExpanded();

    const overlay = screen.getByTestId("details-overlay");

    // Panel starts expanded
    expect(overlay).toHaveAttribute("aria-expanded", "true");

    // Click the Hide button
    const hideButton = screen.getByTestId("details-hide-button");
    expect(hideButton).toBeInTheDocument();
    await user.click(hideButton);

    // After clicking Hide, the panel should collapse.
    // The component dispatches SET_ACTIVE_TOOL with "details" which toggles
    // activeToolId from "details" to null (toggle behavior in reducer).
    expect(overlay).toHaveAttribute("aria-expanded", "false");
    expect(overlay.style.maxHeight).toBe("0px");
  });

  /**
   * AC-8: GIVEN das Overlay wechselt zwischen collapsed und expanded
   *       WHEN die Transition stattfindet
   *       THEN animiert das Panel sanft (CSS transition auf height/max-height,
   *            kein abrupter Sprung)
   */
  it("AC-8: should have CSS transition classes for smooth expand/collapse animation", () => {
    renderCollapsed();

    const overlay = screen.getByTestId("details-overlay");

    // Verify the transition-related CSS classes are present
    expect(overlay.className).toContain("transition-[max-height]");
    expect(overlay.className).toContain("duration-300");
    expect(overlay.className).toContain("ease-in-out");

    // Also verify overflow-hidden is set (required for max-height animation)
    expect(overlay.className).toContain("overflow-hidden");
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — extractParams logic via rendered output
// ---------------------------------------------------------------------------

describe("DetailsOverlay - parameter extraction", () => {
  /**
   * Unit test: Verify that alternative param key names (steps, guidance,
   * cfg_scale) are correctly extracted from modelParams JSONB.
   */
  it("should extract steps from alternative key 'steps' when 'num_inference_steps' is absent", () => {
    const gen = makeGeneration({
      modelParams: { steps: 25 },
    });
    renderExpanded(gen);

    const stepsEl = screen.getByTestId("details-steps");
    expect(stepsEl).toHaveTextContent("25");
  });

  it("should extract cfgScale from alternative key 'guidance' when 'guidance_scale' is absent", () => {
    const gen = makeGeneration({
      modelParams: { guidance: 5.5 },
    });
    renderExpanded(gen);

    const cfgEl = screen.getByTestId("details-cfg");
    expect(cfgEl).toHaveTextContent("5.5");
  });

  it("should extract cfgScale from 'cfg_scale' as third fallback", () => {
    const gen = makeGeneration({
      modelParams: { cfg_scale: 8.0 },
    });
    renderExpanded(gen);

    const cfgEl = screen.getByTestId("details-cfg");
    expect(cfgEl).toHaveTextContent("8");
  });

  it("should not render steps or CFG when modelParams is empty", () => {
    const gen = makeGeneration({
      modelParams: {},
    });
    renderExpanded(gen);

    expect(screen.queryByTestId("details-steps")).not.toBeInTheDocument();
    expect(screen.queryByTestId("details-cfg")).not.toBeInTheDocument();
  });

  it("should not render seed when seed is null", () => {
    const gen = makeGeneration({ seed: null });
    renderExpanded(gen);

    expect(screen.queryByTestId("details-seed")).not.toBeInTheDocument();
  });

  it("should not render size when width or height is null", () => {
    const gen = makeGeneration({ width: null, height: null });
    renderExpanded(gen);

    expect(screen.queryByTestId("details-size")).not.toBeInTheDocument();
  });

  it("should prefer num_inference_steps over steps when both are present", () => {
    const gen = makeGeneration({
      modelParams: { num_inference_steps: 50, steps: 25 },
    });
    renderExpanded(gen);

    const stepsEl = screen.getByTestId("details-steps");
    expect(stepsEl).toHaveTextContent("50");
  });

  it("should prefer guidance_scale over guidance and cfg_scale when all are present", () => {
    const gen = makeGeneration({
      modelParams: { guidance_scale: 3.0, guidance: 5.0, cfg_scale: 8.0 },
    });
    renderExpanded(gen);

    const cfgEl = screen.getByTestId("details-cfg");
    expect(cfgEl).toHaveTextContent("3");
  });
});

// ---------------------------------------------------------------------------
// Integration Tests — DetailsOverlay + CanvasDetailContext interaction
// ---------------------------------------------------------------------------

describe("DetailsOverlay - context integration", () => {
  it("should use aria-label 'Generation details' for accessibility", () => {
    renderExpanded();

    const overlay = screen.getByTestId("details-overlay");
    expect(overlay).toHaveAttribute("aria-label", "Generation details");
    expect(overlay).toHaveAttribute("role", "region");
  });

  it("should render model display name from modelId with vendor prefix stripped", () => {
    const gen = makeGeneration({
      modelId: "black-forest-labs/flux-1.1-pro",
    });
    renderExpanded(gen);

    const modelEl = screen.getByTestId("details-model");
    // "black-forest-labs/flux-1.1-pro" -> last segment "flux-1.1-pro"
    // -> replace hyphens -> "flux 1.1 pro" -> title case -> "Flux 1.1 Pro"
    expect(modelEl).toHaveTextContent("Flux 1.1 Pro");
  });

  it("should show Prompt heading label", () => {
    renderExpanded();

    expect(screen.getByText("Prompt")).toBeInTheDocument();
  });
});
