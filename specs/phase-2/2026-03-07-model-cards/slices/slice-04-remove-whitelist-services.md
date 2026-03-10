# Slice 4: Static Model Whitelist aus Schema-Service + Generation-Service entfernen

> **Slice 4 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-remove-whitelist-services` |
| **Test** | `pnpm test lib/services/__tests__/model-schema-service.test.ts lib/services/__tests__/generation-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-server-action-collection"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/model-schema-service.test.ts lib/services/__tests__/generation-service.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`getModelById()`-Whitelist-Check aus `model-schema-service.ts` und `generation-service.ts` entfernen. Model-IDs werden stattdessen per Regex-Format validiert (`^[a-z0-9-]+/[a-z0-9._-]+$`). Schema-Service erhaelt zusaetzlich einen Fetch-Timeout (5s via `AbortController`), um haengende Requests zu verhindern.

---

## Acceptance Criteria

1) GIVEN `model-schema-service.ts` nach dem Refactoring
   WHEN die Datei inspiziert wird
   THEN existiert KEIN Import von `@/lib/models` (kein `getModelById`)

2) GIVEN `generation-service.ts` nach dem Refactoring
   WHEN die Datei inspiziert wird
   THEN existiert KEIN Import von `@/lib/models` (kein `getModelById`)

3) GIVEN der ModelSchemaService nach dem Refactoring
   WHEN `getSchema("newowner/new-model-v2")` aufgerufen wird (bisher nicht in der Whitelist)
   THEN wird der Replicate-API-Call ausgefuehrt (kein Whitelist-Reject)
   AND das Schema-Ergebnis zurueckgegeben

4) GIVEN der ModelSchemaService nach dem Refactoring
   WHEN `getSchema("invalid-no-slash")` aufgerufen wird (kein `/` im String)
   THEN wird ein Error geworfen mit Message "Ungueltiges Model-ID-Format"
   AND KEIN HTTP-Request gesendet

5) GIVEN der ModelSchemaService nach dem Refactoring
   WHEN `getSchema("UPPER/Case")` aufgerufen wird (Grossbuchstaben)
   THEN wird ein Error geworfen mit Message "Ungueltiges Model-ID-Format"
   AND KEIN HTTP-Request gesendet

6) GIVEN der ModelSchemaService nach dem Refactoring
   WHEN `getSchema("valid-owner/model.v2_test-1")` aufgerufen wird (Punkte, Unterstriche, Bindestriche erlaubt)
   THEN wird der Replicate-API-Call ausgefuehrt (Format ist gueltig)

7) GIVEN die Replicate API antwortet nicht innerhalb von 5000ms
   WHEN `getSchema("owner/model")` aufgerufen wird
   THEN wird der Request via `AbortController` abgebrochen
   AND ein Error geworfen (keine haengende Verbindung)

8) GIVEN `generation-service.ts` nach dem Refactoring
   WHEN `generate()` mit `modelId: "newowner/new-model"` aufgerufen wird (bisher nicht in der Whitelist)
   THEN wird die Generation normal erstellt (kein Whitelist-Reject)

9) GIVEN `generation-service.ts` nach dem Refactoring
   WHEN `generate()` mit `modelId: "invalid"` aufgerufen wird (ohne `/`)
   THEN wird ein Error geworfen mit Message "Unbekanntes Modell"

10) GIVEN alle Aenderungen aus Slice 04
    WHEN `pnpm build` ausgefuehrt wird
    THEN kompiliert der Build fehlerfrei

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> **Hinweis:** Bestehende Tests in `model-schema-service.test.ts` muessen angepasst werden (der "unknown model" Test muss entfernt werden, da es keine Whitelist mehr gibt).

### Test-Datei: `lib/services/__tests__/model-schema-service.test.ts`

