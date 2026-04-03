# Slice 6: ModelSlots UI -- Stacked Layout

> **Slice 6 von 7** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-model-slots-ui-stacked` |
| **Test** | `pnpm test components/ui/model-slots` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-server-actions"]` |

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
| **Mocking Strategy** | `mock_external` (Server Actions + useModelSchema via Vitest mocks) |

---

## Ziel

Neue `ModelSlots` React-Komponente mit Stacked- und Compact-Layout erstellen. Die Komponente rendert 3 Slot-Zeilen mit Radix Checkbox + Radix Select, filtert Models nach Mode-Kompatibilitaet, erzwingt die min-1-active Regel, auto-aktiviert bei Model-Auswahl auf leeren Slots und rendert per-Slot ParameterPanel fuer aktive Slots.

---

## Acceptance Criteria

1) GIVEN die ModelSlots-Komponente wird mit `mode="txt2img"` und 3 Slots (Slot 1 active mit Model, Slot 2 active mit Model, Slot 3 inactive ohne Model) gerendert
   WHEN die Komponente sichtbar ist
   THEN werden exakt 3 Slot-Zeilen gerendert, jede mit einer Checkbox und einem Select-Dropdown
   AND die Checkboxen von Slot 1 und 2 sind checked, Slot 3 ist unchecked

2) GIVEN Slot 1 ist der einzige aktive Slot
   WHEN der User die Checkbox von Slot 1 uncheckt
   THEN bleibt Slot 1 checked (min-1-active Regel)
   AND `toggleSlotActive` wird NICHT aufgerufen

3) GIVEN Slot 2 ist active und hat ein Model zugewiesen
   WHEN der User die Checkbox von Slot 2 uncheckt
   THEN wird `toggleSlotActive({ mode, slot: 2, active: false })` aufgerufen
   AND nach Server-Antwort ist Slot 2 unchecked

4) GIVEN Slot 3 hat kein Model zugewiesen (model_id ist null)
   WHEN die Komponente rendert
   THEN ist die Checkbox von Slot 3 disabled (nicht klickbar)
   AND das Dropdown zeigt den Placeholder-Text (z.B. "select model")

5) GIVEN Slot 3 ist leer (kein Model, inactive)
   WHEN der User ein Model aus dem Dropdown von Slot 3 auswaehlt
   THEN wird `updateModelSlot({ mode, slot: 3, modelId: selectedModelId })` aufgerufen
   AND nach Server-Antwort ist Slot 3 automatisch active (Checkbox checked)

6) GIVEN der aktuelle Mode ist `txt2img` und es gibt 5 Models im Katalog, davon 3 kompatibel mit txt2img
   WHEN der User das Dropdown von Slot 1 oeffnet
   THEN zeigt das Dropdown nur die 3 kompatiblen Models an

7) GIVEN Slot 1 ist active mit Model "flux-schnell" und die Komponente hat `variant="stacked"`
   WHEN die Komponente rendert
   THEN wird unterhalb von Slot 1 ein ParameterPanel gerendert (via `useModelSchema` Hook)
   AND das ParameterPanel zeigt die schema-basierten Parameter des zugewiesenen Models

8) GIVEN Slot 2 ist inactive mit zugewiesenem Model
   WHEN die Komponente rendert
   THEN wird KEIN ParameterPanel fuer Slot 2 gerendert

9) GIVEN die Komponente hat `variant="compact"`
   WHEN die Komponente rendert
   THEN werden alle 3 Slots horizontal in einer Zeile dargestellt
   AND es werden KEINE ParameterPanels gerendert (unabhaengig vom Active-Status)

10) GIVEN ein `updateModelSlot()` Aufruf gibt erfolgreich einen aktualisierten Slot zurueck
    WHEN die Server-Antwort verarbeitet wird
    THEN wird ein `"model-slots-changed"` CustomEvent auf `window` dispatcht

11) GIVEN ein `toggleSlotActive()` Aufruf gibt erfolgreich einen aktualisierten Slot zurueck
    WHEN die Server-Antwort verarbeitet wird
    THEN wird ein `"model-slots-changed"` CustomEvent auf `window` dispatcht

12) GIVEN die Komponente empfaengt `disabled={true}` (z.B. waehrend Generierung)
    WHEN die Komponente rendert
    THEN sind alle Checkboxen und Dropdowns disabled

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/ui/__tests__/model-slots.test.tsx`

<test_spec>
```typescript
// AC-1: Rendert 3 Slot-Zeilen mit korrektem Checked-Status
it.todo('should render 3 slot rows with checkboxes matching active state')

// AC-2: Min-1-active Regel verhindert Deaktivierung des letzten Slots
it.todo('should prevent unchecking the last active slot and not call toggleSlotActive')

// AC-3: Deaktivierung eines nicht-letzten aktiven Slots ruft toggleSlotActive auf
it.todo('should call toggleSlotActive when unchecking a slot that is not the last active')

// AC-4: Leerer Slot hat disabled Checkbox und Placeholder im Dropdown
it.todo('should disable checkbox for empty slot and show placeholder in dropdown')

// AC-5: Model-Auswahl auf leerem Slot ruft updateModelSlot auf und auto-aktiviert
it.todo('should call updateModelSlot on empty slot model selection and auto-activate')

