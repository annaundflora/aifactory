// @vitest-environment jsdom
/**
 * Acceptance Tests for Slice 06 — Project-Context-Settings UI
 *
 * Source: specs/.../slices/slice-06-context-settings-page.md
 * Test-Strategy: Mocking Strategy = `mock_external` — Vitest mocks `updateProjectContext`
 * server-action and stubs `fetch` for GET. UI state, Radix Dialog/AlertDialog and
 * Counter/Save-Disable rules are exercised end-to-end inside jsdom.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec — Test-Strategy meta block)
// ---------------------------------------------------------------------------

// Mock the server-action from Slice 04. Tests assign per-case behaviour via
// `mockUpdateProjectContext.mockResolvedValueOnce(...)` etc.
const mockUpdateProjectContext = vi.fn();
vi.mock("@/app/actions/projects", () => ({
  updateProjectContext: (
    ...args: unknown[]
  ): Promise<unknown> => mockUpdateProjectContext(...args),
}));

// Component is loaded AFTER the vi.mock calls — order matters in vitest.
import ProjectContextSettings from "@/components/projects/project-context-settings";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = "11111111-2222-3333-4444-555555555555";

/**
 * Build a typed Response-like object for the global fetch stub.
 * The component calls `response.ok` + `response.status` + `response.json()`,
 * so we only need those three surface methods.
 */
type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function makeOkResponse(body: unknown): FetchResponseLike {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  };
}

function makeNotFoundResponse(): FetchResponseLike {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: "not found" }),
  };
}

/**
 * Stubs the global `fetch` once and returns the spy. Call before render so the
 * component's mount-effect picks it up.
 */
function stubFetchOnce(
  responseFactory: () => FetchResponseLike | Promise<FetchResponseLike>,
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => responseFactory());
  // jsdom does not provide global.fetch by default — assign directly.
  // Cast through unknown to satisfy stricter typings of the global.
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    spy as unknown as typeof fetch;
  return spy;
}

/**
 * Render with a controlled `open` state so we can assert that the parent's
 * `onOpenChange` is called by the component (e.g. on Cancel without dirty,
 * or after Discard-confirmation).
 */
function renderModal(opts?: {
  projectId?: string;
  initiallyOpen?: boolean;
}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <ProjectContextSettings
      projectId={opts?.projectId ?? PROJECT_ID}
      open={opts?.initiallyOpen ?? true}
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange, ...utils };
}

