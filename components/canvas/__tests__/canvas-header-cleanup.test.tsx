// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import path from "node:path";

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
import { CanvasHeader, type CanvasHeaderProps } from "@/components/canvas/canvas-header";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCanvasHeaderSource(): string {
  const filePath = path.resolve(__dirname, "..", "canvas-header.tsx");
  return fs.readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasHeader - Empty Center Slot", () => {
  let mockOnBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnBack = vi.fn();
  });

  /**
   * AC-4: GIVEN `canvas-header.tsx`
   *       WHEN der Canvas Header gerendert wird ohne `modelSelectorSlot`-Prop
   *       THEN ist der Center-Slot (`data-testid="model-selector-slot"`) leer (keine Kind-Elemente)
   */
  it("AC-4: should render empty center slot when no modelSelectorSlot is provided", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-test">
        <CanvasHeader onBack={mockOnBack} />
      </CanvasDetailProvider>
    );

    const modelSlot = screen.getByTestId("model-selector-slot");
    expect(modelSlot).toBeInTheDocument();

    // Center slot should have no child elements
    expect(modelSlot.children.length).toBe(0);

    // Also verify no text content (whitespace-trimmed)
    expect(modelSlot.textContent?.trim()).toBe("");
  });

  /**
   * AC-5: GIVEN `canvas-header.tsx`
   *       WHEN die `CanvasHeaderProps` inspiziert werden
   *       THEN ist die `modelSelectorSlot` Prop entweder entfernt oder
   *            weiterhin optional mit Typ `ReactNode` (fuer zukuenftige Nutzung)
   */
  it("AC-5: should accept optional modelSelectorSlot prop", () => {
    const source = readCanvasHeaderSource();

    // Check the CanvasHeaderProps interface definition
    const propsMatch = source.match(
      /export\s+interface\s+CanvasHeaderProps\s*\{([\s\S]*?)\}/
    );
    expect(propsMatch).not.toBeNull();

    const propsBody = propsMatch![1];

    if (propsBody.includes("modelSelectorSlot")) {
      // If modelSelectorSlot is still present, it MUST be optional (has ?)
      expect(propsBody).toMatch(/modelSelectorSlot\s*\?\s*:\s*ReactNode/);
    }
    // else: prop was removed entirely, which is also valid per AC-5

    // Verify that CanvasHeader renders without modelSelectorSlot (no error)
    const { container } = render(
      <CanvasDetailProvider initialGenerationId="gen-test">
        <CanvasHeader onBack={mockOnBack} />
      </CanvasDetailProvider>
    );
    expect(container).toBeTruthy();

    // Verify that CanvasHeader also renders WITH modelSelectorSlot (optional prop still works)
    const { container: container2 } = render(
      <CanvasDetailProvider initialGenerationId="gen-test">
        <CanvasHeader
          onBack={mockOnBack}
          modelSelectorSlot={<span data-testid="custom-slot">Custom</span>}
        />
      </CanvasDetailProvider>
    );
    expect(container2).toBeTruthy();

    // When modelSelectorSlot is provided, it should appear in the center slot
    const customSlot = screen.getByTestId("custom-slot");
    expect(customSlot).toBeInTheDocument();
    expect(customSlot.textContent).toBe("Custom");
  });
});
