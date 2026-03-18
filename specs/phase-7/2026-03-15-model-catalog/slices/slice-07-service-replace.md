# Slice 7: Service-Ersetzung (generation-service, model-settings-service)

> **Slice 7 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-service-replace` |
| **Test** | `pnpm test lib/services/__tests__/generation-service.test.ts lib/services/__tests__/model-settings-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-catalog-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service.test.ts lib/services/__tests__/model-settings-service.test.ts` |
| **Integration Command** | -- (Services werden mit gemockten Abhaengigkeiten getestet) |
| **Acceptance Command** | `pnpm test lib/services/__tests__/generation-service.test.ts lib/services/__tests__/model-settings-service.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ModelCatalogService, DB-Queries, ReplicateClient werden gemockt) |

---

## Ziel

Die beiden bestehenden Consumer-Services (`generation-service.ts` und `model-settings-service.ts`) von `ModelSchemaService` (In-Memory-Cache + Live-API) auf `ModelCatalogService` (DB-backed) und `capability-detection.ts` (extrahierte Pure Functions) umstellen. Nach diesem Slice nutzen beide Services DB-gestuetzte Daten. Die bestehende Funktionalitaet bleibt identisch.

---

## Acceptance Criteria

1) GIVEN `generation-service.ts` importiert `ModelCatalogService` statt `ModelSchemaService`
   WHEN `buildReplicateInput()` fuer ein img2img-Generation mit `modelId = "owner/model"` aufgerufen wird
   THEN wird `ModelCatalogService.getSchema("owner/model")` aufgerufen (NICHT `ModelSchemaService.getSchema()`) und das zurueckgegebene Schema an `getImg2ImgFieldName()` uebergeben

2) GIVEN `generation-service.ts` importiert `getImg2ImgFieldName` aus `capability-detection.ts`
   WHEN die Imports der Datei geprueft werden
   THEN existiert KEIN Import von `model-schema-service` mehr

3) GIVEN ein Model mit Schema `{ input_images: { type: "array" }, prompt: { type: "string" } }` in der DB
   WHEN `buildReplicateInput()` fuer eine img2img-Generation mit 2 References aufgerufen wird
   THEN wird `input_images` als Feld-Key verwendet und die Reference-URLs als Array zugewiesen (identisches Verhalten wie vorher)

4) GIVEN ein Model mit Schema `{ image: { type: "string" }, prompt: { type: "string" } }` in der DB und eine einzelne `sourceImageUrl`
   WHEN `buildReplicateInput()` fuer eine img2img-Generation ohne References aufgerufen wird
   THEN wird `image` als Feld-Key verwendet und `sourceImageUrl` als einzelner String zugewiesen (Backwards-Compatibility)

5) GIVEN `model-settings-service.ts` importiert `ModelCatalogService` statt `ModelSchemaService`
   WHEN die Imports der Datei geprueft werden
   THEN existiert KEIN Import von `model-schema-service` mehr

6) GIVEN ein Model mit `replicate_id = "owner/model"` und `capabilities = { txt2img: true, img2img: true, upscale: false, inpaint: false, outpaint: false }` in der DB
   WHEN `checkCompatibility("owner/model", "img2img")` aufgerufen wird
   THEN wird `true` zurueckgegeben (Capability-Read aus DB statt Live-API)

7) GIVEN ein Model mit `replicate_id = "owner/model"` und `capabilities = { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }` in der DB
   WHEN `checkCompatibility("owner/model", "img2img")` aufgerufen wird
   THEN wird `false` zurueckgegeben

8) GIVEN ein Model mit `capabilities.inpaint = true` in der DB
   WHEN `checkCompatibility("owner/model", "inpaint")` aufgerufen wird
   THEN wird `true` zurueckgegeben (neue Capability-Pruefung fuer inpaint)

9) GIVEN ein Model mit `capabilities.outpaint = false` in der DB
   WHEN `checkCompatibility("owner/model", "outpaint")` aufgerufen wird
   THEN wird `false` zurueckgegeben (neue Capability-Pruefung fuer outpaint)

10) GIVEN ein Model mit `capabilities.upscale = true` in der DB
    WHEN `checkCompatibility("owner/model", "upscale")` aufgerufen wird
    THEN wird `true` zurueckgegeben (upscale jetzt auch DB-basiert statt always-true)

11) GIVEN ein Model mit `replicate_id = "owner/unknown"` das NICHT in der DB existiert
    WHEN `checkCompatibility("owner/unknown", "img2img")` aufgerufen wird
    THEN wird `true` zurueckgegeben (Fallback: erlauben wenn DB-Lookup fehlschlaegt)

