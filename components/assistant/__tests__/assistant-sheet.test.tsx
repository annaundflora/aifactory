// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { AssistantSheet } from "../assistant-sheet";

describe("AssistantSheet", () => {
  // --------------------------------------------------------------------------
  // AC-2: GIVEN der AssistantSheet ist geschlossen (Initialzustand)
  //        WHEN der User auf den Sparkles-Trigger-Button klickt
  //        THEN oeffnet sich ein Sheet von rechts mit einer festen Breite von 480px
  // --------------------------------------------------------------------------
  it("AC-2: should render sheet content with 480px width when open is true", () => {
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={true} onOpenChange={onOpenChange}>
        <div>Test Content</div>
      </AssistantSheet>
    );

    const sheetContent = screen.getByTestId("assistant-sheet");
    expect(sheetContent).toBeInTheDocument();
    expect(sheetContent).toBeVisible();

    // Verify the 480px width is applied via inline style (default without canvas)
    expect(sheetContent.style.width).toBe("480px");
  });

  // --------------------------------------------------------------------------
  // AC-2 (closed state): GIVEN open is false
  //        WHEN the sheet is rendered
  //        THEN sheet content should not be visible in the DOM
  // --------------------------------------------------------------------------
  it("AC-2: should not render sheet content when open is false", () => {
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={false} onOpenChange={onOpenChange}>
        <div>Test Content</div>
      </AssistantSheet>
    );

    // When closed, the sheet content should not be in the DOM
    expect(screen.queryByTestId("assistant-sheet")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der AssistantSheet ist geoeffnet
  //        WHEN der User den Sheet-Header betrachtet
  //        THEN zeigt der Header den Titel "Prompt Assistent" und einen
  //             Close-Button (X Icon)
  // --------------------------------------------------------------------------
  it('AC-3: should display "Prompt Assistent" title and close button in header', () => {
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={true} onOpenChange={onOpenChange}>
        <div>Test Content</div>
      </AssistantSheet>
    );

    // Title text "Prompt Assistent" should be visible
    expect(screen.getByText("Prompt Assistent")).toBeInTheDocument();
    expect(screen.getByText("Prompt Assistent")).toBeVisible();

    // Close button (X icon) should be visible
    const closeBtn = screen.getByTestId("assistant-sheet-close");
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn).toBeVisible();

    // Close button should have accessible label
    expect(closeBtn).toHaveAttribute("aria-label", "Close");

    // Close button should contain an SVG (X icon)
    const svg = closeBtn.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN der AssistantSheet ist geoeffnet
  //        WHEN der User auf den Close-Button (X) klickt
  //        THEN schliesst sich das Sheet mit Slide-out-Animation nach rechts,
  //             und der Trigger-Button kehrt in den Default-Zustand zurueck
  // --------------------------------------------------------------------------
  it("AC-4: should call onOpenChange(false) when close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={true} onOpenChange={onOpenChange}>
        <div>Test Content</div>
      </AssistantSheet>
    );

    const closeBtn = screen.getByTestId("assistant-sheet-close");
    await user.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN der AssistantSheet ist geoeffnet
  //        WHEN der User die Escape-Taste drueckt
  //        THEN schliesst sich das Sheet (identisches Verhalten wie AC-4)
  // --------------------------------------------------------------------------
  it("AC-5: should call onOpenChange(false) when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={true} onOpenChange={onOpenChange}>
        <div>Test Content</div>
      </AssistantSheet>
    );

    // Ensure the sheet is visible
    expect(screen.getByTestId("assistant-sheet")).toBeInTheDocument();

    // Press Escape
    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN der AssistantSheet wurde soeben geoeffnet
  //        WHEN der Focus-State geprueft wird
  //        THEN liegt der Focus innerhalb des Sheets (nicht auf dem Trigger-Button)
  // --------------------------------------------------------------------------
  it("AC-7: should move focus inside the sheet when opened", async () => {
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={true} onOpenChange={onOpenChange}>
        <div>Test Content</div>
      </AssistantSheet>
    );

    // Wait for the focus to be moved inside the sheet (uses setTimeout of 50ms)
    await waitFor(() => {
      const sheet = screen.getByTestId("assistant-sheet");
      // Focus should be on the sheet itself or within it
      expect(sheet.contains(document.activeElement)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // AC-3 (children slot): Verify the sheet renders children content
  // --------------------------------------------------------------------------
  it("should render children content within the sheet body", () => {
    const onOpenChange = vi.fn();
    render(
      <AssistantSheet open={true} onOpenChange={onOpenChange}>
        <p data-testid="child-content">Future content goes here</p>
      </AssistantSheet>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Future content goes here")).toBeVisible();
  });
});
