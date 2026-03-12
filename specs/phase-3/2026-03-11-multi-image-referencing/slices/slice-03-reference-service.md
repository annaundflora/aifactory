# Slice 3: Reference Service (Upload + Delete) implementieren

> **Slice 3 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-reference-service` |
| **Test** | `pnpm test lib/services/__tests__/reference-service` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-reference-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest) |
| **Test Command** | `pnpm test lib/services/__tests__/reference-service` |
| **Integration Command** | N/A (Service-Layer, Integration via Server Actions in Slice 04) |
| **Acceptance Command** | `pnpm test lib/services/__tests__/reference-service` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (R2 Storage-Client + DB-Queries + Sharp mocken, reine Unit-Tests) |

---

## Ziel

Einen `ReferenceService` bereitstellen, der Referenz-Bilder per File-Upload oder URL in R2 speichert, DB-Eintraege erstellt, Bilder loescht und pro Projekt abruft. Dieser Service kapselt die gesamte Business-Logik (Validierung, R2-Key-Generierung, Dimensionsextraktion) und wird von Server Actions in Slice 04 aufgerufen.

---

## Acceptance Criteria

1) GIVEN eine gueltige PNG-Datei (MIME `image/png`, 2MB, 1920x1080)
   WHEN `ReferenceService.upload({ projectId: "<UUID>", file: <File> })` aufgerufen wird
   THEN wird die Datei unter dem R2-Key `references/<projectId>/<uuid>.png` hochgeladen, ein DB-Eintrag via `createReferenceImage` erstellt mit `sourceType: "upload"`, `width: 1920`, `height: 1080`, und das zurueckgegebene Objekt enthaelt `{ id, imageUrl, width, height }`

2) GIVEN eine gueltige URL zu einem JPEG-Bild (MIME `image/jpeg`, 5MB, 800x600)
   WHEN `ReferenceService.upload({ projectId: "<UUID>", url: "https://example.com/photo.jpg" })` aufgerufen wird
   THEN wird das Bild per Server-Side Fetch heruntergeladen, unter `references/<projectId>/<uuid>.jpg` in R2 gespeichert, und ein DB-Eintrag mit `width: 800`, `height: 600`, `sourceType: "upload"` erstellt

3) GIVEN eine Datei mit MIME-Type `image/gif`
   WHEN `ReferenceService.upload()` aufgerufen wird
   THEN wird ein Fehler geworfen mit Message "Nur PNG, JPG, JPEG und WebP erlaubt"

4) GIVEN eine Datei mit 15MB Groesse (ueber dem 10MB-Limit)
   WHEN `ReferenceService.upload()` aufgerufen wird
   THEN wird ein Fehler geworfen mit Message "Datei darf maximal 10MB gross sein"

5) GIVEN ein existierender Reference-Image-Eintrag mit bekannter `id` und `imageUrl` die auf einen R2-Key unter `references/` zeigt
   WHEN `ReferenceService.delete(id)` aufgerufen wird
   THEN wird der R2-Key aus der `imageUrl` extrahiert, `StorageService.delete(key)` aufgerufen, und `deleteReferenceImage(id)` ausgefuehrt — beides erfolgreich

6) GIVEN 3 Reference-Image-Eintraege fuer `projectId = "proj-A"`
   WHEN `ReferenceService.getByProject("proj-A")` aufgerufen wird
   THEN wird `getReferenceImagesByProject("proj-A")` aufgerufen und die 3 Eintraege zurueckgegeben

7) GIVEN eine gueltige WebP-Datei
   WHEN `ReferenceService.upload()` aufgerufen wird
   THEN wird `sharp(buffer).metadata()` aufgerufen um `width` und `height` zu extrahieren, und die Werte werden im DB-Eintrag gespeichert

8) GIVEN der R2-Key-Pattern
   WHEN ein Upload ausgefuehrt wird
   THEN folgt der generierte Key dem Pattern `references/{projectId}/{uuid}.{ext}` wobei `ext` aus dem MIME-Type abgeleitet wird (`image/png` → `png`, `image/jpeg` → `jpg`, `image/webp` → `webp`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/reference-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ReferenceService.upload', () => {
  // AC-1: File-Upload erzeugt R2-Objekt + DB-Eintrag mit korrekten Dimensionen
  it.todo('should upload a PNG file to R2 and create a DB record with width/height')

  // AC-2: URL-Upload fetcht Bild, speichert in R2, erstellt DB-Eintrag
  it.todo('should fetch image from URL, upload to R2, and create DB record with dimensions')

  // AC-3: Ungueltige MIME-Types werden abgelehnt
  it.todo('should reject file with unsupported MIME type (image/gif)')

  // AC-4: Dateien ueber 10MB werden abgelehnt
  it.todo('should reject file exceeding 10MB size limit')

  // AC-7: Sharp wird fuer Dimensionsextraktion aufgerufen
  it.todo('should extract width and height via sharp metadata')

  // AC-8: R2-Key folgt dem Pattern references/{projectId}/{uuid}.{ext}
  it.todo('should generate R2 key matching pattern references/{projectId}/{uuid}.{ext}')
})

describe('ReferenceService.delete', () => {
  // AC-5: Delete entfernt R2-Objekt und DB-Eintrag
  it.todo('should delete R2 object and DB record')
})

describe('ReferenceService.getByProject', () => {
  // AC-6: getByProject delegiert an Query-Funktion
  it.todo('should delegate to getReferenceImagesByProject and return results')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02-reference-queries | `createReferenceImage` | Async Function | Import aus `lib/db/queries` verfuegbar |
| slice-02-reference-queries | `deleteReferenceImage` | Async Function | Import aus `lib/db/queries` verfuegbar |
| slice-02-reference-queries | `getReferenceImagesByProject` | Async Function | Import aus `lib/db/queries` verfuegbar |
| slice-02-reference-queries | `ReferenceImage` | Type Export | Import aus `lib/db/queries` verfuegbar |
| (existing) | `StorageService.upload` | Async Function | Import aus `lib/clients/storage` verfuegbar |
| (existing) | `StorageService.delete` | Async Function | Import aus `lib/clients/storage` verfuegbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ReferenceService.upload` | Async Function | slice-04 (Server Action) | `(input: { projectId: string, file?: File, url?: string }) => Promise<{ id, imageUrl, width, height }>` |
| `ReferenceService.delete` | Async Function | slice-04 (Server Action) | `(id: string) => Promise<void>` |
| `ReferenceService.getByProject` | Async Function | slice-04 (Server Action) | `(projectId: string) => Promise<ReferenceImage[]>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/reference-service.ts` — Neuer Service: `upload()`, `delete()`, `getByProject()` mit MIME-Validierung, Groessen-Check, R2-Upload, Sharp-Dimensionsextraktion
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions (Slice 04)
- KEINE `uploadFromGallery`-Methode (Slice 05)
- KEINE UI-Komponenten
- KEINE Aenderungen an bestehenden Services oder Storage-Client
- KEINE Prompt-Komposition oder Generation-Logik

