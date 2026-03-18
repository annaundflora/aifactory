# Slice 2: Capability Detection (Pure Functions)

> **Slice 2 von 3** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-capability-detection` |
| **Test** | `pnpm test lib/services/__tests__/capability-detection.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/capability-detection.test.ts` |
| **Integration Command** | — (pure functions, keine Integration noetig) |
| **Acceptance Command** | `pnpm test lib/services/__tests__/capability-detection.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Vier pure Functions (`detectCapabilities`, `resolveSchemaRefs`, `getImg2ImgFieldName`, `getMaxImageCount`) aus der bestehenden `model-schema-service.ts` in ein eigenstaendiges Modul extrahieren. Diese Funktionen haben keine Side-Effects, keine Netzwerk-Calls und keine DB-Abhaengigkeiten — sie transformieren OpenAPI-Schema-Daten in strukturierte Capability-Informationen.

---

## Acceptance Criteria

1) GIVEN ein OpenAPI-Schema mit einem `prompt`-Feld (z.B. `{ prompt: { type: "string" } }`)
   WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ txt2img: true }` (andere Capabilities koennen true oder false sein)

2) GIVEN ein OpenAPI-Schema mit `image`-Feld aber OHNE `mask`-Feld (z.B. `{ image: { type: "string" }, prompt: { type: "string" } }`)
   WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ img2img: true }`

3) GIVEN ein OpenAPI-Schema mit `image`-Feld UND `mask`-Feld
   WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ inpaint: true, img2img: false }`

4) GIVEN ein OpenAPI-Schema ohne `image`/`mask` und eine Description `"This model supports inpainting"`
   WHEN `detectCapabilities(schema, description, [])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ inpaint: true }`

5) GIVEN ein OpenAPI-Schema und eine Description mit dem Wort `"outpainting"` oder `"expand"`
   WHEN `detectCapabilities(schema, description, [])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ outpaint: true }`

6) GIVEN ein OpenAPI-Schema mit `scale`-Parameter und `image`-Input OHNE `prompt`
   WHEN `detectCapabilities(schema, null, ["super-resolution"])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ upscale: true }`

7) GIVEN ein OpenAPI-Schema mit `scale`-Parameter und `image`-Input OHNE `prompt`, collections = `[]`
   WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ upscale: true }` (Schema-Regel greift unabhaengig von Collection)

8) GIVEN ein Model in der `super-resolution` Collection ohne `scale`-Parameter
   WHEN `detectCapabilities(schema, null, ["super-resolution"])` aufgerufen wird
   THEN enthaelt das Ergebnis `{ upscale: true }` (Collection-Regel greift)

9) GIVEN ein rohes OpenAPI-Schema mit `allOf: [{ $ref: "#/components/schemas/aspect_ratio" }]` und eine `allSchemas`-Map mit `aspect_ratio: { type: "string", enum: ["1:1", "16:9"] }`
   WHEN `resolveSchemaRefs(properties, allSchemas)` aufgerufen wird
   THEN wird die `allOf/$ref`-Referenz inline aufgeloest: die Property enthaelt `enum: ["1:1", "16:9"]` und `type: "string"`, und `allOf` ist entfernt

10) GIVEN ein Schema mit `input_images`-Feld
    WHEN `getImg2ImgFieldName(schema)` aufgerufen wird
    THEN wird `{ field: "input_images", isArray: true }` zurueckgegeben

11) GIVEN ein Schema mit `image`-Feld und `mask`-Feld
    WHEN `getImg2ImgFieldName(schema)` aufgerufen wird
    THEN wird `undefined` zurueckgegeben (inpainting, nicht img2img)

12) GIVEN ein Schema mit Array-Feld `input_images` und `maxItems: 4`
    WHEN `getMaxImageCount(schema)` aufgerufen wird
    THEN wird `4` zurueckgegeben

13) GIVEN ein Schema ohne img2img-Feld (kein image-artiges Feld)
    WHEN `getMaxImageCount(schema)` aufgerufen wird
    THEN wird `0` zurueckgegeben

