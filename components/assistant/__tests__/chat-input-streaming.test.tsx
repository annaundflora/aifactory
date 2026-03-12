// @vitest-environment jsdom
/**
 * Tests for ChatInput streaming behavior (Slice 11)
 *
 * Tests AC-4, AC-5, AC-6, AC-7, AC-8 from slice-11-streaming-stop spec.
 * Mocking Strategy: mock_external (as defined in slice spec)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ChatInput } from "../chat-input";

describe("ChatInput - Streaming Behavior", () => {
  // --------------------------------------------------------------------------
  // AC-4: GIVEN isStreaming === true
  //       WHEN der Chat-Input-Footer gerendert wird
  //       THEN ist der Send-Button (ArrowUp Icon) durch einen Stop-Button
  //            (Square Icon) ersetzt
  // --------------------------------------------------------------------------
  it("AC-4: should show stop button with Square icon when isStreaming is true", () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(
      <ChatInput onSend={onSend} isStreaming={true} onStop={onStop} />
    );

    // Stop button should be visible
    const stopBtn = screen.getByTestId("stop-btn");
    expect(stopBtn).toBeInTheDocument();
    expect(stopBtn).toBeVisible();
    expect(stopBtn).toHaveAttribute("aria-label", "Stop response");

    // Stop button should contain an SVG (Square icon)
    const svg = stopBtn.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Send button should NOT be in the DOM
    expect(screen.queryByTestId("send-btn")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN isStreaming === false
  //       WHEN der Chat-Input-Footer gerendert wird
  //       THEN wird der Send-Button (ArrowUp Icon) angezeigt (kein Stop-Button)
  // --------------------------------------------------------------------------
  it("AC-5: should show send button with ArrowUp icon when isStreaming is false", () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} isStreaming={false} />);

    // Send button should be visible
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).toBeVisible();
    expect(sendBtn).toHaveAttribute("aria-label", "Send message");

    // Send button should contain an SVG (ArrowUp icon)
    const svg = sendBtn.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Stop button should NOT be in the DOM
    expect(screen.queryByTestId("stop-btn")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN der Agent streamt eine Antwort
  //       WHEN der User auf den Stop-Button klickt
  //       THEN wird cancelStream() aus dem PromptAssistantContext aufgerufen,
  //            der SSE-Stream wird abgebrochen, und der bisherige Text bleibt
  //            als Assistant-Message im Chat-Thread erhalten
  // --------------------------------------------------------------------------
  it("AC-6: should call onStop callback when stop button is clicked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(
      <ChatInput onSend={onSend} isStreaming={true} onStop={onStop} />
    );

    const stopBtn = screen.getByTestId("stop-btn");
    await user.click(stopBtn);

    expect(onStop).toHaveBeenCalledTimes(1);
    // Send should NOT have been called
    expect(onSend).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN der Agent streamt eine Antwort
  //       WHEN der User in die Chat-Input Textarea tippt
  //       THEN bleibt die Textarea aktiv und nimmt Text entgegen -- der User
  //            kann waehrend des Streamings tippen
  // --------------------------------------------------------------------------
  it("AC-7: should keep textarea enabled and editable when isStreaming is true", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(
      <ChatInput onSend={onSend} isStreaming={true} onStop={onStop} />
    );

    const textarea = screen.getByTestId(
      "chat-input-textarea"
    ) as HTMLTextAreaElement;

    // Textarea should NOT be disabled during streaming
    expect(textarea).not.toBeDisabled();
    expect(textarea).toBeEnabled();

    // User can type into the textarea during streaming
    await user.type(textarea, "Next question");
    expect(textarea.value).toBe("Next question");
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN der Agent streamt und der User hat Text in die Textarea eingegeben
  //       WHEN das Streaming endet (text-done oder Stop-Klick)
  //       THEN bleibt der eingegebene Text in der Textarea erhalten und der
  //            Send-Button wird wieder sichtbar (enabled, da Text vorhanden)
  // --------------------------------------------------------------------------
  it("AC-8: should preserve textarea content after streaming ends and show enabled send button", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onStop = vi.fn();

    // Start with streaming = true
    const { rerender } = render(
      <ChatInput onSend={onSend} isStreaming={true} onStop={onStop} />
    );

    const textarea = screen.getByTestId(
      "chat-input-textarea"
    ) as HTMLTextAreaElement;

    // User types during streaming
    await user.type(textarea, "Follow-up question");
    expect(textarea.value).toBe("Follow-up question");

    // Streaming ends -- rerender with isStreaming=false
    rerender(
      <ChatInput onSend={onSend} isStreaming={false} onStop={onStop} />
    );

    // Text should still be preserved in the textarea
    expect(textarea.value).toBe("Follow-up question");

    // Stop button should be gone, send button should appear
    expect(screen.queryByTestId("stop-btn")).not.toBeInTheDocument();
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).toBeVisible();

    // Send button should be enabled because textarea has content
    expect(sendBtn).toBeEnabled();

    // Verify the user can now send the message
    await user.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith("Follow-up question");
  });

  // --------------------------------------------------------------------------
  // AC-4/AC-5 transition: Button switches between stop and send on rerender
  // --------------------------------------------------------------------------
  it("should transition from send button to stop button when streaming starts", () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    // Not streaming initially
    const { rerender } = render(
      <ChatInput onSend={onSend} isStreaming={false} onStop={onStop} />
    );

    expect(screen.getByTestId("send-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("stop-btn")).not.toBeInTheDocument();

    // Streaming starts
    rerender(
      <ChatInput onSend={onSend} isStreaming={true} onStop={onStop} />
    );

    expect(screen.queryByTestId("send-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("stop-btn")).toBeInTheDocument();

    // Streaming ends
    rerender(
      <ChatInput onSend={onSend} isStreaming={false} onStop={onStop} />
    );

    expect(screen.getByTestId("send-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("stop-btn")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-7 negative: disabled prop should still disable textarea
  // --------------------------------------------------------------------------
  it("should disable textarea when disabled prop is true regardless of streaming", () => {
    const onSend = vi.fn();

    render(
      <ChatInput onSend={onSend} isStreaming={false} disabled={true} />
    );

    const textarea = screen.getByTestId("chat-input-textarea");
    expect(textarea).toBeDisabled();
  });
});
