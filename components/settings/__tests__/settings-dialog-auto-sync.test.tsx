// @vitest-environment jsdom
/**
 * Tests for Auto-Sync behavior in SettingsDialog
 * Slice: slice-11-auto-sync
 *
 * Mocking Strategy: mock_external
 * - server actions (getModels, getModelSettings) mocked
 * - global fetch mocked for /api/models/sync streaming response
 * - sonner toast mocked
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills (Radix Dialog / Tooltip needs matchMedia, ResizeObserver, etc.)
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

const {
  mockGetModelSettings,
  mockUpdateModelSetting,
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
    mockGetModelSettings: vi.fn().mockResolvedValue([]),
    mockUpdateModelSetting: vi.fn().mockResolvedValue({}),
    mockGetModels: vi.fn().mockResolvedValue([]),
    mockToast: mockToastObj,
  };
});

// Mock server actions: model-settings
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: (...args: unknown[]) => mockGetModelSettings(...args),
  updateModelSetting: (...args: unknown[]) => mockUpdateModelSetting(...args),
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
// Stream helpers
// ---------------------------------------------------------------------------

/**
 * Creates a ReadableStream that yields NDJSON events.
 * Each event is a JSON object followed by a newline.
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

/**
 * Creates a mock fetch Response with a streaming body.
 */
