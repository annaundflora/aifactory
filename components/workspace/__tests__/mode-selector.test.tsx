// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix DropdownMenu needs ResizeObserver + pointer events)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
});

import { ModeSelector } from "../mode-selector";

describe("ModeSelector Acceptance", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN ModeSelector mit value="txt2img" gerendert wird
  //        WHEN die Komponente im DOM erscheint
  //        THEN zeigt der Trigger-Button das Label "Text to Image" an.
  //             Die drei Optionen sind nur im geoffneten Dropdown sichtbar.
  // --------------------------------------------------------------------------
  it("AC-1: should render trigger with txt2img label when value is txt2img", () => {
    const onChange = vi.fn();
    render(<ModeSelector value="txt2img" onChange={onChange} />);

    // Trigger button should show the current mode label
    const trigger = screen.getByTestId("mode-selector");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Text to Image");
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN ModeSelector mit value="img2img" gerendert wird
  //        WHEN die Komponente im DOM erscheint
  //        THEN zeigt der Trigger-Button das Label "Image to Image" an
  // --------------------------------------------------------------------------
  it("AC-2: should show img2img label on trigger when value is img2img", () => {
    const onChange = vi.fn();
    render(<ModeSelector value="img2img" onChange={onChange} />);

    const trigger = screen.getByTestId("mode-selector");
    expect(trigger).toHaveTextContent("Image to Image");
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN ModeSelector mit value="upscale" gerendert wird
  //        WHEN die Komponente im DOM erscheint
  //        THEN zeigt der Trigger-Button das Label "Upscale" an
  // --------------------------------------------------------------------------
  it("AC-3: should show upscale label on trigger when value is upscale", () => {
    const onChange = vi.fn();
    render(<ModeSelector value="upscale" onChange={onChange} />);

    const trigger = screen.getByTestId("mode-selector");
    expect(trigger).toHaveTextContent("Upscale");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN ModeSelector mit value="txt2img" und einem onChange-Spy
  //        WHEN der Nutzer das Dropdown oeffnet und auf "Image to Image" klickt
  //        THEN wird onChange einmal mit dem Argument "img2img" aufgerufen
  // --------------------------------------------------------------------------
  it('AC-4: should call onChange with "img2img" when Image to Image item is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="txt2img" onChange={onChange} />);

    // Open the dropdown
    const trigger = screen.getByTestId("mode-selector");
    await user.click(trigger);

    // Find and click the "Image to Image" menu item
    const img2imgItem = await screen.findByRole("menuitem", { name: /Image to Image/i });
    await user.click(img2imgItem);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("img2img");
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN ModeSelector mit value="txt2img" und einem onChange-Spy
  //        WHEN der Nutzer das Dropdown oeffnet und auf "Upscale" klickt
  //        THEN wird onChange einmal mit dem Argument "upscale" aufgerufen
  // --------------------------------------------------------------------------
  it('AC-5: should call onChange with "upscale" when Upscale item is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="txt2img" onChange={onChange} />);

    // Open the dropdown
    const trigger = screen.getByTestId("mode-selector");
    await user.click(trigger);

    // Find and click the "Upscale" menu item
    const upscaleItem = await screen.findByRole("menuitem", { name: /Upscale/i });
    await user.click(upscaleItem);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("upscale");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN ModeSelector mit value="img2img" und einem onChange-Spy
  //        WHEN der Nutzer das Dropdown oeffnet und auf das bereits aktive
  //        "Image to Image" klickt
  //        THEN wird onChange aufgerufen oder nicht — kein Fehler
  // --------------------------------------------------------------------------
  it("AC-6: should not throw when clicking the already active item", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="img2img" onChange={onChange} />);

    // Open the dropdown
    const trigger = screen.getByTestId("mode-selector");
    await user.click(trigger);

    // Find and click the already-active "Image to Image" menu item
    const img2imgItem = await screen.findByRole("menuitem", { name: /Image to Image/i });
    await expect(user.click(img2imgItem)).resolves.not.toThrow();

    // onChange may or may not be called -- both are acceptable per spec.
    // We just verify no error occurred (implicit via test not throwing).
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN ModeSelector mit value="txt2img" und disabledModes=["img2img"]
  //        WHEN das Dropdown geoeffnet wird und "Image to Image" disabled ist
  //        THEN ist das Item nicht anklickbar und onChange wird beim Klick
  //             nicht aufgerufen
  // --------------------------------------------------------------------------
  it("AC-7: should not call onChange when a disabled item is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModeSelector
        value="txt2img"
        onChange={onChange}
        disabledModes={["img2img"]}
      />
    );

    // Open the dropdown
    const trigger = screen.getByTestId("mode-selector");
    await user.click(trigger);

    // The disabled menu item should have data-disabled attribute (Radix convention)
    const img2imgItem = await screen.findByRole("menuitem", { name: /Image to Image/i });
    expect(img2imgItem).toHaveAttribute("data-disabled");

    // Click on the disabled item should not trigger onChange
    await user.click(img2imgItem);
    expect(onChange).not.toHaveBeenCalled();
  });
});
