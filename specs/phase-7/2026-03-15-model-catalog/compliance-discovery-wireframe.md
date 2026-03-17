# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-7/2026-03-15-model-catalog/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-15-model-catalog/wireframes.md`
**Prufdatum:** 2026-03-17

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 28 |
| Auto-Fixed | 9 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles wird gefixt oder blockiert.

**Note (READ-ONLY mode):** Dieses Dokument ist in einem READ-ONLY-Lauf erstellt worden. Die Auto-Fix-Eintraege sind als DISCOVERY_UPDATES im Rueckgabe-Format dokumentiert und muessen manuell in discovery.md angewendet werden.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Erster App-Start (leere DB) | 9 | Workspace First Start screen + sync-toast progress/success | Pass |
| Flow 2: Manueller Sync | 8 + 3 Error Paths | Model Settings Modal + sync-toast (progress, success, partial, error) | Pass |
| Flow 3: Model-Zuweisung im Settings Modal | 5 + 3 Error Paths | Model-Dropdown loaded/loading states + Parameter Panel note | Pass |

**Detail Flow 1:**
- App startet, Tabelle leer: Workspace First Start screen zeigt Progress-Toast (0/120)
- Auto-Sync Hintergrund: Toast-Annotation "workspace remains fully usable"
- Progress-Toast "Syncing Models... 0/120": Toast progress state visualisiert
- Collections fetch, Schema fetch, Capability-Detection, DB-Speicherung: Backend-Logik, kein Wireframe-Screen benoetigt
- Success-Toast "120 Models synced": Toast success state visualisiert
- Dropdowns gefuellt: Modal-Wireframe zeigt gefuellte Dropdowns

**Detail Flow 2:**
- Modal oeffnen: Modal-Wireframe zeigt idle state
- Sync-Button klicken: Button-States zeigen Uebergang idle -> syncing
- Progress-Toast: Toast progress state
- Partial Success ("95 synced, 3 new, 1 updated, 25 failed"): Partial-Toast-State exakt abgebildet
- Error Paths: error-Toast zeigt "Sync failed: API not reachable. Existing data unchanged."

