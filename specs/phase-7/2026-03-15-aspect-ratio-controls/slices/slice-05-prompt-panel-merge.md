# Slice 5: imageParams Merge in handleGenerate

> **Slice 5** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-prompt-panel-merge` |
| **Test** | `pnpm test components/workspace/prompt-area.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-prompt-panel-mount"]` |

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

In `prompt-area.tsx` die vom User gewaehlten `imageParams` aus dem Mode-State (`Txt2ImgState.imageParams` / `Img2ImgState.imageParams`) in die `generateImages()`-Aufrufe innerhalb von `handleGenerate` einmergen. Nach diesem Slice fliessen User-gewaehlte Parameter (z.B. `aspect_ratio: "16:9"`) tatsaechlich an die Replicate API durch.

---

## Acceptance Criteria

1) GIVEN der User ist im `txt2img`-Mode mit `imageParams: { aspect_ratio: "16:9" }` und `resolved.modelParams: { megapixels: "1" }`
   WHEN der User auf "Generate" klickt
   THEN wird `generateImages()` mit `params: { megapixels: "1", aspect_ratio: "16:9" }` aufgerufen — `imageParams` werden ueber `modelParams` gemergt

2) GIVEN der User ist im `img2img`-Mode mit `imageParams: { aspect_ratio: "3:2", resolution: "2K" }` und `resolved.modelParams: { megapixels: "1" }`
   WHEN der User auf "Generate" klickt
   THEN wird `generateImages()` mit `params: { megapixels: "1", aspect_ratio: "3:2", resolution: "2K" }` aufgerufen

3) GIVEN der User ist im `txt2img`-Mode mit `imageParams: {}` (keine Auswahl getroffen)
   WHEN der User auf "Generate" klickt
   THEN wird `generateImages()` mit `params` aufgerufen, die exakt `resolved.modelParams` entsprechen — kein Unterschied zum Verhalten ohne Feature

4) GIVEN der User ist im `txt2img`-Mode mit `imageParams: { megapixels: "0.25" }` und `resolved.modelParams: { megapixels: "1" }`
   WHEN der User auf "Generate" klickt
   THEN wird `generateImages()` mit `params: { megapixels: "0.25" }` aufgerufen — `imageParams` ueberschreibt gleichnamige Keys aus `modelParams`

5) GIVEN der User ist im `upscale`-Mode
   WHEN der User auf "Generate" klickt
   THEN wird `upscaleImage()` aufgerufen OHNE `imageParams`-Merge — Upscale-Logik bleibt unveraendert

6) GIVEN der User hat im `txt2img`-Mode `imageParams: { aspect_ratio: "16:9" }` gewaehlt und eine Generierung ausgeloest
   WHEN die Generierung abgeschlossen ist und der User die Generation-Details betrachtet
   THEN ist `aspect_ratio: "16:9"` in den gespeicherten `modelParams` der Generation sichtbar

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/prompt-area.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea – imageParams Merge in handleGenerate', () => {
  // AC-1: txt2img merged imageParams ueber modelParams
  it.todo('should merge imageParams into params for txt2img generateImages call')

  // AC-2: img2img merged imageParams ueber modelParams
  it.todo('should merge imageParams into params for img2img generateImages call')

  // AC-3: Leere imageParams veraendern params nicht
  it.todo('should pass only modelParams when imageParams is empty')

  // AC-4: imageParams ueberschreibt gleichnamige modelParams Keys
  it.todo('should override modelParams keys when imageParams has same key')

  // AC-5: Upscale-Mode bleibt von imageParams unberuehrt
  it.todo('should not merge imageParams in upscale mode')

  // AC-6: Generierte Generation enthaelt gewaehlte imageParams in modelParams
  it.todo('should include imageParams values in stored generation modelParams')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01 | `resolveModel` | Function | Import aus `@/lib/utils/resolve-model` — liefert `resolved.modelParams` |
| slice-04 | `Txt2ImgState.imageParams` | State-Feld | `Record<string, unknown>` — vom User gewaehlt via ParameterPanel |
| slice-04 | `Img2ImgState.imageParams` | State-Feld | `Record<string, unknown>` — vom User gewaehlt via ParameterPanel |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Merged `params` in `generateImages()` | Data flow | -- (End-to-End) | `params: { ...resolved.modelParams, ...imageParams }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` — MODIFY: In `handleGenerate`, `params` fuer txt2img und img2img von `resolved.modelParams` zu `{ ...resolved.modelParams, ...imageParams }` aendern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice aendert NUR die `handleGenerate`-Funktion in `prompt-area.tsx` — zwei Zeilen (txt2img params + img2img params)
- Keine Aenderungen an State-Interfaces, Hooks, ParameterPanel oder UI-Rendering (alles in Slices 1-4 erledigt)
- Keine Aenderungen an der Upscale-Logik
- Keine Aenderungen an Canvas Popovers oder `canvas-detail-view.tsx`
- Keine neuen Server Actions oder API-Aenderungen

**Technische Constraints:**
- Merge-Reihenfolge: `{ ...resolved.modelParams, ...imageParams }` — imageParams hat Vorrang (User-Auswahl ueberschreibt DB-Defaults)
- `imageParams` aus dem aktuellen Mode-State lesen (`txt2imgState.imageParams` bzw `img2imgState.imageParams`)
- Bestehende `params`-Stellen in `handleGenerate`: Zeile ~678 (txt2img) und Zeile ~714 (img2img)
- Upscale-Branch (Zeile ~724+) bleibt komplett unveraendert

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Data Flow" (handleGenerate merge)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Database Schema" (Existing flow: `params: { ...modelParams, ...imageParams }`)
- Discovery: `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md` → Section "Business Rules" (User-gewaehlte Werte ueberschreiben Model-Defaults)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/prompt-area.tsx` | Bestehende `handleGenerate`-Funktion modifizieren — NUR `params`-Zeilen aendern |

**Done-Signal:**
- Manueller Test: Generierung mit gewaehltem Aspect Ratio (z.B. "16:9") erzeugt ein Bild im korrekten Format
- In den Generation-Details (`modelParams`) ist der gewaehlte Wert sichtbar
