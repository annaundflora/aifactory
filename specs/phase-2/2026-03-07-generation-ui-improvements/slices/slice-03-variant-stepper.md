# Slice 03: VariantStepper Component

> **Slice 03 von 05** für `Generation UI Improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-variant-stepper` |
| **Test** | `pnpm test components/workspace/variant-stepper` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/variant-stepper` |
| **Integration Command** | `pnpm test` |
| **Acceptance Command** | `pnpm test` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Eigenständige React-Component `VariantStepper` implementieren: ein `[-] N [+]` Stepper mit kontrolliertem Wert im Bereich 1–4. Minus-Button ist bei Wert 1 disabled, Plus-Button bei Wert 4 disabled. Die Component wird später in `prompt-area.tsx` (Slice 02) als Ersatz für die bestehenden Variant-Count-Buttons eingebaut.

---

## Acceptance Criteria

1) GIVEN der VariantStepper mit `value=2` und einem `onChange`-Callback
   WHEN der Nutzer auf `[+]` klickt
   THEN wird `onChange(3)` aufgerufen

2) GIVEN der VariantStepper mit `value=2` und einem `onChange`-Callback
   WHEN der Nutzer auf `[-]` klickt
   THEN wird `onChange(1)` aufgerufen

3) GIVEN der VariantStepper mit `value=1`
   WHEN der Component rendert
   THEN ist der `[-]`-Button `disabled` und löst bei Klick kein `onChange` aus

4) GIVEN der VariantStepper mit `value=4`
   WHEN der Component rendert
   THEN ist der `[+]`-Button `disabled` und löst bei Klick kein `onChange` aus

5) GIVEN der VariantStepper mit `value=3`
   WHEN der Component rendert
   THEN zeigt die Component den Wert `3` sichtbar an und beide Buttons sind aktiv (nicht disabled)

6) GIVEN der VariantStepper mit `value=1`
   WHEN der Component rendert
   THEN ist der `[+]`-Button aktiv (nicht disabled)

7) GIVEN der VariantStepper mit `value=4`
   WHEN der Component rendert
   THEN ist der `[-]`-Button aktiv (nicht disabled)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `components/workspace/variant-stepper.test.tsx`

<test_spec>
```typescript
// AC-1: Plus-Button erhöht Wert
it.todo('should call onChange with value + 1 when plus button is clicked')

// AC-2: Minus-Button verringert Wert
it.todo('should call onChange with value - 1 when minus button is clicked')

// AC-3: Minus-Button bei Minimalwert 1 disabled
it.todo('should disable minus button when value is 1')

// AC-3: Minus-Button bei Wert 1 löst kein onChange aus
it.todo('should not call onChange when disabled minus button is clicked')

// AC-4: Plus-Button bei Maximalwert 4 disabled
it.todo('should disable plus button when value is 4')

// AC-4: Plus-Button bei Wert 4 löst kein onChange aus
it.todo('should not call onChange when disabled plus button is clicked')

// AC-5: Aktueller Wert ist sichtbar dargestellt
it.todo('should display the current value')

// AC-5: Beide Buttons aktiv bei Mittelwert
it.todo('should have both buttons enabled when value is between 1 and 4')

// AC-6: Plus-Button aktiv bei Minimalwert 1
it.todo('should have plus button enabled when value is 1')

// AC-7: Minus-Button aktiv bei Maximalwert 4
it.todo('should have minus button enabled when value is 4')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Abhängigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `VariantStepper` | Component | `slice-02-prompt-panel-layout` | `({ value: number; onChange: (value: number) => void }) => JSX.Element` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/variant-stepper.tsx` — Eigenständige Stepper-Component ([-] N [+]), Wert 1–4, Boundary-Buttons disabled
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein Layout-Kontext: Component kümmert sich nicht um Positionierung neben dem Generate-Button
- Kein interner State: Component ist vollständig controlled (Props `value` + `onChange`)
- Kein Styling-System-Eigenbau: Vorhandene Tailwind-Klassen und Button-Primitives nutzen

**Technische Constraints:**
- Wertebereich ist fix: Minimum 1, Maximum 4 (hardcoded, keine Props für range)
- Disabled-Verhalten: HTML `disabled` Attribut auf `<button>`, kein manueller Event-Guard nötig
- Client Component (`"use client"` nicht zwingend, da keine eigenen Hooks, aber props kommen von Parent)

**Referenzen:**
- Wireframes: `wireframes.md` → Screen: Prompt Panel, Annotation ⑪ + State Variations `stepper-min` / `stepper-max`
- Architecture: `architecture.md` → Component Architecture, New Files Tabelle
