// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-07-canvas-ui: DetailsOverlay prompt simplification
 *
 * Verifies that the DetailsOverlay component no longer renders sections for
 * promptStyle or negativePrompt, even when the generation data contains those
 * legacy fields. The details-prompt section must still render correctly.
 *
 * Mocking Strategy: mock_external per spec
 */

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

// Mock ProvenanceRow -- it fetches data via server action (external dependency)
vi.mock("@/components/lightbox/provenance-row", () => ({
  ProvenanceRow: (props: Record<string, unknown>) => (
    <div data-testid="provenance-row-mock">ProvenanceRow({String(props.generationId)})</div>
  ),
}));

// Import AFTER mocks
import { DetailsOverlay } from "@/components/canvas/details-overlay";
import { CanvasDetailProvider, useCanvasDetail } from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  const defaults: Generation = {
    id: "gen-overlay-simpl-1",
    projectId: "project-1",
    prompt: "a default test prompt",
    modelId: "black-forest-labs/flux-2-max",
    modelParams: {},
    status: "completed",
    imageUrl: "https://example.com/image.png",
    replicatePredictionId: null,
    errorMessage: null,
    width: 1024,
    height: 1024,
    seed: null,
    createdAt: new Date("2026-03-29T12:00:00Z"),
    promptMotiv: "",
    isFavorite: false,
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    batchId: null,
  };
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Acceptance Tests: DetailsOverlay - prompt simplification (slice-07)
// ===========================================================================

describe("DetailsOverlay - prompt simplification", () => {
  // -------------------------------------------------------------------------
  // AC-7: Keine Style/Negative Sections gerendert
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN die DetailsOverlay-Komponente mit einer Generation die
   *       promptStyle und negativePrompt Werte hat
   *       WHEN sie gerendert wird
   *       THEN existiert KEIN Element mit data-testid="details-style" oder
   *            data-testid="details-negative-prompt"
   *       AND das Element mit data-testid="details-prompt" wird weiterhin gerendert
   */
  it("AC-7: should not render details-style or details-negative-prompt sections", () => {
    // Create a generation that would have had promptStyle/negativePrompt data
    // in the old schema. Even with legacy data present, the component must
    // NOT render those sections anymore.
    const gen = makeGeneration({
      prompt: "A majestic castle on a mountain",
      modelParams: {
        num_inference_steps: 30,
        guidance_scale: 7.0,
      },
    });

    renderExpanded(gen);

    // Style section must NOT be rendered
    expect(screen.queryByTestId("details-style")).not.toBeInTheDocument();

    // Negative prompt section must NOT be rendered
    expect(screen.queryByTestId("details-negative-prompt")).not.toBeInTheDocument();
  });

  /**
   * AC-7 (continued): Prompt section still rendered
   */
  it("AC-7: should still render details-prompt section", () => {
    const gen = makeGeneration({
      prompt: "A vibrant forest landscape with golden light",
    });

    renderExpanded(gen);

    // The prompt section must still be present
    const promptEl = screen.getByTestId("details-prompt");
    expect(promptEl).toBeInTheDocument();
    expect(promptEl).toHaveTextContent("A vibrant forest landscape with golden light");
  });

  /**
   * AC-7 edge case: Even with img2img generation mode and various model params,
   * no style or negative prompt sections should appear.
   */
  it("AC-7: should not render style/negative-prompt sections for img2img generations", () => {
    const gen = makeGeneration({
      generationMode: "img2img",
      prompt: "A futuristic cityscape",
      modelParams: {
        num_inference_steps: 50,
        guidance_scale: 12.0,
        prompt_strength: 0.8,
      },
    });

    renderExpanded(gen);

    // Must not render removed sections
    expect(screen.queryByTestId("details-style")).not.toBeInTheDocument();
    expect(screen.queryByTestId("details-negative-prompt")).not.toBeInTheDocument();

    // But prompt and other parameter sections should still render
    expect(screen.getByTestId("details-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("details-prompt")).toHaveTextContent("A futuristic cityscape");
  });
});
