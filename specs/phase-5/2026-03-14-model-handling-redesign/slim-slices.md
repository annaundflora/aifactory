# Slim Slice Decomposition

**Feature:** Model Handling Redesign -- Draft/Quality Tier System
**Discovery-Slices:** 5 (grobe Slices)
**Atomare Slices:** 13
**Stack:** TypeScript / Next.js 16 (App Router, Server Actions, Drizzle ORM, Vitest)

---

## Dependency Graph

```
slice-01 (DB Schema + Migration)
    |
    v
slice-02 (Model Settings Service)
    |
    v
slice-03 (Server Actions model-settings)
    |
    +---------------------------+
    |                           |
    v                           v
slice-04 (Settings Dialog)    slice-05 (Tier Toggle Component)
                                |
                +---------------+---------------+
                |               |               |
                v               v               v
slice-06        slice-07        slice-08
(Workspace      (Generation     (Canvas Context
 Prompt-Area     Integration     Cleanup)
 Tier Toggle)    Workspace)       |
                    |             v
                    |       slice-09        slice-10        slice-11
                    |       (Canvas         (Canvas         (Canvas Chat
                    |        Variation+      Upscale         Tier Toggle)
                    |        Img2Img         Tier Toggle)
                    |        Tier Toggle)
                    |             |               |               |
                    +-------------+---------------+---------------+
                                  |
                                  v
                            slice-12 (Workspace Cleanup: Remove old UI)
                                  |
                                  v
                            slice-13 (Dead Code Cleanup + Deprecation)
```

---

## Slice-Liste

### Slice 1: DB Schema + Migration

- **Scope:** Drizzle-Schema-Definition fuer `modelSettings` Tabelle mit unique constraint auf `(mode, tier)`. Migration-SQL generieren und Seed-Daten (8 Default-Eintraege) einfuegen.
- **Deliverables:**
  - `lib/db/schema.ts` (bestehend, erweitern: `modelSettings` pgTable hinzufuegen)
  - `drizzle/0007_*.sql` (neue Migration, via `drizzle-kit generate`)
- **Done-Signal:** Migration laeuft erfolgreich. `SELECT * FROM model_settings` liefert 8 Seed-Eintraege mit korrekten mode/tier/model_id Kombinationen.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Model Settings Schema + Service"

---

### Slice 2: Model Settings Service

- **Scope:** Neuer Service `ModelSettingsService` mit Funktionen: `getAll()`, `getForModeTier()`, `update()`, `seedDefaults()`, `checkCompatibility()`. Dazu die DB-Query-Funktionen in `queries.ts`.
- **Deliverables:**
  - `lib/db/queries.ts` (bestehend, erweitern: `getAllModelSettings`, `getModelSettingByModeTier`, `upsertModelSetting`, `seedModelSettingsDefaults`)
  - `lib/services/model-settings-service.ts` (neu)
- **Done-Signal:** Unit-Tests: `getAll()` liefert alle Settings. `update()` upserted korrekt. `checkCompatibility()` nutzt `ModelSchemaService`. `seedDefaults()` ist idempotent (ON CONFLICT DO NOTHING).
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Model Settings Schema + Service"

---

### Slice 3: Server Actions model-settings

- **Scope:** Zwei neue Server Actions: `getModelSettings` (liest alle Settings, seeded bei leerer Tabelle) und `updateModelSetting` (validiert Input, Schema-Check, upserted). Typ-Definitionen fuer `Tier`, `GenerationMode`-Erweiterung, `UpdateModelSettingInput`.
- **Deliverables:**
  - `app/actions/model-settings.ts` (neu)
  - `lib/types.ts` (neu: `Tier` Type, `UpdateModelSettingInput` DTO)
- **Done-Signal:** `getModelSettings()` liefert `ModelSetting[]`. `updateModelSetting({ mode: "txt2img", tier: "draft", modelId: "owner/name" })` speichert und liefert aktualisierte Zeile. Ungueltige `modelId`-Formate werden abgelehnt. `(upscale, max)` wird rejected.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Model Settings Schema + Service"

---

### Slice 4: Settings Dialog UI

- **Scope:** Settings-Button im Workspace Header (Gear-Icon). Modal-Dialog mit 3 Mode-Sections (txt2img, img2img, upscale), je 2-3 Model-Dropdowns (Draft/Quality/Max). Dropdowns laden Models via `CollectionModelService`, filtern nach Kompatibilitaet. Auto-Save bei Auswahl.
- **Deliverables:**
  - `components/settings/settings-dialog.tsx` (neu)
  - `components/settings/model-mode-section.tsx` (neu)
  - `components/workspace/workspace-header.tsx` (bestehend, erweitern: Settings-Button + Dialog-State)
- **Done-Signal:** Settings-Button oeffnet Modal. 3 Sections sichtbar. Dropdowns zeigen Models aus Collection. Inkompatible Models ausgegraut. Auswahl aendern -> Dialog schliessen -> erneut oeffnen -> neue Auswahl persistiert.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 2 "Settings Dialog UI"

