/**
 * Slice-18 removed lightbox-modal.tsx (the lightbox flow was replaced by the
 * CanvasDetailView). This test file verifies that the deleted file no longer
 * exists so we can be sure the cleanup was completed.
 *
 * The original download-button tests tested LightboxModal functionality which
 * is now covered by the canvas-toolbar and canvas-detail-view tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

describe("Slice-18 cleanup: lightbox-modal.tsx deletion", () => {
  /**
   * Slice-18 removed lightbox-modal.tsx. This test verifies the deletion
   * is complete. The download functionality was moved to the CanvasDetailView
   * (canvas-toolbar download button).
   */
  it("should confirm lightbox-modal.tsx was deleted as part of slice-18", () => {
    const filePath = resolve(
      __dirname,
      "../lightbox-modal.tsx"
    );
    expect(existsSync(filePath)).toBe(false);
  });
});
