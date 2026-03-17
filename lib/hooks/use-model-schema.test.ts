// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useModelSchema } from "./use-model-schema";

// ---------------------------------------------------------------------------
// Mock: getModelSchema server action (mock_external per spec Test-Strategy)
// ---------------------------------------------------------------------------

const mockGetModelSchema = vi.fn();

vi.mock("@/app/actions/models", () => ({
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FLUX_SCHNELL_ID = "black-forest-labs/flux-schnell";
const NANO_BANANA_ID = "google/nano-banana-2";

const FLUX_SCHNELL_SCHEMA = {
  aspect_ratio: { type: "string", enum: ["1:1", "16:9"] },
};

const NANO_BANANA_SCHEMA = {
  width: { type: "integer", minimum: 256, maximum: 2048 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a deferred promise that can be resolved/rejected externally.
 * Useful for controlling async timing in tests.
 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useModelSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-1: Gibt Schema zurueck bei gueltigem modelId nach erfolgreichem Fetch
  // GIVEN modelId ist "black-forest-labs/flux-schnell" (gueltiges Model)
  // WHEN useModelSchema(modelId) aufgerufen wird und die Server Action erfolgreich
  //      { properties: { aspect_ratio: { type: "string", enum: ["1:1", "16:9"] } } } zurueckgibt
  // THEN gibt der Hook { schema: { aspect_ratio: ... }, isLoading: false, error: null } zurueck
  it("AC-1: should return schema with isLoading=false after successful fetch", async () => {
    mockGetModelSchema.mockResolvedValueOnce({
      properties: FLUX_SCHNELL_SCHEMA,
    });

    const { result } = renderHook(() => useModelSchema(FLUX_SCHNELL_ID));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.schema).not.toBeNull();
    });

    expect(result.current.schema).toEqual(FLUX_SCHNELL_SCHEMA);
    expect(result.current.error).toBeNull();
    expect(mockGetModelSchema).toHaveBeenCalledWith({
      modelId: FLUX_SCHNELL_ID,
    });
    expect(mockGetModelSchema).toHaveBeenCalledTimes(1);
  });

  // AC-2: Zeigt Loading-State waehrend Server Action laeuft
  // GIVEN modelId ist "black-forest-labs/flux-schnell"
  // WHEN useModelSchema(modelId) aufgerufen wird und die Server Action noch laeuft
  // THEN gibt der Hook { schema: null, isLoading: true, error: null } zurueck
  it("AC-2: should return isLoading=true while server action is pending", async () => {
    const deferred = createDeferred<{ properties: Record<string, unknown> }>();
    mockGetModelSchema.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useModelSchema(FLUX_SCHNELL_ID));

    // While the promise is pending, isLoading should be true
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeNull();

    // Clean up: resolve the promise to avoid dangling async
    await act(async () => {
      deferred.resolve({ properties: FLUX_SCHNELL_SCHEMA });
    });
  });

  // AC-3: Setzt error State bei fehlgeschlagenem Fetch (kein throw)
  // GIVEN modelId ist "black-forest-labs/flux-schnell"
  // WHEN useModelSchema(modelId) aufgerufen wird und die Server Action
  //      { error: "Model not found" } zurueckgibt
  // THEN gibt der Hook { schema: null, isLoading: false, error: "Model not found" } zurueck (kein throw)
  it("AC-3: should return error string and schema=null when server action returns error", async () => {
    mockGetModelSchema.mockResolvedValueOnce({
      error: "Model not found",
    });

    const { result } = renderHook(() => useModelSchema(FLUX_SCHNELL_ID));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBe("Model not found");
    expect(result.current.isLoading).toBe(false);
  });

  // AC-4: Gibt null-Schema bei undefined modelId zurueck ohne Server Action aufzurufen
  // GIVEN modelId ist undefined
  // WHEN useModelSchema(undefined) aufgerufen wird
  // THEN gibt der Hook sofort { schema: null, isLoading: false, error: null } zurueck
  //      OHNE die Server Action aufzurufen
  it("AC-4: should return schema=null, isLoading=false, error=null for undefined modelId", () => {
    const { result } = renderHook(() => useModelSchema(undefined));

    expect(result.current.schema).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetModelSchema).not.toHaveBeenCalled();
  });

  // AC-5: Refetcht Schema bei modelId-Aenderung
  // GIVEN der Hook wurde mit modelId = "black-forest-labs/flux-schnell" aufgerufen
  //       und hat ein Schema geladen
  // WHEN modelId sich zu "google/nano-banana-2" aendert
  // THEN ruft der Hook die Server Action erneut mit der neuen modelId auf
  //      und gibt das neue Schema zurueck
  it("AC-5: should refetch schema when modelId changes", async () => {
    // First call: flux-schnell
    mockGetModelSchema.mockResolvedValueOnce({
      properties: FLUX_SCHNELL_SCHEMA,
    });

    const { result, rerender } = renderHook(
      ({ modelId }: { modelId: string | undefined }) =>
        useModelSchema(modelId),
      { initialProps: { modelId: FLUX_SCHNELL_ID as string | undefined } },
    );

    // Wait for first fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.schema).toEqual(FLUX_SCHNELL_SCHEMA);
    });

    expect(mockGetModelSchema).toHaveBeenCalledTimes(1);
    expect(mockGetModelSchema).toHaveBeenCalledWith({
      modelId: FLUX_SCHNELL_ID,
    });

    // Second call: nano-banana
    mockGetModelSchema.mockResolvedValueOnce({
      properties: NANO_BANANA_SCHEMA,
    });

    rerender({ modelId: NANO_BANANA_ID });

    // Wait for second fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.schema).toEqual(NANO_BANANA_SCHEMA);
    });

    expect(mockGetModelSchema).toHaveBeenCalledTimes(2);
    expect(mockGetModelSchema).toHaveBeenLastCalledWith({
      modelId: NANO_BANANA_ID,
    });
    expect(result.current.error).toBeNull();
  });

  // AC-6: Verwirft veraltete Antwort bei modelId-Wechsel waehrend laufendem Fetch
  // GIVEN der Hook wurde mit modelId = "black-forest-labs/flux-schnell" aufgerufen
  // WHEN die Server Action laeuft und modelId sich zu "google/nano-banana-2" aendert
  //      bevor die Antwort kommt
  // THEN wird die veraltete Antwort fuer flux-schnell verworfen (kein stale-State-Update)
  it("AC-6: should discard stale response when modelId changes during pending fetch", async () => {
    // First call: flux-schnell -- will be a slow response (deferred)
    const staleDeferred = createDeferred<{
      properties: Record<string, unknown>;
    }>();
    mockGetModelSchema.mockReturnValueOnce(staleDeferred.promise);

    const { result, rerender } = renderHook(
      ({ modelId }: { modelId: string | undefined }) =>
        useModelSchema(modelId),
      { initialProps: { modelId: FLUX_SCHNELL_ID as string | undefined } },
    );

    // Wait for loading to start
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Second call: nano-banana -- resolves immediately
    mockGetModelSchema.mockResolvedValueOnce({
      properties: NANO_BANANA_SCHEMA,
    });

    // Change modelId while flux-schnell is still pending
    rerender({ modelId: NANO_BANANA_ID });

    // Wait for second fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.schema).toEqual(NANO_BANANA_SCHEMA);
    });

    // Now resolve the stale flux-schnell response
    await act(async () => {
      staleDeferred.resolve({ properties: FLUX_SCHNELL_SCHEMA });
    });

    // Schema should still be nano-banana (stale response was discarded)
    expect(result.current.schema).toEqual(NANO_BANANA_SCHEMA);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    // Both calls should have been made
    expect(mockGetModelSchema).toHaveBeenCalledTimes(2);
    expect(mockGetModelSchema).toHaveBeenNthCalledWith(1, {
      modelId: FLUX_SCHNELL_ID,
    });
    expect(mockGetModelSchema).toHaveBeenNthCalledWith(2, {
      modelId: NANO_BANANA_ID,
    });
  });
});
