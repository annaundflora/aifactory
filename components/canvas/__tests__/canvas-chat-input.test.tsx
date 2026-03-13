// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy -- only icons and crypto)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  ArrowUp: (props: Record<string, unknown>) => (
    <span data-testid="arrow-up-icon" {...props} />
  ),
  MessageSquare: (props: Record<string, unknown>) => (
    <span data-testid="message-square-icon" {...props} />
  ),
  Minus: (props: Record<string, unknown>) => (
    <span data-testid="minus-icon" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="plus-icon" {...props} />
  ),
}));

// Mock the canvas chat service (backend calls)
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn().mockReturnValue((async function* () {})()),
}));

// Mock the generateImages server action
vi.mock("@/app/actions/generations", () => ({
  generateImages: vi.fn().mockResolvedValue([]),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Stable crypto.randomUUID for deterministic test IDs
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Import AFTER mocks
import { CanvasChatInput } from "@/components/canvas/canvas-chat-input";
import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { type Generation } from "@/lib/db/queries";

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
 * Renders the full CanvasChatPanel (includes CanvasChatInput) in CanvasDetailProvider.
 * Used for integration-level input tests where we verify messages appear in the chat.
 */
function renderChatPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-input-test" });
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
      />
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  /**
   * AC-10: GIVEN das Chat-Panel ist expanded
   *        WHEN das Input-Feld geprueft wird
   *        THEN zeigt es ein Textfeld mit Placeholder "Describe changes..."
   *             und einen Send-Button rechts
   */
  it('AC-10: should render text input with placeholder "Describe changes..." and send button', () => {
    const onSend = vi.fn();
    render(<CanvasChatInput onSend={onSend} />);

    // Textarea with correct placeholder
    const textarea = screen.getByTestId("canvas-chat-input-textarea");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("placeholder", "Describe changes...");

    // Send button exists
    const sendButton = screen.getByTestId("canvas-chat-send-button");
    expect(sendButton).toBeInTheDocument();
    expect(sendButton).toHaveAttribute("aria-label", "Send message");
  });

  /**
   * AC-10 (send button initially disabled): Send button should be disabled
   * when input is empty.
   */
  it("AC-10: should have send button disabled when input is empty", () => {
    const onSend = vi.fn();
    render(<CanvasChatInput onSend={onSend} />);

    const sendButton = screen.getByTestId("canvas-chat-send-button");
    expect(sendButton).toBeDisabled();
  });

  /**
   * AC-11: GIVEN der User tippt Text in das Chat-Input und klickt Send
   *        WHEN die Nachricht gesendet wird
   *        THEN erscheint der Text als neue User-Message in der History
   *             und das Input-Feld wird geleert
   */
  it("AC-11: should add user message to history and clear input on send", async () => {
    const user = userEvent.setup();

    renderChatPanel();

    const textarea = screen.getByTestId("canvas-chat-input-textarea");
    const sendButton = screen.getByTestId("canvas-chat-send-button");

    // Type a message
    await user.type(textarea, "Make the sky more blue");

    // Send button should now be enabled
    expect(sendButton).not.toBeDisabled();

    // Click send
    await user.click(sendButton);

    // User message should appear in the message area
    const userMessage = screen.getByTestId("user-message");
    expect(userMessage).toBeInTheDocument();
    expect(userMessage).toHaveTextContent("Make the sky more blue");

    // Input field should be cleared
    expect(textarea).toHaveValue("");
  });

  /**
   * AC-11 (Enter key): GIVEN der User tippt Text in das Chat-Input und drueckt Enter
   *        WHEN die Nachricht gesendet wird
   *        THEN erscheint der Text als neue User-Message in der History
   *             und das Input-Feld wird geleert
   */
  it("AC-11: should send message when Enter key is pressed", async () => {
    const user = userEvent.setup();

    renderChatPanel();

    const textarea = screen.getByTestId("canvas-chat-input-textarea");

    // Type and press Enter
    await user.type(textarea, "Adjust contrast{enter}");

    // User message should appear
    const userMessage = screen.getByTestId("user-message");
    expect(userMessage).toBeInTheDocument();
    expect(userMessage).toHaveTextContent("Adjust contrast");

    // Input should be cleared
    expect(textarea).toHaveValue("");
  });

  /**
   * AC-11 (Shift+Enter does NOT send): Shift+Enter should insert a newline,
   * not send the message.
   */
  it("AC-11: should not send message on Shift+Enter (allows newline)", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<CanvasChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("canvas-chat-input-textarea");

    // Type text, then Shift+Enter
    await user.type(textarea, "line one{shift>}{enter}{/shift}line two");

    // Should NOT have sent
    expect(onSend).not.toHaveBeenCalled();

    // Textarea should still have content
    expect(textarea).toHaveValue("line one\nline two");
  });

  /**
   * AC-11 (empty input): Sending empty or whitespace-only text should be prevented.
   */
  it("AC-11: should not send when input is empty or whitespace", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<CanvasChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("canvas-chat-input-textarea");
    const sendButton = screen.getByTestId("canvas-chat-send-button");

    // Try clicking send with empty input
    await user.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();

    // Type only spaces
    await user.type(textarea, "   ");
    await user.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });

  /**
   * AC-10 (disabled state): Input should be disabled when disabled prop is true.
   */
  it("AC-10: should disable textarea and send button when disabled prop is true", () => {
    const onSend = vi.fn();
    render(<CanvasChatInput onSend={onSend} disabled={true} />);

    const textarea = screen.getByTestId("canvas-chat-input-textarea");
    expect(textarea).toBeDisabled();

    const sendButton = screen.getByTestId("canvas-chat-send-button");
    expect(sendButton).toBeDisabled();
  });
});
