/**
 * Slice 08: Server Action Auth - Generations
 *
 * Acceptance tests for all 7 server actions in app/actions/generations.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without further execution
 * - Ownership checks via project-userId filtering return { error: "Not found" } for foreign projects
 * - Generation-to-project lookup for id-based actions (retryGeneration, deleteGeneration)
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - DB query functions are mocked to verify ownership checks
 * - GenerationService, StorageService, revalidatePath are mocked (Next.js server internals)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

// Mock next/cache (revalidatePath is a Next.js server-only function)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock the auth guard
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(),
}));

// Mock the DB query layer
vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  getGeneration: vi.fn(),
  getProject: vi.fn(),
  deleteGeneration: vi.fn(),
  getSiblingsByBatchId: vi.fn(),
  getVariantFamily: vi.fn(),
}));

// Mock GenerationService (external API calls)
vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
    upscale: vi.fn(),
  },
  validateTotalMegapixels: vi.fn().mockReturnValue(null),
}));

// Mock StorageService (R2 storage)
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    delete: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import {
  getGenerations as getGenerationsQuery,
  getGeneration as getGenerationQuery,
  getProject as getProjectQuery,
  deleteGeneration as deleteGenerationQuery,
  getSiblingsByBatchId,
  getVariantFamily,
} from "@/lib/db/queries";
import { GenerationService } from "@/lib/services/generation-service";
import {
  generateImages,
  retryGeneration,
  fetchGenerations,
  upscaleImage,
  deleteGeneration,
  getSiblingGenerations,
  getVariantFamilyAction,
} from "@/app/actions/generations";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetProjectQuery = vi.mocked(getProjectQuery);
const mockGetGenerationQuery = vi.mocked(getGenerationQuery);
const mockGetGenerationsQuery = vi.mocked(getGenerationsQuery);
const mockDeleteGenerationQuery = vi.mocked(deleteGenerationQuery);
const mockGetSiblingsByBatchId = vi.mocked(getSiblingsByBatchId);
const mockGetVariantFamily = vi.mocked(getVariantFamily);
const mockGenerationServiceGenerate = vi.mocked(GenerationService.generate);
const mockGenerationServiceRetry = vi.mocked(GenerationService.retry);
const mockGenerationServiceUpscale = vi.mocked(GenerationService.upscale);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER_A = { userId: "user-a", email: "a@test.com" };
const UNAUTHORIZED = { error: "Unauthorized" };

/** Minimal valid input for generateImages */
function validGenerateInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: "proj-a",
    promptMotiv: "A test prompt",
    modelIds: ["vendor/model-1"],
    params: {},
    count: 1,
    ...overrides,
  };
}

/** Minimal valid input for upscaleImage */
function validUpscaleInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: "proj-a",
    sourceImageUrl: "https://example.com/image.png",
    scale: 2 as const,
    modelId: "vendor/upscaler-1",
    modelParams: {},
    ...overrides,
  };
}

