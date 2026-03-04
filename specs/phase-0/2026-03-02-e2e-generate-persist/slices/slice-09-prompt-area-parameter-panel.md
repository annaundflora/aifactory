# Slice 9: Prompt Area + Model Dropdown + Parameter Panel implementieren

> **Slice 9 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-prompt-area-parameter-panel` |
| **Test** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx components/workspace/__tests__/parameter-panel.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-generation-service-actions", "slice-06-model-registry-schema-service", "slice-05-workspace-layout-sidebar"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx components/workspace/__tests__/parameter-panel.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx components/workspace/__tests__/parameter-panel.test.tsx` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx components/workspace/__tests__/parameter-panel.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (Server Actions und getModelSchema werden gemockt) |

---

## Ziel

Client Components fuer den oberen Workspace-Bereich: Model-Dropdown mit Name + Preis, Prompt-Textarea mit Auto-Resize und Cmd/Ctrl+Enter, Negativ-Prompt-Input (modellabhaengig sichtbar), dynamisch generiertes Parameter-Panel aus Model Schema, Generate-Button und Variant-Count Selector. Bei Modellwechsel wird das Parameter-Panel neu geladen.

---

## Acceptance Criteria

1) GIVEN die Workspace-Seite ist geladen und die Model-Registry 6 Modelle enthaelt
   WHEN das Model-Dropdown gerendert wird
   THEN zeigt es alle 6 Modelle mit `displayName` und `pricePerImage` (z.B. "FLUX 2 Pro -- $0.055") und das erste Modell ist vorausgewaehlt

2) GIVEN ein Modell ist ausgewaehlt
   WHEN der User ein anderes Modell im Dropdown waehlt
   THEN wird `getModelSchema({ modelId })` aufgerufen und das Parameter-Panel wird mit den neuen Schema-Properties neu gerendert

3) GIVEN das Parameter-Panel laedt ein neues Schema
   WHEN die API noch nicht geantwortet hat
   THEN zeigt das Panel Skeleton-Platzhalter an (Loading-State)

4) GIVEN ein Model-Schema mit Properties `aspect_ratio` (enum: ["1:1", "16:9", "9:16"]), `num_inference_steps` (integer, min: 1, max: 50, default: 28) und `guidance_scale` (number, min: 0, max: 20, default: 3.5)
   WHEN das Parameter-Panel gerendert wird
   THEN wird fuer enum-Properties ein Dropdown/Select, fuer integer/number-Properties ein Slider mit Min/Max/Default gerendert

5) GIVEN ein Model-Schema ohne `negative_prompt` Property
   WHEN das Prompt-Area gerendert wird
   THEN ist das Negative-Prompt-Input NICHT sichtbar (nicht im DOM oder hidden)

6) GIVEN ein Model-Schema MIT `negative_prompt` Property
   WHEN das Prompt-Area gerendert wird
   THEN ist das Negative-Prompt-Input sichtbar und editierbar

7) GIVEN das Prompt-Textarea ist leer
   WHEN der User Text eingibt der mehr als 3 Zeilen erfordert
   THEN waechst die Textarea-Hoehe automatisch mit (Auto-Resize)

8) GIVEN der User hat einen Prompt eingegeben und ein Modell gewaehlt
   WHEN der User Cmd/Ctrl+Enter drueckt
   THEN wird die `generateImages` Server Action mit `{ projectId, prompt, negativePrompt, modelId, params, count }` aufgerufen

9) GIVEN der User hat einen Prompt eingegeben
   WHEN der User auf den Generate-Button klickt
   THEN wird die `generateImages` Server Action mit den aktuellen Werten aufgerufen und der Button zeigt einen Loading-Spinner

10) GIVEN der Generate-Button wurde geklickt und die Action laeuft
    WHEN der User im Prompt-Feld weiter tippt
    THEN bleibt das Prompt-Feld editierbar (nicht disabled)

11) GIVEN der Variant-Count Selector ist sichtbar
    WHEN der User den Wert auf 3 setzt
    THEN wird bei der naechsten Generation `count: 3` an `generateImages` uebergeben

12) GIVEN der Variant-Count Selector
    WHEN er initial gerendert wird
    THEN ist der Default-Wert 1 und die auswaehlbaren Werte sind 1, 2, 3, 4

