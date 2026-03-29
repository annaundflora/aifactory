// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * Acceptance Tests for slice-07-canvas-ui: CanvasDetailView prompt simplification
 *
 * Verifies that handleVariationGenerate and handleImg2imgGenerate in
 * canvas-detail-view.tsx no longer pass promptStyle or negativePrompt
 * to generateImages(), and that promptMotiv is correctly set from the
 * simplified prompt fields.
 *
 * Mocking Strategy: mock_external per spec.
 * Popovers are mocked to capture onGenerate callbacks for direct invocation,
 * following the established pattern from canvas-detail-view-image-params-merge.test.tsx.
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
  mockGetModels: vi.fn(),
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

// Mock VariationPopover to capture onGenerate callback
vi.mock("@/components/canvas/popovers/variation-popover", () => ({
  VariationPopover: ({ onGenerate }: { onGenerate: (...args: unknown[]) => void }) => {
    capturedVariationOnGenerate.current = onGenerate;
    return <div data-testid="variation-popover-mock" />;
  },
}));

// Mock Img2imgPopover to capture onGenerate callback
vi.mock("@/components/canvas/popovers/img2img-popover", () => ({
  Img2imgPopover: ({ onGenerate }: { onGenerate: (...args: unknown[]) => void }) => {
    capturedImg2imgOnGenerate.current = onGenerate;
    return <div data-testid="img2img-popover-mock" />;
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
    modelId: overrides.modelId ?? "black-forest-labs/flux-2-max",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-29T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
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
    </CanvasDetailProvider>
  );
}

// ===========================================================================
// Acceptance Tests: CanvasDetailView - prompt simplification (slice-07)
// ===========================================================================

describe("CanvasDetailView - prompt simplification", () => {
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
  // AC-5: Variation generateImages ohne promptStyle/negativePrompt
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN die handleVariationGenerate-Funktion in canvas-detail-view.tsx
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt das Argument KEIN promptStyle und KEIN negativePrompt
   *       AND promptMotiv wird aus params.prompt gesetzt
   */
  it("AC-5: should call generateImages without promptStyle or negativePrompt for variation", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedVariationOnGenerate.current).not.toBeNull();
    });

    // Call the variation handler with typical params (no promptStyle/negativePrompt)
    await act(async () => {
      capturedVariationOnGenerate.current!({
        prompt: "A sunset over ocean waves",
        strength: "balanced",
        count: 2,
        tier: "draft",
        imageParams: {},
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-5: promptMotiv must be set from params.prompt
    expect(callArgs).toHaveProperty("promptMotiv", "A sunset over ocean waves");

    // AC-5: Must NOT contain promptStyle or negativePrompt at any level
    expect(callArgs).not.toHaveProperty("promptStyle");
    expect(callArgs).not.toHaveProperty("negativePrompt");

    // Also verify promptStyle/negativePrompt are not nested in params
    expect(callArgs.params).not.toHaveProperty("promptStyle");
    expect(callArgs.params).not.toHaveProperty("negativePrompt");

    // Verify the full key set of the top-level argument does not include removed fields
    const topLevelKeys = Object.keys(callArgs);
    expect(topLevelKeys).not.toContain("promptStyle");
    expect(topLevelKeys).not.toContain("negativePrompt");

    // Verify expected fields are present
    expect(callArgs).toHaveProperty("projectId");
    expect(callArgs).toHaveProperty("modelIds");
    expect(callArgs).toHaveProperty("count", 2);
    expect(callArgs).toHaveProperty("generationMode", "img2img");
  });

  // -------------------------------------------------------------------------
  // AC-6: Img2img generateImages ohne promptStyle
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN die handleImg2imgGenerate-Funktion in canvas-detail-view.tsx
   *       WHEN generateImages() aufgerufen wird
   *       THEN enthaelt das Argument KEIN promptStyle
   *       AND promptMotiv wird aus params.motiv gesetzt
   */
  it("AC-6: should call generateImages without promptStyle for img2img", async () => {
    renderDetailView();

    // Wait for component to mount and capture onGenerate
    await waitFor(() => {
      expect(capturedImg2imgOnGenerate.current).not.toBeNull();
    });

    // Call the img2img handler with typical params (no promptStyle)
    await act(async () => {
      capturedImg2imgOnGenerate.current!({
        references: [],
        motiv: "A cyberpunk cityscape at night",
        style: "",
        variants: 1,
        tier: "draft",
        imageParams: {},
      });
    });

    // Assert generateImages was called
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];

    // AC-6: promptMotiv must be set from params.motiv
    expect(callArgs).toHaveProperty("promptMotiv", "A cyberpunk cityscape at night");

    // AC-6: Must NOT contain promptStyle at any level
    expect(callArgs).not.toHaveProperty("promptStyle");

    // Also check the params sub-object
    expect(callArgs.params).not.toHaveProperty("promptStyle");

    // Verify the full key set does not include promptStyle
    const topLevelKeys = Object.keys(callArgs);
    expect(topLevelKeys).not.toContain("promptStyle");

    // Verify expected fields are present
    expect(callArgs).toHaveProperty("projectId");
    expect(callArgs).toHaveProperty("modelIds");
    expect(callArgs).toHaveProperty("generationMode", "img2img");
  });
});
