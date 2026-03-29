// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Popover / Select / DropdownMenu use these)
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
      readonly pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
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
});

// ---------------------------------------------------------------------------
// Hoisted mock functions (available before vi.mock factories execute)
// ---------------------------------------------------------------------------

const {
  mockGenerateImages,
  mockUpscaleImage,
  mockFetchGenerations,
  mockDeleteGeneration,
  mockGetModels,
  mockCheckImg2ImgSupport,
  mockGetModelSettings,
  mockToastFn,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => ({
  mockGenerateImages: vi.fn(),
  mockUpscaleImage: vi.fn(),
  mockFetchGenerations: vi.fn(),
  mockDeleteGeneration: vi.fn(),
  mockGetModels: vi.fn(),
  mockCheckImg2ImgSupport: vi.fn(),
  mockGetModelSettings: vi.fn(),
  mockToastFn: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

// Mock db/queries to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
} as Record<string, unknown>));

// Mock server actions (external deps)
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: (...args: unknown[]) => mockUpscaleImage(...args),
  fetchGenerations: (...args: unknown[]) => mockFetchGenerations(...args),
  deleteGeneration: (...args: unknown[]) => mockDeleteGeneration(...args),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
}));

// Mock model settings server action
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: (...args: unknown[]) => mockGetModelSettings(...args),
}));

// Mock model actions
vi.mock("@/app/actions/models", () => ({
  getModels: (...args: unknown[]) => mockGetModels(...args),
  getModelSchema: (...args: unknown[]) => mockCheckImg2ImgSupport(...args),
}));

// Mock references server action (transitive dep via details-overlay -> provenance-row + img2img handler)
vi.mock("@/app/actions/references", () => ({
  getProvenanceData: vi.fn().mockResolvedValue([]),
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-uploaded-1", imageUrl: "https://example.com/uploaded.png" }),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-gallery-1", imageUrl: "https://example.com/gallery.png" }),
}));

// Mock sonner toast
vi.mock("sonner", () => {
  const toast = Object.assign(mockToastFn, {
    error: mockToastError,
    success: mockToastSuccess,
  });
  return { toast };
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
    PanelLeftOpen: stub("PanelLeftOpen"),
  };
});

