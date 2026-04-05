// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Slider/Tooltip use these internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number = 0;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec — MaskService, generateImages,
// uploadMask, R2, useCanvasDetail for unit tests)
// ---------------------------------------------------------------------------

// Stable crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock lucide-react icons
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
    PanelLeftOpen: stub("PanelLeftOpen"), Paintbrush: stub("Paintbrush"),
    Eraser: stub("Eraser"), MousePointerClick: stub("MousePointerClick"),
    Expand: stub("Expand"),
  };
});

// Mock model selector
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

// Mock fetchGenerations for polling
const mockFetchGenerations = vi.fn().mockResolvedValue([]);

vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: vi.fn().mockResolvedValue({}),
  fetchGenerations: (...args: unknown[]) => mockFetchGenerations(...args),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
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

// Mock model-slots server action
vi.mock("@/app/actions/model-slots", () => ({
  getModelSlots: vi.fn().mockResolvedValue([]),
}));

// Mock model actions
vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock references server action
vi.mock("@/app/actions/references", () => ({
  getProvenanceData: vi.fn().mockResolvedValue([]),
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "gallery-ref-1" }),
}));

// Mock lib/utils to avoid real download/image utilities
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// Mock db/queries to prevent DATABASE_URL error
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
}));

// Mock model settings
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([]),
}));

// Mock siblings
vi.mock("@/app/actions/generations", async (importOriginal) => {
  // This re-declaration is needed to layer getSiblingGenerations
  // The actual mock values are assigned via the top-level mocks above
  return {
    generateImages: (...args: unknown[]) => mockGenerateImages(...args),
    upscaleImage: vi.fn().mockResolvedValue({}),
    fetchGenerations: (...args: unknown[]) => mockFetchGenerations(...args),
    deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
    getSiblingGenerations: vi.fn().mockResolvedValue([]),
  };
});

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
import { FloatingBrushToolbar } from "@/components/canvas/floating-brush-toolbar";
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
    id: overrides.id ?? "gen-erase-1",
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
 * Helper component that sets maskData and editMode in the context on mount.
 */
function SetContextHelper({
  maskData,
  editMode,
}: {
  maskData?: ImageData | null;
  editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
}) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    if (editMode !== undefined) {
      dispatch({ type: "SET_EDIT_MODE", editMode });
    }
    if (maskData !== undefined) {
      dispatch({ type: "SET_MASK_DATA", maskData });
    }
  }, [dispatch, maskData, editMode]);
  return null;
}

/**
 * Spy component that captures current state for assertion.
 */
function StateSpy({ onState }: { onState: (state: ReturnType<typeof useCanvasDetail>["state"]) => void }) {
  const { state } = useCanvasDetail();
  useEffect(() => {
    onState(state);
  });
  return null;
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
 * Renders CanvasDetailView wrapped in CanvasDetailProvider with context helpers.
 * Used for integration/acceptance tests that test the full handleEraseAction pipeline.
 */
function renderDetailViewWithContext(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    onGenerationsCreated?: (gens: Generation[]) => void;
    maskData?: ImageData | null;
    editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
    chatSlot?: React.ReactNode;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const allGenerations = options.allGenerations ?? [generation];
  const onBack = options.onBack ?? vi.fn();

  return render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetContextHelper
        maskData={options.maskData}
        editMode={options.editMode}
      />
      <CanvasDetailView
        generation={generation}
        allGenerations={allGenerations}
        onBack={onBack}
        onGenerationsCreated={options.onGenerationsCreated}
        chatSlot={options.chatSlot ?? <div data-testid="chat-slot-stub" />}
      />
    </CanvasDetailProvider>
  );
}

/**
 * Renders CanvasChatPanel with context helpers for erase-to-inpaint upgrade tests.
 */
function renderChatWithContext(
  options: {
    generation?: Generation;
    projectId?: string;
    maskData?: ImageData | null;
    editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
    onPendingGenerations?: (ids: string[]) => void;
    onGenerationsCreated?: (gens: Generation[]) => void;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetContextHelper
        maskData={options.maskData}
        editMode={options.editMode}
      />
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
// Hoisted mock values for FloatingBrushToolbar unit tests
// ---------------------------------------------------------------------------

const { mockDispatch, mockState } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockState: {
    currentGenerationId: "gen-1",
    lastImageChangeSource: null as string | null,
    activeToolId: null as string | null,
    undoStack: [] as string[],
    redoStack: [] as string[],
    isGenerating: false,
    chatSessionId: null as string | null,
    editMode: null as string | null,
    maskData: null as unknown,
    brushSize: 40,
    brushTool: "brush" as "brush" | "eraser",
    outpaintDirections: [] as string[],
    outpaintSize: 50 as number,
  },
}));

