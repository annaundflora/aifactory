# Slice 4: Project Overview UI implementieren

> **Slice 4 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-project-overview-ui` |
| **Test** | `pnpm test components/__tests__/project-card.test.tsx components/__tests__/confirm-dialog.test.tsx app/__tests__/page.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-project-server-actions"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/__tests__/project-card.test.tsx components/__tests__/confirm-dialog.test.tsx app/__tests__/page.test.tsx` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm dev & sleep 5 && pnpm test app/__tests__/page.integration.test.tsx` |
| **Acceptance Command** | `pnpm test components/__tests__/project-card.test.tsx components/__tests__/confirm-dialog.test.tsx app/__tests__/page.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (Server Actions werden in Unit-Tests gemockt) |

---

## Ziel

Root-Page (`/`) mit Projekt-Uebersicht aufbauen: Grid aus Project-Cards, Inline-Erstellung neuer Projekte, Umbenennen per Inline-Input und Loeschen mit Bestaetigungs-Dialog. Zusaetzlich wird `ConfirmDialog` als shared Component erstellt, da es hier zuerst benoetigt wird und spaeter auch im Workspace (Lightbox Delete) und Prompt Builder eingesetzt wird.

---

## Acceptance Criteria

1) GIVEN keine Projekte in der DB
   WHEN die Root-Seite `/` geladen wird
   THEN wird ein Empty State angezeigt mit Text "Create your first project" und einem prominenten New-Project-Button

2) GIVEN 3 Projekte existieren in der DB
   WHEN die Root-Seite `/` geladen wird
   THEN werden 3 Project-Cards in einem responsiven Grid angezeigt, jede mit Projektname, Generation-Count, Erstelldatum und Thumbnail-Bereich

3) GIVEN die Root-Seite ist geladen
   WHEN der User auf den `[+ New Project]` Button klickt
   THEN erscheint ein Inline-Input-Feld (auto-fokussiert) fuer den Projektnamen

4) GIVEN das Inline-Input ist sichtbar und der User hat "My Design" eingegeben
   WHEN der User Enter drueckt
   THEN wird `createProject({ name: "My Design" })` aufgerufen und eine neue Card erscheint im Grid

5) GIVEN das Inline-Input ist sichtbar und leer
   WHEN der User Escape drueckt oder ausserhalb klickt (Blur)
   THEN wird das Input-Feld ausgeblendet ohne ein Projekt zu erstellen

6) GIVEN eine Project-Card wird angezeigt
   WHEN der User auf die Card klickt (nicht auf Rename/Delete Icons)
   THEN wird zur Route `/projects/{id}` navigiert

7) GIVEN eine Project-Card wird angezeigt
   WHEN der User auf das Rename-Icon (Stift) klickt
   THEN wird der Projektname zu einem editierbaren Inline-Input (auto-fokussiert, Wert vorausgefuellt)

8) GIVEN der Rename-Input ist aktiv mit neuem Wert "Renamed Project"
   WHEN der User Enter drueckt oder der Input den Fokus verliert (Blur)
   THEN wird `renameProject({ id, name: "Renamed Project" })` aufgerufen und die Card zeigt den aktualisierten Namen

9) GIVEN eine Project-Card wird angezeigt
   WHEN der User auf das Delete-Icon (Papierkorb) klickt
   THEN oeffnet sich ein `ConfirmDialog` mit Titel "Delete Project?" und Beschreibung "This will permanently delete \"{name}\" and all N generations."

10) GIVEN der `ConfirmDialog` ist offen
    WHEN der User auf den destruktiven "Delete" Button klickt
    THEN wird `deleteProject({ id })` aufgerufen, der Dialog schliesst sich, und die Card verschwindet aus dem Grid

11) GIVEN der `ConfirmDialog` ist offen
    WHEN der User auf "Cancel" klickt oder den Dialog schliesst
    THEN schliesst sich der Dialog ohne Aktion, die Card bleibt bestehen

12) GIVEN ein Projekt hat 0 Generierungen
    WHEN die Card angezeigt wird
    THEN zeigt der Thumbnail-Bereich einen Placeholder (kein Bild), der Count zeigt "0 images"

13) GIVEN die `createProject` Server Action gibt `{ error: "..." }` zurueck
    WHEN der User ein Projekt erstellen wollte
    THEN wird ein Toast mit der Fehlermeldung angezeigt

14) GIVEN `ConfirmDialog` wird mit `title`, `description`, `onConfirm`, `onCancel` Props gerendert
    WHEN der Dialog sichtbar ist
    THEN zeigt er Titel, Beschreibung, einen "Cancel" Button und einen destruktiv gestylten Confirm-Button

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/__tests__/project-card.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ProjectCard', () => {
  // AC-2: Card-Inhalte
  it.todo('should render project name, generation count, date, and thumbnail area')

  // AC-6: Navigation
  it.todo('should navigate to /projects/{id} on card click')

  // AC-7: Rename-Icon
  it.todo('should switch to inline input when rename icon is clicked')

  // AC-8: Rename-Submit
  it.todo('should call renameProject on Enter or Blur with new name')

  // AC-9: Delete-Icon
  it.todo('should open ConfirmDialog when delete icon is clicked')

  // AC-12: Thumbnail-Placeholder
  it.todo('should show placeholder when generation count is 0')
})
```
</test_spec>