/** Fake generation object */
function fakeGeneration(overrides: Record<string, unknown> = {}) {
  return {
    id: "gen-1",
    projectId: "proj-a",
    batchId: "batch-1",
    imageUrl: "https://example.com/gen-1.png",
    status: "completed",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// AC-1 through AC-7: Unauthenticated access returns Unauthorized
// =========================================================================

describe("generations.ts — Unauthenticated access returns Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('AC-1: GIVEN kein User ist eingeloggt WHEN generateImages(input) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE weiteren Code auszufuehren', async () => {
    const result = await generateImages(validGenerateInput());

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO project query or generation was attempted
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
    expect(mockGenerationServiceGenerate).not.toHaveBeenCalled();
  });

  it('AC-2: GIVEN kein User ist eingeloggt WHEN retryGeneration({ id: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await retryGeneration({ id: "any-uuid" });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetGenerationQuery).not.toHaveBeenCalled();
    expect(mockGenerationServiceRetry).not.toHaveBeenCalled();
  });

  it('AC-3: GIVEN kein User ist eingeloggt WHEN fetchGenerations("any-project-id") aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await fetchGenerations("any-project-id");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
    expect(mockGetGenerationsQuery).not.toHaveBeenCalled();
  });

  it('AC-4: GIVEN kein User ist eingeloggt WHEN upscaleImage(input) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await upscaleImage(validUpscaleInput());

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
    expect(mockGenerationServiceUpscale).not.toHaveBeenCalled();
  });

  it('AC-5: GIVEN kein User ist eingeloggt WHEN deleteGeneration({ id: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await deleteGeneration({ id: "any-uuid" });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetGenerationQuery).not.toHaveBeenCalled();
    expect(mockDeleteGenerationQuery).not.toHaveBeenCalled();
  });

  it('AC-6: GIVEN kein User ist eingeloggt WHEN getSiblingGenerations("any-batch-id") aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getSiblingGenerations("any-batch-id");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetSiblingsByBatchId).not.toHaveBeenCalled();
  });

  it('AC-7: GIVEN kein User ist eingeloggt WHEN getVariantFamilyAction(batchId, sourceGenId, currentGenId) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getVariantFamilyAction("batch-1", "source-gen-1", "current-gen-1");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetVariantFamily).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC-8 through AC-12: Ownership check — foreign project returns Not found
// =========================================================================

describe("generations.ts — Ownership check for foreign projects", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
  });

  it('AC-8: GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B WHEN User A generateImages({ projectId: "proj-b", ... }) aufruft THEN gibt die Action { error: "Not found" } zurueck OHNE eine Generation zu starten', async () => {
    // getProjectQuery throws when userId does not match
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await generateImages(validGenerateInput({ projectId: "proj-b" }));

    expect(result).toEqual({ error: "Not found" });
    // Verify ownership check was attempted with User A's userId
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-b", "user-a");
    // Verify NO generation was started
    expect(mockGenerationServiceGenerate).not.toHaveBeenCalled();
  });

  it('AC-9: GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B WHEN User A fetchGenerations("proj-b") aufruft THEN gibt die Action { error: "Not found" } zurueck', async () => {
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await fetchGenerations("proj-b");

    expect(result).toEqual({ error: "Not found" });
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-b", "user-a");
    expect(mockGetGenerationsQuery).not.toHaveBeenCalled();
  });

  it('AC-10: GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B WHEN User A upscaleImage({ projectId: "proj-b", ... }) aufruft THEN gibt die Action { error: "Not found" } zurueck', async () => {
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await upscaleImage(validUpscaleInput({ projectId: "proj-b" }));

    expect(result).toEqual({ error: "Not found" });
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-b", "user-a");
    expect(mockGenerationServiceUpscale).not.toHaveBeenCalled();
  });

  it('AC-11: GIVEN User A ist eingeloggt; Generation "gen-x" gehoert zu Projekt von User B WHEN User A deleteGeneration({ id: "gen-x" }) aufruft THEN wird die Generation NICHT geloescht; Action gibt Fehler zurueck', async () => {
    // Generation exists and belongs to proj-b
    mockGetGenerationQuery.mockResolvedValue(fakeGeneration({ id: "gen-x", projectId: "proj-b" }) as any);
    // Ownership check fails: proj-b does not belong to user-a
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await deleteGeneration({ id: "gen-x" });

    expect(result).toEqual({ error: "Not found" });
    // Verify the generation was NOT deleted from DB
    expect(mockDeleteGenerationQuery).not.toHaveBeenCalled();
  });

  it('AC-12: GIVEN User A ist eingeloggt; Generation "gen-x" gehoert zu Projekt von User B WHEN User A retryGeneration({ id: "gen-x" }) aufruft THEN gibt die Action { error: "Not found" } zurueck', async () => {
    // Generation exists and belongs to proj-b
    mockGetGenerationQuery.mockResolvedValue(fakeGeneration({ id: "gen-x", projectId: "proj-b" }) as any);
    // Ownership check fails: proj-b does not belong to user-a
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await retryGeneration({ id: "gen-x" });

    expect(result).toEqual({ error: "Not found" });
    // Verify NO retry was attempted
    expect(mockGenerationServiceRetry).not.toHaveBeenCalled();
  });
});
