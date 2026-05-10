# Slice 10: No-Context-Hint-Banner

> **Slice 10 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-no-context-banner` |
| **Test** | `pnpm test components/assistant/__tests__/no-context-banner.test.tsx lib/assistant/__tests__/assistant-context.test.tsx` |
| **E2E** | `true` |
| **Dependencies** | `["slice-03-context-routes"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 (App Router) + React + Vitest (Unit/Reducer + RTL für Component) + Playwright (E2E). Repo nutzt **keine Zod**; Banner-Visibility wird via Provider-Prop + Reducer-Flag gesteuert (siehe architecture.md → Section "Frontend State Machine Wiring", Zeile 465).

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + vitest + playwright` |
| **Test Command** | `pnpm test components/assistant/__tests__/no-context-banner.test.tsx lib/assistant/__tests__/assistant-context.test.tsx` |
| **Integration Command** | `pnpm test components/assistant/__tests__/assistant-panel.test.tsx` |
| **Acceptance Command** | `pnpm playwright test e2e/assistant/no-context-banner.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `GET /api/projects/{seed-uuid}/context` (200 mit `context_instructions: null` für Banner-Sichtbarkeit) |
| **Mocking Strategy** | `mock_external` (Vitest mockt `fetch` und `usePromptAssistant`-Provider; Playwright nutzt geseedeten Test-User mit Projekt ohne Context) |

---

## Ziel

Dezentes Banner im Assistant-Panel über dem Chat-Thread, das nur erscheint wenn das aktive Projekt **kein** `context_instructions` hat. Banner enthält Dismiss-Button (Tab-Session-scope, persistiert nicht über Reload) und Link zur Project-Context-Settings (Slice 06). Gibt Nutzern einen niedrigschwelligen Einstieg zum Setzen des Project-Contexts ohne aufdringlich zu sein.

---

## Acceptance Criteria

1) **GIVEN** authentifizierter User öffnet Assistant-Panel für Projekt mit `context_instructions = null` (oder leerer/nur-whitespace String)
   **WHEN** Panel-Body rendert
   **THEN** Banner ist sichtbar oberhalb des Chat-Threads, enthält den Hinweis-Text aus wireframes.md → Section "Assistant Panel (extended)" Annotation ② sowie einen Link mit Label "Add" / "Hinzufügen" und einen Dismiss-Button (✕).

2) **GIVEN** authentifizierter User öffnet Assistant-Panel für Projekt mit `context_instructions = "draw cyberpunk"` (non-empty post-trim)
   **WHEN** Panel-Body rendert
   **THEN** Banner wird **NICHT** gerendert (DOM-Node fehlt komplett); Chat-Thread/Startscreen bleiben unverändert.

3) **GIVEN** Banner ist sichtbar (Projekt ohne Context, Flag `noContextBannerDismissed = false`)
   **WHEN** User klickt den Dismiss-Button (✕)
   **THEN** Reducer dispatcht `DISMISS_NO_CONTEXT_BANNER`; State-Feld `noContextBannerDismissed` wird auf `true` gesetzt; Banner verschwindet sofort aus dem DOM.

4) **GIVEN** User hat Banner per Dismiss versteckt (`noContextBannerDismissed = true`)
   **WHEN** User wechselt das aktive Projekt (oder die Session) im Panel, **ohne** den Tab neu zu laden
   **THEN** Banner bleibt versteckt (Tab-Session-scope, siehe architecture.md → Section "Frontend State Machine Wiring", Zeile 465: "resets only on tab reload, NOT on project switch"); auch dann wenn das neue Projekt ebenfalls `context_instructions = null` hat.

5) **GIVEN** User hat Banner per Dismiss versteckt
   **WHEN** User lädt den Tab neu (Hard-Reload, Provider re-mount)
   **THEN** Reducer wird mit `noContextBannerDismissed = false` initialisiert (kein localStorage/Cookie); Banner erscheint wieder bei Projekten ohne Context.

6) **GIVEN** Banner ist sichtbar
   **WHEN** User klickt den "Add"-Link (`no_context_banner.link`)
   **THEN** Navigation erfolgt zur Project-Context-Settings-Route von Slice 06 (Ziel-URL: gemäß Slice 06 Mount-Point, z.B. `/projects/{id}/settings/context` oder Settings-Modal-Trigger); KEIN automatischer Dismiss des Banners (User entscheidet bewusst über ✕).

7) **GIVEN** `AssistantPanelContent` mountet bei geöffnetem Panel
   **WHEN** Banner-Visibility geprüft wird
   **THEN** der Project-Context-Wert wird **einmal pro Session** geladen (siehe architecture.md Zeile 465: "loaded once per session into context provider") via `GET /api/projects/{id}/context` (Slice 03); KEINE Re-Fetch bei jedem Render; Loading-State zeigt KEIN Banner (nur sichtbar nach Resolved-State mit `context_instructions` leer).

