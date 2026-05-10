// @vitest-environment jsdom
/**
 * Slice 17 — IntentSummaryCard Auto-Apply + Auto-Generate Handler tests.
 *
 * Source spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-17-auto-apply-generate-handler.md
 *
 * Coverage (1:1 from GIVEN/WHEN/THEN, see spec body for full text):
 *   - AC-1: happy-path — dispatches SET_FLOW_STATE("generating"), calls
 *           applyToWorkspace, then generateImages with the architecture-
 *           defined input shape.
 *   - AC-2: concurrent-block — useIsGenerationPending === true → toast
 *           shown, no FSM transition, no generateImages call, both buttons
 *           remain enabled.
 *   - AC-3: auto-retry watcher — exactly one retry on the true → false
 *           edge after a blocked click; second true → false edge does NOT
 *           replay.
 *   - AC-4: error-path rollback — generateImages returns ``{ error }`` →
 *           SET_FLOW_STATE("summarizing") + error toast + buttons re-
 *           enabled + second click triggers full AC-1 sequence again.
 *   - AC-5: success keeps "generating" — no rollback, no error toast,
 *           pending button-state is visible during the in-flight promise.
 *
 * Mocking Strategy: per slice spec — ``mock_external``. ``generateImages``
 * server-action is mocked via ``vi.mock("@/app/actions/generations")``;
 * ``GenerationsProvider`` is real and the test mutates its source array to
 * exercise the watcher edges. The PromptAssistantProvider is real so the
 * reducer + dispatch chain are exercised end-to-end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are HOISTED, so all closures used inside them
// must be created via vi.hoisted() to be available at hoist-time.
// ---------------------------------------------------------------------------

const {
  mockGenerateImages,
  mockSetVariation,
  mockUseWorkspaceVariation,
  mockToast,
  mockToastError,
} = vi.hoisted(() => ({
  mockGenerateImages: vi.fn(),
  mockSetVariation: vi.fn(),
  mockUseWorkspaceVariation: vi.fn(),
  mockToast: vi.fn(),
  mockToastError: vi.fn(),
}));

// generateImages — slice spec mandates this is mocked.
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
}));

// workspace-state — exposes the modelId/modelParams that the auto-generate
// handler reads at trigger-time.
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => mockUseWorkspaceVariation(),
}));

// sonner — concurrent-toast + error-toast assertions.
vi.mock("sonner", () => ({
  toast: Object.assign(mockToast, {
    error: mockToastError,
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { IntentSummaryCard } from "../intent-summary-card";
import {
  PromptAssistantProvider,
  usePromptAssistant,
  type IntentSummaryPayload,
  type PromptAssistantContextValue,
} from "@/lib/assistant/assistant-context";
import { GenerationsProvider } from "@/lib/workspace/generations-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = "project-17";
const TOAST_CONCURRENT = "Es läuft bereits eine Generierung. Bitte warten.";
const TOAST_GENERATE_ERROR =
  "Generierung fehlgeschlagen — manuell versuchen?";

function makePayload(overrides?: Partial<IntentSummaryPayload>): IntentSummaryPayload {
  return {
    axes: { subject: "ein Wolf", style: "Caspar David Friedrich" },
    prompt_preview: "A lone wolf, oil painting in moody twilight.",
    ...overrides,
  };
}

function makeGen(
  status: "pending" | "succeeded" | "failed",
  id: string,
  projectId: string = PROJECT_ID
): Generation {
  return {
    id,
    projectId,
    prompt: "",
    modelId: "",
    modelParams: {},
    status,
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    promptMotiv: "",
    isFavorite: false,
    createdAt: new Date(),
    generationMode: "txt2img",
  } as unknown as Generation;
}

/**
 * Test harness — renders the IntentSummaryCard inside the real
 * PromptAssistantProvider + GenerationsProvider, exposes a handle to
 * mutate the generations array (to drive the AC-3 watcher edges), and
 * captures the assistant context for direct dispatch + flowState reads.
 */
