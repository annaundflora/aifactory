# Slice 13b: Session-Liste UI

> **Slice 13b von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13b-session-list-ui` |
| **Test** | `pnpm vitest run components/assistant/__tests__/session-list.test.tsx lib/assistant/__tests__/use-sessions.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-13a-session-repository-backend"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19.2.3 + Tailwind 4) |
| **Test Command** | `pnpm vitest run components/assistant/__tests__/session-list.test.tsx lib/assistant/__tests__/use-sessions.test.ts` |
| **Integration Command** | n/a (UI-only, Backend wird gemockt) |
| **Acceptance Command** | `pnpm dev` + manuell: Klick auf "Vergangene Sessions" zeigt Session-Liste |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (fetch-Calls an `/api/assistant/sessions` werden in Tests gemockt) |

---

## Ziel

React-Component `SessionList` und zugehoeriger `useSessions`-Hook bereitstellen, damit User vergangene Sessions im Assistant-Drawer sehen, eine Session zum Laden auswaehlen oder eine neue Session starten koennen. Der Hook ruft `GET /api/assistant/sessions?project_id=<uuid>` auf und liefert die Session-Daten.

---

## Acceptance Criteria

1) GIVEN der Assistant-Drawer ist geoeffnet und der User befindet sich auf dem Startscreen
   WHEN der User auf "Vergangene Sessions anzeigen" klickt
   THEN wird die Chat-Ansicht durch die Session-Liste ersetzt; der Header zeigt "Vergangene Sessions" mit einem Zurueck-Pfeil-Button links

2) GIVEN der `useSessions`-Hook wird mit einer `projectId` (UUID) aufgerufen
   WHEN der Hook mountet
   THEN wird `GET /api/assistant/sessions?project_id=<projectId>` aufgerufen und der Hook liefert `{ sessions, isLoading, error }`

3) GIVEN das Backend liefert 3 Sessions fuer die project_id (Session A: last_message_at "2026-03-11T10:00:00Z", Session B: last_message_at "2026-03-11T14:00:00Z", Session C: last_message_at "2026-03-10T08:00:00Z")
   WHEN die Session-Liste rendert
   THEN werden alle 3 Sessions angezeigt, sortiert nach `last_message_at` DESC (B, A, C)

4) GIVEN eine Session mit `title: "Portraet im Herbstwald"`, `message_count: 8`, `last_message_at: "2026-03-11T14:00:00Z"`, `has_draft: true`
   WHEN der Eintrag in der Session-Liste rendert
   THEN zeigt er den Titel, das formatierte Datum ("11. Maer 2026"), die Nachrichten-Anzahl ("8 Nachrichten") und einen visuellen Indikator fuer einen existierenden Draft

5) GIVEN eine Session mit `title: null`
   WHEN der Eintrag rendert
   THEN wird ein Fallback-Titel angezeigt (z.B. "Neue Session")

6) GIVEN das Backend liefert ein leeres Array (`sessions: []`)
   WHEN die Session-Liste rendert
   THEN wird ein Empty State mit dem Text "Noch keine Sessions vorhanden" zentriert angezeigt

7) GIVEN der `useSessions`-Hook laedt Daten
   WHEN `isLoading` true ist
   THEN zeigt die Session-Liste Skeleton-Loader (mindestens 3 Skeleton-Eintraege)

8) GIVEN die Session-Liste ist sichtbar
   WHEN der User auf den Zurueck-Button (Pfeil links) im Header klickt
   THEN navigiert die Ansicht zurueck zum Startscreen/aktiven Chat

9) GIVEN die Session-Liste ist sichtbar
   WHEN der User auf den "Neue Session" Button am unteren Rand klickt
   THEN wird ein `onNewSession`-Callback aufgerufen (navigiert zum Startscreen mit leerem Chat)

10) GIVEN die Session-Liste zeigt Sessions an
    WHEN der User auf einen Session-Eintrag klickt
    THEN wird ein `onSelectSession(sessionId: string)`-Callback mit der Session-ID aufgerufen

