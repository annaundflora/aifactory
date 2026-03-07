import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock ReplicateClient
vi.mock("@/lib/clients/replicate", () => ({
  ReplicateClient: {
    run: vi.fn(),
  },
}));

// Mock StorageService
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: vi.fn(),
  },
}));

// Mock DB queries
vi.mock("@/lib/db/queries", () => ({
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
}));

// Mock sharp
vi.mock("sharp", () => {
  const sharpInstance = {
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
  };
  const sharpFn = vi.fn().mockReturnValue(sharpInstance);
  return { default: sharpFn };
});

import { GenerationService } from "@/lib/services/generation-service";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  getGeneration,
  updateGeneration,
} from "@/lib/db/queries";
import type { Generation } from "@/lib/db/queries";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A fox",
    promptMotiv: "",
    promptStyle: "",
    isFavorite: false,
    negativePrompt: null,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    status: "pending",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    createdAt: new Date(),
    ...overrides,
  } as Generation;
}

/** Create a ReadableStream from a Buffer */
function bufferToStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

/** PNG magic bytes buffer */
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

/** WebP magic bytes buffer */
const WEBP_BUFFER = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GenerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default sharp mock behavior for PNG input (no conversion needed)
    const sharpInst = {
      png: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(PNG_BUFFER),
      metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
    };
    (sharp as unknown as Mock).mockReturnValue(sharpInst);
  });

  // AC-1: GIVEN ein gueltiges Projekt und Prompt
  //        WHEN generateImages aufgerufen wird mit count=2
  //        THEN werden 2 Generation-Datensaetze mit status "pending" erstellt und als Array zurueckgegeben
  it("AC-1: should create N pending generation records in DB and return them", async () => {
    const gen1 = makeGeneration({ id: "gen-001" });
    const gen2 = makeGeneration({ id: "gen-002" });

    (createGeneration as Mock)
      .mockResolvedValueOnce(gen1)
      .mockResolvedValueOnce(gen2);

    // Mock replicate + storage for background processing (fire-and-forget)
    (ReplicateClient.run as Mock).mockResolvedValue({
      output: bufferToStream(PNG_BUFFER),
      predictionId: "pred-1",
      seed: 42,
    });
    (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
    (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

    const result = await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      "black-forest-labs/flux-2-pro",
      {},
      2
    );

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending");
    expect(result[1].status).toBe("pending");
    expect(createGeneration).toHaveBeenCalledTimes(2);
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-001",
        prompt: "A fox",
        modelId: "black-forest-labs/flux-2-pro",
      })
    );
  });

  // AC-2: GIVEN pending Generations wurden erstellt
  //        WHEN der Generation-Flow fuer eine Generation erfolgreich durchlaeuft
  //        THEN wird ReplicateClient.run() aufgerufen, Output an StorageService.upload() uebergeben,
  //             und DB auf status "completed" mit image_url, width, height, seed, replicate_prediction_id aktualisiert
  it("AC-2: should call ReplicateClient.run, upload to R2, and update DB to completed with image_url, width, height, seed, predictionId", async () => {
    const gen = makeGeneration({ id: "gen-abc" });
    (createGeneration as Mock).mockResolvedValue(gen);

    const completedGen = makeGeneration({
      id: "gen-abc",
      status: "completed",
      imageUrl: "https://r2.example.com/projects/proj-001/gen-abc.png",
      width: 1024,
      height: 768,
      seed: 42,
      replicatePredictionId: "pred-123",
    });

    (ReplicateClient.run as Mock).mockResolvedValue({
      output: bufferToStream(PNG_BUFFER),
      predictionId: "pred-123",
      seed: 42,
    });
    (StorageService.upload as Mock).mockResolvedValue(
      "https://r2.example.com/projects/proj-001/gen-abc.png"
    );
    (updateGeneration as Mock).mockResolvedValue(completedGen);

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      "black-forest-labs/flux-2-pro",
      {},
      1
    );

    // Wait for fire-and-forget processing
    await vi.waitFor(() => {
      expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
    });

    expect(ReplicateClient.run).toHaveBeenCalledWith(
      "black-forest-labs/flux-2-pro",
      expect.objectContaining({ prompt: "A fox" })
    );

    await vi.waitFor(() => {
      expect(StorageService.upload).toHaveBeenCalledTimes(1);
    });

    expect(StorageService.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      "projects/proj-001/gen-abc.png"
    );

    await vi.waitFor(() => {
      expect(updateGeneration).toHaveBeenCalledWith(
        "gen-abc",
        expect.objectContaining({
          status: "completed",
          imageUrl: "https://r2.example.com/projects/proj-001/gen-abc.png",
          width: 1024,
          height: 768,
          seed: 42,
          replicatePredictionId: "pred-123",
        })
      );
    });
  });

  // AC-3: GIVEN der Replicate-Call schlaegt fehl
  //        WHEN der Generation-Flow fuer diese Generation laeuft
  //        THEN wird die Generation auf status "failed" mit error_message aktualisiert und KEIN R2-Upload durchgefuehrt
  it("AC-3: should set status to failed with error_message when Replicate call fails", async () => {
    const gen = makeGeneration({ id: "gen-fail" });
    (createGeneration as Mock).mockResolvedValue(gen);

    (ReplicateClient.run as Mock).mockRejectedValue(
      new Error("Replicate API Fehler: 500 Internal Server Error")
    );
    (updateGeneration as Mock).mockResolvedValue(
      makeGeneration({ id: "gen-fail", status: "failed", errorMessage: "Replicate API Fehler: 500 Internal Server Error" })
    );

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      "black-forest-labs/flux-2-pro",
      {},
      1
    );

    await vi.waitFor(() => {
      expect(updateGeneration).toHaveBeenCalledWith(
        "gen-fail",
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("Replicate API Fehler"),
        })
      );
    });

    expect(StorageService.upload).not.toHaveBeenCalled();
  });

  // AC-4: GIVEN der R2-Upload schlaegt fehl nach erfolgreichem Replicate-Call
  //        WHEN der Generation-Flow fuer diese Generation laeuft
  //        THEN wird die Generation auf status "failed" mit error_message aktualisiert
  it("AC-4: should set status to failed with error_message when R2 upload fails", async () => {
    const gen = makeGeneration({ id: "gen-r2fail" });
    (createGeneration as Mock).mockResolvedValue(gen);

    (ReplicateClient.run as Mock).mockResolvedValue({
      output: bufferToStream(PNG_BUFFER),
      predictionId: "pred-456",
      seed: 99,
    });
    (StorageService.upload as Mock).mockRejectedValue(
      new Error("R2 Upload fehlgeschlagen: network error")
    );
    (updateGeneration as Mock).mockResolvedValue(
      makeGeneration({ id: "gen-r2fail", status: "failed", errorMessage: "R2 Upload fehlgeschlagen: network error" })
    );

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      "black-forest-labs/flux-2-pro",
      {},
      1
    );

    await vi.waitFor(() => {
      expect(updateGeneration).toHaveBeenCalledWith(
        "gen-r2fail",
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("R2 Upload fehlgeschlagen"),
        })
      );
    });
  });

  // AC-5: GIVEN count=3 und eine der 3 Generierungen schlaegt fehl
  //        WHEN der Generation-Flow laeuft
  //        THEN werden die anderen 2 Generierungen unabhaengig davon erfolgreich abgeschlossen
  it("AC-5: should process multiple generations independently without aborting on single failure", async () => {
    const gen1 = makeGeneration({ id: "gen-p1" });
    const gen2 = makeGeneration({ id: "gen-p2" });
    const gen3 = makeGeneration({ id: "gen-p3" });

    (createGeneration as Mock)
      .mockResolvedValueOnce(gen1)
      .mockResolvedValueOnce(gen2)
      .mockResolvedValueOnce(gen3);

    // gen1: success, gen2: fail, gen3: success
    (ReplicateClient.run as Mock)
      .mockResolvedValueOnce({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-1",
        seed: 1,
      })
      .mockRejectedValueOnce(new Error("API error for gen2"))
      .mockResolvedValueOnce({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-3",
        seed: 3,
      });

    (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
    (updateGeneration as Mock).mockImplementation((id: string, data: Record<string, unknown>) => {
      return Promise.resolve(makeGeneration({ id, ...data } as Partial<Generation>));
    });

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      "black-forest-labs/flux-2-pro",
      {},
      3
    );

    // Wait for all parallel processing to complete
    await vi.waitFor(() => {
      expect(updateGeneration).toHaveBeenCalledTimes(3);
    });

    // gen1 completed
    expect(updateGeneration).toHaveBeenCalledWith(
      "gen-p1",
      expect.objectContaining({ status: "completed" })
    );
    // gen2 failed
    expect(updateGeneration).toHaveBeenCalledWith(
      "gen-p2",
      expect.objectContaining({ status: "failed" })
    );
    // gen3 completed
    expect(updateGeneration).toHaveBeenCalledWith(
      "gen-p3",
      expect.objectContaining({ status: "completed" })
    );
  });

  // AC-6: GIVEN Replicate liefert ein Nicht-PNG-Format (z.B. WebP)
  //        WHEN der Generation-Flow laeuft
  //        THEN wird der Output vor dem R2-Upload via sharp nach PNG konvertiert
  it("AC-6: should convert non-PNG output to PNG via sharp before uploading to R2", async () => {
    const gen = makeGeneration({ id: "gen-webp" });
    (createGeneration as Mock).mockResolvedValue(gen);

    const convertedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const sharpInst = {
      png: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(convertedPng),
      metadata: vi.fn().mockResolvedValue({ width: 512, height: 512 }),
    };
    (sharp as unknown as Mock).mockReturnValue(sharpInst);

    (ReplicateClient.run as Mock).mockResolvedValue({
      output: bufferToStream(WEBP_BUFFER),
      predictionId: "pred-webp",
      seed: 77,
    });
    (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
    (updateGeneration as Mock).mockResolvedValue(
      makeGeneration({ id: "gen-webp", status: "completed" })
    );

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      "black-forest-labs/flux-2-pro",
      {},
      1
    );

    await vi.waitFor(() => {
      expect(sharp).toHaveBeenCalled();
    });

    // sharp should have been called, and .png().toBuffer() invoked for conversion
    await vi.waitFor(() => {
      expect(sharpInst.png).toHaveBeenCalled();
      expect(sharpInst.toBuffer).toHaveBeenCalled();
    });
  });

  // AC-7: GIVEN eine Generation mit status "failed" und bekannter ID
  //        WHEN retryGeneration({ id }) aufgerufen wird
  //        THEN wird die Generation auf status "pending" zurueckgesetzt und der Generation-Flow erneut gestartet
  it("AC-7: should reset failed generation to pending and re-run the generation flow", async () => {
    const failedGen = makeGeneration({
      id: "gen-retry",
      status: "failed",
      errorMessage: "previous error",
    });
    const resetGen = makeGeneration({
      id: "gen-retry",
      status: "pending",
      errorMessage: null,
    });

    (getGeneration as Mock).mockResolvedValue(failedGen);
    (updateGeneration as Mock)
      .mockResolvedValueOnce(resetGen) // reset to pending
      .mockResolvedValueOnce(makeGeneration({ id: "gen-retry", status: "completed" })); // completed after processing

    (ReplicateClient.run as Mock).mockResolvedValue({
      output: bufferToStream(PNG_BUFFER),
      predictionId: "pred-retry",
      seed: 55,
    });
    (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/retry.png");

    const result = await GenerationService.retry("gen-retry");

    expect(result.status).toBe("pending");
    expect(updateGeneration).toHaveBeenCalledWith("gen-retry", {
      status: "pending",
      errorMessage: null,
    });

    // Verify the flow is re-started (fire-and-forget)
    await vi.waitFor(() => {
      expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
    });
  });

  // AC-8: GIVEN retryGeneration wird mit einer ID aufgerufen, deren Status NICHT "failed" ist
  //        WHEN die Action ausgefuehrt wird
  //        THEN wird ein Fehler geworfen
  it("AC-8: should return error when retrying a generation that is not failed", async () => {
    const completedGen = makeGeneration({
      id: "gen-nofail",
      status: "completed",
    });
    (getGeneration as Mock).mockResolvedValue(completedGen);

    await expect(GenerationService.retry("gen-nofail")).rejects.toThrow(
      "Nur fehlgeschlagene Generierungen koennen wiederholt werden"
    );
  });
});
