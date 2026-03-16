# Feature: Model Catalog

**Epic:** --
**Status:** Draft
**Wireframes:** --

---

## Problem & Solution

**Problem:**
- Model-Capabilities (Inputs, Aspect Ratios, Resolutions, img2img-Support) werden per Live-API-Call von Replicate geholt und nur im In-Memory-Cache gehalten
- Die App weiß vor einem API-Call nicht, welche Parameter ein Model unterstützt
- UI kann keine modellspezifischen Controls (Aspect Ratio Dropdown, Megapixel-Selector) anbieten, ohne vorher die API zu fragen
- img2img-Feld-Erkennung ist hardcoded in `model-schema-service.ts` (6+ Feldnamen-Prioritätsliste)
- Beim App-Neustart gehen alle Schema-Caches verloren

**Solution:**
- Neue `models`-Tabelle als persistenter Model-Katalog mit vollem OpenAPI Input-Schema
- Auto-Sync von 3 Replicate Collections (text-to-image, image-editing, super-resolution)
- Schema-basierte Capability-Detection (txt2img, img2img, upscale, inpaint, outpaint)
- UI liest Schema aus DB statt Live-API → Parameter-Panel und Dropdowns reagieren sofort

**Business Value:**
- Optimale API-Calls: App sendet nur Parameter die das Model versteht
- Bessere UX: Modellspezifische Controls sofort verfügbar, keine Loading-Delays
- Wartbarkeit: Neue Models brauchen keinen Code-Change, nur einen Sync

---

## Scope & Boundaries

| In Scope |
|----------|
| `models`-Tabelle in DB (Drizzle Schema + Migration) |
| Sync-Service: Bulk-Fetch aller 3 Collections + Schema pro Model |
| Capability-Detection: Schema → Capabilities (txt2img, img2img, upscale, inpaint, outpaint) |
| Delta-Sync via `version_hash` (nur bei Schema-Änderung neu parsen) |
| Paralleles Fetching mit Concurrency-Limit (~5) |
| Soft-Delete (`is_active` Flag) für entfernte Models |
| Ersetzung von `CollectionModelService` und `ModelSchemaService` |
| UI: Model-Settings-Dropdowns filtern nach Capability |
| UI: Parameter-Panel liest Schema aus DB |
| UI: Sync-Button im Model Settings Modal |
| UI: Progress-Toast während Sync |
| Auto-Sync beim ersten App-Start (leere Tabelle) |
| On-the-fly Schema-Fetch wenn Model in Dropdown gewählt aber nicht in DB |

| Out of Scope |
|--------------|
| Periodischer Cron-basierter Sync |
| Manuelle Eingabe beliebiger Model-IDs (nur DB-Models in Dropdowns) |
| Model-Vergleich / Empfehlungs-Features |
| Kosten/Pricing-Informationen pro Model |
| Training-Endpoints / LoRA-Management |
| Änderungen an `model_settings`-Tabelle (bleibt unverändert) |

---

## Current State Reference

> Existierende Funktionalität, die wiederverwendet wird (unverändert):

- **`model_settings`-Tabelle:** Speichert Mode/Tier → Model-Zuordnung + Default-Params (bleibt unverändert)
- **`generations`-Tabelle:** Speichert modelId + modelParams pro Generation (bleibt unverändert)
- **Parameter-Panel (`parameter-panel.tsx`):** Rendert Schema-Properties dynamisch (Enums → Select, Integer/Number → Input)
- **Model Settings Modal:** Dropdowns für Mode/Tier-Zuordnung (wird erweitert um Capability-Filter + Sync-Button)
- **Replicate Client (`replicate.ts`):** Rate-Limiting, Retry-Logic, Prediction-Tracking (bleibt unverändert)
- **Generation Service (`generation-service.ts`):** `buildReplicateInput()` merged modelParams + prompt (bleibt, liest künftig Schema aus DB)

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Modal | `model-settings-modal.tsx` | Erweitert um Sync-Button |
| Select/Dropdown | Bestehende Model-Dropdowns | Erweitert um Capability-Filter |
| Toast | Bestehende Toast-Notifications | Progress-Toast für Sync |
| Parameter-Panel | `parameter-panel.tsx` | Datenquelle ändert sich (DB statt Live-API) |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Progress-Toast | Toast mit Fortschrittsanzeige ("Syncing Models... 45/120") | Sync dauert ~20-30s, User braucht Feedback |

---

## User Flow

### Flow 1: Erster App-Start (leere DB)

