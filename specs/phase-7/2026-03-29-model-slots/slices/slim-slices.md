# Slice Decomposition

**Feature:** Model Slots -- Tier-Toggle durch direkte Model-Auswahl ersetzen
**Discovery-Slices:** 7 (grobe Slices aus Discovery Section 9)
**Atomare Slices:** 16
**Stack:** typescript-nextjs (Next.js 16.1.6, React 19.2.3, Drizzle ORM 0.45.1, Radix UI 1.4.3, Tailwind 4)
**Test Framework:** vitest + playwright

---

## Dependency Graph

```
slice-01 (DB Schema + Migration)
    |
    +---> slice-02 (DB Queries)
              |
              +---> slice-03 (Types + resolve-model)
              |         |
              |         +---> slice-04 (ModelSlotService)
              |                   |
              |                   +---> slice-05 (Server Actions)
              |                             |
              |                             +---> slice-06 (ModelSlots UI -- Stacked)
              |                             |         |
              |                             |         +---> slice-07 (ModelSlots UI -- Compact)
              |                             |         |
              |                             |         +---> slice-08 (Workspace Integration)
              |                             |         |
              |                             |         +---> slice-09 (Variation Popover)
              |                             |         |
              |                             |         +---> slice-10 (Img2img Popover)
              |                             |         |
              |                             |         +---> slice-11 (Upscale Popover)
              |                             |
              |                             +---> slice-12 (Canvas Detail View)
              |                             |
              |                             +---> slice-13 (Chat Panel)
              |                             |         |
              |                             |         (nutzt slice-07 compact)
              |                             |
              |                             +---> slice-14 (Settings Read-Only)
              |
              +---> slice-15 (Cleanup: alte Dateien entfernen)
                        |
                        (nach allen Integrationen)

slice-16 (E2E Flow Verification)
    (nach slice-08..slice-14)
```

---

## Slice-Liste

### Slice 01: DB Schema + Migration

- **Scope:** Neue `model_slots` Tabelle in Drizzle-Schema definieren. SQL-Migration erstellen: CREATE TABLE, INSERT...SELECT aus `model_settings` (tier->slot Mapping), Seed-Defaults fuer fehlende Modes (15 Rows total), DROP TABLE `model_settings`.
- **Deliverables:**
  - `lib/db/schema.ts` (modelSlots pgTable hinzufuegen, modelSettings pgTable entfernen)
  - `drizzle/0012_add_model_slots.sql` (Migration: CREATE, MIGRATE, SEED, DROP)
- **Done-Signal:** Migration laeuft fehlerfrei (`npx drizzle-kit push` oder `drizzle-kit migrate`); `model_slots` Tabelle hat 15 Rows mit korrekten Defaults; `model_settings` Tabelle existiert nicht mehr.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "DB Schema + Migration"

---

### Slice 02: DB Queries

- **Scope:** Query-Funktionen fuer `model_slots` erstellen: `getAllModelSlots()`, `getModelSlotsByMode()`, `upsertModelSlot()`, `seedModelSlotDefaults()`. Alte `model_settings`-Queries entfernen.
- **Deliverables:**
  - `lib/db/queries.ts` (4 neue Slot-Query-Funktionen, 4 alte Settings-Queries entfernen)
- **Done-Signal:** Unit-Tests: `getAllModelSlots()` liefert 15 Rows; `upsertModelSlot()` aktualisiert mode+slot Kombination korrekt; `seedModelSlotDefaults()` erzeugt fehlende Rows.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "DB Schema + Migration"

---

### Slice 03: Types + resolve-model Refactor

- **Scope:** `Tier` Type und `VALID_TIERS` entfernen, `SlotNumber = 1 | 2 | 3` und `VALID_SLOTS` hinzufuegen. `resolveModel()` refactoren zu `resolveActiveSlots(slots, mode)` -- gibt Array zurueck statt einzelnes Objekt.
- **Deliverables:**
  - `lib/types.ts` (Tier -> SlotNumber, VALID_TIERS -> VALID_SLOTS)
  - `lib/utils/resolve-model.ts` (resolveModel -> resolveActiveSlots, Return-Type Array)
- **Done-Signal:** Unit-Tests: `resolveActiveSlots()` filtert korrekt nach mode + active und gibt `{modelId, modelParams}[]` zurueck; TypeScript kompiliert ohne Fehler fuer SlotNumber.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 2 "Slot-Service + API", Slice 7 "Cleanup"

---

### Slice 04: ModelSlotService

- **Scope:** Neuer Service `ModelSlotService` mit Business-Logik: getAll(), getForMode(), update() mit Kompatibilitaets-Check, toggleActive() mit min-1-Regel, seedDefaults(). Ersetzt `ModelSettingsService`.
- **Deliverables:**
  - `lib/services/model-slot-service.ts` (neuer Service)
