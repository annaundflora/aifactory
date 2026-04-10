// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";

/**
 * Tests for slice-02-zoom-hook-transform: CanvasImage Transform Compatibility
 *
 * Tests AC-10 and AC-11 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - No external mocks needed for these tests -- CanvasImage is a pure presentational component.
 * - Only the Generation type needs to be constructed.
 */

import { CanvasImage } from "@/components/canvas/canvas-image";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGeneration: Generation = {
  id: "gen-img-1",
  prompt: "test image prompt",
  imageUrl: "https://example.com/test-image.png",
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

describe("CanvasImage Transform Compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-10: CanvasImage ohne Sizing-Klassen
  // GIVEN `canvas-image.tsx` im Transform-Wrapper
  // WHEN das Bild geladen ist
  // THEN das `<img>`-Element hat KEINE `max-h-full max-w-full object-contain`
  //      Klassen mehr, sondern nutzt natuerliche Dimensionen
  // -------------------------------------------------------------------------
  it("AC-10: should render CanvasImage img without max-h-full max-w-full object-contain classes", () => {
    render(<CanvasImage generation={mockGeneration} />);

    const img = screen.getByTestId("canvas-image");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");

    // Verify the old sizing classes are NOT present
    expect(img).not.toHaveClass("max-h-full");
    expect(img).not.toHaveClass("max-w-full");
    expect(img).not.toHaveClass("object-contain");

    // Verify the image has the 'block' class for natural dimension display
    expect(img).toHaveClass("block");
  });

  // -------------------------------------------------------------------------
  // AC-11: CanvasImage forwardRef
  // GIVEN `canvas-image.tsx`
  // WHEN von einem Parent eine `ref` uebergeben wird
  // THEN wird diese ref an das `<img>`-Element weitergeleitet (forwardRef)
  // -------------------------------------------------------------------------
  it("AC-11: should forward ref to the img element in CanvasImage", () => {
    const imgRef = createRef<HTMLImageElement>();

    render(<CanvasImage ref={imgRef} generation={mockGeneration} />);

    // The ref should be attached to the actual img element
    expect(imgRef.current).not.toBeNull();
    expect(imgRef.current).toBeInstanceOf(HTMLImageElement);
    expect(imgRef.current!.tagName).toBe("IMG");

    // Verify the ref points to the correct element (the one with data-testid)
    const imgByTestId = screen.getByTestId("canvas-image");
    expect(imgRef.current).toBe(imgByTestId);
  });
});
