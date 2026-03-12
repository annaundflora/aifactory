// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ModelTrigger } from "@/components/models/model-trigger";
import { type CollectionModel } from "@/lib/types/collection-model";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createModel(
  overrides: Partial<CollectionModel> = {},
): CollectionModel {
  return {
    url: "https://replicate.com/acme/test-model",
    owner: "acme",
    name: "test-model",
    description: "A short description.",
    cover_image_url: "https://example.com/cover.jpg",
    run_count: 1_000_000,
    created_at: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

const MODEL_A = createModel({
  owner: "black-forest-labs",
  name: "flux-schnell",
  cover_image_url: "https://example.com/flux.jpg",
});

const MODEL_B = createModel({
  owner: "stability-ai",
  name: "sdxl",
  cover_image_url: "https://example.com/sdxl.jpg",
});

// ---------------------------------------------------------------------------
// AC-1: ModelTrigger renders correct number of Mini-Cards
// ---------------------------------------------------------------------------

describe("AC-1: ModelTrigger renders correct number of Mini-Cards with Thumbnail, Name, Owner", () => {
  it("should render one mini-card per model with thumbnail, name and owner", () => {
    /**
     * AC-1: GIVEN `models` ist ein Array mit 2 `CollectionModel`-Eintraegen
     *       WHEN `ModelTrigger` gerendert wird
     *       THEN werden genau 2 Mini-Cards gerendert, jede mit Thumbnail (32x32-Container),
     *            `name` und `owner` des jeweiligen Models
     *       AND ein "Browse Models"-Link ist sichtbar
     */
    const onRemove = vi.fn();
    const onBrowse = vi.fn();

    render(
      <ModelTrigger
        models={[MODEL_A, MODEL_B]}
        onRemove={onRemove}
        onBrowse={onBrowse}
      />,
    );

    // Exactly 2 mini-cards rendered
    const items = screen.getAllByTestId("model-trigger-item");
    expect(items).toHaveLength(2);

    // First card: thumbnail, name, owner
    expect(screen.getByText("flux-schnell")).toBeInTheDocument();
    expect(screen.getByText("black-forest-labs")).toBeInTheDocument();
    const img1 = screen.getByAltText("flux-schnell cover");
    expect(img1).toHaveAttribute("src", "https://example.com/flux.jpg");
    // Thumbnail container is 32x32 (h-8 w-8)
    const thumbContainer1 = img1.closest("div");
    expect(thumbContainer1).toHaveClass("h-8", "w-8");

    // Second card: thumbnail, name, owner
    expect(screen.getByText("sdxl")).toBeInTheDocument();
    expect(screen.getByText("stability-ai")).toBeInTheDocument();
    const img2 = screen.getByAltText("sdxl cover");
    expect(img2).toHaveAttribute("src", "https://example.com/sdxl.jpg");

    // Browse Models link is visible
    const browseLink = screen.getByTestId("browse-models-link");
    expect(browseLink).toBeInTheDocument();
    expect(browseLink).toHaveTextContent("Browse Models");
  });
});

// ---------------------------------------------------------------------------
// AC-2: X-Button hidden when only 1 Model selected
// ---------------------------------------------------------------------------

describe("AC-2: X-Button hidden when only 1 Model selected", () => {
  it("should hide X button when only one model is in the list", () => {
    /**
     * AC-2: GIVEN `models` hat genau 1 Eintrag
     *       WHEN `ModelTrigger` gerendert wird
     *       THEN ist der X-Button dieser Mini-Card nicht sichtbar (oder disabled)
     *       AND der "Browse Models"-Link ist sichtbar
     */
    const onRemove = vi.fn();
    const onBrowse = vi.fn();

    render(
      <ModelTrigger
        models={[MODEL_A]}
        onRemove={onRemove}
        onBrowse={onBrowse}
      />,
    );

    // Only 1 mini-card
    const items = screen.getAllByTestId("model-trigger-item");
    expect(items).toHaveLength(1);

    // X-Button (remove) should NOT be in the DOM (min-1 enforcement)
    const removeButtons = screen.queryAllByTestId("model-trigger-remove");
    expect(removeButtons).toHaveLength(0);

    // Browse Models link is still visible
    expect(screen.getByTestId("browse-models-link")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: X-Button calls onRemove with correct Model
// ---------------------------------------------------------------------------

describe("AC-3: X-Button calls onRemove with correct Model", () => {
  it("should call onRemove with the correct model when X button is clicked", async () => {
    /**
     * AC-3: GIVEN `models` hat 2 Eintraege
     *       WHEN der Nutzer den X-Button der ersten Mini-Card klickt
     *       THEN wird `onRemove` mit dem `CollectionModel` der ersten Mini-Card aufgerufen
     *       AND die verbleibende Mini-Card zeigt keinen X-Button mehr
     */
    const onRemove = vi.fn();
    const onBrowse = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <ModelTrigger
        models={[MODEL_A, MODEL_B]}
        onRemove={onRemove}
        onBrowse={onBrowse}
      />,
    );

    // With 2 models, both X-Buttons should be visible
    const removeButtons = screen.getAllByTestId("model-trigger-remove");
    expect(removeButtons).toHaveLength(2);

    // Click X-button of first mini-card (flux-schnell)
    await user.click(removeButtons[0]);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(MODEL_A);

    // After removal: simulate parent re-render with only MODEL_B remaining
    rerender(
      <ModelTrigger
        models={[MODEL_B]}
        onRemove={onRemove}
        onBrowse={onBrowse}
      />,
    );

    // The remaining mini-card should NOT show X-Button (min-1 enforcement)
    const remainingRemoveButtons = screen.queryAllByTestId(
      "model-trigger-remove",
    );
    expect(remainingRemoveButtons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Browse Models link calls onBrowse
// ---------------------------------------------------------------------------

describe("AC-4: Browse Models link calls onBrowse", () => {
  it("should call onBrowse when browse models link is clicked", async () => {
    /**
     * AC-4: GIVEN `ModelTrigger` ist gerendert
     *       WHEN der Nutzer den "Browse Models"-Link klickt
     *       THEN wird `onBrowse` aufgerufen (einmalig)
     */
    const onRemove = vi.fn();
    const onBrowse = vi.fn();
    const user = userEvent.setup();

    render(
      <ModelTrigger
        models={[MODEL_A]}
        onRemove={onRemove}
        onBrowse={onBrowse}
      />,
    );

    const browseLink = screen.getByTestId("browse-models-link");
    await user.click(browseLink);

    expect(onBrowse).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// ACs 5-9: Prompt Area integration tests
// ===========================================================================

// We need a separate describe block with its own module-level mocks
// to test how PromptArea integrates with ModelTrigger + ModelBrowserDrawer
describe("PromptArea + ModelTrigger integration", () => {
  // -----------------------------------------------------------------------
  // Polyfills for jsdom (Radix UI needs ResizeObserver + pointer events)
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Module-level mocks — must be hoisted before dynamic import
  // -----------------------------------------------------------------------

  // We use vi.hoisted so mock handles are accessible in vi.mock factories
  const {
    mockGetCollectionModels,
    mockGetModelSchema,
    mockGenerateImages,
    capturedDrawerProps,
  } = vi.hoisted(() => ({
    mockGetCollectionModels: vi.fn(),
    mockGetModelSchema: vi.fn(),
    mockGenerateImages: vi.fn(),
    capturedDrawerProps: { current: {} as Record<string, unknown> },
  }));

  // Mock db/queries to prevent DATABASE_URL crash
  vi.mock("@/lib/db/queries", () => ({}));

  // Mock MODELS registry (no longer used for Select dropdown, but still imported transitively)
  vi.mock("@/lib/models", () => ({
    MODELS: [],
    getModelById: () => undefined,
  }));

  // Mock server actions
  vi.mock("@/app/actions/models", () => ({
    getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
    getCollectionModels: (...args: unknown[]) =>
      mockGetCollectionModels(...args),
  }));

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

  // Mock LLMComparison
  vi.mock("@/components/prompt-improve/llm-comparison", () => ({
    LLMComparison: () => null,
  }));

  // Mock workspace-state
  vi.mock("@/lib/workspace-state", () => ({
    useWorkspaceVariation: () => ({
      variationData: null,
      setVariation: vi.fn(),
      clearVariation: vi.fn(),
    }),
  }));

  // Mock ModelBrowserDrawer — capture onConfirm prop to invoke it in tests
  vi.mock("@/components/models/model-browser-drawer", () => ({
    ModelBrowserDrawer: (props: Record<string, unknown>) => {
      capturedDrawerProps.current = props;
      return <div data-testid="mock-model-browser-drawer" />;
    },
  }));

  // Import PromptArea AFTER mocks
   
  let PromptArea: typeof import("@/components/workspace/prompt-area").PromptArea;

  beforeAll(async () => {
    const mod = await import("@/components/workspace/prompt-area");
    PromptArea = mod.PromptArea;
  });

  // -----------------------------------------------------------------------
  // Fixtures
  // -----------------------------------------------------------------------

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

  const defaultSchema = {
    properties: {
      prompt: { type: "string" },
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9"],
        default: "1:1",
      },
    },
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  async function renderPromptArea() {
    const result = render(<PromptArea projectId="proj-test" />);
    // Wait for getCollectionModels to be called and state to settle
    await waitFor(() => {
      expect(mockGetCollectionModels).toHaveBeenCalled();
    });
    // Wait for model-trigger to appear (selectedModels initialized)
    await waitFor(() => {
      expect(screen.getByTestId("model-trigger")).toBeInTheDocument();
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------

  beforeEach(() => {
    vi.clearAllMocks();
    capturedDrawerProps.current = {};
    mockGetCollectionModels.mockResolvedValue(COLLECTION_MODELS);
    mockGetModelSchema.mockResolvedValue(defaultSchema);
    mockGenerateImages.mockResolvedValue([]);
  });

  // -----------------------------------------------------------------------
  // AC-5: prompt-area loads collection and initializes selectedModels[0]
  // -----------------------------------------------------------------------

  it("AC-5: should fetch collection models on mount and initialize selectedModels with first model", async () => {
    /**
     * AC-5: GIVEN `prompt-area.tsx` wird gerendert (Workspace offen)
     *       WHEN die Komponente mountet
     *       THEN wird `getCollectionModels()` aufgerufen
     *       AND `selectedModels` wird mit `[collectionModels[0]]` initialisiert (erstes Model aus der Collection)
     *       AND `ModelTrigger` zeigt dieses eine Model an
     */
    await renderPromptArea();

    // getCollectionModels was called on mount
    expect(mockGetCollectionModels).toHaveBeenCalledTimes(1);

    // ModelTrigger shows exactly 1 model (the first from collection)
    const triggerItems = screen.getAllByTestId("model-trigger-item");
    expect(triggerItems).toHaveLength(1);

    // The displayed model should be the first one (flux-schnell)
    expect(screen.getByText("flux-schnell")).toBeInTheDocument();
    expect(screen.getByText("black-forest-labs")).toBeInTheDocument();

    // getModelSchema was called with the derived modelId of the first model
    await waitFor(() => {
      expect(mockGetModelSchema).toHaveBeenCalledWith({
        modelId: "black-forest-labs/flux-schnell",
      });
    });
  });

  // -----------------------------------------------------------------------
  // AC-6: ParameterPanel and VariantCount visible when 1 model selected
  // -----------------------------------------------------------------------

  it("AC-6: should show parameter panel and variant count when exactly one model is selected", async () => {
    /**
     * AC-6: GIVEN `selectedModels.length === 1` in `prompt-area.tsx`
     *       WHEN die Prompt Area gerendert wird
     *       THEN ist das `ParameterPanel` sichtbar
     *       AND der Variant-Count-Selektor ist sichtbar
     *       AND der `<Select>`-Dropdown ist nicht im DOM
     */
    await renderPromptArea();

    // Wait for schema loading to complete so ParameterPanel renders content
    await waitFor(() => {
      expect(
        screen.queryByTestId("parameter-panel-loading"),
      ).not.toBeInTheDocument();
    });

    // ParameterPanel should be in the DOM (it renders with data-testid="parameter-panel" or we check for its wrapper)
    // The ParameterPanel component renders when isSingleModel === true
    // Check variant count selector is visible
    const variantSelector = screen.getByTestId("variant-count-selector");
    expect(variantSelector).toBeInTheDocument();

    // Verify all 4 variant options are present
    expect(screen.getByTestId("variant-count-1")).toBeInTheDocument();
    expect(screen.getByTestId("variant-count-2")).toBeInTheDocument();
    expect(screen.getByTestId("variant-count-3")).toBeInTheDocument();
    expect(screen.getByTestId("variant-count-4")).toBeInTheDocument();

    // The old Select dropdown should NOT be in the DOM
    expect(screen.queryByTestId("model-select")).not.toBeInTheDocument();

    // Multi-model notice should NOT be visible
    expect(screen.queryByTestId("multi-model-notice")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // AC-7: ParameterPanel and VariantCount hidden when > 1 model selected
  // -----------------------------------------------------------------------

  it("AC-7: should hide parameter panel and variant count and show multi-model notice when multiple models selected", async () => {
    /**
     * AC-7: GIVEN `selectedModels.length > 1` in `prompt-area.tsx`
     *       WHEN die Prompt Area gerendert wird
     *       THEN ist das `ParameterPanel` nicht sichtbar
     *       AND der Variant-Count-Selektor ist nicht sichtbar
     *       AND eine Hinweismeldung "Default parameters will be used for multi-model generation" ist sichtbar
     */
    await renderPromptArea();

    // Verify initial state: 1 model, variant selector visible
    expect(screen.getByTestId("variant-count-selector")).toBeInTheDocument();

    // Simulate drawer confirm with 2 models
    const twoModels = [COLLECTION_MODELS[0], COLLECTION_MODELS[1]];
    await act(async () => {
      (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(
        twoModels,
      );
    });

    // Wait for re-render with 2 models
    await waitFor(() => {
      const items = screen.getAllByTestId("model-trigger-item");
      expect(items).toHaveLength(2);
    });

    // ParameterPanel should NOT be visible (variant-count-selector is inside isSingleModel block)
    expect(
      screen.queryByTestId("variant-count-selector"),
    ).not.toBeInTheDocument();

    // Multi-model notice should be visible
    const notice = screen.getByTestId("multi-model-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      "Default parameters will be used for multi-model generation",
    );
  });

  // -----------------------------------------------------------------------
  // AC-8: onConfirm updates selectedModels in prompt-area state
  // -----------------------------------------------------------------------

  it("AC-8: should update selectedModels when drawer onConfirm is called", async () => {
    /**
     * AC-8: GIVEN der Nutzer ein Model im `ModelBrowserDrawer` bestaetigt (onConfirm aufgerufen)
     *       WHEN `onConfirm(newModels)` in `prompt-area.tsx` verarbeitet wird
     *       THEN ist `selectedModels` auf `newModels` gesetzt
     *       AND `ModelTrigger` zeigt die neu selektierten Models an
     */
    await renderPromptArea();

    // Initial: 1 model (first from collection)
    let items = screen.getAllByTestId("model-trigger-item");
    expect(items).toHaveLength(1);
    expect(screen.getByText("flux-schnell")).toBeInTheDocument();

    // Call onConfirm from the drawer mock with 2 new models
    const newModels = [COLLECTION_MODELS[1], COLLECTION_MODELS[2]];
    await act(async () => {
      (capturedDrawerProps.current.onConfirm as (models: CollectionModel[]) => void)(
        newModels,
      );
    });

    // Wait for ModelTrigger to re-render with the new models
    await waitFor(() => {
      items = screen.getAllByTestId("model-trigger-item");
      expect(items).toHaveLength(2);
    });

    // The newly selected models should be displayed
    expect(screen.getByText("sdxl")).toBeInTheDocument();
    expect(screen.getByText("sd-turbo")).toBeInTheDocument();
    // Both models have owner "stability-ai", so check for 2 occurrences
    const ownerElements = screen.getAllByText("stability-ai");
    expect(ownerElements).toHaveLength(2);

    // The old model should no longer be shown
    expect(screen.queryByText("flux-schnell")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // AC-9: No crash when getCollectionModels returns error
  // -----------------------------------------------------------------------

  it("AC-9: should handle getCollectionModels error on mount without crashing", async () => {
    /**
     * AC-9: GIVEN `getCollectionModels()` gibt `{ error: string }` zurueck beim Mount
     *       WHEN `prompt-area.tsx` den Fehler erhaelt
     *       THEN bleibt `selectedModels` leer oder auf Fallback gesetzt
     *       AND kein unbehandelter Fehler wird geworfen (kein Crash)
     */
    mockGetCollectionModels.mockResolvedValue({
      error: "Collection not found",
    });

    // Should NOT throw — component renders gracefully
    const { container } = render(<PromptArea projectId="proj-test" />);

    // Wait for the action to be called
    await waitFor(() => {
      expect(mockGetCollectionModels).toHaveBeenCalledTimes(1);
    });

    // The prompt-area should still be in the DOM (no crash)
    expect(screen.getByTestId("prompt-area")).toBeInTheDocument();

    // ModelTrigger should render with empty models (no mini-cards)
    const trigger = screen.getByTestId("model-trigger");
    expect(trigger).toBeInTheDocument();

    // No model-trigger-item should be present (selectedModels is empty)
    const items = screen.queryAllByTestId("model-trigger-item");
    expect(items).toHaveLength(0);

    // No unhandled errors — component is intact
    expect(container).toBeTruthy();
  });
});
