# Slice 5: Tier Toggle Component

> **Slice 5 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-tier-toggle-component` |
| **Test** | `pnpm test components/ui/tier-toggle components/ui/max-quality-toggle` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-server-actions-model-settings"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/ui/tier-toggle components/ui/max-quality-toggle` |
| **Integration Command** | `pnpm test components/ui` |
| **Acceptance Command** | `pnpm test components/ui/tier-toggle components/ui/max-quality-toggle` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reine UI-Komponenten ohne externe Abhaengigkeiten) |

---

## Ziel

Zwei wiederverwendbare UI-Komponenten erstellen: `TierToggle` (Segmented Control mit Draft/Quality-Segmenten) und `MaxQualityToggle` (Toggle-Button, nur bei Quality sichtbar). Diese Komponenten werden in Slice 6-11 in Workspace Prompt-Area, Canvas Popovers und Canvas Chat Panel eingebaut.

---

## Acceptance Criteria

1) GIVEN eine `TierToggle`-Komponente mit `tier="draft"`
   WHEN sie gerendert wird
   THEN zeigt sie zwei Segmente "Draft" und "Quality", wobei "Draft" den aktiven Stil hat (`bg-primary text-primary-foreground`) und "Quality" den inaktiven Stil

2) GIVEN eine `TierToggle`-Komponente mit `tier="quality"`
   WHEN sie gerendert wird
   THEN hat "Quality" den aktiven Stil und "Draft" den inaktiven Stil

3) GIVEN eine `TierToggle`-Komponente mit `tier="draft"`
   WHEN der User auf das "Quality"-Segment klickt
   THEN wird `onTierChange("quality")` aufgerufen

4) GIVEN eine `TierToggle`-Komponente mit `tier="quality"`
   WHEN der User auf das "Draft"-Segment klickt
   THEN wird `onTierChange("draft")` aufgerufen

5) GIVEN eine `TierToggle`-Komponente mit `disabled={true}`
   WHEN der User auf ein Segment klickt
   THEN wird `onTierChange` NICHT aufgerufen und beide Segmente haben einen visuell deaktivierten Zustand (reduzierte Opacity)

6) GIVEN eine `MaxQualityToggle`-Komponente mit `maxQuality={false}`
   WHEN sie gerendert wird
   THEN zeigt sie einen Toggle-Button mit Label "Max Quality" im inaktiven Zustand

7) GIVEN eine `MaxQualityToggle`-Komponente mit `maxQuality={true}`
   WHEN sie gerendert wird
   THEN zeigt sie den Toggle-Button im aktiven/gepressten Zustand (visuell hervorgehoben)

8) GIVEN eine `MaxQualityToggle`-Komponente mit `maxQuality={false}`
   WHEN der User auf den Toggle klickt
   THEN wird `onMaxQualityChange(true)` aufgerufen

9) GIVEN eine `MaxQualityToggle`-Komponente mit `maxQuality={true}`
   WHEN der User auf den Toggle klickt
   THEN wird `onMaxQualityChange(false)` aufgerufen

10) GIVEN eine `MaxQualityToggle`-Komponente mit `disabled={true}`
    WHEN der User auf den Toggle klickt
    THEN wird `onMaxQualityChange` NICHT aufgerufen und der Button hat einen visuell deaktivierten Zustand

11) GIVEN eine `TierToggle`-Komponente
    WHEN sie mit `className="custom-class"` gerendert wird
    THEN wird die Custom-Class auf den aeusseren Container angewendet (Composability fuer verschiedene Einbau-Kontexte)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/ui/__tests__/tier-toggle.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('TierToggle', () => {
  // AC-1: Draft aktiv gerendert
  it.todo('should render Draft segment with active styling when tier is draft')

  // AC-2: Quality aktiv gerendert
  it.todo('should render Quality segment with active styling when tier is quality')

  // AC-3: Klick auf Quality ruft onTierChange
  it.todo('should call onTierChange with quality when Quality segment is clicked')

  // AC-4: Klick auf Draft ruft onTierChange
  it.todo('should call onTierChange with draft when Draft segment is clicked')

  // AC-5: Disabled-State verhindert Interaktion
  it.todo('should not call onTierChange when disabled and segment is clicked')

  // AC-11: Custom className
  it.todo('should apply custom className to outer container')
})
```
</test_spec>

### Test-Datei: `components/ui/__tests__/max-quality-toggle.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('MaxQualityToggle', () => {
  // AC-6: Inaktiver Zustand
  it.todo('should render toggle button with label Max Quality in inactive state')

  // AC-7: Aktiver Zustand
  it.todo('should render toggle button in active/pressed state when maxQuality is true')

  // AC-8: Klick aktiviert Toggle
  it.todo('should call onMaxQualityChange with true when clicked while inactive')

  // AC-9: Klick deaktiviert Toggle
  it.todo('should call onMaxQualityChange with false when clicked while active')

  // AC-10: Disabled-State verhindert Interaktion
  it.todo('should not call onMaxQualityChange when disabled and button is clicked')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03` | `Tier` | Type | `"draft" \| "quality" \| "max"` -- fuer Props-Typisierung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `TierToggle` | React Component | slice-06, slice-09, slice-10, slice-11 | `<TierToggle tier={Tier} onTierChange={(tier: Tier) => void} disabled?: boolean className?: string />` |
| `MaxQualityToggle` | React Component | slice-06, slice-09, slice-11 | `<MaxQualityToggle maxQuality={boolean} onMaxQualityChange={(value: boolean) => void} disabled?: boolean />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/tier-toggle.tsx` -- Neue Datei: Segmented Control mit Draft/Quality-Segmenten, Props fuer tier, onTierChange, disabled, className
- [ ] `components/ui/max-quality-toggle.tsx` -- Neue Datei: Toggle-Button "Max Quality", Props fuer maxQuality, onMaxQualityChange, disabled
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Einbindung in Prompt-Area, Canvas Popovers oder Chat Panel (kommen in Slice 6, 9, 10, 11)
- KEINE State-Logik fuer Tier-Auswahl (Konsumenten verwalten State selbst via `useState`)
- KEINE Model-Resolution oder Settings-Fetch-Logik
- KEINE Sichtbarkeitslogik fuer MaxQualityToggle (Konsumenten entscheiden via conditional rendering wann die Komponente angezeigt wird)

**Technische Constraints:**
- Client Component (`"use client"`)
- Visuelles Pattern von `mode-selector.tsx` uebernehmen: Segmented Control mit `bg-primary text-primary-foreground` fuer aktives Segment
- `TierToggle` hat exakt 2 Segmente (Draft, Quality) -- `max` wird nicht als Segment dargestellt (Max Quality ist ein separater Toggle)
- `MaxQualityToggle` nutzt Shadcn `Toggle` oder `Button` mit `pressed`/`aria-pressed` Semantik
- Tailwind CSS fuer Styling (bestehendes Pattern)

**Referenzen:**
- Visuelles Pattern: `components/workspace/mode-selector.tsx` (Segmented Control Implementierung)
- Tier-Toggle Platzierung und States: `wireframes.md` -> Section "Screen: Workspace Prompt-Area" + "Screen: Canvas Tool Popovers" + "Screen: Canvas Chat Panel"
- State-Varianten: `wireframes.md` -> "State Variations" Tabellen (draft-selected, quality-selected, generating)
- Typ `Tier`: `lib/types.ts` (aus Slice 3)
