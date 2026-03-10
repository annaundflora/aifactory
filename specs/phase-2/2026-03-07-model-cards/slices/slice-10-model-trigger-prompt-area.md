# Slice 10: Model Trigger + Prompt Area Integration

> **Slice 10 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-model-trigger-prompt-area` |
| **Test** | `pnpm test components/models/__tests__/model-trigger.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-model-browser-drawer"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/models/__tests__/model-trigger.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`ModelTrigger`-Komponente erstellen, die 1-3 selektierte `CollectionModel`-Eintraege als gestapelte Mini-Cards (Thumbnail 32x32, Name, Owner, X-Button) anzeigt und ueber einen "Browse Models"-Link den `ModelBrowserDrawer` oeffnet. In `prompt-area.tsx` wird der `<Select>`-Dropdown durch `ModelTrigger` + `ModelBrowserDrawer` ersetzt; der State wechselt von `selectedModelId: string` auf `selectedModels: CollectionModel[]`, die beim Mount via `getCollectionModels()` initialisiert werden.

---

## Acceptance Criteria

1) GIVEN `models` ist ein Array mit 2 `CollectionModel`-Eintraegen
   WHEN `ModelTrigger` gerendert wird
   THEN werden genau 2 Mini-Cards gerendert, jede mit Thumbnail (`32x32`-Container), `name` und `owner` des jeweiligen Models
   AND ein "Browse Models"-Link ist sichtbar

2) GIVEN `models` hat genau 1 Eintrag
   WHEN `ModelTrigger` gerendert wird
   THEN ist der X-Button dieser Mini-Card nicht sichtbar (oder disabled)
   AND der "Browse Models"-Link ist sichtbar

3) GIVEN `models` hat 2 Eintraege
   WHEN der Nutzer den X-Button der ersten Mini-Card klickt
   THEN wird `onRemove` mit dem `CollectionModel` der ersten Mini-Card aufgerufen
   AND die verbleibende Mini-Card zeigt keinen X-Button mehr

4) GIVEN `ModelTrigger` ist gerendert
   WHEN der Nutzer den "Browse Models"-Link klickt
   THEN wird `onBrowse` aufgerufen (einmalig)

5) GIVEN `prompt-area.tsx` wird gerendert (Workspace offen)
   WHEN die Komponente mountet
   THEN wird `getCollectionModels()` aufgerufen
   AND `selectedModels` wird mit `[collectionModels[0]]` initialisiert (erstes Model aus der Collection)
   AND `ModelTrigger` zeigt dieses eine Model an

6) GIVEN `selectedModels.length === 1` in `prompt-area.tsx`
   WHEN die Prompt Area gerendert wird
   THEN ist das `ParameterPanel` sichtbar
   AND der Variant-Count-Selektor ist sichtbar
   AND der `<Select>`-Dropdown ist nicht im DOM

7) GIVEN `selectedModels.length > 1` in `prompt-area.tsx`
   WHEN die Prompt Area gerendert wird
   THEN ist das `ParameterPanel` nicht sichtbar
   AND der Variant-Count-Selektor ist nicht sichtbar
   AND eine Hinweismeldung "Default parameters will be used for multi-model generation" ist sichtbar

8) GIVEN der Nutzer ein Model im `ModelBrowserDrawer` bestaetigt (onConfirm aufgerufen)
   WHEN `onConfirm(newModels)` in `prompt-area.tsx` verarbeitet wird
   THEN ist `selectedModels` auf `newModels` gesetzt
   AND `ModelTrigger` zeigt die neu selektierten Models an

9) GIVEN `getCollectionModels()` gibt `{ error: string }` zurueck beim Mount
   WHEN `prompt-area.tsx` den Fehler erhaelt
   THEN bleibt `selectedModels` leer oder auf Fallback gesetzt
   AND kein unbehandelter Fehler wird geworfen (kein Crash)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/models/__tests__/model-trigger.test.tsx`

<test_spec>
```typescript
// AC-1: ModelTrigger zeigt korrekte Anzahl Mini-Cards mit Thumbnail, Name, Owner
it.todo('should render one mini-card per model with thumbnail, name and owner')

// AC-2: X-Button ausgeblendet wenn nur 1 Model selektiert
it.todo('should hide X button when only one model is in the list')

// AC-3: X-Button ruft onRemove mit korrektem Model auf
it.todo('should call onRemove with the correct model when X button is clicked')

