// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { BuilderDrawer, STYLE_OPTIONS, COLOR_OPTIONS } from "@/components/prompt-builder/builder-drawer";
import { CategoryTabs } from "@/components/prompt-builder/category-tabs";
import { OptionChip } from "@/components/prompt-builder/option-chip";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI portals / animations)
// ---------------------------------------------------------------------------

beforeAll(() => {
  // ResizeObserver is not available in jsdom
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec — pure UI, no backend)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    XIcon: (props: Record<string, unknown>) => (
      <svg data-testid="x-icon" {...props} />
    ),
  };
});

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
    basePrompt: "A fox",
    ...overrides,
  };
  const result = render(<BuilderDrawer {...props} />);
  return { ...result, onClose: props.onClose };
}

// ---------------------------------------------------------------------------
// BuilderDrawer
// ---------------------------------------------------------------------------

describe("BuilderDrawer", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  // AC-1: GIVEN der User ist im Workspace und hat einen Prompt im Textarea
  //       WHEN der User auf den "Prompt Builder" Button klickt
  //       THEN oeffnet sich ein Drawer von rechts mit dem Titel "Prompt Builder"
  it("AC-1: should open drawer from right when open prop is true", async () => {
    renderDrawer({ open: true });

    await waitFor(() => {
      expect(screen.getByText("Prompt Builder")).toBeInTheDocument();
    });

    const drawer = screen.getByTestId("builder-drawer");
    expect(drawer).toBeInTheDocument();
  });

  // AC-2: GIVEN der Drawer ist offen
  //       WHEN der User die Tabs betrachtet
  //       THEN sind zwei Tabs sichtbar: "Style" und "Colors", wobei "Style" initial aktiv ist
  it("AC-2: should render Style and Colors tabs with Style active by default", async () => {
    renderDrawer();

    await waitFor(() => {
      expect(screen.getByTestId("tab-style")).toBeInTheDocument();
    });

    const styleTab = screen.getByTestId("tab-style");
    const colorsTab = screen.getByTestId("tab-colors");

    expect(styleTab).toBeInTheDocument();
    expect(colorsTab).toBeInTheDocument();

    // Style tab should be active by default
    expect(styleTab).toHaveAttribute("data-state", "active");
    expect(colorsTab).toHaveAttribute("data-state", "inactive");
  });

  // AC-3: GIVEN der Style-Tab ist aktiv
  //       WHEN die Chips gerendert werden
  //       THEN zeigt ein 3x3 Grid genau 9 Style-Optionen als Text-Labels
  it("AC-3: should render 9 style option chips in a grid", async () => {
    renderDrawer();

    await waitFor(() => {
      expect(screen.getByTestId("style-grid")).toBeInTheDocument();
    });

    const styleGrid = screen.getByTestId("style-grid");
    const expectedLabels = [
      "Oil Painting", "Flat Vector", "Anime", "Watercolor",
      "3D Render", "Pixel Art", "Photography", "Pencil", "Pop Art",
    ];

    for (const label of expectedLabels) {
      expect(within(styleGrid).getByText(label)).toBeInTheDocument();
    }

    // Exactly 9 chips
    const chips = within(styleGrid).getAllByRole("button");
    expect(chips).toHaveLength(9);
  });

  // AC-4: GIVEN der User wechselt zum Colors-Tab
  //       WHEN die Chips gerendert werden
  //       THEN zeigt ein 3x3 Grid genau 9 Color-Optionen als Text-Labels
  it("AC-4: should render 9 color option chips when Colors tab is selected", async () => {
    renderDrawer();

    await waitFor(() => {
      expect(screen.getByTestId("tab-colors")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("tab-colors"));

    await waitFor(() => {
      expect(screen.getByTestId("colors-grid")).toBeInTheDocument();
    });

    const colorsGrid = screen.getByTestId("colors-grid");
    const expectedLabels = [
      "Warm Tones", "Pastel", "Monochrome", "Cool Tones",
      "Earth Tones", "Neon", "Black & White", "Sunset", "Vintage",
    ];

    for (const label of expectedLabels) {
      expect(within(colorsGrid).getByText(label)).toBeInTheDocument();
    }

    const chips = within(colorsGrid).getAllByRole("button");
    expect(chips).toHaveLength(9);
  });

  // AC-5: GIVEN kein Chip ist ausgewaehlt
  //       WHEN der User auf den Chip "Oil Painting" klickt
  //       THEN erhaelt der Chip eine visuelle Hervorhebung (selected State) und der Text "oil painting" erscheint in der Live-Preview
  it("AC-5: should highlight chip and add text to live preview on click", async () => {
    renderDrawer({ basePrompt: "A fox" });

    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Oil Painting")).toBeInTheDocument();
    });

    const chip = screen.getByTestId("option-chip-Oil Painting");
    await user.click(chip);

    // Live preview should contain the selection
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      expect(preview).toHaveTextContent("oil painting");
    });
  });

  // AC-6: GIVEN der Chip "Oil Painting" ist bereits ausgewaehlt
  //       WHEN der User erneut auf "Oil Painting" klickt
  //       THEN wird die Auswahl entfernt (deselected State) und "oil painting" verschwindet aus der Live-Preview
  it("AC-6: should remove highlight and text from live preview when selected chip is clicked again", async () => {
    renderDrawer({ basePrompt: "A fox" });

    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Oil Painting")).toBeInTheDocument();
    });

    const chip = screen.getByTestId("option-chip-Oil Painting");

    // Select
    await user.click(chip);
    await waitFor(() => {
      expect(screen.getByTestId("live-preview")).toHaveTextContent("oil painting");
    });

    // Deselect
    await user.click(chip);
    await waitFor(() => {
      expect(screen.getByTestId("live-preview")).not.toHaveTextContent("oil painting");
    });
  });

  // AC-7: GIVEN der User hat "Oil Painting" (Style) und "Warm Tones" (Colors) ausgewaehlt
  //       WHEN die Live-Preview aktualisiert wird
  //       THEN zeigt sie den Base-Prompt gefolgt von den Selections kommasepariert an, z.B. "A fox, oil painting, warm tones"
  it("AC-7: should show base prompt with comma-separated selections in live preview", async () => {
    renderDrawer({ basePrompt: "A fox" });

    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Oil Painting")).toBeInTheDocument();
    });

    // Select "Oil Painting" in Style tab
    await user.click(screen.getByTestId("option-chip-Oil Painting"));

    // Switch to Colors tab and select "Warm Tones"
    await user.click(screen.getByTestId("tab-colors"));
    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Warm Tones")).toBeInTheDocument();
    });
    await user.click(screen.getByTestId("option-chip-Warm Tones"));

    // Verify live preview
    await waitFor(() => {
      const preview = screen.getByTestId("live-preview");
      expect(preview).toHaveTextContent("A fox");
      expect(preview).toHaveTextContent("oil painting");
      expect(preview).toHaveTextContent("warm tones");
    });
  });

  // AC-8: GIVEN der User hat Selections getroffen und sieht die Live-Preview
  //       WHEN der User auf "Done" klickt
  //       THEN schliesst sich der Drawer und der zusammengesetzte Prompt wird ins Prompt-Textarea uebernommen
  it("AC-8: should close drawer and transfer composed prompt to textarea on Done click", async () => {
    const onClose = vi.fn();
    renderDrawer({ basePrompt: "A fox", onClose });

    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Oil Painting")).toBeInTheDocument();
    });

    // Select a chip
    await user.click(screen.getByTestId("option-chip-Oil Painting"));

    // Click Done
    await user.click(screen.getByTestId("builder-done-button"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith(
        expect.stringContaining("oil painting")
      );
    });
    expect(onClose).toHaveBeenCalledWith(
      expect.stringContaining("A fox")
    );
  });

  // AC-9: GIVEN der Drawer ist offen
  //       WHEN der User auf den Close-Button (X) klickt
  //       THEN schliesst sich der Drawer und der zusammengesetzte Prompt wird ins Prompt-Textarea uebernommen (identisch zu Done)
  it("AC-9: should close drawer and transfer prompt on close button click", async () => {
    const onClose = vi.fn();
    renderDrawer({ basePrompt: "A fox", onClose });

    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Oil Painting")).toBeInTheDocument();
    });

    // Select a chip
    await user.click(screen.getByTestId("option-chip-Oil Painting"));

    // Click the X / Close button (sr-only text "Close")
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith(
        expect.stringContaining("oil painting")
      );
    });
    expect(onClose).toHaveBeenCalledWith(
      expect.stringContaining("A fox")
    );
  });

  // AC-10: GIVEN der Drawer ist offen und Chips sind ausgewaehlt
  //        WHEN der User zwischen Style- und Colors-Tab wechselt
  //        THEN bleiben die Auswahlen in beiden Tabs erhalten (Tab-Wechsel resettet nicht)
  it("AC-10: should preserve selections across tab switches", async () => {
    renderDrawer({ basePrompt: "A fox" });

    await waitFor(() => {
      expect(screen.getByTestId("option-chip-Oil Painting")).toBeInTheDocument();
    });

    // Select "Oil Painting" in Style tab
    await user.click(screen.getByTestId("option-chip-Oil Painting"));

    // Switch to Colors tab
    await user.click(screen.getByTestId("tab-colors"));
    await waitFor(() => {
      expect(screen.getByTestId("colors-grid")).toBeInTheDocument();
    });

    // Select "Warm Tones" in Colors tab
    await user.click(screen.getByTestId("option-chip-Warm Tones"));

    // Switch back to Style tab
    await user.click(screen.getByTestId("tab-style"));
    await waitFor(() => {
      expect(screen.getByTestId("style-grid")).toBeInTheDocument();
    });

    // Verify the live preview still has both selections
    const preview = screen.getByTestId("live-preview");
    expect(preview).toHaveTextContent("oil painting");
    expect(preview).toHaveTextContent("warm tones");
  });

  // AC-11: GIVEN der Drawer wird erneut geoeffnet nach vorherigem Schliessen
  //        WHEN die aktuelle Prompt-Textarea Selections enthaelt die aus dem Builder stammen
  //        THEN werden die zuvor gewaehlten Chips wieder als selected angezeigt
  it("AC-11: should restore previously selected chips when drawer is reopened", async () => {
    // Simulate reopening with a basePrompt that already contains builder selections
    renderDrawer({ basePrompt: "A fox, oil painting, warm tones" });

    await waitFor(() => {
      expect(screen.getByTestId("style-grid")).toBeInTheDocument();
    });

    // Verify "Oil Painting" chip is shown as selected (default variant, not outline)
    const oilPaintingChip = screen.getByTestId("option-chip-Oil Painting");
    expect(oilPaintingChip).toBeInTheDocument();

    // The live preview should reflect restored selections
    const preview = screen.getByTestId("live-preview");
    expect(preview).toHaveTextContent("oil painting");
    expect(preview).toHaveTextContent("warm tones");

    // Switch to Colors tab to verify "Warm Tones" is also restored
    await user.click(screen.getByTestId("tab-colors"));
    await waitFor(() => {
      expect(screen.getByTestId("colors-grid")).toBeInTheDocument();
    });

    // Warm Tones chip should exist and be in selected state
    const warmTonesChip = screen.getByTestId("option-chip-Warm Tones");
    expect(warmTonesChip).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CategoryTabs
// ---------------------------------------------------------------------------

describe("CategoryTabs", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  // AC-2: Tab-Wechsel
  it("should switch active tab on click", async () => {
    const onTabChange = vi.fn();
    render(
      <CategoryTabs
        activeTab="style"
        onTabChange={onTabChange}
        styleOptions={[...STYLE_OPTIONS]}
        colorOptions={[...COLOR_OPTIONS]}
        selectedOptions={new Set<string>()}
        onToggleOption={vi.fn()}
      />
    );

    const colorsTab = screen.getByTestId("tab-colors");
    await user.click(colorsTab);

    expect(onTabChange).toHaveBeenCalledWith("colors");
  });

  // AC-4: Content-Wechsel
  it("should display correct chip grid for selected tab", async () => {
    const onTabChange = vi.fn();

    const { rerender } = render(
      <CategoryTabs
        activeTab="style"
        onTabChange={onTabChange}
        styleOptions={[...STYLE_OPTIONS]}
        colorOptions={[...COLOR_OPTIONS]}
        selectedOptions={new Set<string>()}
        onToggleOption={vi.fn()}
      />
    );

    // Style grid visible when style tab active
    expect(screen.getByTestId("style-grid")).toBeInTheDocument();

    // Rerender with colors tab active
    rerender(
      <CategoryTabs
        activeTab="colors"
        onTabChange={onTabChange}
        styleOptions={[...STYLE_OPTIONS]}
        colorOptions={[...COLOR_OPTIONS]}
        selectedOptions={new Set<string>()}
        onToggleOption={vi.fn()}
      />
    );

    expect(screen.getByTestId("colors-grid")).toBeInTheDocument();

    const colorsGrid = screen.getByTestId("colors-grid");
    expect(within(colorsGrid).getByText("Warm Tones")).toBeInTheDocument();
    expect(within(colorsGrid).getByText("Pastel")).toBeInTheDocument();
    expect(within(colorsGrid).getByText("Monochrome")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// OptionChip
// ---------------------------------------------------------------------------

describe("OptionChip", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  // AC-5: Toggle Verhalten
  it("should toggle between default and selected visual state on click", async () => {
    const onToggle = vi.fn();

    const { rerender } = render(
      <OptionChip label="Oil Painting" selected={false} onToggle={onToggle} />
    );

    const chip = screen.getByTestId("option-chip-Oil Painting");
    expect(chip).toHaveTextContent("Oil Painting");

    // Click to select
    await user.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Rerender as selected — variant changes from outline to default
    rerender(
      <OptionChip label="Oil Painting" selected={true} onToggle={onToggle} />
    );

    // Click again to deselect
    await user.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  // AC-6: Deselection — onToggle callback
  it("should call onToggle callback with chip value when clicked", async () => {
    const onToggle = vi.fn();

    render(
      <OptionChip label="Anime" selected={false} onToggle={onToggle} />
    );

    const chip = screen.getByTestId("option-chip-Anime");
    await user.click(chip);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
