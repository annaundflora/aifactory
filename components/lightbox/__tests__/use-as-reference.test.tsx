/**
 * Slice-18 removed lightbox-modal.tsx. This test file verifies the deletion.
 * The "Use As Reference" functionality (previously in LightboxModal) is now
 * part of the CanvasDetailView details panel, tested in canvas-detail-view tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

describe("Slice-18 cleanup: lightbox-modal.tsx deletion", () => {
  it("should confirm lightbox-modal.tsx was deleted as part of slice-18", () => {
    const filePath = resolve(__dirname, "../lightbox-modal.tsx");
    expect(existsSync(filePath)).toBe(false);
  });
});

/**
 * Legacy tests (AC-1 through AC-7) that tested LightboxModal UseAsReference Button
 * are removed in slice-18 because lightbox-modal.tsx was deleted.
 * The use-as-reference functionality is now part of the CanvasDetailView.
 */
