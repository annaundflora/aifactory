# Slice 11: Upscale Popover -- TierToggle durch ModelSlots ersetzen

> **Slice 11 von 16** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-upscale-popover` |
| **Test** | `pnpm test components/canvas/popovers/upscale-popover` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-model-slots-ui-stacked"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/popovers/upscale-popover` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions, getModelSlots via Vitest mocks) |

---

## Ziel

`upscale-popover.tsx` umbauen: TierToggle (inkl. `hiddenValues={["max"]}` Workaround) durch `ModelSlots` (stacked, ohne ParameterPanel) ersetzen, wenn die neuen Props (`modelSlots?`, `models?`) uebergeben werden -- andernfalls Legacy-Pfad (TierToggle) beibehalten. Scale-Buttons (2x/4x) bleiben als direkte Action-Trigger. `UpscalePopoverProps` um optionale `modelSlots?` + `models?` erweitern; `onUpscale` Signatur um `modelIds: string[]` erweitern; `tier?: Tier` bleibt als optionales deprecated Feld (Rueckwaertskompatibilitaet fuer `canvas-detail-view.tsx` bis slice-12).

---

## Acceptance Criteria

1) GIVEN der Upscale Popover wird geoeffnet (`activeToolId === "upscale"`) und `modelSlots` + `models` Props sind uebergeben
   WHEN die Komponente rendert
   THEN ist kein `TierToggle` sichtbar
   AND stattdessen wird eine `ModelSlots`-Komponente mit `variant="stacked"` und `mode="upscale"` gerendert
   AND es werden KEINE Per-Slot ParameterPanels angezeigt (Discovery-Ausnahme: Upscale nutzt direkte Action-Buttons)

2) GIVEN der Upscale Popover zeigt ModelSlots mit Slot 1 (active, "philz1337x/crystal-upscaler") und Slot 2 (inactive)
   WHEN der User auf "2x Upscale" klickt
   THEN wird `onUpscale` mit `{ scale: 2, modelIds: ["philz1337x/crystal-upscaler"] }` aufgerufen (nur aktive Slots)
   AND der Popover schliesst sich nach der Aktion

3) GIVEN der Upscale Popover zeigt ModelSlots mit Slot 1 und Slot 2 beide active
   WHEN der User auf "4x Upscale" klickt
   THEN wird `onUpscale` mit `{ scale: 4, modelIds: [...] }` aufgerufen, das beide aktiven Model-IDs enthaelt

4) GIVEN die `UpscalePopoverProps`
   WHEN die Props definiert werden
   THEN akzeptiert die Komponente `modelSlots?` (Typ `ModelSlot[]`, optional) und `models?` (Typ `Model[]`, optional) als neue Props
   AND `onUpscale` akzeptiert `{ scale: 2 | 4, modelIds: string[], tier?: Tier }` -- `tier` ist `@deprecated`

5) GIVEN der Upscale Popover wird geoeffnet OHNE `modelSlots` und `models` Props (Legacy-Consumer)
   WHEN die Komponente rendert
   THEN faellt die Komponente auf den Legacy-Pfad zurueck: TierToggle wird mit `hiddenValues={["max"]}` gerendert
   AND `onUpscale` wird mit `{ scale, tier }` statt `modelIds` aufgerufen

6) GIVEN der Upscale Popover ist geoeffnet und `state.isGenerating === true`
   WHEN die Komponente rendert
   THEN wird `disabled={true}` an die ModelSlots-Komponente uebergeben
   AND beide Scale-Buttons sind ebenfalls disabled

7) GIVEN der User oeffnet den Upscale Popover, aendert Slots, und schliesst ihn
   WHEN der Popover erneut geoeffnet wird
   THEN werden die aktuellen Slot-Daten aus den Props verwendet (kein lokaler Slot-Cache)
   AND der lokale `tier`-State (Legacy) wird auf "draft" zurueckgesetzt (bestehendes Verhalten)

8) GIVEN `isUpscaleDisabled === true`
   WHEN die Komponente rendert
   THEN wird weiterhin der Disabled-State mit Tooltip gerendert (unveraendert gegenueber aktuellem Verhalten)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/popovers/__tests__/upscale-popover-slots.test.tsx`

<test_spec>
```typescript
// AC-1: ModelSlots statt TierToggle gerendert (ohne ParameterPanel)
it.todo('should render ModelSlots with variant="stacked" and mode="upscale" without ParameterPanels instead of TierToggle')

// AC-2: 2x Upscale sendet aktive Slot-ModelIds
it.todo('should call onUpscale with scale 2 and modelIds from active slots only')

// AC-3: 4x Upscale sendet mehrere aktive ModelIds
it.todo('should call onUpscale with scale 4 and multiple modelIds when multiple slots are active')

