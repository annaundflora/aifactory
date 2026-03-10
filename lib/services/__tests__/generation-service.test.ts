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

// Mock ModelSchemaService
vi.mock("@/lib/services/model-schema-service", () => ({
  ModelSchemaService: {
    getSchema: vi.fn(),
    supportsImg2Img: vi.fn(),
    clearCache: vi.fn(),
  },
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
import { ModelSchemaService } from "@/lib/services/model-schema-service";
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
        "",
        undefined,
        "black-forest-labs/flux-2-pro",
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
      (ModelSchemaService.getSchema as Mock).mockResolvedValue({ image: {} });

      await GenerationService.generate(
        "proj-001",
        "A fox",
        "",
        undefined,
        "black-forest-labs/flux-2-pro",
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
    //       THEN enthaelt der Input image: <sourceImageUrl> und prompt_strength: 0.6; prompt und negative_prompt bleiben erhalten
    it('AC-3 (img2img): should set image and prompt_strength in replicate input when schema has image parameter', async () => {
      const gen = makeGeneration({
        id: "gen-schema-image",
        generationMode: "img2img",
        sourceImageUrl: SOURCE_IMAGE_URL,
        modelParams: { prompt_strength: 0.6 },
        negativePrompt: "blurry",
      });
      (createGeneration as Mock).mockResolvedValue(gen);
      (ModelSchemaService.getSchema as Mock).mockResolvedValue({
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
        "",
        "blurry",
        "black-forest-labs/flux-2-pro",
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
      expect(replicateInput.negative_prompt).toBe("blurry");
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
      (ModelSchemaService.getSchema as Mock).mockResolvedValue({
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
        "",
        undefined,
        "black-forest-labs/flux-2-pro",
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
      (ModelSchemaService.getSchema as Mock).mockResolvedValue({
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
        "",
        undefined,
        "black-forest-labs/flux-2-pro",
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
          "",
          undefined,
          "black-forest-labs/flux-2-pro",
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
          "",
          undefined,
          "black-forest-labs/flux-2-pro",
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
        "",
        undefined,
        "black-forest-labs/flux-2-pro",
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
      (ModelSchemaService.getSchema as Mock).mockResolvedValue({ image: {} });

      const result = await GenerationService.generate(
        "proj-001",
        "A fox",
        "",
        undefined,
        "black-forest-labs/flux-2-pro",
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
});