8) **GIVEN** `GET /api/projects/{id}/context` liefert 401/404/Network-Error
   **WHEN** Banner-Visibility geprüft wird
   **THEN** Banner wird **NICHT** angezeigt (Fail-closed: kein nerviges Banner bei Fehler); kein Toast, nur stilles Verstecken.

---

## Test Skeletons

> **Hinweis für Test-Writer:** Component-Tests via React Testing Library (Pattern aus existierenden `components/assistant/__tests__/` falls vorhanden, sonst RTL Standard). Reducer-Test als Pure-Reducer-Aufruf. Playwright-Test seed't Test-User mit Projekt ohne Context vor dem Test.

### Test-Datei: `components/assistant/__tests__/no-context-banner.test.tsx`

<test_spec>
```typescript
// AC-1: Banner sichtbar bei context_instructions = null
it.todo('renders banner with hint text, link and dismiss button when context_instructions is null')

// AC-1: Banner sichtbar bei whitespace-only context_instructions
it.todo('renders banner when context_instructions is whitespace-only')

// AC-2: Banner versteckt bei non-empty context_instructions
it.todo('does not render banner when context_instructions is non-empty post-trim')

// AC-3: Dismiss-Click dispatcht Action und versteckt Banner
it.todo('dispatches DISMISS_NO_CONTEXT_BANNER and unmounts banner on dismiss click')

// AC-6: Link triggert Navigation zur Settings-Route von Slice 06
it.todo('link navigates to project context settings route when clicked')

// AC-8: Bei Fetch-Error/401/404 → Banner versteckt
it.todo('does not render banner when context fetch fails (fail-closed)')

// AC-7: Loading-State zeigt KEIN Banner
it.todo('does not render banner during initial context-fetch loading state')
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.tsx`

<test_spec>
```typescript
// AC-3: Reducer-Action setzt Flag
it.todo('reducer DISMISS_NO_CONTEXT_BANNER action sets noContextBannerDismissed = true')

// AC-5: Initial-State hat Flag = false (kein Persist)
it.todo('initialState has noContextBannerDismissed = false')

// AC-4: RESET_SESSION (Project-Switch) lässt noContextBannerDismissed UNVERÄNDERT
it.todo('RESET_SESSION action does NOT reset noContextBannerDismissed flag (tab-session scope)')
```
</test_spec>

### Test-Datei: `e2e/assistant/no-context-banner.spec.ts`

<test_spec>
```typescript
// AC-1 + AC-2 (E2E): Banner-Visibility per context_instructions
test.skip('AC-1/2: Project ohne Context zeigt Banner; Project mit Context versteckt Banner', async () => {})

// AC-3 (E2E): Klick auf Dismiss versteckt Banner für Session
test.skip('AC-3: Klick auf Dismiss-Button entfernt Banner aus DOM', async () => {})

// AC-4 (E2E): Project-Switch behält Dismiss-State
test.skip('AC-4: Banner bleibt versteckt nach Project-Switch (kein Reload)', async () => {})

// AC-5 (E2E): Tab-Reload setzt Dismiss-State zurück
test.skip('AC-5: Banner erscheint nach Tab-Reload erneut', async () => {})

// AC-6 (E2E): Klick auf Link navigiert zu Settings
test.skip('AC-6: Klick auf "Add"-Link navigiert zur Project-Context-Settings-Route von Slice 06', async () => {})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-context-routes` | `GET /api/projects/{id}/context` | HTTP endpoint | 200 → `{ id, context_instructions: string \| null, context_updated_at: ISO \| null }`; 401/404 → fail-closed |
| `slice-06-context-settings-page` (consumed but not blocking — Slice 06 ist parallel zur Implementierung) | Settings-Route oder Modal-Trigger | Next.js Route or Modal-Open-Handler | Banner-Link navigiert dorthin; Pfad-Konvention aus Slice 06 |

