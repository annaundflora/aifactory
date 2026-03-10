import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Shared mock for S3Client.send
const mockSend = vi.fn();

// Track PutObjectCommand and DeleteObjectCommand calls
const putObjectCalls: Record<string, unknown>[] = [];
const deleteObjectCalls: Record<string, unknown>[] = [];

vi.mock("@aws-sdk/client-s3", () => {
  // S3Client must be a constructor
  function MockS3Client() {
    return { send: mockSend };
  }

  // PutObjectCommand must be a constructor
  function MockPutObjectCommand(input: Record<string, unknown>) {
    putObjectCalls.push(input);
    return { ...input, _commandName: "PutObjectCommand" };
  }

  // DeleteObjectCommand must be a constructor
  function MockDeleteObjectCommand(input: Record<string, unknown>) {
    deleteObjectCalls.push(input);
    return { ...input, _commandName: "DeleteObjectCommand" };
  }

  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
  };
});

import { upload, deleteObject, StorageService } from "../storage";

describe("StorageService", () => {
  const originalEnv = process.env;

  const validEnv = {
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_ENDPOINT: "https://r2.example.com",
    R2_PUBLIC_URL: "https://cdn.example.com",
    R2_BUCKET_NAME: "test-bucket",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    putObjectCalls.length = 0;
    deleteObjectCalls.length = 0;
    process.env = { ...originalEnv, ...validEnv };
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createTestStream(
    data: Uint8Array = new Uint8Array([1, 2, 3])
  ): ReadableStream {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  /**
   * AC-5: GIVEN ein ReadableStream und ein Storage-Key "projects/{projectId}/{generationId}.png"
   * WHEN StorageService.upload(stream, key) aufgerufen wird
   * THEN wird das Objekt via S3 PutObject nach R2 hochgeladen und die Public URL
   *      im Format {R2_PUBLIC_URL}/{key} zurueckgegeben
   */
  it("AC-5: should upload stream via PutObject and return public URL in correct format", async () => {
    const stream = createTestStream();
    const key = "projects/proj-123/gen-456.png";

    const result = await upload(stream, key);

    // Should return correct public URL
    expect(result).toBe(
      "https://cdn.example.com/projects/proj-123/gen-456.png"
    );

    // Should have called S3 send (PutObject)
    expect(mockSend).toHaveBeenCalledTimes(1);

    // PutObjectCommand was constructed with correct params
    expect(putObjectCalls).toHaveLength(1);
    expect(putObjectCalls[0]).toMatchObject({
      Bucket: "test-bucket",
      Key: key,
    });
  });

  /**
   * AC-5 (variant): Trailing slash in R2_PUBLIC_URL is stripped
   */
  it("AC-5 (variant): should strip trailing slashes from R2_PUBLIC_URL", async () => {
    process.env.R2_PUBLIC_URL = "https://cdn.example.com///";
    const stream = createTestStream();
    const key = "projects/proj-1/gen-1.png";

    const result = await upload(stream, key);

    expect(result).toBe("https://cdn.example.com/projects/proj-1/gen-1.png");
  });

  /**
   * AC-6: GIVEN ein Storage-Key "projects/{projectId}/{generationId}.png"
   * WHEN StorageService.delete(key) aufgerufen wird
   * THEN wird das Objekt via S3 DeleteObject aus R2 entfernt
   */
  it("AC-6: should delete object via DeleteObject", async () => {
    const key = "projects/proj-123/gen-456.png";

    await deleteObject(key);

    expect(mockSend).toHaveBeenCalledTimes(1);

    // DeleteObjectCommand was constructed with correct params
    expect(deleteObjectCalls).toHaveLength(1);
    expect(deleteObjectCalls[0]).toMatchObject({
      Bucket: "test-bucket",
      Key: key,
    });
  });

  /**
   * AC-7: GIVEN der R2-Upload schlaegt fehl (z.B. Netzwerkfehler)
   * WHEN StorageService.upload() aufgerufen wird
   * THEN wird ein Error mit einer aussagekraeftigen Fehlermeldung geworfen
   */
  it("AC-7: should throw error with descriptive message on upload failure", async () => {
    mockSend.mockRejectedValue(new Error("Network timeout"));
    const stream = createTestStream();

    await expect(
      upload(stream, "projects/proj-1/gen-1.png")
    ).rejects.toThrow(/R2 Upload fehlgeschlagen/);

    // Reset and test again to verify the original error message is included
    mockSend.mockRejectedValue(new Error("Connection refused"));
    const stream2 = createTestStream();

    await expect(
      upload(stream2, "projects/proj-1/gen-1.png")
    ).rejects.toThrow(/Connection refused/);
  });

  /**
   * AC-8: GIVEN StorageService.upload() wird aufgerufen
   * WHEN der Upload erfolgreich ist
   * THEN hat der PutObject-Call den ContentType auf "image/png" gesetzt
   */
  it("AC-8: should set ContentType to image/png on PutObject call", async () => {
    const stream = createTestStream();

    await upload(stream, "projects/proj-1/gen-1.png");

    expect(putObjectCalls).toHaveLength(1);
    expect(putObjectCalls[0]).toMatchObject({
      ContentType: "image/png",
    });
  });

  /**
   * AC-10: GIVEN der StorageService wird instanziiert
   * WHEN die Umgebungsvariablen R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
   *      R2_ENDPOINT oder R2_PUBLIC_URL nicht gesetzt sind
   * THEN wird ein Fehler geworfen
   */
  it("AC-10: should throw error when R2_ACCESS_KEY_ID is not set", async () => {
    delete process.env.R2_ACCESS_KEY_ID;
    const stream = createTestStream();

    await expect(upload(stream, "test.png")).rejects.toThrow(
      /R2_ACCESS_KEY_ID/
    );
  });

  it("AC-10: should throw error when R2_SECRET_ACCESS_KEY is not set", async () => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    const stream = createTestStream();

    await expect(upload(stream, "test.png")).rejects.toThrow(
      /R2_SECRET_ACCESS_KEY/
    );
  });

  it("AC-10: should throw error when R2_ENDPOINT is not set", async () => {
    delete process.env.R2_ENDPOINT;
    const stream = createTestStream();

    await expect(upload(stream, "test.png")).rejects.toThrow(/R2_ENDPOINT/);
  });

  it("AC-10: should throw error when R2_PUBLIC_URL is not set", async () => {
    delete process.env.R2_PUBLIC_URL;
    const stream = createTestStream();

    await expect(upload(stream, "test.png")).rejects.toThrow(/R2_PUBLIC_URL/);
  });

  it("AC-10: should throw error when R2_BUCKET_NAME is not set", async () => {
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_BUCKET;
    const stream = createTestStream();

    await expect(upload(stream, "test.png")).rejects.toThrow(/R2_BUCKET/);
  });

  /**
   * AC-5 (Buffer variant): upload also accepts Buffer input
   */
  it("AC-5 (variant): should accept Buffer input for upload", async () => {
    const buffer = Buffer.from([1, 2, 3, 4]);
    const key = "projects/proj-1/gen-1.png";

    const result = await upload(buffer, key);

    expect(result).toBe("https://cdn.example.com/projects/proj-1/gen-1.png");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-6 (error variant): delete throws descriptive error on failure
   */
  it("AC-6 (variant): should throw error with descriptive message on delete failure", async () => {
    mockSend.mockRejectedValue(new Error("Access denied"));

    await expect(
      deleteObject("projects/proj-1/gen-1.png")
    ).rejects.toThrow(/R2 Delete fehlgeschlagen/);
  });

  /**
   * Verify StorageService exports are aliases
   */
  it("should export StorageService.upload and StorageService.delete as aliases", () => {
    expect(StorageService.upload).toBe(upload);
    expect(StorageService.delete).toBe(deleteObject);
  });
});

describe("Slice-03: Storage Client — Dynamischer ContentType", () => {
  const originalEnv = process.env;

  const validEnv = {
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_ENDPOINT: "https://r2.example.com",
    R2_PUBLIC_URL: "https://cdn.example.com",
    R2_BUCKET_NAME: "test-bucket",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    putObjectCalls.length = 0;
    deleteObjectCalls.length = 0;
    process.env = { ...originalEnv, ...validEnv };
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createTestStream(
    data: Uint8Array = new Uint8Array([1, 2, 3])
  ): ReadableStream {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  /**
   * AC-1: GIVEN ein Aufruf von upload(stream, key) ohne dritten Parameter
   * WHEN PutObjectCommand an den S3-Client gesendet wird
   * THEN enthaelt der Command ContentType: "image/png"
   */
  it('AC-1: should send PutObjectCommand with ContentType "image/png" when contentType is omitted', async () => {
    const stream = createTestStream();
    const key = "projects/proj-1/gen-1.png";

    await upload(stream, key);

    expect(putObjectCalls).toHaveLength(1);
    expect(putObjectCalls[0]).toMatchObject({
      ContentType: "image/png",
    });
  });

  /**
   * AC-2: GIVEN ein Aufruf von upload(stream, key, "image/jpeg")
   * WHEN PutObjectCommand an den S3-Client gesendet wird
   * THEN enthaelt der Command ContentType: "image/jpeg"
   */
  it('AC-2: should send PutObjectCommand with ContentType "image/jpeg" when specified', async () => {
    const stream = createTestStream();
    const key = "projects/proj-1/source.jpg";

    await upload(stream, key, "image/jpeg");

    expect(putObjectCalls).toHaveLength(1);
    expect(putObjectCalls[0]).toMatchObject({
      ContentType: "image/jpeg",
    });
  });

  /**
   * AC-3: GIVEN ein Aufruf von upload(stream, key, "image/webp")
   * WHEN PutObjectCommand an den S3-Client gesendet wird
   * THEN enthaelt der Command ContentType: "image/webp"
   */
  it('AC-3: should send PutObjectCommand with ContentType "image/webp" when specified', async () => {
    const stream = createTestStream();
    const key = "projects/proj-1/source.webp";

    await upload(stream, key, "image/webp");

    expect(putObjectCalls).toHaveLength(1);
    expect(putObjectCalls[0]).toMatchObject({
      ContentType: "image/webp",
    });
  });

  /**
   * AC-4: GIVEN die geaenderte upload()-Signatur
   * WHEN TypeScript die Aufruf-Stellen prueft, die den dritten Parameter weglassen
   * THEN kompilieren alle bestehenden Aufruf-Stellen ohne Fehler (kein Breaking Change)
   *
   * This test verifies backwards compatibility at runtime: calling upload()
   * with only two arguments succeeds without error. The fact that this file
   * compiles and this test passes proves TypeScript accepts the 2-arg call.
   */
  it("AC-4: should compile and run without error when called with only stream and key (backwards compatibility)", async () => {
    const stream = createTestStream();
    const key = "projects/proj-1/gen-1.png";

    // Call with only 2 args — if the 3rd param were required, TS would fail to compile
    const result = await upload(stream, key);

    // Should succeed without throwing
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  /**
   * AC-5: GIVEN ein Aufruf von upload(stream, key, "image/jpeg")
   * WHEN der Upload erfolgreich ist
   * THEN gibt die Funktion dieselbe oeffentliche URL zurueck wie bisher (${publicUrl}/${key})
   */
  it('AC-5: should return correct public URL regardless of contentType parameter', async () => {
    const stream = createTestStream();
    const key = "projects/proj-42/gen-99.jpg";

    const result = await upload(stream, key, "image/jpeg");

    expect(result).toBe("https://cdn.example.com/projects/proj-42/gen-99.jpg");
  });

  /**
   * AC-5 (variant): Return value is the same for different contentTypes
   */
  it("AC-5 (variant): should return identical URL format for image/png, image/jpeg, and image/webp", async () => {
    const key = "projects/proj-1/gen-1.png";

    const resultPng = await upload(createTestStream(), key);
    const resultJpeg = await upload(createTestStream(), key, "image/jpeg");
    const resultWebp = await upload(createTestStream(), key, "image/webp");

    const expectedUrl = "https://cdn.example.com/projects/proj-1/gen-1.png";
    expect(resultPng).toBe(expectedUrl);
    expect(resultJpeg).toBe(expectedUrl);
    expect(resultWebp).toBe(expectedUrl);
  });
});
