# Feature: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Epic:** --
**Status:** Draft
**Wireframes:** -- (optional, same folder)

---

## Problem & Solution

**Problem:**
- Nutzer haben aktuell KEINE Moeglichkeit, Seitenverhaeltnis oder Aufloesung zu waehlen
- Alle Generierungen nutzen Model-Defaults (typisch: 1:1, 1 MP)
- Verschiedene Models nutzen unterschiedliche Parameter-Namen fuer Groesse (`megapixels` vs `resolution`)
- Weitere nuetzliche Model-Parameter (quality, background, etc.) sind nicht zugaenglich

**Solution:**
- Schema-basierte Parameter Controls in Prompt Panel (txt2img + img2img) und Canvas Popovers (Variation + Img2img) einbauen
- Primary/Advanced Split: Haeufig genutzte Controls (Aspect Ratio, Groesse) immer sichtbar, Rest unter "Advanced" einklappbar
- Bestehende `ParameterPanel`-Komponente und `getModelSchema` Server Action wiederverwenden

**Business Value:**
- Nutzer koennen Bilder in gewuenschtem Format generieren (Landscape, Portrait, Square, Widescreen)
- Hoehere/niedrigere Aufloesung waehlbar je nach Use Case
- Zugang zu allen Model-spezifischen Parametern (quality, background, etc.) ohne Code-Aenderung bei neuen Models

---

## Scope & Boundaries

| In Scope |
|----------|
| Schema-basierte Controls in Prompt Panel (txt2img + img2img) |
| Schema-basierte Controls in Canvas Variation Popover |
| Schema-basierte Controls in Canvas Img2img Popover |
| Primary/Advanced Split: Primary-Fields immer sichtbar, Advanced einklappbar |
| Primary-Whitelist: `aspect_ratio`, `megapixels`, `resolution` |
| Alle anderen Schema-Properties als Advanced Controls |
| Multi-Model-Support: Flux, Nano Banana 2, GPT Image 1.5, Hunyuan Image 3 |
| Schema-basierte Optionen (dynamisch per Model von Replicate API) |
| Merge von User-gewaehlten Params mit DB-modelParams |

| Out of Scope |
|--------------|
| Model-Auswahl-UI (Model wird in Admin-Settings konfiguriert, nicht im Generierungs-UI) |
| Upscale Mode (keine aspect_ratio/megapixels/resolution relevant) |
| Custom Width/Height Eingabe (nur enum-basierte Optionen) |
| Persistenz der User-Auswahl ueber Sessions hinweg |

---

## Current State Reference

- `ParameterPanel` (`components/workspace/parameter-panel.tsx`) -- generischer Schema-zu-UI Renderer, unterstuetzt enum->Select und number->Input, bereits getestet mit `aspect_ratio`
- `getModelSchema` Server Action (`app/actions/models.ts:25`) -- gibt Schema-Properties fuer modelId zurueck
- `ModelSchemaService` (`lib/services/model-schema-service.ts`) -- fetcht & cached Replicate OpenAPI Schema, resolved $ref-enums
- `resolveModel()` in `prompt-area.tsx:128` -- loest mode+tier+maxQuality -> modelId + modelParams auf
- `buildReplicateInput()` (`lib/services/generation-service.ts:263`) -- spread `...params` -> automatisch mitgesendet wenn in params
- `modelSettings` werden in `canvas-detail-view.tsx` bereits geladen
- TierToggle + MaxQualityToggle existieren in allen 3 Locations
- `model_settings` Tabelle unterstuetzt bereits beliebige `modelId`s per mode+tier -- Admin kann Model jederzeit aendern

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Schema-Parameter-Renderer | `components/workspace/parameter-panel.tsx` | Rendert Schema-Properties als Select Dropdowns (enum) oder Number Inputs |
| Server Action | `app/actions/models.ts:getModelSchema` | Fetcht Schema fuer aktuell resolved Model |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| `useModelSchema` Hook | React Hook fuer Schema-Fetching mit modelId-basiertem Caching | Wiederverwendbar in 3+ Locations, vermeidet dupliziertes Fetch-Logic |
| `resolveModel` shared Utility | Extrahierte Model-Aufloesung (mode+tier+maxQuality -> modelId) | Aktuell nur in prompt-area.tsx, wird auch in Popovers benoetigt |
| Primary/Advanced Split | ParameterPanel teilt Schema-Properties in Primary (immer sichtbar) und Advanced (einklappbar) | Vermeidet UI-Clutter bei Models mit vielen Parametern (GPT Image 1.5 hat ~6 enum-Properties) |

