# Slice 4: imageParams State + ParameterPanel Mount in Prompt Panel

> **Slice 4 von 4** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-prompt-panel-mount` |
| **Test** | `pnpm test components/workspace/prompt-area.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-parameter-panel-split"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/prompt-area.test.tsx` |
| **Integration Command** | n/a |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

In `prompt-area.tsx` den `useModelSchema`-Hook mit dem resolved `modelId` einbinden, `imageParams` als Feld zu `Txt2ImgState` und `Img2ImgState` hinzufuegen, die erweiterte `ParameterPanel`-Komponente zwischen TierToggle und Variants-Stepper rendern, und `imageParams` bei Tier-Wechsel (Model-Aenderung) zuruecksetzen. Noch KEIN Merge von `imageParams` in `handleGenerate` — das kommt in einem separaten Integrationsschritt.

---

## Acceptance Criteria

1) GIVEN `prompt-area.tsx` im `txt2img`-Mode mit Tier `"draft"` und einem konfigurierten Model-Setting fuer `txt2img/draft`
   WHEN die Komponente gerendert wird und `useModelSchema` ein Schema mit `aspect_ratio` (enum) zurueckgibt
   THEN erscheint ein `ParameterPanel` zwischen TierToggle und Variants-Stepper, das `aspect_ratio` als Primary-Control zeigt

2) GIVEN `prompt-area.tsx` im `img2img`-Mode mit Tier `"quality"` und einem konfigurierten Model-Setting fuer `img2img/quality`
   WHEN die Komponente gerendert wird und `useModelSchema` ein Schema mit `aspect_ratio` und `megapixels` (enum) zurueckgibt
   THEN erscheint ein `ParameterPanel` zwischen TierToggle und Variants-Stepper, das beide Primary-Controls zeigt

3) GIVEN `ParameterPanel` zeigt `aspect_ratio` mit Wert `"16:9"` im `txt2img`-State
   WHEN der User den Wert auf `"1:1"` aendert
   THEN wird `imageParams` im `txt2img`-State zu `{ aspect_ratio: "1:1" }` aktualisiert (State-Typ: `Txt2ImgState.imageParams`)

4) GIVEN `useModelSchema` gibt `{ isLoading: true }` zurueck
   WHEN `prompt-area.tsx` rendert (txt2img oder img2img Mode)
   THEN zeigt der Bereich zwischen TierToggle und Variants-Stepper Skeleton-Platzhalter (aus ParameterPanel)

5) GIVEN der User ist im `txt2img`-Mode mit Tier `"draft"` und hat `imageParams: { aspect_ratio: "16:9" }` gesetzt
   WHEN der User Tier zu `"quality"` aendert und das neue Model ein anderes Schema hat
   THEN wird `imageParams` im `txt2img`-State auf `{}` zurueckgesetzt

6) GIVEN der User wechselt von `txt2img` zu `img2img` und zurueck
   WHEN der `txt2img`-State wiederhergestellt wird
   THEN sind die zuvor gesetzten `imageParams` des `txt2img`-States erhalten (Mode-Persistenz)

7) GIVEN der aktuelle Mode ist `"upscale"`
   WHEN `prompt-area.tsx` rendert
   THEN wird KEIN `ParameterPanel` gerendert (Upscale zeigt keine Parameter-Controls)

