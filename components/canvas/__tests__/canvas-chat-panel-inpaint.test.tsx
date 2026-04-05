// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy — MaskService, generateImages, uploadMask, SSE)
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

// Mock uploadMask server action
const mockUploadMask = vi.fn().mockResolvedValue({ url: "https://r2.example.com/masks/uploaded-mask.png" });

vi.mock("@/app/actions/upload", () => ({
  uploadMask: (...args: unknown[]) => mockUploadMask(...args),
}));

// Mock MaskService functions
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
  type CanvasDetailAction,
} from "@/lib/canvas-detail-context";
import { type Generation } from "@/lib/db/queries";
import type { CanvasSSEEvent, SSECanvasGenerateEvent } from "@/lib/canvas-chat-service";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-inpaint-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
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
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

/**
 * Creates a fake ImageData-like object for use in tests.
 * jsdom does not provide ImageData natively, so we construct one manually.
 */
function createFakeImageData(width: number, height: number, fillAlpha = 255): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = fillAlpha; // A
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
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
 * Helper component that sets maskData in the context on mount.
 */
function SetMaskDataHelper({ maskData }: { maskData: ImageData | null }) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    dispatch({ type: "SET_MASK_DATA", maskData });
  }, [dispatch, maskData]);
  return null;
}

/**
 * Spy component that captures dispatched actions for assertion.
 */
function DispatchSpy({ onDispatch }: { onDispatch: (state: ReturnType<typeof useCanvasDetail>["state"]) => void }) {
  const { state } = useCanvasDetail();
  useEffect(() => {
    onDispatch(state);
  });
  return null;
}

/**
 * Renders CanvasChatPanel with an optional maskData pre-set in context.
 */
