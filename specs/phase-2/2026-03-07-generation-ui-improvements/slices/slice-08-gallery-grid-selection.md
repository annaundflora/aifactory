# Slice 08: GalleryHeader + GalleryGrid Selection Mode

> **Slice 08 von N** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-gallery-grid-selection` |
| **Test** | `pnpm test components/workspace/gallery-header components/workspace/gallery-grid` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-selection-context", "slice-07-generation-card-checkbox"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/gallery-header components/workspace/gallery-grid` |
| **Integration Command** | `pnpm test components/workspace/gallery-header components/workspace/gallery-grid` |
| **Acceptance Command** | `pnpm test components/workspace/gallery-header components/workspace/gallery-grid` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`GalleryHeader` ist eine neue Komponente, die Titel, Bild-Anzahl und einen Favoriten-Filter-Toggle (Star-Icon) rendert. `gallery-grid.tsx` wird modifiziert, um den Selection-Mode aus `SelectionContext` zu lesen: im Selection-Mode sind Checkboxen auf allen Karten sichtbar und das Grid erhaelt dynamisches Bottom-Padding, wenn die Action-Bar aktiv ist.

---

## Acceptance Criteria

1) GIVEN `GalleryHeader` mit `title="Mein Projekt"` und `imageCount={24}`
   WHEN die Komponente gerendert wird
   THEN ist der Text "Mein Projekt" sichtbar und der Text "(24)" oder "24 images" (o.ae. Zaehler) sichtbar

2) GIVEN `GalleryHeader` mit `favFilterActive={false}` und `onFavFilterToggle` Callback
   WHEN der User auf das Star-Icon klickt
   THEN wird `onFavFilterToggle` einmal aufgerufen

3) GIVEN `GalleryHeader` mit `favFilterActive={false}`
   WHEN die Komponente gerendert wird
   THEN hat das Star-Icon keinen "aktiv"-Zustand (kein `filled`/`text-primary` o.ae.)

4) GIVEN `GalleryHeader` mit `favFilterActive={true}`
   WHEN die Komponente gerendert wird
   THEN hat das Star-Icon den "aktiv"-Zustand (CSS-Klasse `text-primary` oder `fill-current` o.ae.)

5) GIVEN `GalleryGrid` mit `isSelecting === false` im SelectionContext
   WHEN die Komponente gerendert wird
   THEN hat das Grid-Root-Element kein zusaetzliches Bottom-Padding (kein `pb-*` fuer Action-Bar-Hoehe)

6) GIVEN `GalleryGrid` mit `isSelecting === true` im SelectionContext
   WHEN die Komponente gerendert wird
   THEN hat das Grid-Root-Element dynamisches Bottom-Padding (CSS-Klasse `pb-24` oder aequivalent fuer Action-Bar-Freiraum)

7) GIVEN `GalleryGrid` mit `isSelecting === true` und mehreren `GenerationCard`-Kindern
   WHEN die Komponente gerendert wird
   THEN sind alle `GenerationCard`-Instanzen im DOM vorhanden (kein Filtern/Ausblenden im Selection-Mode)

8) GIVEN `GalleryGrid` mit `isSelecting === false`
   WHEN eine `GenerationCard` geklickt wird
   THEN wird der `onSelectGeneration`-Callback mit der ID der Karte aufgerufen (Lightbox-Flow unveraendert)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> `useSelection` muss gemockt werden; `SelectionProvider` ist kein Pflicht-Ancestor im Test.

### Test-Datei: `components/workspace/__tests__/gallery-header.test.tsx`

<test_spec>
```typescript
// AC-1: Titel und Bild-Anzahl werden gerendert
it.todo('should render title and image count')

// AC-2: Klick auf Star-Icon ruft onFavFilterToggle auf
it.todo('should call onFavFilterToggle when star icon is clicked')

// AC-3: Star-Icon ohne aktiv-Zustand wenn favFilterActive ist false
it.todo('should render star icon without active state when favFilterActive is false')

// AC-4: Star-Icon mit aktiv-Zustand wenn favFilterActive ist true
it.todo('should render star icon with active state when favFilterActive is true')
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/gallery-grid.test.tsx`

<test_spec>
```typescript
// AC-5: Kein Bottom-Padding wenn isSelecting false
it.todo('should not apply bottom-padding class when isSelecting is false')

// AC-6: Bottom-Padding vorhanden wenn isSelecting true
it.todo('should apply bottom-padding class when isSelecting is true')

// AC-7: Alle Karten bleiben sichtbar im Selection-Mode
it.todo('should render all generation cards in selection mode without filtering')

// AC-8: onSelectGeneration wird aufgerufen wenn isSelecting false und Karte geklickt
it.todo('should call onSelectGeneration with card id when clicked in default mode')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-selection-context` | `useSelection` | React Hook | `import { useSelection } from '@/lib/selection-state'` — `isSelecting` wird in `gallery-grid.tsx` genutzt |
| `slice-07-generation-card-checkbox` | `GenerationCard` | React Component | Signatur `GenerationCard({ generation, onSelect })` bleibt unveraendert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GalleryHeader` | React Component | `workspace-content.tsx` (spaetere Slices) | `GalleryHeader({ title: string, imageCount: number, favFilterActive: boolean, onFavFilterToggle: () => void })` |
| `GalleryGrid` (modifiziert) | React Component | `workspace-content.tsx` (spaetere Slices) | bestehende Props-Signatur unveraendert — liest `isSelecting` intern aus Context |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/gallery-header.tsx` — Neue Komponente: Titel, Bild-Anzahl, Favoriten-Filter-Toggle (Star-Icon, active/inactive State)
- [ ] `components/workspace/gallery-grid.tsx` — Modifiziert: liest `isSelecting` aus `useSelection`, dynamisches Bottom-Padding im Selection-Mode
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- `GalleryHeader` verwaltet keinen eigenen Favoriten-State — `favFilterActive` und `onFavFilterToggle` kommen als Props von aussen
- Kein Einbinden von `GalleryHeader` in `workspace-content.tsx` — Integration folgt in einem spaeteren Slice
- Keine `FloatingActionBar`-Komponente in diesem Slice (eigener Slice)
- `gallery-grid.tsx` aendert keine Props-Signatur — kein Breaking Change

**Technische Constraints:**
- `GalleryHeader`: `"use client"` wenn interaktiv, sonst Server Component moeglich — je nach Implementierung
- `gallery-grid.tsx`: `"use client"` bleibt (liest Context mit `useSelection`)
- Star-Icon aus `lucide-react` (`Star`-Icon — architecture.md → Section "Integrations")
- Bottom-Padding-Wert muss der Hoehe der `FloatingActionBar` entsprechen (Richtwert: `pb-24`)

**Referenzen:**
- Wireframes: `wireframes.md` → Section "Gallery with Bulk Select" — Default State, Selecting State (Annotationen ①, ③)
- Architecture: `architecture.md` → Section "Migration Map" — `gallery-grid.tsx` (Existing Files Modified)
- Architecture: `architecture.md` → Section "New Files" — `gallery-header.tsx`
- Architecture: `architecture.md` → Section "Component Architecture" — Component Tree (GalleryHeader, GalleryGrid)
