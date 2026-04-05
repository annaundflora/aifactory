# Gate 2: Compliance Report -- Slice 07

**Geprüfter Slice:** `slices/slice-07-inpaint-integration.md`
**Prüfdatum:** 2026-04-04

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | ID `slice-07-inpaint-integration`, Test (3 test files), E2E `false`, Dependencies (5 slices) |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden: Stack `typescript-nextjs`, Test/Integration/Acceptance/Start Commands, Health Endpoint, Mocking Strategy |
| D-3: AC Format | PASS | 10 ACs, alle mit GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | 10 Tests (2+5+3) vs 10 ACs. 3 `<test_spec>` Bloecke mit `it.todo(` Pattern |
| D-5: Integration Contract | PASS | "Requires From" Tabelle (5 Eintraege), "Provides To" Tabelle (5 Eintraege) |
| D-6: Deliverables Marker | PASS | 3 Deliverables zwischen DELIVERABLES_START/END, alle mit Dateipfaden |
| D-7: Constraints | PASS | Scope-Grenzen (7), Technische Constraints (5), Reuse-Tabelle (6 Eintraege), Referenzen (7) |
| D-8: Groesse | PASS | 220 Zeilen. Code-Bloecke: 7, 16, 10 Zeilen (alle < 20) |
| D-9: Anti-Bloat | PASS | Keine Code Examples Section, keine ASCII-Art, kein DB-Schema, keine grossen Type-Definitionen |
| D-10: Codebase Reference | PASS | 3 MODIFY-Dateien geprueft: `canvas-chat-service.ts` (`SSECanvasGenerateEvent` Z.38, `parseSSEEvent` Z.77), `canvas-chat-panel.tsx` (`handleCanvasGenerate` Z.281), `canvas-toolbar.tsx` (`TOOLS` Z.45, `ToolDef` Z.37). IMPORT-Dateien: `generations.ts` (`generateImages` Z.68), `canvas-detail-context.tsx` (`useCanvasDetail` Z.216). `mask-service.ts` existiert noch nicht -- wird von Dependency slice-05 erstellt (SKIP). |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

| Check | Status | Detail |
|-------|--------|--------|
| L-1: AC-Qualitaet | PASS | Siehe Detail unten |
| L-2: Architecture Alignment | PASS | Siehe Detail unten |
| L-3: Contract Konsistenz | PASS | Siehe Detail unten |
| L-4: Deliverable-Coverage | PASS | Siehe Detail unten |
| L-5: Discovery Compliance | PASS | Siehe Detail unten |
| L-6: Consumer Coverage | PASS | Siehe Detail unten |

### L-1: AC-Qualitaet

Alle 10 ACs sind testbar, spezifisch und maschinell pruefbar:

- **AC-1/2 (SSE Parsing):** Konkrete Feld-Werte (`action: "inpaint"`, `mask_url: "https://r2.example.com/mask.png"`), klare Input/Output.
- **AC-3 (Inpaint-Flow):** Vollstaendige Pipeline spezifiziert mit 6 konkreten Aufrufen (validateMinSize, applyFeathering, scaleToOriginal, toGrayscalePng, R2 upload, generateImages). Konkrete Parameter (`minSize: 10`, `radius: 10`).
- **AC-4 (Fallback):** Klare Bedingung (maskData null) mit konkretem Ergebnis (generationMode: "instruction").
- **AC-5 (Mask too small):** Konkrete Toast-Nachricht, klare negative Assertion (generateImages NICHT aufgerufen).
- **AC-6 (Post-Generation):** Konkrete Dispatch-Actions (PUSH_UNDO, SET_CURRENT_IMAGE).
- **AC-7 (Toolbar):** 4 konkrete Button-IDs und Labels, `toggle: true` spezifiziert.
- **AC-8/9 (Dispatch):** Konkrete Action-Payloads (SET_EDIT_MODE mit "inpaint" bzw. "erase").
- **AC-10 (Erase-Action):** Konkretes generationMode ("erase") + maskUrl.

Kein AC ist vage oder subjektiv. Alle THEN-Klauseln sind maschinell pruefbar.

### L-2: Architecture Alignment

- **SSECanvasGenerateEvent:** Slice erweitert `action` um `"inpaint" | "erase" | "instruction" | "outpaint"` + optionale Felder `mask_url`, `outpaint_directions`, `outpaint_size`. Stimmt exakt mit `architecture.md` Zeile 94 (DTO-Definition) und Zeile 332 (Migration Map) ueberein.
- **handleCanvasGenerate:** Erweiterung um Inpaint/Erase-Branch mit MaskService-Pipeline + generateImages-Aufruf. Konsistent mit architecture.md Zeile 331 (Migration Map) und Zeile 274-304 (Data Flow).
- **TOOLS Array:** 4 neue ToolDef-Eintraege (brush-edit, erase, click-edit, expand) mit `toggle: true`. Konsistent mit architecture.md Zeile 329 (Migration Map).
- **Error Handling:** Toast "Markiere einen groesseren Bereich" in AC-5 stimmt mit architecture.md Zeile 311 (Error Handling Strategy) ueberein.
- **generationMode-Mapping:** `"inpaint"` -> `"inpaint"`, `"erase"` -> `"erase"` in Constraints. Konsistent mit architecture.md Zeile 148 (buildReplicateInput Modes).

Kein Widerspruch zu Architecture-Vorgaben gefunden.

### L-3: Contract Konsistenz

