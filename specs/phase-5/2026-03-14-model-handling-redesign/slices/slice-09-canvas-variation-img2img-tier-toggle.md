# Slice 9: Canvas Variation + Img2Img Popover Tier Toggle

> **Slice 9 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-canvas-variation-img2img-tier-toggle` |
| **Test** | `pnpm test components/canvas/popovers/variation-popover components/canvas/popovers/img2img-popover components/canvas/canvas-detail-view` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-canvas-context-cleanup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/popovers/variation-popover components/canvas/popovers/img2img-popover` |
| **Integration Command** | `pnpm test components/canvas` |
| **Acceptance Command** | `pnpm test components/canvas/popovers/variation-popover components/canvas/popovers/img2img-popover components/canvas/canvas-detail-view` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (getModelSettings Server Action gemockt, TierToggle/MaxQualityToggle als echte Komponenten) |

---

## Ziel

`TierToggle` und `MaxQualityToggle` in Variation-Popover und Img2Img-Popover einbauen. Jedes Popover verwaltet eigenen Tier-State (unabhaengig voneinander). Der gewaehlte Tier wird via erweitertes `VariationParams`/`Img2imgParams` Interface (+ `tier: Tier`) an den Parent (`canvas-detail-view.tsx`) propagiert, der das Model aus den gecachten Settings resolved.

---

## Acceptance Criteria

1) GIVEN das Variation-Popover wird geoeffnet
   WHEN es gerendert wird
   THEN zeigt es einen `TierToggle` (Draft | Quality) oberhalb des Generate-Buttons, Default-Segment ist "Draft"

2) GIVEN das Variation-Popover mit `tier="quality"` ausgewaehlt
   WHEN es gerendert wird
   THEN erscheint ein `MaxQualityToggle` zwischen TierToggle und Generate-Button (Default: off)

3) GIVEN das Variation-Popover mit `tier="draft"` ausgewaehlt
   WHEN es gerendert wird
   THEN ist der `MaxQualityToggle` NICHT sichtbar

4) GIVEN das Img2Img-Popover wird geoeffnet
   WHEN es gerendert wird
   THEN zeigt es einen `TierToggle` (Draft | Quality) oberhalb des Generate-Buttons, Default-Segment ist "Draft"

5) GIVEN das Img2Img-Popover mit `tier="quality"` ausgewaehlt
   WHEN es gerendert wird
   THEN erscheint ein `MaxQualityToggle` zwischen TierToggle und Generate-Button (Default: off)

6) GIVEN `VariationParams` Interface
   WHEN inspiziert
   THEN enthaelt es ein Feld `tier` vom Typ `Tier` (`"draft" | "quality" | "max"`)

7) GIVEN `Img2imgParams` Interface
   WHEN inspiziert
   THEN enthaelt es ein Feld `tier` vom Typ `Tier` (`"draft" | "quality" | "max"`)

8) GIVEN Variation-Popover mit `tier="draft"` und User klickt Generate
   WHEN `onGenerate` aufgerufen wird
   THEN enthaelt `VariationParams.tier` den Wert `"draft"`

9) GIVEN Variation-Popover mit `tier="quality"` und MaxQuality=off, User klickt Generate
   WHEN `onGenerate` aufgerufen wird
   THEN enthaelt `VariationParams.tier` den Wert `"quality"`

10) GIVEN Variation-Popover mit `tier="quality"` und MaxQuality=on, User klickt Generate
    WHEN `onGenerate` aufgerufen wird
    THEN enthaelt `VariationParams.tier` den Wert `"max"`

11) GIVEN `handleVariationGenerate` in canvas-detail-view mit `modelSettings` geladen und einem img2img/quality Eintrag `{ modelId: "black-forest-labs/flux-2-pro", modelParams: { "prompt_strength": 0.6 } }`
    WHEN mit `params.tier = "quality"` aufgerufen
    THEN wird `generateImages` mit `modelIds: ["black-forest-labs/flux-2-pro"]` aufgerufen

12) GIVEN `handleImg2imgGenerate` in canvas-detail-view mit `modelSettings` geladen und einem img2img/max Eintrag `{ modelId: "black-forest-labs/flux-2-max", modelParams: { "prompt_strength": 0.6 } }`
    WHEN mit `params.tier = "max"` aufgerufen
    THEN wird `generateImages` mit `modelIds: ["black-forest-labs/flux-2-max"]` aufgerufen