11) GIVEN der `useSessions`-Hook und ein fetch-Fehler (z.B. Netzwerkfehler)
    WHEN `error` nicht null ist
    THEN zeigt die Session-Liste eine Fehlermeldung und der `sessions`-Array ist leer

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/session-list.test.tsx`

<test_spec>
```typescript
// AC-1: Navigation zur Session-Liste
it.todo('should replace chat view with session list when "Vergangene Sessions" is clicked')

// AC-3: Sessions sortiert nach last_message_at DESC
it.todo('should render sessions sorted by last_message_at descending')

// AC-4: Session-Eintrag zeigt Titel, Datum, Nachrichten-Anzahl, Draft-Indikator
it.todo('should display title, formatted date, message count, and draft indicator per entry')

// AC-5: Fallback-Titel fuer Sessions ohne title
it.todo('should show fallback title when session title is null')

// AC-6: Empty State
it.todo('should show "Noch keine Sessions vorhanden" when sessions array is empty')

// AC-7: Skeleton-Loader waehrend Laden
it.todo('should render skeleton loaders when isLoading is true')

// AC-8: Zurueck-Button navigiert zum vorherigen Screen
it.todo('should call onBack when back button is clicked')

// AC-9: Neue Session Button
it.todo('should call onNewSession when "Neue Session" button is clicked')

// AC-10: Klick auf Session-Eintrag
it.todo('should call onSelectSession with session id when entry is clicked')

// AC-11: Fehlermeldung bei fetch-Fehler
it.todo('should display error message when error state is set')
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/use-sessions.test.ts`

<test_spec>
```typescript
// AC-2: Hook ruft GET /api/assistant/sessions auf
it.todo('should fetch sessions from /api/assistant/sessions with project_id query param')

// AC-2: Hook liefert sessions, isLoading, error
it.todo('should return sessions array, isLoading flag, and error state')

// AC-11: Hook setzt error bei fetch-Fehler
it.todo('should set error when fetch fails')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-13a` | `GET /api/assistant/sessions?project_id=<uuid>` | REST Endpoint | Response-Format: `{ sessions: SessionSummary[] }` |
| `slice-13a` | `SessionResponse` DTO-Shape | JSON Schema | Felder: `id, title, status, message_count, has_draft, last_message_at, created_at` |
| `slice-08` | `AssistantSheet` Component | React Component | Rendert Content basierend auf aktuellem View-State |
| `slice-09` | `Startscreen` Component | React Component | "Vergangene Sessions anzeigen" Link vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SessionList` | React Component | slice-13c | `<SessionList projectId={string} onSelectSession={(id: string) => void} onBack={() => void} onNewSession={() => void} />` |
| `useSessions` | React Hook | slice-13c | `useSessions(projectId: string) => { sessions: SessionSummary[], isLoading: boolean, error: Error \| null }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/session-list.tsx` -- SessionList Component mit Eintraegen, Empty State, Skeleton-Loader, Zurueck-Button, Neue-Session-Button
- [ ] `lib/assistant/use-sessions.ts` -- Custom Hook: fetch Sessions via GET-Endpoint, liefert sessions/isLoading/error
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEIN Session-Laden/Fortsetzen (kommt in Slice 13c)
- Dieser Slice implementiert KEINEN Session-Switcher im Header (kommt in Slice 13c)
- Dieser Slice implementiert KEINE Session-Archivierung/Loeschung in der UI
- Klick auf Session-Eintrag ruft nur Callback auf -- die Logik zum Laden der Session-Daten liegt in Slice 13c

**Technische Constraints:**
- Native `fetch` fuer API-Calls (kein zusaetzlicher HTTP-Client)
- Tailwind 4 Utility-Klassen fuer Styling (kein CSS-in-JS)
- Skeleton-Loader via existierendes `components/ui/skeleton.tsx` Pattern
- Datumsformatierung mit `Intl.DateTimeFormat("de-DE")` (kein date-fns/moment)
- Component erhaelt Callbacks als Props (`onSelectSession`, `onBack`, `onNewSession`) -- kein interner Routing-State

**Referenzen:**
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Session List"
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design > Endpoints" (GET /api/assistant/sessions)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Data Transfer Objects" (SessionSummary, SessionListResponse)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (session-list)
