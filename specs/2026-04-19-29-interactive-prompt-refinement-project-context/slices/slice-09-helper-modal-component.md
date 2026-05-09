# Slice 09: Help-Me-Write Modal-Komponente

> **Slice 09 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-helper-modal-component` |
| **Test** | `pnpm test components/projects/__tests__/help-me-write-modal.test.tsx` |
| **E2E** | `true` |
| **Dependencies** | `["slice-08-helper-modal-route", "slice-06-context-settings-page"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 + React + Radix `Dialog`. Repo nutzt **Vitest + React-Testing-Library** (Pattern `components/**/__tests__/*.test.tsx`) und **Playwright** für E2E (`tests/e2e/*.spec.ts`). UI-Tests stubben den `POST /api/projects/context/generate`-Fetch (vgl. Slice 06 Stubbing-Stil) und mockten via `vi.fn()` den Parent-Callback (`onAccept`).

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + react + radix + vitest + playwright` |
| **Test Command** | `pnpm test components/projects/__tests__/help-me-write-modal.test.tsx` |
| **Integration Command** | `pnpm test components/projects/__tests__/help-me-write-modal.test.tsx` (RTL-basiert; gemeinsam mit ProjectContextSettings-Wiring testbar via Spec-Suite) |
| **Acceptance Command** | `pnpm playwright test tests/e2e/help-me-write-modal.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `POST /api/projects/context/generate` mit gültigem Auth-Cookie + Body `{"brief":"<≥10 chars>"}` → `200 { draft }` (geliefert von Slice 08) |
| **Mocking Strategy** | `mock_external` (Vitest stubbt `fetch` für `/api/projects/context/generate`; Playwright nutzt seed-DB + echte Route 08 oder Route-Mock) |

---

## Ziel

Liefert `<HelpMeWriteModal>` als Radix-Dialog mit `helper_brief_input` (10..500 chars) und Buttons Generate / Regenerate / Accept / Cancel. Ruft `POST /api/projects/context/generate` (Slice 08) und übergibt den akzeptierten Draft via Callback an `<ProjectContextSettings>` (Slice 06), das den Wert in das `context_textarea` schreibt. Macht keinen direkten Workspace- oder DB-Zugriff.

---

## Acceptance Criteria

1) **GIVEN** Modal öffnet sich (`open=true`)
   **WHEN** Render-Phase initial
   **THEN** zeigt State `empty` aus wireframes.md → Section "Help-me-write-this Modal" (Zeilen 351-359): `helper_brief_input` ist leer mit Placeholder, Char-Counter zeigt `0 / 500`, Generate-Button ist `disabled`, Draft-Section ist nicht sichtbar, Regenerate/Accept-Buttons sind nicht sichtbar; Cancel-Button ist sichtbar und enabled.

2) **GIVEN** Modal offen mit leerem `helper_brief_input`
   **WHEN** User tippt einen Brief der Länge `n` (post-trim)
   **THEN** Counter zeigt live `{n} / 500`; Generate-Button wird `enabled`, **wenn** `10 ≤ n ≤ 500`; bei `n > 500` wird Counter rot eingefärbt UND Generate-Button `disabled` (siehe wireframes.md → State `over_limit_brief`); bei `n < 10` bleibt Generate `disabled` (kein Fehler-Text — entspricht State `brief_filled` Übergang).

3) **GIVEN** gültiger Brief (post-trim 10..500) und User klickt Generate
   **WHEN** Fetch zu `POST /api/projects/context/generate` läuft
   **THEN** Generate-Button-Label wechselt zu `"Generating…"` und zeigt Spinner; alle Buttons sind `disabled`; `helper_brief_input` ist read-only (siehe wireframes.md → State `pending`); genau ein `fetch`-Call wird abgesetzt mit Body `{ brief: "<getrimmt>" }` (Body-Shape per architecture.md → DTOs Zeile 143).

4) **GIVEN** Generate-Pending, und Route liefert `200 { draft: "Magic Mushroom POD shop. ..." }`
   **WHEN** Response eintrifft
   **THEN** Draft-Section wird sichtbar mit dem zurückgegebenen Draft als read-only Vorschau-Block; State wechselt zu `draft_ready` (wireframes.md): Buttons Cancel / Regenerate / Accept (=`helper_accept_btn`) sind alle sichtbar und enabled; Generate-Button verschwindet (oder bleibt `disabled` und unsichtbar — Implementierungs-Wahl, sichtbar dürfen nur die drei Action-Buttons sein laut Wireframe Zeile 336-338); `helper_brief_input` ist wieder editierbar.

5) **GIVEN** State `draft_ready` und User klickt Regenerate
   **WHEN** Click feuert
   **THEN** neuer einzelner Fetch zu `POST /api/projects/context/generate` mit identischem `{ brief: "<aktuell-getrimmt>" }`-Body; State wechselt erneut auf `pending`; nach Response **ersetzt** der neue Draft den vorherigen vollständig (kein Append, keine History); Accept-Button arbeitet gegen den neuesten Draft.

