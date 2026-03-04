# Slice 18: Surprise Me Button im Prompt Builder

> **Slice 18 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-18-surprise-me` |
| **Test** | `pnpm test components/prompt-builder/__tests__/surprise-me-button.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-17-prompt-builder-drawer"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/prompt-builder/__tests__/surprise-me-button.test.tsx` |
| **Integration Command** | `pnpm test components/prompt-builder/__tests__/surprise-me-button.test.tsx` |
| **Acceptance Command** | `pnpm test components/prompt-builder/__tests__/surprise-me-button.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (reiner UI-State, kein Backend) |

---

## Ziel

"Surprise Me" Button im Prompt Builder Drawer, der eine zufaellige Kombination aus Style- und Colors-Kategorien wuerfelt. Bei bestehender Auswahl wird vorher eine Bestaetigung angezeigt ("Aktuelle Auswahl ersetzen?"). Nach dem Wuerfeln wird der Prompt in der Live-Preview aktualisiert.

---

## Acceptance Criteria

1) GIVEN der Drawer ist offen und keine Chips sind ausgewaehlt
   WHEN der User auf "Surprise Me" klickt
   THEN wird je genau 1 zufaelliger Chip aus Style und 1 aus Colors ausgewaehlt und beide erscheinen als selected in ihren jeweiligen Tabs

2) GIVEN der Drawer ist offen und keine Chips sind ausgewaehlt
   WHEN der User auf "Surprise Me" klickt
   THEN wird die Live-Preview sofort aktualisiert mit den gewuerfelten Optionen (z.B. "A fox, pixel art, monochrome")

3) GIVEN der User hat bereits Chips ausgewaehlt (z.B. "Oil Painting" im Style-Tab)
   WHEN der User auf "Surprise Me" klickt
   THEN erscheint eine Inline-Bestaetigung: "Aktuelle Auswahl ersetzen?" mit "Bestaetigen" und "Abbrechen" Buttons

4) GIVEN die Bestaetigung "Aktuelle Auswahl ersetzen?" wird angezeigt
   WHEN der User auf "Bestaetigen" klickt
   THEN werden alle bisherigen Selections entfernt und durch die neue zufaellige Kombination ersetzt

5) GIVEN die Bestaetigung "Aktuelle Auswahl ersetzen?" wird angezeigt
   WHEN der User auf "Abbrechen" klickt
   THEN bleibt die bisherige Auswahl unveraendert und die Bestaetigung wird geschlossen

6) GIVEN der User klickt mehrmals hintereinander auf "Surprise Me" (ohne bestehende Auswahl)
   WHEN die Zufallsauswahl generiert wird
   THEN wird bei jedem Klick eine neue zufaellige Kombination gewaehlt (nicht deterministisch, unterschiedliche Ergebnisse moeglich)

7) GIVEN "Surprise Me" hat eine Auswahl gewuerfelt
   WHEN der User zum Style-Tab wechselt
   THEN ist genau 1 Style-Chip als selected hervorgehoben

8) GIVEN "Surprise Me" hat eine Auswahl gewuerfelt
   WHEN der User zum Colors-Tab wechselt
   THEN ist genau 1 Colors-Chip als selected hervorgehoben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/prompt-builder/__tests__/surprise-me-button.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SurpriseMeButton', () => {
  // AC-1: Zufaellige Auswahl aus Style und Colors
  it.todo('should select one random chip from Style and one from Colors when clicked with no existing selection')

  // AC-2: Live-Preview Aktualisierung
  it.todo('should update live preview with randomly selected options')

  // AC-3: Bestaetigung bei bestehender Auswahl
  it.todo('should show confirmation dialog when chips are already selected')

  // AC-4: Bestaetigen ersetzt Auswahl
  it.todo('should replace all selections with new random combination on confirm')

  // AC-5: Abbrechen behaelt Auswahl
  it.todo('should keep existing selections unchanged on cancel')

  // AC-6: Nicht-deterministisch
  it.todo('should produce different random combinations on repeated clicks')

  // AC-7: Style-Tab zeigt gewuerfelten Chip
  it.todo('should show exactly one style chip as selected after surprise me')

  // AC-8: Colors-Tab zeigt gewuerfelten Chip
  it.todo('should show exactly one colors chip as selected after surprise me')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-17` | `BuilderDrawer` Selections-State | React State | Zugriff auf aktuelle Style/Colors-Selections zum Pruefen ob Auswahl besteht |
| `slice-17` | Style- und Colors-Optionen Arrays | Konstanten | Die 9 Style- und 9 Colors-Optionen aus denen zufaellig gewaehlt wird |
| `slice-17` | `onSelectionsChange` Callback | Function | Zum Setzen der neuen zufaelligen Auswahl |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SurpriseMeButton` | Client Component | BuilderDrawer | `<SurpriseMeButton hasExistingSelection={boolean} onSurprise={(selections: { style: string; color: string }) => void} styleOptions={string[]} colorOptions={string[]} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/prompt-builder/surprise-me-button.tsx` -- Client Component: Button mit Wuerfel-Icon, Bestaetigung-Logik, Zufallsauswahl aus Style/Colors
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Snippet-Kategorie ("My Snippets") in der Zufallsauswahl -- nur Style und Colors
- KEINE Animation/Transition beim Wuerfeln -- nur State-Update
- KEINE Persistierung der Zufallsauswahl -- lebt nur im Drawer-State

**Technische Constraints:**
- Client Component (`"use client"`)
- shadcn/ui AlertDialog oder Inline-Confirmation fuer die Bestaetigung
- Zufallsauswahl via `Math.random()` aus den Konstanten-Arrays (je 1 aus 9)
- Button-Position: Oberhalb der Kategorie-Tabs im Drawer (siehe Wireframes)

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: Prompt Builder Drawer", Annotation 2 (`surprise-me-btn`)
- Wireframes: `wireframes.md` -> State Variation `surprise-me-confirm` und `surprise-me-applied`
- Discovery: `discovery.md` -> Section "Business Rules" (Surprise Me Regel)
- Discovery: `discovery.md` -> Section "User Flow > Flow 2: Prompt Builder nutzen", Schritt 6
