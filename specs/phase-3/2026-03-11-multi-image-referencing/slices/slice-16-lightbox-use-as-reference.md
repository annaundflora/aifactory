# Slice 16: Lightbox UseAsReference Button

> **Slice 16 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-lightbox-use-as-reference` |
| **Test** | `pnpm test components/lightbox/__tests__/use-as-reference` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-gallery-as-reference", "slice-09-prompt-area-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest + Testing Library) |
| **Test Command** | `pnpm test components/lightbox/__tests__/use-as-reference` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test components/lightbox/__tests__/use-as-reference` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Action `addGalleryAsReference` mocken, WorkspaceVariation Context per Provider wrappen) |

---

## Ziel

Einen "Als Referenz" Button in die Lightbox-Aktionsleiste einfuegen, der das aktuelle Bild ueber den WorkspaceVariation-Context (`addReference`-Feld aus Slice 09) als Referenz in den naechsten freien Slot uebergibt, automatisch den img2img-Modus aktiviert und die Lightbox schliesst. Der Button ist disabled wenn alle 5 Slots belegt sind.

---

## Acceptance Criteria

1) GIVEN die Lightbox ist offen mit einem Bild (nicht Upscale-Mode) und weniger als 5 Referenz-Slots belegt
   WHEN der User die Aktions-Buttons betrachtet
   THEN ist ein Button "Als Referenz" sichtbar, positioniert zwischen "Variation" und "img2img", mit `data-testid="use-as-reference-btn"`

2) GIVEN die Lightbox ist offen mit Generation `{ id: "gen-abc", imageUrl: "https://r2.example/img.png" }`
   WHEN der User auf "Als Referenz" klickt
   THEN wird `setVariation` mit `addReference: { imageUrl: "https://r2.example/img.png", generationId: "gen-abc" }` aufgerufen

3) GIVEN der User klickt auf "Als Referenz"
   WHEN die Aktion ausgefuehrt wird
   THEN wird die Lightbox geschlossen (`onClose` wird aufgerufen)

4) GIVEN die Lightbox ist offen und alle 5 Referenz-Slots sind belegt
   WHEN der User den "Als Referenz" Button betrachtet
   THEN ist der Button disabled (`disabled` Attribut gesetzt) und zeigt einen Tooltip mit Text "Alle 5 Slots belegt"

5) GIVEN die Lightbox zeigt eine Generation im Upscale-Mode (`generationMode: "upscale"`)
   WHEN der User die Aktions-Buttons betrachtet
   THEN ist der "Als Referenz" Button trotzdem sichtbar (Upscale-Bilder koennen als Referenz dienen)

6) GIVEN die Lightbox ist offen mit einem Bild ohne `imageUrl` (Bild noch pending)
   WHEN der User die Aktions-Buttons betrachtet
   THEN ist der gesamte Actions-Block inklusive "Als Referenz" nicht gerendert (bestehendes Verhalten)

7) GIVEN der User klickt auf "Als Referenz"
   WHEN `addGalleryAsReference` Server Action aufgerufen wird
   THEN wird die Action mit `{ projectId: generation.projectId, generationId: generation.id, imageUrl: generation.imageUrl }` aufgerufen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/lightbox/__tests__/use-as-reference.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LightboxModal - UseAsReference Button', () => {
  // AC-1: Button sichtbar zwischen Variation und img2img
  it.todo('should render use-as-reference button between variation and img2img buttons')

  // AC-2: Klick ruft setVariation mit addReference auf
  it.todo('should call setVariation with addReference containing imageUrl and generationId on click')

  // AC-3: Lightbox schliesst nach Klick
  it.todo('should call onClose after clicking use-as-reference button')

  // AC-4: Disabled mit Tooltip bei 5/5 Slots
  it.todo('should be disabled with tooltip when all 5 reference slots are full')

  // AC-5: Sichtbar auch im Upscale-Mode
  it.todo('should render use-as-reference button even for upscale mode generations')

  // AC-6: Nicht gerendert wenn kein imageUrl
  it.todo('should not render actions block when generation has no imageUrl')

  // AC-7: Server Action wird mit korrekten Parametern aufgerufen
  it.todo('should call addGalleryAsReference with projectId, generationId and imageUrl')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-05 | `addGalleryAsReference` | Server Action | Import aus `@/app/actions/references` verfuegbar |
| slice-09 | `addReference` Feld im WorkspaceVariationState | Context-Feld | `setVariation({ ...data, addReference: { imageUrl, generationId } })` funktioniert |
| slice-09 | Reference-Slot-Count | State-Information | Anzahl belegter Slots muss abfragbar sein (fuer Disabled-State) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| UseAsReference Button in Lightbox | UI-Integration | -- (End-Feature) | Button in `lightbox-modal.tsx` Actions-Bereich |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/lightbox-modal.tsx` — Erweitert: "Als Referenz" Button zwischen Variation und img2img, mit addReference via WorkspaceState, addGalleryAsReference Action-Aufruf, Disabled-State bei 5/5 Slots
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE ProvenanceRow — das ist Slice 15
- KEINE Aenderungen an WorkspaceState — `addReference`-Feld existiert bereits aus Slice 09
- KEINE Aenderungen an PromptArea — die Consumption von `addReference` existiert bereits aus Slice 09
- KEINE Aenderungen an ReferenceBar oder ReferenceSlot
- KEIN Gallery-Drag — das ist Slice 14

**Technische Constraints:**
- Button nutzt `setVariation` aus `useWorkspaceVariation()` Hook (bereits im Lightbox importiert)
- `addGalleryAsReference` Server Action wird aufgerufen um DB-Eintrag zu erstellen (Slice 05)
- Disabled-State benoetigt Zugriff auf aktuelle Slot-Belegung — entweder via Context/Prop oder via `getReferenceImages` Query-Result
- Button-Styling konsistent mit bestehenden Lightbox-Action-Buttons (gleiche Klassen)
- Tooltip fuer Disabled-State via `title`-Attribut oder shadcn Tooltip
- Button ist auch im Upscale-Mode sichtbar (anders als Variation-Button)

**Referenzen:**
- Architecture: `architecture.md` → Section "Migration Map" (lightbox-modal.tsx Aenderungen, Zeile 311)
- Wireframes: `wireframes.md` → Screen "Lightbox — With Provenance" (Button-Position, Zeile 313)
- Discovery: `discovery.md` → Section "User Flows" → Flow 3 (Lightbox-Button Flow, Zeile 120-127)
- Discovery: `discovery.md` → Section "UI Components & States" → UseAsReferenceButton (Zeile 206)
