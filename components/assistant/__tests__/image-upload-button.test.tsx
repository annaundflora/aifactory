// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ImageUploadButton } from "../image-upload-button";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external -- uploadSourceImage Server Action gemockt
// ---------------------------------------------------------------------------

const mockUploadSourceImage = vi.fn();

vi.mock("@/app/actions/generations", () => ({
  uploadSourceImage: (...args: unknown[]) => mockUploadSourceImage(...args),
}));

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFile(
  name: string,
  size: number,
  type: string
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

const defaultProps = {
  onUploadComplete: vi.fn(),
  onError: vi.fn(),
  projectId: "test-project-123",
  disabled: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImageUploadButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-1: GIVEN der Chat-Input ist sichtbar
  //       WHEN der User auf den Image-Upload-Button (Image Icon) klickt
  //       THEN oeffnet sich ein nativer File-Picker mit Accept-Filter fuer image/jpeg, image/png, image/webp
  it("AC-1: should open file picker accepting image/jpeg, image/png, image/webp on click", async () => {
    const user = userEvent.setup();
    render(<ImageUploadButton {...defaultProps} />);

    const fileInput = screen.getByTestId("image-upload-input");
    expect(fileInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp"
    );
    expect(fileInput).toHaveAttribute("type", "file");

    // Verify clicking the button triggers the hidden file input
    const clickSpy = vi.spyOn(fileInput, "click");
    const btn = screen.getByTestId("image-upload-btn");
    await user.click(btn);
    expect(clickSpy).toHaveBeenCalled();
  });

  // AC-2: GIVEN der File-Picker ist geoeffnet
  //       WHEN der User eine gueltige Bilddatei auswaehlt (z.B. JPEG, 2MB)
  //       THEN wird uploadSourceImage mit der Datei aufgerufen und eine Upload-Progress-Anzeige erscheint
  it("AC-2: should call uploadSourceImage and show progress indicator when file is selected", async () => {
    const user = userEvent.setup();
    // Make upload hang so we can verify spinner
    let resolveUpload!: (value: { url: string }) => void;
    mockUploadSourceImage.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );

    render(<ImageUploadButton {...defaultProps} />);

    const file = createFile("photo.jpg", 2 * 1024 * 1024, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");

    await user.upload(fileInput, file);

    // uploadSourceImage should be called with projectId and file
    expect(mockUploadSourceImage).toHaveBeenCalledWith({
      projectId: "test-project-123",
      file,
    });

    // While uploading, button should show spinner (disabled state + Uploading label)
    const btn = screen.getByTestId("image-upload-btn");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-label", "Uploading image");

    // Resolve upload to clean up
    resolveUpload({ url: "https://r2.example.com/img.jpg" });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  // AC-7: GIVEN der User waehlt eine Datei groesser als 10MB
  //       WHEN die Datei-Validierung laeuft
  //       THEN wird ein Toast-Fehler angezeigt ("Bild darf maximal 10 MB gross sein") und kein Upload gestartet
  it("AC-7: should show error toast and not upload when file exceeds 10MB", async () => {
    const user = userEvent.setup();
    render(<ImageUploadButton {...defaultProps} />);

    const bigFile = createFile("huge.png", 11 * 1024 * 1024, "image/png");
    const fileInput = screen.getByTestId("image-upload-input");

    await user.upload(fileInput, bigFile);

    expect(mockToastError).toHaveBeenCalledWith(
      "Bild darf maximal 10 MB gross sein"
    );
    expect(mockUploadSourceImage).not.toHaveBeenCalled();
    expect(defaultProps.onError).toHaveBeenCalledWith(
      "Bild darf maximal 10 MB gross sein"
    );
  });

  // AC-8: GIVEN der User waehlt eine Datei mit ungueltigem Format (z.B. .gif, .bmp)
  //       WHEN die Datei-Validierung laeuft
  //       THEN wird ein Toast-Fehler angezeigt ("Nur JPEG, PNG und WebP Bilder werden unterstuetzt") und kein Upload gestartet
  it("AC-8: should show error toast and not upload for unsupported file formats", async () => {
    render(<ImageUploadButton {...defaultProps} />);

    const gifFile = createFile("anim.gif", 500_000, "image/gif");
    const fileInput = screen.getByTestId("image-upload-input") as HTMLInputElement;

    // userEvent.upload respects the accept attribute and silently drops mismatched files.
    // We use fireEvent.change to simulate a file that bypasses the HTML filter,
    // testing the JS validation layer.
    Object.defineProperty(fileInput, "files", {
      value: [gifFile],
      writable: false,
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Nur JPEG, PNG und WebP Bilder werden unterstuetzt"
      );
    });
    expect(mockUploadSourceImage).not.toHaveBeenCalled();
    expect(defaultProps.onError).toHaveBeenCalledWith(
      "Nur JPEG, PNG und WebP Bilder werden unterstuetzt"
    );
  });

  // AC-9: GIVEN ein Bild-Upload schlaegt fehl (Netzwerkfehler, R2-Fehler)
  //       WHEN der Fehler auftritt
  //       THEN wird ein Toast-Fehler angezeigt ("Bild konnte nicht hochgeladen werden") und der Upload-Progress wird zurueckgesetzt
  it("AC-9: should show error toast and reset progress when upload fails (network error)", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockRejectedValue(new Error("Network error"));

    render(<ImageUploadButton {...defaultProps} />);

    const file = createFile("photo.jpg", 1 * 1024 * 1024, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Bild konnte nicht hochgeladen werden"
      );
    });

    // Progress should be reset (button re-enabled)
    const btn = screen.getByTestId("image-upload-btn");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("aria-label", "Upload image");
  });

  // AC-9 variant: Upload returns error object from server action
  it("AC-9: should show error toast when uploadSourceImage returns error result", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      error: "R2 bucket unavailable",
    });

    render(<ImageUploadButton {...defaultProps} />);

    const file = createFile("photo.png", 2 * 1024 * 1024, "image/png");
    const fileInput = screen.getByTestId("image-upload-input");

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("R2 bucket unavailable");
    });

    const btn = screen.getByTestId("image-upload-btn");
    expect(btn).not.toBeDisabled();
  });

  // AC-2/AC-3 completion: onUploadComplete is called with R2 URL
  it("AC-3: should call onUploadComplete with R2 URL after successful upload", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      url: "https://r2.example.com/uploads/photo.jpg",
    });

    render(<ImageUploadButton {...defaultProps} />);

    const file = createFile("photo.jpg", 2 * 1024 * 1024, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(defaultProps.onUploadComplete).toHaveBeenCalledWith(
        "https://r2.example.com/uploads/photo.jpg"
      );
    });
  });
});
