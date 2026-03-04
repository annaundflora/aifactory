# Slice 14: Variation Flow implementieren

> **Slice 14 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-variation-flow` |
| **Test** | `pnpm test components/lightbox/__tests__/variation-flow.test.tsx lib/__tests__/variation-utils.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-13-lightbox-navigation-actions", "slice-09-prompt-area-parameter-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/lightbox/__tests__/variation-flow.test.tsx lib/__tests__/variation-utils.test.ts` |
| **Integration Command** | `pnpm test components/lightbox/__tests__/variation-flow.test.tsx` |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Lightbox-Context und PromptArea-State gemockt, kein DB-Zugriff) |

---

## Ziel

Variation-Button in der Lightbox implementieren, der Prompt, Negativ-Prompt, Modell-ID und Parameter der aktuellen Generation in die Workspace-Eingabefelder uebertraegt. Nach Klick schliesst die Lightbox automatisch. Der User kann anschliessend Werte anpassen und mit Variant-Count 1-4 erneut generieren.

---

## Acceptance Criteria

1) GIVEN eine geoeffnete Lightbox mit einer Generation (prompt: "A fox in oil painting style", model_id: "black-forest-labs/flux-2-pro", model_params: { aspect_ratio: "1:1", num_inference_steps: 28 })
   WHEN der User auf den "Variation"-Button klickt
   THEN werden prompt, model_id und model_params in den Shared Variation-State geschrieben

2) GIVEN der User hat auf "Variation" geklickt
   WHEN der Variation-State gesetzt wurde
   THEN schliesst sich die Lightbox automatisch (onClose wird aufgerufen)

3) GIVEN eine Generation mit negative_prompt: "blurry, low quality"
   WHEN der User auf "Variation" klickt
   THEN wird der negative_prompt ebenfalls in den Variation-State uebernommen

4) GIVEN eine Generation mit negative_prompt: null
   WHEN der User auf "Variation" klickt
   THEN wird negative_prompt als leerer String oder undefined in den Variation-State geschrieben

5) GIVEN der Variation-State wurde mit Werten aus der Lightbox befuellt
   WHEN die PromptArea-Komponente den State konsumiert
   THEN wird das Prompt-Textarea mit dem uebernommenen Prompt befuellt, das Modell-Dropdown auf die uebernommene model_id gesetzt, das Parameter-Panel mit den uebernommenen model_params vorbelegt und das Negativ-Prompt-Feld (falls vorhanden) befuellt

6) GIVEN die PromptArea hat die Variation-Daten uebernommen
   WHEN die Uebernahme abgeschlossen ist
   THEN wird der Variation-State zurueckgesetzt (consumed/cleared), damit keine erneute Uebernahme bei Re-Render stattfindet

7) GIVEN die Variation-Daten wurden in die Eingabefelder uebernommen
   WHEN der User den Prompt aendert und Variant-Count auf 3 setzt und "Generate" klickt
   THEN wird `generateImages` mit dem geaenderten Prompt, dem uebernommenen Modell, den (ggf. angepassten) Parametern und count: 3 aufgerufen

8) GIVEN der Variation-Button in der Lightbox
   WHEN die Lightbox gerendert wird
   THEN ist der Button mit Label "Variation" im Actions-Bereich sichtbar (neben Download und Delete)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/variation-utils.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Variation State/Utils', () => {
  // AC-1: Variation-State aus Generation extrahieren
  it.todo('should extract prompt, model_id, and model_params from generation into variation state')

  // AC-3: Negativ-Prompt uebernehmen
  it.todo('should include negative_prompt in variation state when present')

  // AC-4: Negativ-Prompt null behandeln
  it.todo('should set negative_prompt to empty string or undefined when generation has null')

  // AC-6: State-Reset nach Konsumierung
  it.todo('should clear variation state after consumption')
})
```
</test_spec>

### Test-Datei: `components/lightbox/__tests__/variation-flow.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Variation Flow', () => {
  // AC-8: Variation-Button sichtbar
  it.todo('should render Variation button in lightbox actions area')

  // AC-1: Klick setzt Variation-State
  it.todo('should write generation data to variation state when Variation button is clicked')

  // AC-2: Lightbox schliesst nach Variation-Klick
  it.todo('should call onClose after variation state is set')

  // AC-5: PromptArea uebernimmt Variation-Daten
  it.todo('should populate prompt textarea, model dropdown, parameter panel, and negative prompt from variation state')

  // AC-7: Angepasste Variation generieren
  it.todo('should call generateImages with modified prompt and selected variant count after variation takeover')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12` | `LightboxModal` | React Component | Stellt Modal-Shell und Actions-Bereich bereit |
| `slice-13` | `LightboxNavigation` | React Component | Stellt Actions-Bereich bereit (Delete-Button bereits vorhanden) |
| `slice-09` | `PromptArea` | React Component | Konsumiert Variation-State und befuellt Eingabefelder |
| `slice-09` | `ParameterPanel` | React Component | Akzeptiert vorgegebene Werte fuer Parameter-Controls |
| `slice-08` | `generateImages` | Server Action | `(input: GenerateImagesInput) => Promise<Generation[]>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `VariationState` | Type/Interface | PromptArea, LightboxModal | `{ prompt: string, negativePrompt?: string, modelId: string, modelParams: Record<string, unknown> }` |
| `useVariation` oder Context | Shared State Hook/Context | PromptArea, LightboxModal | `{ variationData, setVariation, clearVariation }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/variation-state.ts` -- Shared State/Context/Store fuer Variation-Daten (Type, Provider, Hook)
- [ ] `components/lightbox/lightbox-modal.tsx` -- Erweitern: Variation-Button im Actions-Bereich, setzt Variation-State bei Klick
- [ ] `components/workspace/prompt-area.tsx` -- Erweitern: Konsumiert Variation-State, befuellt Eingabefelder, cleared State nach Uebernahme
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Download-Button -- bereits in Slice 15
- KEINE Delete-Funktionalitaet -- bereits in Slice 13
- KEINE Navigation (Prev/Next) -- bereits in Slice 13
- KEINE Server Action fuer Variation -- Variation ist rein client-seitiger State-Transfer
- KEIN automatisches Generieren nach Variation -- User muss manuell "Generate" klicken

**Technische Constraints:**
- Variation-State via React Context, Zustand Store oder aehnlichem Shared-State-Pattern
- State muss zwischen LightboxModal (Setter) und PromptArea (Consumer) geteilt werden
- `PromptArea` muss bei Variation-Uebernahme auch `getModelSchema` triggern falls sich das Modell aendert
- Variation-State ist einmalig konsumierbar (clear after read) um Re-Render-Loops zu vermeiden
- Client Components (`"use client"`) fuer beide erweiterten Dateien

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: Lightbox / Image Detail Modal" (Annotation 8: `variation-btn`)
- Discovery: `discovery.md` -> Section "User Flow" -> Flow 4 (Variation erstellen, Schritte 3-6)
- Discovery: `discovery.md` -> Section "Feature State Machine" -> Transition `lightbox-open` -> "Variation" -> `workspace-ready`
- Architecture: `architecture.md` -> Section "Server Actions" (`generateImages` Input-Signatur)
