# Feature: Model Handling Redesign — Draft/Quality Tier System

**Epic:** --
**Status:** Ready
**Wireframes:** `wireframes.md` (optional, same folder)

---

## Problem & Solution

**Problem:**
- User muss aktuell aus 30+ Replicate-Models selbst wählen — überfordert und irrelevant für die meisten Use Cases
- Parameter-Panel zeigt dynamische Model-Parameter (steps, guidance_scale, etc.) — erhöht Complexity ohne Mehrwert für Nicht-Experten
- Multi-Model-Selektion (1-3 Models gleichzeitig) wird kaum genutzt, erhöht aber Code-Complexity
- Kein Settings-UI vorhanden — Konfiguration verstreut über Projekt-Selections und Favorites

**Solution:**
- Jeder Mode (txt2img, img2img, upscale) bekommt fest zugewiesene Models mit voreingestellten Parametern
- 2 Tiers: **Draft** (schnell/günstig iterieren) und **Quality** (Production/Finishing) + optionaler **Max Quality** Toggle Button (Premium)
- Neuer globaler Settings-Dialog für Model-Zuweisung pro Mode
- Parameter-Panel und Multi-Model-Selektion entfallen komplett

**Business Value:**
- Drastisch vereinfachte UX — weniger Entscheidungen, schnellerer Workflow
- Klare Kosten-Transparenz: Draft = günstig, Quality = teurer, Max Quality = Premium
- Weniger Code-Complexity durch Entfernung von ModelBrowserDrawer, ParameterPanel, Multi-Model-Logik

---

## Scope & Boundaries

| In Scope |
|----------|
| Draft/Quality Toggle in Workspace Prompt-Area |
| Draft/Quality Toggle pro Canvas-Tool (in Variation/Img2Img/Upscale-Popovers + Chat-Panel) |
| Max Quality Toggle Button (nur bei Quality sichtbar, pro Generation) |
| Neuer Settings-Dialog (Modal) mit Model-Zuweisung pro Mode + Tier |
| Schema-Check bei Model-Zuweisung in Settings (Kompatibilitätsvalidierung) |
| Default-Models bei Erstinstallation (Flux Schnell / Flux 2 Pro / Flux 2 Max / Real-ESRGAN / Crystal-Upscaler) |
| Neue DB-Tabelle für globale Model-Settings |
| Entfernung: ModelBrowserDrawer aus Workspace/Canvas |
| Entfernung: ParameterPanel |
| Entfernung: Multi-Model-Selektion (1-3 Models) |
| Preset-Parameter pro zugewiesenem Model (nicht user-konfigurierbar) |

| Out of Scope |
|--------------|
| Stil-Presets (Logo/Photo/Art Mode) — separates Feature |
| Per-Projekt Model-Overrides |
| API Key Verwaltung in Settings |
| Migration bestehender favorite_models / project_selected_models Daten |
| Entfernung alter DB-Tabellen (können deprecated bleiben) |

---

## Current State Reference

> Existierende Funktionalität, die unverändert weiterverwendet wird:

- Replicate Client (`lib/clients/replicate.ts`) — `replicateRun()` bleibt unverändert
- Generation Service (`lib/services/generation-service.ts`) — Core-Logik bleibt, Signatur ändert sich
- Collection Model Service (`lib/services/collection-model-service.ts`) — wird für Settings-Model-Browser weiterverwendet
- Model Schema Service (`lib/services/model-schema-service.ts`) — wird für Kompatibilitäts-Check in Settings genutzt
- DB Schema: `generations` Tabelle (modelId, modelParams, generationMode bleiben)
- Canvas Tools: Variation, Img2Img, Upscale Popovers (bleiben, aber ohne Model-Auswahl)
- Gallery, Lightbox, Polling — alles unverändert
- Mode Selector (txt2img/img2img/upscale) im Workspace — bleibt

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Modal Dialog | Shadcn `Dialog` | Settings-Dialog |
| Segmented Control | `mode-selector.tsx` Pattern | Draft/Quality Toggle (ähnliches UI-Pattern) |
| Model Cards | `model-card.tsx` | Model-Auswahl in Settings-Dialog (reduzierte Variante) |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Tier Toggle | Draft/Quality Segmented Control mit 2 Segmenten | Neues UI-Element, existiert nicht — einfacher als ModeSelector |
| Max Quality Toggle | Toggle Button (Shadcn Toggle), nur bei Quality sichtbar | Konditionelle Sichtbarkeit basierend auf Tier-Auswahl. Design-System-konform (kein Checkbox-Primitive nötig). |
| Settings Model Grid | Kompaktes Grid mit Mode-Sections und Model-Dropdown pro Tier | Settings-spezifisches Layout, existiert nirgends |

