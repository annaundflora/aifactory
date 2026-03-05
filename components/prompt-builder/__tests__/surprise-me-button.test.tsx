// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { SurpriseMeButton } from "@/components/prompt-builder/surprise-me-button";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec -- pure UI, no backend)
// ---------------------------------------------------------------------------

vi.mock("lucide-react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Dices: (props: Record<string, unknown>) => (
      <svg data-testid="dices-icon" {...props} />
    ),
  };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const STYLE_OPTIONS = [
  "Oil Painting",
  "Flat Vector",
  "Anime",
  "Watercolor",
  "3D Render",
  "Pixel Art",
  "Photography",
  "Pencil",
  "Pop Art",
];

const COLOR_OPTIONS = [
  "Warm Tones",
  "Pastel",
  "Monochrome",
  "Cool Tones",
  "Earth Tones",
  "Neon",
  "Black & White",
  "Sunset",
  "Vintage",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderButton(
  overrides: Partial<{
    hasExistingSelection: boolean;
    onSurprise: (selections: { style: string; color: string }) => void;
    styleOptions: string[];
    colorOptions: string[];
  }> = {}
) {
  const props = {
    hasExistingSelection: false,
    onSurprise: vi.fn(),
    styleOptions: STYLE_OPTIONS,
    colorOptions: COLOR_OPTIONS,
    ...overrides,
  };
  const result = render(<SurpriseMeButton {...props} />);
  return { ...result, onSurprise: props.onSurprise };
}

// ---------------------------------------------------------------------------
// SurpriseMeButton Acceptance Tests
// ---------------------------------------------------------------------------

describe("SurpriseMeButton", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.restoreAllMocks();
  });

  // AC-1: GIVEN der Drawer ist offen und keine Chips sind ausgewaehlt
  //       WHEN der User auf "Surprise Me" klickt
  //       THEN wird je genau 1 zufaelliger Chip aus Style und 1 aus Colors ausgewaehlt
  //       und beide erscheinen als selected in ihren jeweiligen Tabs
  it("AC-1: should select one random chip from Style and one from Colors when clicked with no existing selection", async () => {
    // Arrange: mock Math.random to return deterministic values
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.0) // style index 0 -> "Oil Painting"
      .mockReturnValueOnce(0.5); // color index 4 -> "Earth Tones"

    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: false, onSurprise });

    // Act: click the Surprise Me button
    await user.click(screen.getByTestId("surprise-me-button"));

    // Assert: onSurprise called with exactly one style and one color
    expect(onSurprise).toHaveBeenCalledTimes(1);
    expect(onSurprise).toHaveBeenCalledWith({
      style: "Oil Painting",
      color: "Earth Tones",
    });
  });

  // AC-2: GIVEN der Drawer ist offen und keine Chips sind ausgewaehlt
  //       WHEN der User auf "Surprise Me" klickt
  //       THEN wird die Live-Preview sofort aktualisiert mit den gewuerfelten Optionen
  it("AC-2: should update live preview with randomly selected options", async () => {
    // Arrange: deterministic random
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.6) // style index 5 -> "Pixel Art"
      .mockReturnValueOnce(0.2); // color index 1 -> "Pastel"

    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: false, onSurprise });

    // Act
    await user.click(screen.getByTestId("surprise-me-button"));

    // Assert: onSurprise is called immediately (synchronously after click)
    // so the parent can update live preview
    expect(onSurprise).toHaveBeenCalledTimes(1);
    expect(onSurprise).toHaveBeenCalledWith({
      style: "Pixel Art",
      color: "Pastel",
    });
  });

  // AC-3: GIVEN der User hat bereits Chips ausgewaehlt (z.B. "Oil Painting" im Style-Tab)
  //       WHEN der User auf "Surprise Me" klickt
  //       THEN erscheint eine Inline-Bestaetigung: "Aktuelle Auswahl ersetzen?"
  //       mit "Bestaetigen" und "Abbrechen" Buttons
  it("AC-3: should show confirmation dialog when chips are already selected", async () => {
    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: true, onSurprise });

    // Act: click Surprise Me with existing selection
    await user.click(screen.getByTestId("surprise-me-button"));

    // Assert: confirmation is shown, onSurprise NOT called yet
    expect(onSurprise).not.toHaveBeenCalled();
    expect(
      screen.getByText("Aktuelle Auswahl ersetzen?")
    ).toBeInTheDocument();
    expect(screen.getByTestId("surprise-me-confirm")).toHaveTextContent(
      "Bestätigen"
    );
    expect(screen.getByTestId("surprise-me-cancel")).toHaveTextContent(
      "Abbrechen"
    );
  });

  // AC-4: GIVEN die Bestaetigung "Aktuelle Auswahl ersetzen?" wird angezeigt
  //       WHEN der User auf "Bestaetigen" klickt
  //       THEN werden alle bisherigen Selections entfernt und durch die neue
  //       zufaellige Kombination ersetzt
  it("AC-4: should replace all selections with new random combination on confirm", async () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.3) // style index 2 -> "Anime"
      .mockReturnValueOnce(0.9); // color index 8 -> "Vintage"

    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: true, onSurprise });

    // Act: click Surprise Me to show confirmation, then confirm
    await user.click(screen.getByTestId("surprise-me-button"));
    await user.click(screen.getByTestId("surprise-me-confirm"));

    // Assert: onSurprise called with new random values
    expect(onSurprise).toHaveBeenCalledTimes(1);
    expect(onSurprise).toHaveBeenCalledWith({
      style: "Anime",
      color: "Vintage",
    });

    // Confirmation should be dismissed
    expect(
      screen.queryByTestId("surprise-me-confirmation")
    ).not.toBeInTheDocument();
  });

  // AC-5: GIVEN die Bestaetigung "Aktuelle Auswahl ersetzen?" wird angezeigt
  //       WHEN der User auf "Abbrechen" klickt
  //       THEN bleibt die bisherige Auswahl unveraendert und die Bestaetigung wird geschlossen
  it("AC-5: should keep existing selections unchanged on cancel", async () => {
    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: true, onSurprise });

    // Act: click Surprise Me, then cancel
    await user.click(screen.getByTestId("surprise-me-button"));
    expect(
      screen.getByTestId("surprise-me-confirmation")
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("surprise-me-cancel"));

    // Assert: onSurprise never called, confirmation dismissed
    expect(onSurprise).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("surprise-me-confirmation")
    ).not.toBeInTheDocument();
  });

  // AC-6: GIVEN der User klickt mehrmals hintereinander auf "Surprise Me" (ohne bestehende Auswahl)
  //       WHEN die Zufallsauswahl generiert wird
  //       THEN wird bei jedem Klick eine neue zufaellige Kombination gewaehlt
  //       (nicht deterministisch, unterschiedliche Ergebnisse moeglich)
  it("AC-6: should produce different random combinations on repeated clicks", async () => {
    // Mock Math.random to return different values on successive calls
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.0) // 1st click: style index 0
      .mockReturnValueOnce(0.0) // 1st click: color index 0
      .mockReturnValueOnce(0.5) // 2nd click: style index 4
      .mockReturnValueOnce(0.5); // 2nd click: color index 4

    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: false, onSurprise });

    // Act: click twice
    await user.click(screen.getByTestId("surprise-me-button"));
    await user.click(screen.getByTestId("surprise-me-button"));

    // Assert: called twice with different values
    expect(onSurprise).toHaveBeenCalledTimes(2);
    const firstCall = onSurprise.mock.calls[0][0] as {
      style: string;
      color: string;
    };
    const secondCall = onSurprise.mock.calls[1][0] as {
      style: string;
      color: string;
    };

    expect(firstCall).toEqual({
      style: "Oil Painting",
      color: "Warm Tones",
    });
    expect(secondCall).toEqual({
      style: "3D Render",
      color: "Earth Tones",
    });
    // Verify they are different
    expect(firstCall).not.toEqual(secondCall);
  });

  // AC-7: GIVEN "Surprise Me" hat eine Auswahl gewuerfelt
  //       WHEN der User zum Style-Tab wechselt
  //       THEN ist genau 1 Style-Chip als selected hervorgehoben
  it("AC-7: should call onSurprise with a valid style from styleOptions after surprise me", async () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.7) // style index 6 -> "Photography"
      .mockReturnValueOnce(0.1); // color index 0 -> "Warm Tones"

    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: false, onSurprise });

    // Act
    await user.click(screen.getByTestId("surprise-me-button"));

    // Assert: the style value is from the styleOptions array
    expect(onSurprise).toHaveBeenCalledTimes(1);
    const selections = onSurprise.mock.calls[0][0] as {
      style: string;
      color: string;
    };
    expect(STYLE_OPTIONS).toContain(selections.style);
    expect(selections.style).toBe("Photography");
  });

  // AC-8: GIVEN "Surprise Me" hat eine Auswahl gewuerfelt
  //       WHEN der User zum Colors-Tab wechselt
  //       THEN ist genau 1 Colors-Chip als selected hervorgehoben
  it("AC-8: should call onSurprise with a valid color from colorOptions after surprise me", async () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.2) // style index 1 -> "Flat Vector"
      .mockReturnValueOnce(0.8); // color index 7 -> "Sunset"

    const onSurprise = vi.fn();
    renderButton({ hasExistingSelection: false, onSurprise });

    // Act
    await user.click(screen.getByTestId("surprise-me-button"));

    // Assert: the color value is from the colorOptions array
    expect(onSurprise).toHaveBeenCalledTimes(1);
    const selections = onSurprise.mock.calls[0][0] as {
      style: string;
      color: string;
    };
    expect(COLOR_OPTIONS).toContain(selections.color);
    expect(selections.color).toBe("Sunset");
  });
});
