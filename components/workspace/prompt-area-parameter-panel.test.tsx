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
// Mocks (mock_external strategy per slice spec)
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
// Draft and quality model IDs are intentionally DIFFERENT to test AC-5 (reset on tier change)
const DRAFT_MODEL_ID = "black-forest-labs/flux-schnell";
const QUALITY_MODEL_ID = "black-forest-labs/flux-2-pro";

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
    PanelLeftOpen: stub("PanelLeftOpen"), Eraser: stub("Eraser"),
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

const SCHEMA_WITH_ASPECT_RATIO = {
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16", "4:3"],
    default: "1:1",
  },
};

const SCHEMA_WITH_ASPECT_AND_MEGAPIXELS = {
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16", "4:3"],
    default: "1:1",
  },
  megapixels: {
    type: "string",
    enum: ["0.25", "1"],
    default: "1",
  },
};

const SCHEMA_QUALITY_MODEL = {
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16"],
    default: "1:1",
  },
  style: {
    type: "string",
    enum: ["natural", "vivid"],
    default: "natural",
  },
};

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
  const trigger = screen.getByTestId("mode-selector");
  await user.click(trigger);
  const item = await screen.findByRole("menuitem", { name: new RegExp(label, "i") });
  await user.click(item);
}

/**
 * Default setup: resolveModel returns a model for txt2img/draft,
 * useModelSchema returns a schema with aspect_ratio.
 */
function setupDefaultMocks(
  schema: Record<string, unknown> = SCHEMA_WITH_ASPECT_RATIO,
  overrides: { isLoading?: boolean; error?: string | null } = {},
) {
  mockResolveModel.mockImplementation(
    (_settings: unknown, mode: string, tier: string) => {
      if (mode === "upscale") {
        return { modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 } };
      }
      if (mode === "txt2img" && tier === "draft") {
        return { modelId: DRAFT_MODEL_ID, modelParams: {} };
      }
      if (mode === "txt2img" && tier === "quality") {
        return { modelId: QUALITY_MODEL_ID, modelParams: {} };
      }
      if (mode === "img2img" && tier === "draft") {
        return { modelId: DRAFT_MODEL_ID, modelParams: { prompt_strength: 0.6 } };
      }
      if (mode === "img2img" && tier === "quality") {
        return { modelId: "ideogram-ai/ideogram-v2", modelParams: {} };
      }
      return undefined;
    },
  );

  mockUseModelSchema.mockImplementation((modelId: string | undefined) => {
    if (!modelId) {
      return { schema: null, isLoading: false, error: null };
    }
    return {
      schema: overrides.isLoading ? null : schema,
      isLoading: overrides.isLoading ?? false,
      error: overrides.error ?? null,
    };
  });
}

// ===========================================================================
// Tests: PromptArea - ParameterPanel Mount (Slice 04)
// ===========================================================================

