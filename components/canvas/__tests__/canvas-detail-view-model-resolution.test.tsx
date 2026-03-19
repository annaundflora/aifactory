// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-08-canvas-context-cleanup (AC-5 through AC-9)
 *
 * These tests validate that the canvas-detail-view correctly:
 * - Fetches model settings on mount (AC-5)
 * - Uses settings-based model resolution for variation (AC-6)
 * - Uses settings-based model resolution for img2img (AC-7)
 * - Uses settings-based model resolution for upscale with modelParams (AC-8)
 * - Falls back to currentGeneration.modelId when settings fail (AC-9)
 *
 * Mocking Strategy: mock_external per spec (getModelSettings, generateImages,
 * upscaleImage, fetchGenerations are server actions mocked).
 */

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
// Mocks (mock_external strategy per spec)
// ---------------------------------------------------------------------------

// Mock db/index to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/index", () => ({
  db: {},
}));

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

// Mock ModelBrowserDrawer -- complex external component
vi.mock("@/components/models/model-browser-drawer", () => ({
  ModelBrowserDrawer: () => null,
}));

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
    negativePrompt: overrides.negativePrompt ?? null,
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
    promptStyle: overrides.promptStyle ?? "",
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

// ===========================================================================
// AC-5: Model-Settings fetch on mount
// ===========================================================================

describe("CanvasDetailView Model-Settings fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
    mockGetModelSettings.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-5: GIVEN canvas-detail-view.tsx wird geladen und die model_settings Tabelle hat 8 Eintraege
   *       WHEN die Komponente mountet
   *       THEN wird getModelSettings() aufgerufen und das Ergebnis als ModelSetting[] im lokalen State gespeichert
   */
  it("AC-5: should call getModelSettings on mount and store result in state", async () => {
    const mockSettings = [
      { id: "ms-1", mode: "txt2img", tier: "draft", modelId: "model-a", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-2", mode: "txt2img", tier: "quality", modelId: "model-b", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-3", mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-4", mode: "img2img", tier: "quality", modelId: "model-d", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-5", mode: "upscale", tier: "draft", modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 }, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-6", mode: "upscale", tier: "quality", modelId: "model-f", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-7", mode: "txt2img", tier: "max", modelId: "model-g", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "ms-8", mode: "img2img", tier: "max", modelId: "model-h", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
    ];

    mockGetModelSettings.mockResolvedValue(mockSettings);

    renderDetailView();

    // getModelSettings should have been called exactly once on mount
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Verify it was called with no arguments (it returns all settings)
    expect(mockGetModelSettings).toHaveBeenCalledWith();
  });
});

// ===========================================================================
// AC-6: Variation uses img2img/draft model from settings
// ===========================================================================

describe("handleVariationGenerate with Settings-based resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-6: GIVEN modelSettings sind geladen mit einem img2img/draft Eintrag
   *       { modelId: "black-forest-labs/flux-schnell", modelParams: {} }
   *       WHEN handleVariationGenerate aufgerufen wird (ohne Tier-Parameter, Default-Fallback)
   *       THEN wird generateImages mit modelIds: ["black-forest-labs/flux-schnell"] aufgerufen
   *       (statt state.selectedModelId ?? currentGeneration.modelId)
   */
  it('AC-6: should call generateImages with modelId from img2img/draft setting', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide model settings with img2img/draft entry
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-1",
        mode: "img2img",
        tier: "draft",
        modelId: "black-forest-labs/flux-schnell",
        modelParams: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-new-1", status: "pending" }),
    ]);

    const generation = makeGeneration({
      id: "gen-variation-test",
      modelId: "black-forest-labs/flux-2-max", // original model -- should NOT be used
      imageUrl: "https://example.com/variation-source.png",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
        />
      ),
    });

    // Wait for model settings to be fetched and applied
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Wait for the variation popover to appear
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // Click generate with default settings
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called with the settings-resolved model
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // AC-6: Must use the img2img/draft model from settings
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-schnell"]);
    // NOT the original image model
    expect(callArgs.modelIds).not.toEqual(["black-forest-labs/flux-2-max"]);
  });
});

// ===========================================================================
// AC-7: Img2img uses img2img/draft model from settings
// ===========================================================================

describe("handleImg2imgGenerate with Settings-based resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-7: GIVEN modelSettings sind geladen mit einem img2img/draft Eintrag
   *       WHEN handleImg2imgGenerate aufgerufen wird (ohne Tier-Parameter, Default-Fallback)
   *       THEN wird generateImages mit dem img2img/draft Model aus Settings aufgerufen
   *       (statt state.selectedModelId ?? currentGeneration.modelId)
   */
  it('AC-7: should call generateImages with modelId from img2img/draft setting', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const img2imgDraftModelId = "stability-ai/sdxl";

    // Provide model settings with img2img/draft entry
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-1",
        mode: "img2img",
        tier: "draft",
        modelId: img2imgDraftModelId,
        modelParams: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-img2img-new", status: "pending" }),
    ]);

    const generation = makeGeneration({
      id: "gen-img2img-test",
      modelId: "black-forest-labs/flux-2-max", // original model -- should NOT be used
      imageUrl: "https://example.com/img2img-source.png",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "img2img" }}
        />
      ),
    });

    // Wait for model settings to be fetched
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Wait for img2img popover
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // Fill in motiv text (required to generate)
    const motivTextarea = screen.getByTestId("motiv-textarea");
    await user.type(motivTextarea, "A cyberpunk cityscape");

    // Click generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called with the settings-resolved model
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // AC-7: Must use the img2img/draft model from settings
    expect(callArgs.modelIds).toEqual([img2imgDraftModelId]);
    // NOT the original image model
    expect(callArgs.modelIds).not.toEqual(["black-forest-labs/flux-2-max"]);
    // Verify it's an img2img generation
    expect(callArgs.generationMode).toBe("img2img");
  });
});

