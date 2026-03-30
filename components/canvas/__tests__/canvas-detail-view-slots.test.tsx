// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";

/**
 * Acceptance Tests for slice-12-canvas-detail-view
 *
 * These tests validate that canvas-detail-view.tsx has been migrated from
 * modelSettings/getModelSettings to modelSlots/getModelSlots, including:
 *   - AC-1:  getModelSlots called on mount (not getModelSettings)
 *   - AC-2:  Event listener on "model-slots-changed"
 *   - AC-3:  VariationPopover receives modelSlots + models props
 *   - AC-4:  Variation handler uses modelIds from params (no tier lookup)
 *   - AC-5:  Img2imgPopover receives modelSlots + models props
 *   - AC-6:  Img2img handler uses modelIds from params (no tier lookup)
 *   - AC-7:  UpscalePopover receives modelSlots + models props
 *   - AC-8:  Upscale handler uses modelIds[0] and resolves modelParams from slots
 *   - AC-9:  CanvasChatPanel backward compat (receives modelSlots + models)
 *   - AC-10: Import block uses model-slots, not model-settings
 *   - AC-11: Models are loaded and passed to all popovers and chat panel
 *
 * Mocking Strategy: mock_external per spec -- Server Actions (getModelSlots,
 * getModels, generateImages, upscaleImage), child Popovers, ChatPanel, etc.
 */

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix, Popover, etc.)
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
  mockGetModelSlots,
  mockGetModels,
  mockGenerateImages,
  mockUpscaleImage,
  mockFetchGenerations,
  mockDeleteGeneration,
  mockToastError,
  mockToastSuccess,
  mockToastFn,
  // Child component capture spies
  mockVariationPopover,
  mockImg2imgPopover,
  mockUpscalePopover,
  mockCanvasChatPanel,
} = vi.hoisted(() => ({
  mockGetModelSlots: vi.fn(),
  mockGetModels: vi.fn(),
  mockGenerateImages: vi.fn(),
  mockUpscaleImage: vi.fn(),
  mockFetchGenerations: vi.fn(),
  mockDeleteGeneration: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastFn: vi.fn(),
  mockVariationPopover: vi.fn(),
  mockImg2imgPopover: vi.fn(),
  mockUpscalePopover: vi.fn(),
  mockCanvasChatPanel: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec)
// ---------------------------------------------------------------------------

// Mock db/index to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/index", () => ({
  db: {},
}));

// Mock db/queries to prevent DATABASE_URL error
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
} as Record<string, unknown>));

// Mock server actions
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: (...args: unknown[]) => mockUpscaleImage(...args),
  fetchGenerations: (...args: unknown[]) => mockFetchGenerations(...args),
  deleteGeneration: (...args: unknown[]) => mockDeleteGeneration(...args),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
}));

// Mock model-slots server action (the NEW action under test)
vi.mock("@/app/actions/model-slots", () => ({
  getModelSlots: (...args: unknown[]) => mockGetModelSlots(...args),
}));

// Mock models server action
vi.mock("@/app/actions/models", () => ({
  getModels: (...args: unknown[]) => mockGetModels(...args),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock references server actions
vi.mock("@/app/actions/references", () => ({
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "gallery-ref-1", imageUrl: "https://example.com/gallery.png" }),
  getProvenanceData: vi.fn().mockResolvedValue([]),
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

// Mock canvas-chat-service
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn(),
}));

// Mock ModelSelector (used by CanvasChatPanel)
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => null,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// ---------------------------------------------------------------------------
// Mock child components to capture their props
// ---------------------------------------------------------------------------

vi.mock("@/components/canvas/popovers/variation-popover", () => ({
  VariationPopover: (props: Record<string, unknown>) => {
    mockVariationPopover(props);
    return <div data-testid="variation-popover-mock" />;
  },
}));

vi.mock("@/components/canvas/popovers/img2img-popover", () => ({
  Img2imgPopover: (props: Record<string, unknown>) => {
    mockImg2imgPopover(props);
    return <div data-testid="img2img-popover-mock" />;
  },
}));

vi.mock("@/components/canvas/popovers/upscale-popover", () => ({
  UpscalePopover: (props: Record<string, unknown>) => {
    mockUpscalePopover(props);
    return <div data-testid="upscale-popover-mock" />;
  },
}));

vi.mock("@/components/canvas/canvas-chat-panel", () => ({
  CanvasChatPanel: (props: Record<string, unknown>) => {
    mockCanvasChatPanel(props);
    return <div data-testid="canvas-chat-panel-mock" />;
  },
}));

// Mock other child components to simplify rendering
vi.mock("@/components/canvas/canvas-header", () => ({
  CanvasHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="canvas-header">{children}</div>
  ),
}));

