# Slice 12: History List UI

> **Slice 12 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-history-list-ui` |
| **Test** | `pnpm test components/workspace/__tests__/history-list.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-prompt-tabs-container", "slice-11-prompt-history-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/history-list.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (Server Actions mocken, workspace-state Context mocken) |

---

## Ziel

Eine `history-list.tsx` Komponente erstellen, die im History-Tab (aus Slice 08) eine chronologische Liste von Prompt-History-Eintraegen rendert. Jeder Eintrag zeigt Prompt-Preview (gekuerzt), Modell-Badge, relativen Zeitstempel und Stern-Toggle. Pagination via Scroll-to-Load-More (50 pro Batch). Klick auf einen Eintrag laedt die Prompt-Felder mit Confirmation-Dialog wenn Felder nicht leer.

---

## Acceptance Criteria

1. GIVEN der History-Tab ist aktiv und es existieren 3 History-Eintraege
   WHEN die Komponente rendert
   THEN werden 3 Eintraege sichtbar, jeweils mit: Prompt-Preview-Text (max 80 Zeichen, danach "..."), Modell-Name als Badge, relativer Zeitstempel (z.B. "2 hours ago", "yesterday")

2. GIVEN ein History-Eintrag mit `promptMotiv = "A majestic eagle soaring over snow-capped mountain peaks at golden hour"` (75 Zeichen)
   WHEN der Eintrag gerendert wird
   THEN wird der vollstaendige Text angezeigt (unter 80-Zeichen-Limit)

3. GIVEN ein History-Eintrag mit einem `promptMotiv` von 120 Zeichen
   WHEN der Eintrag gerendert wird
   THEN werden die ersten 80 Zeichen plus "..." angezeigt

4. GIVEN ein History-Eintrag mit `isFavorite = false`
   WHEN der User auf den Stern klickt
   THEN wird der Stern als ausgefuellt dargestellt und die `toggleFavorite` Server Action mit der `generationId` aufgerufen

5. GIVEN ein History-Eintrag mit `isFavorite = true`
   WHEN der User auf den Stern klickt
   THEN wird der Stern als Outline dargestellt und die `toggleFavorite` Server Action aufgerufen

6. GIVEN 60 History-Eintraege in der DB
   WHEN die Komponente initial rendert
   THEN werden die ersten 50 Eintraege geladen und ein "Load more"-Bereich ist am Ende sichtbar

7. GIVEN 50 Eintraege sind geladen und weitere existieren
   WHEN der User zum Ende scrollt oder auf "Load more" klickt
   THEN werden die naechsten 50 Eintraege geladen und an die bestehende Liste angehaengt

8. GIVEN alle Prompt-Felder (Motiv, Style, Negative) sind leer
   WHEN der User auf einen History-Eintrag klickt
   THEN werden die Prompt-Felder direkt mit den Werten des Eintrags befuellt (Motiv, Style, Negative Prompt) und der Tab wechselt zu "Prompt"

9. GIVEN mindestens ein Prompt-Feld enthaelt Text
   WHEN der User auf einen History-Eintrag klickt
   THEN erscheint ein Confirmation-Dialog mit Text "Replace current prompt?" und Buttons "Cancel" / "Apply"

10. GIVEN der Confirmation-Dialog ist sichtbar
    WHEN der User auf "Apply" klickt
    THEN werden die Prompt-Felder mit den Werten des History-Eintrags befuellt und der Tab wechselt zu "Prompt"

11. GIVEN der Confirmation-Dialog ist sichtbar
    WHEN der User auf "Cancel" klickt
    THEN schliesst der Dialog und die bestehenden Prompt-Felder bleiben unveraendert

