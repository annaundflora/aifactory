# Feature: Aspect Ratio & Megapixels Controls

**Epic:** --
**Status:** Draft
**Wireframes:** -- (optional, same folder)

---

## Problem & Solution

**Problem:**
- Alle drei Flux-Modelle (schnell, 2-pro, 2-max) unterstützen `aspect_ratio` und `megapixels` als Replicate API Parameter
- Nutzer haben aktuell KEINE Möglichkeit, Seitenverhältnis oder Auflösung zu wählen
- Alle Generierungen nutzen Model-Defaults (typisch: 1:1, 1 MP)

**Solution:**
- Aspect Ratio und Megapixels Controls in Prompt Panel (txt2img + img2img) und Canvas Popovers (Variation + Img2img) einbauen
- Bestehende `ParameterPanel`-Komponente und `getModelSchema` Server Action wiederverwenden

**Business Value:**
- Nutzer können Bilder in gewünschtem Format generieren (Landscape, Portrait, Square, Widescreen)
- Höhere/niedrigere Auflösung wählbar je nach Use Case

---

## Scope & Boundaries

| In Scope |
|----------|
| Aspect Ratio Dropdown in Prompt Panel (txt2img + img2img) |
| Megapixels Dropdown in Prompt Panel (txt2img + img2img) |
| Aspect Ratio + Megapixels in Canvas Variation Popover |
| Aspect Ratio + Megapixels in Canvas Img2img Popover |
| Schema-basierte Optionen (dynamisch per Model von Replicate API) |
| Merge von User-gewählten Params mit DB-modelParams |

| Out of Scope |
|--------------|
| Upscale Mode (keine aspect_ratio/megapixels relevant) |
| Custom Width/Height Eingabe (nur enum-basierte Optionen) |
| Weitere Model-Parameter (guidance, steps, etc.) -- separates Feature |
| Persistenz der User-Auswahl über Sessions hinweg |

---

## Current State Reference

- `ParameterPanel` (`components/workspace/parameter-panel.tsx`) -- generischer Schema-zu-UI Renderer, unterstützt enum→Select und number→Input, bereits getestet mit `aspect_ratio`
- `getModelSchema` Server Action (`app/actions/models.ts:25`) -- gibt Schema-Properties für modelId zurück
- `ModelSchemaService` (`lib/services/model-schema-service.ts`) -- fetcht & cached Replicate OpenAPI Schema, resolved $ref-enums
- `resolveModel()` in `prompt-area.tsx:128` -- löst mode+tier+maxQuality → modelId + modelParams auf
- `buildReplicateInput()` (`lib/services/generation-service.ts:263`) -- spread `...params` → automatisch mitgesendet wenn in params
- `modelSettings` werden in `canvas-detail-view.tsx` bereits geladen
- TierToggle + MaxQualityToggle existieren in allen 3 Locations

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Schema-Parameter-Renderer | `components/workspace/parameter-panel.tsx` | Rendert aspect_ratio als Select Dropdown, megapixels als Select Dropdown |
| Server Action | `app/actions/models.ts:getModelSchema` | Fetcht Schema für aktuell resolved Model |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| `useModelSchema` Hook | React Hook für Schema-Fetching mit modelId-basiertem Caching | Wiederverwendbar in 3+ Locations, vermeidet dupliziertes Fetch-Logic |
| `resolveModel` shared Utility | Extrahierte Model-Auflösung (mode+tier+maxQuality → modelId) | Aktuell nur in prompt-area.tsx, wird auch in Popovers benötigt |

---

## User Flow

1. User öffnet Prompt Panel (txt2img oder img2img Mode) → System zeigt Aspect Ratio und Megapixels Dropdowns basierend auf aktuellem Model
2. User wählt Aspect Ratio (z.B. "16:9") → Wert wird in lokalen imageParams State gespeichert
3. User wählt Megapixels (z.B. "1") → Wert wird in lokalen imageParams State gespeichert
4. User klickt "Generate" → imageParams werden mit modelParams gemergt und an Replicate gesendet
5. Bild wird im gewählten Seitenverhältnis generiert

**Canvas-Flow:**
1. User öffnet Variation/Img2img Popover im Canvas → System zeigt Aspect Ratio und Megapixels Controls
2. User konfiguriert Werte + andere Popover-Settings → Generate → imageParams fließen in API-Call

**Error Paths:**
- Model-Schema kann nicht geladen werden → Controls werden nicht angezeigt (graceful degradation, Schema isLoading zeigt Skeleton)
- Tier-Wechsel ändert Model → Schema wird neu gefetcht, Controls aktualisieren sich, ungültige Werte werden auf Model-Default zurückgesetzt

---

## UI Layout & Context

### Screen: Prompt Panel (prompt-area.tsx)
**Position:** Rechte Sidebar, Workspace
**When:** txt2img oder img2img Mode aktiv

**Layout:**
- Bereich zwischen Tier Toggle / MaxQuality Toggle und Variant Count Stepper
- ParameterPanel rendert 1-2 Dropdowns (Aspect Ratio, Megapixels)
- Compact: Labels + Select Dropdowns, gleicher Style wie bestehende Controls

### Screen: Variation Popover (variation-popover.tsx)
**Position:** Canvas Detail View, links neben Bild
**When:** Variation Tool aktiv

**Layout:**
- Neuer Bereich zwischen Tier Toggle und Generate Button
- Gleiche ParameterPanel-Darstellung wie Prompt Panel

### Screen: Img2img Popover (img2img-popover.tsx)
**Position:** Canvas Detail View, links neben Bild
**When:** Img2img Tool aktiv

