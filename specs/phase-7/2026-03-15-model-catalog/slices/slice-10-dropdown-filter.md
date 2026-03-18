# Slice 10: Model-Dropdown Capability-Filter

> **Slice 10 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-dropdown-filter` |
| **Test** | `pnpm test components/settings/__tests__/settings-dialog-filter.test.ts components/settings/__tests__/model-mode-section-filter.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-server-actions", "slice-08-types-seed"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/settings/__tests__/settings-dialog-filter.test.ts components/settings/__tests__/model-mode-section-filter.test.ts` |
| **Integration Command** | -- (Server Actions gemockt) |
| **Acceptance Command** | `pnpm test components/settings/__tests__/settings-dialog-filter.test.ts components/settings/__tests__/model-mode-section-filter.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Action `getModels` gemockt, `window.dispatchEvent`/`addEventListener` ueber jsdom) |

---

## Ziel

`settings-dialog.tsx` und `model-mode-section.tsx` umbauen: Datenladung von `getCollectionModels` auf `getModels({ capability })` umstellen, 5 Sections rendern (statt 3), `compatibilityMap`-Logik durch Capability-Filterung ersetzen, context-aware Empty-State-Messages einfuehren und event-basiertes Refresh nach Sync via `window.addEventListener("model-settings-changed")` implementieren.

---

## Acceptance Criteria

1) GIVEN das Settings-Dialog wird geoeffnet
   WHEN `settings-dialog.tsx` die Model-Daten laedt
   THEN wird pro Mode ein separater `getModels({ capability: mode })` Server-Action-Call ausgefuehrt (5 Calls fuer txt2img, img2img, upscale, inpaint, outpaint) und NICHT mehr `getCollectionModels()`

2) GIVEN Models in der DB mit `capabilities.txt2img = true` (3 Stueck) und `capabilities.img2img = true` (2 Stueck)
   WHEN das Settings-Dialog gerendert wird
   THEN zeigt die TEXT TO IMAGE Section genau 3 Models in den Dropdowns und die IMAGE TO IMAGE Section genau 2 Models

3) GIVEN das Settings-Dialog rendert 5 Sections
   WHEN die Section-Reihenfolge geprueft wird
   THEN ist sie: TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, OUTPAINT (gemaess `MODES` Array mit 5 Eintraegen)

4) GIVEN `getModels({ capability: "inpaint" })` gibt ein leeres Array zurueck und ein Sync laeuft gerade (`syncing` State)
   WHEN die INPAINT Section gerendert wird
   THEN zeigt der Dropdown die Empty-Message "Loading models... please wait." (State `empty:syncing`)

5) GIVEN `getModels({ capability: "outpaint" })` gibt ein leeres Array zurueck und kein Sync hat jemals stattgefunden
   WHEN die OUTPAINT Section gerendert wird
   THEN zeigt der Dropdown die Empty-Message "No models available. Click \"Sync Models\" to load." (State `empty:never-synced`)

6) GIVEN `getModels({ capability: "upscale" })` gibt ein leeres Array zurueck und der letzte Sync ist fehlgeschlagen
   WHEN die UPSCALE Section gerendert wird
   THEN zeigt der Dropdown die Empty-Message "Sync failed. Click \"Sync Models\" to retry." (State `empty:failed`)

7) GIVEN `getModels({ capability: "inpaint" })` gibt ein leeres Array zurueck, aber andere Modes haben Models, und der letzte Sync war partial
   WHEN die INPAINT Section gerendert wird
   THEN zeigt der Dropdown die Empty-Message "No models for this mode yet. Click \"Sync Models\" to retry." (State `empty:partial`)

8) GIVEN das Settings-Dialog ist geoeffnet und zeigt 2 Models in TEXT TO IMAGE
   WHEN ein `window` Event `"model-settings-changed"` dispatched wird
   THEN werden die Model-Daten automatisch neu geladen (erneute `getModels`-Calls) und die Dropdowns aktualisieren sich

9) GIVEN `model-mode-section.tsx` Props
   WHEN die Component-Signatur geprueft wird
   THEN akzeptiert sie `models: Model[]` (aus DB) statt `collectionModels: CollectionModel[]` und NICHT mehr `compatibilityMap: Record<string, boolean>`

10) GIVEN `settings-dialog.tsx` Imports
    WHEN die Imports geprueft werden
    THEN existiert KEIN Import von `getCollectionModels`, KEIN Import von `checkImg2ImgSupport`, und KEIN Import von `CollectionModel`

11) GIVEN der INPAINT Section Dropdown mit einem Model ausgewaehlt
    WHEN die `onModelChange` Callback aufgerufen wird
    THEN wird `updateModelSetting` mit `mode: "inpaint"` und dem gewaehlten `modelId` aufgerufen (gleiche Logik wie bestehende Modes)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `components/settings/__tests__/settings-dialog-filter.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SettingsDialog Capability-Filter', () => {
  // AC-1: getModels pro Mode statt getCollectionModels
  it.todo('should call getModels with capability filter for each of 5 modes')

  // AC-2: Korrekte Anzahl Models pro Section
  it.todo('should pass filtered models to each mode section')

  // AC-3: 5 Sections in korrekter Reihenfolge
  it.todo('should render 5 mode sections in order: txt2img, img2img, upscale, inpaint, outpaint')

  // AC-8: Event-basiertes Refresh
  it.todo('should reload models when model-settings-changed event is dispatched')

  // AC-10: Alte Imports entfernt
  it.todo('should not import getCollectionModels or checkImg2ImgSupport or CollectionModel')
})
```
</test_spec>

### Test-Datei: `components/settings/__tests__/model-mode-section-filter.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelModeSection Capability-Filter', () => {
  // AC-4: Empty-State syncing
  it.todo('should show syncing empty message when models empty and sync in progress')

  // AC-5: Empty-State never-synced
  it.todo('should show never-synced empty message when models empty and no sync has run')

  // AC-6: Empty-State failed
  it.todo('should show failed empty message when models empty and last sync failed')

  // AC-7: Empty-State partial
  it.todo('should show partial empty message when models empty but other modes have models')

  // AC-9: Neue Props-Signatur
  it.todo('should accept models prop of type Model[] instead of collectionModels and compatibilityMap')

  // AC-11: onModelChange fuer inpaint mode
  it.todo('should call onModelChange with inpaint mode when model selected in inpaint section')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-server-actions` | `getModels({ capability })` | Server Action | `(input: { capability?: GenerationMode }) => Promise<Model[] \| { error: string }>` |
| `slice-08-types-seed` | `GenerationMode` (5 Werte) | Type Export | Muss `inpaint` und `outpaint` enthalten |
| `slice-08-types-seed` | `MODE_LABELS` (5 Eintraege) | Const Record | Labels fuer alle 5 Modes |
| `slice-08-types-seed` | `TIERS_BY_MODE` (5 Eintraege, korrigiert) | Const Record | Korrekte Tiers pro Mode |
| `slice-09-sync-button` | `window.dispatchEvent("model-settings-changed")` | DOM Event | Wird nach Sync dispatched; dieses Slice lauscht darauf |
| `slice-09-sync-button` | Sync-State (syncing/idle/sync_partial/sync_failed) | React State | Fuer context-aware Empty-State-Bestimmung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Capability-gefilterte Dropdowns | UI Component | (Endnutzer) | Dropdowns zeigen nur Models mit passender Capability |
| `ModelModeSectionProps` (aktualisiert) | Props Interface | `settings-dialog.tsx` | `models: Model[]` statt `collectionModels: CollectionModel[]` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/settings/settings-dialog.tsx` -- MODIFY: `MODES` Array auf 5 Eintraege erweitern, Datenladung von `getCollectionModels` auf `getModels({ capability })` pro Mode umstellen, `compatibilityMap` State + Logik entfernen, `CollectionModel` Import entfernen, `window.addEventListener("model-settings-changed")` fuer Refresh registrieren, Sync-State an `ModelModeSection` weitergeben fuer Empty-State-Bestimmung
- [ ] `components/settings/model-mode-section.tsx` -- MODIFY: Props-Interface aendern (`models: Model[]` statt `collectionModels`/`compatibilityMap`), Dropdown-Filterung auf `capabilities`-Feld umstellen, 4 context-aware Empty-State-Messages implementieren (syncing/never-synced/failed/partial), `CollectionModel` Import entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an Server Actions (`app/actions/models.ts`)
- KEINE Aenderung an Services oder DB-Queries
- KEINE Aenderung an `lib/types.ts` oder Konstanten in `model-mode-section.tsx` (bereits in Slice 08)
- KEINE Sync-Button-Logik (bereits in Slice 09)
- KEINE Auto-Sync-bei-leerem-Katalog-Logik (kommt in spaeteren Slices)
- KEINE Parameter-Panel-Aenderungen (separater Scope)

