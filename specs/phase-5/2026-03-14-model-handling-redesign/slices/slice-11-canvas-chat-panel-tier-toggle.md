# Slice 11: Canvas Chat Panel Tier Toggle

> **Slice 11 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-canvas-chat-panel-tier-toggle` |
| **Test** | `pnpm test components/canvas/canvas-chat-panel` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-canvas-context-cleanup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/canvas-chat-panel` |
| **Integration Command** | `pnpm test components/canvas` |
| **Acceptance Command** | `pnpm test components/canvas/canvas-chat-panel` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (generateImages Server Action + getModelSettings werden gemockt) |

---

## Ziel

`TierToggle` und `MaxQualityToggle` als kompakte Leiste ueber dem Chat-Input im Canvas Chat Panel einbauen. Eigener Tier-State (unabhaengig von Popovers). `handleCanvasGenerate()` ignoriert `event.model_id` und resolved stattdessen das Model aus den img2img-Settings plus dem Chat-Tier.

---

## Acceptance Criteria

1) GIVEN das Canvas Chat Panel ist geoeffnet und expanded
   WHEN es gerendert wird
   THEN zeigt es eine `TierToggle`-Komponente zwischen der ChatThread und dem ChatInput, mit Default-Tier `"draft"`

2) GIVEN der Tier-State steht auf `"draft"`
   WHEN der User auf "Quality" im TierToggle klickt
   THEN wechselt der Tier-State zu `"quality"` und eine `MaxQualityToggle`-Komponente wird neben/unter dem TierToggle sichtbar

3) GIVEN der Tier-State steht auf `"quality"`
   WHEN der User auf "Draft" im TierToggle klickt
   THEN wechselt der Tier-State zu `"draft"` und die `MaxQualityToggle`-Komponente wird ausgeblendet

4) GIVEN der Tier-State steht auf `"quality"` und `maxQuality` ist `false`
   WHEN der User den MaxQualityToggle aktiviert
   THEN wird `maxQuality` auf `true` gesetzt (effektiver Tier fuer Model-Resolution: `"max"`)

5) GIVEN ein SSE `canvas-generate` Event wird empfangen mit `event.model_id = "some-ai-chosen/model"`
   WHEN `handleCanvasGenerate()` ausgefuehrt wird und Tier ist `"draft"`
   THEN wird `generateImages` mit `modelIds: [img2img-draft-modelId]` aufgerufen, wobei `img2img-draft-modelId` aus den modelSettings stammt (z.B. `"black-forest-labs/flux-schnell"`), und `event.model_id` wird ignoriert

6) GIVEN Tier ist `"quality"` und `maxQuality` ist `true`
   WHEN `handleCanvasGenerate()` ausgefuehrt wird
   THEN wird `generateImages` mit `modelIds: [img2img-max-modelId]` aufgerufen (z.B. `"black-forest-labs/flux-2-max"`) und die zugehoerigen `modelParams` aus Settings werden als `params` uebergeben

7) GIVEN Tier ist `"quality"` und `maxQuality` ist `false`
   WHEN `handleCanvasGenerate()` ausgefuehrt wird
   THEN wird `generateImages` mit `modelIds: [img2img-quality-modelId]` aufgerufen (z.B. `"black-forest-labs/flux-2-pro"`)

8) GIVEN eine AI-Antwort wird gestreamt (`isStreaming === true`)
   WHEN der User auf den TierToggle klickt
   THEN wechselt der Tier-State (TierToggle bleibt interaktiv waehrend Streaming)

9) GIVEN eine Generation laeuft (`state.isGenerating === true`)
   WHEN der User den TierToggle oder MaxQualityToggle bedienen will
   THEN sind beide Toggles `disabled` (nicht klickbar)

10) GIVEN `modelSettings` konnten nicht geladen werden (leeres Array)
    WHEN `handleCanvasGenerate()` ausgefuehrt wird
    THEN wird `generation.modelId` als Fallback verwendet (graceful degradation, bestehendes Verhalten)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-chat-panel-tier-toggle.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasChatPanel TierToggle rendering', () => {
  // AC-1: TierToggle sichtbar mit Default draft
  it.todo('should render TierToggle above ChatInput with default tier draft')

  // AC-2: Quality zeigt MaxQualityToggle
  it.todo('should show MaxQualityToggle when tier switches to quality')

  // AC-3: Draft versteckt MaxQualityToggle
  it.todo('should hide MaxQualityToggle when tier switches back to draft')

  // AC-4: MaxQuality Toggle aktivieren
  it.todo('should set maxQuality to true when MaxQualityToggle is activated')
})