let latestCtx: PromptAssistantContextValue | null = null;
let setGensExternal: ((gens: Generation[]) => void) | null = null;

function CtxCapture({ children }: { children: ReactNode }) {
  const ctx = usePromptAssistant();
  latestCtx = ctx;
  return (
    <>
      <span data-testid="ctx-flow-state">{ctx.flowState}</span>
      <span data-testid="ctx-is-applied">
        {ctx.isApplied ? "true" : "false"}
      </span>
      {children}
    </>
  );
}

function MutableGenerations({
  initial,
  children,
}: {
  initial: Generation[];
  children: ReactNode;
}) {
  const [gens, setGens] = useState<Generation[]>(initial);
  setGensExternal = setGens;
  return (
    <GenerationsProvider generations={gens} projectId={PROJECT_ID}>
      {children}
    </GenerationsProvider>
  );
}

interface HarnessProps {
  payload: IntentSummaryPayload;
  initialGens?: Generation[];
  frozen?: boolean;
}

function Harness({ payload, initialGens = [], frozen = false }: HarnessProps) {
  return (
    <PromptAssistantProvider>
      <MutableGenerations initial={initialGens}>
        <CtxCapture>
          <IntentSummaryCard
            payload={payload}
            frozen={frozen}
            onGenerate={vi.fn()}
            onDiscuss={vi.fn()}
          />
        </CtxCapture>
      </MutableGenerations>
    </PromptAssistantProvider>
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  latestCtx = null;
  setGensExternal = null;
  Element.prototype.scrollIntoView = vi.fn();

  // Default workspace variation: user has selected ``flux-pro`` with
  // ``guidance_scale=7``. The handler must read these values at trigger-
  // time and forward them to ``generateImages``.
  mockUseWorkspaceVariation.mockReturnValue({
    variationData: {
      promptMotiv: "",
      modelId: "black-forest-labs/flux-pro",
      modelParams: { guidance_scale: 7 },
    },
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  });

  // Default: generateImages succeeds with a non-empty Generation[]. The
  // success path returns immediately so the in-flight visual state is not
  // observable unless we explicitly use a deferred resolution.
  mockGenerateImages.mockResolvedValue([makeGen("pending", "g-new")]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// AC-1 — Happy path
// ===========================================================================

describe("IntentSummaryCard Slice-17 AC-1: happy path", () => {
  // -------------------------------------------------------------------------
  // AC-1: GIVEN generateImages() ist NICHT pending UND
  //        flowState === "summarizing" UND intentSummaryPayload ist gesetzt
  //       WHEN User klickt data-testid="intent_summary_card.generate_btn"
  //       THEN dispatcht der Handler in dieser Reihenfolge:
  //            (a) SET_FLOW_STATE mit flowState="generating"
  //            (b) ruft applyToWorkspace() aus usePromptAssistant()
  //            (c) ruft generateImages() Server-Action mit
  //                { projectId, promptMotiv: payload.prompt_preview,
  //                  modelIds, params, count }
  // -------------------------------------------------------------------------
  it('AC-1: dispatches SET_FLOW_STATE("generating"), calls applyToWorkspace, then generateImages on generate click', async () => {
    const user = userEvent.setup();
    const payload = makePayload();
    render(<Harness payload={payload} />);

    // Bring FSM to "summarizing" so the precondition matches the spec.
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "summarizing"
    );

    // Click the generate button — actual interaction (not just DOM check).
    const generateBtn = screen.getByTestId(
      "intent_summary_card.generate_btn"
    );
    expect(generateBtn).not.toBeDisabled();
    await user.click(generateBtn);

    // (a) SET_FLOW_STATE("generating") must be dispatched FIRST → reducer
    //     state observed via ``ctx-flow-state`` flips synchronously with
    //     the click. The handler may transition back to ``"summarizing"``
    //     on error, so we wait for the value to be at least observed.
    await waitFor(() => {
      // generateImages is mocked to resolve with success → state stays
      // ``generating`` after the await chain completes.
      expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
        "generating"
      );
    });

    // (b) applyToWorkspace called → the public observable side-effect of
    //     ``applyToWorkspace`` is ``setVariation`` (mocked). Constraint:
    //     "Apply-Reihenfolge ist STRENG: SET_FLOW_STATE('generating')
    //     ZUERST, dann applyToWorkspace, dann generateImages."
    await waitFor(() => {
      expect(mockSetVariation).toHaveBeenCalled();
    });
    expect(mockSetVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: payload.prompt_preview,
      })
    );

    // (c) generateImages called with the architecture.md-defined input
    //     shape. modelIds is the singular workspace modelId wrapped in an
    //     array; params mirrors the workspace modelParams; count is 1
    //     (DEFAULT_AUTO_GENERATE_COUNT).
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });
    const call = mockGenerateImages.mock.calls[0][0];
    expect(call).toEqual(
      expect.objectContaining({
        projectId: PROJECT_ID,
        promptMotiv: payload.prompt_preview,
        modelIds: ["black-forest-labs/flux-pro"],
        params: { guidance_scale: 7 },
        count: 1,
      })
    );
  });

  it("AC-1 (ordering): SET_FLOW_STATE('generating') is reflected before generateImages resolves", async () => {
    const user = userEvent.setup();
    const payload = makePayload();

    // Defer the resolution — keeps ``isAutoGenerating`` true while we
    // assert the ordering invariant.
    let resolveGen: ((value: Generation[]) => void) | null = null;
    mockGenerateImages.mockImplementation(
      () =>
        new Promise<Generation[]>((res) => {
          resolveGen = res;
        })
    );

    render(<Harness payload={payload} />);
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    await user.click(screen.getByTestId("intent_summary_card.generate_btn"));

    // Before the server-action promise has resolved, the FSM is already
    // ``generating`` — proves SET_FLOW_STATE was dispatched BEFORE the
    // generateImages await.
    await waitFor(() => {
      expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
        "generating"
      );
    });

    // Now finish the server-action promise.
    await act(async () => {
      resolveGen!([makeGen("pending", "g-new")]);
    });

    // FSM remains ``generating`` (success branch — AC-5).
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "generating"
    );
  });
});

