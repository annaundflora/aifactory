# Slice 14: Adaptive Improve Service

> **Slice 14 von 14** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-adaptive-improve-service` |
| **Test** | `pnpm vitest run lib/services/__tests__/prompt-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/services/__tests__/prompt-service.test.ts` |
| **Integration Command** | `pnpm vitest run app/actions/__tests__/prompts.test.ts` |
| **Acceptance Command** | `pnpm vitest run lib/services/__tests__/prompt-service.test.ts app/actions/__tests__/prompts.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (OpenRouter Client wird gemockt) |

---

## Ziel

Die `improve()`-Methode in `prompt-service.ts` wird um einen `modelId`-Parameter erweitert. Der System-Prompt wird adaptiv: Er analysiert den User-Prompt (Motiv, Stil, Detailgrad) und optimiert die Verbesserungsstrategie modell-spezifisch. Die Server Action `improvePrompt` reicht `modelId` durch.

---

## Acceptance Criteria

1) GIVEN ein Prompt "a cat" und modelId "recraft-ai/recraft-v4"
   WHEN `improve(prompt, modelId)` aufgerufen wird
   THEN enthaelt der an OpenRouter gesendete System-Prompt den Modell-Display-Namen "Recraft V4" und modell-spezifische Optimierungshinweise

2) GIVEN ein minimaler Prompt (1-3 Woerter, z.B. "sunset beach")
   WHEN der adaptive System-Prompt gebaut wird
   THEN enthaelt die Improvement-Strategie Anweisungen zum Hinzufuegen spezifischer Details (Lighting, Composition, Perspective, Texture)

3) GIVEN ein bereits detailreicher Prompt (>50 Woerter mit Stil-, Licht- und Kompositions-Keywords)
   WHEN der adaptive System-Prompt gebaut wird
   THEN enthaelt die Improvement-Strategie Anweisungen zum Polieren und Verfeinern statt zum Hinzufuegen neuer Details

4) GIVEN ein moderater Prompt (10-30 Woerter mit einigen Stil-Keywords)
   WHEN der adaptive System-Prompt gebaut wird
   THEN enthaelt die Improvement-Strategie Anweisungen zum Verfeinern bestehender und Ergaenzen fehlender Dimensionen

5) GIVEN eine ungueltige modelId die nicht in MODELS existiert
   WHEN `improve(prompt, modelId)` aufgerufen wird
   THEN wird ein generischer Modellname verwendet (kein Fehler), und die Funktion gibt trotzdem ein `ImproveResult` zurueck

6) GIVEN die Server Action `improvePrompt` wird mit `{ prompt: "test", modelId: "google/imagen-4-fast" }` aufgerufen
   WHEN die Action den PromptService aufruft
   THEN wird `PromptService.improve("test", "google/imagen-4-fast")` mit beiden Parametern aufgerufen

7) GIVEN die Server Action `improvePrompt` wird mit leerem `modelId` aufgerufen
   WHEN die Validierung laeuft
   THEN gibt die Action `{ error: "..." }` zurueck (modelId ist Pflicht)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/prompt-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptService.improve - Adaptive System Prompt', () => {
  // AC-1: Modell-Display-Name im System-Prompt
  it.todo('should include model display name "Recraft V4" in system prompt when modelId is recraft-ai/recraft-v4')

  // AC-2: Minimaler Prompt -> Detail-Strategie
  it.todo('should use add-details strategy for minimal prompts with 1-3 words')

  // AC-3: Reicher Prompt -> Polish-Strategie
  it.todo('should use polish strategy for rich prompts with >50 words and style keywords')

  // AC-4: Moderater Prompt -> Refine-Strategie
  it.todo('should use refine strategy for moderate prompts with 10-30 words')

  // AC-5: Ungueltige modelId -> Fallback
  it.todo('should use generic model name for unknown modelId without throwing')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/prompts.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('improvePrompt Action - modelId Parameter', () => {
  // AC-6: modelId wird durchgereicht
  it.todo('should pass modelId to PromptService.improve when provided')

  // AC-7: Leere modelId -> Validierungsfehler
  it.todo('should return error when modelId is empty or missing')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (bestehend) | `getModelById(id)` | Function aus `lib/models.ts` | Gibt `Model \| undefined` zurueck |
| (bestehend) | `openRouterClient.chat()` | Client aus `lib/clients/openrouter.ts` | Wird gemockt in Tests |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptService.improve(prompt, modelId)` | Function | UI-Komponenten via Action | `(prompt: string, modelId: string) => Promise<ImproveResult>` |
| `improvePrompt(input)` | Server Action | `prompt-area.tsx`, `llm-comparison.tsx` | `(input: { prompt: string, modelId: string }) => Promise<ImproveResult \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/prompt-service.ts` — Adaptiver System-Prompt mit Prompt-Analyse, modelId-Parameter, Modell-Display-Name aus `lib/models.ts`
- [ ] `app/actions/prompts.ts` — `improvePrompt` Action: modelId-Parameter hinzufuegen, Validierung, Durchreichung an Service
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Aenderungen (Modal, Buttons, etc.) — nur Service- und Action-Layer
- KEINE Aenderung an `lib/models.ts` (wird nur gelesen)
- KEIN Streaming — OpenRouter gibt komplette Response zurueck (bestehendes Muster)
- KEINE Aenderung am OpenRouter Client selbst

**Technische Constraints:**
- Modell-Display-Name ueber `getModelById()` aus `lib/models.ts` laden
- System-Prompt Struktur orientiert sich an architecture.md → "Adaptive Improve System Prompt" (Section Server Logic)
- Prompt-Analyse (Detailgrad-Erkennung) geschieht im System-Prompt selbst (LLM analysiert), NICHT als TypeScript-Code-Analyse
- `ImproveResult` Interface bleibt unveraendert: `{ original: string, improved: string }`

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` → Section "Adaptive Improve System Prompt" und "Data Flow: Adaptive Improve"
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` → Flow 3 (Improve nutzen), Business Rules (Improve beruecksichtigt gewaehltes Modell)
