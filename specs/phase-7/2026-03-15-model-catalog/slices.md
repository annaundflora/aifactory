# Slice Decomposition

**Feature:** Model Catalog
**Discovery-Slices:** 3 (DB Schema + Sync Service, Service-Ersetzung, UI Integration)
**Atomare Slices:** 12
**Stack:** TypeScript/Next.js (Drizzle ORM, Server Actions, React) — Test Framework: vitest

---

## Dependency Graph

```
slice-01  DB Schema & Migration
    |
    v
slice-02  Capability Detection (pure functions)
    |
    v
slice-03  Model Catalog Service (DB reads)
    |
    v
slice-04  Model Sync Service (bulk sync orchestration)
    |
    v
slice-05  Sync Route Handler (streaming endpoint)
    |
    +-----------------------------+
    |                             |
    v                             v
slice-06  Server Actions        slice-07  Service-Ersetzung
  (getModels, getModelSchema,       (generation-service,
   triggerSync)                      model-settings-service)
    |                             |
    +-----------------------------+
    |
    v
slice-08  Types & Seed Update (GenerationMode + TIERS_BY_MODE + seed)
    |
    +------------------+------------------+
    |                  |                  |
    v                  v                  v
slice-09           slice-10           slice-11
Sync-Button &      Model-Dropdown     Auto-Sync &
Progress-Toast     Capability-Filter  On-the-fly Fetch
    |                  |                  |
    +------------------+------------------+
    |
    v
slice-12  Cleanup (Remove legacy services + types)
```

---

## Slice-Liste

### Slice 1: DB Schema & Migration
- **Scope:** Drizzle-Schema fuer die neue `models`-Tabelle definieren (uuid PK, replicate_id UNIQUE, capabilities JSONB, input_schema JSONB, is_active, timestamps). Migration generieren lassen.
- **Deliverables:**
  - `lib/db/schema.ts` (erweitert: neue `models` Table Definition)
  - `drizzle/0011_add_models_table.sql` (generiert via `drizzle-kit generate`)
- **Done-Signal:** `drizzle-kit generate` laeuft ohne Fehler. Migration-SQL enthaelt CREATE TABLE mit allen Spalten und Indexes (uniqueIndex auf replicate_id, index auf is_active). Schema-Typ `typeof models.$inferSelect` ist inferierbar.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "DB Schema + Sync Service"

---

### Slice 2: Capability Detection
- **Scope:** Pure Functions fuer Schema-basierte Capability-Erkennung (`detectCapabilities`) und OpenAPI `$ref`-Aufloesung (`resolveSchemaRefs`). Extrahiert aus bestehender `model-schema-service.ts`. Enthaelt auch `getImg2ImgFieldName` und `getMaxImageCount` als exportierte Funktionen.
- **Deliverables:**
  - `lib/services/capability-detection.ts` (NEU)
  - `lib/services/capability-detection.test.ts` (NEU)
- **Done-Signal:** Unit-Tests in vitest pruefen: (1) `detectCapabilities` erkennt txt2img (prompt-Feld), img2img (image-Feld ohne mask), inpaint (image+mask), outpaint (description-Keywords), upscale (collection+scale). (2) `resolveSchemaRefs` loest `allOf/$ref` korrekt auf. (3) `getImg2ImgFieldName` gibt korrektes Feld zurueck. Alle Tests gruen.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "DB Schema + Sync Service"

---

### Slice 3: Model Catalog Service (DB Reads)
- **Scope:** Read-only Service fuer Modell-Daten aus der DB. Funktionen: `getActiveModels()`, `getModelsByCapability(cap)`, `getModelByReplicateId(id)`, `getModelSchema(replicateId)`. Dazu die DB-Query-Funktionen in `queries.ts`.
- **Deliverables:**
  - `lib/services/model-catalog-service.ts` (NEU)
  - `lib/db/queries.ts` (erweitert: neue Query-Funktionen fuer models-Tabelle)
  - `lib/services/model-catalog-service.test.ts` (NEU)
- **Done-Signal:** Unit-Tests pruefen: `getModelsByCapability("txt2img")` gibt nur Models mit `capabilities.txt2img = true` zurueck. `getModelByReplicateId("owner/name")` gibt korrektes Model oder null. Nur `is_active = true` Models werden zurueckgegeben. Tests gruen.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 2 "Service-Ersetzung"

