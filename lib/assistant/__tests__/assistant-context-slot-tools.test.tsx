// @vitest-environment jsdom
/**
 * Tests for Slice 24: Reducer-Actions ``SET_SLOT_ROLE``,
 * ``SET_SLOT_STRENGTH``, ``SET_MODEL_PARAMS_PATCH`` plus the auto-apply
 * ``useEffect`` for ``pendingModelParamsPatch`` in ``assistant-context.tsx``.
 *
 * Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria of
 * ``slice-24-slot-tool-frontend-handler.md``:
 *
 * - AC-4: SET_SLOT_ROLE updates pendingSlotRolePatch with incremented version
 * - AC-5: SET_SLOT_STRENGTH updates pendingSlotStrengthPatch with version bump
 * - AC-6: SET_MODEL_PARAMS_PATCH triggers setVariation({ modelParams }) WITHOUT
 *         touching promptMotiv / promptStyle / negativePrompt
 * - AC-9: Initial state has pendingSlotRolePatch === null,
 *         pendingSlotStrengthPatch === null, no setVariation call before the
 *         first tool-result
 * - AC-10: RESET_SESSION clears pendingSlotRolePatch + pendingSlotStrengthPatch
 *         (and pendingModelParamsPatch); existing reducer branches are
 *         preserved
 *
 * Mocking Strategy: ``mock_external`` per slice spec — workspace-state
 * (``useWorkspaceVariation``) and sonner are mocked because they pull in
 * side-effects unrelated to the reducer/effect under test. Pattern follows
 * ``assistant-context-apply.test.tsx`` and ``assistant-context-flow-state.test.tsx``.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createElement, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Mocks (must be declared before the import of the context module)
// ---------------------------------------------------------------------------

const mockSetVariation = vi.fn();
const mockClearVariation = vi.fn();
let mockVariationData: Record<string, unknown> | null = null;

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: mockClearVariation,
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

// Import AFTER mocks are set up.
import {
  PromptAssistantProvider,
  usePromptAssistant,
} from "@/lib/assistant/assistant-context";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PromptAssistantProvider, null, children);
}

// ---------------------------------------------------------------------------
// AC-4: SET_SLOT_ROLE updates pendingSlotRolePatch with incremented version
// ---------------------------------------------------------------------------

describe("Slice 24: assistantReducer - SET_SLOT_ROLE (AC-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  /**
   * AC-4: GIVEN der Reducer empfaengt SET_SLOT_ROLE mit
   *       { slotIndex: 0, role: "subject" }
   *       WHEN die Action verarbeitet wird
   *       THEN state.pendingSlotRolePatch enthaelt
   *       { slotIndex: 0, role: "subject", version: <inkrementiert> }.
   *       Der version-Counter dient als Trigger fuer den PromptArea-Subscriber;
   *       zwei aufeinanderfolgende identische Payloads triggern zwei
   *       distinkte Patches.
   */
  it("AC-4: should set pendingSlotRolePatch with incremented version on SET_SLOT_ROLE", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Initially null.
    expect(result.current.pendingSlotRolePatch).toBeNull();

    // First dispatch -> version 1.
    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_ROLE",
        slotIndex: 0,
        role: "subject",
      });
    });

    expect(result.current.pendingSlotRolePatch).toEqual({
      slotIndex: 0,
      role: "subject",
      version: 1,
    });
  });

  it("AC-4: two identical payloads trigger two distinct version increments", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_ROLE",
        slotIndex: 2,
        role: "style",
      });
    });
    const v1 = result.current.pendingSlotRolePatch?.version;

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_ROLE",
        slotIndex: 2,
        role: "style",
      });
    });
    const v2 = result.current.pendingSlotRolePatch?.version;

    expect(v1).toBe(1);
    expect(v2).toBe(2);
    // Payload remains identical apart from version.
    expect(result.current.pendingSlotRolePatch).toEqual({
      slotIndex: 2,
      role: "style",
      version: 2,
    });
  });

  it("AC-4: SET_SLOT_ROLE does NOT touch pendingSlotStrengthPatch", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_ROLE",
        slotIndex: 1,
        role: "composition",
      });
    });

    expect(result.current.pendingSlotStrengthPatch).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-5: SET_SLOT_STRENGTH updates pendingSlotStrengthPatch with version bump
// ---------------------------------------------------------------------------

