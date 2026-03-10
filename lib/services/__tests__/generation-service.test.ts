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
      "",
      undefined,
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
      "",
      undefined,
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
      "",
      undefined,
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
      "",
      undefined,
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
      "",
      undefined,
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
  //       THEN existiert KEIN Import von @/lib/models (kein getModelById)
  it("Slice04-AC-2: should not import from lib/models", () => {
    const filePath = path.resolve(__dirname, "..", "generation-service.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).not.toMatch(/from\s+['"]@\/lib\/models['"]/);
    expect(source).not.toMatch(/require\s*\(\s*['"]@\/lib\/models['"]\s*\)/);
    expect(source).not.toContain("getModelById");
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
      "",
      undefined,
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
        "",
        undefined,
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
        "",
        undefined,
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
    //        AND beide Predictions werden parallel via Promise.allSettled gestartet
    it("AC-2: should create one record per model and start predictions in parallel for two models", async () => {
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
        "",
        undefined,
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

      // AND: parallel via Promise.allSettled — both should be called
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(2);
      });
    });

    // AC-3: GIVEN generateImages wird mit modelIds: ["owner/m1", "owner/m2", "owner/m3"] aufgerufen
    //        WHEN die Server Action ausgefuehrt wird
    //        THEN werden genau 3 Generation-Records erstellt
    //        AND alle 3 Predictions werden parallel via Promise.allSettled gestartet
    it("AC-3: should create one record per model and start predictions in parallel for three models", async () => {
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
        "",
        undefined,
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

      // AND: all 3 predictions started in parallel
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(3);
      });
    });

    // AC-4: GIVEN Multi-Model mit 2 Models: owner/model-a schlaegt fehl, owner/model-b wird erfolgreich
    //        WHEN Promise.allSettled die Ergebnisse zurueckgibt
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
        "",
        undefined,
        ["owner/model-a", "owner/model-b"],
        {},
        1
      );

      // Returns pending records immediately (fire-and-forget processing)
      expect(result).toHaveLength(2);

      // Wait for background allSettled processing to complete
      await vi.waitFor(() => {
        // model-a: processGeneration catches error internally and marks as failed
        // model-b: processGeneration succeeds and marks as completed
        // The allSettled wrapper also handles rejected results
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
          "",
          undefined,
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
          "",
          undefined,
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
          "",
          undefined,
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
        "",
        undefined,
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
});
