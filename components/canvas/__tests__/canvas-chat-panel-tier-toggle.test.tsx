// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React, { useEffect } from "react";

/**
 * Acceptance Tests for slice-11: Canvas Chat Panel Tier Toggle
 *
 * These tests validate that the CanvasChatPanel:
 * - Renders TierToggle and MaxQualityToggle with correct visibility/interaction (AC-1..4)
 * - Resolves models from settings based on tier when handleCanvasGenerate fires (AC-5..7)
 * - Keeps TierToggle interactive during streaming (AC-8)
 * - Disables toggles during generation (AC-9)
 * - Falls back to generation.modelId when settings are empty (AC-10)
 *
 * Mocking Strategy: mock_external per spec
 * (generateImages server action + canvas-chat-service are mocked)
 */

// ---------------------------------------------------------------------------
// Hoisted mock functions (available before vi.mock factories execute)
// ---------------------------------------------------------------------------

const {
  mockCreateSession,
  mockSendMessage,
  mockGenerateImages,
  mockToastError,
} = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockSendMessage: vi.fn(),
  mockGenerateImages: vi.fn(),
  mockToastError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
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
  Square: (props: Record<string, unknown>) => (
    <span data-testid="square-icon" {...props} />
  ),
}));

// Mock the model selector (uses radix Select which needs complex setup in jsdom)
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector-mock" />,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// Mock canvas-chat-service
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

// Mock generateImages server action
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

// Stable crypto.randomUUID for deterministic test IDs
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
import {
  CanvasDetailProvider,
  useCanvasDetail,
  type CanvasDetailAction,
} from "@/lib/canvas-detail-context";
import { type Generation, type ModelSetting } from "@/lib/db/queries";
import type { CanvasSSEEvent } from "@/lib/canvas-chat-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-default-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "fallback-model-id",
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

function makeModelSetting(overrides: Partial<ModelSetting> = {}): ModelSetting {
  return {
    id: overrides.id ?? "ms-default",
    mode: overrides.mode ?? "img2img",
    tier: overrides.tier ?? "draft",
    modelId: overrides.modelId ?? "black-forest-labs/flux-schnell",
    modelParams: overrides.modelParams ?? {},
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
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
 * Helper component that dispatches a context action on mount.
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
 * Renders CanvasChatPanel wrapped in CanvasDetailProvider with modelSettings support.
 */
function renderChatPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
    modelSettings?: ModelSetting[];
    onPendingGenerations?: (pendingIds: string[]) => void;
    onGenerationsCreated?: (newGens: Generation[]) => void;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-tier-1" });
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
        modelSettings={options.modelSettings}
        onPendingGenerations={options.onPendingGenerations}
        onGenerationsCreated={options.onGenerationsCreated}
      />
    </CanvasDetailProvider>
  );
}

/**
 * Renders CanvasChatPanel with a ContextDispatcher to set context state on mount.
 */
