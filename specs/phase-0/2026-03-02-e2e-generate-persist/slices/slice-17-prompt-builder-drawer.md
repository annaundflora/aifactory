# Slice 17: Prompt Builder Drawer mit Style- und Colors-Tabs

> **Slice 17 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-prompt-builder-drawer` |
| **Test** | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-prompt-area-parameter-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` |
| **Integration Command** | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` |
| **Acceptance Command** | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (kein Backend noetig, reiner UI-State) |

---

## Ziel

Prompt Builder Drawer als Side-Panel von rechts mit zwei Kategorie-Tabs (Style, Colors), je 9 Text-Label-Chips in einem 3x3 Grid mit Toggle-Auswahl, Live-Preview des zusammengesetzten Prompts und Done-Button der den Drawer schliesst und den Prompt ins Eingabefeld uebertraegt.

---

## Acceptance Criteria

1) GIVEN der User ist im Workspace und hat einen Prompt im Textarea
   WHEN der User auf den "Prompt Builder" Button klickt
   THEN oeffnet sich ein Drawer von rechts mit dem Titel "Prompt Builder"

2) GIVEN der Drawer ist offen
   WHEN der User die Tabs betrachtet
   THEN sind zwei Tabs sichtbar: "Style" und "Colors", wobei "Style" initial aktiv ist

3) GIVEN der Style-Tab ist aktiv
   WHEN die Chips gerendert werden
   THEN zeigt ein 3x3 Grid genau 9 Style-Optionen als Text-Labels (z.B. "Oil Painting", "Flat Vector", "Anime", "Watercolor", "3D Render", "Pixel Art", "Photography", "Pencil", "Pop Art")

4) GIVEN der User wechselt zum Colors-Tab
   WHEN die Chips gerendert werden
   THEN zeigt ein 3x3 Grid genau 9 Color-Optionen als Text-Labels (z.B. "Warm Tones", "Pastel", "Monochrome")

5) GIVEN kein Chip ist ausgewaehlt
   WHEN der User auf den Chip "Oil Painting" klickt
   THEN erhaelt der Chip eine visuelle Hervorhebung (selected State) und der Text "oil painting" erscheint in der Live-Preview

6) GIVEN der Chip "Oil Painting" ist bereits ausgewaehlt
   WHEN der User erneut auf "Oil Painting" klickt
   THEN wird die Auswahl entfernt (deselected State) und "oil painting" verschwindet aus der Live-Preview

7) GIVEN der User hat "Oil Painting" (Style) und "Warm Tones" (Colors) ausgewaehlt
   WHEN die Live-Preview aktualisiert wird
   THEN zeigt sie den Base-Prompt gefolgt von den Selections kommasepariert an, z.B. "A fox, oil painting, warm tones"

8) GIVEN der User hat Selections getroffen und sieht die Live-Preview
   WHEN der User auf "Done" klickt
   THEN schliesst sich der Drawer und der zusammengesetzte Prompt wird ins Prompt-Textarea uebernommen

9) GIVEN der Drawer ist offen
   WHEN der User auf den Close-Button (X) klickt
   THEN schliesst sich der Drawer und der zusammengesetzte Prompt wird ins Prompt-Textarea uebernommen (identisch zu Done)

10) GIVEN der Drawer ist offen und Chips sind ausgewaehlt
    WHEN der User zwischen Style- und Colors-Tab wechselt
    THEN bleiben die Auswahlen in beiden Tabs erhalten (Tab-Wechsel resettet nicht)

11) GIVEN der Drawer wird erneut geoeffnet nach vorherigem Schliessen
    WHEN die aktuelle Prompt-Textarea Selections enthält die aus dem Builder stammen
    THEN werden die zuvor gewaehlten Chips wieder als selected angezeigt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/prompt-builder/__tests__/builder-drawer.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('BuilderDrawer', () => {
  // AC-1: Drawer oeffnet sich
  it.todo('should open drawer from right when prompt builder button is clicked')

  // AC-2: Zwei Tabs, Style initial aktiv
  it.todo('should render Style and Colors tabs with Style active by default')

  // AC-3: Style-Tab zeigt 9 Chips im 3x3 Grid
  it.todo('should render 9 style option chips in a grid')

  // AC-4: Colors-Tab zeigt 9 Chips
  it.todo('should render 9 color option chips when Colors tab is selected')

  // AC-5: Chip-Auswahl toggelt selected State
  it.todo('should highlight chip and add text to live preview on click')

  // AC-6: Chip-Deselection
  it.todo('should remove highlight and text from live preview when selected chip is clicked again')

  // AC-7: Kommaseparierte Concatenation in Live-Preview
  it.todo('should show base prompt with comma-separated selections in live preview')

  // AC-8: Done schliesst Drawer und uebertraegt Prompt
  it.todo('should close drawer and transfer composed prompt to textarea on Done click')

  // AC-9: Close-Button verhält sich wie Done
  it.todo('should close drawer and transfer prompt on close button click')

  // AC-10: Tab-Wechsel erhält Auswahlen
  it.todo('should preserve selections across tab switches')

  // AC-11: Wiederoeffnen zeigt vorherige Auswahl
  it.todo('should restore previously selected chips when drawer is reopened')
})

describe('CategoryTabs', () => {
  // AC-2: Tab-Wechsel
  it.todo('should switch active tab on click')

  // AC-4: Content-Wechsel
  it.todo('should display correct chip grid for selected tab')
})

describe('OptionChip', () => {
  // AC-5: Toggle Verhalten
  it.todo('should toggle between default and selected visual state on click')

  // AC-6: Deselection
  it.todo('should call onToggle callback with chip value when clicked')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09` | `PromptArea` | Client Component | Stellt Prompt-Textarea bereit, in die der Builder-Prompt uebertragen wird |
