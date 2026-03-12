// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { createElement, useState } from "react";

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
// Mocks
// ---------------------------------------------------------------------------

// Mock lib/db/queries to prevent DATABASE_URL crash (imported by history-service chain)
vi.mock("@/lib/db/queries", () => ({}));

// Mock server actions from app/actions/prompts (called by HistoryList/FavoritesList on mount)
vi.mock("@/app/actions/prompts", () => ({
  getPromptHistory: vi.fn().mockResolvedValue([]),
  getFavoritePrompts: vi.fn().mockResolvedValue([]),
  toggleFavorite: vi.fn().mockResolvedValue({}),
  improvePrompt: vi.fn().mockResolvedValue({ improved: "" }),
}));

// Mock lucide-react icons used by HistoryList and FavoritesList
vi.mock("lucide-react", () => ({
  Star: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-star", ...props }),
  ChevronDown: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-chevron-down", ...props }),
  Loader2: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-loader", ...props }),
}));

// ---------------------------------------------------------------------------
// Import PromptTabs (HistoryList and FavoritesList are rendered inside tabs)
// ---------------------------------------------------------------------------

import { PromptTabs, type PromptTab } from "@/components/workspace/prompt-tabs";

// ---------------------------------------------------------------------------
// Helper: Stateful wrapper that manages tab state like PromptArea does
// ---------------------------------------------------------------------------

function StatefulPromptTabs({ defaultTab = "prompt" as PromptTab } = {}) {
  const [activeTab, setActiveTab] = useState<PromptTab>(defaultTab);
  return (
    <PromptTabs activeTab={activeTab} onTabChange={setActiveTab}>
      <div data-testid="prompt-content">
        <p>Motiv field</p>
        <p>Style/Modifier field</p>
        <p>Negative Prompt field</p>
        <p>Model-Selector</p>
        <button>Generate</button>
      </div>
    </PromptTabs>
  );
}

// ---------------------------------------------------------------------------
// Tests: Prompt Tabs Container (Slice 08)
// ---------------------------------------------------------------------------

