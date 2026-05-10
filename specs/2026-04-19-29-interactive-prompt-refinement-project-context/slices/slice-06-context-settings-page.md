# Slice 06: Project-Context-Settings UI

> **Slice 06 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-context-settings-page` |
| **Test** | `pnpm test components/projects/__tests__/project-context-settings.test.tsx` |
| **E2E** | `true` |
| **Dependencies** | `["slice-03-context-routes", "slice-04-context-server-action"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 + React + Radix-Primitives. Repo verwendet **Vitest + React-Testing-Library** für Komponenten-Tests (Pattern aus bestehenden `components/**/__tests__/*.test.tsx`) und **Playwright** für E2E (siehe `playwright.config.ts` falls vorhanden, sonst `tests/e2e/` Konvention). UI-Tests mocken Server-Action via `vi.mock("@/app/actions/projects")` und Route-Handler via MSW oder direktes Fetch-Stubbing.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + react + radix + vitest + playwright` |
| **Test Command** | `pnpm test components/projects/__tests__/project-context-settings.test.tsx` |
| **Integration Command** | `pnpm test components/projects/__tests__/project-context-settings.test.tsx` (RTL-basiert; keine separate Integration-Schicht) |
| **Acceptance Command** | `pnpm playwright test tests/e2e/project-context-settings.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `GET /api/projects/{seed-uuid}/context` (200 für Owner) |
| **Mocking Strategy** | `mock_external` (Vitest mockt Server-Action + `fetch` für GET; Playwright nutzt seed-DB ohne Mocking) |

---

## Ziel

Liefert `<ProjectContextSettings>` als Modal-Komponente für das Editieren von `projects.context_instructions`. Lädt initialen Wert via `GET /api/projects/{id}/context` (Slice 03), speichert via `updateProjectContext` Server-Action (Slice 04). Erzwingt 8000-Zeichen-Cap im UI (Counter + Save-Disable) und schützt vor versehentlichem Datenverlust per Confirm-Dialog bei Cancel-mit-Dirty-State.

---

## Acceptance Criteria

1) **GIVEN** ein Owner öffnet die Komponente für ein Projekt mit gespeichertem `context_instructions = "psychedelic vintage prints"`
   **WHEN** die Komponente mountet
   **THEN** ruft `GET /api/projects/{id}/context` einmal auf, befüllt das Textarea mit dem geladenen Wert; Char-Counter zeigt `26 / 8,000`; Save-Button ist `disabled` (kein Dirty-State); "Last updated"-Zeile zeigt formatiertes `context_updated_at` (siehe wireframes.md → Section "Project Context Settings" → State `filled`).

2) **GIVEN** Komponente offen mit geladenem Wert
   **WHEN** User tippt im Textarea einen neuen Wert (Dirty-State)
   **THEN** Char-Counter aktualisiert live (Format `{n} / 8,000`); Save-Button wird `enabled`; bei `length > 8000` wird Counter rot eingefärbt UND Save-Button erneut `disabled` (siehe wireframes.md → State `over_limit`).

3) **GIVEN** Dirty-State mit gültigem Wert (≤ 8000 chars)
   **WHEN** User klickt Save
   **THEN** ruft `updateProjectContext({ projectId, contextInstructions })` Server-Action aus Slice 04 genau einmal auf; Save-Button zeigt Pending-State (Spinner); bei Erfolg ist Textarea read-only während Save (siehe wireframes.md → State `saving`); nach Erfolg zeigt inline "✓ Saved"-Indikator (auto-hide nach ~2s); "Last updated"-Zeile aktualisiert sich auf neuen Timestamp; Modal bleibt offen mit dem gespeicherten Wert; Dirty-State zurückgesetzt.

