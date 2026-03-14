// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MaxQualityToggle } from "@/components/ui/max-quality-toggle";

/**
 * Acceptance Tests for Slice 05: Max Quality Toggle Component
 *
 * These tests validate the MaxQualityToggle button component
 * against the Acceptance Criteria defined in the slice spec.
 *
 * Mocking Strategy: no_mocks (pure UI component with callback props)
 */
describe("MaxQualityToggle", () => {
  /**
   * AC-6: GIVEN eine MaxQualityToggle-Komponente mit maxQuality={false}
   * WHEN sie gerendert wird
   * THEN zeigt sie einen Toggle-Button mit Label "Max Quality" im inaktiven
   * Zustand
   */
  it("AC-6: should render toggle button with label Max Quality in inactive state", () => {
    render(
      <MaxQualityToggle maxQuality={false} onMaxQualityChange={vi.fn()} />
    );

    const button = screen.getByRole("switch", { name: "Max Quality" });
    expect(button).toBeInTheDocument();

    // Should show "Max Quality" text label
    expect(button).toHaveTextContent("Max Quality");

    // Should be in inactive/unpressed state
    expect(button).toHaveAttribute("aria-pressed", "false");

    // Inactive styling -- should NOT have active bg-primary
    expect(button.className).not.toMatch(/\bbg-primary\b/);
    expect(button.className).toMatch(/text-muted-foreground/);
  });

  /**
   * AC-7: GIVEN eine MaxQualityToggle-Komponente mit maxQuality={true}
   * WHEN sie gerendert wird
   * THEN zeigt sie den Toggle-Button im aktiven/gepressten Zustand (visuell
   * hervorgehoben)
   */
  it("AC-7: should render toggle button in active/pressed state when maxQuality is true", () => {
    render(
      <MaxQualityToggle maxQuality={true} onMaxQualityChange={vi.fn()} />
    );

    const button = screen.getByRole("switch", { name: "Max Quality" });
    expect(button).toBeInTheDocument();

    // Should be in active/pressed state
    expect(button).toHaveAttribute("aria-pressed", "true");

    // Active styling -- visually highlighted with bg-primary
    expect(button.className).toMatch(/bg-primary/);
    expect(button.className).toMatch(/text-primary-foreground/);
  });

  /**
   * AC-8: GIVEN eine MaxQualityToggle-Komponente mit maxQuality={false}
   * WHEN der User auf den Toggle klickt
   * THEN wird onMaxQualityChange(true) aufgerufen
   */
  it("AC-8: should call onMaxQualityChange with true when clicked while inactive", async () => {
    const user = userEvent.setup();
    const onMaxQualityChange = vi.fn();

    render(
      <MaxQualityToggle
        maxQuality={false}
        onMaxQualityChange={onMaxQualityChange}
      />
    );

    const button = screen.getByRole("switch", { name: "Max Quality" });
    await user.click(button);

    expect(onMaxQualityChange).toHaveBeenCalledTimes(1);
    expect(onMaxQualityChange).toHaveBeenCalledWith(true);
  });

  /**
   * AC-9: GIVEN eine MaxQualityToggle-Komponente mit maxQuality={true}
   * WHEN der User auf den Toggle klickt
   * THEN wird onMaxQualityChange(false) aufgerufen
   */
  it("AC-9: should call onMaxQualityChange with false when clicked while active", async () => {
    const user = userEvent.setup();
    const onMaxQualityChange = vi.fn();

    render(
      <MaxQualityToggle
        maxQuality={true}
        onMaxQualityChange={onMaxQualityChange}
      />
    );

    const button = screen.getByRole("switch", { name: "Max Quality" });
    await user.click(button);

    expect(onMaxQualityChange).toHaveBeenCalledTimes(1);
    expect(onMaxQualityChange).toHaveBeenCalledWith(false);
  });

  /**
   * AC-10: GIVEN eine MaxQualityToggle-Komponente mit disabled={true}
   * WHEN der User auf den Toggle klickt
   * THEN wird onMaxQualityChange NICHT aufgerufen und der Button hat einen
   * visuell deaktivierten Zustand
   */
  it("AC-10: should not call onMaxQualityChange when disabled and button is clicked", async () => {
    const user = userEvent.setup();
    const onMaxQualityChange = vi.fn();

    render(
      <MaxQualityToggle
        maxQuality={false}
        onMaxQualityChange={onMaxQualityChange}
        disabled={true}
      />
    );

    const button = screen.getByRole("switch", { name: "Max Quality" });

    // Button should be disabled
    expect(button).toBeDisabled();

    // Click should not trigger callback
    await user.click(button);
    expect(onMaxQualityChange).not.toHaveBeenCalled();

    // Visual disabled state -- reduced opacity
    expect(button.className).toMatch(/opacity-50/);
    expect(button.className).toMatch(/cursor-not-allowed/);
  });
});
