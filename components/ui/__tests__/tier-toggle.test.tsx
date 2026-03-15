// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { TierToggle } from "@/components/ui/tier-toggle";

/**
 * Acceptance Tests for Slice 05: Tier Toggle Component
 *
 * These tests validate the TierToggle segmented control component
 * against the Acceptance Criteria defined in the slice spec.
 *
 * Mocking Strategy: no_mocks (pure UI component with callback props)
 */
describe("TierToggle", () => {
  /**
   * AC-1: GIVEN eine TierToggle-Komponente mit tier="draft"
   * WHEN sie gerendert wird
   * THEN zeigt sie zwei Segmente "Draft" und "Quality", wobei "Draft" den
   * aktiven Stil hat (bg-primary text-primary-foreground) und "Quality" den
   * inaktiven Stil
   */
  it("AC-1: should render Draft segment with active styling when tier is draft", () => {
    render(<TierToggle tier="draft" onTierChange={vi.fn()} />);

    const draftButton = screen.getByRole("button", { name: "Draft" });
    const qualityButton = screen.getByRole("button", { name: "Quality" });

    // Both segments must be present
    expect(draftButton).toBeInTheDocument();
    expect(qualityButton).toBeInTheDocument();

    // Draft should be active (aria-pressed)
    expect(draftButton).toHaveAttribute("aria-pressed", "true");
    expect(draftButton).toHaveAttribute("data-active", "true");

    // Draft should have active styling classes
    expect(draftButton.className).toMatch(/bg-primary/);
    expect(draftButton.className).toMatch(/text-primary-foreground/);

    // Quality should be inactive
    expect(qualityButton).toHaveAttribute("aria-pressed", "false");
    expect(qualityButton).toHaveAttribute("data-active", "false");

    // Quality should have inactive styling (muted text)
    expect(qualityButton.className).toMatch(/text-muted-foreground/);
    expect(qualityButton.className).not.toMatch(/bg-primary/);
  });

  /**
   * AC-2: GIVEN eine TierToggle-Komponente mit tier="quality"
   * WHEN sie gerendert wird
   * THEN hat "Quality" den aktiven Stil und "Draft" den inaktiven Stil
   */
  it("AC-2: should render Quality segment with active styling when tier is quality", () => {
    render(<TierToggle tier="quality" onTierChange={vi.fn()} />);

    const draftButton = screen.getByRole("button", { name: "Draft" });
    const qualityButton = screen.getByRole("button", { name: "Quality" });

    // Quality should be active
    expect(qualityButton).toHaveAttribute("aria-pressed", "true");
    expect(qualityButton).toHaveAttribute("data-active", "true");
    expect(qualityButton.className).toMatch(/bg-primary/);
    expect(qualityButton.className).toMatch(/text-primary-foreground/);

    // Draft should be inactive
    expect(draftButton).toHaveAttribute("aria-pressed", "false");
    expect(draftButton).toHaveAttribute("data-active", "false");
    expect(draftButton.className).toMatch(/text-muted-foreground/);
    expect(draftButton.className).not.toMatch(/bg-primary/);
  });

  /**
   * AC-3: GIVEN eine TierToggle-Komponente mit tier="draft"
   * WHEN der User auf das "Quality"-Segment klickt
   * THEN wird onTierChange("quality") aufgerufen
   */
  it("AC-3: should call onTierChange with quality when Quality segment is clicked", async () => {
    const user = userEvent.setup();
    const onTierChange = vi.fn();

    render(<TierToggle tier="draft" onTierChange={onTierChange} />);

    const qualityButton = screen.getByRole("button", { name: "Quality" });
    await user.click(qualityButton);

    expect(onTierChange).toHaveBeenCalledTimes(1);
    expect(onTierChange).toHaveBeenCalledWith("quality");
  });

  /**
   * AC-4: GIVEN eine TierToggle-Komponente mit tier="quality"
   * WHEN der User auf das "Draft"-Segment klickt
   * THEN wird onTierChange("draft") aufgerufen
   */
  it("AC-4: should call onTierChange with draft when Draft segment is clicked", async () => {
    const user = userEvent.setup();
    const onTierChange = vi.fn();

    render(<TierToggle tier="quality" onTierChange={onTierChange} />);

    const draftButton = screen.getByRole("button", { name: "Draft" });
    await user.click(draftButton);

    expect(onTierChange).toHaveBeenCalledTimes(1);
    expect(onTierChange).toHaveBeenCalledWith("draft");
  });

  /**
   * AC-5: GIVEN eine TierToggle-Komponente mit disabled={true}
   * WHEN der User auf ein Segment klickt
   * THEN wird onTierChange NICHT aufgerufen und beide Segmente haben einen
   * visuell deaktivierten Zustand (reduzierte Opacity)
   */
  it("AC-5: should not call onTierChange when disabled and segment is clicked", async () => {
    const user = userEvent.setup();
    const onTierChange = vi.fn();

    render(
      <TierToggle tier="draft" onTierChange={onTierChange} disabled={true} />
    );

    const draftButton = screen.getByRole("button", { name: "Draft" });
    const qualityButton = screen.getByRole("button", { name: "Quality" });

    // Both buttons should be disabled
    expect(draftButton).toBeDisabled();
    expect(qualityButton).toBeDisabled();

    // Click on both segments -- onTierChange must NOT be called
    await user.click(qualityButton);
    await user.click(draftButton);
    expect(onTierChange).not.toHaveBeenCalled();

    // The outer container should have reduced opacity for visual disabled state
    const container = screen.getByTestId("tier-toggle");
    expect(container.className).toMatch(/opacity-50/);
  });

  /**
   * AC-11: GIVEN eine TierToggle-Komponente
   * WHEN sie mit className="custom-class" gerendert wird
   * THEN wird die Custom-Class auf den aeusseren Container angewendet
   * (Composability fuer verschiedene Einbau-Kontexte)
   */
  it("AC-11: should apply custom className to outer container", () => {
    render(
      <TierToggle
        tier="draft"
        onTierChange={vi.fn()}
        className="custom-class"
      />
    );

    const container = screen.getByTestId("tier-toggle");
    expect(container).toHaveClass("custom-class");
  });
});