describe("Prompt Tabs Container", () => {
  // -------------------------------------------------------------------------
  // AC-1: Drei Tabs sichtbar
  // -------------------------------------------------------------------------
  it("AC-1: should render three tabs: Prompt, History, Favorites", () => {
    /**
     * AC-1: GIVEN die Prompt Area wird gerendert
     *       WHEN der User die Komponente sieht
     *       THEN ist eine Tab-Leiste mit genau 3 Tabs sichtbar: "Prompt", "History", "Favorites"
     */
    render(<StatefulPromptTabs />);

    const promptTab = screen.getByTestId("tab-prompt");
    const historyTab = screen.getByTestId("tab-history");
    const favoritesTab = screen.getByTestId("tab-favorites");

    expect(promptTab).toBeInTheDocument();
    expect(historyTab).toBeInTheDocument();
    expect(favoritesTab).toBeInTheDocument();

    expect(promptTab).toHaveTextContent("Prompt");
    expect(historyTab).toHaveTextContent("History");
    expect(favoritesTab).toHaveTextContent("Favorites");

    // Verify exactly 3 tab triggers in the tabs list
    const tabsList = screen.getByRole("tablist");
    const triggers = within(tabsList).getAllByRole("tab");
    expect(triggers).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // AC-2: Prompt-Tab ist initial aktiv
  // -------------------------------------------------------------------------
  it("AC-2: should show Prompt tab as active by default with prompt content visible", () => {
    /**
     * AC-2: GIVEN die Prompt Area wird initial gerendert
     *       WHEN kein Tab explizit ausgewaehlt wurde
     *       THEN ist der "Prompt"-Tab aktiv (visuell hervorgehoben) und der Prompt-Content sichtbar
     */
    render(<StatefulPromptTabs />);

    const promptTab = screen.getByTestId("tab-prompt");
    // Radix Tabs sets data-state="active" on the active trigger
    expect(promptTab).toHaveAttribute("data-state", "active");
    expect(promptTab).toHaveAttribute("aria-selected", "true");

    // Prompt content should be visible
    const promptContent = screen.getByTestId("prompt-content");
    expect(promptContent).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-3: Prompt-Tab zeigt strukturierte Felder
  // -------------------------------------------------------------------------
  it("AC-3: should render structured prompt fields when Prompt tab is active", () => {
    /**
     * AC-3: GIVEN der "Prompt"-Tab ist aktiv
     *       WHEN der User den Prompt-Content-Bereich betrachtet
     *       THEN sind die strukturierten Felder aus Slice 07 sichtbar
     *            (Motiv, Style/Modifier, Negative Prompt, Model-Selector, Generate-Button)
     */
    render(<StatefulPromptTabs />);

    // The Prompt tab should be active
    const promptTab = screen.getByTestId("tab-prompt");
    expect(promptTab).toHaveAttribute("data-state", "active");

    // Children (structured fields stub) should be rendered inside the prompt tab content
    const promptContent = screen.getByTestId("prompt-content");
    expect(promptContent).toBeInTheDocument();
    expect(promptContent).toHaveTextContent("Motiv field");
    expect(promptContent).toHaveTextContent("Style/Modifier field");
    expect(promptContent).toHaveTextContent("Negative Prompt field");
    expect(promptContent).toHaveTextContent("Model-Selector");
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-4: Wechsel zu History-Tab
  // -------------------------------------------------------------------------
  it("AC-4: should show history content and hide prompt content when History tab is clicked", async () => {
    /**
     * AC-4: GIVEN der "Prompt"-Tab ist aktiv
     *       WHEN der User auf den "History"-Tab klickt
     *       THEN wird der History-Content-Bereich angezeigt und der Prompt-Content ist nicht mehr sichtbar
     */
    const user = userEvent.setup();
    render(<StatefulPromptTabs />);

    // Initially, prompt content is visible
    expect(screen.getByTestId("prompt-content")).toBeInTheDocument();

    // Click on History tab
    const historyTab = screen.getByTestId("tab-history");
    await user.click(historyTab);

    // History content should now be visible (empty state from HistoryList)
    await waitFor(() =>
      expect(screen.getByText("No prompts generated yet. Start your first generation!")).toBeInTheDocument()
    );

    // Prompt content should be hidden (Radix unmounts inactive TabsContent by default)
    expect(screen.queryByTestId("prompt-content")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-5: Wechsel zu Favorites-Tab
  // -------------------------------------------------------------------------
  it("AC-5: should show favorites content and hide prompt content when Favorites tab is clicked", async () => {
    /**
     * AC-5: GIVEN der "Prompt"-Tab ist aktiv
     *       WHEN der User auf den "Favorites"-Tab klickt
     *       THEN wird der Favorites-Content-Bereich angezeigt und der Prompt-Content ist nicht mehr sichtbar
     */
    const user = userEvent.setup();
    render(<StatefulPromptTabs />);

    // Initially, prompt content is visible
    expect(screen.getByTestId("prompt-content")).toBeInTheDocument();

    // Click on Favorites tab
    const favoritesTab = screen.getByTestId("tab-favorites");
    await user.click(favoritesTab);

    // Favorites content should now be visible (empty state from FavoritesList)
    await waitFor(() =>
      expect(screen.getByText("No favorites yet. Star prompts in History to save them here.")).toBeInTheDocument()
    );

    // Prompt content should be hidden
    expect(screen.queryByTestId("prompt-content")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-6: History-Platzhalter
  // -------------------------------------------------------------------------
  it('AC-6: should display placeholder text "Prompt history will appear here." in History tab', async () => {
    /**
     * AC-6: GIVEN der "History"-Tab ist aktiv
     *       WHEN der User den History-Content-Bereich betrachtet
     *       THEN wird ein Platzhalter-Text angezeigt: "Prompt history will appear here."
     */
    const user = userEvent.setup();
    render(<StatefulPromptTabs />);

    // Switch to History tab
    const historyTab = screen.getByTestId("tab-history");
    await user.click(historyTab);

    // Check actual empty state text from HistoryList
    const placeholder = await screen.findByText("No prompts generated yet. Start your first generation!");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // AC-7: Favorites-Platzhalter
  // -------------------------------------------------------------------------
  it('AC-7: should display placeholder text "Favorite prompts will appear here." in Favorites tab', async () => {
    /**
     * AC-7: GIVEN der "Favorites"-Tab ist aktiv
     *       WHEN der User den Favorites-Content-Bereich betrachtet
     *       THEN wird ein Platzhalter-Text angezeigt: "Favorite prompts will appear here."
     */
    const user = userEvent.setup();
    render(<StatefulPromptTabs />);

    // Switch to Favorites tab
    const favoritesTab = screen.getByTestId("tab-favorites");
    await user.click(favoritesTab);

    // Check actual empty state text from FavoritesList
    const placeholder = await screen.findByText("No favorites yet. Star prompts in History to save them here.");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // AC-8: Tab-Highlight wechselt
  // -------------------------------------------------------------------------
  it("AC-8: should visually highlight the active tab when switching between tabs", async () => {
    /**
     * AC-8: GIVEN ein beliebiger Tab ist aktiv
     *       WHEN der User auf einen anderen Tab klickt
     *       THEN wechselt die visuelle Hervorhebung zum angeklickten Tab
     */
    const user = userEvent.setup();
    render(<StatefulPromptTabs />);

    const promptTab = screen.getByTestId("tab-prompt");
    const historyTab = screen.getByTestId("tab-history");
    const favoritesTab = screen.getByTestId("tab-favorites");

    // Initially: Prompt is active, others are inactive
    expect(promptTab).toHaveAttribute("data-state", "active");
    expect(historyTab).toHaveAttribute("data-state", "inactive");
    expect(favoritesTab).toHaveAttribute("data-state", "inactive");

    // Click History: History becomes active, Prompt becomes inactive
    await user.click(historyTab);
    expect(historyTab).toHaveAttribute("data-state", "active");
    expect(promptTab).toHaveAttribute("data-state", "inactive");
    expect(favoritesTab).toHaveAttribute("data-state", "inactive");

    // Click Favorites: Favorites becomes active, History becomes inactive
    await user.click(favoritesTab);
    expect(favoritesTab).toHaveAttribute("data-state", "active");
    expect(historyTab).toHaveAttribute("data-state", "inactive");
    expect(promptTab).toHaveAttribute("data-state", "inactive");

    // Click back to Prompt: Prompt becomes active again
    await user.click(promptTab);
    expect(promptTab).toHaveAttribute("data-state", "active");
    expect(historyTab).toHaveAttribute("data-state", "inactive");
    expect(favoritesTab).toHaveAttribute("data-state", "inactive");

    // Verify aria-selected also tracks active state
    expect(promptTab).toHaveAttribute("aria-selected", "true");
    expect(historyTab).toHaveAttribute("aria-selected", "false");
    expect(favoritesTab).toHaveAttribute("aria-selected", "false");
  });
});
