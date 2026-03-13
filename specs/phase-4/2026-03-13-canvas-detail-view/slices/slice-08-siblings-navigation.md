# Slice 8: Siblings + Prev/Next Navigation

> **Slice 8 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-siblings-navigation` |
| **Test** | `pnpm test components/canvas/__tests__/sibling-thumbnails.test.tsx components/canvas/__tests__/canvas-navigation.test.tsx components/canvas/__tests__/canvas-image.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-get-siblings-action", "slice-05-detail-view-shell"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/sibling-thumbnails.test.tsx components/canvas/__tests__/canvas-navigation.test.tsx components/canvas/__tests__/canvas-image.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/sibling-thumbnails.test.tsx components/canvas/__tests__/canvas-navigation.test.tsx components/canvas/__tests__/canvas-image.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Sibling-Thumbnails und Prev/Next-Navigation fuer die Canvas-Detail-View erstellen. Siblings zeigen alle Bilder derselben Batch-Generierung als horizontale Thumbnail-Reihe unter dem Hauptbild. Prev/Next-Buttons navigieren durch alle Gallery-Bilder in neueste-zuerst-Reihenfolge. Das `CanvasImage`-Komponente zeigt das aktuelle Hauptbild zentriert mit Loading- und Error-States.

---

## Acceptance Criteria

1) GIVEN eine Generation mit `batchId: "batch-xyz"` die 3 completed Siblings hat
   WHEN die Detail-View fuer diese Generation geoeffnet wird
   THEN rendert `SiblingThumbnails` eine horizontale Reihe mit 3 Thumbnails, wobei das aktuelle Bild visuell hervorgehoben ist (z.B. Ring/Border)

2) GIVEN die Sibling-Thumbnails zeigen 3 Bilder und das mittlere ist aktiv
   WHEN der User auf den ersten Thumbnail klickt
   THEN wird `currentGenerationId` im CanvasDetailContext auf die ID des angeklickten Siblings gesetzt und das Hauptbild wechselt

3) GIVEN eine Generation mit `batchId: null` (Einzelbild-Generierung)
   WHEN die Detail-View geoeffnet wird
   THEN wird keine Sibling-Thumbnail-Row gerendert

4) GIVEN die Detail-View zeigt Bild 5 von 20 Gallery-Bildern (neueste zuerst)
   WHEN der User den Next-Button (rechts) klickt
   THEN wechselt das Hauptbild zu Bild 6 (naechst-aelteres) und Siblings aktualisieren sich fuer die neue batchId

5) GIVEN die Detail-View zeigt das erste Gallery-Bild (neuestes)
   WHEN die Navigation-Buttons geprueft werden
   THEN ist der Prev-Button (links) versteckt/nicht gerendert und der Next-Button sichtbar

6) GIVEN die Detail-View zeigt das letzte Gallery-Bild (aeltestes)
   WHEN die Navigation-Buttons geprueft werden
   THEN ist der Next-Button (rechts) versteckt/nicht gerendert und der Prev-Button sichtbar

7) GIVEN nur ein einziges Bild in der Gallery
   WHEN die Detail-View geoeffnet wird
   THEN sind beide Prev/Next-Buttons versteckt

8) GIVEN die Detail-View ist aktiv
   WHEN das `CanvasImage`-Komponente geprueft wird
   THEN zeigt es das Bild der `currentGenerationId` zentriert mit `object-contain` (max-fit) an

9) GIVEN das Bild-Loading ist noch nicht abgeschlossen
   WHEN der Loading-State aktiv ist
   THEN zeigt `CanvasImage` einen Loading-Indicator (z.B. Skeleton/Spinner)

10) GIVEN die Bild-URL ist ungueltig oder das Laden schlaegt fehl
    WHEN der Error-State eintritt
    THEN zeigt `CanvasImage` einen Fehler-State (z.B. Placeholder-Icon mit Fehlermeldung)

