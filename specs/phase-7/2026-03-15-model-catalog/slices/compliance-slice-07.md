# Gate 2: Compliance Report -- Slice 07

**Geprüfter Slice:** `specs/phase-7/2026-03-15-model-catalog/slices/slice-07-service-replace.md`
**Prüfdatum:** 2026-03-18

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | Alle 4 Felder vorhanden: ID=`slice-07-service-replace`, Test=command, E2E=false, Dependencies=`["slice-03-catalog-service"]` |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden: Stack, Test Command, Integration Command, Acceptance Command, Start Command, Health Endpoint, Mocking Strategy |
| D-3: AC Format | PASS | 12 ACs, alle mit GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | 12 Tests (4 generation-service + 8 model-settings-service) vs 12 ACs. Zwei `<test_spec>` Bloecke mit `it.todo(` Pattern |
| D-5: Integration Contract | PASS | "Requires From" Tabelle mit 3 Eintraegen, "Provides To" Tabelle mit 2 Eintraegen |
| D-6: Deliverables Marker | PASS | DELIVERABLES_START/END Marker vorhanden, 2 Deliverables mit Dateipfaden |
| D-7: Constraints | PASS | Scope-Grenzen (6 Punkte), Technische Constraints (5 Punkte), Reuse-Tabelle (5 Eintraege), Referenzen (3 Eintraege) |
| D-8: Groesse | PASS | 213 Zeilen, weit unter 400 Warnschwelle. Keine Code-Bloecke >20 Zeilen (groesster Block: 16 Zeilen in Test Skeleton 2) |
| D-9: Anti-Bloat | PASS | Keine "Code Examples" Section, keine ASCII-Art, kein DB-Schema kopiert, keine vollstaendigen Type-Definitionen |
| D-10: Codebase Reference | PASS | Beide MODIFY-Dateien existieren: `generation-service.ts` (bestaetigt: `buildReplicateInput()` Zeile 263, `ModelSchemaService.getSchema()` Zeile 282, `getImg2ImgFieldName` Import Zeile 11), `model-settings-service.ts` (bestaetigt: `checkCompatibility()` Zeile 70, `ModelSchemaService.supportsImg2Img()` Zeile 77). Integration Contract Requires: `ModelCatalogService` + `getModelByReplicateId` aus slice-03 (noch nicht implementiert, SKIP da vorheriger Slice), `getImg2ImgFieldName` aus slice-02 (noch nicht implementiert, SKIP da vorheriger Slice) |

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

Alle 12 ACs sind testbar und spezifisch:
- **Testbarkeit:** Jedes AC beschreibt eine konkrete Aktion und ein messbares Ergebnis (Mock-Calls, Return-Werte, Import-Pruefung)
- **Spezifitaet:** Konkrete Methoden (`ModelCatalogService.getSchema`, `getModelByReplicateId`), konkrete Return-Werte (`true`/`false`), konkrete Capability-Keys (`img2img`, `inpaint`, `outpaint`, `upscale`, `txt2img`)
- **GIVEN:** Vorbedingungen praezise (DB-Inhalte, Import-Zustaende, Schema-Strukturen)
- **WHEN:** Eindeutige Aktionen (ein Methodenaufruf pro AC)
- **THEN:** Maschinell pruefbar (Boolean-Returns, Mock-Assertions, Import-Checks)

AC-2 und AC-5 pruefen Import-Abwesenheit, was ueber statische Analyse oder String-Matching testbar ist.

### L-2: Architecture Alignment

- Migration Map in architecture.md (Zeile 312-313) beschreibt exakt die Aenderungen fuer `generation-service.ts` (Import + Call aendern) und `model-settings-service.ts` (Import + checkCompatibility umschreiben) -- Slice folgt dem
- Server Logic Section (Zeile 166): `ModelSettingsService (EXTENDED)` liest `capabilities` aus DB -- AC-6 bis AC-12 decken dies ab
- Database Schema (Zeile 128): `capabilities` JSONB mit 5 Boolean-Feldern -- ACs pruefen alle 5 Capabilities
- Capability Detection Rules (Zeile 190-197): Slice referenziert korrekt die 5 Modes
- `checkCompatibility` soll laut architecture.md alle 5 Capabilities via DB pruefen -- ACs 6-12 decken txt2img, img2img, inpaint, outpaint, upscale vollstaendig ab
- Fallback bei DB-Miss: architecture.md Error Handling sagt "allow selection" -- AC-11 deckt Fallback `true` ab

