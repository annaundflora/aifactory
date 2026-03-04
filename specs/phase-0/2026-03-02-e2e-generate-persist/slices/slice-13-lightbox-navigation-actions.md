# Slice 13: Lightbox Navigation + Actions

> **Slice 13 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-lightbox-navigation-actions` |
| **Test** | `pnpm test components/lightbox/__tests__/lightbox-navigation.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-lightbox-modal"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/lightbox/__tests__/lightbox-navigation.test.tsx` |
| **Integration Command** | `pnpm test app/actions/__tests__/generations.test.ts` |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (DB + R2 gemockt fuer deleteGeneration Server Action, Navigation rein client-seitig) |

---

## Ziel

Lightbox um Prev/Next-Navigation (Chevron-Buttons + Pfeiltasten mit Wrap-Around) und eine Delete-Aktion mit Bestaetigungsdialog erweitern. Das Loeschen entfernt die Generation aus der Datenbank und das zugehoerige Bild aus R2 via Server Action `deleteGeneration`.

---

## Acceptance Criteria

1) GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   WHEN der User auf den Next-Chevron-Button klickt
   THEN wird die 4. Generation angezeigt

2) GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   WHEN der User die rechte Pfeiltaste drueckt
   THEN wird die 4. Generation angezeigt

3) GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   WHEN der User auf den Prev-Chevron-Button klickt
   THEN wird die 2. Generation angezeigt

4) GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   WHEN der User die linke Pfeiltaste drueckt
   THEN wird die 2. Generation angezeigt

5) GIVEN eine Lightbox mit 5 Generierungen und die letzte (5.) Generation ist ausgewaehlt
   WHEN der User auf Next klickt oder die rechte Pfeiltaste drueckt
   THEN wird die 1. Generation angezeigt (Wrap-Around)

6) GIVEN eine Lightbox mit 5 Generierungen und die erste (1.) Generation ist ausgewaehlt
   WHEN der User auf Prev klickt oder die linke Pfeiltaste drueckt
   THEN wird die 5. Generation angezeigt (Wrap-Around)

7) GIVEN eine Lightbox mit nur 1 Generation
   WHEN die Navigation gerendert wird
   THEN sind die Prev/Next-Buttons NICHT sichtbar oder disabled

8) GIVEN eine geoeffnete Lightbox mit einer Generation
   WHEN der User auf den Delete-Button klickt
   THEN wird ein Bestaetigungsdialog angezeigt mit dem Text "Delete this generation?"

9) GIVEN ein sichtbarer Bestaetigungsdialog fuer das Loeschen
   WHEN der User auf "Cancel" klickt
   THEN schliesst sich der Dialog und die Generation bleibt erhalten

10) GIVEN ein sichtbarer Bestaetigungsdialog fuer das Loeschen
    WHEN der User auf "Delete" bestaetigt
    THEN wird die Server Action `deleteGeneration` mit der Generation-ID aufgerufen
    AND die Generation wird aus der DB geloescht
    AND das Bild wird aus R2 geloescht
    AND die Lightbox zeigt die naechste Generation (oder schliesst bei letztem Bild)

11) GIVEN die `deleteGeneration` Server Action wird mit einer gültigen Generation-ID aufgerufen
    WHEN die Generation existiert und eine `image_url` hat
    THEN wird der DB-Eintrag geloescht, das R2-Objekt geloescht und `{ success: true }` zurueckgegeben

12) GIVEN die `deleteGeneration` Server Action wird mit einer nicht-existierenden ID aufgerufen
    WHEN die Aktion ausgefuehrt wird
    THEN wird `{ success: false }` oder ein Fehler zurueckgegeben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/lightbox/__tests__/lightbox-navigation.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LightboxNavigation', () => {
  // AC-1: Next-Button Navigation
  it.todo('should show next generation when next chevron button is clicked')

  // AC-2: Rechte Pfeiltaste
  it.todo('should show next generation when right arrow key is pressed')

  // AC-3: Prev-Button Navigation
  it.todo('should show previous generation when prev chevron button is clicked')

  // AC-4: Linke Pfeiltaste
  it.todo('should show previous generation when left arrow key is pressed')

  // AC-5: Wrap-Around vorwaerts
  it.todo('should wrap to first generation when pressing next on last generation')

  // AC-6: Wrap-Around rueckwaerts
  it.todo('should wrap to last generation when pressing prev on first generation')

  // AC-7: Einzelne Generation
  it.todo('should hide or disable navigation buttons when only one generation exists')

  // AC-8: Delete-Button oeffnet Bestaetigungsdialog
  it.todo('should show confirmation dialog when delete button is clicked')

  // AC-9: Cancel schliesst Dialog
  it.todo('should close confirmation dialog and keep generation when cancel is clicked')

  // AC-10: Delete bestaetigt
  it.todo('should call deleteGeneration action and update lightbox after confirmation')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('deleteGeneration Server Action', () => {
  // AC-11: Erfolgreiche Loeschung
  it.todo('should delete generation from DB and image from R2 and return success true')

  // AC-12: Nicht-existierende Generation
  it.todo('should return success false or error for non-existing generation ID')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12` | `LightboxModal` | React Component | Stellt Modal-Shell bereit, in die Navigation und Actions integriert werden |
| `slice-12` | `Generation` Type | TypeScript Type | Generation-Entity mit `id`, `image_url` aus `lib/db/schema.ts` |
| `slice-02` | `StorageService.delete` | Function | Loescht Bild aus R2 anhand des Keys |
| `slice-01` | DB Connection + Schema | Module | `lib/db/` fuer Generation-Queries |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `LightboxNavigation` | React Component | slice-12 (Integration) | `<LightboxNavigation generations={Generation[]} currentIndex={number} onNavigate={(index: number) => void} />` |
| `deleteGeneration` | Server Action | slice-12, slice-15 | `(id: string) => Promise<{ success: boolean }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/lightbox-navigation.tsx` -- Prev/Next Chevron-Buttons, Keyboard-Navigation, Delete-Button mit Bestaetigungsdialog
- [ ] `app/actions/generations.ts` -- `deleteGeneration` Server Action (DB DELETE + R2 DELETE)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Download-Funktionalitaet -- kommt in Slice 15
- KEINE Variation-Funktionalitaet -- kommt in spaeterem Slice
- KEINE Aenderung an der LightboxModal-Shell (Detail-Panel, Overlay, Close) -- das ist Slice 12

**Technische Constraints:**
- Client Component (`"use client"`) fuer Navigation (Keyboard-Events, State)
- Keyboard-Listener muss Escape (Slice 12) NICHT interferieren -- nur ArrowLeft/ArrowRight abfangen
- `deleteGeneration` Server Action nutzt `"use server"`, fuehrt DB DELETE zuerst aus, dann R2 DELETE
- Bestaetigungsdialog via `confirm-dialog` Shared Component (siehe `components/shared/confirm-dialog.tsx`)
- `revalidatePath` nach erfolgreichem Loeschen fuer Gallery-Update

**Referenzen:**
- Architecture: `architecture.md` -> Section "Server Actions" (`deleteGeneration` Signatur)
- Architecture: `architecture.md` -> Section "Quality Attributes" (Data Integrity: DB first, then R2)
- Wireframes: `wireframes.md` -> Section "Screen: Lightbox / Image Detail Modal" (Annotationen 2, 3, 9)
- Wireframes: `wireframes.md` -> Section "State Variations" (`confirm-delete`)
- Wireframes: `wireframes.md` -> Section "Screen: Confirmation Dialog"
- Discovery: `discovery.md` -> Section "Feature State Machine" -> Transition `lightbox-open` + Delete/Navigation
