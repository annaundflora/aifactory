// @vitest-environment jsdom
/**
 * Tests for Slice 19: ChatThread - Improve Prompt Chip
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-8: "Verbessere meinen aktuellen Prompt" Chip sendet Workspace-Felder
 *         als Kontext mit der Nachricht
 * - AC-9: Chip funktioniert auch bei leeren Workspace-Feldern
 *
 * Mocking Strategy: mock_external (per slice spec).
 * Tests for getWorkspaceFieldsForChip (pure function) and ChatThread rendering
 * of workspace context in messages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { getWorkspaceFieldsForChip } from "@/lib/assistant/assistant-context";
import { ChatThread } from "../chat-thread";
import type { Message } from "@/lib/assistant/assistant-context";

// jsdom does not implement scrollIntoView -- mock it globally
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// ---------------------------------------------------------------------------
// Tests: getWorkspaceFieldsForChip (unit)
// ---------------------------------------------------------------------------

describe("ChatThread - Improve Prompt Chip", () => {
  // ---------------------------------------------------------------------------
  // AC-8: GIVEN der "Verbessere meinen aktuellen Prompt" Suggestion-Chip auf
  //        dem Startscreen
  //       WHEN der User den Chip klickt und aktuelle Workspace-Felder nicht
  //            leer sind (promptMotiv hat Inhalt)
  //       THEN werden die aktuellen Workspace-Felder als Kontext an den Agent
  //            mitgesendet, damit der Agent den bestehenden Prompt analysieren
  //            und verbessern kann
  // ---------------------------------------------------------------------------
  it("AC-8: should include current workspace fields when improve-prompt chip is clicked with non-empty fields", () => {
    const variationData = {
      promptMotiv: "A cat on a windowsill",
      promptStyle: "watercolor",
      negativePrompt: "blurry",
    };

    const result = getWorkspaceFieldsForChip(variationData);

    // Should return a formatted context string
    expect(result).not.toBeNull();
    expect(result).toContain("[Aktueller Prompt:");
    expect(result).toContain("motiv=A cat on a windowsill");
    expect(result).toContain("style=watercolor");
    expect(result).toContain("negative=blurry");
  });

  it("AC-8: should include only non-empty fields in the context string", () => {
    const variationData = {
      promptMotiv: "A sunset",
      promptStyle: "",
      negativePrompt: "",
    };

    const result = getWorkspaceFieldsForChip(variationData);

    expect(result).not.toBeNull();
    expect(result).toContain("motiv=A sunset");
    // Empty fields should not appear
    expect(result).not.toContain("style=");
    expect(result).not.toContain("negative=");
  });

  it("AC-8: should handle variationData with only style set", () => {
    const variationData = {
      promptMotiv: "",
      promptStyle: "photorealistic",
      negativePrompt: "",
    };

    const result = getWorkspaceFieldsForChip(variationData);

    expect(result).not.toBeNull();
    expect(result).toContain("style=photorealistic");
    expect(result).not.toContain("motiv=");
  });

  // ---------------------------------------------------------------------------
  // AC-9: GIVEN der "Verbessere meinen aktuellen Prompt" Chip wird geklickt
  //       WHEN alle Workspace-Prompt-Felder leer sind (promptMotiv, promptStyle,
  //            negativePrompt alle "")
  //       THEN wird der Chip-Text trotzdem als Nachricht gesendet -- der Agent
  //            erkennt die leeren Felder und leitet in die Verstehen-Phase ueber
  // ---------------------------------------------------------------------------
  it("AC-9: should send chip text without workspace fields when all prompt fields are empty", () => {
    const variationData = {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
    };

    const result = getWorkspaceFieldsForChip(variationData);

    // Should return null -> chip text is sent as-is without context
    expect(result).toBeNull();
  });

  it("AC-9: should return null when variationData is null", () => {
    const result = getWorkspaceFieldsForChip(null);

    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // AC-8: ChatThread renders workspace context in a visually distinct style
  // ---------------------------------------------------------------------------
  it("AC-8: should render workspace context separately when message contains context block", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        content:
          "Verbessere meinen aktuellen Prompt\n\n[Aktueller Prompt: motiv=A cat, style=watercolor]",
      },
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // The workspace context should be rendered in a separate element
    const contextEl = screen.getByTestId("workspace-context");
    expect(contextEl).toBeInTheDocument();
    expect(contextEl).toHaveTextContent("[Aktueller Prompt: motiv=A cat, style=watercolor]");

    // The main message text should not include the context block
    const userMsg = screen.getByTestId("user-message");
    expect(userMsg).toBeInTheDocument();
    // The main content area should show the chip text
    expect(userMsg.textContent).toContain("Verbessere meinen aktuellen Prompt");
  });

  it("AC-9: should not render workspace-context element when message has no context block", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Verbessere meinen aktuellen Prompt",
      },
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // No workspace-context element should be present
    expect(screen.queryByTestId("workspace-context")).not.toBeInTheDocument();

    // The message should be rendered normally
    const userMsg = screen.getByTestId("user-message");
    expect(userMsg).toHaveTextContent("Verbessere meinen aktuellen Prompt");
  });
});
