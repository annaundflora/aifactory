# Slice 5: Improver generationMode Durchreichung (Action + UI)

> **Slice 5 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-improver-passthrough` |
| **Test** | `pnpm test components/prompt-improve/__tests__/llm-comparison.test.tsx app/actions/__tests__/prompts.test.ts components/workspace/__tests__/prompt-area-improve.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-improver-injection"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/prompt-improve/__tests__/llm-comparison.test.tsx app/actions/__tests__/prompts.test.ts components/workspace/__tests__/prompt-area-improve.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm exec tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (PromptService.improve und Server Action mocken) |

---

## Ziel

Den `generationMode`-Parameter lueckenlos von der UI (`prompt-area.tsx`) ueber die `LLMComparison`-Komponente und die `improvePrompt` Server Action bis zum `PromptService.improve()` durchreichen, sodass der Improver modell- UND modus-spezifisches Wissen nutzt.

---

## Acceptance Criteria

1) GIVEN `improvePrompt` Server Action wird mit `{ prompt: "a cat", modelId: "black-forest-labs/flux-2-pro", generationMode: "img2img" }` aufgerufen
   WHEN die Action `PromptService.improve()` aufruft
   THEN wird `improve(prompt, modelId, "img2img")` mit dem dritten Parameter aufgerufen

2) GIVEN `improvePrompt` Server Action wird mit `{ prompt: "a cat", modelId: "flux-2-pro" }` OHNE `generationMode` aufgerufen
   WHEN die Action `PromptService.improve()` aufruft
   THEN wird `improve(prompt, modelId)` aufgerufen (ohne dritten Parameter, sodass der Default `"txt2img"` aus Slice 04 greift)

3) GIVEN `LLMComparison` wird mit `generationMode="img2img"` gerendert
   WHEN die Komponente `improvePrompt` aufruft
   THEN enthaelt der Action-Aufruf `generationMode: "img2img"` im Input-Objekt

4) GIVEN `prompt-area.tsx` rendert `LLMComparison` im `showImprove`-Zustand
   WHEN `currentMode` den Wert `"img2img"` hat (useState Zeile 134)
   THEN wird `<LLMComparison ... generationMode={currentMode} />` mit `generationMode="img2img"` uebergeben

5) GIVEN `generationMode` wird als neues Prop in `LLMComparisonProps` definiert
   WHEN `pnpm exec tsc --noEmit` ausgefuehrt wird
   THEN kompiliert das gesamte Projekt fehlerfrei (alle bestehenden Aufrufer uebergeben das neue Prop)

6) GIVEN der vollstaendige Pfad UI -> Action -> Service
   WHEN ein User mit Flux-Modell im img2img-Modus "Improve Prompt" klickt
   THEN erhaelt `PromptService.improve()` den Wert `generationMode="img2img"` und der resultierende System-Prompt enthaelt img2img-spezifische Tipps

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/prompts.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('improvePrompt action', () => {
  // AC-1: generationMode wird an PromptService.improve durchgereicht
  it.todo('should pass generationMode to PromptService.improve when provided')

  // AC-2: Ohne generationMode wird improve ohne dritten Parameter aufgerufen
  it.todo('should call PromptService.improve without generationMode when not provided')

  // AC-6: E2E Pfad — generationMode="img2img" wird durchgereicht und System-Prompt enthaelt img2img-Tipps
  it.todo('should pass generationMode="img2img" end-to-end so that resulting system prompt contains img2img-specific tips')
})
```
</test_spec>

### Test-Datei: `components/prompt-improve/__tests__/llm-comparison.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LLMComparison', () => {
  // AC-3: generationMode Prop wird an improvePrompt Action weitergegeben
  it.todo('should pass generationMode to improvePrompt action call')

  // AC-5: TypeScript-Kompilierung mit neuem Prop
  it.todo('should accept generationMode as a required prop')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/prompt-area-improve.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptArea LLMComparison integration', () => {
  // AC-4: currentMode wird als generationMode an LLMComparison uebergeben
  it.todo('should pass currentMode as generationMode prop to LLMComparison')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-04-improver-injection | `PromptService.improve` | Function | `(prompt: string, modelId: string, generationMode?: GenerationMode) => Promise<ImproveResult>` -- akzeptiert optionalen dritten Parameter |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `improvePrompt` | Server Action (erweitert) | slice-12 (Integration-Test) | `(input: { prompt, modelId, generationMode? }) => Promise<ImproveResult \| { error }>` |
| `LLMComparison` | Component (erweitert) | -- (kein externer Consumer) | `LLMComparisonProps` mit `generationMode: GenerationMode` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/prompts.ts` -- MODIFY: `improvePrompt` Input-Type um optionalen `generationMode` erweitern, an `PromptService.improve` durchreichen
- [ ] `components/prompt-improve/llm-comparison.tsx` -- MODIFY: `LLMComparisonProps` um `generationMode` erweitern, an `improvePrompt` Action durchreichen
- [ ] `components/workspace/prompt-area.tsx` -- MODIFY: `currentMode` als `generationMode` Prop an `LLMComparison` uebergeben (Zeile ~1003)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `lib/services/prompt-service.ts` (ist Slice 04)
- KEINE Aenderung an der Knowledge-JSON-Datei oder TypeScript-Interfaces (Slice 01/11)
- KEINE Aenderung am Lookup-Service `lib/services/prompt-knowledge.ts` (Slice 02)
- KEIN neuer API-Endpunkt
- KEINE UI-Aenderungen (kein neues UI-Element, Modus-Selektor existiert bereits)

**Technische Constraints:**
- `GenerationMode` Type aus `lib/types.ts` importieren (Zeile 21) -- NICHT neu definieren
- `generationMode` in der Server Action ist **optional** (fuer Backward-Kompatibilitaet mit potenziellen anderen Aufrufern)
- `generationMode` in `LLMComparisonProps` ist **required** (einziger Aufrufer `prompt-area.tsx` hat `currentMode` immer verfuegbar)
- Mount-Point-Check: `prompt-area.tsx` ist der einzige Consumer von `LLMComparison` und wird in diesem Slice als MODIFY-Deliverable mitgefuehrt

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "DTOs" (Zeile 75-76): `improvePrompt` und `LLMComparisonProps` Erweiterung
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Migration Map" (Zeilen 219-221): `prompts.ts`, `llm-comparison.tsx`, `prompt-area.tsx`
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Business Logic Flow > Improver" (Zeilen 103-109)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `app/actions/prompts.ts` | MODIFY: `improvePrompt` Funktion erweitern (Input-Type + Aufruf) |
| `components/prompt-improve/llm-comparison.tsx` | MODIFY: Props-Interface erweitern + Action-Aufruf anpassen |
| `components/workspace/prompt-area.tsx` | MODIFY: `LLMComparison`-Aufruf um `generationMode={currentMode}` erweitern |
| `lib/types.ts` | Import von `GenerationMode` -- unveraendert |
