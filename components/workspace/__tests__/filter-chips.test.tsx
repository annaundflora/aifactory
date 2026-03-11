// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { FilterChips } from "@/components/workspace/filter-chips";
import { ModeBadge } from "@/components/workspace/mode-badge";

// ===========================================================================
// FilterChips
// ===========================================================================

describe("FilterChips", () => {
  // AC-1: Vier Chips mit korrekten Labels
  it("AC-1: GIVEN FilterChips with value='all' WHEN rendered THEN four chips visible with labels Alle, Text to Image, Image to Image, Upscale", () => {
    const onChange = vi.fn();
    render(<FilterChips value="all" onChange={onChange} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toHaveTextContent("Alle");
    expect(buttons[1]).toHaveTextContent("Text to Image");
    expect(buttons[2]).toHaveTextContent("Image to Image");
    expect(buttons[3]).toHaveTextContent("Upscale");
  });

  // AC-2: Aktiver Chip bei value="all"
  it("AC-2: GIVEN FilterChips with value='all' WHEN chip states inspected THEN only Alle chip has aria-pressed=true", () => {
    const onChange = vi.fn();
    render(<FilterChips value="all" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Alle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Text to Image" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Image to Image" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Upscale" })).toHaveAttribute("aria-pressed", "false");
  });

  // AC-3: Aktiver Chip bei value="img2img"
  it("AC-3: GIVEN FilterChips with value='img2img' WHEN chip states inspected THEN only Image to Image chip is active", () => {
    const onChange = vi.fn();
    render(<FilterChips value="img2img" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Alle" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Text to Image" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Image to Image" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Upscale" })).toHaveAttribute("aria-pressed", "false");
  });

  // AC-4: onChange mit korrektem Wert beim Klick
  it("AC-4: GIVEN FilterChips with onChange spy WHEN user clicks Image to Image chip THEN onChange called once with 'img2img'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips value="all" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Image to Image" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("img2img");
  });

  // AC-5: Chip-Wechsel deaktiviert vorherigen Chip
  it("AC-5: GIVEN FilterChips with value='img2img' WHEN user clicks Upscale THEN onChange called with 'upscale'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips value="img2img" onChange={onChange} />);

    // Verify img2img is active before click
    expect(screen.getByRole("button", { name: "Image to Image" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Upscale" }));

    expect(onChange).toHaveBeenCalledWith("upscale");
  });

  // AC-6: Kein onChange bei Klick auf bereits aktiven Chip
  it("AC-6: GIVEN FilterChips with value='txt2img' WHEN user clicks the already active Text to Image chip THEN onChange is NOT called", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips value="txt2img" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Text to Image" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Text to Image" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// ModeBadge
// ===========================================================================

describe("ModeBadge", () => {
  // AC-7: ModeBadge zeigt T fuer txt2img
  it("AC-7: GIVEN ModeBadge with mode='txt2img' WHEN rendered THEN shows text 'T'", () => {
    render(<ModeBadge mode="txt2img" />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  // AC-8: ModeBadge zeigt I fuer img2img
  it("AC-8: GIVEN ModeBadge with mode='img2img' WHEN rendered THEN shows text 'I'", () => {
    render(<ModeBadge mode="img2img" />);
    expect(screen.getByText("I")).toBeInTheDocument();
  });

  // AC-9: ModeBadge zeigt U fuer upscale
  it("AC-9: GIVEN ModeBadge with mode='upscale' WHEN rendered THEN shows text 'U'", () => {
    render(<ModeBadge mode="upscale" />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  // AC-10: ModeBadge title-Attribut
  it("AC-10: GIVEN ModeBadge with any mode WHEN DOM inspected THEN title attribute contains full mode name", () => {
    const { rerender } = render(<ModeBadge mode="txt2img" />);
    expect(screen.getByTitle("Text to Image")).toBeInTheDocument();

    rerender(<ModeBadge mode="img2img" />);
    expect(screen.getByTitle("Image to Image")).toBeInTheDocument();

    rerender(<ModeBadge mode="upscale" />);
    expect(screen.getByTitle("Upscale")).toBeInTheDocument();
  });
});
