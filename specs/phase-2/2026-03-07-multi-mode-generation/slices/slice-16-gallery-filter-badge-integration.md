# Slice 16: GalleryGrid + GenerationCard + WorkspaceContent — Filter + Badge Integration

> **Slice 16** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-gallery-filter-badge-integration` |
| **Test** | `pnpm test components/workspace/__tests__/gallery-filter-badge.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema", "slice-15-filter-chips-mode-badge"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/gallery-filter-badge.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/gallery-filter-badge.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (Client-Komponenten, alle Dependencies als Props injiziert) |

---

## Ziel

Die drei bestehenden Workspace-Komponenten werden für die Mode-Filter-Funktion erweitert: `GalleryGrid` filtert client-seitig nach `modeFilter`-Prop, `GenerationCard` zeigt ein `ModeBadge`-Overlay, und `WorkspaceContent` hält den Filter-State und rendert `FilterChips` oberhalb des Grids. Zusammen schließen diese Änderungen die sichtbare Gallery-Seite der Multi-Mode-Funktion.

---

## Acceptance Criteria

1) GIVEN `GalleryGrid` erhält Generierungen mit gemischten Modes (`txt2img`, `img2img`, `upscale`) und `modeFilter="img2img"`
   WHEN die Komponente rendert
   THEN werden ausschliesslich Generierungen mit `generationMode === "img2img"` angezeigt; txt2img- und upscale-Generierungen sind nicht im DOM

2) GIVEN `GalleryGrid` erhält Generierungen mit gemischten Modes und `modeFilter="all"`
   WHEN die Komponente rendert
   THEN werden alle vollständig geladenen (`status === "completed"`) Generierungen angezeigt, unabhängig von `generationMode`

3) GIVEN `GalleryGrid` erhält `modeFilter="img2img"`, aber keine der Generierungen hat `generationMode === "img2img"`
   WHEN die Komponente rendert
   THEN ist kein Image-Card-Element im DOM; stattdessen ist ein Text-Element mit dem Inhalt "No Image to Image generations yet" sichtbar

4) GIVEN `GalleryGrid` erhält `modeFilter="upscale"` ohne passende Generierungen
   WHEN die Komponente rendert
   THEN zeigt sie den Text "No Upscale generations yet"

5) GIVEN `GalleryGrid` erhält `modeFilter="txt2img"` ohne passende Generierungen
   WHEN die Komponente rendert
   THEN zeigt sie den Text "No Text to Image generations yet"

6) GIVEN `GenerationCard` wird mit einer Generierung gerendert, die `generationMode="img2img"` hat
   WHEN die Karte rendert
   THEN ist ein `ModeBadge` mit `mode="img2img"` (Text "I") im DOM sichtbar, absolut positioniert innerhalb der Karte

7) GIVEN `GenerationCard` wird mit einer Generierung gerendert, die `generationMode="txt2img"` hat
   WHEN die Karte rendert
   THEN ist ein `ModeBadge` mit `mode="txt2img"` (Text "T") im DOM sichtbar

8) GIVEN `GenerationCard` wird mit einer Generierung gerendert, die `generationMode="upscale"` hat
   WHEN die Karte rendert
   THEN ist ein `ModeBadge` mit `mode="upscale"` (Text "U") im DOM sichtbar

9) GIVEN `WorkspaceContent` rendert mit einer Liste von Generierungen
   WHEN die Komponente initial geladen wird
   THEN ist der `FilterChips`-Filter-State `"all"`; `FilterChips` und `GalleryGrid` sind beide im DOM sichtbar

10) GIVEN `WorkspaceContent` rendert mit Generierungen und `FilterChips` sind sichtbar
    WHEN der User den "Image to Image"-Chip klickt
    THEN ändert sich der interne Filter-State auf `"img2img"` und `GalleryGrid` rendert nur img2img-Generierungen

11) GIVEN `WorkspaceContent` rendert und Filter ist auf `"img2img"` gesetzt
    WHEN der User den "Alle"-Chip klickt
    THEN wechselt der Filter-State zurück auf `"all"` und alle Generierungen werden angezeigt

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions mit `@testing-library/react`.

### Test-Datei: `components/workspace/__tests__/gallery-filter-badge.test.tsx`

