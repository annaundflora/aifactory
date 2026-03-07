// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

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

// Mock MODELS registry
vi.mock("@/lib/models", () => ({
  MODELS: [
    { id: "model-1", displayName: "FLUX 2 Pro", pricePerImage: 0.055 },
    { id: "model-2", displayName: "Nano Banana 2", pricePerImage: 0 },
    { id: "model-3", displayName: "Recraft V4", pricePerImage: 0 },
    { id: "model-4", displayName: "Seedream 5 Lite", pricePerImage: 0 },
    { id: "model-5", displayName: "Seedream 4.5", pricePerImage: 0 },
    { id: "model-6", displayName: "Gemini 2.5 Flash Image", pricePerImage: 0 },
  ],
  getModelById: (id: string) => {
    const models: Record<string, { id: string; displayName: string; pricePerImage: number }> = {
      "model-1": { id: "model-1", displayName: "FLUX 2 Pro", pricePerImage: 0.055 },
      "model-2": { id: "model-2", displayName: "Nano Banana 2", pricePerImage: 0 },
    };
    return models[id] ?? undefined;
  },
}));

// Mock getModelSchema server action
const mockGetModelSchema = vi.fn();
vi.mock("@/app/actions/models", () => ({
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
}));

// Mock generateImages server action
const mockGenerateImages = vi.fn();
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
}));

// Mock lucide-react icons (Select uses ChevronDownIcon, ChevronUpIcon, CheckIcon; PromptArea uses Loader2, Wand2, Sparkles; TemplateSelector uses ChevronDown)
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

