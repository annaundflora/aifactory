import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mock ModelSettingsService (Mocking Strategy: mock_external)
// The service layer is mocked so we test the Server Action logic in isolation.
// ---------------------------------------------------------------------------
const mockGetAll = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/services/model-settings-service", () => ({
  ModelSettingsService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

// Import AFTER mock setup
import { getModelSettings, updateModelSetting } from "@/app/actions/model-settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Factory for a fake ModelSetting row */
function fakeModelSetting(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    mode: "txt2img",
    tier: "draft",
    modelId: "owner/model-name",
    modelParams: {},
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

/** Generate N fake ModelSetting rows */
function fakeManySettings(n: number) {
  return Array.from({ length: n }, (_, i) =>
    fakeModelSetting({
      id: `00000000-0000-0000-0000-00000000000${i + 1}`,
      mode: ["txt2img", "img2img", "upscale"][i % 3],
      tier: ["draft", "quality", "max"][i % 3],
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getModelSettings", () => {
  // -------------------------------------------------------------------------
  // AC-4: GIVEN die model_settings Tabelle hat 8 Seed-Eintraege
  //        WHEN getModelSettings() aufgerufen wird
  //        THEN wird ein Array mit 8 ModelSetting-Objekten zurueckgegeben
  // -------------------------------------------------------------------------
  it("should return array of ModelSetting objects from service", async () => {
    const eightSettings = fakeManySettings(8);
    mockGetAll.mockResolvedValue(eightSettings);

    const result = await getModelSettings();

    expect(mockGetAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(8);
    expect(result).toEqual(eightSettings);
  });

  // -------------------------------------------------------------------------
  // AC-5: GIVEN die model_settings Tabelle ist leer
  //        WHEN getModelSettings() aufgerufen wird
  //        THEN werden zuerst Defaults geseeded und danach 8 ModelSetting-Objekte
  //             zurueckgegeben (delegiert an ModelSettingsService.getAll())
  // -------------------------------------------------------------------------
  it("should delegate to ModelSettingsService.getAll() which seeds defaults", async () => {
    // The seeding logic is inside ModelSettingsService.getAll() -- the server
    // action simply delegates. We verify that the action calls getAll() and
    // returns whatever it returns (the service handles empty-table seeding).
    const seededSettings = fakeManySettings(8);
    mockGetAll.mockResolvedValue(seededSettings);

    const result = await getModelSettings();

    expect(mockGetAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(8);
    expect(result).toEqual(seededSettings);
  });
});

describe("updateModelSetting", () => {
  // -------------------------------------------------------------------------
  // AC-6: GIVEN eine gueltige UpdateModelSettingInput mit
  //             { mode: "txt2img", tier: "draft", modelId: "owner/model-name" }
  //        WHEN updateModelSetting(input) aufgerufen wird
  //        THEN wird die aktualisierte ModelSetting-Zeile zurueckgegeben
  //             mit modelId: "owner/model-name"
  // -------------------------------------------------------------------------
  it("should return updated ModelSetting for valid input", async () => {
    const updated = fakeModelSetting({ modelId: "owner/model-name" });
    mockUpdate.mockResolvedValue(updated);

    const result = await updateModelSetting({
      mode: "txt2img",
      tier: "draft",
      modelId: "owner/model-name",
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith("txt2img", "draft", "owner/model-name");
    expect(result).toEqual(updated);
    expect((result as Record<string, unknown>).modelId).toBe("owner/model-name");
  });

  // -------------------------------------------------------------------------
  // AC-7: GIVEN eine UpdateModelSettingInput mit modelId: "invalid-format"
  //        WHEN updateModelSetting(input) aufgerufen wird
  //        THEN wird { error: "Invalid model ID format" } zurueckgegeben
  //             ohne DB-Schreibvorgang
  // -------------------------------------------------------------------------
  it("should return error for modelId without owner/name format", async () => {
    const result = await updateModelSetting({
      mode: "txt2img",
      tier: "draft",
      modelId: "invalid-format",
    });

    expect(result).toEqual({ error: "Invalid model ID format" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-8: GIVEN eine UpdateModelSettingInput mit modelId: "UPPER/Case"
  //        WHEN updateModelSetting(input) aufgerufen wird
  //        THEN wird { error: "Invalid model ID format" } zurueckgegeben
  //             (Regex: /^[a-z0-9-]+\/[a-z0-9._-]+$/)
  // -------------------------------------------------------------------------
  it("should return error for modelId with uppercase characters", async () => {
    const result = await updateModelSetting({
      mode: "txt2img",
      tier: "draft",
      modelId: "UPPER/Case",
    });

    expect(result).toEqual({ error: "Invalid model ID format" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-9: GIVEN eine UpdateModelSettingInput mit
  //             { mode: "upscale", tier: "max", modelId: "owner/model" }
  //        WHEN updateModelSetting(input) aufgerufen wird
  //        THEN wird { error: "Upscale mode does not support max tier" }
  //             zurueckgegeben ohne DB-Schreibvorgang
  // -------------------------------------------------------------------------
  it("should return error for upscale mode with max tier", async () => {
    const result = await updateModelSetting({
      mode: "upscale",
      tier: "max",
      modelId: "owner/model",
    });

    expect(result).toEqual({
      error: "Upscale mode does not support max tier",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-10: GIVEN eine UpdateModelSettingInput mit mode: "invalid" oder tier: "invalid"
  //         WHEN updateModelSetting(input) aufgerufen wird
  //         THEN wird ein Error-Objekt zurueckgegeben
  //              ("Invalid generation mode" bzw. "Invalid tier")
  // -------------------------------------------------------------------------
  it("should return error for invalid mode or tier values", async () => {
    // Invalid mode
    const resultBadMode = await updateModelSetting({
      mode: "invalid" as never,
      tier: "draft",
      modelId: "owner/model",
    });
    expect(resultBadMode).toEqual({ error: "Invalid generation mode" });
    expect(mockUpdate).not.toHaveBeenCalled();

    // Invalid tier
    const resultBadTier = await updateModelSetting({
      mode: "txt2img",
      tier: "invalid" as never,
      modelId: "owner/model",
    });
    expect(resultBadTier).toEqual({ error: "Invalid tier" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-11: GIVEN eine gueltige UpdateModelSettingInput fuer mode: "img2img"
  //              mit einem inkompatiblen Model
  //         WHEN updateModelSetting(input) aufgerufen wird
  //         THEN delegiert die Action an ModelSettingsService.update() und gibt
  //              dessen { error: "Model does not support this mode" } weiter
  // -------------------------------------------------------------------------
  it("should forward incompatibility error from ModelSettingsService", async () => {
    mockUpdate.mockResolvedValue({
      error: "Model does not support this mode",
    });

    const result = await updateModelSetting({
      mode: "img2img",
      tier: "draft",
      modelId: "owner/incompatible-model",
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      "img2img",
      "draft",
      "owner/incompatible-model"
    );
    expect(result).toEqual({
      error: "Model does not support this mode",
    });
  });

  // -------------------------------------------------------------------------
  // AC-12: GIVEN app/actions/model-settings.ts
  //         WHEN die Datei gelesen wird
  //         THEN beginnt sie mit "use server" (Next.js Server Action Pflicht)
  // -------------------------------------------------------------------------
  it('should export from a file with "use server" directive', () => {
    const filePath = resolve(__dirname, "..", "model-settings.ts");
    const content = readFileSync(filePath, "utf-8");
    const firstLine = content.trimStart().split(/\r?\n/)[0];

    expect(firstLine.trim()).toMatch(/^["']use server["'];?$/);
  });
});
