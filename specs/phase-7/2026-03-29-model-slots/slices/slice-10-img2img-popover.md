# Slice 10: Img2img Popover -- TierToggle durch ModelSlots ersetzen

> **Slice 10 von 16** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-img2img-popover` |
| **Test** | `pnpm test components/canvas/popovers/img2img-popover` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-model-slots-ui-stacked"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/popovers/img2img-popover` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions, useModelSchema, getModelSlots via Vitest mocks) |

---

## Ziel

`img2img-popover.tsx` umbauen: TierToggle durch `ModelSlots` (stacked) ersetzen, wenn die neuen Props (`modelSlots?`, `models?`) uebergeben werden -- andernfalls Legacy-Pfad (TierToggle) beibehalten. `Img2imgParams` um `modelIds: string[]` erweitern und `tier?: Tier` als optionales deprecated Feld beibehalten. Strength-Slider und Variants-Stepper bleiben als Popover-Level-Parameter oberhalb der Slots. Per-Slot Parameter werden inline via ModelSlots gerendert (bisheriges separates ParameterPanel entfaellt im neuen Pfad).

---

## Acceptance Criteria

1) GIVEN der Img2img Popover wird geoeffnet (activeToolId === "img2img") und `modelSlots` + `models` Props sind uebergeben
   WHEN die Komponente rendert
   THEN ist kein `TierToggle` sichtbar
   AND stattdessen wird eine `ModelSlots`-Komponente mit `variant="stacked"` und `mode="img2img"` gerendert

2) GIVEN der Img2img Popover zeigt ModelSlots mit Slot 1 (active, "flux-schnell") und Slot 2 (inactive, "flux-pro")
   WHEN der User auf "Generate" klickt
   THEN wird `onGenerate` mit `modelIds: ["black-forest-labs/flux-schnell"]` aufgerufen (nur aktive Slots)
   AND `tier` ist NICHT im Params-Objekt gesetzt (bleibt `undefined`)

3) GIVEN der Img2img Popover zeigt ModelSlots mit Slot 1 und Slot 2 beide active
   WHEN der User auf "Generate" klickt
   THEN wird `onGenerate` mit `modelIds` aufgerufen, das beide aktiven Model-IDs enthaelt

4) GIVEN das `Img2imgParams` Interface
   WHEN es importiert wird
   THEN enthaelt es `modelIds: string[]` als neues Pflichtfeld
   AND `tier?: Tier` bleibt als optionales Feld mit `@deprecated` JSDoc erhalten
   AND alle anderen Felder (references, motiv, style, variants, imageParams) bleiben unveraendert

5) GIVEN der Img2img Popover zeigt ModelSlots
   WHEN Slot 1 aktiv ist mit einem zugewiesenen Model
   THEN wird unterhalb von Slot 1 ein Per-Slot ParameterPanel angezeigt (via ModelSlots stacked-Layout)
   AND das bisherige separate `<ParameterPanel>` Section wird im neuen Pfad NICHT mehr gerendert

6) GIVEN der Img2img Popover wird geoeffnet
   WHEN der Popover rendert
   THEN zeigt der Variants-Stepper ([ - ] N [ + ]) weiterhin korrekt an
   AND Variants-Aenderung aktualisiert den lokalen State
   AND der Stepper liegt OBERHALB der ModelSlots-Komponente

7) GIVEN die `Img2imgPopoverProps`
   WHEN die Props definiert werden
   THEN akzeptiert die Komponente `modelSlots?` (vom Typ `ModelSlot[]`, optional) und `models?` (vom Typ `Model[]`, optional) als neue optionale Props
   AND `modelSettings?` bleibt als optionales Feld mit `@deprecated` JSDoc erhalten

8) GIVEN der Img2img Popover ist geoeffnet und `state.isGenerating === true`
   WHEN die Komponente rendert
   THEN wird `disabled={true}` an die ModelSlots-Komponente uebergeben
   AND alle Slot-Checkboxen und Dropdowns sind deaktiviert

9) GIVEN der Img2img Popover wird geoeffnet OHNE `modelSlots` und `models` Props (Legacy-Consumer)
   WHEN die Komponente rendert
   THEN faellt die Komponente auf den Legacy-Pfad zurueck: TierToggle wird gerendert und das separate ParameterPanel wird angezeigt
   AND `onGenerate` wird mit `tier` statt `modelIds` aufgerufen

10) GIVEN der Img2img Popover im neuen Pfad
    WHEN die Komponente rendert
    THEN bleiben References-Section (ReferenceBar), Prompt-Section (Motiv + Style Textareas) und Generate-Button unveraendert
    AND nur die Tier/Parameter-Section wird durch ModelSlots ersetzt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/popovers/__tests__/img2img-popover-slots.test.tsx`

<test_spec>
```typescript
// AC-1: ModelSlots statt TierToggle gerendert
it.todo('should render ModelSlots with variant="stacked" and mode="img2img" instead of TierToggle')

// AC-2: Generate sendet nur aktive Slot-ModelIds
it.todo('should call onGenerate with modelIds from active slots only')

// AC-3: Generate sendet mehrere aktive ModelIds
it.todo('should call onGenerate with multiple modelIds when multiple slots are active')

// AC-4: Img2imgParams enthaelt modelIds und behaelt tier als optionales deprecated Feld
it.todo('should include modelIds in Img2imgParams and keep tier as optional deprecated field')

