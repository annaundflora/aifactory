# Slice 10: Canvas Upscale Popover Tier Toggle

> **Slice 10 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-canvas-upscale-tier-toggle` |
| **Test** | `pnpm test components/canvas/popovers/upscale-popover components/canvas/canvas-detail-view` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-canvas-context-cleanup", "slice-07-workspace-generation-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/popovers/upscale-popover components/canvas/canvas-detail-view` |
| **Integration Command** | `pnpm test components/canvas` |
| **Acceptance Command** | `pnpm test components/canvas/popovers/upscale-popover components/canvas/canvas-detail-view` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (upscaleImage Server Action gemockt, getModelSettings gemockt) |

---

## Ziel

TierToggle (Draft | Quality, kein Max) in das Upscale-Popover einbauen. Die ausgewaehlte Tier wird an den Parent propagiert, der das Upscale-Model + modelParams aus den gecachten Settings resolved und an `upscaleImage()` uebergibt. Draft nutzt Real-ESRGAN, Quality nutzt Crystal-Upscaler.

---

## Acceptance Criteria

1) GIVEN das Upscale-Popover ist geoeffnet
   WHEN es gerendert wird
   THEN zeigt es einen `TierToggle` mit zwei Segmenten "Draft" (aktiv) und "Quality" oberhalb der Scale-Buttons

2) GIVEN das Upscale-Popover ist geoeffnet
   WHEN der User auf "Quality" im TierToggle klickt
   THEN wechselt das aktive Segment zu "Quality" und es erscheint KEIN MaxQualityToggle (Upscale hat kein Max-Tier)

3) GIVEN das Upscale-Popover ist geoeffnet mit `tier="draft"`
   WHEN der User auf "2x Upscale" klickt
   THEN wird `onUpscale` mit `{ scale: 2, tier: "draft" }` aufgerufen

4) GIVEN das Upscale-Popover ist geoeffnet mit `tier="quality"`
   WHEN der User auf "4x Upscale" klickt
   THEN wird `onUpscale` mit `{ scale: 4, tier: "quality" }` aufgerufen

5) GIVEN `onUpscale` Callback in `upscale-popover.tsx`
   WHEN die Props-Definition inspiziert wird
   THEN erwartet `onUpscale` den Typ `(params: { scale: 2 | 4; tier: Tier }) => void`

6) GIVEN `modelSettings` in `canvas-detail-view.tsx` enthaelt `{ mode: "upscale", tier: "draft", modelId: "nightmareai/real-esrgan", modelParams: { "scale": 2 } }`
   WHEN `handleUpscale` mit `tier: "draft"` aufgerufen wird
   THEN wird `upscaleImage` mit `modelId: "nightmareai/real-esrgan"` und `modelParams` aus den Settings aufgerufen

7) GIVEN `modelSettings` in `canvas-detail-view.tsx` enthaelt `{ mode: "upscale", tier: "quality", modelId: "philz1337x/crystal-upscaler", modelParams: { "scale": 4 } }`
   WHEN `handleUpscale` mit `tier: "quality"` aufgerufen wird
   THEN wird `upscaleImage` mit `modelId: "philz1337x/crystal-upscaler"` und `modelParams` aus den Settings aufgerufen

8) GIVEN das Upscale-Popover wird geschlossen und erneut geoeffnet
   WHEN der User den Tier-Toggle betrachtet
   THEN steht der Toggle wieder auf "Draft" (Tier-State ist nicht persistiert, Default ist Draft)

