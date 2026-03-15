/**
 * Slice 09: Server Action Auth - Prompts
 *
 * Acceptance tests for all 4 server actions in app/actions/prompts.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without service access
 * - Authenticated calls delegate to the underlying service (existing logic unchanged)
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - Service layers are mocked to verify they are NOT called when unauthenticated
 *   and ARE called when authenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before imports
// ---------------------------------------------------------------------------

// Mock the auth guard
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(),
}));

// Mock the prompt history service
vi.mock("@/lib/services/prompt-history-service", () => ({
  promptHistoryService: {
    getHistory: vi.fn(),
    getFavorites: vi.fn(),
    toggleFavorite: vi.fn(),
  },
  // Re-export the type stub (vitest handles this)
}));

// Mock the prompt service
vi.mock("@/lib/services/prompt-service", () => ({
  PromptService: {
    improve: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import { promptHistoryService } from "@/lib/services/prompt-history-service";
import { PromptService } from "@/lib/services/prompt-service";
import {
  getPromptHistory,
  getFavoritePrompts,
  toggleFavorite,
  improvePrompt,
} from "@/app/actions/prompts";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetHistory = vi.mocked(promptHistoryService.getHistory);
const mockGetFavorites = vi.mocked(promptHistoryService.getFavorites);
const mockToggleFavorite = vi.mocked(promptHistoryService.toggleFavorite);
const mockImprove = vi.mocked(PromptService.improve);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { userId: "user-123", email: "test@example.com" };
const UNAUTHORIZED = { error: "Unauthorized" };

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// AC-1 through AC-4: Unauthenticated access returns Unauthorized
// =========================================================================

describe("Unauthenticated access -- all prompts actions return Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('AC-1: GIVEN kein User ist eingeloggt WHEN getPromptHistory({ offset: 0, limit: 50 }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE Aufruf von promptHistoryService', async () => {
    const result = await getPromptHistory({ offset: 0, limit: 50 });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made
    expect(mockGetHistory).not.toHaveBeenCalled();
  });

  it('AC-2: GIVEN kein User ist eingeloggt WHEN getFavoritePrompts({ offset: 0, limit: 50 }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getFavoritePrompts({ offset: 0, limit: 50 });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made
    expect(mockGetFavorites).not.toHaveBeenCalled();
  });

  it('AC-3: GIVEN kein User ist eingeloggt WHEN toggleFavorite({ generationId: "any-uuid" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE DB-Mutation', async () => {
    const result = await toggleFavorite({ generationId: "any-uuid" });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made (no DB mutation)
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it('AC-4: GIVEN kein User ist eingeloggt WHEN improvePrompt({ prompt: "a cat", modelId: "stability/sdxl" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE API-Aufruf an PromptService', async () => {
    const result = await improvePrompt({
      prompt: "a cat",
      modelId: "stability/sdxl",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO API call was made
    expect(mockImprove).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC-10: getPromptHistory with valid session
// =========================================================================

describe("Authenticated access -- prompts actions delegate to services", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(FAKE_USER);
  });

  it("AC-10: GIVEN User ist eingeloggt mit gueltiger Session WHEN getPromptHistory({ offset: 0, limit: 10 }) aufgerufen wird THEN wird promptHistoryService.getHistory() aufgerufen und das Ergebnis zurueckgegeben", async () => {
    const fakeHistory = [
      {
        generationId: "gen-1",
        promptMotiv: "a cat",
        promptStyle: "realistic",
        negativePrompt: null,
        modelId: "stability/sdxl",
        modelParams: {},
        isFavorite: false,
        createdAt: new Date("2025-01-01"),
      },
    ];
    mockGetHistory.mockResolvedValue(fakeHistory);

    const result = await getPromptHistory({ offset: 0, limit: 10 });

    // Verify the service was called with the correct parameters
    expect(mockGetHistory).toHaveBeenCalledWith(0, 10);
    // Verify the result is the service response (not modified)
    expect(result).toEqual(fakeHistory);
  });
});
