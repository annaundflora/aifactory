# Slice 10: Builder Drawer auf Pro UI umbauen

> **Slice 10** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-builder-drawer-pro-ui` |
| **Test** | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-builder-fragments-config", "slice-07-prompt-area-structured-fields"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (Server Actions fuer Snippets mocken) |

---

## Ziel

Den bestehenden Builder Drawer von 3 Tabs (Style, Colors, My Snippets) mit einzelnen Woertern auf 6 Tabs (Style, Colors, Composition, Lighting, Mood, My Snippets) in 2 Reihen umbauen. Chips verwenden ausformulierte Fragmente aus `BUILDER_CATEGORIES` (Slice 09). Live-Preview zeigt den zusammengesetzten Stil-Text. "Done" schreibt den komponierten Text ins Style/Modifier-Feld (Replace, kein Append).

---

## Acceptance Criteria

1) GIVEN der Builder Drawer ist geoeffnet
   WHEN der User die Tab-Leiste betrachtet
   THEN sind 6 Tabs sichtbar in 2 Reihen: Reihe 1 = "Style", "Colors", "Composition"; Reihe 2 = "Lighting", "Mood", "My Snippets"

2) GIVEN der Tab "Style" ist aktiv (Default)
   WHEN der User die Chips betrachtet
   THEN werden die Fragmente aus `BUILDER_CATEGORIES` fuer Kategorie "style" als Chips gerendert (Labels aus `BuilderFragment.label`, z.B. "Oil Painting")

3) GIVEN der User wechselt auf Tab "Composition"
   WHEN die Chips geladen werden
   THEN werden die 6 Fragmente aus `BUILDER_CATEGORIES` fuer Kategorie "composition" als Chips angezeigt

4) GIVEN kein Chip ist ausgewaehlt
   WHEN der User einen Chip (z.B. "Oil Painting") anklickt
   THEN wird der Chip visuell als selektiert markiert (filled/highlighted statt outline)

5) GIVEN der Chip "Oil Painting" ist selektiert
   WHEN der User denselben Chip erneut anklickt
   THEN wird der Chip deselektiert (zurueck zu outline)

6) GIVEN der User hat "Oil Painting" (Style) und "Golden Hour" (Lighting) ausgewaehlt
   WHEN der User die Preview-Section betrachtet
   THEN zeigt die Preview den zusammengesetzten Text: die `fragment`-Texte beider Auswahlen, verbunden mit ", " Separator

7) GIVEN keine Chips ausgewaehlt und keine Snippets selektiert
   WHEN der User die Preview-Section betrachtet
   THEN zeigt die Preview einen Platzhalter-Text (z.B. "Select options to build your style")

8) GIVEN der User hat Fragmente aus verschiedenen Kategorien ausgewaehlt
   WHEN der User "Done" klickt
   THEN wird `onClose(composedText)` aufgerufen, wobei `composedText` die `fragment`-Texte (nicht Labels) aller Auswahlen enthaelt, mit ", " verbunden

9) GIVEN der User hat Fragmente UND My-Snippets ausgewaehlt
   WHEN "Done" geklickt wird
   THEN enthaelt der komponierte Text sowohl Fragment-Texte als auch Snippet-Texte, verbunden mit ", "

10) GIVEN der Builder Drawer wird geoeffnet
    WHEN der Drawer mounted
    THEN sind alle Fragment-Chip-Auswahlen zurueckgesetzt (keine Vorauswahl aus vorherigem Oeffnen)

11) GIVEN die `category-tabs.tsx` Komponente
    WHEN sie die neuen Kategorien rendert
    THEN verwendet sie `BUILDER_CATEGORIES` aus `lib/builder-fragments.ts` statt der bisherigen hardcoded `styleOptions`/`colorOptions` Props

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/prompt-builder/__tests__/builder-drawer.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Builder Drawer Pro UI', () => {
  // AC-1: 6 Tabs in 2 Reihen
  it.todo('should render 6 tabs: Style, Colors, Composition, Lighting, Mood, My Snippets')

  // AC-2: Style-Tab zeigt Fragmente aus BUILDER_CATEGORIES
  it.todo('should render fragment chips from BUILDER_CATEGORIES for style category')

  // AC-3: Composition-Tab zeigt 6 Fragmente
  it.todo('should render composition fragments when composition tab is selected')

  // AC-4: Chip-Toggle selektiert Chip
  it.todo('should visually mark chip as selected when clicked')

  // AC-5: Chip-Toggle deselektiert Chip
  it.todo('should deselect chip when clicked again')

  // AC-6: Live-Preview zeigt zusammengesetzten Text
  it.todo('should show composed fragment texts joined by comma in preview when multiple chips selected')

  // AC-7: Preview-Platzhalter wenn nichts ausgewaehlt
  it.todo('should show placeholder text in preview when no chips are selected')

  // AC-8: Done ruft onClose mit fragment-Texten auf
  it.todo('should call onClose with composed fragment texts joined by comma on Done click')

  // AC-9: Fragmente + Snippets kombiniert
  it.todo('should include both fragment texts and snippet texts in composed output')

  // AC-10: Auswahl zurueckgesetzt beim Oeffnen
  it.todo('should reset all fragment selections when drawer opens')

  // AC-11: CategoryTabs nutzt BUILDER_CATEGORIES statt Props
  it.todo('should render categories from BUILDER_CATEGORIES config instead of hardcoded props')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09-builder-fragments-config` | `BUILDER_CATEGORIES` | Exported constant | `BuilderCategory[]` mit 5 Kategorien |