1. App startet → System prüft ob `models`-Tabelle leer ist
2. Tabelle leer → System startet Auto-Sync im Hintergrund
3. User sieht Progress-Toast: "Syncing Models... 0/120"
4. System fetcht 3 Collections parallel (text-to-image, image-editing, super-resolution)
5. System fetcht Schema pro Model (parallel, max 5 concurrent)
6. System leitet Capabilities aus Schema ab
7. System speichert alles in DB, dedupliziert über `replicate_id`
8. Toast: "120 Models synced" → verschwindet
9. Model-Settings-Dropdowns zeigen jetzt gefilterte Models

### Flow 2: Manueller Sync

1. User öffnet Model Settings Modal
2. User klickt "Sync Models" Button
3. System startet Sync → Progress-Toast: "Syncing Models..."
4. Neue Models: `is_active = true`, Schema + Capabilities gespeichert
5. Entfernte Models: `is_active = false`
6. Bestehende Models: `version_hash` vergleichen, bei Änderung Schema+Capabilities updaten
7. Toast: "95 Models synced, 3 new, 1 updated, 25 failed" (Partial Success)
8. Dropdowns aktualisieren sich

### Flow 3: Model-Zuweisung im Settings Modal

1. User öffnet Dropdown für "Text to Image → Quality"
2. Dropdown zeigt nur Models mit `capabilities.txt2img = true`
3. User wählt Model → System prüft ob Schema in DB vorhanden
4. Schema vorhanden → Parameter-Panel aktualisiert sich sofort
5. Schema nicht vorhanden → On-the-fly Fetch, kurzes Loading (~1-2s), dann Panel-Update

**Error Paths:**
- Replicate API nicht erreichbar → Toast: "Sync failed: API not reachable. Existing data unchanged."
- Rate-Limit (429) → Retry mit Backoff, dann Partial Success
- Einzelnes Model-Schema fehlgeschlagen → Wird übersprungen, Rest wird gespeichert

---

## UI Layout & Context

### Screen: Model Settings Modal (erweitert)

**Position:** Modal, geöffnet über Settings-Icon im Workspace
**When:** User will Models zuweisen oder syncen

**Layout:**
- Header: "Model Settings" + Close-Button
- NEU: Sync-Button rechts oben neben Close oder unter dem Header-Text
- Sections: TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE (wie bisher)
- Pro Section: Tier-Dropdowns (Draft, Quality, Max)
- Dropdowns: NEU gefiltert nach Capability des jeweiligen Modes

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `sync-button` | Button | Model Settings Modal Header | `idle`, `syncing`, `disabled` | Startet Bulk-Sync. Disabled während Sync läuft |
| `sync-toast` | Toast | Global Toast Area | `progress`, `success`, `partial`, `error` | Zeigt Sync-Fortschritt und Ergebnis |
| `model-dropdown` | Select | Pro Mode/Tier Row | `loaded`, `empty`, `loading` | Zeigt nur Models mit passender Capability |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `no_models` | Dropdowns leer, Auto-Sync startet | Warten |
| `syncing` | Progress-Toast sichtbar, Sync-Button disabled | Abbrechen (optional) |
| `synced` | Dropdowns gefüllt, Sync-Button idle | Model auswählen, Sync starten |
| `sync_partial` | Toast zeigt Fehler-Summary | Erneut syncen, Models nutzen |
| `sync_failed` | Error-Toast | Erneut syncen |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `no_models` | App-Start, Tabelle leer | Progress-Toast | `syncing` | Automatisch, kein User-Input |
| `synced` | User klickt Sync-Button | Progress-Toast | `syncing` | -- |
| `syncing` | Alle Models erfolgreich | Success-Toast "X Models synced" | `synced` | -- |
| `syncing` | Teilerfolg | Partial-Toast "X synced, Y failed" | `sync_partial` | Erfolgreiche Models werden gespeichert |
| `syncing` | Komplettfehler (API down) | Error-Toast | `sync_failed` | Bestehende DB-Daten bleiben unverändert |
| `sync_partial` | User klickt Sync erneut | Progress-Toast | `syncing` | -- |
| `sync_failed` | User klickt Sync erneut | Progress-Toast | `syncing` | -- |

---

## Business Rules

- **Deduplizierung:** Models werden über `replicate_id` (`owner/name`) dedupliziert. Ein Model kann in mehreren Collections vorkommen
- **Capability-Detection aus Schema:**
  - `txt2img`: Model hat `prompt`-Feld → true
  - `img2img`: Model hat Image-Input-Feld OHNE `mask`-Feld (Felder: `input_images`, `image_input`, `images`, `input_image`, `image_prompt`, `init_image`, `image`)
  - `inpaint`: Model hat `image` + `mask` Felder, ODER Description enthält "inpainting"
  - `outpaint`: Description enthält "outpainting" oder "expand", ODER hat `outpaint`-Parameter
  - `upscale`: Model in super-resolution Collection, ODER hat `scale`-Parameter + `image`-Input ohne `prompt`
