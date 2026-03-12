# Slice 11: CompatibilityWarning

> **Slice 11 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-compatibility-warning` |
| **Test** | `pnpm test components/workspace/__tests__/compatibility-warning` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-prompt-area-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest + Testing Library) |
| **Test Command** | `pnpm test components/workspace/__tests__/compatibility-warning` |
| **Integration Command** | `pnpm test lib/services/__tests__/model-schema-service` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/compatibility-warning` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ModelSchemaService.getSchema mocken, kein Replicate API Call) |

---

## Ziel

Warning-Banner oberhalb der Referenz-Slots anzeigen, wenn das aktuell gewaehlte Modell weniger Referenzbilder unterstuetzt als geladen sind (`partial`) oder gar kein img2img unterstuetzt (`no-support`). Dazu `getMaxImageCount()` in model-schema-service.ts implementieren, die das Schema-Feld `maxItems` des img2img-Array-Feldes auswertet.

---

## Acceptance Criteria

1) GIVEN ein Modell-Schema dessen img2img-Feld `input_images` den Typ `array` mit `maxItems: 3` hat und 5 Referenz-Slots geladen sind
   WHEN `getMaxImageCount(schema)` aufgerufen wird
   THEN gibt die Funktion `3` zurueck

2) GIVEN ein Modell-Schema dessen img2img-Feld `input_images` den Typ `array` hat aber KEIN `maxItems` definiert
   WHEN `getMaxImageCount(schema)` aufgerufen wird
   THEN gibt die Funktion `Infinity` zurueck (unbegrenzt)

3) GIVEN ein Modell-Schema das kein img2img-Feld hat (`getImg2ImgFieldName` gibt `undefined` zurueck)
   WHEN `getMaxImageCount(schema)` aufgerufen wird
   THEN gibt die Funktion `0` zurueck (kein Support)

4) GIVEN ein Modell-Schema dessen img2img-Feld NICHT `isArray: true` ist (z.B. `image_prompt` als einzelner String)
   WHEN `getMaxImageCount(schema)` aufgerufen wird
   THEN gibt die Funktion `1` zurueck (nur ein Bild)

5) GIVEN 5 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() === 3`
   WHEN die `CompatibilityWarning` gerendert wird
   THEN zeigt sie den Variant `partial`: Text enthaelt den Modellnamen und "max 3", Hinweis dass @4 und @5 ignoriert werden

6) GIVEN 5 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() === 3`
   WHEN die `CompatibilityWarning` im `partial`-State gerendert wird
   THEN werden die Slots @4 und @5 als `dimmed` markiert (via Callback `onDimmedSlots` mit Array `[4, 5]`)

