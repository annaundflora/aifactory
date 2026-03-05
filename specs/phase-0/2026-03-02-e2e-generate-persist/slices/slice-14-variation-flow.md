# Slice 14: Variation Flow implementieren

> **Slice 14 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-variation-flow` |
| **Test** | `pnpm test lib/__tests__/workspace-state.test.ts components/lightbox/__tests__/variation-flow.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-13-lightbox-navigation-actions", "slice-09-prompt-area-parameter-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/workspace-state.test.ts components/lightbox/__tests__/variation-flow.test.tsx` |
| **Integration Command** | `pnpm test components/lightbox/__tests__/variation-flow.test.tsx` |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Lightbox-Context und PromptArea-State gemockt, kein DB-Zugriff) |

---

## Ziel

Variation-Button in der Lightbox implementieren, der Prompt, Negativ-Prompt, Modell-ID und Parameter der aktuellen Generation in die Workspace-Eingabefelder uebertraegt. Shared State (`lib/workspace-state.ts`) definiert den Typ und den Context/Hook. Nach Klick schliesst die Lightbox automatisch. Der User kann Werte anpassen und mit Variant-Count 1-4 erneut generieren.

---

## Acceptance Criteria

1) GIVEN eine geoeffnete Lightbox mit einer Generation (prompt: "A fox in oil painting style", model_id: "black-forest-labs/flux-2-pro", model_params: { aspect_ratio: "1:1", num_inference_steps: 28 })
   WHEN der User auf den "Variation"-Button klickt
   THEN werden `prompt`, `modelId` und `modelParams` in den `WorkspaceVariationState` aus `lib/workspace-state.ts` geschrieben

2) GIVEN der User hat auf "Variation" geklickt
   WHEN der Variation-State gesetzt wurde
   THEN schliesst sich die Lightbox automatisch (`onClose` wird aufgerufen)

3) GIVEN eine Generation mit `negative_prompt: "blurry, low quality"`
   WHEN der User auf "Variation" klickt
   THEN wird `negativePrompt` mit dem Wert "blurry, low quality" in den `WorkspaceVariationState` geschrieben

4) GIVEN eine Generation mit `negative_prompt: null`
   WHEN der User auf "Variation" klickt
   THEN wird `negativePrompt` als `undefined` oder leerer String in den `WorkspaceVariationState` geschrieben

5) GIVEN der `WorkspaceVariationState` wurde mit Werten gesetzt
   WHEN `PromptArea` den State via `useWorkspaceVariation()` konsumiert
   THEN wird `prompt-textarea` mit dem uebernommenen Prompt befuellt, das Model-Dropdown auf `modelId` gesetzt, das `ParameterPanel` mit `modelParams` vorbelegt und das Negativ-Prompt-Feld (falls sichtbar) befuellt

6) GIVEN `PromptArea` hat die Variation-Daten uebernommen
   WHEN die Uebernahme abgeschlossen ist
   THEN ruft `PromptArea` `clearVariation()` aus `useWorkspaceVariation()` auf, sodass kein Re-Render die Daten erneut uebertraegt

7) GIVEN die Variation-Daten wurden in die Eingabefelder uebernommen
   WHEN der User den Prompt anpasst, Variant-Count auf 3 setzt und auf "Generate" klickt
   THEN wird `generateImages` mit dem geaenderten Prompt, dem uebernommenen Modell, den (ggf. angepassten) Parametern und `count: 3` aufgerufen

8) GIVEN die Lightbox ist geoeffnet
   WHEN der Actions-Bereich gerendert wird
   THEN ist der "Variation"-Button sichtbar (neben Download und Delete), entsprechend wireframes.md Annotation 8

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/workspace-state.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('WorkspaceState', () => {
  // AC-1: Variation-State setzen
  it.todo('should write prompt, modelId, and modelParams into variation state')

  // AC-3: Negativ-Prompt uebernehmen
  it.todo('should include negativePrompt in variation state when generation has a value')

  // AC-4: Negativ-Prompt null behandeln
  it.todo('should set negativePrompt to undefined or empty string when generation negative_prompt is null')

  // AC-6: State-Reset nach Konsumierung
  it.todo('should return cleared state after clearVariation is called')
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
  it.todo('should write generation data into WorkspaceVariationState when Variation button is clicked')

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
| `slice-13` | `LightboxNavigation` | React Component | Stellt Actions-Bereich bereit; Variation-Button wird ergaenzt |
| `slice-12` | `LightboxModal` | React Component | Stellt Modal-Shell mit Detail-Panel bereit |
| `slice-09` | `PromptArea` | React Component | Konsumiert `useWorkspaceVariation()` und befuellt Eingabefelder |
| `slice-09` | `ParameterPanel` | React Component | Akzeptiert vorgegebene Werte via `PromptArea`-State |
| `slice-09` | `getModelSchema` | Server Action | Wird bei Modellwechsel via Variation neu getriggert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `WorkspaceVariationState` | TypeScript Type | `LightboxModal`, `PromptArea` | `{ prompt: string; negativePrompt?: string; modelId: string; modelParams: Record<string, unknown> }` |
| `WorkspaceStateProvider` | React Context Provider | Workspace Page (root) | `<WorkspaceStateProvider>{children}</WorkspaceStateProvider>` |
| `useWorkspaceVariation` | React Hook | `LightboxModal`, `PromptArea` | `() => { variationData: WorkspaceVariationState \| null; setVariation: (data: WorkspaceVariationState) => void; clearVariation: () => void }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/workspace-state.ts` — `WorkspaceVariationState` Type, React Context, `WorkspaceStateProvider` und `useWorkspaceVariation` Hook fuer Variation-Daten-Uebergabe zwischen `LightboxModal` und `PromptArea`
- [ ] `components/lightbox/lightbox-modal.tsx` — MODIFY: Variation-Button im Actions-Bereich ergaenzen; bei Klick `setVariation()` aufrufen und `onClose` triggern
- [ ] `components/workspace/prompt-area.tsx` — MODIFY: `useWorkspaceVariation()` konsumieren; bei vorhandenem `variationData` Eingabefelder befuellen und `clearVariation()` aufrufen
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
- `lib/workspace-state.ts` exportiert Type, Context und Hook als einzelne Datei (kein Split)
- `WorkspaceStateProvider` muss in `app/projects/[id]/page.tsx` oder einem uebergeordneten Layout eingebunden werden, sodass `LightboxModal` und `PromptArea` denselben Context teilen
- `useWorkspaceVariation` darf nur in Client Components aufgerufen werden
- Variation-State ist einmalig konsumierbar: `clearVariation()` nach Uebernahme verhindert Re-Render-Loops
- Bei Variation mit anderem Modell als dem aktuell ausgewaehlten muss `PromptArea` `getModelSchema` fuer das neue Modell aufrufen

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: Lightbox / Image Detail Modal" (Annotation 8: `variation-btn`)
- Architecture: `architecture.md` -> Section "API Design > Server Actions" (`generateImages` Input-Signatur: `GenerateImagesInput`)
- Architecture: `architecture.md` -> Section "Project Structure" (`lib/`, `components/lightbox/`, `components/workspace/`)
- Discovery: `discovery.md` -> Section "User Flow" -> Variation Flow (Schritte 3-6)
