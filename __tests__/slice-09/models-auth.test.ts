/**
 * Slice 09: Server Action Auth - Models
 *
 * Acceptance tests for server actions in app/actions/models.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without external API calls
 * - Authenticated calls delegate to the underlying service (existing logic unchanged)
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - ModelCatalogService is mocked to verify it is NOT called when unauthenticated
 *   and IS called when authenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before imports
// ---------------------------------------------------------------------------

// Mock the auth guard
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(),
}));

// Mock the model catalog service
vi.mock("@/lib/services/model-catalog-service", () => ({
  ModelCatalogService: {
    getAll: vi.fn(),
    getByCapability: vi.fn(),
    getSchema: vi.fn(),
  },
}));

// Mock the capability detection module
vi.mock("@/lib/services/capability-detection", () => ({
  resolveSchemaRefs: vi.fn(),
}));

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock drizzle schema
vi.mock("@/lib/db/schema", () => ({
  models: {
    replicateId: "replicate_id",
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import { ModelCatalogService } from "@/lib/services/model-catalog-service";
import {
  getModels,
  getModelSchema,
} from "@/app/actions/models";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetAll = vi.mocked(ModelCatalogService.getAll);
const mockGetSchema = vi.mocked(ModelCatalogService.getSchema);

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
// Unauthenticated access returns Unauthorized
// =========================================================================

describe("Unauthenticated access -- all models actions return Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('GIVEN kein User ist eingeloggt WHEN getModels() aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE DB-Aufruf', async () => {
    const result = await getModels({});

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made
    expect(mockGetAll).not.toHaveBeenCalled();
  });

  it('GIVEN kein User ist eingeloggt WHEN getModelSchema({ modelId: "owner/model" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getModelSchema({ modelId: "owner/model" });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made
    expect(mockGetSchema).not.toHaveBeenCalled();
  });
});

// =========================================================================
// Authenticated access delegates to services
// =========================================================================

describe("Authenticated access -- models actions delegate to services", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(FAKE_USER);
  });

  it("GIVEN User ist eingeloggt WHEN getModels({}) aufgerufen wird THEN wird ModelCatalogService.getAll() aufgerufen und das Ergebnis zurueckgegeben", async () => {
    const fakeModels = [
      {
        id: "uuid-1",
        replicateId: "stability-ai/sdxl",
        owner: "stability-ai",
        name: "sdxl",
        description: "Stable Diffusion XL",
        coverImageUrl: null,
        runCount: 100000,
        collections: ["text-to-image"],
        capabilities: { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false },
        inputSchema: null,
        versionHash: null,
        isActive: true,
        lastSyncedAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ];
    mockGetAll.mockResolvedValue(fakeModels as any);

    const result = await getModels({});

    // Verify the service was called
    expect(mockGetAll).toHaveBeenCalledOnce();
    // Verify the result is the service response
    expect(result).toEqual(fakeModels);
  });
});
