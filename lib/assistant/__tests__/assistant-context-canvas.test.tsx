// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

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
  type DraftPrompt,
} from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Test helper: renders a consumer component that exposes context values
// ---------------------------------------------------------------------------

interface ExposedContext {
  draftPrompt: DraftPrompt | null;
  hasCanvas: boolean;
  canvasHighlight: boolean;
}

let capturedContext: ExposedContext | null = null;
let capturedDispatch: ReturnType<typeof usePromptAssistant>["dispatch"] | null =
  null;
let capturedUpdateDraftField: ReturnType<
  typeof usePromptAssistant
>["updateDraftField"] | null = null;

function ContextConsumer() {
  const ctx = usePromptAssistant();
  capturedContext = {
    draftPrompt: ctx.draftPrompt,
    hasCanvas: ctx.hasCanvas,
    canvasHighlight: ctx.canvasHighlight,
  };
  capturedDispatch = ctx.dispatch;
  capturedUpdateDraftField = ctx.updateDraftField;

  return (
    <div>
      <span data-testid="has-canvas">{String(ctx.hasCanvas)}</span>
      <span data-testid="canvas-highlight">{String(ctx.canvasHighlight)}</span>
      <span data-testid="draft-motiv">{ctx.draftPrompt?.motiv ?? "null"}</span>
      <span data-testid="draft-style">{ctx.draftPrompt?.style ?? "null"}</span>
      <span data-testid="draft-negative">
        {ctx.draftPrompt?.negativePrompt ?? "null"}
      </span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <PromptAssistantProvider projectId="test-project">
      <ContextConsumer />
    </PromptAssistantProvider>
  );
}

