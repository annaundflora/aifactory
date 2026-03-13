# Slice 5: Detail-View Shell (Layout + Mounting)

> **Slice 5 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-detail-view-shell` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-detail-view.test.tsx components/canvas/__tests__/canvas-header.test.tsx components/workspace/__tests__/workspace-content-detail.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-canvas-detail-context"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-detail-view.test.tsx components/canvas/__tests__/canvas-header.test.tsx components/workspace/__tests__/workspace-content-detail.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__ components/workspace/__tests__/workspace-content-detail.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Neue `CanvasDetailView`-Komponente als Fullscreen-Shell mit 3-Spalten-Layout (Toolbar-Slot, Canvas-Bereich, Chat-Slot) erstellen. `WorkspaceContent` erhaelt `detailViewOpen`-State und rendert `CanvasDetailView` statt Gallery bei aktivem Detail-State. Back-Button und ESC-Shortcut fuehren zurueck zur Gallery.

---

## Acceptance Criteria

1) GIVEN ein User auf der Gallery-View mit mindestens einem completed Bild
   WHEN der User auf ein Gallery-Bild (GenerationCard) klickt
   THEN verschwindet die Gallery (PromptArea + GalleryGrid) und die `CanvasDetailView` wird fullscreen innerhalb des Workspace-Bereichs gerendert

2) GIVEN die `CanvasDetailView` ist sichtbar
   WHEN das Layout geprueft wird
   THEN besteht es aus 3 Spalten: Toolbar-Slot links (48px breit), Canvas-Bereich mitte (flex: 1), Chat-Slot rechts (collapsible, initial sichtbar)

3) GIVEN die `CanvasDetailView` ist sichtbar
   WHEN der Header geprueft wird
   THEN enthaelt er einen Back-Button (links), einen leeren Model-Selector-Slot (mitte) und leere Undo/Redo-Slots (rechts)

4) GIVEN die `CanvasDetailView` ist sichtbar
   WHEN der User den Back-Button im Header klickt
   THEN schliesst die Detail-View und die Gallery-View (PromptArea + GalleryGrid) wird wieder angezeigt

5) GIVEN die `CanvasDetailView` ist sichtbar und kein Input/Textarea hat Fokus
   WHEN der User die ESC-Taste drueckt
   THEN schliesst die Detail-View und die Gallery-View wird wieder angezeigt

6) GIVEN die `CanvasDetailView` ist sichtbar und ein Input/Textarea hat Fokus
   WHEN der User die ESC-Taste drueckt
   THEN bleibt die Detail-View geoeffnet (ESC wird nicht abgefangen)

7) GIVEN der User klickt auf ein Gallery-Bild mit `id: "gen-abc-123"`
   WHEN die `CanvasDetailView` geoeffnet wird
   THEN wird der `CanvasDetailProvider` mit `initialGenerationId: "gen-abc-123"` initialisiert

8) GIVEN die `CanvasDetailView` ist sichtbar
   WHEN der Canvas-Bereich (mittlere Spalte) geprueft wird
   THEN zeigt er das Bild der aktuellen `currentGenerationId` aus dem Context zentriert an (max-fit)

9) GIVEN `WorkspaceContent` mit `detailViewOpen: false`
   WHEN der State geprueft wird
   THEN sind PromptArea, FilterChips, GalleryGrid und PendingPlaceholders sichtbar und keine `CanvasDetailView` gerendert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-detail-view.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView', () => {
  // AC-2: 3-Spalten-Layout (Toolbar-Slot 48px, Canvas flex:1, Chat-Slot)
  it.todo('should render 3-column layout with toolbar slot, canvas area, and chat slot')

  // AC-8: Aktuelles Bild zentriert im Canvas-Bereich
  it.todo('should display the current generation image centered in the canvas area')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-header.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasHeader', () => {
  // AC-3: Header enthaelt Back-Button, Model-Selector-Slot, Undo/Redo-Slots
  it.todo('should render back button, model selector slot, and undo/redo slots')

  // AC-4: Back-Button Klick ruft onBack-Callback auf
  it.todo('should call onBack when back button is clicked')

  // AC-5: ESC-Taste ruft onBack auf wenn kein Input fokussiert
  it.todo('should call onBack when Escape is pressed and no input is focused')

  // AC-6: ESC-Taste wird ignoriert wenn Input fokussiert
  it.todo('should not call onBack when Escape is pressed and an input is focused')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/workspace-content-detail.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('WorkspaceContent — Detail-View integration', () => {
  // AC-1: Klick auf Gallery-Bild oeffnet Detail-View, Gallery verschwindet
  it.todo('should show CanvasDetailView and hide gallery when a generation card is clicked')

  // AC-7: CanvasDetailProvider wird mit korrekter initialGenerationId initialisiert
  it.todo('should initialize CanvasDetailProvider with the clicked generation id')

  // AC-9: Gallery-View sichtbar wenn detailViewOpen false
  it.todo('should show PromptArea and GalleryGrid when detail view is not open')

  // AC-4+5: Back/ESC schliesst Detail-View und zeigt Gallery
  it.todo('should close detail view and show gallery when back is triggered')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `CanvasDetailProvider` | React Context Provider | `<CanvasDetailProvider initialGenerationId={string}>` wraps CanvasDetailView |
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `() => { state, dispatch }` fuer currentGenerationId-Zugriff |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasDetailView` | React Component | `slice-06` bis `slice-15` | `<CanvasDetailView generation={Generation} allGenerations={Generation[]} onBack={() => void} />` |
| `CanvasHeader` | React Component | `slice-14`, `slice-15` | `<CanvasHeader onBack={() => void}>` mit children-Slots fuer Model-Selector und Undo/Redo |
| Toolbar-Slot (left) | Layout Slot | `slice-07-toolbar-ui` | `children` Prop oder benannter Slot, 48px breit |
| Chat-Slot (right) | Layout Slot | `slice-09-chat-panel-ui` | `children` Prop oder benannter Slot, collapsible |
| `detailViewOpen` State | WorkspaceContent State | `slice-18-lightbox-removal` | Boolean-State der Gallery/Detail-View toggelt |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` — Layout-Shell mit 3-Spalten (Toolbar-Slot, Canvas-Bereich, Chat-Slot) und Bild-Anzeige
- [ ] `components/canvas/canvas-header.tsx` — Header mit Back-Button, ESC-Shortcut-Handler, Slots fuer Model-Selector und Undo/Redo
- [ ] `components/workspace/workspace-content.tsx` — `detailViewOpen`-State und `selectedGenerationId` statt Lightbox, bedingtes Rendern von CanvasDetailView vs. Gallery
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE animierte Transition (das ist Slice 6)
- KEINE Toolbar-Icons rendern (nur leerer Slot, Slice 7)
- KEINE Chat-Panel-Inhalte rendern (nur leerer Slot, Slice 9)
- KEINE Undo/Redo-Logik oder Buttons (nur leere Slots im Header, Slice 15)
- KEINE Model-Selector-Logik (nur leerer Slot im Header, Slice 14)
- KEINE Sibling-Thumbnails oder Prev/Next (Slice 8)
- KEINE Lightbox-Entfernung — bestehende Lightbox-Imports bleiben vorerst (Slice 18)
- KEINE Aenderung am Polling-Mechanismus in WorkspaceContent

**Technische Constraints:**
- `"use client"` Direktive fuer beide neuen Komponenten
- `CanvasDetailProvider` aus `lib/canvas-detail-context.tsx` (Slice 3) wrappen
- ESC-Handler: `useEffect` mit `keydown`-Listener, pruefen ob `document.activeElement` ein Input/Textarea ist
- Canvas-Bereich: `Next/Image` oder `<img>` mit `object-contain` fuer max-fit Darstellung
- Toolbar-Slot: feste Breite 48px, Chat-Slot: collapsible (Initial-Breite wird in Slice 9 definiert)

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Architecture Layers" (Layout-Verantwortlichkeiten)
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` → Screen "Canvas-Detail-View (Idle)" fuer Layout-Referenz
- Discovery: `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md` → Section "UI Layout & Context" (Screen: Canvas-Detail-View)
- Migration Map: `architecture.md` → Section "Migration Map" (workspace-content.tsx Aenderungen)
- Bestehender Code: `components/workspace/workspace-content.tsx` → Lightbox-State-Pattern als Migrationspunkt
