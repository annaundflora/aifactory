// @vitest-environment jsdom
/**
 * Tests for Sync-Button in SettingsDialog
 * Slice: slice-09-sync-button
 *
 * Mocking Strategy: mock_external
 * - global fetch mocked for /api/models/sync streaming response
 * - sonner toast mocked
 * - server actions mocked (getModelSettings, updateModelSetting, getModels)
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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

// Use vi.hoisted() so mock references are available when vi.mock factories run
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

// Note: lucide-react is NOT mocked -- the real icons render fine in jsdom.

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

function renderDialog() {
  return render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
}

async function findSyncButton() {
  return screen.findByTestId("sync-button");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsDialog Sync-Button", () => {
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelSettings.mockResolvedValue([]);
    mockGetModels.mockResolvedValue([]);
    mockToast.loading.mockReturnValue("toast-id-1");
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    // Reset global fetch to a no-op mock
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    dispatchEventSpy.mockRestore();
    global.fetch = originalFetch;
  });

  // =========================================================================
  // AC-1: Sync-Button sichtbar im idle-Zustand
  // =========================================================================

  /**
   * AC-1: GIVEN das Settings-Dialog ist geoeffnet und kein Sync laeuft
   *       WHEN der Dialog gerendert wird
   *       THEN ist ein Button mit Label "Sync Models" sichtbar, positioniert
   *            unterhalb des Dialog-Header-Titels (rechts-aligned), im Zustand
   *            `idle` und klickbar
   */
  it("AC-1: should render Sync Models button in idle state below dialog header", async () => {
    renderDialog();

    const syncButton = await findSyncButton();

    // Button is visible and has correct label
    expect(syncButton).toBeInTheDocument();
    expect(syncButton).toHaveTextContent("Sync Models");

    // Button is in idle state
    expect(syncButton).toHaveAttribute("data-sync-state", "idle");

    // Button is clickable (not disabled)
    expect(syncButton).not.toBeDisabled();

    // Button is inside the dialog
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(syncButton);

    // Dialog title is present
    expect(screen.getByText("Model Settings")).toBeInTheDocument();
  });

  // =========================================================================
  // AC-2: Klick startet Fetch + Button wird syncing + Loading-Toast
  // =========================================================================

  /**
   * AC-2: GIVEN der Sync-Button im Zustand `idle`
   *       WHEN der User auf "Sync Models" klickt
   *       THEN wird ein `fetch("POST", "/api/models/sync")` mit `AbortController`
   *            (60s Timeout) abgefeuert, der Button wechselt in den Zustand
   *            `syncing` (disabled, Spinner-Icon, Label "Syncing..."), und ein
   *            Loading-Toast via `toast.loading()` erscheint mit initialem Text
   *            "Syncing Models..."
   */
  it("AC-2: should start streaming fetch and show loading toast on click", async () => {
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

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Fetch was called with correct method and URL
    expect(fetchMock).toHaveBeenCalledWith("/api/models/sync", {
      method: "POST",
      signal: expect.any(AbortSignal),
    });

    // Loading toast was called
    expect(mockToast.loading).toHaveBeenCalledWith("Syncing Models...");

    // Button switches to syncing state
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "syncing");
    });

    // Button is now disabled
    expect(syncButton).toBeDisabled();

    // Button shows "Syncing..." label
    expect(syncButton).toHaveTextContent("Syncing...");

    // Clean up: close the stream to prevent hanging
    close();
  });

  // =========================================================================
  // AC-3: Progress-Event aktualisiert Toast-Text
  // =========================================================================

  /**
   * AC-3: GIVEN ein laufender Sync mit Streaming-Response
   *       WHEN ein Progress-Event `{ type: "progress", completed: 45, total: 120 }`
   *            empfangen wird
   *       THEN wird der bestehende Loading-Toast via
   *            `toast.loading("Syncing Models... 45/120", { id })` aktualisiert
   *            (gleiche Toast-ID, Text-Update)
   */
  it("AC-3: should update loading toast with progress count on progress event", async () => {
    const user = userEvent.setup();

    const events = [
      { type: "progress", completed: 45, total: 120 },
      { type: "complete", synced: 120, failed: 0, new: 5, updated: 3 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(events));

    renderDialog();

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Wait for stream to be processed
    await waitFor(() => {
      // toast.loading should be called with progress update using the same toast ID
      expect(mockToast.loading).toHaveBeenCalledWith(
        "Syncing Models... 45/120",
        { id: "toast-id-1" }
      );
    });
  });

  // =========================================================================
  // AC-4: Complete-Event (failed=0) -> Success-Toast + idle + dispatchEvent
  // =========================================================================

  /**
   * AC-4: GIVEN ein laufender Sync
   *       WHEN ein Complete-Event `{ type: "complete", synced: 120, failed: 0, new: 5, updated: 3 }`
   *            empfangen wird (failed === 0)
   *       THEN wird der Loading-Toast dismissed und ein Success-Toast
   *            `toast.success("120 Models synced")` angezeigt (auto-dismiss nach 3s),
   *            der Button wechselt zurueck in den Zustand `idle`, und
   *            `window.dispatchEvent(new Event("model-settings-changed"))` wird ausgeloest
   */
  it("AC-4: should show success toast and reset to idle on complete with zero failures", async () => {
    const user = userEvent.setup();

    const events = [
      { type: "complete", synced: 120, failed: 0, new: 5, updated: 3 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(events));

    renderDialog();

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Wait for stream processing to complete
    await waitFor(() => {
      // Loading toast is dismissed
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");
    });

    // Success toast shown with correct message and auto-dismiss duration
    expect(mockToast.success).toHaveBeenCalledWith("120 Models synced", {
      duration: 3000,
    });

    // Button reverts to idle
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    });

    // window.dispatchEvent was called with "model-settings-changed"
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "model-settings-changed" })
    );
  });

  // =========================================================================
  // AC-5: Complete-Event (failed>0) -> Warning-Toast + sync_partial + Badge
  // =========================================================================

  /**
   * AC-5: GIVEN ein laufender Sync
   *       WHEN ein Complete-Event `{ type: "complete", synced: 95, failed: 25, new: 3, updated: 1 }`
   *            empfangen wird (failed > 0)
   *       THEN wird der Loading-Toast dismissed und ein Warning-Toast erscheint mit
   *            Text "95 synced, 25 failed" (user-dismissible, KEIN auto-dismiss),
   *            der Button wechselt in den Zustand `sync_partial` mit Warning-Badge
   *            und Tooltip "Last sync: 25 models failed. Click to retry.", und
   *            `window.dispatchEvent(new Event("model-settings-changed"))` wird ausgeloest
   */
  it("AC-5: should show warning toast and switch to sync_partial on complete with failures", async () => {
    const user = userEvent.setup();

    const events = [
      { type: "complete", synced: 95, failed: 25, new: 3, updated: 1 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(events));

    renderDialog();

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Wait for the warning badge to appear (it only renders in sync_partial state).
    // When state changes to sync_partial, the button is re-rendered inside a Tooltip
    // wrapper, so we must re-query the button after the state change.
    const warningBadge = await screen.findByTestId("sync-warning-badge");
    expect(warningBadge).toBeInTheDocument();

    // Re-query the sync button (it may have been re-mounted inside TooltipTrigger)
    const updatedSyncButton = screen.getByTestId("sync-button");

    // Loading toast was dismissed
    expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");

    // Warning toast shown with correct message, user-dismissible (Infinity duration)
    expect(mockToast.warning).toHaveBeenCalledWith("95 synced, 25 failed", {
      duration: Infinity,
    });

    // Button is in sync_partial state
    expect(updatedSyncButton).toHaveAttribute("data-sync-state", "sync_partial");

    // The tooltip text is rendered by Radix Tooltip and may only appear in the DOM
    // when the tooltip is triggered (hover). We verify the tooltip wrapper exists
    // by checking that the button is wrapped in a TooltipTrigger (data-slot attribute).
    expect(updatedSyncButton).toHaveAttribute("data-slot", "tooltip-trigger");

    // window.dispatchEvent was called with "model-settings-changed"
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "model-settings-changed" })
    );
  });

  // =========================================================================
  // AC-6: Error-Event -> Error-Toast
  // =========================================================================

  /**
   * AC-6: GIVEN ein laufender Sync
   *       WHEN ein Error-Event `{ type: "error", message: "Sync bereits aktiv" }`
   *            empfangen wird
   *       THEN wird der Loading-Toast dismissed und ein Error-Toast
   *            `toast.error("Sync failed: Sync bereits aktiv")` angezeigt
   *            (user-dismissible, KEIN auto-dismiss), der Button wechselt
   *            zurueck in den vorherigen Zustand
   */
  it("AC-6: should show error toast on error event from stream", async () => {
    const user = userEvent.setup();

    const events = [
      { type: "error", message: "Sync bereits aktiv" },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(events));

    renderDialog();

    const syncButton = await findSyncButton();

    // Button starts in idle state
    expect(syncButton).toHaveAttribute("data-sync-state", "idle");

    await user.click(syncButton);

    // Wait for stream processing to complete
    await waitFor(() => {
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");
    });

    // Error toast shown with correct message, user-dismissible (Infinity duration)
    expect(mockToast.error).toHaveBeenCalledWith(
      "Sync failed: Sync bereits aktiv",
      { duration: Infinity }
    );

    // Button reverts to previous state (idle)
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    });
  });

  // =========================================================================
  // AC-7: 60s Timeout -> Abort + Error-Toast
  // =========================================================================

  /**
   * AC-7: GIVEN ein laufender Sync
   *       WHEN 60 Sekunden vergehen ohne dass der Stream endet
   *       THEN wird der Fetch via `AbortController.abort()` abgebrochen, der
   *            Loading-Toast dismissed, ein Error-Toast `toast.error("Sync timed out")`
   *            angezeigt (user-dismissible), und der Button wechselt in den Zustand `idle`
   */
  it("AC-7: should abort fetch and show timeout error toast after 60 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    // Create a fetch that never resolves until aborted
    global.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        })
    );

    renderDialog();

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Button should be in syncing state
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "syncing");
    });

    // Advance time by 60 seconds to trigger the timeout
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    // Wait for the abort to be processed
    await waitFor(() => {
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");
    });

    // Error toast for timeout
    expect(mockToast.error).toHaveBeenCalledWith("Sync timed out", {
      duration: Infinity,
    });

    // Button reverts to idle
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    });

    vi.useRealTimers();
  });

  // =========================================================================
  // AC-8: Button disabled waehrend syncing
  // =========================================================================

  /**
   * AC-8: GIVEN der Button im Zustand `syncing`
   *       WHEN der User versucht den Button zu klicken
   *       THEN passiert nichts (Button ist `disabled`)
   */
  it("AC-8: should be disabled during syncing state", async () => {
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

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Button is now syncing and disabled
    await waitFor(() => {
      expect(syncButton).toBeDisabled();
      expect(syncButton).toHaveAttribute("data-sync-state", "syncing");
    });

    // Fetch was called exactly once from the first click
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Try clicking again -- the disabled button prevents a second call
    // userEvent respects disabled state, so this is a no-op
    await user.click(syncButton);

    // Still only one fetch call
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Clean up
    close();
  });

  // =========================================================================
  // AC-9: Erfolgreicher Sync nach sync_partial entfernt Badge
  // =========================================================================

  /**
   * AC-9: GIVEN der Button im Zustand `sync_partial` (Warning-Badge sichtbar)
   *       WHEN ein neuer Sync erfolgreich abschliesst (failed === 0)
   *       THEN wird das Warning-Badge entfernt und der Button wechselt in den
   *            Zustand `idle`
   */
  it("AC-9: should clear warning badge after successful sync following partial", async () => {
    const user = userEvent.setup();

    // First sync: partial failure to get into sync_partial state
    const partialEvents = [
      { type: "complete", synced: 95, failed: 25, new: 3, updated: 1 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(partialEvents));

    renderDialog();

    let syncButton = await findSyncButton();
    await user.click(syncButton);

    // Wait for warning badge to appear (proves sync_partial state reached)
    await screen.findByTestId("sync-warning-badge");

    // Re-query button (it re-mounts inside TooltipTrigger in sync_partial state)
    syncButton = screen.getByTestId("sync-button");
    expect(syncButton).toHaveAttribute("data-sync-state", "sync_partial");

    // Prepare second sync: full success
    // Do NOT use vi.clearAllMocks() here -- it would clear the ResizeObserver
    // polyfill mock causing Radix Tooltip to crash with "not a constructor".
    mockToast.loading.mockReset().mockReturnValue("toast-id-2");
    mockToast.success.mockReset();
    mockToast.warning.mockReset();
    mockToast.error.mockReset();
    mockToast.dismiss.mockReset();
    mockGetModels.mockReset().mockResolvedValue([]);

    const successEvents = [
      { type: "complete", synced: 120, failed: 0, new: 5, updated: 3 },
    ];
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse(successEvents));

    await user.click(syncButton);

    // Wait for the badge to disappear (proves idle state reached)
    await waitFor(() => {
      expect(screen.queryByTestId("sync-warning-badge")).not.toBeInTheDocument();
    });

    // Re-query button (it re-mounts without TooltipTrigger in idle state)
    syncButton = screen.getByTestId("sync-button");
    expect(syncButton).toHaveAttribute("data-sync-state", "idle");
  });

  // =========================================================================
  // AC-10: Netzwerkfehler -> Error-Toast
  // =========================================================================

  /**
   * AC-10: GIVEN ein Fetch-Error (Netzwerkfehler, nicht-2xx Status)
   *        WHEN der Fetch fehlschlaegt
   *        THEN wird der Loading-Toast dismissed, ein Error-Toast mit der
   *             Fehlermeldung angezeigt (user-dismissible), und der Button
   *             wechselt in den vorherigen Zustand
   */
  it("AC-10: should show error toast on fetch network failure", async () => {
    const user = userEvent.setup();

    // Simulate a network error (fetch rejects)
    global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    renderDialog();

    const syncButton = await findSyncButton();

    // Button starts in idle
    expect(syncButton).toHaveAttribute("data-sync-state", "idle");

    await user.click(syncButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");
    });

    // Error toast with the error message
    expect(mockToast.error).toHaveBeenCalledWith(
      "Sync failed: Failed to fetch",
      { duration: Infinity }
    );

    // Button reverts to previous state (idle)
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    });
  });

  // =========================================================================
  // AC-10b: Non-2xx HTTP status (additional coverage for AC-10)
  // =========================================================================

  /**
   * AC-10b: GIVEN ein Fetch mit nicht-2xx Status
   *         WHEN der Server z.B. 500 zurueckgibt
   *         THEN wird der Loading-Toast dismissed, ein Error-Toast angezeigt,
   *              und der Button wechselt in den vorherigen Zustand
   */
  it("AC-10b: should show error toast on non-2xx HTTP status", async () => {
    const user = userEvent.setup();

    // Simulate a 500 response
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 })
    );

    renderDialog();

    const syncButton = await findSyncButton();
    await user.click(syncButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id-1");
    });

    // Error toast with HTTP status
    expect(mockToast.error).toHaveBeenCalledWith(
      "Sync failed: HTTP 500",
      { duration: Infinity }
    );

    // Button reverts to idle
    await waitFor(() => {
      expect(syncButton).toHaveAttribute("data-sync-state", "idle");
    });
  });
});