**Technische Constraints:**
- `settings-dialog.tsx` bleibt eine Client Component (`"use client"`)
- `model-mode-section.tsx` bleibt eine Client Component (`"use client"`)
- Model-Typ: `Model` aus `models.$inferSelect` (Drizzle-inferred), NICHT `CollectionModel`
- Empty-State wird bestimmt durch Kombination aus: (a) `models.length === 0`, (b) aktueller Sync-State (syncing/idle), (c) ob jemals ein Sync lief, (d) ob andere Modes Models haben
- Event-Listener `"model-settings-changed"` MUSS im `useEffect` Cleanup entfernt werden
- Slice 09 hat Sync-State bereits in `settings-dialog.tsx` — dieses Slice nutzt den gleichen State fuer Empty-State-Bestimmung (kein neuer State noetig)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/settings/settings-dialog.tsx` | MODIFY — Datenladung + MODES-Array umbauen. Sync-Button-Code (Slice 09) bleibt unveraendert |
| `components/settings/model-mode-section.tsx` | MODIFY — Props-Interface + Dropdown-Rendering + Empty-States. Konstanten (Slice 08) bleiben unveraendert |
| `app/actions/models.ts` | Import `getModels` — Server Action unveraendert, nur Import nutzen |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Architecture Layers" --> "Read Flow" (getModels mit capability-Filter)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Migration Map" --> `settings-dialog.tsx` und `model-mode-section.tsx` Zeilen
- Wireframes: `specs/phase-7/2026-03-15-model-catalog/wireframes.md` --> Section "Model-Dropdown (Capability-Filtered)" (alle 6 Dropdown-States)
- Discovery: `specs/phase-7/2026-03-15-model-catalog/discovery.md` --> Section "UI Components & States" (model-dropdown States + Messages)
- Discovery: `specs/phase-7/2026-03-15-model-catalog/discovery.md` --> Section "Business Rules" (Capability --> Modal Section Mapping)
