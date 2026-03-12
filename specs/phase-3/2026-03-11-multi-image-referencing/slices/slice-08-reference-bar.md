# Slice 08: ReferenceBar Component

> **Slice 08 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-reference-bar` |
| **Test** | `pnpm test components/workspace/__tests__/reference-bar` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-reference-slot"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest + Testing Library) |
| **Test Command** | `pnpm test components/workspace/__tests__/reference-bar` |
| **Integration Command** | — |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/reference-bar` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Actions mocken, ReferenceSlot als Child rendern) |

---

## Ziel

Collapsible Container-Component bereitstellen, der mehrere ReferenceSlots verwaltet. Stellt die drei visuellen Bar-States (collapsed-empty, collapsed-filled, expanded) dar, erzwingt das 5-Slot-Maximum, vergibt stabile sparse @-Nummern und bietet eine Trailing Empty Dropzone fuer neue Uploads.

---

## Acceptance Criteria

1) GIVEN eine ReferenceBar ohne Referenz-Bilder (`slots` ist leeres Array)
   WHEN sie gerendert wird
   THEN zeigt der Header: Chevron-Right-Icon, Text "References (0)", und einen aktiven [+ Add]-Button

2) GIVEN eine ReferenceBar mit 3 Referenzen (Positionen @1, @3, @5)
   WHEN der Header im collapsed-State gerendert wird
   THEN zeigt er: Chevron-Right-Icon, Counter-Badge "[3/5]", Mini-Thumbnails mit sparse Labels (@1, @3, @5), und einen aktiven [+ Add]-Button

3) GIVEN eine ReferenceBar im collapsed-State
   WHEN der User auf den Header klickt
   THEN expandiert die Bar und zeigt alle ReferenceSlot-Components in voller Groesse

4) GIVEN eine ReferenceBar im expanded-State
   WHEN der User auf den Header klickt
   THEN kollabiert die Bar (collapsed-filled bei vorhandenen Slots, collapsed-empty bei 0 Slots)

5) GIVEN eine ReferenceBar im collapsed-empty-State
   WHEN der User das erste Bild per [+ Add]-Button hochlaedt
   THEN expandiert die Bar automatisch (auto-expand) und der neue Slot erhaelt die Position @1

6) GIVEN eine ReferenceBar mit Slots an Positionen @1 und @3 (Position @2 frei)
   WHEN ein neues Bild hinzugefuegt wird
   THEN erhaelt der neue Slot die Position @2 (niedrigste freie Nummer)

7) GIVEN eine ReferenceBar mit 3 Slots (@1, @2, @3)
   WHEN Slot @2 per Remove-Button entfernt wird
   THEN bleiben die verbleibenden Slots bei @1 und @3 (kein Re-Numbering) und der Counter zeigt "[2/5]"

8) GIVEN eine ReferenceBar mit exakt 5 Slots (@1 bis @5)
   WHEN sie gerendert wird
   THEN ist der [+ Add]-Button disabled und es wird keine Trailing Empty Dropzone angezeigt

9) GIVEN eine ReferenceBar mit weniger als 5 Slots
   WHEN sie im expanded-State gerendert wird
   THEN erscheint unterhalb des letzten gefuellten Slots eine leere Dropzone (Trailing Empty Dropzone) die als Upload-Target dient

10) GIVEN eine ReferenceBar
    WHEN ein Slot per `onRemove` entfernt wird und danach ein neues Bild hinzugefuegt wird
    THEN fuellt das neue Bild die niedrigste freie Position (z.B. nach Entfernen von @2 aus @1,@2,@3 wird @2 wiederverwendet, nicht @4)

