# Slice 15: Provenance in Lightbox

> **Slice 15 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-provenance-lightbox` |
| **Test** | `pnpm test components/lightbox/__tests__/provenance-row` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-reference-queries", "slice-13-generation-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest) |
| **Test Command** | `pnpm test components/lightbox/__tests__/provenance-row` |
| **Integration Command** | `pnpm test components/lightbox/__tests__/lightbox-provenance-integration` |
| **Acceptance Command** | `pnpm test components/lightbox/__tests__/provenance-row components/lightbox/__tests__/lightbox-provenance-integration` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (DB-Query `getGenerationReferences` mocken, `getReferenceImagesByProject` mocken) |

---

## Ziel

Eine horizontale Thumbnail-Reihe (`ProvenanceRow`) erstellen, die unterhalb der bestehenden Lightbox-Details die bei einer Generation verwendeten Referenz-Bilder mit @-Nummer, Rollen-Name und Strength-Stufe anzeigt. Die Section ist nur sichtbar wenn die Generation tatsaechlich Referenzen hatte.

---

## Acceptance Criteria

1) GIVEN eine Generation mit `id = "gen-A"` die 3 `generation_references`-Records hat (slotPosition 1/style/strong, slotPosition 3/content/moderate, slotPosition 5/structure/subtle)
   WHEN die Lightbox fuer diese Generation geoeffnet wird
   THEN zeigt die ProvenanceRow genau 3 Thumbnails in der Reihenfolge slotPosition 1, 3, 5 an

2) GIVEN die ProvenanceRow zeigt 3 Referenzen an
   WHEN der Nutzer die Thumbnails betrachtet
   THEN traegt jedes Thumbnail ein Label mit: @-Nummer (z.B. "@1"), Rollen-Name (z.B. "Style") und Strength-Stufe (z.B. "Strong") — farbkodiert gemaess Rollen-Farbschema aus `discovery.md` Section "Rollen-Farbschema"

3) GIVEN eine Generation OHNE `generation_references`-Records (z.B. eine txt2img-Generation)
   WHEN die Lightbox fuer diese Generation geoeffnet wird
   THEN ist die ProvenanceRow-Section komplett unsichtbar (kein Header, kein Platzhalter, `data-testid="provenance-row"` nicht im DOM)

4) GIVEN die ProvenanceRow wird gerendert mit Referenzen
   WHEN die Thumbnails angezeigt werden
   THEN hat jedes Thumbnail ein `<img>`-Element mit der `imageUrl` aus dem zugehoerigen `reference_images`-Record (via Join mit `referenceImageId`) und eine feste Groesse von ca. 48x48px

5) GIVEN die Lightbox ist im Fullscreen-Modus (`isFullscreen = true`)
   WHEN das Detail-Panel hidden ist
   THEN wird die ProvenanceRow ebenfalls nicht gerendert (sie lebt innerhalb des Detail-Panels)

6) GIVEN `getGenerationReferences("gen-A")` liefert Records zurueck
   WHEN die ProvenanceRow die Referenz-Bilder laedt
   THEN wird fuer jeden `generation_references`-Record das zugehoerige `reference_images`-Record ueber `referenceImageId` aufgeloest um die `imageUrl` fuer das Thumbnail zu erhalten

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/lightbox/__tests__/provenance-row.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ProvenanceRow', () => {
  // AC-1: Zeigt korrekte Anzahl Thumbnails in slotPosition-Reihenfolge
  it.todo('should render thumbnails for each generation reference sorted by slotPosition')

  // AC-2: Labels mit @-Nummer, Rolle und Strength farbkodiert
  it.todo('should display @-number, role name, and strength level for each thumbnail with role color coding')

  // AC-3: Unsichtbar wenn keine Referenzen vorhanden
  it.todo('should not render when references array is empty')

  // AC-4: Thumbnails mit korrekter imageUrl und Groesse
  it.todo('should render thumbnail images with correct imageUrl and approximately 48x48px size')
})
```
</test_spec>

### Test-Datei: `components/lightbox/__tests__/lightbox-provenance-integration.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LightboxModal - Provenance Integration', () => {
  // AC-3: ProvenanceRow nicht im DOM bei Generation ohne Referenzen
  it.todo('should not render provenance-row when generation has no references')

  // AC-5: ProvenanceRow hidden im Fullscreen-Modus
  it.todo('should not render provenance-row when lightbox is in fullscreen mode')

  // AC-6: getGenerationReferences wird mit generationId aufgerufen
  it.todo('should call getGenerationReferences with the generation id to resolve references')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02-reference-queries | `getGenerationReferences` | Async Function | `(generationId: string) => Promise<GenerationReference[]>` — liefert Records sortiert nach slotPosition ASC |
| slice-02-reference-queries | `GenerationReference` | Type Export | Enthaelt `referenceImageId`, `role`, `strength`, `slotPosition` |
| slice-02-reference-queries | `ReferenceImage` | Type Export | Enthaelt `id`, `imageUrl` |
| slice-13-generation-integration | `generation_references` Records | DB-Daten | Records existieren fuer Generierungen die mit References erstellt wurden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ProvenanceRow` | React Component | slice-17 (Migration Verification) | `<ProvenanceRow generationId={string} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/provenance-row.tsx` -- Neue Komponente: Horizontale Thumbnail-Reihe mit @-Nummer, Rolle und Strength pro Referenz
- [ ] `components/lightbox/lightbox-modal.tsx` -- Erweitert: ProvenanceRow unterhalb der bestehenden Details im Detail-Panel einbinden
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN "Als Referenz" Button — das ist Slice 16
- KEINE Aenderungen an bestehenden Lightbox-Aktionsbuttons (Variation, img2img, Upscale, Download, Delete)
- KEINE Navigation/Lightbox-Navigation-Aenderungen
- KEINE Query-Funktionen erstellen — `getGenerationReferences` kommt aus Slice 02
- KEINE neuen Server Actions — Datenabfrage erfolgt ueber bestehende Query-Funktion

**Technische Constraints:**
- ProvenanceRow als Client Component ("use client") da sie innerhalb von LightboxModal lebt
- Referenz-Bilder-URLs muessen ueber einen Join/Lookup aufgeloest werden: `getGenerationReferences` liefert `referenceImageId`, dazu muss die `imageUrl` aus `reference_images` geladen werden (entweder via erweiterter Query mit Join oder separatem Lookup)
- Rollen-Farbkodierung konsistent mit dem Farbschema aus der Discovery: Style=Violet, Content=Blue, Structure=Green, Character=Amber, Color=Pink
- ProvenanceRow lebt innerhalb des `!isFullscreen`-Blocks des Detail-Panels (zwischen "Created"-Section und Actions-Section)
- Thumbnail-Groesse ca. 48x48px (kleiner als ReferenceSlot-Thumbnails, passend zum Lightbox-Detail-Panel)

**Referenzen:**
- Architecture: `architecture.md` --> Section "Database Schema" (generation_references Tabelle, Zeilen 117-123)
- Architecture: `architecture.md` --> Section "Migration Map" (lightbox-modal.tsx, Zeile 311)
- Wireframes: `wireframes.md` --> Screen "Lightbox -- With Provenance" (Zeilen 286-332)
- Discovery: `discovery.md` --> Section "Rollen-Farbschema" (Zeilen 166-174)
