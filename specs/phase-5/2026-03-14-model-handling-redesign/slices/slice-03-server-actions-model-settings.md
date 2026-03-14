# Slice 3: Server Actions model-settings

> **Slice 3 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-server-actions-model-settings` |
| **Test** | `pnpm test app/actions lib/types` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-model-settings-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/model-settings` |
| **Integration Command** | `pnpm test app/actions/model-settings` |
| **Acceptance Command** | `pnpm test app/actions/model-settings lib/types` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ModelSettingsService wird gemockt) |

---

## Ziel

Zwei Server Actions (`getModelSettings`, `updateModelSetting`) bereitstellen, die als Schnittstelle zwischen UI und `ModelSettingsService` dienen. Dazu die Typ-Definitionen `Tier`, `GenerationMode`-Erweiterung und `UpdateModelSettingInput` DTO in `lib/types.ts` anlegen, damit alle nachfolgenden Slices typsichere Interfaces haben.

---

## Acceptance Criteria

1) GIVEN `lib/types.ts` wird importiert
   WHEN der Typ `Tier` verwendet wird
   THEN akzeptiert er exakt die Werte `"draft"`, `"quality"`, `"max"` und keine anderen

2) GIVEN `lib/types.ts` wird importiert
   WHEN der Typ `GenerationMode` verwendet wird
   THEN akzeptiert er exakt die Werte `"txt2img"`, `"img2img"`, `"upscale"` und keine anderen

3) GIVEN `lib/types.ts` wird importiert
   WHEN der Typ `UpdateModelSettingInput` verwendet wird
   THEN hat er die Felder `mode: GenerationMode`, `tier: Tier`, `modelId: string`

4) GIVEN die `model_settings` Tabelle hat 8 Seed-Eintraege
   WHEN `getModelSettings()` aufgerufen wird
   THEN wird ein Array mit 8 `ModelSetting`-Objekten zurueckgegeben

5) GIVEN die `model_settings` Tabelle ist leer
   WHEN `getModelSettings()` aufgerufen wird
   THEN werden zuerst Defaults geseeded und danach 8 `ModelSetting`-Objekte zurueckgegeben (delegiert an `ModelSettingsService.getAll()`)

6) GIVEN eine gueltige `UpdateModelSettingInput` mit `{ mode: "txt2img", tier: "draft", modelId: "owner/model-name" }`
   WHEN `updateModelSetting(input)` aufgerufen wird
   THEN wird die aktualisierte `ModelSetting`-Zeile zurueckgegeben mit `modelId: "owner/model-name"`

7) GIVEN eine `UpdateModelSettingInput` mit `modelId: "invalid-format"`
   WHEN `updateModelSetting(input)` aufgerufen wird
   THEN wird `{ error: "Invalid model ID format" }` zurueckgegeben ohne DB-Schreibvorgang

8) GIVEN eine `UpdateModelSettingInput` mit `modelId: "UPPER/Case"`
   WHEN `updateModelSetting(input)` aufgerufen wird
   THEN wird `{ error: "Invalid model ID format" }` zurueckgegeben (Regex: `/^[a-z0-9-]+\/[a-z0-9._-]+$/`)

9) GIVEN eine `UpdateModelSettingInput` mit `{ mode: "upscale", tier: "max", modelId: "owner/model" }`
   WHEN `updateModelSetting(input)` aufgerufen wird
   THEN wird `{ error: "Upscale mode does not support max tier" }` zurueckgegeben ohne DB-Schreibvorgang

10) GIVEN eine `UpdateModelSettingInput` mit `mode: "invalid"` oder `tier: "invalid"`
    WHEN `updateModelSetting(input)` aufgerufen wird
    THEN wird ein Error-Objekt zurueckgegeben (`"Invalid generation mode"` bzw. `"Invalid tier"`)

11) GIVEN eine gueltige `UpdateModelSettingInput` fuer `mode: "img2img"` mit einem inkompatiblen Model
    WHEN `updateModelSetting(input)` aufgerufen wird
    THEN delegiert die Action an `ModelSettingsService.update()` und gibt dessen `{ error: "Model does not support this mode" }` weiter

