// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { createElement, type ReactNode } from "react";

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
}));

// Mock server actions: model-settings
const mockGetModelSettings = vi.fn().mockResolvedValue([]);
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: (...args: unknown[]) => mockGetModelSettings(...args),
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
    PanelLeftOpen: stub("PanelLeftOpen"), Eraser: stub("Eraser"),
  };
});

// Mock LLMComparison — capture props to verify generationMode passthrough
const mockLLMComparisonProps = vi.fn();
vi.mock("@/components/prompt-improve/llm-comparison", () => ({
  LLMComparison: (props: Record<string, unknown>) => {
    mockLLMComparisonProps(props);
    return createElement("div", { "data-testid": "llm-comparison-mock" }, "LLMComparison Mock");
  },
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
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
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
// Fixtures: Model Settings
// ---------------------------------------------------------------------------

function makeModelSetting(overrides: Record<string, unknown> = {}) {
  return {
    id: "ms-1",
    mode: "txt2img",
    tier: "draft",
    modelId: "black-forest-labs/flux-schnell",
    modelParams: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFullModelSettings() {
  return [
    makeModelSetting({ id: "ms-1", mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {} }),
    makeModelSetting({ id: "ms-2", mode: "txt2img", tier: "quality", modelId: "black-forest-labs/flux-2-pro", modelParams: {} }),
    makeModelSetting({ id: "ms-3", mode: "txt2img", tier: "max", modelId: "black-forest-labs/flux-2-max", modelParams: {} }),
    makeModelSetting({ id: "ms-4", mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: { prompt_strength: 0.6 } }),
    makeModelSetting({ id: "ms-5", mode: "img2img", tier: "quality", modelId: "black-forest-labs/flux-2-pro", modelParams: { prompt_strength: 0.8 } }),
    makeModelSetting({ id: "ms-6", mode: "img2img", tier: "max", modelId: "black-forest-labs/flux-2-max", modelParams: {} }),
    makeModelSetting({ id: "ms-7", mode: "upscale", tier: "draft", modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 } }),
    makeModelSetting({ id: "ms-8", mode: "upscale", tier: "quality", modelId: "philz1337x/crystal-upscaler", modelParams: { scale: 4 } }),
  ];
}

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
  // ModeSelector is a DropdownMenu -- click trigger to open, then click item
  const trigger = screen.getByTestId("mode-selector");
  await user.click(trigger);
  const item = await screen.findByRole("menuitem", { name: new RegExp(label, "i") });
  await user.click(item);
}

// ===========================================================================
// Tests: PromptArea LLMComparison integration (Slice 05)
// ===========================================================================

describe("PromptArea LLMComparison integration (Slice 05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelSettings.mockResolvedValue(makeFullModelSettings());
  });

  // -------------------------------------------------------------------------
  // AC-4: currentMode wird als generationMode an LLMComparison uebergeben
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN `prompt-area.tsx` rendert `LLMComparison` im `showImprove`-Zustand
   *       WHEN `currentMode` den Wert `"txt2img"` hat (default)
   *       THEN wird `<LLMComparison ... generationMode={currentMode} />` mit `generationMode="txt2img"` uebergeben
   */
  it("AC-4: should pass currentMode as generationMode prop to LLMComparison (txt2img default)", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Wait for model settings to load
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalled();
    });

    // Type a prompt (required for Improve button to be enabled)
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A beautiful landscape");

    // Click the Improve button to trigger showImprove=true
    const improveBtn = screen.getByTestId("improve-btn");
    await waitFor(() => {
      expect(improveBtn).not.toBeDisabled();
    });
    await user.click(improveBtn);

    // Verify LLMComparison was rendered (via mock)
    await waitFor(() => {
      expect(screen.getByTestId("llm-comparison-mock")).toBeInTheDocument();
    });

    // Verify generationMode="txt2img" was passed (default mode)
    expect(mockLLMComparisonProps).toHaveBeenCalled();
    const lastCall = mockLLMComparisonProps.mock.calls[mockLLMComparisonProps.mock.calls.length - 1][0];
    expect(lastCall.generationMode).toBe("txt2img");
  });

  /**
   * AC-4: GIVEN `prompt-area.tsx` rendert `LLMComparison` im `showImprove`-Zustand
   *       WHEN `currentMode` den Wert `"img2img"` hat (useState Zeile 134)
   *       THEN wird `<LLMComparison ... generationMode={currentMode} />` mit `generationMode="img2img"` uebergeben
   */
  it("AC-4: should pass currentMode as generationMode prop to LLMComparison (img2img)", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Wait for model settings to load
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalled();
    });

    // Switch to img2img mode
    await switchToMode(user, "Image to Image");

    // Type a prompt (required for Improve button to be enabled)
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A cat on a roof");

    // Click the Improve button to trigger showImprove=true
    const improveBtn = screen.getByTestId("improve-btn");
    await waitFor(() => {
      expect(improveBtn).not.toBeDisabled();
    });
    await user.click(improveBtn);

    // Verify LLMComparison was rendered (via mock)
    await waitFor(() => {
      expect(screen.getByTestId("llm-comparison-mock")).toBeInTheDocument();
    });

    // Verify generationMode="img2img" was passed
    expect(mockLLMComparisonProps).toHaveBeenCalled();
    const lastCall = mockLLMComparisonProps.mock.calls[mockLLMComparisonProps.mock.calls.length - 1][0];
    expect(lastCall.generationMode).toBe("img2img");
  });

  /**
   * Additional: Verify that prompt and modelId are also passed alongside generationMode
   */
  it("should pass prompt, modelId, and generationMode together to LLMComparison", async () => {
    const user = userEvent.setup();
    renderPromptArea();

    // Wait for model settings to load
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalled();
    });

    // Type a prompt
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A sunset over mountains");

    // Click the Improve button
    const improveBtn = screen.getByTestId("improve-btn");
    await waitFor(() => {
      expect(improveBtn).not.toBeDisabled();
    });
    await user.click(improveBtn);

    // Verify LLMComparison was rendered
    await waitFor(() => {
      expect(screen.getByTestId("llm-comparison-mock")).toBeInTheDocument();
    });

    // Verify all key props are passed
    const lastCall = mockLLMComparisonProps.mock.calls[mockLLMComparisonProps.mock.calls.length - 1][0];
    expect(lastCall.prompt).toBe("A sunset over mountains");
    expect(lastCall.modelId).toBeTruthy(); // resolved from model settings
    expect(lastCall.generationMode).toBe("txt2img");
    expect(lastCall.onAdopt).toBeTypeOf("function");
    expect(lastCall.onDiscard).toBeTypeOf("function");
  });
});
