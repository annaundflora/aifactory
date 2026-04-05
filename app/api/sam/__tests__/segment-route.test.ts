/**
 * Tests for POST /api/sam/segment -- SAM 2 Click-to-Segment Route Handler
 * Slice: slice-10-sam-api
 *
 * Mocking Strategy: mock_external (from Slice Spec)
 *   - requireAuth (@/lib/auth/guard): globally mocked in vitest.setup.ts, overridden per-test
 *   - replicateRun (@/lib/clients/replicate): mocked via vi.mock
 *   - StorageService (@/lib/clients/storage): mocked via vi.mock
 *   - crypto.randomUUID: mocked for deterministic mask keys
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- declared before imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

const mockReplicateRun = vi.fn();
const mockStorageUpload = vi.fn();
const MOCK_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

vi.mock("@/lib/clients/replicate", () => ({
  replicateRun: (...args: unknown[]) => mockReplicateRun(...args),
}));

vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: (...args: unknown[]) => mockStorageUpload(...args),
  },
}));

vi.mock("crypto", () => ({
  randomUUID: () => MOCK_UUID,
}));

// Import auth mock to override per-test
import { requireAuth } from "@/lib/auth/guard";
const mockRequireAuth = vi.mocked(requireAuth);

// Import AFTER mocks are set up
import { POST } from "../segment/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const R2_PUBLIC_URL = "https://r2.example.com";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/sam/segment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(): Record<string, unknown> {
  return {
    image_url: `${R2_PUBLIC_URL}/image.png`,
    click_x: 0.5,
    click_y: 0.3,
  };
}

/**
 * Creates a minimal ReadableStream to simulate Replicate mask output.
 */
function fakeMaskStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0x89, 0x50, 0x4e, 0x47])); // PNG header bytes
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

const originalEnv = process.env.R2_PUBLIC_URL;

beforeEach(() => {
  vi.clearAllMocks();

  // Set R2_PUBLIC_URL so isAllowedImageUrl passes for our test URLs
  process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;

  // Default: authenticated user
  mockRequireAuth.mockResolvedValue({
    userId: "mock-user-id",
    email: "test@example.com",
  });

  // Default: Replicate returns a valid mask output
  mockReplicateRun.mockResolvedValue({
    output: fakeMaskStream(),
    predictionId: "pred-123",
    seed: null,
  });

  // Default: StorageService returns a valid URL
  mockStorageUpload.mockResolvedValue(
    `${R2_PUBLIC_URL}/masks/${MOCK_UUID}.png`
  );
});

afterEach(() => {
  // Restore original env
  if (originalEnv !== undefined) {
    process.env.R2_PUBLIC_URL = originalEnv;
  } else {
    delete process.env.R2_PUBLIC_URL;
  }
});

// ---------------------------------------------------------------------------
// Acceptance Tests
// ---------------------------------------------------------------------------

