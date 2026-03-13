import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Acceptance tests for slice-18-lightbox-removal
 *
 * These tests verify that:
 * - Lightbox component files have been deleted (AC-4, AC-5)
 * - provenance-row.tsx is preserved (AC-6)
 * - Lightbox test files have been deleted (AC-8)
 * - No unresolved imports remain after lightbox removal (AC-9)
 *
 * Each test maps 1:1 to an Acceptance Criterion from the slice spec.
 */

const ROOT = resolve(__dirname, "../..");

describe("Slice 18: Lightbox Removal Acceptance", () => {
  // ---------------------------------------------------------------------------
  // AC-4: lightbox-modal.tsx geloescht
  // ---------------------------------------------------------------------------
  it("AC-4: GIVEN die Datei components/lightbox/lightbox-modal.tsx existiert WHEN Slice 18 implementiert ist THEN ist die Datei geloescht (nicht mehr im Dateisystem vorhanden)", () => {
    const filePath = resolve(ROOT, "components/lightbox/lightbox-modal.tsx");
    expect(existsSync(filePath)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-5: lightbox-navigation.tsx geloescht
  // ---------------------------------------------------------------------------
  it("AC-5: GIVEN die Datei components/lightbox/lightbox-navigation.tsx existiert WHEN Slice 18 implementiert ist THEN ist die Datei geloescht", () => {
    const filePath = resolve(
      ROOT,
      "components/lightbox/lightbox-navigation.tsx"
    );
    expect(existsSync(filePath)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-6: provenance-row.tsx bleibt bestehen
  // ---------------------------------------------------------------------------
  it("AC-6: GIVEN components/lightbox/provenance-row.tsx wird von der Canvas-Detail-View weiterverwendet WHEN Slice 18 implementiert ist THEN bleibt provenance-row.tsx unangetastet und funktionsfaehig", () => {
    const filePath = resolve(ROOT, "components/lightbox/provenance-row.tsx");
    expect(existsSync(filePath)).toBe(true);

    // Verify the file is non-empty and exports something useful
    const content = readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(0);

    // It should still be a valid React component file
    expect(content).toMatch(/export/);
    expect(content).toMatch(/ProvenanceRow|provenance/i);
  });

  // ---------------------------------------------------------------------------
  // AC-8: Lightbox-Test-Dateien geloescht
  // ---------------------------------------------------------------------------
  it("AC-8: GIVEN die Test-Dateien lightbox-modal.test.tsx und lightbox-navigation.test.tsx existieren WHEN Slice 18 implementiert ist THEN sind diese Test-Dateien geloescht", () => {
    const modalTestPath = resolve(
      ROOT,
      "components/lightbox/__tests__/lightbox-modal.test.tsx"
    );
    const navTestPath = resolve(
      ROOT,
      "components/lightbox/__tests__/lightbox-navigation.test.tsx"
    );

    expect(existsSync(modalTestPath)).toBe(false);
    expect(existsSync(navTestPath)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-9: Keine unresolved Imports nach Lightbox-Entfernung
  // ---------------------------------------------------------------------------
  it("AC-9: GIVEN alle Aenderungen aus Slice 18 sind durchgefuehrt WHEN die Quell-Dateien inspiziert werden THEN gibt es keine Referenzen auf geloeschte Lightbox-Module", () => {
    // Check workspace-content.tsx has no references to deleted lightbox modules
    const workspaceContentPath = resolve(
      ROOT,
      "components/workspace/workspace-content.tsx"
    );
    expect(existsSync(workspaceContentPath)).toBe(true);

    const workspaceContent = readFileSync(workspaceContentPath, "utf-8");

    // Must NOT import from deleted lightbox files
    expect(workspaceContent).not.toMatch(
      /from\s+['"].*lightbox-modal['"]/
    );
    expect(workspaceContent).not.toMatch(
      /from\s+['"].*lightbox-navigation['"]/
    );

    // Must NOT reference deleted components
    expect(workspaceContent).not.toMatch(/LightboxModal/);
    expect(workspaceContent).not.toMatch(/LightboxNavigation/);

    // Must NOT have leftover lightbox state variables
    expect(workspaceContent).not.toMatch(/lightboxOpen/);
    expect(workspaceContent).not.toMatch(/lightboxIndex/);
    expect(workspaceContent).not.toMatch(/handleLightboxClose/);
    expect(workspaceContent).not.toMatch(/handleLightboxNavigate/);
    expect(workspaceContent).not.toMatch(/handleLightboxDelete/);

    // Verify the replacement is in place: CanvasDetailView should be imported
    expect(workspaceContent).toMatch(/CanvasDetailView/);
    expect(workspaceContent).toMatch(/detailViewOpen/);
  });

  // ---------------------------------------------------------------------------
  // AC-1 (file-level): workspace-content.tsx has no lightbox imports
  // ---------------------------------------------------------------------------
  it("AC-1 (file-level): workspace-content.tsx contains no lightbox-modal or lightbox-navigation import paths", () => {
    const content = readFileSync(
      resolve(ROOT, "components/workspace/workspace-content.tsx"),
      "utf-8"
    );

    // No import statement referencing lightbox-modal or lightbox-navigation
    expect(content).not.toMatch(
      /import\s+[\s\S]*?from\s+['"][^'"]*lightbox-modal['"]/
    );
    expect(content).not.toMatch(
      /import\s+[\s\S]*?from\s+['"][^'"]*lightbox-navigation['"]/
    );
  });

  // ---------------------------------------------------------------------------
  // AC-2 (file-level): No lightbox state variables
  // ---------------------------------------------------------------------------
  it("AC-2 (file-level): workspace-content.tsx contains no lightboxOpen, lightboxIndex, or lightbox handler identifiers", () => {
    const content = readFileSync(
      resolve(ROOT, "components/workspace/workspace-content.tsx"),
      "utf-8"
    );

    const forbiddenIdentifiers = [
      "lightboxOpen",
      "lightboxIndex",
      "setLightboxOpen",
      "setLightboxIndex",
      "handleLightboxClose",
      "handleLightboxNavigate",
      "handleLightboxDelete",
    ];

    for (const id of forbiddenIdentifiers) {
      expect(content).not.toContain(id);
    }
  });

  // ---------------------------------------------------------------------------
  // AC-3 (file-level): No lightbox JSX references
  // ---------------------------------------------------------------------------
  it("AC-3 (file-level): workspace-content.tsx contains no <LightboxModal or <LightboxNavigation JSX tags", () => {
    const content = readFileSync(
      resolve(ROOT, "components/workspace/workspace-content.tsx"),
      "utf-8"
    );

    expect(content).not.toMatch(/<LightboxModal/);
    expect(content).not.toMatch(/<LightboxNavigation/);
  });
});
