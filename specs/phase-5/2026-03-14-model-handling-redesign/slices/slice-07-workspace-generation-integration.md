# Slice 7: Workspace Generation Integration

> **Slice 7 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-workspace-generation-integration` |
| **Test** | `pnpm test components/workspace/prompt-area app/actions/generations lib/services/generation-service` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-workspace-prompt-area-tier-toggle"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace app/actions/generations lib/services/generation-service` |
| **Integration Command** | `pnpm test components/workspace app/actions/generations` |
| **Acceptance Command** | `pnpm test components/workspace app/actions/generations lib/services/generation-service` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ReplicateClient, DB-Queries gemockt) |

---

## Ziel

Die Generation-Logik in der Workspace Prompt-Area mit dem Tier-System verbinden: `handleGenerate()` resolved das Model aus den gecachten `modelSettings` + aktuellem `tier`/`maxQuality`-State. Gleichzeitig wird die `upscaleImage` Server Action und der `GenerationService.upscale()` so erweitert, dass `modelId` + `modelParams` dynamisch uebergeben werden statt hardcoded.

---

## Acceptance Criteria

1) GIVEN der User ist im `txt2img`-Mode mit `tier="draft"` und Model-Settings sind geladen (Draft = `black-forest-labs/flux-schnell`)
   WHEN `handleGenerate()` ausgefuehrt wird
   THEN wird `generateImages()` mit `modelIds: ["black-forest-labs/flux-schnell"]` und `params` aus dem gecachten `modelParams`-Objekt der Settings aufgerufen

2) GIVEN der User ist im `txt2img`-Mode mit `tier="quality"` und `maxQuality=false`
   WHEN `handleGenerate()` ausgefuehrt wird
   THEN wird `generateImages()` mit `modelIds: ["black-forest-labs/flux-2-pro"]` aufgerufen (Quality-Model aus Settings)

3) GIVEN der User ist im `txt2img`-Mode mit `tier="quality"` und `maxQuality=true`
   WHEN `handleGenerate()` ausgefuehrt wird
   THEN wird `generateImages()` mit `modelIds: ["black-forest-labs/flux-2-max"]` aufgerufen (Max-Model aus Settings)

4) GIVEN der User ist im `img2img`-Mode mit `tier="draft"`
   WHEN `handleGenerate()` ausgefuehrt wird
   THEN wird `generateImages()` mit `modelIds` aus den `img2img/draft` Settings und `params` inklusive `modelParams` (z.B. `{ "prompt_strength": 0.6 }`) aufgerufen

5) GIVEN der User ist im `upscale`-Mode mit `tier="draft"` und Model-Settings sind geladen (upscale/draft = `nightmareai/real-esrgan`)
   WHEN der Upscale ausgefuehrt wird
   THEN wird `upscaleImage()` mit `modelId: "nightmareai/real-esrgan"` und `modelParams: { "scale": 2 }` aus Settings aufgerufen

6) GIVEN der User ist im `upscale`-Mode mit `tier="quality"` (upscale/quality = `philz1337x/crystal-upscaler`)
   WHEN der Upscale ausgefuehrt wird
   THEN wird `upscaleImage()` mit `modelId: "philz1337x/crystal-upscaler"` und `modelParams: { "scale": 4 }` aus Settings aufgerufen

7) GIVEN die Server Action `upscaleImage` in `generations.ts`
   WHEN mit Input `{ projectId, sourceImageUrl, scale, modelId: "nightmareai/real-esrgan", modelParams: { "scale": 2 } }` aufgerufen
   THEN wird `modelId` und `modelParams` an `GenerationService.upscale()` weitergeleitet (kein hardcoded `UPSCALE_MODEL`)

8) GIVEN die Funktion `upscale()` in `generation-service.ts`
   WHEN mit `modelId: "philz1337x/crystal-upscaler"` und `modelParams: { "scale": 4 }` aufgerufen
   THEN wird das uebergebene `modelId` fuer den Replicate-Call und fuer `createGeneration()` verwendet (statt `UPSCALE_MODEL` Konstante)

9) GIVEN eine erfolgreiche txt2img-Generation mit `tier="quality"`
   WHEN die Generation in der DB gespeichert wird
   THEN enthaelt `generations.modelId` den Wert `"black-forest-labs/flux-2-pro"` (das tatsaechlich verwendete Model)

10) GIVEN Model-Settings sind noch nicht geladen (`modelSettings` Array ist leer)
    WHEN der User `handleGenerate()` oder Upscale ausfuehrt
    THEN wird die Generation verhindert (Button bleibt disabled oder Frueh-Return) -- kein Crash

