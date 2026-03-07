// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI needs ResizeObserver + pointer events)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock lucide-react icons (TemplateSelector uses ChevronDown)
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) => (
    <span data-testid="chevron-down-icon" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { TemplateSelector } from "@/components/workspace/template-selector";
import {
  PROMPT_TEMPLATES,
  type PromptTemplate,
} from "@/lib/prompt-templates";

// ---------------------------------------------------------------------------
// Helper: Stateful wrapper that simulates prompt field state
// ---------------------------------------------------------------------------

interface TestWrapperProps {
  initialMotiv?: string;
  initialStyle?: string;
  initialNegative?: string;
}

function TestWrapper({
  initialMotiv = "",
  initialStyle = "",
  initialNegative = "",
}: TestWrapperProps = {}) {
  const [motiv, setMotiv] = useState(initialMotiv);
  const [style, setStyle] = useState(initialStyle);
  const [negative, setNegative] = useState(initialNegative);

  const hasContent =
    motiv.trim().length > 0 ||
    style.trim().length > 0 ||
    negative.trim().length > 0;

  function handleApplyTemplate(template: PromptTemplate) {
    setMotiv(template.motiv);
    setStyle(template.style);
    setNegative(template.negativePrompt);
  }

  return (
    <div>
      <TemplateSelector
        hasContent={hasContent}
        onApplyTemplate={handleApplyTemplate}
      />
      {/* Render current field values for assertion */}
      <div data-testid="field-motiv">{motiv}</div>
      <div data-testid="field-style">{style}</div>
      <div data-testid="field-negative">{negative}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests: Template Selector (Slice 15)
// ---------------------------------------------------------------------------

describe("Template Selector", () => {
  // -------------------------------------------------------------------------
  // AC-3: Templates-Button sichtbar
  // -------------------------------------------------------------------------
  it("AC-3: should render a Templates button in the prompt area", () => {
    /**
     * AC-3: GIVEN der Prompt-Tab ist aktiv
     *       WHEN der User die Prompt Area betrachtet
     *       THEN ist ein "Templates"-Button sichtbar
     */
    render(<TestWrapper />);

    const trigger = screen.getByTestId("template-selector-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Templates");
    expect(trigger).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // AC-4: Dropdown zeigt 5 Template-Optionen
  // -------------------------------------------------------------------------
  it("AC-4: should open dropdown with 5 template options when Templates button is clicked", async () => {
    /**
     * AC-4: GIVEN der Templates-Button ist sichtbar
     *       WHEN der User auf den Templates-Button klickt
     *       THEN oeffnet sich ein Dropdown/Popover mit genau 5 Eintraegen:
     *            "Product Shot", "Landscape", "Character Design", "Logo Design", "Abstract Art"
     */
    const user = userEvent.setup();
    render(<TestWrapper />);

    // Click the Templates button
    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    // All 5 template options should be visible
    await waitFor(() => {
      expect(screen.getByTestId("template-option-product-shot")).toBeInTheDocument();
      expect(screen.getByTestId("template-option-landscape")).toBeInTheDocument();
      expect(screen.getByTestId("template-option-character-design")).toBeInTheDocument();
      expect(screen.getByTestId("template-option-logo-design")).toBeInTheDocument();
      expect(screen.getByTestId("template-option-abstract-art")).toBeInTheDocument();
    });

    // Verify labels
    expect(screen.getByTestId("template-option-product-shot")).toHaveTextContent("Product Shot");
    expect(screen.getByTestId("template-option-landscape")).toHaveTextContent("Landscape");
    expect(screen.getByTestId("template-option-character-design")).toHaveTextContent("Character Design");
    expect(screen.getByTestId("template-option-logo-design")).toHaveTextContent("Logo Design");
    expect(screen.getByTestId("template-option-abstract-art")).toHaveTextContent("Abstract Art");
  });

  // -------------------------------------------------------------------------
  // AC-5: Template befuellt leere Felder direkt
  // -------------------------------------------------------------------------
  it("AC-5: should fill all three prompt fields with template values when fields are empty and template is clicked", async () => {
    /**
     * AC-5: GIVEN das Templates-Dropdown ist offen und alle Prompt-Felder sind leer
     *       WHEN der User auf "Product Shot" klickt
     *       THEN wird das Motiv-Feld mit dem Template-Motiv-Platzhalter befuellt,
     *            das Style-Feld mit dem Template-Style-Text und das Negative-Prompt-Feld
     *            mit dem Template-Negative-Text. Das Dropdown schliesst sich.
     */
    const user = userEvent.setup();
    render(<TestWrapper />);

    // Open dropdown
    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    // Click on "Product Shot"
    const productShotOption = await screen.findByTestId("template-option-product-shot");
    await user.click(productShotOption);

    // Get the expected template values
    const productShot = PROMPT_TEMPLATES.find((t) => t.id === "product-shot")!;

    // Verify all three fields are filled
    await waitFor(() => {
      expect(screen.getByTestId("field-motiv")).toHaveTextContent(productShot.motiv);
      expect(screen.getByTestId("field-style")).toHaveTextContent(productShot.style);
      expect(screen.getByTestId("field-negative")).toHaveTextContent(productShot.negativePrompt);
    });

    // Dropdown should be closed (template options no longer visible)
    await waitFor(() => {
      expect(screen.queryByTestId("template-option-product-shot")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Confirmation Dialog bei nicht-leeren Feldern
  // -------------------------------------------------------------------------
  it("AC-6: should show confirmation dialog when a template is clicked and prompt fields contain text", async () => {
    /**
     * AC-6: GIVEN mindestens ein Prompt-Feld (Motiv, Style oder Negative) enthaelt Text
     *       WHEN der User auf ein Template im Dropdown klickt
     *       THEN erscheint ein Confirmation Dialog mit dem Text "Replace current prompt?"
     *            und den Buttons "Cancel" und "Apply"
     */
    const user = userEvent.setup();
    render(<TestWrapper initialMotiv="existing prompt text" />);

    // Open dropdown
    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    // Click on a template
    const landscapeOption = await screen.findByTestId("template-option-landscape");
    await user.click(landscapeOption);

    // Confirmation dialog should appear
    await waitFor(() => {
      const dialog = screen.getByTestId("template-confirm-dialog");
      expect(dialog).toBeInTheDocument();
    });

    // Dialog title should contain "Replace current prompt?"
    expect(screen.getByText("Replace current prompt?")).toBeInTheDocument();

    // Dialog should have Cancel and Apply buttons
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-7: Cancel laesst Felder unveraendert
  // -------------------------------------------------------------------------
  it("AC-7: should close dialog without changes when Cancel is clicked", async () => {
    /**
     * AC-7: GIVEN der Confirmation Dialog ist sichtbar
     *       WHEN der User auf "Cancel" klickt
     *       THEN schliesst sich der Dialog ohne Aenderungen an den Prompt-Feldern
     */
    const user = userEvent.setup();
    render(
      <TestWrapper
        initialMotiv="keep this motiv"
        initialStyle="keep this style"
        initialNegative="keep this negative"
      />
    );

    // Open dropdown and click template to trigger dialog
    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    const option = await screen.findByTestId("template-option-abstract-art");
    await user.click(option);

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("template-confirm-dialog")).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId("template-confirm-dialog")).not.toBeInTheDocument();
    });

    // Fields should remain unchanged
    expect(screen.getByTestId("field-motiv")).toHaveTextContent("keep this motiv");
    expect(screen.getByTestId("field-style")).toHaveTextContent("keep this style");
    expect(screen.getByTestId("field-negative")).toHaveTextContent("keep this negative");
  });

  // -------------------------------------------------------------------------
  // AC-8: Apply ueberschreibt Felder mit Template-Werten
  // -------------------------------------------------------------------------
  it("AC-8: should overwrite all prompt fields with template values when Apply is clicked", async () => {
    /**
     * AC-8: GIVEN der Confirmation Dialog ist sichtbar
     *       WHEN der User auf "Apply" klickt
     *       THEN werden alle drei Prompt-Felder mit den Template-Werten ueberschrieben
     *            und der Dialog schliesst sich
     */
    const user = userEvent.setup();
    render(
      <TestWrapper
        initialMotiv="old motiv"
        initialStyle="old style"
        initialNegative="old negative"
      />
    );

    // Open dropdown and click template to trigger dialog
    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    const option = await screen.findByTestId("template-option-character-design");
    await user.click(option);

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("template-confirm-dialog")).toBeInTheDocument();
    });

    // Click Apply
    const applyBtn = screen.getByRole("button", { name: "Apply" });
    await user.click(applyBtn);

    // Get expected template values
    const characterDesign = PROMPT_TEMPLATES.find((t) => t.id === "character-design")!;

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId("template-confirm-dialog")).not.toBeInTheDocument();
    });

    // Fields should be overwritten with template values
    expect(screen.getByTestId("field-motiv")).toHaveTextContent(characterDesign.motiv);
    expect(screen.getByTestId("field-style")).toHaveTextContent(characterDesign.style);
    expect(screen.getByTestId("field-negative")).toHaveTextContent(characterDesign.negativePrompt);
  });

  // -------------------------------------------------------------------------
  // Additional: Confirmation dialog triggers when only style field has content
  // -------------------------------------------------------------------------
  it("should show confirmation dialog when only the style field has content", async () => {
    const user = userEvent.setup();
    render(<TestWrapper initialStyle="some style text" />);

    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    const option = await screen.findByTestId("template-option-product-shot");
    await user.click(option);

    await waitFor(() => {
      expect(screen.getByTestId("template-confirm-dialog")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Additional: Confirmation dialog triggers when only negative field has content
  // -------------------------------------------------------------------------
  it("should show confirmation dialog when only the negative prompt field has content", async () => {
    const user = userEvent.setup();
    render(<TestWrapper initialNegative="some negative text" />);

    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    const option = await screen.findByTestId("template-option-landscape");
    await user.click(option);

    await waitFor(() => {
      expect(screen.getByTestId("template-confirm-dialog")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Additional: No confirmation dialog when all fields are whitespace-only
  // -------------------------------------------------------------------------
  it("should not show confirmation dialog when fields contain only whitespace", async () => {
    const onApply = vi.fn();
    render(
      <TemplateSelector hasContent={false} onApplyTemplate={onApply} />
    );

    const user = userEvent.setup();
    const trigger = screen.getByTestId("template-selector-trigger");
    await user.click(trigger);

    const option = await screen.findByTestId("template-option-logo-design");
    await user.click(option);

    // onApplyTemplate should be called directly (no dialog)
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      PROMPT_TEMPLATES.find((t) => t.id === "logo-design")
    );

    // No dialog should appear
    expect(screen.queryByTestId("template-confirm-dialog")).not.toBeInTheDocument();
  });
});
