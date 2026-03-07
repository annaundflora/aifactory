# Slice 03: shadcn Sidebar Setup

> **Slice 3 von 21** fuer `Quality Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-shadcn-sidebar-setup` |
| **Test** | `pnpm test components/ui/__tests__/sidebar.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/ui/__tests__/sidebar.test.tsx` |
| **Integration Command** | `n/a` |
| **Acceptance Command** | `n/a` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

shadcn Sidebar-Komponente via CLI installieren und sicherstellen, dass alle Sidebar-Primitives (`SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarContent`, etc.) importierbar sind und fehlerfrei kompilieren. Dies ist die Grundlage fuer Slice 04 (Content Migration) und Slice 05 (Layout Integration).

---

## Acceptance Criteria

1) GIVEN das Projekt ohne installierte shadcn Sidebar
   WHEN `npx shadcn@latest add sidebar` ausgefuehrt wird
   THEN existiert die Datei `components/ui/sidebar.tsx` und enthaelt exportierte Komponenten

2) GIVEN die installierte Sidebar-Komponente
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN kompiliert das Projekt fehlerfrei (exit code 0)

3) GIVEN die installierte Sidebar-Komponente
   WHEN `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` importiert werden
   THEN sind alle 10 Primitives als Named Exports verfuegbar und nicht `undefined`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/ui/__tests__/sidebar.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('shadcn Sidebar Setup', () => {
  // AC-1: Sidebar-Datei existiert nach Installation
  it.todo('should have sidebar.tsx file with exported components')

  // AC-2: TypeScript-Kompilierung fehlerfrei
  it.todo('should compile without TypeScript errors')

  // AC-3: Alle 10 Primitives importierbar
  it.todo('should export SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SidebarProvider` | Component | slice-04, slice-05 | `SidebarProvider: React.FC<{ children: ReactNode }>` |
| `Sidebar` | Component | slice-04 | `Sidebar: React.FC<SidebarProps>` |
| `SidebarTrigger` | Component | slice-05 | `SidebarTrigger: React.FC` |
| `SidebarContent` | Component | slice-04 | `SidebarContent: React.FC<{ children: ReactNode }>` |
| `SidebarMenu` | Component | slice-04 | `SidebarMenu: React.FC<{ children: ReactNode }>` |
| `SidebarMenuItem` | Component | slice-04 | `SidebarMenuItem: React.FC<{ children: ReactNode }>` |
| `SidebarMenuButton` | Component | slice-04 | `SidebarMenuButton: React.FC<{ children: ReactNode }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/sidebar.tsx` -- shadcn Sidebar-Komponente (generiert durch `npx shadcn@latest add sidebar`)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Rewrite der bestehenden `components/sidebar.tsx` (das ist Slice 04)
- KEIN Layout-Umbau der Workspace-Seite (das ist Slice 05)
- KEINE Sidebar-Inhalte/Content-Migration
- NUR Installation und Verfuegbarkeitspruefung der shadcn Primitives

**Technische Constraints:**
- Installation via `npx shadcn@latest add sidebar` (offizielle shadcn CLI)
- shadcn CLI Version 3.8.5 (wie im Projekt installiert)
- Generierte Datei darf NICHT manuell editiert werden in diesem Slice

**Referenzen:**
- Architecture: `architecture.md` -> Section "shadcn Sidebar Installation"
- Architecture: `architecture.md` -> Section "Constraints & Integrations" (shadcn/ui 3.8.5)
- Discovery: `discovery.md` -> Section "New Patterns" (shadcn Sidebar)
