// @vitest-environment jsdom
/**
 * Tests for SettingsDialog Capability-Filter
 * Slice: slice-10-dropdown-filter
 *
 * Mocking Strategy: mock_external
 * - Server actions (getModels, getModelSettings, updateModelSetting) mocked
 * - fetch mocked to prevent real network calls
 * - sonner toast mocked
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Polyfills (Radix Dialog / Select needs matchMedia, ResizeObserver, etc.)
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

const mockGetModelSettings = vi.fn();
const mockUpdateModelSetting = vi.fn();

vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: (...args: unknown[]) => mockGetModelSettings(...args),
  updateModelSetting: (...args: unknown[]) => mockUpdateModelSetting(...args),
}));

const mockGetModels = vi.fn();

vi.mock("@/app/actions/models", () => ({
  getModels: (...args: unknown[]) => mockGetModels(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn().mockReturnValue("toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function makeModel(owner: string, name: string, caps: Record<string, boolean>) {
  return {
    id: `uuid-${owner}-${name}`,
    replicateId: `${owner}/${name}`,
    owner,
    name,
    description: `${name} model`,
    coverImageUrl: null,
    runCount: 1000,
    collections: null,
    capabilities: { txt2img: false, img2img: false, upscale: false, inpaint: false, outpaint: false, ...caps },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 3 txt2img models
const TXT2IMG_MODELS = [
  makeModel("lab", "flux-schnell", { txt2img: true }),
  makeModel("lab", "flux-pro", { txt2img: true }),
  makeModel("lab", "flux-ultra", { txt2img: true }),
];

// 2 img2img models
const IMG2IMG_MODELS = [
  makeModel("lab", "flux-schnell-i2i", { img2img: true }),
  makeModel("lab", "flux-pro-i2i", { img2img: true }),
];

// 1 upscale model
const UPSCALE_MODELS = [
  makeModel("nightmareai", "real-esrgan", { upscale: true }),
];

// 1 inpaint model
const INPAINT_MODELS = [
  makeModel("stability", "inpaint-v1", { inpaint: true }),
];

// 1 outpaint model
const OUTPAINT_MODELS = [
  makeModel("stability", "outpaint-v1", { outpaint: true }),
];

const SEED_SETTINGS = [
  { id: "1", mode: "txt2img", tier: "draft", modelId: "lab/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", mode: "txt2img", tier: "quality", modelId: "lab/flux-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", mode: "txt2img", tier: "max", modelId: "lab/flux-ultra", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", mode: "img2img", tier: "draft", modelId: "lab/flux-schnell-i2i", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "5", mode: "img2img", tier: "quality", modelId: "lab/flux-pro-i2i", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
];

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { SettingsDialog } from "@/components/settings/settings-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sets up mocks so that getModels returns capability-filtered models.
 */
function setupModelsPerCapability() {
  mockGetModels.mockImplementation((input: { capability?: string }) => {
    switch (input.capability) {
      case "txt2img":
        return Promise.resolve(TXT2IMG_MODELS);
      case "img2img":
        return Promise.resolve(IMG2IMG_MODELS);
      case "upscale":
        return Promise.resolve(UPSCALE_MODELS);
      case "inpaint":
        return Promise.resolve(INPAINT_MODELS);
      case "outpaint":
        return Promise.resolve(OUTPAINT_MODELS);
      default:
        return Promise.resolve([]);
    }
  });
}

