# Slice 11: Parameter Panel Multi-Model Notice

> **Slice 11 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-parameter-panel-notice` |
| **Test** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-10-model-trigger-prompt-area"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`prompt-area.tsx` wird um eine bedingte Anzeige erweitert: Bei genau 1 selektiertem Model sind `ParameterPanel` und Variant-Count-Selektor sichtbar. Sobald 2 oder 3 Models selektiert sind, werden beide Elemente ausgeblendet und stattdessen der Info-Text "Default parameters will be used for multi-model generation." angezeigt. Dieser Slice setzt die Grundlage aus Slice 10 (`selectedModels: CollectionModel[]`) voraus und liefert die vollstaendige UI-Logik fuer diesen Wechsel.

---

## Acceptance Criteria

1) GIVEN `selectedModels` enthaelt genau 1 `CollectionModel`
   WHEN die `prompt-area.tsx`-Komponente gerendert wird
   THEN ist `ParameterPanel` im DOM sichtbar
   AND der Variant-Count-Selektor ist im DOM sichtbar
   AND der Text "Default parameters will be used for multi-model generation." ist NICHT im DOM

2) GIVEN `selectedModels` enthaelt genau 2 `CollectionModel`-Eintraege
   WHEN die `prompt-area.tsx`-Komponente gerendert wird
   THEN ist `ParameterPanel` NICHT im DOM (nicht gerendert, nicht nur versteckt)
   AND der Variant-Count-Selektor ist NICHT im DOM
   AND der Text "Default parameters will be used for multi-model generation." ist im DOM sichtbar

3) GIVEN `selectedModels` enthaelt genau 3 `CollectionModel`-Eintraege
   WHEN die `prompt-area.tsx`-Komponente gerendert wird
   THEN ist `ParameterPanel` NICHT im DOM
   AND der Variant-Count-Selektor ist NICHT im DOM
   AND der Text "Default parameters will be used for multi-model generation." ist im DOM sichtbar

4) GIVEN `selectedModels` hat 1 Eintrag und der Nutzer bestaetigt im Drawer 2 Models (`onConfirm([model1, model2])`)
   WHEN `selectedModels` auf `[model1, model2]` aktualisiert wird
   THEN verschwindet `ParameterPanel` aus dem DOM
   AND der Notice-Text "Default parameters will be used for multi-model generation." erscheint im DOM

5) GIVEN `selectedModels` hat 2 Eintraege und der Nutzer entfernt 1 Model via X-Button (`onRemove`)
   WHEN `selectedModels` auf `[model1]` aktualisiert wird
   THEN erscheint `ParameterPanel` wieder im DOM
   AND der Notice-Text "Default parameters will be used for multi-model generation." verschwindet aus dem DOM

6) GIVEN `selectedModels` enthaelt 2 oder mehr Models
   WHEN `generateImages` aufgerufen wird (Generate-Button klick)
   THEN wird `params` als leeres Objekt `{}` uebergeben (Default-Params, da kein Panel aktiv)
   AND `count` wird als `1` uebergeben (fester Wert bei Multi-Model)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area.test.tsx`

<test_spec>
```typescript
// AC-1: ParameterPanel + Variant Count sichtbar, Notice versteckt bei 1 Model
it.todo('should show parameter panel and variant count when exactly one model is selected')

// AC-2: ParameterPanel + Variant Count versteckt, Notice sichtbar bei 2 Models
it.todo('should hide parameter panel and variant count and show notice when two models are selected')

// AC-3: ParameterPanel + Variant Count versteckt, Notice sichtbar bei 3 Models
it.todo('should hide parameter panel and variant count and show notice when three models are selected')

// AC-4: Wechsel von 1 -> 2 Models blendet Panel aus und Notice ein
it.todo('should hide parameter panel and show notice when selection changes from one to two models')

// AC-5: Wechsel von 2 -> 1 Model blendet Notice aus und Panel ein
it.todo('should show parameter panel and hide notice when selection reduces back to one model')

// AC-6: Multi-Model Generate uebergibt leere params und count=1
it.todo('should pass empty params and count 1 to generateImages when multiple models are selected')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-10-model-trigger-prompt-area` | `selectedModels: CollectionModel[]` State | React State in `prompt-area.tsx` | State existiert und ist vom Typ `CollectionModel[]` |
| `slice-10-model-trigger-prompt-area` | `prompt-area.tsx` (refactored) | React Component | Datei ist vorhanden, `<Select>`-Dropdown ist entfernt |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `prompt-area.tsx` (mit Notice-Logik) | React Component | `slice-12-parallel-generation` | `generateImages` wird mit `params: {}` und `count: 1` aufgerufen wenn `selectedModels.length > 1` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` — Bedingte Anzeige: `ParameterPanel` + Variant-Count-Selektor nur wenn `selectedModels.length === 1`; sonst Info-Text "Default parameters will be used for multi-model generation."
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `parameter-panel.tsx` selbst
- KEINE Aenderungen an `generateImages`-Action-Signatur (kommt in Slice 12)
- KEIN neues UI-Element ausser dem Info-Text (kein Icon, keine Card, kein Alert-Wrapper)
- KEIN Styling-Overhaul der Prompt Area; nur gezielte konditionelle Rendern

**Technische Constraints:**
- Bedingung: `selectedModels.length === 1` -> Panel + Count sichtbar; `selectedModels.length > 1` -> Notice sichtbar
- Konditionelles Rendern via ternary oder `&&` — KEIN CSS `display: none` oder `visibility: hidden`
- Notice-Text exakt: `"Default parameters will be used for multi-model generation."`
- Bei Multi-Model: `params`-Wert fuer `generateImages` ist `{}` (leeres Objekt, nicht der `schemaParams`-State)
- Bei Multi-Model: `count`-Wert fuer `generateImages` ist `1` (hard-coded, Variant-Count-Selektor-State ignorieren)

**Referenzen:**
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "UI Components & States" (`parameter-panel-notice` Zeile)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Constraints" (Parameter Panel hidden for multi-model, Variant count hidden for multi-model)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Server Actions" (`generateImages` Input: `params: Record<string, unknown>`, `count: number`)