- **Done-Signal:** Unit-Tests: min-1-Regel verhindert Deaktivierung des letzten aktiven Slots; Kompatibilitaets-Check lehnt inkompatible Models ab; Auto-Aktivierung bei Model-Zuweisung auf leeren Slot; Seed erzeugt 15 Default-Rows.
- **Dependencies:** ["slice-02", "slice-03"]
- **Discovery-Quelle:** Slice 2 "Slot-Service + API"

---

### Slice 05: Server Actions

- **Scope:** Neue Server Actions: `getModelSlots()`, `updateModelSlot()`, `toggleSlotActive()`. Auth-Check, Input-Validierung (mode, slot, modelId-Regex), delegiert an ModelSlotService. Alte `model-settings.ts` Actions entfernen.
- **Deliverables:**
  - `app/actions/model-slots.ts` (3 Server Actions)
- **Done-Signal:** Server Actions sind aufrufbar; `getModelSlots()` liefert Slots; `updateModelSlot()` validiert Input und gibt aktualisiertes Slot zurueck; `toggleSlotActive()` erzwingt min-1-Regel; ungueltige modelId wird abgelehnt.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 2 "Slot-Service + API"

---

### Slice 06: ModelSlots UI -- Stacked Layout

- **Scope:** Neue React-Komponente `ModelSlots` im Stacked-Layout: 3 Zeilen mit Radix Checkbox + Radix Select (Model-Dropdown). Zeigt nur mode-kompatible Models. Disabled-Checkbox fuer leere Slots. Auto-Aktivierung bei Model-Auswahl. Per-Slot ParameterPanel fuer aktive Slots (nutzt `useModelSchema` Hook). Ruft Server Actions `updateModelSlot()` und `toggleSlotActive()` auf. Dispatcht `"model-slots-changed"` Custom Event.
- **Deliverables:**
  - `components/ui/model-slots.tsx` (ModelSlots Komponente mit stacked + compact Variante)
- **Done-Signal:** Komponente rendert 3 Slot-Zeilen; Checkbox toggelt aktiv/inaktiv; Dropdown zeigt kompatible Models; leerer Slot hat disabled Checkbox; Model-Auswahl auf leerem Slot aktiviert automatisch; Per-Slot ParameterPanel wird fuer aktive Slots angezeigt; min-1-Regel verhindert Deaktivierung des letzten Slots.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 3 "ModelSlots UI-Komponente"

---

### Slice 07: ModelSlots UI -- Compact Layout

- **Scope:** Compact-Layout-Variante der ModelSlots-Komponente: horizontale Einzeiler mit gekuerzten Model-Namen, ohne ParameterPanel. Prop `layout="compact"` steuert die Variante. Fuer Chat Panel optimiert.
- **Deliverables:**
  - `components/ui/model-slots.tsx` (Compact-Layout-Branch hinzufuegen)
- **Done-Signal:** `<ModelSlots layout="compact" />` rendert horizontale Darstellung; Model-Namen werden truncated; kein ParameterPanel sichtbar; alle Slot-Interaktionen (Toggle, Dropdown) funktionieren wie im Stacked-Layout.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 3 "ModelSlots UI-Komponente"

---

### Slice 08: Workspace Integration (prompt-area)

- **Scope:** `prompt-area.tsx` umbauen: TierToggle entfernen, ModelSlots (stacked) einbinden. Tier-State durch Slot-State ersetzen. Generate-Handler: `resolveActiveSlots()` nutzen, `modelIds[]` an `generateImages()` uebergeben. Variant-Count Stepper bleibt. Event-Listener auf `"model-slots-changed"` umstellen.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (TierToggle -> ModelSlots, Multi-Model-Generate)
- **Done-Signal:** Workspace zeigt ModelSlots statt TierToggle; Generate sendet korrekt 1-3 modelIds basierend auf aktiven Slots; Variant-Count multipliziert mit aktiven Slots; Mode-Wechsel laedt mode-spezifische Slots.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 4 "Workspace Integration"

---

### Slice 09: Variation Popover Integration

- **Scope:** `variation-popover.tsx` umbauen: TierToggle durch ModelSlots (stacked) ersetzen. `VariationParams.tier` durch `modelIds: string[]` ersetzen. Per-Slot Parameter inline. Generate-Handler nutzt aktive Slots.
- **Deliverables:**
  - `components/canvas/popovers/variation-popover.tsx` (TierToggle -> ModelSlots)
- **Done-Signal:** Variation Popover zeigt ModelSlots statt TierToggle; Generate sendet aktive Slot-ModelIds; Per-Slot Parameter werden angezeigt; Button-Gruppe fuer Count funktioniert.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 5 "Canvas Integration"

---