7) GIVEN 2 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() === 0`
   WHEN die `CompatibilityWarning` gerendert wird
   THEN zeigt sie den Variant `no-support`: Text "Modell unterstuetzt keine Referenz-Bilder" mit einem klickbaren Link "Switch to FLUX 2 Pro"

8) GIVEN die `CompatibilityWarning` im `no-support`-State
   WHEN der User auf den Link "Switch to FLUX 2 Pro" klickt
   THEN wird der `onSwitchModel`-Callback mit der Model-ID `"black-forest-labs/flux-2-pro"` aufgerufen

9) GIVEN die `CompatibilityWarning` im `no-support`-State
   WHEN sie gerendert wird
   THEN signalisiert sie via `onGenerateDisabled(true)` dass der Generate-Button disabled werden soll

10) GIVEN 3 geladene Referenz-Slots und ein Modell mit `getMaxImageCount() >= 3`
    WHEN die `CompatibilityWarning` gerendert wird
    THEN ist die Warning NICHT sichtbar (Variant `hidden`) und `onGenerateDisabled(false)`

11) GIVEN eine sichtbare `CompatibilityWarning` im `partial`-State
    WHEN der User das Modell wechselt zu einem mit `getMaxImageCount() >= 5`
    THEN verschwindet die Warning und alle Slots werden wieder `ready` (nicht `dimmed`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/services/__tests__/model-schema-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('getMaxImageCount', () => {
  // AC-1: Array-Feld mit maxItems
  it.todo('should return maxItems value when img2img array field has maxItems defined')

  // AC-2: Array-Feld ohne maxItems
  it.todo('should return Infinity when img2img array field has no maxItems')

  // AC-3: Kein img2img-Feld
  it.todo('should return 0 when schema has no img2img field')

  // AC-4: Nicht-Array img2img-Feld
  it.todo('should return 1 when img2img field is not an array')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/compatibility-warning.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CompatibilityWarning', () => {
  describe('partial variant', () => {
    // AC-5: Partial Warning Text mit Modellname und Limit
    it.todo('should show partial warning with model name and max image count')

    // AC-6: Dimmed Slots Callback
    it.todo('should call onDimmedSlots with slot positions exceeding the limit')

    // AC-11: Warning verschwindet bei kompatiblem Modell
    it.todo('should hide warning and clear dimmed slots when model supports enough images')
  })

  describe('no-support variant', () => {
    // AC-7: No-Support Warning mit Switch-Link
    it.todo('should show no-support warning with Switch to FLUX 2 Pro link')

    // AC-8: Switch-Link ruft Callback auf
    it.todo('should call onSwitchModel with flux-2-pro model ID when link is clicked')

    // AC-9: Generate disabled Callback
    it.todo('should call onGenerateDisabled with true when no-support')
  })

  describe('hidden variant', () => {
    // AC-10: Keine Warning bei ausreichendem Support
    it.todo('should not render warning when model supports all loaded slots')
  })
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-09-prompt-area-integration | `referenceSlots` State | React State (Array) | Laenge und slotPositions fuer Limit-Berechnung |
| slice-09-prompt-area-integration | ReferenceBar Layout-Position | Layout | CompatibilityWarning wird oberhalb der Slots platziert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getMaxImageCount(schema)` | Funktion | slice-13 (Generation Integration) | `(schema: SchemaProperties) => number` |
| `CompatibilityWarning` | React Component | slice-09 (PromptArea Integration) | `<CompatibilityWarning modelName={string} maxImageCount={number} slotCount={number} slotPositions={number[]} onDimmedSlots={fn} onSwitchModel={fn} onGenerateDisabled={fn} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/compatibility-warning.tsx` -- Warning-Banner Component mit `hidden`, `partial`, `no-support` Varianten
- [ ] `lib/services/model-schema-service.ts` -- erweitert um `getMaxImageCount()` Funktion
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an prompt-area.tsx -- Integration der Warning in PromptArea passiert durch den Implementer von Slice 09 oder als Folge-Slice
- KEIN Generate-Button disabling direkt -- nur Callback `onGenerateDisabled`, Consumer entscheidet
- KEINE Megapixel-Validierung -- das ist Slice 13
- KEINE Aenderungen an ReferenceSlot dimmed-State Styling -- Slice 07 hat den `dimmed`-State bereits definiert
- KEIN Fetching des Schemas -- Component erhaelt `maxImageCount` als Prop (Schema-Fetch ist Verantwortung des Consumers)

**Technische Constraints:**
- `getMaxImageCount()` ist eine pure Funktion (kein async, kein API-Call), arbeitet auf dem bereits geladenen Schema-Objekt
- `getMaxImageCount()` nutzt intern `getImg2ImgFieldName()` und liest dann `maxItems` aus dem Schema-Property-Objekt
- CompatibilityWarning als Presentational Component (keine eigene State-Logik, alles via Props)
- Warning-Banner nutzt bestehende shadcn/ui Alert-Varianten oder eigenes Styling mit `lucide-react` AlertTriangle Icon

**Referenzen:**
- Architecture: `architecture.md` --> Section "Migration Map" (model-schema-service.ts Erweiterung)
- Architecture: `architecture.md` --> Section "Error Handling Strategy" (Model incompatibility = Client-side detection)
- Wireframes: `wireframes.md` --> Screen "Compatibility Warning Banner" + Screen "Reference Slot -- Dimmed"
- Discovery: `discovery.md` --> Section "Business Rules" (Modell-Kompatibilitaet, Kein Multi-Image Support)
- Codebase: `lib/services/model-schema-service.ts` --> `getImg2ImgFieldName()` als Basis fuer `getMaxImageCount()`