// AC-6: Dropdown zeigt nur mode-kompatible Models
it.todo('should only show models compatible with current mode in dropdown')

// AC-7: Stacked-Variante rendert ParameterPanel fuer aktive Slots
it.todo('should render ParameterPanel below active slots in stacked variant')

// AC-8: Inaktive Slots zeigen kein ParameterPanel
it.todo('should not render ParameterPanel for inactive slots')

// AC-9: Compact-Variante rendert horizontal ohne ParameterPanels
it.todo('should render slots horizontally without ParameterPanels in compact variant')

// AC-10: updateModelSlot dispatcht model-slots-changed Event
it.todo('should dispatch model-slots-changed CustomEvent after successful updateModelSlot')

// AC-11: toggleSlotActive dispatcht model-slots-changed Event
it.todo('should dispatch model-slots-changed CustomEvent after successful toggleSlotActive')

// AC-12: disabled-Prop deaktiviert alle Checkboxen und Dropdowns
it.todo('should disable all checkboxes and dropdowns when disabled prop is true')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-server-actions` | `updateModelSlot(input)` | Server Action | Import kompiliert |
| `slice-05-server-actions` | `toggleSlotActive(input)` | Server Action | Import kompiliert |
| `slice-05-server-actions` | `getModelSlots()` | Server Action | Import kompiliert |
| `slice-03-types-resolve-model` | `SlotNumber` | Type Export | Import kompiliert |
| `slice-03-types-resolve-model` | `GenerationMode` | Type Export | Import kompiliert |
| `slice-02-db-queries` | `ModelSlot` | Inferred Type | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelSlots` | React Component | Workspace (prompt-area), Canvas Popovers, Chat Panel | `(props: ModelSlotsProps) => JSX.Element` |
| `ModelSlotsProps` | TypeScript Interface | Consumer-Slices | `{ mode, slots, models, variant?, disabled?, onSlotsChanged? }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/model-slots.tsx` -- NEW: `ModelSlots` Komponente mit `variant="stacked"` (default) und `variant="compact"`. 3 Slot-Zeilen mit Radix Checkbox + Radix Select, per-Slot ParameterPanel, min-1-active Regel, Auto-Aktivierung, Custom Event Dispatch.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an Consumer-Dateien (prompt-area.tsx, Popovers, chat-panel, settings) -- kommt in spaeteren Slices
- KEINE Aenderungen an Server Actions oder Services
- KEINE Aenderungen an `lib/types.ts`, `lib/db/queries.ts`, `lib/db/schema.ts`
- KEIN Entfernen von `tier-toggle.tsx` (Cleanup-Slice)
- KEINE Aenderungen am bestehenden `ParameterPanel` (wird importiert und genutzt, nicht modifiziert)
- Komponente ist ein reiner "use client" Leaf-Component; Data Fetching (getModelSlots, Models-Liste) passiert im Consumer

**Technische Constraints:**
- `"use client"` Direktive am Dateianfang
- Radix UI `Checkbox` fuer Slot-Aktivierung, Radix UI `Select` fuer Model-Dropdown (bestehende Radix-Patterns im Repo)
- `useModelSchema(modelId)` Hook aus `@/lib/hooks/use-model-schema` fuer Schema-Loading pro aktivem Slot
- `ParameterPanel` aus `@/components/workspace/parameter-panel` fuer per-Slot Parameter-Rendering
- Slot-Daten (`ModelSlot[]`) und Model-Liste (`Model[]`) werden als Props uebergeben (kein internes Fetching)
- Optimistic UI: Checkbox/Dropdown aendert visuellen State sofort, Server Action laeuft im Hintergrund; bei Fehler Rollback
- Custom Event: `window.dispatchEvent(new CustomEvent("model-slots-changed"))` nach erfolgreicher Server Action
- Min-1-active Regel wird client-seitig VOR dem Server-Call geprueft (zaehle aktive Slots; wenn nur 1 aktiv, Checkbox disabled)
- Disabled-Checkbox fuer leere Slots: wenn `slot.model_id === null`, Checkbox disabled
- Compact-Variante: horizontales Flex-Layout, abgekuerzte Model-Namen, keine ParameterPanels

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/hooks/use-model-schema.ts` | Import: `useModelSchema(modelId)` fuer Schema-Loading pro Slot, unveraendert |
| `components/workspace/parameter-panel.tsx` | Import: `ParameterPanel` fuer per-Slot Parameter-Anzeige, unveraendert |
| `components/ui/tier-toggle.tsx` | Pattern-Referenz: aehnliche Props-Struktur (controlled, disabled, className). Wird NICHT modifiziert |
| `components/ui/select.tsx` | Import: Radix Select Wrapper, unveraendert |
| `components/ui/checkbox.tsx` | Import: Radix Checkbox Wrapper (falls vorhanden, sonst direkt `@radix-ui/react-checkbox`) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Architecture Layers" (UI Component Layer)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Business Logic Flow" (Model Dropdown Change, Checkbox Toggle)
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Workspace Prompt Area" (Stacked Layout, Annotations 1-5)
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Canvas Chat Panel" (Compact Layout, Annotation 1)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Regeln" (Min-1, Auto-Aktivierung, Layout-Varianten)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 6 "States & Edge Cases"
