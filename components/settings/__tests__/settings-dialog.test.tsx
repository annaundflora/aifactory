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

const mockGetCollectionModels = vi.fn();
const mockCheckImg2ImgSupport = vi.fn();

vi.mock("@/app/actions/models", () => ({
  getCollectionModels: (...args: unknown[]) => mockGetCollectionModels(...args),
  checkImg2ImgSupport: (...args: unknown[]) =>
    mockCheckImg2ImgSupport(...args),
}));

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

import type { CollectionModel } from "@/lib/types/collection-model";

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

const COLLECTION_MODELS: CollectionModel[] = [
  { url: "https://replicate.com/black-forest-labs/flux-schnell", owner: "black-forest-labs", name: "flux-schnell", description: "Fast flux model", cover_image_url: null, run_count: 1000, created_at: "2024-01-01" },
  { url: "https://replicate.com/black-forest-labs/flux-1.1-pro", owner: "black-forest-labs", name: "flux-1.1-pro", description: "Pro flux model", cover_image_url: null, run_count: 2000, created_at: "2024-01-02" },
  { url: "https://replicate.com/black-forest-labs/flux-1.1-pro-ultra", owner: "black-forest-labs", name: "flux-1.1-pro-ultra", description: "Ultra flux model", cover_image_url: null, run_count: 500, created_at: "2024-01-03" },
  { url: "https://replicate.com/nightmareai/real-esrgan", owner: "nightmareai", name: "real-esrgan", description: "Upscaler", cover_image_url: null, run_count: 800, created_at: "2024-01-04" },
  { url: "https://replicate.com/philz1337x/clarity-upscaler", owner: "philz1337x", name: "clarity-upscaler", description: "Clarity upscaler", cover_image_url: null, run_count: 600, created_at: "2024-01-05" },
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
  mockGetCollectionModels.mockResolvedValue(COLLECTION_MODELS);
  mockCheckImg2ImgSupport.mockResolvedValue(true);
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
   *       THEN sind 3 Mode-Sections sichtbar: "TEXT TO IMAGE", "IMAGE TO IMAGE",
   *            "UPSCALE"
   */
  it("AC-4: should render TEXT TO IMAGE, IMAGE TO IMAGE, and UPSCALE sections", async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });

    expect(screen.getByText("IMAGE TO IMAGE")).toBeInTheDocument();
    expect(screen.getByText("UPSCALE")).toBeInTheDocument();
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
    // There should be 8 dropdowns total (3 + 3 + 2)
    await waitFor(() => {
      const triggers = screen.getAllByRole("combobox");
      expect(triggers).toHaveLength(8);
    });

    // Verify model IDs are displayed in the trigger texts
    // Since some model IDs appear in multiple modes, we use getAllByText
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
      modelId: "nightmareai/real-esrgan",
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
      expect(mockGetCollectionModels).toHaveBeenCalled();
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

    // Select a different model: nightmareai/real-esrgan
    // (not the current "flux-schnell" to trigger a change)
    const targetOption = screen.getAllByRole("option").find((opt) =>
      opt.textContent?.includes("real-esrgan")
    );
    expect(targetOption).toBeDefined();
    await user.click(targetOption!);

    // updateModelSetting should have been called with the correct parameters
    await waitFor(() => {
      expect(mockUpdateModelSetting).toHaveBeenCalledWith({
        mode: "txt2img",
        tier: "draft",
        modelId: "nightmareai/real-esrgan",
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
   * AC-10: GIVEN `getCollectionModels()` schlaegt fehl (Netzwerkfehler)
   *        WHEN ein Dropdown die Models laden will
   *        THEN wird eine Fehlermeldung angezeigt anstelle der Model-Liste
   */
  it("AC-10: should show error message when getCollectionModels fails", async () => {
    mockGetCollectionModels.mockResolvedValue({
      error: "Network error",
    });

    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      // The error message "Could not load models" should appear
      // (rendered by ModelModeSection when collectionError is set)
      const errorMessages = screen.getAllByText("Could not load models");
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });
});
