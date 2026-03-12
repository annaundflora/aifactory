# Slice 10: RefHintBanner

> **Slice 10 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-ref-hint-banner` |
| **Test** | `pnpm test components/workspace/__tests__/ref-hint-banner` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-prompt-area-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest + Testing Library) |
| **Test Command** | `pnpm test components/workspace/__tests__/ref-hint-banner` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/ref-hint-banner` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (localStorage mocken via vi.stubGlobal) |

---

## Ziel

Ein dismissible Info-Banner unterhalb der Prompt-Felder, das Usern die @-Referenz-Syntax erklaert. Der Banner-Text zeigt dynamisch die tatsaechlichen sparse @-Nummern der aktuell geladenen Referenzen. Der Dismiss-State wird in localStorage persistiert, sodass der Banner nach einem Page-Reload nicht wieder erscheint.

---

## Acceptance Criteria

1) GIVEN PromptArea im `img2img`-Modus mit 3 Referenzen in Slots @1, @3, @5
   WHEN der RefHintBanner gerendert wird und nicht dismissed ist
   THEN zeigt der Banner den Text "Tipp: Nutze @1, @3, @5 im Prompt um Referenzen anzusprechen" mit einem Info-Icon und einem Dismiss-Button [x]

2) GIVEN PromptArea im `img2img`-Modus mit 1 Referenz in Slot @2
   WHEN der RefHintBanner gerendert wird
   THEN zeigt der Banner den Text "Tipp: Nutze @2 im Prompt um Referenzen anzusprechen" (nur vorhandene @-Nummern, dynamisch)

3) GIVEN PromptArea mit 0 Referenzen (keine Slots belegt)
   WHEN der RefHintBanner gerendert wird
   THEN ist der Banner NICHT sichtbar (nicht im DOM oder hidden)

4) GIVEN RefHintBanner ist sichtbar mit Referenzen geladen
   WHEN der User den Dismiss-Button [x] klickt
   THEN verschwindet der Banner UND localStorage enthaelt den Key `ref-hint-dismissed` mit dem Wert `"true"`

5) GIVEN localStorage enthaelt `ref-hint-dismissed: "true"` UND es sind Referenzen geladen
   WHEN die Seite neu geladen wird und der RefHintBanner gerendert wird
   THEN ist der Banner NICHT sichtbar (Dismiss persistiert ueber Reload)

6) GIVEN RefHintBanner wurde dismissed UND alle Referenzen werden entfernt (0 Slots)
   WHEN danach neue Referenzen hinzugefuegt werden
   THEN bleibt der Banner dismissed (kein automatisches Reset bei Referenz-Aenderungen)

7) GIVEN PromptArea im `txt2img`-Modus mit geladenen Referenzen
   WHEN der RefHintBanner gerendert wird
   THEN ist der Banner NICHT sichtbar (nur im img2img-Modus relevant)

8) GIVEN Referenzen mit Slots @1 und @4
   WHEN Slot @1 entfernt wird (nur @4 verbleibt)
   THEN aktualisiert der Banner den Text auf "Tipp: Nutze @4 im Prompt um Referenzen anzusprechen"

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/workspace/__tests__/ref-hint-banner.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('RefHintBanner', () => {
  describe('Visibility & Dynamic Text', () => {
    // AC-1: Banner zeigt sparse @-Nummern bei mehreren Referenzen
    it.todo('should display banner with text containing @1, @3, @5 when three references at those slots are loaded')

    // AC-2: Banner zeigt einzelne @-Nummer
    it.todo('should display banner with text containing only @2 when single reference at slot 2 is loaded')

    // AC-3: Banner hidden bei 0 Referenzen
    it.todo('should not render banner when no reference slots are filled')

    // AC-7: Banner hidden im txt2img-Modus
    it.todo('should not render banner in txt2img mode even with references loaded')

    // AC-8: Banner-Text aktualisiert sich bei Slot-Entfernung
    it.todo('should update banner text when a reference slot is removed')
  })

  describe('Dismiss Behavior', () => {
    // AC-4: Dismiss setzt localStorage und versteckt Banner
    it.todo('should hide banner and set localStorage ref-hint-dismissed to true on dismiss click')

    // AC-5: Dismiss persistiert ueber Reload
    it.todo('should not render banner when localStorage ref-hint-dismissed is true')

    // AC-6: Dismiss bleibt nach Referenz-Aenderungen
    it.todo('should keep banner dismissed when references are removed and re-added')
  })
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-09-prompt-area-integration | `referenceSlots` State | `ReferenceSlotData[]` | Array mit `slotPosition: number` pro Eintrag, verfuegbar in PromptArea |
| slice-07-reference-slot | `ReferenceSlotData` | TypeScript Type | Import aus `@/lib/types/reference` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `RefHintBanner` | React Component | slice-09 (eingebettet in PromptArea) | `<RefHintBanner slots={ReferenceSlotData[]} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/ref-hint-banner.tsx` -- Dismissible Info-Banner mit dynamischen sparse @-Nummern, localStorage-Persistenz
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE @-Token Erkennung oder Prompt-Manipulation -- das ist Slice 12
- KEINE CompatibilityWarning-Logik -- das ist Slice 11
- KEINE Aenderungen an prompt-area.tsx -- Integration des Banners in PromptArea ist Aufgabe des Implementers von Slice 09 (Banner wird als Child-Component bereitgestellt)
- KEIN Reset des Dismiss-State bei Referenz-Aenderungen -- einmal dismissed bleibt dismissed

**Technische Constraints:**
- localStorage Key: `ref-hint-dismissed` (exakt dieser String)
- Banner als reine Presentational Component: empfaengt `slots` als Prop, liest localStorage selbst
- @-Nummern aus `slots[].slotPosition` extrahieren, aufsteigend sortiert
- shadcn-konsistentes Styling (Info-Banner mit Accent-Background, analog zu bestehenden Alert-Patterns)

**Referenzen:**
- Wireframes: `wireframes.md` --> Screen "Ref Hint Banner" (Layout, Position, Dismiss-Button)
- Discovery: `discovery.md` --> Section "UI Components & States" (RefHintBanner Beschreibung)
- Architecture: `architecture.md` --> Section "Constraints" (Sparse Slot Numbering)
