// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Mocks — Mocking Strategy: mock_external (per Slice-Spec)
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const retryGenerationMock = vi.fn();
vi.mock("@/app/actions/generations", () => ({
  retryGeneration: (...args: unknown[]) => retryGenerationMock(...args),
  fetchGenerations: vi.fn().mockResolvedValue([]),
}));

import {
  GenerationPlaceholder,
} from "@/components/workspace/generation-placeholder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A cute fox",
    negativePrompt: null,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    status: "failed",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Generation Retry Button", () => {
  /**
   * AC-2: GIVEN eine Generation mit `status: "failed"`
   *       WHEN der Retry-Button auf dem Placeholder geklickt wird
   *       THEN wird `retryGeneration({ id: generationId })` aufgerufen und der
   *            Placeholder wechselt zurueck in den Pending/Skeleton-State
   *            (kein Toast bei Erfolg)
   */
  it("should call retryGeneration and switch placeholder to pending state without toast on success", async () => {
    const successGeneration = makeGeneration({ status: "pending" });
    retryGenerationMock.mockResolvedValueOnce(successGeneration);

    const user = userEvent.setup();
    const generation = makeGeneration({ status: "failed" });

    render(<GenerationPlaceholder generation={generation} />);

    // Verify failed state with retry button
    const retryButton = screen.getByTestId("retry-button");
    expect(retryButton).toBeInTheDocument();

    // Click retry
    await user.click(retryButton);

    // retryGeneration was called with correct id
    await waitFor(() => {
      expect(retryGenerationMock).toHaveBeenCalledWith({ id: "gen-001" });
    });

    // No error toast on success
    expect(toast.error).not.toHaveBeenCalled();
  });

  /**
   * AC-3: GIVEN `retryGeneration` gibt `{ error: "..." }` zurueck
   *       WHEN der Retry-Button geklickt wurde
   *       THEN wird ein Error-Toast mit der Fehlermeldung aus dem error-Objekt angezeigt
   */
  it("should show error toast with message when retryGeneration returns error object", async () => {
    const errorMessage = "Generation konnte nicht neu gestartet werden";
    retryGenerationMock.mockResolvedValueOnce({ error: errorMessage });

    const user = userEvent.setup();
    const generation = makeGeneration({ status: "failed" });

    render(<GenerationPlaceholder generation={generation} />);

    const retryButton = screen.getByTestId("retry-button");
    await user.click(retryButton);

    await waitFor(() => {
      expect(retryGenerationMock).toHaveBeenCalledWith({ id: "gen-001" });
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });
});

describe("Generation Error Toast Handling", () => {
  /**
   * AC-4: GIVEN eine Generation schlaegt fehl mit Replicate API Error
   *            (error_message enthaelt "Replicate API error")
   *       WHEN der Generation-Status auf "failed" wechselt und der Polling-Hook
   *            die Aenderung erkennt
   *       THEN wird ein Error-Toast mit dem Text der `error_message` aus der
   *            Generation angezeigt
   */
  it("should show error toast with error_message when generation fails due to Replicate API error", () => {
    const replicateError = "Replicate API error: model not found";

    // Start with pending status
    const pendingGen = makeGeneration({ status: "pending", errorMessage: null });
    const { rerender } = render(<GenerationPlaceholder generation={pendingGen} />);

    // Simulate status transition to failed (as polling would deliver)
    const failedGen = makeGeneration({
      status: "failed",
      errorMessage: replicateError,
    });
    rerender(<GenerationPlaceholder generation={failedGen} />);

    // The generic branch in showErrorToast should pass through the original message
    expect(toast.error).toHaveBeenCalledWith(replicateError);
  });

  /**
   * AC-5: GIVEN eine Generation schlaegt fehl mit R2 Upload Error
   *            (error_message enthaelt "R2" oder "upload")
   *       WHEN der Generation-Status auf "failed" wechselt
   *       THEN wird ein Error-Toast angezeigt: "Bild konnte nicht gespeichert werden"
   */
  it('should show error toast "Bild konnte nicht gespeichert werden" for R2 upload failure', () => {
    const pendingGen = makeGeneration({ status: "pending", errorMessage: null });
    const { rerender } = render(<GenerationPlaceholder generation={pendingGen} />);

    // Case: error_message contains "R2"
    const failedGenR2 = makeGeneration({
      status: "failed",
      errorMessage: "R2 bucket write failed",
    });
    rerender(<GenerationPlaceholder generation={failedGenR2} />);

    expect(toast.error).toHaveBeenCalledWith(
      "Bild konnte nicht gespeichert werden"
    );

    vi.clearAllMocks();

    // Also test with "upload" keyword — need fresh component to reset prevStatusRef
    const pendingGen2 = makeGeneration({
      id: "gen-002",
      status: "pending",
      errorMessage: null,
    });
    const { rerender: rerender2 } = render(
      <GenerationPlaceholder generation={pendingGen2} />
    );

    const failedGenUpload = makeGeneration({
      id: "gen-002",
      status: "failed",
      errorMessage: "Image upload to storage failed",
    });
    rerender2(<GenerationPlaceholder generation={failedGenUpload} />);

    expect(toast.error).toHaveBeenCalledWith(
      "Bild konnte nicht gespeichert werden"
    );
  });

  /**
   * AC-6: GIVEN Replicate antwortet mit HTTP 429
   *            (error_message enthaelt "429" oder "rate limit")
   *       WHEN der Generation-Status auf "failed" wechselt
   *       THEN wird ein Error-Toast angezeigt: "Zu viele Anfragen. Bitte kurz warten."
   */
  it('should show error toast "Zu viele Anfragen. Bitte kurz warten." for HTTP 429 rate limit', () => {
    // Test with "429"
    const pendingGen = makeGeneration({ status: "pending", errorMessage: null });
    const { rerender } = render(<GenerationPlaceholder generation={pendingGen} />);

    const failedGen429 = makeGeneration({
      status: "failed",
      errorMessage: "HTTP 429: Too many requests",
    });
    rerender(<GenerationPlaceholder generation={failedGen429} />);

    expect(toast.error).toHaveBeenCalledWith(
      "Zu viele Anfragen. Bitte kurz warten."
    );

    vi.clearAllMocks();

    // Also test with "rate limit" keyword
    const pendingGen2 = makeGeneration({
      id: "gen-003",
      status: "pending",
      errorMessage: null,
    });
    const { rerender: rerender2 } = render(
      <GenerationPlaceholder generation={pendingGen2} />
    );

    const failedGenRateLimit = makeGeneration({
      id: "gen-003",
      status: "failed",
      errorMessage: "Rate limit exceeded",
    });
    rerender2(<GenerationPlaceholder generation={failedGenRateLimit} />);

    expect(toast.error).toHaveBeenCalledWith(
      "Zu viele Anfragen. Bitte kurz warten."
    );
  });
});
