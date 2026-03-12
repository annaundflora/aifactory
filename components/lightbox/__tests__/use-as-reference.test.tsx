// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Hoisted mock variables (vi.mock factories are hoisted above imports,
// so any variable they reference must also be hoisted via vi.hoisted)
// ---------------------------------------------------------------------------
const {
  mockSetVariation,
  mockAddGalleryAsReference,
  mockGetReferenceCount,
} = vi.hoisted(() => {
  return {
    mockSetVariation: vi.fn(),
    mockAddGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-new" }),
    mockGetReferenceCount: vi.fn().mockResolvedValue(0),
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
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
  Download: (props: Record<string, unknown>) => (
    <svg data-testid="download-icon" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <svg data-testid="loader2-icon" {...props} />
  ),
  Copy: (props: Record<string, unknown>) => (
    <svg data-testid="copy-icon" {...props} />
  ),
  Maximize2: (props: Record<string, unknown>) => (
    <svg data-testid="maximize2-icon" {...props} />
  ),
  Minimize2: (props: Record<string, unknown>) => (
    <svg data-testid="minimize2-icon" {...props} />
  ),
  ArrowRightLeft: (props: Record<string, unknown>) => (
    <svg data-testid="arrow-right-left-icon" {...props} />
  ),
  ZoomIn: (props: Record<string, unknown>) => (
    <svg data-testid="zoom-in-icon" {...props} />
  ),
  Trash2: (props: Record<string, unknown>) => (
    <svg data-testid="trash2-icon" {...props} />
  ),
  ImagePlus: (props: Record<string, unknown>) => (
    <svg data-testid="image-plus-icon" {...props} />
  ),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// Mock lib/utils download helpers
vi.mock("@/lib/utils", () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("test-image.png"),
}));

// Mock lib/models
vi.mock("@/lib/models", () => ({
  getModelById: (id: string) => {
    if (id === "black-forest-labs/flux-2-pro") {
      return { id: "black-forest-labs/flux-2-pro", displayName: "FLUX 2 Pro", pricePerImage: 0.055 };
    }
    return undefined;
  },
}));

// Mock workspace-state — setVariation is a trackable spy
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

// Mock server actions (upscaleImage + deleteGeneration)
vi.mock("@/app/actions/generations", () => ({
  upscaleImage: vi.fn().mockResolvedValue({ id: "gen-upscaled" }),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock references server actions (Slice 16 — addGalleryAsReference + getReferenceCount)
vi.mock("@/app/actions/references", () => ({
  addGalleryAsReference: (...args: unknown[]) => mockAddGalleryAsReference(...args),
  getReferenceCount: (...args: unknown[]) => mockGetReferenceCount(...args),
}));

// Mock Popover — renders children directly
vi.mock("@/components/ui/popover", () => {
  let onOpenChangeFn: ((open: boolean) => void) | null = null;
  let isOpen = false;

  return {
    Popover: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
      if (open !== undefined) isOpen = open;
      if (onOpenChange) onOpenChangeFn = onOpenChange;
      return <div data-testid="popover-root" data-open={isOpen}>{children}</div>;
    },
    PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
      if (asChild) {
        return <div data-testid="popover-trigger" onClick={() => onOpenChangeFn?.(!isOpen)}>{children}</div>;
      }
      return <div data-testid="popover-trigger" onClick={() => onOpenChangeFn?.(!isOpen)}>{children}</div>;
    },
    PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => {
      if (!isOpen) return null;
      return <div data-testid="popover-content">{children}</div>;
    },
  };
});

// Mock ProvenanceRow (Slice 15) — render nothing in these tests
vi.mock("@/components/lightbox/provenance-row", () => ({
  ProvenanceRow: () => null,
}));

// Mock ConfirmDialog
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm, onCancel }: { open: boolean; title?: string; description?: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) => {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <button data-testid="confirm-dialog-confirm" onClick={onConfirm}>Confirm</button>
        <button data-testid="confirm-dialog-cancel" onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------
import { LightboxModal } from "@/components/lightbox/lightbox-modal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  const defaults: Generation = {
    id: "gen-abc",
    projectId: "project-1",
    prompt: "a beautiful sunset over the ocean",
    negativePrompt: null,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: { steps: 30, guidance: 7.5 },
    status: "completed",
    imageUrl: "https://r2.example/img.png",
    replicatePredictionId: null,
    errorMessage: null,
    width: 1024,
    height: 768,
    seed: null,
    promptMotiv: "",
    promptStyle: "",
    isFavorite: false,
    createdAt: new Date("2026-03-01T14:30:00Z"),
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
  };
  // Spread overrides AFTER defaults so explicit null values are preserved
  // (unlike ??, which treats null the same as undefined)
  return { ...defaults, ...overrides };
}

