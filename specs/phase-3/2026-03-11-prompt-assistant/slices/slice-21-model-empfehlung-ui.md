# Slice 21: Model-Empfehlung UI im Canvas

> **Slice 21 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-21-model-empfehlung-ui` |
| **Test** | `pnpm test components/assistant/__tests__/model-recommendation.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-20-recommend-model-tools"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test components/assistant/__tests__/model-recommendation.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` (manuell: recommend_model Tool-Call ausloesen, Badge pruefen, "Modell verwenden" klicken) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (PromptAssistantContext wird mit Mock-Daten bereitgestellt, useWorkspaceVariation gemockt) |

---

## Ziel

Model-Recommendation Badge im Canvas-Panel unterhalb der Prompt-Felder anzeigen, wenn der Agent ein `recommend_model` Tool-Call-Result sendet. Der Badge zeigt Modellname und Kurzbegruendung. Der Action-Link "Modell verwenden" setzt die `modelId` im Workspace via `useWorkspaceVariation`.

---

## Acceptance Criteria

1) GIVEN der `PromptAssistantContext` hat `recommendedModel` als `null`
   WHEN das Canvas-Panel sichtbar ist
   THEN ist die Model-Recommendation Badge NICHT sichtbar

2) GIVEN der `PromptAssistantContext` empfaengt ein `tool-call-result` Event mit `tool: "recommend_model"` und `data: { id: "black-forest-labs/flux-1.1-pro", name: "Flux Pro 1.1", reason: "Ideal fuer fotorealistische Portraits" }`
   WHEN der Context das Event verarbeitet
   THEN wird `recommendedModel` im Context auf `{ id, name, reason }` gesetzt

3) GIVEN `recommendedModel` ist gesetzt mit `{ id: "black-forest-labs/flux-1.1-pro", name: "Flux Pro 1.1", reason: "Ideal fuer fotorealistische Portraits" }`
   WHEN das Canvas-Panel gerendert wird
   THEN zeigt die Badge den Modellnamen "Flux Pro 1.1" und die Begruendung "Ideal fuer fotorealistische Portraits" und einen klickbaren Action-Link mit dem Text "Modell verwenden"

4) GIVEN die Model-Recommendation Badge ist sichtbar mit `id: "black-forest-labs/flux-1.1-pro"`
   WHEN der User auf "Modell verwenden" klickt
   THEN wird `useWorkspaceVariation().setVariation()` aufgerufen mit einem Objekt das `modelId: "black-forest-labs/flux-1.1-pro"` enthaelt (andere Felder bleiben unveraendert)

5) GIVEN der Agent sendet ein neues `recommend_model` Event mit `{ id: "stability-ai/sdxl", name: "SDXL", reason: "Stark bei kuenstlerischen Illustrationen" }`
   WHEN das Canvas bereits eine vorherige Empfehlung anzeigt
   THEN wird die Badge aktualisiert und zeigt "SDXL" mit der neuen Begruendung

6) GIVEN die Model-Recommendation Badge ist sichtbar
   WHEN der User per Tastatur navigiert (Tab)
   THEN ist der "Modell verwenden" Link fokussierbar und die Tab-Reihenfolge ist: Negative Prompt Textarea -> Model-Recommendation Link -> Apply-Button (gemaess wireframes.md Section "Drafting")

