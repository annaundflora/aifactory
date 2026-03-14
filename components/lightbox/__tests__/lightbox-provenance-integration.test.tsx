/**
 * Slice-18 removed lightbox-modal.tsx. This test file verifies the deletion
 * and serves as a record that provenance integration was tested when the
 * lightbox existed. The provenance functionality is now part of the
 * CanvasDetailView details panel.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

describe("Slice-18 cleanup: lightbox-modal.tsx deletion", () => {
  /**
   * Slice-18 removed lightbox-modal.tsx. This test verifies the deletion.
   * Provenance integration is now part of the CanvasDetailView details panel.
   */
  it("should confirm lightbox-modal.tsx was deleted as part of slice-18", () => {
    const filePath = resolve(
      __dirname,
      "../lightbox-modal.tsx"
    );
    expect(existsSync(filePath)).toBe(false);
  });
});

/**
 * Legacy tests (AC-3, AC-5, AC-6) that tested LightboxModal provenance integration
 * are removed in slice-18 because lightbox-modal.tsx was deleted.
 * The provenance functionality is now covered by canvas-detail-view tests.
 */