describe("PromptArea – ParameterPanel Mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: GIVEN prompt-area.tsx im txt2img-Mode mit Tier "draft" und einem
  //       konfigurierten Model-Setting fuer txt2img/draft
  //       WHEN die Komponente gerendert wird und useModelSchema ein Schema
  //       mit aspect_ratio (enum) zurueckgibt
  //       THEN erscheint ein ParameterPanel zwischen TierToggle und
  //       Variants-Stepper, das aspect_ratio als Primary-Control zeigt
  // -------------------------------------------------------------------------
  it("AC-1: should render ParameterPanel with primary controls in txt2img mode", async () => {
    setupDefaultMocks(SCHEMA_WITH_ASPECT_RATIO);

    renderPromptArea();

    // Wait for model settings to load and ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    const panel = screen.getByTestId("parameter-panel");

    // ParameterPanel should show aspect_ratio control
    expect(screen.getByTestId("param-control-aspect_ratio")).toBeInTheDocument();

    // Verify ParameterPanel is between TierToggle and Variants-Stepper in DOM order
    const tierToggle = screen.getByTestId("tier-toggle");
    const variantSelector = screen.getByTestId("variant-count-selector");

    // Check DOM ordering: tier-toggle, then parameter-panel, then variant-count-selector
    const allElements = document.querySelectorAll(
      '[data-testid="tier-toggle"], [data-testid="parameter-panel"], [data-testid="variant-count-selector"]',
    );
    const positions = Array.from(allElements).map((el) => el.getAttribute("data-testid"));
    expect(positions.indexOf("tier-toggle")).toBeLessThan(positions.indexOf("parameter-panel"));
    expect(positions.indexOf("parameter-panel")).toBeLessThan(positions.indexOf("variant-count-selector"));

    // useModelSchema was called with the resolved model ID
    expect(mockUseModelSchema).toHaveBeenCalledWith(DRAFT_MODEL_ID);
  });

  // -------------------------------------------------------------------------
  // AC-2: GIVEN prompt-area.tsx im img2img-Mode mit Tier "quality" und einem
  //       konfigurierten Model-Setting fuer img2img/quality
  //       WHEN die Komponente gerendert wird und useModelSchema ein Schema
  //       mit aspect_ratio und megapixels (enum) zurueckgibt
  //       THEN erscheint ein ParameterPanel zwischen TierToggle und
  //       Variants-Stepper, das beide Primary-Controls zeigt
  // -------------------------------------------------------------------------
  it("AC-2: should render ParameterPanel with primary controls in img2img mode", async () => {
    setupDefaultMocks(SCHEMA_WITH_ASPECT_AND_MEGAPIXELS);

    const user = userEvent.setup();
    renderPromptArea();

    // Switch to img2img mode
    await switchToMode(user, "Image to Image");

    // Switch tier to quality
    await user.click(screen.getByText("Quality"));

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // ParameterPanel should show both primary controls
    expect(screen.getByTestId("param-control-aspect_ratio")).toBeInTheDocument();
    expect(screen.getByTestId("param-control-megapixels")).toBeInTheDocument();

    // Verify panel is between TierToggle and Variants-Stepper
    const allElements = document.querySelectorAll(
      '[data-testid="tier-toggle"], [data-testid="parameter-panel"], [data-testid="variant-count-selector"]',
    );
    const positions = Array.from(allElements).map((el) => el.getAttribute("data-testid"));
    expect(positions.indexOf("tier-toggle")).toBeLessThan(positions.indexOf("parameter-panel"));
    expect(positions.indexOf("parameter-panel")).toBeLessThan(positions.indexOf("variant-count-selector"));
  });

  // -------------------------------------------------------------------------
  // AC-3: GIVEN ParameterPanel zeigt aspect_ratio mit Wert "16:9" im
  //       txt2img-State
  //       WHEN der User den Wert auf "1:1" aendert
  //       THEN wird imageParams im txt2img-State zu { aspect_ratio: "1:1" }
  //       aktualisiert (State-Typ: Txt2ImgState.imageParams)
  // -------------------------------------------------------------------------
  it("AC-3: should update imageParams in mode state when user changes a parameter value", async () => {
    setupDefaultMocks(SCHEMA_WITH_ASPECT_RATIO);

    renderPromptArea();

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Verify initial values are empty
    const panel = screen.getByTestId("parameter-panel");
    expect(panel.getAttribute("data-values")).toBe("{}");

    // Simulate a parameter change via the ParameterPanel's onChange callback
    // The mock stores the onChange function so we can call it directly
    const newValues = { aspect_ratio: "1:1" };
    act(() => {
      mockParameterPanelOnChange(newValues);
    });

    // After onChange is called, re-render should reflect updated values
    await waitFor(() => {
      const updatedPanel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(updatedPanel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ aspect_ratio: "1:1" });
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: GIVEN useModelSchema gibt { isLoading: true } zurueck
  //       WHEN prompt-area.tsx rendert (txt2img oder img2img Mode)
  //       THEN zeigt der Bereich zwischen TierToggle und Variants-Stepper
  //       Skeleton-Platzhalter (aus ParameterPanel)
  // -------------------------------------------------------------------------
  it("AC-4: should render skeleton placeholders while schema is loading", async () => {
    setupDefaultMocks(SCHEMA_WITH_ASPECT_RATIO, { isLoading: true });

    renderPromptArea();

    // Wait for model settings to load, then ParameterPanel loading state appears
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel-loading")).toBeInTheDocument();
    });

    // The loading skeleton has data-is-loading="true"
    const loadingPanel = screen.getByTestId("parameter-panel-loading");
    expect(loadingPanel.getAttribute("data-is-loading")).toBe("true");

    // The full parameter-panel testid should NOT be present (only loading skeleton)
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-5: GIVEN der User ist im txt2img-Mode mit Tier "draft" und hat
  //       imageParams: { aspect_ratio: "16:9" } gesetzt
  //       WHEN der User Tier zu "quality" aendert und das neue Model ein
  //       anderes Schema hat
  //       THEN wird imageParams im txt2img-State auf {} zurueckgesetzt
  // -------------------------------------------------------------------------
  it("AC-5: should reset imageParams to empty object when tier changes", async () => {
    // Setup: different models for draft vs quality with different schemas
    let currentModelId: string | undefined;

    mockResolveModel.mockImplementation(
      (_settings: unknown, mode: string, tier: string) => {
        if (mode === "upscale") {
          return { modelId: "nightmareai/real-esrgan", modelParams: {} };
        }
        if (tier === "draft") {
          return { modelId: DRAFT_MODEL_ID, modelParams: {} };
        }
        if (tier === "quality") {
          return { modelId: QUALITY_MODEL_ID, modelParams: {} };
        }
        return undefined;
      },
    );

    mockUseModelSchema.mockImplementation((modelId: string | undefined) => {
      currentModelId = modelId;
      if (!modelId) return { schema: null, isLoading: false, error: null };
      if (modelId === DRAFT_MODEL_ID) {
        return { schema: SCHEMA_WITH_ASPECT_RATIO, isLoading: false, error: null };
      }
      if (modelId === QUALITY_MODEL_ID) {
        return { schema: SCHEMA_QUALITY_MODEL, isLoading: false, error: null };
      }
      return { schema: null, isLoading: false, error: null };
    });

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for ParameterPanel to appear with draft model schema
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Set imageParams via onChange
    act(() => {
      mockParameterPanelOnChange({ aspect_ratio: "16:9" });
    });

    // Verify imageParams is set
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ aspect_ratio: "16:9" });
    });

    // Switch tier to quality — this changes the resolved modelId
    await user.click(screen.getByText("Quality"));

    // After tier change, imageParams should be reset to {}
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({});
    });

    // useModelSchema should have been called with the quality model ID
    expect(mockUseModelSchema).toHaveBeenCalledWith(QUALITY_MODEL_ID);
  });

  // -------------------------------------------------------------------------
  // AC-6: GIVEN der User wechselt von txt2img zu img2img und zurueck
  //       WHEN der txt2img-State wiederhergestellt wird
  //       THEN sind die zuvor gesetzten imageParams des txt2img-States
  //       erhalten (Mode-Persistenz)
  // -------------------------------------------------------------------------
  it("AC-6: should preserve imageParams when switching modes and switching back", async () => {
    setupDefaultMocks(SCHEMA_WITH_ASPECT_RATIO);

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for ParameterPanel to appear
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // Set imageParams in txt2img mode
    act(() => {
      mockParameterPanelOnChange({ aspect_ratio: "16:9" });
    });

    // Verify imageParams is set
    await waitFor(() => {
      const panel = screen.getByTestId("parameter-panel");
      const values = JSON.parse(panel.getAttribute("data-values") || "{}");
      expect(values).toEqual({ aspect_ratio: "16:9" });
    });

    // Switch to img2img mode
    await switchToMode(user, "Image to Image");

    // Verify we are in img2img mode — ParameterPanel should still render
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // img2img should have its own (empty) imageParams
    const img2imgPanel = screen.getByTestId("parameter-panel");
    const img2imgValues = JSON.parse(img2imgPanel.getAttribute("data-values") || "{}");
    expect(img2imgValues).toEqual({});

    // Switch back to txt2img mode
    await switchToMode(user, "Text to Image");

    // Wait for ParameterPanel to re-render
    await waitFor(() => {
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
    });

    // txt2img imageParams should be preserved from before the mode switch
    await waitFor(() => {
      const restoredPanel = screen.getByTestId("parameter-panel");
      const restoredValues = JSON.parse(restoredPanel.getAttribute("data-values") || "{}");
      expect(restoredValues).toEqual({ aspect_ratio: "16:9" });
    });
  });

  // -------------------------------------------------------------------------
  // AC-7: GIVEN der aktuelle Mode ist "upscale"
  //       WHEN prompt-area.tsx rendert
  //       THEN wird KEIN ParameterPanel gerendert (Upscale zeigt keine
  //       Parameter-Controls)
  // -------------------------------------------------------------------------
  it("AC-7: should not render ParameterPanel in upscale mode", async () => {
    setupDefaultMocks(SCHEMA_WITH_ASPECT_RATIO);

    const user = userEvent.setup();
    renderPromptArea();

    // Switch to upscale mode
    await switchToMode(user, "Upscale");

    // Wait for mode switch to complete
    await waitFor(() => {
      expect(screen.getByTestId("generate-button")).toHaveTextContent("Upscale");
    });

    // ParameterPanel should NOT be rendered in upscale mode
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel-loading")).not.toBeInTheDocument();

    // TierToggle and Generate button should still be present
    expect(screen.getByTestId("tier-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("generate-button")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-8: GIVEN useModelSchema gibt { error: "Model not found" } zurueck
  //       WHEN prompt-area.tsx rendert
  //       THEN wird KEIN ParameterPanel gerendert (graceful degradation) und
  //       Generation bleibt moeglich
  // -------------------------------------------------------------------------
  it("AC-8: should not render ParameterPanel when schema fetch returns error", async () => {
    // Setup: schema returns error
    setupDefaultMocks(SCHEMA_WITH_ASPECT_RATIO, { error: "Model not found" });

    // Override useModelSchema to return error state (schema = null)
    mockUseModelSchema.mockImplementation((modelId: string | undefined) => {
      if (!modelId) return { schema: null, isLoading: false, error: null };
      return { schema: null, isLoading: false, error: "Model not found" };
    });

    const user = userEvent.setup();
    renderPromptArea();

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
    });

    // ParameterPanel should NOT be rendered (schema is null due to error)
    expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parameter-panel-loading")).not.toBeInTheDocument();

    // Generation should still be possible — type a prompt and verify button is enabled
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "A beautiful landscape");

    const generateButton = screen.getByTestId("generate-button");
    expect(generateButton).not.toBeDisabled();
  });
});
