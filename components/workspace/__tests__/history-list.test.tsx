// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
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

// Mock server actions (getPromptHistory, toggleFavorite)
const mockGetPromptHistory = vi.fn();
const mockToggleFavorite = vi.fn();
vi.mock("@/app/actions/prompts", () => ({
  getPromptHistory: (...args: unknown[]) => mockGetPromptHistory(...args),
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

import { HistoryList } from "@/components/workspace/history-list";
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
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

function makeEntries(count: number): PromptHistoryEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({
      generationId: `gen-${String(i + 1).padStart(3, "0")}`,
      promptMotiv: `Prompt entry number ${i + 1}`,
      modelId: `vendor/model-${i + 1}`,
      createdAt: new Date(Date.now() - i * 60 * 60 * 1000), // each 1 hour apart
    })
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderHistoryList(props: Partial<React.ComponentProps<typeof HistoryList>> = {}) {
  const onLoadEntry = props.onLoadEntry ?? vi.fn();
  const result = render(
    <HistoryList
      onLoadEntry={onLoadEntry}
      promptMotiv={props.promptMotiv ?? ""}
      promptStyle={props.promptStyle ?? ""}
      negativePrompt={props.negativePrompt ?? ""}
    />
  );
  // Wait for initial load to complete (mockGetPromptHistory called + useTransition flushed)
  await waitFor(() => {
    expect(mockGetPromptHistory).toHaveBeenCalled();
  });
  // useTransition in jsdom does not flush synchronously; wait until the
  // loading indicator disappears before returning control to the test.
  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
  return { ...result, onLoadEntry };
}

// ---------------------------------------------------------------------------
// Tests: History List (Slice 12)
// ---------------------------------------------------------------------------

describe("History List", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromptHistory.mockResolvedValue([]);
    mockToggleFavorite.mockResolvedValue({ isFavorite: true });
  });

  // -------------------------------------------------------------------------
  // AC-1: Eintraege mit Preview, Badge, Zeitstempel
  // -------------------------------------------------------------------------
  it("AC-1: should render history entries with truncated prompt preview, model badge, and relative timestamp", async () => {
    /**
     * AC-1: GIVEN der History-Tab ist aktiv und es existieren 3 History-Eintraege
     *       WHEN die Komponente rendert
     *       THEN werden 3 Eintraege sichtbar, jeweils mit: Prompt-Preview-Text (max 80 Zeichen, danach "..."),
     *            Modell-Name als Badge, relativer Zeitstempel (z.B. "2 hours ago", "yesterday")
     */
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const justNow = new Date(Date.now() - 10 * 1000);

    const entries = [
      makeEntry({
        generationId: "entry-1",
        promptMotiv: "A beautiful sunset over the ocean",
        modelId: "vendor/flux-pro",
        createdAt: justNow,
      }),
      makeEntry({
        generationId: "entry-2",
        promptMotiv: "A cat sleeping on a windowsill",
        modelId: "vendor/sdxl-turbo",
        createdAt: twoHoursAgo,
      }),
      makeEntry({
        generationId: "entry-3",
        promptMotiv: "Mountain landscape with fog",
        modelId: "vendor/dalle-3",
        createdAt: yesterday,
      }),
    ];

    mockGetPromptHistory.mockResolvedValue(entries);
    await renderHistoryList();

    // 3 entries should be rendered
    const entryElements = screen.getAllByTestId("history-entry");
    expect(entryElements).toHaveLength(3);

    // Each entry shows prompt preview text
    expect(screen.getByText("A beautiful sunset over the ocean")).toBeInTheDocument();
    expect(screen.getByText("A cat sleeping on a windowsill")).toBeInTheDocument();
    expect(screen.getByText("Mountain landscape with fog")).toBeInTheDocument();

    // Each entry shows model name badge (last segment after /)
    expect(screen.getByText("flux-pro")).toBeInTheDocument();
    expect(screen.getByText("sdxl-turbo")).toBeInTheDocument();
    expect(screen.getByText("dalle-3")).toBeInTheDocument();

    // Relative timestamps
    expect(screen.getByText("just now")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    expect(screen.getByText("yesterday")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-2: Kurzer Prompt vollstaendig angezeigt
  // -------------------------------------------------------------------------
  it("AC-2: should display full prompt text when under 80 characters", async () => {
    /**
     * AC-2: GIVEN ein History-Eintrag mit promptMotiv = "A majestic eagle soaring over snow-capped mountain peaks at golden hour" (75 Zeichen)
     *       WHEN der Eintrag gerendert wird
     *       THEN wird der vollstaendige Text angezeigt (unter 80-Zeichen-Limit)
     */
    const shortPrompt = "A majestic eagle soaring over snow-capped mountain peaks at golden hour";
    expect(shortPrompt.length).toBeLessThanOrEqual(80); // verify it's under 80-char limit

    const entries = [makeEntry({ promptMotiv: shortPrompt })];
    mockGetPromptHistory.mockResolvedValue(entries);
    await renderHistoryList();

    // Full text should be displayed without truncation
    expect(screen.getByText(shortPrompt)).toBeInTheDocument();
    // No ellipsis should appear
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: Langer Prompt gekuerzt
  // -------------------------------------------------------------------------
  it("AC-3: should truncate prompt text at 80 characters with ellipsis", async () => {
    /**
     * AC-3: GIVEN ein History-Eintrag mit einem promptMotiv von 120 Zeichen
     *       WHEN der Eintrag gerendert wird
     *       THEN werden die ersten 80 Zeichen plus "..." angezeigt
     */
    const longPrompt = "A".repeat(120);
    expect(longPrompt.length).toBe(120); // verify 120 chars

    const entries = [makeEntry({ promptMotiv: longPrompt })];
    mockGetPromptHistory.mockResolvedValue(entries);
    await renderHistoryList();

    // Should show first 80 chars + "..."
    const expectedTruncated = "A".repeat(80) + "...";
    expect(screen.getByText(expectedTruncated)).toBeInTheDocument();

    // Full text should NOT be present
    expect(screen.queryByText(longPrompt)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-4: Stern-Toggle unfavorited -> favorited
  // -------------------------------------------------------------------------
  it("AC-4: should call toggleFavorite and show filled star when clicking unfavorited star", async () => {
    /**
     * AC-4: GIVEN ein History-Eintrag mit isFavorite = false
     *       WHEN der User auf den Stern klickt
     *       THEN wird der Stern als ausgefuellt dargestellt und die toggleFavorite Server Action mit der generationId aufgerufen
     */
    const user = userEvent.setup();
    const entry = makeEntry({ generationId: "gen-fav-test", isFavorite: false });
    mockGetPromptHistory.mockResolvedValue([entry]);
    mockToggleFavorite.mockResolvedValue({ isFavorite: true });

    await renderHistoryList();

    // Initially star should be unfilled (fill="none")
    const starIcon = screen.getByTestId("star-icon");
    expect(starIcon).toHaveAttribute("data-fill", "none");

    // Click the star toggle button
    const starToggle = screen.getByTestId("star-toggle");
    await user.click(starToggle);

    // toggleFavorite should be called with the generationId
    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith({ generationId: "gen-fav-test" });
    });

    // Star should now be filled
    await waitFor(() => {
      const updatedStarIcon = screen.getByTestId("star-icon");
      expect(updatedStarIcon).toHaveAttribute("data-fill", "currentColor");
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Stern-Toggle favorited -> unfavorited
  // -------------------------------------------------------------------------
  it("AC-5: should call toggleFavorite and show outline star when clicking favorited star", async () => {
    /**
     * AC-5: GIVEN ein History-Eintrag mit isFavorite = true
     *       WHEN der User auf den Stern klickt
     *       THEN wird der Stern als Outline dargestellt und die toggleFavorite Server Action aufgerufen
     */
    const user = userEvent.setup();
    const entry = makeEntry({ generationId: "gen-unfav-test", isFavorite: true });
    mockGetPromptHistory.mockResolvedValue([entry]);
    mockToggleFavorite.mockResolvedValue({ isFavorite: false });

    await renderHistoryList();

    // Initially star should be filled (fill="currentColor")
    const starIcon = screen.getByTestId("star-icon");
    expect(starIcon).toHaveAttribute("data-fill", "currentColor");

    // Click the star toggle button
    const starToggle = screen.getByTestId("star-toggle");
    await user.click(starToggle);

    // toggleFavorite should be called
    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith({ generationId: "gen-unfav-test" });
    });

    // Star should now be outline (fill="none")
    await waitFor(() => {
      const updatedStarIcon = screen.getByTestId("star-icon");
      expect(updatedStarIcon).toHaveAttribute("data-fill", "none");
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Initial 50 Eintraege mit Load-More
  // -------------------------------------------------------------------------
  it("AC-6: should load first 50 entries and show load-more indicator", async () => {
    /**
     * AC-6: GIVEN 60 History-Eintraege in der DB
     *       WHEN die Komponente initial rendert
     *       THEN werden die ersten 50 Eintraege geladen und ein "Load more"-Bereich ist am Ende sichtbar
     */
    // Return exactly 50 entries (indicates more might exist since batch size = 50)
    const fiftyEntries = makeEntries(50);
    mockGetPromptHistory.mockResolvedValue(fiftyEntries);

    await renderHistoryList();

    // Should have called getPromptHistory with offset 0, limit 50
    expect(mockGetPromptHistory).toHaveBeenCalledWith({ offset: 0, limit: 50 });

    // 50 entries should be rendered
    const entryElements = screen.getAllByTestId("history-entry");
    expect(entryElements).toHaveLength(50);

    // Load more button should be visible
    const loadMore = screen.getByTestId("load-more");
    expect(loadMore).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-7: Scroll-to-Load-More laedt naechsten Batch
  // -------------------------------------------------------------------------
  it("AC-7: should append next batch of entries when load-more is triggered", async () => {
    /**
     * AC-7: GIVEN 50 Eintraege sind geladen und weitere existieren
     *       WHEN der User zum Ende scrollt oder auf "Load more" klickt
     *       THEN werden die naechsten 50 Eintraege geladen und an die bestehende Liste angehaengt
     */
    const user = userEvent.setup();

    // First batch: 50 entries
    const firstBatch = makeEntries(50);
    mockGetPromptHistory.mockResolvedValueOnce(firstBatch);

    await renderHistoryList();

    // Verify 50 entries rendered
    expect(screen.getAllByTestId("history-entry")).toHaveLength(50);

    // Prepare second batch: 10 more entries
    const secondBatch = Array.from({ length: 10 }, (_, i) =>
      makeEntry({
        generationId: `gen-second-${i + 1}`,
        promptMotiv: `Second batch entry ${i + 1}`,
      })
    );
    mockGetPromptHistory.mockResolvedValueOnce(secondBatch);

    // Click "Load more"
    const loadMore = screen.getByTestId("load-more");
    await user.click(loadMore);

    // Should call getPromptHistory with offset 50
    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalledWith({ offset: 50, limit: 50 });
    });

    // Total entries should now be 60 (50 + 10)
    await waitFor(() => {
      expect(screen.getAllByTestId("history-entry")).toHaveLength(60);
    });

    // Since second batch returned < 50, load-more should be gone
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-8: Klick bei leeren Feldern befuellt direkt
  // -------------------------------------------------------------------------
  it("AC-8: should fill prompt fields directly when all fields are empty and entry is clicked", async () => {
    /**
     * AC-8: GIVEN alle Prompt-Felder (Motiv, Style, Negative) sind leer
     *       WHEN der User auf einen History-Eintrag klickt
     *       THEN werden die Prompt-Felder direkt mit den Werten des Eintrags befuellt (Motiv, Style, Negative Prompt) und der Tab wechselt zu "Prompt"
     */
    const user = userEvent.setup();
    const entry = makeEntry({
      promptMotiv: "Eagle in flight",
      promptStyle: "photorealistic",
      negativePrompt: "blur, noise",
    });
    mockGetPromptHistory.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <HistoryList
        onLoadEntry={onLoadEntry}
        promptMotiv=""
        promptStyle=""
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalled();
    });

    // Click the entry
    const entryElement = screen.getByTestId("history-entry");
    await user.click(entryElement);

    // onLoadEntry should be called directly (no dialog) with the entry data
    expect(onLoadEntry).toHaveBeenCalledWith(entry);

    // No dialog should appear
    expect(screen.queryByText("Replace current prompt?")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-9: Klick bei gefuellten Feldern zeigt Dialog
  // -------------------------------------------------------------------------
  it("AC-9: should show confirmation dialog when clicking entry with non-empty prompt fields", async () => {
    /**
     * AC-9: GIVEN mindestens ein Prompt-Feld enthaelt Text
     *       WHEN der User auf einen History-Eintrag klickt
     *       THEN erscheint ein Confirmation-Dialog mit Text "Replace current prompt?" und Buttons "Cancel" / "Apply"
     */
    const user = userEvent.setup();
    const entry = makeEntry({ promptMotiv: "New prompt from history" });
    mockGetPromptHistory.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <HistoryList
        onLoadEntry={onLoadEntry}
        promptMotiv="existing prompt text"
        promptStyle=""
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalled();
    });

    // Click the entry
    const entryElement = screen.getByTestId("history-entry");
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
  // AC-10: Apply im Dialog befuellt Felder
  // -------------------------------------------------------------------------
  it("AC-10: should fill prompt fields and switch to Prompt tab when Apply is clicked in dialog", async () => {
    /**
     * AC-10: GIVEN der Confirmation-Dialog ist sichtbar
     *        WHEN der User auf "Apply" klickt
     *        THEN werden die Prompt-Felder mit den Werten des History-Eintrags befuellt und der Tab wechselt zu "Prompt"
     */
    const user = userEvent.setup();
    const entry = makeEntry({
      promptMotiv: "Apply this prompt",
      promptStyle: "watercolor",
      negativePrompt: "noise",
    });
    mockGetPromptHistory.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <HistoryList
        onLoadEntry={onLoadEntry}
        promptMotiv="existing text"
        promptStyle=""
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalled();
    });

    // Click entry to trigger dialog
    const entryElement = screen.getByTestId("history-entry");
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
  // AC-11: Cancel im Dialog laesst Felder unveraendert
  // -------------------------------------------------------------------------
  it("AC-11: should keep prompt fields unchanged when Cancel is clicked in dialog", async () => {
    /**
     * AC-11: GIVEN der Confirmation-Dialog ist sichtbar
     *        WHEN der User auf "Cancel" klickt
     *        THEN schliesst der Dialog und die bestehenden Prompt-Felder bleiben unveraendert
     */
    const user = userEvent.setup();
    const entry = makeEntry({ promptMotiv: "Should not be applied" });
    mockGetPromptHistory.mockResolvedValue([entry]);

    const onLoadEntry = vi.fn();
    render(
      <HistoryList
        onLoadEntry={onLoadEntry}
        promptMotiv="keep this"
        promptStyle="keep style"
        negativePrompt=""
      />
    );

    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalled();
    });

    // Click entry to trigger dialog
    const entryElement = screen.getByTestId("history-entry");
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

  // -------------------------------------------------------------------------
  // AC-12: Leer-Zustand
  // -------------------------------------------------------------------------
  it("AC-12: should show empty state message when no history entries exist", async () => {
    /**
     * AC-12: GIVEN keine History-Eintraege existieren
     *        WHEN die Komponente rendert
     *        THEN wird der Leer-Zustand angezeigt: "No prompts generated yet. Start your first generation!"
     */
    mockGetPromptHistory.mockResolvedValue([]);

    await renderHistoryList();

    // Empty state message should be visible
    expect(
      screen.getByText("No prompts generated yet. Start your first generation!")
    ).toBeInTheDocument();

    // No history entries should be rendered
    expect(screen.queryByTestId("history-entry")).not.toBeInTheDocument();

    // No load-more should be visible
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });
});
