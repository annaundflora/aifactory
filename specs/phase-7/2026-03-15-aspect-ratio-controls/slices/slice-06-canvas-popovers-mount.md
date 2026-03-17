# Slice 6: ParameterPanel Mount + imageParams State in Canvas Popovers

> **Slice 6** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-canvas-popovers-mount` |
| **Test** | `pnpm test components/canvas/popovers/variation-popover.test.tsx components/canvas/popovers/img2img-popover.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-parameter-panel-split"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/popovers/variation-popover.test.tsx components/canvas/popovers/img2img-popover.test.tsx` |
| **Integration Command** | n/a |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

In `variation-popover.tsx` und `img2img-popover.tsx` den `useModelSchema`-Hook mit dem resolved `modelId` einbinden, lokalen `imageParams`-State verwalten, `ParameterPanel` zwischen TierToggle/MaxQualityToggle und Generate-Button rendern, die Params-Interfaces um `imageParams` erweitern, und `imageParams` im `onGenerate`-Callback mitgeben. In `canvas-detail-view.tsx` wird `modelSettings` als Prop an beide Popovers durchgereicht und `imageParams` in die `generateImages`-Aufrufe gemergt.

---

## Acceptance Criteria

1) GIVEN das Variation-Popover ist offen mit Tier `"draft"` und `modelSettings` enthaelt ein Setting fuer `img2img/draft` mit modelId `"black-forest-labs/flux-schnell"`
   WHEN `useModelSchema` ein Schema mit `aspect_ratio` (enum) zurueckgibt
   THEN erscheint ein `ParameterPanel` zwischen dem TierToggle/MaxQualityToggle-Bereich und dem Generate-Button, das `aspect_ratio` als Primary-Control zeigt

2) GIVEN das Img2img-Popover ist offen mit Tier `"quality"` und `modelSettings` enthaelt ein Setting fuer `img2img/quality`
   WHEN `useModelSchema` ein Schema mit `aspect_ratio` und `resolution` (enums) zurueckgibt
   THEN erscheint ein `ParameterPanel` zwischen dem Tier-Section und dem Generate-Button, das beide Primary-Controls zeigt

3) GIVEN das Variation-Popover zeigt `ParameterPanel` mit `aspect_ratio`
   WHEN der User den Wert auf `"16:9"` aendert und auf Generate klickt
   THEN wird `onGenerate` mit `VariationParams` aufgerufen, wobei `imageParams` den Wert `{ aspect_ratio: "16:9" }` enthaelt

4) GIVEN das Img2img-Popover zeigt `ParameterPanel` mit `aspect_ratio`
   WHEN der User den Wert auf `"3:2"` aendert und auf Generate klickt
   THEN wird `onGenerate` mit `Img2imgParams` aufgerufen, wobei `imageParams` den Wert `{ aspect_ratio: "3:2" }` enthaelt

5) GIVEN `useModelSchema` gibt `{ isLoading: true }` zurueck in einem der Popovers
   WHEN das Popover gerendert wird
   THEN zeigt der Bereich zwischen TierToggle und Generate-Button Skeleton-Platzhalter (aus ParameterPanel)

6) GIVEN der User aendert im Variation-Popover den Tier von `"draft"` zu `"quality"` (anderes Model)
   WHEN das neue Schema geladen wird
   THEN wird `imageParams` auf `{}` zurueckgesetzt

7) GIVEN `canvas-detail-view.tsx` ruft `handleVariationGenerate` auf mit `VariationParams` die `imageParams: { aspect_ratio: "16:9" }` enthalten
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter `{ prompt_strength: <number>, aspect_ratio: "16:9" }` — imageParams werden neben `prompt_strength` in params gemergt

8) GIVEN `canvas-detail-view.tsx` ruft `handleImg2imgGenerate` auf mit `Img2imgParams` die `imageParams: { resolution: "2K" }` enthalten
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter `{ resolution: "2K" }` — imageParams werden in das bisher leere params-Objekt gemergt

9) GIVEN `useModelSchema` gibt `{ error: "..." }` zurueck
   WHEN das Popover gerendert wird
   THEN wird KEIN ParameterPanel gerendert (graceful degradation) und der Generate-Button bleibt funktional

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/popovers/variation-popover.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('VariationPopover – ParameterPanel Mount', () => {
  // AC-1: ParameterPanel sichtbar mit Primary-Controls
  it.todo('should render ParameterPanel with primary controls between tier section and generate button')

  // AC-3: imageParams im onGenerate Callback enthalten
  it.todo('should include imageParams in onGenerate callback when user selects parameter values')

  // AC-5: Skeleton waehrend Schema-Loading
  it.todo('should render skeleton placeholders while schema is loading')

  // AC-6: imageParams Reset bei Tier-Wechsel
  it.todo('should reset imageParams when tier changes')

  // AC-9: Kein ParameterPanel bei Schema-Error
  it.todo('should not render ParameterPanel when schema fetch returns error')
})
```
</test_spec>

### Test-Datei: `components/canvas/popovers/img2img-popover.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Img2imgPopover – ParameterPanel Mount', () => {
  // AC-2: ParameterPanel sichtbar mit Primary-Controls
  it.todo('should render ParameterPanel with primary controls between tier section and generate button')

  // AC-4: imageParams im onGenerate Callback enthalten
  it.todo('should include imageParams in onGenerate callback when user selects parameter values')

  // AC-5: Skeleton waehrend Schema-Loading
  it.todo('should render skeleton placeholders while schema is loading')

  // AC-9: Kein ParameterPanel bei Schema-Error
  it.todo('should not render ParameterPanel when schema fetch returns error')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01 | `resolveModel` | Function | Import aus `@/lib/utils/resolve-model` — liefert `modelId` aus `modelSettings + mode + tier` |
