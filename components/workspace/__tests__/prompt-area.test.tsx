// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { type CollectionModel } from "@/lib/types/collection-model";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI needs ResizeObserver + pointer events)
// ---------------------------------------------------------------------------

beforeAll(() => {
  // ResizeObserver polyfill for Radix Slider
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // Radix Select needs pointer events
  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  // Radix Select needs scrollIntoView
  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock db/queries to prevent DATABASE_URL crash (type-only import in source)
vi.mock("@/lib/db/queries", () => ({}));

// Mock snippet-service to prevent DATABASE_URL crash (imports lib/db transitively)
vi.mock("@/lib/services/snippet-service", () => ({
  SnippetService: {
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue({}),
  },
}));

// Mock MODELS registry (no longer used for Select dropdown, but may be imported transitively)
vi.mock("@/lib/models", () => ({
  MODELS: [],
  getModelById: () => undefined,
}));

// Mock getModelSchema + getCollectionModels server actions
const mockGetModelSchema = vi.fn();
const mockGetCollectionModels = vi.fn();
vi.mock("@/app/actions/models", () => ({
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
  getCollectionModels: (...args: unknown[]) => mockGetCollectionModels(...args),
}));

// Mock generateImages server action
const mockGenerateImages = vi.fn();
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) => (
    <span data-testid="chevron-down" {...props} />
  ),
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="chevron-down-icon" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="chevron-up-icon" {...props} />
  ),
  CheckIcon: (props: Record<string, unknown>) => (
    <span data-testid="check-icon" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
  Wand2: (props: Record<string, unknown>) => (
    <span data-testid="wand-icon" {...props} />
  ),
  Sparkles: (props: Record<string, unknown>) => (
    <span data-testid="sparkles-icon" {...props} />
  ),
  X: (props: Record<string, unknown>) => (
    <span data-testid="x-icon" {...props} />
  ),
  Search: (props: Record<string, unknown>) => (
    <span data-testid="search-icon" {...props} />
  ),
  AlertCircle: (props: Record<string, unknown>) => (
    <span data-testid="alert-circle-icon" {...props} />
  ),
}));

// Mock BuilderDrawer (external component, not under test here)
vi.mock("@/components/prompt-builder/builder-drawer", () => ({
  BuilderDrawer: () => null,
}));

// Mock LLMComparison (external component, not under test here)
vi.mock("@/components/prompt-improve/llm-comparison", () => ({
  LLMComparison: () => null,
}));

// Mock workspace-state (PromptArea uses useWorkspaceVariation internally;
// variation-specific behaviour is tested in variation-flow.test.tsx)
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
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

const COLLECTION_MODELS: CollectionModel[] = [
  {
    url: "https://replicate.com/black-forest-labs/flux-schnell",
    owner: "black-forest-labs",
    name: "flux-schnell",
    description: "Fast model",
    cover_image_url: "https://example.com/flux.jpg",
    run_count: 5_000_000,
  },
  {
    url: "https://replicate.com/stability-ai/sdxl",
    owner: "stability-ai",
    name: "sdxl",
    description: "SDXL model",
    cover_image_url: "https://example.com/sdxl.jpg",
    run_count: 3_000_000,
  },
  {
    url: "https://replicate.com/stability-ai/sd-turbo",
    owner: "stability-ai",
    name: "sd-turbo",
    description: "Turbo model",
    cover_image_url: null,
    run_count: 1_000_000,
  },
];

/** Schema WITHOUT negative_prompt property */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders PromptArea with mocked collection models and schema.
 * Waits for getCollectionModels to be called and selectedModels to initialize.
 */
async function renderPromptArea(schema = schemaWithoutNeg) {
  mockGetModelSchema.mockResolvedValue(schema);
  const result = render(<PromptArea projectId="proj-1" />);
  // Wait for getCollectionModels to be called on mount
  await waitFor(() => {
    expect(mockGetCollectionModels).toHaveBeenCalled();
  });
  // Wait for model-trigger to appear (selectedModels initialized from collection)
  await waitFor(() => {
    expect(screen.getByTestId("model-trigger")).toBeInTheDocument();
  });
  // Wait for schema loading to complete
  await waitFor(() => {
    expect(
      screen.queryByTestId("parameter-panel-loading")
    ).not.toBeInTheDocument();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptArea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDrawerProps.current = {};
    mockGetCollectionModels.mockResolvedValue(COLLECTION_MODELS);
    mockGetModelSchema.mockResolvedValue(schemaWithoutNeg);
    mockGenerateImages.mockResolvedValue([]);
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
          modelId: "black-forest-labs/flux-schnell",
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
          modelId: "black-forest-labs/flux-schnell",
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
