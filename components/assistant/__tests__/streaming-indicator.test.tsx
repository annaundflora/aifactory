// @vitest-environment jsdom
/**
 * Unit Tests for StreamingIndicator component (Slice 11)
 *
 * Tests AC-1 and AC-2 from slice-11-streaming-stop spec.
 * Mocking Strategy: mock_external (as defined in slice spec)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { StreamingIndicator } from "../streaming-indicator";

describe("StreamingIndicator", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN der Agent streamt eine Antwort (isStreaming === true)
  //       WHEN die Chat-Thread Komponente gerendert wird
  //       THEN wird unterhalb der letzten Assistant-Message ein Streaming-Indicator
  //            mit 3 animierten Punkten angezeigt
  // --------------------------------------------------------------------------
  it("AC-1: should render 3 animated dots when visible prop is true", () => {
    render(<StreamingIndicator visible={true} />);

    const indicator = screen.getByTestId("streaming-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toBeVisible();

    // Should have role="status" for accessibility
    expect(indicator).toHaveAttribute("role", "status");
    expect(indicator).toHaveAttribute("aria-label", "Assistant is thinking");

    // Should render exactly 3 animated dot spans (aria-hidden="true")
    const dots = indicator.querySelectorAll('span[aria-hidden="true"]');
    expect(dots).toHaveLength(3);

    // Each dot should have animate-pulse class for CSS animation
    dots.forEach((dot) => {
      expect(dot.className).toMatch(/animate-pulse/);
    });

    // Dots should have staggered animation delays
    expect(dots[0]).toHaveStyle({ animationDelay: "0ms" });
    expect(dots[1]).toHaveStyle({ animationDelay: "200ms" });
    expect(dots[2]).toHaveStyle({ animationDelay: "400ms" });
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN der Agent hat das Streaming beendet (isStreaming === false)
  //       WHEN die Chat-Thread Komponente gerendert wird
  //       THEN ist der Streaming-Indicator nicht sichtbar (nicht im DOM oder hidden)
  // --------------------------------------------------------------------------
  it("AC-2: should not render when visible prop is false", () => {
    render(<StreamingIndicator visible={false} />);

    const indicator = screen.queryByTestId("streaming-indicator");
    expect(indicator).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Additional: Toggling visibility
  // --------------------------------------------------------------------------
  it("should appear and disappear when visible prop changes", () => {
    const { rerender } = render(<StreamingIndicator visible={false} />);

    // Initially not in DOM
    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();

    // Switch to visible
    rerender(<StreamingIndicator visible={true} />);
    expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("streaming-indicator")).toBeVisible();

    // Switch back to hidden
    rerender(<StreamingIndicator visible={false} />);
    expect(screen.queryByTestId("streaming-indicator")).not.toBeInTheDocument();
  });
});
