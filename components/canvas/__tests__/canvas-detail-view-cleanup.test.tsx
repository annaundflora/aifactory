// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the source file for canvas-detail-view.tsx and returns its content.
 */
function readCanvasDetailViewSource(): string {
  const filePath = path.resolve(
    __dirname,
    "..",
    "canvas-detail-view.tsx"
  );
  return fs.readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Tests: CanvasDetailView cleanup (static source analysis)
//
// These tests verify the *absence* of old UI component references in the
// canvas-detail-view.tsx source file. This is the appropriate approach for
// a cleanup slice -- we validate that imports, render calls, and prop
// passthrough have been removed.
// ---------------------------------------------------------------------------

describe("CanvasDetailView - Old UI Component Removal", () => {
  /**
   * AC-1: GIVEN `canvas-detail-view.tsx`
   *       WHEN die Import-Statements inspiziert werden
   *       THEN existiert KEIN Import von `CanvasModelSelector` aus `@/components/canvas/canvas-model-selector`
   */
  it("AC-1: should not import CanvasModelSelector", () => {
    const source = readCanvasDetailViewSource();

    // Check that there is no import statement referencing CanvasModelSelector
    const importRegex = /import\s+.*CanvasModelSelector.*from\s+['"]@\/components\/canvas\/canvas-model-selector['"]/;
    expect(source).not.toMatch(importRegex);

    // Also ensure no dynamic import or require of the module
    expect(source).not.toContain("canvas-model-selector");
  });

  /**
   * AC-2: GIVEN `canvas-detail-view.tsx`
   *       WHEN der Render-Output inspiziert wird
   *       THEN wird KEIN `<CanvasModelSelector>` gerendert und die Variable
   *            `effectiveModelSelectorSlot` enthaelt keinen Fallback auf `CanvasModelSelector`
   */
  it("AC-2: should not render CanvasModelSelector in the component tree", () => {
    const source = readCanvasDetailViewSource();

    // No JSX usage of <CanvasModelSelector anywhere in the file
    expect(source).not.toMatch(/<CanvasModelSelector[\s/>]/);

    // No effectiveModelSelectorSlot variable (was the old fallback mechanism)
    expect(source).not.toContain("effectiveModelSelectorSlot");

    // No reference to CanvasModelSelector in any form (import, usage, comment referencing it as active code)
    // Note: we already confirmed no import in AC-1, here we double-check no render usage
    const activeReferences = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .filter((line) => line.includes("CanvasModelSelector"));
    expect(
      activeReferences,
      `Found active CanvasModelSelector references:\n${activeReferences.join("\n")}`
    ).toEqual([]);
  });

  /**
   * AC-3: GIVEN `canvas-detail-view.tsx`
   *       WHEN `<CanvasHeader>` gerendert wird
   *       THEN wird `modelSelectorSlot` entweder nicht uebergeben oder mit
   *            einem explizit leeren Wert (`undefined` / `null`) uebergeben
   */
  it("AC-3: should pass no modelSelectorSlot to CanvasHeader", () => {
    const source = readCanvasDetailViewSource();

    // Find all <CanvasHeader usages in the source (greedy enough to capture props)
    // Match from <CanvasHeader up to the closing > or />
    const canvasHeaderUsages = source.match(/<CanvasHeader[\s\S]*?(?:\/>|>)/g) ?? [];
    expect(canvasHeaderUsages.length).toBeGreaterThan(0);

    // None of them should pass a modelSelectorSlot prop with a component value
    for (const usage of canvasHeaderUsages) {
      const hasProp = /modelSelectorSlot\s*=\s*\{/.test(usage);
      if (hasProp) {
        // If present, it must be explicitly undefined or null
        expect(usage).toMatch(
          /modelSelectorSlot\s*=\s*\{\s*(undefined|null)\s*\}/
        );
      }
      // If no modelSelectorSlot prop at all, that's valid (AC-3 is satisfied)
    }

    // Verify no modelSelectorSlot is set to effectiveModelSelectorSlot or CanvasModelSelector
    expect(source).not.toMatch(/modelSelectorSlot\s*=\s*\{\s*effectiveModelSelectorSlot\s*\}/);
    expect(source).not.toMatch(/modelSelectorSlot\s*=\s*\{\s*<CanvasModelSelector/);
  });
});
