// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ChatThread } from "../chat-thread";
import type { Message } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// jsdom does not implement scrollIntoView -- provide a no-op stub
// ---------------------------------------------------------------------------

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

// ---------------------------------------------------------------------------
// Tests for AC-6: Inline image thumbnail in user message bubble
// ---------------------------------------------------------------------------

describe("ChatThread (Image in Messages)", () => {
  // AC-6: GIVEN eine User-Message wurde mit image_url gesendet
  //       WHEN die Message im Chat-Thread gerendert wird
  //       THEN erscheint ein Thumbnail (max 120x120px, abgerundete Ecken) des hochgeladenen Bildes inline in der User-Message-Bubble, oberhalb des Nachrichtentexts
  it("AC-6: should render image thumbnail inside user message bubble when message has imageUrl", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Analyze this image please",
        imageUrl: "https://r2.example.com/uploads/photo.jpg",
      },
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    const userMessage = screen.getByTestId("user-message");
    expect(userMessage).toBeInTheDocument();

    // Image preview should be rendered inside the user message
    const preview = screen.getByTestId("image-preview");
    expect(preview).toBeInTheDocument();

    // Should use md size (120x120)
    expect(preview.className).toMatch(/h-\[120px\]/);
    expect(preview.className).toMatch(/w-\[120px\]/);

    // The img element should have the correct src
    const img = screen.getByRole("img", { name: /uploaded reference/i });
    expect(img).toHaveAttribute(
      "src",
      "https://r2.example.com/uploads/photo.jpg"
    );
    expect(img.className).toMatch(/rounded-xl/);

    // Message text should also be present
    expect(userMessage).toHaveTextContent("Analyze this image please");
  });

  // AC-6 negative: no image preview when message has no imageUrl
  it("AC-6: should not render image preview when user message has no imageUrl", () => {
    const messages: Message[] = [
      {
        id: "msg-2",
        role: "user",
        content: "Just a text message",
      },
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    expect(screen.getByTestId("user-message")).toBeInTheDocument();
    expect(screen.queryByTestId("image-preview")).not.toBeInTheDocument();
  });

  // AC-6: No X button on inline message thumbnails (not removable)
  it("AC-6: should not render remove button on inline message thumbnail", () => {
    const messages: Message[] = [
      {
        id: "msg-3",
        role: "user",
        content: "With image",
        imageUrl: "https://r2.example.com/uploads/photo.jpg",
      },
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    expect(
      screen.queryByTestId("image-preview-remove")
    ).not.toBeInTheDocument();
  });
});
