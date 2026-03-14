// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ChatThread } from "../chat-thread";
import type { ChatMessage as Message } from "@/lib/types/chat-message";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createUserMessage(content: string, id?: string): Message {
  return {
    id: id ?? `user-${Date.now()}-${Math.random()}`,
    role: "user",
    content,
  };
}

function createAssistantMessage(
  content: string,
  isStreaming = false,
  id?: string
): Message {
  return {
    id: id ?? `assistant-${Date.now()}-${Math.random()}`,
    role: "assistant",
    content,
    isStreaming,
  };
}

function createErrorMessage(content: string, id?: string): Message {
  return {
    id: id ?? `error-${Date.now()}-${Math.random()}`,
    role: "assistant",
    content,
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatThread", () => {
  // jsdom does not implement scrollIntoView -- mock it globally for all tests
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN der User hat eine Nachricht gesendet
  //       WHEN die Nachricht abgeschickt wurde
  //       THEN erscheint sofort eine User-Message-Bubble (rechts-ausgerichtet)
  //            im Chat-Thread mit dem eingegebenen Text
  // --------------------------------------------------------------------------
  it("AC-2: should render user messages right-aligned with user styling", () => {
    const messages: Message[] = [
      createUserMessage("Help me write a prompt"),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    const userBubble = screen.getByTestId("user-message");
    expect(userBubble).toBeInTheDocument();
    expect(userBubble).toBeVisible();
    expect(userBubble).toHaveTextContent("Help me write a prompt");

    // Verify right-alignment via justify-end class
    expect(userBubble.className).toMatch(/justify-end/);
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der SSE-Stream liefert text-delta Events
  //       WHEN die Events eintreffen
  //       THEN erscheint eine Assistant-Message-Bubble (links-ausgerichtet)
  //            im Chat-Thread, deren Text sich mit jedem text-delta Event erweitert
  // --------------------------------------------------------------------------
  it("AC-3: should render assistant messages left-aligned with assistant styling", () => {
    const messages: Message[] = [
      createAssistantMessage("Here is your suggestion:", false),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    const assistantBubble = screen.getByTestId("assistant-message");
    expect(assistantBubble).toBeInTheDocument();
    expect(assistantBubble).toBeVisible();
    expect(assistantBubble).toHaveTextContent("Here is your suggestion:");

    // Verify left-alignment via justify-start class
    expect(assistantBubble.className).toMatch(/justify-start/);
  });

  it("AC-3: should render progressively extended assistant message text (simulating text-delta accumulation)", () => {
    // First render: partial text (during streaming)
    const partialMessages: Message[] = [
      createUserMessage("Write a prompt"),
      createAssistantMessage("Here is", true, "asst-1"),
    ];

    const { rerender } = render(
      <ChatThread messages={partialMessages} isStreaming={true} />
    );

    const assistantBubble = screen.getByTestId("assistant-message");
    expect(assistantBubble).toHaveTextContent("Here is");

    // Second render: more text accumulated from text-delta events
    const extendedMessages: Message[] = [
      createUserMessage("Write a prompt"),
      createAssistantMessage("Here is your creative prompt", true, "asst-1"),
    ];

    rerender(
      <ChatThread messages={extendedMessages} isStreaming={true} />
    );

    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Here is your creative prompt"
    );
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN der SSE-Stream liefert ein error Event
  //       WHEN das Event eintrifft
  //       THEN wird die Fehlermeldung als Fehler-Nachricht im Chat angezeigt
  // --------------------------------------------------------------------------
  it("AC-6: should render error messages with error styling", () => {
    const messages: Message[] = [
      createUserMessage("Hello"),
      createErrorMessage("Rate limit exceeded"),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    const errorBubble = screen.getByTestId("error-message");
    expect(errorBubble).toBeInTheDocument();
    expect(errorBubble).toBeVisible();
    expect(errorBubble).toHaveTextContent("Rate limit exceeded");

    // Error messages should be left-aligned (not user)
    expect(errorBubble.className).toMatch(/justify-start/);
  });

  // --------------------------------------------------------------------------
  // AC-10: GIVEN der Chat-Thread enthaelt mehrere Messages
  //        WHEN eine neue Assistant-Message eingeht
  //        THEN scrollt der Chat-Thread automatisch nach unten zur neuesten Message
  // --------------------------------------------------------------------------
  it("AC-10: should scroll to bottom when new message is added", () => {
    // Mock scrollIntoView since jsdom does not implement it
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const initialMessages: Message[] = [
      createUserMessage("Message 1", "msg-1"),
      createAssistantMessage("Reply 1", false, "reply-1"),
      createUserMessage("Message 2", "msg-2"),
      createAssistantMessage("Reply 2", false, "reply-2"),
    ];

    const { rerender } = render(
      <ChatThread messages={initialMessages} isStreaming={false} />
    );

    // scrollIntoView should have been called on initial render
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Reset to track new calls
    scrollIntoViewMock.mockClear();

    // Add a new message (simulating incoming assistant message)
    const updatedMessages: Message[] = [
      ...initialMessages,
      createAssistantMessage("Reply 3 - newest", false, "reply-3"),
    ];

    rerender(
      <ChatThread messages={updatedMessages} isStreaming={false} />
    );

    // scrollIntoView should be called again with the new messages
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN der User klickt auf einen Suggestion-Chip auf dem Startscreen
  //       WHEN der Chip-Text als erste Nachricht gesendet wird
  //       THEN wird der Chip-Text als User-Message verarbeitet
  //            (identisches Verhalten wie manuelles Tippen)
  // --------------------------------------------------------------------------
  it("AC-7: should display chip text as user message when triggered via onChipClick", () => {
    // Simulate the state after a chip click has been processed:
    // The chip text becomes a user message in the messages array
    const chipText = "Hilf mir einen Prompt zu schreiben";
    const messages: Message[] = [createUserMessage(chipText)];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // The chip text should appear as a regular user message bubble
    const userBubble = screen.getByTestId("user-message");
    expect(userBubble).toBeInTheDocument();
    expect(userBubble).toHaveTextContent(chipText);

    // It should be right-aligned just like any manually typed message
    expect(userBubble.className).toMatch(/justify-end/);
  });

  // --------------------------------------------------------------------------
  // Empty state: No messages = no rendering
  // --------------------------------------------------------------------------
  it("should return null when messages array is empty", () => {
    const { container } = render(
      <ChatThread messages={[]} isStreaming={false} />
    );

    expect(screen.queryByTestId("chat-thread")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });

  // --------------------------------------------------------------------------
  // Mixed messages: User + Assistant ordering
  // --------------------------------------------------------------------------
  it("should render user and assistant messages in correct order", () => {
    const messages: Message[] = [
      createUserMessage("Question 1", "q1"),
      createAssistantMessage("Answer 1", false, "a1"),
      createUserMessage("Question 2", "q2"),
      createAssistantMessage("Answer 2", false, "a2"),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    const userBubbles = screen.getAllByTestId("user-message");
    const assistantBubbles = screen.getAllByTestId("assistant-message");

    expect(userBubbles).toHaveLength(2);
    expect(assistantBubbles).toHaveLength(2);

    expect(userBubbles[0]).toHaveTextContent("Question 1");
    expect(assistantBubbles[0]).toHaveTextContent("Answer 1");
    expect(userBubbles[1]).toHaveTextContent("Question 2");
    expect(assistantBubbles[1]).toHaveTextContent("Answer 2");
  });

  // --------------------------------------------------------------------------
  // Streaming placeholder: Empty content with isStreaming shows "..."
  // --------------------------------------------------------------------------
  it("should show streaming placeholder when assistant message is streaming with empty content", () => {
    const messages: Message[] = [
      createUserMessage("Hello"),
      createAssistantMessage("", true, "streaming-asst"),
    ];

    render(<ChatThread messages={messages} isStreaming={true} />);

    const assistantBubble = screen.getByTestId("assistant-message");
    expect(assistantBubble).toHaveTextContent("...");
  });
});