- **Dropdown-Filter:** txt2img-Dropdown zeigt nur Models mit `capabilities.txt2img = true`, analog für andere Modes
- **Soft-Delete:** Models die nicht mehr in Collections sind: `is_active = false`. Bleiben in DB für historische Referenzen
- **Delta-Sync:** Schema wird nur neu geparst wenn `latest_version.id` sich vom gespeicherten `version_hash` unterscheidet
- **Concurrency:** Max 5 parallele Replicate API-Requests beim Sync
- **Partial Success:** Erfolgreiche Models werden gespeichert, fehlgeschlagene übersprungen
- **Nur DB-Models:** Dropdowns zeigen ausschließlich Models aus der `models`-Tabelle (kein Freitext)

---

## Data

### Neue Tabelle: `models`

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Ja | uuid, PK | Auto-generated |
| `replicate_id` | Ja | varchar(255), unique | Format: `owner/name` |
| `owner` | Ja | varchar(100) | z.B. "black-forest-labs" |
| `name` | Ja | varchar(100) | z.B. "flux-2-pro" |
| `description` | Nein | text | Aus Replicate API |
| `cover_image_url` | Nein | text | Aus Replicate API |
| `run_count` | Nein | integer | Aus Replicate API, bei Sync aktualisiert |
| `collections` | Nein | text[] | z.B. `['text-to-image', 'image-editing']` |
| `capabilities` | Ja | jsonb | `{txt2img: bool, img2img: bool, upscale: bool, inpaint: bool, outpaint: bool}` |
| `input_schema` | Nein | jsonb | Volles OpenAPI Input-Schema (`components.schemas.Input.properties`) |
| `version_hash` | Nein | varchar(64) | `latest_version.id` für Delta-Sync |
| `is_active` | Ja | boolean, default true | Soft-Delete Flag |
| `last_synced_at` | Nein | timestamp | Letzter erfolgreicher Schema-Sync |
| `created_at` | Ja | timestamp, default now | -- |
| `updated_at` | Ja | timestamp, default now | -- |

### Capability-Schema (JSONB)

```json
{
  "txt2img": true,
  "img2img": true,
  "upscale": false,
  "inpaint": false,
  "outpaint": false
}
```

---

## Implementation Slices

### Dependencies

