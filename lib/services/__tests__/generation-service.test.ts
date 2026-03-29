import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import fs from "fs";
import path from "path";

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
  createGenerationReferences: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
}));

// Mock ModelCatalogService (replaces ModelSchemaService since slice-07)
vi.mock("@/lib/services/model-catalog-service", () => ({
  ModelCatalogService: {
    getSchema: vi.fn(),
  },
}));

// Mock capability-detection — keep real getImg2ImgFieldName (pure function used by buildReplicateInput)
vi.mock("@/lib/services/capability-detection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/capability-detection")>();
  return {
    ...actual,
  };
});

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
import { ModelCatalogService } from "@/lib/services/model-catalog-service";
import sharp from "sharp";

// Previously imported from @/lib/models — module deleted in slice-13 cleanup.
// Constant inlined here for backwards-compatible test assertions.
const UPSCALE_MODEL = "nightmareai/real-esrgan";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A fox",
    promptMotiv: "",
    isFavorite: false,
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
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
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
      ["black-forest-labs/flux-2-pro"],
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
      ["black-forest-labs/flux-2-pro"],
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
      ["black-forest-labs/flux-2-pro"],
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
      ["black-forest-labs/flux-2-pro"],
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
      ["black-forest-labs/flux-2-pro"],
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
      ["black-forest-labs/flux-2-pro"],
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

  // =========================================================================
  // Slice-04 ACs: Remove Whitelist from generation-service
  // =========================================================================

  // AC-2: GIVEN generation-service.ts nach dem Refactoring
  //       WHEN die Datei inspiziert wird
  //       THEN existiert KEIN Import von @/lib/models
  it("Slice04-AC-2: should not import from lib/models", () => {
    const filePath = path.resolve(__dirname, "..", "generation-service.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    // Neither getModelById nor UPSCALE_MODEL should be imported (lib/models.ts deleted in slice-13)
    expect(source).not.toContain("getModelById");
    expect(source).not.toMatch(/@\/lib\/models/);
  });

  // AC-8 (slice-04): GIVEN generation-service.ts nach dem Refactoring
  //       WHEN generate() mit modelId: "newowner/new-model" aufgerufen wird (bisher nicht in der Whitelist)
  //       THEN wird die Generation normal erstellt (kein Whitelist-Reject)
  it("Slice04-AC-8: should accept any valid owner/name model ID and create generation without whitelist reject", async () => {
    const gen = makeGeneration({ id: "gen-new", modelId: "newowner/new-model" });
    (createGeneration as Mock).mockResolvedValue(gen);

    (ReplicateClient.run as Mock).mockResolvedValue({
      output: bufferToStream(PNG_BUFFER),
      predictionId: "pred-new",
      seed: 100,
    });
    (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
    (updateGeneration as Mock).mockResolvedValue(
      makeGeneration({ id: "gen-new", status: "completed" })
    );

    const result = await GenerationService.generate(
      "proj-001",
      "A cat",
      ["newowner/new-model"],
      {},
      1
    );

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("pending");
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "newowner/new-model",
      })
    );
  });

  // AC-9: GIVEN generation-service.ts nach dem Refactoring
  //       WHEN generate() mit modelId: "invalid" aufgerufen wird (ohne /)
  //       THEN wird ein Error geworfen mit Message "Unbekanntes Modell"
  it('Slice04-AC-9: should throw "Unbekanntes Modell" for model ID without slash', async () => {
    await expect(
      GenerationService.generate(
        "proj-001",
        "A cat",
        ["invalid"],
        {},
        1
      )
    ).rejects.toThrow("Unbekanntes Modell");

    expect(createGeneration).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Slice-12 ACs: Parallel Multi-Model Generation
  // =========================================================================

  describe("Slice-12: Parallel Multi-Model Generation", () => {

    // AC-1: GIVEN generateImages wird mit modelIds: ["owner/model-a"] und count: 3 aufgerufen
    //        WHEN die Server Action ausgefuehrt wird
    //        THEN werden genau 3 Generation-Records erstellt (alle mit model_id = "owner/model-a")
    //        AND die Verarbeitung erfolgt sequenziell (bestehende Logik unveraendert)
    it("AC-1: should create count records for single model and process sequentially", async () => {
      const gen1 = makeGeneration({ id: "gen-s1", modelId: "owner/model-a" });
      const gen2 = makeGeneration({ id: "gen-s2", modelId: "owner/model-a" });
      const gen3 = makeGeneration({ id: "gen-s3", modelId: "owner/model-a" });

      (createGeneration as Mock)
        .mockResolvedValueOnce(gen1)
        .mockResolvedValueOnce(gen2)
        .mockResolvedValueOnce(gen3);

      // Mock replicate + storage for background processing
      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-seq",
        seed: 42,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model-a"],
        { width: 1024 },
        3
      );

      // THEN: exactly 3 records created, all with model_id = "owner/model-a"
      expect(result).toHaveLength(3);
      expect(createGeneration).toHaveBeenCalledTimes(3);
      for (const call of (createGeneration as Mock).mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ modelId: "owner/model-a" })
        );
      }

      // AND: sequential processing — wait for fire-and-forget to finish
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(3);
      });

      // Verify all calls used the same model
      for (const call of (ReplicateClient.run as Mock).mock.calls) {
        expect(call[0]).toBe("owner/model-a");
      }
    });

    // AC-2: GIVEN generateImages wird mit modelIds: ["owner/model-a", "owner/model-b"] und count: 1 aufgerufen
    //        WHEN die Server Action ausgefuehrt wird
    //        THEN werden genau 2 Generation-Records erstellt (je einer pro Model-ID)
    //        AND beide Predictions werden sequentiell gestartet
    it("AC-2: should create one record per model and start predictions sequentially for two models", async () => {
      const genA = makeGeneration({ id: "gen-ma", modelId: "owner/model-a" });
      const genB = makeGeneration({ id: "gen-mb", modelId: "owner/model-b" });

      (createGeneration as Mock)
        .mockResolvedValueOnce(genA)
        .mockResolvedValueOnce(genB);

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-multi",
        seed: 10,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model-a", "owner/model-b"],
        {},
        1
      );

      // THEN: exactly 2 records created
      expect(result).toHaveLength(2);
      expect(createGeneration).toHaveBeenCalledTimes(2);

      // First record for model-a, second for model-b
      expect((createGeneration as Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ modelId: "owner/model-a" })
      );
      expect((createGeneration as Mock).mock.calls[1][0]).toEqual(
        expect.objectContaining({ modelId: "owner/model-b" })
      );

      // AND: both predictions should be called sequentially
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(2);
      });
    });

    // AC-3: GIVEN generateImages wird mit modelIds: ["owner/m1", "owner/m2", "owner/m3"] aufgerufen
    //        WHEN die Server Action ausgefuehrt wird
    //        THEN werden genau 3 Generation-Records erstellt
    //        AND alle 3 Predictions werden sequentiell gestartet
    it("AC-3: should create one record per model and start predictions sequentially for three models", async () => {
      const gen1 = makeGeneration({ id: "gen-m1", modelId: "owner/m1" });
      const gen2 = makeGeneration({ id: "gen-m2", modelId: "owner/m2" });
      const gen3 = makeGeneration({ id: "gen-m3", modelId: "owner/m3" });

      (createGeneration as Mock)
        .mockResolvedValueOnce(gen1)
        .mockResolvedValueOnce(gen2)
        .mockResolvedValueOnce(gen3);

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-tri",
        seed: 20,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/m1", "owner/m2", "owner/m3"],
        {},
        1
      );

      // THEN: exactly 3 records created
      expect(result).toHaveLength(3);
      expect(createGeneration).toHaveBeenCalledTimes(3);

      // Each record has the correct model ID
      expect((createGeneration as Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ modelId: "owner/m1" })
      );
      expect((createGeneration as Mock).mock.calls[1][0]).toEqual(
        expect.objectContaining({ modelId: "owner/m2" })
      );
      expect((createGeneration as Mock).mock.calls[2][0]).toEqual(
        expect.objectContaining({ modelId: "owner/m3" })
      );

      // AND: all 3 predictions started sequentially
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(3);
      });
    });

    // AC-4: GIVEN Multi-Model mit 2 Models: owner/model-a schlaegt fehl, owner/model-b wird erfolgreich
    //        WHEN die sequentielle Verarbeitung abgeschlossen ist
    //        THEN wird der Record fuer owner/model-a als fehlgeschlagen markiert
    //        AND der Record fuer owner/model-b enthaelt das Ergebnis-Bild
    //        AND KEIN unbehandelter Error wird geworfen (Partial Failure ist erlaubt)
    it("AC-4: should mark failed model record as failed without affecting successful model record", async () => {
      const genA = makeGeneration({ id: "gen-fail-a", modelId: "owner/model-a" });
      const genB = makeGeneration({ id: "gen-ok-b", modelId: "owner/model-b" });

      (createGeneration as Mock)
        .mockResolvedValueOnce(genA)
        .mockResolvedValueOnce(genB);

      // model-a fails, model-b succeeds
      (ReplicateClient.run as Mock)
        .mockRejectedValueOnce(new Error("Replicate error for model-a"))
        .mockResolvedValueOnce({
          output: bufferToStream(PNG_BUFFER),
          predictionId: "pred-b",
          seed: 55,
        });

      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/ok.png");
      (updateGeneration as Mock).mockImplementation((id: string, data: Record<string, unknown>) => {
        return Promise.resolve(makeGeneration({ id, ...data } as Partial<Generation>));
      });

      // WHEN: should NOT throw — partial failure is allowed
      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model-a", "owner/model-b"],
        {},
        1
      );

      // Returns pending records immediately (fire-and-forget processing)
      expect(result).toHaveLength(2);

      // Wait for background sequential processing to complete
      await vi.waitFor(() => {
        // model-a: processGeneration catches error internally and marks as failed
        // model-b: processGeneration succeeds and marks as completed
        // The sequential loop processes each generation independently
        const updateCalls = (updateGeneration as Mock).mock.calls;
        expect(updateCalls.length).toBeGreaterThanOrEqual(2);
      });

      // Verify model-b was completed successfully
      expect(updateGeneration).toHaveBeenCalledWith(
        "gen-ok-b",
        expect.objectContaining({ status: "completed" })
      );

      // Verify model-a was marked as failed
      expect(updateGeneration).toHaveBeenCalledWith(
        "gen-fail-a",
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("Replicate error for model-a"),
        })
      );
    });

    // AC-5: GIVEN generateImages wird mit modelIds: [] (leeres Array) aufgerufen
    //        WHEN die Validierung in der Server Action ausgefuehrt wird
    //        THEN wird ein Validierungsfehler "1-3 Modelle muessen ausgewaehlt sein" zurueckgegeben
    //        AND KEIN Generation-Record wird erstellt
    it('AC-5: should throw validation error for empty modelIds array', async () => {
      await expect(
        GenerationService.generate(
          "proj-001",
          "A fox",
          [],
          {},
          1
        )
      ).rejects.toThrow("1-3 Modelle muessen ausgewaehlt sein");

      expect(createGeneration).not.toHaveBeenCalled();
    });

    // AC-6: GIVEN generateImages wird mit modelIds: ["m1", "m2", "m3", "m4"] (4 IDs) aufgerufen
    //        WHEN die Validierung in der Server Action ausgefuehrt wird
    //        THEN wird ein Validierungsfehler "1-3 Modelle muessen ausgewaehlt sein" zurueckgegeben
    //        AND KEIN Generation-Record wird erstellt
    it('AC-6: should throw validation error when more than three model IDs are provided', async () => {
      await expect(
        GenerationService.generate(
          "proj-001",
          "A fox",
          ["owner/m1", "owner/m2", "owner/m3", "owner/m4"],
          {},
          1
        )
      ).rejects.toThrow("1-3 Modelle muessen ausgewaehlt sein");

      expect(createGeneration).not.toHaveBeenCalled();
    });

    // AC-7: GIVEN generateImages wird mit modelIds: ["UPPER/Case"] aufgerufen (ungueltige Format)
    //        WHEN die Validierung in der Server Action ausgefuehrt wird
    //        THEN wird ein Validierungsfehler zurueckgegeben (ID entspricht nicht ^[a-z0-9-]+/[a-z0-9._-]+$)
    //        AND KEIN Generation-Record wird erstellt
    it('AC-7: should throw validation error for model ID not matching owner/name regex', async () => {
      await expect(
        GenerationService.generate(
          "proj-001",
          "A fox",
          ["UPPER/Case"],
          {},
          1
        )
      ).rejects.toThrow("Unbekanntes Modell");

      expect(createGeneration).not.toHaveBeenCalled();
    });

    // AC-8: GIVEN generateImages wird mit modelIds: ["owner/model-a", "owner/model-b"] aufgerufen
    //        WHEN die Multi-Model-Verarbeitung startet
    //        THEN wird jeder Generation-Record mit params: {} (leeres Objekt als Default-Params) erstellt
    //        AND count wird ignoriert (jedes Model erhaelt genau 1 Record)
    it("AC-8: should use empty params object and create exactly one record per model in multi-model mode", async () => {
      const genA = makeGeneration({ id: "gen-pa", modelId: "owner/model-a", modelParams: {} });
      const genB = makeGeneration({ id: "gen-pb", modelId: "owner/model-b", modelParams: {} });

      (createGeneration as Mock)
        .mockResolvedValueOnce(genA)
        .mockResolvedValueOnce(genB);

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-p",
        seed: 30,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/img.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model-a", "owner/model-b"],
        { width: 1024, height: 768 },  // custom params passed — should be IGNORED in multi-model
        4  // count=4 passed — should be IGNORED in multi-model
      );

      // THEN: exactly 2 records (one per model), NOT 4
      expect(result).toHaveLength(2);
      expect(createGeneration).toHaveBeenCalledTimes(2);

      // Each record created with params: {} (empty default), not the custom params
      for (const call of (createGeneration as Mock).mock.calls) {
        expect(call[0].modelParams).toEqual({});
      }
    });
  });

  // -------------------------------------------------------------------------
  // Slice-06: img2img Generation Service Extension
  // -------------------------------------------------------------------------

  describe("img2img extension (slice-06)", () => {
    const SOURCE_IMAGE_URL = "https://r2.example.com/source/image.png";

    /** Helper: set up standard mocks for fire-and-forget processing */
    function setupProcessingMocks() {
      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-img2img",
        seed: 42,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));
    }

    // AC-1: GIVEN ein generate()-Aufruf ohne generationMode, sourceImageUrl oder strength
    //       WHEN createGeneration innerhalb des Service aufgerufen wird
    //       THEN enthaelt der uebergebene Input generationMode: "txt2img", sourceImageUrl: null
    it('AC-1 (img2img): should pass generationMode txt2img to createGeneration when called without mode', async () => {
      const gen = makeGeneration({ id: "gen-txt-default" });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupProcessingMocks();

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        1
      );

      expect(createGeneration).toHaveBeenCalledTimes(1);
      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "txt2img",
          sourceImageUrl: null,
        })
      );
    });

    // AC-2: GIVEN ein generate()-Aufruf mit generationMode: "img2img", einer validen sourceImageUrl und strength: 0.6
    //       WHEN createGeneration innerhalb des Service aufgerufen wird
    //       THEN enthaelt der uebergebene Input generationMode: "img2img" und die uebergebene sourceImageUrl
    it('AC-2 (img2img): should pass generationMode img2img and sourceImageUrl to createGeneration', async () => {
      const gen = makeGeneration({
        id: "gen-img2img",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelParams: { prompt_strength: 0.6 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupProcessingMocks();
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({ image: {} });

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        1,
        "img2img",
        SOURCE_IMAGE_URL,
        0.6
      );

      expect(createGeneration).toHaveBeenCalledTimes(1);
      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "img2img",
          sourceImageUrl: SOURCE_IMAGE_URL,
        })
      );
    });

    // AC-3: GIVEN ein generate()-Aufruf mit generationMode: "img2img", sourceImageUrl und strength: 0.6,
    //       und das Modell-Schema enthaelt den Parameter "image"
    //       WHEN buildReplicateInput den Replicate-Input aufbaut
    //       THEN enthaelt der Input image: <sourceImageUrl> und prompt_strength: 0.6; prompt bleibt erhalten
    it('AC-3 (img2img): should set image and prompt_strength in replicate input when schema has image parameter', async () => {
      const gen = makeGeneration({
        id: "gen-schema-image",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelParams: { prompt_strength: 0.6 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({
        image: { type: "string", format: "uri" },
        prompt: { type: "string" },
      });

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-schema-img",
        seed: 10,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        1,
        "img2img",
        SOURCE_IMAGE_URL,
        0.6
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput.image).toBe(SOURCE_IMAGE_URL);
      expect(replicateInput.prompt_strength).toBe(0.6);
      expect(replicateInput.prompt).toBeDefined();
      // negative_prompt is no longer sent to the Replicate API
      expect(replicateInput).not.toHaveProperty("negative_prompt");
    });

    // AC-4: GIVEN ein generate()-Aufruf mit generationMode: "img2img", sourceImageUrl und strength: 0.4,
    //       und das Modell-Schema enthaelt den Parameter "image_prompt" (nicht "image")
    //       WHEN buildReplicateInput den Replicate-Input aufbaut
    //       THEN enthaelt der Input image_prompt: <sourceImageUrl> und prompt_strength: 0.4 (nicht image:)
    it('AC-4 (img2img): should set image_prompt and prompt_strength when schema has image_prompt parameter', async () => {
      const gen = makeGeneration({
        id: "gen-schema-imgprompt",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelParams: { prompt_strength: 0.4 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({
        image_prompt: { type: "string", format: "uri" },
        prompt: { type: "string" },
      });

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-schema-imgp",
        seed: 20,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        1,
        "img2img",
        SOURCE_IMAGE_URL,
        0.4
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput.image_prompt).toBe(SOURCE_IMAGE_URL);
      expect(replicateInput.prompt_strength).toBe(0.4);
      expect(replicateInput).not.toHaveProperty("image");
    });

    // AC-5: GIVEN ein generate()-Aufruf mit generationMode: "img2img", sourceImageUrl und strength: 0.85,
    //       und das Modell-Schema enthaelt den Parameter "init_image" (weder "image" noch "image_prompt")
    //       WHEN buildReplicateInput den Replicate-Input aufbaut
    //       THEN enthaelt der Input init_image: <sourceImageUrl> und prompt_strength: 0.85
    it('AC-5 (img2img): should set init_image and prompt_strength when schema has init_image parameter', async () => {
      const gen = makeGeneration({
        id: "gen-schema-initimg",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelParams: { prompt_strength: 0.85 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({
        init_image: { type: "string", format: "uri" },
        prompt: { type: "string" },
      });

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-schema-init",
        seed: 30,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        1,
        "img2img",
        SOURCE_IMAGE_URL,
        0.85
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput.init_image).toBe(SOURCE_IMAGE_URL);
      expect(replicateInput.prompt_strength).toBe(0.85);
      expect(replicateInput).not.toHaveProperty("image");
      expect(replicateInput).not.toHaveProperty("image_prompt");
    });

    // AC-6: GIVEN ein generate()-Aufruf mit generationMode: "img2img" aber ohne sourceImageUrl
    //       WHEN die Validierung in generate() greift
    //       THEN wirft die Funktion einen Error mit der Meldung "Source-Image ist erforderlich fuer img2img"
    it('AC-6 (img2img): should throw "Source-Image ist erforderlich fuer img2img" when sourceImageUrl is missing', async () => {
      await expect(
        GenerationService.generate(
          "proj-001",
          "A fox",
          ["black-forest-labs/flux-2-pro"],
          {},
          1,
          "img2img",
          undefined, // no sourceImageUrl
          0.6
        )
      ).rejects.toThrow("Source-Image ist erforderlich fuer img2img");
    });

    // AC-7: GIVEN ein generate()-Aufruf mit generationMode: "img2img", sourceImageUrl und strength: 1.5 (ausserhalb 0.0-1.0)
    //       WHEN die Validierung in generate() greift
    //       THEN wirft die Funktion einen Error mit der Meldung "Strength muss zwischen 0 und 1 liegen"
    it('AC-7 (img2img): should throw "Strength muss zwischen 0 und 1 liegen" when strength is out of range', async () => {
      await expect(
        GenerationService.generate(
          "proj-001",
          "A fox",
          ["black-forest-labs/flux-2-pro"],
          {},
          1,
          "img2img",
          SOURCE_IMAGE_URL,
          1.5
        )
      ).rejects.toThrow("Strength muss zwischen 0 und 1 liegen");
    });

    // AC-8: GIVEN ein generate()-Aufruf mit generationMode: "txt2img" (oder ohne generationMode) und einem Prompt
    //       WHEN buildReplicateInput den Replicate-Input aufbaut
    //       THEN enthaelt der Input weder image noch image_prompt noch init_image noch prompt_strength
    it('AC-8 (img2img): should not include image, image_prompt, init_image or prompt_strength in txt2img replicate input', async () => {
      const gen = makeGeneration({ id: "gen-txt2img-clean" });
      (createGeneration as Mock).mockResolvedValue(gen);

      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-txt2img",
        seed: 50,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        1
        // no generationMode, no sourceImageUrl, no strength
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput).not.toHaveProperty("image");
      expect(replicateInput).not.toHaveProperty("image_prompt");
      expect(replicateInput).not.toHaveProperty("init_image");
      expect(replicateInput).not.toHaveProperty("prompt_strength");
    });

    // AC-9: GIVEN ein generate()-Aufruf mit generationMode: "img2img", sourceImageUrl, strength: 0.6 und count: 3
    //       WHEN createGeneration intern aufgerufen wird
    //       THEN wird createGeneration genau 3 Mal mit identischer generationMode und sourceImageUrl aufgerufen
    it('AC-9 (img2img): should call createGeneration N times each with the same generationMode and sourceImageUrl', async () => {
      const gen1 = makeGeneration({ id: "gen-batch-1", generationMode: "img2img", sourceImageUrl: SOURCE_IMAGE_URL });
      const gen2 = makeGeneration({ id: "gen-batch-2", generationMode: "img2img", sourceImageUrl: SOURCE_IMAGE_URL });
      const gen3 = makeGeneration({ id: "gen-batch-3", generationMode: "img2img", sourceImageUrl: SOURCE_IMAGE_URL });

      (createGeneration as Mock)
        .mockResolvedValueOnce(gen1)
        .mockResolvedValueOnce(gen2)
        .mockResolvedValueOnce(gen3);

      setupProcessingMocks();
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({ image: {} });

      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        ["black-forest-labs/flux-2-pro"],
        {},
        3,
        "img2img",
        SOURCE_IMAGE_URL,
        0.6
      );

      expect(result).toHaveLength(3);
      expect(createGeneration).toHaveBeenCalledTimes(3);

      // All 3 calls should have the same generationMode and sourceImageUrl
      for (let i = 0; i < 3; i++) {
        expect(createGeneration).toHaveBeenNthCalledWith(
          i + 1,
          expect.objectContaining({
            generationMode: "img2img",
            sourceImageUrl: SOURCE_IMAGE_URL,
          })
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // Slice-07: upscale() Methode
  // -------------------------------------------------------------------------

  describe("upscale (slice-07)", () => {
    const SOURCE_IMAGE_URL = "https://r2.example.com/source/upscale-input.png";

    /** Helper: set up standard mocks for upscale fire-and-forget processing */
    function setupUpscaleProcessingMocks() {
      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-upscale",
        seed: 100,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/upscaled.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));
    }

    // AC-1: GIVEN upscale({ projectId, sourceImageUrl, scale: 2 }) ohne sourceGenerationId
    //       WHEN die Methode aufgerufen wird
    //       THEN ruft ReplicateClient.run mit dem Modell-String "nightmareai/real-esrgan" auf,
    //       und der erstellte DB-Record hat prompt: "Upscale 2x"
    it('AC-1: should call ReplicateClient.run with nightmareai/real-esrgan and prompt "Upscale 2x" when scale is 2', async () => {
      const gen = makeGeneration({
        id: "gen-up-1",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        prompt: "Upscale 2x",
        modelId: UPSCALE_MODEL,
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupUpscaleProcessingMocks();

      await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 2 },
      });

      // Verify createGeneration was called with correct prompt
      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Upscale 2x",
          modelId: UPSCALE_MODEL,
        })
      );

      // Verify ReplicateClient.run is called with UPSCALE_MODEL
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });
      expect(ReplicateClient.run).toHaveBeenCalledWith(
        UPSCALE_MODEL,
        expect.any(Object)
      );

      // Also confirm UPSCALE_MODEL equals the expected string
      expect(UPSCALE_MODEL).toBe("nightmareai/real-esrgan");
    });

    // AC-2: GIVEN upscale({ projectId, sourceImageUrl, scale: 4 }) ohne sourceGenerationId
    //       WHEN die Methode aufgerufen wird
    //       THEN hat der erstellte DB-Record prompt: "Upscale 4x"
    it('AC-2: should set prompt to "Upscale 4x" when scale is 4', async () => {
      const gen = makeGeneration({
        id: "gen-up-2",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        prompt: "Upscale 4x",
        modelId: UPSCALE_MODEL,
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupUpscaleProcessingMocks();

      await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 4,
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 4 },
      });

      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Upscale 4x",
        })
      );
    });

    // AC-3: GIVEN upscale({ projectId, sourceImageUrl, scale: 2, sourceGenerationId })
    //       und die Quell-Generation hat prompt: "a red fox"
    //       WHEN die Methode aufgerufen wird
    //       THEN hat der erstellte DB-Record prompt: "a red fox (Upscale 2x)"
    it('AC-3: should compose prompt from source generation prompt when sourceGenerationId is provided', async () => {
      const sourceGen = makeGeneration({
        id: "gen-source",
        prompt: "a red fox",
      });
      (getGeneration as Mock).mockResolvedValue(sourceGen);

      const gen = makeGeneration({
        id: "gen-up-3",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        sourceGenerationId: "gen-source",
        prompt: "a red fox (Upscale 2x)",
        modelId: UPSCALE_MODEL,
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupUpscaleProcessingMocks();

      await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        sourceGenerationId: "gen-source",
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 2 },
      });

      // Verify getGeneration was called with sourceGenerationId
      expect(getGeneration).toHaveBeenCalledWith("gen-source");

      // Verify createGeneration was called with the composed prompt
      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "a red fox (Upscale 2x)",
        })
      );
    });

    // AC-4: GIVEN ein valider upscale()-Aufruf mit beliebigen Parametern
    //       WHEN die Methode aufgerufen wird
    //       THEN enthaelt der zurueckgegebene Record genau generationMode: "upscale",
    //       sourceImageUrl mit dem uebergebenen Wert und sourceGenerationId (null oder uebergebener Wert)
    it('AC-4: should create record with generationMode upscale, sourceImageUrl and sourceGenerationId', async () => {
      const gen = makeGeneration({
        id: "gen-up-4",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        sourceGenerationId: "gen-source-4",
        modelId: UPSCALE_MODEL,
        prompt: "some prompt (Upscale 2x)",
      });
      const sourceGen = makeGeneration({ id: "gen-source-4", prompt: "some prompt" });
      (getGeneration as Mock).mockResolvedValue(sourceGen);
      (createGeneration as Mock).mockResolvedValue(gen);
      setupUpscaleProcessingMocks();

      const result = await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        sourceGenerationId: "gen-source-4",
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 2 },
      });

      // Verify createGeneration received correct fields
      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "upscale",
          sourceImageUrl: SOURCE_IMAGE_URL,
          sourceGenerationId: "gen-source-4",
        })
      );

      // Verify the returned record
      expect(result.generationMode).toBe("upscale");
      expect(result.sourceImageUrl).toBe(SOURCE_IMAGE_URL);
      expect(result.sourceGenerationId).toBe("gen-source-4");

      // Also test with null sourceGenerationId
      vi.clearAllMocks();
      const genNoSource = makeGeneration({
        id: "gen-up-4b",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        sourceGenerationId: null,
        modelId: UPSCALE_MODEL,
        prompt: "Upscale 2x",
      });
      (createGeneration as Mock).mockResolvedValue(genNoSource);
      setupUpscaleProcessingMocks();

      const result2 = await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 2 },
      });

      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "upscale",
          sourceImageUrl: SOURCE_IMAGE_URL,
          sourceGenerationId: null,
        })
      );
      expect(result2.generationMode).toBe("upscale");
      expect(result2.sourceImageUrl).toBe(SOURCE_IMAGE_URL);
      expect(result2.sourceGenerationId).toBeNull();
    });

    // AC-5: GIVEN ein valider upscale()-Aufruf
    //       WHEN die Methode aufgerufen wird
    //       THEN gibt sie genau 1 Generation-Objekt mit status: "pending" zurueck (kein Array)
    it('AC-5: should return exactly 1 pending Generation object (not an array)', async () => {
      const gen = makeGeneration({
        id: "gen-up-5",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        status: "pending",
        modelId: UPSCALE_MODEL,
        prompt: "Upscale 2x",
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupUpscaleProcessingMocks();

      const result = await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 2 },
      });

      // Must be a single object, not an array
      expect(Array.isArray(result)).toBe(false);
      expect(result).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.id).toBe("gen-up-5");
    });

    // AC-6: GIVEN ReplicateClient.run gibt ein output-Stream-Objekt zurueck
    //       WHEN upscale() die Verarbeitung fire-and-forget startet
    //       THEN wird ReplicateClient.run mit { image: sourceImageUrl, scale } als Input aufgerufen
    //       (kein prompt-Feld im Replicate-Input)
    it('AC-6: should call ReplicateClient.run with { image, scale } input without prompt field', async () => {
      const gen = makeGeneration({
        id: "gen-up-6",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelId: UPSCALE_MODEL,
        prompt: "Upscale 2x",
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      setupUpscaleProcessingMocks();

      await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        modelId: UPSCALE_MODEL,
        modelParams: {},
      });

      // Wait for fire-and-forget to call ReplicateClient.run
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const [model, input] = (ReplicateClient.run as Mock).mock.calls[0];
      expect(model).toBe(UPSCALE_MODEL);
      expect(input).toEqual({ image: SOURCE_IMAGE_URL, scale: 2 });
      // Explicitly verify no prompt field in the Replicate input
      expect(input).not.toHaveProperty("prompt");
    });

    // AC-7: GIVEN ReplicateClient.run wirft einen Fehler waehrend der Verarbeitung
    //       WHEN der fire-and-forget Prozess den Fehler erhaelt
    //       THEN wird updateGeneration mit status: "failed" aufgerufen und die Methode upscale()
    //       selbst wirft keinen Fehler (Fire-and-forget bleibt isoliert)
    it('AC-7: should mark generation as failed when ReplicateClient throws, without propagating the error', async () => {
      const gen = makeGeneration({
        id: "gen-up-7",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelId: UPSCALE_MODEL,
        prompt: "Upscale 2x",
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ReplicateClient.run as Mock).mockRejectedValue(new Error("Replicate upscale error"));
      (updateGeneration as Mock).mockResolvedValue(
        makeGeneration({ id: "gen-up-7", status: "failed", errorMessage: "Replicate upscale error" })
      );

      // upscale() itself should NOT throw despite the background error
      const result = await GenerationService.upscale({
        projectId: "proj-001",
        sourceImageUrl: SOURCE_IMAGE_URL,
        scale: 2,
        modelId: UPSCALE_MODEL,
        modelParams: { scale: 2 },
      });

      // The returned record is still pending (returned before fire-and-forget completes)
      expect(result).toBeDefined();
      expect(result.status).toBe("pending");

      // Wait for fire-and-forget to complete and verify the generation was marked as failed
      await vi.waitFor(() => {
        expect(updateGeneration).toHaveBeenCalledWith(
          "gen-up-7",
          expect.objectContaining({
            status: "failed",
            errorMessage: expect.stringContaining("Replicate upscale error"),
          })
        );
      });
    });

    // AC-8: GIVEN upscale() wird mit scale: 3 (ungueltiger Wert) aufgerufen
    //       WHEN die Methode aufgerufen wird
    //       THEN wirft sie einen Error (keine DB-Record-Erstellung, kein Replicate-Call)
    it('AC-8: should throw an error when scale is not 2 or 4', async () => {
      await expect(
        GenerationService.upscale({
          projectId: "proj-001",
          sourceImageUrl: SOURCE_IMAGE_URL,
          scale: 3 as unknown as 2 | 4,
          modelId: UPSCALE_MODEL,
          modelParams: { scale: 2 },
        })
      ).rejects.toThrow();

      // Verify no DB record was created and no Replicate call was made
      expect(createGeneration).not.toHaveBeenCalled();
      expect(ReplicateClient.run).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Slice-07: Service-Ersetzung — buildReplicateInput uses ModelCatalogService
  // =========================================================================

  describe("buildReplicateInput (ModelCatalogService integration) [slice-07]", () => {
    const SOURCE_IMAGE_URL = "https://r2.example.com/source/image.png";

    /** Helper: set up standard mocks for fire-and-forget processing */
    function setupProcessingMocks07() {
      (ReplicateClient.run as Mock).mockResolvedValue({
        output: bufferToStream(PNG_BUFFER),
        predictionId: "pred-s07",
        seed: 42,
      });
      (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
      (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));
    }

    // AC-1: GIVEN generation-service.ts importiert ModelCatalogService statt ModelSchemaService
    //       WHEN buildReplicateInput() fuer ein img2img-Generation mit modelId = "owner/model" aufgerufen wird
    //       THEN wird ModelCatalogService.getSchema("owner/model") aufgerufen (NICHT ModelSchemaService.getSchema())
    //       und das zurueckgegebene Schema an getImg2ImgFieldName() uebergeben
    it('AC-1: should call ModelCatalogService.getSchema instead of ModelSchemaService.getSchema for img2img', async () => {
      const gen = makeGeneration({
        id: "gen-s07-ac1",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelId: "owner/model",
        modelParams: { prompt_strength: 0.6 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({
        image: { type: "string" },
        prompt: { type: "string" },
      });
      setupProcessingMocks07();

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model"],
        {},
        1,
        "img2img",
        SOURCE_IMAGE_URL,
        0.6
      );

      // Wait for fire-and-forget processing
      await vi.waitFor(() => {
        expect(ModelCatalogService.getSchema).toHaveBeenCalledTimes(1);
      });

      // Verify ModelCatalogService.getSchema was called with the model ID
      expect(ModelCatalogService.getSchema).toHaveBeenCalledWith("owner/model");

      // Verify Replicate was called with the resolved image field from getImg2ImgFieldName
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });
      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput.image).toBe(SOURCE_IMAGE_URL);
    });

    // AC-2: GIVEN generation-service.ts importiert getImg2ImgFieldName aus capability-detection.ts
    //       WHEN die Imports der Datei geprueft werden
    //       THEN existiert KEIN Import von model-schema-service mehr
    it('AC-2: should not import from model-schema-service', () => {
      const filePath = path.resolve(__dirname, "..", "generation-service.ts");
      const source = fs.readFileSync(filePath, "utf-8");

      // Must NOT import from model-schema-service
      expect(source).not.toMatch(/from\s+['"]@\/lib\/services\/model-schema-service['"]/);
      expect(source).not.toContain("model-schema-service");

      // Must import from model-catalog-service and capability-detection
      expect(source).toMatch(/from\s+['"]@\/lib\/services\/model-catalog-service['"]/);
      expect(source).toMatch(/from\s+['"]@\/lib\/services\/capability-detection['"]/);
    });

    // AC-3: GIVEN ein Model mit Schema { input_images: { type: "array" }, prompt: { type: "string" } } in der DB
    //       WHEN buildReplicateInput() fuer eine img2img-Generation mit 2 References aufgerufen wird
    //       THEN wird input_images als Feld-Key verwendet und die Reference-URLs als Array zugewiesen
    it('AC-3: should assign reference URLs as array to input_images field', async () => {
      const refs = [
        { referenceImageId: "ref-1", imageUrl: "https://r2.example.com/ref1.png", role: "style", strength: "medium", slotPosition: 1, width: 512, height: 512 },
        { referenceImageId: "ref-2", imageUrl: "https://r2.example.com/ref2.png", role: "composition", strength: "strong", slotPosition: 2, width: 512, height: 512 },
      ];
      const gen = makeGeneration({
        id: "gen-s07-ac3",
        generationMode: "img2img",
        sourceImageUrl: null,
        modelId: "owner/model",
        modelParams: { prompt_strength: 0.6 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      // Mock createGenerationReferences (needed for references path)
      const { createGenerationReferences } = await import("@/lib/db/queries");
      (createGenerationReferences as Mock).mockResolvedValue([]);
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({
        input_images: { type: "array" },
        prompt: { type: "string" },
      });
      setupProcessingMocks07();

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model"],
        {},
        1,
        "img2img",
        undefined,
        0.6,
        refs
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      // input_images should be an array of reference URLs sorted by slotPosition
      expect(replicateInput.input_images).toEqual([
        "https://r2.example.com/ref1.png",
        "https://r2.example.com/ref2.png",
      ]);
    });

    // AC-4: GIVEN ein Model mit Schema { image: { type: "string" }, prompt: { type: "string" } } in der DB
    //       und eine einzelne sourceImageUrl
    //       WHEN buildReplicateInput() fuer eine img2img-Generation ohne References aufgerufen wird
    //       THEN wird image als Feld-Key verwendet und sourceImageUrl als einzelner String zugewiesen
    it('AC-4: should assign sourceImageUrl as single string to image field', async () => {
      const gen = makeGeneration({
        id: "gen-s07-ac4",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelId: "owner/model",
        modelParams: { prompt_strength: 0.6 },
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ModelCatalogService.getSchema as Mock).mockResolvedValue({
        image: { type: "string" },
        prompt: { type: "string" },
      });
      setupProcessingMocks07();

      await GenerationService.generate(
        "proj-001",
        "A fox",
        ["owner/model"],
        {},
        1,
        "img2img",
        SOURCE_IMAGE_URL,
        0.6
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      // image field should be a single string (not array) for backwards-compatibility
      expect(replicateInput.image).toBe(SOURCE_IMAGE_URL);
      expect(typeof replicateInput.image).toBe("string");
    });
  });
});
