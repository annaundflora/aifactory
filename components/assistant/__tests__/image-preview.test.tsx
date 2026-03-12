// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ImagePreview } from "../image-preview";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImagePreview", () => {
  const TEST_URL = "https://r2.example.com/uploads/photo.jpg";

  // AC-3: GIVEN ein Bild-Upload laeuft
  //       WHEN der Upload erfolgreich abgeschlossen ist
  //       THEN wird die R2-URL im lokalen State gespeichert und ein Thumbnail-Preview (max 80x80px) erscheint oberhalb der Chat-Input Textarea
  it("AC-3: should render thumbnail with image URL after successful upload (sm size = 80x80)", () => {
    render(<ImagePreview src={TEST_URL} size="sm" />);

    const preview = screen.getByTestId("image-preview");
    expect(preview).toBeInTheDocument();

    const img = screen.getByRole("img", { name: /uploaded reference/i });
    expect(img).toHaveAttribute("src", TEST_URL);

    // sm size should have the 80x80 class
    expect(preview.className).toMatch(/w-20/);
    expect(preview.className).toMatch(/h-20/);
  });

  // AC-4: GIVEN ein Bild-Preview ist sichtbar oberhalb der Textarea
  //       WHEN der User das X-Icon am Thumbnail klickt
  //       THEN wird der pendingImageUrl State geleert und das Thumbnail entfernt
  it("AC-4: should call onRemove when X icon is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(<ImagePreview src={TEST_URL} onRemove={onRemove} size="sm" />);

    const removeBtn = screen.getByTestId("image-preview-remove");
    expect(removeBtn).toBeInTheDocument();

    // Actually click the remove button -- interaction test, not just DOM existence
    await user.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  // AC-4 variant: no X button when onRemove is not provided (message inline mode)
  it("AC-4: should not render X button when onRemove is not provided", () => {
    render(<ImagePreview src={TEST_URL} size="md" />);

    expect(screen.queryByTestId("image-preview-remove")).not.toBeInTheDocument();
  });

  // AC-6: GIVEN eine User-Message wurde mit image_url gesendet
  //       WHEN die Message im Chat-Thread gerendert wird
  //       THEN erscheint ein Thumbnail (max 120x120px, abgerundete Ecken) des hochgeladenen Bildes inline in der User-Message-Bubble
  it("AC-6: should render image thumbnail at md size (120x120) for inline message display", () => {
    render(<ImagePreview src={TEST_URL} size="md" />);

    const preview = screen.getByTestId("image-preview");
    expect(preview).toBeInTheDocument();

    // md size should have the 120x120 classes
    expect(preview.className).toMatch(/h-\[120px\]/);
    expect(preview.className).toMatch(/w-\[120px\]/);

    const img = screen.getByRole("img");
    // Image should have rounded corners (rounded-xl for md)
    expect(img.className).toMatch(/rounded-xl/);
    expect(img.className).toMatch(/object-cover/);
  });
});
