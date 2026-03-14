# Slice 6: Workspace Prompt-Area Tier Toggle

> **Slice 6 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-workspace-prompt-area-tier-toggle` |
| **Test** | `pnpm test components/workspace/prompt-area` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-tier-toggle-component"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/prompt-area` |
| **Integration Command** | `pnpm test components/workspace` |
| **Acceptance Command** | `pnpm test components/workspace/prompt-area` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Action `getModelSettings` wird gemockt) |

---

## Ziel

`TierToggle` und `MaxQualityToggle` in die Workspace Prompt-Area einbauen und gleichzeitig die alte Model-Section (ModelTrigger, ModelBrowserDrawer) sowie das ParameterPanel entfernen. Model-Settings werden beim Mount via `getModelSettings()` gefetcht und im lokalen State gecacht, damit nachfolgende Slices (Slice 7) darauf zugreifen koennen.

---

## Acceptance Criteria

1) GIVEN die Prompt-Area wird gerendert (txt2img oder img2img Mode)
   WHEN der initiale Render abgeschlossen ist
   THEN ist ein `TierToggle` sichtbar mit `tier="draft"` als Default, positioniert oberhalb des Generate-Buttons und unterhalb der Prompt-Felder (Separator dazwischen)

2) GIVEN die Prompt-Area wird gerendert im Upscale-Mode
   WHEN der initiale Render abgeschlossen ist
   THEN ist ein `TierToggle` sichtbar mit `tier="draft"` als Default, positioniert oberhalb des Upscale-Buttons

3) GIVEN der TierToggle steht auf "draft" (txt2img oder img2img Mode)
   WHEN der User auf "Quality" klickt
   THEN wechselt der TierToggle zu `tier="quality"` und ein `MaxQualityToggle` erscheint unterhalb des TierToggles mit `maxQuality={false}`

4) GIVEN der TierToggle steht auf "quality"
   WHEN der User auf "Draft" klickt
   THEN wechselt der TierToggle zu `tier="draft"` und der MaxQualityToggle ist nicht mehr sichtbar

5) GIVEN der TierToggle steht auf "quality" im Upscale-Mode
   WHEN der Render abgeschlossen ist
   THEN wird KEIN MaxQualityToggle angezeigt (Upscale hat keinen Max-Tier)

6) GIVEN die Prompt-Area Datei (`prompt-area.tsx`)
   WHEN die Imports analysiert werden
   THEN gibt es KEINE Imports mehr von `ModelTrigger`, `ModelBrowserDrawer`, `ParameterPanel`, `getModelSchema`, `getProjectSelectedModels`, `saveProjectSelectedModels`

7) GIVEN die Prompt-Area Datei
   WHEN nach JSX-Rendering von `<ModelTrigger`, `<ModelBrowserDrawer`, `<ParameterPanel` gesucht wird
   THEN gibt es KEINE Render-Aufrufe dieser Komponenten mehr

8) GIVEN die Prompt-Area wird gemounted
   WHEN der `useEffect` fuer Model-Settings ausgefuehrt wird
   THEN wird `getModelSettings()` aufgerufen und das Ergebnis in einem lokalen `modelSettings` State gespeichert (Array von `ModelSetting`-Objekten)

9) GIVEN `getModelSettings()` gibt ein leeres Array oder einen Fehler zurueck
   WHEN der Mount-Effect abgeschlossen ist
   THEN bleibt die UI funktional (TierToggle sichtbar, Generate-Button vorhanden), Settings-Array bleibt leer bzw. Default

10) GIVEN die State-Variablen `selectedModels`, `paramValues` und die zugehoerige Multi-Model-Logik
    WHEN die Prompt-Area Datei analysiert wird
    THEN sind diese States und die Logik rund um `selectedModels` (z.B. `isSingleModel`, Multi-Model-Notice) entfernt

11) GIVEN der Tier-State steht auf "draft" und es findet gerade eine Generation statt (`isGenerating === true`)
    WHEN der User die TierToggle betrachtet
    THEN ist der TierToggle `disabled` (nicht klickbar) waehrend der Generation

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area-tier-toggle.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea - Tier Toggle Integration', () => {
  // AC-1: TierToggle sichtbar mit Draft Default (txt2img/img2img)
  it.todo('should render TierToggle with draft as default tier in txt2img mode')

  // AC-2: TierToggle sichtbar im Upscale-Mode
  it.todo('should render TierToggle with draft as default tier in upscale mode')

  // AC-3: Quality-Klick zeigt MaxQualityToggle
  it.todo('should show MaxQualityToggle when tier is switched to quality in txt2img mode')

  // AC-4: Draft-Klick verbirgt MaxQualityToggle
  it.todo('should hide MaxQualityToggle when tier is switched back to draft')

  // AC-5: Kein MaxQualityToggle im Upscale-Mode
  it.todo('should not render MaxQualityToggle when in upscale mode even with quality tier')

  // AC-8: Model-Settings fetch on mount
  it.todo('should call getModelSettings on mount and store result in state')

  // AC-9: Fehlertoleranz bei leerem Settings-Array
  it.todo('should remain functional when getModelSettings returns empty array')

  // AC-11: TierToggle disabled waehrend Generation
  it.todo('should pass disabled to TierToggle when generation is in progress')
})

