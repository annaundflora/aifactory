# Discovery: Model Slots — Tier-Toggle durch direkte Model-Auswahl ersetzen

**Datum:** 2026-03-29
**Status:** Draft
**Issue:** --

---

## 1. Problemstellung

### Aktueller Zustand
Die App verwendet ein Tier-System (Draft | Quality | Max) als Indirektion:
- User wählt eine abstrakte Qualitätsstufe
- Die Zuordnung Tier → Model passiert unsichtbar in den Settings
- Pro Mode+Tier ist genau 1 Model konfiguriert
- Die UI sendet immer nur 1 Model (`modelIds: [einModel]`)

### Probleme
1. **Intransparenz:** User sieht nicht, welches Model er gerade nutzt
2. **Langsamer Wechsel:** Model ändern erfordert Umweg über Settings-Dialog
3. **Kein Multi-Model-Vergleich:** Backend unterstützt 1-3 Models parallel (`modelIds[]`), UI nutzt es nicht
4. **Irreführende Abstraktion:** "Draft/Quality/Max" suggeriert Qualitätsunterschied, ist aber nur ein Model-Alias

### Ziel
Direkte Model-Auswahl im Workspace, schneller Wechsel, Multi-Model-Generierung nutzen.

---

## 2. Entscheidungen (Q&A)

| Frage | Entscheidung |
|-------|-------------|
| Primärer Use-Case | Beides: Schneller Wechsel + Multi-Model-Vergleich |
| Tier-Konzept | **Ersetzen** — Draft/Quality/Max wird abgeschafft |
| Zielgruppe | Power-User (nur du) |
| Wechselfrequenz | Sehr oft — fast bei jeder Generierung |
| UI-Konzept | **Model Slots (Zeilen)** — 3 feste Slots mit Checkbox + Dropdown |
| Mode-Scope | **Mode-spezifisch** — jeder Mode hat eigene 3 Slot-Belegungen |
| Persistenz | **DB** — Slots werden gespeichert, beim nächsten Start wieder da |
| Varianten bei Multi-Model | **Pro Model** — 2 Slots × 3 Varianten = 6 Bilder |
| Settings-Dialog | **Read-Only Anzeige** der aktuellen Slot-Zuweisungen |
| Model-Kompatibilität | **Nur kompatible** Models im Dropdown anzeigen |

---

## 3. Lösung: Model Slots

### Konzept
Die Tier-Toggle-Leiste (Draft | Quality | Max) wird durch **3 feste Model Slots** ersetzt:

```
┌──────────────────────────────────────────┐
│  [Prompt Area...]                        │
├──────────────────────────────────────────┤
│  ☑ Slot 1: [ Flux Schnell       ▼]       │
│  ☑ Slot 2: [ Flux Pro           ▼]       │
│  ☐ Slot 3: [ -nicht belegt-     ▼]       │
├──────────────────────────────────────────┤
│  [Aspect Ratio]  [Variants: 2]           │
│            [ Generate ]                   │
└──────────────────────────────────────────┘
```

### Regeln
- **Min 1, Max 3** aktive Slots — gilt einheitlich für alle Modes (auch Upscale)
- Jeder Slot: **Checkbox** (aktiv/inaktiv) + **Model-Dropdown**
- Dropdown zeigt nur **kompatible Models** für den aktuellen Mode
- **Mode-spezifisch:** Beim Mode-Wechsel (txt2img → img2img) ändern sich die Slot-Belegungen
- **Generate** sendet alle aktiven Slots als `modelIds[]`
- **Varianten** gelten pro Model: 2 aktive Slots × 3 Varianten = 6 Bilder
- **Auto-Aktivierung:** Wird auf einem leeren Slot ein Model ausgewählt, wird der Slot automatisch aktiviert (☑)
- **Per-Slot Parameter:** Jeder aktive Slot hat sein eigenes ParameterPanel (schema-basiert vom jeweiligen Model). Unterschiedliche Models können unterschiedliche Parameter haben. **Ausnahmen:**
  - **Chat Panel:** Kompaktes horizontales Layout ohne ParameterPanel (Chat-Generierungen nutzen Default-Parameter)
  - **Upscale Popover:** Nutzt direkte Action-Buttons (2x/4x) statt ParameterPanel; Scale-Wert wird per Button gewählt
