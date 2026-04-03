# Slice 07: Canvas UI von promptStyle/negativePrompt bereinigen

> **Slice 7 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-canvas-ui` |
| **Test** | `pnpm test components/canvas/__tests__/variation-popover` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-prompt-area-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__` |
| **Integration Command** | `pnpm test components/canvas/__tests__` |
| **Acceptance Command** | `npx tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Die drei Canvas-Komponenten `VariationPopover`, `CanvasDetailView` und `DetailsOverlay` von den entfernten Feldern `promptStyle` und `negativePrompt` bereinigen. Damit werden die Canvas-Variationsflows konsistent mit der in Slice 05 vereinfachten 1-Feld-Prompt-Architektur.

---

## Acceptance Criteria

1) GIVEN das Interface `VariationParams` in `variation-popover.tsx`
   WHEN seine Properties geprueft werden
   THEN enthaelt es KEINE Property `promptStyle` und KEINE Property `negativePrompt`
   AND es enthaelt weiterhin `prompt`, `strength`, `count`, `tier`, `imageParams`

2) GIVEN die State-Variablen in `VariationPopover`
   WHEN der Quellcode geprueft wird
   THEN existiert KEIN `useState`-Aufruf fuer `promptStyle` oder `negativePrompt`
   AND der `useEffect` fuer Reset bei `isOpen` setzt nur `prompt`, `count`, `tier`, `imageParams`

3) GIVEN die `VariationPopover`-Komponente
   WHEN sie gerendert wird
   THEN existiert KEIN Element mit `data-testid="variation-style"` oder `data-testid="variation-negative-prompt"`
   AND es existiert genau 1 Textarea mit `data-testid="variation-prompt"`

4) GIVEN die `handleGenerate`-Funktion in `VariationPopover`
   WHEN `onGenerate` aufgerufen wird
   THEN enthaelt das uebergebene `VariationParams`-Objekt KEIN `promptStyle` und KEIN `negativePrompt`
   AND es enthaelt `prompt`, `count`, `tier`, `imageParams`

5) GIVEN die `handleVariationGenerate`-Funktion in `canvas-detail-view.tsx`
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt das Argument KEIN `promptStyle` und KEIN `negativePrompt`
   AND `promptMotiv` wird aus `params.prompt` gesetzt

6) GIVEN die `handleImg2imgGenerate`-Funktion in `canvas-detail-view.tsx`
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt das Argument KEIN `promptStyle`
   AND `promptMotiv` wird aus `params.motiv` gesetzt

7) GIVEN die `DetailsOverlay`-Komponente mit einer Generation die `promptStyle` und `negativePrompt` Werte hat
   WHEN sie gerendert wird
   THEN existiert KEIN Element mit `data-testid="details-style"` oder `data-testid="details-negative-prompt"`
   AND das Element mit `data-testid="details-prompt"` wird weiterhin gerendert

8) GIVEN alle Aenderungen aus AC-1 bis AC-7
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN meldet der TypeScript-Compiler 0 Fehler in den drei betroffenen Dateien

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/canvas/__tests__/variation-popover-simplification.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('VariationPopover - prompt simplification', () => {
  // AC-1: VariationParams Interface ohne promptStyle/negativePrompt
  it.todo('should not include promptStyle or negativePrompt in VariationParams type')

  // AC-2: Keine useState fuer promptStyle/negativePrompt
  it.todo('should not have state variables for promptStyle or negativePrompt')

  // AC-3: Keine Style/Negative Textareas gerendert
  it.todo('should not render variation-style or variation-negative-prompt textareas')

  // AC-3: Prompt Textarea weiterhin vorhanden
  it.todo('should render exactly one variation-prompt textarea')

  // AC-4: onGenerate ohne promptStyle/negativePrompt
  it.todo('should call onGenerate without promptStyle or negativePrompt in params')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-simplification.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView - prompt simplification', () => {
  // AC-5: Variation generateImages ohne promptStyle/negativePrompt
  it.todo('should call generateImages without promptStyle or negativePrompt for variation')

  // AC-6: Img2img generateImages ohne promptStyle
  it.todo('should call generateImages without promptStyle for img2img')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/details-overlay-simplification.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('DetailsOverlay - prompt simplification', () => {
  // AC-7: Keine Style/Negative Sections gerendert
  it.todo('should not render details-style or details-negative-prompt sections')

  // AC-7: Prompt Section weiterhin vorhanden
  it.todo('should still render details-prompt section')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-prompt-area-ui` | `WorkspaceVariationState` ohne `promptStyle`/`negativePrompt` | Interface | TS-Compiler akzeptiert Variation-Flow ohne diese Felder |
