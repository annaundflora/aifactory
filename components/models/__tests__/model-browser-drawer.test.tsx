// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ModelBrowserDrawer, type ModelBrowserDrawerProps } from "@/components/models/model-browser-drawer";
import { type CollectionModel } from "@/lib/types/collection-model";

// Mock server actions
import { getFavoriteModels, toggleFavoriteModel } from "@/app/actions/models";
vi.mock("@/app/actions/models", () => ({
  getFavoriteModels: vi.fn().mockResolvedValue([]),
  toggleFavoriteModel: vi.fn().mockResolvedValue({ isFavorite: true }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createModel(overrides: Partial<CollectionModel> = {}): CollectionModel {
  return {
    url: "https://replicate.com/acme/test-model",
    owner: "acme",
    name: "test-model",
    description: "A short description of the model for testing purposes.",
    cover_image_url: "https://example.com/cover.jpg",
    run_count: 1_500_000,
    created_at: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

const FOUR_MODELS: CollectionModel[] = [
  createModel({ owner: "black-forest-labs", name: "flux-schnell", description: "Flux Schnell is a fast model." }),
  createModel({ owner: "black-forest-labs", name: "flux-dev", description: "Flux Dev for development." }),
  createModel({ owner: "stability-ai", name: "sdxl", description: "Stable Diffusion XL model." }),
  createModel({ owner: "stability-ai", name: "sd-turbo", description: "Stable Diffusion Turbo." }),
];

function defaultProps(overrides: Partial<ModelBrowserDrawerProps> = {}): ModelBrowserDrawerProps {
  return {
    open: true,
    models: FOUR_MODELS,
    selectedModels: [],
    isLoading: false,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-1: Drawer opens and renders all Cards plus search input
// ---------------------------------------------------------------------------
describe("AC-1: Drawer opens and renders all model cards and search input", () => {
  it("should render all model cards and search input when open", () => {
    /**
     * AC-1: GIVEN open={true} und models mit 4 CollectionModel-Eintraegen
     *       WHEN ModelBrowserDrawer gerendert wird
     *       THEN ist das Sheet sichtbar (aria-expanded oder data-state="open")
     *       AND genau 4 ModelCard-Komponenten werden im Grid gerendert
     *       AND ein <input>-Suchfeld mit placeholder "Search models..." ist sichtbar
     */
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    // Sheet is visible
    const drawer = screen.getByTestId("model-browser-drawer");
    expect(drawer).toBeInTheDocument();

    // Exactly 4 ModelCards rendered in the grid
    const grid = screen.getByTestId("model-grid");
    // Each ModelCard renders a Card with role="button"
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));
    expect(cards).toHaveLength(4);

    // Search input with correct placeholder
    const searchInput = screen.getByPlaceholderText("Search models...");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput.tagName).toBe("INPUT");
  });
});

// ---------------------------------------------------------------------------
// AC-2: Search filters Cards by name/description
// ---------------------------------------------------------------------------
describe("AC-2: Search filters model cards by search query", () => {
  it("should filter model cards by search query", async () => {
    /**
     * AC-2: GIVEN Drawer ist geoeffnet mit 4 Modellen
     *       WHEN der Nutzer "flux" in das Suchfeld eingibt
     *       THEN werden nur die ModelCard-Instanzen gerendert, deren name oder description
     *            den String "flux" enthaelt (case-insensitive)
     *       AND Modelle ohne Match sind nicht im DOM
     */
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    const searchInput = screen.getByPlaceholderText("Search models...");
    await user.type(searchInput, "flux");

    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));

    // Only "flux-schnell" and "flux-dev" should match (name contains "flux")
    expect(cards).toHaveLength(2);

    // The matching models should be visible
    expect(screen.getByText("flux-schnell")).toBeInTheDocument();
    expect(screen.getByText("flux-dev")).toBeInTheDocument();

    // Non-matching models should NOT be in the DOM
    expect(screen.queryByText("sdxl")).not.toBeInTheDocument();
    expect(screen.queryByText("sd-turbo")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Owner filter chip filters Cards by owner
// ---------------------------------------------------------------------------
describe("AC-3: Owner filter dropdown filters model cards by owner", () => {
  it("should filter model cards by owner when dropdown value is changed", async () => {
    /**
     * AC-3: GIVEN Drawer ist geoeffnet mit Modellen von Ownern "black-forest-labs" und "stability-ai"
     *       WHEN der Nutzer im Owner-Dropdown "stability-ai" auswaehlt
     *       THEN werden nur ModelCard-Instanzen mit owner === "stability-ai" angezeigt
     */
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    // Select "stability-ai" from the owner dropdown
    const select = screen.getByTestId("owner-filter-select");
    await user.selectOptions(select, "stability-ai");

    // Only stability-ai models should remain
    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));
    expect(cards).toHaveLength(2);

    expect(screen.getByText("sdxl")).toBeInTheDocument();
    expect(screen.getByText("sd-turbo")).toBeInTheDocument();

    // Non-matching owner models should NOT be in the DOM
    expect(screen.queryByText("flux-schnell")).not.toBeInTheDocument();
    expect(screen.queryByText("flux-dev")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Click on Card sets tempSelectedModels and activates Confirm button
// ---------------------------------------------------------------------------
describe("AC-4: Card selection enables confirm button with correct label", () => {
  it("should select a card and enable confirm button with correct label", async () => {
    /**
     * AC-4: GIVEN Drawer ist geoeffnet und kein Model ist selektiert
     *       WHEN der Nutzer eine ModelCard klickt
     *       THEN ist tempSelectedModels intern auf dieses Model gesetzt
     *       AND die angeklickte ModelCard erhaelt selected={true}
     *       AND der Confirm-Button zeigt den Text "Confirm (1 Model)" und ist nicht disabled
     */
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const props = defaultProps({ onConfirm });
    render(<ModelBrowserDrawer {...props} />);

    // Click the first model card
    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));
    await user.click(cards[0]);

    // The clicked card should now have selected state (ring-2 ring-primary)
    expect(cards[0]).toHaveClass("ring-2");
    expect(cards[0]).toHaveClass("ring-primary");

    // Confirm button should show correct text and be enabled
    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toHaveTextContent("Confirm (1 Model)");
    expect(confirmButton).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Max-3 enforcement — 4th card blocked, inline hint appears
// ---------------------------------------------------------------------------
describe("AC-5: Max-3 enforcement prevents selecting more than 3 models", () => {
  it("should prevent selecting more than 3 models and show inline hint", async () => {
    /**
     * AC-5: GIVEN tempSelectedModels hat bereits 3 Eintraege
     *       WHEN der Nutzer eine weitere (nicht selektierte) ModelCard klickt
     *       THEN bleibt tempSelectedModels unveraendert (kein vierter Eintrag)
     *       AND ein Inline-Hinweis "Select up to 3 models" ist sichtbar
     *       AND die nicht selektierte ModelCard hat disabled={true}
     */
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));

    // Select 3 cards
    await user.click(cards[0]);
    await user.click(cards[1]);
    await user.click(cards[2]);

    // Verify 3 are selected (ring-2 class)
    expect(cards[0]).toHaveClass("ring-2");
    expect(cards[1]).toHaveClass("ring-2");
    expect(cards[2]).toHaveClass("ring-2");

    // Inline hint should be visible
    const hint = screen.getByTestId("max-selection-hint");
    expect(hint).toHaveTextContent("Select up to 3 models");

    // 4th card should be disabled (opacity-50 and pointer-events-none)
    expect(cards[3]).toHaveClass("opacity-50");
    expect(cards[3]).toHaveClass("pointer-events-none");

    // Confirm button should still show 3
    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toHaveTextContent("Confirm (3 Models)");
  });
});

// ---------------------------------------------------------------------------
// AC-6: Click on selected Card deselects it
// ---------------------------------------------------------------------------
describe("AC-6: Deselecting a card by clicking it again", () => {
  it("should deselect a card when clicked while already selected", async () => {
    /**
     * AC-6: GIVEN tempSelectedModels hat 2 Eintraege
     *       WHEN der Nutzer eine bereits selektierte ModelCard klickt
     *       THEN wird dieses Model aus tempSelectedModels entfernt
     *       AND die ModelCard erhaelt selected={false}
     *       AND der Confirm-Button zeigt "Confirm (1 Model)"
     */
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));

    // Select 2 cards
    await user.click(cards[0]);
    await user.click(cards[1]);

    // Verify both selected
    expect(cards[0]).toHaveClass("ring-2");
    expect(cards[1]).toHaveClass("ring-2");

    // Confirm shows 2 Models
    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toHaveTextContent("Confirm (2 Models)");

    // Click the first card again to deselect
    await user.click(cards[0]);

    // First card should no longer be selected
    expect(cards[0]).not.toHaveClass("ring-2");

    // Second card remains selected
    expect(cards[1]).toHaveClass("ring-2");

    // Confirm should now show 1 Model
    expect(confirmButton).toHaveTextContent("Confirm (1 Model)");
  });
});

// ---------------------------------------------------------------------------
// AC-7: Close without Confirm discards tempState and calls onClose
// ---------------------------------------------------------------------------
describe("AC-7: Close without confirm discards temp selection", () => {
  it("should discard temp selection on close without confirm", async () => {
    /**
     * AC-7: GIVEN Drawer ist geoeffnet mit selectedModels vom Parent (1 vorselektiertes Model)
     *       WHEN der Nutzer ein zweites Model in tempSelectedModels hinzufuegt
     *       AND dann den Close-Button (X) klickt
     *       THEN wird onConfirm NICHT aufgerufen
     *       AND onClose wird aufgerufen
     *       AND die Aenderung an tempSelectedModels ist verworfen (tempState = parent-State)
     */
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({
      selectedModels: [FOUR_MODELS[0]], // 1 pre-selected model
      onConfirm,
      onClose,
    });
    const { rerender } = render(<ModelBrowserDrawer {...props} />);

    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));

    // Add a second model to temp selection
    await user.click(cards[1]);

    // Verify 2 models are now selected (first was pre-selected, second just clicked)
    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toHaveTextContent("Confirm (2 Models)");

    // Click the Close button (X) — the Sheet renders a close button with sr-only "Close" text
    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    // onConfirm should NOT have been called
    expect(onConfirm).not.toHaveBeenCalled();

    // onClose should have been called
    expect(onClose).toHaveBeenCalled();

    // Re-open the drawer to verify temp state was discarded
    // Simulate close -> open cycle
    rerender(<ModelBrowserDrawer {...props} open={false} />);
    rerender(<ModelBrowserDrawer {...props} open={true} />);

    // After re-open, only the parent's 1 pre-selected model should be in temp state
    const confirmButton2 = screen.getByTestId("confirm-button");
    expect(confirmButton2).toHaveTextContent("Confirm (1 Model)");
  });
});

// ---------------------------------------------------------------------------
// AC-8: Confirm passes tempSelectedModels to onConfirm and calls onClose
// ---------------------------------------------------------------------------
describe("AC-8: Confirm passes selected models and closes drawer", () => {
  it("should call onConfirm with selected models and onClose on confirm click", async () => {
    /**
     * AC-8: GIVEN tempSelectedModels hat 2 Eintraege
     *       WHEN der Nutzer den Confirm-Button klickt
     *       THEN wird onConfirm(tempSelectedModels) mit genau 2 CollectionModel-Eintraegen aufgerufen
     *       AND onClose wird aufgerufen (Drawer schliesst)
     */
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ onConfirm, onClose });
    render(<ModelBrowserDrawer {...props} />);

    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));

    // Select 2 models
    await user.click(cards[0]);
    await user.click(cards[1]);

    // Click confirm button
    const confirmButton = screen.getByTestId("confirm-button");
    await user.click(confirmButton);

    // onConfirm should be called with exactly 2 models
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const confirmedModels = onConfirm.mock.calls[0][0];
    expect(confirmedModels).toHaveLength(2);
    expect(confirmedModels[0].name).toBe("flux-schnell");
    expect(confirmedModels[1].name).toBe("flux-dev");

    // onClose should be called (drawer closes)
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-9: Empty state when models array is empty
// ---------------------------------------------------------------------------
describe("AC-9: Empty state when models array is empty", () => {
  it("should show empty state message when models array is empty", () => {
    /**
     * AC-9: GIVEN models ist ein leeres Array ([])
     *       WHEN ModelBrowserDrawer gerendert wird
     *       THEN wird kein ModelCard gerendert
     *       AND eine Empty-State-Message "No models available." ist im DOM sichtbar
     */
    const props = defaultProps({ models: [] });
    render(<ModelBrowserDrawer {...props} />);

    // No model grid or model cards rendered
    expect(screen.queryByTestId("model-grid")).not.toBeInTheDocument();

    // Empty state message visible
    const emptyState = screen.getByTestId("model-empty");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent("No models available.");
  });
});

// ---------------------------------------------------------------------------
// AC-10: Loading state shows spinner/skeleton, no cards
// ---------------------------------------------------------------------------
describe("AC-10: Loading state shows loading indicator and no cards", () => {
  it("should show loading indicator and no cards when isLoading is true", () => {
    /**
     * AC-10: GIVEN isLoading={true}
     *        WHEN ModelBrowserDrawer gerendert wird
     *        THEN ist ein Lade-Indikator (Spinner oder Skeleton) sichtbar
     *        AND keine ModelCard-Instanzen werden gerendert
     */
    const props = defaultProps({ isLoading: true });
    render(<ModelBrowserDrawer {...props} />);

    // Loading indicator is visible
    const loading = screen.getByTestId("model-loading");
    expect(loading).toBeInTheDocument();

    // No model cards rendered (no model-grid)
    expect(screen.queryByTestId("model-grid")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-11: Error state shows error message and retry button
// ---------------------------------------------------------------------------
describe("AC-11: Error state shows error message and retry button", () => {
  it("should show error message and retry button when error prop is set", async () => {
    /**
     * AC-11: GIVEN error="Could not load models. Please try again." und isLoading={false}
     *        WHEN ModelBrowserDrawer gerendert wird
     *        THEN wird die Fehlermeldung "Could not load models. Please try again." angezeigt
     *        AND ein Retry-Button ist sichtbar
     *        AND ein Klick auf Retry ruft onRetry() auf
     */
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const props = defaultProps({
      error: "Could not load models. Please try again.",
      isLoading: false,
      onRetry,
    });
    render(<ModelBrowserDrawer {...props} />);

    // Error state visible with error message
    const errorState = screen.getByTestId("model-error");
    expect(errorState).toBeInTheDocument();
    expect(errorState).toHaveTextContent("Could not load models. Please try again.");

    // Retry button visible and functional
    const retryButton = within(errorState).getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// AC-12: Confirm button disabled with guidance text when 0 models selected
// ---------------------------------------------------------------------------
describe("AC-12: Confirm button disabled when no model is selected", () => {
  it("should show disabled confirm button with guidance text when no model is selected", () => {
    /**
     * AC-12: GIVEN tempSelectedModels ist leer (0 Modelle selektiert)
     *        WHEN der Confirm-Button gerendert wird
     *        THEN ist der Confirm-Button disabled
     *        AND zeigt den Text "Select at least 1 model"
     */
    const props = defaultProps({ selectedModels: [] });
    render(<ModelBrowserDrawer {...props} />);

    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent("Select at least 1 model");
  });
});

// ---------------------------------------------------------------------------
// Favorites: chip, toggle, star icons
// ---------------------------------------------------------------------------
describe("Favorites functionality", () => {
  it("should show Favorites chip when favorites exist", async () => {
    (getFavoriteModels as Mock).mockResolvedValueOnce(["black-forest-labs/flux-schnell"]);

    const props = defaultProps();
    const { rerender } = render(<ModelBrowserDrawer {...props} open={false} />);
    rerender(<ModelBrowserDrawer {...props} open={true} />);

    // Wait for favorites to load
    const chip = await screen.findByTestId("filter-favorites");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("Favorites (1)");
  });

  it("should not show Favorites chip when no favorites exist", () => {
    (getFavoriteModels as Mock).mockResolvedValueOnce([]);

    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    expect(screen.queryByTestId("filter-favorites")).not.toBeInTheDocument();
  });

  it("should render star icons on all model cards", () => {
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    const stars = screen.getAllByTestId("favorite-star");
    expect(stars).toHaveLength(4); // One per model card
  });

  it("should toggle favorite when star is clicked", async () => {
    (toggleFavoriteModel as Mock).mockResolvedValueOnce({ isFavorite: true });

    const user = userEvent.setup();
    const props = defaultProps();
    render(<ModelBrowserDrawer {...props} />);

    const stars = screen.getAllByTestId("favorite-star");
    await user.click(stars[0]);

    expect(toggleFavoriteModel).toHaveBeenCalledWith({
      modelId: "black-forest-labs/flux-schnell",
    });
  });

  it("should filter to only favorites when Favorites chip is active", async () => {
    (getFavoriteModels as Mock).mockResolvedValueOnce(["black-forest-labs/flux-schnell"]);

    const user = userEvent.setup();
    const props = defaultProps();
    const { rerender } = render(<ModelBrowserDrawer {...props} open={false} />);
    rerender(<ModelBrowserDrawer {...props} open={true} />);

    // Wait for favorites to load
    const chip = await screen.findByTestId("filter-favorites");
    await user.click(chip);

    // Only the favorited model should remain
    const grid = screen.getByTestId("model-grid");
    const cards = within(grid).getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));
    // Each card is a button, but star buttons are also inside — count by card structure
    // The favorited model card + its star button
    expect(screen.getByText("flux-schnell")).toBeInTheDocument();
    expect(screen.queryByText("flux-dev")).not.toBeInTheDocument();
    expect(screen.queryByText("sdxl")).not.toBeInTheDocument();
    expect(screen.queryByText("sd-turbo")).not.toBeInTheDocument();
  });
});