function createStreamResponse(
  events: Record<string, unknown>[],
  status = 200
): Response {
  return new Response(createStreamFromEvents(events), {
    status,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

/**
 * Creates a controllable stream where we can push events one at a time.
 * Returns the stream and a push function + close function.
 */
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
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { SettingsDialog } from "@/components/settings/settings-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;

/** A fake model object that getModels can return to simulate a non-empty catalog. */
const FAKE_MODEL = {
  id: "model-1",
  apiIdentifier: "black-forest-labs/flux-pro",
  name: "Flux Pro",
  description: "A model",
  capabilities: ["txt2img"],
  isActive: true,
};

function renderDialog(open = true) {
  return render(<SettingsDialog open={open} onOpenChange={vi.fn()} />);
}

async function findSyncButton() {
  return screen.findByTestId("sync-button");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsDialog Auto-Sync", () => {
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelSettings.mockResolvedValue([]);
    // Default: all getModels calls return empty arrays (catalog empty)
    mockGetModels.mockResolvedValue([]);
    mockToast.loading.mockReturnValue("toast-id-1");
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    // Default fetch: a controllable stream that never ends (for auto-sync)
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    dispatchEventSpy.mockRestore();
    global.fetch = originalFetch;
    cleanup();
  });

  // =========================================================================
  // AC-1: Auto-Sync bei leerer models-Tabelle
  // =========================================================================

  /**
   * AC-1: GIVEN die models-Tabelle ist leer (alle getModels-Calls geben leere Arrays zurueck)
   *       WHEN settings-dialog.tsx zum ersten Mal gemountet wird (Dialog oeffnet ODER App-Start)
   *       THEN wird automatisch ein Sync gestartet (gleiche handleSync-Logik wie Sync-Button-Klick
   *            aus Slice 09), der Sync-Button wechselt in den Zustand syncing, und ein
   *            Progress-Toast erscheint mit "Syncing Models..."
   */
  it("AC-1: should trigger sync automatically when all getModels calls return empty arrays", async () => {
    // All getModels calls return empty arrays (default mock)
    const { stream, close } = createControllableStream();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      })
    );
    global.fetch = fetchMock;

    renderDialog();

    // Wait for the auto-sync to be triggered: fetch should be called with /api/models/sync
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/models/sync", {
        method: "POST",
        signal: expect.any(AbortSignal),
      });
    });

    // Loading toast was called with "Syncing Models..."
    expect(mockToast.loading).toHaveBeenCalledWith("Syncing Models...");

    // Sync button should be in syncing state
    const syncButton = await findSyncButton();
    expect(syncButton).toHaveAttribute("data-sync-state", "syncing");
    expect(syncButton).toBeDisabled();
    expect(syncButton).toHaveTextContent("Syncing...");

    // Clean up the stream
    close();
  });

  // =========================================================================
  // AC-2: Kein Auto-Sync wenn Models vorhanden
  // =========================================================================

  /**
   * AC-2: GIVEN die models-Tabelle enthaelt mindestens 1 aktives Model
   *       WHEN settings-dialog.tsx gemountet wird
   *       THEN wird KEIN Auto-Sync gestartet und der Sync-Button bleibt im Zustand idle
   */
  it("AC-2: should not trigger auto-sync when models exist in database", async () => {
    // At least one getModels call returns a model
    mockGetModels.mockResolvedValue([FAKE_MODEL]);

    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    renderDialog();

    // Wait for models to be loaded (getModels is called for all 5 modes)
    await waitFor(() => {
      expect(mockGetModels).toHaveBeenCalledTimes(5);
    });

    // Sync button should remain in idle state
    const syncButton = await findSyncButton();
    expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    expect(syncButton).not.toBeDisabled();

    // No fetch call to /api/models/sync should have been made
    expect(fetchMock).not.toHaveBeenCalled();

    // No loading toast should have been called
    expect(mockToast.loading).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-3: Button disabled waehrend Auto-Sync
  // =========================================================================

  /**
   * AC-3: GIVEN ein Auto-Sync laeuft bereits (ausgeloest durch leeren Katalog)
   *       WHEN der User den Sync-Button manuell klickt
   *       THEN passiert nichts (Button ist disabled im syncing-Zustand, identisch zu Slice 09 AC-8)
   */
  it("AC-3: should disable sync button during auto-sync", async () => {
    const user = userEvent.setup();
    const { stream, close } = createControllableStream();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      })
    );
    global.fetch = fetchMock;

    renderDialog();

    // Wait for auto-sync to start
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const syncButton = await findSyncButton();

    // Button should be disabled (syncing state)
    await waitFor(() => {
      expect(syncButton).toBeDisabled();
      expect(syncButton).toHaveAttribute("data-sync-state", "syncing");
    });

    // Attempt a manual click -- should be no-op because button is disabled
    await user.click(syncButton);

    // Fetch should still have been called only once (from auto-sync)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Clean up
    close();
  });

  // =========================================================================
  // AC-4: Workspace bleibt interaktiv waehrend Auto-Sync (Toast ist non-blocking)
  // =========================================================================

  /**
   * AC-4: GIVEN ein Auto-Sync laeuft
   *       WHEN der Workspace hinter dem Toast sichtbar ist
   *       THEN bleibt der Workspace vollstaendig interaktiv (Toast ist non-blocking Overlay,
   *            kein Modal-Blocker)
   */
  it("AC-4: should not block workspace interaction during auto-sync toast", async () => {
    const { stream, close } = createControllableStream();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      })
    );

    renderDialog();

    // Wait for auto-sync to start
    await waitFor(() => {
      expect(mockToast.loading).toHaveBeenCalledWith("Syncing Models...");
    });

    // The toast is called via sonner's toast.loading which is a non-blocking overlay.
    // Verify the dialog content remains accessible while sync is running.
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Dialog title is still visible and accessible
    expect(screen.getByText("Model Settings")).toBeInTheDocument();
    expect(screen.getByText("Assign models to each generation mode and quality tier.")).toBeInTheDocument();

    // The dialog does not have aria-modal=false or any blocking overlay from our code
    // (the toast is handled externally by sonner as a portal-based overlay)
    // Verify no blocking overlay is rendered within our dialog content
    expect(dialog).toBeVisible();

    // Clean up
    close();
  });

  // =========================================================================
  // AC-5: Auto-Sync Success -> Dropdowns aktualisiert
  // =========================================================================

  /**
   * AC-5: GIVEN ein Auto-Sync schliesst erfolgreich ab (failed === 0)
   *       WHEN die Complete-Events verarbeitet werden
   *       THEN werden die Dropdowns automatisch befuellt (via window.dispatchEvent("model-settings-changed"),
   *            bereits aus Slice 09), und der Success-Toast "X Models synced" erscheint mit auto-dismiss nach 3s
   */
  it("AC-5: should dispatch model-settings-changed event after successful auto-sync", async () => {
    const events = [
      { type: "progress", completed: 50, total: 100 },
      { type: "complete", synced: 100, failed: 0, new: 80, updated: 20 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(events));

    renderDialog();

    // Wait for the auto-sync to complete and success toast to appear
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("100 Models synced", {
        duration: 3000,
      });
    });

    // Loading toast was dismissed
    expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");

    // window.dispatchEvent was called with "model-settings-changed"
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "model-settings-changed" })
    );

    // Sync button should be back to idle
    const syncButton = await findSyncButton();
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    });
  });

  // =========================================================================
  // AC-6: Auto-Sync Partial -> Warning-Toast + Badge
  // =========================================================================

  /**
   * AC-6: GIVEN ein Auto-Sync schliesst mit Teilfehler ab (failed > 0)
   *       WHEN die Complete-Events verarbeitet werden
   *       THEN erscheint ein Warning-Toast (user-dismissible) und der Sync-Button zeigt
   *            das Warning-Badge (identisch zu Slice 09 AC-5)
   */
  it("AC-6: should show warning toast and badge after auto-sync with failures", async () => {
    const events = [
      { type: "complete", synced: 80, failed: 20, new: 60, updated: 20 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(events));

    renderDialog();

    // Wait for the warning badge to appear (sync_partial state)
    const warningBadge = await screen.findByTestId("sync-warning-badge");
    expect(warningBadge).toBeInTheDocument();

    // Loading toast was dismissed
    expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");

    // Warning toast shown with correct message, user-dismissible (Infinity duration)
    expect(mockToast.warning).toHaveBeenCalledWith("80 synced, 20 failed", {
      duration: Infinity,
    });

    // Button is in sync_partial state
    const syncButton = screen.getByTestId("sync-button");
    expect(syncButton).toHaveAttribute("data-sync-state", "sync_partial");

    // window.dispatchEvent was called with "model-settings-changed"
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "model-settings-changed" })
    );
  });

  // =========================================================================
  // AC-7: Kein erneuter Auto-Sync bei Reopen mit vorhandenen Models
  // =========================================================================

  /**
   * AC-7: GIVEN der Auto-Sync-Check hat bereits einmal gelaufen (Dialog wurde geschlossen
   *            und wieder geoeffnet)
   *       WHEN der Dialog erneut geoeffnet wird und Models vorhanden sind
   *       THEN wird KEIN erneuter Auto-Sync ausgeloest
   */
  it("AC-7: should not trigger auto-sync on dialog reopen when models exist", async () => {
    // First render: empty catalog triggers auto-sync
    const events = [
      { type: "complete", synced: 50, failed: 0, new: 50, updated: 0 },
    ];
    const fetchMock = vi.fn().mockResolvedValue(createStreamResponse(events));
    global.fetch = fetchMock;

    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SettingsDialog open={true} onOpenChange={onOpenChange} />
    );

    // Wait for the initial auto-sync to complete
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("50 Models synced", {
        duration: 3000,
      });
    });

    // Record fetch call count after the first auto-sync
    const fetchCallCountAfterFirstSync = fetchMock.mock.calls.length;

    // Close the dialog
    rerender(
      <SettingsDialog open={false} onOpenChange={onOpenChange} />
    );

    // Now reopen with models present
    mockGetModels.mockResolvedValue([FAKE_MODEL]);

    // Prepare a fresh fetch mock to track new calls
    const fetchMock2 = vi.fn();
    global.fetch = fetchMock2;

    rerender(
      <SettingsDialog open={true} onOpenChange={onOpenChange} />
    );

    // Wait for models to be loaded
    await waitFor(() => {
      // getModels is called again on reopen (5 modes)
      expect(mockGetModels).toHaveBeenCalled();
    });

    // Give enough time for any potential auto-sync trigger
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // No new fetch call to /api/models/sync should have been made
    expect(fetchMock2).not.toHaveBeenCalled();
  });
});
