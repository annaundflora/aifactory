// @vitest-environment jsdom
/**
 * Tests for Slice 27: PasteDetectConfirmCard component + chat-thread
 * trigger-layer integration.
 *
 * Source spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-27-paste-detect-card-component.md
 *
 * Coverage (1:1 from GIVEN/WHEN/THEN):
 *   - AC-1: First user message + heuristic-hit triggers RENDER_PASTE_CONFIRM
 *           and mounts the card with data-testid="paste_confirm_card".
 *   - AC-2: Subsequent user messages do NOT re-trigger
 *           RENDER_PASTE_CONFIRM, even when the heuristic would match.
 *   - AC-3: First user message + heuristic-miss does NOT mount the card
 *           and pasteConfirmPayload stays null.
 *   - AC-4: refine_btn click dispatches DISMISS_PASTE_CONFIRM AND calls
 *           sendMessage(seedText + tool-hint). Card un-mounts.
 *   - AC-5: interview_btn click dispatches DISMISS_PASTE_CONFIRM AND calls
 *           sendMessage(seedText) plain. Card un-mounts.
 *   - AC-6: After dismiss the card stays absent even when subsequent
 *           assistant messages stream into the thread.
 *
 * Mocking Strategy: ``mock_external`` (per slice spec) — workspace-state,
 * sonner are mocked. The PromptAssistantProvider is REAL, so reducer +
 * dispatch chain are exercised end-to-end. ``sendMessage`` is exercised
 * via the runtime ``sendMessageRef`` slot — exactly the wire the
 * AssistantProvider uses in production.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mock workspace-state — required by PromptAssistantProvider
// ---------------------------------------------------------------------------

const mockSetVariation = vi.fn();
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock sonner — toast is fired by various provider helpers
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { ChatThread } from "../chat-thread";
import {
  PromptAssistantProvider,
  usePromptAssistant,
  type PromptAssistantContextValue,
} from "@/lib/assistant/assistant-context";
import type { ChatMessage as Message } from "@/lib/types/chat-message";

// ---------------------------------------------------------------------------
// Heuristic-matching seed prompts
// ---------------------------------------------------------------------------
//
// The heuristic (``detectPastedPrompt`` in lib/assistant/paste-detect.ts)
// requires:
//   1. length >= 80
//   2. comma-tokens >= 6
//   3. style-keyword hits >= 2 (case-insensitive)
//
// We craft real strings rather than mocking the heuristic so the trigger-
// layer is exercised against the real Source-of-Truth from Slice 26.

/**
 * Heuristic-MATCHING seed: 80+ chars, 6+ comma tokens, 2+ style keywords
 * ("cinematic" + "hyperrealistic"). Confirmed by Slice 26 unit tests.
 */
const PASTE_LIKE_SEED =
  "A lone wolf on a mountain ridge, oil painting, cinematic lighting, "
  + "hyperrealistic, dramatic lighting, masterpiece, trending on artstation";

/**
 * Heuristic-MISS seed: short, low comma count, no style keywords.
 */
const PLAIN_SEED = "Hello, how are you?";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let latestCtx: PromptAssistantContextValue | null = null;

function ChatThreadHarness({ messages }: { messages: Message[] }) {
  const ctx = usePromptAssistant();
  latestCtx = ctx;
  return (
    <div>
      <ChatThread messages={messages} isStreaming={false} />
      <span data-testid="ctx-paste-payload">
        {ctx.pasteConfirmPayload === null
          ? "null"
          : JSON.stringify(ctx.pasteConfirmPayload)}
      </span>
      <span data-testid="ctx-flow-state">{ctx.flowState}</span>
      <span data-testid="ctx-messages-count">{ctx.messages.length}</span>
    </div>
  );
}

function makeUserMessage(content: string, id: string): Message {
  return { id, role: "user", content };
}

