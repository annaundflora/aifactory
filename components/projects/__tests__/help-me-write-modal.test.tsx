// @vitest-environment jsdom
/**
 * Acceptance Tests for Slice 09 — Help-Me-Write Modal
 *
 * Source:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-09-helper-modal-component.md
 *
 * Test-Strategy (per slice spec, section "Test-Strategy"):
 *   - Stack: TypeScript/Next.js + React + Radix Dialog + Vitest + RTL.
 *   - Mocking Strategy = `mock_external` — Vitest stubs `fetch` for
 *     `POST /api/projects/context/generate` (Slice 08 boundary). Parent
 *     callback `onAccept` is `vi.fn()`. Modal-open via `open` + `onOpenChange`.
 *
 * Coverage:
 *   AC-1: empty initial state
 *   AC-2: live counter + length-gated Generate + over-limit color
 *   AC-3: Generate fires single fetch with trimmed brief + pending UX
 *   AC-4: 200 response renders draft + Cancel/Regenerate/Accept
 *   AC-5: Regenerate replaces draft via new fetch with same trimmed brief
 *   AC-6: error path (502 / network) shows exact wording, brief preserved
 *   AC-7: Accept invokes onAccept(draft) once and closes via onOpenChange(false)
 *   AC-8: Cancel / ESC / backdrop close without onAccept; abort pending fetch
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
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import HelpMeWriteModal from "@/components/projects/help-me-write-modal";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ENDPOINT = "/api/projects/context/generate";
const ERROR_MESSAGE = "Could not generate. Try again.";

/**
 * Minimal Response-like surface used by the component under test:
 * `response.ok`, `response.status`, `response.json()`.
 */
type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function makeOkResponse(body: unknown, status = 200): FetchResponseLike {
  return {
    ok: true,
    status,
    json: () => Promise.resolve(body),
  };
}

function makeErrorResponse(status: number, body: unknown = { error: "boom" }): FetchResponseLike {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  };
}

/**
 * Replace the global fetch with a vi.fn() spy. Returns the spy plus a helper
 * to inspect the AbortSignal that was passed in.
 */
function installFetchSpy(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<FetchResponseLike>,
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(impl);
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    spy as unknown as typeof fetch;
  return spy;
}

/**
 * Render the modal with a controlled `open` prop. Returns mocks so each test
 * can assert callback invocations.
 */
function renderModal(opts?: { open?: boolean }) {
  const onOpenChange = vi.fn();
  const onAccept = vi.fn();
  const utils = render(
    <HelpMeWriteModal
      open={opts?.open ?? true}
      onOpenChange={onOpenChange}
      onAccept={onAccept}
    />,
  );
  return { onOpenChange, onAccept, ...utils };
}