11) GIVEN der User navigiert via Prev/Next zu einem neuen Bild
    WHEN der Bildwechsel stattfindet
    THEN werden keine Pfeiltasten-Shortcuts verwendet — nur Maus-Klick auf die Buttons navigiert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/sibling-thumbnails.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SiblingThumbnails', () => {
  // AC-1: Rendert Thumbnail-Row mit hervorgehobenem aktivem Bild
  it.todo('should render horizontal thumbnail row with active image highlighted')

  // AC-2: Klick auf Thumbnail wechselt currentGenerationId
  it.todo('should update currentGenerationId when a sibling thumbnail is clicked')

  // AC-3: Keine Thumbnail-Row bei null batchId
  it.todo('should not render thumbnail row when batchId is null')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-navigation.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasNavigation', () => {
  // AC-4: Next-Button navigiert zum naechsten Gallery-Bild
  it.todo('should navigate to next gallery image when next button is clicked')

  // AC-5: Prev-Button versteckt beim ersten Bild
  it.todo('should hide prev button when viewing the first (newest) image')

  // AC-6: Next-Button versteckt beim letzten Bild
  it.todo('should hide next button when viewing the last (oldest) image')

  // AC-7: Beide Buttons versteckt bei einzelnem Bild
  it.todo('should hide both buttons when gallery has only one image')

  // AC-11: Keine Pfeiltasten-Shortcuts fuer Navigation
  it.todo('should not respond to arrow key presses for navigation')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-image.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasImage', () => {
  // AC-8: Zeigt aktuelles Bild zentriert mit object-contain
  it.todo('should display current generation image centered with object-contain')

  // AC-9: Loading-State zeigt Indicator
  it.todo('should show loading indicator while image is loading')

  // AC-10: Error-State zeigt Fehler-Placeholder
  it.todo('should show error placeholder when image fails to load')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-04-get-siblings-action` | `getSiblingGenerations()` | Server Action | `(batchId: string \| null) => Promise<Generation[]>` |
| `slice-05-detail-view-shell` | `CanvasDetailView` | React Component | Layout-Shell mit Canvas-Bereich (mittlere Spalte) |
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `() => { state: { currentGenerationId }, dispatch }` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SiblingThumbnails` | React Component | `slice-05` (Integration in Canvas-Bereich) | `<SiblingThumbnails batchId={string \| null} currentGenerationId={string} onSelect={(id: string) => void} />` |
| `CanvasNavigation` | React Component | `slice-05` (Integration in Canvas-Bereich) | `<CanvasNavigation allGenerations={Generation[]} currentGenerationId={string} onNavigate={(id: string) => void} />` |
| `CanvasImage` | React Component | `slice-14` (Loading-Overlay), `slice-05` (Ersetzt inline Bild-Anzeige) | `<CanvasImage generation={Generation} isLoading={boolean} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/sibling-thumbnails.tsx` — Horizontale Thumbnail-Row, laedt Siblings via `getSiblingGenerations()`, aktives Bild hervorgehoben, Klick dispatcht SET_CURRENT_IMAGE
- [ ] `components/canvas/canvas-navigation.tsx` — Prev/Next-Buttons links/rechts vom Canvas, Gallery-Index-Logik, Buttons versteckt bei erstem/letztem Bild
- [ ] `components/canvas/canvas-image.tsx` — Zentriertes Hauptbild mit object-contain, Loading-Indicator, Error-Placeholder
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Keyboard-Shortcut fuer Prev/Next (nur Maus-Klick auf Buttons, keine Pfeiltasten — siehe Discovery Business Rules)
- KEINE Loading-Overlay fuer In-Place-Generation (das ist Slice 14, `CanvasImage` hat nur eigenen Bild-Lade-State)
- KEINE Chat-Context-Separator-Logik bei Bildwechsel (das ist Slice 9/17)
- KEINE Undo/Redo-Integration bei Navigation (das ist Slice 15)
- KEINE animierte Transition beim Bildwechsel innerhalb der Detail-View

**Technische Constraints:**
- `"use client"` Direktive fuer alle drei Komponenten
- `SiblingThumbnails` ruft `getSiblingGenerations(batchId)` als Server Action auf (Slice 4)
- `CanvasNavigation` erhaelt `allGenerations` als Prop (sortiert neueste zuerst, wie Gallery-Sortierung)
- `CanvasImage` nutzt Next.js `Image` oder `<img>` mit `object-contain` fuer max-fit
- Prev/Next-Buttons: KEIN Wrapping (nicht zyklisch) — versteckt bei Grenze statt wrap-around
- Lightbox-Navigation (`components/lightbox/lightbox-navigation.tsx`) als Pattern-Referenz fuer Button-Platzierung (aber ohne Keyboard-Shortcuts und ohne Wrapping)

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "API Design" (getSiblingGenerations)
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` → Screen "Canvas-Detail-View (Idle)" (Annotations 6, 8, 9)
- Discovery: `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md` → Section "Business Rules" (Prev/Next, Siblings, keine Pfeiltasten)