const defaultOnClose = vi.fn();

beforeEach(() => {
  defaultOnClose.mockClear();
  mockSetVariation.mockClear();
  mockAddGalleryAsReference.mockClear();
  mockGetReferenceCount.mockClear();
  // Default: 0 references (< 5 slots)
  mockGetReferenceCount.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// Tests — Slice 16: LightboxModal UseAsReference Button
// ---------------------------------------------------------------------------

describe("LightboxModal - UseAsReference Button", () => {
  /**
   * AC-1: GIVEN die Lightbox ist offen mit einem Bild (nicht Upscale-Mode)
   *       und weniger als 5 Referenz-Slots belegt
   *       WHEN der User die Aktions-Buttons betrachtet
   *       THEN ist ein Button "Als Referenz" sichtbar, positioniert zwischen
   *       "Variation" und "img2img", mit data-testid="use-as-reference-btn"
   */
  it("AC-1: should render use-as-reference button between variation and img2img buttons", async () => {
    const generation = makeGeneration({ generationMode: "txt2img" });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Wait for getReferenceCount to resolve (useEffect)
    await waitFor(() => {
      expect(mockGetReferenceCount).toHaveBeenCalled();
    });

    // Button exists with correct test id
    const refBtn = screen.getByTestId("use-as-reference-btn");
    expect(refBtn).toBeInTheDocument();
    expect(refBtn).toHaveTextContent("Als Referenz");

    // Verify positioning: Variation -> Als Referenz -> img2img
    // All three buttons exist
    const variationBtn = screen.getByTestId("variation-btn");
    const img2imgBtn = screen.getByTestId("img2img-btn");

    // All buttons share the same parent container (flex column)
    const actionsContainer = refBtn.parentElement!;
    expect(actionsContainer).toBe(variationBtn.parentElement);
    expect(actionsContainer).toBe(img2imgBtn.parentElement);

    // Check DOM order: variation, then use-as-reference, then img2img
    const buttons = Array.from(actionsContainer.children);
    const variationIdx = buttons.indexOf(variationBtn);
    const refIdx = buttons.indexOf(refBtn);
    const img2imgIdx = buttons.indexOf(img2imgBtn);

    expect(variationIdx).toBeLessThan(refIdx);
    expect(refIdx).toBeLessThan(img2imgIdx);
  });

  /**
   * AC-2: GIVEN die Lightbox ist offen mit Generation
   *       { id: "gen-abc", imageUrl: "https://r2.example/img.png" }
   *       WHEN der User auf "Als Referenz" klickt
   *       THEN wird setVariation mit
   *       addReference: { imageUrl: "https://r2.example/img.png", generationId: "gen-abc" }
   *       aufgerufen
   */
  it("AC-2: should call setVariation with addReference containing imageUrl and generationId on click", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-abc",
      imageUrl: "https://r2.example/img.png",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    await waitFor(() => {
      expect(mockGetReferenceCount).toHaveBeenCalled();
    });

    const refBtn = screen.getByTestId("use-as-reference-btn");
    await user.click(refBtn);

    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArg = mockSetVariation.mock.calls[0][0];
    expect(callArg.addReference).toEqual({
      imageUrl: "https://r2.example/img.png",
      generationId: "gen-abc",
    });
  });

  /**
   * AC-3: GIVEN der User klickt auf "Als Referenz"
   *       WHEN die Aktion ausgefuehrt wird
   *       THEN wird die Lightbox geschlossen (onClose wird aufgerufen)
   */
  it("AC-3: should call onClose after clicking use-as-reference button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(mockGetReferenceCount).toHaveBeenCalled();
    });

    const refBtn = screen.getByTestId("use-as-reference-btn");
    await user.click(refBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-4: GIVEN die Lightbox ist offen und alle 5 Referenz-Slots sind belegt
   *       WHEN der User den "Als Referenz" Button betrachtet
   *       THEN ist der Button disabled (disabled Attribut gesetzt) und zeigt
   *       einen Tooltip mit Text "Alle 5 Slots belegt"
   */
  it("AC-4: should be disabled with tooltip when all 5 reference slots are full", async () => {
    // Return 5 references (all slots full)
    mockGetReferenceCount.mockResolvedValue(5);

    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // Wait for getReferenceCount to resolve with 5
    await waitFor(() => {
      expect(mockGetReferenceCount).toHaveBeenCalled();
    });

    const refBtn = screen.getByTestId("use-as-reference-btn");

    // Button should be disabled
    await waitFor(() => {
      expect(refBtn).toBeDisabled();
    });

    // Tooltip text via title attribute
    expect(refBtn).toHaveAttribute("title", "Alle 5 Slots belegt");
  });

  /**
   * AC-4 (supplemental): Verify that clicking a disabled button does NOT call
   * setVariation or onClose.
   */
  it("AC-4 (supplement): should not call setVariation or onClose when button is disabled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockGetReferenceCount.mockResolvedValue(5);

    const generation = makeGeneration();

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={onClose} />
    );

    await waitFor(() => {
      const refBtn = screen.getByTestId("use-as-reference-btn");
      expect(refBtn).toBeDisabled();
    });

    const refBtn = screen.getByTestId("use-as-reference-btn");
    // Attempt to click — the handler guards with isAllSlotsFull check
    await user.click(refBtn);

    expect(mockSetVariation).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * AC-5: GIVEN die Lightbox zeigt eine Generation im Upscale-Mode
   *       (generationMode: "upscale")
   *       WHEN der User die Aktions-Buttons betrachtet
   *       THEN ist der "Als Referenz" Button trotzdem sichtbar
   *       (Upscale-Bilder koennen als Referenz dienen)
   */
  it("AC-5: should render use-as-reference button even for upscale mode generations", async () => {
    const generation = makeGeneration({ generationMode: "upscale" });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    await waitFor(() => {
      expect(mockGetReferenceCount).toHaveBeenCalled();
    });

    // The "Als Referenz" button is visible even in upscale mode
    const refBtn = screen.getByTestId("use-as-reference-btn");
    expect(refBtn).toBeInTheDocument();
    expect(refBtn).toHaveTextContent("Als Referenz");

    // Verify that Variation button is NOT visible in upscale mode (existing behavior)
    expect(screen.queryByTestId("variation-btn")).not.toBeInTheDocument();

    // But "Als Referenz" IS visible despite upscale mode
    expect(refBtn).toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN die Lightbox ist offen mit einem Bild ohne imageUrl
   *       (Bild noch pending)
   *       WHEN der User die Aktions-Buttons betrachtet
   *       THEN ist der gesamte Actions-Block inklusive "Als Referenz"
   *       nicht gerendert (bestehendes Verhalten)
   */
  it("AC-6: should not render actions block when generation has no imageUrl", () => {
    const generation = makeGeneration({ imageUrl: null });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    // No action buttons should be in the DOM at all
    expect(screen.queryByTestId("use-as-reference-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("variation-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("img2img-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("download-btn")).not.toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN der User klickt auf "Als Referenz"
   *       WHEN addGalleryAsReference Server Action aufgerufen wird
   *       THEN wird die Action mit
   *       { projectId: generation.projectId, generationId: generation.id,
   *         imageUrl: generation.imageUrl }
   *       aufgerufen
   */
  it("AC-7: should call addGalleryAsReference with projectId, generationId and imageUrl", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      id: "gen-abc",
      projectId: "project-1",
      imageUrl: "https://r2.example/img.png",
    });

    render(
      <LightboxModal generation={generation} isOpen={true} onClose={defaultOnClose} />
    );

    await waitFor(() => {
      expect(mockGetReferenceCount).toHaveBeenCalled();
    });

    const refBtn = screen.getByTestId("use-as-reference-btn");
    await user.click(refBtn);

    expect(mockAddGalleryAsReference).toHaveBeenCalledTimes(1);
    expect(mockAddGalleryAsReference).toHaveBeenCalledWith({
      projectId: "project-1",
      generationId: "gen-abc",
      imageUrl: "https://r2.example/img.png",
    });
  });
});
