# Slice 12: Canvas Detail View -- modelSettings durch modelSlots ersetzen

> **Slice 12 von 16** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-canvas-detail-view` |
| **Test** | `pnpm test components/canvas/canvas-detail-view` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-server-actions", "slice-09-variation-popover", "slice-10-img2img-popover", "slice-11-upscale-popover"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/canvas-detail-view` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions getModelSlots, generateImages, upscaleImage, Popover-Komponenten via Vitest mocks) |

---

## Ziel

`canvas-detail-view.tsx` von `modelSettings`/`getModelSettings` auf `modelSlots`/`getModelSlots` umstellen. Die drei Handler (Variation, Img2img, Upscale) nutzen aktive Slots statt tier-basierte Settings. Popovers erhalten `modelSlots` + `models` Props (statt `modelSettings`). Event-Listener wechselt von `"model-settings-changed"` auf `"model-slots-changed"`.

---

## Acceptance Criteria

1) GIVEN die Canvas Detail View mountet
   WHEN der initiale Daten-Fetch stattfindet
   THEN wird `getModelSlots()` aufgerufen (NICHT `getModelSettings()`)
   AND das Ergebnis wird als `ModelSlot[]` in den lokalen State gespeichert

2) GIVEN die Canvas Detail View ist gemountet
   WHEN ein `"model-slots-changed"` Custom Event auf `window` gefeuert wird
   THEN wird `getModelSlots()` erneut aufgerufen und der State aktualisiert
   AND auf `"model-settings-changed"` wird NICHT mehr gehoert

3) GIVEN die Canvas Detail View rendert den Variation Popover
   WHEN die Props an `VariationPopover` uebergeben werden
   THEN erhaelt die Komponente `modelSlots={modelSlots}` und `models={models}` als Props
   AND `modelSettings` wird NICHT mehr uebergeben

4) GIVEN der Variation-Handler wird mit `VariationParams` aufgerufen die `modelIds: string[]` enthalten
   WHEN `handleVariationGenerate` ausgefuehrt wird
   THEN wird `generateImages` mit `modelIds` aus den Params aufgerufen (NICHT aus `modelSettings.find()` berechnet)
   AND `params.tier` wird NICHT verwendet

5) GIVEN die Canvas Detail View rendert den Img2img Popover
   WHEN die Props an `Img2imgPopover` uebergeben werden
   THEN erhaelt die Komponente `modelSlots={modelSlots}` und `models={models}` als Props
   AND `modelSettings` wird NICHT mehr uebergeben

6) GIVEN der Img2img-Handler wird mit `Img2imgParams` aufgerufen die `modelIds: string[]` enthalten
   WHEN `handleImg2imgGenerate` ausgefuehrt wird
   THEN wird `generateImages` mit `modelIds` aus den Params aufgerufen (NICHT aus `modelSettings.find()` berechnet)
   AND `params.tier` wird NICHT verwendet

7) GIVEN die Canvas Detail View rendert den Upscale Popover
   WHEN die Props an `UpscalePopover` uebergeben werden
   THEN erhaelt die Komponente `modelSlots={modelSlots}` und `models={models}` als Props

8) GIVEN der Upscale-Handler wird mit `{ scale, modelIds }` aufgerufen
   WHEN `handleUpscale` ausgefuehrt wird
   THEN wird `upscaleImage` mit dem ersten Eintrag aus `modelIds` aufgerufen (Upscale sendet 1 Model an die API)
   AND `params.tier` wird NICHT verwendet
   AND die zugehoerigen `modelParams` werden aus `modelSlots` fuer das aktive Upscale-Model aufgeloest

9) GIVEN die Canvas Detail View rendert den Chat Panel
   WHEN die Props an `CanvasChatPanel` uebergeben werden
   THEN wird weiterhin `modelSettings` als Prop uebergeben (Rueckwaertskompatibilitaet)
   AND der Wert wird aus `modelSlots` gemappt: `modelSlots.map(slot => ({ mode: slot.mode, tier: "pro" as Tier, modelId: slot.modelId, modelParams: slot.modelParams }))` (oder aequivalentes Mapping)
   AND `CanvasChatPanel` erhaelt KEIN `modelSlots` Prop (Chat Panel Migration erfolgt in slice-13)

