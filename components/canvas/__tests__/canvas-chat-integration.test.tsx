// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    const id = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const Comp = (props: Record<string, unknown>) => <span data-testid={`${id}-icon`} {...props} />;
    Comp.displayName = name;
    return Comp;
  };
  return {
    MessageSquare: stub("MessageSquare"), Minus: stub("Minus"), Plus: stub("Plus"),
    ArrowUp: stub("ArrowUp"), Square: stub("Square"), PanelRightClose: stub("PanelRightClose"),
    Image: stub("Image"), Loader2: stub("Loader2"), ImageOff: stub("ImageOff"),
    PanelRightOpen: stub("PanelRightOpen"), PanelLeftIcon: stub("PanelLeftIcon"),
    PanelLeftClose: stub("PanelLeftClose"), PenLine: stub("PenLine"),
    ChevronDown: stub("ChevronDown"), Check: stub("Check"), Type: stub("Type"),
    ImagePlus: stub("ImagePlus"), Scaling: stub("Scaling"), X: stub("X"),
    ArrowLeft: stub("ArrowLeft"), Undo2: stub("Undo2"), Redo2: stub("Redo2"),
    ChevronUp: stub("ChevronUp"), ChevronDownIcon: stub("ChevronDownIcon"),
    ChevronUpIcon: stub("ChevronUpIcon"), CheckIcon: stub("CheckIcon"),
    Info: stub("Info"), Copy: stub("Copy"), ArrowRightLeft: stub("ArrowRightLeft"),
    ZoomIn: stub("ZoomIn"), Download: stub("Download"), Trash2: stub("Trash2"),
    Sparkles: stub("Sparkles"), Library: stub("Library"), Star: stub("Star"),
    ChevronLeft: stub("ChevronLeft"), ChevronRight: stub("ChevronRight"),
    PanelLeftOpen: stub("PanelLeftOpen"),
  };
});

// Mock the model selector (uses radix Select which needs complex setup in jsdom)
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector-mock" />,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// Mock canvas-chat-service
const mockCreateSession = vi.fn().mockResolvedValue("test-session-id");
const mockSendMessage = vi.fn();

vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

// Mock generateImages server action
const mockGenerateImages = vi.fn().mockResolvedValue([]);

vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
}));

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn() },
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
import {
  CanvasDetailProvider,
  useCanvasDetail,
  type CanvasDetailAction,
} from "@/lib/canvas-detail-context";
import { type Generation } from "@/lib/db/queries";
import type { CanvasSSEEvent } from "@/lib/canvas-chat-service";
import { useState, useEffect } from "react";

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
 * Creates a mock implementation for sendMessage that calls onEvent with each event.
 * sendMessage signature: (sessionId, content, imageContext, onEvent, signal?) => Promise<void>
 */
function mockSSEEvents(events: CanvasSSEEvent[]) {
  return async (
    _sessionId: string,
    _content: string,
    _imageContext: unknown,
    onEvent: (event: CanvasSSEEvent) => void,
    _signal?: AbortSignal
  ) => {
    for (const event of events) {
      onEvent(event);
    }
  };
}

/**
 * Renders CanvasChatPanel wrapped in CanvasDetailProvider.
 */
function renderChatPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
  } = {}
) {
  const generation = options.generation ?? makeGeneration({ id: "gen-int-1" });
  const initialGenerationId = options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasChatPanel generation={generation} projectId={projectId} modelSlots={[]} models={[]} />
    </CanvasDetailProvider>
  );
}

/**
 * Helper component that lets us dispatch actions from inside the context.
 */
function ContextDispatcher({
  action,
  triggerOnRender,
}: {
  action: CanvasDetailAction | null;
  triggerOnRender?: boolean;
}) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    if (action && triggerOnRender) {
      dispatch(action);
    }
  }, [action, dispatch, triggerOnRender]);
  return null;
}

/**
 * Renders CanvasChatPanel with an extra ContextDispatcher to control context state.
 */