---

### Slice 5: Tier Toggle Component

- **Scope:** Wiederverwendbare `TierToggle`-Komponente (Segmented Control: Draft | Quality) und `MaxQualityToggle`-Komponente (Toggle Button, nur bei Quality sichtbar). Props: `tier`, `onTierChange`, `showMaxQuality`, `maxQuality`, `onMaxQualityChange`, `disabled`.
- **Deliverables:**
  - `components/ui/tier-toggle.tsx` (neu)
  - `components/ui/max-quality-toggle.tsx` (neu)
- **Done-Signal:** Komponenten rendern korrekt. Draft/Quality Toggle wechselt Segment. Max Quality Toggle erscheint nur bei Quality. Disabled-State waehrend Generation. Visuell konsistent mit `mode-selector.tsx` Pattern.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 3 "Workspace Tier Toggle + Generation Integration"

---

### Slice 6: Workspace Prompt-Area Tier Toggle

- **Scope:** `TierToggle` + `MaxQualityToggle` in die Prompt-Area einbauen (oberhalb Generate/Upscale-Button). Tier-State als lokaler `useState`. Model-Settings beim Mount fetchen und cachen. Entfernung der alten Model-Section und Parameter-Panel-Einbindung in der Prompt-Area.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (bestehend, aendern)
- **Done-Signal:** Prompt-Area zeigt Tier-Toggle statt Model-Section/Parameter-Panel. Draft ist Default. Quality zeigt Max-Toggle. Tier-State wechselt korrekt. Keine ModelTrigger, ModelBrowserDrawer, ParameterPanel Imports mehr in dieser Datei.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 3 "Workspace Tier Toggle + Generation Integration"

---

### Slice 7: Workspace Generation Integration

- **Scope:** `handleGenerate()` in `prompt-area.tsx` nutzt Tier-basiertes Model aus gecachten Settings. Fuer txt2img/img2img: `modelIds: [resolvedModelId]`, `params: resolvedParams`. Fuer Upscale: `upscaleImage()` erhaelt `modelId` + `modelParams` aus Settings. Server Action `upscaleImage` in `generations.ts` anpassen: `modelId` + `modelParams` akzeptieren, kein hardcoded `UPSCALE_MODEL` mehr. Generation Service `upscale()` Signatur erweitern.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (bestehend, Generation-Logik aendern)
  - `app/actions/generations.ts` (bestehend, `upscaleImage` Input erweitern)
  - `lib/services/generation-service.ts` (bestehend, `upscale()` Signatur aendern)
- **Done-Signal:** Draft-Generation nutzt Draft-Model (z.B. flux-schnell). Quality-Generation nutzt Quality-Model. Max-Quality nutzt Max-Model. Upscale nutzt Tier-basiertes Model. `generations.modelId` speichert das tatsaechlich verwendete Model.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 3 "Workspace Tier Toggle + Generation Integration"

---

### Slice 8: Canvas Context Cleanup

- **Scope:** `selectedModelId` aus Canvas-Detail-Context entfernen. `SET_SELECTED_MODEL` Action entfernen. Alle Stellen die `state.selectedModelId` lesen, auf Settings-basierte Model-Resolution umstellen. Model-Settings-State in `canvas-detail-view.tsx` hinzufuegen (fetch on mount).
- **Deliverables:**
  - `lib/canvas-detail-context.tsx` (bestehend, `selectedModelId` + Action entfernen)
  - `components/canvas/canvas-detail-view.tsx` (bestehend, Model-Settings fetch + Model-Resolution in Handlern)
- **Done-Signal:** TypeScript kompiliert ohne Fehler. Keine Referenz auf `selectedModelId` oder `SET_SELECTED_MODEL` mehr. Canvas-Tool-Handler (`handleVariationGenerate`, `handleImg2imgGenerate`, `handleUpscale`) nutzen Settings-basierte Model-Resolution.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 4 "Canvas Tier Toggle + Tool Integration"

---

### Slice 9: Canvas Variation + Img2Img Popover Tier Toggle

- **Scope:** `TierToggle` + `MaxQualityToggle` in Variation-Popover und Img2Img-Popover einbauen. Jeweils eigener Tier-State. Tier wird via erweiterte `VariationParams`/`Img2imgParams` (+ `tier: Tier`) an den Parent propagiert. Parent (`canvas-detail-view.tsx`) resolved Model aus Settings + Tier.
- **Deliverables:**
  - `components/canvas/popovers/variation-popover.tsx` (bestehend, erweitern)
  - `components/canvas/popovers/img2img-popover.tsx` (bestehend, erweitern)
  - `components/canvas/canvas-detail-view.tsx` (bestehend, Handler fuer Tier-Parameter erweitern)
- **Done-Signal:** Variation-Popover zeigt Tier-Toggle + Max-Toggle. Img2Img-Popover ebenso. Generate mit Draft nutzt Draft-Model. Generate mit Quality nutzt Quality-Model. Tier-States sind pro Popover unabhaengig.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 4 "Canvas Tier Toggle + Tool Integration"