4) **GIVEN** Server-Action liefert `{ error: "Context exceeds maximum length of 8000 characters." }` (z.B. Race mit anderem Tab)
   **WHEN** Save-Pfad terminiert
   **THEN** Modal zeigt Inline-Error unter Save-Button mit dem zurückgegebenen `error`-String (Wortlaut aus architecture.md → Section "Validation Rules", Zeile 337); Dirty-State bleibt erhalten; Textarea bleibt editierbar; Save-Button ist nach Error-Display wieder `enabled` für Retry (siehe wireframes.md → State `error`).

5) **GIVEN** Dirty-State (User hat getippt) und User klickt Cancel ODER schließt Modal via ESC/Backdrop
   **WHEN** Cancel-Trigger feuert
   **THEN** öffnet Confirm-Dialog (Radix `AlertDialog`) mit Titel/Message exakt `"Ungespeicherte Änderungen verwerfen?"` (Wortlaut aus architecture.md → Error-Handling-Strategy, Zeile 498) und zwei Buttons "Verwerfen" / "Bearbeiten"; Modal schließt NICHT direkt. "Verwerfen" schließt das Modal verlustig der Änderungen; "Bearbeiten" schließt nur den Confirm-Dialog, Settings-Modal bleibt offen mit allen Eingaben.

6) **GIVEN** **kein** Dirty-State (User hat nichts geändert) und User klickt Cancel ODER schließt Modal via ESC/Backdrop
   **WHEN** Cancel-Trigger feuert
   **THEN** Modal schließt direkt OHNE Confirm-Dialog (siehe architecture.md → Section "Error Handling Strategy", Zeile 498: "only on dirty state").

7) **GIVEN** initiale Last (Komponente mountet, GET läuft)
   **WHEN** Render-Phase
   **THEN** Textarea ist `disabled` während Loading; Save-Button ist `disabled`; Layout-Skeleton ODER Loading-Indicator sichtbar; Char-Counter zeigt `0 / 8,000` als Fallback bis Daten da sind. Wenn GET 404 liefert (Projekt nicht gefunden / kein Owner): Inline-Error "Project not found" und Modal kann nur via Cancel/ESC geschlossen werden.

8) **GIVEN** geladener Wert ist `null` oder leerer String (kein Context bisher)
   **WHEN** Komponente initial rendert
   **THEN** Textarea ist leer mit Placeholder `"Describe your project, so the assistant knows the vibe, style and recurring themes..."` (siehe wireframes.md → State `empty`); Counter `0 / 8,000`; "Last updated"-Zeile **nicht** sichtbar (entspricht Wireframe-State `empty`); Save-Button initial `disabled`.

9) **GIVEN** Playwright-E2E-Spec (Done-Signal aus `slim-slices.md`)
   **WHEN** Test öffnet Settings → tippt Wert → klickt Save → schließt Modal → öffnet Settings erneut
   **THEN** Textarea zeigt den gespeicherten Wert; ein Wert > 8000 chars (z.B. langer Lorem-Ipsum) macht Save-Button `disabled`; Cancel mit Dirty-State zeigt Confirm-Dialog mit "Verwerfen"/"Bearbeiten"-Buttons.

---

## Test Skeletons

> **Hinweis für Test-Writer:** RTL-Setup mockt `updateProjectContext` Server-Action via `vi.mock("@/app/actions/projects", ...)` und stub'd `fetch` für GET-Endpoint. Playwright-Spec nutzt seed-DB-User + bekanntes Projekt; Selektoren via `data-testid`. Loading-Pfade verifizieren `aria-busy`/`disabled`-Attribute.

### Test-Datei: `components/projects/__tests__/project-context-settings.test.tsx`

