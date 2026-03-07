# Slice 05: Sidebar Layout Integration

> **Slice 5 von 21** fuer `Quality Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-sidebar-layout-integration` |
| **Test** | `pnpm test app/projects/__tests__/workspace-layout.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-sidebar-content-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/projects/__tests__/workspace-layout.test.tsx` |
| **Integration Command** | `n/a` |
| **Acceptance Command** | `n/a` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Workspace-Layout (`app/projects/[id]/page.tsx`) in `SidebarProvider` wrappen, damit die shadcn Sidebar (aus Slice 04) korrekt funktioniert. Mobile-Hamburger-Button im Header platzieren. Sidebar oeffnet sich auf Mobile als Overlay-Drawer. Desktop: Sidebar einklappbar mit Keyboard-Shortcut (Ctrl+B, shadcn built-in).

---

## Acceptance Criteria

1) GIVEN die Workspace-Seite `/projects/[id]`
   WHEN die Seite gerendert wird
   THEN ist das gesamte Layout in einem `SidebarProvider` gewrapped und die Sidebar wird ueber die shadcn `Sidebar`-Komponente gerendert

2) GIVEN ein Desktop-Viewport (>= 768px)
   WHEN der User den Keyboard-Shortcut `Ctrl+B` drueckt
   THEN toggled die Sidebar zwischen expanded und collapsed State

3) GIVEN ein Desktop-Viewport mit expandierter Sidebar
   WHEN der User den `SidebarTrigger` im Header klickt
   THEN kollabiert die Sidebar auf Icon-Mode

4) GIVEN ein Mobile-Viewport (< 768px)
   WHEN die Seite gerendert wird
   THEN ist die Sidebar versteckt und ein Hamburger-Button (SidebarTrigger) ist im Header sichtbar

5) GIVEN ein Mobile-Viewport mit geschlossener Sidebar
   WHEN der User den Hamburger-Button im Header klickt
   THEN oeffnet sich die Sidebar als Overlay-Drawer von links mit dimmed Backdrop

6) GIVEN ein Mobile-Viewport mit geoeffneter Sidebar
   WHEN der User auf den dimmed Backdrop klickt
   THEN schliesst sich die Sidebar

7) GIVEN die Workspace-Seite mit SidebarProvider
   WHEN die Sidebar kollabiert oder expandiert wird
   THEN passt sich der Main-Content-Bereich (Header + WorkspaceContent) dynamisch an die verfuegbare Breite an

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/projects/__tests__/workspace-layout.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Sidebar Layout Integration', () => {
  // AC-1: SidebarProvider wrapping
  it.todo('should wrap workspace layout in SidebarProvider with Sidebar component')

  // AC-2: Keyboard-Shortcut Ctrl+B
  it.todo('should toggle sidebar on Ctrl+B keypress on desktop viewport')

  // AC-3: SidebarTrigger im Header kollabiert Sidebar
  it.todo('should collapse sidebar when SidebarTrigger in header is clicked')

  // AC-4: Mobile Hamburger-Button sichtbar
  it.todo('should show hamburger SidebarTrigger in header on mobile viewport')

  // AC-5: Mobile Sidebar oeffnet als Overlay-Drawer
  it.todo('should open sidebar as overlay drawer on mobile hamburger click')

  // AC-6: Mobile Backdrop schliesst Sidebar
  it.todo('should close sidebar overlay when dimmed backdrop is clicked')

  // AC-7: Main-Content passt sich dynamisch an
  it.todo('should adjust main content area width when sidebar state changes')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03 | `SidebarProvider` | Component | Import aus `@/components/ui/sidebar` |
| slice-03 | `SidebarTrigger` | Component | Import aus `@/components/ui/sidebar` |
| slice-04 | `Sidebar` (rewritten) | Component | Import aus `@/components/sidebar`, akzeptiert `projects: Project[]` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Layout mit SidebarProvider | Page-Wrapper | alle Workspace-Slices | `SidebarProvider > Sidebar + SidebarInset` |
| Mobile-Hamburger im Header | UI-Element | n/a | `SidebarTrigger` im Header-Bereich |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/projects/[id]/page.tsx` -- SidebarProvider-Wrapper, SidebarTrigger im Header, Layout-Anpassung fuer shadcn Sidebar
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `components/sidebar.tsx` (Slice 04 Deliverable)
- KEINE Aenderungen an `components/ui/sidebar.tsx` (Slice 03 Deliverable)
- KEINE neuen Server Actions oder DB-Aenderungen
- KEIN Prompt-Area-Umbau oder Gallery-Aenderungen
- NUR Layout-Wrapping und Header-Anpassung

**Technische Constraints:**
- `SidebarProvider` muss `WorkspaceStateProvider` umschliessen oder daneben stehen (nicht innerhalb)
- `SidebarTrigger` im Header: auf Mobile als Hamburger-Icon sichtbar, auf Desktop als Collapse-Toggle
- shadcn Sidebar nutzt `SidebarInset` fuer den Main-Content-Bereich (statt manueller `flex`-Aufteilung)
- Keyboard-Shortcut `Ctrl+B` ist shadcn Sidebar built-in (kein eigener Code noetig)
- Bestehendes `flex h-screen` Layout durch shadcn-konformes Layout ersetzen

**Referenzen:**
- Architecture: `architecture.md` -> Section "shadcn Sidebar Installation" (SidebarProvider, SidebarTrigger)
- Architecture: `architecture.md` -> Section "Migration Map" -> #12 (Workspace Layout)
- Wireframes: `wireframes.md` -> "Workspace (Sidebar Expanded)", "Workspace (Sidebar Collapsed)", "Workspace (Mobile)"
- Discovery: `discovery.md` -> Flow 8 (Sidebar einklappen), UI Layout Section
