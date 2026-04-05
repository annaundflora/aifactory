// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice-13 spec)
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

// Mock uploadMask server action (not used for outpaint, but required by import)
const mockUploadMask = vi.fn().mockResolvedValue({ url: "https://r2.example.com/masks/uploaded.png" });

vi.mock("@/app/actions/upload", () => ({
  uploadMask: (...args: unknown[]) => mockUploadMask(...args),
}));

// Mock MaskService functions (not used for outpaint, but required by import)
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

// Mock resolveActiveSlots
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
  type OutpaintDirection,
  type OutpaintSize,
} from "@/lib/canvas-detail-context";
import { type Generation, type ModelSlot } from "@/lib/db/queries";
import type { CanvasSSEEvent, SSECanvasGenerateEvent } from "@/lib/canvas-chat-service";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-outpaint-chat-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a scenic landscape",
    modelId: overrides.modelId ?? "fallback-model-id",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/landscape.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 1024,
    height: overrides.height ?? 1024,
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
 * Helper component that sets editMode and outpaint state in context on mount.
 */
function SetOutpaintStateHelper({
  editMode,
  outpaintDirections,
  outpaintSize,
}: {
  editMode: "inpaint" | "erase" | "instruction" | "outpaint" | null;
  outpaintDirections?: OutpaintDirection[];
  outpaintSize?: OutpaintSize;
}) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    dispatch({ type: "SET_EDIT_MODE", editMode });
    if (outpaintDirections !== undefined) {
      dispatch({ type: "SET_OUTPAINT_DIRECTIONS", outpaintDirections });
    }
    if (outpaintSize !== undefined) {
      dispatch({ type: "SET_OUTPAINT_SIZE", outpaintSize });
    }
  }, [dispatch, editMode, outpaintDirections, outpaintSize]);
  return null;
}

/**
 * Renders CanvasChatPanel with outpaint-mode test configuration.
 */
function renderPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    modelSlots?: ModelSlot[];
    editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
    outpaintDirections?: OutpaintDirection[];
    outpaintSize?: OutpaintSize;
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
      <SetOutpaintStateHelper
        editMode={editMode}
        outpaintDirections={options.outpaintDirections}
        outpaintSize={options.outpaintSize}
      />
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

