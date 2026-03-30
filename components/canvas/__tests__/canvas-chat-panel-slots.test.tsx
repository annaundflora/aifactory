// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React, { useEffect } from "react";

/**
 * Acceptance Tests for slice-13: Chat Panel -- ModelSlots (compact) integration
 *
 * These tests validate that the CanvasChatPanel:
 * - Accepts modelSlots + models props (AC-1)
 * - Renders ModelSlots compact (AC-2)
 * - Passes img2img mode to ModelSlots without ParameterPanel (AC-3)
 * - Resolves modelIds from active slots for canvas-generate (AC-4)
 * - Builds image context with active_model_ids (AC-5)
 * - Keeps ModelSlots interactive during streaming, disabled only during generation (AC-6)
 * - buildImageContext uses modelSlots (AC-7)
 * - Imports ModelSlots and ModelSlot type (AC-8)
 *
 * Mocking Strategy: mock_external per spec
 * (generateImages server action, canvas-chat-service, ModelSlots component are mocked)
 */

// ---------------------------------------------------------------------------
// Hoisted mock functions (available before vi.mock factories execute)
// ---------------------------------------------------------------------------

const {
  mockCreateSession,
  mockSendMessage,
  mockGenerateImages,
  mockToastError,
  mockModelSlotsRender,
} = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockSendMessage: vi.fn(),
  mockGenerateImages: vi.fn(),
  mockToastError: vi.fn(),
  mockModelSlotsRender: vi.fn(),
}));

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