// ===========================================================================
// AC-8: Upscale uses upscale/draft model and modelParams from settings
// ===========================================================================

describe("handleUpscale with Settings-based resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-8: GIVEN modelSettings sind geladen mit einem upscale/draft Eintrag
   *       { modelId: "nightmareai/real-esrgan", modelParams: { "scale": 2 } }
   *       WHEN handleUpscale aufgerufen wird (ohne Tier-Parameter, Default-Fallback)
   *       THEN wird upscaleImage mit modelId: "nightmareai/real-esrgan" und den gemergten Params aufgerufen
   *       (statt hardcoded)
   */
  it('AC-8: should call upscaleImage with modelId and modelParams from upscale/draft setting', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide model settings with upscale/draft entry including modelParams
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-upscale-1",
        mode: "upscale",
        tier: "draft",
        modelId: "nightmareai/real-esrgan",
        modelParams: { scale: 2 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockUpscaleImage.mockResolvedValue(
      makeGeneration({ id: "gen-upscale-result", status: "pending" })
    );

    const generation = makeGeneration({
      id: "gen-upscale-test",
      imageUrl: "https://example.com/upscale-source.png",
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

    // Wait for model settings to be fetched
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Wait for upscale popover
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Click 4x upscale button
    const upscale4xBtn = screen.getByTestId("upscale-4x-button");
    await user.click(upscale4xBtn);

    // Assert upscaleImage was called with correct params from settings
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpscaleImage.mock.calls[0][0];
    // AC-8: Must use the upscale/draft model from settings
    expect(callArgs.modelId).toBe("nightmareai/real-esrgan");
    // AC-8: Must include the modelParams from settings
    expect(callArgs.modelParams).toEqual({ scale: 2 });
    // Other params should be correct
    expect(callArgs.sourceImageUrl).toBe("https://example.com/upscale-source.png");
    expect(callArgs.scale).toBe(4);
    expect(callArgs.projectId).toBe("project-1");
    expect(callArgs.sourceGenerationId).toBe("gen-upscale-test");
  });
});

// ===========================================================================
// AC-9: Fallback when settings fetch fails
// ===========================================================================

describe("Fallback bei fehlgeschlagenem Settings-fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-9: GIVEN modelSettings fetch schlaegt fehl (Netzwerkfehler)
   *       WHEN ein Canvas-Tool-Handler aufgerufen wird
   *       THEN wird currentGeneration.modelId als Fallback verwendet (graceful degradation)
   */
  it('AC-9: should fall back to currentGeneration.modelId when modelSettings is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Simulate network failure -- getModelSettings rejects
    mockGetModelSettings.mockRejectedValue(new Error("Network error"));

    // Suppress console.error for the expected rejection
    const originalConsoleError = console.error;
    console.error = vi.fn();

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-fallback-1", status: "pending" }),
    ]);

    const fallbackModelId = "black-forest-labs/flux-2-max";
    const generation = makeGeneration({
      id: "gen-fallback-test",
      modelId: fallbackModelId,
      imageUrl: "https://example.com/fallback-source.png",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "variation" }}
        />
      ),
    });

    // Wait for model settings fetch to fail (and be handled gracefully)
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Allow the rejected promise to settle
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Wait for the variation popover to appear
    const popover = await screen.findByTestId("variation-popover");
    expect(popover).toBeInTheDocument();

    // Click generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called with the fallback model
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // AC-9: Should fall back to currentGeneration.modelId
    expect(callArgs.modelIds).toEqual([fallbackModelId]);

    // Restore console.error
    console.error = originalConsoleError;
  });

  /**
   * AC-9 (upscale fallback): GIVEN modelSettings fetch fails
   *       WHEN handleUpscale is called
   *       THEN upscaleImage uses currentGeneration.modelId as fallback
   */
  it('AC-9: should fall back to currentGeneration.modelId when modelSettings fetch fails', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Simulate network failure
    mockGetModelSettings.mockRejectedValue(new Error("Network error"));

    // Suppress console.error for the expected rejection
    const originalConsoleError = console.error;
    console.error = vi.fn();

    mockUpscaleImage.mockResolvedValue(
      makeGeneration({ id: "gen-upscale-fallback", status: "pending" })
    );

    const generation = makeGeneration({
      id: "gen-upscale-fallback-test",
      imageUrl: "https://example.com/upscale-fallback.png",
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

    // Wait for model settings fetch to fail
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Allow the rejected promise to settle
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Wait for upscale popover
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Click 4x upscale
    const upscale4xBtn = screen.getByTestId("upscale-4x-button");
    await user.click(upscale4xBtn);

    // Assert upscaleImage was called with fallback model
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpscaleImage.mock.calls[0][0];
    // AC-9: Upscale should fall back to currentGeneration.modelId
    expect(callArgs.modelId).toBe("black-forest-labs/flux-2-max");
    // Empty modelParams when settings are not available
    expect(callArgs.modelParams).toEqual({});

    // Restore console.error
    console.error = originalConsoleError;
  });
});
