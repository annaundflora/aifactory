# Bug: Detail-View nutzt nicht die volle Fensterbreite

**Entdeckt:** 2026-03-13
**Status:** 🔴 Neu
**Priority:** Hoch
**Location:** `app/projects/[id]/page.tsx:34-50`, `components/workspace/workspace-content.tsx:142-153`

---

## Problembeschreibung

Die Canvas-Detail-View nutzt nicht die volle Fensterbreite. Zwei Elemente verbrauchen unnoetig Platz:
1. **WorkspaceHeader** ("Testprojekt" + Kebab-Menu) bleibt sichtbar ueber dem Canvas-Header — es gibt zwei Headers uebereinander
2. **Sidebar** (collapsed, ~48px Projekt-Thumbnails) bleibt sichtbar links

Laut Discovery soll die Detail-View "Fullscreen" sein und die Sidebar "Auto-collapsed" (was zwar der Fall ist, aber trotzdem ~48px belegt).

## Reproduktion

1. Oeffne ein Projekt mit generierten Bildern
2. Klicke auf ein Bild in der Gallery
3. Beobachte: WorkspaceHeader ("Testprojekt") ist sichtbar UEBER dem Canvas-Header (Back-Button, Model-Selector, Undo/Redo)
4. Beobachte: Collapsed Sidebar (Projekt-Thumbnails) ist links weiterhin sichtbar

## Erwartetes Verhalten

- Detail-View sollte die volle Fensterbreite nutzen
- WorkspaceHeader sollte im Detail-View-Modus ausgeblendet sein (Canvas-Header ersetzt ihn)
- Sidebar sollte komplett ausgeblendet oder visuell zurueckgenommen sein

## Tatsaechliches Verhalten

- WorkspaceHeader + Canvas-Header = zwei Headers uebereinander (h-14 + h-12 = 26px verschwendet)
- Sidebar belegt ~48px links, verschiebt den gesamten Canvas-Bereich

## Test-Evidenz

- Screenshot: Detail-View mit sichtbarem "Testprojekt"-Header und Sidebar-Thumbnails
- Code: `page.tsx:41-48` — WorkspaceHeader und WorkspaceContent sind Geschwister in SidebarInset, WorkspaceHeader hat keine Logik zum Ausblenden bei Detail-View
- Code: `workspace-content.tsx:142-153` — Detail-View wird innerhalb des bestehenden Layouts gerendert, nicht als Overlay

## Loesungsansatz

**Option A (minimal):** WorkspaceHeader im Detail-View-Modus ausblenden. WorkspaceContent muesste den `detailViewOpen`-State nach oben kommunizieren (z.B. via Context oder Callback).

**Option B (besser):** Detail-View als Portal oder separates Full-Width-Layout rendern, das ueber Sidebar + Header liegt.

## Naechste Schritte

1. [ ] Entscheiden: Option A (Header ausblenden) oder Option B (Overlay/Portal)
2. [ ] `detailViewOpen`-State nach oben propagieren oder Detail-View als eigenstaendiges Layout
3. [ ] Sidebar-Verhalten bei Detail-View klaeren (komplett ausblenden vs. collapsed lassen)