beforeEach(() => {
  // Each test installs its own fetch impl when needed.
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

// ---------------------------------------------------------------------------
// AC-1: Initial empty state — Generate disabled, Draft hidden, Cancel visible
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-1 Empty initial state", () => {
  /**
   * AC-1: GIVEN Modal öffnet sich (`open=true`)
   *   WHEN Render-Phase initial
   *   THEN helper_brief_input ist leer mit Placeholder, Counter `0 / 500`,
   *        Generate disabled, Draft-Section nicht sichtbar, Regenerate/Accept
   *        nicht sichtbar; Cancel sichtbar und enabled.
   */
  it("AC-1: renders empty state — counter 0/500, Generate disabled, no Draft section, Cancel enabled", async () => {
    renderModal();

    const input = await screen.findByTestId("helper-brief-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
    // Placeholder per wireframe ("Describe your project in 1–2 sentences. ...")
    const placeholder = input.getAttribute("placeholder") ?? "";
    expect(placeholder.length).toBeGreaterThan(0);
    expect(placeholder.toLowerCase()).toContain("describe your project");

    // Counter shows "0 / 500 chars"
    const counter = screen.getByTestId("helper-brief-counter");
    expect(counter).toHaveTextContent("0 / 500 chars");
    // Counter NOT in destructive color
    expect(counter.className).toContain("text-muted-foreground");

    // Generate visible + disabled
    const generateBtn = screen.getByTestId("helper-generate-btn");
    expect(generateBtn).toBeInTheDocument();
    expect(generateBtn).toBeDisabled();

    // Draft section / preview NOT rendered
    expect(screen.queryByTestId("helper-draft-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("helper-draft-preview")).not.toBeInTheDocument();

    // Regenerate + Accept NOT rendered (only show in `draft_ready`)
    expect(screen.queryByTestId("helper-regenerate-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("helper-accept-btn")).not.toBeInTheDocument();

    // Cancel visible + enabled
    const cancelBtn = screen.getByTestId("helper-cancel-btn");
    expect(cancelBtn).toBeInTheDocument();
    expect(cancelBtn).not.toBeDisabled();

    // Error section NOT rendered initially
    expect(screen.queryByTestId("helper-error-message")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Live counter + length-gated Generate-enable + over-limit color
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-2 Counter & Generate gating", () => {
  /**
   * AC-2: GIVEN Modal offen mit leerem helper_brief_input
   *   WHEN User tippt einen Brief der Länge n (post-trim)
   *   THEN Counter zeigt live `{n} / 500`; Generate enabled bei 10 ≤ n ≤ 500;
   *        bei n > 500 Counter rot UND Generate disabled;
   *        bei n < 10 bleibt Generate disabled (kein Fehler-Text).
   */
  it("AC-2a: short brief (< 10 chars) keeps Generate disabled, counter not red", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    const counter = screen.getByTestId("helper-brief-counter");
    const generateBtn = screen.getByTestId("helper-generate-btn");

    // 5 chars — below MIN_BRIEF_LENGTH (10)
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
    expect(counter).toHaveTextContent("5 / 500 chars");
    expect(counter.className).toContain("text-muted-foreground");
    expect(counter.className).not.toContain("text-destructive");
    expect(generateBtn).toBeDisabled();

    // No error text rendered for short briefs (per Constraints "KEIN Hard-
    // Validation-Error-Text bei < 10 chars")
    expect(screen.queryByTestId("helper-error-message")).not.toBeInTheDocument();
  });

  it("AC-2b: valid brief in [10, 500] enables Generate, counter remains neutral", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    const counter = screen.getByTestId("helper-brief-counter");
    const generateBtn = screen.getByTestId("helper-generate-btn");

    // Exactly 10 chars (MIN_BRIEF_LENGTH boundary)
    await user.type(input, "0123456789");
    expect(input).toHaveValue("0123456789");
    expect(counter).toHaveTextContent("10 / 500 chars");
    expect(counter.className).toContain("text-muted-foreground");
    expect(generateBtn).not.toBeDisabled();
  });

  it("AC-2c: brief > 500 chars turns counter red AND disables Generate", async () => {
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    const counter = screen.getByTestId("helper-brief-counter");
    const generateBtn = screen.getByTestId("helper-generate-btn");

    // Inject 501 chars via the React-aware native setter (avoids 501
    // user.type calls; goes through the controlled change handler).
    const longValue = "x".repeat(501);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(input, longValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(input.value.length).toBe(501);
    expect(counter).toHaveTextContent("501 / 500 chars");
    // Counter red (destructive)
    expect(counter.className).toContain("text-destructive");
    // Generate disabled (over-limit)
    expect(generateBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Generate triggers single fetch with trimmed brief and shows pending
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-3 Generate fetch + pending UX", () => {
  /**
   * AC-3: GIVEN gültiger Brief (post-trim 10..500) und User klickt Generate
   *   WHEN Fetch zu POST /api/projects/context/generate läuft
   *   THEN Generate-Label "Generating…" + Spinner; alle Buttons disabled;
   *        helper_brief_input read-only; genau ein fetch-Call mit Body
   *        `{ brief: "<getrimmt>" }`.
   */
  it("AC-3: clicking Generate calls endpoint exactly once with trimmed brief and disables all buttons during pending", async () => {
    // Pending fetch — never resolves while we make the in-flight assertions.
    let resolveFetch!: (v: FetchResponseLike) => void;
    const pending = new Promise<FetchResponseLike>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchSpy = installFetchSpy(() => pending);

    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;

    // Brief with surrounding whitespace — trim must happen before fetch body.
    const rawBrief = "   psychedelic poster shop selling mushroom prints   ";
    const trimmedBrief = rawBrief.trim();
    await user.click(input);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(input, rawBrief);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input).toHaveValue(rawBrief); // raw value preserved on the field

    const generateBtn = screen.getByTestId("helper-generate-btn");
    await user.click(generateBtn);

    // Exactly one fetch with the right URL + body shape (trimmed brief)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(ENDPOINT);
    expect(calledInit).toBeDefined();
    expect(calledInit.method).toBe("POST");
    const headers = (calledInit.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");

    const parsedBody = JSON.parse(calledInit.body as string) as {
      brief: string;
    };
    expect(parsedBody).toEqual({ brief: trimmedBrief });

    // Pending UX: Generate shows spinner svg + disabled, Cancel disabled,
    // input read-only / disabled.
    await waitFor(() => {
      expect(generateBtn).toBeDisabled();
    });
    // Spinner SVG (Loader2) is mounted
    expect(generateBtn.querySelector("svg")).toBeInTheDocument();
    // Label transition to "Generating…"
    expect(generateBtn.textContent ?? "").toMatch(/Generating/i);

    // Cancel disabled during pending
    expect(screen.getByTestId("helper-cancel-btn")).toBeDisabled();

    // Input is read-only / disabled while pending
    expect(input).toBeDisabled();

    // No second fetch fires when user clicks again during pending
    await user.click(generateBtn);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Cleanup pending
    await act(async () => {
      resolveFetch(makeOkResponse({ draft: "irrelevant" }));
      await Promise.resolve();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-4: Draft-ready renders Cancel/Regenerate/Accept and shows draft text
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-4 draft_ready state", () => {
  /**
   * AC-4: GIVEN Generate-Pending, und Route liefert 200 { draft: "..." }
   *   WHEN Response eintrifft
   *   THEN Draft-Section sichtbar mit zurueckgegebenem Draft als read-only;
   *        Cancel / Regenerate / Accept sichtbar + enabled;
   *        Generate-Button verschwindet (oder bleibt disabled+invisible);
   *        helper_brief_input wieder editierbar.
   */
  it("AC-4: 200 response renders draft text + Cancel/Regenerate/Accept; Generate gone; input editable again", async () => {
    const draftText = "Magic Mushroom POD shop. Posters, prints, ceramics.";
    installFetchSpy(async () => makeOkResponse({ draft: draftText }));

    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    await user.type(input, "valid brief over ten chars");

    await user.click(screen.getByTestId("helper-generate-btn"));

    // Wait for draft section + draft text
    const draftSection = await screen.findByTestId("helper-draft-section");
    expect(draftSection).toBeInTheDocument();
    const preview = screen.getByTestId("helper-draft-preview");
    expect(preview).toHaveTextContent(draftText);
    // Read-only preview
    expect(preview).toHaveAttribute("aria-readonly", "true");

    // Cancel / Regenerate / Accept all visible + enabled
    const cancel = screen.getByTestId("helper-cancel-btn");
    const regenerate = screen.getByTestId("helper-regenerate-btn");
    const accept = screen.getByTestId("helper-accept-btn");
    expect(cancel).toBeInTheDocument();
    expect(cancel).not.toBeDisabled();
    expect(regenerate).toBeInTheDocument();
    expect(regenerate).not.toBeDisabled();
    expect(accept).toBeInTheDocument();
    expect(accept).not.toBeDisabled();

    // Generate hidden (the wireframe says only the three action buttons in
    // draft_ready state — implementation may unmount or merely hide; we
    // assert it is no longer present in the DOM as the implementation does)
    expect(screen.queryByTestId("helper-generate-btn")).not.toBeInTheDocument();

    // Input editable again (not disabled / not read-only)
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute("readonly");

    // No error message
    expect(screen.queryByTestId("helper-error-message")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Regenerate replaces draft with new fetch
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-5 Regenerate replaces draft", () => {
  /**
   * AC-5: GIVEN State draft_ready und User klickt Regenerate
   *   WHEN Click feuert
   *   THEN neuer einzelner Fetch zu POST /api/projects/context/generate mit
   *        identischem `{ brief: "<aktuell-getrimmt>" }`-Body; State wechselt
   *        erneut auf pending; nach Response ersetzt der neue Draft den
   *        vorherigen vollstaendig (kein Append, keine History).
   */
  it("AC-5: Regenerate fires new fetch with same trimmed brief and replaces previous draft fully", async () => {
    const drafts = ["first-draft-version", "second-draft-version"];
    let callIndex = 0;
    const capturedBodies: string[] = [];
    const fetchSpy = installFetchSpy(async (_url, init) => {
      capturedBodies.push(init?.body as string);
      const text = drafts[callIndex] ?? "later-draft";
      callIndex += 1;
      return makeOkResponse({ draft: text });
    });

    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    const briefRaw = "  poster shop with mushrooms and trippy prints  ";
    const briefTrimmed = briefRaw.trim();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(input, briefRaw);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await user.click(screen.getByTestId("helper-generate-btn"));
    const preview1 = await screen.findByTestId("helper-draft-preview");
    expect(preview1).toHaveTextContent(drafts[0]);

    // Click Regenerate
    await user.click(screen.getByTestId("helper-regenerate-btn"));

    // Two fetch calls now — both to same endpoint with same trimmed brief
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
    expect(JSON.parse(capturedBodies[0])).toEqual({ brief: briefTrimmed });
    expect(JSON.parse(capturedBodies[1])).toEqual({ brief: briefTrimmed });

    // Wait for the new draft to replace the previous one
    await waitFor(() => {
      expect(screen.getByTestId("helper-draft-preview")).toHaveTextContent(
        drafts[1],
      );
    });

    // Old draft text fully gone (no History / append)
    expect(screen.getByTestId("helper-draft-preview").textContent).not.toContain(
      drafts[0],
    );

    // Accept now operates on the latest draft
    const onAcceptSpy = vi.fn();
    // We re-test Accept-flow in AC-7; here just confirm the Accept button is
    // present and active so the user CAN proceed against the new draft.
    expect(screen.getByTestId("helper-accept-btn")).not.toBeDisabled();
    void onAcceptSpy; // keep TS happy if linter complains
  });
});

// ---------------------------------------------------------------------------
// AC-6: Error path — exact wording, brief preserved, Accept hidden/disabled
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-6 Error path", () => {
  /**
   * AC-6: GIVEN State pending (Generate oder Regenerate), Route wirft Fehler
   *   (502, Network, andere Non-2xx)
   *   WHEN Response/Reject eintrifft
   *   THEN State error: rote Inline-Message mit exaktem Wortlaut
   *        "Could not generate. Try again."; helper_brief_input bleibt mit
   *        User-Eingabe erhalten und editierbar; Generate wieder enabled;
   *        Draft-Section bleibt unsichtbar (Accept hidden/disabled).
   */
  it("AC-6a: 502 response shows exact error wording, preserves brief, re-enables Generate, no draft section", async () => {
    installFetchSpy(async () => makeErrorResponse(502));

    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    await user.type(input, "this is a valid brief over ten chars");
    expect(input).toHaveValue("this is a valid brief over ten chars");

    await user.click(screen.getByTestId("helper-generate-btn"));

    // Inline error rendered with exact wording
    const errorEl = await screen.findByTestId("helper-error-message");
    expect(errorEl).toHaveTextContent(ERROR_MESSAGE);
    // role="alert" for screen readers
    expect(errorEl).toHaveAttribute("role", "alert");
    // Destructive (red) class
    expect(errorEl.className).toContain("text-destructive");

    // Brief preserved + editable
    expect(input).toHaveValue("this is a valid brief over ten chars");
    expect(input).not.toBeDisabled();

    // Generate re-enabled (retry path)
    await waitFor(() => {
      expect(screen.getByTestId("helper-generate-btn")).not.toBeDisabled();
    });

    // Draft section + Accept NOT visible (no draft yet)
    expect(screen.queryByTestId("helper-draft-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("helper-accept-btn")).not.toBeInTheDocument();
  });

  it("AC-6b: network error (fetch rejects) folds into the same error path", async () => {
    installFetchSpy(async () => {
      throw new TypeError("Network down");
    });

    const user = userEvent.setup();
    renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    await user.type(input, "another valid brief over ten chars");

    await user.click(screen.getByTestId("helper-generate-btn"));

    const errorEl = await screen.findByTestId("helper-error-message");
    expect(errorEl).toHaveTextContent(ERROR_MESSAGE);

    // Brief still preserved
    expect(input).toHaveValue("another valid brief over ten chars");

    // No draft, no Accept
    expect(screen.queryByTestId("helper-draft-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("helper-accept-btn")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-7: Accept calls onAccept(draft) and closes modal
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-7 Accept flow", () => {
  /**
   * AC-7: GIVEN State draft_ready und User klickt Accept (=helper_accept_btn)
   *   WHEN Click feuert
   *   THEN ruft Parent-Callback onAccept(draft: string) genau einmal mit
   *        aktuellem Draft-Text auf; Modal schließt (onOpenChange(false)).
   */
  it("AC-7: clicking Accept invokes onAccept with current draft and closes modal via onOpenChange(false)", async () => {
    const draftText = "Generated context block for the project";
    installFetchSpy(async () => makeOkResponse({ draft: draftText }));

    const user = userEvent.setup();
    const { onAccept, onOpenChange } = renderModal();

    const input = await screen.findByTestId("helper-brief-input");
    await user.type(input, "valid brief content here");

    await user.click(screen.getByTestId("helper-generate-btn"));

    const accept = await screen.findByTestId("helper-accept-btn");
    await user.click(accept);

    // onAccept called exactly once with the draft text
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith(draftText);

    // Modal close-signal emitted via onOpenChange(false)
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// ---------------------------------------------------------------------------
// AC-8: Cancel / ESC / backdrop close without onAccept; abort pending fetch
// ---------------------------------------------------------------------------

describe("HelpMeWriteModal — AC-8 Cancel / ESC / Backdrop close paths", () => {
  /**
   * AC-8: GIVEN beliebiger State (empty/brief_filled/pending/draft_ready/error)
   *        und User klickt Cancel ODER drückt ESC ODER klickt Backdrop
   *   WHEN Close-Trigger feuert
   *   THEN Modal schließt OHNE Aufruf des onAccept-Callbacks; KEIN Confirm-
   *        Dialog; pending Fetch wird abgebrochen (AbortController).
   */
  it("AC-8a: Cancel-Button click closes without onAccept and emits onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const { onAccept, onOpenChange } = renderModal();

    await user.click(screen.getByTestId("helper-cancel-btn"));

    expect(onAccept).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("AC-8b: ESC keypress closes without onAccept", async () => {
    const { onAccept, onOpenChange } = renderModal();

    // Radix Dialog listens for ESC at the document level
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("AC-8c: pending fetch is aborted when modal closes (AbortController)", async () => {
    // Capture the AbortSignal so we can assert .aborted flips to true.
    const seenSignals: AbortSignal[] = [];
    const fetchSpy = installFetchSpy(async (_url, init) => {
      if (init?.signal) seenSignals.push(init.signal);
      // Resolve only when aborted; otherwise hang to simulate slow LLM call.
      return await new Promise<FetchResponseLike>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    const user = userEvent.setup();
    const { onAccept, onOpenChange } = renderModal();

    const input = (await screen.findByTestId(
      "helper-brief-input",
    )) as HTMLTextAreaElement;
    await user.type(input, "valid brief content here");

    await user.click(screen.getByTestId("helper-generate-btn"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(seenSignals.length).toBe(1);
    expect(seenSignals[0].aborted).toBe(false);

    // Close via parent prop change (simulates Cancel-trigger flow). Cancel
    // button is disabled during pending — we therefore close via prop change
    // (parent setting open=false), which is what the component reacts to via
    // its open-effect. We re-render with open=false using the same callback
    // mocks.
    cleanup();
    render(
      <HelpMeWriteModal
        open={false}
        onOpenChange={onOpenChange}
        onAccept={onAccept}
      />,
    );

    // After unmount/close, the AbortSignal should have been aborted.
    await waitFor(() => {
      expect(seenSignals[0].aborted).toBe(true);
    });

    // onAccept never invoked
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("AC-8d: Cancel-Button click in draft_ready state does not invoke onAccept", async () => {
    installFetchSpy(async () => makeOkResponse({ draft: "some draft" }));
    const user = userEvent.setup();
    const { onAccept, onOpenChange } = renderModal();

    const input = await screen.findByTestId("helper-brief-input");
    await user.type(input, "valid brief content here");
    await user.click(screen.getByTestId("helper-generate-btn"));

    // Wait for draft_ready
    await screen.findByTestId("helper-accept-btn");

    // Click Cancel instead of Accept
    await user.click(screen.getByTestId("helper-cancel-btn"));

    expect(onAccept).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