describe('PromptArea - Removed Components', () => {
  // AC-6: Keine alten Imports
  it.todo('should not import ModelTrigger, ModelBrowserDrawer, or ParameterPanel')

  // AC-7: Keine alten Render-Aufrufe
  it.todo('should not render ModelTrigger, ModelBrowserDrawer, or ParameterPanel')

  // AC-10: selectedModels/paramValues entfernt
  it.todo('should not use selectedModels or paramValues state')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05` | `TierToggle` | React Component | `<TierToggle tier={Tier} onTierChange={(t: Tier) => void} disabled?: boolean />` |
| `slice-05` | `MaxQualityToggle` | React Component | `<MaxQualityToggle maxQuality={boolean} onMaxQualityChange={(v: boolean) => void} />` |
| `slice-03` | `Tier` | Type | `"draft" \| "quality" \| "max"` |
| `slice-03` | `getModelSettings` | Server Action | `() => Promise<ModelSetting[]>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `modelSettings` State | React State in prompt-area | slice-07 | `ModelSetting[]` -- gecachte Settings fuer Model-Resolution bei Generation |
| `tier` State | React State in prompt-area | slice-07 | `Tier` -- aktueller Tier fuer Model-Resolution |
| `maxQuality` State | React State in prompt-area | slice-07 | `boolean` -- ob Max Quality aktiv ist |
| Bereinigte Prompt-Area | Component | slice-07, slice-12 | Keine ModelTrigger/ModelBrowserDrawer/ParameterPanel Imports mehr |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- Bestehend, aendern: TierToggle + MaxQualityToggle einbauen, Model-Settings fetch, alte Model-Section + ParameterPanel + Multi-Model-Logik entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung der Generation-Logik (`handleGenerate`, `handleUpscale`) -- die Model-Resolution kommt in Slice 7
- KEINE Aenderung an `generations.ts` oder `generation-service.ts` -- kommt in Slice 7
- KEINE neuen Dateien erstellen -- nur `prompt-area.tsx` aendern
- KEINE Canvas-Aenderungen -- kommen in Slice 8-11
- KEINE Entfernung von Assistant/Chat-Komponenten (die bleiben unveraendert)
- `handleGenerate()` / `handleUpscale()` duerfen in diesem Slice temporaer nicht-funktional sein (kompiliert aber, Model-Resolution folgt in Slice 7)

**Technische Constraints:**
- `tier` State: `useState<Tier>("draft")` -- Default ist immer "draft"
- `maxQuality` State: `useState<boolean>(false)` -- Default ist immer false
- `modelSettings` State: `useState<ModelSetting[]>([])` -- gefuellt via `useEffect` beim Mount
- `TierToggle` Position: Oberhalb Generate/Upscale-Button, unterhalb des Separators (`═══`)
- `MaxQualityToggle` Position: Direkt unter TierToggle, nur sichtbar wenn `tier === "quality"` UND `currentMode !== "upscale"`
- Per-Mode State-Objekte (`Txt2ImgState`, `Img2ImgState`): `paramValues` und `modelId` Felder entfernen
- `selectedModels` State, `isSingleModel`, Multi-Model-Notice JSX: komplett entfernen
- `CollectionModel` Type-Import: entfernen wenn nicht mehr referenziert
- `getModelSchema`, `getProjectSelectedModels`, `saveProjectSelectedModels` Imports: entfernen

**Referenzen:**
- Layout-Position des TierToggles: `wireframes.md` -> Section "Screen: Workspace Prompt-Area (modified)"
- State-Varianten: `wireframes.md` -> "State Variations" Tabelle (draft-selected, quality-selected, generating)
- Entfernte Elemente: `wireframes.md` -> "Removed Elements" Tabelle
- Migration Map fuer prompt-area.tsx: `architecture.md` -> Section "Migration Map"
- Tier/GenerationMode Types: `lib/types.ts` (aus Slice 3)
