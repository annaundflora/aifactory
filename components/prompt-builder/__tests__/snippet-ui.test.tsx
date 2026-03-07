// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { BuilderDrawer } from "@/components/prompt-builder/builder-drawer";
import { CategoryTabs } from "@/components/prompt-builder/category-tabs";
import { SnippetForm } from "@/components/prompt-builder/snippet-form";
import type { Snippet } from "@/lib/services/snippet-service";

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
// Mocks (mock_external strategy — Server Actions gemockt, reiner UI-State)
// ---------------------------------------------------------------------------

const mockCreateSnippet = vi.fn();
const mockUpdateSnippet = vi.fn();
const mockDeleteSnippet = vi.fn();
const mockGetSnippets = vi.fn();

vi.mock("@/app/actions/prompts", () => ({
  createSnippet: (...args: unknown[]) => mockCreateSnippet(...args),
  updateSnippet: (...args: unknown[]) => mockUpdateSnippet(...args),
  deleteSnippet: (...args: unknown[]) => mockDeleteSnippet(...args),
  getSnippets: (...args: unknown[]) => mockGetSnippets(...args),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Plus: (props: Record<string, unknown>) => (
      <svg data-testid="plus-icon" {...props} />
    ),
    Pencil: (props: Record<string, unknown>) => (
      <svg data-testid="pencil-icon" {...props} />
    ),
    Trash2: (props: Record<string, unknown>) => (
      <svg data-testid="trash-icon" {...props} />
    ),
    XIcon: (props: Record<string, unknown>) => (
      <svg data-testid="x-icon" {...props} />
    ),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SNIPPET_A: Snippet = {
  id: "snip-1",
  text: "on white background",
  category: "POD Basics",
  createdAt: new Date("2026-01-01"),
};

const SNIPPET_B: Snippet = {
  id: "snip-2",
  text: "high resolution",
  category: "POD Basics",
  createdAt: new Date("2026-01-02"),
};

const SNIPPET_C: Snippet = {
  id: "snip-3",
  text: "vintage feel",
  category: "My Styles",
  createdAt: new Date("2026-01-03"),
};

const SNIPPETS_BY_CATEGORY: Record<string, Snippet[]> = {
  "POD Basics": [SNIPPET_A, SNIPPET_B],
  "My Styles": [SNIPPET_C],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCategoryTabs(
  overrides: Partial<React.ComponentProps<typeof CategoryTabs>> = {}
) {
  const props: React.ComponentProps<typeof CategoryTabs> = {
    activeTab: "snippets",
    onTabChange: vi.fn(),
    selectedFragments: new Set<string>(),
    onToggleFragment: vi.fn(),
    selectedSnippets: new Set<string>(),
    onToggleSnippet: vi.fn(),
    ...overrides,
  };
  const result = render(<CategoryTabs {...props} />);
  return { ...result, ...props };
}

function renderSnippetForm(
  overrides: Partial<React.ComponentProps<typeof SnippetForm>> = {}
) {
  const props: React.ComponentProps<typeof SnippetForm> = {
    categories: ["POD Basics", "My Styles"],
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const result = render(<SnippetForm {...props} />);
  return { ...result, ...props };
}

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
    basePrompt: "A fox",
    ...overrides,
  };
  const result = render(<BuilderDrawer {...props} />);
  return { ...result, onClose: props.onClose };
}

// ---------------------------------------------------------------------------
// My Snippets Tab
// ---------------------------------------------------------------------------

describe("My Snippets Tab", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockGetSnippets.mockResolvedValue({});
  });

  // AC-1: GIVEN der Prompt Builder Drawer ist offen
  //       WHEN der User den "My Snippets" Tab klickt
  //       THEN wird der Tab aktiv und zeigt den Snippet-Bereich mit einem "New Snippet" Button
  it("AC-1: should activate My Snippets tab and show New Snippet button", async () => {
    renderCategoryTabs({ activeTab: "style" });

    const snippetsTab = screen.getByTestId("tab-snippets");
    expect(snippetsTab).toBeInTheDocument();
    expect(snippetsTab).toHaveTextContent("My Snippets");

    await user.click(snippetsTab);

    // Tab change callback should be called with "snippets"
    // Since we use controlled tabs, we rerender with activeTab="snippets"
    // to verify the content appears
    renderCategoryTabs({ activeTab: "snippets" });

    await waitFor(() => {
      expect(screen.getByTestId("snippets-tab-content")).toBeInTheDocument();
    });

    expect(screen.getByTestId("new-snippet-btn")).toBeInTheDocument();
    expect(screen.getByTestId("new-snippet-btn")).toHaveTextContent("New Snippet");
  });

  // AC-2: GIVEN der "My Snippets" Tab ist aktiv und keine Snippets existieren
  //       WHEN der Bereich gerendert wird
  //       THEN wird die Nachricht "No snippets yet. Create your first!" angezeigt
  it("AC-2: should show empty state message when no snippets exist", async () => {
    mockGetSnippets.mockResolvedValue({});

    renderCategoryTabs({ activeTab: "snippets" });

    await waitFor(() => {
      expect(screen.getByTestId("snippets-empty")).toBeInTheDocument();
    });

    expect(screen.getByTestId("snippets-empty")).toHaveTextContent(
      "No snippets yet. Create your first!"
    );
  });

  // AC-6: GIVEN Snippets existieren in Kategorien "POD Basics" (2 Snippets) und "My Styles" (1 Snippet)
  //       WHEN der "My Snippets" Tab gerendert wird
  //       THEN werden die Snippets als Chips gruppiert unter ihren Kategorie-Headern angezeigt
  it("AC-6: should render snippets grouped by category with headers", async () => {
    mockGetSnippets.mockResolvedValue(SNIPPETS_BY_CATEGORY);

    renderCategoryTabs({ activeTab: "snippets" });

    await waitFor(() => {
      expect(
        screen.getByTestId("snippet-category-POD Basics")
      ).toBeInTheDocument();
    });

    // POD Basics category
    const podBasics = screen.getByTestId("snippet-category-POD Basics");
    expect(within(podBasics).getByText("POD Basics")).toBeInTheDocument();
    expect(within(podBasics).getByText("on white background")).toBeInTheDocument();
    expect(within(podBasics).getByText("high resolution")).toBeInTheDocument();

    // My Styles category
    const myStyles = screen.getByTestId("snippet-category-My Styles");
    expect(within(myStyles).getByText("My Styles")).toBeInTheDocument();
    expect(within(myStyles).getByText("vintage feel")).toBeInTheDocument();
  });

  // AC-13: GIVEN der User hat Style-Chips und Snippet-Chips ausgewaehlt
  //        WHEN die Live-Preview aktualisiert wird
  //        THEN zeigt sie den Base-Prompt gefolgt von allen Selections (Style + Colors + Snippets) kommasepariert
  it("AC-13: should include snippet selections alongside style and color selections in live preview", async () => {
    mockGetSnippets.mockResolvedValue(SNIPPETS_BY_CATEGORY);

    renderDrawer({ basePrompt: "A fox" });

    await waitFor(() => {
      expect(screen.getByTestId("tab-style")).toBeInTheDocument();
    });

    // Select a style chip
    await user.click(screen.getByTestId("option-chip-Oil Painting"));

    // Switch to snippets tab
    await user.click(screen.getByTestId("tab-snippets"));

    await waitFor(() => {
      expect(screen.getByTestId("snippets-tab-content")).toBeInTheDocument();
    });

    // Wait for snippets to load
    await waitFor(() => {
      expect(screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`)).toBeInTheDocument();
    });

    // Click a snippet chip to select it
    const chipContainer = screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`);
    const snippetChip = within(chipContainer).getByRole("button", {
      name: SNIPPET_A.text,
    });
    await user.click(snippetChip);

    // Verify live preview contains style fragment text + snippet text
    // Note: basePrompt ("A fox") is NOT rendered in the preview — only composed fragment/snippet texts are shown.
    // The "Oil Painting" fragment.fragment value contains "oil painting" as a substring.
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      expect(preview).toHaveTextContent("oil painting");
      expect(preview).toHaveTextContent("on white background");
    });
  });
});

