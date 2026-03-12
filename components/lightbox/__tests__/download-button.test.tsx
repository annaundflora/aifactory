// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { LightboxModal } from "@/components/lightbox/lightbox-modal";
import { type Generation } from "@/lib/db/queries";

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
    <svg data-testid="loader-icon" {...props} />
  ),
  Copy: (props: Record<string, unknown>) => (
    <svg data-testid="copy-icon" {...props} />
  ),
  Maximize2: () => null,
  Minimize2: () => null,
  ImagePlus: (props: Record<string, unknown>) => (
    <svg data-testid="image-plus-icon" {...props} />
  ),
}));

// Mock lib/models
vi.mock("@/lib/models", () => ({
  getModelById: (id: string) => {
    if (id === "black-forest-labs/flux-2-pro") {
      return {
        id: "black-forest-labs/flux-2-pro",
        displayName: "FLUX 2 Pro",
        pricePerImage: 0.055,
      };
    }
    return undefined;
  },
}));

// Mock downloadImage from lib/utils — keep generateDownloadFilename real
const mockDownloadImage = vi.fn();
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    downloadImage: (...args: unknown[]) => mockDownloadImage(...args),
  };
});

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Mock ProvenanceRow (Slice 15) — render nothing in download-button tests
vi.mock("@/components/lightbox/provenance-row", () => ({
  ProvenanceRow: () => null,
}));

// Mock references server actions (Slice 16 — addGalleryAsReference + getReferenceCount)
vi.mock("@/app/actions/references", () => ({
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-1" }),
  getReferenceCount: vi.fn().mockResolvedValue(0),
}));

// Mock workspace-state (LightboxModal uses useWorkspaceVariation internally;
// variation-specific behaviour is tested in variation-flow.test.tsx)
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-abc-123",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "A fox in oil painting style",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "black-forest-labs/flux-2-pro",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl:
      overrides.imageUrl ?? "https://r2.example.com/projects/abc/img.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-02T14:32:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
  };
}

const defaultOnClose = vi.fn();

beforeEach(() => {
  defaultOnClose.mockClear();
  mockDownloadImage.mockClear();
  mockToastError.mockClear();
  // Default: downloadImage resolves successfully
  mockDownloadImage.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Download PNG Button in Lightbox", () => {
  /**
   * AC-1: GIVEN eine geoeffnete Lightbox mit einer Generation die
   * `image_url: "https://r2.example.com/projects/abc/img.png"` und
   * `prompt: "A fox in oil painting style"` hat
   * WHEN der User auf den "Download PNG" Button klickt
   * THEN wird ein Browser-Download gestartet mit dem Bild von der `image_url`
   */
  it("AC-1: should call downloadImage with correct URL when Download PNG button is clicked", async () => {
    const user = userEvent.setup();
    const generation = makeGeneration({
      imageUrl: "https://r2.example.com/projects/abc/img.png",
      prompt: "A fox in oil painting style",
      createdAt: new Date("2026-03-02T14:32:00Z"),
    });

    render(
      <LightboxModal
        generation={generation}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    const downloadBtn = screen.getByTestId("download-btn");
    await user.click(downloadBtn);

    expect(mockDownloadImage).toHaveBeenCalledOnce();
    expect(mockDownloadImage).toHaveBeenCalledWith(
      "https://r2.example.com/projects/abc/img.png",
      expect.stringContaining("a-fox-in-oil-painting-style")
    );
    // Filename should end with date + .png
    const calledFilename = mockDownloadImage.mock.calls[0][1] as string;
    expect(calledFilename).toMatch(/_2026-03-02\.png$/);
  });

  /**
   * AC-4: GIVEN der Download-Button wurde geklickt
   * WHEN der fetch-Request fuer das Bild laeuft
   * THEN zeigt der Button einen Loading-State (z.B. Spinner) und ist waehrend
   * des Downloads disabled
   */
  it("AC-4: should show loading state and be disabled while download is in progress", async () => {
    const user = userEvent.setup();

    // Make downloadImage hang (never resolve) to observe loading state
    let resolveDownload: () => void;
    mockDownloadImage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = resolve;
        })
    );

    const generation = makeGeneration();

    render(
      <LightboxModal
        generation={generation}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    const downloadBtn = screen.getByTestId("download-btn");

    // Before click: button should NOT be disabled
    expect(downloadBtn).not.toBeDisabled();
    // Should show Download icon, not loader
    expect(screen.getByTestId("download-icon")).toBeInTheDocument();

    // Click the button (do not await, to check intermediate state)
    await user.click(downloadBtn);

    // During download: button should be disabled and show spinner
    await waitFor(() => {
      expect(screen.getByTestId("download-btn")).toBeDisabled();
    });
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    // Cleanup: resolve the pending download
    resolveDownload!();
  });

  /**
   * AC-5: GIVEN der Download-Button wurde geklickt
   * WHEN der fetch-Request erfolgreich abgeschlossen ist
   * THEN wird der Loading-State entfernt und der Button ist wieder klickbar
   */
  it("AC-5: should return to default state after successful download", async () => {
    const user = userEvent.setup();
    mockDownloadImage.mockResolvedValue(undefined);

    const generation = makeGeneration();

    render(
      <LightboxModal
        generation={generation}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    const downloadBtn = screen.getByTestId("download-btn");
    await user.click(downloadBtn);

    // After successful download: button should return to default state
    await waitFor(() => {
      expect(screen.getByTestId("download-btn")).not.toBeDisabled();
    });

    // Download icon should be back (not loader)
    expect(screen.getByTestId("download-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN der fetch-Request fuer das Bild schlaegt fehl (z.B. Netzwerkfehler)
   * WHEN der Fehler auftritt
   * THEN wird eine Toast-Notification mit "Download fehlgeschlagen" angezeigt und
   * der Button kehrt in den Default-State zurueck
   */
  it("AC-6: should show error toast when download fails and return to default state", async () => {
    const user = userEvent.setup();
    mockDownloadImage.mockRejectedValue(new Error("Network error"));

    const generation = makeGeneration();

    render(
      <LightboxModal
        generation={generation}
        isOpen={true}
        onClose={defaultOnClose}
      />
    );

    const downloadBtn = screen.getByTestId("download-btn");
    await user.click(downloadBtn);

    // Toast should be called with error message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Download fehlgeschlagen");
    });

    // Button should return to default state
    await waitFor(() => {
      expect(screen.getByTestId("download-btn")).not.toBeDisabled();
    });
    expect(screen.getByTestId("download-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
  });
});