12) GIVEN `app/actions/model-settings.ts`
    WHEN die Datei gelesen wird
    THEN beginnt sie mit `"use server"` (Next.js Server Action Pflicht)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/types.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Type definitions', () => {
  // AC-1: Tier Type
  it.todo('should accept draft, quality, max as valid Tier values')

  // AC-2: GenerationMode Type
  it.todo('should accept txt2img, img2img, upscale as valid GenerationMode values')

  // AC-3: UpdateModelSettingInput DTO
  it.todo('should have mode, tier, and modelId fields with correct types')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/model-settings.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('getModelSettings', () => {
  // AC-4: Alle Settings lesen
  it.todo('should return array of ModelSetting objects from service')

  // AC-5: Auto-Seed bei leerer Tabelle
  it.todo('should delegate to ModelSettingsService.getAll() which seeds defaults')
})

describe('updateModelSetting', () => {
  // AC-6: Erfolgreicher Update
  it.todo('should return updated ModelSetting for valid input')

  // AC-7: Ungueltiges modelId-Format
  it.todo('should return error for modelId without owner/name format')

  // AC-8: Grossbuchstaben im modelId
  it.todo('should return error for modelId with uppercase characters')

  // AC-9: Upscale + Max abgelehnt
  it.todo('should return error for upscale mode with max tier')

  // AC-10: Ungueltige mode/tier Werte
  it.todo('should return error for invalid mode or tier values')

  // AC-11: Inkompatibles Model weitergeleitet
  it.todo('should forward incompatibility error from ModelSettingsService')

  // AC-12: use server Direktive
  it.todo('should export from a file with use server directive')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-model-settings-service` | `ModelSettingsService` | Service Module | `.getAll()`, `.update()` |
| `slice-02-model-settings-service` | `ModelSetting` | TypeAlias | `typeof modelSettings.$inferSelect` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getModelSettings` | Server Action | slice-04 (Settings Dialog), slice-06 (Workspace) | `() => Promise<ModelSetting[]>` |
| `updateModelSetting` | Server Action | slice-04 (Settings Dialog) | `(input: UpdateModelSettingInput) => Promise<ModelSetting \| { error: string }>` |
| `Tier` | Type | slice-05, slice-06, slice-08, slice-09, slice-10, slice-11 | `"draft" \| "quality" \| "max"` |
| `GenerationMode` | Type | slice-04, slice-07 | `"txt2img" \| "img2img" \| "upscale"` |
| `UpdateModelSettingInput` | DTO Type | slice-04 | `{ mode: GenerationMode, tier: Tier, modelId: string }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/model-settings.ts` -- Neue Datei: `getModelSettings()` und `updateModelSetting()` Server Actions mit Input-Validierung
- [ ] `lib/types.ts` -- Neue Datei: `Tier` Type, `GenerationMode` Type, `UpdateModelSettingInput` DTO
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Komponenten (kommen in Slice 4+)
- KEINE Aenderungen am Service oder an Queries (erledigt in Slice 2)
- KEINE Aenderungen an bestehenden Server Actions (`generateImages`, `upscaleImage`) -- kommt in Slice 7
- KEINE Aenderungen am DB-Schema (erledigt in Slice 1)

**Technische Constraints:**
- `"use server"` Direktive am Datei-Anfang (Next.js Server Action Pattern)
- `modelId` Validierung per Regex `/^[a-z0-9-]+\/[a-z0-9._-]+$/` VOR Service-Aufruf
- `mode` Validierung gegen Whitelist `["txt2img", "img2img", "upscale"]`
- `tier` Validierung gegen Whitelist `["draft", "quality", "max"]`
- Kombination `(upscale, max)` explizit ablehnen VOR Service-Aufruf
- Error-Rueckgabe als `{ error: string }` Objekt (kein throw, bestehendes Pattern)
- Service-Fehler (z.B. Inkompatibilitaet) durchreichen, nicht verschlucken

**Referenzen:**
- Server Actions: `architecture.md` -> Section "Server Actions (new)"
- DTOs: `architecture.md` -> Section "Data Transfer Objects"
- Validation Rules: `architecture.md` -> Section "Validation Rules"
- Business Rules: `discovery.md` -> Section "Business Rules"
