# Slice 05: Prompt Area UI vereinfachen

> **Slice 5 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-prompt-area-ui` |
| **Test** | `pnpm test lib/__tests__/workspace-state` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-generation-service-action"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/workspace-state` |
| **Integration Command** | `pnpm test components/workspace/__tests__/prompt-area` |
| **Acceptance Command** | `npx tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Die Prompt Area auf ein einziges Prompt-Feld reduzieren, indem die Style- und Negative-Prompt-Textareas samt Collapsible-Sections entfernt, die State-Typen `Txt2ImgState` und `Img2ImgState` vereinfacht, das Label von "Motiv" auf "Prompt" geaendert und `promptStyle`/`negativePrompt` aus allen generateImages-Aufrufen und der Variation-Konsumierung entfernt werden.

---

## Acceptance Criteria

1) GIVEN die Komponente `PromptArea` in `prompt-area.tsx`
   WHEN sie im Browser gerendert wird
   THEN existiert genau 1 Textarea mit `data-testid="prompt-motiv-textarea"`
   AND es existiert KEIN Element mit `data-testid="prompt-style-textarea"` oder `data-testid="negative-prompt-textarea"`
   AND es existiert KEIN Element mit `data-testid="prompt-style-toggle"` oder `data-testid="prompt-negative-toggle"`

2) GIVEN die Komponente `PromptArea`
   WHEN das Label des Prompt-Feldes geprueft wird
   THEN lautet der sichtbare Label-Text "Prompt" (nicht "Motiv")
   AND der Placeholder lautet "Describe your image, including style and mood..."

3) GIVEN die Interfaces `Txt2ImgState` und `Img2ImgState` in `prompt-area.tsx`
   WHEN ihre Properties geprueft werden
   THEN enthaelt KEINES der Interfaces eine Property `promptStyle` oder `negativePrompt`
   AND `Txt2ImgState` hat nur: `promptMotiv`, `variantCount`, `imageParams`
   AND `Img2ImgState` hat nur: `promptMotiv`, `variantCount`, `referenceSlots`, `imageParams`

4) GIVEN die Funktion `createInitialModeStates()` in `prompt-area.tsx`
   WHEN ihr Rueckgabewert geprueft wird
   THEN enthaelt weder `txt2img` noch `img2img` die Keys `promptStyle` oder `negativePrompt`

5) GIVEN die State-Variablen in der `PromptArea`-Komponente
   WHEN der Quellcode geprueft wird
   THEN existieren KEINE `useState`-Aufrufe fuer `promptStyle`, `negativePrompt`, `styleOpen` oder `negativeOpen`
   AND es existieren KEINE `useRef`-Aufrufe fuer `styleRef` oder `negativeRef`

6) GIVEN ein User der im txt2img-Modus `promptMotiv = "a cat on a roof"` eingibt
   WHEN der User auf "Generate" klickt
   THEN wird `generateImages()` mit `{ promptMotiv: "a cat on a roof", ... }` aufgerufen
   AND das Argument enthaelt KEIN `promptStyle` und KEIN `negativePrompt`

7) GIVEN ein User der im img2img-Modus generiert
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt das Argument KEIN `promptStyle` und KEIN `negativePrompt`

8) GIVEN eine `WorkspaceVariationState` die via `useWorkspaceVariation` konsumiert wird
   WHEN `variationData` mit `promptMotiv`, `modelId`, `modelParams` ankommt
   THEN wird nur `setPromptMotiv(variationData.promptMotiv)` aufgerufen
   AND es wird KEIN `setPromptStyle` oder `setNegativePrompt` aufgerufen

9) GIVEN das Interface `WorkspaceVariationState` in `workspace-state.tsx`
   WHEN seine Properties geprueft werden
   THEN enthaelt es KEINE Property `promptStyle` und KEINE Property `negativePrompt`

10) GIVEN die Mode-State-Persistence (Save/Restore beim Moduswechsel)
    WHEN der User von txt2img zu img2img wechselt und zurueck
    THEN wird `promptMotiv` korrekt gespeichert und wiederhergestellt
    AND es werden KEINE `promptStyle`/`negativePrompt`-Werte gespeichert oder gelesen

11) GIVEN die PromptTabs/HistoryList-Integration in `prompt-area.tsx`
    WHEN `onRestore` eines History-Eintrags aufgerufen wird
    THEN wird nur `setPromptMotiv` aufgerufen
    AND es werden KEINE `promptStyle`/`negativePrompt` Props an `PromptTabs` uebergeben

12) GIVEN alle Aenderungen aus AC-1 bis AC-11
    WHEN `npx tsc --noEmit` ausgefuehrt wird
    THEN meldet der TypeScript-Compiler 0 Fehler in `prompt-area.tsx` und `workspace-state.tsx`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/__tests__/workspace-state.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('WorkspaceVariationState - prompt simplification', () => {
  // AC-9: WorkspaceVariationState hat kein promptStyle/negativePrompt
  it.todo('should not include promptStyle in WorkspaceVariationState type')

  // AC-9: WorkspaceVariationState hat kein negativePrompt
  it.todo('should not include negativePrompt in WorkspaceVariationState type')

  // AC-8: Variation-Konsumierung nur mit promptMotiv
  it.todo('should set variation with only promptMotiv without promptStyle or negativePrompt')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/prompt-area-simplification.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea - prompt simplification', () => {
  // AC-1: Nur 1 Textarea, keine Style/Negative-Felder
  it.todo('should render only one prompt textarea without style or negative fields')

  // AC-1: Keine Collapsible-Toggles
  it.todo('should not render style or negative collapsible toggles')

  // AC-2: Label ist "Prompt", Placeholder angepasst
  it.todo('should display label "Prompt" instead of "Motiv"')

  // AC-2: Placeholder-Text
  it.todo('should display placeholder "Describe your image, including style and mood..."')

  // AC-3: Txt2ImgState/Img2ImgState ohne promptStyle/negativePrompt
  it.todo('should not include promptStyle or negativePrompt in Txt2ImgState and Img2ImgState interfaces')

  // AC-4: createInitialModeStates Rueckgabewert ohne promptStyle/negativePrompt
  it.todo('should return createInitialModeStates without promptStyle or negativePrompt keys')

  // AC-5: Keine useState/useRef fuer entfernte Felder
  it.todo('should not have useState calls for promptStyle, negativePrompt, styleOpen, or negativeOpen')

  // AC-6: generateImages-Aufruf ohne promptStyle/negativePrompt (txt2img)
  it.todo('should call generateImages without promptStyle or negativePrompt in txt2img mode')

  // AC-7: generateImages-Aufruf ohne promptStyle/negativePrompt (img2img)
  it.todo('should call generateImages without promptStyle or negativePrompt in img2img mode')

  // AC-10: Mode-State-Persistence nur mit promptMotiv
  it.todo('should persist and restore only promptMotiv on mode switch without promptStyle or negativePrompt')

  // AC-11: Keine promptStyle/negativePrompt Props an PromptTabs
  it.todo('should not pass promptStyle or negativePrompt props to PromptTabs')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-04-generation-service-action` | `GenerateImagesInput` ohne `promptStyle`/`negativePrompt` | Interface | TS-Compiler akzeptiert generateImages-Aufruf ohne diese Felder |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `WorkspaceVariationState` ohne `promptStyle`/`negativePrompt` | Interface | slice-07 (Canvas) | `{ promptMotiv, modelId, modelParams, targetMode?, ... }` |