---

## User Flow

1. User oeffnet Prompt Panel (txt2img oder img2img Mode) -> System zeigt Primary Controls (Aspect Ratio + Groessen-Param) basierend auf aktuellem Model
2. User waehlt Aspect Ratio (z.B. "16:9") -> Wert wird in lokalen imageParams State gespeichert
3. User waehlt Groesse (z.B. megapixels "1" bei Flux, resolution "2K" bei Nano Banana) -> Wert wird in imageParams gespeichert
4. Optional: User klappt "Advanced" auf -> sieht weitere Model-spezifische Parameter (z.B. quality, safety_filter_level, background)
5. User klickt "Generate" -> imageParams werden mit modelParams gemergt und an Replicate gesendet
6. Bild wird mit gewaehlten Parametern generiert

**Canvas-Flow:**
1. User oeffnet Variation/Img2img Popover im Canvas -> System zeigt Primary + Advanced Controls
2. User konfiguriert Werte + andere Popover-Settings -> Generate -> imageParams fliessen in API-Call

**Error Paths:**
- Model-Schema kann nicht geladen werden -> Controls werden nicht angezeigt (graceful degradation, Schema isLoading zeigt Skeleton)
- Tier-Wechsel aendert Model -> Schema wird neu gefetcht, Controls aktualisieren sich, ungueltige Werte werden auf Model-Default zurueckgesetzt
- Model hat keine Primary-Fields -> Primary-Bereich leer, nur Advanced sichtbar (falls Advanced-Fields vorhanden)

---

## UI Layout & Context

### Screen: Prompt Panel (prompt-area.tsx)
**Position:** Rechte Sidebar, Workspace
**When:** txt2img oder img2img Mode aktiv

**Layout:**
- Bereich zwischen Tier Toggle / MaxQuality Toggle und Variant Count Stepper
- Primary Controls: 1-2 Dropdowns (Aspect Ratio + megapixels/resolution) -- immer sichtbar
- Advanced Toggle: "Advanced" Button/Link unter Primary Controls
- Advanced Section (eingeklappt): Weitere Model-spezifische Dropdowns/Inputs
- Compact: Labels + Select Dropdowns, gleicher Style wie bestehende Controls

### Screen: Variation Popover (variation-popover.tsx)
**Position:** Canvas Detail View, links neben Bild
**When:** Variation Tool aktiv

**Layout:**
- Neuer Bereich zwischen Tier Toggle und Generate Button
- Primary Controls + Advanced Toggle
- Gleiche ParameterPanel-Darstellung wie Prompt Panel

### Screen: Img2img Popover (img2img-popover.tsx)
**Position:** Canvas Detail View, links neben Bild
**When:** Img2img Tool aktiv

**Layout:**
- Neuer Bereich zwischen Tier Toggle und Generate Button
- Primary Controls + Advanced Toggle
- Gleiche ParameterPanel-Darstellung wie Prompt Panel

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Primary Controls | ParameterPanel (gefiltert auf Whitelist) | Prompt Panel, Variation Popover, Img2img Popover | `loading` (3 Skeleton-Rows: je Label + Select-Placeholder), `ready` (Dropdowns), `empty` (Model hat keine Primary-Fields) | Zeigt aspect_ratio, megapixels, resolution -- je nach Model-Schema |
| Advanced Toggle | Button/Link | Prompt Panel, Variation Popover, Img2img Popover | `collapsed` (Default), `expanded` | Klick toggled Advanced Section |
| Advanced Controls | ParameterPanel (alle nicht-Primary Properties) | Prompt Panel, Variation Popover, Img2img Popover | `collapsed` (hidden), `expanded` (Dropdowns/Inputs sichtbar), `empty` (keine Advanced-Fields) | Zeigt alle Schema-Properties ausser Primary-Whitelist und interne Felder |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `schema_loading` | Skeleton Placeholders fuer Controls | Warten |
| `schema_ready` | Primary Controls sichtbar, Advanced eingeklappt | Auswahl aendern, Advanced toggling, Generate |
| `schema_empty` | Keine Controls (Model hat keine relevanten Schema-Properties) | Generate ohne diese Params |
| `schema_error` | Keine Controls (Schema-Fetch fehlgeschlagen) | Generate ohne diese Params |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `schema_loading` | Schema erfolgreich geladen, Primary-Fields vorhanden | Primary Controls erscheinen mit Default-Werten | `schema_ready` | -- |
| `schema_loading` | Schema geladen, keine Primary- oder Advanced-Fields | Controls-Bereich nicht sichtbar | `schema_empty` | -- |
| `schema_loading` | Schema-Fetch fehlgeschlagen | Controls-Bereich nicht sichtbar | `schema_error` | -- |
| `schema_ready` | Tier-Wechsel -> anderes Model | Controls kurz Skeleton, dann neue Optionen | `schema_loading` -> `schema_ready` | Ungueltige Werte werden auf Model-Default zurueckgesetzt |
| `schema_ready` | Mode-Wechsel (txt2img <-> img2img) | Controls bleiben wenn gleiches Model | `schema_ready` | imageParams werden per Mode persistiert (siehe Mode Persistence unten) |

