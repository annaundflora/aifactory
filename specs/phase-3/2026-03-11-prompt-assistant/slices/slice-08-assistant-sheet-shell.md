# Slice 08: Assistant Sheet Shell + Trigger Button

> **Slice 8 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-assistant-sheet-shell` |
| **Test** | `pnpm test components/assistant/__tests__/assistant-sheet.test.tsx components/assistant/__tests__/assistant-trigger.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-legacy-cleanup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/assistant/__tests__` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Erstelle die leere UI-Shell fuer den Prompt-Assistenten: ein Trigger-Button (Sparkles Icon) in der PromptArea und eine Sheet-Component die von rechts einfliest (480px breit). Noch kein Chat-Inhalt -- nur die Grundstruktur mit open/close State, damit nachfolgende Slices (09: Startscreen, 10: Chat Loop) darauf aufbauen koennen.

---

## Acceptance Criteria

1) GIVEN die PromptArea wird gerendert (nach Slice 07 Legacy Cleanup)
   WHEN der User die PromptArea betrachtet
   THEN ist ein Button mit dem Sparkles Icon (`data-testid="assistant-trigger-btn"`) sichtbar, an der Position wo vorher der Builder-Button war

2) GIVEN der AssistantSheet ist geschlossen (Initialzustand)
   WHEN der User auf den Sparkles-Trigger-Button klickt
   THEN oeffnet sich ein Sheet von rechts mit einer festen Breite von 480px, und der Trigger-Button zeigt einen aktiven/hervorgehobenen Zustand

3) GIVEN der AssistantSheet ist geoeffnet
   WHEN der User den Sheet-Header betrachtet
   THEN zeigt der Header den Titel "Prompt Assistent" und einen Close-Button (X Icon)

4) GIVEN der AssistantSheet ist geoeffnet
   WHEN der User auf den Close-Button (X) klickt
   THEN schliesst sich das Sheet mit Slide-out-Animation nach rechts, und der Trigger-Button kehrt in den Default-Zustand zurueck

5) GIVEN der AssistantSheet ist geoeffnet
   WHEN der User die Escape-Taste drueckt
   THEN schliesst sich das Sheet (identisches Verhalten wie AC-4)

6) GIVEN der AssistantSheet ist geoeffnet
   WHEN der User auf den Trigger-Button klickt (Toggle-Verhalten)
   THEN schliesst sich das Sheet

7) GIVEN der AssistantSheet wurde soeben geoeffnet
   WHEN der Focus-State geprueft wird
   THEN liegt der Focus innerhalb des Sheets (nicht auf dem Trigger-Button)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/assistant-trigger.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('AssistantTrigger', () => {
  // AC-1: Sparkles-Button in PromptArea sichtbar
  it.todo('should render a button with data-testid="assistant-trigger-btn" and Sparkles icon')

  // AC-2: Klick oeffnet Sheet
  it.todo('should call onOpenChange(true) when clicked while sheet is closed')

  // AC-6: Toggle-Verhalten
  it.todo('should call onOpenChange(false) when clicked while sheet is open')

  // AC-2: Aktiver Zustand wenn Sheet offen
  it.todo('should render with active/highlighted styling when isOpen is true')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/assistant-sheet.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('AssistantSheet', () => {
  // AC-2: Sheet oeffnet sich von rechts mit 480px
  it.todo('should render sheet content with 480px width when open is true')

  // AC-3: Header mit Titel und Close-Button
  it.todo('should display "Prompt Assistent" title and close button in header')

  // AC-4: Close-Button schliesst Sheet
  it.todo('should call onOpenChange(false) when close button is clicked')

  // AC-5: Escape schliesst Sheet
  it.todo('should call onOpenChange(false) when Escape key is pressed')

  // AC-7: Focus innerhalb des Sheets
  it.todo('should move focus inside the sheet when opened')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-07-legacy-cleanup | Bereinigte `prompt-area.tsx` (ohne BuilderDrawer/TemplateSelector) | Component | Import kompiliert, kein BuilderDrawer-Import vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `AssistantSheet` | Component | slice-09 (Startscreen), slice-14 (Canvas), slice-19 (Iterativer Loop) | `<AssistantSheet open={boolean} onOpenChange={(open: boolean) => void}>` mit children-Slot |
| `AssistantTrigger` | Component | (intern in prompt-area.tsx) | `<AssistantTrigger isOpen={boolean} onClick={() => void}>` |
| Sheet open/close State | React State | slice-09, slice-10 | `open: boolean` + `onOpenChange` Callback in prompt-area.tsx |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/assistant-sheet.tsx` -- Sheet-Shell von rechts (480px breit), Header mit Titel + Close-Button, children-Slot fuer zukuenftige Inhalte
- [ ] `components/assistant/assistant-trigger.tsx` -- Sparkles Icon Button mit active/default State
- [ ] `components/workspace/prompt-area.tsx` -- Erweitert: AssistantTrigger + AssistantSheet integriert, open/close State
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINEN Chat-Inhalt, keine Suggestion-Chips, keinen Chat-Input (kommt in Slice 09)
- Dieser Slice implementiert KEINEN Model-Selector und KEINEN Session-Switcher im Header (kommt in Slice 09 bzw. 13c)
- Dieser Slice implementiert KEINE dynamische Breite (480px -> 780px Split-View kommt in Slice 14)
- Das Sheet zeigt nur den Header und einen leeren Body (children-Slot)

**Technische Constraints:**
- Nutze die bestehende Sheet Component (`components/ui/sheet.tsx`) als Basis (Radix Dialog-basiert)
- Sheet oeffnet von rechts (`side="right"`) mit fester Breite 480px (kein `sm:max-w-sm`, sondern explizit `w-[480px]`)
- Trigger-Button nutzt Sparkles Icon aus `lucide-react` (bereits importiert in prompt-area.tsx)
- `data-testid="assistant-trigger-btn"` am Trigger-Button fuer Testbarkeit
- Trigger-Button positioniert an der Stelle des ehemaligen Builder-Buttons (Zeile ~979 in prompt-area.tsx)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Architecture Layers" (Sheet Component)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Workspace Trigger" + "Screen: Startscreen" (nur Header-Struktur relevant)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (`assistant-trigger-btn`, `assistant-sheet`)
