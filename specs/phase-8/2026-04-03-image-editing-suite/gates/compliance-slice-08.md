# Gate 2: Compliance Report -- Slice 08

**Geprufter Slice:** `specs/phase-8/2026-04-03-image-editing-suite/slices/slice-08-instruction-editing.md`
**Prufdatum:** 2026-04-04

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | ID: `slice-08-instruction-editing`, Test: `pnpm test components/canvas/__tests__/canvas-chat-panel-instruction.test.tsx`, E2E: `false`, Dependencies: `["slice-07-inpaint-integration"]` -- alle 4 Felder vorhanden |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden: Stack `typescript-nextjs`, Test/Acceptance/Start Commands, Health Endpoint, Mocking Strategy `mock_external` |
| D-3: AC Format | PASS | 6 ACs, alle enthalten GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | `<test_spec>` Block vorhanden, 6 `it.todo()` Skeletons (JS/TS Pattern), 6 Tests >= 6 ACs |
| D-5: Integration Contract | PASS | "Requires From Other Slices" Tabelle mit 6 Eintraegen, "Provides To Other Slices" Tabelle mit 2 Eintraegen |
| D-6: Deliverables Marker | PASS | `DELIVERABLES_START`/`DELIVERABLES_END` Marker vorhanden, 1 Deliverable mit Dateipfad (`components/canvas/canvas-chat-panel.tsx`) |
| D-7: Constraints | PASS | "Constraints" Section vorhanden mit 7 Scope-Grenzen und 5 technischen Constraints + Reuse-Tabelle |
| D-8: Groesse | PASS | 177 Zeilen -- weit unter 400-Zeilen-Warnschwelle. Code-Block (Zeile 89-107) = 18 Zeilen, unter 20 Zeilen Limit |
| D-9: Anti-Bloat | PASS | Keine "Code Examples" Section, keine ASCII-Art Wireframes, kein DB-Schema (CREATE TABLE/pgTable), keine uebergrossen Type-Definitionen |
| D-10: Codebase Reference | PASS | MODIFY `canvas-chat-panel.tsx` -- Datei existiert (Glob bestaetigt). `handleCanvasGenerate` Funktion existiert (Zeile 281). `resolveActiveSlots` existiert in `lib/utils/resolve-model.ts`. `generateImages` existiert in `app/actions/generations.ts` (Zeile 68). `editMode`/`maskData` nicht im aktuellen Code, aber von Slice-02 (transitive Dependency via Slice-07) erstellt. |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

### L-1: AC-Qualitaet

| AC | Testbarkeit | Spezifitaet | GIVEN Vollstaendigkeit | WHEN Eindeutigkeit | THEN Messbarkeit |
|----|-------------|-------------|------------------------|--------------------|------------------|
| AC-1 | PASS | Konkrete Werte: `action: "instruction"`, `editMode: null`, `maskData: null`, `generationMode: "instruction"`, `sourceImageUrl` | PASS: 3 Preconditions klar definiert | PASS: eine Aktion (Handler ausfuehren) | PASS: 3 messbare Assertions (resolveActiveSlots Aufruf, generateImages Parameter, maskUrl undefined) |
| AC-2 | PASS | Konkrete Werte: instruction-Slot modelId, modelParams merge mit event.params (event ueberschreibt) | PASS | PASS | PASS: modelId aus instruction-Slot, merge-Logik spezifiziert |
| AC-3 | PASS | Fallback auf `generation.modelId` bei leerem Array | PASS: leeres Array als Vorbedingung | PASS | PASS: konsistent mit bestehendem Fallback-Pattern |
| AC-4 | PASS | Konkrete Dispatch-Aktionen: PUSH_UNDO, SET_CURRENT_IMAGE, onGenerationsCreated | PASS: Polling-Ergebnis als Vorbedingung | PASS | PASS: 3 messbare Ergebnisse |
| AC-5 | PASS | Konkrete Werte: Toast mit Fehlermeldung, `SET_GENERATING: false`, Bild bleibt unveraendert | PASS: error-Response als Vorbedingung | PASS | PASS: 3 messbare Ergebnisse |
| AC-6 | PASS | End-to-End-Flow mit konkreten Werten: `generationMode: "instruction"`, `sourceImageUrl`, `promptMotiv` | PASS: User-Szenario klar | PASS | PASS: Verknuepft AC-1 bis AC-4 in einem Flow |

**Status:** PASS -- Alle 6 ACs sind testbar, spezifisch und messbar.

### L-2: Architecture Alignment

| Pruefpunkt | Status | Detail |
|------------|--------|--------|
| Action-Mapping | PASS | `action="instruction"` -> `generationMode: "instruction"` stimmt mit architecture.md Zeile 163 ueberein (Business Logic Flow: `[No Mask + Edit] action="instruction"`) |
| Modell-Routing | PASS | Instruction-Mode nutzt FLUX Kontext Pro via Slot-Resolution -- stimmt mit architecture.md Seed Defaults Zeile 134 ueberein (`instruction` Slot 1: FLUX Kontext Pro) |
| Server Action Parameter | PASS | `generateImages()` mit `generationMode: "instruction"` + `sourceImageUrl` -- stimmt mit architecture.md Zeile 148 ueberein (instruction: image+prompt, keine Maske) |
| Canvas Chat Panel Extension | PASS | `handleCanvasGenerate` Erweiterung stimmt mit Migration Map Zeile 331 ueberein |
| Kein maskUrl bei instruction | PASS | AC-1 spezifiziert `maskUrl: undefined` -- konsistent mit architecture.md Zeile 148 (instruction: keine Maske) |

