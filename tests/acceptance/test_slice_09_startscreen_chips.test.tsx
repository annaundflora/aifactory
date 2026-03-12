// @vitest-environment jsdom
/**
 * Acceptance Tests for slice-09-startscreen-chips
 *
 * These tests verify all 12 Acceptance Criteria from the slice spec.
 * Each test maps 1:1 to a GIVEN/WHEN/THEN from the spec.
 *
 * Components tested: Startscreen, ChatInput, ModelSelector
 * Mocking Strategy: no_mocks (as defined in slice spec)
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { Startscreen } from "@/components/assistant/startscreen";
import { ChatInput } from "@/components/assistant/chat-input";
import {
  ModelSelector,
  ASSISTANT_MODELS,
  DEFAULT_MODEL_SLUG,
} from "@/components/assistant/model-selector";
import { AssistantSheet } from "@/components/assistant/assistant-sheet";

// Polyfill methods missing in jsdom (required by Radix UI Select)
beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  // Mock window.matchMedia for Radix UI portals
  window.matchMedia = window.matchMedia || vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

/**
 * Helper to open a Radix UI Select dropdown in jsdom.
 * Uses fireEvent.pointerDown (with pointerId) instead of userEvent.click
 * to avoid the hasPointerCapture error in jsdom.
 */
function openSelect(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
}

