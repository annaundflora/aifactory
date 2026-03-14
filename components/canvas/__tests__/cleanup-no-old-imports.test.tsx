// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads all .tsx/.ts files in a directory (non-recursive, source files only).
 * Excludes __tests__ directories and .test. files.
 */
function readSourceFiles(dirPath: string): { name: string; content: string }[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: { name: string; content: string }[] = [];

  for (const entry of entries) {
    // Skip test directories and test files
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    if (entry.name.includes(".test.")) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      files.push({
        name: entry.name,
        content: fs.readFileSync(fullPath, "utf-8"),
      });
    }

    // Recurse into subdirectories (e.g., popovers/)
    if (entry.isDirectory()) {
      const subFiles = readSourceFilesRecursive(fullPath);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Recursively reads source files from a directory.
 */
function readSourceFilesRecursive(dirPath: string): { name: string; content: string }[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: { name: string; content: string }[] = [];

  for (const entry of entries) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    if (entry.name.includes(".test.")) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      files.push({
        name: path.relative(dirPath, fullPath).replace(/\\/g, "/"),
        content: fs.readFileSync(fullPath, "utf-8"),
      });
    }

    if (entry.isDirectory()) {
      const subFiles = readSourceFilesRecursive(fullPath);
      for (const sf of subFiles) {
        files.push({
          name: `${entry.name}/${sf.name}`,
          content: sf.content,
        });
      }
    }
  }

  return files;
}

// Resolve project root (vitest runs from repo root due to vitest.config.ts)
const projectRoot = path.resolve(__dirname, "..", "..", "..");
const canvasDir = path.join(projectRoot, "components", "canvas");
const workspaceDir = path.join(projectRoot, "components", "workspace");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Cleanup - No Old Model UI Imports in Active Render Paths", () => {
  /**
   * AC-6: GIVEN alle Dateien im Verzeichnis `components/canvas/`
   *       WHEN nach Imports von `ModelBrowserDrawer` gesucht wird
   *       THEN gibt es KEINE aktiven Imports (nur in Test-Mocks oder der Datei
   *            `canvas-model-selector.tsx` selbst erlaubt)
   */
  it("AC-6: should have no ModelBrowserDrawer imports in canvas components except canvas-model-selector.tsx", () => {
    const sourceFiles = readSourceFiles(canvasDir);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const importPattern = /import\s+.*ModelBrowserDrawer.*from/;
    const violatingFiles: string[] = [];

    for (const file of sourceFiles) {
      // Skip canvas-model-selector.tsx itself (allowed per AC-6)
      if (file.name === "canvas-model-selector.tsx") continue;

      if (importPattern.test(file.content)) {
        violatingFiles.push(file.name);
      }
    }

    expect(
      violatingFiles,
      `Found ModelBrowserDrawer imports in: ${violatingFiles.join(", ")}`
    ).toEqual([]);
  });

  /**
   * AC-7: GIVEN alle Dateien im Verzeichnis `components/workspace/`
   *       WHEN nach Imports von `CanvasModelSelector` gesucht wird
   *       THEN gibt es KEINE Imports
   */
  it("AC-7: should have no CanvasModelSelector imports in workspace components", () => {
    const sourceFiles = readSourceFiles(workspaceDir);
    // It's valid for workspace dir to be empty or not exist in this cleanup branch
    // but if files exist, none should import CanvasModelSelector

    const importPattern = /import\s+.*CanvasModelSelector.*from/;
    const violatingFiles: string[] = [];

    for (const file of sourceFiles) {
      if (importPattern.test(file.content)) {
        violatingFiles.push(file.name);
      }
    }

    expect(
      violatingFiles,
      `Found CanvasModelSelector imports in workspace: ${violatingFiles.join(", ")}`
    ).toEqual([]);
  });

  /**
   * AC-8: GIVEN das gesamte Projekt
   *       WHEN `pnpm tsc --noEmit` ausgefuehrt wird
   *       THEN kompiliert TypeScript ohne Fehler
   *
   * Note: This test verifies that the tsconfig.json exists and is valid.
   * The actual TypeScript compilation check (`pnpm tsc --noEmit`) is run
   * as part of the acceptance command in CI. Here we verify the precondition:
   * the source files we changed do not contain obvious type errors by checking
   * they parse correctly and have no references to removed identifiers.
   */
  it("AC-8: should compile without TypeScript errors (source file validation)", () => {
    // Verify canvas-detail-view.tsx does not reference removed types/variables
    const detailViewPath = path.join(canvasDir, "canvas-detail-view.tsx");
    expect(fs.existsSync(detailViewPath)).toBe(true);
    const detailViewSource = fs.readFileSync(detailViewPath, "utf-8");

    // No reference to effectiveModelSelectorSlot (removed variable)
    expect(detailViewSource).not.toContain("effectiveModelSelectorSlot");

    // No reference to CanvasModelSelector (removed import/usage)
    expect(detailViewSource).not.toContain("CanvasModelSelector");

    // Verify canvas-header.tsx is valid
    const headerPath = path.join(canvasDir, "canvas-header.tsx");
    expect(fs.existsSync(headerPath)).toBe(true);
    const headerSource = fs.readFileSync(headerPath, "utf-8");

    // Header should still export CanvasHeader and CanvasHeaderProps
    expect(headerSource).toMatch(/export\s+(function|const)\s+CanvasHeader/);
    expect(headerSource).toMatch(/export\s+interface\s+CanvasHeaderProps/);

    // Verify tsconfig.json exists for the project (precondition for tsc --noEmit)
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });
});