function makeAssistantMessage(content: string, id: string): Message {
  return { id, role: "assistant", content };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — ChatThread calls it on mount.
  Element.prototype.scrollIntoView = vi.fn();
  latestCtx = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// AC-1: Trigger fires on first user message when heuristic matches
// ===========================================================================

describe("Slice 27: PasteDetectConfirmCard — trigger (AC-1)", () => {
  // -------------------------------------------------------------------------
  // AC-1: GIVEN eine frisch gestartete Session ohne vorhergehende
  //        User-Messages UND ``flowState === "idle"``
  //       WHEN User eine erste Message absendet, deren Inhalt
  //        ``detectPastedPrompt(text) === true`` ergibt
  //       THEN dispatcht chat-thread (oder ein dedizierter Trigger-Effect)
  //            genau einmal die Reducer-Action ``RENDER_PASTE_CONFIRM`` mit
  //            Payload ``{ seedText: <originalText> }``; nach Render existiert
  //            genau ein DOM-Element mit ``data-testid="paste_confirm_card"``
  //            zwischen den Bubbles.
  // -------------------------------------------------------------------------
  it("AC-1: dispatches RENDER_PASTE_CONFIRM and mounts card on first user message when heuristic matches", () => {
    const messages: Message[] = [makeUserMessage(PASTE_LIKE_SEED, "u1")];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // After the trigger-effect runs, the reducer payload contains seedText.
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText: PASTE_LIKE_SEED })
    );

    // Exactly ONE card mounted in the DOM.
    const cards = screen.getAllByTestId("paste_confirm_card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toBeVisible();

    // Both action buttons present and ENABLED (initial rendered state).
    const refineBtn = screen.getByTestId("paste_confirm_card.refine_btn");
    const interviewBtn = screen.getByTestId(
      "paste_confirm_card.interview_btn"
    );
    expect(refineBtn).toBeInTheDocument();
    expect(interviewBtn).toBeInTheDocument();
    expect(refineBtn).not.toBeDisabled();
    expect(interviewBtn).not.toBeDisabled();
  });

  it("AC-1: card is rendered AFTER the first user-message bubble (between bubbles)", () => {
    const messages: Message[] = [makeUserMessage(PASTE_LIKE_SEED, "u1")];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    const card = screen.getByTestId("paste_confirm_card");
    const userBubble = screen.getByTestId("user-message");

    // The user bubble must precede the card in DOM order — the card lands
    // BETWEEN the user message and any subsequent message.
    expect(
      userBubble.compareDocumentPosition(card)
        & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

// ===========================================================================
// AC-2: Subsequent user messages do NOT re-trigger
// ===========================================================================

describe("Slice 27: PasteDetectConfirmCard — single-fire (AC-2)", () => {
  // -------------------------------------------------------------------------
  // AC-2: GIVEN eine Session, in der bereits **mindestens eine**
  //        User-Message existiert
  //       WHEN User eine weitere Message absendet, die ``detectPastedPrompt``
  //        ebenfalls als true klassifizieren würde
  //       THEN wird **keine** weitere ``RENDER_PASTE_CONFIRM``-Action
  //            dispatcht; es existiert kein zweites ``paste_confirm_card``
  //            Element im DOM (Heuristik triggert ausschliesslich auf der
  //            ersten User-Message der Session).
  // -------------------------------------------------------------------------
  it("AC-2: does not re-mount card on subsequent paste-like user messages (after dismiss)", async () => {
    const user = userEvent.setup();

    function Wrapper({ messages }: { messages: Message[] }) {
      return (
        <PromptAssistantProvider>
          <ChatThreadHarness messages={messages} />
        </PromptAssistantProvider>
      );
    }

    const initialMessages: Message[] = [
      makeUserMessage(PASTE_LIKE_SEED, "u1"),
    ];
    const { rerender } = render(<Wrapper messages={initialMessages} />);

    // Card mounted on the first user message.
    expect(
      screen.getByTestId("paste_confirm_card")
    ).toBeInTheDocument();

    // Wire sendMessage spy and click "Interview starten" so the card
    // dismisses cleanly (we want to verify the SUBSEQUENT user message
    // does not re-trigger, not that the card sticks around).
    await act(async () => {
      latestCtx!.sendMessageRef.current = vi.fn();
    });
    await user.click(screen.getByTestId("paste_confirm_card.interview_btn"));

    // Card un-mounted.
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      "null"
    );

    // A second paste-like user message arrives later in the same session.
    const updatedMessages: Message[] = [
      ...initialMessages,
      makeAssistantMessage("Stelle dir das so vor", "asst-1"),
      makeUserMessage(PASTE_LIKE_SEED, "u2"),
    ];
    rerender(<Wrapper messages={updatedMessages} />);

    // No second card. Reducer payload still null. Trigger latched.
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      "null"
    );
  });

  it("AC-2: trigger-layer evaluates only the first user message even when the array contains multiple paste-like messages on initial mount", () => {
    // Edge case: messages array on initial mount already contains TWO
    // paste-like user messages (e.g. session restore). Only the first one
    // counts — the trigger keys on the FIRST user message only.
    const messages: Message[] = [
      makeUserMessage(PASTE_LIKE_SEED, "u1"),
      makeAssistantMessage("antwort", "a1"),
      makeUserMessage(PASTE_LIKE_SEED, "u2"),
    ];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // Exactly one card (single-fire on first user message).
    const cards = screen.queryAllByTestId("paste_confirm_card");
    expect(cards).toHaveLength(1);
  });
});

// ===========================================================================
// AC-3: Heuristic miss → no card
// ===========================================================================

describe("Slice 27: PasteDetectConfirmCard — heuristic miss (AC-3)", () => {
  // -------------------------------------------------------------------------
  // AC-3: GIVEN User-Message ist erste Message der Session, aber
  //        ``detectPastedPrompt(text) === false``
  //       WHEN Render-Pass läuft
  //       THEN wird **keine** Card gemountet; Reducer-Field
  //            ``pasteConfirmPayload`` bleibt ``null``/``undefined``.
  // -------------------------------------------------------------------------
  it("AC-3: does not mount card when detectPastedPrompt returns false", () => {
    const messages: Message[] = [makeUserMessage(PLAIN_SEED, "u1")];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // No card.
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();

    // Reducer payload stayed null.
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      "null"
    );
  });

  it("AC-3: empty-messages session does not mount the card (no user message yet)", () => {
    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={[]} />
      </PromptAssistantProvider>
    );

    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      "null"
    );
  });
});

