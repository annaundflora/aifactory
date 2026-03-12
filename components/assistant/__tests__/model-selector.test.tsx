// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  ModelSelector,
  ASSISTANT_MODELS,
  DEFAULT_MODEL_SLUG,
} from "../model-selector";

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

describe("ModelSelector", () => {
  // --------------------------------------------------------------------------
  // AC-9: GIVEN der AssistantSheet ist geoeffnet
  //       WHEN der User den Header betrachtet
  //       THEN ist ein Model-Selector Dropdown sichtbar zwischen dem Titel
  //            "Prompt Assistent" und dem Close-Button
  // --------------------------------------------------------------------------
  it("AC-9: should render a dropdown trigger showing the current model name", () => {
    const onChange = vi.fn();

    render(
      <ModelSelector value={DEFAULT_MODEL_SLUG} onChange={onChange} />
    );

    const trigger = screen.getByTestId("model-selector-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeVisible();

    // Should display the default model name "Sonnet 4.6"
    expect(trigger).toHaveTextContent("Sonnet 4.6");
  });

  // --------------------------------------------------------------------------
  // AC-10: GIVEN der Model-Selector Dropdown wird geoeffnet
  //        WHEN der User die Optionen betrachtet
  //        THEN sind 3 Modelle verfuegbar: "Sonnet 4.6" (ausgewaehlt als Default),
  //             "GPT-5.4", "Gemini 3.1 Pro"
  // --------------------------------------------------------------------------
  it('AC-10: should show three model options with "Sonnet 4.6" selected by default', () => {
    const onChange = vi.fn();

    render(
      <ModelSelector value={DEFAULT_MODEL_SLUG} onChange={onChange} />
    );

    // Open dropdown via pointerDown (jsdom-safe for Radix Select)
    const trigger = screen.getByTestId("model-selector-trigger");
    openSelect(trigger);

    // Verify all 3 model options are visible via their data-testid attributes
    const sonnetOption = screen.getByTestId("model-option-anthropic/claude-sonnet-4.6");
    const gptOption = screen.getByTestId("model-option-openai/gpt-5.4");
    const geminiOption = screen.getByTestId("model-option-google/gemini-3.1-pro-preview");

    expect(sonnetOption).toBeVisible();
    expect(sonnetOption).toHaveTextContent("Sonnet 4.6");
    expect(gptOption).toBeVisible();
    expect(gptOption).toHaveTextContent("GPT-5.4");
    expect(geminiOption).toBeVisible();
    expect(geminiOption).toHaveTextContent("Gemini 3.1 Pro");

    // Sonnet 4.6 should be the selected/checked option
    expect(sonnetOption).toHaveAttribute("data-state", "checked");

    // Verify the model definitions count
    expect(ASSISTANT_MODELS).toHaveLength(3);

    // Verify default slug
    expect(DEFAULT_MODEL_SLUG).toBe("anthropic/claude-sonnet-4.6");
  });

  // --------------------------------------------------------------------------
  // AC-11: GIVEN der Model-Selector zeigt "Sonnet 4.6" als Default
  //        WHEN der User "GPT-5.4" auswaehlt
  //        THEN zeigt der Dropdown "GPT-5.4" als aktuelles Modell und der Wert
  //             wird im lokalen State persistiert
  // --------------------------------------------------------------------------
  it("AC-11: should update selected model and call onChange when a different model is selected", () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ModelSelector value={DEFAULT_MODEL_SLUG} onChange={onChange} />
    );

    // Open dropdown
    const trigger = screen.getByTestId("model-selector-trigger");
    openSelect(trigger);

    // Select "GPT-5.4" by clicking the option
    const gptOption = screen.getByText("GPT-5.4");
    fireEvent.click(gptOption);

    // Verify onChange was called with the GPT-5.4 slug
    expect(onChange).toHaveBeenCalledWith("openai/gpt-5.4");

    // Rerender with new value to simulate state persistence
    rerender(
      <ModelSelector value="openai/gpt-5.4" onChange={onChange} />
    );

    // Trigger should now show "GPT-5.4"
    const updatedTrigger = screen.getByTestId("model-selector-trigger");
    expect(updatedTrigger).toHaveTextContent("GPT-5.4");
  });

  // --------------------------------------------------------------------------
  // AC-10 (model slugs): Verify model slugs match architecture spec
  // --------------------------------------------------------------------------
  it("AC-10: should have correct model slugs as defined in architecture", () => {
    const expectedSlugs = [
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.4",
      "google/gemini-3.1-pro-preview",
    ];

    ASSISTANT_MODELS.forEach((model, index) => {
      expect(model.slug).toBe(expectedSlugs[index]);
    });
  });
});
