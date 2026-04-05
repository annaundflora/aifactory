# Gate 2: Compliance Report -- Slice 06a

**Gepruefter Slice:** `specs/phase-8/2026-04-03-image-editing-suite/slices/slice-06a-generation-service.md`
**Pruefdatum:** 2026-04-04

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | ID=`slice-06a-generation-service`, Test=`pnpm test lib/services/__tests__/generation-service-edit.test.ts`, E2E=`false`, Dependencies=`["slice-01-types-model-slots"]` |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden. Stack=`typescript-nextjs`, Mocking=`mock_external` |
| D-3: AC Format | PASS | 14 ACs, alle mit GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | 14 Tests (13 in `generation-service-edit.test.ts` + 1 in `generations-edit.test.ts`) vs 14 ACs. `it.todo(` Pattern korrekt. Zwei `<test_spec>` Bloecke vorhanden |
| D-5: Integration Contract | PASS | "Requires From" Tabelle (2 Eintraege von slice-01) + "Provides To" Tabelle (3 Eintraege) vorhanden |
| D-6: Deliverables Marker | PASS | `DELIVERABLES_START`/`END` Marker vorhanden. 2 Deliverables mit Dateipfaden |
| D-7: Constraints | PASS | 5 Scope-Grenzen + 8 technische Constraints + Reuse-Tabelle mit 3 Eintraegen |
| D-8: Groesse | PASS | 225 Zeilen (< 500). Test-Skeleton-Codeblock ist 42 Zeilen, aber dies ist erforderlicher Inhalt (kein Code-Example) |
| D-9: Anti-Bloat | PASS | Keine Code Examples Section, keine ASCII-Art, kein DB-Schema kopiert, keine grossen Type-Definitionen |
| D-10: Codebase Reference | PASS | `lib/services/generation-service.ts` existiert -- `generate()` Zeile 317, `buildReplicateInput()` Zeile 264. `app/actions/generations.ts` existiert -- `GenerateImagesInput` Zeile 22. `lib/types.ts` existiert -- `VALID_GENERATION_MODES` Zeile 26, `GenerationMode` Zeile 19 |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

### L-1: AC-Qualitaet

| AC | Testbarkeit | Spezifitaet | GIVEN | WHEN | THEN | Status |
|----|-------------|-------------|-------|------|------|--------|
| AC-1 | Ja | Konkreter Modus + konkrete Felder | Klar: `generationMode="inpaint"` | Eindeutig: `generate()` aufgerufen | Messbar: kein Error | PASS |
| AC-2 | Ja | Konkreter Modus + konkrete Felder | Klar | Eindeutig | Messbar | PASS |
| AC-3 | Ja | Konkreter Modus | Klar | Eindeutig | Messbar | PASS |
| AC-4 | Ja | Konkrete Werte: `outpaintDirections: ["top"]`, `outpaintSize: 50` | Klar | Eindeutig | Messbar | PASS |
| AC-5 | Ja | Exakter Error-Text | Klar: `maskUrl` fehlt | Eindeutig | Messbar: exakter String | PASS |
| AC-6 | Ja | Exakter Error-Text | Klar | Eindeutig | Messbar | PASS |
| AC-7 | Ja | Exakter Error-Text | Klar: `outpaintDirections` leer | Eindeutig | Messbar | PASS |
| AC-8 | Ja | Konkreter unguelter Wert `99` + exakter Error | Klar | Eindeutig | Messbar | PASS |
| AC-9 | Ja | Konkrete Keys `image`, `mask`, `prompt` | Klar | Eindeutig: `buildReplicateInput()` | Messbar: Key-Pruefung | PASS |
| AC-10 | Ja | Konkrete Keys + KEINEN Key `prompt` | Klar | Eindeutig | Messbar | PASS |
| AC-11 | Ja | Konkrete Keys `image_url`, `prompt` + KEINEN Key `mask` | Klar | Eindeutig | Messbar | PASS |
| AC-12 | Ja | Konkrete Keys | Klar | Eindeutig | Messbar | PASS |
| AC-13 | Ja | Exakter Error-Text + konkreter unguelter Wert | Klar | Eindeutig | Messbar | PASS |
| AC-14 | Ja | Konkrete URL + konkreter Modus | Klar | Eindeutig | Messbar: Durchreichen pruefbar | PASS |

**Status: PASS** -- Alle 14 ACs sind testbar, spezifisch, mit konkreten Werten und exakten Error-Strings.

### L-2: Architecture Alignment

| Pruefpunkt | Ergebnis |
|------------|----------|
| Validation Rules (architecture.md Zeile 202-212) | AC-5/6 prueft `maskUrl` Required fuer inpaint/erase -- stimmt mit "Maske ist erforderlich fuer Inpaint/Erase" ueberein. AC-7 prueft `outpaintDirections` Required -- stimmt mit "Mindestens eine Richtung erforderlich" ueberein. AC-8 prueft `outpaintSize` Werte -- stimmt mit `[25, 50, 100]` ueberein. AC-13 prueft ungueltige Modi -- stimmt mit "Ungueltiger Generierungsmodus" ueberein. |
| buildReplicateInput Mapping (architecture.md Zeile 148, 365-379) | AC-9: inpaint `image+mask+prompt` -- stimmt mit FLUX Fill Pro Input ueberein. AC-10: erase `image+mask` ohne prompt -- stimmt mit Bria Eraser ueberein. AC-11: instruction `image_url+prompt` -- stimmt mit FLUX Kontext Pro ueberein. AC-12: outpaint `image+mask+prompt` -- stimmt mit FLUX Fill Pro (reused) ueberein. |
| GenerateImagesInput Extension (architecture.md Zeile 93) | AC-14 prueft `maskUrl` Durchreichen -- stimmt mit `+ maskUrl?, outpaintDirections?, outpaintSize?` ueberein. |
| Services (architecture.md Zeile 144-148) | Slice modifiziert `GenerationService.generate()` und `buildReplicateInput()` -- exakt die in Architecture genannten Services. |

