# Slice 5: Project Workspace Layout + Sidebar implementieren

> **Slice 5 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-workspace-layout-sidebar` |
| **Test** | `pnpm test app/projects/__tests__/page.test.tsx app/__tests__/layout.test.tsx components/__tests__/sidebar.test.tsx components/__tests__/project-list.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-project-overview-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/projects/__tests__/page.test.tsx app/__tests__/layout.test.tsx components/__tests__/sidebar.test.tsx components/__tests__/project-list.test.tsx` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm dev & sleep 5 && pnpm test app/projects/__tests__/page.integration.test.tsx` |
| **Acceptance Command** | `pnpm test app/projects/__tests__/page.test.tsx app/__tests__/layout.test.tsx components/__tests__/sidebar.test.tsx components/__tests__/project-list.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (Server Actions werden in Unit-Tests gemockt) |

---

## Ziel

Workspace-Seite (`/projects/[id]`) mit persistenter Sidebar-Navigation aufbauen. Root-Layout erhaelt den Toaster fuer globale Benachrichtigungen. Die Sidebar listet alle Projekte (`project-list`), hebt das aktive hervor, bietet einen New-Project-Button und einen "Zurueck zur Uebersicht" Link. `ProjectList` wird als eigenstaendige Component extrahiert, damit sie sowohl in der Sidebar als auch in der Overview nutzbar ist.

---

## Acceptance Criteria

1) GIVEN die Route `/projects/{id}` wird mit einer gueltigen Projekt-ID aufgerufen
   WHEN die Seite geladen wird
   THEN wird der Projektname als Ueberschrift im Main-Bereich angezeigt und die Sidebar ist links sichtbar

2) GIVEN die Route `/projects/{id}` wird mit einer nicht existierenden ID aufgerufen
   WHEN die Seite geladen wird
   THEN wird `notFound()` ausgeloest (Next.js 404-Seite)

3) GIVEN 4 Projekte existieren und Projekt B ist aktiv (URL: `/projects/{id-b}`)
   WHEN die Sidebar gerendert wird
   THEN zeigt die `sidebar-project-list` alle 4 Projekte und Projekt B hat eine visuelle Hervorhebung (aktive Background-Farbe oder `font-weight: bold`)

4) GIVEN die Sidebar ist sichtbar
   WHEN der User auf einen anderen Projektnamen in der Liste klickt
   THEN wird zur Route `/projects/{andere-id}` navigiert

5) GIVEN die Sidebar ist sichtbar
   WHEN der User auf den `[+ New]` Button in der Sidebar klickt
   THEN wird die `createProject` Server Action mit einem Default-Namen aufgerufen und anschliessend zur neuen Projekt-Route navigiert

6) GIVEN die Sidebar ist sichtbar
   WHEN der User auf den "Zurueck zur Uebersicht" Link klickt
   THEN wird zur Route `/` navigiert

7) GIVEN die App wird auf einer beliebigen Route geladen
   WHEN `app/layout.tsx` gerendert wird
   THEN ist der Toaster (sonner) im Root-Layout eingebunden, sodass Toast-Notifications global angezeigt werden koennen

8) GIVEN die Workspace-Seite ist geladen
   WHEN der Main-Bereich gerendert wird
   THEN zeigt er einen Platzhalter-Bereich fuer zukuenftige Workspace-Inhalte (Prompt Area, Gallery) mit dem Projektnamen

9) GIVEN `ProjectList` wird mit einer Liste von Projekten und einer aktiven Projekt-ID gerendert
   WHEN die Component dargestellt wird
   THEN werden alle Projekte als anklickbare Links gerendert und das aktive Projekt ist visuell hervorgehoben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/projects/__tests__/page.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Workspace Page (/projects/[id])', () => {
  // AC-1: Gueltige Projekt-ID
  it.todo('should render project name and sidebar for valid project ID')

  // AC-2: Ungueltige Projekt-ID
  it.todo('should call notFound() for non-existent project ID')

  // AC-8: Platzhalter-Bereich
  it.todo('should render placeholder area with project name for future workspace content')
})
```
</test_spec>

