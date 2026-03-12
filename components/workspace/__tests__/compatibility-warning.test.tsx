// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks — mock_external strategy per spec
// ---------------------------------------------------------------------------

// Mock lucide-react icons to simple SVG elements
vi.mock("lucide-react", () => ({
  AlertTriangle: (props: Record<string, unknown>) => (
    <svg data-testid="alert-triangle-icon" {...props} />
  ),
}));

// Mock cn to just concatenate class names (avoids tailwind-merge issues)
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) =>
    args
      .flat()
      .filter((a) => typeof a === "string" && a.length > 0)
      .join(" "),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { CompatibilityWarning } from "../compatibility-warning";

// ---------------------------------------------------------------------------
// Test Suite: CompatibilityWarning — Slice 11 Acceptance Tests
// ---------------------------------------------------------------------------

describe("CompatibilityWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("partial variant", () => {
    // AC-5: GIVEN 5 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() === 3`
    //       WHEN die `CompatibilityWarning` gerendert wird
    //       THEN zeigt sie den Variant `partial`: Text enthaelt den Modellnamen und "max 3",
    //       Hinweis dass @4 und @5 ignoriert werden
    it('AC-5: should show partial warning with model name and max image count', () => {
      render(
        <CompatibilityWarning
          modelName="FLUX 2 Pro"
          maxImageCount={3}
          slotCount={5}
          slotPositions={[1, 2, 3, 4, 5]}
          onDimmedSlots={vi.fn()}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={vi.fn()}
        />
      );

      // Warning should be visible with partial variant
      const warning = screen.getByTestId("compatibility-warning");
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveAttribute("data-variant", "partial");
      expect(warning).toHaveAttribute("role", "alert");

      // Text should contain model name and max count
      const warningText = screen.getByTestId("warning-text");
      expect(warningText).toHaveTextContent("FLUX 2 Pro");
      expect(warningText).toHaveTextContent("max 3");

      // Should mention that @4 and @5 are ignored
      expect(warningText).toHaveTextContent("@4");
      expect(warningText).toHaveTextContent("@5");
      expect(warningText).toHaveTextContent("ignoriert");
    });

    // AC-6: GIVEN 5 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() === 3`
    //       WHEN die `CompatibilityWarning` im `partial`-State gerendert wird
    //       THEN werden die Slots @4 und @5 als `dimmed` markiert
    //       (via Callback `onDimmedSlots` mit Array `[4, 5]`)
    it('AC-6: should call onDimmedSlots with slot positions exceeding the limit', () => {
      const onDimmedSlots = vi.fn();

      render(
        <CompatibilityWarning
          modelName="FLUX 2 Pro"
          maxImageCount={3}
          slotCount={5}
          slotPositions={[1, 2, 3, 4, 5]}
          onDimmedSlots={onDimmedSlots}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={vi.fn()}
        />
      );

      // onDimmedSlots should be called with [4, 5] — positions exceeding maxImageCount of 3
      expect(onDimmedSlots).toHaveBeenCalledWith([4, 5]);
    });

    // AC-11: GIVEN eine sichtbare `CompatibilityWarning` im `partial`-State
    //        WHEN der User das Modell wechselt zu einem mit `getMaxImageCount() >= 5`
    //        THEN verschwindet die Warning und alle Slots werden wieder `ready` (nicht `dimmed`)
    it('AC-11: should hide warning and clear dimmed slots when model supports enough images', () => {
      const onDimmedSlots = vi.fn();
      const onGenerateDisabled = vi.fn();

      // Initial render: partial state (maxImageCount=3, slotCount=5)
      const { rerender } = render(
        <CompatibilityWarning
          modelName="FLUX 2 Pro"
          maxImageCount={3}
          slotCount={5}
          slotPositions={[1, 2, 3, 4, 5]}
          onDimmedSlots={onDimmedSlots}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={onGenerateDisabled}
        />
      );

      // Verify partial variant is showing
      expect(screen.getByTestId("compatibility-warning")).toHaveAttribute(
        "data-variant",
        "partial"
      );
      expect(onDimmedSlots).toHaveBeenCalledWith([4, 5]);

      // Clear mocks to track new calls on rerender
      onDimmedSlots.mockClear();
      onGenerateDisabled.mockClear();

      // Model switch: now supports >= 5 images
      rerender(
        <CompatibilityWarning
          modelName="New Model"
          maxImageCount={5}
          slotCount={5}
          slotPositions={[1, 2, 3, 4, 5]}
          onDimmedSlots={onDimmedSlots}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={onGenerateDisabled}
        />
      );

      // Warning should be hidden (variant="hidden" means no DOM)
      expect(screen.queryByTestId("compatibility-warning")).not.toBeInTheDocument();

      // onDimmedSlots should be called with empty array (all slots ready again)
      expect(onDimmedSlots).toHaveBeenCalledWith([]);

      // Generate should be enabled
      expect(onGenerateDisabled).toHaveBeenCalledWith(false);
    });
  });

  describe("no-support variant", () => {
    // AC-7: GIVEN 2 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() === 0`
    //       WHEN die `CompatibilityWarning` gerendert wird
    //       THEN zeigt sie den Variant `no-support`: Text "Modell unterstuetzt keine
    //       Referenz-Bilder" mit einem klickbaren Link "Switch to FLUX 2 Pro"
    it('AC-7: should show no-support warning with Switch to FLUX 2 Pro link', () => {
      render(
        <CompatibilityWarning
          modelName="Some Model"
          maxImageCount={0}
          slotCount={2}
          slotPositions={[1, 2]}
          onDimmedSlots={vi.fn()}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={vi.fn()}
        />
      );

      // Warning should be visible with no-support variant
      const warning = screen.getByTestId("compatibility-warning");
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveAttribute("data-variant", "no-support");
      expect(warning).toHaveAttribute("role", "alert");

      // Text should indicate no reference image support
      const warningText = screen.getByTestId("warning-text");
      expect(warningText).toHaveTextContent("unterstuetzt keine Referenz-Bilder");
      expect(warningText).toHaveTextContent("Some Model");

      // "Switch to FLUX 2 Pro" link should be present
      const switchLink = screen.getByTestId("switch-model-link");
      expect(switchLink).toBeInTheDocument();
      expect(switchLink).toHaveTextContent("Switch to FLUX 2 Pro");
    });

    // AC-8: GIVEN die `CompatibilityWarning` im `no-support`-State
    //       WHEN der User auf den Link "Switch to FLUX 2 Pro" klickt
    //       THEN wird der `onSwitchModel`-Callback mit der Model-ID
    //       `"black-forest-labs/flux-2-pro"` aufgerufen
    it('AC-8: should call onSwitchModel with flux-2-pro model ID when link is clicked', async () => {
      const user = userEvent.setup();
      const onSwitchModel = vi.fn();

      render(
        <CompatibilityWarning
          modelName="Some Model"
          maxImageCount={0}
          slotCount={2}
          slotPositions={[1, 2]}
          onDimmedSlots={vi.fn()}
          onSwitchModel={onSwitchModel}
          onGenerateDisabled={vi.fn()}
        />
      );

      // Click the switch link
      const switchLink = screen.getByTestId("switch-model-link");
      await user.click(switchLink);

      // Callback should be called with the correct model ID
      expect(onSwitchModel).toHaveBeenCalledTimes(1);
      expect(onSwitchModel).toHaveBeenCalledWith("black-forest-labs/flux-2-pro");
    });

    // AC-9: GIVEN die `CompatibilityWarning` im `no-support`-State
    //       WHEN sie gerendert wird
    //       THEN signalisiert sie via `onGenerateDisabled(true)` dass der
    //       Generate-Button disabled werden soll
    it('AC-9: should call onGenerateDisabled with true when no-support', () => {
      const onGenerateDisabled = vi.fn();

      render(
        <CompatibilityWarning
          modelName="Some Model"
          maxImageCount={0}
          slotCount={2}
          slotPositions={[1, 2]}
          onDimmedSlots={vi.fn()}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={onGenerateDisabled}
        />
      );

      // onGenerateDisabled should be called with true
      expect(onGenerateDisabled).toHaveBeenCalledWith(true);
    });
  });

  describe("hidden variant", () => {
    // AC-10: GIVEN 3 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() >= 3`
    //        WHEN die `CompatibilityWarning` gerendert wird
    //        THEN ist die Warning NICHT sichtbar (Variant `hidden`) und
    //        `onGenerateDisabled(false)`
    it('AC-10: should not render warning when model supports all loaded slots', () => {
      const onGenerateDisabled = vi.fn();
      const onDimmedSlots = vi.fn();

      render(
        <CompatibilityWarning
          modelName="FLUX 2 Pro"
          maxImageCount={3}
          slotCount={3}
          slotPositions={[1, 2, 3]}
          onDimmedSlots={onDimmedSlots}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={onGenerateDisabled}
        />
      );

      // Warning should NOT be in the DOM (hidden variant renders null)
      expect(screen.queryByTestId("compatibility-warning")).not.toBeInTheDocument();

      // Generate should be enabled
      expect(onGenerateDisabled).toHaveBeenCalledWith(false);

      // No dimmed slots
      expect(onDimmedSlots).toHaveBeenCalledWith([]);
    });

    // AC-10 supplementary: Infinity maxImageCount also means hidden
    it('AC-10 (supplementary): should not render warning when maxImageCount is Infinity', () => {
      const onGenerateDisabled = vi.fn();

      render(
        <CompatibilityWarning
          modelName="Unlimited Model"
          maxImageCount={Infinity}
          slotCount={5}
          slotPositions={[1, 2, 3, 4, 5]}
          onDimmedSlots={vi.fn()}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={onGenerateDisabled}
        />
      );

      expect(screen.queryByTestId("compatibility-warning")).not.toBeInTheDocument();
      expect(onGenerateDisabled).toHaveBeenCalledWith(false);
    });

    // AC-10 supplementary: zero slots means hidden regardless of maxImageCount
    it('AC-10 (supplementary): should not render warning when slotCount is 0', () => {
      const onGenerateDisabled = vi.fn();

      render(
        <CompatibilityWarning
          modelName="Any Model"
          maxImageCount={0}
          slotCount={0}
          slotPositions={[]}
          onDimmedSlots={vi.fn()}
          onSwitchModel={vi.fn()}
          onGenerateDisabled={onGenerateDisabled}
        />
      );

      expect(screen.queryByTestId("compatibility-warning")).not.toBeInTheDocument();
      expect(onGenerateDisabled).toHaveBeenCalledWith(false);
    });
  });
});
