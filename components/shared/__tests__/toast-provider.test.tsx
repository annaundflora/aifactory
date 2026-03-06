// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock sonner — Mocking Strategy: mock_external (per Slice-Spec)
vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div data-testid="sonner-toaster" data-duration={props.duration} />
  ),
}));

import { ToastProvider } from "@/components/shared/toast-provider";

describe("ToastProvider", () => {
  /**
   * AC-1: GIVEN das Root Layout (`app/layout.tsx`) wird gerendert
   *       WHEN die Seite geladen wird
   *       THEN ist der `ToastProvider` (`<Toaster />` von sonner) im Layout eingebunden
   *            und bereit Notifications anzuzeigen
   */
  it("should render sonner Toaster in root layout", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    expect(toaster).toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN ein Toast wird angezeigt
   *       WHEN die konfigurierte Anzeigedauer (Standard: 5 Sekunden) ablaeuft
   *       THEN verschwindet der Toast automatisch ohne User-Interaktion
   *
   * Verifies that Toaster is configured with duration={5000}.
   */
  it("should auto-dismiss toast after configured duration (5000ms)", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    expect(toaster).toHaveAttribute("data-duration", "5000");
  });
});