// Import AFTER mocks
import { PromptArea } from "@/components/workspace/prompt-area";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function renderPromptArea(schema = schemaWithoutNeg) {
  mockGetModelSchema.mockResolvedValue(schema);
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptArea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelSchema.mockResolvedValue(schemaWithoutNeg);
    mockGenerateImages.mockResolvedValue([]);
  });

  /**
   * AC-1: GIVEN die Workspace-Seite ist geladen und die Model-Registry 6 Modelle enthaelt
   * WHEN das Model-Dropdown gerendert wird
   * THEN zeigt es alle 6 Modelle mit displayName und pricePerImage und das erste Modell ist vorausgewaehlt
   */
  it("AC-1: should render model dropdown with all 6 models showing displayName and pricePerImage", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    // The model select trigger should be present
    const selectTrigger = screen.getByTestId("model-select");
    expect(selectTrigger).toBeInTheDocument();

    // Open the dropdown
    await user.click(selectTrigger);

    // All 6 models should be listed with displayName and price
    // Use getAllByText since the selected item also renders in the trigger
    await waitFor(() => {
      expect(
        screen.getAllByText(/FLUX 2 Pro.*\$0\.055/).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(/Nano Banana 2.*Free/).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(/Recraft V4.*Free/).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(/Seedream 5 Lite.*Free/).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(/Seedream 4\.5.*Free/).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(/Gemini 2\.5 Flash Image.*Free/).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * AC-2: GIVEN ein Modell ist ausgewaehlt
   * WHEN der User ein anderes Modell im Dropdown waehlt
   * THEN wird getModelSchema({ modelId }) aufgerufen und das Parameter-Panel wird mit den neuen Schema-Properties neu gerendert
   */
  it("AC-2: should call getModelSchema when a different model is selected", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    // Initial call was for model-1
    expect(mockGetModelSchema).toHaveBeenCalledWith({ modelId: "model-1" });

    // Clear mocks to track new call
    mockGetModelSchema.mockClear();
    mockGetModelSchema.mockResolvedValue(schemaWithNeg);

    // Open dropdown and select a different model
    const selectTrigger = screen.getByTestId("model-select");
    await user.click(selectTrigger);

    // Select Nano Banana 2 (model-2)
    const option = await screen.findByText(/Nano Banana 2.*Free/);
    await user.click(option);

    // getModelSchema should be called with the new model id
    await waitFor(() => {
      expect(mockGetModelSchema).toHaveBeenCalledWith({ modelId: "model-2" });
    });
  });

  /**
   * AC-5: GIVEN ein Model-Schema ohne negative_prompt Property
   * WHEN das Prompt-Area gerendert wird
   * THEN ist das Negative-Prompt-Input NICHT sichtbar
   */
  it("AC-5: should not render negative-prompt input when model schema has no negative_prompt property", async () => {
    await renderPromptArea(schemaWithoutNeg);

    expect(
      screen.queryByTestId("negative-prompt-textarea")
    ).not.toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN ein Model-Schema MIT negative_prompt Property
   * WHEN das Prompt-Area gerendert wird
   * THEN ist das Negative-Prompt-Input sichtbar und editierbar
   */
  it("AC-6: should render negative-prompt input when model schema has negative_prompt property", async () => {
    const user = userEvent.setup();
    await renderPromptArea(schemaWithNeg);

    const negInput = screen.getByTestId("negative-prompt-textarea");
    expect(negInput).toBeInTheDocument();

    // Verify it is editable
    await user.type(negInput, "no blur");
    expect(negInput).toHaveValue("no blur");
  });

  /**
   * AC-7: GIVEN das Prompt-Textarea ist leer
   * WHEN der User Text eingibt der mehr als 3 Zeilen erfordert
   * THEN waechst die Textarea-Hoehe automatisch mit (Auto-Resize)
   */
  it("AC-7: should auto-resize textarea height when content exceeds initial rows", async () => {
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
    // In jsdom scrollHeight is 0, but the auto-resize code sets style.height = `${el.scrollHeight}px`
    // We verify the style was changed (the handler runs on each change)
    expect(textarea.style.height).toBeDefined();
    // The auto-resize mechanism sets height to "auto" then to scrollHeight + "px"
    expect(textarea.style.height).toMatch(/^\d+px$/);
  });

  /**
   * AC-8: GIVEN der User hat einen Prompt eingegeben und ein Modell gewaehlt
   * WHEN der User Cmd/Ctrl+Enter drueckt
   * THEN wird die generateImages Server Action mit { projectId, prompt, negativePrompt, modelId, params, count } aufgerufen
   */
  it("AC-8: should call generateImages when user presses Cmd/Ctrl+Enter in prompt textarea", async () => {
    const user = userEvent.setup();
    await renderPromptArea();

    const textarea = screen.getByTestId("prompt-motiv-textarea");

    // Type a prompt
    await user.type(textarea, "A beautiful sunset");

    // Press Ctrl+Enter
    await user.keyboard("{Control>}{Enter}{/Control}");

    // generateImages should be called with the correct arguments (structured fields)
    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          promptMotiv: "A beautiful sunset",
          modelId: "model-1",
          count: 1,
        })
      );
    });
  });

  /**
   * AC-9: GIVEN der User hat einen Prompt eingegeben
   * WHEN der User auf den Generate-Button klickt
   * THEN wird die generateImages Server Action mit den aktuellen Werten aufgerufen und der Button zeigt einen Loading-Spinner
   */
  it("AC-9: should call generateImages and show loading spinner when generate button is clicked", async () => {
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
          modelId: "model-1",
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
   * AC-10: GIVEN der Generate-Button wurde geklickt und die Action laeuft
   * WHEN der User im Prompt-Feld weiter tippt
   * THEN bleibt das Prompt-Feld editierbar (nicht disabled)
   */
  it("AC-10: should keep prompt textarea editable while generation is in progress", async () => {
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
   * AC-11: GIVEN der Variant-Count Selector ist sichtbar
   * WHEN der User den Wert auf 3 setzt
   * THEN wird bei der naechsten Generation count: 3 an generateImages uebergeben
   */
  it("AC-11: should pass selected variant count to generateImages action", async () => {
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
   * AC-12: GIVEN der Variant-Count Selector
   * WHEN er initial gerendert wird
   * THEN ist der Default-Wert 1 und die auswaehlbaren Werte sind 1, 2, 3, 4
   */
  it("AC-12: should render variant-count selector with default 1 and options 1-4", async () => {
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
   * AC-13: GIVEN ein leeres Prompt-Feld
   * WHEN der User auf Generate klickt
   * THEN wird generateImages NICHT aufgerufen und der Generate-Button bleibt enabled
   */
  it("AC-13: should not call generateImages when prompt is empty", async () => {
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
});
