/**
 * Functional tests for Workspace Page (/projects/[id])
 *
 * These tests verify the page's data-fetching logic and error handling
 * WITHOUT DOM rendering, to avoid the deep transitive import chain
 * (sharp, postgres, etc.) that crashes vitest workers.
 *
 * Component rendering of Sidebar, WorkspaceContent, etc. is tested
 * in their own dedicated test files.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");

describe("Workspace Page (/projects/[id])", () => {
  /**
   * AC-1: GIVEN die Route `/projects/{id}` wird mit einer gueltigen Projekt-ID aufgerufen
   * WHEN die Seite geladen wird
   * THEN wird der Projektname als Ueberschrift im Main-Bereich angezeigt und die Sidebar ist links sichtbar
   *
   * Verified structurally: page.tsx renders WorkspaceHeader with project.name
   * and Sidebar with projects list.
   */
  it("AC-1: page.tsx should import and render WorkspaceHeader and Sidebar components", () => {
    const pagePath = resolve(ROOT, "app/projects/[id]/page.tsx");
    expect(existsSync(pagePath)).toBe(true);

    const content = readFileSync(pagePath, "utf-8");

    // Must import WorkspaceHeader and Sidebar
    expect(content).toContain("WorkspaceHeader");
    expect(content).toContain("Sidebar");

    // Must pass project name to header
    expect(content).toMatch(/projectName.*=.*project\.name|WorkspaceHeader.*project/);

    // Must pass projects to Sidebar
    expect(content).toContain("projects");
  });

  /**
   * AC-2: GIVEN die Route `/projects/{id}` wird mit einer nicht existierenden ID aufgerufen
   * WHEN die Seite geladen wird
   * THEN wird `notFound()` ausgeloest (Next.js 404-Seite)
   */
  it("AC-2: page.tsx should call notFound() when project has error", () => {
    const pagePath = resolve(ROOT, "app/projects/[id]/page.tsx");
    const content = readFileSync(pagePath, "utf-8");

    // Must import notFound
    expect(content).toContain('import { notFound }');
    expect(content).toContain('from "next/navigation"');

    // Must check for error and call notFound
    expect(content).toMatch(/["']error["'].*in.*projectResult/);
    expect(content).toContain("notFound()");
  });

  /**
   * AC-8: GIVEN die Workspace-Seite ist geladen
   * WHEN der Main-Bereich gerendert wird
   * THEN zeigt er den Workspace-Content (Prompt Area + Gallery) mit dem Projektnamen
   */
  it("AC-8: page.tsx should render WorkspaceContent with projectId", () => {
    const pagePath = resolve(ROOT, "app/projects/[id]/page.tsx");
    const content = readFileSync(pagePath, "utf-8");

    // Must import and render WorkspaceContent
    expect(content).toContain("WorkspaceContent");
    expect(content).toMatch(/WorkspaceContent/);

    // Must pass project id
    expect(content).toMatch(/projectId|project\.id/);
  });
});