11) GIVEN eine ReferenceBar mit dem [+ Add]-Button
    WHEN der User klickt
    THEN oeffnet sich ein nativer Datei-Dialog (accept: image/png, image/jpeg, image/webp)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/workspace/__tests__/reference-bar.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ReferenceBar', () => {
  describe('Collapsed-Empty State', () => {
    // AC-1: Leerer State zeigt Chevron-Right, "References (0)", aktiven Add-Button
    it.todo('should render collapsed-empty with chevron-right, "References (0)" text, and enabled add button')
  })

  describe('Collapsed-Filled State', () => {
    // AC-2: Mini-Thumbnails mit sparse Labels und Counter-Badge
    it.todo('should render counter badge [3/5] with mini-thumbnails showing sparse labels @1, @3, @5')
  })

  describe('Collapse/Expand Toggle', () => {
    // AC-3: Header-Click expandiert
    it.todo('should expand bar and show full ReferenceSlots when collapsed header is clicked')

    // AC-4: Header-Click kollabiert
    it.todo('should collapse bar when expanded header is clicked')
  })

  describe('Auto-Expand', () => {
    // AC-5: Erstes Bild triggert Auto-Expand
    it.todo('should auto-expand when first image is added via add button')
  })

  describe('Sparse Slot Numbering', () => {
    // AC-6: Neue Bilder fuellen niedrigste freie Nummer
    it.todo('should assign lowest free position number to new slot when gaps exist')

    // AC-7: Labels bleiben stabil bei Remove
    it.todo('should not renumber remaining slots when a slot is removed')

    // AC-10: Wiederverwendung freigewordener Positionen
    it.todo('should reuse freed position number for next added image')
  })

  describe('Max 5 Slots', () => {
    // AC-8: Add-Button disabled und keine Trailing Dropzone bei 5/5
    it.todo('should disable add button and hide trailing dropzone when 5 slots are filled')
  })

  describe('Trailing Empty Dropzone', () => {
    // AC-9: Dropzone unterhalb letztem Slot bei < 5
    it.todo('should render trailing empty dropzone below last filled slot when under 5 slots')
  })

  describe('Add Button', () => {
    // AC-11: Datei-Dialog oeffnen
    it.todo('should open native file dialog accepting png, jpeg, webp when add button is clicked')
  })
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-07-reference-slot | `ReferenceSlot` | React Component | `<ReferenceSlot slotData={data} dimmed={bool} onUpload={fn} onUploadUrl={fn} onRoleChange={fn} onStrengthChange={fn} onRemove={fn} />` |
| slice-07-reference-slot | `ReferenceSlotData` | TypeScript Type | `import { ReferenceSlotData } from "@/lib/types/reference"` |
| slice-07-reference-slot | `ReferenceRole`, `ReferenceStrength` | TypeScript Types | Union-Types fuer Role/Strength |
| slice-06-ui-setup-collapsible | `Collapsible` | React Component | `import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ReferenceBar` | React Component | slice-09 (PromptArea Integration) | `<ReferenceBar slots={ReferenceSlotData[]} onAdd={fn} onRemove={fn} onRoleChange={fn} onStrengthChange={fn} onUpload={fn} onUploadUrl={fn} />` |
| Sparse-Label-Algorithmus | Business Logic (intern) | slice-09, slice-14 | `getLowestFreePosition(occupiedPositions: number[]): number` (1-5) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/reference-bar.tsx` -- ReferenceBar Component mit Collapsible Header, Counter-Badge, Mini-Thumbnails, AddReferenceButton, Trailing Empty Dropzone, Sparse-Label-Logik
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Integration in PromptArea -- das ist Slice 09
- KEINE Server-Action-Aufrufe direkt -- ReferenceBar delegiert alle Aktionen ueber Callback-Props an den Parent
- KEINE Gallery-Drag-Erkennung -- das ist Slice 14
- KEIN State-Management per Context/Store -- ReferenceBar ist ein kontrollierter Component (Slots kommen per Props)
- KEINE CompatibilityWarning-Logik -- das ist Slice 11
- KEINE RefHintBanner -- das ist Slice 10

**Technische Constraints:**
- shadcn Collapsible fuer Expand/Collapse-Verhalten (aus Slice 06)
- shadcn Badge fuer Counter-Badge und Mini-Thumbnail-Labels
- Alle Daten und Callbacks als Props (Controlled Component Pattern)
- Sparse-Label-Algorithmus: Position 1-5, niedrigste freie Nummer bei Hinzufuegen, kein Re-Numbering bei Entfernen
- Mini-Thumbnails im collapsed-filled State: kleine quadratische Previews (ca. 24x24) mit @N-Label

**Referenzen:**
- Architecture: `architecture.md` --> Section "Validation Rules" (max 5 Referenzen)
- Wireframes: `wireframes.md` --> Screen "Prompt Area -- img2img Mode (Full View)" + Screen "Reference Bar -- Collapsed Empty" + Screen "Reference Bar -- Collapsed with Images"
- Discovery: `discovery.md` --> Section "Feature State Machine" (Reference Bar State) + Section "Business Rules" (Slot-Labels, Max 5)
