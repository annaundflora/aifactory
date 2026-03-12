# Slice 4: Upload Reference Server Action

> **Slice 4 von 9** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-upload-reference-action` |
| **Test** | `pnpm test app/actions/__tests__/references` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-reference-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest) |
| **Test Command** | `pnpm test app/actions/__tests__/references` |
| **Integration Command** | N/A (Action-Layer, Integration via UI in Slice 05+) |
| **Acceptance Command** | `pnpm test app/actions/__tests__/references` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (ReferenceService mocken, revalidatePath mocken, reine Unit-Tests) |

---

## Ziel

Zwei Server Actions `uploadReferenceImage` und `deleteReferenceImage` bereitstellen, die als duenne Adapter zwischen UI und ReferenceService fungieren. Die Actions validieren Input, delegieren an den Service, revalidieren den Path und geben typisierte Ergebnisse zurueck.

---

## Acceptance Criteria

1) GIVEN ein Aufruf von `uploadReferenceImage` mit `{ projectId: "<UUID>", file: <PNG-File> }`
   WHEN die Action ausgefuehrt wird
   THEN wird `ReferenceService.upload({ projectId, file })` aufgerufen und das Ergebnis `{ id: "<UUID>", imageUrl: "https://...", width: 1920, height: 1080 }` zurueckgegeben

2) GIVEN ein Aufruf von `uploadReferenceImage` mit `{ projectId: "<UUID>", url: "https://example.com/photo.jpg" }`
   WHEN die Action ausgefuehrt wird
   THEN wird `ReferenceService.upload({ projectId, url })` aufgerufen und das Ergebnis `{ id: "<UUID>", imageUrl: "https://...", width: 800, height: 600 }` zurueckgegeben

3) GIVEN ein Aufruf von `uploadReferenceImage` mit leerem `projectId` (leerer String oder undefined)
   WHEN die Action ausgefuehrt wird
   THEN wird `{ error: "Ungueltige Projekt-ID" }` zurueckgegeben OHNE den Service aufzurufen

4) GIVEN ein Aufruf von `uploadReferenceImage` ohne `file` und ohne `url`
   WHEN die Action ausgefuehrt wird
   THEN wird `{ error: "Datei oder URL erforderlich" }` zurueckgegeben OHNE den Service aufzurufen

5) GIVEN `ReferenceService.upload` wirft einen Fehler mit Message "Nur PNG, JPG, JPEG und WebP erlaubt"
   WHEN `uploadReferenceImage` ausgefuehrt wird
   THEN wird `{ error: "Nur PNG, JPG, JPEG und WebP erlaubt" }` zurueckgegeben (Error Message wird durchgereicht)

6) GIVEN ein erfolgreicher `uploadReferenceImage`-Aufruf
   WHEN die Action abgeschlossen ist
   THEN wurde `revalidatePath("/")` aufgerufen

7) GIVEN ein Aufruf von `deleteReferenceImage` mit `{ id: "<UUID>" }`
   WHEN die Action ausgefuehrt wird
   THEN wird `ReferenceService.delete(id)` aufgerufen, `revalidatePath("/")` ausgefuehrt und `{ success: true }` zurueckgegeben

8) GIVEN ein Aufruf von `deleteReferenceImage` mit leerem `id`
   WHEN die Action ausgefuehrt wird
   THEN wird `{ error: "Ungueltige Referenz-ID" }` zurueckgegeben OHNE den Service aufzurufen

9) GIVEN `ReferenceService.delete` wirft einen Fehler
   WHEN `deleteReferenceImage` ausgefuehrt wird
   THEN wird `{ success: false }` zurueckgegeben

10) GIVEN die Datei `app/actions/references.ts`
    WHEN sie inspiziert wird
    THEN beginnt sie mit `"use server"` Directive (Next.js Server Action Pflicht)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/references.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('uploadReferenceImage', () => {
  // AC-1: File-Upload delegiert an ReferenceService.upload und gibt Ergebnis zurueck
  it.todo('should call ReferenceService.upload with file and return { id, imageUrl, width, height }')

  // AC-2: URL-Upload delegiert an ReferenceService.upload und gibt Ergebnis zurueck
  it.todo('should call ReferenceService.upload with url and return { id, imageUrl, width, height }')

  // AC-3: Leere projectId wird abgelehnt
  it.todo('should return error for empty projectId without calling service')

  // AC-4: Weder file noch url angegeben
  it.todo('should return error when neither file nor url is provided')

  // AC-5: Service-Fehler wird als error-Objekt durchgereicht
  it.todo('should return error message from ReferenceService when upload fails')

  // AC-6: revalidatePath wird bei Erfolg aufgerufen
  it.todo('should call revalidatePath after successful upload')
})

describe('deleteReferenceImage', () => {
  // AC-7: Erfolgreicher Delete delegiert an Service, revalidiert, gibt success zurueck
  it.todo('should call ReferenceService.delete and return { success: true }')

  // AC-8: Leere id wird abgelehnt
  it.todo('should return error for empty id without calling service')

  // AC-9: Service-Fehler gibt { success: false } zurueck
  it.todo('should return { success: false } when ReferenceService.delete throws')
})

describe('Server Action directive', () => {
  // AC-10: "use server" Directive vorhanden
  it.todo('should export from a file with "use server" directive')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03-reference-service | `ReferenceService.upload` | Async Function | `(input: { projectId, file?, url? }) => Promise<{ id, imageUrl, width, height }>` |
| slice-03-reference-service | `ReferenceService.delete` | Async Function | `(id: string) => Promise<void>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `uploadReferenceImage` | Server Action | slice-05 (Reference Bar UI) | `(input: { projectId: string, file?: File, url?: string }) => Promise<{ id, imageUrl, width, height } \| { error: string }>` |
| `deleteReferenceImage` | Server Action | slice-05 (Reference Bar UI) | `(input: { id: string }) => Promise<{ success: true } \| { success: false } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/references.ts` — Neue Server Actions: `uploadReferenceImage()` und `deleteReferenceImage()` mit Input-Validierung, Service-Delegation und Path-Revalidierung
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Business-Logik (Validierung von MIME-Type, Groesse, R2-Upload) — das ist Slice 03 (ReferenceService)
- KEINE UI-Komponenten — das ist Slice 05 (Reference Bar)
- KEINE `getReferenceImages`-Action (wird erst bei Bedarf in spaeterem Slice ergaenzt)
- KEINE Aenderungen an bestehenden Action-Dateien (`generations.ts`, `projects.ts`)

**Technische Constraints:**
- `"use server"` Directive am Dateianfang (Next.js Server Action Pattern)
- `revalidatePath("/")` nach erfolgreichen Mutationen (bestehendes Pattern aus `app/actions/generations.ts`)
- Error-Handling: try/catch um Service-Aufrufe, Error-Message als `{ error: string }` durchreichen
- Input-Objekte (keine FormData) — konsistent mit bestehendem Action-Pattern in `app/actions/generations.ts`
- Import `ReferenceService` aus `lib/services/reference-service` (Slice 03 Deliverable)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` Section "Server Actions" (Zeile 73-77) + Section "Architecture Layers" (Zeile 264)
- Action-Pattern: `app/actions/generations.ts` — `"use server"`, Input-Interfaces, `{ error }` Returns, `revalidatePath("/")`
