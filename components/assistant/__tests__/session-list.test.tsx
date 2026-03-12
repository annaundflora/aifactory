// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { SessionList } from "../session-list";
import type { SessionSummary } from "@/lib/assistant/use-sessions";

// ---------------------------------------------------------------------------
// Mock useSessions hook (mock_external strategy per spec)
// ---------------------------------------------------------------------------

const mockUseSessions = vi.fn<
  () => { sessions: SessionSummary[]; isLoading: boolean; error: Error | null }
>();

vi.mock("@/lib/assistant/use-sessions", () => ({
  useSessions: (...args: unknown[]) => mockUseSessions(...(args as [])),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SESSION_A: SessionSummary = {
  id: "session-a",
  title: "Session A",
  status: "active",
  message_count: 5,
  has_draft: false,
  last_message_at: "2026-03-11T10:00:00Z",
  created_at: "2026-03-11T09:00:00Z",
};

const SESSION_B: SessionSummary = {
  id: "session-b",
  title: "Portraet im Herbstwald",
  status: "active",
  message_count: 8,
  has_draft: true,
  last_message_at: "2026-03-11T14:00:00Z",
  created_at: "2026-03-11T12:00:00Z",
};

const SESSION_C: SessionSummary = {
  id: "session-c",
  title: "Session C",
  status: "active",
  message_count: 2,
  has_draft: false,
  last_message_at: "2026-03-10T08:00:00Z",
  created_at: "2026-03-10T07:00:00Z",
};

const SESSION_NULL_TITLE: SessionSummary = {
  id: "session-null",
  title: null,
  status: "active",
  message_count: 1,
  has_draft: false,
  last_message_at: "2026-03-11T09:00:00Z",
  created_at: "2026-03-11T08:00:00Z",
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

function defaultProps() {
  return {
    projectId: "project-uuid-123",
    onSelectSession: vi.fn(),
    onBack: vi.fn(),
    onNewSession: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // AC-1: GIVEN der Assistant-Drawer ist geoeffnet und der User befindet sich
  //        auf dem Startscreen
  //       WHEN der User auf "Vergangene Sessions anzeigen" klickt
  //       THEN wird die Chat-Ansicht durch die Session-Liste ersetzt; der Header
  //            zeigt "Vergangene Sessions" mit einem Zurueck-Pfeil-Button links
  // --------------------------------------------------------------------------
  it('AC-1: should replace chat view with session list when "Vergangene Sessions" is clicked', () => {
    mockUseSessions.mockReturnValue({
      sessions: [SESSION_B, SESSION_A, SESSION_C],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    // The session list component should be rendered
    const sessionList = screen.getByTestId("session-list");
    expect(sessionList).toBeInTheDocument();

    // Header shows "Vergangene Sessions"
    expect(screen.getByText("Vergangene Sessions")).toBeInTheDocument();

    // Back button (arrow left) is present in the header
    const backButton = screen.getByTestId("session-list-back");
    expect(backButton).toBeInTheDocument();
    expect(backButton).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN das Backend liefert 3 Sessions fuer die project_id
  //        (Session A: last_message_at "2026-03-11T10:00:00Z",
  //         Session B: last_message_at "2026-03-11T14:00:00Z",
  //         Session C: last_message_at "2026-03-10T08:00:00Z")
  //       WHEN die Session-Liste rendert
  //       THEN werden alle 3 Sessions angezeigt, sortiert nach last_message_at
  //            DESC (B, A, C)
  // --------------------------------------------------------------------------
  it("AC-3: should render sessions sorted by last_message_at descending", () => {
    // useSessions returns already-sorted sessions (B, A, C)
    mockUseSessions.mockReturnValue({
      sessions: [SESSION_B, SESSION_A, SESSION_C],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const entries = screen.getAllByTestId("session-entry");
    expect(entries).toHaveLength(3);

    // Verify order: B first, then A, then C
    const titles = entries.map(
      (entry) => within(entry).getByTestId("session-title").textContent
    );
    expect(titles).toEqual([
      "Portraet im Herbstwald",
      "Session A",
      "Session C",
    ]);
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN eine Session mit title: "Portraet im Herbstwald",
  //        message_count: 8, last_message_at: "2026-03-11T14:00:00Z",
  //        has_draft: true
  //       WHEN der Eintrag in der Session-Liste rendert
  //       THEN zeigt er den Titel, das formatierte Datum ("11. Maer 2026"),
  //            die Nachrichten-Anzahl ("8 Nachrichten") und einen visuellen
  //            Indikator fuer einen existierenden Draft
  // --------------------------------------------------------------------------
  it("AC-4: should display title, formatted date, message count, and draft indicator per entry", () => {
    mockUseSessions.mockReturnValue({
      sessions: [SESSION_B],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const entry = screen.getByTestId("session-entry");

    // Title
    const title = within(entry).getByTestId("session-title");
    expect(title).toHaveTextContent("Portraet im Herbstwald");

    // Formatted date and message count in meta line
    const meta = within(entry).getByTestId("session-meta");
    expect(meta.textContent).toMatch(/11/);
    expect(meta.textContent).toMatch(/2026/);
    expect(meta.textContent).toMatch(/8 Nachrichten/);

    // Draft indicator
    const draftIndicator = within(entry).getByTestId("draft-indicator");
    expect(draftIndicator).toBeInTheDocument();
    expect(draftIndicator).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN eine Session mit title: null
  //       WHEN der Eintrag rendert
  //       THEN wird ein Fallback-Titel angezeigt (z.B. "Neue Session")
  // --------------------------------------------------------------------------
  it("AC-5: should show fallback title when session title is null", () => {
    mockUseSessions.mockReturnValue({
      sessions: [SESSION_NULL_TITLE],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const entry = screen.getByTestId("session-entry");
    const title = within(entry).getByTestId("session-title");
    expect(title).toHaveTextContent("Neue Session");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN das Backend liefert ein leeres Array (sessions: [])
  //       WHEN die Session-Liste rendert
  //       THEN wird ein Empty State mit dem Text "Noch keine Sessions vorhanden"
  //            zentriert angezeigt
  // --------------------------------------------------------------------------
  it('AC-6: should show "Noch keine Sessions vorhanden" when sessions array is empty', () => {
    mockUseSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const emptyState = screen.getByTestId("session-empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent("Noch keine Sessions vorhanden");

    // Verify centering via flex + items-center + justify-center
    expect(emptyState.className).toMatch(/items-center/);
    expect(emptyState.className).toMatch(/justify-center/);
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN der useSessions-Hook laedt Daten
  //       WHEN isLoading true ist
  //       THEN zeigt die Session-Liste Skeleton-Loader (mindestens 3 Skeleton-Eintraege)
  // --------------------------------------------------------------------------
  it("AC-7: should render skeleton loaders when isLoading is true", () => {
    mockUseSessions.mockReturnValue({
      sessions: [],
      isLoading: true,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const skeletonContainer = screen.getByTestId("session-skeletons");
    expect(skeletonContainer).toBeInTheDocument();

    const skeletons = within(skeletonContainer).getAllByTestId(
      "session-skeleton"
    );
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN die Session-Liste ist sichtbar
  //       WHEN der User auf den Zurueck-Button (Pfeil links) im Header klickt
  //       THEN navigiert die Ansicht zurueck zum Startscreen/aktiven Chat
  // --------------------------------------------------------------------------
  it("AC-8: should call onBack when back button is clicked", async () => {
    const user = userEvent.setup();

    mockUseSessions.mockReturnValue({
      sessions: [SESSION_A],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const backButton = screen.getByTestId("session-list-back");
    await user.click(backButton);

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN die Session-Liste ist sichtbar
  //       WHEN der User auf den "Neue Session" Button am unteren Rand klickt
  //       THEN wird ein onNewSession-Callback aufgerufen (navigiert zum
  //            Startscreen mit leerem Chat)
  // --------------------------------------------------------------------------
  it('AC-9: should call onNewSession when "Neue Session" button is clicked', async () => {
    const user = userEvent.setup();

    mockUseSessions.mockReturnValue({
      sessions: [SESSION_A],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const newSessionButton = screen.getByTestId("new-session-button");
    expect(newSessionButton).toBeInTheDocument();
    expect(newSessionButton).toHaveTextContent("Neue Session");

    await user.click(newSessionButton);

    expect(props.onNewSession).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // AC-10: GIVEN die Session-Liste zeigt Sessions an
  //        WHEN der User auf einen Session-Eintrag klickt
  //        THEN wird ein onSelectSession(sessionId: string)-Callback mit der
  //             Session-ID aufgerufen
  // --------------------------------------------------------------------------
  it("AC-10: should call onSelectSession with session id when entry is clicked", async () => {
    const user = userEvent.setup();

    mockUseSessions.mockReturnValue({
      sessions: [SESSION_B, SESSION_A],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const entries = screen.getAllByTestId("session-entry");

    // Click the first entry (Session B)
    await user.click(entries[0]);
    expect(props.onSelectSession).toHaveBeenCalledWith("session-b");

    // Click the second entry (Session A)
    await user.click(entries[1]);
    expect(props.onSelectSession).toHaveBeenCalledWith("session-a");

    expect(props.onSelectSession).toHaveBeenCalledTimes(2);
  });

  // --------------------------------------------------------------------------
  // AC-11: GIVEN der useSessions-Hook und ein fetch-Fehler (z.B. Netzwerkfehler)
  //        WHEN error nicht null ist
  //        THEN zeigt die Session-Liste eine Fehlermeldung und der sessions-Array
  //             ist leer
  // --------------------------------------------------------------------------
  it("AC-11: should display error message when error state is set", () => {
    mockUseSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: new Error("Netzwerkfehler"),
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const errorState = screen.getByTestId("session-error");
    expect(errorState).toBeInTheDocument();
    expect(errorState).toHaveTextContent("Netzwerkfehler");

    // No session entries should be rendered
    expect(screen.queryAllByTestId("session-entry")).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // AC-4 (supplemental): Session without draft should NOT show draft indicator
  // --------------------------------------------------------------------------
  it("AC-4 (supplemental): should not show draft indicator when has_draft is false", () => {
    mockUseSessions.mockReturnValue({
      sessions: [SESSION_A],
      isLoading: false,
      error: null,
    });

    const props = defaultProps();
    render(<SessionList {...props} />);

    const entry = screen.getByTestId("session-entry");
    expect(within(entry).queryByTestId("draft-indicator")).not.toBeInTheDocument();
  });
});
