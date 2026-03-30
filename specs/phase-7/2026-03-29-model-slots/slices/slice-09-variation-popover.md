# Slice 9: Variation Popover -- TierToggle durch ModelSlots ersetzen

> **Slice 9 von 16** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-variation-popover` |
| **Test** | `pnpm test components/canvas/popovers/variation-popover` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-model-slots-ui-stacked"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/popovers/variation-popover` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions, useModelSchema, getModelSlots via Vitest mocks) |

---

## Ziel

`variation-popover.tsx` umbauen: TierToggle durch `ModelSlots` (stacked) ersetzen, wenn die neuen Props (`modelSlots?`, `models?`) uebergeben werden -- andernfalls Legacy-Pfad (TierToggle) beibehalten. `VariationParams` um `modelIds: string[]` erweitern und `tier?: Tier` als optionales deprecated Feld beibehalten (Rueckwaertskompatibilitaet fuer `canvas-detail-view.tsx` bis slice-12). `VariationPopoverProps` um optionale `modelSlots?` + `models?` erweitern und `modelSettings?` als optionales deprecated Feld beibehalten. Per-Slot Parameter werden inline via ModelSlots gerendert. Generate-Handler sammelt aktive Slot-ModelIds (neuer Pfad) oder nutzt `tier` (Legacy-Pfad).

---

## Acceptance Criteria

1) GIVEN der Variation Popover wird geoeffnet (activeToolId === "variation")
   WHEN die Komponente rendert
   THEN ist kein `TierToggle` sichtbar
   AND stattdessen wird eine `ModelSlots`-Komponente mit `variant="stacked"` und `mode="txt2img"` gerendert

2) GIVEN der Variation Popover zeigt ModelSlots mit Slot 1 (active, "flux-schnell") und Slot 2 (inactive, "flux-pro")
   WHEN der User auf "Generate" klickt
   THEN wird `onGenerate` mit `modelIds: ["black-forest-labs/flux-schnell"]` aufgerufen (nur aktive Slots)
   AND der Generate-Handler setzt `tier` NICHT im Params-Objekt (Feld bleibt `undefined`)

3) GIVEN der Variation Popover zeigt ModelSlots mit Slot 1 und Slot 2 beide active
   WHEN der User auf "Generate" klickt
   THEN wird `onGenerate` mit `modelIds` aufgerufen, das beide aktiven Model-IDs enthaelt

4) GIVEN das `VariationParams` Interface
   WHEN es importiert wird
   THEN enthaelt es `modelIds: string[]` als neues Pflichtfeld
   AND `tier?: Tier` bleibt als optionales Feld mit `@deprecated` JSDoc erhalten (Rueckwaertskompatibilitaet bis slice-12)
   AND alle anderen Felder (prompt, promptStyle, negativePrompt, strength, count, imageParams) bleiben unveraendert

5) GIVEN der Variation Popover zeigt ModelSlots
   WHEN Slot 1 aktiv ist mit einem zugewiesenen Model
   THEN wird unterhalb von Slot 1 ein Per-Slot ParameterPanel angezeigt (via ModelSlots stacked-Layout)

6) GIVEN der Variation Popover wird geoeffnet
   WHEN der Popover rendert
   THEN zeigt die Count-Button-Gruppe ([ 1 ] [ 2 ] [ 3 ] [ 4 ]) weiterhin korrekt an
   AND Count-Aenderung aktualisiert den lokalen State

7) GIVEN die `VariationPopoverProps`
   WHEN die Props definiert werden
   THEN akzeptiert die Komponente `modelSlots?` (vom Typ `ModelSlot[]`, optional) und `models?` (vom Typ `Model[]`, optional) als neue optionale Props (Pflicht ab slice-12)
   AND `modelSettings?` bleibt als optionales Feld mit `@deprecated` JSDoc erhalten (Rueckwaertskompatibilitaet bis slice-12)

8) GIVEN der Variation Popover ist geoeffnet und `state.isGenerating === true`
   WHEN die Komponente rendert
   THEN wird `disabled={true}` an die ModelSlots-Komponente uebergeben
   AND alle Slot-Checkboxen und Dropdowns sind deaktiviert

9) GIVEN der User oeffnet den Variation Popover, aendert Slots, und schliesst ihn
   WHEN der Popover erneut geoeffnet wird
   THEN werden die aktuellen Slot-Daten aus den Props verwendet (kein lokaler Slot-Cache)

10) GIVEN der Variation Popover wird geoeffnet OHNE `modelSlots` und `models` Props (Legacy-Consumer)
    WHEN die Komponente rendert
    THEN faellt die Komponente auf den Legacy-Pfad zurueck: TierToggle wird weiterhin gerendert und `modelSettings` wird fuer die Model-Resolution genutzt
    AND `onGenerate` wird mit `tier` statt `modelIds` aufgerufen (Rueckwaertskompatibilitaet bis slice-12)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/popovers/__tests__/variation-popover-slots.test.tsx`

<test_spec>
```typescript
// AC-1: ModelSlots statt TierToggle gerendert
it.todo('should render ModelSlots with variant="stacked" instead of TierToggle')

// AC-2: Generate sendet nur aktive Slot-ModelIds
it.todo('should call onGenerate with modelIds from active slots only')

// AC-3: Generate sendet mehrere aktive ModelIds
it.todo('should call onGenerate with multiple modelIds when multiple slots are active')

