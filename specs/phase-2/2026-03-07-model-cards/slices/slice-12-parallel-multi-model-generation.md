# Slice 12: Parallel Multi-Model Generation

> **Slice 12 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-parallel-multi-model-generation` |
| **Test** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-10-model-trigger-prompt-area"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`GenerateImagesInput` von `modelId: string` auf `modelIds: string[]` umstellen und `GenerationService.generate()` um einen Multi-Model-Branch erweitern. Single-Model (1 ID) verhaelt sich wie bisher (count Records, sequenziell). Multi-Model (2-3 IDs) erstellt je 1 Record pro Model mit Default-Params und verarbeitet alle parallel via `Promise.allSettled`, sodass ein Einzelfehler die anderen Generierungen nicht blockiert.

---

## Acceptance Criteria

1) GIVEN `generateImages` wird mit `modelIds: ["owner/model-a"]` und `count: 3` aufgerufen
   WHEN die Server Action ausgefuehrt wird
   THEN werden genau 3 `Generation`-Records erstellt (alle mit `model_id = "owner/model-a"`)
   AND die Verarbeitung erfolgt sequenziell (bestehende Logik unveraendert)

2) GIVEN `generateImages` wird mit `modelIds: ["owner/model-a", "owner/model-b"]` und `count: 1` aufgerufen
   WHEN die Server Action ausgefuehrt wird
   THEN werden genau 2 `Generation`-Records erstellt (je einer pro Model-ID)
   AND beide Predictions werden parallel via `Promise.allSettled` gestartet

3) GIVEN `generateImages` wird mit `modelIds: ["owner/m1", "owner/m2", "owner/m3"]` aufgerufen
   WHEN die Server Action ausgefuehrt wird
   THEN werden genau 3 `Generation`-Records erstellt
   AND alle 3 Predictions werden parallel via `Promise.allSettled` gestartet

4) GIVEN Multi-Model mit 2 Models: `owner/model-a` schlaegt fehl, `owner/model-b` wird erfolgreich
   WHEN `Promise.allSettled` die Ergebnisse zurueckgibt
   THEN wird der Record fuer `owner/model-a` als fehlgeschlagen markiert
   AND der Record fuer `owner/model-b` enthaelt das Ergebnis-Bild
   AND KEIN unbehandelter Error wird geworfen (Partial Failure ist erlaubt)

5) GIVEN `generateImages` wird mit `modelIds: []` (leeres Array) aufgerufen
   WHEN die Validierung in der Server Action ausgefuehrt wird
   THEN wird ein Validierungsfehler `{ error: "1-3 Modelle muessen ausgewaehlt sein" }` zurueckgegeben
   AND KEIN Generation-Record wird erstellt

6) GIVEN `generateImages` wird mit `modelIds: ["m1", "m2", "m3", "m4"]` (4 IDs) aufgerufen
   WHEN die Validierung in der Server Action ausgefuehrt wird
   THEN wird ein Validierungsfehler `{ error: "1-3 Modelle muessen ausgewaehlt sein" }` zurueckgegeben
   AND KEIN Generation-Record wird erstellt

7) GIVEN `generateImages` wird mit `modelIds: ["UPPER/Case"]` aufgerufen (ungueltige Format)
   WHEN die Validierung in der Server Action ausgefuehrt wird
   THEN wird ein Validierungsfehler zurueckgegeben (ID entspricht nicht `^[a-z0-9-]+/[a-z0-9._-]+$`)
   AND KEIN Generation-Record wird erstellt

8) GIVEN `generateImages` wird mit `modelIds: ["owner/model-a", "owner/model-b"]` aufgerufen
   WHEN die Multi-Model-Verarbeitung startet
   THEN wird jeder Generation-Record mit `params: {}` (leeres Objekt als Default-Params) erstellt
   AND `count` wird ignoriert (jedes Model erhaelt genau 1 Record)

9) GIVEN alle Aenderungen aus Slice 12
   WHEN `pnpm build` ausgefuehrt wird
   THEN kompiliert der Build fehlerfrei (kein TypeScript-Fehler durch Signaturwechsel)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/generation-service.test.ts`

