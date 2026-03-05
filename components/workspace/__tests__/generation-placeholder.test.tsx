// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks (Mocking Strategy: mock_external per Slice-Spec)
// ---------------------------------------------------------------------------

// Mock lucide-react icons so we can detect them without SVG rendering issues
vi.mock("lucide-react", () => ({
  AlertCircle: (props: Record<string, unknown>) => (
    <span data-testid="alert-circle-icon" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader2-icon" {...props} />
  ),
}));

// Mock server actions
const mockRetryGeneration = vi.fn();
const mockFetchGenerations = vi.fn();

vi.mock("@/app/actions/generations", () => ({
  retryGeneration: (...args: unknown[]) => mockRetryGeneration(...args),
  fetchGenerations: (...args: unknown[]) => mockFetchGenerations(...args),
}));

// Mock shadcn/ui components to keep tests simple
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: Record<string, unknown>) => (
    <div data-testid="skeleton" {...props} />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

import {
  GenerationPlaceholder,
  useGenerationPolling,
} from "../generation-placeholder";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-1",
    projectId: "proj-1",
    prompt: "a beautiful sunset",
    negativePrompt: null,
    modelId: "stability-ai/sdxl",
    modelParams: {},
    status: "pending",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: 512,
    height: 512,
    seed: null,
    createdAt: new Date(),
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// GenerationPlaceholder Component Tests
// ---------------------------------------------------------------------------

describe("GenerationPlaceholder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-1: GIVEN eine Generation mit status: "pending" existiert
  //       WHEN der Placeholder gerendert wird
  //       THEN zeigt er eine Skeleton-Animation (pulsierendes Rechteck) mit der gleichen Grundgroesse wie eine generation-card
  it("AC-1: should render a skeleton animation for a pending generation", () => {
    const generation = makeGeneration({ status: "pending" });
    render(<GenerationPlaceholder generation={generation} />);

    const placeholder = screen.getByTestId("generation-placeholder");
    expect(placeholder).toBeDefined();
    expect(placeholder.getAttribute("data-status")).toBe("pending");

    // Skeleton element is rendered
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeDefined();
  });

  // AC-2: GIVEN eine Generation mit status: "pending" existiert
  //       WHEN der Placeholder gerendert wird
  //       THEN zeigt er einen visuellen Indikator dass eine Generierung laeuft (z.B. Spinner oder animierter Skeleton-Shimmer)
  it("AC-2: should show a visual loading indicator (spinner or shimmer) for pending state", () => {
    const generation = makeGeneration({ status: "pending" });
    render(<GenerationPlaceholder generation={generation} />);

    // Loader2 spinner icon is rendered
    const spinner = screen.getByTestId("loader2-icon");
    expect(spinner).toBeDefined();
  });

  // AC-3: GIVEN eine Generation wechselt von status: "pending" zu status: "completed" mit gesetzter image_url
  //       WHEN das naechste Polling-Intervall die Aenderung erkennt
  //       THEN wird der Placeholder durch das fertige Bild ersetzt (Transition zum fertigen Zustand)
  it("AC-3: should replace placeholder with completed image when status changes to completed", () => {
    const onCompleted = vi.fn();
    const pendingGen = makeGeneration({ status: "pending" });

    const { rerender } = render(
      <GenerationPlaceholder
        generation={pendingGen}
        onCompleted={onCompleted}
      />
    );

    // Initially pending
    expect(screen.getByTestId("generation-placeholder")).toBeDefined();

    // Now simulate polling returning completed status
    const completedGen = makeGeneration({
      status: "completed",
      imageUrl: "https://example.com/image.png",
    });

    rerender(
      <GenerationPlaceholder
        generation={completedGen}
        onCompleted={onCompleted}
      />
    );

    // onCompleted callback should have been called with the completed generation
    expect(onCompleted).toHaveBeenCalledWith(completedGen);

    // Placeholder should no longer render visible content for completed status
    expect(screen.queryByTestId("generation-placeholder")).toBeNull();
  });

  // AC-4: GIVEN eine Generation wechselt von status: "pending" zu status: "failed" mit gesetzter error_message
  //       WHEN das naechste Polling-Intervall die Aenderung erkennt
  //       THEN zeigt der Placeholder einen Error-State mit Fehler-Icon, den Text "Generation fehlgeschlagen" und einen Retry-Button
  it("AC-4: should show error icon, failure text, and retry button when status is failed", () => {
    const failedGen = makeGeneration({
      status: "failed",
      errorMessage: "GPU out of memory",
    });

    render(<GenerationPlaceholder generation={failedGen} />);

    const placeholder = screen.getByTestId("generation-placeholder");
    expect(placeholder.getAttribute("data-status")).toBe("failed");

    // Error icon
    expect(screen.getByTestId("alert-circle-icon")).toBeDefined();

    // Error text
    expect(screen.getByText("Generation fehlgeschlagen")).toBeDefined();

    // Error message detail
    expect(screen.getByText("GPU out of memory")).toBeDefined();

    // Retry button
    expect(screen.getByTestId("retry-button")).toBeDefined();
  });

  // AC-5: GIVEN der Placeholder im Error-State (status: "failed")
  //       WHEN der User den Retry-Button klickt
  //       THEN wird die retryGeneration Server Action mit der Generation-ID aufgerufen und der Placeholder wechselt zurueck in den Pending/Skeleton-State
  it("AC-5: should call retryGeneration action and return to pending state when retry is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const retriedGen = makeGeneration({ id: "gen-1", status: "pending" });

    mockRetryGeneration.mockResolvedValue(retriedGen);

    const failedGen = makeGeneration({
      id: "gen-1",
      status: "failed",
      errorMessage: "Error",
    });

    render(
      <GenerationPlaceholder generation={failedGen} onRetry={onRetry} />
    );

    // Verify failed state
    expect(
      screen.getByTestId("generation-placeholder").getAttribute("data-status")
    ).toBe("failed");

    // Click retry button
    const retryButton = screen.getByTestId("retry-button");
    await user.click(retryButton);

    // retryGeneration should have been called with the generation ID
    expect(mockRetryGeneration).toHaveBeenCalledWith({ id: "gen-1" });

    // After retry resolves, onRetry callback should be invoked
    expect(onRetry).toHaveBeenCalledWith(retriedGen);
  });

  // AC-6: GIVEN es gibt 3 pending Generierungen (z.B. count=3 Batch)
  //       WHEN die Placeholders gerendert werden
  //       THEN werden 3 separate Placeholder-Elemente angezeigt, jeder mit eigenem Status-Tracking
  it("AC-6: should render separate placeholder elements for each pending generation in a batch", () => {
    const generations = [
      makeGeneration({ id: "gen-1", status: "pending" }),
      makeGeneration({ id: "gen-2", status: "pending" }),
      makeGeneration({ id: "gen-3", status: "pending" }),
    ];

    render(
      <>
        {generations.map((gen) => (
          <GenerationPlaceholder key={gen.id} generation={gen} />
        ))}
      </>
    );

    const placeholders = screen.getAllByTestId("generation-placeholder");
    expect(placeholders).toHaveLength(3);

    // Each has pending status
    for (const ph of placeholders) {
      expect(ph.getAttribute("data-status")).toBe("pending");
    }
  });
});