function resetMockState(overrides: Partial<typeof mockState> = {}) {
  Object.assign(mockState, {
    currentGenerationId: "gen-1",
    lastImageChangeSource: null,
    activeToolId: null,
    undoStack: [],
    redoStack: [],
    isGenerating: false,
    chatSessionId: null,
    editMode: null,
    maskData: null,
    brushSize: 40,
    brushTool: "brush",
    outpaintDirections: [],
    outpaintSize: 50,
    ...overrides,
  });
}

// ===========================================================================
// Test Suite: Erase Direct Flow (slice-09)
// ===========================================================================

describe("Erase Direct Flow — Slice 09 Acceptance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
    mockFetchGenerations.mockResolvedValue([]);
    mockUploadMask.mockResolvedValue({ url: "https://r2.example.com/masks/uploaded-mask.png" });
    mockValidateMinSize.mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } });
    mockApplyFeathering.mockImplementation((imageData: ImageData) => imageData);
    mockScaleToOriginal.mockImplementation((imageData: ImageData) => imageData);
    mockToGrayscalePng.mockResolvedValue(new Blob(["mock-png"], { type: "image/png" }));
  });

  // =========================================================================
  // AC-1: Erase-Action fuehrt Mask-Pipeline aus und ruft generateImages
  //        direkt auf (kein SSE/Agent)
  //
  // GIVEN der User ist im Erase-Modus (editMode === "erase") und hat eine
  //       gueltige Maske gemalt
  // WHEN der User den erase-action-btn ("Entfernen") in der
  //      FloatingBrushToolbar klickt
  // THEN wird die Mask-Export-Pipeline ausgefuehrt:
  //      MaskService.validateMinSize(minSize: 10) -> applyFeathering(radius: 10)
  //      -> scaleToOriginal() -> toGrayscalePng()
  // AND der resultierende PNG-Blob wird zu R2 hochgeladen (Prefix masks/)
  // AND generateImages() wird direkt aufgerufen mit generationMode: "erase",
  //     maskUrl (R2-URL) und sourceImageUrl (aktuelles Bild)
  // AND kein SSE-Stream / Canvas Agent wird involviert
  // =========================================================================
  it("AC-1: should run mask export pipeline and call generateImages with mode erase directly without SSE", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-erase-ac1",
      imageUrl: "https://example.com/source.png",
      width: 1024,
      height: 768,
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-result-ac1", status: "completed" }),
    ]);

    renderDetailViewWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    // Find and click the erase action button
    const eraseBtn = await screen.findByTestId("erase-action-btn");
    expect(eraseBtn).not.toBeDisabled();

    await user.click(eraseBtn);

    // Wait for the full mask pipeline to execute
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Verify MaskService pipeline was called in correct order with correct params
    expect(mockValidateMinSize).toHaveBeenCalledWith(fakeMask, 10);
    expect(mockApplyFeathering).toHaveBeenCalledWith(fakeMask, 10);
    expect(mockScaleToOriginal).toHaveBeenCalledWith(
      expect.any(Object), // feathered result (identity mock returns same)
      1024,
      768,
    );
    expect(mockToGrayscalePng).toHaveBeenCalled();

    // Verify R2 upload was called with FormData containing mask file
    expect(mockUploadMask).toHaveBeenCalledTimes(1);
    const uploadArg = mockUploadMask.mock.calls[0][0];
    expect(uploadArg).toBeInstanceOf(FormData);
    const maskFile = uploadArg.get("mask");
    expect(maskFile).not.toBeNull();

    // Verify generateImages was called directly with erase mode
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "erase",
        maskUrl: "https://r2.example.com/masks/uploaded-mask.png",
        sourceImageUrl: "https://example.com/source.png",
      }),
    );

    // Verify no SSE / sendMessage was called (direct call, no agent)
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-2: PUSH_UNDO und SET_CURRENT_IMAGE nach erfolgreichem Erase-Ergebnis
  //
  // GIVEN der Erase-Action wurde ausgefuehrt und generateImages() + Polling
  //       liefern ein Ergebnis-Bild
  // WHEN das Ergebnis vorliegt
  // THEN wird PUSH_UNDO mit dem aktuellen Bild dispatched
  // AND SET_CURRENT_IMAGE mit der neuen Bild-URL dispatched
  // AND die Maske bleibt im State erhalten (User kann iterieren)
  // =========================================================================
  it("AC-2: should dispatch PUSH_UNDO and SET_CURRENT_IMAGE after successful erase generation", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-erase-ac2",
      imageUrl: "https://example.com/original-ac2.png",
      width: 512,
      height: 512,
    });

    const pendingGen = makeGeneration({
      id: "gen-result-ac2",
      status: "pending",
      imageUrl: null,
    });

    const completedGen = makeGeneration({
      id: "gen-result-ac2",
      status: "completed",
      imageUrl: "https://example.com/erased-result.png",
    });

    // generateImages returns a pending generation
    mockGenerateImages.mockResolvedValue([pendingGen]);

    // Polling returns the completed generation
    mockFetchGenerations.mockResolvedValue([completedGen]);

    // Capture state changes
    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    const { container } = render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <SetContextHelper maskData={fakeMask} editMode="erase" />
        <StateSpy onState={(s) => { latestState = s; }} />
        <CanvasDetailView
          generation={generation}
          allGenerations={[generation]}
          onBack={vi.fn()}
          chatSlot={<div data-testid="chat-slot-stub" />}
        />
      </CanvasDetailProvider>,
    );

    // Click erase action button
    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    // Wait for generateImages and then polling to resolve
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Polling should eventually pick up the completed generation
    await waitFor(() => {
      expect(mockFetchGenerations).toHaveBeenCalled();
    });

    // After polling resolves, PUSH_UNDO should have been dispatched
    // which pushes old gen to undo stack and sets current to new gen
    await waitFor(() => {
      expect(latestState).not.toBeNull();
      // The undo stack should contain the original generation ID
      expect(latestState!.undoStack).toContain("gen-erase-ac2");
      // currentGenerationId should now be the new result
      expect(latestState!.currentGenerationId).toBe("gen-result-ac2");
    });

    // Mask should still be present in state (user can iterate)
    expect(latestState!.maskData).not.toBeNull();
  });

  // =========================================================================
  // AC-3: Toast bei zu kleiner Maske, kein generateImages-Aufruf
  //
  // GIVEN der User ist im Erase-Modus und hat eine Maske gemalt
  // WHEN MaskService.validateMinSize() { valid: false } zurueckgibt
  // THEN wird ein Toast mit "Markiere einen groesseren Bereich" angezeigt
  // AND generateImages() wird NICHT aufgerufen
  // =========================================================================
  it("AC-3: should show toast and skip generation when mask validation fails", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(10, 10);
    const generation = makeGeneration({
      id: "gen-erase-ac3",
      imageUrl: "https://example.com/ac3.png",
    });

    // Mask validation fails
    mockValidateMinSize.mockReturnValue({ valid: false, boundingBox: { width: 5, height: 5 } });

    renderDetailViewWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    // Wait for validation to run
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

  // =========================================================================
  // AC-4: Erase-Action-Button disabled wenn keine Maske vorhanden
  //
  // GIVEN der User ist im Erase-Modus und hat KEINE Maske gemalt
  //       (maskData === null)
  // WHEN der User den erase-action-btn klickt
  // THEN ist der Button disabled und kein Aufruf erfolgt
  // =========================================================================
  it("AC-4: should disable erase action button when maskData is null", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-erase-ac4",
      imageUrl: "https://example.com/ac4.png",
    });

    renderDetailViewWithContext({
      generation,
      maskData: null,
      editMode: "erase",
    });

    const eraseBtn = await screen.findByTestId("erase-action-btn");

    // Button should be disabled
    expect(eraseBtn).toBeDisabled();

    // Click the disabled button
    await user.click(eraseBtn);

    // No mask pipeline or generateImages should be called
    expect(mockValidateMinSize).not.toHaveBeenCalled();
    expect(mockGenerateImages).not.toHaveBeenCalled();
    expect(mockUploadMask).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-5: Chat-Prompt im Erase-Modus stuft zu Inpaint hoch
  //
  // GIVEN der User ist im Erase-Modus (editMode === "erase") und hat eine
  //       Maske gemalt
  // WHEN der User einen Chat-Prompt sendet (statt "Entfernen" zu klicken)
  // THEN wird der Flow zu Inpaint hochgestuft: generateImages() wird mit
  //      generationMode: "inpaint" und maskUrl + sourceImageUrl + dem Prompt
  //      aufgerufen
  // AND es wird KEIN Erase-Call ausgefuehrt
  // =========================================================================
  it("AC-5: should upgrade to inpaint mode when chat prompt sent in erase mode with mask", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-erase-ac5",
      imageUrl: "https://example.com/ac5-source.png",
      width: 1024,
      height: 768,
    });

    // SSE event from chat triggers an inpaint/erase action
    // When in erase mode with mask + prompt, the code upgrades to inpaint
    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "erase",
        prompt: "replace with flowers",
        model_id: "flux-2-max",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-result-ac5", status: "completed" }),
    ]);

    renderChatWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    // Wait for session creation
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    // Send a chat prompt
    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "replace with flowers");
    await user.click(sendButton);

    // Wait for generateImages to be called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Verify it was called with inpaint mode (upgraded from erase)
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "inpaint",
        maskUrl: "https://r2.example.com/masks/uploaded-mask.png",
        sourceImageUrl: "https://example.com/ac5-source.png",
      }),
    );

    // The prompt should be passed through
    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.promptMotiv).toBe("replace with flowers");

    // Verify it was NOT called with erase mode
    expect(callArgs.generationMode).not.toBe("erase");
  });

  // =========================================================================
  // AC-6: Toast bei R2-Upload-Fehler, kein generateImages-Aufruf
  //
  // GIVEN der R2 Mask-Upload schlaegt fehl
  // WHEN handleEraseAction() ausgefuehrt wird
  // THEN wird ein Toast mit "Mask-Upload fehlgeschlagen" angezeigt
  // AND generateImages() wird NICHT aufgerufen
  // AND die Maske bleibt im State erhalten
  // =========================================================================
  it("AC-6: should show mask upload error toast and preserve mask when R2 upload fails", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-erase-ac6",
      imageUrl: "https://example.com/ac6.png",
    });

    // Upload fails
    mockUploadMask.mockResolvedValue({ error: "R2 storage error" });

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <SetContextHelper maskData={fakeMask} editMode="erase" />
        <StateSpy onState={(s) => { latestState = s; }} />
        <CanvasDetailView
          generation={generation}
          allGenerations={[generation]}
          onBack={vi.fn()}
          chatSlot={<div data-testid="chat-slot-stub" />}
        />
      </CanvasDetailProvider>,
    );

    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    // Wait for upload to be attempted
    await waitFor(() => {
      expect(mockUploadMask).toHaveBeenCalled();
    });

    // Toast should show upload failure message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Mask-Upload fehlgeschlagen");
    });

    // generateImages should NOT have been called
    expect(mockGenerateImages).not.toHaveBeenCalled();

    // Mask should still be in state (preserved)
    expect(latestState!.maskData).not.toBeNull();
  });

  // =========================================================================
  // AC-7: UI disabled waehrend Generating-State
  //
  // GIVEN handleEraseAction() laeuft (Generating-State)
  // WHEN der User sich im generating State befindet
  // THEN sind erase-action-btn, alle Toolbar-Buttons und das Chat-Input
  //      disabled
  // =========================================================================
  it("AC-7: should disable erase action button and toolbar during generating state", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-erase-ac7",
      imageUrl: "https://example.com/ac7.png",
    });

    // Make generateImages hang indefinitely to keep generating state true
    let resolveGenerate: ((value: Generation[]) => void) | undefined;
    mockGenerateImages.mockImplementation(
      () => new Promise<Generation[]>((resolve) => { resolveGenerate = resolve; }),
    );

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <SetContextHelper maskData={fakeMask} editMode="erase" />
        <StateSpy onState={(s) => { latestState = s; }} />
        <CanvasDetailView
          generation={generation}
          allGenerations={[generation]}
          onBack={vi.fn()}
          chatSlot={<div data-testid="chat-slot-stub" />}
        />
      </CanvasDetailProvider>,
    );

    // Erase button should be enabled initially
    const eraseBtn = await screen.findByTestId("erase-action-btn");
    expect(eraseBtn).not.toBeDisabled();

    // Click erase to start generating
    await user.click(eraseBtn);

    // Wait for isGenerating to become true
    await waitFor(() => {
      expect(latestState!.isGenerating).toBe(true);
    });

    // Now the erase action button should be disabled
    const eraseBtnAfter = screen.getByTestId("erase-action-btn");
    expect(eraseBtnAfter).toBeDisabled();

    // Toolbar buttons should be disabled
    const brushToggle = screen.getByTestId("brush-tool-toggle");
    expect(brushToggle).toBeDisabled();

    const clearMaskBtn = screen.getByTestId("clear-mask-btn");
    expect(clearMaskBtn).toBeDisabled();

    // Chat toggle should be disabled during generating
    const chatToggle = screen.queryByTestId("chat-toggle-button");
    if (chatToggle) {
      expect(chatToggle).toBeDisabled();
    }

    // Cleanup: resolve the pending generate to avoid warnings
    if (resolveGenerate) {
      await act(async () => {
        resolveGenerate!([makeGeneration({ id: "gen-resolved", status: "completed" })]);
      });
    }
  });
});