---

## User Flow

### Flow 1: Generation mit Draft (Default)

1. User öffnet Workspace → Draft ist vorausgewählt
2. User gibt Prompt ein → klickt Generate
3. System verwendet das zugewiesene Draft-Model (z.B. Flux Schnell) mit Preset-Parametern
4. Bild erscheint in Gallery

### Flow 2: Wechsel zu Quality

1. User klickt auf "Quality" im Tier-Toggle (Prompt-Area oder Canvas-Tool-Popover/Chat)
2. Toggle wechselt zu Quality
3. Optional: User aktiviert "Max Quality" Toggle Button
4. User klickt Generate
5. System verwendet Quality-Model (Flux 2 Pro) oder Max-Model (Flux 2 Max bei Max Quality)

### Flow 3: Settings konfigurieren

1. User klickt Settings-Icon im Workspace Header
2. Settings-Dialog öffnet sich
3. Dialog zeigt 3 Mode-Sections: txt2img, img2img, upscale
4. Pro Section: Draft-Model-Dropdown, Quality-Model-Dropdown, Max-Model-Dropdown
5. Dropdown lädt Models aus Replicate Collection, filtert nach Kompatibilität (Schema-Check)
6. User wählt anderes Model → Schema wird geprüft → bei Kompatibilität wird Model gesetzt
7. User schließt Dialog → Einstellungen sind sofort aktiv

### Flow 4: Canvas Iteration (Popovers)

1. User öffnet Canvas Detail View mit einem Bild
2. User wählt Variation-Tool → Popover zeigt Tier-Toggle + Prompt + Strength + Generate
3. Tier-Toggle steht auf Draft (Default). User kann pro Tool auf Quality wechseln.
4. System verwendet das img2img Model des im Popover gewählten Tiers
5. Bei Upscale-Tool: Popover zeigt Tier-Toggle + Scale-Buttons. System verwendet upscale Model des gewählten Tiers.

### Flow 5: Canvas Chat

1. User öffnet Chat-Panel im Canvas
2. Tier-Toggle (Draft | Quality) erscheint über dem Chat-Input
3. User wählt Tier → tippt Nachricht → sendet
4. AI löst Generation aus → System verwendet img2img Model des im Chat gewählten Tiers
5. Tier-State des Chat ist unabhängig von den Popover-Tier-States

**Error Paths:**
- Settings: Inkompatibles Model ausgewählt → Model wird ausgegraut (disabled), nicht selektierbar. Tooltip: "Model does not support this mode."
- Settings: Replicate Collection nicht ladbar → Fehlermeldung ersetzt Dropdown-Inhalt: "Could not load models. Please try again." Bestehende Zuweisung bleibt unverändert.
- Generation: Zugewiesenes Model nicht verfügbar (Replicate-Fehler) → Standard-Fehlermeldung wie bisher

---

## UI Layout & Context

### Screen: Workspace Prompt-Area (geändert)
**Position:** Linkes Panel im Workspace (480px)
**When:** Immer wenn Workspace aktiv

**Layout-Änderungen:**
- Entfernt: ModelTrigger + ModelBrowserDrawer
- Entfernt: ParameterPanel
- Neu: Tier-Toggle (Draft | Quality) oberhalb des Generate-Buttons
- Neu: "Max Quality" Toggle Button unter dem Tier-Toggle (nur bei Quality sichtbar)

### Screen: Canvas Header (geändert)
**Position:** Header-Bereich des Canvas Detail View
**When:** Immer wenn Canvas aktiv

**Layout-Änderungen:**
- Entfernt: CanvasModelSelector (Model-Dropdown + ModelBrowserDrawer)
- Center-Slot wird leer (kein Tier-Toggle mehr im Header — lebt jetzt pro Tool)

### Screen: Canvas Tool Popovers (geändert)
**Position:** Popover neben Toolbar (Variation, Img2Img, Upscale)
**When:** Jeweiliges Tool aktiv

