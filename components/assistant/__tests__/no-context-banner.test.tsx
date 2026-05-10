// @vitest-environment jsdom
/**
 * Acceptance Tests for Slice 10 — No-Context-Hint-Banner
 *
 * Source: specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *         slices/slice-10-no-context-banner.md
 * Test-Strategy: Mocking Strategy = `mock_external` (per slice spec).
 *   - We stub global `fetch` for `GET /api/projects/{id}/context`.
 *   - We mock `usePromptAssistant` to control `noContextBannerDismissed` and
 *     to capture `dispatch` calls.
 *   - The Banner is a Client Component that uses `useEffect`+`fetch`+`useState`;
 *     RTL drives the lifecycle exactly as the user would.
 *
 * Component-under-test: components/assistant/no-context-banner.tsx
 * (mounted unconditionally inside `assistant-panel.tsx`).
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

// Mock usePromptAssistant — the banner only uses { dispatch, noContextBannerDismissed }.
const mockDispatch = vi.fn();
let mockBannerDismissed = false;

vi.mock("@/lib/assistant/assistant-context", () => ({
  usePromptAssistant: () => ({
    dispatch: mockDispatch,
    noContextBannerDismissed: mockBannerDismissed,
  }),
}));

// next/link → render plain <a> so we can assert href + click navigation.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NoContextBanner } from "@/components/assistant/no-context-banner";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = "11111111-2222-3333-4444-555555555555";

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function makeOkResponse(body: unknown, status = 200): FetchResponseLike {
  return { ok: true, status, json: () => Promise.resolve(body) };
}

function makeNotOkResponse(status: number): FetchResponseLike {
  return { ok: false, status, json: () => Promise.resolve({ error: "boom" }) };
}

/**
 * Stubs the global `fetch` and returns the spy. Stub before render() so the
 * component's mount effect picks up the stub on first call.
 */
function stubFetch(
  factory: (url: string) => FetchResponseLike | Promise<FetchResponseLike>,
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (url: string) => factory(url));
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    spy as unknown as typeof fetch;
  return spy;
}

/**
 * Stubs fetch with a promise we resolve manually — used to assert the
 * "loading" intermediate state (AC-7).
 */
function stubFetchPending(): {
  spy: ReturnType<typeof vi.fn>;
  resolve: (v: FetchResponseLike) => void;
  reject: (err: unknown) => void;
} {
  let resolve!: (v: FetchResponseLike) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<FetchResponseLike>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const spy = vi.fn(async () => promise);
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    spy as unknown as typeof fetch;
  return { spy, resolve, reject };
}