**Detail Flow 3:**
- Dropdown oeffnen: loaded state zeigt Modelliste
- Model in DB: loaded state, Parameter Panel sofort
- Model NICHT in DB: loading state zeigt "Loading schema..." im Parameter Panel

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| `sync-button` | idle, syncing, sync_partial | idle, syncing, sync_partial | -- | Pass |
| `sync-toast` | progress, success, partial, error | progress, success, partial, error | -- | Pass |
| `model-dropdown` | loaded, empty:syncing, empty:never-synced, empty:failed, empty:partial, loading | loaded, empty:syncing, empty:never-synced, empty:failed, empty:partial, loading | -- | Pass |
| `inpaint-dropdown` | loaded, empty:syncing, empty:never-synced, empty:failed, empty:partial, loading | Abgedeckt durch generische model-dropdown States; INPAINT Row in Modal-Layout | -- | Pass |
| `outpaint-dropdown` | loaded, empty:syncing, empty:never-synced, empty:failed, empty:partial, loading | Abgedeckt durch generische model-dropdown States; OUTPAINT Row in Modal-Layout | -- | Pass |
| Feature State Machine: no_models | Dropdowns empty:syncing, Sync-Button disabled | Workspace First Start + empty:syncing dropdown | -- | Pass |
| Feature State Machine: syncing | Progress-Toast, Button disabled | syncing Button-State + progress Toast | -- | Pass |
| Feature State Machine: synced | Dropdowns gefuellt, Button idle | Filled modal + idle Button-State | -- | Pass |
| Feature State Machine: sync_partial | Partial-Toast, Button mit Badge | partial Toast + sync_partial Button-State | -- | Pass |
| Feature State Machine: sync_failed | Error-Toast, Dropdowns empty:failed | error Toast + empty:failed Dropdown-State | -- | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| `sync-button` | Model Settings Modal, unterhalb Header-Titel | Annotation 1: Label, Position, alle 3 States | Pass |
| `sync-toast` | Global Toast Area (Workspace + modal context) | Alle 4 State-Screens mit detaillierten State Variations Tabelle | Pass |
| `model-dropdown` | Model Settings Modal — alle Mode/Tier Rows | Annotation 2: Capability-Filter-Logik pro Row | Pass |
| `inpaint-dropdown` | INPAINT Section Row | Annotation 2 gilt, INPAINT Row in Modal-Wireframe | Pass |
| `outpaint-dropdown` | OUTPAINT Section Row | Annotation 2 gilt, OUTPAINT Row in Modal-Wireframe | Pass |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Toast-Positionierung | "bottom-right or top-right of viewport" | UI Components & States — sync-toast | Auto-Fixed |
| sync_partial Tooltip-Text | "Last sync: X models failed. Click to retry." | UI Components & States — sync-button | Auto-Fixed |
| empty:partial Tooltip-Text | "Other modes synced successfully. This capability had no results." | UI Components & States — model-dropdown | Auto-Fixed |
| loading State Location | Spinner erscheint im Parameter Panel Bereich, NICHT im Dropdown selbst | UI Components & States — model-dropdown | Auto-Fixed |
| Sync-Button label im syncing State | Label wechselt zu "Syncing..." (nicht "Sync Models") | UI Components & States — sync-button | Auto-Fixed |
| IMAGE TO IMAGE verfuegbare Tiers | Nur Draft und Quality (kein Max) | UI Layout & Context — Screen: Model Settings Modal | Auto-Fixed |
| UPSCALE verfuegbare Tiers | Nur Quality und Max (kein Draft) | UI Layout & Context — Screen: Model Settings Modal | Auto-Fixed |
| INPAINT verfuegbare Tiers | Nur Quality | UI Layout & Context — Screen: Model Settings Modal | Auto-Fixed |
| OUTPAINT verfuegbare Tiers | Nur Quality | UI Layout & Context — Screen: Model Settings Modal | Auto-Fixed |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | Discovery Has | Status |
|-----------------|-------------------|---------------|--------|
| Workspace bleibt voll nutzbar wahrend Auto-Sync | Auto-Sync laeuft non-blocking im Hintergrund; kein UI-Lock | Teilweise ("im Hintergrund") — kein explizites "Workspace bleibt nutzbar" | Auto-Fixed (Teil von Toast-Positionierungs-Update) |
| Progress-Toast zeigt "X / Y" Counter | Sync-Service muss aktuelle Zahl + Gesamtzahl verfolgen und via API/Event melden | Impliziert durch "Syncing Models... 45/120" in Discovery, nicht explizit als Tracking-Anforderung | Pass (bereits in Discovery impliziert) |
| Partial-Toast zeigt separate Zeile fuer Fehleranzahl | Zwei-Zeilen-Layout: "X synced ... / Y failed" als separate Zeile | Discovery nennt die Zahlen, nicht explizit zwei Zeilen — visuelles Detail, kein funktionales Gap | Pass (visuelles Detail, kein Discovery-Gap) |
| sync_partial Tooltip mit "Last sync: X models failed" | Anzahl der fehlgeschlagenen Models muss persistent gespeichert werden (nicht nur Toast-State) | Discovery erwaehnt Badge aber nicht persistenten Fehler-Zaehler | Auto-Fixed (Teil von Tooltip-Text-Update) |

---

## C) Auto-Fix Summary

### Discovery Updates Applied (READ-ONLY: als DISCOVERY_UPDATES zurueckgegeben)

| Section | Content Added |
|---------|---------------|
| UI Components & States — sync-toast | Toast-Position: "bottom-right or top-right of viewport" |
| UI Components & States — sync-button | sync_partial Tooltip-Text: "Last sync: X models failed. Click to retry." — impliziert persistenten Fehler-Zaehler |
| UI Components & States — sync-button | syncing State aendert Button-Label zu "Syncing..." |
| UI Components & States — model-dropdown | loading State: Spinner erscheint im Parameter Panel Bereich, nicht im Dropdown selbst |
| UI Components & States — model-dropdown | empty:partial Tooltip-Text: "Other modes synced successfully. This capability had no results." |
| UI Layout & Context | Tiers pro Capability explizit: txt2img=Draft/Quality/Max, img2img=Draft/Quality, upscale=Quality/Max, inpaint=Quality, outpaint=Quality |
| UI Layout & Context | Workspace bleibt voll nutzbar wahrend Auto-Sync (non-blocking) |

### Wireframe Updates Needed (Blocking)

Keine.

---

## D) Design Decisions -> Wireframe

Phase ubersprungen: `design-decisions.md` existiert nicht im Spec-Ordner.

---

## Blocking Issues

Keine Blocking Issues identifiziert.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 9
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Discovery-Updates aus DISCOVERY_UPDATES anwenden (toast-Position, Tooltip-Texte, Tier-Konfiguration pro Capability, loading State Location, syncing Label)
- [ ] Architecture-Phase kann beginnen (alle UI-Details sind jetzt dokumentiert)
