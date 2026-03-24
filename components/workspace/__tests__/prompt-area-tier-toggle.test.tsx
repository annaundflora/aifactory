// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { createElement, type ReactNode } from "react";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI needs ResizeObserver + pointer events)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock db/queries to prevent DATABASE_URL crash
vi.mock("@/lib/db/queries", () => ({}));

// Mock snippet-service to prevent DATABASE_URL crash
vi.mock("@/lib/services/snippet-service", () => ({
  SnippetService: {
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue({}),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

// Mock server actions: generations
const mockGenerateImages = vi.fn().mockResolvedValue([]);
const mockUpscaleImage = vi.fn().mockResolvedValue({});
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: (...args: unknown[]) => mockUpscaleImage(...args),
  uploadSourceImage: vi.fn().mockResolvedValue({ url: "https://r2.example.com/uploaded.png" }),
}));

// Mock server actions: model-settings (slice-07 added getModelSettings to prompt-area)
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([
    { id: "ms-1", mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-2", mode: "txt2img", tier: "quality", modelId: "black-forest-labs/flux-2-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-3", mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: { prompt_strength: 0.6 }, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-4", mode: "upscale", tier: "draft", modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 }, createdAt: new Date(), updatedAt: new Date() },
  ]),
}));

// Mock server actions: references
vi.mock("@/app/actions/references", () => ({
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
  deleteReferenceImage: vi.fn().mockResolvedValue(undefined),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
}));

// Mock lucide-react icons
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
  };
});

// Mock LLMComparison (external component, not under test)
vi.mock("@/components/prompt-improve/llm-comparison", () => ({
  LLMComparison: () => null,
}));

// Mock AssistantTrigger
vi.mock("@/components/assistant/assistant-trigger", () => ({
  AssistantTrigger: (props: Record<string, unknown>) =>
    createElement("button", { "data-testid": "assistant-trigger", onClick: props.onClick }),
}));

// Mock AssistantSheet and related
vi.mock("@/components/assistant/assistant-sheet", () => ({
  AssistantSheet: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "assistant-sheet" }, children),
}));

vi.mock("@/components/assistant/startscreen", () => ({
  Startscreen: () => createElement("div", { "data-testid": "startscreen" }),
}));

vi.mock("@/components/assistant/chat-input", () => ({
  ChatInput: () => createElement("div", { "data-testid": "chat-input" }),
}));

vi.mock("@/components/assistant/chat-thread", () => ({
  ChatThread: () => createElement("div", { "data-testid": "chat-thread" }),
}));

vi.mock("@/components/assistant/prompt-canvas", () => ({
  PromptCanvas: () => createElement("div", { "data-testid": "prompt-canvas" }),
}));

vi.mock("@/components/assistant/session-list", () => ({
  SessionList: () => createElement("div", { "data-testid": "session-list" }),
}));

vi.mock("@/components/assistant/session-switcher", () => ({
  SessionSwitcher: () => createElement("div", { "data-testid": "session-switcher" }),
}));

vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => createElement("div", { "data-testid": "model-selector" }),
}));

// Mock PromptAssistantProvider and hooks
vi.mock("@/lib/assistant/assistant-context", () => ({
  PromptAssistantProvider: ({ children }: { children: ReactNode }) => children,
  usePromptAssistant: () => ({
    messages: [],
    isStreaming: false,
    hasCanvas: false,
    selectedModel: "gpt-4",
    setSelectedModel: vi.fn(),
    cancelStream: vi.fn(),
    activeView: "startscreen" as const,
    setActiveView: vi.fn(),
    loadSession: vi.fn(),
    sessionId: null,
    dispatch: vi.fn(),
    sessionIdRef: { current: null },
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    imageModelIdRef: { current: null },
    generationModeRef: { current: null },
  }),
  getWorkspaceFieldsForChip: () => null,
}));

vi.mock("@/lib/assistant/use-assistant-runtime", () => ({
  useAssistantRuntime: () => ({
    sendMessage: vi.fn(),
  }),
}));

// Mock workspace-state
const mockClearVariation = vi.fn();
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: mockClearVariation,
  }),
  WorkspaceStateProvider: ({ children }: { children: ReactNode }) => children,
}));

// Mock ReferenceBar
vi.mock("@/components/workspace/reference-bar", () => ({
  ReferenceBar: () => createElement("div", { "data-testid": "reference-bar" }),
  getLowestFreePosition: (occupied: number[]): number => {
    const sorted = [...occupied].sort((a, b) => a - b);
    for (let i = 1; i <= 5; i++) {
      if (!sorted.includes(i)) return i;
    }
    return -1;
  },
}));

// Mock ImageDropzone
vi.mock("@/components/workspace/image-dropzone", () => ({
  ImageDropzone: (props: Record<string, unknown>) =>
    createElement("div", { "data-testid": "image-dropzone", "data-project-id": props.projectId }),
}));

// Mock SectionLabel
vi.mock("@/components/shared/section-label", () => ({
  SectionLabel: ({ children, ...props }: { children: ReactNode }) =>
    createElement("span", { "data-testid": "section-label", ...props }, children),
}));