beforeEach(() => {
  mockDispatch.mockReset();
  mockBannerDismissed = false;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

// ---------------------------------------------------------------------------
// AC-1: Banner sichtbar bei context_instructions = null
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-1 Banner visible when context is empty", () => {
  /**
   * AC-1: GIVEN authentifizierter User öffnet Assistant-Panel für Projekt
   *   mit `context_instructions = null`
   * WHEN Panel-Body rendert
   * THEN Banner ist sichtbar oberhalb des Chat-Threads, enthält Hinweis-Text,
   *   einen "Hinzufügen"/"Add"-Link und einen Dismiss-Button (✕).
   */
  it("AC-1: renders banner with hint text, link and dismiss button when context_instructions is null", async () => {
    stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    // Banner-container present (role="status" per a11y constraint)
    const banner = await screen.findByTestId("no_context_banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "status");

    // Link with German label "Hinzufügen" (matches wireframes annotation ②)
    const link = screen.getByTestId("no_context_banner.link");
    expect(link).toBeInTheDocument();
    // English fallback label "Add" is acceptable per spec wording — match either
    expect(link.textContent ?? "").toMatch(/Hinzufügen|Add/i);

    // Dismiss button (✕)
    const dismiss = screen.getByTestId("no_context_banner.dismiss");
    expect(dismiss).toBeInTheDocument();
    expect(dismiss).toHaveAttribute("aria-label", "Banner schließen");
    // Contains an SVG (X icon)
    expect(dismiss.querySelector("svg")).toBeInTheDocument();
  });

  /**
   * AC-1 supplemental: whitespace-only context_instructions also count as empty.
   * Constraint: "Empty-Check: (contextInstructions ?? "").trim() === """.
   */
  it("AC-1: renders banner when context_instructions is whitespace-only", async () => {
    stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "   \n\t  ",
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    const banner = await screen.findByTestId("no_context_banner");
    expect(banner).toBeInTheDocument();
  });

  /**
   * AC-7 (sub-assertion): Banner uses GET /api/projects/{id}/context exactly
   * once on mount (no polling, no re-fetch).
   */
  it("AC-7: fetches GET /api/projects/{id}/context exactly once on mount", async () => {
    const fetchSpy = stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    await screen.findByTestId("no_context_banner");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(`/api/projects/${PROJECT_ID}/context`);
    // cache: "no-store" so user-edits in Slice 06 are reflected on next remount
    expect(calledInit).toMatchObject({ cache: "no-store" });
  });
});

// ---------------------------------------------------------------------------
// AC-2: Banner hidden when context_instructions is non-empty
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-2 Banner hidden when context is set", () => {
  /**
   * AC-2: GIVEN authentifizierter User öffnet Assistant-Panel für Projekt mit
   *   `context_instructions = "draw cyberpunk"`
   * WHEN Panel-Body rendert
   * THEN Banner wird NICHT gerendert (DOM-Node fehlt komplett).
   */
  it("AC-2: does not render banner when context_instructions is non-empty post-trim", async () => {
    const fetchSpy = stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "draw cyberpunk",
        context_updated_at: "2026-04-17T14:22:00.000Z",
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    // Wait until fetch resolves so we know "ready" state has been reached.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Give effect / setState a tick to settle
    await act(async () => {
      await Promise.resolve();
    });

    // Banner DOM-node is absent (not just hidden)
    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });

  /**
   * AC-2 supplemental: a value with leading/trailing whitespace but real content
   * still counts as "set" → banner hidden.
   */
  it("AC-2: does not render banner when context_instructions has surrounding whitespace but real content", async () => {
    stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: "   draw cyberpunk   ",
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Dismiss-Click dispatches DISMISS_NO_CONTEXT_BANNER and unmounts banner
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-3 Dismiss interaction", () => {
  /**
   * AC-3: GIVEN Banner ist sichtbar (Projekt ohne Context, Flag false)
   * WHEN User klickt den Dismiss-Button (✕)
   * THEN Reducer dispatcht `DISMISS_NO_CONTEXT_BANNER`; Banner verschwindet.
   *
   * Interaction Test: simulate the actual click on the dismiss button — not
   * just DOM-existence — to verify the handler is wired.
   */
  it("AC-3: dispatches DISMISS_NO_CONTEXT_BANNER and unmounts banner on dismiss click", async () => {
    const user = userEvent.setup();

    stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    // Wrapper that re-reads `mockBannerDismissed` on each render so we can
    // simulate the reducer's effect (set to true after dispatch) without
    // wiring a real reducer in the test.
    function Wrapper() {
      // Force re-render after dispatch by subscribing to mockDispatch invocations.
      return <NoContextBanner projectId={PROJECT_ID} />;
    }

    const { rerender } = render(<Wrapper />);

    const dismiss = await screen.findByTestId("no_context_banner.dismiss");
    expect(dismiss).toBeInTheDocument();

    // Click the X button (real interaction, not just DOM existence)
    await user.click(dismiss);

    // Reducer received the action
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "DISMISS_NO_CONTEXT_BANNER",
    });

    // Simulate reducer applying the action: noContextBannerDismissed = true
    mockBannerDismissed = true;
    rerender(<Wrapper />);

    // Banner is unmounted from the DOM
    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4 / AC-5 (component-level): Banner respects the dismissed-flag
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-4/AC-5 Tab-session dismiss flag", () => {
  /**
   * AC-4: GIVEN User hat Banner per Dismiss versteckt (`noContextBannerDismissed = true`)
   * WHEN Provider-state has flag=true (e.g. after project-switch via RESET_SESSION
   *   which preserves the flag — see assistant-context.test.tsx for reducer-level
   *   coverage)
   * THEN Banner bleibt versteckt — auch bei Projekt mit context_instructions = null.
   *
   * Component-level: when the provider exposes flag=true, the banner does not
   * render even if the API returns empty context.
   */
  it("AC-4: does not render banner when noContextBannerDismissed flag is already true (project switch)", async () => {
    mockBannerDismissed = true; // Flag persists across project-switch

    stubFetch(() =>
      makeOkResponse({
        id: "another-project-uuid",
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId="another-project-uuid" />);

    // Give the effect time to run (banner should still be absent).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });

  /**
   * AC-5: GIVEN User hat Banner per Dismiss versteckt
   * WHEN User lädt den Tab neu (Hard-Reload, Provider re-mount)
   * THEN Reducer wird mit `noContextBannerDismissed = false` initialisiert;
   *   Banner erscheint wieder bei Projekten ohne Context.
   *
   * Component-level: when the provider re-mounts with flag=false (default after
   * tab-reload), the banner appears again.
   */
  it("AC-5: renders banner again after tab-reload (flag re-initialised to false)", async () => {
    mockBannerDismissed = false; // Default after provider re-mount

    stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    const banner = await screen.findByTestId("no_context_banner");
    expect(banner).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Link click navigates to project-context-settings route
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-6 Link navigation", () => {
  /**
   * AC-6: GIVEN Banner ist sichtbar
   * WHEN User klickt den "Add"-Link (`no_context_banner.link`)
   * THEN Navigation erfolgt zur Project-Context-Settings-Route von Slice 06
   *   (z.B. `/projects/{id}/settings/context`); KEIN automatischer Dismiss.
   *
   * Interaction Test: the click navigates AND the banner is NOT auto-dismissed
   * (no DISMISS_NO_CONTEXT_BANNER dispatch fires from clicking the link).
   */
  it("AC-6: link navigates to project context settings route when clicked", async () => {
    const user = userEvent.setup();

    stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    render(<NoContextBanner projectId={PROJECT_ID} />);

    const link = await screen.findByTestId("no_context_banner.link");

    // Verify href points to slice-06 settings route (path-pattern from spec).
    const href = link.getAttribute("href");
    expect(href).toBe(`/projects/${PROJECT_ID}/settings/context`);

    // Tag check — must be a real anchor (Link / next/link), not a div.
    expect(link.tagName.toLowerCase()).toBe("a");

    // Simulate click — JSDOM has no real navigator, so we assert click was
    // *received* (default not preventDefault'd) AND no dismiss dispatched.
    let defaultPrevented = false;
    link.addEventListener("click", (e) => {
      defaultPrevented = e.defaultPrevented;
      // Stop jsdom from trying to navigate.
      e.preventDefault();
    });

    await user.click(link);

    // No dismiss-action fires from clicking the link (constraint: no auto-dismiss).
    expect(mockDispatch).not.toHaveBeenCalled();
    // The component itself does not preventDefault (so navigation is genuine).
    expect(defaultPrevented).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-7: Loading state shows NO banner
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-7 Loading state hides banner", () => {
  /**
   * AC-7: GIVEN AssistantPanelContent mountet
   * WHEN Banner-Visibility geprüft wird während Fetch noch pending
   * THEN Banner wird NICHT angezeigt (nur sichtbar nach Resolved-State mit
   *   `context_instructions` leer).
   */
  it("AC-7: does not render banner during initial context-fetch loading state", async () => {
    const { resolve } = stubFetchPending();

    render(<NoContextBanner projectId={PROJECT_ID} />);

    // While fetch is pending, banner is absent.
    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();

    // Resolve fetch with empty context → banner appears.
    await act(async () => {
      resolve(
        makeOkResponse({
          id: PROJECT_ID,
          context_instructions: null,
          context_updated_at: null,
        }),
      );
      // Flush microtasks
      await Promise.resolve();
      await Promise.resolve();
    });

    await screen.findByTestId("no_context_banner");
  });
});

// ---------------------------------------------------------------------------
// AC-8: Fail-closed on fetch error (401 / 404 / network)
// ---------------------------------------------------------------------------

describe("NoContextBanner — AC-8 Fail-closed on fetch error", () => {
  /**
   * AC-8: GIVEN GET /api/projects/{id}/context liefert 401
   * WHEN Banner-Visibility geprüft wird
   * THEN Banner wird NICHT angezeigt (fail-closed); kein Toast.
   */
  it("AC-8: does not render banner when context fetch returns 401", async () => {
    stubFetch(() => makeNotOkResponse(401));

    render(<NoContextBanner projectId={PROJECT_ID} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });

  it("AC-8: does not render banner when context fetch returns 404", async () => {
    stubFetch(() => makeNotOkResponse(404));

    render(<NoContextBanner projectId={PROJECT_ID} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });

  it("AC-8: does not render banner on network error (rejected fetch)", async () => {
    const failingSpy = vi.fn(async () => {
      throw new Error("Network down");
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      failingSpy as unknown as typeof fetch;

    render(<NoContextBanner projectId={PROJECT_ID} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("no_context_banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-7 (companion): `hidden` prop keeps DOM mounted but visually hidden
// ---------------------------------------------------------------------------

describe("NoContextBanner — `hidden` prop (panel-internal view-toggle)", () => {
  /**
   * AC-7 companion: Banner should NOT be unmounted on panel-internal toggles
   * (chat ↔ session-list); the `hidden` prop hides it visually so the one-shot
   * fetch is not re-triggered on toggle. Verified by:
   *   - hidden=true → DOM-node still present, but `hidden` attribute set
   *   - fetch is still called only once per projectId (no re-fetch on toggle)
   */
  it("AC-7: `hidden=true` keeps DOM node mounted but hides it (no fetch re-trigger)", async () => {
    const fetchSpy = stubFetch(() =>
      makeOkResponse({
        id: PROJECT_ID,
        context_instructions: null,
        context_updated_at: null,
      }),
    );

    const { rerender } = render(
      <NoContextBanner projectId={PROJECT_ID} hidden={false} />,
    );

    const banner = await screen.findByTestId("no_context_banner");
    expect(banner).toBeInTheDocument();
    expect(banner).not.toHaveAttribute("hidden");

    // Toggle to hidden=true (simulates session-list view)
    rerender(<NoContextBanner projectId={PROJECT_ID} hidden={true} />);

    const bannerHidden = screen.getByTestId("no_context_banner");
    // DOM node still mounted (so fetch is not re-triggered)
    expect(bannerHidden).toBeInTheDocument();
    expect(bannerHidden).toHaveAttribute("hidden");
    expect(bannerHidden).toHaveAttribute("aria-hidden", "true");

    // Toggle back to visible
    rerender(<NoContextBanner projectId={PROJECT_ID} hidden={false} />);

    // Fetch should have been called exactly once (no re-fetch on toggle).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