12. GIVEN keine History-Eintraege existieren
    WHEN die Komponente rendert
    THEN wird der Leer-Zustand angezeigt: "No prompts generated yet. Start your first generation!"

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/history-list.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('History List', () => {
  // AC-1: Eintraege mit Preview, Badge, Zeitstempel
  it.todo('should render history entries with truncated prompt preview, model badge, and relative timestamp')

  // AC-2: Kurzer Prompt vollstaendig angezeigt
  it.todo('should display full prompt text when under 80 characters')

  // AC-3: Langer Prompt gekuerzt
  it.todo('should truncate prompt text at 80 characters with ellipsis')

  // AC-4: Stern-Toggle unfavorited -> favorited
  it.todo('should call toggleFavorite and show filled star when clicking unfavorited star')

  // AC-5: Stern-Toggle favorited -> unfavorited
  it.todo('should call toggleFavorite and show outline star when clicking favorited star')

  // AC-6: Initial 50 Eintraege mit Load-More
  it.todo('should load first 50 entries and show load-more indicator')

  // AC-7: Scroll-to-Load-More laedt naechsten Batch
  it.todo('should append next batch of entries when load-more is triggered')

  // AC-8: Klick bei leeren Feldern befuellt direkt
  it.todo('should fill prompt fields directly when all fields are empty and entry is clicked')

  // AC-9: Klick bei gefuellten Feldern zeigt Dialog
  it.todo('should show confirmation dialog when clicking entry with non-empty prompt fields')

  // AC-10: Apply im Dialog befuellt Felder
  it.todo('should fill prompt fields and switch to Prompt tab when Apply is clicked in dialog')

  // AC-11: Cancel im Dialog laesst Felder unveraendert
  it.todo('should keep prompt fields unchanged when Cancel is clicked in dialog')

  // AC-12: Leer-Zustand
  it.todo('should show empty state message when no history entries exist')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-prompt-tabs-container` | History-Tab Content-Slot | Component-Slot | HistoryList ersetzt den Platzhalter-Text im History-Tab |
| `slice-08-prompt-tabs-container` | Tab-Wechsel Mechanismus | Callback | `onTabChange("prompt")` beim Laden eines Eintrags |
| `slice-11-prompt-history-service` | `getPromptHistory` | Server Action | `(input: { offset?: number, limit?: number }) => Promise<PromptHistoryEntry[]>` |
| `slice-11-prompt-history-service` | `toggleFavorite` | Server Action | `(input: { generationId: string }) => Promise<{ isFavorite: boolean }>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `HistoryList` | Component | `prompt-tabs.tsx` | `<HistoryList onLoadEntry={(entry: PromptHistoryEntry) => void} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/history-list.tsx` -- Neue Komponente: chronologische History-Liste mit Prompt-Preview, Modell-Badge, relativem Zeitstempel, Stern-Toggle, Scroll-to-Load-More Pagination, Klick-Handler mit Confirmation-Dialog
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Favorites-Liste (separater Slice)
- KEINE Aenderungen am prompt-history-service (Slice 11)
- KEINE Aenderungen an den Server Actions (Slice 11)
- KEINE Schema- oder DB-Aenderungen
- KEIN Modell- oder Parameter-Wechsel beim Laden eines Eintrags (nur Prompt-Felder befuellen)

**Technische Constraints:**
- Nutze shadcn AlertDialog fuer den Confirmation-Dialog (bereits im Projekt)
- Relativer Zeitstempel: eigene Hilfsfunktion oder leichtgewichtiges Pattern (kein date-fns oder moment)
- Stern-Icons: Lucide `Star` (outline) und `Star` (filled) mit `fill="currentColor"`
- Pagination: Batch-Groesse 50, offset-basiert gemaess architecture.md
- `data-testid="history-list"` auf dem Container
- `data-testid="history-entry"` auf jedem Listeneintrag
- `data-testid="star-toggle"` auf jedem Stern-Button
- `data-testid="load-more"` auf dem Load-More-Trigger

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Data Flow: Prompt History" fuer Pagination-Logik
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "PromptHistoryEntry Type" fuer Datenstruktur
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Workspace - History Tab" (Zeilen 266-316) fuer Layout und Annotationen
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Confirmation Dialog" (Zeilen 388-414) fuer Dialog-Text und Buttons
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` -- Section "Flow 4: Prompt aus History laden" und "Business Rules"