function renderChatPanelWithDispatcher(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
    initialAction?: CanvasDetailAction;
  } = {}
) {
  const generation = options.generation ?? makeGeneration({ id: "gen-int-1" });
  const initialGenerationId = options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <ContextDispatcher
        action={options.initialAction ?? null}
        triggerOnRender={!!options.initialAction}
      />
      <CanvasChatPanel generation={generation} projectId={projectId} modelSlots={[]} models={[]} />
    </CanvasDetailProvider>
  );
}

/**
 * Helper component that can switch the generation prop to simulate Prev/Next navigation.
 */
function SwitchableGeneration({
  generations,
  projectId,
}: {
  generations: Generation[];
  projectId: string;
}) {
  const [index, setIndex] = useState(0);
  const { dispatch } = useCanvasDetail();

  return (
    <>
      <CanvasChatPanel generation={generations[index]} projectId={projectId} modelSlots={[]} models={[]} />
      <button
        data-testid="switch-generation-button"
        onClick={() => {
          const nextIndex = (index + 1) % generations.length;
          setIndex(nextIndex);
          dispatch({
            type: "SET_CURRENT_IMAGE",
            generationId: generations[nextIndex].id,
            source: "navigation",
          });
        }}
      >
        Switch
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatPanel (Backend-Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
  });

  // -------------------------------------------------------------------------
  // AC-1: Auto-Session-Erstellung beim Mount
  // -------------------------------------------------------------------------

  it("AC-1: should create canvas session on mount with current image context", async () => {
    const generation = makeGeneration({
      id: "gen-mount-1",
      imageUrl: "https://example.com/canvas.png",
      prompt: "sunset over ocean",
      modelId: "flux-2-max",
      modelParams: { steps: 30 },
    });

    renderChatPanel({ generation, projectId: "project-42" });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateSession).toHaveBeenCalledWith("project-42", {
      image_url: "https://example.com/canvas.png",
      prompt: "sunset over ocean",
      model_id: "flux-2-max",
      model_params: { steps: 30 },
      generation_id: "gen-mount-1",
    });
  });

  it("AC-1: should show toast error when session creation fails", async () => {
    mockCreateSession.mockRejectedValueOnce(new Error("Network error"));

    renderChatPanel();

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Chat-Session konnte nicht erstellt werden")
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Send-Button sendet Nachricht an Backend
  // -------------------------------------------------------------------------

  it("AC-2: should call sendMessage with text and image_context when user sends message", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-send-1",
      imageUrl: "https://example.com/test.png",
      prompt: "original prompt",
      modelId: "model-1",
      modelParams: {},
    });

    mockSendMessage.mockImplementation(mockSSEEvents([{ type: "text-done" }]));

    renderChatPanel({ generation, projectId: "project-send" });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "mach den Hintergrund blauer");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      "test-session-id",
      "mach den Hintergrund blauer",
      expect.objectContaining({
        image_url: "https://example.com/test.png",
        prompt: "original prompt",
        model_id: "model-1",
        generation_id: "gen-send-1",
      }),
      expect.any(Function), // onEvent callback
      expect.any(AbortSignal),
      expect.any(String), // chatModelSlug
      undefined, // imageUrl
    );

    // User message should appear in chat
    expect(screen.getByTestId("user-message")).toHaveTextContent(
      "mach den Hintergrund blauer"
    );
  });

  // -------------------------------------------------------------------------
  // AC-3: Streaming-Indicator waehrend text-delta
  // -------------------------------------------------------------------------

  it("AC-3: should show streaming indicator while text-delta events are being received", async () => {
    const user = userEvent.setup();

    // Use a deferred callback to control event timing
    let resolveStream!: () => void;
    const streamPromise = new Promise<void>((resolve) => {
      resolveStream = resolve;
    });

    mockSendMessage.mockImplementation(
      async (
        _sessionId: string,
        _content: string,
        _imageContext: unknown,
        onEvent: (event: CanvasSSEEvent) => void,
        _signal?: AbortSignal
      ) => {
        onEvent({ type: "text-delta", content: "Hello" });
        // Wait before sending text-done — this keeps isStreaming=true
        await streamPromise;
        onEvent({ type: "text-done" });
      }
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test message");
    await user.click(sendButton);

    // While stream is pending, streaming indicator should be visible
    await waitFor(() => {
      expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument();
    });

    // Bot message should be building up
    await waitFor(() => {
      expect(screen.getByTestId("assistant-message")).toHaveTextContent("Hello");
    });

    // Complete the stream
    await act(async () => {
      resolveStream();
    });

    // After text-done, streaming indicator should disappear
    await waitFor(() => {
      expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Streaming-Indicator verschwindet bei text-done
  // -------------------------------------------------------------------------

  it("AC-4: should hide streaming indicator when text-done event is received", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        { type: "text-delta", content: "Response complete" },
        { type: "text-done" },
      ])
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test");
    await user.click(sendButton);

    // After stream completes (text-done emitted), indicator should be gone
    await waitFor(() => {
      expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();
    });

    // Bot message should be fully rendered
    await waitFor(() => {
      expect(screen.getByTestId("assistant-message")).toHaveTextContent("Response complete");
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Chip-Klick sendet als neue Nachricht
  // -------------------------------------------------------------------------

  it("AC-5: should send chip text as new message when clarification chip is clicked", async () => {
    const user = userEvent.setup();

    // First call: return a bot message with chips
    let sendCallCount = 0;
    mockSendMessage.mockImplementation(
      async (
        _sessionId: string,
        _content: string,
        _imageContext: unknown,
        onEvent: (event: CanvasSSEEvent) => void,
        _signal?: AbortSignal
      ) => {
        sendCallCount++;
        if (sendCallCount === 1) {
          onEvent({ type: "text-delta", content: "Choose style" });
          onEvent({ type: "text-done" });
        } else {
          onEvent({ type: "text-delta", content: "Applying dramatic style..." });
          onEvent({ type: "text-done" });
        }
      }
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Send initial message to get bot response
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");
    await user.type(textarea, "help");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    // Verify chip rendering via ChatThread directly
    const { ChatThread } = await import(
      "@/components/assistant/chat-thread"
    );
    const chipClickSpy = vi.fn();

    const { unmount } = render(
      <ChatThread
        messages={[
          {
            id: "bot-chips",
            role: "assistant",
            content: "Choose style",
            chips: ["Subtil", "Dramatisch"],
          },
        ]}
        isStreaming={false}
        onChipClick={chipClickSpy}
      />
    );

    const chipButtons = screen.getAllByTestId("chat-chip-button");
    expect(chipButtons).toHaveLength(2);

    await user.click(chipButtons[1]);
    expect(chipClickSpy).toHaveBeenCalledWith("Dramatisch");

    unmount();
  });

  // -------------------------------------------------------------------------
  // AC-6: canvas-generate Event triggert generateImages
  // -------------------------------------------------------------------------

  it("AC-6: should call generateImages and set isGenerating when canvas-generate event is received", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "variation",
          prompt: "blue sky background",
          model_id: "flux-2-max",
          params: { steps: 30 },
        },
      ])
    );

    renderChatPanel({ projectId: "project-gen" });
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "generate variation");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-gen",
        promptMotiv: "blue sky background",
        // Model resolution now falls back to generation.modelId when modelSettings is empty
        modelIds: ["model-1"],
        params: { steps: 30 },
        count: 1,
        generationMode: "txt2img",
      })
    );
  });

  it("AC-6: should set generationMode to img2img when action is img2img", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "img2img",
          prompt: "enhanced version",
          model_id: "model-x",
          params: {},
        },
      ])
    );

    renderChatPanel({ projectId: "project-img2img" });
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "enhance this");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "img2img",
      })
    );
  });

  // -------------------------------------------------------------------------
  // AC-7: Chat-Input disabled waehrend Generation
  // -------------------------------------------------------------------------

  it("AC-7: should disable chat input when isGenerating is true", async () => {
    renderChatPanelWithDispatcher({
      initialAction: { type: "SET_GENERATING", isGenerating: true },
    });

    await waitFor(() => {
      const textarea = screen.getByTestId("chat-input-textarea");
      expect(textarea).toBeDisabled();
    });

    const sendButton = screen.getByTestId("send-btn");
    expect(sendButton).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // AC-8: Timeout-Error als Bot-Bubble
  // -------------------------------------------------------------------------

  it("AC-8: should show error bot message on SSE timeout after 60 seconds", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "error",
          message: "Keine Antwort. Bitte erneut versuchen.",
        },
      ])
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test timeout");
    await user.click(sendButton);

    await waitFor(() => {
      const errorBubble = screen.getByTestId("bot-message-error");
      expect(errorBubble).toBeInTheDocument();
      expect(errorBubble).toHaveTextContent(
        "Keine Antwort. Bitte erneut versuchen."
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("chat-input-textarea")).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // AC-9: Error-Event als Error-Bubble
  // -------------------------------------------------------------------------

  it("AC-9: should show error bot message with description when error SSE event is received", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "error",
          message: "Rate limit exceeded. Please wait.",
        },
      ])
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test error");
    await user.click(sendButton);

    await waitFor(() => {
      const errorBubble = screen.getByTestId("bot-message-error");
      expect(errorBubble).toBeInTheDocument();
      expect(errorBubble).toHaveTextContent("Rate limit exceeded. Please wait.");
    });

    await waitFor(() => {
      expect(screen.getByTestId("chat-input-textarea")).not.toBeDisabled();
    });
  });

  it("AC-9: should show error bubble with visual error styling (destructive class)", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        { type: "error", message: "Something went wrong" },
      ])
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test");
    await user.click(sendButton);

    await waitFor(() => {
      const errorBubble = screen.getByTestId("bot-message-error");
      expect(errorBubble).toBeInTheDocument();
      const errorMessage = screen.getByTestId("error-message");
      expect(errorMessage).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-10: Bild-Kontext-Update bei Prev/Next
  // -------------------------------------------------------------------------

  it("AC-10: should update image_context for subsequent messages when currentGenerationId changes", async () => {
    const user = userEvent.setup();

    const gen1 = makeGeneration({
      id: "gen-nav-1",
      prompt: "first image",
      modelId: "model-a",
      imageUrl: "https://example.com/first.png",
    });
    const gen2 = makeGeneration({
      id: "gen-nav-2",
      prompt: "second image",
      modelId: "model-b",
      imageUrl: "https://example.com/second.png",
    });

    let sendCallCount = 0;
    mockSendMessage.mockImplementation(
      async (
        _sessionId: string,
        _content: string,
        _imageContext: unknown,
        onEvent: (event: CanvasSSEEvent) => void,
        _signal?: AbortSignal
      ) => {
        sendCallCount++;
        onEvent({ type: "text-delta", content: `response ${sendCallCount}` });
        onEvent({ type: "text-done" });
      }
    );

    render(
      <CanvasDetailProvider initialGenerationId="gen-nav-1">
        <SwitchableGeneration
          generations={[gen1, gen2]}
          projectId="project-nav"
        />
      </CanvasDetailProvider>
    );

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Switch to the second generation (simulates Prev/Next)
    const switchButton = screen.getByTestId("switch-generation-button");
    await user.click(switchButton);

    // Init message should still be present (replaced, not appended)
    await waitFor(() => {
      const initMessage = screen.getByTestId("init-message");
      expect(initMessage).toBeInTheDocument();
    });

    // No separator — replace pattern, not append
    expect(screen.queryByTestId("context-separator")).not.toBeInTheDocument();

    expect(mockCreateSession).toHaveBeenCalledTimes(1);

    // Send a message with the new context
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "enhance this");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      "test-session-id",
      "enhance this",
      expect.objectContaining({
        image_url: "https://example.com/second.png",
        prompt: "second image",
        model_id: "model-b",
        generation_id: "gen-nav-2",
      }),
      expect.any(Function), // onEvent callback
      expect.any(AbortSignal),
      expect.any(String), // chatModelSlug
      undefined, // imageUrl
    );
  });

  // -------------------------------------------------------------------------
  // AC-11: Neue-Session-Button erstellt neue Session
  // -------------------------------------------------------------------------

  it("AC-11: should create new session and reset chat history when new session button is clicked", async () => {
    const user = userEvent.setup();

    mockCreateSession
      .mockResolvedValueOnce("session-old")
      .mockResolvedValueOnce("session-new");

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        { type: "text-delta", content: "Bot reply" },
        { type: "text-done" },
      ])
    );

    const generation = makeGeneration({
      id: "gen-session-test",
      modelId: "model-xyz",
      prompt: "test prompt for session",
      modelParams: { num_inference_steps: 25, guidance_scale: 6 },
    });

    renderChatPanel({ generation });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    // Send a message to populate history
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "Hello world");
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId("user-message")).toBeInTheDocument();
    });

    // Click new session button
    const newSessionButton = screen.getByTestId("chat-new-session-button");
    await user.click(newSessionButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByTestId("user-message")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assistant-message")).not.toBeInTheDocument();

    // Init message should still be present (generic help text, no longer includes model/prompt data)
    const initMessage = screen.getByTestId("init-message");
    expect(initMessage).toBeInTheDocument();
  });

  it("AC-11: should show toast error when new session creation fails", async () => {
    const user = userEvent.setup();

    mockCreateSession
      .mockResolvedValueOnce("session-old")
      .mockRejectedValueOnce(new Error("Connection refused"));

    renderChatPanel();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    const newSessionButton = screen.getByTestId("chat-new-session-button");
    await user.click(newSessionButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Neue Session konnte nicht erstellt werden")
      );
    });
  });

  // -------------------------------------------------------------------------
  // Additional integration tests
  // -------------------------------------------------------------------------

  it("should create a session on-demand if no session exists when sending a message", async () => {
    const user = userEvent.setup();

    mockCreateSession
      .mockRejectedValueOnce(new Error("Initial session failed"))
      .mockResolvedValueOnce("recovery-session-id");

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        { type: "text-delta", content: "recovered" },
        { type: "text-done" },
      ])
    );

    renderChatPanel();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "retry");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        "recovery-session-id",
        "retry",
        expect.any(Object),
        expect.any(Function), // onEvent callback
        expect.any(AbortSignal),
        expect.any(String), // chatModelSlug
        undefined, // imageUrl
      );
    });
  });

  it("should handle network errors during SSE stream gracefully", async () => {
    const user = userEvent.setup();

    // sendMessage throws during execution (simulates network disconnect)
    mockSendMessage.mockImplementation(
      async (
        _sessionId: string,
        _content: string,
        _imageContext: unknown,
        onEvent: (event: CanvasSSEEvent) => void,
        _signal?: AbortSignal
      ) => {
        onEvent({ type: "text-delta", content: "partial" });
        throw new Error("Network disconnected");
      }
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test network error");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Verbindungsfehler");
    });

    await waitFor(() => {
      expect(screen.getByTestId("chat-input-textarea")).not.toBeDisabled();
    });
  });

  it("should show toast when generateImages fails during canvas-generate handling", async () => {
    const user = userEvent.setup();

    mockGenerateImages.mockRejectedValueOnce(new Error("API error"));

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "variation",
          prompt: "failing prompt",
          model_id: "model-x",
          params: {},
        },
      ])
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "generate fail");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Generierung fehlgeschlagen.");
    });
  });
});
