// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

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

  // Radix Dialog uses scrollTo
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

  // Radix Select uses hasPointerCapture / setPointerCapture / releasePointerCapture
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }

  // Radix Select scrolls to the selected item on open
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

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

interface MockModelSetting {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SEED_SETTINGS: MockModelSetting[] = [
  { id: "1", mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", mode: "txt2img", tier: "quality", modelId: "black-forest-labs/flux-1.1-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", mode: "txt2img", tier: "max", modelId: "black-forest-labs/flux-1.1-pro-ultra", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "5", mode: "img2img", tier: "quality", modelId: "black-forest-labs/flux-1.1-pro", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "6", mode: "img2img", tier: "max", modelId: "black-forest-labs/flux-1.1-pro-ultra", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "7", mode: "upscale", tier: "draft", modelId: "philz1337x/clarity-upscaler", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
  { id: "8", mode: "upscale", tier: "quality", modelId: "nightmareai/real-esrgan", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
];

// Mock models in the new Model type format (Drizzle-inferred from models table)
function makeModel(owner: string, name: string, overrides?: Record<string, unknown>) {
  return {
    id: `uuid-${owner}-${name}`,
    replicateId: `${owner}/${name}`,
    owner,
    name,
    description: `${name} model`,
    coverImageUrl: null,
    runCount: 1000,
    collections: null,
    capabilities: { txt2img: true, img2img: true, upscale: false, inpaint: false, outpaint: false },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const ALL_MODELS = [
  makeModel("black-forest-labs", "flux-schnell"),
  makeModel("black-forest-labs", "flux-1.1-pro"),
  makeModel("black-forest-labs", "flux-1.1-pro-ultra"),
  makeModel("nightmareai", "real-esrgan", { capabilities: { txt2img: false, img2img: false, upscale: true, inpaint: false, outpaint: false } }),
  makeModel("philz1337x", "clarity-upscaler", { capabilities: { txt2img: false, img2img: false, upscale: true, inpaint: false, outpaint: false } }),
];

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------

import { SettingsDialog } from "@/components/settings/settings-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  mockGetModelSettings.mockResolvedValue(SEED_SETTINGS);
  // getModels is called per-mode; return models based on capability filter
  mockGetModels.mockImplementation((input: { capability?: string }) => {
    if (!input.capability) return Promise.resolve(ALL_MODELS);
    return Promise.resolve(
      ALL_MODELS.filter((m) => {
        const caps = m.capabilities as Record<string, boolean>;
        return caps[input.capability!] === true;
      })
    );
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  /**
   * AC-2: GIVEN der Settings-Button im Header ist sichtbar
   *       WHEN der User auf den Settings-Button klickt
   *       THEN oeffnet sich ein modaler Dialog mit dem Titel "Model Settings"
   *            und einem Close-Button (X)
   */
  it('AC-2: should render modal with title "Model Settings" and close button when open', async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Model Settings")).toBeInTheDocument();
    });

    // Close button (X) is rendered by Radix with sr-only "Close" text
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();

    // It should be a modal dialog
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  /**
   * AC-3: GIVEN der Settings-Dialog ist geoeffnet
   *       WHEN der User ESC drueckt oder ausserhalb des Dialogs klickt
   *       THEN schliesst sich der Dialog
   */
  it("AC-3: should close when close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.getByText("Model Settings")).toBeInTheDocument();
    });

    // Click the X close button
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  /**
   * AC-4: GIVEN der Settings-Dialog ist geoeffnet
   *       WHEN der User den Dialog-Inhalt betrachtet
   *       THEN sind 5 Mode-Sections sichtbar: "TEXT TO IMAGE", "IMAGE TO IMAGE",
   *            "UPSCALE", "INPAINT", "OUTPAINT"
   */
  it("AC-4: should render TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, and OUTPAINT sections", async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });

    expect(screen.getByText("IMAGE TO IMAGE")).toBeInTheDocument();
    expect(screen.getByText("UPSCALE")).toBeInTheDocument();
    expect(screen.getByText("INPAINT")).toBeInTheDocument();
    expect(screen.getByText("OUTPAINT")).toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN der Settings-Dialog ist geoeffnet und `getModelSettings()` liefert
   *       die 8 Seed-Eintraege
   *       WHEN die Dropdowns gerendert werden
   *       THEN zeigt jeder Dropdown den aktuell zugewiesenen Model-Namen im Format
   *            `owner/name`
   */
  it("AC-5: should display current model assignments from getModelSettings in each dropdown", async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    // Wait for settings to load
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Each dropdown trigger (combobox) should show the current modelId
    // There should be 8 dropdowns for the modes that have models (txt2img:3, img2img:2, upscale:2)
    // plus empty-state text for inpaint and outpaint (no combobox for those)
    await waitFor(() => {
      const triggers = screen.getAllByRole("combobox");
      // txt2img(3) + img2img(2) + upscale(2) = 7 comboboxes
      // inpaint and outpaint have no models, so they show empty state text instead
      expect(triggers.length).toBeGreaterThanOrEqual(7);
    });

    // Verify model IDs are displayed in the trigger texts
    await waitFor(() => {
      // flux-schnell appears for txt2img/draft and img2img/draft
      expect(screen.getAllByText("black-forest-labs/flux-schnell")).toHaveLength(2);
      // flux-1.1-pro appears for txt2img/quality and img2img/quality
      expect(screen.getAllByText("black-forest-labs/flux-1.1-pro")).toHaveLength(2);
      // flux-1.1-pro-ultra appears for txt2img/max and img2img/max
      expect(screen.getAllByText("black-forest-labs/flux-1.1-pro-ultra")).toHaveLength(2);
      // upscale models appear once each
      expect(screen.getAllByText("philz1337x/clarity-upscaler")).toHaveLength(1);
      expect(screen.getAllByText("nightmareai/real-esrgan")).toHaveLength(1);
    });
  });

  /**
   * AC-8: GIVEN ein Dropdown ist geoeffnet und alle Models sind geladen
   *       WHEN der User ein kompatibles Model auswaehlt
   *       THEN wird `updateModelSetting()` mit dem korrekten
   *            `{ mode, tier, modelId }` aufgerufen, der Dropdown schliesst sich,
   *            und der neue Model-Name wird sofort angezeigt (Auto-Save)
   */
  it("AC-8: should call updateModelSetting with correct mode, tier, and modelId on selection", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    // Return updated setting after update
    mockUpdateModelSetting.mockResolvedValue({
      id: "1",
      mode: "txt2img",
      tier: "draft",
      modelId: "black-forest-labs/flux-1.1-pro",
      modelParams: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });

    // Wait for models and settings to load
    await waitFor(() => {
      expect(mockGetModels).toHaveBeenCalled();
    });

    // Find all dropdown triggers -- first one is txt2img/draft
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(1);

    // Click the first trigger (txt2img/draft) to open the dropdown
    await user.click(triggers[0]);

    // Wait for the dropdown options to appear
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(0);
    });

    // Select a different model: flux-1.1-pro
    // (not the current "flux-schnell" to trigger a change)
    const targetOption = screen.getAllByRole("option").find((opt) =>
      opt.textContent?.includes("flux-1.1-pro") && !opt.textContent?.includes("ultra")
    );
    expect(targetOption).toBeDefined();
    await user.click(targetOption!);

    // updateModelSetting should have been called with the correct parameters
    await waitFor(() => {
      expect(mockUpdateModelSetting).toHaveBeenCalledWith({
        mode: "txt2img",
        tier: "draft",
        modelId: "black-forest-labs/flux-1.1-pro",
      });
    });
  });

  /**
   * AC-9: GIVEN der User hat ein Model in der txt2img/Draft-Dropdown geaendert
   *       WHEN der User den Dialog schliesst und erneut ueber den Settings-Button oeffnet
   *       THEN zeigt der txt2img/Draft-Dropdown die neue Auswahl
   *            (Persistenz ueber `getModelSettings()`)
   */
  it("AC-9: should show updated model after closing and reopening dialog", async () => {
    // Use a model ID that is clearly unique, not used in any other mode
    const newModelId = "stability-ai/sdxl";

    const updatedSettings = SEED_SETTINGS.map((s) =>
      s.mode === "txt2img" && s.tier === "draft"
        ? { ...s, modelId: newModelId }
        : s
    );

    // First open: original settings
    mockGetModelSettings.mockResolvedValueOnce(SEED_SETTINGS);
    // Second open: updated settings (simulating persistence)
    mockGetModelSettings.mockResolvedValueOnce(updatedSettings);

    const { rerender } = render(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(1);
    });

    // Verify original model is displayed
    await waitFor(() => {
      expect(
        screen.getAllByText("black-forest-labs/flux-schnell").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Close dialog
    rerender(<SettingsDialog open={false} onOpenChange={vi.fn()} />);

    // Reopen dialog -- should call getModelSettings again
    rerender(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(mockGetModelSettings).toHaveBeenCalledTimes(2);
    });

    // After reopen, the new model ID should be displayed
    await waitFor(() => {
      expect(screen.getByText(newModelId)).toBeInTheDocument();
    });
  });

  /**
   * AC-10: GIVEN `getModels()` schlaegt fehl (Netzwerkfehler)
   *        WHEN ein Dropdown die Models laden will
   *        THEN wird eine Empty-State-Message angezeigt anstelle der Model-Liste
   */
  it("AC-10: should show empty state message when getModels fails", async () => {
    mockGetModels.mockResolvedValue({
      error: "Network error",
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      // When models fail to load, sections show empty state messages
      // (since models arrays are empty and hasEverSynced is false)
      const emptyMessages = screen.getAllByText(/No models available/);
      expect(emptyMessages.length).toBeGreaterThan(0);
    });
  });
});
