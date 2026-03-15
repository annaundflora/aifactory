// @vitest-environment jsdom
/**
 * Tests for ChatThread streaming text rendering (Slice 11)
 *
 * Tests AC-1, AC-3, AC-9 from slice-11-streaming-stop spec.
 * Mocking Strategy: mock_external (as defined in slice spec)
 */
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatThread - Streaming Text Rendering", () => {
  // jsdom does not implement scrollIntoView -- mock it globally for all tests
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der Agent streamt text-delta Events
  //       WHEN die Events in der Assistant-Bubble ankommen
  //       THEN wird der Text zeichenweise aufgebaut -- jedes text-delta
  //            erweitert den sichtbaren Text der aktuellen Assistant-Message
  // --------------------------------------------------------------------------
  it("AC-3: should render assistant message text progressively as text-delta events arrive", () => {
    // Simulate initial state: empty assistant message placeholder (streaming started)
    const initialMessages: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("", true, "asst-1"),
    ];

    const { rerender } = render(
      <ChatThread messages={initialMessages} isStreaming={true} />
    );

    // Empty streaming assistant messages are hidden (return null) — the StreamingIndicator handles this state
    expect(screen.queryByTestId("assistant-message")).not.toBeInTheDocument();
    // The streaming indicator should be visible instead
    expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument();

    // Simulate first text-delta: "Hier"
    const afterDelta1: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Hier", true, "asst-1"),
    ];

    rerender(<ChatThread messages={afterDelta1} isStreaming={true} />);
    expect(screen.getByTestId("assistant-message")).toHaveTextContent("Hier");

    // Simulate second text-delta: "Hier ist dein"
    const afterDelta2: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Hier ist dein", true, "asst-1"),
    ];

    rerender(<ChatThread messages={afterDelta2} isStreaming={true} />);
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Hier ist dein"
    );

    // Simulate third text-delta: "Hier ist dein kreativer Prompt:"
    const afterDelta3: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Hier ist dein kreativer Prompt:", true, "asst-1"),
    ];

    rerender(<ChatThread messages={afterDelta3} isStreaming={true} />);
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Hier ist dein kreativer Prompt:"
    );
  });

  // --------------------------------------------------------------------------
  // AC-1: GIVEN der Agent streamt eine Antwort (isStreaming === true)
  //       WHEN die Chat-Thread Komponente gerendert wird
  //       THEN wird unterhalb der letzten Assistant-Message ein
  //            Streaming-Indicator mit 3 animierten Punkten angezeigt
  // --------------------------------------------------------------------------
  it("AC-1: should show streaming indicator below last assistant message when isStreaming is true", () => {
    const messages: Message[] = [
      createUserMessage("Help me", "user-1"),
      createAssistantMessage("Working on it", true, "asst-1"),
    ];

    render(<ChatThread messages={messages} isStreaming={true} />);

    // Streaming indicator should be visible
    const indicator = screen.getByTestId("streaming-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toBeVisible();

    // It should have 3 animated dots
    const dots = indicator.querySelectorAll('span[aria-hidden="true"]');
    expect(dots).toHaveLength(3);

    // It should be below the assistant message in the thread
    const thread = screen.getByTestId("chat-thread");
    const assistantBubble = screen.getByTestId("assistant-message");

    // Verify ordering: assistant message appears before indicator in the DOM
    const threadChildren = Array.from(thread.children);
    const assistantIndex = threadChildren.indexOf(assistantBubble);
    const indicatorIndex = threadChildren.indexOf(indicator);
    expect(indicatorIndex).toBeGreaterThan(assistantIndex);
  });

  // --------------------------------------------------------------------------
  // AC-2 (in ChatThread context): Streaming indicator hidden when not streaming
  // --------------------------------------------------------------------------
  it("AC-2: should hide streaming indicator when isStreaming is false", () => {
    const messages: Message[] = [
      createUserMessage("Help me", "user-1"),
      createAssistantMessage("Here is the answer.", false, "asst-1"),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // Streaming indicator should NOT be in the DOM
    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN der Stop-Button wird angeklickt und der Stream wird abgebrochen
  //       WHEN der Chat-Thread den Zustand aktualisiert
  //       THEN wird die abgebrochene Assistant-Message im Chat-Thread als
  //            regulaere (nicht-streamende) Message dargestellt, ohne
  //            Streaming-Indicator
  // --------------------------------------------------------------------------
  it("AC-9: should display cancelled message as regular completed message without streaming indicator", () => {
    // Simulate streaming state: assistant message with partial content, isStreaming=true
    const streamingMessages: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Hier ist der Anfang eines", true, "asst-1"),
    ];

    const { rerender } = render(
      <ChatThread messages={streamingMessages} isStreaming={true} />
    );

    // During streaming: indicator should be visible
    expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument();

    // After stop: message isStreaming set to false, top-level isStreaming=false
    // The partial text should be preserved as a regular message
    const cancelledMessages: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Hier ist der Anfang eines", false, "asst-1"),
    ];

    rerender(
      <ChatThread messages={cancelledMessages} isStreaming={false} />
    );

    // Streaming indicator should be gone
    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();

    // The cancelled message should still be visible with its partial content
    const assistantBubble = screen.getByTestId("assistant-message");
    expect(assistantBubble).toBeInTheDocument();
    expect(assistantBubble).toBeVisible();
    expect(assistantBubble).toHaveTextContent("Hier ist der Anfang eines");

    // It should be rendered as a regular message (left-aligned, assistant styling)
    expect(assistantBubble.className).toMatch(/justify-start/);
  });

  // --------------------------------------------------------------------------
  // AC-9 (extended): Multiple messages -- only the last is cancelled
  // --------------------------------------------------------------------------
  it("AC-9: should preserve all previous messages when a streaming message is cancelled", () => {
    // Full conversation with streaming assistant message at the end
    const streamingMessages: Message[] = [
      createUserMessage("Erste Frage", "user-1"),
      createAssistantMessage("Erste Antwort", false, "asst-1"),
      createUserMessage("Zweite Frage", "user-2"),
      createAssistantMessage("Partielle Antw", true, "asst-2"),
    ];

    const { rerender } = render(
      <ChatThread messages={streamingMessages} isStreaming={true} />
    );

    // All messages should be visible
    expect(screen.getAllByTestId("user-message")).toHaveLength(2);
    expect(screen.getAllByTestId("assistant-message")).toHaveLength(2);
    expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument();

    // Cancel: mark last message as done
    const cancelledMessages: Message[] = [
      createUserMessage("Erste Frage", "user-1"),
      createAssistantMessage("Erste Antwort", false, "asst-1"),
      createUserMessage("Zweite Frage", "user-2"),
      createAssistantMessage("Partielle Antw", false, "asst-2"),
    ];

    rerender(
      <ChatThread messages={cancelledMessages} isStreaming={false} />
    );

    // All messages still visible, no indicator
    expect(screen.getAllByTestId("user-message")).toHaveLength(2);
    expect(screen.getAllByTestId("assistant-message")).toHaveLength(2);
    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();

    // Last assistant message shows partial text
    const assistantBubbles = screen.getAllByTestId("assistant-message");
    expect(assistantBubbles[1]).toHaveTextContent("Partielle Antw");
  });
});
