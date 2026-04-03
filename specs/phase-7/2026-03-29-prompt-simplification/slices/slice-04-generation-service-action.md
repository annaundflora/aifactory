# Slice 04: Generation Service & Server Action bereinigen

> **Slice 4 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-generation-service-action` |
| **Test** | `pnpm test lib/services/__tests__/generation-service app/actions/__tests__/generations` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries-prompt-history"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service app/actions/__tests__/generations` |
| **Integration Command** | `pnpm test app/actions/__tests__/generations-multi-ref app/actions/__tests__/generations-upscale` |
| **Acceptance Command** | `npx tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Die Style-Concatenation und den negative_prompt-Passthrough aus dem Generation Service entfernen, sodass der Prompt nur noch `promptMotiv.trim()` ist und kein `negative_prompt` mehr an die Replicate API gesendet wird. Gleichzeitig die Server Action `generateImages` bereinigen, indem `promptStyle` und `negativePrompt` aus dem Interface und der Aufrufkette entfernt werden.

---

## Acceptance Criteria

1) GIVEN die `generate()`-Funktion in `generation-service.ts`
   WHEN die Funktionssignatur geprueft wird
   THEN hat sie KEINEN Parameter `promptStyle` und KEINEN Parameter `negativePrompt`
   AND die Gesamtzahl der Parameter ist um 2 reduziert gegenueber dem aktuellen Stand (12 → 10)

2) GIVEN die `generate()`-Funktion in `generation-service.ts`
   WHEN ein Prompt mit `promptMotiv = "  a cat on a roof  "` uebergeben wird
   THEN wird `prompt` als `"a cat on a roof"` gesetzt (nur `.trim()`, KEINE Style-Concatenation)
   AND die Zeile `let prompt = styleTrimmed ? ... : motivTrimmed` existiert NICHT mehr

3) GIVEN die `buildReplicateInput()`-Funktion in `generation-service.ts`
   WHEN ein Generation-Objekt verarbeitet wird
   THEN wird KEIN `input.negative_prompt` gesetzt
   AND der gesamte `if (generation.negativePrompt)` Block existiert NICHT mehr

4) GIVEN die `createGeneration()`-Aufrufe in `generation-service.ts` (Multi-Model und Single-Model Branch)
   WHEN eine Generation erstellt wird
   THEN enthaelt das Input-Objekt KEIN Feld `negativePrompt` und KEIN Feld `promptStyle`
   AND das Feld `promptMotiv` wird weiterhin mit `motivTrimmed` befuellt

5) GIVEN das Interface `GenerateImagesInput` in `generations.ts`
   WHEN das Interface geprueft wird
   THEN hat es KEINE Property `promptStyle` und KEINE Property `negativePrompt`
   AND die Properties `promptMotiv`, `modelIds`, `params`, `count`, `references` etc. sind unveraendert

6) GIVEN die Server Action `generateImages()` in `generations.ts`
   WHEN der `GenerationService.generate()`-Aufruf geprueft wird
   THEN wird KEIN `input.promptStyle` und KEIN `input.negativePrompt` weitergereicht
   AND der Aufruf hat 10 Argumente (statt 12)
   AND der Default `input.promptStyle ?? ''` existiert NICHT mehr

7) GIVEN alle Aenderungen aus AC-1 bis AC-6
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN meldet der TypeScript-Compiler 0 Fehler in `generation-service.ts` und `generations.ts`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/services/__tests__/generation-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generation-service - prompt simplification', () => {
  // AC-1: generate() Signatur ohne promptStyle und negativePrompt
  it.todo('should not accept promptStyle parameter in generate()')

  // AC-1: generate() Signatur ohne negativePrompt
  it.todo('should not accept negativePrompt parameter in generate()')

  // AC-2: Prompt ist nur promptMotiv.trim(), keine Style-Concatenation
  it.todo('should set prompt to promptMotiv.trim() without style concatenation')

  // AC-3: Kein negative_prompt an Replicate API
  it.todo('should not include negative_prompt in Replicate input')

  // AC-4: createGeneration-Aufrufe ohne promptStyle/negativePrompt
  it.todo('should not pass promptStyle or negativePrompt to createGeneration')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generateImages action - prompt simplification', () => {
  // AC-5: GenerateImagesInput Interface ohne promptStyle/negativePrompt
  it.todo('should not accept promptStyle in GenerateImagesInput')

  // AC-5: GenerateImagesInput Interface ohne negativePrompt
  it.todo('should not accept negativePrompt in GenerateImagesInput')

  // AC-6: generate()-Aufruf ohne promptStyle/negativePrompt Argumente
  it.todo('should call GenerationService.generate without promptStyle or negativePrompt')

  // AC-6: Kein Default fuer promptStyle
  it.todo('should not apply promptStyle default value')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations-multi-ref.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generateImages multi-ref - prompt simplification', () => {
  // AC-6: Multi-Ref Aufruf ohne promptStyle/negativePrompt
  it.todo('should call GenerationService.generate without promptStyle or negativePrompt in multi-ref scenario')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations-upscale.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generateImages upscale - prompt simplification', () => {
  // AC-5: Upscale-Input benoetigt kein promptStyle/negativePrompt
  it.todo('should not require promptStyle or negativePrompt for upscale input')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-queries-prompt-history` | `CreateGenerationInput` ohne `promptStyle`/`negativePrompt` | Interface | TS-Compiler akzeptiert createGeneration-Aufruf ohne diese Felder |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationService.generate()` ohne `promptStyle`/`negativePrompt` | Function | slice-05 (UI), slice-06 (PromptTabs) | `generate(projectId, promptMotiv, modelIds, params, count, generationMode?, sourceImageUrl?, strength?, references?, sourceGenerationId?)` |
| `GenerateImagesInput` ohne `promptStyle`/`negativePrompt` | Interface | slice-05 (UI), slice-07 (Canvas) | `{ projectId, promptMotiv, modelIds, params, count, ... }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` -- Style-Concatenation entfernen, negative_prompt-Passthrough entfernen, generate()-Signatur bereinigen, createGeneration-Aufrufe bereinigen
- [ ] `app/actions/generations.ts` -- GenerateImagesInput Interface bereinigen, generate()-Aufruf in generateImages() anpassen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `lib/db/queries.ts` oder `lib/db/schema.ts` (Slice 01 + 02)
- KEINE Aenderungen an `lib/services/prompt-history-service.ts` (Slice 02)
- KEINE Aenderungen an UI-Komponenten wie `prompt-area.tsx` (Slice 05)
- KEINE Aenderungen an Canvas-Komponenten (Slice 07)
- KEINE Aenderungen an Assistant-Code (Slice 08, 09)
- Die Multi-Reference-Logik (`composeMultiReferencePrompt`) bleibt UNVERAENDERT
- Alle bestehenden Validierungen (promptMotiv empty check, modelIds, count, img2img) bleiben UNVERAENDERT
- `retryGeneration` und `upscaleImage` in `generations.ts` benoetigen KEINE Aenderung (verwenden kein promptStyle/negativePrompt)

**Technische Constraints:**
- TypeScript strict mode
- `prompt = promptMotiv.trim()` ist die EINZIGE Prompt-Komposition (keine Concatenation, kein Style)
- Die `generation.prompt`-Spalte speichert weiterhin den finalen Prompt (= promptMotiv.trim())
- Server Action Pattern: `"use server"` Direktive, `requireAuth()` Guard bleiben unveraendert

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Services & Processing"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Action Interface Change"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Architecture Layers > Data Flow (Target)"

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/generation-service.ts` | MODIFY -- generate()-Signatur, Style-Concat (Zeilen 384-387), negative_prompt-Block (Zeilen 278-280), createGeneration-Aufrufe (Zeilen 413-425, 461-474) |
| `app/actions/generations.ts` | MODIFY -- GenerateImagesInput (Zeilen 22-45), generate()-Aufruf (Zeilen 143-156) |