<test_spec>
```typescript
// AC-1: Initial-Load — GET-Call + Textarea befüllt + Counter + disabled Save
it.todo('mounts component, fetches context, populates textarea, shows formatted last-updated, save disabled')

// AC-2: Live Char-Counter + over-limit Color + Save-Disable bei >8000
it.todo('updates counter live on typing; turns red and disables save when length > 8000')

// AC-3: Save Happy-Path — Server-Action-Call + Pending-State + Saved-Indicator + Timestamp-Update
it.todo('calls updateProjectContext server action once on save; shows pending then saved indicator; updates last-updated row')

// AC-4: Save-Error — Inline-Error + Dirty bleibt + Save wieder enabled
it.todo('shows inline error from server action error string; preserves dirty state; re-enables save for retry')

// AC-5: Cancel mit Dirty → Confirm-Dialog "Ungespeicherte Änderungen verwerfen?"
it.todo('shows AlertDialog with exact title and Verwerfen/Bearbeiten buttons when cancel pressed with dirty state')

// AC-6: Cancel ohne Dirty → Modal schließt direkt
it.todo('closes modal directly when cancel pressed with no dirty state (no confirm dialog)')

// AC-7: Loading-State + 404-Path
it.todo('shows loading state during fetch with disabled textarea and save; renders project-not-found error on 404')

// AC-8: Empty-State Wireframe — Placeholder + last-updated hidden
it.todo('renders placeholder, no last-updated row when context_instructions is null/empty')
```
</test_spec>

### Test-Datei: `tests/e2e/project-context-settings.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-9: E2E Round-Trip — Open → Type → Save → Reopen zeigt Wert
test.todo('open settings, type new context, save, reopen modal shows persisted value')

// AC-9: >8000 chars disabled Save
test.todo('typing more than 8000 chars disables save button and turns counter red')

// AC-9: Cancel-mit-Dirty zeigt Confirm
test.todo('cancel with dirty changes shows confirm dialog with Verwerfen and Bearbeiten')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-context-routes` | `GET /api/projects/{id}/context` | HTTP endpoint | Liefert `ProjectContextResponse` (siehe architecture.md Zeile 142) — `{ id, context_instructions, context_updated_at }` |
| `slice-04-context-server-action` | `updateProjectContext` | async server action | Signatur: `(input: { projectId: string; contextInstructions: string \| null }) => Promise<{ contextInstructions: string \| null; contextUpdatedAt: Date } \| { error: string }>` (siehe slice-04 Provides-Tabelle) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `<ProjectContextSettings>` | React component (default export) | `slice-07-project-list-edit-entry` (Mount-Point in Project-Card-Menu + Workspace-Header) | Props: `{ projectId: string; open: boolean; onOpenChange: (open: boolean) => void }` |
| `<ProjectContextSettings>` | React component | `slice-09-helper-modal-component` (rendert Helper-Modal als Kind, schreibt Draft zurück ins Textarea) | Provides callback-Slot ODER kontrolliertes Textarea-State (Slice 09 verdrahtet via Ref / Lift-State) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/projects/project-context-settings.tsx` — NEW: Default-Export `<ProjectContextSettings>`, kontrolliertes Modal über Radix `Dialog`, Textarea + Char-Counter + Save/Cancel-Buttons + Last-Updated-Anzeige + Confirm-Dialog für Cancel-mit-Dirty
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.
> **Hinweis:** Die Mount-Punkte in `components/project-card.tsx` und `components/workspace/workspace-header.tsx` werden in Slice 07 ergänzt — bis dahin existiert die Komponente isoliert (Storybook-/Playwright-test-fähig via direkte Render).

---

## Constraints

**Scope-Grenzen:**
- KEIN "Help me write this"-Button-Verhalten — Button-UI ist im Wireframe erwähnt, aber Modal-Logik (`<HelpMeWriteModal>`) gehört zu Slice 09; Slice 06 reserviert nur den Render-Slot (Button rendert, Click ist No-Op oder ruft optionalen Callback-Prop auf)
- KEIN Mount-Point in `project-card.tsx` oder `workspace-header.tsx` — Slice 07 verdrahtet Entry-Points
- KEINE Project-Header-Chrome (Back-Link, Project-Name) als Top-Level — Wireframe zeigt sie als Modal-Kontext, Implementierung als kompaktes Modal-Header reicht
- KEINE Toast-Notifications — Status wird inline (Saved-Indicator, Error-Message) angezeigt, NICHT via `sonner`-Toast (Wireframe-Konvention für dieses Modal)
- KEIN URL-Routing / Page-Variante — Architecture (Zeile 539) erlaubt Modal ODER Page; Slice nutzt **Modal** via Radix `Dialog`-Primitive (Discovery Q18)
- KEIN Fetch-Cache — initialer GET nutzt `cache: "no-store"` ODER Server-Component-Pattern; entscheidend ist: nach Save zeigt Re-Open den frischen Wert (revalidatePath aus Slice 04 sorgt dafür)

