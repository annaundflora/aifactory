# Slice 13: Favorites List UI

> **Slice 13 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-favorites-list-ui` |
| **Test** | `pnpm test components/workspace/__tests__/favorites-list.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-history-list-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/favorites-list.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (Server Actions mocken, workspace-state Context mocken) |

---

## Ziel

Eine `favorites-list.tsx` Komponente erstellen, die im Favorites-Tab nur favorisierte Prompts (`is_favorite = true`) anzeigt. Die Darstellung ist identisch zur History-Liste (Slice 12): Prompt-Preview, Modell-Badge, relativer Zeitstempel und Stern-Toggle. Beim Entfernen eines Favoriten verschwindet der Eintrag aus der Liste. Ein Empty-State wird angezeigt wenn keine Favoriten existieren.

---

## Acceptance Criteria

1. GIVEN der Favorites-Tab ist aktiv und es existieren 2 favorisierte Eintraege
   WHEN die Komponente rendert
   THEN werden genau 2 Eintraege angezeigt, jeweils mit: Prompt-Preview-Text (max 80 Zeichen, danach "..."), Modell-Name als Badge, relativer Zeitstempel, ausgefuelltem Stern-Icon

2. GIVEN ein favorisierter Eintrag mit `isFavorite = true`
   WHEN der User auf den Stern klickt
   THEN wird die `toggleFavorite` Server Action mit der `generationId` aufgerufen und der Eintrag verschwindet aus der Favorites-Liste

3. GIVEN keine favorisierten Eintraege existieren
   WHEN die Komponente rendert
   THEN wird der Empty-State angezeigt: "No favorites yet. Star prompts in History to save them here."

4. GIVEN 60 favorisierte Eintraege in der DB
   WHEN die Komponente initial rendert
   THEN werden die ersten 50 Eintraege geladen und ein "Load more"-Bereich ist am Ende sichtbar

5. GIVEN 50 favorisierte Eintraege sind geladen und weitere existieren
   WHEN der User zum Ende scrollt oder auf "Load more" klickt
   THEN werden die naechsten 50 Eintraege geladen und an die bestehende Liste angehaengt

6. GIVEN alle Prompt-Felder (Motiv, Style, Negative) sind leer
   WHEN der User auf einen Favorites-Eintrag klickt
   THEN werden die Prompt-Felder direkt mit den Werten des Eintrags befuellt (Motiv, Style, Negative Prompt) und der Tab wechselt zu "Prompt"

7. GIVEN mindestens ein Prompt-Feld enthaelt Text
   WHEN der User auf einen Favorites-Eintrag klickt
   THEN erscheint ein Confirmation-Dialog mit Text "Replace current prompt?" und Buttons "Cancel" / "Apply"

8. GIVEN der Confirmation-Dialog ist sichtbar
   WHEN der User auf "Apply" klickt
   THEN werden die Prompt-Felder mit den Werten des Favorites-Eintrags befuellt und der Tab wechselt zu "Prompt"

9. GIVEN der Confirmation-Dialog ist sichtbar
   WHEN der User auf "Cancel" klickt
   THEN schliesst der Dialog und die bestehenden Prompt-Felder bleiben unveraendert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/favorites-list.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Favorites List', () => {
  // AC-1: Favorisierte Eintraege mit Preview, Badge, Zeitstempel, Stern
  it.todo('should render only favorited entries with prompt preview, model badge, relative timestamp, and filled star')

  // AC-2: Stern-Toggle entfernt Eintrag aus Liste
  it.todo('should call toggleFavorite and remove entry from list when star is clicked')

  // AC-3: Empty-State
  it.todo('should show empty state message when no favorites exist')

  // AC-4: Initial 50 Eintraege mit Load-More
  it.todo('should load first 50 entries and show load-more indicator')

  // AC-5: Load-More laedt naechsten Batch
  it.todo('should append next batch of entries when load-more is triggered')

  // AC-6: Klick bei leeren Feldern befuellt direkt
  it.todo('should fill prompt fields directly when all fields are empty and entry is clicked')

  // AC-7: Klick bei gefuellten Feldern zeigt Dialog
  it.todo('should show confirmation dialog when clicking entry with non-empty prompt fields')

  // AC-8: Apply im Dialog befuellt Felder
  it.todo('should fill prompt fields and switch to Prompt tab when Apply is clicked in dialog')

  // AC-9: Cancel im Dialog laesst Felder unveraendert
  it.todo('should keep prompt fields unchanged when Cancel is clicked in dialog')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-prompt-tabs-container` | Favorites-Tab Content-Slot | Component-Slot | FavoritesList ersetzt den Platzhalter-Text im Favorites-Tab |
| `slice-08-prompt-tabs-container` | Tab-Wechsel Mechanismus | Callback | `onTabChange("prompt")` beim Laden eines Eintrags |
| `slice-11-prompt-history-service` | `getFavoritePrompts` | Server Action | `(input: { offset?: number, limit?: number }) => Promise<PromptHistoryEntry[]>` |
| `slice-11-prompt-history-service` | `toggleFavorite` | Server Action | `(input: { generationId: string }) => Promise<{ isFavorite: boolean }>` |
| `slice-12-history-list-ui` | UI-Patterns | Reference | Gleiche Darstellungslogik (Prompt-Truncation, Badge, Zeitstempel, Stern) wie History-Liste |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `FavoritesList` | Component | `prompt-tabs.tsx` | `<FavoritesList onLoadEntry={(entry: PromptHistoryEntry) => void} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/favorites-list.tsx` -- Neue Komponente: gefilterte Favorites-Ansicht mit Prompt-Preview, Modell-Badge, relativem Zeitstempel, Stern-Toggle (Entfernen), Scroll-to-Load-More Pagination, Klick-Handler mit Confirmation-Dialog, Empty-State
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an der History-Liste (Slice 12)
- KEINE Aenderungen am prompt-history-service oder Server Actions (Slice 11)
- KEINE Schema- oder DB-Aenderungen
- KEIN Modell- oder Parameter-Wechsel beim Laden eines Eintrags (nur Prompt-Felder befuellen)

**Technische Constraints:**
- Nutze shadcn AlertDialog fuer den Confirmation-Dialog (bereits im Projekt)
- Gleiche Darstellungslogik wie `history-list.tsx` verwenden (Prompt-Truncation bei 80 Zeichen, relative Zeitstempel, Stern-Icons)
- Beim Stern-Toggle: Eintrag optimistisch aus der lokalen Liste entfernen (da `isFavorite` auf `false` gesetzt wird, gehoert er nicht mehr in die Favorites-Ansicht)
- Pagination: Batch-Groesse 50, offset-basiert gemaess architecture.md
- `data-testid="favorites-list"` auf dem Container
- `data-testid="favorites-entry"` auf jedem Listeneintrag
- `data-testid="star-toggle"` auf jedem Stern-Button
- `data-testid="load-more"` auf dem Load-More-Trigger
- `data-testid="favorites-empty"` auf dem Empty-State Container
- Wiederverwendung gemeinsamer UI-Elemente aus Slice 12 ist empfohlen (z.B. Hilfs-Komponente fuer Eintragsdarstellung), aber nicht erzwungen

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "API Design (Server Actions)" fuer `getFavoritePrompts` Action-Signatur
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "PromptHistoryEntry Type" fuer Datenstruktur
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Workspace - Favorites Tab" (Zeilen 319-349) fuer Layout und States
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Confirmation Dialog" (Zeilen 388-414) fuer Dialog-Text und Buttons
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` -- Section "Flow 5: Prompt als Favorit markieren" und "Business Rules"