<test_spec>
```typescript
// AC-1: GalleryGrid filtert auf img2img
it.todo('should render only img2img generations when modeFilter is img2img')

// AC-2: GalleryGrid zeigt alle bei modeFilter all
it.todo('should render all completed generations when modeFilter is all')

// AC-3: Leer-State img2img
it.todo('should show No Image to Image generations yet when modeFilter is img2img with no matches')

// AC-4: Leer-State upscale
it.todo('should show No Upscale generations yet when modeFilter is upscale with no matches')

// AC-5: Leer-State txt2img
it.todo('should show No Text to Image generations yet when modeFilter is txt2img with no matches')

// AC-6: GenerationCard zeigt ModeBadge I für img2img
it.todo('should render ModeBadge with text I for generation with generationMode img2img')

// AC-7: GenerationCard zeigt ModeBadge T für txt2img
it.todo('should render ModeBadge with text T for generation with generationMode txt2img')

// AC-8: GenerationCard zeigt ModeBadge U für upscale
it.todo('should render ModeBadge with text U for generation with generationMode upscale')

// AC-9: WorkspaceContent initial Filter-State all
it.todo('should render FilterChips and GalleryGrid with initial filter state all')

// AC-10: WorkspaceContent FilterChips-Klick wechselt auf img2img
it.todo('should filter gallery to img2img when Image to Image chip is clicked')

// AC-11: WorkspaceContent zurück zu all
it.todo('should show all generations when Alle chip is clicked after img2img filter was active')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema` | `GenerationSelect.generationMode` | Schema-Feld | Typ `string`, Werte `'txt2img' \| 'img2img' \| 'upscale'` |
| `slice-15-filter-chips-mode-badge` | `FilterChips` | React Component | `({ value: FilterValue, onChange: (v: FilterValue) => void }) => JSX.Element` |
| `slice-15-filter-chips-mode-badge` | `ModeBadge` | React Component | `({ mode: 'txt2img' \| 'img2img' \| 'upscale' }) => JSX.Element` |
| `slice-15-filter-chips-mode-badge` | `FilterValue` | TypeScript Type | `'all' \| 'txt2img' \| 'img2img' \| 'upscale'` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GalleryGrid` (erweitert) | React Component | `workspace-content.tsx` | + `modeFilter: FilterValue` Prop |
| `GenerationCard` (erweitert) | React Component | `gallery-grid.tsx` | Badge-Overlay intern, keine Interface-Änderung nach aussen |
| `WorkspaceContent` (erweitert) | React Component | Workspace-Page | Filter-State intern, keine neuen Props |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/gallery-grid.tsx` — Prop `modeFilter: FilterValue` ergänzen; client-seitiges `.filter()` auf `generationMode`; mode-spezifische Leer-State-Messages
- [ ] `components/workspace/generation-card.tsx` — `ModeBadge`-Import und Overlay-Rendering für `generationMode`-Feld der Generation
- [ ] `components/workspace/workspace-content.tsx` — `FilterValue`-State (`useState`); `FilterChips`-Rendering über Gallery; `modeFilter`-Prop an `GalleryGrid` weitergeben
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/workspace/__tests__/gallery-filter-badge.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein Server-seitiges Filtering — ausschliesslich client-seitiges `.filter()` auf dem vorhandenen Generierungen-Array
- Keine Änderungen an der Datenbankabfrage oder den Server Actions
- Keine Änderungen an `FilterChips` oder `ModeBadge` selbst (diese sind Deliverables von slice-15)
- `GenerationCard` erhält kein neues Interface nach aussen — `generationMode` kommt aus dem bereits vorhandenen Generation-Objekt

**Technische Constraints:**
- `GalleryGrid` bleibt ein Client Component (`"use client"` bereits vorhanden)
- Filter-State in `WorkspaceContent` via `useState<FilterValue>`, initialer Wert `"all"`
- Leer-State-Message-Texte: exakt `"No Text to Image generations yet"`, `"No Image to Image generations yet"`, `"No Upscale generations yet"`
- `ModeBadge` in `GenerationCard`: absolut positioniert (z.B. `bottom-2 right-2 absolute`); der Positions-Kontext (`relative`) liegt auf dem Card-Container

**Referenzen:**
- Gallery-Filter UI: `wireframes.md` → Section "Screen: Gallery with Filter Chips + Mode Badges"
- Empty-Filter-State: `wireframes.md` → Section "Screen: Gallery with Filter Chips + Mode Badges → Wireframe — Empty Filter Result"
- `generationMode`-Feldwerte: `architecture.md` → Section "Database Schema → Schema Changes (Drizzle)"
- Client-seitiges Filtering als bewusste Design-Entscheidung: `architecture.md` → Section "Technology Decisions → Trade-offs"
