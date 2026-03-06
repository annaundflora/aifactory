import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Shared mock functions accessible from tests
const mockPredictionsCreate = vi.fn();
const mockWait = vi.fn();

// Mock the replicate SDK before importing the module under test
vi.mock("replicate", () => {
  // Must return a constructor function (class-like)
  function MockReplicate() {
    return {
      predictions: { create: mockPredictionsCreate },
      wait: mockWait,
    };
  }
  return { default: MockReplicate };
});

import { replicateRun, ReplicateClient } from "../replicate";

describe("ReplicateClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, REPLICATE_API_TOKEN: "test-token-123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * AC-1: GIVEN ein gueltiger modelId und input-Parameter
   * WHEN ReplicateClient.run(modelId, input) aufgerufen wird
   * THEN wird ein ReplicateRunResult zurueckgegeben mit output (ReadableStream),
   *      predictionId (string) und seed (number | null)
   */
  it("AC-1: should return ReplicateRunResult with output stream, predictionId, and seed", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    mockPredictionsCreate.mockResolvedValue({
      id: "pred-abc123",
      status: "starting",
    });
    mockWait.mockResolvedValue({
      id: "pred-abc123",
      status: "succeeded",
      output: mockStream,
      logs: "Using seed: 42\nGenerating image...",
    });

    const result = await replicateRun("stability-ai/sdxl", {
      prompt: "a cat",
    });

    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("predictionId");
    expect(result).toHaveProperty("seed");
    expect(typeof result.predictionId).toBe("string");
    expect(result.predictionId).toBe("pred-abc123");
    expect(result.output).toBeInstanceOf(ReadableStream);
    expect(result.seed).toBe(42);
  });

  /**
   * AC-2: GIVEN ReplicateClient.run() wird aufgerufen
   * WHEN die Replicate API intern aufgerufen wird
   * THEN wird predictions.create() gefolgt von replicate.wait() verwendet (NICHT replicate.run())
   */
  it("AC-2: should call predictions.create followed by replicate.wait instead of replicate.run", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    mockPredictionsCreate.mockResolvedValue({
      id: "pred-xyz",
      status: "starting",
    });
    mockWait.mockResolvedValue({
      id: "pred-xyz",
      status: "succeeded",
      output: mockStream,
      logs: null,
    });

    await replicateRun("model/test", { prompt: "test" });

    // predictions.create must have been called
    expect(mockPredictionsCreate).toHaveBeenCalledTimes(1);
    expect(mockPredictionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "model/test",
        input: { prompt: "test" },
      })
    );

    // wait must have been called with the prediction from create
    expect(mockWait).toHaveBeenCalledTimes(1);
    expect(mockWait).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pred-xyz" })
    );
  });

  /**
   * AC-3: GIVEN die Replicate API antwortet mit einem Fehler (z.B. 422 Invalid Input)
   * WHEN ReplicateClient.run() aufgerufen wird
   * THEN wird ein Error mit einer aussagekraeftigen Fehlermeldung geworfen
   */
  it("AC-3: should throw error with descriptive message on API failure", async () => {
    mockPredictionsCreate.mockRejectedValue(
      new Error("Invalid input: prompt is required")
    );

    await expect(
      replicateRun("model/test", { wrong_param: "test" })
    ).rejects.toThrow(/Replicate API Fehler/);

    // Reset and verify original error details are included
    mockPredictionsCreate.mockRejectedValue(
      new Error("Invalid input: prompt is required")
    );

    await expect(
      replicateRun("model/test", { wrong_param: "test" })
    ).rejects.toThrow(/Invalid input/);
  });

  /**
   * AC-3 (variant): Failed prediction status also throws descriptive error
   */
  it("AC-3 (variant): should throw error when prediction status is failed", async () => {
    mockPredictionsCreate.mockResolvedValue({
      id: "pred-fail",
      status: "starting",
    });
    mockWait.mockResolvedValue({
      id: "pred-fail",
      status: "failed",
      error: "NSFW content detected",
      output: null,
      logs: null,
    });

    await expect(
      replicateRun("model/test", { prompt: "test" })
    ).rejects.toThrow(/fehlgeschlagen/);
  });

  /**
   * AC-4: GIVEN die Replicate API antwortet mit Rate Limit (429)
   * WHEN ReplicateClient.run() aufgerufen wird
   * THEN wird ein Error mit der Nachricht "Zu viele Anfragen. Bitte kurz warten." geworfen
   */
  it("AC-4: should throw error with rate limit message on 429 response", async () => {
    const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
      status: 429,
    });

    mockPredictionsCreate.mockRejectedValue(rateLimitError);

    await expect(
      replicateRun("model/test", { prompt: "test" })
    ).rejects.toThrow("Zu viele Anfragen. Bitte kurz warten.");
  });

  /**
   * AC-4 (variant): Rate limit during wait phase
   */
  it("AC-4 (variant): should throw rate limit error when 429 occurs during wait", async () => {
    mockPredictionsCreate.mockResolvedValue({
      id: "pred-rl",
      status: "starting",
    });
    const rateLimitError = Object.assign(new Error("Rate limit"), {
      response: { status: 429 },
    });
    mockWait.mockRejectedValue(rateLimitError);

    await expect(
      replicateRun("model/test", { prompt: "test" })
    ).rejects.toThrow("Zu viele Anfragen. Bitte kurz warten.");
  });

  /**
   * AC-9: GIVEN der ReplicateClient wird instanziiert
   * WHEN die Umgebungsvariable REPLICATE_API_TOKEN nicht gesetzt ist
   * THEN wird ein Fehler geworfen
   */
  it("AC-9: should throw error when REPLICATE_API_TOKEN is not set", async () => {
    delete process.env.REPLICATE_API_TOKEN;

    await expect(
      replicateRun("model/test", { prompt: "test" })
    ).rejects.toThrow(/REPLICATE_API_TOKEN/);
  });

  /**
   * Verify ReplicateClient.run is the same as replicateRun (named export object)
   */
  it("should export ReplicateClient.run as alias for replicateRun", () => {
    expect(ReplicateClient.run).toBe(replicateRun);
  });

  /**
   * AC-1 (seed null variant): seed is null when logs have no seed info
   */
  it("AC-1 (variant): should return seed as null when no seed in logs", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    mockPredictionsCreate.mockResolvedValue({
      id: "pred-noseed",
      status: "starting",
    });
    mockWait.mockResolvedValue({
      id: "pred-noseed",
      status: "succeeded",
      output: mockStream,
      logs: "Generating image without seed info",
    });

    const result = await replicateRun("model/test", { prompt: "test" });
    expect(result.seed).toBeNull();
  });

  /**
   * AC-1 (array output variant): handles array output from Replicate
   */
  it("AC-1 (variant): should handle array output from Replicate", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      },
    });

    mockPredictionsCreate.mockResolvedValue({
      id: "pred-arr",
      status: "starting",
    });
    mockWait.mockResolvedValue({
      id: "pred-arr",
      status: "succeeded",
      output: [mockStream],
      logs: null,
    });

    const result = await replicateRun("model/test", { prompt: "test" });
    expect(result.output).toBeInstanceOf(ReadableStream);
    expect(result.predictionId).toBe("pred-arr");
  });
});
