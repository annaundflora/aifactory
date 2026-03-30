# Slice 8: Workspace Integration (prompt-area)

> **Slice 8 von 14** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-workspace-integration` |
| **Test** | `pnpm test components/workspace/prompt-area` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-model-slots-ui-stacked"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/prompt-area` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions, getModels, resolveActiveSlots via Vitest mocks) |

---

## Ziel

`prompt-area.tsx` von Tier-basiertem auf Slot-basiertes Model-Management umbauen. TierToggle wird durch die `ModelSlots` Komponente (stacked) ersetzt, der Generate-Handler nutzt `resolveActiveSlots()` fuer Multi-Model-Generierung, und der Event-Listener wird auf `"model-slots-changed"` umgestellt.

---

## Acceptance Criteria

1) GIVEN prompt-area rendert im Workspace
   WHEN die Komponente sichtbar ist
   THEN wird `ModelSlots` mit `variant="stacked"` angezeigt anstelle von `TierToggle`
   AND der Import von `TierToggle` und `Tier` existiert NICHT mehr in der Datei

2) GIVEN prompt-area hat Slots geladen (via `getModelSlots()`)
   WHEN die Komponente mounted
   THEN werden die Slots per `getModelSlots()` statt `getModelSettings()` geladen
   AND der State-Typ ist `ModelSlot[]` statt `ModelSetting[]`

3) GIVEN ein `"model-slots-changed"` Event wird auf `window` dispatcht
   WHEN der Event-Listener feuert
   THEN werden die Slots via `getModelSlots()` neu geladen
   AND es gibt KEINEN Listener auf `"model-settings-changed"` mehr

4) GIVEN Mode ist `txt2img`, 2 Slots sind aktiv (Slot 1: `flux-schnell`, Slot 2: `flux-2-pro`)
   WHEN der User "Generate" klickt mit einem nicht-leeren Prompt
   THEN wird `resolveActiveSlots(slots, "txt2img")` aufgerufen
   AND `generateImages()` erhaelt `modelIds: ["black-forest-labs/flux-schnell", "black-forest-labs/flux-2-pro"]`
   AND `count` ist der Wert des Variant-Count Steppers

5) GIVEN Mode ist `txt2img`, nur Slot 1 ist aktiv
   WHEN der User "Generate" klickt
   THEN wird `generateImages()` mit `modelIds: ["black-forest-labs/flux-schnell"]` aufgerufen (Single-Model, wie bisher)

6) GIVEN Mode ist `img2img`, 2 Slots sind aktiv
   WHEN der User "Generate" klickt mit Prompt und mindestens einer Reference
   THEN wird `generateImages()` mit `modelIds` Array der 2 aktiven Slot-Models aufgerufen
   AND `references` und `sourceImageUrl` werden wie bisher uebergeben

7) GIVEN Mode ist `upscale`, 1 Slot aktiv
   WHEN der User "Upscale" klickt
   THEN wird `upscaleImage()` mit `modelId` des ersten aktiven Upscale-Slots aufgerufen

8) GIVEN der User wechselt von `txt2img` zu `img2img`
   WHEN der Mode-Wechsel passiert
   THEN zeigt `ModelSlots` die `img2img`-spezifischen Slots (aus DB geladen)
   AND die `txt2img`-Slot-Konfiguration bleibt in der DB erhalten

9) GIVEN der Variant-Count Stepper steht auf 2 und 3 Slots sind aktiv
   WHEN die Komponente rendert
   THEN bleibt der Variant-Count Stepper unveraendert sichtbar und funktional
   AND bei Generate werden `modelIds` (3 Stueck) mit `count: 2` uebergeben (= 6 Bilder total)

10) GIVEN eine Generierung laeuft (`isGenerating === true`)
    WHEN die Komponente rendert
    THEN wird `ModelSlots` mit `disabled={true}` gerendert

11) GIVEN das ParameterPanel wurde bisher per `resolveModel()` gesteuert
    WHEN Slice 08 fertig ist
    THEN existiert KEIN separates ParameterPanel mehr in prompt-area.tsx (wird per-Slot von `ModelSlots` gerendert)
    AND der `imageParams` State und `useModelSchema` Hook sind aus prompt-area.tsx entfernt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area-model-slots.test.tsx`

<test_spec>
```typescript
// AC-1: ModelSlots statt TierToggle
it.todo('should render ModelSlots with variant stacked instead of TierToggle')

// AC-2: Laedt Slots via getModelSlots statt getModelSettings
it.todo('should call getModelSlots on mount and store ModelSlot[] state')