7) GIVEN `recommendedModel` ist `null` und das Canvas-Panel ist sichtbar
   WHEN spaeter ein `recommend_model` Event empfangen wird
   THEN erscheint die Badge mit einer dezenten Einblend-Animation (opacity transition)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/model-recommendation.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelRecommendation', () => {
  // AC-1: Badge nicht sichtbar ohne Empfehlung
  it.todo('should not render when recommendedModel is null')

  // AC-3: Badge zeigt Modellname, Begruendung und Action-Link
  it.todo('should render model name, reason, and action link when recommendedModel is set')

  // AC-4: Klick auf "Modell verwenden" setzt modelId im Workspace
  it.todo('should call setVariation with correct modelId when action link is clicked')

  // AC-5: Badge aktualisiert sich bei neuem Event
  it.todo('should update display when recommendedModel changes')

  // AC-6: Action-Link ist per Tab fokussierbar
  it.todo('should make action link focusable via keyboard')

  // AC-7: Badge erscheint mit Einblend-Animation
  it.todo('should render with opacity transition class when appearing')
})
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-recommendation.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptAssistantContext - Recommendation State', () => {
  // AC-2: recommend_model Event setzt recommendedModel
  it.todo('should set recommendedModel on recommend_model tool-call-result')

  // AC-5: Neues recommend_model Event ueberschreibt vorherigen Wert
  it.todo('should replace existing recommendedModel on new recommend_model event')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-14-prompt-canvas-panel | `PromptCanvas` | Component | Rendert Canvas-Panel; Model-Recommendation wird unterhalb der Textareas eingebettet |
| slice-14-prompt-canvas-panel | `hasCanvas` | Context-Feld | `boolean` -- Canvas muss sichtbar sein damit Badge gerendert wird |
| slice-20-recommend-model-tools | `tool-call-result:recommend_model` | SSE Event | `{ tool: "recommend_model", data: { id: string, name: string, reason: string } }` |
| slice-10-core-chat-loop | `PromptAssistantContext` | React Context | Stellt `recommendedModel` bereit, parsed recommend_model Events |
| (workspace-state) | `useWorkspaceVariation` | Hook | `setVariation(data)` zum Setzen der `modelId` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelRecommendation` | Component | slice-14 (eingebettet in PromptCanvas) | `<ModelRecommendation>` (liest aus Context, kein Props-Interface noetig) |
| `recommendedModel` | Context-Feld | slice-21 intern | `{ id: string, name: string, reason: string } \| null` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/model-recommendation.tsx` -- Badge-Komponente mit Modellname, Begruendung und "Modell verwenden" Action-Link
- [ ] `components/assistant/prompt-canvas.tsx` (erweitert) -- ModelRecommendation unterhalb der Textareas einbinden
- [ ] `lib/assistant/assistant-context.tsx` (erweitert) -- recommendedModel State-Feld, recommend_model Event-Handling im Reducer (SET_RECOMMENDATION Action)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINEN Model-Browser oder Model-Detail-Ansicht
- Dieser Slice implementiert KEINE Logik zum Oeffnen des Model-Browsers bei Klick (nur modelId setzen)
- Dieser Slice aendert NICHT die Backend-Tools (Slice 20 liefert die Daten)
- Dieser Slice implementiert KEINE automatische Model-Auswahl ohne User-Interaktion

**Technische Constraints:**
- `useWorkspaceVariation().setVariation()` erhaelt ein vollstaendiges `WorkspaceVariationState`-Objekt; bestehende Felder (`promptMotiv`, `promptStyle`, etc.) muessen aus dem aktuellen `variationData` uebernommen und nur `modelId` ueberschrieben werden
- Badge als visuell eigenstaendige Komponente innerhalb des Canvas-Panels (unterhalb Negative Prompt, oberhalb Apply-Button)
- "Modell verwenden" als `<button>` mit Link-Styling (kein `<a>`) fuer Barrierefreiheit
- Einblend-Animation ueber Tailwind `transition-opacity duration-300`

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "SSE Event Types" (tool-call-result Payload fuer recommend_model)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Data Transfer Objects" (ModelRec: id, name, reason)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Drafting" (Annotation 9: model-recommendation Badge)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Business Rules" (Model-Empfehlung: klickbarer Badge, kein automatisches Umschalten)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (model-recommendation: hidden, visible)
- Workspace: `lib/workspace-state.tsx` -> `useWorkspaceVariation()` Hook und `WorkspaceVariationState` Interface