**Requires From:**
- `slice-02`: `CanvasDetailState.editMode`, `maskData`, `SET_EDIT_MODE` -- slice-02 "Provides To" listet diese State-Felder und Action-Types fuer Consumer-Slices. Konsistent.
- `slice-04`: `FloatingBrushToolbar` mit `onEraseAction` Callback -- slice-04 "Provides To" listet genau dieses Interface (`<FloatingBrushToolbar onEraseAction={() => void} />`). Konsistent.
- `slice-05`: 4 MaskService-Funktionen -- slice-05 "Provides To" listet `toGrayscalePng`, `applyFeathering`, `scaleToOriginal`, `validateMinSize` mit slice-07 als Consumer. Konsistent.
- `slice-06a`: `generateImages()` mit `maskUrl`, `generationMode` -- slice-06a "Provides To" listet `GenerateImagesInput` (extended) mit `maskUrl` fuer slice-07. Konsistent.
- `slice-06b`: SSE `canvas-generate` Event mit erweiterten Actions -- slice-06b "Provides To" listet SSE Event Payload mit 6 Actions und optionalen Feldern. Konsistent.

**Provides To:**
- `handleCanvasGenerate` fuer slice-08, slice-13 -- plausibel (instruction und outpaint branches).
- `SSECanvasGenerateEvent` fuer slice-08, slice-09, slice-13 -- plausibel (spaeteren Slices brauchen erweiterte Event-Types).
- `parseSSEEvent` fuer slice-08, slice-13 -- konsistent.
- 4 Toolbar-Buttons fuer slice-09, slice-11 -- konsistent.
- Mask-Upload-Pipeline fuer slice-09, slice-13 -- konsistent (Pattern-Reuse).

Interface-Signaturen sind typenkompatibel.

### L-4: Deliverable-Coverage

| AC | Deliverable(s) | Coverage |
|----|----------------|----------|
| AC-1, AC-2 | `lib/canvas-chat-service.ts` (SSE-Typ + Parser) | Direkt |
| AC-3, AC-4, AC-5, AC-6, AC-10 | `components/canvas/canvas-chat-panel.tsx` (handleCanvasGenerate) | Direkt |
| AC-7, AC-8, AC-9 | `components/canvas/canvas-toolbar.tsx` (TOOLS Array) | Direkt |

- Jedes AC referenziert mindestens ein Deliverable.
- Kein Deliverable ist verwaist -- alle 3 werden von ACs abgedeckt.
- Test-Deliverables: 3 Test-Dateien in Test-Skeletons spezifiziert (nicht in Deliverables, korrekt per Konvention).

### L-5: Discovery Compliance

- **Inpaint-Flow (Discovery Flow 1):** AC-3 deckt die Mask-Pipeline ab (validate, feather, scale, grayscale, upload, generateImages). Konsistent mit Discovery Zeile 106-110.
- **Fallback bei leerer Maske (Discovery Zeile 119):** AC-4 deckt "Leere Maske + Prompt -> Instruction Editing" ab.
- **Mask too small (Discovery Zeile 120):** AC-5 deckt Warnung bei < 10px ab.
- **Post-Edit (Discovery Zeile 302):** AC-6 deckt PUSH_UNDO + SET_CURRENT_IMAGE ab.
- **Toolbar-Buttons (Discovery UI Components Zeile 210-213):** AC-7 registriert die 4 neuen Buttons.
- **Erase-Flow (Discovery Flow 2 Zeile 124):** AC-10 deckt Erase-Generation mit maskUrl ab.
- **Toolbar Mutual Exclusion (Discovery Zeile 303):** AC-8/9 dispatchen SET_EDIT_MODE, nutzen bestehendes Toggle-Pattern.

Alle relevanten Business Rules aus Discovery sind abgedeckt. Der Scope ist korrekt begrenzt -- Instruction-Editing (Flow 3), Click-to-Edit (Flow 4), Outpainting (Flow 5) sind explizit in Constraints ausgeschlossen und anderen Slices zugewiesen.

### L-6: Consumer Coverage

3 MODIFY-Deliverables. Caller-Analyse:

1. **`SSECanvasGenerateEvent` (canvas-chat-service.ts):** Typ wird in `canvas-chat-panel.tsx` importiert (Z.25) und in `handleCanvasGenerate` (Z.282) konsumiert. Die Erweiterung um neue Action-Werte und Felder ist rueckwaertskompatibel (bestehende `"variation"` und `"img2img"` bleiben). Constraint in Zeile 199 des Slice fordert explizit Rueckwaertskompatibilitaet. PASS.

2. **`parseSSEEvent` (canvas-chat-service.ts):** Intern aufgerufen in Z.206 derselben Datei. Erweiterung um neue Event-Felder ist additiv (neue Actions parsen, bestehende unberuehrt). Constraint in Zeile 199 fordert Rueckwaertskompatibilitaet. PASS.

3. **`handleCanvasGenerate` (canvas-chat-panel.tsx):** Nicht exportiert, nur intern aufgerufen in Z.418 derselben Datei. Kein externer Caller. Erweiterung um Action-Switch ist intern. PASS.

4. **`TOOLS` Array (canvas-toolbar.tsx):** Module-lokale `const`, nicht exportiert. Nur intern in Z.159, 177, 195 (Rendering-Slices) genutzt. Erweiterung um 4 Eintraege ist additiv. Die bestehenden `TOOLS.slice()` Aufrufe referenzieren feste Indizes -- die neuen Buttons muessen korrekt eingefuegt werden. AC-7 spezifiziert die 4 neuen Eintraege, aber die genaue Position im Array (nach bestehenden 6 Eintraegen) haengt von der `TOOLS.slice()` Aufteilung ab. Die Constraints-Section erwaehnt das Rendering-Pattern nicht explizit, aber die ACs pruefen nur Existenz + toggle:true, nicht Position. Dies ist ein minimales Implementierungsdetail, kein Compliance-Issue.

Alle Consumer-Patterns sind durch ACs oder Constraints abgedeckt.

---

## Blocking Issues

Keine.

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0