| `slice-09-builder-fragments-config` | `BuilderFragment`, `BuilderCategory` | TypeScript Types | Import muss kompilieren |
| `slice-07-prompt-area-structured-fields` | `onClose(composedPrompt)` | Callback | Prompt Area schreibt Ergebnis ins Style-Feld |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `BuilderDrawer` | React Component | `prompt-area.tsx` | `BuilderDrawerProps { open: boolean; onClose: (prompt: string) => void }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/prompt-builder/builder-drawer.tsx` -- Umbau: 6 Tabs via BUILDER_CATEGORIES, Fragment-basierte Chips mit Toggle, Live-Preview des zusammengesetzten fragment-Texts, Done schreibt komponierten Text. Entfernt bisherige STYLE_OPTIONS/COLOR_OPTIONS Constants.
- [ ] `components/prompt-builder/category-tabs.tsx` -- Umbau: Empfaengt BUILDER_CATEGORIES statt styleOptions/colorOptions Props. Rendert 5 Kategorie-Tabs dynamisch plus My-Snippets-Tab. TabsList in 2 Reihen.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `prompt-area.tsx` (bereits durch Slice 07 umgebaut)
- KEINE Aenderungen an `lib/builder-fragments.ts` (bereits durch Slice 09 erstellt)
- KEINE neuen Komponenten-Dateien -- Umbau in bestehenden Dateien
- KEINE Aenderung der `basePrompt`-Parsing-Logik fuer Fragment-Wiederherstellung (Vereinfachung: beim Oeffnen wird Auswahl zurueckgesetzt)

**Technische Constraints:**
- Chips verwenden `BuilderFragment.label` als Anzeige-Text und `BuilderFragment.fragment` fuer die Komposition
- Fragment-Komposition: Alle selektierten `fragment`-Texte + Snippet-Texte mit ", " verbinden
- Das Props-Interface `BuilderDrawerProps` behaelt `onClose: (prompt: string) => void` bei (kein breaking change)
- `basePrompt` Prop kann entfernt oder ignoriert werden, da Style-Feld jetzt separat ist (Slice 07)
- Tab-Layout: `TabsList` mit 2 Reihen (z.B. `grid grid-cols-3 grid-rows-2` oder 2 separate `TabsList`)

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Builder Fragments Architecture" (Typen, Kategorien, Fragment Composition)
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Builder Drawer (Pro)" (Tab-Layout, Chip-States, Preview, Done-Button)
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` -- Flow 2 "Builder Pro nutzen"
