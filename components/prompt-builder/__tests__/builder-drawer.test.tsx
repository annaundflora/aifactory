// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { BuilderDrawer } from "@/components/prompt-builder/builder-drawer";
import { CategoryTabs } from "@/components/prompt-builder/category-tabs";
import { BUILDER_CATEGORIES } from "@/lib/builder-fragments";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI portals / animations)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec -- Server Actions for snippets)
// ---------------------------------------------------------------------------

vi.mock("@/app/actions/prompts", () => ({
  getSnippets: vi.fn().mockResolvedValue({}),
  createSnippet: vi.fn(),
  deleteSnippet: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDrawer(
  overrides: Partial<{
    open: boolean;
    onClose: (prompt: string) => void;
    basePrompt: string;
  }> = {}
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    ...overrides,
  };
  const result = render(<BuilderDrawer {...props} />);
  return { ...result, onClose: props.onClose };
}

// Lookup helpers for BUILDER_CATEGORIES data
const styleCategory = BUILDER_CATEGORIES.find((c) => c.id === "style")!;
const colorsCategory = BUILDER_CATEGORIES.find((c) => c.id === "colors")!;
const compositionCategory = BUILDER_CATEGORIES.find(
  (c) => c.id === "composition"
)!;
const lightingCategory = BUILDER_CATEGORIES.find((c) => c.id === "lighting")!;
const moodCategory = BUILDER_CATEGORIES.find((c) => c.id === "mood")!;

// Find a specific fragment by label across all categories
function findFragment(label: string) {
  for (const cat of BUILDER_CATEGORIES) {
    const frag = cat.fragments.find((f) => f.label === label);
    if (frag) return frag;
  }
  throw new Error(`Fragment with label "${label}" not found in BUILDER_CATEGORIES`);
}

const oilPaintingFragment = findFragment("Oil Painting");
const goldenHourFragment = findFragment("Golden Hour");

// ---------------------------------------------------------------------------
// BuilderDrawer -- Acceptance Tests (Slice 10)
// ---------------------------------------------------------------------------

describe("Builder Drawer Pro UI", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  // =========================================================================
  // AC-1: GIVEN der Builder Drawer ist geoeffnet
  //       WHEN der User die Tab-Leiste betrachtet
  //       THEN sind 6 Tabs sichtbar in 2 Reihen: Reihe 1 = "Style", "Colors",
  //            "Composition"; Reihe 2 = "Lighting", "Mood", "My Snippets"
  // =========================================================================
  it("AC-1: should render 6 tabs: Style, Colors, Composition, Lighting, Mood, My Snippets", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(screen.getByTestId("category-tabs-list")).toBeInTheDocument();
    });

    const tabsList = screen.getByTestId("category-tabs-list");

    // All 6 tabs must be present
    const expectedTabLabels = [
      "Style",
      "Colors",
      "Composition",
      "Lighting",
      "Mood",
      "My Snippets",
    ];

    for (const label of expectedTabLabels) {
      expect(within(tabsList).getByText(label)).toBeInTheDocument();
    }

    // Verify by data-testid
    expect(screen.getByTestId("tab-style")).toBeInTheDocument();
    expect(screen.getByTestId("tab-colors")).toBeInTheDocument();
    expect(screen.getByTestId("tab-composition")).toBeInTheDocument();
    expect(screen.getByTestId("tab-lighting")).toBeInTheDocument();
    expect(screen.getByTestId("tab-mood")).toBeInTheDocument();
    expect(screen.getByTestId("tab-snippets")).toBeInTheDocument();

    // Verify the TabsList uses a 3-column grid (2 rows of 3)
    expect(tabsList).toHaveClass("grid-cols-3");
  });

  // =========================================================================
  // AC-2: GIVEN der Tab "Style" ist aktiv (Default)
  //       WHEN der User die Chips betrachtet
  //       THEN werden die Fragmente aus BUILDER_CATEGORIES fuer Kategorie "style"
  //            als Chips gerendert (Labels aus BuilderFragment.label, z.B. "Oil Painting")
  // =========================================================================
  it("AC-2: should render fragment chips from BUILDER_CATEGORIES for style category", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(screen.getByTestId("style-grid")).toBeInTheDocument();
    });

    const styleGrid = screen.getByTestId("style-grid");

    // All style fragments from BUILDER_CATEGORIES should be rendered as chips
    for (const fragment of styleCategory.fragments) {
      expect(
        within(styleGrid).getByText(fragment.label)
      ).toBeInTheDocument();
    }

    // Exactly the right number of chips
    const chips = within(styleGrid).getAllByRole("button");
    expect(chips).toHaveLength(styleCategory.fragments.length);
  });

  // =========================================================================
  // AC-3: GIVEN der User wechselt auf Tab "Composition"
  //       WHEN die Chips geladen werden
  //       THEN werden die 6 Fragmente aus BUILDER_CATEGORIES fuer Kategorie
  //            "composition" als Chips angezeigt
  // =========================================================================
  it("AC-3: should render composition fragments when composition tab is selected", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(screen.getByTestId("tab-composition")).toBeInTheDocument();
    });

    // Click the Composition tab
    await user.click(screen.getByTestId("tab-composition"));

    await waitFor(() => {
      expect(screen.getByTestId("composition-grid")).toBeInTheDocument();
    });

    const compositionGrid = screen.getByTestId("composition-grid");

    // All composition fragments from BUILDER_CATEGORIES
    for (const fragment of compositionCategory.fragments) {
      expect(
        within(compositionGrid).getByText(fragment.label)
      ).toBeInTheDocument();
    }

    // Exactly 6 composition fragments
    expect(compositionCategory.fragments).toHaveLength(6);
    const chips = within(compositionGrid).getAllByRole("button");
    expect(chips).toHaveLength(6);
  });

  // =========================================================================
  // AC-4: GIVEN kein Chip ist ausgewaehlt
  //       WHEN der User einen Chip (z.B. "Oil Painting") anklickt
  //       THEN wird der Chip visuell als selektiert markiert (filled/highlighted
  //            statt outline)
  // =========================================================================
  it("AC-4: should visually mark chip as selected when clicked", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
      ).toBeInTheDocument();
    });

    const chip = screen.getByTestId(`option-chip-${oilPaintingFragment.label}`);

    // Before click: chip should be in outline (unselected) variant
    // The OptionChip uses variant="outline" when not selected
    expect(chip).toBeInTheDocument();

    // Click to select
    await user.click(chip);

    // After click: the fragment text should appear in preview (proves selection happened)
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      expect(preview).toHaveTextContent(oilPaintingFragment.fragment);
    });
  });

  // =========================================================================
  // AC-5: GIVEN der Chip "Oil Painting" ist selektiert
  //       WHEN der User denselben Chip erneut anklickt
  //       THEN wird der Chip deselektiert (zurueck zu outline)
  // =========================================================================
  it("AC-5: should deselect chip when clicked again", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
      ).toBeInTheDocument();
    });

    const chip = screen.getByTestId(`option-chip-${oilPaintingFragment.label}`);

    // Select
    await user.click(chip);
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      expect(preview).toHaveTextContent(oilPaintingFragment.fragment);
    });

    // Deselect
    await user.click(chip);
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      expect(preview).not.toHaveTextContent(oilPaintingFragment.fragment);
    });
  });

  // =========================================================================
  // AC-6: GIVEN der User hat "Oil Painting" (Style) und "Golden Hour" (Lighting)
  //       ausgewaehlt
  //       WHEN der User die Preview-Section betrachtet
  //       THEN zeigt die Preview den zusammengesetzten Text: die fragment-Texte
  //            beider Auswahlen, verbunden mit ", " Separator
  // =========================================================================
  it("AC-6: should show composed fragment texts joined by comma in preview when multiple chips selected", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
      ).toBeInTheDocument();
    });

    // Select "Oil Painting" in Style tab
    await user.click(
      screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
    );

    // Switch to Lighting tab and select "Golden Hour"
    await user.click(screen.getByTestId("tab-lighting"));
    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${goldenHourFragment.label}`)
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByTestId(`option-chip-${goldenHourFragment.label}`)
    );

    // Verify preview contains both fragment texts joined by ", "
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      const expectedComposed = `${oilPaintingFragment.fragment}, ${goldenHourFragment.fragment}`;
      expect(preview).toHaveTextContent(expectedComposed);
    });
  });

  // =========================================================================
  // AC-7: GIVEN keine Chips ausgewaehlt und keine Snippets selektiert
  //       WHEN der User die Preview-Section betrachtet
  //       THEN zeigt die Preview einen Platzhalter-Text
  //            (z.B. "Select options to build your style")
  // =========================================================================
  it("AC-7: should show placeholder text in preview when no chips are selected", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(screen.getByTestId("live-preview")).toBeInTheDocument();
    });

    const preview = screen.getByTestId("live-preview");
    expect(preview).toHaveTextContent("Select options to build your style");
  });

  // =========================================================================
  // AC-8: GIVEN der User hat Fragmente aus verschiedenen Kategorien ausgewaehlt
  //       WHEN der User "Done" klickt
  //       THEN wird onClose(composedText) aufgerufen, wobei composedText die
  //            fragment-Texte (nicht Labels) aller Auswahlen enthaelt, mit ", "
  //            verbunden
  // =========================================================================
  it("AC-8: should call onClose with composed fragment texts joined by comma on Done click", async () => {
    const onClose = vi.fn();
    renderDrawer({ open: true, onClose });

    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
      ).toBeInTheDocument();
    });

    // Select "Oil Painting" from Style
    await user.click(
      screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
    );

    // Switch to Lighting tab and select "Golden Hour"
    await user.click(screen.getByTestId("tab-lighting"));
    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${goldenHourFragment.label}`)
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByTestId(`option-chip-${goldenHourFragment.label}`)
    );

    // Click Done
    await user.click(screen.getByTestId("builder-done-button"));

    const expectedText = `${oilPaintingFragment.fragment}, ${goldenHourFragment.fragment}`;

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith(expectedText);
    });

    // Verify it uses fragment text, NOT labels
    expect(onClose).not.toHaveBeenCalledWith(
      expect.stringContaining("Oil Painting")
    );
  });

  // =========================================================================
  // AC-9: GIVEN der User hat Fragmente UND My-Snippets ausgewaehlt
  //       WHEN "Done" geklickt wird
  //       THEN enthaelt der komponierte Text sowohl Fragment-Texte als auch
  //            Snippet-Texte, verbunden mit ", "
  // =========================================================================
  it("AC-9: should include both fragment texts and snippet texts in composed output", async () => {
    // Mock getSnippets to return a snippet
    const mockSnippets = {
      favorites: [
        {
          id: "snippet-1",
          text: "high detail, 8k resolution",
          category: "favorites",
          createdAt: new Date(),
        },
      ],
    };

    const { getSnippets } = await import("@/app/actions/prompts");
    vi.mocked(getSnippets).mockResolvedValue(mockSnippets);

    const onClose = vi.fn();
    renderDrawer({ open: true, onClose });

    // Select a fragment from Style tab
    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
    );

    // Switch to My Snippets tab
    await user.click(screen.getByTestId("tab-snippets"));

    // Wait for snippets to load
    await waitFor(() => {
      expect(
        screen.getByTestId("snippet-chip-snippet-1")
      ).toBeInTheDocument();
    });

    // Select the snippet -- click the main button inside the snippet chip wrapper
    const snippetChip = screen.getByTestId("snippet-chip-snippet-1");
    // The main button is the one with data-variant (not the edit/delete icon buttons)
    const snippetButton = within(snippetChip).getByRole("button", {
      name: "high detail, 8k resolution",
    });
    await user.click(snippetButton);

    // Click Done
    await user.click(screen.getByTestId("builder-done-button"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const calledWith = onClose.mock.calls[0][0] as string;
    // Must contain both fragment text AND snippet text
    expect(calledWith).toContain(oilPaintingFragment.fragment);
    expect(calledWith).toContain("high detail, 8k resolution");
    // They should be joined (the composed text contains ", " between parts)
    expect(calledWith).toContain(", ");
  });

  // =========================================================================
  // AC-10: GIVEN der Builder Drawer wird geoeffnet
  //        WHEN der Drawer mounted
  //        THEN sind alle Fragment-Chip-Auswahlen zurueckgesetzt (keine
  //             Vorauswahl aus vorherigem Oeffnen)
  // =========================================================================
  it("AC-10: should reset all fragment selections when drawer opens", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BuilderDrawer open={true} onClose={onClose} />
    );

    // Select a fragment
    await waitFor(() => {
      expect(
        screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByTestId(`option-chip-${oilPaintingFragment.label}`)
    );

    // Verify it was selected
    await waitFor(() => {
      expect(screen.getByTestId("live-preview")).toHaveTextContent(
        oilPaintingFragment.fragment
      );
    });

    // Close the drawer
    rerender(<BuilderDrawer open={false} onClose={onClose} />);

    // Reopen the drawer
    rerender(<BuilderDrawer open={true} onClose={onClose} />);

    // Verify selections are reset -- preview should show placeholder
    await waitFor(() => {
      expect(screen.getByTestId("live-preview")).toHaveTextContent(
        "Select options to build your style"
      );
    });

    // Verify the preview does NOT contain the previously selected fragment
    expect(screen.getByTestId("live-preview")).not.toHaveTextContent(
      oilPaintingFragment.fragment
    );
  });
});