```
Slice 1 → Slice 2 → Slice 3
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | DB Schema + Sync Service | `models`-Tabelle (Drizzle Schema + Migration), Sync-Service (Collection-Fetch + Schema-Fetch + Capability-Detection), Delta-Sync via version_hash, Parallel-Fetching, Soft-Delete | Sync-Service aufrufen → Models in DB prüfen. Capabilities korrekt abgeleitet. Delta-Sync: Erneuter Sync ohne Änderung → kein Schema-Re-Parse | -- |
| 2 | Service-Ersetzung | `CollectionModelService` ersetzen → DB-Read. `ModelSchemaService` ersetzen → DB-Read. On-the-fly Schema-Fetch für unbekannte Models. Parameter-Panel Datenquelle ändern | Bestehende Funktionalität identisch. Parameter-Panel zeigt gleiche Controls wie vorher. Generation funktioniert wie vorher | Slice 1 |
| 3 | UI Integration | Sync-Button im Model Settings Modal. Progress-Toast. Dropdown-Filter nach Capability. Auto-Sync bei leerem Katalog | Sync-Button klicken → Progress-Toast → Models in Dropdowns. Dropdowns zeigen nur kompatible Models. Erster Start → Auto-Sync | Slice 2 |

### Recommended Order

1. **Slice 1:** DB Schema + Sync Service -- Fundament, keine UI-Abhängigkeit
2. **Slice 2:** Service-Ersetzung -- Baut auf DB auf, keine UI-Änderung, testbar über bestehende Flows
3. **Slice 3:** UI Integration -- Baut auf funktionierende Services auf, rein Frontend

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Model Settings Seeding | `lib/db/queries.ts:503-521` | Default-Models werden beim ersten Start geseedet (ähnlich Auto-Sync) |
| In-Memory Schema Cache | `lib/services/model-schema-service.ts` | Wird durch DB-backed Cache ersetzt |
| In-Memory Collection Cache | `lib/services/collection-model-service.ts` | Wird durch DB-backed Service ersetzt |
| img2img Field Detection | `lib/services/model-schema-service.ts:20-46` | Logik wird in Capability-Detection übernommen |
| Replicate Rate-Limiting | `lib/clients/replicate.ts` | Concurrency-Pattern wird für Sync wiederverwendet |

### Web Research

| Source | Finding |
|--------|---------|
| Replicate Collections API | 3 relevante Collections: text-to-image (~96 Models), image-editing (~37), super-resolution (~33). Erhebliche Überlappung |
| Replicate GET /models/{owner}/{name} | Liefert: `latest_version.id` (64-char Hash), `latest_version.openapi_schema.components.schemas.Input.properties`. Kein `updated_at` auf Model-Ebene |
| Replicate Model-Schemas (Flux Schnell, Flux 2 Pro, SDXL, Imagen 4) | Parameter-Vielfalt: aspect_ratio (Enums unterschiedlich), megapixels vs resolution vs width/height, num_outputs, seed, guidance_scale, scheduler, safety_tolerance |
| Replicate text-to-image Collection | 96+ Models von: Black Forest Labs, Google, OpenAI, ByteDance, Stability AI, Ideogram, Recraft, PrunaAI, xAI, Bria, Qwen, Luma, NVIDIA, Tencent, Minimax |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Wireframes für UI-Änderungen erstellen? | A) Ja, nach Discovery B) Nein, minimal genug | A) Ja | -- |
| 2 | Slices 3 oder 2? | A) 3 Slices B) 2 Slices (Backend/Frontend) | A) 3 Slices | -- |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Was ist das Hauptziel der Model-Tabelle? | Optimale API-Calls: App weiß VOR dem Call, welche Parameter ein Model unterstützt |
| 2 | Welche Models sollen erfasst werden? | Alle Capabilities: text-to-image, image-to-image, upscale, inpainting, outpainting. Alle Capabilities pro Model in der Collection speichern |
| 3 | Wie sollen die Model-Daten befüllt werden? | Auto-Sync von Replicate API |
| 4 | Welche Collections sollen als Quelle dienen? | Alle 3: text-to-image + image-editing + super-resolution. Duplikate zusammenführen |
| 5 | Welche Capabilities soll die Tabelle tracken? | Volles OpenAPI Input-Schema als JSONB |
| 6 | Wie tief soll die Tabelle normalisiert sein? | Flache Tabelle + JSONB (flexibel, einfach erweiterbar) |
| 7 | Wie sollen Capabilities bestimmt werden? | Schema-basiert ableiten: prompt-Feld → txt2img, image-Feld ohne mask → img2img, image+mask → inpaint, etc. |
| 8 | Wann soll der Sync laufen? | Alles auf einmal (Collections + Schemas). Kein Lazy-Fetch, da UI Capabilities VORHER braucht. Delta-Sync via version_hash |
| 9 | Was passiert mit der model_settings Tabelle? | Bleibt unverändert. Lookup über replicate_id String-Match. models ist Katalog, model_settings ist Zuordnung |
| 10 | Soll version_hash gespeichert werden? | Ja, als varchar(64). Schema-Parsing nur bei Hash-Änderung |
| 11 | Parallelisierung beim Sync? | Ja, max 5 concurrent Requests |
| 12 | Welche Spalten neben Schema? | Minimal: replicate_id, owner, name, description, cover_image_url, run_count, capabilities (jsonb), input_schema (jsonb), version_hash, is_active, last_synced_at |
| 13 | Collection-Herkunft speichern? | Ja, als text[] Array |
| 14 | Empty State (erster App-Start)? | Auto-Sync wenn models-Tabelle leer |
| 15 | Custom Model-IDs erlauben? | Nein, nur DB-Models in Dropdowns |
| 16 | Dropdown-Filterung? | Nach Capability filtern (txt2img-Dropdown nur txt2img-Models) |
| 17 | Parameter-Panel Scope? | Alle Schema-Parameter aus DB anzeigen (wie heute, aber Quelle = DB statt Live-API) |
| 18 | Sync-Feedback? | Progress-Toast mit Fortschritt |
| 19 | Error Handling beim Sync? | Partial Success: Erfolgreiche speichern, fehlgeschlagene überspringen, Summary anzeigen |
| 20 | Sollen bestehende Services ersetzt werden? | Ja, CollectionModelService + ModelSchemaService werden durch neuen DB-backed Service ersetzt |
| 21 | Lifecycle entfernter Models? | Soft-Delete via is_active Flag |
