# Slice 12: Cleanup (Legacy Services & Types entfernen)

> **Slice 12 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-cleanup` |
| **Test** | `pnpm vitest run` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-server-actions", "slice-07-service-replace", "slice-10-dropdown-filter", "slice-11-auto-sync"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run` |
| **Integration Command** | `npx tsc --noEmit` |
| **Acceptance Command** | `npx tsc --noEmit && pnpm vitest run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (Validierung ueber Compiler + Test-Suite-Durchlauf) |

---

## Ziel

Die drei abgeloesten Legacy-Dateien (`collection-model-service.ts`, `model-schema-service.ts`, `collection-model.ts`) und alle verbleibenden Imports darauf aus der Codebase entfernen. Consumer-Komponenten, die noch den `CollectionModel`-Typ verwenden, auf den Drizzle-inferierten `Model`-Typ umstellen. Nach diesem Slice darf kein Import auf die drei Dateien mehr existieren.

---

## Acceptance Criteria

1) GIVEN die Datei `lib/services/collection-model-service.ts` existiert
   WHEN Slice 12 abgeschlossen ist
   THEN ist die Datei geloescht und `ls lib/services/collection-model-service.ts` gibt "No such file" zurueck

2) GIVEN die Datei `lib/services/model-schema-service.ts` existiert
   WHEN Slice 12 abgeschlossen ist
   THEN ist die Datei geloescht und `ls lib/services/model-schema-service.ts` gibt "No such file" zurueck

3) GIVEN die Datei `lib/types/collection-model.ts` existiert
   WHEN Slice 12 abgeschlossen ist
   THEN ist die Datei geloescht und `ls lib/types/collection-model.ts` gibt "No such file" zurueck

4) GIVEN die gesamte Codebase (alle `*.ts` und `*.tsx` Dateien)
   WHEN `grep -r "collection-model-service" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   THEN gibt es 0 Treffer (keine Imports, keine Mocks, keine Referenzen)

5) GIVEN die gesamte Codebase (alle `*.ts` und `*.tsx` Dateien)
   WHEN `grep -r "model-schema-service" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   THEN gibt es 0 Treffer

6) GIVEN die gesamte Codebase (alle `*.ts` und `*.tsx` Dateien)
   WHEN `grep -r "from.*collection-model" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   THEN gibt es 0 Treffer (kein Import des `CollectionModel`-Typs mehr)

7) GIVEN `components/models/model-card.tsx` verwendet den `CollectionModel`-Typ in Props
   WHEN der Import auf den Drizzle-inferierten `Model`-Typ umgestellt wird
   THEN kompiliert die Datei fehlerfrei und die Props verwenden `Model` (aus `typeof models.$inferSelect`) statt `CollectionModel`

8) GIVEN `components/models/model-browser-drawer.tsx`, `components/models/model-trigger.tsx`, `components/canvas/canvas-model-selector.tsx` und `lib/hooks/use-model-filters.ts` verwenden den `CollectionModel`-Typ
   WHEN alle Imports auf den `Model`-Typ umgestellt werden
   THEN kompilieren alle Dateien fehlerfrei mit `npx tsc --noEmit`

9) GIVEN `components/canvas/canvas-model-selector.tsx` importiert `getCollectionModels` und `checkImg2ImgSupport` aus `app/actions/models`
   WHEN diese Imports auf die neuen Server Actions umgestellt werden
   THEN verwendet die Datei `getModels` statt `getCollectionModels` (aus Slice 06) und die Funktionalitaet bleibt erhalten

10) GIVEN alle bestehenden Test-Dateien die Legacy-Mocks oder Imports der drei entfernten Dateien enthalten
    WHEN die Tests auf die neuen Services/Types umgestellt oder entfernt werden
    THEN laeuft `pnpm vitest run` ohne Fehler durch

11) GIVEN `npx tsc --noEmit` wird nach allen Aenderungen ausgefuehrt
    WHEN der TypeScript-Compiler die gesamte Codebase prueft
    THEN gibt es 0 Fehler (keine broken Imports, keine fehlenden Types)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Dieser Slice ist primaer ein Deletion/Migration-Slice. Die Tests validieren Abwesenheit von Legacy-Code und Funktionalitaet der umgestellten Consumer.

### Test-Datei: `__tests__/slice-12/cleanup-verification.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Legacy file removal verification', () => {
  // AC-1: collection-model-service.ts geloescht
  it.todo('should have deleted lib/services/collection-model-service.ts')

  // AC-2: model-schema-service.ts geloescht
  it.todo('should have deleted lib/services/model-schema-service.ts')

  // AC-3: collection-model.ts geloescht
  it.todo('should have deleted lib/types/collection-model.ts')

  // AC-4: Keine Referenzen auf collection-model-service
  it.todo('should have zero references to collection-model-service in codebase')

  // AC-5: Keine Referenzen auf model-schema-service
  it.todo('should have zero references to model-schema-service in codebase')

  // AC-6: Keine Imports von collection-model Type
  it.todo('should have zero imports from collection-model type file in codebase')
})

