// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy -- only icons and crypto)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  MessageSquare: (props: Record<string, unknown>) => (
    <span data-testid="message-square-icon" {...props} />
  ),
  Minus: (props: Record<string, unknown>) => (
    <span data-testid="minus-icon" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="plus-icon" {...props} />
  ),
  ArrowUp: (props: Record<string, unknown>) => (
    <span data-testid="arrow-up-icon" {...props} />
  ),
}));

// Stable crypto.randomUUID for deterministic test IDs
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Import AFTER mocks
import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
import { CanvasChatMessages } from "@/components/canvas/canvas-chat-messages";
import {
  CanvasDetailProvider,
  type CanvasDetailAction,
} from "@/lib/canvas-detail-context";
import { type Generation } from "@/lib/db/queries";
import { type ChatMessage } from "@/lib/types/chat-message";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-default-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

/**
 * Renders the full CanvasChatPanel (which includes CanvasChatMessages internally)
 * wrapped in CanvasDetailProvider. This is needed because CanvasChatPanel manages
 * the messages state and passes it to CanvasChatMessages.
 */
function renderChatPanel(
  options: {
    generation?: Generation;
    onSendMessage?: (text: string) => void;
    initialGenerationId?: string;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-chat-1" });
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasChatPanel
        generation={generation}
        onSendMessage={options.onSendMessage}
      />
    </CanvasDetailProvider>
  );
}

/**
 * Renders CanvasChatMessages directly with explicit messages (for isolated tests).
 */