**Layout-Änderungen:**
- Neu: Tier-Toggle (Draft | Quality) über dem Generate/Action-Button in jedem Popover
- Neu: "Max Quality" Toggle Button unter Tier-Toggle (nur bei Quality, nur bei Variation + Img2Img — nicht Upscale)
- Jedes Popover hat eigenen Tier-State (unabhängig)

### Screen: Canvas Chat Panel (geändert)
**Position:** Rechtes Panel im Canvas Detail View
**When:** Chat-Panel geöffnet

**Layout-Änderungen:**
- Neu: Tier-Toggle (Draft | Quality) als kompakte Leiste über dem Chat-Input
- Neu: "Max Quality" Toggle Button neben Tier-Toggle (nur bei Quality sichtbar)
- Eigener Tier-State (unabhängig von Popovers und Workspace)

### Screen: Settings Dialog (neu)
**Position:** Modal-Overlay, zentriert
**When:** Geöffnet über Settings-Icon im Workspace Header

**Layout:**
- Header: "Model Settings" Titel + Close Button
- Body: 3 Sections (txt2img, img2img, upscale)
- Pro Section: Section-Header + 3 Dropdowns (Draft, Quality, Max)
- Pro Dropdown: Model-Name + Owner anzeigen, inkompatible Models ausgegraut
- Footer: keiner nötig (Auto-Save bei Auswahl)

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `tier-toggle` | Segmented Control | Prompt-Area, Canvas Popovers (Variation/Img2Img/Upscale), Canvas Chat Panel | `draft` (aktiv), `quality`, `disabled` (during generation) | Wechselt aktiven Tier. Default: draft. Pro Kontext eigener State (Workspace, je Canvas-Tool, Chat). Nicht persistiert. Disabled während laufender Generation. Im Chat: bleibt interaktiv während Streaming, disabled erst bei Generation. |
| `max-quality-toggle` | Toggle Button | Unter/neben Tier-Toggle (überall wo Tier-Toggle, außer Upscale) | `hidden` (Draft), `off` (Quality), `on` (Quality+Max) | Nur sichtbar wenn tier=quality. Nicht bei Upscale (kein Max-Tier). Nicht persistiert. |
| `settings-button` | Icon Button | Workspace Header | `default`, `hover` | Öffnet Settings-Dialog |
| `settings-dialog` | Modal | Overlay | `open`, `closed` | Zeigt Model-Zuweisung pro Mode |
| `model-dropdown-draft` | Select | Settings Dialog, pro Mode | `default`, `open`, `selected`, `incompatible-model`, `collection-load-error` | Zeigt kompatible Models aus Replicate Collection. Items zeigen Model-Name (bold) + Owner (muted). Aktuell gewähltes Model mit Checkmark. Inkompatible Models ausgegraut + disabled. Bei Collection-Ladefehler: Fehlermeldung ersetzt Dropdown-Inhalt. |
| `model-dropdown-quality` | Select | Settings Dialog, pro Mode | `default`, `open`, `selected`, `incompatible-model`, `collection-load-error` | Wie Draft-Dropdown |
| `model-dropdown-max` | Select | Settings Dialog, pro Mode | `default`, `open`, `selected`, `incompatible-model`, `collection-load-error` | Wie Draft-Dropdown. Nur für txt2img + img2img (nicht upscale). |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `draft-selected` | Tier-Toggle zeigt "Draft" aktiv. Max Quality Toggle hidden. | Generate, Switch to Quality, Open Settings |
| `quality-selected` | Tier-Toggle zeigt "Quality" aktiv. Max Quality Toggle sichtbar (off). | Generate, Switch to Draft, Toggle Max Quality, Open Settings |
| `quality-max-selected` | Tier-Toggle zeigt "Quality" aktiv. Max Quality Toggle on. | Generate, Switch to Draft, Toggle Max Quality off, Open Settings |
| `generating` | Generate/Upscale-Button zeigt Spinner + "Generating..."/"Upscaling...". Tier-Toggle sichtbar aber disabled. | Cancel (wenn unterstützt) |
| `streaming` | (Nur Canvas Chat) Chat-Input disabled, Tier-Toggle bleibt interaktiv während AI-Antwort streamt. | -- |
| `settings-open` | Settings Modal sichtbar. Hintergrund abgedunkelt. | Change Model assignments, Close Settings |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `draft-selected` | Click "Quality" | Toggle animiert zu Quality. Max Quality Toggle erscheint. | `quality-selected` | -- |
| `quality-selected` | Click "Draft" | Toggle animiert zu Draft. Max Quality Toggle verschwindet. | `draft-selected` | -- |
| `quality-selected` | Click "Max Quality" | Toggle Button wird aktiviert (on). | `quality-max-selected` | -- |
| `quality-max-selected` | Click "Max Quality" | Toggle Button wird deaktiviert (off). | `quality-selected` | -- |
| `quality-max-selected` | Click "Draft" | Toggle animiert zu Draft. Max Quality Toggle verschwindet. | `draft-selected` | -- |
| any | Click Settings-Icon | Settings Modal öffnet sich. | `settings-open` | -- |
| `settings-open` | Close / Click outside | Modal schließt. | previous state | Model-Zuweisungen sofort gespeichert |
| `settings-open` | Select Model in Dropdown | Model-Zuweisung wird gespeichert (Auto-Save). Dropdown zeigt neues Model. | `settings-open` | Schema-Check: nur kompatible Models wählbar |
| `draft-selected` / `quality-selected` / `quality-max-selected` | Click Generate | Button zeigt Spinner + "Generating..."/"Upscaling...". Tier-Toggle disabled. | `generating` | Model des aktuellen Tiers + Mode wird verwendet |
| `generating` | Generation abgeschlossen | Button kehrt zurück zu normalem Zustand. Tier-Toggle wieder enabled. | previous tier state | -- |
| `quality-selected` / `quality-max-selected` (Chat) | Send Message | Chat-Input disabled. Tier-Toggle bleibt interaktiv. | `streaming` | AI-Antwort wird gestreamt |
| `streaming` | AI-Antwort abgeschlossen / Generation getriggert | Bei Generation → Tier-Toggle disabled. | `generating` oder previous tier state | -- |