### Test-Datei: `components/__tests__/confirm-dialog.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ConfirmDialog', () => {
  // AC-14: Props rendern
  it.todo('should render title, description, cancel and destructive confirm button')

  // AC-11: Cancel
  it.todo('should call onCancel when Cancel button is clicked')

  // AC-10: Confirm
  it.todo('should call onConfirm when destructive button is clicked')
})
```
</test_spec>

### Test-Datei: `app/__tests__/page.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Root Page (/)', () => {
  // AC-1: Empty State
  it.todo('should render empty state with CTA when no projects exist')

  // AC-2: Projekte laden und anzeigen
  it.todo('should fetch projects via getProjects and render project cards')

  // AC-3: New-Project-Button
  it.todo('should show inline input when new project button is clicked')

  // AC-4: Projekt erstellen
  it.todo('should call createProject action on Enter with project name')

  // AC-5: Input abbrechen
  it.todo('should hide input on Escape or Blur without creating project')

  // AC-10: Delete bestaetigen
  it.todo('should call deleteProject and remove card after ConfirmDialog confirm')

  // AC-13: Fehler-Toast
  it.todo('should show toast when createProject returns error')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-project-server-actions` | `createProject` | Server Action | `(input: { name: string }) => Promise<{ id, name, createdAt } \| { error: string }>` |
| `slice-03-project-server-actions` | `getProjects` | Server Action | `() => Promise<Project[]>` |
| `slice-03-project-server-actions` | `renameProject` | Server Action | `(input: { id: string, name: string }) => Promise<Project \| { error: string }>` |
| `slice-03-project-server-actions` | `deleteProject` | Server Action | `(input: { id: string }) => Promise<{ success: boolean } \| { error: string }>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ConfirmDialog` | React Component | Lightbox (spaetere Slices), Prompt Builder | `<ConfirmDialog title={string} description={string} onConfirm={fn} onCancel={fn} open={boolean} />` |
| `ProjectCard` | React Component | Workspace-Sidebar (spaetere Slices) | `<ProjectCard project={Project} onRename={fn} onDelete={fn} />` |
| `app/page.tsx` | Next.js Page | Router (Entry Point) | Server Component, rendert `/` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/page.tsx` — Root-Page Server Component, laedt Projekte via `getProjects`, rendert Grid oder Empty State
- [ ] `components/project-card.tsx` — Card mit Thumbnail-Bereich, Name, Count, Datum, Rename/Delete-Icons und Inline-Input
- [ ] `components/shared/confirm-dialog.tsx` — Wiederverwendbarer Bestaetigungs-Dialog fuer destruktive Aktionen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Projekt-Workspace (`/projects/[id]`) -- kommt in spaeteren Slices
- KEINE Sidebar-Navigation -- kommt im Workspace-Slice
- KEINE echten Thumbnails (letztes generiertes Bild) -- Placeholder, Thumbnail-Logik kommt wenn Generations existieren
- KEIN Routing-Setup fuer `/projects/[id]` -- nur `href` Link auf der Card

**Technische Constraints:**
- `app/page.tsx` ist ein Server Component (Data Fetching via `getProjects`)
- Client Components fuer interaktive Elemente: Inline-Input, Rename-Input, Delete-Dialog
- shadcn/ui AlertDialog als Basis fuer `ConfirmDialog`
- shadcn/ui Button, Input verwenden
- Tailwind v4 fuer Styling
- Toast-Benachrichtigungen via sonner (shadcn/ui Integration)

**Referenzen:**
- Wireframes: `wireframes.md` → Section "Screen: Project Overview" (Layout, Annotations, State Variations)
- Wireframes: `wireframes.md` → Section "Screen: Confirmation Dialog" (Dialog-Layout und Props-Semantik)
- Architecture: `architecture.md` → Section "API Design > Server Actions" (createProject, getProjects, renameProject, deleteProject)
- Architecture: `architecture.md` → Section "Project Structure" (Dateipfade: `app/page.tsx`, `components/project-card.tsx`, `components/shared/confirm-dialog.tsx`)