6) **GIVEN** State `pending` (Generate oder Regenerate), und Route wirft Fehler (`502`, Network-Error, oder andere Non-2xx)
   **WHEN** Response/Reject eintrifft
   **THEN** State wechselt zu `error` (wireframes.md Zeile 358): rote Inline-Message unter den Buttons mit dem **exakten** Wortlaut `"Could not generate. Try again."` (architecture.md → Error Handling Strategy, Zeile 492); `helper_brief_input` bleibt mit User-Eingabe erhalten und editierbar; Generate-Button ist wieder enabled; Draft-Section bleibt unsichtbar (oder zeigt vorigen Draft falls Regenerate fehlschlug — Wireframe sagt "Accept hidden", also Accept ist `disabled`/hidden bei Fehler nach Regenerate).

7) **GIVEN** State `draft_ready` und User klickt Accept (=`helper_accept_btn`)
   **WHEN** Click feuert
   **THEN** ruft Parent-Callback `onAccept(draft: string)` genau einmal mit dem aktuellen Draft-Text auf; Modal schließt (`onOpenChange(false)`); Done-Signal aus slim-slices.md Zeile 147: Parent (`<ProjectContextSettings>`) füllt sein `context_textarea` mit dem Draft (Wiring liegt in Slice 06).

8) **GIVEN** State `empty`, `brief_filled`, `pending`, `draft_ready` oder `error` und User klickt Cancel ODER drückt ESC ODER klickt Backdrop
   **WHEN** Close-Trigger feuert
   **THEN** Modal schließt OHNE Aufruf des `onAccept`-Callbacks; KEIN Confirm-Dialog (anders als Slice 06 — der Brief-/Draft-Verlust ist rein modal-intern, daher kein Discard-Confirm laut wireframes.md Zeile 354 "Cancel: closes modal without change"); pending Fetch wird **abgebrochen** (AbortController) — siehe Constraints.

9) **GIVEN** Playwright-E2E-Spec (Done-Signal aus slim-slices.md Zeile 147)
   **WHEN** Test öffnet Settings (Slice 06) → klickt "Help me write this" → tippt Brief → klickt Generate → wartet auf Draft → klickt Accept
   **THEN** Modal schließt UND Settings-`context_textarea` enthält den Draft-Text. Sub-Cases im selben Spec: (a) Regenerate ersetzt einen bereits vorhandenen Draft mit dem neuen; (b) Cancel nach Generate ändert das Settings-`context_textarea` nicht (bleibt leer ODER beim vorherigen Wert).

---

## Test Skeletons

> **Hinweis für Test-Writer:** RTL-Setup mockt `fetch` global (`vi.spyOn(globalThis, "fetch")`); Parent-Callback `onAccept` als `vi.fn()` injiziert; Modal-Open/Close via `open` + `onOpenChange` Props. Playwright nutzt seed-DB + echte Slice-08-Route (oder `page.route()`-Stub, falls Determinismus benötigt). Alle Selektoren via `data-testid`.

### Test-Datei: `components/projects/__tests__/help-me-write-modal.test.tsx`

<test_spec>
```typescript
// AC-1: Initial empty state — Generate disabled, Draft hidden, Cancel visible
it.todo('renders empty state on open: counter 0/500, Generate disabled, no Draft section, Cancel enabled')

// AC-2: Live counter + length-gated Generate-enable + over-limit color
it.todo('updates counter on input; enables Generate at 10..500 chars; turns red and disables Generate when > 500')

// AC-3: Generate triggers single fetch with trimmed brief and shows pending state
it.todo('clicking Generate calls /api/projects/context/generate exactly once with trimmed brief and disables all buttons during pending')

// AC-4: Draft-ready renders Cancel/Regenerate/Accept and shows draft text
it.todo('renders draft text and Cancel/Regenerate/Accept buttons after 200 response; helper_brief_input is editable again')

// AC-5: Regenerate replaces draft with new fetch
it.todo('Regenerate fires new fetch with same trimmed brief and replaces previous draft fully')

// AC-6: Error path shows exact wording, preserves brief, Accept hidden/disabled
it.todo('shows "Could not generate. Try again." inline error on 502/throw; brief preserved; Accept not actionable')

// AC-7: Accept calls onAccept(draft) and closes modal
it.todo('clicking Accept invokes onAccept with current draft and closes modal via onOpenChange(false)')

// AC-8: Cancel/ESC/Backdrop closes without onAccept and aborts pending fetch
it.todo('Cancel and ESC close modal without calling onAccept; pending fetch is aborted via AbortController')
```
</test_spec>

