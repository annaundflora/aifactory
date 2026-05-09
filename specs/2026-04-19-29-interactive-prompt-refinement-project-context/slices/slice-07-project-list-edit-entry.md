# Slice 07: Project-List + Workspace-Header Edit-Entries

> **Slice 07 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-project-list-edit-entry` |
| **Test** | `pnpm test components/__tests__/project-card.test.tsx components/workspace/__tests__/workspace-header.test.tsx` |
| **E2E** | `true` |
| **Dependencies** | `["slice-06-context-settings-page"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 + React + Radix-Primitives. Vitest + RTL für Component-Tests, Playwright für E2E. UI-Tests stub'n `<ProjectContextSettings>` via `vi.mock("@/components/projects/project-context-settings")` um Render-Prop-Verdrahtung isoliert zu prüfen.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + react + radix + vitest + playwright` |
| **Test Command** | `pnpm test components/__tests__/project-card.test.tsx components/workspace/__tests__/workspace-header.test.tsx` |
| **Integration Command** | `pnpm test components/__tests__/project-card.test.tsx components/workspace/__tests__/workspace-header.test.tsx` |
| **Acceptance Command** | `pnpm playwright test tests/e2e/project-context-edit-entries.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `GET /api/projects/{seed-uuid}/context` (200 für Owner) |
| **Mocking Strategy** | `mock_external` (Vitest mockt `<ProjectContextSettings>`; Playwright nutzt seed-DB ohne Mocking) |

---

## Ziel

Verdrahtet die Mount-Punkte für `<ProjectContextSettings>` (Slice 06): "Edit context"-Eintrag in der Projekt-Card-Action-Leiste und im Workspace-Header-Dropdown. Klick öffnet das Settings-Modal mit der korrekten `projectId`. Ohne diesen Slice ist die Settings-Komponente "tot" — sie existiert, wird aber nirgendwo gemountet.

---

## Acceptance Criteria

1) **GIVEN** User sieht eine Projekt-Karte in der Projekt-Liste (Hover-State aktiv, Action-Buttons sichtbar)
   **WHEN** User hovert über die Karte
   **THEN** zeigt sich neben Rename- und Delete-Buttons ein neuer Action-Button mit `aria-label="Edit context"` und Settings-Icon (siehe wireframes.md → Section "Project Context Settings" → Annotation "opened from Project list (context menu or edit button per card)"); Button hat `data-action="edit-context"` analog zu bestehenden Action-Markern (siehe `components/project-card.tsx:103` Click-Outside-Selektor-Pattern).

2) **GIVEN** Action-Buttons sichtbar
   **WHEN** User klickt den "Edit context"-Button auf der Projekt-Karte mit `project.id = "abc-123"`
   **THEN** öffnet sich `<ProjectContextSettings>` (Slice 06) mit Props `{ projectId: "abc-123", open: true, onOpenChange: <fn> }`; Link-Navigation der Card wird verhindert (Pattern aus `project-card.tsx:99-108` mit `e.preventDefault()` + `e.stopPropagation()`); Modal kann via `onOpenChange(false)` geschlossen werden, ohne dass die Card-Navigation auslöst.

3) **GIVEN** User ist im Workspace eines Projekts (Workspace-Header sichtbar)
   **WHEN** User öffnet das Kebab-Menü (`<MoreVertical>`) des Workspace-Headers
   **THEN** enthält das Dropdown einen neuen `<DropdownMenuItem>` mit Label `"Edit context"` und Settings-Icon, platziert zwischen "Refresh Thumbnail" und der `<DropdownMenuSeparator>` vor "Delete Project" (siehe wireframes.md → Section "Project Context Settings" → Annotation "Workspace header (gear/settings icon)").

4) **GIVEN** Workspace-Header-Dropdown offen mit "Edit context"-Eintrag
   **WHEN** User klickt den Eintrag
   **THEN** öffnet sich `<ProjectContextSettings>` mit Props `{ projectId: <header-project-id>, open: true, onOpenChange: <fn> }`; Dropdown schließt sich; das bestehende `<SettingsDialog>` (Workspace-Settings) wird NICHT geöffnet — beide Modals bleiben getrennt steuerbar.

5) **GIVEN** Modal aus Card- oder Header-Pfad ist offen
   **WHEN** User schließt das Modal (Save, Cancel, ESC, Backdrop)
   **THEN** ruft Slice 06's `onOpenChange(false)`-Callback auf und der jeweilige Open-State (Card-lokal bzw. Header-lokal) wird auf `false` gesetzt; nach Re-Open zeigt das Modal den frischen persistierten Wert (Re-Render trigger via `key={projectId}` ODER neuer GET-Aufruf in Slice 06).

6) **GIVEN** mehrere Projekt-Karten in der Liste (z.B. 5 Karten)
   **WHEN** User klickt "Edit context" auf Karte mit `project.id = "p3"`
   **THEN** öffnet sich genau **ein** Modal mit `projectId="p3"`; Klick auf "Edit context" einer anderen Karte (während erstes Modal offen wäre) öffnet kein zweites Modal-Layer — Open-State ist pro Card lokal scoped, keine globale Mount-Konkurrenz.

7) **GIVEN** Playwright-E2E (Done-Signal aus `slim-slices.md`)
   **WHEN** Test öffnet Projekt-Liste → klickt "Edit context" auf bekannter Karte → erwartet Modal-Inhalt
   **THEN** Modal rendert mit dem `context_instructions`-Wert genau dieses Projekts (Cross-Project-Verwechslung wird ausgeschlossen); Close-Pfad lässt User zurück auf Projekt-Liste; Workspace-Header-Pfad öffnet selbes Modal-Komponente mit korrekter `projectId` aus URL-Slug.

---

## Test Skeletons

> **Hinweis für Test-Writer:** RTL-Setup mockt `<ProjectContextSettings>` via `vi.mock("@/components/projects/project-context-settings", () => ({ ProjectContextSettings: vi.fn(...) }))` und prüft empfangene Props. Workspace-Header-Test verwendet `userEvent` für Dropdown-Open + Item-Click. Playwright-Spec nutzt seed-DB-User mit ≥ 2 Projekten zur Cross-ID-Validierung.

### Test-Datei: `components/__tests__/project-card.test.tsx`

<test_spec>
```typescript
// AC-1: Edit-context Button rendert mit korrektem aria-label + data-action
it.todo('renders Edit context action button with aria-label and data-action="edit-context"')

// AC-2: Click öffnet ProjectContextSettings mit korrekter projectId
it.todo('clicking Edit context button opens ProjectContextSettings with matching projectId, prevents Link navigation')

// AC-5: onOpenChange(false) schließt Modal, Re-Open lädt frisch
it.todo('onOpenChange(false) resets local open state; re-clicking opens modal again')

// AC-6: Open-State ist pro Card lokal
it.todo('multiple cards each manage own modal open-state; opening one does not affect siblings')
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/workspace-header.test.tsx`

<test_spec>
```typescript
// AC-3: Dropdown enthält Edit-context-Eintrag in korrekter Position
it.todo('dropdown menu contains Edit context item between Refresh Thumbnail and Delete separator')

// AC-4: Click öffnet ProjectContextSettings, schließt Dropdown, lässt SettingsDialog ungeöffnet
it.todo('clicking Edit context item opens ProjectContextSettings with header projectId; SettingsDialog stays closed')

// AC-5: onOpenChange(false) schließt Modal sauber
it.todo('onOpenChange(false) from settings modal resets header local open state')
```
</test_spec>

### Test-Datei: `tests/e2e/project-context-edit-entries.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-7: E2E aus Projekt-Liste — korrekter Project-Context geladen
test.todo('open project list, click Edit context on specific card, modal shows context for that project only')

// AC-7: E2E aus Workspace-Header — selbes Modal mit URL-Slug-projectId
test.todo('open workspace, click Edit context in header dropdown, modal shows context for current workspace project')

// AC-7: Cross-Project-Isolation — verschiedene Cards öffnen verschiedene Contexts
test.todo('clicking Edit context on Project A then Project B shows distinct context values')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-context-settings-page` | `<ProjectContextSettings>` | React component (default export) | Props-Signatur: `{ projectId: string; open: boolean; onOpenChange: (open: boolean) => void }` (siehe slice-06 Provides-Tabelle); muss als kontrolliertes Modal funktionieren |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Edit-context Entry-Point in Projekt-Card | UI integration | End-User-Flow Slice B (Discovery) | Sichtbarer Action-Button in `components/project-card.tsx`, `data-action="edit-context"`, `aria-label="Edit context"` |
| Edit-context Entry-Point in Workspace-Header | UI integration | End-User-Flow Slice B (Discovery) | DropdownMenuItem in `components/workspace/workspace-header.tsx` Kebab-Menü |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/project-card.tsx` — EDIT: Neuer Action-Button mit `data-action="edit-context"` + Settings-Icon in Hover-Action-Leiste; lokaler `useState`-Open-Flag für `<ProjectContextSettings>`; Card-Navigation via `e.preventDefault()` + `e.stopPropagation()` schützen (Pattern bestehender Action-Buttons); Render `<ProjectContextSettings>` außerhalb des `<Link>`-Wrappers analog zu `<ConfirmDialog>` (Zeile 204-211).
- [ ] `components/workspace/workspace-header.tsx` — EDIT: Neuer `<DropdownMenuItem>` "Edit context" mit Settings-Icon zwischen "Refresh Thumbnail" und `<DropdownMenuSeparator>`; lokaler `useState`-Open-Flag für `<ProjectContextSettings>`; Render `<ProjectContextSettings>` neben bestehendem `<SettingsDialog>` (Zeile 182-185).
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Änderung der `<ProjectContextSettings>`-Komponente selbst — nur Mount + Props-Verdrahtung
- KEINE neue Server-Action / Route / DB-Logik — Slice 06+04 liefern alles Backend-seitige
- KEIN globaler Modal-Manager / Context-Provider — Open-State bleibt lokal in Card bzw. Header (Pattern bestehender `<ConfirmDialog>`-Mount-Punkte)
- KEIN URL-Routing / Deep-Link für das Modal — Modal ist rein client-state-driven (Architecture-Entscheidung Modal statt Page, siehe slice-06 Constraints)
- KEINE Änderung am bestehenden `<SettingsDialog>` (Workspace-Settings) — Edit-context ist ein **separater** Eintrag, kein Tab/Section innerhalb des bestehenden Dialogs
- KEINE Änderung an Rename-, Delete-, Thumbnail-Refresh-Logik in Card oder Header

**Technische Constraints:**
- Edit-context-Button auf Card MUSS dem Action-Button-Pattern folgen: `data-action="edit-context"`, `variant="ghost"`, `size="icon"`, `className="size-7"`, mit `e.preventDefault()` + `e.stopPropagation()` im `onClick` (siehe project-card.tsx:163-178 Rename-Button als Vorlage)
- Click-Outside-Link-Selektor in `project-card.tsx:103` MUSS um `[data-action="edit-context"]` erweitert werden, sonst triggert Link-Navigation beim Modal-Open
- Settings-Icon: `<Settings>` aus `lucide-react` (bereits in `workspace-header.tsx:5` importiert; Card-Datei muss Import ergänzen)
- DropdownMenuItem im Header MUSS `<Settings>`-Icon vor Label rendern, konsistent mit `<Pencil>`/`<RefreshCw>`/`<Trash2>` (siehe workspace-header.tsx:148-168)
- Item-Position im Dropdown: NACH `Refresh Thumbnail`, VOR `<DropdownMenuSeparator>` — die Separator + "Delete Project" bleiben am Ende (destruktive Aktion)
- Modal-Mount MUSS außerhalb des `<Link>`-Wrappers (Card) bzw. außerhalb des `<DropdownMenu>` (Header) erfolgen — Pattern: nach dem Hauptelement, neben `<ConfirmDialog>` (siehe project-card.tsx:204, workspace-header.tsx:173)
- Kein zusätzlicher `<DropdownMenu>` in `project-card.tsx` — Cards verwenden Inline-Action-Buttons (kein Dropdown-Pattern dort etabliert), Header verwendet das bestehende Kebab-Dropdown
- Open-State pro Mount-Punkt: `const [isContextSettingsOpen, setIsContextSettingsOpen] = useState(false)`; gemeinsamer State zwischen Card und Header NICHT erforderlich (verschiedene Surfaces)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/projects/project-context-settings.tsx` (Slice 06) | Import + Mount mit `{ projectId, open, onOpenChange }`-Props; KEIN Fork, KEINE Änderung |
| `components/ui/button.tsx` | Import — bereits in beiden Ziel-Dateien verwendet, neuer Edit-context-Button nutzt selbe `variant="ghost" size="icon"`-Konfiguration |
| `components/ui/dropdown-menu.tsx` (`DropdownMenuItem`, `DropdownMenuSeparator`) | Import — bereits in `workspace-header.tsx:11-17` aktiv; neuer Item nutzt selbes Primitive |
| `lucide-react` → `Settings`-Icon | Import — bereits in `workspace-header.tsx:5`; in `project-card.tsx:6` ergänzen |
| `components/shared/confirm-dialog.tsx` | NICHT direkt verwendet — Mount-Pattern (Render neben Hauptelement) referenziert (project-card.tsx:204, workspace-header.tsx:173) |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Migration Map" Zeile 541 (`components/project-card.tsx:209` — Edit context entry) und Zeile 542 (`components/workspace/workspace-header.tsx:182` — settings opener entry)
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section "Project Context Settings" → Annotation Zeile 233 (Entry-Points)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Section "UI Layout & Context" → Zeile 196 ("Eigene Route oder Modal, erreichbar aus Projekt-Liste (Kontextmenü/Edit-Button) und aus Workspace-Header")
- Slice 06: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-06-context-settings-page.md` → Provides-Tabelle (Komponenten-Signatur)