**Technische Constraints:**
- Nutze `sharp` (bereits installiert, v0.34.5) fuer `metadata()` Aufruf zur Width/Height-Extraktion
- Nutze `StorageService.upload()` und `StorageService.delete()` aus `lib/clients/storage` (bestehendes Pattern)
- Nutze Query-Funktionen aus `lib/db/queries` (Slice 02 Deliverable)
- MIME-Whitelist: `image/png`, `image/jpeg`, `image/webp` — exakt diese 3 MIME-Types
- Groessen-Limit: 10MB (10 * 1024 * 1024 Bytes)
- R2-Key-Pattern: `references/{projectId}/{uuid}.{ext}` — UUID via `crypto.randomUUID()`
- Extension-Mapping: `image/png` → `png`, `image/jpeg` → `jpg`, `image/webp` → `webp`
- URL-Upload: Server-Side Fetch mit MIME- und Groessen-Validierung des Response
- Export als `ReferenceService` Objekt (konsistent mit `GenerationService` Pattern in `lib/services/generation-service.ts`)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` Section "Server Logic" (Zeilen 136-147) + Section "Validation Rules" (Zeilen 162-171)
- Storage-Pattern: `lib/clients/storage.ts` — `upload(stream, key, contentType)` und `deleteObject(key)` Signaturen
- Upload-Pattern: `app/actions/generations.ts` — `uploadSourceImage()` als Referenz fuer File+URL Handling
