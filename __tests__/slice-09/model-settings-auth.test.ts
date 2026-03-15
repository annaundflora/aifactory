/**
 * Slice 09: Server Action Auth - Model Settings
 *
 * Acceptance tests for both server actions in app/actions/model-settings.ts.
 * Tests verify that:
 * - requireAuth() is called as the first guard in every action
 * - Unauthenticated calls return { error: "Unauthorized" } without DB mutation
 * - Authenticated calls delegate to ModelSettingsService (existing logic unchanged)
 *
 * Mocking strategy (per orchestrator instruction):
 * - requireAuth() is mocked to simulate authenticated/unauthenticated states
 * - ModelSettingsService is mocked to verify it is NOT called when unauthenticated
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

// Mock the model settings service
vi.mock("@/lib/services/model-settings-service", () => ({
  ModelSettingsService: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock the model schema service (transitive dependency of ModelSettingsService)
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
import { ModelSettingsService } from "@/lib/services/model-settings-service";
import {
  getModelSettings,
  updateModelSetting,
} from "@/app/actions/model-settings";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetAll = vi.mocked(ModelSettingsService.getAll);
const mockUpdate = vi.mocked(ModelSettingsService.update);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { userId: "user-789", email: "settings@test.com" };
const UNAUTHORIZED = { error: "Unauthorized" };

function fakeModelSetting(overrides: Record<string, unknown> = {}) {
  return {
    id: "ms-1",
    mode: "txt2img",
    tier: "fast",
    modelId: "stability-ai/sdxl",
    modelParams: {},
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
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
// AC-8 and AC-9: Unauthenticated access returns Unauthorized
// =========================================================================

describe("Unauthenticated access -- all model-settings actions return Unauthorized", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
  });

  it('AC-8: GIVEN kein User ist eingeloggt WHEN getModelSettings() aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck', async () => {
    const result = await getModelSettings();

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made
    expect(mockGetAll).not.toHaveBeenCalled();
  });

  it('AC-9: GIVEN kein User ist eingeloggt WHEN updateModelSetting({ mode: "generate", tier: "fast", modelId: "owner/model" }) aufgerufen wird THEN gibt die Action { error: "Unauthorized" } zurueck OHNE DB-Mutation', async () => {
    const result = await updateModelSetting({
      mode: "txt2img" as any,
      tier: "draft" as any,
      modelId: "owner/model",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    // Verify NO service call was made (no DB mutation)
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC-12: updateModelSetting with valid session
// =========================================================================

describe("Authenticated access -- model-settings actions delegate to services", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(FAKE_USER);
  });

  it("AC-12: GIVEN User ist eingeloggt mit gueltiger Session WHEN updateModelSetting({ mode: \"txt2img\", tier: \"draft\", modelId: \"owner/model\" }) aufgerufen wird THEN wird Validation + ModelSettingsService.update() ausgefuehrt", async () => {
    const updatedSetting = fakeModelSetting({
      mode: "txt2img",
      tier: "draft",
      modelId: "owner/model",
    });
    mockUpdate.mockResolvedValue(updatedSetting as any);

    const result = await updateModelSetting({
      mode: "txt2img" as any,
      tier: "draft" as any,
      modelId: "owner/model",
    });

    // Verify the service was called with the correct parameters
    expect(mockUpdate).toHaveBeenCalledWith("txt2img", "draft", "owner/model");
    // Verify the result is the service response
    expect(result).toEqual(updatedSetting);
  });
});
