// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for jsdom
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Polyfill matchMedia for jsdom (used by shadcn/radix components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Mocks for leaf-dependencies that import server actions or Node-only modules.
// These are NOT business-logic mocks — they stub external modules that cannot
// run in jsdom so the real FilterChips, ModeBadge, GalleryGrid, and
// GenerationCard components are tested with their actual implementations.
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    const id = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const Comp = (props: Record<string, unknown>) => <span data-testid={`${id}-icon`} {...props} />;
    Comp.displayName = name;
    return Comp;
  };
  return {
    MessageSquare: stub("MessageSquare"), Minus: stub("Minus"), Plus: stub("Plus"),
    ArrowUp: stub("ArrowUp"), Square: stub("Square"), PanelRightClose: stub("PanelRightClose"),
    Image: stub("Image"), Loader2: stub("Loader2"), ImageOff: stub("ImageOff"),
    PanelRightOpen: stub("PanelRightOpen"), PanelLeftIcon: stub("PanelLeftIcon"),
    PanelLeftClose: stub("PanelLeftClose"), PenLine: stub("PenLine"),
    ChevronDown: stub("ChevronDown"), Check: stub("Check"), Type: stub("Type"),
    ImagePlus: stub("ImagePlus"), Scaling: stub("Scaling"), X: stub("X"),
    ArrowLeft: stub("ArrowLeft"), Undo2: stub("Undo2"), Redo2: stub("Redo2"),
    ChevronUp: stub("ChevronUp"), ChevronDownIcon: stub("ChevronDownIcon"),
    ChevronUpIcon: stub("ChevronUpIcon"), CheckIcon: stub("CheckIcon"),
    Info: stub("Info"), Copy: stub("Copy"), ArrowRightLeft: stub("ArrowRightLeft"),
    ZoomIn: stub("ZoomIn"), Download: stub("Download"), Trash2: stub("Trash2"),
    Sparkles: stub("Sparkles"), Library: stub("Library"), Star: stub("Star"),
    ChevronLeft: stub("ChevronLeft"), ChevronRight: stub("ChevronRight"),
    PanelLeftOpen: stub("PanelLeftOpen"),
    ImageIcon: stub("ImageIcon"), History: stub("History"),
  };
});

vi.mock("@/lib/services/reference-service", () => ({}));

// Mock db/index to prevent DATABASE_URL crash from transitive imports
vi.mock("@/lib/db/index", () => ({
  db: {},
}));

// Mock workspace-state to prevent WorkspaceStateProvider error
vi.mock("@/lib/workspace-state", () => ({
  WorkspaceStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkspaceVariation: () => ({ variation: null, setVariation: vi.fn() }),
  useWorkspaceVariationOptional: () => null,
}));

// Mock assistant modules used by WorkspaceContent
vi.mock("@/lib/assistant/assistant-context", () => ({
  PromptAssistantProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/assistant/use-assistant-runtime", () => ({
  useAssistantRuntime: () => ({}),
}));
vi.mock("@/lib/assistant/use-sessions", () => ({
  useSessions: () => ({ sessions: [], activeId: null }),
}));
vi.mock("@/components/assistant/assistant-panel", () => ({
  AssistantPanelContent: () => null,
}));

// PromptArea imports server actions — stub the entire component
vi.mock("@/components/workspace/prompt-area", () => ({
  PromptArea: () => <div data-testid="prompt-area">PromptArea stub</div>,
}));

// GenerationPlaceholder imports server actions — stub it
vi.mock("@/components/workspace/generation-placeholder", () => ({
  GenerationPlaceholder: ({ generation }: { generation: { id: string } }) => (
    <div data-testid={`placeholder-${generation.id}`}>Placeholder stub</div>
  ),
}));

// LightboxModal imports server actions — stub it
vi.mock("@/components/lightbox/lightbox-modal", () => ({
  LightboxModal: () => <div data-testid="lightbox-modal">LightboxModal stub</div>,
}));

// LightboxNavigation imports lucide-react with specific icons — stub it
vi.mock("@/components/lightbox/lightbox-navigation", () => ({
  LightboxNavigation: () => (
    <div data-testid="lightbox-navigation">LightboxNavigation stub</div>
  ),
}));

