// @vitest-environment jsdom
/**
 * Tests for useModelSchema loading/error state behavior
 * Slice: slice-11-auto-sync (ACs 8-10)
 *
 * Mocking Strategy: mock_external
 * - server action getModelSchema mocked
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetModelSchema } = vi.hoisted(() => ({
  mockGetModelSchema: vi.fn(),
}));

vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { useModelSchema } from "@/lib/hooks/use-model-schema";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_SCHEMA = {
  properties: {
    prompt: { type: "string", description: "Input prompt" },
    num_outputs: { type: "integer", minimum: 1, maximum: 4 },
    guidance_scale: { type: "number", minimum: 0, maximum: 20 },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "4:3"],
      description: "Output aspect ratio",
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useModelSchema Loading-State Anzeige", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-8: Loading-Spinner waehrend Schema-Fetch
  // =========================================================================

  /**
   * AC-8: GIVEN ein User waehlt ein Model im Dropdown und useModelSchema startet einen Fetch
   *            (weil input_schema in DB null ist)
   *       WHEN isLoading === true im useModelSchema-Hook
   *       THEN zeigt das Parameter-Panel einen Loading-Spinner an (visueller Indikator
   *            unterhalb des Dropdowns, nicht im Dropdown selbst)
   */
  it("AC-8: should expose isLoading=true while schema fetch is in progress", async () => {
    // Create a promise that we control to keep the fetch pending
    let resolveSchema!: (value: { properties: Record<string, unknown> }) => void;
    const pendingPromise = new Promise<{ properties: Record<string, unknown> }>((resolve) => {
      resolveSchema = resolve;
    });
    mockGetModelSchema.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useModelSchema("model-1"));

    // While the schema fetch is in progress, isLoading should be true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeNull();

    // Resolve the fetch to clean up
    await act(async () => {
      resolveSchema(SAMPLE_SCHEMA);
    });
  });

  // =========================================================================
  // AC-9: Schema geladen -> isLoading=false, schema nicht null
  // =========================================================================

  /**
   * AC-9: GIVEN der useModelSchema-Hook hat das Schema erfolgreich geladen
   *            (isLoading wechselt von true zu false, schema ist nicht null)
   *       WHEN das Schema verfuegbar wird
   *       THEN verschwindet der Loading-Spinner und das Parameter-Panel rendert die
   *            Schema-Properties (Enums als Select, Numbers als Input)
   */
  it("AC-9: should set isLoading=false and return schema after successful fetch", async () => {
    mockGetModelSchema.mockResolvedValue(SAMPLE_SCHEMA);

    const { result } = renderHook(() => useModelSchema("model-1"));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Schema is now available with properties
    expect(result.current.schema).not.toBeNull();
    expect(result.current.schema).toEqual(SAMPLE_SCHEMA.properties);
    expect(result.current.error).toBeNull();

    // Verify the schema contains the expected property types
    // (these would drive rendering of Selects for enums, Inputs for numbers)
    const schema = result.current.schema as Record<string, Record<string, unknown>>;
    expect(schema.aspect_ratio).toHaveProperty("enum");
    expect(schema.num_outputs).toHaveProperty("type", "integer");
    expect(schema.guidance_scale).toHaveProperty("type", "number");
  });

  // =========================================================================
  // AC-10: Fehler -> error gesetzt, schema null
  // =========================================================================

  /**
   * AC-10: GIVEN der useModelSchema-Hook gibt einen Fehler zurueck (error ist nicht null)
   *        WHEN der Fehler eintritt
   *        THEN zeigt das Parameter-Panel eine Fehlermeldung statt des Spinners an
   */
  it("AC-10: should set error and null schema on fetch failure", async () => {
    mockGetModelSchema.mockResolvedValue({ error: "Model not found" });

    const { result } = renderHook(() => useModelSchema("model-999"));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the fetch to complete with error
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Error is set, schema is null
    expect(result.current.error).toBe("Model not found");
    expect(result.current.schema).toBeNull();
  });

  // =========================================================================
  // Additional: exception thrown by server action
  // =========================================================================

  /**
   * AC-10 (additional): Verifies error handling when getModelSchema throws
   * an exception rather than returning an error object.
   */
  it("AC-10b: should set error and null schema on fetch exception", async () => {
    mockGetModelSchema.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useModelSchema("model-broken"));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the fetch to complete with error
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Error is set with the exception message, schema is null
    expect(result.current.error).toBe("Network failure");
    expect(result.current.schema).toBeNull();
  });

  // =========================================================================
  // Edge case: no modelId -> idle state
  // =========================================================================

  it("should return idle state when modelId is undefined", () => {
    const { result } = renderHook(() => useModelSchema(undefined));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // =========================================================================
  // Edge case: stale response ignored on modelId change
  // =========================================================================

  it("should ignore stale response when modelId changes before fetch completes", async () => {
    let resolveFirst!: (value: { properties: Record<string, unknown> }) => void;
    const firstPromise = new Promise<{ properties: Record<string, unknown> }>((resolve) => {
      resolveFirst = resolve;
    });

    const secondSchema = {
      properties: { width: { type: "integer" } },
    };

    mockGetModelSchema
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(secondSchema);

    const { result, rerender } = renderHook(
      ({ modelId }: { modelId: string }) => useModelSchema(modelId),
      { initialProps: { modelId: "model-1" } }
    );

    // First fetch is pending
    expect(result.current.isLoading).toBe(true);

    // Change modelId before the first fetch resolves
    rerender({ modelId: "model-2" });

    // Wait for the second fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Schema should be from the second fetch, not the first
    expect(result.current.schema).toEqual(secondSchema.properties);

    // Now resolve the first (stale) fetch -- should be ignored
    await act(async () => {
      resolveFirst(SAMPLE_SCHEMA);
    });

    // Schema should still be from the second fetch
    expect(result.current.schema).toEqual(secondSchema.properties);
  });
});
