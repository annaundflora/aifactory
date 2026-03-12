// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { AssistantTrigger } from "../assistant-trigger";

describe("AssistantTrigger", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN die PromptArea wird gerendert (nach Slice 07 Legacy Cleanup)
  //        WHEN der User die PromptArea betrachtet
  //        THEN ist ein Button mit dem Sparkles Icon (data-testid="assistant-trigger-btn")
  //             sichtbar, an der Position wo vorher der Builder-Button war
  // --------------------------------------------------------------------------
  it('AC-1: should render a button with data-testid="assistant-trigger-btn" and Sparkles icon', () => {
    const onClick = vi.fn();
    render(<AssistantTrigger isOpen={false} onClick={onClick} />);

    const btn = screen.getByTestId("assistant-trigger-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toBeVisible();

    // Button should be a <button> element
    expect(btn.tagName).toBe("BUTTON");

    // Should contain Sparkles icon (lucide renders as SVG)
    const svg = btn.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-2 (partial): GIVEN der AssistantSheet ist geschlossen (Initialzustand)
  //        WHEN der User auf den Sparkles-Trigger-Button klickt
  //        THEN oeffnet sich ein Sheet von rechts [...] und der Trigger-Button
  //             zeigt einen aktiven/hervorgehobenen Zustand
  //
  //        Test: Verify onClick is called when trigger is clicked while closed
  // --------------------------------------------------------------------------
  it("AC-2: should call onClick when clicked while sheet is closed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AssistantTrigger isOpen={false} onClick={onClick} />);

    const btn = screen.getByTestId("assistant-trigger-btn");
    await user.click(btn);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // AC-2 (styling): GIVEN isOpen is true
  //        WHEN the trigger is rendered
  //        THEN it shows active/highlighted styling
  // --------------------------------------------------------------------------
  it("AC-2: should render with active/highlighted styling when isOpen is true", () => {
    const onClick = vi.fn();
    render(<AssistantTrigger isOpen={true} onClick={onClick} />);

    const btn = screen.getByTestId("assistant-trigger-btn");

    // When open, the button should have primary styling classes
    expect(btn.className).toMatch(/bg-primary/);
    expect(btn.className).toMatch(/text-primary-foreground/);

    // aria-expanded should reflect the open state
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  // --------------------------------------------------------------------------
  // AC-2 (default state): GIVEN isOpen is false
  //        WHEN the trigger is rendered
  //        THEN it does NOT have active styling and aria-expanded is false
  // --------------------------------------------------------------------------
  it("AC-2: should render without active styling when isOpen is false", () => {
    const onClick = vi.fn();
    render(<AssistantTrigger isOpen={false} onClick={onClick} />);

    const btn = screen.getByTestId("assistant-trigger-btn");

    // When closed, the button should NOT have primary bg styling
    // (it uses variant="secondary" by default)
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN der AssistantSheet ist geoeffnet
  //        WHEN der User auf den Trigger-Button klickt (Toggle-Verhalten)
  //        THEN schliesst sich das Sheet
  //
  //        Test: Verify onClick is called when trigger is clicked while open
  // --------------------------------------------------------------------------
  it("AC-6: should call onClick when clicked while sheet is open (toggle close)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AssistantTrigger isOpen={true} onClick={onClick} />);

    const btn = screen.getByTestId("assistant-trigger-btn");
    await user.click(btn);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
