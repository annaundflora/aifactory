// @vitest-environment jsdom
/**
 * Acceptance Tests for slice-11-streaming-stop
 *
 * These tests verify all 9 Acceptance Criteria from the slice spec.
 * Each test maps 1:1 to a GIVEN/WHEN/THEN from the spec.
 *
 * Components tested: StreamingIndicator, ChatInput, ChatThread
 * Mocking Strategy: mock_external (PromptAssistantContext props are passed directly)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { StreamingIndicator } from "@/components/assistant/streaming-indicator";
import { ChatInput } from "@/components/assistant/chat-input";
import { ChatThread } from "@/components/assistant/chat-thread";
import type { Message } from "@/lib/assistant/assistant-context";

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
// Acceptance Tests
// ---------------------------------------------------------------------------

describe("Slice 11: Streaming-Anzeige + Stop-Button Acceptance", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  // --------------------------------------------------------------------------
  // AC-1: GIVEN der Agent streamt eine Antwort (isStreaming === true)
  //       WHEN die Chat-Thread Komponente gerendert wird
  //       THEN wird unterhalb der letzten Assistant-Message ein
  //            Streaming-Indicator mit 3 animierten Punkten angezeigt
  // --------------------------------------------------------------------------
  it("AC-1: GIVEN agent is streaming WHEN ChatThread renders THEN streaming indicator with 3 animated dots is shown below last assistant message", () => {
    const messages: Message[] = [
      createUserMessage("Hilf mir einen Prompt zu schreiben", "user-1"),
      createAssistantMessage("Gerne! Ich", true, "asst-1"),
    ];

    render(<ChatThread messages={messages} isStreaming={true} />);

    // Streaming indicator should be visible
    const indicator = screen.getByTestId("streaming-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toBeVisible();
    expect(indicator).toHaveAttribute("role", "status");

    // 3 animated dots
    const dots = indicator.querySelectorAll('span[aria-hidden="true"]');
    expect(dots).toHaveLength(3);
    dots.forEach((dot) => {
      expect(dot.className).toMatch(/animate-pulse/);
    });

    // Indicator is below the assistant message in DOM order
    const thread = screen.getByTestId("chat-thread");
    const children = Array.from(thread.children);
    const assistantIdx = children.indexOf(screen.getByTestId("assistant-message"));
    const indicatorIdx = children.indexOf(indicator);
    expect(indicatorIdx).toBeGreaterThan(assistantIdx);
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN der Agent hat das Streaming beendet (isStreaming === false)
  //       WHEN die Chat-Thread Komponente gerendert wird
  //       THEN ist der Streaming-Indicator nicht sichtbar (nicht im DOM oder hidden)
  // --------------------------------------------------------------------------
  it("AC-2: GIVEN agent finished streaming WHEN ChatThread renders THEN streaming indicator is not visible", () => {
    const messages: Message[] = [
      createUserMessage("Frage", "user-1"),
      createAssistantMessage("Fertige Antwort.", false, "asst-1"),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN der Agent streamt text-delta Events
  //       WHEN die Events in der Assistant-Bubble ankommen
  //       THEN wird der Text zeichenweise aufgebaut -- jedes text-delta
  //            erweitert den sichtbaren Text der aktuellen Assistant-Message
  // --------------------------------------------------------------------------
  it("AC-3: GIVEN agent streams text-delta events WHEN events arrive THEN text builds up progressively in assistant bubble", () => {
    // Empty assistant message (stream just started)
    const step0: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("", true, "asst-1"),
    ];

    const { rerender } = render(
      <ChatThread messages={step0} isStreaming={true} />
    );

    // Placeholder "..." shown for empty streaming message
    expect(screen.getByTestId("assistant-message")).toHaveTextContent("...");

    // First delta arrives: "Ein"
    const step1: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Ein", true, "asst-1"),
    ];
    rerender(<ChatThread messages={step1} isStreaming={true} />);
    expect(screen.getByTestId("assistant-message")).toHaveTextContent("Ein");

    // Second delta: "Ein fantasy-Landschaft"
    const step2: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage("Ein fantasy-Landschaft", true, "asst-1"),
    ];
    rerender(<ChatThread messages={step2} isStreaming={true} />);
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Ein fantasy-Landschaft"
    );

    // Third delta: "Ein fantasy-Landschaft mit dramatischem Licht"
    const step3: Message[] = [
      createUserMessage("Schreibe einen Prompt", "user-1"),
      createAssistantMessage(
        "Ein fantasy-Landschaft mit dramatischem Licht",
        true,
        "asst-1"
      ),
    ];
    rerender(<ChatThread messages={step3} isStreaming={true} />);
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Ein fantasy-Landschaft mit dramatischem Licht"
    );
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN isStreaming === true
  //       WHEN der Chat-Input-Footer gerendert wird
  //       THEN ist der Send-Button (ArrowUp Icon) durch einen Stop-Button
  //            (Square Icon) ersetzt
  // --------------------------------------------------------------------------
  it("AC-4: GIVEN isStreaming is true WHEN ChatInput renders THEN stop button replaces send button", () => {
    render(
      <ChatInput onSend={vi.fn()} isStreaming={true} onStop={vi.fn()} />
    );

    // Stop button visible
    const stopBtn = screen.getByTestId("stop-btn");
    expect(stopBtn).toBeVisible();
    expect(stopBtn).toHaveAttribute("aria-label", "Stop response");
    expect(stopBtn.querySelector("svg")).toBeInTheDocument();

    // Send button NOT in DOM
    expect(screen.queryByTestId("send-btn")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN isStreaming === false
  //       WHEN der Chat-Input-Footer gerendert wird
  //       THEN wird der Send-Button (ArrowUp Icon) angezeigt (kein Stop-Button)
  // --------------------------------------------------------------------------
  it("AC-5: GIVEN isStreaming is false WHEN ChatInput renders THEN send button is shown (no stop button)", () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} />);

    // Send button visible
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeVisible();
    expect(sendBtn).toHaveAttribute("aria-label", "Send message");
    expect(sendBtn.querySelector("svg")).toBeInTheDocument();

    // Stop button NOT in DOM
    expect(screen.queryByTestId("stop-btn")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN der Agent streamt eine Antwort
  //       WHEN der User auf den Stop-Button klickt
  //       THEN wird cancelStream() aus dem PromptAssistantContext aufgerufen,
  //            der SSE-Stream wird abgebrochen, und der bisherige Text bleibt
  //            als Assistant-Message im Chat-Thread erhalten
  // --------------------------------------------------------------------------
  it("AC-6: GIVEN agent is streaming WHEN user clicks stop button THEN cancelStream is called and partial text is preserved", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const onSend = vi.fn();

    // Render ChatInput in streaming mode
    render(
      <ChatInput onSend={onSend} isStreaming={true} onStop={onStop} />
    );

    // Click stop button
    const stopBtn = screen.getByTestId("stop-btn");
    await user.click(stopBtn);

    // onStop (cancelStream) should have been called
    expect(onStop).toHaveBeenCalledTimes(1);

    // Verify partial text is preserved in ChatThread after cancel
    const cancelledMessages: Message[] = [
      createUserMessage("Frage", "user-1"),
      createAssistantMessage("Partieller Text nach Abbruch", false, "asst-1"),
    ];

    render(<ChatThread messages={cancelledMessages} isStreaming={false} />);

    const assistantBubble = screen.getByTestId("assistant-message");
    expect(assistantBubble).toHaveTextContent("Partieller Text nach Abbruch");
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN der Agent streamt eine Antwort
  //       WHEN der User in die Chat-Input Textarea tippt
  //       THEN bleibt die Textarea aktiv und nimmt Text entgegen -- der User
  //            kann waehrend des Streamings tippen
  // --------------------------------------------------------------------------
  it("AC-7: GIVEN agent is streaming WHEN user types in textarea THEN textarea is active and accepts input", async () => {
    const user = userEvent.setup();

    render(
      <ChatInput onSend={vi.fn()} isStreaming={true} onStop={vi.fn()} />
    );

    const textarea = screen.getByTestId(
      "chat-input-textarea"
    ) as HTMLTextAreaElement;

    // Textarea should NOT be disabled
    expect(textarea).not.toBeDisabled();

    // Type into textarea during streaming
    await user.type(textarea, "Meine naechste Frage");
    expect(textarea.value).toBe("Meine naechste Frage");
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN der Agent streamt und der User hat Text in die Textarea eingegeben
  //       WHEN das Streaming endet (text-done oder Stop-Klick)
  //       THEN bleibt der eingegebene Text in der Textarea erhalten und der
  //            Send-Button wird wieder sichtbar (enabled, da Text vorhanden)
  // --------------------------------------------------------------------------
  it("AC-8: GIVEN user typed during streaming WHEN streaming ends THEN text preserved and send button enabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    // Start streaming
    const { rerender } = render(
      <ChatInput onSend={onSend} isStreaming={true} onStop={vi.fn()} />
    );

    const textarea = screen.getByTestId(
      "chat-input-textarea"
    ) as HTMLTextAreaElement;

    // Type during streaming
    await user.type(textarea, "Vorbereiteter Text");
    expect(textarea.value).toBe("Vorbereiteter Text");

    // Streaming ends
    rerender(
      <ChatInput onSend={onSend} isStreaming={false} onStop={vi.fn()} />
    );

    // Text still preserved
    expect(textarea.value).toBe("Vorbereiteter Text");

    // Send button visible and enabled
    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeVisible();
    expect(sendBtn).toBeEnabled();

    // User can now send
    await user.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith("Vorbereiteter Text");
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN der Stop-Button wird angeklickt und der Stream wird abgebrochen
  //       WHEN der Chat-Thread den Zustand aktualisiert
  //       THEN wird die abgebrochene Assistant-Message im Chat-Thread als
  //            regulaere (nicht-streamende) Message dargestellt, ohne
  //            Streaming-Indicator
  // --------------------------------------------------------------------------
  it("AC-9: GIVEN stream was cancelled WHEN ChatThread updates THEN cancelled message shown as regular message without indicator", () => {
    // During streaming
    const streamingMessages: Message[] = [
      createUserMessage("Analysiere mein Bild", "user-1"),
      createAssistantMessage("Das Bild zeigt", true, "asst-1"),
    ];

    const { rerender } = render(
      <ChatThread messages={streamingMessages} isStreaming={true} />
    );

    // Indicator visible during streaming
    expect(screen.getByTestId("streaming-indicator")).toBeVisible();
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Das Bild zeigt"
    );

    // After cancel: isStreaming=false on both message and top-level
    const cancelledMessages: Message[] = [
      createUserMessage("Analysiere mein Bild", "user-1"),
      createAssistantMessage("Das Bild zeigt", false, "asst-1"),
    ];

    rerender(
      <ChatThread messages={cancelledMessages} isStreaming={false} />
    );

    // Indicator gone
    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();

    // Message still displayed as regular message
    const assistantBubble = screen.getByTestId("assistant-message");
    expect(assistantBubble).toBeVisible();
    expect(assistantBubble).toHaveTextContent("Das Bild zeigt");
    expect(assistantBubble.className).toMatch(/justify-start/);
  });
});