14) GIVEN ein Schema mit einem Nicht-Array img2img-Feld (z.B. `input_image: { type: "string" }`)
    WHEN `getMaxImageCount(schema)` aufgerufen wird
    THEN wird `1` zurueckgegeben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `lib/services/__tests__/capability-detection.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('detectCapabilities', () => {
  // AC-1: txt2img via prompt-Feld
  it.todo('should detect txt2img when schema has prompt field')

  // AC-2: img2img via image-Feld ohne mask
  it.todo('should detect img2img when schema has image field without mask')

  // AC-3: inpaint via image+mask, img2img false
  it.todo('should detect inpaint and not img2img when schema has image and mask fields')

  // AC-4: inpaint via description keyword
  it.todo('should detect inpaint when description contains inpainting keyword')

  // AC-5: outpaint via description keyword
  it.todo('should detect outpaint when description contains outpainting or expand')

  // AC-6: upscale via collection + schema
  it.todo('should detect upscale when in super-resolution collection with scale and image')

  // AC-7: upscale via schema-only (no collection)
  it.todo('should detect upscale via schema rule even without super-resolution collection')

  // AC-8: upscale via collection-only (no scale param)
  it.todo('should detect upscale when in super-resolution collection without scale parameter')
})

describe('resolveSchemaRefs', () => {
  // AC-9: allOf/$ref inline-Aufloesung
  it.todo('should resolve allOf $ref and inline enum and type from referenced schema')
})

describe('getImg2ImgFieldName', () => {
  // AC-10: input_images Prioritaet
  it.todo('should return input_images with isArray true as highest priority')

  // AC-11: image+mask = undefined
  it.todo('should return undefined when schema has image and mask fields')
})

describe('getMaxImageCount', () => {
  // AC-12: Array mit maxItems
  it.todo('should return maxItems value for array img2img field')

  // AC-13: Kein img2img-Feld
  it.todo('should return 0 when no img2img field exists')

  // AC-14: Nicht-Array Feld
  it.todo('should return 1 for non-array img2img field')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Abhaengigkeiten (pure functions, kein DB/API-Zugriff) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `detectCapabilities` | Pure Function | `slice-03-sync-service` | `(schema: SchemaProperties, description: string \| null, collectionSlugs: string[]) => Capabilities` |
| `resolveSchemaRefs` | Pure Function | `slice-03-sync-service` | `(properties: SchemaProperties, allSchemas: Record<string, Record<string, unknown>>) => SchemaProperties` |
| `getImg2ImgFieldName` | Pure Function | `generation-service.ts` (bestehend) | `(schema: SchemaProperties) => { field: string; isArray: boolean } \| undefined` |
| `getMaxImageCount` | Pure Function | `generation-service.ts` (bestehend) | `(schema: SchemaProperties) => number` |
| `Capabilities` | Type Export | `slice-03-sync-service`, `slice-01-db-schema` | `{ txt2img: boolean; img2img: boolean; upscale: boolean; inpaint: boolean; outpaint: boolean }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/capability-detection.ts` — NEU: Pure Functions `detectCapabilities`, `resolveSchemaRefs`, `getImg2ImgFieldName`, `getMaxImageCount` plus `Capabilities`-Type-Export
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Netzwerk-Zugriff (kein fetch, kein API-Call)
- KEIN DB-Zugriff (kein Drizzle, kein Import von schema.ts)
- KEIN In-Memory-Cache (der alte `schemaCache` aus model-schema-service.ts wird NICHT uebernommen)
- KEINE Aenderung an `model-schema-service.ts` in diesem Slice (Abloesung kommt in Slice 3)
- KEINE Server Actions, KEINE UI-Aenderungen

**Technische Constraints:**
- Alle 4 Funktionen muessen `export` sein (kein const-object-Pattern, da pure Functions)
- `SchemaProperties` Type muss ebenfalls exportiert werden (bereits in model-schema-service.ts definiert als `Record<string, unknown>`)
- `resolveSchemaRefs` erhaelt die `allSchemas`-Map als expliziten Parameter (statt sie intern aus dem API-Response zu extrahieren wie bisher in model-schema-service.ts)
- `detectCapabilities` muss alle 5 Detection Rules aus architecture.md implementieren — siehe Capability Detection Rules Tabelle
- img2img-Feld-Prioritaetsliste: `input_images` > `image_input` > `images` > `input_image` > `image_prompt` > `init_image` > `image` (ohne `mask`)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/model-schema-service.ts` | Logik von `getImg2ImgFieldName()` (Zeilen 20-46) und `getMaxImageCount()` (Zeilen 56-84) wird 1:1 uebernommen. `$ref`-Resolution-Logik (Zeilen 127-159) wird als `resolveSchemaRefs` extrahiert mit explizitem `allSchemas`-Parameter |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Capability Detection Rules" (5 Detection Rules mit Prioritaeten)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Server Logic" → `detectCapabilities` und `resolveSchemaRefs` Beschreibungen
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Migration Map" → `model-schema-service.ts` Zeile (Split-Anweisung)
