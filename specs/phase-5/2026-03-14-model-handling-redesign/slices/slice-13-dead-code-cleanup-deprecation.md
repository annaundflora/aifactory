# Slice 13: Dead Code Cleanup + Deprecation

> **Slice 13 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-dead-code-cleanup-deprecation` |
| **Test** | `pnpm test app/actions/__tests__/models.test.ts lib/db/__tests__/queries.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-workspace-cleanup-remove-old-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/models.test.ts` |
| **Integration Command** | `pnpm test app/actions lib/db` |
| **Acceptance Command** | `pnpm lint && pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reiner Cleanup-Slice, nur Loeschungen und Kommentare) |

---

## Ziel

Verbleibenden toten Code aus dem alten Model-Handling-System entfernen: deprecated Server Actions, ungenutzte Query-Funktionen, die `UPSCALE_MODEL`-Konstante und zugehoerige Test-Dateien. Deprecated-Kommentare an den alten DB-Tabellen (`favorite_models`, `project_selected_models`) anbringen, damit klar ist, dass sie nicht mehr aktiv genutzt werden.

---

## Acceptance Criteria

1) GIVEN `app/actions/models.ts`
   WHEN nach den Funktionen `getFavoriteModels`, `toggleFavoriteModel`, `getProjectSelectedModels`, `saveProjectSelectedModels` gesucht wird
   THEN existiert KEINE dieser Funktionen mehr (weder als Export noch als interne Funktion)

2) GIVEN `lib/db/queries.ts`
   WHEN nach den Funktionen `getFavoriteModelIds`, `addFavoriteModel`, `removeFavoriteModel`, `getProjectSelectedModelIds`, `saveProjectSelectedModelIds` gesucht wird
   THEN existiert KEINE dieser Funktionen mehr

3) GIVEN `lib/db/schema.ts`
   WHEN die Tabellen-Definitionen `favoriteModels` und `projectSelectedModels` inspiziert werden
   THEN hat jede Definition einen JSDoc-Kommentar `@deprecated` mit Verweis auf `model_settings` als Ersatz

4) GIVEN `lib/models.ts`
   WHEN nach dem Export `UPSCALE_MODEL` gesucht wird
   THEN existiert dieser Export NICHT mehr (Konstante entfernt oder gesamte Datei geloescht, falls leer)

5) GIVEN das gesamte Projekt (ausgenommen `worktrees/`)
   WHEN `pnpm lint` ausgefuehrt wird
   THEN sind KEINE Lint-Fehler vorhanden (insbesondere keine ungenutzten Imports)

6) GIVEN das gesamte Projekt
   WHEN `pnpm build` ausgefuehrt wird
   THEN kompiliert das Projekt ohne Fehler

7) GIVEN das gesamte Projekt (ausgenommen `worktrees/` und `node_modules/`)
   WHEN nach Imports von `getFavoriteModels`, `toggleFavoriteModel`, `getProjectSelectedModels`, `saveProjectSelectedModels`, `getFavoriteModelIds`, `addFavoriteModel`, `removeFavoriteModel`, `getProjectSelectedModelIds`, `saveProjectSelectedModelIds` oder `UPSCALE_MODEL` gesucht wird
   THEN gibt es KEINE produktiven Imports mehr (Test-Dateien die diese referenzierten muessen ebenfalls bereinigt oder entfernt werden)