describe('Consumer migration to Model type', () => {
  // AC-7: model-card.tsx verwendet Model-Typ
  it.todo('should use Drizzle-inferred Model type in model-card props')

  // AC-8: Alle Consumer kompilieren fehlerfrei
  it.todo('should compile all migrated consumer files without errors')

  // AC-9: canvas-model-selector verwendet getModels
  it.todo('should use getModels instead of getCollectionModels in canvas-model-selector')
})
```
</test_spec>

> **Hinweis:** AC-10 (Test-Suite gruen) und AC-11 (tsc --noEmit) werden via Acceptance Command validiert, nicht ueber eigene Tests.

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema` | `models` Drizzle Table + `typeof models.$inferSelect` | Exportierter Typ | Ersetzt `CollectionModel` Interface in allen Consumern |
| `slice-06-server-actions` | `getModels({ capability })` | Server Action | Ersetzt `getCollectionModels()` in `canvas-model-selector.tsx` |
| `slice-07-service-replace` | `generation-service.ts` + `model-settings-service.ts` bereits auf neue Services umgestellt | MODIFY-Ergebnis | Keine Legacy-Imports in diesen Dateien mehr vorhanden |
| `slice-10-dropdown-filter` | `settings-dialog.tsx` + `model-mode-section.tsx` bereits umgestellt | MODIFY-Ergebnis | Keine `CollectionModel`-Imports in diesen Dateien mehr vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Saubere Codebase ohne Legacy-Services | Datei-Loeschung | (Endprodukt — kein Consumer) | Keine Legacy-Imports, tsc + vitest gruen |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/collection-model-service.ts` -- DELETE: Datei vollstaendig entfernen
- [ ] `lib/services/model-schema-service.ts` -- DELETE: Datei vollstaendig entfernen
- [ ] `lib/types/collection-model.ts` -- DELETE: Datei vollstaendig entfernen
- [ ] `components/models/model-card.tsx` -- MODIFY: Import von `CollectionModel` auf `Model`-Typ umstellen (aus `lib/db/schema` inferiert)
- [ ] `components/models/model-trigger.tsx` -- MODIFY: Import von `CollectionModel` auf `Model`-Typ umstellen
- [ ] `components/models/model-browser-drawer.tsx` -- MODIFY: Import von `CollectionModel` auf `Model`-Typ umstellen
- [ ] `components/canvas/canvas-model-selector.tsx` -- MODIFY: Import von `CollectionModel` auf `Model`-Typ umstellen. Import von `getCollectionModels`/`checkImg2ImgSupport` auf `getModels` umstellen
- [ ] `lib/hooks/use-model-filters.ts` -- MODIFY: Import von `CollectionModel` auf `Model`-Typ umstellen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien die Legacy-Mocks enthalten (`__tests__/slice-09/*.test.ts`, `lib/services/__tests__/collection-model-service.test.ts`, `lib/services/__tests__/model-schema-service.test.ts`, `app/actions/__tests__/models.test.ts`, etc.) muessen ebenfalls aktualisiert oder entfernt werden. Der Test-Writer-Agent handhabt die Test-Migration.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen Features oder Funktionalitaet
- KEINE Aenderungen an Services die bereits in Slice 06/07/10/11 umgestellt wurden (`generation-service.ts`, `model-settings-service.ts`, `settings-dialog.tsx`, `model-mode-section.tsx`, `app/actions/models.ts`)
- KEINE Aenderungen an der DB (`schema.ts`, `queries.ts`, Migrations)
- KEINE Aenderungen an den neuen Services (`model-catalog-service.ts`, `model-sync-service.ts`, `capability-detection.ts`)

**Technische Constraints:**
- Der `Model`-Typ (`typeof models.$inferSelect`) hat andere Felder als `CollectionModel` (15 Felder vs. 7 Felder, z.B. `replicate_id` statt `url`, `capabilities` JSONB, `input_schema` JSONB). Consumer muessen ggf. Feld-Zugriffe anpassen
- `canvas-model-selector.tsx` ruft aktuell `getCollectionModels()` und `checkImg2ImgSupport()` auf — beides existiert nach Slice 06 nicht mehr. Muss auf `getModels()` umgestellt werden
- Bestehende Test-Dateien mit `vi.mock("@/lib/services/collection-model-service")` oder `vi.mock("@/lib/services/model-schema-service")` muessen angepasst werden, damit `pnpm vitest run` durchlaeuft
- `model-browser-drawer.tsx` ist mit `@deprecated` markiert — trotzdem muessen Imports aktualisiert werden, damit tsc nicht fehlschlaegt

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/schema.ts` | Import — `typeof models.$inferSelect` als Ersatz-Typ fuer `CollectionModel` |
| `app/actions/models.ts` | Import — `getModels()` als Ersatz fuer `getCollectionModels()` in `canvas-model-selector.tsx` |

**Referenzen:**
- Architecture: `architecture.md` --> Section "Migration Map" --> Zeilen fuer `collection-model-service.ts` (REMOVE), `model-schema-service.ts` (Split), `collection-model.ts` (REMOVE)
- Architecture: `architecture.md` --> Section "Database Schema" --> `models` Table fuer den inferierten `Model`-Typ
- Architecture: `architecture.md` --> Section "Codebase Patterns" --> "CollectionModel type → AVOID" und "In-memory Map cache → AVOID"
