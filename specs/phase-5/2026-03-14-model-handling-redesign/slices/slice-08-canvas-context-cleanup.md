# Slice 8: Canvas Context Cleanup

> **Slice 8 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-canvas-context-cleanup` |
| **Test** | `pnpm test lib/canvas-detail-context components/canvas/canvas-detail-view` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-tier-toggle-component"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/canvas-detail-context components/canvas/canvas-detail-view` |
| **Integration Command** | `pnpm test lib/canvas-detail-context components/canvas` |
| **Acceptance Command** | `pnpm test lib/canvas-detail-context components/canvas/canvas-detail-view` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (getModelSettings Server Action wird gemockt) |

---

## Ziel

`selectedModelId` und `SET_SELECTED_MODEL` aus dem Canvas-Detail-Context entfernen und die Canvas-Tool-Handler (`handleVariationGenerate`, `handleImg2imgGenerate`, `handleUpscale`) auf Settings-basierte Model-Resolution umstellen. Model-Settings werden in `canvas-detail-view.tsx` beim Mount via `getModelSettings()` gefetcht und als lokaler State gecacht, damit nachfolgende Slices (9, 10, 11) die Settings fuer Tier-basierte Model-Resolution nutzen koennen.

---

## Acceptance Criteria

1) GIVEN `CanvasDetailState` aus `lib/canvas-detail-context.tsx`
   WHEN das Interface inspiziert wird
   THEN enthaelt es KEIN Feld `selectedModelId`

2) GIVEN `CanvasDetailAction` aus `lib/canvas-detail-context.tsx`
   WHEN der Union-Type inspiziert wird
   THEN enthaelt er KEINEN Member `{ type: "SET_SELECTED_MODEL"; modelId: string | null }`

3) GIVEN der `canvasDetailReducer`
   WHEN alle switch-cases geprueft werden
   THEN existiert KEIN `case "SET_SELECTED_MODEL"`

4) GIVEN der `CanvasDetailProvider`
   WHEN der initiale State erzeugt wird
   THEN enthaelt er KEIN Feld `selectedModelId`

5) GIVEN `canvas-detail-view.tsx` wird geladen und die `model_settings` Tabelle hat 8 Eintraege
   WHEN die Komponente mountet
   THEN wird `getModelSettings()` aufgerufen und das Ergebnis als `ModelSetting[]` im lokalen State gespeichert

6) GIVEN `modelSettings` sind geladen mit einem img2img/draft Eintrag `{ modelId: "black-forest-labs/flux-schnell", modelParams: {} }`
   WHEN `handleVariationGenerate` aufgerufen wird (ohne Tier-Parameter, Default-Fallback)
   THEN wird `generateImages` mit `modelIds: ["black-forest-labs/flux-schnell"]` aufgerufen (statt `state.selectedModelId ?? currentGeneration.modelId`)

7) GIVEN `modelSettings` sind geladen mit einem img2img/draft Eintrag
   WHEN `handleImg2imgGenerate` aufgerufen wird (ohne Tier-Parameter, Default-Fallback)
   THEN wird `generateImages` mit dem img2img/draft Model aus Settings aufgerufen (statt `state.selectedModelId ?? currentGeneration.modelId`)

8) GIVEN `modelSettings` sind geladen mit einem upscale/draft Eintrag `{ modelId: "nightmareai/real-esrgan", modelParams: { "scale": 2 } }`
   WHEN `handleUpscale` aufgerufen wird (ohne Tier-Parameter, Default-Fallback)
   THEN wird `upscaleImage` mit `modelId: "nightmareai/real-esrgan"` und den gemergten Params aufgerufen (statt hardcoded)

9) GIVEN `modelSettings` fetch schlaegt fehl (Netzwerkfehler)
   WHEN ein Canvas-Tool-Handler aufgerufen wird
   THEN wird `currentGeneration.modelId` als Fallback verwendet (graceful degradation)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/canvas-detail-context.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailState (after cleanup)', () => {
  // AC-1: selectedModelId entfernt aus State
  it.todo('should not have selectedModelId in CanvasDetailState interface')

  // AC-4: Initialer State ohne selectedModelId
  it.todo('should not include selectedModelId in initial state')
})

describe('CanvasDetailAction (after cleanup)', () => {
  // AC-2: SET_SELECTED_MODEL entfernt aus Action Union
  it.todo('should not include SET_SELECTED_MODEL in action union type')
})