beforeEach(() => {
  mockUpdateProjectContext.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Wipe the global fetch stub between tests so a leak from one test does not
  // pollute the next render.
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

// ---------------------------------------------------------------------------
// AC-1: Initial-Load — GET-Call + Textarea befüllt + Counter + disabled Save
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-1 Initial Load", () => {
  /**
   * AC-1: GIVEN ein Owner öffnet die Komponente für ein Projekt mit gespeichertem
   *   `context_instructions = "psychedelic vintage prints"`
   * WHEN die Komponente mountet
   * THEN ruft `GET /api/projects/{id}/context` einmal auf, befüllt das Textarea
   *   mit dem geladenen Wert; Char-Counter zeigt `26 / 8,000`; Save-Button ist
   *   `disabled` (kein Dirty-State); "Last updated"-Zeile zeigt formatiertes
   *   `context_updated_at`.
   */
  it("AC-1: fetches context on mount, populates textarea, counter shows 26 / 8,000, save disabled, last-updated visible", async () => {
    const fetchSpy = stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "psychedelic vintage prints",
        context_updated_at: "2026-04-17T14:22:00.000Z",
      }),
    );

    renderModal();

    // GET endpoint called exactly once with the right URL + cache: "no-store"
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(`/api/projects/${PROJECT_ID}/context`);
    expect(calledInit).toMatchObject({ method: "GET", cache: "no-store" });

    // Textarea populated with the fetched value
    const textarea = await screen.findByTestId("context-textarea");
    await waitFor(() => {
      expect(textarea).toHaveValue("psychedelic vintage prints");
    });
    expect(textarea).not.toBeDisabled();

    // Counter shows "26 / 8,000 chars" — wireframes.md format
    const counter = screen.getByTestId("context-counter");
    expect(counter).toHaveTextContent("26 / 8,000 chars");
    // Counter NOT in over-limit color
    expect(counter.className).toContain("text-muted-foreground");

    // Save disabled while clean (no dirty state)
    const saveBtn = screen.getByTestId("save-btn");
    expect(saveBtn).toBeDisabled();

    // Last-updated row is rendered (formatted via Intl.DateTimeFormat — we
    // only assert it shows SOME text starting with "Last updated:")
    const lastUpdated = screen.getByTestId("last-updated-row");
    expect(lastUpdated).toBeInTheDocument();
    expect(lastUpdated.textContent ?? "").toMatch(/Last updated:/);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Live Char-Counter + over-limit Color + Save-Disable
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-2 Live counter & over-limit", () => {
  /**
   * AC-2: GIVEN Komponente offen mit geladenem Wert
   * WHEN User tippt im Textarea einen neuen Wert (Dirty-State)
   * THEN Char-Counter aktualisiert live (Format `{n} / 8,000`); Save-Button wird
   *   `enabled`; bei `length > 8000` wird Counter rot eingefärbt UND Save-Button
   *   erneut `disabled`.
   */
  it("AC-2: counter updates live; save enables on dirty; counter turns red & save re-disables when > 8000", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "abc",
        context_updated_at: "2026-04-17T14:22:00.000Z",
      }),
    );

    const user = userEvent.setup();
    renderModal();

    const textarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea).toHaveValue("abc");
    });

    const counter = screen.getByTestId("context-counter");
    const saveBtn = screen.getByTestId("save-btn");

    // Type a single extra character — dirty + counter increments
    await user.type(textarea, "d");
    expect(textarea).toHaveValue("abcd");
    expect(counter).toHaveTextContent("4 / 8,000 chars");
    expect(saveBtn).not.toBeDisabled();
    expect(counter.className).toContain("text-muted-foreground");

    // Programmatically inject an >8000 char value to avoid 8001 user.type calls
    // (still goes through the controlled change handler — same code path).
    const longValue = "x".repeat(8001);
    // Use fireEvent-style change via the userEvent paste API
    await user.clear(textarea);
    await user.click(textarea);
    // Direct value assignment via React change event
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(textarea, longValue);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(textarea.value.length).toBe(8001);
    // Counter shows 8,001 / 8,000 chars
    expect(counter).toHaveTextContent("8,001 / 8,000 chars");
    // Counter is now in destructive (red) class
    expect(counter.className).toContain("text-destructive");
    // Save is disabled because over limit
    expect(saveBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Save Happy-Path
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-3 Save Happy-Path", () => {
  /**
   * AC-3: GIVEN Dirty-State mit gültigem Wert (≤ 8000 chars)
   * WHEN User klickt Save
   * THEN ruft `updateProjectContext({ projectId, contextInstructions })` genau
   *   einmal auf; Save-Button zeigt Pending-State; nach Erfolg "✓ Saved";
   *   "Last updated"-Zeile aktualisiert sich; Modal bleibt offen; Dirty zurueckgesetzt.
   */
  it("AC-3: calls updateProjectContext once, shows pending then saved indicator, updates last-updated, resets dirty", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "old value",
        context_updated_at: "2026-01-01T10:00:00.000Z",
      }),
    );

    // Long-running action so we can assert the pending-state mid-flight.
    let resolveSave!: (v: {
      contextInstructions: string;
      contextUpdatedAt: Date;
    }) => void;
    const savePromise = new Promise<{
      contextInstructions: string;
      contextUpdatedAt: Date;
    }>((resolve) => {
      resolveSave = resolve;
    });
    mockUpdateProjectContext.mockReturnValue(savePromise);

    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    const textarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).toHaveValue("old value"));

    // Make dirty
    await user.clear(textarea);
    await user.type(textarea, "new value");
    expect(textarea).toHaveValue("new value");

    const saveBtn = screen.getByTestId("save-btn");
    expect(saveBtn).not.toBeDisabled();

    // Click Save — server-action should be called immediately with the args
    await user.click(saveBtn);

    expect(mockUpdateProjectContext).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectContext).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      contextInstructions: "new value",
    });

    // Pending-State: save shows spinner (Loader2 svg) and is disabled,
    // textarea is read-only/disabled while saving (per AC-3 wireframes/saving)
    await waitFor(() => {
      expect(saveBtn).toBeDisabled();
    });
    expect(saveBtn.querySelector("svg")).toBeInTheDocument();
    expect(textarea).toBeDisabled();

    // Resolve the action — saved indicator appears, last-updated refreshes
    const newDate = new Date("2026-05-09T12:00:00.000Z");
    await act(async () => {
      resolveSave({
        contextInstructions: "new value",
        contextUpdatedAt: newDate,
      });
      // Flush microtasks
      await Promise.resolve();
    });

    // Saved indicator visible (auto-hides via setTimeout — we just verify it
    // appears at least once)
    const savedIndicator = await screen.findByTestId("saved-indicator");
    expect(savedIndicator).toBeInTheDocument();

    // Last-updated row reflects the new timestamp (formatted; we just check
    // it is still rendered after save)
    const lastUpdated = screen.getByTestId("last-updated-row");
    expect(lastUpdated).toBeInTheDocument();

    // Modal stays open (parent onOpenChange NOT called with `false`)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    // Dirty state reset — Save button is disabled because draft equals new
    // canonical baseline ("new value" === "new value")
    await waitFor(() => {
      expect(screen.getByTestId("save-btn")).toBeDisabled();
    });
    expect(textarea).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Save-Error — Inline-Error + Dirty bleibt + Save wieder enabled
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-4 Save Error", () => {
  /**
   * AC-4: GIVEN Server-Action liefert `{ error: "Context exceeds maximum length of 8000 characters." }`
   * WHEN Save-Pfad terminiert
   * THEN Modal zeigt Inline-Error unter Save-Button mit dem `error`-String;
   *   Dirty bleibt; Textarea bleibt editierbar; Save ist nach Error wieder enabled für Retry.
   */
  it("AC-4: shows inline error from server action, preserves dirty state, re-enables save for retry", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "baseline",
        context_updated_at: "2026-01-01T10:00:00.000Z",
      }),
    );
    const errorMessage =
      "Context exceeds maximum length of 8000 characters.";
    mockUpdateProjectContext.mockResolvedValueOnce({ error: errorMessage });

    const user = userEvent.setup();
    renderModal();

    const textarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).toHaveValue("baseline"));

    await user.clear(textarea);
    await user.type(textarea, "dirty draft");

    const saveBtn = screen.getByTestId("save-btn");
    await user.click(saveBtn);

    // Inline error rendered with the exact error string
    const errorEl = await screen.findByTestId("save-error");
    expect(errorEl).toHaveTextContent(errorMessage);
    expect(errorEl).toHaveAttribute("role", "alert");

    // Dirty state preserved — draft still differs from baseline "baseline"
    expect(textarea).toHaveValue("dirty draft");

    // Textarea remains editable (not disabled now that save settled)
    expect(textarea).not.toBeDisabled();

    // Save button re-enabled for retry (still dirty, not saving)
    expect(saveBtn).not.toBeDisabled();

    // Action was called exactly once (no retry yet)
    expect(mockUpdateProjectContext).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Cancel mit Dirty → Confirm-Dialog
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-5 Cancel-with-dirty Confirm", () => {
  /**
   * AC-5: GIVEN Dirty-State und User klickt Cancel
   * WHEN Cancel-Trigger feuert
   * THEN öffnet Confirm-Dialog (Radix `AlertDialog`) mit Titel exakt
   *   "Ungespeicherte Änderungen verwerfen?" und zwei Buttons "Verwerfen" / "Bearbeiten";
   *   Modal schließt NICHT direkt. "Verwerfen" schließt Modal verlustig der
   *   Änderungen; "Bearbeiten" schließt nur den Confirm-Dialog.
   */
  it("AC-5a: shows AlertDialog with exact title and Verwerfen/Bearbeiten when cancel pressed with dirty state", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "saved",
        context_updated_at: "2026-01-01T10:00:00.000Z",
      }),
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    const textarea = await screen.findByTestId("context-textarea");
    await waitFor(() => expect(textarea).toHaveValue("saved"));

    // Make dirty
    await user.clear(textarea);
    await user.type(textarea, "edited");

    // Click Cancel
    const cancelBtn = screen.getByTestId("cancel-btn");
    await user.click(cancelBtn);

    // Confirm-Discard AlertDialog visible with exact title + buttons
    const confirmDialog = await screen.findByTestId("confirm-discard-dialog");
    expect(confirmDialog).toBeInTheDocument();

    // Exact title (from architecture.md → Error-Handling-Strategy, line 498)
    expect(
      screen.getByText("Ungespeicherte Änderungen verwerfen?"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("discard-btn")).toHaveTextContent("Verwerfen");
    expect(screen.getByTestId("keep-editing-btn")).toHaveTextContent(
      "Bearbeiten",
    );

    // Modal NOT closed yet
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("AC-5b: 'Verwerfen' closes the modal (calls onOpenChange(false))", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "saved",
        context_updated_at: "2026-01-01T10:00:00.000Z",
      }),
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    const textarea = await screen.findByTestId("context-textarea");
    await waitFor(() => expect(textarea).toHaveValue("saved"));

    // Make dirty
    await user.clear(textarea);
    await user.type(textarea, "x");

    await user.click(screen.getByTestId("cancel-btn"));
    await screen.findByTestId("confirm-discard-dialog");

    await user.click(screen.getByTestId("discard-btn"));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("AC-5c: 'Bearbeiten' closes only the confirm dialog; settings modal stays open", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "saved",
        context_updated_at: "2026-01-01T10:00:00.000Z",
      }),
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    const textarea = await screen.findByTestId("context-textarea");
    await waitFor(() => expect(textarea).toHaveValue("saved"));

    // Append a character (no clear) so the draft is "savedy" — keeps the
    // dirty-vs-baseline contrast strong and verifies the draft survives the
    // Bearbeiten round-trip.
    await user.type(textarea, "y");
    expect(textarea).toHaveValue("savedy");

    await user.click(screen.getByTestId("cancel-btn"));
    await screen.findByTestId("confirm-discard-dialog");

    await user.click(screen.getByTestId("keep-editing-btn"));

    // The confirm dialog vanishes; settings modal still open (no
    // onOpenChange(false) emitted) and the dirty draft survives.
    await waitFor(() => {
      expect(
        screen.queryByTestId("confirm-discard-dialog"),
      ).not.toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("context-textarea")).toHaveValue("savedy");
  });
});

