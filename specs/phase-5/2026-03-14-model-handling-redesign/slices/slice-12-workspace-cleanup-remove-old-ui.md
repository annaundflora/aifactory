# Slice 12: Workspace Cleanup -- Remove Old UI Components

> **Slice 12 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-workspace-cleanup-remove-old-ui` |
| **Test** | `pnpm test components/canvas/canvas-detail-view components/canvas/canvas-header` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-canvas-variation-img2img-tier-toggle", "slice-10-canvas-upscale-tier-toggle", "slice-11-canvas-chat-panel-tier-toggle"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/canvas-detail-view components/canvas/canvas-header` |
| **Integration Command** | `pnpm test components/canvas` |
| **Acceptance Command** | `pnpm test components/canvas && pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reiner Cleanup-Slice, keine externen Abhaengigkeiten) |

---

## Ziel

Alle veralteten Model-Auswahl-Komponenten (`CanvasModelSelector`, `ModelBrowserDrawer`, `ModelTrigger`, `ParameterPanel`) aus den aktiven Render-Pfaden der Canvas- und Workspace-Komponenten entfernen. Der Center-Slot im Canvas Header wird geleert, da die Tier-Auswahl jetzt in den einzelnen Tool-Popovers und im Chat-Panel lebt (Slices 9-11).

---

## Acceptance Criteria

1) GIVEN `canvas-detail-view.tsx`
   WHEN die Import-Statements inspiziert werden
   THEN existiert KEIN Import von `CanvasModelSelector` aus `@/components/canvas/canvas-model-selector`

2) GIVEN `canvas-detail-view.tsx`
   WHEN der Render-Output inspiziert wird
   THEN wird KEIN `<CanvasModelSelector>` gerendert und die Variable `effectiveModelSelectorSlot` enthaelt keinen Fallback auf `CanvasModelSelector`

3) GIVEN `canvas-detail-view.tsx`
   WHEN `<CanvasHeader>` gerendert wird
   THEN wird `modelSelectorSlot` entweder nicht uebergeben oder mit einem explizit leeren Wert (`undefined` / `null`) uebergeben

4) GIVEN `canvas-header.tsx`
   WHEN der Canvas Header gerendert wird ohne `modelSelectorSlot`-Prop
   THEN ist der Center-Slot (`data-testid="model-selector-slot"`) leer (keine Kind-Elemente)

5) GIVEN `canvas-header.tsx`
   WHEN die `CanvasHeaderProps` inspiziert werden
   THEN ist die `modelSelectorSlot` Prop entweder entfernt oder weiterhin optional mit Typ `ReactNode` (fuer zukuenftige Nutzung)

6) GIVEN alle Dateien im Verzeichnis `components/canvas/`
   WHEN nach Imports von `ModelBrowserDrawer` gesucht wird
   THEN gibt es KEINE aktiven Imports (nur in Test-Mocks oder der Datei `canvas-model-selector.tsx` selbst erlaubt)

7) GIVEN alle Dateien im Verzeichnis `components/workspace/`
   WHEN nach Imports von `CanvasModelSelector` gesucht wird
   THEN gibt es KEINE Imports

8) GIVEN das gesamte Projekt
   WHEN `pnpm tsc --noEmit` ausgefuehrt wird
   THEN kompiliert TypeScript ohne Fehler

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-cleanup.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView - Old UI Component Removal', () => {
  // AC-1: Kein CanvasModelSelector Import
  it.todo('should not import CanvasModelSelector')

  // AC-2: Kein CanvasModelSelector im Render-Output
  it.todo('should not render CanvasModelSelector in the component tree')

  // AC-3: modelSelectorSlot leer an CanvasHeader uebergeben
  it.todo('should pass no modelSelectorSlot to CanvasHeader')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-header-cleanup.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasHeader - Empty Center Slot', () => {
  // AC-4: Center-Slot ist leer ohne modelSelectorSlot
  it.todo('should render empty center slot when no modelSelectorSlot is provided')

  // AC-5: modelSelectorSlot Prop Definition
  it.todo('should accept optional modelSelectorSlot prop')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/cleanup-no-old-imports.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Cleanup - No Old Model UI Imports in Active Render Paths', () => {
  // AC-6: Kein ModelBrowserDrawer Import in Canvas-Komponenten
  it.todo('should have no ModelBrowserDrawer imports in canvas components except canvas-model-selector.tsx')

  // AC-7: Kein CanvasModelSelector Import in Workspace-Komponenten
  it.todo('should have no CanvasModelSelector imports in workspace components')

  // AC-8: TypeScript kompiliert fehlerfrei
  it.todo('should compile without TypeScript errors')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09` | Tier-basierte Model-Resolution in Variation/Img2Img Handlern | Behaviour | Handler nutzen `modelSettings` statt `selectedModelId` / `CanvasModelSelector` |
| `slice-10` | Tier-basierte Model-Resolution in Upscale Handler | Behaviour | `handleUpscale` nutzt Settings statt hardcoded Model |
| `slice-11` | Tier-basierte Model-Resolution in Chat Panel | Behaviour | `handleCanvasGenerate` ignoriert `event.model_id`, nutzt Settings |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Bereinigte `canvas-detail-view.tsx` ohne alte Imports | Clean Codebase | `slice-13` (Dead Code Cleanup) | `canvas-model-selector.tsx` Datei kann in Slice 13 geloescht werden |
| Leerer Canvas Header Center-Slot | UI State | keiner | Center-Slot frei fuer zukuenftige Features |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-header.tsx` -- Bestehend: `modelSelectorSlot` Prop entfernen oder leeren, Center-Slot ohne Kinder rendern
- [ ] `components/canvas/canvas-detail-view.tsx` -- Bestehend: `CanvasModelSelector` Import entfernen, `effectiveModelSelectorSlot` Variable entfernen, `modelSelectorSlot`-Prop nicht mehr an CanvasHeader uebergeben
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Loeschung der Datei `canvas-model-selector.tsx` (bleibt als unused File, wird in Slice 13 entfernt)
- KEINE Loeschung von `model-browser-drawer.tsx`, `model-trigger.tsx`, `parameter-panel.tsx` (Slice 13)
- KEINE Aenderung an `prompt-area.tsx` (ModelTrigger/ModelBrowserDrawer/ParameterPanel dort bereits in Slice 6 entfernt)
- KEINE Aenderung an Server Actions, Services oder DB-Schema
- KEINE Aenderung an Canvas-Popovers oder Chat-Panel (erledigt in Slices 9-11)

**Technische Constraints:**
- Reine Subtraktions-Arbeit: nur Imports entfernen, Render-Aufrufe entfernen, Variablen entfernen
- `modelSelectorSlot` Prop in `CanvasHeaderProps` kann optional bleiben (kein Breaking Change fuer Tests) oder entfernt werden -- Implementer entscheidet
- Bestehende Tests die `CanvasModelSelector` oder `ModelBrowserDrawer` mocken, muessen ihre Mock-Definitionen behalten (Test-Dateien nicht in Scope)

**Referenzen:**
- Canvas Header Layout: `wireframes.md` -> Section "Screen: Canvas Header (modified)" -- Center-Slot leer
- Migration Map: `architecture.md` -> Section "Migration Map" -> `canvas-model-selector.tsx` ("File becomes unused")
- Migration Map: `architecture.md` -> Section "Migration Map" -> `canvas-detail-view.tsx` ("Remove CanvasModelSelector import/render")
