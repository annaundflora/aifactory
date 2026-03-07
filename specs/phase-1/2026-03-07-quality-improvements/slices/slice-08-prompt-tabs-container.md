# Slice 08: Prompt Tabs Container

> **Slice 08 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-prompt-tabs-container` |
| **Test** | `pnpm test components/workspace/__tests__/prompt-tabs.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-prompt-area-structured-fields"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-tabs.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (workspace-state Context mocken, Child-Components als Stubs) |

---

## Ziel

Eine Tab-Leiste ueber dem Prompt-Bereich erstellen mit drei Tabs: Prompt, History, Favorites. Tab-Wechsel zeigt den entsprechenden Content-Bereich an. Der Prompt-Tab rendert die bestehenden strukturierten Felder aus Slice 07. History- und Favorites-Tabs zeigen vorerst Platzhalter-Content.

---

## Acceptance Criteria

1. GIVEN die Prompt Area wird gerendert
   WHEN der User die Komponente sieht
   THEN ist eine Tab-Leiste mit genau 3 Tabs sichtbar: "Prompt", "History", "Favorites"

2. GIVEN die Prompt Area wird initial gerendert
   WHEN kein Tab explizit ausgewaehlt wurde
   THEN ist der "Prompt"-Tab aktiv (visuell hervorgehoben) und der Prompt-Content sichtbar

3. GIVEN der "Prompt"-Tab ist aktiv
   WHEN der User den Prompt-Content-Bereich betrachtet
   THEN sind die strukturierten Felder aus Slice 07 sichtbar (Motiv, Style/Modifier, Negative Prompt, Model-Selector, Generate-Button)

4. GIVEN der "Prompt"-Tab ist aktiv
   WHEN der User auf den "History"-Tab klickt
   THEN wird der History-Content-Bereich angezeigt und der Prompt-Content ist nicht mehr sichtbar

5. GIVEN der "Prompt"-Tab ist aktiv
   WHEN der User auf den "Favorites"-Tab klickt
   THEN wird der Favorites-Content-Bereich angezeigt und der Prompt-Content ist nicht mehr sichtbar

6. GIVEN der "History"-Tab ist aktiv
   WHEN der User den History-Content-Bereich betrachtet
   THEN wird ein Platzhalter-Text angezeigt: "Prompt history will appear here."

7. GIVEN der "Favorites"-Tab ist aktiv
   WHEN der User den Favorites-Content-Bereich betrachtet
   THEN wird ein Platzhalter-Text angezeigt: "Favorite prompts will appear here."

8. GIVEN ein beliebiger Tab ist aktiv
   WHEN der User auf einen anderen Tab klickt
   THEN wechselt die visuelle Hervorhebung zum angeklickten Tab

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-tabs.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Prompt Tabs Container', () => {
  // AC-1: Drei Tabs sichtbar
  it.todo('should render three tabs: Prompt, History, Favorites')

  // AC-2: Prompt-Tab ist initial aktiv
  it.todo('should show Prompt tab as active by default with prompt content visible')

  // AC-3: Prompt-Tab zeigt strukturierte Felder
  it.todo('should render structured prompt fields when Prompt tab is active')

  // AC-4: Wechsel zu History-Tab
  it.todo('should show history content and hide prompt content when History tab is clicked')

  // AC-5: Wechsel zu Favorites-Tab
  it.todo('should show favorites content and hide prompt content when Favorites tab is clicked')

  // AC-6: History-Platzhalter
  it.todo('should display placeholder text "Prompt history will appear here." in History tab')

  // AC-7: Favorites-Platzhalter
  it.todo('should display placeholder text "Favorite prompts will appear here." in Favorites tab')

  // AC-8: Tab-Highlight wechselt
  it.todo('should visually highlight the active tab when switching between tabs')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07-prompt-area-structured-fields` | Structured Prompt Fields UI | Component-Content | Motiv-, Style-, NegativePrompt-Felder + Model-Selector + Generate-Button als Prompt-Tab-Content |
| `slice-07-prompt-area-structured-fields` | `prompt-area.tsx` | Component | Bestehende Prompt-Area-Logik wird in den Prompt-Tab eingebettet |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptTabs` | Component | `prompt-area.tsx` | `<PromptTabs activeTab={string} onTabChange={(tab) => void}>` |
| Tab-Content-Slots | Component-Slots | History (spaetere Slices), Favorites (spaetere Slices) | History- und Favorites-Platzhalter werden durch echte Komponenten ersetzt |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-tabs.tsx` -- Neue Komponente: Tab-Leiste mit 3 Tabs (Prompt, History, Favorites) und Content-Switching-Logik. Nutzt shadcn Tabs. Prompt-Tab rendert bestehende strukturierte Felder, History/Favorites zeigen Platzhalter.
- [ ] `components/workspace/prompt-area.tsx` -- Integration: PromptTabs als Wrapper um den bestehenden Prompt-Content einbauen. Tab-State verwalten.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE History-Daten laden oder anzeigen -- gehoert zu spaeteren History-Slices
- KEINE Favorites-Daten laden oder anzeigen -- gehoert zu spaeteren Favorites-Slices
- KEINE Server Actions fuer History/Favorites -- nur UI-Shell mit Platzhaltern
- KEINE Aenderungen an den strukturierten Feldern selbst (Slice 07 Logik bleibt)
- KEIN Confirmation-Dialog beim Tab-Wechsel

**Technische Constraints:**
- Nutze shadcn Tabs Komponente (`components/ui/tabs.tsx`) -- bereits im Projekt verfuegbar
- Tab-Werte: `"prompt"`, `"history"`, `"favorites"` als String-Konstanten
- Default-Tab: `"prompt"`
- `data-testid="prompt-tabs"` auf dem Tabs-Container
- `data-testid="tab-prompt"`, `data-testid="tab-history"`, `data-testid="tab-favorites"` auf den Tab-Triggern

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Migration Map" Zeile 369 (prompt-tabs.tsx)
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Workspace (Sidebar Expanded)" Annotation 3 (Zeile 168): Tab-Leiste [Prompt][History][Favorites]
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "History Tab" (Zeilen 266-316) und "Favorites Tab" (Zeilen 319-349) fuer spaetere Content-Struktur
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` -- Section "UI Components & States" Zeile 221: Prompt-Tab-Leiste States
