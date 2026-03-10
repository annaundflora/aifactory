// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";

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
const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Mock MODELS registry — model-1 does NOT support img2img (no image param),
// model-2 DOES support img2img (has image param in schema).
vi.mock("@/lib/models", () => ({
  MODELS: [
    { id: "model-1", displayName: "FLUX 2 Pro", pricePerImage: 0.055 },
    { id: "model-2", displayName: "Nano Banana 2", pricePerImage: 0 },
  ],
  getModelById: (id: string) => {
    const models: Record<
      string,
      { id: string; displayName: string; pricePerImage: number }
    > = {
      "model-1": {
        id: "model-1",
        displayName: "FLUX 2 Pro",
        pricePerImage: 0.055,
      },
      "model-2": {
        id: "model-2",
        displayName: "Nano Banana 2",
        pricePerImage: 0,
      },
    };
    return models[id] ?? undefined;
  },
}));

// Mock getModelSchema server action
const mockGetModelSchema = vi.fn();
vi.mock("@/app/actions/models", () => ({
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
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
}));

// Mock BuilderDrawer (external component, not under test here)
vi.mock("@/components/prompt-builder/builder-drawer", () => ({
  BuilderDrawer: () => null,
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

// Import AFTER mocks
import { PromptArea } from "@/components/workspace/prompt-area";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Schema WITHOUT image input params (txt2img only, no img2img support) */
const schemaTxt2ImgOnly = {
  properties: {
    prompt: { type: "string" },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "9:16"],
      default: "1:1",
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

/**
 * Returns a schema resolver that returns schemaTxt2ImgOnly for model-1
 * and schemaWithImg2Img for model-2. This simulates model-1 not supporting
 * img2img and model-2 supporting it.
 */
function createModelSchemaResolver() {
  return (args: { modelId: string }) => {
    if (args.modelId === "model-2") {
      return Promise.resolve(schemaWithImg2Img);
    }
    return Promise.resolve(schemaTxt2ImgOnly);
  };
}

async function renderPromptArea(
  schemaOrResolver:
    | typeof schemaTxt2ImgOnly
    | ((args: { modelId: string }) => Promise<typeof schemaTxt2ImgOnly>) = schemaTxt2ImgOnly
) {
  if (typeof schemaOrResolver === "function") {
    mockGetModelSchema.mockImplementation(schemaOrResolver);
  } else {
    mockGetModelSchema.mockResolvedValue(schemaOrResolver);
  }
  const result = render(<PromptArea projectId="proj-1" />);
  // Wait for initial schema load to complete
  await waitFor(() => {
    expect(mockGetModelSchema).toHaveBeenCalled();
  });
  // Wait for loading state to clear
  await waitFor(() => {
    expect(
      screen.queryByTestId("parameter-panel-loading")
    ).not.toBeInTheDocument();
  });
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
    mockGetModelSchema.mockResolvedValue(schemaTxt2ImgOnly);
    mockGenerateImages.mockResolvedValue([]);
    mockUpscaleImage.mockResolvedValue({ id: "gen-1" });
    mockVariationData = null;
    mockToast.mockClear();
  });

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

    // Model selector is visible
    expect(screen.getByTestId("model-select")).toBeInTheDocument();

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
    // Use resolver that supports img2img for model-2 (AC-12 auto-switch happens)
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

    // Model selector remains visible
    expect(screen.getByTestId("model-select")).toBeInTheDocument();

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

    // Model selector is NOT in DOM
    expect(screen.queryByTestId("model-select")).not.toBeInTheDocument();

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
    mockVariationData = {
      promptMotiv: "test",
      modelId: "model-2",
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
     *         promptMotiv: "lighthouse", modelId: "flux-pro" }
     *       WHEN WorkspaceVariationState changes (Cross-Mode from Lightbox)
     *       THEN mode switches to "img2img"; ImageDropzone is rendered with
     *            initialUrl="https://r2.example.com/sources/p1/abc.png";
     *            prompt motiv field shows "lighthouse"
     */
    mockVariationData = {
      promptMotiv: "lighthouse",
      modelId: "model-2",
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
      modelId: "model-2",
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
      modelId: "model-1",
      modelParams: {},
      targetMode: "upscale",
      sourceImageUrl: "https://r2.example.com/sources/p1/img.png",
    };

    const user = userEvent.setup();
    await renderPromptArea();

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
    // model-1 (default, selected first) does NOT have image param
    // model-2 DOES have image param
    await renderPromptArea(createModelSchemaResolver());

    // Verify we start with model-1 (default)
    // Now switch to img2img
    await clickModeSegment(user, "Image to Image");

    // Wait for auto-switch to complete
    await waitFor(() => {
      // Toast should have been called with model switch message
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("Model switched to Nano Banana 2 (supports img2img)")
      );
    });

    // ImageDropzone should be visible (we're in img2img)
    expect(screen.getByTestId("image-dropzone")).toBeInTheDocument();
  });
});