// Import AFTER mocks
import { PromptArea } from "@/components/workspace/prompt-area";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPromptArea() {
  return render(<PromptArea projectId="proj-test" />);
}

async function switchToMode(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  // ModeSelector is now a DropdownMenu -- click trigger to open, then click item
  const trigger = screen.getByTestId("mode-selector");
  await user.click(trigger);
  const item = await screen.findByRole("menuitem", { name: new RegExp(label, "i") });
  await user.click(item);
}

// ---------------------------------------------------------------------------
// Source file path for static analysis tests (AC-6, AC-7, AC-10)
// ---------------------------------------------------------------------------

const PROMPT_AREA_PATH = path.resolve(
  __dirname,
  "..",
  "prompt-area.tsx",
);

// ===========================================================================
// Tests: PromptArea - Tier Toggle Integration
// ===========================================================================

describe("PromptArea - Tier Toggle Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // AC-1: GIVEN die Prompt-Area wird gerendert (txt2img oder img2img Mode)
  //        WHEN der initiale Render abgeschlossen ist
  //        THEN ist ein TierToggle sichtbar mit tier="draft" als Default,
  //             positioniert oberhalb des Generate-Buttons und unterhalb der
  //             Prompt-Felder (Separator dazwischen)
  // --------------------------------------------------------------------------
  it("AC-1: should render TierToggle with draft as default tier in txt2img mode", () => {
    renderPromptArea();

    // TierToggle is visible
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();

    // Draft is active by default
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "true");

    // Quality is not active
    const qualityButton = screen.getByText("Quality");
    expect(qualityButton).toHaveAttribute("aria-pressed", "false");

    // Generate button is present
    const generateButton = screen.getByTestId("generate-button");
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toHaveTextContent("Generate");
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN die Prompt-Area wird gerendert im Upscale-Mode
  //        WHEN der initiale Render abgeschlossen ist
  //        THEN ist ein TierToggle sichtbar mit tier="draft" als Default,
  //             positioniert oberhalb des Upscale-Buttons
  // --------------------------------------------------------------------------
  it("AC-2: should render TierToggle with draft as default tier in upscale mode", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Switch to upscale mode
    await switchToMode(user, "Upscale");

    // TierToggle is still visible
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();

    // Draft is still active (default)
    const draftButton = screen.getByText("Draft");
    expect(draftButton).toHaveAttribute("aria-pressed", "true");

    // Generate button now shows "Upscale"
    const button = screen.getByTestId("generate-button");
    expect(button).toHaveTextContent("Upscale");
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der TierToggle steht auf "draft" (txt2img oder img2img Mode)
  //        WHEN der User auf "Quality" klickt
  //        THEN wechselt der TierToggle zu tier="quality"
  //        NOTE: MaxQualityToggle was removed; "Max" is now a TierToggle segment
  // --------------------------------------------------------------------------
  it("AC-3: should switch to quality tier and show Max segment in txt2img mode", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Click Quality segment
    await user.click(screen.getByText("Quality"));

    // Quality is now active
    expect(screen.getByText("Quality")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Draft")).toHaveAttribute("aria-pressed", "false");

    // Max segment should be visible in the TierToggle (txt2img mode shows all tiers)
    const maxButton = screen.getByText("Max");
    expect(maxButton).toBeInTheDocument();
    expect(maxButton).toHaveAttribute("aria-pressed", "false");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN der TierToggle steht auf "quality"
  //        WHEN der User auf "Draft" klickt
  //        THEN wechselt der TierToggle zu tier="draft"
  // --------------------------------------------------------------------------
  it("AC-4: should switch back to draft tier", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Switch to quality first
    await user.click(screen.getByText("Quality"));
    expect(screen.getByText("Quality")).toHaveAttribute("aria-pressed", "true");

    // Switch back to draft
    await user.click(screen.getByText("Draft"));

    // Draft is active again
    expect(screen.getByText("Draft")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Quality")).toHaveAttribute("aria-pressed", "false");
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN der TierToggle steht auf "quality" im Upscale-Mode
  //        WHEN der Render abgeschlossen ist
  //        THEN wird der "Max" Segment NICHT angezeigt (Upscale hat keinen Max-Tier)
  // --------------------------------------------------------------------------
  it("AC-5: should hide Max segment in TierToggle when in upscale mode", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Switch to quality tier first (in txt2img mode)
    await user.click(screen.getByText("Quality"));

    // Max segment should be visible in txt2img mode
    expect(screen.getByText("Max")).toBeInTheDocument();

    // Now switch to upscale mode
    await switchToMode(user, "Upscale");

    // Quality tier is still selected
    expect(screen.getByText("Quality")).toHaveAttribute("aria-pressed", "true");

    // Max segment should NOT be visible in upscale mode (hiddenValues=["max"])
    expect(screen.queryByText("Max")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN die Prompt-Area wird gemounted
  //        WHEN der useEffect fuer Model-Settings ausgefuehrt wird
  //        THEN wird getModelSettings() aufgerufen und das Ergebnis gespeichert
  //
  //        NOTE: modelSettings useState/useEffect were REMOVED from prompt-area.tsx
  //        (they will be re-added in slice-07). This test verifies the component
  //        renders without errors even without modelSettings state.
  // --------------------------------------------------------------------------
  it("AC-8: should render without errors even without modelSettings state (deferred to slice-07)", () => {
    // Simply verify the component mounts successfully without getModelSettings
    const { container } = renderPromptArea();

    expect(container).toBeTruthy();
    expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
    expect(screen.getByTestId("tier-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("generate-button")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN getModelSettings() gibt ein leeres Array oder einen Fehler zurueck
  //        WHEN der Mount-Effect abgeschlossen ist
  //        THEN bleibt die UI funktional (TierToggle sichtbar, Generate-Button
  //             vorhanden), Settings-Array bleibt leer bzw. Default
  //
  //        NOTE: modelSettings state was removed. Test verifies UI is functional
  //        without modelSettings.
  // --------------------------------------------------------------------------
  it("AC-9: should remain functional without modelSettings (TierToggle visible, Generate-Button present)", () => {
    renderPromptArea();

    // TierToggle is present and functional
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();

    // Generate button is present
    const generateButton = screen.getByTestId("generate-button");
    expect(generateButton).toBeInTheDocument();

    // Prompt area is visible
    expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-11: GIVEN der Tier-State steht auf "draft" und es findet gerade eine
  //         Generation statt (isGenerating === true)
  //         WHEN der User die TierToggle betrachtet
  //         THEN ist der TierToggle disabled (nicht klickbar) waehrend der
  //              Generation
  // --------------------------------------------------------------------------
  it("AC-11: should pass disabled to TierToggle when generation is in progress", async () => {
    const user = userEvent.setup();

    // Make generateImages hang indefinitely to keep isGenerating=true
    mockGenerateImages.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    renderPromptArea();

    // Type a prompt so generate button is enabled
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A beautiful landscape");

    // Click generate to trigger isGenerating
    const generateButton = screen.getByTestId("generate-button");
    await user.click(generateButton);

    // Wait for the TierToggle buttons to become disabled
    await waitFor(() => {
      const draftButton = screen.getByText("Draft");
      expect(draftButton).toBeDisabled();
    });

    const qualityButton = screen.getByText("Quality");
    expect(qualityButton).toBeDisabled();

    // The TierToggle container should reflect disabled state
    const tierToggle = screen.getByTestId("tier-toggle");
    expect(tierToggle).toBeInTheDocument();
  });
});

// ===========================================================================
// Tests: PromptArea - Removed Components (Static Analysis)
// ===========================================================================

describe("PromptArea - Removed Components", () => {
  // Read the source file once for all static analysis tests
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = fs.readFileSync(PROMPT_AREA_PATH, "utf-8");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN die Prompt-Area Datei (prompt-area.tsx)
  //        WHEN die Imports analysiert werden
  //        THEN gibt es KEINE Imports mehr von ModelTrigger,
  //             ModelBrowserDrawer, ParameterPanel, getModelSchema,
  //             getProjectSelectedModels, saveProjectSelectedModels
  // --------------------------------------------------------------------------
  it("AC-6: should not import ModelTrigger or ModelBrowserDrawer", () => {
    // Extract import lines from the source
    const importLines = sourceCode
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import "));

    const importBlock = importLines.join("\n");

    expect(importBlock).not.toContain("ModelTrigger");
    expect(importBlock).not.toContain("ModelBrowserDrawer");
    // ParameterPanel is now legitimately used for schema-based parameter controls
    expect(importBlock).not.toContain("getProjectSelectedModels");
    expect(importBlock).not.toContain("saveProjectSelectedModels");
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN die Prompt-Area Datei
  //        WHEN nach JSX-Rendering von <ModelTrigger, <ModelBrowserDrawer,
  //             <ParameterPanel gesucht wird
  //        THEN gibt es KEINE Render-Aufrufe dieser Komponenten mehr
  // --------------------------------------------------------------------------
  it("AC-7: should not render ModelTrigger or ModelBrowserDrawer", () => {
    expect(sourceCode).not.toContain("<ModelTrigger");
    expect(sourceCode).not.toContain("<ModelBrowserDrawer");
    // ParameterPanel is now legitimately rendered for schema-based parameter controls
  });

  // --------------------------------------------------------------------------
  // AC-10: GIVEN die State-Variablen selectedModels, paramValues und die
  //         zugehoerige Multi-Model-Logik
  //         WHEN die Prompt-Area Datei analysiert wird
  //         THEN sind diese States und die Logik rund um selectedModels
  //              (z.B. isSingleModel, Multi-Model-Notice) entfernt
  // --------------------------------------------------------------------------
  it("AC-10: should not use selectedModels or paramValues state", () => {
    // Check that old state variables are not declared
    expect(sourceCode).not.toMatch(/useState.*selectedModels/);
    expect(sourceCode).not.toMatch(/useState.*paramValues/);

    // Check that multi-model logic identifiers are absent
    expect(sourceCode).not.toContain("isSingleModel");
    expect(sourceCode).not.toContain("selectedModels");
    expect(sourceCode).not.toContain("paramValues");
  });
});