// AC-4: Props akzeptieren modelSlots und models mit erweiterter onUpscale Signatur
it.todo('should accept modelSlots and models props with onUpscale receiving modelIds and optional deprecated tier')

// AC-5: Legacy-Fallback wenn modelSlots/models nicht uebergeben werden
it.todo('should fall back to TierToggle with hiddenValues=["max"] when modelSlots and models props are not provided')

// AC-6: Disabled-State waehrend Generierung
it.todo('should pass disabled=true to ModelSlots and disable scale buttons when isGenerating is true')

// AC-7: Kein lokaler Slot-Cache beim Wiederoeffnen
it.todo('should use current slot data from props when popover reopens')

// AC-8: isUpscaleDisabled zeigt Tooltip-State
it.todo('should render disabled state with tooltip when isUpscaleDisabled is true')
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
| `UpscalePopoverProps` (updated) | TypeScript Interface | `slice-12` (canvas-detail-view) | `{ onUpscale, isUpscaleDisabled, modelSlots?, models? }` -- `modelSlots` und `models` optional bis slice-12 (dann Pflicht) |
| `onUpscale` callback (updated) | Function Signature | `slice-12` (canvas-detail-view) | `(params: { scale: 2 \| 4, modelIds: string[], tier?: Tier }) => void` -- `tier` ist `@deprecated`, wird in slice-12 entfernt |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/upscale-popover.tsx` -- MODIFY: TierToggle durch ModelSlots (stacked, ohne ParameterPanel) ersetzen wenn `modelSlots`/`models` vorhanden, sonst Legacy-Pfad beibehalten; `UpscalePopoverProps` um optionale `modelSlots?` + `models?` erweitern; `onUpscale` Signatur um `modelIds: string[]` erweitern (`tier?` bleibt deprecated); lokalen `tier`-State fuer Legacy-Pfad beibehalten; `resolveActiveSlots` fuer neue Pfad-Model-Resolution nutzen; `hiddenValues`-Workaround entfaellt im neuen Pfad
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `canvas-detail-view.tsx` -- Consumer-Umbau (Props, Handler) kommt in slice-12
- KEINE Aenderungen an `model-slots.tsx` -- wird nur importiert
- KEINE Aenderungen an `lib/types.ts`, `lib/db/queries.ts`, Server Actions
- KEIN Entfernen von `tier-toggle.tsx` -- kommt in slice-15 (Cleanup)
- KEINE Scale-Button-Logik aendern (2x/4x bleiben als direkte Action-Trigger)
- KEIN ParameterPanel pro Slot (Discovery-Ausnahme: Upscale nutzt Action-Buttons statt Parameter)

**Technische Constraints:**
- `"use client"` Direktive bleibt
- `ModelSlots` mit `variant="stacked"`, `mode="upscale"`, `disabled={state.isGenerating}` rendern
- ModelSlots OHNE ParameterPanel: `showParameters={false}` oder aequivalenter Prop (abhaengig von ModelSlots-API aus slice-06)
- `resolveActiveSlots(slots, "upscale")` fuer Scale-Button-Handler nutzen, um `modelIds[]` zu extrahieren
- `UpscalePopoverProps.onUpscale` Signatur erweitern: `{ scale: 2 | 4, modelIds: string[], tier?: Tier }` -- `tier` bleibt `@deprecated` optional (canvas-detail-view.tsx nutzt es noch). Slice-12 entfernt `tier`
- `modelSlots?` und `models?` sind optionale Props (Uebergangsphase: canvas-detail-view.tsx uebergibt sie noch nicht). Wenn nicht uebergeben, Legacy-Pfad (TierToggle + `hiddenValues={["max"]}` + lokaler `tier`-State). Legacy-Imports (`TierToggle`, `Tier`, `resolveModel`) bleiben fuer diesen Pfad erhalten
- Popover-Close nach Scale-Button-Klick bleibt (bestehendes Verhalten)
- Disabled-Tooltip-Pfad (`isUpscaleDisabled`) bleibt unveraendert

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/model-slots.tsx` | Import: `ModelSlots` Komponente, unveraendert |
| `lib/utils/resolve-model.ts` | Import: `resolveActiveSlots()` (neuer Pfad) + `resolveModel()` (Legacy-Pfad), unveraendert |
| `components/canvas/popovers/upscale-popover.tsx` | Modify: bestehende Datei wird umgebaut |
| `components/ui/tier-toggle.tsx` | Import: Legacy-Pfad Fallback, unveraendert |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> `upscale-popover.tsx` Zeile
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Upscale Popover (Canvas)" (3 Slots ohne ParameterPanel, 2x/4x Buttons)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Per-Slot Parameter" -> Ausnahme: Upscale nutzt direkte Action-Buttons statt ParameterPanel
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Upscale-Aktionen" (kein Generate-Button, Scale-Buttons als direkte Trigger)
