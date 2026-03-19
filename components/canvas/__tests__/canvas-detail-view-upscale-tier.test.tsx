// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-10 canvas-detail-view handleUpscale with tier
 * (AC-6, AC-7, AC-9).
 *
 * These tests validate that canvas-detail-view correctly resolves upscale models
 * from cached modelSettings using the tier parameter propagated from the
 * UpscalePopover TierToggle.
 *
 * Mocking Strategy: mock_external per spec (getModelSettings, upscaleImage,
 * generateImages, fetchGenerations are server actions mocked).
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
    id: overrides.id ?? "gen-upscale-tier-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A dramatic sunset",
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
    createdAt: overrides.createdAt ?? new Date("2026-03-14T12:00:00Z"),
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
// AC-6: handleUpscale with tier="draft" resolves Real-ESRGAN
// ===========================================================================

describe("CanvasDetailView - handleUpscale with Tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-6: GIVEN modelSettings in canvas-detail-view.tsx enthaelt
   *       { mode: "upscale", tier: "draft", modelId: "nightmareai/real-esrgan",
   *         modelParams: { "scale": 2 } }
   *       WHEN handleUpscale mit tier: "draft" aufgerufen wird
   *       THEN wird upscaleImage mit modelId: "nightmareai/real-esrgan" und
   *            modelParams aus den Settings aufgerufen
   */
  it('AC-6: should call upscaleImage with real-esrgan modelId for draft tier', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide model settings with upscale/draft entry per AC-6 spec
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-upscale-draft",
        mode: "upscale",
        tier: "draft",
        modelId: "nightmareai/real-esrgan",
        modelParams: { scale: 2 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ms-upscale-quality",
        mode: "upscale",
        tier: "quality",
        modelId: "philz1337x/crystal-upscaler",
        modelParams: { scale: 4 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockUpscaleImage.mockResolvedValue(
      makeGeneration({ id: "gen-upscaled-draft", status: "pending" })
    );

    const generation = makeGeneration({
      id: "gen-upscale-draft-test",
      modelId: "some-original-model", // should NOT be used when settings exist
      imageUrl: "https://example.com/upscale-source.png",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "upscale" }}
        />
      ),
    });

    // Wait for model settings to be fetched and applied
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Wait for the upscale popover to appear
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Default tier is "draft" -- verify Draft is active (scoped to popover)
    const draftButton = within(popover).getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "true");

    // Click 2x Upscale button (with draft tier)
    const btn2x = screen.getByTestId("upscale-2x-button");
    await user.click(btn2x);

    // Assert upscaleImage was called with the draft model from settings
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpscaleImage.mock.calls[0][0];
    // AC-6: Must use upscale/draft model from settings
    expect(callArgs.modelId).toBe("nightmareai/real-esrgan");
    expect(callArgs.modelParams).toEqual({ scale: 2 });
    // NOT the original image model
    expect(callArgs.modelId).not.toBe("some-original-model");
    // Should include the source image URL
    expect(callArgs.sourceImageUrl).toBe("https://example.com/upscale-source.png");
    expect(callArgs.scale).toBe(2);
  });

  // =========================================================================
  // AC-7: handleUpscale with tier="quality" resolves Crystal-Upscaler
  // =========================================================================

  /**
   * AC-7: GIVEN modelSettings in canvas-detail-view.tsx enthaelt
   *       { mode: "upscale", tier: "quality", modelId: "philz1337x/crystal-upscaler",
   *         modelParams: { "scale": 4 } }
   *       WHEN handleUpscale mit tier: "quality" aufgerufen wird
   *       THEN wird upscaleImage mit modelId: "philz1337x/crystal-upscaler" und
   *            modelParams aus den Settings aufgerufen
   */
  it('AC-7: should call upscaleImage with crystal-upscaler modelId for quality tier', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide model settings with upscale/quality entry per AC-7 spec
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-upscale-draft",
        mode: "upscale",
        tier: "draft",
        modelId: "nightmareai/real-esrgan",
        modelParams: { scale: 2 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ms-upscale-quality",
        mode: "upscale",
        tier: "quality",
        modelId: "philz1337x/crystal-upscaler",
        modelParams: { scale: 4 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockUpscaleImage.mockResolvedValue(
      makeGeneration({ id: "gen-upscaled-quality", status: "pending" })
    );

    const generation = makeGeneration({
      id: "gen-upscale-quality-test",
      modelId: "some-original-model", // should NOT be used when settings exist
      imageUrl: "https://example.com/upscale-quality-source.png",
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

    // Wait for the upscale popover to appear
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Switch tier to "Quality" by clicking the Quality segment (scoped to popover)
    const qualityButton = within(popover).getByText("Quality");
    await user.click(qualityButton);

    // Verify Quality is now active
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");

    // Click 4x Upscale button (with quality tier)
    const btn4x = screen.getByTestId("upscale-4x-button");
    await user.click(btn4x);

    // Assert upscaleImage was called with the quality model from settings
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpscaleImage.mock.calls[0][0];
    // AC-7: Must use upscale/quality model from settings
    expect(callArgs.modelId).toBe("philz1337x/crystal-upscaler");
    expect(callArgs.modelParams).toEqual({ scale: 4 });
    // NOT the original image model
    expect(callArgs.modelId).not.toBe("some-original-model");
    // Should include the source image URL
    expect(callArgs.sourceImageUrl).toBe("https://example.com/upscale-quality-source.png");
    expect(callArgs.scale).toBe(4);
  });

  // =========================================================================
  // AC-9: Fallback bei fehlenden Settings
  // =========================================================================

  /**
   * AC-9: GIVEN modelSettings sind leer oder nicht geladen
   *       WHEN handleUpscale mit einem Tier aufgerufen wird
   *       THEN wird der Fallback-Mechanismus aus Slice 8 verwendet
   *            (currentGeneration.modelId) -- kein Crash
   */
  it('AC-9: should fall back to currentGeneration.modelId when modelSettings are empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide EMPTY model settings -- no upscale entries
    mockGetModelSettings.mockResolvedValue([]);

    mockUpscaleImage.mockResolvedValue(
      makeGeneration({ id: "gen-upscaled-fallback", status: "pending" })
    );

    const generation = makeGeneration({
      id: "gen-upscale-fallback-test",
      modelId: "fallback-model-from-generation",
      imageUrl: "https://example.com/upscale-fallback-source.png",
    });

    renderDetailView({
      generation,
      extraChildren: (
        <DispatchOnMount
          action={{ type: "SET_ACTIVE_TOOL", toolId: "upscale" }}
        />
      ),
    });

    // Wait for model settings to be fetched (returns empty)
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Wait for the upscale popover to appear
    const popover = await screen.findByTestId("upscale-popover");
    expect(popover).toBeInTheDocument();

    // Click 2x Upscale with default draft tier
    const btn2x = screen.getByTestId("upscale-2x-button");
    await user.click(btn2x);

    // Assert upscaleImage was called with fallback model from currentGeneration
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpscaleImage.mock.calls[0][0];
    // AC-9: Must fall back to currentGeneration.modelId when settings are empty
    expect(callArgs.modelId).toBe("fallback-model-from-generation");
    // modelParams should be empty object (no settings to pull from)
    expect(callArgs.modelParams).toEqual({});
    // No crash -- the call completed successfully
    expect(callArgs.sourceImageUrl).toBe("https://example.com/upscale-fallback-source.png");
    expect(callArgs.scale).toBe(2);
  });
});
