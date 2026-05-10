// @vitest-environment jsdom
/**
 * Integration Tests for Slice 09 — Help-Me-Write Modal × ProjectContextSettings
 *
 * Source:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-09-helper-modal-component.md
 *
 * Scope:
 *   Verify the wiring between <ProjectContextSettings> (Slice 06 MODIFY) and
 *   <HelpMeWriteModal> (Slice 09 NEW). The Helper button opens the modal,
 *   the modal calls back to the parent via `onAccept(draft)`, and the parent
 *   writes the draft into its `context_textarea` (becoming dirty).
 *
 *   This is the RTL-level mirror of the Playwright spec at
 *   `tests/e2e/help-me-write-modal.spec.ts` (AC-9 done-signal). Mocking
 *   strategy is `mock_external` per slice spec — fetch + server-action mocks.
 *
 * Coverage:
 *   - "Help me write this" trigger opens the helper modal
 *   - Accept-flow writes the draft into context_textarea AND closes the
 *     helper modal (round-trip)
 *   - Save button becomes enabled after draft accept (dirty-state honoured)
 *   - Cancel after generate leaves context_textarea unchanged
 *   - Regenerate replaces an already-shown draft
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

const mockUpdateProjectContext = vi.fn();
vi.mock("@/app/actions/projects", () => ({
  updateProjectContext: (
    ...args: unknown[]
  ): Promise<unknown> => mockUpdateProjectContext(...args),
}));

// Component is loaded AFTER vi.mock — order matters in vitest.
import ProjectContextSettings from "@/components/projects/project-context-settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = "11111111-2222-3333-4444-555555555555";
const HELPER_ENDPOINT = "/api/projects/context/generate";
const GET_ENDPOINT = `/api/projects/${PROJECT_ID}/context`;

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function makeOkResponse(body: unknown, status = 200): FetchResponseLike {
  return { ok: true, status, json: () => Promise.resolve(body) };
}

/**
 * Install a global fetch impl that routes by URL:
 *   GET /api/projects/{id}/context           → loadResponse
 *   POST /api/projects/context/generate      → generateResponseFactory()
 */
function installRoutedFetch(opts: {
  load: () => FetchResponseLike;
  generate: () => Promise<FetchResponseLike>;
}) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    if (url.endsWith(GET_ENDPOINT) && (init?.method ?? "GET") === "GET") {
      return opts.load();
    }
    if (url === HELPER_ENDPOINT && init?.method === "POST") {
      return opts.generate();
    }
    throw new Error(`Unexpected fetch in test: ${init?.method ?? "GET"} ${url}`);
  });
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    spy as unknown as typeof fetch;
  return spy;
}