### L-3: Contract Konsistenz

**Requires From:**
- `slice-03-catalog-service` liefert `ModelCatalogService` mit `getSchema(replicateId)` -- Slice 03 "Provides To" bestaetigt dies (Zeile 153: `getSchema` Methode)
- `slice-03-catalog-service` liefert `getModelByReplicateId` -- Slice 03 "Provides To" bestaetigt dies (Zeile 151)
- `slice-02-capability-detection` liefert `getImg2ImgFieldName` -- Slice 02 "Provides To" bestaetigt dies (Zeile 176)
- Interface-Signaturen sind kompatibel: `getSchema(replicateId)` gibt `SchemaProperties | null` zurueck, `getImg2ImgFieldName(schema)` gibt `{ field, isArray } | undefined` zurueck

**Provides To:**
- `buildReplicateInput` mit unveraenderter Signatur -- intern genutzt von `GenerationService.generate` und `GenerationService.retry`, kein externer Consumer ausserhalb der Datei
- `checkCompatibility` mit erweiterter Capability-Pruefung -- genutzt intern von `ModelSettingsService.update` und potentiell von Server Actions (Slice 06 referenziert `ModelCatalogService`, nicht direkt `checkCompatibility`)

### L-4: Deliverable-Coverage

- **AC-1 bis AC-4:** Referenzieren `generation-service.ts` (Deliverable 1) -- Import-Aenderung + `buildReplicateInput()` Umstellung
- **AC-5 bis AC-12:** Referenzieren `model-settings-service.ts` (Deliverable 2) -- Import-Aenderung + `checkCompatibility()` Umschreibung
- Kein Deliverable ist verwaist: Beide werden von ACs abgedeckt
- Test-Deliverable: Nicht in Deliverables (korrekt per Slice-Konvention, Test-Writer erstellt Tests)

### L-5: Discovery Compliance

- Discovery (Zeile 72): `Generation Service (generation-service.ts): buildReplicateInput() merged modelParams + prompt (bleibt, liest kuenftig Schema aus DB)` -- Slice 07 setzt genau dies um
- Discovery Business Rules (Zeile 193-206): Capability-Detection und Dropdown-Filterung -- `checkCompatibility` wird auf alle 5 Modes erweitert, konsistent mit Discovery
- Discovery Scope (Zeile 42): "Ersetzung von CollectionModelService und ModelSchemaService" -- Slice 07 ersetzt ModelSchemaService-Nutzung in den Consumer-Services
- Kein wesentlicher User-Flow-Schritt fehlt: Slice fokussiert auf Service-interne Datenquellen-Umstellung, keine UI-Flows betroffen

### L-6: Consumer Coverage

**MODIFY `generation-service.ts` -- `buildReplicateInput()`:**
- Aufrufer: `processGeneration()` (Zeile 215) -- intern in derselben Datei
- Call-Pattern: Rueckgabe wird als `Record<string, unknown>` an `ReplicateClient.run()` uebergeben
- AC-3 und AC-4 decken das identische Output-Format ab (gleiche Feld-Keys, gleiche Werte)
- Keine externen Aufrufer ausserhalb `generation-service.ts`

**MODIFY `model-settings-service.ts` -- `checkCompatibility()`:**
- Interner Aufrufer: `ModelSettingsService.update()` (Zeile 46) -- ruft `checkCompatibility(modelId, mode)` und prueft Boolean-Return
- Externer Aufrufer: `app/actions/model-settings.ts` (Zeile 79) -- delegiert an `ModelSettingsService.update()`, nicht direkt an `checkCompatibility`
- Call-Pattern: `await checkCompatibility(modelId, mode)` -> `boolean` -> if `!compatible` -> return error
- ACs 6-12 decken alle 5 Modes + Fallback ab. Das Boolean-Return-Pattern aendert sich nicht
- Signatur bleibt identisch: `(modelId: string, mode: string) => Promise<boolean>`

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0
