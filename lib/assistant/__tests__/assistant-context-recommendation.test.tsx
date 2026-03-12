// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock workspace-state to avoid needing WorkspaceStateProvider wrapper
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
}));

import {
  PromptAssistantProvider,
  usePromptAssistant,
  type PromptAssistantContextValue,
  type AssistantAction,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Helper: Component that consumes and exposes context values
// ---------------------------------------------------------------------------

function ContextConsumer({
  onValue,
}: {
  onValue: (value: PromptAssistantContextValue) => void;
}) {
  const ctx = usePromptAssistant();
  onValue(ctx);

  return (
    <div>
      <span data-testid="recommended-model">
        {ctx.recommendedModel ? JSON.stringify(ctx.recommendedModel) : "null"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Component that dispatches actions and exposes context
// ---------------------------------------------------------------------------

function ContextDispatcher({
  onValue,
  onDispatch,
}: {
  onValue: (value: PromptAssistantContextValue) => void;
  onDispatch: (dispatch: (action: AssistantAction) => void) => void;
}) {
  const ctx = usePromptAssistant();
  onValue(ctx);
  onDispatch(ctx.dispatch);

  return (
    <div>
      <span data-testid="recommended-model">
        {ctx.recommendedModel ? JSON.stringify(ctx.recommendedModel) : "null"}
      </span>
    </div>
  );
}

describe("PromptAssistantContext - Recommendation State", () => {
  // ---------------------------------------------------------------------------
  // AC-2: recommend_model Event setzt recommendedModel
  // ---------------------------------------------------------------------------
  it("AC-2: should set recommendedModel on SET_RECOMMENDED_MODEL action", () => {
    /**
     * AC-2: GIVEN der PromptAssistantContext empfaengt ein tool-call-result Event
     *            mit tool: "recommend_model" und data: { id: "black-forest-labs/flux-1.1-pro",
     *            name: "Flux Pro 1.1", reason: "Ideal fuer fotorealistische Portraits" }
     *       WHEN der Context das Event verarbeitet
     *       THEN wird recommendedModel im Context auf { id, name, reason } gesetzt
     */
    let latestValue: PromptAssistantContextValue | null = null;
    let latestDispatch: ((action: AssistantAction) => void) | null = null;

    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher
          onValue={(v) => {
            latestValue = v;
          }}
          onDispatch={(d) => {
            latestDispatch = d;
          }}
        />
      </PromptAssistantProvider>
    );

    // Initially recommendedModel should be null
    expect(latestValue!.recommendedModel).toBeNull();

    // Dispatch SET_RECOMMENDED_MODEL (this is what the SSE event handler does
    // when it receives a recommend_model tool-call-result)
    act(() => {
      latestDispatch!({
        type: "SET_RECOMMENDED_MODEL",
        recommendedModel: {
          id: "black-forest-labs/flux-1.1-pro",
          name: "Flux Pro 1.1",
          reason: "Ideal fuer fotorealistische Portraits",
        },
      });
    });

    expect(latestValue!.recommendedModel).toEqual({
      id: "black-forest-labs/flux-1.1-pro",
      name: "Flux Pro 1.1",
      reason: "Ideal fuer fotorealistische Portraits",
    });
    expect(screen.getByTestId("recommended-model")).toHaveTextContent(
      "Flux Pro 1.1"
    );
  });

  // ---------------------------------------------------------------------------
  // AC-5: Neues recommend_model Event ueberschreibt vorherigen Wert
  // ---------------------------------------------------------------------------
  it("AC-5: should replace existing recommendedModel on new SET_RECOMMENDED_MODEL action", () => {
    /**
     * AC-5: GIVEN der Agent sendet ein neues recommend_model Event mit
     *            { id: "stability-ai/sdxl", name: "SDXL", reason: "Stark bei kuenstlerischen Illustrationen" }
     *       WHEN das Canvas bereits eine vorherige Empfehlung anzeigt
     *       THEN wird die Badge aktualisiert und zeigt "SDXL" mit der neuen Begruendung
     */
    let latestValue: PromptAssistantContextValue | null = null;
    let latestDispatch: ((action: AssistantAction) => void) | null = null;

    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher
          onValue={(v) => {
            latestValue = v;
          }}
          onDispatch={(d) => {
            latestDispatch = d;
          }}
        />
      </PromptAssistantProvider>
    );

    // Set first recommendation
    act(() => {
      latestDispatch!({
        type: "SET_RECOMMENDED_MODEL",
        recommendedModel: {
          id: "black-forest-labs/flux-1.1-pro",
          name: "Flux Pro 1.1",
          reason: "Ideal fuer fotorealistische Portraits",
        },
      });
    });

    expect(latestValue!.recommendedModel!.name).toBe("Flux Pro 1.1");

    // Set new recommendation (should replace the previous one)
    act(() => {
      latestDispatch!({
        type: "SET_RECOMMENDED_MODEL",
        recommendedModel: {
          id: "stability-ai/sdxl",
          name: "SDXL",
          reason: "Stark bei kuenstlerischen Illustrationen",
        },
      });
    });

    expect(latestValue!.recommendedModel).toEqual({
      id: "stability-ai/sdxl",
      name: "SDXL",
      reason: "Stark bei kuenstlerischen Illustrationen",
    });
    expect(screen.getByTestId("recommended-model")).toHaveTextContent("SDXL");
    // Previous recommendation should be completely gone
    expect(screen.getByTestId("recommended-model")).not.toHaveTextContent(
      "Flux Pro 1.1"
    );
  });
});