function renderChatPanelWithDispatcher(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
    modelSettings?: ModelSetting[];
    initialAction?: CanvasDetailAction;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-tier-1" });
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <ContextDispatcher
        action={options.initialAction ?? null}
        triggerOnRender={!!options.initialAction}
      />
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
        modelSettings={options.modelSettings}
      />
    </CanvasDetailProvider>
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe("CanvasChatPanel TierToggle rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
  });

  /**
   * AC-1: GIVEN das Canvas Chat Panel ist geoeffnet und expanded
   *       WHEN es gerendert wird
   *       THEN zeigt es eine TierToggle-Komponente zwischen der ChatThread und dem ChatInput,
   *            mit Default-Tier "draft"
   */
  it("AC-1: should render TierToggle above ChatInput with default tier draft", () => {
    renderChatPanel();

    // TierToggle should be visible
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();

    // It should be inside the tier bar between ChatThread and ChatInput
    const tierBar = screen.getByTestId("chat-tier-bar");
    expect(tierBar).toBeInTheDocument();
    expect(tierBar).toContainElement(tierToggle);

    // Default tier is "draft" -- Draft button should be active (aria-pressed=true)
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "true");

    const qualityButton = screen.getByText("Quality");
    expect(qualityButton).toHaveAttribute("aria-pressed", "false");

    // MaxQualityToggle should NOT be visible in draft mode
    expect(screen.queryByTestId("max-quality-toggle")).not.toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN der Tier-State steht auf "draft"
   *       WHEN der User auf "Quality" im TierToggle klickt
   *       THEN wechselt der Tier-State zu "quality" und eine MaxQualityToggle-Komponente
   *            wird neben/unter dem TierToggle sichtbar
   */
  it("AC-2: should show MaxQualityToggle when tier switches to quality", async () => {
    const user = userEvent.setup();
    renderChatPanel();

    // Verify draft is active initially
    expect(screen.getByText("Draft")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("max-quality-toggle")).not.toBeInTheDocument();

    // Click Quality
    const qualityButton = screen.getByText("Quality");
    await user.click(qualityButton);

    // Quality should now be active
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Draft")).toHaveAttribute("aria-pressed", "false");

    // MaxQualityToggle should now be visible
    const maxQualityToggle = screen.getByTestId("max-quality-toggle");
    expect(maxQualityToggle).toBeInTheDocument();
  });

  /**
   * AC-3: GIVEN der Tier-State steht auf "quality"
   *       WHEN der User auf "Draft" im TierToggle klickt
   *       THEN wechselt der Tier-State zu "draft" und die MaxQualityToggle-Komponente
   *            wird ausgeblendet
   */
  it("AC-3: should hide MaxQualityToggle when tier switches back to draft", async () => {
    const user = userEvent.setup();
    renderChatPanel();

    // Switch to quality first
    await user.click(screen.getByText("Quality"));
    expect(screen.getByTestId("max-quality-toggle")).toBeInTheDocument();

    // Switch back to draft
    await user.click(screen.getByText("Draft"));

    // Draft should be active
    expect(screen.getByText("Draft")).toHaveAttribute("aria-pressed", "true");

    // MaxQualityToggle should be hidden
    expect(screen.queryByTestId("max-quality-toggle")).not.toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN der Tier-State steht auf "quality" und maxQuality ist false
   *       WHEN der User den MaxQualityToggle aktiviert
   *       THEN wird maxQuality auf true gesetzt (effektiver Tier fuer Model-Resolution: "max")
   */
  it("AC-4: should set maxQuality to true when MaxQualityToggle is activated", async () => {
    const user = userEvent.setup();
    renderChatPanel();

    // Switch to quality
    await user.click(screen.getByText("Quality"));

    // MaxQualityToggle should be visible and initially off
    const maxQualityToggle = screen.getByTestId("max-quality-toggle");
    expect(maxQualityToggle).toHaveAttribute("aria-pressed", "false");

    // Click to activate
    await user.click(maxQualityToggle);

    // MaxQuality should now be on
    expect(maxQualityToggle).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CanvasChatPanel handleCanvasGenerate model resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
  });

  const MODEL_SETTINGS: ModelSetting[] = [
    makeModelSetting({
      id: "ms-draft",
      mode: "img2img",
      tier: "draft",
      modelId: "black-forest-labs/flux-schnell",
      modelParams: {},
    }),
    makeModelSetting({
      id: "ms-quality",
      mode: "img2img",
      tier: "quality",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { prompt_strength: 0.6 },
    }),
    makeModelSetting({
      id: "ms-max",
      mode: "img2img",
      tier: "max",
      modelId: "black-forest-labs/flux-2-max",
      modelParams: { prompt_strength: 0.8 },
    }),
  ];

  /**
   * AC-5: GIVEN ein SSE canvas-generate Event wird empfangen mit event.model_id = "some-ai-chosen/model"
   *       WHEN handleCanvasGenerate() ausgefuehrt wird und Tier ist "draft"
   *       THEN wird generateImages mit modelIds: [img2img-draft-modelId] aufgerufen,
   *            wobei img2img-draft-modelId aus den modelSettings stammt
   *            (z.B. "black-forest-labs/flux-schnell"), und event.model_id wird ignoriert
   */
  it("AC-5: should call generateImages with img2img/draft model from settings, ignoring event.model_id", async () => {
    const user = userEvent.setup();

    // SSE event with a model_id that should be IGNORED
    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "img2img",
          prompt: "make it brighter",
          model_id: "some-ai-chosen/model",
          params: { steps: 30 },
        },
      ])
    );

    const generation = makeGeneration({
      id: "gen-ac5",
      modelId: "fallback-model-should-not-be-used",
      imageUrl: "https://example.com/source.png",
    });

    renderChatPanel({
      generation,
      projectId: "project-ac5",
      modelSettings: MODEL_SETTINGS,
    });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Tier is draft by default -- no need to change
    // Send a message to trigger the SSE canvas-generate event
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "make it brighter");
    await user.click(sendButton);

    // Wait for generateImages to be called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-5: Must use the img2img/draft model from settings
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-schnell"]);

    // event.model_id "some-ai-chosen/model" should be ignored
    expect(callArgs.modelIds).not.toContain("some-ai-chosen/model");

    // Should NOT use the fallback model either
    expect(callArgs.modelIds).not.toContain("fallback-model-should-not-be-used");
  });

  /**
   * AC-6: GIVEN Tier ist "quality" und maxQuality ist true
   *       WHEN handleCanvasGenerate() ausgefuehrt wird
   *       THEN wird generateImages mit modelIds: [img2img-max-modelId] aufgerufen
   *            (z.B. "black-forest-labs/flux-2-max") und die zugehoerigen modelParams
   *            aus Settings werden als params uebergeben
   */
  it("AC-6: should call generateImages with img2img/max model when tier is quality and maxQuality is true", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "img2img",
          prompt: "enhance this",
          model_id: "ignored-model",
          params: {},
        },
      ])
    );

    const generation = makeGeneration({
      id: "gen-ac6",
      modelId: "fallback-model",
    });

    renderChatPanel({
      generation,
      projectId: "project-ac6",
      modelSettings: MODEL_SETTINGS,
    });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Switch tier to Quality
    await user.click(screen.getByText("Quality"));

    // Enable MaxQuality
    const maxQualityToggle = screen.getByTestId("max-quality-toggle");
    await user.click(maxQualityToggle);
    expect(maxQualityToggle).toHaveAttribute("aria-pressed", "true");

    // Send message to trigger canvas-generate
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "enhance this");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-6: Must use the img2img/max model from settings
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-2-max"]);

    // AC-6: modelParams from max setting should be merged into params
    expect(callArgs.params).toEqual(
      expect.objectContaining({ prompt_strength: 0.8 })
    );
  });

  /**
   * AC-7: GIVEN Tier ist "quality" und maxQuality ist false
   *       WHEN handleCanvasGenerate() ausgefuehrt wird
   *       THEN wird generateImages mit modelIds: [img2img-quality-modelId] aufgerufen
   *            (z.B. "black-forest-labs/flux-2-pro")
   */
  it("AC-7: should call generateImages with img2img/quality model when tier is quality and maxQuality is false", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "img2img",
          prompt: "refine details",
          model_id: "ignored-model",
          params: {},
        },
      ])
    );

    const generation = makeGeneration({
      id: "gen-ac7",
      modelId: "fallback-model",
    });

    renderChatPanel({
      generation,
      projectId: "project-ac7",
      modelSettings: MODEL_SETTINGS,
    });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Switch tier to Quality (maxQuality remains false by default)
    await user.click(screen.getByText("Quality"));
    expect(screen.getByTestId("max-quality-toggle")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    // Send message to trigger canvas-generate
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "refine details");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-7: Must use the img2img/quality model from settings
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-2-pro"]);
  });

  /**
   * AC-10: GIVEN modelSettings konnten nicht geladen werden (leeres Array)
   *        WHEN handleCanvasGenerate() ausgefuehrt wird
   *        THEN wird generation.modelId als Fallback verwendet (graceful degradation)
   */
  it("AC-10: should fall back to generation.modelId when modelSettings is empty", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "img2img",
          prompt: "fallback test",
          model_id: "ai-chosen-model",
          params: {},
        },
      ])
    );

    const generation = makeGeneration({
      id: "gen-ac10",
      modelId: "original-generation-model",
    });

    // Pass empty modelSettings (simulates failed fetch or no settings)
    renderChatPanel({
      generation,
      projectId: "project-ac10",
      modelSettings: [],
    });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Send message to trigger canvas-generate
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "fallback test");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-10: Must fall back to generation.modelId
    expect(callArgs.modelIds).toEqual(["original-generation-model"]);

    // NOT the ai-chosen model_id from the event
    expect(callArgs.modelIds).not.toContain("ai-chosen-model");
  });

  /**
   * AC-10 (variant): Fallback also works when modelSettings is undefined (default prop)
   */
  it("AC-10: should fall back to generation.modelId when modelSettings prop is not provided", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockImplementation(
      mockSSEEvents([
        {
          type: "canvas-generate",
          action: "img2img",
          prompt: "no settings",
          model_id: "ai-model",
          params: {},
        },
      ])
    );

    const generation = makeGeneration({
      id: "gen-ac10b",
      modelId: "generation-fallback-model",
    });

    // Do not pass modelSettings -- relies on default (empty array)
    renderChatPanel({
      generation,
      projectId: "project-ac10b",
    });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "test");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.modelIds).toEqual(["generation-fallback-model"]);
  });
});