// ===========================================================================
// Unit Tests: handleEraseAction details
// ===========================================================================

describe("Erase Direct Flow — Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
    mockFetchGenerations.mockResolvedValue([]);
    mockUploadMask.mockResolvedValue({ url: "https://r2.example.com/masks/uploaded-mask.png" });
    mockValidateMinSize.mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } });
    mockApplyFeathering.mockImplementation((imageData: ImageData) => imageData);
    mockScaleToOriginal.mockImplementation((imageData: ImageData) => imageData);
    mockToGrayscalePng.mockResolvedValue(new Blob(["mock-png"], { type: "image/png" }));
  });

  it("should call scaleToOriginal with generation dimensions when available", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(50, 50);
    const generation = makeGeneration({
      id: "gen-unit-scale",
      imageUrl: "https://example.com/scale-test.png",
      width: 2048,
      height: 1536,
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-result-scale", status: "completed" }),
    ]);

    renderDetailViewWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    await waitFor(() => {
      expect(mockScaleToOriginal).toHaveBeenCalledWith(
        expect.any(Object),
        2048,
        1536,
      );
    });
  });

  it("should pass projectId and sourceGenerationId to generateImages", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-unit-ids",
      projectId: "project-test-123",
      imageUrl: "https://example.com/ids-test.png",
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-result-ids", status: "completed" }),
    ]);

    renderDetailViewWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-test-123",
          sourceGenerationId: "gen-unit-ids",
          generationMode: "erase",
        }),
      );
    });
  });

  it("should set isGenerating back to false when generateImages returns error", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-unit-error",
      imageUrl: "https://example.com/error-test.png",
    });

    // generateImages returns an error
    mockGenerateImages.mockResolvedValue({ error: "Generation failed" });

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        <SetContextHelper maskData={fakeMask} editMode="erase" />
        <StateSpy onState={(s) => { latestState = s; }} />
        <CanvasDetailView
          generation={generation}
          allGenerations={[generation]}
          onBack={vi.fn()}
          chatSlot={<div data-testid="chat-slot-stub" />}
        />
      </CanvasDetailProvider>,
    );

    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Error toast should be shown
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Generation failed");
    });

    // isGenerating should be set back to false
    await waitFor(() => {
      expect(latestState!.isGenerating).toBe(false);
    });
  });

  it("should call onGenerationsCreated callback after successful erase", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-unit-callback",
      imageUrl: "https://example.com/callback-test.png",
    });

    const resultGen = makeGeneration({ id: "gen-callback-result", status: "pending" });
    mockGenerateImages.mockResolvedValue([resultGen]);

    const onGenerationsCreated = vi.fn();

    renderDetailViewWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
      onGenerationsCreated,
    });

    const eraseBtn = await screen.findByTestId("erase-action-btn");
    await user.click(eraseBtn);

    await waitFor(() => {
      expect(onGenerationsCreated).toHaveBeenCalledWith([resultGen]);
    });
  });

  it("should not execute handleEraseAction when already generating", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-unit-double",
      imageUrl: "https://example.com/double-test.png",
    });

    // First call hangs
    let resolveFirst: ((value: Generation[]) => void) | undefined;
    mockGenerateImages.mockImplementationOnce(
      () => new Promise<Generation[]>((resolve) => { resolveFirst = resolve; }),
    );

    renderDetailViewWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    const eraseBtn = await screen.findByTestId("erase-action-btn");

    // First click triggers generating
    await user.click(eraseBtn);

    await waitFor(() => {
      expect(mockValidateMinSize).toHaveBeenCalledTimes(1);
    });

    // Second click should be a no-op because isGenerating is true
    // (the button is also disabled, but this tests the guard in handleEraseAction)
    // Reset call counts to verify no additional calls
    mockValidateMinSize.mockClear();
    mockGenerateImages.mockClear();

    // Try to click again (button disabled due to generating state)
    const eraseBtnAfter = screen.getByTestId("erase-action-btn");
    await user.click(eraseBtnAfter);

    // No additional calls should have been made
    expect(mockValidateMinSize).not.toHaveBeenCalled();
    expect(mockGenerateImages).not.toHaveBeenCalled();

    // Cleanup
    if (resolveFirst) {
      await act(async () => {
        resolveFirst!([]);
      });
    }
  });
});

