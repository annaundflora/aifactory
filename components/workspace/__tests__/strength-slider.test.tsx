// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { StrengthSlider } from "../strength-slider";

describe("StrengthSlider Acceptance", () => {
  // --------------------------------------------------------------------------
  // AC-1: Alle drei Preset-Buttons sichtbar; Wert "0.60" angezeigt; Slider zeigt 0.6
  // --------------------------------------------------------------------------
  it("AC-1: GIVEN value=0.6 WHEN rendered THEN all three presets visible, value shows 0.60, slider at 0.6", () => {
    render(<StrengthSlider value={0.6} onChange={() => {}} />);

    // All three preset buttons visible
    expect(screen.getByRole("button", { name: "Subtle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Balanced" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Creative" })).toBeInTheDocument();

    // Numeric value displayed as "0.60"
    expect(screen.getByText("0.60")).toBeInTheDocument();

    // Slider shows value 0.6
    const slider = screen.getByRole("slider", { name: "Strength" });
    expect(slider).toHaveValue("0.6");
  });

  // --------------------------------------------------------------------------
  // AC-2: Balanced aria-pressed="true" bei value=0.6
  // --------------------------------------------------------------------------
  it("AC-2: GIVEN value=0.6 WHEN rendered THEN Balanced is aria-pressed=true, others are not", () => {
    render(<StrengthSlider value={0.6} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Balanced" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Subtle" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Creative" })).toHaveAttribute("aria-pressed", "false");
  });

  // --------------------------------------------------------------------------
  // AC-3: Subtle aktiv bei value=0.3; Wert "0.30" angezeigt
  // --------------------------------------------------------------------------
  it("AC-3: GIVEN value=0.3 WHEN rendered THEN Subtle is active, others not, value shows 0.30", () => {
    render(<StrengthSlider value={0.3} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Subtle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Balanced" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Creative" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("0.30")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-4: Creative aktiv bei value=0.85; Wert "0.85" angezeigt
  // --------------------------------------------------------------------------
  it("AC-4: GIVEN value=0.85 WHEN rendered THEN Creative is active, others not, value shows 0.85", () => {
    render(<StrengthSlider value={0.85} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Creative" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Subtle" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Balanced" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("0.85")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-5: Kein Preset aktiv bei value=0.5; Wert "0.50" angezeigt
  // --------------------------------------------------------------------------
  it("AC-5: GIVEN value=0.5 (no preset match) WHEN rendered THEN no preset is active, value shows 0.50", () => {
    render(<StrengthSlider value={0.5} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Subtle" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Balanced" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Creative" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("0.50")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-6: Klick Balanced -> onChange(0.6)
  // --------------------------------------------------------------------------
  it("AC-6: GIVEN onChange spy WHEN Balanced clicked THEN onChange called with 0.6", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StrengthSlider value={0.3} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Balanced" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(0.6);
  });

  // --------------------------------------------------------------------------
  // AC-7: Klick Subtle -> onChange(0.3)
  // --------------------------------------------------------------------------
  it("AC-7: GIVEN onChange spy WHEN Subtle clicked THEN onChange called with 0.3", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StrengthSlider value={0.6} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Subtle" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  // --------------------------------------------------------------------------
  // AC-8: Klick Creative -> onChange(0.85)
  // --------------------------------------------------------------------------
  it("AC-8: GIVEN onChange spy WHEN Creative clicked THEN onChange called with 0.85", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StrengthSlider value={0.6} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Creative" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(0.85);
  });

  // --------------------------------------------------------------------------
  // AC-9: Slider change to 0.4 -> onChange(0.4)
  // --------------------------------------------------------------------------
  it("AC-9: GIVEN value=0.6 and onChange spy WHEN slider changed to 0.4 THEN onChange called with 0.4", () => {
    const onChange = vi.fn();
    render(<StrengthSlider value={0.6} onChange={onChange} />);

    const slider = screen.getByRole("slider", { name: "Strength" });
    fireEvent.change(slider, { target: { value: "0.4" } });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(0.4);
  });

  // --------------------------------------------------------------------------
  // AC-10: value=0.7 (non-preset) -> no preset active, value shows "0.70"
  // --------------------------------------------------------------------------
  it("AC-10: GIVEN value=0.7 (non-preset) WHEN rendered THEN no preset active, value shows 0.70", () => {
    render(<StrengthSlider value={0.7} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Subtle" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Balanced" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Creative" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("0.70")).toBeInTheDocument();
  });
});
