// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { Startscreen } from "../startscreen";

describe("Startscreen", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN der AssistantSheet ist geoeffnet und es existiert keine aktive Session
  //       WHEN der Startscreen gerendert wird
  //       THEN wird der Text "Womit kann ich dir helfen?" zentriert im Main-Bereich angezeigt
  // --------------------------------------------------------------------------
  it('AC-1: should display "Womit kann ich dir helfen?" centered text', () => {
    const onChipClick = vi.fn();
    const onSessionHistoryClick = vi.fn();

    render(
      <Startscreen
        hasSessions={false}
        onChipClick={onChipClick}
        onSessionHistoryClick={onSessionHistoryClick}
      />
    );

    const welcomeText = screen.getByTestId("startscreen-welcome");
    expect(welcomeText).toBeInTheDocument();
    expect(welcomeText).toBeVisible();
    expect(welcomeText).toHaveTextContent("Womit kann ich dir helfen?");

    // Verify centered alignment via text-center class
    expect(welcomeText.className).toMatch(/text-center/);
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN der Startscreen wird angezeigt
  //       WHEN der User die Suggestion-Chips betrachtet
  //       THEN sind 4 Chips in einem 2x2 Grid sichtbar mit den Texten:
  //            "Hilf mir einen Prompt zu schreiben", "Analysiere ein Referenzbild",
  //            "Verbessere meinen aktuellen Prompt", "Welches Modell passt zu meiner Idee?"
  // --------------------------------------------------------------------------
  it("AC-2: should render 4 suggestion chips with correct texts in a 2x2 grid", () => {
    const onChipClick = vi.fn();
    const onSessionHistoryClick = vi.fn();

    render(
      <Startscreen
        hasSessions={false}
        onChipClick={onChipClick}
        onSessionHistoryClick={onSessionHistoryClick}
      />
    );

    const expectedTexts = [
      "Hilf mir einen Prompt zu schreiben",
      "Analysiere ein Referenzbild",
      "Verbessere meinen aktuellen Prompt",
      "Welches Modell passt zu meiner Idee?",
    ];

    const chips = screen.getAllByTestId("suggestion-chip");
    expect(chips).toHaveLength(4);

    // Verify each chip text
    expectedTexts.forEach((text, index) => {
      expect(chips[index]).toHaveTextContent(text);
      expect(chips[index]).toBeVisible();
    });

    // Verify 2x2 grid layout via grid-cols-2 class
    const gridContainer = screen.getByTestId("suggestion-chips");
    expect(gridContainer.className).toMatch(/grid-cols-2/);
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der Startscreen wird angezeigt
  //       WHEN der User auf einen Suggestion-Chip klickt (z.B. "Hilf mir einen Prompt zu schreiben")
  //       THEN wird ein onChipClick Callback mit dem Chip-Text als Argument aufgerufen
  //            und der Intent in der Console geloggt
  // --------------------------------------------------------------------------
  it("AC-3: should call onChipClick with chip text when a chip is clicked", async () => {
    const user = userEvent.setup();
    const onChipClick = vi.fn();
    const onSessionHistoryClick = vi.fn();

    render(
      <Startscreen
        hasSessions={false}
        onChipClick={onChipClick}
        onSessionHistoryClick={onSessionHistoryClick}
      />
    );

    const chips = screen.getAllByTestId("suggestion-chip");

    // Click the first chip: "Hilf mir einen Prompt zu schreiben"
    await user.click(chips[0]);
    expect(onChipClick).toHaveBeenCalledWith(
      "Hilf mir einen Prompt zu schreiben"
    );

    // Click the third chip: "Verbessere meinen aktuellen Prompt"
    await user.click(chips[2]);
    expect(onChipClick).toHaveBeenCalledWith(
      "Verbessere meinen aktuellen Prompt"
    );

    expect(onChipClick).toHaveBeenCalledTimes(2);
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN es existieren keine vergangenen Sessions fuer das aktuelle Projekt
  //       WHEN der Startscreen gerendert wird
  //       THEN ist der Session-History-Link ("Vergangene Sessions anzeigen") nicht sichtbar (hidden)
  // --------------------------------------------------------------------------
  it("AC-4: should hide session history link when hasSessions is false", () => {
    const onChipClick = vi.fn();
    const onSessionHistoryClick = vi.fn();

    render(
      <Startscreen
        hasSessions={false}
        onChipClick={onChipClick}
        onSessionHistoryClick={onSessionHistoryClick}
      />
    );

    expect(
      screen.queryByTestId("session-history-link")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Vergangene Sessions anzeigen")
    ).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN es existieren vergangene Sessions fuer das aktuelle Projekt
  //       WHEN der Startscreen gerendert wird
  //       THEN ist der Session-History-Link "Vergangene Sessions anzeigen" sichtbar und klickbar
  // --------------------------------------------------------------------------
  it('AC-5: should show "Vergangene Sessions anzeigen" link when hasSessions is true', async () => {
    const user = userEvent.setup();
    const onChipClick = vi.fn();
    const onSessionHistoryClick = vi.fn();

    render(
      <Startscreen
        hasSessions={true}
        onChipClick={onChipClick}
        onSessionHistoryClick={onSessionHistoryClick}
      />
    );

    const historyLink = screen.getByTestId("session-history-link");
    expect(historyLink).toBeInTheDocument();
    expect(historyLink).toBeVisible();
    expect(historyLink).toHaveTextContent("Vergangene Sessions anzeigen");

    // Verify the link is actually clickable by clicking it and checking the callback
    await user.click(historyLink);
    expect(onSessionHistoryClick).toHaveBeenCalledTimes(1);
  });
});
