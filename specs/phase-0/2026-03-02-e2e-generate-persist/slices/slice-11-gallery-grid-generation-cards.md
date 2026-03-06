# Slice 11: Gallery Grid + Generation Cards

> **Slice 11 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-gallery-grid-generation-cards` |
| **Test** | `pnpm test components/workspace/__tests__/gallery-grid.test.tsx components/workspace/__tests__/generation-card.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-generation-service-actions"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/gallery-grid.test.tsx components/workspace/__tests__/generation-card.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Generations-Daten als Props gemockt, kein DB-Zugriff in Tests) |

---

## Ziel

Masonry-Grid-Galerie und Generation-Card-Komponente implementieren, die alle abgeschlossenen Generierungen eines Projekts anzeigen. Die Galerie ist der zentrale visuelle Bereich des Workspace und bildet die Grundlage fuer Lightbox, Download und Delete in nachfolgenden Slices.

---

## Acceptance Criteria

1) GIVEN ein Projekt mit 5 completed Generierungen
   WHEN `<GalleryGrid>` mit diesen Generierungen gerendert wird
   THEN werden alle 5 Bilder im Masonry-Layout (CSS `columns`) angezeigt

2) GIVEN ein Projekt mit 5 completed Generierungen mit unterschiedlichen `created_at` Timestamps
   WHEN `<GalleryGrid>` gerendert wird
   THEN erscheint die neueste Generierung als erstes Element (Sortierung `created_at DESC`)

3) GIVEN ein Projekt ohne Generierungen (leeres Array)
   WHEN `<GalleryGrid>` gerendert wird
   THEN wird ein Empty State angezeigt mit dem Text "No generations yet. Enter a prompt and hit Generate!"

4) GIVEN eine completed Generation mit `image_url` und `prompt`
   WHEN `<GenerationCard>` gerendert wird
   THEN zeigt die Card ein Thumbnail-Bild (`<img>` oder `<Image>`) mit der `image_url` als Source

5) GIVEN eine `<GenerationCard>` im Default-Zustand
   WHEN der User mit der Maus ueber die Card hovert
   THEN wird ein visueller Hover-State angezeigt (z.B. Overlay, Border-Highlight oder Scale-Effekt)

6) GIVEN eine gerenderte `<GenerationCard>`
   WHEN der User auf die Card klickt
   THEN wird ein `onSelect` Callback mit der Generation-ID aufgerufen (Event-Propagation nach oben fuer Lightbox)

7) GIVEN Generierungen mit Status "pending" oder "failed"
   WHEN `<GalleryGrid>` die Liste filtert
   THEN werden NUR Generierungen mit `status: "completed"` als Cards angezeigt (pending/failed werden ausgefiltert oder separat behandelt)

8) GIVEN ein Projekt mit 20+ completed Generierungen
   WHEN `<GalleryGrid>` gerendert wird
   THEN werden alle Generierungen ohne Virtualisierung gerendert (einfaches CSS-Columns-Layout, keine Lazy-Loading-Pflicht fuer Phase 0)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/gallery-grid.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GalleryGrid', () => {
  // AC-1: Masonry-Layout
  it.todo('should render all completed generations in a CSS columns layout')

  // AC-2: Sortierung neueste oben
  it.todo('should display generations sorted by created_at descending')

  // AC-3: Empty State
  it.todo('should show empty state message when no generations exist')

  // AC-7: Nur completed anzeigen
  it.todo('should only render cards for generations with status completed')

  // AC-8: Alle rendern ohne Virtualisierung
  it.todo('should render all generations without virtualization for 20+ items')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/generation-card.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationCard', () => {
  // AC-4: Thumbnail-Anzeige
  it.todo('should render thumbnail image with image_url as source')

  // AC-5: Hover-State
  it.todo('should apply visual hover state on mouse over')

  // AC-6: Klick-Event
  it.todo('should call onSelect callback with generation ID on click')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | `getGenerations` | Server Action | `(projectId) => Promise<Generation[]>` aus `app/actions/generations.ts` |
| `slice-02` | `Generation` | Type | Generation-Entity mit `id`, `status`, `image_url`, `prompt`, `created_at` aus `lib/db/schema.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GalleryGrid` | React Component | slice-05, slice-10 | `<GalleryGrid generations={Generation[]} onSelectGeneration={(id: string) => void} />` |
| `GenerationCard` | React Component | slice-10, slice-16 | `<GenerationCard generation={Generation} onSelect={(id: string) => void} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/gallery-grid.tsx` -- Masonry Grid Container mit CSS columns, Empty State, Sortierlogik
- [ ] `components/workspace/generation-card.tsx` -- Einzelne Galerie-Card mit Thumbnail, Hover-State, Klick-Handler
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Lightbox/Modal-Logik -- kommt in Slice 12
- KEINE Lightbox-Navigation (Prev/Next) -- kommt in Slice 13
- KEINE Delete-Funktionalitaet -- kommt in Slice 16
- KEINE Download-Funktionalitaet -- kommt in Slice 15
- KEINE Generation-Placeholders (pending/loading) -- kommt in Slice 10
- KEIN Lazy-Loading oder Virtualisierung -- Einfaches CSS-Columns-Layout reicht fuer Phase 0

**Technische Constraints:**
- Client Component (`"use client"`) -- benoetigt onClick-Handler und Hover-States
- Masonry-Layout via CSS `columns` Property (kein JavaScript-Layout-Bibliothek)
- Sortierung der Generierungen nach `created_at DESC` in der Komponente
- `onSelect` Callback propagiert Generation-ID nach oben (Parent entscheidet ueber Lightbox-Oeffnung)

**Referenzen:**
- Architecture: `architecture.md` -> Section "Project Structure" (Pfade `components/workspace/`)
- Architecture: `architecture.md` -> Section "Quality Attributes" (Galerie-Performance: CSS columns)
- Wireframes: `wireframes.md` -> Section "Screen: Project Workspace" (Annotation 11: gallery-grid)
- Wireframes: `wireframes.md` -> Section "State Variations" (`workspace-empty` Empty State Text)
- Discovery: `discovery.md` -> Section "UI Components & States" (`gallery-grid`, `generation-card`)