13) GIVEN Variation-Popover und Img2Img-Popover jeweils geoeffnet
    WHEN User in Variation-Popover auf "Quality" wechselt
    THEN bleibt der Tier-State im Img2Img-Popover auf "Draft" (unabhaengig)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/popovers/__tests__/variation-popover-tier.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('VariationPopover TierToggle', () => {
  // AC-1: TierToggle sichtbar mit Draft Default
  it.todo('should render TierToggle with Draft as default active segment')

  // AC-2: MaxQualityToggle bei Quality sichtbar
  it.todo('should show MaxQualityToggle when tier is quality')

  // AC-3: MaxQualityToggle bei Draft versteckt
  it.todo('should hide MaxQualityToggle when tier is draft')

  // AC-8: onGenerate mit tier=draft
  it.todo('should call onGenerate with tier draft when Generate clicked in draft mode')

  // AC-9: onGenerate mit tier=quality
  it.todo('should call onGenerate with tier quality when Generate clicked in quality mode')

  // AC-10: onGenerate mit tier=max bei MaxQuality on
  it.todo('should call onGenerate with tier max when Generate clicked with MaxQuality on')
})

describe('VariationParams interface', () => {
  // AC-6: tier Feld vorhanden
  it.todo('should include tier field in VariationParams')
})
```
</test_spec>

### Test-Datei: `components/canvas/popovers/__tests__/img2img-popover-tier.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Img2imgPopover TierToggle', () => {
  // AC-4: TierToggle sichtbar mit Draft Default
  it.todo('should render TierToggle with Draft as default active segment')

  // AC-5: MaxQualityToggle bei Quality sichtbar
  it.todo('should show MaxQualityToggle when tier is quality')

  // AC-13: Unabhaengiger Tier-State
  it.todo('should maintain independent tier state from other popovers')
})

describe('Img2imgParams interface', () => {
  // AC-7: tier Feld vorhanden
  it.todo('should include tier field in Img2imgParams')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-tier-resolution.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('handleVariationGenerate with tier parameter', () => {
  // AC-11: Quality-Tier resolved korrektes Model aus Settings
  it.todo('should resolve img2img/quality model from settings when tier is quality')
})

describe('handleImg2imgGenerate with tier parameter', () => {
  // AC-12: Max-Tier resolved korrektes Model aus Settings
  it.todo('should resolve img2img/max model from settings when tier is max')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05` | `TierToggle` | React Component | `<TierToggle tier={Tier} onTierChange={(t: Tier) => void} disabled? className? />` |
| `slice-05` | `MaxQualityToggle` | React Component | `<MaxQualityToggle maxQuality={boolean} onMaxQualityChange={(v: boolean) => void} disabled? />` |
| `slice-03` | `Tier` | Type | `"draft" \| "quality" \| "max"` |
| `slice-08` | `modelSettings` State | `ModelSetting[]` in canvas-detail-view | Lokaler State, fetch on mount |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Erweitertes `VariationParams` | Interface | canvas-detail-view Handler | `{ prompt, strength, count, tier: Tier }` |
| Erweitertes `Img2imgParams` | Interface | canvas-detail-view Handler | `{ references, motiv, style, variants, tier: Tier }` |
| Tier-aware Handler-Pattern | Lookup-Pattern | slice-10, slice-11 | `settings.find(s => s.mode === "img2img" && s.tier === params.tier)` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/variation-popover.tsx` -- Bestehend: TierToggle + MaxQualityToggle einbauen, lokaler tier/maxQuality State, `VariationParams` um `tier: Tier` erweitern
- [ ] `components/canvas/popovers/img2img-popover.tsx` -- Bestehend: TierToggle + MaxQualityToggle einbauen, lokaler tier/maxQuality State, `Img2imgParams` um `tier: Tier` erweitern
- [ ] `components/canvas/canvas-detail-view.tsx` -- Bestehend: `handleVariationGenerate` und `handleImg2imgGenerate` erweitern um `params.tier` fuer Model-Resolution aus Settings
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Upscale-Popover Tier-Toggle (kommt in Slice 10)
- KEIN Canvas Chat Panel Tier-Toggle (kommt in Slice 11)
- KEINE Aenderung an `CanvasModelSelector` (kommt in Slice 12)
- KEINE Aenderung an `modelSettings` Fetch-Logik (erledigt in Slice 8)
- KEINE Aenderung an Server Actions oder Generation Service

**Technische Constraints:**
- Client Components (`"use client"`)
- Tier-State per Popover via `useState<Tier>("draft")` + `useState<boolean>(false)` fuer maxQuality
- Tier-Resolution Logik: `tier === "quality" && maxQuality ? "max" : tier` vor Uebergabe an `onGenerate`
- TierToggle/MaxQualityToggle Platzierung: oberhalb des Generate-Buttons, unterhalb der existierenden Controls (Prompt, Strength, Count bzw. References, Prompt, Variants)
- TierToggle `disabled` waehrend `state.isGenerating`

**Referenzen:**
- Popover-Layout: `wireframes.md` -> Section "Screen: Canvas Tool Popovers" (Variation Popover Draft/Quality Wireframes)
- State-Varianten: `wireframes.md` -> "State Variations (all popovers)" Tabelle
- Handler-Aenderungen: `architecture.md` -> Section "Migration Map" -> `canvas-detail-view.tsx`
- Params-Interface-Erweiterung: `architecture.md` -> Section "Migration Map" -> `variation-popover.tsx` + `img2img-popover.tsx`