<test_spec>
```typescript
// AC-1: Kein Import von lib/models in model-schema-service.ts
it.todo('should not import from lib/models')

// AC-3: Beliebige owner/name Model-IDs akzeptieren
it.todo('should accept any valid owner/name model ID and fetch schema from API')

// AC-4: Ungueltige Model-ID ohne Slash ablehnen
it.todo('should throw "Ungueltiges Model-ID-Format" for model ID without slash')

// AC-5: Grossbuchstaben in Model-ID ablehnen
it.todo('should throw "Ungueltiges Model-ID-Format" for model ID with uppercase letters')

// AC-6: Punkte, Unterstriche, Bindestriche im Name-Teil akzeptieren
it.todo('should accept model ID with dots, underscores, and hyphens in name part')

// AC-7: Fetch-Timeout nach 5000ms
it.todo('should abort fetch after 5000ms timeout and throw error')
```
</test_spec>

### Test-Datei: `lib/services/__tests__/generation-service.test.ts`

<test_spec>
```typescript
// AC-2: Kein Import von lib/models in generation-service.ts
it.todo('should not import from lib/models')

// AC-8: Beliebige owner/name Model-IDs akzeptieren in generate()
it.todo('should accept any valid owner/name model ID and create generation without whitelist reject')

// AC-9: Ungueltige Model-ID ohne Slash ablehnen in generate()
it.todo('should throw "Unbekanntes Modell" for model ID without slash')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03` | `lib/models.ts` geloescht | Datei-Loesch. | Datei existiert nicht mehr; Import-Entfernung ist moeglich |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelSchemaService.getSchema()` (refactored) | Async Function | `app/actions/models.ts` (bestehend) | `getSchema(modelId: string): Promise<SchemaProperties>` -- akzeptiert beliebige `owner/name` IDs |
| `GenerationService.generate()` (refactored) | Async Function | `slice-12` (Multi-Model Generation) | `generate(projectId, promptMotiv, promptStyle, negativePrompt, modelId, params, count): Promise<Generation[]>` -- ohne Whitelist-Check |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/model-schema-service.ts` -- Whitelist-Import entfernen, Regex-Validierung (`^[a-z0-9-]+/[a-z0-9._-]+$`), AbortController Timeout (5s) fuer fetch
- [ ] `lib/services/generation-service.ts` -- `getModelById`-Import + Whitelist-Check entfernen, durch Regex-Format-Validierung ersetzen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `app/actions/models.ts` (wurde in Slice 03 refactored)
- KEINE Aenderungen an `lightbox-modal.tsx` oder `prompt-service.ts` (kommt in Slice 05)
- KEINE Aenderung der `generate()`-Funktionssignatur (Signatur-Aenderung `modelId` -> `modelIds` kommt in Slice 12)
- KEINE neuen Dateien ausser den genannten Deliverables

**Technische Constraints:**
- Model-ID-Regex: `^[a-z0-9-]+/[a-z0-9._-]+$` (aus architecture.md Section "Input Validation & Sanitization")
- AbortController-Timeout: 5000ms via `AbortController` + `setTimeout`, Signal an `fetch()` uebergeben
- Fehler-Message fuer ungueltige Format-Pruefung in `model-schema-service.ts`: "Ungueltiges Model-ID-Format"
- Fehler-Message fuer ungueltige Format-Pruefung in `generation-service.ts`: "Unbekanntes Modell" (bestehende Message beibehalten)
- Bestehender Test `should throw error for unknown model ID` in `model-schema-service.test.ts` muss entfernt oder durch den neuen Format-Validierungs-Test ersetzt werden (Whitelist existiert nicht mehr)
- Cache-Logik im Schema-Service bleibt unveraendert

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Input Validation & Sanitization" (Regex-Pattern)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Migration Map" (model-schema-service.ts, generation-service.ts Eintraege)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Quality Attributes" (API Timeout: 5000ms)
- Slice 03: `specs/phase-2/2026-03-07-model-cards/slices/slice-03-server-action-collection.md` -> Loeschung von `lib/models.ts`