describe("CanvasChatPanel -- Outpaint Integration (Slice 13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockCreateSession.mockResolvedValue("test-session-id");
    mockSendMessage.mockImplementation(mockSSEEvents([]));
    mockGenerateImages.mockResolvedValue([]);
    mockResolveActiveSlots.mockReturnValue([]);
  });

  /**
   * AC-3: GIVEN `editMode` ist `"outpaint"` und `outpaintDirections` ist `[]` (leer)
   *       WHEN das Chat-Panel gerendert wird
   *       THEN ist der Send-Button disabled
   *       AND ein Inline-Hinweis "Waehle mindestens eine Richtung zum Erweitern" wird angezeigt
   */
  it("AC-3: should disable send button and show hint when outpaintDirections is empty in outpaint mode", () => {
    renderPanel({
      editMode: "outpaint",
      outpaintDirections: [],
    });

    // Send button should be disabled
    const sendButton = screen.getByTestId("send-btn");
    expect(sendButton).toBeDisabled();

    // Inline hint should be visible
    const hint = screen.getByTestId("outpaint-no-directions-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent("Waehle mindestens eine Richtung zum Erweitern");
  });

  it("AC-3 (counter-case): should NOT show hint when outpaintDirections is non-empty", () => {
    renderPanel({
      editMode: "outpaint",
      outpaintDirections: ["top"],
      outpaintSize: 50,
    });

    // Hint should NOT be visible when directions are selected
    expect(screen.queryByTestId("outpaint-no-directions-hint")).not.toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN ein SSE-Event mit `action: "outpaint"` trifft in `handleCanvasGenerate` ein
   *       AND `outpaintDirections` ist `["top", "right"]` und `outpaintSize` ist `50`
   *       WHEN der Handler ausgefuehrt wird
   *       THEN wird `generateImages()` aufgerufen mit `generationMode: "outpaint"`,
   *            `sourceImageUrl`, `outpaintDirections: ["top", "right"]`, `outpaintSize: 50`
   */
  it('AC-4: should call generateImages with outpaint mode and direction/size params on outpaint action', async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac4-outpaint",
      imageUrl: "https://example.com/original-1024.png",
      width: 1024,
      height: 1024,
    });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "outpaint",
        prompt: "extend the landscape",
        model_id: "flux-fill-pro",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    renderPanel({
      generation,
      editMode: "outpaint",
      outpaintDirections: ["top", "right"],
      outpaintSize: 50,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "extend the landscape");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Verify generateImages was called with outpaint params
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "outpaint",
        sourceImageUrl: "https://example.com/original-1024.png",
        outpaintDirections: ["top", "right"],
        outpaintSize: 50,
      }),
    );

    // resolveActiveSlots should be called with "outpaint" mode
    expect(mockResolveActiveSlots).toHaveBeenCalledWith([], "outpaint");

    // MaskService pipeline must NOT be invoked (outpaint does server-side mask)
    expect(mockValidateMinSize).not.toHaveBeenCalled();
    expect(mockApplyFeathering).not.toHaveBeenCalled();
    expect(mockUploadMask).not.toHaveBeenCalled();
  });

  /**
   * AC-8: GIVEN die berechneten Dimensionen nach Canvas-Extension wuerden 2048px in einer Dimension ueberschreiten
   *       WHEN `handleCanvasGenerate` mit `action: "outpaint"` ausgefuehrt wird
   *       THEN wird ein Toast "Bild wuerde API-Limit ueberschreiten" angezeigt
   *       AND `generateImages()` wird NICHT aufgerufen
   */
  it("AC-8: should show toast and skip generation when outpaint would exceed 2048px limit", async () => {
    const user = userEvent.setup();
    // 1024x1024 image with 100% extension on both left and right = 1024+1024+1024 = 3072 > 2048
    const generation = makeGeneration({
      id: "gen-ac8-too-large",
      imageUrl: "https://example.com/big.png",
      width: 1024,
      height: 1024,
    });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "outpaint",
        prompt: "extend everywhere",
        model_id: "flux-fill-pro",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    renderPanel({
      generation,
      editMode: "outpaint",
      outpaintDirections: ["left", "right"],
      outpaintSize: 100,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "extend everywhere");

    // Wait for the toast to be shown
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Bild wuerde API-Limit ueberschreiten");
    });

    // generateImages should NOT have been called
    expect(mockGenerateImages).not.toHaveBeenCalled();
  });

  it("AC-8 (vertical overflow): should show toast when top+bottom outpaint would exceed 2048px", async () => {
    const user = userEvent.setup();
    // 1024x1024 image with 100% extension on both top and bottom = 1024+1024+1024 = 3072 > 2048
    const generation = makeGeneration({
      id: "gen-ac8-vertical",
      imageUrl: "https://example.com/tall.png",
      width: 1024,
      height: 1024,
    });

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "outpaint",
        prompt: "extend vertically",
        model_id: "flux-fill-pro",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    renderPanel({
      generation,
      editMode: "outpaint",
      outpaintDirections: ["top", "bottom"],
      outpaintSize: 100,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "extend vertically");

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Bild wuerde API-Limit ueberschreiten");
    });

    expect(mockGenerateImages).not.toHaveBeenCalled();
  });

  /**
   * AC-9: GIVEN `generateImages()` mit `generationMode: "outpaint"` wurde erfolgreich ausgefuehrt
   *       und Polling liefert ein Ergebnis
   *       WHEN das Ergebnis-Bild vorliegt
   *       THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   *       AND `SET_CURRENT_IMAGE` mit der neuen (erweiterten) Bild-URL dispatched
   *
   * NOTE: The chat panel calls onPendingGenerations and onGenerationsCreated callbacks
   * after generateImages returns. The parent (CanvasDetailView) handles PUSH_UNDO /
   * SET_CURRENT_IMAGE after polling. Here we test the part the chat panel controls.
   */
  it("AC-9: should dispatch PUSH_UNDO and SET_CURRENT_IMAGE after successful outpaint result", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-ac9-outpaint",
      imageUrl: "https://example.com/before-extend.png",
      width: 1024,
      height: 1024,
    });

    const pendingGen: Generation = makeGeneration({
      id: "gen-result-outpaint-1",
      status: "pending",
      imageUrl: "https://example.com/extended-image.png",
    });

    // generateImages returns a pending generation
    mockGenerateImages.mockResolvedValue([pendingGen]);
    mockResolveActiveSlots.mockReturnValue([]);

    mockSendMessage.mockImplementation(mockSSEEvents([
      {
        type: "canvas-generate",
        action: "outpaint",
        prompt: "extend the scene",
        model_id: "flux-fill-pro",
        params: {},
      } as SSECanvasGenerateEvent,
    ]));

    const onPendingGenerations = vi.fn();
    const onGenerationsCreated = vi.fn();

    renderPanel({
      generation,
      editMode: "outpaint",
      outpaintDirections: ["top"],
      outpaintSize: 50,
      onPendingGenerations,
      onGenerationsCreated,
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    await sendChatMessage(user, "extend the scene");

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // onGenerationsCreated should be called with the result
    await waitFor(() => {
      expect(onGenerationsCreated).toHaveBeenCalledWith([pendingGen]);
    });

    // onPendingGenerations should be called with pending IDs for polling
    // (parent handles PUSH_UNDO and SET_CURRENT_IMAGE via polling result)
    expect(onPendingGenerations).toHaveBeenCalledWith(["gen-result-outpaint-1"]);
  });
});