// Mock the ModelSlots component -- captures props for assertions
vi.mock("@/components/ui/model-slots", () => ({
  ModelSlots: (props: Record<string, unknown>) => {
    mockModelSlotsRender(props);
    return (
      <div
        data-testid="model-slots"
        data-variant={props.variant}
        data-mode={props.mode}
        data-disabled={String(props.disabled ?? false)}
      >
        ModelSlots-compact-mock
      </div>
    );
  },
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

import { CanvasChatPanel, type CanvasChatPanelProps } from "@/components/canvas/canvas-chat-panel";
import {
  CanvasDetailProvider,
  useCanvasDetail,
  type CanvasDetailAction,
} from "@/lib/canvas-detail-context";
import { type Generation, type ModelSlot, type Model } from "@/lib/db/queries";
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

function makeModelSlot(overrides: Partial<ModelSlot> = {}): ModelSlot {
  return {
    id: overrides.id ?? "ms-default",
    mode: overrides.mode ?? "img2img",
    slot: overrides.slot ?? 1,
    modelId: overrides.modelId ?? "black-forest-labs/flux-schnell",
    modelParams: overrides.modelParams ?? {},
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: overrides.id ?? "model-1",
    replicateId: overrides.replicateId ?? "black-forest-labs/flux-schnell",
    name: overrides.name ?? "Flux Schnell",
    description: overrides.description ?? null,
    capabilities: overrides.capabilities ?? { txt2img: true, img2img: true },
    defaultParams: overrides.defaultParams ?? {},
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  } as Model;
}

/**
 * Creates a mock implementation for sendMessage that calls onEvent with each event.
 * sendMessage signature: (sessionId, content, imageContext, onEvent, signal?, model?, imageUrl?) => Promise<void>
 */
function mockSSEEvents(events: CanvasSSEEvent[]) {
  return async (
    _sessionId: string,
    _content: string,
    _imageContext: unknown,
    onEvent: (event: CanvasSSEEvent) => void,
    _signal?: AbortSignal,
    _model?: string,
    _imageUrl?: string,
  ) => {
    for (const event of events) {
      onEvent(event);
    }
  };
}

/**
 * Renders CanvasChatPanel wrapped in CanvasDetailProvider with modelSlots support.
 */
function renderChatPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
    modelSlots?: ModelSlot[];
    models?: Model[];
    onPendingGenerations?: (pendingIds: string[]) => void;
    onGenerationsCreated?: (newGens: Generation[]) => void;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-slot-1" });
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
        modelSlots={options.modelSlots ?? []}
        models={options.models ?? []}
        onPendingGenerations={options.onPendingGenerations}
        onGenerationsCreated={options.onGenerationsCreated}
      />
    </CanvasDetailProvider>
  );
}

/**
 * Renders CanvasChatPanel with a ContextDispatcher to set context state on mount.
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

function renderChatPanelWithDispatcher(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
    modelSlots?: ModelSlot[];
    models?: Model[];
    initialAction?: CanvasDetailAction;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-slot-1" });
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
        modelSlots={options.modelSlots ?? []}
        models={options.models ?? []}
      />
    </CanvasDetailProvider>
  );
}

// ===========================================================================
// Test Data
// ===========================================================================

const SLOT_FLUX_SCHNELL = makeModelSlot({
  id: "ms-slot1",
  mode: "img2img",
  slot: 1,
  modelId: "black-forest-labs/flux-schnell",
  modelParams: { steps: 4 },
  active: true,
});

const SLOT_FLUX_PRO = makeModelSlot({
  id: "ms-slot2",
  mode: "img2img",
  slot: 2,
  modelId: "black-forest-labs/flux-pro",
  modelParams: { steps: 25, prompt_strength: 0.6 },
  active: true,
});

const SLOT_FLUX_MAX_INACTIVE = makeModelSlot({
  id: "ms-slot3",
  mode: "img2img",
  slot: 3,
  modelId: "black-forest-labs/flux-2-max",
  modelParams: { prompt_strength: 0.8 },
  active: false,
});

const SLOT_UPSCALE = makeModelSlot({
  id: "ms-upscale",
  mode: "upscale",
  slot: 1,
  modelId: "upscale-model",
  modelParams: {},
  active: true,
});

const MODEL_SCHNELL = makeModel({
  id: "model-schnell",
  replicateId: "black-forest-labs/flux-schnell",
  name: "Flux Schnell",
  capabilities: { txt2img: true, img2img: true },
});

const MODEL_PRO = makeModel({
  id: "model-pro",
  replicateId: "black-forest-labs/flux-pro",
  name: "Flux Pro",
  capabilities: { txt2img: true, img2img: true },
});

const MODEL_UPSCALE_ONLY = makeModel({
  id: "model-upscale",
  replicateId: "upscale-model",
  name: "Upscale Only",
  capabilities: { upscale: true },
});

const ALL_SLOTS = [SLOT_FLUX_SCHNELL, SLOT_FLUX_PRO, SLOT_FLUX_MAX_INACTIVE, SLOT_UPSCALE];
const ALL_MODELS = [MODEL_SCHNELL, MODEL_PRO, MODEL_UPSCALE_ONLY];

// ===========================================================================
// Tests
// ===========================================================================

describe("Slice 13: Chat Panel -- ModelSlots (compact) Acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // AC-1: Props akzeptieren modelSlots + models statt modelSettings
  // -------------------------------------------------------------------------
  describe("AC-1: Props accept modelSlots + models instead of modelSettings", () => {
    /**
     * AC-1: GIVEN das Chat Panel wird gerendert
     *       WHEN die Props inspiziert werden
     *       THEN akzeptiert CanvasChatPanelProps die Props modelSlots: ModelSlot[] und models: Model[]
     *       AND modelSettings?: ModelSetting[] ist entfernt
     *       AND der Tier Type-Import ist entfernt
     */
    it("should accept modelSlots and models props and not accept modelSettings", () => {
      // Render with modelSlots and models -- must compile and render without error
      renderChatPanel({
        modelSlots: ALL_SLOTS,
        models: ALL_MODELS,
      });

      const panel = screen.getByTestId("canvas-chat-panel");
      expect(panel).toBeInTheDocument();

      // TypeScript compile-time check: CanvasChatPanelProps should have modelSlots and models
      // If modelSettings still existed, this would cause a TS error since we don't pass it.
      // The fact that this test compiles proves modelSettings is removed.
      const props: CanvasChatPanelProps = {
        generation: makeGeneration(),
        projectId: "project-1",
        modelSlots: ALL_SLOTS,
        models: ALL_MODELS,
      };
      expect(props.modelSlots).toBeDefined();
      expect(props.models).toBeDefined();
      // @ts-expect-error -- modelSettings should not exist on the type
      expect(props.modelSettings).toBeUndefined();
    });

    it("should not have legacy tier-related UI elements", () => {
      renderChatPanel({ modelSlots: ALL_SLOTS, models: ALL_MODELS });

      // There should be no legacy tier-related UI
      expect(screen.queryByTestId("chat-tier-bar")).not.toBeInTheDocument();

      // No Draft/Quality/Max buttons (legacy segments)
      expect(screen.queryByText("Draft")).not.toBeInTheDocument();
      expect(screen.queryByText("Quality")).not.toBeInTheDocument();
      expect(screen.queryByText("Max")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: ModelSlots compact is rendered
  // -------------------------------------------------------------------------
  describe("AC-2: ModelSlots compact renders", () => {
    /**
     * AC-2: GIVEN das Chat Panel ist expanded (nicht collapsed)
     *       WHEN der Bereich zwischen ChatThread und ChatInput gerendert wird
     *       THEN wird <ModelSlots variant="compact" ... /> angezeigt
     *       AND das Element mit data-testid="chat-model-slots-bar" ist vorhanden
     */
    it("should render ModelSlots with variant compact between ChatThread and ChatInput", () => {
      renderChatPanel({ modelSlots: ALL_SLOTS, models: ALL_MODELS });

      // ModelSlots (compact) mock should be rendered
      const modelSlotsEl = screen.getByTestId("model-slots");
      expect(modelSlotsEl).toBeInTheDocument();
      expect(modelSlotsEl).toHaveAttribute("data-variant", "compact");

      // The chat-model-slots-bar should be present
      expect(screen.getByTestId("chat-model-slots-bar")).toBeInTheDocument();

      // The model-slots should be inside the slots bar
      const slotsBar = screen.getByTestId("chat-model-slots-bar");
      expect(slotsBar).toContainElement(modelSlotsEl);
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: ModelSlots zeigt img2img-Mode Slots ohne ParameterPanel
  // -------------------------------------------------------------------------
  describe("AC-3: ModelSlots shows img2img mode without ParameterPanel", () => {
    /**
     * AC-3: GIVEN das Chat Panel rendert ModelSlots (compact)
     *       WHEN die Komponente sichtbar ist
     *       THEN werden die Slots fuer den Mode "img2img" angezeigt
     *       AND die uebergebenen models werden mode-gefiltert an ModelSlots weitergereicht
     *       AND KEIN ParameterPanel ist sichtbar (compact-Eigenschaft)
     */
    it("should pass mode img2img and models to ModelSlots compact without ParameterPanel", () => {
      renderChatPanel({ modelSlots: ALL_SLOTS, models: ALL_MODELS });

      // ModelSlots should be called with mode="img2img"
      expect(mockModelSlotsRender).toHaveBeenCalled();
      const lastCallProps = mockModelSlotsRender.mock.calls[
        mockModelSlotsRender.mock.calls.length - 1
      ][0];

      expect(lastCallProps.variant).toBe("compact");
      expect(lastCallProps.mode).toBe("img2img");
      expect(lastCallProps.slots).toEqual(ALL_SLOTS);
      expect(lastCallProps.models).toEqual(ALL_MODELS);

      // The data-mode attribute on the mock verifies mode is passed
      const modelSlotsEl = screen.getByTestId("model-slots");
      expect(modelSlotsEl).toHaveAttribute("data-mode", "img2img");

      // No ParameterPanel should be visible (compact variant inherently excludes it)
      // Since we mock ModelSlots, we verify the variant="compact" prop is passed,
      // which means the real component would not render ParameterPanel.
      expect(lastCallProps.variant).toBe("compact");
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: canvas-generate nutzt aktive Slots statt tier-basiertem Lookup
  // -------------------------------------------------------------------------
  describe("AC-4: canvas-generate uses active slots for model resolution", () => {
    /**
     * AC-4: GIVEN 2 Slots sind aktiv (Slot 1: "flux-schnell", Slot 2: "flux-pro")
     *       WHEN ein canvas-generate SSE-Event mit action: "img2img" eintrifft
     *       THEN wird generateImages mit modelIds aufgerufen die aus den aktiven Slots
     *            aufgeloest werden (NICHT aus modelSettings.find(s => s.tier === tier))
     *       AND die modelParams des ersten aktiven Slots werden als Basis-Params genutzt
     */
    it("should resolve modelIds from active slots when handling canvas-generate event", async () => {
      const user = userEvent.setup();

      // SSE event with canvas-generate
      mockSendMessage.mockImplementation(
        mockSSEEvents([
          {
            type: "canvas-generate",
            action: "img2img",
            prompt: "make it brighter",
            model_id: "ai-chosen-model-should-be-ignored",
            params: { extra_param: 42 },
          },
        ])
      );

      const generation = makeGeneration({
        id: "gen-ac4",
        modelId: "fallback-model-should-not-be-used",
        imageUrl: "https://example.com/source.png",
      });

      // 2 active img2img slots
      const activeSlots = [SLOT_FLUX_SCHNELL, SLOT_FLUX_PRO, SLOT_FLUX_MAX_INACTIVE, SLOT_UPSCALE];

      renderChatPanel({
        generation,
        projectId: "project-ac4",
        modelSlots: activeSlots,
        models: ALL_MODELS,
      });

      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

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

      // Must use active img2img slot model IDs (flux-schnell + flux-pro)
      expect(callArgs.modelIds).toEqual([
        "black-forest-labs/flux-schnell",
        "black-forest-labs/flux-pro",
      ]);

      // Event model_id should be ignored
      expect(callArgs.modelIds).not.toContain("ai-chosen-model-should-be-ignored");

      // Fallback model should NOT be used (active slots exist)
      expect(callArgs.modelIds).not.toContain("fallback-model-should-not-be-used");

      // First active slot's modelParams should be used as base, merged with event params
      expect(callArgs.params).toEqual(
        expect.objectContaining({ steps: 4, extra_param: 42 })
      );
    });

    it("should fall back to generation.modelId when no active img2img slots exist", async () => {
      const user = userEvent.setup();

      mockSendMessage.mockImplementation(
        mockSSEEvents([
          {
            type: "canvas-generate",
            action: "img2img",
            prompt: "fallback test",
            model_id: "ai-model",
            params: {},
          },
        ])
      );

      const generation = makeGeneration({
        id: "gen-ac4-fallback",
        modelId: "original-generation-model",
      });

      // No active img2img slots (empty array)
      renderChatPanel({
        generation,
        projectId: "project-ac4-fb",
        modelSlots: [],
        models: ALL_MODELS,
      });

      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

      const textarea = screen.getByTestId("chat-input-textarea");
      const sendButton = screen.getByTestId("send-btn");

      await user.type(textarea, "fallback test");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockGenerateImages).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockGenerateImages.mock.calls[0][0];

      // Must fall back to generation.modelId
      expect(callArgs.modelIds).toEqual(["original-generation-model"]);
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: imageContext enthaelt active_model_ids statt selected_tier
  // -------------------------------------------------------------------------
  describe("AC-5: imageContext contains active_model_ids instead of selected_tier", () => {
    /**
     * AC-5: GIVEN das Chat Panel sendet eine Nachricht an den Backend-Service
     *       WHEN der imageContext aufgebaut wird
     *       THEN enthaelt der Kontext active_model_ids: string[] (aktive Slot-Model-IDs)
     *            statt selected_tier: Tier
     *       AND tier_models (Record aus Tier-Keys) ist entfernt/ersetzt durch die
     *            Slot-basierte Struktur
     */
    it("should build image context with active model IDs instead of selected_tier", async () => {
      const user = userEvent.setup();

      // Use a delayed stream that resolves immediately after text-done so we can inspect args
      mockSendMessage.mockImplementation(mockSSEEvents([
        { type: "text-delta", content: "response" },
        { type: "text-done" },
      ]));

      const generation = makeGeneration({
        id: "gen-ac5",
        modelId: "original-model",
        imageUrl: "https://example.com/ac5.png",
        prompt: "original prompt",
      });

      const activeSlots = [SLOT_FLUX_SCHNELL, SLOT_FLUX_PRO, SLOT_FLUX_MAX_INACTIVE];

      renderChatPanel({
        generation,
        projectId: "project-ac5",
        modelSlots: activeSlots,
        models: ALL_MODELS,
      });

      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

      // Send a message
      const textarea = screen.getByTestId("chat-input-textarea");
      const sendButton = screen.getByTestId("send-btn");

      await user.type(textarea, "enhance this image");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      // sendMessage args: (sessionId, content, imageContext, onEvent, signal, model, imageUrl)
      const sendCallArgs = mockSendMessage.mock.calls[0];
      const imageContext = sendCallArgs[2];

      // Should have active_model_ids from active img2img slots
      expect(imageContext.active_model_ids).toEqual([
        "black-forest-labs/flux-schnell",
        "black-forest-labs/flux-pro",
      ]);

      // Should NOT have selected_tier or tier_models
      expect(imageContext).not.toHaveProperty("selected_tier");
      expect(imageContext).not.toHaveProperty("tier_models");

      // Should still have standard image context fields
      expect(imageContext.image_url).toBe("https://example.com/ac5.png");
      expect(imageContext.prompt).toBe("original prompt");
      expect(imageContext.model_id).toBe("original-model");
      expect(imageContext.generation_id).toBe("gen-ac5");
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Slots bleiben interaktiv waehrend Streaming
  // -------------------------------------------------------------------------
  describe("AC-6: ModelSlots interactive during streaming, disabled during generation", () => {
    /**
     * AC-6: GIVEN der AI-Stream laeuft (isStreaming === true)
     *       WHEN der User einen Slot-Checkbox toggled oder ein Model im Dropdown wechselt
     *       THEN bleibt die ModelSlots-Komponente interaktiv (NICHT disabled)
     *       AND nur waehrend state.isGenerating === true (Bild-Generierung) werden die Slots disabled
     */
    it("should keep ModelSlots interactive during AI streaming and only disable during image generation", async () => {
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
          _signal?: AbortSignal,
        ) => {
          onEvent({ type: "text-delta", content: "Hello" });
          // Keep streaming by not sending text-done yet
          await streamPromise;
          onEvent({ type: "text-done" });
        }
      );

      renderChatPanel({ modelSlots: ALL_SLOTS, models: ALL_MODELS });
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

      // During streaming, ModelSlots should NOT be disabled
      const modelSlotsEl = screen.getByTestId("model-slots");
      expect(modelSlotsEl).toHaveAttribute("data-disabled", "false");

      // Verify the disabled prop passed to ModelSlots is false during streaming
      const streamingCallProps = mockModelSlotsRender.mock.calls[
        mockModelSlotsRender.mock.calls.length - 1
      ][0];
      expect(streamingCallProps.disabled).toBe(false);

      // Clean up: resolve the stream
      await act(async () => {
        resolveStream();
      });
    });

    it("should disable ModelSlots when state.isGenerating is true", async () => {
      const user = userEvent.setup();
      const generation = makeGeneration({ id: "gen-ac6-gen" });

      // Use a controlled component to set isGenerating
      const ControlledPanel = () => {
        const { dispatch } = useCanvasDetail();
        const [didSetGenerating, setDidSetGenerating] = React.useState(false);
        return (
          <>
            <CanvasChatPanel
              generation={generation}
              projectId={generation.projectId}
              modelSlots={ALL_SLOTS}
              models={ALL_MODELS}
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

      // Initially, ModelSlots should not be disabled
      expect(screen.getByTestId("model-slots")).toHaveAttribute("data-disabled", "false");

      // Trigger isGenerating=true
      await user.click(screen.getByTestId("set-generating"));

      // ModelSlots should now be disabled
      await waitFor(() => {
        expect(screen.getByTestId("model-slots")).toHaveAttribute("data-disabled", "true");
      });

      // Verify the disabled prop passed to ModelSlots
      const generatingCallProps = mockModelSlotsRender.mock.calls[
        mockModelSlotsRender.mock.calls.length - 1
      ][0];
      expect(generatingCallProps.disabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // AC-7: buildImageContext nutzt modelSlots statt modelSettings
  // -------------------------------------------------------------------------
  describe("AC-7: buildImageContext uses modelSlots instead of modelSettings", () => {
    /**
     * AC-7: GIVEN die buildImageContext Helper-Funktion
     *       WHEN sie mit modelSlots statt modelSettings aufgerufen wird
     *       THEN baut sie den Kontext aus aktiven Slots auf
     *            (modelSlots.filter(s => s.mode === "img2img" && s.active))
     *       AND die Signatur aendert sich von (generation, modelSettings) auf (generation, modelSlots)
     */
    it("should build image context from active img2img model slots", async () => {
      const user = userEvent.setup();

      mockSendMessage.mockImplementation(mockSSEEvents([
        { type: "text-delta", content: "reply" },
        { type: "text-done" },
      ]));

      const generation = makeGeneration({
        id: "gen-ac7",
        modelId: "gen-model",
        imageUrl: "https://example.com/ac7.png",
        prompt: "ac7 prompt",
      });

      // Mix of active/inactive, img2img/upscale slots
      const mixedSlots = [
        SLOT_FLUX_SCHNELL,        // active, img2img -> included
        SLOT_FLUX_PRO,            // active, img2img -> included
        SLOT_FLUX_MAX_INACTIVE,   // inactive, img2img -> excluded
        SLOT_UPSCALE,             // active, upscale -> excluded (wrong mode)
      ];

      renderChatPanel({
        generation,
        projectId: "project-ac7",
        modelSlots: mixedSlots,
        models: ALL_MODELS,
      });

      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

      // The createSession call also gets the image context
      const sessionCallArgs = mockCreateSession.mock.calls[0];
      const sessionContext = sessionCallArgs[1];

      // Should have active_model_ids only from active img2img slots
      expect(sessionContext.active_model_ids).toEqual([
        "black-forest-labs/flux-schnell",
        "black-forest-labs/flux-pro",
      ]);

      // inactive img2img slot (flux-2-max) should NOT be included
      expect(sessionContext.active_model_ids).not.toContain("black-forest-labs/flux-2-max");

      // upscale slot should NOT be included (wrong mode)
      expect(sessionContext.active_model_ids).not.toContain("upscale-model");

      // Now also verify via sendMessage
      const textarea = screen.getByTestId("chat-input-textarea");
      const sendButton = screen.getByTestId("send-btn");

      await user.type(textarea, "test context");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      const sendContext = mockSendMessage.mock.calls[0][2];
      expect(sendContext.active_model_ids).toEqual([
        "black-forest-labs/flux-schnell",
        "black-forest-labs/flux-pro",
      ]);

      // Standard context fields should still be present
      expect(sendContext.image_url).toBe("https://example.com/ac7.png");
      expect(sendContext.prompt).toBe("ac7 prompt");
      expect(sendContext.generation_id).toBe("gen-ac7");
    });

    it("should not include active_model_ids when no active img2img slots exist", async () => {
      const generation = makeGeneration({
        id: "gen-ac7-empty",
        modelId: "gen-model-empty",
      });

      // Only inactive or wrong-mode slots
      const noActiveImg2imgSlots = [SLOT_FLUX_MAX_INACTIVE, SLOT_UPSCALE];

      renderChatPanel({
        generation,
        projectId: "project-ac7-empty",
        modelSlots: noActiveImg2imgSlots,
        models: ALL_MODELS,
      });

      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));

      const sessionContext = mockCreateSession.mock.calls[0][1];

      // With no active img2img slots, active_model_ids should not be present or be empty
      if (sessionContext.active_model_ids) {
        expect(sessionContext.active_model_ids).toHaveLength(0);
      } else {
        expect(sessionContext).not.toHaveProperty("active_model_ids");
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC-8: Imports nutzen model-slots
  // -------------------------------------------------------------------------
  describe("AC-8: Imports use ModelSlots and ModelSlot", () => {
    /**
     * AC-8: GIVEN der Import-Block von canvas-chat-panel.tsx
     *       WHEN Slice 13 implementiert ist
     *       THEN sind ModelSlots aus @/components/ui/model-slots importiert
     *       AND ModelSlot Type aus @/lib/db/queries importiert
     */
    it("should import ModelSlots and ModelSlot type", async () => {
      // This test verifies through rendering behavior that the correct
      // components are imported and used.

      renderChatPanel({ modelSlots: ALL_SLOTS, models: ALL_MODELS });

      // ModelSlots component is rendered (proves the import works)
      expect(screen.getByTestId("model-slots")).toBeInTheDocument();

      // The component accepts ModelSlot[] type for modelSlots prop
      // (compile-time verification -- if the import was wrong, this would fail)
      const typedSlot: ModelSlot = makeModelSlot();
      expect(typedSlot).toBeDefined();

      // Verify no legacy UI elements exist
      expect(screen.queryByText("Draft")).not.toBeInTheDocument();
      expect(screen.queryByText("Quality")).not.toBeInTheDocument();
      expect(screen.queryByText("Max")).not.toBeInTheDocument();
    });

    it("should verify source file has correct imports via static analysis", async () => {
      // Read the source file and check imports directly
      const fs = await import("fs");
      const sourceCode = fs.readFileSync(
        "/home/dev/aifactory/.claude/worktrees/model-slots/components/canvas/canvas-chat-panel.tsx",
        "utf-8"
      );

      // ModelSlots should be imported from @/components/ui/model-slots
      expect(sourceCode).toContain('import { ModelSlots } from "@/components/ui/model-slots"');

      // ModelSlot type should be imported from @/lib/db/queries
      expect(sourceCode).toContain("ModelSlot");
      expect(sourceCode).toMatch(/from\s+["']@\/lib\/db\/queries["']/);

      // Legacy types should NOT be imported
      expect(sourceCode).not.toContain("ModelSetting");
      expect(sourceCode).not.toMatch(/import\s+.*\bTier\b/);
    });
  });
});
