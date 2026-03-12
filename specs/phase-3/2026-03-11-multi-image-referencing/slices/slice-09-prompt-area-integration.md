# Slice 09: PromptArea Integration

> **Slice 09 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-prompt-area-integration` |
| **Test** | `pnpm test components/workspace/__tests__/prompt-area-reference` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-reference-bar"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest + Testing Library) |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-area-reference` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/prompt-area-reference` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Actions mocken, ReferenceBar als Child rendern) |

---

## Ziel

ReferenceBar in die bestehende PromptArea einbinden, sodass sie im img2img-Modus zwischen Model-Card und Prompt-Feldern erscheint und die bisherige ImageDropzone + StrengthSlider ersetzt. Reference-State ueberlebt Mode-Switches (hidden statt destroyed). WorkspaceState um ein `addReference`-Feld erweitern, damit spaetere Slices (Lightbox-Button) Referenzen per Context hinzufuegen koennen.

---

## Acceptance Criteria

1) GIVEN PromptArea im `img2img`-Modus mit geladenem Projekt
   WHEN sie gerendert wird
   THEN ist die `ReferenceBar` sichtbar zwischen Model-Card und Prompt-Feldern und es wird KEINE `ImageDropzone` und KEIN `StrengthSlider` gerendert

2) GIVEN PromptArea im `txt2img`-Modus
   WHEN sie gerendert wird
   THEN ist die `ReferenceBar` NICHT sichtbar (hidden, nicht unmounted)

3) GIVEN PromptArea im `upscale`-Modus
   WHEN sie gerendert wird
   THEN ist die `ReferenceBar` NICHT sichtbar (hidden, nicht unmounted)

4) GIVEN PromptArea im `img2img`-Modus mit 2 Referenzen in Slots @1 und @3
   WHEN der User den Mode auf `txt2img` wechselt und danach zurueck auf `img2img`
   THEN sind beide Referenzen (@1 und @3) mit ihren Rollen und Strengths erhalten

5) GIVEN PromptArea im `img2img`-Modus
   WHEN der User ein Bild per ReferenceBar hochlaedt (via `uploadReferenceImage` Action)
   THEN erscheint das Bild als neuer Slot in der ReferenceBar mit Default-Rolle "content" und Default-Strength "moderate"

6) GIVEN PromptArea mit `Img2ImgState`
   WHEN Slice 09 vollstaendig integriert ist
   THEN enthaelt `Img2ImgState` ein Feld `referenceSlots: ReferenceSlotData[]` statt nur `sourceImageUrl: string | null` und `strength: number`

7) GIVEN `WorkspaceVariationState` in `lib/workspace-state.tsx`
   WHEN ein Consumer `setVariation` mit `addReference: { imageUrl: "https://r2.example/img.png", generationId: "uuid-123" }` aufruft
   THEN enthaelt `variationData.addReference` die uebergebenen Werte

8) GIVEN PromptArea mit gesetztem `variationData.addReference`
   WHEN die PromptArea das `addReference`-Feld im Variation-Context erkennt
   THEN wird automatisch auf `img2img`-Modus gewechselt, das Bild als neue Referenz zum naechsten freien Slot hinzugefuegt (Rolle "content", Strength "moderate"), und `addReference` per `clearVariation` zurueckgesetzt

9) GIVEN PromptArea im `img2img`-Modus mit Referenzen
   WHEN der User "Generate" klickt
   THEN werden die `referenceSlots`-Daten (imageUrl, role, strength, slotPosition pro Slot) an die `generateImages`-Action weitergereicht

10) GIVEN PromptArea im `img2img`-Modus mit 0 Referenzen
    WHEN der User "Generate" klickt
    THEN wird die Generation OHNE References ausgefuehrt (Rueckwaertskompatibilitaet)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area-reference.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea - ReferenceBar Integration', () => {
  describe('Visibility by Mode', () => {
    // AC-1: ReferenceBar sichtbar im img2img-Modus, keine ImageDropzone/StrengthSlider
    it.todo('should render ReferenceBar and not ImageDropzone/StrengthSlider in img2img mode')

    // AC-2: ReferenceBar hidden in txt2img
    it.todo('should hide ReferenceBar in txt2img mode without unmounting')

    // AC-3: ReferenceBar hidden in upscale
    it.todo('should hide ReferenceBar in upscale mode without unmounting')
  })

  describe('State Persistence across Mode Switch', () => {
    // AC-4: Referenzen ueberleben Mode-Switch
    it.todo('should preserve reference slots with roles and strengths after switching txt2img and back to img2img')
  })

  describe('Reference Upload', () => {
    // AC-5: Upload fuegt neuen Slot hinzu
    it.todo('should add new reference slot with default role content and strength moderate on upload')
  })

  describe('Img2ImgState Schema', () => {
    // AC-6: referenceSlots Feld statt sourceImageUrl
    it.todo('should include referenceSlots array in Img2ImgState instead of sourceImageUrl and strength')
  })

  describe('Generate with References', () => {
    // AC-9: referenceSlots werden an generateImages weitergereicht
    it.todo('should pass referenceSlots data to generateImages action on generate')

    // AC-10: Generation ohne References bei leeren Slots
    it.todo('should call generateImages without references when no slots are filled')
  })
})

describe('WorkspaceState - addReference', () => {
  // AC-7: addReference Feld im VariationContext
  it.todo('should store addReference data in variationData when setVariation is called')

  // AC-8: addReference wird konsumiert und zurueckgesetzt
  it.todo('should auto-switch to img2img, add reference to next free slot, and clear variation when addReference is set')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-08-reference-bar | `ReferenceBar` | React Component | `<ReferenceBar slots={ReferenceSlotData[]} onAdd={fn} onRemove={fn} onRoleChange={fn} onStrengthChange={fn} onUpload={fn} onUploadUrl={fn} />` |
| slice-07-reference-slot | `ReferenceSlotData` | TypeScript Type | Import aus `@/lib/types/reference` |
| slice-04-upload-reference-action | `uploadReferenceImage` | Server Action | Fuer Upload-Callbacks in PromptArea |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| ReferenceBar in PromptArea | Layout-Integration | slice-10 (RefHintBanner), slice-11 (CompatibilityWarning) | ReferenceBar gerendert im img2img-Modus, referenceSlots State verfuegbar |
| `addReference` im WorkspaceVariationState | Context-Feld | slice-16 (Lightbox UseAsReference Button) | `setVariation({ ...data, addReference: { imageUrl, generationId? } })` |
| `referenceSlots` in Generate-Flow | Daten-Weitergabe | slice-13 (Generation Integration) | `generateImages()` empfaengt `references` Array |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- ReferenceBar statt ImageDropzone/StrengthSlider im img2img-Modus; referenceSlots State; addReference-Consumption; Generate-Weitergabe
- [ ] `lib/workspace-state.tsx` -- WorkspaceVariationState um `addReference?: { imageUrl: string; generationId?: string }` erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE RefHintBanner-Logik -- das ist Slice 10
- KEINE CompatibilityWarning-Logik -- das ist Slice 11
- KEINE @-Token Prompt-Komposition -- das ist Slice 12
- KEINE Aenderungen an der `generateImages` Server Action selbst -- das ist Slice 13
- KEINE Gallery-Drag-Erkennung -- das ist Slice 14
- KEIN Lightbox UseAsReference Button -- das ist Slice 16
- KEINE Aenderungen an `workspace-content.tsx` Panel-Breite -- bereits in Slice 06 erledigt

**Technische Constraints:**
- ReferenceBar als Controlled Component: `referenceSlots` State lebt in PromptArea, wird als Props an ReferenceBar uebergeben
- Reference-State per CSS hidden (`display: none` oder conditional className) bei Mode-Switch, NICHT per conditional Rendering (unmount wuerde State zerstoeren)
- Bestehende ImageDropzone + StrengthSlider Imports koennen entfernt werden, da ReferenceBar diese Funktionalitaet ersetzt
- `addReference`-Consumption via `useEffect` auf `variationData.addReference` mit anschliessend `clearVariation()`
- `Img2ImgState` Typ-Aenderung: `sourceImageUrl` und `strength` Felder durch `referenceSlots: ReferenceSlotData[]` ersetzen

**Referenzen:**
- Architecture: `architecture.md` --> Section "Migration Map" (prompt-area.tsx, workspace-state.tsx Aenderungen)
- Wireframes: `wireframes.md` --> Screen "Prompt Area -- img2img Mode (Full View)" (Layout-Position der ReferenceBar)
- Discovery: `discovery.md` --> Section "UI Layout & Context" (Position, Sichtbarkeit) + Section "Business Rules" (Mode-Switch Erhalt, Default-Werte)