10) GIVEN der Import-Block von `canvas-detail-view.tsx`
    WHEN Slice 12 fertig implementiert ist
    THEN importiert die Datei `getModelSlots` aus `@/app/actions/model-slots` (NICHT `getModelSettings` aus `model-settings`)
    AND importiert `ModelSlot` Type (NICHT `ModelSetting`)
    AND der Import von `Tier` Type bleibt vorerst erhalten (wird fuer ChatPanel-Mapping in AC-9 benoetigt; Entfernung in slice-13)

11) GIVEN die `models` State-Variable
    WHEN die Canvas Detail View mountet
    THEN werden die Models (z.B. via `getModels()` oder aus bestehendem Context) geladen und als `models` State bereitgestellt
    AND `models` wird an alle drei Popovers und den Chat Panel weitergereicht

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-slots.test.tsx`

<test_spec>
```typescript
// AC-1: getModelSlots statt getModelSettings beim Mount
it.todo('should call getModelSlots on mount and store result as ModelSlot[]')

// AC-2: Event-Listener auf "model-slots-changed"
it.todo('should listen to "model-slots-changed" event and reload slots')

// AC-3: VariationPopover erhaelt modelSlots + models Props
it.todo('should pass modelSlots and models props to VariationPopover instead of modelSettings')

// AC-4: Variation-Handler nutzt modelIds aus Params
it.todo('should call generateImages with modelIds from VariationParams instead of tier-based lookup')

// AC-5: Img2imgPopover erhaelt modelSlots + models Props
it.todo('should pass modelSlots and models props to Img2imgPopover instead of modelSettings')

// AC-6: Img2img-Handler nutzt modelIds aus Params
it.todo('should call generateImages with modelIds from Img2imgParams instead of tier-based lookup')

// AC-7: UpscalePopover erhaelt modelSlots + models Props
it.todo('should pass modelSlots and models props to UpscalePopover instead of modelSettings')

// AC-8: Upscale-Handler nutzt modelIds und loest modelParams aus Slots auf
it.todo('should call upscaleImage with first modelId from params and resolve modelParams from modelSlots')

// AC-9: CanvasChatPanel erhaelt weiterhin modelSettings (gemappt aus modelSlots)
it.todo('should pass modelSettings prop to CanvasChatPanel mapped from modelSlots for backward compat')

// AC-10: Imports nutzen model-slots statt model-settings (Tier bleibt fuer ChatPanel-Mapping)
it.todo('should import getModelSlots from model-slots and ModelSlot type instead of legacy imports')

