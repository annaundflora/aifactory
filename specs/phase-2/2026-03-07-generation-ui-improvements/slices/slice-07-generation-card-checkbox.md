# Slice 07: GenerationCard Checkbox Overlay

> **Slice 07 von N** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-generation-card-checkbox` |
| **Test** | `pnpm test components/workspace/generation-card` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-selection-context"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/generation-card` |
| **Integration Command** | `pnpm test components/workspace/generation-card` |
| **Acceptance Command** | `pnpm test components/workspace/generation-card` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`generation-card.tsx` erhaelt ein optionales Checkbox-Overlay (oben-links), das den Selektions-Zustand aus `SelectionContext` liest. Im Default-Mode oeffnet Karten-Klick die Lightbox. Im Selection-Mode (`isSelecting === true`) togglet Karten-Klick die Selektion statt die Lightbox zu oeffnen. Selektierte Karten erhalten eine blaue Umrandung.

---

## Acceptance Criteria

1) GIVEN `isSelecting === false` im SelectionContext
   WHEN der User auf die GenerationCard klickt
   THEN wird `onSelect(generation.id)` aufgerufen (Lightbox-Oeffnung) und `toggleSelection` wird NICHT aufgerufen

2) GIVEN `isSelecting === true` im SelectionContext
   WHEN der User auf die GenerationCard klickt
   THEN wird `toggleSelection(generation.id)` aufgerufen und `onSelect` wird NICHT aufgerufen

3) GIVEN `isSelecting === true` und `isSelected(generation.id) === true`
   WHEN die GenerationCard gerendert wird
   THEN ist die Checkbox (oben-links) sichtbar und ihr `checked`-Attribut ist `true`

4) GIVEN `isSelecting === true` und `isSelected(generation.id) === false`
   WHEN die GenerationCard gerendert wird
   THEN ist die Checkbox sichtbar und ihr `checked`-Attribut ist `false`

5) GIVEN `isSelecting === false`
   WHEN die GenerationCard im Default-Zustand (kein Hover) gerendert wird
   THEN ist die Checkbox nicht sichtbar (CSS `opacity-0` oder `hidden` ohne Hover)

6) GIVEN `isSelecting === true` und `isSelected(generation.id) === true`
   WHEN die GenerationCard gerendert wird
   THEN hat die Karten-Root-Element eine blaue Umrandung (CSS-Klasse `border-primary` oder aequivalent)

7) GIVEN `isSelecting === false`
   WHEN die GenerationCard gerendert wird
   THEN hat die Karten-Root-Element keine blaue Umrandung (kein `border-primary`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> SelectionContext muss gemockt werden (kein echter Provider noetig).

### Test-Datei: `components/workspace/__tests__/generation-card.test.tsx`

<test_spec>
```typescript
// AC-1: Default-Mode — Klick ruft onSelect auf
it.todo('should call onSelect with generation id when clicked in default mode')

// AC-2: Selection-Mode — Klick ruft toggleSelection auf statt onSelect
it.todo('should call toggleSelection with generation id and not onSelect when isSelecting is true')

// AC-3: Selektierte Karte zeigt gecheckte Checkbox
it.todo('should render checked checkbox when generation is selected in selection mode')

// AC-4: Nicht-selektierte Karte zeigt ungepruefte Checkbox im Selection-Mode
it.todo('should render unchecked checkbox when generation is not selected but isSelecting is true')

// AC-5: Checkbox im Default-Mode nicht sichtbar
it.todo('should not show checkbox when isSelecting is false and card is not hovered')

// AC-6: Selektierte Karte hat blaue Umrandung
it.todo('should apply blue border class to card root when generation is selected')

// AC-7: Nicht-selektierte Karte im Default-Mode hat keine blaue Umrandung
it.todo('should not apply blue border class when isSelecting is false')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-selection-context` | `useSelection` | React Hook | `import { useSelection } from '@/lib/selection-state'` verfuegbar |
| `slice-06-selection-context` | `SelectionProvider` | React Component | Muss Eltern-Ancestor der GenerationCard sein |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationCard` | React Component | `gallery-grid.tsx`, nachfolgende Slices | `GenerationCard({ generation: Generation, onSelect: (id: string) => void })` — unveraenderte Props-Signatur |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/generation-card.tsx` — Checkbox-Overlay (oben-links), blaue Umrandung bei Selektion, konditionaler Klick-Handler basierend auf `isSelecting`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein Umbau von `gallery-grid.tsx` — wird in einem separaten Slice behandelt
- Kein Long-Press / Touch-Aktivierung des Selection-Mode — die Karte liest nur `isSelecting`, aktiviert es nicht selbst
- Kein eigener State in der Karte — nur Lesen aus `useSelection`
- Props-Signatur (`generation`, `onSelect`) bleibt unveraendert — kein Breaking Change fuer bestehende Consumer

**Technische Constraints:**
- `"use client"` Direktive bleibt (existiert bereits)
- Checkbox erscheint Desktop: bei Hover sichtbar (`group-hover:opacity-100`), im Selection-Mode immer sichtbar
- Blaue Umrandung per Tailwind: `border-primary` (konsistent mit bestehendem `hover:border-primary`)
- `useSelection` wird direkt in der Karte aufgerufen — kein Prop-Drilling von Selection-State

**Referenzen:**
- Wireframes: `wireframes.md` → Section "Gallery with Bulk Select" — Hover State + Selecting State (Annotationen ②)
- Architecture: `architecture.md` → Section "Migration Map" — Existing Files Modified: `generation-card.tsx`
- Architecture: `architecture.md` → Section "Selection State Design" — `useSelection`-Interface