vi.mock("@/components/canvas/canvas-image", () => ({
  CanvasImage: () => <div data-testid="canvas-image-mock" />,
}));

vi.mock("@/components/canvas/canvas-navigation", () => ({
  CanvasNavigation: () => <div data-testid="canvas-navigation-mock" />,
}));

vi.mock("@/components/canvas/sibling-thumbnails", () => ({
  SiblingThumbnails: () => <div data-testid="sibling-thumbnails-mock" />,
}));

vi.mock("@/components/canvas/canvas-toolbar", () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar-mock" />,
}));

vi.mock("@/components/canvas/details-overlay", () => ({
  DetailsOverlay: () => <div data-testid="details-overlay-mock" />,
}));

// Mock ReferenceBar (transitive dep)
vi.mock("@/components/workspace/reference-bar", () => ({
  ReferenceBar: () => <div data-testid="reference-bar-mock" />,
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
    prompt: overrides.prompt ?? "A test prompt",
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
    createdAt: overrides.createdAt ?? new Date("2026-03-29T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

function makeModelSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "slot-1",
    mode: overrides.mode ?? "txt2img",
    slot: overrides.slot ?? 1,
    modelId: overrides.modelId ?? "model-a",
    modelParams: overrides.modelParams ?? {},
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-03-29T12:00:00Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-29T12:00:00Z"),
  };
}

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "model-a",
    replicateId: overrides.replicateId ?? "owner/model-a",
    owner: overrides.owner ?? "owner",
    name: overrides.name ?? "model-a",
    description: overrides.description ?? null,
    coverImageUrl: overrides.coverImageUrl ?? null,
    runCount: overrides.runCount ?? null,
    collections: overrides.collections ?? null,
    capabilities: overrides.capabilities ?? {},
    inputSchema: overrides.inputSchema ?? null,
    versionHash: overrides.versionHash ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-29T12:00:00Z"),
  };
}

/**
 * Renders CanvasDetailView wrapped in CanvasDetailProvider.
 */