describe("POST /api/sam/segment", () => {
  // AC-1: Valid request returns 200 + mask_url
  it("should return 200 with mask_url for valid SAM segment request", async () => {
    /**
     * AC-1: GIVEN ein authentifizierter User
     *       WHEN POST /api/sam/segment mit { image_url, click_x: 0.5, click_y: 0.3 } aufgerufen wird
     *       THEN antwortet der Endpoint mit HTTP 200 und Body { mask_url: "<valid R2 URL>" }
     */
    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      mask_url: `${R2_PUBLIC_URL}/masks/${MOCK_UUID}.png`,
    });
  });

  // AC-2: No auth returns 401
  it("should return 401 when user is not authenticated", async () => {
    /**
     * AC-2: GIVEN ein nicht-authentifizierter Request
     *       WHEN POST /api/sam/segment aufgerufen wird
     *       THEN antwortet der Endpoint mit HTTP 401
     */
    mockRequireAuth.mockResolvedValueOnce({ error: "Unauthorized" });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // AC-3: Invalid coordinates returns 400
  it("should return 400 when click_x is outside 0-1 range", async () => {
    /**
     * AC-3: GIVEN ein authentifizierter User
     *       WHEN POST /api/sam/segment mit { click_x: 1.5, click_y: 0.3, image_url } aufgerufen wird (click_x ausserhalb 0.0-1.0)
     *       THEN antwortet der Endpoint mit HTTP 400 und Body { error: "Koordinaten muessen normalisiert sein (0-1)" }
     */
    const response = await POST(
      makeRequest({
        image_url: `${R2_PUBLIC_URL}/img.png`,
        click_x: 1.5,
        click_y: 0.3,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "Koordinaten muessen normalisiert sein (0-1)",
    });
  });

  it("should return 400 when click_y is outside 0-1 range", async () => {
    /**
     * AC-3 (additional): Validates click_y out of range as well.
     */
    const response = await POST(
      makeRequest({
        image_url: `${R2_PUBLIC_URL}/img.png`,
        click_x: 0.5,
        click_y: -0.1,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "Koordinaten muessen normalisiert sein (0-1)",
    });
  });

  // AC-4: Missing image_url returns 400
  it("should return 400 when image_url is missing", async () => {
    /**
     * AC-4: GIVEN ein authentifizierter User
     *       WHEN POST /api/sam/segment mit { click_x: 0.5, click_y: 0.3 } aufgerufen wird (image_url fehlt)
     *       THEN antwortet der Endpoint mit HTTP 400 und Body { error: "image_url ist erforderlich" }
     */
    const response = await POST(
      makeRequest({
        click_x: 0.5,
        click_y: 0.3,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "image_url ist erforderlich" });
  });

  // AC-5: Replicate called with meta/sam-2
  it("should call Replicate with meta/sam-2 model and provided coordinates", async () => {
    /**
     * AC-5: GIVEN ein authentifizierter User
     *       WHEN POST /api/sam/segment mit gueltigem Body aufgerufen wird
     *       THEN wird der Replicate Client mit Modell "meta/sam-2" und den uebergebenen Koordinaten + Bild-URL aufgerufen
     */
    const imageUrl = `${R2_PUBLIC_URL}/image.png`;
    const response = await POST(
      makeRequest({
        image_url: imageUrl,
        click_x: 0.5,
        click_y: 0.3,
      })
    );

    expect(response.status).toBe(200);
    expect(mockReplicateRun).toHaveBeenCalledTimes(1);
    expect(mockReplicateRun).toHaveBeenCalledWith("meta/sam-2", {
      image: imageUrl,
      point_coords: [[0.5, 0.3]],
      point_labels: [1],
    });
  });

  // AC-6: Mask uploaded with masks/ prefix
  it("should upload mask PNG to R2 with masks/ prefix and return R2 URL as mask_url", async () => {
    /**
     * AC-6: GIVEN der Replicate-Aufruf liefert eine Mask-PNG zurueck
     *       WHEN die Response verarbeitet wird
     *       THEN wird die Mask-PNG via StorageService.upload() zu R2 hochgeladen mit Prefix "masks/" und temporaerem TTL
     *       AND die resultierende R2-URL wird als mask_url zurueckgegeben
     */
    const mockStream = fakeMaskStream();
    mockReplicateRun.mockResolvedValueOnce({
      output: mockStream,
      predictionId: "pred-456",
      seed: null,
    });

    const expectedUrl = `${R2_PUBLIC_URL}/masks/${MOCK_UUID}.png`;
    mockStorageUpload.mockResolvedValueOnce(expectedUrl);

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ mask_url: expectedUrl });

    // Verify upload was called with masks/ prefix key
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    const [uploadStream, uploadKey, uploadContentType] =
      mockStorageUpload.mock.calls[0];
    expect(uploadKey).toBe(`masks/${MOCK_UUID}.png`);
    expect(uploadKey).toMatch(/^masks\//);
    expect(uploadContentType).toBe("image/png");
    expect(uploadStream).toBe(mockStream);
  });

  // AC-7: Replicate error returns 502
  it("should return 502 with SAM error message when Replicate call fails", async () => {
    /**
     * AC-7: GIVEN der Replicate-Aufruf schlaegt fehl (Timeout oder API-Error)
     *       WHEN die Response verarbeitet wird
     *       THEN antwortet der Endpoint mit HTTP 502 und Body { error: "SAM-Fehler. Versuche manuelles Maskieren." }
     */
    mockReplicateRun.mockRejectedValueOnce(new Error("Replicate API timeout"));

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({
      error: "SAM-Fehler. Versuche manuelles Maskieren.",
    });
  });

  // AC-8: Empty mask returns 422
  it("should return 422 when SAM returns empty mask (null output)", async () => {
    /**
     * AC-8: GIVEN der Replicate-Aufruf liefert eine leere Mask (kein Objekt erkannt)
     *       WHEN die Response verarbeitet wird
     *       THEN antwortet der Endpoint mit HTTP 422 und Body { error: "Kein Objekt erkannt. Versuche einen anderen Punkt." }
     */
    mockReplicateRun.mockResolvedValueOnce({
      output: null,
      predictionId: "pred-789",
      seed: null,
    });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({
      error: "Kein Objekt erkannt. Versuche einen anderen Punkt.",
    });
  });

  it('should return 422 when Replicate throws "kein Output" error', async () => {
    /**
     * AC-8 (additional): The route also catches errors containing "Replicate lieferte kein Output"
     * and maps them to 422.
     */
    mockReplicateRun.mockRejectedValueOnce(
      new Error("Replicate lieferte kein Output.")
    );

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({
      error: "Kein Objekt erkannt. Versuche einen anderen Punkt.",
    });
  });
});

// ---------------------------------------------------------------------------
// Additional Edge Case / Integration-style Tests
// ---------------------------------------------------------------------------

describe("POST /api/sam/segment -- edge cases", () => {
  it("should return 400 when image_url is empty string", async () => {
    const response = await POST(
      makeRequest({
        image_url: "",
        click_x: 0.5,
        click_y: 0.3,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "image_url ist erforderlich" });
  });

  it("should return 400 for non-numeric click coordinates", async () => {
    const response = await POST(
      makeRequest({
        image_url: `${R2_PUBLIC_URL}/img.png`,
        click_x: "not-a-number",
        click_y: 0.3,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "Koordinaten muessen normalisiert sein (0-1)",
    });
  });

  it("should return 400 for click coordinates at boundary NaN/Infinity", async () => {
    const response = await POST(
      makeRequest({
        image_url: `${R2_PUBLIC_URL}/img.png`,
        click_x: 0.5,
        click_y: Infinity,
      })
    );

    // JSON.stringify(Infinity) becomes null, so it won't be a number
    expect(response.status).toBe(400);
  });

  it("should accept boundary coordinates (0.0 and 1.0)", async () => {
    const response = await POST(
      makeRequest({
        image_url: `${R2_PUBLIC_URL}/img.png`,
        click_x: 0.0,
        click_y: 1.0,
      })
    );

    expect(response.status).toBe(200);
  });

  it("should return 400 for image_url from disallowed domain (SSRF protection)", async () => {
    const response = await POST(
      makeRequest({
        image_url: "https://evil.example.com/hack.png",
        click_x: 0.5,
        click_y: 0.3,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "image_url ist ungueltig" });
  });

  it("should export runtime as nodejs", async () => {
    const routeModule = await import("../segment/route");
    expect(routeModule.runtime).toBe("nodejs");
  });

  it("should not export a GET handler (only POST)", async () => {
    const routeModule = await import("../segment/route");
    expect(routeModule).not.toHaveProperty("GET");
    expect(routeModule).toHaveProperty("POST");
    expect(typeof routeModule.POST).toBe("function");
  });
});
