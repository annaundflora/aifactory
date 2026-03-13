// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

// Mock lucide-react icons used by CanvasHeader (ArrowLeft, Undo2, Redo2)
vi.mock("lucide-react", () => ({
  ArrowLeft: (props: Record<string, unknown>) => (
    <span data-testid="arrow-left-icon" {...props} />
  ),
  Undo2: (props: Record<string, unknown>) => (
    <span data-testid="undo2-icon" {...props} />
  ),
  Redo2: (props: Record<string, unknown>) => (
    <span data-testid="redo2-icon" {...props} />
  ),
}));

// Import AFTER mocks
import { CanvasHeader } from "@/components/canvas/canvas-header";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasHeader", () => {
  let mockOnBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnBack = vi.fn();
  });

  /**
   * AC-3: GIVEN die CanvasDetailView ist sichtbar
   *       WHEN der Header geprueft wird
   *       THEN enthaelt er einen Back-Button (links), einen leeren Model-Selector-Slot (mitte)
   *            und leere Undo/Redo-Slots (rechts)
   */
  it("AC-3: should render back button, model selector slot, and undo/redo slots", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-test">
        <CanvasHeader onBack={mockOnBack} />
      </CanvasDetailProvider>
    );

    // Header container exists
    const header = screen.getByTestId("canvas-header");
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe("HEADER");

    // Back button (left) with accessible label
    const backButton = screen.getByTestId("canvas-back-button");
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute("aria-label", "Back to gallery");

    // Model selector slot (center, empty)
    const modelSlot = screen.getByTestId("model-selector-slot");
    expect(modelSlot).toBeInTheDocument();
    // Slot is empty (no children beyond whitespace)
    expect(modelSlot.children.length).toBe(0);

    // Undo/Redo slot (right, empty)
    const undoRedoSlot = screen.getByTestId("undo-redo-slot");
    expect(undoRedoSlot).toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN die CanvasDetailView ist sichtbar
   *       WHEN der User den Back-Button im Header klickt
   *       THEN schliesst die Detail-View und die Gallery-View (PromptArea + GalleryGrid) wird wieder angezeigt
   *
   * At the CanvasHeader level, clicking back calls the onBack callback.
   */
  it("AC-4: should call onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CanvasDetailProvider initialGenerationId="gen-test">
        <CanvasHeader onBack={mockOnBack} />
      </CanvasDetailProvider>
    );

    const backButton = screen.getByTestId("canvas-back-button");
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-5: GIVEN die CanvasDetailView ist sichtbar und kein Input/Textarea hat Fokus
   *       WHEN der User die ESC-Taste drueckt
   *       THEN schliesst die Detail-View und die Gallery-View wird wieder angezeigt
   *
   * At the CanvasHeader level, ESC triggers onBack when no input is focused.
   */
  it("AC-5: should call onBack when Escape is pressed and no input is focused", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-test">
        <CanvasHeader onBack={mockOnBack} />
      </CanvasDetailProvider>
    );

    // Ensure no input/textarea is focused (document.body is active by default)
    expect(document.activeElement).toBe(document.body);

    // Dispatch Escape keydown on document
    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-6: GIVEN die CanvasDetailView ist sichtbar und ein Input/Textarea hat Fokus
   *       WHEN der User die ESC-Taste drueckt
   *       THEN bleibt die Detail-View geoeffnet (ESC wird nicht abgefangen)
   */
  it("AC-6: should not call onBack when Escape is pressed and an input is focused", () => {
    const { container } = render(
      <div>
        <CanvasDetailProvider initialGenerationId="gen-test">
          <CanvasHeader onBack={mockOnBack} />
        </CanvasDetailProvider>
        <input data-testid="test-input" type="text" />
      </div>
    );

    // Focus the input so document.activeElement is an HTMLInputElement
    const input = screen.getByTestId("test-input");
    input.focus();
    expect(document.activeElement).toBe(input);

    // Dispatch Escape keydown on document
    fireEvent.keyDown(document, { key: "Escape" });

    // onBack should NOT have been called
    expect(mockOnBack).not.toHaveBeenCalled();
  });

  /**
   * AC-6 (textarea variant): ESC should also be ignored when a textarea has focus.
   */
  it("AC-6: should not call onBack when Escape is pressed and a textarea is focused", () => {
    render(
      <div>
        <CanvasDetailProvider initialGenerationId="gen-test">
          <CanvasHeader onBack={mockOnBack} />
        </CanvasDetailProvider>
        <textarea data-testid="test-textarea" />
      </div>
    );

    const textarea = screen.getByTestId("test-textarea");
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockOnBack).not.toHaveBeenCalled();
  });
});