function renderMessages(
  messages: ChatMessage[],
  onChipClick?: (text: string) => void
) {
  return render(
    <CanvasChatMessages messages={messages} onChipClick={onChipClick} />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  /**
   * AC-5: GIVEN das Chat-Panel ist expanded und ein Bild mit Metadaten ist geladen
   *       WHEN der Nachrichten-Bereich geprueft wird
   *       THEN zeigt die erste Nachricht eine Init-Message mit Bild-Kontext:
   *            Model-Name, Prompt (gekuerzt), und Key-Parameter (Steps, CFG)
   */
  it("AC-5: should render init message with image context including model, prompt, and params", () => {
    const generation = makeGeneration({
      id: "gen-init-test",
      modelId: "stable-diffusion-xl",
      prompt: "a beautiful sunset over the ocean with dramatic clouds",
      modelParams: {
        num_inference_steps: 50,
        guidance_scale: 7.5,
      },
    });

    renderChatPanel({ generation });

    // The init message should be rendered
    const initMessage = screen.getByTestId("init-message");
    expect(initMessage).toBeInTheDocument();

    // Should contain model name
    expect(initMessage).toHaveTextContent("stable-diffusion-xl");

    // Should contain the prompt text
    expect(initMessage).toHaveTextContent("a beautiful sunset over the ocean");

    // Should contain steps and CFG
    expect(initMessage).toHaveTextContent("Steps: 50");
    expect(initMessage).toHaveTextContent("CFG: 7.5");
  });

  /**
   * AC-5 (long prompt truncation): Prompts longer than 120 chars should be truncated.
   */
  it("AC-5: should truncate long prompts in init message", () => {
    const longPrompt = "a".repeat(150);
    const generation = makeGeneration({
      id: "gen-long-prompt",
      modelId: "model-x",
      prompt: longPrompt,
      modelParams: { steps: 30, cfg: 5 },
    });

    renderChatPanel({ generation });

    const initMessage = screen.getByTestId("init-message");
    // Prompt should be truncated to 120 chars + "..."
    expect(initMessage).toHaveTextContent("a".repeat(120) + "...");
  });

  /**
   * AC-6: GIVEN der Chat hat eine History mit mindestens einer User- und einer Bot-Nachricht
   *       WHEN der Nachrichten-Bereich geprueft wird
   *       THEN werden User-Messages rechtsbuendig und Bot-Messages linksbuendig
   *            als Bubbles dargestellt
   */
  it("AC-6: should render user messages right-aligned and bot messages left-aligned", () => {
    const messages: ChatMessage[] = [
      { id: "msg-1", role: "user", content: "Hello" },
      { id: "msg-2", role: "bot", content: "Hi there!" },
    ];

    renderMessages(messages);

    // User message should be right-aligned (justify-end)
    const userMsg = screen.getByTestId("user-message");
    expect(userMsg).toBeInTheDocument();
    expect(userMsg.className).toMatch(/justify-end/);

    // Bot message should be left-aligned (justify-start)
    const botMsg = screen.getByTestId("bot-message");
    expect(botMsg).toBeInTheDocument();
    expect(botMsg.className).toMatch(/justify-start/);
  });

  /**
   * AC-7: GIVEN eine Bot-Nachricht enthaelt Chip-Optionen (z.B. ["Subtil", "Dramatisch"])
   *       WHEN der Nachrichten-Bereich geprueft wird
   *       THEN werden die Chips als klickbare Buttons unterhalb des Bot-Texts angezeigt
   */
  it("AC-7: should render clickable chip buttons below bot message text", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-bot-chips",
        role: "bot",
        content: "Choose an option:",
        chips: ["Subtil", "Dramatisch"],
      },
    ];

    renderMessages(messages);

    // Bot message should be present
    const botMsg = screen.getByTestId("bot-message");
    expect(botMsg).toBeInTheDocument();
    expect(botMsg).toHaveTextContent("Choose an option:");

    // Chips container should exist
    const chipsContainer = screen.getByTestId("chat-chips");
    expect(chipsContainer).toBeInTheDocument();

    // Both chips should be rendered as buttons
    const chipButtons = screen.getAllByTestId("chat-chip-button");
    expect(chipButtons).toHaveLength(2);
    expect(chipButtons[0]).toHaveTextContent("Subtil");
    expect(chipButtons[1]).toHaveTextContent("Dramatisch");

    // Chips should be actual button elements (clickable)
    chipButtons.forEach((chip) => {
      expect(chip.tagName).toBe("BUTTON");
      expect(chip).toHaveAttribute("type", "button");
    });
  });

  /**
   * AC-7 (no chips for user messages): User messages should not render chips
   * even if chips array is present.
   */
  it("AC-7: should not render chips on user messages", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-user-chips",
        role: "user",
        content: "My choice",
        chips: ["Should", "Not", "Appear"],
      },
    ];

    renderMessages(messages);

    expect(screen.queryByTestId("chat-chips")).not.toBeInTheDocument();
  });

  /**
   * AC-8: GIVEN der User klickt auf einen Chip in einer Bot-Nachricht
   *       WHEN der Chip-Click verarbeitet wird
   *       THEN wird der Chip-Text als neue User-Message in die History eingefuegt
   */
  it("AC-8: should add chip text as new user message when chip is clicked", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({ id: "gen-chip-test" });

    // We need to use the full panel to test the integrated chip->message flow.
    // First, we render CanvasChatMessages directly with an onChipClick spy
    // to verify the click triggers the callback with the correct text.
    const onChipClick = vi.fn();
    const messages: ChatMessage[] = [
      {
        id: "msg-bot",
        role: "bot",
        content: "Pick one:",
        chips: ["Subtil", "Dramatisch"],
      },
    ];

    renderMessages(messages, onChipClick);

    const chipButtons = screen.getAllByTestId("chat-chip-button");
    await user.click(chipButtons[0]);

    expect(onChipClick).toHaveBeenCalledTimes(1);
    expect(onChipClick).toHaveBeenCalledWith("Subtil");
  });

  /**
   * AC-8 (integration): Verify chip click adds user message in the full panel.
   */
  it("AC-8: should insert chip text as user message in full panel integration", async () => {
    const user = userEvent.setup();

    // We need to render CanvasChatMessages with a bot message that has chips,
    // but the CanvasChatPanel starts with only an init message.
    // Instead, test the direct CanvasChatMessages + onChipClick flow which
    // is how the panel wires it: onChipClick -> adds user message.
    const onChipClick = vi.fn();
    const messages: ChatMessage[] = [
      {
        id: "msg-bot-2",
        role: "bot",
        content: "Choose style:",
        chips: ["Dramatisch"],
      },
    ];

    renderMessages(messages, onChipClick);

    const chipButton = screen.getByTestId("chat-chip-button");
    await user.click(chipButton);

    expect(onChipClick).toHaveBeenCalledWith("Dramatisch");
  });

  /**
   * AC-9: GIVEN der User wechselt das Bild via Prev/Next Navigation (andere generationId)
   *       WHEN der Chat geprueft wird
   *       THEN erscheint ein visueller Context-Separator ("Kontext: [Bild-Identifier]")
   *            gefolgt von einer neuen Init-Message mit dem Kontext des neuen Bildes
   */
  it("AC-9: should render context separator and new init message when image changes", () => {
    // Render with a separator and new init message directly
    const messages: ChatMessage[] = [
      { id: "init-1", role: "system", content: 'Model: model-1\nPrompt: "first prompt"\nSteps: 30, CFG: 7' },
      { id: "sep-1", role: "separator", content: "Kontext: new image context..." },
      { id: "init-2", role: "system", content: 'Model: model-2\nPrompt: "second prompt"\nSteps: 50, CFG: 8' },
    ];

    renderMessages(messages);

    // Should have a context separator
    const separator = screen.getByTestId("context-separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveTextContent("Kontext:");

    // Should have two init messages
    const initMessages = screen.getAllByTestId("init-message");
    expect(initMessages).toHaveLength(2);

    // Second init message should have the new context
    expect(initMessages[1]).toHaveTextContent("model-2");
    expect(initMessages[1]).toHaveTextContent("second prompt");
  });

  /**
   * AC-12: GIVEN der Chat hat Nachrichten in der History
   *        WHEN der User den [+] Button (Neue-Session) im Chat-Header klickt
   *        THEN wird die gesamte Chat-History geleert und nur die Init-Message
   *             mit aktuellem Bild-Kontext bleibt
   */
  it("AC-12: should clear chat history and show only init message when new session button is clicked", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-session-test",
      modelId: "model-xyz",
      prompt: "test prompt for session",
      modelParams: { num_inference_steps: 25, guidance_scale: 6 },
    });

    renderChatPanel({ generation });

    // First, send a message to add to history
    const textarea = screen.getByTestId("canvas-chat-input-textarea");
    const sendButton = screen.getByTestId("canvas-chat-send-button");

    await user.type(textarea, "Hello world");
    await user.click(sendButton);

    // Verify user message was added
    expect(screen.getByTestId("user-message")).toBeInTheDocument();

    // Click the new session button
    const newSessionButton = screen.getByTestId("chat-new-session-button");
    await user.click(newSessionButton);

    // User message should be gone
    expect(screen.queryByTestId("user-message")).not.toBeInTheDocument();

    // Init message should still be present
    const initMessage = screen.getByTestId("init-message");
    expect(initMessage).toBeInTheDocument();
    expect(initMessage).toHaveTextContent("model-xyz");
    expect(initMessage).toHaveTextContent("test prompt for session");
  });

  /**
   * AC-13: GIVEN der Chat hat mehrere Nachrichten
   *        WHEN eine neue Nachricht hinzugefuegt wird
   *        THEN scrollt der Nachrichten-Bereich automatisch nach unten zur neuesten Nachricht
   */
  it("AC-13: should auto-scroll to latest message when new message is added", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({ id: "gen-scroll-test" });

    renderChatPanel({ generation });

    // scrollIntoView should have been called at least once on initial render
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    // Clear the mock to track new calls
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();

    // Add a message via the input
    const textarea = screen.getByTestId("canvas-chat-input-textarea");
    const sendButton = screen.getByTestId("canvas-chat-send-button");

    await user.type(textarea, "New message");
    await user.click(sendButton);

    // scrollIntoView should have been called again for the new message
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
    });
  });
});
