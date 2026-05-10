// @vitest-environment jsdom
/**
 * Tests for Slice 18: ``chat-thread.tsx`` -- ``result_message`` render
 * variant + click-to-open-detail-view interaction.
 *
 * Tests derived 1:1 from GIVEN/WHEN/THEN Acceptance Criteria:
 *   AC-5: When an assistant message has a ``resultImageUrl`` marker, the
 *         ``result_message`` variant renders with a thumbnail (left,
 *         ~120px square, rounded) + assistant text (right). The
 *         thumbnail carries ``data-testid="result_message.thumbnail"`` +
 *         ``role="button"`` and supports keyboard activation via
 *         Enter AND Space.
 *   AC-6: Click on the thumbnail (or Enter/Space) triggers the existing
 *         detail-view opener (``DetailViewOpenerProvider`` → registered
 *         ``handleSelectGeneration`` in ``WorkspaceContent``). The opener
 *         is invoked with the matching ``resultGenerationId`` (Reuse-
 *         Pflicht — no new modal).
 *   AC-7: When an assistant message has NO ``resultImageUrl`` marker, the
 *         existing default-bubble rendering from Slice 16/17 is
 *         preserved verbatim (no layout shift, no empty thumbnail slot).
 *
 * Mocking Strategy: ``mock_external`` (per slice spec). The
 * ``DetailViewOpener`` is registered via the real provider (no mock) so
 * we test the actual context wiring, not a stub. ``scrollIntoView`` is
 * stubbed at the prototype level because jsdom doesn't implement it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ChatThread } from "../chat-thread";
import {
  DetailViewOpenerProvider,
  useDetailViewOpener,
} from "@/lib/workspace/detail-view-opener-context";
import type { ChatMessage as Message } from "@/lib/types/chat-message";
import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userMessage(content: string, id?: string): Message {
  return {
    id: id ?? `user-${Math.random()}`,
    role: "user",
    content,
  };
}

function assistantMessage(
  content: string,
  extras: Partial<Message> = {},
  id?: string
): Message {
  return {
    id: id ?? `assistant-${Math.random()}`,
    role: "assistant",
    content,
    ...extras,
  };
}

/**
 * Helper component: registers a click-spy as the detail-view opener for
 * the duration of the test. Mounted as a child of
 * ``DetailViewOpenerProvider``. The spy is exposed via a ref-handle so the
 * test can assert call args without a forwardRef dance.
 */
