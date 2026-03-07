// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

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

// Mock server actions (getFavoritePrompts, toggleFavorite)
const mockGetFavoritePrompts = vi.fn();
const mockToggleFavorite = vi.fn();
vi.mock("@/app/actions/prompts", () => ({
  getFavoritePrompts: (...args: unknown[]) => mockGetFavoritePrompts(...args),
  toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
}));

// Mock lucide-react Star icon
vi.mock("lucide-react", () => ({
  Star: ({ fill, ...props }: Record<string, unknown>) => (
    <svg data-testid="star-icon" data-fill={fill} {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { FavoritesList } from "@/components/workspace/favorites-list";
import type { PromptHistoryEntry } from "@/lib/services/prompt-history-service";

// ---------------------------------------------------------------------------
// Test Data Factory
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry {
  return {
    generationId: overrides.generationId ?? crypto.randomUUID(),
    promptMotiv: overrides.promptMotiv ?? "A test prompt",
    promptStyle: overrides.promptStyle ?? "cinematic",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "vendor/model-test",
    modelParams: overrides.modelParams ?? {},
    isFavorite: overrides.isFavorite ?? true, // Favorites are always true
    createdAt: overrides.createdAt ?? new Date(),
  };
}

function makeEntries(count: number): PromptHistoryEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({
      generationId: `gen-${String(i + 1).padStart(3, "0")}`,
      promptMotiv: `Prompt entry number ${i + 1}`,
      modelId: `vendor/model-${i + 1}`,
      isFavorite: true,
      createdAt: new Date(Date.now() - i * 60 * 60 * 1000), // each 1 hour apart
    })
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderFavoritesList(props: Partial<React.ComponentProps<typeof FavoritesList>> = {}) {
  const onLoadEntry = props.onLoadEntry ?? vi.fn();
  const result = render(
    <FavoritesList
      onLoadEntry={onLoadEntry}
      promptMotiv={props.promptMotiv ?? ""}
      promptStyle={props.promptStyle ?? ""}
      negativePrompt={props.negativePrompt ?? ""}
    />
  );
  // Wait for initial load to complete (mockGetFavoritePrompts called + useTransition flushed)
  await waitFor(() => {
    expect(mockGetFavoritePrompts).toHaveBeenCalled();
  });
  // useTransition in jsdom does not flush synchronously; wait until the
  // loading indicator disappears before returning control to the test.
  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
  return { ...result, onLoadEntry };
}

// ---------------------------------------------------------------------------
// Tests: Favorites List (Slice 13)
// ---------------------------------------------------------------------------

describe("Favorites List", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFavoritePrompts.mockResolvedValue([]);
    mockToggleFavorite.mockResolvedValue({ isFavorite: false });
  });

  // -------------------------------------------------------------------------
  // AC-1: Favorisierte Eintraege mit Preview, Badge, Zeitstempel, Stern
  // -------------------------------------------------------------------------
  it("AC-1: should render only favorited entries with prompt preview, model badge, relative timestamp, and filled star", async () => {
    /**
     * AC-1: GIVEN der Favorites-Tab ist aktiv und es existieren 2 favorisierte Eintraege
     *       WHEN die Komponente rendert
     *       THEN werden genau 2 Eintraege angezeigt, jeweils mit: Prompt-Preview-Text (max 80 Zeichen, danach "..."),
     *            Modell-Name als Badge, relativer Zeitstempel, ausgefuelltem Stern-Icon
     */
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const justNow = new Date(Date.now() - 10 * 1000);

    const entries = [
      makeEntry({
        generationId: "fav-1",
        promptMotiv: "A beautiful sunset over the ocean",
        modelId: "vendor/flux-pro",
        isFavorite: true,
        createdAt: justNow,
      }),
      makeEntry({
        generationId: "fav-2",
        promptMotiv: "A cat sleeping on a windowsill",
        modelId: "vendor/sdxl-turbo",
        isFavorite: true,
        createdAt: twoHoursAgo,
      }),
    ];

    mockGetFavoritePrompts.mockResolvedValue(entries);
    await renderFavoritesList();

    // Exactly 2 entries should be rendered
    const entryElements = screen.getAllByTestId("favorites-entry");
    expect(entryElements).toHaveLength(2);

    // Each entry shows prompt preview text
    expect(screen.getByText("A beautiful sunset over the ocean")).toBeInTheDocument();
    expect(screen.getByText("A cat sleeping on a windowsill")).toBeInTheDocument();

    // Each entry shows model name badge (last segment after /)
    expect(screen.getByText("flux-pro")).toBeInTheDocument();
    expect(screen.getByText("sdxl-turbo")).toBeInTheDocument();

    // Relative timestamps
    expect(screen.getByText("just now")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();

    // All stars should be filled (favorites always have filled star)
    const starIcons = screen.getAllByTestId("star-icon");
    expect(starIcons).toHaveLength(2);
    for (const star of starIcons) {
      expect(star).toHaveAttribute("data-fill", "currentColor");
    }

    // Verify truncation works: a long prompt should be truncated at 80 chars
    const longPromptEntry = makeEntry({
      generationId: "fav-long",
      promptMotiv: "A".repeat(120),
      isFavorite: true,
    });
    mockGetFavoritePrompts.mockResolvedValue([longPromptEntry]);

    // Re-render to test truncation
    const { unmount } = render(
      <FavoritesList onLoadEntry={vi.fn()} promptMotiv="" promptStyle="" negativePrompt="" />
    );
    await waitFor(() => {
      expect(screen.getByText("A".repeat(80) + "...")).toBeInTheDocument();
    });
    unmount();
  });

  // -------------------------------------------------------------------------
  // AC-2: Stern-Toggle entfernt Eintrag aus Liste
  // -------------------------------------------------------------------------
  it("AC-2: should call toggleFavorite and remove entry from list when star is clicked", async () => {
    /**
     * AC-2: GIVEN ein favorisierter Eintrag mit isFavorite = true
     *       WHEN der User auf den Stern klickt
     *       THEN wird die toggleFavorite Server Action mit der generationId aufgerufen
     *            und der Eintrag verschwindet aus der Favorites-Liste
     */
    const user = userEvent.setup();
    const entries = [
      makeEntry({ generationId: "fav-remove-1", promptMotiv: "Entry to remove", isFavorite: true }),
      makeEntry({ generationId: "fav-keep-2", promptMotiv: "Entry to keep", isFavorite: true }),
    ];
    mockGetFavoritePrompts.mockResolvedValue(entries);
    mockToggleFavorite.mockResolvedValue({ isFavorite: false });

    await renderFavoritesList();

    // Both entries should be visible initially
    expect(screen.getAllByTestId("favorites-entry")).toHaveLength(2);

    // Click the star toggle on the first entry
    const starToggles = screen.getAllByTestId("star-toggle");
    await user.click(starToggles[0]);

    // toggleFavorite should be called with the generationId
    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith({ generationId: "fav-remove-1" });
    });

    // Entry should be removed from the list (optimistic removal)
    await waitFor(() => {
      expect(screen.getAllByTestId("favorites-entry")).toHaveLength(1);
    });

    // The remaining entry should be the second one
    expect(screen.getByText("Entry to keep")).toBeInTheDocument();
    expect(screen.queryByText("Entry to remove")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: Empty-State
  // -------------------------------------------------------------------------
  it("AC-3: should show empty state message when no favorites exist", async () => {
    /**
     * AC-3: GIVEN keine favorisierten Eintraege existieren
     *       WHEN die Komponente rendert
     *       THEN wird der Empty-State angezeigt: "No favorites yet. Star prompts in History to save them here."
     */
    mockGetFavoritePrompts.mockResolvedValue([]);

    await renderFavoritesList();

    // Empty state message should be visible
    expect(
      screen.getByText("No favorites yet. Star prompts in History to save them here.")
    ).toBeInTheDocument();

    // Empty state container should have correct test id
    expect(screen.getByTestId("favorites-empty")).toBeInTheDocument();

    // No favorites entries should be rendered
    expect(screen.queryByTestId("favorites-entry")).not.toBeInTheDocument();

    // No load-more should be visible
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-4: Initial 50 Eintraege mit Load-More
  // -------------------------------------------------------------------------
  it("AC-4: should load first 50 entries and show load-more indicator", async () => {
    /**
     * AC-4: GIVEN 60 favorisierte Eintraege in der DB
     *       WHEN die Komponente initial rendert
     *       THEN werden die ersten 50 Eintraege geladen und ein "Load more"-Bereich ist am Ende sichtbar
     */
    // Return exactly 50 entries (indicates more might exist since batch size = 50)
    const fiftyEntries = makeEntries(50);
    mockGetFavoritePrompts.mockResolvedValue(fiftyEntries);

    await renderFavoritesList();

    // Should have called getFavoritePrompts with offset 0, limit 50
    expect(mockGetFavoritePrompts).toHaveBeenCalledWith({ offset: 0, limit: 50 });

    // 50 entries should be rendered
    const entryElements = screen.getAllByTestId("favorites-entry");
    expect(entryElements).toHaveLength(50);

    // Load more button should be visible
    const loadMore = screen.getByTestId("load-more");
    expect(loadMore).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-5: Load-More laedt naechsten Batch
  // -------------------------------------------------------------------------
  it("AC-5: should append next batch of entries when load-more is triggered", async () => {
    /**
     * AC-5: GIVEN 50 favorisierte Eintraege sind geladen und weitere existieren
     *       WHEN der User zum Ende scrollt oder auf "Load more" klickt
     *       THEN werden die naechsten 50 Eintraege geladen und an die bestehende Liste angehaengt
     */
    const user = userEvent.setup();

    // First batch: 50 entries
    const firstBatch = makeEntries(50);
    mockGetFavoritePrompts.mockResolvedValueOnce(firstBatch);

    await renderFavoritesList();

    // Verify 50 entries rendered
    expect(screen.getAllByTestId("favorites-entry")).toHaveLength(50);

    // Prepare second batch: 10 more entries
    const secondBatch = Array.from({ length: 10 }, (_, i) =>
      makeEntry({
        generationId: `gen-second-${i + 1}`,
        promptMotiv: `Second batch entry ${i + 1}`,
        isFavorite: true,
      })
    );
    mockGetFavoritePrompts.mockResolvedValueOnce(secondBatch);

    // Click "Load more"
    const loadMore = screen.getByTestId("load-more");
    await user.click(loadMore);

    // Should call getFavoritePrompts with offset 50
    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalledWith({ offset: 50, limit: 50 });
    });

    // Total entries should now be 60 (50 + 10)
    await waitFor(() => {
      expect(screen.getAllByTestId("favorites-entry")).toHaveLength(60);
    });

    // Since second batch returned < 50, load-more should be gone
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-6: Klick bei leeren Feldern befuellt direkt
  // -------------------------------------------------------------------------
  it("AC-6: should fill prompt fields directly when all fields are empty and entry is clicked", async () => {
    /**
     * AC-6: GIVEN alle Prompt-Felder (Motiv, Style, Negative) sind leer
     *       WHEN der User auf einen Favorites-Eintrag klickt
     *       THEN werden die Prompt-Felder direkt mit den Werten des Eintrags befuellt
     *            (Motiv, Style, Negative Prompt) und der Tab wechselt zu "Prompt"
     */
    const user = userEvent.setup();
    const entry = makeEntry({
      promptMotiv: "Eagle in flight",
      promptStyle: "photorealistic",
      negativePrompt: "blur, noise",
      isFavorite: true,
    });
    mockGetFavoritePrompts.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <FavoritesList
        onLoadEntry={onLoadEntry}
        promptMotiv=""
        promptStyle=""
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Click the entry
    const entryElement = screen.getByTestId("favorites-entry");
    await user.click(entryElement);

    // onLoadEntry should be called directly (no dialog) with the entry data
    expect(onLoadEntry).toHaveBeenCalledWith(entry);

    // No dialog should appear
    expect(screen.queryByText("Replace current prompt?")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-7: Klick bei gefuellten Feldern zeigt Dialog
  // -------------------------------------------------------------------------
  it("AC-7: should show confirmation dialog when clicking entry with non-empty prompt fields", async () => {
    /**
     * AC-7: GIVEN mindestens ein Prompt-Feld enthaelt Text
     *       WHEN der User auf einen Favorites-Eintrag klickt
     *       THEN erscheint ein Confirmation-Dialog mit Text "Replace current prompt?"
     *            und Buttons "Cancel" / "Apply"
     */
    const user = userEvent.setup();
    const entry = makeEntry({ promptMotiv: "New prompt from favorites", isFavorite: true });
    mockGetFavoritePrompts.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <FavoritesList
        onLoadEntry={onLoadEntry}
        promptMotiv="existing prompt text"
        promptStyle=""
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Click the entry
    const entryElement = screen.getByTestId("favorites-entry");
    await user.click(entryElement);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText("Replace current prompt?")).toBeInTheDocument();
    });

    // Dialog should have Cancel and Apply buttons
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();

    // onLoadEntry should NOT have been called yet
    expect(onLoadEntry).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-8: Apply im Dialog befuellt Felder
  // -------------------------------------------------------------------------
  it("AC-8: should fill prompt fields and switch to Prompt tab when Apply is clicked in dialog", async () => {
    /**
     * AC-8: GIVEN der Confirmation-Dialog ist sichtbar
     *       WHEN der User auf "Apply" klickt
     *       THEN werden die Prompt-Felder mit den Werten des Favorites-Eintrags befuellt
     *            und der Tab wechselt zu "Prompt"
     */
    const user = userEvent.setup();
    const entry = makeEntry({
      promptMotiv: "Apply this prompt",
      promptStyle: "watercolor",
      negativePrompt: "noise",
      isFavorite: true,
    });
    mockGetFavoritePrompts.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <FavoritesList
        onLoadEntry={onLoadEntry}
        promptMotiv="existing text"
        promptStyle=""
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Click entry to trigger dialog
    const entryElement = screen.getByTestId("favorites-entry");
    await user.click(entryElement);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Replace current prompt?")).toBeInTheDocument();
    });

    // Click Apply
    const applyBtn = screen.getByRole("button", { name: "Apply" });
    await user.click(applyBtn);

    // onLoadEntry should be called with the entry
    await waitFor(() => {
      expect(onLoadEntry).toHaveBeenCalledWith(entry);
    });

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText("Replace current prompt?")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-9: Cancel im Dialog laesst Felder unveraendert
  // -------------------------------------------------------------------------
  it("AC-9: should keep prompt fields unchanged when Cancel is clicked in dialog", async () => {
    /**
     * AC-9: GIVEN der Confirmation-Dialog ist sichtbar
     *       WHEN der User auf "Cancel" klickt
     *       THEN schliesst der Dialog und die bestehenden Prompt-Felder bleiben unveraendert
     */
    const user = userEvent.setup();
    const entry = makeEntry({ promptMotiv: "Should not be applied", isFavorite: true });
    mockGetFavoritePrompts.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <FavoritesList
        onLoadEntry={onLoadEntry}
        promptMotiv="keep this"
        promptStyle="keep style"
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Click entry to trigger dialog
    const entryElement = screen.getByTestId("favorites-entry");
    await user.click(entryElement);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Replace current prompt?")).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText("Replace current prompt?")).not.toBeInTheDocument();
    });

    // onLoadEntry should NOT have been called
    expect(onLoadEntry).not.toHaveBeenCalled();
  });
});
