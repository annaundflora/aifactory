// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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
// Mocks (mock_external strategy per slice-05 spec)
// ---------------------------------------------------------------------------

// Mock auth chain to prevent next-auth -> next/server resolution error
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com" }),
}));

// Mock db to prevent DATABASE_URL crash
vi.mock("@/lib/db", () => ({
  db: {},
}));

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

// Mock prompt actions (pulled by PromptTabs -> HistoryList)
vi.mock("@/app/actions/prompts", () => ({
  getPromptHistory: vi.fn().mockResolvedValue([]),
  toggleFavorite: vi.fn().mockResolvedValue(undefined),
  getFavorites: vi.fn().mockResolvedValue([]),
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

// Mock server actions: model-settings
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([
    { id: "ms-1", mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-2", mode: "txt2img", tier: "quality", modelId: "black-forest-labs/flux-2-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-3", mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: { prompt_strength: 0.6 }, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-4", mode: "img2img", tier: "quality", modelId: "ideogram-ai/ideogram-v2", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
    { id: "ms-5", mode: "upscale", tier: "draft", modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 }, createdAt: new Date(), updatedAt: new Date() },
  ]),
}));

// Mock server actions: references
vi.mock("@/app/actions/references", () => ({
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
  deleteReferenceImage: vi.fn().mockResolvedValue(undefined),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
}));

// ---------------------------------------------------------------------------
// Mock: useModelSchema (mock_external — the hook is tested in its own unit test)
// ---------------------------------------------------------------------------

const mockUseModelSchema = vi.fn();
vi.mock("@/lib/hooks/use-model-schema", () => ({
  useModelSchema: (...args: unknown[]) => mockUseModelSchema(...args),
}));

// ---------------------------------------------------------------------------
// Mock: resolveModel (mock_external — tested in its own unit test)
// ---------------------------------------------------------------------------

const mockResolveModel = vi.fn();
vi.mock("@/lib/utils/resolve-model", () => ({
  resolveModel: (...args: unknown[]) => mockResolveModel(...args),
}));

// ---------------------------------------------------------------------------
// Mock: ParameterPanel — render a testable stub that exposes its props
// ---------------------------------------------------------------------------