11) GIVEN die `UpscaleImageInput` Interface in `generations.ts`
    WHEN die Typdefinition analysiert wird
    THEN enthaelt sie die neuen Felder `modelId: string` und `modelParams: Record<string, unknown>` zusaetzlich zu den bestehenden Feldern

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area-generation.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea - Generation Model Resolution', () => {
  // AC-1: Draft txt2img nutzt Draft-Model
  it.todo('should call generateImages with draft model for txt2img in draft tier')

  // AC-2: Quality txt2img nutzt Quality-Model
  it.todo('should call generateImages with quality model for txt2img in quality tier')

  // AC-3: Max Quality txt2img nutzt Max-Model
  it.todo('should call generateImages with max model when maxQuality is true')

  // AC-4: img2img nutzt Mode-spezifische Settings inkl. modelParams
  it.todo('should call generateImages with img2img settings including modelParams')

  // AC-5: Upscale Draft nutzt Draft-Upscale-Model
  it.todo('should call upscaleImage with draft upscale model and modelParams')

  // AC-6: Upscale Quality nutzt Quality-Upscale-Model
  it.todo('should call upscaleImage with quality upscale model and modelParams')

  // AC-9: modelId wird korrekt gespeichert
  it.todo('should pass resolved modelId so generations table stores actual model used')

  // AC-10: Kein Crash bei fehlenden Settings
  it.todo('should prevent generation when modelSettings are not loaded')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations-upscale.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('upscaleImage - Extended Input', () => {
  // AC-7: modelId + modelParams werden an Service weitergeleitet
  it.todo('should pass modelId and modelParams to GenerationService.upscale')

  // AC-11: UpscaleImageInput hat neue Felder
  it.todo('should accept modelId and modelParams in UpscaleImageInput')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/generation-service-upscale.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationService.upscale - Dynamic Model', () => {
  // AC-8: Uebergebenes modelId wird verwendet statt UPSCALE_MODEL
  it.todo('should use provided modelId for Replicate call and createGeneration')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06` | `tier` State | React State in prompt-area | `Tier` -- aktueller Tier fuer Model-Resolution |
| `slice-06` | `maxQuality` State | React State in prompt-area | `boolean` -- ob Max Quality aktiv ist |
| `slice-06` | `modelSettings` State | React State in prompt-area | `ModelSetting[]` -- gecachte Settings |
| `slice-03` | `Tier`, `GenerationMode` | Types | `"draft" \| "quality" \| "max"`, `"txt2img" \| "img2img" \| "upscale"` |
| `slice-03` | `generateImages` | Server Action | `(input: GenerateImagesInput) => Promise<...>` (bestehend, Interface unveraendert) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `upscaleImage` (erweitert) | Server Action | slice-10 (Canvas Upscale) | `(input: UpscaleImageInput) => Promise<Generation \| { error: string }>` -- mit `modelId` + `modelParams` |
| `GenerationService.upscale` (erweitert) | Service Function | intern (via Server Action) | `upscale(input: UpscaleInput) => Promise<Generation>` -- mit `modelId` + `modelParams` |
| Model-Resolution Pattern | Logic Pattern | slice-09, slice-10, slice-11 | `resolveModel(settings, mode, tier, maxQuality) => { modelId, modelParams }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- Bestehend: `handleGenerate()` und Upscale-Logik aendern, Model aus Settings + Tier resolven
- [ ] `app/actions/generations.ts` -- Bestehend: `UpscaleImageInput` um `modelId` + `modelParams` erweitern, an Service weiterleiten
- [ ] `lib/services/generation-service.ts` -- Bestehend: `UpscaleInput` + `upscale()` Signatur um `modelId` + `modelParams` erweitern, `UPSCALE_MODEL` Import entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Canvas-Aenderungen -- kommen in Slice 8-11
- KEINE Aenderungen am Settings-Dialog -- erledigt in Slice 4
- KEINE Aenderungen am TierToggle/MaxQualityToggle UI -- erledigt in Slice 5+6
- KEINE neuen Dateien erstellen -- nur bestehende Dateien aendern
- KEINE Aenderung an `generateImages` Server Action Interface -- `modelIds` Array-Interface bleibt, empfaengt jetzt `[resolvedModelId]`

**Technische Constraints:**
- Model-Resolution: Lookup in `modelSettings` Array via `mode + effectiveTier` (effectiveTier = `maxQuality ? "max" : tier`)
- Fuer `generateImages()`: `modelIds: [resolvedModelId]`, `params` aus `modelSetting.modelParams`
- Fuer `upscaleImage()`: `modelId` und `modelParams` aus Settings uebergeben
- `UpscaleInput` in `generation-service.ts`: `modelId: string` und `modelParams: Record<string, unknown>` als neue Pflichtfelder
- `UPSCALE_MODEL` Import in `generation-service.ts` entfernen -- Model kommt jetzt als Parameter
- Fallback bei nicht-geladenen Settings: Generate-Button disabled oder Frueh-Return in Handler

**Referenzen:**
- Generation Flow: `architecture.md` -> Section "Business Logic Flow"
- Server Actions (changed): `architecture.md` -> Section "Server Actions (changed)"
- UpscaleImageInput DTO: `architecture.md` -> Section "Data Transfer Objects"
- Migration Map fuer alle 3 Dateien: `architecture.md` -> Section "Migration Map"
