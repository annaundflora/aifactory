// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-07-canvas-handlers-merge
 *
 * Tests validate that canvas-detail-view handlers correctly merge
 * imageParams (from popovers) into the params object passed to generateImages.
 *
 * Mocking Strategy: mock_external per spec (generateImages, fetchGenerations,
 * getModelSettings, references actions are server actions mocked).
 * Popovers are rendered fully but the ParameterPanel's schema-based inputs
 * cannot be used in jsdom — instead we mock the popovers to capture onGenerate
 * and call it with the exact params we need to test.
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
  mockGetCollectionModels,
  mockCheckImg2ImgSupport,
  mockGetModelSettings,
  mockToastFn,
  mockToastError,
  mockToastSuccess,
  mockUploadReferenceImage,
  mockAddGalleryAsReference,
  mockGetProvenanceData,
  capturedVariationOnGenerate,
  capturedImg2imgOnGenerate,
} = vi.hoisted(() => ({
  mockGenerateImages: vi.fn(),
  mockUpscaleImage: vi.fn(),
  mockFetchGenerations: vi.fn(),
  mockDeleteGeneration: vi.fn(),
  mockGetCollectionModels: vi.fn(),
  mockCheckImg2ImgSupport: vi.fn(),
  mockGetModelSettings: vi.fn(),
  mockToastFn: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUploadReferenceImage: vi.fn(),
  mockAddGalleryAsReference: vi.fn(),
  mockGetProvenanceData: vi.fn(),
  // Capture refs for popover onGenerate callbacks
  capturedVariationOnGenerate: { current: null as null | ((...args: unknown[]) => void) },
  capturedImg2imgOnGenerate: { current: null as null | ((...args: unknown[]) => void) },
}));

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec)
// ---------------------------------------------------------------------------

// Mock auth chain to prevent next-auth -> next/server resolution error
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com" }),
}));

// Mock db/index to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/index", () => ({
  db: {},
}));

