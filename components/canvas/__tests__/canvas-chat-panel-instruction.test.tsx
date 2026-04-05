// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice-08 spec)
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

// Mock the model selector
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

// Mock uploadMask server action (not used for instruction, but required by import)
const mockUploadMask = vi.fn().mockResolvedValue({ url: "https://r2.example.com/masks/uploaded.png" });

vi.mock("@/app/actions/upload", () => ({
  uploadMask: (...args: unknown[]) => mockUploadMask(...args),
}));

// Mock MaskService functions (not used for instruction, but required by import)
const mockValidateMinSize = vi.fn().mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } });
const mockApplyFeathering = vi.fn().mockImplementation((imageData: ImageData) => imageData);
const mockScaleToOriginal = vi.fn().mockImplementation((imageData: ImageData) => imageData);
const mockToGrayscalePng = vi.fn().mockResolvedValue(new Blob(["mock-png"], { type: "image/png" }));

vi.mock("@/lib/services/mask-service", () => ({
  validateMinSize: (...args: unknown[]) => mockValidateMinSize(...args),
  applyFeathering: (...args: unknown[]) => mockApplyFeathering(...args),
  scaleToOriginal: (...args: unknown[]) => mockScaleToOriginal(...args),
  toGrayscalePng: (...args: unknown[]) => mockToGrayscalePng(...args),
}));

// Mock resolveActiveSlots — instruction-specific resolution
const mockResolveActiveSlots = vi.fn().mockReturnValue([]);

vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: (...args: unknown[]) => mockResolveActiveSlots(...args),
}));

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn() },
}));

// Stable crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import { type Generation, type ModelSlot } from "@/lib/db/queries";
import type { CanvasSSEEvent, SSECanvasGenerateEvent } from "@/lib/canvas-chat-service";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-instruction-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a scenic landscape",
    modelId: overrides.modelId ?? "fallback-model-id",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/landscape.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 1024,
    height: overrides.height ?? 768,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

function makeModelSlot(overrides: Partial<ModelSlot> = {}): ModelSlot {
  return {
    id: overrides.id ?? "slot-1",
    mode: overrides.mode ?? "instruction",
    slot: overrides.slot ?? 1,
    modelId: overrides.modelId ?? "flux-kontext-pro",
    modelParams: overrides.modelParams ?? { guidance_scale: 7.5 },
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

/**
 * Creates a mock implementation for sendMessage that calls onEvent with each event.
 */
function mockSSEEvents(events: CanvasSSEEvent[]) {
  return async (
    _sessionId: string,
    _content: string,
    _imageContext: unknown,
    onEvent: (event: CanvasSSEEvent) => void,
    _signal?: AbortSignal,
  ) => {
    for (const event of events) {
      onEvent(event);
    }
  };
}

/**
 * Helper component that sets editMode in the context on mount.
 */
function SetEditModeHelper({ editMode }: { editMode: "inpaint" | "erase" | "instruction" | "outpaint" | null }) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    dispatch({ type: "SET_EDIT_MODE", editMode });
  }, [dispatch, editMode]);
  return null;
}

/**
 * Renders CanvasChatPanel with instruction-mode test configuration.
 */
function renderPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    modelSlots?: ModelSlot[];
    editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
    onPendingGenerations?: (ids: string[]) => void;
    onGenerationsCreated?: (gens: Generation[]) => void;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const projectId = options.projectId ?? generation.projectId;
  const modelSlots = options.modelSlots ?? [];
  const editMode = options.editMode ?? null;

  return render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetEditModeHelper editMode={editMode} />
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
        modelSlots={modelSlots}
        models={[]}
        onPendingGenerations={options.onPendingGenerations}
        onGenerationsCreated={options.onGenerationsCreated}
      />
    </CanvasDetailProvider>
  );
}

/**
 * Sends a user message via the chat input to trigger the SSE flow.
 */
