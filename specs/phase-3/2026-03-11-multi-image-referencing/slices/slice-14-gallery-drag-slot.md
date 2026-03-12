# Slice 14: Gallery Drag to Reference Slot

> **Slice 14 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-gallery-drag-slot` |
| **Test** | `pnpm test components/workspace/__tests__/generation-card-drag && pnpm test components/workspace/__tests__/reference-slot-gallery-drop` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-gallery-as-reference", "slice-08-reference-bar"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest 4.x + Testing Library) |
| **Test Command** | `pnpm test components/workspace/__tests__/generation-card-drag` |
| **Integration Command** | `pnpm test components/workspace/__tests__/reference-slot-gallery-drop` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/reference-slot-gallery-drop` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Actions mocken, dataTransfer simulieren) |

---

## Ziel

Generation-Cards in der Gallery per HTML5 Drag & Drop in leere Reference-Slots ziehbar machen. Dazu Generation-Cards `draggable` machen und ein Custom `dataTransfer`-Format setzen, das Gallery-Drags von nativen File-Drops unterscheidbar macht. Im ReferenceSlot wird bei Gallery-Drag die `addGalleryAsReference`-Action (aus Slice 05) aufgerufen statt eines R2-Uploads.

---

## Acceptance Criteria

1) GIVEN eine `GenerationCard` mit `generation.id: "gen-abc"` und `generation.imageUrl: "https://r2.example.com/img.png"`
   WHEN sie gerendert wird
   THEN hat das aeussere Element das Attribut `draggable="true"`

2) GIVEN eine `GenerationCard` mit `generation.id: "gen-abc"` und `generation.imageUrl: "https://r2.example.com/img.png"`
   WHEN der User einen Drag startet (dragstart-Event)
   THEN wird `dataTransfer.setData("application/x-aifactory-generation", JSON.stringify({ generationId: "gen-abc", imageUrl: "https://r2.example.com/img.png" }))` aufgerufen und `dataTransfer.effectAllowed` ist `"copy"`

3) GIVEN eine `GenerationCard` im Drag-Zustand
   WHEN der Drag laeuft
   THEN wird ein Drag-Image (Ghost) angezeigt (natives Browser-Verhalten, kein Custom-Ghost erforderlich)

4) GIVEN ein leerer `ReferenceSlot` im `empty`-State
   WHEN ein DragOver-Event mit `dataTransfer.types` das `"application/x-aifactory-generation"` enthaelt eintrifft
   THEN wird `e.preventDefault()` aufgerufen (Drop erlaubt) und der Slot wechselt in den `drag-over`-State mit Accent-Border

5) GIVEN ein leerer `ReferenceSlot` im `empty`-State
   WHEN ein DragOver-Event NUR mit `"Files"` in `dataTransfer.types` eintrifft (nativer File-Drop)
   THEN bleibt das bestehende File-Drop-Verhalten erhalten (Upload via `onUpload`-Callback)

6) GIVEN ein leerer `ReferenceSlot` im `drag-over`-State (Gallery-Drag erkannt)
   WHEN ein Drop-Event mit `"application/x-aifactory-generation"`-Daten eintrifft (`{ generationId: "gen-abc", imageUrl: "https://r2.example.com/img.png" }`)
   THEN wird der `onGalleryDrop`-Callback mit `{ generationId: "gen-abc", imageUrl: "https://r2.example.com/img.png" }` aufgerufen und KEIN File-Upload ausgeloest

7) GIVEN ein `ReferenceSlot` im `ready`-State (bereits befuellt)
   WHEN ein DragOver-Event mit `"application/x-aifactory-generation"` eintrifft
   THEN wird der Drop NICHT erlaubt (kein `preventDefault`, kein visuelles Feedback)