// AC-4: VariationParams enthaelt modelIds und behaelt tier als optionales deprecated Feld
it.todo('should include modelIds in VariationParams and keep tier as optional deprecated field')

// AC-5: Per-Slot ParameterPanel fuer aktive Slots sichtbar
it.todo('should show per-slot ParameterPanel for active slots via ModelSlots stacked layout')

// AC-6: Count-Button-Gruppe funktioniert weiterhin
it.todo('should render count button group and update count state on click')

// AC-7: Props akzeptieren modelSlots und models neben optionalem deprecated modelSettings
it.todo('should accept modelSlots and models props alongside optional deprecated modelSettings')

// AC-8: Disabled-State waehrend Generierung
it.todo('should pass disabled=true to ModelSlots when isGenerating is true')

// AC-9: Kein lokaler Slot-Cache beim Wiederoeffnen
it.todo('should use current slot data from props when popover reopens')

// AC-10: Legacy-Fallback wenn modelSlots/models nicht uebergeben werden
it.todo('should fall back to TierToggle and modelSettings when modelSlots and models props are not provided')
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
| `VariationParams` (updated) | TypeScript Interface | `slice-12` (canvas-detail-view) | `{ prompt, promptStyle, negativePrompt, strength?, count, modelIds: string[], tier?: Tier, imageParams? }` -- `tier` ist `@deprecated`, wird in slice-12 entfernt |
| `VariationPopoverProps` (updated) | TypeScript Interface | `slice-12` (canvas-detail-view) | `{ generation, onGenerate, modelSlots?, models?, modelSettings? }` -- `modelSlots` und `models` optional bis slice-12 (dann Pflicht); `modelSettings` ist `@deprecated`, wird in slice-12 entfernt |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/variation-popover.tsx` -- MODIFY: TierToggle durch ModelSlots (stacked) ersetzen wenn `modelSlots`/`models` vorhanden, sonst Legacy-Pfad beibehalten; `VariationParams` um `modelIds: string[]` erweitern (`tier?` bleibt deprecated); `VariationPopoverProps` um optionale `modelSlots?` + `models?` erweitern (`modelSettings?` bleibt deprecated); separates ParameterPanel entfernen (ModelSlots rendert per-Slot inline); `resolveModel` durch `resolveActiveSlots` ersetzen im neuen Pfad; Generate-Handler sammelt aktive Slot-ModelIds (neuer Pfad) oder nutzt `tier` (Legacy-Pfad)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `canvas-detail-view.tsx` -- der Consumer-Umbau (Props, Handler) kommt in slice-12
- KEINE Aenderungen an `model-slots.tsx` -- wird nur importiert
- KEINE Aenderungen an `lib/types.ts`, `lib/db/queries.ts`, Server Actions
- KEIN Entfernen von `tier-toggle.tsx` -- kommt in slice-15 (Cleanup)
- KEINE Aenderungen an der Count-Button-Gruppe oder Prompt-Feldern (bleiben unveraendert)

**Technische Constraints:**
- `"use client"` Direktive bleibt
- `ModelSlots` mit `variant="stacked"`, `mode="txt2img"`, `disabled={state.isGenerating}` rendern
- ModelSlots uebernimmt das ParameterPanel-Rendering pro Slot -- das bisherige separate `<ParameterPanel>` entfaellt
- `resolveActiveSlots(slots, "txt2img")` fuer Generate-Handler nutzen, um `modelIds[]` zu extrahieren
- `VariationParams` erhaelt `modelIds: string[]` als Pflichtfeld; `tier?: Tier` bleibt als `@deprecated` optional erhalten (canvas-detail-view.tsx nutzt es noch). Slice-12 entfernt `tier`
- `VariationPopoverProps` erhaelt `modelSlots?: ModelSlot[]` + `models?: Model[]` als optionale Props (Uebergangsphase: canvas-detail-view.tsx uebergibt sie noch nicht, slice-12 macht sie Pflicht). `modelSettings?` bleibt als `@deprecated` optional erhalten. Wenn `modelSlots`/`models` nicht uebergeben werden, faellt die Komponente auf den Legacy-Pfad (TierToggle + modelSettings) zurueck
- Count-Button-Gruppe ([ 1 ] [ 2 ] [ 3 ] [ 4 ]) bleibt als radiogroup mit `COUNT_OPTIONS` unveraendert
- `TierToggle` und `resolveModel` bleiben importiert fuer den Legacy-Pfad (wenn `modelSlots`/`models` nicht uebergeben werden). `Tier` Type bleibt importiert (fuer deprecated `tier?: Tier` Feld). `ModelSetting` Type bleibt importiert (fuer deprecated `modelSettings?` Prop). Alle Legacy-Imports werden in slice-12/slice-15 aufgeraeumt

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/model-slots.tsx` | Import: `ModelSlots` Komponente, unveraendert |
| `lib/utils/resolve-model.ts` | Import: `resolveActiveSlots()` (refactored in slice-03), unveraendert |
| `components/canvas/popovers/variation-popover.tsx` | Modify: bestehende Datei wird umgebaut |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> `variation-popover.tsx` Zeile
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Variation Popover (Canvas)"
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Regeln" (Variant-Count UI: Button-Gruppe)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Per-Slot Parameter" (stacked Layout mit inline ParameterPanel)
