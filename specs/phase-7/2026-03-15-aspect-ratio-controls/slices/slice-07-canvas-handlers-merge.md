# Slice 7: imageParams Merge in Canvas Detail View Handlers

> **Slice 7** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-canvas-handlers-merge` |
| **Test** | `pnpm test components/canvas/canvas-detail-view.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-canvas-popovers-mount"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/canvas-detail-view.test.tsx` |
| **Integration Command** | n/a |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

In `canvas-detail-view.tsx` die beiden Handler `handleVariationGenerate` und `handleImg2imgGenerate` so erweitern, dass `params.imageParams` (geliefert seit Slice 6 via `VariationParams` und `Img2imgParams`) in das `params`-Objekt des jeweiligen `generateImages()`-Aufrufs gespreaded wird. Nach diesem Slice fliessen User-gewaehlte Canvas-Parameter (z.B. `aspect_ratio: "16:9"`) tatsaechlich an die Replicate API durch.

---

## Acceptance Criteria

1) GIVEN `handleVariationGenerate` wird mit `VariationParams` aufgerufen, die `imageParams: { aspect_ratio: "16:9" }` enthalten
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter `{ prompt_strength: <number>, aspect_ratio: "16:9" }` — `imageParams` werden neben `prompt_strength` in params gemergt

2) GIVEN `handleImg2imgGenerate` wird mit `Img2imgParams` aufgerufen, die `imageParams: { resolution: "2K" }` enthalten
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter `{ resolution: "2K" }` — `imageParams` werden in das bisher leere params-Objekt gemergt

3) GIVEN `handleVariationGenerate` wird mit `VariationParams` aufgerufen, die `imageParams: { aspect_ratio: "3:2", megapixels: "0.25" }` enthalten
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter `{ prompt_strength: <number>, aspect_ratio: "3:2", megapixels: "0.25" }` — alle imageParams-Keys sind im params-Objekt

4) GIVEN `handleVariationGenerate` wird mit `VariationParams` aufgerufen, die `imageParams: undefined` enthalten (Popover ohne ParameterPanel, z.B. Schema-Error)
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter nur `{ prompt_strength: <number> }` — Verhalten identisch zum Zustand ohne Feature

5) GIVEN `handleImg2imgGenerate` wird mit `Img2imgParams` aufgerufen, die `imageParams: undefined` enthalten
   WHEN `generateImages()` aufgerufen wird
   THEN enthaelt der `params`-Parameter `{}` — Verhalten identisch zum Zustand ohne Feature

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/canvas-detail-view.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView – imageParams Merge in Handlers', () => {
  // AC-1: handleVariationGenerate merged imageParams neben prompt_strength
  it.todo('should spread imageParams into params alongside prompt_strength in handleVariationGenerate')

  // AC-2: handleImg2imgGenerate merged imageParams in leeres params-Objekt
  it.todo('should spread imageParams into params in handleImg2imgGenerate')

  // AC-3: Mehrere imageParams-Keys werden alle gemergt
  it.todo('should merge all imageParams keys into params for variation generation')

  // AC-4: undefined imageParams bei Variation aendert bestehendes Verhalten nicht
  it.todo('should pass only prompt_strength when variation imageParams is undefined')

  // AC-5: undefined imageParams bei Img2img aendert bestehendes Verhalten nicht
  it.todo('should pass empty params when img2img imageParams is undefined')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-06 | `VariationParams.imageParams` | Interface-Feld | `imageParams?: Record<string, unknown>` — vom Popover im `onGenerate`-Callback mitgegeben |
| slice-06 | `Img2imgParams.imageParams` | Interface-Feld | `imageParams?: Record<string, unknown>` — vom Popover im `onGenerate`-Callback mitgegeben |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Merged `params` in `handleVariationGenerate` | Data flow | -- (End-to-End) | `params: { prompt_strength, ...imageParams }` |
| Merged `params` in `handleImg2imgGenerate` | Data flow | -- (End-to-End) | `params: { ...imageParams }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` — MODIFY: In `handleVariationGenerate` `params.imageParams` neben `prompt_strength` in das `params`-Objekt spreaden; in `handleImg2imgGenerate` `params.imageParams` in das bisher leere `params: {}` spreaden. Defensive Behandlung fuer `undefined` imageParams.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice aendert NUR die beiden Handler-Funktionen in `canvas-detail-view.tsx` — je eine Zeile pro Handler
- Keine Aenderungen an Popover-Komponenten (`variation-popover.tsx`, `img2img-popover.tsx`)
- Keine Aenderungen an `parameter-panel.tsx`, `use-model-schema.ts` oder `resolve-model.ts`
- Keine Aenderungen an `prompt-area.tsx`
- Keine neuen Server Actions oder API-Aenderungen
- Kein neues Props-Durchreichen — `modelSettings` wird bereits in Slice 6 an Popovers durchgereicht

**Technische Constraints:**
- In `handleVariationGenerate` (Zeile ~279): `params: { prompt_strength: promptStrength, ...(params.imageParams ?? {}) }`
- In `handleImg2imgGenerate` (Zeile ~394): `params: { ...(params.imageParams ?? {}) }` — ersetzt das bisherige leere `params: {}`
- Defensiv: `?? {}` Fallback fuer den Fall, dass `imageParams` undefined ist (Abwaertskompatibilitaet)
- `imageParams` hat Vorrang gegenueber statischen Werten (wird nach `prompt_strength` gespreaded)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Migration Map > Existing Files Changed" (canvas-detail-view.tsx)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Data Flow" (handleGenerate merge)
- Discovery: `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md` → Section "Business Rules > Canvas Popover imageParams Flow"

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | Bestehende Handler-Funktionen modifizieren — NUR `params`-Zeilen aendern |

**Done-Signal:**
- Manueller Test: Canvas Variation mit gewaehltem Aspect Ratio (z.B. "16:9") generiert Bild im korrekten Format
- Manueller Test: Canvas Img2img mit gewaehlten Params (z.B. resolution "2K") generiert entsprechend
- In den Generation-Details (`modelParams`) sind die gewaehlten Werte sichtbar