### Slice 10: Img2img Popover Integration

- **Scope:** `img2img-popover.tsx` umbauen: TierToggle durch ModelSlots (stacked) ersetzen. `Img2imgParams.tier` durch `modelIds: string[]` ersetzen. Strength-Slider bleibt als Popover-Level-Parameter oberhalb der Slots. Per-Slot Parameter inline.
- **Deliverables:**
  - `components/canvas/popovers/img2img-popover.tsx` (TierToggle -> ModelSlots)
- **Done-Signal:** Img2img Popover zeigt Strength-Slider + ModelSlots; Generate sendet aktive Slot-ModelIds; img2img-kompatible Models im Dropdown; Per-Slot Parameter werden angezeigt.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 5 "Canvas Integration"

---

### Slice 11: Upscale Popover Integration

- **Scope:** `upscale-popover.tsx` umbauen: TierToggle (mit hiddenValues-Workaround) durch ModelSlots (stacked, ohne ParameterPanel) ersetzen. Scale-Buttons (2x/4x) bleiben als direkte Action-Trigger. Nur upscale-kompatible Models im Dropdown.
- **Deliverables:**
  - `components/canvas/popovers/upscale-popover.tsx` (TierToggle -> ModelSlots)
- **Done-Signal:** Upscale Popover zeigt ModelSlots ohne Per-Slot-Parameter; 2x/4x Buttons loesen Upscale mit aktiven Slot-ModelIds aus; kein hiddenValues-Workaround mehr noetig.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 5 "Canvas Integration"

---

### Slice 12: Canvas Detail View Integration

- **Scope:** `canvas-detail-view.tsx` umbauen: `modelSettings` Prop durch `modelSlots` ersetzen. Variation/Img2img/Upscale-Handler nutzen aktive Slots statt Tier. Event-Listener auf `"model-slots-changed"` umstellen.
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (modelSettings -> modelSlots, Event-Rename)
- **Done-Signal:** Canvas Detail View laedt Slots statt Settings; Popover-Handler uebergeben korrekte Slot-Daten; Event-Listener reagiert auf `"model-slots-changed"`.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 5 "Canvas Integration"

---

### Slice 13: Chat Panel Integration

- **Scope:** `canvas-chat-panel.tsx` umbauen: TierToggle durch ModelSlots (compact) ersetzen. Tier-basiertes Model-Lookup durch aktive-Slot-Resolution ersetzen. Slots bleiben interaktiv waehrend AI-Streaming.
- **Deliverables:**
  - `components/canvas/canvas-chat-panel.tsx` (TierToggle -> ModelSlots compact)
- **Done-Signal:** Chat Panel zeigt Compact-ModelSlots; Model-Auswahl steuert Generation im Chat; Slots bleiben waehrend Streaming interaktiv; keine ParameterPanels sichtbar.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 5 "Canvas Integration"

---

### Slice 14: Settings Dialog Read-Only

- **Scope:** `settings-dialog.tsx` und `model-mode-section.tsx` auf Read-Only umstellen. Editierbare Dropdowns durch statische Anzeige ersetzen: Slot-Label + Model-Name + Status-Dot (aktiv/inaktiv). `onModelChange` Handler entfernen. Hint-Text "Change models in the workspace." hinzufuegen. Sync-Button bleibt.
- **Deliverables:**
  - `components/settings/settings-dialog.tsx` (Read-Only, keine Edit-Handler)
  - `components/settings/model-mode-section.tsx` (Slot-Anzeige statt Tier-Dropdowns)
- **Done-Signal:** Settings-Dialog zeigt alle 5 Modes mit je 3 Slots (read-only); aktive Slots haben gruenen Dot; inaktive grauen Dot; leere Slots zeigen "not assigned"; kein Edit moeglich; Sync-Button funktioniert weiterhin.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 6 "Settings Read-Only"

---

### Slice 15: Cleanup -- Legacy-Dateien entfernen

- **Scope:** Alte Tier-Dateien loeschen: `tier-toggle.tsx`, `max-quality-toggle.tsx`, `model-settings-service.ts`, `app/actions/model-settings.ts`. Alle verbleibenden Imports/Referenzen auf `Tier`, `TierToggle`, `model-settings-changed` Event bereinigen. TypeScript-Kompilierung ohne Fehler sicherstellen.
- **Deliverables:**
  - `components/ui/tier-toggle.tsx` (LOESCHEN)
  - `components/ui/max-quality-toggle.tsx` (LOESCHEN)
  - `lib/services/model-settings-service.ts` (LOESCHEN)