- **Layout-Varianten:** ModelSlots unterstützt zwei Layout-Modi:
  - **Stacked** (Workspace, Variation/Img2img Popovers): Vertikale Zeilen mit vollem Model-Namen + inline Per-Slot Parameter
  - **Compact** (Chat Panel): Horizontale Einzeiler mit gekürzten Model-Namen, ohne Parameter
- **Variant-Count UI:** Workspace/Img2img nutzen Stepper ([ - ] N [ + ]), Variation Popover nutzt Button-Gruppe ([ 1 ] [ 2 ] [ 3 ] [ 4 ])
- **Upscale-Aktionen:** Upscale Popover hat keinen Generate-Button. Scale-Buttons (2x/4x) lösen direkt die Upscale-Operation aus
- **Img2img Strength:** Img2img Popover hat einen übergeordneten Strength-Slider (Default: 0.6) oberhalb der Model Slots. Ist ein Popover-Level-Parameter, nicht Teil der Per-Slot Parameter

### Single-Model vs. Multi-Model
| Szenario | Verhalten |
|----------|-----------|
| 1 Slot aktiv | Wie bisher: 1 Model × N Varianten |
| 2-3 Slots aktiv | Multi-Model: 1 Bild pro Model × N Varianten (Backend existiert bereits) |
| Slot ohne Model | Nicht aktivierbar (Checkbox disabled). Wird ein Model gewählt, wird der Slot auto-aktiviert. |

---

## 4. Datenmodell

### Aktuell: `model_settings`
```
mode     | tier    | model_id                        | model_params
---------|---------|----------------------------------|-------------
txt2img  | draft   | black-forest-labs/flux-schnell   | {}
txt2img  | quality | black-forest-labs/flux-2-pro     | {}
txt2img  | max     | black-forest-labs/flux-2-max     | {}
```

### Neu: `model_slots`
```
mode     | slot | model_id                        | model_params | active
---------|------|---------------------------------|--------------|-------
txt2img  | 1    | black-forest-labs/flux-schnell   | {}           | true
txt2img  | 2    | black-forest-labs/flux-2-pro     | {}           | true
txt2img  | 3    | black-forest-labs/flux-2-max     | {}           | false
img2img  | 1    | black-forest-labs/flux-schnell   | {}           | true
img2img  | 2    |                                 | {}           | false
img2img  | 3    |                                 | {}           | false
upscale  | 1    | philz1337x/crystal-upscaler      | {scale: 4}   | true
upscale  | 2    | nightmareai/real-esrgan           | {scale: 2}   | false
upscale  | 3    |                                 | {}           | false
```

### Migration
- Bestehende `model_settings` Daten migrieren:
  - `tier: "draft"` → `slot: 1, active: true`
  - `tier: "quality"` → `slot: 2, active: false`
  - `tier: "max"` → `slot: 3, active: false`
- Slot 1 ist standardmäßig aktiv (bisheriges "Draft"-Verhalten als Default)

---

## 5. Betroffene Stellen

### Entfernen / Ersetzen
| Datei | Aktion |
|-------|--------|
| `components/ui/tier-toggle.tsx` | Ersetzen durch `ModelSlots` |
| `components/ui/max-quality-toggle.tsx` | **Entfernen** (nicht mehr nötig) |
| `lib/types.ts` → `Tier` Type | Ersetzen durch `SlotNumber = 1 \| 2 \| 3` |
| `lib/utils/resolve-model.ts` | Refactor: alle aktiven Slots für Mode zurückgeben |
| `lib/services/model-settings-service.ts` | Refactor auf Slot-basiert |

### Anpassen
| Datei | Änderung |
|-------|----------|
| `components/workspace/prompt-area.tsx` | Tier-State → Slot-State, Multi-Model-Generate |
| `components/settings/model-mode-section.tsx` | Read-Only Anzeige |
| `components/settings/settings-dialog.tsx` | Model-Dropdowns werden Read-Only |
| `components/canvas/canvas-detail-view.tsx` | Tier-Toggle → Model-Info |
| `components/canvas/popovers/*.tsx` | Tier-Toggle → Slot-Auswahl |
| `components/canvas/canvas-chat-panel.tsx` | Tier-Toggle → Slot-Auswahl |
| `lib/db/schema.ts` | Neue `modelSlots` Tabelle |
| `lib/db/queries.ts` | Neue Queries für Slots |
| `app/actions/model-settings.ts` | Auf Slot-API umstellen |
| `app/actions/generations.ts` | Schon Multi-Model-fähig, kein Change nötig |
| `lib/services/generation-service.ts` | Schon Multi-Model-fähig, kein Change nötig |