// ===========================================================================
// AC-2 — Concurrent-block + toast
// ===========================================================================

describe("IntentSummaryCard Slice-17 AC-2: concurrent block", () => {
  // -------------------------------------------------------------------------
  // AC-2: GIVEN useIsGenerationPending() liefert true
  //       WHEN User klickt intent_summary_card.generate_btn
  //       THEN wird KEIN SET_FLOW_STATE("generating") dispatcht UND
  //            KEIN generateImages aufgerufen UND
  //            ein sonner-Toast mit Text
  //            "Es läuft bereits eine Generierung. Bitte warten." erscheint
  //            UND flowState bleibt "summarizing" UND beide Card-Buttons
  //            bleiben aktiv.
  // -------------------------------------------------------------------------
  it("AC-2: shows concurrent-generation toast and skips generateImages when useIsGenerationPending is true", async () => {
    const user = userEvent.setup();
    const payload = makePayload();
    const initialGens: Generation[] = [makeGen("pending", "g-existing")];

    render(<Harness payload={payload} initialGens={initialGens} />);

    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    await user.click(screen.getByTestId("intent_summary_card.generate_btn"));

    // Concurrent toast was raised with the spec-defined copy.
    expect(mockToast).toHaveBeenCalledWith(TOAST_CONCURRENT);

    // No FSM transition — flowState stays summarizing.
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "summarizing"
    );

    // No generateImages call.
    expect(mockGenerateImages).not.toHaveBeenCalled();
    // applyToWorkspace not invoked either (no setVariation side-effect).
    expect(mockSetVariation).not.toHaveBeenCalled();

    // Both buttons remain ENABLED (no disabled attribute change).
    expect(
      screen.getByTestId("intent_summary_card.generate_btn")
    ).not.toBeDisabled();
    expect(
      screen.getByTestId("intent_summary_card.discuss_btn")
    ).not.toBeDisabled();
  });
});