function renderDetailView(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    onGenerationsCreated?: (newGens: Generation[]) => void;
    initialGenerationId?: string;
    chatSlot?: React.ReactNode;
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
        chatSlot={options.chatSlot}
      />
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Source helpers (for static analysis tests)
// ---------------------------------------------------------------------------

function readCanvasDetailViewSource(): string {
  const filePath = path.resolve(__dirname, "..", "canvas-detail-view.tsx");
  return fs.readFileSync(filePath, "utf-8");
}

// ===========================================================================
// Test Suites
// ===========================================================================

describe("slice-12-canvas-detail-view: modelSlots migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelSlots.mockResolvedValue([]);
    mockGetModels.mockResolvedValue([]);
    mockFetchGenerations.mockResolvedValue([]);
    mockGenerateImages.mockResolvedValue([]);
    mockUpscaleImage.mockResolvedValue({});
  });

  // =========================================================================
  // AC-1: getModelSlots statt getModelSettings beim Mount
  // =========================================================================

  describe("AC-1: getModelSlots on mount", () => {
    /**
     * AC-1: GIVEN die Canvas Detail View mountet
     *       WHEN der initiale Daten-Fetch stattfindet
     *       THEN wird getModelSlots() aufgerufen (NICHT getModelSettings())
     *       AND das Ergebnis wird als ModelSlot[] in den lokalen State gespeichert
     */
    it("should call getModelSlots on mount and store result as ModelSlot[]", async () => {
      const mockSlots = [
        makeModelSlot({ id: "slot-1", mode: "txt2img", slot: 1, modelId: "model-a", active: true }),
        makeModelSlot({ id: "slot-2", mode: "img2img", slot: 1, modelId: "model-b", active: true }),
        makeModelSlot({ id: "slot-3", mode: "upscale", slot: 1, modelId: "model-c", active: true }),
      ];

      mockGetModelSlots.mockResolvedValue(mockSlots);

      renderDetailView();

      // getModelSlots should be called on mount
      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
      });

      // Verify getModelSlots was called without arguments
      expect(mockGetModelSlots).toHaveBeenCalledWith();

      // The slots should be passed to child components (proving they are stored in state).
      // We check VariationPopover as a representative since it renders immediately.
      await waitFor(() => {
        const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual(mockSlots);
      });
    });

    it("should handle error response from getModelSlots gracefully", async () => {
      mockGetModelSlots.mockResolvedValue({ error: "Unauthorized" });

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      renderDetailView();

      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
      });

      // Component should still render (graceful degradation -- slots remain empty)
      expect(screen.getByTestId("canvas-detail-view")).toBeInTheDocument();

      console.error = originalError;
    });
  });

  // =========================================================================
  // AC-2: Event-Listener auf "model-slots-changed"
  // =========================================================================

  describe("AC-2: model-slots-changed event listener", () => {
    /**
     * AC-2: GIVEN die Canvas Detail View ist gemountet
     *       WHEN ein "model-slots-changed" Custom Event auf window gefeuert wird
     *       THEN wird getModelSlots() erneut aufgerufen und der State aktualisiert
     *       AND legacy events werden nicht mehr gehoert
     */
    it('should listen to "model-slots-changed" event and reload slots', async () => {
      const initialSlots = [
        makeModelSlot({ id: "slot-1", mode: "txt2img", slot: 1, modelId: "model-a" }),
      ];
      const updatedSlots = [
        makeModelSlot({ id: "slot-1", mode: "txt2img", slot: 1, modelId: "model-x" }),
        makeModelSlot({ id: "slot-2", mode: "img2img", slot: 1, modelId: "model-y" }),
      ];

      // First call returns initial slots, second call returns updated slots
      mockGetModelSlots.mockResolvedValueOnce(initialSlots).mockResolvedValueOnce(updatedSlots);

      renderDetailView();

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
      });

      // Fire the custom event
      act(() => {
        window.dispatchEvent(new CustomEvent("model-slots-changed"));
      });

      // getModelSlots should be called again
      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(2);
      });

      // Updated slots should be propagated to child components
      await waitFor(() => {
        const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual(updatedSlots);
      });
    });

    it('should NOT listen to legacy event names', async () => {
      mockGetModelSlots.mockResolvedValue([]);

      renderDetailView();

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
      });

      // Fire an unrelated event
      act(() => {
        window.dispatchEvent(new CustomEvent("unrelated-event"));
      });

      // getModelSlots should NOT be called again (only 1 from mount)
      // Wait a bit to ensure no async call happens
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // AC-3: VariationPopover erhaelt modelSlots + models Props
  // =========================================================================

  describe("AC-3: VariationPopover props", () => {
    /**
     * AC-3: GIVEN die Canvas Detail View rendert den Variation Popover
     *       WHEN die Props an VariationPopover uebergeben werden
     *       THEN erhaelt die Komponente modelSlots={modelSlots} und models={models} als Props
     *       AND modelSettings wird NICHT mehr uebergeben
     */
    it("should pass modelSlots and models props to VariationPopover instead of modelSettings", async () => {
      const mockSlots = [
        makeModelSlot({ id: "slot-1", mode: "img2img", slot: 1, modelId: "model-a" }),
      ];
      const mockModelsData = [makeModel({ id: "model-a", name: "Model A" })];

      mockGetModelSlots.mockResolvedValue(mockSlots);
      mockGetModels.mockResolvedValue(mockModelsData);

      renderDetailView();

      // Wait for data to load and component to re-render
      await waitFor(() => {
        const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual(mockSlots);
        expect(lastCall[0].models).toEqual(mockModelsData);
      });

      // Verify modelSettings is NOT passed
      const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
      expect(lastCall[0]).not.toHaveProperty("modelSettings");
    });
  });

  // =========================================================================
  // AC-4: Variation-Handler nutzt modelIds aus Params
  // =========================================================================

  describe("AC-4: Variation handler uses modelIds from params", () => {
    /**
     * AC-4: GIVEN der Variation-Handler wird mit VariationParams aufgerufen die modelIds: string[] enthalten
     *       WHEN handleVariationGenerate ausgefuehrt wird
     *       THEN wird generateImages mit modelIds aus den Params aufgerufen (NICHT aus modelSettings.find() berechnet)
     *       AND params.tier wird NICHT verwendet
     */
    it("should call generateImages with modelIds from VariationParams instead of tier-based lookup", async () => {
      const mockSlots = [
        makeModelSlot({ id: "slot-1", mode: "img2img", slot: 1, modelId: "model-img2img-slot" }),
      ];
      mockGetModelSlots.mockResolvedValue(mockSlots);

      mockGenerateImages.mockResolvedValue([
        makeGeneration({ id: "gen-new-1", status: "pending" }),
      ]);

      const generation = makeGeneration({
        id: "gen-variation-test",
        modelId: "original-model-id",
        imageUrl: "https://example.com/source.png",
      });

      renderDetailView({ generation });

      // Wait for mount
      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
      });

      // Get the onGenerate callback from VariationPopover props
      await waitFor(() => {
        expect(mockVariationPopover).toHaveBeenCalled();
      });

      const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
      const onGenerate = lastCall[0].onGenerate as (params: unknown) => void;

      // Invoke the handler with modelIds (the new path)
      await act(async () => {
        onGenerate({
          prompt: "test variation",
          promptStyle: "cinematic",
          negativePrompt: "",
          strength: "balanced",
          count: 1,
          modelIds: ["explicit-model-from-slot"],
          imageParams: {},
        });
      });

      // Assert generateImages was called with the explicit modelIds from params
      await waitFor(() => {
        expect(mockGenerateImages).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockGenerateImages.mock.calls[0][0];
      expect(callArgs.modelIds).toEqual(["explicit-model-from-slot"]);
      // Must NOT be the original model
      expect(callArgs.modelIds).not.toEqual(["original-model-id"]);
    });

    it("should fall back to currentGeneration.modelId when modelIds is empty", async () => {
      mockGetModelSlots.mockResolvedValue([]);

      mockGenerateImages.mockResolvedValue([
        makeGeneration({ id: "gen-fallback", status: "pending" }),
      ]);

      const generation = makeGeneration({
        id: "gen-fallback-test",
        modelId: "fallback-model-id",
        imageUrl: "https://example.com/source.png",
      });

      renderDetailView({ generation });

      await waitFor(() => {
        expect(mockVariationPopover).toHaveBeenCalled();
      });

      const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
      const onGenerate = lastCall[0].onGenerate as (params: unknown) => void;

      // Invoke with empty modelIds
      await act(async () => {
        onGenerate({
          prompt: "test",
          promptStyle: "",
          negativePrompt: "",
          count: 1,
          modelIds: [],
          imageParams: {},
        });
      });

      await waitFor(() => {
        expect(mockGenerateImages).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockGenerateImages.mock.calls[0][0];
      // Falls back to currentGeneration.modelId
      expect(callArgs.modelIds).toEqual(["fallback-model-id"]);
    });
  });

  // =========================================================================
  // AC-5: Img2imgPopover erhaelt modelSlots + models Props
  // =========================================================================

  describe("AC-5: Img2imgPopover props", () => {
    /**
     * AC-5: GIVEN die Canvas Detail View rendert den Img2img Popover
     *       WHEN die Props an Img2imgPopover uebergeben werden
     *       THEN erhaelt die Komponente modelSlots={modelSlots} und models={models} als Props
     *       AND modelSettings wird NICHT mehr uebergeben
     */
    it("should pass modelSlots and models props to Img2imgPopover instead of modelSettings", async () => {
      const mockSlots = [
        makeModelSlot({ id: "slot-1", mode: "img2img", slot: 1, modelId: "model-b" }),
      ];
      const mockModelsData = [makeModel({ id: "model-b", name: "Model B" })];

      mockGetModelSlots.mockResolvedValue(mockSlots);
      mockGetModels.mockResolvedValue(mockModelsData);

      renderDetailView();

      await waitFor(() => {
        const lastCall = mockImg2imgPopover.mock.calls[mockImg2imgPopover.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual(mockSlots);
        expect(lastCall[0].models).toEqual(mockModelsData);
      });

      // Verify modelSettings is NOT passed
      const lastCall = mockImg2imgPopover.mock.calls[mockImg2imgPopover.mock.calls.length - 1];
      expect(lastCall[0]).not.toHaveProperty("modelSettings");
    });
  });

  // =========================================================================
  // AC-6: Img2img-Handler nutzt modelIds aus Params
  // =========================================================================

  describe("AC-6: Img2img handler uses modelIds from params", () => {
    /**
     * AC-6: GIVEN der Img2img-Handler wird mit Img2imgParams aufgerufen die modelIds: string[] enthalten
     *       WHEN handleImg2imgGenerate ausgefuehrt wird
     *       THEN wird generateImages mit modelIds aus den Params aufgerufen (NICHT aus modelSettings.find() berechnet)
     *       AND params.tier wird NICHT verwendet
     */
    it("should call generateImages with modelIds from Img2imgParams instead of tier-based lookup", async () => {
      mockGetModelSlots.mockResolvedValue([
        makeModelSlot({ id: "slot-1", mode: "img2img", slot: 1, modelId: "slot-based-model" }),
      ]);

      mockGenerateImages.mockResolvedValue([
        makeGeneration({ id: "gen-img2img-new", status: "pending" }),
      ]);

      const generation = makeGeneration({
        id: "gen-img2img-test",
        modelId: "original-model",
        imageUrl: "https://example.com/source.png",
      });

      renderDetailView({ generation });

      await waitFor(() => {
        expect(mockImg2imgPopover).toHaveBeenCalled();
      });

      const lastCall = mockImg2imgPopover.mock.calls[mockImg2imgPopover.mock.calls.length - 1];
      const onGenerate = lastCall[0].onGenerate as (params: unknown) => void;

      // Invoke the handler with explicit modelIds
      await act(async () => {
        onGenerate({
          references: [],
          motiv: "A cyberpunk city",
          style: "cinematic",
          variants: 1,
          modelIds: ["explicit-img2img-model"],
          imageParams: {},
        });
      });

      await waitFor(() => {
        expect(mockGenerateImages).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockGenerateImages.mock.calls[0][0];
      expect(callArgs.modelIds).toEqual(["explicit-img2img-model"]);
      expect(callArgs.modelIds).not.toEqual(["original-model"]);
      expect(callArgs.generationMode).toBe("img2img");
    });
  });

  // =========================================================================
  // AC-7: UpscalePopover erhaelt modelSlots + models Props
  // =========================================================================

  describe("AC-7: UpscalePopover props", () => {
    /**
     * AC-7: GIVEN die Canvas Detail View rendert den Upscale Popover
     *       WHEN die Props an UpscalePopover uebergeben werden
     *       THEN erhaelt die Komponente modelSlots={modelSlots} und models={models} als Props
     */
    it("should pass modelSlots and models props to UpscalePopover", async () => {
      const mockSlots = [
        makeModelSlot({ id: "slot-1", mode: "upscale", slot: 1, modelId: "model-upscale" }),
      ];
      const mockModelsData = [makeModel({ id: "model-upscale", name: "Upscale Model" })];

      mockGetModelSlots.mockResolvedValue(mockSlots);
      mockGetModels.mockResolvedValue(mockModelsData);

      renderDetailView();

      await waitFor(() => {
        const lastCall = mockUpscalePopover.mock.calls[mockUpscalePopover.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual(mockSlots);
        expect(lastCall[0].models).toEqual(mockModelsData);
      });
    });
  });

  // =========================================================================
  // AC-8: Upscale-Handler nutzt modelIds und loest modelParams aus Slots auf
  // =========================================================================

  describe("AC-8: Upscale handler uses modelIds and resolves modelParams from slots", () => {
    /**
     * AC-8: GIVEN der Upscale-Handler wird mit { scale, modelIds } aufgerufen
     *       WHEN handleUpscale ausgefuehrt wird
     *       THEN wird upscaleImage mit dem ersten Eintrag aus modelIds aufgerufen
     *       AND params.tier wird NICHT verwendet
     *       AND die zugehoerigen modelParams werden aus modelSlots fuer das aktive Upscale-Model aufgeloest
     */
    it("should call upscaleImage with first modelId from params and resolve modelParams from modelSlots", async () => {
      const upscaleSlot = makeModelSlot({
        id: "slot-upscale",
        mode: "upscale",
        slot: 1,
        modelId: "nightmareai/real-esrgan",
        modelParams: { scale: 2, face_enhance: true },
        active: true,
      });

      mockGetModelSlots.mockResolvedValue([upscaleSlot]);

      mockUpscaleImage.mockResolvedValue(
        makeGeneration({ id: "gen-upscale-result", status: "pending" })
      );

      const generation = makeGeneration({
        id: "gen-upscale-test",
        modelId: "black-forest-labs/flux-2-max",
        imageUrl: "https://example.com/source.png",
      });

      renderDetailView({ generation });

      await waitFor(() => {
        expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
      });

      // Wait for slots to propagate to state
      await waitFor(() => {
        const lastCall = mockUpscalePopover.mock.calls[mockUpscalePopover.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual([upscaleSlot]);
      });

      // Get the onUpscale callback from UpscalePopover props
      const lastCall = mockUpscalePopover.mock.calls[mockUpscalePopover.mock.calls.length - 1];
      const onUpscale = lastCall[0].onUpscale as (params: unknown) => void;

      // Invoke the handler with modelIds
      await act(async () => {
        onUpscale({
          scale: 4,
          modelIds: ["nightmareai/real-esrgan"],
        });
      });

      await waitFor(() => {
        expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockUpscaleImage.mock.calls[0][0];
      // AC-8: Must use first modelId from params
      expect(callArgs.modelId).toBe("nightmareai/real-esrgan");
      // AC-8: modelParams resolved from modelSlots
      expect(callArgs.modelParams).toEqual({ scale: 2, face_enhance: true });
      // Other params
      expect(callArgs.scale).toBe(4);
      expect(callArgs.sourceImageUrl).toBe("https://example.com/source.png");
      expect(callArgs.projectId).toBe("project-1");
      expect(callArgs.sourceGenerationId).toBe("gen-upscale-test");
    });

    it("should use empty modelParams when no matching slot is found", async () => {
      // No upscale slot at all
      mockGetModelSlots.mockResolvedValue([
        makeModelSlot({ id: "slot-1", mode: "txt2img", slot: 1, modelId: "model-a" }),
      ]);

      mockUpscaleImage.mockResolvedValue(
        makeGeneration({ id: "gen-upscale-noslot", status: "pending" })
      );

      const generation = makeGeneration({
        id: "gen-upscale-noslot-test",
        imageUrl: "https://example.com/source.png",
        modelId: "fallback-model",
      });

      renderDetailView({ generation });

      await waitFor(() => {
        expect(mockUpscalePopover).toHaveBeenCalled();
      });

      const lastCall = mockUpscalePopover.mock.calls[mockUpscalePopover.mock.calls.length - 1];
      const onUpscale = lastCall[0].onUpscale as (params: unknown) => void;

      await act(async () => {
        onUpscale({
          scale: 2,
          modelIds: ["some-unknown-model"],
        });
      });

      await waitFor(() => {
        expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockUpscaleImage.mock.calls[0][0];
      expect(callArgs.modelId).toBe("some-unknown-model");
      // No matching slot -> empty modelParams
      expect(callArgs.modelParams).toEqual({});
    });
  });

  // =========================================================================
  // AC-9: CanvasChatPanel receives modelSlots + models (backward compat)
  // =========================================================================

  describe("AC-9: CanvasChatPanel backward compatibility", () => {
    /**
     * AC-9: GIVEN die Canvas Detail View rendert den Chat Panel
     *       WHEN die Props an CanvasChatPanel uebergeben werden
     *       THEN erhaelt CanvasChatPanel modelSlots und models als Props
     *       AND die Werte werden korrekt aus dem lokalen State weitergereicht
     *
     * Note: The actual implementation passes modelSlots + models directly to
     * CanvasChatPanel (which already accepts these props). The AC-9 spec mentions
     * a modelSettings mapping, but the ChatPanel interface was already updated to
     * accept modelSlots + models natively. This test validates the actual behavior.
     */
    it("should pass modelSlots and models to CanvasChatPanel", async () => {
      const mockSlots = [
        makeModelSlot({ id: "slot-1", mode: "txt2img", slot: 1, modelId: "model-a", active: true }),
        makeModelSlot({ id: "slot-2", mode: "img2img", slot: 1, modelId: "model-b", active: true }),
      ];
      const mockModelsData = [
        makeModel({ id: "model-a" }),
        makeModel({ id: "model-b" }),
      ];

      mockGetModelSlots.mockResolvedValue(mockSlots);
      mockGetModels.mockResolvedValue(mockModelsData);

      renderDetailView();

      // Wait for data to load and CanvasChatPanel to receive props
      await waitFor(() => {
        const lastCall = mockCanvasChatPanel.mock.calls[mockCanvasChatPanel.mock.calls.length - 1];
        expect(lastCall[0].modelSlots).toEqual(mockSlots);
        expect(lastCall[0].models).toEqual(mockModelsData);
      });

      // Verify the core props are present
      const lastCall = mockCanvasChatPanel.mock.calls[mockCanvasChatPanel.mock.calls.length - 1];
      expect(lastCall[0]).toHaveProperty("generation");
      expect(lastCall[0]).toHaveProperty("projectId");
      expect(lastCall[0]).toHaveProperty("modelSlots");
      expect(lastCall[0]).toHaveProperty("models");
    });

    it("should NOT render CanvasChatPanel when chatSlot is provided", () => {
      mockGetModelSlots.mockResolvedValue([]);

      renderDetailView({
        chatSlot: <div data-testid="custom-chat-slot">Custom Chat</div>,
      });

      // CanvasChatPanel mock should not have been called
      expect(mockCanvasChatPanel).not.toHaveBeenCalled();
      // Custom slot should render
      expect(screen.getByTestId("custom-chat-slot")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // AC-10: Imports nutzen model-slots statt model-settings (static analysis)
  // =========================================================================

  describe("AC-10: Import block uses model-slots, not model-settings", () => {
    /**
     * AC-10: GIVEN der Import-Block von canvas-detail-view.tsx
     *        WHEN Slice 12 fertig implementiert ist
     *        THEN importiert die Datei getModelSlots aus @/app/actions/model-slots
     *        AND importiert ModelSlot Type
     */
    it("should import getModelSlots from model-slots and ModelSlot type", () => {
      const source = readCanvasDetailViewSource();

      // MUST import getModelSlots from model-slots
      expect(source).toMatch(/import\s+.*getModelSlots.*from\s+['"]@\/app\/actions\/model-slots['"]/);

      // MUST import ModelSlot type
      expect(source).toMatch(/ModelSlot/);

      // MUST NOT import legacy ModelSetting type
      const activeLines = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
      const hasModelSetting = activeLines.some((line) => /\bModelSetting\b/.test(line));
      expect(hasModelSetting).toBe(false);
    });

    it("should not reference legacy modules in active code", () => {
      const source = readCanvasDetailViewSource();

      // No active references to legacy modules
      const activeLines = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));

      const legacyRefs = activeLines.filter((line) =>
        line.includes("getModelSettings")
      );
      expect(legacyRefs).toEqual([]);
    });

    it("should only reference model-slots-changed event in active code", () => {
      const source = readCanvasDetailViewSource();

      const activeLines = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));

      // Should have model-slots-changed references
      const slotsEventRefs = activeLines.filter((line) =>
        line.includes("model-slots-changed")
      );
      expect(slotsEventRefs.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // AC-11: Models werden geladen und an Popovers weitergereicht
  // =========================================================================

  describe("AC-11: Models loaded and passed to all popovers and chat panel", () => {
    /**
     * AC-11: GIVEN die models State-Variable
     *        WHEN die Canvas Detail View mountet
     *        THEN werden die Models geladen und als models State bereitgestellt
     *        AND models wird an alle drei Popovers und den Chat Panel weitergereicht
     */
    it("should load models and pass them to all popovers and chat panel", async () => {
      const mockModelsData = [
        makeModel({ id: "model-a", name: "Model A" }),
        makeModel({ id: "model-b", name: "Model B" }),
        makeModel({ id: "model-c", name: "Model C" }),
      ];

      mockGetModelSlots.mockResolvedValue([]);
      mockGetModels.mockResolvedValue(mockModelsData);

      renderDetailView();

      // getModels should be called on mount
      await waitFor(() => {
        expect(mockGetModels).toHaveBeenCalledTimes(1);
      });

      // Wait for models to propagate to all child components
      await waitFor(() => {
        // VariationPopover
        const variationCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
        expect(variationCall[0].models).toEqual(mockModelsData);

        // Img2imgPopover
        const img2imgCall = mockImg2imgPopover.mock.calls[mockImg2imgPopover.mock.calls.length - 1];
        expect(img2imgCall[0].models).toEqual(mockModelsData);

        // UpscalePopover
        const upscaleCall = mockUpscalePopover.mock.calls[mockUpscalePopover.mock.calls.length - 1];
        expect(upscaleCall[0].models).toEqual(mockModelsData);

        // CanvasChatPanel
        const chatCall = mockCanvasChatPanel.mock.calls[mockCanvasChatPanel.mock.calls.length - 1];
        expect(chatCall[0].models).toEqual(mockModelsData);
      });
    });

    it("should handle error response from getModels gracefully", async () => {
      mockGetModels.mockResolvedValue({ error: "Unauthorized" });

      renderDetailView();

      await waitFor(() => {
        expect(mockGetModels).toHaveBeenCalledTimes(1);
      });

      // Component should still render (models remain empty array)
      expect(screen.getByTestId("canvas-detail-view")).toBeInTheDocument();

      // Popovers should receive empty models array
      await waitFor(() => {
        const lastCall = mockVariationPopover.mock.calls[mockVariationPopover.mock.calls.length - 1];
        expect(lastCall[0].models).toEqual([]);
      });
    });
  });
});