**Technische Constraints:**
- Komponente MUSS Client-Component sein (`"use client"` Directive) — wegen interaktivem State (Dirty, Counter, Confirm-Dialog)
- Modal-Primitive MUSS `components/ui/dialog.tsx` (Radix `Dialog`) sein — siehe architecture.md Zeile 581
- Confirm-Dialog für Discard MUSS `components/ui/alert-dialog.tsx` (Radix `AlertDialog`) sein — separater Primitive für destruktive Confirms; NICHT verschachteltes `Dialog`-in-`Dialog`
- Char-Count via `String.prototype.length` (UTF-16-Codepoints, konsistent mit Slice 04 AC-3)
- Format der "Last updated"-Anzeige: lokales Datum + Uhrzeit (z.B. `Intl.DateTimeFormat`); KEIN externer date-fns-Import nur für dieses Slice (architecture nennt keine Lib-Vorgabe)
- Counter-Format MUSS `{thousands-formatted-n} / 8,000 chars` sein (siehe wireframes.md Zeile 264 — `1,024 / 8,000 chars`)
- Save-Button-Disable-Bedingung: `(!isDirty) || (length > 8000) || isSaving`
- Cancel-Trigger MUSS für ALLE Schließ-Pfade greifen: Cancel-Button-Click, ESC-Taste, Backdrop-Click — daher Logic in `onOpenChange`-Handler des Radix `Dialog`
- Server-Action-Aufruf MUSS Discriminated-Union prüfen: `if ("error" in result) showInlineError(result.error)` (Pattern aus Slice 04 AC-7)
- KEIN client-side Re-Sanitization — DTO-Ebene (Slice 04) trimmt und validiert; UI sendet rohen Textarea-Wert

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/dialog.tsx` (Radix `Dialog`) | Import + Compose — Modal-Container, Header, Footer; KEIN Fork |
| `components/ui/alert-dialog.tsx` (Radix `AlertDialog`) | Import + Compose — Confirm-Discard-Dialog (Cancel-mit-Dirty); KEIN Fork |
| `components/ui/button.tsx` | Import — Save (Primary), Cancel (Secondary), Help-me-write (placeholder) Buttons |
| `components/ui/textarea.tsx` (falls vorhanden) | Import — sonst native `<textarea>` mit Tailwind-Klassen |
| `app/actions/projects.ts` → `updateProjectContext` | Import als Server-Action aus Slice 04, NICHT neu implementieren |
| `lib/utils.ts` (oder vorhandene `cn()`-Helper) | Import für conditional Tailwind-Klassen (z.B. Counter rot bei over-limit) |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Migration Map" Zeile 539 (Komponenten-Spec, Modal-vs-Page-Wahl, Confirm-Dialog-Wortlaut)
- Architecture: dieselbe Datei → Section "Error Handling Strategy" Zeile 498 (Cancel-mit-Dirty-Confirm-Wortlaut)
- Architecture: dieselbe Datei → Section "Validation Rules" Zeile 337 (8000-Char-Cap + Fehlermeldung)
- Architecture: dieselbe Datei → Section "Integrations" Zeile 581 (Radix `Dialog` + `AlertDialog` als UI-Primitives)
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section "Project Context Settings" (Zeilen 231-296) inkl. State-Variations (`empty`, `filled`, `saving`, `saved`, `error`, `over_limit`)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Section "UI Components & States" → Zeile 230 (`context_textarea` States) + Q18 (Modal-Variante bestätigt)