---

## Business Rules

- Schema-Properties werden dynamisch aus dem Replicate Model-Schema geladen (nicht hardcoded)
- **Primary-Whitelist:** `aspect_ratio`, `megapixels`, `resolution` -- immer sichtbar wenn im Schema vorhanden
- **Advanced:** Alle anderen Schema-Properties ausser INTERNAL_FIELDS (siehe unten) -- einklappbar
- **INTERNAL_FIELDS** (von ParameterPanel komplett ausgeschlossen, weder Primary noch Advanced):
  - Prompt-Felder: `prompt`, `negative_prompt`
  - Image-Input-Felder (programmatisch gesetzt): `image`, `image_input`, `image_prompt`, `init_image`, `input_image`, `input_images`, `images`
  - Img2img-Steuerung: `prompt_strength`, `strength`
  - Inpainting: `mask`, `mask_prompt`
  - Backend-only: `seed`, `num_outputs`
  - API-Keys: `openai_api_key`
  - Zusaetzlich per Type ausgeschlossen: `type === "string"` ohne enum, `type === "boolean"`, `type === "array"` ohne enum
- Wenn das Model ein Primary-Field nicht hat -> entsprechendes Control nicht anzeigen (kein Platzhalter)
- User-gewaehlte Werte ueberschreiben Model-Defaults beim Merge in params
- Bei Model-Wechsel (Tier-Aenderung oder Admin-Settings-Aenderung): wenn der gewaehlte Wert im neuen Schema nicht existiert -> auf Model-Default zuruecksetzen
- Upscale Mode zeigt keine Controls (nicht relevant)
- Model-Auswahl erfolgt ausschliesslich ueber Admin-Settings (`model_settings` Tabelle), nicht im Generierungs-UI

### Mode Persistence fuer imageParams

`imageParams: Record<string, unknown>` muss in `Txt2ImgState` und `Img2ImgState` aufgenommen werden (analog zu promptMotiv, promptStyle etc.). Beim Mode-Wechsel:
- **txt2img <-> img2img (gleiches Model):** imageParams werden pro Mode gespeichert und beim Zurueckwechseln wiederhergestellt
- **Tier-Wechsel (anderes Model):** imageParams werden zurueckgesetzt (ungueltige Werte fuer neues Schema)
- **Upscale:** keine imageParams (nicht relevant)

### Canvas Popover imageParams Flow