describe("Slice 24: assistantReducer - SET_SLOT_STRENGTH (AC-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  /**
   * AC-5: GIVEN der Reducer empfaengt SET_SLOT_STRENGTH mit
   *       { slotIndex: 3, strength: 0.5 }
   *       WHEN die Action verarbeitet wird
   *       THEN state.pendingSlotStrengthPatch enthaelt
   *       { slotIndex: 3, strength: 0.5, version: <inkrementiert> }.
   */
  it("AC-5: should set pendingSlotStrengthPatch with incremented version on SET_SLOT_STRENGTH", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    expect(result.current.pendingSlotStrengthPatch).toBeNull();

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_STRENGTH",
        slotIndex: 3,
        strength: 0.5,
      });
    });

    expect(result.current.pendingSlotStrengthPatch).toEqual({
      slotIndex: 3,
      strength: 0.5,
      version: 1,
    });
  });

  it("AC-5: successive SET_SLOT_STRENGTH actions bump the version monotonically", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_STRENGTH",
        slotIndex: 0,
        strength: 0.25,
      });
    });
    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_STRENGTH",
        slotIndex: 0,
        strength: 0.75,
      });
    });
    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_STRENGTH",
        slotIndex: 1,
        strength: 0.75,
      });
    });

    expect(result.current.pendingSlotStrengthPatch).toEqual({
      slotIndex: 1,
      strength: 0.75,
      version: 3,
    });
  });

  it("AC-5: SET_SLOT_STRENGTH does NOT touch pendingSlotRolePatch", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_STRENGTH",
        slotIndex: 1,
        strength: 0.4,
      });
    });

    expect(result.current.pendingSlotRolePatch).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-6: SET_MODEL_PARAMS_PATCH -> setVariation({ modelParams }) without
//       touching promptMotiv / promptStyle / negativePrompt
// ---------------------------------------------------------------------------

describe("Slice 24: auto-apply effect - SET_MODEL_PARAMS_PATCH (AC-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  /**
   * AC-6: GIVEN der Reducer empfaengt SET_MODEL_PARAMS_PATCH mit
   *       { modelParams: { aspect_ratio: "1:1" } }
   *       WHEN die Action verarbeitet wird
   *       THEN der existierende auto-apply-Effekt im AssistantProvider ruft
   *       setVariation({ modelParams: { aspect_ratio: "1:1" } }) mit GENAU
   *       diesen Keys; promptMotiv, promptStyle, negativePrompt werden NICHT
   *       mit gepatcht. Verhalten konsistent mit AC-2-Test in
   *       assistant-context-apply.test.tsx (Slice-Boundary-Disziplin).
   */
  it("AC-6: should call setVariation with modelParams on SET_MODEL_PARAMS_PATCH", () => {
    mockVariationData = {
      promptMotiv: "the user's existing prompt",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "16:9", guidance: 4 },
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_MODEL_PARAMS_PATCH",
        modelParams: { aspect_ratio: "1:1" },
      });
    });

    // Auto-apply effect fires; setVariation called.
    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArgs = mockSetVariation.mock.calls[0][0];

    // The new modelParams must be passed verbatim.
    expect(callArgs.modelParams).toEqual({ aspect_ratio: "1:1" });
  });

  it("AC-6: promptStyle and negativePrompt are NOT passed to setVariation", () => {
    mockVariationData = {
      promptMotiv: "the user's existing prompt",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "16:9" },
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_MODEL_PARAMS_PATCH",
        modelParams: { aspect_ratio: "1:1" },
      });
    });

    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArgs = mockSetVariation.mock.calls[0][0];

    // Slice-boundary discipline: prompt-style/negativePrompt were never
    // part of this slice's contract. The slot-tool flow MUST NOT introduce
    // them.
    expect(callArgs).not.toHaveProperty("promptStyle");
    expect(callArgs).not.toHaveProperty("negativePrompt");
  });

  it("AC-6: existing promptMotiv is preserved (passed through from current variationData)", () => {
    // The auto-apply effect MUST NOT clear the user's prompt when only
    // modelParams change.
    mockVariationData = {
      promptMotiv: "a majestic mountain",
      modelId: "flux-2-pro",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_MODEL_PARAMS_PATCH",
        modelParams: { guidance: 7 },
      });
    });

    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArgs = mockSetVariation.mock.calls[0][0];
    expect(callArgs.promptMotiv).toBe("a majestic mountain");
    // modelId is preserved verbatim.
    expect(callArgs.modelId).toBe("flux-2-pro");
    // modelParams is REPLACED by the patch.
    expect(callArgs.modelParams).toEqual({ guidance: 7 });
  });

  it("AC-6: two consecutive identical patches both fire setVariation (version bump)", () => {
    mockVariationData = {
      promptMotiv: "x",
      modelId: "m",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_MODEL_PARAMS_PATCH",
        modelParams: { aspect_ratio: "1:1" },
      });
    });
    act(() => {
      result.current.dispatch({
        type: "SET_MODEL_PARAMS_PATCH",
        modelParams: { aspect_ratio: "1:1" },
      });
    });

    // Two distinct calls because version bumped twice.
    expect(mockSetVariation).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// AC-9: Initial state has null patch fields and no setVariation call