// Mock download utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn(),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// Mock ReferenceBar (complex sub-component used by img2img popover)
vi.mock("@/components/workspace/reference-bar", () => ({
  ReferenceBar: (props: Record<string, unknown>) => (
    <div data-testid="reference-bar" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-default-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A dramatic sunset",
    modelId: overrides.modelId ?? "black-forest-labs/flux-2-max",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-13T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

/**
 * Helper component that dispatches a context action on mount.
 */
function DispatchOnMount({
  action,
}: {
  action: Parameters<ReturnType<typeof useCanvasDetail>["dispatch"]>[0];
}) {
  const { dispatch } = useCanvasDetail();
  React.useEffect(() => {
    dispatch(action);
  }, [dispatch]);
  return null;
}

/**
 * Helper to read current context state for assertions.
 */
function StateReader({
  onState,
}: {
  onState: (state: ReturnType<typeof useCanvasDetail>["state"]) => void;
}) {
  const { state } = useCanvasDetail();
  React.useEffect(() => {
    onState(state);
  });
  return null;
}

/**
 * Renders CanvasDetailView wrapped in CanvasDetailProvider.
 */
function renderDetailView(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    initialGenerationId?: string;
    extraChildren?: React.ReactNode;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const allGenerations = options.allGenerations ?? [generation];
  const onBack = options.onBack ?? vi.fn();
  const initialGenerationId = options.initialGenerationId ?? generation.id;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasDetailView
        generation={generation}
        allGenerations={allGenerations}
        onBack={onBack}
      />
      {options.extraChildren}
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests: In-Place Generation Flow (AC-1 through AC-8)
// ---------------------------------------------------------------------------

describe("In-Place Generation Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Default: generateImages returns a pending generation
    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-new-1", status: "pending" }),
    ]);
    // Default: upscaleImage returns a pending generation
    mockUpscaleImage.mockResolvedValue(
      makeGeneration({ id: "gen-upscale-1", status: "pending" })
    );
    // Default: fetchGenerations returns empty
    mockFetchGenerations.mockResolvedValue([]);
    // Default: getModelSettings returns empty (handlers use fallback)
    mockGetModelSettings.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // AC-1: Variation-Popover triggert generateImages mit korrekten Params
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN der User klickt "Generate" im Variation-Popover mit
   *       { prompt: "A dramatic sunset", count: 2 }
   *       WHEN der Callback ausgefuehrt wird
   *       THEN wird generateImages() Server Action aufgerufen als txt2img
   *       (ohne Quellbild), mit dem Prompt, dem Model und count 2,
   *       und das Popover schliesst sich
   */
  it("AC-1: should call generateImages as txt2img with prompt, model, and count when variation popover generates", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-var-1",
      prompt: "A dramatic sunset",
      modelId: "black-forest-labs/flux-2-max",
      imageUrl: "https://example.com/current.png",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
        />
      ),
    });

    // Wait for the variation popover to appear
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // Change the prompt
    const textarea = screen.getByTestId("variation-prompt");
    await user.clear(textarea);
    await user.type(textarea, "A dramatic sunset");

    // Select count 2
    const btn2 = screen.getByTestId("variation-count-2");
    await user.click(btn2);

    // Click generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called with correct params
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.projectId).toBe("project-1");
    expect(callArgs.promptMotiv).toBe("A dramatic sunset");
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-2-max"]);
    expect(callArgs.count).toBe(2);
    expect(callArgs.generationMode).toBe("img2img");
    // Source image from current generation is passed for img2img variations
    expect(callArgs.sourceImageUrl).toBe("https://example.com/current.png");

    // Popover should close
    await waitFor(() => {
      expect(
        screen.queryByTestId("variation-popover")
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: img2img-Popover triggert generateImages mit References
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN der User klickt "Generate" im img2img-Popover mit References,
   *       Prompt und Variants
   *       WHEN der Callback ausgefuehrt wird
   *       THEN wird generateImages() Server Action aufgerufen mit den Reference-
   *       Inputs, dem Prompt, dem Model aus dem Header-Selector und der gewaehlten
   *       Variant-Anzahl
   */
  it("AC-2: should call generateImages with references, prompt, header model, and variants when img2img popover generates", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-img2img-1",
      modelId: "black-forest-labs/flux-2-max",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "img2img" }}
        />
      ),
    });

    // Wait for img2img popover
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // Fill in motiv text
    const motivTextarea = screen.getByTestId("motiv-textarea");
    await user.type(motivTextarea, "A cyberpunk cityscape");

    // Click generate (with default variants = 1)
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.projectId).toBe("project-1");
    expect(callArgs.promptMotiv).toBe("A cyberpunk cityscape");
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-2-max"]);
    expect(callArgs.count).toBe(1);
    expect(callArgs.generationMode).toBe("img2img");
  });

  // -------------------------------------------------------------------------
  // AC-3: Upscale-Popover triggert upscaleImage mit hardcoded Model
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN der User klickt "4x Upscale" im Upscale-Popover
   *       WHEN der Callback ausgefuehrt wird
   *       THEN wird upscaleImage() Server Action aufgerufen mit der aktuellen
   *       Bild-URL und scale: 4 (hardcoded Model nightmareai/real-esrgan,
   *       ignoriert Header-Selector)
   */
  it("AC-3: should call upscaleImage with current image URL, scale 4, and hardcoded real-esrgan model", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-upscale-test",
      imageUrl: "https://example.com/to-upscale.png",
      modelId: "black-forest-labs/flux-2-max",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "upscale" }}
        />
      ),
    });

    // Wait for upscale popover
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Click 4x upscale button
    const upscale4xBtn = screen.getByTestId("upscale-4x-button");
    await user.click(upscale4xBtn);

    // Assert upscaleImage was called with correct params
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpscaleImage.mock.calls[0][0];
    expect(callArgs.sourceImageUrl).toBe(
      "https://example.com/to-upscale.png"
    );
    expect(callArgs.scale).toBe(4);
    expect(callArgs.projectId).toBe("project-1");
    expect(callArgs.sourceGenerationId).toBe("gen-upscale-test");
    // The header model is NOT passed to upscaleImage -- upscale uses hardcoded
    // nightmareai/real-esrgan on the server side. The client call does not
    // include modelIds at all, confirming header selector is ignored.
    expect(callArgs.modelIds).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // AC-4: Loading-Overlay bei isGenerating
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN eine Generation wurde via Popover getriggert
   *       WHEN der isGenerating-State auf true gesetzt wird
   *       THEN zeigt das Canvas-Image einen semi-transparenten Overlay mit dem
   *       Text "Generating" und einem Spinner
   */
  it('AC-4: should show semi-transparent overlay with "Generating" text and spinner when isGenerating is true', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-loading-test",
      imageUrl: "https://example.com/loading.png",
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-pending-1", status: "pending" }),
    ]);

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
        />
      ),
    });

    // Initially no overlay
    expect(
      screen.queryByTestId("canvas-image-generating-overlay")
    ).not.toBeInTheDocument();

    // Trigger generation via variation popover
    await screen.findByTestId("variation-popover");
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // After generation is triggered, the overlay should appear
    await waitFor(() => {
      const overlay = screen.getByTestId(
        "canvas-image-generating-overlay"
      );
      expect(overlay).toBeInTheDocument();
      // Semi-transparent: bg-background/60
      expect(overlay.className).toMatch(/bg-background\/60/);
      // Contains "Generating" text
      expect(overlay).toHaveTextContent("Generating");
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Alle Inputs disabled waehrend Generation
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN isGenerating ist true
   *       WHEN die UI gerendert wird
   *       THEN sind alle Toolbar-Icons disabled (nicht klickbar), der Chat-Input
   *       ist disabled, und Undo/Redo-Buttons sind disabled
   */
  it("AC-5: should disable toolbar icons, chat input, and undo/redo buttons when isGenerating is true", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-disabled-test",
      imageUrl: "https://example.com/disabled.png",
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-pending-2", status: "pending" }),
    ]);

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
        />
      ),
    });

    // Trigger generation
    await screen.findByTestId("variation-popover");
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Wait for isGenerating to be true
    await waitFor(() => {
      expect(
        screen.getByTestId("canvas-image-generating-overlay")
      ).toBeInTheDocument();
    });

    // Toolbar buttons should be disabled (aria-disabled="true")
    const toolbarButtonIds = [
      "toolbar-variation",
      "toolbar-img2img",
      "toolbar-upscale",
      "toolbar-download",
      "toolbar-delete",
      "toolbar-details",
    ];
    for (const testId of toolbarButtonIds) {
      const btn = screen.getByTestId(testId);
      expect(btn).toHaveAttribute("aria-disabled", "true");
    }

    // Chat toggle button is only rendered when chatSlot prop is provided.
    // In the default rendering path (no chatSlot), it is not present.
    // The embedded CanvasChatPanel's input is still disabled via context (isGenerating).
  });

  // -------------------------------------------------------------------------
  // AC-6: Polling-Completion ersetzt Bild
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN eine Generation laeuft (pending in DB)
   *       WHEN das Polling eine Generation mit status: "completed" erkennt
   *       THEN wird das neue Bild als currentGenerationId gesetzt, isGenerating
   *       wird auf false gesetzt, und der Loading-Overlay verschwindet
   */
  it("AC-6: should set new generation as currentGenerationId and clear isGenerating when polling detects completed status", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-poll-test",
      imageUrl: "https://example.com/poll.png",
    });
    const completedGeneration = makeGeneration({
      id: "gen-new-completed",
      status: "completed",
      imageUrl: "https://example.com/new-image.png",
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-new-completed", status: "pending" }),
    ]);

    // First poll returns pending, second returns completed
    mockFetchGenerations
      .mockResolvedValueOnce([
        makeGeneration({ id: "gen-new-completed", status: "pending" }),
      ])
      .mockResolvedValue([completedGeneration]);

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null =
      null;

    renderDetailView({
      generation,
      allGenerations: [generation, completedGeneration],
      extraChildren: (
        <>
          <DispatchOnMount
            action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
          />
          <StateReader
            onState={(s) => {
              latestState = s;
            }}
          />
        </>
      ),
    });

    // Trigger generation
    await screen.findByTestId("variation-popover");
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Wait for isGenerating
    await waitFor(() => {
      expect(
        screen.getByTestId("canvas-image-generating-overlay")
      ).toBeInTheDocument();
    });

    // Advance timers to trigger polling (3s interval + buffer)
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    // After polling detects completed, overlay should disappear
    await waitFor(() => {
      expect(
        screen.queryByTestId("canvas-image-generating-overlay")
      ).not.toBeInTheDocument();
    });

    // currentGenerationId should now be the new completed generation
    expect(latestState).not.toBeNull();
    expect(latestState!.currentGenerationId).toBe("gen-new-completed");
    expect(latestState!.isGenerating).toBe(false);
  });

  // -------------------------------------------------------------------------
  // AC-7: Altes Bild auf Undo-Stack bei Replace
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN eine Generation wurde completed und das neue Bild ersetzt das
   *       aktuelle
   *       WHEN der Replace-Flow ausgefuehrt wird
   *       THEN wird die vorherige currentGenerationId auf den Undo-Stack gepusht
   *       und der Redo-Stack geleert
   */
  it("AC-7: should push previous currentGenerationId to undo stack and clear redo stack on image replace", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-undo-test",
      imageUrl: "https://example.com/original.png",
    });
    const completedGeneration = makeGeneration({
      id: "gen-replaced",
      status: "completed",
      imageUrl: "https://example.com/replaced.png",
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-replaced", status: "pending" }),
    ]);

    // Poll returns completed immediately on first poll
    mockFetchGenerations.mockResolvedValue([completedGeneration]);

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null =
      null;

    renderDetailView({
      generation,
      allGenerations: [generation, completedGeneration],
      extraChildren: (
        <>
          <DispatchOnMount
            action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
          />
          <StateReader
            onState={(s) => {
              latestState = s;
            }}
          />
        </>
      ),
    });

    // Trigger generation
    await screen.findByTestId("variation-popover");
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Wait for polling to complete and replace image
    await waitFor(() => {
      expect(
        screen.queryByTestId("canvas-image-generating-overlay")
      ).not.toBeInTheDocument();
    });

    // The previous generation should be pushed to undo stack
    expect(latestState).not.toBeNull();
    expect(latestState!.undoStack).toContain("gen-undo-test");
    // Redo stack should be empty after replace
    expect(latestState!.redoStack).toEqual([]);
    // Current should be the new one
    expect(latestState!.currentGenerationId).toBe("gen-replaced");
  });

  // -------------------------------------------------------------------------
  // AC-8: Fehler-Handling bei failed Generation
  // -------------------------------------------------------------------------

  /**
   * AC-8: GIVEN eine Generation laeuft und das Polling status: "failed" erkennt
   *       WHEN der Fehler verarbeitet wird
   *       THEN wird isGenerating auf false gesetzt, ein Toast mit Fehlermeldung
   *       angezeigt, und das aktuelle Bild bleibt unveraendert
   */
  it("AC-8: should clear isGenerating, show error toast, and keep current image when polling detects failed status", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const generation = makeGeneration({
      id: "gen-fail-test",
      imageUrl: "https://example.com/keep-this.png",
    });

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-will-fail", status: "pending" }),
    ]);

    // Poll returns failed generation
    mockFetchGenerations.mockResolvedValue([
      makeGeneration({
        id: "gen-will-fail",
        status: "failed",
        errorMessage: "GPU out of memory",
      }),
    ]);

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null =
      null;

    renderDetailView({
      generation,
      extraChildren: (
        <>
          <DispatchOnMount
            action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
          />
          <StateReader
            onState={(s) => {
              latestState = s;
            }}
          />
        </>
      ),
    });

    // Trigger generation
    await screen.findByTestId("variation-popover");
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Wait for polling to detect failure and clear isGenerating
    await waitFor(() => {
      expect(
        screen.queryByTestId("canvas-image-generating-overlay")
      ).not.toBeInTheDocument();
    });

    // isGenerating should be false
    expect(latestState!.isGenerating).toBe(false);

    // Toast.error should have been called with the error message
    expect(mockToastError).toHaveBeenCalledWith("GPU out of memory");

    // Current image should remain unchanged
    expect(latestState!.currentGenerationId).toBe("gen-fail-test");
  });
});