// ===========================================================================
// AC-3 — Auto-retry on settle (exactly once)
// ===========================================================================

describe("IntentSummaryCard Slice-17 AC-3: auto-retry on pending settle", () => {
  // -------------------------------------------------------------------------
  // AC-3: GIVEN AC-2 wurde gerade ausgelöst (Click blockiert) UND
  //        Handler hat einen Retry-Watcher armiert
  //       WHEN useIsGenerationPending() von true zu false wechselt
  //       THEN wird genau ein Retry-Versuch automatisch ausgeführt
  //            UND der Watcher wird danach disarmiert (kein zweiter Auto-
  //            Retry beim nächsten true→false-Übergang).
  // -------------------------------------------------------------------------
  it("AC-3: automatically retries generate exactly once when pending flips false after blocked click", async () => {
    const user = userEvent.setup();
    const payload = makePayload();
    const initialGens: Generation[] = [makeGen("pending", "g-existing")];

    render(<Harness payload={payload} initialGens={initialGens} />);
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    // Click is blocked → arms the retry watcher.
    await user.click(screen.getByTestId("intent_summary_card.generate_btn"));
    expect(mockGenerateImages).not.toHaveBeenCalled();

    // The pending generation settles → useIsGenerationPending flips
    // true → false, watcher fires the retry exactly once.
    await act(async () => {
      setGensExternal!([makeGen("succeeded", "g-existing")]);
    });

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });
    expect(mockGenerateImages.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        projectId: PROJECT_ID,
        promptMotiv: payload.prompt_preview,
      })
    );

    // ----------------------------------------------------------------------
    // Watcher disarm proof: another true → false transition must NOT
    // replay the retry. Push a new pending gen, then settle it again.
    // ----------------------------------------------------------------------
    await act(async () => {
      setGensExternal!([
        makeGen("succeeded", "g-existing"),
        makeGen("pending", "g-second"),
      ]);
    });
    // Wait briefly to let any rogue effect fire.
    await act(async () => {
      setGensExternal!([
        makeGen("succeeded", "g-existing"),
        makeGen("succeeded", "g-second"),
      ]);
    });

    // Still exactly ONE auto-retry call. The first call was triggered by
    // the watcher; the second true → false edge must NOT replay.
    expect(mockGenerateImages).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// AC-4 — Error-path rollback + retryable card
// ===========================================================================

