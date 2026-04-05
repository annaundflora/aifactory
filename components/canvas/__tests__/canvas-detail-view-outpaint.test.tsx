// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom
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
// Mocks (mock_external strategy per slice-13 spec)
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
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn(),
}));

// Mock server actions
vi.mock("@/app/actions/generations", () => ({
  generateImages: vi.fn().mockResolvedValue([]),
  upscaleImage: vi.fn().mockResolvedValue({}),
  fetchGenerations: vi.fn().mockResolvedValue([]),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
}));

// Mock upload
vi.mock("@/app/actions/upload", () => ({
  uploadMask: vi.fn().mockResolvedValue({ url: "https://r2.example.com/masks/uploaded-mask.png" }),
}));

// Mock MaskService functions
vi.mock("@/lib/services/mask-service", () => ({
  validateMinSize: vi.fn().mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } }),
  applyFeathering: vi.fn().mockImplementation((imageData: ImageData) => imageData),
  scaleToOriginal: vi.fn().mockImplementation((imageData: ImageData) => imageData),
  toGrayscalePng: vi.fn().mockResolvedValue(new Blob(["mock-png"], { type: "image/png" })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

// Mock lib/utils
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

// Mock resolve-model utility
vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: vi.fn().mockReturnValue([]),
}));

// Mock MaskCanvas to prevent jsdom canvas context errors
vi.mock("@/components/canvas/mask-canvas", () => ({
  MaskCanvas: () => <div data-testid="mask-canvas-mock" />,
}));

// Mock OutpaintControls with a recognizable test-id
vi.mock("@/components/canvas/outpaint-controls", () => ({
  OutpaintControls: () => <div data-testid="outpaint-controls-mock" />,
}));

// Mock FloatingBrushToolbar
vi.mock("@/components/canvas/floating-brush-toolbar", () => ({
  FloatingBrushToolbar: () => <div data-testid="floating-brush-toolbar-mock" />,
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import { type Generation } from "@/lib/db/queries";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-outpaint-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a scenic landscape",
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
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
 * Helper component that sets editMode in the context on mount.
 */
function SetEditModeHelper({ editMode }: { editMode: "inpaint" | "erase" | "instruction" | "outpaint" | null }) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    dispatch({ type: "SET_EDIT_MODE", editMode });
  }, [dispatch, editMode]);
  return null;
}

/**
 * Renders CanvasDetailView wrapped in CanvasDetailProvider with optional editMode.
 */
function renderDetailView(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const allGenerations = options.allGenerations ?? [generation];
  const onBack = options.onBack ?? vi.fn();
  const editMode = options.editMode ?? null;

  return render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetEditModeHelper editMode={editMode} />
      <CanvasDetailView
        generation={generation}
        allGenerations={allGenerations}
        onBack={onBack}
      />
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasDetailView -- OutpaintControls Mounting (Slice 13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  /**
   * AC-1: GIVEN `editMode` ist `"outpaint"` im Canvas Detail Context
   *       WHEN `canvas-detail-view.tsx` gerendert wird
   *       THEN wird `<OutpaintControls />` im Center-Column sichtbar gerendert
   *       AND `<MaskCanvas />` und `<FloatingBrushToolbar />` werden NICHT gerendert
   */
  it("AC-1: should render OutpaintControls when editMode is outpaint and hide MaskCanvas and FloatingBrushToolbar", () => {
    renderDetailView({ editMode: "outpaint" });

    // OutpaintControls should be visible
    expect(screen.getByTestId("outpaint-controls-mock")).toBeInTheDocument();

    // MaskCanvas should NOT be rendered
    expect(screen.queryByTestId("mask-canvas-mock")).not.toBeInTheDocument();

    // FloatingBrushToolbar should NOT be rendered
    expect(screen.queryByTestId("floating-brush-toolbar-mock")).not.toBeInTheDocument();
  });

  /**
   * AC-2: GIVEN `editMode` ist NICHT `"outpaint"` (z.B. `"inpaint"` oder `null`)
   *       WHEN `canvas-detail-view.tsx` gerendert wird
   *       THEN wird `<OutpaintControls />` NICHT gerendert
   */
  it("AC-2: should not render OutpaintControls when editMode is inpaint", () => {
    renderDetailView({ editMode: "inpaint" });

    // OutpaintControls should NOT be rendered
    expect(screen.queryByTestId("outpaint-controls-mock")).not.toBeInTheDocument();

    // MaskCanvas should still be rendered
    expect(screen.getByTestId("mask-canvas-mock")).toBeInTheDocument();

    // FloatingBrushToolbar should be rendered
    expect(screen.getByTestId("floating-brush-toolbar-mock")).toBeInTheDocument();
  });

  it("AC-2: should not render OutpaintControls when editMode is null", () => {
    renderDetailView({ editMode: null });

    // OutpaintControls should NOT be rendered
    expect(screen.queryByTestId("outpaint-controls-mock")).not.toBeInTheDocument();

    // MaskCanvas should still be rendered
    expect(screen.getByTestId("mask-canvas-mock")).toBeInTheDocument();

    // FloatingBrushToolbar should be rendered
    expect(screen.getByTestId("floating-brush-toolbar-mock")).toBeInTheDocument();
  });
});
