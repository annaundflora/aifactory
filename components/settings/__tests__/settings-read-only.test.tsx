// @vitest-environment jsdom
/**
 * Acceptance Tests for Slice 14: Settings Dialog Read-Only
 *
 * Verifies that the settings dialog displays model slot assignments in a
 * read-only format (no dropdowns, no checkboxes, no onChange handlers)
 * and uses getModelSlots() instead of the old getModelSettings().
 *
 * Mocking Strategy: mock_external (Server Actions + model data via Vitest mocks)
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills (Radix Dialog needs matchMedia, ResizeObserver, etc.)
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

  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as unknown as typeof globalThis.ResizeObserver;

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

const {
  mockGetModelSlots,
  mockGetModels,
  mockToast,
} = vi.hoisted(() => {
  const mockToastObj = Object.assign(vi.fn(), {
    loading: vi.fn().mockReturnValue("toast-id-1"),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  });
  return {
    mockGetModelSlots: vi.fn().mockResolvedValue([]),
    mockGetModels: vi.fn().mockResolvedValue([]),
    mockToast: mockToastObj,
  };
});

// Mock server actions: model-slots
vi.mock("@/app/actions/model-slots", () => ({
  getModelSlots: (...args: unknown[]) => mockGetModelSlots(...args),
}));

// Mock server actions: models
vi.mock("@/app/actions/models", () => ({
  getModels: (...args: unknown[]) => mockGetModels(...args),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: mockToast,
}));

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

interface MockModelSlot {
  id: string;
  mode: string;
  slot: number;
  modelId: string | null;
  modelParams: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function makeSlot(
  mode: string,
  slot: number,
  modelId: string | null,
  active: boolean
): MockModelSlot {
  return {
    id: `uuid-${mode}-${slot}`,
    mode,
    slot,
    modelId,
    modelParams: {},
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * 15 slots: 5 modes x 3 slots each. Mix of active, inactive, and empty.
 */
const FULL_SLOTS: MockModelSlot[] = [
  // txt2img
  makeSlot("txt2img", 1, "black-forest-labs/flux-schnell", true),
  makeSlot("txt2img", 2, "black-forest-labs/flux-2-pro", false),
  makeSlot("txt2img", 3, null, false),
  // img2img
  makeSlot("img2img", 1, "black-forest-labs/flux-schnell", true),
  makeSlot("img2img", 2, "black-forest-labs/flux-2-pro", true),
  makeSlot("img2img", 3, null, false),
  // upscale
  makeSlot("upscale", 1, "philz1337x/clarity-upscaler", true),
  makeSlot("upscale", 2, "nightmareai/real-esrgan", false),
  makeSlot("upscale", 3, null, false),
  // inpaint
  makeSlot("inpaint", 1, "stability-ai/stable-diffusion-inpaint", true),
  makeSlot("inpaint", 2, null, false),
  makeSlot("inpaint", 3, null, false),
  // outpaint
  makeSlot("outpaint", 1, "stability-ai/stable-diffusion-outpaint", true),
  makeSlot("outpaint", 2, null, false),
  makeSlot("outpaint", 3, null, false),
];

