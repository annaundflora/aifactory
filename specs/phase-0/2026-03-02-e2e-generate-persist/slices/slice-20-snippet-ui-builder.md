# Slice 20: Snippet UI im Prompt Builder

> **Slice 20 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-20-snippet-ui-builder` |
| **Test** | `pnpm test components/prompt-builder/__tests__/snippet-ui.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-19-snippet-crud", "slice-17-prompt-builder-drawer"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/prompt-builder/__tests__/snippet-ui.test.tsx` |
| **Integration Command** | `pnpm test components/prompt-builder/__tests__/snippet-ui.test.tsx` |
| **Acceptance Command** | `pnpm test components/prompt-builder/__tests__/snippet-ui.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (Server Actions gemockt, reiner UI-State) |

---

## Ziel

"Meine Bausteine" Tab im Prompt Builder Drawer bereitstellen: Inline-Formular zum Erstellen neuer Snippets, Snippet-Chips gruppiert nach Kategorie mit Toggle-Auswahl, sowie Edit- und Delete-Flows. Snippets verhalten sich wie die bestehenden Option-Chips und fuegen sich nahtlos in die Prompt-Concatenation ein.

---

## Acceptance Criteria

1) GIVEN der Prompt Builder Drawer ist offen
   WHEN der User den "My Snippets" Tab klickt
   THEN wird der Tab aktiv und zeigt den Snippet-Bereich mit einem "New Snippet" Button

2) GIVEN der "My Snippets" Tab ist aktiv und keine Snippets existieren
   WHEN der Bereich gerendert wird
   THEN wird die Nachricht "No snippets yet. Create your first!" angezeigt

3) GIVEN der "My Snippets" Tab ist aktiv
   WHEN der User auf "New Snippet" klickt
   THEN erscheint ein Inline-Formular mit Text-Input (autofokussiert), Kategorie-Dropdown und Save-Button

4) GIVEN das Snippet-Formular ist sichtbar
   WHEN der User Text "on white background" eingibt, Kategorie "POD Basics" waehlt und "Save" klickt
   THEN wird `createSnippet` Server Action aufgerufen und der neue Baustein erscheint unter der Kategorie "POD Basics"

5) GIVEN das Snippet-Formular ist sichtbar
   WHEN der User "Save" klickt ohne Text einzugeben
   THEN wird eine Validierungsmeldung angezeigt und kein Server Action aufgerufen

6) GIVEN Snippets existieren in Kategorien "POD Basics" (2 Snippets) und "My Styles" (1 Snippet)
   WHEN der "My Snippets" Tab gerendert wird
   THEN werden die Snippets als Chips gruppiert unter ihren Kategorie-Headern angezeigt

7) GIVEN ein Snippet-Chip "on white background" ist nicht ausgewaehlt
   WHEN der User auf den Chip klickt
   THEN erhaelt der Chip eine visuelle Hervorhebung (selected State) und der Text "on white background" wird in die Live-Preview eingefuegt

8) GIVEN ein Snippet-Chip "on white background" ist ausgewaehlt
   WHEN der User erneut auf den Chip klickt
   THEN wird die Auswahl entfernt und der Text verschwindet aus der Live-Preview

9) GIVEN der User hovert ueber einen Snippet-Chip
   WHEN die Hover-Icons sichtbar werden
   THEN werden Edit- und Delete-Icons auf dem Chip angezeigt

10) GIVEN der User klickt das Edit-Icon auf einem Snippet-Chip
    WHEN das Formular erscheint
    THEN ist es vorbefuellt mit dem bestehenden Text und der Kategorie, und "Save" ruft `updateSnippet` statt `createSnippet` auf

11) GIVEN der User klickt das Delete-Icon auf einem Snippet-Chip
    WHEN die Inline-Bestaetigung erscheint
    THEN zeigt der Chip "Delete?" mit Confirm/Cancel Optionen

12) GIVEN der User bestaetigt das Loeschen
    WHEN `deleteSnippet` Server Action aufgerufen wird
    THEN verschwindet der Chip und falls die Kategorie leer ist, wird der Kategorie-Header ebenfalls entfernt

13) GIVEN der User hat Style-Chips und Snippet-Chips ausgewaehlt
    WHEN die Live-Preview aktualisiert wird
    THEN zeigt sie den Base-Prompt gefolgt von allen Selections (Style + Colors + Snippets) kommasepariert

14) GIVEN das Kategorie-Dropdown im Formular
    WHEN der User es oeffnet
    THEN werden existierende Kategorien als Optionen angeboten und eine Freitext-Eingabe fuer neue Kategorien ist moeglich

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/prompt-builder/__tests__/snippet-ui.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('My Snippets Tab', () => {
  // AC-1: Tab-Wechsel
  it.todo('should activate My Snippets tab and show New Snippet button')

  // AC-2: Leerer Zustand
  it.todo('should show empty state message when no snippets exist')

  // AC-6: Gruppierte Darstellung
  it.todo('should render snippets grouped by category with headers')

  // AC-13: Gemischte Selections in Live-Preview
  it.todo('should include snippet selections alongside style and color selections in live preview')
})

describe('SnippetForm', () => {
  // AC-3: Formular oeffnen
  it.todo('should show inline form with autofocused text input when New Snippet is clicked')

  // AC-4: Snippet erstellen
  it.todo('should call createSnippet action and display new snippet after save')

  // AC-5: Client-Validierung
  it.todo('should show validation error and prevent save when text is empty')

  // AC-10: Edit-Modus
  it.todo('should prefill form with existing snippet data and call updateSnippet on save')

  // AC-14: Kategorie-Dropdown
  it.todo('should offer existing categories and allow free-text for new category')
})

describe('SnippetChip', () => {
  // AC-7: Chip auswaehlen
  it.todo('should highlight chip and add text to prompt on click')

  // AC-8: Chip abwaehlen
  it.todo('should remove highlight and text from prompt on second click')

  // AC-9: Hover-Icons
  it.todo('should show edit and delete icons on hover')

  // AC-11: Delete-Bestaetigung
  it.todo('should show inline delete confirmation with confirm and cancel')

  // AC-12: Loeschen ausfuehren
  it.todo('should remove chip and empty category header after confirmed delete')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-19-snippet-crud` | `createSnippet` | Server Action | `(input: { text: string, category: string }) => Promise<Snippet>` |