---

### Slice 4: Model Sync Service
- **Scope:** Bulk-Sync-Orchestrierung: 3 Collections parallel fetchen, deduplizieren ueber `replicate_id`, Schema pro Model parallel holen (max 5 concurrent), `resolveSchemaRefs` + `detectCapabilities` ausfuehren, DB-Upsert (`upsertModel`), Soft-Delete (`deactivateModelsNotIn`), Delta-Sync via `version_hash`. Progress-Callback.
- **Deliverables:**
  - `lib/services/model-sync-service.ts` (NEU)
  - `lib/db/queries.ts` (erweitert: `upsertModel()`, `deactivateModelsNotIn()`)
  - `lib/services/model-sync-service.test.ts` (NEU)
- **Done-Signal:** Unit-Tests mit gemockter Replicate API pruefen: (1) Sync holt 3 Collections, dedupliziert. (2) Delta-Sync: unveraenderter `version_hash` -> kein Schema-Re-Fetch. (3) Soft-Delete: Models nicht mehr in Collections -> `is_active = false`. (4) Partial Success: einzelne Model-Fehler werden uebersprungen. (5) Progress-Callback wird mit (completed, total) aufgerufen. Tests gruen.
- **Dependencies:** ["slice-01", "slice-02", "slice-03"]
- **Discovery-Quelle:** Slice 1 "DB Schema + Sync Service"

---

### Slice 5: Sync Route Handler (Streaming)
- **Scope:** POST Route Handler unter `/api/models/sync` mit `ReadableStream` Response. Auth-Check via `auth()`. Ruft `ModelSyncService.syncAll()` auf und streamt `progress`, `complete`, `error` Events als newline-delimited JSON. Module-scoped Lock gegen parallele Syncs.
- **Deliverables:**
  - `app/api/models/sync/route.ts` (NEU)
- **Done-Signal:** Route antwortet auf POST mit Stream. Auth-Fehler -> 401. Doppelter Sync -> Error-Event "Sync bereits aktiv". Progress-Events enthalten `completed` und `total`. Complete-Event enthaelt `synced`, `failed`, `new`, `updated`.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 1 "DB Schema + Sync Service"

---

### Slice 6: Server Actions (getModels, getModelSchema, triggerSync)
- **Scope:** Server Actions in `app/actions/models.ts` ersetzen: `getCollectionModels` -> `getModels({ capability })` (DB-Read via ModelCatalogService). `getModelSchema` aendern auf DB-first mit On-the-fly-Fallback. `checkImg2ImgSupport` entfernen. `triggerSync` hinzufuegen (delegiert an Route Handler).
- **Deliverables:**
  - `app/actions/models.ts` (modifiziert)
- **Done-Signal:** `getModels({ capability: "txt2img" })` gibt Models aus DB zurueck. `getModelSchema({ modelId: "owner/name" })` liest Schema aus DB; bei `null` -> Replicate-Fetch + Speichern + Rueckgabe. Auth-Guard (`requireAuth`) auf allen Actions. Tests gruen.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 2 "Service-Ersetzung"

---

### Slice 7: Service-Ersetzung (generation-service, model-settings-service)
- **Scope:** `generation-service.ts`: `buildReplicateInput()` aendert Import von `ModelSchemaService` auf `ModelCatalogService`. `model-settings-service.ts`: `checkCompatibility()` liest `capabilities` JSONB aus DB statt Live-API-Call. Beide Services nutzen jetzt DB-backed Daten.
- **Deliverables:**
  - `lib/services/generation-service.ts` (modifiziert)
  - `lib/services/model-settings-service.ts` (modifiziert)
- **Done-Signal:** Bestehende Funktionalitaet identisch: `buildReplicateInput()` merged modelParams + prompt korrekt. `checkCompatibility()` prueft alle 5 Capabilities (txt2img, img2img, upscale, inpaint, outpaint) via DB statt nur img2img via Live-API. Bestehende Tests gruen.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 2 "Service-Ersetzung"

---