- **Done-Signal:** `tsc --noEmit` kompiliert fehlerfrei; `grep -r "TierToggle\|tier-toggle\|model-settings-service\|VALID_TIERS\|model-settings-changed" --include="*.ts" --include="*.tsx"` findet keine Treffer (ausser Migrations-SQL und Specs); `app/actions/model-settings.ts` existiert nicht mehr.
- **Dependencies:** ["slice-08", "slice-09", "slice-10", "slice-11", "slice-12", "slice-13", "slice-14"]
- **Discovery-Quelle:** Slice 7 "Cleanup"

---

### Slice 16: E2E Flow Verification

- **Scope:** End-to-End-Verifikation aller kritischen Flows: (1) Quick Model Switch im Workspace, (2) Multi-Model-Generierung mit 2 aktiven Slots, (3) Mode-Wechsel behaelt Slot-Konfiguration, (4) Popover-Generierung mit Slots, (5) Settings zeigt Read-Only-Daten korrekt an. Manuelle Test-Checkliste oder Playwright-Tests.
- **Deliverables:**
  - `e2e/model-slots.spec.ts` (Playwright E2E Tests fuer kritische Flows)
- **Done-Signal:** Alle 5 E2E-Flows bestehen: Workspace-Generate mit 1 Slot, Multi-Model-Generate mit 2 Slots, Mode-Switch Round-Trip, Popover-Generate, Settings Read-Only Anzeige.
- **Dependencies:** ["slice-15"]
- **Discovery-Quelle:** Alle Discovery-Slices (Integration)

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| Slice 1: DB Schema + Migration | Migration laeuft, 15 Rows, model_settings gedroppt | slice-01, slice-02 | Migration fehlerfrei; 15 Rows in model_slots; model_settings nicht mehr vorhanden |
| Slice 2: Slot-Service + API | Server Actions aufrufbar, Validierung greift | slice-04, slice-05 | getModelSlots liefert Daten; updateModelSlot validiert; toggleSlotActive erzwingt min-1 |
| Slice 3: ModelSlots UI | Komponente rendert, Checkbox + Dropdown funktionieren | slice-06, slice-07 | 3 Zeilen sichtbar; Toggle funktioniert; Dropdown zeigt kompatible Models; Auto-Aktivierung |
| Slice 4: Workspace Integration | Generate sendet multi-model modelIds[] | slice-08 | Workspace zeigt ModelSlots; Generate sendet 1-3 modelIds; Variants multiplizieren |
| Slice 5: Canvas Integration -- Variation | Variation Popover nutzt Slots statt Tier | slice-09 | Variation Popover zeigt ModelSlots; Generate sendet aktive Slot-ModelIds |
| Slice 5: Canvas Integration -- Img2img | Img2img Popover nutzt Slots statt Tier | slice-10 | Img2img Popover zeigt Strength + ModelSlots; Generate sendet aktive Slot-ModelIds |
| Slice 5: Canvas Integration -- Upscale | Upscale Popover nutzt Slots statt Tier | slice-11 | Upscale Popover zeigt ModelSlots; 2x/4x Buttons nutzen aktive Slots |
| Slice 5: Canvas Integration -- Detail View | Canvas Detail View nutzt modelSlots Prop | slice-12 | Detail View laedt Slots; Event-Listener auf model-slots-changed |
| Slice 5: Canvas Integration -- Chat Panel | Chat Panel nutzt compact ModelSlots | slice-13 | Compact-Slots im Chat; Model-Auswahl steuert Generation; interaktiv waehrend Streaming |
| Slice 6: Settings Read-Only | Settings zeigt Read-Only Slots | slice-14 | Alle Modes mit 3 Slots read-only; Status-Dot; Hint-Text; kein Edit |
| Slice 7: Cleanup | Keine Tier-Referenzen mehr im Code | slice-15 | tsc kompiliert; grep findet keine Tier-Referenzen; alte Dateien geloescht |
| Cross-Slice: Quick Model Switch (Flow 1) | User wechselt Model in Slot via Dropdown | slice-08, slice-16 | E2E: Dropdown-Aenderung -> naechste Generierung nutzt neues Model |
| Cross-Slice: Multi-Model Vergleich (Flow 2) | 2 aktive Slots generieren je N Varianten | slice-08, slice-16 | E2E: 2 Slots x 2 Varianten = 4 Bilder |
| Cross-Slice: Mode-Wechsel (Flow 3) | Mode-Switch laedt mode-spezifische Slots aus DB | slice-08, slice-16 | E2E: txt2img -> img2img -> txt2img behalt Slots |
| Cross-Slice: Neues Model einrichten (Flow 4) | Leerer Slot bekommt Model -> Auto-Aktivierung | slice-06, slice-16 | E2E: Model auf Slot 3 waehlen -> Checkbox wird automatisch aktiv |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
- [x] Flow-Completeness: Jeder Integration-Testfall aus Discovery hat zugehoerigen Slice mit Done-Signal (Regel 7)