### Test-Datei: `tests/e2e/help-me-write-modal.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-9: E2E happy path — Brief → Generate → Draft → Accept fills parent textarea
test.todo('open settings, click Help-me-write, type brief, generate, accept fills context_textarea with draft')

// AC-9: Regenerate replaces draft
test.todo('after first draft, click Regenerate replaces draft with new content')

// AC-9: Cancel after generate leaves parent textarea unchanged
test.todo('cancel after generating draft does not modify parent context_textarea')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-helper-modal-route` | `POST /api/projects/context/generate` | HTTP endpoint | Body: `GenerateProjectContextRequest` (`{ brief: string }`); Response 200 → `GenerateProjectContextResponse` (`{ draft: string }`), 401/422/502 mit `{ error: string }` (siehe architecture.md Zeilen 143-144 + Slice 08 Provides) |
| `slice-06-context-settings-page` | Mount-Slot in `<ProjectContextSettings>` mit Trigger-Button + Callback-Slot für Draft | React composition | Slice 06 muss `<HelpMeWriteModal>` mounten und `onAccept(draft)` mit Schreiben in das `context_textarea` verdrahten (siehe Slice 06 → Provides → Zeile 145) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `<HelpMeWriteModal>` | React component (default export) | `slice-06-context-settings-page` (Mount im `<ProjectContextSettings>`) | Props: `{ open: boolean; onOpenChange: (open: boolean) => void; onAccept: (draft: string) => void }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/projects/help-me-write-modal.tsx` — NEW: Default-Export `<HelpMeWriteModal>`, kontrolliertes Radix `Dialog`, `helper_brief_input` (Textarea + Counter), Generate/Regenerate/Accept/Cancel-Buttons, internes State-Modell (`empty` | `brief_filled` | `pending` | `draft_ready` | `error`), Fetch zu `/api/projects/context/generate` mit `AbortController`, ruft `onAccept(draft)` und `onOpenChange(false)` bei Accept
- [ ] `components/projects/project-context-settings.tsx` — MODIFY: rendert `<HelpMeWriteModal>` als Kind, verdrahtet "Help me write this"-Button → `setHelperOpen(true)`, übergibt `onAccept`-Callback der Draft in das `context_textarea` (über lokalen State / Lift) übernimmt und Dirty-State markiert (Mount-Point — sonst ist die Komponente tot)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.
> **Hinweis:** Der MODIFY an `project-context-settings.tsx` ist minimal-invasiv — Slice 06 hatte bereits den Render-Slot reserviert (siehe Slice 06 Constraints "Slice 09 verdrahtet via Ref / Lift-State"); dieser Slice füllt den Slot.

---

## Constraints

**Scope-Grenzen:**
- KEIN direkter DB- oder Server-Action-Aufruf — Modal kommuniziert ausschließlich via `POST /api/projects/context/generate` (Slice 08); das **Speichern** des akzeptierten Drafts in `projects.context_instructions` läuft über Slice 06 (Save-Button im `<ProjectContextSettings>`)
- KEINE Workspace-/Assistant-Kopplung — Modal weiß nichts vom aktiven Projekt, Session, Reducer
- KEIN Edit-Inplace im Draft-Block — Draft ist read-only Vorschau (User editiert NACH Accept im großen Settings-Textarea, siehe Discovery Q3 + Wireframe Zeile 343 `helper_accept_btn`)
- KEINE History mehrerer Drafts — Regenerate **ersetzt** den vorherigen Draft (AC-5); kein Vergleich, kein Undo
- KEIN Toast — Status (Pending, Error) inline im Modal anzeigen, NICHT via `sonner` (konsistent mit Slice 06 Modal-Konvention)
- KEIN Confirm-Dialog beim Cancel — anders als Slice 06; Brief/Draft-Verlust ist rein modal-intern (Wireframe Zeile 354)
- KEIN Hard-Validation-Error-Text bei `< 10 chars` — Generate ist einfach `disabled` (Wireframe State `empty`/`brief_filled`); 422-Wortlaut wird nur dann sichtbar, wenn der Server unerwartet 422 liefert (theoretisch unmöglich bei korrektem Client-Gating, dann fällt er in den AC-6-Pfad mit Backend-Wortlaut)
- KEINE neue Util-Datei — Komponenten-Logik komplett im Single-File-Slice; Reuse von `cn()` aus `lib/utils`

**Technische Constraints:**
- `"use client"`-Direktive (Client-Component wegen interaktivem State + Fetch)
- Modal-Primitive MUSS `components/ui/dialog.tsx` (Radix `Dialog`) sein — siehe architecture.md Zeile 581 + Slice 06 Konvention; KEINE eigene Modal-Implementierung, KEIN `AlertDialog` (nur `Dialog`, da kein destruktiver Confirm)
- Char-Counter: `String.prototype.length` (UTF-16-Codepoints, konsistent mit Slice 06 + Slice 08)
- Brief-Trim **client-seitig** vor Fetch (gleiche Konvention wie Slice 08 server-seitig — vermeidet false-positive 422); aber **rohen** Eingabe-Wert für `helper_brief_input.value` belassen, damit User-Cursor / Whitespace nicht aus dem Editor verschwinden
- Counter-Format: `{n} / 500 chars` analog zu Wireframe Zeile 318; Zahlen-Format ohne Tausender-Trenner (max ist 500, Trenner unnötig)
- Fetch: native `fetch()` (kein Axios, kein TanStack Query) — POST mit `Content-Type: application/json` und `signal: abortController.signal`; `AbortController` in `useRef` halten und im Cleanup / on-Cancel `.abort()` aufrufen, um pending Requests beim Schließen zu stoppen
- Response-Handling: `if (!response.ok) → State error` (sowohl 401 als auch 422 als auch 502 fallen in denselben Fehler-Pfad mit dem Architektur-Wortlaut aus Zeile 492 — das genaue Server-Error-JSON wird **nicht** angezeigt; konstanter UX-String `"Could not generate. Try again."` per Wireframe Zeile 358 + architecture.md 492)
- State-Modell intern: ein einzelner `useState<"empty" | "brief_filled" | "pending" | "draft_ready" | "error">` plus `draft: string | null` reicht; **kein** `useReducer` (zu viel für 5 States), **keine** Zustands-Library
- Buttons-Visibility laut Wireframe: State `empty`/`brief_filled`/`pending` zeigt **Generate** + Cancel; State `draft_ready` zeigt Cancel + Regenerate + Accept (drei Buttons in der Reihenfolge aus Wireframe Zeile 336-338); State `error` zeigt Cancel + Generate (Retry über Generate, **nicht** über Regenerate, weil ggf. noch kein Draft existiert)
- Cancel-Trigger MUSS für ALLE Schließ-Pfade greifen (Cancel-Button-Click, ESC, Backdrop) — Logic in `onOpenChange`-Handler des Radix `Dialog` plus expliziter Cancel-Button, der ebenfalls `onOpenChange(false)` triggert
- AbortController-Lifecycle: bei jedem Generate/Regenerate-Click neuen Controller anlegen + Refs aktualisieren; bei Modal-Close ALLE pending Requests abbrechen (`return` ignoriert dann das Response-Handling)
- Sprache der UI-Texte: Brief-Placeholder + Buttons folgen Wireframe (DE/EN-Mix wie dort: "Generate context", "Use this", "Regenerate", "Cancel"); KEINE i18n-Lib einführen (gleicher Stil wie Slice 06)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/dialog.tsx` (Radix `Dialog`) | Import + Compose — Modal-Container, Header, Footer; **kein** Fork |
| `components/ui/button.tsx` | Import — Generate (Primary), Accept (Primary), Cancel (Secondary), Regenerate (Secondary) |
| `components/ui/textarea.tsx` (falls vorhanden) | Import — sonst native `<textarea>` mit Tailwind-Klassen (Pattern wie in Slice 06) |
| `lib/utils.ts` (`cn()`-Helper) | Import für conditional Tailwind (Counter rot bei over-limit, disabled-Style) |
| `app/api/projects/context/generate/route.ts` (Slice 08) | NICHT importieren — wird via `fetch("/api/projects/context/generate")` aufgerufen; HTTP ist die Boundary |
| `components/projects/project-context-settings.tsx` (Slice 06) | MODIFY — Mount-Slot füllen + `onAccept` verdrahten (siehe Deliverables) |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Endpoints — Project Context (NEW)" → Zeile 79 (Endpoint-Spezifikation des Helper-Calls)
- Architecture: dieselbe Datei → Section "DTOs" → Zeilen 143-144 (`GenerateProjectContextRequest` / `GenerateProjectContextResponse` Shape)
- Architecture: dieselbe Datei → Section "Error Handling Strategy" → Zeile 492 (Wortlaut `"Could not generate. Try again."`)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeile 540 (Komponenten-Spec für `help-me-write-modal.tsx`)
- Architecture: dieselbe Datei → Section "Open Questions" → Q3 (Zeile 699: Accept / Regenerate / Cancel UX bestätigt)
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section "Help-me-write-this Modal" → Zeilen 299-359 (alle State-Variations: `empty`, `brief_filled`, `pending`, `draft_ready`, `error`, `over_limit_brief`)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice C (Zeile 349) + Q12/Q17 (Zeilen 449/454: Help-me-write Input ist nur Kurzbeschreibung) + Open Question Q3 (Zeile 413: Accept / Regenerate / Cancel)
- Slim-Slices: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slim-slices.md` → Slice 09 (Zeilen 143-149: Scope, Deliverable, Done-Signal, Dependencies)
