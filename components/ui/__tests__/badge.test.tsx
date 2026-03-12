// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Badge, badgeVariants } from "@/components/ui/badge";

/**
 * Acceptance Tests for Slice 01: shadcn Badge installieren
 *
 * These tests validate the Badge component installation and functionality
 * against the Acceptance Criteria defined in the slice spec.
 *
 * Mocking Strategy: no_mocks (per slice spec)
 */

describe("shadcn Badge Component", () => {
  // ---------------------------------------------------------------
  // AC-1: Badge file exists and is importable
  // ---------------------------------------------------------------
  describe("AC-1: Badge file exists and is importable", () => {
    it("should be importable from components/ui/badge", () => {
      /**
       * AC-1: GIVEN das Projekt ohne `components/ui/badge.tsx`
       *       WHEN der Implementer `pnpm dlx shadcn@3 add badge` ausfuehrt
       *       THEN existiert die Datei `components/ui/badge.tsx` im Projekt
       *
       * Verification: If this test file resolves its imports from
       * @/components/ui/badge without error, the file exists.
       */
      expect(Badge).toBeDefined();
    });
  });

  // ---------------------------------------------------------------
  // AC-2: Named Exports Badge und badgeVariants
  // ---------------------------------------------------------------
  describe("AC-2: Named Exports Badge and badgeVariants", () => {
    it("should export Badge component and badgeVariants function", () => {
      /**
       * AC-2: GIVEN die Datei `components/ui/badge.tsx` existiert
       *       WHEN die Datei importiert wird
       *       THEN exportiert sie die Named Exports `Badge` (React-Komponente)
       *            und `badgeVariants` (cva-Funktion)
       */
      // Badge must be a callable function (React component)
      expect(typeof Badge).toBe("function");

      // badgeVariants must be a callable function (cva function)
      expect(typeof badgeVariants).toBe("function");

      // badgeVariants should return a string of class names when called
      const classes = badgeVariants({ variant: "default" });
      expect(typeof classes).toBe("string");
      expect(classes.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------
  // AC-3: Default-Variante rendern
  // ---------------------------------------------------------------
  describe("AC-3: Default variant rendering", () => {
    it("should render with default variant", () => {
      /**
       * AC-3: GIVEN die Badge-Komponente installiert ist
       *       WHEN `Badge` mit `variant="default"` gerendert wird
       *       THEN rendert die Komponente ein Element mit den entsprechenden
       *            CSS-Klassen
       */
      render(<Badge variant="default">Default</Badge>);

      const badge = screen.getByText("Default");

      // Badge should render as a span element (shadcn v3 Badge uses <span>)
      expect(badge.tagName.toLowerCase()).toMatch(/^(div|span)$/);

      // Should contain default variant CSS classes
      expect(badge).toHaveClass("bg-primary");
      expect(badge).toHaveClass("text-primary-foreground");

      // Should contain base badge classes
      expect(badge).toHaveClass("inline-flex");
      expect(badge).toHaveClass("items-center");
      expect(badge).toHaveClass("rounded-full");
    });
  });

  // ---------------------------------------------------------------
  // AC-4: Secondary-Variante rendern
  // ---------------------------------------------------------------
  describe("AC-4: Secondary variant rendering", () => {
    it("should render with secondary variant", () => {
      /**
       * AC-4: GIVEN die Badge-Komponente installiert ist
       *       WHEN `Badge` mit `variant="secondary"` gerendert wird
       *       THEN rendert die Komponente mit der Secondary-Variante
       *            (unterschiedliche CSS-Klassen als Default)
       */
      render(<Badge variant="secondary">Secondary</Badge>);

      const badge = screen.getByText("Secondary");

      // Should contain secondary variant CSS classes
      expect(badge).toHaveClass("bg-transparent");
      expect(badge).toHaveClass("text-secondary-foreground");

      // Secondary variant must have different classes than default
      expect(badge).not.toHaveClass("bg-primary");
      expect(badge).not.toHaveClass("text-primary-foreground");
    });
  });

  // ---------------------------------------------------------------
  // AC-5: Children korrekt anzeigen
  // ---------------------------------------------------------------
  describe("AC-5: Children text content", () => {
    it("should display children text content", () => {
      /**
       * AC-5: GIVEN die Badge-Komponente installiert ist
       *       WHEN `Badge` mit einem `children`-Prop gerendert wird
       *            (z.B. "2.3M runs")
       *       THEN wird der Text-Inhalt korrekt angezeigt
       */
      render(<Badge>2.3M runs</Badge>);

      const badge = screen.getByText("2.3M runs");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("2.3M runs");
    });
  });
});