describe("CanvasChatPanel TierToggle interaction states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
  });

  /**
   * AC-8: GIVEN eine AI-Antwort wird gestreamt (isStreaming === true)
   *       WHEN der User auf den TierToggle klickt
   *       THEN wechselt der Tier-State (TierToggle bleibt interaktiv waehrend Streaming)
   */
  it("AC-8: should keep TierToggle interactive while isStreaming is true", async () => {
    const user = userEvent.setup();

    // Use a deferred stream so isStreaming stays true
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
        // Keep streaming by not sending text-done yet
        await streamPromise;
        onEvent({ type: "text-done" });
      }
    );

    renderChatPanel();
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

    // Send a message to start streaming
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "start stream");
    await user.click(sendButton);

    // Wait for streaming to start (streaming indicator visible)
    await waitFor(() => {
      expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument();
    });

    // While streaming, the TierToggle should NOT be disabled
    const draftButton = screen.getByText("Draft");
    const qualityButton = screen.getByText("Quality");
    expect(draftButton).not.toBeDisabled();
    expect(qualityButton).not.toBeDisabled();

    // Click Quality -- should actually switch the tier even during streaming
    await user.click(qualityButton);
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");
    expect(draftButton).toHaveAttribute("aria-pressed", "false");

    // MaxQualityToggle should also appear and be interactive during streaming
    const maxQualityToggle = screen.getByTestId("max-quality-toggle");
    expect(maxQualityToggle).not.toBeDisabled();

    // Switch back to Draft
    await user.click(draftButton);
    expect(draftButton).toHaveAttribute("aria-pressed", "true");

    // Clean up: resolve the stream
    await act(async () => {
      resolveStream();
    });
  });

  /**
   * AC-9: GIVEN eine Generation laeuft (state.isGenerating === true)
   *       WHEN der User den TierToggle oder MaxQualityToggle bedienen will
   *       THEN sind beide Toggles disabled (nicht klickbar)
   */
  it("AC-9: should disable TierToggle and MaxQualityToggle while isGenerating is true", async () => {
    const user = userEvent.setup();

    // First render without isGenerating so we can switch to quality
    // to make MaxQualityToggle visible, then set isGenerating
    const generation = makeGeneration({ id: "gen-ac9" });

    const { unmount } = renderChatPanel({ generation });

    // Switch to quality first to make MaxQualityToggle appear
    await user.click(screen.getByText("Quality"));
    expect(screen.getByTestId("max-quality-toggle")).toBeInTheDocument();

    unmount();

    // Now render with isGenerating=true via ContextDispatcher and quality tier
    // We need to pre-set tier to quality so MaxQualityToggle is visible
    // Since tier is internal state, we render fresh and set isGenerating
    // The tier resets to draft on remount, so we need a different approach:
    // Render, switch to quality, then dispatch SET_GENERATING

    const ControlledPanel = () => {
      const { dispatch } = useCanvasDetail();
      const [didSetGenerating, setDidSetGenerating] = React.useState(false);
      return (
        <>
          <CanvasChatPanel
            generation={generation}
            projectId={generation.projectId}
            modelSettings={[]}
          />
          {!didSetGenerating && (
            <button
              data-testid="set-generating"
              onClick={() => {
                dispatch({ type: "SET_GENERATING", isGenerating: true });
                setDidSetGenerating(true);
              }}
            >
              Set Generating
            </button>
          )}
        </>
      );
    };

    render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <ControlledPanel />
      </CanvasDetailProvider>
    );

    // Switch to quality to make MaxQualityToggle visible
    await user.click(screen.getByText("Quality"));
    expect(screen.getByTestId("max-quality-toggle")).toBeInTheDocument();

    // Now set isGenerating=true
    await user.click(screen.getByTestId("set-generating"));

    // TierToggle buttons should be disabled
    await waitFor(() => {
      const draftButton = screen.getByText("Draft");
      const qualityButton = screen.getByText("Quality");
      expect(draftButton).toBeDisabled();
      expect(qualityButton).toBeDisabled();
    });

    // MaxQualityToggle should also be disabled
    const maxQualityToggle = screen.getByTestId("max-quality-toggle");
    expect(maxQualityToggle).toBeDisabled();

    // Verify clicking does not change state
    await user.click(screen.getByText("Draft"));
    expect(screen.getByText("Quality")).toHaveAttribute("aria-pressed", "true");
    // Draft should remain not-pressed (click was blocked)
    expect(screen.getByText("Draft")).toHaveAttribute("aria-pressed", "false");
  });
});