**Layout:**
- Neuer Bereich zwischen Tier Toggle und Generate Button
- Gleiche ParameterPanel-Darstellung wie Prompt Panel

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Aspect Ratio Select | Select Dropdown | Prompt Panel, Variation Popover, Img2img Popover | `loading` (Skeleton), `ready` (enum-Optionen), `hidden` (Model unterstützt kein aspect_ratio) | User wählt Ratio, Wert fließt in imageParams |
| Megapixels Select | Select Dropdown | Prompt Panel, Variation Popover, Img2img Popover | `loading` (Skeleton), `ready` (enum-Optionen), `hidden` (Model unterstützt kein megapixels) | User wählt MP, Wert fließt in imageParams |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `schema_loading` | Skeleton Placeholders für Controls | Warten |
| `schema_ready` | Aspect Ratio + Megapixels Dropdowns mit Model-spezifischen Optionen | Auswahl ändern, Generate |
| `schema_hidden` | Keine Controls (Model hat kein aspect_ratio/megapixels) | Generate ohne diese Params |
| `schema_error` | Keine Controls (Schema-Fetch fehlgeschlagen) | Generate ohne diese Params |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `schema_loading` | Schema erfolgreich geladen | Controls erscheinen mit Default-Werten | `schema_ready` | -- |
| `schema_loading` | Schema hat kein aspect_ratio/megapixels | Controls verschwinden | `schema_hidden` | -- |
| `schema_loading` | Schema-Fetch fehlgeschlagen | Controls verschwinden | `schema_error` | -- |
| `schema_ready` | Tier-Wechsel → anderes Model | Controls kurz Skeleton, dann neue Optionen | `schema_loading` → `schema_ready` | Ungültige Werte werden auf Model-Default zurückgesetzt |
| `schema_ready` | Mode-Wechsel (txt2img ↔ img2img) | Controls bleiben (beide nutzen Flux) | `schema_ready` | imageParams werden beibehalten |

---

## Business Rules

- Aspect Ratio und Megapixels Optionen werden dynamisch aus dem Replicate Model-Schema geladen (nicht hardcoded)
- Wenn das Model kein `aspect_ratio` oder `megapixels` Property hat → entsprechendes Control nicht anzeigen
- User-gewählte Werte überschreiben Model-Defaults beim Merge in params
- Bei Model-Wechsel (Tier-Änderung): wenn der gewählte Wert im neuen Schema nicht existiert → auf Model-Default zurücksetzen
- Upscale Mode zeigt keine Controls (nicht relevant)

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `aspect_ratio` | No | Muss in Schema-enum des aktuellen Models enthalten sein | Default: erster enum-Wert oder Model-Default |
| `megapixels` | No | Muss in Schema-enum des aktuellen Models enthalten sein | Default: erster enum-Wert oder Model-Default |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Hook + Utility) -> Slice 2 (Prompt Panel) -> Slice 3 (Canvas Popovers)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | useModelSchema Hook + resolveModel Utility | `lib/hooks/use-model-schema.ts` (neu), `lib/utils/resolve-model.ts` (neu, extrahiert aus prompt-area.tsx) | Unit Test: Hook gibt Schema zurück, cached, handled Fehler | -- |
| 2 | Prompt Panel Controls | ParameterPanel in `prompt-area.tsx` einbinden, imageParams State, Merge in handleGenerate | Manuell: txt2img/img2img → Dropdowns sichtbar, Generierung mit gewähltem Ratio | Slice 1 |
| 3 | Canvas Popover Controls | ParameterPanel in `variation-popover.tsx` + `img2img-popover.tsx`, imageParams in Params-Interfaces, Merge in `canvas-detail-view.tsx` Handlers | Manuell: Popovers zeigen Controls, Generierung mit gewähltem Ratio | Slice 1 |

### Recommended Order

1. **Slice 1:** useModelSchema Hook + resolveModel Utility -- Foundation, ohne die nichts funktioniert
2. **Slice 2:** Prompt Panel Controls -- Hauptinterface, meistgenutzt
3. **Slice 3:** Canvas Popover Controls -- Secondary Interface, gleiche Patterns

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| ParameterPanel | `components/workspace/parameter-panel.tsx` | Bereits getestet mit aspect_ratio enum, direkt wiederverwendbar |
| getModelSchema | `app/actions/models.ts` | Server Action existiert, Schema-Fetching bereits implementiert |
| ModelSchemaService $ref-Resolver | `lib/services/model-schema-service.ts:127-158` | Resolved $ref-basierte enums automatisch, aspect_ratio funktioniert out-of-the-box |
| TierToggle + modelSettings Loading | `prompt-area.tsx`, `canvas-detail-view.tsx` | Gleiches Pattern: Settings laden → Model resolven → Parameter bestimmen |

### Flux Model Parameter Support

| Model | aspect_ratio | megapixels |
|-------|-------------|------------|
| flux-schnell | enum: 1:1, 16:9, 21:9, 3:2, 2:3, 4:5, 5:4, 9:16, 9:21 | enum: "0.25", "1" |
| flux-2-pro | enum (model-spezifisch) | enum (model-spezifisch) |
| flux-2-max | enum (model-spezifisch) | enum (model-spezifisch) |

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
| 2026-03-15 | Replicate API | Alle 3 Flux-Modelle unterstützen aspect_ratio (enum) und megapixels (enum) |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Unterstützen alle Flux-Modelle aspect_ratio und megapixels? | Ja, alle drei (schnell, 2-pro, 2-max) haben beide als enum-Properties im Replicate Schema |
| 2 | Wo sollen die Controls hin? | Prompt Panel (txt2img + img2img) + Canvas Popovers (Variation + Img2img) |
