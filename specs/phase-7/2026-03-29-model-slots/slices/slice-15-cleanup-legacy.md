# Slice 15: Legacy-Dateien und Referenzen entfernen

> **Slice 15 von 15** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-cleanup-legacy` |
| **Test** | `pnpm tsc --noEmit` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-workspace-integration", "slice-09-variation-popover", "slice-10-img2img-popover", "slice-11-upscale-popover", "slice-12-canvas-detail-view", "slice-13-chat-panel", "slice-14-settings-read-only"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm tsc --noEmit` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `grep -r "TierToggle\|tier-toggle\|model-settings-service\|VALID_TIERS\|model-settings-changed" --include="*.ts" --include="*.tsx" . \| grep -v node_modules \| grep -v specs \| grep -v drizzle` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Alle Legacy-Artefakte des Tier-Systems entfernen: 4 Dateien loeschen, deprecated `tier?`/`modelSettings?` Props und Legacy-Pfade aus Popovers entfernen, `Tier`/`VALID_TIERS`/`UpdateModelSettingInput` aus `lib/types.ts` entfernen, verwaiste Test-Dateien loeschen. Nach diesem Slice darf `tsc --noEmit` fehlerfrei kompilieren und kein Produktions-Code mehr auf Tier-Artefakte referenzieren.

---

## Acceptance Criteria

1) GIVEN die Dateien `components/ui/tier-toggle.tsx`, `components/ui/max-quality-toggle.tsx`, `lib/services/model-settings-service.ts`, `app/actions/model-settings.ts`
   WHEN Slice 15 abgeschlossen ist
   THEN existiert KEINE dieser 4 Dateien mehr im Repository

2) GIVEN `lib/types.ts`
   WHEN die Datei inspiziert wird
   THEN enthaelt sie KEINEN `Tier` Type-Export, KEIN `VALID_TIERS` Constant-Export, KEIN `UpdateModelSettingInput` Interface
   AND `GenerationMode`, `VALID_GENERATION_MODES` bleiben unveraendert erhalten

3) GIVEN die Popover-Interfaces in `variation-popover.tsx`, `img2img-popover.tsx`, `upscale-popover.tsx`
   WHEN die Dateien inspiziert werden
   THEN enthaelt KEINES der Params-Interfaces ein `tier?` Feld
   AND KEINES der Props-Interfaces ein `modelSettings?` Feld
   AND `modelSlots` und `models` Props sind Pflicht-Felder (nicht mehr optional)
   AND der Legacy-Pfad-Code (TierToggle-Rendering bei fehlenden `modelSlots`) ist vollstaendig entfernt

4) GIVEN alle `.ts` und `.tsx` Dateien im Repo (exkl. `node_modules`, `specs/`, `drizzle/`)
   WHEN `grep -r "TierToggle\|tier-toggle\|model-settings-service\|VALID_TIERS\|model-settings-changed" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   THEN liefert der Befehl 0 Treffer

5) GIVEN alle `.ts` und `.tsx` Dateien im Repo (exkl. `node_modules`, `specs/`, `drizzle/`)
   WHEN `grep -r "import.*model-settings\|from.*model-settings" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   THEN liefert der Befehl 0 Treffer (kein Import aus geloeschten Modulen)

6) GIVEN der gesamte TypeScript-Codebase
   WHEN `pnpm tsc --noEmit` ausgefuehrt wird
   THEN kompiliert der Codebase fehlerfrei (Exit-Code 0)

7) GIVEN verwaiste Test-Dateien die geloeschte Module testen
   WHEN Slice 15 abgeschlossen ist
   THEN sind folgende Test-Dateien geloescht: `components/ui/__tests__/tier-toggle.test.tsx`, `components/ui/__tests__/max-quality-toggle.test.tsx`, `lib/services/__tests__/model-settings-service.test.ts`, `app/actions/__tests__/model-settings.test.ts`, `__tests__/slice-09/model-settings-auth.test.ts`
   AND verbleibende Test-Dateien die Legacy-Referenzen enthielten (z.B. `canvas-chat-panel-tier-toggle.test.tsx`, `prompt-area-tier-toggle.test.tsx`) sind ebenfalls geloescht oder bereinigt

