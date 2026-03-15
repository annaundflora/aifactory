/**
 * Slice 07: Server Action Auth - Projects + Queries
 *
 * Acceptance tests for all 6 server actions in app/actions/projects.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without DB access
 * - Authenticated calls pass userId to query functions
 * - Ownership checks prevent cross-user access
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - DB query functions are mocked to verify userId is passed correctly
 * - revalidatePath and thumbnail-service are mocked (Next.js server internals)
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
  createProject: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
}));

// Mock thumbnail-service (fire-and-forget, not under test)
vi.mock("@/lib/services/thumbnail-service", () => ({
  generateForProject: vi.fn().mockResolvedValue(undefined),
  refreshForProject: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import {
  createProject as createProjectQuery,
  getProjects as getProjectsQuery,
  getProject as getProjectQuery,
  renameProject as renameProjectQuery,
  deleteProject as deleteProjectQuery,
} from "@/lib/db/queries";
import {
  createProject,
  getProjects,
  getProject,
  renameProject,
  deleteProject,
  generateThumbnail,
} from "@/app/actions/projects";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockCreateProjectQuery = vi.mocked(createProjectQuery);
const mockGetProjectsQuery = vi.mocked(getProjectsQuery);
const mockGetProjectQuery = vi.mocked(getProjectQuery);
const mockRenameProjectQuery = vi.mocked(renameProjectQuery);
const mockDeleteProjectQuery = vi.mocked(deleteProjectQuery);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER_A = { userId: "user-a", email: "a@test.com" };
const FAKE_USER_B_ID = "user-b";
const UNAUTHORIZED = { error: "Unauthorized" };

function fakeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    name: "Test Project",
    userId: "user-a",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    thumbnailUrl: null,
    thumbnailStatus: "pending",
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
// AC-1 through AC-6: Unauthenticated access returns Unauthorized
// =========================================================================

describe("Unauthenticated access — all actions return Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('AC-1: GIVEN kein User ist eingeloggt WHEN createProject({ name: "Test" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE Datenbankzugriff', async () => {
    const result = await createProject({ name: "Test" });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO database call was made
    expect(mockCreateProjectQuery).not.toHaveBeenCalled();
  });

  it('AC-2: GIVEN kein User ist eingeloggt WHEN getProjects() aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getProjects();

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectsQuery).not.toHaveBeenCalled();
  });

  it('AC-3: GIVEN kein User ist eingeloggt WHEN getProject({ id: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getProject({ id: "any-uuid" });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
  });

  it('AC-4: GIVEN kein User ist eingeloggt WHEN renameProject({ id: "any-uuid", name: "New" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await renameProject({ id: "any-uuid", name: "New" });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockRenameProjectQuery).not.toHaveBeenCalled();
  });

  it('AC-5: GIVEN kein User ist eingeloggt WHEN deleteProject({ id: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await deleteProject({ id: "any-uuid" });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockDeleteProjectQuery).not.toHaveBeenCalled();
  });

  it('AC-6: GIVEN kein User ist eingeloggt WHEN generateThumbnail({ projectId: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await generateThumbnail({
      projectId: "00000000-0000-0000-0000-000000000001",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetProjectQuery).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC-7: createProject passes userId to query
// =========================================================================

describe("Authenticated createProject", () => {
  it('AC-7: GIVEN User A ist eingeloggt mit userId "user-a" WHEN createProject({ name: "Mein Projekt" }) aufgerufen wird THEN wird das Projekt mit userId: "user-a" in der DB erstellt', async () => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
    const createdProject = fakeProject({ name: "Mein Projekt" });
    mockCreateProjectQuery.mockResolvedValue(createdProject as any);

    const result = await createProject({ name: "Mein Projekt" });

    // Verify createProjectQuery was called with userId from auth
    expect(mockCreateProjectQuery).toHaveBeenCalledWith({
      name: "Mein Projekt",
      userId: "user-a",
    });
    // Verify the action returns the project data
    expect(result).toEqual(
      expect.objectContaining({
        id: "proj-1",
        name: "Mein Projekt",
      })
    );
  });
});

// =========================================================================
// AC-8: getProjects filters by userId
// =========================================================================

describe("Authenticated getProjects — user isolation", () => {
  it("AC-8: GIVEN User A ist eingeloggt und hat 2 Projekte; User B hat 3 Projekte WHEN User A getProjects() aufruft THEN erhaelt User A genau seine 2 Projekte (NICHT die von User B)", async () => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
    const userAProjects = [
      fakeProject({ id: "proj-a1", name: "A Project 1" }),
      fakeProject({ id: "proj-a2", name: "A Project 2" }),
    ];
    mockGetProjectsQuery.mockResolvedValue(userAProjects as any);

    const result = await getProjects();

    // Verify getProjectsQuery was called with User A's userId
    expect(mockGetProjectsQuery).toHaveBeenCalledWith("user-a");
    // Verify exactly 2 projects returned
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(2);
  });
});

// =========================================================================
// AC-9: getProject ownership check
// =========================================================================

describe("Authenticated getProject — ownership check", () => {
  it('AC-9: GIVEN User A ist eingeloggt; ein Projekt mit id: "proj-1" gehoert User B WHEN User A getProject({ id: "proj-1" }) aufruft THEN gibt die Action { error: "Projekt nicht gefunden" } zurueck', async () => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
    // Query throws "not found" because userId filter excludes User B's project
    mockGetProjectQuery.mockRejectedValue(
      new Error("Project not found: proj-1")
    );

    const result = await getProject({ id: "proj-1" });

    // Verify getProjectQuery was called with User A's userId (ownership filter)
    expect(mockGetProjectQuery).toHaveBeenCalledWith("proj-1", "user-a");
    expect(result).toEqual({ error: "Projekt nicht gefunden" });
  });
});

// =========================================================================
// AC-10: renameProject ownership check
// =========================================================================

describe("Authenticated renameProject — ownership check", () => {
  it('AC-10: GIVEN User A ist eingeloggt; ein Projekt mit id: "proj-1" gehoert User B WHEN User A renameProject({ id: "proj-1", name: "Hijacked" }) aufruft THEN gibt die Action { error: "Projekt nicht gefunden" } zurueck (kein Rename)', async () => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
    // Query throws "not found" because userId filter excludes User B's project
    mockRenameProjectQuery.mockRejectedValue(
      new Error("Project not found: proj-1")
    );

    const result = await renameProject({ id: "proj-1", name: "Hijacked" });

    // Verify renameProjectQuery was called with User A's userId
    expect(mockRenameProjectQuery).toHaveBeenCalledWith(
      "proj-1",
      "Hijacked",
      "user-a"
    );
    expect(result).toEqual({ error: "Projekt nicht gefunden" });
  });
});

// =========================================================================
// AC-11: deleteProject ownership check — silent no-op for foreign projects
// =========================================================================

describe("Authenticated deleteProject — ownership check", () => {
  it('AC-11: GIVEN User A ist eingeloggt; ein Projekt mit id: "proj-1" gehoert User B WHEN User A deleteProject({ id: "proj-1" }) aufruft THEN wird das Projekt NICHT geloescht', async () => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
    // deleteProjectQuery with userId filter silently does nothing for foreign projects
    mockDeleteProjectQuery.mockResolvedValue(undefined);

    const result = await deleteProject({ id: "proj-1" });

    // Verify deleteProjectQuery was called with User A's userId (ownership filter)
    expect(mockDeleteProjectQuery).toHaveBeenCalledWith("proj-1", "user-a");
    // The action returns success (silent no-op — the WHERE clause matched 0 rows)
    expect(result).toEqual({ success: true });
  });
});

// =========================================================================
// AC-12: generateThumbnail ownership check
// =========================================================================

describe("Authenticated generateThumbnail — ownership check", () => {
  it('AC-12: GIVEN User A ist eingeloggt; ein Projekt mit id: "proj-1" gehoert User B WHEN User A generateThumbnail({ projectId: "proj-1" }) aufruft THEN gibt die Action { error: "Projekt nicht gefunden" } zurueck', async () => {
    mockRequireAuth.mockResolvedValue(FAKE_USER_A);
    // getProjectQuery throws "not found" because userId filter excludes User B's project
    mockGetProjectQuery.mockRejectedValue(
      new Error("Project not found: proj-1")
    );

    const result = await generateThumbnail({
      projectId: "00000000-0000-0000-0000-000000000001",
    });

    // Verify getProjectQuery was called with User A's userId
    expect(mockGetProjectQuery).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      "user-a"
    );
    expect(result).toEqual({ error: "Projekt nicht gefunden" });
  });
});