| `slice-19-snippet-crud` | `updateSnippet` | Server Action | `(input: { id: string, text: string, category: string }) => Promise<Snippet>` |
| `slice-19-snippet-crud` | `deleteSnippet` | Server Action | `(input: { id: string }) => Promise<{ success: boolean }>` |
| `slice-19-snippet-crud` | `getSnippets` | Server Action | `() => Promise<Record<string, Snippet[]>>` |
| `slice-17-prompt-builder-drawer` | `CategoryTabs` | Client Component | Tab-Container mit `activeTab` und `onTabChange` |
| `slice-17-prompt-builder-drawer` | `BuilderDrawer` | Client Component | Drawer-State, Prompt-Concatenation-Logik, Live-Preview |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SnippetForm` | Client Component | BuilderDrawer | `<SnippetForm snippet?: Snippet, categories: string[], onSave: (snippet: Snippet) => void, onCancel: () => void />` |
| "My Snippets" Tab-Content | Integration | CategoryTabs | Erweiterung von `category-tabs.tsx` um dritten Tab |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/prompt-builder/snippet-form.tsx` -- Client Component: Inline-Formular fuer Snippet-Erstellung und -Bearbeitung mit Text-Input, Kategorie-Dropdown, Save/Cancel
- [ ] `components/prompt-builder/category-tabs.tsx` -- Erweiterung: "My Snippets" als dritten Tab integrieren, Snippet-Chips gruppiert nach Kategorie, Toggle-Auswahl, Hover-Edit/Delete, Inline-Delete-Bestaetigung
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN "Surprise Me" fuer Snippets -- Surprise Me behandelt nur Style/Colors (separater Slice)
- KEINE Drag-and-Drop Sortierung von Snippets
- KEINE Snippet-Import/Export Funktionalitaet
- KEINE Aenderungen an den Server Actions selbst -- nur Aufruf der bestehenden Actions aus Slice 19

**Technische Constraints:**
- Alle Dateien sind Client Components (`"use client"`)
- Snippet-Chips nutzen das gleiche Toggle-Verhalten wie `OptionChip` aus Slice 17
- Kategorie-Dropdown: shadcn/ui Combobox oder Select mit Freitext-Option
- Formular-State lokal im Component (kein globaler State noetig)
- `getSnippets` beim Tab-Wechsel zu "My Snippets" aufrufen (oder bei Drawer-Open)
- Nach Create/Update/Delete: Snippet-Liste neu laden via `getSnippets`

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: My Snippets Tab" (Annotations 1-4: new-snippet-btn, snippet-form, snippet-chip, Edit/Delete Icons)
- Wireframes: `wireframes.md` -> Section "Screen: Prompt Builder Drawer" (Annotation 3: category-tab mit "My Snippets")
- Discovery: `discovery.md` -> Flow 5 + 5b (Prompt-Baustein erstellen/bearbeiten/loeschen)
- Architecture: `architecture.md` -> Section "Project Structure" (components/prompt-builder/snippet-form.tsx)
- Architecture: `architecture.md` -> Section "API Design" (createSnippet, updateSnippet, deleteSnippet, getSnippets)