// AC-3: Event-Listener auf model-slots-changed
it.todo('should listen for model-slots-changed event and reload slots')

// AC-4: Multi-Model Generate mit resolveActiveSlots
it.todo('should pass multiple modelIds from resolveActiveSlots to generateImages on txt2img')

// AC-5: Single-Model Generate
it.todo('should pass single modelId array when only one slot is active')

// AC-6: Multi-Model img2img Generate
it.todo('should pass multiple modelIds to generateImages on img2img with references')

// AC-7: Upscale nutzt aktiven Slot
it.todo('should pass first active upscale slot modelId to upscaleImage')

// AC-8: Mode-Wechsel zeigt mode-spezifische Slots
it.todo('should display mode-specific slots when switching generation mode')

// AC-9: Variant-Count multipliziert mit aktiven Slots
it.todo('should pass variant count to generateImages alongside all active modelIds')

// AC-10: Disabled waehrend Generierung
it.todo('should pass disabled true to ModelSlots while generating')

// AC-11: ParameterPanel und useModelSchema entfernt
it.todo('should not render a standalone ParameterPanel outside of ModelSlots')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-model-slots-ui-stacked` | `ModelSlots` | React Component | Import kompiliert |
| `slice-06-model-slots-ui-stacked` | `ModelSlotsProps` | TypeScript Interface | Props-Kompatibilitaet |
| `slice-05-server-actions` | `getModelSlots()` | Server Action | Import kompiliert |
| `slice-03-types-resolve-model` | `resolveActiveSlots(slots, mode)` | Pure Function | Import kompiliert |
| `slice-02-db-queries` | `ModelSlot` | Type Export | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `prompt-area.tsx` (umgebaut) | React Component | Workspace Layout | Props-Interface unveraendert (`PromptAreaProps`) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- MODIFY: TierToggle durch ModelSlots (stacked) ersetzen, Tier-State durch Slot-State ersetzen, Generate-Handler auf resolveActiveSlots + modelIds[] umstellen, Event-Listener auf "model-slots-changed", separates ParameterPanel und useModelSchema entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `ModelSlots` Komponente (Slice 06)
- KEINE Aenderungen an Server Actions oder Services
- KEINE Aenderungen an Canvas Popovers, Chat Panel, oder Settings (spaetere Slices)
- KEINE Aenderungen an `lib/types.ts`, `lib/db/queries.ts`, `lib/db/schema.ts`
- KEIN Entfernen von `tier-toggle.tsx` oder `model-settings.ts` (Cleanup-Slice)
- Variant-Count Stepper bleibt unberuhrt (gleiche UI, gleiche Logik)
- PromptAreaProps Interface bleibt aeusserlich unveraendert

**Technische Constraints:**
- `"use client"` Direktive bleibt
- `getModelSlots()` ersetzt `getModelSettings()` fuer Slot-Loading
- `resolveActiveSlots(slots, mode)` ersetzt `resolveModel(settings, mode, tier)` im Generate-Handler
- Generate-Handler baut `modelIds[]` Array aus dem Ergebnis von `resolveActiveSlots()`
- Per-Mode imageParams State entfaellt — ParameterPanel wird jetzt per-Slot von `ModelSlots` gerendert
- `useModelSchema` Hook entfaellt in prompt-area.tsx (wird intern von `ModelSlots` pro Slot verwendet)
- Model-Liste (`getModels`) muss fuer `ModelSlots` Props geladen werden (mode-kompatible Models)
- Optimistic UI Pattern: Mode-Wechsel nutzt gecachte Slots, Refresh im Hintergrund

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/prompt-area.tsx` | MODIFY: Hauptdatei dieses Slices |
| `components/ui/model-slots.tsx` | Import: `ModelSlots` Komponente, unveraendert |
| `lib/utils/resolve-model.ts` | Import: `resolveActiveSlots` (neuer Export aus Slice 03), unveraendert |
| `app/actions/model-slots.ts` | Import: `getModelSlots` statt `getModelSettings`, unveraendert |
| `app/actions/generations.ts` | Import: `generateImages`, `upscaleImage`, unveraendert |
| `app/actions/models.ts` | Import: `getModels` fuer Model-Liste an ModelSlots-Props, unveraendert |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" (prompt-area.tsx Changes)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Business Logic Flow" (Generate Button Flow)
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Workspace Prompt Area" (Annotations 1-7)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Regeln" (Varianten pro Model, Mode-spezifisch)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 7 "Flows" (Flow 1-4)
