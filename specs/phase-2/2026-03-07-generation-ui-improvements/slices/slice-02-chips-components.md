# Slice 02: AspectRatioChips + SizeChips Components

> **Slice 02 von 5** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-chips-components` |
| **Test** | `pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-aspect-ratio-utils"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx` |
| **Acceptance Command** | `pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Zwei isolierte Toggle-Chip-Group-Komponenten erstellen: `AspectRatioChips` (mit eingebettetem `CustomRatioInput`) und `SizeChips`. Beide Komponenten sind vollstaendig eigenstaendig testbar ohne Integration in `prompt-area.tsx` und bilden die primaere UI-Steuerung fuer Aspect Ratio und Bildgroesse.

---

## Acceptance Criteria

1) GIVEN `AspectRatioChips` mit `ratios={["1:1", "16:9", "9:16"]}` und `selected="16:9"`
   WHEN die Komponente gerendert wird
   THEN werden alle drei Chips gerendert und der Chip mit Wert `"16:9"` hat den aktiven State (erkennbar an `aria-pressed="true"` oder `data-active` Attribut)

2) GIVEN `AspectRatioChips` mit einem `disabledRatios={["9:16"]}` und `modelName="FLUX 1.1"`
   WHEN der Benutzer mit der Maus ueber den disabled Chip `"9:16"` hovert
   THEN wird ein Tooltip mit dem Text `"Not available for FLUX 1.1"` angezeigt und `onSelect` wird bei Klick nicht aufgerufen

3) GIVEN `AspectRatioChips` mit einem Chip fuer `"Custom"` und `selected="Custom"`
   WHEN der Custom-Chip selektiert ist
   THEN wird der `CustomRatioInput` (ein Text-Eingabefeld) unterhalb der Chips angezeigt; bei `selected !== "Custom"` ist das Eingabefeld nicht im DOM

4) GIVEN `CustomRatioInput` ist sichtbar und der Benutzer gibt `"0:5"` ein
   WHEN die Eingabe validiert wird (on blur oder on change)
   THEN wird eine Fehlermeldung `"Ungueltiges Format (z.B. 21:9)"` angezeigt und das Eingabefeld erhaelt einen visuellen Fehler-State (z.B. roten Rahmen)

5) GIVEN `CustomRatioInput` ist sichtbar und der Benutzer gibt `"21:9"` ein
   WHEN die Eingabe validiert wird
   THEN wird keine Fehlermeldung angezeigt und `onCustomRatioChange("21:9")` wird aufgerufen

6) GIVEN `SizeChips` mit `sizes={["xs", "s", "m", "l", "xl"]}` und `selected="m"`
   WHEN die Komponente gerendert wird
   THEN werden alle fuenf Chips gerendert, jeder Chip zeigt sowohl den Label (`m`) als auch den Pixelwert (`1024`) an, und der Chip `"m"` hat den aktiven State

7) GIVEN `SizeChips` mit `disabledSizes={["xl"]}` und `modelName="SD XL"`
   WHEN der Benutzer mit der Maus ueber den disabled Chip `"xl"` hovert
   THEN wird ein Tooltip mit dem Text `"Not available for SD XL"` angezeigt und `onSelect` wird bei Klick nicht aufgerufen

8) GIVEN `AspectRatioChips` mit `onSelect` Callback und einem aktivierbaren Chip `"4:3"`
   WHEN der Benutzer auf den Chip `"4:3"` klickt
   THEN wird `onSelect("4:3")` genau einmal aufgerufen

9) GIVEN `SizeChips` mit `onSelect` Callback und einem aktivierbaren Chip `"l"`
   WHEN der Benutzer auf den Chip `"l"` klickt
   THEN wird `onSelect("l")` genau einmal aufgerufen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/aspect-ratio-chips.test.tsx`

<test_spec>
```typescript
// AC-1: Chips rendern, ausgewaehlter Chip hat aktiven State
it.todo('should render all ratio chips and mark selected chip as active')

// AC-2: Disabled Chip zeigt Tooltip mit Modellname, onSelect nicht aufgerufen
it.todo('should show tooltip with model name on disabled chip hover and not call onSelect')

// AC-3: Custom-Chip zeigt/verbirgt CustomRatioInput
it.todo('should show CustomRatioInput when Custom chip is selected and hide it otherwise')

// AC-4: CustomRatioInput zeigt Validierungsfehler fuer "0:5"
it.todo('should display validation error message for invalid ratio input "0:5"')

// AC-5: CustomRatioInput ruft onCustomRatioChange fuer gueltigen Wert auf
it.todo('should call onCustomRatioChange with value when valid ratio "21:9" is entered')

// AC-8: Klick auf aktivierbaren Chip ruft onSelect auf
it.todo('should call onSelect with ratio value when an enabled chip is clicked')
```
</test_spec>

### Test-Datei: `components/workspace/size-chips.test.tsx`

<test_spec>
```typescript
// AC-6: SizeChips rendern mit Label + Pixelwert, ausgewaehlter Chip aktiv
it.todo('should render all size chips with label and pixel value, mark selected chip as active')

// AC-7: Disabled SizeChip zeigt Tooltip mit Modellname, onSelect nicht aufgerufen
it.todo('should show tooltip with model name on disabled size chip hover and not call onSelect')

// AC-9: Klick auf aktivierbaren Size-Chip ruft onSelect auf
it.todo('should call onSelect with size key when an enabled chip is clicked')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-aspect-ratio-utils` | `validateCustomRatio` | Function | Import aus `lib/aspect-ratio.ts` muss aufloesbar sein |
| `slice-01-aspect-ratio-utils` | `SIZE_PRESETS` | Const | Import aus `lib/aspect-ratio.ts`, Werte xs=512 s=768 m=1024 l=1536 xl=2048 |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `AspectRatioChips` | Component | slice-03 (PromptArea) | `({ ratios, selected, disabledRatios, modelName, onSelect, onCustomRatioChange }) => JSX` |
| `SizeChips` | Component | slice-03 (PromptArea) | `({ sizes, selected, disabledSizes, modelName, onSelect }) => JSX` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/aspect-ratio-chips.tsx` — Toggle-Chip-Group fuer Aspect Ratios mit eingebettetem CustomRatioInput
- [ ] `components/workspace/size-chips.tsx` — Toggle-Chip-Group fuer Bildgroessen (xs/s/m/l/xl) mit Pixelwert-Anzeige
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Integration in `prompt-area.tsx` — Komponenten sind isoliert und werden in Slice 03 eingebunden
- Kein Laden von Model-Schemas — `ratios`, `disabledRatios`, `sizes`, `disabledSizes` werden als Props uebergeben
- Kein globaler State — Komponenten sind kontrolliert (controlled components via Props)

**Technische Constraints:**
- Tooltip fuer disabled Chips via `radix-ui Tooltip` (bereits in `radix-ui@1.4.3` vorhanden)
- `CustomRatioInput` nutzt `validateCustomRatio` aus `lib/aspect-ratio.ts` fuer Client-seitige Validierung
- `SizeChips` nutzt `SIZE_PRESETS` aus `lib/aspect-ratio.ts` fuer Pixelwert-Anzeige
- Beide Komponenten sind `"use client"` Komponenten

**Referenzen:**
- Wireframes: `specs/phase-2/2026-03-07-generation-ui-improvements/wireframes.md` → Screen: Prompt Panel, Annotations ⑦⑧⑨, State Variations (ratio-chip-disabled, custom-ratio-active, custom-ratio-error, size-chip-disabled)
- Architecture: `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md` → Component Architecture (New Component Tree), Technology Decisions (Chip tooltips via radix-ui Tooltip)