function renderDialog() {
  return render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsDialog Capability-Filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelSettings.mockResolvedValue(SEED_SETTINGS);
    setupModelsPerCapability();
    // Mock fetch to prevent real network calls (sync button)
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AC-1: getModels pro Mode statt getCollectionModels
  // =========================================================================

  /**
   * AC-1: GIVEN das Settings-Dialog wird geoeffnet
   *       WHEN `settings-dialog.tsx` die Model-Daten laedt
   *       THEN wird pro Mode ein separater `getModels({ capability: mode })` Server-Action-Call
   *            ausgefuehrt (5 Calls fuer txt2img, img2img, upscale, inpaint, outpaint)
   *            und NICHT mehr `getCollectionModels()`
   */
  it("AC-1: should call getModels with capability filter for each of 5 modes", async () => {
    renderDialog();

    // Wait for all getModels calls to complete
    await waitFor(() => {
      expect(mockGetModels).toHaveBeenCalledTimes(5);
    });

    // Verify each mode gets its own call
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "txt2img" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "img2img" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "upscale" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "inpaint" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "outpaint" });
  });

  // =========================================================================
  // AC-2: Korrekte Anzahl Models pro Section
  // =========================================================================

  /**
   * AC-2: GIVEN Models in der DB mit `capabilities.txt2img = true` (3 Stueck)
   *       und `capabilities.img2img = true` (2 Stueck)
   *       WHEN das Settings-Dialog gerendert wird
   *       THEN zeigt die TEXT TO IMAGE Section genau 3 Models in den Dropdowns
   *            und die IMAGE TO IMAGE Section genau 2 Models
   */
  it("AC-2: should pass filtered models to each mode section", async () => {
    renderDialog();

    // Wait for sections to render
    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });

    // Wait for models to load
    await waitFor(() => {
      expect(mockGetModels).toHaveBeenCalledTimes(5);
    });

    // TEXT TO IMAGE section should have 3 dropdowns (draft, quality, max tiers)
    // with 3 models each. We can verify by checking the comboboxes exist.
    // txt2img has 3 tiers -> 3 comboboxes
    // img2img has 2 tiers -> 2 comboboxes
    // upscale has 2 tiers -> 2 comboboxes
    // inpaint has 1 tier -> 1 combobox
    // outpaint has 1 tier -> 1 combobox
    // Total: 9 comboboxes (all sections have at least 1 model)
    await waitFor(() => {
      const triggers = screen.getAllByRole("combobox");
      expect(triggers).toHaveLength(9);
    });

    // Verify txt2img models are rendered (these model names appear in the selected value)
    // The 3 txt2img model names come from the seed settings
    await waitFor(() => {
      expect(screen.getByText("lab/flux-schnell")).toBeInTheDocument();
      expect(screen.getByText("lab/flux-pro")).toBeInTheDocument();
      expect(screen.getByText("lab/flux-ultra")).toBeInTheDocument();
    });

    // Verify img2img models (2 from seed settings)
    await waitFor(() => {
      expect(screen.getByText("lab/flux-schnell-i2i")).toBeInTheDocument();
      expect(screen.getByText("lab/flux-pro-i2i")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // AC-3: 5 Sections in korrekter Reihenfolge
  // =========================================================================

  /**
   * AC-3: GIVEN das Settings-Dialog rendert 5 Sections
   *       WHEN die Section-Reihenfolge geprueft wird
   *       THEN ist sie: TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, OUTPAINT
   *            (gemaess `MODES` Array mit 5 Eintraegen)
   */
  it("AC-3: should render 5 mode sections in order: txt2img, img2img, upscale, inpaint, outpaint", async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });

    const expectedLabels = [
      "TEXT TO IMAGE",
      "IMAGE TO IMAGE",
      "UPSCALE",
      "INPAINT",
      "OUTPAINT",
    ];

    // All 5 labels must be present
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Verify ordering: collect all section heading elements and check their order
    // Section headings are rendered as h3 elements with uppercase tracking
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);

    // The headings should appear in the correct order
    const filteredHeadings = headingTexts.filter((t) =>
      expectedLabels.includes(t ?? "")
    );
    expect(filteredHeadings).toEqual(expectedLabels);
  });

  // =========================================================================
  // AC-8: Event-basiertes Refresh
  // =========================================================================

  /**
   * AC-8: GIVEN das Settings-Dialog ist geoeffnet und zeigt 2 Models in TEXT TO IMAGE
   *       WHEN ein `window` Event `"model-slots-changed"` dispatched wird
   *       THEN werden die Model-Daten automatisch neu geladen (erneute `getModels`-Calls)
   *            und die Dropdowns aktualisieren sich
   */
  it("AC-8: should reload models when model-slots-changed event is dispatched", async () => {
    renderDialog();

    // Wait for initial load (5 getModels calls)
    await waitFor(() => {
      expect(mockGetModels).toHaveBeenCalledTimes(5);
    });

    // Clear call counts to track the reload
    mockGetModels.mockClear();

    // Dispatch the event
    await act(async () => {
      window.dispatchEvent(new Event("model-slots-changed"));
    });

    // getModels should be called again (5 times, once per mode)
    await waitFor(() => {
      expect(mockGetModels).toHaveBeenCalledTimes(5);
    });

    // Verify each capability was re-requested
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "txt2img" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "img2img" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "upscale" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "inpaint" });
    expect(mockGetModels).toHaveBeenCalledWith({ capability: "outpaint" });
  });

  // =========================================================================
  // AC-10: Alte Imports entfernt
  // =========================================================================

  /**
   * AC-10: GIVEN `settings-dialog.tsx` Imports
   *        WHEN die Imports geprueft werden
   *        THEN existiert KEIN Import von `getCollectionModels`, KEIN Import von
   *             `checkImg2ImgSupport`, und KEIN Import von `CollectionModel`
   */
  it("AC-10: should not import getCollectionModels or checkImg2ImgSupport or CollectionModel", () => {
    // Static analysis test: read the source file and verify no legacy imports
    const sourceFilePath = path.resolve(
      __dirname,
      "..",
      "settings-dialog.tsx"
    );
    const sourceCode = fs.readFileSync(sourceFilePath, "utf-8");

    expect(sourceCode).not.toContain("getCollectionModels");
    expect(sourceCode).not.toContain("checkImg2ImgSupport");
    expect(sourceCode).not.toContain("CollectionModel");
  });
});