| `slice-04-generation-service-action` | `GenerateImagesInput` ohne `promptStyle`/`negativePrompt` | Interface | TS-Compiler akzeptiert generateImages-Aufruf ohne diese Felder |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `VariationParams` ohne `promptStyle`/`negativePrompt` | Interface | -- (Endpunkt) | `{ prompt, strength?, count, tier, imageParams? }` |
| `DetailsOverlay` ohne Style/Negative Sections | Component | -- (Endpunkt) | Rendert nur Prompt, Model, Parameters, Provenance |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/variation-popover.tsx` -- Interface `VariationParams` bereinigen, State-Variablen entfernen, Style/Negative Textareas entfernen, onGenerate-Aufruf bereinigen
- [ ] `components/canvas/canvas-detail-view.tsx` -- `promptStyle`/`negativePrompt` aus generateImages-Aufrufen in handleVariationGenerate und handleImg2imgGenerate entfernen
- [ ] `components/canvas/details-overlay.tsx` -- Style-Section (Zeilen 115-128) und Negative-Prompt-Section (Zeilen 130-143) entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `prompt-area.tsx` oder `workspace-state.tsx` (Slice 05)
- KEINE Aenderungen an `generation-service.ts` oder `app/actions/generations.ts` (Slice 04)
- KEINE Aenderungen an `lib/db/schema.ts` oder `lib/db/queries.ts` (Slice 01 + 02)
- KEINE Aenderungen an Assistant-Code (Slices 08/09)
- KEINE Aenderungen an `prompt-tabs.tsx`, `history-list.tsx`, `favorites-list.tsx` (Slice 06)
- Die `Img2imgPopover` und `UpscalePopover` werden in diesem Slice NICHT veraendert
- `promptMotiv` wird NICHT umbenannt (Out of Scope per Architecture)

**Technische Constraints:**
- `VariationParams.prompt` bleibt als einziges Textfeld erhalten
- Die `useEffect`-Reset-Logik in `VariationPopover` muss `promptStyle`/`negativePrompt`-Zeilen entfernen
- `handleGenerate`-Dependency-Array in `useCallback` muss `promptStyle`/`negativePrompt` entfernen
- In `canvas-detail-view.tsx` wird `params.promptStyle`/`params.negativePrompt` aus dem generateImages-Aufruf gestrichen (Zeilen 309-310)
- In `canvas-detail-view.tsx` wird `promptStyle: params.style` aus dem img2img-Handler entfernt (Zeile 424)
- In `details-overlay.tsx`: Die bedingt gerenderten Sections fuer Style und Negative Prompt komplett entfernen (nicht auskommentieren)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Migration Map > Frontend -- UI Components" (variation-popover.tsx, canvas-detail-view.tsx, details-overlay.tsx Zeilen)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/popovers/variation-popover.tsx` | MODIFY -- Interface, State, Textareas, onGenerate bereinigen |
| `components/canvas/canvas-detail-view.tsx` | MODIFY -- generateImages-Aufrufe in Variation- und Img2img-Handler bereinigen |
| `components/canvas/details-overlay.tsx` | MODIFY -- Style/Negative Sections entfernen |
