// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ErrorMessage } from "../error-message";

describe("ErrorMessage", () => {
  // --------------------------------------------------------------------------
  // AC-3: GIVEN der SSE-Stream liefert ein error Event mit {"message": "..."}
  //       WHEN die ErrorMessage Component gerendert wird
  //       THEN zeigt sie eine rot-getoeinte Chat-Bubble mit Warning-Icon und
  //            dem Fehlertext an
  // --------------------------------------------------------------------------
  it("AC-3: should render red-tinted bubble with warning icon and error text", () => {
    render(
      <ErrorMessage
        message="Ein Fehler ist aufgetreten."
        retryCount={0}
      />
    );

    // Error message container exists
    const container = screen.getByTestId("error-message");
    expect(container).toBeInTheDocument();

    // Error text is displayed
    expect(screen.getByText("Ein Fehler ist aufgetreten.")).toBeInTheDocument();

    // Warning icon (AlertTriangle) is present via SVG
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeInTheDocument();

    // Red-tinted styling via destructive class
    const bubble = container.firstElementChild;
    expect(bubble).toBeTruthy();
    expect(bubble!.className).toContain("destructive");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN eine ErrorMessage mit retryCount < 3
  //       WHEN der User auf den "Erneut versuchen" Retry-Button klickt
  //       THEN wird die letzte User-Message erneut an das Backend gesendet
  //            und der Button zeigt einen Spinner mit "Versuche erneut..."
  // --------------------------------------------------------------------------
  it("AC-4: should show retry button when retryCount < 3 and call onRetry on click", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ErrorMessage
        message="Fehler beim Senden."
        onRetry={onRetry}
        retryCount={0}
      />
    );

    // Retry button exists with correct text
    const retryBtn = screen.getByTestId("retry-btn");
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent("Erneut versuchen");

    // Click the retry button
    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("AC-4: should show retry button for retryCount 1 and 2", () => {
    const onRetry = vi.fn();

    const { rerender } = render(
      <ErrorMessage
        message="Fehler"
        onRetry={onRetry}
        retryCount={1}
      />
    );

    expect(screen.getByTestId("retry-btn")).toBeInTheDocument();

    rerender(
      <ErrorMessage
        message="Fehler"
        onRetry={onRetry}
        retryCount={2}
      />
    );

    expect(screen.getByTestId("retry-btn")).toBeInTheDocument();
  });

  it("AC-4: should show spinner text when isRetrying is true", () => {
    const onRetry = vi.fn();

    render(
      <ErrorMessage
        message="Fehler"
        onRetry={onRetry}
        retryCount={1}
        isRetrying={true}
      />
    );

    const retryBtn = screen.getByTestId("retry-btn");
    expect(retryBtn).toHaveTextContent("Versuche erneut...");
    expect(retryBtn).toBeDisabled();

    // The RefreshCw icon should have animate-spin class
    const svg = retryBtn.querySelector("svg");
    expect(svg).toBeTruthy();
    // SVG className in jsdom is SVGAnimatedString; use getAttribute instead
    const svgClass = svg!.getAttribute("class") || "";
    expect(svgClass).toContain("animate-spin");
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN eine ErrorMessage bei der bereits 3 Retries fehlgeschlagen sind
  //       WHEN die Component gerendert wird
  //       THEN zeigt sie den Text "Der Assistent ist gerade nicht verfuegbar.
  //            Bitte versuche es spaeter erneut." und KEINEN Retry-Button
  // --------------------------------------------------------------------------
  it("AC-5: should show permanent error message without retry button when retryCount is 3", () => {
    const onRetry = vi.fn();

    render(
      <ErrorMessage
        message="Original error message"
        onRetry={onRetry}
        retryCount={3}
      />
    );

    // Permanent error message replaces original
    expect(
      screen.getByText(
        "Der Assistent ist gerade nicht verfuegbar. Bitte versuche es spaeter erneut."
      )
    ).toBeInTheDocument();

    // Original message NOT shown
    expect(screen.queryByText("Original error message")).not.toBeInTheDocument();

    // No retry button
    expect(screen.queryByTestId("retry-btn")).not.toBeInTheDocument();
  });

  it("AC-5: should show permanent error without retry button for retryCount > 3", () => {
    render(
      <ErrorMessage
        message="Some error"
        onRetry={() => {}}
        retryCount={5}
      />
    );

    expect(
      screen.getByText(
        "Der Assistent ist gerade nicht verfuegbar. Bitte versuche es spaeter erneut."
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("retry-btn")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN die ErrorMessage Component
  //       WHEN sie mit Props message: string, onRetry?: () => void,
  //            retryCount: number gerendert wird
  //       THEN ist sie eine eigenstaendige, wiederverwendbare Component
  //            ohne externe State-Abhaengigkeiten
  // --------------------------------------------------------------------------
  it("AC-9: should render correctly with only message prop and no onRetry callback", () => {
    render(
      <ErrorMessage
        message="Standalone error"
        retryCount={0}
      />
    );

    // Message is displayed
    expect(screen.getByText("Standalone error")).toBeInTheDocument();

    // No retry button (onRetry not provided)
    expect(screen.queryByTestId("retry-btn")).not.toBeInTheDocument();

    // Container exists
    expect(screen.getByTestId("error-message")).toBeInTheDocument();
  });

  it("AC-9: should be reusable with different messages", () => {
    const { rerender } = render(
      <ErrorMessage
        message="Error A"
        retryCount={0}
      />
    );

    expect(screen.getByText("Error A")).toBeInTheDocument();

    rerender(
      <ErrorMessage
        message="Error B"
        retryCount={1}
      />
    );

    expect(screen.getByText("Error B")).toBeInTheDocument();
    expect(screen.queryByText("Error A")).not.toBeInTheDocument();
  });
});