**Status:** PASS

### L-3: Integration Contract Konsistenz

| Pruefpunkt | Status | Detail |
|------------|--------|--------|
| Requires: slice-07 handleCanvasGenerate | PASS | Slice-07 Provides (Zeile 163): `handleCanvasGenerate (erweitert)` als `Dispatch-basierter Handler mit action-Switch` -- Slice-08 fuegt `case "instruction":` hinzu |
| Requires: slice-07 SSECanvasGenerateEvent | PASS | Slice-07 Provides (Zeile 164): action-Union enthaelt `"instruction"` |
| Requires: slice-07 parseSSEEvent | PASS | Slice-07 Provides (Zeile 165): parsed neue Actions inkl. instruction |
| Requires: slice-02 editMode/maskData | PASS | Slice-02 stellt `editMode` und `maskData` als State-Felder bereit (transitive Dependency via slice-07) |
| Requires: slice-06a generateImages instruction | PASS | Slice-06a erweitert generateImages um `generationMode: "instruction"` (AC-3 dort) |
| Requires: slice-01 resolveActiveSlots | PASS | `resolveActiveSlots` existiert in `lib/utils/resolve-model.ts` und ist generisch (filtert nach mode-Parameter) |
| Provides: instruction-Branch | PASS | Consumer slice-13 (outpaint) referenziert in Slice-07 als Pattern-Nutzer |
| Provides: Instruction-Mode Slot-Resolution Pattern | PASS | Generisches Pattern fuer mode-basierte Slot-Resolution |

**Status:** PASS

### L-4: Deliverable-Coverage

| Pruefpunkt | Status | Detail |
|------------|--------|--------|
| AC -> Deliverable Mapping | PASS | Alle 6 ACs beziehen sich auf `canvas-chat-panel.tsx` (handleCanvasGenerate instruction-Branch) -- das einzige Deliverable |
| Verwaiste Deliverables | PASS | Das einzige Deliverable wird von allen 6 ACs adressiert |
| Test-Deliverable | PASS | Test-Skeleton referenziert dedizierte Test-Datei `canvas-chat-panel-instruction.test.tsx` (Test-Writer erstellt sie) |

**Status:** PASS

### L-5: Discovery Compliance

| Pruefpunkt | Status | Detail |
|------------|--------|--------|
| Flow 3: Instruction Editing | PASS | Discovery Zeile 133-143 beschreibt: User tippt im Chat ohne Edit-Tool -> Canvas Agent waehlt FLUX Kontext Pro -> Bild + Instruktion -> Ergebnis ersetzt Bild. AC-1 (instruction-Branch), AC-4 (PUSH_UNDO + SET_CURRENT_IMAGE), AC-6 (End-to-End) decken diesen Flow ab |
| Error Paths | PASS | Discovery Zeile 142: "Modell kann Intent nicht umsetzen" -- AC-5 deckt Error-Handling ab (Toast + isGenerating reset). Discovery Zeile 143 (Generate-Intent Fallback) liegt ausserhalb des Slice-Scopes (Canvas Agent Klassifizierung, Slice-06b) |
| UI-States | PASS | Wireframes Zeile 357: `generating (from instruction edit)`: Loading overlay only, no mask, no floating toolbar -- konsistent mit AC-1 (`maskUrl: undefined`, keine Maske-Logik) und AC-4 (Ergebnis ersetzt Bild) |
| Slot Resolution | PASS | Discovery Zeile 293: Keine Maske + Edit-Intent -> Instruction-Modell (Default: FLUX Kontext Pro) -- AC-2 nutzt instruction-Slot-Resolution |
| Fallback | PASS | AC-3 definiert Fallback auf `generation.modelId` bei fehlendem instruction-Slot -- konsistentes Pattern mit architecture.md Slot-System |

**Status:** PASS

### L-6: Consumer Coverage

| Pruefpunkt | Status | Detail |
|------------|--------|--------|
| Modifizierte Methode | `handleCanvasGenerate` in `canvas-chat-panel.tsx` |
| Art der Modifikation | Neuer `case "instruction":` Branch im action-Switch (hinzufuegen, nicht aendern) |
| Bestehende Aufrufer | `handleCanvasGenerate` wird intern in Zeile 418 als Callback bei SSE-Events aufgerufen -- Signatur bleibt identisch |
| Bewertung | SKIP -- Die Modifikation fuegt einen neuen Branch hinzu, ohne die bestehende Funktions-Signatur oder Return-Types zu aendern. Bestehende Aufrufer sind nicht betroffen |

**Status:** SKIP -- Kein bestehendes Interface wird veraendert, nur neuer interner Branch

---

## Blocking Issues

Keine.

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0