---

## Business Rules

- Default-Tier ist **Draft** bei jedem App-Start (nicht persistiert)
- Max Quality Toggle ist **off** bei jedem App-Start (nicht persistiert)
- Tier-Auswahl gilt **pro Tool separat**: Workspace Prompt-Area, jedes Canvas-Popover (Variation, Img2Img, Upscale) und Canvas Chat haben jeweils eigenen Tier-State. Alle defaults auf Draft.
- Model-Zuweisungen in Settings sind **global** (nicht pro Projekt)
- Model-Zuweisungen werden **sofort** beim Ändern gespeichert (Auto-Save)
- Upscale Mode hat **kein Max-Model** (nur Draft + Quality)
- Bei Generation wird das Model des aktuellen Tiers + Mode verwendet, Parameter kommen aus Preset
- `generations.modelId` speichert weiterhin das tatsächlich verwendete Model (für Metadaten-Anzeige)
- `generations.modelParams` speichert die Preset-Parameter (für Reproduzierbarkeit)

---

## Data

### Neue Tabelle: `model_settings` (global, nicht pro Projekt)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID, PK | -- |
| `mode` | Yes | Enum: `txt2img`, `img2img`, `upscale` | Einer der 3 Modes |
| `tier` | Yes | Enum: `draft`, `quality`, `max` | Welcher Tier |
| `model_id` | Yes | String, Format: `owner/name` | Replicate Model Identifier |
| `model_params` | Yes | JSONB | Voreingestellte Parameter für dieses Model |
| `created_at` | Yes | Timestamp | -- |
| `updated_at` | Yes | Timestamp | -- |

**Unique Constraint:** `(mode, tier)` — maximal 1 Model pro Mode+Tier

### Default-Einträge bei Erstinstallation

| Mode | Tier | Model | Preset-Parameter |
|------|------|-------|-----------------|
| txt2img | draft | `black-forest-labs/flux-schnell` | `{}` (Defaults des Models) |
| txt2img | quality | `black-forest-labs/flux-2-pro` | `{}` |
| txt2img | max | `black-forest-labs/flux-2-max` | `{}` |
| img2img | draft | `black-forest-labs/flux-schnell` | `{ "prompt_strength": 0.6 }` |
| img2img | quality | `black-forest-labs/flux-2-pro` | `{ "prompt_strength": 0.6 }` |
| img2img | max | `black-forest-labs/flux-2-max` | `{ "prompt_strength": 0.6 }` |
| upscale | draft | `nightmareai/real-esrgan` | `{ "scale": 2 }` |
| upscale | quality | `philz1337x/crystal-upscaler` | `{ "scale": 4 }` |