// ===========================================================================
// AC-4: Refine-button click → dismiss + sendMessage with tool-hint
// ===========================================================================

describe("Slice 27: PasteDetectConfirmCard — refine click (AC-4)", () => {
  // -------------------------------------------------------------------------
  // AC-4: GIVEN Reducer-State enthält ``pasteConfirmPayload`` (Card sichtbar,
  //        beide Buttons aktiv)
  //       WHEN User klickt ``data-testid="paste_confirm_card.refine_btn"``
  //       THEN wird (a) Reducer-Action ``DISMISS_PASTE_CONFIRM`` dispatcht UND
  //            (b) ``sendMessage(seedText)`` mit dem Original-Seed-Text und
  //            einem zusätzlichen Tool-Hint aufgerufen, der den Backend-LLM
  //            zur Nutzung von ``refine_prompt`` veranlasst. Die Card-Instanz
  //            verschwindet vollständig aus dem DOM.
  // -------------------------------------------------------------------------
  it("AC-4: refine_btn click dispatches DISMISS_PASTE_CONFIRM and calls sendMessage with seed + tool-hint", async () => {
    const user = userEvent.setup();
    const messages: Message[] = [makeUserMessage(PASTE_LIKE_SEED, "u1")];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // Wire sendMessage spy via the runtime slot — exactly the production
    // wire used by use-assistant-runtime.ts.
    const sendMessageSpy = vi.fn();
    await act(async () => {
      latestCtx!.sendMessageRef.current = sendMessageSpy;
    });

    // Sanity: card mounted, payload set.
    expect(screen.getByTestId("paste_confirm_card")).toBeInTheDocument();
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText: PASTE_LIKE_SEED })
    );

    // Real click on the actual button (Interaction Tests guideline).
    const refineBtn = screen.getByTestId("paste_confirm_card.refine_btn");
    await user.click(refineBtn);

    // (a) DISMISS_PASTE_CONFIRM was dispatched — payload is null.
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      "null"
    );

    // (b) sendMessage was called exactly once.
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const sentContent = sendMessageSpy.mock.calls[0][0] as string;

    // The sent content begins with the original seed text (verbatim) so
    // the backend continues to see the user's full prompt.
    expect(sentContent.startsWith(PASTE_LIKE_SEED)).toBe(true);

    // AND a tool-hint suffix is appended so the backend LLM is nudged to
    // call ``refine_prompt`` directly. The exact mechanics are
    // Implementer-Choice (see slice spec note on AC-4); we verify only
    // that the suffix is non-empty AND distinguishable from the seed.
    expect(sentContent.length).toBeGreaterThan(PASTE_LIKE_SEED.length);
    const suffix = sentContent.slice(PASTE_LIKE_SEED.length);
    expect(suffix.trim().length).toBeGreaterThan(0);
    // The hint should reference ``refine_prompt`` as the directive
    // (verbatim string lives in components/assistant/paste-detect-confirm-card.tsx).
    expect(suffix.toLowerCase()).toContain("refine_prompt");

    // Card un-mounted.
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// AC-5: Interview-button click → dismiss + sendMessage plain
// ===========================================================================