12) GIVEN `checkCompatibility` wird mit `mode = "txt2img"` aufgerufen
    WHEN beliebiges `modelId` uebergeben wird
    THEN wird `true` zurueckgegeben (txt2img ist immer kompatibel, kein DB-Lookup noetig)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `lib/services/__tests__/generation-service-catalog.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('buildReplicateInput (ModelCatalogService integration)', () => {
  // AC-1: Schema-Read via ModelCatalogService
  it.todo('should call ModelCatalogService.getSchema instead of ModelSchemaService.getSchema for img2img')

  // AC-2: Kein Import von model-schema-service
  it.todo('should not import from model-schema-service')

  // AC-3: Array-Feld mit mehreren References
  it.todo('should assign reference URLs as array to input_images field')

  // AC-4: Single-String-Feld mit sourceImageUrl
  it.todo('should assign sourceImageUrl as single string to image field')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/model-settings-service-catalog.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('checkCompatibility (DB-backed capabilities)', () => {
  // AC-5: Kein Import von model-schema-service
  it.todo('should not import from model-schema-service')

  // AC-6: img2img = true aus DB
  it.todo('should return true when model has img2img capability in DB')

  // AC-7: img2img = false aus DB
  it.todo('should return false when model lacks img2img capability in DB')

  // AC-8: inpaint Capability
  it.todo('should return true when model has inpaint capability in DB')

  // AC-9: outpaint Capability false
  it.todo('should return false when model lacks outpaint capability in DB')

  // AC-10: upscale Capability aus DB
  it.todo('should return true when model has upscale capability in DB')

  // AC-11: Model nicht in DB — Fallback true
  it.todo('should return true as fallback when model is not found in DB')

  // AC-12: txt2img immer kompatibel
  it.todo('should return true for txt2img without DB lookup')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-catalog-service` | `ModelCatalogService` | Service Object | `getSchema(replicateId)` aufrufbar, gibt `SchemaProperties \| null` zurueck |
| `slice-03-catalog-service` | `getModelByReplicateId` | Query Function | `(replicateId: string) => Promise<Model \| null>` — fuer Capability-Lookup |
| `slice-02-capability-detection` | `getImg2ImgFieldName` | Pure Function | `(schema: SchemaProperties) => { field: string; isArray: boolean } \| undefined` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `buildReplicateInput` | Async Function (intern) | `GenerationService.generate`, `GenerationService.retry` | Unveraenderte Signatur, interne Datenquelle gewechselt |
| `checkCompatibility` | Async Method | `ModelSettingsService.update`, Server Actions | `(modelId: string, mode: string) => Promise<boolean>` — prueft jetzt alle 5 Capabilities |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` -- MODIFY: Import von `ModelSchemaService` + `getImg2ImgFieldName` aus `model-schema-service` aendern auf `ModelCatalogService` aus `model-catalog-service` + `getImg2ImgFieldName` aus `capability-detection`. In `buildReplicateInput()` Schema-Aufruf von `ModelSchemaService.getSchema()` auf `ModelCatalogService.getSchema()` umstellen
- [ ] `lib/services/model-settings-service.ts` -- MODIFY: Import von `ModelSchemaService` entfernen. `checkCompatibility()` umschreiben: statt `ModelSchemaService.supportsImg2Img()` jetzt `getModelByReplicateId()` aufrufen und `capabilities` JSONB fuer alle 5 Modes auswerten. Fallback `true` bei DB-Miss beibehalten
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `model-catalog-service.ts`, `capability-detection.ts` oder `queries.ts`
- KEINE Aenderung an `model-schema-service.ts` (wird in einem spaeteren Cleanup-Slice entfernt)
- KEINE neuen Funktionen oder Methoden hinzufuegen — nur bestehende Datenquellen austauschen
- KEINE UI-Aenderungen
- KEINE Server-Action-Aenderungen (Slice 6 behandelt diese)
- KEINE Aenderung an der oeffentlichen API von `GenerationService` oder `ModelSettingsService`

**Technische Constraints:**
- `buildReplicateInput()` muss identisches Output produzieren wie vorher (gleiche Feld-Keys, gleiche Werte)
- `checkCompatibility()` muss fuer `txt2img` weiterhin sofort `true` zurueckgeben ohne DB-Lookup
- `checkCompatibility()` muss fuer alle 5 Modes (`txt2img`, `img2img`, `upscale`, `inpaint`, `outpaint`) funktionieren — nicht nur fuer `img2img`
- Fallback bei DB-Fehler oder Model-nicht-gefunden: `true` (Auswahl erlauben, nicht blockieren)
- `getImg2ImgFieldName` Import-Pfad aendert sich von `@/lib/services/model-schema-service` auf `@/lib/services/capability-detection`

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/generation-service.ts` | MODIFY — Nur Import-Zeile und einen Aufruf in `buildReplicateInput()` aendern |
| `lib/services/model-settings-service.ts` | MODIFY — Import-Zeile aendern, `checkCompatibility()` Body umschreiben |
| `lib/services/model-catalog-service.ts` | Import — `ModelCatalogService.getSchema()` nutzen (aus Slice 3, NICHT aendern) |
| `lib/services/capability-detection.ts` | Import — `getImg2ImgFieldName` nutzen (aus Slice 2, NICHT aendern) |
| `lib/db/queries.ts` | Import — `getModelByReplicateId` nutzen (aus Slice 3, NICHT aendern) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Migration Map" → `generation-service.ts` und `model-settings-service.ts` Zeilen
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Server Logic" → `ModelSettingsService (EXTENDED)` Beschreibung
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Database Schema" → `capabilities` JSONB-Struktur