### Test-Datei: `app/__tests__/layout.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Root Layout (app/layout.tsx)', () => {
  // AC-7: Toaster im Root-Layout
  it.todo('should include sonner Toaster component so toast notifications can be displayed globally')
})
```
</test_spec>

### Test-Datei: `components/__tests__/sidebar.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Sidebar', () => {
  // AC-3: Alle Projekte + aktives hervorgehoben
  it.todo('should render all projects and highlight the active one')

  // AC-4: Navigation zu anderem Projekt
  it.todo('should navigate to /projects/{id} when clicking another project')

  // AC-5: New-Project-Button
  it.todo('should call createProject and navigate to new project on new-project click')

  // AC-6: Zurueck-Link
  it.todo('should navigate to / when clicking back-to-overview link')
})
```
</test_spec>

### Test-Datei: `components/__tests__/project-list.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ProjectList', () => {
  // AC-9: Projekte als Links, aktives hervorgehoben
  it.todo('should render all projects as links and highlight the active project')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-project-server-actions` | `getProjects` | Server Action | `() => Promise<Project[]>` |
| `slice-03-project-server-actions` | `getProject` | Server Action | `(input: { id: string }) => Promise<Project \| { error: string }>` |
| `slice-03-project-server-actions` | `createProject` | Server Action | `(input: { name: string }) => Promise<{ id, name, createdAt } \| { error: string }>` |
| `slice-04-project-overview-ui` | `ConfirmDialog` | React Component | `<ConfirmDialog title description onConfirm onCancel open />` (fuer spaetere Nutzung im Workspace) |
| `slice-04-project-overview-ui` | `app/page.tsx` | Next.js Page | Root-Page existiert unter `/` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app/projects/[id]/page.tsx` | Next.js Page | Router | Server Component, rendert `/projects/[id]` |
| `app/layout.tsx` | Root Layout | Alle Pages | Layout mit Toaster, umschliesst `{children}` |
| `ProjectList` | React Component | Sidebar, Overview (spaetere Refactoring-Option) | `<ProjectList projects={Project[]} activeProjectId={string} />` |
| `Sidebar` | React Component | Workspace-Sub-Slices | Sidebar mit Projekt-Liste, New-Button, Zurueck-Link |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/projects/[id]/page.tsx` — Workspace Server Component, laedt Projekt via `getProject` + `getProjects`, rendert Sidebar + Main-Platzhalter
- [ ] `app/layout.tsx` — Root Layout mit Toaster (sonner), globale Styles, umschliesst alle Pages
- [ ] `components/sidebar.tsx` — Sidebar Client Component mit `ProjectList`, New-Project-Button und Zurueck-Link
- [ ] `components/project-list.tsx` — Wiederverwendbare Projektliste mit aktivem Highlight fuer Sidebar und potenzielle Overview-Nutzung
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Prompt Area, Parameter Panel, Gallery — kommt in spaeteren Slices (09, 10, 11)
- KEIN Model-Dropdown oder Generate-Button — kommt in Slice 09
- KEINE Rename/Delete-Funktionalitaet in der Sidebar — nur Navigation und New-Project
- KEIN Sidebar-Collapsing oder Responsive-Verhalten — einfache persistente Sidebar
- KEIN `confirm-dialog.tsx` — wurde in Slice 04 erstellt, hier nur als Dependency im Contract

**Technische Constraints:**
- `app/projects/[id]/page.tsx` ist ein Server Component (Data Fetching via `getProject` + `getProjects`)
- `Sidebar` ist ein Client Component (`usePathname` fuer aktive Hervorhebung)
- `ProjectList` kann als Server- oder Client Component implementiert werden, je nach Bedarf fuer `usePathname`
- Toaster via sonner (shadcn/ui Integration) im Root Layout
- Tailwind v4 fuer Styling
- `notFound()` aus `next/navigation` fuer ungueltige Projekt-IDs

**Referenzen:**
- Wireframes: `wireframes.md` → Section "Screen: Project Workspace" (Sidebar-Annotations ①②, "← Overview" Link)
- Architecture: `architecture.md` → Section "Project Structure" (Dateipfade `app/layout.tsx`, `app/projects/[id]/page.tsx`, `components/`)
- Architecture: `architecture.md` → Section "Architecture Layers" (Pages Layer, Server Components vs Client Components)