// ---------------------------------------------------------------------------
// Generation Status Polling Tests
// ---------------------------------------------------------------------------

describe("Generation Status Polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockFetchGenerations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // AC-7: GIVEN es existieren pending Generierungen
  //       WHEN Polling aktiv ist
  //       THEN wird der Generation-Status in einem regelmaessigen Intervall (2-5 Sekunden) per Server Action abgefragt
  it("AC-7: should poll generation status at regular intervals while pending generations exist", async () => {
    const pendingGen = makeGeneration({ id: "gen-1", status: "pending" });
    mockFetchGenerations.mockResolvedValue([pendingGen]);

    renderHook(() => useGenerationPolling("proj-1", ["gen-1"]));

    // Initial fetch on mount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockFetchGenerations).toHaveBeenCalledWith("proj-1");
    const initialCallCount = mockFetchGenerations.mock.calls.length;

    // Advance by polling interval (3 seconds as defined in component)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mockFetchGenerations.mock.calls.length).toBeGreaterThan(
      initialCallCount
    );

    // Advance by another interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mockFetchGenerations.mock.calls.length).toBeGreaterThan(
      initialCallCount + 1
    );
  });

  // AC-8: GIVEN keine pending Generierungen mehr existieren (alle completed oder failed)
  //       WHEN das Polling-Intervall laeuft
  //       THEN wird das Polling gestoppt (kein unnoetriger Netzwerk-Traffic)
  it("AC-8: should stop polling when no pending generations remain", async () => {
    mockFetchGenerations.mockResolvedValue([]);

    const { rerender } = renderHook(
      ({ pendingIds }: { pendingIds: string[] }) =>
        useGenerationPolling("proj-1", pendingIds),
      { initialProps: { pendingIds: ["gen-1"] } }
    );

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsAfterMount = mockFetchGenerations.mock.calls.length;

    // Rerender with empty pending list (all completed/failed)
    rerender({ pendingIds: [] });

    // Advance several intervals — should NOT trigger more fetches
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(mockFetchGenerations.mock.calls.length).toBe(callsAfterMount);
  });

  // AC-9: GIVEN der User navigiert weg von der Workspace-Seite
  //       WHEN Polling aktiv war
  //       THEN wird das Polling-Intervall aufgeraeumt (kein Memory Leak, kein weiter laufendes Interval)
  it("AC-9: should clean up polling interval on component unmount", async () => {
    mockFetchGenerations.mockResolvedValue([
      makeGeneration({ id: "gen-1", status: "pending" }),
    ]);

    const { unmount } = renderHook(() =>
      useGenerationPolling("proj-1", ["gen-1"])
    );

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsBeforeUnmount = mockFetchGenerations.mock.calls.length;

    // Unmount (user navigates away)
    unmount();

    // Advance several intervals — should NOT trigger more fetches
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(mockFetchGenerations.mock.calls.length).toBe(callsBeforeUnmount);
  });
});
