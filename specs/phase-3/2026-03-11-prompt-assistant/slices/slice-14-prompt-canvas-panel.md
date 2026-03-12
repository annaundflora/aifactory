# Slice 14: Prompt Canvas Panel UI

> **Slice 14 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-prompt-canvas-panel` |
| **Test** | `pnpm test components/assistant/__tests__/prompt-canvas.test.tsx lib/assistant/__tests__/assistant-context-canvas.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-prompt-tools-backend"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test components/assistant/__tests__/prompt-canvas.test.tsx lib/assistant/__tests__/assistant-context-canvas.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` (manuell: draft_prompt Tool-Call ausloesen, Canvas pruefen) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (PromptAssistantContext wird mit Mock-Daten bereitgestellt) |

---

## Ziel

Canvas-Panel rechts neben dem Chat-Thread anzeigen, sobald der Agent einen `draft_prompt` Tool-Call ausfuehrt. Das Sheet expandiert animiert von 480px auf 780px (Split-View), der Canvas zeigt drei editierbare Textareas (Motiv, Style, Negative Prompt) und reagiert auf `draft_prompt`- und `refine_prompt`-Events aus dem `PromptAssistantContext`.

---

## Acceptance Criteria

1) GIVEN der `PromptAssistantContext` hat `draftPrompt` als `null`
   WHEN das Sheet geoeffnet ist
   THEN ist das Canvas-Panel nicht sichtbar und das Sheet bleibt bei 480px Breite

2) GIVEN der `PromptAssistantContext` empfaengt ein `tool-call-result` Event mit `tool: "draft_prompt"` und `data: { motiv: "A woman in autumn forest", style: "photorealistic, golden hour", negative_prompt: "low quality, blurry" }`
   WHEN der Context das Event verarbeitet
   THEN wird `draftPrompt` im Context auf `{ motiv, style, negativePrompt }` gesetzt und `hasCanvas` wird `true`

3) GIVEN `hasCanvas` wechselt von `false` auf `true`
   WHEN das Sheet das Layout aktualisiert
   THEN expandiert das Sheet animiert (CSS transition, >= 200ms) von 480px auf 780px und zeigt einen Split-View: Chat-Thread links (~50%), Canvas-Panel rechts (~50%)

4) GIVEN das Canvas-Panel ist sichtbar mit befuellten Feldern
   WHEN der User den Inhalt des Motiv-Textareas aendert (z.B. "A man" statt "A woman")
   THEN wird der lokale Canvas-State sofort aktualisiert (kein API-Call), `draftPrompt.motiv` im Context reflektiert den neuen Wert

5) GIVEN das Canvas-Panel zeigt einen Draft
   WHEN der `PromptAssistantContext` ein `tool-call-result` Event mit `tool: "refine_prompt"` empfaengt
   THEN werden alle drei Canvas-Felder mit den neuen Werten aus dem Event aktualisiert

6) GIVEN das Canvas-Panel ist sichtbar
   WHEN der User ein Canvas-Feld fokussiert
   THEN erhaelt das Feld einen sichtbaren Focus-Border (Standard-Tailwind focus ring)

7) GIVEN der `PromptAssistantContext` empfaengt ein `refine_prompt` Event waehrend Streaming
   WHEN die Canvas-Felder aktualisiert werden
   THEN zeigen die Felder einen kurzen visuellen Highlight-Effekt (z.B. Hintergrund-Pulse) der anzeigt, dass der Agent die Werte geaendert hat

