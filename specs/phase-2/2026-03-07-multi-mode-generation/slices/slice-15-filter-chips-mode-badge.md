# Slice 15: FilterChips Component + ModeBadge Component

> **Slice 15** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-filter-chips-mode-badge` |
| **Test** | `pnpm test components/workspace/__tests__/filter-chips.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/filter-chips.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/filter-chips.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reine Client-Komponenten, keine externen Dependencies) |

---

## Ziel

Zwei neue, zustandslose UI-Komponenten für die Multi-Mode-Galerie: `FilterChips` als Single-Select-Toggle-Gruppe (Alle / Text to Image / Image to Image / Upscale) über dem Gallery-Grid, und `ModeBadge` als kleines Badge-Overlay auf Generation-Cards mit den Labels "T", "I" oder "U". Beide Komponenten sind unabhängig von Backend-Slices und können sofort implementiert werden.

---

## Acceptance Criteria

1) GIVEN `FilterChips` wird mit `value="all"` und einer `onChange`-Funktion gerendert
   WHEN die Komponente erscheint
   THEN sind vier Chips sichtbar mit den Labels "Alle", "Text to Image", "Image to Image" und "Upscale" — in dieser Reihenfolge

2) GIVEN `FilterChips` rendert mit `value="all"`
   WHEN die Chip-Zustände inspiziert werden
   THEN ist genau der "Alle"-Chip als aktiv markiert (aria-pressed="true" oder data-state="on"); alle anderen Chips sind inaktiv

3) GIVEN `FilterChips` rendert mit `value="img2img"`
   WHEN die Chip-Zustände inspiziert werden
   THEN ist genau der "Image to Image"-Chip aktiv; "Alle", "Text to Image" und "Upscale" sind inaktiv

4) GIVEN `FilterChips` mit einem `onChange`-Spy rendert
   WHEN der User auf den "Image to Image"-Chip klickt
   THEN wird `onChange` genau einmal aufgerufen mit dem Argument `"img2img"`

5) GIVEN `FilterChips` mit einem `onChange`-Spy rendert, aktueller `value="img2img"`
   WHEN der User auf den "Upscale"-Chip klickt
   THEN wird `onChange` mit `"upscale"` aufgerufen; der vorher aktive "Image to Image"-Chip ist danach inaktiv

6) GIVEN `FilterChips` rendert mit `value="txt2img"`
   WHEN der User auf den bereits aktiven "Text to Image"-Chip klickt
   THEN wird `onChange` NICHT aufgerufen (kein Toggle-off, Single-Select bleibt erhalten)

7) GIVEN `ModeBadge` wird mit `mode="txt2img"` gerendert
   WHEN die Komponente erscheint
   THEN zeigt sie genau den Text "T" an

8) GIVEN `ModeBadge` wird mit `mode="img2img"` gerendert
   WHEN die Komponente erscheint
   THEN zeigt sie genau den Text "I" an

9) GIVEN `ModeBadge` wird mit `mode="upscale"` gerendert
   WHEN die Komponente erscheint
   THEN zeigt sie genau den Text "U" an

10) GIVEN `ModeBadge` rendert mit beliebigem `mode`
    WHEN das DOM-Element inspiziert wird
    THEN enthält es ein `title`-Attribut mit dem Vollnamen des Modus: "txt2img" → "Text to Image", "img2img" → "Image to Image", "upscale" → "Upscale"

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions mit `@testing-library/react`.

### Test-Datei: `components/workspace/__tests__/filter-chips.test.tsx`

<test_spec>
```typescript
// AC-1: Vier Chips mit korrekten Labels
it.todo('should render four chips with labels Alle, Text to Image, Image to Image, Upscale')

// AC-2: Aktiver Chip bei value="all"
it.todo('should mark only the Alle chip as active when value is all')

// AC-3: Aktiver Chip bei value="img2img"
it.todo('should mark only the Image to Image chip as active when value is img2img')

// AC-4: onChange mit korrektem Wert beim Klick
it.todo('should call onChange with img2img when Image to Image chip is clicked')

// AC-5: Chip-Wechsel deaktiviert vorherigen Chip
it.todo('should switch active chip and call onChange with upscale when Upscale is clicked while img2img is active')

// AC-6: Kein onChange bei Klick auf bereits aktiven Chip
it.todo('should not call onChange when clicking the already active chip')

// AC-7: ModeBadge zeigt T für txt2img
it.todo('should render T for mode txt2img')

// AC-8: ModeBadge zeigt I für img2img
it.todo('should render I for mode img2img')

// AC-9: ModeBadge zeigt U für upscale
it.todo('should render U for mode upscale')

// AC-10: ModeBadge title-Attribut
it.todo('should render title attribute with full mode name for all three modes')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Abhängigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `FilterChips` | React Component | workspace-content (gallery integration) | `({ value: 'all' \| 'txt2img' \| 'img2img' \| 'upscale', onChange: (v: FilterValue) => void }) => JSX.Element` |
| `ModeBadge` | React Component | generation-card (badge overlay) | `({ mode: 'txt2img' \| 'img2img' \| 'upscale' }) => JSX.Element` |
| `FilterValue` | TypeScript Type | gallery-grid, workspace-content | `'all' \| 'txt2img' \| 'img2img' \| 'upscale'` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/filter-chips.tsx` — Single-Select-Toggle-Gruppe mit vier Chips (Alle / Text to Image / Image to Image / Upscale) und `FilterValue`-Typ-Export
- [ ] `components/workspace/mode-badge.tsx` — Badge-Overlay mit "T"/"I"/"U" Label und `title`-Attribut für Vollnamen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/workspace/__tests__/filter-chips.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Integration in `workspace-content.tsx` oder `gallery-grid.tsx` (das ist Aufgabe eines anderen Slices)
- Keine Anbindung an DB oder Server Actions — beide Komponenten sind rein presentational
- Keine Persistenz des Filter-Zustands (Session-State liegt im Consumer)
- `ModeBadge` rendert keine Inhalte für unbekannte Mode-Werte

**Technische Constraints:**
- Nutze vorhandene shadcn/ui Komponenten (Toggle, ToggleGroup) falls verfügbar, sonst native Buttons mit korrektem ARIA-Pattern
- `FilterChips` verwendet Single-Select-Logik: ein aktiver Chip, kein Toggle-off des aktiven Chips
- Styling: `ModeBadge` ist als absolut positioniertes Overlay konzipiert (Consumer setzt den Positions-Kontext via `relative`)
- Beide Komponenten als Client Components (`"use client"`) da sie interaktiv sind

**Referenzen:**
- FilterChips UI-Verhalten: `wireframes.md` → Section "Screen: Gallery with Filter Chips + Mode Badges"
- ModeBadge Labels (T/I/U): `wireframes.md` → Section "Screen: Gallery with Filter Chips + Mode Badges → Annotations ②"
- Empty-Filter-State ("No X generations yet"): Liegt im Consumer (gallery-grid), nicht in FilterChips
- Mode-Werte als String-Enum: `architecture.md` → Section "Database Schema → Schema Changes (Drizzle)"
