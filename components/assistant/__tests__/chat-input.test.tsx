// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ChatInput } from "../chat-input";

describe("ChatInput", () => {
  // --------------------------------------------------------------------------
  // AC-6: GIVEN der Startscreen wird angezeigt
  //       WHEN der User den Footer-Bereich betrachtet
  //       THEN ist ein Chat-Input sichtbar mit: Textarea (Placeholder "Nachricht eingeben..."),
  //            einem Send-Button (ArrowUp Icon, disabled), und einem Image-Upload-Button
  //            (Image Icon, als Placeholder ohne Funktionalitaet)
  // --------------------------------------------------------------------------
  it("AC-6: should render textarea with placeholder, disabled send button, and image upload button", () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    // Textarea with correct placeholder
    const textarea = screen.getByTestId("chat-input-textarea");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toBeVisible();
    expect(textarea).toHaveAttribute("placeholder", "Nachricht eingeben...");

    // Send button (disabled by default since textarea is empty)
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).toBeVisible();
    expect(sendBtn).toBeDisabled();

    // Send button contains an SVG (ArrowUp icon)
    const sendSvg = sendBtn.querySelector("svg");
    expect(sendSvg).toBeInTheDocument();

    // Image upload button (placeholder)
    const imageBtn = screen.getByTestId("image-upload-btn");
    expect(imageBtn).toBeInTheDocument();
    expect(imageBtn).toBeVisible();
    expect(imageBtn).toHaveAttribute("aria-label", "Upload image");

    // Image button contains an SVG (Image icon)
    const imageSvg = imageBtn.querySelector("svg");
    expect(imageSvg).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN die Chat-Input Textarea ist leer
  //       WHEN der User den Send-Button betrachtet
  //       THEN ist der Send-Button disabled (nicht klickbar)
  // --------------------------------------------------------------------------
  it("AC-7: should keep send button disabled when textarea is empty", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeDisabled();

    // Clicking a disabled button should not trigger onSend
    await user.click(sendBtn);
    expect(onSend).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN die Chat-Input Textarea enthaelt Text
  //       WHEN der User den Send-Button betrachtet
  //       THEN ist der Send-Button enabled (klickbar)
  // --------------------------------------------------------------------------
  it("AC-8: should enable send button when textarea contains text", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("chat-input-textarea");
    const sendBtn = screen.getByTestId("send-btn");

    // Initially disabled
    expect(sendBtn).toBeDisabled();

    // Type text into the textarea
    await user.type(textarea, "Hello world");

    // Send button should now be enabled
    expect(sendBtn).toBeEnabled();

    // Click the send button to verify it is functional
    await user.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  // --------------------------------------------------------------------------
  // AC-12: GIVEN der User oeffnet den AssistantSheet und die Textarea ist leer
  //        WHEN der Focus-State geprueft wird
  //        THEN liegt der Focus auf der Chat-Input Textarea
  // --------------------------------------------------------------------------
  it("AC-12: should receive focus when autoFocus prop is true", () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} autoFocus={true} />);

    const textarea = screen.getByTestId("chat-input-textarea");
    expect(textarea).toHaveFocus();
  });

  // --------------------------------------------------------------------------
  // AC-12 (negative): autoFocus=false should NOT auto-focus the textarea
  // --------------------------------------------------------------------------
  it("AC-12: should not receive focus when autoFocus prop is false", () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} autoFocus={false} />);

    const textarea = screen.getByTestId("chat-input-textarea");
    expect(textarea).not.toHaveFocus();
  });

  // --------------------------------------------------------------------------
  // Interaction: Enter key submits, Shift+Enter inserts newline
  // (from Constraints: "Enter = Submit, Shift+Enter = Newline")
  // --------------------------------------------------------------------------
  it("should submit on Enter and insert newline on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("chat-input-textarea");

    // Type text and press Shift+Enter (should insert newline, not submit)
    await user.type(textarea, "Line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "Line two");

    // Should NOT have been submitted yet
    expect(onSend).not.toHaveBeenCalled();

    // Now press Enter without Shift (should submit)
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
    // The value should include both lines (trimmed)
    expect(onSend).toHaveBeenCalledWith(expect.stringContaining("Line one"));
    expect(onSend).toHaveBeenCalledWith(expect.stringContaining("Line two"));
  });

  // --------------------------------------------------------------------------
  // Interaction: Textarea clears after send
  // --------------------------------------------------------------------------
  it("should clear textarea after successful send", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId(
      "chat-input-textarea"
    ) as HTMLTextAreaElement;

    await user.type(textarea, "Test message");
    expect(textarea.value).toBe("Test message");

    // Submit
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("Test message");

    // Textarea should be cleared
    expect(textarea.value).toBe("");

    // Send button should be disabled again
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeDisabled();
  });
});