// ---------------------------------------------------------------------------

describe("Slice 24: initial AssistantState (AC-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  /**
   * AC-9: GIVEN der initiale AssistantState
   *       WHEN der AssistantProvider initial gerendert wird
   *       THEN state.pendingSlotRolePatch === null,
   *       state.pendingSlotStrengthPatch === null;
   *       KEIN setVariation-Call fuer modelParams erfolgt vor dem ersten
   *       Tool-Result.
   */
  it("AC-9: should have pendingSlotRolePatch === null in initial state", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });
    expect(result.current.pendingSlotRolePatch).toBeNull();
  });

  it("AC-9: should have pendingSlotStrengthPatch === null in initial state", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });
    expect(result.current.pendingSlotStrengthPatch).toBeNull();
  });

  it("AC-9: setVariation is NOT called on initial provider mount", () => {
    mockVariationData = {
      promptMotiv: "initial prompt",
      modelId: "m",
      modelParams: { aspect_ratio: "1:1" },
    };

    render(
      <PromptAssistantProvider>
        <div>child</div>
      </PromptAssistantProvider>
    );

    // No SET_MODEL_PARAMS_PATCH was dispatched -> the auto-apply effect
    // for modelParams MUST NOT have fired.
    expect(mockSetVariation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-10: RESET_SESSION clears slot patches; existing reducer branches preserved
// ---------------------------------------------------------------------------

describe("Slice 24: RESET_SESSION clears pending slot patches (AC-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  /**
   * AC-10: GIVEN der existierende Reducer-State (Slice 15/17/etc.)
   *        WHEN dieser Slice die drei neuen Actions hinzufuegt
   *        THEN existierende Action-Branches (SET_DRAFT_PROMPT, REFINE_DRAFT,
   *        MARK_ASSISTANT_DONE, LOAD_SESSION, RESET_SESSION) bleiben
   *        unveraendert; RESET_SESSION setzt pendingSlotRolePatch und
   *        pendingSlotStrengthPatch zurueck auf null.
   */
  it("AC-10: should reset pendingSlotRolePatch on RESET_SESSION", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_ROLE",
        slotIndex: 1,
        role: "style",
      });
    });
    expect(result.current.pendingSlotRolePatch).not.toBeNull();

    act(() => {
      result.current.dispatch({ type: "RESET_SESSION" });
    });

    expect(result.current.pendingSlotRolePatch).toBeNull();
  });

  it("AC-10: should reset pendingSlotStrengthPatch on RESET_SESSION", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_SLOT_STRENGTH",
        slotIndex: 0,
        strength: 0.6,
      });
    });
    expect(result.current.pendingSlotStrengthPatch).not.toBeNull();

    act(() => {
      result.current.dispatch({ type: "RESET_SESSION" });
    });

    expect(result.current.pendingSlotStrengthPatch).toBeNull();
  });

  it("AC-10: SET_DRAFT_PROMPT branch is unchanged - draftPrompt is still set", () => {
    mockVariationData = {
      promptMotiv: "",
      modelId: "m",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: { prompt: "still works after slice 24" },
      });
    });

    expect(result.current.draftPrompt).toEqual({
      prompt: "still works after slice 24",
    });
  });

  it("AC-10: MARK_ASSISTANT_DONE branch is unchanged - isStreaming is set false", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_STREAMING",
        isStreaming: true,
      });
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.dispatch({ type: "MARK_ASSISTANT_DONE" });
    });

    expect(result.current.isStreaming).toBe(false);
  });
});
