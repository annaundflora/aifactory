// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ModeSelector } from "../mode-selector";

describe("ModeSelector Acceptance", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN ModeSelector mit value="txt2img" gerendert wird
  //        WHEN die Komponente im DOM erscheint
  //        THEN sind alle drei Segmente sichtbar mit den Labels "Text to Image",
  //             "Image to Image" und "Upscale" — und exakt das Segment mit Wert
  //             "txt2img" traegt das aktive Styling (aria-pressed="true")
  // --------------------------------------------------------------------------
  it("AC-1: should render all three segments with txt2img active when value is txt2img", () => {
    const onChange = vi.fn();
    render(<ModeSelector value="txt2img" onChange={onChange} />);

    // All three segments visible
    expect(screen.getByText("Text to Image")).toBeInTheDocument();
    expect(screen.getByText("Image to Image")).toBeInTheDocument();
    expect(screen.getByText("Upscale")).toBeInTheDocument();

    // txt2img is active
    const txt2imgBtn = screen.getByText("Text to Image");
    expect(txt2imgBtn).toHaveAttribute("aria-pressed", "true");

    // Others are not active
    expect(screen.getByText("Image to Image")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Upscale")).toHaveAttribute("aria-pressed", "false");
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN ModeSelector mit value="img2img" gerendert wird
  //        WHEN die Komponente im DOM erscheint
  //        THEN ist exakt das Segment mit Wert "img2img" aktiv markiert
  // --------------------------------------------------------------------------
  it("AC-2: should mark img2img segment as active when value is img2img", () => {
    const onChange = vi.fn();
    render(<ModeSelector value="img2img" onChange={onChange} />);

    expect(screen.getByText("Image to Image")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Text to Image")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Upscale")).toHaveAttribute("aria-pressed", "false");
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN ModeSelector mit value="upscale" gerendert wird
  //        WHEN die Komponente im DOM erscheint
  //        THEN ist exakt das Segment mit Wert "upscale" aktiv markiert
  // --------------------------------------------------------------------------
  it("AC-3: should mark upscale segment as active when value is upscale", () => {
    const onChange = vi.fn();
    render(<ModeSelector value="upscale" onChange={onChange} />);

    expect(screen.getByText("Upscale")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Text to Image")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Image to Image")).toHaveAttribute("aria-pressed", "false");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN ModeSelector mit value="txt2img" und einem onChange-Spy
  //        WHEN der Nutzer auf das Segment "Image to Image" klickt
  //        THEN wird onChange einmal mit dem Argument "img2img" aufgerufen
  // --------------------------------------------------------------------------
  it('AC-4: should call onChange with "img2img" when Image to Image segment is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="txt2img" onChange={onChange} />);

    await user.click(screen.getByText("Image to Image"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("img2img");
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN ModeSelector mit value="txt2img" und einem onChange-Spy
  //        WHEN der Nutzer auf das Segment "Upscale" klickt
  //        THEN wird onChange einmal mit dem Argument "upscale" aufgerufen
  // --------------------------------------------------------------------------
  it('AC-5: should call onChange with "upscale" when Upscale segment is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="txt2img" onChange={onChange} />);

    await user.click(screen.getByText("Upscale"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("upscale");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN ModeSelector mit value="img2img" und einem onChange-Spy
  //        WHEN der Nutzer auf das bereits aktive Segment "Image to Image" klickt
  //        THEN wird onChange nicht aufgerufen oder mit "img2img" aufgerufen
  //             — konsistentes Verhalten, kein Fehler
  // --------------------------------------------------------------------------
  it("AC-6: should not throw when clicking the already active segment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="img2img" onChange={onChange} />);

    // Must not throw
    await expect(
      user.click(screen.getByText("Image to Image"))
    ).resolves.not.toThrow();

    // onChange may or may not be called — both are acceptable per spec.
    // We just verify no error occurred (implicit via test not throwing).
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN ModeSelector mit value="txt2img" und disabledModes=["img2img"]
  //        WHEN das Segment "Image to Image" disabled ist
  //        THEN ist das Segment nicht anklickbar und onChange wird beim Klick
  //             nicht aufgerufen
  // --------------------------------------------------------------------------
  it("AC-7: should not call onChange when a disabled segment is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModeSelector
        value="txt2img"
        onChange={onChange}
        disabledModes={["img2img"]}
      />
    );

    const img2imgBtn = screen.getByText("Image to Image");

    // aria-disabled signals the disabled state (not the HTML disabled attribute)
    expect(img2imgBtn).toHaveAttribute("aria-disabled", "true");

    // Click on the disabled segment should not trigger onChange
    await user.click(img2imgBtn);
    expect(onChange).not.toHaveBeenCalled();
  });
});