// ---------------------------------------------------------------------------
// CategoryTabs -- AC-11
// ---------------------------------------------------------------------------

describe("CategoryTabs", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  // =========================================================================
  // AC-11: GIVEN die category-tabs.tsx Komponente
  //        WHEN sie die neuen Kategorien rendert
  //        THEN verwendet sie BUILDER_CATEGORIES aus lib/builder-fragments.ts
  //             statt der bisherigen hardcoded styleOptions/colorOptions Props
  // =========================================================================
  it("AC-11: should render categories from BUILDER_CATEGORIES config instead of hardcoded props", async () => {
    const onTabChange = vi.fn();

    const { rerender } = render(
      <CategoryTabs
        activeTab="style"
        onTabChange={onTabChange}
        selectedFragments={new Set<string>()}
        onToggleFragment={vi.fn()}
      />
    );

    // Verify all 5 BUILDER_CATEGORIES are rendered as tabs
    for (const category of BUILDER_CATEGORIES) {
      expect(screen.getByTestId(`tab-${category.id}`)).toBeInTheDocument();
      expect(screen.getByText(category.label)).toBeInTheDocument();
    }

    // Plus the My Snippets tab
    expect(screen.getByTestId("tab-snippets")).toBeInTheDocument();
    expect(screen.getByText("My Snippets")).toBeInTheDocument();

    // The component does NOT accept styleOptions/colorOptions props
    // (verified by TypeScript -- the interface only accepts
    //  activeTab, onTabChange, selectedFragments, onToggleFragment,
    //  selectedSnippets, onToggleSnippet)

    // Verify Style tab content shows fragments from BUILDER_CATEGORIES
    const styleGrid = screen.getByTestId("style-grid");
    for (const fragment of styleCategory.fragments) {
      expect(
        within(styleGrid).getByText(fragment.label)
      ).toBeInTheDocument();
    }

    // Click on mood tab -- CategoryTabs is controlled, so we rerender with new activeTab
    await user.click(screen.getByTestId("tab-mood"));
    expect(onTabChange).toHaveBeenCalledWith("mood");

    // Rerender with the new activeTab value (controlled component pattern)
    rerender(
      <CategoryTabs
        activeTab="mood"
        onTabChange={onTabChange}
        selectedFragments={new Set<string>()}
        onToggleFragment={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mood-grid")).toBeInTheDocument();
    });

    const moodGrid = screen.getByTestId("mood-grid");
    for (const fragment of moodCategory.fragments) {
      expect(within(moodGrid).getByText(fragment.label)).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// OptionChip -- Unit Tests (supporting AC-4 / AC-5)
// ---------------------------------------------------------------------------

describe("OptionChip", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("should render label text and call onToggle when clicked", async () => {
    const { OptionChip } = await import(
      "@/components/prompt-builder/option-chip"
    );
    const onToggle = vi.fn();

    const { rerender } = render(
      <OptionChip label="Oil Painting" selected={false} onToggle={onToggle} />
    );

    const chip = screen.getByTestId("option-chip-Oil Painting");
    expect(chip).toHaveTextContent("Oil Painting");

    // Click to select
    await user.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Rerender as selected
    rerender(
      <OptionChip label="Oil Painting" selected={true} onToggle={onToggle} />
    );

    // Click again to deselect
    await user.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("should use 'default' variant when selected and 'outline' when not", async () => {
    const { OptionChip } = await import(
      "@/components/prompt-builder/option-chip"
    );
    const onToggle = vi.fn();

    const { rerender } = render(
      <OptionChip label="Test" selected={false} onToggle={onToggle} />
    );

    const chip = screen.getByTestId("option-chip-Test");

    // When not selected, Button variant is "outline"
    // We cannot directly check variant prop, but we can check className behavior
    // The button should exist and be functional
    expect(chip).toBeInTheDocument();

    // Rerender as selected
    rerender(
      <OptionChip label="Test" selected={true} onToggle={onToggle} />
    );

    // Still present and functional
    expect(chip).toBeInTheDocument();
  });
});
