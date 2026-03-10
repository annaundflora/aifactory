# Slice 3: Server Action getCollectionModels + Static Models entfernen

> **Slice 3 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-server-action-collection` |
| **Test** | `pnpm test app/actions/__tests__/models.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-collection-model-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/models.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Server Action `getCollectionModels()` in `app/actions/models.ts` hinzufuegen, die den `CollectionModelService` aus Slice 02 aufruft und `CollectionModel[]` oder `{ error: string }` zurueckgibt. Gleichzeitig die statische `MODELS`-Datei (`lib/models.ts`) und deren Tests (`lib/__tests__/models.test.ts`) loeschen. Den `getModelById`-Import aus `app/actions/models.ts` durch Format-Validierung per Regex ersetzen.

---

## Acceptance Criteria

1) GIVEN `app/actions/models.ts` existiert
   WHEN die Datei importiert wird
   THEN exportiert sie eine Server Action `getCollectionModels` neben der bestehenden `getModelSchema`

2) GIVEN der `CollectionModelService` Models erfolgreich liefert
   WHEN `getCollectionModels()` aufgerufen wird
   THEN gibt die Action ein Array von `CollectionModel[]` zurueck (Typ aus `lib/types/collection-model.ts`)

3) GIVEN der `CollectionModelService` einen Fehler liefert (`{ error: string }`)
   WHEN `getCollectionModels()` aufgerufen wird
   THEN gibt die Action `{ error: string }` zurueck

4) GIVEN `app/actions/models.ts` nach dem Refactoring
   WHEN die Datei inspiziert wird
   THEN existiert KEIN Import von `@/lib/models` (kein `getModelById`, kein `MODELS`)

5) GIVEN die Action `getModelSchema` nach dem Refactoring
   WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
   THEN wird das Model-ID-Format per Regex validiert (Pattern: `owner/name` mit mindestens einem `/`)
   AND der statische `getModelById()`-Whitelist-Check ist entfernt

6) GIVEN die Action `getModelSchema` nach dem Refactoring
   WHEN `getModelSchema({ modelId: "invalid-no-slash" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unbekanntes Modell" }` zurueck (Format-Validierung schlaegt fehl)

7) GIVEN die Datei `lib/models.ts`
   WHEN Slice 03 abgeschlossen ist
   THEN existiert die Datei NICHT mehr im Projekt (geloescht)

8) GIVEN die Datei `lib/__tests__/models.test.ts`
   WHEN Slice 03 abgeschlossen ist
   THEN existiert die Datei NICHT mehr im Projekt (geloescht)

9) GIVEN alle Aenderungen aus Slice 03
   WHEN `pnpm build` ausgefuehrt wird
   THEN kompiliert der Build fehlerfrei
   (Hinweis: Andere Dateien die `lib/models` importieren muessen ggf. temporaer angepasst werden -- siehe Constraints)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/models.test.ts`

<test_spec>
```typescript
// AC-1: getCollectionModels wird als Server Action exportiert
it.todo('should export getCollectionModels function')

// AC-2: Erfolgsfall — CollectionModel[] zurueckgeben
it.todo('should return CollectionModel[] when service succeeds')

// AC-3: Fehlerfall — { error: string } zurueckgeben
it.todo('should return error object when service fails')

// AC-4: Kein Import von lib/models
it.todo('should not import from lib/models')

// AC-5: getModelSchema akzeptiert beliebiges owner/name Format
it.todo('should accept any owner/name model ID format in getModelSchema')

// AC-6: getModelSchema lehnt ungueltige Model-IDs ab
it.todo('should reject model ID without slash in getModelSchema')

// AC-7: lib/models.ts existiert nicht mehr
it.todo('should have deleted lib/models.ts')

// AC-8: lib/__tests__/models.test.ts existiert nicht mehr
it.todo('should have deleted lib/__tests__/models.test.ts')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | `CollectionModelService.getCollectionModels()` | Async Function | Importierbar aus `@/lib/services/collection-model-service` |
| `slice-02` | `CollectionModel` | TypeScript Interface | Importierbar aus `@/lib/types/collection-model` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getCollectionModels` | Server Action | `slice-10` (Prompt Area) | `getCollectionModels(): Promise<CollectionModel[] \| { error: string }>` |
| `getModelSchema` (refactored) | Server Action | `slice-04` (besteht weiterhin, ohne Whitelist) | `getModelSchema(input: { modelId: string }): Promise<{ properties } \| { error }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/models.ts` -- Erweitern: `getCollectionModels` Action hinzufuegen, `getModelById`-Import entfernen, Model-ID-Validierung per Regex
- [ ] `lib/models.ts` -- LOESCHEN
- [ ] `lib/__tests__/models.test.ts` -- LOESCHEN
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen am `CollectionModelService` selbst (wurde in Slice 02 erstellt)
- KEINE Aenderungen an `generation-service.ts` oder `model-schema-service.ts` (kommt in Slice 04)
- KEINE Aenderungen an `lightbox-modal.tsx` oder `prompt-service.ts` (kommt in Slice 05)
- KEINE Aenderungen an `prompt-area.tsx` (kommt in Slice 10)
- KEINE UI-Komponenten

**Technische Constraints:**
- `"use server"` Direktive in `app/actions/models.ts` beibehalten
- Model-ID-Format-Validierung: String muss mindestens einen `/` enthalten (einfache Pruefung, reicht fuer diesen Slice; volle Regex kommt in Slice 04)
- Beim Loeschen von `lib/models.ts` muessen alle verbleibenden Imports in anderen Dateien bereinigt werden, damit `pnpm build` kompiliert. Fuer Dateien die in spaeteren Slices (04, 05, 10) ausfuehrlich refactored werden: minimaler Eingriff -- Import entfernen und Nutzung temporaer durch Inline-Ersatz ueberbruecken (z.B. `getModelById(id)?.displayName` -> `id` als Fallback). Die vollstaendige Logik-Ersetzung erfolgt in den jeweiligen Slices.
- Die bestehenden Dateien mit `lib/models`-Imports (Stand: 5 weitere Dateien) muessen compilieren. Es ist akzeptabel, den Import nur zu entfernen und die Nutzung minimal zu ersetzen, ohne die volle Business-Logik zu implementieren.

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Server Actions" (getCollectionModels Signatur)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Migration Map" (app/actions/models.ts, lib/models.ts Eintraege)
- Slice 02: `specs/phase-2/2026-03-07-model-cards/slices/slice-02-collection-model-service.md` -> Integration Contract (Provides)
