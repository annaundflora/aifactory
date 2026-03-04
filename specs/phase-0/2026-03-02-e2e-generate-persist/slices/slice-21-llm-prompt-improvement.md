# Slice 21: LLM Prompt Improvement implementieren

> **Slice 21 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-21-llm-prompt-improvement` |
| **Test** | `pnpm test lib/clients/__tests__/openrouter.test.ts lib/services/__tests__/prompt-service.test.ts components/prompt-improve/__tests__/llm-comparison.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-prompt-area-parameter-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/clients/__tests__/openrouter.test.ts lib/services/__tests__/prompt-service.test.ts components/prompt-improve/__tests__/llm-comparison.test.tsx` |
| **Integration Command** | `pnpm test lib/clients/__tests__/openrouter.test.ts lib/services/__tests__/prompt-service.test.ts components/prompt-improve/__tests__/llm-comparison.test.tsx` |
| **Acceptance Command** | `pnpm test lib/clients/__tests__/openrouter.test.ts lib/services/__tests__/prompt-service.test.ts components/prompt-improve/__tests__/llm-comparison.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (OpenRouter API via global fetch Mock, Server Action gemockt in Component-Tests) |

---

## Ziel

OpenRouter-Client als dünner fetch-Wrapper, PromptService mit `improve()`-Methode (System-Prompt + User-Prompt an OpenRouter), Server Action `improvePrompt`, und ein LLM-Comparison-Panel das Original und verbesserten Prompt nebeneinander zeigt. Adopt uebernimmt den verbesserten Prompt ins Eingabefeld, Discard schliesst das Panel. Fehler zeigen Toast und schliessen das Panel automatisch.

---

## Acceptance Criteria

1) GIVEN ein gueltiger `OPENROUTER_API_KEY` in env
   WHEN `openRouterClient.chat({ model, messages })` aufgerufen wird
   THEN sendet der Client einen POST-Request an `https://openrouter.ai/api/v1/chat/completions` mit `Authorization: Bearer ${OPENROUTER_API_KEY}` Header und gibt den `choices[0].message.content` String zurueck

2) GIVEN ein gueltiger Prompt-String
   WHEN `PromptService.improve(prompt)` aufgerufen wird
   THEN ruft der Service den OpenRouter-Client mit Model `openai/gpt-oss-120b:exacto`, einem System-Prompt (Anweisung zur Prompt-Verbesserung) und dem User-Prompt auf und gibt `{ original: string, improved: string }` zurueck

3) GIVEN der OpenRouter-Client gibt einen HTTP-Fehler zurueck (z.B. 429 oder 500)
   WHEN `PromptService.improve(prompt)` aufgerufen wird
   THEN wirft der Service einen Error mit einer beschreibenden Fehlermeldung

4) GIVEN ein leerer Prompt-String
   WHEN die Server Action `improvePrompt({ prompt: "" })` aufgerufen wird
   THEN gibt die Action `{ error: "Prompt darf nicht leer sein" }` zurueck ohne den OpenRouter-Client aufzurufen

5) GIVEN ein gueltiger Prompt im Eingabefeld
   WHEN der User auf "Improve Prompt" klickt
   THEN zeigt das LLM-Comparison-Panel einen Loading-State mit Skeleton/Spinner und dem Text "Improving prompt..."

6) GIVEN die `improvePrompt` Action gibt `{ original, improved }` zurueck
   WHEN das LLM-Comparison-Panel gerendert wird
   THEN zeigt es zwei nebeneinanderliegende Panels: links "Original" mit dem Original-Prompt (readonly), rechts "Improved" mit dem verbesserten Prompt (readonly), und darunter die Buttons "Adopt" und "Discard"

7) GIVEN das LLM-Comparison-Panel zeigt Original und Improved
   WHEN der User auf "Adopt" klickt
   THEN wird der verbesserte Prompt in das Prompt-Eingabefeld (aus Slice 09) uebernommen und das Panel schliesst sich

8) GIVEN das LLM-Comparison-Panel zeigt Original und Improved
   WHEN der User auf "Discard" klickt
   THEN schliesst sich das Panel und der Original-Prompt im Eingabefeld bleibt unveraendert

9) GIVEN die `improvePrompt` Action gibt einen Fehler zurueck
   WHEN das LLM-Comparison-Panel den Fehler empfaengt
   THEN wird eine Toast-Notification "Prompt-Verbesserung fehlgeschlagen" angezeigt und das Panel schliesst sich automatisch

