// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";

import { type CollectionModel } from "@/lib/types/collection-model";

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

// Mock sonner toast
const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Mock MODELS registry — model-1 does NOT support img2img (no image param),
// model-2 DOES support img2img (has image param in schema).
// NOTE: In the model-cards architecture, MODELS is largely replaced by
// getCollectionModels, but auto-switch logic still iterates MODELS.
vi.mock("@/lib/models", () => ({
  MODELS: [
    { id: "black-forest-labs/flux-schnell", displayName: "FLUX Schnell", pricePerImage: 0.055 },
    { id: "stability-ai/sdxl", displayName: "Stable Diffusion XL", pricePerImage: 0 },
  ],
  getModelById: (id: string) => {
    const models: Record<
      string,
      { id: string; displayName: string; pricePerImage: number }
    > = {
      "black-forest-labs/flux-schnell": {
        id: "black-forest-labs/flux-schnell",
        displayName: "FLUX Schnell",
        pricePerImage: 0.055,
      },
      "stability-ai/sdxl": {
        id: "stability-ai/sdxl",
        displayName: "Stable Diffusion XL",
        pricePerImage: 0,
      },
    };
    return models[id] ?? undefined;
  },
}));

// Mock getModelSchema + getCollectionModels server actions
const mockGetModelSchema = vi.fn();
const mockGetCollectionModels = vi.fn();
vi.mock("@/app/actions/models", () => ({
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
  getCollectionModels: (...args: unknown[]) => mockGetCollectionModels(...args),
}));

// Mock generateImages and upscaleImage server actions
const mockGenerateImages = vi.fn();
const mockUpscaleImage = vi.fn();
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: (...args: unknown[]) => mockUpscaleImage(...args),
  uploadSourceImage: vi.fn().mockResolvedValue({ url: "https://r2.example.com/uploaded.png" }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "chevron-down", ...props }),
  ChevronDownIcon: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "chevron-down-icon", ...props }),
  ChevronUpIcon: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "chevron-up-icon", ...props }),
  CheckIcon: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "check-icon", ...props }),
  Loader2: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "loader-icon", ...props }),
  Wand2: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "wand-icon", ...props }),
  Sparkles: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "sparkles-icon", ...props }),
  X: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "x-icon", ...props }),
  Search: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "search-icon", ...props }),
  AlertCircle: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "alert-circle-icon", ...props }),
}));

// Mock LLMComparison (external component, not under test here)
vi.mock("@/components/prompt-improve/llm-comparison", () => ({
  LLMComparison: () => null,
}));

// Variation mock — controllable for cross-mode tests
const mockSetVariation = vi.fn();
const mockClearVariation = vi.fn();
let mockVariationData: {
  promptMotiv: string;
  promptStyle?: string;
  negativePrompt?: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  targetMode?: string;
  sourceImageUrl?: string;
  strength?: number;
} | null = null;

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: mockClearVariation,
  }),
}));

// Capture ModelBrowserDrawer props so tests can invoke onConfirm
const capturedDrawerProps: { current: Record<string, unknown> } = { current: {} };
vi.mock("@/components/models/model-browser-drawer", () => ({
  ModelBrowserDrawer: (props: Record<string, unknown>) => {
    capturedDrawerProps.current = props;
    return <div data-testid="mock-model-browser-drawer" />;
  },
}));

// Import AFTER mocks
import { PromptArea } from "@/components/workspace/prompt-area";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * CollectionModel fixtures for the model-cards architecture.
 * These map to the MODELS mock entries via owner/name -> model.id.
 *
 * COLLECTION_MODELS[0] ("flux-schnell") does NOT support img2img.
 * COLLECTION_MODELS[1] ("sdxl") DOES support img2img.
 */
const COLLECTION_MODELS: CollectionModel[] = [
  {
    url: "https://replicate.com/black-forest-labs/flux-schnell",
    owner: "black-forest-labs",
    name: "flux-schnell",
    description: "Fast model",
    cover_image_url: "https://example.com/flux.jpg",
    run_count: 5_000_000,
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    url: "https://replicate.com/stability-ai/sdxl",
    owner: "stability-ai",
    name: "sdxl",
    description: "SDXL model",
    cover_image_url: "https://example.com/sdxl.jpg",
    run_count: 3_000_000,
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    url: "https://replicate.com/stability-ai/sd-turbo",
    owner: "stability-ai",
    name: "sd-turbo",
    description: "Turbo model",
    cover_image_url: null,
    run_count: 1_000_000,
    created_at: "2025-01-15T00:00:00Z",
  },
];

/** Schema WITHOUT negative_prompt property and WITHOUT image input (txt2img only) */
const schemaWithoutNeg = {
  properties: {
    prompt: { type: "string" },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "9:16"],
      default: "1:1",
    },
    num_inference_steps: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      default: 28,
    },
  },
};

/** Alias for clarity — schema without image input params (txt2img only) */
const schemaTxt2ImgOnly = schemaWithoutNeg;

/** Schema WITH negative_prompt property */
const schemaWithNeg = {
  properties: {
    prompt: { type: "string" },
    negative_prompt: { type: "string" },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "9:16"],
      default: "1:1",
    },
    guidance_scale: {
      type: "number",
      minimum: 0,
      maximum: 20,
      default: 3.5,
    },
  },
};