**Status: PASS** -- Alle Referenzen stimmen mit architecture.md ueberein. Error-Messages sind 1:1 identisch mit den Validation Rules.

### L-3: Integration Contract Konsistenz

| Pruefpunkt | Ergebnis |
|------------|----------|
| Requires: `GenerationMode` von slice-01 | slice-01 bietet `GenerationMode` als 7er-Union (AC-1 dort) -- Slice 06a importiert korrekt |
| Requires: `VALID_GENERATION_MODES` von slice-01 | slice-01 bietet `VALID_GENERATION_MODES` mit 7 Eintraegen (AC-2 dort) -- Slice 06a nutzt fuer Validation |
| Provides: `GenerationService.generate()` (extended) | Signatur mit `maskUrl?, outpaintDirections?, outpaintSize?` -- konsistent mit ACs 1-8, 13-14 |
| Provides: `GenerateImagesInput` (extended) | Neue Felder `maskUrl?, outpaintDirections?, outpaintSize?` -- konsistent mit AC-14 |
| Provides: `buildReplicateInput()` (extended) | Neue Branches fuer 4 Modi -- konsistent mit ACs 9-12 |
| Consumer slice-07 (Canvas Chat Panel) | Wird `generate()` mit erweiterten Parametern nutzen -- Interface passt |
| Consumer slice-08 (Erase Flow) | Wird `generate()` mit `mode="erase"` + `maskUrl` nutzen -- Interface passt |

**Status: PASS** -- Alle Contract-Eintraege sind konsistent mit Source-Slice (01) und den geplanten Consumer-Slices.

### L-4: Deliverable-Coverage

| Deliverable | Abgedeckt durch ACs | Status |
|-------------|---------------------|--------|
| `lib/services/generation-service.ts` -- Validation | AC-1 bis AC-8, AC-13 (Validation-Tests) | PASS |
| `lib/services/generation-service.ts` -- buildReplicateInput Branches | AC-9 bis AC-12 (Input-Shape-Tests) | PASS |
| `app/actions/generations.ts` -- GenerateImagesInput + Durchreichen | AC-14 (maskUrl Passthrough) | PASS |

Verwaiste Deliverables: Keine. Test-Deliverables: 2 Test-Dateien in Test Skeletons definiert.

**Status: PASS** -- Jedes AC referenziert mindestens ein Deliverable. Kein Deliverable ist verwaist.

### L-5: Discovery Compliance

| Discovery Business Rule | Abdeckung im Slice | Status |
|-------------------------|--------------------:|--------|
| Modell-Routing: Maske + Prompt -> Inpaint (discovery Zeile 291) | AC-1, AC-9: inpaint mit sourceImageUrl + maskUrl + prompt | PASS |
| Modell-Routing: Maske + kein Prompt -> Erase (discovery Zeile 292) | AC-2, AC-10: erase mit sourceImageUrl + maskUrl, ohne prompt | PASS |
| Modell-Routing: Keine Maske + Edit-Intent -> Instruction (discovery Zeile 293) | AC-3, AC-11: instruction mit sourceImageUrl + prompt | PASS |
| Modell-Routing: Outpaint-Kontext (discovery Zeile 295) | AC-4, AC-12: outpaint mit Richtungen + Groesse | PASS |
| maskUrl Required fuer Inpaint/Erase (discovery Zeile 314, 318) | AC-5, AC-6: Error bei fehlendem maskUrl | PASS |
| outpaintDirections Validation (discovery Zeile 319) | AC-7: Error bei leeren Directions | PASS |
| outpaintSize Validation -- 25/50/100 (discovery Zeile 299, 320) | AC-8: Error bei ungueltigem Wert `99` | PASS |
| Erase: kein Prompt an API (discovery Zeile 127-128) | AC-10: erase buildReplicateInput ohne `prompt` Key | PASS |

**Status: PASS** -- Alle relevanten Business Rules aus der Discovery sind in ACs reflektiert. Die Slice-Scope-Grenzen (keine UI, kein Canvas Agent, kein SSE) sind klar definiert und korrekt: dieser Slice behandelt nur den Service-Layer.

### L-6: Consumer Coverage

Beide Deliverables modifizieren bestehende Dateien. Analyse der Aufrufer:

**1. `GenerationService.generate()` Aufrufer:**
- `app/actions/generations.ts` Zeile 141: Ruft `GenerationService.generate()` auf und reicht Parameter durch. AC-14 deckt das Durchreichen von `maskUrl` ab. Die Signatur-Erweiterung ist additiv (neue optionale Parameter) -- bestehende Aufrufe bleiben kompatibel.

**2. `buildReplicateInput()` Aufrufer:**
- Intern in `generation-service.ts` Zeile 216: Aufgerufen von `processGeneration()`. Slice aendert `processGeneration()` NICHT (explizit in Constraints). Die Erweiterung von `buildReplicateInput()` fuegt neue mode-Branches hinzu -- bestehende Branches bleiben unveraendert.

**3. `GenerateImagesInput` Aufrufer:**
- `app/actions/generations.ts` Zeile 22/69: Interface-Definition + Nutzung in `generateImages()`. Neue Felder sind optional (`?`) -- bestehende Aufrufer unberuhrt.

**Status: PASS** -- Alle Aenderungen sind additiv (neue optionale Parameter, neue Switch-Branches). Kein bestehender Consumer wird gebrochen.

---

## Blocking Issues

Keine.

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0