8) GIVEN das Canvas-Panel mit drei Textareas
   WHEN per Tastatur navigiert wird
   THEN ist die Tab-Reihenfolge: Motiv -> Style -> Negative Prompt (gemaess wireframes.md Section "Keyboard Interactions")

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/prompt-canvas.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptCanvas', () => {
  // AC-1: Canvas nicht sichtbar ohne Draft
  it.todo('should not render canvas panel when draftPrompt is null')

  // AC-3: Canvas erscheint bei hasCanvas=true
  it.todo('should render canvas panel with three textareas when hasCanvas is true')

  // AC-4: Lokale Bearbeitung der Canvas-Felder
  it.todo('should update local state when user edits motiv textarea')

  // AC-4: Style-Feld editierbar
  it.todo('should update local state when user edits style textarea')

  // AC-4: Negative-Prompt-Feld editierbar
  it.todo('should update local state when user edits negative prompt textarea')

  // AC-6: Focus-Ring bei Feld-Fokus
  it.todo('should show focus ring when textarea receives focus')

  // AC-8: Tab-Reihenfolge Motiv -> Style -> Negative
  it.todo('should follow tab order motiv then style then negative prompt')
})
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-canvas.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptAssistantContext - Canvas State', () => {
  // AC-2: draft_prompt Event setzt draftPrompt und hasCanvas
  it.todo('should set draftPrompt and hasCanvas=true on draft_prompt tool-call-result')

  // AC-5: refine_prompt Event aktualisiert draftPrompt
  it.todo('should update draftPrompt fields on refine_prompt tool-call-result')

  // AC-2: draftPrompt enthaelt motiv, style, negativePrompt
  it.todo('should map draft_prompt data with motiv, style, negative_prompt to context state')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/assistant-sheet-split.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('AssistantSheet - Split View', () => {
  // AC-1: Sheet bleibt 480px ohne Canvas
  it.todo('should render at 480px width when hasCanvas is false')

  // AC-3: Sheet expandiert auf 780px mit Canvas
  it.todo('should render at 780px width when hasCanvas is true')

  // AC-3: Split-View zeigt Chat links und Canvas rechts
  it.todo('should render chat thread and canvas panel side by side in split view')

  // AC-7: Visueller Highlight bei refine_prompt Update
  it.todo('should apply highlight effect on canvas fields when refine event is received')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-10-core-chat-loop | `PromptAssistantContext` | React Context | Stellt `draftPrompt`, `isStreaming`, `messages` bereit |
| slice-10-core-chat-loop | `ChatThread` | Component | `<ChatThread>` rendert Messages im linken Panel |
| slice-10-core-chat-loop | `useAssistantRuntime` | Hook | Parsed `tool-call-result` Events und dispatched an Context |
| slice-12-prompt-tools-backend | `tool-call-result:draft_prompt` | SSE Event | `{ tool: "draft_prompt", data: { motiv, style, negative_prompt } }` |
| slice-12-prompt-tools-backend | `tool-call-result:refine_prompt` | SSE Event | `{ tool: "refine_prompt", data: { motiv, style, negative_prompt } }` |
| slice-08-assistant-sheet-shell | `AssistantSheet` | Component | Shell mit Header, Close-Button, children-Slot |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptCanvas` | Component | slice-15, slice-21 | `<PromptCanvas>` (liest aus Context, kein Props-Interface noetig) |
| `hasCanvas` | Context-Feld | slice-15, slice-19, slice-21 | `boolean` -- Canvas sichtbar? |
| `draftPrompt` (editierbar) | Context-Feld | slice-15 (Apply) | `{ motiv: string, style: string, negativePrompt: string }` |
| `updateDraftField` | Context-Funktion | slice-14 intern | `(field: 'motiv' \| 'style' \| 'negativePrompt', value: string) => void` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/prompt-canvas.tsx` -- Canvas-Panel mit 3 editierbaren Textareas, Highlight-Effekt bei Agent-Updates
- [ ] `components/assistant/assistant-sheet.tsx` (erweitert) -- Split-View Layout, dynamische Breite 480px/780px mit CSS Transition
- [ ] `lib/assistant/assistant-context.tsx` (erweitert) -- Canvas-State (draftPrompt, hasCanvas), draft_prompt/refine_prompt Event-Handling, updateDraftField Funktion
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINEN Apply-Button (kommt in Slice 15)
- Dieser Slice implementiert KEINE Model-Recommendation Badge (kommt in Slice 21)
- Dieser Slice implementiert KEINE Session-Resume-Logik fuer Canvas (kommt in Slice 13c/19)
- Dieser Slice implementiert KEINEN Streaming-Text direkt in Canvas-Felder (Tool-Call-Result kommt als vollstaendiges Objekt)

**Technische Constraints:**
- Sheet-Breite ueber CSS `max-width` mit `transition` Property (nicht JavaScript-Animation)
- Canvas-Felder als `<textarea>` Elemente mit `rows` passend zum Inhalt (auto-resize optional)
- Lokaler Canvas-State wird im `PromptAssistantContext` via `useReducer` verwaltet (Dispatch Actions: `SET_DRAFT`, `UPDATE_FIELD`, `REFINE_DRAFT`)
- Feld-Mapping: Backend sendet `negative_prompt` (snake_case), Context speichert `negativePrompt` (camelCase)
- Split-View via CSS Flexbox (nicht CSS Grid) fuer Konsistenz mit bestehendem Layout

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "SSE Event Types" (tool-call-result Payload)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Architecture Layers / Data Flow" (PromptAssistantContext -> Canvas)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Drafting (Chat + Canvas Split View)"
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (prompt-canvas, canvas-motiv, canvas-style, canvas-negative States)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Keyboard Interactions" (Tab-Reihenfolge im Split-View)
