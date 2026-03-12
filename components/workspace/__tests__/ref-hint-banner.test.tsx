// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ReferenceSlotData } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Mocks — mock_external strategy per spec (localStorage + lucide icons + cn)
// ---------------------------------------------------------------------------

// Mock lucide-react icons to simple SVG elements
vi.mock("lucide-react", () => ({
  Info: (props: Record<string, unknown>) => (
    <svg data-testid={props["data-testid"] as string ?? "info-icon"} />
  ),
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
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

import { RefHintBanner } from "../ref-hint-banner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a ReferenceSlotData for testing */
function createSlot(slotPosition: number): ReferenceSlotData {
  return {
    id: `ref-${slotPosition}`,
    imageUrl: `https://r2.example.com/references/img-${slotPosition}.png`,
    slotPosition,
    role: "style",
    strength: "moderate",
  };
}

// ---------------------------------------------------------------------------
// localStorage mock via vi.stubGlobal — per spec Mocking Strategy
// ---------------------------------------------------------------------------

let localStorageStore: Record<string, string>;

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    localStorageStore = {};
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("RefHintBanner", () => {
  beforeEach(() => {
    localStorageStore = {};
    vi.stubGlobal("localStorage", localStorageMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("Visibility & Dynamic Text", () => {
    // AC-1: Banner zeigt sparse @-Nummern bei mehreren Referenzen
    it('AC-1: should display banner with text containing @1, @3, @5 when three references at those slots are loaded', () => {
      /**
       * AC-1: GIVEN PromptArea im img2img-Modus mit 3 Referenzen in Slots @1, @3, @5
       * WHEN der RefHintBanner gerendert wird und nicht dismissed ist
       * THEN zeigt der Banner den Text "Tipp: Nutze @1, @3, @5 im Prompt um Referenzen anzusprechen"
       * mit einem Info-Icon und einem Dismiss-Button [x]
       */
      const slots = [createSlot(1), createSlot(3), createSlot(5)];

      render(<RefHintBanner slots={slots} mode="img2img" />);

      // Banner should be visible
      const banner = screen.getByTestId("ref-hint-banner");
      expect(banner).toBeInTheDocument();

      // Hint text with sparse @-numbers
      const hintText = screen.getByTestId("hint-text");
      expect(hintText).toHaveTextContent(
        "Tipp: Nutze @1, @3, @5 im Prompt um Referenzen anzusprechen"
      );

      // Info icon present
      expect(screen.getByTestId("info-icon")).toBeInTheDocument();

      // Dismiss button [x] present
      const dismissBtn = screen.getByTestId("dismiss-button");
      expect(dismissBtn).toBeInTheDocument();
    });

    // AC-2: Banner zeigt einzelne @-Nummer
    it('AC-2: should display banner with text containing only @2 when single reference at slot 2 is loaded', () => {
      /**
       * AC-2: GIVEN PromptArea im img2img-Modus mit 1 Referenz in Slot @2
       * WHEN der RefHintBanner gerendert wird
       * THEN zeigt der Banner den Text "Tipp: Nutze @2 im Prompt um Referenzen anzusprechen"
       * (nur vorhandene @-Nummern, dynamisch)
       */
      const slots = [createSlot(2)];

      render(<RefHintBanner slots={slots} mode="img2img" />);

      const hintText = screen.getByTestId("hint-text");
      expect(hintText).toHaveTextContent(
        "Tipp: Nutze @2 im Prompt um Referenzen anzusprechen"
      );

      // Should NOT contain other @-numbers
      expect(hintText.textContent).not.toContain("@1");
      expect(hintText.textContent).not.toContain("@3");
    });

    // AC-3: Banner hidden bei 0 Referenzen
    it('AC-3: should not render banner when no reference slots are filled', () => {
      /**
       * AC-3: GIVEN PromptArea mit 0 Referenzen (keine Slots belegt)
       * WHEN der RefHintBanner gerendert wird
       * THEN ist der Banner NICHT sichtbar (nicht im DOM oder hidden)
       */
      render(<RefHintBanner slots={[]} mode="img2img" />);

      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();
    });

    // AC-7: Banner hidden im txt2img-Modus
    it('AC-7: should not render banner in txt2img mode even with references loaded', () => {
      /**
       * AC-7: GIVEN PromptArea im txt2img-Modus mit geladenen Referenzen
       * WHEN der RefHintBanner gerendert wird
       * THEN ist der Banner NICHT sichtbar (nur im img2img-Modus relevant)
       */
      const slots = [createSlot(1), createSlot(2)];

      render(<RefHintBanner slots={slots} mode="txt2img" />);

      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();
    });

    // AC-8: Banner-Text aktualisiert sich bei Slot-Entfernung
    it('AC-8: should update banner text when a reference slot is removed', () => {
      /**
       * AC-8: GIVEN Referenzen mit Slots @1 und @4
       * WHEN Slot @1 entfernt wird (nur @4 verbleibt)
       * THEN aktualisiert der Banner den Text auf "Tipp: Nutze @4 im Prompt um Referenzen anzusprechen"
       */
      const initialSlots = [createSlot(1), createSlot(4)];

      const { rerender } = render(
        <RefHintBanner slots={initialSlots} mode="img2img" />
      );

      // Initially shows both @1 and @4
      let hintText = screen.getByTestId("hint-text");
      expect(hintText).toHaveTextContent(
        "Tipp: Nutze @1, @4 im Prompt um Referenzen anzusprechen"
      );

      // Remove slot @1, only @4 remains
      const updatedSlots = [createSlot(4)];
      rerender(<RefHintBanner slots={updatedSlots} mode="img2img" />);

      // Text should update to show only @4
      hintText = screen.getByTestId("hint-text");
      expect(hintText).toHaveTextContent(
        "Tipp: Nutze @4 im Prompt um Referenzen anzusprechen"
      );

      // @1 should no longer appear
      expect(hintText.textContent).not.toContain("@1");
    });
  });

  describe("Dismiss Behavior", () => {
    // AC-4: Dismiss setzt localStorage und versteckt Banner
    it('AC-4: should hide banner and set localStorage ref-hint-dismissed to true on dismiss click', async () => {
      /**
       * AC-4: GIVEN RefHintBanner ist sichtbar mit Referenzen geladen
       * WHEN der User den Dismiss-Button [x] klickt
       * THEN verschwindet der Banner UND localStorage enthaelt den Key "ref-hint-dismissed" mit dem Wert "true"
       */
      const user = userEvent.setup();
      const slots = [createSlot(1), createSlot(3)];

      render(<RefHintBanner slots={slots} mode="img2img" />);

      // Banner is visible initially
      expect(screen.getByTestId("ref-hint-banner")).toBeInTheDocument();

      // Click dismiss button
      const dismissBtn = screen.getByTestId("dismiss-button");
      await user.click(dismissBtn);

      // Banner should be gone from the DOM
      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();

      // localStorage should have been called with the correct key and value
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "ref-hint-dismissed",
        "true"
      );
    });

    // AC-5: Dismiss persistiert ueber Reload
    it('AC-5: should not render banner when localStorage ref-hint-dismissed is true', () => {
      /**
       * AC-5: GIVEN localStorage enthaelt "ref-hint-dismissed: true" UND es sind Referenzen geladen
       * WHEN die Seite neu geladen wird und der RefHintBanner gerendert wird
       * THEN ist der Banner NICHT sichtbar (Dismiss persistiert ueber Reload)
       */
      // Simulate persisted dismiss state in localStorage
      localStorageStore["ref-hint-dismissed"] = "true";

      const slots = [createSlot(1), createSlot(2), createSlot(3)];

      render(<RefHintBanner slots={slots} mode="img2img" />);

      // Banner should NOT be in the DOM despite having references
      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();

      // localStorage.getItem should have been called to check the persisted state
      expect(localStorageMock.getItem).toHaveBeenCalledWith("ref-hint-dismissed");
    });

    // AC-6: Dismiss bleibt nach Referenz-Aenderungen
    it('AC-6: should keep banner dismissed when references are removed and re-added', async () => {
      /**
       * AC-6: GIVEN RefHintBanner wurde dismissed UND alle Referenzen werden entfernt (0 Slots)
       * WHEN danach neue Referenzen hinzugefuegt werden
       * THEN bleibt der Banner dismissed (kein automatisches Reset bei Referenz-Aenderungen)
       */
      const user = userEvent.setup();
      const initialSlots = [createSlot(1)];

      const { rerender } = render(
        <RefHintBanner slots={initialSlots} mode="img2img" />
      );

      // Banner is visible initially
      expect(screen.getByTestId("ref-hint-banner")).toBeInTheDocument();

      // Dismiss the banner
      const dismissBtn = screen.getByTestId("dismiss-button");
      await user.click(dismissBtn);

      // Banner should be gone
      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();

      // Remove all references (0 slots)
      rerender(<RefHintBanner slots={[]} mode="img2img" />);

      // Still not visible (no refs)
      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();

      // Add new references back
      const newSlots = [createSlot(2), createSlot(5)];
      rerender(<RefHintBanner slots={newSlots} mode="img2img" />);

      // Banner should STILL be dismissed -- no automatic reset
      expect(screen.queryByTestId("ref-hint-banner")).not.toBeInTheDocument();

      // localStorage should still have the dismissed flag
      expect(localStorageStore["ref-hint-dismissed"]).toBe("true");
    });
  });
});