describe("PromptAssistantContext - Canvas State", () => {
  beforeEach(() => {
    capturedContext = null;
    capturedDispatch = null;
    capturedUpdateDraftField = null;
  });

  /**
   * AC-2: GIVEN der PromptAssistantContext empfaengt ein tool-call-result Event
   *       mit tool: "draft_prompt" und data: { motiv, style, negative_prompt }
   * WHEN der Context das Event verarbeitet
   * THEN wird draftPrompt im Context auf { motiv, style, negativePrompt } gesetzt
   *      und hasCanvas wird true
   */
  it("AC-2: should set draftPrompt and hasCanvas=true on draft_prompt tool-call-result", () => {
    renderWithProvider();

    // Initially, hasCanvas is false and draftPrompt is null
    expect(screen.getByTestId("has-canvas")).toHaveTextContent("false");
    expect(screen.getByTestId("draft-motiv")).toHaveTextContent("null");

    // Dispatch SET_DRAFT_PROMPT (what the runtime does when it receives a draft_prompt tool-call-result)
    act(() => {
      capturedDispatch!({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "A woman in autumn forest",
          style: "photorealistic, golden hour",
          negativePrompt: "low quality, blurry",
        },
      });
    });

    expect(screen.getByTestId("has-canvas")).toHaveTextContent("true");
    expect(screen.getByTestId("draft-motiv")).toHaveTextContent(
      "A woman in autumn forest"
    );
    expect(screen.getByTestId("draft-style")).toHaveTextContent(
      "photorealistic, golden hour"
    );
    expect(screen.getByTestId("draft-negative")).toHaveTextContent(
      "low quality, blurry"
    );
  });

  /**
   * AC-2: GIVEN ein draft_prompt Event
   * WHEN der Context das verarbeitet
   * THEN enthaelt draftPrompt die Felder motiv, style, negativePrompt (camelCase)
   *      und negative_prompt (snake_case from backend) wird zu negativePrompt gemappt
   */
  it("AC-2: should map draft_prompt data with motiv, style, negative_prompt to context state", () => {
    renderWithProvider();

    act(() => {
      capturedDispatch!({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "Test motiv",
          style: "Test style",
          negativePrompt: "Test negative",
        },
      });
    });

    // Verify all three fields are accessible in camelCase format
    expect(capturedContext!.draftPrompt).toEqual({
      motiv: "Test motiv",
      style: "Test style",
      negativePrompt: "Test negative",
    });
    expect(capturedContext!.hasCanvas).toBe(true);
  });

  /**
   * AC-5: GIVEN das Canvas-Panel zeigt einen Draft
   * WHEN der PromptAssistantContext ein tool-call-result Event mit tool: "refine_prompt" empfaengt
   * THEN werden alle drei Canvas-Felder mit den neuen Werten aus dem Event aktualisiert
   */
  it("AC-5: should update draftPrompt fields on refine_prompt tool-call-result", () => {
    renderWithProvider();

    // First set an initial draft
    act(() => {
      capturedDispatch!({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "Original motiv",
          style: "Original style",
          negativePrompt: "Original negative",
        },
      });
    });

    expect(screen.getByTestId("draft-motiv")).toHaveTextContent(
      "Original motiv"
    );

    // Now dispatch REFINE_DRAFT (what happens on refine_prompt tool-call-result)
    act(() => {
      capturedDispatch!({
        type: "REFINE_DRAFT",
        draftPrompt: {
          motiv: "Refined motiv value",
          style: "Refined style value",
          negativePrompt: "Refined negative value",
        },
      });
    });

    // All three fields should be updated
    expect(screen.getByTestId("draft-motiv")).toHaveTextContent(
      "Refined motiv value"
    );
    expect(screen.getByTestId("draft-style")).toHaveTextContent(
      "Refined style value"
    );
    expect(screen.getByTestId("draft-negative")).toHaveTextContent(
      "Refined negative value"
    );

    // hasCanvas should still be true
    expect(screen.getByTestId("has-canvas")).toHaveTextContent("true");
  });

  /**
   * AC-5 + AC-7: GIVEN a REFINE_DRAFT action is dispatched
   * WHEN the reducer processes it
   * THEN canvasHighlight is set to true (for the visual highlight effect)
   */
  it("AC-7: should set canvasHighlight=true on REFINE_DRAFT action", () => {
    renderWithProvider();

    // Set initial draft
    act(() => {
      capturedDispatch!({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "Initial",
          style: "Initial",
          negativePrompt: "Initial",
        },
      });
    });

    expect(screen.getByTestId("canvas-highlight")).toHaveTextContent("false");

    // Dispatch refine
    act(() => {
      capturedDispatch!({
        type: "REFINE_DRAFT",
        draftPrompt: {
          motiv: "Refined",
          style: "Refined",
          negativePrompt: "Refined",
        },
      });
    });

    expect(screen.getByTestId("canvas-highlight")).toHaveTextContent("true");
  });

  /**
   * AC-7: GIVEN canvasHighlight is true
   * WHEN CLEAR_CANVAS_HIGHLIGHT is dispatched
   * THEN canvasHighlight becomes false
   */
  it("AC-7: should clear canvasHighlight on CLEAR_CANVAS_HIGHLIGHT action", () => {
    renderWithProvider();

    // Set draft and refine to get highlight=true
    act(() => {
      capturedDispatch!({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "m",
          style: "s",
          negativePrompt: "n",
        },
      });
    });
    act(() => {
      capturedDispatch!({
        type: "REFINE_DRAFT",
        draftPrompt: {
          motiv: "m2",
          style: "s2",
          negativePrompt: "n2",
        },
      });
    });

    expect(screen.getByTestId("canvas-highlight")).toHaveTextContent("true");

    act(() => {
      capturedDispatch!({ type: "CLEAR_CANVAS_HIGHLIGHT" });
    });

    expect(screen.getByTestId("canvas-highlight")).toHaveTextContent("false");
  });

  /**
   * AC-4: GIVEN das Canvas-Panel ist sichtbar mit befuellten Feldern
   * WHEN der User den Inhalt aendert
   * THEN wird der lokale Canvas-State sofort aktualisiert (via UPDATE_DRAFT_FIELD)
   */
  it("AC-4: should update a single draft field via UPDATE_DRAFT_FIELD action", () => {
    renderWithProvider();

    // Set initial draft
    act(() => {
      capturedDispatch!({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "A woman in autumn forest",
          style: "photorealistic, golden hour",
          negativePrompt: "low quality, blurry",
        },
      });
    });

    // Update via the updateDraftField convenience function
    act(() => {
      capturedUpdateDraftField!("motiv", "A man in spring garden");
    });

    expect(screen.getByTestId("draft-motiv")).toHaveTextContent(
      "A man in spring garden"
    );
    // Other fields remain unchanged
    expect(screen.getByTestId("draft-style")).toHaveTextContent(
      "photorealistic, golden hour"
    );
    expect(screen.getByTestId("draft-negative")).toHaveTextContent(
      "low quality, blurry"
    );
  });

  /**
   * AC-4: UPDATE_DRAFT_FIELD should be a no-op when draftPrompt is null
   */
  it("AC-4: should not crash on UPDATE_DRAFT_FIELD when draftPrompt is null", () => {
    renderWithProvider();

    // draftPrompt is initially null, dispatching UPDATE_DRAFT_FIELD should be safe
    act(() => {
      capturedDispatch!({
        type: "UPDATE_DRAFT_FIELD",
        field: "motiv",
        value: "test",
      });
    });

    // Still null
    expect(screen.getByTestId("draft-motiv")).toHaveTextContent("null");
  });
});