describe("IntentSummaryCard Slice-17 AC-4: error rollback", () => {
  // -------------------------------------------------------------------------
  // AC-4: GIVEN AC-1 wurde ausgelöst, generateImages returnt { error: string }
  //       WHEN das Promise resolved
  //       THEN dispatcht der Handler SET_FLOW_STATE mit flowState="summarizing"
  //            (Rollback) UND ein sonner-Toast
  //            "Generierung fehlgeschlagen — manuell versuchen?" erscheint
  //            UND beide Card-Buttons sind wieder aktiv (disabled=false)
  //            UND erneuter Click triggert wieder die volle AC-1-Sequenz.
  // -------------------------------------------------------------------------
  it('AC-4: rolls back flowState to "summarizing" and shows error toast on generateImages error; retry triggers full AC-1 sequence', async () => {
    const user = userEvent.setup();
    const payload = makePayload();

    // First call errors; second call (retry) succeeds.
    mockGenerateImages
      .mockResolvedValueOnce({ error: "Server boom" })
      .mockResolvedValueOnce([makeGen("pending", "g-retry")]);

    render(<Harness payload={payload} />);
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    // First click → error path.
    await user.click(screen.getByTestId("intent_summary_card.generate_btn"));

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    // Rollback: FSM is back to ``summarizing``.
    await waitFor(() => {
      expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
        "summarizing"
      );
    });

    // Error toast surfaced with the spec-defined copy.
    expect(mockToastError).toHaveBeenCalledWith(TOAST_GENERATE_ERROR);

    // Both buttons re-enabled.
    expect(
      screen.getByTestId("intent_summary_card.generate_btn")
    ).not.toBeDisabled();
    expect(
      screen.getByTestId("intent_summary_card.discuss_btn")
    ).not.toBeDisabled();

    // ----------------------------------------------------------------------
    // Second click — full AC-1 sequence runs again (handler is retryable).
    // ----------------------------------------------------------------------
    await user.click(screen.getByTestId("intent_summary_card.generate_btn"));

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(2);
    });
    expect(mockGenerateImages.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        projectId: PROJECT_ID,
        promptMotiv: payload.prompt_preview,
      })
    );

    // After success the FSM is ``generating`` again.
    await waitFor(() => {
      expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
        "generating"
      );
    });
  });
});

// ===========================================================================
// AC-5 — Success path keeps "generating" + pending visual state
// ===========================================================================

describe("IntentSummaryCard Slice-17 AC-5: success keeps generating", () => {
  // -------------------------------------------------------------------------
  // AC-5: GIVEN AC-1 wurde ausgelöst, generateImages resolved mit
  //        Generation[] (Erfolg)
  //       WHEN das Promise resolved
  //       THEN bleibt flowState === "generating" (kein Rollback) UND
  //            es wird KEIN Error-Toast gezeigt UND der "Generiere…"-
  //            Spinner-State auf dem Generate-Button ist während des
  //            laufenden Promise sichtbar (Card-State pending).
  // -------------------------------------------------------------------------
  it('AC-5: keeps flowState === "generating" on successful generateImages and shows pending button state during the in-flight promise', async () => {
    const user = userEvent.setup();
    const payload = makePayload();

    // Defer resolution so we can assert the pending visual mid-flight.
    let resolveGen: ((value: Generation[]) => void) | null = null;
    mockGenerateImages.mockImplementation(
      () =>
        new Promise<Generation[]>((res) => {
          resolveGen = res;
        })
    );

    render(<Harness payload={payload} />);
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    await user.click(screen.getByTestId("intent_summary_card.generate_btn"));

    // ---------- During in-flight promise ----------
    // Generate-button shows the "Generiere…" label, is disabled, and the
    // spinner element is rendered. Card root carries data-pending="true".
    await waitFor(() => {
      expect(
        screen.getByTestId("intent_summary_card.generate_btn")
      ).toBeDisabled();
    });
    const generateBtn = screen.getByTestId(
      "intent_summary_card.generate_btn"
    );
    expect(generateBtn).toHaveTextContent(/Generiere/);
    expect(
      screen.getByTestId("intent_summary_card.generate_btn.spinner")
    ).toBeInTheDocument();
    expect(screen.getByTestId("intent_summary_card")).toHaveAttribute(
      "data-pending",
      "true"
    );

    // FSM is already ``generating`` (set BEFORE await per AC-1 ordering).
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "generating"
    );

    // ---------- Promise resolves ----------
    await act(async () => {
      resolveGen!([makeGen("pending", "g-new")]);
    });

    // FSM REMAINS ``generating`` (no rollback).
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "generating"
    );

    // No error toast was raised on the success path.
    expect(mockToastError).not.toHaveBeenCalled();

    // Pending visual state lifts after resolution.
    await waitFor(() => {
      expect(screen.getByTestId("intent_summary_card")).toHaveAttribute(
        "data-pending",
        "false"
      );
    });
  });
});