| `PromptArea` mit 1-Feld-UI | Component | -- (Endpunkt) | Rendert 1 Textarea, akzeptiert Variation ohne Style/Negative |
| `PromptTabs` ohne `promptStyle`/`negativePrompt` Props | Interface | slice-06 (PromptTabs) | `onRestore(entry)` nur mit `promptMotiv` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- State-Typen vereinfachen, Collapsible-Sections entfernen, Label/Placeholder aendern, generateImages-Aufrufe bereinigen, Variation-Konsumierung bereinigen, PromptTabs-Props bereinigen
- [ ] `lib/workspace-state.tsx` -- `promptStyle` und `negativePrompt` aus `WorkspaceVariationState` entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `lib/db/schema.ts` oder `lib/db/queries.ts` (Slice 01 + 02)
- KEINE Aenderungen an `lib/services/generation-service.ts` oder `app/actions/generations.ts` (Slice 04)
- KEINE Aenderungen an Canvas-Komponenten (`variation-popover.tsx`, `canvas-detail-view.tsx`, `details-overlay.tsx`) -- das ist Slice 07
- KEINE Aenderungen an `prompt-tabs.tsx`, `history-list.tsx`, `favorites-list.tsx` -- das ist Slice 06
- KEINE Aenderungen an Assistant-Code (`assistant-context.tsx`, `use-assistant-runtime.ts`) -- das sind Slices 08/09
- Die `Collapsible`-Imports koennen entfernt werden wenn sie nicht mehr gebraucht werden
- Die `ChevronDown`-Import-Referenz aus lucide-react kann entfernt werden wenn sonst nicht genutzt
- `promptMotiv` wird NICHT umbenannt (Out of Scope per Architecture)
- PromptTabs-Props bereinigen: `promptStyle`/`negativePrompt` Props NICHT mehr uebergeben; PromptTabs-Interface-Aenderung selbst erfolgt in Slice 06

**Technische Constraints:**
- React Hooks Pattern: Entfernte `useState`/`useRef` Aufrufe vollstaendig loeschen (nicht nur auskommentieren)
- Mode-State-Persistence: `saveCurrentModeState`/`restoreCurrentModeState` duerfen nur noch `promptMotiv` behandeln
- `handleClearAll` muss nur noch `setPromptMotiv("")` aufrufen (kein `setPromptStyle`/`setNegativePrompt`)
- Auto-resize Logik fuer Style/Negative-Textareas (`useEffect` mit `styleRef`, `negativeRef`) entfernen

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Migration Map > Frontend -- UI Components" (prompt-area.tsx Zeile)
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Migration Map > Frontend -- State" (workspace-state.tsx)
- Wireframes: `specs/phase-7/2026-03-29-prompt-simplification/wireframes.md` -- Screen "Prompt Area -- After (New State, txt2img)" + Screen "Prompt Area -- After (New State, img2img)"

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/prompt-area.tsx` | MODIFY -- State-Typen, Collapsibles, Label, generateImages-Aufrufe, Variation-Konsumierung, Mode-State Save/Restore |
| `lib/workspace-state.tsx` | MODIFY -- 2 optionale Properties aus `WorkspaceVariationState` entfernen (Zeilen 12-13) |
