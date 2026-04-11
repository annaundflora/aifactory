// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Tests for slice-02-zoom-hook-transform: canvas-detail-view Transform Wrapper
 *
 * Tests AC-9 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver is mocked (not available in jsdom)
 * - External server actions and child components with complex deps are mocked
 * - CanvasDetailProvider is real
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock (must be before component imports)
// ---------------------------------------------------------------------------
vi.stubGlobal(
  "ResizeObserver",
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

// ---------------------------------------------------------------------------
// Mock child components that have deep dependency chains
// We only care about the transform wrapper, not the full component tree.
// ---------------------------------------------------------------------------
vi.mock("@/components/canvas/canvas-header", () => ({
  CanvasHeader: () => <div data-testid="mock-canvas-header" />,
}));

vi.mock("@/components/canvas/canvas-navigation", () => ({
  CanvasNavigation: () => <div data-testid="mock-canvas-navigation" />,
}));

vi.mock("@/components/canvas/sibling-thumbnails", () => ({
  SiblingThumbnails: () => <div data-testid="mock-sibling-thumbnails" />,
}));

vi.mock("@/components/canvas/canvas-toolbar", () => ({
  CanvasToolbar: () => <div data-testid="mock-canvas-toolbar" />,
}));

vi.mock("@/components/canvas/details-overlay", () => ({
  DetailsOverlay: () => <div data-testid="mock-details-overlay" />,
}));

vi.mock("@/components/canvas/popovers/variation-popover", () => ({
  VariationPopover: () => <div />,
}));

vi.mock("@/components/canvas/popovers/img2img-popover", () => ({
  Img2imgPopover: () => <div />,
}));

vi.mock("@/components/canvas/popovers/upscale-popover", () => ({
  UpscalePopover: () => <div />,
}));

vi.mock("@/components/canvas/canvas-chat-panel", () => ({
  CanvasChatPanel: () => <div />,
}));

vi.mock("@/components/canvas/mask-canvas", () => ({
  MaskCanvas: () => <div data-testid="mock-mask-canvas" />,
}));

vi.mock("@/components/canvas/floating-brush-toolbar", () => ({
  FloatingBrushToolbar: () => <div />,
}));

vi.mock("@/components/canvas/outpaint-controls", () => ({
  OutpaintControls: () => <div />,
}));

vi.mock("@/app/actions/generations", () => ({
  generateImages: vi.fn(),
  upscaleImage: vi.fn(),
  fetchGenerations: vi.fn(),
  deleteGeneration: vi.fn(),
}));

vi.mock("@/app/actions/model-slots", () => ({
  getModelSlots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/actions/references", () => ({
  uploadReferenceImage: vi.fn(),
  addGalleryAsReference: vi.fn(),
}));

vi.mock("@/app/actions/upload", () => ({
  uploadMask: vi.fn(),
}));

vi.mock("@/lib/services/mask-service", () => ({
  validateMinSize: vi.fn(),
  applyFeathering: vi.fn(),
  scaleToOriginal: vi.fn(),
  toGrayscalePng: vi.fn(),
}));

vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: vi.fn().mockReturnValue([]),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import components AFTER mocks
// ---------------------------------------------------------------------------
import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGeneration: Generation = {
  id: "gen-test-1",
  prompt: "test prompt",
  imageUrl: "https://example.com/image.png",
  width: 1024,
  height: 768,
  userId: "user-1",
  projectId: "project-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  model: "flux-pro",
  status: "completed",
  parentId: null,
  mode: "generate",
  referenceImageUrl: null,
  maskUrl: null,
  promptStrength: null,
  numInferenceSteps: null,
  guidanceScale: null,
  seed: null,
  aspectRatio: null,
  outputFormat: null,
  safetyTolerance: null,
  rawParams: null,
  batchGroup: null,
} as Generation;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("canvas-detail-view Transform Wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-9: Transform-Wrapper-Div mit korrektem Style
  // GIVEN `canvas-detail-view.tsx` rendert ein Bild
  // WHEN die Komponente gemountet ist
  // THEN existiert ein Wrapper-Div um CanvasImage+MaskCanvas+OutpaintControls
  //      mit `style` containing `transform: translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
  //      `transformOrigin: "0 0"` und `willChange: "transform"`
  // -------------------------------------------------------------------------
  it('AC-9: should render transform wrapper div with translate/scale style, transformOrigin 0 0, and willChange transform', () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-test-1">
        <CanvasDetailView
          generation={mockGeneration}
          allGenerations={[mockGeneration]}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    const transformWrapper = screen.getByTestId("zoom-transform-wrapper");
    expect(transformWrapper).toBeInTheDocument();

    // Check style attributes
    const style = transformWrapper.style;

    // Initial state: zoomLevel=1, panX=0, panY=0
    // The transform should contain translate and scale
    expect(style.transform).toContain("translate(");
    expect(style.transform).toContain("scale(");
    expect(style.transformOrigin).toBe("0 0");
    expect(style.willChange).toBe("transform");

    // Verify the initial values (default state: zoomLevel=1, panX=0, panY=0)
    expect(style.transform).toContain("translate(0px, 0px)");
    expect(style.transform).toContain("scale(1)");
  });
});