// AC-5: Per-Slot ParameterPanel via ModelSlots stacked, separates ParameterPanel entfaellt
it.todo('should show per-slot ParameterPanel via ModelSlots and remove separate ParameterPanel section')

// AC-6: Variants-Stepper funktioniert weiterhin oberhalb der ModelSlots
it.todo('should render variants stepper above ModelSlots and update variants state')

// AC-7: Props akzeptieren modelSlots und models neben optionalem deprecated modelSettings
it.todo('should accept modelSlots and models props alongside optional deprecated modelSettings')

// AC-8: Disabled-State waehrend Generierung
it.todo('should pass disabled=true to ModelSlots when isGenerating is true')

// AC-9: Legacy-Fallback wenn modelSlots/models nicht uebergeben werden
it.todo('should fall back to TierToggle and separate ParameterPanel when modelSlots and models props are not provided')

// AC-10: Unveraenderte Sections (References, Prompt, Generate)
it.todo('should keep references section, prompt section, and generate button unchanged')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06` | `ModelSlots` | React Component | Import kompiliert; rendert mit `variant="stacked"` |
| `slice-06` | `ModelSlotsProps` | TypeScript Interface | Import kompiliert |
| `slice-03` | `resolveActiveSlots(slots, mode)` | Utility Function | Import kompiliert; gibt `{modelId, modelParams}[]` zurueck |
| `slice-02` | `ModelSlot` | Inferred DB Type | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Img2imgParams` (updated) | TypeScript Interface | `slice-12` (canvas-detail-view) | `{ references, motiv, style, variants, modelIds: string[], tier?: Tier, imageParams? }` -- `tier` ist `@deprecated`, wird in slice-12 entfernt |
| `Img2imgPopoverProps` (updated) | TypeScript Interface | `slice-12` (canvas-detail-view) | `{ onGenerate, modelSlots?, models?, modelSettings? }` -- `modelSlots`/`models` optional bis slice-12; `modelSettings` ist `@deprecated` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/img2img-popover.tsx` -- MODIFY: TierToggle durch ModelSlots (stacked) ersetzen wenn `modelSlots`/`models` vorhanden, sonst Legacy-Pfad beibehalten; `Img2imgParams` um `modelIds: string[]` erweitern (`tier?` bleibt deprecated); `Img2imgPopoverProps` um optionale `modelSlots?` + `models?` erweitern (`modelSettings?` bleibt deprecated); separates ParameterPanel entfernen im neuen Pfad (ModelSlots rendert per-Slot inline); `resolveModel` durch `resolveActiveSlots` ersetzen im neuen Pfad; Generate-Handler sammelt aktive Slot-ModelIds (neuer Pfad) oder nutzt `tier` (Legacy-Pfad); Variants-Stepper und References bleiben unveraendert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `canvas-detail-view.tsx` -- der Consumer-Umbau kommt in slice-12
- KEINE Aenderungen an `model-slots.tsx` -- wird nur importiert
- KEINE Aenderungen an `lib/types.ts`, `lib/db/queries.ts`, Server Actions
- KEIN Entfernen von `tier-toggle.tsx` -- kommt in slice-15 (Cleanup)
- KEINE Aenderungen an References-Section, Prompt-Section oder Generate-Button (bleiben unveraendert)
- KEINE Aenderungen am Variants-Stepper (bleibt als [ - ] N [ + ] mit VARIANTS_MIN=1, VARIANTS_MAX=4)

**Technische Constraints:**
- `"use client"` Direktive bleibt
- `ModelSlots` mit `variant="stacked"`, `mode="img2img"`, `disabled={state.isGenerating}` rendern
- ModelSlots uebernimmt das ParameterPanel-Rendering pro Slot im neuen Pfad -- das bisherige separate `<ParameterPanel>` und `useModelSchema`-Aufruf entfallen im neuen Pfad (bleiben fuer Legacy-Pfad)
- `resolveActiveSlots(slots, "img2img")` fuer Generate-Handler im neuen Pfad nutzen
- `Img2imgParams` erhaelt `modelIds: string[]` als Pflichtfeld; `tier?: Tier` bleibt als `@deprecated` optional (canvas-detail-view.tsx nutzt es noch bis slice-12)
- `Img2imgPopoverProps` erhaelt `modelSlots?: ModelSlot[]` + `models?: Model[]` als optionale Props. `modelSettings?` bleibt `@deprecated`. Wenn `modelSlots`/`models` nicht uebergeben: Legacy-Pfad (TierToggle + modelSettings + resolveModel + separates ParameterPanel)
- Layout-Reihenfolge im neuen Pfad: References -> Prompt -> Variants-Stepper -> ModelSlots (stacked mit inline Per-Slot Params) -> Generate
- `TierToggle`, `resolveModel`, `useModelSchema`, `ParameterPanel` bleiben importiert fuer den Legacy-Pfad. Alle Legacy-Imports werden in slice-12/slice-15 aufgeraeumt

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/model-slots.tsx` | Import: `ModelSlots` Komponente, unveraendert |
| `lib/utils/resolve-model.ts` | Import: `resolveActiveSlots()` (neuer Pfad), `resolveModel()` bleibt fuer Legacy-Pfad |
| `components/canvas/popovers/img2img-popover.tsx` | Modify: bestehende Datei wird umgebaut |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> `img2img-popover.tsx` Zeile
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Img2img Popover (Canvas)"
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Regeln" (Img2img Strength, Variant-Count UI: Stepper)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Per-Slot Parameter" (stacked Layout mit inline ParameterPanel)