/** Schema WITH image input param (supports img2img) */
const schemaWithImg2Img = {
  properties: {
    prompt: { type: "string" },
    image: { type: "string", format: "uri" },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "9:16"],
      default: "1:1",
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a schema resolver that returns schemaTxt2ImgOnly for flux-schnell
 * and schemaWithImg2Img for sdxl. This simulates flux-schnell not supporting
 * img2img and sdxl supporting it.
 *
 * Uses owner/name model IDs consistent with CollectionModel architecture.
 */
function createModelSchemaResolver() {
  return (args: { modelId: string }) => {
    if (args.modelId === "stability-ai/sdxl") {
      return Promise.resolve(schemaWithImg2Img);
    }
    return Promise.resolve(schemaTxt2ImgOnly);
  };
}

/**
 * Renders PromptArea with mocked collection models and schema.
 * Waits for getCollectionModels to be called and selectedModels to initialize.
 *
 * Accepts either a static schema object or a resolver function for per-model
 * schema resolution (needed for img2img compatibility tests).
 */
async function renderPromptArea(
  schemaOrResolver:
    | Record<string, unknown>
    | ((args: { modelId: string }) => Promise<Record<string, unknown>>) = schemaTxt2ImgOnly,
  { skipModelTriggerWait = false }: { skipModelTriggerWait?: boolean } = {}
) {
  if (typeof schemaOrResolver === "function") {
    mockGetModelSchema.mockImplementation(schemaOrResolver);
  } else {
    mockGetModelSchema.mockResolvedValue(schemaOrResolver);
  }
  const result = render(<PromptArea projectId="proj-1" />);
  // Wait for getCollectionModels to be called on mount
  await waitFor(() => {
    expect(mockGetCollectionModels).toHaveBeenCalled();
  });
  // Wait for model-trigger to appear (selectedModels initialized from collection)
  // Skip this wait when the component starts in upscale mode (model-trigger is hidden)
  if (!skipModelTriggerWait) {
    await waitFor(() => {
      expect(screen.getByTestId("model-trigger")).toBeInTheDocument();
    });
    // Wait for schema loading to complete
    await waitFor(() => {
      expect(
        screen.queryByTestId("parameter-panel-loading")
      ).not.toBeInTheDocument();
    });
  }
  return result;
}

/**
 * Helper to click a mode selector segment by label text.
 */
async function clickModeSegment(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  const segment = screen.getByText(label);
  await user.click(segment);
  // Allow async mode change (checkAndAutoSwitchModel) to settle
  await waitFor(() => {
    // The ModeSelector should reflect the new active state
    expect(segment.closest("[data-active='true']") || segment.getAttribute("data-active")).toBeDefined();
  });
}

// ---------------------------------------------------------------------------
// Tests: PromptArea Multi-Mode (Slice 14)
// ---------------------------------------------------------------------------

describe("PromptArea Multi-Mode (Slice 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDrawerProps.current = {};
    mockGetCollectionModels.mockResolvedValue(COLLECTION_MODELS);
    mockGetModelSchema.mockResolvedValue(schemaWithoutNeg);
    mockGenerateImages.mockResolvedValue([]);
    mockUpscaleImage.mockResolvedValue({ id: "gen-1" });
    mockVariationData = null;
    mockToast.mockClear();
  });

  // =========================================================================
  // Existing tests (from earlier slices, updated for slice-10 ModelTrigger)
  // =========================================================================

  /**
   * AC-5 (earlier slice): GIVEN ein Model-Schema ohne negative_prompt Property
   * WHEN das Prompt-Area gerendert wird
   * THEN ist das Negative-Prompt-Input NICHT sichtbar
   */
  it("should not render negative-prompt input when model schema has no negative_prompt property", async () => {
    await renderPromptArea(schemaWithoutNeg);

    expect(
      screen.queryByTestId("negative-prompt-textarea")
    ).not.toBeInTheDocument();
  });

  /**
   * AC-6 (earlier slice): GIVEN ein Model-Schema MIT negative_prompt Property
   * WHEN das Prompt-Area gerendert wird
   * THEN ist das Negative-Prompt-Input sichtbar und editierbar
   */
  it("should render negative-prompt input when model schema has negative_prompt property", async () => {
    const user = userEvent.setup();
    await renderPromptArea(schemaWithNeg);

    const negInput = screen.getByTestId("negative-prompt-textarea");
    expect(negInput).toBeInTheDocument();

    // Verify it is editable
    await user.type(negInput, "no blur");
    expect(negInput).toHaveValue("no blur");
  });

  /**
   * AC-7 (earlier slice): GIVEN das Prompt-Textarea ist leer
   * WHEN der User Text eingibt der mehr als 3 Zeilen erfordert
   * THEN waechst die Textarea-Hoehe automatisch mit (Auto-Resize)
   */
  it("should auto-resize textarea height when content exceeds initial rows", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    const textarea = screen.getByTestId(
      "prompt-motiv-textarea"
    ) as HTMLTextAreaElement;

    // Type multi-line text
    const longText =
      "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7";
    await user.type(textarea, longText);

    // After typing, the textarea style.height should be set to scrollHeight
    expect(textarea.style.height).toBeDefined();
    expect(textarea.style.height).toMatch(/^\d+px$/);
  });

  /**
   * AC-8 (earlier slice): GIVEN der User hat einen Prompt eingegeben und ein Modell gewaehlt
   * WHEN der User Cmd/Ctrl+Enter drueckt
   * THEN wird die generateImages Server Action aufgerufen
   */
  it("should call generateImages when user presses Cmd/Ctrl+Enter in prompt textarea", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    const textarea = screen.getByTestId("prompt-motiv-textarea");

    // Type a prompt
    await user.type(textarea, "A beautiful sunset");

    // Press Ctrl+Enter
    await user.keyboard("{Control>}{Enter}{/Control}");

    // generateImages should be called with the correct arguments
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          promptMotiv: "A beautiful sunset",
          modelIds: ["black-forest-labs/flux-schnell"],
          count: 1,
        })
      );
    });
  });

  /**
   * AC-9 (earlier slice): GIVEN der User hat einen Prompt eingegeben
   * WHEN der User auf den Generate-Button klickt
   * THEN wird die generateImages Server Action aufgerufen und der Button zeigt einen Loading-Spinner
   */
  it("should call generateImages and show loading spinner when generate button is clicked", async () => {
    // Make generateImages hang to observe loading state
    let resolveGenerate!: (v: unknown) => void;
    mockGenerateImages.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve;
        })
    );

    const user = userEvent.setup();
    await renderPromptArea();

    const textarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(textarea, "A cat in space");

    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // generateImages should be called with structured fields
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          promptMotiv: "A cat in space",
          modelIds: ["black-forest-labs/flux-schnell"],
          count: 1,
        })
      );
    });

    // Button should show loading state (Loader2 icon rendered + "Generating..." text)
    await waitFor(() => {
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      expect(screen.getByText("Generating...")).toBeInTheDocument();
    });

    // Resolve to clean up
    await act(async () => {
      resolveGenerate([]);
    });
  });

  /**
   * AC-10 (earlier slice): GIVEN der Generate-Button wurde geklickt und die Action laeuft
   * WHEN der User im Prompt-Feld weiter tippt
   * THEN bleibt das Prompt-Feld editierbar (nicht disabled)
   */
  it("should keep prompt textarea editable while generation is in progress", async () => {
    // Make generateImages hang
    mockGenerateImages.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const user = userEvent.setup();
    await renderPromptArea();

    const textarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(textarea, "Initial prompt");

    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    // Wait for generation to start
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalled();
    });

    // Textarea should NOT be disabled
    expect(textarea).not.toBeDisabled();

    // User can continue typing
    await user.type(textarea, " more text");
    expect(textarea).toHaveValue("Initial prompt more text");
  });

  /**
   * AC-11 (earlier slice): GIVEN der Variant-Count Selector ist sichtbar
   * WHEN der User den Wert auf 3 setzt
   * THEN wird bei der naechsten Generation count: 3 an generateImages uebergeben
   */
  it("should pass selected variant count to generateImages action", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    // Click variant count 3 button
    const variant3Btn = screen.getByTestId("variant-count-3");
    await user.click(variant3Btn);

    // Type a prompt and generate
    const textarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(textarea, "A landscape");

    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 3,
        })
      );
    });
  });

  /**
   * AC-12 (earlier slice): GIVEN der Variant-Count Selector
   * WHEN er initial gerendert wird
   * THEN ist der Default-Wert 1 und die auswaehlbaren Werte sind 1, 2, 3, 4
   */
  it("should render variant-count selector with default 1 and options 1-4", async () => {
    await renderPromptArea();

    const selector = screen.getByTestId("variant-count-selector");
    expect(selector).toBeInTheDocument();

    // All 4 options should be present with correct text
    expect(screen.getByTestId("variant-count-1")).toHaveTextContent("1");
    expect(screen.getByTestId("variant-count-2")).toHaveTextContent("2");
    expect(screen.getByTestId("variant-count-3")).toHaveTextContent("3");
    expect(screen.getByTestId("variant-count-4")).toHaveTextContent("4");
  });

  /**
   * AC-13 (earlier slice): GIVEN ein leeres Prompt-Feld
   * WHEN der User auf Generate klickt
   * THEN wird generateImages NICHT aufgerufen und der Generate-Button ist disabled
   */
  it("should not call generateImages when prompt is empty", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    const generateBtn = screen.getByTestId("generate-button");

    // Button should be disabled when motiv field is empty
    expect(generateBtn).toBeDisabled();

    // Click generate with empty prompt (disabled buttons won't fire click, but verify no call)
    await user.click(generateBtn);

    // generateImages should NOT be called
    expect(mockGenerateImages).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Multi-Mode img2img/upscale Tests (from origin/master Slice 14)
  // =========================================================================

  // -------------------------------------------------------------------------
  // AC-1: txt2img Default — ModeSelector active, Dropzone/Slider not in DOM,
  //        Button "Generate"
  // -------------------------------------------------------------------------
  it("AC-1: should render txt2img mode by default with ModeSelector, prompt fields and Generate button", async () => {
    /**
     * AC-1: GIVEN PromptArea in standard state (no WorkspaceState set)
     *       WHEN the component renders
     *       THEN ModeSelector is visible at top with active segment "txt2img";
     *            ImageDropzone and StrengthSlider are NOT in the DOM;
     *            prompt fields, Model-Selector, Variants and button with label "Generate" are visible
     */
    await renderPromptArea();

    // ModeSelector is visible
    const modeSelector = screen.getByTestId("mode-selector");
    expect(modeSelector).toBeInTheDocument();

    // "Text to Image" segment is active
    const txt2imgSegment = screen.getByText("Text to Image");
    expect(txt2imgSegment).toHaveAttribute("data-active", "true");

    // ImageDropzone is NOT in DOM
    expect(screen.queryByTestId("image-dropzone")).not.toBeInTheDocument();

    // StrengthSlider is NOT in DOM (check for "Strength" label)
    expect(screen.queryByLabelText("Strength")).not.toBeInTheDocument();

    // Prompt fields are visible
    expect(screen.getByTestId("prompt-motiv-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-style-textarea")).toBeInTheDocument();

    // Model selector is visible (model-trigger in model-cards architecture)
    expect(screen.getByTestId("model-trigger")).toBeInTheDocument();

    // Variant count selector is visible
    expect(screen.getByTestId("variant-count-selector")).toBeInTheDocument();

    // Generate button with label "Generate"
    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeInTheDocument();
    expect(generateBtn).toHaveTextContent("Generate");
  });

  // -------------------------------------------------------------------------
  // AC-2: Switch to img2img — Dropzone + StrengthSlider appear, Prompt stays
  // -------------------------------------------------------------------------
  it("AC-2: should show ImageDropzone and StrengthSlider when switching to img2img mode", async () => {
    /**
     * AC-2: GIVEN PromptArea in txt2img mode
     *       WHEN user clicks on "Image to Image" segment
     *       THEN ModeSelector switches to active segment "img2img";
     *            ImageDropzone and StrengthSlider appear in the DOM;
     *            prompt fields, Model-Selector, Variants and button "Generate" remain visible
     */
    const user = userEvent.setup();
    // Use resolver that supports img2img for sdxl (AC-12 auto-switch happens)
    await renderPromptArea(createModelSchemaResolver());

    // Click "Image to Image" segment
    await clickModeSegment(user, "Image to Image");

    // Wait for mode switch to complete (including potential model auto-switch)
    await waitFor(() => {
      // ImageDropzone should appear
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // StrengthSlider should appear (look for the "Strength" text)
    expect(screen.getByText("Strength")).toBeInTheDocument();

    // Prompt fields remain visible
    expect(screen.getByTestId("prompt-motiv-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-style-textarea")).toBeInTheDocument();

    // Model selector remains visible (model-trigger in model-cards architecture)
    expect(screen.getByTestId("model-trigger")).toBeInTheDocument();

    // Variant count remains visible
    expect(screen.getByTestId("variant-count-selector")).toBeInTheDocument();

    // Button still says "Generate"
    expect(screen.getByTestId("generate-button")).toHaveTextContent("Generate");
  });

  // -------------------------------------------------------------------------
  // AC-3: Switch to upscale — only Dropzone, Prompt/Model/Variants hidden,
  //        Button "Upscale"
  // -------------------------------------------------------------------------
  it("AC-3: should show only ImageDropzone and Upscale button when switching to upscale mode", async () => {
    /**
     * AC-3: GIVEN PromptArea in txt2img mode
     *       WHEN user clicks on "Upscale" segment
     *       THEN ModeSelector switches to active segment "upscale";
     *            ImageDropzone appears;
     *            prompt fields, StrengthSlider, Model-Selector and Variants are NOT in DOM;
     *            button label is "Upscale"
     */
    const user = userEvent.setup();
    await renderPromptArea();

    // Click "Upscale" segment
    await clickModeSegment(user, "Upscale");

    await waitFor(() => {
      // ImageDropzone should appear
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Prompt fields are NOT in DOM
    expect(screen.queryByTestId("prompt-motiv-textarea")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prompt-style-textarea")).not.toBeInTheDocument();

    // StrengthSlider is NOT in DOM
    expect(screen.queryByText("Strength")).not.toBeInTheDocument();

    // Model selector is NOT in DOM (model-trigger hidden in upscale)
    expect(screen.queryByTestId("model-trigger")).not.toBeInTheDocument();

    // Variant count is NOT in DOM
    expect(screen.queryByTestId("variant-count-selector")).not.toBeInTheDocument();

    // Button label is "Upscale"
    const upscaleBtn = screen.getByTestId("generate-button");
    expect(upscaleBtn).toHaveTextContent("Upscale");
  });

  // -------------------------------------------------------------------------
  // AC-4: State Persistence — Prompt survives mode switch
  //        txt2img -> img2img (type "sunset landscape") -> txt2img -> img2img
  // -------------------------------------------------------------------------
  it("AC-4: should restore prompt motiv after switching modes away and back to img2img", async () => {
    /**
     * AC-4: GIVEN PromptArea in img2img mode with entered prompt motiv "sunset landscape"
     *       WHEN user clicks "Text to Image" and then back to "Image to Image"
     *       THEN the prompt motiv field is populated with "sunset landscape" again (State Persistence)
     */
    const user = userEvent.setup();
    await renderPromptArea(createModelSchemaResolver());

    // Switch to img2img
    await clickModeSegment(user, "Image to Image");
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Type prompt in img2img mode
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "sunset landscape");
    expect(motivTextarea).toHaveValue("sunset landscape");

    // Switch to txt2img — prompt is "kept" (txt2img <-> img2img keeps prompt)
    await clickModeSegment(user, "Text to Image");
    await waitFor(() => {
      expect(screen.queryByTestId("image-dropzone")).not.toBeInTheDocument();
    });

    // The prompt should still show because txt2img <-> img2img "Keep" behavior
    const motivAfterSwitch = screen.getByTestId("prompt-motiv-textarea");
    expect(motivAfterSwitch).toHaveValue("sunset landscape");

    // Switch back to img2img
    await clickModeSegment(user, "Image to Image");
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Prompt should still be "sunset landscape"
    const motivRestored = screen.getByTestId("prompt-motiv-textarea");
    expect(motivRestored).toHaveValue("sunset landscape");
  });

  // -------------------------------------------------------------------------
  // AC-5: State Persistence Restore — txt2img prompt restored from upscale
  // -------------------------------------------------------------------------
  it("AC-5: should restore txt2img prompt when switching from upscale back to txt2img", async () => {
    /**
     * AC-5: GIVEN PromptArea in upscale mode with prompt motiv "ocean waves" stored in txt2img state
     *       WHEN user clicks "Text to Image"
     *       THEN the prompt motiv field is populated with "ocean waves" (Restore from txt2img state)
     */
    const user = userEvent.setup();
    await renderPromptArea();

    // Type prompt in txt2img mode
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "ocean waves");
    expect(motivTextarea).toHaveValue("ocean waves");

    // Switch to upscale (prompt fields disappear)
    await clickModeSegment(user, "Upscale");
    await waitFor(() => {
      expect(screen.queryByTestId("prompt-motiv-textarea")).not.toBeInTheDocument();
    });

    // Switch back to txt2img
    await clickModeSegment(user, "Text to Image");
    await waitFor(() => {
      expect(screen.getByTestId("prompt-motiv-textarea")).toBeInTheDocument();
    });

    // Prompt should be restored to "ocean waves"
    const motivRestored = screen.getByTestId("prompt-motiv-textarea");
    expect(motivRestored).toHaveValue("ocean waves");
  });

  // -------------------------------------------------------------------------
  // AC-6: Source-Image Transfer — img2img sourceImageUrl survives mode switch
  // -------------------------------------------------------------------------
  it("AC-6: should transfer and restore sourceImageUrl when switching between img2img and upscale modes", async () => {
    /**
     * AC-6: GIVEN PromptArea in img2img mode with sourceImageUrl "https://r2.example.com/sources/p1/img.png"
     *       WHEN user clicks "Upscale" and then back to "Image to Image"
     *       THEN ImageDropzone is rendered with initialUrl="https://r2.example.com/sources/p1/img.png"
     *            (Source-Image-Transfer and Restore)
     */
    const user = userEvent.setup();

    // Use variation data to pre-fill img2img with a sourceImageUrl
    // modelId uses owner/name format matching CollectionModel architecture
    mockVariationData = {
      promptMotiv: "test",
      modelId: "stability-ai/sdxl",
      modelParams: {},
      targetMode: "img2img",
      sourceImageUrl: "https://r2.example.com/sources/p1/img.png",
    };

    await renderPromptArea(createModelSchemaResolver());

    // Wait for variation to be consumed and mode to switch
    await waitFor(() => {
      expect(mockClearVariation).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // The dropzone should show a preview state (initialUrl was set)
    const dropzone = screen.getByTestId("image-dropzone");
    expect(dropzone).toHaveAttribute("data-state", "preview");

    // Switch to upscale — sourceImageUrl should transfer
    await clickModeSegment(user, "Upscale");
    await waitFor(() => {
      // Still showing dropzone in upscale mode
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Switch back to img2img
    await clickModeSegment(user, "Image to Image");
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // The dropzone should still be in preview state with the original image
    const restoredDropzone = screen.getByTestId("image-dropzone");
    expect(restoredDropzone).toHaveAttribute("data-state", "preview");
  });

  // -------------------------------------------------------------------------
  // AC-7: Cross-Mode WorkspaceState — targetMode "img2img" sets mode,
  //        sourceImage and prompt
  // -------------------------------------------------------------------------
  it("AC-7: should switch to img2img mode and prefill sourceImageUrl and prompt from WorkspaceVariationState", async () => {
    /**
     * AC-7: GIVEN PromptArea in txt2img mode and useWorkspaceVariation returns
     *       { targetMode: "img2img", sourceImageUrl: "https://r2.example.com/sources/p1/abc.png",
     *         promptMotiv: "lighthouse", modelId: "stability-ai/sdxl" }
     *       WHEN WorkspaceVariationState changes (Cross-Mode from Lightbox)
     *       THEN mode switches to "img2img"; ImageDropzone is rendered with
     *            initialUrl="https://r2.example.com/sources/p1/abc.png";
     *            prompt motiv field shows "lighthouse"
     */
    mockVariationData = {
      promptMotiv: "lighthouse",
      modelId: "stability-ai/sdxl",
      modelParams: {},
      targetMode: "img2img",
      sourceImageUrl: "https://r2.example.com/sources/p1/abc.png",
    };

    await renderPromptArea(createModelSchemaResolver());

    // Wait for variation to be consumed
    await waitFor(() => {
      expect(mockClearVariation).toHaveBeenCalled();
    });

    // Mode should have switched to img2img
    await waitFor(() => {
      const img2imgSegment = screen.getByText("Image to Image");
      expect(img2imgSegment).toHaveAttribute("data-active", "true");
    });

    // ImageDropzone should be present with source image (preview state)
    await waitFor(() => {
      const dropzone = screen.getByTestId("image-dropzone");
      expect(dropzone).toBeInTheDocument();
      expect(dropzone).toHaveAttribute("data-state", "preview");
    });

    // Prompt motiv should be "lighthouse"
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    expect(motivTextarea).toHaveValue("lighthouse");
  });

  // -------------------------------------------------------------------------
  // AC-8: Generate disabled without source image in img2img
  // -------------------------------------------------------------------------
  it("AC-8: should not call generateImages when Generate button is clicked without source image in img2img mode", async () => {
    /**
     * AC-8: GIVEN PromptArea in img2img mode without source image (ImageDropzone in empty state)
     *       WHEN user clicks the Generate button
     *       THEN generateImages is NOT called; button remains disabled (no source image)
     */
    const user = userEvent.setup();
    await renderPromptArea(createModelSchemaResolver());

    // Switch to img2img
    await clickModeSegment(user, "Image to Image");
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Type a prompt motiv (so only sourceImageUrl is missing)
    const motivTextarea = screen.getByTestId("prompt-motiv-textarea");
    await user.type(motivTextarea, "test prompt");

    // Generate button should be disabled (no source image)
    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeDisabled();

    // Attempt click (disabled button won't fire)
    await user.click(generateBtn);

    // generateImages should NOT have been called
    expect(mockGenerateImages).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-9: generateImages called with correct img2img parameters
  // -------------------------------------------------------------------------
  it("AC-9: should call generateImages with generationMode img2img, sourceImageUrl and strength", async () => {
    /**
     * AC-9: GIVEN PromptArea in img2img mode with source image
     *       "https://r2.example.com/sources/p1/img.png" and prompt motiv "sunset", strength 0.6
     *       WHEN user clicks "Generate"
     *       THEN generateImages is called once with generationMode: "img2img",
     *            sourceImageUrl: "https://r2.example.com/sources/p1/img.png" and strength: 0.6
     */
    // Pre-fill img2img with source image using variation
    mockVariationData = {
      promptMotiv: "sunset",
      modelId: "stability-ai/sdxl",
      modelParams: {},
      targetMode: "img2img",
      sourceImageUrl: "https://r2.example.com/sources/p1/img.png",
      strength: 0.6,
    };

    const user = userEvent.setup();
    await renderPromptArea(createModelSchemaResolver());

    // Wait for variation to be consumed
    await waitFor(() => {
      expect(mockClearVariation).toHaveBeenCalled();
    });

    // Wait for img2img mode
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Verify prompt is prefilled
    expect(screen.getByTestId("prompt-motiv-textarea")).toHaveValue("sunset");

    // Click Generate
    const generateBtn = screen.getByTestId("generate-button");
    // The button should be enabled since we have source image + prompt
    await waitFor(() => {
      expect(generateBtn).not.toBeDisabled();
    });
    await user.click(generateBtn);

    // generateImages should be called with img2img params
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1);
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "img2img",
          sourceImageUrl: "https://r2.example.com/sources/p1/img.png",
          strength: 0.6,
          promptMotiv: "sunset",
          projectId: "proj-1",
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-10: upscaleImage called with sourceImageUrl and scale 2
  // -------------------------------------------------------------------------
  it("AC-10: should call upscaleImage with sourceImageUrl and scale 2 in upscale mode", async () => {
    /**
     * AC-10: GIVEN PromptArea in upscale mode with source image
     *        "https://r2.example.com/sources/p1/img.png" and scale 2x (default)
     *        WHEN user clicks "Upscale"
     *        THEN upscaleImage is called once with sourceImageUrl:
     *             "https://r2.example.com/sources/p1/img.png" and scale: 2
     */
    // Pre-fill upscale with source image via variation
    mockVariationData = {
      promptMotiv: "",
      modelId: "black-forest-labs/flux-schnell",
      modelParams: {},
      targetMode: "upscale",
      sourceImageUrl: "https://r2.example.com/sources/p1/img.png",
    };

    const user = userEvent.setup();
    await renderPromptArea(schemaTxt2ImgOnly, { skipModelTriggerWait: true });

    // Wait for variation to be consumed
    await waitFor(() => {
      expect(mockClearVariation).toHaveBeenCalled();
    });

    // Wait for upscale mode — use data-value attribute to disambiguate from the button
    await waitFor(() => {
      const modeSelector = screen.getByTestId("mode-selector");
      const upscaleSegment = modeSelector.querySelector('[data-value="upscale"]');
      expect(upscaleSegment).toHaveAttribute("data-active", "true");
    });

    // The dropzone should show the source image
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "preview");
    });

    // Upscale button should be enabled
    const upscaleBtn = screen.getByTestId("generate-button");
    expect(upscaleBtn).toHaveTextContent("Upscale");
    await waitFor(() => {
      expect(upscaleBtn).not.toBeDisabled();
    });

    // Click Upscale
    await user.click(upscaleBtn);

    // upscaleImage should be called with correct params
    await waitFor(() => {
      expect(mockUpscaleImage).toHaveBeenCalledTimes(1);
      expect(mockUpscaleImage).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          sourceImageUrl: "https://r2.example.com/sources/p1/img.png",
          scale: 2,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-11: Upscale disabled without source image
  // -------------------------------------------------------------------------
  it("AC-11: should not call upscaleImage when Upscale button is clicked without source image", async () => {
    /**
     * AC-11: GIVEN PromptArea in upscale mode without source image
     *        WHEN user clicks the "Upscale" button
     *        THEN upscaleImage is NOT called; button remains disabled
     */
    const user = userEvent.setup();
    await renderPromptArea();

    // Switch to upscale mode
    await clickModeSegment(user, "Upscale");
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
    });

    // Upscale button should be disabled (no source image)
    const upscaleBtn = screen.getByTestId("generate-button");
    expect(upscaleBtn).toHaveTextContent("Upscale");
    expect(upscaleBtn).toBeDisabled();

    // Attempt click
    await user.click(upscaleBtn);

    // upscaleImage should NOT have been called
    expect(mockUpscaleImage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-12: Model Auto-Switch for img2img with incompatible model
  // -------------------------------------------------------------------------
  it("AC-12: should auto-switch model and show toast when switching to img2img with incompatible current model", async () => {
    /**
     * AC-12: GIVEN PromptArea in txt2img mode with active model that does not support img2img
     *        WHEN user clicks "Image to Image"
     *        THEN automatically switches to first img2img-compatible model from MODELS;
     *             a toast "Model switched to {displayName} (supports img2img)" is shown
     */
    const user = userEvent.setup();
    // flux-schnell (default, selected first) does NOT have image param
    // sdxl DOES have image param
    await renderPromptArea(createModelSchemaResolver());

    // Verify we start with flux-schnell (default, first CollectionModel)
    // Now switch to img2img
    await clickModeSegment(user, "Image to Image");

    // Wait for auto-switch to complete
    await waitFor(() => {
      // Toast should have been called with model switch message
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("Model switched to sdxl (supports img2img)")
      );
    });

    // ImageDropzone should be visible (we're in img2img)
    expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
  });

  // =========================================================================
  // Slice 11: Parameter Panel Multi-Model Notice
  // =========================================================================

  describe("Slice 11 — Parameter Panel Multi-Model Notice", () => {
    /**
     * AC-1: GIVEN `selectedModels` enthaelt genau 1 `CollectionModel`
     * WHEN die `prompt-area.tsx`-Komponente gerendert wird
     * THEN ist `ParameterPanel` im DOM sichtbar
     * AND der Variant-Count-Selektor ist im DOM sichtbar
     * AND der Text "Default parameters will be used for multi-model generation." ist NICHT im DOM
     */
    it("AC-1: should show parameter panel and variant count when exactly one model is selected", async () => {
      await renderPromptArea();

      // Initially selectedModels has 1 model (first from collection)
      const triggerItems = screen.getAllByTestId("model-trigger-item");
      expect(triggerItems).toHaveLength(1);

      // ParameterPanel should be in the DOM
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();

      // Variant-Count-Selektor should be in the DOM
      expect(screen.getByTestId("variant-count-selector")).toBeInTheDocument();

      // Multi-model notice should NOT be in the DOM
      expect(screen.queryByTestId("multi-model-notice")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Default parameters will be used for multi-model generation.")
      ).not.toBeInTheDocument();
    });

    /**
     * AC-2: GIVEN `selectedModels` enthaelt genau 2 `CollectionModel`-Eintraege
     * WHEN die `prompt-area.tsx`-Komponente gerendert wird
     * THEN ist `ParameterPanel` NICHT im DOM (nicht gerendert, nicht nur versteckt)
     * AND der Variant-Count-Selektor ist NICHT im DOM
     * AND der Text "Default parameters will be used for multi-model generation." ist im DOM sichtbar
     */
    it("AC-2: should hide parameter panel and variant count and show notice when two models are selected", async () => {
      await renderPromptArea();

      // Confirm 2 models via drawer
      const twoModels = [COLLECTION_MODELS[0], COLLECTION_MODELS[1]];
      await act(async () => {
        (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(twoModels);
      });

      // Wait for 2 model-trigger-items to appear
      await waitFor(() => {
        expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(2);
      });

      // ParameterPanel should NOT be in the DOM
      expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

      // Variant-Count-Selektor should NOT be in the DOM
      expect(screen.queryByTestId("variant-count-selector")).not.toBeInTheDocument();

      // Multi-model notice should be visible
      const notice = screen.getByTestId("multi-model-notice");
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(
        "Default parameters will be used for multi-model generation."
      );
    });

    /**
     * AC-3: GIVEN `selectedModels` enthaelt genau 3 `CollectionModel`-Eintraege
     * WHEN die `prompt-area.tsx`-Komponente gerendert wird
     * THEN ist `ParameterPanel` NICHT im DOM
     * AND der Variant-Count-Selektor ist NICHT im DOM
     * AND der Text "Default parameters will be used for multi-model generation." ist im DOM sichtbar
     */
    it("AC-3: should hide parameter panel and variant count and show notice when three models are selected", async () => {
      await renderPromptArea();

      // Confirm all 3 models via drawer
      const threeModels = [COLLECTION_MODELS[0], COLLECTION_MODELS[1], COLLECTION_MODELS[2]];
      await act(async () => {
        (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(threeModels);
      });

      // Wait for 3 model-trigger-items to appear
      await waitFor(() => {
        expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(3);
      });

      // ParameterPanel should NOT be in the DOM
      expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

      // Variant-Count-Selektor should NOT be in the DOM
      expect(screen.queryByTestId("variant-count-selector")).not.toBeInTheDocument();

      // Multi-model notice should be visible
      const notice = screen.getByTestId("multi-model-notice");
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(
        "Default parameters will be used for multi-model generation."
      );
    });

    /**
     * AC-4: GIVEN `selectedModels` hat 1 Eintrag und der Nutzer bestaetigt im Drawer 2 Models (`onConfirm([model1, model2])`)
     * WHEN `selectedModels` auf `[model1, model2]` aktualisiert wird
     * THEN verschwindet `ParameterPanel` aus dem DOM
     * AND der Notice-Text "Default parameters will be used for multi-model generation." erscheint im DOM
     */
    it("AC-4: should hide parameter panel and show notice when selection changes from one to two models", async () => {
      await renderPromptArea();

      // Verify initial state: 1 model, panel visible, no notice
      expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(1);
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();
      expect(screen.getByTestId("variant-count-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("multi-model-notice")).not.toBeInTheDocument();

      // Simulate drawer confirm with 2 models
      const twoModels = [COLLECTION_MODELS[0], COLLECTION_MODELS[1]];
      await act(async () => {
        (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(twoModels);
      });

      // Wait for 2 model-trigger-items
      await waitFor(() => {
        expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(2);
      });

      // ParameterPanel should have disappeared from the DOM
      expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();

      // Variant-Count-Selektor should have disappeared
      expect(screen.queryByTestId("variant-count-selector")).not.toBeInTheDocument();

      // Notice text should have appeared
      const notice = screen.getByTestId("multi-model-notice");
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(
        "Default parameters will be used for multi-model generation."
      );
    });

    /**
     * AC-5: GIVEN `selectedModels` hat 2 Eintraege und der Nutzer entfernt 1 Model via X-Button (`onRemove`)
     * WHEN `selectedModels` auf `[model1]` aktualisiert wird
     * THEN erscheint `ParameterPanel` wieder im DOM
     * AND der Notice-Text "Default parameters will be used for multi-model generation." verschwindet aus dem DOM
     */
    it("AC-5: should show parameter panel and hide notice when selection reduces back to one model", async () => {
      const user = userEvent.setup();
      await renderPromptArea();

      // First switch to 2 models
      const twoModels = [COLLECTION_MODELS[0], COLLECTION_MODELS[1]];
      await act(async () => {
        (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(twoModels);
      });

      // Wait for multi-model state
      await waitFor(() => {
        expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(2);
      });

      // Verify multi-model state: notice visible, no panel
      expect(screen.queryByTestId("parameter-panel")).not.toBeInTheDocument();
      expect(screen.getByTestId("multi-model-notice")).toBeInTheDocument();

      // Click X-button on one of the models to remove it (X-buttons visible when > 1 model)
      const removeButtons = screen.getAllByTestId("model-trigger-remove");
      expect(removeButtons.length).toBeGreaterThanOrEqual(1);
      await user.click(removeButtons[0]);

      // Wait for single-model state (1 model remaining)
      await waitFor(() => {
        expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(1);
      });

      // Wait for schema to load for the remaining model
      await waitFor(() => {
        expect(
          screen.queryByTestId("parameter-panel-loading")
        ).not.toBeInTheDocument();
      });

      // ParameterPanel should reappear
      expect(screen.getByTestId("parameter-panel")).toBeInTheDocument();

      // Variant-Count-Selektor should reappear
      expect(screen.getByTestId("variant-count-selector")).toBeInTheDocument();

      // Notice text should have disappeared
      expect(screen.queryByTestId("multi-model-notice")).not.toBeInTheDocument();
    });

    /**
     * AC-6: GIVEN `selectedModels` enthaelt 2 oder mehr Models
     * WHEN `generateImages` aufgerufen wird (Generate-Button klick)
     * THEN wird `params` als leeres Objekt `{}` uebergeben (Default-Params, da kein Panel aktiv)
     * AND `count` wird als `1` uebergeben (fester Wert bei Multi-Model)
     */
    it("AC-6: should pass empty params and count 1 to generateImages when multiple models are selected", async () => {
      const user = userEvent.setup();
      await renderPromptArea();

      // Type a prompt first (needed for generate to fire)
      const textarea = screen.getByTestId("prompt-motiv-textarea");
      await user.type(textarea, "A test prompt");

      // Switch to 2 models via drawer confirm
      const twoModels = [COLLECTION_MODELS[0], COLLECTION_MODELS[1]];
      await act(async () => {
        (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(twoModels);
      });

      // Wait for multi-model state
      await waitFor(() => {
        expect(screen.getAllByTestId("model-trigger-item")).toHaveLength(2);
      });

      // Click generate button
      const generateBtn = screen.getByTestId("generate-button");
      await user.click(generateBtn);

      // Verify generateImages was called with params: {} and count: 1
      await waitFor(() => {
        expect(mockGenerateImages).toHaveBeenCalledWith(
          expect.objectContaining({
            projectId: "proj-1",
            promptMotiv: "A test prompt",
            params: {},
            count: 1,
          })
        );
      });
    });
  });
});