10) GIVEN das LLM-Comparison-Panel ist im Loading-State
    WHEN der User wartet
    THEN bleibt der "Improve Prompt"-Button disabled (kein doppelter Request)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/clients/__tests__/openrouter.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('OpenRouterClient', () => {
  // AC-1: Chat Completions Request
  it.todo('should send POST to OpenRouter chat/completions with auth header and return content string')

  // AC-3: HTTP-Fehler Handling
  it.todo('should throw descriptive error when API returns non-OK status')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/prompt-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptService', () => {
  // AC-2: improve() ruft OpenRouter mit korrektem Model und Messages auf
  it.todo('should call openRouterClient with model openai/gpt-oss-120b:exacto and return original plus improved')

  // AC-3: Fehlerweiterleitung
  it.todo('should throw error with descriptive message when openRouterClient fails')

  // AC-4: Leerer Prompt Validierung (Server Action)
  it.todo('should return error object when prompt is empty without calling OpenRouter')
})
```
</test_spec>

### Test-Datei: `components/prompt-improve/__tests__/llm-comparison.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LLMComparison', () => {
  // AC-5: Loading-State
  it.todo('should show skeleton/spinner with text Improving prompt while loading')

  // AC-6: Side-by-side Darstellung
  it.todo('should render original and improved prompt in two readonly side-by-side panels with adopt and discard buttons')

  // AC-7: Adopt uebernimmt Prompt
  it.todo('should call onAdopt with improved prompt and close panel when adopt is clicked')

  // AC-8: Discard schliesst Panel
  it.todo('should call onDiscard and close panel without changing prompt when discard is clicked')

  // AC-9: Fehler zeigt Toast und schliesst Panel
  it.todo('should show error toast and close panel automatically on error')

  // AC-10: Button disabled waehrend Loading
  it.todo('should keep improve button disabled while loading to prevent duplicate requests')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09` | `PromptArea` | Client Component | Stellt das Prompt-Eingabefeld bereit, in das der verbesserte Prompt uebernommen wird |
| `slice-09` | Prompt-State | React State | Zugriff auf aktuellen Prompt-Text und Setter-Funktion |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `openRouterClient.chat` | Function | `PromptService` | `(params: { model: string, messages: ChatMessage[] }) => Promise<string>` |
| `PromptService.improve` | Function | Server Action | `(prompt: string) => Promise<{ original: string, improved: string }>` |
| `improvePrompt` | Server Action | `LLMComparison` | `(input: { prompt: string }) => Promise<{ original: string, improved: string } \| { error: string }>` |
| `LLMComparison` | Client Component | `PromptArea` | `<LLMComparison prompt={string} onAdopt={(improved: string) => void} onDiscard={() => void} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/clients/openrouter.ts` -- Duenner fetch-Wrapper fuer OpenRouter Chat Completions API
- [ ] `lib/services/prompt-service.ts` -- PromptService.improve() mit System-Prompt und User-Prompt
- [ ] `app/actions/prompts.ts` -- Server Action `improvePrompt` (Validierung + Service-Aufruf) (erweitern falls existent, sonst neu)
- [ ] `components/prompt-improve/llm-comparison.tsx` -- Client Component: Loading-State, Side-by-Side Original/Improved, Adopt/Discard Buttons
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEIN Streaming der LLM-Antwort -- einfacher Request/Response
- KEIN SDK fuer OpenRouter -- plain fetch reicht
- KEINE Snippet-CRUD Actions in `app/actions/prompts.ts` -- kommt in einem anderen Slice
- KEIN Prompt-Builder-Button -- kommt in Slice 14
- KEINE Konfigurierbarkeit des LLM-Modells -- hardcoded `openai/gpt-oss-120b:exacto`

**Technische Constraints:**
- `lib/clients/openrouter.ts`: Plain `fetch()`, kein SDK, keine externe Dependency
- `lib/services/prompt-service.ts`: Stateless Function, kein Caching
- `components/prompt-improve/llm-comparison.tsx`: Client Component (`"use client"`)
- shadcn/ui Button fuer Adopt/Discard
- shadcn/ui Skeleton fuer Loading-State
- sonner Toast fuer Fehler-Notification
- Tailwind v4 fuer Styling

**Referenzen:**
- Architecture: `architecture.md` -> Section "Server Logic > Business Logic Flow: Prompt Improvement" (Request-Struktur, Model, Endpoint)
- Architecture: `architecture.md` -> Section "API Design > Server Actions" (`improvePrompt` Signatur)
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (OpenRouter Error -> Toast + Panel schliesst)
- Wireframes: `wireframes.md` -> Section "Screen: LLM Prompt Improvement" (Layout, Annotations, State Variations)
- Discovery: `discovery.md` -> Section "User Flow > Flow 3: Prompt verbessern" (User-Journey)