function renderHost() {
  const onOpenChange = vi.fn();
  const utils = render(
    <ProjectContextSettings
      projectId={PROJECT_ID}
      open={true}
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
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

// ---------------------------------------------------------------------------
// Helper trigger opens the modal
// ---------------------------------------------------------------------------

describe("ProjectContextSettings × HelpMeWriteModal — Helper Trigger Wiring", () => {
  /**
   * The "Help me write this" button must open <HelpMeWriteModal>. This is the
   * Mount-Slot wiring that Slice 06 reserved for Slice 09 (see slice-06
   * Provides line 145 + Slice 09 Deliverables).
   */
  it("clicking 'Help me write this' opens the helper modal", async () => {
    installRoutedFetch({
      load: () =>
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      generate: async () => makeOkResponse({ draft: "irrelevant" }),
    });

    const user = userEvent.setup();
    renderHost();

    // Wait for the textarea to mount (initial GET resolved)
    const textarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).not.toBeDisabled());

    // Helper modal not rendered before the trigger fires
    expect(screen.queryByTestId("helper-brief-input")).not.toBeInTheDocument();

    // Click the trigger
    const helpBtn = screen.getByTestId("help-me-write-btn");
    await user.click(helpBtn);

    // Helper modal now rendered
    const briefInput = await screen.findByTestId("helper-brief-input");
    expect(briefInput).toBeInTheDocument();
    expect(briefInput).toHaveValue("");
    expect(screen.getByTestId("helper-generate-btn")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Accept-flow writes draft into context_textarea (Done-Signal)
// ---------------------------------------------------------------------------

describe("ProjectContextSettings × HelpMeWriteModal — Accept round-trip", () => {
  /**
   * Done-Signal (slim-slices.md line 147 + slice-09 AC-9):
   *   open Settings → Help me write → type brief → Generate → wait for draft
   *   → Accept → Modal closes AND context_textarea contains the draft.
   */
  it("Accept fills context_textarea with the draft, closes helper modal, and marks dirty", async () => {
    const draftText = "Curated POD shop for psychedelic mushroom prints.";
    installRoutedFetch({
      load: () =>
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      generate: async () => makeOkResponse({ draft: draftText }),
    });

    const user = userEvent.setup();
    renderHost();

    const ctxTextarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(ctxTextarea).not.toBeDisabled());
    expect(ctxTextarea).toHaveValue("");

    // Save button initially disabled (no dirty)
    expect(screen.getByTestId("save-btn")).toBeDisabled();

    // Open helper
    await user.click(screen.getByTestId("help-me-write-btn"));

    const briefInput = await screen.findByTestId("helper-brief-input");
    await user.type(briefInput, "psychedelic mushroom prints shop");
    await user.click(screen.getByTestId("helper-generate-btn"));

    // Wait until the Accept button is rendered (= draft_ready)
    const accept = await screen.findByTestId("helper-accept-btn");

    await user.click(accept);

    // Helper modal removed from DOM (closed via onOpenChange(false))
    await waitFor(() => {
      expect(
        screen.queryByTestId("helper-brief-input"),
      ).not.toBeInTheDocument();
    });

    // Parent context_textarea is filled with the draft
    expect(ctxTextarea).toHaveValue(draftText);

    // Save button now enabled (dirty: draft != null-baseline-as-empty-string)
    expect(screen.getByTestId("save-btn")).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Regenerate replaces an already-shown draft
// ---------------------------------------------------------------------------

describe("ProjectContextSettings × HelpMeWriteModal — Regenerate replaces draft", () => {
  /**
   * AC-9 sub-case (a): Regenerate replaces a previously generated draft.
   *
   * The integration here verifies that a NEW Accept after Regenerate writes
   * the SECOND draft (not the first) into context_textarea — proves Slice
   * 09's "no append, no history" rule is honoured at the integration level.
   */
  it("Regenerate replaces draft; subsequent Accept writes the second draft to context_textarea", async () => {
    const drafts = ["draft-one", "draft-two"];
    let callIndex = 0;
    installRoutedFetch({
      load: () =>
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      generate: async () => {
        const text = drafts[callIndex] ?? "later-draft";
        callIndex += 1;
        return makeOkResponse({ draft: text });
      },
    });

    const user = userEvent.setup();
    renderHost();

    const ctxTextarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(ctxTextarea).not.toBeDisabled());

    await user.click(screen.getByTestId("help-me-write-btn"));
    const briefInput = await screen.findByTestId("helper-brief-input");
    await user.type(briefInput, "valid brief content here");
    await user.click(screen.getByTestId("helper-generate-btn"));

    // First draft visible
    const preview = await screen.findByTestId("helper-draft-preview");
    expect(preview).toHaveTextContent(drafts[0]);

    // Regenerate
    await user.click(screen.getByTestId("helper-regenerate-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("helper-draft-preview")).toHaveTextContent(
        drafts[1],
      );
    });

    // Accept — context_textarea must end up with the second draft
    await user.click(screen.getByTestId("helper-accept-btn"));

    await waitFor(() => {
      expect(ctxTextarea).toHaveValue(drafts[1]);
    });
    expect(ctxTextarea).not.toHaveValue(drafts[0]);
  });
});

// ---------------------------------------------------------------------------
// Cancel after generate leaves context_textarea unchanged
// ---------------------------------------------------------------------------

describe("ProjectContextSettings × HelpMeWriteModal — Cancel preserves parent state", () => {
  /**
   * AC-9 sub-case (b): Cancel after generating a draft must NOT modify the
   * parent's context_textarea. The draft only flows to the parent via the
   * explicit Accept callback.
   */
  it("Cancel after generate does not modify context_textarea", async () => {
    installRoutedFetch({
      load: () =>
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: "preserve-me",
          context_updated_at: "2026-04-17T14:22:00.000Z",
        }),
      generate: async () =>
        makeOkResponse({ draft: "should-not-appear-in-parent" }),
    });

    const user = userEvent.setup();
    renderHost();

    const ctxTextarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(ctxTextarea).toHaveValue("preserve-me"));

    await user.click(screen.getByTestId("help-me-write-btn"));
    const briefInput = await screen.findByTestId("helper-brief-input");
    await user.type(briefInput, "valid brief content here");
    await user.click(screen.getByTestId("helper-generate-btn"));

    // Wait for draft_ready
    await screen.findByTestId("helper-accept-btn");

    // Click Cancel inside the helper modal — NOT Accept
    await user.click(screen.getByTestId("helper-cancel-btn"));

    // Helper modal closes
    await waitFor(() => {
      expect(
        screen.queryByTestId("helper-brief-input"),
      ).not.toBeInTheDocument();
    });

    // Parent context_textarea unchanged (still the loaded baseline)
    expect(ctxTextarea).toHaveValue("preserve-me");
    // Save still disabled (not dirty)
    expect(screen.getByTestId("save-btn")).toBeDisabled();
  });

  it("Cancel from empty context (null baseline) keeps context_textarea empty", async () => {
    installRoutedFetch({
      load: () =>
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      generate: async () =>
        makeOkResponse({ draft: "draft-text-that-must-not-leak" }),
    });

    const user = userEvent.setup();
    renderHost();

    const ctxTextarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(ctxTextarea).not.toBeDisabled());
    expect(ctxTextarea).toHaveValue("");

    await user.click(screen.getByTestId("help-me-write-btn"));
    const briefInput = await screen.findByTestId("helper-brief-input");
    await user.type(briefInput, "valid brief content here");
    await user.click(screen.getByTestId("helper-generate-btn"));

    // Draft ready → Cancel
    await screen.findByTestId("helper-accept-btn");
    await user.click(screen.getByTestId("helper-cancel-btn"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("helper-brief-input"),
      ).not.toBeInTheDocument();
    });

    expect(ctxTextarea).toHaveValue("");
    expect(screen.getByTestId("save-btn")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Re-open after Accept resets helper internal state
// ---------------------------------------------------------------------------

describe("ProjectContextSettings × HelpMeWriteModal — Re-open resets helper", () => {
  /**
   * Defensive integration check: after Accept the helper resets its internal
   * state (brief / draft / state machine) so that the next open of the helper
   * starts at `empty`. Prevents leaking the previous draft into a fresh
   * Generate cycle.
   */
  it("re-opening helper after Accept resets brief input and draft state", async () => {
    let callIndex = 0;
    installRoutedFetch({
      load: () =>
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      generate: async () => {
        callIndex += 1;
        return makeOkResponse({ draft: `draft-${callIndex}` });
      },
    });

    const user = userEvent.setup();
    renderHost();

    const ctxTextarea = (await screen.findByTestId(
      "context-textarea",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(ctxTextarea).not.toBeDisabled());

    // Cycle 1: open → generate → accept
    await user.click(screen.getByTestId("help-me-write-btn"));
    const briefInput1 = await screen.findByTestId("helper-brief-input");
    await user.type(briefInput1, "valid brief content one");
    await user.click(screen.getByTestId("helper-generate-btn"));
    const accept1 = await screen.findByTestId("helper-accept-btn");
    await user.click(accept1);

    await waitFor(() => {
      expect(ctxTextarea).toHaveValue("draft-1");
    });

    // Cycle 2: re-open helper. Brief input MUST be empty again.
    await user.click(screen.getByTestId("help-me-write-btn"));
    const briefInput2 = await screen.findByTestId("helper-brief-input");
    await waitFor(() => {
      expect(briefInput2).toHaveValue("");
    });
    expect(screen.queryByTestId("helper-draft-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("helper-generate-btn")).toBeDisabled();

    // Cleanup pending state — close helper to avoid React act-warning leakage.
    await user.click(screen.getByTestId("helper-cancel-btn"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("helper-brief-input"),
      ).not.toBeInTheDocument();
    });
    // Parent textarea still has draft-1 (Cancel does not roll back)
    expect(ctxTextarea).toHaveValue("draft-1");
    // Suppress unused variable warning for `act`
    void act;
  });
});