| slice-02 | `useModelSchema` | Hook | Import aus `@/lib/hooks/use-model-schema` — liefert `{ schema, isLoading, error }` |
| slice-03 | `ParameterPanel` (erweitert) | Component | Import aus `@/components/workspace/parameter-panel` — nimmt `primaryFields`, `schema`, `isLoading`, `values`, `onChange` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `VariationParams.imageParams` | Interface-Feld | canvas-detail-view.tsx (Handler) | `imageParams?: Record<string, unknown>` |
| `Img2imgParams.imageParams` | Interface-Feld | canvas-detail-view.tsx (Handler) | `imageParams?: Record<string, unknown>` |
| Merged `params` in `handleVariationGenerate` | Data flow | -- (End-to-End) | `params: { prompt_strength, ...imageParams }` |
| Merged `params` in `handleImg2imgGenerate` | Data flow | -- (End-to-End) | `params: { ...imageParams }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/variation-popover.tsx` — MODIFY: `modelSettings` Prop hinzufuegen, `useModelSchema` Hook einbinden, lokaler `imageParams` State, `ParameterPanel` zwischen TierToggle und Generate-Button rendern, `imageParams` zu `VariationParams` Interface und `onGenerate` Callback hinzufuegen, Reset bei Tier-Wechsel
- [ ] `components/canvas/popovers/img2img-popover.tsx` — MODIFY: `modelSettings` Prop hinzufuegen, `useModelSchema` Hook einbinden, lokaler `imageParams` State, `ParameterPanel` zwischen Tier-Section und Generate-Button rendern, `imageParams` zu `Img2imgParams` Interface und `onGenerate` Callback hinzufuegen, Reset bei Tier-Wechsel
- [ ] `components/canvas/canvas-detail-view.tsx` — MODIFY: `modelSettings` als Prop an VariationPopover und Img2imgPopover durchreichen, in `handleVariationGenerate` und `handleImg2imgGenerate` `imageParams` aus Params in `params`-Objekt spreaden
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice aendert NUR die Canvas Popovers und den canvas-detail-view — KEIN prompt-area.tsx
- Keine Aenderungen an `parameter-panel.tsx`, `use-model-schema.ts` oder `resolve-model.ts`
- Keine neuen Server Actions oder API-Aenderungen
- Keine Persistenz der imageParams ueber Popover-Sessions (Reset bei Popover-Close ist akzeptabel)

**Technische Constraints:**
- Popovers erhalten `modelSettings: ModelSetting[]` als neue Prop von `canvas-detail-view.tsx`
- Model-Resolution in Popovers: `resolveModel(modelSettings, "img2img", effectiveTier)` — beide Popovers nutzen `img2img` als Mode (Variation ist technisch img2img)
- `imageParams` initialisieren mit `{}`, Reset bei Tier/Model-Aenderung auf `{}`
- `primaryFields` Prop an ParameterPanel: `["aspect_ratio", "megapixels", "resolution"]`
- `VariationParams.imageParams` und `Img2imgParams.imageParams` sind optional (`?`) fuer Abwaertskompatibilitaet
- In `handleVariationGenerate`: `params: { prompt_strength: promptStrength, ...params.imageParams }` — imageParams neben bestehendem `prompt_strength`
- In `handleImg2imgGenerate`: `params: { ...params.imageParams }` — ersetzt das bisherige leere `params: {}`

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Migration Map > Existing Files Changed" (variation-popover.tsx, img2img-popover.tsx, canvas-detail-view.tsx)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Architecture Layers" (Integration Points)
- Discovery: `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md` → Section "Business Rules > Canvas Popover imageParams Flow"
- Wireframes: `specs/phase-7/2026-03-15-aspect-ratio-controls/wireframes.md` → Section "Screen: Variation Popover" und "Screen: Img2img Popover"

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/popovers/variation-popover.tsx` | Erweitern: Props + Hook + State + JSX |
| `components/canvas/popovers/img2img-popover.tsx` | Erweitern: Props + Hook + State + JSX |
| `components/canvas/canvas-detail-view.tsx` | Erweitern: Props an Popovers durchreichen, Handlers anpassen |
| `lib/utils/resolve-model.ts` | Import `resolveModel` — bereits vorhanden seit Slice 1 |
| `lib/hooks/use-model-schema.ts` | Import `useModelSchema` — bereits vorhanden seit Slice 2 |
| `components/workspace/parameter-panel.tsx` | Import `ParameterPanel` — bereits erweitert in Slice 3 |