### Slice 8: Types & Seed Update
- **Scope:** `GenerationMode` um `"inpaint" | "outpaint"` erweitern. `VALID_GENERATION_MODES` Array aktualisieren. `model-mode-section.tsx`: `MODE_LABELS` fuer 5 Modes, `TIERS_BY_MODE` korrigieren (img2img: draft/quality, upscale: quality/max, inpaint: quality, outpaint: quality). `seedModelSettingsDefaults` korrigieren auf 9 Rows.
- **Deliverables:**
  - `lib/types.ts` (modifiziert: GenerationMode erweitert)
  - `components/settings/model-mode-section.tsx` (modifiziert: MODE_LABELS, TIERS_BY_MODE)
  - `lib/db/queries.ts` (modifiziert: seedModelSettingsDefaults auf 9 Rows)
- **Done-Signal:** TypeScript kompiliert fehlerfrei. `GenerationMode` akzeptiert alle 5 Werte. `TIERS_BY_MODE` hat korrekte Tier-Zuordnungen: txt2img=[draft,quality,max], img2img=[draft,quality], upscale=[quality,max], inpaint=[quality], outpaint=[quality]. Seed erzeugt exakt 9 Rows.
- **Dependencies:** ["slice-06", "slice-07"]
- **Discovery-Quelle:** Slice 2 "Service-Ersetzung" + Slice 3 "UI Integration"

---

### Slice 9: Sync-Button & Progress-Toast
- **Scope:** Sync-Button in `settings-dialog.tsx` unterhalb Header-Titel (rechts-aligned). 3 Button-States: `idle` ("Sync Models"), `syncing` (disabled, Spinner), `sync_partial` (Warning-Badge persistent bis naechster erfolgreicher Sync, Tooltip). Progress-Toast via `sonner`: Streaming-Fetch an `/api/models/sync`, Toast-Updates bei jedem Progress-Event. Success/Partial/Error-Toast mit korrektem Auto-Dismiss-Verhalten.
- **Deliverables:**
  - `components/settings/settings-dialog.tsx` (modifiziert: Sync-Button + handleSync + Toast-Logic)
- **Done-Signal:** Sync-Button klicken -> Progress-Toast "Syncing Models... X/Y". Erfolg -> Success-Toast (auto-dismiss 3s). Partial -> Partial-Toast (user-dismissible) + Warning-Badge am Button. Error -> Error-Toast (user-dismissible). Button disabled waehrend Sync. 60s Client-Timeout.
- **Dependencies:** ["slice-05", "slice-08"]
- **Discovery-Quelle:** Slice 3 "UI Integration"

---

### Slice 10: Model-Dropdown Capability-Filter
- **Scope:** Model-Dropdowns in `settings-dialog.tsx` und `model-mode-section.tsx` zeigen nur Models mit passender Capability. Daten via `getModels({ capability })` Server Action. 5 Sections: TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, OUTPAINT. Empty-State-Messages context-aware: `empty:syncing`, `empty:never-synced`, `empty:failed`, `empty:partial`. Event-basiertes Refresh nach Sync (`window.dispatchEvent("model-settings-changed")`).
- **Deliverables:**
  - `components/settings/settings-dialog.tsx` (modifiziert: Datenladung via getModels, 5 Sections)
  - `components/settings/model-mode-section.tsx` (modifiziert: Capability-Filter, Empty-States)
- **Done-Signal:** Dropdowns in txt2img-Section zeigen nur Models mit `capabilities.txt2img = true`. Analog fuer alle 5 Modes. Leere Dropdowns zeigen korrekte context-aware Message. Nach Sync-Complete aktualisieren sich Dropdowns automatisch.
- **Dependencies:** ["slice-06", "slice-08"]
- **Discovery-Quelle:** Slice 3 "UI Integration"

---

### Slice 11: Auto-Sync & On-the-fly Schema-Fetch
- **Scope:** Auto-Sync bei leerem Katalog: Beim App-Start (oder erster Modal-Oeffnung) pruefen ob `models`-Tabelle leer ist -> automatisch Sync triggern. On-the-fly Schema-Fetch: Wenn Model in Dropdown gewaehlt aber `input_schema` null -> Loading-Spinner im Parameter-Panel, Schema von Replicate holen, in DB speichern, Panel aktualisieren. Hook `use-model-schema.ts` bleibt transparent (Backend-Aenderung bereits in Slice 6).
- **Deliverables:**
  - `components/settings/settings-dialog.tsx` (modifiziert: Auto-Sync Check + Trigger)
  - `lib/hooks/use-model-schema.ts` (ggf. minimale Anpassung fuer Loading-State-Anzeige)
