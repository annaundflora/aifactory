# Slice 15: Apply-Button + Workspace-Integration

> **Slice 15 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-apply-button-workspace` |
| **Test** | `pnpm test components/assistant/__tests__/apply-button.test.tsx components/assistant/__tests__/prompt-canvas-apply.test.tsx lib/assistant/__tests__/assistant-context-apply.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-14-prompt-canvas-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test components/assistant/__tests__/apply-button.test.tsx components/assistant/__tests__/prompt-canvas-apply.test.tsx lib/assistant/__tests__/assistant-context-apply.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` (manuell: Apply klicken, Workspace-Felder pruefen, Undo testen) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (WorkspaceVariation Context und sonner toast werden gemockt) |

---

## Ziel

Apply-Button im Canvas-Panel implementieren, der die drei Canvas-Felder (motiv, style, negativePrompt) aus dem `PromptAssistantContext` in den Workspace uebertraegt via `useWorkspaceVariation.setVariation()`. Nach dem Klick zeigt der Button "Applied!" mit Checkmark fuer 2 Sekunden und ein Undo-Toast (sonner) erscheint, ueber den der User die vorherigen Workspace-Werte wiederherstellen kann.

---

## Acceptance Criteria

1) GIVEN das Canvas-Panel ist sichtbar mit `draftPrompt` `{ motiv: "A woman in autumn forest", style: "photorealistic, golden hour", negativePrompt: "low quality, blurry" }`
   WHEN der User auf den Apply-Button klickt
   THEN wird `useWorkspaceVariation().setVariation()` aufgerufen mit `{ promptMotiv: "A woman in autumn forest", promptStyle: "photorealistic, golden hour", negativePrompt: "low quality, blurry" }` (plus bestehende Werte fuer `modelId`, `modelParams`)

2) GIVEN der User hat auf Apply geklickt
   WHEN der Apply-Vorgang abgeschlossen ist
   THEN zeigt der Button fuer genau 2 Sekunden den Text "Applied!" mit einem Checkmark-Icon (Check von Lucide), danach kehrt er zum Text "Apply" zurueck

3) GIVEN der User hat auf Apply geklickt
   WHEN der Apply-Vorgang abgeschlossen ist
   THEN erscheint ein sonner-Toast mit dem Text "Prompt uebernommen." und einer Action "Rueckgaengig"

4) GIVEN der Workspace hatte vorher die Werte `{ promptMotiv: "old motiv", promptStyle: "old style", negativePrompt: "old negative" }`
   WHEN der User im Undo-Toast auf "Rueckgaengig" klickt
   THEN wird `setVariation()` erneut aufgerufen mit den gespeicherten vorherigen Werten und die Workspace-Felder zeigen wieder die alten Werte

5) GIVEN der Undo-Toast ist sichtbar
   WHEN 5 Sekunden vergehen ohne Klick auf "Rueckgaengig"
   THEN verschwindet der Toast automatisch (sonner Default-Verhalten mit `duration: 5000`)

6) GIVEN `draftPrompt` im `PromptAssistantContext` ist `null` (kein Draft vorhanden)
   WHEN das Canvas-Panel gerendert wird
   THEN ist der Apply-Button disabled (nicht klickbar)

7) GIVEN der Apply-Button befindet sich im "Applied!"-Zustand (2-Sekunden-Feedback)
   WHEN der User erneut auf den Button klickt
   THEN passiert nichts (Button ist waehrend des Feedback-Zustands disabled)

8) GIVEN ein Canvas-Feld ist leer (z.B. `negativePrompt: ""`)
   WHEN der User auf Apply klickt
   THEN wird das entsprechende Workspace-Feld ebenfalls geleert (leerer String wird uebergeben)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/apply-button.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ApplyButton', () => {
  // AC-2: Button zeigt "Applied!" mit Checkmark fuer 2 Sekunden
  it.todo('should show Applied! text with check icon for 2 seconds after click')

  // AC-2: Button kehrt nach 2 Sekunden zu "Apply" zurueck
  it.todo('should revert to Apply text after 2 seconds')

  // AC-6: Button disabled wenn kein Draft vorhanden
  it.todo('should be disabled when draftPrompt is null')

  // AC-7: Button disabled waehrend Applied-Feedback-Zustand
  it.todo('should be disabled during the 2-second applied feedback state')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/prompt-canvas-apply.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptCanvas - Apply Integration', () => {
  // AC-1: Apply uebertraegt Canvas-Felder an Workspace
  it.todo('should call setVariation with mapped canvas fields on apply click')

  // AC-8: Leere Felder werden als leerer String uebergeben
  it.todo('should pass empty string for empty canvas fields to setVariation')

  // AC-3: Sonner-Toast erscheint nach Apply
  it.todo('should show sonner toast with undo action after apply')

  // AC-4: Undo stellt vorherige Werte wieder her
  it.todo('should restore previous workspace values when undo is clicked in toast')
})
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-apply.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptAssistantContext - Apply Logic', () => {
  // AC-1: applyToWorkspace Funktion im Context verfuegbar
  it.todo('should provide applyToWorkspace function in context')

  // AC-4: Vorherige Werte werden vor Apply gesnapshoted
  it.todo('should snapshot current workspace values before applying new ones')

  // AC-4: undoApply stellt Snapshot wieder her
  it.todo('should restore snapshot values when undoApply is called')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-14-prompt-canvas-panel | `PromptCanvas` | Component | Rendert Canvas-Panel mit Textareas, nimmt Apply-Button als Child/Slot |
| slice-14-prompt-canvas-panel | `draftPrompt` | Context-Feld | `{ motiv: string, style: string, negativePrompt: string }` aus `PromptAssistantContext` |
| slice-14-prompt-canvas-panel | `hasCanvas` | Context-Feld | `boolean` -- Canvas sichtbar? |
| slice-10-core-chat-loop | `PromptAssistantContext` | React Context | Stellt `draftPrompt` und State-Management bereit |
| (existing) | `useWorkspaceVariation` | Hook | `{ variationData, setVariation, clearVariation }` aus `lib/workspace-state.tsx` |
| (existing) | `sonner` toast | Library | `toast(message, { action, duration })` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ApplyButton` | Component | slice-14 (eingebettet in Canvas) | `<ApplyButton />` (liest aus Context, kein Props-Interface) |
| `applyToWorkspace` | Context-Funktion | slice-15 intern, slice-20 (iterativer Loop) | `() => void` -- uebertraegt draftPrompt in Workspace |
| `isApplied` | Context-Feld | slice-20 (iterativer Loop) | `boolean` -- wurde der aktuelle Draft applied? |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/apply-button.tsx` -- Apply-Button mit Applied-Feedback-Zustand (2s Timer), disabled-Logik, Checkmark-Icon
- [ ] `components/assistant/prompt-canvas.tsx` (erweitert) -- Integration des ApplyButton am unteren Rand des Canvas-Panels
- [ ] `lib/assistant/assistant-context.tsx` (erweitert) -- applyToWorkspace Funktion, Undo-Snapshot-Logik, isApplied State, Sonner-Toast mit Undo-Callback
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Model-Recommendation Badge im Canvas (kommt in Slice 21)
- Dieser Slice implementiert KEINEN Re-Apply nach iterativer Verfeinerung (kommt in Slice 20)
- Dieser Slice implementiert KEINE automatische Sheet-Schliessung nach Apply
- Dieser Slice aendert NICHT die PromptArea Komponente -- die Integration laeuft ausschliesslich ueber den bestehenden `useWorkspaceVariation` Context

**Technische Constraints:**
- Feld-Mapping: Canvas `motiv` -> Workspace `promptMotiv`, Canvas `style` -> Workspace `promptStyle`, Canvas `negativePrompt` -> Workspace `negativePrompt`
- `setVariation()` erwartet ein vollstaendiges `WorkspaceVariationState` Objekt -- fehlende Felder (`modelId`, `modelParams`) muessen aus dem aktuellen `variationData` uebernommen werden
- Sonner-Toast mit `toast()` Funktion, `action` Property fuer den Undo-Button, `duration: 5000`
- Applied-Feedback-Timer via `setTimeout` mit Cleanup in `useEffect` return
- Undo-Snapshot speichert `{ promptMotiv, promptStyle, negativePrompt }` aus dem aktuellen `variationData` VOR dem Apply

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Quality Attributes" (Apply Reliability: Undo within 5s)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Applied State" (Apply-Button States, Undo-Toast)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Business Rules" (Apply-Verhalten, Undo-Toast)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Feature State Machine" (drafting -> applied Transition)
- Existing: `lib/workspace-state.tsx` -> `useWorkspaceVariation` Hook und `WorkspaceVariationState` Interface