<test_spec>
```typescript
// AC-1: Single-Model erzeugt N Records sequenziell (bestehende Logik)
it.todo('should create count records for single model and process sequentially')

// AC-2: Multi-Model (2 IDs) erzeugt 2 Records parallel
it.todo('should create one record per model and start predictions in parallel for two models')

// AC-3: Multi-Model (3 IDs) erzeugt 3 Records parallel
it.todo('should create one record per model and start predictions in parallel for three models')

// AC-4: Partial Failure - ein Model schlaegt fehl, anderes erfolgreich
it.todo('should mark failed model record as failed without affecting successful model record')

// AC-5: Leeres modelIds-Array wird abgelehnt
it.todo('should return validation error for empty modelIds array')

// AC-6: Mehr als 3 Model-IDs werden abgelehnt
it.todo('should return validation error when more than three model IDs are provided')

// AC-7: Ungueltige Model-ID-Format wird abgelehnt
it.todo('should return validation error for model ID not matching owner/name regex')

// AC-8: Multi-Model verwendet leere Default-Params und ignoriert count
it.todo('should use empty params object and create exactly one record per model in multi-model mode')

// AC-9: Build kompiliert fehlerfrei nach Signaturwechsel
it.todo('should compile without TypeScript errors after modelId to modelIds signature change')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-10-model-trigger-prompt-area` | `selectedModels: CollectionModel[]` in `prompt-area.tsx` | React State | Mapping `model => \`${model.owner}/${model.name}\`` liefert `modelIds: string[]` |
| `slice-04-remove-whitelist-services` | `GenerationService.generate()` ohne Whitelist | Refactored Function | Akzeptiert beliebige `owner/name`-IDs; Slice 04 hat `getModelById`-Check entfernt |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generateImages` (refactored) | Server Action | `prompt-area.tsx` (slice-10/11) | `generateImages(input: GenerateImagesInput): Promise<Generation[] \| { error: string }>` |
| `GenerateImagesInput` (refactored) | TypeScript Type | `prompt-area.tsx` | `{ projectId, promptMotiv, promptStyle?, negativePrompt?, modelIds: string[], params, count }` |
| `GenerationService.generate()` (refactored) | Service Function | `slice-13+` / intern | `generate(projectId, prompt*, modelIds: string[], params, count): Promise<Generation[]>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/generations.ts` — `GenerateImagesInput.modelId: string` zu `modelIds: string[]` aendern; Validierung: Array-Laenge 1-3, jede ID muss `^[a-z0-9-]+/[a-z0-9._-]+$` erfuellen; Fehlertext `"1-3 Modelle muessen ausgewaehlt sein"`; `GenerationService.generate()`-Aufruf anpassen
- [ ] `lib/services/generation-service.ts` — Multi-Model-Branch hinzufuegen: wenn `modelIds.length > 1`, erstelle 1 Record pro Model mit `params: {}`, verarbeite alle via `Promise.allSettled`; Single-Model-Pfad (`modelIds[0]`, count Records) bleibt unveraendert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an UI-Komponenten (Gallery, generation-card, prompt-area)
- KEINE Aenderungen an `model-schema-service.ts` (Whitelist bereits in Slice 04 entfernt)
- KEIN neues Caching oder Rate-Limit-Handling (Replicate 600 req/min limit gilt; max 3 parallele Calls sind sicher)
- KEINE Aenderungen an `lightbox-modal.tsx` oder `prompt-service.ts`

**Technische Constraints:**
- Validierungs-Regex pro Model-ID: `^[a-z0-9-]+/[a-z0-9._-]+$` (identisch zu architecture.md Section "Input Validation & Sanitization")
- Validierungsfehler-Text: `"1-3 Modelle muessen ausgewaehlt sein"` (bei Array-Laenge 0 oder > 3)
- Multi-Model Default-Params: `params: {}` (leeres Objekt) fuer jeden Record
- Parallel-Execution: `Promise.allSettled` (NICHT `Promise.all`) damit Partial Failure erlaubt ist
- Single-Model-Pfad (`modelIds.length === 1`): bestehende sequenzielle Logik mit `count` Records bleibt unveraendert
- Fehlerbehandlung pro Ergebnis: jedes `rejected`-Ergebnis aus `allSettled` markiert den zugehoerigen Record als fehlgeschlagen (bestehender Fehler-Handling-Mechanismus)

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Server Logic / Business Logic Flow" (Single vs. Multi-Model Fluss)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Input Validation & Sanitization" (Regex, Array-Laenge)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Data Transfer Objects" (`GenerateImagesInput` Felddefinition)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Error Handling Strategy" (Partial multi-model failure)