8) GIVEN `components/settings/settings-dialog.tsx`
   WHEN die Datei inspiziert wird
   THEN referenziert sie NUR `"model-slots-changed"` Events (kein `"model-settings-changed"`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Dieser Slice ist ein Cleanup-Slice. Die primaere Validierung
> erfolgt ueber `tsc --noEmit` und `grep`-Pruefungen (AC-4, AC-5, AC-6).
> Test-Skeletons validieren die Abwesenheit von Legacy-Artefakten.

### Test-Datei: `__tests__/slice-15/cleanup-legacy.test.ts`

<test_spec>
```typescript
// AC-1: Legacy-Dateien geloescht
it.todo('should confirm tier-toggle.tsx does not exist')
it.todo('should confirm max-quality-toggle.tsx does not exist')
it.todo('should confirm model-settings-service.ts does not exist')
it.todo('should confirm app/actions/model-settings.ts does not exist')

// AC-2: Tier/VALID_TIERS aus types.ts entfernt
it.todo('should confirm lib/types.ts does not export Tier type or VALID_TIERS')

// AC-4: Keine Legacy-Referenzen im Codebase
it.todo('should find zero matches for TierToggle, tier-toggle, model-settings-service, VALID_TIERS, model-settings-changed in ts/tsx files')

// AC-5: Keine Imports aus geloeschten Modulen
it.todo('should find zero imports from model-settings in ts/tsx files')

// AC-6: TypeScript kompiliert fehlerfrei
it.todo('should pass tsc --noEmit without errors')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | `prompt-area.tsx` (umgebaut auf ModelSlots) | Modified File | Kein TierToggle-Import mehr |
| `slice-09` | `variation-popover.tsx` (mit Legacy-Pfad) | Modified File | Legacy-Pfad wird hier entfernt |
| `slice-10` | `img2img-popover.tsx` (mit Legacy-Pfad) | Modified File | Legacy-Pfad wird hier entfernt |
| `slice-11` | `upscale-popover.tsx` (mit Legacy-Pfad) | Modified File | Legacy-Pfad wird hier entfernt |
| `slice-12` | `canvas-detail-view.tsx` (umgebaut) | Modified File | Nutzt bereits model-slots-changed |
| `slice-13` | `canvas-chat-panel.tsx` (umgebaut) | Modified File | Kein TierToggle-Import mehr |
| `slice-14` | `settings-dialog.tsx` (read-only) | Modified File | model-settings-changed Events bereinigen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Bereinigter Codebase | Cleanup | Kein Consumer | `tsc --noEmit` fehlerfrei; 0 Legacy-Referenzen |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/tier-toggle.tsx` -- DELETE
- [ ] `components/ui/max-quality-toggle.tsx` -- DELETE
- [ ] `lib/services/model-settings-service.ts` -- DELETE
- [ ] `app/actions/model-settings.ts` -- DELETE
- [ ] `lib/types.ts` -- MODIFY: `Tier` Type, `VALID_TIERS` Constant, `UpdateModelSettingInput` Interface entfernen; `GenerationMode` und `VALID_GENERATION_MODES` behalten
- [ ] `components/canvas/popovers/variation-popover.tsx` -- MODIFY: deprecated `tier?: Tier` aus `VariationParams` entfernen, `modelSettings?` aus Props entfernen, `modelSlots`/`models` zu Pflicht-Props machen, Legacy-Pfad-Code (TierToggle Fallback) komplett entfernen, alle Legacy-Imports (`TierToggle`, `Tier`, `resolveModel`, `ModelSetting`) entfernen
- [ ] `components/canvas/popovers/img2img-popover.tsx` -- MODIFY: deprecated `tier?: Tier` aus Params entfernen, `modelSettings?` aus Props entfernen, `modelSlots`/`models` zu Pflicht-Props machen, Legacy-Pfad-Code komplett entfernen, alle Legacy-Imports entfernen
- [ ] `components/canvas/popovers/upscale-popover.tsx` -- MODIFY: deprecated `tier?: Tier` aus `onUpscale`-Params entfernen, `modelSettings?` aus Props entfernen, `modelSlots`/`models` zu Pflicht-Props machen, Legacy-Pfad-Code komplett entfernen, alle Legacy-Imports entfernen
- [ ] `components/settings/settings-dialog.tsx` -- MODIFY: verbleibende `"model-settings-changed"` Referenzen durch `"model-slots-changed"` ersetzen (falls nach Slice 14 noch vorhanden)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Implementer loescht aber verwaiste Test-Dateien als Teil des Cleanups (AC-7).

---

## Constraints

**Scope-Grenzen:**
- KEINE funktionalen Aenderungen an der Business-Logik — nur Entfernen von Legacy-Code
- KEINE Aenderungen an `lib/db/schema.ts`, `lib/db/queries.ts`, `app/actions/model-slots.ts`
- KEINE Aenderungen an `model-slots.tsx` Komponente (Slice 06/07)
- KEINE Aenderungen an `resolveActiveSlots()` in `lib/utils/resolve-model.ts`
- KEINE Aenderungen an Migrations-SQL-Dateien in `drizzle/`
- KEINE neuen Features oder Komponenten

**Technische Constraints:**
- Jede Datei-Loesch-Operation muss pruefen ob noch Imports darauf zeigen — wenn ja, Import zuerst entfernen
- `lib/types.ts` behaelt Block-Kommentare und `GenerationMode`/`VALID_GENERATION_MODES` exakt bei
- Popover-Cleanup: Nur den Legacy-Pfad-Branch entfernen (if/else fuer `modelSlots`-Check), den neuen Pfad als einzigen Pfad beibehalten
- Verwaiste Test-Dateien: Alle Test-Dateien die ausschliesslich geloeschte Module testen werden geloescht; Test-Dateien die neben Legacy auch neue Logik testen werden bereinigt (Legacy-Tests entfernen, Rest behalten)
- `tsc --noEmit` ist das finale Gate — Slice ist erst done wenn es fehlerfrei kompiliert

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> "Removed Files"
- Slice 09 Constraints: deprecated `tier?`/`modelSettings?` "werden in slice-12/slice-15 aufgeraeumt"
- Slice 10 Constraints: deprecated Felder "werden in slice-12/slice-15 aufgeraeumt"
- Slice 11 Constraints: deprecated Felder und Legacy-Imports "werden in slice-15 aufgeraeumt"
- Slice 12 Constraints: "KEIN Entfernen der deprecated tier/modelSettings Props (Cleanup kommt spaeter)"