13) GIVEN ein leeres Prompt-Feld
    WHEN der User auf Generate klickt
    THEN wird `generateImages` NICHT aufgerufen und der Generate-Button bleibt enabled (Client-seitige Validierung)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea', () => {
  // AC-1: Model Dropdown mit 6 Modellen
  it.todo('should render model dropdown with all 6 models showing displayName and pricePerImage')

  // AC-2: Modellwechsel laedt Schema neu
  it.todo('should call getModelSchema when a different model is selected')

  // AC-5: Negativ-Prompt hidden wenn nicht unterstuetzt
  it.todo('should not render negative-prompt input when model schema has no negative_prompt property')

  // AC-6: Negativ-Prompt sichtbar wenn unterstuetzt
  it.todo('should render negative-prompt input when model schema has negative_prompt property')

  // AC-7: Auto-Resize der Textarea
  it.todo('should auto-resize textarea height when content exceeds initial rows')

  // AC-8: Cmd/Ctrl+Enter triggert Generation
  it.todo('should call generateImages when user presses Cmd/Ctrl+Enter in prompt textarea')

  // AC-9: Generate-Button triggert Generation mit Loading
  it.todo('should call generateImages and show loading spinner when generate button is clicked')

  // AC-10: Prompt-Feld bleibt editierbar waehrend Generation
  it.todo('should keep prompt textarea editable while generation is in progress')

  // AC-11: Variant-Count wird uebergeben
  it.todo('should pass selected variant count to generateImages action')

  // AC-12: Variant-Count Default und Optionen
  it.todo('should render variant-count selector with default 1 and options 1-4')

  // AC-13: Leerer Prompt verhindert Generation
  it.todo('should not call generateImages when prompt is empty')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/parameter-panel.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ParameterPanel', () => {
  // AC-3: Loading-State
  it.todo('should show skeleton placeholders while schema is loading')

  // AC-4: Dynamische Controls aus Schema
  it.todo('should render select for enum properties and slider for integer/number properties with min/max/default')

  // AC-2: Schema-Update bei Modellwechsel
  it.todo('should re-render controls when model schema changes')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06` | `MODELS` | Model Registry Array | `Model[]` aus `lib/models.ts` |
| `slice-06` | `getModelSchema` | Server Action | `(input: { modelId: string }) => Promise<{ properties: JSON } \| { error: string }>` |
| `slice-08` | `generateImages` | Server Action | `(input: GenerateImagesInput) => Promise<Generation[] \| { error: string }>` |
| `slice-05` | `app/projects/[id]/page.tsx` | Workspace Page | Rendert die Workspace-Seite mit projectId |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptArea` | Client Component | Workspace Page | `<PromptArea projectId={string} />` |
| `ParameterPanel` | Client Component | PromptArea (intern) | `<ParameterPanel schema={SchemaProperties} onChange={callback} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- Client Component: Model-Dropdown, Prompt-Textarea (Auto-Resize, Cmd/Ctrl+Enter), Negativ-Prompt (modellabhaengig), Generate-Button (Loading-State), Variant-Count Selector
- [ ] `components/workspace/parameter-panel.tsx` -- Client Component: Dynamisch generierte Controls (Select, Slider, Number-Input) aus Model Schema Properties, Loading-Skeleton
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEIN Prompt Builder Button/Drawer -- kommt in Slice 14
- KEIN Improve Prompt Button/Panel -- kommt in Slice 15
- KEINE Gallery/Placeholder-Anzeige -- kommt in Slice 10/11
- KEINE Toast-Notifications bei Fehlern -- kommt in Slice 16
- KEIN Polling/Revalidation nach Generation -- kommt in Slice 10
- KEINE Boolean-Properties im Parameter-Panel (z.B. safety_tolerance) -- nur enum, integer, number als initiale Control-Types

**Technische Constraints:**
- Beide Dateien sind Client Components (`"use client"`)
- shadcn/ui Select fuer Model-Dropdown und Enum-Controls
- shadcn/ui Slider fuer numerische Controls
- shadcn/ui Button fuer Generate-Button und Variant-Count
- Tailwind v4 fuer Styling
- Schema-Properties filtern: `prompt` und `negative_prompt` aus dem Parameter-Panel ausschliessen (werden separat behandelt)
- Auto-Resize via `scrollHeight` Anpassung auf der Textarea

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: Project Workspace" (Annotations 3-10: Model-Dropdown, Prompt-Textarea, Negativ-Prompt, Generate-Button, Variant-Count, Parameter-Panel)
- Architecture: `architecture.md` -> Section "API Design > Server Actions" (generateImages Signatur und Input)
- Architecture: `architecture.md` -> Section "Business Logic Flow: Model Schema" (Schema-Pfad fuer Properties)
- Architecture: `architecture.md` -> Section "Configured Models" (6 Modelle mit Display-Names und Preisen)
- Discovery: `discovery.md` -> Section "Business Rules" (Negativ-Prompt Sichtbarkeit, Cmd/Ctrl+Enter, Varianten 1-4)