describe('canvasDetailReducer (after cleanup)', () => {
  // AC-3: Kein SET_SELECTED_MODEL case
  it.todo('should not handle SET_SELECTED_MODEL action')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-model-resolution.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView Model-Settings fetch', () => {
  // AC-5: Model-Settings beim Mount fetchen
  it.todo('should call getModelSettings on mount and store result in state')
})

describe('handleVariationGenerate with Settings-based resolution', () => {
  // AC-6: Variation nutzt img2img/draft Model aus Settings
  it.todo('should call generateImages with modelId from img2img/draft setting')
})

describe('handleImg2imgGenerate with Settings-based resolution', () => {
  // AC-7: Img2img nutzt img2img/draft Model aus Settings
  it.todo('should call generateImages with modelId from img2img/draft setting')
})

describe('handleUpscale with Settings-based resolution', () => {
  // AC-8: Upscale nutzt upscale/draft Model aus Settings
  it.todo('should call upscaleImage with modelId and modelParams from upscale/draft setting')
})

describe('Fallback bei fehlgeschlagenem Settings-fetch', () => {
  // AC-9: Graceful degradation
  it.todo('should fall back to currentGeneration.modelId when modelSettings is empty')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03` | `getModelSettings` | Server Action | `() => Promise<ModelSetting[]>` |
| `slice-03` | `Tier` | Type | `"draft" \| "quality" \| "max"` |
| `slice-02` | `ModelSetting` | TypeAlias | Drizzle-inferred Row-Type mit `mode`, `tier`, `modelId`, `modelParams` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `modelSettings` State | `ModelSetting[]` in canvas-detail-view | slice-09, slice-10, slice-11 | Lokaler State, verfuegbar fuer Handler-Logik |
| Bereinigte `CanvasDetailState` | Interface | slice-09, slice-10, slice-11, slice-12 | State ohne `selectedModelId` |
| Bereinigte `CanvasDetailAction` | Union Type | slice-12 | Actions ohne `SET_SELECTED_MODEL` |
| Model-Resolution Helper-Pattern | Lookup-Pattern | slice-09, slice-10, slice-11 | `settings.find(s => s.mode === mode && s.tier === tier)` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/canvas-detail-context.tsx` -- Bestehend: `selectedModelId` aus State entfernen, `SET_SELECTED_MODEL` aus Action-Union und Reducer entfernen, Initial-State anpassen
- [ ] `components/canvas/canvas-detail-view.tsx` -- Bestehend: `modelSettings` State hinzufuegen (fetch on mount via `getModelSettings()`), Handler `handleVariationGenerate`/`handleImg2imgGenerate`/`handleUpscale` auf Settings-basierte Model-Resolution umstellen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN TierToggle-Einbau in Popovers oder Chat (kommt in Slice 9, 10, 11)
- KEINE Entfernung von `CanvasModelSelector` Import/Render (kommt in Slice 12)
- KEINE Aenderung an `upscaleImage` Server Action Signatur (erledigt in Slice 7)
- KEINE Aenderungen an `assistant-context.tsx` (hat eigenes `SET_SELECTED_MODEL`, nicht im Scope)
- Handler nutzen vorerst Default-Tier `"draft"` als Fallback -- Tier-Parameter von Popovers kommt in Slice 9/10

**Build-Validierung:**
- `pnpm tsc --noEmit` muss ohne Fehler kompilieren -- keine Referenzen auf entferntes `selectedModelId` oder `SET_SELECTED_MODEL` in produktivem Code (CI-Pipeline-Check, kein Unit-Test)

**Technische Constraints:**
- `getModelSettings()` einmal beim Mount aufrufen, Ergebnis in `useState<ModelSetting[]>` cachen
- Model-Resolution per Lookup: `modelSettings.find(s => s.mode === mode && s.tier === tier)`
- Bei leerem/fehlendem Settings-Array: Fallback auf `currentGeneration.modelId` (graceful degradation)
- `state.selectedModelId` Referenzen in useCallback-Dependency-Arrays entfernen
- Bestehende Tests in `lib/__tests__/canvas-detail-context.test.ts` und `components/canvas/__tests__/` muessen an bereinigten State angepasst werden

**Referenzen:**
- Context-Aenderungen: `architecture.md` -> Section "Migration Map" -> `lib/canvas-detail-context.tsx`
- Handler-Aenderungen: `architecture.md` -> Section "Migration Map" -> `components/canvas/canvas-detail-view.tsx`
- Model-Resolution Flow: `architecture.md` -> Section "Business Logic Flow" -> "[Generation (Workspace/Canvas)]"
- Settings-Fetch Pattern: `architecture.md` -> Section "Technology Decisions" -> "Client-side model resolution"