vi.mock("@/lib/db", () => ({
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

// Mock references server actions
vi.mock("@/app/actions/references", () => ({
  getProvenanceData: (...args: unknown[]) => mockGetProvenanceData(...args),
  uploadReferenceImage: (...args: unknown[]) => mockUploadReferenceImage(...args),
  addGalleryAsReference: (...args: unknown[]) => mockAddGalleryAsReference(...args),
}));

// Mock model actions
vi.mock("@/app/actions/models", () => ({
  getCollectionModels: (...args: unknown[]) => mockGetCollectionModels(...args),
  checkImg2ImgSupport: (...args: unknown[]) => mockCheckImg2ImgSupport(...args),
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

// Mock VariationPopover to capture onGenerate callback and expose a trigger button
vi.mock("@/components/canvas/popovers/variation-popover", () => ({
  VariationPopover: ({ onGenerate }: { onGenerate: (...args: unknown[]) => void }) => {
    capturedVariationOnGenerate.current = onGenerate;
    return (
      <div data-testid="variation-popover-mock">
        <button
          data-testid="variation-trigger"
          onClick={() => onGenerate({ prompt: "test", strength: "balanced", count: 1, tier: "draft" })}
        >
          Variation
        </button>
      </div>
    );
  },
}));

// Mock Img2imgPopover to capture onGenerate callback and expose a trigger button
vi.mock("@/components/canvas/popovers/img2img-popover", () => ({
  Img2imgPopover: ({ onGenerate }: { onGenerate: (...args: unknown[]) => void }) => {
    capturedImg2imgOnGenerate.current = onGenerate;
    return (
      <div data-testid="img2img-popover-mock">
        <button
          data-testid="img2img-trigger"
          onClick={() => onGenerate({ references: [], motiv: "test", style: "", variants: 1, tier: "draft" })}
        >
          Img2img
        </button>
      </div>
    );
  },
}));

// Mock UpscalePopover (not tested in this slice)
vi.mock("@/components/canvas/popovers/upscale-popover", () => ({
  UpscalePopover: () => <div data-testid="upscale-popover-mock" />,
}));

// Mock canvas-chat-service
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn(),
}));

// Mock ModelSelector
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => null,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
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
    createdAt: overrides.createdAt ?? new Date("2026-03-15T12:00:00Z"),
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
 * Renders CanvasDetailView wrapped in CanvasDetailProvider.
 * Popovers are mocked to capture onGenerate callbacks for direct invocation.
 */
function renderDetailView(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    initialGenerationId?: string;
    onGenerationsCreated?: (gens: Generation[]) => void;
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
        onGenerationsCreated={options.onGenerationsCreated}
      />
    </CanvasDetailProvider>
  );
}

// ===========================================================================
// Slice 07: imageParams Merge in Canvas Detail View Handlers
// ===========================================================================

describe("CanvasDetailView -- imageParams Merge in Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedVariationOnGenerate.current = null;
    capturedImg2imgOnGenerate.current = null;
    mockFetchGenerations.mockResolvedValue([]);
    mockGetModelSettings.mockResolvedValue([]);
    mockGetProvenanceData.mockResolvedValue([]);
    mockGenerateImages.mockResolvedValue([
      makeGeneration({ id: "gen-new-1", status: "pending" }),
    ]);
    mockAddGalleryAsReference.mockResolvedValue({
      id: "ref-gallery-1",
      imageUrl: "https://example.com/image.png",
    });
  });

  // -------------------------------------------------------------------------
  // AC-1: handleVariationGenerate merges imageParams alongside prompt_strength
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN handleVariationGenerate wird mit VariationParams aufgerufen,
   *       die imageParams: { aspect_ratio: "16:9" } enthalten
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt der params-Parameter { prompt_strength: <number>, aspect_ratio: "16:9" }
   *       -- imageParams werden neben prompt_strength in params gemergt
   */
  it("AC-1: should spread imageParams into params alongside prompt_strength in handleVariationGenerate", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedVariationOnGenerate.current).not.toBeNull();
    });

    // Call the handler directly with imageParams containing aspect_ratio
    await act(async () => {
      capturedVariationOnGenerate.current!({
        prompt: "A sunset over mountains",
        strength: "balanced",
        count: 1,
        tier: "draft",
        imageParams: { aspect_ratio: "16:9" },
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-1: params must contain prompt_strength (from "balanced" = 0.6)
    expect(callArgs.params).toHaveProperty("prompt_strength");
    expect(callArgs.params.prompt_strength).toBe(0.6);

    // AC-1: params must contain aspect_ratio from imageParams
    expect(callArgs.params).toHaveProperty("aspect_ratio", "16:9");

    // AC-1: Both keys coexist in the same params object
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        prompt_strength: 0.6,
        aspect_ratio: "16:9",
      })
    );
  });

  // -------------------------------------------------------------------------
  // AC-2: handleImg2imgGenerate merges imageParams into empty params object
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN handleImg2imgGenerate wird mit Img2imgParams aufgerufen,
   *       die imageParams: { resolution: "2K" } enthalten
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt der params-Parameter { resolution: "2K" }
   *       -- imageParams werden in das bisher leere params-Objekt gemergt
   */
  it("AC-2: should spread imageParams into params in handleImg2imgGenerate", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedImg2imgOnGenerate.current).not.toBeNull();
    });

    // Call the handler directly with imageParams containing resolution
    await act(async () => {
      capturedImg2imgOnGenerate.current!({
        references: [],
        motiv: "A cyberpunk cityscape",
        style: "neon",
        variants: 1,
        tier: "draft",
        imageParams: { resolution: "2K" },
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-2: params must contain resolution from imageParams
    expect(callArgs.params).toHaveProperty("resolution", "2K");

    // AC-2: params should contain the imageParams values
    expect(callArgs.params).toEqual(
      expect.objectContaining({ resolution: "2K" })
    );
  });

  // -------------------------------------------------------------------------
  // AC-3: Multiple imageParams keys are all merged
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN handleVariationGenerate wird mit VariationParams aufgerufen,
   *       die imageParams: { aspect_ratio: "3:2", megapixels: "0.25" } enthalten
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt der params-Parameter { prompt_strength: <number>, aspect_ratio: "3:2", megapixels: "0.25" }
   *       -- alle imageParams-Keys sind im params-Objekt
   */
  it("AC-3: should merge all imageParams keys into params for variation generation", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedVariationOnGenerate.current).not.toBeNull();
    });

    // Call the handler with multiple imageParams keys
    await act(async () => {
      capturedVariationOnGenerate.current!({
        prompt: "A landscape with mountains",
        strength: "subtle",
        count: 2,
        tier: "draft",
        imageParams: { aspect_ratio: "3:2", megapixels: "0.25" },
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-3: prompt_strength from "subtle" = 0.3
    expect(callArgs.params).toHaveProperty("prompt_strength", 0.3);

    // AC-3: Both imageParams keys must be present
    expect(callArgs.params).toHaveProperty("aspect_ratio", "3:2");
    expect(callArgs.params).toHaveProperty("megapixels", "0.25");

    // AC-3: All three keys coexist
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        prompt_strength: 0.3,
        aspect_ratio: "3:2",
        megapixels: "0.25",
      })
    );
  });

  // -------------------------------------------------------------------------
  // AC-4: undefined imageParams in variation does not change behavior
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN handleVariationGenerate wird mit VariationParams aufgerufen,
   *       die imageParams: undefined enthalten (Popover ohne ParameterPanel, z.B. Schema-Error)
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt der params-Parameter nur { prompt_strength: <number> }
   *       -- Verhalten identisch zum Zustand ohne Feature
   */
  it("AC-4: should pass only prompt_strength when variation imageParams is undefined", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedVariationOnGenerate.current).not.toBeNull();
    });

    // Call the handler with imageParams: undefined
    await act(async () => {
      capturedVariationOnGenerate.current!({
        prompt: "A forest path",
        strength: "creative",
        count: 1,
        tier: "draft",
        imageParams: undefined,
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-4: prompt_strength from "creative" = 0.85
    expect(callArgs.params).toHaveProperty("prompt_strength", 0.85);

    // AC-4: No additional keys from imageParams
    expect(Object.keys(callArgs.params)).toEqual(["prompt_strength"]);

    // AC-4: Identical to pre-feature behavior
    expect(callArgs.params).toEqual({ prompt_strength: 0.85 });
  });

  // -------------------------------------------------------------------------
  // AC-5: undefined imageParams in img2img does not change behavior
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN handleImg2imgGenerate wird mit Img2imgParams aufgerufen,
   *       die imageParams: undefined enthalten
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt der params-Parameter {} -- Verhalten identisch zum Zustand ohne Feature
   */
  it("AC-5: should pass empty params when img2img imageParams is undefined", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedImg2imgOnGenerate.current).not.toBeNull();
    });

    // Call the handler with imageParams: undefined
    await act(async () => {
      capturedImg2imgOnGenerate.current!({
        references: [],
        motiv: "A still life",
        style: "",
        variants: 1,
        tier: "draft",
        imageParams: undefined,
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-5: params should be an empty object
    expect(callArgs.params).toEqual({});

    // AC-5: No keys should exist in params
    expect(Object.keys(callArgs.params)).toHaveLength(0);
  });
});