// ---------------------------------------------------------------------------
// AC-6: Cancel ohne Dirty → Modal schließt direkt
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-6 Cancel-without-dirty closes directly", () => {
  /**
   * AC-6: GIVEN kein Dirty-State und User klickt Cancel
   * WHEN Cancel-Trigger feuert
   * THEN Modal schließt direkt OHNE Confirm-Dialog.
   */
  it("AC-6: closes modal directly without confirm dialog when not dirty", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "unchanged",
        context_updated_at: "2026-01-01T10:00:00.000Z",
      }),
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    const textarea = await screen.findByTestId("context-textarea");
    await waitFor(() => expect(textarea).toHaveValue("unchanged"));

    // Click Cancel without modifying anything
    await user.click(screen.getByTestId("cancel-btn"));

    // No confirm dialog appears
    expect(
      screen.queryByTestId("confirm-discard-dialog"),
    ).not.toBeInTheDocument();

    // onOpenChange called with false (modal closes)
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// ---------------------------------------------------------------------------
// AC-7: Loading-State + 404-Path
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-7 Loading & 404", () => {
  /**
   * AC-7a: GIVEN initiale Last (Komponente mountet, GET läuft)
   * WHEN Render-Phase
   * THEN Textarea ist `disabled` während Loading; Save-Button ist `disabled`;
   *   Counter zeigt `0 / 8,000` als Fallback.
   */
  it("AC-7a: textarea and save are disabled while fetch is pending; counter shows 0 / 8,000", async () => {
    // Pending fetch — never resolves during the assertions below
    let resolveFetch!: (v: FetchResponseLike) => void;
    const pending = new Promise<FetchResponseLike>((resolve) => {
      resolveFetch = resolve;
    });
    stubFetchOnce(() => pending);

    renderModal();

    const textarea = await screen.findByTestId("context-textarea");
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute("aria-busy", "true");

    expect(screen.getByTestId("save-btn")).toBeDisabled();

    expect(screen.getByTestId("context-counter")).toHaveTextContent(
      "0 / 8,000 chars",
    );

    // Cleanup: resolve the pending fetch so React does not warn
    await act(async () => {
      resolveFetch(
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      );
      await Promise.resolve();
    });
  });

  /**
   * AC-7b: Wenn GET 404 liefert → Inline-Error "Project not found" und Modal
   *   kann nur via Cancel/ESC geschlossen werden.
   */
  it("AC-7b: renders 'Project not found' inline error on GET 404", async () => {
    stubFetchOnce(() => makeNotFoundResponse());

    renderModal();

    const errorEl = await screen.findByTestId("project-context-load-error");
    expect(errorEl).toHaveTextContent("Project not found");
    expect(errorEl).toHaveAttribute("role", "alert");

    // Textarea is NOT rendered when load-error is the terminal state
    expect(screen.queryByTestId("context-textarea")).not.toBeInTheDocument();

    // Cancel button still rendered → modal closeable via Cancel
    expect(screen.getByTestId("cancel-btn")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-8: Empty-State Wireframe — Placeholder + last-updated hidden
// ---------------------------------------------------------------------------

describe("ProjectContextSettings — AC-8 Empty State", () => {
  /**
   * AC-8: GIVEN geladener Wert ist `null` oder leerer String (kein Context bisher)
   * WHEN Komponente initial rendert
   * THEN Textarea ist leer mit Placeholder; Counter `0 / 8,000`;
   *   "Last updated"-Zeile NICHT sichtbar; Save initial disabled.
   */
  it("AC-8a: when context_instructions is null, renders placeholder, no last-updated, save disabled, counter 0 / 8,000", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    renderModal();

    const textarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).not.toBeDisabled());

    // Empty
    expect(textarea).toHaveValue("");
    // Placeholder per wireframe
    expect(textarea).toHaveAttribute(
      "placeholder",
      "Describe your project, so the assistant knows the vibe, style and recurring themes...",
    );

    // Counter 0 / 8,000
    expect(screen.getByTestId("context-counter")).toHaveTextContent(
      "0 / 8,000 chars",
    );

    // last-updated NOT rendered
    expect(screen.queryByTestId("last-updated-row")).not.toBeInTheDocument();

    // Save initial disabled (no dirty)
    expect(screen.getByTestId("save-btn")).toBeDisabled();
  });

  it("AC-8b: when context_instructions is empty string, treats as no-context (no last-updated)", async () => {
    stubFetchOnce(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "",
        context_updated_at: null,
      }),
    );

    renderModal();

    const textarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).not.toBeDisabled());

    expect(textarea).toHaveValue("");
    expect(screen.queryByTestId("last-updated-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("save-btn")).toBeDisabled();
  });
});
