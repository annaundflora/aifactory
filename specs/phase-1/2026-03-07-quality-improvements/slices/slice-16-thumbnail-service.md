# Slice 16: Thumbnail Service

> **Slice 16 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-thumbnail-service` |
| **Test** | `pnpm vitest run lib/services/__tests__/thumbnail-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-schema-projects"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/services/__tests__/thumbnail-service.test.ts` |
| **Integration Command** | `--` |
| **Acceptance Command** | `--` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Thumbnail-Service implementieren, der aus Projektnamen oder bestehenden Prompts ein repraesentatives Thumbnail generiert. Der Service orchestriert LLM-Prompt-Generierung (OpenRouter), Bild-Generierung (Replicate/Recraft V4), Resize (Sharp) und Upload (R2) mit statusbasiertem Tracking in der DB. Dazu die Server Action `generateThumbnail` und die DB-Query `updateProjectThumbnail` bereitstellen.

---

## Acceptance Criteria

1. GIVEN ein Projekt mit `thumbnail_status = 'none'`
   WHEN `generateForProject(projectId)` aufgerufen wird
   THEN wird `thumbnail_status` sofort auf `'pending'` gesetzt (DB-Update vor externer API)

2. GIVEN ein Projekt im Status `'pending'`
   WHEN der Thumbnail-Flow erfolgreich durchlaeuft
   THEN wird der OpenRouter-Client mit einem System-Prompt aufgerufen, der den Projektnamen enthaelt, und der Response als Bild-Prompt an Replicate (Recraft V4, 1024x1024) weitergegeben

3. GIVEN ein von Replicate generiertes Bild (1024x1024)
   WHEN das Bild verarbeitet wird
   THEN wird es via Sharp auf 512x512 PNG resized und nach R2 unter dem Pfad `thumbnails/{projectId}.png` hochgeladen

4. GIVEN ein erfolgreicher R2-Upload
   WHEN der Upload abgeschlossen ist
   THEN wird das Projekt in der DB aktualisiert: `thumbnail_url` = R2-URL, `thumbnail_status` = `'completed'`

5. GIVEN ein beliebiger Fehler waehrend des Thumbnail-Flows (LLM, Replicate, Sharp oder R2)
   WHEN der Fehler auftritt
   THEN wird `thumbnail_status` auf `'failed'` gesetzt und der Fehler geloggt, aber KEINE Exception nach aussen geworfen (fire-and-forget)

6. GIVEN ein Projekt mit mindestens 1 Generation
   WHEN `refreshForProject(projectId)` aufgerufen wird
   THEN werden die letzten 10 Prompts des Projekts aus der DB geladen und an den LLM-Client gesendet, um einen repraesentativen Thumbnail-Prompt zu generieren

7. GIVEN ein Projekt ohne Generationen
   WHEN `refreshForProject(projectId)` aufgerufen wird
   THEN wird auf `generateForProject` zurueckgefallen (Thumbnail basierend auf Projektname)

8. GIVEN die DB-Query `updateProjectThumbnail`
   WHEN sie mit `{ projectId, thumbnailUrl, thumbnailStatus }` aufgerufen wird
   THEN wird das Projekt aktualisiert und das aktualisierte `Project`-Objekt zurueckgegeben

9. GIVEN die Server Action `generateThumbnail`
   WHEN sie mit `{ projectId }` aufgerufen wird (valide UUID)
   THEN wird `refreshForProject` fire-and-forget gestartet, der Pfad `/` revalidiert und das Projekt zurueckgegeben

10. GIVEN die Server Action `generateThumbnail`
    WHEN sie mit einer unguelitgen oder leeren `projectId` aufgerufen wird
    THEN wird ein Objekt `{ error: string }` zurueckgegeben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/thumbnail-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Thumbnail Service', () => {
  // AC-1: Status auf pending setzen
  it.todo('should set thumbnail_status to pending before calling external APIs')

  // AC-2: LLM + Replicate Orchestrierung
  it.todo('should call OpenRouter with project name and pass result to Replicate Recraft V4 at 1024x1024')

  // AC-3: Sharp resize + R2 upload
  it.todo('should resize image to 512x512 PNG via Sharp and upload to R2 at thumbnails/{projectId}.png')

  // AC-4: DB-Update bei Erfolg
  it.todo('should update project with thumbnail_url and thumbnail_status completed on success')

  // AC-5: Fehlerbehandlung fire-and-forget
  it.todo('should set thumbnail_status to failed and not throw on any external API error')

  // AC-6: refreshForProject mit Prompt-Analyse
  it.todo('should load last 10 project prompts and send to LLM for representative thumbnail prompt')

  // AC-7: refreshForProject Fallback ohne Generationen
  it.todo('should fall back to generateForProject when project has no generations')

  // AC-8: updateProjectThumbnail Query
  it.todo('should update and return project with thumbnailUrl and thumbnailStatus')

  // AC-9: generateThumbnail Server Action happy path
  it.todo('should call refreshForProject fire-and-forget, revalidate path, and return project')

  // AC-10: generateThumbnail Server Action Validierung
  it.todo('should return error object for invalid or empty projectId')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-schema-projects` | `projects.thumbnailUrl`, `projects.thumbnailStatus` | Schema Columns | Spalten existieren im Drizzle-Schema |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generateForProject(projectId: string)` | Service Function | Project-Creation Slices | `(projectId: string) => Promise<void>` |
| `refreshForProject(projectId: string)` | Service Function | UI Slices (Thumbnail-Refresh Button) | `(projectId: string) => Promise<void>` |
| `updateProjectThumbnail(input)` | DB Query | Thumbnail Service intern | `(input: { projectId: string, thumbnailUrl: string \| null, thumbnailStatus: string }) => Promise<Project>` |
| `generateThumbnail(input)` | Server Action | UI Slices (Project Card) | `(input: { projectId: string }) => Promise<Project \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/thumbnail-service.ts` -- Neue Datei: `generateForProject`, `refreshForProject` mit LLM/Replicate/Sharp/R2-Orchestrierung
- [ ] `lib/db/queries.ts` -- Neue Query `updateProjectThumbnail` hinzufuegen
- [ ] `app/actions/projects.ts` -- Neue Server Action `generateThumbnail` hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN automatisches Thumbnail bei Projekterstellung (wird in einem separaten UI-Slice verdrahtet)
- KEINE UI-Komponenten (Project Card, Refresh Button)
- KEINE Migration (wird in Slice 21 erstellt)
- KEINE Aenderungen am Schema (`lib/db/schema.ts`)

**Technische Constraints:**
- OpenRouter-Client aus `lib/clients/openrouter.ts` verwenden (mit 15s Timeout fuer Thumbnail-Calls, siehe architecture.md External API Constraints)
- Replicate-Client aus bestehendem Pattern (`lib/clients/replicate.ts`) verwenden, Recraft V4 Modell-ID
- Sharp fuer PNG-Resize (bereits in dependencies)
- R2-Upload ueber bestehenden Storage-Client (`lib/clients/storage.ts` oder `@aws-sdk/client-s3`)
- Fire-and-forget Pattern: try/catch um den gesamten Flow, Fehler nur loggen + Status setzen
- Drizzle ORM fuer DB-Queries (bestehendes Pattern in `lib/db/queries.ts`)

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` --> Section "Thumbnail Generation Logic"
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` --> Section "External API Constraints" (Timeouts, Priority)
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` --> Section "Data Flow: Thumbnail Generation"
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` --> Flow 9: Projekt-Thumbnail
