// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-09 canvas-detail-view tier resolution (AC-11, AC-12)
 *
 * These tests validate that canvas-detail-view correctly resolves models
 * from cached modelSettings using the tier parameter propagated from
 * the Variation/Img2Img popovers.
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
    id: overrides.id ?? "gen-tier-res-1",
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
// AC-11: handleVariationGenerate with tier parameter
// ===========================================================================

describe("handleVariationGenerate with tier parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-11: GIVEN handleVariationGenerate in canvas-detail-view mit modelSettings
   *        geladen und einem img2img/quality Eintrag
   *        { modelId: "black-forest-labs/flux-2-pro", modelParams: { "prompt_strength": 0.6 } }
   *        WHEN mit params.tier = "quality" aufgerufen
   *        THEN wird generateImages mit modelIds: ["black-forest-labs/flux-2-pro"] aufgerufen
   */
  it('AC-11: should resolve img2img/quality model from settings when tier is quality', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide model settings with img2img/quality entry per AC-11 spec
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-draft",
        mode: "img2img",
        tier: "draft",
        modelId: "black-forest-labs/flux-schnell",
        modelParams: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ms-quality",
        mode: "img2img",
        tier: "quality",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: { prompt_strength: 0.6 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-quality-1", status: "pending" }),
    ]);

    const generation = makeGeneration({
      id: "gen-variation-quality-test",
      modelId: "black-forest-labs/flux-2-max", // original -- should NOT be used
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

    // Switch tier to "Quality" by clicking the Quality segment (scoped to popover)
    const qualityButton = within(popover).getByText("Quality");
    await user.click(qualityButton);

    // Verify Quality is now active
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");

    // Click Generate
    const generateBtn = screen.getByTestId("variation-generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called with the quality model from settings
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // AC-11: Must use the img2img/quality model from settings
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-2-pro"]);
    // NOT the original image model
    expect(callArgs.modelIds).not.toEqual(["black-forest-labs/flux-2-max"]);
    // Should be img2img generation mode
    expect(callArgs.generationMode).toBe("img2img");
  });
});

// ===========================================================================
// AC-12: handleImg2imgGenerate with tier parameter
// ===========================================================================

describe("handleImg2imgGenerate with tier parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * AC-12: GIVEN handleImg2imgGenerate in canvas-detail-view mit modelSettings
   *        geladen und einem img2img/max Eintrag
   *        { modelId: "black-forest-labs/flux-2-max", modelParams: { "prompt_strength": 0.6 } }
   *        WHEN mit params.tier = "max" aufgerufen
   *        THEN wird generateImages mit modelIds: ["black-forest-labs/flux-2-max"] aufgerufen
   */
  it('AC-12: should resolve img2img/max model from settings when tier is max', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Provide model settings with img2img/max entry per AC-12 spec
    mockGetModelSettings.mockResolvedValue([
      {
        id: "ms-draft",
        mode: "img2img",
        tier: "draft",
        modelId: "black-forest-labs/flux-schnell",
        modelParams: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ms-quality",
        mode: "img2img",
        tier: "quality",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: { prompt_strength: 0.6 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ms-max",
        mode: "img2img",
        tier: "max",
        modelId: "black-forest-labs/flux-2-max",
        modelParams: { prompt_strength: 0.6 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-max-1", status: "pending" }),
    ]);

    const generation = makeGeneration({
      id: "gen-img2img-max-test",
      modelId: "fallback-model-should-not-be-used",
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

    // Switch tier to "Max" directly via TierToggle
    const maxButton = within(popover).getByText("Max");
    await user.click(maxButton);

    // Click Generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // Assert generateImages was called with the max model from settings
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // AC-12: Must use the img2img/max model from settings
    expect(callArgs.modelIds).toEqual(["black-forest-labs/flux-2-max"]);
    // NOT the fallback model
    expect(callArgs.modelIds).not.toEqual([
      "fallback-model-should-not-be-used",
    ]);
    // Should be img2img generation mode
    expect(callArgs.generationMode).toBe("img2img");
  });
});