function OpenerRegister({
  spy,
}: {
  spy: (generationId: string) => void;
}) {
  const opener = useDetailViewOpener();
  useEffect(() => {
    if (!opener) return;
    opener.registerOpener(spy);
    return () => {
      opener.registerOpener(null);
    };
  }, [opener, spy]);
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Slice 18: ChatThread -- result_message render variant", () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView -- stub at prototype level
    Element.prototype.scrollIntoView = vi.fn();
  });

  // -------------------------------------------------------------------------
  // AC-5
  // -------------------------------------------------------------------------

  it("AC-5: renders result_message variant with thumbnail + text when message has resultImageUrl", () => {
    /**
     * AC-5: GIVEN an assistant message with
     *             { resultImageUrl: "https://...", resultGenerationId: "g1",
     *               content: "<comment>" }
     *       WHEN  ChatThread iterates the messages
     *       THEN  the result_message variant renders:
     *               - thumbnail (left) with the URL as <img src>
     *               - assistant text (right) with the comment
     */
    const messages: Message[] = [
      userMessage("Make me a sunset", "u1"),
      assistantMessage(
        "Hier dein Ergebnis — was hältst du davon?",
        {
          resultImageUrl: "https://example.com/result.png",
          resultGenerationId: "gen-result-1",
        },
        "a1"
      ),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // The result_message variant container must be rendered.
    const resultBubble = screen.getByTestId("result-message");
    expect(resultBubble).toBeInTheDocument();

    // The thumbnail must carry the spec-mandated data-testid.
    const thumb = screen.getByTestId("result_message.thumbnail");
    expect(thumb).toBeInTheDocument();
    expect(thumb).toBeVisible();

    // The thumbnail wraps an <img> with the resultImageUrl as src.
    const img = thumb.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/result.png");

    // The assistant text appears alongside the thumbnail.
    expect(resultBubble).toHaveTextContent(
      "Hier dein Ergebnis — was hältst du davon?"
    );

    // The default ``assistant-message`` bubble for THIS message must NOT
    // also render — variants are mutually exclusive.
    const defaultBubbles = screen.queryAllByTestId("assistant-message");
    expect(defaultBubbles).toHaveLength(0);
  });

  it("AC-5: result_message thumbnail has role=button + tabIndex + keyboard activation (Enter and Space)", () => {
    /**
     * AC-5: the thumbnail must be reachable by keyboard (role=button,
     * tabIndex=0) and Enter AND Space must trigger the same handler as
     * a click. We register a spy as the detail-view opener and fire all
     * three interactions.
     */
    const openSpy = vi.fn<(generationId: string) => void>();

    const messages: Message[] = [
      assistantMessage(
        "Klick zum Vergrößern",
        {
          resultImageUrl: "https://example.com/click-me.png",
          resultGenerationId: "gen-clickable",
        },
        "a1"
      ),
    ];

    render(
      <DetailViewOpenerProvider>
        <OpenerRegister spy={openSpy} />
        <ChatThread messages={messages} isStreaming={false} />
      </DetailViewOpenerProvider>
    );

    const thumb = screen.getByTestId("result_message.thumbnail");

    // role=button (a11y).
    expect(thumb).toHaveAttribute("role", "button");
    // tabIndex 0 — reachable via keyboard.
    expect(thumb).toHaveAttribute("tabindex", "0");

    // Click activation.
    act(() => {
      fireEvent.click(thumb);
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("gen-clickable");

    // Enter activation.
    act(() => {
      fireEvent.keyDown(thumb, { key: "Enter" });
    });
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenLastCalledWith("gen-clickable");

    // Space activation.
    act(() => {
      fireEvent.keyDown(thumb, { key: " " });
    });
    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(openSpy).toHaveBeenLastCalledWith("gen-clickable");

    // Other keys do NOT trigger the opener (defensive — only Enter+Space
    // map to activation per AC-5).
    act(() => {
      fireEvent.keyDown(thumb, { key: "Escape" });
    });
    expect(openSpy).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // AC-6
  // -------------------------------------------------------------------------

  it("AC-6: clicking result_message thumbnail invokes existing detail-view opener with correct generationId", () => {
    /**
     * AC-6: GIVEN AC-5 holds AND the user clicks the thumbnail
     *       WHEN  the click handler runs
     *       THEN  the existing detail-view opener (registered by
     *             ``WorkspaceContent``) is invoked exactly once with the
     *             ``resultGenerationId`` of the matching message.
     *             KEIN neues Modal — the opener delegates to the
     *             pre-existing ``handleSelectGeneration`` path.
     */
    const openSpy = vi.fn<(generationId: string) => void>();

    const messages: Message[] = [
      assistantMessage(
        "Hier ist das Bild.",
        {
          resultImageUrl: "https://example.com/img-final.png",
          resultGenerationId: "gen-final-42",
        },
        "a-final"
      ),
    ];

    render(
      <DetailViewOpenerProvider>
        <OpenerRegister spy={openSpy} />
        <ChatThread messages={messages} isStreaming={false} />
      </DetailViewOpenerProvider>
    );

    const thumb = screen.getByTestId("result_message.thumbnail");
    act(() => {
      fireEvent.click(thumb);
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("gen-final-42");
  });

  it("AC-6: click is a no-op when no DetailViewOpenerProvider is mounted (graceful degradation)", () => {
    /**
     * The chat-thread is also rendered in presentational tests / sheet
     * mounts that live outside the workspace tree. In that case the
     * opener context returns ``null`` and the click handler must NOT
     * throw — it silently no-ops.
     */
    const messages: Message[] = [
      assistantMessage(
        "Standalone presentational",
        {
          resultImageUrl: "https://example.com/x.png",
          resultGenerationId: "gen-x",
        },
        "a-x"
      ),
    ];

    // No DetailViewOpenerProvider — render the thread directly.
    render(<ChatThread messages={messages} isStreaming={false} />);

    const thumb = screen.getByTestId("result_message.thumbnail");
    expect(() => {
      act(() => {
        fireEvent.click(thumb);
      });
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // AC-7
  // -------------------------------------------------------------------------

  it("AC-7: assistant message WITHOUT resultImageUrl renders the default bubble (Slice 16/17 unchanged)", () => {
    /**
     * AC-7: GIVEN an assistant message WITHOUT a ``resultImageUrl`` marker
     *       WHEN  ChatThread iterates the messages
     *       THEN  the default ``assistant-message`` bubble renders;
     *             NO ``result-message`` container is mounted;
     *             NO empty thumbnail slot appears.
     */
    const messages: Message[] = [
      userMessage("hi", "u1"),
      assistantMessage("Wie kann ich helfen?", {}, "a1"),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // Default bubble renders.
    expect(screen.getByTestId("assistant-message")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Wie kann ich helfen?"
    );

    // result-message variant must NOT be mounted.
    expect(screen.queryByTestId("result-message")).toBeNull();
    // Thumbnail must NOT be mounted (no empty slot).
    expect(screen.queryByTestId("result_message.thumbnail")).toBeNull();
  });

  it("AC-7: a thread mixing one result_message and one default assistant message renders both variants correctly", () => {
    /**
     * Mixed-mode regression: when the thread contains a default assistant
     * bubble AND a result_message bubble, BOTH render correctly and side
     * by side — the marker is per-message, not global.
     */
    const messages: Message[] = [
      userMessage("Make a cat", "u1"),
      // Default bubble (no marker).
      assistantMessage("Welche Stilrichtung?", {}, "a-default"),
      userMessage("Cyberpunk", "u2"),
      // Result-message bubble (with marker).
      assistantMessage(
        "Hier ist es!",
        {
          resultImageUrl: "https://example.com/cat.png",
          resultGenerationId: "gen-cat",
        },
        "a-result"
      ),
    ];

    render(<ChatThread messages={messages} isStreaming={false} />);

    // Default assistant bubble (the first reply) is present.
    const defaultBubbles = screen.getAllByTestId("assistant-message");
    expect(defaultBubbles).toHaveLength(1);
    expect(defaultBubbles[0]).toHaveTextContent("Welche Stilrichtung?");

    // Result-message bubble is present alongside it.
    const resultBubbles = screen.getAllByTestId("result-message");
    expect(resultBubbles).toHaveLength(1);
    expect(resultBubbles[0]).toHaveTextContent("Hier ist es!");

    // Exactly one thumbnail.
    const thumbs = screen.getAllByTestId("result_message.thumbnail");
    expect(thumbs).toHaveLength(1);
  });

  it("AC-5/AC-6: streaming placeholder for result_message variant renders thumbnail before content arrives", () => {
    /**
     * Implementation detail captured by the spec: the thumbnail mounts
     * at placeholder creation time (pendingResultAttachmentRef). This
     * guards against the empty-streaming-bubble suppression hiding the
     * thumbnail until the proactive comment text streams in. We render
     * a streaming-empty assistant message WITH the marker and assert
     * the thumbnail appears.
     */
    const messages: Message[] = [
      userMessage("ok", "u1"),
      assistantMessage(
        "", // empty content (still streaming)
        {
          isStreaming: true,
          resultImageUrl: "https://example.com/early.png",
          resultGenerationId: "gen-early",
        },
        "a-early"
      ),
    ];

    render(<ChatThread messages={messages} isStreaming={true} />);

    const thumb = screen.getByTestId("result_message.thumbnail");
    expect(thumb).toBeInTheDocument();
    expect(thumb.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/early.png"
    );
  });
});