// Mock db/queries to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
}));

// Mock model actions
vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock lib/utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// fetchGenerations is a server action used by WorkspaceContent polling
vi.mock("@/app/actions/generations", () => ({
  fetchGenerations: vi.fn().mockResolvedValue([]),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
  generateImages: vi.fn().mockResolvedValue([]),
  upscaleImage: vi.fn().mockResolvedValue({}),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
}));

// sonner toast used by WorkspaceContent
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Import AFTER mocks
import { GalleryGrid } from "@/components/workspace/gallery-grid";
import { GenerationCard } from "@/components/workspace/generation-card";
import { WorkspaceContent } from "@/components/workspace/workspace-content";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Generation object with sensible defaults */
function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-01T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
  };
}

// ===========================================================================
// GalleryGrid — Filter Tests (AC-1 through AC-5)
// ===========================================================================

describe("GalleryGrid Filter", () => {
  const noop = vi.fn();

  /**
   * AC-1: GIVEN GalleryGrid erhaelt Generierungen mit gemischten Modes (txt2img, img2img, upscale)
   *       und modeFilter="img2img"
   * WHEN die Komponente rendert
   * THEN werden ausschliesslich Generierungen mit generationMode === "img2img" angezeigt;
   *      txt2img- und upscale-Generierungen sind nicht im DOM
   */
  it("AC-1: should render only img2img generations when modeFilter is img2img", () => {
    const generations = [
      makeGeneration({ id: "txt-1", prompt: "txt2img gen", generationMode: "txt2img" }),
      makeGeneration({ id: "img-1", prompt: "img2img gen 1", generationMode: "img2img" }),
      makeGeneration({ id: "up-1", prompt: "upscale gen", generationMode: "upscale" }),
      makeGeneration({ id: "img-2", prompt: "img2img gen 2", generationMode: "img2img" }),
    ];

    render(
      <GalleryGrid
        generations={generations}
        onSelectGeneration={noop}
        modeFilter="img2img"
      />
    );

    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");

    // Only the 2 img2img generations should be rendered
    expect(images).toHaveLength(2);

    const alts = Array.from(images).map((img) => img.getAttribute("alt"));
    expect(alts).toContain("img2img gen 1");
    expect(alts).toContain("img2img gen 2");
    expect(alts).not.toContain("txt2img gen");
    expect(alts).not.toContain("upscale gen");
  });

  /**
   * AC-2: GIVEN GalleryGrid erhaelt Generierungen mit gemischten Modes und modeFilter="all"
   * WHEN die Komponente rendert
   * THEN werden alle vollstaendig geladenen (status === "completed") Generierungen angezeigt,
   *      unabhaengig von generationMode
   */
  it("AC-2: should render all completed generations when modeFilter is all", () => {
    const generations = [
      makeGeneration({ id: "txt-1", prompt: "txt prompt", generationMode: "txt2img" }),
      makeGeneration({ id: "img-1", prompt: "img prompt", generationMode: "img2img" }),
      makeGeneration({ id: "up-1", prompt: "up prompt", generationMode: "upscale" }),
      makeGeneration({ id: "pending-1", prompt: "pending", generationMode: "txt2img", status: "pending" }),
    ];

    render(
      <GalleryGrid
        generations={generations}
        onSelectGeneration={noop}
        modeFilter="all"
      />
    );

    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");

    // 3 completed generations shown (pending excluded)
    expect(images).toHaveLength(3);

    const alts = Array.from(images).map((img) => img.getAttribute("alt"));
    expect(alts).toContain("txt prompt");
    expect(alts).toContain("img prompt");
    expect(alts).toContain("up prompt");
    expect(alts).not.toContain("pending");
  });

  /**
   * AC-3: GIVEN GalleryGrid erhaelt modeFilter="img2img", aber keine der Generierungen
   *       hat generationMode === "img2img"
   * WHEN die Komponente rendert
   * THEN ist kein Image-Card-Element im DOM; stattdessen ist ein Text-Element mit dem
   *      Inhalt "No Image to Image generations yet" sichtbar
   */
  it("AC-3: should show 'No Image to Image generations yet' when modeFilter is img2img with no matches", () => {
    const generations = [
      makeGeneration({ id: "txt-1", generationMode: "txt2img" }),
      makeGeneration({ id: "up-1", generationMode: "upscale" }),
    ];

    render(
      <GalleryGrid
        generations={generations}
        onSelectGeneration={noop}
        modeFilter="img2img"
      />
    );

    // No gallery grid should exist
    expect(screen.queryByTestId("gallery-grid")).not.toBeInTheDocument();

    // Empty state message must be visible
    expect(
      screen.getByText("No Image to Image generations yet")
    ).toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN GalleryGrid erhaelt modeFilter="upscale" ohne passende Generierungen
   * WHEN die Komponente rendert
   * THEN zeigt sie den Text "No Upscale generations yet"
   */
  it("AC-4: should show 'No Upscale generations yet' when modeFilter is upscale with no matches", () => {
    const generations = [
      makeGeneration({ id: "txt-1", generationMode: "txt2img" }),
      makeGeneration({ id: "img-1", generationMode: "img2img" }),
    ];

    render(
      <GalleryGrid
        generations={generations}
        onSelectGeneration={noop}
        modeFilter="upscale"
      />
    );

    expect(screen.queryByTestId("gallery-grid")).not.toBeInTheDocument();
    expect(
      screen.getByText("No Upscale generations yet")
    ).toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN GalleryGrid erhaelt modeFilter="txt2img" ohne passende Generierungen
   * WHEN die Komponente rendert
   * THEN zeigt sie den Text "No Text to Image generations yet"
   */
  it("AC-5: should show 'No Text to Image generations yet' when modeFilter is txt2img with no matches", () => {
    const generations = [
      makeGeneration({ id: "img-1", generationMode: "img2img" }),
      makeGeneration({ id: "up-1", generationMode: "upscale" }),
    ];

    render(
      <GalleryGrid
        generations={generations}
        onSelectGeneration={noop}
        modeFilter="txt2img"
      />
    );

    expect(screen.queryByTestId("gallery-grid")).not.toBeInTheDocument();
    expect(
      screen.getByText("No Text to Image generations yet")
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// GenerationCard — ModeBadge Tests (AC-6 through AC-8)
// ===========================================================================

describe("GenerationCard ModeBadge", () => {
  /**
   * AC-6: GIVEN GenerationCard wird mit einer Generierung gerendert, die generationMode="img2img" hat
   * WHEN die Karte rendert
   * THEN ist ein ModeBadge mit mode="img2img" (Text "I") im DOM sichtbar,
   *      absolut positioniert innerhalb der Karte
   */
  it("AC-6: should render ModeBadge with text 'I' for generation with generationMode img2img", () => {
    const generation = makeGeneration({
      id: "img2img-card",
      generationMode: "img2img",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    // ModeBadge should show "I" for img2img
    const badge = screen.getByText("I");
    expect(badge).toBeInTheDocument();

    // Badge should be absolutely positioned
    expect(badge.className).toMatch(/absolute/);
  });

  /**
   * AC-7: GIVEN GenerationCard wird mit einer Generierung gerendert, die generationMode="txt2img" hat
   * WHEN die Karte rendert
   * THEN ist ein ModeBadge mit mode="txt2img" (Text "T") im DOM sichtbar
   */
  it("AC-7: should render ModeBadge with text 'T' for generation with generationMode txt2img", () => {
    const generation = makeGeneration({
      id: "txt2img-card",
      generationMode: "txt2img",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const badge = screen.getByText("T");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Text to Image");
  });

  /**
   * AC-8: GIVEN GenerationCard wird mit einer Generierung gerendert, die generationMode="upscale" hat
   * WHEN die Karte rendert
   * THEN ist ein ModeBadge mit mode="upscale" (Text "U") im DOM sichtbar
   */
  it("AC-8: should render ModeBadge with text 'U' for generation with generationMode upscale", () => {
    const generation = makeGeneration({
      id: "upscale-card",
      generationMode: "upscale",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const badge = screen.getByText("U");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Upscale");
  });
});

// ===========================================================================
// WorkspaceContent — FilterChips Integration (AC-9 through AC-11)
// ===========================================================================

describe("WorkspaceContent Filter Integration", () => {
  /**
   * AC-9: GIVEN WorkspaceContent rendert mit einer Liste von Generierungen
   * WHEN die Komponente initial geladen wird
   * THEN ist der FilterChips-Filter-State "all"; FilterChips und GalleryGrid sind
   *      beide im DOM sichtbar
   */
  it("AC-9: should render FilterChips and GalleryGrid with initial filter state 'all'", () => {
    const generations = [
      makeGeneration({ id: "g1", prompt: "gen one", generationMode: "txt2img" }),
      makeGeneration({ id: "g2", prompt: "gen two", generationMode: "img2img" }),
      makeGeneration({ id: "g3", prompt: "gen three", generationMode: "upscale" }),
    ];

    render(
      <WorkspaceContent projectId="project-1" initialGenerations={generations} />
    );

    // FilterChips should be in DOM with "Alle" chip active (aria-pressed=true)
    const alleChip = screen.getByRole("button", { name: "Alle" });
    expect(alleChip).toBeInTheDocument();
    expect(alleChip).toHaveAttribute("aria-pressed", "true");

    // GalleryGrid should show all 3 completed generations
    const grid = screen.getByTestId("gallery-grid");
    expect(grid).toBeInTheDocument();
    const images = grid.querySelectorAll("img");
    expect(images).toHaveLength(3);
  });

  /**
   * AC-10: GIVEN WorkspaceContent rendert mit Generierungen und FilterChips sind sichtbar
   * WHEN der User den "Image to Image"-Chip klickt
   * THEN aendert sich der interne Filter-State auf "img2img" und GalleryGrid rendert
   *      nur img2img-Generierungen
   */
  it("AC-10: should filter gallery to img2img when 'Image to Image' chip is clicked", async () => {
    const user = userEvent.setup();
    const generations = [
      makeGeneration({ id: "t1", prompt: "txt gen", generationMode: "txt2img" }),
      makeGeneration({ id: "i1", prompt: "img gen", generationMode: "img2img" }),
      makeGeneration({ id: "u1", prompt: "up gen", generationMode: "upscale" }),
    ];

    render(
      <WorkspaceContent projectId="project-1" initialGenerations={generations} />
    );

    // Initially all 3 are shown
    expect(screen.getByTestId("gallery-grid").querySelectorAll("img")).toHaveLength(3);

    // Click the "Image to Image" chip
    const img2imgChip = screen.getByRole("button", { name: "Image to Image" });
    await user.click(img2imgChip);

    // After click, "Image to Image" chip should be active
    expect(img2imgChip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Alle" })).toHaveAttribute("aria-pressed", "false");

    // Only the img2img generation should be visible
    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("alt", "img gen");
  });

  /**
   * AC-11: GIVEN WorkspaceContent rendert und Filter ist auf "img2img" gesetzt
   * WHEN der User den "Alle"-Chip klickt
   * THEN wechselt der Filter-State zurueck auf "all" und alle Generierungen werden angezeigt
   */
  it("AC-11: should show all generations when 'Alle' chip is clicked after img2img filter was active", async () => {
    const user = userEvent.setup();
    const generations = [
      makeGeneration({ id: "t1", prompt: "txt gen", generationMode: "txt2img" }),
      makeGeneration({ id: "i1", prompt: "img gen", generationMode: "img2img" }),
      makeGeneration({ id: "u1", prompt: "up gen", generationMode: "upscale" }),
    ];

    render(
      <WorkspaceContent projectId="project-1" initialGenerations={generations} />
    );

    // First, activate img2img filter
    await user.click(screen.getByRole("button", { name: "Image to Image" }));

    // Verify only img2img is shown
    expect(screen.getByTestId("gallery-grid").querySelectorAll("img")).toHaveLength(1);

    // Now click "Alle" to reset filter
    const alleChip = screen.getByRole("button", { name: "Alle" });
    await user.click(alleChip);

    // "Alle" chip should be active again
    expect(alleChip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Image to Image" })).toHaveAttribute("aria-pressed", "false");

    // All 3 generations should be visible again
    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");
    expect(images).toHaveLength(3);

    const alts = Array.from(images).map((img) => img.getAttribute("alt"));
    expect(alts).toContain("txt gen");
    expect(alts).toContain("img gen");
    expect(alts).toContain("up gen");
  });
});
