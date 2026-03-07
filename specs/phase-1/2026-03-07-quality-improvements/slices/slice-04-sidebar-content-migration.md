# Slice 04: Sidebar Content Migration

> **Slice 4 von 21** fuer `Quality Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-sidebar-content-migration` |
| **Test** | `pnpm test components/__tests__/sidebar.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-shadcn-sidebar-setup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/__tests__/sidebar.test.tsx` |
| **Integration Command** | `n/a` |
| **Acceptance Command** | `n/a` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Bestehende Sidebar-Inhalte (Projektliste, "New Project"-Button, "Back to Overview"-Link) in die shadcn Sidebar-Primitives migrieren. Collapse-Funktion mit Icon-Mode (Projekt-Initialen) implementieren. Cookie-Persistierung des Collapse-States nutzen (shadcn built-in).

---

## Acceptance Criteria

1) GIVEN die Sidebar im expanded State
   WHEN der User die Sidebar betrachtet
   THEN zeigt sie den Header "Projects" mit einem "+"-Button, eine scrollbare Projektliste und einen "Back to Overview"-Link im Footer

2) GIVEN eine Projektliste mit mindestens 2 Projekten (z.B. "Eagle Logos", "POD Designs")
   WHEN der User auf einen Projektnamen klickt
   THEN navigiert der Browser zu `/projects/{projectId}` und das aktive Projekt ist visuell hervorgehoben

3) GIVEN die Sidebar im expanded State
   WHEN der User den Collapse-Trigger betaetigt
   THEN kollabiert die Sidebar auf Icon-Mode und zeigt pro Projekt den ersten Buchstaben des Namens als Initiale (z.B. "E" fuer "Eagle Logos")

4) GIVEN die Sidebar im collapsed (Icon-Mode) State
   WHEN der User ueber eine Projekt-Initiale hovert
   THEN erscheint ein Tooltip mit dem vollstaendigen Projektnamen

5) GIVEN die Sidebar im collapsed State
   WHEN der User den Expand-Trigger betaetigt
   THEN expandiert die Sidebar zurueck auf volle Breite mit Projektliste

6) GIVEN der User kollabiert die Sidebar und laedt die Seite neu (Page Reload)
   WHEN die Seite vollstaendig geladen ist
   THEN ist die Sidebar weiterhin im collapsed State (Cookie-Persistierung)

7) GIVEN der User klickt den "+"-Button in der Sidebar
   WHEN die Server Action `createProject` erfolgreich zurueckgibt
   THEN navigiert der Browser zum neuen Projekt unter `/projects/{newId}` und die Projektliste aktualisiert sich

8) GIVEN ein Viewport unter 768px Breite (Mobile)
   WHEN der User den Hamburger-Button/SidebarTrigger betaetigt
   THEN oeffnet sich die Sidebar als Overlay-Drawer von links mit dimmed Backdrop

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/__tests__/sidebar.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Sidebar Content Migration', () => {
  // AC-1: Expanded Sidebar zeigt Header, Projektliste, Footer
  it.todo('should render Projects header with new-project button, project list, and back-to-overview link')

  // AC-2: Projekt-Navigation und Active-State
  it.todo('should navigate to project page and highlight active project')

  // AC-3: Collapse auf Icon-Mode mit Initialen
  it.todo('should collapse to icon-mode showing project initials')

  // AC-4: Tooltip bei Hover ueber Initialen
  it.todo('should show tooltip with full project name on initial hover')

  // AC-5: Expand zurueck auf volle Breite
  it.todo('should expand back to full width with project list')

  // AC-6: Cookie-Persistierung des Collapse-States
  it.todo('should persist collapsed state across page reload via cookie')

  // AC-7: Neues Projekt erstellen
  it.todo('should create new project via server action and navigate to it')

  // AC-8: Mobile Overlay-Drawer
  it.todo('should open as overlay drawer on mobile viewport')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03 | `SidebarProvider` | Component | Import aus `@/components/ui/sidebar` |
| slice-03 | `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarFooter` | Component | Import aus `@/components/ui/sidebar` |
| slice-03 | `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` | Component | Import aus `@/components/ui/sidebar` |
| slice-03 | `SidebarTrigger` | Component | Import aus `@/components/ui/sidebar` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Sidebar` (rewritten) | Component | Layout/Page-Integration | `Sidebar: FC<{ projects: Project[] }>` |
| `ProjectList` (adapted) | Component | Sidebar | `ProjectList: FC<{ projects: Project[], activeProjectId?: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/sidebar.tsx` -- Rewrite: shadcn Sidebar-Primitives nutzen, Collapse-/Icon-Mode implementieren
- [ ] `components/project-list.tsx` -- Anpassung fuer SidebarMenu-Integration (SidebarMenuItem/SidebarMenuButton statt ul/li)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Layout-Umbau der Workspace-Seite (SidebarProvider-Wrapping ist ein separater Slice)
- KEINE neuen Server Actions oder DB-Aenderungen
- KEINE Aenderung an der `components/ui/sidebar.tsx` (shadcn-generierte Datei aus Slice 03)
- KEIN Mobile-Hamburger-Button im Header (wird beim Layout-Integration-Slice platziert)

**Technische Constraints:**
- Sidebar nutzt `collapsible="icon"` Prop fuer Icon-Mode
- Projekt-Initialen: erster Buchstabe von `project.name`, uppercase
- Tooltip via shadcn `Tooltip` Komponente (falls installiert) oder natives `title`-Attribut
- Cookie-Persistierung ist shadcn Sidebar built-in (kein eigener Code noetig)
- Bestehende `data-testid`-Attribute (`sidebar-new-project`, `sidebar-back-to-overview`, `sidebar-project-list`) beibehalten

**Referenzen:**
- Architecture: `architecture.md` -> Section "shadcn Sidebar Installation" (verfuegbare Primitives)
- Architecture: `architecture.md` -> Section "Migration Map" -> #5 (Custom Sidebar -> shadcn Sidebar)
- Wireframes: `wireframes.md` -> "Workspace (Sidebar Expanded)" und "Workspace (Sidebar Collapsed)"
- Discovery: `discovery.md` -> Flow 8 (Sidebar einklappen)
