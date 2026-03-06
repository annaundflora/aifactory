// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock next/font/google to avoid font loading in tests
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

// Track whether Toaster is rendered
const mockToaster = vi.fn();
vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    mockToaster(props);
    return <div data-testid="sonner-toaster" />;
  },
}));

import RootLayout from "@/app/layout";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Root Layout (app/layout.tsx)", () => {
  /**
   * AC-7: GIVEN die App wird auf einer beliebigen Route geladen
   * WHEN `app/layout.tsx` gerendert wird
   * THEN ist der Toaster (sonner) im Root-Layout eingebunden,
   * sodass Toast-Notifications global angezeigt werden koennen
   */
  it("AC-7: should include sonner Toaster component so toast notifications can be displayed globally", () => {
    // RootLayout renders <html> and <body> tags, which testing-library handles
    // We render the layout with children to verify Toaster is present alongside content
    const { container } = render(
      <RootLayout>
        <div data-testid="child-content">Page Content</div>
      </RootLayout>,
      // Render directly into document to handle <html>/<body> tags
      { container: document.documentElement }
    );

    // Toaster should be rendered
    const toaster = container.querySelector('[data-testid="sonner-toaster"]');
    expect(toaster).toBeInTheDocument();

    // Toaster mock should have been called (confirming sonner Toaster is used)
    expect(mockToaster).toHaveBeenCalled();

    // Children should also be rendered (Toaster does not replace content)
    const childContent = container.querySelector(
      '[data-testid="child-content"]'
    );
    expect(childContent).toBeInTheDocument();
  });
});
