/**
 * Slice 08: Server Action Auth - References
 *
 * Acceptance tests for all 5 server actions in app/actions/references.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without further execution
 * - Ownership checks via project-userId filtering return { error: "Not found" } for foreign projects
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - DB query functions are mocked to verify ownership checks
 * - ReferenceService, revalidatePath, drizzle db are mocked (Next.js server internals)
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
  getGenerationReferences: vi.fn(),
  getGeneration: vi.fn(),
  getProject: vi.fn(),
}));

// Mock ReferenceService (external service calls)
vi.mock("@/lib/services/reference-service", () => ({
  ReferenceService: {
    upload: vi.fn(),
    delete: vi.fn(),
    uploadFromGallery: vi.fn(),
  },
}));

// Mock drizzle db (used for direct queries in references.ts)
vi.mock("@/lib/db", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
  return {
    db: {
      select: mockSelect,
    },
  };
});

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _col, _val })),
}));

// Mock the schema (used in direct db queries)
vi.mock("@/lib/db/schema", () => ({
  referenceImages: {
    id: "referenceImages.id",
    projectId: "referenceImages.projectId",
    imageUrl: "referenceImages.imageUrl",
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import {
  getProject as getProjectQuery,
  getGeneration as getGenerationQuery,
  getGenerationReferences,
} from "@/lib/db/queries";
import { ReferenceService } from "@/lib/services/reference-service";
import {
  uploadReferenceImage,
  deleteReferenceImage,
  addGalleryAsReference,
  getReferenceCount,
  getProvenanceData,
} from "@/app/actions/references";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetProjectQuery = vi.mocked(getProjectQuery);
const mockGetGenerationQuery = vi.mocked(getGenerationQuery);
const mockGetGenerationReferences = vi.mocked(getGenerationReferences);
const mockReferenceServiceUpload = vi.mocked(ReferenceService.upload);
const mockReferenceServiceDelete = vi.mocked(ReferenceService.delete);
const mockReferenceServiceUploadFromGallery = vi.mocked(ReferenceService.uploadFromGallery);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER_A = { userId: "user-a", email: "a@test.com" };
const UNAUTHORIZED = { error: "Unauthorized" };

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// AC-13 through AC-17: Unauthenticated access returns Unauthorized
// =========================================================================

describe("references.ts — Unauthenticated access returns Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('AC-13: GIVEN kein User ist eingeloggt WHEN uploadReferenceImage(input) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await uploadReferenceImage({
      projectId: "any-project-id",
      url: "https://example.com/image.png",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO project query or upload was attempted
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
    expect(mockReferenceServiceUpload).not.toHaveBeenCalled();
  });

  it('AC-14: GIVEN kein User ist eingeloggt WHEN deleteReferenceImage({ id: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await deleteReferenceImage({ id: "any-uuid" });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockReferenceServiceDelete).not.toHaveBeenCalled();
  });

  it('AC-15: GIVEN kein User ist eingeloggt WHEN addGalleryAsReference(input) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await addGalleryAsReference({
      projectId: "any-project-id",
      generationId: "any-gen-id",
      imageUrl: "https://example.com/image.png",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
    expect(mockReferenceServiceUploadFromGallery).not.toHaveBeenCalled();
  });

  it('AC-16: GIVEN kein User ist eingeloggt WHEN getReferenceCount("any-project-id") aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getReferenceCount("any-project-id");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
  });

  it('AC-17: GIVEN kein User ist eingeloggt WHEN getProvenanceData("any-gen-id") aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getProvenanceData("any-gen-id");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetGenerationQuery).not.toHaveBeenCalled();
    expect(mockGetGenerationReferences).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC-18 through AC-20: Ownership check — foreign project returns Not found
// =========================================================================

describe("references.ts — Ownership check for foreign projects", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
  });

  it('AC-18: GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B WHEN User A uploadReferenceImage({ projectId: "proj-b", ... }) aufruft THEN gibt die Action { error: "Not found" } zurueck', async () => {
    // getProjectQuery throws when userId does not match
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await uploadReferenceImage({
      projectId: "proj-b",
      url: "https://example.com/image.png",
    });

    expect(result).toEqual({ error: "Not found" });
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-b", "user-a");
    // Verify NO upload was attempted
    expect(mockReferenceServiceUpload).not.toHaveBeenCalled();
  });

  it('AC-19: GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B WHEN User A addGalleryAsReference({ projectId: "proj-b", ... }) aufruft THEN gibt die Action { error: "Not found" } zurueck', async () => {
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await addGalleryAsReference({
      projectId: "proj-b",
      generationId: "gen-1",
      imageUrl: "https://example.com/image.png",
    });

    expect(result).toEqual({ error: "Not found" });
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-b", "user-a");
    expect(mockReferenceServiceUploadFromGallery).not.toHaveBeenCalled();
  });

  it('AC-20: GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B WHEN User A getReferenceCount("proj-b") aufruft THEN gibt die Action { error: "Not found" } zurueck', async () => {
    mockGetProjectQuery.mockRejectedValue(new Error("Project not found"));

    const result = await getReferenceCount("proj-b");

    expect(result).toEqual({ error: "Not found" });
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-b", "user-a");
  });
});
