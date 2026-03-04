# Slice 6: Model Registry + Schema Service implementieren

> **Slice 6 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-model-registry-schema-service` |
| **Test** | `pnpm test lib/__tests__/models.test.ts lib/services/__tests__/model-schema-service.test.ts app/actions/__tests__/models.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/models.test.ts lib/services/__tests__/model-schema-service.test.ts app/actions/__tests__/models.test.ts` |
| **Integration Command** | `pnpm test lib/services/__tests__/model-schema-service.integration.test.ts` |
| **Acceptance Command** | `pnpm test lib/services/__tests__/model-schema-service.integration.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Unit-Tests mocken Replicate API, Integration-Tests gegen echte API) |

---

## Ziel

Statische Model-Registry mit den 6 konfigurierten Modellen bereitstellen und einen ModelSchemaService implementieren, der OpenAPI-Schemas von der Replicate API laedt und in-memory cached. Die Server Action `getModelSchema` macht das Schema fuer UI-Slices verfuegbar.

---

## Acceptance Criteria

1) GIVEN `lib/models.ts` existiert
   WHEN die Model-Registry importiert wird
   THEN enthaelt sie exakt 6 Modelle mit den IDs aus architecture.md Section "Configured Models" (z.B. `black-forest-labs/flux-2-pro`, `google/nano-banana-2`, etc.)

2) GIVEN die Model-Registry
   WHEN ein Modell abgefragt wird
   THEN hat es die Felder `id` (string), `displayName` (string) und `pricePerImage` (number)

3) GIVEN eine gueltige Model-ID `"black-forest-labs/flux-2-pro"`
   WHEN `getModelSchema({ modelId: "black-forest-labs/flux-2-pro" })` aufgerufen wird
   THEN wird ein Objekt mit `properties` zurueckgegeben, das die Parameter-Definitionen des Modells enthaelt (JSON-Objekt mit mindestens einem Key)

4) GIVEN eine ungueltige Model-ID `"unknown/model"`
   WHEN `getModelSchema({ modelId: "unknown/model" })` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Unbekanntes Modell" }` zurueckgegeben

5) GIVEN eine leere Model-ID
   WHEN `getModelSchema({ modelId: "" })` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Unbekanntes Modell" }` zurueckgegeben

6) GIVEN der ModelSchemaService wurde fuer Model-ID `"black-forest-labs/flux-2-pro"` bereits aufgerufen
   WHEN `getModelSchema({ modelId: "black-forest-labs/flux-2-pro" })` erneut aufgerufen wird
   THEN wird das gecachte Ergebnis zurueckgegeben OHNE einen erneuten API-Call an Replicate

7) GIVEN der ModelSchemaService ruft die Replicate API auf
   WHEN die API erfolgreich antwortet
   THEN wird der Schema-Pfad `.latest_version.openapi_schema.components.schemas.Input.properties` extrahiert

8) GIVEN die Replicate API ist nicht erreichbar oder liefert einen Fehler
   WHEN `getModelSchema` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Schema konnte nicht geladen werden" }` zurueckgegeben

9) GIVEN `app/actions/models.ts` existiert
   WHEN die Datei inspiziert wird
   THEN beginnt sie mit `"use server"` als erste Zeile

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/models.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Model Registry', () => {
  // AC-1: 6 Modelle vorhanden
  it.todo('should contain exactly 6 models with IDs matching architecture spec')

  // AC-2: Modell-Felder
  it.todo('should have id, displayName, and pricePerImage for each model')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/model-schema-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelSchemaService', () => {
  // AC-7: Schema-Extraktion
  it.todo('should extract properties from openapi_schema path')

  // AC-6: In-Memory Cache
  it.todo('should return cached result on second call without additional API request')

  // AC-8: API-Fehler
  it.todo('should return error object when Replicate API fails')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/models.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('getModelSchema Server Action', () => {
  // AC-3: Gueltiges Modell
  it.todo('should return properties object for a valid model ID')

  // AC-4: Ungueltiges Modell
  it.todo('should return error for unknown model ID')

  // AC-5: Leere Model-ID
  it.todo('should return error for empty model ID')

  // AC-9: "use server" Direktive
  it.todo('should have "use server" as first line')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Dependencies, eigenstaendiger Slice |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `MODELS` | Model Registry Array | slice-07, slice-09 | `Model[]` Export aus `lib/models.ts` |
| `getModelById` | Lookup Function | slice-07, slice-08 | `(id: string) => Model \| undefined` |
| `ModelSchemaService.getSchema` | Service Function | slice-09 (Parameter Panel) | `(modelId: string) => Promise<Record<string, unknown>>` |
| `getModelSchema` | Server Action | slice-09 (UI) | `(input: { modelId: string }) => Promise<{ properties: JSON } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/models.ts` -- Statische Model-Registry mit 6 Modellen (ID, Display-Name, Preis)
- [ ] `lib/services/model-schema-service.ts` -- ModelSchemaService mit In-Memory-Cache und Replicate API-Aufruf
- [ ] `app/actions/models.ts` -- Server Action getModelSchema mit "use server" Direktive
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEIN Replicate Client (predictions.create etc.) -- kommt in Slice 07
- KEINE UI-Komponenten (Model Dropdown, Parameter Panel) -- kommt in Slice 09
- KEINE Generation-Logik -- kommt in Slice 08
- KEIN Schema-TTL oder Cache-Invalidierung -- In-Memory-Cache reicht (wird bei Server-Restart rebuilt)

**Technische Constraints:**
- `"use server"` Direktive in `app/actions/models.ts`
- Model-ID Validierung gegen die statische Registry (Whitelist)
- Replicate API: `GET https://api.replicate.com/v1/models/{owner}/{name}` mit `REPLICATE_API_TOKEN` Header
- In-Memory-Cache als `Map<string, SchemaProperties>` (Module-Level Variable)
- Fehler als Objekt `{ error: string }` zurueckgeben (kein throw in Server Actions)

**Referenzen:**
- Architecture: `architecture.md` → Section "Configured Models" (6 Modelle mit IDs und Preisen)
- Architecture: `architecture.md` → Section "Server Logic > Services" (ModelSchemaService Responsibility)
- Architecture: `architecture.md` → Section "Business Logic Flow: Model Schema" (Cache + API-Pfad)
- Architecture: `architecture.md` → Section "API Design > Server Actions" (getModelSchema Signatur)
