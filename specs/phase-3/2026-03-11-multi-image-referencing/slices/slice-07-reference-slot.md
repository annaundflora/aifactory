# Slice 07: ReferenceSlot Component

> **Slice 07 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-reference-slot` |
| **Test** | `pnpm test components/workspace/__tests__/reference-slot` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-upload-reference-action", "slice-06-ui-setup-collapsible"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest + Testing Library) |
| **Test Command** | `pnpm test components/workspace/__tests__/reference-slot` |
| **Integration Command** | — |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/reference-slot` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Actions mocken, kein echter Upload) |

---

## Ziel

Einen wiederverwendbaren ReferenceSlot als React-Component bereitstellen, der alle 6 visuellen States (empty, drag-over, uploading, ready, dimmed, error) abbildet und die Eingabe-Methoden File Drop, Click-to-Browse und URL Paste unterstuetzt. Dazu die zugehoerigen TypeScript-Type-Definitionen fuer Roles, Strengths und Slot-Daten erstellen.

---

## Acceptance Criteria

1) GIVEN ein `ReferenceSlot` ohne zugewiesene Daten (`slotData` ist `null`)
   WHEN er gerendert wird
   THEN zeigt er eine Dropzone mit gestricheltem Border (`border-dashed`) und den Text "Drop image here, click to browse, or paste a URL"

2) GIVEN ein `ReferenceSlot` im State `empty`
   WHEN eine Datei per Drag ueber den Slot gezogen wird (DragEnter)
   THEN wechselt der Border auf Accent-Farbe und der Text aendert sich zu "Drop to add"

3) GIVEN ein `ReferenceSlot` im State `drag-over`
   WHEN der Cursor den Slot verlaesst (DragLeave)
   THEN kehrt der Slot in den `empty`-State zurueck (gestrichelter Border, Original-Text)

4) GIVEN ein `ReferenceSlot` im State `empty`
   WHEN ein File per Drop abgelegt wird (gueltige Bilddatei, PNG/JPG/WebP)
   THEN wechselt der Slot in den `uploading`-State mit Spinner und Text "Uploading..." und ruft die `onUpload`-Callback-Prop auf

5) GIVEN ein `ReferenceSlot` im State `empty`
   WHEN der User klickt und eine Datei ueber den nativen File-Dialog waehlt
   THEN wird der Upload ausgeloest (identisches Verhalten wie File Drop, AC-4)

6) GIVEN ein `ReferenceSlot` im State `empty`
   WHEN der User eine URL per Paste einfuegt (Ctrl+V mit URL im Clipboard)
   THEN wird der Upload mit der URL ausgeloest via `onUploadUrl`-Callback

7) GIVEN ein `ReferenceSlot` mit `slotData` (State `ready`, Rolle `"style"`, Strength `"moderate"`, slotPosition `1`)
   WHEN er gerendert wird
   THEN zeigt er: 80x80 Thumbnail, SlotLabel "@1", RoleBadge "Style" in Violet, RoleDropdown mit Wert "Style" und violettem Dot-Indikator, StrengthDropdown mit Wert "Moderate", Remove-Button [x], und der aeussere Border ist violet-farbkodiert

8) GIVEN ein `ReferenceSlot` im State `ready` mit Rolle `"content"`
   WHEN der User die Rolle via RoleDropdown auf `"structure"` aendert
   THEN wird der `onRoleChange`-Callback mit `"structure"` aufgerufen, der Border wechselt auf Gruen, der Dot-Indikator im Dropdown wechselt auf Gruen, und die RoleBadge zeigt "Structure" in Gruen

9) GIVEN ein `ReferenceSlot` im State `ready`
   WHEN der User die Strength via StrengthDropdown von `"moderate"` auf `"dominant"` aendert
   THEN wird der `onStrengthChange`-Callback mit `"dominant"` aufgerufen

10) GIVEN ein `ReferenceSlot` im State `ready`
    WHEN der User den Remove-Button [x] klickt
    THEN wird der `onRemove`-Callback aufgerufen

11) GIVEN ein `ReferenceSlot` mit Prop `dimmed={true}`
    WHEN er gerendert wird
    THEN zeigt er reduzierte Opacity, kein RoleDropdown/StrengthDropdown, stattdessen Warning-Text "Will be ignored", und der Remove-Button bleibt aktiv

12) GIVEN ein `ReferenceSlot` im State `error` mit `errorMessage="Upload fehlgeschlagen"`
    WHEN er gerendert wird
    THEN zeigt er roten gestrichelten Border, die Fehlermeldung und einen "Retry"-Link

13) GIVEN `lib/types/reference.ts`
    WHEN es importiert wird
    THEN exportiert es `ReferenceRole` (Union: `"style" | "content" | "structure" | "character" | "color"`), `ReferenceStrength` (Union: `"subtle" | "moderate" | "strong" | "dominant"`), und `ReferenceSlotData` (mit Feldern: `id`, `imageUrl`, `slotPosition`, `role`, `strength`, `originalFilename?`, `width?`, `height?`)