// AC-4: Browse-Models-Link ruft onBrowse auf
it.todo('should call onBrowse when browse models link is clicked')

// AC-5: prompt-area laedt Collection und initialisiert selectedModels[0] beim Mount
it.todo('should fetch collection models on mount and initialize selectedModels with first model')

// AC-6: ParameterPanel und VariantCount sichtbar bei 1 selektiertem Model
it.todo('should show parameter panel and variant count when exactly one model is selected')

// AC-7: ParameterPanel und VariantCount versteckt bei mehr als 1 selektiertem Model
it.todo('should hide parameter panel and variant count and show multi-model notice when multiple models selected')

// AC-8: onConfirm aktualisiert selectedModels im prompt-area State
it.todo('should update selectedModels when drawer onConfirm is called')

// AC-9: Kein Crash bei getCollectionModels-Fehler beim Mount
it.todo('should handle getCollectionModels error on mount without crashing')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-model-browser-drawer` | `ModelBrowserDrawer` | React Component | Import aus `components/models/model-browser-drawer.tsx` fehlerfrei |
| `slice-08-model-browser-drawer` | `ModelBrowserDrawerProps` | TypeScript Interface | Props-Kompatibilitaet pruefen (`onConfirm`, `onClose`, `selectedModels`) |
| `slice-02-collection-model-service` | `CollectionModel` | TypeScript Interface | Import aus `lib/types/collection-model.ts` |
| `slice-03-collection-models-action` | `getCollectionModels` | Server Action | Aufruf in `useEffect` beim Mount; Signatur: `() => Promise<CollectionModel[] \| { error: string }>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelTrigger` | React Component | `slice-11+` / Endnutzer | `ModelTrigger: React.FC<{ models: CollectionModel[]; onRemove: (model: CollectionModel) => void; onBrowse: () => void }>` |
| `selectedModels` State in `prompt-area.tsx` | `CollectionModel[]` | `slice-11` (generateImages) | Wird als `modelIds: string[]` an `generateImages`-Action uebergeben (mapping: `model => \`${model.owner}/${model.name}\``) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/models/model-trigger.tsx` — Compact Trigger Card: gestapelte Mini-Cards (Thumbnail 32x32, Name, Owner, X-Button), "Browse Models"-Link, Min-1-Enforcement (X ausgeblendet bei letztem Model)
- [ ] `components/workspace/prompt-area.tsx` — Refactoring: `<Select>`-Dropdown entfernen, `ModelTrigger` + `ModelBrowserDrawer` einbinden, State von `selectedModelId: string` auf `selectedModels: CollectionModel[]` aendern, `useEffect` fuer Mount-Fetch, `ParameterPanel`/Variant-Count konditionell ausblenden bei `selectedModels.length > 1`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `generateImages`-Action-Signatur (kommt in Slice 11)
- KEIN Refactoring von `ModelBrowserDrawer` selbst
- KEINE neuen shadcn-Komponenten installieren (alle benoetigen bereits vorhanden)
- KEINE Aenderungen an `parameter-panel.tsx`, `generation-card.tsx` oder `lightbox-modal.tsx`

**Technische Constraints:**
- Thumbnail-Fallback: Gradient-Placeholder wenn `cover_image_url` null ist (plain `<img loading="lazy">`, kein `next/image`)
- Min-1-Enforcement: X-Button via konditionelles Rendern verstecken (nicht nur disabled), Bedingung `models.length === 1`
- State-Initialisierung: `useState<CollectionModel[]>([])`, nach Mount-Fetch Update auf `[result[0]]`
- `ModelBrowserDrawer` in `prompt-area.tsx`: State `drawerOpen: boolean` + `collectionModels: CollectionModel[]` + `collectionError: string | undefined` + `collectionLoading: boolean`
- Bestehende `selectedModelId`-Usages (z.B. `loadSchema`, `generateImages`-Call) werden auf `selectedModels[0]` bzw. gemappte `modelIds[]` umgestellt
- Variant-Count-Selektor: konditionell via `selectedModels.length === 1`

**Referenzen:**
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "Screen: Prompt Area (Sidebar)" (Trigger-Layout)
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "UI Components & States" (`model-trigger`, `model-trigger-item` States)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Migration Map" (`prompt-area.tsx`-Zeile, genaue Aenderungen)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Constraints" (Min-1, ParameterPanel-Bedingung, Variant-Count-Bedingung)
