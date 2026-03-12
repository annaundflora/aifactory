// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import type { Generation } from "@/lib/db/queries";
import type { ProvenanceItem } from "@/app/actions/references";

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const {
  mockGetProvenanceData,
  mockSetVariation,
  mockGetReferenceCount,
} = vi.hoisted(() => {
  return {
    mockGetProvenanceData: vi.fn<(id: string) => Promise<ProvenanceItem[]>>(),
    mockSetVariation: vi.fn(),
    mockGetReferenceCount: vi.fn<(projectId: string) => Promise<number>>().mockResolvedValue(0),
  };
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/image as plain img element
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = Object.fromEntries(
      Object.entries(props).filter(([k]) => k !== "priority" && k !== "fill")
    );
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  Download: (props: Record<string, unknown>) => <svg data-testid="download-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader2-icon" {...props} />,
  Copy: (props: Record<string, unknown>) => <svg data-testid="copy-icon" {...props} />,
  Maximize2: (props: Record<string, unknown>) => <svg data-testid="maximize2-icon" {...props} />,
  Minimize2: (props: Record<string, unknown>) => <svg data-testid="minimize2-icon" {...props} />,
  ArrowRightLeft: (props: Record<string, unknown>) => <svg data-testid="arrow-right-left-icon" {...props} />,
  ZoomIn: (props: Record<string, unknown>) => <svg data-testid="zoom-in-icon" {...props} />,
  Trash2: (props: Record<string, unknown>) => <svg data-testid="trash2-icon" {...props} />,
  ImagePlus: (props: Record<string, unknown>) => <svg data-testid="image-plus-icon" {...props} />,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

// Mock lib/utils download helpers
vi.mock("@/lib/utils", () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("test-image.png"),
}));

// Mock lib/utils/model-display-name
vi.mock("@/lib/utils/model-display-name", () => ({
  modelIdToDisplayName: (id: string) => id || "Unknown Model",
}));

// Mock workspace-state
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

// Mock server actions (generations)
vi.mock("@/app/actions/generations", () => ({
  upscaleImage: vi.fn().mockResolvedValue({ id: "gen-upscaled" }),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock references server actions — getProvenanceData is the key mock for Slice 15
vi.mock("@/app/actions/references", () => ({
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-1" }),
  getReferenceCount: (...args: unknown[]) => mockGetReferenceCount(...(args as [string])),
  getProvenanceData: (...args: unknown[]) => mockGetProvenanceData(...(args as [string])),
}));

// Mock Popover
vi.mock("@/components/ui/popover", () => {
  return {
    Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

// Mock ConfirmDialog
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}));

// ---------------------------------------------------------------------------
// Import components AFTER mocks — NOTE: We do NOT mock ProvenanceRow here,
// so it renders fully with its real implementation (integration test).
// ---------------------------------------------------------------------------
import { LightboxModal } from "@/components/lightbox/lightbox-modal";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const THREE_REFERENCES: ProvenanceItem[] = [
  {
    id: "ref-1",
    slotPosition: 1,
    role: "style",
    strength: "strong",
    imageUrl: "https://example.com/ref1.png",
    referenceImageId: "img-1",
  },
  {
    id: "ref-2",
    slotPosition: 3,
    role: "content",
    strength: "moderate",
    imageUrl: "https://example.com/ref3.png",
    referenceImageId: "img-3",
  },
  {
    id: "ref-3",
    slotPosition: 5,
    role: "structure",
    strength: "subtle",
    imageUrl: "https://example.com/ref5.png",
    referenceImageId: "img-5",
  },
];

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-A",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a beautiful sunset",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "black-forest-labs/flux-2-pro",
    modelParams: overrides.modelParams ?? { steps: 30 },
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/sunset.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 1024,
    height: overrides.height ?? 768,
    seed: overrides.seed ?? null,
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-03-01T14:30:00Z"),
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
  };
}

const defaultOnClose = vi.fn();

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetProvenanceData.mockReset();
  mockSetVariation.mockReset();
  mockGetReferenceCount.mockReset().mockResolvedValue(0);
  defaultOnClose.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LightboxModal - Provenance Integration", () => {
  /**
   * AC-3: GIVEN eine Generation OHNE generation_references-Records (z.B. eine txt2img-Generation)
   * WHEN die Lightbox fuer diese Generation geoeffnet wird
   * THEN ist die ProvenanceRow-Section komplett unsichtbar
   * (kein Header, kein Platzhalter, data-testid="provenance-row" nicht im DOM)
   */
  it("AC-3: should not render provenance-row when generation has no references", async () => {
    mockGetProvenanceData.mockResolvedValue([]);

    render(
      <LightboxModal
        generation={makeGeneration({ id: "gen-no-refs" })}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    // Wait for the async data loading to complete
    await waitFor(() => {
      expect(mockGetProvenanceData).toHaveBeenCalledWith("gen-no-refs");
    });

    // ProvenanceRow data-testid should NOT be in the DOM
    expect(screen.queryByTestId("provenance-row")).not.toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN die Lightbox ist im Fullscreen-Modus (isFullscreen = true)
   * WHEN das Detail-Panel hidden ist
   * THEN wird die ProvenanceRow ebenfalls nicht gerendert
   * (sie lebt innerhalb des Detail-Panels)
   */
  it("AC-5: should not render provenance-row when lightbox is in fullscreen mode", async () => {
    mockGetProvenanceData.mockResolvedValue(THREE_REFERENCES);

    render(
      <LightboxModal
        generation={makeGeneration()}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    // Initially the provenance row should appear (not fullscreen)
    await waitFor(() => {
      expect(screen.getByTestId("provenance-row")).toBeInTheDocument();
    });

    // Click the fullscreen toggle button
    const fullscreenToggle = screen.getByTestId("fullscreen-toggle");
    fireEvent.click(fullscreenToggle);

    // After entering fullscreen, the detail panel (and therefore ProvenanceRow) should be hidden
    await waitFor(() => {
      expect(screen.queryByTestId("lightbox-details")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("provenance-row")).not.toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN getGenerationReferences("gen-A") liefert Records zurueck
   * WHEN die ProvenanceRow die Referenz-Bilder laedt
   * THEN wird fuer jeden generation_references-Record das zugehoerige reference_images-Record
   * ueber referenceImageId aufgeloest um die imageUrl fuer das Thumbnail zu erhalten
   */
  it("AC-6: should call getProvenanceData with the generation id to resolve references", async () => {
    mockGetProvenanceData.mockResolvedValue(THREE_REFERENCES);

    render(
      <LightboxModal
        generation={makeGeneration({ id: "gen-A" })}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    // Verify getProvenanceData was called with the correct generation id
    await waitFor(() => {
      expect(mockGetProvenanceData).toHaveBeenCalledWith("gen-A");
    });

    // Verify the resolved imageUrls are rendered as thumbnail images
    await waitFor(() => {
      expect(screen.getByTestId("provenance-row")).toBeInTheDocument();
    });

    const provenanceRow = screen.getByTestId("provenance-row");
    const thumbnailImages = provenanceRow.querySelectorAll("img");

    // 3 reference images resolved via referenceImageId lookup
    expect(thumbnailImages).toHaveLength(3);
    expect(thumbnailImages[0]).toHaveAttribute("src", "https://example.com/ref1.png");
    expect(thumbnailImages[1]).toHaveAttribute("src", "https://example.com/ref3.png");
    expect(thumbnailImages[2]).toHaveAttribute("src", "https://example.com/ref5.png");
  });
});