| `slice-09` | Prompt State | React State | Zugriff auf aktuellen Base-Prompt fuer Live-Preview und Concatenation |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `BuilderDrawer` | Client Component | PromptArea | `<BuilderDrawer open={boolean} onClose={(prompt: string) => void} basePrompt={string} />` |
| `CategoryTabs` | Client Component | BuilderDrawer (intern) | `<CategoryTabs activeTab={string} onTabChange={(tab: string) => void} />` |
| `OptionChip` | Client Component | BuilderDrawer (intern) | `<OptionChip label={string} selected={boolean} onToggle={() => void} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/prompt-builder/builder-drawer.tsx` -- Client Component: Drawer-Container, State-Management fuer Selections, Live-Preview, Done/Close-Logik, Prompt-Concatenation
- [ ] `components/prompt-builder/category-tabs.tsx` -- Client Component: Style/Colors Tab-Navigation
- [ ] `components/prompt-builder/option-chip.tsx` -- Client Component: Einzelner Text-Label-Chip mit Toggle-State
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEIN "Surprise Me" Button -- kommt in spaeteren Slice
- KEINE "My Snippets" Tab/Funktionalitaet -- kommt in spaeteren Slice
- KEINE Snippet-CRUD (erstellen/bearbeiten/loeschen) -- kommt in spaeteren Slice
- KEINE Persistierung der Chip-Optionen in DB -- Style/Colors sind hardcoded
- KEINE Bild-Previews fuer Chips -- nur Text-Labels

**Technische Constraints:**
- Alle drei Dateien sind Client Components (`"use client"`)
- shadcn/ui Sheet (side="right") fuer den Drawer
- shadcn/ui Tabs fuer Style/Colors Navigation
- shadcn/ui Button-Variant fuer OptionChip (outline/default Toggle)
- Tailwind v4 fuer 3x3 Grid-Layout (`grid grid-cols-3`)
- Style- und Color-Optionen als Konstanten-Array in builder-drawer.tsx definiert
- Prompt-Concatenation: `basePrompt + ", " + selections.join(", ")`

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: Prompt Builder Drawer" (Annotations 1-6: Close, Surprise Me, Tabs, Chips, Preview, Done)
- Discovery: `discovery.md` -> Section "Business Rules" (Prompt Builder Concatenation: kommasepariert)
- Discovery: `discovery.md` -> Section "User Flow > Flow 2: Prompt Builder nutzen"
- Architecture: `architecture.md` -> Section "Project Structure" (components/prompt-builder/)
