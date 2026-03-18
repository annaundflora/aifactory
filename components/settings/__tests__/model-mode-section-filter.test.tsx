// @vitest-environment jsdom
/**
 * Tests for ModelModeSection Capability-Filter
 * Slice: slice-10-dropdown-filter
 *
 * Mocking Strategy: mock_external (no server actions called directly by this component)
 * This component is a presentational component that receives props.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills (Radix Select needs matchMedia, ResizeObserver, etc.)
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
// Test Data
// ---------------------------------------------------------------------------

import type { GenerationMode, Tier } from "@/lib/types";
import { ModelModeSection } from "@/components/settings/model-mode-section";

function makeModel(owner: string, name: string) {
  return {
    id: `uuid-${owner}-${name}`,
    replicateId: `${owner}/${name}`,
    owner,
    name,
    description: `${name} model`,
    coverImageUrl: null,
    runCount: 1000,
    collections: null,
    capabilities: { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const MOCK_MODELS = [
  makeModel("lab", "model-a"),
  makeModel("lab", "model-b"),
];

const MOCK_SETTINGS = [
  { id: "1", mode: "inpaint", tier: "quality", modelId: "lab/model-a", modelParams: {}, createdAt: new Date(), updatedAt: new Date() },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModelModeSection Capability-Filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-4: Empty-State syncing
  // =========================================================================

  /**
   * AC-4: GIVEN `getModels({ capability: "inpaint" })` gibt ein leeres Array zurueck
   *       und ein Sync laeuft gerade (`syncing` State)
   *       WHEN die INPAINT Section gerendert wird
   *       THEN zeigt der Dropdown die Empty-Message "Loading models... please wait."
   *            (State `empty:syncing`)
   */
  it("AC-4: should show syncing empty message when models empty and sync in progress", () => {
    render(
      <ModelModeSection
        mode="inpaint"
        settings={[]}
        models={[]}
        onModelChange={vi.fn()}
        syncState="syncing"
        hasEverSynced={false}
        syncFailed={false}
        otherModesHaveModels={false}
      />
    );

    expect(screen.getByText("INPAINT")).toBeInTheDocument();
    expect(
      screen.getByText("Loading models... please wait.")
    ).toBeInTheDocument();

    // Should NOT have any combobox triggers (since models are empty)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    // Verify the empty state test id
    expect(screen.getByTestId("empty-state-inpaint")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-5: Empty-State never-synced
  // =========================================================================

  /**
   * AC-5: GIVEN `getModels({ capability: "outpaint" })` gibt ein leeres Array zurueck
   *       und kein Sync hat jemals stattgefunden
   *       WHEN die OUTPAINT Section gerendert wird
   *       THEN zeigt der Dropdown die Empty-Message
   *            'No models available. Click "Sync Models" to load.'
   *            (State `empty:never-synced`)
   */
  it("AC-5: should show never-synced empty message when models empty and no sync has run", () => {
    render(
      <ModelModeSection
        mode="outpaint"
        settings={[]}
        models={[]}
        onModelChange={vi.fn()}
        syncState="idle"
        hasEverSynced={false}
        syncFailed={false}
        otherModesHaveModels={false}
      />
    );

    expect(screen.getByText("OUTPAINT")).toBeInTheDocument();
    expect(
      screen.getByText('No models available. Click "Sync Models" to load.')
    ).toBeInTheDocument();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-state-outpaint")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-6: Empty-State failed
  // =========================================================================

  /**
   * AC-6: GIVEN `getModels({ capability: "upscale" })` gibt ein leeres Array zurueck
   *       und der letzte Sync ist fehlgeschlagen
   *       WHEN die UPSCALE Section gerendert wird
   *       THEN zeigt der Dropdown die Empty-Message
   *            'Sync failed. Click "Sync Models" to retry.'
   *            (State `empty:failed`)
   */
  it("AC-6: should show failed empty message when models empty and last sync failed", () => {
    render(
      <ModelModeSection
        mode="upscale"
        settings={[]}
        models={[]}
        onModelChange={vi.fn()}
        syncState="idle"
        hasEverSynced={false}
        syncFailed={true}
        otherModesHaveModels={false}
      />
    );

    expect(screen.getByText("UPSCALE")).toBeInTheDocument();

    // Upscale mode has 2 tiers (quality, max), so the empty message appears twice
    const emptyMessages = screen.getAllByText('Sync failed. Click "Sync Models" to retry.');
    expect(emptyMessages).toHaveLength(2);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    // Both tiers show the empty state test id
    const emptyStates = screen.getAllByTestId("empty-state-upscale");
    expect(emptyStates).toHaveLength(2);
  });

  // =========================================================================
  // AC-7: Empty-State partial
  // =========================================================================

  /**
   * AC-7: GIVEN `getModels({ capability: "inpaint" })` gibt ein leeres Array zurueck,
   *       aber andere Modes haben Models, und der letzte Sync war partial
   *       WHEN die INPAINT Section gerendert wird
   *       THEN zeigt der Dropdown die Empty-Message
   *            'No models for this mode yet. Click "Sync Models" to retry.'
   *            (State `empty:partial`)
   */
  it("AC-7: should show partial empty message when models empty but other modes have models", () => {
    render(
      <ModelModeSection
        mode="inpaint"
        settings={[]}
        models={[]}
        onModelChange={vi.fn()}
        syncState="sync_partial"
        hasEverSynced={true}
        syncFailed={false}
        otherModesHaveModels={true}
      />
    );

    expect(screen.getByText("INPAINT")).toBeInTheDocument();
    expect(
      screen.getByText('No models for this mode yet. Click "Sync Models" to retry.')
    ).toBeInTheDocument();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-state-inpaint")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-9: Neue Props-Signatur
  // =========================================================================

  /**
   * AC-9: GIVEN `model-mode-section.tsx` Props
   *       WHEN die Component-Signatur geprueft wird
   *       THEN akzeptiert sie `models: Model[]` (aus DB) statt
   *            `collectionModels: CollectionModel[]` und NICHT mehr
   *            `compatibilityMap: Record<string, boolean>`
   */
  it("AC-9: should accept models prop of type Model[] instead of collectionModels and compatibilityMap", () => {
    // Render with the new `models` prop (Model[] type) -- if this compiles
    // and renders, the prop signature is correct. The old props
    // `collectionModels` and `compatibilityMap` would cause TypeScript errors.
    const { container } = render(
      <ModelModeSection
        mode="txt2img"
        settings={[]}
        models={MOCK_MODELS as any}
        onModelChange={vi.fn()}
      />
    );

    // The component renders successfully with models prop
    expect(container).toBeTruthy();
    expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();

    // Since we provided 2 models, there should be combobox triggers
    // (txt2img has 3 tiers: draft, quality, max)
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(3);
  });

  // =========================================================================
  // AC-11: onModelChange fuer inpaint mode
  // =========================================================================

  /**
   * AC-11: GIVEN der INPAINT Section Dropdown mit einem Model ausgewaehlt
   *        WHEN die `onModelChange` Callback aufgerufen wird
   *        THEN wird `updateModelSetting` mit `mode: "inpaint"` und dem gewaehlten
   *             `modelId` aufgerufen (gleiche Logik wie bestehende Modes)
   */
  it("AC-11: should call onModelChange with inpaint mode when model selected in inpaint section", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onModelChange = vi.fn();

    render(
      <ModelModeSection
        mode="inpaint"
        settings={[]}
        models={MOCK_MODELS as any}
        onModelChange={onModelChange}
      />
    );

    expect(screen.getByText("INPAINT")).toBeInTheDocument();

    // inpaint mode has 1 tier: quality -> 1 combobox
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(1);

    // Click the trigger to open the dropdown
    await user.click(triggers[0]);

    // Wait for options to appear
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(0);

    // Select the first model
    await user.click(options[0]);

    // onModelChange should have been called with inpaint mode, quality tier,
    // and the selected model's replicateId
    expect(onModelChange).toHaveBeenCalledWith(
      "inpaint",
      "quality",
      "lab/model-a"
    );
  });
});