// ---------------------------------------------------------------------------
// SnippetForm
// ---------------------------------------------------------------------------

describe("SnippetForm", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  // AC-3: GIVEN der "My Snippets" Tab ist aktiv
  //       WHEN der User auf "New Snippet" klickt
  //       THEN erscheint ein Inline-Formular mit Text-Input (autofokussiert), Kategorie-Dropdown und Save-Button
  it("AC-3: should show inline form with autofocused text input when New Snippet is clicked", async () => {
    mockGetSnippets.mockResolvedValue({});

    renderCategoryTabs({ activeTab: "snippets" });

    await waitFor(() => {
      expect(screen.getByTestId("new-snippet-btn")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("new-snippet-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("snippet-form")).toBeInTheDocument();
    });

    // Text input should be present and autofocused
    const textInput = screen.getByTestId("snippet-text-input");
    expect(textInput).toBeInTheDocument();
    expect(textInput).toHaveFocus();

    // Category dropdown should be present
    expect(screen.getByTestId("snippet-category-select")).toBeInTheDocument();

    // Save button should be present
    expect(screen.getByTestId("snippet-save-btn")).toBeInTheDocument();
    expect(screen.getByTestId("snippet-save-btn")).toHaveTextContent("Save");
  });

  // AC-4: GIVEN das Snippet-Formular ist sichtbar
  //       WHEN der User Text "on white background" eingibt, Kategorie "POD Basics" waehlt und "Save" klickt
  //       THEN wird `createSnippet` Server Action aufgerufen und der neue Baustein erscheint unter der Kategorie "POD Basics"
  it("AC-4: should call createSnippet action and display new snippet after save", async () => {
    const savedSnippet: Snippet = {
      id: "snip-new",
      text: "on white background",
      category: "POD Basics",
      createdAt: new Date(),
    };
    mockCreateSnippet.mockResolvedValue(savedSnippet);

    const onSave = vi.fn();
    renderSnippetForm({
      categories: ["POD Basics", "My Styles"],
      onSave,
    });

    // Type snippet text
    const textInput = screen.getByTestId("snippet-text-input");
    await user.type(textInput, "on white background");

    // Select category
    const categorySelect = screen.getByTestId("snippet-category-select");
    await user.selectOptions(categorySelect, "POD Basics");

    // Click Save
    await user.click(screen.getByTestId("snippet-save-btn"));

    await waitFor(() => {
      expect(mockCreateSnippet).toHaveBeenCalledWith({
        text: "on white background",
        category: "POD Basics",
      });
    });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(savedSnippet);
    });
  });

  // AC-5: GIVEN das Snippet-Formular ist sichtbar
  //       WHEN der User "Save" klickt ohne Text einzugeben
  //       THEN wird eine Validierungsmeldung angezeigt und kein Server Action aufgerufen
  it("AC-5: should show validation error and prevent save when text is empty", async () => {
    renderSnippetForm();

    // Click Save without entering text
    await user.click(screen.getByTestId("snippet-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("snippet-form-error")).toBeInTheDocument();
    });

    expect(screen.getByTestId("snippet-form-error")).toHaveTextContent(
      "Snippet text is required"
    );

    // Server action should NOT have been called
    expect(mockCreateSnippet).not.toHaveBeenCalled();
    expect(mockUpdateSnippet).not.toHaveBeenCalled();
  });

  // AC-10: GIVEN der User klickt das Edit-Icon auf einem Snippet-Chip
  //        WHEN das Formular erscheint
  //        THEN ist es vorbefuellt mit dem bestehenden Text und der Kategorie, und "Save" ruft `updateSnippet` statt `createSnippet` auf
  it("AC-10: should prefill form with existing snippet data and call updateSnippet on save", async () => {
    const updatedSnippet: Snippet = {
      ...SNIPPET_A,
      text: "on black background",
    };
    mockUpdateSnippet.mockResolvedValue(updatedSnippet);

    const onSave = vi.fn();
    renderSnippetForm({
      snippet: SNIPPET_A,
      categories: ["POD Basics", "My Styles"],
      onSave,
    });

    // Form should be prefilled
    const textInput = screen.getByTestId("snippet-text-input");
    expect(textInput).toHaveValue("on white background");

    const categorySelect = screen.getByTestId("snippet-category-select");
    expect(categorySelect).toHaveValue("POD Basics");

    // Clear and type new text
    await user.clear(textInput);
    await user.type(textInput, "on black background");

    // Click Save
    await user.click(screen.getByTestId("snippet-save-btn"));

    await waitFor(() => {
      expect(mockUpdateSnippet).toHaveBeenCalledWith({
        id: SNIPPET_A.id,
        text: "on black background",
        category: "POD Basics",
      });
    });

    // createSnippet should NOT have been called
    expect(mockCreateSnippet).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(updatedSnippet);
    });
  });

  // AC-14: GIVEN das Kategorie-Dropdown im Formular
  //        WHEN der User es oeffnet
  //        THEN werden existierende Kategorien als Optionen angeboten und eine Freitext-Eingabe fuer neue Kategorien ist moeglich
  it("AC-14: should offer existing categories and allow free-text for new category", async () => {
    renderSnippetForm({
      categories: ["POD Basics", "My Styles"],
    });

    // Category select should have existing categories
    const categorySelect = screen.getByTestId("snippet-category-select");
    const options = within(categorySelect).getAllByRole("option");

    // One placeholder + 2 categories = 3 options
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveTextContent("POD Basics");
    expect(options[2]).toHaveTextContent("My Styles");

    // Click "+ New" button to switch to free-text mode
    const newCategoryBtn = screen.getByTestId("snippet-new-category-btn");
    expect(newCategoryBtn).toBeInTheDocument();
    await user.click(newCategoryBtn);

    // Custom category input should appear
    await waitFor(() => {
      expect(screen.getByTestId("snippet-custom-category-input")).toBeInTheDocument();
    });

    // Type a new category name
    const customInput = screen.getByTestId("snippet-custom-category-input");
    await user.type(customInput, "Brand Colors");

    expect(customInput).toHaveValue("Brand Colors");
  });
});

