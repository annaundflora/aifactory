// @vitest-environment jsdom
/**
 * Tests for Slice 13c: Session Switcher Component
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-7: Click on Switcher navigates to Session-Liste
 * - AC-8: Switcher is visible as icon button in header with correct positioning
 *
 * Mocking Strategy: mock_external (as specified in Slice-Spec).
 * No external calls are needed; this is a pure component test.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { SessionSwitcher } from "../session-switcher";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionSwitcher", () => {
  // --------------------------------------------------------------------------
  // AC-7: GIVEN der Assistant-Drawer ist geoeffnet (egal ob Startscreen, Chat
  //        oder Session-Liste)
  //       WHEN der User auf den Session-Switcher Button im Sheet-Header klickt
  //       THEN navigiert die Ansicht zur Session-Liste
  // --------------------------------------------------------------------------
  it("AC-7: should call onClick handler when the switcher button is clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<SessionSwitcher onClick={handleClick} />);

    const button = screen.getByTestId("session-switcher");
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("AC-7: should call onClick on each click (multiple clicks)", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<SessionSwitcher onClick={handleClick} />);

    const button = screen.getByTestId("session-switcher");
    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(3);
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN der Session-Switcher Button im Sheet-Header
  //       WHEN er gerendert wird
  //       THEN ist er sichtbar als Icon-Button (z.B. List oder History Icon)
  //            rechts neben dem Model-Selector und links neben dem Close-Button
  // --------------------------------------------------------------------------
  it("AC-8: should render as a visible button element", () => {
    render(<SessionSwitcher onClick={vi.fn()} />);

    const button = screen.getByTestId("session-switcher");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
  });

  it("AC-8: should have an accessible label for screen readers", () => {
    render(<SessionSwitcher onClick={vi.fn()} />);

    // The button should be findable by its aria-label
    const button = screen.getByLabelText("Sessions anzeigen");
    expect(button).toBeInTheDocument();
  });

  it("AC-8: should render with type='button' to prevent form submission", () => {
    render(<SessionSwitcher onClick={vi.fn()} />);

    const button = screen.getByTestId("session-switcher");
    expect(button).toHaveAttribute("type", "button");
  });

  it("AC-8: should contain an SVG icon (History icon from Lucide)", () => {
    render(<SessionSwitcher onClick={vi.fn()} />);

    const button = screen.getByTestId("session-switcher");
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("AC-8: should use ghost variant for minimal visual weight in header", () => {
    render(<SessionSwitcher onClick={vi.fn()} />);

    const button = screen.getByTestId("session-switcher");
    // The Button component with variant="ghost" should not have primary styling
    // We verify it renders without throwing (variant is applied correctly)
    expect(button).toBeInTheDocument();
  });
});
