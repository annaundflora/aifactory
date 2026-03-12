// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { AssistantSheet } from "@/components/assistant/assistant-sheet";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per slice spec)
// Radix Dialog portals into document.body which jsdom supports.
// We provide mock children/slots to test the layout behavior.
// ---------------------------------------------------------------------------

describe("AssistantSheet - Split View", () => {
  /**
   * AC-1: GIVEN der PromptAssistantContext hat draftPrompt als null
   * WHEN das Sheet geoeffnet ist
   * THEN ist das Canvas-Panel nicht sichtbar und das Sheet bleibt bei 480px Breite
   */
  it("AC-1: should render at 480px width when hasCanvas is false", () => {
    render(
      <AssistantSheet open={true} onOpenChange={vi.fn()} hasCanvas={false}>
        <div data-testid="chat-content">Chat Thread</div>
      </AssistantSheet>
    );

    const sheet = screen.getByTestId("assistant-sheet");
    expect(sheet).toBeInTheDocument();
    // Width should be 480px (via inline style)
    expect(sheet.style.width).toBe("480px");
    // Split-view should NOT be present
    expect(screen.queryByTestId("assistant-split-view")).not.toBeInTheDocument();
    // Chat content should be rendered
    expect(screen.getByTestId("chat-content")).toBeInTheDocument();
  });

  /**
   * AC-3: GIVEN hasCanvas wechselt von false auf true
   * WHEN das Sheet das Layout aktualisiert
   * THEN expandiert das Sheet animiert (CSS transition, >= 200ms) von 480px auf 780px
   */
  it("AC-3: should render at 780px width when hasCanvas is true", () => {
    render(
      <AssistantSheet
        open={true}
        onOpenChange={vi.fn()}
        hasCanvas={true}
        canvasSlot={<div data-testid="canvas-slot">Canvas</div>}
      >
        <div data-testid="chat-content">Chat Thread</div>
      </AssistantSheet>
    );

    const sheet = screen.getByTestId("assistant-sheet");
    expect(sheet).toBeInTheDocument();
    // Width should be 780px (via inline style)
    expect(sheet.style.width).toBe("780px");
  });

  /**
   * AC-3: GIVEN hasCanvas is true
   * WHEN the sheet renders
   * THEN it shows a split-view with chat thread left and canvas panel right
   */
  it("AC-3: should render chat thread and canvas panel side by side in split view", () => {
    render(
      <AssistantSheet
        open={true}
        onOpenChange={vi.fn()}
        hasCanvas={true}
        canvasSlot={<div data-testid="canvas-slot">Canvas Panel</div>}
      >
        <div data-testid="chat-content">Chat Thread</div>
      </AssistantSheet>
    );

    // Split-view container should be present
    const splitView = screen.getByTestId("assistant-split-view");
    expect(splitView).toBeInTheDocument();

    // Both chat and canvas should be inside the split view
    expect(screen.getByTestId("chat-content")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-slot")).toBeInTheDocument();

    // The split-view should use flexbox row layout (CSS class flex-row)
    expect(splitView.className).toContain("flex-row");
  });

  /**
   * AC-3: The sheet should have a CSS transition on width property for the animation
   */
  it("AC-3: should have CSS transition on width for smooth animation", () => {
    render(
      <AssistantSheet open={true} onOpenChange={vi.fn()} hasCanvas={false}>
        <div>Chat</div>
      </AssistantSheet>
    );

    const sheet = screen.getByTestId("assistant-sheet");
    // The component uses `transition-[width]` Tailwind class which maps to
    // transition-property: width. Check the class is present.
    expect(sheet.className).toContain("transition-");
    // Duration should be at least 200ms (component uses duration-300)
    expect(sheet.className).toContain("duration-300");
  });

  /**
   * AC-7: GIVEN das Canvas-Panel ist sichtbar
   * WHEN der PromptAssistantContext ein refine_prompt Event empfaengt (canvasHighlight=true)
   * THEN zeigen die Felder einen visuellen Highlight-Effekt
   *
   * This test verifies that the canvasSlot is rendered in the split-view,
   * allowing the PromptCanvas component (rendered as canvasSlot) to show highlights.
   * The actual highlight CSS class is tested in prompt-canvas.test.tsx AC-7.
   */
  it("AC-7: should render canvasSlot in split view so highlight effects are visible", () => {
    const highlightedCanvas = (
      <div data-testid="canvas-with-highlight">
        <textarea
          data-testid="highlighted-field"
          className="animate-canvas-highlight"
        />
      </div>
    );

    render(
      <AssistantSheet
        open={true}
        onOpenChange={vi.fn()}
        hasCanvas={true}
        canvasSlot={highlightedCanvas}
      >
        <div>Chat</div>
      </AssistantSheet>
    );

    // The canvas slot with highlighted fields should be rendered
    expect(screen.getByTestId("canvas-with-highlight")).toBeInTheDocument();
    const field = screen.getByTestId("highlighted-field");
    expect(field.className).toContain("animate-canvas-highlight");
  });

  /**
   * AC-1: When hasCanvas is false, no canvasSlot content should be rendered
   */
  it("AC-1: should not render canvasSlot when hasCanvas is false", () => {
    render(
      <AssistantSheet
        open={true}
        onOpenChange={vi.fn()}
        hasCanvas={false}
        canvasSlot={<div data-testid="canvas-slot">Canvas</div>}
      >
        <div data-testid="chat-content">Chat</div>
      </AssistantSheet>
    );

    // Canvas slot should NOT be rendered when hasCanvas=false
    expect(screen.queryByTestId("canvas-slot")).not.toBeInTheDocument();
    // But chat content should still be there
    expect(screen.getByTestId("chat-content")).toBeInTheDocument();
  });
});