8) GIVEN die App laeuft (`pnpm dev`)
   WHEN Workspace geoeffnet und eine Generation (Draft/Quality) gestartet wird
   THEN funktioniert die App vollstaendig ohne die entfernten Funktionen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/models-cleanup.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Dead Code Cleanup - Server Actions', () => {
  // AC-1: Deprecated Server Actions entfernt
  it.todo('should not export getFavoriteModels from app/actions/models.ts')
  it.todo('should not export toggleFavoriteModel from app/actions/models.ts')
  it.todo('should not export getProjectSelectedModels from app/actions/models.ts')
  it.todo('should not export saveProjectSelectedModels from app/actions/models.ts')
})
```
</test_spec>

### Test-Datei: `lib/db/__tests__/queries-cleanup.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Dead Code Cleanup - Query Functions', () => {
  // AC-2: Deprecated Query-Funktionen entfernt
  it.todo('should not export getFavoriteModelIds from lib/db/queries.ts')
  it.todo('should not export addFavoriteModel from lib/db/queries.ts')
  it.todo('should not export removeFavoriteModel from lib/db/queries.ts')
  it.todo('should not export getProjectSelectedModelIds from lib/db/queries.ts')
  it.todo('should not export saveProjectSelectedModelIds from lib/db/queries.ts')
})
```
</test_spec>

### Test-Datei: `lib/db/__tests__/schema-deprecation.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Dead Code Cleanup - Schema Deprecation Comments', () => {
  // AC-3: Deprecation-Kommentare an alten Tabellen
  it.todo('should have @deprecated JSDoc comment on favoriteModels table definition')
  it.todo('should have @deprecated JSDoc comment on projectSelectedModels table definition')
})
```
</test_spec>

### Test-Datei: `lib/__tests__/models-cleanup.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Dead Code Cleanup - UPSCALE_MODEL Removal', () => {
  // AC-4: UPSCALE_MODEL Konstante entfernt
  it.todo('should not export UPSCALE_MODEL from lib/models.ts')
})
```
</test_spec>

### Test-Datei: `__tests__/dead-code-no-imports.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Dead Code Cleanup - No Stale Imports in Production Code', () => {
  // AC-7: Keine produktiven Imports entfernter Symbole
  it.todo('should have no imports of deprecated Server Actions in any production file')
  it.todo('should have no imports of deprecated query functions in any production file')
  it.todo('should have no imports of UPSCALE_MODEL in any production file')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `generation-service.ts` nutzt NICHT mehr `UPSCALE_MODEL` | Behaviour | `import { UPSCALE_MODEL }` existiert nicht mehr in `generation-service.ts` |
| `slice-06` | `prompt-area.tsx` importiert NICHT mehr `getFavoriteModels` etc. | Behaviour | Keine Imports deprecated Actions in Prompt-Area |
| `slice-12` | `CanvasModelSelector` und alte UI-Imports bereinigt | Clean Codebase | Kein aktiver Code referenziert deprecated Functions |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Bereinigte `app/actions/models.ts` | Clean Codebase | keiner (letzter Slice) | Nur noch produktive Actions verbleiben |
| Bereinigte `lib/db/queries.ts` | Clean Codebase | keiner | Nur noch produktive Queries verbleiben |
| Deprecierte Schema-Tabellen mit `@deprecated` Marker | Documentation | zukuenftige Migration | `favoriteModels`, `projectSelectedModels` markiert |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/models.ts` -- Bestehend: 4 deprecated Server Actions entfernen, ungenutzte Imports bereinigen
- [ ] `lib/db/queries.ts` -- Bestehend: 5 deprecated Query-Funktionen entfernen, ungenutzte Imports bereinigen
- [ ] `lib/db/schema.ts` -- Bestehend: `@deprecated` JSDoc-Kommentare an `favoriteModels` und `projectSelectedModels` Tabellen
- [ ] `lib/models.ts` -- Bestehend: `UPSCALE_MODEL` Konstante entfernen (Datei loeschen falls danach leer)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben. Bestehende Test-Dateien fuer entfernte Funktionen (z.B. `app/actions/__tests__/models.test.ts`, `lib/__tests__/models.test.ts`) muessen vom Implementer ebenfalls bereinigt werden.

---

## Constraints

**Scope-Grenzen:**
- KEINE Loeschung der DB-Tabellen `favorite_models` / `project_selected_models` (nur Deprecation-Kommentare)
- KEINE neuen Migrations -- Schema-Tabellen bleiben physisch erhalten
- KEINE Aenderung an `model_settings` Tabelle oder Service
- KEINE Aenderung an `generation-service.ts` (bereits in Slice 7 erledigt)
- KEINE Aenderung an UI-Komponenten (bereits in Slices 6-12 erledigt)
- KEINE Loeschung von Dateien unter `components/` (z.B. `canvas-model-selector.tsx`, `model-browser-drawer.tsx` -- separate Aufgabe)

**Technische Constraints:**
- `app/actions/models.ts` kann komplett geloescht werden, falls nach Entfernung der 4 Actions keine weiteren produktiven Exports verbleiben
- `lib/models.ts` kann komplett geloescht werden, falls `UPSCALE_MODEL` der einzige Export ist
- Alle bestehenden Tests die entfernte Funktionen testen, muessen bereinigt werden (Tests loeschen oder anpassen)
- Nach Cleanup: `pnpm lint` und `pnpm build` muessen fehlerfrei durchlaufen

**Referenzen:**
- Architecture: `architecture.md` -> Section "Server Actions (deprecated)" -- Liste der zu entfernenden Actions
- Architecture: `architecture.md` -> Section "Database Schema" -> `favorite_models` / `project_selected_models` als "Deprecated"
- Architecture: `architecture.md` -> Section "Migration Map" -> `lib/models.ts` ("Constant can remain for test backwards compat, but no production import")
