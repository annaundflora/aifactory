# Slice 18: Improve Modal UI

> **Slice 18** fuer `Quality Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-18-improve-modal-ui` |
| **Test** | `pnpm test components/prompt-improve` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/prompt-improve` |
| **Integration Command** | `pnpm test components/workspace` |
| **Acceptance Command** | `pnpm test --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Die bestehende Inline-LLM-Comparison-Ansicht in ein shadcn Dialog (Modal) umbauen. Side-by-Side Layout mit Loading-Skeleton, Modell-Badge ("Optimized for: {Modellname}") und Adopt/Discard Buttons. Der Improve-Button in `prompt-area.tsx` uebergibt die ausgewaehlte `modelId` an die Comparison-Komponente.

---

## Acceptance Criteria

1) GIVEN der User hat einen Prompt im Motiv-Feld eingegeben und ein Modell ausgewaehlt
   WHEN der User auf "Improve" klickt
   THEN oeffnet sich ein shadcn Dialog (Modal) mit dem Titel "Improve Prompt" und einem Close-Button (X)

2) GIVEN das Improve-Modal ist geoeffnet und der LLM-Call laeuft
   WHEN der User wartet
   THEN zeigt die linke Spalte den Original-Prompt-Text und die rechte Spalte Skeleton-Platzhalter, dazu ein Spinner mit Text "Improving prompt..."

3) GIVEN der LLM-Call ist erfolgreich abgeschlossen
   WHEN das Ergebnis angezeigt wird
   THEN zeigt das Modal Side-by-Side: links "Original" (read-only), rechts "Improved" (read-only), darunter ein Badge "Optimized for: {Modell-DisplayName}" (z.B. "Optimized for: FLUX 2 Pro")

4) GIVEN das Modal zeigt den Side-by-Side Vergleich
   WHEN der User auf "Adopt" klickt
   THEN wird der improved Prompt ins Prompt-Feld uebernommen und das Modal schliesst sich

5) GIVEN das Modal zeigt den Side-by-Side Vergleich
   WHEN der User auf "Discard" klickt
   THEN schliesst sich das Modal ohne Aenderungen am Prompt-Feld

6) GIVEN der LLM-Call schlaegt fehl
   WHEN ein Fehler auftritt
   THEN wird ein Toast "Prompt-Verbesserung fehlgeschlagen" angezeigt und das Modal schliesst automatisch

7) GIVEN der Improve-Button in prompt-area.tsx
   WHEN der User auf "Improve" klickt
   THEN wird die aktuell ausgewaehlte `modelId` (aus dem Model-Dropdown) an die LLMComparison-Komponente uebergeben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/prompt-improve/__tests__/llm-comparison.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LLMComparison Modal', () => {
  // AC-1: Modal oeffnet sich mit Titel und Close-Button
  it.todo('should render as a shadcn Dialog with title "Improve Prompt" and close button')

  // AC-2: Loading-State mit Original links und Skeleton rechts
  it.todo('should show original prompt on left and skeleton placeholders on right during loading')

  // AC-3: Side-by-Side mit Modell-Badge nach erfolgreichem LLM-Call
  it.todo('should display side-by-side comparison with "Optimized for: {modelName}" badge after success')

  // AC-4: Adopt uebernimmt improved Prompt und schliesst Modal
  it.todo('should call onAdopt with improved text and close modal when Adopt is clicked')

  // AC-5: Discard schliesst Modal ohne Aenderung
  it.todo('should call onDiscard and close modal when Discard is clicked')

  // AC-6: Fehler zeigt Toast und schliesst Modal
  it.todo('should show error toast and close modal when LLM call fails')

  // AC-7: modelId wird von prompt-area uebergeben
  it.todo('should receive modelId prop and pass it to improvePrompt action')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (existing) | `improvePrompt(input)` | Server Action | Action akzeptiert `{ prompt, modelId }` — modelId ist neuer Parameter |
| (existing) | `Dialog` | shadcn Component | `components/ui/dialog.tsx` muss installiert sein |
| (existing) | `MODELS` | Config Array | `lib/models.ts` — fuer modelId zu displayName Mapping |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `LLMComparison` | React Component | `prompt-area.tsx` | `(props: { prompt: string, modelId: string, modelDisplayName: string, onAdopt: (improved: string) => void, onDiscard: () => void }) => JSX.Element` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/prompt-improve/llm-comparison.tsx` — Modal statt Inline, Side-by-Side Layout, Skeleton Loading, Modell-Badge, Adopt/Discard
- [ ] `components/workspace/prompt-area.tsx` — Improve-Button uebergibt `modelId` und `modelDisplayName` an LLMComparison
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Umbau der `improvePrompt` Server Action (modelId-Erweiterung ist separater Slice/Task)
- KEINE Aenderung am Prompt-Service oder System-Prompt
- KEIN Umbau des Prompt-Feldes auf strukturierte Felder (Motiv/Style/Negative)
- NUR UI-Umbau der Comparison-Komponente und Integration in prompt-area

**Technische Constraints:**
- Nutze shadcn `Dialog` Komponente (nicht custom Modal)
- `MODELS` Array aus `lib/models.ts` fuer modelId-zu-DisplayName Mapping
- Behalte `useTransition` + `useEffect` Pattern fuer den LLM-Call bei
- Loading-Skeleton via bestehender shadcn `Skeleton` Komponente

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` → Section "Data Flow: Adaptive Improve", Migration Map #9
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` → Section "Screen: Improve Comparison (Modal)"
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` → Flow 3 (Improve nutzen), UI Components & States