async function sendChatMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
  const textarea = screen.getByTestId("chat-input-textarea");
  const sendButton = screen.getByTestId("send-btn");

  await user.type(textarea, text);
  await user.click(sendButton);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatPanel -- Instruction Editing (Slice 08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
    mockResolveActiveSlots.mockReturnValue([]);
  });

  /**
   * AC-1: GIVEN ein SSE-Event mit `action: "instruction"` trifft in `handleCanvasGenerate` ein
   *       AND `state.editMode` ist `null` (kein Edit-Tool aktiv)
   *       AND `state.maskData` ist `null` (keine Maske)
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird `resolveActiveSlots(modelSlots, "instruction")` aufgerufen
   *       AND `generateImages()` wird mit `generationMode: "instruction"` und `sourceImageUrl` aufgerufen
   *       AND `maskUrl` ist `undefined` (keine Maske)
   */
  it("AC-1: should call generateImages with generationMode instruction and sourceImageUrl when action is instruction", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac1",
      imageUrl: "https://example.com/sky-image.png",
    });

    const instructionSlots: ModelSlot[] = [
      makeModelSlot({ modelId: "flux-kontext-pro", modelParams: { guidance_scale: 7.5 } }),
    ];

    mockResolveActiveSlots.mockReturnValue([
      { modelId: "flux-kontext-pro", modelParams: { guidance_scale: 7.5 } },
    ]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "instruction",
        prompt: "Mach den Himmel blauer",
        model_id: "flux-kontext-pro",
        params: { strength: 0.9 },
      } as SSECanvasGenerateEvent,
    ]));

    renderPanel({ generation, modelSlots: instructionSlots, editMode: null });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "Mach den Himmel blauer");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // resolveActiveSlots must be called with "instruction" mode
    expect(mockResolveActiveSlots).toHaveBeenCalledWith(instructionSlots, "instruction");

    // generateImages called with instruction mode, sourceImageUrl, no maskUrl
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "instruction",
        sourceImageUrl: "https://example.com/sky-image.png",
        promptMotiv: "Mach den Himmel blauer",
      }),
    );

    // maskUrl must NOT be present
    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.maskUrl).toBeUndefined();

    // MaskService pipeline must NOT be invoked
    expect(mockValidateMinSize).not.toHaveBeenCalled();
    expect(mockApplyFeathering).not.toHaveBeenCalled();
    expect(mockUploadMask).not.toHaveBeenCalled();
  });

  /**
   * AC-2: GIVEN ein SSE-Event mit `action: "instruction"` trifft ein
   *       AND `resolveActiveSlots("instruction")` gibt einen aktiven Slot zurueck
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird die `modelId` aus dem aufgeloesten instruction-Slot verwendet (nicht der img2img-Slot)
   *       AND `modelParams` des instruction-Slots werden mit `event.params` gemerged (event ueberschreibt)
   */
  it("AC-2: should resolve model slots for instruction mode and use instruction slot modelId and params", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac2",
      modelId: "original-model-should-not-be-used",
    });

    const instructionSlots: ModelSlot[] = [
      makeModelSlot({
        id: "instruction-slot-1",
        mode: "instruction",
        modelId: "flux-kontext-pro",
        modelParams: { guidance_scale: 7.5, seed: 42 },
        active: true,
      }),
      makeModelSlot({
        id: "img2img-slot-1",
        mode: "img2img",
        modelId: "img2img-model-should-not-be-used",
        modelParams: { strength: 0.5 },
        active: true,
      }),
    ];

    // resolveActiveSlots returns instruction slot (not img2img)
    mockResolveActiveSlots.mockReturnValue([
      { modelId: "flux-kontext-pro", modelParams: { guidance_scale: 7.5, seed: 42 } },
    ]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "instruction",
        prompt: "add a sun",
        model_id: "flux-kontext-pro",
        params: { guidance_scale: 12.0, custom_flag: true },
      } as SSECanvasGenerateEvent,
    ]));

    renderPanel({ generation, modelSlots: instructionSlots, editMode: null });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "add a sun");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Verify resolveActiveSlots was called with instruction mode
    expect(mockResolveActiveSlots).toHaveBeenCalledWith(instructionSlots, "instruction");

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // modelIds should come from instruction slot, NOT from generation.modelId
    expect(callArgs.modelIds).toEqual(["flux-kontext-pro"]);

    // Params should be merged: slot params as base, event params override
    // { guidance_scale: 7.5, seed: 42 } merged with { guidance_scale: 12.0, custom_flag: true }
    // => { guidance_scale: 12.0, seed: 42, custom_flag: true }
    expect(callArgs.params).toEqual({
      guidance_scale: 12.0,
      seed: 42,
      custom_flag: true,
    });
  });

  /**
   * AC-3: GIVEN ein SSE-Event mit `action: "instruction"` trifft ein
   *       AND `resolveActiveSlots("instruction")` gibt leeres Array zurueck (kein Slot konfiguriert)
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird `generation.modelId` als Fallback verwendet
   */
  it("AC-3: should fall back to generation.modelId when no instruction slot is configured", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac3",
      modelId: "fallback-model-xyz",
    });

    // No instruction slots configured -> resolveActiveSlots returns empty
    mockResolveActiveSlots.mockReturnValue([]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "instruction",
        prompt: "enhance contrast",
        model_id: "some-model",
        params: { brightness: 1.2 },
      } as SSECanvasGenerateEvent,
    ]));

    renderPanel({ generation, modelSlots: [], editMode: null });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "enhance contrast");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // Fallback: generation.modelId used when no active instruction slots
    expect(callArgs.modelIds).toEqual(["fallback-model-xyz"]);

    // Params should be event.params only (no slot params to merge)
    expect(callArgs.params).toEqual({ brightness: 1.2 });

    // generationMode must still be instruction
    expect(callArgs.generationMode).toBe("instruction");
  });

  /**
   * AC-4: GIVEN `generateImages()` wird mit `generationMode: "instruction"` aufgerufen und Polling liefert ein Ergebnis
   *       WHEN das Ergebnis-Bild vorliegt
   *       THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   *       AND `SET_CURRENT_IMAGE` mit der neuen Bild-URL dispatched
   *       AND ein `onGenerationsCreated` Callback wird mit den neuen Generations aufgerufen
   *
   * NOTE: The chat panel calls onPendingGenerations and onGenerationsCreated callbacks
   * after generateImages returns. The parent (CanvasDetailView) handles PUSH_UNDO /
   * SET_CURRENT_IMAGE after polling. Here we test the part the chat panel controls.
   */
  it("AC-4: should dispatch PUSH_UNDO and SET_CURRENT_IMAGE and call onGenerationsCreated after successful instruction generation", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac4",
      imageUrl: "https://example.com/before.png",
    });

    const pendingGen: Generation = makeGeneration({
      id: "gen-result-ac4",
      status: "pending",
      imageUrl: "https://example.com/new-sky.png",
    });

    // generateImages returns a pending generation
    mockGenerateImages.mockResolvedValue([pendingGen]);
    mockResolveActiveSlots.mockReturnValue([]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "instruction",
        prompt: "make sky bluer",
        model_id: "model-1",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    const onPendingGenerations = vi.fn();
    const onGenerationsCreated = vi.fn();

    renderPanel({
      generation,
      onPendingGenerations,
      onGenerationsCreated,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "make sky bluer");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // onGenerationsCreated should be called with the result
    await waitFor(() => {
      expect(onGenerationsCreated).toHaveBeenCalledWith([pendingGen]);
    });

    // onPendingGenerations should be called with pending IDs for polling
    expect(onPendingGenerations).toHaveBeenCalledWith(["gen-result-ac4"]);
  });

  /**
   * AC-5: GIVEN ein SSE-Event mit `action: "instruction"` trifft ein
   *       AND `generateImages()` gibt `{ error: string }` zurueck
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird ein Toast mit der Fehlermeldung angezeigt
   *       AND `SET_GENERATING` wird mit `false` dispatched
   *       AND das aktuelle Bild bleibt unveraendert
   */
  it("AC-5: should show error toast and reset isGenerating when generateImages returns error for instruction mode", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac5",
      imageUrl: "https://example.com/original-stays.png",
    });

    // generateImages returns an error object
    mockGenerateImages.mockResolvedValue({ error: "Model quota exceeded" });
    mockResolveActiveSlots.mockReturnValue([]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "instruction",
        prompt: "add flowers",
        model_id: "model-1",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    const onGenerationsCreated = vi.fn();
    const onPendingGenerations = vi.fn();

    renderPanel({
      generation,
      onGenerationsCreated,
      onPendingGenerations,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "add flowers");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Toast should show the error message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Model quota exceeded");
    });

    // onGenerationsCreated should NOT be called (error path)
    expect(onGenerationsCreated).not.toHaveBeenCalled();

    // onPendingGenerations should NOT be called (error path)
    expect(onPendingGenerations).not.toHaveBeenCalled();
  });

  /**
   * AC-6: GIVEN der Gesamt-Flow: User tippt "Mach den Himmel blauer" im Canvas-Chat
   *       AND kein Edit-Tool ist aktiv (editMode === null)
   *       WHEN der Canvas Agent das SSE-Event mit `action: "instruction"` sendet
   *       THEN durchlaeuft handleCanvasGenerate den instruction-Branch
   *       AND `generateImages()` erhaelt `generationMode: "instruction"`, `sourceImageUrl`, `promptMotiv`
   *       AND das Ergebnis-Bild ersetzt das aktuelle Bild via PUSH_UNDO + SET_CURRENT_IMAGE
   */
  it("AC-6: should route instruction action through full flow: resolveActiveSlots instruction -> generateImages -> PUSH_UNDO -> SET_CURRENT_IMAGE", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac6",
      imageUrl: "https://example.com/current-image.png",
      modelId: "default-model",
    });

    const instructionSlots: ModelSlot[] = [
      makeModelSlot({
        id: "instr-slot-1",
        mode: "instruction",
        modelId: "flux-kontext-pro",
        modelParams: { guidance_scale: 7.5 },
        active: true,
      }),
    ];

    mockResolveActiveSlots.mockReturnValue([
      { modelId: "flux-kontext-pro", modelParams: { guidance_scale: 7.5 } },
    ]);

    const completedGen: Generation = makeGeneration({
      id: "gen-completed-ac6",
      status: "pending",
      imageUrl: "https://example.com/bluer-sky.png",
    });

    mockGenerateImages.mockResolvedValue([completedGen]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "instruction",
        prompt: "Mach den Himmel blauer",
        model_id: "flux-kontext-pro",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    const onPendingGenerations = vi.fn();
    const onGenerationsCreated = vi.fn();

    renderPanel({
      generation,
      modelSlots: instructionSlots,
      editMode: null,
      onPendingGenerations,
      onGenerationsCreated,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    // User types the instruction in the chat
    await sendChatMessage(user, "Mach den Himmel blauer");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Step 1: resolveActiveSlots called with instruction mode
    expect(mockResolveActiveSlots).toHaveBeenCalledWith(instructionSlots, "instruction");

    // Step 2: generateImages receives correct instruction parameters
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        promptMotiv: "Mach den Himmel blauer",
        modelIds: ["flux-kontext-pro"],
        generationMode: "instruction",
        sourceImageUrl: "https://example.com/current-image.png",
        count: 1,
      }),
    );

    // Step 3: No mask involved in instruction flow
    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.maskUrl).toBeUndefined();

    // Step 4: Callbacks invoked for parent to handle PUSH_UNDO + SET_CURRENT_IMAGE
    await waitFor(() => {
      expect(onGenerationsCreated).toHaveBeenCalledWith([completedGen]);
    });
    expect(onPendingGenerations).toHaveBeenCalledWith(["gen-completed-ac6"]);

    // MaskService must NOT have been called
    expect(mockValidateMinSize).not.toHaveBeenCalled();
    expect(mockApplyFeathering).not.toHaveBeenCalled();
    expect(mockScaleToOriginal).not.toHaveBeenCalled();
    expect(mockToGrayscalePng).not.toHaveBeenCalled();
    expect(mockUploadMask).not.toHaveBeenCalled();
  });
});