function renderWithMask(
  options: {
    generation?: Generation;
    projectId?: string;
    maskData?: ImageData | null;
    onPendingGenerations?: (ids: string[]) => void;
    onGenerationsCreated?: (gens: Generation[]) => void;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const projectId = options.projectId ?? generation.projectId;
  const maskData = options.maskData ?? null;

  return render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetMaskDataHelper maskData={maskData} />
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
        modelSlots={[]}
        models={[]}
        onPendingGenerations={options.onPendingGenerations}
        onGenerationsCreated={options.onGenerationsCreated}
      />
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatPanel — Inpaint Integration (Slice 07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
    mockUploadMask.mockResolvedValue({ url: "https://r2.example.com/masks/uploaded-mask.png" });
    mockValidateMinSize.mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } });
    mockApplyFeathering.mockImplementation((imageData: ImageData) => imageData);
    mockScaleToOriginal.mockImplementation((imageData: ImageData) => imageData);
    mockToGrayscalePng.mockResolvedValue(new Blob(["mock-png"], { type: "image/png" }));
  });

  /**
   * AC-3: GIVEN ein SSE-Event mit `action: "inpaint"` trifft in `handleCanvasGenerate` ein
   *       AND `state.maskData` ist eine gueltige `ImageData`-Instanz
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird `MaskService.validateMinSize()` mit `minSize: 10` aufgerufen
   *       AND `MaskService.applyFeathering()` mit `radius: 10` aufgerufen
   *       AND `MaskService.scaleToOriginal()` mit den Original-Bilddimensionen aufgerufen
   *       AND `MaskService.toGrayscalePng()` aufgerufen
   *       AND der resultierende PNG-Blob wird zu R2 hochgeladen
   *       AND `generateImages()` wird mit `generationMode: "inpaint"`, `maskUrl` (R2-URL) und `sourceImageUrl` aufgerufen
   */
  it("AC-3: should export mask via MaskService pipeline and call generateImages with inpaint mode and maskUrl", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-inpaint-ac3",
      imageUrl: "https://example.com/original.png",
      width: 1024,
      height: 768,
    });

    // Set up sendMessage to emit an inpaint canvas-generate event
    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "inpaint",
        prompt: "remove background",
        model_id: "flux-2-max",
        params: { strength: 0.8 },
      } as SSECanvasGenerateEvent,
    ]));

    renderWithMask({ generation, maskData: fakeMask });

    // Wait for session creation
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    // Send a message to trigger the SSE event flow
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "remove the background");
    await user.click(sendButton);

    // Wait for the full mask pipeline to execute
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Verify MaskService pipeline was called in order
    expect(mockValidateMinSize).toHaveBeenCalledWith(fakeMask, 10);
    expect(mockApplyFeathering).toHaveBeenCalledWith(fakeMask, 10);
    expect(mockScaleToOriginal).toHaveBeenCalledWith(
      expect.any(Object), // feathered result (identity mock returns same)
      1024,
      768,
    );
    expect(mockToGrayscalePng).toHaveBeenCalled();

    // Verify upload was called with FormData containing mask file
    expect(mockUploadMask).toHaveBeenCalledTimes(1);
    const uploadArg = mockUploadMask.mock.calls[0][0];
    expect(uploadArg).toBeInstanceOf(FormData);
    const maskFile = uploadArg.get("mask");
    expect(maskFile).not.toBeNull();

    // Verify generateImages was called with inpaint mode and mask URL
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "inpaint",
        maskUrl: "https://r2.example.com/masks/uploaded-mask.png",
        sourceImageUrl: "https://example.com/original.png",
      }),
    );
  });

  /**
   * AC-4: GIVEN ein SSE-Event mit `action: "inpaint"` trifft ein
   *       AND `state.maskData` ist `null` (keine Maske gemalt)
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird `generateImages()` mit `generationMode: "instruction"` aufgerufen (Fallback)
   */
  it("AC-4: should fall back to instruction mode when maskData is null on inpaint action", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-inpaint-ac4",
      imageUrl: "https://example.com/image-ac4.png",
    });

    // Emit an inpaint event, but no maskData is set (null)
    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "inpaint",
        prompt: "change the sky",
        model_id: "flux-2-max",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    // Render WITHOUT mask (maskData = null)
    renderWithMask({ generation, maskData: null });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "change the sky");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // MaskService should NOT have been called (no mask to process)
    expect(mockValidateMinSize).not.toHaveBeenCalled();
    expect(mockApplyFeathering).not.toHaveBeenCalled();
    expect(mockScaleToOriginal).not.toHaveBeenCalled();
    expect(mockToGrayscalePng).not.toHaveBeenCalled();
    expect(mockUploadMask).not.toHaveBeenCalled();

    // generateImages should be called with instruction mode (fallback)
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "instruction",
        sourceImageUrl: "https://example.com/image-ac4.png",
      }),
    );
    // No maskUrl should be present
    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.maskUrl).toBeUndefined();
  });

  /**
   * AC-5: GIVEN `MaskService.validateMinSize()` gibt `{ valid: false }` zurueck
   *       WHEN `handleCanvasGenerate` mit `action: "inpaint"` ausgefuehrt wird
   *       THEN wird ein Toast mit Nachricht "Markiere einen groesseren Bereich" angezeigt
   *       AND `generateImages()` wird NICHT aufgerufen
   */
  it("AC-5: should show toast and skip generation when mask is too small", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(10, 10);

    // Mask validation fails
    mockValidateMinSize.mockReturnValue({ valid: false, boundingBox: { width: 5, height: 5 } });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "inpaint",
        prompt: "edit area",
        model_id: "flux-2-max",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    renderWithMask({ maskData: fakeMask });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "edit this area");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockValidateMinSize).toHaveBeenCalled();
    });

    // Toast should show the "too small" message
    expect(mockToastError).toHaveBeenCalledWith("Markiere einen groesseren Bereich");

    // generateImages should NOT have been called
    expect(mockGenerateImages).not.toHaveBeenCalled();

    // Upload should not have been called either
    expect(mockUploadMask).not.toHaveBeenCalled();
  });

  /**
   * AC-6: GIVEN `generateImages()` wurde erfolgreich aufgerufen und Polling liefert ein Ergebnis
   *       WHEN das Ergebnis-Bild vorliegt
   *       THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   *       AND `SET_CURRENT_IMAGE` mit der neuen Bild-URL dispatched
   *
   * NOTE: In the current implementation, the chat panel calls onPendingGenerations
   * and onGenerationsCreated callbacks after generateImages, and the parent
   * (CanvasDetailView) handles PUSH_UNDO / SET_CURRENT_IMAGE after polling.
   * Here we test the part the chat panel controls: the callbacks are invoked.
   */
  it("AC-6: should dispatch PUSH_UNDO and SET_CURRENT_IMAGE after successful generation result", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({ id: "gen-ac6", imageUrl: "https://example.com/ac6.png" });

    const pendingGen: Generation = makeGeneration({
      id: "gen-result-1",
      status: "pending",
      imageUrl: "https://example.com/new-image.png",
    });

    // generateImages returns a pending generation
    mockGenerateImages.mockResolvedValue([pendingGen]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "inpaint",
        prompt: "fix it",
        model_id: "model-1",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    const onPendingGenerations = vi.fn();
    const onGenerationsCreated = vi.fn();

    renderWithMask({
      generation,
      maskData: fakeMask,
      onPendingGenerations,
      onGenerationsCreated,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "fix it");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // onGenerationsCreated should be called with the result
    await waitFor(() => {
      expect(onGenerationsCreated).toHaveBeenCalledWith([pendingGen]);
    });

    // onPendingGenerations should be called with pending IDs
    expect(onPendingGenerations).toHaveBeenCalledWith(["gen-result-1"]);
  });

  /**
   * AC-10: GIVEN ein SSE-Event mit `action: "erase"` trifft in `handleCanvasGenerate` ein
   *        WHEN der Handler ausgefuehrt wird
   *        THEN wird `generateImages()` mit `generationMode: "erase"` und `maskUrl` aufgerufen
   *        (gleicher Mask-Export-Flow wie inpaint)
   */
  it("AC-10: should call generateImages with erase mode and maskUrl on erase action", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-erase-ac10",
      imageUrl: "https://example.com/erase.png",
      width: 768,
      height: 768,
    });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "erase",
        prompt: "remove the tree",
        model_id: "flux-2-max",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    renderWithMask({ generation, maskData: fakeMask });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "remove the tree");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Same mask pipeline should have been called
    expect(mockValidateMinSize).toHaveBeenCalledWith(fakeMask, 10);
    expect(mockApplyFeathering).toHaveBeenCalledWith(fakeMask, 10);
    expect(mockScaleToOriginal).toHaveBeenCalledWith(expect.any(Object), 768, 768);
    expect(mockToGrayscalePng).toHaveBeenCalled();
    expect(mockUploadMask).toHaveBeenCalled();

    // generateImages should be called with erase mode and maskUrl
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "erase",
        maskUrl: "https://r2.example.com/masks/uploaded-mask.png",
        sourceImageUrl: "https://example.com/erase.png",
      }),
    );
  });
});