// AC-11: Models werden geladen und an Popovers weitergereicht
it.todo('should load models and pass them to all popovers and chat panel')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05` | `getModelSlots()` | Server Action | Import kompiliert; gibt `ModelSlot[] \| { error }` zurueck |
| `slice-02` | `ModelSlot` | Inferred DB Type | Import kompiliert |
| `slice-09` | `VariationPopover` (updated) | React Component | Akzeptiert `modelSlots` + `models` Props |
| `slice-09` | `VariationParams` (updated) | TypeScript Interface | Enthaelt `modelIds: string[]` |
| `slice-10` | `Img2imgPopover` (updated) | React Component | Akzeptiert `modelSlots` + `models` Props |
| `slice-10` | `Img2imgParams` (updated) | TypeScript Interface | Enthaelt `modelIds: string[]` |
| `slice-11` | `UpscalePopover` (updated) | React Component | Akzeptiert `modelSlots` + `models` Props |
| `slice-11` | `onUpscale` callback (updated) | Function Signature | Empfaengt `{ scale, modelIds }` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Canvas Detail View (migrated) | React Component | Parent (Canvas page) | Nutzt `modelSlots` statt `modelSettings` intern; aeussere Props (`CanvasDetailViewProps`) unveraendert |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: `modelSettings` State + `getModelSettings` Import durch `modelSlots` State + `getModelSlots` Import ersetzen; Event-Listener von `"model-settings-changed"` auf `"model-slots-changed"` umstellen; `models` State laden und bereitstellen; alle drei Handler (Variation, Img2img, Upscale) auf `modelIds` aus Params umstellen statt tier-basiertem `modelSettings.find()`; Popover-Props auf `modelSlots` + `models` umstellen; `CanvasChatPanel` weiterhin `modelSettings` uebergeben (gemappt aus `modelSlots` fuer Rueckwaertskompatibilitaet bis slice-13); `ModelSetting` Type Import durch `ModelSlot` ersetzen (`Tier` Import bleibt vorerst fuer ChatPanel-Mapping)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an den Popover-Komponenten selbst (slice-09/10/11 hat sie bereits umgebaut)
- KEINE Aenderungen an `canvas-chat-panel.tsx` (eigener Slice)
- KEINE Aenderungen an Server Actions, `lib/types.ts`, `lib/db/queries.ts`
- KEINE Aenderungen an `CanvasDetailViewProps` (aeussere API bleibt unveraendert)
- KEIN Entfernen der deprecated `tier`/`modelSettings` Props aus Popover-Interfaces (Cleanup kommt spaeter)
- KEINE Aenderungen an Navigation, Polling, Delete, Swipe-Logik (bleiben unveraendert)

**Technische Constraints:**
- `"use client"` Direktive bleibt
- `getModelSlots` aus `@/app/actions/model-slots` importieren (ersetzt `getModelSettings` aus `@/app/actions/model-settings`)
- `ModelSlot` Type aus `@/lib/db/queries` importieren (ersetzt `ModelSetting`)
- Event-Listener: `window.addEventListener("model-slots-changed", loadModelSlots)` (ersetzt `"model-settings-changed"`)
- Variation-Handler: `params.modelIds` direkt an `generateImages({ modelIds: params.modelIds })` uebergeben; bisheriges `modelSettings.find(s => s.mode === "img2img" && s.tier === params.tier)` entfaellt
- Img2img-Handler: `params.modelIds` direkt an `generateImages({ modelIds: params.modelIds })` uebergeben; bisheriges tier-basiertes Lookup entfaellt
- Upscale-Handler: `params.modelIds[0]` als `modelId` an `upscaleImage` uebergeben; `modelParams` werden aus `modelSlots.find(s => s.mode === "upscale" && s.modelId === params.modelIds[0])?.modelParams` aufgeloest
- `models` State: aus bestehendem Data-Fetching-Pattern laden (z.B. `getModels()` Server Action oder `models` Tabelle) und an Popovers weiterreichen
- Popover-Props: `modelSlots={modelSlots}` und `models={models}` uebergeben; `modelSettings` Prop weglassen (Popovers fallen NICHT auf Legacy-Pfad zurueck, da neue Props uebergeben werden)
- ChatPanel-Props: `CanvasChatPanel` erhaelt weiterhin `modelSettings` (gemappt aus `modelSlots`); der Chat-Panel bekommt KEIN `modelSlots` Prop, bis slice-13 die Chat-Panel-Migration durchfuehrt

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | Modify: bestehende Datei wird umgebaut (Hauptdeliverable) |
| `app/actions/model-slots.ts` | Import: `getModelSlots`, unveraendert |
| `components/canvas/popovers/variation-popover.tsx` | Import: `VariationPopover` + `VariationParams`, unveraendert (bereits in slice-09 umgebaut) |
| `components/canvas/popovers/img2img-popover.tsx` | Import: `Img2imgPopover` + `Img2imgParams`, unveraendert (bereits in slice-10 umgebaut) |
| `components/canvas/popovers/upscale-popover.tsx` | Import: `UpscalePopover`, unveraendert (bereits in slice-11 umgebaut) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> `canvas-detail-view.tsx` Zeile
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Integrations" -> Event System (`"model-slots-changed"`)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Data Flow" -> Generate Flow (resolveActiveSlots -> modelIds[])