describe("Slice 09: Startscreen + Suggestion Chips Acceptance", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN der AssistantSheet ist geoeffnet und es existiert keine aktive Session
  //       WHEN der Startscreen gerendert wird
  //       THEN wird der Text "Womit kann ich dir helfen?" zentriert im Main-Bereich angezeigt
  // --------------------------------------------------------------------------
  it('AC-1: GIVEN no active session WHEN Startscreen renders THEN "Womit kann ich dir helfen?" is displayed centered', () => {
    render(
      <Startscreen
        hasSessions={false}
        onChipClick={vi.fn()}
        onSessionHistoryClick={vi.fn()}
      />
    );

    const welcome = screen.getByTestId("startscreen-welcome");
    expect(welcome).toBeVisible();
    expect(welcome).toHaveTextContent("Womit kann ich dir helfen?");
    expect(welcome.className).toMatch(/text-center/);
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN der Startscreen wird angezeigt
  //       WHEN der User die Suggestion-Chips betrachtet
  //       THEN sind 4 Chips in einem 2x2 Grid sichtbar mit den Texten:
  //            "Hilf mir einen Prompt zu schreiben", "Analysiere ein Referenzbild",
  //            "Verbessere meinen aktuellen Prompt", "Welches Modell passt zu meiner Idee?"
  // --------------------------------------------------------------------------
  it("AC-2: GIVEN Startscreen displayed WHEN user views chips THEN 4 chips in 2x2 grid with correct texts", () => {
    render(
      <Startscreen
        hasSessions={false}
        onChipClick={vi.fn()}
        onSessionHistoryClick={vi.fn()}
      />
    );

    const chips = screen.getAllByTestId("suggestion-chip");
    expect(chips).toHaveLength(4);

    const expectedTexts = [
      "Hilf mir einen Prompt zu schreiben",
      "Analysiere ein Referenzbild",
      "Verbessere meinen aktuellen Prompt",
      "Welches Modell passt zu meiner Idee?",
    ];
    chips.forEach((chip, i) => {
      expect(chip).toBeVisible();
      expect(chip).toHaveTextContent(expectedTexts[i]);
    });

    // 2x2 grid
    const grid = screen.getByTestId("suggestion-chips");
    expect(grid.className).toMatch(/grid-cols-2/);
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der Startscreen wird angezeigt
  //       WHEN der User auf einen Suggestion-Chip klickt
  //       THEN wird ein onChipClick Callback mit dem Chip-Text als Argument aufgerufen
  // --------------------------------------------------------------------------
  it("AC-3: GIVEN Startscreen displayed WHEN user clicks a chip THEN onChipClick is called with chip text", async () => {
    const user = userEvent.setup();
    const onChipClick = vi.fn();

    render(
      <Startscreen
        hasSessions={false}
        onChipClick={onChipClick}
        onSessionHistoryClick={vi.fn()}
      />
    );

    const chips = screen.getAllByTestId("suggestion-chip");
    await user.click(chips[0]);
    expect(onChipClick).toHaveBeenCalledWith(
      "Hilf mir einen Prompt zu schreiben"
    );
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN es existieren keine vergangenen Sessions
  //       WHEN der Startscreen gerendert wird
  //       THEN ist der Session-History-Link nicht sichtbar (hidden)
  // --------------------------------------------------------------------------
  it("AC-4: GIVEN no past sessions WHEN Startscreen renders THEN session history link is hidden", () => {
    render(
      <Startscreen
        hasSessions={false}
        onChipClick={vi.fn()}
        onSessionHistoryClick={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("session-history-link")
    ).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN es existieren vergangene Sessions
  //       WHEN der Startscreen gerendert wird
  //       THEN ist der Session-History-Link sichtbar und klickbar
  // --------------------------------------------------------------------------
  it('AC-5: GIVEN past sessions exist WHEN Startscreen renders THEN "Vergangene Sessions anzeigen" is visible and clickable', async () => {
    const user = userEvent.setup();
    const onSessionHistoryClick = vi.fn();

    render(
      <Startscreen
        hasSessions={true}
        onChipClick={vi.fn()}
        onSessionHistoryClick={onSessionHistoryClick}
      />
    );

    const link = screen.getByTestId("session-history-link");
    expect(link).toBeVisible();
    expect(link).toHaveTextContent("Vergangene Sessions anzeigen");

    await user.click(link);
    expect(onSessionHistoryClick).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN der Startscreen wird angezeigt
  //       WHEN der User den Footer-Bereich betrachtet
  //       THEN ist ein Chat-Input sichtbar mit: Textarea, Send-Button (disabled), Image-Upload-Button
  // --------------------------------------------------------------------------
  it("AC-6: GIVEN Startscreen WHEN user views footer THEN ChatInput with textarea, disabled send, and image upload is visible", () => {
    render(<ChatInput onSend={vi.fn()} />);

    const textarea = screen.getByTestId("chat-input-textarea");
    expect(textarea).toBeVisible();
    expect(textarea).toHaveAttribute("placeholder", "Nachricht eingeben...");

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeVisible();
    expect(sendBtn).toBeDisabled();
    expect(sendBtn.querySelector("svg")).toBeInTheDocument();

    const imageBtn = screen.getByTestId("image-upload-btn");
    expect(imageBtn).toBeVisible();
    expect(imageBtn.querySelector("svg")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN die Chat-Input Textarea ist leer
  //       WHEN der User den Send-Button betrachtet
  //       THEN ist der Send-Button disabled (nicht klickbar)
  // --------------------------------------------------------------------------
  it("AC-7: GIVEN textarea is empty WHEN user views send button THEN send button is disabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeDisabled();

    await user.click(sendBtn);
    expect(onSend).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN die Chat-Input Textarea enthaelt Text
  //       WHEN der User den Send-Button betrachtet
  //       THEN ist der Send-Button enabled (klickbar)
  // --------------------------------------------------------------------------
  it("AC-8: GIVEN textarea has text WHEN user views send button THEN send button is enabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("chat-input-textarea");
    await user.type(textarea, "Test text");

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeEnabled();

    await user.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith("Test text");
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN der AssistantSheet ist geoeffnet
  //       WHEN der User den Header betrachtet
  //       THEN ist ein Model-Selector Dropdown sichtbar zwischen dem Titel und dem Close-Button
  // --------------------------------------------------------------------------
  it("AC-9: GIVEN AssistantSheet open WHEN user views header THEN ModelSelector is visible in header", () => {
    const onChange = vi.fn();

    render(
      <AssistantSheet
        open={true}
        onOpenChange={vi.fn()}
        headerSlot={
          <ModelSelector value={DEFAULT_MODEL_SLUG} onChange={onChange} />
        }
      >
        <Startscreen
          hasSessions={false}
          onChipClick={vi.fn()}
          onSessionHistoryClick={vi.fn()}
        />
      </AssistantSheet>
    );

    // Title should be visible
    expect(screen.getByText("Prompt Assistent")).toBeVisible();

    // Model selector trigger should be visible
    const trigger = screen.getByTestId("model-selector-trigger");
    expect(trigger).toBeVisible();
    expect(trigger).toHaveTextContent("Sonnet 4.6");

    // Close button should be visible
    expect(screen.getByTestId("assistant-sheet-close")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // AC-10: GIVEN der Model-Selector Dropdown wird geoeffnet
  //        WHEN der User die Optionen betrachtet
  //        THEN sind 3 Modelle verfuegbar: "Sonnet 4.6" (default), "GPT-5.4", "Gemini 3.1 Pro"
  // --------------------------------------------------------------------------
  it("AC-10: GIVEN ModelSelector dropdown opens WHEN user views options THEN 3 models available with Sonnet 4.6 as default", () => {
    const onChange = vi.fn();

    render(
      <ModelSelector value={DEFAULT_MODEL_SLUG} onChange={onChange} />
    );

    // Open dropdown via pointerDown (jsdom-safe for Radix Select)
    const trigger = screen.getByTestId("model-selector-trigger");
    openSelect(trigger);

    // All 3 model options should be visible via their data-testid attributes
    const sonnetOption = screen.getByTestId("model-option-anthropic/claude-sonnet-4.6");
    const gptOption = screen.getByTestId("model-option-openai/gpt-5.4");
    const geminiOption = screen.getByTestId("model-option-google/gemini-3.1-pro-preview");

    expect(sonnetOption).toBeVisible();
    expect(sonnetOption).toHaveTextContent("Sonnet 4.6");
    expect(gptOption).toBeVisible();
    expect(gptOption).toHaveTextContent("GPT-5.4");
    expect(geminiOption).toBeVisible();
    expect(geminiOption).toHaveTextContent("Gemini 3.1 Pro");

    // Sonnet 4.6 should be selected as default
    expect(sonnetOption).toHaveAttribute("data-state", "checked");

    // Verify model count
    expect(ASSISTANT_MODELS).toHaveLength(3);

    // Verify default
    expect(DEFAULT_MODEL_SLUG).toBe("anthropic/claude-sonnet-4.6");
  });

  // --------------------------------------------------------------------------
  // AC-11: GIVEN der Model-Selector zeigt "Sonnet 4.6" als Default
  //        WHEN der User "GPT-5.4" auswaehlt
  //        THEN zeigt der Dropdown "GPT-5.4" als aktuelles Modell
  // --------------------------------------------------------------------------
  it("AC-11: GIVEN Sonnet 4.6 selected WHEN user selects GPT-5.4 THEN dropdown shows GPT-5.4", () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ModelSelector value={DEFAULT_MODEL_SLUG} onChange={onChange} />
    );

    // Open dropdown and select GPT-5.4
    const trigger = screen.getByTestId("model-selector-trigger");
    openSelect(trigger);

    const gptOption = screen.getByTestId("model-option-openai/gpt-5.4");
    fireEvent.click(gptOption);

    expect(onChange).toHaveBeenCalledWith("openai/gpt-5.4");

    // Re-render with updated value to simulate state persistence
    rerender(
      <ModelSelector value="openai/gpt-5.4" onChange={onChange} />
    );

    expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent(
      "GPT-5.4"
    );
  });

  // --------------------------------------------------------------------------
  // AC-12: GIVEN der User oeffnet den AssistantSheet und die Textarea ist leer
  //        WHEN der Focus-State geprueft wird
  //        THEN liegt der Focus auf der Chat-Input Textarea
  // --------------------------------------------------------------------------
  it("AC-12: GIVEN AssistantSheet opens with empty textarea WHEN focus checked THEN textarea has focus", () => {
    render(<ChatInput onSend={vi.fn()} autoFocus={true} />);

    const textarea = screen.getByTestId("chat-input-textarea");
    expect(textarea).toHaveFocus();
  });
});