---

### Slice 10: Canvas Upscale Popover Tier Toggle

- **Scope:** `TierToggle` in Upscale-Popover einbauen (kein Max-Toggle, da Upscale kein Max-Tier hat). Tier an Parent propagieren. Parent resolved Model aus Settings + Tier und uebergibt `modelId` + `modelParams` an `upscaleImage()`.
- **Deliverables:**
  - `components/canvas/popovers/upscale-popover.tsx` (bestehend, erweitern)
  - `components/canvas/canvas-detail-view.tsx` (bestehend, `handleUpscale` Tier-Parameter)
- **Done-Signal:** Upscale-Popover zeigt Tier-Toggle (Draft | Quality, kein Max). Draft Upscale nutzt Real-ESRGAN. Quality Upscale nutzt Crystal-Upscaler.
- **Dependencies:** ["slice-08", "slice-07"]
- **Discovery-Quelle:** Slice 4 "Canvas Tier Toggle + Tool Integration"

---

### Slice 11: Canvas Chat Panel Tier Toggle

- **Scope:** `TierToggle` + `MaxQualityToggle` in Canvas Chat Panel einbauen (kompakte Leiste ueber Chat-Input). Eigener Tier-State. `handleCanvasGenerate()` ignoriert `event.model_id` und resolved Model aus img2img Settings + Chat-Tier.
- **Deliverables:**
  - `components/canvas/canvas-chat-panel.tsx` (bestehend, erweitern)
- **Done-Signal:** Chat Panel zeigt Tier-Toggle ueber Input. Tier-State unabhaengig von Popovers. Chat-generierte Bilder nutzen das img2img Model des gewaehlten Tiers. Tier-Toggle bleibt interaktiv waehrend Streaming, disabled waehrend Generation.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 4 "Canvas Tier Toggle + Tool Integration"

---

### Slice 12: Workspace Cleanup -- Remove Old UI Components

- **Scope:** Entfernung von `CanvasModelSelector` aus Canvas Header Rendering. Entfernung aller verbliebenen Imports/Referenzen auf `ModelBrowserDrawer`, `ModelTrigger`, `ParameterPanel` aus Workspace- und Canvas-Komponenten. Center-Slot im Canvas Header leeren.
- **Deliverables:**
  - `components/canvas/canvas-header.tsx` (bestehend, CanvasModelSelector-Slot leeren)
  - `components/canvas/canvas-detail-view.tsx` (bestehend, CanvasModelSelector Import/Render entfernen)
- **Done-Signal:** Keine Imports von `CanvasModelSelector`, `ModelBrowserDrawer`, `ModelTrigger`, `ParameterPanel` mehr in aktiven Render-Pfaden. Canvas Header Center-Slot ist leer. TypeScript kompiliert ohne Fehler.
- **Dependencies:** ["slice-09", "slice-10", "slice-11"]
- **Discovery-Quelle:** Slice 5 "Cleanup + Deprecation"

---

### Slice 13: Dead Code Cleanup + Deprecation

- **Scope:** Deprecation-Kommentare an `favorite_models` und `project_selected_models` Tabellen im Schema. Entfernung der Server Actions `getFavoriteModels`, `toggleFavoriteModel`, `getProjectSelectedModels`, `saveProjectSelectedModels` aus `app/actions/models.ts`. Entfernung ungenutzter Query-Funktionen fuer alte Tabellen. Entfernung `UPSCALE_MODEL` Konstante aus `lib/models.ts` (falls nicht mehr referenziert). Lint + TypeScript-Compiler-Check: keine ungenutzten Imports.
- **Deliverables:**
  - `app/actions/models.ts` (bestehend, deprecated Actions entfernen)
  - `lib/db/queries.ts` (bestehend, deprecated Query-Funktionen entfernen)
  - `lib/db/schema.ts` (bestehend, Deprecation-Kommentare an alte Tabellen)
- **Done-Signal:** `pnpm lint` und `pnpm build` ohne Fehler. Keine ungenutzten Imports. Alle Tests gruen. `getFavoriteModels`, `toggleFavoriteModel`, `getProjectSelectedModels`, `saveProjectSelectedModels` existieren nicht mehr. App funktioniert vollstaendig ohne entfernte Funktionen.
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 5 "Cleanup + Deprecation"

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert

## Coverage-Matrix: Discovery-Slices zu Slim-Slices

| Discovery Slice | Slim Slices |
|-----------------|-------------|
| 1: Model Settings Schema + Service | slice-01, slice-02, slice-03 |
| 2: Settings Dialog UI | slice-04 |
| 3: Workspace Tier Toggle + Generation Integration | slice-05, slice-06, slice-07 |
| 4: Canvas Tier Toggle + Tool Integration | slice-08, slice-09, slice-10, slice-11 |
| 5: Cleanup + Deprecation | slice-12, slice-13 |