Canvas Popovers (`VariationPopover`, `Img2imgPopover`) muessen imageParams durch ihre Params-Interfaces an die Generation-Handler weiterreichen:
- `VariationParams` erhaelt `imageParams?: Record<string, unknown>`
- `Img2imgParams` erhaelt `imageParams?: Record<string, unknown>`
- `canvas-detail-view.tsx` Handlers (`handleVariationGenerate`, `handleImg2imgGenerate`) spreaden `...imageParams` in das `params`-Objekt neben bestehenden Feldern wie `prompt_strength`

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `aspect_ratio` | No | Muss in Schema-enum des aktuellen Models enthalten sein | Flux: 9 Werte, Nano Banana 2: 14 Werte, GPT Image 1.5: 3 Werte, Hunyuan Image 3: 11 Werte. Bei >8 Optionen: Visuelle Gruppierung in Common (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3) und Extreme (Rest) mit Separator im Dropdown |
| `megapixels` | No | Muss in Schema-enum des aktuellen Models enthalten sein | Nur Flux-Models (enum: "0.25", "1") |
| `resolution` | No | Muss in Schema-enum des aktuellen Models enthalten sein | Nur Nano Banana 2 (enum: "512px", "1K", "2K", "4K") |
| Advanced params (variabel) | No | Muss im Schema des aktuellen Models enthalten sein | Model-spezifisch: quality, background, safety_filter_level, etc. |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Hook + Utility) -> Slice 2 (Primary/Advanced Split) -> Slice 3 (Prompt Panel) -> Slice 4 (Canvas Popovers)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | useModelSchema Hook + resolveModel Utility | `lib/hooks/use-model-schema.ts` (neu), `lib/utils/resolve-model.ts` (neu, extrahiert aus prompt-area.tsx) | Unit Test: Hook gibt Schema zurueck, cached, handled Fehler | -- |
| 2 | ParameterPanel Primary/Advanced Split | ParameterPanel erhaelt `primaryFields` Whitelist-Prop, rendert Primary immer + Advanced einklappbar, filtert interne Felder (prompt, img2img-Felder, openai_api_key) | Unit Test: Primary-Fields oben, Advanced eingeklappt, Toggle funktioniert | Slice 1 |
| 3 | Prompt Panel Controls | ParameterPanel in `prompt-area.tsx` einbinden, imageParams State, Merge in handleGenerate | Manuell: txt2img/img2img -> Primary-Dropdowns sichtbar, Advanced einklappbar, Generierung mit gewaehlten Params | Slice 2 |
| 4 | Canvas Popover Controls | ParameterPanel in `variation-popover.tsx` + `img2img-popover.tsx`, imageParams in Params-Interfaces, Merge in `canvas-detail-view.tsx` Handlers | Manuell: Popovers zeigen Primary + Advanced Controls, Generierung mit gewaehlten Params | Slice 2 |

### Recommended Order

1. **Slice 1:** useModelSchema Hook + resolveModel Utility -- Foundation, ohne die nichts funktioniert
2. **Slice 2:** ParameterPanel Primary/Advanced Split -- UI-Logik fuer alle Locations
3. **Slice 3:** Prompt Panel Controls -- Hauptinterface, meistgenutzt
4. **Slice 4:** Canvas Popover Controls -- Secondary Interface, gleiche Patterns

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| ParameterPanel | `components/workspace/parameter-panel.tsx` | Bereits getestet mit aspect_ratio enum, direkt wiederverwendbar |
| getModelSchema | `app/actions/models.ts` | Server Action existiert, Schema-Fetching bereits implementiert |
| ModelSchemaService $ref-Resolver | `lib/services/model-schema-service.ts:127-158` | Resolved $ref-basierte enums automatisch, aspect_ratio funktioniert out-of-the-box |
| TierToggle + modelSettings Loading | `prompt-area.tsx`, `canvas-detail-view.tsx` | Gleiches Pattern: Settings laden -> Model resolven -> Parameter bestimmen |
| getImg2ImgFieldName | `lib/services/model-schema-service.ts:20-46` | Unterstuetzt bereits Nano Banana (image_input) und GPT Image 1.5 (input_images) Feld-Erkennung |

### Model Parameter Support (Replicate Schema)