14) GIVEN das Rollen-Farbschema
    WHEN Rolle `"style"` ausgewaehlt ist THEN ist der Border-Farbton Violet
    WHEN Rolle `"content"` ausgewaehlt ist THEN ist der Border-Farbton Blue
    WHEN Rolle `"structure"` ausgewaehlt ist THEN ist der Border-Farbton Green
    WHEN Rolle `"character"` ausgewaehlt ist THEN ist der Border-Farbton Amber
    WHEN Rolle `"color"` ausgewaehlt ist THEN ist der Border-Farbton Pink

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/reference-slot.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ReferenceSlot', () => {
  describe('Empty State', () => {
    // AC-1: Empty Dropzone mit gestricheltem Border und Hilfetext
    it.todo('should render dashed border dropzone with help text when slotData is null')

    // AC-2: DragEnter wechselt zu drag-over State
    it.todo('should show accent border and "Drop to add" text on dragenter')

    // AC-3: DragLeave kehrt zu empty zurueck
    it.todo('should revert to empty state on dragleave')
  })

  describe('Upload Triggers', () => {
    // AC-4: File Drop loest Upload aus
    it.todo('should call onUpload callback when file is dropped')

    // AC-5: Click-to-Browse loest Upload aus
    it.todo('should open file dialog on click and call onUpload with selected file')

    // AC-6: URL Paste loest Upload aus
    it.todo('should call onUploadUrl when URL is pasted via clipboard')
  })

  describe('Ready State', () => {
    // AC-7: Ready State zeigt alle Controls korrekt
    it.todo('should render 80x80 thumbnail, @N label, role badge, role dropdown, strength dropdown, and remove button')

    // AC-8: Role Change aktualisiert Farben und ruft Callback auf
    it.todo('should call onRoleChange and update border/badge/dot color when role is changed')

    // AC-9: Strength Change ruft Callback auf
    it.todo('should call onStrengthChange when strength dropdown value changes')

    // AC-10: Remove Button ruft Callback auf
    it.todo('should call onRemove when remove button is clicked')
  })

  describe('Dimmed State', () => {
    // AC-11: Dimmed zeigt Warning statt Controls
    it.todo('should render reduced opacity with "Will be ignored" text and no dropdowns when dimmed')
  })

  describe('Error State', () => {
    // AC-12: Error zeigt roten Border, Message und Retry
    it.todo('should render red dashed border with error message and retry link')
  })

  describe('Uploading State', () => {
    // AC-4 (Teilaspekt): Uploading zeigt Spinner
    it.todo('should render spinner and "Uploading..." text during upload')
  })

  describe('Role Color Mapping', () => {
    // AC-14: Alle 5 Rollen-Farben korrekt gemappt
    it.todo('should apply violet border for style role')
    it.todo('should apply blue border for content role')
    it.todo('should apply green border for structure role')
    it.todo('should apply amber border for character role')
    it.todo('should apply pink border for color role')
  })
})

describe('Reference Types', () => {
  // AC-13: Type-Exports vorhanden
  it.todo('should export ReferenceRole, ReferenceStrength, and ReferenceSlotData from reference.ts')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-04-upload-reference-action | `uploadReferenceImage` | Server Action | `(input: { projectId, file?, url? }) => Promise<{ id, imageUrl, width, height } \| { error }>` |
| slice-06-ui-setup-collapsible | `Collapsible` | React Component | Import ohne TypeScript-Fehler |
| slice-06-ui-setup-collapsible | Panel 480px | Layout | Slot rendert innerhalb 480px-Panel |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ReferenceSlot` | React Component | slice-08 (ReferenceBar) | `<ReferenceSlot slotData={data} dimmed={bool} onUpload={fn} onUploadUrl={fn} onRoleChange={fn} onStrengthChange={fn} onRemove={fn} />` |
| `ReferenceRole` | TypeScript Type | slice-08, slice-12, slice-13 | `"style" \| "content" \| "structure" \| "character" \| "color"` |
| `ReferenceStrength` | TypeScript Type | slice-08, slice-12, slice-13 | `"subtle" \| "moderate" \| "strong" \| "dominant"` |
| `ReferenceSlotData` | TypeScript Type | slice-08, slice-09 | Typ mit `id, imageUrl, slotPosition, role, strength` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/reference-slot.tsx` -- ReferenceSlot Component mit 6 States, RoleDropdown, StrengthDropdown, SlotLabel, RoleBadge, Remove-Button, Upload-Handling (Drop/Click/URL)
- [ ] `lib/types/reference.ts` -- Type-Definitionen: ReferenceRole, ReferenceStrength, ReferenceSlotData
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Slot-Verwaltungslogik (Hinzufuegen/Entfernen/Nummerierung) -- das ist Slice 08 (ReferenceBar)
- KEINE Integration in PromptArea -- das ist Slice 09
- KEINE Gallery-Drag-Erkennung -- das ist Slice 14
- KEINE Server-seitige Upload-Logik -- nur Callbacks aufrufen, die an den Slot uebergeben werden
- KEIN State-Management fuer mehrere Slots -- ReferenceSlot ist ein einzelner, kontrollierter Component

**Technische Constraints:**
- shadcn Select fuer RoleDropdown und StrengthDropdown (konsistent mit bestehendem UI-Pattern)
- shadcn Badge fuer SlotLabel und RoleBadge
- Rollen-Farbschema exakt wie in discovery.md → Section "Rollen-Farbschema" definiert
- Thumbnail-Groesse exakt 80x80px (object-cover fuer Seitenverhaeltnis)
- Component nimmt alle Daten und Callbacks als Props entgegen (kontrollierter Component, kein interner State ausser visuellem State wie drag-over)
- Bestehendes ImageDropzone-Pattern als Orientierung fuer Drag & Drop Handling

**Referenzen:**
- Architecture: `architecture.md` → Section "Validation Rules" (MIME-Types, Dateigrösse)
- Wireframes: `wireframes.md` → Screen "Reference Slot -- Ready (Detail)" + Screen "Reference Slot -- Empty (Drop Zone)" + Screen "Reference Slot -- Dimmed"
- Discovery: `discovery.md` → Section "UI Components & States" (ReferenceSlot States) + Section "Rollen-Farbschema" (Farb-Hex-Werte)
- Pattern: `components/workspace/image-dropzone.tsx` → Drag & Drop State-Machine-Pattern