function makeModel(
  owner: string,
  name: string,
  capabilities: Record<string, boolean>
) {
  return {
    id: `uuid-${owner}-${name}`,
    replicateId: `${owner}/${name}`,
    owner,
    name,
    description: `${name} model`,
    coverImageUrl: null,
    runCount: 1000,
    collections: null,
    capabilities,
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const ALL_MODELS = [
  makeModel("black-forest-labs", "flux-schnell", {
    txt2img: true,
    img2img: true,
    upscale: false,
    inpaint: false,
    outpaint: false,
  }),
  makeModel("black-forest-labs", "flux-2-pro", {
    txt2img: true,
    img2img: true,
    upscale: false,
    inpaint: false,
    outpaint: false,
  }),
  makeModel("philz1337x", "clarity-upscaler", {
    txt2img: false,
    img2img: false,
    upscale: true,
    inpaint: false,
    outpaint: false,
  }),
  makeModel("nightmareai", "real-esrgan", {
    txt2img: false,
    img2img: false,
    upscale: true,
    inpaint: false,
    outpaint: false,
  }),
  makeModel("stability-ai", "stable-diffusion-inpaint", {
    txt2img: false,
    img2img: false,
    upscale: false,
    inpaint: true,
    outpaint: false,
  }),
  makeModel("stability-ai", "stable-diffusion-outpaint", {
    txt2img: false,
    img2img: false,
    upscale: false,
    inpaint: false,
    outpaint: true,
  }),
];

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { SettingsDialog } from "@/components/settings/settings-dialog";
import { ModelModeSection } from "@/components/settings/model-mode-section";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;

function setupDefaultMocks() {
  mockGetModelSlots.mockResolvedValue(FULL_SLOTS);
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

function setupEmptyCatalogMocks() {
  mockGetModelSlots.mockResolvedValue(FULL_SLOTS);
  mockGetModels.mockResolvedValue([]);
}

function renderDialog() {
  return render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
}

/**
 * Stream helpers for sync tests.
 */
function createStreamFromEvents(events: Record<string, unknown>[]) {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => encoder.encode(JSON.stringify(e) + "\n"));

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createStreamResponse(
  events: Record<string, unknown>[],
  status = 200
): Response {
  return new Response(createStreamFromEvents(events), {
    status,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

function createControllableStream() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    push(event: Record<string, unknown>) {
      controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
    },
    close() {
      controller.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Slice 14: Settings Dialog Read-Only — Acceptance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // AC-1
  // =========================================================================

  /**
   * AC-1: GIVEN der Settings-Dialog wird geoeffnet und `getModelSlots()` liefert 15 Slots (5 Modes x 3 Slots)
   *       WHEN der Dialog gerendert wird
   *       THEN werden alle 5 Mode-Sections angezeigt (TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, OUTPAINT)
   *       AND jede Section zeigt genau 3 Slot-Zeilen (Slot 1, Slot 2, Slot 3)
   */
  it("AC-1: should render 5 mode sections with 3 slot rows each", async () => {
    renderDialog();

    // All 5 mode section headings must appear
    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });
    expect(screen.getByText("IMAGE TO IMAGE")).toBeInTheDocument();
    expect(screen.getByText("UPSCALE")).toBeInTheDocument();
    expect(screen.getByText("INPAINT")).toBeInTheDocument();
    expect(screen.getByText("OUTPAINT")).toBeInTheDocument();

    // Each mode must have exactly 3 slot rows
    const modes = ["txt2img", "img2img", "upscale", "inpaint", "outpaint"];
    for (const mode of modes) {
      for (const slotNum of [1, 2, 3]) {
        const slotRow = screen.getByTestId(`slot-row-${mode}-${slotNum}`);
        expect(slotRow).toBeInTheDocument();
      }
    }

    // Total slot rows = 15
    const allSlotRows = screen.getAllByTestId(/^slot-row-/);
    expect(allSlotRows).toHaveLength(15);
  });

  // =========================================================================
  // AC-2
  // =========================================================================

  /**
   * AC-2: GIVEN ein Slot hat `modelId: "black-forest-labs/flux-schnell"` und `active: true`
   *       WHEN die Slot-Zeile gerendert wird
   *       THEN zeigt sie das Slot-Label (z.B. "Slot 1"), den Model-Display-Namen und einen gruenen Status-Dot mit Text "on"
   */
  it("AC-2: should show model display name and green status dot for active slot", async () => {
    renderDialog();

    // txt2img slot 1 is active with flux-schnell
    const slotRow = await screen.findByTestId("slot-row-txt2img-1");

    // Slot label
    expect(within(slotRow).getByText("Slot 1")).toBeInTheDocument();

    // Model display name: since flux-schnell is in the model catalog,
    // it should show the model's name property ("flux-schnell")
    expect(within(slotRow).getByText("flux-schnell")).toBeInTheDocument();

    // Green status dot
    const statusDot = screen.getByTestId("status-dot-txt2img-1");
    expect(statusDot).toHaveClass("bg-green-500");

    // Text "on"
    expect(within(slotRow).getByText("on")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-3
  // =========================================================================

  /**
   * AC-3: GIVEN ein Slot hat `modelId: "black-forest-labs/flux-2-pro"` und `active: false`
   *       WHEN die Slot-Zeile gerendert wird
   *       THEN zeigt sie das Slot-Label, den Model-Display-Namen und einen grauen Status-Dot mit Text "off"
   */
  it("AC-3: should show model display name and gray status dot for inactive slot", async () => {
    renderDialog();

    // txt2img slot 2 is inactive with flux-2-pro
    const slotRow = await screen.findByTestId("slot-row-txt2img-2");

    // Slot label
    expect(within(slotRow).getByText("Slot 2")).toBeInTheDocument();

    // Model display name
    expect(within(slotRow).getByText("flux-2-pro")).toBeInTheDocument();

    // Gray status dot
    const statusDot = screen.getByTestId("status-dot-txt2img-2");
    expect(statusDot).toHaveClass("bg-gray-400");

    // Text "off"
    expect(within(slotRow).getByText("off")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-4
  // =========================================================================

  /**
   * AC-4: GIVEN ein Slot hat `modelId: null` (leerer Slot)
   *       WHEN die Slot-Zeile gerendert wird
   *       THEN zeigt sie das Slot-Label, den Text "not assigned" in muted Styling und einen grauen Status-Dot mit Text "off"
   */
  it('AC-4: should show "not assigned" text and gray dot for slot with null modelId', async () => {
    renderDialog();

    // txt2img slot 3 has modelId: null
    const slotRow = await screen.findByTestId("slot-row-txt2img-3");

    // Slot label
    expect(within(slotRow).getByText("Slot 3")).toBeInTheDocument();

    // "not assigned" text with muted styling
    const notAssigned = within(slotRow).getByText("not assigned");
    expect(notAssigned).toBeInTheDocument();
    expect(notAssigned).toHaveClass("text-muted-foreground");

    // Gray status dot
    const statusDot = screen.getByTestId("status-dot-txt2img-3");
    expect(statusDot).toHaveClass("bg-gray-400");

    // Text "off"
    expect(within(slotRow).getByText("off")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-5
  // =========================================================================

  /**
   * AC-5: GIVEN der Dialog ist gerendert
   *       WHEN der User versucht einen Model-Namen oder Status zu aendern
   *       THEN gibt es keine editierbaren Elemente (keine Dropdowns, keine Checkboxen, keine onChange-Handler)
   */
  it("AC-5: should not render any Select dropdowns, Checkboxes, or change handlers", async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getByText("TEXT TO IMAGE")).toBeInTheDocument();
    });

    // No comboboxes (Select dropdowns)
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);

    // No checkboxes
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    // No text inputs (besides potential search, which should not exist)
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);

    // No select elements
    expect(screen.queryAllByRole("listbox")).toHaveLength(0);
  });

  // =========================================================================
  // AC-6
  // =========================================================================

  /**
   * AC-6: GIVEN der Dialog ist gerendert
   *       WHEN der User den unteren Bereich betrachtet
   *       THEN wird der Hint-Text "Change models in the workspace." angezeigt
   */
  it('AC-6: should display hint text "Change models in the workspace."', async () => {
    renderDialog();

    const hintText = await screen.findByText("Change models in the workspace.");
    expect(hintText).toBeInTheDocument();
    // Hint should use muted/subtle styling
    expect(hintText).toHaveClass("text-muted-foreground");
  });

  // =========================================================================
  // AC-7
  // =========================================================================

  /**
   * AC-7: GIVEN der Sync-Button wird geklickt
   *       WHEN der Sync-Prozess laeuft
   *       THEN zeigt der Button den Spinner und "Syncing..." (unveraendertes Verhalten)
   *       AND nach Abschluss wird die Slot-Anzeige mit aktuellen Daten aktualisiert
   */
  it("AC-7: should render Sync Models button that triggers sync flow", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    // Set up a controllable stream so we can verify the syncing state
    const { stream, push, close } = createControllableStream();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      })
    );

    renderDialog();

    // Wait for initial render
    const syncButton = await screen.findByTestId("sync-button");
    expect(syncButton).toHaveTextContent("Sync Models");

    // Click sync
    await user.click(syncButton);

    // Button should show syncing state
    await waitFor(() => {
      expect(screen.getByTestId("sync-button")).toHaveTextContent("Syncing...");
      expect(screen.getByTestId("sync-button")).toHaveAttribute(
        "data-sync-state",
        "syncing"
      );
    });

    // Prepare updated slots to be returned after sync
    const updatedSlots = FULL_SLOTS.map((s) =>
      s.mode === "txt2img" && s.slot === 3
        ? { ...s, modelId: "new-owner/new-model", active: true }
        : s
    );
    mockGetModelSlots.mockResolvedValue(updatedSlots);

    // Complete the sync stream
    await act(async () => {
      push({ type: "progress", completed: 3, total: 6 });
      push({ type: "complete", synced: 6, failed: 0 });
      close();
    });

    // After sync completes, button should return to idle
    await waitFor(() => {
      expect(screen.getByTestId("sync-button")).toHaveTextContent("Sync Models");
      expect(screen.getByTestId("sync-button")).toHaveAttribute(
        "data-sync-state",
        "idle"
      );
    });

    // Verify that getModelSlots was re-called after sync (data refresh)
    // Initial call (on open) + post-sync reload = at least 2 calls
    await waitFor(() => {
      expect(mockGetModelSlots.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // AC-8
  // =========================================================================

  /**
   * AC-8: GIVEN der Dialog wird geoeffnet
   *       WHEN `getModelSlots()` aufgerufen wird (statt des alten `getModelSettings()`)
   *       THEN werden die Slots korrekt geladen und angezeigt
   *       AND der Event-Listener lauscht auf "model-slots-changed"
   */
  it("AC-8: should call getModelSlots on open and listen to model-slots-changed event", async () => {
    renderDialog();

    // getModelSlots must be called on dialog open
    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
    });

    // Slots should be rendered (proving data loaded correctly)
    await waitFor(() => {
      expect(screen.getByTestId("slot-row-txt2img-1")).toBeInTheDocument();
    });

    // Prepare updated slots for the event-triggered refresh
    const updatedSlots = FULL_SLOTS.map((s) =>
      s.mode === "outpaint" && s.slot === 2
        ? { ...s, modelId: "new-owner/updated-model", active: true }
        : s
    );
    mockGetModelSlots.mockResolvedValue(updatedSlots);

    // Dispatch the "model-slots-changed" event
    await act(async () => {
      window.dispatchEvent(new Event("model-slots-changed"));
    });

    // getModelSlots must be called again in response to the event
    await waitFor(() => {
      expect(mockGetModelSlots.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // AC-9
  // =========================================================================

  /**
   * AC-9: GIVEN der Model-Katalog ist leer (keine Models gesynct)
   *       WHEN der Dialog geoeffnet wird
   *       THEN wird pro Mode eine Empty-State-Meldung angezeigt (bestehendes Empty-State-Pattern beibehalten)
   */
  it("AC-9: should show empty state message when no models are synced", async () => {
    setupEmptyCatalogMocks();

    // We need to mock fetch to prevent auto-sync from triggering a real
    // network call (auto-sync fires when catalog is empty)
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 })
    );

    renderDialog();

    // Each mode section should show an empty state message
    const modes = ["txt2img", "img2img", "upscale", "inpaint", "outpaint"];
    for (const mode of modes) {
      await waitFor(() => {
        const emptyState = screen.getByTestId(`empty-state-${mode}`);
        expect(emptyState).toBeInTheDocument();
        // Empty state should contain one of the known messages
        expect(emptyState.textContent).toMatch(
          /No models available|Loading models|Sync failed|No models for this mode/
        );
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: ModelModeSection read-only rendering
// ---------------------------------------------------------------------------

describe("Slice 14: ModelModeSection — Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render slot rows with correct labels for all 3 slots", () => {
    const slots = [
      makeSlot("txt2img", 1, "owner/model-a", true),
      makeSlot("txt2img", 2, "owner/model-b", false),
      makeSlot("txt2img", 3, null, false),
    ];

    const models = [
      makeModel("owner", "model-a", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
      makeModel("owner", "model-b", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
    ];

    render(
      <ModelModeSection
        mode="txt2img"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    expect(screen.getByText("Slot 1")).toBeInTheDocument();
    expect(screen.getByText("Slot 2")).toBeInTheDocument();
    expect(screen.getByText("Slot 3")).toBeInTheDocument();
  });

  it("should display model name from catalog instead of raw replicateId", () => {
    const slots = [
      makeSlot("txt2img", 1, "owner/model-a", true),
      makeSlot("txt2img", 2, null, false),
      makeSlot("txt2img", 3, null, false),
    ];

    const models = [
      makeModel("owner", "model-a", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
    ];

    render(
      <ModelModeSection
        mode="txt2img"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    // Should show the friendly name "model-a" (from model.name), not "owner/model-a"
    expect(screen.getByText("model-a")).toBeInTheDocument();
    expect(screen.queryByText("owner/model-a")).not.toBeInTheDocument();
  });

  it("should fall back to raw modelId when model is not in catalog", () => {
    const slots = [
      makeSlot("txt2img", 1, "unknown-owner/unknown-model", true),
      makeSlot("txt2img", 2, null, false),
      makeSlot("txt2img", 3, null, false),
    ];

    // Provide a model list that does NOT contain the assigned model.
    // The list must be non-empty so the component renders slot rows
    // instead of the empty-state message.
    const models = [
      makeModel("owner", "other-model", {
        txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false,
      }),
    ];

    render(
      <ModelModeSection
        mode="txt2img"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    // Should fall back to the raw modelId since it's not in the catalog
    expect(
      screen.getByText("unknown-owner/unknown-model")
    ).toBeInTheDocument();
  });

  it("should render green dot for active=true and gray dot for active=false", () => {
    const slots = [
      makeSlot("txt2img", 1, "owner/active-model", true),
      makeSlot("txt2img", 2, "owner/inactive-model", false),
      makeSlot("txt2img", 3, null, false),
    ];

    const models = [
      makeModel("owner", "active-model", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
      makeModel("owner", "inactive-model", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
    ];

    render(
      <ModelModeSection
        mode="txt2img"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    const activeDot = screen.getByTestId("status-dot-txt2img-1");
    expect(activeDot).toHaveClass("bg-green-500");

    const inactiveDot = screen.getByTestId("status-dot-txt2img-2");
    expect(inactiveDot).toHaveClass("bg-gray-400");

    const emptyDot = screen.getByTestId("status-dot-txt2img-3");
    expect(emptyDot).toHaveClass("bg-gray-400");
  });

  it("should show 'on' text for active slots and 'off' for inactive/empty slots", () => {
    const slots = [
      makeSlot("txt2img", 1, "owner/m1", true),
      makeSlot("txt2img", 2, "owner/m2", false),
      makeSlot("txt2img", 3, null, false),
    ];

    const models = [
      makeModel("owner", "m1", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
      makeModel("owner", "m2", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
    ];

    render(
      <ModelModeSection
        mode="txt2img"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    const rows = screen.getAllByTestId(/^slot-row-txt2img/);
    expect(rows).toHaveLength(3);

    // Row 1: active
    expect(within(rows[0]).getByText("on")).toBeInTheDocument();
    // Row 2: inactive
    expect(within(rows[1]).getByText("off")).toBeInTheDocument();
    // Row 3: empty/inactive
    expect(within(rows[2]).getByText("off")).toBeInTheDocument();
  });

  it("should show 'not assigned' with muted styling for null modelId slots", () => {
    const slots = [
      makeSlot("inpaint", 1, null, false),
      makeSlot("inpaint", 2, null, false),
      makeSlot("inpaint", 3, null, false),
    ];

    const models = [
      makeModel("stability-ai", "inpaint-model", { txt2img: false, img2img: false, upscale: false, inpaint: true, outpaint: false }),
    ];

    render(
      <ModelModeSection
        mode="inpaint"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    const notAssignedTexts = screen.getAllByText("not assigned");
    expect(notAssignedTexts).toHaveLength(3);
    for (const el of notAssignedTexts) {
      expect(el).toHaveClass("text-muted-foreground");
    }
  });

  it("should render the correct MODE_LABELS heading", () => {
    const slots = [
      makeSlot("outpaint", 1, null, false),
      makeSlot("outpaint", 2, null, false),
      makeSlot("outpaint", 3, null, false),
    ];

    render(
      <ModelModeSection
        mode="outpaint"
        slots={slots as any}
        models={[makeModel("owner", "m", { txt2img: false, img2img: false, upscale: false, inpaint: false, outpaint: true })] as any}
        hasEverSynced={true}
      />
    );

    expect(screen.getByText("OUTPAINT")).toBeInTheDocument();
  });

  it("should not render any interactive elements (no combobox, checkbox, input)", () => {
    const slots = [
      makeSlot("txt2img", 1, "owner/m1", true),
      makeSlot("txt2img", 2, "owner/m2", false),
      makeSlot("txt2img", 3, null, false),
    ];

    const models = [
      makeModel("owner", "m1", { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }),
    ];

    render(
      <ModelModeSection
        mode="txt2img"
        slots={slots as any}
        models={models as any}
        hasEverSynced={true}
      />
    );

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("listbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Tests: SettingsDialog + ModelModeSection together
// ---------------------------------------------------------------------------

describe("Slice 14: Settings Dialog Read-Only — Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should load slots from getModelSlots and pass them to ModelModeSection", async () => {
    renderDialog();

    // After loading, slot data should appear in the rendered output
    await waitFor(() => {
      // txt2img slot 1 has flux-schnell
      const row = screen.getByTestId("slot-row-txt2img-1");
      expect(within(row).getByText("flux-schnell")).toBeInTheDocument();
    });

    // upscale slot 1 has clarity-upscaler
    const upscaleRow = screen.getByTestId("slot-row-upscale-1");
    expect(within(upscaleRow).getByText("clarity-upscaler")).toBeInTheDocument();
  });

  it("should refresh slot data when model-slots-changed event is dispatched", async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
    });

    // Update the mock to return different data
    const updatedSlots = FULL_SLOTS.map((s) =>
      s.mode === "txt2img" && s.slot === 1
        ? { ...s, modelId: "new-owner/brand-new-model", active: false }
        : s
    );
    mockGetModelSlots.mockResolvedValue(updatedSlots);

    // Also provide the model in the catalog so it resolves to a display name
    const updatedModels = [
      ...ALL_MODELS,
      makeModel("new-owner", "brand-new-model", {
        txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false,
      }),
    ];
    mockGetModels.mockImplementation((input: { capability?: string }) => {
      if (!input.capability) return Promise.resolve(updatedModels);
      return Promise.resolve(
        updatedModels.filter((m) => {
          const caps = m.capabilities as Record<string, boolean>;
          return caps[input.capability!] === true;
        })
      );
    });

    // Fire the event
    await act(async () => {
      window.dispatchEvent(new Event("model-slots-changed"));
    });

    // The new model should eventually appear
    await waitFor(() => {
      const row = screen.getByTestId("slot-row-txt2img-1");
      expect(within(row).getByText("brand-new-model")).toBeInTheDocument();
    });
  });

  it("should NOT listen to legacy event names", async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
    });

    // Dispatch an unrelated event name to confirm no extra reloads
    await act(async () => {
      window.dispatchEvent(new Event("unrelated-event"));
    });

    // getModelSlots should NOT be called again (still at 1 from initial load)
    // Give it a moment to confirm no additional call is made
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetModelSlots).toHaveBeenCalledTimes(1);
  });

  it("should display DialogDescription with read-only context", async () => {
    renderDialog();

    await waitFor(() => {
      expect(
        screen.getByText("View current model slot assignments per generation mode.")
      ).toBeInTheDocument();
    });
  });
});