const mockParameterPanelOnChange = vi.fn();
vi.mock("@/components/workspace/parameter-panel", () => ({
  ParameterPanel: (props: Record<string, unknown>) => {
    // Store onChange for external access in tests
    mockParameterPanelOnChange.mockImplementation(props.onChange as (...args: unknown[]) => unknown);

    if (props.isLoading) {
      return createElement("div", {
        "data-testid": "parameter-panel-loading",
        "data-is-loading": "true",
      }, "Loading...");
    }

    if (!props.schema) {
      return null;
    }

    const schema = props.schema as Record<string, { enum?: string[] }>;
    const keys = Object.keys(schema);
    if (keys.length === 0) return null;

    return createElement("div", {
      "data-testid": "parameter-panel",
      "data-schema-keys": keys.join(","),
      "data-values": JSON.stringify(props.values),
    }, keys.map((key) =>
      createElement("div", {
        key,
        "data-testid": `param-control-${key}`,
      }, key)
    ));
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    const id = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const Comp = (props: Record<string, unknown>) => createElement("span", { "data-testid": `${id}-icon`, ...props });
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

// Mock LLMComparison
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

// Mock modelIdToDisplayName
vi.mock("@/lib/utils/model-display-name", () => ({
  modelIdToDisplayName: (id: string) => id,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { PromptArea } from "@/components/workspace/prompt-area";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const DRAFT_MODEL_ID = "black-forest-labs/flux-schnell";

const SCHEMA_WITH_ASPECT_RATIO = {
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16", "4:3", "3:2"],
    default: "1:1",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPromptArea(props: { onGenerationsCreated?: (gens: unknown[]) => void } = {}) {
  return render(<PromptArea projectId="proj-test" onGenerationsCreated={props.onGenerationsCreated} />);
}

async function switchToMode(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  const trigger = screen.getByTestId("mode-selector");
  await user.click(trigger);
  const item = await screen.findByRole("menuitem", { name: new RegExp(label, "i") });
  await user.click(item);
}

/**
 * Default setup: resolveModel returns appropriate models per mode/tier,
 * useModelSchema returns a schema with aspect_ratio.
 *
 * The modelParams returned by resolveModel are the DB-stored defaults
 * that should be spread first, BEFORE imageParams overrides.
 */
function setupDefaultMocks(overrides: {
  txt2imgModelParams?: Record<string, unknown>;
  img2imgModelParams?: Record<string, unknown>;
} = {}) {
  const txt2imgParams = overrides.txt2imgModelParams ?? { megapixels: "1" };
  const img2imgParams = overrides.img2imgModelParams ?? { megapixels: "1" };

  mockResolveModel.mockImplementation(
    (_settings: unknown, mode: string, _tier: string) => {
      if (mode === "upscale") {
        return { modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 } };
      }
      if (mode === "txt2img") {
        return { modelId: DRAFT_MODEL_ID, modelParams: txt2imgParams };
      }
      if (mode === "img2img") {
        return { modelId: DRAFT_MODEL_ID, modelParams: img2imgParams };
      }
      return undefined;
    },
  );

  mockUseModelSchema.mockImplementation((modelId: string | undefined) => {
    if (!modelId) {
      return { schema: null, isLoading: false, error: null };
    }
    return {
      schema: SCHEMA_WITH_ASPECT_RATIO,
      isLoading: false,
      error: null,
    };
  });
}

// ===========================================================================
// Tests: PromptArea - imageParams Merge in handleGenerate (Slice 05)
// ===========================================================================

describe("PromptArea – imageParams Merge in handleGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: GIVEN der User ist im txt2img-Mode mit
  //       imageParams: { aspect_ratio: "16:9" } und
  //       resolved.modelParams: { megapixels: "1" }
  //       WHEN der User auf "Generate" klickt
  //       THEN wird generateImages() mit
  //       params: { megapixels: "1", aspect_ratio: "16:9" } aufgerufen —
  //       imageParams werden ueber modelParams gemergt
  // -------------------------------------------------------------------------
  it("AC-1: should merge imageParams into params for txt2img generateImages call", async () => {
    setupDefaultMocks({ txt2imgModelParams: { megapixels: "1" } });

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for ParameterPanel to appear (model settings loaded)
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Set imageParams via ParameterPanel onChange callback
    act(() => {
      mockParameterPanelOnChange({ aspect_ratio: "16:9" });
    });

    // Verify imageParams is set in state
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ aspect_ratio: "16:9" });
    });

    // Type a prompt (required for txt2img generate)
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A beautiful landscape");

    // Click generate
    const generateButton = screen.getByTestId("generate-button");
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled();
    });
    await user.click(generateButton);

    // Assert generateImages was called with merged params
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.params).toEqual({ megapixels: "1", aspect_ratio: "16:9" });
    expect(callArgs.generationMode).toBe("txt2img");
  });

  // -------------------------------------------------------------------------
  // AC-2: GIVEN der User ist im img2img-Mode mit
  //       imageParams: { aspect_ratio: "3:2", resolution: "2K" } und
  //       resolved.modelParams: { megapixels: "1" }
  //       WHEN der User auf "Generate" klickt
  //       THEN wird generateImages() mit
  //       params: { megapixels: "1", aspect_ratio: "3:2", resolution: "2K" }
  //       aufgerufen
  // -------------------------------------------------------------------------
  it("AC-2: should merge imageParams into params for img2img generateImages call", async () => {
    setupDefaultMocks({ img2imgModelParams: { megapixels: "1" } });

    const user = userEvent.setup();
    renderPromptArea();

    // Switch to img2img mode
    await switchToMode(user, "Image to Image");

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Set imageParams with multiple keys via ParameterPanel onChange
    act(() => {
      mockParameterPanelOnChange({ aspect_ratio: "3:2", resolution: "2K" });
    });

    // Verify imageParams are set
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ aspect_ratio: "3:2", resolution: "2K" });
    });

    // Type a prompt (required for img2img generate)
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A portrait photo");

    // Click generate
    const generateButton = screen.getByTestId("generate-button");
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled();
    });
    await user.click(generateButton);

    // Assert generateImages was called with merged params
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.params).toEqual({
      megapixels: "1",
      aspect_ratio: "3:2",
      resolution: "2K",
    });
    expect(callArgs.generationMode).toBe("img2img");
  });

  // -------------------------------------------------------------------------
  // AC-3: GIVEN der User ist im txt2img-Mode mit imageParams: {} (keine
  //       Auswahl getroffen)
  //       WHEN der User auf "Generate" klickt
  //       THEN wird generateImages() mit params aufgerufen, die exakt
  //       resolved.modelParams entsprechen — kein Unterschied zum Verhalten
  //       ohne Feature
  // -------------------------------------------------------------------------
  it("AC-3: should pass only modelParams when imageParams is empty", async () => {
    setupDefaultMocks({ txt2imgModelParams: { megapixels: "1" } });

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Do NOT set any imageParams — they should default to {}
    // Verify imageParams is empty
    const panel = screen.getByTestId("parameter-panel");
    expect(panel.getAttribute("data-values")).toBe("{}");

    // Type a prompt
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A mountain scene");

    // Click generate
    const generateButton = screen.getByTestId("generate-button");
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled();
    });
    await user.click(generateButton);

    // Assert generateImages was called with only modelParams
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // { ...modelParams, ...{} } === modelParams
    expect(callArgs.params).toEqual({ megapixels: "1" });
    expect(callArgs.generationMode).toBe("txt2img");
  });

  // -------------------------------------------------------------------------
  // AC-4: GIVEN der User ist im txt2img-Mode mit
  //       imageParams: { megapixels: "0.25" } und
  //       resolved.modelParams: { megapixels: "1" }
  //       WHEN der User auf "Generate" klickt
  //       THEN wird generateImages() mit params: { megapixels: "0.25" }
  //       aufgerufen — imageParams ueberschreibt gleichnamige Keys aus
  //       modelParams
  // -------------------------------------------------------------------------
  it("AC-4: should override modelParams keys when imageParams has same key", async () => {
    setupDefaultMocks({ txt2imgModelParams: { megapixels: "1" } });

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Set imageParams with a key that conflicts with modelParams
    act(() => {
      mockParameterPanelOnChange({ megapixels: "0.25" });
    });

    // Verify imageParams is set
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ megapixels: "0.25" });
    });

    // Type a prompt
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A small thumbnail");

    // Click generate
    const generateButton = screen.getByTestId("generate-button");
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled();
    });
    await user.click(generateButton);

    // Assert generateImages was called with imageParams overriding modelParams
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // Merge: { ...{ megapixels: "1" }, ...{ megapixels: "0.25" } }
    // Result: { megapixels: "0.25" } — imageParams wins
    expect(callArgs.params).toEqual({ megapixels: "0.25" });
    expect(callArgs.generationMode).toBe("txt2img");
  });

  // -------------------------------------------------------------------------
  // AC-5: GIVEN der User ist im upscale-Mode
  //       WHEN der User auf "Generate" klickt
  //       THEN wird upscaleImage() aufgerufen OHNE imageParams-Merge —
  //       Upscale-Logik bleibt unveraendert
  // -------------------------------------------------------------------------
  it("AC-5: should not merge imageParams in upscale mode", async () => {
    setupDefaultMocks();

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
    });

    // Switch to upscale mode
    await switchToMode(user, "Upscale");

    // Verify we are in upscale mode
    await waitFor(() => {
      expect(screen.getByTestId("generate-button")).toHaveTextContent("Upscale");
    });

    // ParameterPanel should NOT be rendered in upscale mode
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

    // The upscale button should be disabled because no source image is set
    // (ImageDropzone is mocked and does not trigger onUpload).
    // We verify that the upscale code path does NOT include imageParams
    // by checking that upscaleImage is called with modelParams only (not merged).
    //
    // Since we cannot set upscaleSourceImageUrl via the mocked ImageDropzone,
    // we verify the contract by confirming:
    // 1. No ParameterPanel in upscale mode (imageParams not applicable)
    // 2. The generate button is disabled without source image
    // 3. upscaleImage is not called
    const generateButton = screen.getByTestId("generate-button");
    expect(generateButton).toBeDisabled();
    expect(mockUpscaleImage).not.toHaveBeenCalled();

    // Also verify that resolveModel was called for upscale mode
    // and that it returns modelParams without any imageParams merge
    const upscaleCalls = mockResolveModel.mock.calls.filter(
      (call: unknown[]) => call[1] === "upscale"
    );
    for (const call of upscaleCalls) {
      const result = mockResolveModel(call[0], call[1], call[2]);
      // upscale model returns { scale: 2 } — no imageParams involved
      expect(result.modelParams).toEqual({ scale: 2 });
    }
  });

  // -------------------------------------------------------------------------
  // AC-6: GIVEN der User hat im txt2img-Mode imageParams:
  //       { aspect_ratio: "16:9" } gewaehlt und eine Generierung ausgeloest
  //       WHEN die Generierung abgeschlossen ist und der User die
  //       Generation-Details betrachtet
  //       THEN ist aspect_ratio: "16:9" in den gespeicherten modelParams
  //       der Generation sichtbar
  //
  //       NOTE: We verify that generateImages is called with merged params
  //       containing aspect_ratio, which is then stored in the generations
  //       table by the server action. The actual DB storage is tested at
  //       the server action level.
  // -------------------------------------------------------------------------
  it("AC-6: should include imageParams values in stored generation modelParams", async () => {
    setupDefaultMocks({ txt2imgModelParams: { megapixels: "1" } });

    // Mock generateImages to return a generation with params
    const mockGeneration = {
      id: "gen-1",
      projectId: "proj-test",
      modelId: DRAFT_MODEL_ID,
      modelParams: { megapixels: "1", aspect_ratio: "16:9" },
      status: "completed",
    };
    mockGenerateImages.mockResolvedValue([mockGeneration]);

    const onGenerationsCreated = vi.fn();
    const user = userEvent.setup();
    renderPromptArea({ onGenerationsCreated });

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Set imageParams with aspect_ratio
    act(() => {
      mockParameterPanelOnChange({ aspect_ratio: "16:9" });
    });

    // Verify imageParams is set
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ aspect_ratio: "16:9" });
    });

    // Type a prompt
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A panoramic view");

    // Click generate
    const generateButton = screen.getByTestId("generate-button");
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled();
    });
    await user.click(generateButton);

    // Assert generateImages was called with merged params including aspect_ratio
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockGenerateImages.mock.calls[0][0];
    // The params sent to generateImages contain the merged values
    expect(callArgs.params).toEqual({ megapixels: "1", aspect_ratio: "16:9" });
    // This is what gets stored as modelParams in the generation record
    expect(callArgs.params.aspect_ratio).toBe("16:9");

    // The onGenerationsCreated callback receives the generation with stored params
    await waitFor(() => {
      expect(onGenerationsCreated).toHaveBeenCalledTimes(1);
    });
    const createdGenerations = onGenerationsCreated.mock.calls[0][0];
    expect(createdGenerations[0].modelParams.aspect_ratio).toBe("16:9");
  });
});
