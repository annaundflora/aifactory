import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mock ModelSlotService (Mocking Strategy: mock_external)
// The service layer is mocked so we test the Server Action logic in isolation.
// ---------------------------------------------------------------------------
const mockGetAll = vi.fn();
const mockUpdate = vi.fn();
const mockClear = vi.fn();

vi.mock("@/lib/services/model-slot-service", () => ({
  ModelSlotService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    clear: (...args: unknown[]) => mockClear(...args),
  },
}));

// requireAuth is globally mocked in vitest.setup.ts to return
// { userId: "mock-user-id", email: "test@example.com" } (authenticated).
// We import the mock here so we can override it per-test for unauth scenarios.
import { requireAuth } from "@/lib/auth/guard";
const mockRequireAuth = vi.mocked(requireAuth);

// Import AFTER mock setup
import {
  getModelSlots,
  updateModelSlot,
} from "@/app/actions/model-slots";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Factory for a fake ModelSlot row */
function fakeModelSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    mode: "txt2img",
    slot: 1,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

/** Generate N fake ModelSlot rows */
function fakeManySlots(n: number) {
  return Array.from({ length: n }, (_, i) =>
    fakeModelSlot({
      id: `00000000-0000-0000-0000-00000000000${i + 1}`,
      mode: ["txt2img", "img2img", "upscale", "inpaint", "outpaint"][i % 5],
      slot: (i % 3) + 1,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset requireAuth to authenticated (default from vitest.setup.ts)
  mockRequireAuth.mockResolvedValue({
    userId: "mock-user-id",
    email: "test@example.com",
  });
});

describe("getModelSlots", () => {
  it("should return Unauthorized error when not authenticated on getModelSlots", async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: "Unauthorized" });

    const result = await getModelSlots();

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetAll).not.toHaveBeenCalled();
  });

  it("should return ModelSlot array from service when authenticated on getModelSlots", async () => {
    const slots = fakeManySlots(15);
    mockGetAll.mockResolvedValue(slots);

    const result = await getModelSlots();

    expect(mockGetAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(15);
    expect(result).toEqual(slots);
  });
});

describe("updateModelSlot", () => {
  it("should call ModelSlotService.update with validated input and return result", async () => {
    const updated = fakeModelSlot({ modelId: "black-forest-labs/flux-2-pro" });
    mockUpdate.mockResolvedValue(updated);

    const result = await updateModelSlot({
      mode: "txt2img",
      slot: 1,
      modelId: "black-forest-labs/flux-2-pro",
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      "txt2img",
      1,
      "black-forest-labs/flux-2-pro",
      undefined
    );
    expect(result).toEqual(updated);
  });

  it("should return error for invalid generation mode without calling service", async () => {
    const result = await updateModelSlot({
      mode: "invalid_mode" as never,
      slot: 1,
      modelId: "org/model",
    });

    expect(result).toEqual({ error: "Invalid generation mode" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should return error for slot number outside 1-3 without calling service", async () => {
    const result = await updateModelSlot({
      mode: "txt2img",
      slot: 5 as never,
      modelId: "org/model",
    });

    expect(result).toEqual({ error: "Invalid slot number" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should return error for modelId not matching regex without calling service", async () => {
    const result = await updateModelSlot({
      mode: "txt2img",
      slot: 1,
      modelId: "INVALID FORMAT!",
    });

    expect(result).toEqual({ error: "Invalid model ID format" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should forward modelParams to ModelSlotService.update when provided", async () => {
    const updated = fakeModelSlot({
      modelId: "org/model",
      modelParams: { guidance: 3.5 },
    });
    mockUpdate.mockResolvedValue(updated);

    const result = await updateModelSlot({
      mode: "txt2img",
      slot: 1,
      modelId: "org/model",
      modelParams: { guidance: 3.5 },
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      "txt2img",
      1,
      "org/model",
      { guidance: 3.5 }
    );
    expect(result).toEqual(updated);
  });

  it("should return Unauthorized on updateModelSlot when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: "Unauthorized" });

    const result = await updateModelSlot({
      mode: "txt2img",
      slot: 1,
      modelId: "org/model",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("Module exports and file structure", () => {
  it("should export getModelSlots and updateModelSlot from model-slots.ts", () => {
    // Verify old file is deleted
    const oldFilePath = resolve(__dirname, "..", "model-settings.ts");
    expect(existsSync(oldFilePath)).toBe(false);

    // Verify new file exists and has "use server" directive
    const newFilePath = resolve(__dirname, "..", "model-slots.ts");
    expect(existsSync(newFilePath)).toBe(true);
    const content = readFileSync(newFilePath, "utf-8");
    const firstLine = content.trimStart().split(/\r?\n/)[0];
    expect(firstLine.trim()).toMatch(/^["']use server["'];?$/);

    // Verify that the actions are exported (imported above)
    expect(typeof getModelSlots).toBe("function");
    expect(typeof updateModelSlot).toBe("function");
  });
});
