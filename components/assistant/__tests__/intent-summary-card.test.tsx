// @vitest-environment jsdom
/**
 * Tests for Slice 16: IntentSummaryCard component
 *
 * Source spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-16-intent-summary-card-component.md
 *
 * Coverage (1:1 from GIVEN/WHEN/THEN):
 *   - AC-1: Card rendert bei flowState === "summarizing" mit allen Axes
 *   - AC-2: minimal_axes — nur gefuellte Axes erscheinen
 *   - AC-3: Prompt-Preview in Monospace
 *   - AC-4: SettingsDiff deklarativ pro Sub-Array (slotRoles → slotStrengths
 *           → modelId → modelParams)
 *   - AC-5: no_settings_diff — Block komplett ausgelassen
 *   - AC-6: Discuss-Click dispatcht SET_FLOW_STATE("interviewing") UND
 *           sendMessage("Was soll anders sein?"); Card friert ein
 *   - AC-7: Card bleibt nach Click im DOM (History-Erhalt)
 *   - AC-8: Kein Mount bei flowState !== "summarizing" und kein History-Payload
 *
 * Mocking Strategy: ``mock_external`` (per slice spec) — workspace-state,
 * sonner, fetch are mocked. The PromptAssistantProvider is REAL, so the
 * reducer + dispatch chain are exercised end-to-end. The IntentSummaryCard
 * is also tested in isolation (no provider) for the pure-render ACs
 * (AC-1, AC-2, AC-3, AC-4, AC-5).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
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

import { IntentSummaryCard } from "../intent-summary-card";
import { ChatThread } from "../chat-thread";
import {
  PromptAssistantProvider,
  PromptAssistantContext,
  usePromptAssistant,
  type IntentSummaryPayload,
  type PromptAssistantContextValue,
} from "@/lib/assistant/assistant-context";
import type { ChatMessage as Message } from "@/lib/types/chat-message";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeFullAxesPayload(): IntentSummaryPayload {
  return {
    axes: {
      subject: "ein einsamer Wolf",
      medium: "Oelgemaelde",
      style: "Caspar David Friedrich",
      lighting: "warmes Abendlicht",
      composition: "Drittel-Regel, Wolf links",
      palette: "warme Erdtoene",
    },
    prompt_preview:
      "A lone wolf, oil painting in the style of Caspar David Friedrich, warm sunset light, rule of thirds composition, earth-tone palette.",
  };
}

function makeMinimalAxesPayload(): IntentSummaryPayload {
  return {
    axes: {
      subject: "Bergpanorama",
      style: "Ukiyo-e",
      // medium / lighting / composition / palette intentionally undefined
    },
    prompt_preview: "Mountain panorama in Ukiyo-e style.",
  };
}

function makePayloadWithFullSettingsDiff(): IntentSummaryPayload {
  return {
    ...makeFullAxesPayload(),
    settings_diff: {
      slotRoles: [
        { slotIndex: 0, from: "subject", to: "style" },
      ],
      slotStrengths: [
        { slotIndex: 1, from: 0.3, to: 0.75 },
      ],
      modelId: { from: "flux-dev", to: "flux-pro" },
      modelParams: [
        { key: "guidance_scale", from: 7.5, to: 9.0 },
      ],
    },
  };
}

function makeAssistantMessage(content: string, id: string): Message {
  return { id, role: "assistant", content };
}

// ---------------------------------------------------------------------------
// Test harness for chat-thread + provider integration
// ---------------------------------------------------------------------------

let latestCtx: PromptAssistantContextValue | null = null;

function ChatThreadHarness({
  messages,
}: {
  messages: Message[];
}) {
  const ctx = usePromptAssistant();
  latestCtx = ctx;
  return (
    <div>
      <ChatThread messages={messages} isStreaming={false} />
      <span data-testid="ctx-flow-state">{ctx.flowState}</span>
      <span data-testid="ctx-messages-count">{ctx.messages.length}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // jsdom does not implement scrollIntoView -- mock for ChatThread
  Element.prototype.scrollIntoView = vi.fn();
  latestCtx = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Pure-render unit tests (component in isolation, no provider)
// ===========================================================================

describe("IntentSummaryCard — render contract (AC-1 .. AC-5)", () => {
  // -------------------------------------------------------------------------
  // AC-1: GIVEN Reducer-State mit flowState === "summarizing" und einem
  //        intentSummaryPayload (alle 6 Axes gefuellt, prompt_preview als
  //        String, kein settings_diff)
  //       WHEN chat-thread.tsx rendert
  //       THEN wird genau ein IntentSummaryCard mit
  //            data-testid="intent_summary_card" gerendert; jede gefuellte
  //            Axis (subject, medium, style, lighting, composition, palette)
  //            erscheint als Listenpunkt mit Label + Value.
  // -------------------------------------------------------------------------
  it("AC-1: renders card with all six axes when payload contains all axes", () => {
    const payload = makeFullAxesPayload();
    render(
      <IntentSummaryCard
        payload={payload}
        frozen={false}
        onGenerate={vi.fn()}
        onDiscuss={vi.fn()}
      />
    );

    // Card present (single instance).
    const cards = screen.getAllByTestId("intent_summary_card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toBeVisible();

    // All six axes rendered as list items, in canonical order.
    const order = [
      "subject",
      "medium",
      "style",
      "lighting",
      "composition",
      "palette",
    ] as const;
    for (const key of order) {
      const li = screen.getByTestId(`intent_summary_card.axis.${key}`);
      expect(li).toBeInTheDocument();
      // Label + value both rendered:
      expect(li).toHaveTextContent(payload.axes[key]!);
    }

    // The axes container exposes all six items.
    const axesList = screen.getByTestId("intent_summary_card.axes");
    expect(within(axesList).getAllByRole("listitem")).toHaveLength(6);
  });

  // -------------------------------------------------------------------------
  // AC-2: GIVEN intentSummaryPayload.axes enthaelt nur subject und style
  //        (uebrige undefined)
  //       WHEN Card rendert (State minimal_axes)
  //       THEN werden ausschliesslich diese zwei Axes gerendert; die uebrigen
  //            Listenpunkte fehlen vollstaendig (kein leerer Bullet, kein "—").
  // -------------------------------------------------------------------------
  it("AC-2: renders only present axes and omits undefined ones (minimal_axes state)", () => {
    const payload = makeMinimalAxesPayload();
    render(
      <IntentSummaryCard
        payload={payload}
        frozen={false}
        onGenerate={vi.fn()}
        onDiscuss={vi.fn()}
      />
    );

    // Only subject + style.
    expect(
      screen.getByTestId("intent_summary_card.axis.subject")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("intent_summary_card.axis.style")
    ).toBeInTheDocument();

    // The four omitted axes MUST NOT appear as bullets.
    for (const key of ["medium", "lighting", "composition", "palette"]) {
      expect(
        screen.queryByTestId(`intent_summary_card.axis.${key}`)
      ).not.toBeInTheDocument();
    }

    // Axes list contains EXACTLY two items — no empty bullets, no em-dashes.
    const axesList = screen.getByTestId("intent_summary_card.axes");
    expect(within(axesList).getAllByRole("listitem")).toHaveLength(2);
    expect(axesList).not.toHaveTextContent("—");
  });

  // -------------------------------------------------------------------------
  // AC-3: GIVEN intentSummaryPayload.prompt_preview ist gesetzt
  //       WHEN Card rendert
  //       THEN wird der String in einem Element mit
  //            data-testid="intent_summary_card.prompt_preview" und
  //            Monospace-Schriftbild dargestellt (Tailwind ``font-mono``).
  // -------------------------------------------------------------------------
  it("AC-3: renders prompt_preview in monospace block", () => {
    const payload = makeFullAxesPayload();
    render(
      <IntentSummaryCard
        payload={payload}
        frozen={false}
        onGenerate={vi.fn()}
        onDiscuss={vi.fn()}
      />
    );

    const preview = screen.getByTestId("intent_summary_card.prompt_preview");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveTextContent(payload.prompt_preview);

    // Monospace via Tailwind ``font-mono`` class (per spec — "Tailwind
    // font-mono oder Aequivalent gemaess bestehender Code-Block-Konvention").
    expect(preview.className).toMatch(/font-mono/);
  });

  // -------------------------------------------------------------------------
  // AC-4: GIVEN settings_diff enthaelt je einen Eintrag in allen vier
  //        Sub-Arrays (slotRoles, slotStrengths, modelId, modelParams)
  //       WHEN Card rendert
  //       THEN wird pro Sub-Array eine deklarative Zeile gerendert
  //            (z.B. slotRoles[0] -> "Slot 1 role: subject -> style"); jede
  //            Zeile referenziert from/to aus dem typed Schema; die
  //            Reihenfolge ist slotRoles -> slotStrengths -> modelId ->
  //            modelParams.
  // -------------------------------------------------------------------------
  it("AC-4: renders settings diff with slotRoles, slotStrengths, modelId, modelParams in order", () => {
    const payload = makePayloadWithFullSettingsDiff();
    render(
      <IntentSummaryCard
        payload={payload}
        frozen={false}
        onGenerate={vi.fn()}
        onDiscuss={vi.fn()}
      />
    );

    const diffSection = screen.getByTestId(
      "intent_summary_card.settings_diff"
    );
    expect(diffSection).toBeInTheDocument();

    const items = within(diffSection).getAllByRole("listitem");
    // Exactly one line per sub-array (4 total).
    expect(items).toHaveLength(4);

    // Each line references from/to from the typed schema.
    const texts = items.map((li) => li.textContent ?? "");

    // 1) slotRoles
    expect(texts[0]).toContain("Slot 1");
    expect(texts[0]).toContain("role");
    expect(texts[0]).toContain("subject");
    expect(texts[0]).toContain("style");
    expect(texts[0]).toMatch(/subject\s*→\s*style/);

    // 2) slotStrengths
    expect(texts[1]).toContain("Slot 2");
    expect(texts[1]).toContain("strength");
    expect(texts[1]).toContain("0.30");
    expect(texts[1]).toContain("0.75");

    // 3) modelId
    expect(texts[2]).toContain("Model");
    expect(texts[2]).toMatch(/flux-dev\s*→\s*flux-pro/);

    // 4) modelParams
    expect(texts[3]).toContain("guidance_scale");
    expect(texts[3]).toContain("7.5");
    expect(texts[3]).toContain("9");
  });

  // -------------------------------------------------------------------------
  // AC-5: GIVEN intentSummaryPayload.settings_diff ist undefined
  //       WHEN Card rendert (State no_settings_diff)
  //       THEN wird der gesamte Settings-Diff-Block ausgelassen (kein Header,
  //            kein Container); Card-Hoehe entsprechend kompakter.
  // -------------------------------------------------------------------------
  it("AC-5: omits settings diff section when payload.settings_diff is undefined", () => {
    const payload = makeFullAxesPayload();
    expect(payload.settings_diff).toBeUndefined();

    render(
      <IntentSummaryCard
        payload={payload}
        frozen={false}
        onGenerate={vi.fn()}
        onDiscuss={vi.fn()}
      />
    );

    // Settings-diff container must not exist at all.
    expect(
      screen.queryByTestId("intent_summary_card.settings_diff")
    ).not.toBeInTheDocument();

    // Header text "Settings diff" must not appear.
    expect(screen.queryByText(/Settings diff/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Frozen-state visual (supports AC-6): both buttons become disabled when
  // ``frozen`` prop is true.
  // -------------------------------------------------------------------------
  it("frozen prop disables both buttons (visual freeze treatment)", () => {
    const payload = makeFullAxesPayload();
    render(
      <IntentSummaryCard
        payload={payload}
        frozen={true}
        onGenerate={vi.fn()}
        onDiscuss={vi.fn()}
      />
    );

    const generateBtn = screen.getByTestId(
      "intent_summary_card.generate_btn"
    );
    const discussBtn = screen.getByTestId(
      "intent_summary_card.discuss_btn"
    );
    expect(generateBtn).toBeDisabled();
    expect(discussBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Generate-button slot (Slice 17 will wire the real handler): the card
  // must forward the click to the prop, but Slice 16 itself does NOT call
  // any generate-pipeline. Verifies the slot exists & forwards.
  // -------------------------------------------------------------------------
  it("renders generate_btn and forwards click to onGenerate prop (Slice 17 slot)", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    const payload = makeFullAxesPayload();
    render(
      <IntentSummaryCard
        payload={payload}
        frozen={false}
        onGenerate={onGenerate}
        onDiscuss={vi.fn()}
      />
    );

    const generateBtn = screen.getByTestId(
      "intent_summary_card.generate_btn"
    );
    expect(generateBtn).toBeInTheDocument();
    expect(generateBtn).not.toBeDisabled();
    await user.click(generateBtn);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Integration tests with PromptAssistantProvider (real reducer + dispatch
// chain) — exercises chat-thread mount/unmount + click-handlers.
// ===========================================================================

describe("IntentSummaryCard — provider integration (AC-6, AC-7, AC-8)", () => {
  // -------------------------------------------------------------------------
  // AC-8: GIVEN chat-thread.tsx rendert mit flowState !== "summarizing" UND
  //        kein History-Payload
  //       WHEN Render-Pass erfolgt
  //       THEN wird KEINE IntentSummaryCard gemountet (kein Element mit
  //            data-testid="intent_summary_card" im DOM).
  // -------------------------------------------------------------------------
  it("AC-8: does not render card when flowState is not summarizing and no history payload", () => {
    const messages: Message[] = [
      makeAssistantMessage("Hallo, was moechtest du erstellen?", "asst-1"),
    ];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // Default flowState is "idle"; no payload yet.
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent("idle");

    // Card MUST NOT exist.
    expect(
      screen.queryByTestId("intent_summary_card")
    ).not.toBeInTheDocument();
  });

  it("AC-8: does not render card when flowState is interviewing and no history payload", async () => {
    const messages: Message[] = [
      makeAssistantMessage("Erste Antwort", "asst-1"),
    ];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    await act(async () => {
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "interviewing",
      });
    });

    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "interviewing"
    );
    expect(
      screen.queryByTestId("intent_summary_card")
    ).not.toBeInTheDocument();
  });

  it("AC-8: does not render card when flowState is generating and no history payload", async () => {
    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={[]} />
      </PromptAssistantProvider>
    );

    await act(async () => {
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "generating",
      });
    });

    expect(
      screen.queryByTestId("intent_summary_card")
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-1 (provider variant): chat-thread renders exactly one card when the
  // FSM enters "summarizing" with a payload present.
  // -------------------------------------------------------------------------
  it("AC-1 (provider): chat-thread mounts a single card when FSM enters summarizing", async () => {
    const payload = makeFullAxesPayload();
    const messages: Message[] = [
      makeAssistantMessage("Lass uns kurz zusammenfassen.", "asst-1"),
    ];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // No card initially.
    expect(
      screen.queryByTestId("intent_summary_card")
    ).not.toBeInTheDocument();

    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    // Exactly one card now mounted, with both buttons active.
    const cards = screen.getAllByTestId("intent_summary_card");
    expect(cards).toHaveLength(1);
    expect(
      screen.getByTestId("intent_summary_card.generate_btn")
    ).not.toBeDisabled();
    expect(
      screen.getByTestId("intent_summary_card.discuss_btn")
    ).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // AC-6: GIVEN Card im State rendered (beide Buttons aktiv)
  //       WHEN User klickt intent_summary_card.discuss_btn
  //       THEN dispatcht der Handler SET_FLOW_STATE mit Payload
  //            "interviewing" UND ruft sendMessage("Was soll anders sein?");
  //            Card-Instanz bleibt im DOM (History-Erhalt) und wechselt in
  //            State history (beide Buttons werden via disabled-Attribut
  //            deaktiviert).
  // -------------------------------------------------------------------------
  it("AC-6: dispatches SET_FLOW_STATE('interviewing') and sendMessage on discuss click; card freezes", async () => {
    const user = userEvent.setup();
    const payload = makeFullAxesPayload();
    const messages: Message[] = [
      makeAssistantMessage("Vorschau folgt.", "asst-1"),
    ];

    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={messages} />
      </PromptAssistantProvider>
    );

    // Wire a sendMessage spy via the runtime ref slot — the provider's
    // ``sendMessage`` proxies to ``sendMessageRef.current``.
    const sendMessageSpy = vi.fn();
    await act(async () => {
      latestCtx!.sendMessageRef.current = sendMessageSpy;
    });

    // Bring the FSM into ``summarizing`` with a payload (mounts card).
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    // Click "Nochmal diskutieren" — actual click on the button element
    // (not just DOM existence per Interaction Tests guideline).
    const discussBtn = screen.getByTestId("intent_summary_card.discuss_btn");
    await user.click(discussBtn);

    // FSM transitioned to "interviewing".
    expect(screen.getByTestId("ctx-flow-state")).toHaveTextContent(
      "interviewing"
    );

    // sendMessage("Was soll anders sein?") was called. The provider's
    // ``sendMessage`` proxy forwards the optional ``imageUrls`` second
    // argument as ``undefined`` when the caller omits it — that's the
    // expected wire-shape of the Slice 16 discuss click.
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][0]).toBe("Was soll anders sein?");

    // Card-Instance still in DOM.
    expect(screen.getByTestId("intent_summary_card")).toBeInTheDocument();

    // Both buttons disabled (frozen state — visual treatment).
    expect(
      screen.getByTestId("intent_summary_card.discuss_btn")
    ).toBeDisabled();
    expect(
      screen.getByTestId("intent_summary_card.generate_btn")
    ).toBeDisabled();

    // ``data-frozen`` is exposed on the card root (visual-treatment marker).
    expect(screen.getByTestId("intent_summary_card")).toHaveAttribute(
      "data-frozen",
      "true"
    );
  });

  // -------------------------------------------------------------------------
  // AC-7: GIVEN bereits geklickte Card (State history)
  //       WHEN ein neuer Assistant-Turn nachfolgende Messages in den Thread
  //        einfuegt
  //       THEN bleibt die urspruengliche Card-Instanz weiterhin im DOM
  //            erhalten und sichtbar (Position oberhalb der neuen Messages,
  //            Buttons inaktiv); kein Unmount.
  // -------------------------------------------------------------------------
  it("AC-7: keeps card mounted after discuss click when subsequent messages arrive", async () => {
    const user = userEvent.setup();
    const payload = makeFullAxesPayload();

    // Wrapper that lets us mutate the messages array between renders.
    function Wrapper({ messages }: { messages: Message[] }) {
      return (
        <PromptAssistantProvider>
          <ChatThreadHarness messages={messages} />
        </PromptAssistantProvider>
      );
    }

    const initialMessages: Message[] = [
      makeAssistantMessage("Vorschau folgt.", "asst-1"),
    ];
    const { rerender } = render(<Wrapper messages={initialMessages} />);

    // Wire sendMessage spy (so click does not crash).
    await act(async () => {
      latestCtx!.sendMessageRef.current = vi.fn();
    });

    // Mount card.
    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    const cardBeforeClick = screen.getByTestId("intent_summary_card");
    expect(cardBeforeClick).toBeInTheDocument();

    // Click discuss → freeze.
    await user.click(
      screen.getByTestId("intent_summary_card.discuss_btn")
    );

    // Append a new assistant message (simulates a follow-up turn after the
    // discuss-click triggered a new "interviewing" round).
    const updatedMessages: Message[] = [
      ...initialMessages,
      makeAssistantMessage("Welche Aenderung schwebt dir vor?", "asst-2"),
    ];
    rerender(<Wrapper messages={updatedMessages} />);

    // Card still in DOM (no unmount), buttons remain disabled (history
    // freeze persists across re-render).
    const cardAfter = screen.getByTestId("intent_summary_card");
    expect(cardAfter).toBeInTheDocument();
    expect(cardAfter).toBeVisible();
    expect(
      screen.getByTestId("intent_summary_card.discuss_btn")
    ).toBeDisabled();
    expect(
      screen.getByTestId("intent_summary_card.generate_btn")
    ).toBeDisabled();

    // The new follow-up assistant bubble is also rendered.
    const assistantBubbles = screen.getAllByTestId("assistant-message");
    expect(
      assistantBubbles.some((b) =>
        b.textContent?.includes("Welche Aenderung schwebt dir vor?")
      )
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // AC-7 (extra): card is rendered ABOVE the new follow-up message — i.e.
  // anchored at its original position; not at the end of the thread.
  // -------------------------------------------------------------------------
  it("AC-7: card stays anchored at original position above newly-arrived messages", async () => {
    const user = userEvent.setup();
    const payload = makeFullAxesPayload();

    function Wrapper({ messages }: { messages: Message[] }) {
      return (
        <PromptAssistantProvider>
          <ChatThreadHarness messages={messages} />
        </PromptAssistantProvider>
      );
    }

    const initialMessages: Message[] = [
      makeAssistantMessage("Erste Antwort", "asst-1"),
    ];
    const { rerender } = render(<Wrapper messages={initialMessages} />);

    await act(async () => {
      latestCtx!.sendMessageRef.current = vi.fn();
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    await user.click(
      screen.getByTestId("intent_summary_card.discuss_btn")
    );

    // Add a follow-up message AFTER the card was anchored.
    const updatedMessages: Message[] = [
      ...initialMessages,
      makeAssistantMessage("Folge-Antwort", "asst-followup"),
    ];
    rerender(<Wrapper messages={updatedMessages} />);

    // DOM order: the card must precede the follow-up bubble.
    const card = screen.getByTestId("intent_summary_card");
    const followUp = screen
      .getAllByTestId("assistant-message")
      .find((b) => b.textContent?.includes("Folge-Antwort"))!;

    expect(followUp).toBeDefined();
    // ``compareDocumentPosition`` returns 4 when ``card`` precedes
    // ``followUp`` in document order (DOCUMENT_POSITION_FOLLOWING).
    // The bitmask check (& 4) is robust against extra flags.
    expect(
      card.compareDocumentPosition(followUp) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // AC-1 + AC-2 + AC-3 + AC-5 (provider variant): minimal payload (only
  // subject+style, no settings_diff) propagates correctly through the
  // provider → chat-thread → card render chain.
  // -------------------------------------------------------------------------
  it("AC-1+AC-2+AC-5 (provider): minimal payload renders only present axes and omits diff", async () => {
    const payload = makeMinimalAxesPayload();
    render(
      <PromptAssistantProvider>
        <ChatThreadHarness messages={[]} />
      </PromptAssistantProvider>
    );

    await act(async () => {
      latestCtx!.dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
      latestCtx!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
    });

    expect(screen.getByTestId("intent_summary_card")).toBeInTheDocument();
    expect(
      screen.getByTestId("intent_summary_card.axis.subject")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("intent_summary_card.axis.style")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("intent_summary_card.axis.medium")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("intent_summary_card.settings_diff")
    ).not.toBeInTheDocument();

    // Prompt preview still rendered.
    expect(
      screen.getByTestId("intent_summary_card.prompt_preview")
    ).toHaveTextContent(payload.prompt_preview);
  });
});