describe('CanvasChatPanel handleCanvasGenerate model resolution', () => {
  // AC-5: Draft Tier ignoriert event.model_id
  it.todo('should call generateImages with img2img/draft model from settings, ignoring event.model_id')

  // AC-6: Quality+Max resolved max model
  it.todo('should call generateImages with img2img/max model when tier is quality and maxQuality is true')

  // AC-7: Quality ohne Max resolved quality model
  it.todo('should call generateImages with img2img/quality model when tier is quality and maxQuality is false')

  // AC-10: Fallback bei fehlenden Settings
  it.todo('should fall back to generation.modelId when modelSettings is empty')
})

describe('CanvasChatPanel TierToggle interaction states', () => {
  // AC-8: Interaktiv waehrend Streaming
  it.todo('should keep TierToggle interactive while isStreaming is true')

  // AC-9: Disabled waehrend Generation
  it.todo('should disable TierToggle and MaxQualityToggle while isGenerating is true')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05` | `TierToggle` | React Component | `<TierToggle tier={Tier} onTierChange={(t) => void} disabled? className? />` |
| `slice-05` | `MaxQualityToggle` | React Component | `<MaxQualityToggle maxQuality={boolean} onMaxQualityChange={(v) => void} disabled? />` |
| `slice-08` | `modelSettings` State | `ModelSetting[]` | Verfuegbar in canvas-detail-view, muss als Prop an CanvasChatPanel weitergereicht werden |
| `slice-03` | `Tier` | Type | `"draft" \| "quality" \| "max"` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Chat-Tier-basierte Generation | Behaviour | slice-12 (Cleanup) | Chat Panel nutzt Settings-basierte Model-Resolution, kein `event.model_id` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-chat-panel.tsx` -- Bestehend: Tier-State + MaxQuality-State hinzufuegen, TierToggle + MaxQualityToggle ueber ChatInput rendern, `handleCanvasGenerate()` auf Settings-basierte Model-Resolution umstellen, `modelSettings` als neue Prop akzeptieren
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `canvas-detail-view.tsx` (Slice 8 stellt `modelSettings` bereit, Prop-Weiterreichung ist minimale Anpassung im Rahmen dieses Slices)
- KEIN eigener `getModelSettings()` Fetch im Chat Panel (Settings kommen als Prop vom Parent)
- KEINE Aenderung an der SSE-Event-Struktur (`model_id` Feld bleibt im Event, wird nur clientseitig ignoriert)
- KEINE Entfernung des `ModelSelector`-Imports (wird in Slice 12 Cleanup erledigt)
- KEIN Tier-State Persistence (Session-only, Default immer `"draft"`)

**Technische Constraints:**
- Tier-State via `useState<Tier>("draft")` und `useState<boolean>(false)` fuer maxQuality
- Effektiver Tier fuer Model-Resolution: `maxQuality && tier === "quality" ? "max" : tier`
- Model-Lookup: `modelSettings.find(s => s.mode === "img2img" && s.tier === effectiveTier)`
- TierToggle `disabled={state.isGenerating}` (nicht waehrend Streaming)
- Fallback wenn kein Setting gefunden: `generation.modelId` verwenden
- Kompaktes Layout: TierToggle + MaxQualityToggle in einer Zeile zwischen ChatThread und ChatInput

**Referenzen:**
- Layout/Position: `wireframes.md` -> Section "Screen: Canvas Chat Panel"
- State-Varianten (streaming vs generating): `wireframes.md` -> "State Variations" Tabelle im Chat-Panel-Screen
- Model-Resolution Flow: `architecture.md` -> Section "Migration Map" -> `canvas-chat-panel.tsx`
- handleCanvasGenerate Aenderung: `architecture.md` -> Section "Migration Map" -> `canvas-chat-panel.tsx` Zeile "handleCanvasGenerate(): ignore event.model_id"