describe("Slice 27: PasteDetectConfirmCard — interview click (AC-5)", () => {
  // -------------------------------------------------------------------------
  // AC-5: GIVEN Reducer-State enthält ``pasteConfirmPayload`` (Card sichtbar,
  //        beide Buttons aktiv)
  //       WHEN User klickt ``data-testid="paste_confirm_card.interview_btn"``
  //       THEN wird (a) Reducer-Action ``DISMISS_PASTE_CONFIRM`` dispatcht UND
  //            (b) ``sendMessage(seedText)`` mit dem Original-Seed-Text als
  //            normale User-Message aufgerufen (kein Tool-Hint, normaler
  //            Interview-Pfad). Die Card-Instanz verschwindet vollständig
  //            aus dem DOM.
  // -------------------------------------------------------------------------
  it("AC-5: interview_btn click dispatches DISMISS_PASTE_CONFIRM and calls sendMessage with seed (no tool-hint)", async () => {
    const user = userEvent.setup();
    const messages: Message[] = [makeUserMessage(PASTE_LIKE_SEED, "u1")];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    const sendMessageSpy = vi.fn();
    await act(async () => {
      latestCtx!.sendMessageRef.current = sendMessageSpy;
    });

    expect(screen.getByTestId("paste_confirm_card")).toBeInTheDocument();

    const interviewBtn = screen.getByTestId(
      "paste_confirm_card.interview_btn"
    );
    await user.click(interviewBtn);

    // (a) DISMISS_PASTE_CONFIRM was dispatched — payload is null.
    expect(screen.getByTestId("ctx-paste-payload")).toHaveTextContent(
      "null"
    );

    // (b) sendMessage called once with the verbatim seed text — no
    // tool-hint suffix, no other transformation.
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const sentContent = sendMessageSpy.mock.calls[0][0] as string;
    expect(sentContent).toBe(PASTE_LIKE_SEED);

    // Negative: no ``refine_prompt`` directive must leak into the sent
    // text on the interview path.
    expect(sentContent.toLowerCase()).not.toContain("refine_prompt");

    // Card un-mounted.
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// AC-6: Card does NOT come back after dismiss when assistant streams new msgs
// ===========================================================================

describe("Slice 27: PasteDetectConfirmCard — transient (AC-6)", () => {
  // -------------------------------------------------------------------------
  // AC-6: GIVEN Card wurde durch einen der beiden Buttons dismissed
  //       WHEN ein nachfolgender Assistant-Turn neue Messages in den Thread
  //        streamt
  //       THEN bleibt das ``paste_confirm_card``-Element abwesend; im
  //            Gegensatz zur IntentSummaryCard wird es **nicht** als
  //            History-Element konserviert.
  // -------------------------------------------------------------------------
  it("AC-6: card stays un-mounted when subsequent assistant messages arrive after refine dismiss", async () => {
    const user = userEvent.setup();

    function Wrapper({ messages }: { messages: Message[] }) {
      return (
        <PromptAssistantProvider>
          <ChatThreadHarness messages={messages} />
        </PromptAssistantProvider>
      );
    }

    const initialMessages: Message[] = [
      makeUserMessage(PASTE_LIKE_SEED, "u1"),
    ];
    const { rerender } = render(<Wrapper messages={initialMessages} />);

    await act(async () => {
      latestCtx!.sendMessageRef.current = vi.fn();
    });

    // Card present, then dismissed via refine click.
    expect(screen.getByTestId("paste_confirm_card")).toBeInTheDocument();
    await user.click(screen.getByTestId("paste_confirm_card.refine_btn"));
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();

    // Now a new assistant turn streams in.
    const updatedMessages: Message[] = [
      ...initialMessages,
      makeAssistantMessage("Hier kommt deine verfeinerte Antwort", "a1"),
    ];
    rerender(<Wrapper messages={updatedMessages} />);

    // Card MUST stay absent — transient, NOT preserved in history.
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();

    // The new assistant bubble IS rendered.
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Hier kommt deine verfeinerte Antwort"
    );
  });

  it("AC-6: card stays un-mounted when subsequent assistant messages arrive after interview dismiss", async () => {
    const user = userEvent.setup();

    function Wrapper({ messages }: { messages: Message[] }) {
      return (
        <PromptAssistantProvider>
          <ChatThreadHarness messages={messages} />
        </PromptAssistantProvider>
      );
    }

    const initialMessages: Message[] = [
      makeUserMessage(PASTE_LIKE_SEED, "u1"),
    ];
    const { rerender } = render(<Wrapper messages={initialMessages} />);

    await act(async () => {
      latestCtx!.sendMessageRef.current = vi.fn();
    });

    expect(screen.getByTestId("paste_confirm_card")).toBeInTheDocument();
    await user.click(screen.getByTestId("paste_confirm_card.interview_btn"));
    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();

    const updatedMessages: Message[] = [
      ...initialMessages,
      makeAssistantMessage("Erste Interview-Frage", "a1"),
      makeAssistantMessage("Zweite Interview-Frage", "a2"),
    ];
    rerender(<Wrapper messages={updatedMessages} />);

    expect(
      screen.queryByTestId("paste_confirm_card")
    ).not.toBeInTheDocument();
    const assistantBubbles = screen.getAllByTestId("assistant-message");
    expect(assistantBubbles).toHaveLength(2);
  });
});
