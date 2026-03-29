# Slice 7: ModelSlots UI -- Compact Layout

> **Slice 7 von 7** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-model-slots-ui-compact` |
| **Test** | `pnpm test components/ui/model-slots` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-model-slots-ui-stacked"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/ui/model-slots` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions via Vitest mocks) |

---

## Ziel

Den Compact-Layout-Branch in der bestehenden `ModelSlots`-Komponente ausbauen. Im Compact-Mode werden alle 3 Slots horizontal in einer Zeile dargestellt, Model-Namen werden auf eine Kurzform truncated und ParameterPanels werden nie gerendert. Optimiert fuer den schmalen Chat-Panel-Bereich.

---

## Acceptance Criteria

1) GIVEN die ModelSlots-Komponente wird mit `variant="compact"` und 3 Slots gerendert
   WHEN die Komponente sichtbar ist
   THEN werden alle 3 Slots horizontal in einer einzigen Zeile dargestellt (Flex-Row)
   AND die Gesamthoehe der Komponente ist eine einzelne Zeile (kein vertikales Stacking)

2) GIVEN `variant="compact"` und Slot 1 hat Model "black-forest-labs/flux-schnell" (display name "Flux Schnell")
   WHEN die Komponente rendert
   THEN wird der Model-Name im Dropdown-Trigger auf maximal ~12-15 Zeichen truncated mit Ellipsis
   AND der volle Model-Name ist im geoeffneten Dropdown sichtbar (nicht truncated)

3) GIVEN `variant="compact"` und Slot 1 ist active
   WHEN die Komponente rendert
   THEN wird KEIN ParameterPanel unterhalb oder neben dem Slot gerendert
   AND dies gilt unabhaengig davon ob das Model ein Schema hat

4) GIVEN `variant="compact"` und Slot 3 hat kein Model zugewiesen
   WHEN die Komponente rendert
   THEN zeigt der Dropdown-Trigger einen kurzen Placeholder (z.B. "--" oder aehnlich kompakt)
   AND die Checkbox ist disabled (identisch zum Stacked-Verhalten)

5) GIVEN `variant="compact"` und nur Slot 1 ist active
   WHEN der User versucht Slot 1 zu unchecken
   THEN bleibt Slot 1 checked (min-1-active Regel, identisch zum Stacked-Verhalten)

6) GIVEN `variant="compact"` und der User oeffnet das Dropdown von Slot 2
   WHEN das Dropdown-Menu erscheint
   THEN zeigt es die vollen Model-Namen (nicht truncated) in normaler Groesse
   AND es werden nur mode-kompatible Models angezeigt (identisch zum Stacked-Verhalten)

7) GIVEN `variant="compact"` und der User waehlt ein Model auf einem leeren Slot
   WHEN `updateModelSlot` erfolgreich zurueckgibt
   THEN wird der Slot auto-aktiviert (Checkbox checked)
   AND ein `"model-slots-changed"` CustomEvent wird dispatcht
   AND das Verhalten ist identisch zum Stacked-Layout

8) GIVEN `variant="compact"` und `disabled={true}`
   WHEN die Komponente rendert
   THEN sind alle Checkboxen und Dropdowns disabled
   AND die visuelle Darstellung bleibt horizontal einzeilig

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/ui/__tests__/model-slots-compact.test.tsx`

<test_spec>
```typescript
// AC-1: Compact-Variante rendert alle Slots horizontal in einer Zeile
it.todo('should render all 3 slots in a single horizontal row when variant is compact')

// AC-2: Model-Namen werden im Trigger truncated, im Dropdown vollstaendig angezeigt
it.todo('should truncate model name in dropdown trigger and show full name in open dropdown')

// AC-3: Compact-Variante rendert niemals ParameterPanels
it.todo('should not render any ParameterPanel in compact variant regardless of active state')

// AC-4: Leerer Slot zeigt kompakten Placeholder und disabled Checkbox
it.todo('should show compact placeholder for empty slot with disabled checkbox')

// AC-5: Min-1-active Regel greift auch im Compact-Layout
it.todo('should prevent unchecking the last active slot in compact variant')

// AC-6: Dropdown zeigt volle Model-Namen und nur kompatible Models
it.todo('should show full model names and only mode-compatible models in compact dropdown')

// AC-7: Auto-Aktivierung und Event-Dispatch funktionieren im Compact-Layout
it.todo('should auto-activate slot and dispatch model-slots-changed event on model selection')

// AC-8: Disabled-Prop deaktiviert alle Controls im Compact-Layout
it.todo('should disable all checkboxes and dropdowns when disabled prop is true in compact variant')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-model-slots-ui-stacked` | `ModelSlots` Komponente | React Component | Datei existiert, exportiert `ModelSlots` |
| `slice-06-model-slots-ui-stacked` | `ModelSlotsProps` | TypeScript Interface | `variant` Prop akzeptiert `"compact"` |
| `slice-05-server-actions` | `updateModelSlot(input)` | Server Action | Import kompiliert |
| `slice-05-server-actions` | `toggleSlotActive(input)` | Server Action | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelSlots` (compact-faehig) | React Component | Chat Panel Integration | `<ModelSlots variant="compact" mode={mode} slots={slots} models={models} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/model-slots.tsx` -- MODIFY: Compact-Layout-Branch ausbauen. Horizontales Flex-Row-Layout, truncated Model-Namen im Trigger, kein ParameterPanel-Rendering, kompakter Placeholder fuer leere Slots.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an Consumer-Dateien (canvas-chat-panel.tsx, Popovers, prompt-area.tsx) -- Chat-Panel-Integration ist ein separater Slice
- KEINE neuen Props hinzufuegen die nicht bereits in `ModelSlotsProps` aus Slice 06 definiert sind
- KEINE Aenderungen an der Stacked-Variante (alle bestehenden Stacked-ACs aus Slice 06 muessen weiterhin bestehen)
- KEINE Aenderungen an Server Actions, Services, DB-Schema oder Types
- KEIN ParameterPanel-Rendering im Compact-Mode -- auch nicht als Tooltip oder Popover

**Technische Constraints:**
- Compact-Branch wird durch `variant="compact"` Prop gesteuert (gleicher Prop wie in Slice 06 definiert)
- Truncation via CSS (`text-overflow: ellipsis` / Tailwind `truncate`), NICHT via JavaScript String-Manipulation
- Horizontales Layout via Tailwind Flex-Row (`flex flex-row`) mit Gap zwischen Slots
- Jeder Slot im Compact-Mode: Checkbox + Dropdown-Trigger in einer kompakten Inline-Anordnung
- Dropdown-Menu (geoeffnet) zeigt volle Model-Namen unabhaengig von der Truncation im Trigger
- Alle Slot-Interaktionen (Toggle, Dropdown-Auswahl, Auto-Aktivierung, Event-Dispatch) sind identisch zum Stacked-Layout -- nur das visuelle Rendering aendert sich

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/model-slots.tsx` | MODIFY: Compact-Branch innerhalb der bestehenden Komponente ausbauen |
| `components/ui/select.tsx` | Import: Radix Select Wrapper, unveraendert |
| `components/ui/checkbox.tsx` | Import: Radix Checkbox Wrapper, unveraendert |

**Referenzen:**
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Canvas Chat Panel" (Compact Layout, Annotation 1)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Regeln" (Layout-Varianten: Compact = horizontale Einzeiler mit gekuerzten Model-Namen, ohne Parameter)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> `canvas-chat-panel.tsx` (Compact-Layout Consumer)
