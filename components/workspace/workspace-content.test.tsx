// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Tests for Slice 06: UI Setup (Collapsible + Panel Width)
 *
 * Validates:
 * - AC-1: Collapsible exports exist
 * - AC-2: Collapsible imports resolve without errors
 * - AC-3: Panel width uses w-[480px] class
 * - AC-5: Gallery section uses flex-1 for remaining space
 *
 * AC-4 (build succeeds) is validated by the orchestrator via `pnpm build`,
 * not as a unit test.
 *
 * Mocking Strategy: no_mocks (per slice spec)
 * Child components are stubbed only because they require server-side
 * resources (DATABASE_URL, server actions) that are unavailable in jsdom.
 * The components under test (Collapsible, WorkspaceContent layout) are real.
 */

// ---------------------------------------------------------------------------
// Mocks for child components that require server-side resources
// ---------------------------------------------------------------------------

// Mock db/queries to prevent DATABASE_URL crash (type export only)
vi.mock("@/lib/db/queries", () => ({
  // type Generation is used at the type level only; no runtime value needed
}));

// Mock fetchGenerations server action
vi.mock("@/app/actions/generations", () => ({
  fetchGenerations: vi.fn().mockResolvedValue([]),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Stub child components to isolate layout testing
vi.mock("@/components/workspace/prompt-area", () => ({
  PromptArea: (props: Record<string, unknown>) => (
    <div data-testid="prompt-area" data-project-id={props.projectId}>
      PromptArea Stub
    </div>
  ),
}));

vi.mock("@/components/workspace/gallery-grid", () => ({
  GalleryGrid: () => <div data-testid="gallery-grid">GalleryGrid Stub</div>,
}));

vi.mock("@/components/workspace/generation-placeholder", () => ({
  GenerationPlaceholder: () => <div data-testid="generation-placeholder" />,
}));

vi.mock("@/components/workspace/filter-chips", () => ({
  FilterChips: () => <div data-testid="filter-chips">FilterChips Stub</div>,
}));

vi.mock("@/components/lightbox/lightbox-modal", () => ({
  LightboxModal: () => <div data-testid="lightbox-modal" />,
}));

vi.mock("@/components/lightbox/lightbox-navigation", () => ({
  LightboxNavigation: () => <div data-testid="lightbox-navigation" />,
}));

// Import AFTER mocks are set up
import { WorkspaceContent } from "@/components/workspace/workspace-content";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

// ===========================================================================
// AC-1: Collapsible-Exports vorhanden
// ===========================================================================

describe("AC-1: Collapsible exports", () => {
  /**
   * AC-1: GIVEN die Codebasis ohne `components/ui/collapsible.tsx`
   *       WHEN `npx shadcn add collapsible` ausgefuehrt wird
   *       THEN existiert `components/ui/collapsible.tsx` mit den Exports
   *            `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
   */
  it("should export Collapsible, CollapsibleTrigger, and CollapsibleContent from collapsible.tsx", () => {
    expect(Collapsible).toBeDefined();
    expect(CollapsibleTrigger).toBeDefined();
    expect(CollapsibleContent).toBeDefined();

    // All three must be callable functions (React components)
    expect(typeof Collapsible).toBe("function");
    expect(typeof CollapsibleTrigger).toBe("function");
    expect(typeof CollapsibleContent).toBe("function");
  });
});

// ===========================================================================
// AC-2: Collapsible importierbar ohne TypeScript-Fehler
// ===========================================================================

describe("AC-2: Collapsible import resolves without type errors", () => {
  /**
   * AC-2: GIVEN `components/ui/collapsible.tsx` existiert
   *       WHEN eine beliebige Datei
   *            `import { Collapsible, CollapsibleTrigger, CollapsibleContent }
   *             from "@/components/ui/collapsible"` ausfuehrt
   *       THEN kompiliert das Projekt ohne TypeScript-Fehler
   *
   * Verification: This test file itself performs that exact import.
   * If the import resolved (no runtime error), the module is valid.
   * TypeScript compilation is further verified by `pnpm build` (AC-4).
   */
  it("should allow importing Collapsible components without type errors", () => {
    // The import at the top of this file already proves resolvability.
    // Additionally verify each export is a renderable React component.
    expect(Collapsible).toBeDefined();
    expect(CollapsibleTrigger).toBeDefined();
    expect(CollapsibleContent).toBeDefined();

    // Verify they can be rendered without crashing.
    // Render open so CollapsibleContent is visible.
    const { unmount, container } = render(
      <Collapsible open>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>
    );

    expect(screen.getByText("Toggle")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Verify data-slot attributes from shadcn implementation
    const collapsibleRoot = container.querySelector(
      '[data-slot="collapsible"]'
    );
    expect(collapsibleRoot).not.toBeNull();

    const trigger = container.querySelector(
      '[data-slot="collapsible-trigger"]'
    );
    expect(trigger).not.toBeNull();

    const content = container.querySelector(
      '[data-slot="collapsible-content"]'
    );
    expect(content).not.toBeNull();

    unmount();
  });
});

// ===========================================================================
// AC-3: Panel-Breite ist 480px
// ===========================================================================

describe("AC-3: Panel width", () => {
  /**
   * AC-3: GIVEN die Datei `workspace-content.tsx` mit Panel-Klasse `w-80`
   *       WHEN die Klasse auf `w-[480px]` geaendert wird
   *       THEN rendert das Prompt-Area-Panel mit einer festen Breite von 480px
   */
  it("should render prompt area panel with w-[480px] class instead of w-80", () => {
    const { container } = render(
      <WorkspaceContent projectId="test-project" initialGenerations={[]} />
    );

    // Find the panel that wraps the PromptArea stub
    const promptArea = screen.getByTestId("prompt-area");
    const panel = promptArea.parentElement!;

    // Panel MUST have the w-[480px] class (the new width)
    expect(panel.className).toContain("w-[480px]");

    // Panel MUST NOT have the old w-80 class
    expect(panel.className).not.toContain("w-80");

    // Panel should also be non-shrinkable (shrink-0) to maintain fixed width
    expect(panel.className).toContain("shrink-0");
  });
});

// ===========================================================================
// AC-5: Gallery passt sich an breiteres Panel an
// ===========================================================================

describe("AC-5: Gallery flex layout", () => {
  /**
   * AC-5: GIVEN die App laeuft mit `pnpm dev`
   *       WHEN die Workspace-Seite eines Projekts geladen wird
   *       THEN ist das linke Panel sichtbar breiter als vorher und die Gallery
   *            passt sich im verbleibenden Platz an (Flexbox-Verhalten unveraendert)
   */
  it("should render gallery section with flex-1 filling remaining space", () => {
    const { container } = render(
      <WorkspaceContent projectId="test-project" initialGenerations={[]} />
    );

    // The outer container must be a flex container
    const outerDiv = container.firstElementChild!;
    expect(outerDiv.className).toContain("flex");

    // Find the gallery section (contains the GalleryGrid stub)
    const galleryGrid = screen.getByTestId("gallery-grid");
    // Walk up to the gallery panel (the direct child of the outer flex container)
    const galleryPanel = galleryGrid.closest(
      ".flex-1"
    ) as HTMLElement;

    expect(galleryPanel).not.toBeNull();
    expect(galleryPanel!.className).toContain("flex-1");

    // The prompt panel (w-[480px]) and gallery panel (flex-1) must be siblings
    const promptPanel = screen.getByTestId("prompt-area").parentElement!;
    expect(promptPanel.parentElement).toBe(galleryPanel!.parentElement);

    // Verify the layout container uses flexbox with gap
    expect(outerDiv.className).toContain("flex");
    expect(outerDiv.className).toContain("gap-");
  });
});