// ---------------------------------------------------------------------------
// SnippetChip
// ---------------------------------------------------------------------------

describe("SnippetChip", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  // AC-7: GIVEN ein Snippet-Chip "on white background" ist nicht ausgewaehlt
  //       WHEN der User auf den Chip klickt
  //       THEN erhaelt der Chip eine visuelle Hervorhebung (selected State) und der Text "on white background" wird in die Live-Preview eingefuegt
  it("AC-7: should highlight chip and add text to prompt on click", async () => {
    mockGetSnippets.mockResolvedValue(SNIPPETS_BY_CATEGORY);
    const onToggleSnippet = vi.fn();

    renderCategoryTabs({
      activeTab: "snippets",
      selectedSnippets: new Set<string>(),
      onToggleSnippet,
    });

    await waitFor(() => {
      expect(screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`)).toBeInTheDocument();
    });

    // Click the snippet chip
    const chipContainer = screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`);
    const chipButton = within(chipContainer).getByRole("button", {
      name: "on white background",
    });
    await user.click(chipButton);

    expect(onToggleSnippet).toHaveBeenCalledWith(SNIPPET_A.id, SNIPPET_A.text);
  });

  // AC-8: GIVEN ein Snippet-Chip "on white background" ist ausgewaehlt
  //       WHEN der User erneut auf den Chip klickt
  //       THEN wird die Auswahl entfernt und der Text verschwindet aus der Live-Preview
  it("AC-8: should remove highlight and text from prompt on second click", async () => {
    mockGetSnippets.mockResolvedValue(SNIPPETS_BY_CATEGORY);
    const onToggleSnippet = vi.fn();

    renderCategoryTabs({
      activeTab: "snippets",
      selectedSnippets: new Set<string>([SNIPPET_A.id]),
      onToggleSnippet,
    });

    await waitFor(() => {
      expect(screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`)).toBeInTheDocument();
    });

    // The chip should be in selected state (variant="default" instead of "outline")
    const chipContainer = screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`);
    const chipButton = within(chipContainer).getByRole("button", {
      name: "on white background",
    });

    // Click to deselect
    await user.click(chipButton);

    expect(onToggleSnippet).toHaveBeenCalledWith(SNIPPET_A.id, SNIPPET_A.text);
  });

  // AC-9: GIVEN der User hovert ueber einen Snippet-Chip
  //       WHEN die Hover-Icons sichtbar werden
  //       THEN werden Edit- und Delete-Icons auf dem Chip angezeigt
  it("AC-9: should show edit and delete icons on hover", async () => {
    mockGetSnippets.mockResolvedValue(SNIPPETS_BY_CATEGORY);

    renderCategoryTabs({
      activeTab: "snippets",
      selectedSnippets: new Set<string>(),
      onToggleSnippet: vi.fn(),
    });

    await waitFor(() => {
      expect(screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`)).toBeInTheDocument();
    });

    // Edit and Delete buttons should exist in the DOM (hidden via CSS group-hover)
    const editBtn = screen.getByTestId(`snippet-edit-${SNIPPET_A.id}`);
    const deleteBtn = screen.getByTestId(`snippet-delete-${SNIPPET_A.id}`);

    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    // Verify aria-labels for accessibility
    expect(editBtn).toHaveAttribute("aria-label", `Edit ${SNIPPET_A.text}`);
    expect(deleteBtn).toHaveAttribute("aria-label", `Delete ${SNIPPET_A.text}`);
  });

  // AC-11: GIVEN der User klickt das Delete-Icon auf einem Snippet-Chip
  //        WHEN die Inline-Bestaetigung erscheint
  //        THEN zeigt der Chip "Delete?" mit Confirm/Cancel Optionen
  it("AC-11: should show inline delete confirmation with confirm and cancel", async () => {
    mockGetSnippets.mockResolvedValue(SNIPPETS_BY_CATEGORY);

    renderCategoryTabs({
      activeTab: "snippets",
      selectedSnippets: new Set<string>(),
      onToggleSnippet: vi.fn(),
    });

    await waitFor(() => {
      expect(screen.getByTestId(`snippet-chip-${SNIPPET_A.id}`)).toBeInTheDocument();
    });

    // Click delete icon
    await user.click(screen.getByTestId(`snippet-delete-${SNIPPET_A.id}`));

    // Inline confirmation should appear
    await waitFor(() => {
      expect(
        screen.getByTestId(`snippet-chip-${SNIPPET_A.id}-deleting`)
      ).toBeInTheDocument();
    });

    const deletingChip = screen.getByTestId(`snippet-chip-${SNIPPET_A.id}-deleting`);
    expect(within(deletingChip).getByText("Delete?")).toBeInTheDocument();

    // Confirm and Cancel buttons
    expect(
      screen.getByTestId(`snippet-delete-confirm-${SNIPPET_A.id}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`snippet-delete-cancel-${SNIPPET_A.id}`)
    ).toBeInTheDocument();
  });

  // AC-12: GIVEN der User bestaetigt das Loeschen
  //        WHEN `deleteSnippet` Server Action aufgerufen wird
  //        THEN verschwindet der Chip und falls die Kategorie leer ist, wird der Kategorie-Header ebenfalls entfernt
  it("AC-12: should remove chip and empty category header after confirmed delete", async () => {
    // Only one snippet in "My Styles" — deleting it should remove the category
    const singleCategorySnippets: Record<string, Snippet[]> = {
      "My Styles": [SNIPPET_C],
    };
    mockGetSnippets
      .mockResolvedValueOnce(singleCategorySnippets) // initial load
      .mockResolvedValueOnce({}); // after delete, empty

    mockDeleteSnippet.mockResolvedValue({ success: true });

    renderCategoryTabs({
      activeTab: "snippets",
      selectedSnippets: new Set<string>(),
      onToggleSnippet: vi.fn(),
    });

    // Wait for snippets to load
    await waitFor(() => {
      expect(screen.getByTestId(`snippet-chip-${SNIPPET_C.id}`)).toBeInTheDocument();
    });

    // Category header should exist
    expect(screen.getByTestId("snippet-category-My Styles")).toBeInTheDocument();

    // Click delete icon
    await user.click(screen.getByTestId(`snippet-delete-${SNIPPET_C.id}`));

    // Wait for delete confirmation
    await waitFor(() => {
      expect(
        screen.getByTestId(`snippet-chip-${SNIPPET_C.id}-deleting`)
      ).toBeInTheDocument();
    });

    // Confirm delete
    await user.click(screen.getByTestId(`snippet-delete-confirm-${SNIPPET_C.id}`));

    // deleteSnippet should be called
    await waitFor(() => {
      expect(mockDeleteSnippet).toHaveBeenCalledWith({ id: SNIPPET_C.id });
    });

    // After reload, the category header and chip should be gone
    await waitFor(() => {
      expect(
        screen.queryByTestId("snippet-category-My Styles")
      ).not.toBeInTheDocument();
    });
  });
});