### Deprecierte Tabellen (nicht mehr aktiv genutzt)

- `favorite_models` — bleibt in DB, wird nicht mehr gelesen/geschrieben
- `project_selected_models` — bleibt in DB, wird nicht mehr gelesen/geschrieben

---

## Trigger-Inventory

| Trigger | Entry Point | Resultierender Mode + Tier |
|---------|------------|---------------------------|
| Generate-Button (Workspace) | `prompt-area.tsx` | Aktueller ModeSelector-Wert + Prompt-Area Tier-Toggle |
| Variation-Popover Submit (Canvas) | `variation-popover.tsx` | img2img + Variation-Popover Tier-Toggle |
| Img2Img-Popover Submit (Canvas) | `img2img-popover.tsx` | img2img + Img2Img-Popover Tier-Toggle |
| Upscale-Popover Submit (Canvas) | `upscale-popover.tsx` | upscale + Upscale-Popover Tier-Toggle |
| Chat-Generation (Canvas) | `canvas-chat-panel.tsx` | img2img + Chat-Panel Tier-Toggle |

---

## Implementation Slices

### Dependencies

```
Slice 1 (DB + Service) -> Slice 2 (Settings UI) -> Slice 3 (Tier Toggle Workspace)
                                                 -> Slice 4 (Tier Toggle Canvas)
                                                 -> Slice 5 (Cleanup)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Model Settings Schema + Service | DB-Tabelle `model_settings`, Seed-Migration mit Defaults, CRUD-Service + Server Actions (`getModelSettings`, `updateModelSetting`), Schema-Check Funktion | Unit-Tests: Service CRUD, Schema-Check Logik. Integration: DB-Migration läuft, Defaults werden geseeded. | -- |
| 2 | Settings Dialog UI | Settings-Button im Workspace Header, Modal-Dialog mit 3 Mode-Sections, Model-Dropdowns mit Collection-Daten + Kompatibilitäts-Filter (ausgegraute inkompatible Models), Auto-Save bei Auswahl | Manuell: Dialog öffnen, Models ändern, schließen, erneut öffnen → Auswahl persistiert. Schema-Check: inkompatibles Model ist ausgegraut. | Slice 1 |
| 3 | Workspace Tier Toggle + Generation Integration | Draft/Quality Toggle in Prompt-Area, Max Quality Toggle Button (nur bei Quality), Generate verwendet Tier-basiertes Model + Preset-Params, Entfernung: ModelTrigger, ModelBrowserDrawer, ParameterPanel, Multi-Model-Logik aus Prompt-Area | Manuell: Draft generieren → schnelles/günstiges Model. Quality generieren → besseres Model. Max Quality → Max-Model. Metadaten zeigen korrektes Model. | Slice 1 |
| 4 | Canvas Tier Toggle + Tool Integration | Draft/Quality Toggle + Max Quality pro Canvas-Tool (in Variation/Img2Img/Upscale-Popovers + Chat-Panel, jeweils eigener State), Entfernung: CanvasModelSelector + ModelBrowserDrawer aus Canvas | Manuell: Canvas öffnen, Variation-Popover → Tier wählen → generieren → korrektes Model. Chat → Tier wählen → Nachricht → korrektes Model. Tier-States sind pro Tool unabhängig. | Slice 1, Slice 3 (shared Tier-Toggle Component) |
| 5 | Cleanup + Deprecation | Entfernung ungenutzter Imports/Components (ModelBrowserDrawer, ParameterPanel, Multi-Model-Logik), Deprecation-Kommentare an alten DB-Tabellen, Entfernung alter Server Actions (getFavoriteModels, toggleFavoriteModel, saveProjectSelectedModels) | Lint + TypeScript Compiler: keine ungenutzten Imports. Alle Tests grün. App funktioniert ohne entfernte Components. | Slice 3, Slice 4 |

### Recommended Order

1. **Slice 1:** Model Settings Schema + Service — Fundament, alles andere baut darauf auf
2. **Slice 2:** Settings Dialog UI — User kann Models konfigurieren
3. **Slice 3:** Workspace Tier Toggle — Hauptworkflow funktioniert mit neuem System
4. **Slice 4:** Canvas Tier Toggle — Canvas nutzt gleiche Infrastruktur
5. **Slice 5:** Cleanup — Aufräumen nach vollständiger Migration

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Mode Selector | `components/workspace/mode-selector.tsx` | Segmented Control Pattern — Tier-Toggle kann ähnlich gebaut werden |
| Model Browser Drawer | `components/models/model-browser-drawer.tsx` | Wird für Settings-Dialog Model-Auswahl wiederverwendet (reduzierte Variante) |
| Model Schema Service | `lib/services/model-schema-service.ts` | Kompatibilitäts-Check (img2img Support Detection) existiert bereits |
| Collection Model Service | `lib/services/collection-model-service.ts` | Replicate Collection API Integration existiert bereits |

### Web Research

| Source | Finding |
|--------|---------|
| [Flux Models Comparison (Melies)](https://melies.co/compare/flux-models) | Schnell: ~$0.015/2s, Pro: ~$0.03/4s, Max: ~$0.08+/4s. Max hat beste Konsistenz + Editing-Präzision. |
| [AI Image Model Pricing 2026 (PricePerToken)](https://pricepertoken.com/image) | Umfassender Preisvergleich aller Replicate-Models. Flux Schnell ist das günstigste brauchbare Model. |
| [Replicate Text-to-Image Collection](https://replicate.com/collections/text-to-image) | Dynamische Model-Liste via API. Basis für Settings-Dropdown. |
| [Seedream 5.0 Lite vs 4.5 (Medium)](https://medium.com/budgetpixel-ai/seedream-5-0-lite-vs-seedream-4-5-what-actually-changed-and-which-one-to-use-7f9b9cf1cfe0) | Seedream 5 Lite: $0.035, Deep Thinking, 14 Referenzbilder. Gute Alternative. |
| [Recraft V4 (Replicate Blog)](https://replicate.com/blog/recraft-v4) | Bestes Model für Logos, Vektor, Design. ~$0.04/Bild. Nicht für Photorealismus. |
| [Ideogram V3 Turbo (Replicate)](https://replicate.com/ideogram-ai/ideogram-v3-turbo) | Bestes Text-Rendering. $0.03/Bild. Gut für Infografiken. |
| [Replicate Super-Resolution Collection](https://replicate.com/collections/super-resolution) | Real-ESRGAN: schnellstes Upscaling (~1.4s). Crystal-Upscaler: bessere Texturen, langsamer. |
| [Flux 2 Pro vs Max (getimg.ai)](https://getimg.ai/blog/flux-2-max-review-flex-pro-comparison) | Max: bessere Farb-/Licht-/Gesichtstreue beim Editing. Pro: schneller, günstiger, General-Purpose. |
| [TeamDay AI Image Generators Ranked](https://www.teamday.ai/blog/best-ai-image-models-2026) | Recraft V4 für Design, Flux für Photo, Ideogram für Text. Models sind spezialisiert. |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Soll der Tier-State (Draft/Quality) persistiert werden oder nur pro Session? | A) Session-only B) LocalStorage C) DB | A) Session-only | Session-only — Default ist immer Draft |
| 2 | Soll Max Quality als eigener Tier in der DB stehen oder als Flag? | A) Eigener Tier "max" in model_settings B) Boolean-Flag am Quality-Tier | A) Eigener Tier | Eigener Tier "max" — saubere Datenstruktur |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-14 | Codebase | Kein Settings-UI vorhanden. Model-Auswahl über ModelBrowserDrawer (dynamisch aus Replicate Collection API). Parameter dynamisch aus Model-Schema. Multi-Model 1-3 pro Generation. |
| 2026-03-14 | Codebase | 3 Modes: txt2img, img2img, upscale. Canvas-Tools (Variation, Img2Img, Upscale) nutzen technisch die gleichen Modes. |
| 2026-03-14 | Codebase | Upscale hardcoded auf nightmareai/real-esrgan. Alle anderen Models dynamisch. |
| 2026-03-14 | Web | Flux Schnell (~$0.015, 2s) ist bestes Draft-Model. Flux 2 Pro (~$0.03, 4s) bester Quality-Allrounder. Flux 2 Max (~$0.08+) für Premium-Finish. |
| 2026-03-14 | Web | Models sind nach Stil spezialisiert: Recraft V4 für Design/Vektor, Flux für Photo, Ideogram für Text. → Stil-Presets als separates Feature. |
| 2026-03-14 | Web | Real-ESRGAN bleibt bestes Speed-Upscale-Model. Crystal-Upscaler für bessere Qualität aber langsamer. |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Soll ich zuerst recherchieren oder direkt Q&A starten? | Direkt Q&A starten — Recherche-Ergebnisse reichen aus. |
| 2 | Welche Modes soll das neue System abdecken? | Bestehende 3 Modes + Canvas-Tools (die sich auf die gleichen 3 Modes abbilden). |
| 3 | Können Canvas-Modes den Workspace-Modes zugeordnet werden? | Ja — Canvas hat kein txt2img. Variation + Img2Img + Chat = img2img. Upscale = upscale. Gleiche Model-Zuweisung. |
| 4 | Stimmt die Zuordnung Canvas→Workspace? | Chat-Generation im Canvas ist auch img2img — Canvas arbeitet immer vom aktuellen Bild aus, das ist das Kernprinzip. |
| 5 | Sind es 3 Modes für die Model-Zuweisung? | Ja: txt2img (nur Workspace), img2img (Workspace + Canvas), upscale (Workspace + Canvas). |
| 6 | Soll der User im Canvas zwischen Draft/Quality wählen können? | Ja, Draft + Quality wählbar, in beiden Kontexten. |
| 7 | Wo soll die Draft/Quality-Umschaltung im UI leben? | Toggle im Prompt-Bereich (Workspace) bzw. im Canvas Header. |
| 8 | Soll der User sehen welches Model dahinter steckt? | In Metadaten (Gallery-Cards, Lightbox) ja. In Prompt-Area/Canvas Header nur "Draft"/"Quality". |
| 9 | Was passiert mit dem Parameter-Panel? | Entfällt komplett — Draft/Quality haben voreingestellte Parameter. Maximale Vereinfachung. |
| 10 | Was passiert mit Multi-Model-Selektion? | Entfällt komplett — immer 1 Model pro Generation (das zugewiesene Draft oder Quality Model). |
| 11 | Brauchen wir neben Draft/Quality einen Balanced-Mode oder Stil-Dimension? | Nein — stattdessen "Max Quality" Checkbox für Flux 2 Max bei Quality. Stil-Presets = separates Feature. |
| 12 | Flux 2 Pro oder Max als Quality-Default? | Flux 2 Pro als Default. Max über "Max Quality" Checkbox erreichbar (>2x teurer pro Megapixel). |
| 13 | Wo lebt die Max Quality Toggle Button? Pro Generation oder dauerhaft? | Im Prompt-Bereich, pro Generation. Nur sichtbar bei Quality. Default: unchecked. |
| 14 | Settings-Dialog Inhalt? | Nur Model-Zuweisung. Keine API Keys, keine weiteren Einstellungen. |
| 15 | Scope der Settings? | Global (nicht pro Projekt). |
| 16 | Wie wird Kompatibilität in Settings sichergestellt? | Schema-Check bei Model-Auswahl. Inkompatible Models ausgegraut. |
| 17 | Was passiert mit bestehenden DB-Tabellen? | Clean Break. favorite_models + project_selected_models nicht mehr aktiv genutzt. Neue model_settings Tabelle. |
| 18 | Wo lebt der Settings-Button? | Workspace Header (Settings-Icon). |
| 19 | Default-Models bei Erstinstallation? | txt2img: Schnell/Pro/Max. img2img: Schnell/Pro/Max. upscale: Real-ESRGAN/Crystal-Upscaler. |
| 20 | Draft/Quality Toggle auch in Canvas-Popovers? | Ja — pro Tool (Variation, Img2Img, Upscale, Chat). Konsistent mit Workspace wo Toggle über Generate-Button sitzt. Nicht mehr im Canvas Header. |
| 21 | Wo lebt der Tier-Toggle im Canvas Chat? | Über dem Chat-Input als kompakte Leiste. Immer sichtbar, User setzt Tier bevor er Nachricht schickt. |
| 22 | Teilen sich Canvas-Tools einen Tier-State? | Nein — jedes Tool (Variation, Img2Img, Upscale, Chat) hat eigenen unabhängigen Tier-State. Alle defaults auf Draft. |
