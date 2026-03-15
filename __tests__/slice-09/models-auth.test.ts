/**
 * Slice 09: Server Action Auth - Models
 *
 * Acceptance tests for all 3 server actions in app/actions/models.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without external API calls
 * - Authenticated calls delegate to the underlying service (existing logic unchanged)
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - CollectionModelService and ModelSchemaService are mocked to verify they are NOT
 *   called when unauthenticated and ARE called when authenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before imports
// ---------------------------------------------------------------------------

// Mock the auth guard
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(),
}));

// Mock the collection model service
vi.mock("@/lib/services/collection-model-service", () => ({
  CollectionModelService: {
    getCollectionModels: vi.fn(),
  },
}));

// Mock the model schema service
vi.mock("@/lib/services/model-schema-service", () => ({
  ModelSchemaService: {
    supportsImg2Img: vi.fn(),
    getSchema: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import { CollectionModelService } from "@/lib/services/collection-model-service";
import { ModelSchemaService } from "@/lib/services/model-schema-service";
import {
  getCollectionModels,
  checkImg2ImgSupport,
  getModelSchema,
} from "@/app/actions/models";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetCollectionModels = vi.mocked(
  CollectionModelService.getCollectionModels
);
const mockSupportsImg2Img = vi.mocked(ModelSchemaService.supportsImg2Img);
const mockGetSchema = vi.mocked(ModelSchemaService.getSchema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { userId: "user-456", email: "models@test.com" };
const UNAUTHORIZED = { error: "Unauthorized" };

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// AC-5 through AC-7: Unauthenticated access returns Unauthorized
// =========================================================================

describe("Unauthenticated access -- all models actions return Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('AC-5: GIVEN kein User ist eingeloggt WHEN getCollectionModels() aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE Replicate-API-Aufruf', async () => {
    const result = await getCollectionModels();

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO API call was made
    expect(mockGetCollectionModels).not.toHaveBeenCalled();
  });

  it('AC-6: GIVEN kein User ist eingeloggt WHEN checkImg2ImgSupport({ modelId: "owner/model" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck (statt false)', async () => {
    const result = await checkImg2ImgSupport({ modelId: "owner/model" });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify it returns { error } and NOT boolean false
    expect(result).not.toBe(false);
    // Verify NO API call was made
    expect(mockSupportsImg2Img).not.toHaveBeenCalled();
  });

  it('AC-7: GIVEN kein User ist eingeloggt WHEN getModelSchema({ modelId: "owner/model" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getModelSchema({ modelId: "owner/model" });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO API call was made
    expect(mockGetSchema).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC-11: getCollectionModels with valid session
// =========================================================================

describe("Authenticated access -- models actions delegate to services", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(FAKE_USER);
  });

  it("AC-11: GIVEN User ist eingeloggt mit gueltiger Session WHEN getCollectionModels() aufgerufen wird THEN wird CollectionModelService.getCollectionModels() aufgerufen und das Ergebnis zurueckgegeben", async () => {
    const fakeModels = [
      {
        url: "https://replicate.com/stability-ai/sdxl",
        owner: "stability-ai",
        name: "sdxl",
        description: "Stable Diffusion XL",
        cover_image_url: null,
        run_count: 100000,
        created_at: "2024-01-01",
      },
    ];
    mockGetCollectionModels.mockResolvedValue(fakeModels);

    const result = await getCollectionModels();

    // Verify the service was called
    expect(mockGetCollectionModels).toHaveBeenCalledOnce();
    // Verify the result is the service response
    expect(result).toEqual(fakeModels);
  });
});