| Model | Replicate ID | aspect_ratio | Groessen-Param | Weitere relevante Params |
|-------|-------------|-------------|----------------|--------------------------|
| Flux Schnell | `black-forest-labs/flux-schnell` | enum: 1:1, 16:9, 21:9, 3:2, 2:3, 4:5, 5:4, 9:16, 9:21 | `megapixels` enum: "0.25", "1" | -- |
| Flux 2 Pro | `black-forest-labs/flux-2-pro` | enum (model-spezifisch) | `megapixels` enum (model-spezifisch) | -- |
| Flux 2 Max | `black-forest-labs/flux-2-max` | enum (model-spezifisch) | `megapixels` enum (model-spezifisch) | -- |
| Nano Banana 2 | `google/nano-banana-2` | enum: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1 | `resolution` enum: 512px, 1K, 2K, 4K | safety_filter_level, output_format, allow_fallback_model |
| GPT Image 1.5 | `openai/gpt-image-1.5` | enum: 1:1, 3:2, 2:3 | -- (kein Groessen-Param) | quality, input_fidelity, background, moderation, output_format, output_compression |
| Hunyuan Image 3 | `tencent/hunyuan-image-3` | enum: 1:1, 16:9, 21:9, 3:2, 2:3, 4:5, 5:4, 3:4, 4:3, 9:16, 9:21 | -- (kein Groessen-Param) | output_format (enum: webp, jpg, png) |

### Primary-Whitelist Rationale

| Field | Warum Primary |
|-------|---------------|
| `aspect_ratio` | Kern-Parameter, von allen unterstuetzten Models angeboten |
| `megapixels` | Groessen-Steuerung bei Flux-Models |
| `resolution` | Groessen-Steuerung bei Nano Banana 2 |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | -- | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-15 | Codebase | ParameterPanel existiert, ist getestet, aber nirgends eingebunden |
| 2026-03-15 | Codebase | getModelSchema Server Action existiert bereits |
| 2026-03-15 | Codebase | buildReplicateInput() spread params -- neue Felder werden automatisch mitgesendet |
| 2026-03-15 | Codebase | resolveModel() nur in prompt-area.tsx, muss extrahiert werden |
| 2026-03-15 | Replicate API | Alle 3 Flux-Modelle unterstuetzen aspect_ratio (enum) und megapixels (enum) |
| 2026-03-15 | Replicate API | Nano Banana 2 (google/nano-banana-2): aspect_ratio (14 enum-Werte), resolution (4 enum-Werte), kein megapixels |
| 2026-03-15 | Replicate API | GPT Image 1.5 (openai/gpt-image-1.5): aspect_ratio (3 enum-Werte), kein megapixels/resolution, hat quality + input_fidelity + background |
| 2026-03-15 | Codebase | getImg2ImgFieldName() unterstuetzt bereits image_input (Nano Banana) und input_images (GPT Image 1.5) |
| 2026-03-15 | Codebase | model_settings Tabelle akzeptiert beliebige modelIds -- Admin kann Model jederzeit umkonfigurieren |
| 2026-03-16 | Replicate API | Hunyuan Image 3 (tencent/hunyuan-image-3): aspect_ratio (11 enum-Werte, wie Flux), kein megapixels/resolution, nur output_format als Advanced-Feld. Nur txt2img (kein Image-Input-Feld) |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Unterstuetzen alle Flux-Modelle aspect_ratio und megapixels? | Ja, alle drei (schnell, 2-pro, 2-max) haben beide als enum-Properties im Replicate Schema |
| 2 | Wo sollen die Controls hin? | Prompt Panel (txt2img + img2img) + Canvas Popovers (Variation + Img2img) |
| 3 | Funktionieren Aspect Ratio Controls auch mit Nano Banana Pro, Nano Banana 2 und GPT Image 1.5? | Ja, alle drei haben aspect_ratio als enum im Replicate Schema. Megapixels existiert bei keinem -- Nano Banana nutzt resolution, GPT Image 1.5 hat keinen Groessen-Param |
| 4 | Wie soll der User zwischen Max-Alternativen (Flux 2 Max, Nano Banana 2, GPT Image 1.5) waehlen? | Admin-Settings only -- Model wird in model_settings konfiguriert, kein Model-Dropdown im Generierungs-UI |
| 5 | Welche Models sollen als Max-Alternativen unterstuetzt werden? | Vier: Flux 2 Max, Nano Banana 2, GPT Image 1.5, Hunyuan Image 3 (ohne Nano Banana Pro, da aeltere Version) |
| 6 | Sollen alle Schema-Properties als Controls angezeigt werden? | Ja, aber mit Primary/Advanced Split: aspect_ratio + Groessen-Params (megapixels, resolution) immer sichtbar, Rest unter "Advanced" einklappbar |
| 7 | Wie sollen die Primary-Fields erkannt werden? | Whitelist per Feldname: aspect_ratio, megapixels, resolution. Alles andere = Advanced |