8) GIVEN ein Gallery-Drop auf einen leeren Slot wurde erfolgreich via `onGalleryDrop` verarbeitet
   WHEN die ReferenceBar den Callback empfaengt
   THEN wird `addGalleryAsReference` (Server Action aus Slice 05) mit `{ projectId, generationId, imageUrl }` aufgerufen und der Slot zeigt das Thumbnail der Gallery-Generation im `ready`-State

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/generation-card-drag.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationCard Drag', () => {
  // AC-1: draggable Attribut vorhanden
  it.todo('should have draggable="true" attribute on the root element')

  // AC-2: dragstart setzt custom dataTransfer mit generationId und imageUrl
  it.todo('should set application/x-aifactory-generation data with generationId and imageUrl on dragstart')

  // AC-2: effectAllowed ist "copy"
  it.todo('should set dataTransfer.effectAllowed to "copy" on dragstart')

  // AC-3: Drag-Ghost wird angezeigt (natives Verhalten, kein Custom-Ghost)
  it.todo('should not call setDragImage (uses native browser ghost)')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/reference-slot-gallery-drop.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ReferenceSlot Gallery Drop', () => {
  describe('DragOver Discrimination', () => {
    // AC-4: Gallery-Drag wird erkannt und erlaubt
    it.todo('should accept dragover and show accent border when dataTransfer contains application/x-aifactory-generation')

    // AC-5: Nativer File-Drop bleibt unveraendert
    it.todo('should use existing file drop behavior when dataTransfer contains only Files type')
  })

  describe('Gallery Drop Handling', () => {
    // AC-6: Drop mit Gallery-Daten ruft onGalleryDrop auf
    it.todo('should call onGalleryDrop with parsed generationId and imageUrl on gallery drop')

    // AC-6: Kein File-Upload bei Gallery-Drop
    it.todo('should not call onUpload when gallery drop is processed')
  })

  describe('Filled Slot Rejection', () => {
    // AC-7: Befuellter Slot lehnt Gallery-Drag ab
    it.todo('should not accept gallery drag when slot is in ready state')
  })

  describe('Integration with addGalleryAsReference', () => {
    // AC-8: Server Action wird mit korrekten Parametern aufgerufen
    it.todo('should trigger addGalleryAsReference via onGalleryDrop callback with correct projectId, generationId, imageUrl')
  })
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-05-gallery-as-reference | `addGalleryAsReference` | Server Action | `(input: { projectId, generationId, imageUrl }) => Promise<ReferenceImage \| { error }>` |
| slice-07-reference-slot | `ReferenceSlot` | React Component | Bestehendes Drop-Handling fuer File-Drops wird erweitert |
| slice-08-reference-bar | `ReferenceBar` | React Component | Orchestriert `onGalleryDrop` und ruft Server Action auf |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationCard` (draggable) | React Component | Kein direkter Consumer | `draggable` + `onDragStart` mit custom MIME-Type |
| `ReferenceSlot` (Gallery-Drop) | React Component (erweitert) | slice-08 (ReferenceBar) | Neue Prop `onGalleryDrop: (data: { generationId: string, imageUrl: string }) => void` |
| MIME-Type Konstante | String Constant | generation-card, reference-slot | `"application/x-aifactory-generation"` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/generation-card.tsx` -- Erweitert: `draggable` Attribut, `onDragStart`-Handler mit Custom `dataTransfer` Format (`application/x-aifactory-generation`)
- [ ] `components/workspace/reference-slot.tsx` -- Erweitert: Gallery-Drag-Erkennung via MIME-Type-Pruefung in DragOver/Drop-Handlern, neue `onGalleryDrop`-Prop, Unterscheidung File-Drop vs. Gallery-Drag
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen am ReferenceBar State-Management (Slot-Verwaltung, Nummerierung)
- KEINE R2-Upload-Logik bei Gallery-Drop (Slice 05 stellt sicher: nur DB-Eintrag)
- KEIN Custom Drag-Ghost (natives Browser-Verhalten genuegt)
- KEINE Lightbox "Als Referenz"-Button-Logik (das ist Slice 16)
- KEINE Aenderungen an bestehenden Click-Handlern der GenerationCard (`onSelect` bleibt unveraendert)

**Technische Constraints:**
- HTML5 Drag & Drop API (kein react-dnd oder aehnliche Libraries)
- Custom MIME-Type `application/x-aifactory-generation` zur Unterscheidung von nativen File-Drops
- `dataTransfer.setData()` Payload als JSON-String mit `{ generationId, imageUrl }`
- `dataTransfer.types.includes("application/x-aifactory-generation")` fuer MIME-Type-Pruefung im DragOver
- GenerationCard bleibt ein `<button>` Element — `draggable` wird zusaetzlich gesetzt
- Bestehende File-Drop-Logik im ReferenceSlot muss unveraendert funktionieren (Rueckwaertskompatibilitaet)

**Referenzen:**
- Architecture: `architecture.md` --> Section "Technology Decisions" (HTML5 Drag & Drop API, Zeile 405)
- Architecture: `architecture.md` --> Section "Risks" (Drag & Drop Konflikt mit Click-Handlern, Zeile 389)
- Architecture: `architecture.md` --> Section "Server Logic" (ReferenceService.uploadFromGallery, Zeile 142)
- Discovery: `discovery.md` --> Section "User Flows" Flow 2 (Gallery-Bild als Referenz via Drag & Drop)
- Wireframes: `wireframes.md` --> Screen "Reference Slot -- Empty (Drop Zone)" (drag-over State)
