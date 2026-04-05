/**
 * Tests for POST /api/sam/segment -- SAM 2 Click-to-Segment Route Handler
 * Slice: slice-10-sam-api
 *
 * Mocking Strategy: mock_external (from Slice Spec)
 *   - requireAuth (@/lib/auth/guard): globally mocked in vitest.setup.ts, overridden per-test
 *   - Replicate (replicate): mocked via vi.mock — the route uses `new Replicate().run()`
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

// Mock the `replicate` npm package — the route does `new Replicate().run()`
vi.mock("replicate", () => {
  return {
    default: class MockReplicate {
      run(...args: unknown[]) {
        return mockReplicateRun(...args);
      }
    },
  };
});

vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: (...args: unknown[]) => mockStorageUpload(...args),
  },
}));

// Mock sharp — used for maskContainsPoint
vi.mock("sharp", () => {
  const sharpInstance = {
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    grayscale: vi.fn().mockReturnThis(),
    extract: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from([255, 255, 255, 255, 255]), // Non-zero = mask hit
    }),
  };
  return { default: vi.fn(() => sharpInstance) };
});

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
 * SAM 2 returns { combined_mask: string, individual_masks: string[] }
 */
function fakeSamOutput() {
  return {
    combined_mask: "https://replicate.delivery/combined-mask.png",
    individual_masks: [
      "https://replicate.delivery/mask-0.png",
      "https://replicate.delivery/mask-1.png",
    ],
  };
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

  // Default: Replicate returns valid SAM output
  mockReplicateRun.mockResolvedValue(fakeSamOutput());

  // Default: StorageService returns a valid URL
  mockStorageUpload.mockResolvedValue(
    `${R2_PUBLIC_URL}/masks/${MOCK_UUID}.png`
  );

  // Mock global fetch for mask download (maskContainsPoint + re-upload)
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      mask_url: `${R2_PUBLIC_URL}/masks/${MOCK_UUID}.png`,
    });
  });

  // AC-2: No auth returns 401
  it("should return 401 when user is not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: "Unauthorized" });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // AC-3: Invalid coordinates returns 400
  it("should return 400 when click_x is outside 0-1 range", async () => {
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

  // AC-5: Replicate called with correct model + auto-segmentation params
  it("should call Replicate with SAM 2 model version and auto-segmentation params", async () => {
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
    expect(mockReplicateRun).toHaveBeenCalledWith(
      "meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83",
      {
        input: {
          image: imageUrl,
          points_per_side: 16,
          pred_iou_thresh: 0.86,
          stability_score_thresh: 0.92,
        },
      }
    );
  });

  // AC-6: Mask uploaded with masks/ prefix
  it("should upload selected mask to R2 with masks/ prefix", async () => {
    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ mask_url: `${R2_PUBLIC_URL}/masks/${MOCK_UUID}.png` });

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    const [, uploadKey, uploadContentType] = mockStorageUpload.mock.calls[0];
    expect(uploadKey).toBe(`masks/${MOCK_UUID}.png`);
    expect(uploadContentType).toBe("image/png");
  });

  // AC-7: Replicate error returns 502
  it("should return 502 with SAM error message when Replicate call fails", async () => {
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
    mockReplicateRun.mockResolvedValueOnce(null);

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({
      error: "Kein Objekt erkannt. Versuche einen anderen Punkt.",
    });
  });

  it('should return 422 when Replicate throws "kein Output" error', async () => {
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

  it("should handle SAM output with empty individual_masks", async () => {
    mockReplicateRun.mockResolvedValueOnce({
      combined_mask: "https://replicate.delivery/combined.png",
      individual_masks: [],
    });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
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