8) GIVEN `useModelSchema` gibt `{ error: "Model not found" }` zurueck
   WHEN `prompt-area.tsx` rendert
   THEN wird KEIN `ParameterPanel` gerendert (graceful degradation) und Generation bleibt moeglich

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/prompt-area.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea – ParameterPanel Mount', () => {
  // AC-1: ParameterPanel sichtbar im txt2img-Mode mit Primary-Controls
  it.todo('should render ParameterPanel with primary controls in txt2img mode')

  // AC-2: ParameterPanel sichtbar im img2img-Mode mit Primary-Controls
  it.todo('should render ParameterPanel with primary controls in img2img mode')

  // AC-3: imageParams State wird bei Auswahl-Aenderung aktualisiert
  it.todo('should update imageParams in mode state when user changes a parameter value')

  // AC-4: Skeleton-Platzhalter waehrend Schema-Loading
  it.todo('should render skeleton placeholders while schema is loading')

  // AC-5: imageParams Reset bei Tier-Wechsel (Model-Aenderung)
  it.todo('should reset imageParams to empty object when tier changes')

  // AC-6: imageParams bleiben beim Mode-Wechsel erhalten (Mode-Persistenz)
  it.todo('should preserve imageParams when switching modes and switching back')

  // AC-7: Kein ParameterPanel im Upscale-Mode
  it.todo('should not render ParameterPanel in upscale mode')

  // AC-8: Kein ParameterPanel bei Schema-Error
  it.todo('should not render ParameterPanel when schema fetch returns error')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01 | `resolveModel` | Function | Import aus `@/lib/utils/resolve-model` — liefert `modelId` fuer `useModelSchema` |
| slice-02 | `useModelSchema` | Hook | Import aus `@/lib/hooks/use-model-schema` — liefert `{ schema, isLoading, error }` |
| slice-03 | `ParameterPanel` (erweitert) | Component | Import aus `@/components/workspace/parameter-panel` — nimmt `primaryFields`, `schema`, `isLoading`, `values`, `onChange` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Txt2ImgState.imageParams` | State-Feld | (kuenftiger Merge-Slice) | `imageParams: Record<string, unknown>` |
| `Img2ImgState.imageParams` | State-Feld | (kuenftiger Merge-Slice) | `imageParams: Record<string, unknown>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` — MODIFY: `imageParams` Feld zu `Txt2ImgState` und `Img2ImgState` hinzufuegen, `useModelSchema` Hook einbinden mit resolved `modelId`, `ParameterPanel` zwischen TierToggle und Variants-Stepper rendern, `imageParams`-Reset bei Tier/Model-Wechsel
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice aendert NUR `prompt-area.tsx` — keine Canvas Popovers, kein canvas-detail-view
- KEIN Merge von `imageParams` in `handleGenerate` — nur UI-Mounting und State-Management
- Keine Aenderungen an `parameter-panel.tsx` (bereits in Slice 3 erweitert)
- Keine Aenderungen an `use-model-schema.ts` oder `resolve-model.ts`
- Keine neuen Server Actions oder API-Aenderungen

**Technische Constraints:**
- `imageParams` initialisieren mit `{}` (leeres Objekt) in `createInitialModeStates()`
- `ParameterPanel` in txt2img- und img2img-Mode rendern, NICHT in upscale-Mode
- `primaryFields` Prop an ParameterPanel: `["aspect_ratio", "megapixels", "resolution"]`
- `modelId` fuer `useModelSchema` aus `resolveModel(modelSettings, currentMode, tier)?.modelId` ableiten
- `imageParams`-Reset-Logik: bei Aenderung von `tier` (und damit potentiell `modelId`), imageParams des aktuellen Mode auf `{}` setzen
- `ParameterPanel` zwischen TierToggle (Zeile ~967) und Variants-Stepper (Zeile ~975) im Action Bar JSX platzieren

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Architecture Layers" (Integration Points)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Migration Map > Existing Files Changed" (prompt-area.tsx)
- Discovery: `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md` → Section "Business Rules > Mode Persistence fuer imageParams"
- Wireframes: `specs/phase-7/2026-03-15-aspect-ratio-controls/wireframes.md` → Section "Screen: Prompt Panel" (Layout + Annotations ①②③④)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/prompt-area.tsx` | Erweitern: State-Interfaces + JSX + Hook-Einbindung |
| `lib/utils/resolve-model.ts` | Import `resolveModel` — bereits vorhanden seit Slice 1 |
| `lib/hooks/use-model-schema.ts` | Import `useModelSchema` — bereits vorhanden seit Slice 2 |
| `components/workspace/parameter-panel.tsx` | Import `ParameterPanel` — bereits erweitert in Slice 3 |
