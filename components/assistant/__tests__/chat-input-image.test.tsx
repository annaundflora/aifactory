// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ChatInput } from "../chat-input";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external -- uploadSourceImage Server Action gemockt
// ---------------------------------------------------------------------------

const mockUploadSourceImage = vi.fn();

vi.mock("@/app/actions/upload", () => ({
  uploadSourceImage: (...args: unknown[]) => mockUploadSourceImage(...args),
}));

// Mock sonner toast (required by ImageUploadButton child)
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
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
  onSend: vi.fn(),
  isStreaming: false,
  disabled: false,
  projectId: "test-project-123",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatInput (Image Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-5: GIVEN ein pendingImageUrl existiert im State und der User hat Text eingegeben
  //       WHEN der User auf Send klickt oder Enter drueckt
  //       THEN wird sendMessage(content, pendingImageUrl) aufgerufen und der pendingImageUrl State wird zurueckgesetzt
  it("AC-5: should call onSend with content and pendingImageUrl on submit and reset pendingImageUrl", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      url: "https://r2.example.com/uploads/photo.jpg",
    });

    render(<ChatInput {...defaultProps} />);

    // Step 1: Upload an image to set pendingImageUrl
    const file = createFile("photo.jpg", 1 * 1024 * 1024, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");
    await user.upload(fileInput, file);

    // Wait for upload to complete and preview to appear
    await waitFor(() => {
      expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    });

    // Step 2: Type text
    const textarea = screen.getByTestId("chat-input-textarea");
    await user.type(textarea, "Analyze this image");

    // Step 3: Click send
    const sendBtn = screen.getByTestId("send-btn");
    await user.click(sendBtn);

    // Verify onSend was called with text and imageUrl
    expect(defaultProps.onSend).toHaveBeenCalledWith(
      "Analyze this image",
      ["https://r2.example.com/uploads/photo.jpg"]
    );

    // pendingImageUrl should be reset -- preview should be gone
    await waitFor(() => {
      expect(screen.queryByTestId("image-preview")).not.toBeInTheDocument();
    });
  });

  // AC-5 variant: Enter key also triggers send with image
  it("AC-5: should call onSend with content and pendingImageUrl when pressing Enter", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      url: "https://r2.example.com/uploads/photo.jpg",
    });

    render(<ChatInput {...defaultProps} />);

    // Upload an image
    const file = createFile("photo.jpg", 1 * 1024 * 1024, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    });

    // Type text and press Enter
    const textarea = screen.getByTestId("chat-input-textarea");
    await user.type(textarea, "Describe this{Enter}");

    expect(defaultProps.onSend).toHaveBeenCalledWith(
      "Describe this",
      ["https://r2.example.com/uploads/photo.jpg"]
    );
  });

  // AC-10: GIVEN kein pendingImageUrl existiert und die Textarea ist leer
  //        WHEN der User auf Send klickt
  //        THEN passiert nichts (Send-Button bleibt disabled)
  it("AC-10: should keep send button disabled when no text and no pendingImageUrl", async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeDisabled();

    // Try clicking -- should not trigger onSend
    await user.click(sendBtn);
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  // AC-3: GIVEN ein Bild-Upload laeuft / ist abgeschlossen
  //       WHEN der Upload erfolgreich ist
  //       THEN erscheint ein Thumbnail-Preview oberhalb der Chat-Input Textarea
  it("AC-3: should show image preview area above textarea when pendingImageUrl is set", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      url: "https://r2.example.com/uploads/photo.jpg",
    });

    render(<ChatInput {...defaultProps} />);

    // Initially no preview area
    expect(screen.queryByTestId("image-preview-area")).not.toBeInTheDocument();

    // Upload an image
    const file = createFile("photo.png", 500_000, "image/png");
    const fileInput = screen.getByTestId("image-upload-input");
    await user.upload(fileInput, file);

    // Preview area should appear above textarea
    await waitFor(() => {
      expect(screen.getByTestId("image-preview-area")).toBeInTheDocument();
      expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    });

    // The preview should show the uploaded image
    const img = screen.getByRole("img", { name: /uploaded reference/i });
    expect(img).toHaveAttribute(
      "src",
      "https://r2.example.com/uploads/photo.jpg"
    );
  });

  // AC-4: Removing the preview via X button clears the pendingImageUrl
  it("AC-4: should remove image preview when X button is clicked in preview area", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      url: "https://r2.example.com/uploads/photo.jpg",
    });

    render(<ChatInput {...defaultProps} />);

    // Upload an image
    const file = createFile("photo.jpg", 500_000, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    });

    // Click X to remove
    const removeBtn = screen.getByTestId("image-preview-remove");
    await user.click(removeBtn);

    // Preview should be gone
    await waitFor(() => {
      expect(screen.queryByTestId("image-preview-area")).not.toBeInTheDocument();
    });
  });

  // AC-5 edge case: send with image but empty text should still work (image alone is enough)
  it("AC-5: should allow sending with only an image and no text", async () => {
    const user = userEvent.setup();
    mockUploadSourceImage.mockResolvedValue({
      url: "https://r2.example.com/uploads/photo.jpg",
    });

    render(<ChatInput {...defaultProps} />);

    // Upload an image (no text typed)
    const file = createFile("photo.jpg", 1 * 1024 * 1024, "image/jpeg");
    const fileInput = screen.getByTestId("image-upload-input");
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    });

    // Send button should be enabled even without text
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).not.toBeDisabled();

    await user.click(sendBtn);

    expect(defaultProps.onSend).toHaveBeenCalledWith(
      "Analysiere diese Bilder",
      ["https://r2.example.com/uploads/photo.jpg"]
    );
  });
});
