# Slice 11: Variation Popover

> **Slice 11 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-variation-popover` |
| **Test** | `pnpm test components/canvas/__tests__/variation-popover.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-toolbar-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/variation-popover.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/variation-popover.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Schwebendes Radix Popover neben dem Variation-Icon der Toolbar rendern. Das Popover enthaelt ein vorausgefuelltes Prompt-Feld, einen Strength-Dropdown (Subtle/Balanced/Creative), einen Count-Selector (1-4) und einen Generate-Button. Dieses Slice ist rein UI — die Action-Anbindung (Server Action aufrufen) erfolgt in Slice 14.

---

## Acceptance Criteria

1) GIVEN `activeToolId` ist `"variation"` im CanvasDetailContext und die aktuelle Generation hat `prompt: "A beautiful sunset over mountains"`
   WHEN das Popover gerendert wird
   THEN ist das Popover sichtbar, positioniert neben dem Variation-Toolbar-Icon, und das Prompt-Textarea ist mit `"A beautiful sunset over mountains"` vorausgefuellt

2) GIVEN das Variation-Popover ist sichtbar
   WHEN der User den Prompt-Text auf `"A dramatic sunset over mountains"` aendert
   THEN enthaelt das Textarea den neuen Text `"A dramatic sunset over mountains"`

3) GIVEN das Variation-Popover ist sichtbar
   WHEN der User den Strength-Dropdown oeffnet
   THEN zeigt er genau 3 Optionen: "Subtle", "Balanced", "Creative"

4) GIVEN das Variation-Popover ist sichtbar und Strength ist initial `"Balanced"`
   WHEN der User `"Creative"` aus dem Dropdown waehlt
   THEN zeigt der Dropdown den Wert `"Creative"` an

5) GIVEN das Variation-Popover ist sichtbar
   WHEN das Popover gerendert wird
   THEN zeigt der Count-Selector 4 Buttons mit den Werten `1`, `2`, `3`, `4` und der Wert `1` ist initial selektiert

6) GIVEN der Count-Selector zeigt `1` als selektiert
   WHEN der User auf den Button `3` klickt
   THEN ist `3` visuell selektiert und der vorherige Wert `1` ist deselektiert

7) GIVEN das Variation-Popover ist sichtbar mit Prompt, Strength und Count
   WHEN der User auf den Generate-Button klickt
   THEN wird ein `onGenerate`-Callback aufgerufen mit `{ prompt: string, strength: "subtle" | "balanced" | "creative", count: number }` und das Popover schliesst sich (`activeToolId` wird auf `null` gesetzt)

8) GIVEN das Variation-Popover ist sichtbar
   WHEN der User ausserhalb des Popovers klickt
   THEN schliesst sich das Popover (`activeToolId` wird auf `null` gesetzt)

9) GIVEN `activeToolId` ist nicht `"variation"` (z.B. `null` oder `"img2img"`)
   WHEN die Komponente gerendert wird
   THEN ist das Popover nicht sichtbar (kein DOM-Element fuer Popover-Content)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/variation-popover.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('VariationPopover', () => {
  // AC-1: Popover sichtbar mit vorausgefuelltem Prompt
  it.todo('should render popover with pre-filled prompt when activeToolId is "variation"')

  // AC-2: Prompt editierbar
  it.todo('should allow editing the prompt text')

  // AC-3: Strength-Dropdown zeigt 3 Optionen
  it.todo('should show Subtle, Balanced, Creative options in strength dropdown')

  // AC-4: Strength-Wert aenderbar
  it.todo('should update strength value when a different option is selected')

  // AC-5: Count-Selector zeigt 1-4 mit initial 1
  it.todo('should render count selector with buttons 1-4 and initial selection of 1')

  // AC-6: Count-Wert aenderbar
  it.todo('should update selected count when a different count button is clicked')

  // AC-7: Generate-Button ruft Callback mit korrekten Werten auf
  it.todo('should call onGenerate with prompt, strength, and count and close popover')

  // AC-8: Klick ausserhalb schliesst Popover
  it.todo('should close popover when clicking outside')

  // AC-9: Popover unsichtbar wenn nicht aktiv
  it.todo('should not render popover content when activeToolId is not "variation"')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.activeToolId`, `dispatch({ type: 'SET_ACTIVE_TOOL', payload: null })` |
| `slice-07-toolbar-ui` | `activeToolId === "variation"` | Context State | Popover oeffnet wenn Toolbar-Button Variation aktiviert |
| `slice-05-detail-view-shell` | Aktuelle Generation (prompt) | Prop/Context | `generation.prompt` fuer Prompt-Prefill |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `VariationPopover` | React Component | `slice-05` / `slice-14` | `<VariationPopover generation={Generation} onGenerate={(params: VariationParams) => void} />` |
| `VariationParams` | TypeScript Type | `slice-14` | `{ prompt: string, strength: "subtle" \| "balanced" \| "creative", count: number }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/variation-popover.tsx` -- Radix Popover mit Prompt-Textarea, Strength-Select, Count-Selector (1-4), Generate-Button
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Action aufrufen (Generate-Button ruft nur `onGenerate`-Callback auf, Anbindung in Slice 14)
- KEINE Loading-States oder Generating-Overlay (Slice 14)
- KEINE Model-Auswahl im Popover (Model kommt aus Header-Selector, Slice 14)
- KEIN img2img/Upscale-Popover (Slices 12 und 13)

**Technische Constraints:**
- `"use client"` Direktive
- Radix Popover aus `components/ui/popover.tsx` (existiert im Projekt)
- Radix Select aus `components/ui/select.tsx` fuer Strength-Dropdown (existiert im Projekt)
- Variation ist technisch img2img mit aktuellem Bild als einzigem Input (keine Reference-Roles) — dieses Detail ist fuer Slice 14 relevant, nicht fuer dieses UI-Slice
- Popover-Positionierung: `side="right"` relativ zum Toolbar-Anchor

**Referenzen:**
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` -> "Screen: Variation Popover" fuer Layout und Annotations
- Discovery: `discovery.md` -> "UI Components & States" -> `popover.variation` fuer States und Verhalten
- Discovery: `discovery.md` -> Q&A #23: Variation = img2img mit prompt_strength Slider (Subtle/Balanced/Creative)
- Architecture: `architecture.md` -> Section "Integrations" fuer Radix UI Version (1.4.3)