// ===========================================================================
// Integration Tests: Erase-to-Inpaint Chat Upgrade
// ===========================================================================

describe("Erase Direct Flow — Integration Tests (Chat Upgrade)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
    mockFetchGenerations.mockResolvedValue([]);
    mockUploadMask.mockResolvedValue({ url: "https://r2.example.com/masks/upgraded.png" });
    mockValidateMinSize.mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } });
    mockApplyFeathering.mockImplementation((imageData: ImageData) => imageData);
    mockScaleToOriginal.mockImplementation((imageData: ImageData) => imageData);
    mockToGrayscalePng.mockResolvedValue(new Blob(["mock-png"], { type: "image/png" }));
  });

  it("should call mask pipeline when erase mode chat prompt triggers canvas-generate with erase action", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-int-pipeline",
      imageUrl: "https://example.com/int-pipeline.png",
      width: 800,
      height: 600,
    });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "erase",
        prompt: "fill with grass",
        model_id: "model-1",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-int-result", status: "completed" }),
    ]);

    renderChatWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "fill with grass");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Mask pipeline should have been called
    expect(mockValidateMinSize).toHaveBeenCalled();
    expect(mockApplyFeathering).toHaveBeenCalled();
    expect(mockScaleToOriginal).toHaveBeenCalled();
    expect(mockToGrayscalePng).toHaveBeenCalled();
    expect(mockUploadMask).toHaveBeenCalled();

    // Because there is a prompt, should be upgraded to inpaint
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "inpaint",
        maskUrl: "https://r2.example.com/masks/upgraded.png",
      }),
    );
  });

  it("should show upload error toast via chat path and not call generateImages", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-int-upload-err",
      imageUrl: "https://example.com/int-upload-err.png",
    });

    // Upload fails
    mockUploadMask.mockResolvedValue({ error: "R2 bucket error" });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "erase",
        prompt: "remove it",
        model_id: "model-1",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    renderChatWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "remove it");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockUploadMask).toHaveBeenCalled();
    });

    // Toast should show upload failure
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Mask-Upload fehlgeschlagen");
    });

    // generateImages should NOT have been called
    expect(mockGenerateImages).not.toHaveBeenCalled();
  });

  it("should pass pending generation IDs to onPendingGenerations callback", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(100, 100);
    const generation = makeGeneration({
      id: "gen-int-pending",
      imageUrl: "https://example.com/int-pending.png",
    });

    const pendingGen = makeGeneration({ id: "gen-pending-result", status: "pending" });
    mockGenerateImages.mockResolvedValue([pendingGen]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "erase",
        prompt: "change it",
        model_id: "model-1",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    const onPendingGenerations = vi.fn();

    renderChatWithContext({
      generation,
      maskData: fakeMask,
      editMode: "erase",
      onPendingGenerations,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-btn");

    await user.type(textarea, "change it");
    await user.click(sendButton);

    await waitFor(() => {
      expect(onPendingGenerations).toHaveBeenCalledWith(["gen-pending-result"]);
    });
  });
});