- **Done-Signal:** Erster App-Start mit leerer DB -> Auto-Sync startet automatisch, Progress-Toast sichtbar. Model-Auswahl ohne Schema -> Loading-Spinner -> Schema geladen -> Parameter-Panel aktualisiert. Workspace bleibt waehrend Auto-Sync nutzbar.
- **Dependencies:** ["slice-09", "slice-10"]
- **Discovery-Quelle:** Slice 3 "UI Integration"

---

### Slice 12: Cleanup (Legacy Services & Types entfernen)
- **Scope:** Entfernung nicht mehr benoetigter Dateien: `lib/services/collection-model-service.ts` (ersetzt durch ModelCatalogService), `lib/services/model-schema-service.ts` (aufgeteilt in capability-detection + model-catalog-service), `lib/types/collection-model.ts` (ersetzt durch Drizzle-inferierter Model-Typ). Alle Imports in der Codebase aktualisieren.
- **Deliverables:**
  - `lib/services/collection-model-service.ts` (ENTFERNEN)
  - `lib/services/model-schema-service.ts` (ENTFERNEN)
  - `lib/types/collection-model.ts` (ENTFERNEN)
- **Done-Signal:** Keine Imports auf die drei entfernten Dateien mehr in der Codebase. TypeScript kompiliert fehlerfrei. `vitest run` laeuft gruen. Keine In-Memory-Caches mehr fuer Model-Daten.
- **Dependencies:** ["slice-06", "slice-07", "slice-10", "slice-11"]
- **Discovery-Quelle:** Slice 2 "Service-Ersetzung"

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| 1 "DB Schema + Sync Service" | Sync-Service aufrufen -> Models in DB pruefen | Slice 4 (Sync Service) + Slice 5 (Route Handler) | Unit-Tests: Sync holt Collections, dedupliziert, speichert in DB. Route Handler streamt Events. |
| 1 "DB Schema + Sync Service" | Capabilities korrekt abgeleitet | Slice 2 (Capability Detection) | Unit-Tests: detectCapabilities erkennt alle 5 Capabilities korrekt anhand Schema + Description + Collection |
| 1 "DB Schema + Sync Service" | Delta-Sync: erneuter Sync ohne Aenderung -> kein Schema-Re-Parse | Slice 4 (Sync Service) | Unit-Test: unveraenderter version_hash -> kein erneuter Schema-Fetch |
| 2 "Service-Ersetzung" | Bestehende Funktionalitaet identisch | Slice 7 (Service-Ersetzung) | buildReplicateInput() und checkCompatibility() funktionieren wie vorher, aber mit DB-Daten. Bestehende Tests gruen |
| 2 "Service-Ersetzung" | Parameter-Panel zeigt gleiche Controls wie vorher | Slice 6 (Server Actions) + Slice 7 (Service-Ersetzung) | getModelSchema liefert identisches Schema-Format. Parameter-Panel rendert gleiche Controls |
| 2 "Service-Ersetzung" | Generation funktioniert wie vorher | Slice 7 (Service-Ersetzung) | generation-service.ts nutzt DB-Schema. Bestehende Generation-Tests gruen |
| 3 "UI Integration" | Sync-Button klicken -> Progress-Toast -> Models in Dropdowns | Slice 9 (Sync-Button & Toast) + Slice 10 (Dropdown-Filter) | Sync-Button triggert Stream. Toast zeigt Progress. Nach Complete: Dropdowns gefuellt |
| 3 "UI Integration" | Dropdowns zeigen nur kompatible Models | Slice 10 (Model-Dropdown Capability-Filter) | txt2img-Dropdown zeigt nur txt2img-Models. Analog fuer alle 5 Capabilities |
| 3 "UI Integration" | Erster Start -> Auto-Sync | Slice 11 (Auto-Sync & On-the-fly Fetch) | Leere DB -> Auto-Sync startet automatisch. Progress-Toast sichtbar. Workspace nutzbar |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
- [x] Flow-Completeness: Jeder Integration-Testfall aus Discovery-Testability hat einen zugehoerigen Slice mit passendem Done-Signal