9) GIVEN `modelSettings` sind leer oder nicht geladen
   WHEN `handleUpscale` mit einem Tier aufgerufen wird
   THEN wird der Fallback-Mechanismus aus Slice 8 verwendet (`currentGeneration.modelId`) -- kein Crash

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/popovers/__tests__/upscale-popover-tier.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('UpscalePopover - TierToggle Integration', () => {
  // AC-1: TierToggle wird angezeigt mit Draft als Default
  it.todo('should render TierToggle with Draft active above scale buttons')

  // AC-2: Quality-Wechsel ohne MaxQualityToggle
  it.todo('should switch to Quality tier and not render MaxQualityToggle')

  // AC-3: Draft-Tier wird mit Scale an onUpscale propagiert
  it.todo('should call onUpscale with scale 2 and tier draft')

  // AC-4: Quality-Tier wird mit Scale an onUpscale propagiert
  it.todo('should call onUpscale with scale 4 and tier quality')

  // AC-5: Props-Typ UpscalePopoverProps hat tier in onUpscale
  it.todo('should accept onUpscale callback with tier parameter in params')

  // AC-8: Tier-State wird nicht persistiert
  it.todo('should reset tier to draft when popover is reopened')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-upscale-tier.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView - handleUpscale with Tier', () => {
  // AC-6: Draft-Tier resolved Real-ESRGAN Model
  it.todo('should call upscaleImage with real-esrgan modelId for draft tier')

  // AC-7: Quality-Tier resolved Crystal-Upscaler Model
  it.todo('should call upscaleImage with crystal-upscaler modelId for quality tier')

  // AC-9: Fallback bei fehlenden Settings
  it.todo('should fall back to currentGeneration.modelId when modelSettings are empty')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05` | `TierToggle` | React Component | `<TierToggle tier={Tier} onTierChange={(t: Tier) => void} />` |
| `slice-03` | `Tier` | Type | `"draft" \| "quality" \| "max"` |
| `slice-08` | `modelSettings` State | `ModelSetting[]` in canvas-detail-view | Lokaler State, via `getModelSettings()` gefetcht |
| `slice-08` | Model-Resolution Pattern | Lookup-Pattern | `settings.find(s => s.mode === "upscale" && s.tier === tier)` |
| `slice-07` | `upscaleImage` (erweitert) | Server Action | `(input: { ..., modelId: string, modelParams: Record<string, unknown> }) => Promise<...>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `UpscalePopoverProps.onUpscale` (erweitert) | Callback Signatur | `canvas-detail-view.tsx` | `(params: { scale: 2 \| 4; tier: Tier }) => void` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/upscale-popover.tsx` -- Bestehend: TierToggle einbauen, Tier-State als lokaler useState, onUpscale-Params um `tier` erweitern
- [ ] `components/canvas/canvas-detail-view.tsx` -- Bestehend: handleUpscale um Tier-Parameter erweitern, Model aus Settings + Tier resolven, modelId + modelParams an upscaleImage uebergeben
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN MaxQualityToggle (Upscale hat kein Max-Tier -- siehe architecture.md -> Validation Rules)
- KEINE Aenderung an der `upscaleImage` Server Action Signatur (erledigt in Slice 7)
- KEINE Aenderung an `TierToggle`-Komponente selbst (erledigt in Slice 5)
- KEINE Aenderung am Canvas Context (erledigt in Slice 8)
- KEINE Aenderung an Variation- oder Img2Img-Popovers (erledigt in Slice 9)

**Technische Constraints:**
- Client Component (`"use client"`) -- bestehendes Pattern
- `tier` State als lokaler `useState<Tier>("draft")` im Popover
- Tier-State wird NICHT persistiert, Default ist immer "draft"
- TierToggle wird oberhalb der Scale-Buttons gerendert (siehe wireframes.md -> "Screen: Canvas Tool Popovers" -> Upscale Wireframe)
- `handleUpscale` in `canvas-detail-view.tsx` nutzt bestehenden `modelSettings` State aus Slice 8: `modelSettings.find(s => s.mode === "upscale" && s.tier === tier)`

**Referenzen:**
- Upscale Popover Layout: `wireframes.md` -> Section "Screen: Canvas Tool Popovers" -> "Wireframe -- Upscale Popover (with Tier Toggle)"
- Upscale-Models: `architecture.md` -> Section "Seed Data" (upscale/draft = Real-ESRGAN, upscale/quality = Crystal-Upscaler)
- UpscaleImageInput DTO: `architecture.md` -> Section "Data Transfer Objects"
- Migration Map: `architecture.md` -> Section "Migration Map" -> `upscale-popover.tsx` und `canvas-detail-view.tsx`