> **Hinweis Dependencies:** Architectural-Dependency ist `slice-03-context-routes` (für GET); Link-Ziel ist Slice 06 (parallel implementiert), aber Banner ist auch ohne Slice 06 robust (Link-Ziel kann anfangs ein Platzhalter-Pfad sein, der später durch Slice 06 verdrahtet wird).

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `<NoContextBanner>` | React Component | `slice-22-multimodal-indicator-ui` (folgt im selben Panel-Slot, kein direkter Consumer) | `<NoContextBanner projectId={string} />` |
| `noContextBannerDismissed: boolean` field | AssistantState | future slices (Resume-Hydrate, etc.) | Reducer-State, exported via `usePromptAssistant()` |
| `DISMISS_NO_CONTEXT_BANNER` action | AssistantAction | future slices | `dispatch({ type: "DISMISS_NO_CONTEXT_BANNER" })` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/no-context-banner.tsx` — NEW: Presentational React Component, fetcht `GET /api/projects/{id}/context` einmalig, rendert Banner conditional auf `context_instructions` empty AND `noContextBannerDismissed === false`
- [ ] `components/assistant/assistant-panel.tsx` — EDIT: Mount `<NoContextBanner projectId={projectId} />` oberhalb des Chat-Thread / Startscreen (siehe wireframes.md → Section "Assistant Panel (extended)" Annotation ②)
- [ ] `lib/assistant/assistant-context.tsx` — EDIT: `AssistantState` um `noContextBannerDismissed: boolean` (Default `false`) erweitern; `AssistantAction`-Union um `{ type: "DISMISS_NO_CONTEXT_BANNER" }` erweitern; Reducer-Branch implementieren; `RESET_SESSION` lässt das Flag unverändert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE neue Settings-Route — Link-Ziel kommt aus Slice 06; falls Slice 06 noch nicht fertig: Pfad als Konstante platzieren (z.B. `/projects/${projectId}/settings/context`), die später angepasst werden kann
- KEIN localStorage/Cookie/Server-Persist für `noContextBannerDismissed` — Tab-Session-scope ist explizit (architecture.md Zeile 465)
- KEIN automatischer Dismiss bei Link-Klick — Banner bleibt sichtbar bis User aktiv ✕ klickt oder Project-Context tatsächlich gesetzt wird (durch Settings-Save in Slice 06)
- KEINE Polling-Logik — Context wird nur einmal beim Panel-Mount geladen; Re-Fetch erst bei Tab-Reload
- KEINE eigene Toast-Anzeige bei Fetch-Error (silent fail-closed; vermeidet Banner-Spam bei Auth-Issues)
- KEINE Animation/Transition (Slice macht funktionalen Banner; Polish kommt später)

**Technische Constraints:**
- `NoContextBanner` ist ein **Client Component** (`"use client"`) — nutzt `useEffect` für Fetch + `useRouter` für Navigation
- Fetch-Pattern: `useEffect` + `fetch("/api/projects/{id}/context")` + lokaler `useState` für `{ status: "loading" | "ready" | "error", contextInstructions: string | null }` — NICHT in den globalen Reducer schreiben (Banner-Visibility ist Component-lokal abgesehen vom Dismiss-Flag)
- Empty-Check: `(contextInstructions ?? "").trim() === ""` (matcht null + whitespace-only)
- Reducer-Erweiterung: `noContextBannerDismissed` MUSS im `initialState` mit `false` initialisiert werden; `RESET_SESSION` darf das Flag NICHT zurücksetzen (anders als andere Session-bezogene Felder; siehe architecture.md Zeile 465 "Tab-Session-Lifecycle")
- Action-Naming-Konvention: PascalCase im Type-Discriminator (`"DISMISS_NO_CONTEXT_BANNER"`) — passt zum existierenden Pattern in `assistant-context.tsx:104-127`
- Banner-Mount-Position in `assistant-panel.tsx`: zwischen Header (Zeile 174-190) und Body-Container (Zeile 193-195); Banner DARF NICHT innerhalb des `overflow-y-auto`-Containers sein, weil Banner sticky/fixed an der Spitze des Body bleiben soll (vgl. wireframes.md Annotation ② "above the chat thread")
- Link-Component: `next/link` (nicht `<a>`) für Client-Side-Navigation; `useRouter().push()` falls programmatisch nötig
- Dismiss-Button: Wiederverwendung der existierenden `<Button variant="ghost" size="icon-xs">` mit `<X className="size-4" />` (Pattern aus `assistant-panel.tsx:179-188`)
- Accessibility: Dismiss-Button braucht `aria-label="Banner schließen"`; Banner-Container braucht `role="status"` für Screenreader

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/assistant/assistant-context.tsx` (`usePromptAssistant`, `AssistantState`, `AssistantAction`) | EDIT — Flag + Action ergänzen; bestehender Provider/Hook unverändert nutzen |
| `components/ui/button.tsx` (`Button`) | Import, unverändert — für Dismiss-✕-Button (Pattern aus `assistant-panel.tsx:179-188`) |
| `lucide-react` (`X` icon) | Import, unverändert — Dismiss-Icon (selbes Asset wie Panel-Close in `assistant-panel.tsx:4`) |
| `next/link` | Import, unverändert — für `no_context_banner.link` Navigation |
| `components/assistant/assistant-panel.tsx` | EDIT — nur Mount-Punkt für `<NoContextBanner>` ergänzen; bestehende Struktur (Header / renderContent) unverändert |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Frontend State Machine Wiring" → Zeile 465 (Banner-Subscription, Tab-Session-Scope)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeilen 537-538 (`no-context-banner.tsx` NEW + `assistant-panel.tsx` EDIT, Slice-M-Attribution)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeile 529 (Reducer-Action `DISMISS_NO_CONTEXT_BANNER` Listing)
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section "Assistant Panel (extended)" → Annotationen ② und ③ + State-Variations-Tabelle (`context_set`, `banner_dismissed_session`)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice M "No-Context-Hint-Banner"
- Slice 03 Spec: `slice-03-context-routes.md` → Section "Provides To Other Slices" (`GET /api/projects/{id}/context` mit `ProjectContextResponse`-Shape)
- Slice 06 Spec (parallel): Mount-Point der Settings-Route — Link-Ziel des Banners; falls noch nicht definiert: Platzhalter-Konstante in `no-context-banner.tsx`