### Kein Change nötig
- `app/actions/generations.ts` — akzeptiert bereits `modelIds: string[]` (1-3)
- `lib/services/generation-service.ts` — Multi-Model-Branch existiert bereits
- Backend-Validierung — 1-3 Models, Regex-Check schon implementiert

---

## 6. States & Edge Cases

### Slot-States
| State | Darstellung |
|-------|-------------|
| Aktiv + Model gesetzt | ☑ + Model-Name im Dropdown |
| Inaktiv + Model gesetzt | ☐ + Model-Name ausgegraut |
| Inaktiv + Kein Model | ☐ + "– nicht belegt –" (Checkbox disabled). Auto-aktiviert bei Model-Auswahl. |
| Loading | Skeleton-Placeholder in Dropdowns |
| Streaming (Chat Panel) | Slots bleiben interaktiv während AI-Response-Streaming (anders als "generating" das alles disabled) |

### Edge Cases
| Szenario | Verhalten |
|----------|-----------|
| Letzter aktiver Slot deaktiviert | Checkbox bleibt aktiv (min 1 Regel) |
| Model wird inkompatibel nach Mode-Switch | Slot wird deaktiviert + Hinweis |
| Kein Model im Katalog | Sync-Hinweis anzeigen (wie bisher) |
| Gleicher Model in 2 Slots | Erlaubt (User-Entscheidung) |
| Generate mit 0 aktiven Slots | Generate-Button disabled (kann nicht passieren durch min-1-Regel) |

---

## 7. Flows

### Flow 1: Quick Model Switch
1. User sieht Slot 1 mit "Flux Schnell" → klickt Dropdown
2. Wählt "Flux Pro" aus der Liste
3. Slot 1 zeigt nun "Flux Pro"
4. Nächste Generierung nutzt "Flux Pro"

### Flow 2: Multi-Model Vergleich
1. Slot 1 aktiv mit "Flux Schnell"
2. User aktiviert Slot 2 (Checkbox ☑)
3. Slot 2 hat bereits "Flux Pro" vorbelegt
4. User klickt "Generate" mit 2 Varianten
5. → 4 Bilder: 2× Flux Schnell + 2× Flux Pro
6. Bilder erscheinen im Canvas mit Model-Label

### Flow 3: Mode-Wechsel
1. User ist in txt2img mit 2 aktiven Slots
2. Wechselt zu img2img
3. Slots zeigen jetzt img2img-spezifische Model-Zuweisungen
4. Slot-Konfiguration für txt2img bleibt in DB erhalten
5. Zurück-Wechsel zu txt2img stellt vorherige Slots wieder her

### Flow 4: Neues Model einrichten
1. Slot 3 ist leer ("– nicht belegt –")
2. User klickt Dropdown auf Slot 3
3. Wählt Model aus der kompatiblen Liste
4. Slot 3 wird automatisch aktiviert (☑) → sofort 3 Models bei nächster Generierung

---

## 8. Nicht im Scope

- **Drag & Drop Slot-Reihenfolge** — overkill für 3 Slots
- ~~Model-Parameter pro Slot~~ — **im Scope:** jeder Slot hat eigenes ParameterPanel (UX Review F-1)
- **Favoriten / Recent Models** — späteres Feature
- **Model-Previews im Dropdown** — späteres Feature
- **Slot-Benennung** — Slots heißen 1, 2, 3 (kein Custom-Label)

---

## 9. Slices (Discovery-Level)

| # | Slice | Beschreibung |
|---|-------|-------------|
| 1 | **DB Schema + Migration** | Neue `model_slots` Tabelle, Migration von `model_settings`, Seed-Defaults |
| 2 | **Slot-Service + API** | `ModelSlotService` (CRUD), Server Actions, Kompatibilitäts-Filter |
| 3 | **ModelSlots UI-Komponente** | Neue Komponente: 3 Zeilen, Checkbox + Dropdown, min-1-Regel |
| 4 | **Workspace Integration** | `prompt-area.tsx`: TierToggle → ModelSlots, Multi-Model-Generate |
| 5 | **Canvas Integration** | Detail-View, Popovers, Chat-Panel: Tier → Slot-basiert |
| 6 | **Settings Read-Only** | `model-mode-section.tsx` auf Read-Only umstellen |
| 7 | **Cleanup** | Tier-Type entfernen, MaxQualityToggle entfernen, alte Imports aufräumen |
